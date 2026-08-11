"""Unit tests for TokenStorage — encrypted persistence layer."""

from __future__ import annotations

import json
import time
from pathlib import Path

import pytest
from cryptography.fernet import Fernet

from src.config.exceptions import TokenError
from src.adapters.publishing.token_storage import TokenStorage


@pytest.fixture
def key() -> str:
    return Fernet.generate_key().decode()


@pytest.fixture
def accounts_json(tmp_path: Path, key: str) -> Path:
    """Create a minimal accounts.json with one TikTok account."""
    storage = TokenStorage(path=tmp_path / "accounts.json", encryption_key=key)
    storage.save_tokens(
        "tiktok",
        "cuenta_1",
        access_token="test_access_token",
        refresh_token="test_refresh_token",
        expires_in=86400,
    )
    return tmp_path / "accounts.json"


def test_encrypt_decrypt_roundtrip(key: str, tmp_path: Path):
    """Encrypted token decrypts back to original value."""
    storage = TokenStorage(tmp_path / "accounts.json", key)
    original = "my_super_secret_token_abc123"
    encrypted = storage.encrypt(original)
    assert encrypted != original
    assert storage.decrypt(encrypted) == original


def test_save_and_load_token(key: str, tmp_path: Path):
    """Saved token is retrievable via get_state."""
    storage = TokenStorage(tmp_path / "accounts.json", key)
    storage.save_tokens(
        "youtube", "canal_1",
        access_token="yt_access_123",
        refresh_token="yt_refresh_456",
        expires_in=3600,
    )
    state = storage.get_state("youtube", "canal_1")
    assert storage.decrypt(state.encrypted_access_token) == "yt_access_123"
    assert storage.decrypt(state.encrypted_refresh_token) == "yt_refresh_456"
    assert state.expires_at is not None
    assert state.expires_at > time.time()


def test_atomic_write(key: str, tmp_path: Path):
    """JSON file is valid after save_tokens (atomic write)."""
    path = tmp_path / "accounts.json"
    storage = TokenStorage(path, key)
    storage.save_tokens("facebook", "pagina_1", access_token="fb_page_token")
    data = json.loads(path.read_text())
    assert "facebook" in data
    assert "pagina_1" in data["facebook"]


def test_missing_account_raises(key: str, tmp_path: Path):
    """get_state raises TokenError for unknown account."""
    storage = TokenStorage(tmp_path / "accounts.json", key)
    with pytest.raises(TokenError, match="not found"):
        storage.get_state("tiktok", "nonexistent_alias")


def test_mark_requires_reauth(key: str, tmp_path: Path):
    """Marking an account as requires_reauth persists to JSON."""
    storage = TokenStorage(tmp_path / "accounts.json", key)
    storage.save_tokens("tiktok", "cuenta_1", access_token="tok", expires_in=100)
    storage.mark_requires_reauth("tiktok", "cuenta_1", reason="test")
    state = storage.get_state("tiktok", "cuenta_1")
    assert state.requires_reauth is True
    assert state.status == "requires_reauth"


def test_token_expiry_detection(key: str, tmp_path: Path):
    """TokenState correctly reports expired tokens."""
    storage = TokenStorage(tmp_path / "accounts.json", key)
    storage.save_tokens("tiktok", "cuenta_1", access_token="tok", expires_in=-10)  # Already expired
    state = storage.get_state("tiktok", "cuenta_1")
    assert state.is_expired is True
    assert state.expires_in_seconds == 0.0


def test_empty_encryption_key_raises():
    """TokenStorage raises TokenError if no encryption key is provided."""
    with pytest.raises(TokenError, match="PUBLISHER_ENCRYPTION_KEY"):
        TokenStorage(Path("/tmp/test.json"), encryption_key="")


def test_list_accounts(key: str, tmp_path: Path):
    """list_accounts returns entries without exposing tokens."""
    storage = TokenStorage(tmp_path / "accounts.json", key)
    storage.save_tokens("youtube", "canal_1", access_token="tok1", expires_in=3600)
    storage.save_tokens("facebook", "pagina_1", access_token="tok2")

    accounts = storage.list_accounts()
    assert len(accounts) == 2

    for acc in accounts:
        assert "encrypted_access_token" not in acc
        assert "name" in acc
        assert "platform" in acc
        assert "status" in acc
