"""Persistent preparation batches shared by chat/CLI and the existing API producer.

Does not render or publish. Plan rows are projections in Programación; production
records remain the source of execution state.
"""
from __future__ import annotations

import asyncio
import uuid
import hashlib
import json
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field

from src.config.settings import settings
from src.core.categories import get_category
from src.core.data import collection
from src.core.explainer.designs import available_design_ids
from src.core.explainer.lengths import clamp_minutes
from src.core.explainer.runtime import named_lock, parallel_limit, production_slot, validate_parallel
from src.core.task_ownership import TaskLease, task_is_owned


class PreparationItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    category_path: str
    design: str
    topic: str = Field(min_length=3, max_length=2000)
    description: str = ""
    agent: str | None = None
    minutes: float | None = Field(default=None, ge=1, le=60)
    narrative_id: str | None = None
    title_level: str | None = None
    short_test: bool = False


def scheduled_time(value: str | None, zone: str = "America/La_Paz") -> datetime:
    tz = ZoneInfo(zone)
    if not value:
        return datetime.now(timezone.utc)
    stamp = datetime.fromisoformat(value)
    if stamp.tzinfo is None:
        # Reject nonexistent/ambiguous local times rather than silently shifting a request.
        a, b = stamp.replace(tzinfo=tz, fold=0), stamp.replace(tzinfo=tz, fold=1)
        if a.utcoffset() != b.utcoffset():
            raise ValueError("hora local ambigua o inexistente; indica un offset explícito")
        stamp = a
    return stamp.astimezone(timezone.utc)


