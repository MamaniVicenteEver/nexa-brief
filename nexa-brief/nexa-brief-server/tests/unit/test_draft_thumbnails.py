from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw
import pytest

from src.core import draft_thumbnails as thumbs, drafts
from src.core.draft_details import DraftDetails, apply_to_intro
from src.core.job import Job, JobArtifacts, JobInput, JobStage


def sample_job(tmp_path: Path) -> Job:
    output = tmp_path / "production"
    assets = output / "assets"
    (assets / "components").mkdir(parents=True)
    (output / "index.html").write_text("<html><body>Native intro</body></html>")
    (assets / "config.json").write_text(json.dumps({"intro": {"title": "Demo"}, "colors": {"ink": "#B31730"}}))
    (assets / "components/intro.js").write_text('window.NexaTemplateIntro = {apply(config) {return {...config,title:"Demo"};}};')
    return Job(input=JobInput(category_name="lyrics_video_caution"), stage=JobStage.HTML_GENERATED,
               artifacts=JobArtifacts(output_dir=output, assets_dir=assets, html_path=output / "index.html"))


def test_typography_variant_keeps_colours_timing_and_media():
    original = {"configs": [{"intro": {"title": "Demo"}, "colors": {"paper": "#eeaa22"},
        "fonts": {"googleUrl": "https://fonts.example", "display": "Anton", "alt": "Archivo"}, "audio": {"src": "song.mp3"}, "timing": {"leadSec": .4}}]}
    details = DraftDetails(song_name="Dueles Tan Bien", artist="Bruses")
    a, b = (thumbs.variant_config(original, option, details)["configs"][0] for option in ("A", "B"))
    assert a["colors"] == b["colors"] == original["configs"][0]["colors"]
    assert a["intro"] == b["intro"] == {"title": "Dueles Tan Bien", "artist": "Bruses"}
    assert a["fonts"]["display"] != b["fonts"]["display"]
    assert b["fonts"]["googleUrl"] == a["fonts"]["googleUrl"]
    assert a["audio"] == b["audio"] and a["timing"] == b["timing"]
    assert original["configs"][0]["intro"]["title"] == "Demo"


@pytest.mark.asyncio
async def test_prepare_caches_two_images_and_selection_reaches_recording(tmp_path, monkeypatch):
    job = sample_job(tmp_path)
    capture_calls = []
    async def capture(_job, _details, targets):
        capture_calls.append(targets)
        for path in targets.values():
            image = Image.new("RGB", (1280, 720), "#B31730")
            ImageDraw.Draw(image).rectangle((100, 100, 900, 300), fill="white")
            image.save(path)
    monkeypatch.setattr(thumbs, "_capture", capture)
    draft = await drafts.create(template_id="lyrics-caution", niche_id="lyrics_video_caution", inputs=drafts.DraftInputs(), job=job)
    drafts._running.discard(draft.draft_id)
    await drafts._patch(draft.draft_id, {"status": "preview_ready"})
    details = DraftDetails(song_name="New song", artist="Singer")
    prepared = await drafts.save_details(draft.draft_id, details)
    assert prepared.thumbnails.selected == "A"
    assert set(prepared.thumbnails.urls) == {"A", "B"}
    chosen = await drafts.select_thumbnail(prepared, "B")
    assert chosen.thumbnails.selected == "B"
    saved = drafts.load_job(draft.draft_id)
    assert saved.artifacts.thumbnail_path == thumbs.image_path(job, chosen.thumbnails, "B")
    assert drafts.apply_render_options(saved, drafts.RenderOptions()).artifacts.thumbnail_path == saved.artifacts.thumbnail_path
    assert saved.artifacts.thumbnail_path.is_file()
    again = await drafts.save_details(draft.draft_id, details)
    assert again.thumbnails.selected == "B" and len(capture_calls) == 1
    log = json.loads((job.artifacts.output_dir / "logs/09_prepared_thumbnails.json").read_text())
    assert log["total_tokens"] == 0 and log["renderer"] == "native_template_intro"
    # A different title invalidates files and the cached selection follows the new pair.
    changed = await drafts.save_details(draft.draft_id, details.model_copy(update={"song_name": "Changed song"}))
    assert changed.thumbnails.fingerprint != again.thumbnails.fingerprint
    assert changed.thumbnails.selected == "B" and len(capture_calls) == 2


