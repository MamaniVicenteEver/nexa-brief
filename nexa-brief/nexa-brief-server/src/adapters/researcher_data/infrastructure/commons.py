"""Wikimedia Commons: búsqueda de fotos, ilustraciones, audio y videos."""

from __future__ import annotations

from typing import Any
from urllib.parse import quote

from src.adapters.researcher_data.infrastructure._normalization import first, nested
from src.adapters.researcher_data.infrastructure.base import ResearchProvider
from src.adapters.researcher_data.models import ResearchResponse, ResearchResult


class WikimediaCommonsProvider(ResearchProvider):
    name = "wikimedia_commons"

    @property
    def configured(self) -> bool:
        return bool(self.config.commons_api_url)

    async def search(
        self, query: str, *, page: int = 1, limit: int = 10, **filters: Any
    ) -> ResearchResponse:
        limit = min(max(limit, 1), 50)
        body = await self.http.json(
            "GET",
            self.config.commons_api_url,
            params={
                "action": "query",
                "generator": "search",
                "gsrsearch": query,
                "gsrnamespace": 6,
                "gsrlimit": limit,
                "gsroffset": (max(page, 1) - 1) * limit,
                "prop": "imageinfo|categories",
                "iiprop": "url|size|mime|extmetadata",
                "iiurlwidth": min(int(filters.get("thumbnail_width", 1000)), 2000),
                "format": "json",
                "formatversion": 2,
            },
        )
        pages = nested(body, "query", "pages", default=[])
        if isinstance(pages, dict):
            pages = list(pages.values())
        results = [
            self._result(page_data)
            for page_data in pages
            if isinstance(page_data, dict)
        ]
        return ResearchResponse(
            provider=self.name,
            query=query,
            results=results,
            page=page,
            limit=limit,
            next_page=page + 1 if len(results) == limit else None,
            metadata={
                "license_note": "Commons tiene licencias por archivo; revisar extmetadata antes de publicar."
            },
        )

    def _result(self, page: dict[str, Any]) -> ResearchResult:
        info = (page.get("imageinfo") or [{}])[0]
        ext = info.get("extmetadata") or {}
        mime = first(info.get("mime"))
        if mime.startswith("image/"):
            kind = "image"
        elif mime.startswith("video/"):
            kind = "video"
        elif mime.startswith("audio/"):
            kind = "audio"
        else:
            kind = "media"
        title = first(page.get("title")).removeprefix("File:")
        return ResearchResult(
            provider=self.name,
            resource_id=str(page.get("pageid", title)),
            kind=kind,
            title=title,
            description=first(ext.get("ImageDescription", {}).get("value")),
            url=f"https://commons.wikimedia.org/wiki/{quote(first(page.get('title')).replace(' ', '_'))}",
            media_url=first(info.get("url")),
            thumbnail_url=first(info.get("thumburl")) or first(info.get("url")),
            creator=first(ext.get("Artist", {}).get("value")),
            license=first(ext.get("LicenseShortName", {}).get("value")),
            date=first(ext.get("DateTimeOriginal", {}).get("value")),
            metadata={
                "mime": mime,
                "width": info.get("width"),
                "height": info.get("height"),
                "size": info.get("size"),
            },
        )

    async def file(self, title: str, *, thumbnail_width: int = 1200) -> ResearchResult:
        response = await self.search(title, limit=1, thumbnail_width=thumbnail_width)
        if not response.results:
            from src.adapters.researcher_data.models import ResearchProviderError

            raise ResearchProviderError(
                self.name, "not_found", f"Archivo no encontrado: {title}"
            )
        return response.results[0]
