"""Application service for turning final narration into timing cues.

The audio is the source of truth. The service runs Whisper after TTS has
produced the final file, preserves segment and word timestamps, and can map
approved reading phrases to the exact moments at which they are spoken. The
rendering layer consumes this JSON instead of estimating timing from text
length or an assumed speaking speed.
"""

from __future__ import annotations

import re
import time
from pathlib import Path
from typing import Any, Sequence

import structlog

from src.adapters.lyrics.factory import get_lyrics_transcriber
from src.core.ports.lyrics_port import LyricsTranscriptionPort

logger = structlog.get_logger(__name__)

_TOKEN_RE = re.compile(r"[^\wÀ-ÿ]+", re.UNICODE)


def _tokens(value: str) -> list[str]:
    return [token.casefold() for token in _TOKEN_RE.split(value) if token]


def _flatten_words(transcription: dict[str, Any]) -> list[dict[str, Any]]:
    words: list[dict[str, Any]] = []
    for segment in transcription.get("segments", []):
        words.extend(segment.get("words", []))
    return words


def _find_phrase(words: Sequence[dict[str, Any]], phrase: str | Sequence[str]) -> tuple[int, int] | None:
    target = _tokens(phrase) if isinstance(phrase, str) else [token.casefold() for token in phrase]
    if not target:
        return None

    normalised_words = [_tokens(str(word.get("word", ""))) for word in words]
    for start_index in range(len(words)):
        candidate: list[str] = []
        end_index = start_index
        while end_index < len(words) and len(candidate) < len(target):
            candidate.extend(normalised_words[end_index])
            end_index += 1
        if candidate[: len(target)] == target:
            return start_index, end_index - 1
    return None


def _audio_duration(transcription: dict[str, Any], words: Sequence[dict[str, Any]]) -> float:
    metadata_duration = transcription.get("metadata", {}).get("audio_duration_sec")
    if metadata_duration is not None:
        return float(metadata_duration)
    return max((float(word.get("end", 0.0)) for word in words), default=0.0)


def build_timing_payload(
    transcription: dict[str, Any],
    reading_cues: Sequence[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Add deterministic reading cues to a raw Whisper transcription.

    Each cue needs a ``phrase`` (string or token list). Extra fields such as
    ``title``, ``translation`` and ``note`` are preserved for the visual
    template. A phrase starts at the first matching Whisper word and ends at
    the next phrase start, or at the end of the audio for the final phrase.
    """

    words = _flatten_words(transcription)
    duration = _audio_duration(transcription, words)
    matches: list[tuple[dict[str, Any], int, int]] = []

    for cue in reading_cues or []:
        match = _find_phrase(words, cue.get("phrase", []))
        if match is None:
            logger.warning(
                "academy_reading_phrase_not_found",
                cue_id=cue.get("id"),
                phrase=cue.get("phrase"),
            )
            continue
        matches.append((cue, match[0], match[1]))

    matches.sort(key=lambda item: float(words[item[1]].get("start", 0.0)))
    resolved_cues: list[dict[str, Any]] = []
    for index, (cue, start_word, end_word) in enumerate(matches):
        start = float(words[start_word]["start"])
        next_start = (
            float(words[matches[index + 1][1]]["start"])
            if index + 1 < len(matches)
            else duration
        )
        resolved_cues.append(
            {
                **{key: value for key, value in cue.items() if key != "phrase"},
                "start": round(start, 3),
                "end": round(max(start, next_start), 3),
                "matched_text": " ".join(
                    str(word.get("word", "")).strip() for word in words[start_word : end_word + 1]
                ).strip(),
                "matched_word_start": start_word,
                "matched_word_end": end_word,
            }
        )

    return {
        "schema_version": "1.0.0",
        "timing_source": "faster-whisper",
        "metadata": {
            **transcription.get("metadata", {}),
            "audio_duration_sec": round(duration, 3),
        },
        "segments": transcription.get("segments", []),
        "reading_cues": resolved_cues,
    }


async def transcribe_voiceover(
    audio_path: Path,
    *,
    language: str | None = "es",
    reading_cues: Sequence[dict[str, Any]] | None = None,
    transcriber: LyricsTranscriptionPort | None = None,
) -> dict[str, Any]:
    """Transcribe final narration with voice-appropriate Whisper settings."""

    started = time.monotonic()
    logger.info(
        "academy_transcription_start",
        audio=str(audio_path),
        language=language,
        model="large-v3",
        vad_filter=True,
    )
    adapter = transcriber or get_lyrics_transcriber()
    raw_transcription = await adapter.transcribe(
        audio_path,
        language=language,
        vad_filter=True,
    )
    payload = build_timing_payload(raw_transcription, reading_cues)
    words = _flatten_words(payload)
    logger.info(
        "academy_transcription_done",
        audio=str(audio_path),
        segments=len(payload["segments"]),
        words=len(words),
        duration_seconds=payload["metadata"].get("audio_duration_sec"),
        elapsed=round(time.monotonic() - started, 2),
    )
    return payload


def write_timing_payload(payload: dict[str, Any], destination: Path) -> Path:
    """Persist the audit-friendly timing contract next to the rendered job."""

    import json

    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    return destination
