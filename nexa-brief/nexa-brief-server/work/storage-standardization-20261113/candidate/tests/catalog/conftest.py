"""Isolated catalogue contracts; no full application startup or real writes."""
import json

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from src.adapters.catalog.media import RepositoryCatalogMedia
from src.adapters.catalog.repository import FilesystemCatalogRepository, JsonCategoryRepository
from src.core.catalog.service import CatalogService
from src.presentation.api.routers.catalog import router, catalog_media, catalog_service


@pytest.fixture
def sample(tmp_path):
    templates = tmp_path / "templates"
    templates.mkdir()
    config = tmp_path / "niches.json"
    config.write_text(json.dumps({"categories": {
        "history": {"display_name": "History", "folder": "nodehistory", "engine": "explainer_kit", "designs": ["ink"]},
        "tech": {"display_name": "Tech", "folder": "nodetech", "shared_designs": ["ink"]},
    }, "niches": {}}))
    def demo(name, public=True):
        directory = templates / "nodehistory" / name
        (directory / "render").mkdir(parents=True)
        (directory / "index.html").write_text('<script src="/api/v1/explainer/files/bundled/_tools/player/player.js"></script>')
        (directory / "manifest.json").write_text(json.dumps({"demo": public, "design": "ink", "title": name}))
        (directory / "render/poster.jpg").write_bytes(b"poster")
        return directory
    public = demo("public-demo")
    private = demo("private-episode", False)
    media = RepositoryCatalogMedia(templates)
    categories = JsonCategoryRepository(config)
    repo = FilesystemCatalogRepository(templates, categories, media)
    service = CatalogService(repo, categories)
    return templates, public, private, media, service


@pytest.fixture
async def client(sample):
    app = FastAPI()
    app.include_router(router, prefix="/api/v1")
    app.dependency_overrides[catalog_media] = lambda: sample[3]
    app.dependency_overrides[catalog_service] = lambda: sample[4]
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client
