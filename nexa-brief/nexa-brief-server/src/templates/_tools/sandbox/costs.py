"""Cálculos compartidos de consumo para las fichas del sandbox.

Normalizamos la entrada como entrada nueva (sin caché). Codex, OpenAI y DeepSeek
reportan cached_input_tokens dentro de input_tokens; para esos proveedores se
resta la caché. Claude informa la caché de lectura aparte, así que input_tokens
ya es entrada nueva. La caché siempre se muestra aparte y no suma al total.
"""

from __future__ import annotations

import json
from pathlib import Path

TOKEN_FIELDS = (
    "input_tokens",
    "cached_input_tokens",
    "output_tokens",
    "reasoning_tokens",
)
CACHE_INCLUDED_IN_INPUT = {"codex", "openai", "deepseek"}


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
    for field in TOKEN_FIELDS:
        bucket[field] += _number(row.get(field))


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
    """Carga usage.json y usa el ledger si el resumen aún no tiene modelos."""
    summary = _from_usage_json(item_dir / "usage.json")
    if summary:
        return summary
    return _from_ledger(item_dir / "work" / "usage.jsonl")


def fresh_input(provider: str, row: dict) -> int:
    """Devuelve entrada nueva, descontando caché cuando el proveedor la incluye en input."""
    input_tokens = _number(row.get("input_tokens"))
    if provider.strip().lower() in CACHE_INCLUDED_IN_INPUT:
        return max(0, input_tokens - _number(row.get("cached_input_tokens")))
    return input_tokens


def _total_tokens(provider: str, row: dict[str, int]) -> int:
    """Suma entrada nueva, salida y razonamiento; la caché queda aparte."""
    return fresh_input(provider, row) + row["output_tokens"] + row["reasoning_tokens"]


def _template_cost(item_dir: Path, info: dict) -> dict:
    """Une el ledger normal con el backfill histórico opcional."""
    by_model = _model_totals(item_dir)
    backfill = info.get("usage_backfill") or {}
    rows = backfill.get("by_model", []) if isinstance(backfill, dict) else []
    for row in rows:
        if not isinstance(row, dict):
            continue
        key = (str(row.get("provider") or "?"), str(row.get("model") or ""))
        _add(by_model.setdefault(key, _bucket()), row)

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
            **bucket,
            "fresh_input_tokens": row_fresh_input,
            "total_tokens": row_total,
        })
    return {
        "totals_by_model": rows,
        "fresh_input_tokens": fresh_input_total,
        "total_tokens": total_tokens,
        "cached_tokens": totals["cached_input_tokens"],
        "estimated": bool(backfill.get("estimated")),
    }


def _created_key(info: dict, item_dir: Path) -> tuple[str, str, str]:
    """Ordena líneas base por fecha y luego por carpeta para desempatar."""
    return (
        str(info.get("created_at") or "9999-99-99"),
        item_dir.parent.name,
        item_dir.name,
    )


def calculate_costs(sandbox_root: Path, folder: str, item_id: str) -> dict:
    """Devuelve consumo, comparación con la base y pronóstico de la próxima plantilla."""
    item_dir = sandbox_root / folder / item_id
    info_path = item_dir / "info.json"
    if not info_path.is_file():
        raise FileNotFoundError(f"No existe {info_path}")

    info = json.loads(info_path.read_text(encoding="utf-8"))
    current = _template_cost(item_dir, info)
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
    if candidates:
        baseline_path, baseline_info = min(
            candidates,
            key=lambda candidate: _created_key(candidate[1], candidate[0]),
        )
    baseline = None
    ratio = None
    forecast = None
    if baseline_path is not None and baseline_info is not None:
        baseline_cost = _template_cost(baseline_path, baseline_info)["total_tokens"]
        baseline = {"id": baseline_path.name, "total_tokens": baseline_cost}
        if baseline_path.resolve() != item_dir.resolve() and baseline_cost:
            ratio = current["total_tokens"] / baseline_cost
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
