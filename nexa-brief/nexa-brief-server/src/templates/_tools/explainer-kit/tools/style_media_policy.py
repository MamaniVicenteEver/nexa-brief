#!/usr/bin/env python3
"""Scoped media windows for a style; read-only report, also used by kit.py check.

The storyboard keeps the engine's timings. We measure a main media window until
the next main scene, the outro or audio end, and inspect campaign plates inside it.
Graphic maps, flags, labels and overlays are not documentary photos or clips.
"""
from __future__ import annotations

import json
import math
from pathlib import Path
import re
import sys
import unicodedata

KIT = Path(__file__).resolve().parents[1]


def policy_for(config):
    return json.loads((KIT / "production-policy.json").read_text(encoding="utf-8")).get(
        "style_policies", {}).get(config.get("design"))


def titanes_media(beat, catalog):
    """Documentary media only; TITANES figures and layer assets are graphics."""
    params = beat["b"].get("params") or {}
    use = beat["use"]
    if use.startswith("titanes.") or use == "common.capas":
        if use not in ("titanes.foto", "titanes.introv1", "titanes.introv2"):
            return [], []
        src = params.get("src")
        if not isinstance(src, str) or not src.strip():
            return [], []
        video = use == "titanes.foto" and (params.get("tipo") == "video" or
                 (params.get("tipo", "auto") == "auto" and
                  src.split("?", 1)[0].lower().endswith((".mp4", ".webm", ".mov", ".m4v"))))
        return ([], [src]) if video else ([src], [])
    spec = catalog.get(use, {}).get("params", {})
    video = [str(params[k]) for k, rule in spec.items() if rule.get("type") == "video" and params.get(k)]
    photos = [str(params[k]) for k, rule in spec.items() if rule.get("type") == "image" and params.get(k)
              and k not in ("logo", "srcAfter") and (k != "poster" or (not video and use == "common.tabloid"))]
    if use == "common.tabloid" and params.get("mode") == "split" and params.get("srcAfter"):
        photos.append(str(params["srcAfter"]))
    return list(dict.fromkeys(photos)), list(dict.fromkeys(video))


def _norm(value):
    value = unicodedata.normalize("NFD", str(value).lower())
    value = "".join(c for c in value if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9ñ\s]+", "", value)).strip()


def _local_time(value, beat, words):
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str) and value.startswith("@"):
        match = re.fullmatch(r"(.*?)(?:([+-])(\d*\.?\d+))?", value[1:])
        tokens = _norm(match[1]).split()
        if not tokens:
            raise ValueError(f"ancla vacía {value!r}")
        for i in range(max(0, beat.get("wi", 0)), len(words)):
            if all(i + k < len(words) and _norm(words[i + k].get("t", words[i + k].get("word", ""))) == token
                   for k, token in enumerate(tokens)):
                shift = float(match[3] or 0) * (-1 if match[2] == "-" else 1)
                return max(0, words[i].get("s", words[i].get("start", 0)) - beat["t0"] + shift)
    raise ValueError(f"tiempo local no resoluble {value!r}")


def check_openings(config, beats, policy, errors, proto=None):
    """B/C de Imperio siempre cuentan con texto e imagen, también fuera de la apertura elegida."""
    required = set((policy.get("openings") or {}).get("image_required", []))
    if not required:
        return
    for beat in beats:
        if beat.get("skip") or beat["use"] not in required:
            continue
        params = beat["b"].get("params") or {}
        if not str(params.get("src") or "").strip():
            errors.append(f"imperio beat #{beat['i']} {beat['use']}: requiere fotografía en src (texto + imagen)")
        if not str(params.get("text") or "").strip():
            errors.append(f"imperio beat #{beat['i']} {beat['use']}: requiere titular en text")
    if proto is None:
        return
    root = Path(proto).resolve()
    path = root / "publish.json"
    if not path.exists():
        return
    try:
        package = json.loads(path.read_text(encoding="utf-8"))
        thumbs = package.get("thumbnail")
        if not isinstance(thumbs, dict):  # Paquetes legacy se validan con su contrato histórico.
            return
        photo = thumbs.get("with_image") or {}
        tabloid = thumbs.get("tabloid")
        for option, image in (("B", photo.get("image")), ("C", tabloid.get("image") if isinstance(tabloid, dict) else photo.get("image"))):
            source = (root / "assets/media" / str(image or "")).resolve()
            if not image or not source.is_relative_to(root / "assets/media") or not source.is_file():
                errors.append(f"imperio miniatura {option}: requiere una imagen real existente en assets/media")
    except (ValueError, TypeError, OSError) as exc:
        errors.append(f"imperio aperturas: {exc}")


