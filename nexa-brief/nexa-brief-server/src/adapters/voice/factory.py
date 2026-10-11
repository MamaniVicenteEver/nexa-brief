"""Voice Adapter Factory — elige el proveedor de voz sin tocar a quien llama.

Hoy solo Gemini (con rotación de claves). Un proveedor nuevo (Novita,
ElevenLabs…) es un adaptador más en infrastructure/ y una rama acá.
"""

from src.config.settings import settings
from src.core.ports.voice_port import VoicePort


def get_voice(provider: str | None = None) -> VoicePort:
    effective = provider or settings.voice_provider
    if effective == "gemini":
        from src.adapters.voice.infrastructure.gemini_tts_adapter import GeminiTTSAdapter

        return GeminiTTSAdapter()
    raise ValueError(f"get_voice: proveedor desconocido {effective!r} (usar 'gemini').")
