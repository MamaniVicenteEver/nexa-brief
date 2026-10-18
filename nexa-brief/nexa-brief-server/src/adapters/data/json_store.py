"""Backend JSON del DataStore — cada colección es un archivo con una lista.

Reemplaza las ~9 copias de `_lock_for / _read / _write` que tenían
job_tracker, notification_tracker, queue_repository, asset_library, etc.

- Escritura atómica (`.tmp` + `replace`): un crash nunca deja un JSON a medias.
- Un `asyncio.Lock` por archivo serializa cada read-modify-write dentro del
  proceso (varios jobs del pipeline escriben a la vez). No protege entre
  procesos distintos — para eso está el backend de base de datos.
- Las rutas se resuelven en cada operación desde `settings.data_dir`, así los
  tests pueden redirigirlo a un directorio temporal.
"""

from __future__ import annotations

import asyncio
import json
from collections import defaultdict
from collections.abc import Callable, Sequence
from pathlib import Path
from typing import Any

import structlog

from src.adapters.data.layout import COLLECTIONS, DOCUMENTS, FILES
from src.adapters.data.local_file_storage import LocalFileStorage
from src.config.settings import settings
from src.core.ports.data_port import Record, Where

logger = structlog.get_logger(__name__)

_locks: dict[Path, asyncio.Lock] = defaultdict(asyncio.Lock)


def _read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    raw = path.read_text(encoding="utf-8").strip()
    if not raw:
        return default
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        logger.error("json_store_corrupt_file", path=str(path))
        return default


def _write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    tmp.replace(path)


def _matches(record: Record, where: Where | None) -> bool:
    return not where or all(record.get(k) == v for k, v in where.items())


class JsonRecordCollection:
    def __init__(self, name: str, relative_path: str, key_field: str | None) -> None:
        self.name = name
        self.key_field = key_field
        self._relative_path = relative_path

    @property
    def _path(self) -> Path:
        return settings.data_dir / self._relative_path

    def _read(self) -> list[Record]:
        data = _read_json(self._path, [])
        return data if isinstance(data, list) else []

    def _require_key(self) -> str:
        if self.key_field is None:
            raise TypeError(f"Collection '{self.name}' has no key_field; use the *_where methods.")
        return self.key_field

    async def _mutate(self, fn: Callable[[list[Record]], tuple[list[Record], Any]]) -> Any:
        """Read-modify-write bajo el lock del archivo. `fn` devuelve (nuevos datos, resultado)."""
        path = self._path
        async with _locks[path]:
            data = self._read()
            new_data, result = fn(data)
            if new_data is not data or result is not None:
                _write_json(path, new_data)
            return result

    # ── Lecturas ─────────────────────────────────────────────────────────────

    def list(self, where: Where | None = None) -> list[Record]:
        return [r for r in self._read() if _matches(r, where)]

    def first(self, where: Where) -> Record | None:
        return next((r for r in self._read() if _matches(r, where)), None)

    def get(self, key: str) -> Record | None:
        return self.first({self._require_key(): key})

    # ── Escrituras ───────────────────────────────────────────────────────────

    async def insert(self, record: Record) -> Record:
        def fn(data: list[Record]) -> tuple[list[Record], Record]:
            return [*data, record], record

        return await self._mutate(fn)

    async def update(self, key: str, patch: Record, *, only_if: Where | None = None) -> Record | None:
        key_field = self._require_key()

        def fn(data: list[Record]) -> tuple[list[Record], Record | None]:
            for i, r in enumerate(data):
                if r.get(key_field) == key:
                    if not _matches(r, only_if):
                        return data, None
                    data[i] = {**r, **patch}
                    return data, data[i]
            return data, None

        return await self._mutate(fn)

    async def update_where(self, where: Where, patch: Record) -> list[Record]:
        def fn(data: list[Record]) -> tuple[list[Record], list[Record] | None]:
            changed = []
            for i, r in enumerate(data):
                if _matches(r, where):
                    data[i] = {**r, **patch}
                    changed.append(data[i])
            return data, changed or None

        return await self._mutate(fn) or []

    async def increment(
        self, key: str, field: str, by: int = 1, *, patch: Record | None = None
    ) -> Record | None:
        key_field = self._require_key()

        def fn(data: list[Record]) -> tuple[list[Record], Record | None]:
            for i, r in enumerate(data):
                if r.get(key_field) == key:
                    data[i] = {**r, **(patch or {}), field: int(r.get(field) or 0) + by}
                    return data, data[i]
            return data, None

        return await self._mutate(fn)

    async def upsert(self, record: Record, *, match: Sequence[str]) -> Record:
        where = {k: record.get(k) for k in match}

        def fn(data: list[Record]) -> tuple[list[Record], Record]:
            for i, r in enumerate(data):
                if _matches(r, where):
                    data[i] = {**r, **record}
                    return data, data[i]
            return [*data, record], record

        return await self._mutate(fn)

    async def delete(self, key: str) -> Record | None:
        key_field = self._require_key()
        removed = await self.delete_where({key_field: key})
        return removed[0] if removed else None

    async def delete_where(self, where: Where) -> list[Record]:
        def fn(data: list[Record]) -> tuple[list[Record], list[Record] | None]:
            removed = [r for r in data if _matches(r, where)]
            if not removed:
                return data, None
            return [r for r in data if not _matches(r, where)], removed

        return await self._mutate(fn) or []


class JsonDocumentStore:
    """Un archivo `{clave}.json` por documento."""

    def __init__(self, name: str, relative_dir: str) -> None:
        self.name = name
        self._relative_dir = relative_dir

    def _path(self, key: str) -> Path:
        if "/" in key or "\\" in key or key.startswith("."):
            raise ValueError(f"Invalid document key: {key!r}")
        return settings.data_dir / self._relative_dir / f"{key}.json"

    def get(self, key: str) -> Any | None:
        return _read_json(self._path(key), None)

    def put(self, key: str, document: Any) -> None:
        _write_json(self._path(key), document)

    def delete(self, key: str) -> bool:
        path = self._path(key)
        if not path.exists():
            return False
        path.unlink()
        return True


class JsonDataStore:
    def __init__(self) -> None:
        self._collections: dict[str, JsonRecordCollection] = {}
        self._documents: dict[str, JsonDocumentStore] = {}
        self._files: dict[str, LocalFileStorage] = {}

    def collection(self, name: str) -> JsonRecordCollection:
        if name not in self._collections:
            relative_path, key_field = _lookup(COLLECTIONS, name, "collection")
            self._collections[name] = JsonRecordCollection(name, relative_path, key_field)
        return self._collections[name]

    def documents(self, name: str) -> JsonDocumentStore:
        if name not in self._documents:
            self._documents[name] = JsonDocumentStore(name, _lookup(DOCUMENTS, name, "document store"))
        return self._documents[name]

    def files(self, name: str) -> LocalFileStorage:
        if name not in self._files:
            self._files[name] = LocalFileStorage(name, _lookup(FILES, name, "file storage"))
        return self._files[name]


def _lookup(catalog: dict[str, Any], name: str, kind: str) -> Any:
    try:
        return catalog[name]
    except KeyError:
        raise KeyError(f"Unknown {kind} '{name}' — declare it in src/adapters/data/layout.py") from None
