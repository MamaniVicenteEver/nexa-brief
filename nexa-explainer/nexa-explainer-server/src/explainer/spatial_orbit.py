"""Three.js/WebGL renderer for the additive Spatial Orbit template."""

from __future__ import annotations

import json

from src.explainer.models import CompositionSpec


def build_spatial_orbit_html(
    composition: CompositionSpec,
    *,
    video_src: str = "presenter.mp4",
) -> str:
    """Render a deterministic 16:9 talking-head composition with a Three.js scene.

    The video stays visible on the left. The WebGL layer is driven only by the
    current media time or HyperFrames seek events, so a renderer can request any
    frame without depending on a free-running animation clock.
    """

    spec = json.dumps(composition.model_dump(mode="json"), ensure_ascii=False)
    return _HTML.replace("__SPEC__", spec).replace("__VIDEO_SRC__", json.dumps(video_src))


_HTML = r'''<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Spatial Orbit</title>
  <style>
    * { box-sizing:border-box; }
    html,body { width:100%;height:100%;margin:0;overflow:hidden;background:#071019; }
    body { color:#eaf4f5;font-family:Inter,"Helvetica Neue",Arial,sans-serif; }
    .spatial-stage { position:relative;width:100vw;height:100vh;overflow:hidden;background:radial-gradient(circle at 74% 50%,rgba(69,214,208,.2),transparent 30%),linear-gradient(105deg,#071019 0%,#0a1b25 52%,#071019 100%); }
    .spatial-presenter { position:absolute;inset:0 auto 0 0;width:42%;overflow:hidden;background:#071019; }
    .spatial-video { width:100%;height:100%;display:block;object-fit:cover;object-position:center center; }
    .spatial-presenter::after { position:absolute;inset:0;content:"";pointer-events:none;background:linear-gradient(90deg,transparent 48%,#071019 100%); }
    .spatial-canvas { position:absolute;inset:0 0 0 30%;z-index:1;width:70%;height:100%;display:block; }
    .spatial-copy { position:absolute;top:14%;left:47%;z-index:3;display:grid;gap:1.1vh;width:min(29vw,550px);pointer-events:none; }
    .spatial-kicker { display:flex;gap:10px;align-items:center;color:#45d6d0;font:700 clamp(11px,1vw,17px)/1 Inter,Arial,sans-serif;letter-spacing:.16em;text-transform:uppercase; }
    .spatial-kicker::before { width:26px;height:1px;background:#45d6d0;content:""; }
    .spatial-word { max-width:10em;margin:0;color:#eaf4f5;font:600 clamp(38px,4.8vw,92px)/.92 "Space Grotesk",Inter,Arial,sans-serif;letter-spacing:-.07em;text-wrap:balance; }
    .spatial-detail { max-width:26em;color:rgba(234,244,245,.68);font-size:clamp(13px,1vw,20px);line-height:1.36; }
    .spatial-metric { color:#b5f36a;font:600 clamp(50px,5.8vw,112px)/.9 "Space Grotesk",Inter,Arial,sans-serif;letter-spacing:-.08em; }
    .spatial-engine { position:absolute;right:5.5vw;bottom:5.5vh;z-index:3;color:rgba(234,244,245,.46);font:700 10px/1 Inter,Arial,sans-serif;letter-spacing:.16em; }
    .spatial-fallback { position:absolute;right:14%;top:50%;z-index:2;display:grid;gap:12px;transform:translateY(-50%);pointer-events:none; }
    .spatial-fallback span { display:block;width:8px;height:8px;border:1px solid #45d6d0;border-radius:50%;opacity:.5; }
    .spatial-fallback span:nth-child(2) { transform:translate(-45px,-33px); }
    .spatial-fallback span:nth-child(3) { transform:translate(42px,28px); }
    .spatial-fallback span:nth-child(4) { transform:translate(72px,-15px); }
    .spatial-fallback.is-hidden { display:none; }
    @media (max-width:850px) { .spatial-presenter { width:46%; } .spatial-canvas { left:28%;width:72%; } .spatial-copy { left:46%;width:43vw; } .spatial-word { font-size:clamp(30px,6vw,56px); } .spatial-detail { font-size:clamp(11px,1.8vw,16px); } }
  </style>
  <script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.181.2/build/three.module.js"}}</script>
</head>
<body>
  <main class="spatial-stage" data-template="spatial-orbit">
    <section class="spatial-presenter" aria-label="Video del presentador">
      <video id="presenter" class="spatial-video" src="__VIDEO_SRC__" autoplay muted playsinline preload="auto"></video>
    </section>
    <canvas id="spatial-canvas" class="spatial-canvas" aria-hidden="true"></canvas>
    <div id="spatial-fallback" class="spatial-fallback" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
    <section class="spatial-copy" aria-live="polite">
      <span id="spatial-kicker" class="spatial-kicker"></span>
      <strong id="spatial-word" class="spatial-word"></strong>
      <span id="spatial-detail" class="spatial-detail"></span>
      <span id="spatial-metric" class="spatial-metric"></span>
    </section>
    <span class="spatial-engine">THREE.JS / WEBGL · SEEK SAFE</span>
  </main>
  <script>
    const SPEC = __SPEC__;
    const video = document.getElementById('presenter');
    const scenes = SPEC.scenes || [];
    const kicker = document.getElementById('spatial-kicker');
    const word = document.getElementById('spatial-word');
    const detail = document.getElementById('spatial-detail');
    const metric = document.getElementById('spatial-metric');
    let active = -1;
    function sceneAt(time) {
      return scenes.findIndex((scene) => time >= scene.start && time < scene.end);
    }
    function renderSemantic(time) {
      const index = sceneAt(time);
      if (index < 0 || index === active) return;
      active = index;
      const scene = scenes[index];
      kicker.textContent = scene.label || 'ORBITA';
      word.textContent = scene.highlight || scene.title || '';
      detail.textContent = scene.body || scene.title || '';
      metric.textContent = scene.evidence || scene.highlight || '';
    }
    video.addEventListener('timeupdate', () => renderSemantic(video.currentTime || 0));
    video.addEventListener('loadedmetadata', () => renderSemantic(video.currentTime || 0));
    video.addEventListener('ended', () => { video.currentTime = 0; video.play().catch(() => {}); });
    renderSemantic(0);
    video.play().catch(() => {});
  </script>
  <script type="module">
    const fallback = document.getElementById('spatial-fallback');
    const canvas = document.getElementById('spatial-canvas');
    const video = document.getElementById('presenter');
    try {
      const THREE = await import('three');
      const renderer = new THREE.WebGLRenderer({ canvas, alpha:true, antialias:true });
      renderer.setPixelRatio(1);
      renderer.setClearColor(0x000000, 0);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.1, 100);
      const orbit = new THREE.Group();
      scene.add(orbit);
      const ringMaterial = new THREE.MeshBasicMaterial({ color:0x45d6d0, transparent:true, opacity:.26 });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2.15, .012, 8, 112), ringMaterial);
      ring.rotation.x = Math.PI * .18;
      orbit.add(ring);
      const ringTwo = new THREE.Mesh(new THREE.TorusGeometry(1.52, .008, 8, 112), ringMaterial.clone());
      ringTwo.rotation.x = Math.PI * .64;
      ringTwo.rotation.z = Math.PI * .2;
      orbit.add(ringTwo);
      const core = new THREE.Mesh(new THREE.IcosahedronGeometry(.34, 1), new THREE.MeshBasicMaterial({ color:0xeaf4f5, transparent:true, opacity:.9, wireframe:true }));
      orbit.add(core);
      const nodes = [];
      const links = [];
      for (let index = 0; index < 4; index += 1) {
        const node = new THREE.Mesh(new THREE.SphereGeometry(index === 0 ? .16 : .12, 16, 12), new THREE.MeshBasicMaterial({ color:0x45d6d0, transparent:true, opacity:.55 }));
        const angle = (index / 4) * Math.PI * 2;
        node.position.set(Math.cos(angle) * 2.02, Math.sin(angle) * .74, Math.sin(angle) * .88);
        orbit.add(node);
        nodes.push(node);
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), node.position.clone()]), new THREE.LineBasicMaterial({ color:0x45d6d0, transparent:true, opacity:.18 }));
        orbit.add(line);
        links.push(line);
      }
      function resize() {
        const width = Math.max(1, canvas.clientWidth);
        const height = Math.max(1, canvas.clientHeight);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }
      function renderAt(time) {
        const progress = Math.max(0, Math.min(30, Number(time) || 0)) / 30;
        orbit.rotation.y = progress * Math.PI * 1.65;
        orbit.rotation.x = Math.sin(progress * Math.PI * 2) * .12;
        camera.position.set(Math.sin(progress * Math.PI * 1.4) * .3, .05, 6.7 - Math.sin(progress * Math.PI) * .38);
        camera.lookAt(0,0,0);
        const current = scenes.findIndex((item) => Number(time) >= item.start && Number(time) < item.end);
        nodes.forEach((node,index) => { const on = index === Math.max(0, current); node.scale.setScalar(on ? 1.22 : .78); node.material.opacity = on ? 1 : .42; node.material.color.set(on ? 0xb5f36a : (index % 2 ? 0x45d6d0 : 0x86a7b0)); });
        links.forEach((line,index) => { line.material.opacity = index === Math.max(0,current) ? .95 : .18; });
        renderer.render(scene,camera);
      }
      window.addEventListener('resize', resize);
      window.addEventListener('hf-seek', (event) => { const detail = event.detail || {}; renderAt(detail.time ?? detail.currentTime ?? detail); });
      video.addEventListener('timeupdate', () => renderAt(video.currentTime || 0));
      resize();
      renderAt(0);
      fallback.classList.add('is-hidden');
      window.__hfThreeTime = 0;
    } catch (error) {
      document.documentElement.dataset.threeError = String(error);
    }
  </script>
</body>
</html>'''
