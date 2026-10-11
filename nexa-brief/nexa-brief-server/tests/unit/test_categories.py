"""Árbol de categorías (niches.json → categories) y su validación."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from src.core import categories as cats
from src.core.categories import CategoryNode, load_categories


def _write(tmp_path: Path, payload: dict) -> Path:
    path = tmp_path / "niches.json"
    path.write_text(json.dumps(payload), encoding="utf-8")
    return path


def test_real_tree_loads_and_has_five_main_categories():
    tree = load_categories()
    assert list(tree) == [
        "node_tech",
        "node_history",
        "node_motion",
        "node_politics",
        "node_economy",
    ]
    assert tree["node_tech"].display_name == "NodeTech"
    assert tree["node_tech"].topic == "tecnología"


def test_tech_gets_rough_and_history_gets_the_rest():
    tree = load_categories()
    assert tree["node_tech"].designs == ["rough"]
    history = tree["node_history"].designs
    assert "rough" not in history
    assert "binary" in history
    assert tree["node_tech"].folder == "nodetech" and tree["node_history"].folder == "nodehistory"
    assert len(history) == 10


def test_empty_and_planned_categories_have_no_content():
    tree = load_categories()
    assert tree["node_politics"].status == "empty"
    assert tree["node_politics"].niches == []
    assert tree["node_politics"].designs == []
    assert tree["node_economy"].status == "planned"


def test_every_niche_is_assigned_exactly_once():
    raw = json.loads(
        Path(cats._NICHES_PATH).read_text(encoding="utf-8")
    )
    assigned = []
    for path, node in cats._walk(load_categories()):
        assigned.extend(node.niches)
    assert sorted(assigned) == sorted(raw["niches"].keys())


def test_motion_subcategories_group_music_niches():
    motion = load_categories()["node_motion"]
    assert set(motion.children) == {"letras", "promos", "fondos", "instrumental"}
    assert "lyrics_video_neon" in motion.children["letras"].niches
    assert "promo_video_kinetic" in motion.children["promos"].niches


def test_category_lookup_helpers():
    assert cats.category_for_niche("lyrics_video_neon") == "node_motion/letras"
    assert cats.category_for_niche("no_existe") is None
    assert cats.category_for_design("rough") == "node_tech"
    assert cats.category_for_design("binary") == "node_history"
    assert cats.explainer_folders()["nodetech"] == "node_tech"


def test_niches_in_category_includes_children():
    motion_niches = cats.niches_in_category("node_motion")
    assert "lyrics_video_neon" in motion_niches
    assert "promo_video_kinetic" in motion_niches
    assert cats.niches_in_category("node_politics") == []


def test_unknown_category_path_raises():
    with pytest.raises(KeyError):
        cats.niches_in_category("node_inventada")


def test_unknown_niche_is_rejected(tmp_path: Path):
    path = _write(
        tmp_path,
        {
            "niches": {"a": {}},
            "categories": {"x": {"display_name": "X", "niches": ["a", "b"]}},
        },
    )
    with pytest.raises(ValueError, match="nicho desconocido 'b'"):
        load_categories(path)


def test_niche_assigned_twice_is_rejected(tmp_path: Path):
    path = _write(
        tmp_path,
        {
            "niches": {"a": {}},
            "categories": {
                "x": {"display_name": "X", "niches": ["a"]},
                "y": {"display_name": "Y", "niches": ["a"]},
            },
        },
    )
    with pytest.raises(ValueError, match="asignado a"):
        load_categories(path)


def test_design_assigned_twice_is_rejected(tmp_path: Path):
    path = _write(
        tmp_path,
        {
            "niches": {},
            "categories": {
                "x": {"display_name": "X", "designs": ["binary"]},
                "y": {
                    "display_name": "Y",
                    "children": {"z": {"display_name": "Z", "designs": ["binary"]}},
                },
            },
        },
    )
    with pytest.raises(ValueError, match="diseño 'binary'"):
        load_categories(path)


def test_file_without_categories_key_loads_empty(tmp_path: Path):
    path = _write(tmp_path, {"niches": {"a": {}}})
    assert load_categories(path) == {}


def test_node_model_accepts_nested_children():
    node = CategoryNode.model_validate(
        {"display_name": "A", "children": {"b": {"display_name": "B"}}}
    )
    assert node.children["b"].display_name == "B"
