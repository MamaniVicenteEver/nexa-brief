"""Respuestas de la API de investigaciones (pestaña Investigaciones de Recursos)."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ResearchCountsResponse(BaseModel):
    findings: int = 0
    sources: int = 0
    discarded: int = 0
    images: int = 0
    files: int = 0
    videos: int = 0


class ResearchCardResponse(BaseModel):
    research_id: str
    topic: str
    researched_at: str = ""
    origin_root: str = ""
    origin_category: str = ""
    origin_video_id: str = ""
    origin_path: str = ""
    revision: str = ""
    version_count: int = 1
    tags: list[str] = Field(default_factory=list)
    counts: ResearchCountsResponse
    cover_url: str | None = None


class ResearchPageResponse(BaseModel):
    items: list[ResearchCardResponse]
    total: int
    page: int
    page_size: int


class ResearchSyncResponse(BaseModel):
    folders: int
    created: int
    merged: int
    skipped: int
    errors: list[str] = Field(default_factory=list)


class ResearchSourceResponse(BaseModel):
    title: str = ""
    url: str = ""
    data_date: str = ""
    accessed_at: str = ""


class ResearchFindingResponse(BaseModel):
    id: str = ""
    claim: str = ""
    strength: int | None = None
    recency: str = ""
    sources: list[ResearchSourceResponse] = Field(default_factory=list)


class ResearchDiscardedResponse(BaseModel):
    claim: str = ""
    reason: str = ""


class ResearchImageResponse(BaseModel):
    path: str
    url: str
    source_url: str = ""
    license: str = ""
    credit: str = ""


class ResearchFileResponse(BaseModel):
    path: str
    url: str
    bytes: int = 0


class ResearchVersionResponse(BaseModel):
    research_id: str
    revision: str = ""
    researched_at: str = ""
    topic: str = ""


class ResearchUsageResponse(BaseModel):
    video_id: str
    at: str = ""


class ResearchDetailResponse(BaseModel):
    research_id: str
    topic: str
    researched_at: str = ""
    origin_root: str = ""
    origin_category: str = ""
    origin_video_id: str = ""
    origin_path: str = ""
    revision: str = ""
    tags: list[str] = Field(default_factory=list)
    counts: ResearchCountsResponse
    summary: str = ""
    findings: list[ResearchFindingResponse] = Field(default_factory=list)
    discarded: list[ResearchDiscardedResponse] = Field(default_factory=list)
    images: list[ResearchImageResponse] = Field(default_factory=list)
    files: list[ResearchFileResponse] = Field(default_factory=list)
    versions: list[ResearchVersionResponse] = Field(default_factory=list)
    used_by: list[ResearchUsageResponse] = Field(default_factory=list)
