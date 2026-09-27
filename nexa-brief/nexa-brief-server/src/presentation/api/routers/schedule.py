"""Schedule router — horarios recurrentes de publicación + cola de publicación.

Traducción HTTP pura: los endpoints llaman directo a los repositorios de
`src.core.schedule` y a `engine.publish_entry` para el camino inmediato — sin
lógica de negocio propia, igual que `library.py`/`templates.py`.

`POST /api/v1/publish/` (publisher.py) se deja intacto: sigue siendo el
primitivo de bajo nivel "publica este archivo con estos metadatos crudos".
Este router es el que resuelve todo (`video_path`, título, descripción, tags)
a partir de solo un `job_id`, para que Programación/Biblioteca no tengan que
armar esos datos a mano.
"""

from __future__ import annotations

import asyncio

import structlog
from fastapi import APIRouter, HTTPException

from src.adapters.publishing.factory import get_publisher_facade
from src.core.schedule import engine, queue_repository, slot_repository
from src.core.schedule.models import QueueEntry, QueueSource, ScheduleSlot
from src.presentation.api.schemas.schedule_schema import (
    AssignVideoRequest,
    PublishNowRequest,
    QueueCreateRequest,
    QueueEntryResponse,
    QueueListResponse,
    ScheduleSlotCreateRequest,
    ScheduleSlotResponse,
    ScheduleSlotUpdateRequest,
)

router = APIRouter(prefix="/schedule", tags=["schedule"])
logger = structlog.get_logger(__name__)


def _get_facade():
    """Get the publisher facade; raises 500 if not configured (same pattern as publisher.py)."""
    try:
        return get_publisher_facade()
    except Exception as exc:
        logger.error("schedule_facade_unavailable", error=str(exc))
        raise HTTPException(
            status_code=500,
            detail=f"Publisher not configured: {exc}. Check PUBLISHER_ENCRYPTION_KEY and accounts.json.",
        ) from exc


def _slot_response(slot: ScheduleSlot) -> ScheduleSlotResponse:
    return ScheduleSlotResponse(**slot.model_dump())


def _queue_response(entry: QueueEntry) -> QueueEntryResponse:
    return QueueEntryResponse(**entry.model_dump())


# ── Slots ─────────────────────────────────────────────────────────────────────

@router.get("/slots", response_model=list[ScheduleSlotResponse])
async def list_slots(
    platform: str | None = None,
    account_alias: str | None = None,
    enabled: bool | None = None,
) -> list[ScheduleSlotResponse]:
    """Lista horarios recurrentes, opcionalmente filtrados."""
    slots = slot_repository.list_slots(platform=platform, account_alias=account_alias, enabled=enabled)
    return [_slot_response(s) for s in slots]


@router.post("/slots", response_model=ScheduleSlotResponse, status_code=201)
async def create_slot(body: ScheduleSlotCreateRequest) -> ScheduleSlotResponse:
    """Crea un nuevo horario recurrente."""
    slot = await slot_repository.create(
        platform=body.platform,
        account_alias=body.account_alias,
        days=body.days,
        times=body.times,
        enabled=body.enabled,
        niche_filter=body.niche_filter,
    )
    return _slot_response(slot)


@router.get("/slots/{slot_id}", response_model=ScheduleSlotResponse)
async def get_slot(slot_id: str) -> ScheduleSlotResponse:
    slot = slot_repository.get(slot_id)
    if slot is None:
        raise HTTPException(status_code=404, detail=f"Schedule slot '{slot_id}' not found")
    return _slot_response(slot)


@router.put("/slots/{slot_id}", response_model=ScheduleSlotResponse)
async def update_slot(slot_id: str, body: ScheduleSlotUpdateRequest) -> ScheduleSlotResponse:
    """Update parcial — solo los campos provistos en el body se modifican."""
    fields = body.model_dump(exclude_none=True)
    if not fields:
        slot = slot_repository.get(slot_id)
        if slot is None:
            raise HTTPException(status_code=404, detail=f"Schedule slot '{slot_id}' not found")
        return _slot_response(slot)

    slot = await slot_repository.update(slot_id, **fields)
    if slot is None:
        raise HTTPException(status_code=404, detail=f"Schedule slot '{slot_id}' not found")
    return _slot_response(slot)


