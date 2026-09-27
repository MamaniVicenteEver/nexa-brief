"""Niches router — read-only listing of nichos definidos en niches.json.

Reemplaza al viejo /categories (borrado por quedar desincronizado del
verdadero comportamiento del pipeline). niches.json es ahora la única
fuente de verdad de qué nichos existen y cómo se comportan.
"""

from __future__ import annotations

import structlog
from fastapi import APIRouter, HTTPException

from src.adapters.recorder.infrastructure import hyperframes_adapter, remotion_adapter
from src.config.niche_config import get_niche_config, list_all_niches
from src.config.template_manifest import get_template_display_name
from src.presentation.api.schemas.niche_schema import NicheResponse

router = APIRouter(tags=["niches"])
logger = structlog.get_logger(__name__)


def _supported_engines(n) -> list[str]:
    # Mismo cálculo que _validate_recorder_engine_override en videos.py, pero
    # expuesto por API en vez de descubrirse recién al fallar un submit con
    # 400 — "playwright" es el motor universal (nunca falla, no requiere
    # composición portada), por eso siempre está.
    engines = ["playwright"]
    if remotion_adapter.supports_niche(n):
        engines.append("remotion")
    if hyperframes_adapter.supports_niche(n):
        engines.append("hyperframes")
    return engines


def _to_response(n) -> NicheResponse:
    # Mismo manifest único que usa /templates (src/templates/templates.json)
    # — evita que "Crear video" y "Plantillas" muestren nombres distintos
    # para el mismo template. Nichos legacy sin template_id (freeform_html)
    # simplemente no matchean nada y quedan con su display_name de siempre.
    return NicheResponse(
        id=n.id,
        display_name=get_template_display_name(n.template.template_id, fallback=n.display_name),
        description=n.description,
        pipeline_type=n.pipeline_type,
        active=n.active,
        recorder_engine=n.recorder_engine,
        supported_engines=_supported_engines(n),
    )


@router.get("/niches", response_model=list[NicheResponse])
async def list_niches() -> list[NicheResponse]:
    """List all niches defined in niches.json (active and inactive)."""
    return [_to_response(n) for n in list_all_niches()]


@router.get("/niches/{niche_id}", response_model=NicheResponse)
async def get_niche(niche_id: str) -> NicheResponse:
    """Get a specific niche by ID."""
    if niche_id not in {n.id for n in list_all_niches()}:
        raise HTTPException(status_code=404, detail=f"Niche '{niche_id}' not found.")
    return _to_response(get_niche_config(niche_id))
