"""Job Tracker — persistencia del estado de jobs de generación de video.

Persiste en la colección "jobs" del DataStore (`src/core/data.py`) — este
módulo no sabe si es un JSON o una tabla; solo arma y lee los registros.

Necesario para el modelo "fire and forget": el pipeline corre en background
(`asyncio.create_task`, ver `src/presentation/api/routers/videos.py`) y el
router ya devolvió la respuesta HTTP — este módulo es el único lugar donde
se puede consultar en qué stage está un job, o listar jobs pasados, después
de que la request original terminó.
"""

from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import structlog

from src.config.niche_config import NicheConfig
from src.core.data import collection
from src.core.job import Job, JobStage

logger = structlog.get_logger(__name__)

# Whitelist de formatos servibles — nunca se resuelve un path a partir del
# input del usuario, solo se hace lookup en `file_paths` (ver `update()`).
FILE_FORMATS = ("youtube", "reels", "tiktok", "thumbnail")

_TERMINAL_STAGES = {JobStage.PACKAGED, JobStage.PUBLISHED, JobStage.FAILED}


def _jobs():
    return collection("jobs")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _get_video_duration_seconds(path: Path) -> float | None:
    """Lee la duración real de un video con ffprobe — mismo patrón que
    `resource_fetcher._get_audio_duration_seconds`, pero tolerante: la
    duración es metadata informativa, no debe romper el tracking si falla."""
    try:
        proc = await asyncio.create_subprocess_exec(
            "ffprobe", "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            str(path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await proc.communicate()
        if proc.returncode != 0 or not stdout.strip():
            return None
        return round(float(stdout.decode().strip()), 2)
    except Exception:
        logger.warning("job_tracker_ffprobe_failed", path=str(path))
        return None


def _resolve_title(job: Job, niche_cfg: NicheConfig) -> str:
    song_info = job.input.song_info
    if song_info and song_info.song_name:
        return song_info.song_name
    return niche_cfg.display_name


async def create(job: Job, niche_cfg: NicheConfig) -> None:
    """Persiste el registro inicial de un job recién aceptado (stage=pending)."""
    record: dict[str, Any] = {
        "job_id": job.job_id,
        "category": job.input.category_name,
        "title": _resolve_title(job, niche_cfg),
        "stage": job.stage.value,
        "output_dir": None,
        "errors": [],
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
        "duration_seconds": None,
        "file_paths": {},
        "ready_formats": [],
    }
    await _jobs().insert(record)


async def update(job: Job) -> None:
    """Read-modify-write del registro de `job.job_id` reflejando su estado actual.

    Se llama después de cada stage del pipeline (`on_stage` en `pipeline.run`).
    Recalcula `file_paths`/`ready_formats` inspeccionando qué artifacts de
    video ya existen, y dispara ffprobe para `duration_seconds` una sola vez
    (cuando el youtube_video_path aparece por primera vez).
    """
    record = _jobs().get(job.job_id)
    if record is None:
        logger.warning("job_tracker_update_missing_record", job_id=job.job_id)
        return

    artifacts = job.artifacts
    file_paths: dict[str, str] = dict(record.get("file_paths", {}))
    format_paths = {
        "youtube": artifacts.youtube_video_path,
        "reels": artifacts.reels_video_path,
        "tiktok": artifacts.tiktok_video_path,
        "thumbnail": artifacts.thumbnail_path,
    }
    for fmt, file_path in format_paths.items():
        if file_path is not None:
            file_paths[fmt] = str(file_path)
    # Archivo por relación de aspecto, como los explainer (`recorder._register_for_scheduling`):
    # "Publicar ahora" y la cola eligen el formato por cuenta con estas claves.
    aspect_paths: dict[str, str] = dict(record.get("format_paths") or {})
    if artifacts.youtube_video_path is not None:
        aspect_paths["16x9"] = str(artifacts.youtube_video_path)
    if artifacts.reels_video_path is not None and artifacts.reels_video_path != artifacts.youtube_video_path:
        aspect_paths["9x16"] = str(artifacts.reels_video_path)

    duration_seconds = record.get("duration_seconds")
    if duration_seconds is None and artifacts.youtube_video_path is not None:
        duration_seconds = await _get_video_duration_seconds(artifacts.youtube_video_path)

    patch: dict[str, Any] = {}
    # Tiempo real de generación (desde que se aceptó el job hasta que quedó
    # listo o falló) — se fija una sola vez: publicar después no lo cambia.
    if job.stage in (JobStage.PACKAGED, JobStage.FAILED) and record.get("generation_seconds") is None:
        patch["generation_seconds"] = _seconds_between(record.get("created_at"), _now_iso())

    await _jobs().update(job.job_id, {
        **patch,
        "stage": job.stage.value,
        "output_dir": str(artifacts.output_dir) if artifacts.output_dir else record.get("output_dir"),
        "errors": job.errors,
        "updated_at": _now_iso(),
        "duration_seconds": duration_seconds,
        "file_paths": file_paths,
        "ready_formats": list(file_paths.keys()),
        "format_paths": aspect_paths,
        "formats": list(aspect_paths),
    })


def format_paths(record: dict[str, Any]) -> dict[str, str]:
    """Archivo por formato ('16x9' / '9x16'). Los jobs anteriores a `format_paths`
    lo derivan de `file_paths` (el 9:16 solo si es un archivo distinto del 16:9)."""
    stored = record.get("format_paths")
    if stored:
        return dict(stored)
    files: dict[str, str] = record.get("file_paths") or {}
    derived: dict[str, str] = {}
    if files.get("youtube"):
        derived["16x9"] = files["youtube"]
    vertical = files.get("reels") or files.get("instagram")
    if vertical and vertical != files.get("youtube"):
        derived["9x16"] = vertical
    return derived


def _seconds_between(start_iso: str | None, end_iso: str | None) -> float | None:
    try:
        start, end = datetime.fromisoformat(start_iso), datetime.fromisoformat(end_iso)
    except (TypeError, ValueError):
        return None
    return round(max(0.0, (end - start).total_seconds()), 1)


def generation_seconds(record: dict[str, Any]) -> float | None:
    """Cuánto tardó en generarse el video. Jobs anteriores a que se guardara
    `generation_seconds` lo derivan del historial (evento packaged/failed)."""
    stored = record.get("generation_seconds")
    if stored is not None:
        return stored
    if record.get("stage") not in {s.value for s in _TERMINAL_STAGES}:
        return None
    from src.core import history_tracker  # import local: history_tracker no depende de este módulo

    for event in history_tracker.list_job_events(record["job_id"]):
        if event.stage in (JobStage.PACKAGED, JobStage.FAILED):
            return _seconds_between(record.get("created_at"), event.created_at)
    return None


async def delete(job_id: str) -> dict[str, Any] | None:
    """Quita el registro. Devuelve el registro borrado (o None)."""
    return await _jobs().delete(job_id)


def get(job_id: str) -> dict[str, Any] | None:
    return _jobs().get(job_id)


def list_jobs(
    stage: str | None = None,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[dict[str, Any]], int]:
    """Lista jobs, más recientes primero. `stage` filtra por stage exacto si se da."""
    records = _jobs().list({"stage": stage} if stage is not None else None)
    records.sort(key=lambda r: r.get("created_at", ""), reverse=True)
    total = len(records)
    return records[offset : offset + limit], total


def count_active() -> int:
    """Cuenta jobs cuyo stage todavía no es terminal (pending...packaged/failed)."""
    terminal_values = {s.value for s in _TERMINAL_STAGES}
    return sum(1 for r in _jobs().list() if r.get("stage") not in terminal_values)


def get_summary(job_id: str) -> dict[str, Any] | None:
    """Lee `{output_dir}/logs/08_resumen_final.json` (escrito por
    `result_summarizer.py`) — el único lugar donde sobrevive título/
    descripción/tags tras terminar el pipeline (el índice de job_tracker NO
    guarda esos campos, solo viven en memoria durante el pipeline).

    Usado por `src.core.schedule.engine.publish_entry()` para poder publicar
    un job fuera del pipeline (programado o "Publicar ahora") sin tener que
    volver a generar esa metadata.

    Devuelve None si el job no existe, todavía no tiene `output_dir`, o el
    summary nunca se generó (job no llegó a Stage 7) — nunca lanza.
    """
    record = get(job_id)
    if record is None:
        return None
    output_dir = record.get("output_dir")
    if not output_dir:
        return None
    summary_path = Path(output_dir) / "logs" / "08_resumen_final.json"
    if not summary_path.exists():
        return None
    raw = summary_path.read_text(encoding="utf-8").strip()
    if not raw:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        logger.error("job_tracker_summary_corrupt", job_id=job_id, path=str(summary_path))
        return None
