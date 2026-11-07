"""Sandbox isolation and promotion across synthetic v2 profiles."""
import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

from src.config.content_paths import content_key, resolve_content_key
from src.config.settings import settings
from src.core.explainer import promote, sandbox
from src.core.prototypes import briefs, ideas, runs


@pytest.fixture
def profile(tmp_path, monkeypatch):
    root = tmp_path / "one"
    (root / "sandbox").mkdir(parents=True)
    monkeypatch.setattr(settings, "storage_profile_dir", root)
    monkeypatch.setattr(settings, "storage_layout_version", 2)
    monkeypatch.setattr(settings, "data_dir", root / "data")
    monkeypatch.setattr(settings, "public_base_url", "https://nexa.example")
    return root


def test_v2_ideas_brief_and_preview_are_profile_isolated(profile, tmp_path, monkeypatch):
    idea = ideas.create_idea("nodehistory", "Primera idea", "Notas", [("ref image.png", b"test")])
    assert idea.path == profile / "sandbox/referencias/nodehistory/primera-idea"
    assert ideas.get_idea("nodehistory", idea.slug) == idea
    assert [entry.slug for entry in ideas.list_ideas()] == [idea.slug]
    brief = briefs.compose_brief("nodehistory", idea.slug)
    key = "sandbox/referencias/nodehistory/primera-idea/ref image.png"
    assert "https://nexa.example/api/v1/explainer/files/sandbox/referencias/nodehistory/primera-idea/ref%20image.png" in brief
    assert content_key(idea.files[0].path) == key
    assert resolve_content_key(key).read_bytes() == b"test"
    folders = sandbox.list_sandbox()
    item = next(f for f in folders if f.folder == "referencias").items[0]
    assert item.path == "sandbox/referencias/nodehistory/primera-idea"
    other = tmp_path / "two"
    monkeypatch.setattr(settings, "storage_profile_dir", other)
    assert ideas.list_ideas() == []
    assert not resolve_content_key(key).exists()
    with pytest.raises(FileNotFoundError):
        ideas.get_idea("nodehistory", idea.slug)
    with pytest.raises(ValueError):
        content_key(idea.files[0].path)
    with pytest.raises(ValueError):
        resolve_content_key("sandbox/../../one/profile.json")


def test_v2_promotion_stays_in_profile_and_uses_shared_engine(profile, tmp_path, monkeypatch):
    item = profile / "sandbox/nodehistory/demo"
    item.mkdir(parents=True)
    (item / "manifest.json").write_text(json.dumps({"status": "listo", "title": "Demo"}))
    (item / "index.html").write_text('<script src="../../../_tools/explainer-kit/engine/loader.js"></script>')
    loaded = sandbox.load_item(item)
    assert loaded.promotable and loaded.path == "sandbox/nodehistory/demo"
    plan = promote.promote(item)
    assert plan.destination == profile / "productions/nodehistory/demo"
    assert not item.exists()
    assert '/_tools/explainer-kit/engine/loader.js' in (plan.destination / "index.html").read_text()
    assert content_key(plan.destination) == "productions/nodehistory/demo"
    assert resolve_content_key(content_key(plan.destination)) == plan.destination
    monkeypatch.setattr(settings, "storage_profile_dir", tmp_path / "two")
    with pytest.raises(promote.PromoteError):
        promote.plan_promotion(plan.destination)
    assert not (tmp_path / "two/productions/nodehistory/demo").exists()


