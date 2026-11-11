import json
from pathlib import Path

from src.adapters.showcase.preview_availability import _character_details, availability


def fixture(tmp_path):
    root = tmp_path / 'nodeactualidad/cara-a-cara'
    (root / 'showcase/thumbs').mkdir(parents=True)
    (root / 'assets').mkdir()
    (root / 'showcase/components.json').write_text('{"components": []}')
    (root / 'showcase/thumbs/alma.talk.jpg').write_bytes(b'image')
    (root / 'assets/sample.mp3').write_bytes(b'audio')
    identity = {'id': 'alma', 'nombre': 'Alma', 'tema': 'Actualidad',
                'voz': {'nombre': 'Sulafat', 'muestra': 'assets/sample.mp3', 'texto': 'Un hecho.'}}
    (root / 'assets/identity.json').write_text(json.dumps(identity))
    sprite = {'name': 'Alma', 'characterFile': 'assets/identity.json',
              'poses': [{'name': 'talk', 'file': 'alma.talk.jpg'}]}
    (root / 'showcase/characters.json').write_text(json.dumps({'sprites': [sprite]}))
    return root, identity, sprite


def test_details_include_identity_audio_text_and_static_poses(tmp_path):
    fixture(tmp_path)
    details = _character_details(tmp_path)['Alma']
    assert details['identity']['voz']['nombre'] == 'Sulafat'
    assert details['voiceSample']['url'].endswith('/bundled/nodeactualidad/cara-a-cara/assets/sample.mp3')
    assert details['voiceSample']['text'] == 'Un hecho.'
    assert details['poses'][0]['url'].endswith('/showcase/thumbs/alma.talk.jpg')
    result = availability(tmp_path, tmp_path / 'profile', 'cara-a-cara',
                          [{'name': 'Alma', 'data': {'native_name': 'Alma'}}])
    assert result[0]['data']['native_name'] == 'Alma'
    assert result[0]['data']['character'] == details


def test_unsafe_or_missing_samples_and_poses_are_not_exposed(tmp_path):
    root, identity, sprite = fixture(tmp_path)
    identity['voz']['muestra'] = '../private.mp3'
    identity['voz']['subtitulos'] = 'https://example.com/private.vtt'
    sprite['poses'].append({'name': 'bad', 'file': '../../private.jpg'})
    (root / 'assets/identity.json').write_text(json.dumps(identity))
    (root / 'showcase/characters.json').write_text(json.dumps({'sprites': [sprite]}))
    details = _character_details(tmp_path)['Alma']
    assert 'voiceSample' not in details
    assert len(details['poses']) == 1
    (root / 'assets/identity.json').unlink()
    (root / 'assets/identity.json').symlink_to(tmp_path / 'outside.json')
    assert _character_details(tmp_path) == {}
