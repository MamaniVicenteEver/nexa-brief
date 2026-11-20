"""Inventario de recursos de una producción, sin abrir sus archivos."""
from pathlib import Path
from typing import Iterable, Protocol


class ContentInventory(Protocol):
    def assets(self, production_dir: Path) -> Iterable[tuple[Path, str]]: ...
