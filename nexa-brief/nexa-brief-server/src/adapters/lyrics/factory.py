"""Lyrics Adapter Factory — hoy siempre local (faster-whisper); el día que se
quiera un servicio externo de transcripción, se agrega el adaptador nuevo y se
cambia solo acá — lyrics_transcriber.py no se toca."""

from __future__ import annotations

from src.adapters.lyrics.infrastructure.faster_whisper_adapter import FasterWhisperAdapter
from src.core.ports.lyrics_port import LyricsTranscriptionPort

_transcriber: LyricsTranscriptionPort | None = None


def get_lyrics_transcriber() -> LyricsTranscriptionPort:
    global _transcriber
    if _transcriber is None:
        _transcriber = FasterWhisperAdapter()
    return _transcriber
