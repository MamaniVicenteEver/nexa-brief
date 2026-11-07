"""V2 usage, batch cleanup and backup metadata without real media or credentials."""
import importlib.util
import json
from pathlib import Path
import sys

import pytest

from src.config.settings import settings
from src.core.data import collection
from src.core.explainer import batches
from src.core.explainer.backup_event import write_render_event

SERVER = Path(__file__).resolve().parents[2]
TOOLS = SERVER / "src/templates/_tools/explainer-kit/tools"
spec = importlib.util.spec_from_file_location("profile_usage_test", TOOLS / "usage.py")
usage = importlib.util.module_from_spec(spec)
spec.loader.exec_module(usage)
sys.path.insert(0, str(SERVER.parent / "scripts/video_storage"))
from storage_discovery import cli_spec  # noqa: E402


@pytest.fixture
def profile(tmp_path, monkeypatch):
    root = tmp_path / "profile"
    root.mkdir()
    monkeypatch.setattr(settings, "storage_profile_dir", root)
    monkeypatch.setattr(settings, "storage_layout_version", 2)
    monkeypatch.setattr(settings, "data_dir", root / "data")
    return root


def test_usage_agent_writes_only_logs_and_host_reference_is_deferred(profile):
    video = profile / "productions/nodehistory/demo"
    video.mkdir(parents=True)
    usage.record(video, provider="codex", model="test", role="producer", input_tokens=9)
    summary = usage.summarize(video)
    ledger = usage.ledger_path(video)
    assert ledger.is_relative_to(profile / "logs/videos/demo")
    assert usage.summary_path(video).is_file()
    assert summary["totals"]["input_tokens"] == 9
    assert not (video / "work/usage.jsonl").exists()
    assert not (video / "usage.json").exists()
    assert not (profile / "data").exists()


async def test_host_registers_usage_once_and_keeps_other_profile_isolated(profile, tmp_path, monkeypatch):
    video = profile / "sandbox/nodehistory/demo"
    video.mkdir(parents=True)
    usage.record(video, provider="codex", model="test", role="prototype", input_tokens=9)
    assert not (profile / "data").exists()
    first = await usage.register_reference(video)
    assert first == await usage.register_reference(video)
    records = collection("execution_logs").list()
    assert len(records) == 1 and records[0]["log_id"] == first
    assert records[0]["key"].startswith("logs/videos/demo/usage-")
    other = tmp_path / "other"
    monkeypatch.setattr(settings, "storage_profile_dir", other)
    monkeypatch.setattr(settings, "data_dir", other / "data")
    with pytest.raises(ValueError):
        usage.ledger_path(video)
    assert not other.exists()


def test_v2_backup_event_and_discovery_reference_original_files(profile, tmp_path, monkeypatch):
    monkeypatch.delenv("NEXA_RENDER_MANAGED", raising=False)
    video = profile / "productions/nodehistory/demo"
    video.mkdir(parents=True)
    (video / "manifest.json").write_text(json.dumps({"video_id": "demo", "design": "rough"}))
    (video / "index.html").write_text("<h1>demo</h1>")
    (video / "assets").mkdir()
    (video / "assets/source.txt").write_text("synthetic")
    render = profile / "renders/demo/run-1"
    render.mkdir(parents=True)
    master = render / "demo-16x9.mp4"
    master.write_bytes(b"synthetic video")
    templates = tmp_path / "templates"
    (templates / "_tools/explainer-kit/engine").mkdir(parents=True)
    (templates / "_tools/explainer-kit/engine/loader.js").write_text("// fake")
    event_path = write_render_event(video, templates, profile / "data", "demo", ["16x9"], output_dir=render)
    event = json.loads(event_path.read_text())
    assert (profile / ".system/runtime/tmp").is_dir()
    assert not list(event_path.parent.glob(".event-*"))
    assert event["schema_version"] == 2 and event["source_key"] == "productions/nodehistory/demo"
    assert event["outputs"]["16x9"]["storage_key"] == "renders/demo/run-1/demo-16x9.mp4"
    result = cli_spec(event, templates, profile)
    files = {row["target"]: row["source"] for row in result["files"]}
    assert files["output/demo-16x9.mp4"] == str(master)
    assert "project/templates/_tools/explainer-kit/engine/loader.js" in files
    assert not (video / "render/demo-16x9.mp4").exists()
    master.write_bytes(b"new")
    with pytest.raises(ValueError, match="changed"):
        cli_spec(event, templates, profile)
    with pytest.raises(ValueError):
        write_render_event(video, templates, profile / "data", "demo", ["16x9"], output_dir=tmp_path)


