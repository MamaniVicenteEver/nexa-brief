"""Facebook Adapter — CRUD operations via the configured Meta Graph API version.

Upload flow (Resumable 3-phase protocol):
  Phase 1 — start:    POST /{page-id}/videos?upload_phase=start&file_size={n}
                      → receives upload_session_id + start_offset + end_offset
  Phase 2 — transfer: POST /{page-id}/videos?upload_phase=transfer&upload_session_id=...
                      Multipart body with 'video_file_chunk' field
                      → receives new start_offset (continue until == file_size)
  Phase 3 — finish:   POST /{page-id}/videos?upload_phase=finish&upload_session_id=...
                      With title, description → receives video_id

CRUD:
  Create → publish()       3-phase upload above
  Read   → get_video()     GET /{video_id}?fields=title,description,status
  Update → update_video()  POST /{video_id} with title/description
  Delete → delete_video()  DELETE /{video_id}

Token strategy:
  Facebook Page Access Tokens never expire when derived from a Long-Lived User Token.
  The token_manager's _refresh_facebook() is a deliberate no-op.

Structured log events:
  fb_upload_start              — calling phase 1 /start
  fb_session_id_obtained       — upload_session_id received
  fb_chunk_transfer            — transferring a chunk in phase 2
  fb_transfer_progress         — bytes transferred so far
  fb_finish_start              — calling phase 3 /finish
  fb_publish_success           — video_id confirmed
  fb_get_video_start           — fetching video metadata
  fb_update_start              — patching video metadata
  fb_update_done               — metadata patched
  fb_delete_start              — calling DELETE
  fb_delete_success            — video removed
  fb_error                     — non-recoverable API error
"""

from __future__ import annotations

import time
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import quote

import structlog

from src.config.exceptions import PlatformAPIError, VideoNotFoundError
from src.config.settings import settings
from src.core.ports.channel_catalog_port import ChannelCatalogPort, ChannelStats, RemoteVideo
from src.core.ports.publisher_port import PublishVideoResult, VideoMetadata
from src.adapters.publishing.base_platform import BasePlatformAdapter, with_retry

logger = structlog.get_logger(__name__)

_GRAPH_BASE = f"https://graph.facebook.com/{settings.meta_graph_api_version}"
_FB_CHUNK_SIZE = 4 * 1024 * 1024  # Facebook recommends 4 MB chunks in phase 2


