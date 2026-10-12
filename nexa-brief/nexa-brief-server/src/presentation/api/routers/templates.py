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
from src.config.template_manifest import (
    get_template_asset_dir,
    get_template_category_id,
    get_template_category_name,
    get_template_category_order,
    get_template_display_name,
    get_template_inputs,
    get_template_native_orientation,
    get_template_paths,
    get_template_preview_assets,
    get_template_sort_order,
    get_template_status,
    get_template_tags,
    list_template_categories,
    list_template_catalog,
)
from src.core import pipeline, preview_tracker
from src.core.job import JobStage, SongInfo
from src.core.orchestrator import Orchestrator
from src.presentation.api.file_streaming import serve_file_with_range
from src.presentation.api.resource_sources import (
    resolve_image_source,
    resolve_music_source,
    resolve_video_source,
)
from src.presentation.api.preview_injection import inject_preview_scripts
from src.presentation.api.preview_media import media_for_request, preview_config_json
from src.presentation.api.schemas.template_schema import (
    PREVIEW_ALLOWED_FILENAMES,
    PreviewStatusResponse,
    TemplatePreviewAcceptedResponse,
    TemplateCategoryResponse,
    TemplateRequirementsResponse,
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


def _build_template_response(template_id: str, niche: NicheConfig | None) -> TemplateResponse:
    manifest_entry = dict(next(
        (entry for candidate_id, entry in list_template_catalog() if candidate_id == template_id),
        {},
    ))

    # src/templates/templates.json es la única fuente de verdad para nombre,
    # descripción y orientación pública de cada template — reemplaza el
    # manifest.json por carpeta (retirado) y el display_name de niches.json,
    # que solían tener textos distintos entre sí.
    display_name = get_template_display_name(
        template_id,
        fallback=(niche.display_name if niche else template_id),
    )
    native_orientation = get_template_native_orientation(template_id)
    preview_assets = get_template_preview_assets(template_id)

    def asset_url(kind: str) -> str | None:
        path = preview_assets[kind]
        asset_dir = get_template_asset_dir(template_id)
        if path is None or asset_dir is None:
            return None
        relative_path = path.relative_to(asset_dir).as_posix()
        return f"/api/v1/templates/{template_id}/asset/{relative_path}"

    return TemplateResponse(
        template_id=template_id,
        niche_id=niche.id if niche else "",
        category_id=get_template_category_id(template_id),
        category_name=get_template_category_name(template_id),
        category_order=get_template_category_order(template_id),
        tags=get_template_tags(template_id),
        sort_order=get_template_sort_order(template_id),
        status=get_template_status(template_id),
        can_generate=bool(niche and niche.active and niche.pipeline_type == "config_driven_template"),
        display_name=display_name,
        native_orientation=native_orientation,
        requires_image=niche.template.requires_image if niche else bool(manifest_entry.get("requires_image", False)),
        requires_video=niche.template.requires_video if niche else bool(manifest_entry.get("requires_video", False)),
        requires_lyrics=niche.template.requires_lyrics if niche else bool(manifest_entry.get("requires_lyrics", False)),
        active=niche.active if niche else get_template_status(template_id) != "disabled",
        preview_image_url=asset_url("image"),
        preview_video_url=asset_url("video"),
        preview_audio_url=asset_url("audio"),
        showcase_url=(
            f"/api/v1/templates/{template_id}/showcase/index.html"
            if get_template_paths(template_id)["index_html"] is not None
            else None
        ),
        inputs=_requirements_or_none(template_id),
    )


def _requirements_or_none(template_id: str) -> TemplateRequirementsResponse | None:
    inputs = get_template_inputs(template_id)
    return TemplateRequirementsResponse.model_validate(inputs) if inputs is not None else None


@router.get("/templates", response_model=list[TemplateResponse])
async def list_templates() -> list[TemplateResponse]:
    niches_by_template = {
        n.template.template_id: n
        for n in list_all_niches()
        if n.pipeline_type == "config_driven_template"
    }
    return [
        _build_template_response(template_id, niches_by_template.get(template_id))
        for template_id, _ in list_template_catalog()
        if get_template_status(template_id) != "disabled"
    ]


@router.get("/templates/categories", response_model=list[TemplateCategoryResponse])
async def list_template_categories_endpoint() -> list[TemplateCategoryResponse]:
    return [TemplateCategoryResponse.model_validate(category) for category in list_template_categories()]


@router.get("/templates/{template_id}", response_model=TemplateResponse)
async def get_template(template_id: str) -> TemplateResponse:
    niche = find_niche_by_template_id(template_id)
    if not any(candidate_id == template_id for candidate_id, _ in list_template_catalog()):
        raise HTTPException(status_code=404, detail=f"Template '{template_id}' not found")
    return _build_template_response(template_id, niche)


@router.get("/templates/{template_id}/requirements", response_model=TemplateRequirementsResponse)
async def get_template_requirements(template_id: str) -> TemplateRequirementsResponse:
    """Qué pide la plantilla (canción, slots de medios, textos, brief) para
    armar el formulario del Estudio / Crear video sin conocerla de antemano."""
    requirements = _requirements_or_none(template_id)
    if requirements is None:
        raise HTTPException(status_code=404, detail=f"Template '{template_id}' not found")
    return requirements


@router.get("/templates/{template_id}/asset/{asset_path:path}")
async def get_template_asset(template_id: str, asset_path: str, request: Request) -> Response:
    """Sirve solo los assets seleccionados como preview para esa plantilla."""
    asset_dir = get_template_asset_dir(template_id)
    if asset_dir is None:
        raise HTTPException(status_code=404, detail=f"Template '{template_id}' not found")

    preview_assets = get_template_preview_assets(template_id)
    allowed_paths = {
        path.resolve()
        for path in preview_assets.values()
        if path is not None
    }
    root = asset_dir.resolve()
    path = (root / asset_path).resolve()
    if not path.is_relative_to(root) or path not in allowed_paths or not path.exists():
        raise HTTPException(status_code=404, detail="Preview asset not available")

    path = media_for_request(path, request, always_preview=True)
    media_type = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
    return serve_file_with_range(path, request.headers.get("range"), media_type)


@router.get("/templates/{template_id}/showcase/{file_path:path}")
async def get_template_showcase_file(template_id: str, file_path: str, request: Request) -> Response:
    """Sirve el HTML real de la plantilla y sus assets versionados."""
    asset_dir = get_template_asset_dir(template_id)
    if asset_dir is None:
        raise HTTPException(status_code=404, detail=f"Template '{template_id}' not found")

    template_root = asset_dir.parent.resolve()
    path = (template_root / file_path).resolve()
    # El pipeline copia los assets a la raíz del output, así que hay plantillas que
    # piden "song.mp3" a secas; en la carpeta de la plantilla vive en assets/.
    if not path.is_file() and "/" not in file_path:
        candidate = (asset_dir / file_path).resolve()
        if candidate.is_file() and candidate.is_relative_to(template_root):
            path = candidate
    allowed_suffixes = {
        ".html", ".json", ".mp3", ".mp4", ".webm", ".mov", ".jpg", ".jpeg",
        ".png", ".webp", ".svg", ".woff", ".woff2", ".ttf",
    }
    if (
        not path.is_relative_to(template_root)
        or path.suffix.lower() not in allowed_suffixes
        or not path.is_file()
    ):
        raise HTTPException(status_code=404, detail="Showcase file not available")

    media_type = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
    if path.suffix.lower() in {".html", ".json"}:
        content = path.read_text(encoding="utf-8")
        if path.suffix.lower() == ".html":
            content = inject_preview_scripts(content, request.query_params)
        else:
            content = preview_config_json(content, request)
        return Response(content=content, media_type=media_type)
    # Videos pedidos desde la tarjeta o el modal: copia liviana (ver preview_media).
    path = media_for_request(path, request)
    media_type = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
    return serve_file_with_range(path, request.headers.get("range"), media_type)


@router.post("/templates/{template_id}/preview", response_model=TemplatePreviewAcceptedResponse, status_code=202)
async def create_template_preview(
    template_id: str,
    user_context: str | None = Form(default=None, max_length=500),
    song_name: str | None = Form(default=None),
    artist: str | None = Form(default=None),
    topic: str | None = Form(default=None),
    song_description: str | None = Form(default=None),
    language: str | None = Form(default=None),
    image_file: UploadFile | None = File(default=None),
    music_file: UploadFile | None = File(default=None),
    video_file: UploadFile | None = File(default=None),
    image_asset_id: str | None = Form(default=None),
    music_asset_id: str | None = Form(default=None),
    video_asset_id: str | None = Form(default=None),
) -> TemplatePreviewAcceptedResponse:
    """Corre el pipeline hasta HTML_GENERATED (sin grabar) y responde casi al
    instante con un `preview_id` — el progreso se consulta con
    GET /templates/preview/{preview_id}/status."""
    niche = find_niche_by_template_id(template_id)
    if niche is None:
        raise HTTPException(status_code=404, detail=f"Template '{template_id}' not found")

    image_source = await resolve_image_source(niche, niche.id, image_file, image_asset_id)
    music_source = await resolve_music_source(niche, niche.id, music_file, music_asset_id, song_name, artist)
    video_source = await resolve_video_source(niche.id, video_file, video_asset_id)

    song_info = None
    if any([song_name, artist, topic, song_description, language]):
        song_info = SongInfo(
            song_name=song_name, artist=artist, topic=topic,
            description=song_description, language=language,
        )

    orchestrator = Orchestrator()
    job = orchestrator.build_jobs(
        category_name=niche.id,
        quantity=1,
        user_context=user_context,
        image_source=image_source,
        music_source=music_source,
        video_source=video_source,
        song_info=song_info,
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
