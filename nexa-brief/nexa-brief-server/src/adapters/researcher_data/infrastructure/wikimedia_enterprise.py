"""Wikimedia Enterprise: JWT login/refresh y consultas On-demand exactas."""

from __future__ import annotations

from typing import Any
from urllib.parse import quote

from src.adapters.researcher_data.infrastructure._normalization import first
from src.adapters.researcher_data.infrastructure.base import ResearchProvider
from src.adapters.researcher_data.models import (
    ResearchProviderError,
    ResearchResponse,
    ResearchResult,
)


class WikimediaEnterpriseProvider(ResearchProvider):
    name = "wikimedia_enterprise"

    def __init__(self, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self.access_token = self.config.wikimedia_enterprise_access_token
        self.refresh_token = self.config.wikimedia_enterprise_refresh_token

    @property
    def configured(self) -> bool:
        return bool(self.access_token)

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.require(self.access_token, 'WIKIMEDIA_ENTERPRISE_ACCESS_TOKEN')}"
        }

    async def login(self) -> dict[str, Any]:
        username = self.require(
            self.config.wikimedia_enterprise_username, "WIKIMEDIA_ENTERPRISE_USERNAME"
        )
        password = self.require(
            self.config.wikimedia_enterprise_password, "WIKIMEDIA_ENTERPRISE_PASSWORD"
        )
        body = await self.http.json(
            "POST",
            f"{self.config.wikimedia_enterprise_auth_url.rstrip('/')}/v1/login",
            headers={"Content-Type": "application/json"},
            json_body={"username": username, "password": password},
        )
        self._set_tokens(body)
        return body

    async def refresh(self) -> dict[str, Any]:
        token = self.require(self.refresh_token, "WIKIMEDIA_ENTERPRISE_REFRESH_TOKEN")
        body = await self.http.json(
            "POST",
            f"{self.config.wikimedia_enterprise_auth_url.rstrip('/')}/v1/token-refresh",
            headers={"Content-Type": "application/json"},
            json_body={"refresh_token": token},
        )
        self._set_tokens(body)
        return body

    def _set_tokens(self, body: dict[str, Any]) -> None:
        self.access_token = first(body.get("access_token"))
        self.refresh_token = first(body.get("refresh_token")) or self.refresh_token

    async def search(
        self, query: str, *, page: int = 1, limit: int = 10, **filters: Any
    ) -> ResearchResponse:
        """Enterprise no es un buscador de texto: busca por nombre exacto de artículo."""
        project = str(
            filters.get("project") or self.config.wikimedia_enterprise_project
        )
        fields = filters.get("fields")
        payload: dict[str, Any] = {
            "filters": [{"field": "is_part_of.identifier", "value": project}],
            "limit": min(max(limit, 1), 10),
        }
        if fields:
            payload["fields"] = (
                list(fields) if not isinstance(fields, str) else [fields]
            )
        body = await self.http.json(
            "POST",
            f"{self.config.wikimedia_enterprise_api_url.rstrip('/')}/v2/articles/{quote(query.replace(' ', '_'))}",
            headers={**self._headers(), "Content-Type": "application/json"},
            json_body=payload,
        )
        rows = (
            body
            if isinstance(body, list)
            else body.get("articles", body.get("results", []))
        )
        results = [self._result(row, project) for row in rows if isinstance(row, dict)]
        return ResearchResponse(
            provider=self.name,
            query=query,
            results=results,
            total=len(results),
            page=page,
            limit=limit,
            metadata={"project": project, "exact_match_only": True},
        )

    def _result(self, article: dict[str, Any], project: str) -> ResearchResult:
        name = first(article.get("name"))
        return ResearchResult(
            provider=self.name,
            resource_id=first(article.get("identifier")),
            kind="article",
            title=name,
            description=first(article.get("abstract")),
            url=first(article.get("url"))
            or f"https://{project[:-4]}.wikipedia.org/wiki/{quote(name.replace(' ', '_'))}",
            language=project[:-4] if project.endswith("wiki") else "",
            date=first(article.get("date_modified")),
            metadata=article,
        )

    async def wikidata_item(self, entity_id: str) -> dict[str, Any]:
        await self._ensure_token()
        return await self.http.json(
            "GET",
            f"{self.config.wikimedia_enterprise_api_url.rstrip('/')}/v2/wikidata/items/{quote(entity_id)}",
            headers=self._headers(),
        )

    async def _ensure_token(self) -> None:
        if self.access_token:
            return
        if self.refresh_token:
            await self.refresh()
            return
        raise ResearchProviderError(
            self.name,
            "missing_key",
            "WIKIMEDIA_ENTERPRISE_ACCESS_TOKEN no está configurado",
        )
