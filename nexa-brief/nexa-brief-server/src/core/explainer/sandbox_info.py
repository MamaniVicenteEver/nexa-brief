"""Lectura de la ficha de consumo por plantilla del sandbox."""

from __future__ import annotations

import json
import logging
import math
import re
from pathlib import Path
from typing import Any

from src.templates._tools.sandbox.costs import calculate_costs


def _empty_result(info: dict[str, Any] | None = None) -> dict[str, Any]:
    """Forma estable de la respuesta cuando la plantilla aún no tiene ficha."""
    backfill = (info or {}).get("usage_backfill")
    return {
        "info": info,
        "components": [],
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
    except (OSError, ValueError):
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
    result = _safe_costs(cost_root, cost_folder, item_id, info)
    result["components"] = _declared_components(info, item_dir / "info.json")
    return result


def get_item_costs(sandbox_root: Path, item_dir: Path) -> tuple[bool, int | None, bool]:
    """Devuelve los campos ligeros que se agregan a cada tarjeta del catálogo."""
    info = _read_info(item_dir)
    if info is None:
        return False, None, False
    result = _safe_costs(sandbox_root, item_dir.parent.name, item_dir.name, info)
    return True, int(result.get("total_tokens") or 0), bool(_declared_components(info, item_dir / "info.json"))


logger = logging.getLogger(__name__)
_COMPONENT_NAME = re.compile(r"^[a-z][a-z0-9_-]*\.[A-Za-z0-9]+$")
_GROUP = re.compile(r"^[a-z][a-z0-9-]*$")


def _value_valid(value: Any, spec: dict) -> bool:
    kind = spec["type"]
    if kind == "string":
        valid = isinstance(value, str)
    elif kind == "boolean":
        valid = isinstance(value, bool)
    else:
        valid = isinstance(value, (int, float)) and not isinstance(value, bool) and (isinstance(value, int) or math.isfinite(value))
    if not valid or spec.get("options") is not None and value not in spec["options"]:
        return False
    return kind != "number" or ((spec.get("min") is None or value >= spec["min"]) and
                                (spec.get("max") is None or value <= spec["max"]))


def _valid_component(component: Any) -> bool:
    if not isinstance(component, dict) or set(component) - {"name", "label", "summary", "group", "default", "params"}:
        return False
    if not isinstance(component.get("name"), str) or not _COMPONENT_NAME.fullmatch(component["name"]):
        return False
    for key, limit in (("label", 60), ("summary", 200)):
        if (not isinstance(component.get(key), str) or not 0 < len(component[key]) <= limit
                or any(0x1F000 <= ord(char) <= 0x1FAFF or 0x2600 <= ord(char) <= 0x27BF for char in component[key])):
            return False
    if "group" in component and (not isinstance(component["group"], str) or not _GROUP.fullmatch(component["group"])):
        return False
    if "default" in component and not isinstance(component["default"], bool):
        return False
    params = component.get("params", {})
    if not isinstance(params, dict):
        return False
    for key, spec in params.items():
        if not isinstance(key, str) or not key or not isinstance(spec, dict):
            return False
        if set(spec) - {"type", "default", "doc", "required", "options", "min", "max"} or spec.get("type") not in ("string", "number", "boolean") or "default" not in spec:
            return False
        if ("doc" in spec and not isinstance(spec["doc"], str)) or ("required" in spec and not isinstance(spec["required"], bool)):
            return False
        options = spec.get("options")
        if options is not None and (not isinstance(options, list) or not options):
            return False
        for bound in ("min", "max"):
            value = spec.get(bound)
            if value is not None and (spec["type"] != "number" or isinstance(value, bool) or not isinstance(value, (int, float)) or (isinstance(value, float) and not math.isfinite(value))):
                return False
        if spec.get("min") is not None and spec.get("max") is not None and spec["min"] > spec["max"]:
            return False
        if options is not None and not all(_value_valid(value, {"type": spec["type"]}) for value in options):
            return False
        if not _value_valid(spec["default"], spec):
            return False
    return True


def _declared_components(info: dict | None, info_path: Path) -> list[dict]:
    raw = (info or {}).get("components", [])
    if not isinstance(raw, list):
        logger.warning("Componentes inválidos en %s", info_path)
        return []
    result, names = [], set()
    for component in raw:
        if len(result) >= 16 or not _valid_component(component) or component["name"] in names:
            logger.warning("Componente inválido o duplicado en %s", info_path)
            continue
        result.append(component)
        names.add(component["name"])
    groups = {c["group"] for c in result if "group" in c}
    invalid = {group for group in groups if sum(c.get("default") is True for c in result if c.get("group") == group) != 1}
    if invalid:
        logger.warning("Grupos sin exactamente un componente predeterminado en %s: %s", info_path, sorted(invalid))
    return [c for c in result if c.get("group") not in invalid]


def load_declared_components(info_path: Path) -> list[dict]:
    """Lee la declaración y omite entradas o grupos inválidos."""
    return _declared_components(_read_info(info_path.parent), info_path)
