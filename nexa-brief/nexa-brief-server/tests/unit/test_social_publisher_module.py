"""Unit tests for the social_publisher pipeline module (Stage 9)."""

from __future__ import annotations

import time
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.config.exceptions import PublisherError
from src.core.job import Job, JobInput, JobStage, JobArtifacts, VideoSummary
from src.core.ports.publisher_port import PublishVideoResult
from src.modules import social_publisher


def _make_job(
    tiktok_video: Path | None = None,
    youtube_video: Path | None = None,
    output_dir: Path | None = None,
    summary: VideoSummary | None = None,
) -> Job:
    artifacts = JobArtifacts(
        tiktok_video_path=tiktok_video,
        youtube_video_path=youtube_video,
        output_dir=output_dir,
        summary=summary,
    )
    return Job(
        input=JobInput(category_name="lofi"),
        artifacts=artifacts,
        stage=JobStage.PACKAGED,
    )


@pytest.fixture
def mock_facade():
    facade = MagicMock()
    facade.publish_video = AsyncMock(return_value=PublishVideoResult(
        post_id="test_post_123",
        url="https://www.tiktok.com/@user/video/test_post_123",
        platform="tiktok",
        account_alias="cuenta_1",
    ))
    return facade


@pytest.mark.asyncio
async def test_social_publisher_tiktok_success(tmp_path: Path, mock_facade, monkeypatch):
    """Stage 9 publishes the TikTok video and advances to PUBLISHED."""
    monkeypatch.setattr("src.modules.social_publisher.settings.active_account", "tiktok:cuenta_1")

    # Create a fake video file
    video = tmp_path / "tiktok_video.mp4"
    video.write_bytes(b"fake video bytes")
    logs_dir = tmp_path / "logs"
    logs_dir.mkdir()

    summary = VideoSummary(
        youtube_title="Lofi Beats",
        youtube_description="Chill music for study",
        youtube_tags=["lofi", "study"],
        tiktok_caption="Lofi vibes 🎵 #lofi",
        tiktok_hashtags=["lofi", "study", "chill"],
    )
    job = _make_job(tiktok_video=video, output_dir=tmp_path, summary=summary)

    result_job = await social_publisher.run(job, mock_facade)

    assert result_job.stage == JobStage.PUBLISHED
    assert result_job.artifacts.publish_result is not None
    assert result_job.artifacts.publish_result.post_id == "test_post_123"
    assert result_job.artifacts.publish_result.platform == "tiktok"
    assert (tmp_path / "logs" / "09_publicacion_resultado.json").exists()


@pytest.mark.asyncio
async def test_social_publisher_missing_video_raises(tmp_path: Path, mock_facade, monkeypatch):
    """Raises PublisherError if video file path is missing from artifacts."""
    monkeypatch.setattr("src.modules.social_publisher.settings.active_account", "tiktok:cuenta_1")

    summary = VideoSummary(
        youtube_title="Test",
        youtube_description="Test desc",
        youtube_tags=["test"],
        tiktok_caption="Test",
        tiktok_hashtags=["test"],
    )
    job = _make_job(tiktok_video=None, output_dir=tmp_path, summary=summary)

    with pytest.raises(PublisherError, match="No tiktok video path"):
        await social_publisher.run(job, mock_facade)


@pytest.mark.asyncio
async def test_social_publisher_missing_summary_raises(tmp_path: Path, mock_facade, monkeypatch):
    """Raises PublisherError if summary is not in artifacts."""
    monkeypatch.setattr("src.modules.social_publisher.settings.active_account", "tiktok:cuenta_1")

    video = tmp_path / "tiktok_video.mp4"
    video.write_bytes(b"fake")
    job = _make_job(tiktok_video=video, output_dir=tmp_path, summary=None)

    with pytest.raises(PublisherError, match="summary is None"):
        await social_publisher.run(job, mock_facade)


@pytest.mark.asyncio
async def test_social_publisher_youtube_uses_correct_video(tmp_path: Path, mock_facade, monkeypatch):
    """YouTube platform uses youtube_video_path, not tiktok_video_path."""
    monkeypatch.setattr("src.modules.social_publisher.settings.active_account", "youtube:canal_1")

    youtube_video = tmp_path / "youtube_video.mp4"
    youtube_video.write_bytes(b"fake yt video")
    tiktok_video = tmp_path / "tiktok_video.mp4"
    tiktok_video.write_bytes(b"fake tk video")

    mock_facade.publish_video = AsyncMock(return_value=PublishVideoResult(
        post_id="yt_video_id",
        url="https://www.youtube.com/watch?v=yt_video_id",
        platform="youtube",
        account_alias="canal_1",
    ))

    summary = VideoSummary(
        youtube_title="YouTube Title",
        youtube_description="YouTube Description",
        youtube_tags=["yt", "music"],
        tiktok_caption="TikTok Caption",
        tiktok_hashtags=["tk"],
    )
    job = _make_job(tiktok_video=tiktok_video, youtube_video=youtube_video, output_dir=tmp_path, summary=summary)

    result_job = await social_publisher.run(job, mock_facade)

    # Verify the correct video was passed
    call_args = mock_facade.publish_video.call_args
    assert call_args.kwargs["video_path"] == youtube_video
    assert result_job.stage == JobStage.PUBLISHED


@pytest.mark.asyncio
async def test_social_publisher_multi_platform(tmp_path: Path, mock_facade, monkeypatch):
    """Stage 9 publishes to multiple accounts and collects all results/errors."""
    monkeypatch.setattr(
        "src.modules.social_publisher.settings.active_account",
        "tiktok:cuenta_1, youtube:canal_1, facebook:pagina_1"
    )

    youtube_video = tmp_path / "youtube_video.mp4"
    youtube_video.write_bytes(b"fake yt")
    tiktok_video = tmp_path / "tiktok_video.mp4"
    tiktok_video.write_bytes(b"fake tk")

    # Mock success for tiktok and youtube, failure for facebook
    async def mock_publish(video_path, title, description, tags, account_selector):
        platform, alias = account_selector.split(":", 1)
        if platform == "facebook":
            raise PublisherError("Facebook API offline")
        return PublishVideoResult(
            post_id=f"{platform}_id",
            url=f"https://{platform}.com/{alias}",
            platform=platform,
            account_alias=alias,
        )

    mock_facade.publish_video = AsyncMock(side_effect=mock_publish)

    summary = VideoSummary(
        youtube_title="YT",
        youtube_description="YT desc",
        youtube_tags=[],
        tiktok_caption="TK",
        tiktok_hashtags=[],
    )
    job = _make_job(tiktok_video=tiktok_video, youtube_video=youtube_video, output_dir=tmp_path, summary=summary)

    # Since Facebook fails, the whole run should raise a PublisherError
    with pytest.raises(PublisherError, match="Publishing failed for some platforms"):
        await social_publisher.run(job, mock_facade)

    # But the audit file should still contain the results for success and error for failure
    audit_file = tmp_path / "logs" / "09_publicacion_resultado.json"
    assert audit_file.exists()

