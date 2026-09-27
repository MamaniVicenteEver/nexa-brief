"""Transcript-led side composition renderer for every Nexa Explainer template."""

from __future__ import annotations

import json

from src.explainer.models import CompositionSpec
from src.explainer.spatial_orbit import build_spatial_orbit_html


def build_adaptive_overlay_html(
    composition: CompositionSpec,
    *,
    video_src: str = "presenter.mp4",
    project_label: str = "NEXA EXPLAINER",
) -> str:
    """Render a person on the left and one semantic visual on the right.

    The right side is intentionally silent when a spoken beat has no visual
    reason to exist. There is no brand lockup, subtitle rail, scene count,
    progress bar or generic information card in the exported composition.
    """
    if composition.template_id.value == "spatial-orbit":
        return build_spatial_orbit_html(composition, video_src=video_src)

    del project_label
    spec = json.dumps(composition.model_dump(mode="json"), ensure_ascii=False)
    template = composition.template_id.value
    return f'''<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Video explicativo</title>
  <style>
    * {{ box-sizing:border-box; }}
    html,body {{ width:100%;height:100%;margin:0;overflow:hidden;background:#0c1016; }}
    body {{ color:#f5f7fa;font-family:Inter,"Helvetica Neue",Arial,sans-serif; }}
    .semantic-stage {{ --accent:#d8b46a; --surface:#111923; position:relative;width:100vw;height:100vh;overflow:hidden;background:var(--surface); }}
    .semantic-presenter {{ position:absolute;inset:0 auto 0 0;width:51.5%;overflow:hidden;background:#080b10; }}
    .semantic-video {{ width:100%;height:100%;display:block;object-fit:cover;object-position:left center; }}
    .semantic-presenter::after {{ position:absolute;inset:0;content:"";pointer-events:none;background:linear-gradient(90deg,transparent 58%,#111923 100%); }}
    .semantic-side {{ position:absolute;inset:0 5.5vw 0 57%;z-index:2;display:flex;align-items:center;pointer-events:none; }}
    .semantic-visual {{ display:grid;gap:1.6vh;width:min(31vw,590px);opacity:1;transform:translate3d(0,0,0);transition:opacity .26s ease,transform .26s cubic-bezier(.2,.75,.2,1); }}
    .semantic-visual.is-hidden {{ opacity:0;transform:translate3d(0,14px,0); }}
    .semantic-icon {{ display:grid;width:clamp(46px,4.6vw,86px);height:clamp(46px,4.6vw,86px);place-items:center;color:var(--accent); }}
    .semantic-icon svg {{ width:100%;height:100%;fill:none;stroke:currentColor;stroke-width:1.45;stroke-linecap:round;stroke-linejoin:round;overflow:visible; }}
    .semantic-word {{ max-width:9.5em;margin:0;color:#f5f7fa;font:600 clamp(42px,4.6vw,92px)/.92 "Space Grotesk",Inter,Arial,sans-serif;letter-spacing:-.066em;text-wrap:balance; }}
    .semantic-detail {{ max-width:29em;color:rgba(245,247,250,.68);font-size:clamp(13px,1vw,20px);line-height:1.35; }}
    .semantic-visual[data-treatment="action"] .semantic-icon {{ transform:translateX(-8px); }}
    .semantic-visual[data-treatment="money"] .semantic-icon {{ width:clamp(66px,6.5vw,118px);height:clamp(66px,6.5vw,118px); }}
    .semantic-visual[data-treatment="money"] .semantic-word {{ font-size:clamp(52px,5.8vw,118px); }}
    .semantic-visual[data-treatment="change"] .semantic-word {{ font-size:clamp(58px,6.4vw,126px);letter-spacing:-.085em; }}
    .semantic-visual[data-treatment="process"] .semantic-word {{ font-size:clamp(32px,3.2vw,66px);line-height:.98; }}
    .semantic-visual[data-treatment="quote"] .semantic-word {{ font-size:clamp(33px,3.5vw,70px);line-height:1.02; }}
    .semantic-visual[data-treatment="data"] .semantic-word {{ font-variant-numeric:tabular-nums;font-size:clamp(58px,6vw,120px); }}
    .semantic-stage[data-template="data-brief"] {{ --accent:#5b9de1; --surface:#101923; }}
    .semantic-stage[data-template="signal-minimal"] {{ --accent:#8eabff; --surface:#0a0d12; }}
    .semantic-stage[data-template="immersive-overlay"] {{ --accent:#d5e4f5; --surface:#111921; }}
    .semantic-stage[data-template="centered-rails"] {{ --accent:#95d8cf; --surface:#111a22; }}
    .semantic-stage[data-template="kinetic-voice"] {{ --accent:#f05a47; --surface:#13151a; }}
    .semantic-stage[data-template="field-notes"] {{ --accent:#d88663; --surface:#1c2a23; }}
    .semantic-stage[data-template="product-signal"] {{ --accent:#b7ec70; --surface:#171c39; }}
    .semantic-stage[data-template="systems-map"] {{ --accent:#63cdbf; --surface:#121a22; }}
    /* Preserve each established template's composition personality. The semantic
       visual is an additive layer; it does not force every template into one layout. */
    .semantic-stage[data-template="signal-minimal"] .semantic-presenter,
    .semantic-stage[data-template="kinetic-voice"] .semantic-presenter {{ left:auto;right:0; }}
    .semantic-stage[data-template="signal-minimal"] .semantic-presenter::after,
    .semantic-stage[data-template="kinetic-voice"] .semantic-presenter::after {{ background:linear-gradient(270deg,transparent 58%,var(--surface) 100%); }}
    .semantic-stage[data-template="signal-minimal"] .semantic-side,
    .semantic-stage[data-template="kinetic-voice"] .semantic-side {{ right:57%;left:5.5vw; }}
    .semantic-stage[data-template="immersive-overlay"] .semantic-presenter {{ width:100%; }}
    .semantic-stage[data-template="immersive-overlay"] .semantic-presenter::after {{ background:linear-gradient(90deg,transparent 42%,rgba(7,16,26,.38) 100%); }}
    .semantic-stage[data-template="centered-rails"] .semantic-presenter,
    .semantic-stage[data-template="systems-map"] .semantic-presenter {{ left:34%;width:32%; }}
    .semantic-stage[data-template="centered-rails"] .semantic-video,
    .semantic-stage[data-template="systems-map"] .semantic-video {{ object-position:center center; }}
    .semantic-stage[data-template="centered-rails"] .semantic-side,
    .semantic-stage[data-template="systems-map"] .semantic-side {{ left:57%; }}
    .semantic-stage[data-template="field-notes"] .semantic-presenter {{ width:56%; }}
    .semantic-stage[data-template="field-notes"] .semantic-presenter::after {{ background:linear-gradient(90deg,transparent 50%,var(--surface) 100%); }}
    .semantic-stage[data-template="product-signal"] .semantic-presenter {{ width:48%; }}
    @media (max-width:850px) {{
      .semantic-presenter {{ width:49%; }} .semantic-side {{ right:4vw;left:54%; }}
      .semantic-word {{ font-size:clamp(28px,5.2vw,48px); }} .semantic-detail {{ font-size:clamp(11px,1.7vw,15px); }}
      .semantic-visual[data-treatment="money"] .semantic-word,.semantic-visual[data-treatment="change"] .semantic-word,.semantic-visual[data-treatment="data"] .semantic-word {{ font-size:clamp(36px,6.2vw,58px); }}
    }}
  </style>
</head>
<body>
  <main class="semantic-stage" data-template="{template}">
    <section class="semantic-presenter" aria-label="Video del presentador">
      <video id="presenter" class="semantic-video" src="{video_src}" autoplay muted playsinline preload="auto"></video>
    </section>
    <section class="semantic-side" aria-live="polite">
      <div id="semantic-visual" class="semantic-visual is-hidden" data-treatment="none">
        <span id="semantic-icon" class="semantic-icon" aria-hidden="true"></span>
        <strong id="semantic-word" class="semantic-word"></strong>
        <span id="semantic-detail" class="semantic-detail"></span>
      </div>
    </section>
  </main>
  <script>
    const SPEC = {spec};
    const video = document.getElementById('presenter');
    const scenes = SPEC.scenes || [];
    const visual = document.getElementById('semantic-visual');
    const icon = document.getElementById('semantic-icon');
    const word = document.getElementById('semantic-word');
    const detail = document.getElementById('semantic-detail');
    const ICONS = {{
      title:'<svg viewBox="0 0 120 120"><path d="M20 28h80M20 60h55M20 92h38"/><path d="M87 57l13 3-13 3"/></svg>',
      action:'<svg viewBox="0 0 120 120"><path d="M22 60h66"/><path d="m68 36 28 24-28 24"/><circle cx="28" cy="60" r="8"/></svg>',
      money:'<svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="43"/><path d="M70 42c-5-5-13-7-20-4-13 6-10 20 4 23 16 4 17 18 4 24-8 4-17 1-23-5M60 32v56"/></svg>',
      change:'<svg viewBox="0 0 120 120"><path d="M24 84 52 56l17 17 29-34"/><path d="M80 39h18v18"/></svg>',
      process:'<svg viewBox="0 0 120 120"><circle cx="25" cy="60" r="11"/><circle cx="60" cy="60" r="11"/><circle cx="95" cy="60" r="11"/><path d="M36 60h13M71 60h13"/></svg>',
      quote:'<svg viewBox="0 0 120 120"><path d="M24 76V57c0-13 8-23 24-25v16c-7 1-10 5-10 11h12v17H24Zm46 0V57c0-13 8-23 24-25v16c-7 1-10 5-10 11h12v17H70Z"/></svg>',
      data:'<svg viewBox="0 0 120 120"><path d="M22 96V24M22 96h76"/><path d="M35 82V61M57 82V47M79 82V32"/></svg>'
    }};
    let active = -1;
    function visualCopy(scene) {{
      const treatment = scene.visual_treatment || 'none';
      const text = treatment === 'data' || treatment === 'money'
        ? (scene.evidence || scene.highlight || scene.title)
        : (scene.highlight || scene.title);
      const supporting = treatment === 'quote' ? scene.body : (scene.title !== text ? scene.title : '');
      return {{ treatment, text, supporting }};
    }}
    function renderScene(scene, index) {{
      if (!scene) return;
      active = index;
      const next = visualCopy(scene);
      visual.classList.add('is-hidden');
      window.setTimeout(() => {{
        visual.dataset.treatment = next.treatment;
        icon.innerHTML = next.treatment === 'none' ? '' : (ICONS[next.treatment] || ICONS.title);
        word.textContent = next.text || '';
        detail.textContent = next.supporting || '';
        visual.classList.toggle('is-hidden', next.treatment === 'none');
      }}, 110);
    }}
    function tick() {{
      const time = video.currentTime || 0;
      const next = scenes.findIndex(scene => time >= scene.start && time < scene.end);
      if (next >= 0 && next !== active) renderScene(scenes[next], next);
    }}
    video.addEventListener('timeupdate', tick);
    video.addEventListener('loadedmetadata', tick);
    video.addEventListener('ended', () => {{ video.currentTime = 0; video.play(); }});
    renderScene(scenes[0], 0);
    video.play().catch(() => {{}});
  </script>
</body>
</html>'''
