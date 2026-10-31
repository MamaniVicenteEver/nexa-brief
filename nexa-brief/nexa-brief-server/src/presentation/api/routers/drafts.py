"""Drafts router — preview persistido de una plantilla + "Grabar" sobre el mismo job.

  POST   /drafts                         crea el draft y corre hasta HTML_GENERATED
  GET    /drafts?template_id=            lista (más recientes primero)
  GET    /drafts/{id}                    estado
  DELETE /drafts/{id}                    borra (409 si está corriendo)
  POST   /templates/{id}/original-draft  «Video original»: la plantilla tal cual (crea o reutiliza)
  PATCH  /drafts/{id}                    renombra el prototipo
  POST   /drafts/{id}/prepare            genera los textos de publicación (detalles)
  PUT    /drafts/{id}/details            guarda los detalles editados
  POST   /drafts/{id}/render             retoma el MISMO job hasta el final (y publica por la cola)
  GET    /drafts/{id}/preview/{path}     HTML/assets del draft, con los scripts de preview

La lógica de estado vive en `src/core/drafts.py`; acá solo se valida, se
compone con las piezas de /videos (validaciones, job_tracker, historial,
notificación vía `videos._on_stage`) y se lanzan las tasks de background.
"""

from __future__ import annotations

import asyncio
import mimetypes
from pathlib import Path

import structlog
from fastapi import APIRouter, HTTPException, Request
from starlette.responses import Response

from src.config.niche_config import NicheConfig, find_niche_by_template_id, get_niche_config
from src.core import draft_publishing, drafts, job_tracker, template_original
from src.modules.copy_writer import copy_profile
from src.core.drafts import Draft, DraftInputs, RenderOptions
from src.core.job import DurationConfig, DurationMode, Job, JobPublishingConfig, JobStage, SongInfo
from src.core.orchestrator import Orchestrator
from src.presentation.api.file_streaming import serve_file_with_range
from src.presentation.api.preview_injection import inject_preview_scripts, version_local_assets
from src.presentation.api.preview_media import media_for_request, preview_config_json
from src.presentation.api.resource_sources import (
    resolve_image_source,
    resolve_music_source,
    resolve_video_source,
)
from src.presentation.api.routers.videos import (
    _check_background_capacity,
    _on_stage as _job_on_stage,
    _validate_publishing,
    _validate_recorder_engine_override,
)
from src.presentation.api.schemas.draft_schema import (
    DraftCreateRequest,
    DraftDetailsRequest,
    DraftListResponse,
    DraftPrepareRequest,
    DraftRenderAcceptedResponse,
    DraftRenderRequest,
    DraftResponse,
    DraftUpdateRequest,
)

router = APIRouter(tags=["drafts"])
logger = structlog.get_logger(__name__)

# Mismo motivo que en videos.py: asyncio.create_task no retiene la Task.
_draft_tasks: set[asyncio.Task] = set()

# Lo que el preview puede pedir del output del job: el HTML y los medios que
# referencia. logs/ queda afuera (prompts, respuestas de la IA, stats).
_PREVIEW_SUFFIXES = {
    ".html", ".json", ".mp3", ".wav", ".m4a", ".mp4", ".webm", ".mov", ".jpg", ".jpeg",
    ".png", ".webp", ".gif", ".svg", ".woff", ".woff2", ".ttf", ".otf", ".css", ".js",
}
_PREVIEW_BLOCKED_DIRS = {"logs"}


def _spawn(coro) -> None:
    task = asyncio.create_task(coro)
    _draft_tasks.add(task)

    def _done(t: asyncio.Task) -> None:
        _draft_tasks.discard(t)
        if not t.cancelled() and t.exception() is not None:
            logger.error("draft_task_failed", error=str(t.exception()))

    task.add_done_callback(_done)


