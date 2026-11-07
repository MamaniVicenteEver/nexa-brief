"""Estrategias del paquete de publicación (src/skills/explainer/): carga y validación."""

from __future__ import annotations

import json
import shutil
from pathlib import Path

import pytest

from src.config.settings import settings
from src.core.explainer.publishing import strategies as strategies_mod
from src.core.explainer.publishing.strategies import (
    PIECES,
    StrategyError,
    active_strategies,
    explainer_skills_dir,
    load_category,
    load_strategy,
)

REPO_SKILLS = Path(settings.skills_dir)


def test_every_strategy_file_in_repo_is_valid():
    root = explainer_skills_dir() / "strategies"
    files = [(piece, path.stem) for piece in PIECES for path in sorted((root / piece).glob("*.json"))]
    assert {piece for piece, _ in files} == set(PIECES)
    for piece, strategy_id in files:
        assert load_strategy(piece, strategy_id).id == strategy_id


def test_every_category_profile_in_repo_is_valid():
    for path in sorted((REPO_SKILLS / "explainer" / "categories").glob("*.json")):
        assert load_category(path.stem).id == path.stem


def test_active_resolves_one_strategy_per_piece_for_node_tech():
    active = active_strategies("node_tech")
    assert set(active.ids()) == set(PIECES)
    assert active.category.channel == "NodeTech"


def test_override_switches_one_piece_without_touching_active_json():
    active = active_strategies("node_tech", overrides={"title": "title_anchor_tension_v1"})
    assert active.title.id == "title_anchor_tension_v1"


@pytest.fixture
def skills_copy(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Copia de src/skills para romper archivos sin tocar el repo."""
    copy = tmp_path / "skills"
    shutil.copytree(REPO_SKILLS / "explainer", copy / "explainer")
    monkeypatch.setattr(settings, "skills_dir", copy)
    strategies_mod._cache.clear()
    yield copy / "explainer"
    strategies_mod._cache.clear()


def _edit(path: Path, **changes) -> None:
    data = json.loads(path.read_text(encoding="utf-8"))
    data.update(changes)
    path.write_text(json.dumps(data), encoding="utf-8")


def test_impossible_range_is_rejected(skills_copy: Path):
    _edit(skills_copy / "strategies" / "tags" / "tags_minimal_v1.json", youtube_tags=[13, 10])
    with pytest.raises(StrategyError, match="rango inválido"):
        load_strategy("tags", "tags_minimal_v1")


def test_id_must_match_file_name(skills_copy: Path):
    _edit(skills_copy / "strategies" / "title" / "title_anchor_tension_v1.json", id="otro_id")
    with pytest.raises(StrategyError, match="declara id"):
        load_strategy("title", "title_anchor_tension_v1")


def test_missing_piece_in_active_json_is_reported(skills_copy: Path):
    (skills_copy / "active.json").write_text(json.dumps({"_default": {"title": "title_anchor_tension_v1"}}))
    with pytest.raises(StrategyError, match="no define estrategia"):
        active_strategies("node_tech")


def test_category_exception_wins_over_default(skills_copy: Path):
    source = skills_copy / "strategies" / "title" / "title_anchor_tension_v1.json"
    v2 = source.with_name("title_anchor_tension_v2.json")
    shutil.copy(source, v2)
    _edit(v2, id="title_anchor_tension_v2", max_chars=55)
    _edit(skills_copy / "active.json", node_tech={"title": "title_anchor_tension_v2"})
    assert active_strategies("node_tech").title.max_chars == 55


def test_unknown_field_in_a_strategy_is_rejected(skills_copy: Path):
    _edit(skills_copy / "strategies" / "title" / "title_anchor_tension_v1.json", max_char=55)
    with pytest.raises(StrategyError, match="max_char"):
        load_strategy("title", "title_anchor_tension_v1")


def test_malformed_active_json_is_a_strategy_error(skills_copy: Path):
    (skills_copy / "active.json").write_text('{"_default": {"titulo": "x"}}')
    with pytest.raises(StrategyError, match="active.json inválido"):
        active_strategies("node_tech")
    (skills_copy / "active.json").write_text("{ roto")
    with pytest.raises(StrategyError, match="active.json inválido"):
        active_strategies("node_tech")


def test_override_of_an_unknown_piece_is_rejected():
    with pytest.raises(StrategyError, match="piezas desconocidas"):
        active_strategies("node_tech", overrides={"titel": "title_anchor_tension_v1"})
