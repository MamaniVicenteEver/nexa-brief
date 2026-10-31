#!/usr/bin/env python3
"""Valida un storyboard contra la transcripción y el catálogo ANTES de renderizar.

Replica la resolución de anclas de engine/kit.js (búsqueda en orden desde el beat anterior) y
reporta: anclas que no existen, planos < 1,5 s o > 8 s (capa main), componentes o parámetros
desconocidos, imágenes que faltan, cantidad de letras grandes y huecos. Imprime además la
línea de tiempo resuelta (útil para revisar el ritmo).

Los componentes propios del video (assets/components/, ver guides/components.md §6) cuentan
como conocidos si `kit.py components <id>` ya los registró en assets/components/catalog.json.
Las cantidades (letras grandes, planos, capítulos, palabras) escalan con `target_minutes`
del guion (lengths.json).

Uso (desde nexa-brief-server/):
  .venv/bin/python src/templates/_tools/explainer-kit/tools/check_storyboard.py src/templates/sandbox/explainer-binario
"""
import json, pathlib, re, sys, unicodedata

KIT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from lengths import of_script  # noqa: E402
import outro as outro_tool  # noqa: E402
import narrative_check  # noqa: E402

LOCAL_CATALOG = "assets/components/catalog.json"

def opaque_logo_png(path):
    """Un PNG de marca necesita píxeles transparentes para no formar un rectángulo."""
    from PIL import Image
    with Image.open(path) as image:
        rgba = image.convert("RGBA")
        alpha = rgba.getchannel("A")
        if alpha.getextrema()[0] == 255:
            return True
        bounds = alpha.getbbox()
        if not bounds:
            return False
        x0, y0, x1, y1 = bounds
        corners = [rgba.getpixel((x, y)) for x in (x0, x1 - 1) for y in (y0, y1 - 1)]
        return all(a >= 250 and min(r, g, b) >= 245 for r, g, b, a in corners)


def check_brand_logos(script, beats, catalog, proto, errs, warns):
    """El logo solo puede ser un detalle del medio; una marca aparece como máximo dos veces."""
    config = json.loads((KIT / "brands.json").read_text(encoding="utf-8"))
    text = norm(" ".join(str(s.get("text") or "") for s in script.get("segments", [])))
    from collections import Counter
    named = Counter()
    aliases = {norm(alias): norm(brand["name"])
               for brand in config.get("brands", []) for alias in brand.get("aliases", [])}
    for x in beats:
        params = x["b"].get("params") or {}
        if x["use"] == "common.logo":
            errs.append(f"beat #{x['i']} common.logo obsoleto: el logo debe acompañar una foto/video en el mismo beat")
            name = params.get("name") or pathlib.Path(params.get("src") or "").stem
        elif params.get("logo") or params.get("logoName"):
            spec = catalog.get(x["use"], {}).get("params", {})
            media = any(params.get(key) and rule.get("type") in ("image", "video")
                        and key not in ("logo", "srcAfter")
                        and (key != "poster" or x["use"] == "common.tabloid")
                        for key, rule in spec.items())
            if not media:
                errs.append(f"beat #{x['i']} {x['use']}: logo sin foto/video acompañante")
            logo = params.get("logo") or ""
            if logo.lower().endswith(".png"):
                path = proto / logo
                if path.is_file() and opaque_logo_png(path):
                    errs.append(f"beat #{x['i']} logo PNG opaco: usa SVG o PNG transparente sin fondo rectangular")
            name = params.get("logoName") or pathlib.Path(logo).stem
        else:
            continue
        if norm(name):
            named[aliases.get(norm(name), norm(name))] += 1
    for name, count in named.items():
        if count > 2:
            errs.append(f"logo {name}: {count} apariciones; máximo 2 por marca")
    for brand in config.get("brands", []):
        aliases = [norm(a) for a in brand.get("aliases", []) if norm(a)]
        mentions = sum(len(re.findall(r"(?<!\w)" + re.escape(alias) + r"(?!\w)", text)) for alias in aliases)
        if mentions >= 2 and norm(brand["name"]) not in named:
            warns.append(f"{brand['name']} se nombra {mentions} veces sin logo acompañado; mostrarlo 1–2 veces junto a foto/video")



