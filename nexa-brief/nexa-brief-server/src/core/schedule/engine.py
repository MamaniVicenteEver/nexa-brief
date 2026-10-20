"""Schedule Engine — el núcleo portable: tick programado + publicación inmediata.

`publish_entry()` es el camino ÚNICO de publicación fuera del pipeline — lo
llaman tanto `process_tick()` (programado, invocado por
`src.adapters.publishing.scheduler`) como `POST /schedule/publish-now`
(inmediato). Ambos casos delegan en el mismo `PublisherFacade.publish_video`.

Portabilidad (ver plan): este módulo nunca resuelve el singleton del facade
él mismo — lo recibe como parámetro, tipado contra un `Protocol` local en vez
de importar la clase concreta `PublisherFacade`, para que el módulo sea
"arrancable" en otro sistema con solo un facade duck-typed. Nunca importa
`src.presentation.*` ni adaptadores concretos. `job_tracker` solo se LEE
(`get`, `list_jobs`, `get_summary`) — este módulo nunca llama a
`job_tracker.update()`; `queue_repository` (`queue.json`) es la única fuente
de verdad de qué se publicó, a qué cuenta, cuándo y con qué resultado.

Caveat de timezone, explícito y no asumido: v1 usa UTC
(`datetime.now(timezone.utc)`) sin conversión de zona horaria. Si hace falta
"9am hora local", agregar `schedule_timezone` a settings más adelante — no
adivinar ahora.
"""

from __future__ import annotations

import asyncio

from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Protocol

import structlog

from src.config.settings import settings
from src.core import job_tracker, publish_log, notification_tracker
from src.core.notification import Notification
from src.core.job import JobStage
from src.core.schedule import queue_repository, slot_repository
from src.core.schedule.models import QueueEntry, QueueSource, ScheduleSlot
from src.core.categories import category_matches
from src.core.metadata import copy_for_platform

logger = structlog.get_logger(__name__)


class PublisherFacadeLike(Protocol):
    """Forma mínima que este módulo necesita de un facade de publicación —
    duck-typed a propósito, nunca importa `PublisherFacade` en concreto."""

    async def publish_video(
        self,
        video_path: Path,
        title: str,
        description: str,
        tags: list[str],
        account_selector: str | None = None,
        *,
        privacy: str = "public",
        **kwargs: Any,
    ) -> Any: ...


# ── Tick programado ──────────────────────────────────────────────────────────

# Un tick a la vez: el scheduler espera 180 s el resultado, pero una subida a YouTube que espera
# la HD sigue corriendo; si el tick siguiente arrancara igual, los dos tomarían las mismas
# entries vencidas y las publicarían dos veces.
_tick_lock = asyncio.Lock()


async def process_tick(facade: PublisherFacadeLike, now: datetime | None = None) -> dict[str, Any]:
    """Un ciclo completo del scheduler: recupera entries atascadas, rellena
    huecos de auto-fill (si está habilitado) y publica todo lo que ya venció."""
    if _tick_lock.locked():
        logger.info("schedule_process_tick_skipped", reason="previous_tick_running")
        return {"skipped": "previous_tick_running"}
    async with _tick_lock:
        return await _process_tick(facade, now)


async def _process_tick(facade: PublisherFacadeLike, now: datetime | None) -> dict[str, Any]:
    now = now or datetime.now(timezone.utc)

    recovered = await queue_repository.recover_stale_publishing()

    filled = 0
    if settings.schedule_auto_fill_enabled:
        filled = await _fill_gaps(now)

    due_entries = queue_repository.find_due(now.isoformat())
    results: dict[str, str] = {}
    for entry in due_entries:
        processed = await publish_entry(facade, entry)
        results[processed.entry_id] = processed.status.value

    summary = {
        "recovered_stale": recovered,
        "gaps_filled": filled,
        "due_processed": len(due_entries),
        "results": results,
    }
    logger.info("schedule_process_tick_done", **summary)
    return summary


# ── Camino compartido de publicación ────────────────────────────────────────

