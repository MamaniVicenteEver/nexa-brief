"""Automatización por categoría y planificador semanal con IA.

Dos piezas, ambas por categoría principal (NodeTech, NodeHistory, …):

1. Automatización de horarios (`create_category_automation`): una categoría
   publica en uno o varios canales todos los días ("daily") o día por medio
   ("alternate": lun, mié, vie, dom) a cierta hora. Crea un `ScheduleSlot`
   por canal con `niche_filter = categoría`: el tick del scheduler toma solo
   el video listo más antiguo de ESA categoría (ver engine._pick_oldest_ready_job).

2. Planificador (`chat`): una conversación con la IA (DeepSeek por defecto)
   que propone, día por día, categoría + diseño/plantilla + tema + hora. El
   plan es un borrador: se guarda con `save_plan` y cada ítem se produce
   cuando el usuario lo pide (o todos de una vez). Nunca publica solo: lo que
   publica es el horario, cuando el video producido y grabado está listo.
"""

from __future__ import annotations

import json
import re
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Literal

import structlog
from pydantic import BaseModel, Field

from src.core.categories import get_category, list_categories
from src.core.data import collection
from src.core.explainer.catalog import list_videos
from src.core.explainer.designs import available_design_ids, designs_for
from src.core.ports.ai_port import AIPort
from src.core.schedule import slot_repository
from src.core.schedule.models import ScheduleSlot

logger = structlog.get_logger(__name__)

Cadence = Literal["daily", "alternate", "custom"]
CADENCE_DAYS: dict[str, list[int]] = {"daily": [0, 1, 2, 3, 4, 5, 6], "alternate": [0, 2, 4, 6]}
_HHMM = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


# ── 1. Automatización por categoría ──────────────────────────────────────────

def cadence_days(cadence: Cadence, days: list[int] | None = None) -> list[int]:
    if cadence == "custom":
        clean = sorted({d for d in (days or []) if 0 <= d <= 6})
        if not clean:
            raise ValueError("cadencia 'custom' requiere al menos un día (0=lunes … 6=domingo)")
        return clean
    return list(CADENCE_DAYS[cadence])


async def create_category_automation(
    category_path: str,
    accounts: list[str],
    cadence: Cadence,
    times: list[str],
    days: list[int] | None = None,
    replace: bool = True,
) -> list[ScheduleSlot]:
    """Un horario por canal ('youtube:alias') para la categoría.

    replace=True borra antes los horarios de esa categoría en esos mismos
    canales, así volver a guardar no duplica publicaciones.
    """
    if get_category(category_path) is None:
        raise ValueError(f"categoría desconocida: {category_path}")
    if not accounts:
        raise ValueError("elige al menos un canal")
    if not times or any(not _HHMM.match(t) for t in times):
        raise ValueError("horas en formato HH:MM (24 h, UTC)")
    week_days = cadence_days(cadence, days)
    targets = []
    for selector in accounts:
        platform, _, alias = selector.partition(":")
        if not platform or not alias:
            raise ValueError(f"canal inválido: {selector!r} (usar 'plataforma:alias')")
        targets.append((platform, alias))

    if replace:
        for slot in slot_repository.list_slots():
            if slot.niche_filter == category_path and (slot.platform, slot.account_alias) in targets:
                await slot_repository.delete(slot.slot_id)

    created = [
        await slot_repository.create(
            platform=platform, account_alias=alias, days=week_days, times=sorted(times), niche_filter=category_path
        )
        for platform, alias in targets
    ]
    logger.info("category_automation_saved", category=category_path, slots=len(created), cadence=cadence)
    return created


def automation_summary() -> list[dict]:
    """Horarios agrupados por categoría principal (para la vista de Programación)."""
    slots = slot_repository.list_slots()
    out = []
    for cat_id, node in list_categories().items():
        mine = [s for s in slots if s.niche_filter and (s.niche_filter == cat_id or s.niche_filter.startswith(cat_id + "/"))]
        out.append({
            "category_id": cat_id,
            "display_name": node.display_name,
            "status": node.status,
            "engine": node.engine,
            "default_cadence": node.strategy.default_cadence if node.strategy else "daily",
            "slots": [s.model_dump() for s in mine],
        })
    return out


# ── 2. Planificador con IA ───────────────────────────────────────────────────

class PlanItem(BaseModel):
    date: str
    time: str = "15:00"
    category_path: str
    design: str | None = None
    topic: str
    angle: str = ""
    description: str = ""


class PlannerReply(BaseModel):
    reply: str
    items: list[PlanItem] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


