"""Category isolation and mixed-media contracts, with isolated persistence."""
from types import SimpleNamespace
from pathlib import Path
from src.config.settings import settings
from src.config import template_manifest
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from src.core.data import collection
from src.core.job import AssetSourceType
from src.core.library import asset_library
from src.core.library.background_source import with_selected_background
from src.core.library.provenance_migration import migrate_provenance
from src.config.niche_config import find_niche_by_template_id
from src.config.template_manifest import get_template_inputs
from src.presentation.api.routers import library

@pytest.fixture(autouse=True)
def catalog(monkeypatch):
    monkeypatch.setattr(settings, "templates_dir", Path(__file__).resolve().parents[2] / "src/templates")
    template_manifest._load_catalog.cache_clear()
    template_manifest._load_manifest.cache_clear()
    yield
    template_manifest._load_catalog.cache_clear()
    template_manifest._load_manifest.cache_clear()

@pytest.fixture
def client(monkeypatch):
    async def probe(_):
        return {"duration_seconds": 2, "width": 64, "height": 32}
    monkeypatch.setattr(asset_library, "probe_media", probe)
    app = FastAPI()
    app.include_router(library.router, prefix="/api/v1")
    with TestClient(app) as client:
        yield client

@pytest.mark.parametrize("kind,suffix,mime,media_type", [
    ("images", "png", "image/png", "image"), ("videos", "mp4", "video/mp4", "video"),
    ("music", "mp3", "audio/mpeg", "music"), ("sounds", "wav", "audio/wav", "sound"),
])
def test_upload_records_owner_and_filters_category(client, kind, suffix, mime, media_type):
    result = client.post(f"/api/v1/library/{kind}", files={"file": (f"asset.{suffix}", b"test resource", mime)},
                        data={"category": "node_motion", "template_id": "lyrics-romantic", "transcribe": "false"})
    assert result.status_code == 201, result.text
    resource = result.json()
    assert resource["category_id"] == "node_motion"
    assert resource["category_name"] == "NodeMotion"
    assert resource["template_id"] == "lyrics-romantic"
    assert resource["template_name"]
    assert resource["media_type"] == media_type
    for category in ("node_motion", "NodeMotion", "nodemotion"):
        assert len(client.get(f"/api/v1/library/{kind}", params={"category": category}).json()) == 1
    assert client.get(f"/api/v1/library/{kind}", params={"category": "node_history"}).json() == []
    assert len(client.get(f"/api/v1/library/{kind}").json()) == 1


def test_unknown_or_mismatched_template_does_not_create_an_asset(client):
    for category, template in (("node_motion", "does-not-exist"), ("node_tech", "lyrics-impact")):
        result = client.post("/api/v1/library/images", files={"file": ("x.png", b"x", "image/png")},
                             data={"category": category, "template_id": template})
        assert result.status_code == 422
    assert client.get("/api/v1/library/images").json() == []


def test_same_song_keeps_both_origins_without_duplicate_file(client):
    def upload(category, template=None):
        return client.post("/api/v1/library/music", files={"file": ("x.mp3", b"same song", "audio/mpeg")},
                           data={"category": category, "template_id": template or "", "transcribe": "false"})
    first = upload("node_tech")
    second = upload("node_motion", "lyrics-impact")
    assert first.status_code == 201 and second.status_code == 200
    assert first.json()["asset_id"] == second.json()["asset_id"]
    assert len(second.json()["resource_origins"]) == 2
    assert len(client.get("/api/v1/library/music").json()) == 1
    for category in ("node_tech", "node_motion"):
        assert len(client.get("/api/v1/library/music", params={"category": category}).json()) == 1

