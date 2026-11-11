"""Provider accounting regressions; synthetic ledgers and real token-only fixture, no paid APIs."""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import sys

import pytest

BASE = Path(__file__).resolve().parents[2]
FILES = {
    "claude_usage_normalization.py": "src/adapters/agent/infrastructure/claude_usage_normalization.py",
    "usage_overlay.py": "src/core/explainer/usage_overlay.py",
    "costs.usage.py": "src/templates/_tools/sandbox/costs.py",
    "tool_usage.usage.py": "src/templates/_tools/explainer-kit/tools/usage.py",
    "tts.usage.py": "src/templates/_tools/explainer-kit/tools/tts.py",
}

def source(file):
    return BASE / FILES[file]


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, source(file))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def modules(monkeypatch):
    normalizer = load("staged_claude_usage", "claude_usage_normalization.py")
    monkeypatch.setitem(sys.modules, "src.adapters.agent.infrastructure.claude_usage_normalization", normalizer)
    overlay = load("staged_overlay", "usage_overlay.py")
    monkeypatch.setitem(sys.modules, "src.core.explainer.usage_overlay", overlay)
    costs = load("staged_costs", "costs.usage.py")
    return normalizer, overlay, costs


@pytest.fixture
def real_result():
    return json.loads((BASE / "tests/fixtures/usage/claude-result-alma-real.json").read_text())


def test_real_cli_fixture_keeps_cache_creation_and_thinking_without_double_counting(modules, real_result):
    normalizer, _, costs = modules
    before = copy.deepcopy(real_result)
    usage = normalizer.normalize_claude_result(real_result)
    assert usage["input_tokens"] == 39905
    assert usage["uncached_input_tokens"] == 18
    assert usage["cache_creation_input_tokens"] == 39887
    assert usage["cached_input_tokens"] == 240686
    assert usage["output_tokens"] == 28150
    assert usage["reasoning_tokens"] == 19185
    assert costs._total_tokens("claude", usage) == 308741
    assert usage["cost_usd"] == 0.02446106 and usage["cost_basis"] == "list"
    assert usage["provider_usage"]["usage"] == real_result["usage"]
    assert real_result == before


def test_unknown_cost_and_unknown_tokens_remain_explicit(modules):
    normalizer, _, _ = modules
    usage = normalizer.normalize_claude_result({})
    assert usage["cost_usd"] is None and usage["cost_basis"] is None
    assert usage["input_tokens"] is None and usage["reasoning_tokens"] is None
    assert usage["usage_known"] is False


def evidence(tmp_path, real_result):
    ledger = tmp_path / "usage.jsonl"
    row = {"event_id": "original-ledger-id", "provider": "claude", "model": "claude-haiku-5-5",
           "role": "producer", "step": "guion", "input_tokens": 18, "cached_input_tokens": 0,
           "output_tokens": 28150, "reasoning_tokens": 0, "seconds": 117.77, "ok": True}
    ledger.write_text(json.dumps(row) + "\n")
    raw = tmp_path / "production.log"
    raw.write_text("[agente guion]\n" + json.dumps(real_result) + "\n")
    return ledger, raw, row


def test_overlay_preserves_ledger_and_survives_legitimate_appended_events(modules, real_result, tmp_path):
    _, overlay, _ = modules
    ledger, raw, original = evidence(tmp_path, real_result)
    original_bytes = ledger.read_bytes()
    correction = overlay.build_claude_overlay(ledger, raw)
    assert not correction["unresolved"] and len(correction["replacements"]) == 1
    assert ledger.read_bytes() == original_bytes
    ledger.with_name(ledger.name + ".normalization.json").write_text(json.dumps(correction))
    result = overlay.apply_overlay(ledger, [original])
    assert len(result) == 1 and result[0]["event_id"] == original["event_id"]
    assert result[0]["cached_input_tokens"] == 240686
    appended = {"event_id": "new-render-event", "provider": "kit", "step": "render", "ok": True}
    with ledger.open("a") as stream:
        stream.write(json.dumps(appended) + "\n")
    result = overlay.apply_overlay(ledger, [original, appended])
    assert len(result) == 2 and result[0]["cached_input_tokens"] == 240686 and result[1] == appended


