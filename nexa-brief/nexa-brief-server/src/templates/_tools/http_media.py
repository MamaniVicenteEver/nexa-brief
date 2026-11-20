"""Local media server with byte ranges: Chromium needs 206 responses to seek MP4s."""
from __future__ import annotations

import http.server
import os
from pathlib import Path
from urllib.parse import unquote, urlsplit


class ProfileContentMixin:
    """Expose only template/content roots on local recorder servers."""

    def translate_path(self, path):
        from urllib.parse import unquote, urlsplit
        from src.config.content_paths import resolve_content_key, is_private_content_key
        from src.config.settings import settings
        from src.config.profile_layout import layout_for_settings
        try:
            key = unquote(urlsplit(path).path).lstrip("/")
            api_prefix = "api/v1/explainer/files/"
            if key.startswith(api_prefix):
                key = key[len(api_prefix):]
            if is_private_content_key(key):
                raise ValueError("Private file")
            if layout_for_settings(settings).schema_version < 2:
                return super().translate_path(path)
            return str(resolve_content_key(key))
        except ValueError:
            return str(settings.templates_dir / ".not-found")

    def list_directory(self, path):
        self.send_error(403, "Directory listing disabled")
        return None


class MediaRequestHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args, **kwargs):
        pass

    def send_head(self):
        self._range_left = None
        path = self.translate_path(self.path)
        logical_path = unquote(urlsplit(self.path).path)
        if logical_path.endswith("/"):
            logical_path += "index.html"
        if os.path.isdir(path):
            from src.core.nodemotion.shared.content import has_project_entry
            if os.path.isfile(os.path.join(path, "index.html")) or has_project_entry(Path(path)):
                path = os.path.join(path, "index.html")
        # Demo code lives in one shared engine; recorder URLs remain unchanged.
        from src.config.template_manifest import resolve_template_content
        from src.core.nodemotion.shared.content import resolve_static_project_content
        try:
            content = resolve_static_project_content(Path(path), self.path)
        except (OSError, ValueError, KeyError):
            self.send_error(404, "NodeMotion project resource is unavailable")
            return None
        if content is None:
            content = resolve_template_content(Path(path))
        if isinstance(content, bytes):
            import io
            self.send_response(200)
            self.send_header("Content-Type", self.guess_type(logical_path))
            self.send_header("Content-Length", str(len(content)))
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            return io.BytesIO(content)
        if isinstance(content, Path) and str(content) != path:
            path = str(content)
            if Path(logical_path).suffix.lower() not in {".mp4", ".webm", ".mov", ".mp3", ".wav", ".m4a", ".ogg", ".aac", ".flac", ".opus"}:
                source = content.open("rb")
                self.send_response(200)
                self.send_header("Content-Type", self.guess_type(logical_path))
                self.send_header("Content-Length", str(content.stat().st_size))
                self.send_header("Cache-Control", "no-cache")
                self.end_headers()
                return source
        if not logical_path.lower().endswith((".mp4", ".webm", ".mov", ".mp3", ".wav", ".m4a", ".ogg", ".aac", ".flac", ".opus")) or not os.path.isfile(path):
            return super().send_head()
        source = open(path, "rb")
        size = os.fstat(source.fileno()).st_size
        request = self.headers.get("Range", "")
        start, end = 0, size - 1
        if request:
            try:
                if not request.startswith("bytes=") or "," in request:
                    raise ValueError("unsupported range")
                first, last = request[6:].split("-", 1)
                if first:
                    start = int(first)
                    end = min(int(last), size - 1) if last else size - 1
                else:
                    suffix = int(last)
                    if suffix <= 0:
                        raise ValueError("empty suffix")
                    start = max(0, size - suffix)
                if start < 0 or start >= size or end < start:
                    raise ValueError("unsatisfiable range")
            except (ValueError, IndexError):
                source.close()
                self.send_response(416)
                self.send_header("Content-Range", f"bytes */{size}")
                self.send_header("Content-Length", "0")
                self.end_headers()
                return None
        self._range_left = end - start + 1
        self.send_response(206 if request else 200)
        self.send_header("Content-Type", self.guess_type(logical_path))
        self.send_header("Content-Length", str(self._range_left))
        self.send_header("Accept-Ranges", "bytes")
        if request:
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.end_headers()
        source.seek(start)
        return source

    def copyfile(self, source, output):
        try:
            if self._range_left is None:
                return super().copyfile(source, output)
            while self._range_left > 0:
                data = source.read(min(64 * 1024, self._range_left))
                if not data:
                    break
                output.write(data)
                self._range_left -= len(data)
        except (BrokenPipeError, ConnectionResetError):
            pass  # Chromium cancels previous range requests when seeking or closing.
