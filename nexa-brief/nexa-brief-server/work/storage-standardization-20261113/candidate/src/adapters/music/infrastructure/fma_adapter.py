"""Free Music Archive (FMA) adapter — Creative Commons music via search."""

from __future__ import annotations

from pathlib import Path

import httpx
import structlog

from src.config.exceptions import MusicFetchError
from src.config.settings import settings
from src.core.ports.music_port import MusicPort

logger = structlog.get_logger(__name__)

_BASE = "https://freemusicarchive.org/api/get/tracks.json"


class FMAAdapter(MusicPort):
    async def get(self, genre: str, dest_path: Path) -> Path:
        params = {
            "genre_handle": genre.lower(),
            "limit": settings.max_music_results,
            "page": 1,
        }
        async with httpx.AsyncClient(timeout=settings.api_timeout_seconds) as client:
            r = await client.get(_BASE, params=params)
            if r.status_code != 200:
                raise MusicFetchError(f"FMA: HTTP {r.status_code} for genre '{genre}'")
            data = r.json()

        tracks = data.get("dataset", [])
        # Filter tracks with a direct download URL
        downloadable = [t for t in tracks if t.get("track_file")]
        if not downloadable:
            raise MusicFetchError(f"FMA: no downloadable tracks for genre '{genre}'")

        url = downloadable[0]["track_file"]
        logger.info("fma_track_found", url=url, genre=genre)
        async with httpx.AsyncClient(timeout=settings.download_timeout_seconds, follow_redirects=True) as client:
            r = await client.get(url)
            r.raise_for_status()
            dest_path.parent.mkdir(parents=True, exist_ok=True)
            dest_path.write_bytes(r.content)
        return dest_path
