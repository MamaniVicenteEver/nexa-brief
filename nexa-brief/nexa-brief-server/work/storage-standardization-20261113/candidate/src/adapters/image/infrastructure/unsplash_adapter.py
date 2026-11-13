"""Unsplash image adapter — primary image source."""

from __future__ import annotations

from pathlib import Path

import httpx
import structlog

from src.config.exceptions import ImageFetchError
from src.config.settings import settings
from src.core.ports.image_port import ImageFetchResult, ImagePort

logger = structlog.get_logger(__name__)

_BASE = "https://api.unsplash.com"


class UnsplashAdapter(ImagePort):
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
        if not settings.unsplash_api_key:
            raise ImageFetchError("UNSPLASH_API_KEY not set.")
        headers = {"Authorization": f"Client-ID {settings.unsplash_api_key}"}
        params: dict = {
            "query": query,
            "per_page": max(count * 2, 10),
            "orientation": orientation,
            "page": page,
        }
        if color_filter:
            params["color"] = color_filter  # Unsplash accepts "black_and_white" natively

        async with httpx.AsyncClient(timeout=settings.api_timeout_seconds) as client:
            r = await client.get(f"{_BASE}/search/photos", headers=headers, params=params)
            r.raise_for_status()
            results = r.json().get("results", [])

        if not results:
            raise ImageFetchError(f"Unsplash: no results for '{query}'")

        qualified = [
            p for p in results if p["width"] >= min_width and p["height"] >= min_height
        ] or results
        candidates = qualified[:count]

        dest_dir.mkdir(parents=True, exist_ok=True)
        fetched: list[ImageFetchResult] = []
        async with httpx.AsyncClient(timeout=settings.download_timeout_seconds) as client:
            for idx, photo in enumerate(candidates):
                url = photo["urls"]["full"]
                dest_path = dest_dir / f"bg_candidate_{idx}.jpg"
                r = await client.get(url)
                r.raise_for_status()
                dest_path.write_bytes(r.content)
                photographer = photo.get("user", {}).get("name", "")
                tags = ", ".join(t["title"] for t in photo.get("tags", [])[:8])
                fetched.append(ImageFetchResult(
                    path=dest_path,
                    provider="unsplash",
                    image_id=photo.get("id", ""),
                    query=query,
                    photographer=photographer,
                    image_url=url,
                    tags=tags,
                    width=photo.get("width", 0),
                    height=photo.get("height", 0),
                ))

        logger.info("unsplash_candidates_fetched", count=len(fetched), query=query)
        return fetched

    async def fetch(
        self, query: str, dest_path: Path, *, min_width: int = 1920, min_height: int = 1080
    ) -> ImageFetchResult:
        if not settings.unsplash_api_key:
            raise ImageFetchError("UNSPLASH_API_KEY not set.")
        headers = {"Authorization": f"Client-ID {settings.unsplash_api_key}"}
        params = {"query": query, "per_page": settings.max_image_results, "orientation": "landscape"}
        async with httpx.AsyncClient(timeout=settings.api_timeout_seconds) as client:
            r = await client.get(f"{_BASE}/search/photos", headers=headers, params=params)
            r.raise_for_status()
            results = r.json().get("results", [])
        if not results:
            raise ImageFetchError(f"Unsplash: no results for '{query}'")
        # Pick first result that meets minimum dimensions
        photo = next(
            (p for p in results if p["width"] >= min_width and p["height"] >= min_height),
            results[0],
        )
        url = photo["urls"]["full"]
        photographer = photo.get("user", {}).get("name", "")
        tags = ", ".join(t["title"] for t in photo.get("tags", [])[:8])

        logger.info("unsplash_image_found", url=url, query=query)
        async with httpx.AsyncClient(timeout=settings.download_timeout_seconds) as client:
            r = await client.get(url)
            r.raise_for_status()
            dest_path.parent.mkdir(parents=True, exist_ok=True)
            dest_path.write_bytes(r.content)

        return ImageFetchResult(
            path=dest_path,
            provider="unsplash",
            image_id=photo.get("id", ""),
            query=query,
            photographer=photographer,
            image_url=url,
            tags=tags,
            width=photo.get("width", 0),
            height=photo.get("height", 0),
        )
