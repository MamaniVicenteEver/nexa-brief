"""Prepared campaign variants and legacy posters keep their exact bytes."""
import importlib.util
import json
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np
import pytest

from src.config.settings import settings
from src.core.nodemotion.promo import workspace
from src.core.nodemotion.shared import execution, resources

_REAL_ASSET = resources._asset


@pytest.fixture
def library(tmp_path, monkeypatch):
    profile = tmp_path / "profile"
    monkeypatch.setattr(settings, "storage_profile_dir", profile)
    monkeypatch.setattr(settings, "storage_layout_version", 3)
    paths = {}
    ready = {}
    for kind, folder, suffix in (("music", "music", ".mp3"), ("video", "videos", ".mp4"),
                                 ("image", "images", ".jpg")):
        directory = profile / "resources" / folder / "source-id"
        directory.mkdir(parents=True)
        original = directory / ("original" + suffix)
        original.write_bytes(("original-" + kind).encode())
        prepared = directory / ("prepared" + suffix)
        prepared.write_bytes(("ready-" + kind).encode())
        paths[kind] = original
        ready[kind] = prepared
    from src.adapters.data.section_store import Section
    names = {"music": "music_assets", "video": "video_assets", "image": "image_assets"}
    records = {names[kind]: [{"asset_id": "source-id", "category": "nodemotion",
                "relative_path": "source-id/" + path.name, "source": "migration"}]
               for kind, path in paths.items()}
    Section("resources").mutate(lambda section: section["collections"].update(records))
    monkeypatch.setattr(resources, "_asset", lambda kind, ident: paths[kind])
    return profile, paths, ready


@pytest.mark.parametrize("kind", ["music", "video", "image"])
def test_variant_binds_prepared_bytes_and_preserves_source_identity(library, kind):
    _, paths, ready = library
    ref = resources.asset_ref(kind, "source-id", variant_file=ready[kind].name)
    assert ref["asset_id"] == "source-id"
    assert ref["sha256"] == resources.digest(ready[kind]) != resources.digest(paths[kind])
    assert resources._resolve_ref(ref) == ready[kind]
    ready[kind].write_bytes(b"changed prepared bytes")
    with pytest.raises(ValueError, match="revision"):
        resources._resolve_ref(ref)
    assert paths[kind].read_bytes() == ("original-" + kind).encode()


@pytest.mark.parametrize("name", ["../other.mp4", "/etc/passwd", "nested/../prepared.mp4",
                                "resource.json", ".private.mp4", r"nested\\prepared.mp4"])
def test_variants_reject_traversal_private_metadata_and_invalid_types(library, name):
    with pytest.raises(ValueError):
        resources.asset_ref("video", "source-id", variant_file=name)


def test_variant_refuses_symlinks_and_bundled_sibling_selection(library, tmp_path):
    profile, paths, ready = library
    link = ready["video"].parent / "link.mp4"
    link.symlink_to(ready["video"])
    with pytest.raises(ValueError, match="Symlink"):
        resources.asset_ref("video", "source-id", variant_file=link.name)
    nested = ready["video"].parent / "nested"
    nested.symlink_to(ready["video"].parent, target_is_directory=True)
    with pytest.raises(ValueError, match="Symlink"):
        resources.asset_ref("video", "source-id", variant_file="nested/prepared.mp4")
    bundled = tmp_path / "templates/_tools/nodemotion/shared/resources"
    bundled.mkdir(parents=True)
    source = bundled / "original.mp4"
    source.write_bytes(b"shared bundle")
    (bundled / "sibling.mp4").write_bytes(b"unrelated design")
    paths["video"] = source
    with pytest.raises(ValueError, match="normal registered"):
        resources.asset_ref("video", "source-id", variant_file="sibling.mp4")
    assert not (profile / "sandbox").exists()


def test_historical_poster_is_shared_without_reencoding(library, tmp_path, monkeypatch):
    _, _, ready = library
    ref = resources.asset_ref("video", "source-id", variant_file=ready["video"].name)
    historical = tmp_path / "old-poster.jpg"
    historical.write_bytes(b"exact old jpeg defaults")
    monkeypatch.setattr(resources.subprocess, "run", lambda *args, **kwargs: pytest.fail("Historical JPEG must not be encoded"))
    poster = resources.poster_ref(ref, historical=historical)
    shared = resources._resolve_ref(poster)
    assert shared.read_bytes() == historical.read_bytes()
    assert shared != historical and shared.name == resources.digest(historical) + ".jpg"
    assert resources.poster_ref(ref, historical=historical) == poster
    assert len(list(shared.parent.glob("*.jpg"))) == 1
    shared.write_bytes(b"corrupt snapshot")
    with pytest.raises(ValueError, match="Poster revision"):
        resources._resolve_ref(poster)


