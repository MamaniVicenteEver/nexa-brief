"""Job outputs must remain confined to the active profile and recording."""
import hashlib
from pathlib import Path

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from src.adapters.data.json_store import JsonDataStore
from src.config.settings import settings
from src.core.data import collection, documents
from src.modules import video_deletion
from src.presentation.api.routers.videos import router


@pytest.fixture
def profile(tmp_path, monkeypatch):
    root = tmp_path / 'profile'
    monkeypatch.setattr(settings, 'storage_profile_dir', root)
    monkeypatch.setattr(settings, 'storage_layout_version', 3)
    monkeypatch.setattr(settings, 'data_dir', root / 'data')
    monkeypatch.setattr(settings, 'output_dir', root / 'renders')
    monkeypatch.setattr('src.core.data._store', JsonDataStore())
    return root


@pytest.mark.asyncio
async def test_v3_job_file_confines_profile_rejects_symlinks_and_validates_alias(profile, tmp_path):
    own = profile / 'renders/videos/nodetech/movie/one-16x9/video.mp4'
    own.parent.mkdir(parents=True)
    own.write_bytes(b'own-video')
    other = tmp_path / 'other-profile/renders/video.mp4'
    other.parent.mkdir(parents=True)
    other.write_bytes(b'private-other-video')
    link = own.parent / 'escape.mp4'
    link.symlink_to(other)
    await collection('jobs').insert({'job_id': 'job', 'stage': 'packaged', 'file_paths': {
        'youtube': str(other), 'tiktok': str(link), 'reels': str(own)}})
    app = FastAPI()
    app.include_router(router)
    async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as client:
        assert (await client.get('/videos/jobs/job/file/youtube')).status_code == 404
        assert (await client.get('/videos/jobs/job/file/tiktok')).status_code == 404
        assert (await client.get('/videos/jobs/job/file/reels')).content == b'own-video'
        documents('legacy_path_aliases').put(hashlib.sha256(str(other).encode()).hexdigest(), {
            'legacy_key': str(other), 'storage_key': str(own), 'sha256': hashlib.sha256(b'own-video').hexdigest()})
        response = await client.get('/videos/jobs/job/file/youtube')
        assert response.status_code == 200 and response.content == b'own-video'
        documents('legacy_path_aliases').put(hashlib.sha256(str(other).encode()).hexdigest(), {
            'legacy_key': str(other), 'storage_key': str(other)})
        assert (await client.get('/videos/jobs/job/file/youtube')).status_code == 404
        documents('legacy_path_aliases').put(hashlib.sha256(str(other).encode()).hexdigest(), {
            'legacy_key': str(other), 'storage_key': str(own), 'sha256': '0' * 64})
        assert (await client.get('/videos/jobs/job/file/youtube')).status_code == 404


async def _recording(root: Path, recording: str, *, shared_thumbnail: Path) -> tuple[dict, dict]:
    video_id = 'movie'
    outputs = []
    ids = []
    for fmt in ('16x9', '9x16'):
        path = root / f'renders/videos/nodetech/{video_id}/{recording}-{fmt}/video.mp4'
        path.parent.mkdir(parents=True)
        path.write_bytes(recording.encode())
        path.with_suffix('.mp4.sha256').write_text('stamp')
        asset_id = f'asset-{recording}-{fmt}'
        await collection('content_resources').insert({'asset_id': asset_id, 'video_id': video_id,
            'storage_key': path.relative_to(root).as_posix(), 'kind': 'video'})
        outputs.append(path)
        ids.append(asset_id)
    log_id = f'log-{recording}'
    log_path = root / f'logs/videos/{video_id}/recordings/{recording}.log'
    log_path.parent.mkdir(parents=True, exist_ok=True)
    log_path.write_text('synthetic log')
    summary = log_path.parent / recording / '08_resumen_final.json'
    summary.parent.mkdir()
    summary.write_text('{}')
    await collection('execution_logs').insert({'log_id': log_id, 'video_id': video_id,
        'key': log_path.relative_to(root).as_posix(), 'kind': 'recording'})
    job = {'job_id': f'explainer-{video_id}-{recording}', 'video_id': video_id, 'source': 'explainer',
           'stage': 'packaged', 'output_dir': str(root / 'productions/nodetech/movie'),
           'created_at': '2026-10-14T00:00:00+00:00', 'updated_at': '2026-10-14T00:00:00+00:00',
           'file_paths': {'youtube': str(outputs[0]), 'reels': str(outputs[1]), 'thumbnail': str(shared_thumbnail)},
           'format_paths': {'16x9': str(outputs[0]), '9x16': str(outputs[1])}}
    await collection('jobs').insert(job)
    return job, {'recording_id': recording, 'asset_ids': ids, 'log_id': log_id, 'duration': 'full'}


