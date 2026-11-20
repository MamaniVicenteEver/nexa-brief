"""Reviewed passage of a principal design demo into production.

The application service owns the state transition; adapters own filesystem,
catalogue, image capture and profile persistence. No operation records video.
"""
from __future__ import annotations

from typing import Any, Protocol

from pydantic import BaseModel, ConfigDict, Field


class ProductionError(ValueError):
    pass


class ProductionConflict(ProductionError):
    pass


class ProductionSelection(BaseModel):
    model_config = ConfigDict(extra="forbid")
    category: str = Field(min_length=1, max_length=128)
    shared_categories: list[str] = Field(default_factory=list, max_length=30)


class ProductionDraft(ProductionSelection):
    title: str = Field(min_length=1, max_length=150)
    description: str = Field(min_length=1, max_length=5000)
    # Accepted for old clients only; technical validation never consumes it.
    publication: dict[str, Any] = Field(default_factory=dict, exclude=True)
    demo: bool = True
    poster_styles: list[str] = Field(default_factory=list, max_length=32)


class ProductionRepository(Protocol):
    def inspect(self, folder: str, project: str) -> dict: ...
    async def save(self, folder: str, project: str, draft: dict) -> dict: ...
    async def reset(self, folder: str, project: str) -> dict: ...
    async def validate(self, folder: str, project: str) -> dict: ...
    async def move(self, folder: str, project: str, selection: dict) -> dict: ...


class DesignProductionService:
    def __init__(self, repository: ProductionRepository):
        self.repository = repository

    def get(self, folder, project):
        return self.repository.inspect(folder, project)

    async def update(self, folder, project, draft: ProductionDraft):
        if not draft.title.strip() or not draft.description.strip():
            raise ProductionError("Escribe el título y la descripción del diseño")
        return await self.repository.save(folder, project, draft.model_dump())

    async def delete(self, folder, project):
        return await self.repository.reset(folder, project)

    async def validate(self, folder, project):
        return await self.repository.validate(folder, project)

    async def pass_to_production(self, folder, project, selection: ProductionSelection):
        return await self.repository.move(folder, project, selection.model_dump())
