"""Token Storage — encrypted persistence of OAuth tokens for all 6 accounts.

Architecture:
  - All access_token / refresh_token values are encrypted with Fernet (AES-256-CBC + HMAC-SHA256)
    before being written to accounts.json.
  - Tokens are decrypted in-memory only when needed and never logged in plain text.
  - Writes are atomic: write to a .tmp file, then rename to replace the original.
    This prevents corrupted JSON if the process is killed mid-write.
  - The encryption key lives only in PUBLISHER_ENCRYPTION_KEY (.env).
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import structlog
from cryptography.fernet import Fernet, InvalidToken

from src.config.exceptions import TokenError
from src.core.realtime.event_bus import get_event_bus
from src.core.realtime.events import RealtimeEvent

logger = structlog.get_logger(__name__)


@dataclass
class TokenState:
    """In-memory view of one account's token state (decrypted fields are NOT stored here)."""
    name: str
    target_id: str
    encrypted_access_token: str
    encrypted_refresh_token: str | None = None
    expires_at: float | None = None          # Unix timestamp
    refresh_expires_at: float | None = None  # Unix timestamp; TikTok only
    status: str = "ok"                       # "ok" | "requires_reauth"

    @property
    def is_expired(self) -> bool:
        """Return True if the access token has already expired."""
        if self.expires_at is None:
            return False  # Tokens with no expiry (Facebook Page tokens) never expire
        return time.time() >= self.expires_at

    @property
    def expires_in_seconds(self) -> float:
        """Seconds until token expiry; 0 if already expired or no expiry."""
        if self.expires_at is None:
            return float("inf")
        return max(0.0, self.expires_at - time.time())

    @property
    def requires_reauth(self) -> bool:
        return self.status == "requires_reauth"


