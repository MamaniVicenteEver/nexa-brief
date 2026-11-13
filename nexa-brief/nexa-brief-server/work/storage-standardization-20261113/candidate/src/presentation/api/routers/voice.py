"""Voice router — estado de las claves de Gemini, prueba de claves y muestra de voz.

GET  /voice/keys           → etiquetas de las claves (nunca su valor) y qué modelos agotó cada una.
POST /voice/keys/probe     → prueba CADA clave con un pedido mínimo (gasta 1 pedido por clave).
POST /voice/preview        → sintetiza un texto corto y devuelve el WAV (rota claves y modelos).
"""

from __future__ import annotations

import tempfile
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from src.adapters.voice.infrastructure.gemini_tts_adapter import GeminiTTSAdapter
from src.config.settings import settings
from src.core.ports.voice_port import VoiceQuotaExhausted, VoiceSynthesisError

router = APIRouter(prefix="/voice", tags=["voice"])


class VoicePreviewRequest(BaseModel):
    text: str = Field(..., min_length=2, max_length=600)
    voice: str | None = None
    instruction: str | None = Field(None, max_length=800)


@router.get("/keys")
async def voice_keys() -> dict:
    adapter = GeminiTTSAdapter()
    return {"models": adapter.models, "keys": adapter.pool.status(adapter.models)}


@router.post("/keys/probe")
async def probe_voice_keys(model: str | None = None) -> dict:
    adapter = GeminiTTSAdapter()
    results = await adapter.probe_keys(model)
    return {
        "model": model or adapter.models[0],
        "ok": sum(r.ok for r in results),
        "total": len(results),
        "keys": [r.__dict__ for r in results],
    }


@router.post("/preview")
async def voice_preview(body: VoicePreviewRequest) -> FileResponse:
    out_dir = Path(tempfile.gettempdir()) / "nexa-voice-preview"
    dest = out_dir / f"{uuid.uuid4().hex[:10]}.wav"
    try:
        result = await GeminiTTSAdapter().synthesize(
            body.text, dest, voice=body.voice or settings.gemini_tts_voice, instruction=body.instruction
        )
    except VoiceQuotaExhausted as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc
    except VoiceSynthesisError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return FileResponse(
        result.path,
        media_type="audio/wav",
        headers={"X-Voice-Model": result.model, "X-Voice-Key": result.key_label},
    )
