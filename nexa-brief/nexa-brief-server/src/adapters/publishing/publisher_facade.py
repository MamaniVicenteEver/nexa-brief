"""Publisher Facade — single entry point for all social-media publishing operations.

This class is the ONLY public interface that the pipeline (Stage 9),
the manual API router, and the scheduler interact with.  It:

  - Initialises TokenStorage, TokenManager, and all platform adapters.
  - Routes publish/CRUD calls to the correct adapter based on the account selector.
  - Emits high-level structured log events (in addition to adapter-level events).
  - Provides list_accounts() for the management API.

Account selector format: "platform:alias" (e.g. "tiktok:cuenta_1", "youtube:canal_2")
This is read from settings.active_account or overridden per-call.

Structured log events (facade level):
  publisher_init              — facade and all adapters initialised
  publisher_publish_start     — publish operation begun
  publisher_publish_success   — publish completed successfully
  publisher_publish_error     — publish failed (exception re-raised)
  publisher_get_video_start   — get_video called
  publisher_update_start      — update_video called
  publisher_delete_start      — delete_video called
  publisher_list_accounts     — accounts listing requested
"""

from __future__ import annotations

import time
from pathlib import Path
from typing import Any, cast

import structlog

from src.config.exceptions import PublisherError
from src.config.settings import settings
from src.core.ports.publisher_port import PublisherPort, PublishVideoResult, VideoMetadata
from src.adapters.publishing.token_storage import TokenStorage
from src.adapters.publishing.token_manager import TokenManager
from src.adapters.publishing.tiktok_adapter import TikTokAdapter
from src.adapters.publishing.youtube_adapter import YouTubeAdapter, YouTubeChannelProfile
from src.adapters.publishing.facebook_adapter import FacebookAdapter
from src.adapters.publishing.instagram_adapter import InstagramAdapter

logger = structlog.get_logger(__name__)

_SUPPORTED_PLATFORMS = ("tiktok", "youtube", "facebook", "instagram")


