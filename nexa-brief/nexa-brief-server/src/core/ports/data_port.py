"""Data ports — el contrato de persistencia que usa todo el backend.

Nadie fuera de `src/adapters/data/` sabe CÓMO se guardan los datos (hoy:
archivos JSON en `data/`). Los repositorios del dominio (`job_tracker`,
`notification_tracker`, `queue_repository`, `asset_library`, …) solo hablan
con estas tres interfaces, así que cambiar de backend (Supabase, Postgres,
Mongo, S3…) es escribir un adapter nuevo que las implemente y seleccionarlo
con `DATA_BACKEND` — sin tocar routers, pipeline ni repositorios.

Tres tipos de almacenamiento, porque cada uno mapea distinto a una base real:

- `RecordCollection`: registros chicos con campos consultables (jobs,
  notificaciones, cola…) → una tabla.
- `DocumentStore`: un JSON grande y opaco por clave (transcripciones, análisis
  de visión, configs archivadas) → tabla `key + jsonb`, o un bucket.
- `FileStorage`: archivos binarios (mp3, imágenes, videos) → Storage/S3.

Decisiones deliberadas del contrato:
- Filtros por igualdad (`where={"status": "queued"}`): es lo que cualquier
  backend soporta tal cual. Orden, rangos y paginación los resuelve el
  repositorio en Python por ahora; un adapter de DB puede optimizarlos luego.
- Lecturas síncronas y escrituras async: calza con cómo ya se usan los
  repositorios (lecturas desde código sync, escrituras dentro del pipeline).
- `FileStorage.local_path()` devuelve un Path local porque ffmpeg, Whisper y
  los recorders necesitan un archivo en disco; un adapter remoto lo bajaría a
  un caché local.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any, Protocol

Record = dict[str, Any]
Where = Mapping[str, Any]


class RecordCollection(Protocol):
    """Una colección de registros (≈ una tabla). `key_field` es la PK, si tiene."""

    name: str
    key_field: str | None

    def list(self, where: Where | None = None) -> list[Record]: ...

    def first(self, where: Where) -> Record | None: ...

    def get(self, key: str) -> Record | None: ...

    async def insert(self, record: Record) -> Record: ...

    async def update(
        self, key: str, patch: Record, *, only_if: Where | None = None
    ) -> Record | None:
        """Merge de `patch` sobre el registro. None si no existe o si no cumple
        `only_if` (update condicional, ej. solo cancelar si status=queued)."""
        ...

    async def update_where(self, where: Where, patch: Record) -> list[Record]: ...

    async def increment(
        self, key: str, field: str, by: int = 1, *, patch: Record | None = None
    ) -> Record | None: ...

    async def upsert(self, record: Record, *, match: Sequence[str]) -> Record:
        """Actualiza el registro cuyo valor en `match` coincide, o lo inserta."""
        ...

    async def delete(self, key: str) -> Record | None: ...

    async def delete_where(self, where: Where) -> list[Record]: ...


class DocumentStore(Protocol):
    """JSON opaco por clave (≈ tabla `key TEXT PRIMARY KEY, body JSONB`)."""

    name: str

    def get(self, key: str) -> Any | None: ...

    def put(self, key: str, document: Any) -> None: ...

    def delete(self, key: str) -> bool: ...


class FileStorage(Protocol):
    """Archivos binarios agrupados por carpeta (≈ un bucket con prefijos)."""

    name: str

    def save(self, source: Path, *, folder: str, filename: str) -> str:
        """Copia `source` y devuelve la clave con la que quedó guardado
        (`folder/nombre.ext`). Respeta `filename` salvo caracteres inválidos;
        si ya existe uno igual, agrega ` (2)`, ` (3)`… en vez de pisarlo."""
        ...

    def local_path(self, key: str) -> Path: ...

    def list_keys(self, folder: str, *, suffix: str | None = None) -> list[str]: ...

    def delete(self, key: str) -> bool: ...


class DataStore(Protocol):
    """Punto de entrada: entrega colecciones/documentos/archivos por nombre lógico."""

    def collection(self, name: str) -> RecordCollection: ...

    def documents(self, name: str) -> DocumentStore: ...

    def files(self, name: str) -> FileStorage: ...
