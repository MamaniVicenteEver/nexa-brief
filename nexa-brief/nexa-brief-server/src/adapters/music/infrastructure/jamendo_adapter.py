"""Jamendo adapter — independent music with Creative Commons licenses."""

from __future__ import annotations

from pathlib import Path

import httpx
import structlog

from src.config.exceptions import MusicFetchError
from src.config.settings import settings
from src.core.ports.music_port import MusicFetchResult, MusicPort

logger = structlog.get_logger(__name__)

_BASE = "https://api.jamendo.com/v3.0/tracks/"

_GENRE_MAP: dict[str, str] = {
    "lofi": "chillout",
    "study": "chillout",
    "jazz": "jazz",
    "ambient": "ambient",
    "classical": "classical",
}

_FALLBACK_TAG = "instrumental"


class JamendoAdapter(MusicPort):
    async def get(self, genre: str, dest_path: Path) -> MusicFetchResult:
        if not settings.jamendo_api_key:
            raise MusicFetchError("JAMENDO_API_KEY not set.")

        # Si el genre tiene múltiples palabras (ej: "epic orchestral choir"),
        # Jamendo los trata como AND de tags → 0 resultados.
        # Probamos cada palabra individualmente antes de llegar al fallback.
        raw_tag = _GENRE_MAP.get(genre.lower(), genre.lower())
        words = raw_tag.split()
        tags_to_try = words if len(words) > 1 else [raw_tag]
        tags_to_try = [t for t in tags_to_try if t != _FALLBACK_TAG] + [_FALLBACK_TAG]

        for tag in tags_to_try:
            params = {
                "client_id": settings.jamendo_api_key,
                "format": "json",
                "limit": settings.max_music_results,
                "tags": tag,
                "include": "musicinfo",
                "order": "popularity_total",
            }
            async with httpx.AsyncClient(timeout=settings.api_timeout_seconds) as client:
                r = await client.get(_BASE, params=params)
                r.raise_for_status()
                results = r.json().get("results", [])

            if results:
                track = results[0]
                url = track["audio"]
                logger.info("jamendo_track_found", genre=genre, tag=tag, name=track.get("name", ""))
                async with httpx.AsyncClient(
                    timeout=settings.download_timeout_seconds, follow_redirects=True
                ) as client:
                    r = await client.get(url)
                    r.raise_for_status()
                    dest_path.parent.mkdir(parents=True, exist_ok=True)
                    dest_path.write_bytes(r.content)

                genres_list = track.get("musicinfo", {}).get("tags", {}).get("genres", [])
                return MusicFetchResult(
                    path=dest_path,
                    provider="jamendo",
                    track_name=track.get("name", ""),
                    artist=track.get("artist_name", ""),
                    genre=genres_list[0] if genres_list else genre,
                    track_id=str(track.get("id", "")),
                    duration=int(track.get("duration", 0)),
                    url=url,
                )

        raise MusicFetchError(
            f"Jamendo: no tracks found for genre '{genre}' (tried tags: {jamendo_tag}, {_FALLBACK_TAG})"
        )
