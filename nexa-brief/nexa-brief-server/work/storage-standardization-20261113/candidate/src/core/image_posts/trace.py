"""Traza única por post. Consolida los artefactos existentes sin repetir los chequeos."""
from __future__ import annotations

from contextvars import ContextVar
from datetime import datetime, timezone
import json
import copy
import os
from pathlib import Path
import tempfile
import time
import hashlib

from .security import redact_persisted_value

current_trace: ContextVar[Trace | None] = ContextVar("image_post_trace", default=None)
model_step: ContextVar[str | None] = ContextVar("image_model_step", default=None)
PRICING = Path(__file__).resolve().parents[2] / "skills/image_posts/pricing.json"
TOKEN_FIELDS = ("input_tokens", "cached_input_tokens", "output_tokens", "total_tokens")
STEP_NAMES = {"copy_draft": "Redacción", "copy_repair": "Reparación", "fact_check": "Cotejo factual",
              "media_judge": "Juicio de foto", "visual_check": "Cotejo visual",
              "image_copy": "Redacción", "image_fact_check": "Cotejo factual", "image_photo_judge": "Juicio de foto"}


def now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def read(path, default=None):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return default


def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=".trace-", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            json.dump(redact_persisted_value(value), stream, ensure_ascii=False, indent=2)
            stream.write("\n")
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary): os.unlink(temporary)


def call_cost(call, config):
    provider, model = call.get("provider"), call.get("model")
    if provider in config["subscription_providers"]:
        return {"usd": 0, "label": config["subscription_providers"][provider], "estimated": False}
    rates = config["models"].get(model)
    if not rates or rates["provider"] != provider:
        return {"usd": None, "label": "Precio sin configurar", "estimated": True}
    schedule = config["peak_utc"]
    stamp = call.get("used_at") or call.get("started_at")
    date = datetime.fromisoformat(stamp.replace("Z", "+00:00")).astimezone(timezone.utc) if stamp else None
    peak = date is None or (date.weekday() in schedule["weekdays"] and date.date().isoformat() not in schedule["holidays"]
                           and any(a <= date.hour < b for a, b in schedule["hours"]))
    prices = rates["peak" if peak else "off_peak"]
    incoming, cached, outgoing = (call.get(key) for key in TOKEN_FIELDS[:3])
    if incoming is None or outgoing is None:
        return {"usd": None, "label": "Consumo no informado", "estimated": True, "rates": prices}
    cached_count = min(incoming, cached or 0)
    amount = ((incoming-cached_count)*prices["input"] + cached_count*prices["cached_input"] + outgoing*prices["output"]) / 1_000_000
    return {"usd": round(amount, 10), "label": "Estimado según tarifa configurada", "estimated": True,
            "rates": prices, "tariff": "peak" if peak else "off_peak", "cache_reported": cached is not None}


def totals(calls, events, config):
    by_model = {}
    for call in calls:
        key = f"{call.get('provider')}/{call.get('model')}"
        row = by_model.setdefault(key, {"provider": call.get("provider"), "model": call.get("model"), "calls": 0,
                                       **{k: 0 for k in TOKEN_FIELDS}, "cost_usd": 0, "unknown_usage_calls": 0})
        row["calls"] += 1
        if any(call.get(k) is None for k in ("input_tokens", "output_tokens")): row["unknown_usage_calls"] += 1
        for field in TOKEN_FIELDS: row[field] += call.get(field) or 0
        row["cost_usd"] += call["cost"].get("usd") or 0
        row["cost_label"] = call["cost"]["label"]
    repairs = [e for e in events if e.get("repair") is not None or e.get("patch") is not None]
    rejections = [e for e in events if e.get("rejected_fields") and not (e.get("repair") is not None or e.get("patch") is not None)]
    fields = sum(len(e.get("applied_changes", [])) for e in repairs)
    unknown = sum(c["cost"]["usd"] is None for c in calls)
    return {"calls": len(calls), "writer_rounds": max(sum(e.get("draft") is not None and not e.get("accepted") and e.get("step") == "copy" for e in events), sum(c.get("step") in {"copy_draft", "image_copy"} and c.get("status", "ok") == "ok" for c in calls)),
            "repairs": len(repairs), "corrections": fields, "rejections": len(rejections),
            "tokens": {k: sum(c.get(k) or 0 for c in calls) for k in TOKEN_FIELDS}, "by_model": list(by_model.values()),
            "cost": {"usd": round(sum(c["cost"]["usd"] or 0 for c in calls), 10), "currency": "USD",
                     "complete": unknown == 0, "unpriced_calls": unknown,
                     "label": "incluido en la suscripción" if calls and all(c.get("provider") == "codex" for c in calls) else "Costo estimado"},
            "unknown_usage_calls": sum(any(c.get(k) is None for k in ("input_tokens", "output_tokens")) for c in calls)}


class Events(list):
    def __init__(self, step):
        super().__init__()
        self.step = step

    def append(self, event):
        value = copy.deepcopy({"at": now(), **event})
        super().append(value)
        trace = current_trace.get()
        if trace: trace.event(self.step, value)


def emit(step, **details):
    trace = current_trace.get()
    if trace: trace.event(step, details)


def add_call(call):
    trace = current_trace.get()
    if trace: trace.calls.append(dict(call))


