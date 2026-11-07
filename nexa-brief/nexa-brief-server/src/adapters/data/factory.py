"""Storage composition, independent from execution mode and dataset selection."""

from src.config.settings import settings
from src.adapters.data.provider_registry import build_provider, register_provider


class _ComposedDataStore:
    """Mantiene el contrato existente y selecciona registros y archivos por separado."""

    def __init__(self, records, media):
        self._records = records
        self._media = media

    def coordination(self, name):
        return self._records.coordination(name)

    def collection(self, name):
        return self._records.collection(name)

    def documents(self, name):
        return self._records.documents(name)

    def files(self, name):
        return self._media.files(name)


def build_data_store():
    from src.adapters.data.json_store import JsonDataStore

    records = JsonDataStore() if settings.data_backend == "json" else build_provider("records", settings.data_backend)
    # A separate provider kind avoids conflating library FileStorage with the
    # publication-media protocol, which uses different methods.
    media = JsonDataStore() if settings.media_backend == "filesystem" else build_provider("files", settings.media_backend)
    return _ComposedDataStore(records, media)


def build_publication_components(**kwargs):
    from src.adapters.data.publication_factory import build_publication_components as build

    return build(**kwargs)


__all__ = ["build_data_store", "build_publication_components", "register_provider"]
