"""Token Manager — proactive auto-refresh of OAuth tokens for all 6 accounts.

Design:
  - One asyncio.Lock per (platform, alias) pair prevents concurrent refresh calls
    from hammering the platform API with duplicate refresh requests.
  - Tokens are refreshed BEFORE the next publish call if they will expire
    within publisher_token_refresh_margin_seconds (default 30 min).
  - Facebook Page tokens never expire (acquired from a Long-Lived User Token),
    so _refresh_facebook() is a deliberate no-op.
  - When a refresh call returns a NEW refresh_token (TikTok rotates them),
    both tokens are persisted via TokenStorage.
  - On unrecoverable failures (revoked, bad credentials) the account is marked
    "requires_reauth" in accounts.json and TokenExpiredError is raised.

Structured log events emitted:
  token_expiring_soon       — token will expire within margin
  token_refresh_start       — HTTP call to the platform token endpoint has begun
  token_refresh_success     — new token persisted successfully
  token_refresh_failed      — platform returned non-200; retry will occur
  token_refresh_exhausted   — all retries failed; account marked requires_reauth
  token_valid               — token is fresh, no action needed
  token_no_expiry           — Facebook token; skipping refresh check
"""

from __future__ import annotations

import asyncio
from collections import defaultdict

import httpx
import structlog

from src.config.exceptions import TokenExpiredError, TokenRefreshError
from src.config.settings import settings
from src.adapters.publishing.token_storage import TokenStorage, TokenState

logger = structlog.get_logger(__name__)

_MAX_REFRESH_RETRIES = 3
_REFRESH_BACKOFF_BASE = 2.0  # seconds; exponential: 2s, 4s, 8s


