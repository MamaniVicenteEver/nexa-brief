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
from typing import Any, Literal

import structlog
from pydantic import BaseModel, Field

from src.core import pipeline
from src.core.data import collection, documents
from src.core.draft_details import DraftDetails, to_summary
from src.core.draft_thumbnails import ThumbnailSet
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

    recorder_engine: Literal["playwright", "hyperframes", "remotion"] | None = None
    background_opacity: float | None = Field(default=None, ge=0, le=1, allow_inf_nan=False)
    render_target: Literal["local", "aws"] | None = None
    publish_accounts: list[str] = Field(default_factory=list)  # "platform:alias"
    # Formatos a grabar (None = los del nicho). 16:9 va siempre: es el archivo principal del grabador.
    formats: list[RecordFormat] | None = None
    # Un formato por cuenta ("platform:alias" → "16x9" | "9x16"); sin entrada, el de su red.
    account_formats: dict[str, RecordFormat] = Field(default_factory=dict)


DEFAULT_ACCOUNT_FORMAT: dict[str, RecordFormat] = {
    "youtube": "16x9", "facebook": "16x9", "instagram": "9x16", "tiktok": "9x16",
}


def effective_record_formats(options: RenderOptions) -> list[RecordFormat]:
    """One list used for both recording and account publication."""
    if options.formats is not None:
        return list(options.formats)
    formats: list[RecordFormat] = ["16x9"]
    for selector in options.publish_accounts:
        platform = selector.split(":", 1)[0]
        chosen = "16x9" if platform == "youtube" else (
            options.account_formats.get(selector) or DEFAULT_ACCOUNT_FORMAT.get(platform, "16x9")
        )
        if chosen not in formats:
            formats.append(chosen)
    return formats


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
    thumbnails: ThumbnailSet | None = None
    thumbnail_error: str | None = None
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
    if not _has_preview_stage(job) or draft.status in _IN_FLIGHT:
        return False
    if draft.status not in ("preview_ready", "prepared") and not (draft.status == "failed" and draft.recoverable):
        return False
    from src.core.promos.readiness import approved_for_recording
    return approved_for_recording(draft)


def can_prepare(draft: Draft, job: Job | None) -> bool:
    """Preparar (o volver a preparar) los textos: con el preview listo y sin nada corriendo."""
    return _has_preview_stage(job) and (draft.status in ("preview_ready", "prepared") or
                                      (draft.status == "failed" and draft.recoverable))


def _has_preview_stage(job: Job | None) -> bool:
    return job is not None and job.stage in {
        JobStage.HTML_GENERATED, JobStage.VIDEO_RECORDED,
        JobStage.SUMMARY_GENERATED, JobStage.PACKAGED,
    }


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
        "recoverable": _has_preview_stage(job),
    })
    return recovered or draft


def _hide_missing_preview(draft: Draft) -> Draft:
    """Sin preview_url si la carpeta del preview ya no existe en esta máquina.

    Pasa con datos traídos de otra máquina (output_dir es una ruta absoluta de
    allá) o si se borró output/: la web abría "Mi versión" y el modal quedaba con
    un 404 en vez de la plantilla. El registro no se toca.
    """
    if not draft.preview_url and draft.status != "failed":
        return draft
    job = load_job(draft.draft_id)
    if draft.status == "failed" and draft.recoverable and not _has_preview_stage(job):
        draft = draft.model_copy(update={"recoverable": False})
    output_dir = job.artifacts.output_dir if job is not None else None
    if output_dir is not None and not Path(output_dir).is_dir():
        return draft.model_copy(update={"preview_url": None})
    return draft


def _fallback_thumbnail_details(job: Job) -> DraftDetails:
    """Datos de título para drafts antiguos que aún no tenían `details`."""
    from src.core.draft_details import song_of

    song, artist = song_of(job)
    return DraftDetails(song_name=song, artist=artist)


def thumbnail_manifest(
    draft: Draft,
    job: Job | None,
    *,
    generated_texts: dict[str, str] | None = None,
) -> ThumbnailSet | None:
    """Hidrata A/B como JSON solamente. No abre navegador ni captura imágenes."""
    if job is None:
        return draft.thumbnails
    from src.core import draft_thumbnails

    details = draft.details or _fallback_thumbnail_details(job)
    existing = draft.thumbnails
    options: dict[str, Any] = {}
    if existing is not None:
        options = existing.model_dump(mode="json").get("options") or {}
    for option, text in (generated_texts or {}).items():
        if option in ("A", "B") and text.strip():
            previous = options.get(option) if isinstance(options.get(option), dict) else {}
            options[option] = {**previous, "text": text.strip()[:200]}
    raw = draft_thumbnails.preview_manifest(job, details, options=options or None)
    if not isinstance(raw, dict):
        raw = raw.model_dump(mode="json")
    raw = dict(raw)
    # Un draft legacy sin selección empieza por A; la elección previa se conserva.
    raw["selected"] = existing.selected if existing is not None else "A"
    return ThumbnailSet.model_validate(raw)


