from __future__ import annotations

import asyncio
import json
import multiprocessing
from pathlib import Path

import pytest

from src.adapters.data.import_legacy_sections import import_legacy_data
from src.adapters.data.json_store import JsonDataStore
from src.config.settings import settings


@pytest.fixture
def profile(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, 'storage_profile_dir', tmp_path)
    monkeypatch.setattr(settings, 'storage_layout_version', 3)
    monkeypatch.setattr(settings, 'data_dir', tmp_path / 'wrong-legacy-data')
    return tmp_path


def _increment_process(root: str, rounds: int):
    settings.storage_profile_dir = Path(root)
    settings.storage_layout_version = 3
    store = JsonDataStore()
    async def run():
        for _ in range(rounds):
            await store.collection('jobs').increment('job', 'count')
    asyncio.run(run())


@pytest.mark.asyncio
async def test_sections_crud_cas_and_profile_switch(profile, monkeypatch):
    store = JsonDataStore()
    videos = store.collection('content_videos')
    details = store.documents('content_video_details')
    await videos.insert({'video_id': 'one', 'revision': 1})
    with pytest.raises(ValueError, match='duplicate'):
        await videos.insert({'video_id': 'one', 'revision': 1})
    details.put('one', {'title': 'Synthetic'})
    assert await videos.update('one', {'revision': 2}, only_if={'revision': 1})
    assert await videos.update('one', {'revision': 3}, only_if={'revision': 1}) is None
    section = json.loads((profile / 'data/json/videos.json').read_text())
    assert section['revision'] == 3
    assert details.get('one') == {'title': 'Synthetic'}
    assert section['collections']['content_videos'][0]['revision'] == 2
    assert not (profile / 'wrong-legacy-data').exists()
    other = profile / 'other'
    monkeypatch.setattr(settings, 'storage_profile_dir', other)
    assert videos.get('one') is None
    await videos.insert({'video_id': 'other'})
    monkeypatch.setattr(settings, 'storage_profile_dir', profile)
    assert videos.get('one')['revision'] == 2
    assert videos.get('other') is None
    assert details.delete('one')
    assert await videos.delete('one')


@pytest.mark.asyncio
async def test_section_shared_lock_across_processes(profile):
    jobs = JsonDataStore().collection('jobs')
    await jobs.insert({'job_id': 'job', 'count': 0})
    ctx = multiprocessing.get_context('fork')
    workers = [ctx.Process(target=_increment_process, args=(str(profile), 15)) for _ in range(3)]
    for worker in workers:
        worker.start()
    for worker in workers:
        worker.join(30)
        assert worker.exitcode == 0
    assert jobs.get('job')['count'] == 45
    assert json.loads((profile / 'data/json/jobs.json').read_text())['revision'] == 46


def test_corrupt_section_fails_closed(profile):
    path = profile / 'data/json/videos.json'
    path.parent.mkdir(parents=True)
    path.write_text('{invalid')
    with pytest.raises(RuntimeError):
        JsonDataStore().collection('content_videos').list()


def test_import_legacy_known_namespaces_and_reject_overwrite(tmp_path):
    source = tmp_path / 'staging/data'
    for rel, payload in {
        'library/images.json': [{'asset_id': 'asset'}],
        'content/videos.json': [{'video_id': 'video'}],
        'content/video_details/video.json': {'title': 'Synthetic'},
        'logs/index.json': [{'log_id': 'log'}],
        'canales/channels.json': [{'platform': 'synthetic', 'alias': 'demo'}],
    }.items():
        path = source / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload))
    counts = import_legacy_data(source, source)
    assert counts['image_assets'] == 1 and counts['execution_logs'] == 1
    assert json.loads((source / 'json/resources.json').read_text())['collections']['image_assets'][0]['asset_id'] == 'asset'
    assert json.loads((source / 'json/videos.json').read_text())['documents']['content_video_details']['video']['title'] == 'Synthetic'
    assert (source / 'library/images.json').exists()
    assert (source / 'json/image-posts.json').exists()
    with pytest.raises(FileExistsError):
        import_legacy_data(source, source)


def test_import_rejects_symlink_and_unknown_receipt(tmp_path):
    source = tmp_path / 'staging/data'
    source.mkdir(parents=True)
    (source / 'library').symlink_to(tmp_path, target_is_directory=True)
    with pytest.raises(ValueError, match='Symlinks'):
        import_legacy_data(source, source)
    assert not (source / 'json').exists()


def test_import_rejects_unknown_legacy_receipt(tmp_path):
    source = tmp_path / 'staging/data'
    ledger = source / 'publicaciones/idempotency.json'
    ledger.parent.mkdir(parents=True)
    ledger.write_text(json.dumps({'request:one': {'body_hash': 'hash', 'result': {'unexpected': 1}}}))
    with pytest.raises(ValueError, match='Unknown publication receipt'):
        import_legacy_data(source, source)
    assert not (source / 'json').exists()


