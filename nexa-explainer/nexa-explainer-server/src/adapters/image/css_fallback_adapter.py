"""CSS Fallback image adapter — generates a gradient background when all APIs fail."""

from __future__ import annotations

import struct
import zlib
from pathlib import Path

import structlog

from src.core.ports.image_port import ImageFetchResult, ImagePort

logger = structlog.get_logger(__name__)


def _create_minimal_png(width: int, height: int, color_hex: str) -> bytes:
    """Create a tiny 1×1 PNG in the requested solid color (upscaled by CSS)."""
    r = int(color_hex.lstrip("#")[0:2], 16)
    g = int(color_hex.lstrip("#")[2:4], 16)
    b = int(color_hex.lstrip("#")[4:6], 16)

    def _chunk(chunk_type: bytes, data: bytes) -> bytes:
        c = chunk_type + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)

    header = b"\x89PNG\r\n\x1a\n"
    ihdr = _chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0))
    raw_pixel = b"\x00" + bytes([r, g, b])
    idat = _chunk(b"IDAT", zlib.compress(raw_pixel))
    iend = _chunk(b"IEND", b"")
    return header + ihdr + idat + iend


class CSSFallbackAdapter(ImagePort):
    """Last-resort adapter that produces a solid-color PNG (1×1 pixel)."""

    DEFAULT_COLOR = "#1a1a2e"

    async def fetch(
        self, query: str, dest_path: Path, *, min_width: int = 1920, min_height: int = 1080
    ) -> ImageFetchResult:
        logger.warning("css_fallback_activated", reason="all image APIs failed", query=query)
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        dest_path.write_bytes(_create_minimal_png(1, 1, self.DEFAULT_COLOR))
        return ImageFetchResult(
            path=dest_path,
            provider="css_fallback",
            query=query,
            photographer="",
            image_url="",
            tags="",
            width=1,
            height=1,
        )
