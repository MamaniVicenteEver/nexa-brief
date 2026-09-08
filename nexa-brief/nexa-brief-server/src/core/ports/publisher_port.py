"""Publisher Port — abstract contract for social-media publishing adapters.

All platform-specific adapters (TikTok, YouTube, Facebook) must implement
this interface.  The pipeline and API layer depend only on this abstraction,
never on concrete platform implementations.

CRUD operations:
  Create → publish()       Upload a video and return its platform ID + URL.
  Read   → get_video()     Fetch current metadata/status of a published video.
  Update → update_video()  Edit title, description or tags of a published video.
  Delete → delete_video()  Remove a published video from the platform.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


# ── Result dataclasses ────────────────────────────────────────────────────────

@dataclass
class PublishVideoResult:
    """Returned by publish() on success."""
    post_id: str                        # Platform-assigned video ID
    url: str                            # Public URL to the video
    platform: str                       # 'tiktok' | 'youtube' | 'facebook'
    account_alias: str                  # e.g. 'cuenta_1'
    raw_response: dict[str, Any] = field(default_factory=dict)  # Full API response for audit


@dataclass
class VideoMetadata:
    """Returned by get_video() — normalised across all platforms."""
    video_id: str
    title: str
    description: str
    tags: list[str]
    status: str                         # e.g. 'public', 'processing', 'failed'
    platform: str
    raw_response: dict[str, Any] = field(default_factory=dict)


# ── Abstract Port ─────────────────────────────────────────────────────────────

class PublisherPort(ABC):
    """Abstract interface every social-media publishing adapter must satisfy.

    Usage::

        adapter: PublisherPort = YouTubeAdapter(settings, token_manager)
        result = await adapter.publish(path, title, description, tags, alias)

    All methods must raise subclasses of PublisherError (defined in
    src/config/exceptions.py) on failure, never raw platform exceptions.
    """

    # ── CREATE ────────────────────────────────────────────────────────────────

    @abstractmethod
    async def publish(
        self,
        video_path: Path,
        title: str,
        description: str,
        tags: list[str],
        account_alias: str,
        *,
        privacy: str = "public",
        **kwargs: Any,
    ) -> PublishVideoResult:
        """Upload *video_path* to the platform under the given account.

        Args:
            video_path:    Absolute path to the video file.
            title:         Video title (platform-specific max lengths apply).
            description:   Video description / caption.
            tags:          List of tags / hashtags (without leading #).
            account_alias: Alias key in accounts.json (e.g. 'cuenta_1').
            privacy:       'public' | 'private' | 'unlisted' (where supported).

        Returns:
            PublishVideoResult with post_id and public URL.

        Raises:
            TokenExpiredError: Token is expired and cannot be refreshed.
            PlatformAPIError:  Platform returned a non-2xx response.
            QuotaExceededError: Daily quota limit reached (YouTube).
        """

    # ── READ ──────────────────────────────────────────────────────────────────

    @abstractmethod
    async def get_video(
        self,
        video_id: str,
        account_alias: str,
    ) -> VideoMetadata:
        """Retrieve current metadata and status for a published video.

        Raises:
            VideoNotFoundError: The video_id does not exist on the platform.
            PlatformAPIError:   API returned an unexpected error.
        """

    # ── UPDATE ────────────────────────────────────────────────────────────────

    @abstractmethod
    async def update_video(
        self,
        video_id: str,
        account_alias: str,
        *,
        title: str | None = None,
        description: str | None = None,
        tags: list[str] | None = None,
        privacy: str | None = None,
    ) -> VideoMetadata:
        """Update mutable metadata fields of a published video.

        Only non-None arguments are updated.  Platforms that do not support
        a given field must raise UnsupportedOperationError with a clear message.

        Raises:
            VideoNotFoundError:      Video does not exist.
            UnsupportedOperationError: Platform does not allow this edit.
            PlatformAPIError:        API returned an unexpected error.
        """

    # ── DELETE ────────────────────────────────────────────────────────────────

    @abstractmethod
    async def delete_video(
        self,
        video_id: str,
        account_alias: str,
    ) -> bool:
        """Delete the published video from the platform.

        Returns:
            True if the video was deleted successfully.

        Raises:
            VideoNotFoundError: The video_id does not exist.
            PlatformAPIError:   API returned an unexpected error.
        """
