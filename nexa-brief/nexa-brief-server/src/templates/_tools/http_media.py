"""Local media server with byte ranges: Chromium needs 206 responses to seek MP4s."""
from __future__ import annotations

import http.server
import os


class MediaRequestHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args, **kwargs):
        pass

    def send_head(self):
        self._range_left = None
        path = self.translate_path(self.path)
        if not path.lower().endswith((".mp4", ".webm", ".mov", ".mp3", ".m4a", ".ogg")) or not os.path.isfile(path):
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
        self.send_header("Content-Type", self.guess_type(path))
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
