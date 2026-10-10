/* =============================================================================
   pop · runtime de la familia "DUOTONO" (menta / violeta / rosa, póster editorial)
   -----------------------------------------------------------------------------
   Réplica de estilo de una promo editorial (ver designs/pop/DESIGN.md). Reglas:
   · TODO se dibuja en canvas (ctx.g.main / ctx.g.top): cada cuadro es función pura de lt/t;
   · las fotos se convierten UNA vez a duotono (mapa de gradiente de la paleta: oscuro → violeta,
     medios → rosa, luces → menta) y se cachean como lienzos (Kit.pop.duo);
   · cortes SECOS entre planos (transition.overlap = 0): la "transición" es la ENTRADA del
     plano nuevo (param `fx` de cada componente: glitch, flicker, shards, liquid) → Kit.pop.enter;
   · tipografía: Archivo extendida (wdth 125) 800/900 en mayúsculas, Noto Sans JP 900, Montserrat 600.
   Utilidades en Kit.pop: font, text, measure, fit, duo, cover, clipPoly, hatch, arrow, plus,
   mark, enter, life, words, FX (param común).
   ========================================================================== */
(function () {
  const K = window.Kit, { clamp, lerp, prog, ease } = K;
  for (const f of ["800 expanded 40px Archivo", "900 expanded 40px Archivo", "700 expanded 20px Archivo", "600 expanded 20px Archivo",
    "600 20px Montserrat", "700 20px Montserrat", "900 40px 'Noto Sans JP'"]) K.fonts.add(f);

  const FPS = 30;
  let STATE = null;

  /* ------------------------------------------------------------- color */
  const hex = h => { h = String(h).replace("#", ""); if (h.length === 3) h = h.split("").map(c => c + c).join(""); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const rgba = (h, a = 1) => { const [r, g, b] = hex(h); return `rgba(${r},${g},${b},${a})`; };
  const mix = (a, b, p) => { const A = hex(a), B = hex(b); return "#" + A.map((v, i) => Math.round(lerp(v, B[i], p)).toString(16).padStart(2, "0")).join(""); };

  /* ------------------------------------------------------------- tipografía */
  /** fuente canvas: Archivo extendida por defecto (la grotesca ancha de la referencia) */
  const font = (size, w = 800, st = "expanded", fam = "Archivo") => `${w} ${st === "normal" ? "" : st + " "}${size}px ${fam}, sans-serif`;
  const JP = (size, w = 900) => `${w} ${size}px 'Noto Sans JP', sans-serif`;
  const MONT = (size, w = 600) => `${w} ${size}px Montserrat, sans-serif`;
  let MC = null;
  function measure(s, f, sp = 0) {
    MC ||= document.createElement("canvas").getContext("2d");
    MC.font = f; MC.letterSpacing = sp ? sp + "px" : "0px";
    return MC.measureText(String(s)).width;
  }
  /** texto en canvas: o = { font, color, align, base, sp(px), alpha } */
  function text(G, s, x, y, o = {}) {
    G.save();
    G.font = o.font || font(40); G.fillStyle = o.color || "#000"; G.textAlign = o.align || "left"; G.textBaseline = o.base || "alphabetic";
    G.letterSpacing = (o.sp || 0) + "px";
    if (o.alpha != null) G.globalAlpha *= o.alpha;
    if (o.stroke) { G.strokeStyle = o.stroke; G.lineWidth = o.lw || 1; G.strokeText(String(s), x, y); } else G.fillText(String(s), x, y);
    G.restore();
  }
  /** tamaño de fuente para que `s` ocupe `w` px (con tope `max`) */
  function fit(s, w, max, wt = 800, st = "expanded", sp = 0) {
    const m = measure(s, font(100, wt, st), sp * 100) / 100;
    return Math.min(max ?? 1e9, w / Math.max(1e-3, m));
  }
  /** caracteres de un texto como array (respeta acentos) con su ancho y posición x relativa */
  function glyphs(s, f, sp = 0) {
    const out = []; let x = 0;
    for (const c of String(s)) { const w = measure(c, f); out.push({ c, x, w }); x += w + sp; }
    return { list: out, width: x - sp };
  }

  /* ------------------------------------------------------------- duotono */
  /** LUT de 256 colores desde las paradas [[pos,"#hex"],…] */
  function lut(stops) {
    const out = new Uint8ClampedArray(256 * 3);
    for (let i = 0; i < 256; i++) {
      const v = i / 255; let k = 0;
      while (k < stops.length - 2 && v > stops[k + 1][0]) k++;
      const [p0, c0] = stops[k], [p1, c1] = stops[k + 1], q = clamp((v - p0) / (p1 - p0 || 1));
      const A = hex(c0), B = hex(c1);
      for (let j = 0; j < 3; j++) out[i * 3 + j] = lerp(A[j], B[j], q);
    }
    return out;
  }
  /**
   * Foto → lienzo en duotono (cacheado). tone: "normal" | "dark" (domina el violeta) | "light"
   * (lavada, domina la menta) | "inv" (invertida). max = lado mayor en px del lienzo cacheado.
   */
  function duo(ctx, src, tone = "normal", max = 1100) {
    const key = `${src}|${tone}|${max}`, S = STATE;
    if (S.duo.has(key)) return S.duo.get(key);
    const im = ctx.img(src);
    if (!im) { S.duo.set(key, null); return null; }
    const k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
    const w = Math.max(1, Math.round(im.naturalWidth * k)), h = Math.max(1, Math.round(im.naturalHeight * k));
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    const g = cv.getContext("2d", { willReadFrequently: true }); g.drawImage(im, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h), a = d.data;
    /* niveles automáticos: estirar entre los percentiles 2 y 98 (las fotos históricas son grises y planas) */
    const hist = new Uint32Array(256);
    for (let i = 0; i < a.length; i += 4) hist[(a[i] * 0.299 + a[i + 1] * 0.587 + a[i + 2] * 0.114) | 0]++;
    const n = a.length / 4; let acc = 0, lo = 0, hi = 255;
    for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc < n * 0.02) lo = i; if (acc < n * 0.985) hi = i; }
    const gam = tone === "dark" ? 1.55 : tone === "light" ? 0.6 : 1.0;
    const L = lut(ctx.C.pop?.duo || [[0, "#2b0f70"], [0.35, "#8a4075"], [0.6, "#cd697c"], [1, "#3ccaaa"]]);
    for (let i = 0; i < a.length; i += 4) {
      let v = (a[i] * 0.299 + a[i + 1] * 0.587 + a[i + 2] * 0.114 - lo) / Math.max(1, hi - lo);
      v = Math.pow(clamp(v), gam); if (tone === "inv") v = 1 - v;
      if (tone === "light") v = 0.35 + v * 0.65;
      const j = Math.round(v * 255) * 3; a[i] = L[j]; a[i + 1] = L[j + 1]; a[i + 2] = L[j + 2];
    }
    g.putImageData(d, 0, 0);
    S.duo.set(key, cv);
    return cv;
  }
  /** dibuja `cv` cubriendo la caja (x,y,w,h); o = { zoom, fx, fy (foco 0..1), dx, dy, alpha, blur } */
  function cover(G, cv, x, y, w, h, o = {}) {
    if (!cv) { G.save(); G.fillStyle = "#8a4075"; G.fillRect(x, y, w, h); G.restore(); return; }
    const z = o.zoom ?? 1, s = Math.max(w / cv.width, h / cv.height) * z;
    const dw = cv.width * s, dh = cv.height * s;
    const fx = o.fx ?? 0.5, fy = o.fy ?? 0.5;
    /* el foco queda lo más cerca del centro de la caja sin dejar bordes vacíos */
    let dx = x + w / 2 - fx * dw, dy = y + h / 2 - fy * dh;
    dx = Math.min(x, Math.max(x + w - dw, dx)) + (o.dx || 0); dy = Math.min(y, Math.max(y + h - dh, dy)) + (o.dy || 0);
    G.save();
    if (o.alpha != null) G.globalAlpha *= o.alpha;
    if (o.blur) G.filter = `blur(${o.blur.toFixed(1)}px)`;
    G.drawImage(cv, dx, dy, dw, dh);
    G.restore();
  }
  /* ------------------------------------------------------------- formas */
  function poly(G, pts) { G.beginPath(); pts.forEach(([x, y], i) => (i ? G.lineTo(x, y) : G.moveTo(x, y))); G.closePath(); }
  function clipPoly(G, pts) { poly(G, pts); G.clip(); }
  /** rayado diagonal dentro del clip actual: franjas de ancho `bw` cada `gap` px a `ang` grados */
  function hatch(G, x, y, w, h, o = {}) {
    const gap = o.gap ?? 20, bw = o.bw ?? gap / 2, ang = (o.ang ?? -45) * Math.PI / 180, off = o.off || 0;
    G.save(); G.beginPath(); G.rect(x, y, w, h); G.clip();
    G.translate(x + w / 2, y + h / 2); G.rotate(ang); G.fillStyle = o.color || "#2a0e70";
    const R = Math.hypot(w, h) / 2 + gap;
    for (let k = -R + ((off % gap) + gap) % gap; k < R; k += gap) G.fillRect(k, -R, bw, 2 * R);
    G.restore();
  }
  /** flecha gruesa → (cola recta + punta en chevron), caja (x,y,w,h), apuntando a la derecha */
  function arrow(G, x, y, w, h, color, th = 0.22) {
    const t = h * th, cy = y + h / 2, hx = x + w - h / 2;
    G.save(); G.fillStyle = color; G.beginPath();
    G.moveTo(x, cy - t / 2); G.lineTo(hx + t * 0.2, cy - t / 2);
    G.lineTo(hx - h * 0.36, y + t * 0.35); G.lineTo(hx - h * 0.36 + t * 0.9, y); G.lineTo(x + w, cy);
    G.lineTo(hx - h * 0.36 + t * 0.9, y + h); G.lineTo(hx - h * 0.36, y + h - t * 0.35); G.lineTo(hx + t * 0.2, cy + t / 2);
    G.lineTo(x, cy + t / 2); G.closePath(); G.fill(); G.restore();
  }
  /** cruz (+) gruesa centrada */
  function plus(G, cx, cy, s, th, color) { G.save(); G.fillStyle = color; G.fillRect(cx - s / 2, cy - th / 2, s, th); G.fillRect(cx - th / 2, cy - s / 2, th, s); G.restore(); }
  /** "×" */
  function cross(G, cx, cy, s, lw, color) { G.save(); G.strokeStyle = color; G.lineWidth = lw; G.lineCap = "butt"; G.beginPath(); G.moveTo(cx - s / 2, cy - s / 2); G.lineTo(cx + s / 2, cy + s / 2); G.moveTo(cx + s / 2, cy - s / 2); G.lineTo(cx - s / 2, cy + s / 2); G.stroke(); G.restore(); }
  /** flecha fina (↑ ↓ ↗) de línea */
  function thinArrow(G, x0, y0, x1, y1, lw, color, head) {
    const a = Math.atan2(y1 - y0, x1 - x0), hd = head ?? lw * 3.5;
    G.save(); G.strokeStyle = color; G.lineWidth = lw; G.lineCap = "butt"; G.lineJoin = "miter";
    G.beginPath(); G.moveTo(x0, y0); G.lineTo(x1, y1); G.stroke();
    G.beginPath(); G.moveTo(x1 - Math.cos(a - 0.75) * hd, y1 - Math.sin(a - 0.75) * hd); G.lineTo(x1, y1); G.lineTo(x1 - Math.cos(a + 0.75) * hd, y1 - Math.sin(a + 0.75) * hd); G.stroke();
    G.restore();
  }
  /**
   * marca del canal (reemplaza al logo de la referencia): una gota/hoja geométrica propia
   * (círculo con una muesca diagonal) o, si `txt`, el monograma en Archivo extendida 900.
   */
  function mark(G, cx, cy, r, color, txt) {
    G.save(); G.fillStyle = color;
    if (txt) { G.font = font(r * 1.5, 900); G.textAlign = "center"; G.textBaseline = "middle"; G.fillText(txt, cx, cy + r * 0.06); G.restore(); return; }
    G.beginPath(); G.ellipse(cx, cy + r * 0.1, r * 0.82, r * 0.92, 0.35, 0, Math.PI * 2); G.fill();
    G.globalCompositeOperation = "destination-out";
    G.beginPath(); G.moveTo(cx - r * 0.95, cy + r * 0.35); G.quadraticCurveTo(cx - r * 0.1, cy - r * 0.15, cx + r * 0.25, cy - r * 1.05);
    G.lineTo(cx + r * 0.45, cy - r * 1.05); G.quadraticCurveTo(cx + r * 0.02, cy + r * 0.05, cx - r * 0.95, cy + r * 0.55); G.closePath(); G.fill();
    G.restore();
  }

  /* ------------------------------------------------------------- entradas (transición = entrada) */
  /**
   * Efecto de entrada sobre el cuadro ya dibujado (copia ctx.layers.main en ctx.g.top):
   *  glitch  · 3 cuadros de bloques desplazados sobre negro (+ rayado rosa) — ref. 49,25 s
   *  flicker · glitch + 6 cuadros de parpadeo de paleta (rosa plano / menta / rosa / violeta) — ref. 49,35 s
   *  shards  · 3 cuadros de esquirlas violeta / menta inclinadas — ref. 54,65 s
   *  liquid  · cortina violeta de borde ondulado que baja en 0,28 s — ref. 50,98 s
   *  cut     · nada (corte seco, lo más común en la referencia)
   */
  function enter(ctx, kind, lt, seed = 1) {
    if (!kind || kind === "cut") return;
    const { W, H } = ctx.stage, G = ctx.g.top, P = ctx.C.palette, dpr = ctx.dpr, src = ctx.layers.main;
    const f = Math.floor(lt * FPS + 1e-6);
    const blocks = (n, dark) => {
      const r = K.rng(seed * 977 + f * 131 + 7);
      G.fillStyle = dark ? "#000" : P.bg; G.fillRect(0, 0, W, H);
      for (let i = 0; i < n; i++) {
        const bw = W * (0.04 + r() * 0.35), bh = H * (0.02 + r() * 0.14), x = r() * W - bw * 0.2, y = r() * H, sx = x + (r() - 0.5) * W * 0.4;
        if (r() < 0.16) { G.save(); G.fillStyle = P.accent; G.fillRect(x, y, bw, bh); hatch(G, x, y, bw, bh, { gap: H * 0.018, bw: H * 0.005, color: P.ink }); G.restore(); continue; }
        if (r() < 0.12) { G.fillStyle = P.ink; G.fillRect(x, y, bw, bh); continue; }
        try { G.drawImage(src, Math.max(0, sx) * dpr, y * dpr, bw * dpr, bh * dpr, x, y, bw, bh); } catch (e) {}
      }
    };
    if ((kind === "glitch" || kind === "flicker") && f < 3) { blocks(26, true); return; }
    if (kind === "flicker" && f < 9) {
      const seq = [[P.accent, "source-over", 0.88], [P.light, "color", 1], [P.light, "source-over", 0.55], [P.accent, "source-over", 0.7], [P.accent, "color", 0.9], null];
      const s = seq[f - 3]; if (!s) return;
      G.save(); G.drawImage(src, 0, 0, W, H); G.globalCompositeOperation = s[1]; G.globalAlpha = s[2]; G.fillStyle = s[0]; G.fillRect(0, 0, W, H); G.restore();
      return;
    }
    if (kind === "shards" && f < 3) {
      const r = K.rng(seed * 31 + f * 17);
      G.fillStyle = P.bg; G.fillRect(0, 0, W, H); G.fillStyle = P.ink;
      for (let y = 0; y < H; y += H * (0.03 + r() * 0.05)) {
        const h = H * (0.025 + r() * 0.07); let x = -W * 0.1;
        while (x < W) { const w = W * (0.04 + r() * 0.22), sk = (r() - 0.5) * h * 2.2; if (r() < 0.55) poly(G, [[x + sk, y], [x + w + sk, y], [x + w, y + h], [x, y + h]]), G.fill(); x += w + W * r() * 0.08; }
      }
      try { G.drawImage(src, 0, H * 0.72 * dpr, W * 0.5 * dpr, H * 0.12 * dpr, W * 0.08, H * 0.72, W * 0.5, H * 0.12); } catch (e) {}
      return;
    }
    if (kind === "liquid") {
      const q = prog(lt, 0, 0.3, "in");
      if (q >= 1) return;
      const base = lerp(H * 0.42, H * 1.08, q);
      G.save(); G.fillStyle = P.ink; G.beginPath(); G.moveTo(0, H);
      for (let x = 0; x <= W; x += W / 48) G.lineTo(x, base + Math.sin(x / W * 9 + seed + lt * 14) * H * 0.025 + Math.sin(x / W * 23 + seed * 2) * H * 0.012);
      G.lineTo(W, H); G.closePath(); G.fill(); G.restore();
    }
  }
  /** parámetro común de entrada (se agrega a cada componente) */
  const FX = (def = "cut") => ({ fx: { type: "enum", options: ["cut", "glitch", "flicker", "shards", "liquid"], default: def, doc: "Entrada del plano (la transición de la referencia): cut = corte seco · glitch = bloques sobre negro · flicker = glitch + parpadeo de paleta · shards = esquirlas violeta/menta · liquid = cortina líquida violeta." } });
  /** foco de la foto: [x,y] 0..1 */
  const FOCUS = { focus: { type: "array", default: [0.5, 0.5], doc: "Punto de la foto que queda al centro del recorte [x,y] (0..1)." } };
  /** palabras de la narración dentro del beat (para modos 'auto') */
  const words = (ctx, b) => ctx.words.filter(w => w.start >= b.t0 - 0.05 && w.start < b.t1 - 0.05);
  /** cuadro (entero) de la referencia a 30 fps: para glitches escalonados deterministas */
  const frameOf = lt => Math.floor(lt * FPS + 1e-6);
  /** letras que "faltan" en un cuadro dado (glitch de letras) */
  const missing = (i, f, seed, p = 0.3) => K.rng(seed * 7919 + f * 104729 + i * 31)() < p;

  /* ------------------------------------------------------------- familia */
  K.family("pop", {
    setup(ctx) {
      STATE = { duo: new Map(), grain: [] };
      const r = K.rng(4242);
      for (let k = 0; k < 4; k++) {
        const c = document.createElement("canvas"); c.width = c.height = 256;
        const g = c.getContext("2d"), d = g.createImageData(256, 256);
        for (let i = 0; i < d.data.length; i += 4) { const v = r() < 0.5 ? 0 : 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = Math.floor(r() * 255); }
        g.putImageData(d, 0, 0); STATE.grain.push(c);
      }
      /* subtítulos: tira violeta en paralelogramo con Archivo extendida en menta (como "YOU'LL NEVER FORGET") */
      const P = ctx.C.palette, st = document.createElement("style");
      st.textContent = `
        [data-family="pop"] .k-cap { font-family: Archivo, sans-serif; font-stretch: 125%; font-weight: 800; text-transform: uppercase;
          font-size: clamp(11px, 2.5vmin, 30px); letter-spacing: .02em; line-height: 1.15; color: ${P.light}; text-shadow: none; }
        [data-family="pop"] .k-cap-line { background: ${P.ink}; padding: .5em 1.4em .45em; max-width: 78% !important;
          clip-path: polygon(3% 0, 100% 0, 97% 100%, 0 100%); }
        [data-family="pop"] .k-w { color: ${rgba(P.light, 0.8)}; }
        [data-family="pop"] .k-w-cur { color: ${P.accent}; font-weight: 900; }`;
      document.head.appendChild(st);
      return STATE;
    },
    frame(t, ctx) {
      const { stage, g, C } = ctx;
      g.bg.fillStyle = C.palette.bg; g.bg.fillRect(0, 0, stage.W, stage.H);
    },
    post(t, ctx) {
      const a = ctx.C.pop?.grain ?? 0.07; if (!a || !STATE) return;
      const G = ctx.g.top, { W, H } = ctx.stage, c = STATE.grain[Math.floor(t * FPS) % 4];
      G.save(); G.globalAlpha = a; G.fillStyle = G.createPattern(c, "repeat"); G.fillRect(0, 0, W, H); G.restore();
    },
  });

  K.pop = { FPS, font, JP, MONT, measure, text, fit, glyphs, hex, rgba, mix, lut, duo, cover, poly, clipPoly, hatch, arrow, plus, cross, thinArrow, mark,
            enter, FX, FOCUS, words, frameOf, missing };
})();
