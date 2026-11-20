"""Categories router — árbol de categorías principales (niches.json → categories).

Lo usan la web (ventanas por categoría, filtro de horarios) y cualquier
cliente que necesite saber qué nichos o diseños cuelgan de cada categoría.
La creación se expone en POST /categories y comparte el servicio de provisión
con scripts/create_category.py.
Un `niche_filter` de horario puede ser cualquier `path` de este árbol:
el filtro 'node_motion' también toma los videos de 'node_motion/letras'.
"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from src.core.categories import CategoryNode, list_categories
from src.core.category_creation import (
    CategoryConflictError,
    CategoryCreationError,
    CategoryProvisioningError,
    create_category,
)
from src.presentation.api.schemas.category_schema import CategoryCreateRequest
from src.presentation.api.security import require_internal

router = APIRouter(tags=["categories"])


class CategoryResponse(BaseModel):
    id: str
    path: str
    display_name: str
    topic: str
    status: str
    engine: str
    niches: list[str] = Field(default_factory=list)
    designs: list[str] = Field(default_factory=list)
    strategy: dict | None = None
    children: list["CategoryResponse"] = Field(default_factory=list)


CategoryResponse.model_rebuild()


class CategoryUpdateRequest(BaseModel):
    display_name: str | None = Field(default=None, min_length=2, max_length=48)
    topic: str | None = Field(default=None, max_length=180)
    status: Literal['active', 'planned', 'empty'] | None = None
    language: Literal['en', 'es-419'] | None = None




def _to_response(node_id: str, node: CategoryNode, prefix: str = "") -> CategoryResponse:
    path = f"{prefix}/{node_id}" if prefix else node_id
    return CategoryResponse(
        id=node_id,
        path=path,
        display_name=node.display_name,
        topic=node.topic,
        status=node.status,
        engine=node.engine,
        niches=node.niches,
        designs=list(dict.fromkeys([*node.designs, *node.shared_designs])),
        strategy=node.strategy.model_dump() if node.strategy else None,
        children=[_to_response(cid, child, path) for cid, child in node.children.items()],
    )


@router.get("/categories/overview")
async def categories_overview() -> list[dict]:
    """Resumen por categoría principal para el dashboard: embudo (produciendo →
    listo → grabado → publicado), horarios, próxima publicación y qué falta
    para que publique sola. Ver src/core/automation.py."""
    from src.core.automation import category_overview

    return category_overview()


@router.get("/categories", response_model=list[CategoryResponse])
async def list_category_tree() -> list[CategoryResponse]:
    return [_to_response(cid, node) for cid, node in list_categories().items()]


@router.post(
    "/categories",
    response_model=CategoryResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_internal)],
)
def create_category_endpoint(body: CategoryCreateRequest) -> CategoryResponse:
    """Create a category entry and scaffold its profile folders."""
    try:
        created = create_category(
            body.display_name,
            topic=body.topic,
            language=body.language,
        )
    except CategoryConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except CategoryCreationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except CategoryProvisioningError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc
    return _to_response(created.category_id, created.category)


@router.get('/categories/{category_id}', response_model=CategoryResponse)
def get_category_endpoint(category_id: str):
    node = list_categories().get(category_id)
    if node is None:
        raise HTTPException(status_code=404, detail='Categoría no encontrada')
    return _to_response(category_id, node)


@router.patch('/categories/{category_id}', response_model=CategoryResponse, dependencies=[Depends(require_internal)])
def update_category_endpoint(category_id: str, body: CategoryUpdateRequest):
    from src.core.category_management import manage_category
    try:
        node = manage_category(category_id, body.model_dump(exclude_none=True))
        return _to_response(category_id, node)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail='Categoría no encontrada') from exc
    except CategoryConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except (CategoryCreationError, ValueError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.delete('/categories/{category_id}', status_code=204, dependencies=[Depends(require_internal)])
def delete_category_endpoint(category_id: str):
    from src.core.category_management import manage_category
    try:
        manage_category(category_id, None)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail='Categoría no encontrada') from exc
    except CategoryConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

