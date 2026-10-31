"""YouTube Adapter — CRUD operations via YouTube Data API v3.

Upload flow (Resumable Upload protocol):
  1. POST  /upload/youtube/v3/videos?uploadType=resumable   → get session_uri
  2. PUT   {session_uri} (stream file in CHUNK_SIZE_BYTES chunks)
  3. GET   /youtube/v3/videos?part=status&id={video_id}     → poll until processed

CRUD:
  Create → publish()        Resumable upload above
  Read   → get_video()      GET /youtube/v3/videos
  Update → update_video()   PUT /youtube/v3/videos (snippet part)
  Delete → delete_video()   DELETE /youtube/v3/videos

Quota (2026):
  - 10,000 units/day per project (standard).
  - videos.insert costs 1,600 units — max 6 uploads/day.
  - A quota guard checks how many uploads remain before starting.
  - youtube_daily_quota_limit and youtube_quota_cost_per_upload are configurable
    in settings.py.

Structured log events:
  youtube_init_start           — calling the session init endpoint
  youtube_session_created      — received session_uri (Location header)
  youtube_chunk_start          — beginning a chunk PUT
  youtube_chunk_done           — chunk accepted (206/200/201)
  youtube_upload_complete      — all chunks sent
  youtube_processing_poll      — polling for upload_status
  youtube_hd_poll              — waiting for full (HD) processing of a video uploaded private
  youtube_hd_wait_timeout      — HD never finished in YOUTUBE_HD_MAX_WAIT_SECONDS (made public anyway)
  youtube_made_public          — the private upload was switched to public
  youtube_publish_success      — video fully processed and public
  youtube_thumbnail_set        — custom thumbnail uploaded (thumbnails.set)
  youtube_thumbnail_failed     — custom thumbnail rejected (the video stays published)
  youtube_quota_warning        — approaching or at daily quota
  youtube_update_start         — calling PUT /videos for metadata update
  youtube_update_done          — metadata updated successfully
  youtube_delete_start         — calling DELETE /videos
  youtube_delete_success       — video removed
  youtube_error                — non-recoverable API error
"""

from __future__ import annotations

import asyncio
import re
import time
from datetime import datetime
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import structlog

from src.config.exceptions import PlatformAPIError, QuotaExceededError, VideoNotFoundError
from src.config.settings import settings
from src.core.ports.channel_catalog_port import ChannelCatalogPort, ChannelStats, RemoteVideo
from src.core.ports.publisher_port import PublishVideoResult, VideoMetadata
from src.adapters.publishing.base_platform import BasePlatformAdapter, with_retry, CHUNK_SIZE_BYTES

logger = structlog.get_logger(__name__)

_API_BASE = "https://www.googleapis.com"
_YT_BASE = "https://www.googleapis.com/youtube/v3"
_UPLOAD_BASE = "https://www.googleapis.com/upload/youtube/v3"

_POLL_INTERVAL = 10.0   # seconds
_POLL_MAX_WAIT = 300.0  # seconds (5 min; YouTube processing can take a while)
_HD_POLL_INTERVAL = 20.0  # seconds; the HD wait itself is capped by settings.youtube_hd_max_wait_seconds


def _handle_from_custom_url(custom_url: str | None) -> str | None:
    """Return a verified @handle from YouTube's customUrl field, if it contains one."""
    if not custom_url:
        return None
    value = custom_url.strip()
    path = urlparse(value).path if "://" in value else value
    candidate = path.rstrip("/").rsplit("/", 1)[-1]
    return candidate[1:] if candidate.startswith("@") and len(candidate) > 1 else None


@dataclass(frozen=True, slots=True)
class YouTubeChannelProfile:
    channel_id: str
    title: str
    handle: str | None
    description: str
    custom_url: str | None
    avatar: str | None

    @classmethod
    def from_resource(cls, resource: dict[str, Any]) -> "YouTubeChannelProfile":
        snippet = resource.get("snippet") or {}
        thumbnails = snippet.get("thumbnails") or {}
        avatar = next(
            (
                thumbnails.get(size, {}).get("url")
                for size in ("high", "medium", "default")
                if thumbnails.get(size, {}).get("url")
            ),
            None,
        )
        custom_url = snippet.get("customUrl") or None
        return cls(
            channel_id=resource.get("id") or "",
            title=snippet.get("title") or "",
            handle=_handle_from_custom_url(custom_url),
            description=snippet.get("description") or "",
            custom_url=custom_url,
            avatar=avatar,
        )