@pytest.mark.parametrize("template_id", ["lyrics-impact", "lyrics-romantic", "lyrics-suave", "lyrics-triste"])
def test_image_background_accepts_video_without_mutating_template(template_id):
    req = get_template_inputs(template_id)
    assert req["media"][0]["kind"] == "image|video"
    niche = find_niche_by_template_id(template_id)
    original = niche.model_dump()
    job = SimpleNamespace(input=SimpleNamespace(video_source=object(), image_source=SimpleNamespace(type=AssetSourceType.AUTO)))
    selected = with_selected_background(niche, job)
    assert selected.template.requires_video and not selected.template.requires_image
    assert selected.template.media_src_filename == "bg.mp4"
    assert niche.model_dump() == original
    job.input.video_source = None
    job.input.image_source.type = AssetSourceType.LIBRARY
    selected = with_selected_background(niche, job)
    assert selected.template.requires_image and not selected.template.requires_video
    assert selected.template.media_src_filename == "bg.jpg"

@pytest.mark.asyncio
async def test_migration_uses_evidence_and_is_resumable():
    # Unknown historical uploads must not be silently attributed to NodeMotion.
    await collection("image_assets").insert({"asset_id": "unknown", "category": "uploads", "relative_path": "x", "source": "upload"})
    await collection("image_assets").insert({"asset_id": "known", "category": "uploads", "relative_path": "y", "source": "upload"})
    await collection("drafts").insert({"draft_id": "test", "template_id": "lyrics-impact", "inputs": {"image_asset_id": "known"}})
    report = await migrate_provenance()
    assert report == {"updated": 2, "classified": 1, "unclassified": 1}
    assert "media_type" not in collection("image_assets").get("known")
    await migrate_provenance(apply=True)
    assert collection("image_assets").get("known")["category_id"] == "node_motion"
    assert collection("image_assets").get("unknown")["category_id"] == ""
    assert (await migrate_provenance())["updated"] == 0

@pytest.mark.asyncio
@pytest.mark.parametrize("template_id", ["lyrics-impact", "lyrics-romantic", "lyrics-suave", "lyrics-triste"])
async def test_prepared_config_uses_actual_video_type(template_id, tmp_path, monkeypatch):
    from src.core.job import Job, JobInput, JobArtifacts, VideoSource
    from src.modules import html_generator
    niche = find_niche_by_template_id(template_id)
    niche = niche.model_copy(update={"template": niche.template.model_copy(update={"static_config": True})})
    job = Job(job_id="mixed-media-test", input=JobInput(category_name=niche.id,
              video_source=VideoSource(type=AssetSourceType.LIBRARY, asset_id="selected-video")),
              artifacts=JobArtifacts(output_dir=tmp_path))
    niche = with_selected_background(niche, job)
    monkeypatch.setattr(html_generator, "copy_template_runtime_assets", lambda *args: [])
    result = await html_generator.run(job, None, niche)
    assert result.artifacts.template_config["bg"]["type"] == "video"
    assert result.artifacts.template_config["bg"]["src"] == "bg.mp4"
    assert result.artifacts.config_json_path.is_file()

@pytest.mark.asyncio
async def test_scoped_library_skips_other_production_details_and_global_query_reuses_them(monkeypatch):
    monkeypatch.setattr(asset_library, "layout_for_settings", lambda _: SimpleNamespace(schema_version=3))
    await collection("content_videos").insert({"video_id": "tech-video", "production_id": "tech"})
    for index in range(12):
        await collection("content_resources").insert({
            "asset_id": f"tech-{index}", "video_id": "tech-video", "kind": "video",
            "storage_key": f"productions/nodetech/episode/clip-{index}.mp4",
        })
    class Details:
        calls = 0
        def get(self, video_id):
            self.calls += 1
            return {"title": "Production"}
    details = Details()
    monkeypatch.setattr(asset_library, "documents", lambda _: details)
    assert asset_library.search_assets("video", category="node_motion") == []
    assert details.calls == 0
    result = asset_library.search_assets("video")
    assert len(result) == 12
    assert all(entry.category_id == "node_tech" for entry in result)
    assert details.calls == 1
