"""TikTok Adapter — CRUD operations via the TikTok Content Posting API v2.

Upload flow (3 steps):
  1. POST /v2/post/publish/video/init/  → get publish_id + upload_url
  2. PUT  {upload_url}                  → upload video bytes (single or chunked)
  3. POST /v2/post/publish/status/fetch/ → poll until PUBLISH_COMPLETE

CRUD:
  Create → publish()        3-step upload above
  Read   → get_video()      POST /v2/post/publish/status/fetch/
  Update → update_video()   NOT SUPPORTED by TikTok API (raises UnsupportedOperationError)
  Delete → delete_video()   POST /v2/video/delete/

Rate limits (2026):
  - Max 20 posts per user per day (standard quota).
  - Upload URLs expire after 15 minutes.

Structured log events:
  tiktok_init_start           — calling /init/ endpoint
  tiktok_init_done            — received publish_id and upload_url
  tiktok_chunk_upload_start   — beginning chunk PUT
  tiktok_chunk_upload_progress — bytes transferred so far
  tiktok_chunk_upload_done    — all bytes uploaded
  tiktok_poll_start           — beginning status polling
  tiktok_poll_status          — current publish status
  tiktok_publish_success      — video is live
  tiktok_delete_start         — calling /video/delete/
  tiktok_delete_success       — video deleted
  tiktok_error                — any non-recoverable error
"""

from __future__ import annotations

import asyncio
import time
from pathlib import Path
from typing import Any

import structlog

from src.config.exceptions import PlatformAPIError, UnsupportedOperationError, VideoNotFoundError
from src.core.ports.publisher_port import PublishVideoResult, VideoMetadata
from src.config.settings import settings
from src.adapters.publishing.base_platform import BasePlatformAdapter, with_retry, CHUNK_SIZE_BYTES

logger = structlog.get_logger(__name__)

_BASE_URL = "https://open.tiktokapis.com/v2"
_POLL_INTERVAL = 5.0   # seconds between status checks
_POLL_MAX_WAIT = 120.0 # seconds before giving up on TikTok processing



# Reglas de chunking de la Content Posting API de TikTok:
#   - chunk_size entre 5 MB y 64 MB (videos < 5 MB van en un único chunk);
#   - total_chunk_count = floor(video_size / chunk_size): el sobrante NO es un
#     chunk aparte, se suma al último (que puede llegar a 128 MB).
# Con ceil() (como el resto de adapters) un video de 29.5 MB en chunks de 8 MB
# declaraba 4 chunks en vez de 3 → 400 "The total chunk count is invalid".
_TIKTOK_MIN_CHUNK = 5 * 1024 * 1024


