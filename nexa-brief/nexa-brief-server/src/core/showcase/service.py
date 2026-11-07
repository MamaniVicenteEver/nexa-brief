"""Identidades estables y validación del contrato de los diseños."""
from __future__ import annotations

import re
from urllib.parse import parse_qsl, quote, urlencode, urljoin, urlsplit

from pydantic import ValidationError

from .models import Catalog, Design, DesignList, Entry, SandboxShowcaseState
from .ports import ShowcaseConflict, ShowcaseInvalid, ShowcaseNotFound, ShowcaseRepository

_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$")
_ENTRY_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")
_BASE = "/api/v1/showcase/designs"


def _id(value: str, *, entry: bool = False) -> str:
    if not isinstance(value, str) or not (_ENTRY_ID if entry else _ID).fullmatch(value) or ".." in value:
        raise ShowcaseInvalid("Identificador inválido")
    return value


def _preview_url(design_id: str, entry_id: str | None = None) -> str:
    url = f"{_BASE}/{quote(design_id, safe='')}/preview"
    if entry_id is not None:
        url += "?" + urlencode({"entry": entry_id, "format": "9x16"})
    return url


def _safe_destination(value: str, design_id: str) -> str:
    if not isinstance(value, str) or any(ord(c) < 32 or ord(c) == 127 for c in value) or "\\" in value:
        raise ShowcaseInvalid("Vista previa inválida")
    try:
        parsed = urlsplit(value)
    except ValueError as exc:
        raise ShowcaseInvalid("Vista previa inválida") from exc
    if parsed.scheme or parsed.netloc or parsed.fragment or not parsed.path.startswith("/"):
        raise ShowcaseInvalid("Vista previa inválida")
    parts = parsed.path.split("/")
    if any(part in {".", ".."} or "%" in part or part.startswith(".") for part in parts):
        raise ShowcaseInvalid("Vista previa inválida")
    allowed = ("/api/v1/explainer/files/", f"{_BASE}/{design_id}/files/")
    if not parsed.path.startswith(allowed) or "//" in parsed.path:
        raise ShowcaseInvalid("Vista previa inválida")
    for key, val in parse_qsl(parsed.query, keep_blank_values=True):
        if any(ord(c) < 32 or ord(c) == 127 for c in key + val) or "\\" in key + val:
            raise ShowcaseInvalid("Vista previa inválida")
        # A loaded script must remain a relative file reference, never a remote URL.
        if key == "js":
            try:
                script = urlsplit(val)
                resolved = urlsplit(urljoin(parsed.path, val))
            except ValueError as exc:
                raise ShowcaseInvalid("Vista previa inválida") from exc
            if (script.scheme or script.netloc or "?" in val or "#" in val or "%" in val
                    or not resolved.path.startswith("/api/v1/explainer/files/")
                    or not resolved.path.endswith(".js")):
                raise ShowcaseInvalid("Vista previa inválida")
    return value


