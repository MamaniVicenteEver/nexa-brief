"""Channel-specific evidence and thumbnail retries without a second video upload."""
from io import BytesIO
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from PIL import Image

from src.adapters.publishing.youtube_adapter import YouTubeAdapter
from src.config.exceptions import PlatformAPIError
from src.core.data import collection
from src.core.youtube_capabilities import (
    record_thumbnail_result, reset_thumbnail_capability, thumbnail_capability,
)


async def test_capabilities_are_isolated_by_channel_and_reconnection_resets():
    await record_thumbnail_result("one", "UC1", {"status": "applied", "reason": "accepted"})
    assert thumbnail_capability("one", "UC1")["state"] == "enabled"
    assert thumbnail_capability("two", "UC2")["state"] == "unknown"
    assert thumbnail_capability("one", "UC_DIFFERENT")["state"] == "unknown"
    await record_thumbnail_result("two", "UC2", {"status": "failed", "reason": "permissions"})
    assert thumbnail_capability("two", "UC2")["state"] == "unavailable"
    assert thumbnail_capability("one", "UC1")["state"] == "enabled"
    await reset_thumbnail_capability("two", "UC2")
    assert thumbnail_capability("two", "UC2")["state"] == "unknown"


@pytest.mark.parametrize("reason", ["quota", "rate_limit", "network", "invalid_image", "oauth_scope", "reauth_required"])
async def test_transient_errors_do_not_disable_verified_channel(reason):
    await record_thumbnail_result("one", "UC1", {"status": "applied", "reason": "accepted"})
    await record_thumbnail_result("one", "UC1", {"status": "failed", "reason": reason})
    assert thumbnail_capability("one", "UC1")["state"] == "enabled"


@pytest.mark.parametrize("status,code,reason", [
    (401, "authError", "reauth_required"),
    (403, "quotaExceeded", "quota"),
    (403, "insufficientPermissions", "oauth_scope"),
    (403, "forbidden", "permissions"),
    (429, "uploadRateLimitExceeded", "rate_limit"),
    (400, "invalidImage", "invalid_image"),
    (404, "videoNotFound", "video_not_found"),
    (503, "backendError", "provider_unavailable"),
])
async def test_thumbnail_errors_classified_without_exposing_provider_payload(tmp_path, status, code, reason):
    adapter = YouTubeAdapter(MagicMock())
    client = MagicMock()
    client.__aenter__.return_value = client
    client.post = AsyncMock(return_value=httpx.Response(status, json={"error": {"errors": [{"reason": code}]}}))
    image = tmp_path / "thumbnail.jpg"
    image.write_bytes(b"image")
    with patch.object(adapter, "_make_client", return_value=client):
        result = await adapter._upload_thumbnail("secret-placeholder", "video", image)
    assert result == {"status": "failed", "reason": reason}


async def test_retry_rejects_video_owned_by_a_different_channel(tmp_path):
    manager = MagicMock()
    manager._storage.get_state.return_value.target_id = "UC1"
    adapter = YouTubeAdapter(manager)
    adapter.get_channel_profile = AsyncMock(return_value=MagicMock(channel_id="UC1"))
    adapter.get_video = AsyncMock(return_value=MagicMock(raw_response={"snippet": {"channelId": "UC2"}}))
    adapter._upload_thumbnail = AsyncMock()
    with pytest.raises(PlatformAPIError):
        await adapter.upload_thumbnail("video", "one", tmp_path / "image.jpg")
    adapter._upload_thumbnail.assert_not_called()


async def test_retry_updates_only_the_image_and_records_evidence(tmp_path):
    manager = MagicMock()
    manager._storage.get_state.return_value.target_id = "UC1"
    manager.get_valid_token = AsyncMock(return_value="test-token")
    adapter = YouTubeAdapter(manager)
    adapter.get_channel_profile = AsyncMock(return_value=MagicMock(channel_id="UC1"))
    adapter.get_video = AsyncMock(return_value=MagicMock(raw_response={"snippet": {"channelId": "UC1"}}))
    adapter._upload_thumbnail = AsyncMock(return_value={"status": "applied", "reason": "accepted"})
    adapter.publish = AsyncMock()
    await adapter.upload_thumbnail("video", "one", tmp_path / "image.jpg")
    adapter.publish.assert_not_called()
    assert thumbnail_capability("one", "UC1")["state"] == "enabled"


