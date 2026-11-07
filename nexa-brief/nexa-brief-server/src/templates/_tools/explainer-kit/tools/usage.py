"""Registro de uso de modelos de un video: qué modelo hizo qué, cuántos tokens y cuántas vueltas.

  Perfil v1: <video>/work/usage.jsonl y <video>/usage.json.
  Perfil v2: logs/videos/<video-id>/usage-<key>.jsonl y su resumen en ese directorio.
  El proceso anfitrión registra la referencia del ledger en el índice del perfil.

Una línea:
  {"ts", "provider", "model", "role", "step", "iteration", "input_tokens", "cached_input_tokens",
   "output_tokens", "reasoning_tokens", "seconds", "ok", "billing", "note"}

provider: codex | claude | deepseek | gemini | gemini_tts | whisper | kit (comandos del kit, sin tokens).
billing: "suscripción" (CLI local: Codex con ChatGPT, Claude Code), "api" (se paga por token) o "local".
El backend escribe el mismo formato (src/core/explainer/usage.py): este archivo es la referencia.
"""
from __future__ import annotations

import datetime
import hashlib
import json
import pathlib
import re

LEDGER = "work/usage.jsonl"
SUMMARY = "usage.json"
TOKEN_FIELDS = ("input_tokens", "cached_input_tokens", "output_tokens", "reasoning_tokens")
BILLING = {"codex": "suscripción", "claude": "suscripción", "deepseek": "api", "gemini": "api",
           "gemini_tts": "api", "whisper": "local", "kit": "local"}


def _profile_paths(video_dir):
    """Return v2 ledger/summary paths, or None for the legacy layout.

    This resolver only reads the profile manifest through settings; it never reads
    data/ or session files. The agent can write its own video log directory.
    """
    import sys
    server = pathlib.Path(__file__).resolve().parents[5]
    if str(server) not in sys.path:
        sys.path.insert(0, str(server))
    from src.config.profile_layout import layout_for_settings
    from src.config.settings import settings

    layout = layout_for_settings(settings)
    if layout.schema_version < 2:
        return None
    video = pathlib.Path(video_dir).resolve()
    for root, namespace in ((layout.productions_dir, "productions"), (layout.sandbox_dir, "sandbox")):
        resolved = root.resolve()
        if video != resolved and video.is_relative_to(resolved):
            rel = video.relative_to(resolved)
            if len(rel.parts) != 2 or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,127}", video.name):
                raise ValueError("Invalid video path for usage log")
            key = f"{namespace}/{rel.as_posix()}"
            ident = hashlib.sha256(key.encode()).hexdigest()[:24]
            log_root = layout.logs_dir.resolve()
            log_dir = layout.logs_dir / "videos" / video.name
            if not log_root.is_relative_to(layout.root.resolve()) or not log_dir.resolve().is_relative_to(log_root):
                raise ValueError("Usage log directory escapes selected profile")
            ledger, summary = log_dir / f"usage-{ident}.jsonl", log_dir / f"usage-{ident}.summary.json"
            if any(not path.resolve().is_relative_to(log_root) for path in (ledger, summary)):
                raise ValueError("Usage path escapes selected profile")
            return ledger, summary
    raise ValueError("Video is outside selected profile")


def ledger_path(video_dir):
    paths = _profile_paths(video_dir)
    return paths[0] if paths else pathlib.Path(video_dir) / LEDGER


def summary_path(video_dir):
    paths = _profile_paths(video_dir)
    return paths[1] if paths else pathlib.Path(video_dir) / SUMMARY


async def register_reference(video_dir):
    """Host only: idempotently register the existing usage ledger in profile data."""
    paths = _profile_paths(video_dir)
    if not paths or not paths[0].is_file():
        return None
    from src.config.profile_layout import layout_for_settings
    from src.config.settings import settings
    from src.core.data import collection, coordination
    from src.core.execution_logs import register_execution_log

    layout = layout_for_settings(settings)
    ledger = paths[0].resolve()
    if not ledger.is_relative_to(layout.logs_dir.resolve()):
        raise ValueError("Usage ledger escapes profile logs")
    key = ledger.relative_to(layout.root.resolve()).as_posix()
    ident = hashlib.sha256(key.encode()).hexdigest()
    async with coordination("content-video-usage-" + ident):
        previous = collection("execution_logs").first({"key": key})
        if previous:
            return previous["log_id"]
        ref = await register_execution_log(key, kind="usage", video_id=pathlib.Path(video_dir).name)
        return ref.log_id


