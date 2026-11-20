"""Backend JSON del DataStore — cada colección es un archivo con una lista.

Reemplaza las ~9 copias de `_lock_for / _read / _write` que tenían
job_tracker, notification_tracker, queue_repository, asset_library, etc.

- Escritura atómica (`.tmp` + `replace`): un crash nunca deja un JSON a medias.
- Un `asyncio.Lock` por archivo serializa cada read-modify-write dentro del
  proceso. Un flock asíncrono protege la transacción entre host y contenedores
  que comparten el mismo perfil en este servidor.
- Las rutas se resuelven en cada operación desde `settings.data_dir`, así los
  tests pueden redirigirlo a un directorio temporal.
"""

from __future__ import annotations

import asyncio
import contextvars
import json
import os
import re
import tempfile
import threading
from collections import defaultdict
from collections.abc import Callable, Sequence
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

import structlog

from src.adapters.data.file_locks import AsyncFileLock, file_lock
from src.adapters.data.layout import COLLECTIONS, DOCUMENTS, FILES
from src.adapters.data.local_file_storage import LocalFileStorage
from src.adapters.data.runtime_paths import assert_profile_path, data_directory, lock_path, temporary_dir
from src.adapters.data.section_store import COLLECTION_SECTIONS, DOCUMENT_SECTIONS, Section, is_v3
from src.config.profile_layout import layout_for_settings
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
    fd, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=temporary_dir(path))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            json.dump(data, stream, ensure_ascii=False, indent=2)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def _matches(record: Record, where: Where | None) -> bool:
    return not where or all(record.get(k) == v for k, v in where.items())


class JsonRecordCollection:
    def __init__(self, name: str, relative_path: str, key_field: str | None) -> None:
        self.name = name
        self.key_field = key_field
        self._relative_path = relative_path

    @property
    def _path(self) -> Path:
        if (self.name == "channels" and settings.shared_connections_dir is not None
                and layout_for_settings(settings).schema_version == 1):
            path = settings.shared_connections_dir / "channels.json"
        else:
            path = data_directory() / self._relative_path
        assert_profile_path(path)
        return path

    def _read(self) -> list[Record]:
        if is_v3():
            data = Section(COLLECTION_SECTIONS[self.name]).read()["collections"].get(self.name, [])
            if not isinstance(data, list) or any(not isinstance(row, dict) for row in data):
                raise RuntimeError(f"Invalid collection: {self.name}")
            return data
        data = _read_json(self._path, [])
        return data if isinstance(data, list) else []

    def _require_key(self) -> str:
        if self.key_field is None:
            raise TypeError(f"Collection '{self.name}' has no key_field; use the *_where methods.")
        return self.key_field

    async def _mutate(self, fn: Callable[[list[Record]], tuple[list[Record], Any]]) -> Any:
        """Read-modify-write bajo el lock del archivo. `fn` devuelve (nuevos datos, resultado)."""
        if is_v3():
            def transaction(section: dict[str, Any]) -> Any:
                collections = section["collections"]
                data = collections.get(self.name, [])
                if not isinstance(data, list) or any(not isinstance(row, dict) for row in data):
                    raise RuntimeError(f"Invalid collection: {self.name}")
                new_data, result = fn(data)
                if self.key_field is not None:
                    keys = [row.get(self.key_field) for row in new_data]
                    if any(not isinstance(key, str) or not key for key in keys) or len(keys) != len(set(keys)):
                        raise ValueError(f"Missing or duplicate key in collection: {self.name}")
                if new_data or self.name in collections:
                    collections[self.name] = new_data
                return result
            return await Section(COLLECTION_SECTIONS[self.name]).mutate_async(transaction)
        path = self._path
        async with _locks[path]:
            async with AsyncFileLock(lock_path(path)):
                data = _read_json(path, [])
                data = data if isinstance(data, list) else []
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


# Escrituras y lecturas de un almacén de documentos fuera del bucle de eventos.
# Un hilo por almacén: su archivo se reescribe entero, así que las operaciones
# de un mismo almacén se ejecutan en el orden en que se pidieron.
_colas_de_documentos: dict[str, ThreadPoolExecutor] = {}
_colas_lock = threading.Lock()


def _cola_de_documentos(nombre: str) -> ThreadPoolExecutor:
    with _colas_lock:
        cola = _colas_de_documentos.get(nombre)
        if cola is None:
            cola = ThreadPoolExecutor(max_workers=1, thread_name_prefix=f"docs-{nombre}")
            _colas_de_documentos[nombre] = cola
        return cola


async def _en_cola_de_documentos(nombre: str, fn: Callable[..., Any], *args: Any) -> Any:
    # Como asyncio.to_thread: el hilo recibe una copia del contexto de la petición.
    ctx = contextvars.copy_context()
    return await asyncio.wrap_future(_cola_de_documentos(nombre).submit(ctx.run, fn, *args))


