"""Miniatura del final de la intro: segundo que declara cada intro.js, cuadro estable y archivos."""

from __future__ import annotations

import asyncio
import shutil
import subprocess
from pathlib import Path

import pytest

from src.modules.thumbnail_maker import capture_at, declared_at, make_thumbnail, pick_stable, stable_time


def test_each_lyrics_intro_declares_its_moment():
    assert capture_at("lyrics-caution") == 0.45   # el cartel dura 0,3–0,8 s; después viene «STOP»
    assert capture_at("lyrics-neon") == 2.0
    assert capture_at("promo-editorial") == 1.0   # sin marca: 1 s
    assert capture_at(None) == 1.0


def test_declared_at_reads_the_mark(tmp_path: Path):
    intro = tmp_path / "intro.js"
    intro.write_text("// @nexa thumbnail-at: 2.35 — algo\n(function(){})();")
    assert declared_at(intro) == 2.35
    intro.write_text("(function(){})();")
    assert declared_at(intro) is None


def test_pick_stable_skips_blank_and_moving_frames():
    size = 96 * 54
    blank = bytes(size)
    still = bytes((i * 37) % 256 for i in range(size))
    moving = [bytes((i * 37 + k * 50) % 256 for i in range(size)) for k in range(3)]
    frames = [blank, blank, moving[0], moving[1], moving[2], still, still, still]
    assert pick_stable(frames) == 6           # el del medio del tramo quieto, nunca el negro ni el animado
    assert pick_stable([blank, blank]) is None
    # tramo quieto largo: gana el cuadro más cercano al segundo declarado
    assert pick_stable([still] * 9, center=6) == 6


def _video(path: Path, inputs: list[str]) -> None:
    subprocess.run(["ffmpeg", "-y", "-v", "error", *inputs, "-pix_fmt", "yuv420p", str(path)], check=True)


@pytest.mark.skipif(not shutil.which("ffmpeg"), reason="ffmpeg no disponible")
def test_stable_time_moves_off_a_black_fade(tmp_path: Path):
    video = tmp_path / "v.mp4"
    # 0,5 s en negro y después barras quietas: pedir 0,4 s no puede devolver un cuadro negro
    _video(video, ["-f", "lavfi", "-i", "color=c=black:s=320x180:r=30:d=0.5", "-f", "lavfi", "-i", "smptebars=s=320x180:r=30:d=1",
                   "-filter_complex", "[0][1]concat=n=2:v=1:a=0"])
    assert asyncio.run(stable_time(video, 0.4)) >= 0.5


@pytest.mark.skipif(not shutil.which("ffmpeg"), reason="ffmpeg no disponible")
def test_jpeg_for_youtube_and_webp_for_the_web(tmp_path: Path):
    video = tmp_path / "youtube_video.mp4"
    _video(video, ["-f", "lavfi", "-i", "testsrc=size=1920x1080:rate=30:duration=3"])
    jpg = asyncio.run(make_thumbnail(video, tmp_path, 1.5))
    assert jpg is not None and jpg.name == "thumbnail.jpg"
    assert jpg.stat().st_size <= 2 * 1024 * 1024
    from PIL import Image

    assert Image.open(jpg).size == (1280, 720)
    assert (tmp_path / "thumbnail.webp").exists()
