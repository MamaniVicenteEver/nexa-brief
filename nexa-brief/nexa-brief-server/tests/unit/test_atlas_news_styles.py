from types import SimpleNamespace
from copy import deepcopy
import pytest
from src.core.showcase.prepare import prepare_scene
from src.core.showcase.ports import ShowcaseInvalid
from src.core.showcase.style_contract import appearance
from src.adapters.showcase.sandbox_projects import SandboxProjectsAdapter


def test_news_contract_exposes_reading_size_palette_and_safe_positions():
    style = {"id":"dynamic-news", "revision":"r1", "format":"9x16", "tokens":{
        "family":"atlas-news", "enabled":True, "fonts":{"family":"Barlow Condensed"},
        "colors":{"alert":"#EF3340"}, "components":{"alert":{"size":86}},
        "layout":{"safe":{"bottom":.22}},
    }}
    result = appearance("noticiero.alert",style)
    assert result["defaults"]["size"] == 86
    assert result["typography"]["family"] == "Barlow Condensed"
    assert result["colors"]["alert"] == "#EF3340"
    assert result["layout"]["safe"]["bottom"] == .22


def test_prepare_validates_hud_and_geographic_layers_without_writing():
    style={"revision":"r1", "tokens":{"family":"atlas-news","revision":1,
           "targets":{"hud":["alert","counter"],"layers":["arc","highlight"]}}}
    service=SimpleNamespace(style=lambda *a:style,catalog=lambda *a:SimpleNamespace(entries=[]))
    scene={"hud":[{"type":"alert","text":"UN HECHO"}], "layers":[{"type":"arc","from":[0,0],"to":[1,1]}]}
    before=deepcopy(scene)
    prepared=prepare_scene(service,"demo",estilo="dynamic-news",scene=scene,config={},format="9x16")
    assert scene == before
    assert prepared["scene"]["estilo"] == "dynamic-news"
    assert prepared["scene"]["estiloRevision"] == 1
    assert prepared["recorded"] is False
    for invalid in [{"hud":[{"type":"missing"}]},{"layers":[{"type":"missing"}]}]:
        with pytest.raises(ShowcaseInvalid):
            prepare_scene(service,"demo",estilo="dynamic-news",scene=invalid,config={},format="9x16")


def test_managed_sandbox_preserves_shared_styles_without_promoting(monkeypatch):
    import src.adapters.showcase.sandbox_projects as module
    adapter=SandboxProjectsAdapter(SimpleNamespace(sandbox=object()))
    monkeypatch.setattr(adapter,"_catalog",lambda item:({"revision":"r1"},None))
    monkeypatch.setattr(module,"_url",lambda *args:"/api/v1/explainer/files/sandbox/nodepolitics/demo/index.html")
    declaration={"index":"sandbox/nodehistory/_atlas/noticiero/estilos/index.json"}
    design=adapter._design({"design_id":"sandbox-test","relative":"nodepolitics/demo","project_id":"demo","folder":"nodepolitics","info":{"engine":"nodehistory/_atlas","visual_styles":declaration}})
    assert design["visual_styles"] == declaration
    assert design["state"] == "prueba" and design["promotable"] is False
