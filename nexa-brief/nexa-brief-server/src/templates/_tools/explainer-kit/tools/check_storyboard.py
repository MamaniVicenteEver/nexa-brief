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

LOCAL_CATALOG = "assets/components/catalog.json"



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
                elif d["params"][k]["type"] == "image" and v and not _media_exists(proto, v): errs.append(f"#{i} imagen inexistente: {v}")
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
            if dur > 8.5 and x["i"] != len(beats) - 1: warns.append(f"#{x['i']} {x['use']} dura {dur:.1f}s (> 8 s)")
    # clips de video: que el clip alcance para todo el beat (start + duración × rate) y cuántos hay
    clips = [x for x in beats if x["use"] == "common.clip"]
    for x in clips:
        p = x["b"].get("params") or {}
        f = proto / p.get("src", "")
        need = float(p.get("start", 0)) + (x["t1"] - x["t0"]) * float(p.get("rate", 1))
        have = clip_seconds(f) if f.is_file() else None
        if have is not None and need > have + 0.1:
            warns.append(f"#{x['i']} el clip {p.get('src')} dura {have:.1f}s y el beat pide {need:.1f}s: se congela el último cuadro (bajar start/rate o acortar el beat)")
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
    srcs = Counter(v for x in beats for k, v in (x["b"].get("params") or {}).items() if k == "src")
    for src, n in srcs.items():
        if n > 1: warns.append(f"la foto {src} se usa {n} veces (salvo un callback final, usar otra imagen o un componente)")
    icons = Counter((x["use"], (x["b"].get("params") or {}).get("icon")) for x in beats if (x["b"].get("params") or {}).get("icon"))
    for (use, ic), n in icons.items():
        if n > 2: warns.append(f"el icono '{ic}' ({use}) se usa {n} veces: el espectador lo nota; variar")
    mains = [x for x in beats if x["layer"] == "main"]
    for a, b, c in zip(mains, mains[1:], mains[2:]):
        if a["use"] == b["use"] == c["use"]: warns.append(f"#{a['i']}–#{c['i']} tres {a['use']} seguidos: alternar con un diagrama, una foto o un texto")
    # apertura: el título clásico o, en los paquetes v2, la miniatura elegida (<familia>.introv1 / introv2)
    if beats and (beats[0]["use"].split(".")[1] not in ("title", "introv1", "introv2") or beats[0]["t0"] > 0.01):
        errs.append("el primer beat tiene que ser la apertura en t=0 (<familia>.title, o introv1/introv2 = la miniatura elegida)")
    if outro_tool.spec_for(proto) is not None and not (lyr.get("metadata") or {}).get("outro"):
        errs.append("falta el cierre con voz del canal (el video terminaría mudo): correr kit.py outro <id>")
    print(f"{proto.name}: {len(beats)} beats · {total:.1f} s · {len(words)} palabras · promedio {total / max(1, len([b for b in beats if b['layer'] == 'main'])):.1f} s/plano")
    for x in beats: print(f"  {x['t0']:6.1f}–{x['t1']:6.1f}  {x['use']:<16} {x['b'].get('at', 't=' + str(x['b'].get('t')))[:40]}")
    for e in errs: print("  ✗", e)
    for w in warns: print("  ⚠", w)
    print("OK" if not errs else f"{len(errs)} errores")
    return 1 if errs else 0

if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
