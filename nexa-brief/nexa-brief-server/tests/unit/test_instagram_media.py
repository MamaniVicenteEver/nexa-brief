"""Copia apta para Reels (instagram_media) y archivo por formato (job_tracker.format_paths)."""
from __future__ import annotations

import shutil
import subprocess

import pytest

from src.adapters.publishing import instagram_media
from src.adapters.publishing.instagram_adapter import _poll_window_seconds
from src.adapters.publishing.instagram_media import MediaInfo, needs_transcode, video_bitrate_for
from src.config.exceptions import PlatformAPIError
from src.core import job_tracker

_MB = 1024 * 1024


def test_needs_transcode_only_when_too_big():
    ok = MediaInfo(size_bytes=100 * _MB, duration_seconds=60, audio_bps=128_000, pix_fmt="yuv420p")
    assert not needs_transcode(ok)
    assert needs_transcode(MediaInfo(381 * _MB, 339, 128_000, "yuv420p"))
    # así se publicó Apolo 11 sin problema: no hace falta una copia
    assert not needs_transcode(MediaInfo(51 * _MB, 244, 166_000, "yuvj420p"))


def test_video_bitrate_fits_target_and_is_capped():
    # 339 s (Deep Blue): ~6,7 Mbps de presupuesto → tope 6 Mbps
    assert video_bitrate_for(339) == 6_000_000
    long_rate = video_bitrate_for(14 * 60)
    assert long_rate < 6_000_000
    assert (long_rate + 128_000) * 14 * 60 / 8 < 290 * _MB


def test_poll_window_scales_with_size():
    assert _poll_window_seconds(0) == 120
    assert _poll_window_seconds(200 * _MB) == 220
    assert _poll_window_seconds(5000 * _MB) == 900
    # 9 min 22 s en 46 MB: manda la duración, no el peso
    assert _poll_window_seconds(46 * _MB, 562.4) == 682.4


@pytest.mark.skipif(not shutil.which("ffmpeg"), reason="ffmpeg no disponible")
async def test_reels_safe_video_transcodes_and_reuses(tmp_path, monkeypatch):
    source = tmp_path / "clip-9x16.mp4"
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "testsrc=size=180x320:rate=30:duration=1",
         "-f", "lavfi", "-i", "sine=duration=1", "-c:v", "libx264", "-pix_fmt", "yuvj420p",
         "-c:a", "aac", "-b:a", "256k", "-shortest", str(source)],
        check=True,
    )
    # el original hace de «demasiado grande» (un archivo real de 300 MB no entra en un test)
    big = source.stat().st_size
    monkeypatch.setattr(instagram_media, "needs_transcode", lambda info: info.size_bytes == big)
    copy = await instagram_media.reels_safe_video(source)
    assert copy == tmp_path / "clip-9x16-ig.mp4"
    info = await instagram_media.probe(copy)
    assert info.pix_fmt == "yuv420p" and (info.audio_bps or 0) <= instagram_media.MAX_AUDIO_BPS
    mtime = copy.stat().st_mtime_ns
    assert await instagram_media.reels_safe_video(source) == copy
    assert copy.stat().st_mtime_ns == mtime          # reutilizada, no recodificada
    assert await instagram_media.reels_safe_video(copy) == copy   # la copia ya es apta


async def test_reels_safe_video_rejects_over_15_minutes(tmp_path, monkeypatch):
    async def fake_probe(_path):
        return MediaInfo(size_bytes=10 * _MB, duration_seconds=901, audio_bps=128_000, pix_fmt="yuv420p")

    monkeypatch.setattr(instagram_media, "probe", fake_probe)
    with pytest.raises(PlatformAPIError) as exc:
        await instagram_media.reels_safe_video(tmp_path / "long.mp4")
    assert exc.value.status_code == 400


def test_format_paths_stored_or_derived():
    assert job_tracker.format_paths({"format_paths": {"16x9": "/a.mp4"}}) == {"16x9": "/a.mp4"}
    legacy = {"file_paths": {"youtube": "/y.mp4", "reels": "/r.mp4", "thumbnail": "/t.jpg"}}
    assert job_tracker.format_paths(legacy) == {"16x9": "/y.mp4", "9x16": "/r.mp4"}
    same_file = {"file_paths": {"youtube": "/y.mp4", "reels": "/y.mp4"}}
    assert job_tracker.format_paths(same_file) == {"16x9": "/y.mp4"}
