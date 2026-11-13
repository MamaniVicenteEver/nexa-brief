"""Optional port for providers that can resolve an article's lead image."""

from __future__ import annotations

from abc import ABC, abstractmethod

from src.core.ports.stock_media_port import StockItem


class ArticleImagePort(ABC):
    """Resolves an article title to a licensed, normalized image item."""

    @abstractmethod
    async def article_image(self, article: str, *, lang: str = "es") -> StockItem | None:
        """Return the article's main image when it is available in the provider."""
