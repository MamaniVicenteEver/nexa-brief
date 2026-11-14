"""Read contracts for Biblioteca. No HTTP, filesystem or database dependencies."""
from __future__ import annotations

from typing import Any, Literal
from pydantic import BaseModel, Field
from src.core.ports.biblioteca_query import LibraryQueryPort

MediaType = Literal["videos", "images"]
LibraryStatus = Literal["ready", "scheduled", "published", "processing", "failed"]
LibraryTab = Literal["all", "pending", "published", "processing", "failed"]
LibrarySort = Literal["newest", "oldest", "longest", "title"]
PAGE_SIZE = 20


class LibraryQuery(BaseModel):
    media: MediaType = "videos"
    q: str = Field(default="", max_length=200)
    category: str = Field(default="", max_length=100)
    status: LibraryTab = "all"
    sort: LibrarySort = "newest"
    page: int = Field(default=1, ge=1, le=100000)


class LibraryItem(BaseModel):
    kind: Literal["video", "recording", "image"]
    id: str
    category_id: str
    category_label: str
    title: str
    status: LibraryStatus
    updated_at: str
    duration_seconds: float | None = None
    payload: dict[str, Any]


class CategoryFacet(BaseModel):
    id: str
    label: str
    count: int


class LibraryPage(BaseModel):
    items: list[LibraryItem]
    total: int
    page: int
    page_size: int = PAGE_SIZE
    unfiltered_total: int
    categories: list[CategoryFacet]
    status_counts: dict[str, int]
    has_active_jobs: bool = False


class BibliotecaService:
    def __init__(self, queries: LibraryQueryPort):
        self.queries = queries

    def list(self, query: LibraryQuery) -> LibraryPage:
        return self.queries.query(query)