@pytest.mark.asyncio
async def test_v3_delete_one_recording_keeps_production_and_neighbor(profile):
    production = profile / 'productions/nodetech/movie'
    production.mkdir(parents=True)
    (production / 'index.html').write_text('owned production')
    thumbnail = production / 'thumbnail.jpg'
    thumbnail.write_bytes(b'shared')
    first, rec1 = await _recording(profile, 'first', shared_thumbnail=thumbnail)
    second, rec2 = await _recording(profile, 'second', shared_thumbnail=thumbnail)
    await collection('content_videos').insert({'video_id': 'movie', 'production_id': 'prod'})
    documents('content_video_details').put('movie', {'title': 'Movie', 'recordings': {'first': rec1, 'second': rec2}})

    result = await video_deletion.delete_job(first['job_id'], remote=False)
    assert result.deleted_local
    assert collection('jobs').get(first['job_id']) is None
    assert collection('jobs').get(second['job_id']) is not None
    assert production.is_dir() and (production / 'index.html').exists() and thumbnail.exists()
    assert not Path(first['file_paths']['youtube']).exists()
    assert not Path(first['file_paths']['reels']).exists()
    assert not (profile / 'logs/videos/movie/recordings/first.log').exists()
    assert not (profile / 'logs/videos/movie/recordings/first/08_resumen_final.json').exists()
    assert Path(second['file_paths']['youtube']).exists()
    assert (profile / 'logs/videos/movie/recordings/second.log').exists()
    assert collection('execution_logs').get('log-first') is None
    assert documents('content_video_details').get('movie')['recordings'] == {'second': rec2}
    assert collection('content_resources').get(rec1['asset_ids'][0]) is None
    assert collection('content_resources').get(rec2['asset_ids'][0]) is not None

    result = await video_deletion.delete_job(second['job_id'], remote=False)
    assert result.deleted_local and production.is_dir() and thumbnail.exists()
    assert not Path(second['file_paths']['youtube']).exists()
    assert documents('content_video_details').get('movie')['recordings'] == {}


@pytest.mark.asyncio
async def test_v3_delete_refuses_symlink_without_removing_job_or_neighbor(profile, tmp_path):
    production = profile / 'productions/nodetech/movie'
    production.mkdir(parents=True)
    thumbnail = production / 'thumbnail.jpg'
    thumbnail.write_bytes(b'shared')
    job, rec = await _recording(profile, 'first', shared_thumbnail=thumbnail)
    await collection('content_videos').insert({'video_id': 'movie', 'production_id': 'prod'})
    documents('content_video_details').put('movie', {'recordings': {'first': rec}})
    target = Path(job['file_paths']['youtube'])
    target.unlink()
    external = tmp_path / 'private.mp4'
    external.write_bytes(b'private')
    target.symlink_to(external)
    with pytest.raises(ValueError, match='simbólico'):
        await video_deletion.delete_job(job['job_id'], remote=False)
    assert collection('jobs').get(job['job_id']) is not None
    assert Path(job['file_paths']['reels']).exists()
    assert external.read_bytes() == b'private'


