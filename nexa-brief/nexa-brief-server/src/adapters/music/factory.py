"""Music Adapter Factory — configurable order with automatic genre fallback."""

from __future__ import annotations

from pathlib import Path

import structlog

from src.adapters.music.infrastructure.jamendo_adapter import JamendoAdapter
from src.adapters.music.infrastructure.pixabay_music_adapter import PixabayMusicAdapter
from src.adapters.music.infrastructure.ytdlp_fallback_adapter import YtDlpFallbackAdapter
from src.config.exceptions import MusicFetchError
from src.config.settings import settings
from src.core.ports.music_port import MusicFetchResult, MusicPort

logger = structlog.get_logger(__name__)

_ADAPTER_REGISTRY: dict[str, type[MusicPort]] = {
    "pixabay": PixabayMusicAdapter,
    "jamendo": JamendoAdapter,
    "ytdlp": YtDlpFallbackAdapter,
}

_GENRE_FALLBACKS: dict[str, list[str]] = {
    "study":     ["ambient", "chillout", "instrumental"],
    "lofi":      ["jazz", "chillout", "ambient"],
    "ambient":   ["chillout", "instrumental", "jazz"],
    "classical": ["instrumental", "ambient"],
    "jazz":      ["blues", "instrumental"],
}
_UNIVERSAL_FALLBACK = "ambient"


def _build_adapters() -> list[tuple[str, MusicPort]]:
    order = settings.music_adapter_order
    return [
        (name, _ADAPTER_REGISTRY[name]())
        for name in order
        if name in _ADAPTER_REGISTRY
    ]


async def _try_genre(
    genre: str, dest_path: Path, adapters: list[tuple[str, MusicPort]]
) -> MusicFetchResult | None:
    """Try all adapters for a specific genre. Returns result or None."""
    for name, adapter in adapters:
        try:
            result = await adapter.get(genre, dest_path)
            logger.info("music_fetched", source=name, genre=genre, path=str(result.path))
            return result
        except Exception as exc:
            logger.warning("music_source_failed", source=name, genre=genre, error=str(exc))
    return None


async def fetch_music(genre: str, dest_path: Path) -> MusicFetchResult:
    """Attempt music sources in settings.music_adapter_order.

    If all fail for the requested genre, retries with progressively broader
    fallback genres before giving up.
    """
    adapters = _build_adapters()
    if not adapters:
        raise MusicFetchError(f"No valid music adapters configured: {settings.music_adapter_order}")

    result = await _try_genre(genre, dest_path, adapters)
    if result:
        return result

    fallback_genres = _GENRE_FALLBACKS.get(genre.lower(), [_UNIVERSAL_FALLBACK])
    for fallback_genre in fallback_genres:
        if fallback_genre == genre.lower():
            continue
        logger.warning(
            "music_genre_fallback",
            original_genre=genre,
            fallback_genre=fallback_genre,
        )
        result = await _try_genre(fallback_genre, dest_path, adapters)
        if result:
            logger.info("music_fallback_success", genre=genre, resolved_as=fallback_genre)
            result.genre = genre  # keep original genre in the result
            return result

    raise MusicFetchError(
        f"All music sources failed for genre '{genre}' and fallbacks: {fallback_genres}"
    )