def test_v2_prototype_scope_and_shared_helpers_use_profile(profile, tmp_path):
    service = runs.PrototypeRunService(agent_getter=lambda _: None)
    scope = service._scope({"template_id": "demo"})
    assert scope.writable_dir == str(profile / "sandbox")
    assert scope.os_sandbox_dir == str(profile / "sandbox")
    assert scope.extra_env["NEXA_SANDBOX_DIR"] == str(profile / "sandbox")
    assert str(profile / "logs/videos/demo") in scope.extra_writable
    assert "Sandbox de este perfil" in service._prompt({"category": "otros", "idea_id": "demo", "template_id": "demo", "mode": "full"})
    # The shared helper must create metadata in the selected profile, not the repo.
    script = Path(__file__).resolve().parents[2] / "src/templates/_tools/sandbox/info.py"
    env = {**os.environ, "NEXA_SANDBOX_DIR": str(profile / "sandbox")}
    result = subprocess.run([sys.executable, str(script), "init", "otros/demo", "--engine", "explainer-kit:atlas"],
                            env=env, capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
    assert (profile / "sandbox/otros/demo/info.json").is_file()


@pytest.mark.asyncio
async def test_v2_router_lists_and_promotes_current_profile(profile, monkeypatch):
    from src.presentation.api.routers import sandbox as router

    item = profile / "sandbox/nodehistory/demo"
    item.mkdir(parents=True)
    (item / "manifest.json").write_text(json.dumps({"status": "listo", "title": "Demo", "demo": True}))
    (item / "index.html").write_text("<h1>demo</h1>")
    monkeypatch.setattr(router, "_busy_video_ids", lambda: set())
    listed = await router.get_explainer_sandbox()
    assert any(entry.folder == "nodehistory" and entry.items[0].id == "demo" and entry.items[0].demo for entry in listed)
    result = await router.promote_sandbox_video("nodehistory", "demo")
    assert result.from_path == "sandbox/nodehistory/demo"
    assert result.to_path == "productions/nodehistory/demo"
    assert (profile / result.to_path).is_dir()


def test_kit_promote_prints_virtual_paths(profile, tmp_path):
    item = profile / "sandbox/nodehistory/demo"
    item.mkdir(parents=True)
    (item / "manifest.json").write_text(json.dumps({"schema_version": 1, "status": "listo"}))
    (item / "index.html").write_text("<h1>demo</h1>")
    (profile / "profile.json").write_text(json.dumps({"schema_version": 2, "id": "testing"}))
    kit = Path(__file__).resolve().parents[2] / "src/templates/_tools/explainer-kit/tools/kit.py"
    env = {**os.environ, "NEXA_PROFILE_DIR": str(profile), "XDG_CONFIG_HOME": str(tmp_path / "xdg")}
    result = subprocess.run([sys.executable, str(kit), "promote", "demo"], env=env, capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
    assert "sandbox/nodehistory/demo → productions/nodehistory/demo" in result.stdout
    assert (profile / "productions/nodehistory/demo/index.html").is_file()


def test_v2_component_preview_and_run_response_use_profile(profile):
    from src.core.explainer import component_preview
    from src.presentation.api.routers.prototypes import _run_response
    from src.presentation.api.schemas.component_preview_schema import ComponentPreviewItem

    item = profile / "sandbox/nodehistory/atlas-demo"
    item.mkdir(parents=True)
    (item / "index.html").write_text("<h1>demo</h1>")
    (item / "info.json").write_text(json.dumps({"components": [{"name": "atlas.uno", "label": "Uno", "summary": "Prueba"}]}))
    request = ComponentPreviewItem(key="one", video_id="atlas-demo", component="atlas.uno", scope="sandbox")
    result = component_preview.build_component_previews([request])[0]
    assert result["preview_url"].startswith("/api/v1/explainer/files/sandbox/nodehistory/atlas-demo/index.html?")
    record = {"category": "nodehistory", "template_id": "atlas-demo"}
    assert _run_response(record)["template_url"] == "/api/v1/explainer/files/sandbox/nodehistory/atlas-demo/index.html?controls=1"


def test_v2_rejects_foreign_reference_symlinks(profile, tmp_path):
    outside = tmp_path / "other-profile"
    outside.mkdir()
    reference = profile / "sandbox/referencias"
    reference.mkdir()
    (reference / "otros").symlink_to(outside, target_is_directory=True)
    assert ideas.list_ideas() == []
    with pytest.raises(ideas.IdeaInputError):
        ideas.create_idea("otros", "Foreign", "", [])
    assert list(outside.iterdir()) == []
