"""Pruebas de la herramienta de fichas del sandbox."""

from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path

TOOLS_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(TOOLS_DIR))

import costs  # noqa: E402
import info  # noqa: E402


def _write_info(item_dir: Path, **overrides) -> dict:
    item_dir.mkdir(parents=True, exist_ok=True)
    data = {
        "version": 1,
        "title": item_dir.name.title(),
        "summary": "Resumen de prueba.",
        "engine": "explainer-kit:rough",
        "based_on": None,
        "is_new_design": False,
        "status": "en progreso",
        "created_at": "2026-10-01",
        "libraries": [],
        "inputs": [],
        "notes": [],
    }
    data.update(overrides)
    (item_dir / "info.json").write_text(json.dumps(data), encoding="utf-8")
    return data


def test_init_creates_info_json_and_does_not_overwrite(tmp_path):
    item_dir = tmp_path / "nodehistory" / "mi-video"

    path = info.create_info(
        item_dir,
        "explainer-kit:binary",
        based_on="memorias-demo",
        new_design=True,
        today=date(2026, 10, 24),
    )

    data = json.loads(path.read_text(encoding="utf-8"))
    assert data["title"] == "Mi Video"
    assert data["engine"] == "explainer-kit:binary"
    assert data["based_on"] == "memorias-demo"
    assert data["is_new_design"] is True
    assert data["status"] == "en progreso"
    assert data["created_at"] == "2026-10-24"
    assert not info.validate_info(data)

    try:
        info.create_info(item_dir, "explainer-kit:rough")
    except FileExistsError:
        pass
    else:
        raise AssertionError("init debe rechazar una ficha existente")


def test_add_usage_calls_shared_summarize(tmp_path):
    item_dir = tmp_path / "nodetech" / "demo"
    _write_info(item_dir)

    entry, summary = info.add_usage(
        item_dir,
        provider="codex",
        model="gpt-6-luna",
        role="storyboard",
        input_tokens=120,
        cached_input_tokens=20,
        output_tokens=35,
        reasoning_tokens=5,
        note="prueba",
    )

    ledger = item_dir / "work" / "usage.jsonl"
    saved = json.loads(ledger.read_text(encoding="utf-8").splitlines()[0])
    usage_json = json.loads((item_dir / "usage.json").read_text(encoding="utf-8"))
    assert saved == entry
    assert saved["step"] == "sandbox"
    assert usage_json["totals"]["input_tokens"] == 120
    assert summary["totals"]["output_tokens"] == 35
    assert summary["by_model"]["codex:gpt-6-luna"]["reasoning_tokens"] == 5


def test_codex_log_reads_real_footer_and_model(tmp_path):
    log = tmp_path / "codex.log"
    log.write_text(
        "model: gpt-6-luna\n\nrespuesta de la sesión\ntokens used\n208,162\n",
        encoding="utf-8",
    )

    assert info.parse_codex_log(log) == (208162, "gpt-6-luna")


def test_from_codex_log_adds_combined_total(tmp_path, monkeypatch, capsys):
    sandbox = tmp_path / "sandbox"
    item_dir = sandbox / "nodehistory" / "demo"
    info.create_info(item_dir, "explainer-kit:binary")
    monkeypatch.setattr(info, "SANDBOX_ROOT", sandbox)
    log = tmp_path / "codex.log"
    log.write_text("model: gpt-6-luna\ntokens used\n208,162\n", encoding="utf-8")

    assert info.main(["from-codex-log", "nodehistory/demo", str(log)]) == 0

    line = (item_dir / "work" / "usage.jsonl").read_text(encoding="utf-8")
    entry = json.loads(line)
    assert entry["provider"] == "codex"
    assert entry["model"] == "gpt-6-luna"
    assert entry["input_tokens"] == 208162
    assert entry["output_tokens"] == 0
    assert "no separa" in entry["note"]
    assert "208,162 tokens totales" in capsys.readouterr().out


def test_costs_compare_with_oldest_design_and_add_backfill(tmp_path):
    sandbox = tmp_path / "sandbox"
    baseline_dir = sandbox / "nodehistory" / "motor-base"
    reused_dir = sandbox / "nodehistory" / "video-nuevo"
    _write_info(
        baseline_dir,
        is_new_design=True,
        created_at="2026-09-01",
        usage_backfill={
            "estimated": True,
            "source": "resumen de prueba",
            "by_model": [
                {
                    "provider": "codex",
                    "model": "gpt-6-luna",
                    "input_tokens": 400,
                    "cached_input_tokens": 50,
                    "output_tokens": 100,
                    "reasoning_tokens": 0,
                }
            ],
        },
    )
    _write_info(reused_dir, created_at="2026-10-01")
    (reused_dir / "usage.json").write_text(
        json.dumps({
            "by_model": {
                "codex:gpt-6-luna": {
                    "input_tokens": 150,
                    "cached_input_tokens": 25,
                    "output_tokens": 100,
                    "reasoning_tokens": 0,
                }
            }
        }),
        encoding="utf-8",
    )

    result = costs.calculate_costs(sandbox, "nodehistory", "video-nuevo")

    assert result["fresh_input_tokens"] == 125
    assert result["total_tokens"] == 225
    assert result["cached_tokens"] == 25
    assert result["baseline"] == {"id": "motor-base", "total_tokens": 450}
    assert result["ratio_vs_baseline"] == 0.5
    assert result["verdict"] == "eficiente"
    assert result["forecast_next"] == {
        "min": 112.5,
        "max": 225.0,
        "basis": "engine explainer-kit:rough: base 450 tokens",
    }


def test_fresh_input_normalizes_provider_cache_conventions():
    row = {"input_tokens": 100, "cached_input_tokens": 25}

    assert costs.fresh_input("codex", row) == 75
    assert costs.fresh_input("OpenAI", row) == 75
    assert costs.fresh_input("deepseek", row) == 75
    assert costs.fresh_input("claude", row) == 100
    assert costs.fresh_input("other", row) == 100
    assert costs.fresh_input("codex", {"input_tokens": 20, "cached_input_tokens": 30}) == 0


def test_validate_reports_contract_errors():
    errors = info.validate_info({"version": 3, "engine": "../outside"})

    assert "version debe ser 1" in errors
    assert any(message.startswith("falta ") for message in errors)
    assert "engine debe ser una ruta relativa o explainer-kit:<diseño>" in errors
