"""Firmas breves para medios que Meta descarga al publicar."""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import mimetypes
import time
from pathlib import Path

from src.config.profile_layout import layout_for_settings
from src.config.settings import settings

_MAX_TTL_SECONDS = 3600


def _signing_key() -> bytes:
    key = settings.publisher_encryption_key
    if not key:
        raise ValueError("PUBLISHER_ENCRYPTION_KEY is not configured")
    return key.encode()


def _publication_roots() -> dict[str, Path]:
    """Names distinguish old tokens from v2 files during profile migration."""
    layout = layout_for_settings(settings)
    if layout.schema_version == 1:
        return {"publications": (layout.data_dir / "publicaciones").resolve()}
    root = layout.root.resolve()
    candidates = {
        "publications_v2": layout.productions_dir / "_publicaciones",
        "publications_legacy": layout.data_dir / "publicaciones",
    }
    if layout.schema_version >= 3:
        candidates["publications_v3"] = layout.renders_dir
    for path in candidates.values():
        current = path
        while True:
            if current.is_symlink():
                raise ValueError("Symlinks are not allowed in publication roots")
            if current == layout.root:
                break
            current = current.parent
        if not path.resolve().is_relative_to(root):
            raise ValueError("Publication root is outside the selected profile")
    return {name: path.resolve() for name, path in candidates.items()}



def _output_roots() -> dict[str, Path]:
    layout = layout_for_settings(settings)
    if layout.schema_version == 1:
        return {"output": Path(settings.output_dir).resolve()}
    roots = {"output": layout.renders_dir, "output_legacy": layout.root / "output"}
    profile = layout.root.resolve()
    for path in roots.values():
        current = path
        while True:
            if current.is_symlink():
                raise ValueError("Symlinks are not allowed in output roots")
            if current == layout.root:
                break
            current = current.parent
        if not path.resolve().is_relative_to(profile):
            raise ValueError("Output root is outside the selected profile")
    return {name: path.resolve() for name, path in roots.items()}

def _reject_symlink_parts(root: Path, path: Path) -> None:
    relative = path.relative_to(root)
    current = root
    for part in relative.parts:
        current = current / part
        if current.is_symlink():
            raise ValueError("Symlinks are not allowed in signed media")


def _resolve_media(media: str | Path) -> tuple[Path, str, str]:
    """Resuelve una clave o ruta en las raíces del perfil seleccionado."""
    publication_roots = list(_publication_roots().values())
    output_roots = list(_output_roots().values())
    if isinstance(media, Path):
        raw_candidate = media.absolute()
        if ".." in raw_candidate.parts:
            raise ValueError("Invalid media key")
        root = next((p for p in [*publication_roots, *output_roots] if raw_candidate.is_relative_to(p)), None)
        if root is None:
            raise ValueError("Media must be inside the publication store or OUTPUT_DIR")
        _reject_symlink_parts(root, raw_candidate)
        candidate = raw_candidate.resolve()
        if not candidate.is_relative_to(root):
            raise ValueError("Invalid media path")
    else:
        relative = Path(media)
        if relative.is_absolute() or not relative.parts or ".." in relative.parts or "\\" in media:
            raise ValueError("Invalid media key")
        candidate = None
        if layout_for_settings(settings).schema_version >= 3:
            from src.adapters.data.local_publication_media import LocalPublicationMedia
            resolved = LocalPublicationMedia()._read_path(media)
            if resolved.is_file():
                candidate = resolved
        for root in publication_roots:
            if candidate is not None:
                break
            unresolved = root / relative
            _reject_symlink_parts(root, unresolved)
            path = unresolved.resolve()
            if not path.is_relative_to(root):
                raise ValueError("Invalid media key")
            if path.is_file():
                candidate = path
                break
        if candidate is None:
            raise ValueError("Media file not found")

    if not candidate.is_file():
        raise ValueError("Media file not found")
    suffix = candidate.suffix.lower()
    if suffix in {".jpg", ".jpeg"}:
        mime = "image/jpeg"
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
    return candidate, mime, _sha256(candidate)


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
    """Firma medios de publicación o un MP4/JPEG temporal del pipeline (incluye portadas)."""
    if ttl_seconds < 1 or ttl_seconds > _MAX_TTL_SECONDS:
        raise ValueError("Media URL TTL must be between 1 and 3600 seconds")
    path, mime, digest = _resolve_media(media)
    if expected_sha256 and not hmac.compare_digest(expected_sha256.lower(), digest):
        raise ValueError("Media hash does not match the approved asset")
    roots = {**_publication_roots(), **_output_roots()}
    root_name, root = next((name, root) for name, root in roots.items() if path.is_relative_to(root))
    token_data = {
        "v": 2, "root": root_name, "path": path.relative_to(root).as_posix(),
        "mime": mime, "sha256": digest, "aud": "meta", "exp": int(time.time()) + ttl_seconds,
    }
    if layout_for_settings(settings).schema_version >= 2:
        token_data["profile"] = settings.storage_profile_id
    payload = json.dumps(token_data, separators=(",", ":")).encode()
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
        layout = layout_for_settings(settings)
        if "profile" in payload and (layout.schema_version < 2 or payload["profile"] != settings.storage_profile_id):
            raise ValueError("Invalid media profile")
        root_name = payload.get("root")
        roots = {**_publication_roots(), **_output_roots()}
        # Before migration, root=publications referred to data/publicaciones.
        if layout.schema_version >= 2:
            roots["publications"] = roots["publications_legacy"]
        if root_name not in roots:
            raise ValueError("Invalid media root")
        candidates = [roots[root_name]]
        if layout.schema_version >= 2 and root_name == "output" and "profile" not in payload:
            candidates = [roots["output_legacy"], roots["output"]]
        for root in candidates:
            try:
                resolved, mime, digest = _resolve_media(root / relative)
            except ValueError as exc:
                if str(exc) != "Media file not found":
                    raise
                continue
            if mime == payload.get("mime") and hmac.compare_digest(digest, str(payload.get("sha256", ""))):
                return resolved
        raise ValueError("Media changed after signing")

    # Los tokens MP4 anteriores siguen sirviendo mientras no caduquen.
    roots = _output_roots()
    root = roots.get("output_legacy", roots["output"])
    try:
        resolved, _mime, _digest = _resolve_media(root / relative)
    except ValueError as exc:
        if str(exc) != "Media file not found" or root == roots["output"]:
            raise
        resolved, _mime, _digest = _resolve_media(roots["output"] / relative)
    if resolved.suffix.lower() != ".mp4":
        raise ValueError("Media file not found")
    return resolved


def signed_media_mime(path: Path) -> str:
    """Obtiene MIME del tipo permitido ya validado por la firma."""
    mime = mimetypes.guess_type(str(path))[0]
    if mime not in {"image/jpeg", "video/mp4"}:
        raise ValueError("Unsupported signed media type")
    return mime