def test_new_shared_poster_is_byte_identical_to_original_ffmpeg_recipe(library, tmp_path):
    if not shutil.which("ffmpeg"):
        pytest.skip("ffmpeg unavailable")
    _, _, ready = library
    source = ready["video"]
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i",
                    "color=c=red:size=32x32:rate=10", "-t", "1", "-c:v", "libx264",
                    "-threads", "1", "-pix_fmt", "yuv420p", str(source)], check=True, capture_output=True)
    baseline = tmp_path / "baseline.jpg"
    subprocess.run(["ffmpeg", "-v", "error", "-n", "-ss", "0.5", "-i", str(source),
                    "-frames:v", "1", "-update", "1", str(baseline)], check=True, capture_output=True)
    ref = resources.asset_ref("video", "source-id", variant_file=source.name)
    poster = resources.poster_ref(ref)
    shared = resources._resolve_ref(poster)
    assert shared.read_bytes() == baseline.read_bytes()
    assert resources.poster_ref(ref) == poster


def test_campaign_export_keeps_exact_variants_without_local_media(library, tmp_path, monkeypatch):
    profile, _, ready = library
    root = profile / "sandbox/nodemotion/campaign"
    (root / "assets").mkdir(parents=True)
    (root / "assets/config.json").write_text('{"audio":{"src":"song.mp3"}}')
    monkeypatch.setattr(execution, "registered", lambda design: design == "promo-test")
    monkeypatch.setattr(execution, "engine_revision", lambda design: "v1")
    monkeypatch.setattr(execution, "freeze_engine", lambda design, revision=None: "v1")
    monkeypatch.setattr(execution, "available_revision", lambda design, revision: revision == "v1")
    monkeypatch.setattr(execution, "assemble", lambda design, revision=None: b"<html><head></head><body>exact</body></html>")
    monkeypatch.setattr(execution, "runtime_files", lambda design, revision=None: {})
    refs = {"song.mp3": resources.asset_ref("music", "source-id", variant_file=ready["music"].name),
            "media/video.mp4": resources.asset_ref("video", "source-id", variant_file=ready["video"].name)}
    timing = {"segments": [{"text": "campaign"}]}
    execution.create_project(root, "promo-test", refs, timeline=timing, workspace_only=True)
    from src.core.nodemotion.shared.content import has_project_entry
    from src.core.explainer.sandbox import load_item
    assert execution.load_project(root)["workspace_only"] is True
    assert not has_project_entry(root)
    assert load_item(root) is None
    html, audio, revision = execution.materialize(root, tmp_path / "render")
    assert audio.read_bytes() == ready["music"].read_bytes()
    assert (html.parent / "assets/media/video.mp4").read_bytes() == ready["video"].read_bytes()
    assert html.read_bytes() == execution.resolve_project(root, "index.html", expected_revision=revision)
    assert not (root / "index.html").exists() and not (root / "assets/song.mp3").exists()
    assert all(path.suffix == ".json" for path in root.rglob("*") if path.is_file())
    assert not any(path.is_symlink() for path in root.rglob("*"))


def test_timing_reads_reference_before_build_and_writes_owned_timeline(library, monkeypatch):
    profile, _, ready = library
    target = profile / "sandbox/nodemotion/campaign"
    (target / "work").mkdir(parents=True)
    (target / "work/script.json").write_text(json.dumps({"duration_seconds": 4,
        "segments": [{"lines": ["first"]}, {"lines": ["second"]}]}))
    ref = resources.asset_ref("music", "source-id", variant_file=ready["music"].name)
    (target / "music.json").write_text(json.dumps({"resource_ref": ref}))
    tools = Path(__file__).resolve().parents[2] / "src/templates/_tools/nodemotion/promo/tools"
    spec = importlib.util.spec_from_file_location("campaign_timing", tools / "timing.py")
    timing = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(timing)
    def onsets(path, duration):
        assert path == ready["music"] and duration == 4
        return np.array([0.0])
    monkeypatch.setattr(timing, "onsets", onsets)
    monkeypatch.setattr(timing, "align", lambda *args: [0, 2, 4])
    def write(path, value):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(value))
    result = timing.run(target, lambda path: json.loads(path.read_bytes()), write, lambda *_: None)
    assert workspace.timeline(target) == result
    assert (target / "assets/timeline.json").is_file()
    assert not (target / "assets/song.mp3").exists()
    (target / "assets/lyrics.json").write_text('{"changed":true}')
    with pytest.raises(ValueError, match="Conflicting timeline"):
        workspace.timeline(target)