async def test_upload_endpoint_validates_content_before_contacting_youtube(api_client):
    with patch("src.presentation.api.routers.publisher._get_facade") as facade:
        response = await api_client.post("/api/v1/publish/youtube/one/video/thumbnail", files={"file": ("fake.jpg", b"not an image", "image/jpeg")})
    assert response.status_code == 422
    facade.assert_not_called()


async def test_upload_endpoint_does_not_trust_filename(api_client):
    image = BytesIO()
    Image.new("RGB", (1280, 720)).save(image, "PNG")
    adapter = MagicMock()
    adapter.upload_thumbnail = AsyncMock(return_value={"status": "applied", "reason": "accepted"})
    facade = MagicMock()
    facade.list_accounts.return_value = [{"platform": "youtube", "alias": "one"}]
    facade._adapters = {"youtube": adapter}
    with patch("src.presentation.api.routers.publisher._get_facade", return_value=facade):
        response = await api_client.post("/api/v1/publish/youtube/one/video/thumbnail", files={"file": ("../../fake.jpg", image.getvalue(), "image/jpeg")})
    assert response.status_code == 200
    assert response.json()["status"] == "applied"
    assert adapter.upload_thumbnail.call_args.args[2].suffix == ".png"
    assert not adapter.upload_thumbnail.call_args.args[2].exists()


async def test_account_projection_exposes_capability_for_only_its_channel():
    from src.presentation.api.routers.publisher import _account_response
    await collection("channels").upsert({"platform": "youtube", "alias": "one", "target_id": "UC1"}, match=("platform", "alias"))
    await record_thumbnail_result("one", "UC1", {"status": "applied", "reason": "accepted"})
    facade = MagicMock()
    account = {"platform": "youtube", "alias": "one", "name": "One", "target_id": "UC1", "status": "ok", "expires_in_seconds": None, "has_refresh_token": True}
    with patch("src.presentation.api.routers.publisher._get_facade", return_value=facade):
        assert _account_response(account).youtube_thumbnail_capability["state"] == "enabled"


@pytest.mark.parametrize("items,status", [([], 409), ([{"id": "UC1", "snippet": {"title": "One"}}, {"id": "UC2", "snippet": {"title": "Two"}}], 409)])
async def test_oauth_never_saves_an_unknown_or_ambiguous_channel(api_client, items, status):
    client = MagicMock()
    client.__aenter__.return_value = client
    client.post = AsyncMock(return_value=httpx.Response(200, json={"access_token": "test", "refresh_token": "test-refresh"}))
    client.get = AsyncMock(return_value=httpx.Response(200, json={"items": items}))
    storage = MagicMock()
    storage.list_accounts.return_value = []
    with patch("src.presentation.api.routers.publisher._load_google_credentials", return_value=("id", "secret")), patch("src.presentation.api.routers.publisher.TokenStorage", return_value=storage), patch("src.presentation.api.routers.publisher.httpx.AsyncClient", return_value=client), patch("src.presentation.api.routers.publisher.settings") as settings:
        settings.publisher_encryption_key = "test-key"
        response = await api_client.get("/api/v1/publish/auth/youtube/callback?code=test&state=one")
    assert response.status_code == status
    storage.save_tokens.assert_not_called()


async def test_publish_keeps_video_success_when_thumbnail_is_rejected(tmp_path, monkeypatch):
    from src.adapters.publishing import youtube_adapter as module
    monkeypatch.setattr(module.settings, "youtube_wait_for_hd", False)
    manager = MagicMock()
    manager.get_valid_token = AsyncMock(return_value="test-token")
    manager._storage.get_state.return_value.target_id = "UC1"
    adapter = YouTubeAdapter(manager)
    adapter._init_resumable_session = AsyncMock(return_value="session")
    adapter._upload_chunks = AsyncMock(return_value="video")
    adapter._poll_processing = AsyncMock()
    adapter._upload_thumbnail = AsyncMock(return_value={"status": "failed", "reason": "permissions"})
    video = tmp_path / "video.mp4"
    video.write_bytes(b"test")
    result = await adapter.publish(video, "Title", "Description", [], "one", thumbnail_path=tmp_path / "image.jpg")
    assert result.post_id == "video"
    assert result.raw_response["thumbnail"] == {"status": "failed", "reason": "permissions"}
    adapter._upload_chunks.assert_awaited_once()
    assert thumbnail_capability("one", "UC1")["state"] == "unavailable"


