"""Servicio de stock: busca en varios bancos a la vez e importa lo elegido.

Funciones públicas (las usan el router `/stock/*` y el director de medios IA):

    await search_stock("ocean waves", "video", orientation="portrait")
    await import_stock_item(provider="pexels", provider_id="123", kind="video",
                            download_url="https://videos.pexels.com/...mp4")

Decisiones:
- Los proveedores se consultan en paralelo y uno caído o sin key NO rompe la
  búsqueda: se reporta en `provider_errors` y se devuelve lo del resto.
- Caché por (proveedor, query, kind, orientation, page, per_page) en el
  DocumentStore "stock_search_cache": las APIs limitan búsquedas por hora y la
  UI repite mucho la misma búsqueda (paginar, volver atrás, la IA reintentando).
  Se cachea por proveedor, no la respuesta combinada, para que un proveedor que
  falló hoy no deje la búsqueda "vacía" de él por 24 h. Los errores no se cachean.
- Importar el mismo medio dos veces devuelve el asset existente: cada registro
  importado guarda `stock_ref` ("pexels:video:123") en su colección.

Los adapters viven en `src/adapters/stock/`; este módulo los obtiene
perezosamente de su factory (mismo patrón que `core/data.py`), y los tests o
scripts pueden inyectar otros con `set_stock_providers()`.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import tempfile
import time
from collections.abc import Iterable, Mapping, Sequence
from pathlib import Path
from typing import Literal

import structlog
from pydantic import BaseModel

from src.config.exceptions import NexaBriefError
from src.core.data import collection, documents
from src.core.library import asset_library
from src.core.library.asset_library import ImageLibraryEntry, VideoLibraryEntry
from src.core.ports.stock_media_port import (
    StockItem,
    StockKind,
    StockMediaPort,
    StockOrientation,
    StockProviderError,
)

logger = structlog.get_logger(__name__)

_CACHE = "stock_search_cache"
_ASSET_COLLECTION = {"image": "image_assets", "video": "video_assets"}
_DEFAULT_EXT = {"image": ".jpg", "video": ".mp4"}
DEFAULT_CATEGORY = "stock"
_MAX_URL_STEM = 60


# ── Proveedores (inyectables) ────────────────────────────────────────────────

_providers: dict[str, StockMediaPort] | None = None


def get_stock_providers() -> dict[str, StockMediaPort]:
    """Proveedores registrados, en orden de prioridad para intercalar."""
    global _providers
    if _providers is None:
        from src.adapters.stock.factory import build_stock_providers

        _providers = build_stock_providers()
    return _providers


def set_stock_providers(providers: Iterable[StockMediaPort] | None) -> None:
    """Inyecta proveedores (tests, scripts). `None` vuelve a los de la factory."""
    global _providers
    _providers = None if providers is None else {p.name: p for p in providers}


# ── Búsqueda ──────────────────────────────────────────────────────────────────

class StockProviderIssue(BaseModel):
    provider: str
    # "missing_key" | "invalid_key" | "rate_limited" | "http_error" | "network"
    # | "bad_response" | "unknown_provider"
    code: str
    message: str


class StockSearchResult(BaseModel):
    results: list[StockItem]
    provider_errors: list[StockProviderIssue] = []


def _cache_key(provider: str, query: str, kind: str, orientation: str | None, page: int, per_page: int) -> str:
    # La clave del DocumentStore es un nombre de archivo en el backend JSON:
    # hash fijo en vez de la query cruda (espacios, barras, acentos, largo).
    normalized = " ".join(query.casefold().split())
    raw = json.dumps([provider, normalized, kind, orientation or "", page, per_page])
    return hashlib.sha256(raw.encode()).hexdigest()[:40]


def _read_cache(key: str, ttl_seconds: int) -> list[StockItem] | None:
    cached = documents(_CACHE).get(key)
    if not cached or time.time() - float(cached.get("cached_at", 0)) > ttl_seconds:
        return None
    try:
        return [StockItem(**item) for item in cached.get("items", [])]
    except (TypeError, ValueError):
        return None  # formato viejo o corrupto: se vuelve a buscar


async def _search_one(
    provider: StockMediaPort, query: str, kind: StockKind,
    orientation: StockOrientation | None, page: int, per_page: int,
) -> list[StockItem]:
    key = _cache_key(provider.name, query, kind, orientation, page, per_page)
    cached = _read_cache(key, provider.cache_ttl_seconds)
    if cached is not None:
        return cached
    items = await provider.search(query, kind, orientation=orientation, page=page, per_page=per_page)
    documents(_CACHE).put(key, {
        "cached_at": time.time(),
        "provider": provider.name,
        "query": query,
        "kind": kind,
        "orientation": orientation,
        "page": page,
        "per_page": per_page,
        "items": [i.model_dump(exclude={"library_asset_id"}) for i in items],
    })
    return items


def _interleave(groups: Sequence[list[StockItem]]) -> list[StockItem]:
    """Round-robin entre proveedores: la primera pantalla muestra variedad en
    vez de 15 resultados de Pexels y recién después los de Pixabay."""
    out: list[StockItem] = []
    for i in range(max((len(g) for g in groups), default=0)):
        out.extend(g[i] for g in groups if i < len(g))
    return out


def _stock_ref(provider: str, kind: str, provider_id: str) -> str:
    return f"{provider}:{kind}:{provider_id}"


def _imported_refs(kind: str) -> dict[str, str]:
    """stock_ref → asset_id de lo ya importado de *kind*."""
    return {
        r["stock_ref"]: r["asset_id"]
        for r in collection(_ASSET_COLLECTION[kind]).list({"source": "stock"})
        if r.get("stock_ref")
    }


async def search_stock(
    query: str,
    kind: StockKind,
    *,
    orientation: StockOrientation | None = None,
    providers: Sequence[str] | None = None,
    page: int = 1,
    per_page: int = 15,
) -> StockSearchResult:
    """Busca *query* en los proveedores pedidos (todos por defecto).

    *per_page* es POR proveedor: con 3 proveedores llegan hasta 3×per_page
    resultados. Un proveedor que no maneja *kind* (Unsplash con video) se
    saltea en silencio: no es un error, simplemente no aplica."""
    registry = get_stock_providers()
    names = list(providers) if providers else list(registry)
    errors: list[StockProviderIssue] = []
    selected: list[StockMediaPort] = []
    for name in dict.fromkeys(names):  # sin repetidos, conservando el orden
        provider = registry.get(name)
        if provider is None:
            errors.append(StockProviderIssue(provider=name, code="unknown_provider",
                                             message=f"Proveedor desconocido: {name}"))
        elif kind in provider.kinds:
            selected.append(provider)

    outcomes = await asyncio.gather(
        *(_search_one(p, query, kind, orientation, page, per_page) for p in selected),
        return_exceptions=True,
    )
    groups: list[list[StockItem]] = []
    for provider, outcome in zip(selected, outcomes, strict=True):
        if isinstance(outcome, StockProviderError):
            errors.append(StockProviderIssue(provider=provider.name, code=outcome.code, message=str(outcome)))
        elif isinstance(outcome, BaseException):
            # Bug de parseo o similar: se loguea completo, pero la búsqueda sigue.
            logger.error("stock_provider_crashed", provider=provider.name, error=repr(outcome))
            errors.append(StockProviderIssue(provider=provider.name, code="bad_response",
                                             message=f"{provider.name}: {type(outcome).__name__}"))
        else:
            groups.append(outcome)

    results = _interleave(groups)
    imported = _imported_refs(kind)
    for item in results:
        item.library_asset_id = imported.get(_stock_ref(item.provider, item.kind, item.provider_id))
    logger.info("stock_search", query=query, kind=kind, results=len(results), errors=len(errors))
    return StockSearchResult(results=results, provider_errors=errors)


# ── Importación ───────────────────────────────────────────────────────────────

class StockImportError(NexaBriefError):
    """Pedido de importación inválido (proveedor, tipo o URL no permitidos)."""


class StockImportResult(BaseModel):
    kind: Literal["image", "video"]
    entry: ImageLibraryEntry | VideoLibraryEntry
    already_imported: bool = False


# Dos clicks seguidos en "Importar" (o la IA y el usuario a la vez) no deben
# bajar ni registrar el mismo medio dos veces.
_import_locks: dict[str, asyncio.Lock] = {}


def _find_imported(kind: str, ref: str) -> ImageLibraryEntry | VideoLibraryEntry | None:
    raw = collection(_ASSET_COLLECTION[kind]).first({"stock_ref": ref})
    if raw is None:
        return None
    return ImageLibraryEntry(**raw) if kind == "image" else VideoLibraryEntry(**raw)


def _credit(license_name: str, author: str, source_url: str) -> str:
    """license_note legible para mostrar el crédito tal cual (VideoLibraryEntry
    no tiene campo de autor, así que el crédito completo viaja acá)."""
    parts = [license_name or "Stock", f"por {author}" if author else "", source_url]
    return " · ".join(p for p in parts if p)


async def import_stock_item(
    *,
    provider: str,
    provider_id: str,
    kind: StockKind,
    download_url: str,
    title: str = "",
    author: str = "",
    author_url: str = "",
    source_url: str = "",
    license: str = "",  # noqa: A002 - mismo nombre que el campo de StockItem
    category: str | None = None,
    job_id: str = "",
) -> StockImportResult:
    """Descarga un resultado de búsqueda y lo registra en la librería.

    Idempotente por (provider, kind, provider_id). Levanta StockImportError si
    el pedido es inválido y AssetDownloadError si la descarga falla."""
    registry = get_stock_providers()
    adapter = registry.get(provider)
    if adapter is None:
        raise StockImportError(f"Proveedor desconocido: {provider}")
    if kind not in adapter.kinds:
        raise StockImportError(f"{provider} no ofrece {kind}")
    if not provider_id.strip():
        raise StockImportError("provider_id vacío")
    if not adapter.accepts_download_url(download_url):
        raise StockImportError(f"La URL de descarga no pertenece a {provider}")

    ref = _stock_ref(provider, kind, provider_id)
    lock = _import_locks.setdefault(ref, asyncio.Lock())
    async with lock:
        existing = _find_imported(kind, ref)
        if existing is not None:
            return StockImportResult(kind=kind, entry=existing, already_imported=True)

        filename = asset_library.filename_from_url(download_url)
        suffix = Path(filename).suffix if filename else _DEFAULT_EXT[kind]
        # Unsplash no trae extensión en la URL y Pixabay sirve las imágenes con
        # un hash de 100+ caracteres: en esos casos, un nombre legible y estable.
        if not filename or len(Path(filename).stem) > _MAX_URL_STEM:
            filename = f"{provider}-{provider_id}{suffix}"

        with tempfile.TemporaryDirectory(prefix="nexa-stock-") as tmp:
            tmp_path = Path(tmp) / f"download{suffix}"
            await asset_library.download_url_to(download_url, tmp_path)
            # Dimensiones/duración reales del archivo bajado (no las que dijo la búsqueda).
            probed = await asset_library.probe_media(tmp_path)
            meta = {
                "label": title,
                "description": title,
                "tags": title if provider == "pixabay" else "",  # en Pixabay el "título" son sus tags
                "license_note": _credit(license, author, source_url),
                "width": int(probed.get("width", 0)),
                "height": int(probed.get("height", 0)),
            }
            common = {
                "category": (category or "").strip() or DEFAULT_CATEGORY,
                "source": "stock",
                "provider": provider,
                "original_url": download_url,
                "job_id": job_id,
                "filename": filename,
            }
            if kind == "image":
                entry: ImageLibraryEntry | VideoLibraryEntry = await asset_library.register_image(
                    tmp_path, **common, photographer=author,
                    orientation=_orientation(meta["width"], meta["height"]), **meta,
                )
            else:
                entry = await asset_library.register_video(
                    tmp_path, **common, duration_seconds=float(probed.get("duration_seconds", 0.0)), **meta,
                )

        # Campos propios del import que el modelo de la librería no tiene: el
        # registro los conserva (el DataStore guarda el dict entero) y los
        # modelos los ignoran al leer.
        await collection(_ASSET_COLLECTION[kind]).update(entry.asset_id, {
            "stock_ref": ref,
            "stock_author": author,
            "stock_author_url": author_url,
            "stock_source_url": source_url,
        })
        await asset_library.publish_asset_changed(kind, entry.asset_id, action="created")
        await adapter.notify_download(provider_id)
        logger.info("stock_imported", ref=ref, asset_id=entry.asset_id)
        return StockImportResult(kind=kind, entry=entry, already_imported=False)


def _orientation(width: int, height: int) -> str | None:
    if not width or not height:
        return None
    ratio = width / height
    return "landscape" if ratio > 1.1 else "portrait" if ratio < 0.9 else "square"


def provider_status(registry: Mapping[str, StockMediaPort] | None = None) -> list[dict]:
    """Qué proveedores hay, si tienen key y qué buscan (para la UI)."""
    providers = registry or get_stock_providers()
    return [
        {"name": p.name, "configured": p.configured, "kinds": sorted(p.kinds)}
        for p in providers.values()
    ]
