"""Stock Media Port — contrato de los bancos de imágenes y videos de stock.

A diferencia de `ImagePort` (que el pipeline usa para *descargar* un fondo
automáticamente), este puerto solo *busca*: devuelve resultados normalizados
para que el usuario (o el director de medios con IA) elija, y recién lo
elegido se descarga e importa a la librería (ver `src/core/stock/service.py`).

Cada proveedor (Pexels, Pixabay, Unsplash) devuelve un JSON distinto; el
adapter lo traduce a `StockItem` para que la UI y la IA no sepan de dónde vino.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Literal
from urllib.parse import urlparse

from pydantic import BaseModel

from src.config.exceptions import NexaBriefError

StockKind = Literal["image", "video"]
StockOrientation = Literal["landscape", "portrait", "square"]


class StockItem(BaseModel):
    """Un resultado de búsqueda, igual para todos los proveedores."""

    provider: str                       # "pexels" | "pixabay" | "unsplash"
    provider_id: str                    # id del medio en el proveedor (estable, sirve para dedup)
    kind: StockKind
    title: str = ""                     # alt / descripción / tags: lo que haya
    preview_url: str                    # miniatura liviana para la grilla
    download_url: str                   # archivo a importar (video: variante HD, nunca 4K)
    width: int = 0                      # del archivo que se va a descargar
    height: int = 0
    duration_seconds: float | None = None   # solo video
    author: str = ""
    author_url: str = ""
    source_url: str = ""                # página del medio en el proveedor (para el crédito)
    license: str = ""                   # nombre de la licencia del proveedor
    # Lo completa el servicio (no el adapter ni la caché): asset_id si este
    # medio ya está importado en la librería, para que la UI no lo duplique.
    library_asset_id: str | None = None


class StockProviderError(NexaBriefError):
    """Un proveedor no pudo responder. `code` le dice a la UI por qué sin parsear texto."""

    def __init__(self, provider: str, code: str, message: str) -> None:
        super().__init__(message)
        self.provider = provider
        # "missing_key" | "invalid_key" | "rate_limited" | "http_error" | "network" | "bad_response"
        self.code = code


class StockMediaPort(ABC):
    """Un banco de stock. Las búsquedas nunca descargan archivos."""

    name: str
    kinds: frozenset[str]               # qué busca: {"image"} o {"image", "video"}
    # Hosts desde los que se aceptan descargas al importar: evita que
    # POST /stock/import se use para bajar cualquier URL arbitraria (SSRF).
    download_hosts: tuple[str, ...]
    # Cuánto vale una búsqueda cacheada. 24 h cuida las cuotas por hora de
    # cada API; un proveedor con URLs de descarga temporales lo baja.
    cache_ttl_seconds: int = 24 * 3600

    @property
    @abstractmethod
    def configured(self) -> bool:
        """True si tiene API key (sin key, search() levanta StockProviderError)."""

    @abstractmethod
    async def search(
        self,
        query: str,
        kind: StockKind,
        *,
        orientation: StockOrientation | None = None,
        page: int = 1,
        per_page: int = 15,
    ) -> list[StockItem]:
        """Resultados de *query*. Levanta StockProviderError si el proveedor falla."""

    def accepts_download_url(self, url: str) -> bool:
        parsed = urlparse(url)
        host = (parsed.hostname or "").lower()
        return parsed.scheme == "https" and any(
            host == h or host.endswith("." + h) for h in self.download_hosts
        )

    async def notify_download(self, provider_id: str) -> None:  # noqa: B027 - hook opcional
        """Avisa al proveedor que el medio se descargó (Unsplash lo exige por
        sus guidelines de API). Por defecto no hace nada; nunca debe romper el import."""
