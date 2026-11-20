"""Pexels image adapter — secondary image source."""

from __future__ import annotations

from pathlib import Path

import httpx
import structlog

from src.config.exceptions import ImageFetchError
from src.config.settings import settings
from src.core.ports.image_port import ImageFetchResult, ImagePort

logger = structlog.get_logger(__name__)

_BASE = "https://api.pexels.com/v1"

# Pexels color values: red, orange, yellow, green, turquoise, blue,
# violet, pink, brown, black, gray, white — map our internal names.
_PEXELS_COLOR_MAP = {
    "black_and_white": "black",
    "b_and_w": "black",
}


class PexelsAdapter(ImagePort):
    async def fetch_candidates(
        self,
        query: str,
        dest_dir: Path,
        *,
        count: int = 3,
        color_filter: str | None = None,
        orientation: str = "landscape",
        min_width: int = 1920,
        min_height: int = 1080,
        page: int = 1,
    ) -> list[ImageFetchResult]:
        if not settings.pexels_api_key:
            raise ImageFetchError("PEXELS_API_KEY not set.")
        headers = {"Authorization": settings.pexels_api_key}
        params: dict = {
            "query": query,
            "per_page": max(count * 2, 10),
            "orientation": orientation,
            "page": page,
        }
        if color_filter:
            params["color"] = _PEXELS_COLOR_MAP.get(color_filter, color_filter)

        async with httpx.AsyncClient(timeout=settings.api_timeout_seconds) as client:
            r = await client.get(f"{_BASE}/search", headers=headers, params=params)
            r.raise_for_status()
            photos = r.json().get("photos", [])

        if not photos:
            raise ImageFetchError(f"Pexels: no results for '{query}'")

        qualified = [
            p for p in photos if p["width"] >= min_width and p["height"] >= min_height
        ] or photos
        candidates = qualified[:count]

        dest_dir.mkdir(parents=True, exist_ok=True)
        fetched: list[ImageFetchResult] = []
        async with httpx.AsyncClient(timeout=settings.download_timeout_seconds) as client:
            for idx, photo in enumerate(candidates):
                url = photo["src"]["original"]
                dest_path = dest_dir / f"bg_candidate_{idx}.jpg"
                r = await client.get(url)
                r.raise_for_status()
                dest_path.write_bytes(r.content)
                fetched.append(ImageFetchResult(
                    path=dest_path,
                    provider="pexels",
                    image_id=str(photo.get("id", "")),
                    query=query,
                    photographer=photo.get("photographer", ""),
                    image_url=url,
                    tags="",
                    width=photo.get("width", 0),
                    height=photo.get("height", 0),
                ))

        logger.info("pexels_candidates_fetched", count=len(fetched), query=query)
        return fetched

    async def fetch(
        self, query: str, dest_path: Path, *, min_width: int = 1920, min_height: int = 1080
    ) -> ImageFetchResult:
        if not settings.pexels_api_key:
            raise ImageFetchError("PEXELS_API_KEY not set.")
        headers = {"Authorization": settings.pexels_api_key}
        params = {"query": query, "per_page": settings.max_image_results, "orientation": "landscape"}
        async with httpx.AsyncClient(timeout=settings.api_timeout_seconds) as client:
            r = await client.get(f"{_BASE}/search", headers=headers, params=params)
            r.raise_for_status()
            photos = r.json().get("photos", [])
        if not photos:
            raise ImageFetchError(f"Pexels: no results for '{query}'")
        photo = next(
            (p for p in photos if p["width"] >= min_width and p["height"] >= min_height),
            photos[0],
        )
        url = photo["src"]["original"]
        logger.info("pexels_image_found", url=url, query=query)
        async with httpx.AsyncClient(timeout=settings.download_timeout_seconds) as client:
            r = await client.get(url)
            r.raise_for_status()
            dest_path.parent.mkdir(parents=True, exist_ok=True)
            dest_path.write_bytes(r.content)

        return ImageFetchResult(
            path=dest_path,
            provider="pexels",
            image_id=str(photo.get("id", "")),
            query=query,
            photographer=photo.get("photographer", ""),
            image_url=url,
            tags="",
            width=photo.get("width", 0),
            height=photo.get("height", 0),
        )
