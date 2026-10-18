"""Registro de uso de modelos de un video: qué modelo hizo qué, cuántos tokens y cuántas vueltas.

  <video>/work/usage.jsonl   una línea por llamada (la escriben el kit, el backend y los agentes)
  <video>/usage.json         resumen (kit.py usage <id>): totales por proveedor, modelo, rol y paso

Una línea:
  {"ts", "provider", "model", "role", "step", "iteration", "input_tokens", "cached_input_tokens",
   "output_tokens", "reasoning_tokens", "seconds", "ok", "billing", "note"}

provider: codex | claude | deepseek | gemini | gemini_tts | whisper | kit (comandos del kit, sin tokens).
billing: "suscripción" (CLI local: Codex con ChatGPT, Claude Code), "api" (se paga por token) o "local".
El backend escribe el mismo formato (src/core/explainer/usage.py): este archivo es la referencia.
"""
from __future__ import annotations

import datetime
import json
import pathlib

LEDGER = "work/usage.jsonl"
SUMMARY = "usage.json"
TOKEN_FIELDS = ("input_tokens", "cached_input_tokens", "output_tokens", "reasoning_tokens")
BILLING = {"codex": "suscripción", "claude": "suscripción", "deepseek": "api", "gemini": "api",
           "gemini_tts": "api", "whisper": "local", "kit": "local"}


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
        path = pathlib.Path(video_dir) / LEDGER
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except OSError:
        pass
    return entry


def entries(video_dir) -> list[dict]:
    path = pathlib.Path(video_dir) / LEDGER
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
    """Resumen del registro → <video>/usage.json (y lo devuelve)."""
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
    (pathlib.Path(video_dir) / SUMMARY).write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return summary
