import json
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.config.niche_config import NicheConfig
from src.core.job import Job, JobArtifacts, JobInput, PlatformCopyText, VideoSummary
from src.core.ports.publisher_port import PublishVideoResult
from src.modules import result_summarizer, social_publisher


@pytest.mark.asyncio
@pytest.mark.parametrize("category", [None, "28"])
async def test_template_category_survives_preparation_for_later_publication(tmp_path, category):
    niche = NicheConfig(id="test", display_name="Test", publishing={"youtube_category_id": category})
    copy = PlatformCopyText(title="Title", description="Description")
    summary = VideoSummary(
        youtube_title="Title", youtube_description="Description", youtube_tags=[],
        tiktok_caption="", tiktok_hashtags=[], platform_copies={"youtube": copy},
    )
    job = Job(input=JobInput(category_name="test"), artifacts=JobArtifacts(summary=summary, log_dir=tmp_path))
    result = await result_summarizer.run(job, MagicMock(), niche)
    assert result.artifacts.summary.youtube_category_id == category
    saved = json.loads((tmp_path / "08_resumen_final.json").read_text())
    assert saved["youtube_category_id"] == category


def test_template_category_requires_a_youtube_numeric_id():
    with pytest.raises(ValueError):
        NicheConfig(id="test", display_name="Test", publishing={"youtube_category_id": "Music"})


@pytest.mark.asyncio
@pytest.mark.parametrize("category", [None, "28"])
async def test_direct_publisher_receives_only_configured_category(tmp_path, monkeypatch, category):
    monkeypatch.setattr(social_publisher.settings, "active_account", "youtube:test")
    video = tmp_path / "video.mp4"
    video.write_bytes(b"fixture")
    summary = VideoSummary(
        youtube_title="Title", youtube_description="Description", youtube_tags=[],
        tiktok_caption="", tiktok_hashtags=[], youtube_category_id=category,
    )
    job = Job(input=JobInput(category_name="test"), artifacts=JobArtifacts(
        summary=summary, output_dir=tmp_path, youtube_video_path=video,
    ))
    facade = MagicMock()
    facade.publish_video = AsyncMock(return_value=PublishVideoResult(
        post_id="test", url="https://example.invalid/test", platform="youtube", account_alias="test",
    ))
    await social_publisher.run(job, facade)
    kwargs = facade.publish_video.await_args.kwargs
    if category is None:
        assert "youtube_category_id" not in kwargs
    else:
        assert kwargs["youtube_category_id"] == category
