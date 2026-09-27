"""Lyrics Port — abstract contract for word-level lyrics transcription.

Aislado en su propio puerto/adaptador (hexagonal, mismo patrón que
AiPort/ImagePort/MusicPort) para que la implementación de hoy (faster-whisper
local) se pueda reemplazar mañana por un servicio externo sin tocar
lyrics_transcriber.py ni el resto del pipeline — solo la factory cambia.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any


class LyricsTranscriptionPort(ABC):
    """Transcribe audio a un JSON con timestamps por segmento y palabra.

    Aunque el nombre histórico conserva ``Lyrics``, el contrato ya sirve para
    dos casos: música y voz hablada. ``vad_filter=True`` debe usarse para
    narración; la música mantiene ``False`` porque el VAD puede recortar
    fragmentos cantados.
    """

    @abstractmethod
    async def transcribe(
        self,
        audio_path: Path,
        language: str | None = None,
        *,
        vad_filter: bool | None = None,
    ) -> dict[str, Any]:
        """Transcribe *audio_path* y devuelve un dict con el schema:

            {
              "metadata": {"file", "language", "language_probability", "model",
                            "device", "compute_type", "audio_duration_sec"},
              "segments": [
                {"id", "seek", "start", "end", "text", "avg_logprob",
                 "compression_ratio", "no_speech_prob", "temperature",
                 "words": [{"word", "start", "end", "probability"}, ...]}
              ]
            }

        *language*: código ISO ("es", "en", ...) si se conoce; None = auto-detectar.
        *vad_filter*: override por tipo de audio. ``None`` usa la configuración
        global; ``True`` es la opción recomendada para voz hablada.
        """
