"""Exercise the public NodeMotion engine and selective contract endpoints."""
import pytest
from src.templates._tools.nodemotion.shared.assemble import assemble, design_ids, runtime_assets

@pytest.mark.parametrize("design_id", design_ids())
async def test_demo_and_source_use_the_same_canonical_engine(api_client, design_id):
    source = await api_client.get(f"/api/v1/templates/{design_id}/source")
    assert source.status_code == 200
    assert source.content == assemble(design_id)
    demo = await api_client.get(f"/api/v1/templates/{design_id}/showcase/index.html")
    assert demo.status_code == 200
    assert b'nodemotion-fragment:' not in demo.content
    assert b'nodemotion-design' not in demo.content

async def test_selective_components_and_missing_contract(api_client):
    response = await api_client.get("/api/v1/templates/lyrics-trazo/components")
    assert response.status_code == 200
    entries = response.json()["entries"]
    assert entries
    entry_id = entries[0]["id"]
    selected = await api_client.get(f"/api/v1/templates/lyrics-trazo/components/{entry_id}")
    assert selected.status_code == 200
    assert selected.json()["id"] == entry_id
    missing = await api_client.get("/api/v1/templates/lyrics-trazo/components/missing")
    assert missing.status_code == 404

async def test_legacy_runtime_urls_resolve_moved_english_sources(api_client):
    assets = runtime_assets("lyrics-trazo")
    for relative, canonical in assets.items():
        if canonical.suffix not in {".js", ".css"}:
            continue
        response = await api_client.get(f"/api/v1/templates/lyrics-trazo/showcase/{relative}")
        assert response.status_code == 200
        assert response.content == canonical.read_bytes()
    private = await api_client.get("/api/v1/templates/lyrics-trazo/showcase/%2e%2e%2f%2e%2e%2fAGENTS.md")
    assert private.status_code == 404
