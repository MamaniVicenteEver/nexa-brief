from __future__ import annotations

from dataclasses import dataclass

import pytest

from src.core import publish_log
from src.core.channel_sync import sync_channel
from src.core.data import collection
from src.core.ports.channel_catalog_port import ChannelStats, RemoteVideo


@dataclass
class _FakeCatalog:
    videos: list[RemoteVideo]
    stats: ChannelStats

    async def list_channel_videos(self, account_alias: str, *, limit: int | None = None) -> list[RemoteVideo]:
        return self.videos[:limit] if limit is not None else self.videos

    async def get_channel_stats(self, account_alias: str) -> ChannelStats:
        return self.stats


@pytest.mark.asyncio
async def test_sync_imports_updates_without_duplicates_and_saves_stats():
    await collection("channels").insert({"platform": "facebook", "alias": "pagina_1"})
    await publish_log.record_published_video(
        platform="facebook",
        alias="pagina_1",
        post_id="known-by-nexa",
        url="https://facebook.com/known-by-nexa",
        title="Title Nexa published",
        published_at=100.0,
    )
    catalog = _FakeCatalog(
        videos=[
            RemoteVideo(
                post_id="known-by-nexa",
                url="https://facebook.com/known-by-nexa",
                title="Remote title",
                published_at=100.0,
                views=25,
                likes=4,
                comments=1,
                thumbnail_url="https://img.example/known.jpg",
            ),
            RemoteVideo(
                post_id="already-on-page",
                url="https://facebook.com/already-on-page",
                title="Imported title",
                published_at=200.0,
                kind="reel",
                duration_seconds=30.0,
            ),
        ],
        stats=ChannelStats(video_count=8, followers=900, views=12_000),
    )

    first = await sync_channel("facebook", "pagina_1", catalog)
    second = await sync_channel("facebook", "pagina_1", catalog)

    videos = publish_log.list_published_videos("facebook", "pagina_1")
    assert (first.remote_total, first.imported, first.updated) == (2, 1, 1)
    assert (second.remote_total, second.imported, second.updated) == (2, 0, 2)
    assert len(videos) == 2
    nexabook = next(video for video in videos if video["post_id"] == "known-by-nexa")
    imported = next(video for video in videos if video["post_id"] == "already-on-page")
    assert nexabook["origin"] == "nexa"
    assert nexabook["title"] == "Title Nexa published"
    assert nexabook["metrics"]["views"] == 25
    assert imported["origin"] == "imported"
    assert imported["published_at"] == 200.0
    assert imported["kind"] == "reel"
    assert collection("channels").first({"platform": "facebook", "alias": "pagina_1"})["stats"] == {
        "video_count": 8,
        "followers": 900,
        "views": 12_000,
        "extra": {},
    }
    assert collection("channels").first({"platform": "facebook", "alias": "pagina_1"})["synced_at"] == second.synced_at


@pytest.mark.asyncio
async def test_sync_reconciles_a_nexa_record_with_a_wrong_id_instead_of_duplicating():
    """Un registro de Nexa con un id que la red no conoce (p. ej. el id de sesión de la subida) se
    corrige con el post real si coinciden título y fecha; uno de otra fecha no se toca."""
    await collection("channels").insert({"platform": "facebook", "alias": "pagina_9"})
    await publish_log.record_published_video(
        platform="facebook", alias="pagina_9", post_id="session_123", url="https://x/session_123",
        title="Dueles  Tan Bien", published_at=1_000_000.0,
    )
    await publish_log.record_published_video(
        platform="facebook", alias="pagina_9", post_id="session_old", url="https://x/session_old",
        title="Otro video", published_at=1_000_000.0,
    )
    catalog = _FakeCatalog(
        videos=[
            RemoteVideo(post_id="real-1", url="https://facebook.com/reel/real-1/", title="dueles tan bien",
                        published_at=1_000_000.0 + 3600),
            RemoteVideo(post_id="real-2", url="https://facebook.com/reel/real-2/", title="Otro video",
                        published_at=1_000_000.0 + 10 * 86_400),
        ],
        stats=ChannelStats(video_count=2),
    )

    summary = await sync_channel("facebook", "pagina_9", catalog)

    by_id = {v["post_id"]: v for v in publish_log.list_published_videos("facebook", "pagina_9")}
    assert (summary.imported, summary.updated) == (1, 1)
    assert set(by_id) == {"real-1", "session_old", "real-2"}
    assert by_id["real-1"]["origin"] == "nexa"
    assert by_id["real-1"]["url"] == "https://facebook.com/reel/real-1/"
    assert by_id["real-2"]["origin"] == "imported"
