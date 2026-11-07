from contextlib import asynccontextmanager
from pathlib import Path
import hashlib
import json

import pytest

from src.adapters.showcase.shared_definitions import SharedDefinitionsShowcaseAdapter
from src.core.showcase.ports import ShowcaseConflict
from src.core.showcase.service import ShowcaseService

TEMPLATES = Path(__file__).resolve().parents[2] / "src/templates"


def test_navigation_preserves_all_19_render_contracts_and_native_categories():
    from src.adapters.showcase.catalog_navigation import catalog_navigation
    from src.core.showcase.models import Catalog

    catalogs = {}
    definitions = sorted((TEMPLATES / "_tools/design-definitions").glob("*/catalog.json"))
    assert len(definitions) == 19
    for path in definitions:
        original_bytes = path.read_bytes()
        raw = json.loads(original_bytes)
        before = json.dumps(raw, sort_keys=True)
        value = catalog_navigation(TEMPLATES, path.parent.name, raw)
        public = Catalog.model_validate(value).model_dump()
        assert public["revision"] == raw["revision"]
        assert [e["id"] for e in public["entries"]] == [e["id"] for e in raw["entries"]]
        for old, new in zip(raw["entries"], value["entries"]):
            assert all(new[key] == field for key, field in old.items())
        assert json.dumps(raw, sort_keys=True) == before
        assert path.read_bytes() == original_bytes
        catalogs[path.parent.name] = public
    assert sum(len(c["entries"]) for c in catalogs.values()) == 938
    atlas = catalogs["atlas-en-movimiento"]
    assert len([e for e in atlas["entries"] if e["section"] == "sprites"]) == 269
    assert len([e for e in atlas["entries"] if e["section"] == "components"]) == 91
    assert [g["label"] for g in atlas["groups"]] == [
        "Textos", "Imágenes y documentos", "Unidades", "Mapa y rutas", "Efectos", "Sitios y economía"
    ]
    assert next(e for e in atlas["entries"] if e["id"] == "label.chip")["family"] == "label"
    assert next(e for e in catalogs["cara-a-cara"]["entries"] if e["name"] == "comparacion.dos-tarjetas")["family"] == "Comparación"
    assert next(e for e in catalogs["atlas-cinematico"]["entries"] if e["name"] == "atlas.highlight")["family"] == "territorios"
    assert {e["family"] for e in catalogs["vida-en-escena"]["entries"] if e["name"].startswith("expressions.")} == {"expressions"}


def test_navigation_accepts_new_standard_groups_without_legacy_sources(tmp_path):
    from src.adapters.showcase.catalog_navigation import catalog_navigation

    catalog = {"entries": [{"id": "new-card", "name": "card.hero", "kind": "component", "family": "cards"}],
               "groups": [{"id": "cards", "label": "Tarjetas", "families": ["cards"], "components": []}]}
    result = catalog_navigation(tmp_path, "new-design", catalog)
    assert result["groups"] == catalog["groups"]
    assert result["entries"][0]["family"] == "cards"
    assert list(tmp_path.iterdir()) == []


class Records:
    def __init__(self):
        self.rows = []

    def list(self):
        return [dict(row) for row in self.rows]

    async def upsert(self, record, *, match):
        self.rows = [r for r in self.rows if any(r[k] != record[k] for k in match)]
        self.rows.append(dict(record))
        return record


class Store:
    def __init__(self):
        self.records = Records()

    def collection(self, name):
        assert name == "showcase_designs"
        return self.records

    @asynccontextmanager
    async def coordination(self, name):
        assert name == "showcase"
        yield


def test_shared_contracts_and_per_profile_promotion(tmp_path):
    first_store, second_store = Store(), Store()
    first = ShowcaseService(SharedDefinitionsShowcaseAdapter(tmp_path / "first", TEMPLATES, data_store=first_store))
    second = ShowcaseService(SharedDefinitionsShowcaseAdapter(tmp_path / "second", TEMPLATES, data_store=second_store))
    definition = TEMPLATES / "_tools/design-definitions/vida-en-escena/design.json"
    before = hashlib.sha256(definition.read_bytes()).hexdigest()
    initial = first.get_design("vida-en-escena")
    assert initial.state == second.get_design("vida-en-escena").state == "prueba"
    catalog = first.catalog(initial.id)
    entry = next(x for x in catalog.entries if x.id == "characters.heladero")
    target = first.preview(initial.id, entry.id, "16x9")
    assert "only=characters.heladero" in target and "aspect=16x9" in target
    assert first.promote(initial.id).state == "produccion"
    assert second.get_design(initial.id).state == "prueba"
    assert first.catalog(initial.id) == catalog
    assert first.preview(initial.id, entry.id, "16x9") == target
    assert first.promote(initial.id).state == "produccion"
    assert first_store.records.list() == [
        {"id": initial.id, "state": "produccion", "definition_ref": initial.id, "revision": initial.revision}
    ]
    assert hashlib.sha256(definition.read_bytes()).hexdigest() == before
    assert not (tmp_path / "first/designs").exists() and not (tmp_path / "first/sandbox/designs").exists()


