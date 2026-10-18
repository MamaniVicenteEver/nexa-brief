"""Video deletion — borra un video de Biblioteca (local) y/o sus publicaciones.

Dos operaciones, usadas por `DELETE /videos/jobs/{job_id}` (Biblioteca) y
`DELETE /publish/{platform}/{alias}/{video_id}` (Canales):

- `delete_publication()`: borra UN post de la plataforma y, si salió bien (o
  la plataforma dice que ya no existe), limpia los registros locales que lo
  daban por publicado — `data/canales/published_videos.json` y las entries
  de la cola (quedan en status `removed`).
- `delete_job()`: borra el video de Biblioteca — carpeta de output, registro
  del índice de jobs, historial, entries de cola y notificaciones. Con
  `remote=True` primero borra cada publicación; si alguna falla, NO borra lo
  local, así el usuario puede reintentar o elegir "solo local".

Las publicaciones de un job salen de dos fuentes: el log de publicaciones
(pipeline, con `job_id`) y las entries `published` de la cola (Publicar
ahora / programadas), deduplicadas por (platform, alias, post_id).
"""

from __future__ import annotations

import shutil
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Literal

import structlog
from pydantic import BaseModel

from src.core import publish_log
from src.adapters.publishing.factory import get_publisher_facade
from src.config.exceptions import TokenExpiredError, VideoNotFoundError
from src.config.settings import settings
from src.core import history_tracker, job_tracker, notification_tracker
from src.core.job import JobStage
from src.core.realtime.event_bus import get_event_bus
from src.core.realtime.events import RealtimeEvent
from src.core.schedule import queue_repository
from src.core.schedule.models import QueueStatus

logger = structlog.get_logger(__name__)

# TikTok no expone borrado en su Content Posting API pública (y lo que se
# guarda al publicar es el publish_id, no el video_id): se borra desde la app.
REMOTE_DELETE_PLATFORMS = frozenset({"youtube", "facebook"})

_TERMINAL_STAGES = {JobStage.PACKAGED.value, JobStage.PUBLISHED.value, JobStage.FAILED.value}

# Un job no terminal que no avanza hace este tiempo quedó colgado (el proceso
# murió a mitad del pipeline): se permite borrarlo como si hubiera fallado.
_STALE_AFTER = timedelta(minutes=30)

DeletionStatus = Literal["deleted", "already_gone", "unsupported", "failed"]


class Publication(BaseModel):
    platform: str
    account_alias: str
    post_id: str
    url: str | None = None
    title: str | None = None
    can_delete_remote: bool


class PublicationDeletion(BaseModel):
    platform: str
    account_alias: str
    post_id: str
    status: DeletionStatus
    error: str | None = None


class JobDeletion(BaseModel):
    job_id: str
    deleted_local: bool
    publications: list[PublicationDeletion]


def list_job_publications(job_id: str) -> list[Publication]:
    found: dict[tuple[str, str, str], Publication] = {}

    for item in publish_log.list_published_for_job(job_id):
        key = (item["platform"], item["alias"], item["post_id"])
        found[key] = Publication(
            platform=item["platform"],
            account_alias=item["alias"],
            post_id=item["post_id"],
            url=item.get("url"),
            title=item.get("title"),
            can_delete_remote=item["platform"] in REMOTE_DELETE_PLATFORMS,
        )

    entries, _ = queue_repository.list_entries(
        job_id=job_id, status=QueueStatus.PUBLISHED.value, limit=1000
    )
    for entry in entries:
        if not entry.post_id:
            continue
        key = (entry.platform, entry.account_alias, entry.post_id)
        found.setdefault(
            key,
            Publication(
                platform=entry.platform,
                account_alias=entry.account_alias,
                post_id=entry.post_id,
                url=entry.url,
                can_delete_remote=entry.platform in REMOTE_DELETE_PLATFORMS,
            ),
        )

    return list(found.values())


async def _forget_publication(platform: str, alias: str, post_id: str) -> None:
    await publish_log.remove_published_video(platform, alias, post_id)
    await queue_repository.mark_removed_by_post(platform, alias, post_id)
    await get_event_bus().publish(
        RealtimeEvent(
            type="channel_status_changed",
            data={"platform": platform, "alias": alias, "status": "video_removed"},
        )
    )


