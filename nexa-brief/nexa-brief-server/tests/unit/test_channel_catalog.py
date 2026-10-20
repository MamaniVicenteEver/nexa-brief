from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest

from src.adapters.publishing.facebook_adapter import FacebookAdapter
from src.adapters.publishing.instagram_adapter import InstagramAdapter
from src.adapters.publishing.youtube_adapter import _duration_seconds, _remote_video


class _FakeClient:
    def __init__(self, responses: list[dict]):
        self.responses = iter(responses)
        self.calls: list[tuple[str, dict | None]] = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return None

    async def get(self, url: str, *, params: dict | None = None, **_kwargs):
        self.calls.append((url, params))
        data = next(self.responses)
        return httpx.Response(200, json=data, request=httpx.Request("GET", "https://graph.facebook.com"))


def _token_manager(target_id: str) -> MagicMock:
    token_manager = MagicMock()
    token_manager.target_id.return_value = target_id
    token_manager.get_valid_token = AsyncMock(return_value="catalog-test-token")
    return token_manager


@pytest.mark.parametrize(
    ("value", "expected"),
    [("PT1M12S", 72.0), ("P1DT2H3M4S", 93_784.0), ("PT0S", 0.0), (None, None), ("bad", None)],
)
def test_youtube_duration_seconds(value: str | None, expected: float | None):
    assert _duration_seconds(value) == expected


def test_youtube_remote_video_normalizes_metadata():
    video = _remote_video(
        {
            "id": "yt-1",
            "snippet": {
                "title": "Uploaded title",
                "publishedAt": "2025-01-02T03:04:05Z",
                "thumbnails": {"high": {"url": "https://img.example/high.jpg"}},
            },
            "contentDetails": {"duration": "PT1M12S"},
            "statistics": {"viewCount": "120", "likeCount": "9", "commentCount": "2"},
            "status": {"privacyStatus": "unlisted"},
        }
    )

    assert video.post_id == "yt-1"
    assert video.title == "Uploaded title"
    assert video.privacy == "unlisted"
    assert video.duration_seconds == 72.0
    assert video.thumbnail_url == "https://img.example/high.jpg"
    assert (video.views, video.likes, video.comments) == (120, 9, 2)


@pytest.mark.asyncio
async def test_facebook_catalog_paginates_deduplicates_and_counts_reels():
    fake_client = _FakeClient(
        [
            {
                "data": [
                    {"id": "fb-1", "description": "Primera línea\nTexto", "created_time": "2025-01-02T03:04:05+0000"},
                    {"id": "fb-2", "title": "Normal title", "created_time": "2025-01-03T03:04:05+0000"},
                ],
                "paging": {"next": "https://graph.facebook.com/v-test/page/videos?after=cursor&access_token=page-token"},
            },
            {"data": [{"id": "fb-3", "title": "Third", "created_time": "2025-01-04T03:04:05+0000"}]},
            {
                "data": [
                    {"id": "fb-2", "title": "Reel version", "created_time": "2025-01-03T03:04:05+0000"},
                    {"id": "fb-4", "description": "Reel caption", "length": 22.5, "picture": "https://img.example/reel.jpg"},
                ]
            },
            {"followers_count": None, "fan_count": "42"},
        ]
    )
    adapter = FacebookAdapter(_token_manager("page-123"))
    adapter._make_client = lambda **_kwargs: fake_client

    videos = await adapter.list_channel_videos("pagina_1")
    stats = await adapter.get_channel_stats("pagina_1")

    assert [video.post_id for video in videos] == ["fb-3", "fb-2", "fb-1", "fb-4"]
    assert videos[2].title == "Primera línea"
    assert videos[1].kind == "reel"  # Reel edge wins when both edges include the same ID.
    assert videos[3].duration_seconds == 22.5
    assert videos[3].thumbnail_url == "https://img.example/reel.jpg"
    assert all(video.views is None and video.likes is None and video.comments is None for video in videos)
    assert stats.video_count == 4
    assert stats.followers == 42
    assert "/page-123/videos" in fake_client.calls[0][0]
    assert fake_client.calls[0][1]["type"] == "uploaded"
    assert "/page-123/video_reels" in fake_client.calls[2][0]
    assert fake_client.calls[3][1]["fields"] == "followers_count,fan_count"


@pytest.mark.asyncio
async def test_instagram_catalog_paginates_and_filters_media_types():
    fake_client = _FakeClient(
        [
            {
                "data": [
                    {"id": "image-1", "media_type": "IMAGE", "caption": "Skip me"},
                    {
                        "id": "ig-reel",
                        "media_type": "VIDEO",
                        "media_product_type": "REELS",
                        "caption": "Reel title\nMore copy",
                        "permalink": "https://www.instagram.com/reel/ig-reel/",
                        "timestamp": "2025-01-03T03:04:05+00:00",
                        "thumbnail_url": "https://img.example/reel.jpg",
                        "like_count": "11",
                        "comments_count": "3",
                    },
                ],
                "paging": {"next": "https://graph.facebook.com/v-test/ig-user/media?after=cursor&access_token=page-token"},
            },
            {
                "data": [
                    {
                        "id": "ig-video",
                        "media_type": "VIDEO",
                        "media_product_type": "FEED",
                        "caption": "Feed video",
                        "timestamp": "2025-01-02T03:04:05+00:00",
                        "like_count": 6,
                        "comments_count": 1,
                    },
                    {"id": "album-1", "media_type": "CAROUSEL_ALBUM", "caption": "Skip album"},
                ]
            },
            {"followers_count": "87", "media_count": "123"},
        ]
    )
    adapter = InstagramAdapter(_token_manager("ig-user-123"))
    adapter._make_client = lambda **_kwargs: fake_client

    videos = await adapter.list_channel_videos("instagram_1")
    stats = await adapter.get_channel_stats("instagram_1")

    assert [video.post_id for video in videos] == ["ig-reel", "ig-video"]
    assert videos[0].title == "Reel title"
    assert videos[0].kind == "reel"
    assert videos[0].thumbnail_url == "https://img.example/reel.jpg"
    assert (videos[0].likes, videos[0].comments, videos[0].views) == (11, 3, None)
    assert videos[1].kind == "video"
    assert stats.video_count == 123
    assert stats.followers == 87
    assert "/ig-user-123/media" in fake_client.calls[0][0]
    assert fake_client.calls[0][1]["fields"] == (
        "id,caption,media_type,media_product_type,permalink,timestamp,thumbnail_url,like_count,comments_count"
    )
    assert fake_client.calls[2][1]["fields"] == "followers_count,media_count"
