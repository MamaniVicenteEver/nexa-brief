"""Read-only studio data from the selected edition; never borrow ES editorial data."""
from __future__ import annotations

import math
import json
import re
from urllib.parse import urlencode

from src.config.content_paths import content_key
from .io import read, safe


def review_issues(production, folder, *, stale=False):
    from .packaging import approved, load_native
    issues = []
    if stale:
        issues.append({"level": "warning", "field": "source", "message": "El original cambió; revisa esta edición antes de publicar."})
    if not approved(folder):
        issues.append({"level": "warning", "field": "review", "message": "Revisa el audio y los textos de esta edición antes de aprobar su publicación."})
    package = load_native(folder)
    if package is None:
        issues.append({"level": "warning", "field": "thumbnails", "message": "Falta preparar las tres miniaturas de esta edición."})
    else:
        # Compare against the frozen source package; never borrow its contents at
        # publication time. Existing incomplete revisions must be repaired/reviewed.
        from src.core.explainer.publishing.store import load_package
        source = load_package(production)
        if source is not None:
            from .attribution import represented
            current = read(safe(folder, "publish.json")).get("youtube", {}).get("description", "")
            for field, label in (("sources", "fuentes"), ("credits", "créditos")):
                missing = [entry for entry in getattr(source, field)
                           if entry not in getattr(package, field)
                           and not represented(entry, current, credit=field == "credits")]
                if missing:
                    issues.append({"level": "error", "field": field,
                                   "message": f"Faltan {label} del original en esta edición; completa el paquete y vuelve a revisarlo."})
        if hasattr(package, "sources") and hasattr(package, "credits"):
            from .attribution import description_issues, youtube_description
            publish = read(safe(folder, "publish.json"))
            locale = read(safe(folder, "edition.json")).get("locale", "")
            description = youtube_description(publish.get("youtube", {}).get("description", ""), package, locale)
            issues.extend({"level": "error", "field": "youtube_description", "message": message}
                          for message in description_issues(description))
    return issues


def studio_summary(video, folder, *, stale=False):
    if folder is None:
        return None
    board_path = safe(folder, "storyboard.publication.json")
    board = read(board_path if board_path.is_file() else safe(folder, "storyboard.json"))
    edition = read(safe(folder, "edition.json"))
    issues = review_issues(video.path, folder, stale=stale)
    opening = next((beat for beat in board.get("beats", []) if beat.get("t") == 0 and beat.get("layer", "main") == "main"), None)
    preview = f"/api/v1/explainer/files/{content_key(video.path)}/index.html"
    if opening:
        params = opening.get("params", {})
        text = params.get("text") or params.get("title") or " ".join(params.get("lines", []))
        image = params.get("src") or params.get("image")
        if isinstance(image, str) and image.startswith("/productions/"):
            image = "/api/v1/explainer/files" + image
        elif isinstance(image, str) and image.startswith("assets/"):
            image = preview.removesuffix("index.html") + image
        else:
            image = None
        opening = {"text": text if isinstance(text, str) else "", "image_url": image,
                   "preview_url": preview + "?" + urlencode({"edition": edition["locale"], "revision": folder.name, "t": 2}),
                   "component": opening["use"]}
    rules = edition.get("resolved_strategies", {}).get("title", {}).get("effective", {})
    from .packaging import approval_token, load_native
    ready = safe(folder, "song-with-outro.mp3").is_file() and not stale and load_native(folder) is not None
    publish_ready = ready and not issues and bool(read(safe(folder, "publish.json")).get("youtube", {}).get("title", "").strip())
    return {"issues": issues, "title_max_chars": rules.get("max_chars", 100), "opening": opening,
            "duration_seconds": read(safe(folder, "lyrics.json")).get("metadata", {}).get("duration"),
            "ready": ready, "publish_ready": publish_ready, "approval_token": approval_token(folder),
            "capabilities": {"record": ready, "publish": publish_ready}}


MAX_USAGE_BYTES = 65536
MAX_LEDGER_BYTES = 4 * 1024 * 1024
MAX_LEDGER_LINES = 4096
MAX_EDITORIAL_ATTEMPTS = 128
MAX_USAGE_ROWS = 10000


