"""Filesystem and host tools for reviewed principal design demos."""
from __future__ import annotations

import asyncio
import hashlib
import json
import os
import posixpath
import re
import shutil
import signal
import sys
import uuid
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

from src.adapters.showcase.filesystem import _safe, _write
from src.adapters.data.file_locks import AsyncFileLock
from src.config.content_paths import sandbox_root
from src.config.profile_layout import layout_for_settings
from src.config.settings import settings
from src.core.data import collection, coordination
from src.core.design_production import ProductionConflict, ProductionError
from src.core.explainer.production_templates import ID, definitions
from src.core.task_ownership import start_owned_task, task_is_owned

PREFIX = "/api/v1/explainer/files/"
FIELDS = ("youtube_title", "youtube_description", "instagram_title", "instagram_description",
          "facebook_title", "facebook_description", "tiktok_caption")


def design_id(folder, project):
    return "sandbox-" + hashlib.sha256(f"{folder}/{project}".encode()).hexdigest()[:24]


def fingerprint(directory: Path):
    digest = hashlib.sha256()
    for path in sorted(directory.rglob("*")):
        relative = path.relative_to(directory)
        if any(p in {"work", "render", "thumbnails", "__pycache__"} for p in relative.parts):
            continue
        if path.is_symlink():
            raise ProductionError("El diseño contiene enlaces simbólicos")
        if not path.is_file() or relative.as_posix() in {"publish.json"}:
            continue
        digest.update(str(relative).encode())
        digest.update(path.read_bytes())
    return digest.hexdigest()


def rewrite_references(text, old_folder, project, new_folder, namespace="bundled", relative_file="index.html"):
    old = f"sandbox/{old_folder}/{project}"
    new = f"{namespace}/{new_folder}/{project}"
    text = text.replace(PREFIX + old + "/", PREFIX + new + "/")

    def replace(match):
        quote, value = match.group(1), match.group(2)
        if any(c.isspace() for c in value):
            return match.group(0)
        parsed = urlsplit(value)
        path = posixpath.normpath(posixpath.join(old, posixpath.dirname(relative_file), parsed.path))
        if path.startswith(old + "/"):
            return match.group(0)
        if not path.startswith(("sandbox/", "_tools/")):
            # Component demo media resolve from assets/, one level below the
            # wrapper. Canonicalise only explicit shared engine references.
            shared = re.fullmatch(r"(?:\.\./)+([a-z][a-z0-9_-]+/_(?:atlas|mapas|vida|tactico|pizarra|avatar|player|engine)/.+)", parsed.path)
            candidate = posixpath.normpath("sandbox/" + shared[1]) if shared else ""
            engine = "/".join(shared[1].split("/")[:2]) if shared else ""
            if not shared or not candidate.startswith("sandbox/" + engine + "/"):
                raise ProductionError("Una referencia relativa sale de los motores compartidos")
            path = candidate
        target = urlunsplit(("", "", PREFIX + path, parsed.query, parsed.fragment))
        return quote + target + quote

    return re.sub(r"([\"'])(\.\./[^\"'\n]+)\1", replace, text)


def refresh_thumbnail_signatures(video, verified=None):
    """Reconcile stamps after a route-only move without recapturing images."""
    from src.core.explainer import thumbnails
    for option, spec in thumbnails.intro_specs(video).items():
        signature = thumbnails._capture_digest(video, spec)
        for orientation in ('16x9', '9x16'):
            image = thumbnails.thumbnail_file(video, option, orientation)
            stamp = image.with_suffix('.sha256')
            if image.is_file() and stamp.is_file() and (verified is None or (option, orientation) in verified):
                stamp.write_text(signature, encoding='utf-8')


