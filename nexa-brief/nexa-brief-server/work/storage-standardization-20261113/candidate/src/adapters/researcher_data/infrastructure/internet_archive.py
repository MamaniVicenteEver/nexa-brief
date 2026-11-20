"""Internet Archive Advanced Search y archivos audiovisuales públicos."""

from __future__ import annotations

import asyncio
from typing import Any
from urllib.parse import quote

from src.adapters.researcher_data.infrastructure._normalization import first, join_values
from src.adapters.researcher_data.infrastructure.base import ResearchProvider
from src.adapters.researcher_data.models import ResearchResponse, ResearchResult


class InternetArchiveProvider(ResearchProvider):
    name = "internet_archive"

    @property
    def configured(self) -> bool:
        return bool(self.config.internet_archive_api_url)

    async def search(
        self, query: str, *, page: int = 1, limit: int = 10, **filters: Any
    ) -> ResearchResponse:
        limit = min(max(limit, 1), 50)
        media_type = str(filters.get("media_type") or "").lower()
        search_query = query
        if media_type == "video" and "mediatype:" not in query.lower():
            search_query = f"({query}) AND mediatype:movies"
        params: dict[str, Any] = {
            "q": search_query,
            "fl[]": ["identifier", "title", "description", "creator", "year", "mediatype"],
            "rows": limit,
            "page": max(page, 1),
            "output": "json",
        }
        body = await self.http.json(
            "GET",
            f"{self.config.internet_archive_api_url.rstrip('/')}/advancedsearch.php",
            params=params,
        )
        response = body.get("response", {}) if isinstance(body, dict) else {}
        rows = response.get("docs", []) if isinstance(response, dict) else []
        semaphore = asyncio.Semaphore(6)

        async def normalize(row: Any) -> ResearchResult | None:
            if not isinstance(row, dict):
                return None
            identifier = first(row.get("identifier"))
            kind = "video" if first(row.get("mediatype")).lower() == "movies" else "other"
            media_url = ""
            metadata: dict[str, Any] = {"archive_identifier": identifier}
            if identifier and (not media_type or media_type == "video"):
                try:
                    async with semaphore:
                        media_url, metadata = await asyncio.wait_for(
                            self._video_asset(identifier, metadata),
                            timeout=min(15.0, self.config.request_timeout_seconds),
                        )
                except (asyncio.TimeoutError, Exception):
                    return None
            if media_type == "video" and not media_url:
                return None
            return ResearchResult(
                provider=self.name,
                resource_id=identifier,
                kind=kind,
                title=first(row.get("title")),
                description=join_values(row.get("description")),
                url=f"{self.config.internet_archive_api_url.rstrip('/')}/details/{quote(identifier)}",
                media_url=media_url,
                creator=join_values(row.get("creator")),
                date=first(row.get("year")),
                license=first(row.get("licenseurl")),
                metadata=metadata,
            )
        normalized = await asyncio.gather(*(normalize(row) for row in rows[:12]))
        results = [result for result in normalized if result is not None]
        total = response.get("numFound") if isinstance(response, dict) else None
        return ResearchResponse(
            provider=self.name,
            query=query,
            results=results,
            total=total,
            page=page,
            limit=limit,
            next_page=page + 1 if total is not None and page * limit < total else None,
            metadata={"search_query": search_query, "media_type": media_type},
        )

    async def _video_asset(
        self, identifier: str, metadata: dict[str, Any]
    ) -> tuple[str, dict[str, Any]]:
        body = await self.http.json(
            "GET",
            f"{self.config.internet_archive_api_url.rstrip('/')}/metadata/{quote(identifier)}",
        )
        files = body.get("files", []) if isinstance(body, dict) else []
        candidates = []
        for item in files:
            if not isinstance(item, dict) or item.get("private"):
                continue
            name = first(item.get("name"))
            file_format = first(item.get("format"))
            if not name.lower().endswith((".mp4", ".webm", ".ogv", ".mov", ".m4v")):
                continue
            if not any(
                marker in file_format.lower()
                for marker in ("mpeg4", "h.264", "webm", "ogg video", "quicktime", "video")
            ):
                continue
            try:
                duration = float(item.get("length")) if item.get("length") else None
            except (TypeError, ValueError):
                duration = None
            try:
                size = int(item.get("size")) if item.get("size") else None
            except (TypeError, ValueError):
                size = None
            candidates.append(
                {
                    "name": name,
                    "format": file_format,
                    "duration_seconds": duration,
                    "bytes": size,
                }
            )
        candidates.sort(
            key=lambda item: (
                not (
                    item["duration_seconds"] is not None
                    and 10 <= item["duration_seconds"] <= 60
                ),
                item["bytes"] is not None and item["bytes"] > 60 * 1024 * 1024,
                "512kb" not in item["name"].lower(),
                "mp4" not in item["name"].lower(),
            )
        )
        if not candidates:
            return "", metadata
        selected = candidates[0]
        metadata["duration_seconds"] = selected["duration_seconds"]
        metadata["archive_file"] = selected["name"]
        metadata["archive_format"] = selected["format"]
        metadata["archive_files"] = candidates[:10]
        return (
            f"{self.config.internet_archive_api_url.rstrip('/')}/download/"
            f"{quote(identifier)}/{quote(selected['name'])}",
            metadata,
        )
