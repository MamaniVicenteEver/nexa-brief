"""Duplicate visual uploads and editable display names through the library API."""
from __future__ import annotations

import asyncio
from pathlib import Path

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from fastapi import FastAPI

from src.config.settings import settings
from src.core.data import collection
from src.core.library import asset_library, resource_metadata
from src.presentation.api.routers import library


@pytest_asyncio.fixture
async def client(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "data_dir", tmp_path / "data")
    monkeypatch.setattr(settings, "storage_profile_dir", None)
    monkeypatch.setattr(settings, "shared_connections_dir", None)
    monkeypatch.setattr(settings, "app_env", "test")
    monkeypatch.setattr(settings, "nexa_internal_token", "")

    class Context:
        def resolve(self, category, template_id):
            if category == "uploads":
                return None
            return resource_metadata.ResourceOrigin(category_id=category, category_name=category,
                                                    template_id=template_id, template_name=template_id)
    monkeypatch.setattr(resource_metadata, "context_port", lambda: Context())
    async def probe(_):
        return {"width": 64, "height": 32, "duration_seconds": 2}
    monkeypatch.setattr(asset_library, "probe_media", probe)
    app = FastAPI()
    app.include_router(library.router, prefix="/api/v1")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.mark.parametrize("kind,filename,mime", [("images", "scene.png", "image/png"),
                                                  ("videos", "scene.mp4", "video/mp4")])
@pytest.mark.asyncio
async def test_same_name_content_and_scope(client, kind, filename, mime):
    async def upload(payload, category="node_motion", template="a", name=filename):
        return await client.post(f"/api/v1/library/{kind}", files={"file": (name, payload, mime)},
                           data={"category": category, "template_id": template})

    first = await upload(b"first")
    assert first.status_code == 201, first.text
    duplicate = await upload(b"first", template="b", name=filename.upper())
    assert duplicate.status_code == 200, duplicate.text
    assert duplicate.json()["asset_id"] == first.json()["asset_id"]
    assert len(duplicate.json()["resource_origins"]) == 2
    conflict = await upload(b"other")
    assert conflict.status_code == 409
    assert "Ya existe" in conflict.json()["detail"]
    assert (await client.get(first.json()["file_url"])).content == b"first"
    other_category = await upload(b"other", category="node_history")
    assert other_category.status_code == 201, other_category.text
    assert len((await client.get(f"/api/v1/library/{kind}")).json()) == 2
    assert len((await client.get(f"/api/v1/library/{kind}", params={"category": "node_motion"})).json()) == 1
    assert len((await client.get(f"/api/v1/library/{kind}", params={"category": "node_history"})).json()) == 1


@pytest.mark.parametrize("kind,filename,mime", [("images", "scene.png", "image/png"),
                                                  ("videos", "scene.mp4", "video/mp4")])
@pytest.mark.asyncio
async def test_display_name_patch_preserves_identity_and_search(client, kind, filename, mime):
    created = (await client.post(f"/api/v1/library/{kind}", files={"file": (filename, b"first", mime)},
                          data={"category": "node_motion"})).json()
    assert created["display_name"]
    identifier = created["asset_id"]
    response = await client.patch(f"/api/v1/library/{kind}/{identifier}", json={"display_name": "Fondo de neón"})
    assert response.status_code == 200, response.text
    assert response.json()["display_name"] == "Fondo de neón"
    assert response.json()["original_filename"] == filename
    assert response.json()["label"] == created["label"]
    assert len((await client.get(f"/api/v1/library/{kind}", params={"q": "neon"})).json()) == 1
    assert (await client.patch(f"/api/v1/library/{kind}/{identifier}", json={"display_name": "   "})).status_code == 422


@pytest.mark.asyncio
async def test_legacy_entries_get_name_without_mutating_record(client):
    async def insert():
        await collection("image_assets").insert({"asset_id": "legacy", "category": "uploads", "source": "upload",
                                                "relative_path": "uploads/old.png", "label": "An old image"})
    await insert()
    result = await client.get("/api/v1/library/images/legacy")
    assert result.status_code == 200
    assert result.json()["display_name"] == "An old image"
    assert "display_name" not in collection("image_assets").get("legacy")


@pytest.mark.asyncio
async def test_concurrent_same_name_has_one_record(client, tmp_path):
    source = tmp_path / "file.png"
    source.write_bytes(b"same")
    kwargs = dict(category="node_motion", template_id="", filename="file.png", label="file", description="", tags="")
    results = await asyncio.gather(*(asset_library.register_uploaded_visual("image", source, **kwargs) for _ in range(2)))
    assert sorted(created for _, created in results) == [False, True]
    assert results[0][0].asset_id == results[1][0].asset_id
    assert len(collection("image_assets").list()) == 1


@pytest.mark.asyncio
@pytest.mark.parametrize("kind,filename,mime", [("music", "song.mp3", "audio/mpeg"),
                                                  ("sounds", "effect.wav", "audio/wav")])
async def test_audio_display_name_is_independent(client, kind, filename, mime):
    created = await client.post(f"/api/v1/library/{kind}", files={"file": (filename, b"audio", mime)},
                                data={"category": "node_motion", "transcribe": "false"})
    assert created.status_code == 201, created.text
    item = created.json()
    assert item["display_name"]
    changed = await client.patch(f"/api/v1/library/{kind}/{item['asset_id']}", json={"display_name": "Nombre nuevo"})
    assert changed.status_code == 200, changed.text
    assert changed.json()["display_name"] == "Nombre nuevo"
    assert changed.json()["original_filename"] == filename
    assert len((await client.get(f"/api/v1/library/{kind}", params={"q": "nombre nuevo"})).json()) == 1


def test_same_name_upload_across_processes(tmp_path):
    import json
    import os
    import subprocess
    import sys

    source = tmp_path / "input.png"
    source.write_bytes(b"concurrent content")
    data = tmp_path / "data"
    program = '''
import asyncio, json, sys
from pathlib import Path
from src.config.settings import settings
from src.core.library import asset_library, resource_metadata
settings.data_dir = Path(sys.argv[1])
settings.storage_profile_dir = None
settings.shared_connections_dir = None
class Context:
    def resolve(self, category, template_id): return None
resource_metadata.context_port = lambda: Context()
async def probe(path): return {"width": 64, "height": 32}
asset_library.probe_media = probe
async def main():
    entry, created = await asset_library.register_uploaded_visual("image", Path(sys.argv[2]), category="uploads", template_id="", filename="file.png", label="file", description="", tags="")
    print(json.dumps({"id": entry.asset_id, "created": created}))
asyncio.run(main())
'''
    env = dict(os.environ)
    env["PYTHONPATH"] = str(Path(__file__).resolve().parents[2])
    processes = [subprocess.Popen([sys.executable, "-c", program, str(data), str(source)],
                                  stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env=env)
                 for _ in range(2)]
    outputs = [process.communicate(timeout=30) for process in processes]
    assert all(process.returncode == 0 for process in processes), outputs
    results = [json.loads(stdout.splitlines()[-1]) for stdout, _ in outputs]
    assert sorted(result["created"] for result in results) == [False, True]
    assert results[0]["id"] == results[1]["id"]
