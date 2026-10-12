#!/usr/bin/env python3
"""Arma las plantillas promo-* de commercial/: HTML autocontenido
 (núcleo común core.js + escenas <x>.js) + assets/config.json (desde el spec,
con las variantes pre-gradadas de grade_media.py) + assets/lyrics.json
(guion). Los HTML generados NO se editan a mano: se edita acá y se regenera.
Sin panel de grabación: la grabación se centralizó en la app. Las que salen en
lyrics/ pasan además por _tools/hyperframes/optimize.py (reloj HyperFrames), así
regenerar no pierde la optimización.
Uso: python3 tools/build/build.py promo-trendy promo-dynamic promo-urban promo-sports"""
import json, sys, pathlib

HERE = pathlib.Path(__file__).resolve().parent       # _tools/commercial/build
TOOL_ROOT = HERE.parent                               # _tools/commercial
TPL = HERE.parents[2]                                 # src/templates/
OUT = TPL / "nodemotion" / "commercial"
CORE = (HERE / "core.js").read_text()
sys.path.insert(0, str(TPL / "_tools" / "hyperframes")); import optimize as hf_optimize

MEDIA = [
    {"id": "basket", "type": "video", "src": "assets/media/basketball.mp4", "poster": "assets/media/basketball-1.jpg"},
    {"id": "sprint", "type": "video", "src": "assets/media/sprinter.mp4", "poster": "assets/media/sprinter-1.jpg"},
    {"id": "boxing", "type": "video", "src": "assets/media/boxing.mp4", "poster": "assets/media/boxing-1.jpg"},
    {"id": "skate", "type": "video", "src": "assets/media/skate.mp4", "poster": "assets/media/skate-1.jpg"},
    {"id": "ropes", "type": "video", "src": "assets/media/battle-ropes.mp4", "poster": "assets/media/battle-ropes-1.jpg"},
    {"id": "soccer", "type": "video", "src": "assets/media/soccer.mp4", "poster": "assets/media/soccer-1.jpg"},
] + [
    {"id": f"{n}-{k}", "type": "image", "src": f"assets/media/{f}-{k}.jpg"}
    for n, f in [("basket", "basketball"), ("sprint", "sprinter"), ("boxing", "boxing"), ("skate", "skate"), ("ropes", "battle-ropes"), ("soccer", "soccer")]
    for k in (1, 2)
]

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

def build(name):
    """spec opcional: "out" (carpeta de plantilla, def. nodemotion/commercial/<name>), "html"
    (def. index.html), "configPath" (def. assets/config.json), "js"
    (archivo de escenas), "script" (guion → lyricsPath; sin script se conserva
    el lyrics.json existente, p.ej. la transcripción de Whisper)."""
    # el spec puede vivir en cualquier _tools/<familia>/build/ (commercial, lyrics-*);
    # el archivo de escenas se busca junto al spec y, si no, junto a este script
    cands = [HERE / f"{name}.spec.json"] + sorted(TPL.glob(f"_tools/*/build/{name}.spec.json"))
    spec_file = next(c for c in cands if c.exists())
    spec = json.loads(spec_file.read_text())
    out = TPL / spec.get("out", f"nodemotion/commercial/{name}")
    js_name = spec.get("js", name.split('-')[1] + ".js")
    names = js_name if isinstance(js_name, list) else [js_name]   # varios archivos de escenas → se concatenan
    js = "\n".join(next(p for p in (spec_file.parent / n, HERE / n, TPL / "_tools" / n) if p.exists()).read_text() for n in names)
    case = spec["config"]
    case["audio"]["src"] = "assets/song.mp3"
    case["lyricsUrl"] = "assets/lyrics.json"
    case.setdefault("media", MEDIA)
    cfg = {"activeId": "default", "configs": [case]}
    out.mkdir(parents=True, exist_ok=True)
    cfg_path = out / spec.get("configPath", "assets/config.json")
    cfg_path.parent.mkdir(parents=True, exist_ok=True)
    cfg_path.write_text(json.dumps(cfg, indent=2, ensure_ascii=False) + "\n")
    # variantes pre-gradadas (tools/grade_media.py) → el config queda con media[].graded
    sys.path.insert(0, str(TOOL_ROOT)); import grade_media
    cfg = grade_media.grade_config(cfg_path)
    segs = []
    for i, s in enumerate(spec.get("script", [])):
        words, t = [], s["words_at"]
        toks = " ".join(s["lines"]).split()
        for k, w in enumerate(toks):
            st = t[k] if k < len(t) else t[-1]
            words.append({"word": " " + w, "start": round(st, 2), "end": round(st + 0.3, 2), "probability": 1.0})
        seg = {"id": i + 1, "start": s["start"], "end": s.get("end", s["start"] + 1), "text": " " + " ".join(toks), "lines": s["lines"], "words": words}
        if s.get("sub"): seg["sub"] = s["sub"]
        segs.append(seg)
    lyr = {"metadata": {"kind": "guion", "note": "Guion de la plantilla (formato Whisper): un segmento = una escena. 'lines' parte el texto en renglones.",
                        "audio_duration_sec": spec.get("duration")}, "segments": segs}
    if spec.get("script"):
        lyrics_path = out / spec.get("lyricsPath", "assets/lyrics.json")
        lyrics_path.parent.mkdir(parents=True, exist_ok=True)
        lyrics_path.write_text(json.dumps(lyr, indent=2, ensure_ascii=False) + "\n")
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
const NAME = "{name}";
const ACTIVE_ID = null;   /* <-- forzar un id · null = usa "activeId" del JSON */
const DEFAULT_CONFIG = {json.dumps(cfg, ensure_ascii=False)};
const FONT_LOADS = {json.dumps(spec['fontLoads'])};

{CORE}
{js}
boot();
</script>
</body>
</html>
"""
    if hf_optimize.template_kind(out.relative_to(TPL).as_posix()) in hf_optimize.HF_CATEGORIES:
        html = hf_optimize.apply_clock(html)
    (out / spec.get("html", "index.html")).write_text(html)
    print("ok", name, len(html))

for n in sys.argv[1:]: build(n)
