"""Voice Adapter Factory — selección de proveedor/motor, sin tocar quien llama.

Mismo patrón que `recorder/factory.py::get_recorder(engine_override=...)`:
un override explícito gana sobre el default de `settings`. Transición entre
proveedores (Gemini <-> Novita) o entre motores de Novita (minimax-hd/turbo/
fish) es un solo parámetro, no un cambio de código en el pipeline.
"""

from src.config.settings import settings
from src.core.ports.voice_port import VoicePort


def get_voice_ai(provider: str | None = None, *, engine: str | None = None) -> VoicePort:
    """`provider`: "gemini" | "novita" (default: settings.voice_provider).
    `engine`: solo aplica si provider="novita" — "minimax-hd"|"minimax-turbo"|"fish"
    (default: settings.novita_tts_engine)."""
    effective_provider = provider or settings.voice_provider

    if effective_provider == "novita":
        from src.adapters.voice.infrastructure.novita_tts_adapter import NovitaTTSAdapter
        return NovitaTTSAdapter(engine=engine)

    if effective_provider == "gemini":
        from src.adapters.voice.infrastructure.gemini_tts_adapter import GeminiTTSAdapter
        return GeminiTTSAdapter()

    raise ValueError(f"get_voice_ai: provider={effective_provider!r} desconocido (usar 'gemini' o 'novita').")
