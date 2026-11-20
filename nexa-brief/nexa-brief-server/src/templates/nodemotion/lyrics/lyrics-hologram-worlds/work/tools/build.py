#!/usr/bin/env python3
"""Ensambla index.html autocontenido de lyrics-hologram-worlds (solo lectura del repo).
Uso (desde el repo, con el .venv): .venv/bin/python <proyecto>/work/tools/build.py
Lee work/tools/spec.json, work/tools/config.base.json y work/tools/timeline.json;
escribe index.html y assets/config.json en el proyecto. No toca el repo ni motores registrados."""
import json, pathlib, sys

PROJECT = pathlib.Path(__file__).resolve().parents[2]
REPO = next(p for p in pathlib.Path.home().glob("Projects/Git-Projects/nexa-brief/nexa-brief/nexa-brief-server"))
TPL = REPO / "src" / "templates"
sys.path.insert(0, str(TPL / "_tools" / "hyperframes"))
import optimize as hf_optimize  # solo apply_clock (función pura)

CORE = (TPL / "_tools/nodemotion/promo/compiler/build/core.js").read_text()
spec = json.loads((PROJECT / "work/tools/spec.json").read_text())
case = json.loads((PROJECT / "work/tools/config.base.json").read_text())
tl = json.loads((PROJECT / "work/tools/timeline.json").read_text())
case["timeline"] = tl
import struct
art = {}
for png in sorted((PROJECT / "assets/media/art").glob("*.png")) if (PROJECT / "assets/media/art").is_dir() else []:
    if png.stem.endswith("-raw"): continue
    w, h = struct.unpack(">II", png.read_bytes()[16:24])
    art[png.stem] = round(w / h, 4)
case["art"] = art
case["audio"]["src"] = "assets/song.mp3"
case["lyricsUrl"] = "assets/lyrics.json"
cfg = {"activeId": "default", "configs": [case]}
(PROJECT / "assets/config.json").write_text(json.dumps(cfg, indent=1, ensure_ascii=False) + "\n")
if b'<meta name="nodemotion-design"' in (PROJECT / "index.html").read_bytes():
    # Demo registrada: el motor vive en src/templates/_tools/nodemotion/lyrics/designs/lyrics-hologram-worlds/ y la
    # demo conserva una entrada fina. Solo cambian los datos (config.json con la línea de tiempo).
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
const NAME = "lyrics-hologram-worlds";
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
print("ok index.html", len(html), "bytes;", len(tl), "escenas")
