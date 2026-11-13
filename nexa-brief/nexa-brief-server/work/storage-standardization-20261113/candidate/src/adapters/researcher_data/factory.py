"""Composition root y fachada opcional del adaptador de investigación."""

from __future__ import annotations

import asyncio
import hashlib
import json
import time
from collections.abc import Iterable, Sequence
from typing import Any

import httpx

from src.adapters.researcher_data.config import ResearcherSettings, settings
from src.adapters.researcher_data.infrastructure.base import ResearchProvider
from src.adapters.researcher_data.infrastructure.commons import WikimediaCommonsProvider
from src.adapters.researcher_data.infrastructure.dpla import DPLAProvider
from src.adapters.researcher_data.infrastructure.europeana import EuropeanaProvider
from src.adapters.researcher_data.infrastructure.library_of_congress import (
    LibraryOfCongressProvider,
)
from src.adapters.researcher_data.models import (
    AggregatedResearchResponse,
    ProviderIssue,
    ResearchProviderError,
    ResearchResponse,
    ResearchResult,
)
from src.adapters.researcher_data.infrastructure.nasa import NASAProvider
from src.adapters.researcher_data.infrastructure.nasa_library import (
    NASAImageVideoProvider,
)
from src.adapters.researcher_data.infrastructure.openstreetmap import (
    OpenStreetMapProvider,
)
from src.adapters.researcher_data.infrastructure.openverse import OpenverseProvider
from src.adapters.researcher_data.infrastructure.overpass import OverpassProvider
from src.adapters.researcher_data.infrastructure.wikidata import WikidataProvider
from src.adapters.researcher_data.infrastructure.wikimedia_enterprise import (
    WikimediaEnterpriseProvider,
)
from src.adapters.researcher_data.infrastructure.wikipedia import WikipediaProvider
from src.adapters.researcher_data.infrastructure.world_bank import WorldBankProvider
from src.adapters.researcher_data.infrastructure.internet_archive import (
    InternetArchiveProvider,
)


PROVIDER_TYPES: tuple[type[ResearchProvider], ...] = (
    WikipediaProvider,
    WikidataProvider,
    WikimediaCommonsProvider,
    WikimediaEnterpriseProvider,
    OpenverseProvider,
    LibraryOfCongressProvider,
    EuropeanaProvider,
    NASAProvider,
    NASAImageVideoProvider,
    WorldBankProvider,
    OpenStreetMapProvider,
    OverpassProvider,
    DPLAProvider,
    InternetArchiveProvider,
)


def build_research_providers(
    *,
    config: ResearcherSettings | None = None,
    transport: httpx.AsyncBaseTransport | None = None,
) -> dict[str, ResearchProvider]:
    config = config or settings
    return {
        provider.name: provider(config=config, transport=transport)
        for provider in PROVIDER_TYPES
    }


class ResearcherDataAdapter:
    """Fachada aislada para consultar uno o varios proveedores.

    No se conecta al servidor FastAPI: la integración futura puede inyectar
    esta clase en un servicio cuando se decida activar el módulo.
    """

    def __init__(
        self,
        providers: Iterable[ResearchProvider] | None = None,
        *,
        config: ResearcherSettings | None = None,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self.config = config or settings
        registry = (
            {provider.name: provider for provider in providers}
            if providers is not None
            else build_research_providers(config=self.config, transport=transport)
        )
        self._providers = registry
        self._cache: dict[str, tuple[float, ResearchResponse]] = {}

    @property
    def providers(self) -> dict[str, ResearchProvider]:
        return dict(self._providers)

    def provider(self, name: str) -> ResearchProvider:
        try:
            return self._providers[name]
        except KeyError as exc:
            raise KeyError(f"Proveedor de investigación desconocido: {name}") from exc

    async def search(
        self,
        query: str,
        *,
        providers: Sequence[str] | None = None,
        page: int = 1,
        limit: int = 10,
        **filters: Any,
    ) -> AggregatedResearchResponse:
        names = list(dict.fromkeys(providers or self._providers.keys()))
        errors: list[ProviderIssue] = []
        selected: list[ResearchProvider] = []
        for name in names:
            provider = self._providers.get(name)
            if provider is None:
                errors.append(
                    ProviderIssue(
                        provider=name,
                        code="unknown_provider",
                        message=f"Proveedor desconocido: {name}",
                    )
                )
            else:
                selected.append(provider)

        semaphore = asyncio.Semaphore(max(1, self.config.max_parallel_requests))

        async def run(provider: ResearchProvider) -> ResearchResponse | Exception:
            async with semaphore:
                key = self._cache_key(provider.name, query, page, limit, filters)
                cached = self._cache.get(key)
                if (
                    cached
                    and time.monotonic() - cached[0] <= self.config.cache_ttl_seconds
                ):
                    return cached[1]
                try:
                    response = await provider.search(
                        query, page=page, limit=limit, **filters
                    )
                except (
                    Exception
                ) as exc:  # El agregador aísla proveedores incompatibles.
                    return exc
                self._cache[key] = (time.monotonic(), response)
                return response

        outcomes = await asyncio.gather(*(run(provider) for provider in selected))
        groups: list[list[ResearchResult]] = []
        for provider, outcome in zip(selected, outcomes, strict=True):
            if isinstance(outcome, ResearchResponse):
                groups.append(outcome.results)
            elif isinstance(outcome, ResearchProviderError):
                errors.append(
                    ProviderIssue(
                        provider=outcome.provider,
                        code=outcome.code,
                        message=str(outcome),
                    )
                )
            elif isinstance(outcome, ValueError):
                errors.append(
                    ProviderIssue(
                        provider=provider.name,
                        code="invalid_query",
                        message=str(outcome),
                    )
                )
            else:
                errors.append(
                    ProviderIssue(
                        provider=provider.name,
                        code="bad_response",
                        message=f"{provider.name}: {type(outcome).__name__}",
                    )
                )

        return AggregatedResearchResponse(
            query=query,
            results=_interleave_and_deduplicate(groups),
            provider_errors=errors,
            providers_queried=names,
        )

    async def search_one(
        self, provider: str, query: str, **kwargs: Any
    ) -> ResearchResponse:
        """Atajo para conservar paginación y metadatos de un proveedor."""
        return await self.provider(provider).search(query, **kwargs)

    def clear_cache(self) -> None:
        self._cache.clear()

    @staticmethod
    def _cache_key(
        provider: str, query: str, page: int, limit: int, filters: dict[str, Any]
    ) -> str:
        normalized = " ".join(query.casefold().split())
        raw = json.dumps(
            [provider, normalized, page, limit, filters], sort_keys=True, default=str
        )
        return hashlib.sha256(raw.encode()).hexdigest()


def _interleave_and_deduplicate(
    groups: list[list[ResearchResult]],
) -> list[ResearchResult]:
    output: list[ResearchResult] = []
    seen: set[tuple[str, str]] = set()
    for index in range(max((len(group) for group in groups), default=0)):
        for group in groups:
            if index >= len(group):
                continue
            item = group[index]
            identity = (item.url or f"{item.provider}:{item.resource_id}", item.kind)
            if identity in seen:
                continue
            seen.add(identity)
            output.append(item)
    return output


def build_researcher_data(
    *,
    config: ResearcherSettings | None = None,
    transport: httpx.AsyncBaseTransport | None = None,
) -> ResearcherDataAdapter:
    """Nombre explícito para scripts: ``adapter = build_researcher_data()``."""
    return ResearcherDataAdapter(config=config, transport=transport)