class PublisherFacade:
    """Unified interface for all social-media publishing operations.

    Usage::

        facade = PublisherFacade()
        result = await facade.publish_video(
            video_path=Path("output/abc/tiktok_video.mp4"),
            title="Cold Lofi Study Beats",
            description="Focus music for deep work...",
            tags=["lofi", "study", "chill"],
            account_selector="tiktok:cuenta_1",
        )
    """

    def __init__(self) -> None:
        storage = TokenStorage(
            path=settings.accounts_json_path,
            encryption_key=settings.publisher_encryption_key,
        )
        self._token_manager = TokenManager(storage)

        self._adapters: dict[str, PublisherPort] = {
            "tiktok": TikTokAdapter(self._token_manager),
            "youtube": YouTubeAdapter(self._token_manager),
            "facebook": FacebookAdapter(self._token_manager),
            "instagram": InstagramAdapter(self._token_manager),
        }

        logger.info(
            "publisher_init",
            accounts_json=str(settings.accounts_json_path),
            platforms=list(self._adapters.keys()),
        )

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _resolve(self, account_selector: str) -> tuple[str, str, PublisherPort]:
        """Parse selector and return (platform, alias, adapter)."""
        if ":" not in account_selector:
            raise PublisherError(
                f"Invalid account_selector '{account_selector}'. "
                f"Use format 'platform:alias' (e.g. 'tiktok:cuenta_1')."
            )
        platform, alias = account_selector.split(":", 1)
        if platform not in _SUPPORTED_PLATFORMS:
            raise PublisherError(
                f"Unknown platform '{platform}'. Supported: {_SUPPORTED_PLATFORMS}"
            )
        adapter = self._adapters[platform]
        return platform, alias, adapter

    # ── CREATE ────────────────────────────────────────────────────────────────

    async def publish_video(
        self,
        video_path: Path,
        title: str,
        description: str,
        tags: list[str],
        account_selector: str | None = None,
        *,
        privacy: str = "public",
        **kwargs: Any,
    ) -> PublishVideoResult:
        """Publish a video to the specified (or active) account.

        Args:
            video_path:       Absolute path to the video file.
            title:            Video title.
            description:      Video description / caption.
            tags:             Tags / hashtags (without #).
            account_selector: "platform:alias" override; defaults to settings.active_account.
            privacy:          'public' | 'private' | 'unlisted' (where supported).
            kwargs:           Platform-specific extra arguments.

        Returns:
            PublishVideoResult with post_id, url, platform, account_alias.
        """
        selector = account_selector or settings.active_account
        platform, alias, adapter = self._resolve(selector)

        logger.info(
            "publisher_publish_start",
            platform=platform,
            account=alias,
            file=video_path.name,
            file_size_bytes=video_path.stat().st_size if video_path.exists() else -1,
            privacy=privacy,
        )
        t_start = time.monotonic()

        try:
            result = await adapter.publish(
                video_path=video_path,
                title=title,
                description=description,
                tags=tags,
                account_alias=alias,
                privacy=privacy,
                **kwargs,
            )
        except Exception as exc:
            logger.error(
                "publisher_publish_error",
                platform=platform,
                account=alias,
                file=video_path.name,
                error=str(exc),
                error_type=type(exc).__name__,
                elapsed_seconds=round(time.monotonic() - t_start, 2),
            )
            raise

        elapsed = round(time.monotonic() - t_start, 2)
        logger.info(
            "publisher_publish_success",
            platform=platform,
            account=alias,
            post_id=result.post_id,
            url=result.url,
            elapsed_seconds=elapsed,
        )
        return result

    # ── READ ──────────────────────────────────────────────────────────────────

    async def get_video(
        self,
        video_id: str,
        account_selector: str | None = None,
    ) -> VideoMetadata:
        """Retrieve metadata for a published video."""
        selector = account_selector or settings.active_account
        platform, alias, adapter = self._resolve(selector)

        logger.info("publisher_get_video_start", platform=platform, account=alias, video_id=video_id)
        return await adapter.get_video(video_id, alias)

    # ── UPDATE ────────────────────────────────────────────────────────────────

    async def update_video(
        self,
        video_id: str,
        account_selector: str | None = None,
        *,
        title: str | None = None,
        description: str | None = None,
        tags: list[str] | None = None,
        privacy: str | None = None,
    ) -> VideoMetadata:
        """Update metadata of a published video."""
        selector = account_selector or settings.active_account
        platform, alias, adapter = self._resolve(selector)

        logger.info(
            "publisher_update_start",
            platform=platform,
            account=alias,
            video_id=video_id,
        )
        return await adapter.update_video(
            video_id, alias,
            title=title, description=description, tags=tags, privacy=privacy,
        )

    # ── DELETE ────────────────────────────────────────────────────────────────

    async def delete_video(
        self,
        video_id: str,
        account_selector: str | None = None,
    ) -> bool:
        """Delete a published video."""
        selector = account_selector or settings.active_account
        platform, alias, adapter = self._resolve(selector)

        logger.info("publisher_delete_start", platform=platform, account=alias, video_id=video_id)
        return await adapter.delete_video(video_id, alias)

    # ── ACCOUNTS ──────────────────────────────────────────────────────────────

    def list_accounts(self) -> list[dict[str, Any]]:
        """Return all configured accounts and their token status (no tokens exposed)."""
        storage = self._token_manager._storage
        accounts = storage.list_accounts()
        logger.info("publisher_list_accounts", total=len(accounts))
        return accounts

    def update_account_metadata(
        self, platform: str, alias: str, *, label: str | None = None, notes: str | None = None
    ) -> bool:
        """Update an account's user-editable label/notes. Returns False if it doesn't exist."""
        return self._token_manager._storage.update_metadata(platform, alias, label=label, notes=notes)

    async def refresh_youtube_profile(self, alias: str) -> dict[str, Any] | None:
        """Refresh public YouTube channel metadata while keeping the internal alias stable."""
        account = next(
            (item for item in self.list_accounts() if item["platform"] == "youtube" and item["alias"] == alias),
            None,
        )
        if account is None:
            return None

        adapter = cast(YouTubeAdapter, self._adapters["youtube"])
        profile: YouTubeChannelProfile | None = await adapter.get_channel_profile(
            alias,
            expected_channel_id=(
                account["target_id"]
                if account.get("target_id") and account["target_id"] != alias
                else None
            ),
        )
        if profile is None:
            return None

        synced_at = time.time()
        saved = self._token_manager._storage.update_channel_profile(
            "youtube",
            alias,
            name=profile.title,
            target_id=profile.channel_id,
            handle=profile.handle,
            description=profile.description,
            custom_url=profile.custom_url,
            avatar=profile.avatar,
            profile_synced_at=synced_at,
        )
        if not saved:
            return None

        logger.info(
            "youtube_channel_profile_refreshed",
            account=alias,
            channel_id=profile.channel_id,
        )
        return {
            "channel_id": profile.channel_id,
            "name": profile.title,
            "handle": profile.handle,
            "description": profile.description,
            "custom_url": profile.custom_url,
            "avatar": profile.avatar,
            "profile_synced_at": synced_at,
        }

    def remove_account(self, platform: str, alias: str) -> bool:
        """Delete a connected account's stored tokens. Returns True if it existed."""
        storage = self._token_manager._storage
        removed = storage.remove_account(platform, alias)
        logger.info("publisher_remove_account", platform=platform, account=alias, removed=removed)
        return removed

    # ── Token refresh (used by scheduler) ────────────────────────────────────

    async def refresh_all_tokens(self) -> dict[str, Any]:
        """Proactively refresh all tokens that are close to expiry.

        Called by the scheduler every 15 minutes.
        Returns a summary of results per account.
        """
        results: dict[str, Any] = {}
        for account_info in self.list_accounts():
            platform = account_info["platform"]
            alias = account_info["alias"]
            key = f"{platform}:{alias}"
            try:
                await self._token_manager.refresh_account_if_needed(platform, alias)
                results[key] = "ok"
            except Exception as exc:
                results[key] = f"error: {exc}"
                logger.error(
                    "publisher_refresh_error",
                    platform=platform,
                    account=alias,
                    error=str(exc),
                )
        return results
