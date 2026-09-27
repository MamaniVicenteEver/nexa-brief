"""Novita TTS adapter — 3 motores reales (MiniMax HD/Turbo, Fish Audio S1).

Request/response tal cual se validaron con audio real en la investigación que
ya existía en el repo — ver `html-templates-poc/production/06-voz-creation-cont/
test_economia_novita.py` (fuente primaria) y el resumen en
`nexa-academy/nexa-docs/investigaciones/estudio-modelos-voz-tts.md`. No es
código nuevo especulativo: los 3 endpoints, el shape de request/response y los
precios por caracter ya corrieron contra la API real antes de este adapter.

`NOVITA_IA` es una API key de Novita AI, la misma plataforma que ya usa
`deepseek_adapter.py` para texto (variable de entorno separada — TTS es un
producto distinto dentro de Novita, no comparte cuota).
"""

from __future__ import annotations

import asyncio
from pathlib import Path

import httpx
import structlog

from src.config.exceptions import VoiceSynthesisError
from src.config.settings import settings
from src.core.ports.voice_port import VoicePort, VoiceSynthesisResult

logger = structlog.get_logger(__name__)

_BASE = "https://api.novita.ai"
_ENDPOINTS = {
    "minimax-hd": f"{_BASE}/v3/minimax-speech-2.8-hd",
    "minimax-turbo": f"{_BASE}/v3/minimax-speech-2.8-turbo",
    "fish": f"{_BASE}/v4beta/txt2speech",
}
# USD por 1M caracteres de texto de ENTRADA — precios reales medidos en el
# estudio (test_economia_novita.py), no de lista de precios oficial.
_PRICE_PER_M_CHARS = {"minimax-hd": 100.0, "minimax-turbo": 60.0, "fish": 15.0}
_DEFAULT_SPEED = {"minimax-hd": 0.95, "minimax-turbo": 0.95, "fish": 0.85}

# Fish no tiene un campo de emoción — usa etiquetas inline antepuestas al
# texto (ver COMPARATIVA-VOCES.md, sección 4). Mapeo de emotion genérica del
# VoicePort a la etiqueta validada más cercana.
_FISH_EMOTION_TAGS = {
    "calm": "(serious)",
    "fluent": "(serious)",
    "happy": "(moved)",
    "sad": "(sad) (sighing)",
    "fearful": "(worried)",
    "whisper": "(whispering)",
}


