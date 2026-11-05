"""Read-only verification of comment scopes; never assume a local flag is a grant."""
from __future__ import annotations

import asyncio
import hashlib
import logging
import time
from typing import Any

import httpx

from src.config.settings import settings

COMMENT_PERMISSIONS = {
    "facebook": "pages_manage_engagement",
    "instagram": "instagram_manage_comments",
}


class _HideDebugTokenRequests(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        # httpx logs complete query strings at INFO. Never log token introspection.
        return "/debug_token" not in record.getMessage()


_debug_filter = _HideDebugTokenRequests()
logging.getLogger("httpx").addFilter(_debug_filter)


class MetaCommentPermissionVerifier:
    def __init__(self, token_manager: Any = None, *, client_factory: Any = None, app_id: str | None = None, app_secret: str | None = None):
        self.token_manager = token_manager
        self.client_factory = client_factory or httpx.AsyncClient
        self.app_id = settings.facebook_client_id if app_id is None else app_id
        self.app_secret = settings.facebook_client_secret if app_secret is None else app_secret
        self._cache: dict[tuple[str, str, str], tuple[float, bool | None]] = {}
        self._locks: dict[tuple[str, str], asyncio.Lock] = {}

    async def can_comment(self, platform: str, alias: str) -> bool | None:
        if platform not in COMMENT_PERMISSIONS or not self.app_id or not self.app_secret:
            return None
        lock = self._locks.setdefault((platform, alias), asyncio.Lock())
        async with lock:
            try:
                manager = self.token_manager
                if manager is None:
                    from .factory import get_publisher_facade
                    manager = get_publisher_facade()._token_manager
                credential = await manager.get_valid_token(platform, alias)
                key = (platform, alias, hashlib.sha256(credential.encode()).hexdigest())
                previous = self._cache.get(key)
                if previous and previous[0] > time.monotonic():
                    return previous[1]
                # POST is deliberately not used: this reads authorization only.
                async with self.client_factory(timeout=15) as client:
                    response = await client.get(
                        f"https://graph.facebook.com/{settings.meta_graph_api_version}/debug_token",
                        params={"input_token": credential},
                        headers={"Authorization": f"Bearer {self.app_id}|{self.app_secret}"},
                    )
                if response.status_code != 200:
                    allowed = None
                else:
                    data = response.json().get("data", {})
                    allowed = (
                        bool(data.get("is_valid"))
                        and str(data.get("app_id") or "") == self.app_id
                        and COMMENT_PERMISSIONS[platform] in data.get("scopes", [])
                    )
                self._cache = {k: v for k, v in self._cache.items() if v[0] > time.monotonic()}
                self._cache[key] = (time.monotonic() + (120 if allowed else 10), allowed)
                return allowed
            except Exception:
                # Do not log exceptions containing credential-bearing URLs.
                return None
