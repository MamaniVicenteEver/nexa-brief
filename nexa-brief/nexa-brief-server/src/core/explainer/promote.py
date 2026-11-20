"""Promoción de videos explainer-kit desde el sandbox a producción."""

from __future__ import annotations

import fcntl
import json
import os
import re
from dataclasses import dataclass
from pathlib import Path

from src.core.explainer.catalog import READY_STATUSES, TEMPLATES_DIR
from src.core.categories import explainer_folders, get_category
from src.config.content_paths import production_root, sandbox_root
from src.config.profile_layout import layout_for_settings
from src.config.settings import settings

MESSAGE_NOT_FOUND = "No existe {path}"
MESSAGE_NOT_SANDBOX = "{id} ya está en producción"
MESSAGE_UNSUPPORTED = "Solo se pueden pasar videos del explainer-kit"
MESSAGE_NOT_READY = "Estado «{status}»: faltan pasos (kit.py status {id})"
MESSAGE_DESTINATION_EXISTS = "Ya existe {folder}/{id} en producción"

_KIT_PATH_RE = re.compile(r"(?:\.\.?/)+_tools/explainer-kit/")


class PromoteError(Exception):
    """Error legible de validación al promover un video."""

    def __init__(self, code: str, message: str) -> None:
        self.code = code
        self.message = message
        super().__init__(message)


@dataclass(frozen=True)
class PromotePlan:
    """Rutas de origen y destino para promover un video."""

    source: Path
    destination: Path


def _display_path(path: Path, templates_dir: Path) -> str:
    """Devuelve una ruta relativa a templates cuando es posible."""
    try:
        return path.resolve().relative_to(templates_dir.resolve()).as_posix()
    except ValueError:
        return str(path)


def plan_promotion(
    item_dir: Path,
    *,
    force: bool = False,
    templates_dir: Path | None = None,
    category: str | None = None,
    shared_categories: list[str] | None = None,
) -> PromotePlan:
    """Valida una promoción sin modificar archivos."""
    item_path = Path(item_dir)
    templates_root = Path(templates_dir or TEMPLATES_DIR).resolve()
    use_profile = templates_dir is None and layout_for_settings(settings).schema_version >= 2
    if not item_path.is_dir():
        raise PromoteError(
            "not_found",
            MESSAGE_NOT_FOUND.format(path=_display_path(item_path, templates_root)),
        )

    if item_path.is_symlink():
        raise PromoteError("unsupported", "El proyecto no puede ser un enlace simbólico")
    source = item_path.resolve()
    source_root = sandbox_root().resolve() if use_profile else (templates_root / "sandbox").resolve()
    try:
        relative_source = source.relative_to(source_root)
    except ValueError as exc:
        raise PromoteError("not_sandbox", MESSAGE_NOT_SANDBOX.format(id=source.name)) from exc

    if len(relative_source.parts) != 2:
        raise PromoteError("not_sandbox", MESSAGE_NOT_SANDBOX.format(id=source.name))

    manifest_path = source / "manifest.json"
    if any((source / name).is_symlink() for name in ("manifest.json", "index.html", "info.json")):
        raise PromoteError("unsupported", "Los archivos principales no pueden ser enlaces simbólicos")
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        manifest = None
    is_maps = False
    if not isinstance(manifest, dict):
        try:
            info = json.loads((source / "info.json").read_text(encoding="utf-8"))
            html = (source / "index.html").read_text(encoding="utf-8")
        except (OSError, ValueError):
            raise PromoteError("unsupported", MESSAGE_UNSUPPORTED)
        is_maps = isinstance(info, dict) and info.get("engine") == "nodehistory/_mapas"
        if not is_maps or "../_mapas/mapas.js" not in html or "../../_proto/proto.js" not in html:
            raise PromoteError("unsupported", MESSAGE_UNSUPPORTED)
        if info.get("status") != "lista para revisar" and not force:
            raise PromoteError("not_ready", "El proyecto de mapas aún no está listo para revisión")
        manifest = {"status": "en progreso", "title": info.get("title") or source.name,
                    "design": "mapas-satelitales", "engine": "nodehistory/_mapas"}

    folder, video_id = relative_source.parts
    category_id = category or manifest.get("category") or ("node_history" if is_maps else None)
    if category_id:
        selected = get_category(str(category_id))
        category_node = get_category(str(category_id).split("/", 1)[0])
        if selected is None or category_node is None or category_node.engine != "explainer_kit" or not category_node.folder:
            raise PromoteError("invalid_category", f"Categoría de producción inválida: {category_id}")
        folder = category_node.folder
    for shared in shared_categories or []:
        root = get_category(shared.split("/", 1)[0]) if isinstance(shared, str) else None
        if not isinstance(shared, str) or get_category(shared) is None or not root or root.engine != "explainer_kit" or not root.folder or shared == category_id:
            raise PromoteError("invalid_category", f"Categoría compartida inválida: {shared}")
    if len(set(shared_categories or [])) != len(shared_categories or []):
        raise PromoteError("invalid_category", "Categorías compartidas duplicadas")
    destination = (production_root() if use_profile else templates_root) / folder / video_id
    destination_base = (production_root() if use_profile else templates_root).resolve()
    if not destination.resolve().is_relative_to(destination_base):
        raise PromoteError("invalid_destination", "La carpeta de destino sale de producción")
    status = manifest.get("status")
    if not is_maps and status not in READY_STATUSES and not force:
        raise PromoteError(
            "not_ready",
            MESSAGE_NOT_READY.format(status=status, id=video_id),
        )
    if destination.exists():
        raise PromoteError(
            "destination_exists",
            MESSAGE_DESTINATION_EXISTS.format(folder=folder, id=video_id),
        )

    if any((destination_base / candidate / video_id).exists() for candidate in explainer_folders()):
        raise PromoteError("destination_exists", f"Ya existe un video con ID {video_id} en producción")
    return PromotePlan(source=source, destination=destination)


