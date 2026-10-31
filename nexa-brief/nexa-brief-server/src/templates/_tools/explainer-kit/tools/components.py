#!/usr/bin/env python3
"""components.py · control de calidad de los componentes PROPIOS de un video (paso 3c).

Un video puede traer componentes que el catálogo del diseño no tiene (un tablero de ajedrez,
un motor, un barco…) en `assets/components/*.js`. Este control los valida igual que a los del kit
y deja todo listo para que el agente (o una persona) los MIRE y decida:

  1. estático: sintaxis (node --check), APIs prohibidas (determinismo), colores escritos a mano,
     `size` en px, nombre `<familia>.<nombre>` que no pise uno del kit;
  2. en el navegador (stage.html, sin plano previo): errores de consola, captura en 9:16 y 16:9
     en los instantes que importan (0,3 · 0,8 s aparece · 1,5 s idea armada · 3 s asentado · final),
     medidas (qué tanto ocupa, si aparece a tiempo) y determinismo (seek(3) directo = seek(3)
     después de seek(5,5)). La salida no se mide acá: la hace el motor con el plano siguiente;
     se ve en `kit.py sheet`;
  3. registro: los componentes SIN errores van a `assets/components/catalog.json` (así `check`
     los conoce) y a `config.components` del video (así el motor los carga);
  4. revisión: hoja `work/components/<nombre>.png` + plantilla de rúbrica en
     `work/components/review.md` (guides/components.md §6). Cada versión nueva de un componente
     (su bloque K.register) es una ronda (volver a correr sin cambios no cuenta); si a la 3.ª sigue
     con errores, el control lo dice: dejar de iterar y usar el catálogo.

Uso (desde nexa-brief-server/):
  .venv/bin/python src/templates/_tools/explainer-kit/tools/components.py <carpeta-del-video> [--only nombre]
  (o `kit.py components <video-id>`)
"""
from __future__ import annotations

import argparse, asyncio, hashlib, io, json, os, pathlib, re, subprocess, sys, urllib.parse

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import shoot  # noqa: E402
from PIL import Image, ImageChops, ImageStat  # noqa: E402

KIT = pathlib.Path(__file__).resolve().parents[1]
MAX_ROUNDS = 3
DUR = 6.0
# instantes de la hoja: aparece, idea armada, asentado, final del plano
TIMES = (0.3, 0.8, 1.5, 3.0, DUR - 0.2)
# cuándo tiene que verse algo: rough dibuja desde el primer cuadro; en binary los glifos
# viajan desde el polvo (~1 s de armado), así que se mide un poco después
VISIBLE_AT = {"rough": 0.3, "binary": 0.8}
BANNED = {
    r"Math\.random": "Math.random (usar K.rng(semilla) en create)",
    r"\bDate\b": "Date",
    r"performance\.now": "performance.now",
    r"setTimeout|setInterval|requestAnimationFrame": "timers (todo sale de lt)",
    r"\bfetch\(": "fetch",
    r"\beval\(": "eval",
}
NAME_RE = re.compile(r"""\bname\s*:\s*["']([a-z][a-z0-9_-]*\.[A-Za-z0-9_-]+)["']""")


def block_of(js: str, name: str) -> str:
    """Texto del K.register de `name` (para contar rondas por componente aunque compartan archivo)."""
    at = js.find(f'"{name}"')
    if at < 0:
        at = js.find(f"'{name}'")
    start = js.rfind("K.register(", 0, at)
    end = js.find("K.register(", at)
    return js[max(0, start):end if end > 0 else len(js)]


def family_of(video: pathlib.Path) -> str:
    raw = json.loads((video / "assets" / "config.json").read_text())
    design = (raw["configs"][0] if "configs" in raw else raw).get("design", "binary")
    return json.loads((KIT / "designs" / design / "design.json").read_text())["family"]


