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
import re
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


def _remove_output_dir(record: dict[str, Any]) -> bool | None:
    output_dir = record.get("output_dir")
    if not output_dir:
        return
    path = Path(output_dir).resolve()
    from src.config.profile_layout import layout_for_settings
    layout = layout_for_settings(settings)
    production_root = layout.productions_dir.resolve()
    if layout.schema_version >= 2 and path.is_relative_to(production_root):
        job_id = record.get("job_id", "")
        expected = [(path, production_root),
                    (Path(record["render_dir"]).resolve(), layout.renders_dir.resolve()) if record.get("render_dir") else None,
                    (Path(record["log_dir"]).resolve(), layout.logs_dir.resolve()) if record.get("log_dir") else None]
        cleared = True
        for item in expected:
            if item is None:
                continue
            candidate, allowed = item
            if candidate == allowed or not candidate.is_relative_to(allowed) or candidate.name != job_id:
                logger.warning("video_deletion_output_outside_root", path=str(candidate))
                cleared = False
                continue
            shared = any(r.get("job_id") != job_id and any(
                r.get(field) and Path(r[field]).resolve() == candidate for field in ("output_dir", "render_dir", "log_dir")
            ) for r in job_tracker.list_jobs(limit=100_000)[0])
            if shared:
                cleared = False
            elif candidate.exists():
                shutil.rmtree(candidate, ignore_errors=True)
                cleared = cleared and not candidate.exists()
        return cleared
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


async def _remove_v3_explainer_recording(record: dict[str, Any]) -> None:
    """Remove one recording's owned masters and logs; keep the shared production."""
    from src.adapters.data.job_output_paths import checked_profile_path, resolve_v3_job_output
    from src.config.profile_layout import layout_for_settings
    from src.core.data import collection, documents, get_data_store

    layout = layout_for_settings(settings)
    video_id, job_id = record.get('video_id'), record.get('job_id')
    safe_id = re.compile(r'^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$')
    if not isinstance(video_id, str) or not safe_id.fullmatch(video_id) or not isinstance(job_id, str):
        raise ValueError('La grabación no tiene una identidad válida')
    prefix = f'explainer-{video_id}-'
    recording_id = job_id[len(prefix):] if job_id.startswith(prefix) else ''
    if not safe_id.fullmatch(recording_id):
        raise ValueError('La grabación no tiene una identidad válida')

    async with get_data_store().coordination('content-video-' + video_id):
        store = documents('content_video_details')
        details = store.get(video_id)
        if not isinstance(details, dict) or not isinstance(details.get('recordings'), dict):
            raise ValueError('Falta el registro de la grabación')
        recordings = dict(details['recordings'])
        recording = recordings.get(recording_id)
        if not isinstance(recording, dict) or recording.get('recording_id') != recording_id:
            raise ValueError('Falta el registro de la grabación')
        asset_ids = recording.get('asset_ids')
        if not isinstance(asset_ids, list) or any(not isinstance(item, str) for item in asset_ids):
            raise ValueError('Los recursos de la grabación son inválidos')

        resources = collection('content_resources')
        asset_rows = []
        paths = set()
        foreign_ids = set()
        render_root = layout.renders_dir / 'videos'
        for asset_id in set(asset_ids):
            asset = resources.get(asset_id)
            if not isinstance(asset, dict) or asset.get('video_id') != video_id:
                raise ValueError('Falta un recurso de la grabación')
            key = asset.get('storage_key')
            if not isinstance(key, str) or '\\' in key or Path(key).is_absolute() or '..' in Path(key).parts:
                raise ValueError('La ruta del recurso es inválida')
            candidate = layout.root / key
            checked_profile_path(candidate, render_root, layout.root)
            parts = candidate.relative_to(render_root).parts
            if len(parts) != 4 or parts[1] != video_id or parts[3] != 'video.mp4':
                raise ValueError('El recurso no pertenece a la grabación')
            if parts[2] not in {f'{recording_id}-9x16', f'{recording_id}-16x9',
                                 f'preview-{recording_id}-9x16', f'preview-{recording_id}-16x9'}:
                foreign_ids.add(asset_id)
            paths.add(candidate)
            asset_rows.append(asset)

        for field in ('file_paths', 'format_paths'):
            values = record.get(field) or {}
            if not isinstance(values, dict):
                raise ValueError('Las rutas de la grabación son inválidas')
            for fmt, value in values.items():
                if fmt == 'thumbnail' or not value:
                    continue
                if not isinstance(value, str):
                    raise ValueError('La ruta de la grabación es inválida')
                direct = Path(value)
                if direct not in paths and resolve_v3_job_output(value) not in paths:
                    raise ValueError('Una salida no pertenece a la grabación')

        other_recordings = [value for key, value in recordings.items() if key != recording_id]
        if any(not isinstance(item, dict) or not isinstance(item.get('asset_ids', []), list)
               for item in other_recordings):
            raise ValueError('El índice de grabaciones es inválido')
        shared_ids = {asset for item in other_recordings for asset in item.get('asset_ids', [])}
        shared_paths = set()
        own_ids = {item['asset_id'] for item in asset_rows}
        for item in resources.list():
            if item.get('asset_id') not in own_ids and isinstance(item.get('storage_key'), str):
                shared_paths.add(layout.root / item['storage_key'])
        for other in collection('jobs').list():
            if other.get('job_id') == job_id:
                continue
            for field in ('file_paths', 'format_paths'):
                values = other.get(field) or {}
                if isinstance(values, dict):
                    for value in values.values():
                        if isinstance(value, str):
                            resolved = resolve_v3_job_output(value)
                            if resolved is not None:
                                shared_paths.add(resolved)

        log_id = recording.get('log_id')
        shared_log = any(item.get('log_id') == log_id for item in other_recordings) if log_id else False
        log_entry = collection('execution_logs').get(log_id) if log_id else None
        log_key = f'logs/videos/{video_id}/recordings/{recording_id}.log'
        if log_id and (not log_entry or log_entry.get('key') != log_key or log_entry.get('video_id') != video_id):
            raise ValueError('El registro de log no pertenece a la grabación')
        log_file = checked_profile_path(layout.root / log_key, layout.logs_dir, layout.root)
        summary_dir = checked_profile_path(layout.logs_dir / 'videos' / video_id / 'recordings' / recording_id,
                                           layout.logs_dir, layout.root)
        summary = checked_profile_path(summary_dir / '08_resumen_final.json', layout.logs_dir, layout.root)
        removals = []
        for asset in asset_rows:
            path = layout.root / asset['storage_key']
            if asset['asset_id'] not in shared_ids | foreign_ids and path not in shared_paths:
                removals.extend((path, checked_profile_path(path.with_suffix(path.suffix + '.sha256'),
                                                            render_root, layout.root)))
        if not shared_log:
            removals.extend((log_file, summary))
        try:
            for path in dict.fromkeys(removals):
                if path.exists() and not path.is_file():
                    raise ValueError('Una salida de grabación no es un archivo')
            for path in dict.fromkeys(removals):
                path.unlink(missing_ok=True)
            for directory in {path.parent for path in removals}:
                if directory.exists():
                    try:
                        directory.rmdir()  # Only empty recording directories; never remove user content.
                    except OSError:
                        pass
        except OSError as exc:
            raise ValueError('No se pudieron eliminar todos los archivos de la grabación') from exc

        for asset in asset_rows:
            if (asset['asset_id'] not in shared_ids | foreign_ids
                    and layout.root / asset['storage_key'] not in shared_paths):
                await resources.delete(asset['asset_id'])
        if log_id and not shared_log:
            await collection('execution_logs').delete(log_id)
        del recordings[recording_id]
        store.put(video_id, {**details, 'recordings': recordings})


