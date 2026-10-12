"""FileStorage local: archivos en `data/<carpeta>/<categoría>/<nombre original>`.

Conserva el nombre con el que se subió el archivo (ej. "Mi Canción - Artista.mp3"),
solo limpiando lo que un sistema de archivos o una URL de storage no acepta.
Si ya hay un archivo con ese nombre en la categoría, agrega " (2)", " (3)"…
en lugar de pisarlo — la clave devuelta es la que queda registrada en la
librería, así que el nombre real en disco nunca se adivina.
"""

from __future__ import annotations

import re
import shutil
import unicodedata
from pathlib import Path

from src.config.settings import settings

# Caracteres prohibidos en Windows/macOS/S3-keys + controles. Se preservan
# espacios, acentos, ñ, paréntesis, guiones, etc.
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
    """Una carpeta = un nivel (la categoría); nunca rutas ni `..`."""
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
        return settings.data_dir / self._relative_dir

    def save(self, source: Path, *, folder: str, filename: str) -> str:
        dest_dir = self._root / sanitize_folder(folder)
        dest_dir.mkdir(parents=True, exist_ok=True)
        clean = sanitize_filename(filename)
        stem, suffix = Path(clean).stem, Path(clean).suffix
        dest = dest_dir / clean
        counter = 2
        while dest.exists():
            dest = dest_dir / f"{stem} ({counter}){suffix}"
            counter += 1
        shutil.copy2(source, dest)
        return dest.relative_to(self._root).as_posix()

    def local_path(self, key: str) -> Path:
        path = (self._root / key).resolve()
        if self._root.resolve() not in path.parents:
            raise ValueError(f"Storage key escapes its root: {key!r}")
        return path

    def list_keys(self, folder: str, *, suffix: str | None = None) -> list[str]:
        directory = self._root / sanitize_folder(folder)
        if not directory.is_dir():
            return []
        return sorted(
            p.relative_to(self._root).as_posix()
            for p in directory.iterdir()
            if p.is_file() and (suffix is None or p.suffix.lower() == suffix.lower())
        )

    def delete(self, key: str) -> bool:
        path = self.local_path(key)
        if not path.exists():
            return False
        path.unlink()
        return True
