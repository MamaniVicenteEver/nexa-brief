"""Ficha y catálogo comunes, independientes del estado y motor del diseño."""
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class Episode(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    title: str
    design_id: str
    preview_url: str | None = None


class Design(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    category: str
    state: Literal["prueba", "produccion"]
    family: str
    engine_id: str
    description: str = ""
    revision: str
    catalog_url: str = ""
    preview_url: str | None = None
    promotable: bool = False
    promote_blocker: str | None = None
    episodes: list[Episode] = Field(default_factory=list)


class Entry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    label: str
    kind: Literal["component", "set", "character", "action", "workflow"]
    summary: str = ""
    tags: list[str] = Field(default_factory=list)
    family: str = ""
    section: Literal["components", "sprites", "workflows"] = "components"
    params: dict[str, Any] = Field(default_factory=dict)
    example: dict[str, Any] = Field(default_factory=dict)
    preview_url: str | None = None
    preview_kind: Literal["iframe", "image", "json"]
    data: Any | None = None


class CatalogGroup(BaseModel):
    """Named navigation declared by a design, independent of its render contract."""
    id: str
    label: str
    families: list[str] = Field(default_factory=list)
    components: list[str] = Field(default_factory=list)


class Catalog(BaseModel):
    schema_version: Literal[1] = 1
    design_id: str
    revision: str
    entries: list[Entry]
    groups: list[CatalogGroup] = Field(default_factory=list)


class DesignList(BaseModel):
    schema_version: Literal[1] = 1
    designs: list[Design]


class SandboxShowcaseState(BaseModel):
    folder: str
    project_id: str
    design_id: str
    visible: bool
    managed: bool
    component_count: int | None = None
