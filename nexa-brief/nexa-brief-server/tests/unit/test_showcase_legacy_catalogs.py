"""Legacy engines share one catalogue without importing another profile."""
import json
from pathlib import Path
from types import SimpleNamespace
from urllib.parse import parse_qs, urlsplit

import pytest

from src.adapters.showcase.legacy_catalogs import legacy_catalog, legacy_designs, legacy_preview
from src.core.showcase.ports import ShowcaseConflict

TEMPLATES = Path(__file__).resolve().parents[2] / "src/templates"


def adapter(templates: Path, sandbox: Path, version: int):
    return SimpleNamespace(templates=templates, sandbox=sandbox, schema_version=version,
                           allow_legacy_repo=lambda: version == 1)


def write_json(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data), encoding="utf-8")


def test_existing_legacy_catalog_shapes_and_safe_preview_paths():
    source = adapter(TEMPLATES, TEMPLATES / "sandbox", 1)
    designs = legacy_designs(source)
    assert {"cara-a-cara", "atlas-cinematico", "atlas-en-movimiento"} <= designs.keys()
    assert "vida-en-escena" not in designs
    assert "atlas-demo" not in designs and "memorias-demo" not in designs
    assert not any(item["promotable"] for item in designs.values())

    cara = legacy_catalog(source, "cara-a-cara")
    assert len(cara["entries"]) == 55
    assert sum(item["kind"] == "character" and item["preview_kind"] == "image" for item in cara["entries"]) == 4
    recipe = next(item for item in cara["entries"] if item["name"] == "personajes.crear-personaje")
    assert recipe["preview_kind"] == "json" and isinstance(recipe["data"], dict)
    component = next(item for item in cara["entries"] if item["name"] == "comparacion.dos-tarjetas")
    url = legacy_preview(source, "cara-a-cara", component["id"], "9x16")
    assert parse_qs(urlsplit(url).query)["only"] == [component["name"]]
    assert component["params"]["mode"]["values"] == ["duo", "single"]

    atlas = legacy_catalog(source, "atlas-cinematico")
    assert len(atlas["entries"]) == 36
    assert all(item["preview_url"] for item in atlas["entries"])
    tactical = legacy_catalog(source, "atlas-en-movimiento")
    assert len(tactical["entries"]) == 360
    assert all("/preview/tactico/demo.html" in item["preview_url"]
               for item in tactical["entries"] if item["preview_kind"] == "iframe")
    assert sum(item["preview_kind"] == "image" and bool(item["preview_url"]) for item in tactical["entries"]) == 269
    assert designs["atlas-en-movimiento"]["promote_blocker"]


def test_v2_reads_only_selected_profile_and_reports_incomplete_catalog(tmp_path):
    templates = tmp_path / "templates"
    private_other = templates / "sandbox/nodeaction/other-profile"
    write_json(private_other / "info.json", {"title": "Otro", "is_new_design": True})
    sandbox = tmp_path / "selected/sandbox"
    primary = sandbox / "nodeaction/own-design"
    write_json(primary / "info.json", {"title": "Propio", "is_new_design": True, "design": "own-design"})
    write_json(primary / "assets/episode.json", {"id": "episode-real", "title": "Un episodio"})
    (primary / "index.html").write_text("<!doctype html>")
    source = adapter(templates, sandbox, 2)
    designs = legacy_designs(source)
    assert set(designs) == {"own-design"}
    assert designs["own-design"]["episodes"][0]["id"] == "episode-real"
    assert designs["own-design"]["promote_blocker"]
    assert legacy_catalog(source, "own-design")["entries"] == []
    assert legacy_preview(source, "own-design", None, "9x16").startswith("/api/v1/explainer/files/sandbox/")


def test_explicit_episodes_group_by_id_and_duplicate_profile_ids_rejected(tmp_path):
    sandbox = tmp_path / "profile/sandbox"
    templates = tmp_path / "templates"
    for folder, episode in (("design-a", "episode-a"), ("demo-a", "episode-b")):
        root = sandbox / "nodeaction" / folder
        write_json(root / "info.json", {"title": folder, "design": "design-a"})
        write_json(root / "assets/episode.json", {"id": episode})
    source = adapter(templates, sandbox, 2)
    result = legacy_designs(source)
    assert set(result) == {"design-a"}
    assert {episode["id"] for episode in result["design-a"]["episodes"]} == {"episode-a", "episode-b"}
    write_json(sandbox / "nodehistory/duplicate/info.json", {"design": "design-a"})
    with pytest.raises(ShowcaseConflict):
        legacy_designs(source)


def test_symlink_catalog_and_work_previews_are_not_exposed(tmp_path):
    sandbox = tmp_path / "profile/sandbox"
    root = sandbox / "nodeaction/design-a"
    write_json(root / "info.json", {"is_new_design": True, "catalog": {"components": "linked.json", "gallery": "work/demo.html"}})
    external = tmp_path / "outside.json"
    external.write_text('{"components": []}')
    (root / "linked.json").symlink_to(external)
    source = adapter(tmp_path / "templates", sandbox, 2)
    assert legacy_catalog(source, "design-a")["entries"] == []
    assert legacy_preview(source, "design-a", "entry", "9x16") is None


