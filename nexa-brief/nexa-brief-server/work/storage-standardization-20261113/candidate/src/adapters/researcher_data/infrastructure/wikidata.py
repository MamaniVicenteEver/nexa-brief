"""Wikidata: búsqueda de entidades, lectura de Q-items y consultas SPARQL."""

from __future__ import annotations

from typing import Any

from src.adapters.researcher_data.infrastructure._normalization import first
from src.adapters.researcher_data.infrastructure.base import ResearchProvider
from src.adapters.researcher_data.models import ResearchResponse, ResearchResult


class WikidataProvider(ResearchProvider):
    name = "wikidata"

    @property
    def configured(self) -> bool:
        return bool(self.config.wikidata_api_url and self.config.wikidata_sparql_url)

    async def search(
        self, query: str, *, page: int = 1, limit: int = 10, **filters: Any
    ) -> ResearchResponse:
        limit = min(max(limit, 1), 50)
        language = str(filters.get("language") or "en")
        body = await self.http.json(
            "GET",
            self.config.wikidata_api_url,
            params={
                "action": "wbsearchentities",
                "search": query,
                "language": language,
                "uselang": language,
                "limit": limit,
                "continue": (max(page, 1) - 1) * limit,
                "type": filters.get("entity_type", "item"),
                "format": "json",
            },
        )
        rows = body.get("search", []) if isinstance(body, dict) else []
        results = [
            ResearchResult(
                provider=self.name,
                resource_id=first(row.get("id")),
                kind=first(row.get("concepturi", "")).split("/")[-1].lower()
                or "entity",
                title=first(row.get("label")),
                description=first(row.get("description")),
                url=f"https://www.wikidata.org/wiki/{first(row.get('id'))}",
                language=language,
                metadata={
                    "aliases": row.get("aliases", []),
                    "match": row.get("match", {}),
                },
            )
            for row in rows
        ]
        return ResearchResponse(
            provider=self.name,
            query=query,
            results=results,
            total=body.get("searchinfo", {}).get("totalhits", None)
            if isinstance(body, dict)
            else None,
            page=page,
            limit=limit,
            next_page=page + 1 if len(results) == limit else None,
        )

    async def entity(
        self, entity_id: str, *, languages: list[str] | None = None
    ) -> dict[str, Any]:
        params: dict[str, Any] = {
            "action": "wbgetentities",
            "ids": entity_id,
            "props": "info|sitelinks|claims|labels|descriptions|aliases",
            "format": "json",
        }
        if languages:
            params["languages"] = "|".join(languages)
        body = await self.http.json("GET", self.config.wikidata_api_url, params=params)
        return body.get("entities", {}).get(entity_id, body)

    async def sparql(
        self, query: str, *, limit: int | None = None
    ) -> list[dict[str, Any]]:
        sparql_query = query
        if limit and " limit " not in query.lower():
            sparql_query = f"{query.rstrip().rstrip(';')} LIMIT {min(limit, 1000)}"
        body = await self.http.json(
            "GET",
            self.config.wikidata_sparql_url,
            params={"query": sparql_query, "format": "json"},
            headers={"Accept": "application/sparql-results+json"},
        )
        return (
            body.get("results", {}).get("bindings", [])
            if isinstance(body, dict)
            else []
        )
