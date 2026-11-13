"""Composition root. Change providers here, never in core services or views."""
from src.config.settings import settings
from src.core.catalog.service import CatalogService
from .media import RepositoryCatalogMedia
from .repository import FilesystemCatalogRepository, JsonCategoryRepository


def catalog_media():
    return RepositoryCatalogMedia(settings.templates_dir)


def catalog_service():
    categories = JsonCategoryRepository(settings.niches_path)
    return CatalogService(FilesystemCatalogRepository(settings.templates_dir, categories, catalog_media()), categories)
