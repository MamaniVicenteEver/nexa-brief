"""Two-stage editorial voice direction and a continuous Gacrux narration track."""

from __future__ import annotations

import asyncio
import base64
import json
import wave
from pathlib import Path
from typing import Any

import httpx

from src.adapters.ai.infrastructure.gemini_flash_adapter import GeminiFlashAdapter
from src.config.settings import settings
from src.explainer.editorial_audio import _concat_wav, _duration, _fit_line, _silence
from src.explainer.models import EditorialPlan


TTS_MODEL = "gemini-3.1-flash-tts-preview"
TTS_FALLBACK_MODEL = "gemini-2.5-flash-preview-tts"
TTS_VOICE = "Gacrux"
TTS_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
_TAGS = {
    "serious", "quietly", "with disbelief", "with contained anger",
    "building intensity", "warmly", "reflectively", "firmly", "with hope",
}

_PROMPT_WRITER_SYSTEM = """Eres el segundo agente de dirección vocal de Nexa Explainer.
Recibes el análisis emocional temporizado de DeepSeek y una adaptación editorial
en español. Devuelve sólo JSON con `global_direction` (texto breve) y `segments`
(array de objetos con `id`, `tag`, `delivery_note`). Debes devolver exactamente
un objeto por segmento, en el mismo orden. `tag` debe ser una sola de estas
etiquetas en inglés, sin corchetes: serious, quietly, with disbelief,
with contained anger, building intensity, warmly, reflectively, firmly,
with hope. `delivery_note` debe ser una instrucción concreta y corta.
El arco debe sonar humano: sobriedad, dolor contenido, indignación gradual,
resolución y llamada de atención final. Reserva la mayor firmeza para frases
justificadas por el contenido; conserva una sola identidad vocal durante todo el relato.
No reescribas el texto, ni inventes hechos, ni pidas imitar al orador original.
La voz final será español latino neutro. Las marcas no se pronuncian."""


def _references(plan: EditorialPlan) -> list[dict[str, Any]]:
    return [
        {
            "id": segment.id,
            "source_start": segment.source_start,
            "source_end": segment.source_end,
            "text": segment.narration,
            "title": segment.title,
            "emotion": segment.emotion,
        }
        for segment in plan.segments
    ]


def _groups(length: int) -> list[list[int]]:
    """Use three coherent scenes for the ten-part Obama story; keep generic plans usable."""
    indexes = list(range(length))
    if length <= 3:
        return [indexes]
    if length == 10:
        return [indexes[:3], indexes[3:6], indexes[6:]]
    return [indexes[offset:offset + 3] for offset in range(0, length, 3)]


async def write_tts_prompts(
    plan: EditorialPlan,
    analysis: dict[str, Any],
    *,
    voice: str = TTS_VOICE,
) -> dict[str, Any]:
    """Ask Gemini to translate DeepSeek's direction into a validated TTS prompt."""
    if not settings.gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY no está configurada.")
    adapter = GeminiFlashAdapter()
    raw = await adapter.complete_json(
        _PROMPT_WRITER_SYSTEM,
        json.dumps({
            "voice": voice,
            "global_voice_direction": analysis.get("global_voice_direction"),
            "emotion_segments": analysis.get("segments"),
            "editorial_script": _references(plan),
        }, ensure_ascii=False),
    )
    returned = raw.get("segments") if isinstance(raw, dict) else None
    if not isinstance(returned, list) or len(returned) != len(plan.segments):
        raise ValueError("Gemini no devolvió una dirección para cada segmento.")
    normalized = []
    for source, item in zip(plan.segments, returned, strict=True):
        if not isinstance(item, dict) or item.get("id") != source.id:
            raise ValueError(f"Gemini cambió el orden o ID del segmento {source.id}.")
        tag = str(item.get("tag") or "").strip().strip("[]")
        if tag not in _TAGS:
            raise ValueError(f"Gemini devolvió una etiqueta no permitida: {tag}")
        normalized.append({
            "id": source.id,
            "tag": tag,
            "delivery_note": str(item.get("delivery_note") or "").strip()[:220],
            "text": source.narration,
        })

    global_direction = str(raw.get("global_direction") or "").strip()[:800]
    prompts = []
    for part, indexes in enumerate(_groups(len(plan.segments)), start=1):
        instructions = " ".join(normalized[index]["delivery_note"] for index in indexes)
        transcript = "\n\n".join(
            f"[{normalized[index]['tag']}] {normalized[index]['text']}"
            for index in indexes
        )
        prompt = (
            "GENERATE SPEECH AUDIO ONLY.\n"
            "Do not read section titles or bracketed delivery notes aloud.\n\n"
            "AUDIO PROFILE\n"
            "One mature, close, natural Latin American Spanish documentary narrator. "
            f"Use the selected {voice} voice. Do not imitate a real person.\n\n"
            "SCENE\n"
            "A historical story about Gene Manford: an injustice becomes a collective cause. "
            "Let the emotion build naturally; avoid a theatrical performance.\n\n"
            "DIRECTOR'S NOTES\n"
            f"{global_direction} {instructions} "
            "Clear diction and human breathing. The closing appeal should be firm and compassionate.\n\n"
            "TRANSCRIPT BEGINS\n"
            f"{transcript}\n"
            "TRANSCRIPT ENDS"
        )
        prompts.append({
            "id": f"part-{part:02d}",
            "segment_ids": [plan.segments[index].id for index in indexes],
            "source_start": plan.segments[indexes[0]].source_start,
            "source_end": plan.segments[indexes[-1]].source_end,
            "prompt": prompt,
        })

    return {
        "provider": "gemini",
        "prompt_model": settings.gemini_model,
        "tts_model": TTS_MODEL,
        "voice": voice,
        "global_direction": global_direction,
        "segments": normalized,
        "prompts": prompts,
    }