def lint(js: str, family: str, kit_names: set[str]) -> tuple[list[str], list[str]]:
    errors, warnings = [], []
    code = re.sub(r"/\*.*?\*/|//[^\n]*", "", js, flags=re.S)        # sin comentarios
    for pat, what in BANNED.items():
        if re.search(pat, code):
            errors.append(f"usa {what}: rompe el determinismo (el video se graba cuadro a cuadro)")
    # el blanco de las máscaras de muestreo (sampleShape) es legítimo; lo demás va por ctx.C.palette
    if re.search(r"#[0-9a-fA-F]{3,6}\b|rgba?\(", re.sub(r"(fill|stroke)Style\s*=\s*[\"']#fff(fff)?[\"']", "", code)):
        errors.append("escribe colores a mano: usar ctx.C.palette (bg, ink, muted, accent, accentInk)")
    if re.search(r"size:\s*[^,}]*\bu\s*\*|size:\s*u\b", code):
        warnings.append("`size` parece estar en px (u * …): en R.text/B.tag/B.mono `size` va EN u")
    small = sorted({float(s) for s in re.findall(r"\bsize:\s*(\d*\.?\d+)\b", code) if float(s) < 1.6})
    if small:
        warnings.append(f"textos con size {small} (< 1,6 u): en el celular no se leen; rótulos ≥ 1,6 u (mono) y ≥ 2,2 u (títulos)")
    for name in NAME_RE.findall(code):
        if not name.startswith(family + "."):
            errors.append(f"{name}: el nombre tiene que empezar con '{family}.' (familia del diseño)")
        if name in kit_names:
            errors.append(f"{name}: ya existe en el catálogo del kit; elegir otro nombre o usar el del kit")
    return errors, warnings


def ink(im: Image.Image) -> Image.Image:
    """Máscara de lo que el componente dibuja (descarta el fondo y el polvo tenue de binary)."""
    return im.convert("L").point(lambda v: 255 if v > 110 else 0)


def coverage(im: Image.Image) -> float:
    return ImageStat.Stat(ink(im)).mean[0] / 255


def height_fraction(im: Image.Image) -> float:
    """Alto de la zona con dibujo denso (filas con ≥ 0,5 % de píxeles encendidos) / alto del cuadro."""
    mask = ink(im)
    h = mask.size[1]
    means = mask.resize((1, h), Image.BOX).tobytes()
    rows = [y for y, v in enumerate(means) if v >= 255 * 0.005]
    return (rows[-1] - rows[0]) / h if rows else 0.0


def width_fraction(im: Image.Image) -> float:
    """Ancho de la zona con dibujo denso (columnas con ≥ 0,5 % de píxeles encendidos) / ancho del cuadro."""
    mask = ink(im)
    w = mask.size[0]
    means = mask.resize((w, 1), Image.BOX).tobytes()      # promedio de cada columna (0–255)
    cols = [x for x, v in enumerate(means) if v >= 255 * 0.005]
    return (cols[-1] - cols[0]) / w if cols else 0.0


