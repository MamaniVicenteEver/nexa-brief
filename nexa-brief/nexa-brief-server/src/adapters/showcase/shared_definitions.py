"""Showcase v3: immutable repository definitions and profile-owned state."""

from __future__ import annotations

import asyncio
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from src.adapters.showcase.filesystem import FilesystemShowcaseAdapter, _id, _read, _safe
from src.core.showcase.ports import ShowcaseConflict, ShowcaseInvalid


def load_shared_design_defaults(templates_root: Path) -> dict[str, dict[str, str]]:
    """Read only versioned repository contracts, independent of the active profile."""
    root = _safe(Path(templates_root), "_tools", "design-definitions")
    if not root.is_dir():
        raise ShowcaseInvalid("No se encontraron las definiciones compartidas")
    defaults = {}
    for directory in sorted(root.iterdir()):
        if directory.is_symlink():
            raise ShowcaseInvalid("Las definiciones no admiten enlaces simbólicos")
        if not directory.is_dir():
            continue
        ident = _id(directory.name)
        design = _read(_safe(root, ident, "design.json"))
        catalog = _read(_safe(root, ident, "catalog.json"))
        if (
            not isinstance(design, dict)
            or design.get("id") != ident
            or design.get("schema_version") != 1
            or design.get("state") not in ("prueba", "produccion")
            or not isinstance(design.get("revision"), str)
            or not design["revision"]
            or not isinstance(catalog, dict)
            or catalog.get("design_id") != ident
            or catalog.get("revision") != design["revision"]
        ):
            raise ShowcaseInvalid("Contrato de diseño compartido inválido")
        defaults[ident] = {"state": design["state"], "revision": design["revision"]}
    return defaults