PLANNER_SYSTEM = """Eres el planificador editorial de Nexa Brief, una red de canales automatizados.
Conversas con el dueño de los canales en español, breve y concreto, y propones qué publicar
cada día de la semana: categoría, diseño (o plantilla), tema y hora.

Reglas:
- Usa SOLO las categorías y diseños del contexto. Para categorías con motor "explainer_kit"
  el diseño es obligatorio y debe estar en su lista. Para "pipeline" (NodeMotion) deja design en null
  y en topic describe el tipo de video (por ejemplo, la canción o el mood).
- No propongas categorías con status "empty" salvo que el usuario lo pida.
- Respeta la cadencia de cada categoría (daily = todos los días, alternate = día por medio) y los
  horarios ya configurados (horas en UTC).
- Los temas siguen la estrategia de la categoría: un momento decisivo, ángulo provocador pero verdadero.
- No repitas temas ya producidos (lista "ya_producidos").
- Si el usuario solo conversa o pregunta, responde y deja "items" vacío.

Responde SOLO este JSON:
{"reply": "tu respuesta al usuario",
 "items": [{"date": "YYYY-MM-DD", "time": "HH:MM", "category_path": "node_tech", "design": "binary",
            "topic": "tema concreto", "angle": "punto crítico en una frase", "description": "1-2 frases"}]}"""


def planner_context(week_start: date) -> dict:
    cats = []
    for cat_id, node in list_categories().items():
        designs = [d.design_id for d in designs_for(cat_id)[0]] if node.engine == "explainer_kit" else []
        cats.append({
            "category_path": cat_id,
            "nombre": node.display_name,
            "tema": node.topic,
            "status": node.status,
            "motor": node.engine,
            "diseños": designs,
            "subcategorias": [f"{cat_id}/{c}" for c in node.children],
            "estrategia": node.strategy.model_dump() if node.strategy else None,
        })
    slots = [
        {"categoria": s.niche_filter, "canal": f"{s.platform}:{s.account_alias}", "dias": s.days, "horas": s.times}
        for s in slot_repository.list_slots(enabled=True)
    ]
    produced = [v.topic or v.title for v in list_videos()]
    planned = [r["topic"] for r in collection("content_plan").list()]
    return {
        "semana": [(week_start + timedelta(days=i)).isoformat() for i in range(7)],
        "categorias": cats,
        "horarios_configurados": slots,
        "ya_producidos": produced,
        "ya_planificados": planned,
    }


def validate_items(items: list[PlanItem], week_start: date) -> tuple[list[PlanItem], list[str]]:
    days = {(week_start + timedelta(days=i)).isoformat() for i in range(7)}
    valid, warnings = [], []
    known_designs = set(available_design_ids())
    for item in items:
        node = get_category(item.category_path)
        if node is None:
            warnings.append(f"{item.date}: categoría desconocida '{item.category_path}' (descartado)")
            continue
        if item.date not in days:
            warnings.append(f"{item.date}: fuera de la semana planificada (descartado)")
            continue
        if not _HHMM.match(item.time):
            item.time = "15:00"
        if node.engine == "explainer_kit":
            allowed = {d.design_id for d in designs_for(item.category_path)[0]}
            if item.design not in allowed:
                fallback = sorted(allowed)[0] if allowed else None
                warnings.append(f"{item.date}: diseño '{item.design}' no válido para {node.display_name}; uso '{fallback}'")
                item.design = fallback
        elif item.design and item.design in known_designs:
            item.design = None
        valid.append(item)
    return valid, warnings


async def chat(ai: AIPort, messages: list[ChatMessage], week_start: date) -> PlannerReply:
    if not messages or messages[-1].role != "user":
        raise ValueError("la conversación debe terminar con un mensaje del usuario")
    payload = {
        "contexto": planner_context(week_start),
        "conversacion": [m.model_dump() for m in messages[-20:]],
    }
    raw = await ai.complete_json(PLANNER_SYSTEM, json.dumps(payload, ensure_ascii=False))
    items = []
    for entry in raw.get("items") or []:
        try:
            items.append(PlanItem.model_validate(entry))
        except ValueError:
            continue
    valid, warnings = validate_items(items, week_start)
    return PlannerReply(reply=str(raw.get("reply") or ""), items=valid, warnings=warnings)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def save_plan(items: list[PlanItem]) -> list[dict]:
    saved = []
    for item in items:
        record = {
            "item_id": uuid.uuid4().hex[:10],
            **item.model_dump(),
            "production_id": None,
            "created_at": _now(),
            "updated_at": _now(),
        }
        await collection("content_plan").insert(record)
        saved.append(record)
    return saved


def list_plan(from_date: str | None = None) -> list[dict]:
    rows = collection("content_plan").list()
    if from_date:
        rows = [r for r in rows if r["date"] >= from_date]
    return sorted(rows, key=lambda r: (r["date"], r["time"]))


async def delete_plan_item(item_id: str) -> bool:
    return await collection("content_plan").delete(item_id) is not None


async def link_production(item_id: str, production_id: str) -> None:
    await collection("content_plan").update(item_id, {"production_id": production_id, "updated_at": _now()})
