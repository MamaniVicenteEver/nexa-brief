"""Closed, deterministic visual system for presenter-side explainer videos.

No remote assets are required. Fonts use professional local fallbacks and icons are
inline SVG symbols so a final render never depends on a CDN or an emoji glyph.
"""

from __future__ import annotations

import json
from pathlib import Path

from src.explainer.adaptive_overlay import build_adaptive_overlay_html
from src.explainer.models import CompositionSpec, ExplainerTemplateId


_MANIFEST_PATH = Path(__file__).with_name("template-manifests.json")
_TEMPLATE_MANIFEST_DOCUMENT = json.loads(_MANIFEST_PATH.read_text(encoding="utf-8"))
TEMPLATE_CATALOG: list[dict] = _TEMPLATE_MANIFEST_DOCUMENT["templates"]
TEMPLATE_MANIFESTS: dict[str, dict] = {
    item["id"]: item["system"] for item in TEMPLATE_CATALOG
}
_SIDE_OVERLAY_POLICY = _TEMPLATE_MANIFEST_DOCUMENT["universal_side_overlay_policy"]

for _manifest in TEMPLATE_MANIFESTS.values():
    # Keep every established template contract intact. The semantic side overlay
    # is an additive capability that the planner may opt into when it fits the
    # selected template; it must never replace the template's layout, captions,
    # motion, components, or AI constraints.
    _manifest["extensions"] = {
        "semantic_overlay": {
            "visual_treatments": list(_SIDE_OVERLAY_POLICY["visual_treatments"]),
            "components": list(_SIDE_OVERLAY_POLICY["components"]),
            "motion": dict(_SIDE_OVERLAY_POLICY["motion"]),
            "rule": _SIDE_OVERLAY_POLICY["ai_rule"],
        }
    }


def get_template_manifest(template_id: ExplainerTemplateId | str) -> dict:
    """Return the closed visual contract used by the planner and the UI."""
    key = template_id.value if isinstance(template_id, ExplainerTemplateId) else template_id
    return TEMPLATE_MANIFESTS[key]


_THEME_CSS = {
    ExplainerTemplateId.EDITORIAL_SPLIT.value: """
      :root { --bg:#101828; --panel:#f4f0e9; --ink:#101828; --muted:#667085; --accent:#e5b75d; --line:rgba(16,24,40,.14); }
      .panel { background:var(--panel); color:var(--ink); }
      .eyebrow { color:#667085; } .marker { background:var(--accent); color:#101828; }
      .progress { background:var(--accent); }
    """,
    ExplainerTemplateId.DATA_BRIEF.value: """
      :root { --bg:#edf2f7; --panel:#fbfdff; --ink:#152536; --muted:#64748b; --accent:#2364aa; --line:#d6e0eb; }
      .panel { background:var(--panel); color:var(--ink); } .eyebrow { color:var(--accent); }
      .marker { background:#d9e9fb; color:var(--accent); } .progress { background:var(--accent); }
    """,
    ExplainerTemplateId.SIGNAL_MINIMAL.value: """
      :root { --bg:#090b0f; --panel:#0d1017; --ink:#f7f9fc; --muted:#8b96a8; --accent:#6c8cff; --line:rgba(255,255,255,.16); }
      .panel { background:var(--panel); color:var(--ink); } .eyebrow { color:#91a9ff; }
      .marker { background:var(--accent); color:#fff; } .progress { background:var(--accent); }
    """,
}


