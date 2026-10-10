"""Pexels — imágenes (/v1/search) y videos (/videos/search).

Licencia Pexels: uso libre, atribución recomendada (se guarda autor + URL).
"""

from __future__ import annotations

from pathlib import PurePosixPath
from urllib.parse import urlparse

import httpx

from src.adapters.stock._http import fit_within, get_json
from src.config.settings import settings
from src.core.ports.stock_media_port import (
    StockItem,
    StockKind,
    StockMediaPort,
    StockOrientation,
    StockProviderError,
)

_BASE = "https://api.pexels.com"
_LICENSE = "Pexels License"
# Imágenes: el "original" puede pesar 20+ MB (6000 px). Pexels sirve por imgix,
# así que pedimos el original acotado a 2560 px de lado largo (fit=max no
# recorta ni agranda): sobra para un fondo 1080x1920 con zoom, sin inflar data/.
_IMAGE_MAX_SIDE = 2560
# Videos: la variante más grande cuyo lado largo no pase de 1920 (HD/Full HD).
# 4K cuadruplica el peso y el tiempo de decodificación al grabar sin ganar
# nada en un render 1080p.
_VIDEO_MAX_SIDE = 1920


class PexelsStockAdapter(StockMediaPort):
    name = "pexels"
    kinds = frozenset({"image", "video"})
    download_hosts = ("images.pexels.com", "videos.pexels.com")

    def __init__(self, api_key: str | None = None, transport: httpx.AsyncBaseTransport | None = None) -> None:
        self._api_key = settings.pexels_api_key if api_key is None else api_key
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
            raise StockProviderError(self.name, "missing_key", "PEXELS_API_KEY no está configurada")
        params: dict = {"query": query, "page": page, "per_page": min(per_page, 80)}
        if orientation:
            params["orientation"] = orientation  # Pexels usa los mismos nombres
        path = "/videos/search" if kind == "video" else "/v1/search"
        body = await get_json(
            self.name, f"{_BASE}{path}", params=params,
            headers={"Authorization": self._api_key}, transport=self._transport,
        )
        if kind == "video":
            return [item for v in body.get("videos", []) if (item := _video_item(v))]
        return [_photo_item(p) for p in body.get("photos", [])]


def _photo_item(photo: dict) -> StockItem:
    src = photo.get("src", {})
    width, height = fit_within(photo.get("width", 0), photo.get("height", 0), _IMAGE_MAX_SIDE)
    original = src.get("original", "")
    download = f"{original}?fit=max&w={_IMAGE_MAX_SIDE}&h={_IMAGE_MAX_SIDE}" if original else ""
    return StockItem(
        provider="pexels",
        provider_id=str(photo.get("id", "")),
        kind="image",
        title=photo.get("alt") or "",
        preview_url=src.get("medium") or src.get("small") or original,
        download_url=download,
        width=width,
        height=height,
        author=photo.get("photographer", ""),
        author_url=photo.get("photographer_url", ""),
        source_url=photo.get("url", ""),
        license=_LICENSE,
    )


def pick_video_file(files: list[dict], max_side: int = _VIDEO_MAX_SIDE) -> dict | None:
    """El mp4 de mayor resolución con lado largo <= max_side. A igual
    resolución, el de menor peso (suele ser el de menos fps: el render va a 30)."""
    candidates = [
        f for f in files
        if f.get("file_type") == "video/mp4" and f.get("link")
        and 0 < max(f.get("width") or 0, f.get("height") or 0) <= max_side
    ]
    if not candidates:
        return None
    return max(candidates, key=lambda f: ((f.get("width") or 0) * (f.get("height") or 0), -(f.get("size") or 0)))


def _title_from_page(url: str) -> str:
    # https://www.pexels.com/video/a-boat-is-in-the-water-25961000/ → "a boat is in the water"
    slug = PurePosixPath(urlparse(url).path).name
    words = [w for w in slug.split("-") if not w.isdigit()]
    return " ".join(words)


def _video_item(video: dict) -> StockItem | None:
    chosen = pick_video_file(video.get("video_files", []))
    if chosen is None:
        return None  # solo hay 4K o formatos raros: mejor no ofrecerlo
    user = video.get("user") or {}
    return StockItem(
        provider="pexels",
        provider_id=str(video.get("id", "")),
        kind="video",
        title=_title_from_page(video.get("url", "")),
        preview_url=video.get("image", ""),
        download_url=chosen["link"],
        width=chosen.get("width") or 0,
        height=chosen.get("height") or 0,
        duration_seconds=float(video.get("duration") or 0),
        author=user.get("name", ""),
        author_url=user.get("url", ""),
        source_url=video.get("url", ""),
        license=_LICENSE,
    )
