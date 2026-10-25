"""Lectura de info.json, consumo registrado y líneas base de sandbox."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from src.core.explainer import sandbox_info
from src.core.explainer import sandbox as sandbox_catalog


def _write_json(path: Path, data: object) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data), encoding="utf-8")
    return path


def _template(root: Path, folder: str, item_id: str, *, created_at: str, is_new_design: bool) -> Path:
    item_dir = root / folder / item_id
    _write_json(
        item_dir / "info.json",
        {
            "version": 1,
            "title": item_id,
            "engine": "nodeaction/_engine",
            "is_new_design": is_new_design,
            "created_at": created_at,
        },
    )
    return item_dir


def _write_usage(item_dir: Path, *, input_tokens: int, cached: int, output: int, reasoning: int) -> None:
    _write_json(
        item_dir / "usage.json",
        {
            "by_model": {
                "codex:gpt-6-luna": {
                    "input_tokens": input_tokens,
                    "cached_input_tokens": cached,
                    "output_tokens": output,
                    "reasoning_tokens": reasoning,
                }
            }
        },
    )


def test_info_combines_summary_and_backfill_and_uses_oldest_baseline(tmp_path: Path):
    root = tmp_path / "sandbox"
    oldest = _template(root, "nodeaction", "base-old", created_at="2026-01-01", is_new_design=True)
    _write_usage(oldest, input_tokens=400, cached=999, output=100, reasoning=120)
    newer = _template(root, "nodeaction", "base-new", created_at="2026-02-01", is_new_design=True)
    _write_usage(newer, input_tokens=300, cached=0, output=100, reasoning=0)

    current = _template(root, "nodeaction", "paint-demo", created_at="2026-03-01", is_new_design=False)
    (current / "work").mkdir(parents=True)
    (current / "work" / "usage.jsonl").write_text(
        json.dumps(
            {
                "provider": "codex",
                "model": "gpt-6-luna",
                "input_tokens": 100,
                "cached_input_tokens": 50,
                "output_tokens": 30,
                "reasoning_tokens": 20,
            }
        )
        + "\n",
        encoding="utf-8",
    )
    info_path = current / "info.json"
    info = json.loads(info_path.read_text(encoding="utf-8"))
    info["usage_backfill"] = {
        "estimated": True,
        "by_model": [
            {
                "provider": "codex",
                "model": "gpt-6-luna",
                "input_tokens": 100,
                "cached_input_tokens": 40,
                "output_tokens": 50,
                "reasoning_tokens": 10,
            }
        ],
    }
    info_path.write_text(json.dumps(info), encoding="utf-8")

    result = sandbox_info.get_sandbox_info(root, "nodeaction", "paint-demo")

    assert result["info"]["title"] == "paint-demo"
    assert result["fresh_input_tokens"] == 110
    assert result["total_tokens"] == 220
    assert result["cached_tokens"] == 90
    assert result["estimated"] is True
    assert result["totals_by_model"] == [
        {
            "provider": "codex",
            "model": "gpt-6-luna",
            "input_tokens": 200,
            "cached_input_tokens": 90,
            "fresh_input_tokens": 110,
            "output_tokens": 80,
            "reasoning_tokens": 30,
            "total_tokens": 220,
        }
    ]
    assert result["baseline"] == {"id": "base-old", "total_tokens": 220}
    assert result["ratio_vs_baseline"] == 1
    assert result["forecast_next"] == {
        "min": 55.0,
        "max": 110.0,
        "basis": "engine nodeaction/_engine: base 220 tokens",
    }
    assert result["verdict"] == "caro"


@pytest.mark.parametrize(
    ("current_total", "expected_verdict"),
    [(500, "eficiente"), (700, "aceptable"), (800, "caro")],
)
def test_verdict_thresholds(tmp_path: Path, current_total: int, expected_verdict: str):
    root = tmp_path / "sandbox"
    baseline = _template(root, "nodeaction", "base", created_at="2026-01-01", is_new_design=True)
    _write_usage(baseline, input_tokens=1_000, cached=0, output=0, reasoning=0)
    current = _template(root, "nodeaction", "current", created_at="2026-02-01", is_new_design=False)
    _write_usage(current, input_tokens=current_total, cached=0, output=0, reasoning=0)

    result = sandbox_info.get_sandbox_info(root, "nodeaction", "current")

    assert result["verdict"] == expected_verdict


def test_self_baseline_has_forecast_without_ratio(tmp_path: Path):
    root = tmp_path / "sandbox"
    baseline = _template(root, "nodeaction", "base", created_at="2026-01-01", is_new_design=True)
    _write_usage(baseline, input_tokens=800, cached=50, output=100, reasoning=100)

    result = sandbox_info.get_sandbox_info(root, "nodeaction", "base")

    assert result["baseline"] == {"id": "base", "total_tokens": 950}
    assert result["ratio_vs_baseline"] is None
    assert result["forecast_next"] == {
        "min": 237.5,
        "max": 475.0,
        "basis": "engine nodeaction/_engine: base 950 tokens",
    }
    assert result["verdict"] is None


async def test_item_without_info_returns_null_and_unknown_item_is_not_found(tmp_path: Path, monkeypatch, api_client):
    root = tmp_path / "sandbox"
    item = root / "nodeaction" / "no-info"
    item.mkdir(parents=True)
    (item / "index.html").write_text("<main>demo</main>", encoding="utf-8")
    monkeypatch.setattr(sandbox_catalog, "SANDBOX_DIR", root)

    response = await api_client.get("/api/v1/explainer/sandbox/nodeaction/no-info/info")
    missing = await api_client.get("/api/v1/explainer/sandbox/nodeaction/missing/info")

    assert response.status_code == 200
    assert response.json() == {
        "info": None,
        "totals_by_model": [],
        "fresh_input_tokens": 0,
        "total_tokens": 0,
        "cached_tokens": 0,
        "estimated": False,
        "baseline": None,
        "ratio_vs_baseline": None,
        "forecast_next": None,
        "verdict": None,
    }
    assert missing.status_code == 404
