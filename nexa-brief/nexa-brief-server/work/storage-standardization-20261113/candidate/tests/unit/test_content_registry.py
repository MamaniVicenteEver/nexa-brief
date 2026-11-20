
import pytest

from src.config.settings import settings
from src.core import content_registry, execution_logs


@pytest.fixture
def profile(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "storage_profile_dir", tmp_path)
    monkeypatch.setattr(settings, "storage_layout_version", 2)
    monkeypatch.setattr(settings, "data_dir", tmp_path / "data")
    return tmp_path


@pytest.mark.asyncio
async def test_video_details_resources_and_logs_are_related_by_id(profile):
    await content_registry.upsert_video("video-1", "production-1", details={"title": "Title"})
    resource = await content_registry.register_resource("video-1", "productions/video-1/script.json", kind="script")
    log = await execution_logs.register_execution_log("logs/explainer/run.log", kind="production",
                                                       production_id="production-1", video_id="video-1")
    result = content_registry.get_video("video-1")
    assert result["production_id"] == "production-1"
    assert result["details"] == {"title": "Title"}
    assert result["resources"][0]["asset_id"] == resource["asset_id"]
    assert result["logs"][0]["log_id"] == log.log_id
    assert content_registry.resolve_resource(resource["asset_id"]) == profile / "productions/video-1/script.json"
    assert not content_registry.resolve_resource(resource["asset_id"]).exists()
    await content_registry.upsert_video("video-1", "production-2")
    assert content_registry.get_video("video-1")["details"] == {"title": "Title"}
    assert content_registry.resolve_resource("missing") is None


@pytest.mark.asyncio
async def test_resource_paths_cannot_escape_or_reference_system(profile, tmp_path):
    await content_registry.upsert_video("video-1", "production-1")
    for key in ("../other", "/tmp/other", "productions/../../other", ".system/connections/secret", "productions\\escape"):
        with pytest.raises(ValueError):
            await content_registry.register_resource("video-1", key, kind="script")
    (profile / "productions").mkdir()
    (profile / "productions/link").symlink_to(profile.parent, target_is_directory=True)
    with pytest.raises(ValueError):
        await content_registry.register_resource("video-1", "productions/link/other", kind="script")
    resource = await content_registry.register_resource("video-1", "productions/later/file", kind="script")
    (profile / "productions/later").symlink_to(profile.parent, target_is_directory=True)
    with pytest.raises(ValueError):
        content_registry.resolve_resource(resource["asset_id"])
    with pytest.raises(ValueError):
        await content_registry.register_resource("missing", "productions/video/file", kind="script")
    with pytest.raises(ValueError):
        content_registry.get_video("../other")


@pytest.mark.asyncio
async def test_resources_are_profile_scoped_and_asset_ids_cannot_be_reassigned(profile, monkeypatch, tmp_path):
    await content_registry.upsert_video("video-1", "p1")
    await content_registry.upsert_video("video-2", "p2")
    await content_registry.register_resource("video-1", "resources/a.jpg", kind="image", asset_id="asset1")
    with pytest.raises(ValueError):
        await content_registry.register_resource("video-2", "resources/b.jpg", kind="image", asset_id="asset1")
    second = tmp_path / "second"
    monkeypatch.setattr(settings, "storage_profile_dir", second)
    monkeypatch.setattr(settings, "data_dir", second / "data")
    assert content_registry.resolve_resource("asset1") is None
    assert content_registry.get_video("video-1") is None


@pytest.mark.asyncio
async def test_registry_is_unavailable_on_legacy_profile(monkeypatch):
    monkeypatch.setattr(settings, "storage_profile_dir", None)
    with pytest.raises(ValueError):
        await content_registry.upsert_video("v", "p")