async def inspect(video: pathlib.Path, files: list[pathlib.Path], names: dict[str, pathlib.Path], family: str):
    """Abre stage.html con cada componente; devuelve (catálogo, capturas, problemas por nombre)."""
    from playwright.async_api import async_playwright
    srv = shoot.serve(shoot.SANDBOX)
    base = f"http://127.0.0.1:{srv.server_port}/{KIT.relative_to(shoot.SANDBOX).as_posix()}/showcase/stage.html?"
    catalog, shots = [], []
    problems: dict[str, dict[str, list]] = {n: {"errors": [], "warnings": [], "metrics": {}} for n in names}
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path=shoot.CHROMIUM)
        for name, file in names.items():
            js = os.path.relpath(file, KIT / "showcase")
            design = json.loads((video / "assets" / "config.json").read_text())
            design = (design["configs"][0] if "configs" in design else design).get("design", "binary")
            for orient, (W, H) in shoot.ORIENT.items():
                page = await browser.new_page(viewport={"width": W, "height": H})
                console: list[str] = []
                page.on("console", lambda m: m.type in ("error", "warning") and console.append(f"{m.type}: {m.text}"))
                page.on("pageerror", lambda e: console.append(f"pageerror: {e}"))
                q = {"d": design, "c": name, "paused": "1", "dur": str(DUR), "solo": "1", "js": js}
                await page.goto(base + urllib.parse.urlencode(q), wait_until="domcontentloaded", timeout=120000)
                try:
                    await page.wait_for_function("window.__promo", timeout=60000)
                except Exception:  # noqa: BLE001 - el componente rompió el arranque
                    problems[name]["errors"].append(f"{orient}: el escenario no arrancó ({'; '.join(console)[:300] or 'sin mensaje'})")
                    await page.close()
                    continue
                if orient == "16x9":
                    entry = await page.evaluate("n => (Kit.catalog ? Kit.catalog() : []).find(c => c.name === n) || null", name)
                    if entry:
                        catalog.append(entry)
                    else:
                        problems[name]["errors"].append("no se registró (¿falta K.register o el nombre no coincide?)")
                frames = {}
                for t in TIMES:
                    await page.evaluate(f"window.__promo.seek({t})")
                    frames[t] = Image.open(io.BytesIO(await page.screenshot(type="png"))).convert("RGB")
                    shots.append((orient, name, t, frames[t]))
                # determinismo: el mismo instante tiene que dar el mismo cuadro, venga de donde venga
                await page.evaluate("window.__promo.seek(5.5)")
                await page.evaluate("window.__promo.seek(3.0)")
                again = Image.open(io.BytesIO(await page.screenshot(type="png"))).convert("RGB")
                drift = sum(ImageStat.Stat(ImageChops.difference(frames[3.0], again)).mean) / 3
                await page.close()
                m = problems[name]["metrics"]
                cov = {t: round(coverage(im), 4) for t, im in frames.items()}
                peak = max(cov.values()) or 1e-9
                m[orient] = {"coverage": cov, "drift": round(drift, 3), "width": round(width_fraction(frames[3.0]), 3),
                             "height": round(height_fraction(frames[3.0]), 3)}
                if console:
                    problems[name]["errors"] += [f"{orient}: {c[:300]}" for c in dict.fromkeys(console) if "favicon" not in c and "config.json" not in c]
                if drift > 1.0:
                    problems[name]["errors"].append(f"{orient}: no es determinista (seek(3) cambia según desde dónde se llega: diferencia {drift:.2f})")
                first = VISIBLE_AT.get(family, 0.3)
                if cov[first] < 0.0005:
                    problems[name]["warnings"].append(f"{orient}: a los {first:g} s no se ve nada (algo tiene que aparecer enseguida)")
                if cov[1.5] < 0.5 * peak:
                    problems[name]["warnings"].append(f"{orient}: a los 1,5 s la idea no está armada ({cov[1.5] / peak:.0%} de lo que llega a dibujar)")
                if orient == "9x16" and m[orient]["width"] < 0.5:
                    problems[name]["warnings"].append(f"9x16: ocupa {m[orient]['width']:.0%} del ancho; el objeto principal va en ≥ 60 % del contenido (~55 % del cuadro)")
                if orient == "9x16" and m[orient]["height"] < 0.3:
                    problems[name]["warnings"].append(
                        f"9x16: ocupa solo {m[orient]['height']:.0%} del alto (una franja): en vertical se reacomoda para usar la altura "
                        "(apilar partes, girar el esquema a vertical, agrandar); la mitad del cuadro no puede quedar vacía")
                if peak < 0.004:
                    problems[name]["errors"].append(f"{orient}: casi no dibuja nada (cobertura máxima {peak:.2%})")
        await browser.close()
    srv.shutdown()
    return catalog, shots, problems


