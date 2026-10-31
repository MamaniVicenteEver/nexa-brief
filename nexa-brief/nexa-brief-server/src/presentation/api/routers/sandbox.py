"""Endpoints para consultar y promover videos del sandbox explainer."""

import asyncio
from dataclasses import asdict
from pathlib import Path

import structlog
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

from src.core.explainer.catalog import load_video
from src.core.explainer.producer import ACTIVE_STATES
from src.core.explainer.recorder import RecordState
from src.core.explainer import promote as promotion
from src.core.explainer import sandbox_thumbs
from src.core.explainer import sandbox as sandbox_catalog
from src.core.explainer import sandbox_info
from src.presentation.api.routers.explainer import get_producer, get_recorder
from src.presentation.api.security import require_internal
from src.presentation.api.schemas.explainer_schema import (
    SandboxFolderResponse,
    SandboxInfoResponse,
    SandboxPromotionResponse,
)

router = APIRouter(tags=["explainer"])
logger = structlog.get_logger(__name__)
BUSY_MESSAGE = sandbox_catalog.BUSY_MESSAGE


def _busy_video_ids() -> set[str]:
    """Ids con una producción del agente o una grabación todavía activa."""
    production_states = {state.value for state in ACTIVE_STATES}
    production_ids = {
        rec["video_id"]
        for rec in get_producer().list()
        if rec.get("state") in production_states and rec.get("video_id")
    }
    recording_states = {RecordState.queued, RecordState.rendering, RecordState.publishing}
    recording_ids = {
        job.video_id
        for job in get_recorder().list_jobs(active=True)
        if job.state in recording_states
    }
    return production_ids | recording_ids


@router.get("/explainer/sandbox", response_model=list[SandboxFolderResponse])
async def get_explainer_sandbox() -> list[SandboxFolderResponse]:
    """Lista las carpetas y elementos visibles del sandbox."""
    busy_ids = _busy_video_ids()
    return [
        SandboxFolderResponse.model_validate(asdict(folder))
        for folder in sandbox_catalog.list_sandbox(busy_ids=busy_ids)
    ]


