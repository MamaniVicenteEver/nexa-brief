"""Offline accounting/scheduling hold tests; no renderer, publisher or live queues."""
import ast
import asyncio
from datetime import datetime, timezone
import json
from pathlib import Path
from types import SimpleNamespace
import uuid

import pytest


def function(name, namespace, file, class_name=None):
    root = Path(__file__).resolve().parents[2]
    relative = "src/core/explainer/recorder.py" if class_name else "src/core/schedule/engine.py"
    source = root / relative
    if not source.exists():
        source = Path(__file__).parent / file
    tree = ast.parse(source.read_text())
    body = next(node for node in tree.body if isinstance(node, ast.ClassDef) and node.name == class_name).body if class_name else tree.body
    node = next(node for node in body if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == name)
    tree = ast.Module(body=[ast.ImportFrom(module="__future__", names=[ast.alias(name="annotations")], level=0), node], type_ignores=[])
    exec(compile(ast.fix_missing_locations(tree), str(source), "exec"), namespace)
    return namespace[name]


@pytest.mark.parametrize("held", [False, True])
def test_render_registration_copies_hold_at_insert_without_changing_other_jobs(tmp_path, held):
    source = tmp_path / "production"
    source.mkdir()
    reason = "template_pilot_not_authorized_for_publication"
    manifest = {"publication_hold": True, "publication_hold_reason": reason} if held else {}
    (source / "manifest.json").write_text(json.dumps(manifest))
    video = SimpleNamespace(path=source, video_id="pilot-video", category_path="node_actualidad",
                            youtube_title="Pilot", title="Pilot", tiktok_caption="text",
                            duration_seconds=100, design="cara-a-cara")
    inserted = []
    class Store:
        async def insert(self, row):
            inserted.append(row.copy())
    namespace = {"Path": Path, "json": json, "uuid": uuid, "datetime": datetime, "timezone": timezone,
                 "settings": object(), "layout_for_settings": lambda _: SimpleNamespace(schema_version=3, logs_dir=tmp_path / "logs"),
                 "_copy_for": lambda *_: ("Title", "Description", []), "_clean": lambda x: x,
                 "read_publish": lambda _: {}, "collection": lambda _: Store(),
                 "JobStage": SimpleNamespace(PACKAGED=SimpleNamespace(value="packaged")),
                 "logger": SimpleNamespace(info=lambda *a, **k: None)}
    register = function("_register_for_scheduling", namespace, "recorder.hold.py", "ExplainerRecorder")
    # A render with publish=False still registers a packaged job. Hold is an
    # independent persisted policy, present at insertion rather than patched later.
    job_id = asyncio.run(register(None, video, source, ("9x16",), 3.5, recording_id="pilot"))
    assert job_id == inserted[0]["job_id"] and inserted[0]["stage"] == "packaged"
    assert inserted[0]["formats"] == ["9x16"]
    if held:
        assert inserted[0]["publication_hold"] is True and inserted[0]["publication_hold_reason"] == reason
    else:
        assert "publication_hold" not in inserted[0] and "publication_hold_reason" not in inserted[0]


def test_scheduler_skips_held_job_and_keeps_normal_oldest_selection():
    records = [{"job_id": "held", "created_at": "01", "category": "news", "publication_hold": True},
               {"job_id": "normal", "created_at": "02", "category": "news"}]
    namespace = {"job_tracker": SimpleNamespace(list_jobs=lambda **_: (records, len(records))),
                 "JobStage": SimpleNamespace(PACKAGED=SimpleNamespace(value="packaged")),
                 "category_matches": lambda value, expected: value == expected,
                 "queue_repository": SimpleNamespace(has_any_entry_for_target=lambda *_: False)}
    pick = function("_pick_oldest_ready_job", namespace, "schedule_engine.hold.py")
    slot = SimpleNamespace(niche_filter="news", platform="youtube", account_alias="test")
    assert pick(slot) == "normal"
    records.pop()
    assert pick(slot) is None
    records[0].pop("publication_hold")
    assert pick(slot) == "held"
