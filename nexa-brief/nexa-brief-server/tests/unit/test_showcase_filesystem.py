"""Synthetic showcase profiles; shared engine files remain read-only."""

import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

import pytest

from src.adapters.showcase import filesystem
from src.adapters.showcase.bootstrap import bootstrap
from src.adapters.showcase.filesystem import FilesystemShowcaseAdapter
from src.core.showcase.ports import ShowcaseConflict, ShowcaseInvalid, ShowcaseNotFound
from src.core.showcase.service import ShowcaseService

SERVER = Path(__file__).resolve().parents[2]
TEMPLATES = SERVER / "src/templates"


@pytest.fixture
def adapter(tmp_path):
    return FilesystemShowcaseAdapter(tmp_path, TEMPLATES, schema_version=2)


def test_catalogs_and_legacy_use_one_service_without_copying_episodes(adapter, monkeypatch):
    monkeypatch.setattr("src.adapters.showcase.episode_relations.builtin_episode_relations", lambda *_: {})
    legacy_adapter = FilesystemShowcaseAdapter(adapter.root, TEMPLATES, schema_version=1)
    marker = adapter.root / "data/showcase/legacy-source.json"
    marker.parent.mkdir(parents=True)
    marker.write_text('{"schema_version":1,"owned":true}')
    svc = ShowcaseService(legacy_adapter)
    designs = svc.list_designs().designs
    assert len(designs) >= 16
    vida = svc.get_design("vida-en-escena")
    assert not vida.promotable
    assert [e.id for e in vida.episodes] == ["un-dia-cualquiera", "vida-en-escena-heladeria"]
    assert all("/sandbox/nodeaction/" in e.preview_url for e in vida.episodes)
    assert len(svc.catalog("vida-en-escena").entries) == 125
    assert len(svc.catalog("imperio").entries) > 0
    assert "isolated=1" in svc.preview("imperio", None, "9x16")
    assert "only=characters.heladero" in svc.preview("vida-en-escena", "characters.heladero", "16x9")
    assert "only=fx.%3F" in svc.preview("vida-en-escena", "fx.symbol-question", "9x16")
    assert not (adapter.root / "sandbox").exists()
    with pytest.raises(ShowcaseNotFound):
        ShowcaseService(adapter).get_design("vida-en-escena")


def test_bootstrap_and_promote_preserve_identity_and_shared_assets(adapter):
    engine = TEMPLATES / "sandbox/nodeaction/_vida/player.js"
    episode = TEMPLATES / "sandbox/nodeaction/vida-en-escena/assets/episode.json"
    before = [hashlib.sha256(p.read_bytes()).digest() for p in (engine, episode)]
    assert bootstrap(adapter)["status"] == "plan"
    assert not (adapter.root / "data").exists()
    assert bootstrap(adapter, apply=True, confirm_ownership=True)["status"] == "created"
    assert bootstrap(adapter, apply=True, confirm_ownership=True)["status"] == "already_present"
    svc = ShowcaseService(adapter)
    record = svc.get_design("vida-en-escena")
    assert record.state == "prueba" and record.promotable
    assert all(e.preview_url is None for e in record.episodes)
    assert (adapter.root / "sandbox/designs/nodeaction/vida-en-escena/showcase.html").is_file()
    promoted = svc.promote(record.id)
    assert promoted.state == "produccion" and [e.id for e in promoted.episodes] == [e.id for e in record.episodes]
    assert adapter.promote(record.id)["state"] == "produccion"
    assert not (adapter.root / "sandbox/designs/nodeaction/vida-en-escena").exists()
    assert (adapter.root / "designs/nodeaction/vida-en-escena/catalog.json").exists()
    assert [hashlib.sha256(p.read_bytes()).digest() for p in (engine, episode)] == before
    assert len(svc.catalog(record.id).entries) == 125
    with pytest.raises(ShowcaseConflict):
        adapter.promote("rough")


