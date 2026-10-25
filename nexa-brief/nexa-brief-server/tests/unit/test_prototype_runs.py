from __future__ import annotations

import asyncio
import json
from pathlib import Path

import pytest

from src.config.settings import settings
from src.core.prototypes import ideas, runs
from src.core.ports.agent_port import AgentRunResult


def _make_reference(templates: Path, slug_title: str) -> str:
    (templates / "sandbox").mkdir(parents=True, exist_ok=True)
    (templates / "sandbox" / "PROTOTIPO.md").write_text("# Prototipo", encoding="utf-8")
    idea = ideas.create_idea("nodehistory", slug_title, "Notas de prueba.", [], templates_dir=templates)
    return idea.slug


async def _wait_for_state(service: runs.PrototypeRunService, run_id: str, states: set[str]) -> dict:
    for _ in range(200):
        record = service.get(run_id)
        if record and record.get("state") in states:
            return record
        await asyncio.sleep(0.01)
    raise AssertionError(f"el run {run_id} no llegó a {states}")


class FakeLeader:
    def __init__(self, *, gate: asyncio.Event | None = None, started: asyncio.Event | None = None) -> None:
        self.gate = gate
        self.started = started
        self.calls: list[dict] = []
        self.active = 0
        self.max_active = 0

    def available(self) -> bool:
        return True

    async def run(self, prompt, *, cwd, log_path, timeout_seconds, scope=None):
        self.active += 1
        self.max_active = max(self.max_active, self.active)
        self.calls.append({"prompt": prompt, "cwd": cwd, "scope": scope})
        if self.started:
            self.started.set()
        try:
            if self.gate:
                await self.gate.wait()
            fields = prompt.split()
            template_id = next(part.removeprefix("template_id=") for part in fields if part.startswith("template_id="))
            category = "nodehistory"
            template = settings.templates_dir / "sandbox" / category / template_id
            template.mkdir(parents=True, exist_ok=True)
            (template / "info.json").write_text(
                json.dumps({"reference": "referencias/nodehistory/mapas-con-banderas"}),
                encoding="utf-8",
            )
            (template / "index.html").write_text("<h1>fake</h1>", encoding="utf-8")
            if "mode=smoke" in prompt:
                (template / "work" / "results").mkdir(parents=True)
                (template / "work" / "logs").mkdir(parents=True)
                (template / "work" / "results" / "smoke.md").write_text("OK\n", encoding="utf-8")
                (template / "work" / "logs" / "smoke.log").write_text(
                    "Trabajador Codex · modelo=gpt-6-luna\nEXIT 0\n", encoding="utf-8"
                )
            log_path.write_text("líder: OK\n", encoding="utf-8")
            return AgentRunResult(
                exit_code=0,
                last_message="OK",
                duration_seconds=0.01,
                usage={
                    "input_tokens": 120,
                    "cached_input_tokens": 30,
                    "output_tokens": 45,
                    "reasoning_tokens": 10,
                    "turns": 1,
                    "cost_usd": 0.01,
                },
                model="fake-opus",
            )
        finally:
            self.active -= 1


