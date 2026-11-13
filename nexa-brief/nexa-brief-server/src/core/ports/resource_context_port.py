"""Catalog boundary for a resource's category and template provenance."""
from __future__ import annotations
from typing import Protocol, TYPE_CHECKING
if TYPE_CHECKING:
    from src.core.library.resource_metadata import ResourceOrigin

class ResourceContextPort(Protocol):
    def resolve(self, category: str = "", template_id: str = "") -> ResourceOrigin | None: ...
