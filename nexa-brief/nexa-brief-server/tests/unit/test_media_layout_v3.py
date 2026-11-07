"""Synthetic media and render paths; no live profile or credentials."""
import hashlib
from io import BytesIO
from pathlib import Path

import pytest
from PIL import Image

from src.adapters.data.local_publication_media import LocalPublicationMedia
from src.adapters.data.local_file_storage import LocalFileStorage
from src.config.content_paths import content_key, resolve_content_key
from src.config.media_paths import category_folder, image_key, pipeline_video_key, reel_key, video_key
from src.config.profile_layout import resolve_profile_layout
from src.config.settings import settings
from src.core.explainer.render_paths import full_render_files, latest_render


@pytest.fixture
def v3(tmp_path, monkeypatch):
    layout = resolve_profile_layout(tmp_path / "profile", 3)
    monkeypatch.setattr(settings, "storage_profile_dir", layout.root)
    monkeypatch.setattr(settings, "storage_layout_version", 3)
    monkeypatch.setattr(settings, "data_dir", layout.data_dir)
    monkeypatch.setattr(settings, "output_dir", layout.renders_dir)
    class Documents:
        values = {}
        def get(self, key): return self.values.get(key)
    docs = Documents()
    monkeypatch.setattr("src.core.data.documents", lambda name: docs)
    return layout, docs


def test_publication_assets_and_legacy_aliases(v3, monkeypatch):
    layout, docs = v3
    output = BytesIO()
    Image.new("RGB", (1080, 1350), "red").save(output, "JPEG")
    image = output.getvalue()
    digest = hashlib.sha256(image).hexdigest()
    key = image_key("nodetech", "post1", "pub1", "asset1")
    media = LocalPublicationMedia()
    media.put(key, image, "image/jpeg", digest)
    assert (layout.renders_dir / key).read_bytes() == image
    reel = b"0000ftyp" + b"synthetic"
    reel_hash = hashlib.sha256(reel).hexdigest()
    reel_path = reel_key("nodetech", "post1", "pub1", reel_hash)
    media.put(reel_path, reel, "video/mp4", reel_hash)
    assert (layout.renders_dir / reel_path).read_bytes() == reel
    legacy = "nodetech/2026/01/pub1/slides/01.jpg"
    docs.values[hashlib.sha256(legacy.encode()).hexdigest()] = {
        "legacy_key": legacy, "storage_key": key, "sha256": digest,
    }
    assert media.get(legacy).read() == image
    assert media.put(legacy, image, "image/jpeg", digest).key == legacy
    monkeypatch.setattr(settings, "publisher_encryption_key", "synthetic-key")
    monkeypatch.setattr(settings, "public_app_url", "https://synthetic.invalid")
    from src.adapters.publishing.instagram_media_url import create_signed_media_token, resolve_signed_media_token
    token = create_signed_media_token(legacy, expected_sha256=digest)
    assert resolve_signed_media_token(token).read_bytes() == image
    port_url = media.signed_url(legacy, "meta", 300, expected_sha256=digest)
    assert resolve_signed_media_token(port_url.rsplit("/", 1)[-1]).read_bytes() == image
    docs.values[hashlib.sha256(legacy.encode()).hexdigest()]["sha256"] = "0" * 64
    with pytest.raises(ValueError, match="hash"):
        media.get(legacy)
    assert not (layout.data_dir / "publicaciones").exists()


def test_video_paths_render_selection_and_invalid_keys(v3):
    layout, _ = v3
    production = layout.productions_dir / "nodetech" / "movie"
    production.mkdir(parents=True)
    for recording, preview in [("one", False), ("two", True)]:
        path = layout.renders_dir / video_key("nodetech", "movie", recording, "16x9", preview=preview)
        path.parent.mkdir(parents=True)
        path.write_bytes(b"video")
    expected = layout.renders_dir / video_key("nodetech", "movie", "one", "16x9")
    assert full_render_files(production) == [expected]
    assert latest_render(production, "16x9") == expected
    assert pipeline_video_key("node_motion/letras", "movie", "youtube", "16:9") == "videos/nodemotion/movie/movie-youtube-16x9/video.mp4"
    assert [category_folder(x) for x in ("node_tech", "node_history", "node_politics", "node_economy", "node_action", "node_motion", "node_atlas")] == ["nodetech", "nodehistory", "nodepolitics", "nodeeconomy", "nodeaction", "nodemotion", "nodeatlas"]
    for bad in ("../other", "/escape", "safe/../other", "one\\two"):
        with pytest.raises(ValueError):
            image_key(bad, "post1", "pub1", "asset1")


def test_library_resource_id_and_legacy_alias(v3, tmp_path, monkeypatch):
    layout, docs = v3
    storage = LocalFileStorage("music", "library/files/music")
    source = tmp_path / "source.mp3"
    source.write_bytes(b"synthetic-audio")
    key = storage.save_asset(source, asset_id="asset123", filename="track.mp3")
    assert key == "asset123/track.mp3"
    assert (layout.resources_dir / "music" / key).read_bytes() == b"synthetic-audio"
    class Records:
        def list(self, *, where):
            return [{"category": "ambient", "relative_path": key}] if where == {"category": "ambient"} else []
    monkeypatch.setattr("src.core.data.collection", lambda name: Records())
    assert storage.list_keys("ambient", suffix=".mp3") == [key]
    old = "ambient/old.mp3"
    old_key = "resources/music/" + old
    docs.values[hashlib.sha256(old_key.encode()).hexdigest()] = {
        "legacy_key": old_key, "storage_key": "resources/music/" + key,
        "sha256": hashlib.sha256(b"synthetic-audio").hexdigest(),
    }
    assert storage.local_path(old).read_bytes() == b"synthetic-audio"
    assert storage.delete(old)
    assert not (layout.resources_dir / "music" / key).exists()


