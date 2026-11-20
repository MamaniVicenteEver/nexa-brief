"""Pixabay Music adapter — downloads royalty-free tracks from Pixabay."""

from __future__ import annotations

from pathlib import Path

import httpx
import structlog

from src.config.exceptions import MusicFetchError
from src.config.settings import settings
from src.core.ports.music_port import MusicFetchResult, MusicPort

logger = structlog.get_logger(__name__)

_PIXABAY_GENRE_MAP: dict[str, str] = {
    "lofi": "jazz",
    "study": "ambient",
    "jazz": "jazz",
    "ambient": "ambient",
    "classical": "classical",
}

_BASE = "https://pixabay.com/api/music/"


class PixabayMusicAdapter(MusicPort):
    async def get(self, genre: str, dest_path: Path) -> MusicFetchResult:
        if not settings.pixabay_api_key:
            raise MusicFetchError("PIXABAY_API_KEY not set.")

        pixabay_genre = _PIXABAY_GENRE_MAP.get(genre.lower())
        params: dict = {
            "key": settings.pixabay_api_key,
            "per_page": settings.max_music_results,
        }
        if pixabay_genre:
            params["genre"] = pixabay_genre

        async with httpx.AsyncClient(timeout=settings.api_timeout_seconds) as client:
            r = await client.get(_BASE, params=params)
            if r.status_code == 404:
                raise MusicFetchError(f"Pixabay Music: 404 — genre '{pixabay_genre}' not found.")
            r.raise_for_status()
            hits = r.json().get("hits", [])

        if not hits:
            raise MusicFetchError(f"Pixabay Music: no tracks for genre '{genre}'")

        hit = hits[0]
        url = hit.get("audio") or hit.get("url")
        if not url:
            raise MusicFetchError("Pixabay Music: track has no audio URL.")

        logger.info("pixabay_music_found", genre=genre, pixabay_genre=pixabay_genre, title=hit.get("title", ""))
        async with httpx.AsyncClient(timeout=settings.download_timeout_seconds, follow_redirects=True) as client:
            r = await client.get(url)
            r.raise_for_status()
            dest_path.parent.mkdir(parents=True, exist_ok=True)
            dest_path.write_bytes(r.content)

        return MusicFetchResult(
            path=dest_path,
            provider="pixabay",
            track_name=hit.get("title", ""),
            artist=hit.get("user", ""),
            genre=genre,
            track_id=str(hit.get("id", "")),
            duration=int(hit.get("duration", 0)),
            url=url,
        )