def _clear_selected_thumbnail(draft_id: str) -> None:
    """El archivo anterior no representa la opción editada que se grabará ahora."""
    job = load_job(draft_id)
    if job is not None and job.artifacts.thumbnail_path is not None:
        _save_job(draft_id, job.model_copy(update={
            "artifacts": job.artifacts.model_copy(update={"thumbnail_path": None}),
        }))


def _default_name(draft: Draft, details: DraftDetails | None = None) -> str:
    details = details or draft.details
    if details and details.song_name.strip():
        return details.song_name.strip()[:120]
    if draft.inputs.music_asset_id:
        from src.core.library.asset_library import AssetNotFoundError, get_music_entry
        try:
            title = get_music_entry(draft.inputs.music_asset_id).title.strip()
            if title:
                return title[:120]
        except (AssetNotFoundError, KeyError, ValueError, FileNotFoundError):
            pass
    records = _drafts().list({"template_id": draft.template_id})
    records.sort(key=lambda record: (record.get("created_at", ""), record.get("draft_id", "")))
    number = next((i for i, record in enumerate(records, 1) if record.get("draft_id") == draft.draft_id), 1)
    return f"Prototipo {number}"


async def _ensure_name(draft: Draft) -> Draft:
    if not draft.original and not draft.name.strip() and (draft.status in ("prepared", "rendering", "rendered") or (draft.status == "failed" and draft.recoverable)):
        return await _patch(draft.draft_id, {"name": _default_name(draft)}) or draft
    return draft


async def get(draft_id: str) -> Draft | None:
    record = _drafts().get(draft_id)
    if record is None:
        return None
    draft = await _ensure_name(_hide_missing_preview(await _recover_if_orphaned(Draft.model_validate(record))))
    manifest = thumbnail_manifest(draft, load_job(draft_id))
    return draft.model_copy(update={"thumbnails": manifest}) if manifest is not None else draft


async def list_drafts(template_id: str | None = None) -> list[Draft]:
    """Drafts más recientes primero; `template_id` filtra por plantilla."""
    records = _drafts().list({"template_id": template_id} if template_id is not None else None)
    records.sort(key=lambda r: r.get("created_at", ""), reverse=True)
    items = []
    for record in records:
        draft = await _ensure_name(_hide_missing_preview(await _recover_if_orphaned(Draft.model_validate(record))))
        manifest = thumbnail_manifest(draft, load_job(draft.draft_id))
        items.append(draft.model_copy(update={"thumbnails": manifest}) if manifest is not None else draft)
    return items


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
        draft_details.apply_to_intro(job.artifacts.content_dir, details)


