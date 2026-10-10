"""Contrato mínimo para proveedores de ``researcher_data``."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

import httpx

from src.adapters.researcher_data.infrastructure._http import ResearchHTTP
from src.adapters.researcher_data.config import ResearcherSettings, settings
from src.adapters.researcher_data.models import ResearchProviderError, ResearchResponse


class ResearchProvider(ABC):
    name: str

    def __init__(
        self,
        *,
        config: ResearcherSettings | None = None,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self.config = config or settings
        self.http = ResearchHTTP(
            provider=self.name, config=self.config, transport=transport
        )

    @property
    @abstractmethod
    def configured(self) -> bool:
        """Indica si puede llamar al proveedor con la configuración actual."""

    @abstractmethod
    async def search(
        self, query: str, *, page: int = 1, limit: int = 10, **filters: Any
    ) -> ResearchResponse:
        """Busca y normaliza resultados sin exponer el JSON del proveedor."""

    def require(self, value: str, variable: str) -> str:
        if not value:
            raise ResearchProviderError(
                self.name, "missing_key", f"{variable} no está configurada"
            )
        return value
