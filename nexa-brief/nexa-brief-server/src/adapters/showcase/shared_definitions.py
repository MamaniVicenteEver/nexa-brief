"""Showcase v3: immutable repository definitions and profile-owned state."""

from __future__ import annotations

import asyncio
from pathlib import Path
from urllib.parse import parse_qsl, quote, urlencode, urlsplit, urlunsplit

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
        if ident == 'atlas-en-movimiento':
            from src.adapters.showcase.atlas_catalog import atlas_engine_catalog
            catalog = atlas_engine_catalog(self.templates, catalog)
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
        if state and isinstance(state.get("display_name"), str) and state["display_name"].strip():
            design["name"] = state["display_name"].strip()
        if state and state.get("category_path"):
            from src.core.categories import get_category
            owner = get_category(state["category_path"])
            if owner and owner.folder:
                design["category"] = owner.folder
        design["category_path"] = state.get("category_path") if state else None
        design["shared_categories"] = state.get("shared_categories", []) if state else []
        source = design.get("definition_source")
        if relations is None:
            from src.adapters.showcase.episode_relations import builtin_episode_relations

            relations = builtin_episode_relations(self, {ident})
        design["episodes"] = relations.get(ident, [])
        if design.get('production_template'):
            marker = design['production_template']
            design['episodes'] = [dict(id=marker['project_id'], title=marker.get('title') or design['name'], design_id=ident,
                preview_url=marker.get('preview_url') or design.get('preview_url')), *design['episodes']]
        if ident == "mapas-satelitales":
            # Both videos reference the same engine, not duplicate designs.
            project_adapter = self.projects
            category = self.sandbox / 'nodehistory'
            children = sorted(category.iterdir()) if category.is_dir() and not category.is_symlink() else []
            shared = {ident}
            for child in children:
                item = project_adapter._item('nodehistory', child.name, shared)
                if item is None:
                    continue
                if item['info'].get('engine') != 'nodehistory/_mapas':
                    continue
                preview = '/api/v1/explainer/files/sandbox/' + '/'.join(
                    quote(part, safe='') for part in (item['folder'], item['project_id'], 'index.html')
                )
                if (child / 'index.html').is_symlink() or not (child / 'index.html').is_file():
                    preview = None
                title = item['info'].get('title') or item['project_id']
                design['episodes'].append({'id': item['project_id'], 'title': title,
                                           'design_id': ident, 'preview_url': preview})
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
        if ident == "mapas-satelitales":
            from src.core.explainer.engine_locations import engine_root
            required = [engine_root(self.templates, "nodehistory/_mapas", design) / name
                        for name in ("mapas.js", "geo.js", "camera.js", "flags.js", "layers.js")]
            required.append(self.templates / "sandbox/_proto/proto.js")
            if not all(path.is_file() and not path.is_symlink() for path in required):
                blocker = "Faltan archivos del motor compartido de mapas"
        if ident == "atlas-cinematico":
            from src.adapters.showcase.legacy_catalogs import atlas_cache_ready

            if not atlas_cache_ready(self):
                blocker = "Faltan recursos reales de mapa para la vista previa"
        design["promotable"] = design["state"] == "prueba" and blocker is None
        design["promote_blocker"] = blocker
        if design.get('production_template') and design['state'] == 'prueba':
            from src.adapters.showcase.engine_production import RegisteredEngineProduction
            from src.config.profile_layout import layout_for_settings
            from src.config.settings import settings
            blocker = blocker or RegisteredEngineProduction(self, layout_for_settings(settings)).blocker(design, catalog)
            design['promotable'] = blocker is None
            design['promote_blocker'] = blocker
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
        if selected and selected.get("preview_kind") == "image":
            # Entradas de imagen (p. ej. capas): la miniatura es el propio archivo, no un componente del kit.
            return selected["preview_url"]
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
                shared_paths[design_id] = "/api/v1/explainer/files/bundled/nodeactualidad/cara-a-cara/"
        prefix = shared_paths.get(design_id)
        path = parsed.path
        if design_id == "atlas-en-movimiento" and prefix and path.startswith(prefix):
            path = path.replace(prefix, "/api/v1/explainer/files/bundled/nodeatlas/atlas-en-movimiento/", 1)
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

    def promote(self, design_id, category_path=None, shared_categories=None):
        ident = _id(design_id)
        contract = self._definition(ident)
        if contract and contract[0].get('production_template'):
            from src.adapters.showcase.engine_production import RegisteredEngineProduction
            from src.config.profile_layout import layout_for_settings
            from src.config.settings import settings
            try:
                asyncio.run(RegisteredEngineProduction(self, layout_for_settings(settings)).pass_to_production(
                    ident, apply=True, category_path=category_path, shared_categories=shared_categories))
            except ValueError as exc:
                raise ShowcaseConflict(str(exc)) from exc
            return self.get_design(ident)
        if contract and not contract[0].get('production_template'):
            principal = [item for item in self.projects._items()
                         if item['design_id'] == ident and item['info'].get('is_new_design') is True]
            if len(principal) > 1:
                raise ShowcaseConflict('Hay más de una demo principal para este diseño')
            if principal:
                from src.adapters.showcase.production import FilesystemDesignProduction
                from src.core.design_production import ProductionConflict, ProductionError
                item = principal[0]
                workflow = FilesystemDesignProduction(self)
                draft = workflow.inspect(item['folder'], item['project_id'])['draft']
                try:
                    asyncio.run(workflow.move(item['folder'], item['project_id'], {
                        'category': category_path or draft['category'],
                        'shared_categories': shared_categories if shared_categories is not None else draft['shared_categories'],
                    }))
                except ProductionConflict as exc:
                    raise ShowcaseConflict(str(exc)) from exc
                except ProductionError as exc:
                    raise ShowcaseInvalid(str(exc)) from exc
                return self.get_design(ident)
        if self._definition(ident) is None:
            item = next((item for item in self.projects._enabled() if item['design_id'] == ident), None)
            if item:
                from src.adapters.showcase.production import FilesystemDesignProduction
                workflow = FilesystemDesignProduction(self)
                draft = workflow.inspect(item['folder'], item['project_id'])['draft']
                from src.core.design_production import ProductionConflict, ProductionError
                try:
                    asyncio.run(workflow.move(item['folder'], item['project_id'], {
                        'category': category_path or draft['category'],
                        'shared_categories': shared_categories if shared_categories is not None else draft['shared_categories'],
                    }))
                except ProductionConflict as exc:
                    raise ShowcaseConflict(str(exc)) from exc
                except ProductionError as exc:
                    raise ShowcaseInvalid(str(exc)) from exc
                return self.get_design(ident)
        if category_path is not None:
            from src.core.categories import get_category
            categories = [category_path, *(shared_categories or [])]
            if (len(categories) != len(set(categories)) or any(
                not isinstance(path, str) or not get_category(path) or
                not get_category(path.split("/", 1)[0]) or
                get_category(path.split("/", 1)[0]).engine != "explainer_kit" or
                not get_category(path.split("/", 1)[0]).folder for path in categories
            )):
                raise ShowcaseInvalid("Categorías de diseño inválidas")

        async def change():
            async with self.store.coordination("showcase"):
                current = self.get_design(ident)
                if current is None:
                    raise ShowcaseInvalid("Diseño no encontrado")
                if current["state"] == "produccion":
                    if category_path is not None:
                        row = dict(self._states().get(ident) or {
                            "id": ident, "state": "produccion", "definition_ref": ident,
                            "revision": current["revision"],
                        })
                        row["category_path"] = category_path
                        row["shared_categories"] = shared_categories or []
                        await self.store.collection("showcase_designs").upsert(row, match=["id"])
                        return self.get_design(ident)
                    return current
                if not current.get("promotable"):
                    raise ShowcaseConflict(current.get("promote_blocker") or "Diseño bloqueado")
                row = {"id": ident, "state": "produccion", "definition_ref": ident, "revision": current["revision"]}
                if category_path is not None:
                    row["category_path"] = category_path
                    row["shared_categories"] = shared_categories or []
                await self.store.collection("showcase_designs").upsert(row, match=["id"])
                return self.get_design(ident)

        return asyncio.run(change())
