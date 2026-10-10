/* =============================================================================
   acuarela · runtime de la familia "historia en papel" (réplica de la plantilla
   de línea de tiempo con manchas de acuarela)
   -----------------------------------------------------------------------------
   · Fondo: papel gris claro procedural (fibra + moteado) generado UNA vez.
   · Máscaras de tinta: campo de ruido fractal precalculado (semilla fija) +
     umbral que baja con el tiempo → la mancha "florece" o la letra se revela
     con borde irregular. Cada cuadro solo recalcula el alfa de una máscara
     chica (≈1/3 del tamaño) y la escala: determinista y barato.
   · post(): virado sepia con barrido de luz cálida (blend "color"), velo
     blanco cálido de las transiciones, grano y fundido a negro final. Todo se
     calcula desde ctx.beats y t (función pura del tiempo).
   Utilidades en Kit.acuarela: scene(ctx, spec) arma una escena completa
   (mancha-foto, manuscrito, fotos con marco, fecha + raya + párrafo).
   ========================================================================== */
(function () {
  const K = window.Kit, { clamp, lerp, prog } = K;
  for (const f of ["500 40px Oswald", "600 40px Oswald", "500 20px 'Barlow Condensed'", "600 20px 'Barlow Condensed'", "400 30px 'Mrs Saint Delafield'"]) K.fonts.add(f);

  const mine = b => typeof b.use === "string" && b.use.startsWith("acuarela.") && b.layer !== "overlay";
  const ss = x => x * x * (3 - 2 * x);
  const ease4 = x => 1 - Math.pow(1 - clamp(x), 4);
  const mkCanvas = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };

  /* ------------------------------------------------------------ ruido */
  /** ruido de valor (rejilla gw×gh) con interpolación suave */
  function lattice(seed, gw, gh) {
    const r = K.rng(seed), g = new Float32Array((gw + 2) * (gh + 2)), S = gw + 2;
    for (let i = 0; i < g.length; i++) g[i] = r();
    return (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), sx = ss(x - xi), sy = ss(y - yi), o = yi * S + xi;
      const a = g[o], b = g[o + 1], c = g[o + S], d = g[o + S + 1];
      return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    };
  }
  /** fbm normalizado 0..1 en una grilla mw×mh; `cells` = celdas a lo ancho de la octava base */
  function fbm(seed, mw, mh, cells = 3, oct = 5, gain = 0.5) {
    const out = new Float32Array(mw * mh);
    let amp = 1;
    for (let o = 0; o < oct; o++) {
      const f = cells * Math.pow(2, o), gw = Math.ceil(f) + 1, gh = Math.ceil(f * mh / mw) + 1, n = lattice(seed * 7 + o * 131, gw, gh);
      const kx = f / mw, ky = f / mw;
      for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) out[y * mw + x] += amp * n(x * kx, y * ky);
      amp *= gain;
    }
    let lo = Infinity, hi = -Infinity;
    for (const v of out) { if (v < lo) lo = v; if (v > hi) hi = v; }
    for (let i = 0; i < out.length; i++) out[i] = (out[i] - lo) / (hi - lo || 1);
    return out;
  }

  /* ------------------------------------------------------------ campos de máscara */
  /** mancha: lóbulos elípticos (fracciones de la caja) + ruido → borde irregular */
  function fieldBlot(seed, mw, mh, lobes, rough = 0.42, cells = 3.4) {
    const n = fbm(seed, mw, mh, cells, 7, 0.6), f = new Float32Array(mw * mh);
    for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
      const nx = (x + 0.5) / mw, ny = (y + 0.5) / mh; let b = 0;
      for (const L of lobes) b = Math.max(b, 1 - Math.hypot((nx - L.x) / L.rx, (ny - L.y) / L.ry));
      const i = y * mw + x; f[i] = clamp(b) * (1 - rough) + n[i] * rough;
    }
    return f;
  }
  /** barrido direccional: from = "left"|"right"|"top"|"bottom"|"center" (desde dónde aparece) */
  function fieldDir(seed, mw, mh, from = "left", rough = 0.4, cells = 5) {
    const n = fbm(seed, mw, mh, cells, 4), f = new Float32Array(mw * mh);
    for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
      const nx = x / Math.max(1, mw - 1), ny = y / Math.max(1, mh - 1);
      const b = from === "right" ? nx : from === "top" ? 1 - ny : from === "bottom" ? ny : from === "center" ? 1 - Math.abs(nx - 0.5) * 2 : 1 - nx;
      const i = y * mw + x; f[i] = b * (1 - rough) + n[i] * rough;
    }
    return f;
  }
  /** manchas sueltas (párrafos, manuscrito): ruido + leve barrido izquierda→derecha */
  function fieldPatch(seed, mw, mh, cells = 7, lean = 0.3) {
    const n = fbm(seed, mw, mh, cells, 4), f = new Float32Array(mw * mh);
    for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) { const i = y * mw + x; f[i] = n[i] * (1 - lean) + (1 - x / Math.max(1, mw - 1)) * lean; }
    return f;
  }

  /** máscara alfa animable: set(th) → canvas mw×mh (solo alfa) */
  function Mask(field, mw, mh, o = {}) {
    const cv = mkCanvas(mw, mh), g = cv.getContext("2d"), img = g.createImageData(mw, mh), d = img.data;
    const soft = o.soft ?? 0.07, gran = o.gran || null, rim = o.rim || 0;
    let last = null;
    return {
      canvas: cv,
      set(th) {
        const key = Math.round(th * 800);
        if (key === last) return false;
        last = key;
        for (let i = 0, n = mw * mh; i < n; i++) {
          const v = field[i]; let a = (v - th) / soft;
          a = a <= 0 ? 0 : a >= 1 ? 1 : ss(a);
          if (rim && a > 0) a *= 1 - rim + rim * (1 - clamp((v - th - soft) / 0.14));
          if (gran) a *= gran[i];
          d[i * 4 + 3] = (a * 255) | 0;
        }
        g.putImageData(img, 0, 0);
        return true;
      },
    };
  }

  /**
   * Elemento revelado por tinta: fuente (canvas a resolución de dispositivo) × máscara.
   * draw(G, x, y, w, h, th, alpha) — x,y,w,h en px CSS; th = umbral actual.
   */
  function Reveal(src, mask) {
    const scr = mkCanvas(src.width, src.height), g = scr.getContext("2d");
    let ready = false;
    return {
      src, mask,
      draw(G, x, y, w, h, th, alpha = 1) {
        if (alpha <= 0.003) return;
        if (th <= -0.2) { G.globalAlpha = alpha; G.drawImage(src, x, y, w, h); G.globalAlpha = 1; return; }
        if (mask.set(th) || !ready) {
          g.globalCompositeOperation = "copy"; g.drawImage(src, 0, 0);
          g.globalCompositeOperation = "destination-in"; g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
          g.drawImage(mask.canvas, 0, 0, scr.width, scr.height);
          g.globalCompositeOperation = "source-over"; ready = true;
        }
        G.globalAlpha = alpha; G.drawImage(scr, x, y, w, h); G.globalAlpha = 1;
      },
    };
  }
  /** umbral de revelado completo: p 0 → nada, p 1 → todo */
  const thFull = (p, soft = 0.07) => lerp(1.0, -soft - 0.01, clamp(p));

  /* ------------------------------------------------------------ papel */
  function makePaper(W, H, P, seed) {
    const s = 0.5, cw = Math.ceil(W * s), ch = Math.ceil(H * s), cv = mkCanvas(cw, ch), g = cv.getContext("2d");
    const big = fbm(seed, cw, ch, 2.2, 4), fib = fbm(seed + 9, cw, ch, 60, 3, 0.6);
    const base = hex(P.paper), hi = hex(P.paperHi || P.paper);
    const img = g.createImageData(cw, ch), d = img.data;
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const i = y * cw + x, dx = x / cw - 0.5, dy = y / ch - 0.48, c = clamp(1 - Math.hypot(dx * 1.1, dy * 1.5) * 1.5);
      const m = (big[i] - 0.5) * 7 + (fib[i] - 0.5) * 6;
      for (let k = 0; k < 3; k++) d[i * 4 + k] = clamp((lerp(base[k], hi[k], c * c) + m) / 255) * 255;
      d[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    /* fibras largas muy tenues */
    const r = K.rng(seed + 3); g.lineCap = "round";
    for (let i = 0; i < 260; i++) {
      const x = r() * cw, y = r() * ch, a = r() * Math.PI, l = 4 + r() * 18;
      g.strokeStyle = r() < 0.5 ? "rgba(255,255,255,.18)" : "rgba(90,88,86,.06)"; g.lineWidth = 0.5 + r() * 0.6;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (r() - .5) * 4, y + Math.sin(a) * l * 0.5 + (r() - .5) * 4, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    return cv;
  }
  function hex(c) { const m = String(c).replace("#", ""); const v = parseInt(m.length === 3 ? m.split("").map(x => x + x).join("") : m, 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
  function makeGrain(seed) {
    const r = K.rng(seed), tiles = [];
    for (let t = 0; t < 4; t++) {
      const cv = mkCanvas(256, 256), g = cv.getContext("2d"), img = g.createImageData(256, 256), d = img.data;
      for (let i = 0; i < 256 * 256; i++) { const v = r() * 255; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
      g.putImageData(img, 0, 0);
      /* motas de polvo */
      for (let k = 0; k < 6; k++) { g.fillStyle = r() < 0.5 ? "#000" : "#fff"; g.beginPath(); g.arc(r() * 256, r() * 256, 0.6 + r() * 1.4, 0, 7); g.fill(); }
      tiles.push(cv);
    }
    return tiles;
  }

  /* ------------------------------------------------------------ fotos */
  const graded = new Map();
  /** foto B/N recortada "cover" a w×h px de dispositivo, con negros levantados, polvo y orillas quemadas */
  function gradePhoto(im, w, h, focus = [0.5, 0.5], seed = 1, o = {}) {
    const cv = mkCanvas(w, h), g = cv.getContext("2d");
    if (!im) { g.fillStyle = "#8a8886"; g.fillRect(0, 0, w, h); return cv; }
    const iar = im.width / im.height, ar = w / h; let sw = im.width, sh = im.height, sx = 0, sy = 0;
    if (iar > ar) { sw = im.height * ar; sx = (im.width - sw) * clamp(focus[0]); } else { sh = im.width / ar; sy = (im.height - sh) * clamp(focus[1]); }
    g.filter = `grayscale(1) contrast(${o.contrast ?? 1.1}) brightness(${o.brightness ?? 0.97})`;
    g.drawImage(im, sx, sy, sw, sh, 0, 0, w, h); g.filter = "none";
    g.globalCompositeOperation = "lighten"; g.fillStyle = o.black || "#2b2928"; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = "darken"; g.fillStyle = "#efeeeb"; g.fillRect(0, 0, w, h);
    /* orillas quemadas */
    g.globalCompositeOperation = "multiply";
    const rg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.56);
    rg.addColorStop(0, "rgba(255,255,255,1)"); rg.addColorStop(1, `rgba(150,148,146,1)`);
    g.fillStyle = rg; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = "source-over";
    /* polvo y rayitas */
    const r = K.rng(seed), u = Math.min(w, h) / 100;
    for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(255,255,255,${0.25 + r() * 0.5})`; g.beginPath(); g.arc(r() * w, r() * h, u * (0.08 + r() * 0.25), 0, 7); g.fill(); }
    g.strokeStyle = "rgba(255,255,255,.22)"; g.lineWidth = Math.max(1, u * 0.08);
    for (let i = 0; i < 5; i++) { const x = r() * w, y = r() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - .5) * u * 8, y + r() * u * 16); g.stroke(); }
    return cv;
  }
  /**
   * Foto con marco. frame: "stamp" (banda clara con borde perforado) | "deckle" (copia vieja,
   * borde irregular claro y orillas oscuras) | "none". Devuelve { cv, pad } (pad en px CSS).
   */
  function framedPhoto(im, wCss, hCss, dpr, o = {}) {
    const key = [im && im.src, wCss | 0, hCss | 0, dpr, o.frame, (o.focus || []).join(","), o.seed].join("|");
    if (graded.has(key)) return graded.get(key);
    const S = Math.min(wCss, hCss) + Math.max(wCss, hCss) * 0.25, bt = Math.max(2.2, S * 0.0105);
    const frame = o.frame || "stamp";
    const pad = frame === "stamp" ? bt + 1 : frame === "deckle" ? bt * 0.8 : 0;
    const W = (wCss + pad * 2) * dpr, H = (hCss + pad * 2) * dpr, cv = mkCanvas(W, H), g = cv.getContext("2d");
    const photo = gradePhoto(im, wCss * dpr, hCss * dpr, o.focus, o.seed || 1, { black: frame === "deckle" ? "#211f1e" : "#2b2928" });
    g.scale(dpr, dpr);
    if (frame === "stamp") {
      g.fillStyle = "#8f8d8a"; g.fillRect(0, 0, wCss + pad * 2, hCss + pad * 2);
      g.fillStyle = "#e1dfdb"; g.fillRect(0.6, 0.6, wCss + pad * 2 - 1.2, hCss + pad * 2 - 1.2);
      /* perforación: semicírculos blancos a lo largo de la banda */
      const R = bt * 0.36, step = bt * 1.05;
      g.fillStyle = "#f7f6f3";
      const dots = (x0, y0, x1, y1) => { const L = Math.hypot(x1 - x0, y1 - y0), n = Math.floor(L / step); for (let i = 0; i <= n; i++) { const t = i / n; g.beginPath(); g.arc(lerp(x0, x1, t), lerp(y0, y1, t), R, 0, 7); g.fill(); } };
      const e = R * 0.85, Wf = wCss + pad * 2, Hf = hCss + pad * 2;
      dots(e, e, Wf - e, e); dots(e, Hf - e, Wf - e, Hf - e); dots(e, e, e, Hf - e); dots(Wf - e, e, Wf - e, Hf - e);
      g.drawImage(photo, pad, pad, wCss, hCss);
      g.strokeStyle = "rgba(120,118,115,.55)"; g.lineWidth = 0.6; g.strokeRect(pad, pad, wCss, hCss);
    } else if (frame === "deckle") {
      const r = K.rng((o.seed || 1) + 77), pts = [], step = Math.max(3, bt * 0.9);
      const edge = (x0, y0, x1, y1, nx, ny) => { const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(2, Math.floor(L / step)); for (let i = 0; i < n; i++) { const t = i / n, j = (r() * r()) * bt * 0.9; pts.push([lerp(x0, x1, t) + nx * j, lerp(y0, y1, t) + ny * j]); } };
      const a = pad, b = pad, c = pad + wCss, d = pad + hCss;
      edge(a, b, c, b, 0, 1); edge(c, b, c, d, -1, 0); edge(c, d, a, d, 0, -1); edge(a, d, a, b, 1, 0);
      const path = new Path2D(); pts.forEach(([x, y], i) => i ? path.lineTo(x, y) : path.moveTo(x, y)); path.closePath();
      g.save(); g.clip(path); g.drawImage(photo, pad, pad, wCss, hCss);
      g.strokeStyle = "rgba(25,23,22,.45)"; g.lineWidth = bt * 1.6; g.stroke(path); g.restore();
      g.strokeStyle = "rgba(236,234,230,.85)"; g.lineWidth = bt * 0.45; g.stroke(path);
    } else g.drawImage(photo, 0, 0, wCss, hCss);
    const out = { cv, pad };
    graded.set(key, out);
    if (graded.size > 60) graded.delete(graded.keys().next().value);
    return out;
  }

  /* ------------------------------------------------------------ texto */
  /** parte el texto en renglones que caben en maxW (px CSS) con la fuente dada */
  function wrap(g, str, maxW) {
    const out = [];
    for (const para of String(str).split("\n")) {
      let line = "";
      for (const w of para.split(/\s+/).filter(Boolean)) {
        const t = line ? line + " " + w : w;
        if (line && g.measureText(t).width > maxW) { out.push(line); line = w; } else line = t;
      }
      out.push(line);
    }
    return out;
  }
  /**
   * Texto a canvas (resolución de dispositivo). o = { font, size, color, align, maxW, lh, spacing, upper }
   * Devuelve { cv, w, h, pad, lines } con medidas CSS; el canvas incluye un margen `pad`.
   */
  function textCanvas(str, o, dpr) {
    const m = mkCanvas(4, 4).getContext("2d"), font = `${o.weight || 500} ${o.size}px ${o.font}`;
    m.font = font; if (o.spacing) m.letterSpacing = o.spacing + "px";
    const s = o.upper ? String(str).toUpperCase() : String(str);
    const lines = o.maxW ? wrap(m, s, o.maxW) : s.split("\n");
    const lh = o.size * (o.lh || 1.2), wMax = Math.max(1, ...lines.map(l => m.measureText(l).width));
    const pad = o.size * 0.35, w = wMax + pad * 2, h = lh * lines.length + pad * 2;
    const cv = mkCanvas(w * dpr, h * dpr), g = cv.getContext("2d");
    g.scale(dpr, dpr); g.font = font; if (o.spacing) g.letterSpacing = o.spacing + "px";
    g.fillStyle = o.color; g.textBaseline = "middle";
    lines.forEach((l, i) => {
      const lw = g.measureText(l).width, x = o.align === "right" ? pad + wMax - lw : o.align === "center" ? pad + (wMax - lw) / 2 : pad;
      g.fillText(l, x, pad + lh * (i + 0.5) + o.size * 0.04);
    });
    return { cv, w, h, pad, lines, lh, wMax };
  }

  /* ------------------------------------------------------------ manuscrito */
  const LOREM = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aliquam dignissim tempor ex, in sapien sed est dolor. Mauris et amet consectetur et, commodo eget turpis. Vestibulum scelerisque dui nec lorem, et dictum ut erat. Donec a dui sit amet erat bibendum commodo, ut tortor. Nam rhoncus metus in ipsum porta faucibus. Phasellus vel nulla nisi, et tincidunt lectus. Curabitur sed mauris quis mi ultricies posuere. Praesent aliquet nibh in enim. Vivamus vitae turpis vel diam dictum maximus. Duis volutpat augue et massa viverra, id ullamcorper urna feugiat.";
  /** bloque de cursiva inglesa (lorem) del tamaño pedido, en px CSS */
  function handCanvas(w, h, size, color, dpr, seed) {
    const cv = mkCanvas(w * dpr, h * dpr), g = cv.getContext("2d"), r = K.rng(seed);
    g.scale(dpr, dpr); g.font = `400 ${size}px 'Mrs Saint Delafield', cursive`; g.fillStyle = color; g.textBaseline = "alphabetic";
    const words = LOREM.split(" "); let wi = Math.floor(r() * words.length);
    const lh = size * 0.95;
    for (let y = size * 0.9, row = 0; y < h - size * 0.1; y += lh, row++) {
      let x = (row === 0 ? w * 0.25 : r() * size * 0.6), line = "";
      while (true) { const nx = words[wi % words.length]; const t = line ? line + " " + nx : nx; if (g.measureText(t).width > w - x - size * 0.3) break; line = t; wi++; }
      g.save(); g.translate(x, y); g.rotate(-0.012 + r() * 0.01); g.globalAlpha = 0.75 + r() * 0.25; g.fillText(line, 0, 0); g.restore();
    }
    return cv;
  }

  /* ------------------------------------------------------------ familia */
  K.family("acuarela", {
    setup(ctx) {
      const st = ctx.stage, P = ctx.C.palette;
      const css = document.createElement("style");
      css.textContent = `[data-family="acuarela"] .k-cap{font-family:'Barlow Condensed',sans-serif;font-weight:500;color:${P.ink}b0;font-size:clamp(14px,3.1vmin,40px);letter-spacing:.01em;text-shadow:0 0 9px ${P.paperHi || P.paper},0 0 3px ${P.paperHi || P.paper}}
[data-family="acuarela"] .k-w-cur{color:${P.date};font-weight:600}`;
      document.head.appendChild(css);
      return { paper: makePaper(st.W, st.H, P, (ctx.C.seed ?? 1) + 11), grain: makeGrain((ctx.C.seed ?? 1) + 5), scr: mkCanvas(4, 4) };
    },
    resize(ctx, F) { F.paper = makePaper(ctx.stage.W, ctx.stage.H, ctx.C.palette, (ctx.C.seed ?? 1) + 11); },
    frame(t, ctx, F) {
      const { W, H } = ctx.stage, G = ctx.g.bg;
      G.drawImage(F.paper, 0, 0, W, H);
    },
    post(t, ctx, F) {
      const { W, H } = ctx.stage, P = ctx.C.palette, A = ctx.C.acuarela || {}, dpr = ctx.dpr;
      /* 1) virado sepia: envolvente por escena + barrido de luz cálida de izquierda a derecha */
      let S = 0, sweep = 0.5;
      for (const b of ctx.beats) {
        if (!mine(b) || t < b.t0 || t > b.t0 + 3.4 || /outro$/.test(b.use)) continue;
        const lt = t - b.t0, k = clamp(b.dur / 4, 0.6, 1);
        const s = prog(lt, 0.3 * k, 0.55 * k, "sine") * (1 - prog(lt, 1.55 * k, 1.0 * k, "sine"));
        if (s > S) { S = s; sweep = lerp(-0.3, 1.3, prog(lt, 0.3 * k, 2.2 * k, "linear")); }
      }
      S *= A.sepia ?? 0.85;
      if (S > 0.01) {
        const gradFor = (G, mul) => {
          const gr = G.createLinearGradient(0, 0, W, 0);
          for (let i = 0; i <= 12; i++) { const x = i / 12, a = S * mul * (0.42 + 0.58 * Math.exp(-Math.pow((x - sweep) / 0.28, 2))); gr.addColorStop(x, rgba(P.sepia, a)); }
          return gr;
        };
        /* fondo opaco: blend directo */
        const B = ctx.g.bg; B.save(); B.globalCompositeOperation = "color"; B.fillStyle = gradFor(B, 0.55); B.fillRect(0, 0, W, H); B.restore();
        /* capa principal: con lienzo auxiliar para no pintar las zonas transparentes */
        const M = ctx.g.main, cvM = ctx.layers.main, scr = F.scr;
        if (scr.width !== cvM.width || scr.height !== cvM.height) { scr.width = cvM.width; scr.height = cvM.height; }
        const g = scr.getContext("2d");
        g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "copy"; g.drawImage(cvM, 0, 0);
        g.setTransform(dpr, 0, 0, dpr, 0, 0); g.globalCompositeOperation = "color"; g.fillStyle = gradFor(g, 1); g.fillRect(0, 0, W, H);
        g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "destination-in"; g.drawImage(cvM, 0, 0); g.globalCompositeOperation = "source-over";
        M.save(); M.setTransform(1, 0, 0, 1, 0, 0); M.globalCompositeOperation = "copy"; M.drawImage(scr, 0, 0); M.restore();
      }
      const T = ctx.g.top;
      /* 2) grano de película (cambia a 12 fps, función de t) */
      const gr = A.grain ?? 0.05;
      if (gr > 0) {
        const tile = F.grain[Math.floor(t * 12) % F.grain.length];
        T.save(); T.globalAlpha = gr; T.globalCompositeOperation = "source-over";
        const pat = T.createPattern(tile, "repeat"); T.fillStyle = pat; T.translate((Math.floor(t * 12) * 37) % 256, (Math.floor(t * 12) * 91) % 256); T.fillRect(-256, -256, W + 512, H + 512); T.restore();
      }
      /* 3) velo blanco cálido de las transiciones (salida: se lava a papel; entrada: aparece desde el blanco) */
      if (A.veil !== false) {
        let v = 0;
        for (const b of ctx.beats) {
          if (!mine(b)) continue;
          if (t >= b.t0 && t < b.t0 + 1.0) v = Math.max(v, 1 - prog(t, b.t0 + 0.12, 0.85, "sine"));
          if (b.t1 < ctx.total - 0.1 && !/outro$/.test(b.use)) {
            if (t >= b.t1 - 0.3 && t < b.t1 + 0.12) v = Math.max(v, prog(t, b.t1 - 0.3, 0.42, "sine"));
            else if (t >= b.t1 + 0.12 && t < b.t1 + 1.0) v = Math.max(v, 1 - prog(t, b.t1 + 0.12, 0.85, "sine"));
          }
        }
        if (v > 0.003) { T.save(); T.globalAlpha = v; T.fillStyle = P.flash; T.fillRect(0, 0, W, H); T.restore(); }
      }
      /* 4) el cierre queda legible y solo se funde al negro en sus últimos 0,45 s */
      const end = ctx.total, fb = clamp((t - (end - 0.45)) / 0.45);
      if (fb > 0 && ctx.beats.some(b => /^acuarela\.outro$/.test(b.use) && t >= b.t0)) { T.save(); T.globalAlpha = fb * fb * (3 - 2 * fb); T.fillStyle = "#000"; T.fillRect(0, 0, W, H); T.restore(); }
    },
  });
  function rgba(c, a) { const [r, g, b] = hex(c); return `rgba(${r},${g},${b},${clamp(a).toFixed(3)})`; }

  /* ------------------------------------------------------------ escena */
  /** movimientos de entrada del grupo de fotos (desplazamiento en fracción de W/H, escala, giro) */
  const ENTER = {
    down: { dx: 0, dy: -0.42, s: 1, r: 0 }, up: { dx: 0.08, dy: 0.42, s: 1, r: 0 },
    left: { dx: -0.32, dy: 0, s: 1, r: 0 }, right: { dx: 0.34, dy: -0.07, s: 1, r: 0 },
    zoom: { dx: 0, dy: -0.06, s: 1.32, r: 0 }, tilt: { dx: -0.05, dy: 0.02, s: 1.42, r: -9 },
    shrink: { dx: -0.22, dy: 0, s: 1.25, r: 0 }, none: { dx: 0, dy: 0, s: 1, r: 0 },
  };
  /** tamaños tipográficos por orientación (px CSS) */
  function sizes(st) {
    const { W, H, portrait } = st;
    return portrait ? { date: W * 0.1, para: W * 0.041, title: W * 0.13, sub: W * 0.042, quote: W * 0.047, name: W * 0.048, hand: W * 0.03, rule: W * 0.08, gap: W * 0.035, maxW: W * 0.86 }
                    : { date: H * 0.07, para: H * 0.0225, title: H * 0.097, sub: H * 0.024, quote: H * 0.029, name: H * 0.027, hand: H * 0.022, rule: W * 0.04, gap: W * 0.022, maxW: W * 0.46 };
  }

  /**
   * Arma una escena. spec (fracciones de W/H salvo que se diga):
   *  blot:   { src, lobes:[{x,y,rx,ry}], th, alpha, wash } | null    ← mancha-foto de fondo
   *  hands:  [{ x,y,w,h, over }]                                    ← bloques manuscritos
   *  photos: [{ src, box:[x,y,w,h], frame, focus }]                 ← en orden de apilado
   *  enter:  clave de ENTER (movimiento del grupo de fotos)
   *  blocks: [{ x,y, align, date, para, title, sub, quote, name, rule, maxW, from, at }]
   */
  function scene(ctx, spec) {
    const st = ctx.stage, { W, H } = st, dpr = ctx.dpr, P = ctx.C.palette, A = ctx.C.acuarela || {}, Z = sizes(st), seed = ctx.rng() * 1e6 | 0;
    const k = clamp(ctx.beat.dur / 4, 0.6, 1);
    /* --- mancha */
    let blot = null;
    if (spec.blot) {
      const B = spec.blot, im = B.src ? ctx.img(B.src) : null;
      const src = mkCanvas(W * dpr, H * dpr), g = src.getContext("2d");
      g.fillStyle = P.paper; g.fillRect(0, 0, src.width, src.height);
      if (im) {
        const ph = gradePhoto(im, src.width, src.height, B.focus || [0.5, 0.5], seed + 1, { contrast: 0.95, brightness: 1.0 });
        g.globalAlpha = B.wash ?? 0.5; g.drawImage(ph, 0, 0); g.globalAlpha = 1;
      } else {
        /* sin foto: lavado de tinta gris con granulación */
        const n = fbm(seed + 4, 160, 90, 3, 5), c = mkCanvas(160, 90), cg = c.getContext("2d"), id = cg.createImageData(160, 90), [r0, g0, b0] = hex(P.wash);
        for (let i = 0; i < n.length; i++) { const a = 0.35 + n[i] * 0.5; id.data[i * 4] = r0; id.data[i * 4 + 1] = g0; id.data[i * 4 + 2] = b0; id.data[i * 4 + 3] = a * 255; }
        cg.putImageData(id, 0, 0); g.imageSmoothingQuality = "high"; g.drawImage(c, 0, 0, src.width, src.height);
      }
      const mw = Math.ceil(W / 2.4), mh = Math.ceil(H / 2.4);
      const gran = fbm(seed + 2, mw, mh, 24, 3, 0.6); for (let i = 0; i < gran.length; i++) gran[i] = 0.62 + gran[i] * 0.38;
      const f = fieldBlot(seed + 3, mw, mh, B.lobes, B.rough ?? 0.42, B.cells ?? 3.4);
      blot = { rv: Reveal(src, Mask(f, mw, mh, { soft: 0.05, gran, rim: 0.2 })), th: B.th ?? 0.42, alpha: B.alpha ?? 0.92 };
    }
    /* --- manuscrito */
    const hands = A.handwriting === false ? [] : (spec.hands || []).map((h, i) => {
      const w = h.w * W, hh = h.h * H, cv = handCanvas(w, hh, h.size || Z.hand, P.hand, dpr, seed + 20 + i);
      const mw = Math.max(8, Math.ceil(w / 4)), mh = Math.max(8, Math.ceil(hh / 4));
      return { ...h, w, h: hh, x: h.x * W, y: h.y * H, rv: Reveal(cv, Mask(fieldPatch(seed + 30 + i, mw, mh, 5, 0.45), mw, mh, { soft: 0.08 })) };
    });
    /* --- fotos */
    const photos = (spec.photos || []).map((p, i) => {
      const [x, y, w, h] = p.box, fp = framedPhoto(ctx.img(p.src), w * W, h * H, dpr, { frame: p.frame, focus: p.focus, seed: seed + 40 + i });
      return { ...p, x: x * W, y: y * H, w: w * W, h: h * H, fp };
    });
    let gx = W / 2, gy = H / 2;
    if (photos.length) { const x0 = Math.min(...photos.map(p => p.x)), x1 = Math.max(...photos.map(p => p.x + p.w)), y0 = Math.min(...photos.map(p => p.y)), y1 = Math.max(...photos.map(p => p.y + p.h)); gx = (x0 + x1) / 2; gy = (y0 + y1) / 2; }
    /* --- textos */
    const texts = [];
    (spec.blocks || []).forEach((bl, bi) => {
      const align = bl.align || "left", x = bl.x * W; let y = bl.y * H;
      const at = (bl.at ?? 0.62) * k;
      const add = (str, o, kind, extra = {}) => {
        const tc = textCanvas(str, { align, ...o }, dpr);
        const mw = Math.max(8, Math.ceil(tc.w / 3)), mh = Math.max(6, Math.ceil(tc.h / 3));
        const from = bl.from || (align === "right" ? "right" : "left");
        const field = kind === "para" ? fieldPatch(seed + 60 + texts.length, mw, mh, Math.max(4, tc.w / (o.size * 1.6)), 0.35) : fieldDir(seed + 60 + texts.length, mw, mh, kind === "title" ? "left" : from, 0.38, Math.max(3, tc.w / (o.size * 0.9)));
        const left = align === "right" ? x - tc.wMax - tc.pad : align === "center" ? x - tc.wMax / 2 - tc.pad : x - tc.pad;
        const it = { kind, tc, x: left, y: y - tc.pad, rv: Reveal(tc.cv, Mask(field, mw, mh, { soft: kind === "para" ? 0.1 : 0.07 })), from, align, ...extra };
        texts.push(it); y += tc.h - tc.pad * 2; return it;
      };
      if (bl.title) {
        const t = add(bl.title, { font: "Oswald", weight: 500, size: Z.title, color: P.date, upper: true, spacing: Z.title * 0.01 }, "title", { at, rule: "both", slide: 0, dur: 0.9 });
        y += Z.title * 0.35;
        if (bl.sub) add(bl.sub, { font: "'Barlow Condensed'", weight: 600, size: Z.sub, color: P.ink }, "para", { at: at + 0.45 * k, dur: 0.8 });
      }
      if (bl.date) {
        add(bl.date, { font: "Oswald", weight: 500, size: Z.date, color: P.date }, "date", { at, rule: bl.rule === false ? null : (align === "center" ? "both" : align === "right" ? "left" : "right"), slide: bl.slide ?? (align === "center" ? 0.02 : 0.075), dur: 0.65 });
        y += Z.date * 0.28;
      }
      if (bl.para) add(bl.para, { font: "'Barlow Condensed'", weight: 500, size: Z.para, color: P.ink, maxW: (bl.maxW ? bl.maxW * W : Z.maxW), lh: 1.22 }, "para", { at: at + 0.25 * k, dur: 1.0 });
      if (bl.quote) { add(bl.quote, { font: "'Barlow Condensed'", weight: 500, size: Z.quote, color: P.ink, maxW: (bl.maxW ? bl.maxW * W : Z.maxW), lh: 1.25 }, "para", { at, dur: 1.2 }); y += Z.quote * 0.9; }
      if (bl.name) {
        /* la firma va alineada al borde derecho del bloque de la cita */
        const qx = bl.nameX != null ? bl.nameX * W : x;
        const tc = textCanvas(bl.name, { font: "Oswald", weight: 500, size: Z.name, color: P.accent, align: "right" }, dpr);
        const mw = Math.max(8, Math.ceil(tc.w / 3)), mh = Math.max(6, Math.ceil(tc.h / 3));
        texts.push({ kind: "name", tc, x: qx - tc.wMax - tc.pad, y: y - tc.pad, rv: Reveal(tc.cv, Mask(fieldDir(seed + 99, mw, mh, "right", 0.38, 4), mw, mh, { soft: 0.07 })), at: (bl.nameAt ?? 0.45) * k, dur: 0.6, slide: 0.03, from: "right" });
      }
    });

    const E = ENTER[spec.enter] || ENTER.none;
    return {
      render(lt, b) {
        const G = ctx.g.main, out = 1 - prog(lt, b.dur - 0.3, 0.42, "sine");
        if (out <= 0.002) return;
        G.save();
        /* mancha: florece desde los lóbulos y respira lento */
        if (blot) {
          const p = prog(lt, (spec.blot.at ?? 0.32) * k, (spec.blot.dur ?? 1.0) * k, "out"), s = 1 + 0.03 * clamp(lt / Math.max(4, b.dur));
          const th = lerp(1.0, blot.th, p);
          G.save(); G.translate(W / 2, H / 2); G.scale(s, s); G.translate(-W / 2, -H / 2);
          blot.rv.draw(G, 0, 0, W, H, th, blot.alpha * out); G.restore();
        }
        /* manuscrito por debajo */
        for (const h of hands) if (!h.over) h.rv.draw(G, h.x, h.y, h.w, h.h, thFull(prog(lt, (h.at ?? 0.5) * k, 1.1 * k, "linear"), 0.08), (h.alpha ?? 0.5) * out);
        /* fotos: el grupo entra con desaceleración fuerte; la segunda llega un poco después (paralaje) */
        photos.forEach((ph, i) => {
          const s0 = (0.1 + i * 0.09) * k, q = ease4((lt - s0) / (1.15 * k)), a = clamp((lt - s0) / 0.3) * out, par = 1 + i * 0.16;
          if (a <= 0) return;
          const sc = lerp(E.s, 1, q) * (1 + (par - 1) * (1 - q) * (E.s > 1 ? 0.5 : 0)), rot = lerp(E.r, 0, q) * Math.PI / 180;
          G.save(); G.globalAlpha = a;
          G.translate(gx + (1 - q) * E.dx * W * par, gy + (1 - q) * E.dy * H * par); G.rotate(rot); G.scale(sc, sc); G.translate(-gx, -gy);
          /* sombra muy leve de papel apoyado */
          G.shadowColor = "rgba(40,38,36,.18)"; G.shadowBlur = Math.min(W, H) * 0.012; G.shadowOffsetY = Math.min(W, H) * 0.004;
          G.drawImage(ph.fp.cv, ph.x - ph.fp.pad, ph.y - ph.fp.pad, ph.w + ph.fp.pad * 2, ph.h + ph.fp.pad * 2);
          G.restore();
        });
        /* manuscrito encima de las fotos (multiplicar, tenue) */
        for (const h of hands) if (h.over) { G.save(); G.globalCompositeOperation = "multiply"; h.rv.draw(G, h.x, h.y, h.w, h.h, thFull(prog(lt, (h.at ?? 0.6) * k, 1.1 * k, "linear"), 0.08), (h.alpha ?? 0.42) * out); G.restore(); }
        /* textos: deslizamiento horizontal + máscara de tinta que come las letras */
        for (const it of texts) {
          const p = prog(lt, it.at, it.dur * k, "linear"), q = ease4((lt - it.at) / (0.95 * k));
          if (p <= 0) continue;
          const dx = (1 - q) * (it.slide || 0) * W * (it.from === "right" ? 1 : -1);
          it.rv.draw(G, it.x + dx, it.y, it.tc.w, it.tc.h, thFull(p, it.kind === "para" ? 0.1 : 0.07), out);
          if (it.rule) {
            const rq = prog(lt, it.at + it.dur * k * 0.6, 0.45, "out"), len = (it.kind === "title" ? Z.rule * 0.75 : Z.rule) * rq, gap = it.kind === "title" ? Z.gap * 1.6 : Z.gap;
            const cy = it.y + it.tc.pad + it.tc.lh * 0.5, x0 = it.x + dx + it.tc.pad, x1 = x0 + it.tc.wMax;
            G.save(); G.globalAlpha = out * rq; G.strokeStyle = P.rule; G.lineWidth = Math.max(1, Math.min(W, H) * 0.0022);
            G.beginPath();
            if (it.rule === "left" || it.rule === "both") { G.moveTo(x0 - gap, cy); G.lineTo(x0 - gap - len, cy); }
            if (it.rule === "right" || it.rule === "both") { G.moveTo(x1 + gap, cy); G.lineTo(x1 + gap + len, cy); }
            G.stroke(); G.restore();
          }
        }
        G.restore();
      },
      dispose() {},
    };
  }

  /** lóbulos de mancha alrededor de cajas [x,y,w,h] + algunos sueltos (semilla fija) */
  function lobesAround(boxes, seed, extra = 3, spread = 1) {
    const r = K.rng(seed), L = [];
    for (const [x, y, w, h] of boxes) L.push({ x: x + w / 2, y: y + h / 2, rx: w * 0.85 * spread, ry: h * 1.05 * spread });
    const x0 = Math.min(...boxes.map(b => b[0])), x1 = Math.max(...boxes.map(b => b[0] + b[2])), y0 = Math.min(...boxes.map(b => b[1])), y1 = Math.max(...boxes.map(b => b[1] + b[3]));
    for (let i = 0; i < extra; i++) L.push({ x: lerp(x0 - 0.05, x1 + 0.05, r()), y: lerp(y0 - 0.08, y1 + 0.08, r()), rx: (0.13 + r() * 0.17) * spread, ry: (0.18 + r() * 0.24) * spread });
    return L;
  }

  K.acuarela = { scene, lobesAround, sizes, fbm, Mask, Reveal, fieldBlot, fieldDir, fieldPatch, framedPhoto, gradePhoto, textCanvas, handCanvas, thFull, ENTER, ease4 };
})();