def check(config, beats, catalog, words, total, errors, proto=None):
    """Return actual allocated windows and append scoped errors, without mutations."""
    policy = policy_for(config)
    if policy is None:
        return None
    if config.get("design") == "titanes":
        return check_titanes(config, beats, catalog, total, errors, policy)
    check_openings(config, beats, policy, errors, proto)
    rules = policy["media"]
    end = min(float(total), float((config.get("outro") or {}).get("start", total)))
    main = sorted((b for b in beats if not b.get("skip") and b.get("layer", "main") == "main"),
                  key=lambda b: (b["t0"], b["i"]))
    windows = []

    def add(beat, kind, source, start, finish, label):
        duration = max(0, finish - start)
        lower, upper = rules[kind + "_seconds"]
        windows.append({"beat": beat["i"], "component": beat["use"], "slot": label,
                        "kind": kind, "src": source, "start": round(start, 4),
                        "end": round(max(start, finish), 4), "duration": round(duration, 4)})
        if duration < lower - 0.01 or duration > upper + 0.01:
            errors.append(f"imperio beat #{beat['i']} {label}: {kind} visible {duration:.2f}s "
                          f"({start:.2f}–{max(start, finish):.2f}s); requerido {lower}–{upper}s")

    for index, beat in enumerate(main):
        if beat["use"] in ("imperio.outro", "common.logo"):
            continue
        stop = min(float(beat["t1"]), end,
                   float(main[index + 1]["t0"]) if index + 1 < len(main) else end)
        params = beat["b"].get("params") or {}
        spec = catalog.get(beat["use"], {}).get("params", {})
        # campaign declares aliases v1/p1 even when they are only used by a plate.
        plates = (params.get("plates") or []) if beat["use"] == "imperio.campaign" else None
        if plates is not None:
            nested = []
            for slot, plate in enumerate(plates):
                label = f"plates[{slot}]"
                kind = "video" if plate.get("video") else "photo" if plate.get("image") else None
                alias = plate.get("video") or plate.get("image")
                source = params.get(alias) if isinstance(alias, str) else None
                expected = "video" if kind == "video" else "image"
                if not kind or not source or spec.get(alias, {}).get("type") != expected:
                    errors.append(f"imperio beat #{beat['i']} {label}: alias video/image inválido")
                    continue
                try:
                    start = beat["t0"] + _local_time(plate.get("at"), beat, words)
                    finish = min(start + float(plate.get("dur", 8)), stop)
                except (ValueError, TypeError) as exc:
                    errors.append(f"imperio beat #{beat['i']} {label}: {exc}")
                    continue
                if float(plate.get("strength", 0.9)) <= 0:
                    finish = start
                add(beat, kind, source, start, finish, label)
                nested.append((start, finish, label))
            for left, right in zip(sorted(nested), sorted(nested)[1:]):
                if left[1] > right[0] + 0.01:
                    errors.append(f"imperio beat #{beat['i']}: {left[2]} y {right[2]} se solapan; "
                                  "usar ventanas independientes para los medios de archivo")
            continue
        videos = [(key, params[key]) for key, rule in spec.items()
                  if rule.get("type") == "video" and params.get(key)]
        photos = [(key, params[key]) for key, rule in spec.items()
                  if rule.get("type") == "image" and params.get(key)
                  and key not in ("logo", "srcAfter", "poster") and not key.lower().startswith("flag")]
        for key, source in videos or photos:
            start = beat["t0"]
            if beat["use"] == "imperio.archive":
                try:
                    start += max(0, _local_time(params.get("photoAt", 0), beat, words))
                except ValueError as exc:
                    errors.append(f"imperio beat #{beat['i']} photoAt: {exc}")
                    continue
            finish = stop
            if beat["use"] == "imperio.archive" and float(params.get("photo", 1)) <= 0:
                finish = start
            add(beat, "video" if videos else "photo", source, start, finish, key)
    report = {"version": policy["version"], "design": config["design"],
              "media": windows, "coverage": "main media and imperio.campaign plates; graphics excluded"}
    if proto is not None:
        report["audio"] = check_audio(proto, config, report, errors)
    return report


def check_titanes(config, beats, catalog, total, errors, policy):
    """Measure actual main windows, including interruption by the next main beat."""
    end = min(float(total), float((config.get("outro") or {}).get("start", total)))
    main = sorted((b for b in beats if not b.get("skip") and b.get("layer", "main") == "main" and b["t0"] < end),
                  key=lambda b: (b["t0"], b["i"]))
    windows = []
    for index, beat in enumerate(main):
        stop = min(float(beat["t1"]), end, float(main[index + 1]["t0"]) if index + 1 < len(main) else end)
        duration = max(0, stop - beat["t0"])
        photos, videos = titanes_media(beat, catalog)
        for kind, sources in (("photo", photos), ("video", videos)):
            lower, upper = policy["media"][kind + "_seconds"]
            for source in sources:
                windows.append({"beat": beat["i"], "component": beat["use"], "kind": kind, "src": source,
                                "start": round(beat["t0"], 4), "end": round(stop, 4), "duration": round(duration, 4)})
                if duration < lower - 1e-9 or duration > upper + 1e-9:
                    errors.append(f"titanes beat #{beat['i']}: {kind} visible {duration:.2f}s; requerido {lower}–{upper}s")
    return {"version": policy["version"], "design": "titanes", "media": windows,
            "coverage": "documentary media in visible main windows; figures and layers excluded"}



