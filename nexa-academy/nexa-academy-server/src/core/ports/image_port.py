"""Image Port — abstract contract for background image providers."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path


@dataclass
class ImageFetchResult:
    """Rich result returned by every image adapter."""
    path: Path
    provider: str
    image_id: str = ""
    query: str = ""
    photographer: str = ""
    image_url: str = ""
    tags: str = ""
    width: int = 0
    height: int = 0


class ImagePort(ABC):
    """Fetch high-resolution background images for the given query."""

    @abstractmethod
    async def fetch(
        self,
        query: str,
        dest_path: Path,
        *,
        min_width: int = 1920,
        min_height: int = 1080,
    ) -> ImageFetchResult:
        """Download one image matching *query*, save to *dest_path*.

        Raises ImageFetchError if unavailable or no results.
        """

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
        """Download *count* candidate images to *dest_dir* as bg_candidate_N.jpg.

        Default implementation calls fetch() once (safe fallback for adapters
        that don't override this method).  Unsplash and Pexels override it to
        return multiple results efficiently in one API call.

        Returns a list with 1..count ImageFetchResult objects.
        Raises ImageFetchError if no results at all.
        """
        dest_dir.mkdir(parents=True, exist_ok=True)
        result = await self.fetch(
            query,
            dest_dir / "bg_candidate_0.jpg",
            min_width=min_width,
            min_height=min_height,
        )
        return [result]
