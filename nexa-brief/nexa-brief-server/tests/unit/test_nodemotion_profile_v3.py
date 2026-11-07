from types import SimpleNamespace
import json

import pytest

from src.config.settings import settings
from src.config.niche_config import get_niche_config
from src.core import job_tracker, pipeline
from src.core.content_registry import get_video
from src.core.draft_details import DraftDetails, PlatformDetails, to_summary
from src.core.job import AnalyzedInput, Job, JobInput, JobStage
from src.core.ports.recorder_port import RecordingResult
from src.modules import video_recorder, thumbnail_maker


@pytest.mark.asyncio
async def test_resume_pipeline_v3_keeps_media_logs_and_renders_separate(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "storage_profile_dir", tmp_path)
    monkeypatch.setattr(settings, "storage_layout_version", 3)
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
    prod = tmp_path / "productions/nodemotion" / job.job_id
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
            assert output_dir == tmp_path / ".system/runtime/recordings/job123/pipeline"
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
    assert record["render_dir"] == str(tmp_path / "renders/videos/nodemotion/job123")
    assert final.artifacts.youtube_video_path.name == "video.mp4"
    assert final.artifacts.youtube_video_path.is_relative_to(tmp_path / "renders/videos/nodemotion/job123")
    assert all(path.name == "video.mp4" for path in (tmp_path / "renders/videos").rglob("*.mp4"))
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


