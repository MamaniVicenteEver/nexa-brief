from __future__ import annotations

from copy import deepcopy
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from pydantic import ValidationError

from src.core.draft_details import DraftDetails, PlatformDetails, to_summary
from src.core.draft_publishing import publication_destinations
from src.core.drafts import (
    DEFAULT_RECORD_OUTPUTS,
    RenderOptions,
    effective_record_formats,
)
from src.presentation.api.schemas.draft_schema import DraftRenderRequest


def test_outputs_resolve_to_stable_formats_and_keep_legacy_behavior():
    assert effective_record_formats(RenderOptions(outputs=list(DEFAULT_RECORD_OUTPUTS))) == ["16x9", "9x16"]
    assert effective_record_formats(RenderOptions(outputs=["youtube_shorts"])) == ["9x16"]
    assert effective_record_formats(RenderOptions(outputs=["youtube"])) == ["16x9"]
    assert effective_record_formats(RenderOptions()) == ["16x9"]
    assert effective_record_formats(RenderOptions(publish_accounts=["instagram:canal"])) == ["16x9", "9x16"]


def test_draft_render_api_accepts_output_targets_without_changing_legacy_shape():
    request = DraftRenderRequest(outputs=["tiktok", "youtube_shorts"], publish_accounts=[])
    assert request.outputs == ["tiktok", "youtube_shorts"]
    assert effective_record_formats(request) == ["9x16"]
    assert DraftRenderRequest(formats=["9x16"]).outputs is None
    with pytest.raises(ValidationError):
        DraftRenderRequest(outputs=["youtube_short"])


def test_publication_targets_match_selected_platform_and_youtube_account():
    options = RenderOptions(
        outputs=list(DEFAULT_RECORD_OUTPUTS),
        publish_accounts=["tiktok:tt", "instagram:ig", "facebook:fb", "youtube:yt"],
    )
    assert publication_destinations("tiktok:tt", options) == [("tiktok", "9x16")]
    assert publication_destinations("instagram:ig", options) == [("instagram", "9x16")]
    assert publication_destinations("facebook:fb", options) == [("facebook", "16x9")]
    assert publication_destinations("youtube:yt", options) == [
        ("youtube", "16x9"), ("youtube_shorts", "9x16"),
    ]
    short_only = RenderOptions(outputs=["youtube_shorts"])
    assert publication_destinations("youtube:yt", short_only) == [("youtube_shorts", "9x16")]
    assert publication_destinations("instagram:ig", short_only) == []
    assert publication_destinations("youtube:yt", RenderOptions()) == [("youtube", "16x9")]


def test_youtube_shorts_copy_is_distinct_and_legacy_details_migrate():
    details = DraftDetails.model_validate({
        "copies": {
            "youtube": {
                "title": "Una historia breve", "description": "La descripción.",
                "tags": ["canción"], "strategy": "yt_song_truth_v1",
            },
        },
    })
    shorts = details.copies["youtube_shorts"]
    assert shorts.title == "Una historia breve #Shorts"
    assert shorts.description == "La descripción."
    assert shorts.tags == ["canción", "Shorts"]
    assert to_summary(details).platform_copies["youtube_shorts"].title == shorts.title

    edited = DraftDetails(copies={
        "youtube": PlatformDetails(title="Normal"),
        "youtube_shorts": PlatformDetails(title="Edición Shorts", description="Otra descripción", tags=["vertical"]),
    })
    summary = to_summary(edited)
    assert summary.platform_copies["youtube"].title == "Normal"
    assert summary.platform_copies["youtube_shorts"].title == "Edición Shorts"


def test_shorts_copy_caps_title_and_preserves_existing_tag():
    details = DraftDetails(copies={
        "youtube": PlatformDetails(title="x" * 100, tags=["#shorts"]),
    })
    shorts = details.copies["youtube_shorts"]
    assert len(shorts.title) <= 100
    assert shorts.title.endswith("#Shorts")
    assert shorts.tags == ["#shorts"]


