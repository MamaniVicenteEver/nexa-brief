"""Model hub (roles.json), uso de tokens de los agentes locales y registro de uso del video."""

import json

import pytest

from src.adapters.agent.infrastructure.cli_runner import CODEX_API_ENV, claude_usage, codex_usage
from src.adapters.models import hub
from src.core.explainer import usage as video_usage
from src.core.explainer.producer import build_agent_prompt, readable_log
from src.core.ports.agent_port import AgentRunResult


def test_roles_point_to_known_providers():
    cfg = hub.roles_config()
    for role, spec in cfg["roles"].items():
        assert spec["provider"] in cfg["providers"], role
    assert hub.provider_for("producer") == "codex"
    assert hub.provider_for("component_draft") == "deepseek"
    assert hub.model_for("component_draft") == "deepseek-v4-flash"
    assert hub.provider_for("text_draft") == "codex"
    assert hub.model_for("text_draft") == "gpt-6.1-terra"
    assert hub.model_for("dialogue_draft") == "gpt-6.1-terra"
    with pytest.raises(ValueError):
        hub.provider_for("no-existe")
    with pytest.raises(ValueError):
        hub.agent_for("component_draft")   # DeepSeek no es un agente local
    assert {r["role"] for r in hub.describe()} >= {"producer", "fact_check", "voice"}


def test_codex_runs_only_with_local_session():
    assert "OPENAI_API_KEY" in CODEX_API_ENV and "CODEX_API_KEY" in CODEX_API_ENV


def test_codex_usage_sums_every_turn(tmp_path):
    log = tmp_path / "p.log"
    log.write_text("\n".join([
        "$ codex exec --json …",
        json.dumps({"type": "turn.completed", "usage": {"input_tokens": 1000, "cached_input_tokens": 800, "output_tokens": 50, "reasoning_output_tokens": 20}}),
        json.dumps({"type": "item.completed", "item": {"type": "agent_message", "text": "hola"}}),
        json.dumps({"type": "turn.completed", "usage": {"input_tokens": 500, "cached_input_tokens": 0, "output_tokens": 5, "reasoning_output_tokens": 0}}),
    ]))
    assert codex_usage(log) == {"input_tokens": 1500, "cached_input_tokens": 800, "output_tokens": 55, "reasoning_tokens": 20, "turns": 2}
    assert codex_usage(tmp_path / "no-existe.log") == {}


def test_claude_usage_from_result_event(tmp_path):
    log = tmp_path / "c.log"
    log.write_text(json.dumps({
        "type": "result", "result": "listo", "num_turns": 7, "total_cost_usd": 1.25,
        "usage": {"input_tokens": 10, "cache_creation_input_tokens": 90, "cache_read_input_tokens": 4000, "output_tokens": 300},
        "modelUsage": {"claude-opus-5-5": {}},
    }) + "\n")
    usage, model = claude_usage(log)
    assert usage["input_tokens"] == 100 and usage["cached_input_tokens"] == 4000 and usage["output_tokens"] == 300
    assert usage["turns"] == 7 and usage["cost_usd"] == 1.25 and model == "claude-opus-5-5"


def test_video_ledger_counts_iterations_and_summarizes(tmp_path):
    result = AgentRunResult(exit_code=0, last_message="ok", duration_seconds=12.5, model="gpt-6-luna",
                            usage={"input_tokens": 2000, "cached_input_tokens": 1500, "output_tokens": 300, "reasoning_tokens": 40, "turns": 3})
    first = video_usage.record_agent_run(tmp_path, "codex", result)
    second = video_usage.record_agent_run(tmp_path, "codex", result)
    assert (first["iteration"], second["iteration"]) == (1, 2)
    assert first["billing"] == "suscripción"
    summary = video_usage.summarize(tmp_path)
    assert summary["totals"]["calls"] == 2 and summary["totals"]["input_tokens"] == 4000
    assert summary["by_model"]["codex:gpt-6-luna"]["output_tokens"] == 600
    assert summary["iterations"] == {"producer": 2}
    assert summary["api_tokens"] == {}          # Codex no se paga por token
    assert json.loads((tmp_path / "usage.json").read_text())["video"] == tmp_path.name


def test_readable_log_understands_codex_events():
    raw = "\n".join([
        json.dumps({"type": "item.completed", "item": {"type": "agent_message", "text": "Investigo la RAM"}}),
        json.dumps({"type": "item.completed", "item": {"type": "command_execution", "command": "kit.py status ram", "exit_code": 0}}),
        json.dumps({"type": "turn.completed", "usage": {"input_tokens": 10, "output_tokens": 2}}),
    ])
    text = readable_log(raw)
    assert "· Investigo la RAM" in text and "→ comando: kit.py status ram (código 0)" in text and "✓ vuelta" in text


def test_agent_prompt_explains_delegation_and_usage(tmp_path):
    record = {"video_id": "ram-ia", "design": "rough", "category_path": "node_tech", "topic": "La RAM", "agent": "codex",
              "target_minutes": 12}
    prompt = build_agent_prompt(record, tmp_path / "ram-ia")
    assert "delegate ram-ia <rol> --prompt-file" in prompt
    assert "text_draft" in prompt and "dialogue_draft" in prompt and "Terra" in prompt
    assert "orquestacion.md" in prompt and "usage ram-ia" in prompt and "Fecha de hoy:" in prompt
