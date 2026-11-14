"""Explicit, persistent preparation/render/publication requests from the web.

Preparation and uploads use the existing batch and publication services. A
workflow records only the user's stage deadlines and their durable dispatch
references; it never chooses a channel or retries an ambiguous side effect.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
from datetime import datetime, timezone
from typing import Literal
from zoneinfo import ZoneInfo

import structlog
from pydantic import BaseModel, ConfigDict, Field, model_validator

from src.core.data import collection
from src.core.explainer.batches import PreparationItem, scheduled_time, submit_batch
from src.core.explainer.catalog import get_video
from src.core.explainer.runtime import named_lock
from src.core.schedule import queue_repository
from src.core.task_ownership import TaskLease

logger = structlog.get_logger(__name__)
_publish_tasks: dict[str, asyncio.Task] = {}


class WorkflowTarget(BaseModel):
    model_config = ConfigDict(extra="forbid")
    platform: Literal["youtube", "facebook", "instagram", "tiktok"]
    account_alias: str = Field(min_length=1, max_length=200)
    format: Literal["16x9", "9x16"] = "9x16"


class WorkflowRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    request_id: str = Field(min_length=1, max_length=200)
    video_id: str | None = None
    preparation: PreparationItem | None = None
    prepare_at: str | None = None
    record_at: str | None = None
    publish_at: str | None = None
    timezone: str = "America/La_Paz"
    formats: list[Literal["16x9", "9x16"]] = Field(default_factory=lambda: ["9x16"], min_length=1)
    targets: list[WorkflowTarget] = Field(default_factory=list, max_length=50)
    privacy: Literal["private", "unlisted", "public"] = "private"

    @model_validator(mode="after")
    def validate_stages(self):
        if bool(self.video_id) == bool(self.preparation):
            raise ValueError("Elige un video existente o los datos de uno nuevo")
        try:
            ZoneInfo(self.timezone)
        except (KeyError, ValueError) as exc:
            raise ValueError("Zona horaria desconocida") from exc
        for field in ("prepare_at", "record_at", "publish_at"):
            value = getattr(self, field)
            if value:
                setattr(self, field, scheduled_time(value, self.timezone).isoformat())
        if not self.preparation and self.prepare_at:
            raise ValueError("Un video existente no necesita preparación")
        if self.publish_at and not self.record_at:
            raise ValueError("Indica también cuándo grabar antes de publicar")
        if not self.preparation and not self.record_at:
            raise ValueError("Indica cuándo grabar el video")
        if self.prepare_at and self.record_at and self.record_at < self.prepare_at:
            raise ValueError("La grabación debe ser posterior a la preparación")
        if self.publish_at and self.record_at and self.publish_at <= self.record_at:
            raise ValueError("La publicación debe ser posterior a la grabación")
        if any(t.format not in self.formats for t in self.targets):
            raise ValueError("El formato de cada canal debe estar incluido en la grabación")
        if len({(t.platform, t.account_alias, t.format) for t in self.targets}) != len(self.targets):
            raise ValueError("No repitas un canal con el mismo formato")
        return self


class WorkflowPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    targets: list[WorkflowTarget] | None = Field(default=None, max_length=50)
    record_at: str | None = None
    publish_at: str | None = None
    privacy: Literal["private", "unlisted", "public"] | None = None
    cancel: bool = False


def _rows():
    return collection("schedule_workflows")


def list_workflows() -> list[dict]:
    return sorted(_rows().list(), key=lambda r: r.get("created_at", ""), reverse=True)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _update(key: str, **patch) -> dict:
    current = _rows().get(key)
    if current and all(current.get(k) == v for k, v in patch.items()):
        return current
    return await _rows().update(key, {**patch, "updated_at": _now()})


async def create_workflow(body: WorkflowRequest, producer) -> dict:
    payload = body.model_dump()
    fingerprint = hashlib.sha256(json.dumps(payload, ensure_ascii=False, sort_keys=True).encode()).hexdigest()
    key = hashlib.sha256(body.request_id.encode()).hexdigest()[:20]
    async with named_lock("workflow-admission"):
        old = _rows().get(key)
        if old:
            if old.get("request_hash") != fingerprint:
                raise ValueError("request_id ya pertenece a otro pedido")
            return await _ensure_preparation(old, producer) if old.get("preparation") and not old.get("production_id") else old
        if body.video_id:
            video = get_video(body.video_id)
            if video is None or not video.ready:
                raise ValueError("El video no existe o todavía no está listo para grabar")
            title, category, design = video.title, video.category_path, video.design
        else:
            title, category, design = body.preparation.topic, body.preparation.category_path, body.preparation.design
        row = {**payload, "workflow_id": key, "request_hash": fingerprint,
               "topic": title, "category_path": category, "design": design,
               "production_id": None, "batch_id": None, "record_job_id": None,
               "scheduled_job_id": None, "queue_entry_ids": [],
               "state": "scheduled", "record_state": "scheduled" if body.record_at else "none",
               "publish_state": ("pending_channels" if not body.targets else "waiting_render") if body.publish_at else "none",
               "error": None, "created_at": _now(), "updated_at": _now()}
        # Persist before batch admission. An interrupted POST can safely re-use
        # its batch request ID without creating a second production.
        await _rows().insert(row)
        try:
            return await _ensure_preparation(row, producer)
        except BaseException:
            await _update(key, state="attention", error="No se pudo registrar la preparación; reintenta con el mismo pedido")
            raise


async def _ensure_preparation(row: dict, producer) -> dict:
    if row.get("preparation") and not row.get("production_id"):
        batch = await submit_batch(producer, [PreparationItem.model_validate(row["preparation"])],
            at=row.get("prepare_at") or row["created_at"], zone=row["timezone"],
            label="Programación desde la web", request_id=f"workflow:{row['workflow_id']}")
        production = batch["productions"][0]
        return await _update(row["workflow_id"], batch_id=batch["batch_id"],
            production_id=production["production_id"], video_id=production["video_id"], error=None,
            prepare_at=batch["scheduled_at"], state="scheduled")
    return row


async def update_workflow(key: str, body: WorkflowPatch) -> dict:
    async with named_lock("workflow-dispatch"):
        row = _rows().get(key)
        if row is None:
            raise KeyError(key)
        if row["state"] == "cancelled":
            raise ValueError("El pedido ya está cancelado")
        entries = [queue_repository.get(i) for i in row.get("queue_entry_ids", [])]
        if body.cancel:
            if row["record_state"] in {"dispatching", "recording"} or any(
                e and e.status.value in {"publishing", "published", "outcome_unknown"} for e in entries):
                raise ValueError("No se puede cancelar una etapa ya iniciada")
            # Cancelling a future workflow must also prevent its accepted batch
            # from being picked up by the independent preparation worker.
            if row.get("production_id"):
                production = collection("explainer_productions").get(row["production_id"])
                if production and production.get("state") not in {"ready", "done", "failed", "incomplete", "queued"}:
                    raise ValueError("La preparación ya está en ejecución")
                if production and production.get("state") == "queued":
                    await collection("explainer_productions").update(row["production_id"], {"state": "failed", "error": "Programación cancelada por el usuario"})
            for entry in entries:
                if entry and entry.status.value == "queued":
                    await queue_repository.cancel(entry.entry_id)
            return await _update(key, state="cancelled")
        if any(e and e.status.value != "cancelled" for e in entries):
            raise ValueError("La publicación ya está en cola; cancela el pedido antes de reemplazarlo")
        if body.record_at and row["record_state"] not in {"scheduled", "waiting_preparation", "none"}:
            raise ValueError("La grabación ya ha empezado")
        candidate = {k: row[k] for k in WorkflowRequest.model_fields}
        if row.get("preparation"):
            candidate["video_id"] = None
        candidate.update(body.model_dump(exclude_none=True, exclude={"cancel"}))
        validated = WorkflowRequest.model_validate(candidate)
        patch = body.model_dump(exclude_none=True, exclude={"cancel"})
        for field in ("record_at", "publish_at"):
            if field in patch:
                patch[field] = getattr(validated, field)
        patch["publish_state"] = ("pending_channels" if not validated.targets else "waiting_render") if validated.publish_at else "none"
        patch["state"] = "scheduled" if row["record_state"] != "done" else ("pending_channels" if not validated.targets else "rendered")
        return await _update(key, **patch)


def _due(value: str | None, now: datetime) -> bool:
    return bool(value) and scheduled_time(value) <= now


async def process_workflows(producer, recorder, now: datetime | None = None, publisher_getter=None) -> None:
    now = now or datetime.now(timezone.utc)
    async with named_lock("workflow-dispatch"):
        for initial in list_workflows():
            if initial["state"] in {"cancelled", "done", "attention"}:
                continue
            try:
                row = await _ensure_preparation(initial, producer)
                await _process_one(row, recorder, now, publisher_getter)
            except Exception as exc:
                logger.warning("schedule_workflow_failed", workflow_id=initial["workflow_id"], error_type=type(exc).__name__)
                await _update(initial["workflow_id"], state="attention", error=str(exc)[:1500])


async def _process_one(row: dict, recorder, now: datetime, publisher_getter) -> None:
    key = row["workflow_id"]
    if row.get("production_id"):
        production = collection("explainer_productions").get(row["production_id"])
        if not production or production.get("state") in {"failed", "incomplete"}:
            await _update(key, state="attention", error=(production or {}).get("error") or "La preparación necesita revisión")
            return
        if production.get("state") not in {"ready", "done"}:
            await _update(key, state="preparing" if production.get("state") != "queued" else "scheduled",
                          record_state="waiting_preparation" if row.get("record_at") else "none")
            return
        if not row.get("record_at"):
            await _update(key, state="ready")
            return
    if row["record_state"] in {"scheduled", "waiting_preparation"}:
        if not _due(row.get("record_at"), now):
            return
        video = get_video(row["video_id"])
        if video is None or not video.ready:
            raise ValueError("El video aún no está listo para grabar")
        if any(j.video_id == video.video_id and j.state.value in {"queued", "rendering", "publishing"}
               for j in recorder.list_jobs(active=True)):
            # Do not create a duplicate beside a manually started recording.
            raise ValueError("Este video ya tiene otra grabación activa")
        row = await _update(key, record_state="dispatching", record_started_at=now.isoformat(), state="recording")
        job = recorder.submit(video, duration="full", publish=False, formats=row["formats"], publication_hold=True)
        row = await _update(key, record_state="recording", record_job_id=job.job_id)
    if row["record_state"] in {"dispatching", "recording"}:
        job = recorder.get_job(row.get("record_job_id"))
        if job is None:
            await _update(key, state="attention", record_state="interrupted",
                error="El servidor se reinició durante la grabación. Revisa Biblioteca antes de programarla otra vez.")
            return
        if job.state.value == "failed":
            await _update(key, state="attention", record_state="failed", error=job.error)
            return
        if job.state.value != "done":
            return
        row = await _update(key, record_state="done", scheduled_job_id=job.scheduled_job_id,
                            record_finished_at=_now(), state="rendered")
    if row["record_state"] != "done":
        return
    if not row.get("publish_at"):
        return
    if not row.get("targets"):
        if row["publish_state"] != "pending_channels" or row["state"] != "pending_channels":
            await _update(key, state="pending_channels", publish_state="pending_channels")
        return
    # Do not accidentally release a video whose editorial package is incomplete.
    video = get_video(row["video_id"])
    if video is None or not video.publish_ready:
        raise ValueError("Completa la revisión editorial y los textos antes de publicar")
    ids = []
    for target in row["targets"]:
        delivery_id = f"workflow:{key}:{target['platform']}:{target['account_alias']}:{target['format']}"
        existing = collection("queue_entries").first({"delivery_id": delivery_id})
        entry = queue_repository.get(existing["entry_id"]) if existing else await queue_repository.create(
            job_id=row["scheduled_job_id"], platform=target["platform"], account_alias=target["account_alias"],
            format=target["format"], scheduled_at=row["publish_at"], privacy=row["privacy"], delivery_id=delivery_id)
        ids.append(entry.entry_id)
    row = await _update(key, queue_entry_ids=ids, state="publication_scheduled", publish_state="scheduled")
    if _due(row["publish_at"], now):
        if publisher_getter is None:
            return
        # The shared queue owns each claim, including calls from a simultaneous
        # recurring scheduler. No workflow retry re-sends failed/unknown uploads.
        from src.core.schedule.engine import publish_entry
        facade = None
        for entry_id in ids:
            entry = queue_repository.get(entry_id)
            if entry and entry.status.value == "queued" and entry_id not in _publish_tasks:
                facade = facade or publisher_getter()
                task = asyncio.create_task(publish_entry(facade, entry))
                _publish_tasks[entry_id] = task
                task.add_done_callback(lambda _, eid=entry_id: _publish_tasks.pop(eid, None))
        entries = [queue_repository.get(i) for i in ids]
        states = {e.status.value for e in entries if e}
        if states == {"published"}:
            await _update(key, state="done", publish_state="published")
        elif states & {"failed", "outcome_unknown", "cancelled"}:
            await _update(key, state="attention", publish_state="failed",
                          error="; ".join(e.error for e in entries if e and e.error) or "Revisa la cola de publicación")
        elif "publishing" in states:
            await _update(key, state="publishing", publish_state="publishing")


async def workflow_loop(producer, recorder, publisher_getter) -> None:
    lease = TaskLease("runtime", "explicit-schedule-workflows")
    try:
        while True:
            if lease.acquire():
                try:
                    await process_workflows(producer, recorder, publisher_getter=publisher_getter)
                except Exception as exc:
                    logger.warning("schedule_workflow_tick_failed", error_type=type(exc).__name__)
            await asyncio.sleep(5)
    finally:
        lease.release()
