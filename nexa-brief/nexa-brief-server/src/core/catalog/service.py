from .models import CatalogPage
from .ports import CatalogRepository, CategoryRepository


class CatalogService:
    """No HTTP, settings, JSON, paths or imports from adapters in this module."""

    def __init__(self, repository: CatalogRepository, categories: CategoryRepository):
        self.repository = repository
        self.categories = categories

    def list(self, *, category: str | None = None, page: int = 1,
             page_size: int | str = "all") -> CatalogPage:
        if page < 1:
            raise ValueError("page debe ser mayor que cero")
        if page_size != "all":
            try:
                page_size = int(page_size)
            except (ValueError, TypeError):
                raise ValueError("page_size debe ser all o un entero entre 1 y 100") from None
            if not 1 <= page_size <= 100:
                raise ValueError("page_size debe ser all o un entero entre 1 y 100")
        # IDs identify a demo, not a card for each shared category.
        unique = {item.id: item for item in self.repository.list_items()}
        items = sorted(unique.values(), key=lambda item: (item.title.casefold(), item.id))
        categories = self.categories.list_categories()
        counts = {c.id: sum(c.id in item.category_ids for item in items) for c in categories}
        filtered = [item for item in items if not category or category == "all" or category in item.category_ids]
        total = len(filtered)
        if page_size == "all":
            if page != 1:
                raise ValueError("page debe ser 1 cuando page_size es all")
            selected, pages = filtered, 1
        else:
            selected = filtered[(page - 1) * page_size:page * page_size]
            pages = max(1, (total + page_size - 1) // page_size)
        return CatalogPage(items=selected, categories=categories, total=total, page=page,
                           page_size=page_size, total_pages=pages, category_counts=counts)
