"""Pixabay — imágenes (/api/) y videos (/api/videos/).

Limitaciones de la API pública (sin "full access" aprobado):
- Imágenes: la mayor URL disponible es `largeImageURL` (lado largo 1280 px).
  Se informa ese tamaño real para que la UI/IA puedan preferir otro proveedor
  cuando el slot necesita más resolución.
- Las URLs `pixabay.com/get/...` son temporales: por eso este proveedor cachea
  menos tiempo que los demás (`cache_ttl_seconds`).
- Videos: no hay filtro de orientación; se filtra acá por las dimensiones.
"""

from __future__ import annotations

import httpx

from src.adapters.stock._http import fit_within, get_json, orientation_of
from src.config.settings import settings
from src.core.ports.stock_media_port import (
    StockItem,
    StockKind,
    StockMediaPort,
    StockOrientation,
    StockProviderError,
)

_BASE = "https://pixabay.com/api/"
_LICENSE = "Pixabay Content License"
_LARGE_IMAGE_SIDE = 1280
_VIDEO_MAX_SIDE = 1920
# Orden de preferencia de las variantes de video (large puede ser 4K en algunos).
_VIDEO_VARIANTS = ("large", "medium", "small", "tiny")
_ORIENTATION = {"landscape": "horizontal", "portrait": "vertical"}
_LOCAL_FILTER_FACTOR = 5


class PixabayStockAdapter(StockMediaPort):
    name = "pixabay"
    kinds = frozenset({"image", "video"})
    download_hosts = ("pixabay.com",)          # incluye cdn.pixabay.com
    cache_ttl_seconds = 6 * 3600

    def __init__(self, api_key: str | None = None, transport: httpx.AsyncBaseTransport | None = None) -> None:
        self._api_key = settings.pixabay_api_key if api_key is None else api_key
        self._transport = transport

    @property
    def configured(self) -> bool:
        return bool(self._api_key)

    async def search(
        self,
        query: str,
        kind: StockKind,
        *,
        orientation: StockOrientation | None = None,
        page: int = 1,
        per_page: int = 15,
    ) -> list[StockItem]:
        if not self._api_key:
            raise StockProviderError(self.name, "missing_key", "PIXABAY_API_KEY no está configurada")
        # Si la orientación se filtra acá (video, o imagen cuadrada), se pide una
        # ventana más grande: la mayoría del video de Pixabay es horizontal y con
        # per_page=15 "vertical" volvía casi siempre vacío. La página pasa a ser
        # de esa ventana; alcanza para paginar de forma estable.
        local_filter = bool(orientation) and (kind == "video" or orientation == "square")
        fetch = per_page * _LOCAL_FILTER_FACTOR if local_filter else per_page
        # Su API de video no filtra por orientación y el video vertical casi
        # nunca aparece en una búsqueda genérica, pero viene etiquetado
        # "vertical": sumar la palabra lo trae (smoke real: "ocean" 0/15 → 20/20).
        if kind == "video" and orientation == "portrait" and "vertical" not in query.casefold():
            query = f"{query} vertical"
        # Pixabay exige per_page entre 3 y 200.
        params: dict = {"key": self._api_key, "q": query[:100], "page": page,
                        "per_page": max(3, min(fetch, 200)), "safesearch": "true"}
        if kind == "image":
            params["image_type"] = "photo"
            if orientation in _ORIENTATION:
                params["orientation"] = _ORIENTATION[orientation]
        url = f"{_BASE}videos/" if kind == "video" else _BASE
        body = await get_json(self.name, url, params=params, transport=self._transport)
        hits = body.get("hits", []) if isinstance(body, dict) else []
        items = [item for h in hits if (item := (_video_item(h) if kind == "video" else _image_item(h)))]
        if local_filter:
            items = [i for i in items if orientation_of(i.width, i.height) == orientation]
        return items[:per_page]


def _image_item(hit: dict) -> StockItem | None:
    url = hit.get("largeImageURL")
    if not url:
        return None
    width, height = fit_within(hit.get("imageWidth", 0), hit.get("imageHeight", 0), _LARGE_IMAGE_SIDE)
    return StockItem(
        provider="pixabay",
        provider_id=str(hit.get("id", "")),
        kind="image",
        title=hit.get("tags", ""),
        preview_url=hit.get("webformatURL") or hit.get("previewURL", ""),
        download_url=url,
        width=width,
        height=height,
        author=hit.get("user", ""),
        author_url=hit.get("userURL") or _user_url(hit),
        source_url=hit.get("pageURL", ""),
        license=_LICENSE,
    )


def _video_item(hit: dict) -> StockItem | None:
    variants = hit.get("videos") or {}
    chosen = next(
        (v for name in _VIDEO_VARIANTS
         if (v := variants.get(name)) and v.get("url")
         and 0 < max(v.get("width") or 0, v.get("height") or 0) <= _VIDEO_MAX_SIDE),
        None,
    )
    if chosen is None:
        return None
    return StockItem(
        provider="pixabay",
        provider_id=str(hit.get("id", "")),
        kind="video",
        title=hit.get("tags", ""),
        preview_url=chosen.get("thumbnail") or next(
            (v.get("thumbnail") for v in variants.values() if v.get("thumbnail")), ""
        ),
        download_url=chosen["url"],
        width=chosen.get("width") or 0,
        height=chosen.get("height") or 0,
        duration_seconds=float(hit.get("duration") or 0),
        author=hit.get("user", ""),
        author_url=hit.get("userURL") or _user_url(hit),
        source_url=hit.get("pageURL", ""),
        license=_LICENSE,
    )


def _user_url(hit: dict) -> str:
    user, user_id = hit.get("user"), hit.get("user_id")
    return f"https://pixabay.com/users/{user}-{user_id}/" if user and user_id else ""