async def _validate_render_options(niche_cfg: NicheConfig, options: RenderOptions) -> None:
    """Mismas validaciones que POST /videos: rechazar con 400/401 antes de
    gastar un grabado que iba a fallar recién en video_recorder o Stage 9."""
    _validate_recorder_engine_override(
        niche_cfg, niche_cfg.id, options.recorder_engine, options.render_target
    )
    await _validate_publishing(JobPublishingConfig(
        enabled=bool(options.publish_accounts), accounts=list(options.publish_accounts),
    ))
    if options.formats is not None and "16x9" not in options.formats:
        # el grabador siempre produce el 16:9 (es su archivo principal); el 9:16 se suma
        raise HTTPException(status_code=400, detail="formats debe incluir '16x9'")
    if options.formats and "9x16" in options.formats and not niche_cfg.has_reels_format():
        raise HTTPException(status_code=400, detail="Esta plantilla no graba en 9:16")


async def _render_then_publish(draft_id: str, job: Job, options: RenderOptions) -> None:
    result = await drafts.run_render(draft_id, job, on_stage=_job_on_stage)
    if result.stage in (JobStage.PACKAGED, JobStage.PUBLISHED):
        await draft_publishing.publish_rendered(result.job_id, options)


async def _start_render(draft: Draft, job: Job, options: RenderOptions) -> str:
    """Registra el job en job_tracker (así aparece en Biblioteca con
    generation_seconds, historial y notificación igual que /videos) y lanza
    el grabado en background. Devuelve el job_id."""
    niche_cfg = get_niche_config(draft.niche_id)
    job = drafts.apply_render_options(job, options, draft.details)
    # Un reintento tras un fallo reusa el registro existente (mismo job_id).
    if job_tracker.get(job.job_id) is None:
        await job_tracker.create(job, niche_cfg)
    if await drafts.start_render(draft.draft_id, job) is None:
        raise HTTPException(status_code=404, detail=f"Draft '{draft.draft_id}' not found")
    _spawn(_render_then_publish(draft.draft_id, job, options))
    return job.job_id


def _export_original(draft: Draft | None) -> None:
    """Los textos del original quedan en el publish.json de la plantilla."""
    if draft is not None and draft.original and draft.details is not None:
        niche = find_niche_by_template_id(draft.template_id)
        template_original.write_publish(draft.template_id, draft.details, copy_profile(niche) if niche else None)


async def _prepare_original(draft: Draft, job: Job) -> None:
    """El original se prepara solo: toma los textos del publish.json de la plantilla, o los del
    original anterior, o los genera con las estrategias (y quedan en el publish.json)."""
    # con información de la canción se escribe de nuevo; si no, lo guardado de la plantilla
    saved = None if draft.song_notes else template_original.read_publish(draft.template_id)
    previous = saved or next(
        (d.details for d in await drafts.list_drafts(draft.template_id)
         if d.original and d.details and d.draft_id != draft.draft_id),
        None,
    )
    if draft.song_notes:
        previous = None
    if previous is not None:
        await drafts.save_details(draft.draft_id, previous, edited=False)
        return
    started = await drafts.start_prepare(draft.draft_id)
    if started is not None:
        await drafts.run_prepare(started, job)
        _export_original(await drafts.get(draft.draft_id))


async def _preview_then_maybe_render(draft: Draft, job: Job) -> None:
    result = await drafts.run_preview(draft.draft_id, job)
    if draft.auto_render is None and not draft.original:
        return
    current = await drafts.get(draft.draft_id)
    if current is None or current.status != "preview_ready":
        return  # el preview falló (queda en el draft) o lo borraron mientras corría
    if draft.original:
        await _prepare_original(current, result)
        return
    await _start_render(current, result, draft.auto_render)


@router.post("/drafts", response_model=DraftResponse, status_code=202)
async def create_draft(request: DraftCreateRequest) -> DraftResponse:
    """Crea el draft y corre el pipeline hasta HTML_GENERATED en background.

    Con `auto_render`, al quedar listo el preview se graba solo (Crear video
    en un paso). Responde al instante; el progreso llega por GET o por el
    evento realtime `draft_changed`."""
    return await _create_draft(request)


