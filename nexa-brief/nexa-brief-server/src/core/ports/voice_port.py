"""Voice Port — contrato para proveedores de texto a voz (TTS).

Mismo contrato que nexa-academy (src/core/ports/voice_port.py): `instruction`
es un prompt de estilo en lenguaje natural (Gemini lo usa), `emotion` es
para proveedores con un enum fijo. El formato de salida lo decide el
adaptador (Gemini devuelve PCM que se envuelve en WAV): el caller lee
`VoiceSynthesisResult.format`, nunca asume la extensión.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path


class VoiceSynthesisError(RuntimeError):
    """El proveedor no devolvió audio tras reintentos y rotación de claves."""


class VoiceQuotaExhausted(VoiceSynthesisError):
    """Todas las claves/modelos disponibles agotaron su cuota diaria."""


@dataclass
class VoiceSynthesisResult:
    path: Path
    format: str              # "wav" | "mp3"
    provider: str
    model: str
    voice: str
    duration_seconds: float
    characters: int
    key_label: str = ""      # etiqueta de la clave usada (nunca la clave)


class VoicePort(ABC):
    """Sintetiza *text* como audio hablado en *dest_path*."""

    @abstractmethod
    async def synthesize(
        self,
        text: str,
        dest_path: Path,
        *,
        voice: str | None = None,
        language: str | None = None,
        instruction: str | None = None,
        emotion: str | None = None,
    ) -> VoiceSynthesisResult:
        """Raises VoiceSynthesisError / VoiceQuotaExhausted."""
