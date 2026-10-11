"""Diseños del explainer-kit (designs/<id>/design.json) y a qué categoría pertenecen.

La lista de diseños disponibles es la de `showcase/designs.json` (los 11
diseños con componentes). Cada uno tiene nombre, temas y voz en su design.json.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

from src.core.categories import category_for_design, designs_for_category
from src.core.explainer.catalog import KIT_DIR


@dataclass
class KitDesign:
    design_id: str
    name: str
    tagline: str
    topics: list[str] = field(default_factory=list)
    voice: str = ""
    category_path: str | None = None


def _read(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def available_design_ids(kit_dir: Path = KIT_DIR) -> list[str]:
    listed = _read(kit_dir / "showcase" / "designs.json").get("designs") or []
    return [d for d in listed if (kit_dir / "designs" / d / "design.json").exists()]


def load_design(design_id: str, kit_dir: Path = KIT_DIR) -> KitDesign | None:
    data = _read(kit_dir / "designs" / design_id / "design.json")
    if not data:
        return None
    return KitDesign(
        design_id=design_id,
        name=data.get("name") or design_id,
        tagline=data.get("tagline") or "",
        topics=list(data.get("topics") or []),
        voice=(data.get("voice") or {}).get("voice", ""),
        category_path=category_for_design(design_id),
    )


def list_designs(kit_dir: Path = KIT_DIR) -> list[KitDesign]:
    return [d for d in (load_design(i, kit_dir) for i in available_design_ids(kit_dir)) if d]


def designs_for(category_path: str, kit_dir: Path = KIT_DIR) -> tuple[list[KitDesign], bool]:
    """Diseños que puede usar una categoría y si son compartidos (sin diseños propios)."""
    ids, shared = designs_for_category(category_path, available_design_ids(kit_dir))
    designs = [d for d in (load_design(i, kit_dir) for i in ids) if d]
    return designs, shared
