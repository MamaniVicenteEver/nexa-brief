import importlib.util
import json
import sys
from pathlib import Path

import pytest

TOOLS=Path(__file__).resolve().parents[2]/'src/templates/_tools/nodemotion-promo'
sys.path.insert(0,str(TOOLS))
spec=importlib.util.spec_from_file_location('bootstrap_media',TOOLS/'media.py')
media=importlib.util.module_from_spec(spec)
spec.loader.exec_module(media)


def test_script_duration_bootstraps_without_timed_lyrics(tmp_path):
    (tmp_path/'work').mkdir()
    (tmp_path/'work/guion.json').write_text(json.dumps({'duration_seconds':64}))
    assert media.read_duration(tmp_path)==64
    assert not (tmp_path/'assets/lyrics.json').exists()


def test_legacy_timed_lyrics_still_provide_duration(tmp_path):
    (tmp_path/'assets').mkdir()
    (tmp_path/'assets/lyrics.json').write_text(json.dumps({'segments':[{'end':90}]}))
    assert media.read_duration(tmp_path)==90


def test_link_music_is_idempotent_and_preserves_other_audio(tmp_path):
    folder=tmp_path/'resources/music/original'
    folder.mkdir(parents=True)
    cut=folder/'cut-64.mp3'; cut.write_bytes(b'cut')
    original=folder/'original.mp3'; original.write_bytes(b'original')
    target=tmp_path/'sandbox/new'; target.mkdir(parents=True)
    (target/'music.json').write_text(json.dumps({'asset_id':'original','ready_file':cut.name}))
    media.link_music(tmp_path,target)
    media.link_music(tmp_path,target)
    assert (target/'assets/song.mp3').resolve()==cut
    assert original.read_bytes()==b'original'
    (target/'assets/song.mp3').unlink()
    (target/'assets/song.mp3').write_bytes(b'other')
    with pytest.raises(ValueError,match='no se reemplaza'):
        media.link_music(tmp_path,target)
    assert (target/'assets/song.mp3').read_bytes()==b'other'
