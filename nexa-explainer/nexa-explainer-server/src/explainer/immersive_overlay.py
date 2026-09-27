"""Full-bleed talking-head composition with transparent graphic overlays."""

from __future__ import annotations

import json

from src.explainer.models import CompositionSpec


def build_immersive_overlay_html(
    composition: CompositionSpec,
    *,
    video_src: str = "presenter.mp4",
    project_label: str = "NEXA EXPLAINER",
) -> str:
    """Keep the source video visible while floating information over the right side."""
    composition_json = json.dumps(composition.model_dump(mode="json"), ensure_ascii=False)
    return f'''<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{project_label}</title>
  <style>
    * {{ box-sizing:border-box; }}
    html,body {{ width:100%; height:100%; margin:0; overflow:hidden; background:#07101a; }}
    body {{ color:#f6f7fa; font-family:Inter, "Helvetica Neue", Arial, sans-serif; }}
    .immersive-stage {{ position:relative; width:100vw; height:100vh; overflow:hidden; background:#07101a; }}
    .immersive-presenter {{ position:absolute; inset:0; overflow:hidden; }}
    .immersive-presenter video {{ width:100%; height:100%; display:block; object-fit:cover; }}
    .immersive-presenter::after {{
      content:""; position:absolute; inset:0; pointer-events:none;
      background:
        linear-gradient(90deg, rgba(3,9,15,.02) 0%, rgba(3,9,15,.02) 42%, rgba(3,9,15,.2) 56%, rgba(3,9,15,.66) 78%, rgba(3,9,15,.86) 100%),
        linear-gradient(180deg, rgba(3,9,15,.3) 0%, transparent 24%, transparent 76%, rgba(3,9,15,.5) 100%);
    }}
    .immersive-grid {{ position:absolute; inset:0; pointer-events:none; background:linear-gradient(90deg, transparent 49.95%, rgba(246,247,250,.18) 50%, transparent 50.05%); opacity:.33; }}
    .immersive-topline {{ position:absolute; z-index:2; left:5.3vw; right:5.3vw; top:5.3vh; display:flex; align-items:center; justify-content:space-between; }}
    .immersive-brand {{ font:700 clamp(10px,.72vw,15px)/1 Inter,Arial,sans-serif; letter-spacing:.18em; }}
    .immersive-context {{ display:flex; align-items:center; gap:.8vw; color:rgba(246,247,250,.7); font-size:clamp(10px,.7vw,14px); letter-spacing:.08em; text-transform:uppercase; }}
    .immersive-context::before {{ content:""; display:block; width:30px; height:1px; background:#e2b65f; }}
    .immersive-copy {{ position:absolute; z-index:2; right:6vw; top:22%; width:min(37vw, 680px); }}
    .immersive-copy.fade {{ opacity:0; transform:translateY(12px); transition:opacity .35s ease, transform .35s ease; }}
    .immersive-copy.fade.visible {{ opacity:1; transform:none; }}
    .immersive-marker {{ width:42px; height:42px; display:grid; place-items:center; margin-bottom:3.3vh; border:1px solid rgba(226,182,95,.85); color:#e2b65f; }}
    .immersive-marker svg {{ width:54%; height:54%; fill:none; stroke:currentColor; stroke-width:1.7; stroke-linecap:round; stroke-linejoin:round; }}
    .immersive-eyebrow {{ color:#e2b65f; font-size:clamp(11px,.78vw,16px); font-weight:700; letter-spacing:.16em; text-transform:uppercase; margin-bottom:2.5vh; }}
    .immersive-copy h1 {{ max-width:9em; margin:0 0 2.1vh; color:#fff; font:600 clamp(34px,4.2vw,88px)/.94 "Space Grotesk",Inter,Arial,sans-serif; letter-spacing:-.065em; text-shadow:0 3px 24px rgba(0,0,0,.35); }}
    .immersive-body {{ max-width:28em; margin:0; color:rgba(255,255,255,.78); font-size:clamp(14px,1.12vw,24px); line-height:1.42; text-shadow:0 2px 16px rgba(0,0,0,.55); }}
    .immersive-highlight {{ display:block; max-width:25em; margin-top:3.6vh; padding-left:1vw; border-left:2px solid #e2b65f; color:#fff; font:600 clamp(17px,1.35vw,29px)/1.12 "Space Grotesk",Inter,Arial,sans-serif; text-shadow:0 2px 15px rgba(0,0,0,.6); }}
    .immersive-graphic {{ position:absolute; z-index:2; right:6vw; bottom:20%; width:min(31vw, 540px); }} .immersive-graphic.is-hidden {{ display:none; }}
    .immersive-graphic-label {{ margin-bottom:1.1vh; color:rgba(255,255,255,.58); font-size:clamp(9px,.62vw,13px); letter-spacing:.13em; text-transform:uppercase; }}
    .immersive-chart {{ display:flex; align-items:end; gap:.72vw; height:8vh; min-height:50px; padding:0 .2vw; border-bottom:1px solid rgba(255,255,255,.43); }}
    .immersive-chart i {{ flex:1; display:block; background:#e2b65f; opacity:.38; border-radius:2px 2px 0 0; }}
    .immersive-chart i:nth-child(1) {{ height:32%; }} .immersive-chart i:nth-child(2) {{ height:49%; opacity:.48; }} .immersive-chart i:nth-child(3) {{ height:41%; opacity:.56; }} .immersive-chart i:nth-child(4) {{ height:72%; opacity:.76; }} .immersive-chart i:nth-child(5) {{ height:100%; opacity:1; }}
    .immersive-footer {{ position:absolute; z-index:2; left:5.3vw; right:5.3vw; bottom:4.4vh; display:flex; align-items:center; gap:1vw; color:rgba(255,255,255,.62); font-size:clamp(10px,.68vw,14px); }}
    .immersive-progress-track {{ height:2px; flex:1; overflow:hidden; background:rgba(255,255,255,.28); }}
    .immersive-progress {{ display:block; width:0; height:100%; transform-origin:left; background:#e2b65f; }}
    .immersive-time {{ min-width:3.6em; text-align:right; font-variant-numeric:tabular-nums; }}
    @media (max-width: 850px) {{
      .immersive-copy {{ right:8vw; top:auto; bottom:23%; width:68vw; }}
      .immersive-copy h1 {{ font-size:clamp(31px,7vw,62px); }}
      .immersive-graphic {{ right:8vw; bottom:13%; width:42vw; }}
      .immersive-grid {{ background:linear-gradient(180deg, transparent 49.95%, rgba(246,247,250,.16) 50%, transparent 50.05%); }}
    }}
  </style>
</head>
<body>
  <main class="immersive-stage" data-template="immersive-overlay">
    <section class="immersive-presenter"><video id="presenter" src="{video_src}" autoplay muted playsinline preload="auto"></video></section>
    <div class="immersive-grid" aria-hidden="true"></div>
    <div class="immersive-topline"><span class="immersive-brand">{project_label}</span><span class="immersive-context">LIVE IDEA</span></div>
    <section id="copy" class="immersive-copy fade">
      <div class="immersive-marker" id="marker"></div>
      <div class="immersive-eyebrow" id="eyebrow">IDEA CLAVE</div>
      <h1 id="title">Preparando la composición</h1>
      <p class="immersive-body" id="body"></p>
      <div class="immersive-highlight" id="highlight"></div>
    </section>
    <div class="immersive-graphic" aria-label="Gráfico de apoyo"><div class="immersive-graphic-label" id="graphic-label">SINTESIS DE LA IDEA</div><div class="immersive-chart"><i></i><i></i><i></i><i></i><i></i></div></div>
    <footer class="immersive-footer"><span id="scene-count">01 / 01</span><div class="immersive-progress-track"><span id="progress" class="immersive-progress"></span></div><span id="time" class="immersive-time">00:00</span></footer>
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
        document.getElementById('graphic-label').textContent = String(s.kind || 'EXPLAINER').toUpperCase() + ' / EVIDENCIA';
        document.querySelector('.immersive-graphic').classList.toggle('is-hidden', !(s.kind === 'stat' && /\\d/.test(String(s.evidence || ''))));
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
