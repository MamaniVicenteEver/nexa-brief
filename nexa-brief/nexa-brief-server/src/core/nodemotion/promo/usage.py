"""Normalización conservadora del uso informado por los runners."""

from __future__ import annotations

FIELDS = (
    "input_tokens",
    "cached_input_tokens",
    "output_tokens",
    "reasoning_tokens",
    "total_tokens",
    "cost_usd",
    "seconds",
)


def step(provider, model, revision, usage=None, seconds=None, ok=False):
    usage = usage if isinstance(usage, dict) else {}
    row = {
        "stage": "proposal",
        "provider": provider,
        "model": model,
        "revision": revision,
        "reasoning_effort": None,
        "ok": ok,
    }
    for name in FIELDS:
        value = seconds if name == "seconds" else usage.get(name)
        valid = isinstance(value, (int, float)) and not isinstance(value, bool) and value >= 0
        row[name] = value if valid else None
    if provider in ("codex", "claude"):
        from .agents import PROVIDERS

        row["reasoning_effort"] = PROVIDERS[provider][1]
    row["input_includes_cached"] = provider != "claude"
    row["cost_basis"] = usage.get("cost_basis")
    for name in ("uncached_input_tokens", "cache_creation_input_tokens"):
        value = usage.get(name)
        row[name] = value if isinstance(value, (int, float)) and not isinstance(value, bool) and value >= 0 else None
    if row["total_tokens"] is None and row["input_tokens"] is not None and row["output_tokens"] is not None:
        if provider == "codex":
            row["total_tokens"] = row["input_tokens"] + row["output_tokens"]
        elif provider == "claude" and row["cached_input_tokens"] is not None:
            row["total_tokens"] = row["input_tokens"] + row["cached_input_tokens"] + row["output_tokens"]
    return row


def summarize(steps):
    models = [row for row in steps if row.get("model")]
    totals = {}
    for key in FIELDS[:-1]:
        known = [row[key] for row in models if row.get(key) is not None]
        totals[key] = sum(known) if models and len(known) == len(models) else None
        totals["known_" + key] = sum(known) if known else None
    totals["unknown_model_attempts"] = sum(
        1 for row in models if any(row.get(key) is None for key in ("input_tokens", "output_tokens"))
    )
    times = [row["seconds"] for row in steps if row.get("seconds") is not None]
    totals["work_seconds"] = sum(times) if steps and len(times) == len(steps) else None
    totals["known_work_seconds"] = sum(times) if times else None
    return {"steps": steps, "totals": totals}
