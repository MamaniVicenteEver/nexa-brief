import importlib.util
import json
import sys
from pathlib import Path

import pytest

TOOLS=Path(__file__).resolve().parents[2]/'src/templates/_tools/nodemotion/promo/tools'
sys.path.insert(0,str(TOOLS))
spec=importlib.util.spec_from_file_location('bootstrap_media',TOOLS/'media.py')
media=importlib.util.module_from_spec(spec)
spec.loader.exec_module(media)


def test_script_duration_bootstraps_without_timed_lyrics(tmp_path):
    (tmp_path/'work').mkdir()
    (tmp_path/'work/script.json').write_text(json.dumps({'duration_seconds':64}))
    assert media.read_duration(tmp_path)==64
    assert not (tmp_path/'assets/lyrics.json').exists()


def test_legacy_timed_lyrics_still_provide_duration(tmp_path):
    (tmp_path/'assets').mkdir()
    (tmp_path/'assets/lyrics.json').write_text(json.dumps({'segments':[{'end':90}]}))
    assert media.read_duration(tmp_path)==90


def test_link_music_is_idempotent_and_preserves_other_audio(tmp_path, monkeypatch):
    folder=tmp_path/'resources/music/original'
    folder.mkdir(parents=True)
    cut=folder/'cut-64.mp3'; cut.write_bytes(b'cut')
    original=folder/'original.mp3'; original.write_bytes(b'original')
    from src.config.settings import settings
    from src.core.nodemotion.shared import resources
    from src.core.nodemotion.promo.workspace import audio
    monkeypatch.setattr(settings, 'storage_profile_dir', tmp_path)
    monkeypatch.setattr(settings, 'storage_layout_version', 3)
    monkeypatch.setattr(resources, '_asset', lambda kind, ident: original)
    target=tmp_path/'sandbox/new'; target.mkdir(parents=True)
    (target/'music.json').write_text(json.dumps({'asset_id':'original','ready_file':cut.name}))
    (target/'music.json.tmp').symlink_to(original)
    media.link_music(tmp_path,target)
    media.link_music(tmp_path,target)
    assert audio(target)==cut
    assert not (target/'assets/song.mp3').exists()
    assert read_ref(target)['variant_file'] == cut.name
    assert original.read_bytes()==b'original'
    (target/'assets').mkdir()
    (target/'assets/song.mp3').write_bytes(b'other')
    with pytest.raises(ValueError,match='no se reemplaza'):
        media.link_music(tmp_path,target)
    assert (target/'assets/song.mp3').read_bytes()==b'other'


def read_ref(target):
    return json.loads((target / 'music.json').read_bytes())['resource_ref']


def test_link_music_does_not_overwrite_concurrent_editorial_changes(tmp_path, monkeypatch):
    from src.config.settings import settings
    from src.core.nodemotion.shared import resources
    folder=tmp_path/'resources/music/source'
    folder.mkdir(parents=True)
    original=folder/'original.mp3'
    original.write_bytes(b'original')
    (folder/'cut.mp3').write_bytes(b'cut')
    target=tmp_path/'campaign'
    target.mkdir()
    metadata=target/'music.json'
    metadata.write_text(json.dumps({'asset_id':'source','ready_file':'cut.mp3'}))
    monkeypatch.setattr(settings,'storage_profile_dir',tmp_path)
    monkeypatch.setattr(settings,'storage_layout_version',3)
    monkeypatch.setattr(resources,'_asset',lambda kind,ident: original)
    create_temp=media.tempfile.mkstemp
    changed=b'{"editorial":"concurrent edit"}'
    def concurrent(*args,**kwargs):
        metadata.write_bytes(changed)
        return create_temp(*args,**kwargs)
    monkeypatch.setattr(media.tempfile,'mkstemp',concurrent)
    with pytest.raises(ValueError,match='cambió'):
        media.link_music(tmp_path,target)
    assert metadata.read_bytes()==changed
    assert not list(target.glob('.music-reference-*'))
