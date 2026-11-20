"""Private usage for native revisions. Never write to the original video's ledger."""
from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime, timezone
import fcntl
import json
import math
import os
from pathlib import Path
import re
import uuid

MAX_ENTRY_BYTES = 65536


def _safe(root, *parts):
    target = root.joinpath(*parts)
    if target.absolute() != target.resolve() or not target.resolve().is_relative_to(root.resolve()):
        raise ValueError("Native usage does not permit external paths or symlinks")
    return target


def _identity(ctx):
    root = Path(ctx.path).absolute().parent
    if root != root.resolve() or ctx.is_source:
        raise ValueError("Native usage requires a native revision directory")
    locale, revision = ctx.locale, ctx.data["revision"]
    if (not re.fullmatch(r"[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*", locale)
            or not re.fullmatch(r"rev-\d{3,}", revision)):
        raise ValueError("Invalid usage locale or revision")
    marker = _safe(root, "usage-context.json")
    if not marker.is_file() or marker.stat().st_size > 4096:
        raise ValueError("Missing or invalid native usage context; initialize it through the host")
    value = json.loads(marker.read_text(encoding="utf-8"))
    if (not isinstance(value, dict) or value.get("schema_version") != 1 or value.get("locale") != locale
            or value.get("revision") != revision
            or set(value) - {"schema_version", "locale", "revision", "historical_usage_unattributed"}
            or not isinstance(value.get("historical_usage_unattributed", False), bool)):
        raise ValueError("Native usage context differs from the selected revision")
    return root, locale, revision


def _count(value):
    return value if isinstance(value, int) and not isinstance(value, bool) and value >= 0 else None


def _finite(value):
    return value if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and value >= 0 else None


def _raw_metrics(value, depth=0):
    """Keep numeric usage evidence and modality enums, never response content/audio/secrets."""
    if depth > 6:
        return None
    if isinstance(value, dict):
        result = {}
        for key, child in list(value.items())[:128]:
            if not isinstance(key, str) or len(key) > 100:
                continue
            if re.search(r"api[_-]?key|secret|password|authorization|credential|raw[_-]?audio|audio[_-]?data", key, re.I):
                continue
            if isinstance(child, str):
                if key in {"modality", "trafficType", "type"} and re.fullmatch(r"[A-Za-z_]{1,32}", child):
                    result[key] = child
                continue
            item = _raw_metrics(child, depth + 1)
            if item is not None:
                result[key] = item
        return result
    if isinstance(value, list):
        return [item for child in value[:128] if (item := _raw_metrics(child, depth + 1)) is not None]
    return _finite(value)


def _provider_usage(usage):
    value = usage.get("provider_usage")
    if not isinstance(value, dict):
        return None
    source = value.get("source")
    if source not in {"generateContent.usageMetadata", "interactions.usage"}:
        return None
    result = {"source": source, "usage": _raw_metrics(value.get("usage", {}))}
    identifier = value.get("interaction_id")
    if isinstance(identifier, str) and re.fullmatch(r"[A-Za-z0-9._:/-]{1,256}", identifier):
        result["interaction_id"] = identifier
    return result


def record(ctx, *, model, role, step, ok, seconds, usage=None, error_type=None):
    root, locale, revision = _identity(ctx)
    usage = usage if isinstance(usage, dict) else {}
    prompt, cached = _count(usage.get("promptTokenCount")), _count(usage.get("cachedContentTokenCount"))
    # Gemini reports total prompt input including cache reads. Unknown cache stays unknown.
    fresh = prompt - cached if prompt is not None and cached is not None and cached <= prompt else None
    if prompt is not None and cached is None:
        fresh = None
    raw = _provider_usage(usage)
    entry = {"schema_version": 1, "event_id": uuid.uuid4().hex,
             "ts": datetime.now(timezone.utc).isoformat(), "locale": locale, "revision": revision,
             "provider": "gemini_tts", "model": model, "role": role, "step": step,
             "ok": bool(ok), "seconds": _finite(seconds), "input_tokens": fresh,
             "prompt_tokens_including_cache": prompt, "cached_input_tokens": cached,
             "output_tokens": _count(usage.get("candidatesTokenCount")),
             "reasoning_tokens": _count(usage.get("thoughtsTokenCount")),
             "reasoning_included_in_output": None, "total_tokens": None,
             "cost_usd": None, "cost_basis": None, "provider_usage": raw,
             "provider_result_id": raw.get("interaction_id") if raw else None,
             "granularity": "http_attempt"}
    if error_type:
        entry["error_type"] = re.sub(r"[^A-Za-z0-9_.]", "", str(error_type))[:80]
    entry["usage_known"] = any(entry[key] is not None for key in
                               ("input_tokens", "prompt_tokens_including_cache", "cached_input_tokens", "output_tokens", "reasoning_tokens"))
    encoded = (json.dumps(entry, ensure_ascii=False, allow_nan=False) + "\n").encode()
    if len(encoded) > MAX_ENTRY_BYTES:
        raise ValueError("Native usage entry is too large")
    log_dir = _safe(root, "logs")
    log_dir.mkdir(mode=0o700, exist_ok=True)
    ledger = _safe(root, "logs", "usage.jsonl")
    fd = os.open(ledger, os.O_WRONLY | os.O_CREAT | os.O_APPEND | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, "ab", buffering=0) as stream:
        fcntl.flock(stream, fcntl.LOCK_EX)
        stream.write(encoded)
    return entry


@contextmanager
def observe(ctx, tts, *, model, role, step):
    """Record each HTTP attempt, including retries; local cache reuse records no call."""
    root, _, _ = _identity(ctx)
    log_dir = _safe(root, "logs")
    log_dir.mkdir(mode=0o700, exist_ok=True)
    ledger = _safe(root, "logs", "usage.jsonl")
    # Fail on missing write permission before a paid request, with no ES fallback.
    fd = os.open(ledger, os.O_WRONLY | os.O_CREAT | os.O_APPEND | os.O_NOFOLLOW, 0o600)
    os.close(fd)
    events = []
    try:
        with tts.observe_usage(events.append):
            yield
    except BaseException as exc:
        # HTTP may succeed while the response contains no usable audio.
        if events and events[-1]["ok"]:
            events[-1].update(ok=False, error_type=type(exc).__name__)
        raise
    finally:
        for event in events:
            actual = event.get("model")
            if not isinstance(actual, str) or not re.fullmatch(r"[A-Za-z0-9._/-]{1,160}", actual):
                actual = model
            record(ctx, model=actual, role=role, step=step, ok=event["ok"], seconds=event["seconds"],
                   usage=event.get("usage"), error_type=event.get("error_type"))