async def save_details(draft_id: str, details: DraftDetails, *, edited: bool = True, capture_thumbnails: bool = False) -> Draft | None:
    """Guarda los detalles y asegura el manifest JSON, sin capturar miniaturas."""
    draft = await get(draft_id)
    if draft is None:
        return None
    _running.add(draft_id)
    await _patch(draft_id, {"status": "preparing"})
    try:
        _sync_intro(draft_id, details)
        job = load_job(draft_id)
        thumbnails = thumbnail_manifest(
            draft.model_copy(update={"details": details}), job,
            generated_texts=getattr(details, "_thumbnail_texts", None),
        )
        selected = getattr(details, "_thumbnail_selected", None)
        if thumbnails is not None and selected in ("A", "B"):
            thumbnails = thumbnails.model_copy(update={"selected": selected})
        _clear_selected_thumbnail(draft_id)
        error = None
        return await _patch(draft_id, {
            "details": details.model_copy(update={"edited": edited or details.edited}).model_dump(mode="json"),
            "thumbnails": thumbnails.model_dump(mode="json") if thumbnails else None,
            "thumbnail_error": error, "status": "prepared",
            "name": draft.name if draft.name.strip() or draft.original else _default_name(draft, details),
        })
    finally:
        _running.discard(draft_id)


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
        thumbnails = thumbnail_manifest(
            draft.model_copy(update={"details": details}), job,
            generated_texts=getattr(details, "_thumbnail_texts", None),
        )
        # Only an automatic run may use the AI choice. A selection already
        # persisted by the user always takes precedence over that suggestion.
        stored = _drafts().get(draft.draft_id) or {}
        stored_thumbnails = stored.get("thumbnails")
        previously_selected = isinstance(stored_thumbnails, dict) and stored_thumbnails.get("selected") in ("A", "B")
        suggested = getattr(details, "_thumbnail_selected", None)
        if (draft.auto_render is not None and not previously_selected and thumbnails is not None
                and suggested in ("A", "B")):
            thumbnails = thumbnails.model_copy(update={"selected": suggested})
        thumbnail_error = None
        if job.artifacts.output_dir is not None:
            logs_dir = job.artifacts.log_dir or job.artifacts.output_dir / "logs"
            logs_dir.mkdir(parents=True, exist_ok=True)
            (logs_dir / "08_prepared_details.json").write_text(details.model_dump_json(indent=2), encoding="utf-8")
            from src.config.profile_layout import layout_for_settings
            from src.config.settings import settings
            if layout_for_settings(settings).schema_version >= 2:
                from src.core.content_registry import update_video_details
                await update_video_details(job.job_id, {"summary": to_summary(details).model_dump(mode="json")})
                await pipeline._index_job_logs(job)
        await _patch(draft.draft_id, {
            "status": "prepared", "details": details.model_dump(mode="json"), "errors": [],
            "name": (stored.get("name") or "").strip() or (draft.name if draft.original else _default_name(draft, details)),
            "thumbnails": thumbnails.model_dump(mode="json") if thumbnails else None,
            "thumbnail_error": thumbnail_error,
        })
    except Exception as exc:
        logger.exception("draft_prepare_failed", draft_id=draft.draft_id)
        await _patch(draft.draft_id, {
            "status": "prepared" if draft.details else "preview_ready",
            "errors": [f"No se pudieron preparar los textos: {exc}"],
        })
    finally:
        _running.discard(draft.draft_id)


async def run_thumbnails(draft: Draft, job: Job) -> None:
    """Compatibilidad del antiguo endpoint: actualiza solo el manifest JSON."""
    try:
        _sync_intro(draft.draft_id, draft.details)
        thumbnails = thumbnail_manifest(draft, job)
        await _patch(draft.draft_id, {
            "status": "prepared", "thumbnails": thumbnails.model_dump(mode="json") if thumbnails else None,
            "thumbnail_error": None,
        })
    finally:
        _running.discard(draft.draft_id)


async def select_thumbnail(draft: Draft, option: str) -> Draft:
    manifest = thumbnail_manifest(draft, load_job(draft.draft_id))
    if manifest is None or option not in manifest.options:
        raise ValueError("Prepará las dos opciones antes de elegir una")
    if not manifest.options[option].text.strip():
        raise ValueError("La opción elegida no tiene texto")
    thumbnails = manifest.model_copy(update={"selected": option})
    _clear_selected_thumbnail(draft.draft_id)
    return await _patch(draft.draft_id, {"thumbnails": thumbnails.model_dump(mode="json")})


async def update_thumbnail_option(
    draft: Draft, option: str, *, text: str, design: dict[str, Any],
) -> Draft:
    """Edita una opción del manifest; cambiar texto/diseño no abre Chromium."""
    if option not in ("A", "B"):
        raise ValueError("La opción debe ser A o B")
    job = load_job(draft.draft_id)
    if job is None:
        raise ValueError("El prototipo no tiene un Job disponible")
    manifest = thumbnail_manifest(draft, job)
    if manifest is None:
        raise ValueError("El prototipo no tiene un preview disponible")
    if option not in manifest.options:
        raise ValueError("La opción no está disponible")
    options = manifest.model_dump(mode="json").get("options", {})
    options[option] = {"text": text.strip(), "design": design}
    from src.core import draft_thumbnails
    raw = draft_thumbnails.preview_manifest(
        job, draft.details or _fallback_thumbnail_details(job), options=options,
    )
    if not isinstance(raw, dict):
        raw = raw.model_dump(mode="json")
    raw = dict(raw)
    raw["selected"] = manifest.selected
    updated_manifest = ThumbnailSet.model_validate(raw)
    _clear_selected_thumbnail(draft.draft_id)
    updated = await _patch(draft.draft_id, {"thumbnails": updated_manifest.model_dump(mode="json")})
    if updated is None:
        raise ValueError("El prototipo ya no existe")
    return updated


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
        "recoverable": _has_preview_stage(saved),
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
        "formats": effective_record_formats(options),
    })})
    if details is not None and details.copies:
        artifacts = job.artifacts.model_copy(update={"summary": to_summary(details)})
        job = job.model_copy(update={"artifacts": artifacts})
    return job