class JsonDocumentStore:
    """Un archivo `{clave}.json` por documento."""

    def __init__(self, name: str, relative_dir: str) -> None:
        self.name = name
        self._relative_dir = relative_dir

    def _path(self, key: str) -> Path:
        if "/" in key or "\\" in key or key.startswith("."):
            raise ValueError(f"Invalid document key: {key!r}")
        path = data_directory() / self._relative_dir / f"{key}.json"
        assert_profile_path(path)
        return path

    def all_documents(self) -> dict[str, Any]:
        """Todos los documentos de la colección en una sola lectura del almacén."""
        if is_v3():
            docs = Section(DOCUMENT_SECTIONS[self.name]).read()["documents"].get(self.name, {})
            return dict(docs) if isinstance(docs, dict) else {}
        found: dict[str, Any] = {}
        for path in sorted((data_directory() / self._relative_dir).glob("*.json")):
            value = _read_json(path, None)
            if value is not None:
                found[path.stem] = value
        return found

    def get(self, key: str) -> Any | None:
        if is_v3():
            self._validate_key(key)
            docs = Section(DOCUMENT_SECTIONS[self.name]).read()["documents"].get(self.name, {})
            if not isinstance(docs, dict):
                raise RuntimeError(f"Invalid document store: {self.name}")
            return docs.get(key)
        return _read_json(self._path(key), None)

    def put(self, key: str, document: Any) -> None:
        if is_v3():
            self._validate_key(key)
            def transaction(section: dict[str, Any]) -> None:
                docs = section["documents"].setdefault(self.name, {})
                if not isinstance(docs, dict):
                    raise RuntimeError(f"Invalid document store: {self.name}")
                docs[key] = document
            Section(DOCUMENT_SECTIONS[self.name]).mutate(transaction)
            return
        path = self._path(key)
        with file_lock(lock_path(path)):
            _write_json(path, document)

    def delete(self, key: str) -> bool:
        if is_v3():
            self._validate_key(key)
            def transaction(section: dict[str, Any]) -> bool:
                docs = section["documents"].get(self.name, {})
                if not isinstance(docs, dict):
                    raise RuntimeError(f"Invalid document store: {self.name}")
                if key not in docs:
                    return False
                del docs[key]
                return True
            return Section(DOCUMENT_SECTIONS[self.name]).mutate(transaction)
        path = self._path(key)
        if not path.exists():
            return False
        with file_lock(lock_path(path)):
            if not path.exists():
                return False
            path.unlink()
        return True

    @staticmethod
    def _validate_key(key: str) -> None:
        if "/" in key or "\\" in key or key.startswith("."):
            raise ValueError(f"Invalid document key: {key!r}")

    async def aall_documents(self) -> dict[str, Any]:
        """Como all_documents, sin bloquear el bucle de eventos."""
        return await _en_cola_de_documentos(self.name, self.all_documents)

    async def aget(self, key: str) -> Any | None:
        return await _en_cola_de_documentos(self.name, self.get, key)

    async def aput(self, key: str, document: Any) -> None:
        """Guarda sin bloquear el bucle. Las operaciones del mismo almacén se
        ejecutan en el orden en que se piden: un guardado viejo no pisa uno nuevo."""
        await _en_cola_de_documentos(self.name, self.put, key, document)

    async def adelete(self, key: str) -> bool:
        return await _en_cola_de_documentos(self.name, self.delete, key)


class JsonDataStore:
    def __init__(self) -> None:
        self._collections: dict[str, JsonRecordCollection] = {}
        self._documents: dict[str, JsonDocumentStore] = {}
        self._files: dict[str, LocalFileStorage] = {}

    def coordination(self, name: str) -> AsyncFileLock:
        if name == "queue_claim":
            path = data_directory() / "schedule/.queue-claim.lock"
        elif re.fullmatch(r"content-video-[A-Za-z0-9_-]{1,128}", name):
            path = data_directory() / "content" / f".{name}.lock"
        elif name == "showcase":
            path = data_directory() / "showcase" / ".coordination.lock"
        elif name == "sandbox-preparations":
            path = data_directory() / "prototypes" / ".preparation-coordination.lock"
        elif re.fullmatch(r"localization-[a-f0-9]{32}", name):
            path = data_directory() / "explainer" / f".{name}.lock"
        elif (name in {"library-upload-image", "library-upload-video"}
              or re.fullmatch(r"library-bundled-(?:image|video|music)-[a-f0-9]{64}", name)):
            path = data_directory() / "library" / f".{name}.lock"
        elif (name == "promo-host-preparation"
              or re.fullmatch(r"promo-chat-[a-f0-9]{32}", name)
              or re.fullmatch(r"promo-chat-import-[A-Za-z0-9][A-Za-z0-9_-]{0,127}", name)):
            path = data_directory() / "promos" / f".{name}.lock"
        else:
            raise KeyError(f"Unknown coordination lock: {name}")
        # Host preparation includes media discovery and previews, and can take
        # longer than the default short transaction timeout. Waiting is async
        # and cancellation closes the descriptor in AsyncFileLock.__aenter__.
        return AsyncFileLock(lock_path(path, path), timeout=7200 if name == "promo-host-preparation" else 150)

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
