/* lyrics-kinetic-noir · núcleo: azar determinista, medidas de texto, partición de líneas,
   bloques de texto con letras de ancho fijo y efectos (tecleo, mezcla de caracteres, corte en bandas).
   Todo se calcula desde el tiempo de la escena: nada acumula estado entre cuadros. */
(function (root) {
  "use strict";
  const N = root.Noir = root.Noir || {};
  N.registry = N.registry || { scenes: {}, intro: null, outros: {}, pause: null };
  N.LAYOUTS = ["bar", "stack", "quote", "ghost", "subtitle", "frame", "box", "highlight"];

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = {
    out: t => 1 - Math.pow(1 - clamp(t, 0, 1), 3),
    in: t => Math.pow(clamp(t, 0, 1), 3),
    inOut: t => { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    expo: t => { t = clamp(t, 0, 1); return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); }
  };
  const prog = (t, a, d) => (d <= 0 ? (t >= a ? 1 : 0) : clamp((t - a) / d, 0, 1));

  function hash(...vals) {
    let h = 2166136261 >>> 0;
    for (const v of vals) {
      h ^= Math.imul((v | 0) >>> 0, 2654435761) >>> 0;
      h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
      h ^= h >>> 13;
    }
    return (h >>> 0) / 4294967296;
  }
  function rng(seed) {
    let s = (seed >>> 0) || 1;
    const r = () => {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    r.pick = a => a[Math.floor(r() * a.length)];
    r.weighted = (deck, avoid = []) => {
      let e = Object.entries(deck).filter(([k, w]) => w > 0 && !avoid.includes(k));
      if (!e.length) e = Object.entries(deck).filter(([, w]) => w > 0);
      if (!e.length) return null;
      const tot = e.reduce((s, [, w]) => s + w, 0);
      let x = r() * tot;
      for (const [k, w] of e) { x -= w; if (x <= 0) return k; }
      return e[e.length - 1][0];
    };
    return r;
  }

  /* medidas en em (ancho / tamaño de fuente) con caché */
  const cv = document.createElement("canvas").getContext("2d");
  const measureCache = new Map();
  function measure(text, f) {
    const k = f.family + "|" + (f.weight || 400) + "|" + text;
    let w = measureCache.get(k);
    if (w === undefined) {
      cv.font = `${f.weight || 400} 100px "${f.family}"`;
      w = cv.measureText(text).width / 100;
      measureCache.set(k, w);
    }
    return w;
  }
  const charEm = (c, f) => (c === " " ? measure(" ", f) : measure(c, f)) + (f.tracking || 0);
  const lineEm = (text, f) => [...text].reduce((s, c) => s + charEm(c, f), 0) - (f.tracking || 0);

  /* partición equilibrada de palabras en n líneas (mínimo del máximo de caracteres) */
  function partition(words, n) {
    const m = words.length;
    n = clamp(n, 1, m);
    const S = [0];
    words.forEach((w, i) => S.push(S[i] + [...w.text].length));
    const len = (a, b) => S[b] - S[a] + (b - a - 1);
    const best = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(Infinity));
    const cut = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    best[0][0] = 0;
    for (let k = 1; k <= n; k++) {
      for (let j = k; j <= m; j++) {
        for (let i = k - 1; i < j; i++) {
          const v = Math.max(best[k - 1][i], len(i, j));
          if (v < best[k][j]) { best[k][j] = v; cut[k][j] = i; }
        }
      }
    }
    const lines = [];
    let j = m;
    for (let k = n; k >= 1; k--) { const i = cut[k][j]; lines.unshift(words.slice(i, j)); j = i; }
    return { lines, max: best[n][m] };
  }
  function wrap(words, maxChars, minLines = 1, maxLines = 4) {
    if (!words.length) return [];
    const top = Math.min(maxLines, words.length);
    let pick = null;
    for (let n = Math.min(minLines, top); n <= top; n++) {
      pick = partition(words, n);
      if (pick.max <= maxChars) break;
    }
    return pick.lines;
  }

  /* tamaño de fuente (px) que hace caber las líneas en maxW × maxH */
  function fitSize(lines, f, maxW, maxH, scale = 1) {
    let m = 0.01;
    for (const l of lines) m = Math.max(m, lineEm(l.map(w => w.text).join(" "), f) * scale);
    const lh = f.lineHeight || 0.9;
    return Math.max(8, Math.min(maxW / m, maxH / (lines.length * lh * scale)));
  }

  function el(tag, cls, parent, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  function applyFont(e, f, px) {
    e.style.fontFamily = `"${f.family}"`;
    e.style.fontWeight = String(f.weight || 400);
    e.style.fontSize = px + "px";
    e.style.lineHeight = String(f.lineHeight || 0.9);
  }

  /* Bloque de texto: líneas → palabras → letras de ancho fijo (la mezcla de caracteres no mueve el renglón).
     words: [{text, start, end}] en segundos de la escena. */
  function block(parent, lines, f, px, opts = {}) {
    const b = el("div", "nz-block" + (opts.cls ? " " + opts.cls : ""), parent);
    applyFont(b, f, px);
    b.style.textAlign = opts.align || "center";
    const out = [];
    let wi = 0;
    lines.forEach((ws, li) => {
      const L = el("div", "nz-line", b);
      const words = [];
      ws.forEach((w, i) => {
        const s = el("span", "nz-w", L);
        const chars = [...w.text].map(c => {
          const ce = el("span", "nz-c", s, c);
          ce.style.width = (charEm(c, f) * px).toFixed(2) + "px";
          return { el: ce, c, shown: c };
        });
        words.push({ el: s, w, chars, idx: wi++, line: li, tf: "", clip: "" });
        if (i < ws.length - 1) {
          const sp = el("span", "nz-sp", L);
          sp.style.width = (charEm(" ", f) * px).toFixed(2) + "px";
        }
      });
      out.push({ el: L, words });
    });
    const widthPx = Math.max(...lines.map(l => lineEm(l.map(w => w.text).join(" "), f))) * px;
    const heightPx = lines.length * (f.lineHeight || 0.9) * px;
    return { el: b, lines: out, words: out.flatMap(l => l.words), px, widthPx, heightPx };
  }

  const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&/";
  const isLetter = c => /[\p{L}\p{N}]/u.test(c);
  function setChar(ch, txt, vis) {
    if (vis) {
      if (ch.shown !== txt) { ch.el.textContent = txt; ch.shown = txt; }
      if (ch.vis !== true) { ch.el.style.visibility = "visible"; ch.vis = true; }
    } else if (ch.vis !== false) { ch.el.style.visibility = "hidden"; ch.vis = false; }
  }
  /* Tecleo de una palabra: letras de izquierda a derecha entre t0 y t0+dur.
     scramble: cada letra muestra caracteres al azar (cambian a 30 Hz) antes de fijarse. */
  function typeWord(rw, lt, t0, dur, seed, scramble) {
    const n = rw.chars.length;
    const p = (lt - t0) / Math.max(dur, 0.001);
    const step = Math.floor(lt * 30);
    rw.chars.forEach((ch, i) => {
      const a = i / n, b = (i + 1) / n;
      if (p >= b + (scramble ? 0.2 : 0)) setChar(ch, ch.c, true);
      else if (p >= a) setChar(ch, scramble && isLetter(ch.c) ? GLYPHS[Math.floor(hash(seed, rw.idx * 97 + i, step) * GLYPHS.length)] : ch.c, true);
      else setChar(ch, ch.c, false);
    });
    return clamp(p, 0, 1);
  }
  function showWord(rw, vis) { rw.chars.forEach(ch => setChar(ch, ch.c, vis)); }
  /* deja visibles solo las k primeras letras */
  function keepChars(rw, k) { rw.chars.forEach((ch, i) => setChar(ch, ch.c, i < k)); }

  /* corte en bandas: la palabra se recorta a una franja horizontal y se desplaza */
  function sliceOf(seed, idx, step, amount) {
    const a = hash(seed, idx, step, 1), b = hash(seed, idx, step, 2), c = hash(seed, idx, step, 3);
    const top = Math.floor(a * 55), bottom = Math.floor(b * (95 - top) * 0.6);
    return { clip: `inset(${top}% 0 ${bottom}% 0)`, dx: (c - 0.5) * 0.5 * amount };
  }
  /* aplica transform + recorte (solo escribe si cambia) */
  function paint(rw, tf, clip, opacity) {
    if (rw.tf !== tf) { rw.el.style.transform = tf; rw.tf = tf; }
    if (rw.clip !== clip) { rw.el.style.clipPath = clip; rw.clip = clip; }
    const o = opacity === undefined ? "" : String(opacity);
    if (rw.op !== o) { rw.el.style.opacity = o; rw.op = o; }
  }

  N.core = { clamp, lerp, ease, prog, hash, rng, measure, measureCache, charEm, lineEm, partition, wrap, fitSize,
    el, applyFont, block, typeWord, showWord, keepChars, sliceOf, paint, setChar, GLYPHS };
})(typeof window !== "undefined" ? window : globalThis);