async def _tts(
    client: httpx.AsyncClient,
    prompt: str,
    destination: Path,
    model: str,
    voice: str,
) -> float:
    response = await client.post(
        TTS_ENDPOINT.format(model=model),
        headers={"x-goog-api-key": settings.gemini_api_key, "Content-Type": "application/json"},
        json={
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "responseModalities": ["AUDIO"],
                "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}},
            },
        },
    )
    if response.status_code != 200:
        raise RuntimeError(f"Gemini TTS HTTP {response.status_code}: {response.text[:350]}")
    payload = response.json()
    try:
        parts = payload["candidates"][0]["content"]["parts"]
        pcm = b"".join(base64.b64decode(part["inlineData"]["data"]) for part in parts if "inlineData" in part)
    except (KeyError, IndexError, TypeError) as exc:
        raise RuntimeError(f"Gemini TTS devolvió audio inválido: {str(payload)[:350]}") from exc
    if not pcm:
        raise RuntimeError("Gemini TTS no devolvió muestras de audio.")
    with wave.open(str(destination), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(24_000)
        wav.writeframes(pcm)
    return len(pcm) / 48_000


async def synthesize_gemini_narration(
    plan: EditorialPlan,
    project_dir: Path,
    analysis: dict[str, Any],
    *,
    voice: str = TTS_VOICE,
    output_stem: str = "editorial-narration",
) -> tuple[Path, dict[str, Any]]:
    """Generate scene chunks with one voice, align scene bounds, join one WAV."""
    voice_plan = await write_tts_prompts(plan, analysis, voice=voice)
    prompts_path = project_dir / (
        "editorial-tts-prompts.json"
        if output_stem == "editorial-narration"
        else f"{output_stem}-tts-prompts.json"
    )
    prompts_path.write_text(
        json.dumps(voice_plan, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    parts_dir = project_dir / "editorial_gemini_audio"
    parts_dir.mkdir(parents=True, exist_ok=True)
    intro = parts_dir / "00-intro-silence.wav"
    outro = parts_dir / "99-outro-silence.wav"
    _silence(intro, plan.segments[0].timeline_start)
    _silence(outro, max(0.1, plan.duration_seconds - plan.segments[-1].timeline_end))
    selected_model = ""
    files: list[Path] = []
    part_meta: list[dict[str, Any]] = []
    async with httpx.AsyncClient(timeout=240) as client:
        for model in (TTS_MODEL, TTS_FALLBACK_MODEL):
            model_dir = parts_dir / model / voice.lower()
            model_dir.mkdir(exist_ok=True)
            candidate_files = [intro]
            candidate_meta: list[dict[str, Any]] = []
            try:
                for item in voice_plan["prompts"]:
                    raw = model_dir / f"{item['id']}-raw.wav"
                    if raw.exists() and _duration(raw) > 1:
                        actual = _duration(raw)
                    else:
                        actual = await _tts(client, item["prompt"], raw, model, voice)
                    target = float(item["source_end"] - item["source_start"])
                    fitted = model_dir / f"{item['id']}-fitted.wav"
                    await asyncio.to_thread(_fit_line, raw, fitted, target)
                    candidate_files.append(fitted)
                    candidate_meta.append({
                        "id": item["id"],
                        "segment_ids": item["segment_ids"],
                        "raw_seconds": round(actual, 3),
                        "target_seconds": round(target, 3),
                        "tempo_factor": round(actual / target, 3),
                    })
            except RuntimeError as error:
                if "HTTP 429" in str(error) and model != TTS_FALLBACK_MODEL:
                    continue
                raise
            selected_model = model
            files = candidate_files
            part_meta = candidate_meta
            break
    if not selected_model:
        raise RuntimeError("Gemini no devolvió narración para ninguno de los modelos disponibles.")
    files.append(outro)
    destination = project_dir / f"{output_stem}.wav"
    await asyncio.to_thread(_concat_wav, files, destination)
    metadata = {
        "provider": "gemini",
        "model": selected_model,
        "requested_model": TTS_MODEL,
        "prompt_model": settings.gemini_model,
        "voice": voice,
        "language": "es",
        "duration_seconds": round(_duration(destination), 3),
        "synthetic_voice_disclosure": f"Adaptación editorial con voz sintética {voice}; no imita al orador original.",
        "parts": part_meta,
    }
    voice_plan["selected_tts_model"] = selected_model
    prompts_path.write_text(
        json.dumps(voice_plan, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    metadata_path = project_dir / (
        "editorial-audio.json"
        if output_stem == "editorial-narration"
        else f"{output_stem}-audio.json"
    )
    metadata_path.write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return destination, metadata
