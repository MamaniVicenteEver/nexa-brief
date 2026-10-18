"""Drafts — preview persistido de una plantilla que se puede grabar después.

Reemplaza al preview descartable (`preview_tracker.py`, en memoria) para el
Estudio y Crear video: el draft guarda qué eligió el usuario (canción, medios,
textos, brief) y el Job serializado tal como quedó en HTML_GENERATED. "Grabar"
NO crea otro job: retoma ESE Job con `pipeline.run(..., resume=True)`, así no
se repite la transcripción, la búsqueda de recursos ni la generación del HTML
— y lo que se graba es exactamente lo que el usuario previsualizó.

Persistencia (solo vía `src/core/data.py`):
  - colección "drafts" (key draft_id): el registro liviano que lista la web;
  - documentos "draft_jobs" (key draft_id): el Job completo, último stage sano.

El snapshot del Job nunca se pisa con un Job FAILED: si una etapa falla, el
draft queda `failed` pero con el último Job bueno guardado, y se puede volver
a grabar desde ahí (`recoverable=True`).

Reinicios: un draft en `previewing`/`rendering` cuya ejecución no corre en
este proceso (`_running`) es de un proceso que murió — se marca `failed`
recuperable al leerlo. Un solo proceso, igual que el event bus y la cola.

Prototipos del Sandbox de NodeMotion (docs/investigaciones/nodemotion-sandbox-grabar-2026-10.md):
un draft tiene `name` y, después de «Preparar», `details` (los textos de publicación de
src/core/draft_details.py). Estados: previewing → preview_ready → preparing → prepared → rendering →
rendered (+ failed). Al grabar, los detalles se vuelcan al Job y las cuentas elegidas se publican
por la cola (src/core/draft_publishing.py), un formato por cuenta.

Ver docs/investigaciones/estudio-creacion-interactiva-2026-09.md §3.5.
"""

from __future__ import annotations

import uuid
from collections.abc import Awaitable, Callable
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

import structlog
from pydantic import BaseModel, Field

from src.core import pipeline
from src.core.data import collection, documents
from src.core.draft_details import DraftDetails, to_summary
from src.core.job import Job, JobPublishingConfig, JobStage, SongInfo
from src.core.job_queue import get_job_queue
from src.core.realtime.event_bus import get_event_bus
from src.core.realtime.events import RealtimeEvent
from src.core.template_inputs import TemplateInputs

logger = structlog.get_logger(__name__)

DraftStatus = Literal["previewing", "preview_ready", "preparing", "prepared", "rendering", "rendered", "failed"]
RecordFormat = Literal["16x9", "9x16"]

_IN_FLIGHT: frozenset[str] = frozenset({"previewing", "preparing", "rendering"})

# Drafts con una ejecución viva en ESTE proceso. Se agrega ANTES de persistir
# el estado en curso y se quita DESPUÉS de persistir el estado final, así una
# lectura concurrente nunca confunde un draft que está corriendo con uno huérfano.
_running: set[str] = set()


class DraftInputs(BaseModel):
    """Lo que eligió el usuario — suficiente para rehacer el draft desde cero."""

    music_asset_id: str | None = None
    image_asset_id: str | None = None
    video_asset_id: str | None = None
    template_inputs: TemplateInputs | None = None
    song_info: SongInfo | None = None
    user_context: str | None = Field(default=None, max_length=500)


class RenderOptions(BaseModel):
    """Opciones de grabado: se aplican al Job recién al grabar, no en el preview."""

    recorder_engine: str | None = None
    render_target: str | None = None
    publish_accounts: list[str] = Field(default_factory=list)  # "platform:alias"
    # Formatos a grabar (None = los del nicho). 16:9 va siempre: es el archivo principal del grabador.
    formats: list[RecordFormat] | None = None
    # Un formato por cuenta ("platform:alias" → "16x9" | "9x16"); sin entrada, el de su red.
    account_formats: dict[str, RecordFormat] = Field(default_factory=dict)