@pytest.mark.asyncio
async def test_failed_capture_clears_stale_artifact_and_partial_files(tmp_path, monkeypatch):
    job = sample_job(tmp_path)
    async def broken(_job, _details, targets):
        for path in targets.values():
            path.write_bytes(b"incomplete")
        raise RuntimeError("capture failed")
    monkeypatch.setattr(thumbs, "_capture", broken)
    draft = await drafts.create(template_id="lyrics-caution", niche_id="lyrics_video_caution", inputs=drafts.DraftInputs(), job=job)
    drafts._running.discard(draft.draft_id)
    await drafts._patch(draft.draft_id, {"status": "preview_ready"})
    result = await drafts.save_details(draft.draft_id, DraftDetails(song_name="My song"))
    assert result.status == "prepared" and result.details.song_name == "My song"
    assert result.thumbnails is None and "capture failed" in result.thumbnail_error
    assert not list(thumbs.directory(job).glob("*.pending.jpg"))
    assert not drafts.is_running(draft.draft_id)
    assert drafts.load_job(draft.draft_id).artifacts.thumbnail_path is None


def test_config_intro_override_is_local_and_idempotent(tmp_path):
    job = sample_job(tmp_path)
    details = DraftDetails(song_name="My song", artist="My artist")
    apply_to_intro(job.artifacts.content_dir, details)
    source = (job.artifacts.content_dir / "components/intro.js").read_text()
    assert "title: config?.title || result.title" in source
    apply_to_intro(job.artifacts.content_dir, details)
    assert (job.artifacts.content_dir / "components/intro.js").read_text() == source


def test_invalid_fingerprint_cannot_escape_thumbnail_directory(tmp_path):
    job = sample_job(tmp_path)
    with pytest.raises(ValueError):
        thumbs.image_path(job, thumbs.ThumbnailSet(fingerprint="../../outside"), "A")


@pytest.mark.asyncio
async def test_details_api_returns_before_waiting_for_capture(tmp_path, monkeypatch, api_client):
    from src.presentation.api.routers import drafts as router
    from unittest.mock import AsyncMock
    job = sample_job(tmp_path)
    draft = await drafts.create(template_id="lyrics-caution", niche_id="lyrics_video_caution", inputs=drafts.DraftInputs(), job=job)
    drafts._running.discard(draft.draft_id)
    await drafts._patch(draft.draft_id, {
        "status": "prepared", "details": DraftDetails(song_name="Old").model_dump(),
        "thumbnails": thumbs.ThumbnailSet(fingerprint="0" * 20, selected="B", urls={"A": "/old-a", "B": "/old-b"}).model_dump(),
    })
    capture = AsyncMock(side_effect=AssertionError("HTTP must not wait for capture"))
    monkeypatch.setattr(thumbs, "prepare", capture)
    tasks = []
    def queued(coro):
        tasks.append(coro.cr_code.co_name)
        coro.close()
    monkeypatch.setattr(router, "_spawn", queued)
    response = await api_client.put(f"/api/v1/drafts/{draft.draft_id}/details", json={"song_name": "New"})
    assert response.status_code == 200
    assert response.json()["status"] == "preparing"
    assert response.json()["details"]["song_name"] == "New"
    assert response.json()["thumbnails"]["selected"] == "B"
    assert drafts.load_job(draft.draft_id).artifacts.thumbnail_path is None
    assert tasks == ["run_thumbnails"] and capture.await_count == 0
    drafts._running.discard(draft.draft_id)


def test_non_lyric_template_uses_prepared_title_when_song_is_empty(tmp_path):
    from src.core.draft_details import PlatformDetails
    job = sample_job(tmp_path)
    details = DraftDetails(copies={"youtube": PlatformDetails(title="Seguí de pie")})
    assert thumbs.title_of(job, details) == "Seguí de pie"
    changed = details.model_copy(update={"copies": {"youtube": PlatformDetails(title="Nueva opción")}})
    assert thumbs.fingerprint(job, details) != thumbs.fingerprint(job, changed)
    assert thumbs.title_of(job, DraftDetails(song_name="Song", copies=details.copies)) == "Song"
