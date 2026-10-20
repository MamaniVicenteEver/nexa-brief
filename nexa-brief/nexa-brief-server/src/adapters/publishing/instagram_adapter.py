"""Publish Instagram Reels through the Instagram Graph API (Facebook Login)."""
from __future__ import annotations

import asyncio
import time
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import quote

import httpx
import structlog

from src.adapters.publishing.base_platform import BasePlatformAdapter, with_retry
from src.adapters.publishing.instagram_media import probe, reels_safe_video
from src.adapters.publishing.instagram_media_url import create_signed_media_token
from src.config.exceptions import PlatformAPIError, UnsupportedOperationError
from src.config.settings import settings
from src.core.ports.channel_catalog_port import ChannelCatalogPort, ChannelStats, RemoteVideo
from src.core.ports.publisher_port import PublishVideoResult, VideoMetadata

logger = structlog.get_logger(__name__)
_GRAPH_BASE = f"https://graph.facebook.com/{settings.meta_graph_api_version}"
_POLL_INTERVAL_SECONDS = 3.0


def _optional_int(value: Any) -> int | None:
    try:
        return int(value)
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


def _instagram_remote_video(item: dict[str, Any]) -> RemoteVideo:
    media_id = str(item.get("id") or "")
    caption = str(item.get("caption") or "")
    media_product_type = str(item.get("media_product_type") or "").upper()
    kind = "reel" if media_product_type == "REELS" else "video"
    permalink = item.get("permalink")
    if not permalink:
        route = "reel" if kind == "reel" else "p"
        permalink = f"https://www.instagram.com/{route}/{media_id}/"
    return RemoteVideo(
        post_id=media_id,
        url=str(permalink),
        title=caption.splitlines()[0].strip() if caption else "",
        published_at=_timestamp(item.get("timestamp")),
        privacy="public",
        thumbnail_url=item.get("thumbnail_url") or None,
        views=None,
        likes=_optional_int(item.get("like_count")),
        comments=_optional_int(item.get("comments_count")),
        kind=kind,
    )


def _poll_window_seconds(file_size_bytes: int, duration_seconds: float = 0.0) -> float:
    """Cuánto esperar a que Meta procese el Reel: 120 s + lo mayor entre 1 s cada 2 MB y 1 s por
    segundo de video (un video largo y liviano tarda igual: 9 min en 46 MB no entran en 142 s),
    hasta 15 min."""
    return min(900.0, 120.0 + max(file_size_bytes / (2 * 1024 * 1024), duration_seconds))