def _media_exists(proto: pathlib.Path, src: str) -> bool:
    """assets/… relativo al video, o /carpeta/video/assets/… relativo a src/templates (lo escribe publishing/opening.py)."""
    if src.startswith(("http://", "https://")):
        return True
    if src.startswith("/"):
        return (pathlib.Path(__file__).resolve().parents[3] / src.lstrip("/")).exists()
    return (proto / src).exists()

def clip_seconds(f: pathlib.Path) -> float | None:
    """Duración de un clip con ffprobe (None si no se puede leer)."""
    import subprocess
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(f)], capture_output=True, text=True)
    try: return float(r.stdout.strip())
    except ValueError: return None


def visible_video_seconds(config, beat, total):
    """Duración del clip tras el mínimo que aplica resolveBeats en el motor."""
    raw = beat["t1"] - beat["t0"]
    if config.get("quality_policy_version", 1) < 3:
        return raw
    design = KIT / "designs" / str(config.get("design", "")) / "design.json"
    minimums = {}
    if design.is_file():
        defaults = json.loads(design.read_text(encoding="utf-8")).get("defaults", {})
        minimums.update(defaults.get("minDur") or {})
    minimums.update(config.get("minDur") or {})
    minimum = beat["b"].get("minDur", minimums.get(beat["use"], 0))
    return max(0, min(total - beat["t0"], max(raw, minimum or 0)))


def resolved_video_beats(config, beats, total):
    """Aplica minDur y los desplazamientos/omisiones de resolveBeats del motor."""
    resolved = [{**beat} for beat in beats]
    for i, beat in enumerate(resolved):
        if beat.get("skip"):
            continue
        duration = visible_video_seconds(config, beat, total)
        if duration <= beat["t1"] - beat["t0"]:
            continue
        beat["t1"] = beat["t0"] + duration
        for next_beat in resolved[i + 1:]:
            if next_beat["layer"] != beat["layer"] or next_beat["t0"] >= beat["t1"]:
                continue
            if next_beat["t1"] - beat["t1"] < 1:
                next_beat["skip"] = True
            else:
                next_beat["t0"] = beat["t1"]
    return [beat for beat in resolved if not beat.get("skip")]

def load_catalog(proto: pathlib.Path) -> dict:
    """Catálogo del kit + componentes propios del video (si ya pasaron por `kit.py components`)."""
    cat = {c["name"]: c for c in json.loads((KIT / "catalog.json").read_text())["comps"]}
    local = proto / LOCAL_CATALOG
    if local.exists():
        cat.update({c["name"]: c for c in json.loads(local.read_text())["comps"]})
    return cat


def in_range(n, bounds):
    return bounds[0] <= n <= bounds[1]

def norm(s):
    s = unicodedata.normalize("NFD", str(s).lower()); s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9ñ\s]+", "", s)).strip()

def find(words, anchor, frm=0):
    toks = norm(anchor).split()
    if not toks: return -1
    for i in range(frm, len(words)):
        if all(i + k < len(words) and words[i + k]["n"] == t for k, t in enumerate(toks)): return i
    return -1