def test_promotion_failure_rolls_back_bundle_and_index(adapter, monkeypatch):
    bootstrap(adapter, apply=True, confirm_ownership=True)
    original = filesystem._write

    def fail_registry(path, value):
        if path == adapter.registry:
            raise OSError("synthetic failure")
        return original(path, value)

    monkeypatch.setattr(filesystem, "_write", fail_registry)
    with pytest.raises(OSError, match="synthetic failure"):
        adapter.promote("vida-en-escena")
    assert adapter.get_design("vida-en-escena")["state"] == "prueba"
    assert (adapter.root / "sandbox/designs/nodeaction/vida-en-escena").is_dir()
    assert not (adapter.root / "designs/nodeaction/vida-en-escena").exists()


def test_profile_isolation_and_safe_asset_paths(adapter, tmp_path):
    bootstrap(adapter, apply=True, confirm_ownership=True)
    other = FilesystemShowcaseAdapter(tmp_path / "other", TEMPLATES, schema_version=2)
    with pytest.raises(ShowcaseNotFound):
        ShowcaseService(other).get_design("vida-en-escena")
    bundle = adapter.root / "sandbox/designs/nodeaction/vida-en-escena"
    (bundle / "assets/audio.mp3").write_bytes(b"synthetic")
    assert adapter.resolve_file("vida-en-escena", "assets/audio.mp3").is_file()
    for path in ("../profile.json", "assets/access_token.json", "work/x.json", "assets/.env"):
        with pytest.raises(ShowcaseInvalid):
            adapter.resolve_file("vida-en-escena", path)
    (bundle / "assets/link.mp3").symlink_to(bundle / "assets/audio.mp3")
    with pytest.raises(ShowcaseInvalid):
        adapter.resolve_file("vida-en-escena", "assets/link.mp3")
    with pytest.raises(ShowcaseInvalid):
        adapter.promote("vida-en-escena")


def test_cli_plan_is_read_only(tmp_path):
    (tmp_path / "profile.json").write_text(json.dumps({"id": "synthetic", "schema_version": 1}))
    result = subprocess.run(
        [sys.executable, str(SERVER / "scripts/standardize-designs.py"), "--profile-dir", str(tmp_path)],
        text=True,
        capture_output=True,
        timeout=20,
    )
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout)["status"] == "plan"
    assert sorted(p.name for p in tmp_path.iterdir()) == ["profile.json"]


def test_interrupted_promotion_recovers_on_next_read(adapter):
    bootstrap(adapter, apply=True, confirm_ownership=True)
    row = adapter._rows()[0]
    before = adapter._managed(row)
    after = {**row, "state": "produccion"}
    source, target = adapter._bundle(row), adapter._bundle(after)
    target.parent.mkdir(parents=True, exist_ok=True)
    filesystem._write(adapter.runtime / "promotion.json", {"before": row, "after": after, "manifest_before": before})
    os.rename(source, target)
    filesystem._write(target / "design.json", {**before, "state": "produccion"})
    assert adapter.get_design("vida-en-escena")["state"] == "prueba"
    assert source.is_dir() and not target.exists()
    assert not (adapter.runtime / "promotion.json").exists()


def test_builtin_revision_tracks_catalog_changes(tmp_path):
    import shutil

    template = tmp_path / "templates"
    kit = template / "_tools/explainer-kit"
    (kit / "showcase").mkdir(parents=True)
    (kit / "designs/rough").mkdir(parents=True)
    for src, dest in (
        (TEMPLATES / "_tools/explainer-kit/designs/rough/design.json", kit / "designs/rough/design.json"),
        (TEMPLATES / "_tools/explainer-kit/catalog.json", kit / "catalog.json"),
    ):
        shutil.copyfile(src, dest)
    (kit / "showcase/designs.json").write_text('{"designs":["rough"]}')
    adapter = FilesystemShowcaseAdapter(tmp_path / "profile", template)
    first = adapter.get_design("rough")["revision"]
    catalog = kit / "catalog.json"
    catalog.write_text(catalog.read_text() + "\n")
    second = adapter.get_design("rough")["revision"]
    assert first != second == adapter.get_catalog("rough")["revision"]


