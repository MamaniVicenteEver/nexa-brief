"""Caché local, verificada por hash, para las fotos Wikimedia del motor."""

from __future__ import annotations

import hashlib
import json
import os
import tempfile
from pathlib import Path
from typing import Any, Mapping

from src.config.settings import settings
from src.core.ports.image_post_resources import CachedImage


_EXTENSIONS = {".jpg", ".png", ".webp", ".gif", ".tiff", ".bmp"}


class LocalImageMediaCache:
    def __init__(self, data_dir: Path | None = None) -> None:
        self.root = Path(data_dir or settings.data_dir) / "media-cache" / "wikimedia"

    def get_by_url(self, url: str) -> CachedImage | None:
        url_index = self.root / ".index" / f"{hashlib.sha256(url.encode('utf-8')).hexdigest()}.json"
        try:
            index = json.loads(url_index.read_text(encoding="utf-8"))
            digest = str(index["sha256"])
            extension = str(index["extension"])
            if extension not in _EXTENSIONS or len(digest) != 64:
                return None
            content_path = self.root / f"{digest}{extension}"
            metadata_path = self.root / f"{digest}.json"
            content = content_path.read_bytes()
            metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
            if hashlib.sha256(content).hexdigest() != digest or metadata.get("sha256") != digest:
                return None
            return CachedImage(content=content, metadata=metadata)
        except (OSError, ValueError, KeyError, TypeError, json.JSONDecodeError):
            return None

    def put_by_url(self, url: str, content: bytes, metadata: Mapping[str, Any]) -> CachedImage:
        digest = hashlib.sha256(content).hexdigest()
        if metadata.get("sha256") != digest:
            raise ValueError("El hash de la caché no coincide con los bytes")
        extension = str(metadata.get("extension", ""))
        if extension not in _EXTENSIONS:
            raise ValueError("Extensión de imagen no permitida")
        normalized = {**dict(metadata), "sha256": digest}
        self._write_atomic(self.root / f"{digest}{extension}", content)
        self._write_json_atomic(self.root / f"{digest}.json", normalized)
        index = self.root / ".index" / f"{hashlib.sha256(url.encode('utf-8')).hexdigest()}.json"
        self._write_json_atomic(index, {"sha256": digest, "extension": extension})
        return CachedImage(content=content, metadata=normalized)

    def get_by_sha256(self, sha256: str) -> bytes | None:
        if len(sha256) != 64 or any(character not in "0123456789abcdef" for character in sha256.lower()):
            return None
        for extension in _EXTENSIONS:
            path = self.root / f"{sha256}{extension}"
            try:
                content = path.read_bytes()
            except FileNotFoundError:
                continue
            if hashlib.sha256(content).hexdigest() == sha256.lower():
                return content
        return None

    @staticmethod
    def _write_atomic(path: Path, content: bytes) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        descriptor, temporary = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
        try:
            with os.fdopen(descriptor, "wb") as stream:
                stream.write(content)
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(temporary, path)
        finally:
            if os.path.exists(temporary):
                os.unlink(temporary)

    @classmethod
    def _write_json_atomic(cls, path: Path, value: Any) -> None:
        encoded = json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True).encode("utf-8")
        cls._write_atomic(path, encoded)