def test_orientation_probe_uses_dimensions_and_reports_unknown(tmp_path, monkeypatch):
    from types import SimpleNamespace
    from scripts import profile_v3_migration as migration
    monkeypatch.setattr(migration.shutil, 'which', lambda _: '/usr/bin/ffprobe')
    monkeypatch.setattr(migration.subprocess, 'run', lambda *args, **kwargs: SimpleNamespace(
        stdout='{"streams":[{"width":1080,"height":1920}]}'))
    assert migration._orientation(tmp_path / 'video.mp4') == '9x16'
    monkeypatch.setattr(migration.subprocess, 'run', lambda *args, **kwargs: SimpleNamespace(
        stdout='{"streams":[]}'))
    assert migration._orientation(tmp_path / 'video.mp4') == 'unknown'


def test_v3_output_group_uses_job_id_when_video_id_absent(tmp_path, monkeypatch):
    from scripts.profile_v3_migration import transform_staging
    root = tmp_path / 'profile'
    tx = root / '.system/migrations/example'
    data = tx / 'staged/data'
    jobs = data / 'jobs/jobs.json'
    jobs.parent.mkdir(parents=True)
    jobs.write_text(json.dumps([{'job_id': 'motion-42', 'category_path': 'node_tech',
                                'file_paths': {'landscape': str(root / 'renders/clip/final.mp4')}}]))
    for filename in ('final.mp4', 'vertical_video.mp4'):
        path = root / 'output/clip' / filename
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(b'synthetic')
    monkeypatch.setattr('scripts.profile_v3_migration._orientation', lambda _: 'unknown')
    result = transform_staging(root, tx, {'mapping': {}})
    destinations = [Path(row['destination']) for row in result['output_moves']]
    assert {path.parts[3] for path in destinations} == {'motion-42'}
    assert {path.parts[2] for path in destinations} == {'nodetech'}


def test_v3_migration_library_shared_asset_alias_and_unindexed_file(tmp_path, monkeypatch):
    import hashlib
    import shutil
    from src.adapters.data.local_file_storage import LocalFileStorage
    from scripts.profile_v3_migration import transform_staging
    root = tmp_path / 'profile'
    tx = root / '.system/migrations/example'
    data = tx / 'staged/data'
    library = data / 'library/images.json'
    library.parent.mkdir(parents=True)
    library.write_text(json.dumps([
        {'asset_id': 'asset-z', 'relative_path': 'category/image.png', 'category': 'category'},
        {'asset_id': 'asset-a', 'relative_path': 'category/image.png', 'category': 'category'},
    ]))
    source1 = root / 'data/library/files/images/category/image.png'
    source2 = root / 'data/library/files/images/category/orphan.png'
    source1.parent.mkdir(parents=True)
    source1.write_bytes(b'synthetic-shared-image')
    source2.write_bytes(b'synthetic-orphan-image')
    mapping = {f'data/library/files/images/category/{name}': f'resources/images/category/{name}'
               for name in ('image.png', 'orphan.png')}
    monkeypatch.setattr('scripts.profile_v3_migration._orientation', lambda _: 'unknown')
    result = transform_staging(root, tx, {'mapping': mapping})
    dest = result['mapping']['data/library/files/images/category/image.png']
    assert dest == 'resources/images/asset-a/image.png'
    assert result['mapping']['data/library/files/images/category/orphan.png'].startswith('resources/images/legacy-')
    data_json = json.loads((data / 'json/resources.json').read_text())
    rows = data_json['collections']['image_assets']
    assert {row['relative_path'] for row in rows} == {'category/image.png'}
    old = 'resources/images/category/image.png'
    alias = data_json['documents']['media_aliases'][hashlib.sha256(old.encode()).hexdigest()]
    assert alias == {'legacy_key': old, 'storage_key': dest, 'sha256': hashlib.sha256(b'synthetic-shared-image').hexdigest()}
    assert result['v3_transform']['library_files'] == 2
    assert source1.read_bytes() == b'synthetic-shared-image' and source2.exists()
    shutil.copytree(data / 'json', root / 'data/json')
    migrated_file = root / dest
    migrated_file.parent.mkdir(parents=True)
    shutil.copyfile(source1, migrated_file)
    monkeypatch.setattr(settings, 'storage_profile_dir', root)
    monkeypatch.setattr(settings, 'storage_layout_version', 3)
    monkeypatch.setattr('src.core.data._store', JsonDataStore())
    storage = LocalFileStorage('images', 'library/files/images')
    assert storage.local_path('category/image.png') == migrated_file
    assert storage.local_path('category/image.png').read_bytes() == b'synthetic-shared-image'