def _optional_int(value: Any) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _optional_float(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _timestamp(value: str | None) -> float:
    if not value:
        return 0.0
    try:
        normalized = value.replace("Z", "+00:00")
        if len(normalized) >= 5 and normalized[-5] in "+-" and normalized[-4:].isdigit():
            normalized = f"{normalized[:-2]}:{normalized[-2:]}"
        return datetime.fromisoformat(normalized).timestamp()
    except (TypeError, ValueError):
        return 0.0


def _facebook_remote_video(item: dict[str, Any], *, kind: str = "video") -> RemoteVideo:
    post_id = str(item.get("id") or "")
    description = str(item.get("description") or "")
    title = str(item.get("title") or "").strip()
    if not title and description:
        title = description.splitlines()[0].strip()
    # Graph devuelve permalink_url relativo ("/reel/123/") en reels y videos de página.
    permalink = str(item.get("permalink_url") or f"/{post_id}")
    return RemoteVideo(
        post_id=post_id,
        url=permalink if permalink.startswith("http") else f"https://www.facebook.com/{permalink.lstrip('/')}",
        title=title,
        published_at=_timestamp(item.get("created_time")),
        privacy="public",
        duration_seconds=_optional_float(item.get("length")),
        thumbnail_url=item.get("picture") or None,
        # Facebook does not return these without additional permissions/fields.
        views=None,
        likes=None,
        comments=None,
        kind=kind,
    )


class FacebookAdapter(BasePlatformAdapter, ChannelCatalogPort):
    """Facebook Graph API — full CRUD with 3-phase resumable upload."""

    PLATFORM = "facebook"

    def __init__(self, token_manager: Any) -> None:
        super().__init__(token_manager)
        # list_channel_videos() immediately precedes get_channel_stats() in a sync. Reuse its
        # complete, deduplicated count so a sync doesn't fetch the same catalog twice.
        self._catalog_video_counts: dict[str, int] = {}

    async def _catalog_get_json(
        self, path: str, params: dict[str, Any], account_alias: str, purpose: str
    ) -> dict[str, Any]:
        token = await self._token_manager.get_valid_token(self.PLATFORM, account_alias)
        url = f"{_GRAPH_BASE}/{path.lstrip('/')}"
        self._log_request("GET", url, account=account_alias, purpose=purpose)
        started = time.monotonic()
        async with self._make_client() as client:
            response = await client.get(url, params={**params, "access_token": token})
            self._log_response("GET", url, response.status_code, time.monotonic() - started, account=account_alias)
        if response.status_code != 200:
            self._handle_api_error(response, f"Facebook {purpose}")
        return response.json()

    async def _catalog_get_next(
        self, url: str, account_alias: str, purpose: str
    ) -> dict[str, Any]:
        # Graph's paging.next URL already carries the paging cursor and access token. Keep it
        # out of request logs because it is a credential-bearing URL.
        self._log_request("GET", "Facebook Graph paging.next", account=account_alias, purpose=purpose)
        started = time.monotonic()
        async with self._make_client() as client:
            response = await client.get(url)
            self._log_response(
                "GET", "Facebook Graph paging.next", response.status_code,
                time.monotonic() - started, account=account_alias,
            )
        if response.status_code != 200:
            self._handle_api_error(response, f"Facebook {purpose}")
        return response.json()

    async def _list_video_edge(
        self,
        path: str,
        account_alias: str,
        *,
        purpose: str,
        params: dict[str, Any] | None = None,
        kind: str = "video",
        limit: int | None = None,
    ) -> list[RemoteVideo]:
        page = await self._catalog_get_json(
            path,
            {"fields": "id,title,description,created_time,permalink_url,length,picture", **(params or {})},
            account_alias,
            purpose,
        )
        videos: list[RemoteVideo] = []
        while True:
            videos.extend(
                _facebook_remote_video(item, kind=kind)
                for item in page.get("data", [])
                if item.get("id")
            )
            if limit is not None and len(videos) >= limit:
                return videos[:limit]
            next_url = (page.get("paging") or {}).get("next")
            if not next_url:
                return videos
            page = await self._catalog_get_next(next_url, account_alias, purpose)

    @with_retry(max_retries=3)
    async def list_channel_videos(
        self, account_alias: str, *, limit: int | None = None
    ) -> list[RemoteVideo]:
        self._catalog_video_counts.pop(account_alias, None)
        page_id = self._token_manager.target_id(self.PLATFORM, account_alias)
        if not page_id:
            raise PlatformAPIError(
                "Facebook account has no Page ID. Reconnect it from Canales.",
                platform=self.PLATFORM,
                status_code=400,
            )

        regular = await self._list_video_edge(
            f"{quote(page_id, safe='')}/videos", account_alias,
            purpose="page_videos", params={"type": "uploaded"}, limit=limit,
        )
        reels = await self._list_video_edge(
            f"{quote(page_id, safe='')}/video_reels", account_alias,
            purpose="page_video_reels", kind="reel", limit=limit,
        )

        # A Reel may appear in both Page edges. Keep the explicit reel form and sort newest first.
        by_id: dict[str, RemoteVideo] = {video.post_id: video for video in regular}
        for video in reels:
            by_id[video.post_id] = video
        videos = sorted(by_id.values(), key=lambda video: video.published_at, reverse=True)
        if limit is not None:
            videos = videos[:limit]
        else:
            self._catalog_video_counts[account_alias] = len(videos)
        return videos

    @with_retry(max_retries=3)
    async def get_channel_stats(self, account_alias: str) -> ChannelStats:
        page_id = self._token_manager.target_id(self.PLATFORM, account_alias)
        if not page_id:
            raise PlatformAPIError(
                "Facebook account has no Page ID. Reconnect it from Canales.",
                platform=self.PLATFORM,
                status_code=400,
            )
        data = await self._catalog_get_json(
            quote(page_id, safe=""),
            {"fields": "followers_count,fan_count"},
            account_alias,
            "page_stats",
        )
        video_count = self._catalog_video_counts.pop(account_alias, None)
        if video_count is None:
            video_count = len(await self.list_channel_videos(account_alias))
            self._catalog_video_counts.pop(account_alias, None)
        return ChannelStats(
            video_count=video_count,
            followers=_optional_int(data.get("followers_count"))
            if data.get("followers_count") is not None
            else _optional_int(data.get("fan_count")),
        )

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
        """Upload a video to a Facebook Page via the 3-phase resumable protocol.

        Args:
            video_path:   Absolute path to the video file (≤10GB, ≤4h).
            title:        Post title (shown in the feed).
            description:  Post description / caption.
            tags:         Tags are appended as hashtags to the description.
            account_alias: Key in accounts.json (e.g. 'pagina_1').
            privacy:      'public' | 'friends' | 'only_me' (Facebook privacy strings).

        Returns:
            PublishVideoResult with Facebook video_id and page video URL.
        """
        t_start = time.monotonic()
        token = await self._token_manager.get_valid_token(self.PLATFORM, account_alias)
        state = self._token_manager._storage.get_state(self.PLATFORM, account_alias)
        page_id = state.target_id

        file_size = video_path.stat().st_size
        hashtags = " ".join(f"#{t}" for t in tags)

        publish_as_reel = kwargs.get("publish_as_reel", False)

        if publish_as_reel:
            full_description = f"{title}\n\n{description}\n\n{hashtags}".strip()
            logger.info(
                "fb_reel_upload_start",
                account=account_alias,
                page_id=page_id,
                file=video_path.name,
                file_size_mb=round(file_size / 1_048_576, 2),
            )

            video_id, upload_url = await self._reel_phase_start(token, page_id, account_alias)
            await self._reel_phase_transfer(token, upload_url, video_path, file_size, account_alias)
            published_id = await self._reel_phase_finish(token, page_id, video_id, full_description, account_alias)

            elapsed = round(time.monotonic() - t_start, 2)
            logger.info(
                "fb_reel_publish_success",
                account=account_alias,
                page_id=page_id,
                video_id=published_id,
                url=f"https://www.facebook.com/{page_id}/reels/{published_id}",
                elapsed_seconds=elapsed,
            )

            return PublishVideoResult(
                post_id=published_id,
                url=f"https://www.facebook.com/{page_id}/reels/{published_id}",
                platform=self.PLATFORM,
                account_alias=account_alias,
                raw_response={"video_id": published_id, "page_id": page_id, "format": "reel"},
            )
        else:
            full_description = f"{description}\n\n{hashtags}".strip()

            logger.info(
                "fb_upload_start",
                account=account_alias,
                page_id=page_id,
                file=video_path.name,
                file_size_mb=round(file_size / 1_048_576, 2),
            )

            # ── Phase 1: Start upload session ─────────────────────────────────────
            upload_session_id, start_offset, end_offset, start_video_id = await self._phase_start(
                token=token, page_id=page_id, file_size=file_size, account_alias=account_alias
            )

            # ── Phase 2: Transfer chunks ──────────────────────────────────────────
            await self._phase_transfer(
                token=token,
                page_id=page_id,
                video_path=video_path,
                file_size=file_size,
                upload_session_id=upload_session_id,
                start_offset=start_offset,
                account_alias=account_alias,
            )

            # ── Phase 3: Finish and publish ───────────────────────────────────────
            video_id = await self._phase_finish(
                token=token,
                page_id=page_id,
                upload_session_id=upload_session_id,
                title=title,
                description=full_description,
                account_alias=account_alias,
                fallback_video_id=start_video_id,
            )

            elapsed = round(time.monotonic() - t_start, 2)
            logger.info(
                "fb_publish_success",
                account=account_alias,
                page_id=page_id,
                video_id=video_id,
                url=f"https://www.facebook.com/{page_id}/videos/{video_id}",
                elapsed_seconds=elapsed,
            )

            return PublishVideoResult(
                post_id=video_id,
                url=f"https://www.facebook.com/{page_id}/videos/{video_id}",
                platform=self.PLATFORM,
                account_alias=account_alias,
                raw_response={"video_id": video_id, "page_id": page_id},
            )

    async def _reel_phase_start(self, token: str, page_id: str, account_alias: str) -> tuple[str, str]:
        """Phase 1 for Reels: Initialize the Reel upload session."""
        url = f"{_GRAPH_BASE}/{page_id}/video_reels"
        params = {
            "upload_phase": "start",
            "access_token": token,
        }
        self._log_request("POST", url, phase="reel_start")
        t = time.monotonic()
        async with self._make_client() as client:
            resp = await client.post(url, params=params)
            self._log_response("POST", url, resp.status_code, time.monotonic() - t)

        if resp.status_code != 200:
            self._handle_api_error(resp, "Facebook Reel upload phase=start")

        data = resp.json()
        video_id = data.get("video_id")
        upload_url = data.get("upload_url")
        if not video_id or not upload_url:
            raise PlatformAPIError(
                f"Facebook Reel start response missing video_id or upload_url: {resp.text[:200]}",
                platform=self.PLATFORM,
                status_code=resp.status_code,
            )
        return video_id, upload_url

    async def _reel_phase_transfer(self, token: str, upload_url: str, video_path: Path, file_size: int, account_alias: str) -> None:
        """Phase 2 for Reels: Upload the entire video file binary."""
        headers = {
            "Authorization": f"OAuth {token}",
            "offset": "0",
            "file_size": str(file_size),
            "Content-Type": "video/mp4",
        }
        logger.info("fb_reel_transfer_start", account=account_alias, file_size_mb=round(file_size / 1_048_576, 2))
        t = time.monotonic()
        async with self._make_client(upload=True) as client:
            with open(video_path, "rb") as f:
                content = f.read()
                resp = await client.post(upload_url, headers=headers, content=content)

        if resp.status_code != 200:
            self._handle_api_error(resp, "Facebook Reel transfer")
        logger.info("fb_reel_transfer_done", account=account_alias, elapsed_seconds=round(time.monotonic() - t, 2))

    async def _reel_phase_finish(self, token: str, page_id: str, video_id: str, description: str, account_alias: str) -> str:
        """Phase 3 for Reels: Finalize the Reel and publish it."""
        url = f"{_GRAPH_BASE}/{page_id}/video_reels"
        params = {
            "upload_phase": "finish",
            "video_id": video_id,
            "video_state": "PUBLISHED",
            "description": description,
            "access_token": token,
        }
        self._log_request("POST", url, phase="reel_finish")
        t = time.monotonic()
        async with self._make_client() as client:
            resp = await client.post(url, params=params)
            self._log_response("POST", url, resp.status_code, time.monotonic() - t)

        if resp.status_code != 200:
            self._handle_api_error(resp, "Facebook Reel phase=finish")

        data = resp.json()
        if data.get("success") is not True and "video_id" not in data:
            raise PlatformAPIError(
                f"Facebook Reel finish response unexpected: {resp.text[:200]}",
                platform=self.PLATFORM,
                status_code=resp.status_code,
            )
        return video_id

    async def _phase_start(
        self, token: str, page_id: str, file_size: int, account_alias: str
    ) -> tuple[str, int, int, str | None]:
        """Phase 1: Initialize the upload session.

        Graph API ya devuelve acá el `video_id` definitivo junto al
        upload_session_id — se guarda porque `finish` a veces responde solo
        `{"success": true}` (procesamiento asíncrono) sin repetir el id."""
        url = f"{_GRAPH_BASE}/{page_id}/videos"
        params = {
            "upload_phase": "start",
            "file_size": str(file_size),
            "access_token": token,
        }

        self._log_request("POST", url, phase="start", file_size_bytes=file_size)
        t = time.monotonic()

        async with self._make_client() as client:
            resp = await client.post(url, params=params)
            self._log_response("POST", url, resp.status_code, time.monotonic() - t)

        if resp.status_code != 200:
            self._handle_api_error(resp, "Facebook upload phase=start")

        data = resp.json()
        session_id = data.get("upload_session_id")
        start_offset = int(data.get("start_offset", 0))
        end_offset = int(data.get("end_offset", _FB_CHUNK_SIZE))
        video_id = str(data["video_id"]) if data.get("video_id") else None

        logger.info(
            "fb_session_id_obtained",
            account=account_alias,
            session_id=session_id,
            start_offset=start_offset,
            end_offset=end_offset,
        )
        return session_id, start_offset, end_offset, video_id

    async def _phase_transfer(
        self,
        token: str,
        page_id: str,
        video_path: Path,
        file_size: int,
        upload_session_id: str,
        start_offset: int,
        account_alias: str,
    ) -> None:
        """Phase 2: Stream video bytes in chunks until all bytes are transferred."""
        current_offset = start_offset
        url = f"{_GRAPH_BASE}/{page_id}/videos"

        async with self._make_client(upload=True) as client:
            with open(video_path, "rb") as fh:
                fh.seek(current_offset)
                chunk_num = 0

                while current_offset < file_size:
                    chunk = fh.read(_FB_CHUNK_SIZE)
                    if not chunk:
                        break

                    chunk_num += 1
                    logger.info(
                        "fb_chunk_transfer",
                        account=account_alias,
                        chunk=chunk_num,
                        start_offset=current_offset,
                        chunk_size=len(chunk),
                        total_size=file_size,
                    )
                    logger.debug(
                        "fb_transfer_progress",
                        account=account_alias,
                        bytes_sent=current_offset + len(chunk),
                        total_bytes=file_size,
                        percent=round((current_offset + len(chunk)) / file_size * 100, 1),
                    )

                    params = {
                        "upload_phase": "transfer",
                        "upload_session_id": upload_session_id,
                        "start_offset": str(current_offset),
                        "access_token": token,
                    }

                    resp = await client.post(
                        url,
                        params=params,
                        files={"video_file_chunk": (video_path.name, chunk, "application/octet-stream")},
                    )

                    if resp.status_code != 200:
                        self._handle_api_error(resp, f"Facebook phase=transfer chunk={chunk_num}")

                    data = resp.json()
                    # Facebook returns the next expected start_offset
                    current_offset = int(data.get("start_offset", current_offset + len(chunk)))

    async def _phase_finish(
        self,
        token: str,
        page_id: str,
        upload_session_id: str,
        title: str,
        description: str,
        account_alias: str,
        fallback_video_id: str | None = None,
    ) -> str:
        """Phase 3: Finalize the upload and publish the video."""
        logger.info(
            "fb_finish_start",
            account=account_alias,
            page_id=page_id,
            upload_session_id=upload_session_id,
        )

        url = f"{_GRAPH_BASE}/{page_id}/videos"
        params = {
            "upload_phase": "finish",
            "upload_session_id": upload_session_id,
            "title": title,
            "description": description,
            "access_token": token,
        }

        self._log_request("POST", url, phase="finish")
        t = time.monotonic()

        async with self._make_client() as client:
            resp = await client.post(url, params=params)
            self._log_response("POST", url, resp.status_code, time.monotonic() - t)

        if resp.status_code != 200:
            self._handle_api_error(resp, "Facebook phase=finish")

        data = resp.json()
        video_id = data.get("video_id") or str(data.get("id", ""))

        if not video_id:
            if data.get("success") is True and fallback_video_id:
                # Procesamiento asíncrono: el id real es el que dio phase=start.
                logger.info(
                    "fb_finish_async_success",
                    account=account_alias,
                    page_id=page_id,
                    video_id=fallback_video_id,
                )
                video_id = fallback_video_id
            elif data.get("success") is True:
                # Meta API can return {"success": true} under async processing instead of video_id.
                logger.info(
                    "fb_finish_async_success",
                    account=account_alias,
                    page_id=page_id,
                    upload_session_id=upload_session_id,
                )
                video_id = f"session_{upload_session_id}"
            else:
                raise PlatformAPIError(
                    f"Facebook finish response missing video_id: {resp.text[:200]}",
                    platform=self.PLATFORM,
                    status_code=resp.status_code,
                )

        return video_id

    # ── READ ──────────────────────────────────────────────────────────────────

    @with_retry(max_retries=3)
    async def get_video(self, video_id: str, account_alias: str) -> VideoMetadata:
        """Fetch metadata and status for a Facebook video."""
        token = await self._token_manager.get_valid_token(self.PLATFORM, account_alias)
        url = f"{_GRAPH_BASE}/{video_id}"
        params = {
            "fields": "id,title,description,status",
            "access_token": token,
        }

        logger.info("fb_get_video_start", account=account_alias, video_id=video_id)
        self._log_request("GET", url, video_id=video_id)
        t = time.monotonic()

        async with self._make_client() as client:
            resp = await client.get(url, params=params)
            self._log_response("GET", url, resp.status_code, time.monotonic() - t)

        if resp.status_code == 404:
            raise VideoNotFoundError(f"Facebook video not found: {video_id}")
        if resp.status_code != 200:
            self._handle_api_error(resp, "Facebook get_video")

        data = resp.json()
        video_status = data.get("status", {})
        processing_status = (
            video_status.get("processing_progress", {}).get("status", "unknown")
            if isinstance(video_status, dict)
            else str(video_status)
        )

        return VideoMetadata(
            video_id=video_id,
            title=data.get("title", ""),
            description=data.get("description", ""),
            tags=[],   # Facebook API does not return tags on video objects
            status=processing_status,
            platform=self.PLATFORM,
            raw_response=data,
        )

    # ── UPDATE ────────────────────────────────────────────────────────────────

    @with_retry(max_retries=3)
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
        """Update the title and/or description of a Facebook video."""
        logger.info(
            "fb_update_start",
            account=account_alias,
            video_id=video_id,
            fields={
                "title": title is not None,
                "description": description is not None,
                "tags": tags is not None,
                "privacy": privacy is not None,
            },
        )

        token = await self._token_manager.get_valid_token(self.PLATFORM, account_alias)
        url = f"{_GRAPH_BASE}/{video_id}"
        params: dict = {"access_token": token}

        if title is not None:
            params["title"] = title
        if description is not None:
            if tags:
                description = description + "\n\n" + " ".join(f"#{t}" for t in tags)
            params["description"] = description
        if privacy is not None:
            params["privacy"] = f'{{"value": "{privacy.upper()}"}}'

        self._log_request("POST", url, video_id=video_id)
        t = time.monotonic()

        async with self._make_client() as client:
            resp = await client.post(url, params=params)
            self._log_response("POST", url, resp.status_code, time.monotonic() - t)

        if resp.status_code == 404:
            raise VideoNotFoundError(f"Facebook video not found for update: {video_id}")
        if resp.status_code != 200:
            self._handle_api_error(resp, "Facebook update_video")

        logger.info(
            "fb_update_done",
            account=account_alias,
            video_id=video_id,
            updated_fields=list(params.keys() - {"access_token"}),
        )

        # Fetch and return fresh metadata after update
        return await self.get_video(video_id, account_alias)

    # ── DELETE ────────────────────────────────────────────────────────────────

    @with_retry(max_retries=3)
    async def delete_video(self, video_id: str, account_alias: str) -> bool:
        """Delete a Facebook video permanently."""
        token = await self._token_manager.get_valid_token(self.PLATFORM, account_alias)
        url = f"{_GRAPH_BASE}/{video_id}"
        params = {"access_token": token}

        logger.info("fb_delete_start", account=account_alias, video_id=video_id)
        self._log_request("DELETE", url, video_id=video_id)
        t = time.monotonic()

        async with self._make_client() as client:
            resp = await client.delete(url, params=params)
            self._log_response("DELETE", url, resp.status_code, time.monotonic() - t)

        if resp.status_code == 404:
            raise VideoNotFoundError(f"Facebook video not found for deletion: {video_id}")
        if resp.status_code not in (200, 204):
            self._handle_api_error(resp, "Facebook delete_video")

        logger.info("fb_delete_success", account=account_alias, video_id=video_id)
        return True
