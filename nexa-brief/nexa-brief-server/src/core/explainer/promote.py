"""Promoción de videos explainer-kit desde el sandbox a producción."""

from __future__ import annotations

import json
import os
import re
import shutil
from dataclasses import dataclass
from pathlib import Path

from src.core.explainer.catalog import READY_STATUSES, TEMPLATES_DIR

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
    templates_dir: Path = TEMPLATES_DIR,
) -> PromotePlan:
    """Valida una promoción sin modificar archivos."""
    item_path = Path(item_dir)
    templates_root = Path(templates_dir).resolve()
    if not item_path.is_dir():
        raise PromoteError(
            "not_found",
            MESSAGE_NOT_FOUND.format(path=_display_path(item_path, templates_root)),
        )

    source = item_path.resolve()
    sandbox_root = (templates_root / "sandbox").resolve()
    try:
        relative_source = source.relative_to(sandbox_root)
    except ValueError as exc:
        raise PromoteError("not_sandbox", MESSAGE_NOT_SANDBOX.format(id=source.name)) from exc

    if len(relative_source.parts) != 2:
        raise PromoteError("not_sandbox", MESSAGE_NOT_SANDBOX.format(id=source.name))

    manifest_path = source / "manifest.json"
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        manifest = None
    if not isinstance(manifest, dict):
        raise PromoteError("unsupported", MESSAGE_UNSUPPORTED)

    folder, video_id = relative_source.parts
    destination = templates_root / folder / video_id
    status = manifest.get("status")
    if status not in READY_STATUSES and not force:
        raise PromoteError(
            "not_ready",
            MESSAGE_NOT_READY.format(status=status, id=video_id),
        )
    if destination.exists():
        raise PromoteError(
            "destination_exists",
            MESSAGE_DESTINATION_EXISTS.format(folder=folder, id=video_id),
        )

    return PromotePlan(source=source, destination=destination)


def promotion_blocker(item_dir: Path, *, templates_dir: Path = TEMPLATES_DIR) -> str | None:
    """Devuelve el motivo que impide promover, si existe."""
    try:
        plan_promotion(item_dir, templates_dir=templates_dir)
    except PromoteError as exc:
        return exc.message
    return None


def _rewrite_kit_paths(html: str, destination: Path) -> str:
    """Ajusta las rutas relativas al kit para la ubicación de producción."""
    templates_root = destination.parent.parent
    kit_dir = templates_root / "_tools" / "explainer-kit"
    kit_path = Path(os.path.relpath(kit_dir, destination)).as_posix()
    return _KIT_PATH_RE.sub(f"{kit_path}/", html)


def promote(
    item_dir: Path,
    *,
    force: bool = False,
    templates_dir: Path = TEMPLATES_DIR,
) -> PromotePlan:
    """Mueve un video validado y corrige las rutas de su página."""
    plan = plan_promotion(item_dir, force=force, templates_dir=templates_dir)
    plan.destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(plan.source), str(plan.destination))

    index_path = plan.destination / "index.html"
    if index_path.is_file():
        html = index_path.read_text(encoding="utf-8")
        index_path.write_text(_rewrite_kit_paths(html, plan.destination), encoding="utf-8")

    return plan
