"""The public contract uses stable identities and provider-independent URLs."""
from copy import deepcopy
from urllib.parse import parse_qs, urlsplit

import pytest
from httpx import ASGITransport, AsyncClient

from src.config.settings import settings
from src.core.showcase.ports import ShowcaseConflict
from src.core.showcase.service import ShowcaseService
from src.presentation.api.routers.showcase import get_showcase_service
from src.presentation.main import app


class FakeShowcase:
    def __init__(self, root):
        self.root = root
        self.promotions = 0
        self.target = "/api/v1/explainer/files/_tools/explainer-kit/showcase/stage.html?d=rough&c=rough.icon"
        self.design = {"id": "vida-en-escena", "name": "Vida", "category": "nodeaction",
                       "state": "prueba", "family": "vida", "engine_id": "vida", "description": "",
                       "revision": "r1", "preview_url": "/api/v1/explainer/files/sandbox/nodeaction/_vida/index.html",
                       "promotable": True, "promote_blocker": None,
                       "episodes": [{"id": "episodio-real", "title": "Ejemplo", "design_id": "vida-en-escena",
                                     "preview_url": "/api/v1/explainer/files/sandbox/nodeaction/episodio/index.html"}]}
        self.entries = [{"id": "vida.escena", "name": "vida.escena", "label": "Escena", "kind": "component",
                         "summary": "", "tags": [], "params": {}, "example": {}, "preview_url": self.target,
                         "preview_kind": "iframe"}]

    def list_designs(self):
        return [deepcopy(self.design)]

    def get_design(self, design_id):
        return deepcopy(self.design) if design_id == self.design["id"] else None

    def get_catalog(self, design_id):
        return {"schema_version": 1, "design_id": design_id, "revision": self.design["revision"],
                "entries": deepcopy(self.entries)}

    def preview(self, design_id, entry_id, format):
        return self.target

    def resolve_file(self, design_id, path):
        return self.root / path if path == "index.html" else None

    def promote(self, design_id):
        self.promotions += 1
        if self.design["state"] == "produccion":
            return deepcopy(self.design)
        if not self.design["promotable"]:
            raise ShowcaseConflict("conflict")
        self.design["state"] = "produccion"
        self.design["promotable"] = False
        self.design["preview_url"] = "/api/v1/showcase/designs/vida-en-escena/files/index.html"
        self.target = "/api/v1/showcase/designs/vida-en-escena/files/index.html"
        return deepcopy(self.design)


@pytest.fixture
async def api(tmp_path, monkeypatch):
    import anyio.to_thread

    async def inline(func, *args, **kwargs):
        return func(*args)

    monkeypatch.setattr(anyio.to_thread, "run_sync", inline)
    repository = FakeShowcase(tmp_path)
    (tmp_path / "index.html").write_text("<html>demo</html>")
    app.dependency_overrides[get_showcase_service] = lambda: ShowcaseService(repository)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client, repository
    app.dependency_overrides.pop(get_showcase_service, None)


@pytest.mark.asyncio
async def test_same_contract_and_stable_links_through_promotion(api):
    client, repository = api
    listing = (await client.get("/api/v1/showcase/designs")).json()
    assert listing["schema_version"] == 1
    design = listing["designs"][0]
    assert design["category"] == "nodeaction" and design["state"] == "prueba"
    assert design["episodes"][0]["id"] == "episodio-real"
    catalog_url = design["catalog_url"]
    catalog = (await client.get(catalog_url)).json()
    entry = catalog["entries"][0]
    assert catalog["design_id"] == design["id"] and catalog["revision"] == design["revision"]
    assert entry["id"] == "vida.escena" and entry["preview_kind"] == "iframe"
    entry_url = catalog_url + "/vida.escena"
    assert (await client.get(entry_url)).json() == entry
    assert (await client.get(catalog_url + "/missing")).status_code == 404
    stable = entry["preview_url"]
    assert (await client.get(stable, follow_redirects=False)).headers["location"] == repository.target
    promoted = await client.post("/api/v1/showcase/designs/vida-en-escena/promote")
    assert promoted.status_code == 200 and promoted.json()["state"] == "produccion"
    assert promoted.json()["id"] == design["id"] and promoted.json()["episodes"][0]["id"] == "episodio-real"
    assert (await client.get(catalog_url)).json()["entries"][0]["preview_url"] == stable
    assert (await client.get(entry_url)).json()["preview_url"] == stable
    target = await client.get(stable, follow_redirects=False)
    assert target.headers["location"] == "/api/v1/showcase/designs/vida-en-escena/files/index.html"
    assert (await client.get(target.headers["location"])).text == "<html>demo</html>"
    retried = await client.post("/api/v1/showcase/designs/vida-en-escena/promote")
    assert retried.status_code == 200 and retried.json()["id"] == design["id"]


@pytest.mark.asyncio
async def test_invalid_destinations_and_unknown_resources_are_rejected(api):
    client, repository = api
    path = "/api/v1/showcase/designs/vida-en-escena/preview"
    assert (await client.get(path, params={"entry": "inexistente"})).status_code == 404
    assert (await client.get(path, params={"format": "4x5"})).status_code == 422
    for target in ("https://example.org/file", "//example.org/file", "/api/v1/explainer/files/../secret",
                   "/api/v1/explainer/files/%2e%2e/secret", "/api/v1/explainer/files/a?js=https://example.org/a.js",
                   "/api/v1/explainer/files/a?js=../../../../../../private.js"):
        repository.target = target
        assert (await client.get(path, follow_redirects=False)).status_code == 422
    assert (await client.get("/api/v1/showcase/designs/missing")).status_code == 404
    assert (await client.get("/api/v1/showcase/designs/vida-en-escena/files/.secret")).status_code == 422


