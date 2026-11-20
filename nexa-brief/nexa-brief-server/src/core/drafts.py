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

import asyncio
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
RecordOutput = Literal["tiktok", "instagram", "facebook", "youtube", "youtube_shorts"]

# Los destinos declaran qué versiones se preparan. No seleccionan cuentas ni
# publican por sí solos: esa decisión sigue siendo explícita en publish_accounts.
DEFAULT_RECORD_OUTPUTS: tuple[RecordOutput, ...] = (
    "tiktok", "instagram", "facebook", "youtube", "youtube_shorts",
)
RECORD_OUTPUT_FORMAT: dict[RecordOutput, RecordFormat] = {
    "tiktok": "9x16",
    "instagram": "9x16",
    "facebook": "16x9",
    "youtube": "16x9",
    "youtube_shorts": "9x16",
}

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
    render_target: Literal["local", "aws", "vps"] | None = None
    publish_accounts: list[str] = Field(default_factory=list)  # "platform:alias"
    # Destinos de salida a preparar. None conserva el contrato legacy basado en formats/cuentas.
    # Los destinos no publican: hacen falta cuentas explícitas en publish_accounts.
    outputs: list[RecordOutput] | None = None
    # Formatos legacy a grabar; outputs, cuando viene, determina los formatos nuevos.
    formats: list[RecordFormat] | None = None
    # Un formato por cuenta para clientes legacy ("platform:alias" → "16x9" | "9x16").
    account_formats: dict[str, RecordFormat] = Field(default_factory=dict)


DEFAULT_ACCOUNT_FORMAT: dict[str, RecordFormat] = {
    "youtube": "16x9", "facebook": "16x9", "instagram": "9x16", "tiktok": "9x16",
}


def effective_record_formats(options: RenderOptions) -> list[RecordFormat]:
    """Formatos únicos requeridos por los destinos; sin outputs rige el contrato legacy."""
    if options.outputs is not None:
        required = {RECORD_OUTPUT_FORMAT[output] for output in options.outputs}
        # Keep the recorder's stable master-first order in jobs and UI history.
        return [fmt for fmt in ("16x9", "9x16") if fmt in required]
    if options.formats is not None:
        return list(options.formats)
    formats = ["16x9"]
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
    # Manifest A/B, selección y URL de imagen capturada independientes por destino.
    thumbnails_by_output: dict[RecordOutput, ThumbnailSet] = Field(default_factory=dict)
    thumbnail_error: str | None = None
    # Datos que faltan por generar (IA no disponible o recursos sin ficha): bloquean publicar.
    pending: list[str] = Field(default_factory=list)
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


async def _save_job_async(draft_id: str, job: Job) -> None:
    """Guarda el Job sin bloquear el bucle: el almacén de trabajos pesa varios MB."""
    await _draft_jobs().aput(draft_id, job.model_dump(mode="json"))


def can_render(draft: Draft, job: Job | None) -> bool:
    """Se graba desde un preview listo o desde un fallo con Job sano guardado.
    `rendered` no se regraba: el video ya está en Biblioteca con ese job_id."""
    if not _has_preview_stage(job) or draft.status in _IN_FLIGHT:
        return False
    if draft.status not in ("preview_ready", "prepared") and not (draft.status == "failed" and draft.recoverable):
        return False
    if draft.template_id.startswith(("lyrics-", "promo-")):
        # En NodeMotion «listo» significa textos y capturas reales para los
        # cinco destinos, no solo que el preview haya terminado.
        if draft.status != "prepared" or draft.details is None or draft.thumbnail_error:
            return False
        from src.core.draft_thumbnails import image_path
        paths = job.artifacts.thumbnail_paths_by_output or {}
        for output in DEFAULT_RECORD_OUTPUTS:
            copy = draft.details.copies.get(output)
            manifest = draft.thumbnails
            if (copy is None or not copy.title.strip() or not copy.description.strip()
                    or manifest is None or not manifest.urls.get(manifest.selected)):
                return False
            try:
                expected = image_path(job, manifest, manifest.selected)
                actual = paths.get(output)
                if actual is None or Path(actual).resolve() != expected.resolve() or not expected.is_file():
                    return False
            except (OSError, ValueError):
                return False
    from src.core.nodemotion.promo.readiness import approved_for_recording
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
    if "thumbnails_by_output" in patch:  # una sola miniatura: no se guardan copias por plataforma
        patch = {**patch, "thumbnails_by_output": {}}
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
    await _save_job_async(draft.draft_id, job)
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