def test_v2_empty_profile_never_reads_repository_episode(adapter, monkeypatch):
    forbidden = TEMPLATES / "sandbox/nodeaction/vida-en-escena/assets/episode.json"
    original = Path.open

    def guarded(path, *args, **kwargs):
        assert path != forbidden, "v2 inspected an episode outside the selected profile"
        return original(path, *args, **kwargs)

    monkeypatch.setattr(Path, "open", guarded)
    with pytest.raises(ShowcaseNotFound):
        ShowcaseService(adapter).get_design("vida-en-escena")
    with pytest.raises(ShowcaseInvalid):
        bootstrap(adapter, apply=True)
    bootstrap(adapter, apply=True, confirm_ownership=True)
    assert all(e.preview_url is None for e in ShowcaseService(adapter).get_design("vida-en-escena").episodes)


def test_v2_episode_preview_only_uses_selected_profile(adapter):
    episode = adapter.root / "sandbox/nodeaction/vida-en-escena"
    (episode / "assets").mkdir(parents=True)
    (episode / "assets/episode.json").write_text('{"id":"un-dia-cualquiera","title":"Sintético"}')
    (episode / "index.html").write_text("synthetic")
    bootstrap(adapter, apply=True, confirm_ownership=True)
    episodes = ShowcaseService(adapter).get_design("vida-en-escena").episodes
    assert episodes[0].preview_url == "/api/v1/explainer/files/sandbox/nodeaction/vida-en-escena/index.html"
    assert episodes[1].preview_url is None


def test_v1_repo_content_requires_confirmed_ownership(tmp_path, monkeypatch):
    monkeypatch.setattr("src.adapters.showcase.episode_relations.builtin_episode_relations", lambda *_: {})
    adapter = FilesystemShowcaseAdapter(tmp_path, TEMPLATES, schema_version=1)
    svc = ShowcaseService(adapter)
    with pytest.raises(ShowcaseNotFound):
        svc.get_design("vida-en-escena")
    assert bootstrap(adapter)["status"] == "plan"
    assert not (adapter.data / "showcase/legacy-source.json").exists()
    with pytest.raises(ShowcaseInvalid):
        bootstrap(adapter, apply=True)
    assert bootstrap(adapter, apply=True, confirm_ownership=True)["status"] == "created"
    assert json.loads((adapter.data / "showcase/legacy-source.json").read_text()) == {
        "schema_version": 1,
        "owned": True,
    }
    assert svc.get_design("vida-en-escena").episodes[0].preview_url is not None


@pytest.mark.parametrize("design_id,component", [
    ("cara-a-cara", "comparacion.dos-tarjetas"),
    ("atlas-cinematico", "atlas.highlight"),
    ("atlas-en-movimiento", "air.bomber"),
])
def test_generic_bootstrap_and_promotion_preserve_component_preview(tmp_path, monkeypatch, design_id, component):
    from urllib.parse import parse_qs, urlsplit

    monkeypatch.setattr("src.adapters.showcase.episode_relations.builtin_episode_relations", lambda *_: {})
    adapter = FilesystemShowcaseAdapter(tmp_path, TEMPLATES, schema_version=1)
    # This exercises the catalog contract only; real map caches are preflighted separately.
    if design_id == "atlas-cinematico":
        monkeypatch.setattr("src.adapters.showcase.legacy_catalogs.atlas_cache_ready", lambda *_: True)
    custom = tmp_path / "designs/AGENTS.md"
    custom.parent.mkdir(parents=True)
    custom.write_text("Guía personalizada")
    planned = bootstrap(adapter, design_id=design_id, confirm_ownership=True)
    assert planned["status"] == "plan" and not adapter.data.exists()
    assert bootstrap(adapter, design_id=design_id, apply=True, confirm_ownership=True)["status"] == "created"
    svc = ShowcaseService(adapter)
    before = svc.get_design(design_id)
    assert before.promotable and before.state == "prueba"
    catalog_before = svc.catalog(design_id)
    item = next(item for item in catalog_before.entries if item.name == component)
    target_before = svc.preview(design_id, item.id, "16x9")
    assert parse_qs(urlsplit(target_before).query)["only"] == [component]
    assert parse_qs(urlsplit(target_before).query)["aspect"] == ["16x9"]
    after = svc.promote(design_id)
    assert after.id == before.id and after.state == "produccion" and not after.promotable
    assert svc.preview(design_id, item.id, "16x9") == target_before
    assert svc.catalog(design_id).model_dump() == catalog_before.model_dump()
    assert custom.read_text() == "Guía personalizada"
    assert (tmp_path / "sandbox/designs/AGENTS.md").is_file()
    assert (tmp_path / "designs" / before.category / design_id / "AGENTS.md").is_file()
    assert bootstrap(adapter, design_id=design_id, apply=True, confirm_ownership=True)["status"] == "already_present"


