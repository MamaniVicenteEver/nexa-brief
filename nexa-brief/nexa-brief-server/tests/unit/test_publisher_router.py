from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
import hashlib
import hmac
import time
import pytest
from fastapi.testclient import TestClient

from src.presentation.main import app
from src.config.settings import settings as app_settings

client = TestClient(app)


@pytest.fixture(autouse=True)
def synthetic_public_origin(monkeypatch):
    monkeypatch.setattr(app_settings, "public_app_url", "https://nexa.example")


@pytest.fixture
def mock_facade():
    with patch("src.presentation.api.routers.publisher.get_publisher_facade") as mock_get:
        facade = MagicMock()
        mock_get.return_value = facade
        yield facade


def test_list_accounts_api(mock_facade):
    mock_facade.list_accounts.return_value = [
        {
            "platform": "youtube",
            "alias": "canal_1",
            "name": "My Channel",
            "target_id": "channel_abc",
            "status": "ok",
            "expires_in_seconds": 3600.0,
            "has_refresh_token": True,
            "avatar": "https://avatar.url/1",
        }
    ]

    response = client.get("/api/v1/publish/accounts")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["platform"] == "youtube"
    assert data[0]["alias"] == "canal_1"
    assert data[0]["avatar"] == "https://avatar.url/1"


def test_youtube_playlists_api(mock_facade):
    from unittest.mock import AsyncMock
    mock_yt = MagicMock()
    mock_yt.list_playlists = AsyncMock(return_value=[{"id": "playlist_1", "title": "Cool Playlist"}])
    mock_facade._adapters = {"youtube": mock_yt}

    response = client.get("/api/v1/publish/youtube/canal_1/playlists")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["id"] == "playlist_1"
    assert data[0]["title"] == "Cool Playlist"


@patch("src.presentation.api.routers.publisher._load_google_credentials")
def test_youtube_oauth_start(mock_load_creds):
    mock_load_creds.return_value = ("client_id_123", "secret_123")
    response = client.get("/api/v1/publish/auth/youtube/start?alias=canal_test", follow_redirects=False)
    assert response.status_code == 307
    location = response.headers["location"]
    assert "accounts.google.com" in location
    assert "client_id_123" in location
    assert "canal_test" in location


@patch("src.presentation.api.routers.publisher.settings")
def test_facebook_oauth_start(mock_settings):
    mock_settings.facebook_client_id = "fb_app_id_123"
    response = client.get("/api/v1/publish/auth/facebook/start?alias=pagina_test", follow_redirects=False)
    assert response.status_code == 307
    location = response.headers["location"]
    assert "facebook.com" in location
    assert "fb_app_id_123" in location
    assert "pagina_test" in location

    from urllib.parse import parse_qs, urlparse

    scopes = parse_qs(urlparse(location).query)["scope"][0].split(",")
    assert {"pages_manage_posts", "pages_show_list", "pages_read_engagement",
            "pages_manage_engagement", "pages_read_user_content"} <= set(scopes)
    assert "pages_read_user_engagement" not in scopes
    assert len(scopes) == len(set(scopes))


@patch("src.presentation.api.routers.publisher.settings")
def test_tiktok_oauth_callback(mock_settings, tmp_path):
    mock_settings.tiktok_business_app_id = "tiktok_id"
    mock_settings.tiktok_business_secret = "synthetic"
    mock_settings.tiktok_business_redirect_uri = "https://example.test/callback"
    mock_settings.publisher_encryption_key = "synthetic-signing-key"
    mock_settings.accounts_json_path = tmp_path / "accounts.json"
    storage = MagicMock()
    storage._data = {}
    payload = f"tiktok:cuenta_custom:{int(time.time()) + 600}:synthetic-nonce"
    signature = hmac.new(b"synthetic-signing-key", payload.encode(), hashlib.sha256).hexdigest()
    with patch("src.presentation.api.routers.publisher.build_credential_store", return_value=storage), \
         patch("src.presentation.api.routers.publisher._update_channels_json", new_callable=AsyncMock), \
         patch("src.presentation.api.routers.publisher.TikTokBusinessClient.exchange_code", new_callable=AsyncMock, return_value={
             "access_token": "tk_access_val", "refresh_token": "tk_refresh_val", "expires_in": 3600, "open_id": "open_id_123"}), \
         patch("src.presentation.api.routers.publisher.TikTokBusinessClient.get_profile", new_callable=AsyncMock, return_value=None):
        response = client.get("/api/v1/publish/auth/tiktok/callback", params={"code": "mock_code", "state": f"{payload}:{signature}"},
                              cookies={"nexa_tiktok_oauth_state": "synthetic-nonce"})
    assert response.status_code == 200
    assert "Cuenta conectada" in response.text
    assert "TikTok" in response.text

    storage.save_tokens.assert_called_once_with(
        platform="tiktok",
        alias="cuenta_custom",
        access_token="tk_access_val",
        refresh_token="tk_refresh_val",
        expires_in=3600,
        refresh_expires_in=None,
        api_provider="tiktok_business",
        target_id="open_id_123",
    )


