"""Offline migration rehearsal: synthetic files, no real profiles or secrets."""
import json
import importlib.util
import os
from pathlib import Path
import subprocess
import sys

import pytest

SCRIPT = Path(__file__).resolve().parents[2] / "scripts/migrate-profile-layout.py"


def call(profile, templates, *options):
    env = {"PATH": os.environ["PATH"], "HOME": str(profile.parent), "XDG_CONFIG_HOME": str(profile.parent / "xdg")}
    return subprocess.run([sys.executable, str(SCRIPT), "--profile-dir", str(profile), "--templates-dir", str(templates), "--target-version", "2", *options],
                          env=env, text=True, capture_output=True, timeout=30)


def put(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(value)
    return path


@pytest.fixture
def fixture(tmp_path):
    profile, templates = tmp_path / "profile", tmp_path / "templates"
    profile.mkdir()
    templates.mkdir()
    (profile / "profile.json").write_text(json.dumps({"schema_version": 1, "id": "fixture", "providers": {}}))
    media = put(profile / "data/library/files/images/cat/image.png", b"synthetic-image")
    log = put(profile / "data/explainer/logs/prod1.log", b"synthetic-log")
    master = put(profile / "output/nodehistory/demo/master.mp4", b"synthetic-video")
    put(profile / "data/explainer/productions.json", json.dumps([{"production_id": "prod1", "video_id": "demo", "folder": "nodehistory", "state": "ready", "log_path": str(log), "topic": "Fixture"}]).encode())
    put(profile / "data/jobs/jobs.json", json.dumps([{"job_id": "job1", "source": "explainer", "video_id": "demo", "output_dir": str(master.parent), "file_paths": {"youtube": str(master)}}]).encode())
    put(profile / "data/library/images.json", json.dumps([{"asset_id": "img1", "path": str(media), "preview": "/app/output/nodehistory/demo/master.mp4"}]).encode())
    put(profile / "data/video_backups/queue.sqlite3", b"synthetic-sqlite")
    put(profile / "data/sandbox-thumbs/x.png", b"synthetic-cache")
    put(profile / "data/agent_logs/agent1/run.log", b"synthetic-agent-log")
    put(profile / "data/explainer/logs/orphan.log", b"synthetic-orphan-log")
    put(profile / "data/canales/channels.json", json.dumps([{"platform": "youtube", "alias": "demo", "title": "old", "local": 1}]).encode())
    put(profile / "config/image-styles/custom.json", b'{"custom":true}')
    put(profile / "connections/channels.json", json.dumps([{"platform": "youtube", "alias": "demo", "title": "canonical"}, {"platform": "facebook", "alias": "other"}]).encode())
    put(templates / "nodehistory/demo/index.html", b'<script src="../../_tools/explainer-kit/engine/loader.js"></script><img src="/nodehistory/demo/assets/cover.jpg">')
    put(templates / "nodehistory/demo/manifest.json", b'{"video_id":"demo"}')
    put(templates / "nodehistory/demo/render/master.mp4", b"legacy-master")
    put(templates / "nodehistory/demo/render/preview.mp4", b"legacy-preview")
    put(templates / "nodehistory/demo/render/cover.jpg", b"legacy-thumbnail")
    put(templates / "nodehistory/demo/references.json", json.dumps({"master": str(templates / "nodehistory/demo/render/master.mp4"), "media": str(media)}).encode())
    put(templates / "nodehistory/demo/assets/storyboard.json", b'{"image":"/nodehistory/demo/assets/cover.jpg"}')
    put(templates / "nodehistory/demo/assets/cover.jpg", b"synthetic-cover")
    put(templates / "nodehistory/muestras/sample/index.html", b"sample")
    put(templates / "sandbox/nodehistory/demo/index.html", b"<p>prototype</p>")
    # Opaque credentials are intentionally never opened or printed by the test or tool.
    sensitive = put(profile / "connections/accounts.json", b"synthetic opaque")
    web = put(profile / "web-data/users.json", b"synthetic opaque")
    return profile, templates, sensitive.stat().st_ino, web.stat().st_ino


def test_plan_prepare_activate_rollback_preserves_everything(fixture):
    profile, templates, sensitive_inode, web_inode = fixture
    before = call(profile, templates, "--local-plan")
    assert before.returncode == 0 and "plan solamente" in before.stdout
    assert "accounts.json" not in before.stdout and "users.json" not in before.stdout
    assert not (profile / ".system").exists()
    denied = call(profile, templates, "--local-prepare")
    assert denied.returncode != 0 and "confirm-maintenance" in denied.stderr
    prep = call(profile, templates, "--local-prepare", "--confirm-maintenance", "--confirm-templates-owned")
    assert prep.returncode == 0, prep.stderr
    ident = next(line.split("=", 1)[1] for line in prep.stdout.splitlines() if line.startswith("migration_id="))
    assert json.loads((profile / "profile.json").read_text())["schema_version"] == 1
    assert (profile / "data/library/files/images/cat/image.png").is_file()
    stage = profile / ".system/migrations" / ident / "staged"
    assert (stage / "productions/nodehistory/demo/index.html").exists()
    assert not (stage / "productions/nodehistory/muestras").exists()
    assert (stage / "sandbox/nodehistory/demo/index.html").exists()
    activated = call(profile, templates, "--local-activate", "--migration-id", ident, "--confirm-maintenance")
    assert activated.returncode == 0, activated.stderr
    assert json.loads((profile / "profile.json").read_text())["schema_version"] == 2
    assert (profile / "resources/images/cat/image.png").read_bytes() == b"synthetic-image"
    assert (profile / "renders/nodehistory/demo/master.mp4").read_bytes() == b"synthetic-video"
    assert (profile / "renders/demo/legacy-template/master.mp4").read_bytes() == b"legacy-master"
    assert (profile / "productions/nodehistory/demo/work/results/test/legacy-render/preview.mp4").exists()
    assert (profile / "productions/nodehistory/demo/assets/thumbnails/cover.jpg").exists()
    html = (profile / "productions/nodehistory/demo/index.html").read_text()
    assert 'src="../../../_tools/explainer-kit/engine/loader.js"' in html
    assert 'src="./assets/cover.jpg"' in html
    storyboard = json.loads((profile / "productions/nodehistory/demo/assets/storyboard.json").read_text())
    assert storyboard["image"] == "/productions/nodehistory/demo/assets/cover.jpg"
    refs = json.loads((profile / "productions/nodehistory/demo/references.json").read_text())
    assert refs == {"master": str(profile / "renders/demo/legacy-template/master.mp4"), "media": str(profile / "resources/images/cat/image.png")}
    assert (profile / ".system/connections/accounts.json").stat().st_ino == sensitive_inode
    assert (profile / ".system/web-data/users.json").stat().st_ino == web_inode
    channels = json.loads((profile / "data/canales/channels.json").read_text())
    assert channels == [{"platform": "youtube", "alias": "demo", "title": "canonical", "local": 1}, {"platform": "facebook", "alias": "other"}]
    assert (profile / ".system/runtime/video_backups/queue.sqlite3").is_file()
    assert (profile / "logs/agents/agent1/run.log").read_bytes() == b"synthetic-agent-log"
    assert (profile / "logs/explainer/orphan.log").read_bytes() == b"synthetic-orphan-log"
    assert (profile / "config/niches.json").is_file()
    assert json.loads((profile / "config/image-styles/custom.json").read_text()) == {"custom": True}
    assert all(p.suffix == ".json" for p in (profile / "data").rglob("*") if p.is_file())
    items = json.loads((profile / "data/library/images.json").read_text())
    assert items[0]["path"] == str(profile / "resources/images/cat/image.png")
    assert items[0]["preview"] == str(profile / "renders/nodehistory/demo/master.mp4")
    log_rows = json.loads((profile / "data/logs/index.json").read_text())
    assert len(log_rows) == 1 and log_rows[0]["key"] == "logs/videos/demo/prod1.log"
    assert json.loads((profile / "data/content/videos.json").read_text())[0]["production_id"] == "prod1"
    resources = json.loads((profile / "data/content/resources.json").read_text())
    assert {r["storage_key"] for r in resources} == {"renders/nodehistory/demo/master.mp4", "renders/demo/legacy-template/master.mp4"}
    assert (templates / "nodehistory/demo/index.html").is_file()
    denied = call(profile, templates, "--local-rollback", "--migration-id", ident, "--confirm-maintenance")
    assert denied.returncode != 0
    done = call(profile, templates, "--local-rollback", "--migration-id", ident, "--confirm-maintenance", "--confirm-no-v2-writes")
    assert done.returncode == 0, done.stderr
    assert json.loads((profile / "profile.json").read_text())["schema_version"] == 1
    assert (profile / "data/library/files/images/cat/image.png").read_bytes() == b"synthetic-image"
    assert (profile / "output/nodehistory/demo/master.mp4").read_bytes() == b"synthetic-video"
    assert (profile / "connections/accounts.json").stat().st_ino == sensitive_inode
    assert (profile / "web-data/users.json").stat().st_ino == web_inode
    assert not (profile / "config/niches.json").exists()
    assert (profile / "config/image-styles/custom.json").is_file()


def test_rejects_changed_source_and_unsafe_symlink_before_activation(fixture, tmp_path):
    profile, templates, _, _ = fixture
    prep = call(profile, templates, "--local-prepare", "--confirm-maintenance", "--confirm-templates-owned")
    assert prep.returncode == 0, prep.stderr
    ident = next(line.split("=", 1)[1] for line in prep.stdout.splitlines() if line.startswith("migration_id="))
    put(profile / "data/new.json", b"{}")
    result = call(profile, templates, "--local-activate", "--migration-id", ident, "--confirm-maintenance")
    assert result.returncode != 0 and "cambiaron" in result.stderr
    assert json.loads((profile / "profile.json").read_text())["schema_version"] == 1
    outside = tmp_path / "outside"
    outside.write_text("keep")
    (profile / "data/link").symlink_to(outside)
    assert call(profile, templates, "--local-plan").returncode != 0
    assert outside.read_text() == "keep"


def test_rollback_rejects_changed_active_data(fixture):
    profile, templates, _, _ = fixture
    prep = call(profile, templates, "--local-prepare", "--confirm-maintenance", "--confirm-templates-owned")
    ident = next(line.split("=", 1)[1] for line in prep.stdout.splitlines() if line.startswith("migration_id="))
    assert call(profile, templates, "--local-activate", "--migration-id", ident, "--confirm-maintenance").returncode == 0
    put(profile / "data/new.json", b"{}")
    result = call(profile, templates, "--local-rollback", "--migration-id", ident, "--confirm-maintenance", "--confirm-no-v2-writes")
    assert result.returncode != 0 and "cambiaron" in result.stderr
    assert json.loads((profile / "profile.json").read_text())["schema_version"] == 2


def test_failed_activation_rolls_back_completed_moves(fixture, monkeypatch):
    profile, templates, sensitive_inode, _ = fixture
    spec = importlib.util.spec_from_file_location("local_migration_test", SCRIPT.parent / "profile_local_migration.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    ident = module.prepare(profile, templates)
    original_rename = os.rename
    count = 0

    def fail_once(source, destination):
        nonlocal count
        count += 1
        if count == 4:
            raise OSError("synthetic interruption")
        return original_rename(source, destination)

    monkeypatch.setattr(module.os, "rename", fail_once)
    with pytest.raises(OSError, match="synthetic interruption"):
        module.activate(profile, ident)
    assert json.loads((profile / "profile.json").read_text())["schema_version"] == 1
    assert (profile / "data/library/files/images/cat/image.png").read_bytes() == b"synthetic-image"
    assert (profile / "connections/accounts.json").stat().st_ino == sensitive_inode
    journal = json.loads((profile / ".system/migrations" / ident / "journal.json").read_text())
    assert journal["state"] == "rolled_back"


def test_changed_staging_and_foreign_absolute_path_are_rejected(fixture, tmp_path):
    profile, templates, _, _ = fixture
    external = tmp_path / "different-profile/data/file.json"
    put(profile / "data/external.json", json.dumps({"path": str(external)}).encode())
    failed = call(profile, templates, "--local-prepare", "--confirm-maintenance", "--confirm-templates-owned")
    assert failed.returncode != 0 and "externa" in failed.stderr
    (profile / "data/external.json").unlink()
    prep = call(profile, templates, "--local-prepare", "--confirm-maintenance", "--confirm-templates-owned")
    assert prep.returncode == 0, prep.stderr
    ident = next(line.split("=", 1)[1] for line in prep.stdout.splitlines() if line.startswith("migration_id="))
    put(profile / ".system/migrations" / ident / "staged/data/tampered.json", b"{}")
    result = call(profile, templates, "--local-activate", "--migration-id", ident, "--confirm-maintenance")
    assert result.returncode != 0 and "staging" in result.stderr
    assert json.loads((profile / "profile.json").read_text())["schema_version"] == 1


def test_orphan_video_receives_stable_identity_and_rolls_back(fixture):
    profile, templates, _, _ = fixture
    put(templates / "nodehistory/orphan/manifest.json", b'{"status":"archived"}')
    put(templates / "nodehistory/orphan/render/master.mp4", b"synthetic-orphan")
    result = call(profile, templates, "--local-prepare", "--confirm-maintenance", "--confirm-templates-owned")
    assert result.returncode == 0, result.stderr
    ident = next(line.split("=", 1)[1] for line in result.stdout.splitlines() if line.startswith("migration_id="))
    stage = profile / ".system/migrations" / ident / "staged/data"
    row = next(x for x in json.loads((stage / "content/videos.json").read_text()) if x["video_id"] == "orphan")
    assert row["production_id"].startswith("legacy-")
    details = json.loads((stage / "content/video_details/orphan.json").read_text())
    assert (details["legacy_source"], details["legacy_id"], details["status"]) == ("nodehistory/orphan", "orphan", "archived")
    assert call(profile, templates, "--local-activate", "--migration-id", ident, "--confirm-maintenance").returncode == 0
    assert (profile / "renders/orphan/legacy-template/master.mp4").exists()
    assert call(profile, templates, "--local-rollback", "--migration-id", ident, "--confirm-maintenance", "--confirm-no-v2-writes").returncode == 0
    assert json.loads((profile / "profile.json").read_text())["schema_version"] == 1
    result = call(profile, templates, "--local-prepare", "--confirm-maintenance", "--confirm-templates-owned")
    next_id = next(line.split("=", 1)[1] for line in result.stdout.splitlines() if line.startswith("migration_id="))
    second = profile / ".system/migrations" / next_id / "staged/data/content/videos.json"
    assert next(x for x in json.loads(second.read_text()) if x["video_id"] == "orphan")["production_id"] == row["production_id"]


def test_plan_rejects_video_id_in_multiple_categories(fixture):
    profile, templates, _, _ = fixture
    put(templates / "nodetech/demo/index.html", b"duplicate")
    result = call(profile, templates, "--local-plan")
    assert result.returncode != 0 and "Conflicto de video_id" in result.stderr


def test_channel_metadata_change_blocks_activation(fixture):
    profile, templates, _, _ = fixture
    result = call(profile, templates, "--local-prepare", "--confirm-maintenance", "--confirm-templates-owned")
    assert result.returncode == 0, result.stderr
    ident = next(line.split("=", 1)[1] for line in result.stdout.splitlines() if line.startswith("migration_id="))
    put(profile / "connections/channels.json", b'[{"platform":"youtube","alias":"changed"}]')
    result = call(profile, templates, "--local-activate", "--migration-id", ident, "--confirm-maintenance")
    assert result.returncode != 0 and "canales cambió" in result.stderr
    assert json.loads((profile / "profile.json").read_text())["schema_version"] == 1


def test_browser_profile_is_renamed_opaquely_and_restored(fixture, monkeypatch):
    profile, templates, _, _ = fixture
    old = profile / "data/browser_profiles"
    new = profile / ".system/browser-profiles"
    nested = put(old / "profile/opaque.json", b"synthetic-session")
    root_inode, nested_inode = old.stat().st_ino, nested.stat().st_ino
    spec = importlib.util.spec_from_file_location("local_migration_opaque_test", SCRIPT.parent / "profile_local_migration.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    original_open, original_scandir = Path.open, os.scandir

    def forbidden(path):
        path = Path(path)
        return path != old and path != new and (path.is_relative_to(old) or path.is_relative_to(new))

    def guarded_open(path, *args, **kwargs):
        assert not forbidden(path), "browser session content was opened"
        return original_open(path, *args, **kwargs)

    def guarded_scandir(path):
        assert Path(path) not in (old, new) and not forbidden(path), "browser session directory was traversed"
        return original_scandir(path)

    monkeypatch.setattr(Path, "open", guarded_open)
    monkeypatch.setattr(module.os, "scandir", guarded_scandir)
    module.plan(profile, templates)
    ident = module.prepare(profile, templates)
    assert old.stat().st_ino == root_inode
    assert not (profile / ".system/migrations" / ident / "staged/data/browser_profiles").exists()
    module.activate(profile, ident)
    assert new.stat().st_ino == root_inode
    assert (new / "profile/opaque.json").stat().st_ino == nested_inode
    assert not old.exists()
    module.rollback(profile, ident)
    assert old.stat().st_ino == root_inode
    assert (old / "profile/opaque.json").stat().st_ino == nested_inode


def test_existing_browser_destination_is_rejected_before_activation(fixture):
    profile, templates, _, _ = fixture
    source = profile / "data/browser_profiles"
    source.mkdir()
    prep = call(profile, templates, "--local-prepare", "--confirm-maintenance", "--confirm-templates-owned")
    assert prep.returncode == 0, prep.stderr
    ident = next(line.split("=", 1)[1] for line in prep.stdout.splitlines() if line.startswith("migration_id="))
    (profile / ".system/browser-profiles").mkdir()
    result = call(profile, templates, "--local-activate", "--migration-id", ident, "--confirm-maintenance")
    assert result.returncode != 0 and "destino" in result.stderr
    assert source.is_dir()
    assert json.loads((profile / "profile.json").read_text())["schema_version"] == 1


def test_browser_profile_file_is_rejected_without_opening(fixture, monkeypatch):
    profile, templates, _, _ = fixture
    invalid = put(profile / "data/browser_profiles", b"synthetic opaque bytes")
    spec = importlib.util.spec_from_file_location("local_migration_invalid_browser", SCRIPT.parent / "profile_local_migration.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    original_open = Path.open

    def guarded_open(path, *args, **kwargs):
        assert path != invalid, "invalid browser profile was opened"
        return original_open(path, *args, **kwargs)

    monkeypatch.setattr(Path, "open", guarded_open)
    with pytest.raises(ValueError, match="no es un directorio"):
        module.plan(profile, templates)
    assert not (profile / ".system").exists()


def test_nested_data_directory_is_inventoried_normally(fixture, monkeypatch):
    profile, _, _, _ = fixture
    nested = put(profile / "data/ordinary/data/browser_profiles/normal.json", b'{}')
    spec = importlib.util.spec_from_file_location("local_migration_nested_data", SCRIPT.parent / "profile_local_migration.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    original_open = Path.open
    opened = []

    def track_open(path, *args, **kwargs):
        if path == nested:
            opened.append(path)
        return original_open(path, *args, **kwargs)

    monkeypatch.setattr(Path, "open", track_open)
    module.inventory(profile / "data")
    assert opened == [nested]


def test_staged_browser_profile_file_is_rejected_without_opening(fixture, monkeypatch):
    profile, templates, _, _ = fixture
    spec = importlib.util.spec_from_file_location("local_migration_invalid_stage", SCRIPT.parent / "profile_local_migration.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    ident = module.prepare(profile, templates)
    staged = profile / ".system/migrations" / ident / "staged"
    invalid = put(staged / "data/browser_profiles", b"synthetic opaque bytes")
    original_open = Path.open

    def guarded_open(path, *args, **kwargs):
        assert path != invalid, "invalid staged browser profile was opened"
        return original_open(path, *args, **kwargs)

    monkeypatch.setattr(Path, "open", guarded_open)
    with pytest.raises(ValueError, match="no es un directorio"):
        module.activate(profile, ident)
    assert json.loads((profile / "profile.json").read_text())["schema_version"] == 1


def _add_standard_design(profile):
    row = {"id": "vida-en-escena", "category": "nodeaction", "state": "prueba"}
    released = {"id": "released-design", "category": "nodehistory", "state": "produccion"}
    put(profile / "data/showcase/designs.json", json.dumps([row, released]).encode())
    bundle = profile / "sandbox/designs/nodeaction/vida-en-escena"
    manifest = {**row, "schema_version": 1, "revision": "abc", "name": "Vida sintética",
                "family": "vida", "engine_id": "nodeaction/_vida", "promotable": True,
                "episodes": [{"id": "un-dia-cualquiera", "design_id": "vida-en-escena", "title": "Episodio sintético"}]}
    put(bundle / "design.json", json.dumps(manifest).encode())
    put(bundle / "catalog.json", b'{"schema_version":1,"design_id":"vida-en-escena","revision":"abc","entries":[]}')
    put(bundle / "showcase.html", b"synthetic preview")
    for name in ("components", "assets", "sets", "characters", "preview"):
        (bundle / name).mkdir()
    production_bundle = profile / "designs/nodehistory/released-design"
    put(production_bundle / "design.json", json.dumps({**released, "schema_version": 1, "revision": "def",
        "name": "Diseño publicado", "family": "synthetic", "engine_id": "synthetic"}).encode())
    put(production_bundle / "catalog.json", b'{"schema_version":1,"design_id":"released-design","revision":"def","entries":[]}')
    episode = profile / "sandbox/nodeaction/vida-en-escena"
    put(episode / "assets/episode.json", b'{"id":"un-dia-cualquiera"}')
    put(episode / "index.html", b"synthetic episode")
    audio = put(episode / "assets/dialogue.mp3", b"synthetic-voice")
    return bundle, episode, audio.stat().st_ino


def test_standard_design_and_profile_sandbox_survive_activation_and_rollback(fixture):
    profile, templates, _, _ = fixture
    bundle, episode, audio_inode = _add_standard_design(profile)
    bundle_inode = bundle.stat().st_ino
    released_inode = (profile / "designs/nodehistory/released-design").stat().st_ino
    from src.adapters.showcase.filesystem import FilesystemShowcaseAdapter
    from src.core.showcase.service import ShowcaseService
    shared_templates = SCRIPT.parents[1] / "src/templates"
    v1 = ShowcaseService(FilesystemShowcaseAdapter(profile, shared_templates, schema_version=1))
    assert v1.get_design("vida-en-escena").revision == "abc"
    prep = call(profile, templates, "--local-prepare", "--confirm-maintenance", "--confirm-templates-owned")
    assert prep.returncode == 0, prep.stderr
    ident = next(line.split("=", 1)[1] for line in prep.stdout.splitlines() if line.startswith("migration_id="))
    assert bundle.stat().st_ino == bundle_inode
    assert call(profile, templates, "--local-activate", "--migration-id", ident, "--confirm-maintenance").returncode == 0
    assert bundle.stat().st_ino == bundle_inode
    assert (episode / "assets/dialogue.mp3").stat().st_ino == audio_inode
    assert json.loads((profile / "data/showcase/designs.json").read_text())[0]["id"] == "vida-en-escena"
    v2 = ShowcaseService(FilesystemShowcaseAdapter(profile, shared_templates, schema_version=2))
    after = v2.get_design("vida-en-escena")
    assert after.revision == "abc" and after.episodes[0].id == "un-dia-cualquiera"
    assert after.episodes[0].preview_url == "/api/v1/explainer/files/sandbox/nodeaction/vida-en-escena/index.html"
    assert v2.catalog("vida-en-escena").revision == "abc"
    assert v2.get_design("released-design").state == "produccion"
    assert (profile / "designs/nodehistory/released-design").stat().st_ino == released_inode
    assert (profile / "sandbox/nodehistory/demo/index.html").is_file()
    assert call(profile, templates, "--local-rollback", "--migration-id", ident, "--confirm-maintenance", "--confirm-no-v2-writes").returncode == 0
    assert bundle.stat().st_ino == bundle_inode
    assert (episode / "assets/dialogue.mp3").stat().st_ino == audio_inode
    assert (profile / "designs/nodehistory/released-design").stat().st_ino == released_inode
    assert not (profile / "sandbox/nodehistory/demo").exists()


def test_sandbox_collision_is_detected_before_any_activation_moves(fixture):
    profile, templates, _, _ = fixture
    bundle, _, _ = _add_standard_design(profile)
    conflicting = put(profile / "sandbox/nodehistory/demo/index.html", b"owned-existing")
    inode = conflicting.stat().st_ino
    prep = call(profile, templates, "--local-prepare", "--confirm-maintenance", "--confirm-templates-owned")
    assert prep.returncode == 0, prep.stderr
    ident = next(line.split("=", 1)[1] for line in prep.stdout.splitlines() if line.startswith("migration_id="))
    result = call(profile, templates, "--local-activate", "--migration-id", ident, "--confirm-maintenance")
    assert result.returncode != 0 and "Colisión" in result.stderr
    assert conflicting.stat().st_ino == inode and bundle.is_dir()
    assert json.loads((profile / "profile.json").read_text())["schema_version"] == 1
    assert (profile / "data/showcase/designs.json").exists()


def test_sandbox_changes_after_prepare_stop_activation(fixture):
    profile, templates, _, _ = fixture
    bundle, _, _ = _add_standard_design(profile)
    prep = call(profile, templates, "--local-prepare", "--confirm-maintenance", "--confirm-templates-owned")
    assert prep.returncode == 0, prep.stderr
    ident = next(line.split("=", 1)[1] for line in prep.stdout.splitlines() if line.startswith("migration_id="))
    put(bundle / "assets/new.png", b"synthetic")
    result = call(profile, templates, "--local-activate", "--migration-id", ident, "--confirm-maintenance")
    assert result.returncode != 0 and "sandbox cambió" in result.stderr
    assert json.loads((profile / "profile.json").read_text())["schema_version"] == 1


def test_failed_activation_restores_standard_bundle(fixture, monkeypatch):
    profile, templates, _, _ = fixture
    bundle, episode, audio_inode = _add_standard_design(profile)
    inode = bundle.stat().st_ino
    spec = importlib.util.spec_from_file_location("local_migration_standard_failure", SCRIPT.parent / "profile_local_migration.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    ident = module.prepare(profile, templates)
    original = os.rename
    def fail_after_bundle(source, destination):
        if str(destination).endswith("/staged/sandbox/nodeaction/vida-en-escena"):
            raise OSError("synthetic sandbox interruption")
        return original(source, destination)
    monkeypatch.setattr(module.os, "rename", fail_after_bundle)
    with pytest.raises(OSError, match="synthetic sandbox interruption"):
        module.activate(profile, ident)
    assert bundle.stat().st_ino == inode
    assert (episode / "assets/dialogue.mp3").stat().st_ino == audio_inode
    assert json.loads((profile / "profile.json").read_text())["schema_version"] == 1


def test_missing_production_folder_inferred_from_unique_owned_source(fixture):
    profile, templates, _, _ = fixture
    path = profile / 'data/explainer/productions.json'
    rows = json.loads(path.read_text())
    rows[0]['folder'] = None
    rows[0]['category_path'] = 'node_history'
    path.write_text(json.dumps(rows))
    result = call(profile, templates, '--local-prepare', '--confirm-maintenance', '--confirm-templates-owned')
    assert result.returncode == 0, result.stderr
    ident = next(line.split('=', 1)[1] for line in result.stdout.splitlines() if line.startswith('migration_id='))
    data = profile / '.system/migrations' / ident / 'staged/data'
    assert json.loads((data / 'explainer/productions.json').read_text())[0]['folder'] == 'nodehistory'
    details = json.loads((data / 'content/video_details/demo.json').read_text())
    assert details['legacy_folder_inferred'] is True and not details['source_missing']
    assert json.loads(path.read_text())[0]['folder'] is None


def test_missing_production_folder_requires_unique_matching_category(fixture):
    profile, templates, _, _ = fixture
    path = profile / 'data/explainer/productions.json'
    rows = json.loads(path.read_text())
    rows[0]['folder'] = None
    rows[0]['category_path'] = 'node_tech'
    path.write_text(json.dumps(rows))
    result = call(profile, templates, '--local-prepare', '--confirm-maintenance', '--confirm-templates-owned')
    assert result.returncode != 0 and 'Categoría incompatible' in result.stderr
    assert json.loads((profile / 'profile.json').read_text())['schema_version'] == 1
