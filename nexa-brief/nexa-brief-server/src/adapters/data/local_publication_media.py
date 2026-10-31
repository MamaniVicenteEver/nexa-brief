"""Almacenamiento local inmutable para los medios archivados de publicaciones."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import re
import tempfile
import time
from io import BytesIO
from pathlib import Path
from typing import BinaryIO
from urllib.parse import quote

from PIL import Image

from src.adapters.data.layout import PUBLICATIONS_ROOT
from src.config.settings import settings
from src.core.ports.media_storage_port import MediaObject

_SAFE_PART = re.compile(r"^[A-Za-z0-9_.-]{1,128}$")
_MAX_IMAGE_BYTES = 3_984_588
_MAX_REEL_BYTES = 290 * 1024 * 1024


class LocalPublicationMedia:
    """Persiste JPEG/MP4 con hash comprobado y claves sin traversal."""

    def __init__(self, data_dir: Path | None = None) -> None:
        self._data_dir = data_dir

    @property
    def root(self) -> Path:
        return (self._data_dir or settings.data_dir) / PUBLICATIONS_ROOT

    def _path(self, key: str) -> Path:
        parts = Path(key).parts
        if not parts or Path(key).is_absolute() or any(part in {"", ".", ".."} for part in parts):
            raise ValueError("Clave de medios inválida")
        if any(not _SAFE_PART.fullmatch(part) for part in parts):
            raise ValueError("Clave de medios inválida")
        root = self.root.resolve()
        path = self.root.joinpath(*parts)
        for parent in (path, *path.parents):
            if parent == self.root.parent:
                break
            if parent.is_symlink():
                raise ValueError("No se permiten symlinks en medios de publicación")
        resolved = path.resolve(strict=False)
        if not resolved.is_relative_to(root):
            raise ValueError("La clave escapa del archivo de publicaciones")
        return resolved

    @staticmethod
    def _read(stream: BinaryIO | bytes) -> bytes:
        return stream if isinstance(stream, bytes) else stream.read()

    @staticmethod
    def _sniff(data: bytes, mime: str) -> None:
        if mime == "image/jpeg":
            try:
                with Image.open(BytesIO(data)) as image:
                    if image.format != "JPEG" or image.size != (1080, 1350) or image.mode != "RGB":
                        raise ValueError("El JPEG debe ser RGB y medir 1080×1350")
                    image.verify()
            except (OSError, ValueError) as exc:
                if isinstance(exc, ValueError) and str(exc).startswith("El JPEG"):
                    raise
                raise ValueError("El contenido no es un JPEG válido") from None
        elif mime == "video/mp4":
            if len(data) < 12 or data[4:8] != b"ftyp":
                raise ValueError("El contenido no es un MP4 válido")
        else:
            raise ValueError("MIME no permitido para el archivo de publicaciones")

    def put(
        self, key: str, stream: BinaryIO | bytes, mime: str, expected_sha256: str,
        if_absent: bool = True,
    ) -> MediaObject:
        data = self._read(stream)
        self._sniff(data, mime)
        digest = hashlib.sha256(data).hexdigest()
        if not hmac.compare_digest(digest, expected_sha256.lower()):
            raise ValueError("El SHA-256 del medio no coincide")
        max_bytes = _MAX_IMAGE_BYTES if mime == "image/jpeg" else _MAX_REEL_BYTES
        if len(data) > max_bytes:
            raise ValueError("El medio supera el tamaño permitido")
        if (mime == "image/jpeg" and not key.lower().endswith((".jpg", ".jpeg"))
                or mime == "video/mp4" and not key.lower().endswith(".mp4")):
            raise ValueError("La extensión y el MIME no coinciden")
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        self._path(key)  # Revalidar tras crear los directorios para detectar symlinks.
        if path.exists():
            existing = path.read_bytes()
            existing_hash = hashlib.sha256(existing).hexdigest()
            if existing_hash != digest or len(existing) != len(data):
                raise FileExistsError("La clave de almacenamiento ya contiene otros bytes")
            return MediaObject(key=key, bytes=len(data), sha256=digest, mime=mime)
        fd, temp_name = tempfile.mkstemp(prefix=".media-", suffix=".tmp", dir=path.parent)
        try:
            with os.fdopen(fd, "wb") as output:
                output.write(data)
                output.flush()
                os.fsync(output.fileno())
            try:
                os.link(temp_name, path)
            except FileExistsError:
                existing = path.read_bytes()
                existing_hash = hashlib.sha256(existing).hexdigest()
                if existing_hash != digest or len(existing) != len(data):
                    raise FileExistsError("La clave de almacenamiento ya contiene otros bytes")
            dir_fd = os.open(path.parent, os.O_RDONLY)
            try:
                os.fsync(dir_fd)
            finally:
                os.close(dir_fd)
        finally:
            if os.path.exists(temp_name):
                os.unlink(temp_name)
        return MediaObject(key=key, bytes=len(data), sha256=digest, mime=mime)

    def get(self, key: str, byte_range: tuple[int, int] | None = None) -> BinaryIO:
        path = self._path(key)
        if not path.is_file():
            raise FileNotFoundError(key)
        data = path.read_bytes()
        if byte_range is not None:
            start, end = byte_range
            if start < 0 or end < start or start >= len(data):
                raise ValueError("Rango de bytes inválido")
            data = data[start:min(end + 1, len(data))]
        return BytesIO(data)

    def signed_url(self, key: str, audience: str, ttl: int, expected_sha256: str | None = None) -> str:
        if audience not in {"meta", "gallery"}:
            raise ValueError("Audiencia no permitida")
        if ttl <= 0 or ttl > 3600:
            raise ValueError("TTL fuera del rango permitido")
        path = self._path(key)
        if not path.is_file():
            raise FileNotFoundError(key)
        content = path.read_bytes()
        mime = "video/mp4" if path.suffix.lower() == ".mp4" else "image/jpeg" if path.suffix.lower() in {".jpg", ".jpeg"} else ""
        self._sniff(content, mime)
        digest = hashlib.sha256(content).hexdigest()
        if expected_sha256 and not hmac.compare_digest(digest, expected_sha256.lower()):
            raise ValueError("El medio cambió desde su aprobación")
        secret = settings.publisher_encryption_key
        if not secret:
            raise RuntimeError("No hay clave configurada para firmar medios")
        if not settings.public_app_url:
            raise RuntimeError("PUBLIC_APP_URL no está configurada para servir medios")
        payload = json.dumps(
            {"key": key, "aud": audience, "exp": int(time.time()) + ttl, "sha256": digest},
            separators=(",", ":"), sort_keys=True,
        ).encode()
        encoded = base64.urlsafe_b64encode(payload).rstrip(b"=").decode()
        signature = hmac.new(secret.encode(), encoded.encode(), hashlib.sha256).hexdigest()
        token = f"{encoded}.{signature}"
        return f"{settings.public_app_url.rstrip('/')}/api/v1/publish/instagram/media/{quote(token, safe='.') }"

    def resolve_signed_token(self, token: str, *, audience: str | None = None) -> tuple[Path, str]:
        """Helper para el GET firmado existente; devuelve path y MIME al adapter de presentación."""
        if not token or len(token) > 4096 or "." not in token:
            raise ValueError("Token inválido")
        encoded, received_signature = token.rsplit(".", 1)
        secret = settings.publisher_encryption_key
        if not secret:
            raise ValueError("Firma no configurada")
        expected = hmac.new(secret.encode(), encoded.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(received_signature, expected):
            raise ValueError("Firma inválida")
        try:
            payload = json.loads(base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4)))
            key, token_audience, expires = payload["key"], payload["aud"], int(payload["exp"])
            expected_hash = str(payload["sha256"]).lower()
        except (ValueError, KeyError, TypeError, json.JSONDecodeError) as exc:
            raise ValueError("Token inválido") from exc
        if expires < int(time.time()) or audience and token_audience != audience:
            raise ValueError("Token vencido o de otra audiencia")
        path = self._path(str(key))
        if not path.is_file() or token_audience not in {"meta", "gallery"}:
            raise ValueError("Medio no encontrado")
        content = path.read_bytes()
        if not hmac.compare_digest(hashlib.sha256(content).hexdigest(), expected_hash):
            raise ValueError("El medio cambió después de firmarse")
        mime = "video/mp4" if path.suffix.lower() == ".mp4" else "image/jpeg" if path.suffix.lower() in {".jpg", ".jpeg"} else ""
        if not mime:
            raise ValueError("Extensión de medio no permitida")
        self._sniff(content, mime)
        return path, mime

    def delete(self, key: str, expected_sha256: str | None = None) -> bool:
        path = self._path(key)
        if not path.exists():
            return False
        if expected_sha256 and hashlib.sha256(path.read_bytes()).hexdigest() != expected_sha256.lower():
            raise ValueError("El SHA-256 no coincide; no se elimina el archivo")
        path.unlink()
        return True
