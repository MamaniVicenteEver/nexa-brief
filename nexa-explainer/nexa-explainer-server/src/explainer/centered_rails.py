"""Balanced 16:9 composition for a centered talking-head presenter.

The source video remains visible across the canvas while the speaker is given a
clear central focus zone. Editorial context, data points, and visual examples
occupy transparent rails on both sides; subtitles stay in a dedicated lower
safe zone so they do not compete with the presenter.
"""

from __future__ import annotations

import json

from src.explainer.models import CompositionSpec


def build_centered_rails_html(
    composition: CompositionSpec,
    *,
    video_src: str = "presenter.mp4",
    project_label: str = "NEXA EXPLAINER",
) -> str:
    """Build a self-contained 16:9 preview/render document."""
    composition_json = json.dumps(composition.model_dump(mode="json"), ensure_ascii=False)
    html = r'''<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>__PROJECT_LABEL__</title>
  <style>
    * { box-sizing:border-box; }
    html, body { width:100%; height:100%; margin:0; overflow:hidden; background:#081016; }
    body { color:#f4f7f8; font-family:Inter, "Helvetica Neue", Arial, sans-serif; }
    .centered-rails-stage { position:relative; width:100vw; height:100vh; overflow:hidden; background:#081016; }
    .source-video { position:absolute; inset:0; width:100%; height:100%; display:block; object-fit:cover; object-position:center; }
    .source-video::after { content:""; position:absolute; inset:0; }
    .stage-shade { position:absolute; inset:0; pointer-events:none; background:linear-gradient(90deg,rgba(4,11,16,.91) 0%,rgba(4,11,16,.62) 18%,rgba(4,11,16,.05) 31%,rgba(4,11,16,.04) 69%,rgba(4,11,16,.62) 82%,rgba(4,11,16,.91) 100%),linear-gradient(180deg,rgba(4,11,16,.65) 0%,transparent 22%,transparent 73%,rgba(4,11,16,.82) 100%); }
    .focus-zone { position:absolute; z-index:1; inset:0 23.5%; pointer-events:none; border-left:1px solid rgba(221,181,91,.32); border-right:1px solid rgba(221,181,91,.32); background:linear-gradient(90deg,rgba(5,12,18,.12),transparent 14%,transparent 86%,rgba(5,12,18,.12)); }
    .focus-zone::before { content:""; position:absolute; top:11%; bottom:17%; left:50%; width:1px; background:linear-gradient(180deg,transparent,rgba(255,255,255,.22) 22%,rgba(255,255,255,.22) 78%,transparent); opacity:.22; }
    .rail { position:absolute; z-index:3; top:0; bottom:0; width:21%; display:flex; flex-direction:column; justify-content:center; }
    .rail-left { left:4.8%; align-items:flex-start; }
    .rail-right { right:4.8%; align-items:flex-end; text-align:right; }
    .rail-index { margin-bottom:2.2vh; color:#ddb55b; font-size:clamp(10px,.68vw,14px); font-weight:700; letter-spacing:.18em; text-transform:uppercase; }
    .rail-rule { width:clamp(42px,4.7vw,92px); height:1px; margin-bottom:2.5vh; background:rgba(221,181,91,.76); }
    .rail-right .rail-rule { transform-origin:right; }
    .rail-title { max-width:9.2em; margin:0; color:#fff; font-family:"Space Grotesk",Inter,Arial,sans-serif; font-size:clamp(22px,2.15vw,48px); font-weight:600; line-height:.98; letter-spacing:-.055em; text-shadow:0 3px 18px rgba(0,0,0,.4); }
    .rail-body { max-width:20em; margin:2.2vh 0 0; color:rgba(235,242,244,.76); font-size:clamp(11px,.83vw,17px); line-height:1.38; text-shadow:0 2px 12px rgba(0,0,0,.55); }
    .rail-right .rail-title, .rail-right .rail-body { max-width:11em; }
    .rail-visual { width:min(100%,180px); margin-top:4.2vh; } .rail-visual.is-hidden { display:none; }
    .rail-right .rail-visual { margin-left:auto; }
    .visual-label { margin-bottom:1vh; color:rgba(235,242,244,.52); font-size:clamp(8px,.55vw,12px); letter-spacing:.16em; text-transform:uppercase; }
    .bar-chart { display:flex; align-items:flex-end; gap:6px; height:58px; border-bottom:1px solid rgba(255,255,255,.4); }
    .bar-chart i { display:block; flex:1; min-width:7px; height:20%; background:#ddb55b; transform-origin:bottom; opacity:.42; }
    .bar-chart i:nth-child(2) { height:42%; opacity:.54; }
    .bar-chart i:nth-child(3) { height:58%; opacity:.67; }
    .bar-chart i:nth-child(4) { height:78%; opacity:.82; }
    .bar-chart i:nth-child(5) { height:100%; opacity:1; }
    .rail-right .bar-chart { transform:scaleX(-1); }
    .rail-right .visual-label { text-align:right; }
    .topline { position:absolute; z-index:4; left:4.8%; right:4.8%; top:5.2%; display:flex; justify-content:space-between; align-items:center; color:rgba(244,247,248,.76); font-size:clamp(9px,.64vw,13px); letter-spacing:.15em; text-transform:uppercase; }
    .topline-brand { color:#fff; font-weight:700; }
    .topline-context { display:flex; align-items:center; gap:10px; }
    .topline-context::before { content:""; width:26px; height:1px; background:#ddb55b; }
    .subtitle-wrap { position:absolute; z-index:5; left:27%; right:27%; bottom:10.5%; display:flex; justify-content:center; pointer-events:none; }
    .subtitle { max-width:92%; margin:0; padding:0 1.1em .28em; color:#fff; font-size:clamp(16px,1.36vw,29px); font-weight:600; line-height:1.18; text-align:center; text-shadow:0 2px 3px #000,0 4px 22px rgba(0,0,0,.9); }
    .footer { position:absolute; z-index:5; left:4.8%; right:4.8%; bottom:4.6%; display:flex; align-items:center; gap:12px; color:rgba(244,247,248,.58); font-size:clamp(9px,.58vw,12px); letter-spacing:.08em; }
    .progress-track { height:2px; flex:1; overflow:hidden; background:rgba(255,255,255,.24); }
    .progress { display:block; width:0; height:100%; background:#ddb55b; transform-origin:left; }
    .footer-time { min-width:4em; text-align:right; font-variant-numeric:tabular-nums; }
    .scene-content { opacity:0; transform:translateY(13px); }
    .scene-content.is-visible { opacity:1; transform:none; transition:opacity .38s ease,transform .38s ease; }
    .rail-rule, .rail-visual { transition:transform .42s ease,opacity .42s ease; }
    .is-transitioning .rail-rule, .is-transitioning .rail-visual { opacity:.3; transform:translateY(8px) scaleX(.86); }
    @media (max-width:850px) {
      .stage-shade { background:linear-gradient(90deg,rgba(4,11,16,.74),rgba(4,11,16,.1) 32%,rgba(4,11,16,.1) 68%,rgba(4,11,16,.74)),linear-gradient(180deg,rgba(4,11,16,.68),transparent 22%,transparent 66%,rgba(4,11,16,.85)); }
      .focus-zone { inset:0 16%; }
      .rail { width:23%; }
      .rail-left { left:2.5%; }
      .rail-right { right:2.5%; }
      .rail-title { font-size:clamp(17px,3.2vw,28px); }
      .rail-body { font-size:clamp(9px,1.5vw,13px); }
      .subtitle-wrap { left:17%; right:17%; bottom:13%; }
      .subtitle { font-size:clamp(13px,2vw,20px); }
      .topline, .footer { left:2.5%; right:2.5%; }
    }
  </style>
</head>
<body>
  <main class="centered-rails-stage" data-template="centered-rails">
    <video id="presenter" class="source-video" src="__VIDEO_SRC__" autoplay muted playsinline preload="auto"></video>
    <div class="stage-shade" aria-hidden="true"></div>
    <div class="focus-zone" aria-hidden="true"></div>
    <header class="topline"><span class="topline-brand">__PROJECT_LABEL__</span><span class="topline-context">CENTRAL FRAME / 16:9</span></header>
    <aside class="rail rail-left">
      <div id="left-content" class="scene-content">
        <div class="rail-index" id="left-index">01 / CONTEXTO</div>
        <div class="rail-rule"></div>
        <h1 class="rail-title" id="left-title">La idea principal</h1>
        <p class="rail-body" id="left-body">Una explicación visual que acompaña al presentador sin taparlo.</p>
      </div>
    </aside>
    <aside class="rail rail-right">
      <div id="right-content" class="scene-content">
        <div class="rail-index" id="right-index">VISUAL / 01</div>
        <div class="rail-rule"></div>
        <p class="rail-body" id="right-body">El concepto aparece aquí como contexto, gráfico o ejemplo.</p>
        <div class="rail-visual"><div class="visual-label" id="visual-label">SEÑAL EDITORIAL</div><div class="bar-chart"><i></i><i></i><i></i><i></i><i></i></div></div>
      </div>
    </aside>
    <div class="subtitle-wrap" data-layout-allow-caption-zone="true"><p class="subtitle" id="subtitle"></p></div>
    <footer class="footer"><span id="scene-count">01 / 01</span><div class="progress-track"><span class="progress" id="progress"></span></div><span class="footer-time" id="time">00:00</span></footer>
  </main>
  <script>
    const SPEC = __COMPOSITION_JSON__;
    const video = document.getElementById('presenter');
    const scenes = SPEC.scenes || [];
    const stage = document.querySelector('.centered-rails-stage');
    const leftContent = document.getElementById('left-content');
    const rightContent = document.getElementById('right-content');
    let active = -1;
    const labels = { hook:'CONTEXTO', concept:'IDEA', stat:'DATO', quote:'CITA', step:'PASO', cta:'CIERRE' };
    const pad = value => String(Math.max(0, Math.floor(value))).padStart(2, '0');
    function renderScene(scene, index) {
      if (!scene) return;
      active = index;
      stage.classList.add('is-transitioning');
      leftContent.classList.remove('is-visible');
      rightContent.classList.remove('is-visible');
      window.setTimeout(() => {
        const label = labels[scene.kind] || 'IDEA';
        document.getElementById('left-index').textContent = `${String(index + 1).padStart(2, '0')} / ${label}`;
        document.getElementById('left-title').textContent = scene.title || 'Idea principal';
        document.getElementById('left-body').textContent = scene.body || '';
        document.getElementById('right-index').textContent = `VISUAL / ${String(index + 1).padStart(2, '0')}`;
        document.getElementById('right-body').textContent = scene.highlight || scene.body || '';
        document.getElementById('visual-label').textContent = `${label} / EVIDENCIA`;
        document.querySelector('.rail-visual').classList.toggle('is-hidden', !(scene.kind === 'stat' && /\\d/.test(String(scene.evidence || ''))));
        document.getElementById('subtitle').textContent = scene.body || scene.title || '';
        document.getElementById('scene-count').textContent = `${String(index + 1).padStart(2, '0')} / ${String(scenes.length).padStart(2, '0')}`;
        leftContent.classList.add('is-visible');
        rightContent.classList.add('is-visible');
        stage.classList.remove('is-transitioning');
      }, 110);
    }
    function tick() {
      const time = video.currentTime || 0;
      const total = video.duration || SPEC.duration || 1;
      const next = scenes.findIndex(scene => time >= scene.start && time < scene.end);
      if (next >= 0 && next !== active) renderScene(scenes[next], next);
      document.getElementById('progress').style.width = `${Math.min(100, time / total * 100)}%`;
      document.getElementById('time').textContent = `${pad(time / 60)}:${pad(time % 60)}`;
    }
    video.addEventListener('timeupdate', tick);
    video.addEventListener('loadedmetadata', tick);
    video.addEventListener('ended', () => { video.currentTime = 0; video.play(); });
    renderScene(scenes[0], 0);
    video.play().catch(() => {});
  </script>
</body>
</html>'''
    return (
        html.replace("__PROJECT_LABEL__", project_label)
        .replace("__VIDEO_SRC__", video_src)
        .replace("__COMPOSITION_JSON__", composition_json)
    )
