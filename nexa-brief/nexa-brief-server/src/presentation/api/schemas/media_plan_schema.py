"""Schemas de /media-plans (director de medios con IA)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from src.core.ports.stock_media_port import StockItem
from src.core.stock import StockProviderIssue
from src.core.template_inputs import TemplateInputs


class MediaPlanCreateRequest(BaseModel):
    template_id: str = Field(min_length=1)
    brief: str | None = Field(default=None, max_length=2000)
    # slot → asset_ids que el usuario ya eligió: ese slot no se busca.
    locks: dict[str, list[str]] = Field(default_factory=dict)


class MediaPlanSelectionRequest(BaseModel):
    # slot → refs "proveedor:provider_id" (o índices de candidates como texto).
    selected: dict[str, list[str]]


class MediaPlanProgress(BaseModel):
    done: int = 0
    total: int = 0


class MediaPlanSlotResponse(BaseModel):
    slot: str
    kind: Literal["image", "video", "image|video"]
    search_kind: Literal["image", "video"]
    count: int
    min: int
    max: int
    orientation: str | None = None
    label: str
    hint: str = ""
    locked: bool = False
    locked_asset_ids: list[str] = []
    query: str | None = None
    candidates: list[StockItem] = []
    selected: list[str] = []
    provider_errors: list[StockProviderIssue] = []


class MediaPlanResponse(BaseModel):
    plan_id: str
    template_id: str
    brief: str | None = None
    status: Literal["planning", "ready", "failed"]
    error: str | None = None
    progress: MediaPlanProgress
    slots: list[MediaPlanSlotResponse]
    accepted_media: dict[str, list[str]] | None = None
    created_at: str
    updated_at: str


class MediaPlanAcceptResponse(BaseModel):
    plan_id: str
    # Listo para POST /drafts: {"media": {slot: [asset_ids]}, "texts": {}, "brief": ...}
    template_inputs: TemplateInputs