@pytest.mark.parametrize("value", ["true", 1, None, {}])
def test_workspace_only_policy_requires_a_boolean(tmp_path, value):
    with pytest.raises(ValueError, match="workspace policy"):
        execution.create_project(tmp_path, "promo-test", {}, workspace_only=value)


def _legacy_campaign(library):
    profile, _, ready = library
    root = profile / "sandbox/nodemotion/legacy-campaign"
    assets = root / "assets"
    (assets / "media").mkdir(parents=True)
    config = {"activeId": "original", "configs": [{"id": "original",
        "audio": {"src": "song.mp3"}, "lyricsUrl": "lyrics.json",
        "scenes": [{"type": "existing", "media": ["chosen"]}],
        "media": [{"id": "chosen", "type": "video", "src": "media/source-id.mp4",
                   "poster": "media/source-id-poster.jpg"}]}]}
    for name, value in {"brief.json": {"template": "promo-editorial"},
                         "music.json": {"asset_id": "source-id", "ready_file": ready["music"].name},
                         "media-plan.json": {"items": [{"asset_id": "source-id", "kind": "video"}]},
                         "assets/config.json": config,
                         "assets/lyrics.json": {"segments": [{"text": "exact original"}]}}.items():
        (root / name).write_bytes(json.dumps(value, ensure_ascii=False, indent=3).encode() + b"\n")
    (assets / "song.mp3").symlink_to(ready["music"])
    (assets / "media/source-id.mp4").symlink_to(ready["video"])
    (assets / "media/source-id-poster.jpg").write_bytes(b"exact original poster")
    return root


def _planning_engine(monkeypatch):
    from src.core.nodemotion.promo import campaign_migration as migration
    monkeypatch.setattr(migration, "engine_revision", lambda design: "v1")
    monkeypatch.setattr(migration, "registered", lambda design: design == "promo-editorial")
    monkeypatch.setattr(execution, "registered", lambda design: design == "promo-editorial")
    monkeypatch.setattr(execution, "available_revision", lambda design, revision: revision == "v1")
    monkeypatch.setattr(execution, "assemble", lambda design, revision=None: b"<html><head></head><body>exact</body></html>")
    from src.templates._tools.nodemotion.shared import assemble as engines
    monkeypatch.setattr(engines, "freeze_engine", lambda design, revision=None: "v1")
    return migration


def test_legacy_campaign_plan_is_read_only_and_proves_exact_config_timing_and_media(library, monkeypatch):
    profile, _, ready = library
    root = _legacy_campaign(library)
    migration = _planning_engine(monkeypatch)
    before = {str(path): (path.readlink() if path.is_symlink() else path.read_bytes())
              for path in profile.rglob("*") if path.is_file()}
    before_paths = set(profile.rglob("*"))
    plan = migration.plan_campaign(profile, root)
    assert plan["status"] == "planned"
    assert all(plan["checks"].values())
    assert plan["project"]["workspace_only"] is True
    assert plan["project"]["assets"]["song.mp3"]["sha256"] == resources.digest(ready["music"])
    assert plan["project"]["assets"]["media/source-id.mp4"]["variant_file"] == ready["video"].name
    assert len(plan["retire"]) == 3
    assert before == {str(path): (path.readlink() if path.is_symlink() else path.read_bytes())
                      for path in profile.rglob("*") if path.is_file()}
    assert not (root / "project.json").exists()
    assert set(profile.rglob("*")) == before_paths
    assert not (profile / "resources/nodemotion/posters").exists()


def test_legacy_campaign_plan_refuses_different_audio_and_custom_html(library, monkeypatch):
    profile, _, ready = library
    root = _legacy_campaign(library)
    migration = _planning_engine(monkeypatch)
    (root / "assets/song.mp3").unlink()
    (root / "assets/song.mp3").symlink_to(ready["video"])
    with pytest.raises(ValueError, match="music.json"):
        migration.plan_campaign(profile, root)
    (root / "index.html").write_bytes(b"custom engine")
    report = migration.plan_campaigns(profile)
    assert report["counts"]["needs-review"] == 1 and report["counts"]["planned"] == 0
    assert "own HTML" in report["projects"][0]["reason"]