class NovitaTTSAdapter(VoicePort):
    """`engine`: "minimax-hd" | "minimax-turbo" | "fish". Default: settings.novita_tts_engine."""

    def __init__(self, engine: str | None = None) -> None:
        if not settings.novita_api_key:
            raise VoiceSynthesisError("NOVITA_IA is not set.")
        self._engine = engine or settings.novita_tts_engine
        if self._engine not in _ENDPOINTS:
            raise VoiceSynthesisError(
                f"NovitaTTSAdapter: engine={self._engine!r} inválido — usar uno de {list(_ENDPOINTS)}."
            )

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
        headers = {"Authorization": f"Bearer {settings.novita_api_key}", "Content-Type": "application/json"}
        mp3_path = dest_path.with_suffix(".mp3")
        mp3_path.parent.mkdir(parents=True, exist_ok=True)

        logger.info("voice_synthesis_start", provider="novita", model=self._engine, characters=len(text))

        for attempt in range(1, settings.ai_max_retries + 1):
            try:
                async with httpx.AsyncClient(headers=headers, timeout=180) as client:
                    if self._engine == "fish":
                        audio_bytes, duration_ms = await self._call_fish(client, text, emotion)
                        voice_name = "default"
                    else:
                        voice_name = voice or settings.novita_tts_voice
                        audio_bytes, duration_ms = await self._call_minimax(client, text, voice_name, emotion)

                mp3_path.write_bytes(audio_bytes)
                duration = duration_ms / 1000
                cost = (len(text) / 1_000_000) * _PRICE_PER_M_CHARS[self._engine]
                logger.info(
                    "voice_synthesis_done",
                    provider="novita",
                    model=self._engine,
                    voice=voice_name,
                    duration_seconds=round(duration, 2),
                    characters=len(text),
                    cost_usd_estimate=round(cost, 5),
                )
                return VoiceSynthesisResult(
                    path=mp3_path,
                    format="mp3",
                    provider="novita",
                    model=self._engine,
                    voice=voice_name,
                    duration_seconds=duration,
                    characters=len(text),
                    cost_usd_estimate=cost,
                )
            except VoiceSynthesisError:
                raise
            except Exception as exc:
                logger.warning("voice_synthesis_retry", provider="novita", engine=self._engine, attempt=attempt, error=str(exc))
                if attempt == settings.ai_max_retries:
                    raise VoiceSynthesisError(f"Novita TTS ({self._engine}) failed after {attempt} attempts: {exc}") from exc
                await asyncio.sleep(settings.ai_retry_delay_seconds * attempt)
        raise VoiceSynthesisError("Novita TTS: unreachable")

    async def _call_minimax(
        self, client: httpx.AsyncClient, text: str, voice_id: str, emotion: str | None
    ) -> tuple[bytes, float]:
        body = {
            "text": text,
            "voice_setting": {
                "voice_id": voice_id, "vol": 1.0, "pitch": 0,
                "speed": _DEFAULT_SPEED[self._engine], "emotion": emotion or "calm",
            },
            "audio_setting": {"format": "mp3", "bitrate": 128000, "sample_rate": 32000, "channel": 1},
            "language_boost": "Spanish", "stream": False, "output_format": "hex",
        }
        r = await self._post(client, _ENDPOINTS[self._engine], body)
        j = r.json()
        if j.get("base_resp", {}).get("status_code", 0) != 0:
            raise VoiceSynthesisError(f"MiniMax ({self._engine}): {j.get('base_resp')}")
        audio = bytes.fromhex(j["data"]["audio"])
        ms = j.get("extra_info", {}).get("audio_length", 0)
        return audio, float(ms)

    async def _call_fish(self, client: httpx.AsyncClient, text: str, emotion: str | None) -> tuple[bytes, float]:
        tag = _FISH_EMOTION_TAGS.get(emotion or "calm", "(serious)")
        body = {
            "text": f"{tag} {text}", "model": "s1", "format": "mp3",
            "temperature": 0.7, "top_p": 0.7,
            "prosody": {"speed": _DEFAULT_SPEED["fish"], "volume": 0},
        }
        r = await self._post(client, _ENDPOINTS["fish"], body)
        if "json" in r.headers.get("content-type", ""):
            raise VoiceSynthesisError(f"Fish Audio: {r.text[:300]}")
        # Estimación de duración a partir del tamaño (128kbps), igual que el
        # script de investigación original — Fish no devuelve duración en la
        # respuesta, solo el binario mp3 directo.
        ms = (len(r.content) / 16_000) * 1000
        return r.content, ms

    async def _post(self, client: httpx.AsyncClient, url: str, body: dict) -> httpx.Response:
        """POST con reintentos ante 5xx/errores de red — mismo criterio que el
        script de investigación original (los 500 de MiniMax son transitorios)."""
        for attempt in range(4):
            try:
                r = await client.post(url, json=body)
            except httpx.RequestError as e:
                if attempt < 3:
                    await asyncio.sleep(2 * (attempt + 1))
                    continue
                raise VoiceSynthesisError(f"Novita: error de red: {e}") from e
            if r.status_code < 400:
                return r
            if r.status_code >= 500 and attempt < 3:
                await asyncio.sleep(2 * (attempt + 1))
                continue
            raise VoiceSynthesisError(f"Novita: HTTP {r.status_code}: {r.text[:200]}")
        raise VoiceSynthesisError("Novita: agotados los reintentos de red")
