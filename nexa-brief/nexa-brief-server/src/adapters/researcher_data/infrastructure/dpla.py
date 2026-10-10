"""Digital Public Library of America API v2."""

from __future__ import annotations

from typing import Any

from src.adapters.researcher_data.infrastructure._normalization import (
    first,
    join_values,
)
from src.adapters.researcher_data.infrastructure.base import ResearchProvider
from src.adapters.researcher_data.models import ResearchResponse, ResearchResult


class DPLAProvider(ResearchProvider):
    name = "dpla"

    @property
    def configured(self) -> bool:
        return bool(self.config.dpla_api_key)

    async def search(
        self, query: str, *, page: int = 1, limit: int = 10, **filters: Any
    ) -> ResearchResponse:
        key = self.require(self.config.dpla_api_key, "DPLA_API_KEY")
        limit = min(max(limit, 1), 100)
        params: dict[str, Any] = {
            "q": query,
            "api_key": key,
            "page_size": limit,
            "page": max(page, 1),
        }
        for field in (
            "sourceResource.title",
            "sourceResource.type",
            "sourceResource.language.name",
            "sourceResource.date.displayDate",
        ):
            if filters.get(field):
                params[field] = filters[field]
        body = await self.http.json(
            "GET", f"{self.config.dpla_api_url.rstrip('/')}/items", params=params
        )
        rows = body.get("docs", []) if isinstance(body, dict) else []
        results = [self._result(row) for row in rows]
        total = body.get("count") if isinstance(body, dict) else None
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
        resource = row.get("sourceResource") or {}
        media = first(row.get("object")) or first(row.get("hasView"))
        kind = first(resource.get("type")) or "document"
        if kind.lower() in {"image", "moving image", "sound"}:
            kind = {"moving image": "video", "sound": "audio"}.get(
                kind.lower(), kind.lower()
            )
        date_value = resource.get("date")
        if isinstance(date_value, dict):
            date_value = (
                date_value.get("displayDate")
                or date_value.get("begin")
                or date_value.get("end")
            )
        return ResearchResult(
            provider=self.name,
            resource_id=first(row.get("id")),
            kind=kind,
            title=first(resource.get("title")),
            description=first(resource.get("description")),
            url=first(row.get("isShownAt")) or first(row.get("dataProvider")),
            media_url=media,
            thumbnail_url=first(row.get("thumbnail")),
            creator=join_values(resource.get("creator")),
            date=first(date_value),
            language=join_values(resource.get("language")),
            license=first(resource.get("rights")),
            metadata={
                "provider": row.get("provider"),
                "data_provider": row.get("dataProvider"),
                "collection": row.get("object"),
                "raw_type": resource.get("type"),
            },
        )

    async def item(self, item_id: str) -> dict[str, Any]:
        key = self.require(self.config.dpla_api_key, "DPLA_API_KEY")
        return await self.http.json(
            "GET",
            f"{self.config.dpla_api_url.rstrip('/')}/items/{item_id}",
            params={"api_key": key},
        )