def test_campaign_apply_retires_only_exact_whitelist_and_resumes_idempotently(library, monkeypatch):
    from src.adapters.data.section_store import Section
    from src.core.nodemotion.shared.content import has_project_entry
    profile, paths, ready = library
    root = _legacy_campaign(library)
    migration = _planning_engine(monkeypatch)
    monkeypatch.setattr(resources, "_asset", _REAL_ASSET)
    (root / "work/results").mkdir(parents=True)
    rendered = root / "work/results/qa.mp4"
    rendered.write_bytes(b"never delete QA or renders")
    before = {name: (root / name).read_bytes() for name in
              ("brief.json", "music.json", "media-plan.json", "assets/config.json", "assets/lyrics.json")}
    plan = migration.plan_campaign(profile, root)
    result = migration.apply_campaign_plan(profile, plan, retire_verified=True)
    assert result["state"] == "complete" and result["retired"] == 3
    assert before == {name: (root / name).read_bytes() for name in before}
    assert all(not (root / item["relative"]).exists() for item in plan["retire"])
    assert execution.resolve_project(root, "assets/song.mp3") == ready["music"]
    assert execution.resolve_project(root, "assets/media/source-id.mp4") == ready["video"]
    assert execution.resolve_project(root, "assets/media/source-id-poster.jpg").read_bytes() == b"exact original poster"
    assert not has_project_entry(root)
    assert rendered.read_bytes() == b"never delete QA or renders"
    assert paths["music"].read_bytes() == b"original-music"
    assert ready["video"].read_bytes() == b"ready-video"
    aliases = Section("resources").read()["documents"]["legacy_path_aliases"]
    assert any(row["legacy_key"] == str(root / "assets/song.mp3") for row in aliases.values())
    revisions = {name: Section(name).read()["revision"] for name in ("resources", "videos", "jobs", "schedule", "publicaciones")}
    repeated = migration.resume_campaign(profile, root, retire_verified=True)
    assert repeated == result
    assert revisions == {name: Section(name).read()["revision"] for name in revisions}


def test_campaign_interrupted_unlink_resumes_from_persisted_whitelist(library, monkeypatch):
    profile, _, _ = library
    root = _legacy_campaign(library)
    migration = _planning_engine(monkeypatch)
    plan = migration.plan_campaign(profile, root)
    unlink = migration._unlink_entry
    count = 0
    def interrupt(*args):
        nonlocal count
        count += 1
        if count == 2:
            raise RuntimeError("interrupted retirement")
        return unlink(*args)
    monkeypatch.setattr(migration, "_unlink_entry", interrupt)
    with pytest.raises(RuntimeError, match="interrupted"):
        migration.apply_campaign_plan(profile, plan, retire_verified=True)
    journal = json.loads(migration.journal_path(profile, root).read_bytes())
    assert journal["state"] == "retiring" and len(journal["retired"]) == 1
    monkeypatch.setattr(migration, "_unlink_entry", unlink)
    assert migration.resume_campaign(profile, root, retire_verified=True)["state"] == "complete"
    assert not any((root / item["relative"]).is_symlink() for item in plan["retire"])


@pytest.mark.parametrize("phase", ["timeline", "project", "source-identity"])
def test_campaign_publication_crashes_and_identity_changes_never_delete_old_media(library, monkeypatch, phase):
    profile, paths, ready = library
    root = _legacy_campaign(library)
    migration = _planning_engine(monkeypatch)
    plan = migration.plan_campaign(profile, root)
    publish = migration._publish_exact
    def interrupt(path, *args):
        if phase in {"timeline", "project"} and path.name == phase + ".json":
            raise RuntimeError("interrupted publication")
        result = publish(path, *args)
        if phase == "source-identity" and path.name == "project.json":
            other = profile / "resources/videos/other"
            other.mkdir()
            replacement = other / paths["video"].name
            replacement.write_bytes(paths["video"].read_bytes())
            (other / ready["video"].name).write_bytes(ready["video"].read_bytes())
            paths["video"] = replacement
        return result
    monkeypatch.setattr(migration, "_publish_exact", interrupt)
    with pytest.raises((RuntimeError, ValueError)):
        migration.apply_campaign_plan(profile, plan, retire_verified=True)
    assert all((root / item["relative"]).is_file() for item in plan["retire"])
    if phase != "source-identity":
        monkeypatch.setattr(migration, "_publish_exact", publish)
        assert migration.resume_campaign(profile, root, retire_verified=True)["state"] == "complete"


