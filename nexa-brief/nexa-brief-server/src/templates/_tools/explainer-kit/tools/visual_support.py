"""Política v5 de apoyos visuales sobre los beats ya resueltos por el motor."""

from collections import Counter
import posixpath


def check(config, beats, catalog, total, policy, errors, warnings, default_clip_layout="full"):
    end = min(total, (config.get("outro") or {}).get("start", total))
    uses = Counter()
    kinds = Counter()
    preferred = []
    for beat in beats:
        if beat.get("skip") or beat["layer"] != "main" or beat["t0"] >= end:
            continue
        params = beat["b"].get("params") or {}
        caption = params.get("caption")
        has_caption = isinstance(caption, str) and bool(caption.strip())
        spec = catalog.get(beat["use"], {}).get("params", {})
        video = {posixpath.normpath(str(params[key])) for key, rule in spec.items()
                 if rule.get("type") == "video" and isinstance(params.get(key), str) and params[key]}
        photos = set() if video else {posixpath.normpath(str(params[key])) for key, rule in spec.items()
                                      if rule.get("type") == "image" and key not in ("logo", "srcAfter")
                                      and (key != "poster" or beat["use"] == "common.tabloid")
                                      and isinstance(params.get(key), str) and params[key]}
        # En el split de tabloid srcAfter ocupa media pantalla incluso cuando hay video.
        after_photo = params.get("srcAfter") if beat["use"] == "common.tabloid" and params.get("mode") == "split" else None
        if isinstance(after_photo, str) and after_photo:
            photos.add(posixpath.normpath(after_photo))
        if not (video or photos):
            continue
        duration = min(end, beat["t1"]) - beat["t0"]
        for path in video:
            uses[("video", path)] += 1
            if duration < policy["video_error_min"] or duration > policy["video_error_max"]:
                errors.append(f"beat #{beat['i']}: video visible {duration:.1f}s; intervalo permitido {policy['video_error_min']}–{policy['video_error_max']}s")
            elif duration > policy["video_target_max"]:
                warnings.append(f"beat #{beat['i']}: video visible {duration:.1f}s; preferido {policy['video_target_min']}–{policy['video_target_max']}s")
        for path in photos:
            uses[("foto", path)] += 1
            if duration < policy["photo_error_min"] or duration > policy["photo_error_max"]:
                errors.append(f"beat #{beat['i']}: foto visible {duration:.1f}s; intervalo permitido {policy['photo_error_min']}–{policy['photo_error_max']}s")
            elif duration < policy["photo_target_min"] or duration > policy["photo_target_max"]:
                warnings.append(f"beat #{beat['i']}: foto visible {duration:.1f}s; preferido {policy['photo_target_min']}–{policy['photo_target_max']}s")
        if beat["use"].endswith(".introv2") or beat["use"] == "common.tabloid":
            kind = "miniatura"
        elif beat["use"] == "common.clip" and has_caption and (params.get("layout") or "auto") == "full":
            kind = "video completo"
        elif beat["use"] == "common.clip" and has_caption and (params.get("layout") or "auto") == "auto" and default_clip_layout == "full":
            kind = "video completo"
        elif beat["use"] == "common.clip" and (params.get("layout") or "auto") == "full":
            kind = "video sin texto"
        else:
            kind = "cuadro"
        kinds[kind] += 1
        if kind in ("miniatura", "video completo"):
            preferred.append(beat)
    for (kind, path), count in uses.items():
        if count > policy["max_uses_per_asset"]:
            errors.append(f"{kind} {path}: {count} usos; máximo {policy['max_uses_per_asset']}")
    if end > 0:
        for third in range(3):
            start, stop = end * third / 3, end * (third + 1) / 3
            if not any(beat["t0"] < stop and beat["t1"] > start for beat in preferred):
                errors.append(f"tercio {third + 1}: falta apoyo de estilo miniatura o video completo")
    n = sum(kinds.values())
    for kind, count in kinds.items():
        if n and count / n > policy["dominance_warn_share"]:
            warnings.append(f"apoyos visuales: {kind} domina {count}/{n} ({count / n:.0%}); variá entre miniatura, video completo y cuadro")
    return {"kinds": dict(kinds), "assets": len(uses), "preferred_thirds": [any(b["t0"] < end * (i + 1) / 3 and b["t1"] > end * i / 3 for b in preferred) for i in range(3)]}
