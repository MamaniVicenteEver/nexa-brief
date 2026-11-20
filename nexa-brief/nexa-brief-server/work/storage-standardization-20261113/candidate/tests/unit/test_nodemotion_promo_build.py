"""Construcción de una promo: escena, recurso y duración sin datos de perfil real."""
import importlib.util
import json
from pathlib import Path
from types import SimpleNamespace

import pytest

SERVER = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location('promo_build', SERVER / 'src/templates/_tools/nodemotion-promo/build.py')
module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)
CONTRACT = json.loads((SERVER / 'src/skills/nodemotion/promo/templates/promo-editorial.json').read_text())


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value))


def read(path):
    return json.loads(path.read_text())


@pytest.fixture
def sample(tmp_path, monkeypatch):
    root = tmp_path / 'profile'
    target = root / 'sandbox/nodemotion/test'
    write(target / 'brief.json', {'template': 'promo-editorial', 'duration_seconds': 90, 'texts': {'brand.name': 'Equipo', 'brand.round': 'Historia', 'brand.left': 'Pasión', 'brand.right': 'Olvido', 'brand.tagline': 'Legado'}})
    scenes = CONTRACT['default_scenes']
    segments = [{'id': i + 1, 'start': i * 90 / len(scenes), 'end': (i + 1) * 90 / len(scenes), 'text': 'TEXTO', 'lines': ['TEXTO']} for i in range(len(scenes))]
    write(target / 'assets/lyrics.json', {'metadata': {'kind': 'guion', 'audio_duration_sec': 90}, 'segments': segments})
    expected = {x['id']: x['type'] for x in CONTRACT['default_media']}
    items = [{'scene': i + 1, 'slot': slot, 'kind': expected[slot], 'asset_id': expected[slot], 'query': 'q'} for i, scene in enumerate(scenes) for slot in scene.get('media', [])]
    write(target / 'media-plan.json', {'items': items})
    for kind, folder, ext in [('video', 'videos', '.mp4'), ('image', 'images', '.jpg')]:
        dest = root / 'resources' / folder / kind
        dest.mkdir(parents=True)
        (dest / ('ready' + ext)).write_bytes(b'fixture')
        write(dest / 'resource.json', {'id': kind, 'type': kind, 'attribution': 'Autor', 'license': 'License', 'license_url': 'https://example.org', 'file': 'original' + ext, 'ready_file': 'ready' + ext})
    music = root / 'resources/music/song'
    music.mkdir(parents=True)
    (music / 'ready.mp3').write_bytes(b'fixture')
    write(music / 'resource.json', {'id': 'song', 'type': 'music', 'attribution': 'Autor', 'license': 'CC BY', 'license_url': 'https://example.org'})
    write(target / 'music.json', {'asset_id': 'song', 'ready_file': 'ready.mp3', 'duration_seconds': 90})
    monkeypatch.setattr(module.subprocess, 'run', lambda *a, **k: SimpleNamespace(stdout='90.02'))
    return root, target


def run(sample):
    root, target = sample
    return module.build(root, target, read, write, lambda *_: None)


def test_build_reuses_assets_and_covers_all_scenes(sample):
    root, target = sample
    assert run(sample)['duration_seconds'] == 90
    config = read(target / 'assets/config.json')['configs'][0]
    assert config['audio']['src'] == 'song.mp3'
    assert config['lyricsUrl'] == 'lyrics.json'
    assert config['scenes'] == CONTRACT['default_scenes']
    assert len(config['media']) == 7
    assert all((target / 'assets' / x['src']).is_file() for x in config['media'])
    assert (target / 'assets/song.mp3').resolve() == root / 'resources/music/song/ready.mp3'
    assert run(sample)['duration_seconds'] == 90


def test_build_rejects_gap_and_does_not_write_config(sample):
    _, target = sample
    lyrics = read(target / 'assets/lyrics.json')
    lyrics['segments'][1]['start'] += 1
    write(target / 'assets/lyrics.json', lyrics)
    with pytest.raises(ValueError, match='consecutivos'):
        run(sample)
    assert not (target / 'assets/config.json').exists()


def test_build_rejects_missing_scene_resource(sample):
    _, target = sample
    plan = read(target / 'media-plan.json')
    plan['items'].pop()
    write(target / 'media-plan.json', plan)
    with pytest.raises(ValueError, match='exactamente'):
        run(sample)


