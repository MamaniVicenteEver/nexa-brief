"""GET JSON compartido por los adapters de stock: traduce los errores de httpx
a `StockProviderError` con un `code` estable, así el servicio agregador puede
reportar "proveedor caído" sin conocer cada librería ni cada API."""

from __future__ import annotations

from typing import Any

import httpx

from src.config.settings import settings
from src.core.ports.stock_media_port import StockProviderError


async def get_json(
    provider: str,
    url: str,
    *,
    params: dict[str, Any],
    headers: dict[str, str] | None = None,
    transport: httpx.AsyncBaseTransport | None = None,
) -> Any:
    try:
        async with httpx.AsyncClient(timeout=settings.api_timeout_seconds, transport=transport) as client:
            response = await client.get(url, params=params, headers=headers)
    except httpx.HTTPError as exc:
        raise StockProviderError(provider, "network", f"{provider}: {type(exc).__name__}") from exc
    if response.status_code == 429:
        raise StockProviderError(provider, "rate_limited", f"{provider}: límite de búsquedas alcanzado")
    if response.status_code in (401, 403):
        raise StockProviderError(provider, "invalid_key", f"{provider}: API key rechazada")
    if response.status_code != 200:
        raise StockProviderError(provider, "http_error", f"{provider}: HTTP {response.status_code}")
    try:
        return response.json()
    except ValueError as exc:
        raise StockProviderError(provider, "bad_response", f"{provider}: respuesta no es JSON") from exc


def fit_within(width: int, height: int, max_side: int) -> tuple[int, int]:
    """Dimensiones de (width, height) reducidas para que el lado largo no pase
    de *max_side* (sin agrandar). Sirve para informar el tamaño REAL que se va
    a descargar cuando el proveedor sirve una versión escalada."""
    longest = max(width, height)
    if longest <= max_side or longest == 0:
        return width, height
    scale = max_side / longest
    return round(width * scale), round(height * scale)


def orientation_of(width: int, height: int) -> str:
    if not width or not height:
        return ""
    ratio = width / height
    if ratio > 1.1:
        return "landscape"
    if ratio < 0.9:
        return "portrait"
    return "square"
