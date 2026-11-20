"""Bundled demo media is content-addressed and never copied into a profile."""
import hashlib
import json
from pathlib import Path

import pytest

from src.config.settings import settings
from src.core.library import asset_library
from src.core.nodemotion.shared import bundled
from src.core import template_original


@pytest.fixture(autouse=True)
def reset_template_catalog():
    from src.config import template_manifest
    template_manifest._load_catalog.cache_clear()
    template_manifest._load_manifest.cache_clear()
    yield
    template_manifest._load_catalog.cache_clear()
    template_manifest._load_manifest.cache_clear()


def store(templates: Path, data: bytes, suffix: str) -> tuple[str, Path]:
    key = hashlib.sha256(data).hexdigest() + suffix
    root = templates / "_tools/nodemotion/shared/resources"
    root.mkdir(parents=True, exist_ok=True)
    path = root / key
    path.write_bytes(data)
    return key, path


@pytest.fixture
def demo(tmp_path, monkeypatch):
    templates = tmp_path / "templates"
    assets = templates / "nodemotion/lyrics/lyrics-suave/assets"
    assets.mkdir(parents=True)
    song_key, song = store(templates, b"song bytes", ".mp3")
    bg_key, background = store(templates, b"background bytes", ".jpg")
    aliases = {"assets/song.mp3": song_key, "assets/bg.jpg": bg_key}
    monkeypatch.setattr(settings, "templates_dir", templates)
    monkeypatch.setattr(bundled, "demo_aliases", lambda design: aliases if design == "lyrics-suave" else {})
    monkeypatch.setattr(bundled, "demo_design_for_root", lambda root: "lyrics-suave")
    monkeypatch.setattr(template_original, "get_template_asset_dir", lambda design: assets)
    monkeypatch.setattr(asset_library, "resource_metadata", lambda category, template_id: {
        "category_id": "node_motion", "category_name": "NodeMotion",
        "template_id": template_id, "template_name": template_id, "resource_origins": [],
    })
    (assets / "config.json").write_text(json.dumps({"audio": {"src": "song.mp3"}, "bg": {"src": "bg.jpg"}}))
    (assets / "lyrics.json").write_text('{"segments":[]}')
    return assets, aliases, song, background


@pytest.mark.asyncio
async def test_original_uses_bundled_song_and_background_without_library_copy(demo, tmp_path):
    from src.config.niche_config import get_niche_config

    assets, aliases, song, background = demo
    niche = get_niche_config("lyrics_video_suave")
    original = await template_original.ensure_assets("lyrics-suave", niche)
    music = asset_library.get_music_entry(original.music_asset_id)
    image = asset_library.get_image_entry(original.image_asset_id)
    assert music.bundled_key == aliases["assets/song.mp3"]
    assert image.bundled_key == aliases["assets/bg.jpg"]
    assert asset_library.resolve_music_path(music.asset_id) == song
    assert asset_library.resolve_image_path(image.asset_id) == background
    assert not asset_library._storage("music").local_path(music.relative_path).exists()
    assert not asset_library._storage("image").local_path(image.relative_path).exists()
    assert not (assets / "song.mp3").exists()
    assert not (assets / "bg.jpg").exists()
    assert (await template_original.ensure_assets("lyrics-suave", niche)) == original


@pytest.mark.asyncio
async def test_default_registration_can_select_only_needed_paths(demo, monkeypatch):
    _, aliases, song, background = demo
    paths = {"assets/song.mp3": song, "assets/bg.jpg": background}
    monkeypatch.setattr(bundled, "resolve_demo_resource", lambda design, relative: paths.get(relative))
    refs = await bundled.ensure_design_resources("lyrics-suave", ["assets/bg.jpg"])
    assert set(refs) == {"assets/bg.jpg"}
    assert refs["assets/bg.jpg"]["kind"] == "image"
    assert len(asset_library._records("image").list()) == 1
    assert asset_library._records("music").list() == []


@pytest.mark.asyncio
async def test_default_media_refs_reuse_registered_shared_source(demo, monkeypatch):
    from src.templates._tools.nodemotion.shared import assemble

    _, aliases, song, background = demo
    monkeypatch.setattr(assemble, "runtime_files", lambda design: {
        "assets/song.mp3": song, "assets/bg.jpg": background,
    })
    refs = await bundled.ensure_design_resources("lyrics-suave")
    again = await bundled.ensure_design_resources("lyrics-suave")
    assert refs == again
    assert refs["assets/bg.jpg"]["sha256"] == aliases["assets/bg.jpg"][:64]
    assert asset_library.resolve_asset_path("image", refs["assets/bg.jpg"]["asset_id"]) == background
    assert len(asset_library._records("image").list()) == 1


