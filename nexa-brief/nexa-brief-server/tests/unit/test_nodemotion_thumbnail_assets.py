from __future__ import annotations

import io
import json
import shutil
import subprocess
from pathlib import Path

import pytest
from PIL import Image

from src.core.job import Job, JobInput, JobArtifacts
from src.core import draft_thumbnail_assets as assets
from src.core import draft_thumbnails as thumbs
from src.core.draft_details import DraftDetails


def job_at(root: Path) -> Job:
    root.mkdir(exist_ok=True)
    (root / "index.html").write_text("<!doctype html>")
    (root / "config.json").write_text(json.dumps({"bg": {"src": "bg.mp4"}}))
    return Job(input=JobInput(category_name="lyrics-neon"), artifacts=JobArtifacts(output_dir=root, assets_dir=root, html_path=root / "index.html", config_json_path=root / "config.json"))


@pytest.mark.asyncio
async def test_uploaded_image_is_normalized_and_cannot_escape_project(tmp_path):
    job = job_at(tmp_path)
    output = io.BytesIO()
    Image.new("RGBA", (2100, 1000), (180, 50, 10, 180)).save(output, format="PNG")
    ident = assets.save_background(job, output.getvalue())
    path = await assets.background_file(job, {"kind": "image", "asset": ident})
    with Image.open(path) as image:
        assert image.format == "JPEG" and image.mode == "RGB"
        assert image.width == 1920
    assert path.is_relative_to(tmp_path)
    with pytest.raises(ValueError):
        await assets.background_file(job, {"kind": "image", "asset": "../secret"})
    with pytest.raises(ValueError):
        assets.save_background(job, b"<svg onload='x'/>")
    with pytest.raises(ValueError):
        assets.save_background(job, b"x" * (8 * 1024 * 1024 + 1))


@pytest.mark.asyncio
async def test_real_frame_is_cached_and_replaces_neither_option_nor_video(tmp_path):
    if not shutil.which("ffmpeg"):
        pytest.skip("FFmpeg no disponible")
    job = job_at(tmp_path)
    video = tmp_path / "bg.mp4"
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=size=320x180:rate=5", "-t", "0.6", "-pix_fmt", "yuv420p", "-threads", "1", str(video)], check=True, timeout=10)
    first = await assets.background_file(job, {"kind": "frame", "time": 120})
    modified = first.stat().st_mtime_ns
    second = await assets.background_file(job, {"kind": "frame", "time": 120})
    assert second == first and second.stat().st_mtime_ns == modified
    assert len(list(first.parent.glob("*.jpg"))) == 1
    assert video.is_file() and not list(first.parent.glob("*.pending.jpg"))
    with Image.open(first) as image:
        assert image.size == (1280, 720)
    # El video dura 0.6 s: los segundos grandes deben seguir su bucle.
    third = await assets.background_file(job, {"kind":"frame", "time":120.2})
    fourth = await assets.background_file(job, {"kind":"frame", "time":120.4})
    assert third.read_bytes() != fourth.read_bytes()


def test_neon_uses_original_fonts_and_configurable_light_colors(tmp_path):
    job = job_at(tmp_path)
    (tmp_path / "config.json").write_text(json.dumps({"neon": {"core": "#ABCDEF", "glow": "#AABBCC"}}))
    manifest = thumbs.preview_manifest(job, DraftDetails(song_name="Hola Remix", artist="Dalex"))
    assert manifest["templateId"] == "lyrics-neon"
    assert manifest["options"]["A"]["design"]["typography"]["display"] == "Monoton"
    assert manifest["options"]["B"]["design"]["typography"]["display"] == "Archivo Black"
    assert manifest["options"]["A"]["design"]["palette"]["foreground"] == "#ABCDEF"
    assert manifest["options"]["A"]["design"]["palette"]["accent"] == "#AABBCC"
    for option in ("A", "B"):
        font = manifest["options"][option]["design"]["typography"]["font"]
        assert assets.font_path(font["url"].rsplit("/", 1)[-1]).is_file()


@pytest.mark.parametrize("template_id, config", [
    ("lyrics-romantic", {"bg":{"src":"bg.jpg","filter":"brightness(0.30) grayscale(0.35)"}}),
    ("lyrics-calado", {"video":{"src":"bg.mp4","dimSolido":.42}}),
    ("lyrics-impact", {"bg":{"src":"bg.mp4","filter":"brightness(0.50) blur(4px)","darkness":{"center":.04}}}),
])
def test_thumbnail_preserves_media_colors_with_only_twenty_percent_black(template_id, config):
    style = assets.background_style(config, template_id)
    assert style == {"overlay":.2, "edgeDarkening":0, "filter":"", "overlayMode":"template"}


def test_calado_video_source_is_preserved_and_style_is_template_specific(tmp_path):
    job = job_at(tmp_path)
    (tmp_path / "bg.mp4").write_bytes(b"video")
    (tmp_path / "config.json").write_text(json.dumps({"video":{"src":"bg.mp4","dimSolido":.42}}))
    assert assets.background_source(job) == tmp_path / "bg.mp4"
    designs = thumbs._build_designs("lyrics-calado", {"video":{"src":"bg.mp4","dimSolido":.42}})
    assert designs["A"]["rowTreatments"] == ["solid", "outline"]
    assert designs["B"]["rowTreatments"] == ["outline", "solid", "outline", "solid"]
    assert designs["A"]["typography"]["display"] == "Anton"
    assert thumbs._build_designs("lyrics-romantic", {})["A"]["rowTreatments"] == ["solid"]


def test_native_romantic_palette_and_actual_media_kind(tmp_path):
    job = job_at(tmp_path)
    (tmp_path / "photo.jpg").write_bytes(b"original")
    (tmp_path / "config.json").write_text(json.dumps({"bg":{"type":"image","src":"photo.jpg"}}))
    assert assets.background_kind(job) == "image"
    assert thumbs.preview_manifest(job,DraftDetails(song_name="Song"))["options"]["A"]["design"]["background"]["sourceKind"] == "image"
    colors={"serif":"#AAEECC","script":"#DD4477"}
    designs=thumbs._build_designs("lyrics-romantic", {"colors":colors})
    assert designs["A"]["palette"]["foreground"] == colors["script"]
    assert designs["B"]["palette"]["foreground"] == colors["serif"]
    assert designs["A"]["typography"]["display"] == "Great Vibes"
    assert designs["B"]["typography"]["weight"] == 500
    assert designs["B"]["typography"]["slant"] == "italic"
    for design in designs.values():
        assert design["typography"]["font"]


def test_manual_darkness_and_frame_time_survive_normalization(tmp_path):
    job=job_at(tmp_path)
    defaults=thumbs.preview_manifest(job,DraftDetails(song_name="Song"))
    options=defaults["options"]
    options["B"]["design"]["background"].update(overlay=.65,overlayMode="manual",time=32.5)
    result=thumbs.preview_manifest(job,DraftDetails(song_name="Song"),options)["options"]
    assert result["B"]["design"]["background"]["overlay"] == .65
    assert result["B"]["design"]["background"]["time"] == 32.5
    assert result["A"]["design"]["background"]["overlay"] == .2