def test_bundled_showcase_engines_only(v3, tmp_path, monkeypatch):
    layout, _ = v3
    templates = tmp_path / "templates"
    monkeypatch.setattr(settings, "templates_dir", templates)
    public = templates / "sandbox/nodehistory/atlas-en-movimiento/engine/tactico/core.js"
    public.parent.mkdir(parents=True)
    public.write_text("export {}")
    key = "bundled/sandbox/nodehistory/atlas-en-movimiento/engine/tactico/core.js"
    assert resolve_content_key(key) == public
    assert content_key(public) == key
    # Legacy gallery asset URLs resolve only to the active profile, never the
    # repository's historical episode, including when that profile has no file.
    asset = "sandbox/nodehistory/atlas-en-movimiento/assets/scene.json"
    bundled_asset = templates / asset
    bundled_asset.parent.mkdir(parents=True)
    bundled_asset.write_text('{"private":true}')
    assert resolve_content_key("bundled/" + asset) == layout.root / asset
    assert not resolve_content_key("bundled/" + asset).exists()
    for path in ("sandbox/nodehistory/atlas-en-movimiento/work/private.js",
                 "sandbox/nodeaction/cara-a-cara/assets/scene.json"):
        with pytest.raises(ValueError):
            resolve_content_key("bundled/" + path)
    link = public.parent / "outside.js"
    target = tmp_path / "outside.js"
    target.write_text("private")
    link.symlink_to(target)
    with pytest.raises(ValueError):
        resolve_content_key("bundled/sandbox/nodehistory/atlas-en-movimiento/engine/tactico/outside.js")


@pytest.mark.asyncio
async def test_recording_v3_indexes_final_paths_by_folder(tmp_path, monkeypatch):
    from src.core.data import set_data_store
    from src.core.explainer.catalog import ExplainerVideo
    from src.core.explainer.recorder import ExplainerRecorder, RecordState, render_filename
    from src.core.content_registry import get_video

    layout = resolve_profile_layout(tmp_path / "profile", 3)
    monkeypatch.setattr(settings, "storage_profile_dir", layout.root)
    monkeypatch.setattr(settings, "storage_layout_version", 3)
    monkeypatch.setattr(settings, "data_dir", layout.data_dir)
    monkeypatch.setattr(settings, "output_dir", layout.renders_dir)
    set_data_store(None)
    video_path = layout.productions_dir / "nodetech" / "movie"
    video_path.mkdir(parents=True)
    (video_path / "index.html").write_text("<html></html>")
    video = ExplainerVideo("movie", video_path, "rough", "node_tech", "Demo", "listo", 10)

    async def render(video_id, seconds, formats, *, output_dir, on_output=None):
        for fmt in formats:
            (output_dir / render_filename(video_id, fmt, seconds)).write_bytes(b"synthetic")

    recorder = ExplainerRecorder(render_runner=render, output_root=layout.renders_dir)
    try:
        for duration in ("10", "full"):
            job = recorder.submit(video, duration=duration, formats=["16x9", "9x16"])
            finished = await recorder.wait(job.job_id)
            assert finished.state == RecordState.done, finished.error
            assert all(Path(p).name == "video.mp4" for p in finished.outputs)
            assert all(Path(p).is_relative_to(layout.renders_dir / "videos/nodetech/movie") for p in finished.outputs)
        assert len(full_render_files(video_path)) == 2
        assert latest_render(video_path, "16x9").is_file()
        assert len(get_video("movie")["details"]["recordings"]) == 2
    finally:
        set_data_store(None)


@pytest.mark.asyncio
async def test_registered_resource_uses_its_stable_id_and_survives_category_edit(tmp_path, monkeypatch):
    from src.core.data import collection, set_data_store
    from src.core.library.asset_library import delete_asset, register_music, resolve_asset_path, update_asset_metadata

    layout = resolve_profile_layout(tmp_path / "profile", 3)
    monkeypatch.setattr(settings, "storage_profile_dir", layout.root)
    monkeypatch.setattr(settings, "storage_layout_version", 3)
    monkeypatch.setattr(settings, "data_dir", layout.data_dir)
    source = tmp_path / "song.mp3"
    source.write_bytes(b"synthetic-song")
    set_data_store(None)
    try:
        record = await register_music(source, category="ambient", source="user", filename="song.mp3")
        assert record.relative_path == f"{record.asset_id}/song.mp3"
        path = layout.resources_dir / "music" / record.relative_path
        assert resolve_asset_path("music", record.asset_id) == path
        updated = await update_asset_metadata("music", record.asset_id, {"category": "electronic"})
        assert updated.relative_path == record.relative_path
        assert path.read_bytes() == b"synthetic-song"
        duplicate = updated.model_dump(mode="json")
        duplicate["asset_id"] = "another-id"
        await collection("music_assets").insert(duplicate)
        await delete_asset("music", record.asset_id)
        assert path.read_bytes() == b"synthetic-song"
        assert resolve_asset_path("music", "another-id") == path
    finally:
        set_data_store(None)
