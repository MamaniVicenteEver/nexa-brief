"""DeepSeek-driven emotional direction for synthetic Spanish narration.

This pass does not imitate the source speaker. It translates editorial intent into
provider-neutral performance controls that a later TTS adapter can apply safely.
"""

from __future__ import annotations

import json
from typing import Any

from src.adapters.ai.infrastructure.deepseek_adapter import DeepSeekAdapter
from src.config.settings import settings


_ALLOWED_TTS_EMOTIONS = {"happy", "sad", "angry", "fearful", "disgusted", "surprised", "calm"}

_SYSTEM_PROMPT = """
Eres el director de voz y editor narrativo de Nexa Explainer. Analiza una narración
editorial en español segmentada por tiempo y devuelve únicamente JSON válido.

Tu tarea no es describir la voz real del orador ni imitarla. Debes decidir cómo una
voz sintética genérica puede interpretar cada bloque: emoción, intención retórica,
energía, ritmo, tono, pausas, palabras que deben recibir énfasis y el momento en que
conviene elevar la tensión, quebrar ligeramente la entrega o hacer una llamada a la
acción. Basa cada decisión en el texto; si no hay evidencia suficiente usa una
dirección contenida y explica la razón.

Reglas profesionales:
- Mantén español claro, natural y apto para locución.
- No inventes hechos, cifras ni citas que no estén en el texto.
- No uses emojis, ASCII art ni etiquetas vagas como "hazlo emocionante" sin controles.
- No recomiendes gritar por defecto: reserva la intensidad máxima para una frase que
  realmente lo justifique. Una llamada a la acción puede ser firme sin ser estridente.
- Usa `tts_emotion` únicamente con estos valores compatibles con el proveedor:
  calm, happy, sad, angry, fearful, disgusted, surprised.
- `delivery` y `primary` son etiquetas editoriales en español y pueden ser más precisas
  que el conjunto reducido del proveedor: grave_contenida, reflexiva, quebrada,
  urgente, firme, esperanzadora, llamada_a_la_accion, celebratoria o neutra.
- Devuelve un objeto raíz con `global_voice_direction` y un array `segments`.
- Cada segmento debe conservar exactamente el id y los tiempos recibidos.

Contrato de cada segmento:
{
  "id": "segment-01",
  "source_start": 0,
  "source_end": 12.5,
  "source_text": "texto recibido",
  "summary": "qué comunica el bloque",
  "intent": "función retórica",
  "emotion": {
    "primary": "serious",
    "secondary": ["..."],
    "intensity": 0.0,
    "arc": "sube|estable|baja|quiebre|pico",
    "reason": "evidencia editorial"
  },
  "voice_direction": {
    "delivery": "grave_contenida",
    "tts_emotion": "calm",
    "pitch": "medio_bajo",
    "pitch_shift_semitones": -1.0,
    "pace": "calmo",
    "rate_multiplier": 0.95,
    "energy": 0.6,
    "volume_db": 0.0,
    "timbre": "cálido y firme",
    "articulation": "clara",
    "pause_before_ms": 250,
    "pause_after_ms": 350,
    "breath_points": ["antes de la frase clave"],
    "stress_words": ["palabra clave"],
    "direction": "instrucción concreta para TTS"
  },
  "performance_cues": [
    {"offset_seconds": 4.2, "type": "emphasis", "label": "...", "reason": "..."}
  ],
  "visual_cue": "opcional; sólo si la emoción exige un cambio visual"
}
""".strip()


def _clamp(value: Any, low: float, high: float, default: float) -> float:
    try:
        return round(max(low, min(high, float(value))), 3)
    except (TypeError, ValueError):
        return default


def _integer(value: Any, low: int, high: int, default: int) -> int:
    try:
        return max(low, min(high, int(value)))
    except (TypeError, ValueError):
        return default


def _text(value: Any, default: str = "", limit: int = 600) -> str:
    clean = " ".join(str(value or default).split()).strip()
    return clean[:limit]