def _remove_v3_pipeline_outputs(record: dict[str, Any]) -> bool:
    """Remove only job-owned v3 directories, retaining shared ones and surfacing I/O failures."""
    from src.adapters.data.job_output_paths import checked_profile_path
    from src.config.profile_layout import layout_for_settings
    from src.core.data import collection

    layout = layout_for_settings(settings)
    job_id = record.get('job_id')
    if not isinstance(job_id, str) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,127}', job_id):
        raise ValueError('El job no tiene una identidad válida')
    fields = (('output_dir', layout.productions_dir), ('render_dir', layout.renders_dir),
              ('log_dir', layout.logs_dir))
    candidates = []
    for field, root in fields:
        value = record.get(field)
        if not value:
            continue
        if not isinstance(value, str) or '\\' in value:
            raise ValueError('La ruta del job es inválida')
        path = checked_profile_path(Path(value), root, layout.root)
        if path.name != job_id:
            raise ValueError('La carpeta no pertenece al job')
        if path.exists() and not path.is_dir():
            raise ValueError('La salida del job no es un directorio')
        candidates.append(path)
    if not candidates:
        if record.get('file_paths'):
            raise ValueError('Falta la carpeta del job')
        return False
    other_jobs = [other for other in collection('jobs').list() if other.get('job_id') != job_id]
    shared = {path for path in candidates if any(
        isinstance(other.get(field), str) and Path(other[field]) == path
        for other in other_jobs for field, _ in fields
    )}
    try:
        for path in candidates:
            if path not in shared and path.exists():
                shutil.rmtree(path)
                if path.exists():
                    raise OSError('Directory still exists')
    except OSError as exc:
        raise ValueError('No se pudieron eliminar todos los archivos del job') from exc
    return not shared


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

    from src.config.profile_layout import layout_for_settings
    if layout_for_settings(settings).schema_version >= 3:
        if record.get('source') == 'explainer':
            await _remove_v3_explainer_recording(record)
            removed_v2 = False
        else:
            removed_v2 = _remove_v3_pipeline_outputs(record)
    else:
        removed_v2 = _remove_output_dir(record)
    if removed_v2:
        from src.core.data import collection, documents
        entry = collection("content_videos").get(job_id)
        if entry and entry.get("production_id") == job_id:
            await collection("content_resources").delete_where({"video_id": job_id})
            await collection("execution_logs").delete_where({"video_id": job_id})
            documents("content_video_details").delete(job_id)
            await collection("content_videos").delete(job_id)
    await job_tracker.delete(job_id)
    await history_tracker.delete_job_history(job_id)
    await queue_repository.delete_for_job(job_id)
    await notification_tracker.delete_for_job(job_id)
    await get_event_bus().publish(RealtimeEvent(type="job_deleted", data={"job_id": job_id}))

    logger.info("video_deletion_local_done", job_id=job_id, remote=remote)
    return JobDeletion(job_id=job_id, deleted_local=True, publications=deletions)
