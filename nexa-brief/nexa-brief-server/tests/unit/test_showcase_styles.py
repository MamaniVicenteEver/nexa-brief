"""Los estilos sobreviven a la promoción y comparten contrato con los agentes."""

from copy import deepcopy
import json
import pytest
from src.adapters.showcase.styles import list_styles, get_style
from src.core.showcase.service import ShowcaseService
from src.core.showcase.prepare import prepare_scene
from src.core.showcase.ports import ShowcaseInvalid, ShowcaseNotFound


class Repository:
    def __init__(self, root):
        self.templates = root
        self.design = {
            "id": "maps",
            "name": "Maps",
            "category": "nodehistory",
            "state": "prueba",
            "family": "maps",
            "engine_id": "maps",
            "revision": "r1",
            "visual_styles": {
                "index": "engine/estilos/index.json",
                "episode_defaults": {"episode": "documentary"},
            },
            "episodes": [
                {
                    "id": "episode",
                    "title": "Episode",
                    "design_id": "maps",
                    "preview_url": "/api/v1/explainer/files/sandbox/nodehistory/episode/index.html",
                }
            ],
        }
        directory = root / "engine/estilos"
        directory.mkdir(parents=True)
        (directory / "index.json").write_text(
            json.dumps(
                {
                    "default": "dynamic",
                    "estilos": [
                        {"id": "dynamic", "nombre": "Dynamic"},
                        {"id": "documentary", "nombre": "Documentary"},
                    ],
                }
            )
        )
        for name, size in [("dynamic", 46), ("documentary", 30)]:
            (directory / (name + ".json")).write_text(
                json.dumps(
                    {
                        "id": name,
                        "revision": 1,
                        "layers": {"label": {"size": size}},
                        "text": {"font": "Archivo"},
                        "formatos": {
                            "movil": {"layers": {"label": {"size": size - 2}}}
                        },
                    }
                )
            )

    def get_design(self, ident):
        return deepcopy(self.design) if ident == "maps" else None

    def list_designs(self):
        return [deepcopy(self.design)]

    def get_styles(self, *args):
        return list_styles(self, *args)

    def get_style(self, *args):
        return get_style(self, *args)

    def get_catalog(self, ident):
        return {
            "schema_version": 1,
            "design_id": ident,
            "revision": "r1",
            "entries": [
                {
                    "id": "map.layer.label",
                    "name": "map.layer.label",
                    "label": "Label",
                    "kind": "component",
                    "params": {"size": {"type": "number", "default": 30}},
                    "example": {"type": "label", "text": "Text"},
                    "preview_kind": "json",
                }
            ],
        }


def test_shared_styles_and_episode_defaults_survive_promotion(tmp_path):
    repository = Repository(tmp_path)
    assert list_styles(repository, "maps")["default"] == "dynamic"
    assert list_styles(repository, "episode", "nodehistory")["default"] == "documentary"
    repository.design["state"] = "produccion"
    assert list_styles(repository, "maps")["styles"][0]["name"] == "Dynamic"
    with pytest.raises(ShowcaseNotFound):
        list_styles(repository, "episode", "other")


def test_component_contract_includes_selected_typography_size_and_format(tmp_path):
    api = ShowcaseService(Repository(tmp_path))
    landscape = api.entry("maps", "map.layer.label", "dynamic", "16x9")
    portrait = api.entry("maps", "map.layer.label", "dynamic", "9x16")
    assert landscape.params["size"]["default"] == 46
    assert portrait.params["size"]["default"] == 44
    assert portrait.appearance["typography"]["font"] == "Archivo"
    assert api.entry("maps", "map.layer.label").params["size"]["default"] == 30


def test_prepare_returns_json_without_model_or_storage_mutation(tmp_path):
    repository = Repository(tmp_path)
    api = ShowcaseService(repository)
    original = {"layers": [{"type": "label", "text": "Bolivia", "at": [-64, -17]}]}
    prepared = prepare_scene(
        api, "maps", estilo="documentary", scene=original, config={}, format="9x16"
    )
    assert prepared["scene"]["estilo"] == "documentary"
    assert prepared["scene"]["estiloRevision"] == 1
    assert prepared["config"]["configs"][0]["estilo"] == "documentary"
    assert "estilo" not in original
    assert prepared["recorded"] is False
    with pytest.raises(ShowcaseInvalid):
        prepare_scene(
            api,
            "maps",
            estilo="dynamic",
            scene={"layers": [{"type": "unknown"}]},
            config={},
            format="16x9",
        )


def test_invalid_style_paths_and_broken_identity_are_rejected(tmp_path):
    repository = Repository(tmp_path)
    for style in ["../private", "missing", "https://host"]:
        with pytest.raises(ShowcaseInvalid):
            get_style(repository, "maps", style)
    (tmp_path / "engine/estilos/dynamic.json").write_text('{"id":"other"}')
    with pytest.raises(ShowcaseInvalid):
        get_style(repository, "maps", "dynamic")


def test_style_revision_changes_without_changing_design_state(tmp_path):
    repository = Repository(tmp_path)
    before = list_styles(repository, "maps")["revision"]
    path = tmp_path / "engine/estilos/dynamic.json"
    data = json.loads(path.read_text())
    data["layers"]["label"]["size"] = 60
    path.write_text(json.dumps(data))
    assert list_styles(repository, "maps")["revision"] != before
    assert repository.design["state"] == "prueba"


def test_style_filters_components_that_the_engine_does_not_draw(tmp_path):
    repository = Repository(tmp_path)
    repository.design["visual_styles"]["unavailable_components"] = {"documentary": ["map.layer.label"]}
    api = ShowcaseService(repository)
    assert api.catalog("maps", "dynamic").entries
    assert api.catalog("maps", "documentary").entries == []
    with pytest.raises(ShowcaseNotFound):
        api.entry("maps", "map.layer.label", "documentary")
    with pytest.raises(ShowcaseInvalid):
        prepare_scene(api, "maps", estilo="documentary", scene={"layers": [{"type":"label"}]}, config={}, format="16x9")
