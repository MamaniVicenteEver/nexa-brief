"""Cálculos compartidos de consumo para las fichas del sandbox.

Normalizamos la entrada como entrada nueva (sin caché). Codex, OpenAI, Gemini y DeepSeek
reportan cached_input_tokens dentro de input_tokens; para esos proveedores se
resta la caché. Claude informa la caché de lectura aparte, así que input_tokens
ya es entrada nueva. El total incluye la caché una vez. El razonamiento ya está
incluido en la salida de Codex/OpenAI y DeepSeek; Gemini lo informa por separado.
"""

from __future__ import annotations

import importlib.util
import json
from collections import Counter
from pathlib import Path

TOKEN_FIELDS = (
    "input_tokens",
    "cached_input_tokens",
    "output_tokens",
    "reasoning_tokens",
    "undivided_tokens",
)
CACHE_INCLUDED_IN_INPUT = {"codex", "openai", "deepseek", "gemini", "gemini_tts"}


def _number(value: object) -> int:
    """Convierte un token a entero no negativo."""
    try:
        return max(0, int(value or 0))
    except (TypeError, ValueError):
        return 0


def _bucket() -> dict[str, int]:
    """Crea un acumulador por modelo."""
    return {field: 0 for field in TOKEN_FIELDS}


def _add(bucket: dict[str, int], row: dict) -> None:
    """Suma los tokens de una llamada o backfill."""
    if "total combinado informado por codex exec" in str(row.get("note") or "").lower():
        row = {**row, "undivided_tokens": row.get("input_tokens"), "input_tokens": 0}
    elif row.get("total_tokens") is not None and row.get("input_tokens") is None and row.get("output_tokens") is None:
        row = {**row, "undivided_tokens": row["total_tokens"]}
    for field in TOKEN_FIELDS:
        bucket[field] += _number(row.get(field))



def _call_metadata(bucket, row):
    import math
    bucket["calls"] = bucket.get("calls", 0) + 1
    bucket["failed_calls"] = bucket.get("failed_calls", 0) + int(row.get("ok") is False)
    bucket["seconds"] = round(bucket.get("seconds", 0) + float(row.get("seconds") or 0), 3)
    measured = row.get("usage_known") is True or ("usage_known" not in row and any(_number(row.get(field)) for field in TOKEN_FIELDS))
    bucket["usage_known"] = bucket.get("usage_known", False) or measured
    bucket["unmeasured_calls"] = bucket.get("unmeasured_calls", 0) + int(not measured)
    if row.get("cache_creation_input_tokens") is not None:
        bucket["cache_creation_input_tokens"] = bucket.get("cache_creation_input_tokens", 0) + _number(row.get("cache_creation_input_tokens"))
    cost = row.get("cost_usd", row.get("reported_cost_usd"))
    known = isinstance(cost, (int, float)) and not isinstance(cost, bool) and math.isfinite(cost) and cost >= 0
    bucket["unknown_cost_calls"] = bucket.get("unknown_cost_calls", 0) + int(not known)
    if known:
        bucket["_known_cost_calls"] = bucket.get("_known_cost_calls", 0) + 1
        bucket["_reported_cost_sum"] = round(bucket.get("_reported_cost_sum", 0) + cost, 10)
        bases = bucket.setdefault("_cost_bases", [])
        if row.get("cost_basis") and row["cost_basis"] not in bases:
            bases.append(row["cost_basis"])


def _cost_basis(bucket):
    bases = bucket.get("_cost_bases", [])
    return bases[0] if len(bases) == 1 else "mixed" if bases else None

