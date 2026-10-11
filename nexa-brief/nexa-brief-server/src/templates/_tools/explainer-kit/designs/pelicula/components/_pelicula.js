/* =============================================================================
   pelicula · runtime de la familia "archivo en película de 35 mm"
   -----------------------------------------------------------------------------
   Todo se dibuja en canvas (nada de DOM animado): así cada escena se compone en
   un lienzo propio (Kit.pelicula.surface) y después se pega en ctx.g.main con
   su efecto de entrada (barrido con motion blur, zoom radial, foco, glitch).
   Texturas (grano, motas, papel con números, scanlines) se generan UNA vez con
   rng sembrado; grano/rayas/polvo/parpadeo son función de floor(t·24).
   Utilidades en Kit.pelicula: grade, cover, surface, composite, perfRow,
   filmStrip, lines, card, drawCard, slices, leak, place, paper, flush.
   ========================================================================== */
(function () {
  const K = window.Kit, { clamp, lerp, prog, ease } = K;
  for (const f of ["500 100px Montserrat", "600 100px Montserrat", "700 100px Montserrat", "800 100px Montserrat"]) K.fonts.add(f);

  const COL = { paper: "#efe4c6", cream: "#f3eadb", orange: "#c9501f", red: "#c4352a", base: "#6b624d" };
  const P = K.pelicula = { COL };
  let TEX = null;

  const canvas = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
  P.canvas = canvas;
  const FPS = 24;                                   /* cadencia de la "película": grano, rayas, parpadeo */
  P.fi = t => Math.floor(t * FPS);

  /* ---------------------------------------------------------------- texturas */
  function makeTextures() {
    const r = K.rng(9031), T = {};
    /* grano: 4 baldosas de ruido gris (se aplican con "overlay" → media neutra) */
    T.grain = [0, 1, 2, 3].map(() => {
      const c = canvas(256, 256), g = c.getContext("2d"), id = g.createImageData(256, 256);
      for (let i = 0; i < id.data.length; i += 4) { const v = 128 + (r() + r() - 1) * 120; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
      g.putImageData(id, 0, 0); return c;
    });
    /* motas para erosionar el texto (destination-out) */
    { const c = canvas(512, 512), g = c.getContext("2d");
      for (let i = 0; i < 2600; i++) { g.globalAlpha = 0.25 + r() * 0.75; g.fillStyle = "#000"; g.beginPath(); g.arc(r() * 512, r() * 512, 0.4 + Math.pow(r(), 3) * 3.2, 0, 7); g.fill(); }
      for (let i = 0; i < 40; i++) { g.globalAlpha = 0.15 + r() * 0.35; g.lineWidth = 0.6 + r(); g.strokeStyle = "#000"; const x = r() * 512, y = r() * 512; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - .5) * 90, y + (r() - .5) * 30); g.stroke(); }
      for (let i = 0; i < 70; i++) { const x = r() * 512, y = r() * 512, R = 6 + r() * 26, gr = g.createRadialGradient(x, y, 0, x, y, R); gr.addColorStop(0, "rgba(0,0,0,.35)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.globalAlpha = 1; g.fillStyle = gr; g.fillRect(x - R, y - R, 2 * R, 2 * R); }
      T.speck = c; }
    /* papel: manchas oscuras + números grandes desvaídos (se aplica con multiply) */
    { const c = canvas(1280, 720), g = c.getContext("2d");
      for (let i = 0; i < 160; i++) { const x = r() * 1280, y = r() * 720, R = 20 + r() * 220, gr = g.createRadialGradient(x, y, 0, x, y, R);
        const a = 0.04 + r() * 0.12; gr.addColorStop(0, `rgba(60,44,22,${a})`); gr.addColorStop(1, "rgba(60,44,22,0)"); g.fillStyle = gr; g.fillRect(x - R, y - R, 2 * R, 2 * R); }
      g.fillStyle = "rgba(40,30,16,.5)";
      for (let i = 0; i < 900; i++) { g.globalAlpha = r() * 0.6; g.beginPath(); g.arc(r() * 1280, r() * 720, 0.4 + Math.pow(r(), 4) * 3, 0, 7); g.fill(); }
      g.globalAlpha = 1; g.textBaseline = "alphabetic";
      const digits = ["1001", "100", "0110", "1021", "00", "1945", "70", "101"];
      for (let i = 0; i < 9; i++) { const s = 90 + r() * 180; g.font = `500 ${s}px Montserrat`; g.fillStyle = `rgba(48,36,20,${0.05 + r() * 0.06})`;
        g.fillText(digits[i % digits.length], r() * 1100 - 60, 120 + r() * 650); }
      T.paper = c; }
    /* luces del papel (screen) */
    { const c = canvas(1280, 720), g = c.getContext("2d");
      for (let i = 0; i < 70; i++) { const x = r() * 1280, y = r() * 720, R = 30 + r() * 200, gr = g.createRadialGradient(x, y, 0, x, y, R);
        const a = 0.03 + r() * 0.08; gr.addColorStop(0, `rgba(255,244,220,${a})`); gr.addColorStop(1, "rgba(255,244,220,0)"); g.fillStyle = gr; g.fillRect(x - R, y - R, 2 * R, 2 * R); }
      T.paperLight = c; }
    /* scanlines finas (las de la tele vieja que se ven en el 1940) */
    { const c = canvas(4, 6), g = c.getContext("2d"); g.fillStyle = "rgba(0,0,0,.55)"; g.fillRect(0, 0, 4, 1); g.fillStyle = "rgba(255,255,255,.25)"; g.fillRect(0, 3, 4, 1); T.scan = c; }
    return T;
  }
  P.tex = () => TEX || (TEX = makeTextures());

  /* ---------------------------------------------------------------- subtítulos */
  function injectCss() {
    if (document.getElementById("pelicula-css")) return;
    const s = document.createElement("style"); s.id = "pelicula-css";
    s.textContent = `
[data-family="pelicula"] .k-cap { font-family: Montserrat, system-ui, sans-serif; font-weight: 600; text-transform: uppercase;
  letter-spacing: .035em; color: rgba(243,234,219,.78); font-size: clamp(13px, 2.7vmin, 36px); line-height: 1.25;
  text-shadow: 0 1px 2px rgba(20,14,6,.95), 0 0 14px rgba(20,14,6,.75), 0 0 34px rgba(20,14,6,.45); }
[data-family="pelicula"] .k-w-cur { color: #f6efe2; font-weight: 800; }
[data-family="pelicula"] .k-cap-line { padding: .1em .5em; }`;
    document.head.appendChild(s);
  }

  /* ---------------------------------------------------------------- fotos */
  /* virado sepia de archivo: luminancia → contraste suave → degradé sombra/medio/luz */
  const STOPS = [[0, [23, 19, 12]], [0.25, [74, 65, 48]], [0.55, [148, 136, 104]], [0.8, [206, 193, 156]], [1, [243, 232, 202]]];
  const LUT = (() => { const out = []; for (let i = 0; i < 256; i++) { const l = clamp((i / 255 - 0.5) * 1.12 + 0.52); let k = 0; while (k < STOPS.length - 2 && l > STOPS[k + 1][0]) k++;
    const [a, ca] = STOPS[k], [b, cb] = STOPS[k + 1], q = (l - a) / (b - a); out.push(ca.map((v, j) => Math.round(lerp(v, cb[j], q)))); } return out; })();
  const graded = new Map();
  P.grade = (ctx, src) => {
    if (!src) return null;
    if (graded.has(src)) return graded.get(src);
    const im = ctx.img(src); if (!im) return null;
    const k = Math.min(1, 1600 / Math.max(im.width, im.height)), c = canvas(im.width * k, im.height * k), g = c.getContext("2d");
    g.drawImage(im, 0, 0, c.width, c.height);
    try {
      const id = g.getImageData(0, 0, c.width, c.height), d = id.data;
      for (let i = 0; i < d.length; i += 4) { const L = LUT[Math.round(d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11)]; d[i] = L[0]; d[i + 1] = L[1]; d[i + 2] = L[2]; }
      g.putImageData(id, 0, 0);
    } catch (e) { g.filter = "grayscale(1) sepia(.55) contrast(.92) brightness(.97)"; g.drawImage(im, 0, 0, c.width, c.height); g.filter = "none"; }
    graded.set(src, c);
    return c;
  };
  /** dibuja `im` cubriendo (x,y,w,h); zoom ≥ 1, foco fx/fy 0..1, px/py desplazan (fracción del recorte) */
  P.cover = (G, im, x, y, w, h, o = {}) => {
    if (!im) return;
    const z = Math.max(1, o.zoom || 1), iar = im.width / im.height, ar = w / h;
    let sw, sh; if (iar > ar) { sh = im.height; sw = sh * ar; } else { sw = im.width; sh = sw / ar; }
    sw /= z; sh /= z;
    const sx = clamp((im.width - sw) * (o.fx ?? 0.5) + (o.px || 0) * sw, 0, im.width - sw), sy = clamp((im.height - sh) * (o.fy ?? 0.5) + (o.py || 0) * sh, 0, im.height - sh);
    G.drawImage(im, sx, sy, sw, sh, x, y, w, h);
  };

  /* ---------------------------------------------------------------- lienzo de escena */
  P.surface = ctx => {
    const { W, H } = ctx.stage, d = ctx.dpr, c = canvas(W * d, H * d), g = c.getContext("2d");
    return { c, g, W, H, d,
      begin() { g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = "source-over"; g.filter = "none"; g.clearRect(0, 0, c.width, c.height); g.setTransform(d, 0, 0, d, 0, 0); return g; },
      free() { c.width = c.height = 1; } };
  };

  /** franjas de glitch: copia `src` (lienzo en px reales) a G (coords CSS) con bandas desplazadas */
  P.slices = (G, src, x, y, w, h, f, amt, seed = 1) => {
    const r = K.rng(f * 977 + seed * 31 + 7), sx = src.width / w, sy = src.height / h;
    G.drawImage(src, x, y, w, h);
    const n = 5 + Math.floor(r() * 6);
    for (let i = 0; i < n; i++) {
      const by = r() * h, bh = h * (0.02 + r() * 0.12), dx = (r() - 0.5) * 2 * amt * w * (0.4 + r());
      G.drawImage(src, 0, by * sy, src.width, bh * sy, x + dx, y + by, w, bh);
      if (r() < 0.35) { G.save(); G.globalAlpha *= 0.55; G.drawImage(src, 0, by * sy, src.width, bh * sy, x - dx * 0.6, y + by - bh * (0.5 + r()), w, bh); G.restore(); }
    }
  };

  /**
   * Pega el lienzo de escena en ctx.g.main con su entrada/salida.
   * o.enter: cut | whip | whipR | whipUp | whipDown | zoom | focus | glitch | fade
   * o.exit : none | whip | whipR | whipUp | whipDown | zoom
   */
  P.composite = (ctx, S, lt, b, o = {}) => {
    const G = ctx.g.main, { W, H } = ctx.stage, f = P.fi(b.t0 + lt);
    let ox = 0, oy = 0, smx = 0, smy = 0, zb = 0, blur = 0, alpha = 1, gl = 0;
    const en = o.enter || "cut", ED = o.enterDur ?? (en === "zoom" ? 0.55 : en === "focus" ? 0.6 : 0.6);
    if (lt < ED) {
      const q = clamp(lt / ED), e = 1 - Math.pow(1 - q, 3), v = 3 * Math.pow(1 - q, 2) / ED;   /* posición y velocidad (expo-out cúbico) */
      if (/^whip/.test(en)) {
        const A = (en === "whipUp" || en === "whipDown" ? H : W) * 0.55, s = en === "whip" || en === "whipUp" ? 1 : -1;
        const off = s * A * (1 - e), L = Math.min(A * 0.55, A * v * 0.07);
        if (en === "whip" || en === "whipR") { ox = off; smx = s * L; } else { oy = off; smy = s * L; }
        alpha = clamp(lt / 0.08);
      } else if (en === "zoom") { zb = 1 - e; alpha = clamp(lt / 0.06); }
      else if (en === "focus") blur = 14 * (1 - e);
      else if (en === "glitch") gl = lt < ED * 0.85 ? 0.09 * (1 - q * 0.6) : 0;
      else if (en === "fade") alpha = e;
    }
    const ex = o.exit || "none", XD = o.exitDur ?? 0.3;
    if (ex !== "none" && lt > b.dur - XD) {
      const q = clamp((lt - (b.dur - XD)) / XD), e = q * q * q, v = 3 * q * q / XD;
      if (/^whip/.test(ex)) {
        const A = (ex === "whipUp" || ex === "whipDown" ? H : W) * 0.55, s = ex === "whip" || ex === "whipUp" ? -1 : 1;
        const off = s * A * e, L = Math.min(A * 0.55, A * v * 0.07);
        if (ex === "whip" || ex === "whipR") { ox += off; smx += -s * L; } else { oy += off; smy += -s * L; }
      } else if (ex === "zoom") zb = Math.max(zb, e);
    }
    G.save();
    G.globalAlpha = alpha;
    if (blur > 0.3) G.filter = `blur(${blur.toFixed(1)}px)`;
    if (gl > 0) P.slices(G, S.c, ox, oy, W, H, f, gl, 3);
    else if (smx || smy) {                                      /* motion blur: promedio de copias a lo largo de la estela */
      const N = 12;
      for (let k = 0; k < N; k++) { G.globalAlpha = alpha / (k + 1); G.drawImage(S.c, ox + smx * k / (N - 1), oy + smy * k / (N - 1), W, H); }
      if (ox > 0) { /* el borde que todavía no entró queda con la escena anterior: lo esconde la estela */ }
    } else if (zb > 0.01) {                                     /* zoom radial: copias escaladas desde el centro */
      const N = 10, cx = W / 2, cy = H / 2;
      for (let k = 0; k < N; k++) { const s = 1 + zb * 0.6 * (k / (N - 1)) * (0.35 + zb); G.globalAlpha = alpha / (k + 1); G.drawImage(S.c, cx - W * s / 2, cy - H * s / 2, W * s, H * s); }
    } else G.drawImage(S.c, ox, oy, W, H);
    G.restore();
  };

  /* ---------------------------------------------------------------- perforaciones y tiras */
  /** geometría de perforación en px (relativa a u: igual en 16:9 y 9:16) */
  P.perf = (st, k = 1) => { const u = st.u; return { w: 4.8 * u * k, h: 6.6 * u * k, pitch: 11.6 * u * k, r: 1.15 * u * k }; };
  /**
   * Fila de perforaciones sobre banda oscura translúcida.
   * o = { axis:"x"|"y", at (centro en el eje cruzado), k (escala), scroll (px), alpha, band (alfa de la banda), from, to }
   */
  P.perfRow = (G, st, o) => {
    const pf = P.perf(st, o.k || 1), X = o.axis !== "y", len0 = o.from ?? -pf.pitch, len1 = o.to ?? (X ? st.W : st.H) + pf.pitch;
    const bw = pf.h * 1.75, a = o.alpha ?? 1;
    G.save();
    if (o.band !== 0) { G.globalAlpha = a * (o.band ?? 0.42); G.fillStyle = "#1d170e";
      if (X) G.fillRect(len0, o.at - bw / 2, len1 - len0, bw); else G.fillRect(o.at - bw / 2, len0, bw, len1 - len0); }
    G.globalAlpha = a * (o.holes ?? 0.9); G.fillStyle = o.color || COL.paper;
    G.shadowColor = "rgba(255,240,205,.55)"; G.shadowBlur = pf.r * 1.6;
    const sc = (((o.scroll || 0) % pf.pitch) + pf.pitch) % pf.pitch;
    G.beginPath();
    for (let p = len0 - pf.pitch + sc; p < len1; p += pf.pitch) {
      if (X) G.roundRect(p, o.at - pf.h / 2, pf.w, pf.h, pf.r); else G.roundRect(o.at - pf.h / 2, p, pf.h, pf.w, pf.r);
    }
    G.fill();
    G.restore();
  };
  /**
   * Tira de película con cuadros de foto y perforaciones en los bordes.
   * o = { axis, a0, a1 (extremos en el eje cruzado), imgs:[canvas], ar (proporción del cuadro), scroll (px),
   *       k (escala de perforación), edges:"both"|"start"|"end"|"none", alpha, frameAlpha, zoom, from, to }
   */
  P.filmStrip = (G, st, o) => {
    const X = o.axis !== "y", pf = P.perf(st, o.k || 1), bw = pf.h * 1.75, ed = o.edges || "both";
    const c0 = o.a0 + (ed === "both" || ed === "start" ? bw : 0), c1 = o.a1 - (ed === "both" || ed === "end" ? bw : 0);
    const ch = c1 - c0, fw = X ? ch * (o.ar || 1.5) : ch / (o.ar || 1.5), gap = st.u * 0.9;
    const L = X ? st.W : st.H, step = fw + gap, imgs = (o.imgs || []).filter(Boolean);
    G.save(); G.globalAlpha = o.alpha ?? 1;
    G.fillStyle = "#231c11"; if (X) G.fillRect(-2, o.a0, st.W + 4, o.a1 - o.a0); else G.fillRect(o.a0, -2, o.a1 - o.a0, st.H + 4);
    if (imgs.length) {
      const sc = o.scroll || 0, first = Math.floor((-sc - step) / step);
      G.globalAlpha = (o.alpha ?? 1) * (o.frameAlpha ?? 1);
      for (let i = first; i * step + sc < L + step; i++) {
        const p = i * step + sc, im = imgs[((i % imgs.length) + imgs.length) % imgs.length];
        if (X) P.cover(G, im, p, c0, fw, ch, { zoom: o.zoom || 1.05, fx: 0.5, fy: 0.45 }); else P.cover(G, im, c0, p, ch, fw, { zoom: o.zoom || 1.05 });
      }
    }
    G.restore();
    const ps = (o.scroll || 0) * (o.perfRatio ?? 1);
    if (ed === "both" || ed === "start") P.perfRow(G, st, { axis: o.axis, at: o.a0 + bw / 2, k: o.k, scroll: ps, alpha: o.alpha ?? 1, band: 0.5 });
    if (ed === "both" || ed === "end") P.perfRow(G, st, { axis: o.axis, at: o.a1 - bw / 2, k: o.k, scroll: ps, alpha: o.alpha ?? 1, band: 0.5 });
  };

  /* ---------------------------------------------------------------- arcos y líneas finas */
  P.makeLines = (rng, st, n = 2) => {
    const { W, H } = st, out = [];
    for (let i = 0; i < n; i++) out.push({ kind: "arc", cx: W * (0.15 + rng() * 0.7), cy: H * (0.2 + rng() * 0.6), r: H * (0.4 + rng() * 0.45), a0: rng() * 6.28, span: 2.2 + rng() * 3.2, v: (rng() < 0.5 ? -1 : 1) * (0.03 + rng() * 0.05) });
    for (let i = 0; i < 2 + Math.floor(rng() * 2); i++) { const a = (rng() - 0.5) * 2.4, cx = W * rng(), cy = H * rng(), L = Math.hypot(W, H);
      out.push({ kind: "line", x0: cx - Math.cos(a) * L, y0: cy - Math.sin(a) * L, x1: cx + Math.cos(a) * L, y1: cy + Math.sin(a) * L, dx: (rng() - 0.5) * W * 0.03 }); }
    return out;
  };
  P.lines = (G, st, list, lt, alpha = 1) => {
    G.save(); G.strokeStyle = COL.cream; G.lineWidth = Math.max(1, st.u * 0.17); G.globalAlpha = 0.5 * alpha;
    for (const l of list) {
      G.beginPath();
      if (l.kind === "arc") G.arc(l.cx, l.cy, l.r, l.a0 + lt * l.v, l.a0 + lt * l.v + l.span);
      else { G.moveTo(l.x0 + l.dx * lt, l.y0); G.lineTo(l.x1 + l.dx * lt, l.y1); }
      G.stroke();
    }
    G.restore();
  };

  /** textura de papel/manchas encima de la escena (con desplazamiento según la semilla) */
  P.paper = (G, st, seed, a = 1) => {
    const T = P.tex(), r = K.rng(seed + 5), sx = r() * 0.3, sy = r() * 0.3, fl = r() < 0.5;
    G.save(); G.globalCompositeOperation = "multiply"; G.globalAlpha = 0.9 * a;
    if (fl) { G.translate(st.W, 0); G.scale(-1, 1); }
    const w = st.W * 1.35, h = Math.max(st.H * 1.35, w * 0.5625);
    G.drawImage(T.paper, -sx * st.W, -sy * st.H, w, h);
    G.globalCompositeOperation = "screen"; G.globalAlpha = 0.8 * a;
    G.drawImage(T.paperLight, -sy * st.W, -sx * st.H, w, h);
    G.restore();
  };
  /** rubor rojo-marrón (los fines de plano de la referencia) */
  P.flush = (G, st, a) => {
    if (a <= 0.01) return;
    G.save(); G.globalCompositeOperation = "multiply"; G.globalAlpha = a;
    const gr = G.createRadialGradient(st.W * 0.5, st.H * 0.5, st.H * 0.1, st.W * 0.5, st.H * 0.5, Math.max(st.W, st.H) * 0.8);
    gr.addColorStop(0, "#e0b4a0"); gr.addColorStop(1, "#a4483a"); G.fillStyle = gr; G.fillRect(0, 0, st.W, st.H);
    G.restore();
  };

  /* ---------------------------------------------------------------- bloque de texto (año + titular + subtítulo) */
  const mc = canvas(8, 8).getContext("2d");
  const measure = (txt, font, ls = 0) => { mc.font = font; mc.letterSpacing = ls + "px"; return mc.measureText(txt).width; };
  P.measure = measure;
  /**
   * Arma el bloque una vez en un lienzo propio (erosionado). o = { year, title, sub, kicker, layout:"under"|"over",
   * width (ancho del año en px), maxW (ancho máximo del bloque), color, res (escala máx. a la que se va a dibujar), dpr, weight }
   * → { c, w, h, R } en px CSS a escala 1 (c tiene w·R × h·R)
   */
  P.card = (o) => {
    const over = o.layout === "over", color = o.color || COL.orange;
    const year = String(o.year || ""), titleLines = String(o.title || "").split("\n").filter(s => s.length), sub = String(o.sub || "");
    const yW = o.weight || (over ? 600 : 500);
    /* cuerpo del año: el ancho pedido, como mínimo el de ~4 cifras (un "28" no puede ocupar media pantalla) */
    const em = year ? measure(year, `${yW} 100px Montserrat`, 2) / 100 : 2.8;
    let fs = o.width / Math.max(em, 2.75);
    if (o.maxFs) fs = Math.min(fs, o.maxFs);
    const yLs = fs * 0.02, yFont = `${yW} ${fs}px Montserrat`, yw = year ? measure(year, yFont, yLs) : 0;
    let tf = fs * (over ? 0.215 : 0.33);
    const tLs = () => tf * 0.012, tFont = () => `800 ${tf}px Montserrat`;
    const maxT = Math.min(o.maxW || 1e9, Math.max(yw * (over ? 1.12 : 1.3), fs * 2.2));
    const tw0 = Math.max(0, ...titleLines.map(l => measure(l.toUpperCase(), tFont(), tLs())));
    if (tw0 > maxT) tf *= maxT / tw0;
    const tw = Math.max(0, ...titleLines.map(l => measure(l.toUpperCase(), tFont(), tLs())));
    const sf = fs * 0.105, sFont = `600 ${sf}px Montserrat`, sLs = sf * 0.03, kf = fs * 0.07, kFont = `600 ${kf}px Montserrat`;
    const capY = fs * 0.72, capT = tf * 0.72, lh = tf * 1.02;
    /* coordenadas dentro del bloque (y = líneas base) */
    const L = { year: null, title: [], bar: null, sub: null, kicker: null };
    const pad = fs * 0.12;
    let y = pad;
    if (over) {
      titleLines.forEach((l, i) => { L.title.push({ t: l.toUpperCase(), x: -fs * 0.05, y: y + capT + i * lh }); });
      y += capT + (titleLines.length - 1) * lh + (titleLines.length ? fs * 0.05 : 0);
      if (year) { L.year = { x: 0, y: y + capY }; y += capY; }
    } else {
      if (year) { L.year = { x: 0, y: y + capY }; y += capY; }
      titleLines.forEach((l, i) => { L.title.push({ t: l.toUpperCase(), x: -fs * 0.02, y: y - (year ? fs * 0.02 : 0) + capT + i * lh }); });
      if (titleLines.length) y += capT + (titleLines.length - 1) * lh - (year ? fs * 0.02 : 0);
    }
    const barW = fs * 0.37, barH = Math.max(2, fs * 0.045);
    if (sub) {
      const bx = year ? Math.min(yw * 0.24, fs * 0.6) : 0, by = y + fs * 0.085;
      L.bar = { x: bx, y: by, w: barW, h: barH };
      L.sub = { t: sub.toUpperCase(), x: bx + barW + fs * 0.05, y: by + barH / 2 + sf * 0.36 };
      y = by + Math.max(barH, sf);
    }
    if (o.kicker) L.kicker = { t: String(o.kicker).toUpperCase(), x: Math.max(yw, tw) - measure(String(o.kicker).toUpperCase(), kFont, kf * 0.04), y: (L.title[0]?.y ?? y) - capT - kf * 0.5 };
    const subW = L.sub ? L.sub.x + measure(L.sub.t, sFont, sLs) : 0;
    const w = Math.max(yw, tw - fs * 0.02, subW) + pad * 2, h = y + pad;
    const R = o.res || 2, c = canvas(w * R + 2, h * R + 2), g = c.getContext("2d");
    g.scale(R, R); g.translate(pad, 0); g.textBaseline = "alphabetic";
    if (L.year) { g.font = yFont; g.letterSpacing = yLs + "px"; g.fillStyle = color; g.globalAlpha = 1; g.fillText(year, L.year.x, L.year.y); g.globalAlpha = 1; }
    if (L.bar) { g.fillStyle = color; g.fillRect(L.bar.x, L.bar.y, L.bar.w, L.bar.h); }
    g.font = tFont(); g.letterSpacing = tLs() + "px"; g.fillStyle = COL.cream;
    for (const l of L.title) g.fillText(l.t, l.x, l.y);
    /* erosión: motas que dejan ver la foto (como la tinta gastada de la referencia) */
    const T = P.tex(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "destination-out";
    const pat = g.createPattern(T.speck, "repeat"); const sR = Math.max(1, R * 0.9); pat.setTransform(new DOMMatrix().scale(sR, sR).translate((o.seed || 0) % 400, ((o.seed || 0) * 7) % 300));
    g.globalAlpha = 0.6; g.fillStyle = pat; g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = "source-over"; g.globalAlpha = 1; g.setTransform(R, 0, 0, R, 0, 0); g.translate(pad, 0);
    if (L.sub) { g.font = sFont; g.letterSpacing = sLs + "px"; g.fillStyle = COL.cream; g.fillText(L.sub.t, L.sub.x, L.sub.y); }
    if (L.kicker) { g.font = kFont; g.letterSpacing = kf * 0.04 + "px"; g.fillStyle = COL.cream; g.globalAlpha = 0.85; g.fillText(L.kicker.t, L.kicker.x, L.kicker.y); }
    return { c, w, h, R, fs, pad };
  };
  /**
   * Dibuja el bloque en (x,y) a escala s. o = { alpha, smearY (px de estela vertical), glitch (0..1), f (cuadro) }
   */
  P.drawCard = (G, card, x, y, s, o = {}) => {
    const w = card.w * s, h = card.h * s, a = o.alpha ?? 1;
    if (a <= 0.005) return;
    G.save(); G.globalAlpha = a;
    if (o.glitch > 0.01) P.slices(G, card.c, x, y, w, h, o.f || 0, o.glitch * 0.12, 11);
    else if (Math.abs(o.smearY || 0) > 1 || Math.abs(o.smearX || 0) > 1) {
      const N = 9;
      for (let k = 0; k < N; k++) { G.globalAlpha = a * (k === 0 ? 1 : 0.9 / (k + 1)); G.drawImage(card.c, x + (o.smearX || 0) * k / (N - 1), y + (o.smearY || 0) * k / (N - 1), w, h); }
    } else G.drawImage(card.c, x, y, w, h);
    G.restore();
  };
  /**
   * Ubica un bloque w×h según `pos` (center, left, right, topLeft, topRight, bottomLeft, bottomRight, bigLeft, bigRight).
   * Respeta la zona de subtítulos. → {x, y}
   */
  P.place = (st, pos, w, h) => {
    const { W, H, portrait } = st, capTop = st.caption.y - H * 0.02, mx = W * (portrait ? 0.06 : 0.07), my = H * (portrait ? 0.1 : 0.09);
    const cy = portrait ? H * 0.42 : H * 0.47;
    let x = (W - w) / 2, y = cy - h / 2;
    if (/Left$|^left$/.test(pos)) x = portrait ? Math.max(mx, (W - w) / 2) : mx;
    if (/Right$|^right$/.test(pos)) x = portrait ? Math.min(W - mx - w, (W - w) / 2) : W - mx - w;
    if (/^top/.test(pos)) y = my;
    if (/^bottom/.test(pos)) y = capTop - h;
    if (pos === "bigLeft") { x = -w * 0.03; y = cy - h / 2; }
    if (pos === "bigRight") { x = W - w * 0.97; y = cy - h / 2; }
    return { x, y };
  };

  /* ---------------------------------------------------------------- destellos (light leaks) */
  /**
   * kind: burn (naranja→blanco por un costado), prism (banda rojo→blanco→verde que cruza),
   *       flash (golpe blanco cálido), bar (barra de luz crema que cruza). q = progreso 0..1.
   */
  P.leak = (G, st, kind, q, o = {}) => {
    const { W, H } = st, s = o.strength ?? 1, dir = o.dir === "rtl" ? -1 : 1;
    if (q <= 0 || q >= 1) return;
    G.save(); G.globalCompositeOperation = "screen";
    if (kind === "burn") {
      /* sube rápido (35 %), meseta y se retira; el núcleo viaja de un costado al centro */
      const env = q < 0.35 ? ease.sine(q / 0.35) : q < 0.55 ? 1 : 1 - ease.sine((q - 0.55) / 0.45), e = env * s;
      const x0 = dir > 0 ? lerp(-0.2, 0.55, q) * W : lerp(1.2, 0.45, q) * W;
      const lg = G.createLinearGradient(dir > 0 ? 0 : W, 0, dir > 0 ? W : 0, 0);
      lg.addColorStop(0, `rgba(232,100,42,${0.95 * e})`); lg.addColorStop(0.45, `rgba(247,163,74,${0.8 * e})`); lg.addColorStop(1, `rgba(255,231,168,${0.55 * e})`);
      G.fillStyle = lg; G.fillRect(0, 0, W, H);
      const rg = G.createRadialGradient(x0, H * 0.42, 0, x0, H * 0.42, Math.max(W, H) * 0.95);
      rg.addColorStop(0, `rgba(255,255,255,${Math.pow(e, 1.3)})`); rg.addColorStop(0.35, `rgba(255,236,170,${0.95 * Math.pow(e, 1.2)})`); rg.addColorStop(1, "rgba(255,200,120,0)");
      G.fillStyle = rg; G.fillRect(0, 0, W, H);
      if (e > 0.75) { G.globalCompositeOperation = "source-over"; G.fillStyle = `rgba(255,250,236,${(e - 0.75) * 3.2})`; G.fillRect(0, 0, W, H); }
    } else if (kind === "prism") {
      const env = Math.sin(Math.PI * q) * s, bw = W * 0.6, cx = dir > 0 ? lerp(-bw * 0.6, W + bw * 0.6, q) : lerp(W + bw * 0.6, -bw * 0.6, q);
      G.fillStyle = `rgba(255,250,240,${0.5 * env})`; G.fillRect(0, 0, W, H);
      const lg = G.createLinearGradient(cx - bw / 2, 0, cx + bw / 2, 0);
      lg.addColorStop(0, "rgba(190,90,50,0)"); lg.addColorStop(0.22, `rgba(190,90,50,${0.75 * env})`); lg.addColorStop(0.45, `rgba(255,252,244,${env})`);
      lg.addColorStop(0.62, `rgba(230,242,220,${0.9 * env})`); lg.addColorStop(0.8, `rgba(150,196,100,${0.6 * env})`); lg.addColorStop(1, "rgba(150,196,100,0)");
      G.fillStyle = lg; G.fillRect(cx - bw / 2, 0, bw, H);
    } else if (kind === "flash") {
      const e = (q < 0.15 ? q / 0.15 : Math.pow(1 - (q - 0.15) / 0.85, 2)) * s;
      G.fillStyle = `rgba(255,246,228,${0.92 * e})`; G.fillRect(0, 0, W, H);
    } else if (kind === "bar") {
      const bw = W * 0.2, cx = dir > 0 ? lerp(-bw, W + bw, q) : lerp(W + bw, -bw, q), e = Math.sin(Math.PI * q) * s;
      const lg = G.createLinearGradient(cx - bw / 2, 0, cx + bw / 2, 0);
      lg.addColorStop(0, "rgba(255,244,222,0)"); lg.addColorStop(0.5, `rgba(255,244,222,${0.5 * e})`); lg.addColorStop(1, "rgba(255,244,222,0)");
      G.fillStyle = lg; G.fillRect(cx - bw / 2, 0, bw, H);
    }
    G.restore();
  };

  /* ---------------------------------------------------------------- película: grano, rayas, polvo, parpadeo */
  let VG = null;
  function filmFx(G, st, t) {
    const T = P.tex(), { W, H, u } = st, f = P.fi(t), r = K.rng(f * 7919 + 13);
    G.save();
    /* grano */
    const pat = G.createPattern(T.grain[f % 4], "repeat"); pat.setTransform(new DOMMatrix().translate(r() * 256, r() * 256).scale(0.75, 0.75));
    G.globalCompositeOperation = "overlay"; G.globalAlpha = 0.2; G.fillStyle = pat; G.fillRect(0, 0, W, H);
    /* scanlines suaves */
    G.globalCompositeOperation = "soft-light"; G.globalAlpha = 0.2; G.fillStyle = G.createPattern(T.scan, "repeat"); G.fillRect(0, 0, W, H);
    G.globalCompositeOperation = "source-over";
    /* rayas verticales: una que persiste ~0.5 s y 0–2 sueltas por cuadro */
    const r2 = K.rng(Math.floor(t * 2) * 131 + 3), sx = r2() * W + Math.sin(t * 7) * u * 0.6;
    const scratch = (x, a, lw, c) => { G.globalAlpha = a; G.strokeStyle = c; G.lineWidth = lw; G.beginPath(); G.moveTo(x, -5); G.bezierCurveTo(x + u * 0.4, H * 0.35, x - u * 0.5, H * 0.7, x + u * 0.2, H + 5); G.stroke(); };
    if (r2() < 0.75) scratch(sx, 0.18 + r() * 0.12, Math.max(1, u * 0.12), "#f6ecd6");
    for (let i = 0, n = Math.floor(r() * 3); i < n; i++) scratch(r() * W, 0.08 + r() * 0.2, Math.max(0.7, u * (0.06 + r() * 0.12)), r() < 0.6 ? "#f6ecd6" : "#2a2013");
    /* polvo y pelos */
    for (let i = 0, n = Math.floor(r() * 5); i < n; i++) { const x = r() * W, y = r() * H, R = u * (0.12 + Math.pow(r(), 2) * 0.6);
      G.globalAlpha = 0.35 + r() * 0.4; G.fillStyle = r() < 0.7 ? "#1e170d" : "#f7eedb"; G.beginPath(); G.ellipse(x, y, R, R * (0.5 + r() * 0.6), r() * 3, 0, 7); G.fill(); }
    if (r() < 0.12) { const x = r() * W, y = r() * H; G.globalAlpha = 0.4; G.strokeStyle = "#1e170d"; G.lineWidth = Math.max(0.8, u * 0.1);
      G.beginPath(); G.moveTo(x, y); G.bezierCurveTo(x + u * 3, y - u * 4, x + u * 6, y + u * 3, x + u * (4 + r() * 6), y + u * 6); G.stroke(); }
    /* parpadeo de exposición */
    const fl = (r() - 0.5) * 0.07; G.globalAlpha = Math.abs(fl); G.fillStyle = fl > 0 ? "#fff6e4" : "#1a130a"; G.fillRect(0, 0, W, H);
    /* viñeta */
    if (!VG || VG.W !== W || VG.H !== H) { const g = G.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.62);
      g.addColorStop(0, "rgba(30,20,8,0)"); g.addColorStop(1, "rgba(30,20,8,.42)"); VG = { W, H, g }; }
    G.globalAlpha = 1; G.fillStyle = VG.g; G.fillRect(0, 0, W, H);
    G.restore();
  }

  K.family("pelicula", {
    setup(ctx) { P.tex(); injectCss(); return {}; },
    frame(t, ctx) { P.fade = 0; const G = ctx.g.bg, st = ctx.stage; G.fillStyle = COL.base; G.fillRect(0, 0, st.W, st.H); },
    post(t, ctx) {
      filmFx(ctx.g.top, ctx.stage, t);
      /* fundido a negro del cierre (P.fade lo pone pelicula.outro): tapa también grano y rayas */
      if (P.fade > 0) { const G = ctx.g.top; G.save(); G.globalAlpha = clamp(P.fade); G.fillStyle = "#050403"; G.fillRect(0, 0, ctx.stage.W, ctx.stage.H); G.restore(); }
    },
    resize() { VG = null; },
  });
})();