def record(video_dir, *, provider: str, model: str = "", role: str = "", step: str = "",
           iteration: int | None = None, seconds: float = 0.0, ok: bool = True, note: str = "",
           **tokens) -> dict:
    """Agrega una línea al registro del video. Nunca rompe a quien llama (el registro es secundario)."""
    entry = {
        "ts": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
        "provider": provider, "model": model, "role": role, "step": step,
        "iteration": iteration if iteration is not None else next_iteration(video_dir, role, step),
        **{k: int(tokens.get(k) or 0) for k in TOKEN_FIELDS},
        "seconds": round(float(seconds or 0), 2), "ok": bool(ok),
        "billing": BILLING.get(provider, ""), "note": note[:300],
    }
    try:
        path = ledger_path(video_dir)
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except (OSError, ValueError):
        pass
    return entry


def entries(video_dir) -> list[dict]:
    try:
        path = ledger_path(video_dir)
    except (OSError, ValueError):
        return []
    if not path.exists():
        return []
    out = []
    for line in path.read_text(encoding="utf-8").splitlines():
        try:
            out.append(json.loads(line))
        except ValueError:
            continue
    return out


def next_iteration(video_dir, role: str, step: str) -> int:
    """Vuelta número N de este rol+paso (1 la primera): así se cuentan las iteraciones solas."""
    return 1 + sum(1 for e in entries(video_dir) if e.get("role") == role and e.get("step") == step)


def _bucket() -> dict:
    return {"calls": 0, "failed": 0, "seconds": 0.0, **{k: 0 for k in TOKEN_FIELDS}}


def _add(bucket: dict, e: dict) -> None:
    bucket["calls"] += 1
    bucket["failed"] += 0 if e.get("ok", True) else 1
    bucket["seconds"] = round(bucket["seconds"] + float(e.get("seconds") or 0), 2)
    for k in TOKEN_FIELDS:
        bucket[k] += int(e.get(k) or 0)


def summarize(video_dir) -> dict:
    """Calcula y guarda un resumen en la ubicación del perfil, y lo devuelve."""
    rows = entries(video_dir)
    total, by_provider, by_model, by_role, iterations = _bucket(), {}, {}, {}, {}
    for e in rows:
        _add(total, e)
        _add(by_provider.setdefault(e.get("provider") or "?", _bucket()), e)
        if e.get("model"):
            _add(by_model.setdefault(f"{e.get('provider')}:{e['model']}", _bucket()), e)
        _add(by_role.setdefault(e.get("role") or "?", _bucket()), e)
        key = f"{e.get('role') or '?'}{':' + e['step'] if e.get('step') else ''}"
        iterations[key] = max(iterations.get(key, 0), int(e.get("iteration") or 1))
    paid = {p: b for p, b in by_provider.items() if BILLING.get(p) == "api"}
    summary = {
        "video": pathlib.Path(video_dir).name,
        "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
        "note": ("Tokens tal como los informa cada proveedor. Codex y Claude corren con la suscripción "
                 "(CLI local, sin costo por token); DeepSeek y Gemini se pagan por token (api)."),
        "totals": total,
        "api_tokens": {p: {k: b[k] for k in TOKEN_FIELDS} for p, b in paid.items()},
        "by_provider": by_provider,
        "by_model": by_model,
        "by_role": by_role,
        "iterations": dict(sorted(iterations.items())),
        "timeline": [{k: e.get(k) for k in ("ts", "provider", "model", "role", "step", "iteration", "ok", "seconds",
                                             "input_tokens", "output_tokens", "note")} for e in rows],
    }
    target = summary_path(video_dir)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return summary
