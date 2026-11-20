"""Transcribe lyrics through the private media worker.

The result keeps the same contract as the local Faster Whisper adapter. The
worker deliberately receives a temporary filename, so the original filename
is restored locally after the result is downloaded. Only operational metadata
is logged; song content and filenames are not logged here.
"""

from __future__ import annotations

import math
from collections.abc import Sequence
from pathlib import Path
from typing import TYPE_CHECKING, Any

import structlog

from src.config.settings import settings
from src.core.ports.lyrics_port import LyricsTranscriptionPort

if TYPE_CHECKING:
    from src.adapters.private_media.client import PrivateMediaClient

logger = structlog.get_logger(__name__)


def _is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def _normalize_result(result: Any, *, filename: str, expected_model: str) -> dict[str, Any]:
    """Reject malformed worker results before they enter Nexa's lyrics cache."""
    if not isinstance(result, dict):
        raise RuntimeError("La VPS devolvió una transcripción inválida.")
    metadata = result.get("metadata")
    segments = result.get("segments")
    if not isinstance(metadata, dict) or not isinstance(segments, list):
        raise RuntimeError("La VPS devolvió una transcripción sin metadatos o segmentos válidos.")
    if (
        metadata.get("model") != expected_model
        or not isinstance(metadata.get("language"), str)
        or not metadata["language"]
        or not _is_number(metadata.get("language_probability"))
        or not _is_number(metadata.get("audio_duration_sec"))
    ):
        raise RuntimeError("La VPS devolvió metadatos de transcripción inválidos.")

    for segment in segments:
        if (
            not isinstance(segment, dict)
            or not isinstance(segment.get("id"), int)
            or isinstance(segment.get("id"), bool)
            or not isinstance(segment.get("text"), str)
            or not _is_number(segment.get("start"))
            or not _is_number(segment.get("end"))
            or not isinstance(segment.get("words"), list)
        ):
            raise RuntimeError("La VPS devolvió segmentos de transcripción inválidos.")
        for word in segment["words"]:
            if (
                not isinstance(word, dict)
                or not isinstance(word.get("word"), str)
                or not _is_number(word.get("start"))
                or not _is_number(word.get("end"))
            ):
                raise RuntimeError("La VPS devolvió palabras de transcripción inválidas.")

    # Never persist the worker's temporary name as the source filename.
    return {**result, "metadata": {**metadata, "file": filename}}


class PrivateMediaWhisperAdapter(LyricsTranscriptionPort):
    """Use the VPS for transcription and the existing local language detector.

    The worker currently offers transcription only. The small local detector
    remains responsible for ``detect_language`` until the worker exposes an
    equivalent endpoint returning the candidate probabilities.
    """

    requires_local_heavy_slot = False

    def __init__(
        self,
        client: PrivateMediaClient | None = None,
        *,
        language_detector: LyricsTranscriptionPort | None = None,
    ) -> None:
        if client is None:
            from src.adapters.private_media.client import PrivateMediaClient

            client = PrivateMediaClient()
        self._client = client
        self._language_detector = language_detector

    async def transcribe(self, audio_path: Path, language: str | None = None) -> dict[str, Any]:
        model = settings.whisper_model
        if model not in {"large-v3", "small"}:
            raise RuntimeError(f"El modelo Whisper configurado ({model}) no está disponible en la VPS.")
        if not audio_path.is_file():
            raise FileNotFoundError("El archivo de audio para transcribir no existe.")

        logger.info("private_media_transcription_start", model=model, language=language)
        try:
            raw = await self._client.transcribe(audio_path, model=model, language=language)
            result = _normalize_result(raw, filename=audio_path.name, expected_model=model)
        except Exception as exc:
            logger.warning("private_media_transcription_failed", error_type=type(exc).__name__)
            raise
        logger.info(
            "private_media_transcription_done",
            model=model,
            detected_language=result["metadata"]["language"],
            segments=len(result["segments"]),
        )
        return result

    async def detect_language(self, audio_path: Path, candidates: Sequence[str]) -> dict[str, float]:
        if self._language_detector is None:
            from src.adapters.lyrics.infrastructure.faster_whisper_adapter import FasterWhisperAdapter

            self._language_detector = FasterWhisperAdapter()
        logger.info("private_media_language_detection_local")
        return await self._language_detector.detect_language(audio_path, candidates)
