"""Firmas breves para medios que Meta descarga al publicar."""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import mimetypes
import time
from pathlib import Path

from src.config.settings import settings

_MAX_TTL_SECONDS = 3600


def _signing_key() -> bytes:
    key = settings.publisher_encryption_key
    if not key:
        raise ValueError("PUBLISHER_ENCRYPTION_KEY is not configured")
    return key.encode()


def _publication_root() -> Path:
    return (Path(settings.data_dir) / "publicaciones").resolve()


def _reject_symlink_parts(root: Path, path: Path) -> None:
    relative = path.relative_to(root)
    current = root
    for part in relative.parts:
        current = current / part
        if current.is_symlink():
            raise ValueError("Symlinks are not allowed in signed media")


def _resolve_media(media: str | Path) -> tuple[Path, str, str]:
    """Resuelve un key de publicación o una ruta temporal del pipeline de video."""
    publication_root = _publication_root()
    output_root = Path(settings.output_dir).resolve()
    if isinstance(media, Path):
        raw_candidate = media.absolute()
        if raw_candidate.is_relative_to(publication_root):
            root = publication_root
        elif raw_candidate.is_relative_to(output_root):
            root = output_root
        else:
            raise ValueError("Media must be inside the publication store or OUTPUT_DIR")
        _reject_symlink_parts(root, raw_candidate)
        candidate = raw_candidate.resolve()
    else:
        relative = Path(media)
        if relative.is_absolute() or not relative.parts or ".." in relative.parts:
            raise ValueError("Invalid media key")
        root = publication_root
        unresolved = root / relative
        _reject_symlink_parts(root, unresolved)
        candidate = unresolved.resolve()
        if not candidate.is_relative_to(root):
            raise ValueError("Invalid media key")

    if not candidate.is_file():
        raise ValueError("Media file not found")
    suffix = candidate.suffix.lower()
    if suffix in {".jpg", ".jpeg"}:
        mime = "image/jpeg"
        if root != publication_root:
            raise ValueError("JPEG media must be in the publication store")
        with candidate.open("rb") as stream:
            if stream.read(3) != b"\xff\xd8\xff":
                raise ValueError("Media is not a JPEG")
    elif suffix == ".mp4":
        mime = "video/mp4"
        with candidate.open("rb") as stream:
            stream.seek(4)
            if stream.read(4) != b"ftyp":
                raise ValueError("Media is not an MP4")
    else:
        raise ValueError("Only JPEG and MP4 media are supported")
    digest = _sha256(candidate)
    return candidate, mime, digest


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def create_signed_media_token(
    media: str | Path,
    *,
    ttl_seconds: int = 3600,
    expected_sha256: str | None = None,
) -> str:
    """Firma un key final de publicación o un MP4 temporal del pipeline."""
    if ttl_seconds < 1 or ttl_seconds > _MAX_TTL_SECONDS:
        raise ValueError("Media URL TTL must be between 1 and 3600 seconds")
    path, mime, digest = _resolve_media(media)
    if expected_sha256 and not hmac.compare_digest(expected_sha256.lower(), digest):
        raise ValueError("Media hash does not match the approved asset")
    root = _publication_root() if path.is_relative_to(_publication_root()) else Path(settings.output_dir).resolve()
    payload = json.dumps(
        {
            "v": 2,
            "root": "publications" if root == _publication_root() else "output",
            "path": path.relative_to(root).as_posix(),
            "mime": mime,
            "sha256": digest,
            "aud": "meta",
            "exp": int(time.time()) + ttl_seconds,
        },
        separators=(",", ":"),
    ).encode()
    encoded = base64.urlsafe_b64encode(payload).rstrip(b"=").decode()
    signature = hmac.new(_signing_key(), encoded.encode(), hashlib.sha256).hexdigest()
    return f"{encoded}.{signature}"


def create_signed_media_url(
    media: str | Path,
    *,
    ttl_seconds: int = 3600,
    expected_sha256: str | None = None,
) -> str:
    """Devuelve la URL pública de Meta usando la ruta ya expuesta por el router."""
    token = create_signed_media_token(
        media,
        ttl_seconds=ttl_seconds,
        expected_sha256=expected_sha256,
    )
    origin = settings.public_app_url.rstrip("/")
    if not origin:
        raise ValueError("PUBLIC_APP_URL is not configured")
    return f"{origin}/api/v1/publish/instagram/media/{token}"


def resolve_signed_media_token(token: str) -> Path:
    """Verifica HMAC, expiración, audiencia, ubicación, MIME y hash del archivo."""
    if not token or len(token) > 4096 or "." not in token:
        raise ValueError("Invalid token")
    try:
        raw_payload = json.loads(base64.urlsafe_b64decode(token.rsplit(".", 1)[0] + "=" * (-len(token.rsplit(".", 1)[0]) % 4)))
    except Exception:
        raw_payload = {}
    if isinstance(raw_payload, dict) and "key" in raw_payload:
        # Publicación v1: el puerto local es dueño del formato y de la clave lógica.
        from src.adapters.data.local_publication_media import LocalPublicationMedia

        path, _mime = LocalPublicationMedia().resolve_signed_token(token, audience="meta")
        return path
    encoded, received_signature = token.rsplit(".", 1)
    expected = hmac.new(_signing_key(), encoded.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(received_signature, expected):
        raise ValueError("Invalid signature")
    try:
        padding = "=" * (-len(encoded) % 4)
        payload = json.loads(base64.urlsafe_b64decode(encoded + padding))
        expires_at = int(payload["exp"])
        relative = Path(str(payload["path"]))
    except Exception as exc:
        raise ValueError("Invalid token payload") from exc
    if expires_at < int(time.time()):
        raise ValueError("Expired token")
    if relative.is_absolute() or ".." in relative.parts:
        raise ValueError("Invalid media key")

    if payload.get("v") == 2:
        if payload.get("aud") != "meta":
            raise ValueError("Invalid media audience")
        root_name = payload.get("root")
        root = _publication_root() if root_name == "publications" else Path(settings.output_dir).resolve()
        if root_name not in {"publications", "output"}:
            raise ValueError("Invalid media root")
        path = (root / relative).resolve()
        if not path.is_relative_to(root):
            raise ValueError("Invalid media path")
        resolved, mime, digest = _resolve_media(path)
        if mime != payload.get("mime") or not hmac.compare_digest(digest, str(payload.get("sha256", ""))):
            raise ValueError("Media changed after signing")
        return resolved

    # Los tokens MP4 anteriores siguen sirviendo mientras no caduquen.
    root = Path(settings.output_dir).resolve()
    path = (root / relative).resolve()
    if not path.is_relative_to(root) or path.suffix.lower() != ".mp4" or not path.is_file():
        raise ValueError("Media file not found")
    _resolve_media(path)
    return path


def signed_media_mime(path: Path) -> str:
    """Obtiene MIME del tipo permitido ya validado por la firma."""
    mime = mimetypes.guess_type(str(path))[0]
    if mime not in {"image/jpeg", "video/mp4"}:
        raise ValueError("Unsupported signed media type")
    return mime