_SIN_CARGAR = object()


def _hide_missing_preview(draft: Draft, job: object = _SIN_CARGAR) -> Draft:
    """Sin preview_url si la carpeta del preview ya no existe en esta máquina.

    Pasa con datos traídos de otra máquina (output_dir es una ruta absoluta de
    allá) o si se borró output/: la web abría "Mi versión" y el modal quedaba con
    un 404 en vez de la plantilla. El registro no se toca.
    """
    if not draft.preview_url and draft.status != "failed":
        return draft
    if job is _SIN_CARGAR:
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


def _output_thumbnail_texts(
    draft: Draft,
    details: DraftDetails,
    output: RecordOutput,
    generated_texts: dict[str, str] | None,
    job: Job,
) -> dict[str, str] | None:
    if draft.template_id.startswith("promo-") and generated_texts and generated_texts.get("A") and generated_texts.get("B"):
        # En promos las miniaturas son lemas propios (A y B), no el título de publicación.
        return generated_texts
    copy = details.copies.get(output)
    if copy is None:
        return generated_texts
    title = copy.title.strip()
    if output == "youtube_shorts":
        title = __import__("re").sub(r"\s*#shorts\s*$", "", title, flags=__import__("re").I).strip()
    if not title:
        title = (generated_texts or {}).get("A", "").strip() or details.song_name.strip()
    alternate = (generated_texts or {}).get("B", "").strip()
    if not alternate or alternate == title:
        from src.core.draft_thumbnails import _alternate_title
        alternate = _alternate_title(job, details, title)
    return {"A": title[:200], "B": alternate[:200]}


def thumbnail_manifest(
    draft: Draft,
    job: Job | None,
    *,
    generated_texts: dict[str, str] | None = None,
    output: RecordOutput | None = None,
    force_refresh: bool = False,
) -> ThumbnailSet | None:
    """Hidrata un manifest A/B. El destino conserva selección propia y usa A/B global como fallback."""
    # Una sola miniatura A/B para todos los destinos: nunca copias por plataforma.
    output = None
    specific = None
    existing = draft.thumbnails
    expected_format = "16x9"
    if job is None:
        return existing
    # Las portadas verticales de Promo anteriores a esta versión mostraban
    # una etiqueta incorrecta; reconstruirlas conserva sus opciones y selección.
    from src.core.draft_thumbnails import VERSION as thumbnail_renderer_version
    stale_promo_portrait = (output is not None and expected_format == "9x16"
                            and draft.template_id.startswith("promo-")
                            and existing is not None
                            and existing.renderer_version < 30)
    stale_mono = (output is not None and draft.template_id == "promo-mono"
                  and existing is not None and existing.renderer_version < thumbnail_renderer_version)
    from src.core.draft_thumbnails import has_stale_design_defaults
    stale_design = existing is not None and has_stale_design_defaults(draft.template_id, existing)
    stale_promo_copy = False
    if existing is not None and draft.template_id.startswith("promo-"):
        from src.core.draft_thumbnails import PROMO_DESIGNS, valid_cta
        if draft.template_id in PROMO_DESIGNS:
            # Textos de marca o relleno (Nexa, suscríbete, intro, promo) guardados antes del prompt v6.
            stale_promo_copy = any(not valid_cta(getattr(existing.options.get(o), "text", "")) for o in ("A", "B") if o in existing.options)
    if (existing is not None and existing.format == expected_format and not generated_texts and not force_refresh and not stale_promo_copy and not stale_design
            and {"A", "B"} <= set(existing.options)
            and (output is None or specific is not None) and not stale_promo_portrait and not stale_mono):
        return existing
    if output is None and not generated_texts and job.artifacts.output_dir:
        from src.core.nodemotion.promo.approval_compatibility import compatible_thumbnail_manifest
        legacy = compatible_thumbnail_manifest(Path(job.artifacts.output_dir), draft.model_dump(mode="json"))
        if legacy is not None:
            return ThumbnailSet.model_validate(legacy)
    from src.core import draft_thumbnails

    details = draft.details or _fallback_thumbnail_details(job)
    # Mantener textos editados al renovar una salida ya existente.
    texts = (_output_thumbnail_texts(draft, details, output, generated_texts, job)
             if output and (specific is None or generated_texts) else generated_texts)
    options: dict[str, Any] = existing.model_dump(mode="json").get("options") if existing is not None else {}
    options = options if isinstance(options, dict) else {}
    for option, text in (texts or {}).items():
        if option in ("A", "B") and text.strip():
            previous = options.get(option) if isinstance(options.get(option), dict) else {}
            options[option] = {**previous, "text": text.strip()[:200]}
    raw = draft_thumbnails.preview_manifest(
        job, details, options=options or None, output_format=expected_format,
    )
    if not isinstance(raw, dict):
        raw = raw.model_dump(mode="json")
    raw = dict(raw)
    # Los borradores antiguos mantienen la elección global al crear su primer manifest de destino.
    raw["selected"] = existing.selected if existing is not None else "A"
    return ThumbnailSet.model_validate(raw)


