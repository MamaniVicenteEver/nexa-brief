"""Wikipedia mediante la Action API y, opcionalmente, la REST API."""

from __future__ import annotations

from typing import Any
from urllib.parse import quote

from src.adapters.researcher_data.infrastructure._normalization import first, nested
from src.adapters.researcher_data.infrastructure.base import ResearchProvider
from src.adapters.researcher_data.models import ResearchResponse, ResearchResult


class WikipediaProvider(ResearchProvider):
    name = "wikipedia"

    @property
    def configured(self) -> bool:
        return bool(self.config.wikipedia_api_url)

    def _api_url(self, language: str | None = None) -> str:
        if not language or language == self.config.wikipedia_language:
            return self.config.wikipedia_api_url
        return f"https://{language}.wikipedia.org/w/api.php"

    def _article_url(self, title: str, language: str | None = None) -> str:
        lang = language or self.config.wikipedia_language
        return f"https://{lang}.wikipedia.org/wiki/{quote(title.replace(' ', '_'))}"

    async def search(
        self, query: str, *, page: int = 1, limit: int = 10, **filters: Any
    ) -> ResearchResponse:
        language = str(filters.get("language") or self.config.wikipedia_language)
        limit = min(max(limit, 1), 50)
        body = await self.http.json(
            "GET",
            self._api_url(language),
            params={
                "action": "query",
                "list": "search",
                "srsearch": query,
                "srnamespace": 0,
                "srlimit": limit,
                "sroffset": (max(page, 1) - 1) * limit,
                "srprop": "snippet|titlesnippet|size|wordcount|timestamp",
                "format": "json",
                "formatversion": 2,
            },
        )
        rows = nested(body, "query", "search", default=[])
        results = [
            ResearchResult(
                provider=self.name,
                resource_id=str(row.get("pageid", row.get("title", ""))),
                kind="article",
                title=first(row.get("title")),
                description=first(row.get("snippet")),
                url=self._article_url(first(row.get("title")), language),
                date=first(row.get("timestamp")),
                language=language,
                metadata={
                    "size": row.get("size"),
                    "wordcount": row.get("wordcount"),
                    "matched_title": row.get("titlesnippet"),
                },
            )
            for row in rows
        ]
        total = nested(body, "query", "searchinfo", "totalhits", default=None)
        return ResearchResponse(
            provider=self.name,
            query=query,
            results=results,
            total=total,
            page=page,
            limit=limit,
            next_page=page + 1 if len(results) == limit else None,
            metadata={"language": language, "api": "action"},
        )

    async def article(
        self, title: str, *, language: str | None = None, sentences: int = 10
    ) -> ResearchResult:
        language = language or self.config.wikipedia_language
        body = await self.http.json(
            "GET",
            self._api_url(language),
            params={
                "action": "query",
                "titles": title,
                "prop": "extracts|info|pageimages",
                "inprop": "url",
                "explaintext": 1,
                "exsentences": max(1, min(sentences, 50)),
                "exintro": 1,
                "piprop": "thumbnail|original",
                "pithumbsize": 1200,
                "format": "json",
                "formatversion": 2,
            },
        )
        # formatversion=2 devuelve una lista de diccionarios; ``first`` solo
        # convierte el primer valor, por eso normalizamos explícitamente acá.
        pages = nested(body, "query", "pages", default=[])
        page_data = pages[0] if isinstance(pages, list) and pages else {}
        thumb = page_data.get("thumbnail") or {}
        original = page_data.get("original") or {}
        return ResearchResult(
            provider=self.name,
            resource_id=str(page_data.get("pageid", "")),
            kind="article",
            title=first(page_data.get("title")),
            description=first(page_data.get("extract")),
            url=page_data.get("fullurl") or self._article_url(title, language),
            media_url=original.get("source") or thumb.get("source", ""),
            thumbnail_url=thumb.get("source", ""),
            language=language,
            metadata={
                "extract": page_data.get("extract", ""),
                "missing": page_data.get("missing", False),
            },
        )

    async def rest_search(
        self, query: str, *, language: str | None = None, limit: int = 20
    ) -> ResearchResponse:
        """Búsqueda REST compacta; útil cuando se quiere una respuesta más web-friendly."""
        language = language or self.config.wikipedia_language
        base = self.config.wikipedia_rest_url
        if language != self.config.wikipedia_language:
            base = f"https://{language}.wikipedia.org/w/rest.php/v1"
        body = await self.http.json(
            "GET", f"{base}/search/page", params={"q": query, "limit": min(limit, 100)}
        )
        rows = body.get("pages", []) if isinstance(body, dict) else []
        results = [
            ResearchResult(
                provider=self.name,
                resource_id=str(row.get("id", row.get("title", ""))),
                kind="article",
                title=first(row.get("title")),
                description=first(row.get("description")),
                url=row.get("key") and self._article_url(row["key"], language) or "",
                thumbnail_url=nested(row, "thumbnail", "url", default=""),
                language=language,
                metadata=row,
            )
            for row in rows
        ]
        return ResearchResponse(
            provider=self.name,
            query=query,
            results=results,
            limit=limit,
            metadata={"api": "rest"},
        )
