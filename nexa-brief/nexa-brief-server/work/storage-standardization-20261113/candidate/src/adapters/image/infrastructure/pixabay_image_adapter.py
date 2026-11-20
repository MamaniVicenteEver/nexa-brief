"""Pixabay image adapter — tertiary image source."""

from __future__ import annotations

from pathlib import Path

import httpx
import structlog

from src.config.exceptions import ImageFetchError
from src.config.settings import settings
from src.core.ports.image_port import ImageFetchResult, ImagePort

logger = structlog.get_logger(__name__)

_BASE = "https://pixabay.com/api/"


class PixabayImageAdapter(ImagePort):
    async def fetch(
        self, query: str, dest_path: Path, *, min_width: int = 1920, min_height: int = 1080
    ) -> ImageFetchResult:
        if not settings.pixabay_api_key:
            raise ImageFetchError("PIXABAY_API_KEY not set.")
        params = {
            "key": settings.pixabay_api_key,
            "q": query,
            "image_type": "photo",
            "orientation": "horizontal",
            "min_width": min_width,
            "min_height": min_height,
            "per_page": settings.max_image_results,
            "safesearch": "true",
        }
        async with httpx.AsyncClient(timeout=settings.api_timeout_seconds) as client:
            r = await client.get(_BASE, params=params)
            r.raise_for_status()
            hits = r.json().get("hits", [])
        if not hits:
            raise ImageFetchError(f"Pixabay: no results for '{query}'")
        hit = hits[0]
        url = hit["largeImageURL"]
        logger.info("pixabay_image_found", url=url, query=query)
        async with httpx.AsyncClient(timeout=settings.download_timeout_seconds) as client:
            r = await client.get(url)
            r.raise_for_status()
            dest_path.parent.mkdir(parents=True, exist_ok=True)
            dest_path.write_bytes(r.content)

        return ImageFetchResult(
            path=dest_path,
            provider="pixabay",
            image_id=str(hit.get("id", "")),
            query=query,
            photographer=hit.get("user", ""),
            image_url=url,
            tags=hit.get("tags", ""),
            width=hit.get("imageWidth", 0),
            height=hit.get("imageHeight", 0),
        )
