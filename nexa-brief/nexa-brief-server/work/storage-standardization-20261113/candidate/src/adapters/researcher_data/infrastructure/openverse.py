"""Openverse: imágenes y audio con licencias abiertas."""

from __future__ import annotations

from typing import Any

from src.adapters.researcher_data.infrastructure._normalization import first
from src.adapters.researcher_data.infrastructure.base import ResearchProvider
from src.adapters.researcher_data.models import ResearchResponse, ResearchResult


class OpenverseProvider(ResearchProvider):
    name = "openverse"

    @property
    def configured(self) -> bool:
        return bool(self.config.openverse_api_url)

    def _headers(self) -> dict[str, str]:
        if not self.config.openverse_api_token:
            return {}
        return {"Authorization": f"Bearer {self.config.openverse_api_token}"}

    async def search(
        self, query: str, *, page: int = 1, limit: int = 10, **filters: Any
    ) -> ResearchResponse:
        media_type = str(filters.get("media_type") or "image").lower()
        if media_type not in {"image", "audio"}:
            raise ValueError("Openverse acepta media_type='image' o 'audio'")
        limit = min(max(limit, 1), 100)
        endpoint_media_type = "images" if media_type == "image" else "audio"
        params: dict[str, Any] = {"q": query, "page": page, "page_size": limit}
        for key in (
            "source",
            "license",
            "license_type",
            "creator",
            "tags",
            "title",
            "category",
            "mature",
        ):
            if filters.get(key) is not None:
                params[key] = filters[key]
        body = await self.http.json(
            "GET",
            f"{self.config.openverse_api_url.rstrip('/')}/{endpoint_media_type}/",
            params=params,
            headers=self._headers(),
        )
        rows = body.get("results", []) if isinstance(body, dict) else []
        results = [
            ResearchResult(
                provider=self.name,
                resource_id=first(row.get("id") or row.get("foreign_landing_url")),
                kind=media_type,
                title=first(row.get("title")),
                description=first(row.get("description")),
                url=first(row.get("foreign_landing_url")) or first(row.get("url")),
                media_url=first(row.get("url")) or first(row.get("file")),
                thumbnail_url=first(row.get("thumbnail")),
                creator=first(row.get("creator")),
                license=first(row.get("license"))
                + (
                    f" {first(row.get('license_version'))}"
                    if row.get("license_version")
                    else ""
                ),
                date=first(row.get("created_on")),
                metadata={
                    "source": row.get("source"),
                    "tags": row.get("tags"),
                    "attribution": row.get("attribution"),
                },
            )
            for row in rows
        ]
        return ResearchResponse(
            provider=self.name,
            query=query,
            results=results,
            total=body.get("result_count") if isinstance(body, dict) else None,
            page=page,
            limit=limit,
            next_page=page + 1 if body.get("page_count", page) > page else None,
            metadata={
                "media_type": media_type,
                "anonymous_access": not bool(self.config.openverse_api_token),
            },
        )
