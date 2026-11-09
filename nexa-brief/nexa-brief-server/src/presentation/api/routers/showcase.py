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
from src.config.settings import settings
import json as _json

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


# Estilos visuales elegibles por diseño (el motor los define en un catálogo JSON dentro del repositorio).
_STYLE_SOURCES = {"atlas-en-movimiento": "nodeatlas/atlas-en-movimiento/engine/tactico/estilos/index.json"}


def _style_source(design_id: str, folder: str | None) -> str | None:
    """Catálogo de estilos de un diseño: mapa fijo o declaración `estilos` en el info.json de su plantilla sandbox."""
    if design_id in _STYLE_SOURCES:
        return _STYLE_SOURCES[design_id]
    if not (design_id.replace("-", "").replace("_", "").isalnum() and (folder is None or folder.replace("-", "").replace("_", "").isalnum())):
        return None
    sandbox = settings.templates_dir / "sandbox"
    folders = [folder] if folder else [p.name for p in sandbox.iterdir() if p.is_dir()]
    for name in folders:
        info = sandbox / name / design_id / "info.json"
        if info.is_file():
            try:
                declared = _json.loads(info.read_text(encoding="utf-8")).get("estilos")
            except (OSError, ValueError):
                return None
            if isinstance(declared, str) and ".." not in declared and not declared.startswith("/"):
                return f"sandbox/{name}/{design_id}/{declared}"
    return None


@router.get("/{design_id}/styles")
def get_styles(design_id: str, folder: str | None = None):
    relative = _style_source(design_id, folder)
    if not relative:
        return {"default": None, "styles": []}
    path = (settings.templates_dir / relative).resolve()
    if not path.is_file() or not path.is_relative_to(settings.templates_dir.resolve()):
        return {"default": None, "styles": []}
    try:
        data = _json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {"default": None, "styles": []}
    styles = [{"id": s["id"], "name": s.get("nombre") or s["id"], "idea": s.get("idea") or "", "formats": s.get("formatos") or []}
              for s in data.get("estilos", []) if isinstance(s, dict) and isinstance(s.get("id"), str)]
    return {"default": data.get("default") or (styles[0]["id"] if styles else None), "styles": styles}


_AGENT_DOCS = {"agente": "AGENTE.md", "guion": "GUION.md", "menu-visual": "MENU-VISUAL.md", "skill": "SKILL.md"}


@router.get("/{design_id}/agent")
def agent_guide(design_id: str, doc: str = "agente"):
    """Guía pública para agentes de un diseño (Markdown): proceso, guion y menú de componentes.

    Un agente que reciba el link del Showcase de un diseño lee aquí cómo producir videos con él.
    `doc`: agente (proceso y roles), guion (cómo se genera el diálogo), menu-visual, skill.
    """
    import re
    from fastapi.responses import PlainTextResponse
    name = _AGENT_DOCS.get(doc)
    if not name or not re.fullmatch(r"[a-z0-9][a-z0-9-]*", design_id):
        raise HTTPException(status_code=404, detail="guía no disponible")
    for folder in ("nodeatlas", "nodehistory", "nodepolitics", "nodeeconomy", "nodetech"):
        path = settings.templates_dir / folder / design_id / name
        if path.is_file():
            return PlainTextResponse(path.read_text(encoding="utf-8"), media_type="text/markdown")
    raise HTTPException(status_code=404, detail="este diseño no publica guía para agentes")


@router.get("/{design_id}/catalog", response_model=Catalog)
def get_catalog(design_id: str, service: ShowcaseService = Depends(get_showcase_service)):
    return _call(service.catalog, design_id)


def _styled_target(service: ShowcaseService, design_id: str, entry: str | None, format: str, style: str | None) -> str:
    from src.adapters.showcase import posters
    if style:
        resolver = globals().get("get_styles")
        declared = resolver(design_id).get("styles", []) if resolver else []
        if style not in {item.get("id") for item in declared}:
            raise HTTPException(status_code=422, detail="Estilo inválido")
    try:
        return posters.with_style(_call(service.preview, design_id, entry, format), style)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Estilo inválido") from exc


@router.get("/{design_id}/preview")
def preview(design_id: str, entry: str | None = Query(default=None), format: str = Query(default="9x16"),
            estilo: str | None = None, service: ShowcaseService = Depends(get_showcase_service)):
    target = _styled_target(service, design_id, entry, format, estilo)
    return RedirectResponse(target, status_code=307, headers={"Cache-Control": "no-store"})


@router.get("/{design_id}/poster")
async def poster(design_id: str, request: Request, entry: str, format: str = "16x9",
                 estilo: str | None = None, retry: bool = False,
                 service: ShowcaseService = Depends(get_showcase_service)):
    """Serve precomputed posters; browsing never starts a renderer."""
    from src.adapters.showcase import posters
    from src.config.profile_layout import layout_for_settings
    from src.config.settings import settings

    design = _call(service.get_design, design_id)
    if format != "16x9":
        raise HTTPException(status_code=422, detail="Solo se almacenan miniaturas 16:9")
    target = _styled_target(service, design_id, entry, format, estilo)
    layout = layout_for_settings(settings)
    import asyncio
    source = await asyncio.to_thread(posters.source_revision, settings.templates_dir, layout.sandbox_dir, design.engine_id, target)
    path = posters.poster_path(layout.cache_dir, design_id, design.revision + source, entry, format, target)
    if path.is_file():
        return FileResponse(path, media_type="image/webp", headers={"Cache-Control": "private, no-cache"})
    legacy = posters.poster_path(layout.cache_dir, design_id, design.revision + source, entry, format, target, legacy=True)
    if design.engine_id not in {"nodehistory/_atlas", "nodehistory/_mapas"} and legacy.is_file():
        return FileResponse(legacy, media_type="image/jpeg", headers={"Cache-Control": "private, no-cache"})
    return Response(status_code=404, headers={"Cache-Control": "no-store"})


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


class DesignPromotionRequest(BaseModel):
    category: str
    shared_categories: list[str] = []


@router.post("/{design_id}/promote", response_model=Design, dependencies=[Depends(require_internal)])
def promote(design_id: str, body: DesignPromotionRequest | None = None, service: ShowcaseService = Depends(get_showcase_service)):
    if body is None:
        return _call(service.promote, design_id)
    return _call(service.promote, design_id, body.category, body.shared_categories)
