"""Niches router — read-only listing of nichos definidos en niches.json.

Reemplaza al viejo /categories (borrado por quedar desincronizado del
verdadero comportamiento del pipeline). niches.json es ahora la única
fuente de verdad de qué nichos existen y cómo se comportan.
"""

from __future__ import annotations

import structlog
from fastapi import APIRouter, HTTPException

from src.config.niche_config import get_niche_config, list_all_niches
from src.presentation.api.schemas.niche_schema import NicheResponse

router = APIRouter(tags=["niches"])
logger = structlog.get_logger(__name__)


@router.get("/niches", response_model=list[NicheResponse])
async def list_niches() -> list[NicheResponse]:
    """List all niches defined in niches.json (active and inactive)."""
    return [
        NicheResponse(
            id=n.id,
            display_name=n.display_name,
            description=n.description,
            pipeline_type=n.pipeline_type,
            active=n.active,
        )
        for n in list_all_niches()
    ]


@router.get("/niches/{niche_id}", response_model=NicheResponse)
async def get_niche(niche_id: str) -> NicheResponse:
    """Get a specific niche by ID."""
    if niche_id not in {n.id for n in list_all_niches()}:
        raise HTTPException(status_code=404, detail=f"Niche '{niche_id}' not found.")
    n = get_niche_config(niche_id)
    return NicheResponse(
        id=n.id,
        display_name=n.display_name,
        description=n.description,
        pipeline_type=n.pipeline_type,
        active=n.active,
    )
