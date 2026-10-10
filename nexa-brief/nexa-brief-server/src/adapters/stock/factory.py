"""Composition root de los bancos de stock: qué adapters existen y en qué
orden se intercalan sus resultados. `src/core/stock/service.py` lo carga
perezosamente (mismo patrón que `core/data.py` con el DataStore)."""

from __future__ import annotations

from src.adapters.stock.pexels import PexelsStockAdapter
from src.adapters.stock.pixabay import PixabayStockAdapter
from src.adapters.stock.unsplash import UnsplashStockAdapter
from src.core.ports.stock_media_port import StockMediaPort


def build_stock_providers() -> dict[str, StockMediaPort]:
    # Orden = prioridad al intercalar: Pexels primero (mejor video y fotos en
    # resolución completa), Pixabay (mucho video, fotos a 1280 px), Unsplash.
    providers: list[StockMediaPort] = [PexelsStockAdapter(), PixabayStockAdapter(), UnsplashStockAdapter()]
    return {p.name: p for p in providers}