@pytest.fixture
def template_settings(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    templates = tmp_path / "nexa-brief-server" / "src" / "templates"
    monkeypatch.setattr(settings, "templates_dir", templates)
    monkeypatch.setattr(settings, "public_base_url", "https://nexa.example")
    return templates


@pytest.mark.asyncio
async def test_smoke_rebuilds_brief_scopes_agent_records_tokens_and_cleans_template(
    template_settings: Path,
    monkeypatch: pytest.MonkeyPatch,
):
    slug = _make_reference(template_settings, "Mapas con banderas")
    leader = FakeLeader()
    service = runs.PrototypeRunService(agent_getter=lambda _name: leader, timeout_seconds=20)
    recorded: list[tuple[dict, Path, dict]] = []

    async def record_usage(rec: dict, template_dir: Path, tokens: dict) -> bool:
        recorded.append((rec, template_dir, tokens))
        return True

    monkeypatch.setattr(service, "_record_template_usage", record_usage)
    record = await service.submit(
        category="nodehistory",
        slug=slug,
        agent="claude",
        template_id="mapas-prototype",
        mode="smoke",
    )
    result = await _wait_for_state(service, record["run_id"], {"done", "failed"})

    assert result["state"] == "done"
    assert result["template_id"] == f"zz-smoke-{slug}"
    assert result["claude_usage"]["input_tokens"] == 120
    assert result["codex_usage"] is None
    assert result["tokens"]["total_tokens"] == 165
    assert result["usage_recorded"] is True
    assert recorded[0][0]["agent"] == "claude"
    assert recorded[0][2]["model"] == "fake-opus"
    assert "nexa-brief-server/src/templates/sandbox/PROTOTIPO.md" in leader.calls[0]["prompt"]
    assert "BRIEF.md" in leader.calls[0]["prompt"]
    scope = leader.calls[0]["scope"]
    assert scope.writable_dir == "src/templates/sandbox"
    assert scope.model == "claude-opus-5-5" and scope.reasoning_effort == "high"
    assert scope.commands == runs.LEAD_COMMANDS
    assert scope.extra_writable == ("/tmp",)
    assert all(command != "Bash" for command in scope.commands)
    assert "tu cwd ya es la raíz de nexa-brief-server; no hagas cd" in leader.calls[0]["prompt"].lower()
    assert ".venv/bin/python src/templates/_tools/sandbox/" in leader.calls[0]["prompt"]
    assert "src/templates/_tools/sandbox/delegate.sh" in leader.calls[0]["prompt"]
    assert "no registres manualmente el rol prototype_lead" in leader.calls[0]["prompt"]
    assert not (template_settings / "sandbox" / "nodehistory" / f"zz-smoke-{slug}").exists()
    assert (template_settings / "sandbox" / "referencias" / "nodehistory" / slug / "BRIEF.md").is_file()
    assert service.log_tail(record["run_id"]) == "líder: OK"


@pytest.mark.asyncio
async def test_smoke_exit_zero_without_created_template_is_failed(template_settings: Path):
    slug = _make_reference(template_settings, "Smoke sin ejecución")

    class NoArtifactLeader:
        def available(self) -> bool:
            return True

        async def run(self, _prompt, *, log_path, **_kwargs):
            log_path.write_text("Claude terminó sin ejecutar la tarea.\n", encoding="utf-8")
            return AgentRunResult(exit_code=0, last_message="falló", duration_seconds=0.01)

    service = runs.PrototypeRunService(agent_getter=lambda _name: NoArtifactLeader(), timeout_seconds=20)
    record = await service.submit(
        category="nodehistory",
        slug=slug,
        agent="claude",
        template_id="smoke-fallo",
        mode="smoke",
    )
    result = await _wait_for_state(service, record["run_id"], {"done", "failed"})

    assert result["state"] == "failed"
    assert "no se creó una plantilla temporal" in result["error"]


@pytest.mark.asyncio
async def test_only_one_leader_runs_and_queued_run_can_be_cancelled(
    template_settings: Path,
):
    first_slug = _make_reference(template_settings, "Primera idea")
    second_slug = _make_reference(template_settings, "Segunda idea")
    gate = asyncio.Event()
    started = asyncio.Event()
    leader = FakeLeader(gate=gate, started=started)
    service = runs.PrototypeRunService(agent_getter=lambda _name: leader, timeout_seconds=20)
    service._record_template_usage = lambda *_args: asyncio.sleep(0, result=True)

    first = await service.submit(
        category="nodehistory",
        slug=first_slug,
        agent="claude",
        template_id="primera-plantilla",
        mode="full",
    )
    await asyncio.wait_for(started.wait(), timeout=1)
    second = await service.submit(
        category="nodehistory",
        slug=second_slug,
        agent="codex",
        template_id="segunda-plantilla",
        mode="full",
    )
    assert service.get(first["run_id"])["state"] == "running"
    assert service.get(second["run_id"])["state"] == "queued"
    assert leader.max_active == 1

    cancelled = await service.cancel(second["run_id"])
    assert cancelled["state"] == "cancelled"
    gate.set()
    done = await _wait_for_state(service, first["run_id"], {"done", "failed"})
    assert done["state"] == "done"
    assert service.get(second["run_id"])["state"] == "cancelled"
    assert leader.max_active == 1


@pytest.mark.asyncio
async def test_recovery_fails_orphaned_leader_and_resumes_persisted_queue(
    template_settings: Path,
    tmp_path: Path,
):
    slug = _make_reference(template_settings, "Idea en cola")
    leader = FakeLeader()
    service = runs.PrototypeRunService(agent_getter=lambda _name: leader, timeout_seconds=20)
    service._record_template_usage = lambda *_args: asyncio.sleep(0, result=True)
    log_path = tmp_path / "logs" / "queued.log"
    common = {
        "category": "nodehistory",
        "idea_id": slug,
        "agent": "codex",
        "model": "gpt-6-sol",
        "reasoning_effort": "high",
        "mode": "full",
        "error": None,
        "claude_usage": None,
        "codex_usage": None,
        "tokens": None,
        "usage_recorded": False,
        "log_path": str(log_path),
        "created_at": "2026-10-25T00:00:00+00:00",
        "started_at": "2026-10-25T00:00:01+00:00",
        "finished_at": None,
        "updated_at": "2026-10-25T00:00:01+00:00",
    }
    await service._col().insert({
        **common,
        "run_id": "orphaned-run",
        "template_id": "orphaned-template",
        "state": "running",
    })
    await service._col().insert({
        **common,
        "run_id": "queued-run",
        "template_id": "queued-template",
        "state": "queued",
        "started_at": None,
    })

    recovered = await service.recover_interrupted()
    orphan = service.get("orphaned-run")
    queued = await _wait_for_state(service, "queued-run", {"done", "failed"})

    assert recovered == 1
    assert orphan["state"] == "failed"
    assert "servidor se reinició" in orphan["error"]
    assert queued["state"] == "done"
    assert queued["codex_usage"]["output_tokens"] == 45
