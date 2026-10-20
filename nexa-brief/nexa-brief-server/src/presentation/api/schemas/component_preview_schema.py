"""Contratos de la API de vistas previas aisladas de componentes."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ComponentPreviewItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    key: str = Field(min_length=1, max_length=100)
    video_id: str = Field(pattern=r"^[a-z0-9][a-z0-9-]{1,79}$")
    component: str = Field(pattern=r"^[a-z][a-z0-9_-]*\.[A-Za-z0-9]+$")
    params: dict[str, Any] = Field(default_factory=dict)
    time_seconds: float = Field(default=3, ge=0, le=20)
    duration_seconds: float = Field(default=6, ge=1, le=30)


class ComponentPreviewBatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    previews: list[ComponentPreviewItem] = Field(min_length=1, max_length=24)


class ComponentPreviewItemResponse(BaseModel):
    key: str
    video_id: str
    design: str
    component: str
    preview_url: str


class ComponentPreviewBatchResponse(BaseModel):
    previews: list[ComponentPreviewItemResponse]
