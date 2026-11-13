"""The same catalogue service for both views; authentication is never a query flag."""
import re

from fastapi import APIRouter, Depends, HTTPException, Request
from starlette.responses import Response, StreamingResponse

from src.adapters.catalog.factory import catalog_media, catalog_service
from src.core.catalog.models import CatalogPage
from src.presentation.api.security import require_internal

router = APIRouter(tags=["catalog"])


def _list(service, category, page, page_size):
    try:
        return service.list(category=category, page=page, page_size=page_size)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/catalog", response_model=CatalogPage)
def public_catalog(category: str | None = None, page: int = 1, page_size: str = "all",
                   service=Depends(catalog_service)):
    return _list(service, category, page, page_size)


@router.get("/catalog/internal", response_model=CatalogPage, dependencies=[Depends(require_internal)])
def internal_catalog(category: str | None = None, page: int = 1, page_size: str = "all",
                     service=Depends(catalog_service)):
    # The template gallery has the same demos. Private productions stay in their own modules.
    return _list(service, category, page, page_size)


@router.get("/catalog/internal/items/{item_id}/studio", dependencies=[Depends(require_internal)])
def internal_studio(item_id: str, service=Depends(catalog_service)):
    from src.presentation.api.catalog_studio import studio_detail
    from src.config.settings import settings
    item = next((item for item in service.list().items if item.id == item_id), None)
    if item is None:
        raise HTTPException(404, detail="Demo no encontrada")
    try:
        return studio_detail(item, settings.templates_dir)
    except FileNotFoundError:
        raise HTTPException(404, detail="Información no encontrada") from None


@router.get("/catalog/media/{key:path}")
def public_media(key: str, request: Request, media=Depends(catalog_media)):
    try:
        obj = media.open(key)
    except (FileNotFoundError, ValueError):
        raise HTTPException(status_code=404, detail="Recurso público no encontrado") from None
    headers = {"ETag": obj.etag, "Accept-Ranges": "bytes", "Cache-Control": "no-cache",
               "X-Content-Type-Options": "nosniff"}
    if request.headers.get("if-none-match") in {obj.etag, "*", "W/" + obj.etag}:
        return Response(status_code=304, headers=headers)
    start, end, status = 0, obj.size - 1, 200
    requested = request.headers.get("range")
    if requested and request.headers.get("if-range", obj.etag) == obj.etag:
        match = re.fullmatch(r"bytes=(\d*)-(\d*)", requested)
        if not match or not any(match.groups()):
            raise HTTPException(416, headers={**headers, "Content-Range": f"bytes */{obj.size}"})
        left, right = match.groups()
        if left:
            start, end = int(left), min(int(right), end) if right else end
        else:
            start = max(0, obj.size - int(right))
        if start > end or start >= obj.size:
            raise HTTPException(416, headers={**headers, "Content-Range": f"bytes */{obj.size}"})
        status = 206
        headers["Content-Range"] = f"bytes {start}-{end}/{obj.size}"
    headers["Content-Length"] = str(max(0, end - start + 1))
    return StreamingResponse(obj.read(start, end), status_code=status, media_type=obj.content_type, headers=headers)
