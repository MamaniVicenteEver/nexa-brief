"""Caché local, verificada por hash, para las fotos Wikimedia del motor."""

from __future__ import annotations

import hashlib
import json
import os
import re
import tempfile
from pathlib import Path
from typing import Any, Mapping

from src.adapters.data.runtime_paths import assert_profile_path, temporary_dir
from src.config.profile_layout import layout_for_settings
from src.config.settings import settings
from src.core.ports.image_post_resources import CachedImage


_EXTENSIONS = {".jpg", ".png", ".webp", ".gif", ".tiff", ".bmp"}


class LocalImageMediaCache:
    def __init__(self, data_dir: Path | None = None) -> None:
        layout = layout_for_settings(settings)
        if layout.schema_version >= 2 and (data_dir is None or Path(data_dir).absolute() == layout.data_dir.absolute()):
            self.root = layout.cache_dir / "media-cache" / "wikimedia"
            self._legacy_root = layout.data_dir / "media-cache" / "wikimedia"
        else:
            self.root = Path(data_dir or settings.data_dir) / "media-cache" / "wikimedia"
            self._legacy_root = None

    def get_by_url(self, url: str) -> CachedImage | None:
        for root in (self.root, self._legacy_root):
            if root is not None:
                item = self._get_by_url_from(root, url)
                if item is not None:
                    return item
        return None

    @staticmethod
    def _get_by_url_from(root: Path, url: str) -> CachedImage | None:
        url_index = root / ".index" / f"{hashlib.sha256(url.encode('utf-8')).hexdigest()}.json"
        assert_profile_path(url_index)
        try:
            index = json.loads(url_index.read_text(encoding="utf-8"))
            digest = str(index["sha256"])
            extension = str(index["extension"])
            if extension not in _EXTENSIONS or re.fullmatch(r"[0-9a-f]{64}", digest) is None:
                return None
            content_path = root / f"{digest}{extension}"
            metadata_path = root / f"{digest}.json"
            assert_profile_path(content_path)
            assert_profile_path(metadata_path)
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
        for root in (self.root, self._legacy_root):
            if root is None:
                continue
            for extension in _EXTENSIONS:
                path = root / f"{sha256}{extension}"
                assert_profile_path(path)
                try:
                    content = path.read_bytes()
                except FileNotFoundError:
                    continue
                if hashlib.sha256(content).hexdigest() == sha256.lower():
                    return content
        return None

    @staticmethod
    def _write_atomic(path: Path, content: bytes) -> None:
        assert_profile_path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        assert_profile_path(path)
        descriptor, temporary = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=temporary_dir(path))
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
