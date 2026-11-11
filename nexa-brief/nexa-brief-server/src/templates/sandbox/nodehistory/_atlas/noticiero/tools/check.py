#!/usr/bin/env python3
"""check.py · valida un episodio noticiero (Atlas) SIN navegador y SIN gastar cuota.

    python3 <_atlas>/noticiero/tools/check.py <carpeta-del-episodio> [--tarde]

--tarde = aún no hay voz ni escena: valida solo el guion (y lo que exista de escena/medios; las anclas no se resuelven).

Qué comprueba (E = error, bloquea la entrega · A = aviso, se justifica en el reporte):
  guion   E ids repetidos, texto vacío, emojis, marcadores (TODO/REEMPLAZAR) · A tono distinto a «aceleración»,
          A ritmo fuera de 150–200 palabras/min (el perfil de voz da ≈180) · A segmentos > 70 palabras
  voz     E song.qc.json con otra voz que Charon · A WER > 0.2 · E lyrics.json no coincide con el guion
  escena  E estilo distinto de «original» · E tipo de HUD inexistente o no disponible en Original ·
          E look/attribution fuera del perfil · E ancla de voz que no existe en lyrics.json ·
          E `out` anterior a `t` · E imagen que falta o sin crédito (media/credits.json o CREDITS.md) ·
          E región no declarada ni en el dataset · A lugar `at` sin declarar en places ·
          A retrato sin imagen (se dibuja una silueta) · A dos `topic` con el mismo slot a la vez
  ritmo   E segmento de la voz sin ninguna pieza no textual activa · A segmento sin ninguna pieza que ENTRE en él ·
          A más de 10 s sin ningún evento nuevo
No comprueba teselas del mapa (ver AGENTE.md §6) ni que nada se solape en pantalla (revisión visual, §7).
"""
from __future__ import annotations
import argparse, importlib.util, json, math, posixpath, re, subprocess, sys, unicodedata
from pathlib import Path

NOTICIERO = Path(__file__).resolve().parents[1]
GEO = NOTICIERO.parent / "data" / "geo"

HUD_DATOS = {"bar-compare", "line-series", "delta", "ranking", "stacked-bar", "ticker"}
HUD_MAPA_NARRATIVA = {"range-ring", "pulse", "route-icon", "front-line", "geo-label", "quote-card", "timeline"}
HUD_ORIGINAL = {"brand", "topic", "lower-title", "hemicycle", "counter", "portrait", "photo-frame", "chip", "icon-grid", "flag-chip", "logo-chip", "city", "note", "glow"} | HUD_DATOS | HUD_MAPA_NARRATIVA
HUD_SOLO_DYNAMIC = {"alert", "headline", "key-figure", "date-card", "message"}
ESTILOS_RESALTE = {"blue", "white", "red", "yellow", "orange", "green", "hatch-red", "hatch-orange"}
NO_TEXTUALES = {"highlight", "arc", "hemicycle", "counter", "portrait", "photo-frame", "chip", "icon-grid", "flag-chip", "logo-chip", "flag-fill", "glow", "choropleth"} | HUD_DATOS | HUD_MAPA_NARRATIVA
ICONOS_CLASICOS = set("db eye gavel doc shield bolt drop chart lock ban vote people star globe drone warn".split())
EMOJI = re.compile("[\U0001F000-\U0001FAFF☀-➿⬀-⯿️]")
MARCADORES = re.compile(r"TODO|REEMPLAZAR|XXX|\[\.\.\.\]|lorem", re.I)


def norm(s):  # idéntico a norm() de _proto/proto.js
    s = unicodedata.normalize("NFD", str(s).lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9 ]", "", s).strip()


