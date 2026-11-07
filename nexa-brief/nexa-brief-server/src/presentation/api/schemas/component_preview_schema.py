"""Contratos de la API de vistas previas aisladas de componentes."""

from __future__ import annotations

from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ComponentPreviewItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    key: str = Field(min_length=1, max_length=100)
    video_id: str = Field(pattern=r"^[a-z0-9][a-z0-9-]{1,79}$")
    component: str = Field(pattern=r"^[a-z][a-z0-9_-]*\.[A-Za-z0-9]+$")
    scope: Literal["kit", "sandbox"] = "kit"
    components: list[Annotated[str, Field(pattern=r"^[a-z][a-z0-9_-]*\.[A-Za-z0-9]+$")]] | None = Field(default=None, max_length=16)
    params: dict[str, Any] = Field(default_factory=dict)
    time_seconds: float = 3
    duration_seconds: float = 6


    @model_validator(mode="after")
    def validate_scope(self):
        if self.scope == "kit":
            if self.components is not None:
                raise ValueError("components solo se admite para sandbox")
            if not 0 <= self.time_seconds <= 20 or not 1 <= self.duration_seconds <= 30:
                raise ValueError("Tiempo o duración fuera de los límites del kit")
        return self


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
