"""Publishing via TikTok for Business Accounts API."""
from __future__ import annotations

import asyncio
import time
from pathlib import Path
from typing import Any

from src.adapters.publishing.instagram_media_url import create_signed_media_url
from src.adapters.publishing.tiktok_adapter import TikTokAdapter
from src.adapters.publishing.tiktok_business_client import TikTokBusinessClient, TikTokBusinessError
from src.config.exceptions import PlatformAPIError, UnsupportedOperationError
from src.core.ports.publisher_port import PublishVideoResult
from src.core.ports.channel_catalog_port import ChannelCatalogPort, ChannelStats, RemoteVideo


class TikTokBusinessAdapter(TikTokAdapter, ChannelCatalogPort):
    async def list_channel_videos(self, account_alias: str, *, limit: int | None = None) -> list[RemoteVideo]:
        token = await self._token_manager.get_valid_token("tiktok", account_alias)
        account = self._token_manager._storage.get_state("tiktok", account_alias)
        videos: list[RemoteVideo] = []
        cursor = None
        seen = set()
        try:
            async with self._make_client() as http:
                client = TikTokBusinessClient(http)
                while True:
                    page = await client.list_videos(access_token=token, business_id=account.target_id, cursor=cursor)
                    for item in page.get("videos", []):
                        if not item.get("item_id"):
                            continue
                        videos.append(RemoteVideo(post_id=str(item["item_id"]), url=str(item.get("share_url") or ""), title=str(item.get("caption") or ""), published_at=float(item.get("create_time") or 0), thumbnail_url=item.get("thumbnail_url"), views=item.get("video_views"), likes=item.get("likes"), comments=item.get("comments")))
                        if limit is not None and len(videos) >= limit:
                            return videos
                    next_cursor = page.get("cursor")
                    if not page.get("has_more") or next_cursor is None or next_cursor in seen:
                        break
                    seen.add(next_cursor)
                    cursor = next_cursor
            return videos
        except TikTokBusinessError as exc:
            raise PlatformAPIError(str(exc), platform="tiktok") from exc

    async def get_channel_stats(self, account_alias: str) -> ChannelStats:
        token = await self._token_manager.get_valid_token("tiktok", account_alias)
        account = self._token_manager._storage.get_state("tiktok", account_alias)
        try:
            async with self._make_client() as http:
                data = await TikTokBusinessClient(http).get_account_stats(access_token=token, business_id=account.target_id)
            return ChannelStats(video_count=data.get("videos_count"), followers=data.get("followers_count"), likes=data.get("total_likes"))
        except TikTokBusinessError as exc:
            raise PlatformAPIError(str(exc), platform="tiktok") from exc

    async def publish(self, video_path: Path, title: str, description: str, tags: list[str],
                      account_alias: str, *, privacy: str = "public", **kwargs: Any) -> PublishVideoResult:
        if privacy != "public":
            raise UnsupportedOperationError("TikTok Business publishing currently supports public posts only.")
        token = await self._token_manager.get_valid_token("tiktok", account_alias)
        account = self._token_manager._storage.get_state("tiktok", account_alias)
        try:
            video_url = create_signed_media_url(video_path, ttl_seconds=3600)
        except ValueError as exc:
            raise PlatformAPIError("No se pudo preparar una URL pública firmada para el video.", platform="tiktok") from exc
        caption = " ".join([title.strip(), *(f"#{tag}" for tag in tags)]).strip()[:2200]
        try:
            async with self._make_client() as http:
                client = TikTokBusinessClient(http)
                result = await client.publish_video(access_token=token, business_id=account.target_id,
                                                    video_url=video_url, caption=caption)
                task_id = result.get("share_id")
                if not task_id:
                    raise TikTokBusinessError("TikTok no devolvió el identificador de publicación")
                deadline = time.monotonic() + 180
                while time.monotonic() < deadline:
                    status = await client.publish_status(access_token=token, business_id=account.target_id,
                                                         publish_id=str(task_id))
                    if status.get("status") == "PUBLISH_COMPLETE":
                        ids = status.get("post_ids") or []
                        post_id = str(ids[0]) if ids else str(task_id)
                        return PublishVideoResult(post_id=post_id, url="https://www.tiktok.com/tiktokstudio/content",
                                                  platform="tiktok", account_alias=account_alias,
                                                  raw_response={"publish_id": task_id, "status": status.get("status")})
                    if status.get("status") in {"FAILED", "SEND_TO_USER_INBOX"}:
                        raise TikTokBusinessError(f"Publicación no completada: {status.get('status')}")
                    await asyncio.sleep(5)
                raise TikTokBusinessError(f"TikTok sigue procesando la publicación {task_id}; revisa su estado antes de reintentar")
        except TikTokBusinessError as exc:
            raise PlatformAPIError(str(exc), platform="tiktok") from exc

    async def get_video(self, video_id: str, account_alias: str):
        raise UnsupportedOperationError("Consulta el estado de TikTok Business desde TikTok Studio.")

    async def delete_video(self, video_id: str, account_alias: str):
        raise UnsupportedOperationError("Elimina el video desde TikTok Studio.")
