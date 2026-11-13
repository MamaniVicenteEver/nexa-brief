"""World Bank Indicators API v2: catálogo de indicadores y observaciones."""

from __future__ import annotations

from typing import Any

from src.adapters.researcher_data.infrastructure._normalization import first, nested
from src.adapters.researcher_data.infrastructure.base import ResearchProvider
from src.adapters.researcher_data.models import ResearchResponse, ResearchResult


class WorldBankProvider(ResearchProvider):
    name = "world_bank"

    @property
    def configured(self) -> bool:
        return bool(self.config.world_bank_api_url)

    async def search(
        self, query: str, *, page: int = 1, limit: int = 10, **filters: Any
    ) -> ResearchResponse:
        """Busca en el catálogo de indicadores y filtra localmente por texto.

        La API del Banco Mundial no tiene un buscador full-text dedicado; el
        catálogo se consulta en páginas grandes y se filtra por nombre/código.
        Para datos use ``indicator`` con el código exacto, por ejemplo
        ``SP.POP.TOTL``.
        """
        limit = min(max(limit, 1), 100)
        catalog_limit = min(max(int(filters.get("catalog_limit", 1000)), limit), 30000)
        body = await self.http.json(
            "GET",
            f"{self.config.world_bank_api_url.rstrip('/')}/indicator",
            params={
                "format": "json",
                "source": filters.get("source", 2),
                "per_page": catalog_limit,
                "page": 1,
            },
        )
        rows = body[1] if isinstance(body, list) and len(body) > 1 else []
        term = query.casefold().strip()
        matches = [
            row
            for row in rows
            if not term
            or term in first(row.get("id")).casefold()
            or term in first(row.get("name")).casefold()
            or term in first(row.get("sourceNote")).casefold()
        ]
        start = (max(page, 1) - 1) * limit
        results = [
            self._indicator_result(row) for row in matches[start : start + limit]
        ]
        return ResearchResponse(
            provider=self.name,
            query=query,
            results=results,
            total=len(matches),
            page=page,
            limit=limit,
            next_page=page + 1 if start + limit < len(matches) else None,
            metadata={"catalog_page_size": catalog_limit},
        )

    def _indicator_result(self, row: dict[str, Any]) -> ResearchResult:
        indicator_id = first(row.get("id"))
        return ResearchResult(
            provider=self.name,
            resource_id=indicator_id,
            kind="dataset",
            title=first(row.get("name")),
            description=first(row.get("sourceNote")),
            url=f"https://data.worldbank.org/indicator/{indicator_id}",
            language=first(row.get("language")),
            metadata={
                "unit": row.get("unit"),
                "topics": row.get("topics"),
                "source": row.get("source"),
            },
        )

    async def indicator(
        self,
        indicator_code: str,
        *,
        country: str = "all",
        start_year: int | None = None,
        end_year: int | None = None,
        page: int = 1,
        limit: int = 100,
    ) -> ResearchResponse:
        params: dict[str, Any] = {
            "format": "json",
            "per_page": min(max(limit, 1), 1000),
            "page": page,
        }
        if start_year is not None:
            params["date"] = f"{start_year}:{end_year or start_year}"
        body = await self.http.json(
            "GET",
            f"{self.config.world_bank_api_url.rstrip('/')}/country/{country}/indicator/{indicator_code}",
            params=params,
        )
        rows = body[1] if isinstance(body, list) and len(body) > 1 else []
        results = [
            ResearchResult(
                provider=self.name,
                resource_id=f"{indicator_code}:{row.get('countryiso3code')}:{row.get('date')}",
                kind="dataset",
                title=f"{indicator_code} — {nested(row, 'country', 'value', default='')} ({row.get('date', '')})",
                url=f"https://api.worldbank.org/v2/country/{country}/indicator/{indicator_code}",
                date=first(row.get("date")),
                metadata=row,
            )
            for row in rows
        ]
        total = (
            body[0].get("total")
            if isinstance(body, list) and body and isinstance(body[0], dict)
            else None
        )
        return ResearchResponse(
            provider=self.name,
            query=indicator_code,
            results=results,
            total=total,
            page=page,
            limit=limit,
        )