def test_bootstrap_all_reports_unavailable_and_is_read_only_until_apply(tmp_path, monkeypatch):
    from src.adapters.showcase.bootstrap import bootstrap_all

    adapter = FilesystemShowcaseAdapter(tmp_path, TEMPLATES, schema_version=1)
    monkeypatch.setattr("src.adapters.showcase.legacy_catalogs.atlas_cache_ready", lambda *_: False)
    plan = bootstrap_all(adapter, confirm_ownership=True)
    rows = {entry["id"]: entry for entry in plan["designs"]}
    assert rows["cara-a-cara"]["status"] == "plan"
    assert rows["atlas-cinematico"]["status"] == "blocked"
    assert rows["atlas-en-movimiento"]["status"] == "plan"
    assert not adapter.data.exists() and not adapter.runtime.exists()
    with pytest.raises(ShowcaseInvalid):
        bootstrap_all(adapter, apply=True)


def test_generic_bootstrap_failure_rolls_back_without_removing_source(tmp_path, monkeypatch):
    from importlib import import_module

    adapter = FilesystemShowcaseAdapter(tmp_path, TEMPLATES, schema_version=1)
    bootstrap_module = import_module("src.adapters.showcase.bootstrap")
    original = bootstrap_module._write

    def fail_registry(path, value):
        if path == adapter.registry:
            raise OSError("synthetic failure")
        return original(path, value)

    monkeypatch.setattr(bootstrap_module, "_write", fail_registry)
    with pytest.raises(OSError, match="synthetic failure"):
        bootstrap(adapter, design_id="cara-a-cara", apply=True, confirm_ownership=True)
    assert not (tmp_path / "sandbox/designs/nodeaction/cara-a-cara").exists()
    assert (TEMPLATES / "sandbox/nodeaction/cara-a-cara/info.json").is_file()
    assert not adapter.registry.exists()


def test_recovery_finishes_confirmed_ownership_after_committed_bootstrap(tmp_path, monkeypatch):
    monkeypatch.setattr("src.adapters.showcase.episode_relations.builtin_episode_relations", lambda *_: {})
    adapter = FilesystemShowcaseAdapter(tmp_path, TEMPLATES, schema_version=1)
    bootstrap(adapter, design_id="cara-a-cara", apply=True, confirm_ownership=True)
    row = adapter._rows()[0]
    bundle = adapter._bundle(row)
    marker = ".bootstrap-synthetic"
    (bundle / marker).write_text("")
    (adapter.data / "showcase/legacy-source.json").unlink()
    filesystem._write(adapter.runtime / "promotion.json", {"kind": "bootstrap", "row": row,
                                                              "marker": marker, "own_legacy": True})
    assert adapter.get_design("cara-a-cara")["state"] == "prueba"
    assert adapter.allow_legacy_repo()
    assert not (bundle / marker).exists()
    assert not (adapter.runtime / "promotion.json").exists()


