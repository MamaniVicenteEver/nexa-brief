"""Drafts router — preview persistido de una plantilla + "Grabar" sobre el mismo job.

  POST   /drafts                         crea el draft y corre hasta HTML_GENERATED
  GET    /drafts?template_id=            lista (más recientes primero)
  GET    /drafts/{id}                    estado
  DELETE /drafts/{id}                    borra (409 si está corriendo)
  POST   /drafts/{id}/render             retoma el MISMO job hasta el final
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
from src.core import drafts, job_tracker
from src.core.drafts import Draft, DraftInputs, RenderOptions
from src.core.job import DurationConfig, DurationMode, Job, JobPublishingConfig
from src.core.orchestrator import Orchestrator
from src.presentation.api.file_streaming import serve_file_with_range
from src.presentation.api.preview_injection import inject_preview_scripts
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
    DraftListResponse,
    DraftRenderAcceptedResponse,
    DraftRenderRequest,
    DraftResponse,
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


async def _start_render(draft: Draft, job: Job, options: RenderOptions) -> str:
    """Registra el job en job_tracker (así aparece en Biblioteca con
    generation_seconds, historial y notificación igual que /videos) y lanza
    el grabado en background. Devuelve el job_id."""
    niche_cfg = get_niche_config(draft.niche_id)
    job = drafts.apply_render_options(job, options)
    # Un reintento tras un fallo reusa el registro existente (mismo job_id).
    if job_tracker.get(job.job_id) is None:
        await job_tracker.create(job, niche_cfg)
    if await drafts.start_render(draft.draft_id, job) is None:
        raise HTTPException(status_code=404, detail=f"Draft '{draft.draft_id}' not found")
    _spawn(drafts.run_render(draft.draft_id, job, on_stage=_job_on_stage))
    return job.job_id


async def _preview_then_maybe_render(draft: Draft, job: Job) -> None:
    result = await drafts.run_preview(draft.draft_id, job)
    if draft.auto_render is None:
        return
    current = await drafts.get(draft.draft_id)
    if current is None or current.status != "preview_ready":
        return  # el preview falló (queda en el draft) o lo borraron mientras corría
    await _start_render(current, result, draft.auto_render)


@router.post("/drafts", response_model=DraftResponse, status_code=202)
async def create_draft(request: DraftCreateRequest) -> DraftResponse:
    """Crea el draft y corre el pipeline hasta HTML_GENERATED en background.

    Con `auto_render`, al quedar listo el preview se graba solo (Crear video
    en un paso). Responde al instante; el progreso llega por GET o por el
    evento realtime `draft_changed`."""
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
    if path.suffix.lower() == ".html":
        content = inject_preview_scripts(path.read_text(encoding="utf-8"), request.query_params)
        return Response(content=content, media_type="text/html; charset=utf-8")
    if path.suffix.lower() == ".json":
        content = preview_config_json(path.read_text(encoding="utf-8"), request)
        return Response(content=content, media_type="application/json")
    path = media_for_request(path, request)
    media_type = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
    return serve_file_with_range(path, request.headers.get("range"), media_type)
