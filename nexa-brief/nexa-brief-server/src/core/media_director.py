"""Director de medios con IA — arma un plan de medios de stock para una plantilla.

Flujo (ver docs/investigaciones/estudio-creacion-interactiva-2026-09.md §3.4):

    plan = await create_plan(template_id, requirements, brief=..., locks=...)
    await run_plan(plan["plan_id"], search=search_stock, ai=get_analysis_ai())
    await update_selection(plan_id, {"clips": ["pexels:123", ...]})
    media = await accept_plan(plan_id, importer=...)   # → {slot: [asset_ids]}

Decisiones:
- core/ no importa adapters/: la búsqueda de stock, el cliente de IA y el
  importador llegan por inyección desde el router (mismo criterio que
  routers/stats.py con accounts_loader). Así los tests no tocan red.
- UNA consulta por slot: los bancos de stock limitan búsquedas por hora y
  cada búsqueda ya trae resultados de los tres proveedores.
- La IA solo propone las consultas (JSON estricto, en inglés porque los bancos
  indexan mejor en inglés). Si falla o no hay IA, se arma la consulta con el
  hint del slot + el brief: el plan nunca queda bloqueado por la IA.
- Un slot con `locks` (assets que el usuario ya eligió) no se busca.
- El plan vive en la colección "media_plans" con status
  "planning" → "ready" | "failed" y `progress` {done, total} por slot.
"""

from __future__ import annotations

import uuid
from collections.abc import Awaitable, Callable, Mapping, Sequence
from datetime import datetime, timedelta, timezone
from typing import Any

import structlog

from src.config.exceptions import NexaBriefError
from src.core.data import collection
from src.core.ports.ai_port import AIPort
from src.core.ports.stock_media_port import StockItem

logger = structlog.get_logger(__name__)

_PLANS = "media_plans"
_MAX_QUERY = 100
_MAX_PER_PAGE = 15  # por proveedor (ver search_stock)
# Un plan sano avanza un slot cada pocos segundos; si quedó en "planning" más
# que esto es que el proceso se reinició y la tarea en segundo plano murió.
STALE_PLANNING_AFTER = timedelta(minutes=5)

# search(query, kind, orientation=..., per_page=...) → objeto con .results y .provider_errors
SearchFn = Callable[..., Awaitable[Any]]
# importer(item) → asset_id en la librería
ImporterFn = Callable[[StockItem], Awaitable[str]]


class MediaPlanNotFoundError(NexaBriefError):
    """No existe un plan con ese plan_id."""


class MediaPlanStateError(NexaBriefError):
    """El plan no admite esa operación todavía (o la selección es inválida)."""


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def candidate_ref(item: Mapping[str, Any] | StockItem) -> str:
    """Identificador estable de un candidato dentro del plan: "proveedor:id"."""
    data = item.model_dump() if isinstance(item, StockItem) else item
    return f"{data['provider']}:{data['provider_id']}"


def _search_kind(kind: str) -> str:
    # "image|video": el video aprovecha mejor una plantilla animada; si el
    # usuario prefiere una foto la puede subir/elegir a mano.
    return "video" if kind == "image|video" else kind


def _target_count(slot: Mapping[str, Any]) -> int:
    return int(slot.get("count") or slot.get("max") or slot.get("min") or 1)


def get_plan(plan_id: str) -> dict[str, Any]:
    plan = collection(_PLANS).get(plan_id)
    if plan is None:
        raise MediaPlanNotFoundError(f"Plan de medios '{plan_id}' no encontrado")
    return plan


async def fail_if_stale(plan_id: str, *, now: datetime | None = None) -> dict[str, Any]:
    """Devuelve el plan; si quedó colgado en "planning" lo marca "failed".

    La tarea vive en memoria (como los jobs de preview): un reinicio la pierde
    y el plan quedaría en "planning" para siempre, con la UI esperando.
    """
    plan = get_plan(plan_id)
    if plan["status"] != "planning":
        return plan
    updated_at = datetime.fromisoformat(plan["updated_at"])
    if (now or datetime.now(timezone.utc)) - updated_at < STALE_PLANNING_AFTER:
        return plan
    logger.warning("media_director_stale_plan", plan_id=plan_id)
    return await _save(plan_id, {"status": "failed", "error": "El armado del plan se interrumpió; creá uno nuevo"})


async def _save(plan_id: str, patch: dict[str, Any]) -> dict[str, Any]:
    updated = await collection(_PLANS).update(plan_id, {**patch, "updated_at": _now_iso()})
    return updated if updated is not None else get_plan(plan_id)


