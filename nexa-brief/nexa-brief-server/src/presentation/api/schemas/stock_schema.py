"""Schemas de /stock/* (búsqueda en bancos de stock e importación)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from src.core.ports.stock_media_port import StockItem
from src.core.stock import StockProviderIssue


class StockSearchResponse(BaseModel):
    results: list[StockItem]
    provider_errors: list[StockProviderIssue] = []


class StockProviderStatus(BaseModel):
    name: str
    configured: bool
    kinds: list[str]


class StockImportRequest(BaseModel):
    """Lo mismo que trae un resultado de búsqueda: la UI reenvía el ítem elegido."""

    provider: str
    provider_id: str = Field(min_length=1)
    kind: Literal["image", "video"]
    download_url: str = Field(min_length=1)
    title: str = ""
    author: str = ""
    author_url: str = ""
    source_url: str = ""
    license: str = ""
    category: str | None = None     # carpeta de la librería; por defecto "stock"


class StockImportResponse(BaseModel):
    asset_id: str
    kind: Literal["image", "video"]
    file_url: str                   # /api/v1/library/{images|videos}/{asset_id}/file
    already_imported: bool          # True = ya estaba en la librería, no se volvió a bajar
    category: str
    provider: str
    label: str = ""
    original_url: str | None = None
    width: int = 0
    height: int = 0
    duration_seconds: float | None = None
    license_note: str = ""