@pytest.mark.asyncio
async def test_v3_delete_preserves_master_shared_by_another_recording(profile):
    production = profile / 'productions/nodetech/movie'
    production.mkdir(parents=True)
    thumbnail = production / 'thumbnail.jpg'
    thumbnail.write_bytes(b'shared')
    first, rec1 = await _recording(profile, 'first', shared_thumbnail=thumbnail)
    second, rec2 = await _recording(profile, 'second', shared_thumbnail=thumbnail)
    rec2['asset_ids'].append(rec1['asset_ids'][0])
    await collection('jobs').update(second['job_id'], {'file_paths': {'youtube': first['file_paths']['youtube']}})
    await collection('content_videos').insert({'video_id': 'movie', 'production_id': 'prod'})
    documents('content_video_details').put('movie', {'recordings': {'first': rec1, 'second': rec2}})
    result = await video_deletion.delete_job(first['job_id'], remote=False)
    assert result.deleted_local
    assert Path(first['file_paths']['youtube']).exists()
    assert collection('content_resources').get(rec1['asset_ids'][0]) is not None
    assert not Path(first['file_paths']['reels']).exists()
    assert documents('content_video_details').get('movie')['recordings']['second'] == rec2
    assert (await video_deletion.delete_job(second['job_id'], remote=False)).deleted_local
    assert Path(first['file_paths']['youtube']).exists()
    assert collection('content_resources').get(rec1['asset_ids'][0]) is not None


@pytest.mark.asyncio
async def test_v3_delete_reports_file_error_and_keeps_job(profile, monkeypatch):
    production = profile / 'productions/nodetech/movie'
    production.mkdir(parents=True)
    thumbnail = production / 'thumbnail.jpg'
    thumbnail.write_bytes(b'shared')
    job, rec = await _recording(profile, 'first', shared_thumbnail=thumbnail)
    await collection('content_videos').insert({'video_id': 'movie', 'production_id': 'prod'})
    documents('content_video_details').put('movie', {'recordings': {'first': rec}})
    original_unlink = Path.unlink
    def refuse(self, *args, **kwargs):
        if self.name == 'video.mp4':
            raise PermissionError('synthetic failure')
        return original_unlink(self, *args, **kwargs)
    monkeypatch.setattr(Path, 'unlink', refuse)
    with pytest.raises(ValueError, match='No se pudieron eliminar'):
        await video_deletion.delete_job(job['job_id'], remote=False)
    assert collection('jobs').get(job['job_id']) is not None
    assert documents('content_video_details').get('movie')['recordings']['first'] == rec
    assert Path(job['file_paths']['youtube']).exists()


@pytest.mark.asyncio
async def test_v3_pipeline_delete_surfaces_rmtree_error_keeps_index(profile, monkeypatch):
    output = profile / 'productions/nodemotion/job-one'
    output.mkdir(parents=True)
    (output / 'index.html').write_text('source')
    job = {'job_id': 'job-one', 'stage': 'packaged', 'output_dir': str(output),
           'created_at': '2026-10-14T00:00:00+00:00', 'updated_at': '2026-10-14T00:00:00+00:00'}
    await collection('jobs').insert(job)
    def fail(_path):
        raise PermissionError('synthetic failure')
    monkeypatch.setattr(video_deletion.shutil, 'rmtree', fail)
    with pytest.raises(ValueError, match='No se pudieron eliminar'):
        await video_deletion.delete_job('job-one', remote=False)
    assert collection('jobs').get('job-one') is not None
    assert (output / 'index.html').exists()


@pytest.mark.asyncio
async def test_v3_pipeline_retains_legitimately_shared_folder(profile):
    output = profile / 'productions/nodemotion/job-one'
    output.mkdir(parents=True)
    (output / 'index.html').write_text('source')
    def record(job_id):
        return {'job_id': job_id, 'stage': 'packaged', 'output_dir': str(output),
                'created_at': '2026-10-14T00:00:00+00:00', 'updated_at': '2026-10-14T00:00:00+00:00'}
    await collection('jobs').insert(record('job-one'))
    await collection('jobs').insert(record('job-two'))
    assert (await video_deletion.delete_job('job-one', remote=False)).deleted_local
    assert collection('jobs').get('job-two') is not None
    assert (output / 'index.html').exists()
