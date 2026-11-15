"""Los nombres visibles de las plantillas son unicos: el catalogo nunca muestra dos iguales."""

import json
from types import SimpleNamespace

import pytest

from src.config import template_manifest as tm


def test_duplicate_display_names_are_rejected():
    catalog = {"templates": {
        "lyrics-a": {"display_name": "Grunge Rojo"},
        "lyrics-b": {"display_name": "  grunge   ROJO "},
    }}
    with pytest.raises(ValueError, match="duplicado"):
        tm.assert_unique_display_names(catalog)


def test_distinct_names_pass_and_entries_without_name_are_ignored():
    tm.assert_unique_display_names({"templates": {
        "lyrics-a": {"display_name": "Grunge Rojo"},
        "lyrics-b": {"display_name": "Grunge Rojo 2"},
        "lyrics-c": {},
    }})


def test_loader_refuses_a_catalog_with_duplicates(tmp_path, monkeypatch):
    (tmp_path / "templates.json").write_text(json.dumps({"templates": {
        "a": {"display_name": "Igual"},
        "b": {"display_name": "Igual"},
    }}), encoding="utf-8")
    monkeypatch.setattr(tm, "settings", SimpleNamespace(templates_dir=tmp_path))
    tm._load_catalog.cache_clear()
    try:
        with pytest.raises(ValueError):
            tm._load_catalog()
    finally:
        tm._load_catalog.cache_clear()


def test_real_catalog_has_unique_names():
    tm._load_catalog.cache_clear()
    try:
        catalog = tm._load_catalog()
    finally:
        tm._load_catalog.cache_clear()
    tm.assert_unique_display_names(catalog)
