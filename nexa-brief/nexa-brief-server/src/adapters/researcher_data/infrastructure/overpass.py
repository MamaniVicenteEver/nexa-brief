"""Overpass API: consultas de objetos OSM mediante Overpass QL."""

from __future__ import annotations

import re
from typing import Any

from src.adapters.researcher_data.infrastructure._normalization import first
from src.adapters.researcher_data.infrastructure.base import ResearchProvider
from src.adapters.researcher_data.models import ResearchResponse, ResearchResult


class OverpassProvider(ResearchProvider):
    name = "overpass"

    @property
    def configured(self) -> bool:
        return bool(self.config.overpass_api_url)

    async def search(
        self, query: str, *, page: int = 1, limit: int = 10, **filters: Any
    ) -> ResearchResponse:
        bbox = str(
            filters.get("bbox") or self.config.overpass_default_bbox or ""
        ).strip()
        overpass_query = (
            query
            if _looks_like_query(query)
            else self.build_query(query, bbox=bbox, limit=limit)
        )
        body = await self.run(overpass_query)
        elements = body.get("elements", []) if isinstance(body, dict) else []
        results = [self._result(item) for item in elements[:limit]]
        return ResearchResponse(
            provider=self.name,
            query=query,
            results=results,
            total=len(elements),
            page=page,
            limit=limit,
            metadata={"bbox": bbox, "query": overpass_query},
        )

    def build_query(self, term: str, *, bbox: str = "", limit: int = 25) -> str:
        escaped = re.escape(term.strip())[:100]
        area = f"({bbox})" if bbox else ""
        return f'[out:json][timeout:{min(max(self.config.request_timeout_seconds, 5), 120):.0f}];nwr["name"~"{escaped}",i]{area};out center tags {min(max(limit, 1), 100)};'

    async def run(self, query: str) -> dict[str, Any]:
        last_error: Exception | None = None
        for endpoint in dict.fromkeys(
            (self.config.overpass_api_url, self.config.overpass_fallback_api_url)
        ):
            try:
                return await self.http.json(
                    "POST",
                    endpoint,
                    params={"data": query},
                    headers={"Accept": "application/json"},
                )
            except Exception as exc:  # fallback only; final error keeps provider code
                last_error = exc
        if last_error:
            raise last_error
        return {}

    @staticmethod
    def _result(item: dict[str, Any]) -> ResearchResult:
        element_type = first(item.get("type"))
        element_id = first(item.get("id"))
        tags = item.get("tags") or {}
        center = item.get("center") or {}
        lat = item.get("lat", center.get("lat"))
        lon = item.get("lon", center.get("lon"))
        return ResearchResult(
            provider="overpass",
            resource_id=f"{element_type}/{element_id}",
            kind="map_feature",
            title=first(tags.get("name")) or f"{element_type} {element_id}",
            url=f"https://www.openstreetmap.org/{element_type}/{element_id}",
            metadata={"tags": tags, "lat": lat, "lon": lon},
        )


def _looks_like_query(value: str) -> bool:
    return (
        value.strip().startswith("[")
        or "out " in value.lower()
        or "nwr[" in value.lower()
    )
