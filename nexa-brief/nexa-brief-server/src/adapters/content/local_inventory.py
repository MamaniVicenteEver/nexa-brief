"""Inventario local acotado a assets, sin abrir contenido ni seguir symlinks."""
import os
from pathlib import Path


class LocalContentInventory:
    def assets(self, production_dir: Path):
        root = production_dir / "assets"
        if root.is_symlink() or not root.is_dir():
            return
        image = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".bmp"}
        audio = {".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac", ".opus"}
        video = {".mp4", ".mov", ".webm", ".mkv", ".m4v"}
        for folder, dirs, names in os.walk(root, followlinks=False):
            dirs[:] = [name for name in dirs if not name.startswith(".") and not (Path(folder) / name).is_symlink()]
            for name in sorted(names):
                path = Path(folder) / name
                if name.startswith(".") or path.is_symlink() or not path.is_file():
                    continue
                suffix = path.suffix.lower()
                if suffix in image:
                    kind = "image"
                elif suffix in video:
                    kind = "video"
                elif suffix in audio:
                    kind = "sound" if any(part.lower() in {"sfx", "sounds", "sound", "effects"} for part in path.relative_to(root).parts[:-1]) else "music"
                else:
                    continue
                yield path, kind