@pytest.mark.asyncio
async def test_content_endpoints_range_security_and_catalog(profile, monkeypatch):
    from httpx import ASGITransport, AsyncClient
    from src.presentation.main import app
    api_client = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
    import anyio.to_thread
    # Avoid the environment's stalled AnyIO worker pool while exercising ASGI routing.
    async def run_inline(func, *args, **kwargs):
        return func(*args)
    monkeypatch.setattr(anyio.to_thread, "run_sync", run_inline)
    import json

    templates = profile / "definitions"
    monkeypatch.setattr(settings, "templates_dir", templates)
    def write_json(name, value):
        path = templates / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(value), encoding="utf-8")
    write_json("templates.json", {"templates": {"template1": {"defaults": {"secret": "ignored"}}}})
    write_json("_tools/explainer-kit/designs/index.json", {"designs": ["design1"]})
    write_json("_tools/sandbox/engines.json", [{"id": "engine1", "components": "engine/components.json"}])
    write_json("engine/components.json", {"comps": [{"name": "engine.scene", "params": {"default": "ignored"}}]})
    await content_registry.upsert_video("v1", "p1", details={"title": "Title"})
    path = profile / "resources/file.mp4"
    path.parent.mkdir()
    path.write_bytes(b"abcdefghij")
    await content_registry.register_resource("v1", "resources/file.mp4", kind="video", asset_id="asset1")
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "nexa_internal_token", "test-token")
    assert (await api_client.get("/api/v1/content/videos/v1")).status_code == 403
    headers = {"X-Nexa-Internal": "test-token"}
    video = await api_client.get("/api/v1/content/videos/v1", headers=headers)
    assert video.status_code == 200 and video.json()["resources"][0]["asset_id"] == "asset1"
    response = await api_client.get("/api/v1/content/resources/asset1/file", headers={**headers, "Range": "bytes=2-4"})
    assert response.status_code == 206 and response.content == b"cde"
    assert (await api_client.get("/api/v1/content/resources/missing/file", headers=headers)).status_code == 404
    from src.core.data import collection
    await collection("content_resources").insert({"asset_id": "bad", "video_id": "v1",
                                                   "storage_key": "../outside", "kind": "video"})
    assert (await api_client.get("/api/v1/content/resources/bad/file", headers=headers)).status_code == 404
    catalog = await api_client.get("/api/v1/content/catalog", headers=headers)
    data = catalog.json()
    assert catalog.status_code == 200
    assert data["templates"][0]["id"] == "template1"
    assert data["designs"][0]["id"] == "design1"
    assert data["engines"][0]["id"] == "engine1"
    assert data["components"][0]["id"] == "engine.scene"
    assert "ignored" not in catalog.text
    assert len(data["version"]) == 64
    assert (profile / "data/catalog/snapshots" / (data["version"] + ".json")).is_file()
    assert (await api_client.get("/api/v1/content/catalog", headers=headers)).json()["version"] == data["version"]
    monkeypatch.setattr(settings, "storage_profile_dir", None)
    assert (await api_client.get("/api/v1/content/videos/v1", headers=headers)).status_code == 404
    assert (await api_client.get("/api/v1/content/resources/asset1/file", headers=headers)).status_code == 404
    assert (await api_client.get("/api/v1/content/catalog", headers=headers)).status_code == 404

    await api_client.aclose()


@pytest.mark.asyncio
async def test_production_resources_appear_in_library_and_cannot_be_deleted(profile, monkeypatch):
    import anyio.to_thread
    from httpx import ASGITransport, AsyncClient
    from src.presentation.main import app
    from src.core.library import asset_library

    async def run_inline(func, *args, **kwargs):
        return func(*args)
    monkeypatch.setattr(anyio.to_thread, "run_sync", run_inline)
    await content_registry.upsert_video("v1", "p1", details={"title": "Historia de Bolivia"})
    kinds = {"images": ("image", "photo.jpg"), "music": ("music", "song.mp3"),
             "videos": ("video", "final.mp4"), "sounds": ("sound", "effect.wav")}
    for api_kind, (kind, filename) in kinds.items():
        path = profile / "productions/v1/assets" / filename
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(b"content")
        await content_registry.register_resource("v1", path.relative_to(profile), kind=kind, asset_id=kind + "1")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        for api_kind, (kind, filename) in kinds.items():
            listing = await client.get(f"/api/v1/library/{api_kind}", params={"q": "bolivia"})
            assert listing.status_code == 200
            row = next(item for item in listing.json() if item["asset_id"] == kind + "1")
            assert row["source"] == "production" and row["video_id"] == "v1"
            assert row["production_id"] == "p1" and row["production_name"] == "Historia de Bolivia"
            assert row["description"] == "Historia de Bolivia · v1"
            assert (await client.get(f"/api/v1/library/{api_kind}/{kind}1")).status_code == 200
            response = await client.get(f"/api/v1/library/{api_kind}/{kind}1/file", headers={"Range": "bytes=0-2"})
            assert response.status_code == 206 and response.content == b"con"
            if kind == "music":
                assert (await client.post("/api/v1/library/music/music1/transcribe")).status_code == 409
            assert (await client.patch(f"/api/v1/library/{api_kind}/{kind}1", json={"description": "edit"})).status_code == 409
            assert (await client.delete(f"/api/v1/library/{api_kind}/{kind}1")).status_code == 409
            assert (profile / "productions/v1/assets" / filename).read_bytes() == b"content"
    monkeypatch.setattr(settings, "storage_profile_dir", None)
    assert not any(e.asset_id == "image1" for e in asset_library.search_assets("image"))


