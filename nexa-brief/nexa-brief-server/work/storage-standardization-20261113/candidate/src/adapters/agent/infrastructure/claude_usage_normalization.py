"""Pure normalization of the CLI's reported usage; no credentials or API calls."""
from __future__ import annotations

import copy
import math


def _integer(value):
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value if value >= 0 else None
    return int(value) if isinstance(value, float) and math.isfinite(value) and value >= 0 else None


def normalize_claude_result(event: dict) -> dict:
    raw = event.get("usage") if isinstance(event.get("usage"), dict) else {}
    models = event.get("modelUsage") if isinstance(event.get("modelUsage"), dict) else {}
    uncached = _integer(raw.get("input_tokens"))
    creation = _integer(raw.get("cache_creation_input_tokens"))
    cached = _integer(raw.get("cache_read_input_tokens"))
    output = _integer(raw.get("output_tokens"))
    details = raw.get("output_tokens_details") if isinstance(raw.get("output_tokens_details"), dict) else {}
    reasoning = _integer(details.get("thinking_tokens"))
    if reasoning is None and models and all(isinstance(v, dict) and _integer(v.get("thinkingTokens")) is not None for v in models.values()):
        reasoning = sum(_integer(v["thinkingTokens"]) for v in models.values())
    cost = event.get("total_cost_usd")
    if not isinstance(cost, (int, float)) or isinstance(cost, bool) or not math.isfinite(cost) or cost < 0:
        cost = None
    bases = sorted({str(v["costBasis"]) for v in models.values() if isinstance(v, dict) and v.get("costBasis")})
    return {
        # Claude reports cache reads separately. Creation remains included in
        # input, preserving the legacy runner's accounting convention.
        "input_tokens": uncached + (creation or 0) if uncached is not None else None,
        "uncached_input_tokens": uncached,
        "cache_creation_input_tokens": creation,
        "cached_input_tokens": cached,
        "output_tokens": output,
        "reasoning_tokens": reasoning,  # subset of output, never added again
        "turns": _integer(event.get("num_turns")),
        "cost_usd": cost,
        "cost_basis": bases[0] if len(bases) == 1 else "mixed" if bases else None,
        "provider_result_id": str(event["uuid"]) if event.get("uuid") else None,
        "usage_known": any(value is not None for value in (uncached, creation, cached, output, reasoning)),
        "provider_usage": {"usage": copy.deepcopy(raw), "modelUsage": copy.deepcopy(models),
                           "total_cost_usd": cost, "num_turns": event.get("num_turns")},
    }
