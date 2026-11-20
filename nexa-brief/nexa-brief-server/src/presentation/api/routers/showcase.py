"""API de diseños reutilizables en prueba y en producción."""
from __future__ import annotations

import mimetypes
from typing import Callable, TypeVar

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import FileResponse, RedirectResponse, Response
from pydantic import BaseModel, Field, StrictBool

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


def _call(fn: Callable[..., T], *args, **kwargs) -> T:
    try:
        return fn(*args, **kwargs)
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
def get_catalog(design_id: str, estilo: str | None = None, format: str = "16x9", service: ShowcaseService = Depends(get_showcase_service)):
    return _call(service.catalog, design_id, estilo, format)


@router.get("/{design_id}/styles")
def get_styles(design_id: str, folder: str | None = None, episode: str | None = None,
               service: ShowcaseService = Depends(get_showcase_service)):
    return _call(service.styles, design_id, folder, episode)


@router.get("/{design_id}/styles/{estilo}")
def get_style(design_id: str, estilo: str, format: str = "16x9",
              service: ShowcaseService = Depends(get_showcase_service)):
    return _call(service.style, design_id, estilo, format)


class PrepareSceneRequest(BaseModel):
    estilo: str = Field(min_length=1, max_length=80)
    scene: dict = Field(default_factory=dict)
    config: dict = Field(default_factory=dict)
    format: str = "16x9"


@router.post("/{design_id}/prepare")
def prepare_scene(design_id: str, body: PrepareSceneRequest,
                  service: ShowcaseService = Depends(get_showcase_service)):
    from src.core.showcase.prepare import prepare_scene as prepare
    return _call(prepare, service, design_id, estilo=body.estilo, scene=body.scene,
                 config=body.config, format=body.format)


@router.get("/{design_id}/production-guide")
def production_guide(design_id: str, estilo: str | None = None, format: str = "16x9",
                     service: ShowcaseService = Depends(get_showcase_service)):
    styles = _call(service.styles, design_id)
    selected = estilo or styles["default"]
    catalog = _call(service.catalog, design_id, selected, format)
    return {
        "schema_version": 1, "design_id": design_id, "estilo": selected,
        "styles": styles["styles"], "estilo_revision": catalog.estilo_revision, "format": format,
        "prepare_url": f"/api/v1/showcase/designs/{design_id}/prepare",
        "workflow": ["Elegir un estilo una vez por episodio.",
                     "Consultar solo el contrato de las piezas elegidas con estilo y formato.",
                     "Escribir textos, geografía, medios y anclas de voz en la escena JSON.",
                     "Heredar tipografía, tamaños y posiciones del preset; sobrescribir solo excepciones.",
                     "Validar ambos formatos y guardar estilo y revisión junto a la escena."],
        "scene_fields": {"estilo": selected, "estiloRevision": 1} if design_id == "mapas-satelitales" else {"estilo": selected},
        "entry_url": f"/api/v1/showcase/designs/{design_id}/catalog/<id>?estilo={selected or ''}&format={format}",
        "style_url": f"/api/v1/showcase/designs/{design_id}/styles/{selected}?format={format}" if selected else None,
        "components": [{"id": e.id, "label": e.label, "summary": e.summary}
                       for e in catalog.entries if e.section != "sprites" and not e.name.startswith("common.")],
        "rules": {"engine_edits": False, "read_engine": False, "auto_record": False,
                  "timing": "Anclas de voz; conservar los datos del tema separados de la apariencia."},
    }


def _styled_target(service: ShowcaseService, design_id: str, entry: str | None, format: str, style: str | None) -> str:
    from src.adapters.showcase import posters
    selected_style = _call(service.style, design_id, style, format) if style else None
    if style and entry:
        _call(service.entry, design_id, entry, style, format)
    try:
        target = posters.with_style(_call(service.preview, design_id, entry, format), style)
        if selected_style:
            target += "&styleRevision=" + selected_style["revision"]
        return target
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
    path = posters.poster_path(layout.cache_dir, design_id, design.revision, entry, format, target,
                               engine=design.engine_id)
    if path.is_file():
        return FileResponse(path, media_type="image/webp", headers={"Cache-Control": "private, no-cache"})
    previous_style = posters.legacy_style_poster_path(layout.cache_dir, design_id, design.revision, entry, format,
                                                     target, engine=design.engine_id)
    if previous_style and previous_style.is_file():
        return FileResponse(previous_style, media_type="image/webp", headers={"Cache-Control": "private, no-cache"})
    source = await asyncio.to_thread(posters.source_revision, settings.templates_dir, layout.sandbox_dir, design.engine_id, target)
    revision = design.revision + source
    recoverable = (
        (posters.revision_scoped_poster_path(layout.cache_dir, design_id, revision, entry, format, target,
                                             engine=design.engine_id), "image/webp"),
        (posters.poster_path(layout.cache_dir, design_id, revision, entry, format, target, hashed=True), "image/webp"),
        (posters.poster_path(layout.cache_dir, design_id, revision, entry, format, target, legacy=True), "image/jpeg"),
        (posters.poster_path(layout.cache_dir, design_id, design.revision, entry, format, target, original=True), "image/jpeg"),
    )
    for candidate, media_type in recoverable:
        if candidate.is_file():
            return FileResponse(candidate, media_type=media_type, headers={"Cache-Control": "private, no-cache"})
    return Response(status_code=404, headers={"Cache-Control": "no-store"})


@router.get("/{design_id}/catalog/{entry_id}", response_model=Entry)
def get_entry(design_id: str, entry_id: str, estilo: str | None = None, format: str = "16x9",
              service: ShowcaseService = Depends(get_showcase_service)):
    return _call(service.entry, design_id, entry_id, estilo, format)


@router.get("/{design_id}/files/{path:path}")
def file(design_id: str, path: str, request: Request, service: ShowcaseService = Depends(get_showcase_service)):
    target = _call(service.file, design_id, path)
    return serve_file_with_range(target, request.headers.get("range"),
                                 mimetypes.guess_type(target.name)[0] or "application/octet-stream",
                                 if_none_match=request.headers.get("if-none-match"),
                                 if_modified_since=request.headers.get("if-modified-since"),
                                 if_range=request.headers.get("if-range"), cache_control="private, no-cache")


class PassToProductionRequest(BaseModel):
    category: str | None = None
    shared_categories: list[str] = Field(default_factory=list)


@router.post("/{design_id}/promote", response_model=Design, dependencies=[Depends(require_internal)])
def promote(design_id: str, body: PassToProductionRequest | None = None,
            service: ShowcaseService = Depends(get_showcase_service)):
    if body is None:
        return _call(service.promote, design_id)
    return _call(service.promote, design_id, body.category, body.shared_categories)