@pytest.mark.asyncio
async def test_shorts_only_can_validate_with_vertical_output_and_matching_youtube_account(monkeypatch):
    from src.config.niche_config import get_niche_config
    from src.presentation.api.routers import drafts as router
    from fastapi import HTTPException

    monkeypatch.setattr(router, "_validate_recorder_engine_override", lambda *_args: None)
    monkeypatch.setattr(router, "_validate_publishing", AsyncMock())
    niche = deepcopy(get_niche_config("lyrics_video_caution"))
    options = RenderOptions(
        recorder_engine="playwright", outputs=["youtube_shorts"],
        publish_accounts=["youtube:channel"],
    )
    await router._validate_render_options(niche, options)
    assert effective_record_formats(options) == ["9x16"]

    with pytest.raises(HTTPException) as error:
        await router._validate_render_options(
            niche, RenderOptions(outputs=["youtube_shorts"], publish_accounts=["instagram:channel"]),
        )
    assert error.value.status_code == 400


@pytest.mark.asyncio
async def test_publish_entry_uses_shorts_copy_for_vertical_youtube(tmp_path, monkeypatch):
    from src.core import publish_log
    from src.core.job import PlatformCopyText, VideoSummary
    from src.core.schedule import engine, queue_repository
    from src.core.schedule.models import QueueEntry, QueueSource
    from src.modules import thumbnail_maker

    video = tmp_path / "short.mp4"
    video.write_bytes(b"video")
    entry = QueueEntry(
        entry_id="short-entry", job_id="job", platform="youtube", account_alias="channel",
        format="9x16", source=QueueSource.IMMEDIATE, created_at="now", updated_at="now",
    )
    summary = VideoSummary(
        youtube_title="Normal title", youtube_description="Normal description", youtube_tags=["normal"],
        tiktok_caption="", tiktok_hashtags=[],
        platform_copies={
            "youtube": PlatformCopyText(title="Normal title", description="Normal description", tags=["normal"]),
            "youtube_shorts": PlatformCopyText(title="Short title", description="Short description", tags=["short"]),
        },
    )
    monkeypatch.setattr(queue_repository, "mark_publishing", AsyncMock(return_value=entry))
    monkeypatch.setattr(queue_repository, "mark_published", AsyncMock(return_value=entry))
    monkeypatch.setattr(engine.job_tracker, "get", lambda _job_id: {"file_paths": {"youtube": str(video)}})
    monkeypatch.setattr(engine.job_tracker, "format_paths", lambda _job: {"9x16": str(video)})
    monkeypatch.setattr(engine.job_tracker, "get_summary", lambda _job_id: summary.model_dump())
    monkeypatch.setattr(thumbnail_maker, "ensure_for_job", AsyncMock(return_value=None))
    monkeypatch.setattr(publish_log, "record_published_video", AsyncMock())
    facade = SimpleNamespace(publish_video=AsyncMock(return_value=SimpleNamespace(
        post_id="post", url="https://youtube.test/short", raw_response={},
    )))

    await engine.publish_entry(facade, entry)

    kwargs = facade.publish_video.await_args.kwargs
    assert kwargs["video_path"] == video
    assert kwargs["title"] == "Short title #Shorts"
    assert kwargs["description"] == "Short description"
    assert kwargs["tags"] == ["short"]
    assert kwargs["account_selector"] == "youtube:channel"


@pytest.mark.asyncio
async def test_outputs_without_publish_accounts_do_not_open_publisher(monkeypatch):
    from src.adapters.publishing import factory
    from src.core.draft_publishing import publish_rendered

    def forbidden():
        raise AssertionError("Preparar salidas no debe iniciar publicación")

    monkeypatch.setattr(factory, "get_publisher_facade", forbidden)
    await publish_rendered("fake-job", RenderOptions(outputs=list(DEFAULT_RECORD_OUTPUTS)))


def test_single_thumbnail_readiness_ignores_old_per_destination_copies():
    from src.core.nodemotion.promo import readiness

    shared = {"options": {"A": {"text": "A"}, "B": {"text": "B"}}}
    assert readiness._thumbnails_ready({"thumbnails": shared}, None)
    # Copias por destino guardadas antes del cambio: no cuentan, la miniatura es una sola.
    stale = {"tiktok": {"selected": "A", "options": {"A": {"text": "tiktok"}, "B": {"text": "B"}}}}
    assert readiness._thumbnails_ready({"thumbnails": shared, "thumbnails_by_output": stale}, None)