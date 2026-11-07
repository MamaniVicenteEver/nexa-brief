from types import SimpleNamespace
import json

import pytest

from src.config.settings import settings
from src.config.niche_config import get_niche_config
from src.core import job_tracker, pipeline
from src.core.categories import output_dir_for_niche
from src.core.content_registry import get_video
from src.core.draft_details import DraftDetails, PlatformDetails, to_summary
from src.core.job import AnalyzedInput, Job, JobInput, JobStage
from src.core.ports.recorder_port import RecordingResult
from src.modules import video_recorder, thumbnail_maker


@pytest.mark.asyncio
async def test_resume_pipeline_v2_keeps_media_logs_and_renders_separate(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "storage_profile_dir", tmp_path)
    monkeypatch.setattr(settings, "storage_layout_version", 2)
    monkeypatch.setattr(settings, "data_dir", tmp_path / "data")
    monkeypatch.setattr(settings, "output_dir", tmp_path / "renders")
    monkeypatch.setattr(settings, "enable_auto_publishing", False)
    monkeypatch.setattr(pipeline, "get_analysis_ai", lambda: None)
    monkeypatch.setattr(pipeline, "get_codegen_ai", lambda: None)
    monkeypatch.setattr(pipeline, "get_copy_ai", lambda: None)
    async def no_thumb(*args, **kwargs): return None
    async def no_duration(*args, **kwargs): return None
    monkeypatch.setattr(thumbnail_maker, "make_thumbnail", no_thumb)
    monkeypatch.setattr(job_tracker, "_get_video_duration_seconds", no_duration)
    import src.modules.video_compressor as compressor
    async def no_compress(*args, **kwargs): raise AssertionError("v2 master must not be compressed")
    monkeypatch.setattr(compressor, "compress_for_publishing", no_compress)
    niche = get_niche_config("lyrics_video_caution")
    job = Job(job_id="job123", input=JobInput(category_name=niche.id), stage=JobStage.HTML_GENERATED)
    prod = output_dir_for_niche(tmp_path / "productions", niche.id) / job.job_id
    prod.mkdir(parents=True)
    for name in ("index.html", "song.mp3", "config.json", "lyrics.json"):
        (prod / name).write_text("{}")
    # La fuente de biblioteca está fuera de BASE_DIR y del perfil: el ID la identifica.
    external = tmp_path.parent / f"{tmp_path.name}-external.mp3"
    external.write_bytes(b"external")
    from src.modules import packager
    monkeypatch.setattr(packager.asset_library, "get_music_entry", lambda _: SimpleNamespace(track_name="T", artist="A", genre="", provider="test"))
    monkeypatch.setattr(packager.asset_library, "resolve_music_path", lambda _: external)
    analysis = AnalyzedInput(genre="test", mood_tags=[], image_query="", description="", duration_seconds=2, category_name=niche.id)
    summary = to_summary(DraftDetails(copies={"youtube": PlatformDetails(title="T", description="D")}))
    job = job.model_copy(update={"artifacts": job.artifacts.model_copy(update={
        "output_dir": prod, "html_path": prod / "index.html", "music_path": prod / "song.mp3",
        "music_asset_id": "external-id", "analyzed_input": analysis, "summary": summary,
    })})
    class FakeRecorder:
        async def record(self, *, html_path, audio_path, output_dir, niche_cfg, **kwargs):
            assert html_path.parent == prod and audio_path.parent == prod
            assert output_dir == tmp_path / "renders/job123/job123"
            for fmt in niche_cfg.video.formats:
                (output_dir / fmt.output_filename).write_bytes(b"master")
            paths = [output_dir / fmt.output_filename for fmt in niche_cfg.video.formats]
            return RecordingResult(youtube_path=paths[0], reels_path=paths[-1], stats={"engine": "fake"})
    monkeypatch.setattr(video_recorder, "get_recorder", lambda *a, **kw: FakeRecorder())
    await job_tracker.create(job, niche)
    final = await pipeline.run(job, on_stage=job_tracker.update, resume=True)
    assert final.stage == JobStage.PACKAGED, final.errors
    assert final.artifacts.youtube_video_path.read_bytes() == b"master"
    assert not (prod / "logs").exists()
    assert (tmp_path / "logs/jobs/job123/07_grabacion_stats.json").is_file()
    assert job_tracker.get_summary(job.job_id)["youtube_title"] == "T"
    manifest = json.loads((prod / "manifest.json").read_text())
    assert manifest["music"]["asset_id"] == "external-id" and manifest["music"]["path"] is None
    record = job_tracker.get(job.job_id)
    assert record["render_dir"] == str(tmp_path / "renders/job123/job123")
    indexed = get_video(job.job_id)
    assert indexed["details"]["status"] == "packaged"
    assert indexed["details"]["recordings"][job.job_id]["asset_ids"]
    assert indexed["logs"]
    from httpx import AsyncClient, ASGITransport
    from src.presentation.main import app
    import anyio.to_thread
    async def inline(func, *args, **kwargs): return func(*args)
    monkeypatch.setattr(anyio.to_thread, "run_sync", inline)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(f"/api/v1/videos/jobs/{job.job_id}/file/youtube", headers={"Range": "bytes=0-2"})
        assert response.status_code == 206 and response.content == b"mas"
    from src.modules.video_deletion import delete_job
    await delete_job(job.job_id, remote=False)
    assert not prod.exists() and not final.artifacts.render_dir.exists()
    assert not final.artifacts.log_dir.exists() and get_video(job.job_id) is None
    assert external.read_bytes() == b"external"
    external.unlink()