@pytest.mark.asyncio
async def test_linked_assets_resolve_in_pipeline_and_preserve_cache_metadata(profile):
    from src.core.library import asset_library, sound_library, transcription

    await content_registry.upsert_video("v1", "p1", details={"title": "Video"})
    items = {"image": "a.jpg", "music": "b.mp3", "video": "c.mp4", "sound": "d.wav"}
    for kind, name in items.items():
        path = profile / "productions/v1/assets" / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(b"data")
        await content_registry.register_resource("v1", path.relative_to(profile), kind=kind, asset_id=kind + "1")
    for kind in ("image", "music", "video"):
        entry = getattr(asset_library, f"get_{kind}_entry")(kind + "1")
        path = getattr(asset_library, f"resolve_{kind}_path")(kind + "1")
        assert entry.video_id == "v1" and path.read_bytes() == b"data"
    assert sound_library.get_sound("sound1").video_id == "v1"
    assert sound_library.resolve_sound_path("sound1").read_bytes() == b"data"
    assert any(e.asset_id == "sound1" for e in sound_library.search_sounds())
    assert not sound_library.search_sounds(approved_only=True)
    await asset_library.update_asset_metadata("sound", "sound1", {"approval_status": "approved"})
    assert any(e.asset_id == "sound1" for e in sound_library.search_sounds(approved_only=True))
    assert (await sound_library.mark_sound_used("sound1")).usage_count == 1

    await asset_library.save_vision_cache("image1", {"subject": "scene"})
    await asset_library.save_video_vision_cache("video1", {"scene": "clip"})
    await asset_library.touch_usage("image1", "image")
    assert asset_library.get_image_entry("image1").has_vision_cache
    assert asset_library.get_image_entry("image1").usage_count == 1
    assert asset_library.get_video_entry("video1").has_vision_cache

    class Transcriber:
        async def transcribe(self, path, language=None):
            assert path == profile / "productions/v1/assets/b.mp3"
            return {"metadata": {"language": "es"}, "segments": []}
    result, cached = await transcription.ensure_lyrics("music1", asset_library.resolve_music_path("music1"), Transcriber)
    assert not cached and result["metadata"]["language"] == "es"
    entry = asset_library.get_music_entry("music1")
    assert entry.has_lyrics_cache and entry.transcription_status == "done" and entry.language == "es"
    assert asset_library.get_lyrics_cache("music1") == result
    await content_registry.register_resource("v1", "productions/v1/assets/b.mp3", kind="music", asset_id="music1")
    assert asset_library.get_music_entry("music1").has_lyrics_cache


@pytest.mark.asyncio
async def test_v3_legacy_resource_alias_resolves_range_and_rejects_escape(profile, monkeypatch):
    import hashlib
    import anyio.to_thread
    from httpx import ASGITransport, AsyncClient
    from src.core.data import documents
    from src.presentation.main import app

    monkeypatch.setattr(settings, 'storage_layout_version', 3)
    async def run_inline(func, *args, **kwargs):
        return func(*args)
    monkeypatch.setattr(anyio.to_thread, 'run_sync', run_inline)
    await content_registry.upsert_video('v1', 'p1')
    old = 'renders/v1/legacy-template/original.mp4'
    target = profile / 'renders/videos/nodetech/v1/r1/16x9/video.mp4'
    target.parent.mkdir(parents=True)
    target.write_bytes(b'synthetic video')
    await content_registry.register_resource('v1', old, kind='video', asset_id='asset1')
    alias_id = hashlib.sha256(old.encode()).hexdigest()
    aliases = documents('legacy_path_aliases')
    aliases.put(alias_id, {'legacy_key': old, 'storage_key': str(target)})
    async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as client:
        response = await client.get('/api/v1/library/videos/asset1/file', headers={'Range': 'bytes=0-8'})
        assert response.status_code == 206 and response.content == b'synthetic'
        aliases.put(alias_id, {'legacy_key': old, 'storage_key': '/tmp/outside-profile.mp4'})
        assert (await client.get('/api/v1/library/videos/asset1/file')).status_code == 404
        link = profile / 'renders/link'
        link.symlink_to(profile.parent, target_is_directory=True)
        aliases.put(alias_id, {'legacy_key': old, 'storage_key': 'renders/link/private.mp4'})
        assert (await client.get('/api/v1/library/videos/asset1/file')).status_code == 404
        aliases.put(alias_id, {'legacy_key': 'different', 'storage_key': str(target)})
        assert (await client.get('/api/v1/library/videos/asset1/file')).status_code == 404
