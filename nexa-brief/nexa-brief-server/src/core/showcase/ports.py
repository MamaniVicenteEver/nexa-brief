"""Puerto de almacenamiento de diseños, sin dependencia del formato del proveedor."""
from pathlib import Path
from typing import Any, Protocol


class ShowcaseNotFound(Exception):
    """No existe el diseño o recurso solicitado."""


class ShowcaseConflict(Exception):
    """El diseño no se puede promover en su estado actual."""


class ShowcaseInvalid(Exception):
    """La solicitud o el contrato de datos es inválido."""


class ShowcaseRepository(Protocol):
    def list_designs(self) -> list[dict[str, Any]]: ...
    def get_design(self, design_id: str) -> dict[str, Any] | None: ...
    def get_catalog(self, design_id: str) -> dict[str, Any] | None: ...
    def preview(self, design_id: str, entry_id: str | None, format: str) -> str | None: ...
    def resolve_file(self, design_id: str, path: str) -> Path | None: ...
    def promote(self, design_id: str) -> dict[str, Any]: ...


class SandboxShowcaseRepository(Protocol):
    def sandbox_visibility(self) -> list[dict[str, Any]]: ...
    def set_sandbox_visibility(self, folder: str, project_id: str, visible: bool) -> dict[str, Any]: ...