@router.get(
    "/explainer/sandbox/referencias/{subcategory}/{video_id}/info",
    response_model=SandboxInfoResponse,
)
async def get_reference_info(subcategory: str, video_id: str) -> SandboxInfoResponse:
    """Devuelve ficha y costo de una idea de referencias con ruta de tres niveles."""
    if subcategory not in sandbox_catalog.REFERENCE_CATEGORIES or not _valid_sandbox_segment(video_id):
        raise HTTPException(status_code=404, detail="referencia no encontrada")
    try:
        data = sandbox_info.get_sandbox_info(
            sandbox_catalog.SANDBOX_DIR,
            "referencias",
            video_id,
            subcategory=subcategory,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return SandboxInfoResponse.model_validate(data)


@router.get(
    "/explainer/sandbox/{folder}/{video_id}/info",
    response_model=SandboxInfoResponse,
)
async def get_explainer_sandbox_info(folder: str, video_id: str) -> SandboxInfoResponse:
    """Devuelve la ficha descriptiva y el consumo de tokens de una plantilla."""
    if not _valid_sandbox_segment(folder) or not _valid_sandbox_segment(video_id):
        raise HTTPException(status_code=404, detail=f"No existe sandbox/{folder}/{video_id}")
    try:
        data = sandbox_info.get_sandbox_info(sandbox_catalog.SANDBOX_DIR, folder, video_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return SandboxInfoResponse.model_validate(data)


def _valid_sandbox_segment(value: str) -> bool:
    return bool(value) and not value.startswith((".", "_")) and ".." not in value and "/" not in value and "\\" not in value


@router.get(
    "/explainer/sandbox/{folder}/{video_id}/thumbnail.jpg",
    dependencies=[Depends(require_internal)],
)
async def get_sandbox_thumbnail(folder: str, video_id: str) -> FileResponse:
    """Sirve la miniatura cacheada o captura el primer frame de index.html."""
    if not _valid_sandbox_segment(folder) or not _valid_sandbox_segment(video_id):
        raise HTTPException(status_code=404, detail="miniatura no encontrada")

    sandbox_root = sandbox_catalog.SANDBOX_DIR.resolve()
    item_dir = (sandbox_catalog.SANDBOX_DIR / folder / video_id).resolve()
    if not item_dir.is_relative_to(sandbox_root) or not item_dir.is_dir() or not (item_dir / "index.html").is_file():
        raise HTTPException(status_code=404, detail="miniatura no encontrada")

    try:
        is_explainer_kit = sandbox_catalog.detect_kind(item_dir) == "explainer_kit"
        page_url = sandbox_thumbs.sandbox_page_url(folder, video_id, explainer_kit=is_explainer_kit)
        thumbnail_path = await asyncio.wait_for(
            asyncio.to_thread(
                sandbox_thumbs.ensure_thumbnail,
                item_dir,
                folder,
                video_id,
                page_url,
            ),
            timeout=20,
        )
    except (Exception, asyncio.TimeoutError) as exc:
        logger.warning("sandbox_thumbnail_failed", folder=folder, video_id=video_id, error=str(exc))
        raise HTTPException(status_code=404, detail="miniatura no disponible") from exc

    return FileResponse(
        thumbnail_path,
        media_type="image/jpeg",
        headers={"Cache-Control": "no-cache"},
    )


@router.get(
    "/explainer/sandbox/referencias/{subcategory}/{video_id}/thumbnail.jpg",
    dependencies=[Depends(require_internal)],
)
async def get_reference_thumbnail(subcategory: str, video_id: str) -> FileResponse:
    """Sirve una miniatura cacheada del primer cuadro de una idea MP4."""
    if subcategory not in sandbox_catalog.REFERENCE_CATEGORIES or not _valid_sandbox_segment(video_id):
        raise HTTPException(status_code=404, detail="miniatura no encontrada")

    sandbox_root = sandbox_catalog.SANDBOX_DIR.resolve()
    item_dir = (sandbox_catalog.SANDBOX_DIR / "referencias" / subcategory / video_id).resolve()
    if not item_dir.is_relative_to(sandbox_root) or not item_dir.is_dir():
        raise HTTPException(status_code=404, detail="miniatura no encontrada")

    try:
        thumbnail_path = await asyncio.wait_for(
            asyncio.to_thread(
                sandbox_thumbs.ensure_reference_thumbnail,
                item_dir,
                subcategory,
                video_id,
            ),
            timeout=22,
        )
    except (Exception, asyncio.TimeoutError) as exc:
        logger.warning("sandbox_reference_thumbnail_failed", subcategory=subcategory, video_id=video_id, error=str(exc))
        raise HTTPException(status_code=404, detail="miniatura no disponible") from exc

    return FileResponse(
        thumbnail_path,
        media_type="image/jpeg",
        headers={"Cache-Control": "no-cache"},
    )


@router.post(
    "/explainer/sandbox/{folder}/{video_id}/promote",
    response_model=SandboxPromotionResponse,
    dependencies=[Depends(require_internal)],
)
async def promote_sandbox_video(folder: str, video_id: str) -> SandboxPromotionResponse:
    """Mueve a producción un video válido del explainer-kit."""
    if not _valid_sandbox_segment(folder) or not _valid_sandbox_segment(video_id):
        raise HTTPException(status_code=404, detail=f"No existe sandbox/{folder}/{video_id}")
    if video_id in _busy_video_ids():
        raise HTTPException(status_code=409, detail=BUSY_MESSAGE)

    source = sandbox_catalog.SANDBOX_DIR / folder / video_id
    try:
        plan = promotion.promote(source, templates_dir=sandbox_catalog.SANDBOX_DIR.parent)
    except promotion.PromoteError as exc:
        status_code = 404 if exc.code == "not_found" else 409
        raise HTTPException(status_code=status_code, detail=exc.message) from exc

    video = load_video(plan.destination)
    if video is None:
        raise HTTPException(status_code=404, detail=f"No existe {plan.destination}")
    from_path = Path("sandbox") / folder / video_id
    to_path = Path(folder) / video_id
    logger.info(
        "explainer_sandbox_promoted",
        video_id=video_id,
        folder=folder,
        from_path=from_path.as_posix(),
        to_path=to_path.as_posix(),
        category_path=video.category_path,
    )
    return SandboxPromotionResponse(
        video_id=video_id,
        from_path=from_path.as_posix(),
        to_path=to_path.as_posix(),
        category_path=video.category_path,
    )
