"""Gemini TTS adapter — mismo patrón de cliente/reintentos que gemini_flash_adapter.py.

Probado con smoke tests reales (2026-09-17): `gemini-2.5-pro-preview-tts`
devuelve PCM crudo (`audio/l16; rate=24000; channels=1`, confirmado en la
respuesta real, no en documentación) — no un WAV/MP3 con contenedor, por eso
este adapter arma el header WAV él mismo con el módulo estándar `wave`.

Gemini no tiene un campo de "emoción" separado — todo el estilo (incluida la
emoción) se da como lenguaje natural antepuesto al texto (`instruction`, ver
style_templates.py). Si solo se pasa `emotion` sin `instruction`, se arma una
instrucción mínima a partir de la emoción para no perder ese dato.
"""

from __future__ import annotations

import asyncio
import wave
from pathlib import Path

import structlog
from google import genai
from google.genai import types

from src.config.exceptions import VoiceSynthesisError
from src.config.settings import settings
from src.core.ports.voice_port import VoicePort, VoiceSynthesisResult

logger = structlog.get_logger(__name__)

# Confirmado en la respuesta real del modelo (no documentado explícitamente
# por Google) — si el proveedor cambia esto sin avisar, _write_wav lo
# reflejaría mal; validar de nuevo si el mime_type de la respuesta difiere.
_SAMPLE_RATE_HZ = 24_000
_SAMPLE_WIDTH_BYTES = 2  # 16-bit PCM
_CHANNELS = 1

# Precios de referencia del estudio (ver nexa-academy/nexa-docs/investigaciones/
# estudio-modelos-voz-tts.md) — USD por 1M tokens de salida. Estimación gruesa
# de tokens de audio ≈ caracteres de texto de entrada × 4 (regla de dedo del
# estudio, no una fórmula oficial de Google) — solo para comparar órdenes de
# magnitud entre proveedores, no para facturación real.
_OUTPUT_PRICE_PER_M_TOKENS = {
    "gemini-2.5-flash-preview-tts": 10.0,
    "gemini-2.5-pro-preview-tts": 20.0,
    "gemini-3.1-flash-tts-preview": 20.0,
}


def _write_wav(pcm_bytes: bytes, dest_path: Path) -> float:
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(dest_path), "wb") as w:
        w.setnchannels(_CHANNELS)
        w.setsampwidth(_SAMPLE_WIDTH_BYTES)
        w.setframerate(_SAMPLE_RATE_HZ)
        w.writeframes(pcm_bytes)
    frames = len(pcm_bytes) / (_SAMPLE_WIDTH_BYTES * _CHANNELS)
    return frames / _SAMPLE_RATE_HZ


class GeminiTTSAdapter(VoicePort):
    """Wraps the google-genai SDK's audio-output mode (response_modalities=["AUDIO"])."""

    def __init__(self) -> None:
        if not settings.gemini_api_key:
            raise VoiceSynthesisError("GEMINI_API_KEY is not set.")
        self._client = genai.Client(api_key=settings.gemini_api_key)
        self._model = settings.gemini_tts_model

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
        voice_name = voice or settings.gemini_tts_voice
        content = text
        if instruction:
            content = f"{instruction}\n\n{text}"
        elif emotion:
            content = f"Narra con un tono {emotion}. Español latino neutro.\n\n{text}"

        logger.info(
            "voice_synthesis_start",
            provider="gemini",
            model=self._model,
            voice=voice_name,
            characters=len(text),
        )

        for attempt in range(1, settings.ai_max_retries + 1):
            try:
                response = await self._client.aio.models.generate_content(
                    model=self._model,
                    contents=content,
                    config=types.GenerateContentConfig(
                        response_modalities=["AUDIO"],
                        speech_config=types.SpeechConfig(
                            voice_config=types.VoiceConfig(
                                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=voice_name)
                            )
                        ),
                    ),
                )
                part = response.candidates[0].content.parts[0]
                pcm_bytes = part.inline_data.data
                if not pcm_bytes:
                    raise VoiceSynthesisError("Gemini TTS devolvió una respuesta sin audio.")

                wav_path = dest_path.with_suffix(".wav")
                duration = _write_wav(pcm_bytes, wav_path)
                price = _OUTPUT_PRICE_PER_M_TOKENS.get(self._model, 0.0)
                cost_estimate = (len(content) * 4 / 1_000_000) * price
                logger.info(
                    "voice_synthesis_done",
                    provider="gemini",
                    model=self._model,
                    voice=voice_name,
                    instruction_used=bool(instruction or emotion),
                    duration_seconds=round(duration, 2),
                    characters=len(text),
                    cost_usd_estimate=round(cost_estimate, 5),
                )
                return VoiceSynthesisResult(
                    path=wav_path,
                    format="wav",
                    provider="gemini",
                    model=self._model,
                    voice=voice_name,
                    duration_seconds=duration,
                    characters=len(text),
                    cost_usd_estimate=cost_estimate,
                )
            except VoiceSynthesisError:
                raise
            except Exception as exc:
                logger.warning("voice_synthesis_retry", provider="gemini", attempt=attempt, error=str(exc))
                if attempt == settings.ai_max_retries:
                    raise VoiceSynthesisError(f"Gemini TTS failed after {attempt} attempts: {exc}") from exc
                await asyncio.sleep(settings.ai_retry_delay_seconds * attempt)
        raise VoiceSynthesisError("Gemini TTS: unreachable")
