"""Europeana Search API: objetos culturales, prensa, libros, video y 3D."""

from __future__ import annotations

from typing import Any

from src.adapters.researcher_data.infrastructure._normalization import (
    first,
    join_values,
)
from src.adapters.researcher_data.infrastructure.base import ResearchProvider
from src.adapters.researcher_data.models import ResearchResponse, ResearchResult


class EuropeanaProvider(ResearchProvider):
    name = "europeana"

    @property
    def configured(self) -> bool:
        return bool(self.config.europeana_api_key)

    async def search(
        self, query: str, *, page: int = 1, limit: int = 10, **filters: Any
    ) -> ResearchResponse:
        key = self.require(self.config.europeana_api_key, "EUROPEANA_API_KEY")
        limit = min(max(limit, 1), 100)
        params: dict[str, Any] = {
            "wskey": key,
            "query": query,
            "start": (max(page, 1) - 1) * limit,
            "rows": limit,
            "profile": filters.get("profile", "rich"),
            "media": str(filters.get("media", "true")).lower(),
            "thumbnail": "true",
        }
        if filters.get("qf"):
            params["qf"] = filters["qf"]
        body = await self.http.json(
            "GET",
            f"{self.config.europeana_api_url.rstrip('/')}/search.json",
            params=params,
        )
        rows = body.get("items", []) if isinstance(body, dict) else []
        results = [self._result(row) for row in rows]
        total = body.get("totalResults") if isinstance(body, dict) else None
        return ResearchResponse(
            provider=self.name,
            query=query,
            results=results,
            total=total,
            page=page,
            limit=limit,
            next_page=page + 1 if total is not None and page * limit < total else None,
        )

    def _result(self, row: dict[str, Any]) -> ResearchResult:
        media = first(row.get("edmIsShownBy")) or first(row.get("edmIsShownAt"))
        thumbnail = first(row.get("edmPreview"))
        kind = str(row.get("type") or "other").lower()
        if kind not in {"image", "video", "sound", "text", "3d", "other"}:
            kind = "other"
        return ResearchResult(
            provider=self.name,
            resource_id=first(row.get("id")),
            kind=kind,
            title=first(row.get("title")),
            description=first(row.get("dcDescription")),
            url=first(row.get("guid"))
            or f"https://www.europeana.eu/item/{first(row.get('id'))}",
            media_url=media,
            thumbnail_url=thumbnail,
            creator=join_values(row.get("dcCreator")),
            license=first(row.get("rights")),
            date=first(row.get("year")) or first(row.get("dcDate")),
            language=join_values(row.get("language")),
            metadata={
                "provider": row.get("edmProvider"),
                "data_provider": row.get("dataProvider"),
                "country": row.get("country"),
            },
        )

    async def record(self, record_id: str) -> dict[str, Any]:
        key = self.require(self.config.europeana_api_key, "EUROPEANA_API_KEY")
        return await self.http.json(
            "GET",
            f"{self.config.europeana_api_url.rstrip('/')}/record/{record_id.lstrip('/')}.json",
            params={"wskey": key, "profile": "rich"},
        )
