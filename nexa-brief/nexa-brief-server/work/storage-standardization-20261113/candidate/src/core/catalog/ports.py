from typing import Protocol

from .models import CatalogCategory, CatalogItem, CategorySnapshot, MediaObject


class CategoryRepository(Protocol):
    def list_categories(self) -> list[CatalogCategory]: ...
    def snapshot(self) -> CategorySnapshot: ...


class CatalogRepository(Protocol):
    def list_items(self) -> list[CatalogItem]: ...


class CatalogMedia(Protocol):
    def url(self, key: str) -> str: ...
    def open(self, key: str) -> MediaObject: ...
