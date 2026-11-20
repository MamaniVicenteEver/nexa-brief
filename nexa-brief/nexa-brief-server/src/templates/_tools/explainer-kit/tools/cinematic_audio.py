#!/usr/bin/env python3
"""Música por actos, sobre voz limpia y el stem de efectos original.

Ejecutar desde nexa-brief-server con el perfil activo. No descarga música ni usa
la mezcla anterior como entrada: repetir un plan nunca duplica música o efectos.
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import math
import os
from pathlib import Path
import re
import sys
import tempfile
import unicodedata
from urllib.parse import urlparse

# El archivo vive en src/templates/_tools/explainer-kit/tools/.
SERVER = Path(__file__).resolve().parents[5]
sys.path.insert(0, str(SERVER))


def digest(path):
    value = hashlib.sha256()
    with Path(path).open('rb') as source:
        for block in iter(lambda: source.read(1024 * 1024), b''):
            value.update(block)
    return value.hexdigest()


def within(root, relative):
    root = Path(root).resolve()
    path = (root / relative).resolve()
    if not path.is_relative_to(root) or not path.is_file():
        raise ValueError('Archivo inexistente o fuera del proyecto: ' + str(relative))
    return path


def active_config(raw):
    rows = raw.get('configs', [raw])
    return next((row for row in rows if row.get('id') == raw.get('activeId')), rows[0])


def prepare_public_credit(project, metadata_by_id):
    """Preflight sin escrituras: el crédito CC BY debe quedar visible al publicar."""
    path = within(project, 'publish.json')
    before = path.read_bytes()
    data = json.loads(before)
    if (not isinstance(data, dict) or data.get('schema_version') != 2
            or not isinstance(data.get('pinned_comment'), str)
            or not isinstance(data.get('credits'), list)
            or not all(isinstance(row, str) for row in data['credits'])):
        raise ValueError('Crédito musical: publish.json debe ser paquete v2 con pinned_comment y credits estructurados.')
    signature = '; recortada y con fundidos.'
    pinned_lines = data['pinned_comment'].splitlines()
    owned = lambda line: line.startswith('Música: ') and line.endswith(signature)
    if any(line.startswith('Música: ') and not owned(line) for line in pinned_lines):
        raise ValueError('Crédito musical: existe un bloque Música ajeno; revisarlo antes de reemplazarlo.')
    base = '\n'.join(line for line in pinned_lines if not owned(line)).strip()
    rows = [row for row in data['credits'] if not owned(row)]
    public_lines, source_urls = [], {}
    for asset_id, meta in metadata_by_id.items():
        compact = lambda key: ' '.join(str(meta.get(key, '')).split())
        name, author, license_name = compact('name'), compact('author'), compact('license')
        source, license_url = compact('source_url'), compact('license_url')
        if not all((name, author, license_name, source, license_url)):
            raise ValueError('Crédito musical: faltan título, autor, licencia o enlaces verificables.')
        structured = f'Música: {name} — {author} — {license_name}; {source}; {license_url}{signature}'
        if not any(all(value.casefold() in row.casefold() for value in (author, license_name, source, license_url)) for row in rows):
            rows.append(structured)
        if normalized(license_name).replace('-', ' ').startswith('cc by'):
            # El checker de comentarios cuenta cada "?": el enlace directo guardado
            # de la misma pista evita confundir una query con otra pregunta editorial.
            public_source = compact('download_url') or source
            for url in (public_source, license_url):
                parsed = urlparse(url)
                if parsed.scheme not in ('http', 'https') or not parsed.netloc or '?' in url:
                    raise ValueError('Crédito musical: se necesita un enlace público verificable sin query; no se truncan URLs.')
            public_line = f'Música: {name} — {author} — {license_name}; {public_source}; {license_url}{signature}'
            public_lines.append(public_line)
            if public_line not in rows:
                rows.append(public_line)
            source_urls[asset_id] = public_source
    if public_lines:
        question = base.find('¿')
        if question < 0 or base.count('?') != 2 or not base.endswith('?'):
            raise ValueError('Crédito musical: el comentario debe conservar dato y dos preguntas finales antes de sincronizar.')
        pinned = base[:question].rstrip() + '\n' + '\n'.join(public_lines) + '\n' + base[question:].lstrip()
    else:
        pinned = base
    if len(pinned) > 420:
        raise ValueError(f'Crédito musical público: comentario de {len(pinned)} caracteres (máximo 420); '
                         'acortá el dato o las preguntas para incluir la atribución, sin truncar los enlaces.')
    data['credits'], data['pinned_comment'] = rows, pinned
    return {'path':path, 'before':before, 'data':data,
            'placement':'pinned_comment' if public_lines else 'structured_credits', 'source_urls':source_urls}


def select_mix(project, config_file, original_config, raw, config, narration, output, publication):
    if config_file.read_bytes() != original_config:
        raise ValueError('La configuración cambió durante la mezcla; master guardado sin aplicarlo.')
    if publication['path'].read_bytes() != publication['before']:
        raise ValueError('El paquete editorial cambió durante la mezcla; no se selecciona el audio.')
    rel = lambda p: p.relative_to(project).as_posix()
    config['audio'] = dict(config.get('audio', {}), narrationSrc=rel(narration), src=rel(output/'song-with-outro.mp3'))
    config['musicDesign'] = {'version': 1, 'planUrl': rel(output/'plan.json'), 'musicSrc': rel(output/'music.flac'),
                             'masterSrc': rel(output/'mix.wav'), 'creditsUrl': rel(output/'CREDITS.md'),
                             'voiceUnchanged': True, 'effectsUnchanged': True, 'ducking': True}
    data = json.dumps(raw, ensure_ascii=False, indent=2) + '\n'
    publish_bytes = (json.dumps(publication['data'], ensure_ascii=False, indent=2) + '\n').encode()
    if publish_bytes != publication['before']:
        temporary = publication['path'].with_suffix('.music-tmp.json')
        temporary.write_bytes(publish_bytes)
        os.replace(temporary, publication['path'])
    if data.encode() != original_config:
        temporary = config_file.with_suffix('.music-tmp.json')
        temporary.write_text(data)
        os.replace(temporary, config_file)


def validate_plan(plan, duration):
    if plan.get('version') != 1 or not isinstance(plan.get('cues'), list) or not 1 <= len(plan['cues']) <= 30:
        raise ValueError('El plan musical v1 necesita entre uno y treinta cues.')
    result = []
    for item in plan['cues']:
        asset_id = item.get('music_asset_id', '')
        if not re.fullmatch(r'[A-Za-z0-9_-]{1,100}', asset_id):
            raise ValueError('music_asset_id inválido.')
        cue = {key: float(item.get(key, default)) for key, default in
               [('start', 0), ('source_in', 0), ('duration', 0), ('gain_db', -27), ('fade_in', 2), ('fade_out', 3)]}
        if not all(math.isfinite(x) for x in cue.values()):
            raise ValueError('El plan contiene números no finitos.')
        if cue['start'] < 0 or cue['source_in'] < 0 or cue['duration'] <= 0 or cue['start'] + cue['duration'] > duration + .001:
            raise ValueError('Cue fuera de la duración de la narración.')
        if not -60 <= cue['gain_db'] <= -12:
            raise ValueError('Música bajo voz: gain_db debe estar entre −60 y −12.')
        if min(cue['fade_in'], cue['fade_out']) < 0 or cue['fade_in'] + cue['fade_out'] > cue['duration']:
            raise ValueError('Fundidos fuera de la duración del cue.')
        cue = dict(cue, music_asset_id=asset_id, purpose=str(item.get('purpose', ''))[:400])
        if 'mood' in item:
            cue['mood'] = str(item['mood'])[:100]
        result.append(cue)
    # Los silencios intencionales se expresan mediante huecos entre cues.
    for left, right in zip(sorted(result, key=lambda x: x['start']), sorted(result, key=lambda x: x['start'])[1:]):
        if left['start'] + left['duration'] > right['start'] + .001:
            raise ValueError('Los cues musicales no se superponen; usar ventanas por acto.')
    return result


def resolve_music(asset_id, resources_root):
    from src.core.library.asset_library import get_music_entry, resolve_music_path
    entry = get_music_entry(asset_id)
    path = resolve_music_path(asset_id).resolve()
    root = Path(resources_root).resolve()
    if not path.is_relative_to(root) or path.is_symlink():
        raise ValueError('La música debe pertenecer a la biblioteca del perfil activo.')
    metadata = within(root, f'music/{asset_id}/resource.json')
    data = json.loads(metadata.read_text())
    if data.get('approval_status', 'approved') != 'approved':
        raise ValueError('La ficha musical está pendiente o rechazada.')
    license_name = str(data.get('license', '')).strip().upper()
    if not re.fullmatch(r'CC[ -]BY[ -](?:4\.0|3\.0)|CC0(?:[ -]1\.0)?', license_name):
        raise ValueError('La pista necesita licencia comercial verificable CC0 o CC BY.')
    if not all(data.get(key) for key in ('author', 'source_url', 'license_url', 'attribution', 'hash')):
        raise ValueError('La ficha musical no tiene procedencia y atribución completas.')
    actual_hash = digest(path)
    if actual_hash != entry.content_hash or actual_hash != data['hash']:
        raise ValueError('El archivo musical no coincide con la biblioteca y su ficha de licencia.')
    return path, data


def normalized(value):
    return ''.join(c for c in unicodedata.normalize('NFD', str(value).lower()) if not unicodedata.combining(c))


def choose_auto_music(resources_root, mood='cinematic', purpose='', required_seconds=0):
    """Selector local determinista: ningún ID ni licencia sale del agente aislado."""
    from src.core.library.asset_library import list_music
    moods = {
        'cinematic': ('cinematograf', 'cinematic', 'drama', 'epic', 'suspense', 'tension'),
        'tension': ('tension', 'suspense', 'intriga', 'thriller', 'drama', 'cinematograf'),
        'suspense': ('suspense', 'intriga', 'thriller', 'tension', 'cinematograf'),
        'drama': ('drama', 'cinematograf', 'cinematic', 'orquest'),
        'epic': ('epic', 'epico', 'orquest', 'orchestral'),
        'reflective': ('reflect', 'reflex', 'melancol', 'piano', 'ambient', 'suave'),
    }
    mood = normalized(mood).strip()
    mood = {'cinematografico':'cinematic', 'dramatico':'drama', 'epico':'epic',
            'reflexivo':'reflective', 'intriga':'suspense'}.get(mood, mood)
    if mood not in moods:
        raise ValueError('Mood musical desconocido: usar cinematic, tension, suspense, drama, epic o reflective.')
    candidates = []
    for entry in list_music():
        if float(getattr(entry, 'duration_seconds', 0)) + .001 < required_seconds:
            continue
        try:
            _, metadata = resolve_music(entry.asset_id, resources_root)
        except (ValueError, OSError):
            continue
        tags = metadata.get('tags') or []
        text = normalized(' '.join([str(metadata.get(key, '')) for key in ('name', 'description')])
                          + ' ' + (' '.join(tags) if isinstance(tags, list) else str(tags)))
        if 'instrumental' not in text or not any(token in text for token in moods[mood]):
            continue
        purpose_words = {w for w in re.findall(r'[a-z]{5,}', normalized(purpose))}
        score = sum(token in text for token in moods[mood]) * 10 + sum(word in text for word in purpose_words)
        candidates.append((-score, entry.asset_id))
    if not candidates:
        raise ValueError(f'No hay música instrumental con licencia comprobada adecuada para mood={mood} en el perfil activo.')
    return sorted(candidates)[0][1]


async def mix_music_bus(base, cues, master, stem_wav, mixer):
    """Una salida por proceso evita truncar un stem al cerrar el master.

    Mantiene el ducking y el margen de pico del adaptador compartido. La voz y
    los efectos originales se suman después, sin pasar por ningún compresor.
    """
    from src.adapters.sound_effects.ffmpeg_mixer import _command
    facts = await mixer.inspect(base)
    headroom = .985 - 10 ** (facts.peak_dbfs / 20)
    if headroom <= 0:
        raise ValueError('La voz y los efectos no tienen margen para sumar música sin saturación.')
    samples = round(facts.duration_seconds * 48000)
    args = ['ffmpeg', '-y', '-v', 'error', '-filter_complex_threads', '1', '-i', str(base)]
    filters = ['[0:a]aresample=48000,aformat=channel_layouts=stereo,asetpts=PTS-STARTPTS[detector]']
    for index, cue in enumerate(cues, 1):
        args += ['-i', str(cue.path)]
        filters.append(f'[{index}:a]atrim=start={cue.source_in:.6f}:duration={cue.duration:.6f},asetpts=PTS-STARTPTS,'
                       f'aresample=48000,aformat=channel_layouts=stereo,asettb=1/48000,asetpts=N/SR/TB,volume={cue.gain_db:.3f}dB,'
                       f'afade=t=in:d={cue.fade_in:.6f},afade=t=out:st={cue.duration-cue.fade_out:.6f}:d={cue.fade_out:.6f},'
                       f'adelay={round(cue.start*48000)}S|{round(cue.start*48000)}S[m{index}]')
    labels = ''.join(f'[m{i}]' for i in range(1, len(cues)+1))
    filters.append(labels + f'amix=inputs={len(cues)}:duration=longest:normalize=0,asettb=1/48000,asetpts=N/SR/TB,'
                   f'apad=whole_len={samples},atrim=end_sample={samples}[music]')
    filters.append('[music][detector]sidechaincompress=threshold=0.04:ratio=3:attack=15:release=250:makeup=1[ducked]')
    limit = min(1, max(.0625, headroom))
    scale = min(1, headroom/limit)
    filters.append(f'[ducked]apad=pad_len=239,alimiter=limit={limit:.9f}:attack=5:level=false,'
                   f'atrim=start_sample=239,asetpts=PTS-STARTPTS,volume={scale:.9f},'
                   f'apad=whole_len={samples},atrim=end_sample={samples}[safe]')
    await _command(*args, '-filter_complex', ';'.join(filters), '-map', '[safe]', '-ar', '48000',
                   '-c:a', 'pcm_f32le', str(stem_wav), timeout=300)
    await _command('ffmpeg', '-y', '-v', 'error', '-filter_complex_threads', '1', '-i', str(base), '-i', str(stem_wav),
                   '-filter_complex', '[0:a]aresample=48000,aformat=channel_layouts=stereo[v];'
                   '[1:a]aresample=48000,aformat=channel_layouts=stereo[m];'
                   '[v][m]amix=inputs=2:duration=first:normalize=0[out]',
                   '-map', '[out]', '-c:a', 'pcm_s24le', str(master), timeout=300)


async def render(project, plan, profile, *, apply=False):
    from src.adapters.sound_effects.ffmpeg_mixer import FFmpegSoundMixer, _command
    from src.core.ports.sound_effects_port import ResolvedSoundCue
    from src.config.settings import settings
    from src.config.profile_layout import layout_for_settings
    layout = layout_for_settings(settings)
    profile, project = Path(profile).resolve(), Path(project).resolve()
    info = json.loads(within(profile, 'profile.json').read_text())
    if layout.root.resolve() != profile or info.get('id') != profile.name:
        raise ValueError('El perfil solicitado no coincide con el proceso.')
    if not any(project.is_relative_to(profile / folder) for folder in ('productions', 'sandbox')):
        raise ValueError('El proyecto debe estar en sandbox o productions del perfil activo.')
    config_file = within(project, 'assets/config.json')
    original_config = config_file.read_bytes()
    raw = json.loads(original_config)
    config = active_config(raw)
    audio = config.get('audio', {})
    narration = within(project, audio.get('narrationSrc') or audio.get('src', 'assets/song.mp3'))
    # Una mezcla declarada siempre necesita la referencia a la narración limpia.
    if (config.get('soundDesign') or config.get('musicDesign')) and not audio.get('narrationSrc'):
        raise ValueError('Falta audio.narrationSrc: no se mezcla sobre un master anterior.')
    effects_name = (config.get('soundDesign') or {}).get('effectsSrc')
    effects = within(project, effects_name) if effects_name else None
    mixer = FFmpegSoundMixer()
    voice = await mixer.inspect(narration)
    cues = validate_plan(plan, voice.duration_seconds)
    for cue in cues:
        if cue['music_asset_id'] == 'auto':
            cue['music_asset_id'] = choose_auto_music(layout.resources_dir, cue.get('mood', 'cinematic'), cue['purpose'],
                                                       cue['source_in'] + cue['duration'])
            cue['requested_music_asset_id'] = 'auto'
    resolved, credits, music_cache = [], {}, {}
    for cue in cues:
        if cue['music_asset_id'] not in music_cache:
            path, meta = resolve_music(cue['music_asset_id'], layout.resources_dir)
            music_cache[cue['music_asset_id']] = (path, meta, await mixer.inspect(path))
        path, meta, facts = music_cache[cue['music_asset_id']]
        if cue['source_in'] + cue['duration'] > facts.duration_seconds + .001:
            raise ValueError('La ventana musical supera la pista; elegí un recorte válido.')
        resolved.append(ResolvedSoundCue(asset_id=cue['music_asset_id'], path=path,
                        **{k: cue[k] for k in ('start', 'source_in', 'duration', 'gain_db', 'fade_in', 'fade_out')}))
        credits[cue['music_asset_id']] = {key: meta[key] for key in
                    ('name', 'author', 'source_url', 'license', 'license_url', 'attribution', 'hash')}
    effects_hash = digest(effects) if effects else None
    # Validar la publicación ANTES de crear archivos o seleccionar la mezcla.
    publication = prepare_public_credit(project, {key:value[1] for key,value in music_cache.items()}) if apply else None
    identity = {'version': 1, 'mixing_engine': 'music-bus-single-output-v1', 'cues': cues, 'narration_hash': voice.content_hash,
                'effects_hash': effects_hash, 'credits': credits}
    stamp = hashlib.sha256(json.dumps(identity, sort_keys=True).encode()).hexdigest()[:20]
    output = project / 'assets/music-design' / stamp
    output.mkdir(parents=True, exist_ok=True)
    master, music_stem = output / 'mix.wav', output / 'music.flac'
    playback = output / 'song-with-outro.mp3'
    credit_file = output/'CREDITS.md'
    cached_file = output/'plan.json'
    if cached_file.is_file():
        try:
            cached = json.loads(cached_file.read_text())
        except (ValueError, OSError):
            cached = {}
        expected = cached.get('output_hashes', {})
        if (all(cached.get(key) == value for key, value in identity.items())
                and all(expected.get(path.name) and path.is_file() and digest(path) == expected[path.name]
                        for path in (master, music_stem, playback, credit_file))):
            if apply:
                select_mix(project, config_file, original_config, raw, config, narration, output, publication)
                cached['public_credit_placement'] = publication['placement']
                cached['public_credit_source_urls'] = publication['source_urls']
                cached_file.write_text(json.dumps(cached, ensure_ascii=False, indent=2) + '\n')
            return dict(cached, playback=str(playback), master=str(master), music_stem=str(music_stem), applied=apply, reused=True)
    with tempfile.TemporaryDirectory(prefix='.music-work-', dir=output) as tmp:
        tmp = Path(tmp)
        base = narration
        if effects:
            base = tmp / 'voice-and-effects.wav'
            # Sumamos una sola vez los originales. La voz y los efectos no se normalizan.
            await _command('ffmpeg', '-y', '-v', 'error', '-threads', '1', '-i', str(narration), '-i', str(effects),
                           '-filter_complex', '[0:a]aresample=48000,aformat=channel_layouts=stereo[v];'
                           '[1:a]aresample=48000,aformat=channel_layouts=stereo[f];'
                           '[v][f]amix=inputs=2:duration=first:normalize=0[out]',
                           '-map', '[out]', '-c:a', 'pcm_f32le', str(base))
        working_master = tmp / 'mix.wav'
        working_stem = tmp/'music.wav'
        await mix_music_bus(base, resolved, working_master, working_stem, mixer)
        await _command('ffmpeg', '-y', '-v', 'error', '-threads', '1', '-i',
                       str(working_stem), '-c:a', 'flac', str(tmp/'music.flac'))
        await _command('ffmpeg', '-y', '-v', 'error', '-threads', '1', '-i', str(working_master),
                       '-c:a', 'libmp3lame', '-b:a', '192k', str(tmp/playback.name))
        result_facts = await mixer.inspect(working_master)
        stem_facts = await mixer.inspect(tmp/'music.flac')
        if abs(result_facts.duration_seconds - voice.duration_seconds) > 1 / 48000 or digest(narration) != voice.content_hash:
            raise ValueError('La mezcla no conserva la narración y su duración.')
        if abs(stem_facts.duration_seconds - voice.duration_seconds) > 1 / 48000:
            raise ValueError('El stem musical no conserva la duración completa; no se selecciona la mezcla.')
        if effects and digest(effects) != effects_hash:
            raise ValueError('El stem de efectos original cambió durante la mezcla.')
        for name in ('mix.wav', 'music.flac', playback.name):
            os.replace(tmp/name, output/name)
    credit_lines = [item['attribution'] + ' Música recortada, atenuada bajo voz y con fundidos.' for item in credits.values()]
    credit_file.write_text('# Música de fondo\n\n' + '\n\n'.join(credit_lines) + '\n')
    report = dict(identity, duration_seconds=voice.duration_seconds, master_peak_dbfs=result_facts.peak_dbfs,
                  ducking=True, clean_narration_unchanged=True, original_effects_unchanged=True,
                  plan_hash=stamp, silence='Huecos entre cues; no se añade silencio a la voz.',
                  output_hashes={path.name: digest(path) for path in (master, music_stem, playback, credit_file)})
    (output / 'plan.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    if apply:
        # Un cambio concurrente se conserva: nunca pisar la configuración de otro trabajo.
        select_mix(project, config_file, original_config, raw, config, narration, output, publication)
        report['public_credit_placement'] = publication['placement']
        report['public_credit_source_urls'] = publication['source_urls']
        (output/'plan.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    return dict(report, playback=str(playback), master=str(master), music_stem=str(music_stem), applied=apply, reused=False)


def run_locked(project, plan, profile, *, apply=False):
    """La CLI y el host comparten la misma exclusión por episodio."""
    import fcntl
    project, profile = Path(project).resolve(), Path(profile).resolve()
    if not any(project.is_relative_to(profile/folder) for folder in ('productions', 'sandbox')):
        raise ValueError('El proyecto debe pertenecer al perfil solicitado.')
    within(project, 'assets/config.json')
    (project/'work').mkdir(exist_ok=True)
    with (project/'work/.music-mix.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        return asyncio.run(render(project, plan, profile, apply=apply))


def apply_declared_plan(project):
    """Finalización del host: solo Imperio y un plan explícito del agente.

    Una excepción impide que cmd_manifest marque listo el video. La mezcla no se
    ejecuta para otros diseños ni para videos anteriores sin plan declarado.
    """
    project = Path(project).resolve()
    raw = json.loads(within(project, 'assets/config.json').read_text())
    if active_config(raw).get('design') != 'imperio':
        return None
    plan_file = project/'work/music-plan.json'
    if not plan_file.is_file():
        return None
    from src.config.settings import settings
    from src.config.profile_layout import layout_for_settings
    try:
        plan = json.loads(within(project, 'work/music-plan.json').read_text())
        return run_locked(project, plan, layout_for_settings(settings).root, apply=True)
    except Exception as exc:
        raise ValueError('Música de fondo: no se pudo finalizar el plan declarado: ' + str(exc)) from exc


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('project', type=Path)
    parser.add_argument('--plan', type=Path, required=True)
    parser.add_argument('--profile', type=Path, required=True)
    parser.add_argument('--apply', action='store_true', help='Seleccionar el resultado en audio.src después de verificarlo.')
    args = parser.parse_args()
    plan = json.loads(args.plan.read_text())
    print(json.dumps(run_locked(args.project, plan, args.profile, apply=args.apply), ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
