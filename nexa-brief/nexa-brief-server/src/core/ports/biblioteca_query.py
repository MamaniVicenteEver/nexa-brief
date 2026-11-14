"""Read-only boundary for Biblioteca providers (JSON, SQL or another store)."""
from __future__ import annotations
from typing import Any, TYPE_CHECKING, Protocol

if TYPE_CHECKING:
    from src.core.library.biblioteca import LibraryPage, LibraryQuery


class LibraryQueryPort(Protocol):
    def query(self, query: LibraryQuery) -> LibraryPage:
        """Authorize, filter, aggregate and sort before returning a 20-item page.

        Category facets follow search; status counts follow search + category.
        Counts must include all matching records, not just the returned page.
        Providers return safe card projections, never credentials/storage objects.
        """
        ...


class PublicationLibrarySourcePort(Protocol):
    def library_records(self) -> list[dict[str, Any]]:
        """Read-only snapshot for the JSON query adapter, without media bytes."""
        ...