def _int(value: Any) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


_ISO_DURATION = re.compile(r"P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?")


def _duration_seconds(iso: str | None) -> float | None:
    """'PT1M12S' → 72.0 (formato ISO 8601 de contentDetails.duration)."""
    match = _ISO_DURATION.fullmatch(iso or "")
    if not match or not any(match.groups()):
        return None
    days, hours, minutes, seconds = (int(g or 0) for g in match.groups())
    return float(((days * 24 + hours) * 60 + minutes) * 60 + seconds)


def _remote_video(item: dict[str, Any]) -> RemoteVideo:
    snippet, stats = item.get("snippet", {}), item.get("statistics", {})
    thumbs = snippet.get("thumbnails", {})
    thumb = next((thumbs[k]["url"] for k in ("high", "medium", "default") if k in thumbs), None)
    published = snippet.get("publishedAt")
    return RemoteVideo(
        post_id=item["id"],
        url=f"https://www.youtube.com/watch?v={item['id']}",
        title=snippet.get("title", ""),
        published_at=datetime.fromisoformat(published.replace("Z", "+00:00")).timestamp() if published else 0.0,
        privacy=item.get("status", {}).get("privacyStatus", "unknown"),
        duration_seconds=_duration_seconds(item.get("contentDetails", {}).get("duration")),
        thumbnail_url=thumb,
        views=_int(stats.get("viewCount")),
        likes=_int(stats.get("likeCount")),
        comments=_int(stats.get("commentCount")),
    )


