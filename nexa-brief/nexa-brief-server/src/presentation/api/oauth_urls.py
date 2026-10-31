"""Helpers for URLs that must be reachable from a user's browser."""

from __future__ import annotations

from urllib.parse import urlsplit

from fastapi import HTTPException

from src.config.settings import settings


def public_app_origin() -> str:
    """Return the canonical app origin configured in the root environment."""
    value = settings.public_app_url.strip().rstrip("/")
    parsed = urlsplit(value)
    hostname = parsed.hostname
    if (
        parsed.scheme not in {"http", "https"}
        or not parsed.netloc
        or hostname is None
        or parsed.username is not None
        or parsed.password is not None
        or parsed.path not in {"", "/"}
        or parsed.query
        or parsed.fragment
    ):
        raise HTTPException(
            status_code=500,
            detail="PUBLIC_APP_URL debe ser un origen válido, por ejemplo https://nexa.example.com.",
        )

    if parsed.scheme != "https" and hostname.lower() not in {"localhost", "127.0.0.1", "::1"}:
        raise HTTPException(
            status_code=500,
            detail="PUBLIC_APP_URL debe usar HTTPS fuera de localhost.",
        )
    return f"{parsed.scheme}://{parsed.netloc}"


def public_url(path: str) -> str:
    """Build a browser-facing URL from the single configured public origin."""
    return f"{public_app_origin()}/{path.lstrip('/')}"