class Draft(BaseModel):
    draft_id: str
    template_id: str
    niche_id: str
    name: str = Field(default="", max_length=120)
    # «Video original»: la plantilla tal cual, con su canción y su fondo (src/core/template_original.py).
    original: bool = False
    # «Información de la canción» que escribió la persona al preparar (opcional): guía a la IA.
    song_notes: str = Field(default="", max_length=2000)
    status: DraftStatus = "previewing"
    stage: str = JobStage.PENDING.value
    errors: list[str] = Field(default_factory=list)
    inputs: DraftInputs = Field(default_factory=DraftInputs)
    preview_url: str | None = None
    # job_id del Job retomado — solo cuando se graba (antes el Job es interno).
    job_id: str | None = None
    # True si está `failed` pero tiene un Job sano guardado desde el cual grabar.
    recoverable: bool = False
    # Crear video en un paso: si viene, al quedar el preview listo se graba solo.
    auto_render: RenderOptions | None = None
    # Textos de publicación preparados antes de grabar (None = se generan al grabar, como antes).
    details: DraftDetails | None = None
    created_at: str
    updated_at: str


def _drafts():
    return collection("drafts")


def _draft_jobs():
    return documents("draft_jobs")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_draft_id() -> str:
    return uuid.uuid4().hex[:12]


def preview_url(draft_id: str) -> str:
    return f"/api/v1/drafts/{draft_id}/preview/index.html"


# ── Snapshot del Job ──────────────────────────────────────────────────────────

def load_job(draft_id: str) -> Job | None:
    raw = _draft_jobs().get(draft_id)
    return Job.model_validate(raw) if raw is not None else None


def _save_job(draft_id: str, job: Job) -> None:
    _draft_jobs().put(draft_id, job.model_dump(mode="json"))


def can_render(draft: Draft, job: Job | None) -> bool:
    """Se graba desde un preview listo o desde un fallo con Job sano guardado.
    `rendered` no se regraba: el video ya está en Biblioteca con ese job_id."""
    if job is None or job.stage == JobStage.FAILED or draft.status in _IN_FLIGHT:
        return False
    return draft.status in ("preview_ready", "prepared") or (draft.status == "failed" and draft.recoverable)


def can_prepare(draft: Draft, job: Job | None) -> bool:
    """Preparar (o volver a preparar) los textos: con el preview listo y sin nada corriendo."""
    return job is not None and draft.status in ("preview_ready", "prepared")


# ── Registro ──────────────────────────────────────────────────────────────────

async def _publish_changed(draft: Draft) -> None:
    await get_event_bus().publish(RealtimeEvent(
        type="draft_changed",
        data={"draft_id": draft.draft_id, "status": draft.status, "stage": draft.stage},
    ))


async def _patch(draft_id: str, patch: dict) -> Draft | None:
    record = await _drafts().update(draft_id, {**patch, "updated_at": _now_iso()})
    if record is None:
        return None
    draft = Draft.model_validate(record)
    await _publish_changed(draft)
    return draft


async def create(
    *,
    template_id: str,
    niche_id: str,
    inputs: DraftInputs,
    job: Job,
    auto_render: RenderOptions | None = None,
    name: str = "",
    original: bool = False,
    song_notes: str = "",
) -> Draft:
    """Persiste el draft recién aceptado (status=previewing) y su Job inicial.
    Lo marca como corriendo: el caller tiene que lanzar `run_preview` enseguida."""
    now = _now_iso()
    draft = Draft(
        draft_id=new_draft_id(),
        template_id=template_id,
        niche_id=niche_id,
        name=name,
        original=original,
        song_notes=song_notes,
        stage=job.stage.value,
        inputs=inputs,
        auto_render=auto_render,
        created_at=now,
        updated_at=now,
    )
    _running.add(draft.draft_id)
    _save_job(draft.draft_id, job)
    await _drafts().insert(draft.model_dump(mode="json"))
    await _publish_changed(draft)
    return draft


async def _recover_if_orphaned(draft: Draft) -> Draft:
    if draft.status not in _IN_FLIGHT or draft.draft_id in _running:
        return draft
    job = load_job(draft.draft_id)
    logger.warning("draft_orphaned", draft_id=draft.draft_id, status=draft.status)
    if draft.status == "preparing":
        # el preview sigue sano: vuelve a estar listo para preparar
        recovered = await _patch(draft.draft_id, {
            "status": "prepared" if draft.details else "preview_ready",
            "errors": [*draft.errors, "La preparación se interrumpió (reinicio del servidor). Volvé a preparar."],
        })
        return recovered or draft
    recovered = await _patch(draft.draft_id, {
        "status": "failed",
        "errors": [*draft.errors, f"Se interrumpió mientras estaba en '{draft.status}' (reinicio del servidor)."],
        "recoverable": job is not None and job.stage != JobStage.FAILED,
    })
    return recovered or draft