def _from_usage_json(path: Path) -> dict[tuple[str, str], dict[str, int]]:
    """Lee los totales por modelo producidos por usage.py."""
    result: dict[tuple[str, str], dict[str, int]] = {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return result

    if not isinstance(data, dict) or not isinstance(data.get("by_model"), dict):
        return result
    for key, row in data["by_model"].items():
        if not isinstance(row, dict):
            continue
        provider, separator, model = str(key).partition(":")
        if not separator:
            provider, model = "?", provider
        bucket = result.setdefault((provider, model), _bucket())
        _add(bucket, row)
    return result


def _from_ledger(path: Path) -> dict[tuple[str, str], dict[str, int]]:
    """Suma las líneas del ledger cuando todavía no hay resumen."""
    result: dict[tuple[str, str], dict[str, int]] = {}
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError:
        return result

    for line in lines:
        try:
            row = json.loads(line)
        except json.JSONDecodeError:
            continue
        if not isinstance(row, dict):
            continue
        key = (str(row.get("provider") or "?"), str(row.get("model") or ""))
        _add(result.setdefault(key, _bucket()), row)
    return result


def _model_totals(item_dir: Path) -> dict[tuple[str, str], dict[str, int]]:
    """Lee ambos formatos; un evento repetido en las dos copias cuenta una sola vez."""
    # Resolve through the kit: v1 stays alongside the prototype, v2 uses its
    # selected profile log directory. No profile data or credentials are read.
    tool = Path(__file__).resolve().parent.parent / "explainer-kit" / "tools" / "usage.py"
    try:
        spec = importlib.util.spec_from_file_location("sandbox_usage_paths", tool)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        summary_path, ledger = module.summary_path(item_dir), module.ledger_path(item_dir)
    except (OSError, ValueError, ImportError):
        return {}
    legacy_ledger = item_dir / "work" / "usage.jsonl"
    legacy_summary = item_dir / "usage.json"
    paths = list(dict.fromkeys((ledger, legacy_ledger)))
    counters: list[Counter[str]] = []
    for path in paths:
        if path == legacy_ledger and not path.resolve().is_relative_to(item_dir.resolve()):
            continue
        try:
            if path == ledger:
                source_rows = module.entries(item_dir)
            else:
                source_rows = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
        except (OSError, ValueError):
            continue
        rows = []
        for row in source_rows:
            if isinstance(row, dict):
                rows.append(json.dumps(row, sort_keys=True, ensure_ascii=False))
        if rows:
            counters.append(Counter(rows))
    if counters:
        # Multiset union retains repeated events inside one ledger, but avoids
        # counting the same historical ledger again after a migration.
        combined = counters[0]
        for counter in counters[1:]:
            combined |= counter
        result: dict[tuple[str, str], dict[str, int]] = {}
        seen_events = set()
        for serialized, count in combined.items():
            row = json.loads(serialized)
            if row.get("event_id"):
                if row["event_id"] in seen_events:
                    continue
                seen_events.add(row["event_id"])
                count = 1
            if row.get("provider") == "kit":
                continue
            key = (str(row.get("provider") or "?"), str(row.get("model") or ""))
            bucket = result.setdefault(key, _bucket())
            for _ in range(count):
                _add(bucket, row)
                _call_metadata(bucket, row)
        return result
    # Summaries are alternatives, not independent events; never add them.
    for path in dict.fromkeys((summary_path, legacy_summary)):
        if path == legacy_summary and not path.resolve().is_relative_to(item_dir.resolve()):
            continue
        summary = _from_usage_json(path)
        if summary:
            return summary
    return {}


def fresh_input(provider: str, row: dict) -> int:
    """Devuelve entrada nueva, descontando caché cuando el proveedor la incluye en input."""
    input_tokens = _number(row.get("input_tokens"))
    if provider.strip().lower() in CACHE_INCLUDED_IN_INPUT:
        return max(0, input_tokens - _number(row.get("cached_input_tokens")))
    return input_tokens


def _total_tokens(provider: str, row: dict[str, int]) -> int:
    """Total de tokens procesados sin sumar dos veces caché o razonamiento."""
    input_total = (_number(row.get("input_tokens")) if provider.strip().lower() in CACHE_INCLUDED_IN_INPUT
                   else _number(row.get("input_tokens")) + _number(row.get("cached_input_tokens")))
    reasoning = _number(row.get("reasoning_tokens")) if provider.strip().lower() in {"gemini", "gemini_tts"} else 0
    return input_total + _number(row.get("output_tokens")) + reasoning + _number(row.get("undivided_tokens"))


def _reasoning_included(provider: str) -> bool | None:
    provider = provider.strip().lower()
    if provider in {"claude", "codex", "openai", "deepseek"}:
        return True
    if provider in {"gemini", "gemini_tts"}:
        return False
    return None


def _metric_event(row: dict) -> dict:
    """Only public accounting fields; raw SDK responses and local paths stay private."""
    import re
    def label(value):
        return value if isinstance(value, str) and re.fullmatch(r"[A-Za-z0-9_.:@+ -]{1,160}", value) else None
    provider = label(row.get("provider"))
    measured = row.get("usage_known") is True or ("usage_known" not in row and any(_number(row.get(k)) for k in TOKEN_FIELDS))
    result = {key: label(row.get(key)) for key in ("ts", "provider", "model", "role", "step")}
    result.update({key: (_number(row.get(key)) if measured and row.get(key) is not None else None)
                   for key in (*TOKEN_FIELDS, "cache_creation_input_tokens", "uncached_input_tokens")})
    result.update({"ok": row.get("ok") if isinstance(row.get("ok"), bool) else None,
                   "seconds": row.get("seconds") if isinstance(row.get("seconds"), (int, float)) else None,
                   "usage_known": measured, "reported_cost_usd": row.get("cost_usd"),
                   "cost_basis": label(row.get("cost_basis")),
                   "source_event_uuid": label(row.get("provider_result_id") or row.get("event_id")),
                   "reasoning_included_in_output": _reasoning_included(provider or "")})
    result["total_tokens"] = _total_tokens(provider or "", row) if measured else None
    return result


def _ledger_metric_events(item_dir: Path) -> list[dict]:
    tool = Path(__file__).resolve().parent.parent / "explainer-kit" / "tools" / "usage.py"
    try:
        spec = importlib.util.spec_from_file_location("sandbox_usage_events", tool)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return [_metric_event(row) for row in module.entries(item_dir) if isinstance(row, dict)]
    except (OSError, ValueError, ImportError):
        return []


def _template_cost(item_dir: Path, info: dict, *, extra_events: list[dict] | None = None) -> dict:
    """Mantiene separados los registros y estimaciones de origen incierto."""
    by_model = _model_totals(item_dir)
    for event in extra_events or []:
        key = (str(event.get("provider") or "?"), str(event.get("model") or ""))
        bucket = by_model.setdefault(key, _bucket())
        _add(bucket, event)
        _call_metadata(bucket, event)
    backfill = info.get("usage_backfill") or {}
    rows = backfill.get("by_model", []) if isinstance(backfill, dict) else []
    estimated_models: dict[tuple[str, str], dict[str, int]] = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        key = (str(row.get("provider") or "?"), str(row.get("model") or ""))
        _add(estimated_models.setdefault(key, _bucket()), row)
    # Old backfills estimate whole sessions, not identifiable calls. They may
    # overlap the ledger, so expose them separately instead of adding them.
    separate_estimate = bool(by_model and estimated_models)
    if not by_model:
        by_model = estimated_models

    rows = []
    totals = _bucket()
    fresh_input_total = 0
    total_tokens = 0
    for (provider, model), bucket in sorted(by_model.items()):
        _add(totals, bucket)
        row_fresh_input = fresh_input(provider, bucket)
        row_total = _total_tokens(provider, bucket)
        fresh_input_total += row_fresh_input
        total_tokens += row_total
        rows.append({
            "provider": provider,
            "model": model,
            **{k: v for k, v in bucket.items() if not k.startswith("_")},
            "reported_cost_usd": bucket.get("_reported_cost_sum") if bucket.get("_known_cost_calls", 0) else None,
            "cost_basis": _cost_basis(bucket),
            "fresh_input_tokens": row_fresh_input,
            "total_tokens": row_total,
            "reasoning_included_in_output": _reasoning_included(provider),
        })
    return {
        "totals_by_model": rows,
        "ledger_events": _ledger_metric_events(item_dir),
        "fresh_input_tokens": fresh_input_total,
        "total_tokens": total_tokens,
        "cached_tokens": totals["cached_input_tokens"],
        "unmeasured_calls": sum(int(row.get("unmeasured_calls") or 0) for row in rows),
        "reported_cost_usd": round(sum(row["reported_cost_usd"] or 0 for row in rows), 10) if any(row["reported_cost_usd"] is not None for row in rows) else None,
        "cost_status": ("partial" if any(row.get("unknown_cost_calls", 0) for row in rows) else "reported") if any(row["reported_cost_usd"] is not None for row in rows) else "unknown",
        "unknown_cost_calls": sum(int(row.get("unknown_cost_calls") or 0) for row in rows),
        "estimated": bool(estimated_models and not separate_estimate),
        "unreconciled_estimate_tokens": (
            sum(_total_tokens(provider, bucket) for (provider, _), bucket in estimated_models.items())
            if separate_estimate else None
        ),
        # Not all generation routes currently emit usage, so recorded totals
        # must not be advertised as a complete accounting of a project.
        "usage_status": "partial" if rows else "unknown",
    }


def _created_key(info: dict, item_dir: Path) -> tuple[str, str, str]:
    """Ordena líneas base por fecha y luego por carpeta para desempatar."""
    return (
        str(info.get("created_at") or "9999-99-99"),
        item_dir.parent.name,
        item_dir.name,
    )


def calculate_costs(sandbox_root: Path, folder: str, item_id: str, *, extra_events: list[dict] | None = None) -> dict:
    """Devuelve consumo, comparación con la base y pronóstico de la próxima plantilla."""
    item_dir = sandbox_root / folder / item_id
    info_path = item_dir / "info.json"
    if not info_path.is_file():
        raise FileNotFoundError(f"No existe {info_path}")

    info = json.loads(info_path.read_text(encoding="utf-8"))
    current = _template_cost(item_dir, info, extra_events=extra_events)
    candidates = []
    for path in sandbox_root.glob("*/*/info.json"):
        if any(part.startswith((".", "_")) for part in path.relative_to(sandbox_root).parts[:2]):
            continue
        try:
            candidate_info = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        if (
            isinstance(candidate_info, dict)
            and candidate_info.get("engine") == info.get("engine")
            and candidate_info.get("is_new_design") is True
        ):
            candidates.append((path.parent, candidate_info))

    baseline_path = None
    baseline_info = None
    based_on = info.get("based_on")
    if isinstance(based_on, str) and based_on.strip():
        requested = based_on.strip().strip("/")
        matching = [(path, candidate) for path, candidate in candidates
                    if requested in (path.name, f"{path.parent.name}/{path.name}")]
        if len(matching) == 1:
            baseline_path, baseline_info = matching[0]
    elif candidates:
        baseline_path, baseline_info = min(
            candidates,
            key=lambda candidate: _created_key(candidate[1], candidate[0]),
        )
    baseline = None
    ratio = None
    forecast = None
    if baseline_path is not None and baseline_info is not None:
        baseline_usage = _template_cost(baseline_path, baseline_info)
        baseline_cost = baseline_usage["total_tokens"]
        if baseline_usage["usage_status"] != "unknown":
            baseline = {"id": baseline_path.name, "total_tokens": baseline_cost}
            if baseline_path.resolve() != item_dir.resolve() and baseline_cost and current["usage_status"] != "unknown":
                ratio = current["total_tokens"] / baseline_cost
            if baseline_cost:
                forecast = {
                    "min": baseline_cost * 0.25,
                    "max": baseline_cost * 0.5,
                    "basis": f"engine {info.get('engine')}: base {baseline_cost} tokens",
                }

    verdict = None
    if ratio is not None:
        verdict = "eficiente" if ratio <= 0.5 else "aceptable" if ratio <= 0.75 else "caro"

    return {
        "info": info,
        **current,
        "baseline": baseline,
        "ratio_vs_baseline": ratio,
        "forecast_next": forecast,
        "verdict": verdict,
    }