class ShowcaseService:
    def __init__(self, repository: ShowcaseRepository):
        self.repository = repository

    def sandbox_visibility(self) -> list[SandboxShowcaseState]:
        method = getattr(self.repository, "sandbox_visibility", None)
        if method is None:
            raise ShowcaseConflict("Este perfil no admite la selección de proyectos Sandbox")
        return [SandboxShowcaseState.model_validate(row) for row in method()]

    def set_sandbox_visibility(self, folder: str, project_id: str, visible: bool) -> SandboxShowcaseState:
        _id(folder)
        _id(project_id)
        if type(visible) is not bool:
            raise ShowcaseInvalid("La visibilidad debe ser un booleano")
        method = getattr(self.repository, "set_sandbox_visibility", None)
        if method is None:
            raise ShowcaseConflict("Este perfil no admite la selección de proyectos Sandbox")
        return SandboxShowcaseState.model_validate(method(folder, project_id, visible))

    def _design(self, raw: dict) -> Design:
        try:
            design = Design.model_validate(raw)
            _id(design.id)
            if any(episode.design_id != design.id for episode in design.episodes):
                raise ShowcaseInvalid("Un episodio pertenece a otro diseño")
            for episode in design.episodes:
                _id(episode.id)
                if episode.preview_url:
                    _safe_destination(episode.preview_url, design.id)
            if design.preview_url:
                _safe_destination(design.preview_url, design.id)
                design.preview_url = _preview_url(design.id)
            design.catalog_url = f"{_BASE}/{design.id}/catalog"
            return design
        except (ValidationError, ValueError, TypeError) as exc:
            raise ShowcaseInvalid("Ficha de diseño inválida") from exc

    def list_designs(self) -> DesignList:
        designs = [self._design(raw) for raw in self.repository.list_designs()]
        if len({design.id for design in designs}) != len(designs):
            raise ShowcaseConflict("Hay diseños con identidades duplicadas")
        return DesignList(designs=designs)

    def get_design(self, design_id: str) -> Design:
        _id(design_id)
        raw = self.repository.get_design(design_id)
        if raw is None:
            raise ShowcaseNotFound("Diseño no encontrado")
        design = self._design(raw)
        if design.id != design_id:
            raise ShowcaseInvalid("Identidad de diseño incoherente")
        return design

    def catalog(self, design_id: str) -> Catalog:
        design = self.get_design(design_id)
        raw = self.repository.get_catalog(design_id)
        if raw is None:
            raise ShowcaseNotFound("Catálogo no encontrado")
        try:
            catalog = Catalog.model_validate(raw)
        except ValidationError as exc:
            raise ShowcaseInvalid("Catálogo inválido") from exc
        if catalog.design_id != design_id or catalog.revision != design.revision:
            raise ShowcaseConflict("El catálogo no coincide con el diseño")
        seen = set()
        for item in catalog.entries:
            _id(item.id, entry=True)
            if item.id in seen:
                raise ShowcaseConflict("El catálogo contiene identidades duplicadas")
            seen.add(item.id)
            if item.preview_url:
                _safe_destination(item.preview_url, design_id)
                item.preview_url = _preview_url(design_id, item.id)
        return catalog

    def preview(self, design_id: str, entry_id: str | None, format: str) -> str:
        self.get_design(design_id)
        if format not in {"9x16", "16x9"}:
            raise ShowcaseInvalid("Formato de vista previa inválido")
        if entry_id is not None:
            _id(entry_id, entry=True)
            if not any(item.id == entry_id for item in self.catalog(design_id).entries):
                raise ShowcaseNotFound("Entrada no encontrada")
        target = self.repository.preview(design_id, entry_id, format)
        if target is None:
            raise ShowcaseNotFound("Vista previa no disponible")
        return _safe_destination(target, design_id)

    def entry(self, design_id: str, entry_id: str) -> Entry:
        """Read one component contract without sending the complete catalog to an agent."""
        _id(entry_id, entry=True)
        for item in self.catalog(design_id).entries:
            if item.id == entry_id:
                return item
        raise ShowcaseNotFound("Entrada no encontrada")

    def promote(self, design_id: str) -> Design:
        design = self.get_design(design_id)
        if design.state == "prueba" and not design.promotable:
            raise ShowcaseConflict(design.promote_blocker or "Este diseño no se puede promover")
        result = self._design(self.repository.promote(design_id))
        if result.id != design_id or result.state != "produccion":
            raise ShowcaseConflict("La promoción no conservó la identidad del diseño")
        return result

    def file(self, design_id: str, path: str):
        self.get_design(design_id)
        if not path or any(not p or p.startswith(".") or "%" in p or "\\" in p for p in path.split("/")):
            raise ShowcaseInvalid("Ruta de recurso inválida")
        result = self.repository.resolve_file(design_id, path)
        if result is None or not result.is_file():
            raise ShowcaseNotFound("Recurso no encontrado")
        return result