def test_revision_mismatch_is_explicit_and_shared_catalog_has_19_designs(tmp_path):
    store = Store()
    adapter = SharedDefinitionsShowcaseAdapter(tmp_path, TEMPLATES, data_store=store)
    assert len(adapter.list_designs()) == 19
    design = adapter.get_design("vida-en-escena")
    store.records.rows.append(
        {"id": design["id"], "state": "produccion", "definition_ref": design["id"], "revision": "old"}
    )
    with pytest.raises(ShowcaseConflict, match="revisión"):
        adapter.get_design(design["id"])


def test_real_json_provider_writes_profile_state_only(tmp_path, monkeypatch):
    from src.adapters.data.json_store import JsonDataStore
    from src.config.settings import settings

    root = tmp_path / "profile"
    root.mkdir()
    monkeypatch.setattr(settings, "storage_profile_dir", root)
    monkeypatch.setattr(settings, "storage_layout_version", 3)
    monkeypatch.setattr(settings, "data_dir", root / "data")
    adapter = SharedDefinitionsShowcaseAdapter(root, TEMPLATES, data_store=JsonDataStore())
    svc = ShowcaseService(adapter)
    design = svc.get_design("vida-en-escena")
    assert svc.promote(design.id).state == "produccion"
    assert (root / "data/json/designs.json").is_file()
    assert not (root / "designs").exists()
    assert not (root / "sandbox/designs").exists()
    assert svc.get_design(design.id).state == "produccion"


@pytest.mark.asyncio
async def test_schema3_http_uses_shared_previews_and_profile_local_state(tmp_path, monkeypatch):
    from fastapi import FastAPI
    from httpx import ASGITransport, AsyncClient
    from src.adapters.data.json_store import JsonDataStore
    from src.config.settings import settings
    from src.presentation.api.routers import explainer, showcase
    from src.presentation.api.security import require_internal
    import src.core.data as data

    root = tmp_path / "profile"
    root.mkdir()
    monkeypatch.setattr(settings, "storage_profile_dir", root)
    monkeypatch.setattr(settings, "storage_layout_version", 3)
    monkeypatch.setattr(settings, "data_dir", root / "data")
    monkeypatch.setattr(settings, "templates_dir", TEMPLATES)
    monkeypatch.setattr(settings, "niches_path", TEMPLATES.parent.parent / "niches.json")
    monkeypatch.setattr(data, "_store", JsonDataStore())
    app = FastAPI()
    app.include_router(showcase.router, prefix="/api/v1")
    app.include_router(explainer.router, prefix="/api/v1")
    app.dependency_overrides[require_internal] = lambda: None
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        listing = await client.get("/api/v1/showcase/designs")
        assert listing.status_code == 200
        assert len(listing.json()["designs"]) == 19
        atlas = await client.get("/api/v1/showcase/designs/atlas-en-movimiento/catalog")
        assert atlas.status_code == 200
        assert atlas.json()["groups"][0]["label"] == "Textos"
        assert any(e["section"] == "sprites" for e in atlas.json()["entries"])
        for design_id, entry_id in [
            ("vida-en-escena", "characters.heladero"),
            ("atlas-en-movimiento", "label.chip"),
            ("cara-a-cara", "personajes.crear-personaje"),
        ]:
            url = f"/api/v1/showcase/designs/{design_id}/preview"
            before = await client.get(url, params={"entry": entry_id, "format": "9x16"}, follow_redirects=True)
            assert before.status_code == 200, (design_id, before.status_code, before.text[:100])
            result = await client.post(f"/api/v1/showcase/designs/{design_id}/promote")
            assert result.status_code == 200, result.text
            assert result.json()["state"] == "produccion"
            after = await client.get(url, params={"entry": entry_id, "format": "9x16"}, follow_redirects=True)
            assert after.status_code == 200
        assert (
            await client.get(
                "/api/v1/explainer/files/bundled/sandbox/nodehistory/atlas-en-movimiento/work/tactico/demo.html"
            )
        ).status_code == 404
        assert not (root / "designs").exists()
        assert not (root / "sandbox/designs").exists()


