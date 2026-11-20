"""Composition root: swap the query provider without changing API/UI contracts."""
from typing import cast
from src.core.ports.biblioteca_query import PublicationLibrarySourcePort
from src.config.settings import settings
from src.core.categories import list_categories
from src.core.data import get_data_store
from src.core.library.biblioteca import BibliotecaService
from src.adapters.data.biblioteca_query import StoredLibraryQueries
from src.adapters.data.provider_registry import build_provider


def build_biblioteca_service(*, recordings, image_visible):
    def publication_records():
        from src.adapters.data.publication_factory import get_publication_components
        return cast(PublicationLibrarySourcePort, get_publication_components().port).library_records()

    if settings.data_backend != "json" or settings.publication_backend != "json":
        port = build_provider("library_queries", settings.data_backend,
                              recordings=recordings, image_visible=image_visible)
    else:
        port = StoredLibraryQueries(get_data_store(), list_categories(),
            publication_records=publication_records,
            recordings=recordings, image_visible=image_visible)
    return BibliotecaService(port)