def _usage_rows(stage):
    """Bound every read and reject symlinks, including in legacy agent directories."""
    rows, unmeasured = [], 0
    context = safe(stage, "usage-context.json")
    identity, historical = None, False
    if context.is_file():
        try:
            if context.stat().st_size > 4096:
                raise ValueError("Oversized usage context")
            value = read(context)
            if (not isinstance(value, dict) or value.get("schema_version") != 1
                    or not isinstance(value.get("locale"), str)
                    or not re.fullmatch(r"[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*", value["locale"])
                    or not isinstance(value.get("revision"), str)
                    or not re.fullmatch(r"rev-\d{3,}", value["revision"])
                    or set(value) - {"schema_version", "locale", "revision", "historical_usage_unattributed"}
                    or not isinstance(value.get("historical_usage_unattributed", False), bool)):
                raise ValueError("Invalid usage context")
            identity = (value["locale"], value["revision"])
            historical = value.get("historical_usage_unattributed", False)
        except (ValueError, OSError):
            unmeasured += 1
    agent = safe(stage, "agent")
    if agent.is_dir():
        for index, path in enumerate(sorted(agent.glob("*.usage.json"))):
            if index >= MAX_EDITORIAL_ATTEMPTS:
                unmeasured += 1
                break
            path = safe(agent, path.name)
            try:
                if path.stat().st_size > MAX_USAGE_BYTES:
                    raise ValueError("Oversized editorial usage")
                row = read(path)
                if not isinstance(row, dict):
                    raise ValueError("Invalid editorial usage")
                rows.append(row)
            except (ValueError, OSError):
                unmeasured += 1
    logs = safe(stage, "logs")
    ledger = safe(logs, "usage.jsonl")
    if ledger.is_file():
        try:
            if identity is None or ledger.stat().st_size > MAX_LEDGER_BYTES:
                raise ValueError("Oversized native ledger")
            with ledger.open(encoding="utf-8") as stream:
                for index, line in enumerate(stream):
                    if index >= MAX_LEDGER_LINES:
                        unmeasured += 1
                        break
                    try:
                        if len(line.encode()) > MAX_USAGE_BYTES:
                            raise ValueError("Oversized native usage row")
                        row = json.loads(line)
                        if (not isinstance(row, dict) or row.get("schema_version") != 1
                                or not isinstance(row.get("event_id"), str)
                                or not re.fullmatch(r"[a-f0-9]{32}", row["event_id"])
                                or (row.get("locale"), row.get("revision")) != identity):
                            raise ValueError("Native usage belongs to another revision")
                        rows.append(row)
                    except (ValueError, UnicodeError):
                        unmeasured += 1
        except (ValueError, OSError, UnicodeError):
            unmeasured += 1
    narration_attributed = any(row.get("provider") == "gemini_tts" and row.get("step") != "outro" for row in rows)
    audio_without_ledger = safe(stage, "song.mp3").is_file() and not narration_attributed
    return rows, unmeasured, identity is None or historical or audio_without_ledger


def _valid_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and value >= 0


def editorial_usage(stages):
    """Keep cache/reasoning separate; count only this revision's attributable attempts."""
    groups, unmeasured, voice_unattributed = {}, 0, False
    seen_events, seen_stages, count = set(), set(), 0
    for stage in stages:
        if stage in seen_stages:
            continue
        seen_stages.add(stage)
        rows, missing, unknown_voice = _usage_rows(stage)
        unmeasured += missing
        voice_unattributed |= unknown_voice
        for row in rows:
            event = row.get("event_id")
            if event is not None and (not isinstance(event, str) or not re.fullmatch(r"[a-f0-9]{32}", event)):
                unmeasured += 1
                continue
            if event and event in seen_events:
                continue
            if event:
                seen_events.add(event)
            count += 1
            if count > MAX_USAGE_ROWS:
                unmeasured += 1
                break
            key = (str(row.get("provider") or "unknown"), str(row.get("model") or ""))
            item = groups.setdefault(key, {"provider": key[0], "model": key[1], "calls": 0,
                "failed_calls": 0, "total_tokens": None, "undivided_tokens": 0,
                "fresh_input_tokens": None, "cached_input_tokens": None, "output_tokens": None,
                "prompt_tokens_including_cache": None,
                "reasoning_tokens": None, "reasoning_included_in_output": None,
                "usage_known": False, "unknown_cost_calls": 0, "reported_cost_usd": None})
            item["calls"] += 1
            item["failed_calls"] += row.get("ok") is False
            if _valid_number(row.get("seconds")):
                item["seconds"] = item.get("seconds", 0) + row["seconds"]
            for source, target in (("input_tokens", "fresh_input_tokens"), ("cached_input_tokens", "cached_input_tokens"),
                                   ("prompt_tokens_including_cache", "prompt_tokens_including_cache"),
                                   ("output_tokens", "output_tokens"), ("reasoning_tokens", "reasoning_tokens")):
                value = row.get(source)
                if isinstance(value, int) and not isinstance(value, bool) and value >= 0:
                    item[target] = (item[target] or 0) + value
                    item["usage_known"] = True
            if row.get("reasoning_included_in_output") is not None:
                item["reasoning_included_in_output"] = row["reasoning_included_in_output"]
            cost = row.get("cost_usd")
            if _valid_number(cost):
                item["reported_cost_usd"] = (item["reported_cost_usd"] or 0) + cost
                basis = row.get("cost_basis") or "list"
                item["cost_basis"] = basis if not item.get("cost_basis") or item["cost_basis"] == basis else "mixed"
            else:
                item["unknown_cost_calls"] += 1
        if count > MAX_USAGE_ROWS:
            break
    return {"usage_status": "partial" if groups or unmeasured else "unknown", "total_tokens": None,
            "unmeasured_calls": unmeasured, "voice_usage_unattributed": voice_unattributed or not seen_stages,
            "totals_by_model": list(groups.values())}
