#!/usr/bin/env python3
"""Inventario conservador de derechos del montaje activo de un video."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path
from urllib.parse import unquote, urlparse

from jsonschema import Draft202012Validator
from places import KIT, find_video

SCHEMA = KIT / 'schema/licencias.schema.json'
MEDIA_KEYS = {'src', 'srcAfter', 'video', 'poster', 'figura', 'logo', 'image',
              'resource_id', 'resourceId', 'media_id', 'mediaId', 'hash', 'sha256'}
EXTENSIONS = {'.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.mp4', '.webm', '.mov', '.mp3', '.wav', '.flac', '.ogg'}


def read(path, default=None):
    if not path.is_file():
        return default
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except (ValueError, UnicodeError) as exc:
        raise ValueError(f'JSON inválido: {path}: {exc}') from exc


def sha(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def item(id, tipo, titulo=None, autor=None, licencia=None, licencia_url=None,
         fuente_url=None, atribucion=None, cambios=None, condiciones=None,
         estado_licencia='desconocida', usado_en=None, ficha=None, **extra):
    return dict(id=str(id), tipo=tipo, titulo=titulo, autor=autor, licencia=licencia,
                licencia_url=licencia_url, fuente_url=fuente_url, atribucion=atribucion,
                cambios=cambios or [], condiciones=condiciones or [], estado_licencia=estado_licencia,
                usado_en=usado_en or [], ficha=str(ficha) if ficha else None, **extra)


def is_sa(value):
    return bool(re.search(r'\b(?:CC\s*)?BY[- ]SA\b', value or '', re.I))


def build(video, profile, kit=KIT):
    video, profile, kit = Path(video), Path(profile), Path(kit)
    config_raw = read(video / 'assets/config.json', {})
    configs = config_raw.get('configs')
    if isinstance(configs, list):
        selected = [c for c in configs if c.get('id') == config_raw.get('activeId')]
        if len(selected) != 1:
            raise ValueError('config.json no identifica exactamente una configuración activa')
        config = selected[0]
    else:
        config = config_raw
    info = read(video / 'info.json', {})
    manifest = read(video / 'manifest.json', {})
    design = config.get('design') or manifest.get('design')
    if not isinstance(design, str) or not re.fullmatch(r'[a-zA-Z0-9_-]+', design):
        raise ValueError('Falta un ID de diseño válido en config.json o manifest.json')
    design_dir = kit / 'designs' / design
    design_data = read(design_dir / 'design.json', {})
    storyboard_path = (video / (config.get('storyboardUrl') or 'assets/storyboard.json')).resolve()
    if not storyboard_path.is_relative_to(video.resolve()):
        raise ValueError('storyboardUrl apunta fuera del video')
    storyboard = read(storyboard_path)
    reasons, items = [], []
    if not storyboard or not isinstance(storyboard.get('beats'), list) or not storyboard['beats']:
        reasons.append('Storyboard ausente o vacío: inventario visual incompleto; regenerar al cerrar el video.')
    beats = storyboard.get('beats', []) if isinstance(storyboard, dict) else []
    records = []
    for kind in ('images', 'videos', 'music', 'sounds'):
        for path in sorted((profile / 'resources' / kind).glob('*/resource.json')):
            data = read(path, {})
            if data:
                records.append((path, data, kind))
    catalog_path = kit / 'capas/catalog.json'
    catalog = {x['id']: x for x in read(catalog_path, {}).get('assets', []) if x.get('id')}

    def add(entry):
        for existing in items:
            if existing['id'] == entry['id'] and existing['tipo'] == entry['tipo'] and existing['ficha'] == entry['ficha']:
                existing['usado_en'] = list(dict.fromkeys(existing['usado_en'] + entry['usado_en']))
                existing['cambios'] = list(dict.fromkeys(existing['cambios'] + entry['cambios']))
                return
        items.append(entry)

    def resolve(ref, where, changes=None, kinds=None):
        ref = str(ref)
        url = urlparse(ref)
        path_text = unquote(url.path if url.scheme else ref).split('?')[0]
        if (('/samples/' in path_text and f'/designs/{design}/' in path_text)
                or path_text.startswith(f'designs/{design}/samples/')
                or path_text.startswith('samples/')):
            sample = Path(path_text).name
            add(item('sample:' + sample, 'muestra', sample, cambios=changes, usado_en=[where],
                     ficha=design_dir / 'samples/CREDITS.md'))
            return
        local = Path(path_text) if path_text.startswith('/') else video / path_text
        local = local.resolve()
        permitted = (video.resolve(), profile.resolve(), kit.resolve())
        local_hash = sha(local) if any(local.is_relative_to(root) for root in permitted) and local.is_file() else None
        basename = Path(path_text).name
        matches = []
        for path, data, kind in records:
            if kinds and kind not in kinds:
                continue
            ids = {str(data.get('id') or ''), str(data.get('hash') or '')}
            fullpaths = {str(path.parent / str(data.get(k))) for k in ('file', 'ready_file') if data.get(k)}
            if ref in ids or path_text in fullpaths or (local_hash and local_hash == data.get('hash')):
                matches.append((path, data, kind))
        # File name may be the resource ID (normal copied assets); never match arbitrary generic filenames.
        if not matches and not local_hash:
            stem = Path(basename).stem
            matches = [(p, d, k) for p, d, k in records if (not kinds or k in kinds) and stem == d.get('id')]
        if len(matches) != 1:
            why = 'sin ficha' if not matches else 'ficha ambigua'
            add(item('no-resuelto:' + ref, 'medio', ref, cambios=changes, usado_en=[where],
                     condiciones=[why]))
            return
        path, data, kind = matches[0]
        lic = data.get('license') or None
        if lic and str(lic).strip().lower() in ('desconocida', 'desconocido', 'unknown', 'n/a'):
            lic = None
        terms = str(data.get('usage_terms') or '')
        blocked = data.get('usable') is False or data.get('blocked') is True or data.get('approval_status') in ('blocked', 'rejected') or bool(re.search(r'usable\s*:\s*false|bloquead[oa]|no usar', terms, re.I))
        # The current user decision supersedes the old provisional SA restriction, not other blocks.
        if is_sa(lic) and re.search(r'usable\s*:\s*false', terms, re.I) and re.search(r'falta comprobar que todos los componentes y derechos del audiovisual permitan distribuir la adaptaci[oó]n', terms, re.I) and not re.search(r'no usar|bloquead[oa]', terms, re.I):
            blocked = False
        state = 'bloqueada' if blocked else ('propia' if data.get('estado_licencia') == 'propia' else ('verificada' if lic else 'desconocida'))
        conditions = [terms] if terms and not (is_sa(lic) and not blocked and 'usable: false' in terms.lower()) else []
        if is_sa(lic): conditions.append('Compartir igual: adaptación audiovisual CC BY-SA 4.0; comprobar compatibilidad de todos sus componentes.')
        if re.search(r'\b(?:CC\s*)?BY[- ]NC\b|no comercial', lic or '', re.I): conditions.append('No comercial')
        add(item(data.get('id') or ref, data.get('type') or kind, data.get('name'), data.get('author'), lic,
                 data.get('license_url'), data.get('source_url'), data.get('attribution'), changes, conditions,
                 state, [where], path))

    def changes_for(obj):
        out = []
        if not isinstance(obj, dict): return out
        if obj.get('crop') or obj.get('recorte'): out.append('recortado')
        if obj.get('tone') in ('design', 'duotone', 'duotono') or obj.get('duotono'): out.append('duotono')
        if obj.get('anim') or obj.get('animation') or obj.get('zoom') or obj.get('motion'): out.append('animado')
        if obj.get('zonas') or obj.get('recolor') or obj.get('recoloreado'): out.append('recoloreado')
        return out

    def walk(obj, where, kinds=None, changes=None):
        if isinstance(obj, list):
            for value in obj: walk(value, where, kinds, changes)
        elif isinstance(obj, dict):
            changes = list(dict.fromkeys((changes or []) + changes_for(obj)))
            for key, value in obj.items():
                if key in MEDIA_KEYS and isinstance(value, str) and value:
                    if key in {'resource_id', 'resourceId', 'media_id', 'mediaId', 'hash', 'sha256'} or Path(urlparse(value).path).suffix.lower() in EXTENSIONS:
                        resolve(value, where, changes, kinds)
                elif isinstance(value, (list, dict)):
                    walk(value, where, kinds, changes)

    for index, beat in enumerate(beats):
        if not isinstance(beat, dict):
            reasons.append(f'Beat {index + 1} inválido; inventario incompleto.')
            continue
        where = f"beat {index + 1}" + (f" ({beat.get('at', beat.get('t'))})" if beat.get('at', beat.get('t')) is not None else '')
        params = beat.get('params') or {}
        walk(params, where)
        if beat.get('use') == 'common.capas':
            for member in params.get('elenco', []):
                asset_id = member.get('asset') if isinstance(member, dict) else None
                if not asset_id: continue
                asset = catalog.get(asset_id)
                if not asset:
                    add(item('capas:' + asset_id, 'capa', asset_id, usado_en=[where], ficha=catalog_path))
                    continue
                source = asset.get('source') or {}
                license_value = source.get('license')
                if str(license_value or '').lower() in ('desconocida', 'desconocido', 'unknown', ''): license_value = None
                state = 'verificada' if license_value else 'desconocida'
                origin = next((d for _, d, _ in records if d.get('id') == source.get('resource_id') and source.get('resource_id')), {})
                # Do not borrow credits from a ficha with a conflicting license.
                if origin.get('license') != license_value: origin = {}
                if asset.get('status') in ('bloqueado', 'rechazado') or origin.get('usable') is False: state = 'bloqueada'
                cond = ['Compartir igual'] if is_sa(license_value) else []
                add(item('capas:' + asset_id, 'capa', asset.get('name'), source.get('author'), license_value,
                         origin.get('license_url'), source.get('url') or origin.get('source_url'), origin.get('attribution'),
                         changes_for(member), cond, state, [where], catalog_path))
    # Only selected config fields contain media; skip metadata, plans, generated stems and unused configurations.
    walk({k: v for k, v in config.items() if k not in {'audio', 'soundDesign', 'musicDesign', 'lyricsUrl', 'storyboardUrl', 'components'}}, 'configuración activa')
    for key, kind, id_key in [('soundDesign', 'sounds', 'asset_id'), ('musicDesign', 'music', 'music_asset_id')]:
        spec = config.get(key) or {}
        if not spec: continue
        plan_ref = spec.get('planUrl')
        plan_path = (video / plan_ref).resolve() if isinstance(plan_ref, str) else None
        if not plan_path or not plan_path.is_relative_to(video.resolve()) or not plan_path.is_file():
            reasons.append(f'{key}: falta un plan de mezcla legible; inventario de audio incompleto.')
            continue
        plan = read(plan_path, {})
        cues = plan.get('cues')
        if not isinstance(cues, list):
            reasons.append(f'{key}: plan sin cues; inventario de audio incompleto.')
            continue
        for cue in cues:
            if not isinstance(cue, dict) or not cue.get(id_key):
                reasons.append(f'{key}: cue sin recurso; inventario de audio incompleto.')
                continue
            where = f"{key}: {cue.get('start', '?')} s, duración {cue.get('duration', '?')} s"
            modifications = ['recortado'] if cue.get('source_in') or cue.get('duration') else []
            resolve(cue[id_key], where, modifications, {kind})
    # Fonts are named by the design, but their actual license must be evidenced locally.
    font_names = set()
    fonts = (design_data.get('defaults') or {}).get('fonts') or {}
    if fonts.get('main'): font_names.add(fonts['main'])
    for value in fonts.get('load', []):
        if isinstance(value, str): font_names.add(value.split()[-1])
    for name in sorted(font_names):
        paths = sorted((design_dir / 'fonts').glob('*')) if (design_dir / 'fonts').is_dir() else []
        licences = [p for p in paths if name.lower() in p.name.lower() and ('license' in p.name.lower() or 'ofl' in p.name.lower())]
        if len(licences) == 1:
            content = licences[0].read_text(encoding='utf-8', errors='replace')
            match = re.search(r'^Copyright[^\n]*? (The .+? Authors)(?:\s*\((https?://[^)]+)\))?\s*$', content, re.M)
            lic = 'SIL Open Font License 1.1' if re.search(r'SIL OPEN FONT LICENSE Version 1\.1', content, re.I) else None
            author = match.group(1) if match else None
            source = match.group(2) if match else None
            credit = f'{name} — {author}; {lic} (https://scripts.sil.org/OFL); fuente: {source}' if author and lic and source else None
            add(item('fuente:' + name, 'tipografía', name, author, lic, 'https://scripts.sil.org/OFL' if lic else None,
                     source, credit, condiciones=['Conservar el archivo de licencia al distribuir la fuente.'] if lic else [],
                     estado_licencia='verificada' if lic else 'desconocida', usado_en=['diseño'], ficha=licences[0]))
        else:
            add(item('fuente:' + name, 'tipografía', name, usado_en=['diseño'], ficha=design_dir / 'design.json'))
    add(item('codigo:' + design, 'código', 'Código propio del diseño y componentes del video',
             estado_licencia='propia', usado_en=['diseño'], ficha=design_dir / 'design.json'))
    audio = config.get('audio') or {}
    narration_file = audio.get('narrationSrc') or audio.get('src')
    narration_path = (video / narration_file).resolve() if narration_file else None
    direct_audio = False
    if (not audio.get('narrationSrc') and not config.get('soundDesign') and not config.get('musicDesign')
            and narration_path and narration_path.is_relative_to(video.resolve()) and narration_path.is_file()):
        audio_hash = sha(narration_path)
        direct_audio = any(d.get('hash') == audio_hash and k in {'music', 'sounds'} for _, d, k in records)
        if direct_audio:
            resolve(narration_file, 'audio de configuración activa', kinds={'music', 'sounds'})
    if not direct_audio and narration_path and narration_path.is_relative_to(video.resolve()) and narration_path.is_file():
        qc = read(video / 'work/narration.qc.json', {})
        narration = config.get('narration') or {}
        if not isinstance(narration, dict): narration = {}
        provenance = qc.get('provenance') or []
        voice = qc.get('voice') or narration.get('voice') or next((p.get('voice') for p in provenance if p.get('voice')), None)
        models = sorted({p['model'] for p in provenance if p.get('model')})
        if narration.get('model') and narration['model'] not in models: models.append(narration['model'])
        provider = narration.get('provider')
        try:
            import usage
            ledger = usage.ledger_path(video)
            if ledger.is_file():
                for line in ledger.read_text(encoding='utf-8').splitlines():
                    row = json.loads(line)
                    if row.get('role') == 'voice' and row.get('ok') is not False:
                        provider = row.get('provider') or provider
                        if row.get('model') and row['model'] not in models: models.append(row['model'])
        except (ValueError, OSError):
            pass
        voice_license = narration.get('license') or None
        add(item('voz:narracion', 'voz', 'Narración TTS', autor=narration.get('author'), licencia=voice_license,
                 licencia_url=narration.get('license_url'), fuente_url=narration.get('source_url'),
                 atribucion=narration.get('attribution'), usado_en=['narración'], ficha=video / 'work/narration.qc.json' if qc else video / 'assets/config.json',
                 estado_licencia='verificada' if voice_license else 'desconocida',
                 condiciones=['Revisar condiciones de uso del proveedor TTS.'], proveedor=provider, modelo=', '.join(models) or None, voz=voice))
    else:
        reasons.append('Narración aún no disponible: inventario de voz y mezcla incompleto.')
    lyrics = read(video / 'assets/lyrics.json', {})
    outro = (lyrics.get('metadata') or {}).get('outro') if isinstance(lyrics, dict) else None
    if outro:
        voice = outro.get('voice')
        meta_path = kit / 'outro/voices' / (str(voice).lower() + '.json') if voice else kit / 'outro/voices'
        meta = read(meta_path, {})
        add(item('voz:cierre', 'voz', 'Cierre con voz', autor=meta.get('author'), licencia=meta.get('license'), licencia_url=meta.get('license_url'), fuente_url=meta.get('source_url'), atribucion=meta.get('attribution'), estado_licencia='verificada' if meta.get('license') else 'desconocida', usado_en=[f"cierre desde {outro.get('start', '?')} s"],
                 ficha=meta_path, proveedor=meta.get('provider'), modelo=meta.get('model'), voz=voice,
                 condiciones=['Revisar procedencia y condiciones de uso de la voz de cierre.']))
    for entry in items:
        status, lic = entry['estado_licencia'], entry['licencia'] or ''
        if status in ('desconocida', 'bloqueada'):
            reasons.append(f"{entry['id']}: licencia {status}.")
        if re.search(r'\b(?:CC\s*)?BY[- ]NC\b|no comercial', lic, re.I):
            reasons.append(f"{entry['id']}: licencia no comercial; revisar antes de publicar.")
        if status == 'verificada' and re.search(r'\b(?:CC\s*)?BY(?:[- ]SA|[- ]NC)?\b', lic, re.I):
            if not all(entry.get(k) for k in ('autor', 'licencia_url', 'fuente_url', 'atribucion')):
                reasons.append(f"{entry['id']}: atribución incompleta (autor, licencia, fuente o texto).")
    result_license = 'CC BY-SA 4.0' if any(is_sa(x['licencia']) for x in items) else None
    result = {'contract': 'nexa.licencias/1', 'video': {'id': video.name, 'titulo': config.get('title') or info.get('title') or manifest.get('title'), 'diseno': design},
              'summary': {'licencia_resultante': result_license, 'apto_para_publicar': not reasons, 'motivos': list(dict.fromkeys(reasons))}, 'items': items}
    Draft202012Validator.check_schema(read(SCHEMA))
    Draft202012Validator(read(SCHEMA)).validate(result)
    return result


def markdown(data):
    summary = data['summary']
    esc = lambda s: str(s if s is not None else 'Sin dato').replace('|', '\\|').replace('\n', ' ')
    lines = [f"# Licencias · {data['video']['titulo'] or data['video']['id']}", '',
             f"**Apto para publicar:** {'sí' if summary['apto_para_publicar'] else 'no'}",
             f"**Licencia resultante:** {summary['licencia_resultante'] or 'sin determinar'}", '', '## Motivos', '']
    lines += ['- ' + x for x in summary['motivos']] or ['- Sin bloqueos automáticos detectados.']
    lines += ['', '## Recursos', '', '| Recurso | Tipo | Autor | Licencia | Estado | Uso y cambios | Ficha |', '|---|---|---|---|---|---|---|']
    for x in data['items']:
        lines.append('| ' + ' | '.join(esc(v) for v in (x['titulo'] or x['id'], x['tipo'], x['autor'], x['licencia'], x['estado_licencia'], ', '.join(x['usado_en'] + x['cambios']), x['ficha'])) + ' |')
    lines += ['', '## Condiciones y atribuciones', '']
    for x in data['items']:
        lines.append(f"- **{x['titulo'] or x['id']}**: " + ('; '.join(x['condiciones']) or 'Sin condiciones registradas.') + (f" Atribución: {x['atribucion']}" if x['atribucion'] else ''))
    lines += ['', '## Créditos para pegar en la descripción', '', '```text', 'Créditos:']
    for x in data['items']:
        if x['atribucion']:
            lines.append(x['atribucion'] + ((' Cambios realizados: ' + ', '.join(x['cambios']) + '.') if x['cambios'] else ''))
        elif x['estado_licencia'] not in ('propia',):
            lines.append(f"{x['titulo'] or x['id']}: atribución o licencia pendiente de verificar.")
    if summary['licencia_resultante']:
        lines.append('Adaptación audiovisual bajo CC BY-SA 4.0: https://creativecommons.org/licenses/by-sa/4.0/')
    lines += ['```', '', 'Regenerar tras cada cambio de montaje; revisar derechos, condiciones y atribuciones antes de publicar.', '']
    return '\n'.join(lines)


def generate(video, profile):
    data = build(video, profile)
    (video / 'licencias.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    (video / 'LICENCIAS.md').write_text(markdown(data), encoding='utf-8')
    return data


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('video_id')
    args = parser.parse_args()
    from src.config.profile_layout import layout_for_settings
    from src.config.settings import settings
    video = find_video(args.video_id)
    if video is None:
        parser.error(f'No se encontró el video {args.video_id} en el perfil activo.')
    layout = layout_for_settings(settings)
    result = generate(video, layout.root)
    print(f"{video}: {len(result['items'])} recursos; apto para publicar: {'sí' if result['summary']['apto_para_publicar'] else 'no'}")


if __name__ == '__main__':
    main()
