from __future__ import annotations

import asyncio
import shutil
import subprocess
from pathlib import Path

import pytest

from src.modules import video_compressor


pytestmark = pytest.mark.skipif(
    shutil.which("ffmpeg") is None or shutil.which("ffprobe") is None,
    reason="ffmpeg y ffprobe son necesarios para estos tests",
)


def _generate_video(path: Path, *, high_bitrate: bool) -> None:
    command = [
        "ffmpeg", "-hide_banner", "-v", "error",
        "-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=30",
        "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100",
        "-t", "3", "-map", "0:v:0", "-map", "1:a:0",
        "-c:v", "libx264", "-preset", "ultrafast",
    ]
    if high_bitrate:
        # CBR makes the 3-second source reliably exceed the compressor's 12 Mbps limit.
        command += [
            "-b:v", "40M", "-minrate", "40M", "-maxrate", "40M", "-bufsize", "80M",
            "-x264-params", "nal-hrd=cbr",
        ]
    else:
        command += ["-b:v", "200k"]
    command += [
        "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
        str(path),
    ]
    subprocess.run(command, check=True, capture_output=True, text=True)


class _FinishedProcess:
    def __init__(self, returncode: int, stdout: bytes | None, stderr: bytes | None):
        self.returncode = returncode
        self._stdout = stdout or b""
        self._stderr = stderr or b""

    async def communicate(self) -> tuple[bytes, bytes]:
        return self._stdout, self._stderr

    async def wait(self) -> int:
        return self.returncode

    def kill(self) -> None:
        pass


def _compress(video: Path, *, keep_master: bool | None = None) -> bool:
    # The managed asyncio child watcher in this Python 3.10 environment stalls on ffprobe.
    # Run the real ffprobe/ffmpeg commands synchronously behind the subprocess interface.
    async def run() -> bool:
        original_spawn = video_compressor.asyncio.create_subprocess_exec

        async def spawn(*args, stdout=None, stderr=None, **kwargs) -> _FinishedProcess:
            completed = subprocess.run(args, stdout=stdout, stderr=stderr, check=False)
            return _FinishedProcess(completed.returncode, completed.stdout, completed.stderr)

        video_compressor.asyncio.create_subprocess_exec = spawn
        try:
            return await video_compressor.compress_for_publishing(video, keep_master=keep_master)
        finally:
            video_compressor.asyncio.create_subprocess_exec = original_spawn

    return asyncio.run(run())


@pytest.fixture
def high_bitrate_video(tmp_path: Path) -> Path:
    path = tmp_path / "high.mp4"
    _generate_video(path, high_bitrate=True)
    return path


def test_compresses_in_place_keeps_master_and_is_idempotent(high_bitrate_video: Path):
    original = high_bitrate_video.read_bytes()
    master = video_compressor.master_path(high_bitrate_video)

    assert _compress(high_bitrate_video) is True
    compressed = high_bitrate_video.read_bytes()
    assert len(compressed) < len(original)
    assert master.read_bytes() == original

    assert _compress(high_bitrate_video) is False
    assert high_bitrate_video.read_bytes() == compressed
    assert master.read_bytes() == original


def test_compress_without_master_and_skips_already_light_video(tmp_path: Path):
    video = tmp_path / "video.mp4"
    _generate_video(video, high_bitrate=True)

    assert _compress(video, keep_master=False) is True
    compressed = video.read_bytes()
    assert len(compressed) > 0
    assert not (tmp_path / "masters").exists()

    # Without a master marker, the low bitrate itself must make the next call a no-op.
    assert _compress(video, keep_master=False) is False
    assert video.read_bytes() == compressed
    assert not (tmp_path / "masters").exists()


def test_skips_separately_generated_low_bitrate_video(tmp_path: Path):
    video = tmp_path / "low.mp4"
    _generate_video(video, high_bitrate=False)
    original = video.read_bytes()

    assert _compress(video) is False
    assert video.read_bytes() == original
    assert not (tmp_path / "masters").exists()


@pytest.mark.parametrize("corrupt", [False, True], ids=["missing", "corrupt"])
def test_missing_or_corrupt_video_returns_false_without_changing_it(tmp_path: Path, corrupt: bool):
    video = tmp_path / "broken.mp4"
    original = b"not an mp4 file" if corrupt else None
    if original is not None:
        video.write_bytes(original)

    assert _compress(video) is False
    if original is None:
        assert not video.exists()
    else:
        assert video.read_bytes() == original
    assert not (tmp_path / "masters").exists()


def test_disabled_compression_leaves_video_untouched(monkeypatch: pytest.MonkeyPatch, high_bitrate_video: Path):
    original = high_bitrate_video.read_bytes()
    monkeypatch.setattr(video_compressor.settings, "video_compress_enabled", False)

    assert asyncio.run(video_compressor.compress_for_publishing(high_bitrate_video)) is False
    assert high_bitrate_video.read_bytes() == original
    assert not (high_bitrate_video.parent / "masters").exists()
