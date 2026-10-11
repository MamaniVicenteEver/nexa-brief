"""Categorías principales (NodeTech, NodeHistory, NodeMotion, ...) con subcategorías.

El árbol vive en la clave `categories` de niches.json. Cada nodo puede tener
`children` (subcategorías) y asigna nichos del pipeline (`niches`) o diseños
del explainer-kit (`designs`). Un nicho o diseño pertenece a UNA sola
categoría: `load_categories` valida eso al cargar.

Cada categoría principal trae su `strategy` (público, ángulo, fórmulas de
título, temas sugeridos): la usan el generador de textos del explainer y el
planificador semanal, así cada rama tiene su propia estrategia.

Las salidas de video viven en output/<ruta de categoría>/ (ver
`output_dir_for_niche` y `ensure_output_dirs`).

Uso:
    from src.core.categories import list_categories, category_for_niche
    tree = list_categories()                       # dict id -> CategoryNode
    cat = category_for_niche("lyrics_video_neon")  # "node_motion/letras"
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field

from src.config.niche_config import _NICHES_PATH

Status = Literal["active", "planned", "empty"]
Engine = Literal["pipeline", "explainer_kit"]


Cadence = Literal["daily", "alternate"]


class CategoryStrategy(BaseModel):
    """Estrategia editorial de una rama: la leen los prompts de IA."""

    audience: str = ""
    angle: str = ""
    tone: str = ""
    title_formulas: list[str] = Field(default_factory=list)
    title_examples: list[str] = Field(default_factory=list)
    topic_ideas: list[str] = Field(default_factory=list)
    hashtags: list[str] = Field(default_factory=list)
    rules: list[str] = Field(default_factory=list)
    language: str = "es-419"
    default_cadence: Cadence = "daily"


class CategoryNode(BaseModel):
    display_name: str
    topic: str = ""
    status: Status = "empty"
    engine: Engine = "pipeline"
    # Carpeta de videos en src/templates/ (solo categorías explainer: nodetech, …)
    folder: str | None = None
    designs: list[str] = Field(default_factory=list)
    niches: list[str] = Field(default_factory=list)
    strategy: CategoryStrategy | None = None
    children: dict[str, "CategoryNode"] = Field(default_factory=dict)


CategoryNode.model_rebuild()


_cache: dict[str, CategoryNode] | None = None


def _walk(
    nodes: dict[str, CategoryNode], prefix: str = ""
) -> list[tuple[str, CategoryNode]]:
    """Recorre el árbol en profundidad devolviendo (ruta, nodo)."""
    out: list[tuple[str, CategoryNode]] = []
    for node_id, node in nodes.items():
        path = f"{prefix}/{node_id}" if prefix else node_id
        out.append((path, node))
        out.extend(_walk(node.children, path))
    return out


def validate_tree(
    tree: dict[str, CategoryNode], known_niches: set[str]
) -> None:
    """Lanza ValueError si hay nichos desconocidos o asignados dos veces."""
    seen_niches: dict[str, str] = {}
    seen_designs: dict[str, str] = {}
    errors: list[str] = []

    for path, node in _walk(tree):
        for niche in node.niches:
            if niche not in known_niches:
                errors.append(f"{path}: nicho desconocido '{niche}'")
            if niche in seen_niches:
                errors.append(
                    f"nicho '{niche}' asignado a {seen_niches[niche]} y {path}"
                )
            seen_niches.setdefault(niche, path)
        for design in node.designs:
            if design in seen_designs:
                errors.append(
                    f"diseño '{design}' asignado a {seen_designs[design]} y {path}"
                )
            seen_designs.setdefault(design, path)

    if errors:
        raise ValueError("categories inválidas: " + "; ".join(errors))


def load_categories(path: Path = _NICHES_PATH) -> dict[str, CategoryNode]:
    """Lee y valida el árbol de categorías desde niches.json."""
    raw = json.loads(path.read_text(encoding="utf-8"))
    tree = {
        cat_id: CategoryNode.model_validate(node)
        for cat_id, node in raw.get("categories", {}).items()
    }
    validate_tree(tree, set(raw.get("niches", {}).keys()))
    return tree


def list_categories() -> dict[str, CategoryNode]:
    """Árbol de categorías cacheado por proceso (igual que niche_config)."""
    global _cache
    if _cache is None:
        _cache = load_categories()
    return _cache


def reload_categories() -> None:
    global _cache
    _cache = None


def category_for_niche(niche_id: str) -> str | None:
    """Ruta de la categoría que contiene el nicho, p. ej. 'node_motion/letras'."""
    for path, node in _walk(list_categories()):
        if niche_id in node.niches:
            return path
    return None


def category_for_design(design_id: str) -> str | None:
    """Ruta de la categoría que contiene el diseño del explainer-kit."""
    for path, node in _walk(list_categories()):
        if design_id in node.designs:
            return path
    return None


def niches_in_category(category_path: str) -> list[str]:
    """Nichos de una categoría incluyendo los de sus subcategorías."""
    tree = list_categories()
    for path, node in _walk(tree):
        if path == category_path:
            return [
                niche
                for _, sub in _walk({"_": node})
                for niche in sub.niches
            ]
    raise KeyError(category_path)


def category_path_for(value: str) -> str | None:
    """Ruta de categoría para un id de categoría, una ruta o un id de nicho.

    'node_motion' → 'node_motion'; 'node_motion/letras' → 'node_motion/letras';
    'lyrics_video_neon' (nicho) → 'node_motion/letras'. None si no existe.
    """
    tree = list_categories()
    for path, _ in _walk(tree):
        if path == value:
            return path
    return category_for_niche(value)


def category_matches(job_category: str, filter_value: str | None) -> bool:
    """¿Un job con `job_category` (nicho o categoría) cae bajo `filter_value`?

    None/'' matchea todo. Una categoría matchea sus subcategorías: el filtro
    'node_motion' acepta 'node_motion/letras', y el filtro 'node_motion/letras'
    no acepta 'node_motion/promos'.
    """
    if not filter_value:
        return True
    if job_category == filter_value:
        return True
    path = category_path_for(job_category)
    if path is None:
        return False
    return path == filter_value or path.startswith(filter_value + "/")


def get_category(category_path: str) -> CategoryNode | None:
    """Nodo por ruta ('node_motion/letras'); None si no existe."""
    for path, node in _walk(list_categories()):
        if path == category_path:
            return node
    return None


def top_level_of(category_path: str) -> str:
    return category_path.split("/", 1)[0]


def strategy_for(category_path: str) -> CategoryStrategy:
    """Estrategia de la categoría principal (las subcategorías la heredan)."""
    node = list_categories().get(top_level_of(category_path))
    return (node.strategy if node and node.strategy else None) or CategoryStrategy()


def designs_for_category(category_path: str, available: list[str]) -> tuple[list[str], bool]:
    """Diseños del explainer-kit que puede usar una categoría.

    Devuelve (diseños, compartidos). Si la categoría (o sus hijas) tiene
    diseños propios, solo esos. Si usa el motor explainer pero todavía no
    tiene diseños propios (NodePolitics, NodeEconomy), puede usar todos los
    del kit (`available`) y `compartidos` es True.
    """
    node = get_category(category_path)
    if node is None:
        raise KeyError(category_path)
    own = [d for _, sub in _walk({"_": node}) for d in sub.designs]
    if own:
        return own, False
    if node.engine == "explainer_kit":
        return list(available), True
    return [], False


def output_dir_for_niche(output_root: Path, niche_id: str) -> Path:
    """output/<ruta de categoría>/ para un nicho; output/ si no tiene categoría."""
    path = category_for_niche(niche_id)
    return output_root / path if path else output_root


def ensure_output_dirs(output_root: Path) -> list[Path]:
    """Crea output/<categoría>/<subcategoría>/ para todo el árbol."""
    created = []
    for path, _ in _walk(list_categories()):
        target = output_root / path
        target.mkdir(parents=True, exist_ok=True)
        created.append(target)
    return created


def explainer_folders() -> dict[str, str]:
    """{carpeta: categoría} de las categorías principales que guardan videos en src/templates/."""
    return {node.folder: cat_id for cat_id, node in list_categories().items() if node.folder}