@pytest.mark.asyncio
async def test_v3_historical_examples_never_fall_back_to_another_profile(tmp_path, monkeypatch):
    from fastapi import FastAPI
    from httpx import ASGITransport, AsyncClient
    from src.adapters.data.json_store import JsonDataStore
    from src.config.settings import settings
    from src.presentation.api.routers import explainer, showcase
    import src.core.data as data

    root, other = tmp_path / "active", tmp_path / "other"
    root.mkdir()
    monkeypatch.setattr(settings, "storage_profile_dir", root)
    monkeypatch.setattr(settings, "storage_layout_version", 3)
    monkeypatch.setattr(settings, "data_dir", root / "data")
    monkeypatch.setattr(settings, "templates_dir", TEMPLATES)
    monkeypatch.setattr(settings, "niches_path", TEMPLATES.parent.parent / "niches.json")
    monkeypatch.setattr(data, "_store", JsonDataStore())

    def episode(profile, design, files):
        directory = profile / "sandbox/nodeaction" / design
        for name in files:
            path = directory / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text('synthetic', encoding='utf-8')

    cara_files = ["showcase.html", "showcase.js", "showcase-preview.html", "showcase/components.json",
                  "assets/scene.json", "config.json"]
    vida_files = ["index.html", "assets/episodes/catalogo-acciones.json"]
    episode(other, "cara-a-cara", cara_files)
    episode(other, "vida-en-escena", vida_files)
    atlas_key = '/api/v1/explainer/files/bundled/sandbox/nodehistory/atlas-en-movimiento/assets/media/A04.png'
    atlas_other = other / 'sandbox/nodehistory/atlas-en-movimiento/assets/media/A04.png'
    atlas_other.parent.mkdir(parents=True)
    atlas_other.write_text('other profile', encoding='utf-8')
    app = FastAPI()
    app.include_router(showcase.router, prefix="/api/v1")
    app.include_router(explainer.router, prefix="/api/v1")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        for ident, entry in [("cara-a-cara", "comparacion.dos-tarjetas"), ("vida-en-escena", "actions.idle")]:
            endpoint = f"/api/v1/showcase/designs/{ident}"
            catalog = (await client.get(endpoint + "/catalog")).json()["entries"]
            assert next(row for row in catalog if row["id"] == entry)["preview_url"] is None
            assert (await client.get(endpoint + "/preview", params={"entry": entry})).status_code == 404
        guide = await client.get('/api/v1/showcase/designs/cara-a-cara/preview',
                                 params={'entry': 'personajes.crear-personaje'})
        assert guide.status_code == 307 and '/bundled/sandbox/' in guide.headers['location']
        atlas_preview = '/api/v1/showcase/designs/atlas-en-movimiento/preview'
        assert (await client.get(atlas_preview, params={'entry': 'callout.photo'})).status_code == 404
        assert (await client.get(atlas_key)).status_code == 404
        # A symlink to another profile is not ownership.
        (root / 'sandbox/nodeaction').mkdir(parents=True)
        (root / 'sandbox/nodeaction/vida-en-escena').symlink_to(other / 'sandbox/nodeaction/vida-en-escena')
        assert (await client.get('/api/v1/showcase/designs/vida-en-escena/preview',
                                 params={'entry': 'actions.idle'})).status_code in (404, 422)
        (root / 'sandbox/nodeaction/vida-en-escena').unlink()
        episode(root, "cara-a-cara", cara_files)
        episode(root, "vida-en-escena", vida_files)
        cara = await client.get('/api/v1/showcase/designs/cara-a-cara/preview',
                                params={'entry': 'comparacion.dos-tarjetas'})
        assert cara.status_code == 307 and '/files/sandbox/nodeaction/cara-a-cara/' in cara.headers['location']
        assert (await client.get(cara.headers['location'])).text == 'synthetic'
        vida = await client.get('/api/v1/showcase/designs/vida-en-escena/preview', params={'entry': 'actions.idle'})
        assert vida.status_code == 307 and '/sandbox/nodeaction/_vida/' in vida.headers['location']
        own = await client.get('/api/v1/explainer/files/sandbox/nodeaction/vida-en-escena/index.html')
        assert own.status_code == 200 and own.text == 'synthetic'
        atlas = root / 'sandbox/nodehistory/atlas-en-movimiento/assets'
        for name in ('media/A04.png', 'fonts/AtlasEditorial.ttf'):
            target = atlas / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text('active profile', encoding='utf-8')
        assert (await client.get(atlas_key)).text == 'active profile'
        assert (await client.get(atlas_preview, params={'entry': 'callout.photo'})).status_code == 307
        (atlas / 'media/A04.png').unlink()
        (atlas / 'media/A04.png').symlink_to(atlas_other)
        assert (await client.get(atlas_key)).status_code == 404
        assert (await client.get(atlas_preview, params={'entry': 'callout.photo'})).status_code == 404