def _prepare_thumbnail_manifests(draft: Draft, job: Job, generated_texts=None, *, include_default=False):
    # Resolver y verificar los mismos recursos una vez por preparación, no
    # por cada alternativa y destino. El snapshot vive solo durante esta llamada.
    from src.core.draft_thumbnail_assets import background_sources_snapshot
    with background_sources_snapshot():
        default = thumbnail_manifest(draft, job, generated_texts=generated_texts) if include_default else None
        shared = thumbnail_manifest(draft, job, generated_texts=generated_texts, force_refresh=True)
        outputs = {output: shared for output in DEFAULT_RECORD_OUTPUTS} if shared is not None else {}
    return default, outputs


async def _clear_selected_thumbnail(draft_id: str) -> None:
    """El archivo anterior no representa la opción editada que se grabará ahora."""
    job = load_job(draft_id)
    if job is not None and (job.artifacts.thumbnail_path is not None or job.artifacts.thumbnail_paths_by_output):
        await _save_job_async(draft_id, job.model_copy(update={
            "artifacts": job.artifacts.model_copy(update={
                "thumbnail_path": None, "thumbnail_paths_by_output": {},
            }),
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


async def _persist_refreshed(draft: Draft, manifest: ThumbnailSet | None) -> None:
    """Guarda en silencio la miniatura renovada por un cambio de diseño, para no rehacerla en cada consulta."""
    if manifest is None or draft.thumbnails is None or draft.thumbnails.fingerprint == manifest.fingerprint:
        return
    try:
        await _drafts().update(draft.draft_id, {"thumbnails": manifest.model_dump(mode="json")})
    except Exception:
        logger.exception("draft_thumbnail_refresh_not_saved", draft_id=draft.draft_id)


async def get(draft_id: str) -> Draft | None:
    record = _drafts().get(draft_id)
    if record is None:
        return None
    draft = await _ensure_name(_hide_missing_preview(await _recover_if_orphaned(Draft.model_validate(record))))
    job = load_job(draft_id)
    manifest = thumbnail_manifest(draft, job)
    await _persist_refreshed(draft, manifest)
    return draft.model_copy(update={"thumbnails": manifest}) if manifest is not None else draft


async def list_drafts(template_id: str | None = None) -> list[Draft]:
    """Drafts más recientes primero; `template_id` filtra por plantilla.
    Los trabajos se leen en una sola pasada: leerlos uno a uno parseaba el almacén
    entero por cada borrador y bloqueaba el bucle de eventos (~3 s por consulta)."""
    records = _drafts().list({"template_id": template_id} if template_id is not None else None)
    records.sort(key=lambda r: r.get("created_at", ""), reverse=True)
    jobs = await _draft_jobs().aall_documents()
    items = []
    for record in records:
        raw_job = jobs.get(record.get("draft_id"))
        job = Job.model_validate(raw_job) if raw_job is not None else None
        draft = await _ensure_name(_hide_missing_preview(await _recover_if_orphaned(Draft.model_validate(record)), job))
        manifest = thumbnail_manifest(draft, job)
        await _persist_refreshed(draft, manifest)
        items.append(draft.model_copy(update={"thumbnails": manifest}) if manifest is not None else draft)
    return items


async def delete(draft_id: str) -> Draft | None:
    """Borra el registro y el Job guardado. No toca output/<job_id>/: si el
    draft se grabó, ese directorio es el video de Biblioteca."""
    record = await _drafts().delete(draft_id)
    if record is None:
        return None
    await _draft_jobs().adelete(draft_id)
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
    # Ediciones manuales tampoco pueden guardar enlaces en título, descripción o comentario.
    from src.core.publication_text import strip_copies
    details = details.model_copy(update={"copies": strip_copies(details.copies)})
    _running.add(draft_id)
    await _patch(draft_id, {"status": "preparing"})
    try:
        _sync_intro(draft_id, details)
        job = load_job(draft_id)
        draft_with_details = draft.model_copy(update={"details": details})
        generated_texts = getattr(details, "_thumbnail_texts", None)
        thumbnails = thumbnail_manifest(draft_with_details, job, generated_texts=generated_texts)
        selected = getattr(details, "_thumbnail_selected", None)
        if thumbnails is not None and selected in ("A", "B"):
            thumbnails = thumbnails.model_copy(update={"selected": selected})
        await _clear_selected_thumbnail(draft_id)
        return await _patch(draft_id, {
            "details": details.model_copy(update={"edited": edited or details.edited}).model_dump(mode="json"),
            "thumbnails": thumbnails.model_dump(mode="json") if thumbnails else None,
            "thumbnail_error": None, "status": "prepared",
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
    from src.core.ai_switch import AIUnavailableError, ai_enabled
    from src.core.library import resource_curator

    # Completa en segundo plano la ficha de los recursos que usa el borrador (no bloquea la preparación).
    resource_curator.schedule_for_draft(draft)

    try:
        details = await draft_details.generate(job, draft.niche_id, seed=draft.draft_id, notes=draft.song_notes)
        _sync_intro(draft.draft_id, details)
        draft_with_details = draft.model_copy(update={"details": details})
        generated_texts = getattr(details, "_thumbnail_texts", None)
        thumbnails, _shared = await asyncio.to_thread(
            _prepare_thumbnail_manifests, draft_with_details, job, generated_texts, include_default=True,
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
        if thumbnails is not None:
            try:
                thumbnails, job = await _capture_shared_thumbnail(draft.draft_id, job, details, thumbnails)
            except Exception as exc:
                thumbnail_error = f"No se pudieron capturar miniaturas: {exc}"[:500]
                logger.exception("draft_prepare_thumbnail_capture_failed", draft_id=draft.draft_id)
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
            "pending": resource_curator.pending_resources(draft),
            "name": (stored.get("name") or "").strip() or (draft.name if draft.original else _default_name(draft, details)),
            "thumbnails": thumbnails.model_dump(mode="json") if thumbnails else None,
            "thumbnail_error": thumbnail_error,
        })
    except Exception as exc:
        if isinstance(exc, AIUnavailableError) or not ai_enabled():
            # Sin IA: textos y miniaturas quedan pendientes (no es un error) y se puede grabar.
            logger.warning("draft_prepare_pending_no_ai", draft_id=draft.draft_id)
            await _patch(draft.draft_id, {
                "status": "prepared", "errors": [],
                "pending": ["textos de publicación y miniaturas (IA no disponible)",
                            *resource_curator.pending_resources(draft)],
            })
            return
        logger.exception("draft_prepare_failed", draft_id=draft.draft_id)
        await _patch(draft.draft_id, {
            "status": "prepared" if draft.details else "preview_ready",
            "errors": [f"No se pudieron preparar los textos: {exc}"],
        })
    finally:
        _running.discard(draft.draft_id)


async def run_thumbnails(draft: Draft, job: Job) -> None:
    """Prepara previews A/B por destino y captura una sola opción elegida por salida."""
    try:
        _sync_intro(draft.draft_id, draft.details)
        details = draft.details or _fallback_thumbnail_details(job)
        _, manifests = await asyncio.to_thread(_prepare_thumbnail_manifests, draft, job)
        if not manifests:
            raise ValueError("No hay opciones de miniatura disponibles")
        from src.core import draft_thumbnails
        paths, _stats = await draft_thumbnails.capture_selected_batch(
            draft.draft_id, job, details, manifests,
        )
        shared = next(iter(manifests.values()))
        selected = shared.selected
        url = f"/api/v1/drafts/{draft.draft_id}/thumbnails/{selected}"
        prepared = shared.model_copy(update={"urls": {**shared.urls, selected: url}})
        primary = paths.get("youtube") or paths.get("youtube_shorts")
        artifacts = job.artifacts.model_copy(update={
            "thumbnail_path": primary,
            "thumbnail_paths_by_output": paths,
        })
        await _save_job_async(draft.draft_id, job.model_copy(update={"artifacts": artifacts}))
        await _patch(draft.draft_id, {
            "status": "prepared",
            "thumbnails": prepared.model_dump(mode="json"),
            "thumbnail_error": None,
        })
    except Exception as exc:
        logger.exception("draft_thumbnail_prepare_failed", draft_id=draft.draft_id)
        await _patch(draft.draft_id, {"status": "prepared", "thumbnail_error": str(exc)[:500]})
    finally:
        _running.discard(draft.draft_id)


async def select_thumbnail(
    draft: Draft, option: str, *, output: RecordOutput | None = None,
) -> Draft:
    output = None  # una sola miniatura A/B para todos los destinos
    manifest = thumbnail_manifest(draft, load_job(draft.draft_id), output=output)
    if manifest is None or option not in manifest.options:
        raise ValueError("Prepará las dos opciones antes de elegir una")
    if not manifest.options[option].text.strip():
        raise ValueError("La opción elegida no tiene texto")
    thumbnails = manifest.model_copy(update={"selected": option})
    await _clear_selected_thumbnail(draft.draft_id)
    updated = await _patch(draft.draft_id, {"thumbnails": thumbnails.model_dump(mode="json")})
    if updated is None:
        raise ValueError("El prototipo ya no existe")
    return updated


async def update_thumbnail_option(
    draft: Draft, option: str, *, text: str, design: dict[str, Any],
    output: RecordOutput | None = None,
) -> Draft:
    """Edita texto/diseño de A o B sin abrir Chromium; una sola miniatura para todos los destinos."""
    output = None
    if option not in ("A", "B"):
        raise ValueError("La opción debe ser A o B")
    job = load_job(draft.draft_id)
    if job is None:
        raise ValueError("El prototipo no tiene un Job disponible")
    manifest = thumbnail_manifest(draft, job, output=output)
    if manifest is None:
        raise ValueError("El prototipo no tiene un preview disponible")
    if option not in manifest.options:
        raise ValueError("La opción no está disponible")
    options = manifest.model_dump(mode="json").get("options", {})
    options[option] = {"text": text.strip(), "design": design}
    from src.core import draft_thumbnails
    raw = draft_thumbnails.preview_manifest(
        job, draft.details or _fallback_thumbnail_details(job), options=options,
        output_format=RECORD_OUTPUT_FORMAT[output] if output else "16x9",
    )
    if not isinstance(raw, dict):
        raw = raw.model_dump(mode="json")
    raw = dict(raw)
    raw["selected"] = manifest.selected
    updated_manifest = ThumbnailSet.model_validate(raw)
    await _clear_selected_thumbnail(draft.draft_id)
    updated = await _patch(draft.draft_id, {"thumbnails": updated_manifest.model_dump(mode="json")})
    if updated is None:
        raise ValueError("El prototipo ya no existe")
    return updated


# ── Ejecución ─────────────────────────────────────────────────────────────────

def _stage_patch(job: Job) -> dict:
    return {"stage": job.stage.value, "errors": job.errors}


async def _on_preview_stage(draft_id: str, job: Job) -> None:
    if job.stage != JobStage.FAILED:
        await _save_job_async(draft_id, job)
    await _patch(draft_id, _stage_patch(job))


async def run_preview(draft_id: str, job: Job) -> Job:
    """Corre el Job del draft hasta HTML_GENERATED (igual que el preview de
    plantillas, sin cola: no graba). Nunca lanza — un error queda en el draft."""
    from src.core.ai_switch import ai_preview
    token = ai_preview.set(True)  # vista previa: ningún agente se llama
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
        ai_preview.reset(token)
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
    from src.core.nodemotion.promo.prompts import TEMPLATES
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
    await _save_job_async(draft_id, job)
    draft = await _patch(draft_id, {
        "status": "rendering", "job_id": job.job_id, "recoverable": False, "errors": [],
    })
    if draft is None:
        _running.discard(draft_id)
    return draft


async def _capture_shared_thumbnail(draft_id: str, job: Job, details: DraftDetails, manifest: ThumbnailSet) -> tuple[ThumbnailSet, Job]:
    """Una sola miniatura A/B para todos los destinos: una captura de la opción elegida, la misma imagen en cada salida."""
    from src.core import draft_thumbnails
    paths, _stats = await draft_thumbnails.capture_selected_batch(
        draft_id, job, details, {output: manifest for output in DEFAULT_RECORD_OUTPUTS},
    )
    selected = manifest.selected
    # La huella guardada debe ser la de la imagen capturada, o el sistema no la reconoce.
    fingerprint = draft_thumbnails.preview_manifest(job, details, manifest.model_dump(mode="json").get("options"), manifest.format)["fingerprint"]
    shared = manifest.model_copy(update={"fingerprint": fingerprint, "urls": {**manifest.urls, selected: f"/api/v1/drafts/{draft_id}/thumbnails/{selected}"}})
    primary = paths.get("youtube") or job.artifacts.thumbnail_path
    job = job.model_copy(update={"artifacts": job.artifacts.model_copy(update={
        "thumbnail_path": primary,
        "thumbnail_paths_by_output": {**job.artifacts.thumbnail_paths_by_output, **paths},
    })})
    await _save_job_async(draft_id, job)
    return shared, job


async def _capture_selected_thumbnail(
    draft_id: str, job: Job, outputs: list[RecordOutput] | None = None,
) -> Job:
    """Asegura capturas de las elecciones persistidas antes del primer frame grabado."""
    draft = await get(draft_id)
    if draft is None:
        raise ValueError("El prototipo dejó de existir antes de grabar")
    from src.core.nodemotion.service import load_project
    has_project = bool(job.artifacts.output_dir and load_project(Path(job.artifacts.output_dir)))
    if draft.details is None and not has_project and (job.artifacts.html_path is None or not job.artifacts.html_path.is_file()):
        stored = _drafts().get(draft_id) or {}
        stored_thumbnails = stored.get("thumbnails") or {}
        if not (stored_thumbnails.get("options") if isinstance(stored_thumbnails, dict) else None):
            return job

    details = draft.details or _fallback_thumbnail_details(job)
    from src.core import draft_details, draft_thumbnails
    manifest = thumbnail_manifest(draft, job)
    if manifest is None:
        if draft.details is None:
            return job  # Legacy auto_render drafts keep their pre-thumbnail behavior.
        raise ValueError("No se pudo preparar el manifest de miniaturas")
    selected = manifest.selected or "A"
    option = manifest.options.get(selected)
    if option is None or not option.text.strip():
        raise ValueError(f"No se pudo obtener el texto de la opción {selected}")
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
    job = job.model_copy(update={"artifacts": job.artifacts.model_copy(update={
        "thumbnail_path": Path(image),
        "thumbnail_paths_by_output": {output: Path(image) for output in DEFAULT_RECORD_OUTPUTS},
    })})
    await _save_job_async(draft_id, job)
    selected = manifest.selected or "A"
    fingerprint = draft_thumbnails.preview_manifest(job, details, manifest.model_dump(mode="json").get("options"), manifest.format)["fingerprint"]
    shared = manifest.model_copy(update={"fingerprint": fingerprint, "urls": {**manifest.urls, selected: f"/api/v1/drafts/{draft_id}/thumbnails/{selected}"}})
    await _patch(draft_id, {"thumbnails": shared.model_dump(mode="json")})
    return job


async def run_render(
    draft_id: str,
    job: Job,
    on_stage: Callable[[Job], Awaitable[None]] | None = None,
    outputs: list[RecordOutput] | None = None,
) -> Job:
    """Retoma el MISMO Job desde donde quedó hasta el final (grabar → títulos
    por plataforma → empaquetar → publicar si se eligió), esperando turno en la
    cola global como cualquier job de /videos. `on_stage` es el callback del
    job real (job_tracker + historial + notificación), lo inyecta el router.
    Nunca lanza — un error queda en el draft."""

    async def _on_stage(j: Job) -> None:
        if j.stage != JobStage.FAILED:
            await _save_job_async(draft_id, j)
        await _patch(draft_id, _stage_patch(j))
        if on_stage is not None:
            await on_stage(j)

    try:
        async with get_job_queue().slot(job.job_id):
            if outputs is None:
                job = await _capture_selected_thumbnail(draft_id, job)
            else:
                job = await _capture_selected_thumbnail(draft_id, job, outputs)
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