@router.post("/templates/{template_id}/original-draft", response_model=DraftResponse, status_code=202)
async def original_draft(template_id: str, request: DraftPrepareRequest | None = None) -> DraftResponse:
    """«Video original»: la plantilla con su propia canción, letra y fondo, lista para grabar.

    Reutiliza el original vigente (no grabado); si no hay, importa los medios de la plantilla
    (una sola vez) y crea uno nuevo que se previsualiza y se prepara solo."""
    niche = find_niche_by_template_id(template_id)
    if niche is None:
        raise HTTPException(status_code=404, detail=f"Template '{template_id}' not found")
    notes = (request.song_notes or "").strip() if request else ""
    for existing in await drafts.list_drafts(template_id):
        if not existing.original or existing.status == "rendered":
            continue
        if existing.status == "failed" and existing.details is None:
            # falló antes de tener textos (p. ej. la IA no respondió): se reemplaza por uno nuevo
            if not drafts.is_running(existing.draft_id):
                await drafts.delete(existing.draft_id)
            continue
        job = drafts.load_job(existing.draft_id)
        # sin textos (p. ej. la preparación se cortó por un reinicio) y la plantilla ya los tiene
        # guardados en su publish.json: se recuperan de ahí, sin volver a la IA
        saved = template_original.read_publish(template_id) if not notes and existing.details is None else None
        if saved is not None and existing.status == "preview_ready":
            return await drafts.save_details(existing.draft_id, saved, edited=False) or existing
        # sin textos todavía (la preparación falló) o con información nueva de la canción: se prepara
        if drafts.can_prepare(existing, job) and (notes or existing.details is None):
            started = await drafts.start_prepare(existing.draft_id, notes or None)
            if started is not None:
                _spawn(_prepare_and_export(started, job))
                return started
        return existing
    try:
        assets = await template_original.ensure_assets(template_id, niche)
    except template_original.OriginalUnavailable as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    # La intro de la plantilla dice la canción: con artista es un dato (SongInfo); sin artista puede
    # ser un título decorativo, así que va como pista editable en «Información de la canción».
    song_info = None
    title, artist = template_original.intro_identity(template_id)
    if title and artist and niche.template.requires_lyrics and copy_profile(niche) is None:
        song_info = SongInfo(song_name=title, artist=artist)
    elif title and not notes and copy_profile(niche) is None:
        notes = f"La tarjeta de intro del video muestra «{title}» (puede ser el nombre de la canción o solo un título)."
    return await _create_draft(
        DraftCreateRequest(
            template_id=template_id,
            name="Video original",
            music_asset_id=assets.music_asset_id,
            image_asset_id=assets.image_asset_id,
            video_asset_id=assets.video_asset_id,
            song_info=song_info,
        ),
        original=True,
        song_notes=notes,
    )


