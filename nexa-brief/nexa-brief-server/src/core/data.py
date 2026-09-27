"""Acceso al DataStore configurado — el único lugar donde el dominio lo obtiene.

Uso desde un repositorio:

    from src.core.data import collection
    _jobs = lambda: collection("jobs")      # nombre lógico, ver adapters/data/layout.py

Se resuelve perezosamente (en cada llamada) para que los tests puedan
redirigir `settings.data_dir` y para que `set_data_store()` pueda inyectar
otro backend (ej. uno en memoria) sin reimportar nada.
"""

from __future__ import annotations

from src.core.ports.data_port import DataStore, DocumentStore, FileStorage, RecordCollection

_store: DataStore | None = None


def get_data_store() -> DataStore:
    global _store
    if _store is None:
        # Composition root por defecto: el backend lo decide settings.data_backend.
        from src.adapters.data.factory import build_data_store

        _store = build_data_store()
    return _store


def set_data_store(store: DataStore | None) -> None:
    """Inyecta un backend (tests, scripts). `None` vuelve al de settings."""
    global _store
    _store = store


def collection(name: str) -> RecordCollection:
    return get_data_store().collection(name)


def documents(name: str) -> DocumentStore:
    return get_data_store().documents(name)


def files(name: str) -> FileStorage:
    return get_data_store().files(name)
