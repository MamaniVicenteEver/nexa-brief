"""Trazas de llamadas que pueden empezar antes de que exista un video.

El detalle vive en logs; data solo indexa su ruta y dimensiones. Los briefs
conservan el trace_id para que una producción pueda asociarlos después.
"""
from __future__ import annotations

import fcntl
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path

from src.config.profile_layout import layout_for_settings
from src.config.settings import settings
from src.core.data import collection, coordination
from src.core.execution_logs import register_execution_log

_ID = re.compile(r"^[a-f0-9]{32}$")
_TOKEN_FIELDS = ("input_tokens", "cached_input_tokens", "output_tokens", "reasoning_tokens", "total_tokens")


def trace_path(trace_id: str) -> Path:
    if not _ID.fullmatch(trace_id):
        raise ValueError("Identificador de traza inválido")
    layout = layout_for_settings(settings)
    root = layout.logs_dir.resolve()
    target = root / "usage" / "traces" / f"{trace_id}.jsonl"
    if not root.is_relative_to(layout.root.resolve()) or not target.resolve().is_relative_to(root):
        raise ValueError("La traza sale del perfil activo")
    return target


async def record_trace(event: dict, *, content_key: str | None = None, design_id: str | None = None) -> None:
    """Guarda un intento idempotente sin guardar prompts, respuestas ni secretos."""
    trace_id = str(event.get("trace_id") or "")
    target = trace_path(trace_id)
    attempt = int(event.get("attempt") or 1)
    if attempt < 1 or attempt > 1000:
        raise ValueError("Número de intento inválido")
    row = {
        "schema_version": 1,
        "event_id": f"{trace_id}:{attempt}",
        "trace_id": trace_id,
        "ts": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "provider": str(event.get("provider") or "")[:80],
        "model": str(event.get("model") or "")[:160],
        "role": "text_generation",
        "step": str(event.get("operation") or "")[:80],
        "attempt": attempt,
        "source": str(event.get("source") or "model_call")[:80],
        "run_id": str(event.get("run_id") or "")[:160],
        "ok": event.get("status") == "ok",
        "error_type": str(event.get("error_type") or "")[:100],
        "seconds": event.get("seconds"),
        **{name: event.get(name) for name in _TOKEN_FIELDS},
    }
    for name in _TOKEN_FIELDS:
        value = row[name]
        row[name] = value if isinstance(value, int) and not isinstance(value, bool) and value >= 0 else None
    row["usage_known"] = any(row[name] is not None for name in _TOKEN_FIELDS)
    if isinstance(event.get("cost_usd"), (int, float)) and not isinstance(event.get("cost_usd"), bool) and event["cost_usd"] >= 0:
        row["cost_usd"] = event["cost_usd"]
    if isinstance(event.get("turns"), int) and event["turns"] >= 0:
        row["turns"] = event["turns"]
    layout = layout_for_settings(settings)
    key = target.relative_to(layout.root.resolve()).as_posix()
    async with coordination("content-video-usage-trace-" + trace_id):
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open("a+", encoding="utf-8") as fh:
            fcntl.flock(fh, fcntl.LOCK_EX)
            fh.seek(0)
            for line in fh:
                try:
                    previous = json.loads(line)
                except ValueError:
                    continue
                if isinstance(previous, dict) and previous.get("event_id") == row["event_id"]:
                    break
            else:
                fh.seek(0, 2)
                fh.write(json.dumps(row, ensure_ascii=False) + "\n")
        logs = collection("execution_logs")
        if not logs.first({"key": key}):
            ref = await register_execution_log(key, kind="usage_trace", content_key=content_key)
            await logs.update(ref.log_id, {"trace_id": trace_id, "design_id": design_id})


def read_trace(trace_id: str) -> list[dict]:
    try:
        lines = trace_path(trace_id).read_text(encoding="utf-8").splitlines()
    except (OSError, ValueError):
        return []
    rows = []
    for line in lines:
        try:
            row = json.loads(line)
        except ValueError:
            continue
        if isinstance(row, dict):
            rows.append(row)
    return rows


def events_for_content(content_key: str) -> list[dict]:
    ids = {row.get("trace_id") for row in collection("execution_logs").list({"content_key": content_key})
           if row.get("kind") == "usage_trace" and isinstance(row.get("trace_id"), str)}
    return [event for trace_id in sorted(ids) for event in read_trace(trace_id)]


async def link_brief(trace_id: str, production_id: str, content_key: str, design_id: str) -> bool:
    """Asocia un brief existente a una o más producciones sin copiar la traza."""
    if not _ID.fullmatch(trace_id):
        return False
    logs = collection("execution_logs")
    async with coordination("content-video-usage-trace-" + trace_id):
        row = logs.first({"trace_id": trace_id, "kind": "usage_trace"})
        if not row or row.get("design_id") not in (None, design_id):
            return False
        links = [link for link in row.get("production_links", []) if isinstance(link, dict)]
        link = {"production_id": production_id, "content_key": content_key}
        if link not in links:
            links.append(link)
            await logs.update(row["log_id"], {"production_links": links})
        return True


async def record_prototype_run(rec: dict, tokens: dict, state: str) -> None:
    """Registra la corrida aunque el prototipo aún no exista o haya sido borrado."""
    run_id = str(rec.get("run_id") or "")
    category = str(rec.get("category") or "")
    template_id = str(rec.get("template_id") or "")
    if not all(re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,127}", part) for part in (run_id, category, template_id)):
        raise ValueError("Identidad de prototipo inválida")
    reported = rec.get("claude_usage") or rec.get("codex_usage") or {}
    known = bool(reported) or bool(tokens.get("_usage_known"))
    event = {
        "trace_id": hashlib.sha256(f"prototype:{run_id}".encode()).hexdigest()[:32],
        "attempt": 1, "source": "prototype_run", "run_id": run_id,
        "operation": "prototype", "status": "ok" if state == "done" else "failed",
        "provider": tokens.get("provider") or rec.get("agent"), "model": tokens.get("model"),
        "turns": tokens.get("turns"), "cost_usd": tokens.get("cost_usd"),
        **{name: tokens.get(name) if known else None for name in _TOKEN_FIELDS},
    }
    await record_trace(event, content_key=f"sandbox/{category}/{template_id}")


async def record_preparation_run(rec: dict, usage: dict, model: str, *, ok: bool, seconds: float | None = None) -> None:
    """Asocia una preparación editorial al proyecto, incluso si el agente falla."""
    run_id = str(rec.get("run_id") or "")
    folder = str(rec.get("folder") or "")
    project_id = str(rec.get("project_id") or "")
    if not all(re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,127}", part) for part in (run_id, folder, project_id)):
        raise ValueError("Identidad de preparación inválida")
    usage = usage if isinstance(usage, dict) else {}
    event = {
        "trace_id": hashlib.sha256(f"preparation:{run_id}".encode()).hexdigest()[:32],
        "attempt": 1, "source": "sandbox_preparation", "run_id": run_id,
        "operation": "sandbox_preparation", "status": "ok" if ok else "failed",
        "provider": rec.get("agent"), "model": model or rec.get("agent"),
        "turns": usage.get("turns"), "cost_usd": usage.get("cost_usd"), "seconds": seconds,
        **{name: usage.get(name) for name in _TOKEN_FIELDS},
    }
    await record_trace(event, content_key=f"sandbox/{folder}/{project_id}")
