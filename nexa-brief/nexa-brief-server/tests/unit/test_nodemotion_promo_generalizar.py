"""Contratos y construcción de todas las promos con recursos de prueba aislados."""
import importlib.util
import json
from pathlib import Path
from types import SimpleNamespace

import pytest
from jsonschema import Draft202012Validator
from jsonschema.exceptions import ValidationError

SERVER = Path(__file__).resolve().parents[2]
SKILL = SERVER / 'src/skills/nodemotion/promo'
SPEC = importlib.util.spec_from_file_location('promo_general_build', SERVER / 'src/templates/_tools/nodemotion-promo/build.py')
builder = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(builder)


def read(path):
    return json.loads(path.read_text())


def write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False))


def validate(name, data):
    Draft202012Validator(read(SKILL / 'schemas' / (name + '.json'))).validate(data)


@pytest.mark.parametrize('name', ['editorial', 'sports', 'dynamic', 'kinetic', 'trendy', 'urban'])
def test_build_and_contract(name, tmp_path, monkeypatch):
    contract = read(SKILL / 'templates' / f'promo-{name}.json')
    schema = read(SKILL / 'schemas' / f'build-{name}.json')
    required = schema['properties']['texts'].get('required', [])
    texts = {key: 'TEMA' for key in required}
    brief = {'template': f'promo-{name}', 'topic': 'Tema', 'name': 'Tema', 'duration_seconds': 90,
             'tone': 'intenso', 'language': 'es', 'audience': 'público', 'texts': texts}
    target = tmp_path / 'project'
    write(target / 'brief.json', brief)
    scenes = contract['default_scenes']
    assert len(contract['scene_cycle']) == len(scenes)
    for actual, scene in zip(contract['scene_cycle'], scenes):
        assert actual['type'] == scene['type']
        assert [m['slot'] for m in actual['media']] == scene.get('media', [])
        assert actual['max_characters_per_line_recommended'] > 0
    segments = [{'id': i + 1, 'start': i * 90 / len(scenes), 'end': (i + 1) * 90 / len(scenes),
                 'text': 'TEMA', 'lines': ['TEMA']} for i in range(len(scenes))]
    write(target / 'assets/lyrics.json', {'metadata': {'kind': 'guion', 'audio_duration_sec': 90}, 'segments': segments})
    kinds = {m['id']: m['type'] for m in contract['default_media']}
    items = [{'scene': i + 1, 'slot': slot, 'kind': kinds[slot], 'query': 'tema', 'asset_id': slot}
             for i, scene in enumerate(scenes) for slot in scene.get('media', [])]
    write(target / 'media-plan.json', {'items': items})
    for slot in {item['slot'] for item in items}:
        kind = kinds[slot]
        folder = tmp_path / 'resources' / ('videos' if kind == 'video' else 'images') / slot
        folder.mkdir(parents=True)
        (folder / 'fixture.dat').write_bytes(b'fixture')
        write(folder / 'resource.json', {'id': slot, 'type': kind, 'file': 'fixture.dat', 'attribution': 'autor', 'license': 'CC0', 'license_url': 'https://example.org'})
    music = tmp_path / 'resources/music/music'
    music.mkdir(parents=True)
    (music / 'audio.mp3').write_bytes(b'fixture')
    write(music / 'resource.json', {'id': 'music', 'type': 'music', 'attribution': 'autor', 'license': 'CC0', 'license_url': 'https://example.org'})
    write(target / 'music.json', {'asset_id': 'music', 'ready_file': 'audio.mp3', 'duration_seconds': 90})
    commands = []
    def run_process(args, **kwargs):
        commands.append(args)
        if args[0] == 'ffmpeg':
            Path(args[-1]).write_bytes(b'poster')
        return SimpleNamespace(stdout='90')
    monkeypatch.setattr(builder.subprocess, 'run', run_process)
    builder.build(tmp_path, target, read, write, validate)
    config = read(target / 'assets/config.json')['configs'][0]
    assert config['scenes'] == scenes
    assert [m['id'] for m in config['media']] == [m['id'] for m in contract['default_media'] if m['id'] in {x['slot'] for x in items}]
    for ref in config['media']:
        if ref['type'] == 'video':
            assert (target / 'assets' / ref['poster']).read_bytes() == b'poster'
    for key, value in texts.items():
        assert config['brand'][key.removeprefix('brand.')] == value
    builder.build(tmp_path, target, read, write, validate)
    assert len([c for c in commands if c[0] == 'ffmpeg']) == len({item['asset_id'] for item in items if item['kind'] == 'video'})
    if name == 'dynamic':
        scene = dict(scenes[0], flyer='')
        write(target / 'scene-overrides.json', {'1': scene})
        builder.build(tmp_path, target, read, write, validate)
        assert read(target / 'assets/config.json')['configs'][0]['scenes'][0]['flyer'] == ''
    if name == 'editorial':
        brief['texts']['brand.left'] = ''
        brief['texts']['brand.right'] = ''
        write(target / 'brief.json', brief)
        with pytest.raises(ValueError, match='versus necesita'):
            builder.build(tmp_path, target, read, write, validate)
        write(target / 'scene-overrides.json', {'12': {'type': 'assemble'}})
        write(target / 'media-plan.json', {'items': [item for item in items if item['scene'] != 12]})
        builder.build(tmp_path, target, read, write, validate)
        assert read(target / 'assets/config.json')['configs'][0]['brand']['left'] == ''
    if required:
        bad = dict(brief, texts={})
        with pytest.raises(ValidationError):
            validate('build-' + name, bad)
    with pytest.raises(ValidationError):
        validate('build-' + name, dict(brief, texts={**texts, 'brand.extra': 'x'}))


def test_draft_inputs_preserve_positions_when_cycle_skips_slots(tmp_path, monkeypatch):
    spec = importlib.util.spec_from_file_location('promo_general_draft', SERVER / 'src/templates/_tools/nodemotion-promo/draft_workflow.py')
    workflow = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(workflow)
    target = tmp_path / 'project'
    write(target / 'brief.json', {'template': 'promo-dynamic', 'name': 'Tema', 'topic': 'Tema', 'tone': 'intenso', 'language': 'es', 'texts': {}})
    contract = read(SKILL / 'templates/promo-dynamic.json')
    used = [entry['id'] for entry in contract['default_media'] if entry['type'] == 'image']
    missing = used[2]
    write(target / 'media-plan.json', {'items': [{'slot': slot, 'asset_id': 'id-' + slot} for slot in used if slot != missing]})
    lyrics = {'segments': [{'text': 'Tema'}]}
    write(target / 'assets/lyrics.json', lyrics)
    async def music(*args):
        return 'music'
    calls = []
    def api(_target, method, path, payload=None):
        if path.endswith('/lyrics'):
            return lyrics
        if method == 'POST':
            calls.append(payload)
            return {'draft_id': 'fixture'}
        return {}
    monkeypatch.setattr(workflow, 'derived_music', music)
    monkeypatch.setattr(workflow, 'call', api)
    monkeypatch.setattr(workflow, 'wait_for', lambda *args: {'status': 'preview_ready'})
    workflow.create(tmp_path, target, 'demo', read, write)
    photos = calls[0]['template_inputs']['media']['photos']
    assert len(photos) == len(used)
    assert photos[2] == 'id-' + used[0]
    assert photos[3] == 'id-' + used[3]
