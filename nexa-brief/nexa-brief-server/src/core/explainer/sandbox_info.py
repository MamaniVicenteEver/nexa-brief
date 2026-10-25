"""Lectura de la ficha de consumo por plantilla del sandbox."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from src.templates._tools.sandbox.costs import calculate_costs


def _empty_result(info: dict[str, Any] | None = None) -> dict[str, Any]:
    """Forma estable de la respuesta cuando la plantilla aún no tiene ficha."""
    backfill = (info or {}).get("usage_backfill")
    return {
        "info": info,
        "totals_by_model": [],
        "fresh_input_tokens": 0,
        "total_tokens": 0,
        "cached_tokens": 0,
        "estimated": bool(backfill.get("estimated")) if isinstance(backfill, dict) else False,
        "baseline": None,
        "ratio_vs_baseline": None,
        "forecast_next": None,
        "verdict": None,
    }


def _read_info(item_dir: Path) -> dict[str, Any] | None:
    try:
        info = json.loads((item_dir / "info.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return info if isinstance(info, dict) else None


def _safe_costs(sandbox_root: Path, folder: str, item_id: str, info: dict[str, Any]) -> dict[str, Any]:
    """Reutiliza el cálculo compartido y conserva la forma ante datos históricos incompletos."""
    try:
        return calculate_costs(sandbox_root, folder, item_id)
    except (OSError, TypeError, ValueError, KeyError, AttributeError):
        return _empty_result(info)


def get_sandbox_info(
    sandbox_root: Path,
    folder: str,
    item_id: str,
    subcategory: str | None = None,
) -> dict[str, Any]:
    """Lee la ficha y calcula uso, línea base y pronóstico de una plantilla."""
    root = sandbox_root.resolve()
    item_dir = (root / folder / subcategory / item_id if subcategory else root / folder / item_id).resolve()
    if not item_dir.is_relative_to(root) or not item_dir.is_dir():
        suffix = f"/{subcategory}" if subcategory else ""
        raise FileNotFoundError(f"No existe sandbox/{folder}{suffix}/{item_id}")

    info = _read_info(item_dir)
    if info is None:
        return _empty_result()
    cost_root = root / folder if subcategory else root
    cost_folder = subcategory or folder
    return _safe_costs(cost_root, cost_folder, item_id, info)


def get_item_costs(sandbox_root: Path, item_dir: Path) -> tuple[bool, int | None]:
    """Devuelve los campos ligeros que se agregan a cada tarjeta del catálogo."""
    info = _read_info(item_dir)
    if info is None:
        return False, None
    result = _safe_costs(sandbox_root, item_dir.parent.name, item_dir.name, info)
    return True, int(result.get("total_tokens") or 0)
