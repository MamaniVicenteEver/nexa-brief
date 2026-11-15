"""Curación de recursos de biblioteca: solo rellena campos vacíos y nunca rompe la preparación."""

import asyncio
from types import SimpleNamespace

import pytest

from src.core.library import resource_curator as rc


def _music(**overrides):
    base = dict(
        original_filename="cancion.mp3", category="stock", source="upload", provider="user_upload",
        license_note="CC BY 3.0", duration_seconds=200, description="", tags="", track_name="Tema",
        artist="Artista", genre="", language="",
    )
    base.update(overrides)
    return SimpleNamespace(**base)


def _patch_library(monkeypatch, entry, updates):
    monkeypatch.setattr(rc, "_find", lambda asset_id: ("music", entry))

    async def fake_update(kind, asset_id, changes):
        updates.append((kind, asset_id, changes))

    monkeypatch.setattr(rc.lib, "update_asset_metadata", fake_update)


def test_fills_only_the_empty_fields(monkeypatch):
    entry = _music(description="Escrita por la persona", tags="")
    updates = []
    _patch_library(monkeypatch, entry, updates)

    async def fake_ask(kind, item, asset_id):
        return rc.CuratedMetadata(description="Descripción del agente", tags=["remix", "urbano"],
                                  genre="urbano", language="EN")

    monkeypatch.setattr(rc, "_ask", fake_ask)
    report = asyncio.run(rc.curate_assets(["a1"]))

    assert report == {"a1": "actualizado"}
    # La descripción escrita por la persona no se toca; título y licencia tampoco aparecen.
    assert updates == [("music", "a1", {"tags": "remix, urbano", "genre": "urbano", "language": "en"})]


def test_complete_resource_is_not_sent_to_the_agent(monkeypatch):
    entry = _music(description="Ya descrita", tags="remix,urbano")
    updates = []
    _patch_library(monkeypatch, entry, updates)

    async def must_not_ask(*_args):
        raise AssertionError("un recurso completo no debe consultar al agente")

    monkeypatch.setattr(rc, "_ask", must_not_ask)
    assert asyncio.run(rc.curate_assets(["a1"])) == {"a1": "completo"}
    assert updates == []


def test_agent_failure_never_breaks_preparation(monkeypatch):
    entry = _music()
    updates = []
    _patch_library(monkeypatch, entry, updates)

    async def failing(*_args):
        raise RuntimeError("sin proveedor de modelos")

    monkeypatch.setattr(rc, "_ask", failing)
    assert asyncio.run(rc.curate_assets(["a1"])) == {"a1": "error"}
    assert updates == []


def test_missing_asset_is_reported_not_raised(monkeypatch):
    monkeypatch.setattr(rc, "_find", lambda asset_id: None)
    assert asyncio.run(rc.curate_assets(["fantasma"])) == {"fantasma": "no_encontrado"}


def test_draft_asset_ids_collects_song_background_and_media_in_order():
    draft = SimpleNamespace(inputs=SimpleNamespace(
        music_asset_id="m1", image_asset_id=None, video_asset_id="v0",
        template_inputs=SimpleNamespace(media={"clips": ["v1", "v2", "v1"]}),
    ))
    assert rc.draft_asset_ids(draft) == ["m1", "v0", "v1", "v2"]


def test_agent_output_outside_the_schema_is_rejected():
    with pytest.raises(Exception):
        rc.CuratedMetadata.model_validate({"description": "x" * 601})
