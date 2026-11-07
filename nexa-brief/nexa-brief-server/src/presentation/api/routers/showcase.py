"""API de diseños reutilizables en prueba y en producción."""
from __future__ import annotations

import mimetypes
from typing import Callable, TypeVar

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import FileResponse, RedirectResponse, Response
from pydantic import BaseModel, StrictBool

from src.core.showcase.models import SandboxShowcaseState
from src.core.showcase.ports import ShowcaseConflict, ShowcaseInvalid, ShowcaseNotFound
from src.core.showcase.service import ShowcaseService
from src.presentation.api.file_streaming import serve_file_with_range
from src.presentation.api.schemas.showcase_schema import Catalog, Design, DesignList, Entry
from src.presentation.api.security import require_internal

router = APIRouter(prefix="/showcase/designs", tags=["showcase"])
T = TypeVar("T")


def get_showcase_service() -> ShowcaseService:
    # Se resuelve por solicitud para respetar el perfil seleccionado.
    from src.adapters.showcase.filesystem import FilesystemShowcaseAdapter
    return ShowcaseService(FilesystemShowcaseAdapter.from_settings())


def _call(fn: Callable[..., T], *args) -> T:
    try:
        return fn(*args)
    except ShowcaseNotFound as exc:
        raise HTTPException(status_code=404, detail="Diseño o recurso no encontrado") from exc
    except ShowcaseConflict as exc:
        raise HTTPException(status_code=409, detail="El diseño no puede completar esta operación") from exc
    except ShowcaseInvalid as exc:
        raise HTTPException(status_code=422, detail="Diseño o solicitud inválida") from exc


@router.get("", response_model=DesignList)
def list_designs(service: ShowcaseService = Depends(get_showcase_service)):
    return _call(service.list_designs)


class SandboxVisibilityUpdate(BaseModel):
    visible: StrictBool


@router.get("/sandbox/projects", response_model=list[SandboxShowcaseState])
def sandbox_projects(service: ShowcaseService = Depends(get_showcase_service)):
    return _call(service.sandbox_visibility)


@router.put("/sandbox/projects/{folder}/{project_id}", response_model=SandboxShowcaseState,
            dependencies=[Depends(require_internal)])
def set_sandbox_visibility(folder: str, project_id: str, update: SandboxVisibilityUpdate,
                           service: ShowcaseService = Depends(get_showcase_service)):
    return _call(service.set_sandbox_visibility, folder, project_id, update.visible)


@router.get("/{design_id}", response_model=Design)
def get_design(design_id: str, service: ShowcaseService = Depends(get_showcase_service)):
    return _call(service.get_design, design_id)


@router.get("/{design_id}/catalog", response_model=Catalog)
def get_catalog(design_id: str, service: ShowcaseService = Depends(get_showcase_service)):
    return _call(service.catalog, design_id)


@router.get("/{design_id}/preview")
def preview(design_id: str, entry: str | None = Query(default=None), format: str = Query(default="9x16"),
            service: ShowcaseService = Depends(get_showcase_service)):
    target = _call(service.preview, design_id, entry, format)
    return RedirectResponse(target, status_code=307, headers={"Cache-Control": "no-store"})


@router.get("/{design_id}/poster")
async def poster(design_id: str, request: Request, entry: str, format: str = "16x9",
                 service: ShowcaseService = Depends(get_showcase_service)):
    """Create one disposable poster per profile/design revision without blocking the UI."""
    from src.adapters.showcase import posters
    from src.config.profile_layout import layout_for_settings
    from src.config.settings import settings

    design = _call(service.get_design, design_id)
    target = _call(service.preview, design_id, entry, format)
    path = posters.poster_path(layout_for_settings(settings).cache_dir, design_id,
                               design.revision, entry, format, target)
    state = posters.status(path)
    if state == "ready":
        return FileResponse(path, media_type="image/jpeg", headers={"Cache-Control": "private, no-cache"})
    if state == "failed":
        return Response(status_code=503, headers={"Cache-Control": "no-store"})
    port = request.scope.get("server", ("127.0.0.1", 8000))[1]
    posters.enqueue(path, target, format, int(port or 8000), settings.playwright_chromium_executable_path)
    return Response(status_code=202, headers={"Cache-Control": "no-store", "Retry-After": "2"})


@router.get("/{design_id}/catalog/{entry_id}", response_model=Entry)
def get_entry(design_id: str, entry_id: str, service: ShowcaseService = Depends(get_showcase_service)):
    return _call(service.entry, design_id, entry_id)


@router.get("/{design_id}/files/{path:path}")
def file(design_id: str, path: str, request: Request, service: ShowcaseService = Depends(get_showcase_service)):
    target = _call(service.file, design_id, path)
    return serve_file_with_range(target, request.headers.get("range"),
                                 mimetypes.guess_type(target.name)[0] or "application/octet-stream",
                                 if_none_match=request.headers.get("if-none-match"),
                                 if_modified_since=request.headers.get("if-modified-since"),
                                 if_range=request.headers.get("if-range"), cache_control="private, no-cache")


@router.post("/{design_id}/promote", response_model=Design, dependencies=[Depends(require_internal)])
def promote(design_id: str, service: ShowcaseService = Depends(get_showcase_service)):
    return _call(service.promote, design_id)
