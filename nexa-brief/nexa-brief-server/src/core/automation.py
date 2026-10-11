"""Piloto automático por categoría: producir → pregrabar → publicar, sin intervención.

Lo que cada tick del scheduler agrega a la publicación (engine.process_tick):

  1. Producción automática (autoproduce): los ítems del plan semanal que
     guardaste (aprobados por ti) y cuya fecha cae dentro de las próximas
     `schedule_autoproduce_hours` se mandan al agente local con grabación
     automática. Uno a la vez: el productor ya es secuencial.
  2. Pregrabación (prerecord): si un horario de una categoría explainer vence
     dentro de `schedule_prerecord_hours` y no hay ningún video grabado para
     ese canal, se graba completo el video "listo" más antiguo de la categoría.
     Así al llegar la hora ya hay un job empaquetado para publicar.
  3. La publicación la sigue haciendo engine.process_tick (auto-fill + cola).

También arma el resumen por categoría que muestra el dashboard
(`category_overview`): embudo, horarios, próxima publicación y qué falta.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Callable

import structlog

from src.config.settings import settings
from src.core import job_tracker
from src.core.categories import category_matches, list_categories, top_level_of
from src.core.data import collection
from src.core.explainer.catalog import list_videos
from src.core.explainer.designs import designs_for
from src.core.job import JobStage
from src.core.schedule import engine, queue_repository, slot_repository
from src.core.schedule.models import QueueStatus, ScheduleSlot

logger = structlog.get_logger(__name__)

ACTIVE_PRODUCTION = {"queued", "creating", "producing", "finishing", "recording"}


# ── consultas ────────────────────────────────────────────────────────────────

def next_occurrence(slot: ScheduleSlot, now: datetime) -> datetime | None:
    """Próxima (día, hora) UTC del horario a partir de `now` (dentro de 8 días)."""
    best = None
    for offset in range(8):
        day = (now + timedelta(days=offset)).date()
        if day.weekday() not in slot.days:
            continue
        for hhmm in slot.times:
            h, m = (int(x) for x in hhmm.split(":"))
            at = datetime(day.year, day.month, day.day, h, m, tzinfo=timezone.utc)
            if at >= now and (best is None or at < best):
                best = at
        if best is not None:
            return best
    return best


def _slots_of(category_id: str, enabled_only: bool = True) -> list[ScheduleSlot]:
    slots = slot_repository.list_slots(enabled=True) if enabled_only else slot_repository.list_slots()
    # El filtro de un horario puede ser una categoría, una subcategoría o un nicho.
    return [s for s in slots if s.niche_filter and category_matches(s.niche_filter, category_id)]


def _packaged_jobs_of(category_id: str) -> list[dict]:
    records, _ = job_tracker.list_jobs(stage=JobStage.PACKAGED.value, limit=10_000, offset=0)
    return [r for r in records if category_matches(r.get("category") or "", category_id)]


def _published_job_ids() -> set[str]:
    entries, _ = queue_repository.list_entries(status=QueueStatus.PUBLISHED.value, limit=100_000)
    return {e.job_id for e in entries}


def _recorded_video_ids() -> set[str]:
    return {r["video_id"] for r in collection("jobs").list() if r.get("source") == "explainer" and r.get("video_id")}


def _productions() -> list[dict]:
    return collection("explainer_productions").list()


# ── resumen para el dashboard ────────────────────────────────────────────────

def category_overview(now: datetime | None = None) -> list[dict[str, Any]]:
    now = now or datetime.now(timezone.utc)
    published_ids = _published_job_ids()
    recorded = _recorded_video_ids()
    videos = list_videos()
    productions = _productions()
    plan = collection("content_plan").list()
    today = now.date().isoformat()
    out = []
    for cat_id, node in list_categories().items():
        explainer = node.engine == "explainer_kit"
        jobs = _packaged_jobs_of(cat_id)
        pending = [j for j in jobs if j["job_id"] not in published_ids]
        published = [j for j in jobs if j["job_id"] in published_ids]
        cat_videos = [v for v in videos if top_level_of(v.category_path) == cat_id]
        ready_to_record = [v for v in cat_videos if v.ready and v.video_id not in recorded]
        producing = [p for p in productions if top_level_of(p["category_path"]) == cat_id and p.get("state") in ACTIVE_PRODUCTION]
        planned = [i for i in plan if top_level_of(i["category_path"]) == cat_id and not i.get("production_id") and i["date"] >= today]
        slots = _slots_of(cat_id)
        nexts = [n for n in (next_occurrence(s, now) for s in slots) if n]
        designs = len(designs_for(cat_id)[0]) if explainer else 0
        templates = sum(len(sub.niches) for sub in [node, *node.children.values()])

        missing = []
        if not settings.enable_auto_publishing:
            missing.append("autopublish_off")
        if node.status == "empty":
            missing.append("empty_category")
        if not slots:
            missing.append("no_schedule")
        if explainer and not (pending or ready_to_record or producing or planned):
            missing.append("no_content")
        elif slots and not pending and not (explainer and settings.schedule_prerecord_enabled and ready_to_record):
            missing.append("no_ready_video")

        out.append({
            "id": cat_id,
            "display_name": node.display_name,
            "topic": node.topic,
            "status": node.status,
            "engine": node.engine,
            "content": {"designs": designs, "templates": templates},
            "pipeline": {
                "producing": len(producing),
                "ready_to_record": len(ready_to_record),
                "recorded_pending": len(pending),
                "published": len(published),
            },
            "schedule": {
                "channels": sorted({f"{s.platform}:{s.account_alias}" for s in slots}),
                "days": sorted({d for s in slots for d in s.days}),
                "times": sorted({t for s in slots for t in s.times}),
                "next_at": min(nexts).isoformat() if nexts else None,
            },
            "automation": {
                "prerecord": explainer and settings.schedule_prerecord_enabled,
                "autoproduce": explainer and settings.schedule_autoproduce_enabled,
                "planned_items": len(planned),
            },
            "missing": missing,
        })
    return out


# ── piloto automático ────────────────────────────────────────────────────────

async def prerecord_due(now: datetime, recorder: Any) -> list[str]:
    """Graba (completo) el video listo más antiguo de cada categoría explainer
    con un horario próximo sin video grabado. Devuelve los video_id lanzados."""
    if not settings.schedule_prerecord_enabled:
        return []
    horizon = now + timedelta(hours=settings.schedule_prerecord_hours)
    recorded = _recorded_video_ids()
    busy = {j.video_id for j in getattr(recorder, "_jobs", {}).values() if j.state.value in ("queued", "rendering", "publishing")}
    launched: list[str] = []
    videos = sorted(list_videos(), key=lambda v: v.video_id)
    for cat_id, node in list_categories().items():
        if node.engine != "explainer_kit":
            continue
        due_slots = [s for s in _slots_of(cat_id) if (n := next_occurrence(s, now)) and n <= horizon]
        if not due_slots:
            continue
        if all(engine._pick_oldest_ready_job(s) for s in due_slots):
            continue  # cada canal próximo ya tiene un video grabado esperando
        if any(top_level_of(v.category_path) == cat_id and v.video_id in busy for v in videos):
            continue  # ya hay una grabación en curso para esta categoría
        candidate = next(
            (v for v in videos if top_level_of(v.category_path) == cat_id and v.ready
             and v.video_id not in recorded and v.video_id not in busy),
            None,
        )
        if candidate is None:
            logger.info("prerecord_no_ready_video", category=cat_id)
            continue
        recorder.submit(candidate, duration="full")
        launched.append(candidate.video_id)
        logger.info("prerecord_launched", category=cat_id, video_id=candidate.video_id)
    return launched


async def autoproduce_due(now: datetime, producer: Any, link: Callable) -> list[str]:
    """Produce los ítems aprobados del plan cuya fecha está cerca. Devuelve item_id."""
    if not settings.schedule_autoproduce_enabled:
        return []
    if any(p.get("state") in ACTIVE_PRODUCTION for p in _productions()):
        return []  # una producción a la vez
    limit = (now + timedelta(hours=settings.schedule_autoproduce_hours)).date().isoformat()
    today = now.date().isoformat()
    items = sorted(collection("content_plan").list(), key=lambda i: (i["date"], i.get("time", "")))
    for item in items:
        if item.get("production_id") or not (today <= item["date"] <= limit):
            continue
        node = list_categories().get(top_level_of(item["category_path"]))
        if node is None or node.engine != "explainer_kit" or not item.get("design"):
            continue
        try:
            rec = await producer.submit(
                category_path=item["category_path"],
                design=item["design"],
                topic=item["topic"],
                description=" ".join(x for x in (item.get("angle"), item.get("description")) if x),
                auto_record=True,
                plan_item_id=item["item_id"],
            )
        except ValueError as exc:
            logger.warning("autoproduce_skipped", item_id=item["item_id"], error=str(exc))
            await collection("content_plan").update(item["item_id"], {"autoproduce_error": str(exc)[:300]})
            continue
        await link(item["item_id"], rec["production_id"])
        logger.info("autoproduce_launched", item_id=item["item_id"], production_id=rec["production_id"])
        return [item["item_id"]]
    return []
