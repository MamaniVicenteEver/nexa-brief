"""Local binary storage with profile-scoped v2 roots and v1 key compatibility."""
from __future__ import annotations

import os
import hashlib
import re
import shutil
import tempfile
import unicodedata
from pathlib import Path

from src.config.profile_layout import layout_for_settings
from src.config.settings import settings
from src.adapters.data.file_locks import file_lock
from src.adapters.data.runtime_paths import lock_path, temporary_dir

_INVALID_CHARS = re.compile(r'[<>:"/\\|?*\x00-\x1f]')
_MAX_STEM_LENGTH = 120


def sanitize_filename(filename: str, fallback: str = "archivo") -> str:
    name = unicodedata.normalize("NFC", Path(filename).name)
    stem, suffix = Path(name).stem, Path(name).suffix.lower()
    stem = _INVALID_CHARS.sub("", stem)
    stem = " ".join(stem.split()).strip(" .")[:_MAX_STEM_LENGTH].rstrip(" .")
    suffix = _INVALID_CHARS.sub("", suffix)
    return f"{stem or fallback}{suffix}"


def sanitize_folder(folder: str) -> str:
    cleaned = _INVALID_CHARS.sub("", folder).strip(" .")
    if not cleaned:
        raise ValueError(f"Invalid storage folder: {folder!r}")
    return cleaned


class LocalFileStorage:
    def __init__(self, name: str, relative_dir: str) -> None:
        self.name = name
        self._relative_dir = relative_dir

    @property
    def _root(self) -> Path:
        layout = layout_for_settings(settings)
        if layout.schema_version == 1:
            return layout.data_dir / self._relative_dir
        return layout.resources_dir / self.name

    @property
    def _legacy_root(self) -> Path | None:
        layout = layout_for_settings(settings)
        return layout.data_dir / self._relative_dir if layout.schema_version >= 2 else None

    @staticmethod
    def _path(root: Path, key: str) -> Path:
        candidate = Path(key)
        if not key or '\\' in key or candidate.is_absolute() or any(part in {'.', '..'} for part in candidate.parts):
            raise ValueError(f"Invalid storage key: {key!r}")
        unresolved = root / candidate
        layout = layout_for_settings(settings)
        boundary = layout.root if layout.schema_version >= 2 and root.is_relative_to(layout.root) else root.parent
        for part in (unresolved, *unresolved.parents):
            if part.is_symlink():
                raise ValueError(f"Symlink in storage key: {key!r}")
            if part == boundary:
                break
        if boundary == layout.root and not root.resolve().is_relative_to(layout.root.resolve()):
            raise ValueError("Storage root is outside the selected profile")
        path = unresolved.resolve()
        if root.resolve() not in path.parents:
            raise ValueError(f"Storage key escapes its root: {key!r}")
        return path

    def save(self, source: Path, *, folder: str, filename: str) -> str:
        root = self._root
        folder = sanitize_folder(folder)
        dest_dir = self._path(root, folder)
        dest_dir.mkdir(parents=True, exist_ok=True)
        with file_lock(lock_path(dest_dir, dest_dir / '.files.lock')):
            clean = sanitize_filename(filename)
            stem, suffix = Path(clean).stem, Path(clean).suffix
            candidate = clean
            counter = 2
            legacy = self._legacy_root
            while self._path(root, f'{folder}/{candidate}').exists() or (
                legacy is not None and self._path(legacy, f'{folder}/{candidate}').exists()
            ):
                candidate = f"{stem} ({counter}){suffix}"
                counter += 1
            key = f'{folder}/{candidate}'
            dest = self._path(root, key)
            fd, temp_name = tempfile.mkstemp(prefix='.media-', dir=temporary_dir(dest))
            try:
                with os.fdopen(fd, 'wb') as target, source.open('rb') as original:
                    shutil.copyfileobj(original, target)
                    target.flush()
                    os.fsync(target.fileno())
                os.replace(temp_name, dest)
            finally:
                if os.path.exists(temp_name):
                    os.unlink(temp_name)
            return key

    def save_asset(self, source: Path, *, asset_id: str, filename: str) -> str:
        """In v3 a resource directory is identified by its stable asset ID."""
        if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,127}", asset_id):
            raise ValueError("Invalid asset ID")
        return self.save(source, folder=asset_id, filename=filename)

    def _alias_path(self, key: str) -> Path | None:
        layout = layout_for_settings(settings)
        if layout.schema_version < 3:
            return None
        from src.core.data import documents
        legacy_key = f"resources/{self.name}/{key}"
        alias = documents("media_aliases").get(hashlib.sha256(legacy_key.encode()).hexdigest())
        if alias is None:
            return None
        prefix = f"resources/{self.name}/"
        target = alias.get("storage_key") if isinstance(alias, dict) else None
        if not isinstance(alias, dict) or alias.get("legacy_key") != legacy_key or not isinstance(target, str) or not target.startswith(prefix):
            raise ValueError("Invalid resource alias")
        path = self._path(self._root, target[len(prefix):])
        expected = alias.get("sha256")
        if expected and (not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != expected):
            raise ValueError("Resource alias hash mismatch")
        return path

    def local_path(self, key: str) -> Path:
        path = self._path(self._root, key)
        if not path.exists():
            alias = self._alias_path(key)
            if alias is not None:
                return alias
        legacy = self._legacy_root
        if not path.exists() and legacy is not None:
            old_path = self._path(legacy, key)
            if old_path.exists():
                return old_path
        return path

    def list_keys(self, folder: str, *, suffix: str | None = None) -> list[str]:
        folder = sanitize_folder(folder)
        roots = [self._root]
        if self._legacy_root is not None:
            roots.append(self._legacy_root)
        keys = set()
        if layout_for_settings(settings).schema_version >= 3:
            from src.core.data import collection
            namespace = {"images": "image_assets", "music": "music_assets", "sounds": "sound_assets", "videos": "video_assets"}.get(self.name)
            if namespace:
                for item in collection(namespace).list(where={"category": folder}):
                    key = item.get("relative_path")
                    if isinstance(key, str) and (suffix is None or key.lower().endswith(suffix.lower())) and self.local_path(key).is_file():
                        keys.add(key)
        for root in roots:
            directory = self._path(root, folder)
            if directory.is_dir():
                keys.update(
                    f'{folder}/{p.name}' for p in directory.iterdir()
                    if not p.is_symlink() and p.is_file() and not p.name.startswith('.')
                    and (suffix is None or p.suffix.lower() == suffix.lower())
                    and self._path(root, f'{folder}/{p.name}').is_file()
                )
        return sorted(keys)

    def delete(self, key: str) -> bool:
        root = self._root
        path = self._path(root, key)
        alias = self._alias_path(key) if not path.exists() else None
        legacy_root = self._legacy_root
        legacy = self._path(legacy_root, key) if legacy_root is not None else None
        # A key is one logical object. Remove both representations so a stale
        # legacy copy cannot reappear after deletion.
        with file_lock(lock_path(path.parent, path.parent / '.files.lock')):
            removed = False
            for candidate in dict.fromkeys((path, legacy, alias)):
                if candidate is not None and candidate.is_file():
                    candidate.unlink()
                    removed = True
            return removed
