"""Job Tracker — persistencia del estado de jobs de generación de video.

Mismo patrón que `src/core/library/asset_library.py`: índice JSON plano en
`data/jobs_library/_index.json`, con un `asyncio.Lock` por archivo para
serializar el read-modify-write y escritura atómica (`tmp.replace(path)`).

Necesario para el modelo "fire and forget": el pipeline corre en background
(`asyncio.create_task`, ver `src/presentation/api/routers/videos.py`) y el
router ya devolvió la respuesta HTTP — este módulo es el único lugar donde
se puede consultar en qué stage está un job, o listar jobs pasados, después
de que la request original terminó.
"""

from __future__ import annotations

import asyncio
import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import structlog

from src.config.niche_config import NicheConfig
from src.config.settings import settings
from src.core.job import Job, JobStage

logger = structlog.get_logger(__name__)

_locks: dict[Path, asyncio.Lock] = defaultdict(asyncio.Lock)

# Whitelist de formatos servibles — nunca se resuelve un path a partir del
# input del usuario, solo se hace lookup en `file_paths` (ver `update()`).
FILE_FORMATS = ("youtube", "reels", "tiktok", "thumbnail")

_TERMINAL_STAGES = {JobStage.PACKAGED, JobStage.PUBLISHED, JobStage.FAILED}


def _lock_for(path: Path) -> asyncio.Lock:
    return _locks[path]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _index_path() -> Path:
    return settings.jobs_library_dir / "_index.json"


def _read_index(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    raw = path.read_text(encoding="utf-8").strip()
    if not raw:
        return []
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        logger.error("job_tracker_index_corrupt", path=str(path))
        return []


def _write_index(path: Path, data: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    tmp.replace(path)


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
    path = _index_path()
    async with _lock_for(path):
        data = _read_index(path)
        data.append(record)
        _write_index(path, data)


async def update(job: Job) -> None:
    """Read-modify-write del registro de `job.job_id` reflejando su estado actual.

    Se llama después de cada stage del pipeline (`on_stage` en `pipeline.run`).
    Recalcula `file_paths`/`ready_formats` inspeccionando qué artifacts de
    video ya existen, y dispara ffprobe para `duration_seconds` una sola vez
    (cuando el youtube_video_path aparece por primera vez).
    """
    path = _index_path()
    async with _lock_for(path):
        data = _read_index(path)
        index = next((i for i, r in enumerate(data) if r.get("job_id") == job.job_id), None)
        if index is None:
            logger.warning("job_tracker_update_missing_record", job_id=job.job_id)
            return

        record = data[index]
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

        duration_seconds = record.get("duration_seconds")
        if duration_seconds is None and artifacts.youtube_video_path is not None:
            duration_seconds = await _get_video_duration_seconds(artifacts.youtube_video_path)

        record.update({
            "stage": job.stage.value,
            "output_dir": str(artifacts.output_dir) if artifacts.output_dir else record.get("output_dir"),
            "errors": job.errors,
            "updated_at": _now_iso(),
            "duration_seconds": duration_seconds,
            "file_paths": file_paths,
            "ready_formats": list(file_paths.keys()),
        })
        data[index] = record
        _write_index(path, data)


def get(job_id: str) -> dict[str, Any] | None:
    for record in _read_index(_index_path()):
        if record.get("job_id") == job_id:
            return record
    return None


def list_jobs(
    stage: str | None = None,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[dict[str, Any]], int]:
    """Lista jobs, más recientes primero. `stage` filtra por stage exacto si se da."""
    records = _read_index(_index_path())
    if stage is not None:
        records = [r for r in records if r.get("stage") == stage]
    records.sort(key=lambda r: r.get("created_at", ""), reverse=True)
    total = len(records)
    return records[offset : offset + limit], total


def count_active() -> int:
    """Cuenta jobs cuyo stage todavía no es terminal (pending...packaged/failed)."""
    terminal_values = {s.value for s in _TERMINAL_STAGES}
    return sum(1 for r in _read_index(_index_path()) if r.get("stage") not in terminal_values)


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