async def publish_entry(facade: PublisherFacadeLike, entry: QueueEntry) -> QueueEntry:
    """Camino ÚNICO de publicación — lo llaman tanto `process_tick()`
    (programado) como `POST /schedule/publish-now` (inmediato).

    Resuelve `video_path` desde `job_tracker`'s `file_paths` (clave según
    plataforma: 'tiktok' vs 'youtube' — facebook usa el mismo archivo
    horizontal que youtube, igual que `social_publisher.py`) y título/
    descripción/tags desde `job_tracker.get_summary()` (el único lugar donde
    sobrevive esa metadata tras terminar el pipeline).
    """
    updated = await queue_repository.mark_publishing(entry.entry_id)
    if updated is None:
        raise ValueError(f"QueueEntry '{entry.entry_id}' not found.")

    job_record = job_tracker.get(entry.job_id)
    if job_record is None:
        failed = await queue_repository.mark_failed(
            entry.entry_id, f"Job '{entry.job_id}' not found in job_tracker."
        )
        return failed or updated

    summary = job_tracker.get_summary(entry.job_id)
    if summary is None:
        failed = await queue_repository.mark_failed(
            entry.entry_id,
            f"No summary available for job '{entry.job_id}' (08_resumen_final.json missing).",
        )
        return failed or updated

    file_paths: dict[str, str] = job_record.get("file_paths", {}) or {}
    format_paths = job_tracker.format_paths(job_record)
    explicit_format_path = format_paths.get(entry.format) if entry.format else None
    # youtube y facebook comparten el mismo archivo horizontal (ver social_publisher.py).
    # TikTok usa su clip propio si el nicho lo genera (generate_tiktok_clip); si
    # no (ej. nichos de letras), el video vertical completo (reels, 9:16).
    if explicit_format_path:
        video_path_str = explicit_format_path
    elif entry.platform == "tiktok":
        video_path_str = file_paths.get("tiktok") or file_paths.get("reels")
    elif entry.platform == "instagram":
        video_path_str = file_paths.get("reels") or file_paths.get("tiktok") or file_paths.get("youtube")
    else:
        video_path_str = file_paths.get("youtube")
    copy = copy_for_platform(summary, entry.platform)
    extra_kwargs = {"language": copy.language} if entry.platform == "youtube" and copy.language else {}
    # miniatura propia (explainer: la intro elegida; NodeMotion: el final de la intro); solo YouTube por API
    # (si el video se grabó sin ella, se saca ahora del final de su intro; thumbnails.set: solo JPEG/PNG)
    if entry.platform == "youtube":
        from src.modules.thumbnail_maker import ensure_for_job

        thumbnail = await ensure_for_job(file_paths)
        if thumbnail is not None:
            extra_kwargs["thumbnail_path"] = thumbnail
    if entry.platform == "youtube" and summary.get("pinned_comment"):
        extra_kwargs["comment_text"] = summary["pinned_comment"]

    if not video_path_str:
        failed = await queue_repository.mark_failed(
            entry.entry_id,
            f"No '{entry.platform}' video file available for job '{entry.job_id}'.",
        )
        return failed or updated

    video_path = Path(video_path_str)
    if not video_path.exists():
        failed = await queue_repository.mark_failed(
            entry.entry_id, f"Video file not found on disk: {video_path}"
        )
        return failed or updated

    account_selector = f"{entry.platform}:{entry.account_alias}"
    try:
        result = await facade.publish_video(
            video_path=video_path,
            title=copy.title,
            description=copy.description,
            tags=copy.tags,
            account_selector=account_selector,
            **extra_kwargs,
        )
    except Exception as exc:
        logger.error(
            "schedule_publish_entry_failed",
            entry_id=entry.entry_id,
            job_id=entry.job_id,
            platform=entry.platform,
            error=str(exc),
        )
        failed = await queue_repository.mark_failed(entry.entry_id, str(exc))
        return failed or updated

    published = await queue_repository.mark_published(
        entry.entry_id, post_id=result.post_id, url=result.url
    )
    # Sin esto, lo publicado por la cola ("Publicar ahora" / horarios) no
    # aparecía en Canales, que lee solo el log de publicaciones.
    await publish_log.record_published_video(
        platform=entry.platform,
        alias=entry.account_alias,
        post_id=result.post_id,
        url=result.url,
        title=copy.title,
        job_id=entry.job_id,
    )
    if entry.platform == "youtube" and extra_kwargs.get("comment_text") and result.raw_response.get("comment_posted") is False:
        try:
            await notification_tracker.create(Notification(
                type="video_failed", severity="warning", title="Comentario de YouTube pendiente",
                message=f"El video se publicó en YouTube, pero no se pudo añadir el comentario: {result.url}",
                job_id=entry.job_id, account_alias=entry.account_alias,
            ))
        except Exception as exc:
            logger.warning("schedule_comment_notification_failed", error=str(exc))
    return published or updated


# ── Auto-fill (modo automático: solo rellena huecos) ────────────────────────

async def _fill_gaps(now: datetime) -> int:
    """Para cada slot habilitado cuyo (weekday, HH:MM) matchea `now`: si esa
    ocurrencia ya tiene una entry (manual o previamente auto-elegida) se
    respeta y se salta; si no, elige el job más antiguo listo que matchee el
    filtro de nicho y crea una entry `source=AUTO`."""
    filled = 0
    weekday = now.weekday()
    hhmm = now.strftime("%H:%M")
    occurrence_date = now.strftime("%Y-%m-%d")

    for slot in slot_repository.list_slots(enabled=True):
        if weekday not in slot.days or hhmm not in slot.times:
            continue

        scheduled_at = f"{occurrence_date}T{hhmm}:00+00:00"
        if queue_repository.find_pending_for_slot_occurrence(slot.slot_id, scheduled_at) is not None:
            continue

        job_id = _pick_oldest_ready_job(slot)
        if job_id is None:
            logger.info("schedule_fill_gap_no_ready_job", slot_id=slot.slot_id)
            continue

        await queue_repository.create(
            job_id=job_id,
            platform=slot.platform,
            account_alias=slot.account_alias,
            scheduled_at=scheduled_at,
            source=QueueSource.AUTO,
            slot_id=slot.slot_id,
        )
        filled += 1

    return filled


def _pick_oldest_ready_job(slot: ScheduleSlot) -> str | None:
    """Job más antiguo en stage=packaged que matchee `slot.niche_filter` y que
    todavía no tenga ninguna entry (de ningún status) para esta plataforma+
    cuenta — evita reintentar en loop un job que ya falló ahí."""
    records, _total = job_tracker.list_jobs(stage=JobStage.PACKAGED.value, limit=10_000, offset=0)
    candidates = sorted(records, key=lambda r: r.get("created_at", ""))
    for record in candidates:
        if not category_matches(record.get("category") or "", slot.niche_filter):
            continue
        job_id = record.get("job_id")
        if not job_id:
            continue
        if queue_repository.has_any_entry_for_target(job_id, slot.platform, slot.account_alias):
            continue
        return job_id
    return None
