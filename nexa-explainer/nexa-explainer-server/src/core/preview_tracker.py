"""Preview Tracker — estado en memoria de los previews de plantilla (sin grabar).

A diferencia de `job_tracker.py` (persistente en disco, para jobs de video
REALES que sí deben sobrevivir un restart y aparecer en Biblioteca/historial),
un preview es descartable: solo interesa mientras el usuario está mirando la
pantalla probando combinaciones de imagen/música. Por eso alcanza con un dict
en memoria — asyncio es single-threaded, así que no hace falta ningún lock
para un simple read-modify-write de dict.

Terminal para un preview es distinto de un job real: `html_generated` (éxito,
ahí es donde el pipeline se corta con `stop_after`) o `failed` — nunca llega
a `packaged` porque nunca pasa por video_recorder/packager.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from src.core.job import Job, JobStage

_previews: dict[str, dict[str, Any]] = {}

_TERMINAL_STAGES = {JobStage.HTML_GENERATED, JobStage.FAILED}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def create(job: Job) -> None:
    _previews[job.job_id] = {
        "preview_id": job.job_id,
        "category": job.input.category_name,
        "stage": job.stage.value,
        "output_dir": None,
        "errors": [],
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }


async def update(job: Job) -> None:
    """`async` (aunque no hace ningún await) para calzar con la firma de
    `on_stage: Callable[[Job], Awaitable[None]]` que espera `pipeline.run`."""
    record = _previews.get(job.job_id)
    if record is None:
        return
    record.update({
        "stage": job.stage.value,
        "output_dir": str(job.artifacts.output_dir) if job.artifacts.output_dir else record.get("output_dir"),
        "errors": job.errors,
        "updated_at": _now_iso(),
    })


def get(preview_id: str) -> dict[str, Any] | None:
    return _previews.get(preview_id)


def is_terminal(stage_value: str) -> bool:
    return stage_value in {s.value for s in _TERMINAL_STAGES}


def is_success(stage_value: str) -> bool:
    return stage_value == JobStage.HTML_GENERATED.value
