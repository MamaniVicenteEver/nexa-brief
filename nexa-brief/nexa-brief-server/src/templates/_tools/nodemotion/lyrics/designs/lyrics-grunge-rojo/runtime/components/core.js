/* lyrics-grunge-rojo · núcleo compartido.
   Estado = f(semilla, escena, tiempo local). Sin temporizadores ni contadores de cuadros.
   Azar determinista, curvas, DOM/SVG, medida con fuentes variables, texturas generadas
   por canvas (desgaste de tinta, grano, papel), borde rasgado y trazos de tiza/pincel. */
(function (root) {
  "use strict";
  const G = root.GrungeRojo = root.GrungeRojo || {};
  const SVGNS = "http://www.w3.org/2000/svg";

  function rng(seed) {
    let a = (seed >>> 0) || 1;
    const next = () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    next.range = (lo, hi) => lo + (hi - lo) * next();
    next.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * next());
    next.pick = arr => arr[Math.floor(next() * arr.length)];
    next.sign = () => (next() < 0.5 ? -1 : 1);
    next.weighted = (deck, avoid) => {
      const keys = Object.keys(deck).filter(k => deck[k] > 0 && !(avoid && avoid.includes(k)));
      const pool = keys.length ? keys : Object.keys(deck).filter(k => deck[k] > 0);
      let total = 0; for (const k of pool) total += deck[k];
      let r = next() * total;
      for (const k of pool) { r -= deck[k]; if (r <= 0) return k; }
      return pool[pool.length - 1];
    };
    return next;
  }
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const prog = (t, a, b) => (b <= a ? (t >= b ? 1 : 0) : clamp((t - a) / (b - a)));
  const ease = {
    out: x => 1 - Math.pow(1 - x, 3),
    in: x => x * x * x,
    inOut: x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    expo: x => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
    back: x => { const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); }
  };
  function el(tag, cls, parent, css) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (css) Object.assign(e.style, css);
    if (parent) parent.appendChild(e);
    return e;
  }
  function svg(tag, attrs, parent) {
    const e = document.createElementNS(SVGNS, tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function layer(parent, W, H, cls) { return svg("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}`, class: "gr-svg " + (cls || "") }, parent); }

  /* medida con <span> oculto (respeta ejes de anchura y peso) */
  const cache = new Map();
  let probe = null;
  function measure(text, font, size = 100) {
    const key = [font.family, font.stretch, font.weight, font.tracking, text].join("|");
    if (!cache.has(key)) {
      if (!probe) probe = el("span", "", document.body, { position: "absolute", left: "-99999px", top: "0", whiteSpace: "pre", visibility: "hidden" });
      useFont(probe, font, 100);
      probe.textContent = text;
      cache.set(key, probe.getBoundingClientRect().width);
    }
    return cache.get(key) * size / 100;
  }
  function fit(lines, font, w, h, lh = 0.92) {
    const list = Array.isArray(lines) ? lines : String(lines).split("\n");
    const widest = Math.max(...list.map(l => measure(l, font, 100))) || 1;
    return Math.max(6, Math.min(w * 100 / widest, h / (list.length * lh)));
  }
  function useFont(e, font, size) {
    e.style.fontFamily = `"${font.family}"`;
    e.style.fontWeight = font.weight || 400;
    e.style.fontStretch = (font.stretch || 100) + "%";
    e.style.letterSpacing = (font.tracking || 0) + "em";
    if (size) e.style.fontSize = size.toFixed(1) + "px";
  }

  /* ---------------- texturas (canvas → dataURL, deterministas) ---------------- */
  /* desgaste de tinta: máscara casi opaca con huecos, rayas y manchas */
  function distressTexture(seed, amount = 0.5, size = 256) {
    const r = rng(seed), c = document.createElement("canvas"); c.width = c.height = size;
    const g = c.getContext("2d");
    g.fillStyle = "#000"; g.fillRect(0, 0, size, size);
    g.globalCompositeOperation = "destination-out";
    const holes = Math.round(size * size / 90 * amount);
    for (let i = 0; i < holes; i++) {
      g.globalAlpha = r.range(0.25, 1);
      g.beginPath(); g.arc(r() * size, r() * size, r.range(0.4, 1.6), 0, Math.PI * 2); g.fill();
    }
    g.lineCap = "round";
    for (let i = 0; i < Math.round(14 * amount); i++) {
      g.globalAlpha = r.range(0.3, 0.8); g.lineWidth = r.range(0.6, 1.8);
      const x = r() * size, y = r() * size, a = r.range(-0.4, 0.4), l = r.range(20, 90);
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    for (let i = 0; i < Math.round(5 * amount); i++) {
      g.globalAlpha = r.range(0.4, 0.9);
      g.beginPath(); g.ellipse(r() * size, r() * size, r.range(3, 9), r.range(2, 6), r() * 3, 0, Math.PI * 2); g.fill();
    }
    return c.toDataURL("image/png");
  }
  /* grano de película */
  function grainTexture(seed, size = 200) {
    const r = rng(seed), c = document.createElement("canvas"); c.width = c.height = size;
    const g = c.getContext("2d"), img = g.createImageData(size, size);
    for (let i = 0; i < size * size; i++) {
      const v = r() * 255;
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = r() < 0.5 ? 26 : 0;
    }
    g.putImageData(img, 0, 0);
    return c.toDataURL("image/png");
  }
  /* papel gris arrugado (fondo y tiras rasgadas) */
  function paperTexture(seed, tone = "#BDBDBA", size = 512) {
    const r = rng(seed), c = document.createElement("canvas"); c.width = c.height = size;
    const g = c.getContext("2d");
    g.fillStyle = tone; g.fillRect(0, 0, size, size);
    for (let i = 0; i < 70; i++) {
      const x = r() * size, y = r() * size, rad = r.range(30, 160);
      const dark = r() < 0.5;
      /* cada mancha se dibuja también desplazada un tamaño en cada eje: textura sin costura */
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        const cx = x + dx * size, cy = y + dy * size;
        const gr = g.createRadialGradient(cx, cy, 0, cx, cy, rad);
        gr.addColorStop(0, dark ? "rgba(0,0,0,0.10)" : "rgba(255,255,255,0.10)"); gr.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = gr; g.fillRect(0, 0, size, size);
      }
    }
    g.lineCap = "round";
    for (let i = 0; i < 45; i++) {
      g.strokeStyle = r() < 0.5 ? "rgba(0,0,0,0.13)" : "rgba(255,255,255,0.16)"; g.lineWidth = r.range(0.5, 1.5);
      const pts = [[r() * size, r() * size]];
      for (let k = 0; k < 4; k++) pts.push([pts[k][0] + r.range(-60, 60), pts[k][1] + r.range(-60, 60)]);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        g.beginPath(); pts.forEach(([px, py], k) => (k ? g.lineTo : g.moveTo).call(g, px + dx * size, py + dy * size)); g.stroke();
      }
    }
    const img = g.getImageData(0, 0, size, size);
    for (let i = 0; i < img.data.length; i += 4) { const n = (r() - 0.5) * 22; img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n; }
    g.putImageData(img, 0, 0);
    return c.toDataURL("image/jpeg", 0.88);
  }

  /* ---------------- formas ---------------- */
  function smooth(points, closed) {
    if (points.length < 2) return "";
    const p = closed ? [points[points.length - 1], ...points, points[0], points[1]] : [points[0], ...points, points[points.length - 1]];
    let d = `M${p[1][0].toFixed(1)},${p[1][1].toFixed(1)}`;
    for (let i = 1; i < p.length - 2; i++) {
      const [x0, y0] = p[i - 1], [x1, y1] = p[i], [x2, y2] = p[i + 1], [x3, y3] = p[i + 2];
      d += `C${(x1 + (x2 - x0) / 6).toFixed(1)},${(y1 + (y2 - y0) / 6).toFixed(1)} ${(x2 - (x3 - x1) / 6).toFixed(1)},${(y2 - (y3 - y1) / 6).toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
    }
    return d;
  }
  /* borde rasgado: polígono que cubre de y0 hacia arriba (dir=-1) o abajo (dir=1) */
  function tornPath(W, y0, depth, dir, r) {
    const pts = []; let x = -10;
    while (x < W + 20) { pts.push([x, y0 + r.range(-1, 1) * depth * (r() < 0.15 ? 1.8 : 0.7)]); x += r.range(6, 22); }
    let d = `M-10,${dir > 0 ? 99999 : -99999}`;
    for (const [px, py] of pts) d += `L${px.toFixed(1)},${py.toFixed(1)}`;
    d += `L${W + 20},${dir > 0 ? 99999 : -99999}Z`;
    return d;
  }
  function wobblyEllipse(cx, cy, rx, ry, r, loops = 1.2, jitter = 0.06) {
    const n = Math.max(10, Math.round(16 * loops)), start = r.range(0, Math.PI * 2), pts = [];
    for (let i = 0; i <= n; i++) { const a = start + (i / n) * Math.PI * 2 * loops, k = 1 + r.range(-jitter, jitter); pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]); }
    return smooth(pts, false);
  }
  function wobblyLine(x1, y1, x2, y2, r, amp = 0.02, n = 5) {
    const len = Math.hypot(x2 - x1, y2 - y1) || 1, nx = -(y2 - y1) / len, ny = (x2 - x1) / len, pts = [];
    for (let i = 0; i <= n; i++) { const f = i / n, o = (i === 0 || i === n) ? 0 : r.range(-amp, amp) * len; pts.push([x1 + (x2 - x1) * f + nx * o, y1 + (y2 - y1) * f + ny * o]); }
    return smooth(pts, false);
  }
  function strokePaths(parent, ds, color, width, cls) {
    return ds.map(d => svg("path", { d, pathLength: 1, fill: "none", stroke: color, "stroke-width": width, "stroke-linecap": "round", "stroke-linejoin": "round",
      "stroke-dasharray": "1 1", "stroke-dashoffset": 1, class: cls || "" }, parent));
  }
  function setDraw(p, v) { p.setAttribute("stroke-dashoffset", (1 - clamp(v)).toFixed(4)); }

  G.core = { rng, clamp, prog, ease, el, svg, layer, measure, measureCache: cache, fit, useFont,
    distressTexture, grainTexture, paperTexture, smooth, tornPath, wobblyEllipse, wobblyLine, strokePaths, setDraw };
  G.registry = G.registry || { scenes: {}, interludes: {}, transitions: {}, doodles: {}, intro: null, outros: {} };
})(typeof window !== "undefined" ? window : globalThis);
