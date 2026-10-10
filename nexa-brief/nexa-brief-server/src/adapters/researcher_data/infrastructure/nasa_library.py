"""NASA Image and Video Library (images.nasa.gov)."""

from __future__ import annotations

from typing import Any

from src.adapters.researcher_data.infrastructure._normalization import first, nested
from src.adapters.researcher_data.infrastructure.base import ResearchProvider
from src.adapters.researcher_data.models import ResearchResponse, ResearchResult


class NASAImageVideoProvider(ResearchProvider):
    name = "nasa_image_video_library"

    @property
    def configured(self) -> bool:
        return bool(self.config.nasa_images_api_url)

    async def search(
        self, query: str, *, page: int = 1, limit: int = 10, **filters: Any
    ) -> ResearchResponse:
        media_type = filters.get("media_type")
        limit = min(max(limit, 1), 100)
        params: dict[str, Any] = {"q": query, "page": page, "page_size": limit}
        if media_type:
            params["media_type"] = media_type
        body = await self.http.json(
            "GET",
            f"{self.config.nasa_images_api_url.rstrip('/')}/search",
            params=params,
        )
        collection = body.get("collection", {}) if isinstance(body, dict) else {}
        rows = collection.get("items", []) if isinstance(collection, dict) else []
        results = [self._result(row) for row in rows if isinstance(row, dict)]
        metadata = (
            collection.get("metadata", {}) if isinstance(collection, dict) else {}
        )
        return ResearchResponse(
            provider=self.name,
            query=query,
            results=results,
            total=metadata.get("total_hits"),
            page=page,
            limit=limit,
            next_page=page + 1 if len(results) == limit else None,
        )

    def _result(self, item: dict[str, Any]) -> ResearchResult:
        data = (item.get("data") or [{}])[0]
        links = item.get("links") or []
        preview = next(
            (first(link.get("href")) for link in links if link.get("rel") == "preview"),
            "",
        )
        href = first(item.get("href"))
        kind = first(data.get("media_type")) or "other"
        return ResearchResult(
            provider=self.name,
            resource_id=first(data.get("nasa_id")),
            kind=kind,
            title=first(data.get("title")),
            description=first(data.get("description")),
            url=first(data.get("center")) and href or href,
            thumbnail_url=preview,
            creator=first(data.get("photographer")) or first(data.get("credit")),
            date=first(data.get("date_created")),
            metadata={
                "center": data.get("center"),
                "keywords": data.get("keywords"),
                "asset_url": href,
            },
        )

    async def asset(self, nasa_id: str) -> list[str]:
        body = await self.http.json(
            "GET", f"{self.config.nasa_images_api_url.rstrip('/')}/asset/{nasa_id}"
        )
        return [
            first(item.get("href"))
            for item in nested(body, "collection", "items", default=[])
            if isinstance(item, dict)
        ]