def test_reconcile_imports_legacy_state_idempotently_without_moving_files(tmp_path):
    import json
    import os
    import subprocess
    import sys

    root = tmp_path / "profile"
    old = root / "data/showcase/designs.json"
    old.parent.mkdir(parents=True)
    (root / "profile.json").write_text('{"schema_version":3}', encoding="utf-8")
    old.write_text('[{"id":"vida-en-escena","category":"nodeaction","state":"produccion"}]', encoding="utf-8")
    env = {"PATH": os.environ["PATH"], "XDG_CONFIG_HOME": str(tmp_path / "xdg"), "NEXA_ISOLATED_TOOL": "1"}
    command = [
        sys.executable,
        str(TEMPLATES.parent.parent / "scripts/reconcile-showcase-definitions.py"),
        "--profile-dir",
        str(root),
    ]

    def run(*args):
        result = subprocess.run([*command, *args], env=env, capture_output=True, text=True, timeout=30)
        assert result.returncode == 0, result.stderr
        return json.loads(result.stdout)

    assert len(run()["changes"]) == 19
    assert not (root / "data/json/designs.json").exists()
    assert len(run("--apply")["changes"]) == 19
    assert run()["changes"] == []
    section = json.loads((root / "data/json/designs.json").read_text())
    rows = section["collections"]["showcase_designs"]
    assert next(row for row in rows if row["id"] == "vida-en-escena")["state"] == "produccion"
    assert old.is_file()
    assert not (root / "designs").exists() and not (root / "sandbox/designs").exists()


def test_new_v3_profile_reconciles_all_19_shared_designs(tmp_path):
    import json
    import os
    import subprocess
    import sys

    project = TEMPLATES.parent.parent.parent
    home = tmp_path / "host"
    env = {"PATH": os.environ["PATH"], "XDG_CONFIG_HOME": str(tmp_path / "xdg"), "NEXA_ISOLATED_TOOL": "1"}
    init = subprocess.run(
        [
            sys.executable,
            str(project / "scripts/storage-profile.py"),
            "init",
            "empty",
            "--home",
            str(home),
            "--schema-version",
            "3",
        ],
        env=env,
        text=True,
        capture_output=True,
        timeout=30,
    )
    assert init.returncode == 0, init.stderr
    root = home / "profiles/empty"
    reconcile = subprocess.run(
        [
            sys.executable,
            str(project / "nexa-brief-server/scripts/reconcile-showcase-definitions.py"),
            "--profile-dir",
            str(root),
            "--apply",
        ],
        env=env,
        text=True,
        capture_output=True,
        timeout=30,
    )
    assert reconcile.returncode == 0, reconcile.stderr
    assert len(json.loads(reconcile.stdout)["changes"]) == 19
    rows = json.loads((root / "data/json/designs.json").read_text())["collections"]["showcase_designs"]
    assert len(rows) == 19 and len({row["id"] for row in rows}) == 19
    assert not (root / "designs").exists() and not (root / "sandbox/designs").exists()


def test_pure_legacy_state_conversion_preserves_status_and_rejects_unknown():
    from src.adapters.showcase.shared_definitions import load_shared_design_defaults
    from src.core.showcase.ports import ShowcaseInvalid
    from src.core.showcase.state_migration import convert_legacy_designs

    definitions = load_shared_design_defaults(TEMPLATES)
    before = {key: dict(value) for key, value in definitions.items()}
    rows = [{"id": "vida-en-escena", "state": "produccion"}]
    migrated = convert_legacy_designs(rows, definitions)
    assert len(migrated) == 19
    assert next(item for item in migrated if item["id"] == "vida-en-escena")["state"] == "produccion"
    assert definitions == before and rows == [{"id": "vida-en-escena", "state": "produccion"}]
    with pytest.raises(ShowcaseInvalid, match="sin definición"):
        convert_legacy_designs([{"id": "unregistered", "state": "produccion"}], definitions)
    with pytest.raises(ShowcaseInvalid, match="duplicado"):
        convert_legacy_designs(rows + rows, definitions)


def test_shared_contracts_do_not_embed_profile_episode_records():
    import json

    base = TEMPLATES / "_tools/design-definitions"
    contracts = sorted(base.glob("*/design.json"))
    assert len(contracts) == 19
    for path in contracts:
        design = json.loads(path.read_text())
        catalog = json.loads((path.parent / "catalog.json").read_text())
        assert design.get("episodes") == []
        encoded = json.dumps([design, catalog])
        assert '"production_id"' not in encoded and '"video_id"' not in encoded
        assert "/productions/" not in encoded and "/work/" not in encoded