def quality_check(proto, config, script, beats, words, total, errs, catalog=None):
    """Piso configurable por diseño y métricas; los tiempos son los resueltos por el storyboard."""
    if config.get("quality_policy_version", 1) >= 3:
        beats = resolved_video_beats(config, beats, total)
    settings = json.loads((KIT / "catalog.json").read_text(encoding="utf-8"))["quality"]
    override = KIT / "designs" / str(config.get("design", "")) / "quality.json"
    if override.exists():
        settings.update(json.loads(override.read_text(encoding="utf-8")))
    count = len(beats)
    icon = settings["icon_component"]
    icon_count = sum(x["use"] == icon for x in beats)
    share = icon_count / count if count else 0
    minutes = total / 60 if total else 0
    threshold = settings["icon_max_share"] if (script.get("target_minutes") or minutes) >= settings["short_minutes"] else settings["short_icon_max_share"]
    if share > threshold:
        errs.append(f"storyboard: {icon_count}/{count} {icon} ({share:.1%}), máximo {threshold:.0%}; reemplaza iconos por fotos, clips y componentes propios")
    mains = [x for x in beats if x["layer"] == "main"]
    streak = []
    for x in mains:
        streak = streak + [x] if x["use"] == icon else []
        if len(streak) == settings["icon_max_consecutive"] + 1:
            errs.append(f"beats #{streak[0]['i']}–#{x['i']}: más de {settings['icon_max_consecutive']} {icon} seguidos; alterna con fotos o componentes")
    used = {x["use"] for x in beats}
    custom_files = list((proto / "assets/components").glob("*.js"))
    custom_names = set()
    for path in custom_files:
        names = set(re.findall(r"\bname\s*:\s*['\"]([\w.-]+)['\"]", path.read_text(encoding="utf-8")))
        custom_names.update(names & used)
        if not names & used:
            errs.append(f"componente assets/components/{path.name}: no se usa en ningún beat; úsalo o elimina el archivo")
    catalog = catalog if catalog is not None else load_catalog(proto)
    from collections import Counter
    custom_counts = Counter(x["use"] for x in beats if x["use"] in custom_names)
    photos = Counter()
    for beat in beats:
        params = beat["b"].get("params") or {}
        spec = catalog.get(beat["use"], {}).get("params", {})
        # Una imagen se cuenta una sola vez por beat, aunque aparezca en dos parámetros.
        paths = {str(params[name]).split("assets/media/", 1)[-1] for name, rule in spec.items()
                 if name != "logo" and rule.get("type") == "image" and isinstance(params.get(name), str) and params[name]}
        photos.update(paths)
    for kind, counts in (("componente propio", custom_counts), ("foto", photos)):
        for name, n in counts.items():
            if count and (n > settings["repeat_max_uses"] or (n > 1 and n / count > settings["repeat_max_share"])):
                errs.append(f"{kind} {name}: {n}/{count} usos ({n/count:.1%}); máximo {settings['repeat_max_uses']} usos o {settings['repeat_max_share']:.0%} de beats")
    def media_kinds(beat):
        params = (beat["b"].get("params") or {})
        spec = catalog.get(beat["use"], {}).get("params", {})
        video = any(params.get(name) and rule.get("type") == "video" for name, rule in spec.items())
        # Un poster es respaldo del clip, no una foto visible por sí mismo.
        photo = not video and any(params.get(name) and rule.get("type") == "image"
                                  and name not in ("logo", "srcAfter")
                                  and (name != "poster" or beat["use"] == "common.tabloid")
                                  for name, rule in spec.items())
        return photo, video
    def has_media(beat):
        return any(media_kinds(beat))
    media = sum(bool(has_media(x)) for x in beats)
    media_rate = media / minutes if minutes else 0
    if minutes and media_rate < settings["media_min_per_minute"]:
        errs.append(f"storyboard: {media_rate:.2f} fotos/clips por minuto, mínimo {settings['media_min_per_minute']}; agrega recursos reales")
    qc_path = proto / "work" / "narration.qc.json"
    if qc_path.exists():
        qc = json.loads(qc_path.read_text(encoding="utf-8"))
        if (ppm := qc.get("wpm")) and ppm > settings["voice_warn_ppm"]:
            print(f"  ⚠ voz: {ppm} ppm supera {settings['voice_warn_ppm']} ppm; ajustar pausas y regenerar si corresponde")
    if config.get("quality_policy_version", 1) >= 2:
        visual = sorted((x for x in beats if x["layer"] == "main" and has_media(x)), key=lambda x: x["t0"])
        visual_end = min(total, (config.get("outro") or {}).get("start", total))
        cursor = 0.0
        max_gap = settings["max_media_gap_seconds"]
        for x in visual:
            if x["t0"] >= visual_end:
                continue
            if x["t0"] - cursor > max_gap:
                errs.append(f"storyboard: {x['t0'] - cursor:.1f}s sin foto/clip antes del beat #{x['i']} (máximo {max_gap}s)")
            cursor = max(cursor, min(x["t1"], visual_end))
            has_photo, _ = media_kinds(x)
            if has_photo and x["t1"] - x["t0"] < settings["min_photo_seconds"]:
                errs.append(f"beat #{x['i']} {x['use']}: foto visible {x['t1'] - x['t0']:.1f}s (mínimo {settings['min_photo_seconds']}s)")
        if visual_end - cursor > max_gap:
            errs.append(f"storyboard: {visual_end - cursor:.1f}s sin foto/clip antes del outro (máximo {max_gap}s)")
        video_beats = [x for x in visual if media_kinds(x)[1]]
        if config.get("quality_policy_version", 1) >= 3:
            for x in video_beats:
                duration = visible_video_seconds(config, x, total)
                if duration < settings["video_min_seconds"]:
                    errs.append(f"beat #{x['i']} {x['use']}: video visible {duration:.1f}s; mínimo {settings['video_min_seconds']}s")
                if x["use"] == "common.clip" and not settings["clip_min_seconds"] <= duration <= settings["clip_max_seconds"]:
                    print(f"  aviso: beat #{x['i']} common.clip visible {duration:.1f}s; recomendado {settings['clip_min_seconds']}–{settings['clip_max_seconds']}s")
            if total / 60 >= settings["long_video_minutes"]:
                long_spans = [x for x in video_beats if visible_video_seconds(config, x, total) >= settings["long_video_span_seconds"]]
                if len(long_spans) < settings["long_video_min_spans"]:
                    errs.append(f"video de ≥{settings['long_video_minutes']} min: {len(long_spans)} tramos de video ≥{settings['long_video_span_seconds']}s; mínimo {settings['long_video_min_spans']}")
        # Exigir medios dentro de cada acto largo, no solo en la primera mitad del video.
        act_starts = []
        word_cursor = 0
        for segment in script.get("segments", []):
            act = segment.get("act")
            if not act or (act_starts and act_starts[-1][0] == act):
                continue
            anchor = " ".join(segment.get("text", "").split()[:4])
            wi = find(words, anchor, word_cursor) if anchor else -1
            if wi >= 0:
                act_starts.append((act, words[wi]["s"]))
                word_cursor = wi
        for (act, start), (_, end) in zip(act_starts, act_starts[1:] + [("outro", visual_end)]):
            if end - start >= max_gap and not any(x["t0"] < end and x["t1"] > start for x in visual):
                errs.append(f"acto {act}: no hay foto/clip durante {end - start:.0f}s")
    target = script.get("target_minutes") or minutes
    if target >= settings["distinct_min_minutes"] and len(used) < settings["distinct_min"]:
        errs.append(f"storyboard: {len(used)} componentes distintos, mínimo {settings['distinct_min']}; amplía la variedad")
    if target >= settings["custom_min_minutes"] and len(custom_names) < settings["custom_min"]:
        errs.append(f"storyboard: {len(custom_names)} componentes propios usados, mínimo {settings['custom_min']}; crea, revisa y usa componentes del tema")
    cuts = 0
    for x in beats:
        if x["use"] not in ("common.lyric", "common.punch"):
            continue
        explicit = (x["b"].get("params") or {}).get("text", "")
        if explicit and explicit.strip() and len(re.findall(r"\b[\wÀ-ÿ]+\b", explicit)) <= settings["explicit_text_max_words"]:
            continue
        window = [w for w in words if w["s"] >= x["t0"] - .05 and w["s"] < x["t1"] - .05]
        if not window:
            cuts += 1
            errs.append(f"beat #{x['i']} {x['use']}: ventana sin palabras de la transcripción; ajusta el beat o usa texto explícito corto")
        elif not re.search(r"[.?!…][\"»”’)]*$", window[-1]["t"]):
            cuts += 1
            errs.append(f"beat #{x['i']} {x['use']}: la ventana corta la frase en «{window[-1]['t']}»; mueve el siguiente beat hasta el fin de oración o usa texto explícito corto")
    n, error = narrative_check.load(config["narrative_id"]) if config.get("narrative_id") else (None, None)
    if n and (n.get("checks") or {}).get("script"):
        # Primer segmento posterior a golpe/miedo: ubicarlo en la transcripción, con anclas progresivas.
        cursor = 0
        for segment in script.get("segments", []):
            anchor = " ".join(segment.get("text", "").split()[:5])
            found = find(words, anchor, cursor) if anchor else -1
            if found >= 0:
                cursor = found
            if segment.get("act") not in settings["check_opening_acts"] and found >= 0:
                end = words[found]["s"]
                for x in mains:
                    if x["i"] and x["t0"] < end and not (has_media(x) or x["use"] in custom_names or x["use"] == "common.punch"):
                        errs.append(f"beat #{x['i']} ({x['use']}) en golpe/miedo: usa foto, clip, componente propio o punch")
                break
        else:
            if any(s.get("act") in settings["check_opening_acts"] for s in script.get("segments", [])):
                errs.append("golpe/miedo: no se pudo ubicar su final en la transcripción; corrige las anclas del guion para validar el primer tramo")
    hedge_count = len(narrative_check.hedge_hits(n, script)) if n else 0
    return {"icon_share": round(share, 4), "distinct_components": len(used), "custom_components_used": len(custom_names),
            "media_per_min": round(media_rate, 3), "hedge_hits_hook": hedge_count, "lyric_cuts": cuts}