class YouTubeAdapter(BasePlatformAdapter, ChannelCatalogPort):
    """YouTube Data API v3 — full CRUD with resumable upload and quota guard."""

    PLATFORM = "youtube"

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
        """Upload a video to YouTube via the resumable upload protocol.

        Args:
            video_path:   Absolute path to the YouTube video (≤256GB, ≤12h).
            title:        Video title (max 100 chars).
            description:  Video description (max 5000 chars).
            tags:         YouTube tags (max 500 total chars combined).
            account_alias: Key in accounts.json (e.g. 'canal_1').
            privacy:      'public' | 'private' | 'unlisted'.
            kwargs:       language — "es" | "en", sets defaultLanguage/defaultAudioLanguage.
                          thumbnail_path — JPEG/PNG ≤ 2 MB uploaded with thumbnails.set after
                          processing (needs a verified channel; a failure never fails the upload).

        Returns:
            PublishVideoResult with YouTube video_id and watch URL.
        """
        t_start = time.monotonic()
        token = await self._token_manager.get_valid_token(self.PLATFORM, account_alias)
        file_size = video_path.stat().st_size

        privacy_map = {
            "public": "public",
            "private": "private",
            "unlisted": "unlisted",
        }
        yt_privacy = privacy_map.get(privacy, "public")
        # Público recién con la HD lista: YouTube procesa primero la versión baja y, si el video ya
        # es público, los primeros espectadores lo ven en 360p. Se sube privado y se abre después.
        hold_until_hd = yt_privacy == "public" and settings.youtube_wait_for_hd
        upload_privacy = "private" if hold_until_hd else yt_privacy

        logger.info(
            "youtube_init_start",
            account=account_alias,
            file=video_path.name,
            file_size_mb=round(file_size / 1_048_576, 2),
            privacy=yt_privacy,
            hold_until_hd=hold_until_hd,
        )

        # ── Step 1: Initialize resumable upload session ───────────────────────
        session_uri = await self._init_resumable_session(
            token=token,
            title=title[:100],
            description=description[:5000],
            tags=tags,
            privacy=upload_privacy,
            file_size=file_size,
            language=kwargs.get("language"),
        )

        # ── Step 2: Upload chunks ─────────────────────────────────────────────
        video_id = await self._upload_chunks(
            session_uri=session_uri,
            video_path=video_path,
            file_size=file_size,
            account_alias=account_alias,
        )

        # ── Step 3: Poll for processing ───────────────────────────────────────
        await self._poll_processing(token=token, video_id=video_id, account_alias=account_alias)

        hd_ready: bool | None = None
        if hold_until_hd:
            hd_ready = await self._wait_for_hd(video_id=video_id, account_alias=account_alias)
            # La espera puede pasar la hora de vida del token de acceso.
            token = await self._token_manager.get_valid_token(self.PLATFORM, account_alias)

        # ── Step 4: Custom thumbnail (optional) ───────────────────────────────
        thumbnail_path = kwargs.get("thumbnail_path")
        if thumbnail_path:
            await self._set_thumbnail(token, video_id, Path(thumbnail_path))

        if hold_until_hd:
            await self._make_public(token, video_id, account_alias)

        # A failed comment must not re-upload an already published video.
        comment_text = str(kwargs.get("comment_text") or "").strip()
        comment_posted = False
        if comment_text:
            comment_posted = await self._post_top_level_comment(
                token, video_id, account_alias, comment_text
            )

        elapsed = round(time.monotonic() - t_start, 2)
        logger.info(
            "youtube_publish_success",
            account=account_alias,
            video_id=video_id,
            url=f"https://www.youtube.com/watch?v={video_id}",
            elapsed_seconds=elapsed,
        )

        return PublishVideoResult(
            post_id=video_id,
            url=f"https://www.youtube.com/watch?v={video_id}",
            platform=self.PLATFORM,
            account_alias=account_alias,
            raw_response={"video_id": video_id, "comment_posted": comment_posted, "hd_ready": hd_ready},
        )

    async def _wait_for_hd(self, video_id: str, account_alias: str) -> bool:
        """Espera a que YouTube termine TODO el procesamiento (incluida la HD) del video.

        `status.uploadStatus == "processed"` (lo que espera _poll_processing) llega con la versión
        baja; `processingDetails.processingStatus == "succeeded"` llega cuando terminó todo. Nunca
        falla: devuelve False si se agotó la espera o YouTube no informa, y el video se abre igual.
        """
        max_wait = float(settings.youtube_hd_max_wait_seconds)
        elapsed = 0.0
        interval = _HD_POLL_INTERVAL
        while elapsed < max_wait:
            token = await self._token_manager.get_valid_token(self.PLATFORM, account_alias)
            try:
                async with self._make_client() as client:
                    resp = await client.get(
                        f"{_YT_BASE}/videos?part=processingDetails&id={video_id}",
                        headers={"Authorization": f"Bearer {token}"},
                    )
                items = resp.json().get("items", []) if resp.status_code == 200 else []
            except Exception as exc:  # noqa: BLE001 - un corte de red no debe dejar el video privado
                logger.warning("youtube_hd_poll_error", video_id=video_id, error=str(exc)[:200])
                items = []
            details = items[0].get("processingDetails", {}) if items else {}
            status = details.get("processingStatus", "")
            logger.info(
                "youtube_hd_poll", account=account_alias, video_id=video_id,
                processing_status=status, progress=details.get("processingProgress"),
                elapsed_seconds=round(elapsed),
            )
            if status == "succeeded":
                return True
            if status in ("failed", "terminated"):
                logger.warning("youtube_hd_processing_failed", video_id=video_id, status=status)
                return False
            await asyncio.sleep(interval)
            elapsed += interval
        logger.warning("youtube_hd_wait_timeout", video_id=video_id, waited_seconds=round(elapsed))
        return False

    async def _make_public(self, token: str, video_id: str, account_alias: str) -> None:
        """Pasa a público el video subido en privado. Reintenta por su cuenta: un error acá no puede
        hacer que `with_retry` vuelva a subir el video (quedaría duplicado)."""
        body = {
            "id": video_id,
            # Mismos campos que al subir: videos.update reemplaza el bloque status entero.
            "status": {"privacyStatus": "public", "selfDeclaredMadeForKids": False},
        }
        url = f"{_YT_BASE}/videos?part=status"
        last_error = ""
        for attempt in range(1, 4):
            try:
                async with self._make_client() as client:
                    resp = await client.put(
                        url,
                        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json; charset=UTF-8"},
                        json=body,
                    )
                if resp.status_code == 200:
                    logger.info("youtube_made_public", account=account_alias, video_id=video_id)
                    return
                last_error = f"HTTP {resp.status_code}: {resp.text[:300]}"
            except Exception as exc:  # noqa: BLE001
                last_error = str(exc)[:300]
            logger.warning("youtube_make_public_retry", video_id=video_id, attempt=attempt, error=last_error)
            await asyncio.sleep(2.0 ** attempt)
            token = await self._token_manager.get_valid_token(self.PLATFORM, account_alias)
        # Sin status retryable: with_retry no reintenta y no vuelve a subir el video.
        raise PlatformAPIError(
            f"El video se subió (privado) pero no se pudo hacer público: "
            f"https://www.youtube.com/watch?v={video_id} — {last_error}",
            platform=self.PLATFORM,
        )

    async def _post_top_level_comment(
        self, token: str, video_id: str, account_alias: str, text: str
    ) -> bool:
        """Post the package comment once the upload succeeds; pinning is a UI action."""
        try:
            channel_id = self._token_manager._storage.get_state("youtube", account_alias).target_id
            if not channel_id:
                async with self._make_client() as client:
                    channel_response = await client.get(
                        f"{_YT_BASE}/channels",
                        params={"part": "id", "mine": "true"},
                        headers={"Authorization": f"Bearer {token}"},
                    )
                if channel_response.status_code != 200:
                    logger.warning("youtube_comment_channel_lookup_failed", video_id=video_id,
                                   status=channel_response.status_code)
                    return False
                items = channel_response.json().get("items") or []
                channel_id = items[0].get("id") if items else None
            if not channel_id:
                logger.warning("youtube_comment_channel_missing", video_id=video_id)
                return False
            async with self._make_client() as client:
                response = await client.post(
                    f"{_YT_BASE}/commentThreads",
                    params={"part": "snippet"},
                    headers={"Authorization": f"Bearer {token}"},
                    json={"snippet": {"channelId": channel_id, "videoId": video_id,
                                      "topLevelComment": {"snippet": {"textOriginal": text}}}},
                )
            if response.status_code not in (200, 201):
                logger.warning("youtube_comment_failed", video_id=video_id,
                               status=response.status_code, body=response.text[:300])
                return False
            logger.info("youtube_comment_posted", video_id=video_id)
            return True
        except Exception as exc:  # comment failure must not duplicate an uploaded video
            logger.warning("youtube_comment_failed", video_id=video_id, error=str(exc)[:300])
            return False

    async def _set_thumbnail(self, token: str, video_id: str, path: Path) -> bool:
        """POST /upload/youtube/v3/thumbnails/set. Never raises: `publish` retries on errors and
        would upload the whole video again; a missing thumbnail is only logged."""
        url = f"{_UPLOAD_BASE}/thumbnails/set?videoId={video_id}"
        content_type = "image/png" if path.suffix.lower() == ".png" else "image/jpeg"
        try:
            data = path.read_bytes()
            self._log_request("POST", url, file_size_bytes=len(data))
            t = time.monotonic()
            async with self._make_client() as client:
                resp = await client.post(url, headers={"Authorization": f"Bearer {token}", "Content-Type": content_type}, content=data)
            self._log_response("POST", url, resp.status_code, time.monotonic() - t)
        except Exception as exc:  # noqa: BLE001 - see docstring
            logger.warning("youtube_thumbnail_failed", video_id=video_id, error=str(exc)[:300])
            return False
        if resp.status_code not in (200, 201):
            logger.warning("youtube_thumbnail_failed", video_id=video_id, status=resp.status_code, body=resp.text[:300])
            return False
        logger.info("youtube_thumbnail_set", video_id=video_id, file=path.name)
        return True

    async def _init_resumable_session(
        self,
        token: str,
        title: str,
        description: str,
        tags: list[str],
        privacy: str,
        file_size: int,
        language: str | None = None,
    ) -> str:
        """Initialize a YouTube resumable upload session.

        Returns the session_uri from the Location response header.
        """
        snippet: dict = {
            "title": title,
            "description": description,
            "tags": tags,
            "categoryId": "10",  # 10 = Music
        }
        if language:
            # Language of the title/description and of the sung audio — helps YouTube search/suggestions.
            snippet["defaultLanguage"] = language
            snippet["defaultAudioLanguage"] = language
        metadata = {
            "snippet": snippet,
            "status": {
                "privacyStatus": privacy,
                "selfDeclaredMadeForKids": False,
            },
        }

        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json; charset=UTF-8",
            "X-Upload-Content-Type": "video/*",
            "X-Upload-Content-Length": str(file_size),
        }

        url = f"{_UPLOAD_BASE}/videos?uploadType=resumable&part=snippet,status"
        self._log_request("POST", url, file_size_bytes=file_size)
        t = time.monotonic()

        async with self._make_client() as client:
            resp = await client.post(url, headers=headers, json=metadata)
            self._log_response("POST", url, resp.status_code, time.monotonic() - t)

        if resp.status_code not in (200, 201):
            self._handle_api_error(resp, "YouTube init resumable session")

        session_uri = resp.headers.get("Location")
        if not session_uri:
            raise PlatformAPIError(
                "YouTube init response missing Location header",
                platform=self.PLATFORM,
                status_code=resp.status_code,
            )

        logger.info("youtube_session_created", session_uri_prefix=session_uri[:80])
        return session_uri

    async def _upload_chunks(
        self,
        session_uri: str,
        video_path: Path,
        file_size: int,
        account_alias: str,
    ) -> str:
        """Stream video to YouTube in chunks.  Returns the video_id from the final response."""
        logger.info(
            "youtube_chunk_start",
            account=account_alias,
            file=video_path.name,
            total_bytes=file_size,
            chunk_size_bytes=CHUNK_SIZE_BYTES,
        )

        video_id: str | None = None

        async with self._make_client(upload=True) as client:
            for chunk, offset, total in self._read_chunks(video_path):
                end = offset + len(chunk) - 1
                headers = {
                    "Content-Range": f"bytes {offset}-{end}/{total}",
                    "Content-Type": "video/*",
                }

                logger.debug(
                    "youtube_chunk_progress",
                    account=account_alias,
                    bytes_sent=end + 1,
                    total_bytes=total,
                    percent=round((end + 1) / total * 100, 1),
                )

                resp = await client.put(session_uri, headers=headers, content=chunk)

                if resp.status_code in (200, 201):
                    # Final chunk accepted — extract video_id
                    data = resp.json()
                    video_id = data.get("id")
                    logger.info(
                        "youtube_chunk_done",
                        account=account_alias,
                        video_id=video_id,
                        total_bytes=total,
                    )
                    break
                elif resp.status_code == 308:
                    # Resume incomplete — YouTube acknowledged this chunk, continue
                    logger.debug(
                        "youtube_chunk_accepted_resume",
                        account=account_alias,
                        range_header=resp.headers.get("Range"),
                    )
                else:
                    self._handle_api_error(resp, f"YouTube chunk upload offset={offset}")

        if not video_id:
            raise PlatformAPIError(
                "YouTube upload completed but no video_id in response",
                platform=self.PLATFORM,
            )

        logger.info("youtube_upload_complete", account=account_alias, video_id=video_id)
        return video_id

    async def _poll_processing(self, token: str, video_id: str, account_alias: str) -> None:
        """Poll YouTube until the video upload_status is 'processed' or fails."""
        logger.info("youtube_processing_poll", account=account_alias, video_id=video_id)

        headers = {"Authorization": f"Bearer {token}"}
        elapsed = 0.0

        async with self._make_client() as client:
            while elapsed < _POLL_MAX_WAIT:
                await asyncio.sleep(_POLL_INTERVAL)
                elapsed += _POLL_INTERVAL

                url = f"{_YT_BASE}/videos?part=status&id={video_id}"
                resp = await client.get(url, headers=headers)

                if resp.status_code != 200:
                    self._handle_api_error(resp, "YouTube poll processing")

                items = resp.json().get("items", [])
                if not items:
                    logger.warning(
                        "youtube_poll_no_items",
                        account=account_alias,
                        video_id=video_id,
                        elapsed=elapsed,
                    )
                    continue

                upload_status = items[0]["status"].get("uploadStatus", "")
                logger.info(
                    "youtube_processing_poll",
                    account=account_alias,
                    video_id=video_id,
                    upload_status=upload_status,
                    elapsed_seconds=round(elapsed),
                )

                if upload_status == "processed":
                    return
                if upload_status in ("failed", "rejected", "deleted"):
                    rejection = items[0]["status"].get("rejectionReason", "unknown")
                    logger.error(
                        "youtube_error",
                        account=account_alias,
                        video_id=video_id,
                        upload_status=upload_status,
                        rejection_reason=rejection,
                    )
                    raise PlatformAPIError(
                        f"YouTube upload failed: {upload_status} / {rejection}",
                        platform=self.PLATFORM,
                    )

        raise PlatformAPIError(
            f"YouTube processing timed out after {_POLL_MAX_WAIT}s (video_id={video_id})",
            platform=self.PLATFORM,
        )

    # ── CHANNEL PROFILE ──────────────────────────────────────────────────────

    @with_retry(max_retries=3)
    async def get_channel_profile(
        self,
        account_alias: str,
        *,
        expected_channel_id: str | None = None,
    ) -> YouTubeChannelProfile | None:
        """Read the connected channel's public profile using its stored OAuth token."""
        token = await self._token_manager.get_valid_token(self.PLATFORM, account_alias)
        url = f"{_YT_BASE}/channels"
        params = {"part": "snippet", "mine": "true", "maxResults": 50}
        headers = {"Authorization": f"Bearer {token}"}
        self._log_request("GET", url, account=account_alias, purpose="channel_profile")
        started = time.monotonic()

        async with self._make_client() as client:
            response = await client.get(url, params=params, headers=headers)
            self._log_response(
                "GET",
                url,
                response.status_code,
                time.monotonic() - started,
                account=account_alias,
                purpose="channel_profile",
            )

        if response.status_code != 200:
            self._handle_api_error(response, "YouTube get channel profile")

        items = response.json().get("items") or []
        if not items:
            return None

        resource = next(
            (item for item in items if item.get("id") == expected_channel_id),
            None,
        ) if expected_channel_id else None
        if expected_channel_id and resource is None:
            return None
        resource = resource or items[0]
        profile = YouTubeChannelProfile.from_resource(resource)
        return profile if profile.channel_id and profile.title else None

    # ── CHANNEL CATALOG (sincronización de Canales) ─────────────────────────────

    async def _get_json(self, path: str, params: dict[str, Any], account_alias: str, purpose: str) -> dict:
        token = await self._token_manager.get_valid_token(self.PLATFORM, account_alias)
        url = f"{_YT_BASE}/{path}"
        self._log_request("GET", url, account=account_alias, purpose=purpose)
        started = time.monotonic()
        async with self._make_client() as client:
            resp = await client.get(url, params=params, headers={"Authorization": f"Bearer {token}"})
            self._log_response("GET", url, resp.status_code, time.monotonic() - started, account=account_alias)
        if resp.status_code != 200:
            self._handle_api_error(resp, f"YouTube {purpose}")
        return resp.json()

    async def _own_channel(self, account_alias: str) -> dict:
        """El recurso `channels` de la cuenta (estadísticas + playlist de subidas). Cuesta 1 unidad."""
        data = await self._get_json(
            "channels", {"part": "statistics,contentDetails", "mine": "true", "maxResults": 50},
            account_alias, "channel_catalog",
        )
        items = data.get("items") or []
        if not items:
            raise VideoNotFoundError(f"La cuenta {account_alias} no tiene un canal de YouTube.")
        target = self._token_manager.target_id(self.PLATFORM, account_alias)
        return next((i for i in items if i.get("id") == target), items[0])

    @with_retry(max_retries=3)
    async def get_channel_stats(self, account_alias: str) -> ChannelStats:
        stats = (await self._own_channel(account_alias)).get("statistics", {})
        hidden = stats.get("hiddenSubscriberCount")
        return ChannelStats(
            video_count=_int(stats.get("videoCount")),
            followers=None if hidden else _int(stats.get("subscriberCount")),
            views=_int(stats.get("viewCount")),
        )

    @with_retry(max_retries=3)
    async def list_channel_videos(self, account_alias: str, *, limit: int | None = None) -> list[RemoteVideo]:
        """Todas las subidas del canal (incluye privados y ocultos: lee el dueño).

        playlistItems (50 por página) + videos.list por tandas de 50: 1 unidad de cuota por
        llamada, ~2 unidades cada 50 videos (contra 1600 de una subida)."""
        channel = await self._own_channel(account_alias)
        uploads = channel.get("contentDetails", {}).get("relatedPlaylists", {}).get("uploads")
        if not uploads:
            return []
        ids: list[str] = []
        page_token: str | None = None
        while limit is None or len(ids) < limit:
            params: dict[str, Any] = {"part": "contentDetails", "playlistId": uploads, "maxResults": 50}
            if page_token:
                params["pageToken"] = page_token
            page = await self._get_json("playlistItems", params, account_alias, "channel_uploads")
            ids += [i["contentDetails"]["videoId"] for i in page.get("items", []) if i.get("contentDetails")]
            page_token = page.get("nextPageToken")
            if not page_token:
                break
        ids = ids[:limit] if limit is not None else ids

        videos: list[RemoteVideo] = []
        for start in range(0, len(ids), 50):
            data = await self._get_json(
                "videos",
                {"part": "snippet,contentDetails,statistics,status", "id": ",".join(ids[start:start + 50])},
                account_alias, "channel_videos",
            )
            videos += [_remote_video(item) for item in data.get("items", [])]
        videos.sort(key=lambda v: v.published_at, reverse=True)
        return videos

    # ── READ ──────────────────────────────────────────────────────────────────

    @with_retry(max_retries=3)
    async def get_video(self, video_id: str, account_alias: str) -> VideoMetadata:
        """Fetch metadata and processing status for a YouTube video."""
        token = await self._token_manager.get_valid_token(self.PLATFORM, account_alias)
        url = f"{_YT_BASE}/videos?part=snippet,status&id={video_id}"
        headers = {"Authorization": f"Bearer {token}"}

        self._log_request("GET", url, video_id=video_id)
        t = time.monotonic()

        async with self._make_client() as client:
            resp = await client.get(url, headers=headers)
            self._log_response("GET", url, resp.status_code, time.monotonic() - t)

        if resp.status_code != 200:
            self._handle_api_error(resp, "YouTube get_video")

        data = resp.json()
        items = data.get("items", [])
        if not items:
            raise VideoNotFoundError(f"YouTube video not found: {video_id}")

        item = items[0]
        snippet = item.get("snippet", {})
        status = item.get("status", {})

        return VideoMetadata(
            video_id=video_id,
            title=snippet.get("title", ""),
            description=snippet.get("description", ""),
            tags=snippet.get("tags", []),
            status=status.get("uploadStatus", "unknown"),
            platform=self.PLATFORM,
            raw_response=item,
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
        """Update mutable metadata of a YouTube video.

        Fetches the current snippet first to avoid overwriting unspecified fields.
        """
        logger.info(
            "youtube_update_start",
            account=account_alias,
            video_id=video_id,
            fields={
                "title": title is not None,
                "description": description is not None,
                "tags": tags is not None,
                "privacy": privacy is not None,
            },
        )

        # Fetch current metadata to merge
        current = await self.get_video(video_id, account_alias)
        token = await self._token_manager.get_valid_token(self.PLATFORM, account_alias)

        snippet = {
            "title": title if title is not None else current.title,
            "description": description if description is not None else current.description,
            "tags": tags if tags is not None else current.tags,
            "categoryId": "10",
        }
        body: dict = {"id": video_id, "snippet": snippet}
        part = "snippet"

        if privacy is not None:
            body["status"] = {"privacyStatus": privacy}
            part = "snippet,status"

        url = f"{_YT_BASE}/videos?part={part}"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json; charset=UTF-8",
        }

        self._log_request("PUT", url, video_id=video_id)
        t = time.monotonic()

        async with self._make_client() as client:
            resp = await client.put(url, headers=headers, json=body)
            self._log_response("PUT", url, resp.status_code, time.monotonic() - t)

        if resp.status_code != 200:
            self._handle_api_error(resp, "YouTube update_video")

        item = resp.json()
        s = item.get("snippet", {})
        logger.info(
            "youtube_update_done",
            account=account_alias,
            video_id=video_id,
            new_title=s.get("title"),
        )

        return VideoMetadata(
            video_id=video_id,
            title=s.get("title", ""),
            description=s.get("description", ""),
            tags=s.get("tags", []),
            status=item.get("status", {}).get("privacyStatus", "unknown"),
            platform=self.PLATFORM,
            raw_response=item,
        )

    # ── DELETE ────────────────────────────────────────────────────────────────

    @with_retry(max_retries=3)
    async def delete_video(self, video_id: str, account_alias: str) -> bool:
        """Delete a YouTube video permanently."""
        token = await self._token_manager.get_valid_token(self.PLATFORM, account_alias)
        url = f"{_YT_BASE}/videos?id={video_id}"
        headers = {"Authorization": f"Bearer {token}"}

        logger.info("youtube_delete_start", account=account_alias, video_id=video_id)
        self._log_request("DELETE", url, video_id=video_id)
        t = time.monotonic()

        async with self._make_client() as client:
            resp = await client.delete(url, headers=headers)
            self._log_response("DELETE", url, resp.status_code, time.monotonic() - t)

        if resp.status_code == 404:
            raise VideoNotFoundError(f"YouTube video not found for deletion: {video_id}")
        if resp.status_code not in (200, 204):
            self._handle_api_error(resp, "YouTube delete_video")

        logger.info("youtube_delete_success", account=account_alias, video_id=video_id)
        return True

    # ── PLAYLISTS ─────────────────────────────────────────────────────────────

    @with_retry(max_retries=3)
    async def list_playlists(self, account_alias: str) -> list[dict[str, str]]:
        """Fetch playlists for the authenticated channel."""
        token = await self._token_manager.get_valid_token(self.PLATFORM, account_alias)
        url = f"{_YT_BASE}/playlists?part=snippet&mine=true&maxResults=50"
        headers = {"Authorization": f"Bearer {token}"}

        logger.info("youtube_list_playlists_start", account=account_alias)
        self._log_request("GET", url)
        t = time.monotonic()

        async with self._make_client() as client:
            resp = await client.get(url, headers=headers)
            self._log_response("GET", url, resp.status_code, time.monotonic() - t)

        if resp.status_code != 200:
            self._handle_api_error(resp, "YouTube list_playlists")

        data = resp.json()
        items = data.get("items", [])
        playlists = []
        for item in items:
            playlists.append({
                "id": item.get("id", ""),
                "title": item.get("snippet", {}).get("title", ""),
            })

        logger.info("youtube_list_playlists_success", account=account_alias, count=len(playlists))
        return playlists

    @with_retry(max_retries=3)
    async def create_playlist(self, title: str, description: str, account_alias: str) -> str:
        """Create a new playlist on the authenticated channel."""
        token = await self._token_manager.get_valid_token(self.PLATFORM, account_alias)
        url = f"{_YT_BASE}/playlists?part=snippet,status"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json; charset=UTF-8",
        }
        body = {
            "snippet": {
                "title": title,
                "description": description,
            },
            "status": {
                "privacyStatus": "public",
            },
        }

        logger.info("youtube_create_playlist_start", account=account_alias, title=title)
        self._log_request("POST", url)
        t = time.monotonic()

        async with self._make_client() as client:
            resp = await client.post(url, headers=headers, json=body)
            self._log_response("POST", url, resp.status_code, time.monotonic() - t)

        if resp.status_code not in (200, 201):
            self._handle_api_error(resp, "YouTube create_playlist")

        data = resp.json()
        playlist_id = data.get("id", "")
        logger.info("youtube_create_playlist_success", account=account_alias, playlist_id=playlist_id)
        return playlist_id

    @with_retry(max_retries=3)
    async def add_video_to_playlist(self, video_id: str, playlist_id: str, account_alias: str) -> bool:
        """Add a video to a specific playlist."""
        token = await self._token_manager.get_valid_token(self.PLATFORM, account_alias)
        url = f"{_YT_BASE}/playlistItems?part=snippet"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json; charset=UTF-8",
        }
        body = {
            "snippet": {
                "playlistId": playlist_id,
                "resourceId": {
                    "kind": "youtube#video",
                    "videoId": video_id,
                },
            },
        }

        logger.info("youtube_add_to_playlist_start", account=account_alias, video_id=video_id, playlist_id=playlist_id)
        self._log_request("POST", url)
        t = time.monotonic()

        async with self._make_client() as client:
            resp = await client.post(url, headers=headers, json=body)
            self._log_response("POST", url, resp.status_code, time.monotonic() - t)

        if resp.status_code not in (200, 201):
            self._handle_api_error(resp, "YouTube add_video_to_playlist")

        logger.info("youtube_add_to_playlist_success", account=account_alias, video_id=video_id, playlist_id=playlist_id)
        return True

    # ── Quota Guard ───────────────────────────────────────────────────────────

    def check_quota_before_upload(self, quota_used_today: int) -> None:
        """Raise QuotaExceededError if we don't have enough units for an upload.

        Args:
            quota_used_today: Units consumed so far today (tracked externally).

        Raises:
            QuotaExceededError if remaining quota < youtube_quota_cost_per_upload.
        """
        remaining = settings.youtube_daily_quota_limit - quota_used_today
        cost = settings.youtube_quota_cost_per_upload

        logger.info(
            "youtube_quota_check",
            quota_used=quota_used_today,
            quota_remaining=remaining,
            cost_per_upload=cost,
            daily_limit=settings.youtube_daily_quota_limit,
        )

        if remaining < cost:
            logger.error(
                "youtube_quota_warning",
                quota_remaining=remaining,
                required=cost,
                message="Daily YouTube upload quota exhausted",
            )
            raise QuotaExceededError(
                f"YouTube daily quota exhausted: {remaining} units remaining, "
                f"{cost} required for upload. Limit resets at midnight Pacific Time."
            )