def test_campaign_link_swap_and_parent_symlink_are_refused_at_final_unlink(library, tmp_path):
    profile, _, ready = library
    root = _legacy_campaign(library)
    from src.core.nodemotion.promo import campaign_migration as migration
    link = root / "assets/media/source-id.mp4"
    item = {"relative": "assets/media/source-id.mp4", "symlink": True,
            "link_target": str(ready["video"]), "sha256": resources.digest(ready["video"])}
    link.unlink()
    link.symlink_to(ready["music"])
    with pytest.raises(ValueError, match="link changed"):
        migration._unlink_entry(profile, root, item)
    assert ready["music"].read_bytes() == b"ready-music"
    old = root / "assets/media"
    replacement = tmp_path / "foreign-media"
    old.rename(replacement)
    old.symlink_to(replacement, target_is_directory=True)
    with pytest.raises(OSError):
        migration._unlink_entry(profile, root, item)
    assert (replacement / "source-id-poster.jpg").read_bytes() == b"exact original poster"


@pytest.mark.parametrize("phase", ["before-publication", "after-publication"])
def test_campaign_changed_library_model_aborts_before_any_delete(library, monkeypatch, phase):
    from src.adapters.data.section_store import Section
    profile, _, _ = library
    root = _legacy_campaign(library)
    migration = _planning_engine(monkeypatch)
    monkeypatch.setattr(resources, "_asset", _REAL_ASSET)
    plan = migration.plan_campaign(profile, root)
    assert plan["source_models"]["video:source-id"]["asset_id"] == "source-id"
    def change():
        Section("resources").mutate(lambda section: section["collections"]["video_assets"][0].update(
            description="concurrent human metadata change"))
    if phase == "before-publication":
        change()
    else:
        publish = migration._publish_exact
        def concurrent(path, *args):
            result = publish(path, *args)
            if path.name == "project.json":
                change()
            return result
        monkeypatch.setattr(migration, "_publish_exact", concurrent)
    with pytest.raises(ValueError, match="source metadata changed"):
        migration.apply_campaign_plan(profile, plan, retire_verified=True)
    assert all((root / item["relative"]).is_file() for item in plan["retire"])


def test_campaign_own_engine_added_after_review_is_preserved_and_blocks_apply(library, monkeypatch):
    profile, _, _ = library
    root = _legacy_campaign(library)
    migration = _planning_engine(monkeypatch)
    plan = migration.plan_campaign(profile, root)
    custom = root / "index.html"
    custom.write_bytes(b"new custom engine created after review")
    with pytest.raises(ValueError, match="own HTML"):
        migration.apply_campaign_plan(profile, plan, retire_verified=True)
    assert custom.read_bytes() == b"new custom engine created after review"
    assert not (root / "project.json").exists()
    assert all((root / item["relative"]).is_file() for item in plan["retire"])


def test_campaign_cli_uses_explicit_profile_without_reading_dotenv(tmp_path):
    profile = tmp_path / "selected-profile"
    profile.mkdir()
    (profile / "profile.json").write_text(json.dumps({"schema_version": 3, "id": "selected-profile"}))
    report = {"schema_version": 1, "kind": "nodemotion-campaign-plan",
              "profile": str(profile), "projects": [], "counts": {"planned": 0}}
    plan = tmp_path / "reviewed-plan.json"
    plan.write_text(json.dumps(report))
    server = Path(__file__).resolve().parents[2]
    cli = server / "src/templates/_tools/nodemotion/shared/migrate_campaigns.py"
    program = """
import os
import runpy
import sys
from pydantic_settings import DotEnvSettingsSource
def forbidden(self):
    raise AssertionError("Offline campaign CLI must not read dotenv files")
DotEnvSettingsSource._read_env_files = forbidden
namespace = runpy.run_path(sys.argv[3])
assert namespace["main"](["--profile", sys.argv[1], "--plan", sys.argv[2]]) == 0
assert DotEnvSettingsSource._read_env_files is forbidden
from src.config.settings import settings
assert str(settings.storage_profile_dir) == sys.argv[1]
assert os.environ["NEXA_PROFILE_DIR"] == sys.argv[1]
"""
    result = subprocess.run([sys.executable, "-c", program, str(profile), str(plan), str(cli)],
                            cwd=server, capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout) == report