class FilesystemDesignProduction:
    def __init__(self, showcase=None, capture=None):
        if showcase is None:
            from src.adapters.showcase.filesystem import FilesystemShowcaseAdapter
            showcase = FilesystemShowcaseAdapter.from_settings()
        self.showcase = showcase
        self.capture = capture
        self.layout = layout_for_settings(settings)

    def _source(self, folder, project):
        if not all(isinstance(p, str) and ID.fullmatch(p) for p in (folder, project)):
            raise ProductionError("Identificador inválido")
        source = _safe(sandbox_root(), folder, project)
        if source.is_dir():
            return source, False
        ident = design_id(folder, project)
        from src.config.content_paths import production_root
        from src.core.content_registry import get_video
        registered = get_video(project)
        key = ((registered or {}).get('details') or {}).get('folder_key', '')
        parts = key.split('/')
        if len(parts) == 3 and parts[0] == 'productions' and parts[2] == project:
            directory = _safe(production_root(), parts[1], project)
            marker = directory / 'work/production/origin.json'
            if marker.is_file() and json.loads(marker.read_text()).get('origin') == f'{folder}/{project}':
                return directory, True
        for design, directory in definitions(settings.templates_dir):
            if design["id"] == ident:
                return directory, True
        raise FileNotFoundError("Diseño no encontrado")

    @staticmethod
    def _record_path(source):
        return _safe(source, "work", "production", "preparation.json")

    def _record(self, source):
        path = self._record_path(source)
        try:
            value = json.loads(path.read_text())
            return value if isinstance(value, dict) else {}
        except FileNotFoundError:
            return {}

    def _styles(self, info):
        from types import SimpleNamespace
        from src.adapters.showcase.styles import list_styles
        # Read the public style declaration without resolving the design again:
        # project discovery itself calls inspect(). Hidden drafts work as well.
        raw = {'id': 'preparation', 'visual_styles': info.get('visual_styles') or {}, 'episodes': []}
        source = SimpleNamespace(templates=settings.templates_dir, get_design=lambda _: raw)
        return list_styles(source, 'preparation')

    def inspect(self, folder, project):
        source, moved = self._source(folder, project)
        info = json.loads(_safe(source, "info.json").read_text()) if (source / "info.json").is_file() else {}
        record = self._record(source)
        draft = record.get("draft", {})
        from src.core.categories import explainer_folders
        default_category = explainer_folders().get(folder, "")
        if not draft:
            draft = {"title": info.get("title") or project,
                     "description": info.get("summary") or "Ficha técnica pendiente de completar",
                     "publication": {}, "demo": info.get('is_new_design') is True,
                     "category": default_category, "shared_categories": []}
        styles = self._styles(info)
        draft = {**draft, 'poster_styles': draft.get('poster_styles') or
                 ([styles['default']] if styles.get('default') else [])}
        issues = self._issues(source, info, draft)
        state = record.get("state", "draft")
        if state in {'queued', 'validating'} and not task_is_owned('design-validation', design_id(folder, project)):
            state = 'failed'
            record['error'] = 'Validación interrumpida; vuelve a validar para continuar'
        if state == "ready" and record.get("fingerprint") != fingerprint(source):
            state = "draft"
            issues.append("Los archivos cambiaron después de validar; vuelve a validar")
        from src.adapters.showcase.technical_review import selection_signature
        if state == 'ready' and (record.get('validation_version') != 2 or
                record.get('selection_signature') != selection_signature(draft)):
            state = 'draft'
            issues.append('Verifica la selección y las rutas con el flujo técnico actualizado')
        if moved:
            state = "production"
        from src.core.categories import get_category
        category_node = get_category(draft.get('category', '').split('/', 1)[0])
        return {"folder": folder, "project_id": project, "design_id": design_id(folder, project),
                "state": state, "draft": draft, "issues": issues,
                "warnings": [n for n in info.get("notes", []) if isinstance(n, str) and
                             any(v in n.lower() for v in ("no verificado", "pendiente", "licencia"))],
                "error": record.get("error"), "can_pass": state == "ready" and not issues,
                "component_count": record.get("component_count", 0),
                "report": record.get("report"), "validation_version": 2,
                "styles": [{"id": row["id"], "name": row["name"]} for row in styles["styles"]],
                "destination": f"{'bundled' if info.get('is_new_design') else 'productions'}/{category_node.folder if category_node else folder}/{project}"}

    @staticmethod
    def _categories(draft):
        from src.core.categories import get_category
        values = [draft.get("category"), *draft.get("shared_categories", [])]
        if len(values) != len(set(values)):
            raise ProductionError("La categoría principal y las referencias deben ser diferentes")
        for value in values:
            if not isinstance(value, str) or not get_category(value):
                raise ProductionError("Selecciona categorías existentes")
            root = get_category(value.split("/", 1)[0])
            if root.engine != "explainer_kit" or not root.folder:
                raise ProductionError("Esta categoría no admite diseños de video")
        return get_category(values[0].split("/", 1)[0]).folder

    def _issues(self, source, info, draft):
        issues = []
        if info.get("is_new_design") is not True and not (source / "manifest.json").is_file():
            issues.append("Declara una demo principal o un episodio con manifest antes de verificar")
        try:
            self._categories(draft)
        except ProductionError as exc:
            issues.append(str(exc))
        if not draft.get("title", "").strip() or not draft.get("description", "").strip():
            issues.append("Completa el título y la descripción")
        available = {row['id'] for row in self._styles(info)['styles']}
        selected = draft.get('poster_styles') or []
        if any(style not in available for style in selected) or len(selected) != len(set(selected)):
            issues.append('Selecciona estilos existentes sin repetirlos')
        if not (source / 'index.html').is_file():
            issues.append('Falta index.html')
        if info.get('is_new_design') is True and not isinstance(info.get('catalog'), dict):
            issues.append('Falta el catálogo de componentes aislados del diseño principal')
        return issues

    async def save(self, folder, project, draft):
        async with coordination("showcase"):
            source, moved = self._source(folder, project)
            if moved:
                raise ProductionConflict("El diseño ya está en producción; edita su ficha")
            current = self._record(source)
            if current.get("state") in {"queued", "validating"} and task_is_owned('design-validation', design_id(folder, project)):
                raise ProductionConflict("Espera a que termine la validación")
            self._categories(draft)
            styles = self._styles(json.loads((source / 'info.json').read_text()))
            draft = {**draft, 'poster_styles': draft.get('poster_styles') or
                     ([styles['default']] if styles.get('default') else [])}
            if any(value not in {row['id'] for row in styles['styles']} for value in draft['poster_styles']):
                raise ProductionError('Selecciona estilos existentes')
            _write(self._record_path(source), {"state": "draft", "draft": draft})
        return self.inspect(folder, project)

    async def reset(self, folder, project):
        async with coordination("showcase"):
            source, moved = self._source(folder, project)
            if moved or (self._record(source).get("state") in {"queued", "validating"} and task_is_owned('design-validation', design_id(folder, project))):
                raise ProductionConflict("No se puede descartar este borrador ahora")
            self._record_path(source).unlink(missing_ok=True)
        return self.inspect(folder, project)

    async def validate(self, folder, project):
        async with coordination("showcase"):
            source, moved = self._source(folder, project)
            record = self._record(source)
            if moved or (record.get("state") in {"queued", "validating"} and task_is_owned('design-validation', design_id(folder, project))):
                return self.inspect(folder, project)
            status = self.inspect(folder, project)
            if status["issues"]:
                raise ProductionError("; ".join(status["issues"]))
            record.update(state="queued", draft=status["draft"], error=None)
            _write(self._record_path(source), record)
            start_owned_task("design-validation", design_id(folder, project), lambda: self._validate(folder, project))
        return self.inspect(folder, project)

    async def _validate(self, folder, project):
        from src.adapters.showcase.technical_review import review_files, selection_signature
        source, _ = self._source(folder, project)
        record = self._record(source)
        record.update(state='validating', error=None)
        _write(self._record_path(source), record)
        try:
            original = fingerprint(source)
            draft = record['draft']
            info = json.loads((source / 'info.json').read_text()) if (source / 'info.json').is_file() else {}
            from src.config.content_paths import production_root
            target = (settings.templates_dir if info.get('is_new_design') else production_root()) / self._categories(draft) / project
            report = await asyncio.to_thread(review_files, source, folder, project, target, rewrite_references)
            item = self.showcase.projects._item(folder, project, set())
            catalog, _ = self.showcase.projects._catalog(item)
            if info.get('is_new_design') and (not catalog['entries'] or any(not e.get('summary') or not e.get('label') or
                    (e.get('preview_kind') == 'iframe' and not e.get('preview_url')) for e in catalog['entries'])):
                report['issues'].append('Cada componente necesita nombre, descripción y vista previa aislada')
            # Inventory only: missing posters never start a browser or an agent.
            from src.adapters.showcase.posters import poster_path
            cache = self.layout.cache_dir
            inventory = []
            for entry in catalog['entries']:
                url = entry.get('preview_url') or ''
                for style in draft.get('poster_styles', []) or ['']:
                    from src.adapters.showcase.posters import with_style
                    image = poster_path(cache, design_id(folder, project), '', entry['id'], '16x9',
                        with_style(url, style), engine=info.get('engine'))
                    inventory.append({'entry': entry['id'], 'style': style, 'exists': image.is_file()})
            report['posters'] = inventory
            report['warnings'].append('Revisión visual manual pendiente; esta comprobación no genera imágenes')
            if fingerprint(source) != original:
                raise ProductionConflict('Los archivos cambiaron durante la revisión')
            if not info.get('is_new_design'):
                from src.core.explainer.promote import plan_promotion, PromoteError
                try:
                    plan_promotion(source, force=True, category=draft['category'], shared_categories=draft['shared_categories'])
                except PromoteError as exc:
                    report['issues'].append(str(exc))
            record.update(state='failed' if report['issues'] else 'ready', fingerprint=original,
                selection_signature=selection_signature(draft), validation_version=2,
                component_count=len(catalog['entries']), report=report,
                error='; '.join(report['issues'])[:1500] if report['issues'] else None)
        except Exception as exc:
            record.update(state='failed', error=str(exc)[-1500:])
        _write(self._record_path(source), record)

    async def move(self, folder, project, selection):
        async with coordination("showcase"), AsyncFileLock(settings.templates_dir / '.pass-to-production.lock'):
            source, moved = self._source(folder, project)
            if moved:
                return self.inspect(folder, project)
            current = self.inspect(folder, project)
            if not current["can_pass"]:
                raise ProductionConflict("Valida la preparación completa antes de pasar a producción")
            if any(selection.get(k) != current["draft"].get(k) for k in ("category", "shared_categories")):
                raise ProductionConflict("La categoría cambió; vuelve a verificar las rutas")
            draft = {**current["draft"], **selection}
            new_folder = self._categories(draft)
            info_path = source / 'info.json'
            info = json.loads(info_path.read_text()) if info_path.is_file() else {}
            if not info.get('is_new_design'):
                return await self._move_episode(source, folder, project, draft)
            target = _safe(settings.templates_dir, new_folder, project)
            ident = design_id(folder, project)
            definition = _safe(settings.templates_dir, "_tools", "design-definitions", ident)
            if target.exists() or definition.exists():
                raise ProductionConflict("El destino ya existe; no se sobrescribe")
            if source.stat().st_dev != settings.templates_dir.stat().st_dev:
                raise ProductionConflict("El traslado entre discos requiere una migración supervisada")
            info = json.loads((source / "info.json").read_text())
            native = self.showcase.projects._item(folder, project, set())
            catalog, gallery = self.showcase.projects._catalog(native)
            from src.adapters.showcase.legacy_catalogs import legacy_entry_preview
            for entry in catalog['entries']:
                if entry.get('preview_kind') == 'iframe':
                    entry['preview_url'] = legacy_entry_preview(entry, gallery, '9x16')
            design = self.showcase.projects._design(native)
            verified_thumbnails = set()
            # Reconcile only captures whose old signatures are already valid.
            # Malformed/incomplete publication never blocks a technical move.
            try:
                from src.core.explainer.catalog import ExplainerVideo
                from src.core.explainer import thumbnails
                before_video = ExplainerVideo(project, source, ident, draft['category'], draft['title'], 'en preparación', None)
                for option, spec in thumbnails.intro_specs(before_video).items():
                    digest = thumbnails._capture_digest(before_video, spec)
                    for orientation in ('16x9','9x16'):
                        image = thumbnails.thumbnail_file(before_video, option, orientation)
                        stamp = image.with_suffix('.sha256')
                        if image.is_file() and stamp.is_file() and stamp.read_text().strip() == digest:
                            verified_thumbnails.add((option, orientation))
            except (ValueError, OSError):
                pass
            originals = {}
            # Validate every path before any mutation. Historical work stays
            # private and is moved as part of the explicitly authorised demo.
            for path in source.rglob("*"):
                if path.is_symlink():
                    raise ProductionError("No se trasladan enlaces simbólicos")
                if path.name.startswith(("client_secret", "credentials")) or path.name in {".env", "accounts.json", "users.json"} or path.suffix.lower() in {'.pem','.key','.p12','.pfx'}:
                    raise ProductionError("El proyecto contiene archivos privados")
                if path.is_file() and "work" not in path.relative_to(source).parts and path.suffix in {".html", ".js", ".mjs", ".css", ".json"}:
                    value = path.read_text()
                    rewritten = rewrite_references(value, folder, project, new_folder, relative_file=path.relative_to(source).as_posix())
                    if value != rewritten:
                        originals[str(path.relative_to(source))] = value
            # The validated thumbnails stay byte-for-byte identical; their
            # stamps include media URLs, so preserve them for rollback and
            # refresh only their signatures after the route changes.
            for stamp in (source / 'assets/thumbnails').glob('thumbnail-*.sha256'):
                if stamp.is_file() and not stamp.is_symlink():
                    originals[str(stamp.relative_to(source))] = stamp.read_text()
            from src.core.category_creation import _config_lock, _write_config_atomically
            from src.core.categories import reload_categories
            config_path = settings.niches_path
            old_config = json.loads(config_path.read_text())
            manifest = json.loads((source / "manifest.json").read_text()) if (source / "manifest.json").exists() else {}
            protected = {name: (source / name).read_text() if (source / name).exists() else None
                         for name in ("manifest.json", "info.json", "production-template.json")}
            record = self._record(source)
            record_before = json.loads(json.dumps(record))
            from src.core.content_registry import get_video
            old_video = get_video(project)
            old_showcase = collection('showcase_designs').get(ident)
            journal_path = self.layout.runtime_dir / 'design-production' / (ident + '.json')
            transaction = uuid.uuid4().hex
            journal = {'state': 'moving', 'transaction': transaction, 'folder': folder, 'project': project,
                'target_folder': new_folder, 'originals': originals, 'protected': protected,
                'record': record, 'old_showcase': old_showcase, 'old_video': old_video,
                'old_categories': old_config.get('categories', {})}
            _write(_safe(source, 'work', 'production', 'transaction.json'), {'id': transaction})
            _write(journal_path, journal)
            moved_here = False
            definition_created = False
            try:
                target.parent.mkdir(parents=True, exist_ok=True)
                os.rename(source, target)
                moved_here = True
                for relative in originals:
                    path = target / relative
                    path.write_text(rewrite_references(originals[relative], folder, project, new_folder, relative_file=relative))
                scene_path = target / "assets/scene.json"
                scene = json.loads(scene_path.read_text()) if scene_path.is_file() else {}
                manifest.update(video_id=project, title=draft["title"], design=ident, category=draft["category"],
                    shared_categories=draft["shared_categories"], status="en preparación", demo=True, editorial_status="pending",
                    engine=info.get("engine"), duration_seconds=scene.get("duration"),
                    demo_summary=draft["description"], review_requirements=current["warnings"])
                _write(target / "manifest.json", manifest)
                info.update(title=draft["title"], summary=draft["description"], design=ident, status="en preparación")
                _write(target / "info.json", info)
                _write(target / "production-template.json", {"design_id": ident, "demo": True,
                    "origin": f"sandbox/{folder}/{project}"})
                old_prefix = PREFIX + f"sandbox/{folder}/{project}/"
                new_prefix = PREFIX + f"bundled/{new_folder}/{project}/"
                catalog = json.loads(rewrite_references(json.dumps(catalog), folder, project, new_folder))
                revision = hashlib.sha256(json.dumps(catalog, sort_keys=True).encode()).hexdigest()
                catalog["revision"] = revision
                design.update(name=draft["title"], description=draft["description"], state="produccion", family="native",
                    category=new_folder, category_path=draft["category"], shared_categories=draft["shared_categories"],
                    schema_version=1, revision=revision, definition_source="production-template",
                    editorial_strategies=info.get("editorial_strategies", {}),
                    preview_url=new_prefix + "index.html", episodes=[],
                    production_template={"folder": f"{new_folder}/{project}", "demo": True,
                                         "origin_folder": folder, "project_id": project})
                definition.mkdir(parents=True)
                definition_created = True
                _write(definition / '.production-transaction.json', {'id': transaction})
                _write(definition / "catalog.json", catalog)
                _write(definition / "design.json", design)
                if verified_thumbnails:
                    try:
                        from src.core.explainer.catalog import load_video
                        refresh_thumbnail_signatures(load_video(target), verified_thumbnails)
                    except (ValueError, OSError):
                        pass  # Existing bytes are retained; preparation reports stale captures.
                with _config_lock(config_path):
                    config = json.loads(config_path.read_text())
                    for category_id, node in config["categories"].items():
                        node["designs"] = [v for v in node.get("designs", []) if v != ident]
                        node["shared_designs"] = [v for v in node.get("shared_designs", []) if v != ident]
                        if category_id == draft["category"]:
                            node["designs"].append(ident)
                            node["status"] = "active"
                        elif category_id in draft["shared_categories"]:
                            node["shared_designs"].append(ident)
                    _write_config_atomically(config_path, config)
                    reload_categories()
                await collection("showcase_designs").upsert({"id": ident, "definition_ref": ident,
                    "revision": revision, "state": "produccion", "category_path": draft["category"],
                    "shared_categories": draft["shared_categories"]}, match=["id"])
                # Register the canonical location for the existing recorder CLI.
                from src.core.content_registry import upsert_video
                await upsert_video(project, (old_video or {}).get('production_id', project),
                    details={**((old_video or {}).get('details') or {}), "title": draft["title"],
                             "folder_key": f"bundled/{new_folder}/{project}"})
                record.update(state="production", draft=draft)
                _write(self._record_path(target), record)
                _write(journal_path, {'state': 'complete', 'folder': folder, 'project': project,
                                     'destination': f'{new_folder}/{project}', 'design_id': ident})
            except BaseException:
                if moved_here and target.exists():
                    for relative, value in originals.items():
                        (target / relative).write_text(value)
                    for name, value in protected.items():
                        if value is None:
                            (target / name).unlink(missing_ok=True)
                        else:
                            (target / name).write_text(value)
                    os.rename(target, source)
                    record_before['fingerprint'] = fingerprint(source)
                    _write(self._record_path(source), record_before)
                if definition_created and definition.exists():
                    shutil.rmtree(definition)
                with _config_lock(config_path):
                    latest = json.loads(config_path.read_text())
                    for key, node in latest['categories'].items():
                        for field in ('designs', 'shared_designs'):
                            node[field] = [value for value in node.get(field, []) if value != ident]
                            if ident in old_config.get('categories', {}).get(key, {}).get(field, []):
                                node[field].append(ident)
                    _write_config_atomically(config_path, latest)
                reload_categories()
                if old_showcase:
                    await collection('showcase_designs').upsert(old_showcase, match=['id'])
                else:
                    await collection('showcase_designs').delete(ident)
                if old_video:
                    from src.core.content_registry import upsert_video
                    await upsert_video(project, old_video['production_id'], details=old_video.get('details', {}))
                else:
                    await collection('content_videos').delete(project)
                _write(journal_path, {'state': 'rolled_back', 'folder': folder, 'project': project})
                raise
        return self.inspect(folder, project)

    async def _move_episode(self, source, folder, project, draft):
        from src.core.explainer.promote import plan_promotion
        from src.core.content_registry import upsert_video, get_video
        from src.config.content_paths import production_root
        plan = plan_promotion(source, force=True, category=draft['category'], shared_categories=draft['shared_categories'])
        target = plan.destination
        target.parent.mkdir(parents=True, exist_ok=True)
        if source.stat().st_dev != target.parent.stat().st_dev:
            raise ProductionConflict('El traslado entre discos requiere migración supervisada')
        originals = {}
        for path in source.rglob('*'):
            if path.is_file() and 'work' not in path.relative_to(source).parts and path.suffix in {'.html','.js','.mjs','.css','.json'}:
                value = path.read_text()
                rewritten = rewrite_references(value, folder, project, target.parent.name, 'productions', path.relative_to(source).as_posix())
                if rewritten != value:
                    originals[str(path.relative_to(source))] = value
        protected = {name:(source/name).read_text() if (source/name).is_file() else None
                     for name in ('manifest.json','info.json')}
        record = self._record(source)
        old_video = get_video(project)
        transaction = uuid.uuid4().hex
        journal_path = self.layout.runtime_dir/'design-production'/(design_id(folder,project)+'.json')
        journal = {'state':'moving','namespace':'productions','transaction':transaction,'folder':folder,'project':project,
            'target_folder':target.parent.name,'originals':originals,'protected':protected,'record':record,
            'old_showcase':collection('showcase_designs').get(design_id(folder,project)), 'old_video':old_video,
            'old_categories':json.loads(settings.niches_path.read_text()).get('categories',{})}
        _write(source/'work/production/transaction.json', {'id':transaction})
        _write(journal_path,journal)
        os.rename(source, target)
        try:
            for relative, text in originals.items():
                (target/relative).write_text(rewrite_references(text,folder,project,target.parent.name,'productions',relative))
            manifest=json.loads((target/'manifest.json').read_text())
            manifest.update(category=draft['category'], shared_categories=draft['shared_categories'],
                            status='en preparación',editorial_status='pending')
            _write(target/'manifest.json',manifest)
            _write(target/'work/production/origin.json',{'origin':f'{folder}/{project}'})
            _write(self._record_path(target),{**record,'state':'production','draft':draft})
            await upsert_video(project,(old_video or {}).get('production_id',project),
                details={**((old_video or {}).get('details') or {}),'title':draft['title'],
                         'folder_key':f'productions/{target.parent.name}/{project}'})
            _write(journal_path, {'state':'complete','namespace':'productions','folder':folder,'project':project})
        except BaseException:
            for relative,value in originals.items():(target/relative).write_text(value)
            for relative,value in protected.items():
                if value is None:(target/relative).unlink(missing_ok=True)
                else:(target/relative).write_text(value)
            os.rename(target,source)
            _write(self._record_path(source),record)
            if old_video:
                await upsert_video(project,old_video['production_id'],details=old_video.get('details',{}))
            else:await collection('content_videos').delete(project)
            _write(journal_path,{'state':'rolled_back','folder':folder,'project':project})
            raise
        return self.inspect(folder,project)

    async def recover(self):
        """Restore an interrupted move on API startup, before serving requests."""
        root = self.layout.runtime_dir / 'design-production'
        if not root.is_dir():
            return
        async with coordination('showcase'), AsyncFileLock(settings.templates_dir / '.pass-to-production.lock'):
            for path in root.glob('*.json'):
                journal = json.loads(path.read_text())
                if journal.get('state') != 'moving':
                    continue
                folder, project, destination = (journal[k] for k in ('folder','project','target_folder'))
                if not all(isinstance(value, str) and ID.fullmatch(value) for value in (folder, project, destination)):
                    raise ProductionError('Diario de traslado inválido')
                source = _safe(sandbox_root(), folder, project)
                from src.config.content_paths import production_root
                base = production_root() if journal.get('namespace') == 'productions' else settings.templates_dir
                target = _safe(base, destination, project)
                ident = design_id(folder, project)
                marker = target / 'work/production/transaction.json'
                if not source.exists() and target.is_dir() and marker.is_file() and json.loads(marker.read_text()).get('id') == journal['transaction']:
                    for relative, value in journal['originals'].items():
                        _safe(target, *relative.split('/')).write_text(value)
                    for relative, value in journal['protected'].items():
                        file = _safe(target, relative)
                        if value is None:
                            file.unlink(missing_ok=True)
                        else:
                            file.write_text(value)
                    os.rename(target, source)
                    journal['record']['fingerprint'] = fingerprint(source)
                    _write(self._record_path(source), journal['record'])
                definition = _safe(settings.templates_dir, '_tools', 'design-definitions', ident)
                ownership = definition / '.production-transaction.json'
                if ownership.is_file() and json.loads(ownership.read_text()).get('id') == journal['transaction']:
                    shutil.rmtree(definition)
                from src.core.category_creation import _config_lock, _write_config_atomically
                from src.core.categories import reload_categories
                with _config_lock(settings.niches_path):
                    config = json.loads(settings.niches_path.read_text())
                    for key, node in config['categories'].items():
                        for field in ('designs','shared_designs'):
                            node[field] = [value for value in node.get(field, []) if value != ident]
                            if ident in journal['old_categories'].get(key, {}).get(field, []):
                                node[field].append(ident)
                    _write_config_atomically(settings.niches_path, config)
                reload_categories()
                if journal.get('old_showcase'):
                    await collection('showcase_designs').upsert(journal['old_showcase'], match=['id'])
                else:
                    await collection('showcase_designs').delete(ident)
                if journal.get('old_video'):
                    from src.core.content_registry import upsert_video
                    previous = journal['old_video']
                    await upsert_video(project, previous['production_id'], details=previous.get('details', {}))
                else:
                    await collection('content_videos').delete(project)
                _write(path, {'state':'recovered', 'folder':folder,'project':project})