def _hide_missing_preview(draft: Draft) -> Draft:
    """Sin preview_url si la carpeta del preview ya no existe en esta máquina.

    Pasa con datos traídos de otra máquina (output_dir es una ruta absoluta de
    allá) o si se borró output/: la web abría "Mi versión" y el modal quedaba con
    un 404 en vez de la plantilla. El registro no se toca.
    """
    if not draft.preview_url:
        return draft
    job = load_job(draft.draft_id)
    output_dir = job.artifacts.output_dir if job is not None else None
    if output_dir is not None and not Path(output_dir).is_dir():
        return draft.model_copy(update={"preview_url": None})
    return draft


async def get(draft_id: str) -> Draft | None:
    record = _drafts().get(draft_id)
    if record is None:
        return None
    return _hide_missing_preview(await _recover_if_orphaned(Draft.model_validate(record)))


async def list_drafts(template_id: str | None = None) -> list[Draft]:
    """Drafts más recientes primero; `template_id` filtra por plantilla."""
    records = _drafts().list({"template_id": template_id} if template_id is not None else None)
    records.sort(key=lambda r: r.get("created_at", ""), reverse=True)
    return [_hide_missing_preview(await _recover_if_orphaned(Draft.model_validate(r))) for r in records]


async def delete(draft_id: str) -> Draft | None:
    """Borra el registro y el Job guardado. No toca output/<job_id>/: si el
    draft se grabó, ese directorio es el video de Biblioteca."""
    record = await _drafts().delete(draft_id)
    if record is None:
        return None
    _draft_jobs().delete(draft_id)
    return Draft.model_validate(record)


def is_running(draft_id: str) -> bool:
    return draft_id in _running


async def rename(draft_id: str, name: str) -> Draft | None:
    return await _patch(draft_id, {"name": name.strip()})


def _sync_intro(draft_id: str, details: DraftDetails | None) -> None:
    """La intro del video (config.json del prototipo) muestra la canción de los Detalles."""
    from src.core import draft_details

    job = load_job(draft_id)
    if details is not None and job is not None:
        draft_details.apply_to_intro(job.artifacts.output_dir, details)


async def save_details(draft_id: str, details: DraftDetails, *, edited: bool = True) -> Draft | None:
    """Detalles editados a mano (`edited`) o heredados de un original anterior: quedan `prepared`."""
    _sync_intro(draft_id, details)
    return await _patch(draft_id, {
        "details": details.model_copy(update={"edited": edited or details.edited}).model_dump(mode="json"),
        "status": "prepared",
    })


async def start_prepare(draft_id: str, song_notes: str | None = None) -> Draft | None:
    """Pasa a `preparing`; `song_notes` (si viene) reemplaza la información de la canción guardada."""
    _running.add(draft_id)
    patch: dict = {"status": "preparing", "errors": []}
    if song_notes is not None:
        patch["song_notes"] = song_notes.strip()
    draft = await _patch(draft_id, patch)
    if draft is None:
        _running.discard(draft_id)
    return draft


async def run_prepare(draft: Draft, job: Job) -> None:
    """Genera los detalles (draft_details.generate). Nunca lanza: si falla, el preview sigue
    listo y el error queda en el draft."""
    from src.core import draft_details

    try:
        details = await draft_details.generate(job, draft.niche_id, seed=draft.draft_id, notes=draft.song_notes)
        _sync_intro(draft.draft_id, details)
        await _patch(draft.draft_id, {"status": "prepared", "details": details.model_dump(mode="json"), "errors": []})
    except Exception as exc:
        logger.exception("draft_prepare_failed", draft_id=draft.draft_id)
        await _patch(draft.draft_id, {
            "status": "prepared" if draft.details else "preview_ready",
            "errors": [f"No se pudieron preparar los textos: {exc}"],
        })
    finally:
        _running.discard(draft.draft_id)


# ── Ejecución ─────────────────────────────────────────────────────────────────

def _stage_patch(job: Job) -> dict:
    return {"stage": job.stage.value, "errors": job.errors}