async def submit_batch(producer, items: list[PreparationItem], *, parallel: int = 1,
                       at: str | None = None, zone: str = "America/La_Paz",
                       label: str = "Preparación desde chat", request_id: str | None = None) -> dict:
    parallel = validate_parallel(parallel)
    if not 1 <= len(items) <= 100:
        raise ValueError("un lote requiere entre 1 y 100 videos")
    when = scheduled_time(at, zone)
    local = when.astimezone(ZoneInfo(zone))
    for item in items:
        node = get_category(item.category_path)
        if not node or node.engine != "explainer_kit":
            raise ValueError(f"categoría explainer inválida: {item.category_path}")
        if item.design not in available_design_ids():
            raise ValueError(f"diseño inválido: {item.design}")
        if not item.topic.strip():
            raise ValueError("el tema es obligatorio")
        if item.short_test and not (item.minutes and 1 <= item.minutes <= 2):
            raise ValueError("short_test requiere entre 1 y 2 minutos")
        if not item.short_test and item.minutes is not None and clamp_minutes(item.minutes) != item.minutes:
            raise ValueError("la duración está fuera del rango habitual; usa short_test para pruebas de 1–2 min")
        from src.core.explainer.producer import _default_agent
        if not producer._agent_getter(item.agent or _default_agent()).available():
            raise ValueError("el agente solicitado no está instalado")
    fingerprint = hashlib.sha256(json.dumps({"items": [i.model_dump() for i in items],
        "parallel": parallel, "at": at, "zone": zone}, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    async with named_lock("batch-admission"):
        batches = collection("explainer_batches")
        if request_id:
            existing = batches.first({"request_id": request_id})
            if existing:
                if existing.get("request_hash") and existing["request_hash"] != fingerprint:
                    raise ValueError("request_id ya se utilizó con un pedido diferente")
                return batch_status(existing["batch_id"])
        pending = sum(r.get("state") in {"queued", "creating", "producing", "finishing", "recording"}
                      for r in collection("explainer_productions").list())
        if pending + len(items) > settings.explainer_max_pending_productions:
            raise ValueError("el lote excede el espacio disponible en la cola")
        batch_id = uuid.uuid4().hex[:12]
        batch = {"batch_id": batch_id, "request_id": request_id, "request_hash": fingerprint, "label": label,
                 "parallel": parallel, "scheduled_at": when.isoformat(), "timezone": zone,
                 "state": "creating", "created_at": datetime.now(timezone.utc).isoformat(),
                 "production_ids": [], "plan_item_ids": []}
        await batches.insert(batch)
        try:
            for item in items:
                plan_id = uuid.uuid4().hex[:10]
                row = await producer.submit(**item.model_dump(), auto_record=False,
                    batch_id=batch_id, batch_parallel=parallel, not_before=when.isoformat(), plan_item_id=plan_id)
                batch["production_ids"].append(row["production_id"])
                batch["plan_item_ids"].append(plan_id)
                await collection("content_plan").insert({
                    "item_id": plan_id, "date": local.date().isoformat(), "time": local.strftime("%H:%M"),
                    "category_path": item.category_path, "design": item.design, "topic": item.topic,
                    "angle": "", "description": f"{label} · Solo preparación · {zone} · lote {batch_id}. {item.description}",
                    "production_id": row["production_id"], "batch_id": batch_id,
                    "generation_at": when.isoformat(), "timezone": zone, "auto_record": False,
                    "created_at": batch["created_at"], "updated_at": batch["created_at"],
                })
                await batches.update(batch_id, {"production_ids": batch["production_ids"],
                                               "plan_item_ids": batch["plan_item_ids"]})
            await batches.update(batch_id, {"state": "scheduled"})
        except BaseException:
            # Nothing starts until the batch is accepted; no partially admitted work runs.
            await collection("content_plan").delete_where({"batch_id": batch_id})
            await collection("explainer_productions").delete_where({"batch_id": batch_id})
            await batches.delete(batch_id)
            raise
    return batch_status(batch_id)


def batch_status(batch_id: str) -> dict:
    batch = collection("explainer_batches").get(batch_id)
    if batch is None:
        raise KeyError(batch_id)
    rows = [r for r in collection("explainer_productions").list() if r.get("batch_id") == batch_id]
    states = [r["state"] for r in rows]
    if batch["state"] == "creating":
        state = "creating"
    elif states and all(s == "ready" for s in states):
        state = "ready"
    elif states and all(s in {"ready", "done", "failed", "incomplete"} for s in states):
        state = "needs_review"
    elif any(s != "queued" for s in states):
        state = "running"
    else:
        state = "scheduled" if datetime.fromisoformat(batch["scheduled_at"]) > datetime.now(timezone.utc) else "queued"
    return {**batch, "state": state, "effective_parallel": min(batch["parallel"], parallel_limit()), "productions": rows}


async def recover_incomplete_batches():
    # A process may die between persisting a batch and accepting its last item.
    # Holding admission proves no other submitter is currently completing it.
    async with named_lock("batch-admission"):
        for batch in collection("explainer_batches").list():
            if batch.get("state") == "creating":
                await collection("content_plan").delete_where({"batch_id": batch["batch_id"]})
                await collection("explainer_productions").delete_where({"batch_id": batch["batch_id"]})
                await collection("explainer_batches").delete(batch["batch_id"])


async def worker_loop(producer, *, interval: float = 2, primary: bool = False):
    """Independent of publishing credentials and auto-publishing switches."""
    import structlog
    logger = structlog.get_logger(__name__)
    lease = TaskLease("runtime", "content-worker")
    try:
        if primary:
            while not lease.acquire():
                await asyncio.sleep(interval)
        await recover_incomplete_batches()
        await producer.recover_interrupted()
        while True:
            try:
                # Prefer the independent service so web reloads do not interrupt new batches.
                if primary or not task_is_owned("runtime", "content-worker"):
                    await producer.dispatch_due()
            except Exception as exc:
                logger.error("preparation_dispatch_error", error_type=type(exc).__name__)
            await asyncio.sleep(interval)
    finally:
        lease.release()


async def validate_batch(producer, batch_id: str) -> dict:
    """Recheck repaired preparations without spending another agent/model run."""
    from src.core.explainer.producer import _read_phase, _script_hash, _storyboard_empty, _validate_script, _write_phase
    for row in batch_status(batch_id)["productions"]:
        if row["state"] == "ready":
            continue
        lease = TaskLease("explainer", row["production_id"])
        if not lease.acquire():
            raise ValueError("el lote tiene una producción activa")
        try:
            if row.get("auto_record"):
                raise ValueError("esta operación solo valida preparación sin grabación")
            video = producer._root(row) / row["video_id"]
            errors = _validate_script(video, row.get("narrative_id"), row.get("target_minutes"))
            if errors or _storyboard_empty(video):
                raise ValueError("preparación incompleta: " + "; ".join(errors or ["storyboard vacío"]))
            marker = _read_phase(video)
            digest = _script_hash(video)
            raw_digest = hashlib.sha256((video / "assets/script.json").read_bytes()).hexdigest()
            if marker.get("phase") not in {"voice_ready", "storyboard"} or marker.get("script_sha256") not in {digest, raw_digest}:
                raise ValueError("la voz/transcripción no corresponde al guion; usa Retomar")
            if not all((video / "assets" / name).is_file() for name in ("song.mp3", "lyrics.json")):
                raise ValueError("faltan voz o transcripción")
            _write_phase(video, "storyboard", digest)
            async with production_slot(
                row.get("batch_id"), row.get("batch_parallel")):
                log = Path(row["log_path"])
                await producer._update(row["production_id"], state="finishing", phase="finishing", error=None)
                await producer._finish(row, video, log, None, 0, [], can_repair=False)
                await producer._update(row["production_id"], finished_at=datetime.now(timezone.utc).isoformat())
        finally:
            lease.release()
    return batch_status(batch_id)


async def resume_batch(batch_id: str) -> dict:
    """Explicit retry only; preserves identity and the producer's existing budgets."""
    async with named_lock("batch-admission"):
        batch = batch_status(batch_id)
        for row in batch["productions"]:
            if row["state"] not in {"failed", "incomplete"}:
                continue
            if task_is_owned("explainer", row["production_id"]):
                continue
            history = list(row.get("attempt_history") or [])
            history.append({k: row.get(k) for k in ("state", "started_at", "finished_at", "error")})
            await collection("explainer_productions").update(row["production_id"], {
                "state": "queued", "error": None, "resume_requested": True,
                "attempt_history": history, "finished_at": None,
                "updated_at": datetime.now(timezone.utc).isoformat()})
    return batch_status(batch_id)


async def delete_batch(batch_id: str, *, delete_files: bool = False) -> dict:
    """Explicit cleanup, restricted to selected production and registered log paths."""
    import re
    import shutil
    from src.config.content_paths import production_root
    from src.config.profile_layout import layout_for_settings
    from src.core.explainer.catalog import TEMPLATES_DIR

    batch = batch_status(batch_id)
    rows = batch["productions"]
    if any(task_is_owned("explainer", row["production_id"]) for row in rows):
        raise ValueError("el lote tiene tareas activas; espera a que terminen")
    layout = layout_for_settings(settings)
    root = (production_root() if layout.schema_version >= 2 else TEMPLATES_DIR).resolve()
    paths: list[Path] = []
    log_paths: list[Path] = []
    refs: list[str] = []
    if delete_files:
        for row in rows:
            folder_name, video_id, production_id = (row.get("folder"), row.get("video_id"), row.get("production_id"))
            if any(not isinstance(value, str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,127}", value)
                   for value in (folder_name, video_id, production_id)):
                raise ValueError("identificador de producción inválido")
            folder = root / folder_name / video_id
            if folder.is_symlink() or not folder.resolve().is_relative_to(root):
                raise ValueError("carpeta fuera de las plantillas")
            if folder.exists():
                manifest_path = folder / "manifest.json"
                if manifest_path.is_symlink() or not manifest_path.is_file():
                    raise ValueError("la carpeta no pertenece a esta producción")
                manifest = json.loads(manifest_path.read_text())
                if manifest.get("production_id") != production_id:
                    raise ValueError("la carpeta no pertenece a esta producción")
                paths.append(folder)
            if layout.schema_version >= 2:
                log_root = layout.logs_dir.resolve()
                if not log_root.is_relative_to(layout.root.resolve()):
                    raise ValueError("la carpeta de logs sale del perfil")
                for ref in collection("execution_logs").list(where={"production_id": production_id}):
                    if ref.get("kind") != "production":
                        continue
                    key = Path(ref.get("key", ""))
                    if key.is_absolute() or not key.parts or ".." in key.parts:
                        raise ValueError("referencia de log inválida")
                    log = layout.root / key
                    if (not log.resolve().is_relative_to(log_root) or log.is_symlink()
                            or log.parent.resolve() != (log_root / "videos" / video_id).resolve()
                            or log.name != f"{production_id}.log"):
                        raise ValueError("referencia de log fuera de la producción")
                    log_paths.append(log)
                    refs.append(ref["log_id"])
            else:
                log_paths.append(settings.data_dir / "explainer" / "logs" / f"{production_id}.log")
    async with named_lock("batch-admission"):
        # Recheck ownership under the admission lock before any destructive step.
        if any(task_is_owned("explainer", row["production_id"]) for row in rows):
            raise ValueError("el lote tiene tareas activas; espera a que terminen")
        await collection("explainer_batches").update(batch_id, {"state": "deleting"})
        for folder in paths:
            shutil.rmtree(folder)
        for log in log_paths:
            if log.exists():
                log.unlink()
            for sidecar in log.parent.glob(f"{log.stem}.*"):
                if sidecar.is_file() and not sidecar.is_symlink():
                    sidecar.unlink()
        for log_id in refs:
            await collection("execution_logs").delete(log_id)
        if delete_files and layout.schema_version >= 2:
            from src.core.content_registry import update_video_details
            videos = collection("content_videos")
            resources = collection("content_resources")
            for row in rows:
                video_id, production_id = row["video_id"], row["production_id"]
                video = videos.get(video_id)
                if not video or video.get("production_id") != production_id:
                    continue
                await videos.update(video_id, {"status": "deleted"})
                await update_video_details(video_id, {"status": "deleted", "production_deleted": True,
                                                       "source_missing": True})
                prefix = f"productions/{row['folder']}/{video_id}/"
                for resource in resources.list(where={"video_id": video_id}):
                    if str(resource.get("storage_key", "")).startswith(prefix):
                        await resources.update(resource["asset_id"], {"available": False})
        await collection("content_plan").delete_where({"batch_id": batch_id})
        await collection("explainer_productions").delete_where({"batch_id": batch_id})
        await collection("explainer_batches").delete(batch_id)
    return {"batch_id": batch_id, "deleted": len(rows), "files_deleted": delete_files}