@patch("src.presentation.api.routers.publisher.settings")
def test_tiktok_oauth_callback_rejects_unsigned_state(mock_settings):
    mock_settings.publisher_encryption_key = "synthetic-signing-key"
    with patch("src.presentation.api.routers.publisher.build_credential_store") as store:
        response = client.get("/api/v1/publish/auth/tiktok/callback?code=mock_code&state=cuenta_custom")
    assert response.status_code == 400
    store.assert_not_called()


@patch("src.presentation.api.routers.publisher._load_google_credentials")
@patch("src.presentation.api.routers.publisher.settings")
@patch("httpx.AsyncClient")
def test_youtube_oauth_callback(mock_httpx, mock_settings, mock_load_creds, tmp_path):
    from unittest.mock import AsyncMock
    mock_load_creds.return_value = ("yt_id", "yt_secret")
    mock_settings.publisher_encryption_key = "a" * 44
    mock_settings.accounts_json_path = tmp_path / "accounts.json"

    mock_storage = MagicMock()
    mock_storage.list_accounts.return_value = []

    mock_client = MagicMock()
    mock_httpx.return_value.__aenter__.return_value = mock_client

    mock_token_resp = MagicMock()
    mock_token_resp.status_code = 200
    mock_token_resp.json.return_value = {
        "access_token": "yt_access_val",
        "refresh_token": "yt_refresh_val",
        "expires_in": 3600,
    }

    mock_channel_resp = MagicMock()
    mock_channel_resp.status_code = 200
    mock_channel_resp.json.return_value = {
        "items": [
            {
                "id": "channel_id_123",
                "snippet": {
                    "title": "My Awesome Channel",
                    "thumbnails": {"default": {"url": "https://avatar.url/yt"}}
                }
            }
        ]
    }

    mock_client.post = AsyncMock(return_value=mock_token_resp)
    mock_client.get = AsyncMock(return_value=mock_channel_resp)

    with patch("src.presentation.api.routers.publisher.build_credential_store", return_value=mock_storage), \
         patch("src.presentation.api.routers.publisher._update_channels_json", new_callable=AsyncMock):
        response = client.get("/api/v1/publish/auth/youtube/callback?code=mock_code&state=canal_custom")
    assert response.status_code == 200
    assert "Cuenta conectada" in response.text
    assert "YouTube" in response.text

    mock_storage.save_tokens.assert_called_once_with(
        platform="youtube",
        alias="canal_custom",
        access_token="yt_access_val",
        refresh_token="yt_refresh_val",
        expires_in=3600,
    )


@patch("src.presentation.api.routers.publisher.settings")
@patch("httpx.AsyncClient")
def test_facebook_oauth_callback(mock_httpx, mock_settings, tmp_path):
    from unittest.mock import AsyncMock
    mock_settings.facebook_client_id = "fb_id"
    mock_settings.facebook_client_secret = "fb_secret"
    mock_settings.publisher_encryption_key = "a" * 44
    mock_settings.accounts_json_path = tmp_path / "accounts.json"

    mock_storage = MagicMock()
    mock_storage.list_accounts.return_value = []
    mock_storage._data = {}

    mock_client = MagicMock()
    mock_httpx.return_value.__aenter__.return_value = mock_client

    mock_user_tok_resp = MagicMock()
    mock_user_tok_resp.status_code = 200
    mock_user_tok_resp.json.return_value = {"access_token": "fb_user_token"}

    mock_long_tok_resp = MagicMock()
    mock_long_tok_resp.status_code = 200
    mock_long_tok_resp.json.return_value = {"access_token": "fb_long_lived_user_token"}

    mock_pages_resp = MagicMock()
    mock_pages_resp.status_code = 200
    mock_pages_resp.json.return_value = {
        "data": [
            {
                "name": "My Cool Page",
                "id": "page_id_999",
                "access_token": "fb_page_token_abc"
            }
        ]
    }

    mock_client.get = AsyncMock(side_effect=[mock_user_tok_resp, mock_long_tok_resp, mock_pages_resp])

    with patch("src.presentation.api.routers.publisher.build_credential_store", return_value=mock_storage), \
         patch("src.presentation.api.routers.publisher._update_channels_json", new_callable=AsyncMock):
        response = client.get("/api/v1/publish/auth/facebook/callback?code=mock_code&state=pagina_custom")
    assert response.status_code == 200
    assert "Cuenta conectada" in response.text
    assert "Facebook" in response.text

    mock_storage.save_tokens.assert_called_once_with(
        platform="facebook",
        alias="pagina_custom",
        access_token="fb_page_token_abc",
        expires_in=None,
    )