def _list_of_text(value: Any, limit: int = 12) -> list[str]:
    if not isinstance(value, list):
        return []
    return [_text(item, limit=120) for item in value if str(item).strip()][:limit]


def _provider_emotion(value: Any, primary: str) -> str:
    candidate = _text(value).lower()
    if candidate in _ALLOWED_TTS_EMOTIONS:
        return candidate
    primary_lower = primary.lower()
    if any(word in primary_lower for word in ("triste", "dolor", "quebrad", "duelo")):
        return "sad"
    if any(word in primary_lower for word in ("urgente", "ira", "indign", "combativ")):
        return "angry"
    if any(word in primary_lower for word in ("miedo", "temor", "ansiedad")):
        return "fearful"
    if any(word in primary_lower for word in ("esperanza", "alegr", "celebr")):
        return "happy"
    return "calm"


def _normalize_cues(value: Any, duration: float) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    cues: list[dict[str, Any]] = []
    for item in value[:12]:
        if not isinstance(item, dict):
            continue
        cues.append({
            "offset_seconds": _clamp(item.get("offset_seconds"), 0, duration, 0),
            "type": _text(item.get("type"), "emphasis", 40),
            "label": _text(item.get("label"), limit=120),
            "reason": _text(item.get("reason"), limit=240),
        })
    return cues


def _normalize_segment(raw: dict[str, Any], reference: dict[str, Any], index: int) -> dict[str, Any]:
    emotion = raw.get("emotion") if isinstance(raw.get("emotion"), dict) else {}
    direction = raw.get("voice_direction") if isinstance(raw.get("voice_direction"), dict) else {}
    primary = _text(emotion.get("primary") or raw.get("primary_emotion"), "serious", 80)
    start = float(reference["source_start"])
    end = float(reference["source_end"])
    return {
        "id": reference["id"],
        "source_start": start,
        "source_end": end,
        "source_text": _text(raw.get("source_text"), reference["text"], 4000),
        "summary": _text(raw.get("summary"), reference.get("title", "Idea principal"), 320),
        "intent": _text(raw.get("intent"), "Comunicar la idea con claridad.", 240),
        "emotion": {
            "primary": primary,
            "secondary": _list_of_text(emotion.get("secondary")),
            "intensity": _clamp(emotion.get("intensity"), 0, 1, 0.5),
            "arc": _text(emotion.get("arc"), "estable", 40),
            "reason": _text(emotion.get("reason"), "La dirección se mantiene contenida por falta de evidencia adicional.", 500),
        },
        "voice_direction": {
            "delivery": _text(direction.get("delivery"), "neutra", 80),
            "tts_emotion": _provider_emotion(direction.get("tts_emotion"), primary),
            "pitch": _text(direction.get("pitch"), "medio", 40),
            "pitch_shift_semitones": _clamp(direction.get("pitch_shift_semitones"), -4, 4, 0),
            "pace": _text(direction.get("pace"), "conversacional", 40),
            "rate_multiplier": _clamp(direction.get("rate_multiplier"), 0.75, 1.25, 1.0),
            "energy": _clamp(direction.get("energy"), 0, 1, 0.5),
            "volume_db": _clamp(direction.get("volume_db"), -6, 3, 0),
            "timbre": _text(direction.get("timbre"), "natural y claro", 160),
            "articulation": _text(direction.get("articulation"), "clara", 80),
            "pause_before_ms": _integer(direction.get("pause_before_ms"), 0, 1800, 200),
            "pause_after_ms": _integer(direction.get("pause_after_ms"), 0, 1800, 300),
            "breath_points": _list_of_text(direction.get("breath_points"), 8),
            "stress_words": _list_of_text(direction.get("stress_words"), 10),
            "direction": _text(direction.get("direction"), "Mantener una entrega natural, clara y controlada.", 500),
        },
        "performance_cues": _normalize_cues(raw.get("performance_cues"), end - start),
        "visual_cue": _text(raw.get("visual_cue"), "", 240),
        "source_emotion_hint": reference.get("emotion", "serious"),
        "sequence": index + 1,
    }