def test_generic_v2_bundle_keeps_selected_profile_preview_after_promotion(tmp_path):
    from urllib.parse import parse_qs, urlsplit

    adapter = FilesystemShowcaseAdapter(tmp_path, TEMPLATES, schema_version=2)
    source = tmp_path / "sandbox/nodeaction/synthetic-design"
    source.mkdir(parents=True)
    (source / "info.json").write_text(json.dumps({"title": "Diseño", "is_new_design": True, "engine": "synthetic",
                                                   "catalog": {"components": "components.json", "gallery": "showcase.html"}}))
    (source / "components.json").write_text(json.dumps({"components": [{"name": "demo.item", "demo": {"text": "A"},
                                                                           "params": {"text": {"type": "string"}}}]}))
    (source / "showcase.html").write_text("synthetic")
    (source / "index.html").write_text("synthetic episode")
    assert bootstrap(adapter, design_id="synthetic-design", apply=True, confirm_ownership=True)["status"] == "created"
    svc = ShowcaseService(adapter)
    before = svc.preview("synthetic-design", "demo.item", "16x9")
    assert before.startswith("/api/v1/explainer/files/sandbox/nodeaction/synthetic-design/")
    assert parse_qs(urlsplit(before).query)["only"] == ["demo.item"]
    assert svc.promote("synthetic-design").state == "produccion"
    assert svc.preview("synthetic-design", "demo.item", "16x9") == before
    assert (source / "showcase.html").read_text() == "synthetic"


def test_generic_promotion_rechecks_source_resources(tmp_path):
    adapter = FilesystemShowcaseAdapter(tmp_path, TEMPLATES, schema_version=2)
    source = tmp_path / "sandbox/nodeaction/temporary-design"
    source.mkdir(parents=True)
    (source / "info.json").write_text(json.dumps({"is_new_design": True, "engine": "synthetic",
                                                   "catalog": {"components": "components.json", "gallery": "showcase.html"}}))
    (source / "components.json").write_text(json.dumps({"components": [{"name": "demo.item", "demo": {}}]}))
    (source / "showcase.html").write_text("synthetic")
    bootstrap(adapter, design_id="temporary-design", apply=True, confirm_ownership=True)
    (source / "showcase.html").unlink()
    with pytest.raises(ShowcaseInvalid, match="recursos originales"):
        adapter.promote("temporary-design")
    assert adapter.get_design("temporary-design")["state"] == "prueba"
    assert (tmp_path / "sandbox/designs/nodeaction/temporary-design").is_dir()


def test_bootstrap_all_applies_complete_only_and_retries_idempotently(tmp_path):
    from src.adapters.showcase.bootstrap import bootstrap_all

    templates = tmp_path / "templates"
    templates.mkdir()
    adapter = FilesystemShowcaseAdapter(tmp_path / "profile", templates, schema_version=2)
    for ident, complete in (("design-a", True), ("design-b", True), ("incomplete", False)):
        source = adapter.sandbox / "nodeaction" / ident
        source.mkdir(parents=True)
        (source / "info.json").write_text(json.dumps({"title": ident, "is_new_design": True, "engine": "synthetic",
                                                       "catalog": {"components": "components.json", "gallery": "showcase.html"}}))
        (source / "components.json").write_text(json.dumps({"components": [{"name": "demo.item", "demo": {}}]}))
        if complete:
            (source / "showcase.html").write_text("synthetic")
    first = bootstrap_all(adapter, apply=True, confirm_ownership=True)
    statuses = {item["id"]: item["status"] for item in first["designs"]}
    assert statuses == {"design-a": "created", "design-b": "created", "incomplete": "blocked"}
    second = bootstrap_all(adapter, apply=True, confirm_ownership=True)
    statuses = {item["id"]: item["status"] for item in second["designs"]}
    assert statuses == {"design-a": "already_present", "design-b": "already_present", "incomplete": "blocked"}
    assert all((adapter.sandbox / "nodeaction" / ident).is_dir() for ident in statuses)
