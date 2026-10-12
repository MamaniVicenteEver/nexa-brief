"""Unit tests for TokenManager — auto-refresh logic with mocked HTTP calls."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from cryptography.fernet import Fernet

from src.config.exceptions import TokenExpiredError
from src.adapters.publishing.token_storage import TokenStorage
from src.adapters.publishing.token_manager import TokenManager


@pytest.fixture
def key() -> str:
    return Fernet.generate_key().decode()


@pytest.fixture
def storage_with_fresh_token(tmp_path: Path, key: str) -> TokenStorage:
    storage = TokenStorage(tmp_path / "accounts.json", key)
    storage.save_tokens(
        "youtube", "canal_1",
        access_token="fresh_access",
        refresh_token="my_refresh_token",
        expires_in=7200,  # 2 hours — well within margin
    )
    return storage


@pytest.fixture
def storage_with_expiring_token(tmp_path: Path, key: str) -> TokenStorage:
    storage = TokenStorage(tmp_path / "accounts.json", key)
    storage.save_tokens(
        "youtube", "canal_1",
        access_token="old_access",
        refresh_token="my_refresh_token",
        expires_in=60,  # 60 seconds — below 1800s margin, should trigger refresh
    )
    return storage


@pytest.mark.asyncio
async def test_get_valid_token_fresh_token(storage_with_fresh_token):
    """Returns token directly without refreshing if not near expiry."""
    manager = TokenManager(storage_with_fresh_token)
    token = await manager.get_valid_token("youtube", "canal_1")
    assert token == "fresh_access"


@pytest.mark.asyncio
async def test_get_valid_token_refreshes_when_expiring(storage_with_expiring_token, monkeypatch):
    """Triggers refresh when token expires within margin."""
    # Credenciales de la app de prueba: el test no depende del .env de la máquina.
    from src.config.settings import settings

    monkeypatch.setattr(settings, "youtube_client_id", "test-client-id")
    monkeypatch.setattr(settings, "youtube_client_secret", "test-client-secret")
    manager = TokenManager(storage_with_expiring_token)

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "access_token": "new_access_token",
        "expires_in": 3600,
    }

    with patch("httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client_cls.return_value = mock_client

        token = await manager.get_valid_token("youtube", "canal_1")
        assert token == "new_access_token"


@pytest.mark.asyncio
async def test_requires_reauth_raises_immediately():
    """Account marked requires_reauth raises TokenExpiredError without HTTP calls."""
    key = Fernet.generate_key().decode()
    storage = TokenStorage(Path("/tmp/test_reauth.json"), key)
    storage.save_tokens("tiktok", "cuenta_1", access_token="tok", expires_in=3600)
    await storage.mark_requires_reauth("tiktok", "cuenta_1", reason="test")

    manager = TokenManager(storage)
    with pytest.raises(TokenExpiredError, match="requires manual re-authentication"):
        await manager.get_valid_token("tiktok", "cuenta_1")


@pytest.mark.asyncio
async def test_facebook_token_no_refresh_no_expiry(tmp_path: Path, key: str = None):
    """Facebook tokens with no expiry return without any refresh attempt."""
    k = Fernet.generate_key().decode()
    storage = TokenStorage(tmp_path / "accounts.json", k)
    # Facebook page tokens have no expiry
    storage._data = {
        "facebook": {
            "pagina_1": {
                "name": "my_page",
                "target_id": "123456",
                "encrypted_access_token": storage.encrypt("fb_page_token_forever"),
                "expires_at": None,
                "status": "ok",
            }
        }
    }

    manager = TokenManager(storage)
    token = await manager.get_valid_token("facebook", "pagina_1")
    assert token == "fb_page_token_forever"