async def analyze_editorial_emotion(
    references: list[dict[str, Any]],
    *,
    source_label: str,
    duration: float,
    source_transcript: dict[str, Any],
    audio_provider: str = "novita/minimax-turbo",
) -> dict[str, Any]:
    """Ask DeepSeek V4.1-Flash for timed voice-direction JSON and normalize it."""
    if not settings.deepseek_api_key:
        raise RuntimeError("DEEPSEEK_API_KEY no está configurado.")
    adapter = DeepSeekAdapter()
    prompt = {
        "language": "es",
        "source_label": source_label,
        "duration_seconds": round(duration, 3),
        "source_transcript": source_transcript,
        "segments": references,
        "required_behavior": [
            "conservar ids y tiempos",
            "identificar emoción e intención por bloque",
            "proponer controles vocales para una voz sintética genérica",
            "marcar énfasis, respiraciones y pausas en segundos relativos al bloque",
            "usar la máxima intensidad sólo cuando el texto lo justifique",
        ],
    }
    raw, api = await adapter.complete_json_with_metadata(
        _SYSTEM_PROMPT,
        json.dumps(prompt, ensure_ascii=False),
        max_tokens=max(16000, settings.ai_max_output_tokens),
    )
    raw_segments = raw.get("segments") if isinstance(raw, dict) else []
    raw_by_id = {
        str(item.get("id")): item
        for item in raw_segments
        if isinstance(item, dict) and item.get("id")
    }
    normalized = [
        _normalize_segment(raw_by_id.get(reference["id"], {}), reference, index)
        for index, reference in enumerate(references)
    ]
    global_direction = raw.get("global_voice_direction") if isinstance(raw, dict) else {}
    if not isinstance(global_direction, dict):
        global_direction = {}
    return {
        "schema_version": 1,
        "mode": "editorial_voice_direction",
        "status": "ready_for_audio_generation",
        "provider": "deepseek",
        "model": api.get("model_returned") or settings.deepseek_model,
        "api": {
            "base_url": settings.deepseek_base_url,
            "model_requested": api.get("model_requested") or settings.deepseek_model,
            "model_returned": api.get("model_returned") or settings.deepseek_model,
            "response_id": api.get("response_id"),
            "usage": api.get("usage"),
            "json_mode": True,
        },
        "language": "es",
        "source": {
            "label": source_label,
            "duration_seconds": round(duration, 3),
            "transcript_provider": source_transcript.get("provider"),
            "transcript_quality": source_transcript.get("quality"),
            "analysis_basis": "editorial_plan.narration",
            "voice_identity": "voz sintética genérica; no imitar al orador del material fuente",
        },
        "global_voice_direction": {
            "delivery": _text(global_direction.get("delivery"), "narrativa_documental", 100),
            "arc": _text(global_direction.get("arc"), "contenida → firme → esperanzadora", 180),
            "baseline_tts_emotion": _provider_emotion(global_direction.get("baseline_tts_emotion"), "serious"),
            "direction": _text(global_direction.get("direction"), "Construir emoción por acumulación, con pausas antes de las ideas decisivas.", 500),
            "avoid": _list_of_text(global_direction.get("avoid"), 12),
        },
        "segments": normalized,
        "render_contract": {
            "audio_provider": audio_provider,
            "supported_tts_emotions": sorted(_ALLOWED_TTS_EMOTIONS),
            "provider_mapping_required": True,
            "timeline_rule": "source_start/source_end are authoritative; cues use offset_seconds inside each block",
            "no_voice_imitation": True,
        },
        "quality_gates": [
            "La emoción debe estar justificada por el texto y no por una suposición sobre la persona.",
            "Los cambios de intensidad deben ser audibles pero no caricaturescos.",
            "La voz generada debe seguir identificada como sintética.",
            "Revisar pronunciación, nombres propios y pausas antes de generar el audio definitivo.",
        ],
        "warnings": [
            "La dirección se analizó sobre la narración editorial en español, no sobre una imitación de la voz original.",
            "Las etiquetas emocionales son dirección artística; el proveedor TTS puede interpretarlas de forma aproximada.",
        ],
    }