class TokenManager:
    """Manages token lifecycle (validation + refresh) for all configured accounts.

    Usage::

        manager = TokenManager(storage)
        token = await manager.get_valid_token("youtube", "canal_1")
        # → guaranteed to be a fresh, decrypted access token string
    """

    def __init__(self, storage: TokenStorage) -> None:
        self._storage = storage
        # Per-account locks: defaultdict creates a new Lock on first access
        self._locks: dict[str, asyncio.Lock] = defaultdict(asyncio.Lock)

    def _lock_key(self, platform: str, alias: str) -> str:
        return f"{platform}:{alias}"

    # ── Public API ────────────────────────────────────────────────────────────

    def target_id(self, platform: str, alias: str) -> str:
        """Id de la cuenta en su plataforma (canal, página o usuario IG); '' si no hay."""
        return self._storage.get_state(platform, alias).target_id

    def instagram_deletion_token(self, alias: str) -> str | None:
        """El borrado IG requiere token de usuario de Facebook, distinto del token de Página."""
        return self._storage.get_instagram_deletion_token(alias)

    async def get_valid_token(self, platform: str, alias: str) -> str:
        """Return a valid, decrypted access token.

        Transparently refreshes the token if it is within the expiry margin.

        Raises:
            TokenExpiredError: Account is marked requires_reauth or refresh exhausted.
        """
        if self._storage.get_mode(platform, alias) in {"browser", "service"}:
            raise TokenExpiredError(f"Account {platform}:{alias} uses a browser session and has no OAuth token.")
        lock = self._locks[self._lock_key(platform, alias)]
        async with lock:
            state = self._storage.get_state(platform, alias)

            if state.requires_reauth:
                raise TokenExpiredError(
                    f"Account {platform}:{alias} requires manual re-authentication. "
                    f"Check accounts.json status field."
                )

            if state.expires_at is None:
                logger.debug("token_no_expiry", platform=platform, account=alias)
                return self._storage.decrypt(state.encrypted_access_token)

            margin = settings.publisher_token_refresh_margin_seconds
            if state.expires_in_seconds < margin:
                logger.info(
                    "token_expiring_soon",
                    platform=platform,
                    account=alias,
                    expires_in_seconds=round(state.expires_in_seconds),
                    margin_seconds=margin,
                )
                await self._refresh_with_retry(platform, alias, state)
                # Re-read the freshly persisted state
                state = self._storage.get_state(platform, alias)
            else:
                logger.debug(
                    "token_valid",
                    platform=platform,
                    account=alias,
                    expires_in_seconds=round(state.expires_in_seconds),
                )

            return self._storage.decrypt(state.encrypted_access_token)

    async def refresh_account_if_needed(self, platform: str, alias: str) -> None:
        """Public hook for the scheduler and pre-publish checks.

        Idempotent: does nothing if token is still fresh.
        """
        if self._storage.get_mode(platform, alias) in {"browser", "service"}:
            return
        try:
            await self.get_valid_token(platform, alias)
        except TokenExpiredError:
            logger.warning(
                "token_refresh_skipped_reauth_required",
                platform=platform,
                account=alias,
            )

    # ── Internal refresh ──────────────────────────────────────────────────────

    async def _refresh_with_retry(self, platform: str, alias: str, state: TokenState) -> None:
        """Attempt to refresh the token up to _MAX_REFRESH_RETRIES times."""
        for attempt in range(1, _MAX_REFRESH_RETRIES + 1):
            try:
                logger.info(
                    "token_refresh_start",
                    platform=platform,
                    account=alias,
                    attempt=attempt,
                    max_retries=_MAX_REFRESH_RETRIES,
                )
                await self._dispatch_refresh(platform, alias, state)
                logger.info("token_refresh_success", platform=platform, account=alias, attempt=attempt)
                return
            except TokenRefreshError as exc:
                backoff = _REFRESH_BACKOFF_BASE ** attempt
                logger.warning(
                    "token_refresh_failed",
                    platform=platform,
                    account=alias,
                    attempt=attempt,
                    error=str(exc),
                    retry_in_seconds=backoff if attempt < _MAX_REFRESH_RETRIES else None,
                )
                if attempt < _MAX_REFRESH_RETRIES:
                    await asyncio.sleep(backoff)

        # All retries exhausted
        reason = f"Refresh failed after {_MAX_REFRESH_RETRIES} attempts"
        await self._storage.mark_requires_reauth(platform, alias, reason=reason)
        logger.error(
            "token_refresh_exhausted",
            platform=platform,
            account=alias,
            action="Manually re-authenticate via OAuth flow",
        )
        raise TokenExpiredError(
            f"{platform}:{alias} — {reason}. Account marked as requires_reauth."
        )

    async def _dispatch_refresh(self, platform: str, alias: str, state: TokenState) -> None:
        """Route to the correct platform refresh implementation."""
        if platform == "tiktok":
            await self._refresh_tiktok(alias, state)
        elif platform == "youtube":
            await self._refresh_youtube(alias, state)
        elif platform == "facebook":
            await self._refresh_facebook(alias, state)
        elif platform == "instagram":
            await self._refresh_facebook(alias, state)
        else:
            raise TokenRefreshError(f"Unknown platform: {platform}")

    # ── Platform-specific refresh implementations ─────────────────────────────

    async def _refresh_tiktok(self, alias: str, state: TokenState) -> None:
        """Refresh TikTok access token.

        TikTok tokens expire in 24h; refresh tokens last 365 days.
        TikTok may return a new refresh_token — both must be persisted.
        Endpoint: POST https://open.tiktokapis.com/v2/oauth/token/
        """
        if not state.encrypted_refresh_token:
            raise TokenRefreshError(f"TikTok:{alias} — no refresh_token stored. Re-auth required.")

        refresh_token = self._storage.decrypt(state.encrypted_refresh_token)

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                "https://open.tiktokapis.com/v2/oauth/token/",
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                data={
                    "client_key": settings.tiktok_client_id,
                    "client_secret": settings.tiktok_client_secret,
                    "refresh_token": refresh_token,
                    "grant_type": "refresh_token",
                },
            )

        if response.status_code != 200:
            raise TokenRefreshError(
                f"TikTok token refresh failed: HTTP {response.status_code} — {response.text[:200]}"
            )

        data = response.json()
        error = data.get("error") or data.get("data", {}).get("error_code")
        if error:
            raise TokenRefreshError(f"TikTok token refresh error: {data}")

        new_access = data.get("access_token") or data["data"]["access_token"]
        new_refresh = data.get("refresh_token") or data["data"].get("refresh_token")
        expires_in = data.get("expires_in") or data["data"].get("expires_in", 86400)
        refresh_expires_in = (
            data.get("refresh_expires_in") or data["data"].get("refresh_expires_in")
        )

        self._storage.save_tokens(
            "tiktok",
            alias,
            access_token=new_access,
            refresh_token=new_refresh,
            expires_in=expires_in,
            refresh_expires_in=refresh_expires_in,
        )

    async def _refresh_youtube(self, alias: str, state: TokenState) -> None:
        """Refresh YouTube/Google access token.

        Google access tokens expire in 3600 seconds (1 hour).
        Refresh tokens do not expire unless revoked.
        Endpoint: POST https://oauth2.googleapis.com/token

        client_id and client_secret are read from (in order of priority):
          1. settings.youtube_client_id / settings.youtube_client_secret (.env)
          2. The per-account entry in accounts.json (saved by youtube_oauth_setup.py)
        """
        if not state.encrypted_refresh_token:
            raise TokenRefreshError(f"YouTube:{alias} — no refresh_token stored. Re-auth required.")

        refresh_token = self._storage.decrypt(state.encrypted_refresh_token)

        # Prefer global settings; fall back to per-account credentials saved by oauth setup
        client_id = settings.youtube_client_id
        client_secret = settings.youtube_client_secret
        if not client_id or not client_secret:
            account_entry = self._storage._data.get("youtube", {}).get(alias, {})
            client_id     = account_entry.get("client_id", client_id)
            client_secret = account_entry.get("client_secret", client_secret)

        if not client_id or not client_secret:
            raise TokenRefreshError(
                f"YouTube:{alias} — YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET "
                f"are not set in .env and not found in accounts.json. "
                f"Run youtube_oauth_setup.py to configure."
            )

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "refresh_token": refresh_token,
                    "grant_type": "refresh_token",
                },
            )

        if response.status_code != 200:
            raise TokenRefreshError(
                f"YouTube token refresh failed: HTTP {response.status_code} — {response.text[:200]}"
            )

        data = response.json()
        if "error" in data:
            raise TokenRefreshError(f"YouTube token refresh error: {data['error']} — {data.get('error_description')}")

        self._storage.save_tokens(
            "youtube",
            alias,
            access_token=data["access_token"],
            # Google does NOT rotate refresh tokens, so we don't overwrite it
            expires_in=data.get("expires_in", 3600),
        )

    async def _refresh_facebook(self, alias: str, state: TokenState) -> None:  # noqa: ARG002
        """Facebook Page Access Tokens generated from Long-Lived User Tokens never expire.

        This method is intentionally a no-op.  If a Facebook token fails in
        production, it means the user revoked access or changed their password,
        which requires full re-authentication — not a token refresh.
        """
        logger.debug(
            "token_facebook_no_refresh_needed",
            account=alias,
            reason="Facebook Page tokens do not expire when derived from Long-Lived User Token",
        )
