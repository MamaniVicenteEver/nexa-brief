"""Storage composition, independent from execution mode and dataset selection."""

from src.config.settings import settings
from src.adapters.data.provider_registry import build_provider, register_provider


def build_data_store():
    if settings.data_backend == "json":
        from src.adapters.data.json_store import JsonDataStore

        return JsonDataStore()
    return build_provider("records", settings.data_backend)


def build_publication_components(**kwargs):
    from src.adapters.data.publication_factory import build_publication_components as build

    return build(**kwargs)


__all__ = ["build_data_store", "build_publication_components", "register_provider"]