async def _on_preview_stage(draft_id: str, job: Job) -> None:
    if job.stage != JobStage.FAILED:
        _save_job(draft_id, job)
    await _patch(draft_id, _stage_patch(job))


async def run_preview(draft_id: str, job: Job) -> Job:
    """Corre el Job del draft hasta HTML_GENERATED (igual que el preview de
    plantillas, sin cola: no graba). Nunca lanza — un error queda en el draft."""
    try:
        result = await pipeline.run(
            job,
            on_stage=lambda j: _on_preview_stage(draft_id, j),
            stop_after=JobStage.HTML_GENERATED,
        )
        if result.stage == JobStage.HTML_GENERATED:
            await _patch(draft_id, {
                **_stage_patch(result), "status": "preview_ready", "preview_url": preview_url(draft_id),
            })
        else:
            await _fail(draft_id, result)
        return result
    except Exception as exc:
        logger.exception("draft_preview_crashed", draft_id=draft_id)
        failed = job.fail(f"[draft] Unexpected: {exc}")
        await _fail(draft_id, failed)
        return failed
    finally:
        _running.discard(draft_id)


async def _fail(draft_id: str, job: Job) -> None:
    saved = load_job(draft_id)
    await _patch(draft_id, {
        "status": "failed",
        "stage": job.stage.value,
        "errors": job.errors,
        "recoverable": saved is not None and saved.stage != JobStage.FAILED,
    })


def apply_render_options(job: Job, options: RenderOptions, details: DraftDetails | None = None) -> Job:
    """Vuelca motor / render_target / formatos en el JobInput — son decisiones de
    grabado, por eso no se fijan al crear el preview — y los detalles preparados
    en el Job (result_summarizer los usa sin volver a la IA).

    La publicación NO va por la etapa del pipeline: se apaga acá y, al terminar,
    src/core/draft_publishing.py publica por la cola, una entrada por cuenta y formato."""
    job = job.model_copy(update={"input": job.input.model_copy(update={
        "recorder_engine_override": options.recorder_engine,
        "render_target": options.render_target,
        "publishing": JobPublishingConfig(enabled=False, accounts=[]),
        "formats": options.formats,
    })})
    if details is not None and details.copies:
        artifacts = job.artifacts.model_copy(update={"summary": to_summary(details)})
        job = job.model_copy(update={"artifacts": artifacts})
    return job


async def start_render(draft_id: str, job: Job) -> Draft | None:
    """Pasa el draft a `rendering` con el job_id que va a aparecer en
    Biblioteca. El caller lanza `run_render` enseguida."""
    _running.add(draft_id)
    _save_job(draft_id, job)
    draft = await _patch(draft_id, {
        "status": "rendering", "job_id": job.job_id, "recoverable": False, "errors": [],
    })
    if draft is None:
        _running.discard(draft_id)
    return draft


async def run_render(
    draft_id: str,
    job: Job,
    on_stage: Callable[[Job], Awaitable[None]] | None = None,
) -> Job:
    """Retoma el MISMO Job desde donde quedó hasta el final (grabar → títulos
    por plataforma → empaquetar → publicar si se eligió), esperando turno en la
    cola global como cualquier job de /videos. `on_stage` es el callback del
    job real (job_tracker + historial + notificación), lo inyecta el router.
    Nunca lanza — un error queda en el draft."""

    async def _on_stage(j: Job) -> None:
        if j.stage != JobStage.FAILED:
            _save_job(draft_id, j)
        await _patch(draft_id, _stage_patch(j))
        if on_stage is not None:
            await on_stage(j)

    try:
        async with get_job_queue().slot(job.job_id):
            result = await pipeline.run(job, on_stage=_on_stage, resume=True)
        if result.stage in (JobStage.PACKAGED, JobStage.PUBLISHED):
            await _patch(draft_id, {**_stage_patch(result), "status": "rendered"})
        else:
            await _fail(draft_id, result)
        return result
    except Exception as exc:
        logger.exception("draft_render_crashed", draft_id=draft_id)
        failed = job.fail(f"[draft] Unexpected: {exc}")
        await _fail(draft_id, failed)
        if on_stage is not None:
            await on_stage(failed)
        return failed
    finally:
        _running.discard(draft_id)
