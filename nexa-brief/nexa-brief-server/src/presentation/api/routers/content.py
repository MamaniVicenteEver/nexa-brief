"""Lectura interna del índice de contenido del perfil v2."""
import mimetypes

from fastapi import APIRouter, Depends, HTTPException, Request

from src.core import content_catalog, content_registry
from src.presentation.api.file_streaming import serve_file_with_range
from src.presentation.api.security import require_internal

router = APIRouter(prefix="/content", tags=["content"], dependencies=[Depends(require_internal)])


@router.get("/catalog")
def catalog():
    try:
        return content_catalog.snapshot_catalog()
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Registro no disponible") from exc


@router.get("/videos/{video_id}")
def video(video_id: str):
    try:
        result = content_registry.get_video(video_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Video no encontrado") from exc
    if result is None:
        raise HTTPException(status_code=404, detail="Video no encontrado")
    return result


@router.get("/resources/{asset_id}/file")
def resource_file(asset_id: str, request: Request):
    try:
        path = content_registry.resolve_resource(asset_id)
    except (ValueError, KeyError) as exc:
        raise HTTPException(status_code=404, detail="Recurso no encontrado") from exc
    if path is None or not path.is_file():
        raise HTTPException(status_code=404, detail="Recurso no encontrado")
    return serve_file_with_range(path, request.headers.get("range"),
                                 mimetypes.guess_type(path.name)[0] or "application/octet-stream",
                                 if_none_match=request.headers.get("if-none-match"),
                                 if_modified_since=request.headers.get("if-modified-since"),
                                 if_range=request.headers.get("if-range"),
                                 cache_control="private, no-cache")
