"""Decides whether a job's published copy is written in Spanish or English.

Priority (first confident answer wins):
  1. The language the user typed in the create-video form (song_info.language).
  2. The language Whisper detected while transcribing lyrics (lyrics niches).
  3. Listening to the song with Whisper's language detector (other niches).
  4. settings.metadata_default_language.
"""

from __future__ import annotations

import structlog

from src.adapters.lyrics.factory import get_lyrics_transcriber
from src.config.settings import settings
from src.core.job import Job
from src.core.metadata import (
    SUPPORTED_LANGUAGES,
    ResolvedLanguage,
    language_from_lyrics,
    normalize_language,
    pick_from_probabilities,
)

logger = structlog.get_logger(__name__)


def _default() -> ResolvedLanguage:
    return ResolvedLanguage(normalize_language(settings.metadata_default_language) or "en", "default")


async def _from_audio(job: Job) -> ResolvedLanguage | None:
    music_path = job.artifacts.music_path
    if not settings.metadata_detect_audio_language or music_path is None or not music_path.exists():
        return None
    try:
        probabilities = await get_lyrics_transcriber().detect_language(music_path, SUPPORTED_LANGUAGES)
    except Exception as exc:  # detection is best-effort; never fail the job over it
        logger.warning("content_language_audio_detection_failed", job_id=job.job_id, error=str(exc))
        return None
    return pick_from_probabilities(probabilities, settings.metadata_language_min_confidence)


async def resolve_content_language(job: Job) -> ResolvedLanguage:
    song_info = job.input.song_info
    user_code = normalize_language(song_info.language if song_info else None)
    if user_code:
        resolved = ResolvedLanguage(user_code, "user")
    elif job.artifacts.lyrics_json is not None:
        # Lyrics were already transcribed: their language is the answer, even if it's
        # neither es nor en (then default) — re-listening would only repeat Whisper.
        resolved = language_from_lyrics(job.artifacts.lyrics_json, settings.metadata_language_min_confidence) or _default()
    else:
        resolved = await _from_audio(job) or _default()

    logger.info(
        "content_language_resolved",
        job_id=job.job_id,
        language=resolved.code,
        source=resolved.source,
        confidence=resolved.confidence,
    )
    return resolved
