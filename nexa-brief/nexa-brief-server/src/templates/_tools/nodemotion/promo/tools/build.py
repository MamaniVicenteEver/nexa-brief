"""Construcción de promos a partir de recursos registrados."""
from __future__ import annotations
import copy
import re
import subprocess
from pathlib import Path
from src.core.nodemotion.promo.prompts import TEMPLATES
from src.core.nodemotion.promo.paths import work_script_path
from src.core.template_config import active_config
from src.core.nodemotion.promo.workspace import prepared_reference, timeline
from src.core.nodemotion.shared.resources import _resolve_ref, poster_ref


def apply_config_overrides(config, changes):
    """Aplica parámetros editoriales sin permitir cambiar medios ni rutas."""
    fields={'intro':{'enabled','title','sub'},
            'outro':{'enabled','version','minSec','title','cta'}}
    if not isinstance(changes,dict) or set(changes)-{'intro','outro','palette'}:
        raise ValueError('config-overrides: solo se admiten intro, outro y palette')
    result=copy.deepcopy(config)
    for group,values in changes.items():
        base=config.get(group)
        if not isinstance(values,dict) or not isinstance(base,dict):
            raise ValueError('config-overrides: sección no admitida o inválida')
        allowed=set(base) if group=='palette' else fields[group] & set(base)
        if set(values)-allowed:
            raise ValueError('config-overrides: propiedad no admitida por la plantilla')
        for key,value in values.items():
            if group=='palette':
                valid=isinstance(value,str) and re.fullmatch(r'#[0-9a-fA-F]{6}',value)
            elif key=='enabled':
                valid=type(value) is bool
            elif key=='version':
                valid=value in ('v1','v2')
            elif key=='minSec':
                valid=type(value) in (int,float) and 1.5 <= value <= 12
            else:
                valid=isinstance(value,str) and len(value)<=100
            if not valid:
                raise ValueError(f'config-overrides: valor inválido en {group}.{key}')
        result[group].update(copy.deepcopy(values))
    return result



def apply_campaign_texts(config, texts):
    """Aplica campos estructurados de la campaña al grupo configurado por diseño."""
    if not isinstance(texts, dict):
        raise ValueError("texts debe ser un objeto")
    result = copy.deepcopy(config)
    for key, value in texts.items():
        if not isinstance(key, str):
            raise ValueError("clave de texto inválida")
        group, separator, field = key.partition(".")
        if not separator or group not in ("brand", "intro", "outro") or not field:
            raise ValueError(f"campo de texto de campaña no admitido: {key}")
        target = result.get(group)
        if not isinstance(target, dict):
            raise ValueError(f"la configuración no declara el grupo {group}")
        if group != "brand" and field not in target:
            raise ValueError(f"la configuración no declara el campo {key}")
        target[field] = value
    return result

