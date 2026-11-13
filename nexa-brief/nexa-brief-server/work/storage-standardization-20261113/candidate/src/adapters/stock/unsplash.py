"""Unsplash — solo imágenes (/search/photos).

Las guidelines de la API exigen dos cosas que se cumplen acá:
- Avisar cada descarga real a `GET /photos/{id}/download` (`notify_download`).
- Atribuir al fotógrafo y a Unsplash con parámetros UTM en los links.
"""

from __future__ import annotations

import httpx
import structlog

from src.adapters.stock._http import fit_within, get_json
from src.config.settings import settings
from src.core.ports.stock_media_port import (
    StockItem,
    StockKind,
    StockMediaPort,
    StockOrientation,
    StockProviderError,
)

logger = structlog.get_logger(__name__)

_BASE = "https://api.unsplash.com"
_LICENSE = "Unsplash License"
_UTM = "utm_source=nexa_brief&utm_medium=referral"
# `raw` es el original (10000 px a veces); imgix lo acota a 2560 de lado largo
# en JPG q=85: calidad de sobra para un fondo 1080x1920 con zoom.
_IMAGE_MAX_SIDE = 2560
_ORIENTATION = {"landscape": "landscape", "portrait": "portrait", "square": "squarish"}


def _with_utm(url: str) -> str:
    if not url:
        return ""
    return f"{url}{'&' if '?' in url else '?'}{_UTM}"


class UnsplashStockAdapter(StockMediaPort):
    name = "unsplash"
    kinds = frozenset({"image"})
    download_hosts = ("images.unsplash.com",)

    def __init__(self, api_key: str | None = None, transport: httpx.AsyncBaseTransport | None = None) -> None:
        self._api_key = settings.unsplash_api_key if api_key is None else api_key
        self._transport = transport

    @property
    def configured(self) -> bool:
        return bool(self._api_key)

    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Client-ID {self._api_key}", "Accept-Version": "v1"}

    async def search(
        self,
        query: str,
        kind: StockKind,
        *,
        orientation: StockOrientation | None = None,
        page: int = 1,
        per_page: int = 15,
    ) -> list[StockItem]:
        if kind != "image":
            return []
        if not self._api_key:
            raise StockProviderError(self.name, "missing_key", "UNSPLASH_API_KEY no está configurada")
        params: dict = {"query": query, "page": page, "per_page": min(per_page, 30), "content_filter": "high"}
        if orientation:
            params["orientation"] = _ORIENTATION[orientation]
        body = await get_json(
            self.name, f"{_BASE}/search/photos", params=params,
            headers=self._headers(), transport=self._transport,
        )
        return [item for p in body.get("results", []) if (item := _photo_item(p))]

    async def notify_download(self, provider_id: str) -> None:
        if not self._api_key:
            return
        try:
            await get_json(
                self.name, f"{_BASE}/photos/{provider_id}/download", params={},
                headers=self._headers(), transport=self._transport,
            )
        except StockProviderError as exc:
            # El aviso es de cortesía con la API: si falla, la imagen ya está bajada.
            logger.warning("unsplash_download_notify_failed", photo_id=provider_id, error=str(exc))


def _photo_item(photo: dict) -> StockItem | None:
    urls = photo.get("urls") or {}
    raw = urls.get("raw")
    if not raw:
        return None
    width, height = fit_within(photo.get("width", 0), photo.get("height", 0), _IMAGE_MAX_SIDE)
    user = photo.get("user") or {}
    sep = "&" if "?" in raw else "?"
    return StockItem(
        provider="unsplash",
        provider_id=str(photo.get("id", "")),
        kind="image",
        title=photo.get("alt_description") or photo.get("description") or "",
        preview_url=urls.get("small") or urls.get("thumb", ""),
        download_url=f"{raw}{sep}fm=jpg&q=85&fit=max&w={_IMAGE_MAX_SIDE}&h={_IMAGE_MAX_SIDE}",
        width=width,
        height=height,
        author=user.get("name", ""),
        author_url=_with_utm((user.get("links") or {}).get("html", "")),
        source_url=_with_utm((photo.get("links") or {}).get("html", "")),
        license=_LICENSE,
    )
