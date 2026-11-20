"""Gemini TTS con rotación de claves y cadena de modelos.

Mismo pedido que ya funciona en el explainer-kit (tools/tts.py → gemini_director)
y en nexa-explainer (editorial_gemini_voice.py): generateContent con
responseModalities=AUDIO. Devuelve PCM 16-bit mono 24 kHz que se guarda como WAV.

Rotación (la misma regla del kit):
  · 429 "per day" o 402 (créditos agotados) → la clave queda agotada ~24 h para ESE
    modelo y se pasa a la siguiente.
  · 429 por minuto / 500 / 503 → se pasa a la siguiente clave sin marcarla.
  · Otro error HTTP (400, 403) → se registra y se prueba la siguiente clave.
  · Sin claves para un modelo → siguiente modelo de la cadena.
Si nada funciona: VoiceQuotaExhausted (todo agotado) o VoiceSynthesisError.
"""

from __future__ import annotations

import base64
import wave
from dataclasses import dataclass
from pathlib import Path

import httpx
import structlog

from src.adapters.voice.infrastructure.gemini_key_pool import GeminiKey, KeyPool
from src.config.settings import settings
from src.core.ports.voice_port import (
    VoicePort,
    VoiceQuotaExhausted,
    VoiceSynthesisError,
    VoiceSynthesisResult,
)

logger = structlog.get_logger(__name__)

ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
SAMPLE_RATE = 24_000


class _DailyQuota(Exception):
    pass


class _TryNextKey(Exception):
    pass


@dataclass
class KeyProbe:
    label: str
    ok: bool
    detail: str


def _write_wav(pcm: bytes, dest: Path) -> float:
    dest.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(dest), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SAMPLE_RATE)
        w.writeframes(pcm)
    return len(pcm) / (2 * SAMPLE_RATE)


class GeminiTTSAdapter(VoicePort):
    def __init__(
        self,
        pool: KeyPool | None = None,
        models: list[str] | None = None,
        transport: httpx.AsyncBaseTransport | None = None,
        timeout_seconds: float = 300,
    ) -> None:
        self._pool = pool or KeyPool()
        self._models = models or list(settings.gemini_tts_models)
        self._transport = transport
        self._timeout = timeout_seconds

    @property
    def models(self) -> list[str]:
        return list(self._models)

    @property
    def pool(self) -> KeyPool:
        return self._pool

    async def _request(self, client: httpx.AsyncClient, model: str, key: GeminiKey, prompt: str, voice: str) -> bytes:
        body = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "responseModalities": ["AUDIO"],
                "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}},
            },
        }
        try:
            response = await client.post(
                ENDPOINT.format(model=model),
                headers={"x-goog-api-key": key.value, "Content-Type": "application/json"},
                json=body,
            )
        except httpx.HTTPError as exc:
            raise _TryNextKey(f"red: {exc}") from exc
        if response.status_code == 402:
            # Créditos prepagados agotados: la clave no sirve hasta recargarla.
            raise _DailyQuota(response.text[:200])
        if response.status_code == 429:
            text = response.text
            if "per day" in text or "PerDay" in text:
                raise _DailyQuota(text[:200])
            raise _TryNextKey(f"HTTP 429: {text[:200]}")
        if response.status_code != 200:
            raise _TryNextKey(f"HTTP {response.status_code}: {response.text[:200]}")
        payload = response.json()
        candidate = (payload.get("candidates") or [{}])[0]
        parts = (candidate.get("content") or {}).get("parts") or []
        pcm = b"".join(base64.b64decode(p["inlineData"]["data"]) for p in parts if "inlineData" in p)
        if not pcm:
            raise _TryNextKey(f"sin audio (finishReason={candidate.get('finishReason')})")
        return pcm

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
        prompt = text
        if instruction:
            prompt = f"{instruction}\n\nTRANSCRIPT BEGINS\n{text}\nTRANSCRIPT ENDS"
        elif emotion:
            prompt = f"Narra con un tono {emotion}. Español latinoamericano neutro.\n\n{text}"

        errors: list[str] = []
        any_key_tried = False
        async with httpx.AsyncClient(timeout=self._timeout, transport=self._transport) as client:
            for model in self._models:
                for key in self._pool.available(model):
                    any_key_tried = True
                    try:
                        pcm = await self._request(client, model, key, prompt, voice_name)
                    except _DailyQuota:
                        logger.info("gemini_tts_key_exhausted", key=key.label, model=model)
                        self._pool.mark_exhausted(key, model)
                        continue
                    except _TryNextKey as exc:
                        errors.append(f"{model}/{key.label}: {exc}")
                        logger.warning("gemini_tts_try_next_key", key=key.label, model=model, error=str(exc))
                        continue
                    wav_path = dest_path.with_suffix(".wav")
                    duration = _write_wav(pcm, wav_path)
                    logger.info("gemini_tts_done", key=key.label, model=model, voice=voice_name, seconds=round(duration, 2))
                    return VoiceSynthesisResult(
                        path=wav_path,
                        format="wav",
                        provider="gemini",
                        model=model,
                        voice=voice_name,
                        duration_seconds=duration,
                        characters=len(text),
                        key_label=key.label,
                    )
        if not errors:
            raise VoiceQuotaExhausted(
                "todas las claves de Gemini agotaron la cuota diaria"
                if any_key_tried or self._pool.keys
                else "no hay claves GEMINI_API_KEY configuradas"
            )
        raise VoiceSynthesisError("; ".join(errors[-4:]))

    async def probe_keys(self, model: str | None = None, text: str = "Hola.") -> list[KeyProbe]:
        """Prueba CADA clave con un pedido mínimo (gasta 1 pedido por clave)."""
        model = model or self._models[0]
        results: list[KeyProbe] = []
        async with httpx.AsyncClient(timeout=self._timeout, transport=self._transport) as client:
            for key in self._pool.keys:
                try:
                    pcm = await self._request(client, model, key, text, settings.gemini_tts_voice)
                    results.append(KeyProbe(key.label, True, f"{len(pcm) / (2 * SAMPLE_RATE):.2f} s de audio"))
                except _DailyQuota as exc:
                    self._pool.mark_exhausted(key, model)
                    reason = "créditos agotados (402)" if "402" in str(exc) or "credits" in str(exc) else "cuota diaria agotada"
                    results.append(KeyProbe(key.label, False, reason))
                except _TryNextKey as exc:
                    results.append(KeyProbe(key.label, False, str(exc)[:160]))
        return results
