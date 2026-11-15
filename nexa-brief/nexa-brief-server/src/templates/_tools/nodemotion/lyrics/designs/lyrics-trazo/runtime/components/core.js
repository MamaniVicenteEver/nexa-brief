/* lyrics-trazo · núcleo compartido de los componentes.
   Todo lo que se dibuja depende solo de (semilla, índice de escena, tiempo local):
   así un seek a cualquier segundo da siempre la misma imagen (contrato HyperFrames).
   Sin temporizadores: el orquestador (player.js) llama update(t) en cada cuadro. */
(function (root) {
  "use strict";
  const T = root.Trazo = root.Trazo || {};
  const SVGNS = "http://www.w3.org/2000/svg";

  /* ---------- azar determinista ---------- */
  function hash(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
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
    /* elige una clave de {clave: peso} */
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

  /* ---------- curvas ---------- */
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const ease = {
    linear: x => x,
    out: x => 1 - Math.pow(1 - x, 3),
    in: x => x * x * x,
    inOut: x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    back: x => { const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); }
  };
  /* progreso 0..1 de t dentro de [a, b] */
  const prog = (t, a, b) => (b <= a ? (t >= b ? 1 : 0) : clamp((t - a) / (b - a)));

  /* ---------- DOM ---------- */
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
  /* capa SVG a pantalla completa en coordenadas de píxel CSS */
  function svgLayer(parent, W, H) {
    return svg("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}`, class: "tz-svg" }, parent);
  }

  /* ---------- medida de texto con la fuente ya cargada ---------- */
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const measureCache = new Map();
  function measure(text, family, size = 100, tracking = 0) {
    const key = family + "|" + text + "|" + tracking;
    if (measureCache.has(key)) return measureCache.get(key) * size / 100;
    ctx.font = `100px "${family}"`;
    const m = ctx.measureText(text);
    const w = m.width + Math.max(0, text.length - 1) * tracking * 100;
    measureCache.set(key, w);
    return w * size / 100;
  }

  /* ---------- trazos a mano (devuelven el atributo d de un path) ---------- */
  /* Catmull-Rom → Bézier cúbica: une puntos con una línea continua y blanda */
  function smooth(points, closed) {
    if (points.length < 2) return "";
    const p = closed ? [points[points.length - 1], ...points, points[0], points[1]] : [points[0], ...points, points[points.length - 1]];
    let d = `M${p[1][0].toFixed(1)},${p[1][1].toFixed(1)}`;
    for (let i = 1; i < p.length - 2; i++) {
      const [x0, y0] = p[i - 1], [x1, y1] = p[i], [x2, y2] = p[i + 1], [x3, y3] = p[i + 2];
      const c1x = x1 + (x2 - x0) / 6, c1y = y1 + (y2 - y0) / 6;
      const c2x = x2 - (x3 - x1) / 6, c2y = y2 - (y3 - y1) / 6;
      d += `C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
    }
    return d;
  }
  /* óvalo dibujado a mano: más de una vuelta y radio irregular */
  function wobblyEllipse(cx, cy, rx, ry, r, loops = 1.25, jitter = 0.07) {
    const n = Math.max(10, Math.round(14 * loops));
    const start = r.range(0, Math.PI * 2), pts = [];
    for (let i = 0; i <= n; i++) {
      const a = start + (i / n) * Math.PI * 2 * loops;
      const k = 1 + r.range(-jitter, jitter);
      pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
    }
    return smooth(pts, false);
  }
  /* línea temblorosa entre dos puntos */
  function wobblyLine(x1, y1, x2, y2, r, amp = 0.02, n = 5) {
    const len = Math.hypot(x2 - x1, y2 - y1), nx = -(y2 - y1) / (len || 1), ny = (x2 - x1) / (len || 1);
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const f = i / n, o = (i === 0 || i === n) ? 0 : r.range(-amp, amp) * len;
      pts.push([x1 + (x2 - x1) * f + nx * o, y1 + (y2 - y1) * f + ny * o]);
    }
    return smooth(pts, false);
  }
  /* rayos cortos alrededor de un centro */
  function rays(cx, cy, r0, r1, count, r) {
    const out = [];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + r.range(-0.25, 0.25);
      const a0 = r0 * r.range(0.95, 1.15), a1 = r1 * r.range(0.75, 1.2);
      out.push(wobblyLine(cx + Math.cos(a) * a0, cy + Math.sin(a) * a0, cx + Math.cos(a) * a1, cy + Math.sin(a) * a1, r, 0.03, 2));
    }
    return out;
  }
  /* grieta ramificada: lista de {d, gen} para dibujarla por generaciones */
  function crack(cx, cy, size, r, branches = 7) {
    const out = [];
    function walk(x, y, ang, len, gen) {
      const pts = [[x, y]];
      const steps = Math.max(3, Math.round(len / (size * 0.05)));
      for (let i = 0; i < steps; i++) {
        ang += r.range(-0.45, 0.45);
        x += Math.cos(ang) * len / steps; y += Math.sin(ang) * len / steps;
        pts.push([x, y]);
        if (gen < 3 && r() < 0.22) walk(x, y, ang + r.sign() * r.range(0.5, 1.1), len * r.range(0.3, 0.55), gen + 1);
      }
      out.push({ d: smooth(pts, false), gen });
    }
    for (let i = 0; i < branches; i++) walk(cx, cy, (i / branches) * Math.PI * 2 + r.range(-0.3, 0.3), size * r.range(0.45, 0.8), 0);
    /* nudo central de trazos cortos */
    for (let i = 0; i < 9; i++) out.push({ d: wobblyEllipse(cx, cy, size * r.range(0.015, 0.05), size * r.range(0.015, 0.05), r, 1.1, 0.4), gen: 0 });
    return out;
  }
  /* impacto de bala: anillos irregulares + astillas */
  function bulletHole(cx, cy, rad, r) {
    const parts = [wobblyEllipse(cx, cy, rad, rad * r.range(0.85, 1.05), r, 1.3, 0.12), wobblyEllipse(cx, cy, rad * 0.62, rad * 0.6, r, 1.6, 0.18)];
    const spikes = r.int(7, 12);
    for (let i = 0; i < spikes; i++) {
      const a = r.range(0, Math.PI * 2), l0 = rad * r.range(0.9, 1.1), l1 = rad * r.range(1.3, 1.9);
      parts.push(wobblyLine(cx + Math.cos(a) * l0, cy + Math.sin(a) * l0, cx + Math.cos(a) * l1, cy + Math.sin(a) * l1, r, 0.08, 2));
    }
    return parts;
  }
  /* ovillo de garabato */
  function scribble(cx, cy, rad, r, n = 26) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = r.range(0, Math.PI * 2), d = rad * Math.sqrt(r());
      pts.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d * r.range(0.8, 1.1)]);
    }
    return smooth(pts, false);
  }
  /* destello de cuatro puntas */
  function sparkle(cx, cy, rad, r) {
    const out = [];
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + r.range(-0.08, 0.08);
      out.push(wobblyLine(cx, cy, cx + Math.cos(a) * rad * r.range(0.8, 1.15), cy + Math.sin(a) * rad * r.range(0.8, 1.15), r, 0.02, 2));
    }
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + i * Math.PI / 2;
      out.push(wobblyLine(cx, cy, cx + Math.cos(a) * rad * 0.35, cy + Math.sin(a) * rad * 0.35, r, 0.02, 2));
    }
    return out;
  }
  /* trama de rayas cortas para fondos “rayados a mano” */
  function hatch(W, H, r, density = 1) {
    const n = Math.round((W * H) / 2600 * density);
    let d = "";
    for (let i = 0; i < n; i++) {
      const x = r.range(-20, W), y = r.range(-20, H), l = r.range(14, 60), a = -0.9 + r.range(-0.35, 0.35);
      d += `M${x.toFixed(0)},${y.toFixed(0)}l${(Math.cos(a) * l).toFixed(0)},${(Math.sin(a) * l).toFixed(0)}`;
    }
    return d;
  }
  /* añade paths con trazo dibujado progresivamente (pathLength=1) */
  function strokePaths(layer, ds, opts = {}) {
    return ds.map(d => svg("path", {
      d, pathLength: 1, fill: "none", style: "stroke:var(--ink)",
      "stroke-width": opts.width || 3, "stroke-linecap": "round", "stroke-linejoin": "round",
      "stroke-dasharray": "1 1", "stroke-dashoffset": 1
    }, layer));
  }
  function setDraw(path, p) { path.setAttribute("stroke-dashoffset", (1 - clamp(p)).toFixed(4)); }

  /* ---------- textura de tinta (máscara de ruido) ---------- */
  function grainTexture(seed, size = 192, amount = 0.5) {
    const r = rng(seed), c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d"), img = g.createImageData(size, size);
    for (let i = 0; i < size * size; i++) {
      /* la mayoría opaco; pocos huecos = borde de tiza / pincel seco */
      const v = r() < amount * 0.22 ? r() * 150 : 255;
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = 0;
      img.data[i * 4 + 3] = v;
    }
    g.putImageData(img, 0, 0);
    return c.toDataURL("image/png");
  }

  T.core = { hash, rng, clamp, ease, prog, el, svg, svgLayer, measure, measureCache, smooth,
    wobblyEllipse, wobblyLine, rays, crack, bulletHole, scribble, sparkle, hatch, strokePaths, setDraw, grainTexture };
  T.registry = T.registry || { scenes: {}, interludes: {}, doodles: {}, transitions: {}, motions: {}, intro: null, outros: {} };
})(typeof window !== "undefined" ? window : globalThis);
