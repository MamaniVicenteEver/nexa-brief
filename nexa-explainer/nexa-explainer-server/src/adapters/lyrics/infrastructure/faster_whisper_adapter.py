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
from pathlib import Path
from typing import Any

import structlog
from faster_whisper import WhisperModel

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