def check_audio(proto, config, media_report, errors):
    """Every assigned background sound covers its actual visual support window."""
    policy = policy_for(config)
    if not policy or not policy.get("audio", {}).get("background_matches_support_window"):
        return None
    design = config.get("soundDesign")
    audio = config.get("audio") or {}
    if not design:
        if audio.get("narrationSrc") and audio.get("src") != audio["narrationSrc"]:
            errors.append("imperio audio: mezcla sin soundDesign; declarar plan y supportWindows")
        return {"supports": [], "status": "no_effects"}
    report = {"supports": [], "status": "checked"}
    try:
        root = Path(proto).resolve()
        plan_path = (root / design["planUrl"]).resolve()
        if not plan_path.is_relative_to(root):
            raise ValueError("plan fuera del proyecto")
        cues = json.loads(plan_path.read_text())["cues"]
        supports = design.get("supportWindows", [])
        if cues and not supports:
            raise ValueError("faltan supportWindows para los ambientes del plan")
        tolerance = policy["audio"].get("window_tolerance_seconds", .01)

        def interval(item):
            start, duration = float(item["start"]), float(item["duration"])
            if not math.isfinite(start + duration) or start < 0 or duration <= 0:
                raise ValueError("intervalo de sonido inválido")
            return start, start + duration

        covered = set()
        for support in supports:
            start, end = interval(support)
            asset_id = support["asset_id"]
            if not any(abs(start-w["start"]) <= tolerance and abs(end-w["end"]) <= tolerance
                       for w in media_report["media"]):
                raise ValueError(f"apoyo {start:.2f}–{end:.2f}s no coincide con la imagen/video real")
            spans = []
            for index, cue in enumerate(cues):
                left, right = interval(cue)
                if cue["asset_id"] == asset_id and left >= start-tolerance and right <= end+tolerance:
                    spans.append((left, right))
                    covered.add(index)
            cursor = start
            for left, right in sorted(spans):
                if left > cursor + tolerance:
                    break
                cursor = max(cursor, right)
            if cursor < end - tolerance:
                raise ValueError(f"ambiente {start:.2f}–{end:.2f}s no cubre toda la duración de su apoyo")
            report["supports"].append({"asset_id": asset_id, "start": start, "end": end,
                                        "duration": end-start, "complete": True})
        if len(covered) != len(cues):
            raise ValueError("hay fragmentos de ambiente fuera de sus apoyos asignados")
    except (KeyError, TypeError, ValueError, OSError) as exc:
        errors.append(f"imperio audio: {exc}")
        report["status"] = "invalid"
    return report


def inspect_project(proto):
    """Resolve anchors using the checker, but don't rewrite manifest or assets."""
    sys.path.insert(0, str(Path(__file__).parent))
    import check_storyboard as checker
    proto = Path(proto)
    raw = json.loads((proto / "assets/config.json").read_text())
    configs = raw.get("configs", [raw])
    config = next((c for c in configs if c.get("id") == raw.get("activeId")), configs[0])
    sb = json.loads((proto / config.get("storyboardUrl", "assets/storyboard.json")).read_text())
    lyrics = json.loads((proto / config.get("lyricsUrl", "assets/lyrics.json")).read_text())
    words = [{"t": w["word"].strip(), "s": w["start"], "n": checker.norm(w["word"])}
             for segment in lyrics["segments"] for w in segment.get("words", []) if w["word"].strip()]
    total = lyrics.get("metadata", {}).get("duration") or words[-1]["s"] + 3
    catalog = checker.load_catalog(proto)
    beats, errors, cursor = [], [], 0
    for i, item in enumerate(sb["beats"]):
        wi = -1
        start = item.get("t")
        if start is None:
            wi = checker.find(words, item["at"], cursor)
            if wi < 0:
                raise ValueError(f"beat #{i}: ancla no encontrada en orden: {item['at']}")
            start, cursor = words[wi]["s"], wi
        beats.append({"i": i, "t0": max(0, start + item.get("offset", sb.get("defaults", {}).get("offset", -0.12))),
                      "use": item["use"], "layer": item.get("layer", catalog.get(item["use"], {}).get("layer", "main")),
                      "b": item, "wi": wi})
    for i, beat in enumerate(beats):
        item = beat["b"]
        if "dur" in item:
            beat["t1"] = beat["t0"] + item["dur"]
        elif "until" in item:
            wi = checker.find(words, item["until"], max(0, beat["wi"]))
            if wi < 0:
                raise ValueError(f"beat #{i}: until no encontrado")
            beat["t1"] = words[wi]["s"]
        else:
            following = next((b for b in beats[i + 1:] if b["layer"] == beat["layer"]), None)
            beat["t1"] = following["t0"] if following else total
    if config.get("quality_policy_version", 1) >= 3:
        beats = checker.resolved_video_beats(config, beats, total)
    return check(config, beats, catalog, words, total, errors, proto=proto), errors


if __name__ == "__main__":
    report, failures = inspect_project(sys.argv[1])
    print(json.dumps({"style_media": report, "errors": failures}, ensure_ascii=False, indent=2))
    sys.exit(bool(failures))
