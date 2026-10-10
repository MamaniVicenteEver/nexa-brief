"""Router 'media_plans' — director de medios con IA (F4).

POST crea el plan y lo arma en segundo plano (202 + polling por GET), porque
la IA y tres bancos de stock tardan varios segundos. Las dependencias de
infraestructura (búsqueda/importación de stock, cliente de IA) se inyectan
desde acá: core/media_director.py no conoce adapters/.

Ver docs/investigaciones/estudio-creacion-interactiva-2026-09.md §3.4.
"""

from __future__ import annotations

import asyncio

import structlog
from fastapi import APIRouter, HTTPException

from src.config.template_manifest import get_template_description, get_template_inputs
from src.core import media_director
from src.core.media_director import MediaPlanNotFoundError, MediaPlanStateError
from src.core.ports.ai_port import AIPort
from src.core.ports.stock_media_port import StockItem
from src.core.stock import import_stock_item, search_stock
from src.core.template_inputs import TemplateInputs
from src.presentation.api.schemas.media_plan_schema import (
    MediaPlanAcceptResponse,
    MediaPlanCreateRequest,
    MediaPlanResponse,
    MediaPlanSelectionRequest,
)

router = APIRouter(tags=["media_plans"])
logger = structlog.get_logger(__name__)

_plan_tasks: set[asyncio.Task] = set()


def _analysis_ai() -> AIPort | None:
    """Cliente de IA para las consultas; sin key configurada el director usa su fallback."""
    try:
        from src.adapters.ai.factory import get_analysis_ai

        return get_analysis_ai()
    except Exception as exc:  # noqa: BLE001 - la IA es opcional para el plan
        logger.warning("media_plan_ai_unavailable", error=str(exc))
        return None


async def _import_item(item: StockItem) -> str:
    result = await import_stock_item(
        provider=item.provider,
        provider_id=item.provider_id,
        kind=item.kind,
        download_url=item.download_url,
        title=item.title,
        author=item.author,
        author_url=item.author_url,
        source_url=item.source_url,
        license=item.license,
    )
    return result.entry.asset_id


def _get_or_404(plan_id: str) -> dict:
    try:
        return media_director.get_plan(plan_id)
    except MediaPlanNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/media-plans", response_model=MediaPlanResponse, status_code=202)
async def create_media_plan(body: MediaPlanCreateRequest) -> MediaPlanResponse:
    requirements = get_template_inputs(body.template_id)
    if requirements is None:
        raise HTTPException(status_code=404, detail=f"Template '{body.template_id}' not found")
    try:
        plan = await media_director.create_plan(
            body.template_id,
            requirements,
            brief=body.brief,
            description=get_template_description(body.template_id, ""),
            locks=body.locks,
        )
    except MediaPlanStateError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    task = asyncio.create_task(
        media_director.run_plan(plan["plan_id"], search=search_stock, ai=_analysis_ai())
    )
    _plan_tasks.add(task)
    task.add_done_callback(_plan_tasks.discard)
    return MediaPlanResponse.model_validate(plan)


@router.get("/media-plans/{plan_id}", response_model=MediaPlanResponse)
async def get_media_plan(plan_id: str) -> MediaPlanResponse:
    _get_or_404(plan_id)
    return MediaPlanResponse.model_validate(await media_director.fail_if_stale(plan_id))


@router.patch("/media-plans/{plan_id}", response_model=MediaPlanResponse)
async def update_media_plan(plan_id: str, body: MediaPlanSelectionRequest) -> MediaPlanResponse:
    _get_or_404(plan_id)
    try:
        plan = await media_director.update_selection(plan_id, body.selected)
    except MediaPlanStateError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return MediaPlanResponse.model_validate(plan)


@router.post("/media-plans/{plan_id}/accept", response_model=MediaPlanAcceptResponse)
async def accept_media_plan(plan_id: str) -> MediaPlanAcceptResponse:
    plan = _get_or_404(plan_id)
    try:
        media = await media_director.accept_plan(plan_id, importer=_import_item)
    except MediaPlanStateError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001 - descarga fallida (ej. URL de Pixabay vencida)
        logger.error("media_plan_accept_failed", plan_id=plan_id, error=str(exc))
        raise HTTPException(status_code=502, detail=f"No se pudo importar un medio: {exc}") from exc
    return MediaPlanAcceptResponse(
        plan_id=plan_id,
        template_inputs=TemplateInputs(media=media, brief=plan.get("brief")),
    )
