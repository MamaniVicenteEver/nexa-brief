"""Traza de preparaciones, tanto exitosas como fallidas, sin agentes reales."""
import json
from pathlib import Path

import pytest

from src.config.settings import settings
from src.core.explainer.usage_traces import events_for_content
from src.core.ports.agent_port import AgentRunResult

preparation = pytest.importorskip("src.core.prototypes.preparation")


@pytest.mark.parametrize("successful", [True, False])
async def test_preparation_records_actual_usage(tmp_path, monkeypatch, successful):
    root = tmp_path / "profile"
    root.mkdir()
    monkeypatch.setattr(settings, "storage_profile_dir", root)
    monkeypatch.setattr(settings, "storage_layout_version", 2)
    monkeypatch.setattr(settings, "data_dir", root / "data")
    project = root / "sandbox/nodehistory/demo"
    project.mkdir(parents=True)
    monkeypatch.setattr(preparation, "_project", lambda *_: project)
    monkeypatch.setattr(preparation, "_safe", lambda base, *parts: Path(base).joinpath(*parts))
    monkeypatch.setattr(preparation, "_context", lambda _: {})
    monkeypatch.setattr(preparation, "ensure_private_workspace", lambda _: None)

    class Rows:
        def __init__(self):
            self.patches = []

        async def update(self, _run_id, patch):
            self.patches.append(patch)

    class Agent:
        async def run(self, *args, **kwargs):
            return AgentRunResult(
                exit_code=0 if successful else 1,
                last_message=json.dumps({"title": "ok", "description": "ok", "missing": []}),
                duration_seconds=1, timed_out=False,
                usage={"input_tokens": 100, "output_tokens": 20}, model="model-x",
            )

    rows = Rows()
    service = preparation.PreparationService(agent_getter=lambda _: Agent())
    monkeypatch.setattr(service, "_rows", lambda: rows)
    rec = {"run_id": "run1", "folder": "nodehistory", "project_id": "demo", "agent": "codex",
           "log_path": str(tmp_path / "agent.log")}
    await service._run(rec)
    events = events_for_content("sandbox/nodehistory/demo")
    assert len(events) == 1 and events[0]["input_tokens"] == 100
    assert events[0]["ok"] == successful
    assert any(row.get("usage_trace_recorded") is True for row in rows.patches)
    assert rows.patches[-1]["state"] == ("review" if successful else "failed")