def test_pipeline_candidate_is_read_only_with_explicit_diagnostic(tmp_path):
    sandbox = tmp_path / "profile/sandbox"
    write_json(sandbox / "nodemotion/motion-sample/info.json", {"is_new_design": True, "title": "Motion"})
    source = adapter(tmp_path / "templates", sandbox, 2)
    design = legacy_designs(source)["motion-sample"]
    assert not design["promotable"]
    assert design["promote_blocker"] == "Plantilla de pipeline sin catálogo de componentes estándar"
    assert legacy_catalog(source, "motion-sample")["entries"] == []


@pytest.mark.parametrize("broken", ["sprites", "workflows"])
def test_invalid_optional_catalogs_report_a_diagnostic(tmp_path, broken):
    sandbox = tmp_path / "profile/sandbox"
    root = sandbox / "nodeaction/design-a"
    declaration = {"components": "components.json", "gallery": "showcase.html"}
    if broken == "sprites":
        declaration.update(sprites="sprites.json", spritesDir="sprites")
        write_json(root / "sprites.json", {"sprites": [{"name": "without-file"}]})
    else:
        declaration["workflows"] = "workflows.json"
        write_json(root / "workflows.json", {"cards": [{"title": "missing id"}]})
    write_json(root / "info.json", {"is_new_design": True, "catalog": declaration})
    write_json(root / "components.json", {"components": [{"name": "test.component"}]})
    (root / "showcase.html").write_text("demo")
    source = adapter(tmp_path / "templates", sandbox, 2)
    assert legacy_catalog(source, "design-a")["entries"] == []
    assert "inválid" in legacy_designs(source)["design-a"]["promote_blocker"]


def test_repository_sandbox_requires_explicit_v1_ownership(tmp_path):
    templates = tmp_path / "templates"
    root = templates / "sandbox"
    write_json(root / "nodeaction/repo-design/info.json", {"is_new_design": True})
    source = SimpleNamespace(templates=templates, sandbox=root, schema_version=1,
                             allow_legacy_repo=lambda: False)
    assert legacy_designs(source) == {}
    source.allow_legacy_repo = lambda: True
    assert set(legacy_designs(source)) == {"repo-design"}
    source.schema_version = 2
    assert legacy_designs(source) == {}


def test_explicit_kit_demo_is_grouped_with_builtin(tmp_path):
    templates = tmp_path / "templates"
    write_json(templates / "_tools/explainer-kit/showcase/designs.json", {"designs": ["rough"]})
    sandbox = tmp_path / "profile/sandbox"
    write_json(sandbox / "nodetech/clip-prueba/info.json", {"is_new_design": True, "engine": "explainer-kit:rough"})
    assert legacy_designs(adapter(templates, sandbox, 2)) == {}


@pytest.mark.asyncio
async def test_legacy_designs_are_visible_through_api_v1(tmp_path, monkeypatch):
    import anyio.to_thread
    from httpx import ASGITransport, AsyncClient
    from src.config.settings import settings
    from src.presentation.main import app

    async def inline(func, *args, **kwargs):
        return func(*args)

    monkeypatch.setattr(anyio.to_thread, "run_sync", inline)
    monkeypatch.setattr(settings, "storage_profile_dir", tmp_path / "profile")
    monkeypatch.setattr(settings, "storage_layout_version", 1)
    monkeypatch.setattr(settings, "data_dir", tmp_path / "profile/data")
    monkeypatch.setattr(settings, "templates_dir", TEMPLATES)
    monkeypatch.setattr("src.adapters.showcase.episode_relations.builtin_episode_relations", lambda *_: {})
    write_json(tmp_path / "profile/data/showcase/legacy-source.json", {"schema_version": 1, "owned": True})
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/showcase/designs")
        assert response.status_code == 200
        designs = {item["id"]: item for item in response.json()["designs"]}
        assert {"cara-a-cara", "atlas-cinematico", "atlas-en-movimiento"} <= designs.keys()
        for ident, name in (("cara-a-cara", "comparacion.dos-tarjetas"), ("atlas-cinematico", "atlas.highlight")):
            catalog = await client.get(designs[ident]["catalog_url"])
            assert catalog.status_code == 200
            entry = next(item for item in catalog.json()["entries"] if item["name"] == name)
            preview = await client.get(entry["preview_url"], follow_redirects=True)
            assert preview.status_code == 200
        tactical = (await client.get(designs["atlas-en-movimiento"]["catalog_url"])).json()
        entry = next(item for item in tactical["entries"] if item["name"] == "air.bomber")
        assert (await client.get(entry["preview_url"], follow_redirects=True)).status_code == 200
        sprite = next(item for item in tactical["entries"] if item["preview_kind"] == "image" and item["preview_url"])
        assert (await client.get(sprite["preview_url"], follow_redirects=True)).status_code == 200