async def start_render(draft_id: str, job: Job) -> Draft | None:
    """Pasa el draft a `rendering` con el job_id que va a aparecer en
    Biblioteca. El caller lanza `run_render` enseguida."""
    current = await get(draft_id)
    from src.core.promo_prompts import TEMPLATES
    if current is not None and current.template_id in TEMPLATES:
        from src.core.data import collection, coordination
        if current.original:
            # La demo no tiene sesión de revisión: protege la transición y
            # comprueba de nuevo el preview y la preparación antes de grabar.
            async with coordination('promo-original-' + draft_id):
                current = await get(draft_id)
                if current is None or not current.original or not can_render(current, job):
                    return None
                return await _mark_rendering(draft_id, job)
        session = next((row for row in collection('promo_chat_sessions').list(where={'template_id':current.template_id})
                        if row.get('draft_id') == draft_id), None)
        if session is None:
            return None
        # Correcciones y aprobación usan este mismo lock: no puede revocarse la
        # revisión entre la comprobación final y la transición a rendering.
        async with coordination('promo-chat-' + session['session_id']):
            current = await get(draft_id)
            if current is None or not can_render(current, job):
                return None
            return await _mark_rendering(draft_id,job)
    return await _mark_rendering(draft_id,job)


async def _mark_rendering(draft_id: str, job: Job) -> Draft | None:
    _running.add(draft_id)
    _save_job(draft_id, job)
    draft = await _patch(draft_id, {
        "status": "rendering", "job_id": job.job_id, "recoverable": False, "errors": [],
    })
    if draft is None:
        _running.discard(draft_id)
    return draft


async def _capture_selected_thumbnail(draft_id: str, job: Job) -> Job:
    """Capture the persisted A/B choice only after the job owns the render queue slot."""
    draft = await get(draft_id)
    if draft is None:
        raise ValueError("El prototipo dejó de existir antes de grabar")
    # One-step/legacy render jobs can reach this path without prepared details
    # or a thumbnail manifest. Keep that flow working when no preview artifact
    # exists; real prepared drafts with a chosen option must capture or fail.
    if draft.details is None and (job.artifacts.html_path is None or not job.artifacts.html_path.is_file()):
        stored = _drafts().get(draft_id) or {}
        stored_thumbnails = stored.get("thumbnails") or {}
        if not (stored_thumbnails.get("options") if isinstance(stored_thumbnails, dict) else None):
            return job
    manifest = thumbnail_manifest(draft, job)
    if manifest is None:
        if draft.details is None:
            return job  # Legacy auto_render drafts keep their pre-thumbnail behavior.
        raise ValueError("No se pudo preparar el manifest de miniaturas")
    selected = manifest.selected or "A"
    option = manifest.options.get(selected)
    if option is None or not option.text.strip():
        raise ValueError(f"No se pudo obtener el texto de la opción {selected}")

    details = draft.details or _fallback_thumbnail_details(job)
    from src.core import draft_details, draft_thumbnails
    # B puede ser una frase de la letra; conserva el nombre real en la intro.
    intro_details = details if selected == "B" or draft.template_id == "lyrics-impact" else details.model_copy(update={"song_name": option.text})
    draft_details.apply_to_intro(job.artifacts.content_dir, intro_details)
    try:
        image = await draft_thumbnails.capture_selected(
            draft_id, job, details, selected, options=manifest.model_dump(mode="json").get("options"),
        )
    except Exception as exc:
        raise ValueError(f"Falló la captura de la opción {selected}: {exc}") from exc
    if image is None or not Path(image).is_file():
        raise ValueError(f"La captura de la opción {selected} no produjo una miniatura")
    job = job.model_copy(update={"artifacts": job.artifacts.model_copy(update={"thumbnail_path": Path(image)})})
    _save_job(draft_id, job)
    # Persiste la hidratación de drafts antiguos junto a la elección utilizada.
    await _patch(draft_id, {"thumbnails": manifest.model_dump(mode="json")})
    return job


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
            job = await _capture_selected_thumbnail(draft_id, job)
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