def check_audio_end(proto, config, lyrics, beats, total, errs):
    """La duración que usan preview y motor debe ser la del audio con cierre completo."""
    metadata = lyrics.get("metadata") or {}
    policy_v2 = config.get("quality_policy_version", 1) >= 2
    if metadata.get("fake") and not metadata.get("outro") and not policy_v2:
        return
    src = (config.get("audio") or {}).get("src", "")
    audio = proto / src
    if not src or not audio.is_file():
        errs.append(f"audio configurado inexistente: {src}")
        return
    duration = clip_seconds(audio)
    if duration is None:
        errs.append(f"no se pudo leer duración del audio configurado: {src}")
        return
    if abs(duration - total) > 0.5:
        errs.append(f"duración preview/config {total:.2f}s difiere del audio {src} ({duration:.2f}s)")
    outro = config.get("outro") or {}
    if policy_v2 and not metadata.get("outro"):
        errs.append("falta el cierre completo en lyrics.json: generar song-with-outro.mp3 con kit.py outro <id>")
    if metadata.get("outro"):
        if not src.endswith("song-with-outro.mp3"):
            errs.append("config.audio.src debe usar song-with-outro.mp3")
        start = outro.get("start")
        end = (start or 0) + outro.get("dur", 0)
        if not outro.get("enabled") or start is None or abs(end - duration) > 0.5 or end - start < 2.5:
            errs.append("config.outro no cubre el final completo de song-with-outro.mp3")
        if policy_v2 and outro.get("use") not in load_catalog(proto):
            errs.append("config.outro.use no existe en el catálogo; configura un componente de cierre cargado por el diseño")
        lyric_start = metadata["outro"].get("start")
        if start is not None and (lyric_start is None or abs(start - lyric_start) > 0.5):
            errs.append("config.outro.start difiere de lyrics.metadata.outro.start; regenerar el cierre con kit.py outro <id>")
        questions = [x for x in beats if x["use"] == "common.question"]
        if policy_v2 and not questions:
            errs.append("falta common.question antes del outro")
        valid_questions = [x for x in questions if (x.get("b", {}).get("params") or {}).get("text", "").strip()]
        if policy_v2 and questions and not valid_questions:
            errs.append("common.question tiene texto vacío; agrega la pregunta final del guion en params.text")
        timed_questions = valid_questions if policy_v2 else questions
        if timed_questions and start is not None and not any(x["t0"] < start and x["t1"] >= start - 0.5 for x in timed_questions):
            errs.append("common.question debe permanecer en pantalla hasta el comienzo del outro")
        mains = [x for x in beats if x["layer"] == "main" and x["t0"] < (start or total)]
        if policy_v2 and not mains:
            errs.append("falta un beat principal antes del outro; agrega un plano que acompañe la pregunta final")
        if policy_v2 and mains and start is not None and max(x["t1"] for x in mains) < start - 0.5:
            errs.append("último beat principal deja un hueco antes del outro")


