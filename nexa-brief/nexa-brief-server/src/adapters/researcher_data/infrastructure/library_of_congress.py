"""Library of Congress JSON API: colecciones históricas, fotos, mapas y video."""

from __future__ import annotations

from typing import Any

from src.adapters.researcher_data.infrastructure._normalization import (
    first,
    join_values,
)
from src.adapters.researcher_data.infrastructure.base import ResearchProvider
from src.adapters.researcher_data.models import ResearchResponse, ResearchResult


class LibraryOfCongressProvider(ResearchProvider):
    name = "library_of_congress"

    @property
    def configured(self) -> bool:
        return bool(self.config.loc_api_url)

    async def search(
        self, query: str, *, page: int = 1, limit: int = 10, **filters: Any
    ) -> ResearchResponse:
        limit = min(max(limit, 1), 100)
        params: dict[str, Any] = {
            "q": query,
            "fo": "json",
            "c": limit,
            "sp": page,
            "at": "results",
        }
        if filters.get("format"):
            endpoint = f"{self.config.loc_api_url.rstrip('/')}/{str(filters['format']).strip('/')}/"
        else:
            endpoint = f"{self.config.loc_api_url.rstrip('/')}/search/"
        if filters.get("facet"):
            params["fa"] = filters["facet"]
        body = await self.http.json("GET", endpoint, params=params)
        rows = body.get("results", []) if isinstance(body, dict) else []
        results = [self._result(row) for row in rows if isinstance(row, dict)]
        pagination = body.get("pagination", {}) if isinstance(body, dict) else {}
        total = pagination.get("total") or pagination.get("of")
        return ResearchResponse(
            provider=self.name,
            query=query,
            results=results,
            total=total,
            page=page,
            limit=limit,
            next_page=page + 1 if pagination.get("next") else None,
        )

    def _result(self, row: dict[str, Any]) -> ResearchResult:
        image = first(row.get("image_url"))
        resource_url = first(row.get("id")) or first(row.get("url"))
        return ResearchResult(
            provider=self.name,
            resource_id=resource_url.rstrip("/").split("/")[-1],
            kind=self._kind(row),
            title=first(row.get("title")) or first(row.get("item")),
            description=first(row.get("description")) or first(row.get("summary")),
            url=resource_url,
            media_url=image or first(row.get("resources")),
            thumbnail_url=image,
            creator=join_values(row.get("contributor"))
            or join_values(row.get("created_published")),
            date=first(row.get("date")),
            language=join_values(row.get("language")),
            metadata={
                "format": row.get("format"),
                "original_format": row.get("original_format"),
                "location": row.get("location"),
            },
        )

    @staticmethod
    def _kind(row: dict[str, Any]) -> str:
        text = " ".join(
            str(value).lower()
            for key in ("original_format", "format", "item_type")
            for value in (
                row.get(key) or [] if isinstance(row.get(key), list) else [row.get(key)]
            )
        )
        if "video" in text or "film" in text:
            return "video"
        if "photo" in text or "image" in text or "map" in text:
            return "image"
        return "document"

    async def item(self, item_url: str) -> dict[str, Any]:
        url = (
            item_url
            if item_url.startswith("http")
            else f"{self.config.loc_api_url.rstrip('/')}/item/{item_url.strip('/')}/"
        )
        return await self.http.json(
            "GET", url, params={"fo": "json", "at": "item,resources"}
        )