class TokenStorage:
    """Encrypted, atomic JSON-backed token store for all accounts."""

    def __init__(self, path: Path, encryption_key: str) -> None:
        if not encryption_key:
            raise TokenError(
                "PUBLISHER_ENCRYPTION_KEY is not set. "
                "Generate one with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
            )
        self._path = path
        try:
            self._fernet = Fernet(encryption_key.encode())
        except Exception as exc:
            raise TokenError(f"Invalid PUBLISHER_ENCRYPTION_KEY: {exc}") from exc
        self._data: dict[str, Any] = self._load()
        logger.info(
            "token_storage_loaded",
            path=str(path),
            platforms=list(self._data.keys()),
        )

    def _load(self) -> dict[str, Any]:
        """Load and parse accounts.json. Returns empty dict if missing."""
        if not self._path.exists():
            logger.warning("token_storage_file_missing", path=str(self._path))
            return {}
        try:
            raw = self._path.read_text(encoding="utf-8").strip()
            if not raw:
                return {}
            data = json.loads(raw)
            return data
        except (json.JSONDecodeError, OSError) as exc:
            logger.error("token_storage_load_error", path=str(self._path), error=str(exc))
            raise TokenError(f"Cannot load accounts.json: {exc}") from exc

    def _save(self) -> None:
        """Atomically write self._data back to accounts.json."""
        tmp = self._path.with_suffix(".tmp")
        try:
            tmp.write_text(json.dumps(self._data, indent=2, ensure_ascii=False), encoding="utf-8")
            tmp.replace(self._path)
        except OSError as exc:
            logger.error("token_storage_save_error", path=str(self._path), error=str(exc))
            raise TokenError(f"Cannot save accounts.json: {exc}") from exc

    def encrypt(self, plain_text: str) -> str:
        """Encrypt a plain-text token string; returns a base64 Fernet token."""
        return self._fernet.encrypt(plain_text.encode()).decode()

    def decrypt(self, encrypted: str) -> str:
        """Decrypt a Fernet-encrypted token; raises TokenError on failure."""
        try:
            return self._fernet.decrypt(encrypted.encode()).decode()
        except InvalidToken as exc:
            logger.error("token_decryption_failed", hint="Key mismatch or corrupted token")
            raise TokenError("Token decryption failed — key mismatch or corrupted data") from exc

    def get_state(self, platform: str, alias: str) -> TokenState:
        """Return the TokenState for the given account. Raises TokenError if missing."""
        entry = self._data.get(platform, {}).get(alias)
        if entry is None:
            raise TokenError(
                f"Account '{alias}' not found in platform '{platform}'. "
                f"Check accounts.json and ACTIVE_ACCOUNT setting."
            )
        return TokenState(
            name=entry.get("name", alias),
            target_id=entry.get("target_id", ""),
            encrypted_access_token=entry["encrypted_access_token"],
            encrypted_refresh_token=entry.get("encrypted_refresh_token"),
            expires_at=entry.get("expires_at"),
            refresh_expires_at=entry.get("refresh_expires_at"),
            status=entry.get("status", "ok"),
        )

    def list_accounts(self) -> list[dict[str, Any]]:
        """Return all configured accounts with their status (tokens are NOT included).

        Re-reads accounts.json from disk first: the OAuth callback endpoints
        each open their own short-lived TokenStorage instance to save new
        tokens, separate from this (long-lived, singleton) one used by the
        API's account-listing endpoint — without this reload, a newly
        connected account would stay invisible here until the process
        restarts."""
        self._data = self._load()
        result = []
        for platform, accounts in self._data.items():
            for alias, entry in accounts.items():
                expires_in = None
                if entry.get("expires_at"):
                    expires_in = max(0.0, entry["expires_at"] - time.time())
                result.append({
                    "platform": platform,
                    "alias": alias,
                    "name": entry.get("name", alias),
                    "target_id": entry.get("target_id", ""),
                    "status": entry.get("status", "ok"),
                    "expires_in_seconds": expires_in,
                    "has_refresh_token": bool(entry.get("encrypted_refresh_token")),
                    "avatar": entry.get("avatar"),
                })
        return result

    def save_tokens(
        self,
        platform: str,
        alias: str,
        *,
        access_token: str,
        refresh_token: str | None = None,
        expires_in: int | None = None,
        refresh_expires_in: int | None = None,
    ) -> None:
        """Encrypt and persist updated tokens for the given account."""
        if platform not in self._data:
            self._data[platform] = {}
        if alias not in self._data[platform]:
            self._data[platform][alias] = {}

        entry = self._data[platform][alias]
        entry["encrypted_access_token"] = self.encrypt(access_token)
        entry["status"] = "ok"

        if expires_in is not None:
            entry["expires_at"] = time.time() + expires_in
        if refresh_token is not None:
            entry["encrypted_refresh_token"] = self.encrypt(refresh_token)
        if refresh_expires_in is not None:
            entry["refresh_expires_at"] = time.time() + refresh_expires_in

        self._save()
        logger.info(
            "token_saved",
            platform=platform,
            account=alias,
            expires_in_seconds=expires_in,
        )

    async def mark_requires_reauth(self, platform: str, alias: str, reason: str = "") -> None:
        """Flag an account as needing manual re-authentication."""
        if platform not in self._data:
            self._data[platform] = {}
        if alias not in self._data[platform]:
            self._data[platform][alias] = {}

        self._data[platform][alias]["status"] = "requires_reauth"
        self._save()
        logger.error(
            "token_reauth_required",
            platform=platform,
            account=alias,
            reason=reason,
        )
        await get_event_bus().publish(
            RealtimeEvent(
                type="channel_status_changed",
                data={"platform": platform, "alias": alias, "status": "requires_reauth", "reason": reason},
            )
        )

    def remove_account(self, platform: str, alias: str) -> bool:
        """Delete an account's stored tokens. Returns True if it existed and was removed."""
        accounts = self._data.get(platform)
        if not accounts or alias not in accounts:
            return False

        del accounts[alias]
        if not accounts:
            del self._data[platform]
        self._save()
        logger.info("token_account_removed", platform=platform, account=alias)
        return True
