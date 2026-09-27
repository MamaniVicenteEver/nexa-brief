"""Pydantic schemas for the social-media publishing API.

These are the request/response models for the /api/v1/publish router.
"""

from __future__ import annotations

from typing import Any
from pydantic import BaseModel, Field


# ── Request schemas ───────────────────────────────────────────────────────────

class ManualPublishRequest(BaseModel):
    """Request body for POST /api/v1/publish — manual video publish."""

    video_path: str = Field(
        ...,
        description=(
            "Absolute or relative path to the video file to upload. "
            "For TikTok use tiktok_video.mp4; for YouTube/Facebook use youtube_video.mp4."
        ),
        examples=["output/abc12345/tiktok_video.mp4"],
    )
    title: str = Field(
        ...,
        max_length=200,
        description="Video title. Platform-specific limits apply (TikTok: 2200, YouTube: 100).",
    )
    description: str = Field(
        default="",
        max_length=5000,
        description="Video description / caption.",
    )
    tags: list[str] = Field(
        default_factory=list,
        description="Tags or hashtag words WITHOUT the leading '#'.",
        examples=[["lofi", "study", "chill"]],
    )
    account_selector: str = Field(
        default="",
        description=(
            "Account in 'platform:alias' format (e.g. 'tiktok:cuenta_1'). "
            "If empty, uses ACTIVE_ACCOUNT from .env."
        ),
        examples=["youtube:canal_1"],
    )
    privacy: str = Field(
        default="public",
        description="Privacy setting: 'public' | 'private' | 'unlisted' (YouTube) | 'friends_only' (TikTok).",
    )
    facebook_publish_as_reel: bool = Field(
        default=True,
        description="For Facebook, whether to publish as a Reel (vertical 9:16) or standard video."
    )
    youtube_playlist_id: str | None = Field(
        default=None,
        description="For YouTube, optional playlist ID to add the video to after upload."
    )
    youtube_publish_as_short: bool = Field(
        default=False,
        description="For YouTube, whether to append #Shorts to the title and treat it as a Short."
    )


class UpdateVideoRequest(BaseModel):
    """Request body for PUT /api/v1/publish/{platform}/{alias}/{video_id}."""

    title: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    tags: list[str] | None = Field(default=None)
    privacy: str | None = Field(default=None)


# ── Response schemas ──────────────────────────────────────────────────────────

class PublishResponse(BaseModel):
    """Returned after a successful publish operation."""

    post_id: str = Field(description="Platform-assigned video/post ID.")
    url: str = Field(description="Public URL to the published video.")
    platform: str
    account_alias: str
    message: str = "Video published successfully."


class VideoMetadataResponse(BaseModel):
    """Returned by GET and PUT (after update) operations."""

    video_id: str
    title: str
    description: str
    tags: list[str]
    status: str
    platform: str
    raw_response: dict[str, Any] = Field(default_factory=dict)


class AccountStatusResponse(BaseModel):
    """One entry in the GET /api/v1/publish/accounts list."""

    platform: str
    alias: str
    name: str
    target_id: str
    status: str                     # 'ok' | 'requires_reauth'
    expires_in_seconds: float | None
    has_refresh_token: bool
    avatar: str | None = None
    published_count: int = 0        # Videos published to this channel (see data/canales/published_videos.json)
    label: str = ""                 # User-defined purpose, e.g. "Letras románticas"
    notes: str = ""
    connected_at: float | None = None
    last_published_at: float | None = None


class UpdateAccountRequest(BaseModel):
    """Body of PATCH /api/v1/publish/accounts/{platform}/{alias} — omitted fields stay unchanged."""

    label: str | None = Field(default=None, max_length=60)
    notes: str | None = Field(default=None, max_length=500)


class PublishedVideoResponse(BaseModel):
    """One entry in the GET /api/v1/publish/accounts/{platform}/{alias}/videos list."""

    platform: str
    alias: str
    post_id: str
    url: str
    title: str
    published_at: float
    job_id: str | None = None


class DeleteResponse(BaseModel):
    """Returned after a successful delete operation."""

    video_id: str
    platform: str
    account_alias: str
    deleted: bool
    message: str = "Video deleted successfully."


class AccountDeleteResponse(BaseModel):
    """Returned by DELETE /api/v1/publish/accounts/{platform}/{alias}."""

    platform: str
    alias: str
    deleted: bool
    message: str = "Account disconnected successfully."
