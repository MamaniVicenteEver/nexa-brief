"""Short-lived, one-use signatures for extension session imports."""

from __future__ import annotations

import secrets
import threading
import time
from urllib.parse import urlencode

from src.presentation.api.security import sign_link, verify_link

PAIRING_TTL_SECONDS = 600
_lock = threading.Lock()
_pairings: dict[str, dict[str, float | str | bool]] = {}


def create_pairing(alias: str, origin: str) -> tuple[str, str]:
    if not __import__("re").fullmatch(r"[a-z0-9][a-z0-9_-]{0,31}", alias):
        raise ValueError("Alias inválido.")
    pairing_id = secrets.token_urlsafe(18)
    path = f"/api/v1/publish/browser/tiktok/import/{pairing_id}"
    signature = sign_link(path, PAIRING_TTL_SECONDS)
    with _lock:
        now = time.time()
        for expired_id in [key for key, item in _pairings.items() if float(item["expires_at"]) <= now]:
            _pairings.pop(expired_id, None)
        _pairings[pairing_id] = {"alias": alias, "expires_at": now + PAIRING_TTL_SECONDS, "consumed": False}
    return pairing_id, f"{origin.rstrip('/')}{path}?{urlencode({'k': signature})}"


def consume_pairing(pairing_id: str, signature: str | None) -> str | None:
    if not signature:
        return None
    path = f"/api/v1/publish/browser/tiktok/import/{pairing_id}"
    if not verify_link(path, signature):
        return None
    with _lock:
        entry = _pairings.get(pairing_id)
        if not entry or bool(entry["consumed"]) or float(entry["expires_at"]) <= time.time():
            return None
        entry["consumed"] = True
        return str(entry["alias"])


def reset_pairings_for_tests() -> None:
    with _lock:
        _pairings.clear()

