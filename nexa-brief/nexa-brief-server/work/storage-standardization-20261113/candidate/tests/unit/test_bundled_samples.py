"""Explicit, profile-independent sample definitions and their real preview files."""
import json
from pathlib import Path
from urllib.parse import urlsplit

import pytest

from src.config.settings import settings
from src.core import content_catalog
from src.core.explainer import catalog as video_catalog


BUNDLED = Path(__file__).resolve().parents[2] / "src/templates"


@pytest.mark.asyncio
async def test_samples_are_previewable_and_separate_from_profile_videos(tmp_path, monkeypatch):
    import anyio.to_thread
    from httpx import ASGITransport, AsyncClient
    from src.presentation.main import app

    async def run_inline(func, *args, **kwargs):
        return func(*args)

    monkeypatch.setattr(anyio.to_thread, "run_sync", run_inline)
    monkeypatch.setattr(settings, "storage_layout_version", 2)
    monkeypatch.setattr(settings, "storage_profile_dir", tmp_path / "first")
    monkeypatch.setattr(settings, "data_dir", tmp_path / "first/data")
    monkeypatch.setattr(settings, "templates_dir", BUNDLED)
    first = content_catalog.snapshot_catalog()
    samples = {item["id"]: item for item in first["samples"]}
    component = samples["nodetech-rough-componentes"]
    long_form = samples["nodetech-rough-video-largo"]
    binary = samples["nodetech-binary-componentes"]
    assert component["available"] and component["component"] == "rough.introv2"
    assert long_form["available"] and long_form["rendered"] is False
    assert long_form["kind"] == "video-largo"
    assert binary["available"] and binary["shared_categories"] == ["node_history"]
    assert all(item.video_id not in samples for item in video_catalog.list_videos())
    assert video_catalog.get_video(long_form["id"]) is None

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        for item in (component, long_form):
            response = await client.get(item["preview_url"])
            assert response.status_code == 200
            assert b"<html" in response.content
        base = urlsplit(long_form["preview_url"]).path.rsplit("/", 1)[0]
        for name in ("config", "lyrics", "storyboard"):
            assert (await client.get(f"{base}/assets/{name}.json")).status_code == 200
        assert (await client.get("/api/v1/explainer/files/_tools/explainer-kit/showcase/samples/hamilton.jpg")).status_code == 200

    monkeypatch.setattr(settings, "storage_profile_dir", tmp_path / "second")
    monkeypatch.setattr(settings, "data_dir", tmp_path / "second/data")
    second = content_catalog.snapshot_catalog()
    assert second["samples"] == first["samples"]
    assert (tmp_path / "second/data/catalog/snapshots" / (second["version"] + ".json")).is_file()
    assert not (tmp_path / "second/productions").exists()


def test_sample_index_rejects_symlink_and_missing_media(tmp_path, monkeypatch):
    templates = tmp_path / "templates"
    profile = tmp_path / "profile"
    monkeypatch.setattr(settings, "storage_profile_dir", profile)
    monkeypatch.setattr(settings, "data_dir", profile / "data")
    monkeypatch.setattr(settings, "storage_layout_version", 2)
    monkeypatch.setattr(settings, "templates_dir", templates)
    sample_dir = templates / "nodetech/muestras/rough/componentes"
    sample_dir.mkdir(parents=True)
    index = templates / "nodetech/muestras/index.json"
    index.write_text(json.dumps({"samples": ["nodetech/muestras/rough/componentes/sample.json"]}))
    outside = tmp_path / "outside.json"
    outside.write_text(json.dumps({"id": "foreign", "category": "nodetech", "design": "rough", "kind": "componentes"}))
    sample = sample_dir / "sample.json"
    sample.symlink_to(outside)
    assert content_catalog.snapshot_catalog()["samples"] == []
    sample.unlink()
    sample.write_text(json.dumps({"id": "sample", "category": "nodetech", "design": "rough", "kind": "componentes", "component": "rough.introv2", "preview_file": "_tools/explainer-kit/showcase/stage.html", "required_files": ["../../outside"], "credits": "../../outside"}))
    item = content_catalog.snapshot_catalog()["samples"][0]
    assert not item["available"] and item["preview_url"] is None