def main(proto):
    proto = pathlib.Path(proto)
    raw = json.loads((proto / "assets" / "config.json").read_text()); C = raw["configs"][0] if "configs" in raw else raw
    lyr = json.loads((proto / C["lyricsUrl"]).read_text()); sb = json.loads((proto / C["storyboardUrl"]).read_text())
    cat = load_catalog(proto)
    script_path = proto / "assets" / "script.json"
    script = json.loads(script_path.read_text()) if script_path.exists() else {}
    T = of_script(script, C.get("design"))
    words = [{"t": w["word"].strip(), "s": w["start"], "n": norm(w["word"])} for s in lyr["segments"] for w in s.get("words", []) if w["word"].strip()]
    total = lyr.get("metadata", {}).get("duration") or (words[-1]["s"] + 3)
    errs, warns, beats, cur = [], [], [], 0
    for i, b in enumerate(sb["beats"]):
        t0 = b.get("t"); wi = -1
        if t0 is None:
            wi = find(words, b["at"], cur)
            if wi < 0:
                wi2 = find(words, b["at"], 0)
                errs.append(f"#{i} ancla no encontrada en orden: '{b['at']}'" + (" (existe ANTES: orden roto)" if wi2 >= 0 else ""))
                t0 = beats[-1]["t0"] + 2 if beats else 0
            else:
                t0 = words[wi]["s"]
                # ancla ambigua: la misma frase aparece otra vez poco después → el beat puede caer mal
                nxt = find(words, b["at"], wi + 1)
                if nxt >= 0 and nxt - wi < 40: warns.append(f"#{i} ancla ambigua '{b['at']}': aparece de nuevo {nxt - wi} palabras después (usá más palabras)")
                if cur and wi - cur > 120: warns.append(f"#{i} ancla '{b['at']}' salta {wi - cur} palabras: ¿es la que querés?")
                cur = wi
        t0 = max(0, t0 + b.get("offset", sb.get("defaults", {}).get("offset", -0.12)))
        d = cat.get(b["use"])
        if not d: errs.append(f"#{i} componente desconocido: {b['use']}"); layer = b.get("layer", "main")
        else:
            layer = b.get("layer", d["layer"])
            for k, v in (b.get("params") or {}).items():
                if k not in d["params"]: errs.append(f"#{i} {b['use']}: parámetro desconocido '{k}'")
                elif d["params"][k]["type"] == "image" and v and not _media_exists(proto, v):
                    (warns if b["use"] == "common.logo" else errs).append(f"#{i} imagen inexistente: {v}" + ("; common.logo mostrará el nombre" if b["use"] == "common.logo" else ""))
                elif d["params"][k]["type"] == "video" and v and not (proto / v).exists(): errs.append(f"#{i} clip inexistente: {v}")
                elif isinstance(v, str) and v.startswith("@") and find(words, v[1:], max(0, wi)) < 0: errs.append(f"#{i} {k}='{v}' no aparece después del ancla")
            for k, s in d["params"].items():
                if s.get("required") and k not in (b.get("params") or {}): errs.append(f"#{i} {b['use']}: falta '{k}'")
        beats.append({"i": i, "t0": t0, "use": b["use"], "layer": layer, "b": b, "wi": wi})
    for j, x in enumerate(beats):
        b = x["b"]
        if "dur" in b: x["t1"] = x["t0"] + b["dur"]
        elif "until" in b:
            wi = find(words, b["until"], max(0, x["wi"]))
            if wi < 0: errs.append(f"#{x['i']} until no encontrado: '{b['until']}'"); x["t1"] = x["t0"] + 3
            else: x["t1"] = words[wi]["s"]
        else:
            nx = next((y for y in beats[j + 1:] if y["layer"] == x["layer"]), None); x["t1"] = nx["t0"] if nx else total
        dur = x["t1"] - x["t0"]
        if x["layer"] == "main" and x["use"] != "common.flash":
            if dur < 1.5: warns.append(f"#{x['i']} {x['use']} dura {dur:.1f}s (< 1,5 s)")
            if dur > 8.5 and x["i"] != len(beats) - 1 and not any(s.get("type") == "video" and (b.get("params") or {}).get(k) for k, s in (cat.get(x["use"], {}).get("params") or {}).items()): warns.append(f"#{x['i']} {x['use']} dura {dur:.1f}s (> 8 s)")
    # clips de video: que el clip alcance para todo el beat (start + duración × rate) y cuántos hay
    clips = [x for x in beats if x["use"] == "common.clip"]
    playback_beats = resolved_video_beats(C, beats, total) if C.get("quality_policy_version", 1) >= 3 else beats
    videos = [x for x in playback_beats if any(s.get("type") == "video" and (x["b"].get("params") or {}).get(k) for k, s in (cat.get(x["use"], {}).get("params") or {}).items())]
    for x in videos:
        p = x["b"].get("params") or {}
        source = p.get("video") or p.get("src", "")
        f = proto / source
        need = float(p.get("start", 0)) + visible_video_seconds(C, x, total) * float(p.get("rate", 1))
        have = clip_seconds(f) if f.is_file() else None
        if have is not None and need > have + 0.1 and not p.get("loop", True):
            (errs if C.get("quality_policy_version", 1) >= 3 else warns).append(f"#{x['i']} el clip {source} dura {have:.1f}s y el beat pide {need:.1f}s: usa loop o rate < 1 para evitar congelar")
    if not T["legacy"] and "clips" in T and not in_range(len(clips), T["clips"]):
        warns.append(f"{len(clips)} clips de video (common.clip) para {T['minutes']:g} min: lo recomendado es {T['clips'][0]}–{T['clips'][1]} (metraje real en los momentos clave)")
    lyrics = sum(1 for x in beats if x["use"] == "common.lyric")
    big = lyrics + sum(1 for x in beats if x["use"] == "common.punch")
    lo, hi = T["lyrics"]
    if not in_range(lyrics, T["lyrics"]): warns.append(f"{lyrics} letras grandes (common.lyric): lo recomendado es {lo}–{hi}")
    if big > hi + 1: warns.append(f"{big} momentos de texto gigante (lyric + punch): más de {hi + 1} cansa y les quita fuerza; dejar solo los del PLAN §6")
    n_main = len([x for x in beats if x["layer"] == "main"])
    if not T["legacy"]:
        if not in_range(n_main, T["beats"]): warns.append(f"{n_main} planos para {T['minutes']:g} min: lo recomendado es {T['beats'][0]}–{T['beats'][1]} (un plano cada 2,5–6 s)")
        n_words = sum(len(s.get("text", "").split()) for s in script.get("segments", []))
        if not in_range(n_words, T["words"]): warns.append(f"guion de {n_words} palabras para {T['minutes']:g} min: lo recomendado es {T['words'][0]}–{T['words'][1]}")
        chapters = [s["chapter"] for s in script.get("segments", []) if s.get("chapter")]
        if not in_range(len(chapters), T["chapters"]): warns.append(f"{len(chapters)} capítulos (segmentos con \"chapter\"): para {T['minutes']:g} min van {T['chapters'][0]}–{T['chapters'][1]}")
    # repeticiones: misma foto, mismo icono demasiadas veces, mismo componente seguido
    from collections import Counter
    srcs = Counter(v for x in beats if x["use"] != "common.logo" for k, v in (x["b"].get("params") or {}).items() if k == "src")
    for src, n in srcs.items():
        if n > 1: warns.append(f"la foto {src} se usa {n} veces (salvo un callback final, usar otra imagen o un componente)")
    icons = Counter((x["use"], (x["b"].get("params") or {}).get("icon")) for x in beats if (x["b"].get("params") or {}).get("icon"))
    for (use, ic), n in icons.items():
        if n > 2: warns.append(f"el icono '{ic}' ({use}) se usa {n} veces: el espectador lo nota; variar")
    mains = [x for x in beats if x["layer"] == "main"]
    for a, b, c in zip(mains, mains[1:], mains[2:]):
        if a["use"] == b["use"] == c["use"]: warns.append(f"#{a['i']}–#{c['i']} tres {a['use']} seguidos: alternar con un diagrama, una foto o un texto")
    # apertura: título clásico o miniatura elegida A/B/C en los paquetes v2.
    if beats and ((beats[0]["use"] != "common.tabloid" and beats[0]["use"].split(".")[1] not in
                   ("title", "introv1", "introv2")) or beats[0]["t0"] > 0.01):
        errs.append("el primer beat tiene que ser la apertura en t=0 (<familia>.title, introv1/introv2 o common.tabloid)")
    if outro_tool.spec_for(proto) is not None and not (lyr.get("metadata") or {}).get("outro"):
        errs.append("falta el cierre con voz del canal (el video terminaría mudo): correr kit.py outro <id>")
    check_audio_end(proto, C, lyr, beats, total, errs)
    manifest = proto / "manifest.json"
    data = json.loads(manifest.read_text(encoding="utf-8")) if manifest.exists() else {}
    # Los paquetes aprobados antes de esta política conservan su contrato editorial.
    # Los hallazgos nuevos se muestran, pero no invalidan una aprobación histórica.
    legacy_ready = C.get("quality_policy_version", 1) < 2 and data.get("status") in ("listo", "renderizado")
    policy_errors = [] if legacy_ready else errs
    narrative_check.check(proto, C, script, sb, policy_errors)
    quality = quality_check(proto, C, script, beats, words, total, policy_errors, cat)
    if legacy_ready:
        warns.extend(f"legado aprobado: {message}" for message in policy_errors)
    check_brand_logos(script, beats, cat, proto, errs, warns)
    data["quality"] = quality
    manifest.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("quality:", json.dumps(quality, ensure_ascii=False))
    print(f"{proto.name}: {len(beats)} beats · {total:.1f} s · {len(words)} palabras · promedio {total / max(1, len([b for b in beats if b['layer'] == 'main'])):.1f} s/plano")
    for x in beats: print(f"  {x['t0']:6.1f}–{x['t1']:6.1f}  {x['use']:<16} {x['b'].get('at', 't=' + str(x['b'].get('t')))[:40]}")
    for e in errs: print("  ✗", e)
    for w in warns: print("  ⚠", w)
    print("OK" if not errs else f"{len(errs)} errores")
    return 1 if errs else 0

if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