def test_planner_is_read_only_and_deduplicates_equal_content(tmp_path):
    templates = tmp_path / "templates"
    assets = templates / "nodemotion/lyrics/lyrics-caution/assets"
    assets.mkdir(parents=True)
    (assets / "one.jpg").write_bytes(b"identical")
    (assets / "two.jpg").write_bytes(b"identical")
    (assets / "config.json").write_text("{}")
    result = bundled.plan_demo_resources(templates, ["lyrics-caution"])
    aliases = result["aliases"]["lyrics-caution"]
    assert aliases["assets/one.jpg"] == aliases["assets/two.jpg"]
    assert result["unique_bytes"] == len(b"identical")
    assert not (templates / "_tools/nodemotion/shared/resources").exists()
    assert (assets / "one.jpg").read_bytes() == b"identical"


def test_bundled_paths_require_valid_contained_hash(demo, tmp_path):
    _, aliases, song, _ = demo
    assert bundled.resolve_bundled_key(aliases["assets/song.mp3"]) == song
    for key in ("../escape.mp3", "0" * 64 + "/song.mp3", "a" * 64 + ".mp3/../../x"):
        with pytest.raises(ValueError):
            bundled.resolve_bundled_key(key)
    wrong_key = "0" * 64 + ".mp3"
    (bundled.resource_root() / wrong_key).write_bytes(b"not matching")
    with pytest.raises(ValueError, match="revision mismatch"):
        bundled.resolve_bundled_key(wrong_key)


@pytest.mark.asyncio
async def test_deleting_library_metadata_keeps_shared_demo_media(demo):
    _, aliases, song, _ = demo
    entry = await asset_library.register_bundled_resource(
        "music", "lyrics-suave", aliases["assets/song.mp3"], "assets/song.mp3")
    await asset_library.delete_asset("music", entry.asset_id)
    assert song.read_bytes() == b"song bytes"


@pytest.mark.asyncio
async def test_new_project_references_default_shared_media(demo, tmp_path, monkeypatch):
    from src.config.niche_config import get_niche_config
    from src.core.job import Job, JobInput
    from src.modules import html_generator, resource_fetcher

    assets, aliases, song, background = demo
    music = await asset_library.register_bundled_resource("music", "lyrics-suave", aliases["assets/song.mp3"], "assets/song.mp3")
    image = await asset_library.register_bundled_resource("image", "lyrics-suave", aliases["assets/bg.jpg"], "assets/bg.jpg")
    from src.core.nodemotion.shared.resources import asset_ref
    async def defaults(design):
        return {"assets/media/default.jpg": asset_ref("image", image.asset_id)}
    async def register_config(*args, **kwargs): return None
    monkeypatch.setattr(bundled, "ensure_design_resources", defaults)
    monkeypatch.setattr(resource_fetcher, "_outro_tail_seconds", lambda niche: 0)
    monkeypatch.setattr(html_generator.asset_library, "register_template_config", register_config)
    niche = get_niche_config("lyrics_video_suave")
    niche = niche.model_copy(update={"template": niche.template.model_copy(update={"static_config": True, "required_config_keys": []})})
    # This test exercises resource integration with a small synthetic static config.
    synthetic = tmp_path / "config.json"
    synthetic.write_text('{"bg":{"src":"bg.jpg","type":"image"},"audio":{"src":"song.mp3"}}')
    fake_html = tmp_path / "template.html"
    fake_html.write_text("<html><head></head><body></body></html>")
    monkeypatch.setattr(html_generator, "get_template_paths", lambda _: {"config_json": synthetic, "index_html": fake_html})
    root = tmp_path / "project"
    (root / "assets").mkdir(parents=True)
    job = Job(input=JobInput(category_name=niche.id))
    job = job.model_copy(update={"artifacts": job.artifacts.model_copy(update={
        "output_dir": root, "assets_dir": root / "assets", "music_asset_id": music.asset_id,
        "image_asset_id": image.asset_id, "lyrics_json": {"segments": []},
    })})
    result = await html_generator.run(job, None, niche)
    manifest = json.loads((root / "project.json").read_text())
    assert manifest["assets"]["assets/media/default.jpg"]["asset_id"] == image.asset_id
    assert manifest["assets"]["song.mp3"]["asset_id"] == music.asset_id
    assert not (root / "assets/assets/media/default.jpg").exists()
    assert result.artifacts.config_json_path.is_file()
    assert song.is_file() and background.is_file()


