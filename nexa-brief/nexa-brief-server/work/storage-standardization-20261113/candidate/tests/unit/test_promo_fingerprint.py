"""La aprobación queda ligada a bytes de medios, audio y miniaturas."""
import os
from types import SimpleNamespace
import pytest
from src.core.promos import readiness


@pytest.fixture
def scene(tmp_path, monkeypatch):
    import src.core
    output = tmp_path/'output'; content = output/'content'
    (content/'assets').mkdir(parents=True); (content/'thumbnails').mkdir()
    for file in ('index.html', 'config.json', 'lyrics.json'):
        (content/file).write_text('content')
    for file in ('assets/sport.mp4', 'assets/music.mp3', 'thumbnails/x-A.jpg', 'thumbnails/x-B.jpg'):
        (content/file).write_bytes(b'original')
    fake = SimpleNamespace(load_job=lambda _: SimpleNamespace(artifacts=SimpleNamespace(output_dir=output,content_dir=content)))
    monkeypatch.setattr(src.core, 'drafts', fake, raising=False)
    return content, {'draft_id':'a', 'template_id':'promo-sports'}


@pytest.mark.parametrize('file',['assets/sport.mp4', 'assets/music.mp3','thumbnails/x-A.jpg','thumbnails/x-B.jpg'])
def test_mutating_media_changes_fingerprint_without_changing_draft(scene,file):
    content, draft = scene
    before = readiness.snapshot_fingerprint(draft)
    path = content/file
    old = path.stat()
    path.write_bytes(b'changed!')  # mismo tamaño
    os.utime(path, ns=(old.st_atime_ns,old.st_mtime_ns))
    assert readiness.snapshot_fingerprint(draft) != before


def test_reject_external_media_link(scene, tmp_path):
    content, draft = scene
    outside = tmp_path/'outside.mp3'; outside.write_bytes(b'private')
    (content/'assets'/'escape.mp3').symlink_to(outside)
    with pytest.raises(ValueError): readiness.snapshot_fingerprint(draft)


def test_output_root_audio_is_included(scene):
    content, draft = scene
    audio = content.parent/'song.mp3'; audio.write_bytes(b'first')
    before = readiness.snapshot_fingerprint(draft)
    audio.write_bytes(b'other')
    assert readiness.snapshot_fingerprint(draft) != before


def test_unchanged_files_are_cached(scene, monkeypatch):
    content, draft = scene
    readiness._HASH_CACHE.clear()
    readiness.snapshot_fingerprint(draft)
    def unexpected_open(*args, **kwargs): raise AssertionError('relectura evitable')
    monkeypatch.setattr(type(content), 'open', unexpected_open)
    readiness.snapshot_fingerprint(draft)


@pytest.mark.parametrize('file',['assets/sport.mp4','assets/music.mp3','thumbnails/x-A.jpg'])
def test_recording_approval_revoked_when_asset_changes(scene, file, monkeypatch):
    import sys
    from types import ModuleType
    content, raw = scene
    class Draft:
        template_id='promo-sports'
        draft_id='a'
        def model_dump(self, mode): return raw
    row = {'draft_id':'a','state':'ready','approved_revision':1,'revision':1,
           'quality':{'passed':True},'reviewed_fingerprint':readiness.snapshot_fingerprint(raw)}
    data = ModuleType('src.core.data')
    data.collection = lambda name: SimpleNamespace(list=lambda **kwargs:[row])
    monkeypatch.setitem(sys.modules, 'src.core.data', data)
    assert readiness.approved_for_recording(Draft())
    (content/file).write_bytes(b'replaced')
    assert not readiness.approved_for_recording(Draft())
