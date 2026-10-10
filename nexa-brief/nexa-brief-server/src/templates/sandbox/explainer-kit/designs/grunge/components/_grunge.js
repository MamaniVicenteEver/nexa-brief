/* =============================================================================
   grunge · runtime de la familia "tinta raída" (réplica del video Klickpin de
   títulos grunge: una palabra por escena, un color plano por palabra)
   -----------------------------------------------------------------------------
   · Todo se dibuja en ctx.g.main (canvas 2D). Cortes secos: transition.overlap = 0.
   · Texturas (suciedad de película, motas, rayones, agujeros, brochazos) se
     GENERAN aquí, una sola vez, con rng sembrado → offscreen canvas blancos que se
     tiñen al color de la escena (caché LRU). Nada copiado de la referencia.
   · Stop-motion: la suciedad "hierve" (tiembla 1 px) a boilFps; cada cuadro es
     función pura de t.
   · Negativos (fondo ↔ tinta) y espejos/volteos: los componentes los piden con
     GR.fx(ctx, {...}) y el post() de la familia los aplica a TODO el cuadro
     (remapeo de luminancia con LUT entre los dos colores de la escena).
   · Kit.grunge expone: scene, layout, ink, put, grime, band, splats, fx, tint…
   ========================================================================== */
(function () {
  const K = window.Kit, { clamp, lerp, prog } = K;
  const FONT = "Montserrat";
  for (const f of ["900 100px Montserrat", "800 40px Montserrat", "700 20px Montserrat"]) K.fonts.add(f);

  /* colores de la referencia (muestreados): c = plano, tone = medio tono de la tinta, dark = oscuro de la escena */
  const COLORS = {
    cream:   { c: "#f0e8d8", tone: "#5f7f8a", dark: "#1a1211" },
    mustard: { c: "#f4a02c", tone: "#8a5214", dark: "#1a1211" },
    mint:    { c: "#26a676", tone: "#17684c", dark: "#43201a" },
    coral:   { c: "#fb4b43", tone: "#8f2622", dark: "#18201a" },
    petrol:  { c: "#18738f", tone: "#0e435a", dark: "#1a1211" },
    pink:    { c: "#ef7888", tone: "#8e3c58", dark: "#1c1410" },
  };
  const hexRgb = h => { h = String(h).replace("#", ""); if (h.length === 3) h = h.split("").map(c => c + c).join(""); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const rgbHex = a => "#" + a.map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, "0")).join("");
  const mix = (a, b, t) => { const A = hexRgb(a), B = hexRgb(b); return rgbHex(A.map((v, i) => lerp(v, B[i], t))); };
  const lum = h => { const [r, g, b] = hexRgb(h); return (r * 77 + g * 150 + b * 29) >> 8; };

  const mk = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };

  /* --------------------------------------------------------------- formas */
  /** mancha irregular (polígono suavizado) */
  function blob(g, x, y, r, rnd, n = 11, jag = 0.5, sq = 1) {
    const a0 = rnd() * 6.283, pts = [];
    for (let i = 0; i < n; i++) { const a = a0 + i / n * 6.283, rr = r * (1 - jag / 2 + jag * rnd()); pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * sq]); }
    const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    g.beginPath(); const m0 = mid(pts[n - 1], pts[0]); g.moveTo(m0[0], m0[1]);
    for (let i = 0; i < n; i++) { const p = pts[i], m = mid(p, pts[(i + 1) % n]); g.quadraticCurveTo(p[0], p[1], m[0], m[1]); }
    g.closePath(); g.fill();
  }
  /** salpicadura: mancha central + gotas satélite + estrías hacia afuera */
  function splat(g, x, y, r, rnd, k = 1) {
    blob(g, x, y, r, rnd, 13, 0.7);
    const nd = 10 + Math.floor(rnd() * 16);
    for (let i = 0; i < nd; i++) {
      const a = rnd() * 6.283, d = r * (1.1 + Math.pow(rnd(), 1.6) * 2.6 * k), rr = r * (0.04 + Math.pow(rnd(), 2) * 0.32);
      blob(g, x + Math.cos(a) * d, y + Math.sin(a) * d, rr, rnd, 7, 0.5);
      if (rnd() < 0.35) { /* estría: gota alargada en la dirección del disparo */
        g.save(); g.translate(x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9); g.rotate(a);
        g.beginPath(); g.ellipse(d * 0.35, 0, d * 0.35, rr * 0.45 + 0.4, 0, 0, 6.283); g.fill(); g.restore();
      }
    }
  }

  /* --------------------------------------------------------------- texturas */
  /** genera las texturas (blanco sobre transparente) a media resolución del cuadro */
  function textures(W, H, dpr, seed) {
    const TS = 0.5, TW = Math.round(W * dpr * TS), TH = Math.round(H * dpr * TS);
    const s = Math.min(TW, TH) / 540, X = v => v * TW, Y = v => v * TH;
    const r = K.rng(seed), W8 = "#fff";
    const T = { TW, TH };

    /* 1) suciedad de película fija (marco, motas, anillos, grietas) */
    {
      const c = mk(TW, TH), g = c.getContext("2d"); g.fillStyle = W8; g.strokeStyle = W8;
      /* línea de perforación punteada (x≈2,5 %) y raya vertical gruesa rota (x≈3,5 %) */
      for (let y = Y(0.02); y < TH; y += s * 7.5) if (r() > 0.12) g.fillRect(X(0.024) - s, y, s * 2.4, s * (3 + r() * 2));
      for (let y = Y(0.1); y < Y(0.96);) { const len = s * (8 + r() * 60); if (r() > 0.25) { g.globalAlpha = 0.7 + r() * 0.3; g.fillRect(X(0.036) + (r() - 0.5) * s, y, s * (2 + r() * 2.5), len); } y += len + s * (2 + r() * 14); }
      g.globalAlpha = 1;
      /* esquina punteada arriba a la izquierda y abajo */
      for (let x = X(0.02); x < X(0.15); x += s * 7) if (r() > 0.15) g.fillRect(x, Y(0.075), s * (3 + r() * 2), s * 2.2);
      for (let x = X(0.02); x < X(0.09); x += s * 7) if (r() > 0.3) g.fillRect(x, Y(0.94), s * 3, s * 2);
      /* rayas verticales finas a la derecha (x≈97 %) y marcas tipo eslabón */
      for (let i = 0; i < 5; i++) { g.globalAlpha = 0.5 + r() * 0.5; g.fillRect(X(0.955 + r() * 0.03), Y(r() * 0.1), s * (1 + r() * 1.5), Y(0.05 + r() * 0.25)); }
      g.globalAlpha = 1; g.lineWidth = s * 1.6;
      for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(X(0.93 + r() * 0.04), Y(0.25 + i * 0.09 + r() * 0.03), s * 3, s * 8, 0, 0, 6.283); g.stroke(); }
      /* grietas diagonales finas */
      g.lineWidth = s * 0.9; g.globalAlpha = 0.85;
      const crack = pts => { g.beginPath(); g.moveTo(X(pts[0][0]), Y(pts[0][1])); for (const p of pts.slice(1)) g.lineTo(X(p[0]) + (r() - 0.5) * s * 3, Y(p[1]) + (r() - 0.5) * s * 3); g.stroke(); };
      crack([[0.40, 0.50], [0.44, 0.45], [0.47, 0.40], [0.55, 0.36], [0.62, 0.32], [0.70, 0.27], [0.78, 0.21], [0.84, 0.19]]);
      crack([[0.72, 0.52], [0.69, 0.62], [0.65, 0.74], [0.62, 0.86], [0.59, 0.99]]);
      crack([[0.05, 0.62], [0.12, 0.66], [0.20, 0.69]]);
      g.globalAlpha = 1;
      /* motas: muchas finas, algunas medianas, anillos */
      for (let i = 0; i < 650; i++) { g.globalAlpha = 0.55 + r() * 0.45; blob(g, r() * TW, r() * TH, s * (0.5 + Math.pow(r(), 3) * 3.2), r, 7, 0.6); }
      for (let i = 0; i < 38; i++) { g.globalAlpha = 0.8 + r() * 0.2; blob(g, r() * TW, r() * TH, s * (2.5 + r() * 4.5), r, 10, 0.7); }
      g.lineWidth = s * 1.1;
      for (let i = 0; i < 14; i++) { g.globalAlpha = 0.6 + r() * 0.4; g.beginPath(); g.ellipse(r() * TW, r() * TH, s * (2.5 + r() * 5), s * (2.5 + r() * 6), r() * 3, 0, 6.283); g.stroke(); }
      /* manchón tenue (mancha clara/rojiza de la referencia) */
      g.globalAlpha = 0.12; for (let i = 0; i < 6; i++) blob(g, X(0.3) + (r() - 0.5) * s * 30, Y(0.3) + (r() - 0.5) * s * 20, s * (8 + r() * 10), r, 9, 0.8);
      g.globalAlpha = 1;
      T.grime = c;
    }

    /* 2) motas densas para rellenar letras, en 3 etapas acumuladas (materializar por salpicaduras) */
    {
      const N = 5200, dots = [];
      for (let i = 0; i < N; i++) dots.push([r() * TW, r() * TH, s * (0.45 + Math.pow(r(), 4) * 5.5)]);
      const big = []; for (let i = 0; i < 45; i++) big.push([r() * TW, r() * TH, s * (3 + r() * 6)]);
      const stages = [0.12, 0.38, 1].map(() => mk(TW, TH));
      stages.forEach((c, k) => {
        const g = c.getContext("2d"), rr = K.rng(seed + 11); g.fillStyle = W8;
        const n = Math.round(N * [0.12, 0.38, 1][k]);
        for (let i = 0; i < n; i++) blob(g, dots[i][0], dots[i][1], dots[i][2], rr, 8, 0.6);
        const nb = Math.round(big.length * [0.1, 0.4, 1][k]);
        for (let i = 0; i < nb; i++) blob(g, big[i][0], big[i][1], big[i][2], rr, 11, 0.75);
      });
      T.speck = stages;
    }

    /* 3) rayones verticales tipo madera / óxido */
    {
      const c = mk(TW, TH), g = c.getContext("2d"); g.fillStyle = W8;
      for (let i = 0; i < 520; i++) { g.globalAlpha = 0.25 + r() * 0.75; const x = r() * TW, y = r() * TH * 1.1 - TH * 0.05, w = s * (0.4 + Math.pow(r(), 2) * 3.5), h = TH * (0.03 + Math.pow(r(), 1.5) * 0.55); g.fillRect(x, y, w, h); }
      for (let i = 0; i < 120; i++) { g.globalAlpha = 0.5 + r() * 0.5; blob(g, r() * TW, r() * TH, s * (1 + r() * 5), r, 9, 0.8, 0.5 + r()); }
      for (let i = 0; i < 40; i++) { g.globalAlpha = 0.6; g.fillRect(r() * TW, r() * TH, s * (6 + r() * 30), s * (0.8 + r() * 1.5)); }
      g.globalAlpha = 1; T.scratch = c;
    }

    /* 4) agujeros (se restan a las letras: bordes comidos, letras "raídas") */
    {
      const c = mk(TW, TH), g = c.getContext("2d"); g.fillStyle = W8;
      for (let i = 0; i < 420; i++) blob(g, r() * TW, r() * TH, s * (0.6 + Math.pow(r(), 2.4) * 7), r, 9, 0.8);
      for (let i = 0; i < 60; i++) { g.save(); g.translate(r() * TW, r() * TH); g.beginPath(); g.ellipse(0, 0, s * (6 + r() * 26), s * (0.6 + r() * 1.4), (r() - 0.5) * 0.1, 0, 6.283); g.fill(); g.restore(); }
      T.holes = c;
    }

    /* 5) brochazo horizontal (2 variantes) — alto = media pantalla */
    T.band = [0, 1].map(v => {
      const BW = TW, BH = Math.round(TH * 0.5), c = mk(BW, BH), g = c.getContext("2d"), rr = K.rng(seed + 31 + v * 7);
      g.fillStyle = W8;
      /* pasadas de rodillo: muchas tiras horizontales, núcleo denso y bordes deshilachados */
      for (let i = 0; i < 2300; i++) {
        const gy = (rr() + rr()) / 2, y = BH * (0.1 + gy * 0.8), x0 = BW * (-0.25 + rr() * 0.6), len = BW * (0.25 + rr() * 1.05);
        g.globalAlpha = (0.16 + rr() * 0.5) * (1 - Math.abs(gy - 0.5) * 0.9);
        const th = s * (0.6 + Math.pow(rr(), 2) * 7);
        g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + len, y + (rr() - 0.5) * s * 3); g.lineTo(x0 + len - s * 10, y + th); g.lineTo(x0 + s * 4, y + th * (0.6 + rr() * 0.6)); g.fill();
      }
      /* pincel seco: rayas finas sin pintura dentro de la franja */
      g.globalCompositeOperation = "destination-out";
      for (let i = 0; i < 380; i++) { g.globalAlpha = 0.3 + rr() * 0.6; g.fillRect(BW * (rr() * 1.1 - 0.1), BH * (0.12 + rr() * 0.76), BW * (0.05 + rr() * 0.45), s * (0.4 + rr() * 1.6)); }
      g.globalCompositeOperation = "source-over";
      /* motas y grumos de pintura */
      for (let i = 0; i < 220; i++) { g.globalAlpha = 0.5 + rr() * 0.5; blob(g, rr() * BW, BH * (0.15 + rr() * 0.7), s * (0.6 + Math.pow(rr(), 2) * 5), rr, 8, 0.7, 0.35 + rr() * 0.5); }
      /* borde superior: línea gruesa ondulada casi continua; inferior: línea fina rota */
      g.globalAlpha = 1;
      const edge = (yy, th, gaps, segMin) => {
        let x = -s * 6;
        while (x < BW) {
          const L = s * (segMin + rr() * 220), n = Math.max(4, Math.round(L / (s * 8)));
          if (rr() > gaps) {
            const top = [], bot = [];
            for (let k = 0; k <= n; k++) { const xx = x + L * k / n, w = Math.sin(xx / (s * 37)) * s * 2.2; top.push([xx, yy + w + (rr() - 0.5) * s * 1.6]); bot.push([xx, yy + w + th * (0.35 + rr() * 0.9)]); }
            g.beginPath(); g.moveTo(top[0][0], top[0][1]); for (const q of top) g.lineTo(q[0], q[1]); for (const q of bot.reverse()) g.lineTo(q[0], q[1]); g.fill();
          }
          x += L + s * (1 + rr() * 8);
        }
      };
      edge(BH * 0.075, s * 6, 0.05, 120); edge(BH * 0.95, s * 2.6, 0.3, 40);
      return c;
    });

    /* 6) granos de película (4 baldosas) */
    T.grain = [0, 1, 2, 3].map(v => {
      const n = 160, c = mk(n, n), g = c.getContext("2d"), id = g.createImageData(n, n), rr = K.rng(seed + 97 + v);
      for (let i = 0; i < n * n; i++) { const q = rr(); const val = q < 0.5 ? 0 : 255; id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = val; id.data[i * 4 + 3] = Math.floor(Math.pow(Math.abs(q - 0.5) * 2, 2.2) * 255); }
      g.putImageData(id, 0, 0); return c;
    });
    return T;
  }

  /* --------------------------------------------------------------- estado */
  let S = null;                         /* estado de la familia (uno por página) */
  const SCENE_RE = /^grunge\.(title|word|photo|stamp|brush|slam|closeup)$/;

  function setup(ctx) {
    const { W, H } = ctx.stage, G = ctx.C.grunge || {};
    S = ctx.family.grunge = ctx.family.grunge || {};
    S.cfg = { grain: G.grain ?? 0.07, flicker: G.flicker ?? 0.035, boilFps: G.boilFps ?? 12, colors: G.colors || Object.keys(COLORS) };
    S.tex = textures(W, H, ctx.dpr, (ctx.C.seed ?? 1) * 7 + 3);
    S.tmp1 = mk(W * ctx.dpr, H * ctx.dpr); S.tmp2 = mk(W * ctx.dpr, H * ctx.dpr);
    S.tint = new Map();
    /* orden de cada escena (color/polaridad automáticos rotan como la referencia) */
    S.ord = new Map(); let n = 0;
    for (const b of ctx.beats) if (SCENE_RE.test(b.use)) S.ord.set(b.i, n++);
    S.flips = ctx.beats.filter(b => b.use === "grunge.flip");
    /* subtítulos con la tipografía del diseño: caja casi negra, palabra actual en el color de la escena */
    if (!document.getElementById("grunge-css")) {
      const st = document.createElement("style"); st.id = "grunge-css";
      st.textContent = `
[data-family="grunge"] .k-cap { font-family: ${FONT}, "Arial Black", sans-serif; font-weight: 800; text-transform: uppercase;
  letter-spacing: .015em; color: rgba(240,232,216,.74); font-size: clamp(14px, 3.05vmin, 42px); line-height: 1.12; text-shadow: none; }
[data-family="grunge"] .k-cap-line { background: rgba(26,18,17,.9); padding: .2em .55em .14em; max-width: 90% !important;
  clip-path: polygon(0 6%, 3% 0, 40% 4%, 71% 0, 100% 5%, 99% 52%, 100% 96%, 63% 100%, 28% 95%, 2% 100%, 0 60%); }
[data-family="grunge"] .k-w-cur { color: var(--gr-accent, #f4a02c); font-weight: 900; }`;
      document.head.appendChild(st);
    }
    return S;
  }

  /* --------------------------------------------------------------- color / escena */
  /** colores y polaridad de un beat: {S plano, T tono, D oscuro, light (color primero), flip, ord} */
  function scene(ctx, p = {}) {
    const ord = S.ord.get(ctx.beat?.i) ?? 0, names = S.cfg.colors;
    const key = p.color && p.color !== "auto" ? p.color : names[ord % names.length];
    const base = COLORS[key] || { c: key, tone: mix(key, "#1a1211", 0.55), dark: ctx.C.palette.bg };
    const light = p.polarity === "light" ? true : p.polarity === "dark" ? false : ord % 3 === 2;
    const flip = p.flip && p.flip !== "auto" ? p.flip : ["y", "none", "x", "none", "y", "x"][ord % 6];
    return { S: base.c, T: base.tone, D: base.dark, light, flip, ord, key };
  }

  let TID = 0;
  /** textura blanca teñida (caché LRU de 28 entradas) */
  function tint(tex, color) {
    const key = (tex._id ||= "t" + (++TID)) + color;
    let c = S.tint.get(key);
    if (c) { S.tint.delete(key); S.tint.set(key, c); return c; }
    c = mk(tex.width, tex.height); const g = c.getContext("2d");
    g.drawImage(tex, 0, 0); g.globalCompositeOperation = "source-in"; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
    S.tint.set(key, c);
    if (S.tint.size > 28) { const k0 = S.tint.keys().next().value; S.tint.get(k0).width = 0; S.tint.delete(k0); }
    return c;
  }
  const boilFrame = t => Math.floor(t * S.cfg.boilFps);

  /* --------------------------------------------------------------- tipografía */
  const mc = mk(4, 4).getContext("2d");
  const fontOf = (fs, w = 900) => `${w} ${fs}px ${FONT}`;
  const CAP = 0.70;                       /* alto de mayúscula de Montserrat / em */
  function measure(str, fs, track = 0, w = 900) {
    mc.font = fontOf(fs, w); let x = 0;
    for (const ch of str) x += mc.measureText(ch).width + track * fs;
    return x - track * fs;
  }
  /**
   * Ubica renglones de mayúsculas. o = { lines, fs, track, align:"left"|"center", x, cy (centro vertical del bloque), gap (× alto de mayúscula) }
   * → { glyphs:[{ch,x,y,w,li}], lines:[{x,w,y}], top, bottom, left, right, ch, fs, font }
   */
  function layout(o) {
    const fs = o.fs, ch = fs * CAP, gap = o.gap ?? 0.28, track = o.track ?? -0.01;
    const n = o.lines.length, blockH = ch * n + ch * gap * (n - 1), top = o.cy - blockH / 2;
    mc.font = fontOf(fs, o.weight || 900);
    const glyphs = [], lines = [];
    o.lines.forEach((ln, li) => {
      const w = measure(ln, fs, track, o.weight || 900), base = top + ch * (li + 1) + ch * gap * li;
      let x = o.align === "center" ? o.x - w / 2 : o.x; lines.push({ x, w, y: base });
      mc.font = fontOf(fs, o.weight || 900);
      for (const c of ln) { const cw = mc.measureText(c).width; glyphs.push({ ch: c, x, y: base, w: cw, li }); x += cw + track * fs; }
    });
    const left = Math.min(...lines.map(l => l.x)), right = Math.max(...lines.map(l => l.x + l.w));
    return { glyphs, lines, top, bottom: top + blockH, left, right, ch, fs, font: fontOf(fs, o.weight || 900) };
  }
  /** tamaño de letra para que el renglón más largo mida `w` px */
  const fitFs = (lines, w, track = -0.01) => w / Math.max(1e-3, ...lines.map(l => measure(l, 100, track) / 100));

  /* --------------------------------------------------------------- tinta */
  function prep(g, ctx) { const { W, H } = ctx.stage; g.setTransform(ctx.dpr, 0, 0, ctx.dpr, 0, 0); g.globalCompositeOperation = "source-over"; g.globalAlpha = 1; g.clearRect(0, 0, W, H); }
  function drawTex(g, cv, ctx, ox = 0, oy = 0, sc = 1) { const { W, H } = ctx.stage; g.drawImage(cv, ox, oy, W * sc, H * sc); }
  /** relleno + texturas sobre lo ya dibujado en g (source-in / source-atop) */
  function paint(g, ctx, fill, tex) {
    const { W, H } = ctx.stage;
    g.globalCompositeOperation = "source-in";
    if (typeof fill === "string") { g.fillStyle = fill; g.fillRect(0, 0, W, H); }
    else if (fill && fill.tex) drawTex(g, fill.raw ? fill.tex : tint(fill.tex, fill.color), ctx, fill.ox, fill.oy, fill.sc);
    g.globalCompositeOperation = "source-atop";
    for (const x of tex || []) { if (!x) continue; g.globalAlpha = x.alpha ?? 1; drawTex(g, tint(x.tex, x.color), ctx, x.ox || 0, x.oy || 0, x.sc || 1); }
    g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
  }
  /**
   * Arma en tmp1 un texto entintado (no lo pone en pantalla: usar put()).
   * o = { L (layout), fill, tex:[{tex,color,alpha,ox,oy,sc}], letters:[{fill,tex}] (por letra, cíclico),
   *       holes:{alpha,ox,oy,sc}, erode(g), fadeRight:[desde 0..1, alfa] }
   */
  function ink(ctx, o) {
    const g = S.tmp1.getContext("2d"), L = o.L; prep(g, ctx);
    if (o.letters) {
      const g2 = S.tmp2.getContext("2d");
      L.glyphs.forEach((gl, i) => {
        if (gl.ch === " ") return;
        const st = o.letters[i % o.letters.length]; prep(g2, ctx);
        g2.font = L.font; g2.fillStyle = "#fff"; g2.fillText(gl.ch, gl.x, gl.y);
        paint(g2, ctx, st.fill, st.tex);
        g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(S.tmp2, 0, 0); g.setTransform(ctx.dpr, 0, 0, ctx.dpr, 0, 0);
      });
    } else {
      g.font = L.font; g.fillStyle = "#fff"; g.textBaseline = "alphabetic";
      for (const gl of L.glyphs) if (gl.ch !== " ") g.fillText(gl.ch, gl.x, gl.y);
      paint(g, ctx, o.fill, o.tex);
    }
    sub(ctx, g, o, L);
  }
  /** resta agujeros / erosión / desvanecido derecho (común a texto y fotos) */
  function sub(ctx, g, o, L) {
    if (o.holes) { g.globalCompositeOperation = "destination-out"; g.globalAlpha = o.holes.alpha ?? 1; drawTex(g, S.tex.holes, ctx, o.holes.ox || 0, o.holes.oy || 0, o.holes.sc || 1); g.globalAlpha = 1; }
    if (o.erode) { g.globalCompositeOperation = "destination-out"; g.fillStyle = "#000"; o.erode(g); }
    if (o.fadeRight && L) {
      const [f0, a] = o.fadeRight, x0 = L.left + (L.right - L.left) * f0;
      const gr = g.createLinearGradient(x0, 0, L.right, 0); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, `rgba(0,0,0,${a})`);
      g.globalCompositeOperation = "destination-out"; g.fillStyle = gr; g.fillRect(x0, 0, ctx.stage.W, ctx.stage.H);
    }
    g.globalCompositeOperation = "source-over";
  }
  /** pone tmp1 en ctx.g.main: alfa, desplazamiento y franjas rasgadas [{y0,y1,dx,dy}] (px del escenario) */
  function put(ctx, o = {}) {
    const D = o.dest || ctx.g.main, { W, H } = ctx.stage, d = ctx.dpr;
    D.save(); D.globalAlpha = o.alpha ?? 1;
    if (o.slices) for (const s of o.slices) { const y0 = Math.max(0, s.y0), y1 = Math.min(H, s.y1); if (y1 > y0) D.drawImage(S.tmp1, 0, y0 * d, W * d, (y1 - y0) * d, (o.dx || 0) + (s.dx || 0), y0 + (o.dy || 0) + (s.dy || 0), W, y1 - y0); }
    else D.drawImage(S.tmp1, o.dx || 0, o.dy || 0, W, H);
    D.restore();
  }
  /** franjas de rasgado: la mitad baja del texto desplazada `amt` px, en 3 tiras */
  function tear(L, amt, keep = 0) {
    const a = L.top, c = L.ch * (L.lines.length > 1 ? L.lines.length * 1.3 : 1);
    return [
      { y0: -1e4, y1: a + c * 0.44, dx: 0 },
      { y0: a + c * 0.44, y1: a + c * 0.63, dx: amt * 0.55 + keep * 0.3, dy: amt * 0.04 },
      { y0: a + c * 0.63, y1: a + c * 0.84, dx: amt + keep, dy: amt * 0.08 },
      { y0: a + c * 0.84, y1: 1e5, dx: amt * 0.8 + keep * 0.5, dy: amt * 0.1 },
    ];
  }

  /* --------------------------------------------------------------- fondo y suciedad */
  function fill(ctx, color) { const g = ctx.g.main, { W, H } = ctx.stage; g.fillStyle = color; g.fillRect(0, 0, W, H); }
  /** suciedad fija de película, teñida; tiembla 1 px a boilFps */
  function grime(ctx, color, alpha, t) {
    const g = ctx.g.main, f = boilFrame(t), r = K.rng(f * 7 + 1), j = ctx.stage.u * 0.12;
    g.save(); g.globalAlpha = alpha;
    drawTex(g, tint(S.tex.grime, color), ctx, (r() - 0.5) * j, (r() - 0.5) * j, 1);
    g.restore();
  }
  /** brochazo horizontal entre y0 e y1, revelado de izquierda a derecha hasta `wipe` */
  function band(ctx, o) {
    const g = o.dest || ctx.g.main, { W } = ctx.stage, wipe = o.wipe ?? 1;
    if (wipe <= 0) return;
    g.save(); g.globalAlpha = o.alpha ?? 1;
    g.beginPath(); g.rect(o.x0 ?? 0, o.y0 - 50, (W - (o.x0 ?? 0)) * wipe, o.y1 - o.y0 + 100); g.clip();
    g.drawImage(tint(S.tex.band[o.v || 0], o.color), (o.x0 ?? 0) + (o.dx || 0), o.y0, W * (o.sx ?? 1), o.y1 - o.y0);
    g.restore();
  }
  /** salpicaduras (vector, deterministas por semilla): defs [{x,y,r,seed,at}] — aparecen en 3 pasos */
  function splats(ctx, defs, lt, color, g = ctx.g.main) {
    g.save(); g.fillStyle = color;
    for (const d of defs) {
      if (lt < d.at) continue;
      const step = Math.min(3, 1 + Math.floor((lt - d.at) / 0.067)), k = [0, 0.45, 0.8, 1][step];
      splat(g, d.x, d.y, d.r * k, K.rng(d.seed), 0.6 + 0.4 * k);
    }
    g.restore();
  }
  /** juego de salpicaduras típico de la fase de brochazo (posiciones de la referencia) */
  function splatSet(ctx, rnd, at) {
    const { W, H, u, portrait } = ctx.stage, P = portrait ? [[0.6, 0.18], [0.15, 0.82], [0.88, 0.72], [0.35, 0.12], [0.7, 0.9]] : [[0.55, 0.14], [0.14, 0.86], [0.9, 0.78], [0.32, 0.2], [0.78, 0.92], [0.97, 0.3]];
    return P.map((q, i) => ({ x: q[0] * W + (rnd() - 0.5) * u * 4, y: q[1] * H + (rnd() - 0.5) * u * 4, r: u * (1.6 + rnd() * 2.4), seed: Math.floor(rnd() * 1e9), at: at + (i % 3) * 0.067 }));
  }
  /** erosión: manchas grandes que se comen la palabra de izquierda a derecha; deja la última letra */
  function erosion(L, rnd, keepLast = true) {
    const last = L.glyphs.filter(g => g.ch !== " " && g.li === L.lines.length - 1).slice(-1)[0];
    const x1 = keepLast && last ? last.x - L.fs * 0.02 : L.right, x0 = L.left - L.fs * 0.1, bl = [];
    for (let i = 0; i < 140; i++) {
      const fx = rnd(), x = lerp(x0, x1, fx), y = lerp(L.top - L.ch * 0.1, L.bottom + L.ch * 0.1, rnd());
      bl.push({ x, y, r: L.ch * (0.08 + rnd() * 0.22), e: fx * 0.75 + rnd() * 0.25, seed: Math.floor(rnd() * 1e9) });
    }
    return (g, q) => { for (const b of bl) if (b.e < q) blob(g, b.x, b.y, b.r * Math.min(1, 0.5 + (q - b.e) * 3), K.rng(b.seed), 11, 0.8); };
  }

  /* --------------------------------------------------------------- efectos de cuadro */
  /** pide para ESTE cuadro: { neg, flipX, flipY, zoom, zx, zy, S, D } (lo aplica post()) */
  function fx(ctx, o) { S.fx = { ...(S.fx || {}), ...o }; }
  /** el componente activo publica sus colores (para negativos y subtítulos) */
  function current(ctx, sc) { S.cur = sc; }

  function applyFx(ctx) {
    const f = S.fx, sc = S.cur; if (!f || !sc) return;
    const cv = ctx.layers.main, { W, H } = ctx.stage, d = ctx.dpr, g = ctx.g.main;
    if (f.flipX || f.flipY || (f.zoom && f.zoom !== 1)) {
      const g1 = S.tmp1.getContext("2d"); g1.setTransform(1, 0, 0, 1, 0, 0); g1.globalCompositeOperation = "copy"; g1.drawImage(cv, 0, 0); g1.globalCompositeOperation = "source-over";
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = f.neg ? sc.S : sc.D; g.fillRect(0, 0, cv.width, cv.height);
      const z = f.zoom || 1, cx = (f.zx ?? 0.5) * W * d, cy = (f.zy ?? 0.5) * H * d;
      g.translate(cx, cy); g.scale((f.flipX ? -1 : 1) * z, (f.flipY ? -1 : 1) * z); g.translate(-cx, -cy);
      g.drawImage(S.tmp1, 0, 0); g.restore();
    }
    if (f.neg) {
      /* negativo de dos tintas: lo claro pasa al oscuro de la escena y lo oscuro al color plano */
      const key = sc.S + sc.D; if (S.lutKey !== key) {
        const A = hexRgb(sc.S), B = hexRgb(sc.D), lA = lum(sc.S), lB = lum(sc.D), lut = new Uint8ClampedArray(256 * 3);
        for (let l = 0; l < 256; l++) { const q = clamp((l - lB) / Math.max(1, lA - lB)); for (let k = 0; k < 3; k++) lut[l * 3 + k] = lerp(A[k], B[k], q); }
        S.lut = lut; S.lutKey = key;
      }
      /* se lee desde un canvas propio con willReadFrequently (CPU): sin lecturas repetidas de la capa GPU */
      if (!S.rb || S.rb.width !== cv.width || S.rb.height !== cv.height) { S.rb = mk(cv.width, cv.height); S.rbg = S.rb.getContext("2d", { willReadFrequently: true }); }
      const rg = S.rbg; rg.globalCompositeOperation = "copy"; rg.drawImage(cv, 0, 0); rg.globalCompositeOperation = "source-over";
      const id = rg.getImageData(0, 0, cv.width, cv.height), px = id.data, lut = S.lut;
      for (let i = 0; i < px.length; i += 4) { const l = (px[i] * 77 + px[i + 1] * 150 + px[i + 2] * 29) >> 8; px[i] = lut[l * 3]; px[i + 1] = lut[l * 3 + 1]; px[i + 2] = lut[l * 3 + 2]; px[i + 3] = 255; }
      rg.putImageData(id, 0, 0);
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "copy"; g.drawImage(S.rb, 0, 0); g.restore();
    }
  }

  K.family("grunge", {
    setup,
    frame(t, ctx) {
      const { W, H } = ctx.stage, g = ctx.g.bg;
      g.fillStyle = ctx.C.palette.bg; g.fillRect(0, 0, W, H);
      S.fx = null;
      /* golpes de negativo puestos en el storyboard (grunge.flip) */
      for (const b of S.flips) if (t >= b.t0 && t < b.t1) {
        const m = b.params?.mode || "neg", z = b.params?.zoom ?? 1;
        S.fx = { neg: m !== "zoom", flipX: m === "negx", flipY: m === "negy", zoom: z };
      }
    },
    post(t, ctx) {
      applyFx(ctx);
      const { W, H } = ctx.stage, g = ctx.g.top, f = Math.floor(t * 24), r = K.rng(f * 13 + 5);
      /* grano de película + parpadeo de luminancia + viñeta suave */
      const tile = S.tex.grain[f % 4], pat = g.createPattern(tile, "repeat");
      g.save(); g.globalAlpha = S.cfg.grain; g.translate(-r() * 160, -r() * 160); g.fillStyle = pat; g.fillRect(0, 0, W + 320, H + 320); g.restore();
      const fl = S.cfg.flicker * r();
      if (fl > 0.002) { g.fillStyle = `rgba(0,0,0,${fl.toFixed(3)})`; g.fillRect(0, 0, W, H); }
      const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.78);
      vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.28)"); g.fillStyle = vg; g.fillRect(0, 0, W, H);
      const acc = S.cur ? (S.cur.light ? S.cur.S : S.cur.S) : ctx.C.palette.accent;
      if (S.accKey !== acc) { document.documentElement.style.setProperty("--gr-accent", acc); S.accKey = acc; }
    },
    resize(ctx) { setup(ctx); },
  });

  K.grunge = { COLORS, mix, lum, hexRgb, blob, splat, scene, tint, layout, measure, fitFs, ink, sub, put, tear, fill, grime, band, splats, splatSet, erosion, fx, current, prep, paint, drawTex, boilFrame, CAP, FONT,
               get S() { return S; } };
})();