def test_missing_paid_result_is_recovered_once_with_provenance(modules, real_result, tmp_path):
    _, overlay, _ = modules
    ledger, raw, original = evidence(tmp_path, real_result)
    second = copy.deepcopy(real_result)
    second["uuid"] = "missing-call-result-id"
    second["duration_ms"] = 10000
    with raw.open("a") as stream:
        stream.write("[agente media_seleccion]\n" + json.dumps(second) + "\n" + json.dumps(second) + "\n")
    correction = overlay.build_claude_overlay(ledger, raw)
    assert len(correction["recovered_events"]) == 1
    recovered = correction["recovered_events"][0]
    assert recovered["provider_result_id"] == second["uuid"]
    assert recovered["normalization_source"]["method"] == "raw-result-without-ledger-event"
    ledger.with_name(ledger.name + ".normalization.json").write_text(json.dumps(correction))
    result = overlay.apply_overlay(ledger, [original])
    assert len(result) == 2 and sum(r["cost_usd"] for r in result) == pytest.approx(0.04892212)


def test_changed_source_and_ambiguous_matches_do_not_invent_corrections(modules, real_result, tmp_path):
    _, overlay, _ = modules
    ledger, raw, original = evidence(tmp_path, real_result)
    correction = overlay.build_claude_overlay(ledger, raw)
    ledger.with_name(ledger.name + ".normalization.json").write_text(json.dumps(correction))
    raw.write_text("changed raw evidence")
    assert overlay.apply_overlay(ledger, [original]) == [original]
    raw.write_text("[agente guion]\n" + json.dumps(real_result) + "\n")
    unknown = {**original, "event_id": "unmatched-old-row", "output_tokens": 999}
    with ledger.open("a") as stream:
        stream.write(json.dumps(unknown) + "\n")
    correction = overlay.build_claude_overlay(ledger, raw)
    assert correction["unresolved"] and correction["recovered_events"] == []


def test_usage_endpoint_model_rows_include_unknown_calls_and_reported_list_cost(modules, real_result, tmp_path, monkeypatch):
    normalizer, _, costs = modules
    measured = {"provider": "claude", "model": "claude-haiku-5-5", "ok": True, "seconds": 117.77,
                **normalizer.normalize_claude_result(real_result)}
    claude = costs._bucket()
    costs._add(claude, measured)
    costs._call_metadata(claude, measured)
    whisper = costs._bucket()
    costs._call_metadata(whisper, {"provider": "whisper", "model": "large-v3", "usage_known": False,
                                  "seconds": 20, "ok": True, "cost_usd": None})
    monkeypatch.setattr(costs, "_model_totals", lambda _: {("claude", "claude-haiku-5-5"): claude,
                                                         ("whisper", "large-v3"): whisper})
    monkeypatch.setattr(costs, "_ledger_metric_events", lambda _: [])
    result = costs._template_cost(tmp_path, {})
    assert result["total_tokens"] == 308741
    assert result["reported_cost_usd"] == 0.02446106 and result["cost_status"] == "partial"
    assert result["unmeasured_calls"] == 1 and result["unknown_cost_calls"] == 1
    by_model = {x["provider"]: x for x in result["totals_by_model"]}
    assert by_model["claude"]["cache_creation_input_tokens"] == 39887
    assert by_model["claude"]["cost_basis"] == "list"
    assert by_model["whisper"]["usage_known"] is False and by_model["whisper"]["reported_cost_usd"] is None


def test_future_ledger_writer_and_summary_preserve_raw_usage_and_unknown_cost(modules, real_result, tmp_path, monkeypatch):
    normalizer, _, _ = modules
    tool = load("staged_tool_usage", "tool_usage.usage.py")
    path = tmp_path / "usage.jsonl"
    monkeypatch.setattr(tool, "ledger_path", lambda _: path)
    monkeypatch.setattr(tool, "summary_path", lambda _: tmp_path / "summary.json")
    usage = normalizer.normalize_claude_result(real_result)
    row = tool.record(tmp_path, provider="claude", model="claude-haiku-5-5", role="producer", **usage)
    assert row["provider_usage"]["usage"] == real_result["usage"]
    assert row["cost_usd"] == 0.02446106 and row["cost_basis"] == "list"
    tool.record(tmp_path, provider="whisper", model="large-v3", role="transcribe", usage_known=False)
    rows = tool.entries(tmp_path)
    assert len(rows) == 2 and rows[1]["cost_usd"] is None
    summary = tool.summarize(tmp_path)
    assert summary["totals"]["reported_cost_usd"] == 0.02446106
    assert summary["totals"]["unknown_cost_calls"] == 1
    assert summary["by_model"]["claude:claude-haiku-5-5"]["cache_creation_input_tokens"] == 39887
    assert summary["timeline"][0]["cost_basis"] == "list"


