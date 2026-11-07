from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest

from src.adapters.publishing import youtube_adapter as youtube_module
from src.adapters.publishing.token_manager import TokenManager
from src.adapters.publishing.youtube_adapter import YouTubeAdapter
from src.config.exceptions import PlatformAPIError


@pytest.fixture
def adapter() -> YouTubeAdapter:
    manager = MagicMock(spec=TokenManager)
    manager.get_valid_token = AsyncMock(return_value="test-token")
    storage = MagicMock()
    state = MagicMock()
    state.target_id = "channel-1"
    storage.get_state.return_value = state
    manager._storage = storage
    return YouTubeAdapter(manager)


def _client() -> MagicMock:
    client = MagicMock()
    client.__aenter__.return_value = client
    client.__aexit__.return_value = False
    return client


def _install_publish_stubs(monkeypatch: pytest.MonkeyPatch, adapter: YouTubeAdapter, client: MagicMock) -> None:
    monkeypatch.setattr(adapter, "_make_client", MagicMock(return_value=client))
    monkeypatch.setattr(adapter, "_upload_chunks", AsyncMock(return_value="video-123"))
    monkeypatch.setattr(adapter, "_poll_processing", AsyncMock(return_value=None))


@pytest.mark.asyncio
async def test_public_upload_waits_for_hd_then_makes_public_before_comment(
    adapter: YouTubeAdapter, monkeypatch: pytest.MonkeyPatch, tmp_path
):
    monkeypatch.setattr(youtube_module.settings, "youtube_wait_for_hd", True)
    events: list[str] = []
    client = _client()
    client.post = AsyncMock(return_value=httpx.Response(
        200, headers={"Location": "https://upload.test/session"}
    ))

    async def put(*args, **kwargs):
        events.append("public")
        return httpx.Response(200, json={"id": "video-123"})

    client.put = AsyncMock(side_effect=put)
    _install_publish_stubs(monkeypatch, adapter, client)

    async def wait_for_hd(*args, **kwargs):
        events.append("wait_for_hd")
        return True

    async def post_comment(*args, **kwargs):
        events.append("comment")
        return True

    monkeypatch.setattr(adapter, "_wait_for_hd", AsyncMock(side_effect=wait_for_hd))
    monkeypatch.setattr(adapter, "_post_top_level_comment", AsyncMock(side_effect=post_comment))
    video = tmp_path / "video.mp4"
    video.write_bytes(b"video bytes")

    await adapter.publish(video, "title", "description", [], "canal_1", comment_text="hola")

    init_metadata = client.post.call_args.kwargs["json"]
    assert init_metadata["status"]["privacyStatus"] == "private"
    assert client.put.call_count == 1
    assert client.put.call_args.args[0].endswith("/videos?part=status")
    assert client.put.call_args.kwargs["json"]["status"]["privacyStatus"] == "public"
    assert events == ["wait_for_hd", "public", "comment"]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("wait_for_hd", "privacy", "upload_privacy"),
    [(False, "public", "public"), (True, "unlisted", "unlisted")],
)
async def test_non_held_upload_uses_requested_privacy_without_making_public(
    adapter: YouTubeAdapter,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path,
    wait_for_hd: bool,
    privacy: str,
    upload_privacy: str,
):
    monkeypatch.setattr(youtube_module.settings, "youtube_wait_for_hd", wait_for_hd)
    client = _client()
    client.post = AsyncMock(return_value=httpx.Response(
        200, headers={"Location": "https://upload.test/session"}
    ))
    _install_publish_stubs(monkeypatch, adapter, client)
    wait = AsyncMock(return_value=True)
    make_public = AsyncMock()
    monkeypatch.setattr(adapter, "_wait_for_hd", wait)
    monkeypatch.setattr(adapter, "_make_public", make_public)
    video = tmp_path / "video.mp4"
    video.write_bytes(b"video bytes")

    await adapter.publish(video, "title", "description", [], "canal_1", privacy=privacy)

    assert client.post.call_args.kwargs["json"]["status"]["privacyStatus"] == upload_privacy
    wait.assert_not_awaited()
    make_public.assert_not_awaited()


@pytest.mark.asyncio
async def test_wait_for_hd_returns_true_after_success(adapter: YouTubeAdapter, monkeypatch: pytest.MonkeyPatch):
    client = _client()
    client.get = AsyncMock(return_value=httpx.Response(
        200, json={"items": [{"processingDetails": {"processingStatus": "succeeded"}}]}
    ))
    monkeypatch.setattr(adapter, "_make_client", MagicMock(return_value=client))

    assert await adapter._wait_for_hd("video-123", "canal_1") is True
    client.get.assert_awaited_once()


@pytest.mark.asyncio
async def test_wait_for_hd_returns_false_after_processing_failure(
    adapter: YouTubeAdapter, monkeypatch: pytest.MonkeyPatch
):
    client = _client()
    client.get = AsyncMock(return_value=httpx.Response(
        200, json={"items": [{"processingDetails": {"processingStatus": "failed"}}]}
    ))
    monkeypatch.setattr(adapter, "_make_client", MagicMock(return_value=client))

    assert await adapter._wait_for_hd("video-123", "canal_1") is False
    client.get.assert_awaited_once()


@pytest.mark.asyncio
async def test_wait_for_hd_returns_false_after_timeout(
    adapter: YouTubeAdapter, monkeypatch: pytest.MonkeyPatch
):
    client = _client()
    client.get = AsyncMock(return_value=httpx.Response(200, json={"items": []}))
    monkeypatch.setattr(adapter, "_make_client", MagicMock(return_value=client))
    monkeypatch.setattr(youtube_module.settings, "youtube_hd_max_wait_seconds", 2)
    monkeypatch.setattr(youtube_module, "_HD_POLL_INTERVAL", 1)
    sleep = AsyncMock()
    monkeypatch.setattr(youtube_module.asyncio, "sleep", sleep)

    assert await adapter._wait_for_hd("video-123", "canal_1") is False
    assert client.get.await_count == 2
    assert sleep.await_count == 2


@pytest.mark.asyncio
async def test_make_public_failure_does_not_retry_resumable_upload(
    adapter: YouTubeAdapter, monkeypatch: pytest.MonkeyPatch, tmp_path
):
    monkeypatch.setattr(youtube_module.settings, "youtube_wait_for_hd", True)
    client = _client()
    client.post = AsyncMock(return_value=httpx.Response(
        200, headers={"Location": "https://upload.test/session"}
    ))
    client.put = AsyncMock(return_value=httpx.Response(500, text="temporary server error"))
    _install_publish_stubs(monkeypatch, adapter, client)
    monkeypatch.setattr(adapter, "_wait_for_hd", AsyncMock(return_value=True))
    monkeypatch.setattr(youtube_module.asyncio, "sleep", AsyncMock())
    video = tmp_path / "video.mp4"
    video.write_bytes(b"video bytes")

    with pytest.raises(PlatformAPIError) as raised:
        await adapter.publish(video, "title", "description", [], "canal_1")

    assert client.put.await_count == 3
    assert adapter._upload_chunks.await_count == 1
    assert client.post.await_count == 1
    # The requested value is None, but PlatformAPIError currently defaults it to 0;
    # either way it must stay non-retryable so publish() never uploads twice.
    assert raised.value.status_code not in (429, 500, 502, 503, 504)