def promotion_blocker(item_dir: Path, *, templates_dir: Path | None = None) -> str | None:
    """Devuelve el motivo que impide promover, si existe."""
    try:
        plan_promotion(item_dir, templates_dir=templates_dir)
    except PromoteError as exc:
        return exc.message
    return None


def _rewrite_kit_paths(html: str, destination: Path, *, external: bool = False) -> str:
    """Ajusta las rutas relativas al kit para la ubicación de producción."""
    if external:
        return _KIT_PATH_RE.sub("/_tools/explainer-kit/", html)
    templates_root = destination.parent.parent
    kit_dir = templates_root / "_tools" / "explainer-kit"
    kit_path = Path(os.path.relpath(kit_dir, destination)).as_posix()
    return _KIT_PATH_RE.sub(f"{kit_path}/", html)


def promote(
    item_dir: Path,
    *,
    force: bool = False,
    templates_dir: Path | None = None,
    category: str | None = None,
    shared_categories: list[str] | None = None,
) -> PromotePlan:
    """Mueve un video validado y corrige las rutas de su página."""
    plan = plan_promotion(item_dir, force=force, templates_dir=templates_dir,
                          category=category, shared_categories=shared_categories)
    index_path = plan.source / "index.html"
    html = index_path.read_text(encoding="utf-8") if index_path.is_file() else None
    original_html = html
    manifest_path = plan.source / "manifest.json"
    original_manifest = manifest_path.read_text(encoding="utf-8") if manifest_path.is_file() else None
    is_maps = original_manifest is None
    if is_maps:
        info = json.loads((plan.source / "info.json").read_text(encoding="utf-8"))
        manifest = {"title": info.get("title") or plan.source.name, "status": "en progreso",
                    "design": "mapas-satelitales", "engine": "nodehistory/_mapas"}
        assert html is not None
        html = html.replace("../../../_tools/explainer-kit/", "/api/v1/explainer/files/_tools/explainer-kit/")
        html = html.replace("../../_proto/", "/api/v1/explainer/files/sandbox/_proto/")
        from src.core.explainer.engine_locations import engine_root
        templates = templates_dir or settings.templates_dir
        engine = engine_root(templates, "nodehistory/_mapas").relative_to(templates).as_posix()
        html = html.replace("../_mapas/", "/api/v1/explainer/files/bundled/" + engine + "/")
    else:
        manifest = json.loads(original_manifest)
        if html is not None:
            html = _rewrite_kit_paths(html, plan.destination, external=templates_dir is None and layout_for_settings(settings).schema_version >= 2)
    if category:
        manifest["category"] = category
    elif is_maps:
        manifest["category"] = "node_history"
    if shared_categories is not None:
        manifest["shared_categories"] = shared_categories
    plan.destination.parent.mkdir(parents=True, exist_ok=True)
    lock_path = plan.destination.parent.parent / ".promotion.lock"
    flags = os.O_CREAT | os.O_RDWR | getattr(os, "O_NOFOLLOW", 0)
    with os.fdopen(os.open(lock_path, flags, 0o600), "r+") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        # Revalidate under the shared lock in case another request moved it.
        plan = plan_promotion(item_dir, force=force, templates_dir=templates_dir,
                              category=category, shared_categories=shared_categories)
        # Avoid cross-device copies: they can leave a partial production.
        os.rename(plan.source, plan.destination)
        try:
            if html is not None:
                (plan.destination / "index.html").write_text(html, encoding="utf-8")
            if is_maps or category is not None or shared_categories is not None:
                (plan.destination / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        except Exception:
            if original_html is not None:
                (plan.destination / "index.html").write_text(original_html, encoding="utf-8")
            if original_manifest is None:
                (plan.destination / "manifest.json").unlink(missing_ok=True)
            else:
                (plan.destination / "manifest.json").write_text(original_manifest, encoding="utf-8")
            os.rename(plan.destination, plan.source)
            raise
    return plan
