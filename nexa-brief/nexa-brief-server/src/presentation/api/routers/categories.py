"""Categories router — árbol de categorías principales (niches.json → categories).

Lo usan la web (ventanas por categoría, filtro de horarios) y cualquier
cliente que necesite saber qué nichos o diseños cuelgan de cada categoría.
Un `niche_filter` de horario puede ser cualquier `path` de este árbol:
el filtro 'node_motion' también toma los videos de 'node_motion/letras'.
"""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field

from src.core.categories import CategoryNode, list_categories

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
        designs=node.designs,
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
