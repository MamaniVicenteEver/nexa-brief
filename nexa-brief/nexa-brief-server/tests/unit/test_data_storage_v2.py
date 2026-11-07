"""Profile-scoped storage, using only generated fixture data."""
from __future__ import annotations

import hashlib

import pytest

from src.adapters.data import local_publication_media
from src.adapters.data.factory import build_data_store
from src.adapters.data.json_store import JsonDataStore
from src.config.profile_layout import resolve_profile_layout
from src.config.settings import settings


@pytest.fixture
def v2(tmp_path, monkeypatch):
    layout = resolve_profile_layout(tmp_path / 'profile', 2)
    monkeypatch.setattr(settings, 'data_dir', layout.data_dir)
    monkeypatch.setattr(settings, 'storage_profile_dir', layout.root)
    monkeypatch.setattr(settings, 'storage_layout_version', 2)
    return layout


@pytest.mark.asyncio
async def test_json_and_media_roots_with_legacy_compatibility(v2, tmp_path):
    legacy = v2.data_dir / 'library/files/music/songs/old.mp3'
    legacy.parent.mkdir(parents=True)
    legacy.write_bytes(b'old')
    source = tmp_path / 'source.mp3'
    source.write_bytes(b'new')
    store = JsonDataStore()
    music = store.files('music')
    assert music.local_path('songs/old.mp3').read_bytes() == b'old'
    new_key = music.save(source, folder='songs', filename='old.mp3')
    assert new_key == 'songs/old (2).mp3'
    assert (v2.resources_dir / 'music' / new_key).read_bytes() == b'new'
    assert music.list_keys('songs') == ['songs/old (2).mp3', 'songs/old.mp3']
    await store.collection('jobs').insert({'job_id': 'j'})
    store.documents('lyrics').put('j', {'text': 'test'})
    assert (v2.data_dir / 'jobs/jobs.json').exists()
    assert (v2.data_dir / 'library/cache/lyrics/j.json').exists()
    assert list((v2.runtime_dir / 'locks').glob('*.lock'))
    assert not list(v2.data_dir.rglob('*.lock'))
    assert not list(v2.data_dir.rglob('*.tmp'))
    assert music.delete('songs/old.mp3')
    assert not legacy.exists()
    assert music.delete(new_key)
    assert not music.delete(new_key)


def test_files_reject_escapes_and_do_not_touch_other_profile(v2, tmp_path):
    other = tmp_path / 'other' / 'library/files/music/songs/old.mp3'
    other.parent.mkdir(parents=True)
    other.write_bytes(b'other')
    music = JsonDataStore().files('music')
    assert not music.local_path('songs/old.mp3').exists()
    assert not music.delete('songs/old.mp3')
    for key in ('../other', '/tmp/other', r'..\\other'):
        with pytest.raises(ValueError):
            music.delete(key)
    root = v2.resources_dir / 'music'
    root.mkdir(parents=True)
    (root / 'link').symlink_to(other.parent, target_is_directory=True)
    with pytest.raises(ValueError):
        music.save(other, folder='link', filename='escape.mp3')
    assert other.read_bytes() == b'other'


def test_publication_media_reads_legacy_and_writes_v2(v2):
    media = local_publication_media.LocalPublicationMedia(v2.data_dir)
    old = v2.data_dir / 'publicaciones/category/old.mp4'
    old.parent.mkdir(parents=True)
    payload = b'0000ftyp' + b'video'
    old.write_bytes(payload)
    digest = hashlib.sha256(payload).hexdigest()
    assert media.get('category/old.mp4').read() == payload
    media.put('category/new.mp4', payload, 'video/mp4', digest)
    assert (v2.productions_dir / '_publicaciones/category/new.mp4').read_bytes() == payload
    with pytest.raises(ValueError):
        media.delete('category/old.mp4', '0' * 64)
    assert old.exists()
    assert media.delete('category/old.mp4', digest)


def test_record_and_media_providers_are_independent(monkeypatch):
    from src.adapters.data.provider_registry import register_provider

    class Files:
        def files(self, name):
            return f'remote:{name}'

    register_provider('files', 'test_separate', Files)
    monkeypatch.setattr(settings, 'data_backend', 'json')
    monkeypatch.setattr(settings, 'media_backend', 'test_separate')
    store = build_data_store()
    assert store.files('music') == 'remote:music'
    assert store.collection('jobs').name == 'jobs'
    monkeypatch.setattr(settings, 'media_backend', 'not_installed')
    with pytest.raises(ValueError, match='files:not_installed'):
        build_data_store()


def test_publication_trace_read_uses_same_profile_fallback(v2):
    media = local_publication_media.LocalPublicationMedia()
    legacy = v2.data_dir / 'publicaciones/cat/2026/01/pub/trace.json'
    legacy.parent.mkdir(parents=True)
    legacy.write_text('{"events": ["legacy"]}', encoding='utf-8')
    assert media.read_trace('cat/2026/01/pub/trace.json') == {'events': ['legacy']}
    current = v2.productions_dir / '_publicaciones/cat/2026/01/pub/trace.json'
    current.parent.mkdir(parents=True)
    current.write_text('{"events": ["current"]}', encoding='utf-8')
    assert media.read_trace('cat/2026/01/pub/trace.json') == {'events': ['current']}