def make_timer(words):
    """réplica de makeTimer() de _proto/proto.js: devuelve T(valor) -> segundos | None si el ancla no existe."""
    W = [(norm(w["word"]), w["start"], w["end"]) for w in words]

    def T(v):
        if v is None:
            return None
        if isinstance(v, (int, float)):
            return float(v)
        s = str(v).strip()
        if not s.startswith("@"):
            try:
                return float(s)
            except ValueError:
                return None
        s, off = s[1:], 0.0
        m = re.search(r"([+-]\d+(?:\.\d+)?)$", s)
        if m:
            off = float(m.group(1)); s = s[:-len(m.group(1))]
        at_end = s.endswith(":end")
        if at_end:
            s = s[:-4]
        nth, m = 1, re.search(r"#(\d+)$", s)
        if m:
            nth = int(m.group(1)); s = s[:-len(m.group(0))]
        toks = [t for t in norm(s).split() if t]
        if not toks:
            return None
        hit = 0
        for i in range(len(W) - len(toks) + 1):
            if all(W[i + j][0] == tk for j, tk in enumerate(toks)):
                hit += 1
                if hit == nth:
                    return (W[i + len(toks) - 1][2] if at_end else W[i][1]) + off
        return None
    return T


class Informe:
    def __init__(self):
        self.E, self.A = [], []

    def e(self, m): self.E.append(m)
    def a(self, m): self.A.append(m)


def cargar(p: Path):
    return json.loads(p.read_text()) if p.is_file() else None


def recurso_local(assets, src):
    """Resuelve assets del episodio y el alias servido del motor compartido."""
    direct = assets / src
    if direct.is_file(): return direct
    served = posixpath.normpath(f"/sandbox/nodepolitics/{assets.parent.name}/assets/{src}")
    prefix = "/sandbox/nodehistory/_atlas/"
    if served.startswith(prefix): return NOTICIERO.parent / served.removeprefix(prefix)
    return direct


def textos(o):
    if isinstance(o, str):
        yield o
    elif isinstance(o, dict):
        for k, v in o.items():
            if k in ("src", "region", "from", "to", "at", "type", "style", "color", "dot", "icon", "side", "font"):
                continue
            yield from textos(v)
    elif isinstance(o, list):
        for v in o:
            yield from textos(v)


def validar_identidad(hud, layers, assets, R):
    """Valida datos de identidad antes de abrir el navegador."""
    shared = NOTICIERO.parent / "assets"
    icons = cargar(shared / "icons/noticiero-icons.json") or {}
    valid = set(icons) | ICONOS_CLASICOS
    categories = {d["categoria"] for d in icons.values()}
    for i, it in enumerate(hud):
        route, typ = f"hud[{i}]", it.get("type")
        icon = it.get("icon", "star")
        if typ == "chip" and not it.get("glyph") and (not isinstance(icon, str) or icon not in valid):
            R.e(f"{route}: icono desconocido {it.get('icon')!r}; el navegador usaría star")
        if typ == "icon-grid":
            names = it.get("names")
            if names is not None:
                if not isinstance(names, list) or not all(isinstance(n, str) for n in names):
                    R.e(f"{route}.names debe ser una lista de nombres")
                else:
                    for n in names:
                        if n not in valid: R.e(f"{route}: icono desconocido {n!r}")
            elif it.get("category") is not None and (not isinstance(it["category"], str) or it["category"] not in categories):
                R.e(f"{route}: categoría de iconos desconocida {it['category']!r}")
            cols = it.get("cols", 4)
            if not isinstance(cols, int) or isinstance(cols, bool) or cols < 1:
                R.e(f"{route}.cols debe ser un entero positivo")
        if typ in {"icon-grid", "flag-chip", "logo-chip"}:
            for key in ("size", "scale", "scalePortrait", "scaleLandscape", "labelSize", "width"):
                value = it.get(key, 1)
                if not isinstance(value, (int, float)) or isinstance(value, bool) or not 0 < value < float('inf'):
                    R.e(f"{route}.{key} debe ser un número positivo finito")
        if typ in {"flag-chip", "logo-chip"} and it.get("shape", "rect") not in ("rect", "round"):
            R.e(f"{route}.shape debe ser rect o round")
        if typ == "flag-chip" and not it.get("src"):
            code = str(it.get("code", "")).lower()
            if not re.fullmatch(r"[a-z]{2}", code) or not (shared / "flags" / f"{code}.svg").is_file():
                R.e(f"{route}: código de bandera no disponible {code!r}")
        if typ == "logo-chip" and not it.get("src"):
            R.a(f"{route}: logo-chip sin src; se dibujarán las iniciales")
    for i, ly in enumerate(layers):
        if ly.get("type") == "flag-fill":
            src = ly.get("src")
            if not isinstance(src, str) or not recurso_local(assets, src).is_file():
                R.e(f"layers[{i}]: bandera src {src!r} no existe respecto a assets/")