async def create_plan(
    template_id: str,
    requirements: Mapping[str, Any],
    *,
    brief: str | None = None,
    description: str = "",
    locks: Mapping[str, Sequence[str]] | None = None,
) -> dict[str, Any]:
    """Registra el plan en "planning" con un slot por cada `inputs.media` de la plantilla.

    *description* (la de la plantilla) reemplaza al brief cuando el usuario no
    escribió nada: así las consultas igual tienen un tema.
    """
    locks = {slot: list(ids) for slot, ids in (locks or {}).items() if ids}
    declared = {slot["slot"] for slot in requirements.get("media", [])}
    unknown = sorted(set(locks) - declared)
    if unknown:
        raise MediaPlanStateError(f"Slots inexistentes en '{template_id}': {unknown}")

    slots = []
    for slot in requirements.get("media", []):
        locked_ids = locks.get(slot["slot"], [])
        slots.append({
            "slot": slot["slot"],
            "kind": slot["kind"],
            "search_kind": _search_kind(slot["kind"]),
            "count": _target_count(slot),
            "min": int(slot.get("min", 1)),
            "max": int(slot.get("max", _target_count(slot))),
            "orientation": slot.get("orientation"),
            "label": slot.get("label") or slot["slot"],
            "hint": slot.get("hint") or "",
            "locked": bool(locked_ids),
            "locked_asset_ids": locked_ids,
            "query": None,
            "candidates": [],
            "selected": [],
            "provider_errors": [],
        })
    now = _now_iso()
    plan = {
        "plan_id": uuid.uuid4().hex[:12],
        "template_id": template_id,
        "brief": (brief or "").strip() or None,
        "effective_brief": (brief or "").strip() or description,
        "status": "planning",
        "error": None,
        "progress": {"done": 0, "total": sum(1 for s in slots if not s["locked"])},
        "slots": slots,
        "accepted_media": None,
        "created_at": now,
        "updated_at": now,
    }
    await collection(_PLANS).insert(plan)
    return plan


# ── Consultas ────────────────────────────────────────────────────────────────

_QUERY_SYSTEM = """\
Sos un director de arte que busca material en bancos de stock (Pexels, Pixabay, Unsplash).
Para cada slot de medios de una plantilla de video, escribí UNA SOLA consulta de búsqueda
corta (2 a 6 palabras, en inglés, sustantivos y adjetivos visuales concretos, sin marcas ni
nombres propios, sin comillas) que encaje con el brief del usuario y con el uso del slot.
Cada consulta trae muchos resultados, así que NO escribas una consulta por elemento: usá
exactamente los nombres de slot que se te dan como claves, sin sufijos ni numeración.
Respondé ÚNICAMENTE un JSON con esta forma exacta: {"queries": {"<slot>": "<consulta>"}}
"""

def _fallback_query(slot: Mapping[str, Any], brief: str) -> str:
    """Sin IA: unas pocas palabras del brief + el hint del slot."""
    brief_words = " ".join(brief.split()[:5])
    query = " ".join(part for part in (brief_words, slot.get("hint", "")) if part).strip()
    return (query or slot.get("label") or slot["slot"])[:_MAX_QUERY]


async def _queries_for(
    template_id: str,
    slots: Sequence[Mapping[str, Any]],
    brief: str,
    ai: AIPort | None,
) -> dict[str, str]:
    fallback = {slot["slot"]: _fallback_query(slot, brief) for slot in slots}
    if ai is None or not slots:
        return fallback
    user_prompt = "\n".join([
        f"Plantilla: {template_id}",
        f"Brief: {brief or '(sin brief)'}",
        "Slots:",
        *(
            f"- {slot['slot']}: {slot['search_kind']}, se usan hasta {slot['count']}, "
            f"orientación {slot.get('orientation') or 'cualquiera'}, uso: {slot.get('hint') or slot['label']}"
            for slot in slots
        ),
    ])
    try:
        response = await ai.complete_json(_QUERY_SYSTEM, user_prompt)
    except Exception as exc:  # noqa: BLE001 - la IA es opcional, nunca bloquea el plan
        logger.warning("media_director_ai_failed", template_id=template_id, error=str(exc))
        return fallback
    raw = response.get("queries") if isinstance(response, dict) else None
    if not isinstance(raw, dict):
        logger.warning("media_director_ai_bad_json", template_id=template_id)
        return fallback
    queries = dict(fallback)
    missing: list[str] = []
    for slot_name in fallback:
        value = _ai_query_for(raw, slot_name)
        if value:
            queries[slot_name] = value
        else:
            missing.append(slot_name)
    if missing:
        logger.warning("media_director_ai_missing_slots", template_id=template_id, slots=missing)
    return queries


def _ai_query_for(raw: Mapping[str, Any], slot_name: str) -> str | None:
    """Consulta de la IA para el slot. Tolera que, pese al prompt, numere una
    consulta por elemento ("clips_1", "clips_2"…): se usa la primera."""
    value = raw.get(slot_name)
    if not isinstance(value, str) or not value.strip():
        numbered = sorted(
            (key for key in raw if isinstance(key, str) and key.startswith(f"{slot_name}_")),
            key=lambda key: (len(key), key),
        )
        value = next((raw[key] for key in numbered if isinstance(raw[key], str) and raw[key].strip()), None)
    if value is None:
        return None
    return " ".join(value.replace('"', " ").split())[:_MAX_QUERY] or None


# ── Selección ────────────────────────────────────────────────────────────────

def _orientation_of(item: Mapping[str, Any]) -> str | None:
    width, height = item.get("width") or 0, item.get("height") or 0
    if not width or not height:
        return None
    if abs(width - height) / max(width, height) < 0.1:
        return "square"
    return "landscape" if width > height else "portrait"


