"""Image Adapter Factory — tries sources in order, returns ImageFetchResult(s)."""

from __future__ import annotations

import random
from pathlib import Path

import structlog

from src.adapters.image.css_fallback_adapter import CSSFallbackAdapter
from src.adapters.image.infrastructure.pexels_adapter import PexelsAdapter
from src.adapters.image.infrastructure.pixabay_image_adapter import PixabayImageAdapter
from src.adapters.image.infrastructure.unsplash_adapter import UnsplashAdapter
from src.config.settings import settings
from src.core.ports.image_port import ImageFetchResult, ImagePort

logger = structlog.get_logger(__name__)


async def fetch_image(query: str, dest_path: Path) -> ImageFetchResult:
    """Attempt each image source in priority order; CSS fallback as last resort."""
    adapters: list[ImagePort] = [
        UnsplashAdapter(),
        PexelsAdapter(),
        PixabayImageAdapter(),
    ]
    for adapter in adapters:
        name = type(adapter).__name__
        try:
            result = await adapter.fetch(
                query,
                dest_path,
                min_width=settings.image_min_width,
                min_height=settings.image_min_height,
            )
            logger.info("image_fetched", source=name, path=str(result.path))
            return result
        except Exception as exc:
            logger.warning("image_source_failed", source=name, error=str(exc))

    logger.warning("all_image_sources_failed", query=query, fallback="CSS")
    return await CSSFallbackAdapter().fetch(query, dest_path)


async def fetch_image_candidates(
    query: str,
    dest_dir: Path,
    *,
    count: int = 3,
    color_filter: str | None = None,
    orientation: str = "landscape",
) -> list[ImageFetchResult]:
    """Fetch multiple candidate images; tries adapters in priority order.

    Uses a random page (1–5) so each run returns different images even
    for the same query. Returns at least one result (CSS fallback as last resort).
    Each image is saved as bg_candidate_N.jpg inside dest_dir.
    """
    page = random.randint(1, 8)
    logger.info("image_candidates_page", query=query, page=page)

    adapters: list[ImagePort] = [
        UnsplashAdapter(),
        PexelsAdapter(),
        PixabayImageAdapter(),
    ]
    for adapter in adapters:
        name = type(adapter).__name__
        try:
            results = await adapter.fetch_candidates(
                query,
                dest_dir,
                count=count,
                color_filter=color_filter,
                orientation=orientation,
                min_width=settings.image_min_width,
                min_height=settings.image_min_height,
                page=page,
            )
            logger.info("image_candidates_fetched", source=name, count=len(results), query=query, page=page)
            return results
        except Exception as exc:
            logger.warning("image_candidates_source_failed", source=name, error=str(exc))

    logger.warning("all_image_sources_failed_candidates", query=query, fallback="CSS single")
    result = await CSSFallbackAdapter().fetch(query, dest_dir / "bg_candidate_0.jpg")
    return [result]
