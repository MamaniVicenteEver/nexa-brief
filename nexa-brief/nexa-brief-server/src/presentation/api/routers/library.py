"""Library router — read-only listing of the local asset library.

Exposes what accumulated in data/image_library, data/music_library, and
data/template_configs (see src/core/library/asset_library.py) so a future
frontend can browse and reuse assets/configs instead of only searching
or uploading new ones every time.

All endpoints are read-only; writes happen exclusively as a side effect of
the pipeline (resource_fetcher, html_generator) or of a manual
POST /api/v1/videos request with image_source/music_source pointing at a URL.
"""

from __future__ import annotations

import mimetypes

import structlog
from fastapi import APIRouter, HTTPException, Request
from starlette.responses import Response

from src.config.exceptions import AssetNotFoundError
from src.core.library import asset_library
from src.presentation.api.file_streaming import serve_file_with_range
from src.presentation.api.schemas.library_schema import (
    ImageLibraryEntryResponse,
    MusicLibraryEntryResponse,
    TemplateConfigDetailResponse,
    TemplateConfigEntryResponse,
    VideoLibraryEntryResponse,
)

router = APIRouter(prefix="/library", tags=["library"])
logger = structlog.get_logger(__name__)


@router.get("/images", response_model=list[ImageLibraryEntryResponse])
async def list_images(category: str | None = None) -> list[ImageLibraryEntryResponse]:
    """List archived images, optionally filtered by category."""
    entries = asset_library.list_images(category=category)
    return [ImageLibraryEntryResponse(**e.model_dump()) for e in entries]


@router.get("/images/{asset_id}", response_model=ImageLibraryEntryResponse)
async def get_image(asset_id: str) -> ImageLibraryEntryResponse:
    """Fetch a single archived image's metadata."""
    try:
        entry = asset_library.get_image_entry(asset_id)
    except AssetNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return ImageLibraryEntryResponse(**entry.model_dump())


@router.get("/images/{asset_id}/file")
async def get_image_file(asset_id: str, request: Request) -> Response:
    """Sirve el binario real de una imagen archivada (para <img src> en el admin)."""
    try:
        path = asset_library.resolve_image_path(asset_id)
    except AssetNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    if not path.exists():
        raise HTTPException(status_code=404, detail="File no longer exists on disk.")
    media_type = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
    return serve_file_with_range(path, request.headers.get("range"), media_type)


@router.get("/music", response_model=list[MusicLibraryEntryResponse])
async def list_music(category: str | None = None) -> list[MusicLibraryEntryResponse]:
    """List archived music tracks, optionally filtered by category."""
    entries = asset_library.list_music(category=category)
    return [MusicLibraryEntryResponse(**e.model_dump()) for e in entries]


@router.get("/music/{asset_id}", response_model=MusicLibraryEntryResponse)
async def get_music(asset_id: str) -> MusicLibraryEntryResponse:
    """Fetch a single archived music track's metadata."""
    try:
        entry = asset_library.get_music_entry(asset_id)
    except AssetNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return MusicLibraryEntryResponse(**entry.model_dump())


@router.get("/music/{asset_id}/file")
async def get_music_file(asset_id: str, request: Request) -> Response:
    """Sirve el binario real de una canción archivada (para <audio src> en el admin)."""
    try:
        path = asset_library.resolve_music_path(asset_id)
    except AssetNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    if not path.exists():
        raise HTTPException(status_code=404, detail="File no longer exists on disk.")
    media_type = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
    return serve_file_with_range(path, request.headers.get("range"), media_type)


@router.get("/videos", response_model=list[VideoLibraryEntryResponse])
async def list_videos(category: str | None = None) -> list[VideoLibraryEntryResponse]:
    """List archived background videos, optionally filtered by category."""
    entries = asset_library.list_videos(category=category)
    return [VideoLibraryEntryResponse(**e.model_dump()) for e in entries]


@router.get("/videos/{asset_id}", response_model=VideoLibraryEntryResponse)
async def get_video(asset_id: str) -> VideoLibraryEntryResponse:
    """Fetch a single archived video's metadata."""
    try:
        entry = asset_library.get_video_entry(asset_id)
    except AssetNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return VideoLibraryEntryResponse(**entry.model_dump())


@router.get("/videos/{asset_id}/file")
async def get_video_file(asset_id: str, request: Request) -> Response:
    """Sirve el binario real de un video de fondo archivado (para <video src> en el admin)."""
    try:
        path = asset_library.resolve_video_path(asset_id)
    except AssetNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    if not path.exists():
        raise HTTPException(status_code=404, detail="File no longer exists on disk.")
    media_type = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
    return serve_file_with_range(path, request.headers.get("range"), media_type)


@router.get("/categories", response_model=list[str])
async def list_categories(kind: str = "images") -> list[str]:
    """List distinct categories present in the library ("images" | "music" | "videos")."""
    if kind == "images":
        entries = asset_library.list_images()
    elif kind == "music":
        entries = asset_library.list_music()
    elif kind == "videos":
        entries = asset_library.list_videos()
    else:
        raise HTTPException(status_code=400, detail="kind must be 'images', 'music' or 'videos'")
    return sorted({e.category for e in entries})


@router.get("/configs", response_model=list[TemplateConfigEntryResponse])
async def list_template_configs(template_id: str | None = None) -> list[TemplateConfigEntryResponse]:
    """List archived config.json entries, optionally filtered by template_id."""
    entries = asset_library.list_template_configs(template_id=template_id)
    return [TemplateConfigEntryResponse(**e.model_dump()) for e in entries]


@router.get("/configs/{job_id}", response_model=TemplateConfigDetailResponse)
async def get_template_config(job_id: str) -> TemplateConfigDetailResponse:
    """Fetch the full archived config.json content for a given job_id."""
    try:
        config = asset_library.get_template_config(job_id)
    except AssetNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return TemplateConfigDetailResponse(job_id=job_id, config=config)
