"""Elige el backend de datos según `settings.data_backend` (env `DATA_BACKEND`)."""

from __future__ import annotations

from src.config.settings import settings
from src.core.ports.data_port import DataStore


def build_data_store() -> DataStore:
    backend = settings.data_backend
    if backend == "json":
        from src.adapters.data.json_store import JsonDataStore

        return JsonDataStore()
    # Para agregar Supabase/Postgres: implementar DataStore en
    # src/adapters/data/<backend>_store.py y sumarlo acá (ver README.md).
    raise ValueError(f"Unsupported DATA_BACKEND '{backend}'. Available: json.")


def build_publication_components(**kwargs):
    """Inyecta el adapter de archivo junto al backend configurado."""
    from src.adapters.data.publication_factory import build_publication_components as build

    if settings.data_backend != "json":
        raise ValueError(f"Unsupported publication backend '{settings.data_backend}'. Available: json.")
    return build(**kwargs)