async def _create_draft(request: DraftCreateRequest, *, original: bool = False, song_notes: str = "") -> DraftResponse:
    niche = find_niche_by_template_id(request.template_id)
    if niche is None:
        raise HTTPException(status_code=404, detail=f"Template '{request.template_id}' not found")
    if request.auto_render is not None:
        await _validate_render_options(niche, request.auto_render)
        _check_background_capacity(1)

    # Los resolvedores validan el asset_id (400 si no existe) y arman la
    # fuente LIBRARY; sin asset_id quedan en AUTO (o sin video).
    image_source = await resolve_image_source(niche, niche.id, None, request.image_asset_id)
    music_source = await resolve_music_source(niche, niche.id, None, request.music_asset_id, None, None)
    video_source = await resolve_video_source(niche.id, None, request.video_asset_id)

    job = Orchestrator().build_jobs(
        category_name=niche.id,
        quantity=1,
        user_context=request.user_context,
        image_source=image_source,
        music_source=music_source,
        video_source=video_source,
        song_info=request.song_info,
        # Igual que /videos/upload: la duración es la de la canción real.
        duration_config=DurationConfig(mode=DurationMode.AUTO, repeat_count=1),
    )[0]
    if request.template_inputs is not None:
        job = job.model_copy(update={
            "input": job.input.model_copy(update={"template_inputs": request.template_inputs}),
        })

    draft = await drafts.create(
        template_id=request.template_id,
        niche_id=niche.id,
        inputs=DraftInputs(
            music_asset_id=request.music_asset_id,
            image_asset_id=request.image_asset_id,
            video_asset_id=request.video_asset_id,
            template_inputs=request.template_inputs,
            song_info=request.song_info,
            user_context=request.user_context,
        ),
        job=job,
        auto_render=request.auto_render,
        name=request.name,
        original=original,
        song_notes=song_notes,
    )
    logger.info(
        "draft_created",
        draft_id=draft.draft_id,
        template_id=request.template_id,
        auto_render=request.auto_render is not None,
    )
    _spawn(_preview_then_maybe_render(draft, job))
    return draft


@router.get("/drafts", response_model=DraftListResponse)
async def list_drafts(template_id: str | None = None) -> DraftListResponse:
    items = await drafts.list_drafts(template_id)
    return DraftListResponse(total=len(items), drafts=items)


@router.get("/drafts/{draft_id}", response_model=DraftResponse)
async def get_draft(draft_id: str) -> DraftResponse:
    draft = await drafts.get(draft_id)
    if draft is None:
        raise HTTPException(status_code=404, detail=f"Draft '{draft_id}' not found")
    return draft


@router.delete("/drafts/{draft_id}", response_model=DraftResponse)
async def delete_draft(draft_id: str) -> DraftResponse:
    draft = await drafts.get(draft_id)
    if draft is None:
        raise HTTPException(status_code=404, detail=f"Draft '{draft_id}' not found")
    if drafts.is_running(draft_id):
        raise HTTPException(status_code=409, detail=f"Draft '{draft_id}' is still {draft.status}")
    deleted = await drafts.delete(draft_id)
    if deleted is None:
        raise HTTPException(status_code=404, detail=f"Draft '{draft_id}' not found")
    return deleted


async def _get_or_404(draft_id: str) -> Draft:
    draft = await drafts.get(draft_id)
    if draft is None:
        raise HTTPException(status_code=404, detail=f"Draft '{draft_id}' not found")
    return draft


@router.patch("/drafts/{draft_id}", response_model=DraftResponse)
async def update_draft(draft_id: str, request: DraftUpdateRequest) -> DraftResponse:
    await _get_or_404(draft_id)
    updated = await drafts.rename(draft_id, request.name)
    if updated is None:
        raise HTTPException(status_code=404, detail=f"Draft '{draft_id}' not found")
    return updated


@router.post("/drafts/{draft_id}/prepare", response_model=DraftResponse, status_code=202)
async def prepare_draft(draft_id: str, request: DraftPrepareRequest | None = None) -> DraftResponse:
    """Genera los textos de publicación (canción, títulos, descripciones y etiquetas por red)
    sobre el preview listo. Responde al instante; el resultado llega por `draft_changed`."""
    draft = await _get_or_404(draft_id)
    job = drafts.load_job(draft_id)
    if not drafts.can_prepare(draft, job):
        raise HTTPException(status_code=409, detail=f"Draft '{draft_id}' cannot be prepared (status={draft.status}).")
    started = await drafts.start_prepare(draft_id, request.song_notes if request else None)
    if started is None:
        raise HTTPException(status_code=404, detail=f"Draft '{draft_id}' not found")
    _spawn(_prepare_and_export(started, job))
    return started