async def test_delete_batch_preserves_history_renders_and_other_videos(profile):
    from src.core.content_registry import upsert_video
    from src.core.data import documents
    video = profile / "productions/nodehistory/demo"
    video.mkdir(parents=True)
    (video / "manifest.json").write_text(json.dumps({"video_id": "demo", "production_id": "prod1"}))
    log = profile / "logs/videos/demo/prod1.log"
    log.parent.mkdir(parents=True)
    log.write_text("synthetic log")
    render = profile / "renders/demo/run/master.mp4"
    render.parent.mkdir(parents=True)
    render.write_bytes(b"master")
    other = profile / "productions/nodehistory/other"
    other.mkdir(parents=True)
    (other / "manifest.json").write_text(json.dumps({"production_id": "prod2"}))
    await collection("explainer_batches").insert({"batch_id": "batch", "state": "scheduled", "parallel": 1,
                                                   "scheduled_at": "2099-01-01T00:00:00+00:00"})
    await collection("explainer_productions").insert({"production_id": "prod1", "video_id": "demo", "folder": "nodehistory", "batch_id": "batch", "state": "ready"})
    await upsert_video("demo", "prod1", details={"recordings": {"run": {"asset_ids": ["render"]}}})
    await upsert_video("other", "prod2", details={"status": "ready"})
    await collection("content_resources").insert({"asset_id": "source", "video_id": "demo", "storage_key": "productions/nodehistory/demo/assets/a.jpg"})
    await collection("content_resources").insert({"asset_id": "render", "video_id": "demo", "storage_key": "renders/demo/run/master.mp4"})
    await collection("execution_logs").insert({"log_id": "log1", "key": "logs/videos/demo/prod1.log", "kind": "production", "production_id": "prod1"})
    result = await batches.delete_batch("batch", delete_files=True)
    assert result["files_deleted"] and not video.exists() and not log.exists()
    assert render.read_bytes() == b"master" and other.exists()
    assert collection("content_videos").get("demo")["status"] == "deleted"
    detail = documents("content_video_details").get("demo")
    assert detail["production_deleted"] and detail["source_missing"] and detail["recordings"]
    assert documents("content_video_details").get("other")["status"] == "ready"
    assert collection("content_videos").get("other")["production_id"] == "prod2"
    assert collection("content_resources").get("source")["available"] is False
    assert "available" not in collection("content_resources").get("render")


def test_sandbox_costs_reads_profile_usage_ledger(profile):
    from src.templates._tools.sandbox.costs import calculate_costs
    video = profile / "sandbox/nodehistory/demo"
    video.mkdir(parents=True)
    (video / "info.json").write_text(json.dumps({"title": "Demo", "engine": "explainer-kit:rough"}))
    usage.record(video, provider="codex", model="test", role="lead", input_tokens=12, output_tokens=4)
    usage.summarize(video)
    cost = calculate_costs(profile / "sandbox", "nodehistory", "demo")
    assert cost["totals_by_model"][0]["input_tokens"] == 12
    assert cost["totals_by_model"][0]["output_tokens"] == 4


async def test_delete_batch_rejects_unregistered_or_foreign_log_paths(profile, tmp_path):
    video = profile / "productions/nodehistory/demo"
    video.mkdir(parents=True)
    (video / "manifest.json").write_text(json.dumps({"production_id": "prod1"}))
    outside = tmp_path / "outside.log"
    outside.write_text("keep")
    await collection("explainer_batches").insert({"batch_id": "batch", "state": "scheduled", "parallel": 1,
                                                   "scheduled_at": "2099-01-01T00:00:00+00:00"})
    await collection("explainer_productions").insert({"production_id": "prod1", "video_id": "demo", "folder": "nodehistory", "batch_id": "batch", "state": "ready"})
    await collection("execution_logs").insert({"log_id": "bad", "key": str(outside), "kind": "production", "production_id": "prod1"})
    with pytest.raises(ValueError, match="log"):
        await batches.delete_batch("batch", delete_files=True)
    assert outside.read_text() == "keep" and video.exists()


def test_v2_pending_event_reaches_supervisor_queue_without_copying_media(profile, tmp_path, monkeypatch):
    import storage_supervisor as supervisor
    monkeypatch.delenv("NEXA_RENDER_MANAGED", raising=False)
    (profile / "profile.json").write_text(json.dumps({"schema_version": 2, "id": "demo"}))
    video = profile / "productions/nodehistory/demo"
    video.mkdir(parents=True)
    (video / "manifest.json").write_text(json.dumps({"video_id": "demo", "design": "rough"}))
    (video / "index.html").write_text("<h1>demo</h1>")
    render = profile / "renders/demo/run"
    render.mkdir(parents=True)
    master = render / "demo-16x9.mp4"
    master.write_bytes(b"synthetic video")
    templates = tmp_path / "templates"
    templates.mkdir()
    activation = profile / "data/video_backups/activation.json"
    activation.parent.mkdir(parents=True)
    activation.write_text(json.dumps({"started_at": "2020-01-01T00:00:00+00:00"}))
    write_render_event(video, templates, profile / "data", "demo", ["16x9"], output_dir=render)
    monkeypatch.setattr(supervisor, "process_pending", lambda *_: None)
    config = {"profile": str(profile), "templates": str(templates), "mount": str(tmp_path / "absent"), "uuid": "fake"}
    result = supervisor.cycle(config)
    assert result["enqueued"] == 1 and not result["errors"]
    assert result["counts"]["queued"] == 1
    assert master.read_bytes() == b"synthetic video"
    assert not (tmp_path / "absent").exists()