@pytest.fixture
def relocation(tmp_path, monkeypatch):
    from src.templates._tools.nodemotion.shared import assemble
    templates = tmp_path / "templates"
    demo_root = templates / "nodemotion/lyrics/lyrics-caution"
    (demo_root / "assets").mkdir(parents=True)
    (demo_root / "assets/one.jpg").write_bytes(b"identical")
    (demo_root / "assets/two.jpg").write_bytes(b"identical")
    engine = templates / "_tools/nodemotion/lyrics/designs/lyrics-caution"
    engine.mkdir(parents=True)
    (engine / "document.html").write_text("<html><head></head><body></body></html>")
    (engine / "manifest.json").write_text(json.dumps({
        "schema_version": 1, "design_id": "lyrics-caution", "family": "lyrics",
        "demo_folder": "nodemotion/lyrics/lyrics-caution", "document": "document.html",
        "fragments": [], "runtime_aliases": {}, "runtime_assets": ["assets"],
    }))
    monkeypatch.setattr(settings, "templates_dir", templates)
    monkeypatch.setattr(assemble, "ROOT", templates / "_tools/nodemotion")
    monkeypatch.setattr(assemble, "TEMPLATES", templates)
    return templates, demo_root, engine


def test_apply_relocation_is_verified_and_idempotent(relocation):
    from src.templates._tools.nodemotion.shared import assemble
    templates, demo, engine = relocation
    plan = bundled.plan_demo_resources(templates, ["lyrics-caution"])
    outcome = bundled.apply_demo_resource_plan(plan)
    assert outcome == {"resources": 2, "linked": 1, "retired": 2}
    manifest = json.loads((engine / "manifest.json").read_text())
    one, two = manifest["demo_resource_aliases"]["assets/one.jpg"], manifest["demo_resource_aliases"]["assets/two.jpg"]
    assert one == two
    assert not (demo / "assets/one.jpg").exists()
    assert not (demo / "assets/two.jpg").exists()
    assert bundled.resolve_demo_resource("lyrics-caution", "assets/one.jpg").read_bytes() == b"identical"
    assert assemble.resolve_runtime_asset("lyrics-caution", "assets/two.jpg").read_bytes() == b"identical"
    assert bundled.apply_demo_resource_plan(plan) == {"resources": 2, "linked": 0, "retired": 0}


def test_apply_relocation_rejects_changed_sources_before_writes(relocation):
    templates, demo, engine = relocation
    plan = bundled.plan_demo_resources(templates, ["lyrics-caution"])
    plan["resources"][0]["sha256"] = "0" * 64
    with pytest.raises(ValueError):
        bundled.apply_demo_resource_plan(plan)
    assert (demo / "assets/one.jpg").read_bytes() == b"identical"
    assert (demo / "assets/two.jpg").read_bytes() == b"identical"
    assert "demo_resource_aliases" not in json.loads((engine / "manifest.json").read_text())
    assert not (templates / "_tools/nodemotion/shared/resources").exists()


def test_apply_can_publish_without_retiring_sources(relocation):
    templates, demo, _ = relocation
    plan = bundled.plan_demo_resources(templates, ["lyrics-caution"])
    outcome = bundled.apply_demo_resource_plan(plan, retire_verified=False)
    assert outcome == {"resources": 2, "linked": 1, "retired": 0}
    assert (demo / "assets/one.jpg").read_bytes() == b"identical"
    assert bundled.resolve_demo_resource("lyrics-caution", "assets/one.jpg").read_bytes() == b"identical"


def test_generated_media_preserves_previous_engine_revision(relocation):
    from src.templates._tools.nodemotion.shared import assemble
    templates, demo, _ = relocation
    plan = bundled.plan_demo_resources(templates, ["lyrics-caution"])
    bundled.apply_demo_resource_plan(plan)
    old_revision = assemble.freeze_engine("lyrics-caution")
    old_path = assemble.resolve_runtime_asset("lyrics-caution", "assets/one.jpg", old_revision)
    assert old_path.read_bytes() == b"identical"
    (demo / "assets/one.jpg").write_bytes(b"new media")
    outcome = bundled.publish_generated_resources("lyrics-caution")
    assert outcome == {"resources": 1, "linked": 1, "retired": 1}
    assert assemble.resolve_runtime_asset("lyrics-caution", "assets/one.jpg").read_bytes() == b"new media"
    assert assemble.resolve_runtime_asset("lyrics-caution", "assets/one.jpg", old_revision).read_bytes() == b"identical"
    assert not (demo / "assets/one.jpg").exists()
