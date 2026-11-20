"""Modelos de salida comunes a todos los proveedores de investigación."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class ResearchResult(BaseModel):
    provider: str
    resource_id: str
    kind: str = "other"
    title: str = ""
    description: str = ""
    url: str = ""
    media_url: str = ""
    thumbnail_url: str = ""
    creator: str = ""
    license: str = ""
    date: str = ""
    language: str = ""
    metadata: dict[str, Any] = Field(default_factory=dict)


class ResearchResponse(BaseModel):
    provider: str
    query: str
    results: list[ResearchResult] = Field(default_factory=list)
    total: int | None = None
    page: int = 1
    limit: int = 10
    next_page: int | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class ProviderIssue(BaseModel):
    provider: str
    code: str
    message: str


class AggregatedResearchResponse(BaseModel):
    query: str
    results: list[ResearchResult] = Field(default_factory=list)
    provider_errors: list[ProviderIssue] = Field(default_factory=list)
    providers_queried: list[str] = Field(default_factory=list)


class ResearchProviderError(RuntimeError):
    """Error estable para que el agregador no detenga a los otros proveedores."""

    def __init__(self, provider: str, code: str, message: str) -> None:
        super().__init__(message)
        self.provider = provider
        self.code = code