class SharedDefinitionsShowcaseAdapter(FilesystemShowcaseAdapter):
    """Read definitions from the checkout; store only state through the data port."""

    def __init__(self, profile_root: Path, templates_root: Path, *, data_store=None, **kwargs):
        super().__init__(profile_root, templates_root, schema_version=3, **kwargs)
        self.definitions = _safe(self.templates, "_tools", "design-definitions")
        self._data_store = data_store

    @property
    def store(self):
        if self._data_store is not None:
            return self._data_store
        from src.core.data import get_data_store

        return get_data_store()

    def _definition(self, ident):
        ident = _id(ident)
        directory = _safe(self.definitions, ident)
        if not directory.is_dir():
            return None
        design = _read(_safe(directory, "design.json"))
        catalog = _read(_safe(directory, "catalog.json"))
        if (
            not isinstance(design, dict)
            or design.get("id") != ident
            or design.get("schema_version") != 1
            or design.get("state") not in ("prueba", "produccion")
            or not isinstance(catalog, dict)
            or catalog.get("design_id") != ident
            or catalog.get("revision") != design.get("revision")
            or not isinstance(catalog.get("entries"), list)
        ):
            raise ShowcaseInvalid("Contrato de diseño compartido inválido")
        return design, catalog

    def _states(self):
        rows = self.store.collection("showcase_designs").list()
        states = {}
        for row in rows:
            if not isinstance(row, dict):
                raise ShowcaseInvalid("Registro de diseño inválido")
            ident = _id(row.get("id"))
            if ident in states:
                raise ShowcaseConflict("ID de diseño duplicado")
            if (
                row.get("state") not in ("prueba", "produccion")
                or row.get("definition_ref") != ident
                or not isinstance(row.get("revision"), str)
            ):
                raise ShowcaseInvalid("Registro de diseño inválido")
            states[ident] = row
        return states

    def _design(self, ident, states=None, relations=None):
        contract = self._definition(ident)
        if contract is None:
            return None
        design, catalog = contract
        states = self._states() if states is None else states
        state = states.get(ident)
        if state and state["revision"] != design["revision"]:
            raise ShowcaseConflict("La revisión del diseño cambió; reconcilia el registro del perfil")
        design = dict(design)
        design["state"] = state["state"] if state else design["state"]
        source = design.get("definition_source")
        if relations is None:
            from src.adapters.showcase.episode_relations import builtin_episode_relations

            relations = builtin_episode_relations(self, {ident})
        design["episodes"] = relations.get(ident, [])
        if source == "builtin":
            design["builtin"] = True
        elif source == "vida":
            from src.adapters.showcase.bootstrap import legacy_vida

            existing = {episode["id"]: episode for episode in legacy_vida(self)[0]["episodes"]}
            existing.update({episode["id"]: episode for episode in design["episodes"]})
            design["episodes"] = list(existing.values())
        from src.adapters.showcase.preview_availability import availability

        entries = availability(self.templates, self.sandbox, ident, catalog["entries"])
        # A component without a preview does not block JSON-only contracts.
        available = any(e.get("preview_url") and e.get("preview_kind") == "iframe" for e in entries)
        if ident == "cara-a-cara" and entries and not entries[0].get("preview_url"):
            design["preview_url"] = None
        blocker = None if available else "Vista previa no disponible"
        if ident == "atlas-cinematico":
            from src.adapters.showcase.legacy_catalogs import atlas_cache_ready

            if not atlas_cache_ready(self):
                blocker = "Faltan recursos reales de mapa para la vista previa"
        design["promotable"] = design["state"] == "prueba" and blocker is None
        design["promote_blocker"] = blocker
        return design

    def list_designs(self):
        if not self.definitions.is_dir():
            return []
        states = self._states()
        names = sorted(p.name for p in self.definitions.iterdir() if p.is_dir() and not p.is_symlink())
        from src.adapters.showcase.episode_relations import builtin_episode_relations

        relations = builtin_episode_relations(self, set(names))
        return [self._design(name, states, relations) for name in names] + self.projects.list_designs()

    @property
    def projects(self):
        from src.adapters.showcase.sandbox_projects import SandboxProjectsAdapter

        return SandboxProjectsAdapter(self)

    def sandbox_visibility(self):
        return self.projects.states()

    def set_sandbox_visibility(self, folder, project_id, visible):
        return self.projects.set_visible(folder, project_id, visible)

    def get_design(self, design_id):
        return self._design(design_id) or self.projects.get_design(design_id)

    def get_catalog(self, design_id):
        if self._definition(design_id) is None:
            return self.projects.get_catalog(design_id)
        design = self.get_design(design_id)
        if not design:
            return None
        from src.adapters.showcase.preview_availability import availability

        catalog = dict(self._definition(design_id)[1])
        catalog["entries"] = availability(self.templates, self.sandbox, design_id, catalog["entries"])
        from src.adapters.showcase.catalog_navigation import catalog_navigation

        return catalog_navigation(self.templates, design_id, catalog)

    def preview(self, design_id, entry_id=None, format="9x16"):
        if self._definition(design_id) is None:
            return self.projects.preview(design_id, entry_id, format)
        design = self.get_design(design_id)
        if design is None:
            return None
        if format not in ("9x16", "16x9"):
            raise ShowcaseInvalid("Formato inválido")
        entries = self.get_catalog(design_id)["entries"]
        selected = next((e for e in entries if e["id"] == entry_id), None) if entry_id else None
        if entry_id and (selected is None or not selected.get("preview_url")):
            return None
        if not entry_id and not design.get("preview_url"):
            return None
        source = design.get("definition_source")
        if source in ("builtin", "vida"):
            return super().preview(design_id, entry_id, format)
        target = selected.get("preview_url") if selected else design.get("preview_url")
        if not target:
            return None
        parsed = urlsplit(target)
        shared_paths = {
            "atlas-en-movimiento": "/api/v1/explainer/files/sandbox/nodehistory/atlas-en-movimiento/",
        }
        if design_id == "cara-a-cara" and selected:
            from src.adapters.showcase.preview_availability import is_cara_guide

            if is_cara_guide(self.templates, selected["name"]):
                shared_paths[design_id] = "/api/v1/explainer/files/sandbox/nodeaction/cara-a-cara/"
        prefix = shared_paths.get(design_id)
        path = parsed.path
        if prefix and path.startswith(prefix):
            path = path.replace("/api/v1/explainer/files/sandbox/", "/api/v1/explainer/files/bundled/sandbox/", 1)
        params = [
            (key, format if key in ("aspect", "format") else value)
            for key, value in parse_qsl(parsed.query, keep_blank_values=True)
        ]
        return urlunsplit((parsed.scheme, parsed.netloc, path, urlencode(params), parsed.fragment))

    def resolve_file(self, design_id, path):
        # Shared contracts do not give access to arbitrary repository files.
        return None

    def promote(self, design_id):
        ident = _id(design_id)

        async def change():
            async with self.store.coordination("showcase"):
                current = self.get_design(ident)
                if current is None:
                    raise ShowcaseInvalid("Diseño no encontrado")
                if current["state"] == "produccion":
                    return current
                if not current.get("promotable"):
                    raise ShowcaseConflict(current.get("promote_blocker") or "Diseño bloqueado")
                await self.store.collection("showcase_designs").upsert(
                    {"id": ident, "state": "produccion", "definition_ref": ident, "revision": current["revision"]},
                    match=["id"],
                )
                return self.get_design(ident)

        return asyncio.run(change())
