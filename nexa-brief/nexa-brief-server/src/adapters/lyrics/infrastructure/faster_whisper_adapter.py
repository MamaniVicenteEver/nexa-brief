"""Local faster-whisper adapter — transcripción de canciones a JSON con
timestamps por palabra, corriendo en el propio proceso (sin servicio externo).

Parámetros calcados de html-templates-poc/lyric-videos/transcribe.py (ya
probados en 3 canciones reales, ver ese script para la justificación completa
de por qué no son los defaults de faster-whisper — resumen: vad_filter=False
porque el VAD de Silero está afinado para voz hablada y descarta tramos
cantados reales; condition_on_previous_text=False para no arrastrar errores en
pistas largas; escalera de temperature para reintentar tramos difíciles).
"""

from __future__ import annotations

import asyncio
from collections.abc import Sequence
from pathlib import Path
from typing import Any

import structlog
from faster_whisper import WhisperModel
from faster_whisper.audio import decode_audio

from src.config.settings import settings
from src.core.ports.lyrics_port import LyricsTranscriptionPort

logger = structlog.get_logger(__name__)

# El modelo (varios GB en RAM/disco) se carga una sola vez por proceso, no por
# transcripción — cargarlo por job sería un desperdicio enorme de tiempo.
_model: WhisperModel | None = None


def _get_model() -> WhisperModel:
    global _model
    if _model is None:
        logger.info(
            "faster_whisper_loading_model",
            model=settings.whisper_model,
            device=settings.whisper_device,
            compute_type=settings.whisper_compute_type,
        )
        _model = WhisperModel(
            settings.whisper_model,
            device=settings.whisper_device,
            compute_type=settings.whisper_compute_type,
        )
    return _model


def _transcribe_sync(audio_path: Path, language: str | None) -> dict[str, Any]:
    """Bloqueante y CPU-bound — se corre en un thread aparte, ver transcribe()."""
    model = _get_model()
    segments, info = model.transcribe(
        str(audio_path),
        language=language,
        task="transcribe",
        beam_size=8,
        best_of=8,
        patience=1.0,
        temperature=[0.0, 0.2, 0.4, 0.6, 0.8, 1.0],
        word_timestamps=True,
        vad_filter=False,
        condition_on_previous_text=False,
        compression_ratio_threshold=2.6,
        log_prob_threshold=-1.8,
        no_speech_threshold=0.2,
        log_progress=True,
    )
    segments = list(segments)

    result: dict[str, Any] = {
        "metadata": {
            "file": audio_path.name,
            "language": info.language,
            "language_probability": info.language_probability,
            "model": settings.whisper_model,
            "device": settings.whisper_device,
            "compute_type": settings.whisper_compute_type,
            "audio_duration_sec": info.duration,
        },
        "segments": [],
    }

    for segment in segments:
        words = []
        if segment.words:
            for w in segment.words:
                words.append({
                    "word": w.word,
                    "start": w.start,
                    "end": w.end,
                    "probability": getattr(w, "probability", None),
                })
        result["segments"].append({
            "id": segment.id,
            "seek": getattr(segment, "seek", None),
            "start": segment.start,
            "end": segment.end,
            "text": segment.text,
            "avg_logprob": getattr(segment, "avg_logprob", None),
            "compression_ratio": getattr(segment, "compression_ratio", None),
            "no_speech_prob": getattr(segment, "no_speech_prob", None),
            "temperature": getattr(segment, "temperature", None),
            "words": words,
        })

    return result


_detection_model: WhisperModel | None = None


def _get_detection_model() -> WhisperModel:
    """Reuse the transcription model if it's already in memory; otherwise load a
    small one — detecting es/en doesn't need large-v3 (and its ~6 GB of RAM)."""
    global _detection_model
    if _model is not None:
        return _model
    if _detection_model is None:
        logger.info("faster_whisper_loading_detection_model", model=settings.whisper_language_detection_model)
        _detection_model = WhisperModel(
            settings.whisper_language_detection_model,
            device=settings.whisper_device,
            compute_type="int8",
        )
    return _detection_model


_SAMPLE_RATE = 16_000
_DETECT_WINDOWS = 3        # Whisper analyzes 30 s per window
_DETECT_SKIP_RATIO = 0.2   # skip the intro, usually instrumental


def _detect_language_sync(audio_path: Path, candidates: Sequence[str]) -> dict[str, float]:
    audio = decode_audio(str(audio_path), sampling_rate=_SAMPLE_RATE)
    start = int(len(audio) * _DETECT_SKIP_RATIO)
    window = audio[start : start + _DETECT_WINDOWS * 30 * _SAMPLE_RATE]
    if len(window) < 5 * _SAMPLE_RATE:
        window = audio
    _, _, all_probs = _get_detection_model().detect_language(
        audio=window, language_detection_segments=_DETECT_WINDOWS
    )
    probs = dict(all_probs)
    return {code: float(probs.get(code, 0.0)) for code in candidates}


class FasterWhisperAdapter(LyricsTranscriptionPort):
    async def transcribe(self, audio_path: Path, language: str | None = None) -> dict[str, Any]:
        logger.info("faster_whisper_transcribe_start", audio=str(audio_path), language=language)
        # model.transcribe() es síncrono/bloqueante y puede tardar varios minutos
        # (large-v3/float32/cpu) — correrlo directo en el event loop congelaría
        # TODO el servidor (incluidos otros jobs en paralelo).
        result = await asyncio.to_thread(_transcribe_sync, audio_path, language)
        logger.info(
            "faster_whisper_transcribe_done",
            audio=str(audio_path),
            detected_language=result["metadata"]["language"],
            segments=len(result["segments"]),
        )
        return result

    async def detect_language(self, audio_path: Path, candidates: Sequence[str]) -> dict[str, float]:
        probabilities = await asyncio.to_thread(_detect_language_sync, audio_path, candidates)
        logger.info("faster_whisper_detect_language", audio=str(audio_path), probabilities=probabilities)
        return probabilities
