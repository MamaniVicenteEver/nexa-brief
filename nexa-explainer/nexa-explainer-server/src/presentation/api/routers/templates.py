"""Templates router — listado de plantillas + preview en vivo (sin grabar).

El preview corre el pipeline SOLO hasta HTML_GENERATED (antes de
video_recorder/packager) — ver `pipeline.run(..., stop_after=...)`. Fire-and-
forget, igual que /videos/upload, pero trackeado en memoria (`preview_tracker`,
NO `job_tracker`) porque un intento de preview es descartable y no debe
aparecer en Biblioteca/historial de videos reales.
"""

from __future__ import annotations

import asyncio
import mimetypes
from pathlib import Path

import structlog
from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from starlette.responses import Response

from src.config.niche_config import NicheConfig, find_niche_by_template_id, list_all_niches
from src.config.template_manifest import get_template_display_name, get_template_native_orientation
from src.core import pipeline, preview_tracker
from src.core.job import JobStage
from src.core.orchestrator import Orchestrator
from src.presentation.api.file_streaming import serve_file_with_range
from src.presentation.api.resource_sources import (
    resolve_image_source,
    resolve_video_source,
)
from src.presentation.api.schemas.template_schema import (
    PREVIEW_ALLOWED_FILENAMES,
    PreviewStatusResponse,
    TemplatePreviewAcceptedResponse,
    TemplateResponse,
)

router = APIRouter(tags=["templates"])
logger = structlog.get_logger(__name__)

_preview_tasks: set[asyncio.Task] = set()


def _log_preview_task_exception(task: asyncio.Task) -> None:
    _preview_tasks.discard(task)
    if task.cancelled():
        return
    exc = task.exception()
    if exc is not None:
        logger.error("preview_task_failed", error=str(exc))


def _build_template_response(niche: NicheConfig) -> TemplateResponse:
    template_id = niche.template.template_id

    # src/templates/templates.json es la única fuente de verdad para nombre,
    # descripción y orientación pública de cada template — reemplaza el
    # manifest.json por carpeta (retirado) y el display_name de niches.json,
    # que solían tener textos distintos entre sí.
    display_name = get_template_display_name(template_id, fallback=niche.display_name)
    native_orientation = get_template_native_orientation(template_id)

    return TemplateResponse(
        template_id=template_id,
        niche_id=niche.id,
        display_name=display_name,
        native_orientation=native_orientation,
        requires_image=niche.template.requires_image,
        requires_video=niche.template.requires_video,
        active=niche.active,
    )


@router.get("/templates", response_model=list[TemplateResponse])
async def list_templates() -> list[TemplateResponse]:
    return [
        _build_template_response(n)
        for n in list_all_niches()
        if n.active and n.pipeline_type == "config_driven_template"
    ]


@router.get("/templates/{template_id}", response_model=TemplateResponse)
async def get_template(template_id: str) -> TemplateResponse:
    niche = find_niche_by_template_id(template_id)
    if niche is None:
        raise HTTPException(status_code=404, detail=f"Template '{template_id}' not found")
    return _build_template_response(niche)


@router.post("/templates/{template_id}/preview", response_model=TemplatePreviewAcceptedResponse, status_code=202)
async def create_template_preview(
    template_id: str,
    user_context: str | None = Form(default=None, max_length=500),
    image_file: UploadFile | None = File(default=None),
    video_file: UploadFile | None = File(default=None),
    image_asset_id: str | None = Form(default=None),
    video_asset_id: str | None = Form(default=None),
) -> TemplatePreviewAcceptedResponse:
    """Corre el pipeline hasta HTML_GENERATED (sin grabar) y responde casi al
    instante con un `preview_id` — el progreso se consulta con
    GET /templates/preview/{preview_id}/status."""
    niche = find_niche_by_template_id(template_id)
    if niche is None:
        raise HTTPException(status_code=404, detail=f"Template '{template_id}' not found")

    image_source = await resolve_image_source(niche, niche.id, image_file, image_asset_id)
    video_source = await resolve_video_source(niche.id, video_file, video_asset_id)

    orchestrator = Orchestrator()
    job = orchestrator.build_jobs(
        category_name=niche.id,
        quantity=1,
        user_context=user_context,
        image_source=image_source,
        video_source=video_source,
    )[0]

    preview_tracker.create(job)

    task = asyncio.create_task(
        pipeline.run(job, on_stage=preview_tracker.update, stop_after=JobStage.HTML_GENERATED)
    )
    _preview_tasks.add(task)
    task.add_done_callback(_log_preview_task_exception)

    return TemplatePreviewAcceptedResponse(
        preview_id=job.job_id,
        template_id=template_id,
        category_name=niche.id,
        stage=job.stage.value,
    )


@router.get("/templates/preview/{preview_id}/status", response_model=PreviewStatusResponse)
async def get_preview_status(preview_id: str) -> PreviewStatusResponse:
    record = preview_tracker.get(preview_id)
    if record is None:
        raise HTTPException(status_code=404, detail=f"Preview '{preview_id}' not found")
    return PreviewStatusResponse.from_record(record)


@router.get("/templates/preview/{preview_id}/{filename}")
async def get_preview_file(preview_id: str, filename: str, request: Request) -> Response:
    if filename not in PREVIEW_ALLOWED_FILENAMES:
        raise HTTPException(status_code=404, detail=f"Unknown preview file '{filename}'")

    record = preview_tracker.get(preview_id)
    if record is None:
        raise HTTPException(status_code=404, detail=f"Preview '{preview_id}' not found")

    output_dir_str = record.get("output_dir")
    if not output_dir_str:
        raise HTTPException(status_code=404, detail="Preview output not ready yet")

    output_dir = Path(output_dir_str).resolve()
    path = (output_dir / filename).resolve()
    if not path.is_relative_to(output_dir) or not path.exists():
        raise HTTPException(status_code=404, detail=f"'{filename}' not available for this preview")

    if filename == "index.html":
        return Response(content=path.read_bytes(), media_type="text/html; charset=utf-8")

    media_type = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
    return serve_file_with_range(path, request.headers.get("range"), media_type)
