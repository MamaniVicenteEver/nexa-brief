"""Búsqueda en bancos de stock e importación a la librería (F3).

Ver docs/investigaciones/estudio-creacion-interactiva-2026-09.md §3.3. Lo usan
el router `/stock/*` y el director de medios con IA.
"""

from src.core.stock.service import (
    StockImportError,
    StockImportResult,
    StockProviderIssue,
    StockSearchResult,
    get_stock_providers,
    import_stock_item,
    provider_status,
    search_stock,
    set_stock_providers,
)

__all__ = [
    "StockImportError",
    "StockImportResult",
    "StockProviderIssue",
    "StockSearchResult",
    "get_stock_providers",
    "import_stock_item",
    "provider_status",
    "search_stock",
    "set_stock_providers",
]