class InstagramAdapter(BasePlatformAdapter, ChannelCatalogPort):
    """Instagram Reels adapter using a linked Facebook Page access token."""

    PLATFORM = "instagram"

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
            self._handle_api_error(response, f"Instagram {purpose}")
        return response.json()

    async def _catalog_get_next(
        self, url: str, account_alias: str, purpose: str
    ) -> dict[str, Any]:
        # The URL returned by Graph contains an access token; never write it to request logs.
        self._log_request("GET", "Instagram Graph paging.next", account=account_alias, purpose=purpose)
        started = time.monotonic()
        async with self._make_client() as client:
            response = await client.get(url)
            self._log_response(
                "GET", "Instagram Graph paging.next", response.status_code,
                time.monotonic() - started, account=account_alias,
            )
        if response.status_code != 200:
            self._handle_api_error(response, f"Instagram {purpose}")
        return response.json()

    @with_retry(max_retries=3)
    async def list_channel_videos(
        self, account_alias: str, *, limit: int | None = None
    ) -> list[RemoteVideo]:
        instagram_user_id = self._token_manager.target_id(self.PLATFORM, account_alias)
        if not instagram_user_id:
            raise PlatformAPIError(
                "Instagram account has no professional-account ID. Reconnect it from Canales.",
                platform=self.PLATFORM,
                status_code=400,
            )
        page = await self._catalog_get_json(
            f"{quote(instagram_user_id, safe='')}/media",
            {
                "fields": (
                    "id,caption,media_type,media_product_type,permalink,timestamp,thumbnail_url,"
                    "like_count,comments_count"
                )
            },
            account_alias,
            "media_catalog",
        )
        videos: list[RemoteVideo] = []
        seen: set[str] = set()
        while True:
            for item in page.get("data", []):
                media_type = str(item.get("media_type") or "").upper()
                product_type = str(item.get("media_product_type") or "").upper()
                if media_type != "VIDEO" and product_type != "REELS":
                    continue
                video = _instagram_remote_video(item)
                if not video.post_id or video.post_id in seen:
                    continue
                seen.add(video.post_id)
                videos.append(video)
                if limit is not None and len(videos) >= limit:
                    return sorted(videos, key=lambda video: video.published_at, reverse=True)[:limit]
            next_url = (page.get("paging") or {}).get("next")
            if not next_url:
                break
            page = await self._catalog_get_next(next_url, account_alias, "media_catalog")
        videos.sort(key=lambda video: video.published_at, reverse=True)
        return videos[:limit] if limit is not None else videos

    @with_retry(max_retries=3)
    async def get_channel_stats(self, account_alias: str) -> ChannelStats:
        instagram_user_id = self._token_manager.target_id(self.PLATFORM, account_alias)
        if not instagram_user_id:
            raise PlatformAPIError(
                "Instagram account has no professional-account ID. Reconnect it from Canales.",
                platform=self.PLATFORM,
                status_code=400,
            )
        data = await self._catalog_get_json(
            quote(instagram_user_id, safe=""),
            {"fields": "followers_count,media_count"},
            account_alias,
            "account_stats",
        )
        return ChannelStats(
            video_count=_optional_int(data.get("media_count")),
            followers=_optional_int(data.get("followers_count")),
        )

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
        started_at = time.monotonic()
        if not video_path.is_file():
            raise PlatformAPIError(
                f"Instagram video file does not exist: {video_path.name}",
                platform=self.PLATFORM,
                status_code=400,
            )
        token = await self._token_manager.get_valid_token(self.PLATFORM, account_alias)
        state = self._token_manager._storage.get_state(self.PLATFORM, account_alias)
        instagram_user_id = state.target_id
        if not instagram_user_id:
            raise PlatformAPIError(
                "Instagram account has no professional-account ID. Reconnect it from Canales.",
                platform=self.PLATFORM,
                status_code=400,
            )

        # Reels: ≤ 300 MB y audio ≤ 128 kbps; si no cumple se sube una copia apta.
        video_path = await reels_safe_video(video_path)
        try:
            signed_token = create_signed_media_token(video_path, ttl_seconds=3600)
        except ValueError as exc:
            raise PlatformAPIError(
                "Instagram publishing needs an MP4 stored under the configured output directory.",
                platform=self.PLATFORM,
                status_code=400,
                body=str(exc),
            ) from exc

        public_origin = settings.public_app_url.rstrip("/")
        video_url = f"{public_origin}/api/v1/publish/instagram/media/{signed_token}"
        hashtag_caption = " ".join(f"#{tag.lstrip('#')}" for tag in tags if tag.strip("#"))
        caption = "\n\n".join(part for part in (title.strip(), description.strip(), hashtag_caption) if part)
        caption = caption[:2200]
        file_size = video_path.stat().st_size
        try:
            duration = (await probe(video_path)).duration_seconds
        except Exception:  # noqa: BLE001 — sin duración se espera según el peso
            duration = 0.0

        logger.info(
            "instagram_reel_create_start",
            account=account_alias,
            instagram_user_id=instagram_user_id,
            video_file=video_path.name,
            file_size_bytes=file_size,
        )
        async with self._make_client(upload=True) as client:
            container_id = await self._create_container(
                client, instagram_user_id, {
                    "media_type": "REELS",
                    "video_url": video_url,
                    "caption": caption,
                    "share_to_feed": "true",
                    "access_token": token,
                },
            )
            # Un timeout acá NO re-crea el contenedor: Meta volvería a bajar el archivo entero.
            await self._wait_until_ready(client, container_id, token, _poll_window_seconds(file_size, duration))
            media_id = await self._publish_container(client, instagram_user_id, container_id, token)

            permalink = await self._permalink(client, media_id, token)

        final_url = permalink or f"https://www.instagram.com/reel/{media_id}/"
        logger.info(
            "instagram_reel_publish_success",
            account=account_alias,
            media_id=str(media_id),
            elapsed_seconds=round(time.monotonic() - started_at, 2),
        )
        return PublishVideoResult(
            post_id=str(media_id),
            url=final_url,
            platform=self.PLATFORM,
            account_alias=account_alias,
            raw_response={"id": str(media_id), "container_id": str(container_id), "permalink": permalink},
        )

    @with_retry(max_retries=3)
    async def _create_container(
        self, client: httpx.AsyncClient, instagram_user_id: str, data: dict[str, str]
    ) -> str:
        response = await client.post(f"{_GRAPH_BASE}/{quote(instagram_user_id, safe='')}/media", data=data)
        if response.status_code >= 400:
            self._handle_api_error(response, "Instagram Reel container creation")
        container_id = response.json().get("id")
        if not container_id:
            raise PlatformAPIError(
                f"Instagram did not return a media-container ID: {response.text[:250]}",
                platform=self.PLATFORM,
                status_code=response.status_code,
            )
        return str(container_id)

    async def _wait_until_ready(
        self, client: httpx.AsyncClient, container_id: str, token: str, window_seconds: float
    ) -> None:
        """Meta baja el MP4 firmado en segundo plano: se consulta el estado hasta FINISHED.

        ERROR/EXPIRED no se reintentan (el archivo no va a cambiar); un fallo de red
        puntual en la consulta tampoco corta la espera.
        """
        deadline = time.monotonic() + window_seconds
        last_status = ""
        while True:
            try:
                status_response = await client.get(
                    f"{_GRAPH_BASE}/{quote(container_id, safe='')}",
                    params={"fields": "status_code,status", "access_token": token},
                )
            except httpx.TransportError as exc:
                logger.warning("instagram_reel_status_network_error", container_id=container_id, error=str(exc))
                status_response = None
            if status_response is not None:
                if status_response.status_code >= 400:
                    self._handle_api_error(status_response, "Instagram Reel processing status")
                status_data = status_response.json()
                status_code = str(status_data.get("status_code") or "").upper()
                last_status = f"{status_code} {status_data.get('status') or ''}".strip()
                if status_code == "FINISHED":
                    return
                if status_code in {"ERROR", "EXPIRED"}:
                    raise PlatformAPIError(
                        f"Instagram media processing returned {status_code}: {status_data.get('status') or ''}",
                        platform=self.PLATFORM,
                        status_code=400,
                        body=str(status_data)[:400],
                    )
            if time.monotonic() >= deadline:
                logger.warning("instagram_reel_processing_timeout", container_id=container_id, last_status=last_status)
                raise PlatformAPIError(
                    f"Instagram did not finish processing the Reel within {round(window_seconds)} s.",
                    platform=self.PLATFORM,
                    status_code=504,
                )
            await asyncio.sleep(_POLL_INTERVAL_SECONDS)

    @with_retry(max_retries=3)
    async def _publish_container(
        self, client: httpx.AsyncClient, instagram_user_id: str, container_id: str, token: str
    ) -> str:
        response = await client.post(
            f"{_GRAPH_BASE}/{quote(instagram_user_id, safe='')}/media_publish",
            data={"creation_id": container_id, "access_token": token},
        )
        if response.status_code >= 400:
            self._handle_api_error(response, "Instagram Reel publish")
        media_id = response.json().get("id")
        if not media_id:
            raise PlatformAPIError(
                f"Instagram did not return a published-media ID: {response.text[:250]}",
                platform=self.PLATFORM,
                status_code=response.status_code,
            )
        return str(media_id)

    async def _permalink(self, client: httpx.AsyncClient, media_id: str, token: str) -> str | None:
        """El Reel ya salió: si falla la consulta del enlace, se usa uno armado con el ID."""
        try:
            response = await client.get(
                f"{_GRAPH_BASE}/{quote(media_id, safe='')}",
                params={"fields": "id,permalink,caption,media_type,timestamp", "access_token": token},
            )
        except httpx.HTTPError as exc:
            logger.warning("instagram_reel_permalink_failed", media_id=media_id, error=str(exc))
            return None
        return response.json().get("permalink") if response.status_code == 200 else None

    async def get_video(self, video_id: str, account_alias: str) -> VideoMetadata:
        token = await self._token_manager.get_valid_token(self.PLATFORM, account_alias)
        url = f"{_GRAPH_BASE}/{quote(video_id, safe='')}"
        async with self._make_client() as client:
            response = await client.get(
                url,
                params={
                    "fields": "id,caption,media_type,permalink,timestamp",
                    "access_token": token,
                },
            )
        if response.status_code >= 400:
            self._handle_api_error(response, "Instagram media lookup")
        data = response.json()
        return VideoMetadata(
            video_id=str(data.get("id") or video_id),
            title=str(data.get("caption") or ""),
            description="",
            tags=[],
            status=str(data.get("media_type") or "published").lower(),
            platform=self.PLATFORM,
            raw_response=data,
        )

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
        raise UnsupportedOperationError(
            "Instagram does not support editing a published Reel through this API. Delete it in Instagram and publish again."
        )

    async def delete_video(self, video_id: str, account_alias: str) -> bool:
        raise UnsupportedOperationError(
            "Instagram media deletion is not enabled in Nexa Brief. Delete this Reel in Instagram."
        )