@router.delete("/slots/{slot_id}")
async def delete_slot(slot_id: str) -> dict[str, bool]:
    deleted = await slot_repository.delete(slot_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Schedule slot '{slot_id}' not found")
    return {"deleted": True}


@router.post("/slots/{slot_id}/assign", response_model=QueueEntryResponse, status_code=201)
async def assign_video(slot_id: str, body: AssignVideoRequest) -> QueueEntryResponse:
    """Asigna un video a una ocurrencia concreta (fecha+hora) de un horario.

    `body.time` debe ser uno de `slot.times`. Si ya hay una entry `queued`
    para esa ocurrencia, se reemplaza su `job_id`; si la ocurrencia ya fue
    procesada (publishing/published/failed), se rechaza con 409.
    """
    slot = slot_repository.get(slot_id)
    if slot is None:
        raise HTTPException(status_code=404, detail=f"Schedule slot '{slot_id}' not found")
    if body.time not in slot.times:
        raise HTTPException(
            status_code=422,
            detail=f"time '{body.time}' is not one of this slot's times: {slot.times}",
        )

    scheduled_at = f"{body.occurrence_date}T{body.time}:00+00:00"
    try:
        entry = await queue_repository.upsert_for_slot_occurrence(
            slot_id=slot_id,
            scheduled_at=scheduled_at,
            job_id=body.job_id,
            source=QueueSource.MANUAL,
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return _queue_response(entry)


# ── Queue ─────────────────────────────────────────────────────────────────────

@router.get("/queue", response_model=QueueListResponse)
async def list_queue(
    status: str | None = None,
    platform: str | None = None,
    account_alias: str | None = None,
    job_id: str | None = None,
    limit: int = 20,
    offset: int = 0,
) -> QueueListResponse:
    limit = min(max(limit, 1), 200)
    offset = max(offset, 0)
    entries, total = queue_repository.list_entries(
        status=status, platform=platform, account_alias=account_alias, job_id=job_id,
        limit=limit, offset=offset,
    )
    return QueueListResponse(
        total=total, limit=limit, offset=offset,
        entries=[_queue_response(e) for e in entries],
    )


@router.post("/queue", response_model=QueueEntryResponse, status_code=201)
async def create_queue_entry(body: QueueCreateRequest) -> QueueEntryResponse:
    """Programación ad-hoc: encola un job para publicarse sin pasar por un horario recurrente."""
    entry = await queue_repository.create(
        job_id=body.job_id,
        platform=body.platform,
        account_alias=body.account_alias,
        scheduled_at=body.scheduled_at,
        source=QueueSource.MANUAL,
    )
    return _queue_response(entry)


@router.get("/queue/{entry_id}", response_model=QueueEntryResponse)
async def get_queue_entry(entry_id: str) -> QueueEntryResponse:
    entry = queue_repository.get(entry_id)
    if entry is None:
        raise HTTPException(status_code=404, detail=f"Queue entry '{entry_id}' not found")
    return _queue_response(entry)


@router.delete("/queue/{entry_id}")
async def cancel_queue_entry(entry_id: str) -> dict[str, bool]:
    """Cancela una entry en cola. Solo permitido si `status=queued` (409 si no)."""
    try:
        await queue_repository.cancel(entry_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return {"cancelled": True}


# ── Publish now ───────────────────────────────────────────────────────────────

# Referencias fuertes a las publicaciones en curso: asyncio solo guarda
# referencias débiles a las tasks, y una task sin referencia puede ser
# recolectada a mitad del upload.
_publish_tasks: set[asyncio.Task] = set()


def _on_publish_done(task: asyncio.Task) -> None:
    _publish_tasks.discard(task)
    if not task.cancelled() and task.exception() is not None:
        logger.error("schedule_publish_now_task_failed", error=str(task.exception()))


@router.post("/publish-now", response_model=QueueEntryResponse, status_code=202)
async def publish_now(body: PublishNowRequest) -> QueueEntryResponse:
    """Publica un job inmediatamente, sin pasar por Programación.

    Crea una entry `source=immediate` y responde AL INSTANTE (status `queued`);
    el upload corre en segundo plano con `engine.publish_entry()` — el mismo
    camino que usa el scheduler. Subir un video de varios minutos tarda más de
    lo que aguanta una request HTTP: antes el navegador cortaba a los 30 s,
    mostraba error aunque el upload siguiera, y el usuario reintentaba
    duplicando la publicación. El resultado llega por el evento
    `queue_entry_changed` (y GET /schedule/queue).
    """
    facade = _get_facade()
    entry = await queue_repository.create(
        job_id=body.job_id,
        platform=body.platform,
        account_alias=body.account_alias,
        scheduled_at=None,
        source=QueueSource.IMMEDIATE,
    )
    task = asyncio.create_task(engine.publish_entry(facade, entry))
    _publish_tasks.add(task)
    task.add_done_callback(_on_publish_done)
    return _queue_response(entry)