async def test_five_channels_are_listed_without_a_four_channel_limit(api_client):
    facade = MagicMock()
    facade.list_accounts.return_value = [{"platform": "youtube", "alias": f"channel_{i}", "name": f"Channel {i}", "target_id": f"UC{i}", "status": "ok", "expires_in_seconds": None, "has_refresh_token": True} for i in range(5)]
    facade.catalog_for.return_value = None
    with patch("src.presentation.api.routers.publisher._get_facade", return_value=facade), patch("src.presentation.api.routers.publisher._register_service_accounts", new=AsyncMock()):
        response = await api_client.get("/api/v1/publish/accounts")
    assert response.status_code == 200
    assert len(response.json()) == 5
    assert len({a["target_id"] for a in response.json()}) == 5


async def test_oauth_uses_all_pages_and_does_not_save_the_first_channel(api_client):
    client = MagicMock()
    client.__aenter__.return_value = client
    client.post = AsyncMock(return_value=httpx.Response(200, json={"access_token": "test"}))
    client.get = AsyncMock(side_effect=[
        httpx.Response(200, json={"items": [{"id": "UC1", "snippet": {"title": "One"}}], "nextPageToken": "page2"}),
        httpx.Response(200, json={"items": [{"id": "UC2", "snippet": {"title": "Two"}}]}, request=httpx.Request("GET", "https://www.googleapis.com/youtube/v3/channels")),
    ])
    storage = MagicMock()
    storage.list_accounts.return_value = []
    with patch("src.presentation.api.routers.publisher._load_google_credentials", return_value=("id", "secret")), patch("src.presentation.api.routers.publisher.TokenStorage", return_value=storage), patch("src.presentation.api.routers.publisher.httpx.AsyncClient", return_value=client), patch("src.presentation.api.routers.publisher.settings") as settings:
        settings.publisher_encryption_key = "test-key"
        response = await api_client.get("/api/v1/publish/auth/youtube/callback?code=test&state=one")
    assert response.status_code == 409
    assert client.get.await_count == 2
    assert client.get.call_args.kwargs["params"]["pageToken"] == "page2"
    storage.save_tokens.assert_not_called()


async def test_reconnecting_the_same_channel_does_not_create_a_second_alias(api_client):
    client = MagicMock()
    client.__aenter__.return_value = client
    client.post = AsyncMock(return_value=httpx.Response(200, json={"access_token": "test", "refresh_token": "refresh"}))
    client.get = AsyncMock(return_value=httpx.Response(200, json={"items": [{"id": "UC1", "snippet": {"title": "One"}}]}))
    storage = MagicMock()
    storage.list_accounts.return_value = [{"platform": "youtube", "alias": "original", "target_id": "UC1"}]
    with patch("src.presentation.api.routers.publisher._load_google_credentials", return_value=("id", "secret")), patch("src.presentation.api.routers.publisher.TokenStorage", return_value=storage), patch("src.presentation.api.routers.publisher.httpx.AsyncClient", return_value=client), patch("src.presentation.api.routers.publisher._update_channels_json", new=AsyncMock()), patch("src.presentation.api.routers.publisher.settings") as settings:
        settings.publisher_encryption_key = "test-key"
        response = await api_client.get("/api/v1/publish/auth/youtube/callback?code=test&state=new_alias")
    assert response.status_code == 200
    assert storage.save_tokens.call_args.kwargs["alias"] == "original"


async def test_title_update_preserves_category_language_and_other_metadata():
    from src.core.ports.publisher_port import VideoMetadata
    manager = MagicMock()
    manager.get_valid_token = AsyncMock(return_value="test-token")
    adapter = YouTubeAdapter(manager)
    adapter.get_video = AsyncMock(return_value=VideoMetadata(
        video_id="video", title="Old", description="Keep this", tags=["keep"], status="processed", platform="youtube",
        raw_response={"snippet": {"categoryId": "28", "defaultLanguage": "es"}},
    ))
    client = MagicMock()
    client.__aenter__.return_value = client
    client.put = AsyncMock(return_value=httpx.Response(200, json={"id": "video", "snippet": {"title": "New"}}))
    with patch.object(adapter, "_make_client", return_value=client):
        await adapter.update_video("video", "one", title="New")
    sent = client.put.call_args.kwargs["json"]["snippet"]
    assert sent == {"title": "New", "description": "Keep this", "tags": ["keep"], "categoryId": "28", "defaultLanguage": "es"}
