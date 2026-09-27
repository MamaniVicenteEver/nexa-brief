"""Voice Port — abstract contract for text-to-speech providers.

Hueco que dejó la poda de dominio musical (ver docs/investigaciones): antes
de esto no existía NINGÚN adaptador de voz en el proyecto — `AudioConfig.mode
= "tts_with_bg_music"` era un valor de enum nunca implementado. Este puerto
es la base sobre la que nexa-academy narra cada lección.

`instruction`/`emotion` son genéricos a propósito (ver
docs/investigaciones/estudio-modelos-voz-tts.md en nexa-academy/nexa-docs/,
consolida la investigación real de Novita + Google AI Studio que ya existía
en el repo): cada proveedor interpreta lo que aplica y descarta el resto —
Gemini usa `instruction` (prompt de estilo en lenguaje natural, sin campo de
emoción propio); Novita/MiniMax usa `emotion` (enum fijo) e ignora
`instruction`; Novita/Fish deriva sus etiquetas inline de `emotion`. El
formato de salida NO está fijado a WAV — Novita devuelve mp3 nativo, Gemini
devuelve PCM crudo que el adapter envuelve en WAV — por eso
`VoiceSynthesisResult.format` existe: el caller nunca debe asumir la
extensión, tiene que leerla del resultado.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path


@dataclass
class VoiceSynthesisResult:
    path: Path
    format: str             # "wav" | "mp3" — el caller escribe/renombra según esto
    provider: str
    model: str
    voice: str
    duration_seconds: float
    characters: int          # para estimar costo — providers cobran por caracteres o tokens
    cost_usd_estimate: float = 0.0


class VoicePort(ABC):
    """Synthesize *text* as spoken audio, written to *dest_path*."""

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
        """Genera audio hablado de *text* y lo escribe junto a *dest_path*
        (el adapter decide la extensión real — ver `VoiceSynthesisResult.format`).

        Raises VoiceSynthesisError si el proveedor falla tras los reintentos.
        """