@pytest.mark.asyncio
async def test_promotion_requires_internal_auth(api, monkeypatch):
    client, repository = api
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "nexa_internal_token", "fixture-internal")
    response = await client.post("/api/v1/showcase/designs/vida-en-escena/promote")
    assert response.status_code == 403 and repository.promotions == 0
    response = await client.post("/api/v1/showcase/designs/vida-en-escena/promote",
                                 headers={"X-Nexa-Internal": "fixture-internal"})
    assert response.status_code == 200 and repository.promotions == 1


@pytest.mark.parametrize("layout_version", [1, 2, 3])
@pytest.mark.asyncio
async def test_bundled_design_catalog_and_preview_on_both_layouts(tmp_path, monkeypatch, layout_version):
    import anyio.to_thread

    async def inline(func, *args, **kwargs):
        return func(*args)

    monkeypatch.setattr(anyio.to_thread, "run_sync", inline)
    monkeypatch.setattr(settings, "storage_profile_dir", tmp_path / "profile")
    monkeypatch.setattr(settings, "storage_layout_version", layout_version)
    monkeypatch.setattr(settings, "data_dir", tmp_path / "profile/data")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/showcase/designs/rough")
        assert response.status_code == 200
        design = response.json()
        assert design["state"] == "produccion" and not design["promotable"]
        catalog_response = await client.get(design["catalog_url"])
        assert catalog_response.status_code == 200
        entry = next(item for item in catalog_response.json()["entries"] if item["id"] == "rough.introv2")
        redirect = await client.get(entry["preview_url"], follow_redirects=False)
        assert redirect.status_code == 307
        query = parse_qs(urlsplit(redirect.headers["location"]).query)
        assert query["clock"] == ["synthetic"] and query["controls"] == ["1"]
        assert query["format"] == ["9x16"] and query["c"] == ["rough.introv2"]
        wide = await client.get("/api/v1/showcase/designs/rough/preview",
                                params={"entry": "rough.introv2", "format": "16x9"}, follow_redirects=False)
        assert parse_qs(urlsplit(wide.headers["location"]).query)["format"] == ["16x9"]
        assert (await client.get(redirect.headers["location"])).status_code == 200
        if layout_version < 3:
            assert (await client.post("/api/v1/showcase/designs/rough/promote")).status_code == 409

        catalog = (await client.get("/api/v1/showcase/designs/imperio/catalog")).json()
        imperial = next(item for item in catalog["entries"] if item["preview_url"])
        response = await client.get(imperial["preview_url"], follow_redirects=False)
        imperial_query = parse_qs(urlsplit(response.headers["location"]).query)
        assert imperial_query["clock"] == ["synthetic"] and imperial_query["isolated"] == ["1"]


@pytest.mark.asyncio
async def test_bootstrapped_design_through_api_keeps_catalog_and_episode_ids(tmp_path, monkeypatch):
    import anyio.to_thread
    from src.adapters.showcase.bootstrap import bootstrap
    from src.adapters.showcase.filesystem import FilesystemShowcaseAdapter

    async def inline(func, *args, **kwargs):
        return func(*args)

    monkeypatch.setattr(anyio.to_thread, "run_sync", inline)
    monkeypatch.setattr(settings, "storage_profile_dir", tmp_path / "profile")
    monkeypatch.setattr(settings, "storage_layout_version", 2)
    monkeypatch.setattr(settings, "data_dir", tmp_path / "profile/data")
    adapter = FilesystemShowcaseAdapter.from_settings()
    assert bootstrap(adapter, apply=True, confirm_ownership=True)["status"] == "created"
    app.dependency_overrides[get_showcase_service] = lambda: ShowcaseService(adapter)
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/v1/showcase/designs/vida-en-escena")
            assert response.status_code == 200
            before = response.json()
            assert before["state"] == "prueba" and before["promotable"]
            assert (await client.get(before["preview_url"], follow_redirects=True)).status_code == 200
            assert all(episode["preview_url"] is None for episode in before["episodes"])
            catalog = (await client.get(before["catalog_url"])).json()
            assert catalog["entries"]
            entries = [(item["id"], item["params"], item["example"]) for item in catalog["entries"]]
            symbol = next(item for item in catalog["entries"] if item["id"] == "fx.symbol-question")
            symbol_redirect = await client.get(symbol["preview_url"], follow_redirects=False)
            assert parse_qs(urlsplit(symbol_redirect.headers["location"]).query)["only"] == ["fx.?"]
            episode_ids = [episode["id"] for episode in before["episodes"]]
            entry = next(item for item in catalog["entries"] if item["preview_url"])
            original_url = entry["preview_url"]
            assert (await client.get(original_url, follow_redirects=False)).status_code == 307
            assert (await client.get(original_url, follow_redirects=True)).status_code == 200
            promoted = await client.post("/api/v1/showcase/designs/vida-en-escena/promote")
            assert promoted.status_code == 200
            assert promoted.json()["state"] == "produccion"
            assert [episode["id"] for episode in promoted.json()["episodes"]] == episode_ids
            catalog_after = (await client.get(before["catalog_url"])).json()
            assert [(item["id"], item["params"], item["example"]) for item in catalog_after["entries"]] == entries
            assert next(item for item in catalog_after["entries"] if item["id"] == entry["id"])["preview_url"] == original_url
            assert (await client.get(original_url, follow_redirects=False)).status_code == 307
            assert (await client.get(original_url, follow_redirects=True)).status_code == 200
            assert (await client.get(promoted.json()["preview_url"], follow_redirects=True)).status_code == 200
            assert (await client.post("/api/v1/showcase/designs/vida-en-escena/promote")).status_code == 200
    finally:
        app.dependency_overrides.pop(get_showcase_service, None)