class Trace:
    def __init__(self, folder, identity=None):
        self.folder = Path(folder)
        self.data = read(self.folder / "trace.json", {}) or {}
        self.identity = {**self.data.get("identity", {}), **(identity or {})}
        self.started_at = self.data.get("started_at") or now()
        self.tick = time.monotonic()
        self.calls = list(self.data.get("model_calls", []))
        self.events = list(self.data.get("events", []))

    def event(self, step, details):
        self.events.append(copy.deepcopy({"sequence": len(self.events)+1, "step": step, "at": now(), **details}))

    def consolidate(self, status, error=None):
        # usage.json y model-calls son la misma evidencia: call_id evita contarlos dos veces.
        def identity(call):
            if call.get("call_id"): return call["call_id"]
            raw = {k: v for k, v in call.items() if k not in {"cost", "order", "label", "log_dir", "step"}}
            return hashlib.sha256(json.dumps(raw, sort_keys=True).encode()).hexdigest()
        known = {identity(c) for c in self.calls}
        usage = read(self.folder / "usage.json", []) or []
        for path in sorted((self.folder / "model-calls").glob("*/usage.json")):
            usage += read(path, []) or []
        for call in usage:
            if identity(call) not in known:
                self.calls.append(call); known.add(identity(call))
        self.calls.sort(key=lambda c: c.get("used_at") or c.get("started_at") or self.started_at)
        config = read(PRICING)
        for index, call in enumerate(self.calls, 1):
            call["order"] = index
            call["step"] = call.get("step") or call.get("role") or "modelo"
            call["label"] = STEP_NAMES.get(call["step"], call["step"])
            call["cost"] = call_cost(call, config)
            call.pop("log_dir", None)
        artifacts = {name: read(self.folder / name) for name in ("audit.json", "copy-attempts.json", "recheck-attempts.json", "photo-decisions.json", "qc.json", "failure.json") if (self.folder/name).is_file()}
        # Las rutas CLI conservan reparaciones de composición y recotejos en audit.json.
        # Incorporar esa evidencia sin volver a contar eventos capturados en vivo.
        def event_key(event):
            return json.dumps({k: v for k, v in event.items() if k not in {"sequence", "step", "applied_changes", "kind", "label", "at"}}, sort_keys=True)
        seen_events = {event_key(e) for e in self.events}
        audit = artifacts.get("audit.json", {})
        for step, entries in [("copy", artifacts.get("copy-attempts.json", [])), ("copy", audit.get("events", [])),
                              ("copy", audit.get("recheck_events", [])), ("copy", artifacts.get("recheck-attempts.json", [])),
                              ("composition_repair", audit.get("composition_repairs", []))]:
            for entry in entries:
                key = event_key(entry)
                if key not in seen_events:
                    self.events.append({"sequence": len(self.events)+1, "step": step, "at": entry.get("at") or self.started_at, **entry})
                    seen_events.add(key)
        # Las reparaciones guardan tanto lo pedido como los valores efectivamente aplicados.
        draft = None
        for event in self.events:
            if event.get("draft") is not None: draft = copy.deepcopy(event["draft"])
            patch = event.get("patch") or (event.get("repair") if isinstance(event.get("repair"), dict) else None)
            if patch:
                applied = []
                for change in patch.get("changes", []):
                    path = change.get("path", "")
                    if path not in event.get("rejected_fields", {}): continue
                    node = draft
                    try:
                        for key in path.split(".")[:-1]: node = node[key]
                        before = node[path.split(".")[-1]]
                        after = change.get("value")
                        if before != after:
                            applied.append({"path": path, "before": before, "after": after,
                                            "reason": event["rejected_fields"][path]})
                            node[path.split(".")[-1]] = after
                    except (KeyError, TypeError): pass
                event.setdefault("applied_changes", applied)
        timeline = [{"at": c.get("used_at") or self.started_at, "step": c["step"], "label": c["label"], "kind": "model_call", "call_id": c.get("call_id"),
                     "status": c.get("status", "ok"), "reason": c.get("error") or c.get("fallback_reason"), "seconds": c.get("seconds"),
                     "provider": c.get("provider"), "model": c.get("model"), "attempt": c.get("attempt"), "fallback": c.get("fallback", False)} for c in self.calls]
        for event in self.events:
            label = ("Reparación" if event.get("repair") is not None else "Campos rechazados" if event.get("rejected_fields") else
                     "Cotejo factual" if event.get("review") else "Borrador aceptado" if event.get("accepted") else
                     "Borrador" if event.get("draft") else event.get("label") or event["step"])
            timeline.append({**event, "kind": "event", "label": label})
        timeline.sort(key=lambda e: e.get("at") or self.started_at)
        result = {"schema_version": 1, "identity": self.identity, "started_at": self.started_at, "finished_at": now(),
                  "duration_seconds": round(self.data.get("duration_seconds", 0)+time.monotonic()-self.tick, 3),
                  "status": status, "error": error, "model_calls": self.calls, "events": self.events, "timeline": timeline,
                  "corrections": {"events": [e for e in self.events if e.get("rejected_fields") or e.get("repair") is not None]},
                  "photos": artifacts.get("photo-decisions.json", []), "render_qc": {"result": artifacts.get("qc.json", {}), "attempts": [e for e in self.events if e["step"] in {"render", "render_qc", "composition_repair"}]},
                  "artifacts": artifacts, "totals": totals(self.calls, self.events, config),
                  "pricing": config, "execution_log": "execution.log" if (self.folder/"execution.log").exists() else None}
        save(self.folder / "trace.json", result)
        return result