@pytest.mark.asyncio
async def test_queue_coordination_uses_runtime(v2):
    store = JsonDataStore()
    async with store.coordination('queue_claim'):
        assert list((v2.runtime_dir / 'locks').glob('*.lock'))
    assert not list(v2.data_dir.rglob('*.lock'))
    async with store.coordination('content-video-valid_42'):
        assert len(list((v2.runtime_dir / 'locks').glob('*.lock'))) == 2
    for name in ('../escape', 'content-video-../escape', 'content-video-'):
        with pytest.raises(KeyError):
            store.coordination(name)


def test_v2_processes_coordinate_mutations(v2):
    import os
    import subprocess
    import sys

    script = '''
import asyncio, sys
from pathlib import Path
from src.config.settings import settings
from src.adapters.data.json_store import JsonDataStore
root = Path(sys.argv[1])
settings.storage_profile_dir = root
settings.storage_layout_version = 2
settings.data_dir = root / "data"
async def run():
    store = JsonDataStore()
    for _ in range(15):
        async with store.coordination("queue_claim"):
            row = store.collection("queue_entries").first({"entry_id": "counter"})
            if row:
                await store.collection("queue_entries").increment("counter", "count")
            else:
                await store.collection("queue_entries").insert({"entry_id": "counter", "count": 1})
asyncio.run(run())
'''
    env = {**os.environ, 'NEXA_PROFILE_DIR': ''}
    children = [subprocess.Popen([sys.executable, '-c', script, str(v2.root)], env=env,
                                 stdout=subprocess.DEVNULL, stderr=subprocess.PIPE) for _ in range(2)]
    try:
        for child in children:
            _, error = child.communicate(timeout=15)
            assert child.returncode == 0, error.decode()
    finally:
        for child in children:
            if child.poll() is None:
                child.kill()
                child.wait()
    assert JsonDataStore().collection('queue_entries').get('counter')['count'] == 30


def test_service_reads_trace_through_media_port():
    from datetime import datetime, timezone
    from types import SimpleNamespace
    from src.core.image_posts.service import ImagePostService

    class Media:
        def read_trace(self, key):
            assert key == 'cat/2026/01/pub/trace.json'
            return {'events': ['adapter']}

    service = object.__new__(ImagePostService)
    service.media = Media()
    record = SimpleNamespace(editorial=SimpleNamespace(category_id='cat'),
                             created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
                             publication_id='pub')
    assert service.get_trace(record) == {'events': ['adapter']}


def test_profile_storage_roots_reject_symlink_escape(v2, tmp_path):
    outside = tmp_path / 'outside'
    outside.mkdir()
    source = tmp_path / 'source.mp3'
    source.write_bytes(b'synthetic')
    v2.resources_dir.parent.mkdir(parents=True, exist_ok=True)
    v2.resources_dir.symlink_to(outside, target_is_directory=True)
    storage = JsonDataStore().files('music')
    with pytest.raises(ValueError, match='Symlink'):
        storage.save(source, folder='songs', filename='track.mp3')
    assert not (outside / 'music').exists()

    v2.productions_dir.symlink_to(outside, target_is_directory=True)
    media = local_publication_media.LocalPublicationMedia()
    with pytest.raises(ValueError, match='(?i)symlinks'):
        media.get('cat/item.mp4')
    assert not (outside / '_publicaciones').exists()


@pytest.mark.asyncio
async def test_json_collection_rejects_symlink_profile_data(v2, tmp_path):
    outside = tmp_path / 'other-profile-data'
    (outside / 'jobs').mkdir(parents=True)
    (outside / 'jobs/jobs.json').write_text('[{"job_id":"other"}]')
    v2.root.mkdir(parents=True, exist_ok=True)
    v2.data_dir.symlink_to(outside, target_is_directory=True)
    jobs = JsonDataStore().collection('jobs')
    with pytest.raises(ValueError, match='Symlinks'):
        jobs.list()
    with pytest.raises(ValueError, match='Symlinks'):
        await jobs.insert({'job_id': 'not-written'})
    assert (outside / 'jobs/jobs.json').read_text() == '[{"job_id":"other"}]'


@pytest.mark.asyncio
async def test_cached_store_uses_selected_profile_even_with_stale_settings(v2, tmp_path, monkeypatch):
    store = JsonDataStore()
    await store.collection('jobs').insert({'job_id': 'first'})
    store.documents('draft_jobs').put('first', {'job_id': 'first'})
    second = tmp_path / 'second-profile'
    monkeypatch.setattr(settings, 'storage_profile_dir', second)
    assert store.collection('jobs').list() == []
    assert store.documents('draft_jobs').get('first') is None
    await store.collection('jobs').insert({'job_id': 'second'})
    assert (second / 'data/jobs/jobs.json').is_file()
    assert 'second' not in (v2.data_dir / 'jobs/jobs.json').read_text()


@pytest.mark.asyncio
async def test_v2_channel_metadata_belongs_in_data(v2, tmp_path, monkeypatch):
    monkeypatch.setattr(settings, 'shared_connections_dir', tmp_path / 'other-connections')
    await JsonDataStore().collection('channels').insert({'platform': 'youtube', 'alias': 'synthetic'})
    assert (v2.data_dir / 'canales/channels.json').is_file()
    assert not (tmp_path / 'other-connections').exists()