@pytest.mark.asyncio
async def test_new_v2_preview_assets_resume_and_library_references(tmp_path, monkeypatch):
    from httpx import ASGITransport, AsyncClient
    from src.core import preview_tracker
    from src.core.draft_details import DraftDetails, PlatformDetails, to_summary
    from src.modules import html_generator
    from src.presentation.main import app
    import anyio.to_thread

    monkeypatch.setattr(settings, 'storage_profile_dir', tmp_path)
    monkeypatch.setattr(settings, 'storage_layout_version', 2)
    monkeypatch.setattr(settings, 'data_dir', tmp_path / 'data')
    monkeypatch.setattr(settings, 'output_dir', tmp_path / 'renders')
    monkeypatch.setattr(settings, 'enable_auto_publishing', False)
    for name in ('get_analysis_ai', 'get_codegen_ai', 'get_copy_ai'):
        monkeypatch.setattr(pipeline, name, lambda: None)
    async def inline(func, *args, **kwargs): return func(*args)
    monkeypatch.setattr(anyio.to_thread, 'run_sync', inline)
    async def no_thumb(*args, **kwargs): return None
    async def no_duration(*args, **kwargs): return None
    monkeypatch.setattr(thumbnail_maker, 'make_thumbnail', no_thumb)
    monkeypatch.setattr(job_tracker, '_get_video_duration_seconds', no_duration)
    niche = get_niche_config('lyrics_video_caution')
    job = Job(job_id='newjob1', input=JobInput(category_name=niche.id))
    async def input_stage(j, *_):
        data = AnalyzedInput(genre='test', mood_tags=[], image_query='', description='', duration_seconds=2, category_name=niche.id)
        return j.model_copy(update={'artifacts': j.artifacts.model_copy(update={'analyzed_input': data})}).advance(JobStage.INPUT_ANALYZED)
    async def media_stage(j, *_):
        assets = j.artifacts.content_dir
        (assets / 'song.mp3').write_bytes(b'audio')
        (assets / 'assets/inputs').mkdir(parents=True)
        (assets / 'assets/inputs/photo.png').write_bytes(b'image')
        return j.model_copy(update={'artifacts': j.artifacts.model_copy(update={'music_path': assets/'song.mp3'})}).advance(JobStage.RESOURCES_FETCHED)
    async def lyrics_stage(j, *_):
        (j.artifacts.content_dir/'lyrics.json').write_text('{}')
        return j.advance(JobStage.DESIGN_COMPLETE)
    async def prompt_stage(j, *_):
        return j.model_copy(update={'artifacts': j.artifacts.model_copy(update={'prompt_text': 'synthetic'})}).advance(JobStage.PROMPT_BUILT)
    monkeypatch.setattr(pipeline.input_analyzer, 'run', input_stage)
    monkeypatch.setattr(pipeline.resource_fetcher, 'run', media_stage)
    monkeypatch.setattr(pipeline.lyrics_transcriber, 'run', lyrics_stage)
    monkeypatch.setattr(pipeline.prompt_architect, 'run', prompt_stage)
    template = tmp_path / 'template.html'
    template.write_text('<html><head></head><body><img src="assets/inputs/photo.png"><audio src="song.mp3"></audio></body></html>')
    config = tmp_path / 'config.json'
    config.write_text('{"audio":{"src":"song.mp3"}}')
    monkeypatch.setattr(html_generator, 'get_template_paths', lambda _: {'index_html': template, 'config_json': config})
    monkeypatch.setattr(html_generator, 'copy_template_runtime_assets', lambda *_: [])
    async def same_config(config_data, *_): return config_data
    monkeypatch.setattr(html_generator, 'apply_template_inputs', same_config)
    summary = to_summary(DraftDetails(copies={'youtube': PlatformDetails(title='Title', description='Description')}))
    job = job.model_copy(update={'artifacts': job.artifacts.model_copy(update={'summary': summary})})
    preview_tracker.create(job)
    preview = await pipeline.run(job, on_stage=preview_tracker.update, stop_after=JobStage.HTML_GENERATED)
    assert preview.stage == JobStage.HTML_GENERATED, preview.errors
    root = preview.artifacts.output_dir
    assert preview.artifacts.assets_dir == root/'assets'
    assert (root/'index.html').is_file() and (root/'assets/config.json').is_file()
    assert not (root/'config.json').exists() and not (root/'song.mp3').exists()
    assert '<base href="assets/">' in (root/'index.html').read_text()
    async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as client:
        prefix = f'/api/v1/templates/preview/{job.job_id}/'
        assert (await client.get(prefix+'assets/config.json')).status_code == 200
        assert (await client.get(prefix+'assets/song.mp3')).content == b'audio'
        assert (await client.get(prefix+'assets/assets/inputs/photo.png')).content == b'image'
        (root/'assets/assets/inputs/alias.png').symlink_to(root/'assets/assets/inputs/photo.png')
        assert (await client.get(prefix+'assets/assets/inputs/alias.png')).status_code == 404
        assert (await client.get(prefix+'assets/../manifest.json')).status_code == 404
        status = (await client.get(prefix+'status')).json()
        assert any(f['filename'] == 'config.json' and '/assets/config.json' in f['url'] for f in status['files'])
    class FakeRecorder:
        async def record(self, *, html_path, audio_path, output_dir, niche_cfg, **kwargs):
            assert html_path.parent == root and audio_path == root/'assets/song.mp3'
            paths = []
            for fmt in niche_cfg.video.formats:
                dest = output_dir/fmt.output_filename
                dest.write_bytes(b'master')
                paths.append(dest)
            return RecordingResult(youtube_path=paths[0], reels_path=paths[-1], stats={})
    monkeypatch.setattr(video_recorder, 'get_recorder', lambda *args, **kwargs: FakeRecorder())
    await job_tracker.create(preview, niche)
    final = await pipeline.run(preview, on_stage=job_tracker.update, resume=True)
    assert final.stage == JobStage.PACKAGED, final.errors
    manifest = json.loads((root/'manifest.json').read_text())
    assert manifest['composition'] == {'html': 'index.html', 'assets': 'assets', 'config': 'assets/config.json'}
    resources = get_video(job.job_id)['resources']
    assert any(r['kind'] == 'image' and r['storage_key'].endswith('/assets/assets/inputs/photo.png') for r in resources)
    assert final.artifacts.youtube_video_path.is_relative_to(tmp_path/'renders')
