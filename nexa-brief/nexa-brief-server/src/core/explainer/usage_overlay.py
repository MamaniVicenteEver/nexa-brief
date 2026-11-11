"""Read a provenance-checked usage correction without rewriting its ledger."""
from __future__ import annotations

import hashlib
import json
import re


def row_hash(row):
    return hashlib.sha256(json.dumps(row, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def apply_overlay(path, rows):
    overlay = path.with_name(path.name + ".normalization.json")
    try:
        if overlay.is_symlink() or not overlay.is_file() or overlay.stat().st_size > 4 * 1024 * 1024:
            return rows
        data = json.loads(overlay.read_text())
        raw = path.read_bytes()
        size = data["ledger_prefix_bytes"]
        if (data.get("version") != 1 or not isinstance(size, int) or not 0 <= size <= len(raw)
                or hashlib.sha256(raw[:size]).hexdigest() != data["ledger_prefix_sha256"]):
            return rows
        if not data.get("sources"):
            return rows
        for source in data.get("sources", []):
            name = source["file"]
            if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]*\.log", name):
                return rows
            source_path = path.parent / name
            if source_path.is_symlink() or not source_path.is_file():
                return rows
            sha = hashlib.sha256()
            with source_path.open("rb") as stream:
                for block in iter(lambda: stream.read(1024 * 1024), b""):
                    sha.update(block)
            if sha.hexdigest() != source["sha256"]:
                return rows
        replacements = {x["event_id"]: x for x in data.get("replacements", [])}
        result, seen = [], set()
        for row in rows:
            replacement = replacements.get(row.get("event_id"))
            if replacement and row_hash(row) == replacement["original_sha256"]:
                fields = replacement["fields"]
                row = {**row, **fields, "event_id": row["event_id"],
                       "normalization_source": replacement["source"]}
            result.append(row)
            if row.get("provider_result_id"):
                seen.add(row["provider_result_id"])
        for recovered in data.get("recovered_events", []):
            ident = recovered.get("provider_result_id")
            if ident and ident not in seen:
                result.append(recovered)
                seen.add(ident)
        return result
    except (OSError, ValueError, TypeError, KeyError):
        return rows  # Never replace evidence when provenance cannot be checked.


def build_claude_overlay(ledger_path, log_path):
    """Derive corrections from one finished production's immutable CLI log.

    This function never writes. Missing/ambiguous matches remain untouched;
    callers persist the returned sidecar explicitly after inspecting its report.
    """
    from src.adapters.agent.infrastructure.claude_usage_normalization import normalize_claude_result
    ledger_bytes = ledger_path.read_bytes()
    log_bytes = log_path.read_bytes()
    ledger = [json.loads(line) for line in ledger_bytes.decode().splitlines() if line.strip()]
    source = {"file": log_path.name, "sha256": hashlib.sha256(log_bytes).hexdigest()}
    results, seen = [], set()
    phase = None
    for line_number, line in enumerate(log_bytes.decode(errors="replace").splitlines(), 1):
        marker = re.fullmatch(r"\[agente ([a-z_]+)\]", line.strip())
        if marker:
            phase = marker[1]
        try:
            event = json.loads(line)
        except ValueError:
            continue
        if event.get("type") != "result" or not event.get("uuid") or event["uuid"] in seen:
            continue
        seen.add(event["uuid"])
        models = event.get("modelUsage") or {}
        if not phase or len(models) != 1:
            continue
        results.append({"uuid": event["uuid"], "phase": phase, "model": next(iter(models)),
                        "seconds": float(event.get("duration_ms") or 0) / 1000,
                        "usage": normalize_claude_result(event), "ok": not event.get("is_error", False),
                        "line": line_number})
    replacements, recovered, matched, ambiguous = [], [], set(), []
    for row in ledger:
        if row.get("provider") != "claude":
            continue
        candidates = [r for r in results if r["uuid"] not in matched and (
            row.get("provider_result_id") == r["uuid"] or (
                row.get("step") == r["phase"] and row.get("model") == r["model"]
                and row.get("output_tokens") == r["usage"]["output_tokens"]
                and abs(float(row.get("seconds") or 0) - r["seconds"]) < 5))]
        if len(candidates) != 1 or not row.get("event_id"):
            ambiguous.append({"event_id": row.get("event_id"), "step": row.get("step"),
                              "candidate_results": [r["uuid"] for r in candidates]})
            continue
        result = candidates[0]
        matched.add(result["uuid"])
        replacements.append({"event_id": row["event_id"], "original_sha256": row_hash(row),
            "fields": result["usage"], "source": {**source, "result_uuid": result["uuid"],
            "line": result["line"], "method": "strict-phase-model-output-duration-match"}})
    # Any unmatched old row makes recovery of additional calls ambiguous.
    # Preserve the evidence and require a human to resolve it instead of adding.
    if not ambiguous:
        for result in results:
            if result["uuid"] in matched:
                continue
            recovered.append({"event_id": "recovered-cli-" + result["uuid"], "ts": None,
                "provider": "claude", "model": result["model"], "role": "producer", "step": result["phase"],
                "seconds": result["seconds"], "ok": result["ok"], "billing": "suscripción",
                "schema_version": 2, **result["usage"],
                "note": "Recovered CLI result: the host emitted no ledger row. Reported list cost is not an invoice.",
                "normalization_source": {**source, "result_uuid": result["uuid"], "line": result["line"],
                                         "method": "raw-result-without-ledger-event"}})
    overlay = {"version": 1, "ledger_prefix_bytes": len(ledger_bytes),
               "ledger_prefix_sha256": hashlib.sha256(ledger_bytes).hexdigest(),
               "sources": [source], "replacements": replacements, "recovered_events": recovered,
               "unresolved": ambiguous, "original_ledger_unchanged": True}
    return overlay
