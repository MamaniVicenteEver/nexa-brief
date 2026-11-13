from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
import pytest
import httpx

from src.adapters.publishing.youtube_adapter import YouTubeAdapter
from src.adapters.publishing.facebook_adapter import FacebookAdapter
from src.adapters.publishing.token_manager import TokenManager


@pytest.fixture
def mock_token_manager():
    manager = MagicMock(spec=TokenManager)
    manager.get_valid_token = AsyncMock(return_value="mock_token_123")
    # Mocking storage and state
    storage = MagicMock()
    state = MagicMock()
    state.target_id = "mock_target_id"
    storage.get_state.return_value = state
    manager._storage = storage
    return manager


@pytest.mark.asyncio
async def test_youtube_playlists(mock_token_manager):
    adapter = YouTubeAdapter(mock_token_manager)

    # 1. Test list_playlists
    mock_list_resp = httpx.Response(
        200,
        json={
            "items": [
                {
                    "id": "playlist_1",
                    "snippet": {"title": "Lofi Chill"}
                }
            ]
        }
    )

    # 2. Test create_playlist
    mock_create_resp = httpx.Response(
        201,
        json={"id": "new_playlist_id"}
    )

    # 3. Test add_video_to_playlist
    mock_add_resp = httpx.Response(201, json={"id": "item_id"})

    with patch.object(adapter, "_make_client") as mock_make_client:
        mock_client = MagicMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.get = AsyncMock(return_value=mock_list_resp)
        mock_client.post = AsyncMock(side_effect=[mock_create_resp, mock_add_resp])
        mock_make_client.return_value = mock_client

        # Test listing
        playlists = await adapter.list_playlists("canal_1")
        assert len(playlists) == 1
        assert playlists[0]["id"] == "playlist_1"
        assert playlists[0]["title"] == "Lofi Chill"

        # Test creation
        playlist_id = await adapter.create_playlist("New List", "Desc", "canal_1")
        assert playlist_id == "new_playlist_id"

        # Test adding
        success = await adapter.add_video_to_playlist("video_abc", "playlist_1", "canal_1")
        assert success is True


@pytest.mark.asyncio
async def test_facebook_publish_as_reel(mock_token_manager, tmp_path):
    adapter = FacebookAdapter(mock_token_manager)

    # Create fake video file
    video_file = tmp_path / "test_reel.mp4"
    video_file.write_bytes(b"reel binary content")

    # Phase 1 response
    mock_start_resp = httpx.Response(
        200,
        json={"video_id": "reel_video_id_123", "upload_url": "https://upload.facebook.com/reel"}
    )

    # Phase 2 response
    mock_transfer_resp = httpx.Response(200, json={"success": True})

    # Phase 3 response
    mock_finish_resp = httpx.Response(
        200,
        json={"success": True, "video_id": "reel_video_id_123"}
    )

    with patch.object(adapter, "_make_client") as mock_make_client:
        mock_client = MagicMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.post = AsyncMock(side_effect=[mock_start_resp, mock_transfer_resp, mock_finish_resp])
        mock_make_client.return_value = mock_client

        result = await adapter.publish(
            video_path=video_file,
            title="Cool Reel",
            description="Reel description",
            tags=["reel", "vibes"],
            account_alias="pagina_1",
            publish_as_reel=True
        )

        assert result.post_id == "reel_video_id_123"
        assert "reels/reel_video_id_123" in result.url
        assert result.raw_response["format"] == "reel"
