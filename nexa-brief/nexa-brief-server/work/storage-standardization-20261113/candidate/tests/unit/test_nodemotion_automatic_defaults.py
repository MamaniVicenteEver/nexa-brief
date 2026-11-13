"""Backend thumbnail defaults and recording handoff without a browser or external services."""
from __future__ import annotations

import asyncio
import json
from pathlib import Path

import pytest

from src.core import draft_details, draft_thumbnails, drafts
from src.core.draft_details import DraftDetails
from src.core.job import Job, JobArtifacts, JobInput, JobStage


@pytest.fixture
def job(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Job:
    # The files only establish which types of background are available; no media is decoded.
    image, video = tmp_path / "background.jpg", tmp_path / "background.mp4"
    image.write_bytes(b"image")
    video.write_bytes(b"video")
    config = tmp_path / "config.json"
    config.write_text(json.dumps({"intro": {"title": "Original"}}), encoding="utf-8")
    html = tmp_path / "index.html"
    html.write_text("<html></html>", encoding="utf-8")
    monkeypatch.setattr(draft_thumbnails, "_template_id", lambda _job: "lyrics-neon")
    return Job(
        input=JobInput(category_name="lyrics_video_neon"),
        stage=JobStage.HTML_GENERATED,
        artifacts=JobArtifacts(
            assets_dir=tmp_path, output_dir=tmp_path, html_path=html,
            config_json_path=config, image_path=image, video_path=video,
            lyrics_json={"segments": [{"text": "Sin ti nunca voy a olvidar este amor"}]},
        ),
    )


def test_defaults_exist_without_preview_and_use_a_real_lyric(job: Job):
    details = DraftDetails(song_name="Una canción de nombre muy largo", artist="Alguien")
    manifest = draft_thumbnails.preview_manifest(job, details)

    assert manifest["selected"] == "A"
    assert manifest["options"]["A"]["text"] == "Una canción de nombre muy"
    assert manifest["options"]["B"]["text"] == "Sin ti nunca voy a olvidar este amor"
    for option in ("A", "B"):
        design = manifest["options"][option]["design"]
        assert design["subtitle"] == "LETRAS"
        assert design["background"]["kind"] == "frame"
        assert design["background"]["overlay"] == pytest.approx(.2)
        assert set(design["background"]["availableSources"]) == {"image", "video"}
        assert design["background"]["sourceKind"] == "video"
    assert not (job.artifacts.content_dir / "thumbnails").exists()


def test_no_lyric_does_not_invent_an_alternate(job: Job):
    job.artifacts.lyrics_json = {"segments": []}
    manifest = draft_thumbnails.preview_manifest(job, DraftDetails(song_name="Hola Remix"))
    assert manifest["options"]["A"]["text"] == "Hola Remix"
    assert manifest["options"]["B"]["text"] == "Hola Remix"


@pytest.mark.parametrize("selected", ["A", "B"])
def test_recording_captures_the_persisted_choice_and_background(
    job: Job, tmp_path: Path, monkeypatch: pytest.MonkeyPatch, selected: str,
):
    details = DraftDetails(song_name="Hola Remix", artist="Artista")
    options = draft_thumbnails.preview_manifest(job, details)["options"]
    background = options[selected]["design"]["background"]
    background.update(mediaSource="image", kind="frame", overlay=.35, overlayMode="manual", x=0)
    options[selected]["text"] = "Texto elegido"
    manifest = draft_thumbnails.preview_manifest(job, details, options)
    manifest["selected"] = selected
    draft = drafts.Draft(
        draft_id="test", template_id="lyrics-neon", niche_id="lyrics_video_neon",
        created_at="2026-01-01T00:00:00Z", updated_at="2026-01-01T00:00:00Z",
        details=details, thumbnails=draft_thumbnails.ThumbnailSet.model_validate(manifest),
    )
    calls = []

    async def get_draft(_draft_id):
        return draft

    async def capture(_draft_id, _job, _details, option, options=None):
        calls.append((option, options[option]))
        result = tmp_path / "chosen.jpg"
        result.write_bytes(b"mock jpeg")
        return result

    async def patch(_draft_id, _data):
        return draft

    monkeypatch.setattr(drafts, "get", get_draft)
    monkeypatch.setattr(drafts, "_patch", patch)
    monkeypatch.setattr(drafts, "_save_job", lambda *_args: None)
    monkeypatch.setattr(draft_details, "apply_to_intro", lambda *_args: None)
    monkeypatch.setattr(draft_thumbnails, "capture_selected", capture)

    captured_job = asyncio.run(drafts._capture_selected_thumbnail("test", job))
    assert captured_job.artifacts.thumbnail_path == tmp_path / "chosen.jpg"
    assert len(calls) == 1 and calls[0][0] == selected
    actual = calls[0][1]
    assert actual["text"] == "Texto elegido"
    assert actual["design"]["background"]["mediaSource"] == "image"
    assert actual["design"]["background"]["overlay"] == pytest.approx(.35)
    assert actual["design"]["background"]["x"] == 0
