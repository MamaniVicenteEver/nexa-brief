"""Construcción de promos a partir de recursos registrados."""
from __future__ import annotations
import copy
import re
import subprocess
from pathlib import Path
from src.core.promo_prompts import TEMPLATES
from src.core.template_config import active_config


def build(root: Path, target: Path, read_json, write_json, validate):
    brief = read_json(target / 'brief.json')
    validate('brief', brief)
    template = brief['template']
    if template not in TEMPLATES:
        raise ValueError('plantilla de promo desconocida')
    validate('build-' + template.removeprefix('promo-'), brief)
    script = target / 'work/guion.json'
    script_data = read_json(script) if script.is_file() else None
    lyrics = (read_json(target / 'assets/lyrics.json') if script_data and 'duration_seconds' in script_data
              else script_data if script_data else read_json(target / 'assets/lyrics.json'))
    if script_data and 'duration_seconds' in script_data:
        validate('guion', script_data)
        if [item['lines'] for item in script_data['segments']] != [item['lines'] for item in lyrics['segments']]:
            raise ValueError('los tiempos no corresponden al guion; ejecutá timing')
    validate('guion', lyrics)
    contract = read_json(Path(__file__).resolve().parents[3] / 'skills/nodemotion/promo/templates' / f'{template}.json')
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
        ref = {'id': key[1], 'type': kind, 'src': f'media/{ident}{file.suffix.lower()}'}
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
    base = read_json(Path(__file__).resolve().parents[2] / 'nodemotion/commercial' / template / 'assets/config.json')
    config = copy.deepcopy(active_config(base))
    config['audio']['src'] = 'song.mp3'
    config['lyricsUrl'] = 'lyrics.json'
    if brief['texts']:
        config.setdefault('brand', {}).update({key.removeprefix('brand.'): value for key, value in brief['texts'].items()})
    config['media'] = [refs[entry['id']] for entry in contract['default_media'] if entry['id'] in refs]
    config['scenes'] = copy.deepcopy(scenes)
    assets = target / 'assets'
    (assets / 'media').mkdir(parents=True, exist_ok=True)
    for ident, source in resources.items():
        dest = assets / 'media' / f'{ident}{source.suffix.lower()}'
        if dest.is_symlink() and dest.resolve() == source:
            continue
        if dest.exists() or dest.is_symlink():
            raise ValueError(f'no se reemplaza el archivo existente: {dest}')
        dest.symlink_to(source)
    # Los efectos de eco y algunos paneles convierten el video en imagen fija.
    # El motor necesita una imagen real, no un MP4 asignado a un elemento img.
    video_ids = {item['asset_id'] for item in assigned.values() if item['kind'] == 'video'}
    for ident in sorted(video_ids):
        poster = assets / 'media' / f'{ident}-poster.jpg'
        if poster.is_symlink() or (poster.exists() and not poster.is_file()):
            raise ValueError(f'póster existente inválido: {poster}')
        if not poster.exists():
            try:
                subprocess.run(['ffmpeg', '-v', 'error', '-n', '-ss', '0.5', '-i', str(resources[ident]),
                                '-frames:v', '1', '-update', '1', str(poster)],
                               capture_output=True, text=True, check=True)
            except subprocess.CalledProcessError:
                poster.unlink(missing_ok=True)
                raise
    song = assets / 'song.mp3'
    if not (song.is_symlink() and song.resolve() == music_path):
        if song.exists() or song.is_symlink():
            raise ValueError('ya existe assets/song.mp3')
        song.symlink_to(music_path)
    write_json(assets / 'lyrics.json', lyrics)
    write_json(assets / 'config.json', {'activeId': config['id'], 'configs': [config]})
    return {'config': str(assets / 'config.json'), 'lyrics': str(assets / 'lyrics.json'), 'resources': sorted(resources), 'duration_seconds': duration}