def validar_datos(hud, R, T=None):
    """Contratos numéricos y referencias de las piezas de datos, incluidos steps."""
    shared = NOTICIERO.parent / "assets"
    valid_icons = set(cargar(shared / "icons/noticiero-icons.json") or {}) | ICONOS_CLASICOS
    def number(value):
        return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)
    def positive(value):
        return number(value) and value > 0
    for i, it in enumerate(hud):
        typ = it.get("type")
        if typ not in HUD_DATOS: continue
        route = f"hud[{i}]"
        for key in ("width", "size", "labelSize", "scale", "scalePortrait", "scaleLandscape"):
            if key in it and not positive(it[key]): R.e(f"{route}.{key} debe ser positivo finito")
        steps = it.get("steps", [])
        if not isinstance(steps, list) or not all(isinstance(s, dict) for s in steps):
            R.e(f"{route}.steps debe ser una lista de objetos"); steps = []
        ordered = list(enumerate(steps))
        if T: ordered.sort(key=lambda pair: T(pair[1].get('t')) or 0)
        state = dict(it)
        for j, step in [(-1, None)] + ordered:
            path = route if step is None else f"{route}.steps[{j}]"
            if step is not None:
                state.update(step)
                if "t" not in step: R.e(f"{path}.t es obligatorio")
            for key in ("count", "stagger", "dur", "exit"):
                if key in state and (not number(state[key]) or state[key] < 0): R.e(f"{path}.{key} debe ser finito y no negativo")
            d = state.get("decimals", 0)
            if not isinstance(d, int) or isinstance(d, bool) or not 0 <= d <= 8: R.e(f"{path}.decimals debe ser un entero de 0 a 8")
            if "locale" in state and (not isinstance(state["locale"], str) or not re.fullmatch(r"[a-zA-Z]{2,8}(?:-[a-zA-Z0-9]{1,8})*", state["locale"])):
                R.e(f"{path}.locale debe ser una etiqueta de idioma como es-ES o en-US")
            if state.get("good", "up") not in ("up", "down"): R.e(f"{path}.good debe ser up o down")
            if typ == "delta":
                if (step is not None or not steps or "value" in it) and not number(state.get("value")):
                    R.e(f"{path}.value debe ser un número finito")
                if "from" in state and not number(state["from"]): R.e(f"{path}.from debe ser finito")
            if typ == "bar-compare" and state.get("orientation", "horizontal") not in ("horizontal", "vertical"):
                R.e(f"{path}.orientation debe ser horizontal o vertical")
            if state.get("max") is not None and (not number(state["max"]) or (typ == "bar-compare" and state["max"] <= 0)):
                R.e(f"{path}.max inválido")
            if typ == "line-series":
                series = state.get("series")
                if series is None and steps and step is None: continue
                if not isinstance(series, list) or not 1 <= len(series) <= 3:
                    R.e(f"{path}.series requiere 1–3 series"); continue
                for k, line in enumerate(series):
                    pts = line.get("points") if isinstance(line, dict) else None
                    if not isinstance(pts, list) or len(pts) < 2 or len(pts) > 1000:
                        R.e(f"{path}.series[{k}].points requiere 2–1000 puntos"); continue
                    xs, ys = [], []
                    forms = set()
                    for p in pts:
                        if isinstance(p, list) and len(p) == 2 and all(number(v) for v in p):
                            xs.append(p[0]); ys.append(p[1]); forms.add('xy')
                        elif isinstance(p, dict) and isinstance(p.get("label"), str) and number(p.get("value")):
                            xs.append(len(xs)); ys.append(p['value']); forms.add('label')
                        else: R.e(f"{path}.series[{k}]: punto inválido {p!r}")
                    if len(forms) > 1 or any(b <= a for a, b in zip(xs, xs[1:])):
                        R.e(f"{path}.series[{k}]: usa un único formato de punto y x estrictamente creciente")
                    if state.get('min') is not None and (not number(state['min']) or (ys and state['min'] > min(ys))): R.e(f"{path}.min debe incluir todos los puntos")
                    if state.get('max') is not None and number(state['max']) and ys and state['max'] < max(ys): R.e(f"{path}.max debe incluir todos los puntos")
                marker = state.get("marker")
                if marker is not None:
                    if not isinstance(marker, dict) or not (number(marker.get('x')) or isinstance(marker.get('label'), str)):
                        R.e(f"{path}.marker requiere x numérico o label de un punto")
                    elif 'label' in marker and not any(isinstance(p, dict) and p.get('label') == marker['label'] for line in series if isinstance(line, dict) for p in line.get('points', [])):
                        R.e(f"{path}.marker.label no coincide con un punto")
                continue
            field = {"bar-compare": "bars", "ranking": "items", "stacked-bar": "parts", "ticker": "items"}.get(typ)
            if not field: continue
            rows = state.get(field)
            if rows is None and steps and step is None: continue
            lo, hi = {"bar-compare": (2,6), "ranking": (3,5), "stacked-bar": (1,12), "ticker": (2,6)}[typ]
            if not isinstance(rows, list) or not lo <= len(rows) <= hi:
                R.e(f"{path}.{field} requiere {lo}–{hi} elementos"); continue
            labels = []
            for k, row in enumerate(rows):
                rp = f"{path}.{field}[{k}]"
                if not isinstance(row, dict): R.e(f"{rp} debe ser un objeto"); continue
                name = row.get('name', row.get('label')) if typ == 'ranking' else row.get('label')
                if not isinstance(name, str) or not name.strip(): R.e(f"{rp}: falta nombre/etiqueta")
                labels.append(name)
                v = row.get('value')
                if not number(v) or (typ in ('bar-compare','stacked-bar') and v < 0): R.e(f"{rp}.value inválido")
                if typ == 'ticker' and not number(row.get('change')): R.e(f"{rp}.change debe ser finito")
                if row.get('flag') is not None:
                    code = str(row['flag']).lower()
                    if not re.fullmatch(r'[a-z]{2}', code) or not (shared/'flags'/f'{code}.svg').is_file(): R.e(f"{rp}: bandera desconocida {row['flag']!r}")
                if row.get('icon') is not None and (not isinstance(row['icon'], str) or row['icon'] not in valid_icons): R.e(f"{rp}: icono desconocido {row['icon']!r}")
            if len(set(str(v) for v in labels)) != len(labels): R.e(f"{path}.{field}: etiquetas repetidas")
            if typ == 'bar-compare' and state.get('highlight') and state['highlight'] not in labels: R.e(f"{path}.highlight no coincide con una barra")
            if typ == 'stacked-bar':
                if not any(isinstance(r, dict) and positive(r.get('value')) for r in rows): R.e(f"{path}.parts requiere suma positiva")
                if state.get('total') is not None and not positive(state['total']): R.e(f"{path}.total debe ser positivo finito")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("episodio"); ap.add_argument("--tarde", action="store_true")
    ap.add_argument("--permitir-estilo", action="store_true", help="no exigir estilo original (solo si el usuario lo pidió)")
    args = ap.parse_args()
    root = Path(args.episodio).resolve()
    R = Informe()
    A = root / "assets"
    script = cargar(A / "script.json"); scene = cargar(A / "scene.json"); cfg = cargar(A / "config.json")
    lyr = cargar(A / "lyrics.json"); qc = cargar(A / "song.qc.json")
    for nombre, obj in (("script.json", script), ("scene.json", scene), ("config.json", cfg)):
        if obj is None and not (args.tarde and nombre != "script.json"):
            R.e(f"falta assets/{nombre}")
    if not (root / "index.html").is_file():
        R.e("falta index.html (usa tools/nuevo.py)")
    if script is None:
        return salir(R)
    if scene is None:                      # --tarde sin escena: solo se valida el guion
        scene, cfg = {}, None

    # ---------------- guion
    segs = script.get("segments", [])
    ids = [s.get("id") for s in segs]
    if len(set(ids)) != len(ids):
        R.e("ids de segmento repetidos")
    palabras = 0
    for s in segs:
        txt = (s.get("text") or "").strip()
        if not txt:
            R.e(f"{s.get('id')}: texto vacío")
        if EMOJI.search(txt):
            R.e(f"{s.get('id')}: emoji en el texto hablado")
        if MARCADORES.search(txt):
            R.e(f"{s.get('id')}: marcador sin resolver en el texto")
        if s.get("tone") != "aceleración":
            R.a(f"{s.get('id')}: tone «{s.get('tone')}» (el perfil del noticiero es «aceleración»)")
        n = len(txt.split()); palabras += n
        if n > 70:
            R.a(f"{s.get('id')}: {n} palabras; parte el segmento (≤ 70) para que las piezas lo sigan")
    voz = script.get("voice")
    if voz != "Charon":
        R.a(f"script.voice = {voz!r}; el perfil fijo es Charon")

    # ---------------- voz y lyrics
    words = []
    if lyr:
        words = [w for s in lyr.get("segments", []) for w in s.get("words", [])]
    dur_voz = None
    if qc:
        dur_voz = qc.get("dur_s")
        if qc.get("voice") != "Charon":
            R.e(f"song.qc.json: voz {qc.get('voice')!r} (debe ser Charon)")
        if (qc.get("wer_aprox") or 0) > 0.2:
            R.a(f"WER {qc['wer_aprox']} > 0.2: escucha el audio completo")
        wpm = qc.get("wpm")
        if wpm and not 150 <= wpm <= 200:
            R.a(f"ritmo {wpm} palabras/min fuera de 150–200 (el perfil da ≈180)")
    elif not args.tarde:
        R.e("falta assets/song.qc.json (genera la voz con tools/voz.py)")
    if not args.tarde:
        if not words:
            R.e("falta assets/lyrics.json (tools/voz.py transcribe)")
        elif abs(len(words) - palabras) > max(3, palabras * .03):
            R.e(f"lyrics.json tiene {len(words)} palabras y el guion {palabras}: re-transcribe con el guion final")

    T = make_timer(words) if words else (lambda v: float(v) if isinstance(v, (int, float)) else None)
    fin_voz = (words[-1]["end"] if words else dur_voz) or 0

    if not scene:
        resumen = {"segmentos": len(segs), "palabras": palabras, "nota": "sin escena todavía (--tarde): solo guion"}
        return salir(R, resumen)

    # ---------------- escena: perfil visual
    if scene.get("estilo") != "original" and not args.permitir_estilo:
        R.e(f"scene.estilo = {scene.get('estilo')!r}; el estilo por defecto es «original»")
    if cfg:
        c0 = (cfg.get("configs") or [{}])[0]
        if c0.get("estilo") not in (None, "original") and not args.permitir_estilo:
            R.e("config.json: estilo distinto de «original»")
    if scene.get("look") != "noticiero-globo":
        R.e(f"scene.look = {scene.get('look')!r} (debe ser noticiero-globo)")
    if scene.get("attribution") is not False:
        R.e("scene.attribution debe ser false (sin crédito técnico sobre el video)")

    hud, layers, camera = scene.get("hud", []), scene.get("layers", []), scene.get("camera", [])
    validar_identidad(hud, layers, A, R)
    validar_datos(hud, R, T)
    places, regions = scene.get("places", {}), scene.get("regions", {})

    spec = importlib.util.spec_from_file_location('validar_mapa_narrativa', Path(__file__).with_name('validar-mapa-narrativa.py'))
    validator = importlib.util.module_from_spec(spec); spec.loader.exec_module(validator)
    geo_ids = {ft['properties']['id'] for name in ('admin0', 'admin1') for ft in json.load(open(GEO / f'{name}.geojson'))['features']}
    icons = set(cargar(NOTICIERO.parent / 'assets/icons/noticiero-icons.json') or {}) | ICONOS_CLASICOS
    validator.validar(scene, R, T, geo_ids, icons)

    # tipos
    for i, it in enumerate(hud):
        t = it.get("type")
        if t in HUD_SOLO_DYNAMIC and scene.get("estilo") == "original":
            R.e(f"hud[{i}] {t}: no existe en el estilo Original")
        elif t not in HUD_ORIGINAL | HUD_SOLO_DYNAMIC:
            R.e(f"hud[{i}]: tipo desconocido {t!r}")

    # tiempos
    eventos = []
    def tiempo(ruta, v):
        if v is None:
            return None
        r = T(v)
        if r is None and not args.tarde:
            R.e(f"{ruta}: ancla {v!r} no existe en lyrics.json")
        return r

    def revisa(lista, nombre, extra_steps=False):
        ini = []
        for i, it in enumerate(lista):
            t = tiempo(f"{nombre}[{i}].t", it.get("t")); o = tiempo(f"{nombre}[{i}].out", it.get("out"))
            if t is not None and o is not None and o <= t:
                R.e(f"{nombre}[{i}] ({it.get('type', '')}): out ({o:.2f}) ≤ t ({t:.2f})")
            if t is not None:
                eventos.append(t)
            for j, st in enumerate(it.get("steps", []) if extra_steps and isinstance(it.get("steps", []), list) else []):
                if not isinstance(st, dict): continue
                ts = tiempo(f"{nombre}[{i}].steps[{j}].t", st.get("t"))
                if ts is not None:
                    eventos.append(ts)
                if isinstance(st.get("marker"), dict): tiempo(f"{nombre}[{i}].steps[{j}].marker.t", st["marker"].get("t"))
            if isinstance(it.get("marker"), dict): tiempo(f"{nombre}[{i}].marker.t", it["marker"].get("t"))
            for j, event in enumerate(it.get('events', []) if isinstance(it.get('events', []), list) else []):
                if not isinstance(event, dict): continue
                at = tiempo(f'{nombre}[{i}].events[{j}].t', event.get('t'))
                if at is not None: eventos.append(at)
            ini.append((t, o, it))
        return ini
    h_t, l_t = revisa(hud, "hud", True), revisa(layers, "layers")
    for i, k in enumerate(camera):
        t = tiempo(f"camera[{i}].t", k.get("t"))
        if t is not None:
            eventos.append(t)

    # lugares y regiones
    aliases = None
    def dataset_ids():
        nonlocal aliases
        if aliases is None:
            aliases = set()
            for f in ("admin0", "admin1"):
                aliases |= {ft["properties"]["id"] for ft in json.load(open(GEO / f"{f}.geojson"))["features"]}
            aliases |= set(json.load(open(GEO / "aliases.json")))
        return aliases
    def lugar_ok(x):
        return isinstance(x, list) or x in places
    for i, it in enumerate(hud):
        a = it.get("at")
        if isinstance(a, str) and a not in places:
            R.a(f"hud[{i}].at {a!r} no está en scene.places")
        for p in it.get("points", []) if isinstance(it.get("points"), list) else []:
            if isinstance(p, str) and p not in places:
                R.a(f"hud[{i}].points {p!r} no está en scene.places")
    for i, ly in enumerate(layers):
        if ly.get("type") == "highlight":
            r = ly.get("region")
            if r not in regions and r not in dataset_ids():
                R.e(f"layers[{i}]: región {r!r} no declarada en scene.regions ni en el dataset")
            if isinstance(ly.get("style"), str) and ly["style"] not in ESTILOS_RESALTE:
                R.e(f"layers[{i}]: estilo de resaltado {ly['style']!r} desconocido")
        elif ly.get("type") == "arc":
            for k in ("from", "to"):
                if isinstance(ly.get(k), str) and ly[k] not in places:
                    R.a(f"layers[{i}].{k} {ly[k]!r} no está en scene.places")
    for k in camera:
        f = k.get("focus")
        if isinstance(f, str) and f not in places and not args.tarde and f not in dataset_ids():
            R.a(f"camera focus {f!r} no está en places")
    for nombre, r in regions.items():
        if not r.get("geometry"):
            R.e(f"scene.regions.{nombre} sin geometry")

    # medios
    creditos = ""
    for nombre in ("CREDITS.md", "credits.json"):          # medios.py escribe credits.json; los episodios viejos, CREDITS.md
        if (A / "media" / nombre).is_file():
            creditos += (A / "media" / nombre).read_text()
    usados = set()
    for i, it in enumerate(hud):
        src = it.get("src")
        if src:
            if not isinstance(src, str):
                R.e(f"hud[{i}].src debe ser una ruta de imagen")
                continue
            usados.add(src)
            f = recurso_local(A, src)
            if not f.is_file():
                R.e(f"hud[{i}]: imagen {src!r} no existe en assets/")
            elif Path(src).name not in creditos:
                R.e(f"hud[{i}]: {src!r} sin crédito en assets/media/credits.json (o CREDITS.md)")
        elif it.get("type") == "portrait":
            R.a(f"hud[{i}]: retrato «{it.get('name', '?')}» sin imagen (se dibuja una silueta)")
        elif it.get("type") == "photo-frame":
            R.e(f"hud[{i}]: photo-frame sin src")

    # textos
    for it in hud + layers:
        for s in textos(it):
            if EMOJI.search(s):
                R.e(f"emoji en texto visible: {s!r}")
            if MARCADORES.search(s):
                R.e(f"marcador sin resolver en texto visible: {s!r}")

    # topic en el mismo slot a la vez
    topics = [(t, o if o is not None else fin_voz, it.get("slot", 0), it.get("text")) for t, o, it in h_t if it.get("type") == "topic" and t is not None]
    for a in range(len(topics)):
        for b in range(a + 1, len(topics)):
            (t1, o1, s1, x1), (t2, o2, s2, x2) = topics[a], topics[b]
            if s1 == s2 and t1 < o2 - .05 and t2 < o1 - .05:
                R.a(f"topic «{x1}» y «{x2}» comparten slot {s1} entre {max(t1, t2):.1f}–{min(o1, o2):.1f} s")

    # ---------------- ritmo por segmento de la voz
    if words and segs:
        W = [(norm(w["word"]), w["start"], w["end"]) for w in words]
        pos, rangos = 0, []
        for s in segs:
            n = len(s["text"].split())
            a, b = min(pos, len(W) - 1), min(pos + n - 1, len(W) - 1)
            rangos.append((s["id"], W[a][1], W[b][2]))
            pos += n
        for sid, t0, t1 in rangos:
            activas = [it for t, o, it in h_t + l_t if t is not None and t < t1 and (o is None or o > t0) and it.get("type") in NO_TEXTUALES]
            nuevas = [it for t, o, it in h_t + l_t if t is not None and t0 - .3 <= t < t1]
            if not activas:
                R.e(f"{sid} ({t0:.1f}–{t1:.1f} s): ninguna pieza no textual activa (solo texto o mapa vacío)")
            elif not nuevas:
                R.a(f"{sid} ({t0:.1f}–{t1:.1f} s): ninguna pieza entra en este tramo (pantalla estática)")
    ev = sorted(eventos)
    for a, b in zip(ev, ev[1:]):
        if b - a > 10:
            R.a(f"{a:.1f}–{b:.1f} s: más de 10 s sin ningún evento nuevo")

    # duración de audio
    song = None
    if cfg:
        song = (cfg.get("configs") or [{}])[0].get("audio", {}).get("src")
    if song and (root / song).is_file():
        try:
            d = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(root / song)], text=True).strip())
            if scene.get("duration") and d + .5 < scene["duration"]:
                R.e(f"{song} dura {d:.1f} s y la escena {scene['duration']} s (¿falta song-outro.mp3? voz.py lo crea)")
        except Exception:
            pass
    elif not args.tarde:
        R.e("config.json: audio.src no existe")

    resumen = {
        "segmentos": len(segs), "palabras": palabras,
        "tipos_hud": sorted({it.get("type") for it in hud}),
        "retratos": sum(1 for it in hud if it.get("type") == "portrait"),
        "fotos": sum(1 for it in hud if it.get("type") == "photo-frame"),
        "resaltados": sum(1 for l in layers if l.get("type") == "highlight"),
        "arcos": sum(1 for l in layers if l.get("type") == "arc"),
        "imagenes_distintas": len(usados),
    }
    return salir(R, resumen)


def salir(R, resumen=None):
    if resumen:
        print("RESUMEN", json.dumps(resumen, ensure_ascii=False))
    for m in R.E:
        print("E ", m)
    for m in R.A:
        print("A ", m)
    print(f"\n{len(R.E)} errores · {len(R.A)} avisos")
    sys.exit(1 if R.E else 0)


if __name__ == "__main__":
    main()