def build(root: Path, target: Path, read_json, write_json, validate):
    brief = read_json(target / 'brief.json')
    validate('brief', brief)
    template = brief['template']
    if template not in TEMPLATES:
        raise ValueError('plantilla de promo desconocida')
    validate('build-' + template.removeprefix('promo-'), brief)
    script = work_script_path(target)
    script_data = read_json(script) if script.is_file() else None
    lyrics = (timeline(target, read_json) if script_data and 'duration_seconds' in script_data
              else script_data if script_data else timeline(target, read_json))
    if script_data and 'duration_seconds' in script_data:
        validate('guion', script_data)
        if [item['lines'] for item in script_data['segments']] != [item['lines'] for item in lyrics['segments']]:
            raise ValueError('los tiempos no corresponden al guion; ejecutá timing')
    validate('guion', lyrics)
    contract = read_json(Path(__file__).resolve().parents[1] / 'production/templates' / f'{template}.json')
    scenes = copy.deepcopy(contract['default_scenes'])
    if template == 'promo-dynamic':
        # Los fragmentos del demo no pertenecen al relato de un video nuevo.
        scenes = [{key: value for key, value in scene.items() if key not in ('flyer', 'flyerAt')} for scene in scenes]
    overrides = target / 'scene-overrides.json'
    if overrides.exists():
        changes = read_json(overrides)
        if not isinstance(changes, dict):
            raise ValueError('scene-overrides debe ser un objeto')
        allowed_types = {scene['type'] for scene in scenes}
        allowed_media = {entry['id'] for entry in contract['default_media']}
        allowed_keys = {key for scene in contract['default_scenes'] for key in scene} | {'type', 'media', 'cover', 'coverFrom', 'bg', 'side', 'align', 'y', 'small', 'dark', 'textWidth'}
        for number, scene in changes.items():
            if not str(number).isdigit() or not 1 <= int(number) <= len(scenes) or not isinstance(scene, dict):
                raise ValueError('escena modificada inválida')
            if set(scene) - allowed_keys:
                raise ValueError('propiedad de escena no admitida')
            if 'dark' in scene and (scene.get('type') != 'mediaWord' or not isinstance(scene['dark'], bool)):
                raise ValueError('dark requiere mediaWord y un booleano')
            if scene.get('type') not in allowed_types:
                raise ValueError('tipo de escena desconocido')
            if 'textWidth' in scene:
                width = scene['textWidth']
                if scene.get('type') not in ('mediaWord', 'stack', 'bigNumber') or isinstance(width, bool) or not isinstance(width, (int, float)) or not 0.3 <= width <= 0.9:
                    raise ValueError('textWidth requiere una escena de texto y un valor entre 0.3 y 0.9')
            media = scene.get('media', [])
            if not isinstance(media, list) or any(item not in allowed_media for item in media):
                raise ValueError('medios de escena desconocidos')
            scenes[int(number) - 1] = copy.deepcopy(scene)
    if template == 'promo-editorial' and any(scene['type'] == 'versus' for scene in scenes):
        if not all(brief['texts'].get(key, '').strip() for key in ('brand.left', 'brand.right')):
            raise ValueError('versus necesita dos polos; sustituí la escena si no hay oposición')
    segments = lyrics['segments']
    if not segments or len(segments) % len(scenes):
        raise ValueError('se necesitan ciclos completos con un segmento por escena')
    duration = lyrics['metadata']['audio_duration_sec']
    if abs(brief['duration_seconds'] - duration) > .02:
        raise ValueError('el brief y el guion deben tener la misma duración')
    if abs(segments[0]['start']) > .001 or abs(segments[-1]['end'] - duration) > .02:
        raise ValueError('el guion debe cubrir toda la música')
    for i, segment in enumerate(segments):
        if segment['end'] <= segment['start'] or (i and abs(segment['start'] - segments[i-1]['end']) > .02):
            raise ValueError('los segmentos deben ser consecutivos y tener duración positiva')
    music = read_json(target / 'music.json')
    if abs(music['duration_seconds'] - duration) > .02:
        raise ValueError('la duración de música y guion no coincide')
    plan = read_json(target / 'media-plan.json')
    validate('media-plan', plan)
    needed = {(i + 1, slot) for i, scene in enumerate(scenes) for slot in scene.get('media', [])}
    assigned = {(item['scene'], item['slot']): item for item in plan['items']}
    if len(assigned) != len(plan['items']) or set(assigned) != needed:
        raise ValueError('el plan debe asignar exactamente todos los usos de escenas')
    expected = {entry['id']: entry['type'] for entry in contract['default_media']}
    resources = {}
    resource_refs = {}
    refs = {}
    for key, item in assigned.items():
        ident, kind = item.get('asset_id'), item['kind']
        if not ident or not re.fullmatch(r'[A-Za-z0-9_-]{1,80}', ident) or kind != expected[key[1]]:
            raise ValueError(f'recurso o tipo inválido para {key}')
        folder = root / 'resources' / {'image': 'images', 'video': 'videos'}[kind] / ident
        metadata = read_json(folder / 'resource.json')
        if metadata['id'] != ident or metadata['type'] != kind or not all(metadata.get(k) for k in ('attribution', 'license', 'license_url')):
            raise ValueError(f'ficha incompleta: {ident}')
        file = (folder / (metadata.get('ready_file') or metadata['file'])).resolve(strict=True)
        if not file.is_relative_to(folder.resolve()):
            raise ValueError('el recurso sale de su carpeta')
        resources[ident] = file
        virtual = f'media/{ident}{file.suffix.lower()}'
        resource_refs[virtual] = prepared_reference(root, kind, ident, metadata.get('ready_file') or metadata['file'])
        ref = {'id': key[1], 'type': kind, 'src': virtual}
        if kind == 'video':
            ref['poster'] = f'media/{ident}-poster.jpg'
        if key[1] in refs and refs[key[1]] != ref:
            raise ValueError(f'el slot {key[1]} refiere a más de un recurso')
        refs[key[1]] = ref
    if not re.fullmatch(r'[A-Za-z0-9_-]{1,80}', music['asset_id']):
        raise ValueError('id de música inválido')
    music_folder = root / 'resources/music' / music['asset_id']
    music_metadata = read_json(music_folder / 'resource.json')
    if music_metadata.get('id') != music['asset_id'] or music_metadata.get('type') != 'music' or not all(music_metadata.get(k) for k in ('attribution', 'license', 'license_url')):
        raise ValueError('ficha de música incompleta')
    music_path = (music_folder / music['ready_file']).resolve(strict=True)
    if not music_path.is_relative_to(music_folder.resolve()):
        raise ValueError('la música sale de su carpeta')
    actual = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', str(music_path)], capture_output=True, text=True, check=True).stdout)
    if abs(actual - duration) > .15:
        raise ValueError(f'el audio dura {actual:.2f}s, no {duration}s')
    resource_refs['song.mp3'] = prepared_reference(root, 'music', music['asset_id'], music['ready_file'])
    base = read_json(Path(__file__).resolve().parents[4] / 'nodemotion/commercial' / template / 'assets/config.json')
    config = copy.deepcopy(active_config(base))
    config['audio']['src'] = 'song.mp3'
    config['lyricsUrl'] = 'lyrics.json'
    if brief['texts']:
        config = apply_campaign_texts(config, brief['texts'])
    overrides=target/'config-overrides.json'
    if overrides.exists() or overrides.is_symlink():
        if overrides.is_symlink() or not overrides.is_file():
            raise ValueError('config-overrides debe ser un archivo del proyecto, sin enlaces')
        config=apply_config_overrides(config,read_json(overrides))
    config['media'] = [refs[entry['id']] for entry in contract['default_media'] if entry['id'] in refs]
    config['scenes'] = copy.deepcopy(scenes)
    assets = target / 'assets'
    from src.core.nodemotion.service import create_project, load_project
    previous = load_project(target)
    # Existing posters are shared byte-for-byte, never recompressed. Their
    # original media link must still identify the exact selected video.
    video_ids = {item['asset_id'] for item in assigned.values() if item['kind'] == 'video'}
    for ident in sorted(video_ids):
        virtual = f'media/{ident}-poster.jpg'
        source = resources[ident]
        media_virtual = f'media/{ident}{source.suffix.lower()}'
        video_ref = resource_refs[media_virtual]
        historical = assets / virtual
        previous_ref = (previous or {}).get('assets', {}).get(virtual)
        if previous_ref and {key: value for key, value in previous_ref.items() if key != 'poster'} == video_ref:
            _resolve_ref(previous_ref)
            resource_refs[virtual] = previous_ref
        elif historical.exists() or historical.is_symlink():
            original_media = assets / media_virtual
            if (historical.is_symlink() or not historical.is_file() or not original_media.is_file()
                    or original_media.resolve() != source):
                raise ValueError(f'póster existente sin origen verificable: {historical}')
            resource_refs[virtual] = poster_ref(video_ref, historical=historical)
        else:
            resource_refs[virtual] = poster_ref(video_ref)
    write_json(assets / 'config.json', {'activeId': config['id'], 'configs': [config]})
    create_project(target, template, resource_refs, timeline=lyrics, workspace_only=True)
    write_json(assets / 'timeline.json', lyrics)
    # Transitional JSON alias for legacy editorial tools; media and engines
    # are resolved exclusively through the shared project contract.
    write_json(assets / 'lyrics.json', lyrics)
    return {'config': str(assets / 'config.json'), 'lyrics': str(assets / 'lyrics.json'), 'resources': sorted(resources), 'duration_seconds': duration}
