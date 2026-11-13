from __future__ import annotations

from collections.abc import Callable, Iterator
from dataclasses import dataclass
from typing import Literal

from pydantic import BaseModel, Field


class CatalogCategory(BaseModel):
    id: str
    name: str
    status: str = "active"


class Playback(BaseModel):
    engine_url: str | None = None
    desktop_video_url: str | None = None
    mobile_video_url: str | None = None
    engine: Literal["template", "explainer"] = "explainer"


class CatalogItem(BaseModel):
    id: str
    source_id: str
    kind: Literal["template", "demo"]
    title: str
    category_ids: list[str]
    poster_url: str | None = None
    orientation: Literal["9:16", "16:9", "any"] = "any"
    demo: bool = True
    playback: Playback
    design_id: str | None = None


class CatalogPage(BaseModel):
    items: list[CatalogItem]
    categories: list[CatalogCategory]
    total: int
    page: int
    page_size: int | Literal["all"]
    total_pages: int
    category_counts: dict[str, int] = Field(default_factory=dict)


@dataclass(frozen=True)
class CategorySnapshot:
    categories: list[CatalogCategory]
    folder_categories: dict[str, str]
    template_categories: dict[str, str]
    shared_design_categories: dict[str, list[str]]


@dataclass(frozen=True)
class MediaObject:
    """Storage-neutral stream: adapters never expose pathlib.Path to the core."""

    content_type: str
    size: int
    etag: str
    read: Callable[[int, int], Iterator[bytes]]
