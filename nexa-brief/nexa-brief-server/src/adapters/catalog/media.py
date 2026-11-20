"""Only repository demos and the runtime files they need; no profile resolution."""
from __future__ import annotations

import hashlib
import mimetypes
from pathlib import Path
from urllib.parse import quote

from src.core.catalog.models import MediaObject
from .repository import read_json, repository_demos

PREFIX = "/api/v1/catalog/media/"
WEB_SUFFIXES = frozenset({".html", ".js", ".mjs", ".css", ".json", ".geojson", ".svg", ".png", ".jpg",
    ".jpeg", ".webp", ".gif", ".avif", ".mp4", ".webm", ".mp3", ".wav", ".ogg", ".m4a", ".woff", ".woff2", ".ttf", ".otf", ".bin", ".pmtiles"})
PRIVATE_NAMES = frozenset({"work", "logs", "test", "tests", "node_modules", "__pycache__", "prompts"})
DEMO_ENTRIES = frozenset({"index.html", "showcase.html", "showcase.js", "components.json", "config.json", "info.json", "assets", "render",
                          "preview", "engine", "components", "sets", "characters"})
SHARED_ENGINES = frozenset({"_proto", "_atlas", "_mapas", "_pizarra", "_player", "_engine", "_vida", "_tactico", "_avatar"})


class RepositoryCatalogMedia:
    def __init__(self, root: Path):
        self.root = root.resolve()

    def url(self, key):
        return PREFIX + quote(key, safe="/")

    def _allowed(self, parts):
        if len(parts) < 2 or any(not p or p.startswith(".") or p in PRIVATE_NAMES for p in parts):
            return False
        if any(p.lower().startswith(("client_secret", "credentials", "token", "secret")) or
               p.lower() in {"accounts.json", "users.json", "access.json", "publish.json", "manifest.json", "profile.json"}
               for p in parts):
            return False
        if Path(parts[-1]).suffix.lower() not in WEB_SUFFIXES:
            return False
        if parts[:2] == ("_tools", "player"):
            return len(parts) >= 3
        if parts[:2] == ("_tools", "explainer-kit"):
            return len(parts) >= 3 and parts[2] in {"engine", "designs", "assets", "lib", "vendor", "player.js", "player.css"}
        if parts[0] == "sandbox":
            return (parts[1] == "_proto" or len(parts) >= 4 and parts[2] in SHARED_ENGINES)
        if parts[0] == "nodeatlas" and parts[1] in {"_atlas", "_mapas"}:
            return len(parts) >= 3
        demos = {tuple(folder.relative_to(self.root).parts) for folder, _ in repository_demos(self.root)}
        if tuple(parts[:2]) in demos:
            return len(parts) >= 3 and parts[2] in DEMO_ENTRIES
        # Motion's registered showcase is rendered by its existing read-only transport;
        # its image/movie resources can also use this storage-neutral transport.
        manifest = read_json(self.root / "templates.json")
        for entry in manifest.get("templates", {}).values():
            if entry.get("status") == "disabled" or entry.get("category_id") == "testing" or entry.get("demo") is False:
                continue
            folder = tuple(str(entry.get("folder", "")).split("/"))
            if tuple(parts[:len(folder)]) == folder and len(parts) > len(folder):
                return parts[len(folder)] in {"assets", "render"}
        return False

    def open(self, key):
        parts = tuple(key.split("/"))
        if not self._allowed(parts):
            raise FileNotFoundError(key)
        path = self.root.joinpath(*parts)
        if not path.resolve().is_relative_to(self.root) or not path.is_file():
            raise FileNotFoundError(key)
        if any(p.is_symlink() for p in (path, *path.parents) if p != self.root and p.is_relative_to(self.root)):
            raise FileNotFoundError(key)
        stat = path.stat()
        body = None
        if path.suffix in {".html", ".js", ".mjs", ".css", ".json"} and stat.st_size <= 2 * 1024 * 1024:
            original = path.read_bytes()
            body = original.replace(b"/api/v1/explainer/files/bundled/", PREFIX.encode())
            body = body.replace(b"/api/v1/explainer/files/", PREFIX.encode())
            body = body.replace(b'"/_tools/', ('"' + PREFIX + '_tools/').encode())
            body = body.replace(b"'/_tools/", ("'" + PREFIX + '_tools/').encode())
            # Root-relative runtime assets in story JSON/JS retain their repository namespace.
            for category in {p[0] for p in (tuple(folder.relative_to(self.root).parts) for folder, _ in repository_demos(self.root))}:
                for delim in ('"', "'"):
                    body = body.replace(f"{delim}/{category}/".encode(), f"{delim}{PREFIX}{category}/".encode())
            if path.suffix == ".html":
                # Public playback never offers the engines' embedded recording controls.
                body += b"<style>#rec-btn,#record-btn,[data-recorder]{display:none!important}</style>"
        size = len(body) if body is not None else stat.st_size
        etag = ('"' + hashlib.sha256(body).hexdigest() + '"' if body is not None
                else f'"{stat.st_mtime_ns:x}-{stat.st_size:x}"')

        def read(start, end):
            if body is not None:
                yield body[start:end + 1]
            else:
                with path.open("rb") as stream:
                    stream.seek(start)
                    remaining = end - start + 1
                    while remaining > 0:
                        chunk = stream.read(min(1024 * 1024, remaining))
                        if not chunk:
                            break
                        remaining -= len(chunk)
                        yield chunk
        return MediaObject(content_type=mimetypes.guess_type(path.name)[0] or "application/octet-stream",
                           size=size, etag=etag, read=read)
