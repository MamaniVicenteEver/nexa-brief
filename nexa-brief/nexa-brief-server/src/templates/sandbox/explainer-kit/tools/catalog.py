#!/usr/bin/env python3
"""Genera CATALOG.md (el "index" de componentes) desde el registro vivo del kit.

Abre showcase/stage.html?list=1 en Chromium, lee Kit.catalog() (nombre, resumen, params con
tipo/default/doc, ejemplo) y la lista de iconos/bocetos, y escribe CATALOG.md + catalog.json.
Así la documentación sale del código y no se desactualiza: se corre después de agregar
o cambiar un componente.

Uso (desde nexa-brief-server/):  .venv/bin/python src/templates/sandbox/explainer-kit/tools/catalog.py
"""
import asyncio, json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import shoot  # noqa: E402  (reusa su servidor HTTP)

KIT = pathlib.Path(__file__).resolve().parents[1]

async def read():
    from playwright.async_api import async_playwright
    srv = shoot.serve(KIT.parent)
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page()
        await pg.goto(f"http://127.0.0.1:{srv.server_port}/explainer-kit/showcase/stage.html?list=1", wait_until="domcontentloaded", timeout=120000)
        await pg.wait_for_function("window.__catalog", timeout=60000)
        data = await pg.evaluate("({ comps: window.__catalog, icons: Object.keys(Kit.binary.ICONS), sketches: Object.keys(Kit.rough.SKETCHES) })")
        await b.close()
    srv.shutdown()
    return data

def md(data):
    fams = {"common": "Comunes (cualquier familia)"}
    showcase_ids = json.loads((KIT / "showcase" / "designs.json").read_text())["designs"]
    for design_id in showcase_ids:
        design = json.loads((KIT / "designs" / design_id / "design.json").read_text())
        fam = design.get("family", design_id)
        fams[fam] = f"{fam} · {design.get('name', design_id)}"
    out = ["# Catálogo de componentes del explainer-kit", "",
           "> GENERADO por `tools/catalog.py` desde el registro (`Kit.register`). No editar a mano.",
           "> Cada componente se usa en `storyboard.json` como `{ \"at\": \"palabras ancla\", \"use\": \"nombre\", \"params\": {…} }`.",
           "> Los parámetros numéricos aceptan `\"@palabra\"` = segundos desde el inicio del beat hasta que la voz dice esa palabra.", ""]
    out.append("| componente | capa | para qué |"); out.append("|---|---|---|")
    for c in data["comps"]: out.append(f"| `{c['name']}` | {c['layer']} | {c['summary']} |")
    out.append("")
    for fam, title in fams.items():
        cs = [c for c in data["comps"] if c["name"].split(".")[0] == fam]
        if not cs: continue
        out += [f"## {title}", ""]
        for c in cs:
            out += [f"### `{c['name']}`", "", c["summary"], "", f"Etiquetas: {', '.join(c['tags'])} · capa: {c['layer']}", "",
                    "| parámetro | tipo | por defecto | qué hace |", "|---|---|---|---|"]
            for k, s in c["params"].items():
                typ = s["type"] + (f" ({' / '.join(map(str, s['options']))})" if s.get("options") else "") + (" · obligatorio" if s.get("required") else "")
                rng = f" [{s.get('min')}–{s.get('max')}]" if s.get("min") is not None or s.get("max") is not None else ""
                out.append(f"| `{k}` | {typ}{rng} | `{json.dumps(s.get('default'), ensure_ascii=False)}` | {s.get('doc') or ''} |")
            if c.get("example"): out += ["", "```json", json.dumps({"use": c["name"], "params": c["example"]}, ensure_ascii=False), "```"]
            out.append("")
    out += ["## Iconos de la familia binary (`icon`)", "", " · ".join(f"`{n}`" for n in data["icons"]), "",
            "## Bocetos de la familia rough (`icon`)", "", " · ".join(f"`{n}`" for n in data["sketches"]), ""]
    return "\n".join(out)

def main():
    data = asyncio.run(read())
    (KIT / "catalog.json").write_text(json.dumps(data, ensure_ascii=False, indent=1))
    (KIT / "CATALOG.md").write_text(md(data))
    print(f"✓ CATALOG.md: {len(data['comps'])} componentes, {len(data['icons'])} iconos, {len(data['sketches'])} bocetos")

if __name__ == "__main__":
    main()
