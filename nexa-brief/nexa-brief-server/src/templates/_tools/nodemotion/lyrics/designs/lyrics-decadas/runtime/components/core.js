/* lyrics-decadas · núcleo compartido de los componentes.
   Estado = f(semilla, escena, tiempo local): sin temporizadores ni contadores de cuadros.
   Incluye: azar determinista, curvas, medida de texto, semitono de fotos y firma a mano. */
(function (root) {
  "use strict";
  const DC = root.Decadas = root.Decadas || {};

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
    expo: x => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x))
  };
  function el(tag, cls, parent, css) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (css) Object.assign(e.style, css);
    if (parent) parent.appendChild(e);
    return e;
  }
  const SVGNS = "http://www.w3.org/2000/svg";
  function svg(tag, attrs, parent) {
    const e = document.createElementNS(SVGNS, tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  /* medida con un <span> oculto: respeta el eje de anchura de la fuente variable */
  const cache = new Map();
  let probe = null;
  function measure(text, font, size = 100) {
    const key = font.family + "|" + font.stretch + "|" + font.weight + "|" + text;
    if (!cache.has(key)) {
      if (!probe) { probe = el("span", "", document.body, { position: "absolute", left: "-99999px", top: "0", whiteSpace: "pre", visibility: "hidden" }); }
      probe.style.fontFamily = `"${font.family}"`; probe.style.fontWeight = font.weight || 400;
      probe.style.fontStretch = (font.stretch || 100) + "%"; probe.style.fontSize = "100px"; probe.style.letterSpacing = (font.tracking || 0) + "em";
      probe.textContent = text;
      cache.set(key, probe.getBoundingClientRect().width);
    }
    return cache.get(key) * size / 100;
  }
  /* tamaño de letra para que text quepa en w × h */
  function fit(text, font, w, h, lh = 0.88) {
    const lines = String(text).split("\n");
    const widest = Math.max(...lines.map(l => measure(l, font, 100))) || 1;
    return Math.max(6, Math.min(w * 100 / widest, h / (lines.length * lh)));
  }
  /* aplica la fuente de config a un elemento */
  function useFont(e, font, size) {
    e.style.fontFamily = `"${font.family}"`;
    e.style.fontWeight = font.weight || 400;
    e.style.fontStretch = (font.stretch || 100) + "%";
    if (font.tracking) e.style.letterSpacing = font.tracking + "em";
    if (size) e.style.fontSize = size.toFixed(1) + "px";
  }

  /* semitono: foto → puntos negros sobre papel claro (dataURL), determinista */
  function halftone(img, opts) {
    const maxSide = opts.size || 900, cell = opts.cell || 7, contrast = opts.contrast || 1.15;
    const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
    const src = document.createElement("canvas"); src.width = w; src.height = h;
    const g = src.getContext("2d"); g.drawImage(img, 0, 0, w, h);
    const data = g.getImageData(0, 0, w, h).data;
    const out = document.createElement("canvas"); out.width = w; out.height = h;
    const o = out.getContext("2d");
    o.fillStyle = opts.paper || "#ECEDEC"; o.fillRect(0, 0, w, h);
    o.fillStyle = opts.ink || "#0A0A0A";
    /* rejilla girada 45° como en la impresión de periódico */
    const ang = Math.PI / 4, ca = Math.cos(ang), sa = Math.sin(ang);
    const diag = Math.hypot(w, h);
    for (let gy = -diag; gy < diag; gy += cell) {
      for (let gx = -diag; gx < diag; gx += cell) {
        const x = w / 2 + gx * ca - gy * sa, y = h / 2 + gx * sa + gy * ca;
        if (x < -cell || y < -cell || x > w + cell || y > h + cell) continue;
        const px = Math.min(w - 1, Math.max(0, x | 0)), py = Math.min(h - 1, Math.max(0, y | 0));
        const i = (py * w + px) * 4;
        const lum = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
        const dark = clamp((1 - lum - 0.5) * contrast + 0.5);
        const r = cell * 0.5 * Math.sqrt(dark) * 1.18;
        if (r < 0.35) continue;
        o.beginPath(); o.arc(x, y, r, 0, Math.PI * 2); o.fill();
      }
    }
    return out.toDataURL("image/jpeg", 0.9);
  }

  /* firma rápida: bucles cursivos sobre una línea (path SVG) */
  function signaturePath(x, y, w, h, r) {
    const pts = [];
    const n = r.int(9, 13);
    for (let i = 0; i <= n; i++) {
      const f = i / n;
      pts.push([x + w * f + r.range(-0.03, 0.03) * w, y + Math.sin(f * Math.PI * r.range(3, 5)) * h * r.range(0.3, 1) - (i % 3 === 1 ? h * 0.8 : 0)]);
    }
    pts.push([x + w * 1.15, y - h * 0.4]);
    let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
      d += `Q${x1.toFixed(1)},${y1.toFixed(1)} ${((x1 + x2) / 2).toFixed(1)},${((y1 + y2) / 2).toFixed(1)}`;
    }
    /* trazo de cierre largo, como la raya de la firma de la referencia */
    d += `M${(x - w * 0.1).toFixed(1)},${(y + h * 0.25).toFixed(1)}L${(x + w * 1.25).toFixed(1)},${(y - h * 0.55).toFixed(1)}`;
    return d;
  }
  function setDraw(path, p) { path.setAttribute("stroke-dashoffset", (1 - clamp(p)).toFixed(4)); }

  DC.core = { rng, clamp, prog, ease, el, svg, measure, measureCache: cache, fit, useFont, halftone, signaturePath, setDraw };
  DC.registry = DC.registry || { scenes: {}, transitions: {}, intro: null, outros: {} };
})(typeof window !== "undefined" ? window : globalThis);
