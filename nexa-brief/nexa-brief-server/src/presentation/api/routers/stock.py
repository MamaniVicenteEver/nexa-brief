"""Router /stock — búsqueda en Pexels/Pixabay/Unsplash e importación a la librería.

Solo traduce HTTP ↔ servicio: la lógica (paralelismo, caché, dedup) vive en
`src.core.stock.service`, que también usa el director de medios con IA.
Ver docs/investigaciones/estudio-creacion-interactiva-2026-09.md §3.3.
"""

from __future__ import annotations

from typing import Literal

import structlog
from fastapi import APIRouter, HTTPException, Query

from src.config.exceptions import AssetDownloadError
from src.core.stock import StockImportError, import_stock_item, provider_status, search_stock
from src.presentation.api.schemas.stock_schema import (
    StockImportRequest,
    StockImportResponse,
    StockProviderStatus,
    StockSearchResponse,
)

router = APIRouter(prefix="/stock", tags=["stock"])
logger = structlog.get_logger(__name__)

_FILE_ROUTE = {"image": "images", "video": "videos"}


@router.get("/providers", response_model=list[StockProviderStatus])
async def list_providers() -> list[StockProviderStatus]:
    """Proveedores disponibles, si tienen API key y qué tipos de medio buscan."""
    return [StockProviderStatus(**p) for p in provider_status()]


@router.get("/search", response_model=StockSearchResponse)
async def search(
    q: str = Query(min_length=1, max_length=100),
    kind: Literal["image", "video"] = "image",
    orientation: Literal["landscape", "portrait", "square"] | None = None,
    providers: str | None = Query(default=None, description="Lista separada por comas; vacío = todos"),
    page: int = Query(default=1, ge=1, le=100),
    per_page: int = Query(default=15, ge=1, le=30, description="Resultados POR proveedor"),
) -> StockSearchResponse:
    """Busca en paralelo; los proveedores que fallan se informan en provider_errors."""
    if not q.strip():
        raise HTTPException(status_code=422, detail="q no puede estar vacío")
    names = [p.strip() for p in providers.split(",") if p.strip()] if providers else None
    result = await search_stock(
        q.strip(), kind, orientation=orientation, providers=names, page=page, per_page=per_page
    )
    return StockSearchResponse(**result.model_dump())


@router.post("/import", response_model=StockImportResponse)
async def import_item(body: StockImportRequest) -> StockImportResponse:
    """Descarga el medio elegido y lo deja en la librería (idempotente por provider_id)."""
    try:
        result = await import_stock_item(**body.model_dump())
    except StockImportError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except AssetDownloadError as exc:
        # El proveedor no entregó el archivo (URL vencida, caído): no es culpa del pedido.
        logger.warning("stock_import_download_failed", provider=body.provider, error=str(exc))
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    entry = result.entry
    return StockImportResponse(
        asset_id=entry.asset_id,
        kind=result.kind,
        file_url=f"/api/v1/library/{_FILE_ROUTE[result.kind]}/{entry.asset_id}/file",
        already_imported=result.already_imported,
        category=entry.category,
        provider=entry.provider,
        label=entry.label,
        original_url=entry.original_url,
        width=entry.width,
        height=entry.height,
        duration_seconds=getattr(entry, "duration_seconds", None),
        license_note=entry.license_note,
    )