def _rank(item: Mapping[str, Any], orientation: str | None) -> tuple:
    """Menor = mejor. La calidad manda: orientación correcta y lado corto ≥1080
    (lo que la plantilla graba en 1080p sin escalar hacia arriba)."""
    short_side = min(item.get("width") or 0, item.get("height") or 0)
    duration = item.get("duration_seconds")
    return (
        0 if orientation is None or _orientation_of(item) == orientation else 1,
        0 if short_side >= 1080 else 1,
        0 if duration is None or duration >= 5 else 1,
    )


def _default_selection(candidates: Sequence[Mapping[str, Any]], count: int, orientation: str | None) -> list[str]:
    # sorted es estable: entre empatados se respeta el orden intercalado por proveedor.
    ranked = sorted(candidates, key=lambda item: _rank(item, orientation))
    return [candidate_ref(item) for item in ranked[:count]]


async def run_plan(plan_id: str, *, search: SearchFn, ai: AIPort | None = None) -> dict[str, Any]:
    """Genera las consultas, busca una vez por slot y preselecciona candidatos."""
    plan = get_plan(plan_id)
    slots = [dict(slot) for slot in plan["slots"]]
    pending = [slot for slot in slots if not slot["locked"]]
    try:
        queries = await _queries_for(plan["template_id"], pending, plan.get("effective_brief") or "", ai)
        for done, slot in enumerate(pending, start=1):
            slot["query"] = queries[slot["slot"]]
            per_page = min(_MAX_PER_PAGE, max(slot["count"], 4))
            result = await search(
                slot["query"],
                slot["search_kind"],
                orientation=slot.get("orientation"),
                per_page=per_page,
            )
            slot["candidates"] = [item.model_dump() for item in result.results]
            slot["provider_errors"] = [issue.model_dump() for issue in result.provider_errors]
            slot["selected"] = _default_selection(slot["candidates"], slot["count"], slot.get("orientation"))
            # Progreso por slot: la UI muestra "buscando videos… 1/2".
            await _save(plan_id, {"slots": slots, "progress": {"done": done, "total": len(pending)}})
    except Exception as exc:  # noqa: BLE001 - el plan queda "failed" con el motivo, nunca colgado
        logger.error("media_director_failed", plan_id=plan_id, error=str(exc))
        return await _save(plan_id, {"status": "failed", "error": str(exc), "slots": slots})

    empty = [slot["slot"] for slot in pending if not slot["candidates"]]
    logger.info("media_director_ready", plan_id=plan_id, empty_slots=empty)
    return await _save(plan_id, {"status": "ready", "slots": slots})


async def update_selection(plan_id: str, selections: Mapping[str, Sequence[str]]) -> dict[str, Any]:
    """Cambia los seleccionados de uno o más slots (refs "proveedor:id" o índices)."""
    plan = get_plan(plan_id)
    if plan["status"] != "ready":
        raise MediaPlanStateError(f"El plan '{plan_id}' está en '{plan['status']}', no se puede editar")
    slots = [dict(slot) for slot in plan["slots"]]
    by_name = {slot["slot"]: slot for slot in slots}
    for slot_name, chosen in selections.items():
        slot = by_name.get(slot_name)
        if slot is None:
            raise MediaPlanStateError(f"Slot '{slot_name}' no existe en el plan")
        refs = [candidate_ref(item) for item in slot["candidates"]]
        resolved: list[str] = []
        for value in chosen:
            ref = str(value)
            if ref.isdigit() and int(ref) < len(refs):
                ref = refs[int(ref)]
            if ref not in refs:
                raise MediaPlanStateError(f"'{value}' no es un candidato del slot '{slot_name}'")
            if ref not in resolved:
                resolved.append(ref)
        if len(resolved) > slot["max"]:
            raise MediaPlanStateError(f"El slot '{slot_name}' admite como máximo {slot['max']}")
        slot["selected"] = resolved
    return await _save(plan_id, {"slots": slots})


async def accept_plan(plan_id: str, *, importer: ImporterFn) -> dict[str, list[str]]:
    """Importa los seleccionados a la librería y devuelve {slot: [asset_ids]}.

    Los slots bloqueados devuelven sus assets tal cual. Reimportar es idempotente
    (el servicio de stock deduplica por stock_ref), así que reintentar es seguro.
    """
    plan = get_plan(plan_id)
    if plan["status"] != "ready":
        raise MediaPlanStateError(f"El plan '{plan_id}' está en '{plan['status']}', no se puede aceptar")
    media: dict[str, list[str]] = {}
    for slot in plan["slots"]:
        if slot["locked"]:
            media[slot["slot"]] = list(slot["locked_asset_ids"])
            continue
        by_ref = {candidate_ref(item): item for item in slot["candidates"]}
        asset_ids = []
        for ref in slot["selected"]:
            item = by_ref.get(ref)
            if item is None:
                continue
            asset_ids.append(await importer(StockItem.model_validate(item)))
        if asset_ids:
            media[slot["slot"]] = asset_ids
    await _save(plan_id, {"accepted_media": media})
    return media
