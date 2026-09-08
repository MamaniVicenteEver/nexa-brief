"""Base Platform Adapter — shared HTTP client, error mapping and retry logic.

All concrete adapters (TikTok, YouTube, Facebook) extend BasePlatformAdapter.
This ensures uniform:
  - HTTP client configuration (timeout, headers)
  - Error mapping (HTTP status → typed exceptions)
  - Exponential backoff retry decorator
  - Structured logging conventions

Structured log events:
  platform_request_start   — outgoing HTTP request
  platform_request_done    — successful HTTP response
  platform_request_error   — non-2xx or network error
  platform_retry           — retrying after transient failure
"""

from __future__ import annotations

import asyncio
import functools
from pathlib import Path
from typing import Any, Callable

import httpx
import structlog

from src.config.exceptions import (
    PlatformAPIError,
    QuotaExceededError,
    VideoNotFoundError,
)
from src.config.settings import settings
from src.core.ports.publisher_port import PublisherPort, PublishVideoResult, VideoMetadata

logger = structlog.get_logger(__name__)

# Chunk size for resumable uploads (8 MB — optimal for most platforms)
CHUNK_SIZE_BYTES = 8 * 1024 * 1024


# ── Retry decorator ───────────────────────────────────────────────────────────

def with_retry(max_retries: int = 3, backoff_base: float = 2.0, retryable_status: tuple[int, ...] = (429, 500, 502, 503, 504)):
    """Decorator that retries async functions on transient errors.

    Retries on:
      - httpx.TransportError (network failures)
      - PlatformAPIError with a retryable HTTP status code

    Does NOT retry on:
      - 400 Bad Request (client error, won't fix itself)
      - 401 / 403 Unauthorized (token problem, needs refresh first)
      - 404 Not Found
      - 409 Conflict
    """
    def decorator(fn: Callable) -> Callable:
        @functools.wraps(fn)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            platform = getattr(args[0], "PLATFORM", "unknown") if args else "unknown"
            for attempt in range(1, max_retries + 1):
                try:
                    return await fn(*args, **kwargs)
                except (httpx.TransportError, httpx.TimeoutException) as exc:
                    if attempt == max_retries:
                        raise PlatformAPIError(
                            f"Network error after {max_retries} attempts: {exc}",
                            platform=platform,
                        ) from exc
                    backoff = backoff_base ** attempt
                    logger.warning(
                        "platform_retry",
                        platform=platform,
                        attempt=attempt,
                        reason=str(exc),
                        retry_in=backoff,
                    )
                    await asyncio.sleep(backoff)
                except PlatformAPIError as exc:
                    if exc.status_code not in retryable_status or attempt == max_retries:
                        raise
                    backoff = backoff_base ** attempt
                    logger.warning(
                        "platform_retry",
                        platform=platform,
                        attempt=attempt,
                        status_code=exc.status_code,
                        retry_in=backoff,
                    )
                    await asyncio.sleep(backoff)
        return wrapper
    return decorator


# ── Base Adapter ──────────────────────────────────────────────────────────────

class BasePlatformAdapter(PublisherPort):
    """Shared infrastructure for all platform-specific adapters.

    Subclasses must define:
      PLATFORM: str   — e.g. 'youtube'

    And implement the abstract methods from PublisherPort:
      publish(), get_video(), update_video(), delete_video()
    """

    PLATFORM: str = "unknown"

    def __init__(self, token_manager: Any) -> None:  # noqa: ANN401
        self._token_manager = token_manager

    # ── HTTP Client Factory ───────────────────────────────────────────────────

    def _make_client(self, *, upload: bool = False) -> httpx.AsyncClient:
        """Create an httpx.AsyncClient with platform-appropriate timeouts.

        Args:
            upload: If True, uses the longer upload timeout from settings.
        """
        timeout = (
            settings.publisher_upload_timeout_seconds
            if upload
            else settings.api_timeout_seconds
        )
        return httpx.AsyncClient(
            timeout=httpx.Timeout(
                connect=10.0,
                read=timeout,
                write=timeout,
                pool=10.0,
            ),
            follow_redirects=True,
        )

    # ── Error Mapping ─────────────────────────────────────────────────────────

    def _handle_api_error(self, response: httpx.Response, context: str = "") -> None:
        """Map HTTP error responses to typed exceptions.

        Call this after any API response that might indicate failure.
        Raises the appropriate exception based on status code.

        Args:
            response: The httpx Response object.
            context:  Human-readable description of the operation (for logs).
        """
        status = response.status_code
        body = response.text[:500]  # Truncate for logs to avoid noise
        platform = self.PLATFORM

        logger.warning(
            "platform_request_error",
            platform=platform,
            status_code=status,
            context=context,
            body_preview=body,
        )

        if status == 404:
            raise VideoNotFoundError(
                f"[{platform}] {context}: Video not found (404). Body: {body}"
            )
        if status == 429:
            raise QuotaExceededError(
                f"[{platform}] {context}: Rate limit / quota exceeded (429). Body: {body}"
            )
        if status in (401, 403):
            raise PlatformAPIError(
                f"[{platform}] {context}: Auth error ({status}) — token may be invalid. Body: {body}",
                platform=platform,
                status_code=status,
                body=body,
            )
        if status >= 400:
            raise PlatformAPIError(
                f"[{platform}] {context}: API error ({status}). Body: {body}",
                platform=platform,
                status_code=status,
                body=body,
            )

    # ── Chunked file reader ───────────────────────────────────────────────────

    @staticmethod
    def _read_chunks(path: Path, chunk_size: int = CHUNK_SIZE_BYTES):
        """Generator that yields (chunk_bytes, start_offset, total_size) tuples."""
        total = path.stat().st_size
        with open(path, "rb") as fh:
            offset = 0
            while True:
                chunk = fh.read(chunk_size)
                if not chunk:
                    break
                yield chunk, offset, total
                offset += len(chunk)

    # ── Logging helpers ───────────────────────────────────────────────────────

    def _log_request(self, method: str, url: str, **kwargs: Any) -> None:
        logger.debug(
            "platform_request_start",
            platform=self.PLATFORM,
            method=method,
            url=url,
            **kwargs,
        )

    def _log_response(self, method: str, url: str, status: int, elapsed: float, **kwargs: Any) -> None:
        logger.info(
            "platform_request_done",
            platform=self.PLATFORM,
            method=method,
            url=url,
            status_code=status,
            elapsed_seconds=round(elapsed, 3),
            **kwargs,
        )

    # ── Abstract stubs (must be implemented by each platform) ─────────────────

    async def publish(self, video_path: Path, title: str, description: str, tags: list[str], account_alias: str, *, privacy: str = "public") -> PublishVideoResult:  # type: ignore[override]
        raise NotImplementedError

    async def get_video(self, video_id: str, account_alias: str) -> VideoMetadata:  # type: ignore[override]
        raise NotImplementedError

    async def update_video(self, video_id: str, account_alias: str, *, title: str | None = None, description: str | None = None, tags: list[str] | None = None, privacy: str | None = None) -> VideoMetadata:  # type: ignore[override]
        raise NotImplementedError

    async def delete_video(self, video_id: str, account_alias: str) -> bool:  # type: ignore[override]
        raise NotImplementedError
