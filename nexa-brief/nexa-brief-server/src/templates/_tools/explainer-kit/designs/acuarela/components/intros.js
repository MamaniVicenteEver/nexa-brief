/* =============================================================================
   acuarela · intros (el gancho: lo primero que se ve en YouTube)
   introv1 = titular GIGANTE en Oswald ladrillo; cada palabra cae y se revela
             "comida" por una máscara de tinta que sangra; la palabra ^x^ queda
             calada en una mancha de tinta negra. En dropAt cae una gota: la
             tinta salpica, una aguada sepia florece detrás del titular y un
             trazo de pincel lo subraya.
   introv2 = la pregunta se ESCRIBE letra a letra con tinta fresca (gota de la
             pluma que avanza) y la respuesta llega como una PINCELADA de
             acuarela ladrillo que barre con el texto calado en papel.
   Fondos propios (presets, temáticamente neutros): blots (manchas que
   florecen), wash (aguada que barre + pinceladas que chorrean), timeline
   (línea de tiempo de gotas de tinta), manuscript (página manuscrita con una
   gota que se expande). Más image / component / none del contrato común.
   Legibilidad: el diseño es CLARO (papel), así que en vez de oscurecer se
   "lava hacia el papel": halo de papel detrás del texto y `dim` = velo de papel.
   Herramientas compartidas con el cierre en Kit.acuarela.hook.
   Todo es función pura de lt (render cuadro a cuadro con seek).
   ========================================================================== */