def test_interactions_usage_fixture_maps_tokens_without_audio_or_credentials(modules):
    # Documented response shape: https://ai.google.dev/api/interactions-api
    import ast
    _, _, costs = modules
    tree = ast.parse(source("tts.usage.py").read_text())
    function = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == "extract_usage_metadata")
    namespace = {}
    exec(compile(ast.Module(body=[function], type_ignores=[]), "staged-extract-usage", "exec"), namespace)
    extract = namespace["extract_usage_metadata"]
    usage = {"total_input_tokens": 7, "total_output_tokens": 23, "total_thought_tokens": 49,
             "total_cached_tokens": 0, "total_tokens": 79,
             "input_tokens_by_modality": [{"modality": "text", "tokens": 7}]}
    result = extract({"id": "documented-example", "usage": usage, "outputs": [{"audio": "must-not-be-saved"}]})
    assert result["promptTokenCount"] == 7 and result["candidatesTokenCount"] == 23
    assert result["thoughtsTokenCount"] == 49 and result["cachedContentTokenCount"] == 0
    assert result["provider_usage"]["usage"] == usage
    assert "must-not-be-saved" not in json.dumps(result)
    row = {"input_tokens": 7, "cached_input_tokens": 0, "output_tokens": 23, "reasoning_tokens": 49}
    assert costs._total_tokens("gemini_tts", row) == 79
    assert extract({"outputs": []}) == {}
    legacy = extract({"usageMetadata": {"promptTokenCount": 10, "candidatesTokenCount": 20}})
    assert legacy["promptTokenCount"] == 10 and legacy["candidatesTokenCount"] == 20
    assert legacy["provider_usage"]["source"] == "generateContent.usageMetadata"


def test_accounting_events_keep_provider_reasoning_semantics_and_no_private_payload(modules, real_result, tmp_path, monkeypatch):
    normalizer, _, costs = modules
    claude = {"provider": "claude", "model": "claude-haiku-5-5", "ok": True,
              "step": "guion", "prompt": "/private/secret", "result": "private text",
              **normalizer.normalize_claude_result(real_result)}
    gemini = {"provider": "gemini_tts", "model": "gemini-3.8-flash-tts", "usage_known": True,
              "input_tokens": 7, "output_tokens": 23, "reasoning_tokens": 49,
              "cached_input_tokens": 0, "provider_usage": {"audio": "private-audio"}}
    unknown = {"provider": "gemini_tts", "model": "gemini-3.8-flash-tts", "usage_known": False,
               "input_tokens": 0, "output_tokens": 0, "reasoning_tokens": 0}
    buckets = {}
    for row in (claude, gemini, unknown):
        bucket = buckets.setdefault((row["provider"], row["model"]), costs._bucket())
        costs._add(bucket, row)
        costs._call_metadata(bucket, row)
    monkeypatch.setattr(costs, "_model_totals", lambda _: buckets)
    events = [costs._metric_event(row) for row in (claude, gemini, unknown)]
    monkeypatch.setattr(costs, "_ledger_metric_events", lambda _: events)
    result = costs._template_cost(tmp_path, {})
    assert result["total_tokens"] == 308820
    assert events[0]["total_tokens"] == 308741 and events[0]["reasoning_included_in_output"] is True
    assert events[1]["total_tokens"] == 79 and events[1]["reasoning_included_in_output"] is False
    assert events[2]["total_tokens"] is None and events[2]["input_tokens"] is None
    assert events[0]["source_event_uuid"] == real_result["uuid"]
    assert "private" not in json.dumps(result) and "provider_usage" not in json.dumps(result)
    assert costs._metric_event({"model": "/home/private/model"})["model"] is None