RUBRIC = """
### {name}  ·  ronda {round}

Hoja: `work/components/{slug}.png` (filas 9:16 y 16:9; t = 0,3 · 0,8 · 1,5 · 3 · fin del plano)

| criterio (guides/components.md §6.3) | nota 1–5 | qué ves / qué cambiar |
|---|---|---|
| se reconoce en 1 s (silueta, objeto inequívoco) | | |
| tamaño y composición (9:16: ≥ 60 % del ancho Y usa la altura, sin media pantalla vacía; nada cortado, sin choques) | | |
| legibilidad (en el tamaño del CELULAR: rótulos ≥ 1,6 u, en tinta y no en gris si dicen algo importante) | | |
| estilo del diseño (paleta, trazo/glifos, un solo acento) | | |
| tiempos (visible 0,3 s, idea 1,5 s, movimiento lento, salida limpia) | | |
| narrativa (dibuja lo que dice la voz; sirve para ≥ 2 planos o el clímax) | | |

Veredicto: aprobado | mejorar | descartar  ←  dejar UNO
"""


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("video", type=pathlib.Path)
    ap.add_argument("--only", default="", help="revisar un solo componente")
    a = ap.parse_args()
    video = a.video.resolve()
    comp_dir = video / "assets" / "components"
    files = sorted(comp_dir.glob("*.js"))
    if not files:
        print("· sin componentes propios (assets/components/*.js): nada que revisar")
        return 0
    family = family_of(video)
    kit_names = {c["name"] for c in json.loads((KIT / "catalog.json").read_text())["comps"]}
    names: dict[str, pathlib.Path] = {}
    static: dict[str, tuple[list[str], list[str]]] = {}
    for f in files:
        text = f.read_text(encoding="utf-8")
        syntax = subprocess.run(["node", "--check", str(f)], capture_output=True, text=True)
        errs, warns = lint(text, family, kit_names)
        if syntax.returncode:
            errs.insert(0, "error de sintaxis: " + syntax.stderr.strip()[-400:])
        found = NAME_RE.findall(re.sub(r"/\*.*?\*/|//[^\n]*", "", text, flags=re.S))
        if not found:
            print(f"✗ {f.name}: no registra ningún componente (K.register con name: \"{family}.…\")")
        for n in found:
            if a.only and n != a.only:
                continue
            names[n] = f
            static[n] = (list(errs), list(warns))
    blocked = {n for n, (e, _) in static.items() if any("sintaxis" in x for x in e)}
    catalog, shots, problems = asyncio.run(inspect(video, files, {n: f for n, f in names.items() if n not in blocked}, family))
    for n in blocked:
        problems[n] = {"errors": [], "warnings": [], "metrics": {}}

    out = video / "work" / "components"
    out.mkdir(parents=True, exist_ok=True)
    rounds_path = out / "rounds.json"
    rounds = json.loads(rounds_path.read_text()) if rounds_path.exists() else {}
    report, valid, new_round = {}, [], set()
    for n in names:
        errs = static[n][0] + problems[n]["errors"]
        warns = static[n][1] + problems[n]["warnings"]
        digest = hashlib.sha1(block_of(names[n].read_text(encoding="utf-8"), n).encode()).hexdigest()[:12]
        prev = rounds.get(n) or {"round": 0, "hash": ""}
        if prev["hash"] != digest:
            new_round.add(n)
        rounds[n] = {"round": prev["round"] + (n in new_round), "hash": digest}
        slug = n.replace(".", "-")
        mine = [s for s in shots if s[1] == n]
        if mine:
            shoot.sheet(mine, out / f"{slug}.png", 300)
        report[n] = {"file": str(names[n].relative_to(video)), "round": rounds[n]["round"], "errors": errs, "warnings": warns, "metrics": problems[n]["metrics"]}
        if not errs:
            valid.append(n)
        mark = "✓" if not errs else "✗"
        print(f"{mark} {n} (ronda {rounds[n]['round']}/{MAX_ROUNDS}) · hoja work/components/{slug}.png")
        for e in errs:
            print(f"    ✗ {e}")
        for w in warns:
            print(f"    ⚠ {w}")
        if errs and rounds[n]["round"] >= MAX_ROUNDS:
            print(f"    ⛔ {MAX_ROUNDS} rondas con errores: no seguir iterando. Reemplazar sus planos por componentes del catálogo y anotarlo en PLAN §10.")
    rounds_path.write_text(json.dumps(rounds, ensure_ascii=False, indent=2) + "\n")
    (out / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")

    # registro: solo los válidos quedan disponibles para check y para el motor
    local_catalog = comp_dir / "catalog.json"
    previous = json.loads(local_catalog.read_text())["comps"] if local_catalog.exists() else []
    keep = {c["name"]: c for c in previous if c["name"] not in names and any(c["name"] in f.read_text() for f in files)}
    keep.update({c["name"]: c for c in catalog if c["name"] in valid})
    local_catalog.write_text(json.dumps({"comps": sorted(keep.values(), key=lambda c: c["name"])}, ensure_ascii=False, indent=1) + "\n")
    cfg_path = video / "assets" / "config.json"
    raw = json.loads(cfg_path.read_text())
    cfg = raw["configs"][0] if "configs" in raw else raw
    # el motor carga los archivos que tienen al menos un componente válido
    cfg["components"] = sorted(str(f.relative_to(video)) for f in files if any(k in f.read_text() for k in keep))
    cfg_path.write_text(json.dumps(raw, ensure_ascii=False, indent=2) + "\n")

    review = out / "review.md"
    if not review.exists():
        review.write_text("# Revisión de componentes propios\n\nUna sección por ronda. Mirar la hoja ANTES de poner las notas.\n", encoding="utf-8")
    with review.open("a", encoding="utf-8") as fh:   # una rúbrica por versión nueva
        for n in sorted(new_round):
            fh.write(RUBRIC.format(name=n, round=rounds[n]["round"], slug=n.replace(".", "-")))
    print(f"→ registrados {len(keep)} en assets/components/catalog.json · completar work/components/review.md mirando cada hoja")
    return 1 if len(valid) < len(names) else 0


if __name__ == "__main__":
    sys.exit(main())
