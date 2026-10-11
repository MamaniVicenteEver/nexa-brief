#!/usr/bin/env python3
"""Ciclo completo IA → componente validado (lo que escala a miles de componentes).

  1. pide el componente a DeepSeek con prompts/component-author.md;
  2. valida: sintaxis (node --check) + reglas (lint de prohibidos) + ejecución real
     en la galería (errores de consola en 9:16 y 16:9);
  3. si hay errores, se los devuelve a DeepSeek para que corrija (hasta N veces);
  4. guarda la hoja de capturas para la revisión visual (que sigue siendo humana/IA con ojos).

Uso (desde nexa-brief-server/):
  .venv/bin/python src/templates/_tools/explainer-kit/tools/ai_loop.py rough.load "Creá rough.load: …" \
      [--params '{"src":"…"}'] [--repairs 2] [--tag v5] [--out hoja.png]
"""
import argparse, asyncio, pathlib, re, subprocess, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import shoot  # noqa: E402

KIT = pathlib.Path(__file__).resolve().parents[1]
PY = sys.executable
BANNED = [r"Math\.random", r"\bDate\b", r"performance\.now", r"setTimeout", r"setInterval", r"requestAnimationFrame", r"\bfetch\(", r"\beval\("]

def lint(js: str) -> list[str]:
    out = [f"usa {b.replace(chr(92), '')} (prohibido: rompe el determinismo)" for b in BANNED if re.search(b, js)]
    # el blanco de las máscaras de muestreo (sampleShape) es legítimo: no cuenta
    if re.search(r"#[0-9a-fA-F]{3,6}\b|rgba?\(", re.sub(r"(fill|stroke)Style\s*=\s*[\"']#fff(fff)?[\"']", "", js)): out.append("escribe colores a mano (usar ctx.C.palette)")
    if re.search(r"size:\s*[^,}]*\bu\s*\*|size:\s*u\b", js): out.append("pasa `size` en px (u * …): size va EN u")
    return out

def run_gallery(name, params, js_rel, out_png):
    shoot.JS = js_rel
    specs = [(name, params)]
    shots, errors = asyncio.run(shoot.shoot(specs, [2.2, 4.0, 6.5], ["9x16", "16x9"], "", "", "7"))
    shoot.sheet(shots, out_png, 380)
    return [e for e in dict.fromkeys(errors) if "anclas" not in e]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("name"); ap.add_argument("task")
    ap.add_argument("--params", default=""); ap.add_argument("--repairs", type=int, default=2)
    ap.add_argument("--tag", default="loop"); ap.add_argument("--out", default="")
    a = ap.parse_args()
    js = KIT / "lab" / "deepseek" / "drafts" / (a.name.replace(".", "-") + ".js")
    rel = "../lab/deepseek/drafts/" + js.name
    out_png = a.out or str(KIT / "lab" / "deepseek" / f"{a.name}-{a.tag}.png")
    gen = [PY, str(KIT / "tools" / "deepseek_component.py"), a.name, a.task]
    subprocess.run(gen + ["--tag", a.tag], check=True)
    for k in range(a.repairs + 1):
        problems = []
        chk = subprocess.run(["node", "--check", str(js)], capture_output=True, text=True)
        if chk.returncode: problems.append("error de sintaxis: " + chk.stderr.strip()[-400:])
        problems += lint(js.read_text())
        if not problems or all("sintaxis" not in p for p in problems):
            problems += [e[:400] for e in run_gallery(a.name, a.params, rel, out_png) if "error" in e]
        if not problems:
            print(f"✓ {a.name}: sin errores tras {k} reparaciones → revisar {out_png}"); return
        print(f"✗ ronda {k}: " + " | ".join(problems)[:600])
        if k == a.repairs: break
        subprocess.run(gen + ["--tag", f"{a.tag}-fix{k + 1}", "--repair", "\n".join("- " + p for p in problems)], check=True)
    print(f"⚠ {a.name}: quedan problemas → revisar a mano ({out_png})")

if __name__ == "__main__":
    main()