(function () {
  "use strict";
  const K = window.Kit, A = K.acuarela, { clamp, lerp, prog, ease } = K;
  const PRESETS = ["blots", "wash", "timeline", "manuscript"];
  const mkCanvas = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
  const MC = mkCanvas(4, 4).getContext("2d");
  const FONT = { title: "Oswald", cond: "'Barlow Condensed'", hand: "'Mrs Saint Delafield', cursive" };
  const font = (fam, px, w = 500) => `${w} ${px}px ${FONT[fam] || fam}`;
  const measure = (s, f) => { MC.font = f; MC.letterSpacing = "0px"; return MC.measureText(s).width; };
  const hex = c => { const m = String(c).replace("#", ""); const v = parseInt(m.length === 3 ? m.split("").map(x => x + x).join("") : m, 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
  const rgba = (c, a) => { const [r, g, b] = hex(c); return `rgba(${r},${g},${b},${clamp(a).toFixed(3)})`; };

  /* ------------------------------------------------------------ texto */
  /** "¿POR QUÉ CAYÓ\nEL ^MURO^?" → [[{w, acc, glue}]] (renglones de palabras; ^x^ = palabra destacada) */
  function words(text) {
    return String(text ?? "").split("\n").map(s => s.trim()).filter(Boolean).map(line => {
      const out = []; let acc = false, buf = "", spaced = true;
      /* glue = va pegada a la anterior sin espacio ("^MURO^?" → el "?" no se separa) */
      const flush = () => { if (buf) { out.push({ w: buf.toUpperCase(), acc, glue: !spaced && out.length > 0 }); buf = ""; spaced = false; } };
      for (const ch of line) {
        if (ch === "^") { flush(); acc = !acc; }
        else if (/\s/.test(ch)) { flush(); spaced = true; }
        else buf += ch;
      }
      flush();
      return out;
    });
  }
  /** 9:16: parte en dos los renglones de 3+ palabras (más grande y a lo ancho) */
  function splitLines(Ls) {
    const out = [];
    for (const l of Ls) {
      const heads = l.map((w, k) => (k && !w.glue ? k : -1)).filter(k => k > 0);
      if (heads.length < 2) { out.push(l); continue; }
      const len = l.map(w => w.w.length + 1), tot = len.reduce((a, b) => a + b, 0);
      let best = heads[0], bd = 1e9;
      for (const k of heads) { const a = len.slice(0, k).reduce((x, y) => x + y, 0), d = Math.abs(a - tot / 2); if (d < bd) { bd = d; best = k; } }
      out.push(l.slice(0, best), l.slice(best));
    }
    return out;
  }
  /** sacudida de cámara: suma de golpes que decaen (determinista) */
  function shake(lt, hits, amp) {
    let a = 0; for (const h of hits) { const d = lt - h; if (d >= 0 && d < 0.3) a += Math.pow(1 - d / 0.3, 2); }
    return [Math.sin(lt * 87) * amp * a, Math.cos(lt * 67) * amp * a * 0.8];
  }
  /** curva cuadrática muestreada */
  function curve(x0, y0, mx, my, x1, y1, n = 24) {
    const pts = []; for (let k = 0; k <= n; k++) { const s = k / n, a = 1 - s; pts.push([a * a * x0 + 2 * a * s * mx + s * s * x1, a * a * y0 + 2 * a * s * my + s * s * y1]); } return pts;
  }

  /* ------------------------------------------------------------ pincel seco */
  /** trazo de pincel con cerdas (pts densos, q = progreso 0..1) */
  function brush(G, pts, q, o = {}) {
    if (q <= 0 || pts.length < 2) return;
    const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const tot = L[L.length - 1] || 1, end = tot * clamp(q), r = K.rng(o.seed || 1), n = o.hairs || 9, W = o.width || 4, ga = G.globalAlpha;
    const nrm = i => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [-dy / l, dx / l]; };
    G.save(); G.lineCap = "round"; G.lineJoin = "round"; G.strokeStyle = o.color || "#3f3d3e";
    const path = (off, s0, s1) => {
      G.beginPath(); let on = false;
      for (let i = 0; i < pts.length; i++) {
        const s = L[i] / tot; if (s < s0) continue; if (L[i] > end || s > s1) break;
        const tp = Math.pow(Math.sin(Math.PI * clamp(0.04 + s * 0.92)), 0.4), [nx, ny] = nrm(i), x = pts[i][0] + nx * off * tp, y = pts[i][1] + ny * off * tp;
        on ? G.lineTo(x, y) : G.moveTo(x, y); on = true;
      }
      G.stroke();
    };
    /* núcleo cargado de pigmento */
    G.globalAlpha = ga * (o.alpha ?? 0.9) * 0.6; G.lineWidth = W * 0.5; path(0, 0, 1);
    for (let k = 0; k < n; k++) {
      const off = (r() - 0.5) * W, lw = W * (0.08 + r() * 0.2), a = (o.alpha ?? 0.9) * (0.35 + r() * 0.65), s1 = 0.8 + r() * 0.2, s0 = r() * 0.05;
      G.globalAlpha = ga * a; G.lineWidth = lw; path(off, s0, s1);
    }
    G.restore();
  }
  /** salpicadura de tinta: gotas radiales (q = tiempo desde el golpe, 0..1) */
  function splat(G, x, y, R, q, o = {}) {
    if (q <= 0) return;
    const r = K.rng(o.seed || 7), n = o.n || 26, sz = o.size || R * 0.05, ga = G.globalAlpha;
    G.save(); G.fillStyle = o.color || "#3a3739";
    for (let k = 0; k < n; k++) {
      const ang = (o.dir != null ? o.dir + (r() - 0.5) * (o.spread ?? 1.4) : r() * Math.PI * 2), d = R * (0.2 + Math.pow(r(), 0.65) * 0.95);
      const s = sz * (0.25 + r() * r() * 1.6) * (1 - 0.5 * d / R), el = 1 + r() * 1.6, lag = r() * 0.25;
      const fly = ease.expoOut(clamp((q - lag * 0.4) * 2.2)); if (fly <= 0) continue;
      const px = x + Math.cos(ang) * d * fly, py = y + Math.sin(ang) * d * fly;
      G.globalAlpha = ga * (o.alpha ?? 0.85) * clamp(fly * 3) * (0.55 + r() * 0.45);
      G.beginPath(); G.ellipse(px, py, s * lerp(1, el, fly), s, ang, 0, 7); G.fill();
      /* gotita satélite */
      if (k % 3 === 0) { G.beginPath(); G.arc(px + Math.cos(ang) * s * 2.6, py + Math.sin(ang) * s * 2.6, s * 0.35, 0, 7); G.fill(); }
    }
    G.restore();
  }

  /* ------------------------------------------------------------ manchas */
  /** pigmento granulado (lienzo chico, se escala suave) */
  function washCanvas(cw, ch, color, seed, o = {}) {
    cw = Math.max(4, cw | 0); ch = Math.max(4, ch | 0);
    const cv = mkCanvas(cw, ch), g = cv.getContext("2d"), id = g.createImageData(cw, ch), d = id.data, [r0, g0, b0] = hex(color);
    const n = A.fbm(seed, cw, ch, o.cells ?? 3, 5), f = A.fbm(seed + 1, cw, ch, 18, 3, 0.6), a0 = o.a0 ?? 0.55, a1 = o.a1 ?? 0.45;
    for (let i = 0; i < n.length; i++) {
      const k = 1 - 0.28 * f[i] + 0.12 * (n[i] - 0.5);
      d[i * 4] = r0 * k; d[i * 4 + 1] = g0 * k; d[i * 4 + 2] = b0 * k; d[i * 4 + 3] = clamp(a0 + a1 * n[i]) * 255;
    }
    g.putImageData(id, 0, 0); return cv;
  }
  function autoLobes(seed, n = 4) {
    const r = K.rng(seed), L = [{ x: 0.5, y: 0.5, rx: 0.36, ry: 0.36 }];
    for (let i = 1; i < n; i++) L.push({ x: 0.28 + r() * 0.44, y: 0.28 + r() * 0.44, rx: 0.17 + r() * 0.16, ry: 0.17 + r() * 0.16 });
    return L;
  }
  /** mancha de tinta/acuarela que florece: draw(G, x, y, th, alpha, comp); th 1 = nada → ~0.3 = llena */
  function blob(ctx, w, h, o = {}) {
    const seed = o.seed || 1, res = o.res || 3, mw = Math.max(8, Math.ceil(w / res)), mh = Math.max(8, Math.ceil(h / res));
    const src = washCanvas(mw * 1.4, mh * 1.4, o.color || ctx.C.palette.wash, seed + 1, o);
    const field = o.dir ? A.fieldDir(seed + 2, mw, mh, o.dir, o.rough ?? 0.45, o.cells ?? 4) : A.fieldBlot(seed + 2, mw, mh, o.lobes || autoLobes(seed, o.n || 4), o.rough ?? 0.42, o.cells ?? 3.2);
    /* sin cortes rectos: el campo se apaga cerca del borde de la caja */
    if (!o.dir) for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) { const e = Math.min(x, y, mw - 1 - x, mh - 1 - y) / (Math.min(mw, mh) * 0.14); if (e < 1) field[y * mw + x] *= Math.max(0, e); }
    const gran = A.fbm(seed + 3, mw, mh, o.granCells ?? 20, 3, 0.6); for (let i = 0; i < gran.length; i++) gran[i] = 0.55 + gran[i] * 0.45;
    const rv = A.Reveal(src, A.Mask(field, mw, mh, { soft: o.soft ?? 0.05, gran, rim: o.rim ?? 0.3 }));
    return {
      w, h,
      draw(G, x, y, th, alpha = 1, comp) {
        if (alpha <= 0.003 || th >= 0.995) return;
        const ga = G.globalAlpha, gc = G.globalCompositeOperation;
        if (comp) G.globalCompositeOperation = comp;
        rv.draw(G, x, y, w, h, th, alpha * ga);
        G.globalAlpha = ga; G.globalCompositeOperation = gc;
      },
    };
  }
  /** umbral de floración: florece en `dur` y después sigue corriéndose despacio (pigmento húmedo) */
  const bloomTh = (lt, at, dur, end = 0.34, creep = 0.06) => lt < at ? 1 : lerp(1, end, prog(lt, at, dur, "out")) - creep * clamp((lt - at - dur) / 6);

  /** texto revelado por tinta (máscara que "come" las letras). o: fam, weight, size, color, spacing, upper, align, maxW, lh, from, patch */
  function label(ctx, str, o) {
    const tc = A.textCanvas(str, { font: FONT[o.fam] || o.fam, weight: o.weight || 500, size: o.size, color: o.color, spacing: o.spacing, upper: o.upper, align: o.align || "center", maxW: o.maxW, lh: o.lh }, ctx.dpr);
    const seed = o.seed || 11, mw = Math.max(8, Math.ceil(tc.w / 3)), mh = Math.max(6, Math.ceil(tc.h / 3));
    const field = o.patch ? A.fieldPatch(seed, mw, mh, Math.max(4, tc.w / (o.size * 1.6)), 0.35) : A.fieldDir(seed, mw, mh, o.from || "left", o.rough ?? 0.38, Math.max(3, tc.w / (o.size * 0.9)));
    const rv = A.Reveal(tc.cv, A.Mask(field, mw, mh, { soft: o.patch ? 0.1 : 0.07 }));
    const soft = o.patch ? 0.1 : 0.07;
    return {
      tc, w: tc.wMax, h: tc.lh * tc.lines.length, pad: tc.pad,
      /** dibuja centrado en (cx, cy); p = progreso del revelado */
      draw(G, cx, cy, p, alpha = 1) {
        if (p <= 0 || alpha <= 0.003) return;
        const ga = G.globalAlpha; rv.draw(G, cx - tc.w / 2, cy - tc.h / 2, tc.w, tc.h, A.thFull(clamp(p), soft), alpha * ga); G.globalAlpha = ga;
      },
    };
  }

  /** pincelada de acuarela (banda irregular con pigmento acumulado en el borde) con el texto calado */
  function band(ctx, str, h, o = {}) {
    const P = ctx.C.palette, dpr = ctx.dpr, fs = h * (o.text ?? 0.52), s = String(str).toUpperCase();
    const tw = measure(s, font("title", fs, 600)) + fs * 0.06 * s.length, w = tw + h * 1.25, seed = o.seed || 91;
    const cw = Math.ceil(w / 2.5), ch = Math.ceil(h / 2.5), lo = mkCanvas(cw, ch), lg = lo.getContext("2d"), id = lg.createImageData(cw, ch), d = id.data;
    const n = A.fbm(seed, cw, ch, 6, 4), gr = A.fbm(seed + 1, cw, ch, 22, 3, 0.6), r = K.rng(seed + 2), rows = [];
    for (let y = 0; y < ch; y++) rows.push(r());
    for (let y = 1; y < ch; y++) rows[y] = rows[y] * 0.45 + rows[y - 1] * 0.55;
    const [r0, g0, b0] = hex(o.color || P.accent);
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const i = y * cw + x, nx = x / (cw - 1), ny = y / (ch - 1);
      const thick = (0.4 + (n[i] - 0.5) * 0.16) * (0.7 + 0.3 * Math.pow(Math.sin(Math.PI * clamp(nx * 0.96 + 0.02)), 0.35));
      const dd = thick - Math.abs(ny - 0.5), a = clamp(dd / 0.045);
      if (a <= 0) continue;
      const rim = dd < 0.07 ? 0.16 : 0, dens = clamp(0.74 + 0.18 * rows[y] + rim - 0.12 * gr[i] + (nx > 0.9 ? -0.25 * (nx - 0.9) / 0.1 * r() : 0));
      const k = 1 - 0.18 * gr[i] - rim * 0.6;
      d[i * 4] = r0 * k; d[i * 4 + 1] = g0 * k; d[i * 4 + 2] = b0 * k; d[i * 4 + 3] = a * dens * 255;
    }
    lg.putImageData(id, 0, 0);
    const cv = mkCanvas(w * dpr, h * dpr), g = cv.getContext("2d");
    g.imageSmoothingQuality = "high"; g.drawImage(lo, 0, 0, cv.width, cv.height); g.scale(dpr, dpr);
    g.font = font("title", fs, 600); g.letterSpacing = fs * 0.06 + "px"; g.fillStyle = o.ink || P.flash; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(s, w / 2 + fs * 0.03, h / 2 + fs * 0.05);
    const mw = Math.ceil(w / 3), mh = Math.ceil(h / 3), rv = A.Reveal(cv, A.Mask(A.fieldDir(seed + 4, mw, mh, "left", 0.3, 5), mw, mh, { soft: 0.06 }));
    return {
      w, h, fs,
      draw(G, cx, cy, p, alpha = 1) {
        if (p <= 0 || alpha <= 0.003) return;
        const ga = G.globalAlpha; rv.draw(G, cx - w / 2, cy - h / 2, w, h, A.thFull(clamp(p), 0.06), alpha * ga); G.globalAlpha = ga;
      },
    };
  }

  /** bloque manuscrito que se escribe (cursiva de fondo) */
  function hand(ctx, x, y, w, h, seed, size) {
    const P = ctx.C.palette, sz = size || A.sizes(ctx.stage).hand, cv = A.handCanvas(w, h, sz, P.hand, ctx.dpr, seed);
    const mw = Math.max(8, Math.ceil(w / 4)), mh = Math.max(8, Math.ceil(h / 4)), rv = A.Reveal(cv, A.Mask(A.fieldPatch(seed + 3, mw, mh, 5, 0.6), mw, mh, { soft: 0.08 }));
    return { draw(G, p, alpha) { if (p <= 0) return; const ga = G.globalAlpha, gc = G.globalCompositeOperation; G.globalCompositeOperation = "multiply"; rv.draw(G, x, y, w, h, A.thFull(clamp(p), 0.08), alpha * ga); G.globalAlpha = ga; G.globalCompositeOperation = gc; } };
  }

  /** halo de papel detrás del texto (la legibilidad en paleta clara: se lava hacia el papel) */
  function halo(G, P, cx, cy, rx, ry, a) {
    if (a <= 0) return;
    G.save(); G.translate(cx, cy); G.scale(rx / ry, 1);
    const g = G.createRadialGradient(0, 0, 0, 0, 0, ry);
    g.addColorStop(0, rgba(P.paperHi || P.paper, a)); g.addColorStop(0.55, rgba(P.paperHi || P.paper, a * 0.8)); g.addColorStop(1, rgba(P.paperHi || P.paper, 0));
    G.fillStyle = g; G.fillRect(-ry, -ry, ry * 2, ry * 2); G.restore();
  }

  /* ================================================================ fondos propios */
  function makePresets(ctx) {
    const st = ctx.stage, { W, H, u, portrait } = st, P = ctx.C.palette;
    const lazy = f => { let v = null; return () => v || (v = f()); };
    /* manchas grandes (caja en fracciones, color, alfa, momento) */
    const SPEC = portrait ? [
      { b: [-0.18, -0.06, 0.95, 0.34], c: P.wash, a: 0.55, at: 0.05, dur: 1.1 },
      { b: [0.3, 0.64, 0.9, 0.4], c: P.sepia, a: 0.42, at: 0.35, dur: 1.2 },
      { b: [0.52, 0.22, 0.6, 0.24], c: P.wash, a: 0.32, at: 0.7, dur: 1.1 },
      { b: [-0.2, 0.5, 0.6, 0.26], c: P.wash, a: 0.4, at: 1.0, dur: 1.2 },
    ] : [
      { b: [-0.1, -0.16, 0.52, 0.72], c: P.wash, a: 0.55, at: 0.05, dur: 1.1 },
      { b: [0.56, 0.4, 0.52, 0.74], c: P.sepia, a: 0.42, at: 0.35, dur: 1.2 },
      { b: [0.66, -0.14, 0.38, 0.46], c: P.wash, a: 0.32, at: 0.7, dur: 1.1 },
      { b: [-0.08, 0.6, 0.34, 0.5], c: P.wash, a: 0.4, at: 1.0, dur: 1.2 },
    ];
    const stains = lazy(() => SPEC.map((s, i) => ({ ...s, x: s.b[0] * W, y: s.b[1] * H, B: blob(ctx, s.b[2] * W, s.b[3] * H, { color: s.c, seed: 401 + i * 17, n: 5, a0: 0.5, a1: 0.5 }) })));
    const drawStains = (G, lt, which, k = 1) => stains().forEach((s, i) => {
      if (which && !which.includes(i)) return;
      const th = bloomTh(lt, s.at, s.dur, 0.3, 0.07); if (th >= 1) return;
      const br = 1 + 0.014 * Math.sin(lt * 0.6 + i * 1.7), dx = (i % 2 ? -1 : 1) * lt * u * 0.25, cx = s.x + s.B.w / 2, cy = s.y + s.B.h / 2;
      G.save(); G.translate(cx + dx, cy); G.scale(br, br); G.translate(-cx, -cy); s.B.draw(G, s.x, s.y, th, s.a * k, "multiply"); G.restore();
    });
    const hands = lazy(() => (portrait ? [[0.08, 0.36, 0.5, 0.13], [0.46, 0.84, 0.48, 0.12]] : [[0.05, 0.12, 0.22, 0.3], [0.73, 0.56, 0.22, 0.32]]).map(([x, y, w, h], i) => hand(ctx, x * W, y * H, w * W, h * H, 520 + i * 9)));

    /* --- blots: manchas de tinta que florecen y respiran + manuscrito */
    const blots = (G, s, lt) => {
      drawStains(G, lt);
      hands().forEach((h, i) => h.draw(G, prog(lt, 0.5 + i * 0.5, 1.6, "linear"), 0.45));
    };

    /* --- wash: aguada que barre de izquierda a derecha + pinceladas que chorrean */
    const sweep = lazy(() => blob(ctx, W * 1.1, H * 1.1, { color: P.sepia, dir: "left", rough: 0.5, cells: 3.5, seed: 611, a0: 0.4, a1: 0.6 }));
    const strokes = lazy(() => (portrait ? [0.05, 0.955] : [0.06, 0.945]).map((fy, i) => {
      const r = K.rng(630 + i), y = fy * H, pts = [];
      for (let k = 0; k <= 40; k++) { const s = k / 40; pts.push([lerp(-0.04, 1.04, i % 2 ? 1 - s : s) * W, y + Math.sin(s * 5 + i) * u * 0.8 + (r() - 0.5) * u * 0.15]); }
      const drips = []; for (let k = 0; k < 6; k++) drips.push({ x: (0.08 + r() * 0.84) * W, l: u * (3 + r() * 9), sp: 0.5 + r() * 0.8 });
      return { pts, y, drips, at: 0.3 + i * 0.55 };
    }));
    const wash = (G, s, lt) => {
      const S = sweep(); S.draw(G, -W * 0.05, -H * 0.05, lerp(1, 0.18, prog(lt, 0.05, 2.6, "inOut")), 0.32, "multiply");
      drawStains(G, lt, [3], 0.8);
      strokes().forEach((k, i) => {
        const q = prog(lt, k.at, 1.1, "inOut"); if (q <= 0) return;
        brush(G, k.pts, q, { width: u * (i ? 3.4 : 5), color: P.wash, alpha: 0.42, seed: 640 + i, hairs: 12 });
        /* chorreados que bajan despacio desde la pincelada */
        G.save(); G.strokeStyle = rgba(P.wash, 0.38); G.fillStyle = rgba(P.wash, 0.42); G.lineCap = "round";
        for (const d of k.drips) {
          const sx = i % 2 ? 1 - d.x / W : d.x / W, reach = clamp((q - sx) * 4); if (reach <= 0) continue;
          const len = d.l * ease.out(clamp((lt - k.at - sx * 1.1) / (2.5 / d.sp))) * reach; if (len <= 0.5) continue;
          G.lineWidth = Math.max(1, u * 0.3); G.beginPath(); G.moveTo(d.x, k.y + u * 0.8); G.lineTo(d.x, k.y + u * 0.8 + len); G.stroke();
          G.beginPath(); G.arc(d.x, k.y + u * 0.8 + len, u * 0.32, 0, 7); G.fill();
        }
        G.restore();
        if (i === 0) splat(G, i % 2 ? W * 0.05 : W * 0.95, k.y, u * 7, prog(lt, k.at + 1.0, 0.6, "linear"), { seed: 650, n: 16, color: P.wash, alpha: 0.55, size: u * 0.35 });
      });
    };

    /* --- timeline: línea de tiempo de gotas de tinta que se desplaza */
    const TL = lazy(() => {
      const y = H * (portrait ? 0.82 : 0.8), sp = W * (portrait ? 0.32 : 0.17), dots = [], hs = A.sizes(st).hand * 0.9;
      for (let i = 0; i < 9; i++) dots.push({ B: blob(ctx, u * 6, u * 6, { color: i % 3 === 1 ? P.date : P.ink, seed: 700 + i, n: 3, rough: 0.5, a0: 0.6, a1: 0.4 }), H: i % 2 === 0 ? hand(ctx, 0, 0, sp * 0.8, hs * 2.6, 720 + i, hs) : null });
      return { y, sp, dots, hs };
    });
    const timeline = (G, s, lt) => {
      drawStains(G, lt, [0, 2], 0.75);
      const T = TL(), lineX = W * 1.05 * prog(lt, 0.1, 2.4, "inOut"), off = -lt * u * 1.6;
      G.save(); G.strokeStyle = P.rule; G.globalAlpha *= 0.7; G.lineWidth = Math.max(1, u * 0.2);
      G.beginPath(); G.moveTo(0, T.y); G.lineTo(lineX, T.y); G.stroke(); G.restore();
      T.dots.forEach((d, i) => {
        const x = i * T.sp + T.sp * 0.5 + off; if (x < -T.sp || x > W + T.sp) return;
        const q = clamp((lineX - x) / (W * 0.1)); if (q <= 0) return;
        G.save(); G.strokeStyle = P.rule; G.globalAlpha *= 0.7 * q; G.lineWidth = Math.max(1, u * 0.15);
        G.beginPath(); G.moveTo(x, T.y - u * 1.4); G.lineTo(x, T.y + u * 1.4); G.stroke(); G.restore();
        d.B.draw(G, x - u * 3, T.y - u * 3, lerp(1, 0.42, ease.out(q)), 0.8, "multiply");
        if (d.H) { G.save(); G.translate(x - T.sp * 0.4, T.y - u * 2.2 - T.hs * 2.6); d.H.draw(G, clamp(q * 1.2 - 0.2), 0.55); G.restore(); }
      });
    };

    /* --- manuscript: página manuscrita con renglones, margen y una gota que se expande */
    const MS = lazy(() => {
      const boxes = portrait ? [[0.13, 0.04, 0.8, 0.22], [0.13, 0.36, 0.8, 0.2], [0.13, 0.68, 0.8, 0.26]] : [[0.14, 0.06, 0.36, 0.36], [0.56, 0.1, 0.38, 0.32], [0.14, 0.58, 0.78, 0.36]];
      return {
        hands: boxes.map(([x, y, w, h], i) => hand(ctx, x * W, y * H, w * W, h * H, 760 + i * 11, A.sizes(st).hand * 1.1)),
        drop: blob(ctx, W * (portrait ? 0.7 : 0.34), H * (portrait ? 0.32 : 0.5), { color: "#4a4747", seed: 781, n: 5, a0: 0.55, a1: 0.45, rim: 0.4 }),
        dx: W * (portrait ? 0.45 : 0.62), dy: H * (portrait ? 0.5 : 0.36),
      };
    });
    const manuscript = (G, s, lt) => {
      const M = MS(), lh = H * 0.052, mx = W * (portrait ? 0.08 : 0.1);
      G.save(); G.translate(0, -lt * u * 0.3);
      G.strokeStyle = P.rule; G.lineWidth = Math.max(1, u * 0.08);
      for (let y = lh * 1.5, i = 0; y < H + u * 4; y += lh, i++) { const q = prog(lt, 0.05 + i * 0.04, 0.8, "out"); if (q <= 0) continue; G.globalAlpha = 0.13; G.beginPath(); G.moveTo(0, y); G.lineTo(W * q, y); G.stroke(); }
      G.globalAlpha = 0.35; G.strokeStyle = P.date; G.lineWidth = Math.max(1, u * 0.12);
      G.beginPath(); G.moveTo(mx, -u * 2); G.lineTo(mx, -u * 2 + (H + u * 6) * prog(lt, 0.1, 1.2, "inOut")); G.stroke();
      G.globalAlpha = 1;
      M.hands.forEach((h, i) => h.draw(G, prog(lt, 0.2 + i * 0.6, 1.5, "linear"), 0.5));
      G.restore();
      const th = bloomTh(lt, 0.9, 1.4, 0.33, 0.08);
      M.drop.draw(G, M.dx - M.drop.w / 2, M.dy - M.drop.h / 2, th, 0.42, "multiply");
      splat(G, M.dx, M.dy, Math.min(W, H) * 0.24, prog(lt, 0.9, 0.7, "linear"), { seed: 790, n: 22, color: "#4a4747", alpha: 0.45, size: u * 0.45 });
    };
    return { blots, wash, timeline, manuscript };
  }

  /* ------------------------------------------------------------ foto con tinta */
  const toned = new Map();
  /** tratamiento del diseño para bg=image: B/N de negros levantados, polvo, orillas quemadas y un dejo sepia */
  function tone(img) {
    const key = img.src; if (toned.has(key)) return toned.get(key);
    const s = Math.min(1, 1600 / Math.max(img.width, img.height)), w = Math.round(img.width * s), h = Math.round(img.height * s);
    const cv = A.gradePhoto(img, w, h, [0.5, 0.5], 37, { contrast: 1.05, brightness: 1.02 }), g = cv.getContext("2d");
    g.globalCompositeOperation = "multiply"; g.fillStyle = "rgba(196,160,128,.22)"; g.fillRect(0, 0, w, h);
    toned.set(key, cv); if (toned.size > 12) toned.delete(toned.keys().next().value);
    return cv;
  }

  /**
   * Fondo intercambiable con el lenguaje del diseño. Envuelve Kit.hook.bg dibujando en un
   * lienzo propio: la foto (bg=image) aparece DENTRO de una mancha de tinta que florece, y
   * `dim` es un velo de papel (paleta clara) en vez de un oscurecido.
   * o = { auto, lobes: [{x,y,rx,ry}] de la mancha de la foto }
   */
  function backdrop(ctx, p, o = {}) {
    const st = ctx.stage, { W, H } = st, dpr = ctx.dpr, P = ctx.C.palette;
    const off = mkCanvas(W * dpr, H * dpr), og = off.getContext("2d");
    const fctx = { ...ctx, stage: st, g: { ...ctx.g, main: og } };
    const BG = K.hook.bg(fctx, { ...p, dim: 0 }, { auto: o.auto, presets: makePresets(ctx), tone });
    const ext = BG.mode === "image" || BG.mode === "component";
    let M = null;
    if (BG.mode === "image" && p.blot !== false) {
      const mw = Math.ceil(W / 3), mh = Math.ceil(H / 3);
      const gran = A.fbm(808, mw, mh, 22, 3, 0.6); for (let i = 0; i < gran.length; i++) gran[i] = 0.62 + gran[i] * 0.38;
      const lobes = o.lobes || [{ x: 0.3, y: 0.42, rx: 0.36, ry: 0.6 }, { x: 0.62, y: 0.4, rx: 0.36, ry: 0.55 }, { x: 0.5, y: 0.72, rx: 0.42, ry: 0.4 }, { x: 0.82, y: 0.6, rx: 0.24, ry: 0.42 }, { x: 0.14, y: 0.75, rx: 0.18, ry: 0.3 }];
      M = A.Mask(A.fieldBlot(809, mw, mh, lobes, 0.42, 3.4), mw, mh, { soft: 0.05, gran, rim: 0.25 });
    }
    return {
      mode: BG.mode, ext,
      render(lt, b, t) {
        const G = ctx.g.main;
        og.setTransform(1, 0, 0, 1, 0, 0); og.globalAlpha = 1; og.globalCompositeOperation = "source-over"; og.clearRect(0, 0, off.width, off.height);
        og.setTransform(dpr, 0, 0, dpr, 0, 0);
        BG.render(lt, b, t);
        if (M) {
          M.set(bloomTh(lt, 0.05, 1.1, 0.3, 0.06));
          og.setTransform(1, 0, 0, 1, 0, 0); og.globalCompositeOperation = "destination-in"; og.imageSmoothingQuality = "high";
          og.drawImage(M.canvas, 0, 0, off.width, off.height); og.globalCompositeOperation = "source-over";
        }
        G.drawImage(off, 0, 0, W, H);
        if (ext && p.dim > 0) { G.save(); G.fillStyle = rgba(P.paperHi || P.paper, p.dim); G.fillRect(0, 0, W, H); G.restore(); }
      },
      dispose() { BG.dispose(); },
    };
  }

  const BLOT = { type: "bool", default: true, doc: "bg=image: la foto aparece dentro de una mancha de tinta que florece (false = a sangre)." };
  const DIM = { type: "number", default: 0.45, min: 0, max: 1, doc: "Velo de papel sobre el fondo foto/componente (paleta clara: se lava hacia el papel; 0 = nada)." };

  A.hook = { words, shake, curve, brush, splat, blob, bloomTh, label, band, hand, halo, backdrop, makePresets, tone, measure, font, rgba, PRESETS, BLOT };

  /* ================================================================ introv1 */
  K.register({
    name: "acuarela.introv1", tags: ["intro", "gancho", "apertura", "título", "tinta", "impacto"], layer: "main", post: 0.6,
    summary: "GANCHO de apertura (lo primero que se ve). Fondo adaptable al tema (bg: blots | wash | timeline | manuscript | image con src | component con use/useParams); por defecto manchas de tinta y acuarela que florecen sobre el papel y manuscrito que se escribe. Titular GIGANTE en Oswald ladrillo: cada palabra cae y se revela 'comida' por una máscara de tinta que sangra, con sacudida y gotitas; '^palabra^' queda calada en una mancha de tinta negra. En dropAt cae una gota: salpica, una aguada sepia florece detrás y un pincel subraya. Subtítulo manuscrito.",
    example: { text: "LA NOCHE QUE\nCAYÓ EL ^MURO^", kicker: "Berlín · 9 nov 1989", sub: "la noche que nadie vio venir", dropAt: 2.3 },
    params: {
      text: { type: "string", required: true, doc: "Titular gancho, corto (2–6 palabras). '\\n' = renglón; '^x^' = palabra calada en una mancha de tinta negra." },
      kicker: { type: "string", default: "", doc: "Rótulo chico arriba (lugar · fecha), con rayas finas." },
      sub: { type: "string", default: "", doc: "Línea manuscrita debajo del titular (se escribe a pluma)." },
      wordAt: { type: "number", default: 0.45, doc: "Segundo del primer golpe de palabra." },
      stagger: { type: "number", default: 0.28, min: 0.08, doc: "Segundos entre palabra y palabra." },
      dropAt: { type: "number", default: 2.3, doc: "Segundo en que cae la gota de tinta: salpica, florece la aguada sepia y el pincel subraya (-1 = sin gota). Acepta '@palabra'." },
      ...K.hook.bgParams(PRESETS),
      dim: DIM, blot: BLOT,
    },
    create(ctx, p) {
      ctx.beat.hideCaptions = true;
      const { W, H, u, portrait } = ctx.stage, P = ctx.C.palette;
      /* tamaño: ~80 % del ancho (88 % en 9:16), limitado por alto */
      const F = px => font("title", px, 600), sp100 = measure(" ", F(100)) * 0.9;
      const lineW = l => l.reduce((a, w, k) => a + measure(w.w, F(100)) + (k && !w.glue ? sp100 : 0) + (w.acc ? 32 : 0), 0);
      const sizeOf = L => Math.min(100 * W * (portrait ? 0.88 : 0.8) / Math.max(1, ...L.map(lineW)), portrait ? Math.min(H * 0.14, H * 0.46 / (L.length * 1.08)) : H * 0.24 * (L.length > 2 ? 0.8 : 1));
      /* en 9:16 se parten los renglones largos solo si así el titular queda más grande */
      const L0 = words(p.text), L1 = portrait ? splitLines(L0) : L0, Ls = sizeOf(L1) > sizeOf(L0) * 1.05 ? L1 : L0;
      const fs = sizeOf(Ls);
      const lh = fs * 1.08, cy = H * (portrait ? 0.4 : 0.46), sp = sp100 * fs / 100;
      /* palabras colocadas */
      let idx = 0; const placed = [];
      Ls.forEach((line, li) => {
        const ws = line.map(w => measure(w.w, F(fs)) + (w.acc ? fs * 0.32 : 0));
        const tot = ws.reduce((a, b, k) => a + b + (k && !line[k].glue ? sp : 0), 0);
        let x = W / 2 - tot / 2; const yc = cy + (li - (Ls.length - 1) / 2) * lh;
        line.forEach((w, k) => {
          if (k && !line[k].glue) x += sp;
          if (k && line[k].glue && line[k - 1].acc) x -= fs * 0.16;
          const i = w.glue ? idx - 1 : idx++, seed = 31 + placed.length * 7;
          const L = label(ctx, w.w, { fam: "title", weight: 600, size: fs, color: (w.acc || (w.glue && line[k - 1].acc)) ? P.flash : P.date, align: "left", from: "left", rough: 0.45, seed });
          placed.push({ ...w, x, ww: ws[k], cx: x + ws[k] / 2, cy: yc, li, i, seed, L, B: w.acc ? blob(ctx, ws[k] + fs * 0.9, fs * 1.7, { color: "#221f20", seed: seed + 3, n: 5, rough: 0.34, a0: 0.88, a1: 0.12, rim: 0.15, lobes: [{ x: 0.5, y: 0.5, rx: 0.47, ry: 0.4 }, { x: 0.3, y: 0.46, rx: 0.26, ry: 0.42 }, { x: 0.7, y: 0.54, rx: 0.26, ry: 0.42 }, { x: 0.5, y: 0.52, rx: 0.42, ry: 0.3 }] }) : null });
          x += ws[k];
        });
      });
      const nW = idx, t0s = placed.map(w => p.wordAt + w.i * p.stagger), lastHit = Math.max(p.wordAt, ...t0s) + 0.2;
      const blockW = Math.max(...Ls.map((l, li) => { const ws = placed.filter(w => w.li === li); return ws.length ? ws[ws.length - 1].x + ws[ws.length - 1].ww - ws[0].x : 0; }));
      const blockH = lh * Ls.length, top = cy - blockH / 2, bot = cy + blockH / 2;
      /* gota: cae junto a la palabra destacada (o al final del titular) */
      const accW = placed.find(w => w.acc), lastL = placed.filter(w => w.li === Ls.length - 1);
      const hitX = accW ? accW.x + accW.ww * 0.82 : W / 2 + blockW * 0.42, hitY = accW ? accW.cy - fs * 0.38 : top + fs * 0.2;
      const drop = p.dropAt >= 0;
      const wash = drop ? blob(ctx, blockW * 1.3 + fs, blockH * 1.5 + fs * 0.6, { color: P.sepia, seed: 151, n: 6, a0: 0.45, a1: 0.55, rim: 0.4 }) : null;
      const ulPts = lastL.length ? curve(lastL[0].x - fs * 0.1, bot + fs * 0.02, (lastL[0].x + lastL[lastL.length - 1].x + lastL[lastL.length - 1].ww) / 2, bot + fs * 0.12, lastL[lastL.length - 1].x + lastL[lastL.length - 1].ww + fs * 0.1, bot - fs * 0.02, 40) : [];
      const kick = p.kicker ? label(ctx, p.kicker, { fam: "cond", weight: 600, size: u * (portrait ? 2.6 : 2.2), color: P.ink, upper: true, spacing: u * (portrait ? 0.7 : 0.6), from: "center", seed: 171 }) : null;
      const subL = p.sub ? label(ctx, p.sub, { fam: "hand", weight: 400, size: u * (portrait ? 6.4 : 6.2), color: P.hand, from: "left", rough: 0.25, seed: 181 }) : null;
      const BG = backdrop(ctx, p, { auto: "blots" });
      return {
        dispose() { BG.dispose(); },
        render(lt, b, t) {
          const G = ctx.g.main, oq = clamp((lt - b.dur) / 0.6), live = 1 - oq;
          const hits = t0s.map(x => x + 0.12).filter((x, k) => k < nW * 3);
          const [sx, sy] = shake(lt, hits, u * 0.35), [dx2, dy2] = drop ? shake(lt, [p.dropAt], u * 1.1) : [0, 0];
          const SX = sx + dx2, SY = sy + dy2, cam = 1.02 + 0.04 * clamp(lt / Math.max(4, b.dur));
          /* fondo */
          G.save(); G.globalAlpha = live; G.translate(W / 2 + SX * 0.5, H / 2 + SY * 0.5); G.scale(cam, cam); G.translate(-W / 2, -H / 2);
          BG.render(lt, b, t); G.restore();
          /* halo de papel detrás del titular */
          G.save(); G.globalAlpha = live * prog(lt, p.wordAt - 0.3, 0.5, "linear");
          halo(G, P, W / 2, cy, Math.max(blockW * 0.72, W * 0.36), blockH * 0.95 + fs * 0.6, BG.ext ? 0.9 : 0.72); G.restore();
          G.save(); G.globalAlpha = live; G.translate(SX, SY - oq * u * 3);
          /* aguada sepia que florece con la gota */
          if (drop && lt >= p.dropAt) wash.draw(G, W / 2 - wash.w / 2, cy - wash.h / 2, bloomTh(lt, p.dropAt, 1.2, 0.36, 0.06), 0.55, "multiply");
          /* titular: cada palabra cae, se revela comida por tinta y sangra un poco */
          for (const w of placed) {
            const t0 = p.wordAt + w.i * p.stagger, q = prog(lt, t0, 0.34, "linear");
            if (q <= 0) continue;
            const e = ease.expoOut(q), s = 1 + 0.3 * (1 - e), rq = clamp(A.ease4(q * 1.25));
            G.save(); G.translate(w.cx, w.cy - (1 - e) * fs * 0.12); G.scale(s, s); G.translate(-w.cx, -w.cy);
            if (w.B) {
              const big = drop && lt >= p.dropAt ? 0.05 * prog(lt, p.dropAt, 0.5, "out") : 0;
              w.B.draw(G, w.cx - w.B.w / 2, w.cy - w.B.h / 2, bloomTh(lt, t0 - 0.05, 0.4, 0.3 - big, 0.03), 0.95);
            }
            /* sangrado de la tinta (copia desenfocada) + letra nítida */
            const bl = fs * (0.025 + 0.09 * (1 - e)) * (1 + oq * 3);
            G.filter = `blur(${bl.toFixed(1)}px)`; w.L.draw(G, w.cx, w.cy, rq, w.acc ? 0.35 : 0.3); G.filter = "none";
            if (oq < 0.6) w.L.draw(G, w.cx, w.cy, rq, 1 - oq / 0.6);
            G.restore();
            /* gotitas al caer */
            splat(G, w.cx, w.cy + fs * 0.3, fs * 0.7, prog(lt, t0 + 0.08, 0.5, "linear"), { seed: w.seed + 5, n: 7, color: w.acc ? "#2e2b2c" : P.date, alpha: 0.55, size: fs * 0.022, dir: Math.PI / 2, spread: 2.6 });
          }
          /* la gota: salpicadura + pincel que subraya */
          if (drop && lt >= p.dropAt) {
            splat(G, hitX, hitY, fs * 1.5, prog(lt, p.dropAt, 0.55, "linear"), { seed: 191, n: 46, color: "#2e2b2c", alpha: 0.85, size: fs * 0.05 });
            const pq = prog(lt, p.dropAt + 0.05, 0.4, "inOut");
            brush(G, ulPts, pq, { width: fs * 0.11, color: P.accent, alpha: 0.85, seed: 193, hairs: 12 });
          }
          G.restore();
          /* rótulos */
          if (kick) {
            const y = top - fs * 0.32 - u * 3.2, kq = prog(lt, 0.15, 0.7, "linear"), a = live;
            kick.draw(G, W / 2, y, kq, a);
            const rw = u * (portrait ? 6 : 7) * prog(lt, 0.5, 0.5, "out"), gap = u * 2;
            G.save(); G.globalAlpha = a; G.strokeStyle = P.rule; G.lineWidth = Math.max(1, u * 0.15); G.beginPath();
            G.moveTo(W / 2 - kick.w / 2 - gap, y); G.lineTo(W / 2 - kick.w / 2 - gap - rw, y); G.moveTo(W / 2 + kick.w / 2 + gap, y); G.lineTo(W / 2 + kick.w / 2 + gap + rw, y); G.stroke(); G.restore();
          }
          if (subL) subL.draw(G, W / 2, bot + fs * 0.32 + u * 3.2, prog(lt, lastHit + 0.15, 1.1, "linear"), 0.9 * live);
        },
      };
    },
  });

  /* ================================================================ introv2 */
  K.register({
    name: "acuarela.introv2", tags: ["intro", "gancho", "apertura", "pregunta", "pincelada", "tinta"], layer: "main", post: 0.6,
    summary: "GANCHO pregunta + revelación. Fondo adaptable al tema (bg: manuscript | blots | wash | timeline | image con src | component con use/useParams); por defecto una página manuscrita con renglones y margen ladrillo donde cae una gota que se expande. Rótulo tipo fecha que se revela comido por tinta con su raya. La pregunta GIGANTE se escribe letra a letra con tinta fresca (una gota de pluma avanza delante) y la respuesta llega como una PINCELADA de acuarela ladrillo que barre con el texto calado en papel, con sacudida y salpicadura.",
    example: { text: "¿QUIÉN ABRIÓ\nEL MURO?", kicker: "Berlín · 1989", stamp: "NADIE DIO LA ORDEN", stampAt: 2.4 },
    params: {
      text: { type: "string", required: true, doc: "Pregunta gancho ('\\n' = renglón)." },
      kicker: { type: "string", default: "", doc: "Rótulo tipo fecha arriba (Oswald ladrillo con raya)." },
      stamp: { type: "string", default: "", doc: "Respuesta: pincelada de acuarela que barre con el texto calado (vacío = sin pincelada)." },
      stampAt: { type: "number", default: 2.4, doc: "Segundo de la pincelada (acepta '@palabra')." },
      typeAt: { type: "number", default: 0.35, doc: "Segundo en que empieza a escribirse la pregunta." },
      cps: { type: "number", default: 18, min: 4, doc: "Letras por segundo de la escritura." },
      ...K.hook.bgParams(PRESETS),
      dim: DIM, blot: BLOT,
    },
    create(ctx, p) {
      ctx.beat.hideCaptions = true;
      const { W, H, u, portrait } = ctx.stage, P = ctx.C.palette;
      let Ls = String(p.text).toUpperCase().split("\n").map(s => s.trim()).filter(Boolean);
      const F = px => font("title", px, 600);
      const sizeOf = L => Math.min(100 * W * (portrait ? 0.88 : 0.56) / Math.max(1, ...L.map(s => measure(s, F(100)))), portrait ? Math.min(H * 0.12, H * 0.4 / (L.length * 1.06)) : H * 0.18 * (L.length > 2 ? 0.8 : 1));
      /* renglones largos: se parten solo si así la pregunta queda más grande */
      const L1 = splitLines(Ls.map(l => l.split(/\s+/).map(w => ({ w, glue: false })))).map(l => l.map(w => w.w).join(" "));
      if (sizeOf(L1) > sizeOf(Ls) * 1.05) Ls = L1;
      const fs = sizeOf(Ls);
      const lh = fs * 1.06, x0 = portrait ? W / 2 : W * 0.075, y0 = H * (portrait ? 0.3 - (Ls.length - 2) * 0.04 : 0.3);
      /* posiciones de cada letra (la pregunta se escribe letra a letra) */
      const glyphs = []; let n = 0;
      Ls.forEach((s, li) => {
        const tw = measure(s, F(fs)), lx = portrait ? x0 - tw / 2 : x0, yc = y0 + li * lh;
        [...s].forEach((ch, k) => { glyphs.push({ ch, x: lx + measure(s.slice(0, k), F(fs)), y: yc, i: n++ }); });
      });
      const total = n, lastY = y0 + (Ls.length - 1) * lh;
      const kick = p.kicker ? label(ctx, p.kicker, { fam: "title", weight: 500, size: fs * (portrait ? 0.42 : 0.36), color: P.date, from: portrait ? "center" : "left", align: portrait ? "center" : "left", seed: 211 }) : null;
      const BD = p.stamp ? band(ctx, p.stamp, Math.max(fs * 0.78, u * 6), { seed: 221 }) : null;
      const bandCX = BD ? (portrait ? W / 2 : x0 - BD.h * 0.25 + BD.w / 2) : 0, bandCY = lastY + fs * 0.62 + (BD ? BD.h * 0.62 : 0) + u * 1.5;
      const BG = backdrop(ctx, p, { auto: "manuscript", lobes: portrait ? [{ x: 0.5, y: 0.66, rx: 0.6, ry: 0.32 }, { x: 0.3, y: 0.78, rx: 0.4, ry: 0.24 }, { x: 0.72, y: 0.5, rx: 0.36, ry: 0.22 }] : [{ x: 0.72, y: 0.45, rx: 0.32, ry: 0.62 }, { x: 0.55, y: 0.7, rx: 0.3, ry: 0.4 }, { x: 0.88, y: 0.25, rx: 0.2, ry: 0.35 }, { x: 0.4, y: 0.3, rx: 0.25, ry: 0.35 }] });
      return {
        dispose() { BG.dispose(); },
        render(lt, b, t) {
          const G = ctx.g.main, oq = clamp((lt - b.dur) / 0.6), live = 1 - oq;
          const [sx, sy] = p.stamp ? shake(lt, [p.stampAt + 0.1], u * 1.0) : [0, 0];
          G.save(); G.globalAlpha = live; G.translate(sx * 0.5, sy * 0.5); BG.render(lt, b, t); G.restore();
          /* lado del texto lavado hacia el papel */
          G.save(); G.globalAlpha = live * prog(lt, 0, 0.5, "linear");
          const pa = BG.ext ? 0.9 : 0.7, lg = portrait ? G.createLinearGradient(0, 0, 0, H * 0.7) : G.createLinearGradient(0, 0, W * 0.72, 0);
          lg.addColorStop(0, rgba(P.paperHi, pa)); lg.addColorStop(0.7, rgba(P.paperHi, pa * 0.75)); lg.addColorStop(1, rgba(P.paperHi, 0));
          G.fillStyle = lg; G.fillRect(0, 0, W, H); G.restore();
          G.save(); G.globalAlpha = live; G.translate(sx, sy - oq * u * 3);
          /* rótulo tipo fecha con raya */
          if (kick) {
            const ky = y0 - fs * 0.5 - kick.h * 0.6 - u * 1.5, kq = prog(lt, 0.1, 0.65, "linear"), slide = (1 - A.ease4(kq)) * W * 0.04;
            const kx = portrait ? W / 2 : x0 + kick.w / 2;
            kick.draw(G, kx - slide, ky, kq);
            const rq = prog(lt, 0.55, 0.45, "out"), gap = u * 2, rw = u * 7 * rq;
            G.save(); G.strokeStyle = P.rule; G.lineWidth = Math.max(1, u * 0.15); G.beginPath();
            if (portrait) { G.moveTo(kx - kick.w / 2 - gap, ky); G.lineTo(kx - kick.w / 2 - gap - rw, ky); }
            G.moveTo(kx + kick.w / 2 + gap, ky); G.lineTo(kx + kick.w / 2 + gap + rw, ky); G.stroke(); G.restore();
          }
          /* pregunta escrita con tinta fresca */
          const pos = (lt - p.typeAt) * p.cps, f = F(fs);
          G.save(); G.font = f; G.textBaseline = "middle"; G.textAlign = "left"; G.fillStyle = P.ink;
          let pen = null;
          for (const g of glyphs) {
            const age = (pos - g.i) / p.cps; if (age <= 0) { if (!pen) pen = g; continue; }
            const a = clamp(age / 0.12), wet = clamp(1 - age / 0.6), s = 1 + 0.12 * (1 - ease.out(a));
            G.save(); G.globalAlpha = live * a; G.translate(g.x, g.y); G.scale(s, s);
            G.shadowColor = rgba(P.ink, 0.25 + 0.4 * wet); G.shadowBlur = fs * (0.03 + 0.1 * wet);
            G.fillText(g.ch, 0, fs * 0.04); G.restore();
          }
          G.restore();
          /* gota de la pluma que avanza delante de la escritura */
          if (pen && pos > -2 && oq <= 0) {
            const pr = fs * 0.07 * (0.85 + 0.15 * Math.sin(lt * 18));
            G.save(); G.fillStyle = P.ink; G.globalAlpha = 0.85; G.beginPath(); G.arc(pen.x + fs * 0.05, pen.y + fs * 0.3, pr, 0, 7); G.fill(); G.restore();
          }
          /* pincelada con la respuesta */
          if (BD && lt >= p.stampAt) {
            const q = prog(lt, p.stampAt, 0.38, "linear"), e = A.ease4(q), s = 1 + 0.08 * (1 - e);
            G.save(); G.translate(bandCX, bandCY); G.rotate(-0.025); G.scale(s, s);
            G.filter = `blur(${(BD.h * 0.05).toFixed(1)}px)`; BD.draw(G, 0, BD.h * 0.04, e, 0.25); G.filter = "none";
            BD.draw(G, 0, 0, e, 1); G.restore();
            splat(G, bandCX + BD.w * 0.48, bandCY, BD.h * 1.3, prog(lt, p.stampAt + 0.3, 0.5, "linear"), { seed: 231, n: 22, color: P.accent, alpha: 0.85, size: BD.h * 0.05, dir: -0.1, spread: 1.8 });
          }
          G.restore();
        },
      };
    },
  });
})();