def _chunk_plan(file_size: int) -> tuple[int, int]:
    """(chunk_size, total_chunk_count) válidos para TikTok."""
    if file_size < _TIKTOK_MIN_CHUNK:
        return file_size, 1
    chunk_size = min(CHUNK_SIZE_BYTES, file_size)
    return chunk_size, max(1, file_size // chunk_size)


def _read_tiktok_chunks(path: Path, file_size: int):
    """Como BasePlatformAdapter._read_chunks, pero el último chunk absorbe el sobrante."""
    chunk_size, count = _chunk_plan(file_size)
    with open(path, "rb") as fh:
        for index in range(count):
            offset = index * chunk_size
            size = chunk_size if index < count - 1 else file_size - offset
            yield fh.read(size), offset, file_size

class TikTokAdapter(BasePlatformAdapter):
    """TikTok Content Posting API v2 — full CRUD implementation."""

    PLATFORM = "tiktok"

    # ── CREATE ────────────────────────────────────────────────────────────────

    @with_retry(max_retries=3)
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
        """Upload a video to TikTok via the 3-step Content Posting API.

        Args:
            video_path:   Absolute path to the TikTok video (9:16, ≤1GB, ≤10min).
            title:        Caption text (max 2200 chars; hashtags appended automatically).
            description:  Not shown publicly on TikTok — stored for internal record.
            tags:         List of hashtag words (without #); appended to the caption.
            account_alias: Key in accounts.json (e.g. 'cuenta_1').
            privacy:      'public' | 'private' | 'friends_only'.

        Returns:
            PublishVideoResult with publish_id as post_id.
        """
        t_start = time.monotonic()
        token = await self._token_manager.get_valid_token(self.PLATFORM, account_alias)
        state = self._token_manager._storage.get_state(self.PLATFORM, account_alias)

        file_size = video_path.stat().st_size
        hashtag_str = " ".join(f"#{t}" for t in tags)
        full_title = f"{title} {hashtag_str}".strip()[:2200]

        privacy_map = {
            "public": "PUBLIC_TO_EVERYONE",
            "private": "SELF_ONLY",
            "friends_only": "MUTUAL_FOLLOW_FRIENDS",
        }
        tiktok_privacy = privacy_map.get(privacy, "PUBLIC_TO_EVERYONE")
        if not settings.tiktok_app_audited:
            # App sin auditar: TikTok solo acepta SELF_ONLY (ver settings.tiktok_app_audited).
            tiktok_privacy = "SELF_ONLY"

        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json; charset=UTF-8",
        }

        # ── Step 1: Initialize upload ─────────────────────────────────────────
        logger.info(
            "tiktok_init_start",
            account=account_alias,
            file=video_path.name,
            file_size_bytes=file_size,
            privacy=tiktok_privacy,
        )

        init_payload = {
            "post_info": {
                "title": full_title,
                "privacy_level": tiktok_privacy,
                "disable_comment": False,
                "disable_duet": False,
                "disable_stitch": False,
                "video_cover_timestamp_ms": 1000,
            },
            "source_info": {
                "source": "FILE_UPLOAD",
                "video_size": file_size,
                "chunk_size": _chunk_plan(file_size)[0],
                "total_chunk_count": _chunk_plan(file_size)[1],
            },
        }

        async with self._make_client() as client:
            self._log_request("POST", f"{_BASE_URL}/post/publish/video/init/")
            t_req = time.monotonic()
            resp = await client.post(
                f"{_BASE_URL}/post/publish/video/init/",
                headers=headers,
                json=init_payload,
            )
            self._log_response("POST", f"{_BASE_URL}/post/publish/video/init/", resp.status_code, time.monotonic() - t_req)

            if resp.status_code != 200:
                self._handle_api_error(resp, "TikTok /init/")

            init_data = resp.json().get("data", {})
            publish_id = init_data.get("publish_id")
            upload_url = init_data.get("upload_url")

            if not publish_id or not upload_url:
                raise PlatformAPIError(
                    f"TikTok /init/ returned unexpected body: {resp.text[:300]}",
                    platform=self.PLATFORM,
                    status_code=resp.status_code,
                )

        logger.info(
            "tiktok_init_done",
            account=account_alias,
            publish_id=publish_id,
        )

        # ── Step 2: Upload video chunks ───────────────────────────────────────
        await self._upload_chunks(video_path, upload_url, file_size, account_alias, publish_id)

        # ── Step 3: Poll for processing status ────────────────────────────────
        final_data = await self._poll_status(token, publish_id, account_alias)
        final_status = final_data.get("status", "PUBLISH_COMPLETE")
        public_ids = final_data.get("publicaly_available_post_id") or []
        video_id = str(public_ids[0]) if public_ids else None

        elapsed = round(time.monotonic() - t_start, 2)
        logger.info(
            "tiktok_publish_success",
            account=account_alias,
            publish_id=publish_id,
            target_id=state.target_id,
            elapsed_seconds=elapsed,
        )

        # target_id es el open_id (no el @usuario), así que no sirve para armar
        # la URL pública: /video/{id} redirige al post. Sin id público (posts
        # privados/"Solo yo", app sin auditar) el único lugar donde verlo es
        # TikTok Studio del dueño de la cuenta.
        return PublishVideoResult(
            post_id=video_id or publish_id,
            url=(
                f"https://www.tiktok.com/@/video/{video_id}"
                if video_id
                else "https://www.tiktok.com/tiktokstudio/content"
            ),
            platform=self.PLATFORM,
            account_alias=account_alias,
            raw_response={"publish_id": publish_id, "video_id": video_id, "status": final_status},
        )

    async def _upload_chunks(
        self, video_path: Path, upload_url: str, file_size: int, account_alias: str, publish_id: str
    ) -> None:
        """Stream the video file to TikTok's upload URL in chunks."""
        logger.info(
            "tiktok_chunk_upload_start",
            account=account_alias,
            publish_id=publish_id,
            file_size_bytes=file_size,
            chunk_size_bytes=_chunk_plan(file_size)[0],
            total_chunk_count=_chunk_plan(file_size)[1],
        )

        async with self._make_client(upload=True) as client:
            for chunk, offset, total in _read_tiktok_chunks(video_path, file_size):
                end = offset + len(chunk) - 1
                headers = {
                    "Content-Type": "video/mp4",
                    "Content-Range": f"bytes {offset}-{end}/{total}",
                    "Content-Length": str(len(chunk)),
                }

                logger.debug(
                    "tiktok_chunk_upload_progress",
                    account=account_alias,
                    publish_id=publish_id,
                    bytes_sent=end + 1,
                    total_bytes=total,
                    percent=round((end + 1) / total * 100, 1),
                )

                resp = await client.put(upload_url, headers=headers, content=chunk)
                if resp.status_code not in (200, 201, 206):
                    self._handle_api_error(resp, f"TikTok chunk upload offset={offset}")

        logger.info(
            "tiktok_chunk_upload_done",
            account=account_alias,
            publish_id=publish_id,
            total_bytes=file_size,
        )

    async def _poll_status(self, token: str, publish_id: str, account_alias: str) -> dict:
        """Poll TikTok's status endpoint until the video is live or fails.

        Devuelve el `data` completo del último status: trae
        `publicaly_available_post_id` (sic, así lo escribe la API) cuando el
        post es público — el id real del video, distinto del publish_id."""
        logger.info("tiktok_poll_start", account=account_alias, publish_id=publish_id)

        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json; charset=UTF-8",
        }

        elapsed = 0.0
        async with self._make_client() as client:
            while elapsed < _POLL_MAX_WAIT:
                await asyncio.sleep(_POLL_INTERVAL)
                elapsed += _POLL_INTERVAL

                resp = await client.post(
                    f"{_BASE_URL}/post/publish/status/fetch/",
                    headers=headers,
                    json={"publish_id": publish_id},
                )
                if resp.status_code != 200:
                    self._handle_api_error(resp, "TikTok status/fetch")

                data = resp.json().get("data", {})
                status = data.get("status", "UNKNOWN")

                logger.info(
                    "tiktok_poll_status",
                    account=account_alias,
                    publish_id=publish_id,
                    status=status,
                    elapsed_seconds=elapsed,
                )

                if status == "PUBLISH_COMPLETE":
                    return data
                if status in ("FAILED", "SPAM", "AUDITING_FAILED"):
                    fail_code = data.get("fail_reason", "unknown")
                    logger.error(
                        "tiktok_error",
                        account=account_alias,
                        publish_id=publish_id,
                        status=status,
                        fail_code=fail_code,
                    )
                    raise PlatformAPIError(
                        f"TikTok publish failed with status {status}: {fail_code}",
                        platform=self.PLATFORM,
                    )

        raise PlatformAPIError(
            f"TikTok publish timed out after {_POLL_MAX_WAIT}s (publish_id={publish_id})",
            platform=self.PLATFORM,
        )

    # ── READ ──────────────────────────────────────────────────────────────────

    @with_retry(max_retries=3)
    async def get_video(self, video_id: str, account_alias: str) -> VideoMetadata:
        """Fetch the current status of a published TikTok video.

        TikTok uses publish_id as the video identifier here.
        """
        token = await self._token_manager.get_valid_token(self.PLATFORM, account_alias)
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json; charset=UTF-8",
        }

        async with self._make_client() as client:
            self._log_request("POST", f"{_BASE_URL}/post/publish/status/fetch/", video_id=video_id)
            t = time.monotonic()
            resp = await client.post(
                f"{_BASE_URL}/post/publish/status/fetch/",
                headers=headers,
                json={"publish_id": video_id},
            )
            self._log_response("POST", f"{_BASE_URL}/post/publish/status/fetch/", resp.status_code, time.monotonic() - t)

        if resp.status_code == 404:
            raise VideoNotFoundError(f"TikTok video/publish_id not found: {video_id}")
        if resp.status_code != 200:
            self._handle_api_error(resp, "TikTok get_video")

        data = resp.json().get("data", {})
        return VideoMetadata(
            video_id=video_id,
            title="",          # TikTok API does not return title in status endpoint
            description="",
            tags=[],
            status=data.get("status", "UNKNOWN"),
            platform=self.PLATFORM,
            raw_response=data,
        )

    # ── UPDATE ────────────────────────────────────────────────────────────────

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
        """TikTok does NOT allow editing video metadata after publishing.

        This method always raises UnsupportedOperationError and logs an
        audit event so the caller has a clear record of the attempt.
        """
        logger.warning(
            "tiktok_update_not_supported",
            account=account_alias,
            video_id=video_id,
            attempted_fields={
                "title": title is not None,
                "description": description is not None,
                "tags": tags is not None,
                "privacy": privacy is not None,
            },
            reason="TikTok Content Posting API does not support post-publish metadata editing",
        )
        raise UnsupportedOperationError(
            "TikTok does not allow editing video title, description, or tags after publishing. "
            "Delete and re-upload if changes are needed."
        )

    # ── DELETE ────────────────────────────────────────────────────────────────

    @with_retry(max_retries=3)
    async def delete_video(self, video_id: str, account_alias: str) -> bool:
        """Delete a published TikTok video.

        Uses POST /v2/video/delete/ with the video_id (not publish_id).
        Note: video_id is the numeric ID visible in the TikTok URL, which is
        different from the publish_id used during upload.
        """
        token = await self._token_manager.get_valid_token(self.PLATFORM, account_alias)
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json; charset=UTF-8",
        }

        logger.info(
            "tiktok_delete_start",
            account=account_alias,
            video_id=video_id,
        )

        async with self._make_client() as client:
            self._log_request("POST", f"{_BASE_URL}/video/delete/", video_id=video_id)
            t = time.monotonic()
            resp = await client.post(
                f"{_BASE_URL}/video/delete/",
                headers=headers,
                json={"video_id": video_id},
            )
            self._log_response("POST", f"{_BASE_URL}/video/delete/", resp.status_code, time.monotonic() - t)

        if resp.status_code == 404:
            raise VideoNotFoundError(f"TikTok video not found for deletion: {video_id}")
        if resp.status_code != 200:
            self._handle_api_error(resp, "TikTok delete_video")

        data = resp.json()
        error = data.get("error", {})
        if error.get("code", "ok") != "ok":
            raise PlatformAPIError(
                f"TikTok delete_video error: {error}",
                platform=self.PLATFORM,
                status_code=resp.status_code,
            )

        logger.info("tiktok_delete_success", account=account_alias, video_id=video_id)
        return True
