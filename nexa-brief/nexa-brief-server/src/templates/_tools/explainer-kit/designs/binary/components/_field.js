/* =============================================================================
   binary · campo de partículas 0/1  (runtime de la familia)
   -----------------------------------------------------------------------------
   Todo lo que se dibuja "con unos y ceros" es UN solo campo de N glifos que
   viaja de una forma a la siguiente. Un componente de forma declara en su def:
       points(ctx, p) → { x, y, a, s, g }   (Float32Array/Uint8Array, longitud n)
   y el campo se encarga de la transición (dispersión → reagrupación) con el
   reloj: cada cuadro es función pura de t (sin estado acumulado) → buscable.
   Utilidades exportadas en Kit.binary: sampleImage, samplePortrait, sampleShape, sampleText,
   glyphText, label, ring… para que los componentes no repitan código.
   ========================================================================== */
(function () {
  const K = window.Kit;
  const { clamp, lerp, ease, rng, hash } = K;
  const GLYPHS = ["0", "1", "·"];
  for (const f of ["600 20px 'JetBrains Mono'", "500 20px 'JetBrains Mono'", "700 20px 'JetBrains Mono'", "800 20px 'JetBrains Mono'",
                   "900 40px Inter", "400 30px 'Playfair Display'", "700 30px 'Playfair Display'", "italic 400 30px 'Playfair Display'"]) K.fonts.add(f);
  const ALPHA_LEVELS = 12, SIZES = [0.72, 1.0, 1.4];   /* × u */

  /* --------------------- atlas de sprites premultiplicados --------------------- */
  function buildAtlas(ctx, F) {
    const { stage, dpr, C } = ctx, u = stage.u, font = C.binary?.font || "'JetBrains Mono', monospace";
    const colors = [C.palette.ink, C.palette.accent || C.palette.ink];
    const cell = Math.ceil(SIZES[2] * u * 1.5 * dpr) + 2;
    const cols = ALPHA_LEVELS, rows = colors.length * GLYPHS.length * SIZES.length;
    const cv = document.createElement("canvas"); cv.width = cols * cell; cv.height = rows * cell;
    const g = cv.getContext("2d"); g.textAlign = "center"; g.textBaseline = "middle";
    let r = 0;
    for (let c = 0; c < colors.length; c++) for (let gl = 0; gl < GLYPHS.length; gl++) for (let s = 0; s < SIZES.length; s++, r++) {
      const px = SIZES[s] * u * dpr;
      for (let a = 0; a < ALPHA_LEVELS; a++) {
        g.globalAlpha = (a + 1) / ALPHA_LEVELS; g.fillStyle = colors[c];
        const cx = a * cell + cell / 2, cy = r * cell + cell / 2;
        if (gl === 2) { g.beginPath(); g.arc(cx, cy, Math.max(0.6, px * 0.16), 0, 7); g.fill(); }
        else { g.font = `600 ${px}px ${font}`; g.fillText(GLYPHS[gl], cx, cy); }
      }
    }
    F.atlas = cv; F.cell = cell;
    F.spriteRow = (color, glyph, size) => ((color * GLYPHS.length + glyph) * SIZES.length + size);
  }

  /* ------------------------------ polvo de fondo ------------------------------ */
  function buildDust(ctx, F) {
    const { stage } = ctx, N = F.N, r = rng(77);
    F.dx = new Float32Array(N); F.dy = new Float32Array(N); F.da = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      /* más denso cerca del centro del contenido, como en las referencias */
      const ang = r() * Math.PI * 2, rad = Math.pow(r(), 0.7) * Math.hypot(stage.W, stage.H) * 0.55;
      F.dx[i] = stage.cx + Math.cos(ang) * rad; F.dy[i] = stage.cy + Math.sin(ang) * rad;
      F.da[i] = 0.05 + r() * 0.18;
    }
  }

  K.family("binary", {
    setup(ctx) {
      const F = { N: ctx.C.binary?.particles ?? 11000, cache: new Map() };
      TEXT = ctx.C.binary?.textScale ?? 1.45;
      buildAtlas(ctx, F); buildDust(ctx, F);
      F.seed = new Float32Array(F.N); const r = rng(1234);
      for (let i = 0; i < F.N; i++) F.seed[i] = r();
      return F;
    },
    resize(ctx, F) { F.cache.clear(); buildAtlas(ctx, F); buildDust(ctx, F); },

    frame(t, ctx, F) {
      const { stage, g, C, beats } = ctx;
      /* fondo: negro con un halo muy suave en el centro del contenido */
      const bg = g.bg, grd = bg.createRadialGradient(stage.cx, stage.cy, 0, stage.cx, stage.cy, Math.max(stage.W, stage.H) * 0.7);
      grd.addColorStop(0, C.palette.bg2 || "#121212"); grd.addColorStop(1, C.palette.bg);
      bg.fillStyle = grd; bg.fillRect(0, 0, stage.W, stage.H);

      /* forma actual y anterior: beats de capa main cuyo componente declara points() */
      const isShape = b => b.layer === "main" && K.registry.get(b.use)?.points;
      const mains = beats.filter(b => b.layer === "main" && b.t0 <= t);
      const curMain = mains[mains.length - 1];
      const cur = curMain && isShape(curMain) && t < curMain.t1 + 0.01 ? curMain : null;
      /* la "anterior" es la última forma antes del beat actual (aunque haya beats sin forma en medio) */
      const refT = curMain ? curMain.t0 : t;
      const prevList = beats.filter(b => isShape(b) && b.t0 < refT);
      const prev = prevList[prevList.length - 1] || null;
      const prevVisible = prev && curMain && (curMain === prev || prev.t1 >= curMain.t0 - 0.01) ? prev : null;

      const A = cur ? pointsFor(ctx, F, cur, t) : null;
      const P = prevVisible ? pointsFor(ctx, F, prevVisible, t) : null;
      const morph = cur ? (cur.params?.morph ?? C.binary?.morph ?? 1.1) : 0.9;
      const p = curMain ? clamp((t - curMain.t0) / morph) : 1;
      const tfA = cur ? transformFor(cur, t - cur.t0) : null;
      const tfP = prevVisible ? transformFor(prevVisible, t - prevVisible.t0) : null;
      const style = cur?.params?.enter || "scatter";
      /* aparición progresiva (grillas, curvas, rayos): orden o[i] ≤ reveal(lt) */
      const rv = (b, pts) => { const def = b && K.registry.get(b.use); return def && def.reveal && pts && pts.o ? def.reveal(t - b.t0, b, pts.params) : 2; };
      /* atenuación por grupo (resaltar una parte: la opción elegida, el hito activo) */
      const ga = (b, pts) => { const def = b && K.registry.get(b.use); return def && def.groupAlpha && pts && pts.grp ? def.groupAlpha(t - b.t0, b, pts.params) : null; };
      drawField(ctx, F, t, P, tfP, A, tfA, p, style, rv(cur, A), rv(prevVisible, P), ga(cur, A), ga(prevVisible, P));
    },
  });

  function pointsFor(ctx, F, b, t) {
    const def = K.registry.get(b.use);
    if (def.dynamicPoints && b.params?.video) {
      const params = K.resolveParams(def, b.params, ctx.C);
      try {
        const pts = def.points({ ...ctx, beat: b, rng: rng(hash(b.i + b.use)) }, params, Math.max(0, t - b.t0));
        if (pts && pts.n) pts.params = params;
        return pts && pts.n ? pts : { n: 0 };
      } catch (e) { console.error("[binary] points", b.use, e); return { n: 0 }; }
    }
    const key = b.i + ":" + ctx.stage.W + "x" + ctx.stage.H;
    if (!F.cache.has(key)) {
      const def = K.registry.get(b.use), params = K.resolveParams(def, b.params, ctx.C);
      let pts = null;
      try { pts = def.points({ ...ctx, beat: b, rng: rng(hash(b.i + b.use)) }, params); } catch (e) { console.error("[binary] points", b.use, e); }
      if (pts && pts.n) pts.params = params;
      F.cache.set(key, pts && pts.n ? pts : { n: 0 });
    }
    return F.cache.get(key);
  }
  /* transformación viva de una forma (zoom lento, giro…) que define el componente */
  function transformFor(b, lt) {
    const def = K.registry.get(b.use);
    const tf = def.motion ? def.motion(lt, b) : null;
    return tf || { x: 0, y: 0, s: 1, r: 0, ox: 0, oy: 0 };
  }

  function drawField(ctx, F, t, P, tfP, A, tfA, p, style, rvA = 2, rvP = 2, gaA = null, gaP = null) {
    const { g, stage, dpr } = ctx, G = g.main, N = F.N, u = stage.u, cell = F.cell, atlas = F.atlas;
    G.setTransform(1, 0, 0, 1, 0, 0);
    const nA = A ? A.n : 0, nP = P ? P.n : 0;
    const apply = (tf, x, y) => {
      if (!tf || (tf.s === 1 && !tf.r && !tf.x && !tf.y)) return [x, y];
      const ox = tf.ox ?? stage.cx, oy = tf.oy ?? stage.cy, dx = (x - ox) * tf.s, dy = (y - oy) * tf.s;
      const c = Math.cos(tf.r || 0), s = Math.sin(tf.r || 0);
      return [ox + dx * c - dy * s + (tf.x || 0), oy + dx * s + dy * c + (tf.y || 0)];
    };
    const drift = t * 0.6;
    for (let i = 0; i < N; i++) {
      const sd = F.seed[i];
      /* origen: forma anterior o polvo; destino: forma actual o polvo */
      let fx, fy, fa, fs = 0, fg = 2, tx, ty, ta, ts = 0, tg = 2;
      const dxw = F.dx[i] + Math.sin(drift + sd * 40) * 6 * u * 0.1, dyw = F.dy[i] + Math.cos(drift * 0.8 + sd * 31) * 6 * u * 0.1;
      if (i < nP && !(P.o && P.o[i] > rvP)) { [fx, fy] = apply(tfP, P.x[i], P.y[i]); fa = P.a[i] * (gaP ? gaP[P.grp[i]] ?? 1 : 1); fs = P.s[i]; fg = P.g[i]; }
      else { fx = dxw; fy = dyw; fa = F.da[i]; }
      const shown = i < nA && !(A.o && A.o[i] > rvA);
      if (shown) { [tx, ty] = apply(tfA, A.x[i], A.y[i]); ta = A.a[i] * (gaA ? gaA[A.grp[i]] ?? 1 : 1); ts = A.s[i]; tg = A.g[i]; }
      else { tx = dxw; ty = dyw; ta = F.da[i]; }
      /* progreso individual: cada glifo arranca con un retraso propio */
      const delay = sd * 0.45, q = ease.inOut(clamp((p - delay) / 0.55));
      let x, y, a;
      if (q <= 0) { x = fx; y = fy; a = fa; }
      else if (q >= 1) { x = tx; y = ty; a = ta; }
      else {
        /* trayecto curvo: se abre hacia afuera en la mitad (dispersión) */
        const mx = (fx + tx) / 2, my = (fy + ty) / 2;
        const ang = sd * 6.283 + i, amp = (style === "converge" ? 4 : 14) * u * Math.sin(Math.PI * q) * (0.4 + sd);
        x = lerp(fx, tx, q) + Math.cos(ang) * amp; y = lerp(fy, ty, q) + Math.sin(ang) * amp;
        a = lerp(fa, ta, q) * (0.55 + 0.45 * Math.abs(Math.cos(Math.PI * q)));
        void mx; void my;
      }
      /* respiración sutil de las formas asentadas */
      if (q >= 1 && shown) { x += Math.sin(t * 1.3 + sd * 50) * 0.12 * u; y += Math.cos(t * 1.1 + sd * 37) * 0.12 * u; }
      if (a <= 0.02) continue;
      const glyph = q < 0.5 ? fg : tg, size = q < 0.5 ? fs : ts;
      const color = (q < 0.5 ? (i < nP && P.c && P.c[i]) : (i < nA && A.c && A.c[i])) ? 1 : 0;
      /* los glifos cambian de 0 a 1 de vez en cuando: el "código" está vivo */
      const gg = glyph === 2 ? 2 : (((t * 2 + sd * 97) | 0) % 9 === 0 ? 1 - glyph : glyph);
      const al = Math.min(ALPHA_LEVELS - 1, (a * ALPHA_LEVELS) | 0);
      const row = F.spriteRow(color, gg, size);
      G.drawImage(atlas, al * cell, row * cell, cell, cell, x * dpr - cell / 2, y * dpr - cell / 2, cell, cell);
    }
  }

  /* ============================ utilidades de muestreo ============================ */
  const off = document.createElement("canvas"), og = off.getContext("2d", { willReadFrequently: true });
  /** convierte una lista de puntos {x,y,a,s,g,c} en arrays tipados limitados a max */
  function pack(list, max) {
    if (list.length > max) { /* submuestreo uniforme y determinista */
      const step = list.length / max, out = []; for (let k = 0; k < max; k++) out.push(list[Math.floor(k * step)]); list = out;
    }
    const n = list.length, P = { n, x: new Float32Array(n), y: new Float32Array(n), a: new Float32Array(n), s: new Uint8Array(n), g: new Uint8Array(n), c: new Uint8Array(n) };
    list.forEach((q, i) => { P.x[i] = q.x; P.y[i] = q.y; P.a[i] = q.a ?? 1; P.s[i] = q.s ?? 1; P.g[i] = q.g ?? 0; P.c[i] = q.c ?? 0; });
    /* o (orden de aparición) y grp (grupo) viajan con cada punto: así sobreviven al submuestreo */
    if (list.some(q => q.o != null)) P.o = Float32Array.from(list, q => q.o ?? 0);
    if (list.some(q => q.grp != null)) P.grp = Uint8Array.from(list, q => q.grp ?? 0);
    return P;
  }
  /**
   * Muestrea una imagen (retrato / foto) como grilla de glifos: brillo → opacidad.
   * box {x,y,w,h} en px del escenario; cell = tamaño de celda en px.
   */
  function sampleImage(img, box, o = {}) {
    if (!img) return [];
    const ar = img.width / img.height, bw = Math.min(box.w, box.h * ar), bh = bw / ar;
    const x0 = box.x + (box.w - bw) / 2, y0 = box.y + (box.h - bh) / 2;
    const cell = o.cell, cols = Math.max(4, Math.floor(bw / (cell * 0.62))), rows = Math.max(4, Math.floor(bh / cell));
    off.width = cols; off.height = rows; og.clearRect(0, 0, cols, rows);
    og.filter = `grayscale(1) contrast(${o.contrast ?? 1.25}) brightness(${o.brightness ?? 1.05})`;
    og.drawImage(img, 0, 0, cols, rows); og.filter = "none";
    const d = og.getImageData(0, 0, cols, rows).data, out = [], r = rng(o.seed ?? 9);
    const lum = new Float32Array(cols * rows);
    for (let i = 0; i < cols * rows; i++) lum[i] = (0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]) / 255 * (d[i * 4 + 3] / 255);
    /* niveles automáticos: estirar entre los percentiles 2 y 98 (fotos viejas grises/oscuras) */
    let lo = 0, hi = 1;
    if (o.autoLevels !== false) { const srt = Float32Array.from(lum).sort(); lo = srt[Math.floor(srt.length * 0.02)]; hi = Math.max(lo + 0.05, srt[Math.floor(srt.length * 0.98)]); }
    /* fondo de estudio liso (gris): si el borde de la foto es parejo, ese gris pasa a ser el negro
       → el sujeto emerge de la oscuridad como en las referencias, en vez de un rectángulo gris */
    if (o.keyBackground !== false) {
      const bd = [], m = Math.max(1, Math.round(Math.min(cols, rows) * 0.06));
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (x < m || y < m || x >= cols - m) bd.push(lum[y * cols + x]);
      bd.sort((a, b) => a - b);
      const med = bd[bd.length >> 1], iqr = bd[Math.floor(bd.length * 0.75)] - bd[Math.floor(bd.length * 0.25)];
      if (iqr < 0.12 && med > lo + 0.08) lo = Math.min(hi - 0.1, med + 0.05);
    }
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      let L = clamp((lum[y * cols + x] - lo) / (hi - lo));
      if (o.invert) L = 1 - L;
      /* viñeta circular suave: el retrato se funde en el negro */
      if (o.vignette !== false) { const vx = x / cols - 0.5, vy = y / rows - 0.5; L *= clamp(1.25 - Math.hypot(vx * 1.1, vy) * 1.9); }
      if (L < (o.threshold ?? 0.08)) continue;
      /* luces = dígitos más grandes y opacos; medios tonos apagados (gamma): así el rostro se
         separa del fondo gris aunque todas las celdas tengan un dígito */
      out.push({ x: x0 + (x + 0.5) * bw / cols, y: y0 + (y + 0.5) * bh / rows, a: Math.pow(L, o.gamma ?? 1.15), s: L > 0.8 ? 2 : L > 0.5 ? 1 : 0, g: r() < 0.5 ? 0 : 1 });
    }
    return out;
  }
  /**
   * Retrato en glifos con el tratamiento estándar de las miniaturas (binary.introv2 y cualquier
   * componente nuevo que muestre una persona). La foto se amplía sobre su foco para que el rostro
   * llene la caja, se muestrea con contraste alto y SIN la viñeta de sampleImage (que apaga el rostro
   * entero) y se funde en el negro con un óvalo que solo toca el borde. Si el campo no alcanza
   * (o.max = partículas libres), se quedan las celdas más luminosas: el rostro conserva el detalle.
   *   o: zoom (1 = entera), focusX/focusY (0–1), cell, contrast, gamma, threshold, max
   */
  const portraitCrops = new Map();
  function portraitCrop(img, zoom, fx, fy) {
    if (zoom <= 1) return img;
    const key = `${img.src || img.width + "x" + img.height}|${zoom}|${fx}|${fy}`;
    if (img.tagName === "VIDEO") {
      const w = img.width / zoom, h = img.height / zoom;
      const x = clamp(img.width * fx - w / 2, 0, img.width - w), y = clamp(img.height * fy - h / 2, 0, img.height - h);
      const cv = document.createElement("canvas"); cv.width = Math.round(w); cv.height = Math.round(h);
      cv.getContext("2d").drawImage(img, x, y, w, h, 0, 0, cv.width, cv.height);
      return cv;
    }
    if (!portraitCrops.has(key)) {
      const w = img.width / zoom, h = img.height / zoom;
      const x = clamp(img.width * fx - w / 2, 0, img.width - w), y = clamp(img.height * fy - h / 2, 0, img.height - h);
      const cv = document.createElement("canvas"); cv.width = Math.round(w); cv.height = Math.round(h);
      cv.getContext("2d").drawImage(img, x, y, w, h, 0, 0, cv.width, cv.height);
      portraitCrops.set(key, cv);
    }
    return portraitCrops.get(key);
  }
  function samplePortrait(img, box, o = {}) {
    if (!img) return [];
    const src = portraitCrop(img, o.zoom ?? 1.2, o.focusX ?? 0.5, o.focusY ?? 0.5);
    /* rectángulo real de la foto en la caja (encajada sin recortar, como la dibuja sampleImage) */
    const ar = src.width / src.height, fw = Math.min(box.w, box.h * ar), fh = fw / ar;
    const cx = box.x + box.w / 2, cy = box.y + box.h / 2, inner = 0.62;
    const pts = [];
    for (const q of sampleImage(src, box, {
      cell: o.cell, contrast: o.contrast ?? 1.9, brightness: 1.1, gamma: o.gamma ?? 1,
      threshold: o.threshold ?? 0.14, keyBackground: true, autoLevels: true, vignette: false, seed: o.seed,
    })) {
      const r = Math.hypot((q.x - cx) / (fw / 2), (q.y - cy) / (fh / 2)), k = clamp((1 - r) / (1 - inner));
      const a = q.a * k * k * (3 - 2 * k);
      if (a > 0.04) pts.push({ ...q, a });
    }
    if (o.max == null || pts.length <= o.max) return pts;
    return pts.sort((p1, p2) => p2.a - p1.a).slice(0, Math.max(0, o.max));
  }
  /** rasteriza una forma (callback de dibujo en canvas) y la llena de glifos */
  function sampleShape(draw, box, o = {}) {
    const res = o.res ?? 220, sc = res / Math.max(box.w, box.h);
    off.width = Math.ceil(box.w * sc); off.height = Math.ceil(box.h * sc);
    og.setTransform(1, 0, 0, 1, 0, 0); og.clearRect(0, 0, off.width, off.height);
    og.fillStyle = "#fff"; og.strokeStyle = "#fff"; og.setTransform(sc, 0, 0, sc, 0, 0);
    draw(og, box.w, box.h); og.setTransform(1, 0, 0, 1, 0, 0);
    const d = og.getImageData(0, 0, off.width, off.height).data, out = [], r = rng(o.seed ?? 3);
    const step = o.cell * sc;
    for (let y = step / 2; y < off.height; y += step) for (let x = step * 0.31; x < off.width; x += step * 0.62) {
      const jx = x + (r() - 0.5) * step * (o.jitter ?? 0.5), jy = y + (r() - 0.5) * step * (o.jitter ?? 0.5);
      /* fuera del canvas → d[k] es undefined → NaN pasaría el filtro: descartar antes */
      if (jx < 0 || jy < 0 || jx >= off.width || jy >= off.height) continue;
      const k = ((jy | 0) * off.width + (jx | 0)) * 4, A = d[k + 3] / 255;
      if (!(A >= 0.4)) continue;
      const edge = o.edge ? edgeness(d, off.width, off.height, jx | 0, jy | 0) : 0;
      out.push({ x: box.x + jx / sc, y: box.y + jy / sc, a: clamp((o.alpha ?? 0.85) * (0.55 + 0.45 * r()) + edge * 0.5), s: edge > 0.3 ? 1 : 0, g: r() < 0.5 ? 0 : 1 });
    }
    return out;
  }
  function edgeness(d, w, h, x, y) {
    let n = 0; for (const [dx, dy] of [[-3, 0], [3, 0], [0, -3], [0, 3]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h || d[(yy * w + xx) * 4 + 3] < 100) n++; }
    return n / 4;
  }
  /** texto (palabra, número) como forma de glifos */
  /**
   * o.fit = "block" (todos los renglones al mismo tamaño) | "lines" (cada renglón ocupa
   * todo el ancho, estilo cartel: los cortos quedan más grandes).  o.lead = interlineado.
   */
  function textLayout(g, text, w, h, font, fit = "block", lead = 1.08) {
    const lines = String(text).split("\n");
    g.font = font.replace(/\d+px/, "100px");
    const widths = lines.map(l => Math.max(1, g.measureText(l).width));
    let sizes = fit === "lines" ? widths.map(wd => 100 * w / wd) : lines.map(() => 100 * w / Math.max(...widths));
    const tot = sizes.reduce((a, b) => a + b * lead, 0);
    if (tot > h) sizes = sizes.map(fs => fs * h / tot);
    const H = sizes.reduce((a, b) => a + b * lead, 0);
    let y = (h - H) / 2;
    return lines.map((l, i) => { const fs = sizes[i], cy = y + fs * lead / 2; y += fs * lead; return { l, fs, cy }; });
  }
  function sampleText(text, box, o = {}) {
    const font = o.font || "900 100px 'Inter', sans-serif";
    return sampleShape((g, w, h) => {
      g.textAlign = "center"; g.textBaseline = "middle";
      for (const L of textLayout(g, text, w, h, font, o.fit, o.lead)) { g.font = font.replace(/\d+px/, L.fs + "px"); g.fillText(L.l, w / 2, L.cy + L.fs * 0.06); }
    }, box, { ...o, res: o.res ?? 320 });
  }
  /** dibuja texto directamente como grilla de glifos (contadores que cambian cada cuadro) */
  const gtCache = new Map();
  function glyphText(G, text, cx, cy, h, o, ctx) {
    const key = text + "|" + Math.round(h) + "|" + (o.font || "");
    let pts = gtCache.get(key);
    if (!pts) {
      const w = h * Math.max(1, String(text).length) * 0.62;
      pts = sampleText(text, { x: -w / 2, y: -h / 2, w, h }, { cell: o.cell, font: o.font, jitter: 0.15, alpha: 0.95, edge: true });
      if (gtCache.size > 400) gtCache.clear();
      gtCache.set(key, pts);
    }
    drawPts(G, pts, cx, cy, o, ctx);
  }
  /** estampa una lista de puntos ya muestreados (relativos a 0,0) en cx,cy: objetos que se
      mueven por su cuenta (barcos, marcadores) sin pasar por el campo principal */
  function drawPts(G, pts, cx, cy, o, ctx) {
    const F = ctx.family.binary, dpr = ctx.dpr, cell = F.cell, k = o.scale ?? 1;
    G.save(); G.setTransform(1, 0, 0, 1, 0, 0);
    for (const q of pts) {
      const al = Math.min(ALPHA_LEVELS - 1, Math.ceil(q.a * (o.alpha ?? 1) * ALPHA_LEVELS) - 1);
      if (al < 0) continue;
      G.drawImage(F.atlas, al * cell, F.spriteRow(o.color ?? q.c ?? 0, q.g, q.s) * cell, cell, cell, (cx + q.x * k) * dpr - cell / 2, (cy + q.y * k) * dpr - cell / 2, cell, cell);
    }
    G.restore();
  }

  /* ---------------------------- piezas de interfaz ---------------------------- */
  /** etiqueta "tag": caja blanca con texto negro mono en mayúsculas (como OBSERVANDO) */
  let TEXT = 1.45;            /* escala global de rótulos: config.binary.textScale */
  function tag(G, text, x, y, o = {}) {
    const u = o.u, fs = (o.size ?? 1.5) * u * TEXT;
    G.save(); G.font = `600 ${fs}px ${o.font || "'JetBrains Mono', monospace"}`;
    const w = G.measureText(text).width + fs * 1.2, h = fs * 1.7;
    const bx = o.align === "left" ? x : o.align === "right" ? x - w : x - w / 2;
    G.globalAlpha = o.alpha ?? 1;
    if (o.boxed !== false) { G.fillStyle = o.bg || "#f2f2f2"; G.fillRect(bx, y - h / 2, w, h); G.fillStyle = o.color || "#000"; }
    else G.fillStyle = o.color || "#f2f2f2";
    G.textBaseline = "middle"; G.fillText(text, bx + fs * 0.6, y + fs * 0.05);
    G.restore();
    return { w, h };
  }
  /** texto chico mono en mayúsculas (rótulos de diagramas) */
  function mono(G, text, x, y, o = {}) {
    G.save(); G.font = `${o.weight || 500} ${(o.size ?? 1.3) * o.u * TEXT}px ${o.font || "'JetBrains Mono', monospace"}`;
    G.fillStyle = o.color || "#cfcfcf"; G.globalAlpha = o.alpha ?? 1; G.textAlign = o.align || "center"; G.textBaseline = "middle";
    if (o.spacing) G.letterSpacing = o.spacing + "px";
    G.fillText(text, x, y); G.restore();
  }
  /** anillo punteado (órbitas, relojes) */
  function ring(G, cx, cy, r, o = {}) {
    G.save(); G.strokeStyle = o.color || "rgba(230,230,230,.5)"; G.lineWidth = o.width ?? 1; G.globalAlpha = o.alpha ?? 1;
    if (o.dash) G.setLineDash(o.dash);
    G.beginPath(); G.arc(cx, cy, r, o.a0 ?? 0, o.a1 ?? Math.PI * 2); G.stroke(); G.restore();
  }

  K.binary = { pack, sampleImage, samplePortrait, sampleShape, sampleText, textLayout, glyphText, drawPts, tag, mono, ring, ALPHA_LEVELS, SIZES, get textScale() { return TEXT; } };
})();