def build_explainer_html(
    composition: CompositionSpec,
    *,
    video_src: str = "presenter.mp4",
    project_label: str = "NEXA EXPLAINER",
) -> str:
    """Build the transcript-led render without changing the selected template contract."""
    return build_adaptive_overlay_html(
        composition,
        video_src=video_src,
        project_label=project_label,
    )
    composition_json = json.dumps(composition.model_dump(mode="json"), ensure_ascii=False)
    theme = _THEME_CSS[composition.template_id.value]
    is_data = composition.template_id == ExplainerTemplateId.DATA_BRIEF
    chart_html = '<div class="chart" aria-label="Visualización de tendencia"><i></i><i></i><i></i><i></i><i></i></div>' if is_data else ""
    return f'''<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{project_label}</title>
  <style>
    * {{ box-sizing:border-box; }} html,body {{ width:100%;height:100%;margin:0;overflow:hidden;background:#101828; }}
    :root {{ --bg:#101828; --panel:#f4f0e9; --ink:#101828; --muted:#667085; --accent:#e5b75d; --line:rgba(16,24,40,.14); }}
    {theme}
    body {{ font-family:Inter, "Helvetica Neue", Arial, sans-serif; }}
    .stage {{ position:relative; width:100vw;height:100vh;display:grid;grid-template-columns:50% 50%;background:var(--bg); }}
    .presenter {{ position:relative;overflow:hidden;background:#090b0f; }}
    .presenter video {{ width:100%;height:100%;object-fit:cover;display:block; }}
    .presenter::after {{ content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent 78%,rgba(0,0,0,.3));pointer-events:none; }}
    .panel {{ position:relative;padding:8.7vh 6.2vw 6vh 5.7vw;display:flex;flex-direction:column;justify-content:center;overflow:hidden; }}
    .topline {{ position:absolute;left:5.7vw;right:5.7vw;top:5.4vh;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--line);padding-bottom:1.3vh; }}
    .brand {{ font-size:clamp(10px, .75vw, 16px);letter-spacing:.16em;font-weight:700; }}
    .scene-count {{ font-size:clamp(10px, .72vw, 15px);color:var(--muted);font-variant-numeric:tabular-nums; }}
    .eyebrow {{ font-size:clamp(11px, .82vw, 17px);font-weight:700;letter-spacing:.13em;text-transform:uppercase;margin-bottom:2.4vh; }}
    .marker {{ width:clamp(34px,3vw,56px);height:clamp(34px,3vw,56px);border-radius:50%;display:grid;place-items:center;margin-bottom:2.8vh; }}
    .marker svg {{ width:52%;height:52%;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round; }}
    h1 {{ font-family:"Space Grotesk",Inter,Arial,sans-serif;font-size:clamp(31px,3.55vw,78px);line-height:.98;letter-spacing:-.055em;margin:0 0 2.5vh;max-width:8.4em; }}
    .body-copy {{ font-size:clamp(14px,1.12vw,24px);line-height:1.42;max-width:28em;color:var(--muted);margin:0; }}
    .highlight {{ display:inline-flex;margin-top:3.1vh;border-left:3px solid var(--accent);padding-left:1.1vw;font-family:"Space Grotesk",Inter,Arial,sans-serif;font-weight:700;font-size:clamp(18px,1.5vw,32px);line-height:1.1; }}
    .chart {{ height:11vh;min-height:65px;display:flex;align-items:end;gap:1.1vw;margin-top:4vh;max-width:26vw;border-bottom:1px solid var(--line);padding:0 .5vw; }} .chart.is-hidden {{ display:none; }}
    .chart i {{ flex:1;background:var(--accent);opacity:.35;border-radius:4px 4px 0 0; }} .chart i:nth-child(1){{height:35%}} .chart i:nth-child(2){{height:53%}} .chart i:nth-child(3){{height:46%}} .chart i:nth-child(4){{height:79%;opacity:.65}} .chart i:nth-child(5){{height:100%;opacity:1}}
    .footer {{ position:absolute;left:5.7vw;right:5.7vw;bottom:4.4vh;display:flex;align-items:center;gap:1vw;color:var(--muted);font-size:clamp(10px,.7vw,14px); }}
    .progress-track {{ height:3px;flex:1;background:var(--line);overflow:hidden; }} .progress {{ display:block;height:100%;width:0;transform-origin:left; }}
    .fade {{ opacity:0;transform:translateY(9px);transition:opacity .35s ease,transform .35s ease; }} .fade.visible {{ opacity:1;transform:none; }}
    @media (max-width: 850px) {{ .stage {{ grid-template-columns:1fr;grid-template-rows:52% 48%; }} .panel {{ padding:4vh 8vw; }} .topline,.footer {{ left:8vw;right:8vw; }} h1 {{ font-size:clamp(25px,7vw,50px); }} .body-copy {{ font-size:clamp(13px,2.5vw,18px); }} .chart {{ max-width:55vw; }} }}
  </style>
</head>
<body>
  <main class="stage" data-template="{composition.template_id.value}">
    <section class="presenter"><video id="presenter" src="{video_src}" autoplay muted playsinline preload="auto"></video></section>
    <section class="panel">
      <div class="topline"><span class="brand">{project_label}</span><span class="scene-count" id="scene-count">01 / 01</span></div>
      <div id="copy" class="fade">
        <div class="marker" id="marker"></div><div class="eyebrow" id="eyebrow">IDEA CLAVE</div>
        <h1 id="title">Preparando la composición</h1><p class="body-copy" id="body"></p><div class="highlight" id="highlight"></div>{chart_html}
      </div>
      <div class="footer"><span id="kind">EXPLAINER</span><div class="progress-track"><span class="progress" id="progress"></span></div><span id="time">00:00</span></div>
    </section>
  </main>
  <script>
    const SPEC = {composition_json};
    const video = document.getElementById('presenter');
    const scenes = SPEC.scenes || [];
    const copy = document.getElementById('copy');
    const icons = {{
      focus:'<svg viewBox="0 0 24 24"><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3"/><circle cx="12" cy="12" r="3"/></svg>',
      quote:'<svg viewBox="0 0 24 24"><path d="M6 17H3v-4a4 4 0 0 1 4-4h1v4H6v4Zm11 0h-3v-4a4 4 0 0 1 4-4h1v4h-2v4Z"/></svg>',
      chart:'<svg viewBox="0 0 24 24"><path d="M4 19V5M4 19h16"/><path d="m7 15 3-4 3 2 5-7"/></svg>',
      check:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="m8 12 2.5 2.5L16 9"/></svg>',
      arrow:'<svg viewBox="0 0 24 24"><path d="M5 12h13M13 6l6 6-6 6"/></svg>',
      layers:'<svg viewBox="0 0 24 24"><path d="m12 3 8 4-8 4-8-4 8-4Z"/><path d="m4 12 8 4 8-4M4 16l8 4 8-4"/></svg>'
    }};
    let active = -1;
    const label = s => ({{hook:'IDEA CLAVE',concept:'CONTEXTO',stat:'DATO',quote:'CITA',step:'PASO',cta:'SIGUIENTE'}}[s.kind] || 'EXPLAINER');
    const pad = n => String(Math.max(0,Math.floor(n))).padStart(2,'0');
    function renderScene(s, index) {{
      if (!s) return;
      active = index; copy.classList.remove('visible');
      setTimeout(() => {{
        document.getElementById('marker').innerHTML = icons[s.icon] || icons.layers;
        document.getElementById('eyebrow').textContent = label(s);
        document.getElementById('title').textContent = s.title || '';
        document.getElementById('body').textContent = s.body || '';
        document.getElementById('highlight').textContent = s.highlight || '';
        document.getElementById('kind').textContent = String(s.kind || 'EXPLAINER').toUpperCase();
        const chart = document.querySelector('.chart');
        if (chart) chart.classList.toggle('is-hidden', !(s.kind === 'stat' && /\\d/.test(String(s.evidence || ''))));
        document.getElementById('scene-count').textContent = String(index+1).padStart(2,'0') + ' / ' + String(scenes.length).padStart(2,'0');
        copy.classList.add('visible');
      }}, 90);
    }}
    function tick() {{
      const t = video.currentTime || 0; const total = video.duration || SPEC.duration || 1;
      const next = scenes.findIndex(s => t >= s.start && t < s.end);
      if (next >= 0 && next !== active) renderScene(scenes[next], next);
      document.getElementById('progress').style.width = Math.min(100, t / total * 100) + '%';
      document.getElementById('time').textContent = pad(t/60) + ':' + pad(t%60);
    }}
    video.addEventListener('timeupdate', tick); video.addEventListener('loadedmetadata', tick);
    video.addEventListener('ended', () => {{ video.currentTime = 0; video.play(); }});
    renderScene(scenes[0], 0); video.play().catch(() => {{}});
  </script>
</body>
</html>'''
