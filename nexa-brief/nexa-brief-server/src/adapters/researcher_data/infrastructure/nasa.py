"""NASA Open APIs: APOD, NEO, Mars Rover y Earth imagery.

NASA no ofrece un endpoint único de búsqueda de texto. Por eso ``search`` usa
APOD (la fecha se puede pasar como YYYY-MM-DD) y los métodos específicos
exponen los endpoints de catálogo que sí tienen filtros estructurados.
"""

from __future__ import annotations

from datetime import date
from typing import Any

from src.adapters.researcher_data.infrastructure._normalization import first
from src.adapters.researcher_data.infrastructure.base import ResearchProvider
from src.adapters.researcher_data.models import ResearchResponse, ResearchResult


class NASAProvider(ResearchProvider):
    name = "nasa"

    @property
    def configured(self) -> bool:
        return bool(self.config.nasa_api_url and self.config.nasa_api_key)

    def _params(self, **extra: Any) -> dict[str, Any]:
        return {"api_key": self.config.nasa_api_key, **extra}

    async def search(
        self, query: str, *, page: int = 1, limit: int = 10, **filters: Any
    ) -> ResearchResponse:
        requested_date = query.strip() if query else ""
        params: dict[str, Any] = {}
        if _is_date(requested_date):
            params["date"] = requested_date
        elif filters.get("date") and _is_date(str(filters["date"])):
            params["date"] = str(filters["date"])
        body = await self.http.json(
            "GET",
            f"{self.config.nasa_api_url.rstrip('/')}/planetary/apod",
            params=self._params(**params),
        )
        result = self._apod_result(body)
        return ResearchResponse(
            provider=self.name,
            query=query,
            results=[result],
            total=1,
            page=page,
            limit=limit,
        )

    def _apod_result(self, body: dict[str, Any]) -> ResearchResult:
        media_type = first(body.get("media_type"))
        return ResearchResult(
            provider=self.name,
            resource_id=first(body.get("date")),
            kind=media_type or "image",
            title=first(body.get("title")),
            description=first(body.get("explanation")),
            url=first(body.get("url")),
            media_url=first(body.get("hdurl")) or first(body.get("url")),
            thumbnail_url=first(body.get("thumbnail_url")) or first(body.get("url")),
            creator=first(body.get("copyright")),
            date=first(body.get("date")),
            metadata={
                "service_version": body.get("service_version"),
                "copyright": body.get("copyright"),
            },
        )

    async def apod(
        self, *, date_value: str | None = None, count: int | None = None
    ) -> list[ResearchResult]:
        params: dict[str, Any] = {}
        if date_value and _is_date(date_value):
            params["date"] = date_value
        if count:
            params["count"] = min(max(count, 1), 25)
            params.pop("date", None)
        body = await self.http.json(
            "GET",
            f"{self.config.nasa_api_url.rstrip('/')}/planetary/apod",
            params=self._params(**params),
        )
        rows = body if isinstance(body, list) else [body]
        return [self._apod_result(row) for row in rows if isinstance(row, dict)]

    async def neo_feed(
        self, start_date: str, end_date: str | None = None
    ) -> list[ResearchResult]:
        end_date = end_date or start_date
        body = await self.http.json(
            "GET",
            f"{self.config.nasa_api_url.rstrip('/')}/neo/rest/v1/feed",
            params=self._params(start_date=start_date, end_date=end_date),
        )
        results: list[ResearchResult] = []
        for day, asteroids in (body.get("near_earth_objects") or {}).items():
            for asteroid in asteroids:
                results.append(
                    ResearchResult(
                        provider=self.name,
                        resource_id=first(asteroid.get("id")),
                        kind="dataset",
                        title=first(asteroid.get("name")),
                        description="Objeto cercano a la Tierra",
                        url=first(asteroid.get("nasa_jpl_url")),
                        date=day,
                        metadata=asteroid,
                    )
                )
        return results

    async def mars_photos(
        self,
        *,
        rover: str = "curiosity",
        sol: int | None = None,
        earth_date: str | None = None,
        page: int = 1,
        limit: int = 25,
    ) -> ResearchResponse:
        params: dict[str, Any] = {"page": page, "api_key": self.config.nasa_api_key}
        if sol is not None:
            params["sol"] = sol
        elif earth_date:
            params["earth_date"] = earth_date
        params["api_key"] = self.config.nasa_api_key
        body = await self.http.json(
            "GET",
            f"{self.config.nasa_api_url.rstrip('/')}/mars-photos/api/v1/rovers/{rover}/photos",
            params=params,
        )
        rows = body.get("photos", []) if isinstance(body, dict) else []
        results = [
            ResearchResult(
                provider=self.name,
                resource_id=first(row.get("id")),
                kind="image",
                title=f"Mars {rover} — sol {row.get('sol', '')}",
                url=first(row.get("img_src")),
                media_url=first(row.get("img_src")),
                date=first(row.get("earth_date")),
                metadata={"camera": row.get("camera"), "rover": row.get("rover")},
            )
            for row in rows
        ]
        return ResearchResponse(
            provider=self.name,
            query=f"mars:{rover}",
            results=results,
            page=page,
            limit=limit,
        )

    async def earth_imagery(
        self, *, lon: float, lat: float, date_value: str | None = None, dim: float = 0.1
    ) -> ResearchResult:
        params: dict[str, Any] = self._params(lon=lon, lat=lat, dim=dim)
        if date_value:
            params["date"] = date_value
        body = await self.http.json(
            "GET",
            f"{self.config.nasa_api_url.rstrip('/')}/planetary/earth/imagery",
            params=params,
        )
        return ResearchResult(
            provider=self.name,
            resource_id=f"{lon},{lat}",
            kind="image",
            title="NASA Earth imagery",
            media_url=body.get("url", ""),
            url=body.get("url", ""),
            metadata=body,
        )


def _is_date(value: str) -> bool:
    try:
        date.fromisoformat(value)
        return True
    except ValueError:
        return False
