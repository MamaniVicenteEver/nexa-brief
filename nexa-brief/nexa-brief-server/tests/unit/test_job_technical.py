"""GET /videos/jobs/{job_id}/technical — ficha técnica de Biblioteca (ffprobe simulado)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from src.config.settings import settings
from src.core import job_technical
from src.core.data import collection
from src.presentation.main import app

client = TestClient(app)

FFPROBE_OUTPUT = {
    "streams": [
        {
            "codec_type": "video", "codec_name": "h264", "width": 1920, "height": 1080,
            "avg_frame_rate": "30000/1001", "r_frame_rate": "30/1", "bit_rate": "4500000",
        },
        {
            "codec_type": "audio", "codec_name": "aac", "bit_rate": "192000",
            "sample_rate": "48000", "channels": 2,
        },
    ],
    "format": {"duration": "174.04", "bit_rate": "4700000"},
}


@pytest.fixture
def output_root(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    root = tmp_path / "output"
    root.mkdir()
    monkeypatch.setattr(settings, "output_dir", root)
    return root


@pytest.fixture
def fake_ffprobe(monkeypatch: pytest.MonkeyPatch) -> list[Path]:
    calls: list[Path] = []

    async def fake_run(path: Path):
        calls.append(path)
        return FFPROBE_OUTPUT

    job_technical._probe_cache.clear()
    monkeypatch.setattr(job_technical, "_run_ffprobe", fake_run)
    return calls


def _write(path: Path, content: str | bytes = b"x" * 2048) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    if isinstance(content, str):
        path.write_text(content, encoding="utf-8")
    else:
        path.write_bytes(content)
    return path


def _base_record(job_id: str, out_dir: Path, **extra) -> dict:
    return {
        "job_id": job_id,
        "category": "lyrics_video_caution",
        "title": "Caution",
        "stage": "packaged",
        "output_dir": str(out_dir),
        "errors": [],
        "created_at": "2026-10-14T12:27:10+00:00",
        "updated_at": "2026-10-14T12:37:59+00:00",
        "duration_seconds": 174.0,
        "generation_seconds": 550.7,
        **extra,
    }


def test_technical_unknown_job_404():
    assert client.get("/api/v1/videos/jobs/nope/technical").status_code == 404


@pytest.mark.asyncio
async def test_technical_pipeline_job(output_root: Path, fake_ffprobe: list[Path]):
    out = output_root / "node_motion" / "letras" / "job1"
    video = _write(out / "youtube_video.mp4")
    _write(out / "logs" / "07_grabacion_stats.json", json.dumps({
        "engine": "hyperframes", "engine_target": "local",
        "passes": ["1920x1080@1x"], "pass_seconds": [550.4],
    }))
    _write(out / "manifest.json", json.dumps({
        "template_id": "lyrics-caution", "niche_display_name": "Video de Letras — Caution",
    }))
    _write(out / "logs" / "08_resumen_final.json", json.dumps({
        "language": "es",
        "platform_copies": {
            "youtube": {"title": "t", "description": "d", "tags": [], "strategy": "yt_theme_question_v2"},
            "tiktok": {"title": "t", "description": "d", "tags": [], "strategy": "tiktok_hook_question_v1"},
        },
    }))
    await collection("jobs").insert(_base_record(
        "job1", out,
        file_paths={"youtube": str(video), "reels": str(video)},
        format_paths={"16x9": str(video)},
    ))

    r = client.get("/api/v1/videos/jobs/job1/technical")
    assert r.status_code == 200
    body = r.json()
    assert body["source"] == "pipeline"
    assert body["template"] == "lyrics-caution"
    assert body["template_label"] == "Video de Letras — Caution"
    assert body["engine"] == "hyperframes"
    assert body["engine_target"] == "local"
    assert body["render_seconds"] == 550.4
    assert body["render_passes"] == ["1920x1080@1x"]
    assert body["language"] == "es"
    assert body["strategies"] == {"youtube": "yt_theme_question_v2", "tiktok": "tiktok_hook_question_v1"}
    assert body["formats"] == ["16x9"]
    assert body["output_dir"] == "output/node_motion/letras/job1"
    # El 9:16 apunta al mismo archivo: se mide una sola vez.
    assert [f["key"] for f in body["files"]] == ["16x9"]
    file = body["files"][0]
    assert file["file_name"] == "youtube_video.mp4"
    assert (file["width"], file["height"], file["fps"]) == (1920, 1080, 29.97)
    assert (file["video_codec"], file["video_bitrate_kbps"]) == ("h264", 4500)
    assert (file["audio_codec"], file["audio_bitrate_kbps"], file["audio_sample_rate_khz"]) == ("aac", 192, 48.0)
    assert file["size_mb"] == 0.0

    # Segunda consulta: ffprobe sale de la caché (mismo mtime/tamaño).
    client.get("/api/v1/videos/jobs/job1/technical")
    assert len(fake_ffprobe) == 1


@pytest.mark.asyncio
async def test_technical_explainer_job(
    output_root: Path, fake_ffprobe: list[Path], tmp_path: Path, monkeypatch: pytest.MonkeyPatch,
    api_client,
):
    out = output_root / "node_history" / "binary" / "deep-blue"
    wide = _write(out / "deep-blue-16x9.mp4")
    tall = _write(out / "deep-blue-9x16.mp4")
    _write(out / "deep-blue-9x16-ig.mp4")
    video_dir = tmp_path / "kit" / "deep-blue"
    _write(video_dir / "manifest.json", json.dumps({
        "design": "binary", "design_name": "NODEHISTORY", "language": "es-419",
    }))
    _write(video_dir / "publish.json", json.dumps({
        "strategies_used": {"title": "title_anchor_tension_v1", "pinned": "pinned_fact_two_questions_v1"},
    }))
    from src.core.explainer import catalog

    monkeypatch.setattr(catalog, "find_video_dir", lambda video_id, root=None: video_dir)
    await collection("jobs").insert(_base_record(
        "explainer-deep-blue-1", out,
        category="node_history",
        source="explainer", video_id="deep-blue", design="binary",
        generation_seconds=1068.2,
        file_paths={"youtube": str(wide), "tiktok": str(tall), "reels": str(tall)},
        format_paths={"16x9": str(wide), "9x16": str(tall)},
    ))

    body = (await api_client.get("/api/v1/videos/jobs/explainer-deep-blue-1/technical")).json()
    assert body["source"] == "explainer"
    assert body["engine"] == "explainer-kit"
    assert (body["template"], body["template_label"]) == ("binary", "NODEHISTORY")
    assert body["render_seconds"] == 1068.2
    assert body["language"] == "es-419"
    assert body["strategies"]["title"] == "title_anchor_tension_v1"
    assert [f["key"] for f in body["files"]] == ["16x9", "9x16", "instagram"]
    assert body["files"][2]["file_name"] == "deep-blue-9x16-ig.mp4"


@pytest.mark.asyncio
async def test_technical_missing_files_and_stats_are_null(output_root: Path, fake_ffprobe: list[Path]):
    await collection("jobs").insert(_base_record(
        "job2", output_root / "gone",
        file_paths={"youtube": "/otro/host/output/gone/youtube_video.mp4"},
    ))
    body = client.get("/api/v1/videos/jobs/job2/technical").json()
    assert body["files"] == []
    assert body["engine"] is None
    assert body["render_seconds"] is None
    assert body["strategies"] == {}
    assert fake_ffprobe == []


def test_parse_probe_without_audio():
    parsed = job_technical.parse_probe({
        "streams": [{"codec_type": "video", "codec_name": "hevc", "width": 1080, "height": 1920,
                     "avg_frame_rate": "0/0", "r_frame_rate": "60/1"}],
        "format": {},
    })
    assert parsed["fps"] == 60.0
    assert parsed["audio_codec"] is None
    assert parsed["video_bitrate_kbps"] is None