async def delete_publication(platform: str, alias: str, post_id: str) -> PublicationDeletion:
    result = {"platform": platform, "account_alias": alias, "post_id": post_id}

    if platform not in REMOTE_DELETE_PLATFORMS:
        return PublicationDeletion(
            **result,
            status="unsupported",
            error=f"{platform} no permite eliminar videos por API; hacelo desde la app.",
        )

    try:
        await get_publisher_facade().delete_video(post_id, account_selector=f"{platform}:{alias}")
        status: DeletionStatus = "deleted"
    except VideoNotFoundError:
        # Ya no existe en la plataforma (borrado a mano, o ID inválido): igual
        # hay que dejar de mostrarlo como publicado.
        status = "already_gone"
    except TokenExpiredError as exc:
        logger.warning("video_deletion_token_expired", platform=platform, alias=alias, error=str(exc))
        return PublicationDeletion(
            **result, status="failed", error="El token de la cuenta expiró: reconectala en Canales."
        )
    except Exception as exc:  # noqa: BLE001 — se reporta al usuario, no se propaga
        logger.error("video_deletion_remote_failed", platform=platform, alias=alias, post_id=post_id, error=str(exc))
        return PublicationDeletion(**result, status="failed", error=str(exc))

    await _forget_publication(platform, alias, post_id)
    logger.info("video_deletion_remote_done", platform=platform, alias=alias, post_id=post_id, status=status)
    return PublicationDeletion(**result, status=status)


def _remove_output_dir(record: dict[str, Any]) -> None:
    output_dir = record.get("output_dir")
    if not output_dir:
        return
    path = Path(output_dir).resolve()
    root = settings.output_dir.resolve()
    # Nunca borrar fuera de output/ aunque el índice tenga un path raro.
    if path == root or root not in path.parents:
        logger.warning("video_deletion_output_outside_root", path=str(path))
        return
    # Otro video de la Biblioteca usa la misma carpeta (las grabaciones explainer anteriores al
    # 2026-10-14 compartían una por video): borrarla le quitaba los archivos a ese otro video.
    shared = [
        r["job_id"] for r in job_tracker.list_jobs(limit=100_000)[0]
        if r.get("job_id") != record.get("job_id") and r.get("output_dir")
        and Path(r["output_dir"]).resolve() == path
    ]
    if shared:
        logger.warning("video_deletion_output_shared", path=str(path), shared_with=shared)
        return
    if path.exists():
        shutil.rmtree(path, ignore_errors=True)


def _is_deletable(record: dict[str, Any]) -> bool:
    if record.get("stage") in _TERMINAL_STAGES:
        return True
    try:
        updated_at = datetime.fromisoformat(record["updated_at"])
    except (KeyError, ValueError):
        return True
    return datetime.now(timezone.utc) - updated_at > _STALE_AFTER


async def delete_job(job_id: str, *, remote: bool) -> JobDeletion:
    """Raises LookupError si el job no existe, ValueError si todavía se está generando."""
    record = job_tracker.get(job_id)
    if record is None:
        raise LookupError(f"Job '{job_id}' not found")
    if not _is_deletable(record):
        raise ValueError(f"Job '{job_id}' is still running (stage={record.get('stage')}).")

    deletions: list[PublicationDeletion] = []
    if remote:
        for pub in list_job_publications(job_id):
            deletions.append(await delete_publication(pub.platform, pub.account_alias, pub.post_id))
        if any(d.status == "failed" for d in deletions):
            return JobDeletion(job_id=job_id, deleted_local=False, publications=deletions)

    _remove_output_dir(record)
    await job_tracker.delete(job_id)
    await history_tracker.delete_job_history(job_id)
    await queue_repository.delete_for_job(job_id)
    await notification_tracker.delete_for_job(job_id)
    await get_event_bus().publish(RealtimeEvent(type="job_deleted", data={"job_id": job_id}))

    logger.info("video_deletion_local_done", job_id=job_id, remote=remote)
    return JobDeletion(job_id=job_id, deleted_local=True, publications=deletions)
