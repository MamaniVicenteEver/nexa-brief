"""Short-lived signed URLs that let Meta fetch an MP4 during Reel publishing."""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from pathlib import Path

from src.config.settings import settings


def _signing_key() -> bytes:
    key = settings.publisher_encryption_key
    if not key:
        raise ValueError("PUBLISHER_ENCRYPTION_KEY is not configured")
    return key.encode()


def create_signed_media_token(video_path: Path, *, ttl_seconds: int = 3600) -> str:
    """Create an opaque HMAC token for one output MP4, valid for a short time."""
    root = Path(settings.output_dir).resolve()
    resolved = video_path.resolve()
    if not resolved.is_file() or not resolved.is_relative_to(root) or resolved.suffix.lower() != ".mp4":
        raise ValueError("Video must be an existing MP4 inside OUTPUT_DIR")
    payload = json.dumps(
        {"path": resolved.relative_to(root).as_posix(), "exp": int(time.time()) + ttl_seconds},
        separators=(",", ":"),
    ).encode()
    encoded = base64.urlsafe_b64encode(payload).rstrip(b"=").decode()
    signature = hmac.new(_signing_key(), encoded.encode(), hashlib.sha256).hexdigest()
    return f"{encoded}.{signature}"


def resolve_signed_media_token(token: str) -> Path:
    """Validate signature/expiry and resolve only a file below OUTPUT_DIR."""
    if not token or len(token) > 4096 or "." not in token:
        raise ValueError("Invalid token")
    encoded, received_signature = token.rsplit(".", 1)
    expected = hmac.new(_signing_key(), encoded.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(received_signature, expected):
        raise ValueError("Invalid signature")
    try:
        padding = "=" * (-len(encoded) % 4)
        payload = json.loads(base64.urlsafe_b64decode(encoded + padding))
        relative = Path(str(payload["path"]))
        expires_at = int(payload["exp"])
    except Exception as exc:
        raise ValueError("Invalid token payload") from exc
    if expires_at < int(time.time()):
        raise ValueError("Expired token")
    if relative.is_absolute() or ".." in relative.parts:
        raise ValueError("Invalid file path")
    root = Path(settings.output_dir).resolve()
    path = (root / relative).resolve()
    if not path.is_relative_to(root) or not path.is_file() or path.suffix.lower() != ".mp4":
        raise ValueError("Media file not found")
    return path