def test_build_rejects_wrong_audio_duration(sample, monkeypatch):
    monkeypatch.setattr(module.subprocess, 'run', lambda *a, **k: SimpleNamespace(stdout='212'))
    with pytest.raises(ValueError, match='audio dura'):
        run(sample)


def test_build_writes_lyrics_from_script(sample):
    _, target = sample
    script = read(target / 'assets/lyrics.json')
    script['segments'][0]['text'] = 'TEXTO NUEVO'
    script['segments'][0]['lines'] = ['TEXTO NUEVO']
    write(target / 'work/guion.json', script)
    run(sample)
    assert read(target / 'assets/lyrics.json')['segments'][0]['text'] == 'TEXTO NUEVO'


def test_build_rejects_brief_duration_mismatch(sample):
    _, target = sample
    brief = read(target / 'brief.json')
    brief['duration_seconds'] = 100
    write(target / 'brief.json', brief)
    with pytest.raises(ValueError, match='brief y el guion'):
        run(sample)


def test_build_rejects_uncredited_music(sample):
    root, _ = sample
    path = root / 'resources/music/song/resource.json'
    metadata = read(path)
    metadata['attribution'] = ''
    write(path, metadata)
    with pytest.raises(ValueError, match='música incompleta'):
        run(sample)


def test_build_sports_uses_its_own_scenes_and_registered_media(sample):
    _, target = sample
    contract = read(SERVER / 'src/skills/nodemotion/promo/templates/promo-sports.json')
    brief = read(target / 'brief.json')
    brief.update(template='promo-sports', texts={})
    write(target / 'brief.json', brief)
    scenes = contract['default_scenes']
    segments = [{'id': i + 1, 'start': i * 90 / len(scenes), 'end': (i + 1) * 90 / len(scenes), 'text': 'TEXTO', 'lines': ['TEXTO']} for i in range(len(scenes))]
    write(target / 'assets/lyrics.json', {'metadata': {'kind': 'guion', 'audio_duration_sec': 90}, 'segments': segments})
    expected = {x['id']: x['type'] for x in contract['default_media']}
    write(target / 'media-plan.json', {'items': [{'scene': i + 1, 'slot': slot, 'kind': expected[slot], 'asset_id': expected[slot], 'query': 'q'} for i, scene in enumerate(scenes) for slot in scene.get('media', [])]})
    run(sample)
    config = read(target / 'assets/config.json')['configs'][0]
    assert config['scenes'] == scenes
    assert {item['id'] for item in config['media']} == {slot for scene in scenes for slot in scene.get('media', [])}
    assert all((target / 'assets' / item['src']).is_file() for item in config['media'])
    run(sample)


def test_scene_override_requires_assigned_media_and_uses_registered_slot(sample):
    _, target = sample
    write(target / 'scene-overrides.json', {'11': {'type':'mediaWord','media':['team-win-2']}})
    with pytest.raises(ValueError,match='exactamente'):
        run(sample)
    plan=read(target/'media-plan.json')
    plan['items'].append({'scene':11,'slot':'team-win-2','kind':'image','asset_id':'image','query':'q'})
    write(target/'media-plan.json',plan)
    run(sample)
    config=read(target/'assets/config.json')['configs'][0]
    assert config['scenes'][10]['media']==['team-win-2']
    assert next(x for x in config['media'] if x['id']=='team-win-2')['type']=='image'


def test_scene_override_rejects_unknown_type(sample):
    _, target = sample
    write(target/'scene-overrides.json',{'11':{'type':'unknown'}})
    with pytest.raises(ValueError,match='tipo de escena desconocido'):
        run(sample)


def test_build_supports_existing_media_word_dark_parameter(sample):
    _, target = sample
    write(target/'scene-overrides.json', {'2': {'type': 'mediaWord', 'media': ['trophy'], 'cover': False, 'dark': True}})
    run(sample)
    assert read(target/'assets/config.json')['configs'][0]['scenes'][1]['dark'] is True


def test_build_rejects_non_boolean_dark_parameter(sample):
    _, target = sample
    write(target/'scene-overrides.json', {'2': {'type': 'mediaWord', 'media': ['trophy'], 'dark': 'false'}})
    with pytest.raises(ValueError, match='booleano'):
        run(sample)
