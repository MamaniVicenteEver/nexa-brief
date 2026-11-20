#!/usr/bin/env python3
"""Ensambla index.html autocontenido de lyrics-grunge-montage (solo lectura del repo).
Uso: python work/tools/build.py   (desde cualquier carpeta; usa el .venv del repo si lo necesita)
Lee work/tools/{spec.json,config.base.json,timeline.json}, player.js y el nucleo comun
(promo/compiler/build/core.js); escribe index.html y assets/config.json en el proyecto.
No toca el repo ni motores registrados."""
import json, os, pathlib, sys

PROJECT = pathlib.Path(__file__).resolve().parents[2]
CANDIDATES = [os.environ.get("NEXA_SERVER_ROOT", ""),
              str(pathlib.Path.home() / "Projects/Git-Projects/nexa-brief/nexa-brief/nexa-brief-server"),
              str(pathlib.Path.home() / "Documentos/Proyectos/nexa-brief/nexa-brief/nexa-brief-server")]
REPO = next(pathlib.Path(c) for c in CANDIDATES if c and (pathlib.Path(c) / "src/templates/_tools/hyperframes/optimize.py").exists())
CORE_OVERRIDE = os.environ.get("NEXA_CORE_JS")
TPL = REPO / "src" / "templates"
sys.path.insert(0, str(TPL / "_tools" / "hyperframes"))
import optimize as hf_optimize  # solo apply_clock (funcion pura)

CORE = pathlib.Path(CORE_OVERRIDE).read_text() if CORE_OVERRIDE else (TPL / "_tools/nodemotion/promo/compiler/build/core.js").read_text()
spec = json.loads((PROJECT / "work/tools/spec.json").read_text())
case = json.loads((PROJECT / "work/tools/config.base.json").read_text())
case["timeline"] = json.loads((PROJECT / "work/tools/timeline.json").read_text())
case["outroDesigns"] = json.loads((PROJECT / "work/tools/outros.json").read_text())
case["bgCuts"] = json.loads((PROJECT / "work/tools/cuts.json").read_text())   # cortes de toma medidos en la referencia (25 fps)
cfg = {"activeId": "default", "configs": [case]}
(PROJECT / "assets").mkdir(exist_ok=True)
(PROJECT / "assets/config.json").write_text(json.dumps(cfg, indent=1, ensure_ascii=False) + "\n")
if b'<meta name="nodemotion-design"' in (PROJECT / "index.html").read_bytes():
    print("demo registrada: solo se actualizó assets/config.json")
    sys.exit(0)
player = (PROJECT / "player.js").read_text()

BASE_CSS = """  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 100vw; height: 100vh; overflow: hidden; background: #000; cursor: pointer; }
  #stage { position: fixed; inset: 0; overflow: hidden; }
  .scene { position: absolute; left: 0; top: 0; overflow: hidden; }
  .lay { position: absolute; inset: 0; transform-origin: 50% 50%; }
  .grp { position: absolute; left: 0; top: 0; width: 0; height: 0; }
  .mbox { position: absolute; overflow: hidden; }
  .media { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
  .patch { position: absolute; pointer-events: none; }
  .grain { position: absolute; inset: 0; pointer-events: none; }
  .bx { position: absolute; left: 0; top: 0; white-space: nowrap; }
  .tx { display: inline-block; white-space: nowrap; line-height: 0.92; }
  .ch, .wd { display: inline-block; white-space: pre; }
  #hud { position: fixed; left: 8px; top: 8px; z-index: 50; display: none; padding: 6px 8px;
         font: 11px/1.4 ui-monospace, monospace; color: #0f0; background: rgba(0,0,0,0.7); pointer-events: none; }
  #hint { display: none !important; position: fixed; bottom: 6vh; width: 100vw; text-align: center; z-index: 8; font: 700 1.6vh system-ui, sans-serif;
          letter-spacing: 0.4em; color: #fff; opacity: 0.55; pointer-events: none; }
"""
html = f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{spec['title']}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="{case['fonts']['googleUrl']}" rel="stylesheet">
<style>
{BASE_CSS}{spec['css']}
  body.headless #hint {{ display: none !important; }}
</style>
</head>
<body>
<div id="stage"></div>
<div id="hud"></div>
<div id="hint" aria-hidden="true"></div>
<audio id="audio" preload="auto"></audio>

<script type="module">
/* {spec['title']} — {spec['about']} */
const NAME = "lyrics-grunge-montage";
const ACTIVE_ID = null;
const DEFAULT_CONFIG = {json.dumps(cfg, ensure_ascii=False)};
const FONT_LOADS = {json.dumps(spec['fontLoads'])};

{CORE}
{player}
boot();
</script>
</body>
</html>
"""
html = hf_optimize.apply_clock(html)
(PROJECT / "index.html").write_text(html)
print("ok index.html", len(html), "bytes;", len(case["timeline"]), "escenas")