async def _prepare_and_export(draft: Draft, job: Job) -> None:
    await drafts.run_prepare(draft, job)
    _export_original(await drafts.get(draft.draft_id))


@router.put("/drafts/{draft_id}/details", response_model=DraftResponse)
async def save_draft_details(draft_id: str, request: DraftDetailsRequest) -> DraftResponse:
    draft = await _get_or_404(draft_id)
    if draft.status not in ("preview_ready", "prepared"):
        raise HTTPException(status_code=409, detail=f"Draft '{draft_id}' is {draft.status}")
    updated = await drafts.save_details(draft_id, request)
    if updated is None:
        raise HTTPException(status_code=404, detail=f"Draft '{draft_id}' not found")
    _export_original(updated)
    return updated


@router.post("/drafts/{draft_id}/render", response_model=DraftRenderAcceptedResponse, status_code=202)
async def render_draft(draft_id: str, request: DraftRenderRequest) -> DraftRenderAcceptedResponse:
    """Retoma el MISMO job del preview (sin re-transcribir ni regenerar el
    HTML): graba → títulos/descripciones/hashtags por plataforma → empaqueta
    → publica si se eligieron cuentas. Devuelve el job_id de Biblioteca."""
    draft = await drafts.get(draft_id)
    if draft is None:
        raise HTTPException(status_code=404, detail=f"Draft '{draft_id}' not found")
    job = drafts.load_job(draft_id)
    if not drafts.can_render(draft, job):
        raise HTTPException(
            status_code=409,
            detail=f"Draft '{draft_id}' cannot be rendered (status={draft.status}).",
        )
    niche_cfg = get_niche_config(draft.niche_id)
    await _validate_render_options(niche_cfg, request)
    _check_background_capacity(1)

    job_id = await _start_render(draft, job, request)
    return DraftRenderAcceptedResponse(draft_id=draft_id, job_id=job_id, status="rendering")


@router.get("/drafts/{draft_id}/preview/{file_path:path}")
async def get_draft_preview_file(draft_id: str, file_path: str, request: Request) -> Response:
    """Sirve el index.html del draft (con `inject_preview_scripts`, así el
    modal usa ?controls=1&volume= igual que el showcase) y los assets que
    referencia. Misma protección de path que /templates/{id}/showcase."""
    if await drafts.get(draft_id) is None:
        raise HTTPException(status_code=404, detail=f"Draft '{draft_id}' not found")
    job = drafts.load_job(draft_id)
    if job is None or job.artifacts.output_dir is None:
        raise HTTPException(status_code=404, detail="Draft output not ready yet")

    root = Path(job.artifacts.output_dir).resolve()
    path = (root / file_path).resolve()
    if (
        not path.is_relative_to(root)
        or path.suffix.lower() not in _PREVIEW_SUFFIXES
        or not path.is_file()
        or path.relative_to(root).parts[0] in _PREVIEW_BLOCKED_DIRS
    ):
        raise HTTPException(status_code=404, detail="Draft preview file not available")

    media_type = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
    # El código de la plantilla (html/json/js) se revalida siempre: si se edita, el navegador no sigue
    # mostrando la versión vieja desde su caché. Videos e imágenes sí se cachean.
    no_cache = {"Cache-Control": "no-cache"}
    if path.suffix.lower() == ".html":
        content = version_local_assets(inject_preview_scripts(path.read_text(encoding="utf-8"), request.query_params), path.parent)
        return Response(content=content, media_type="text/html; charset=utf-8", headers=no_cache)
    if path.suffix.lower() == ".json":
        content = preview_config_json(path.read_text(encoding="utf-8"), request)
        return Response(content=content, media_type="application/json", headers=no_cache)
    path = media_for_request(path, request)
    media_type = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
    response = serve_file_with_range(path, request.headers.get("range"), media_type)
    if path.suffix.lower() in {".js", ".css"}:
        response.headers.update(no_cache)
    return response
