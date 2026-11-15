"""Paletas y detección de medios para las cinco plantillas de letras."""
import json

import pytest

from src.core import draft_thumbnail_assets as assets, draft_thumbnails as thumbnails
from src.core.job import Job, JobArtifacts, JobInput


@pytest.mark.parametrize("template", ["lyrics-mixtas", "lyrics-grunge"])
def test_scene_video_is_available_and_user_image_keeps_priority(tmp_path, template):
    video = tmp_path / "scene.mp4"
    image = tmp_path / "custom.jpg"
    video.write_bytes(b"video")
    image.write_bytes(b"image")
    config = tmp_path / "config.json"
    config.write_text(json.dumps({"media": [{"type": "video", "src": "scene.mp4"}]}))
    job = Job(input=JobInput(category_name=template), artifacts=JobArtifacts(
        output_dir=tmp_path, content_dir=tmp_path, config_json_path=config, image_path=image,
    ))
    assert assets.background_source(job) == image
    assert assets.background_source(job, "video") == video
    assert set(assets.background_sources(job)) == {"image", "video"}
    assert assets.background_style({}, template)["overlay"] == .2


def test_scene_paths_cannot_escape_project(tmp_path):
    from src.core.nodemotion.shared import bundled
    project = tmp_path / "project"
    project.mkdir()
    outside = tmp_path / "outside.mp4"
    outside.write_bytes(b"external video must never be selected")
    config = project / "config.json"
    config.write_text(json.dumps({"media": [{"src": "../outside.mp4"},
        {"src": str(outside)}, {"src": "https://invalid/video.mp4"}]}))
    job = Job(input=JobInput(category_name="lyrics-grunge"), artifacts=JobArtifacts(
        output_dir=project, config_json_path=config))
    sources = assets.background_sources(job)
    assert sources and outside not in sources.values()
    # A shared fallback is permitted only when this design registers its exact hash.
    registered = set(bundled.demo_aliases("lyrics-grunge").values())
    for path in sources.values():
        if not path.is_relative_to(project):
            key = bundled.bundled_key_for_path(path)
            assert key is not None and key in registered


@pytest.mark.parametrize("template,config,foreground,subtitle", [
    ("lyrics-expediente", {}, "#EFE6CF", "#E0503E"),
    ("lyrics-manifiesto", {"colors": {"paper": "#F4F2EE", "ink": "#0A0A0A"}}, "#0A0A0A", "#0A0A0A"),
    ("lyrics-collage", {"palette": {"ink": "#17130F", "paperWhite": "#F5EFDD", "red": "#B81F19"}}, "#F5EFDD", "#F5EFDD"),
    ("lyrics-mixtas", {"palette": {"black": "#0B0B0C", "white": "#FFFFFF", "lime": "#BEFF0A"}}, "#FFFFFF", "#BEFF0A"),
    ("lyrics-grunge", {"palette": {"black": "#070707", "white": "#F1F1EF", "red": "#E8292E"}}, "#F1F1EF", "#E8292E"),
])
def test_both_options_use_template_colors_and_fonts(template, config, foreground, subtitle):
    designs = thumbnails._build_designs(template, config)
    for design in designs.values():
        assert design["palette"]["foreground"] == foreground
        assert design["palette"]["subtitle"] == subtitle
        assert design["typography"]["font"]
        assert design["subtitle"] == "LETRAS"
        assert design["background"]["overlay"] == .2
