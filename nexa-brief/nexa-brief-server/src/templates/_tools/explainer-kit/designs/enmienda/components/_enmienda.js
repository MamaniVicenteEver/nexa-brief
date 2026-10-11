/* =============================================================================
   enmienda · runtime de la familia "documental de archivo" (blanco y negro)
   -----------------------------------------------------------------------------
   Réplica del lenguaje visual de una secuencia de títulos documental: fondo
   negro con grano/polvo/viñeta, tipografía condensada MUY gruesa con textura de
   tipo móvil gastado, papel arrugado, cinta negra, mapas de tinta, fotos de
   archivo en B/N con lower-third, barras de celda y erosión de texto.
   Reglas: todo se dibuja en canvas como función pura de t / lt (render cuadro a
   cuadro con seek). Texturas procedurales generadas UNA vez con rng sembrado y
   cacheadas en canvas fuera de pantalla. Utilidades en Kit.enm (E.*).
   ========================================================================== */
(function () {
  const K = window.Kit, { clamp, lerp, prog, ease } = K;
  const FPS = 24;                                   /* la referencia corre a 23.976 */
  const F = {
    grot: "Oswald", heavy: "Anton", cond: "'Barlow Condensed'", stencil: "'Stardos Stencil'",
    wide: "Archivo", serif: "'Playfair Display'", doc: "'Old Standard TT'", hand: "'Architects Daughter'", sign: "'Herr Von Muellerhoff'",
  };
  for (const f of ["700 40px Oswald", "600 40px Oswald", "400 40px Anton", "700 40px 'Barlow Condensed'", "600 40px 'Barlow Condensed'", "500 40px 'Barlow Condensed'",
    "700 40px 'Stardos Stencil'", "800 expanded 40px Archivo", "700 expanded 40px Archivo", "900 40px 'Playfair Display'", "700 40px 'Playfair Display'",
    "400 40px 'Old Standard TT'", "700 40px 'Old Standard TT'", "400 40px 'Architects Daughter'", "400 40px 'Herr Von Muellerhoff'"]) K.fonts.add(f);

  /** fuente de canvas por clave de familia */
  function font(kind, px, weight) {
    const w = weight || ({ grot: 700, heavy: 400, cond: 700, stencil: 700, wide: 800, serif: 900, doc: 400, hand: 400, sign: 400 }[kind] ?? 700);
    return `${w} ${kind === "wide" ? "expanded " : ""}${Math.max(1, px).toFixed(1)}px ${F[kind] || kind}`;
  }

  /* ------------------------------------------------------------ canvases */
  function mk(w, h, dpr = 1) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.ceil(w * dpr)); c.height = Math.max(1, Math.ceil(h * dpr));
    const g = c.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { c, g, w, h, dpr };
  }
  const cache = new Map();
  const memo = (key, fn) => { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); };

  /* ------------------------------------------------------------ texturas */
  /** ruido de valor 2D suave (determinista) en una grilla gw×gh */
  function valueNoise(gw, gh, seed, cell, aniso = 1, angle = 0) {
    const r = K.rng(seed), lw = Math.ceil(gw / cell) + 3, lh = Math.ceil(gh / cell * aniso) + 3, L = new Float32Array(lw * lh);
    for (let i = 0; i < L.length; i++) L[i] = r();
    const out = new Float32Array(gw * gh), ca = Math.cos(angle), sa = Math.sin(angle);
    const sm = x => x * x * (3 - 2 * x);
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
      /* coordenadas rotadas y estiradas (anisotropía = vetas/rayones) */
      const cx = x - gw / 2, cy = y - gh / 2;
      let u = (cx * ca + cy * sa) / cell + lw / 2 - 1, v = ((-cx * sa + cy * ca) / cell) * aniso + lh / 2 - 1;
      u = clamp(u, 0, lw - 2.001); v = clamp(v, 0, lh - 2.001);
      const ix = u | 0, iy = v | 0, fx = sm(u - ix), fy = sm(v - iy);
      const a = L[iy * lw + ix], b = L[iy * lw + ix + 1], c = L[(iy + 1) * lw + ix], d = L[(iy + 1) * lw + ix + 1];
      out[y * gw + x] = lerp(lerp(a, b, fx), lerp(c, d, fx), fy);
    }
    return out;
  }

  /** textura de "tipo móvil gastado": manchas oscuras, vetas verticales y poros (alfa) */
  function grunge(seed = 7, size = 512) {
    return memo("grunge" + seed + ":" + size, () => {
      const T = mk(size, size), g = T.g, r = K.rng(seed);
      const n1 = valueNoise(size, size, seed, 26), n2 = valueNoise(size, size, seed + 1, 7), n3 = valueNoise(size, size, seed + 2, 5, 9, Math.PI / 2);
      const im = g.createImageData(size, size), d = im.data;
      for (let i = 0; i < size * size; i++) {
        let a = Math.pow(clamp((n1[i] - 0.42) * 1.9), 1.6) * 0.75 + Math.pow(n2[i], 3) * 0.32 + Math.pow(n3[i], 5) * 0.4;
        if (r() < 0.012) a = Math.max(a, 0.55 + r() * 0.4);              /* poros */
        d[i * 4 + 3] = clamp(a) * 255;
      }
      g.putImageData(im, 0, 0);
      return T.c;
    });
  }
  /** papel arrugado gris (fondo de las escenas de cartulina) */
  function paper(seed = 3, w = 1024, h = 640, tone = 196) {
    return memo(`paper${seed}:${w}:${h}:${tone}`, () => {
      const T = mk(w, h), g = T.g;
      const n1 = valueNoise(w, h, seed, 140), n2 = valueNoise(w, h, seed + 5, 34), n3 = valueNoise(w, h, seed + 9, 9);
      const im = g.createImageData(w, h), d = im.data;
      for (let i = 0; i < w * h; i++) {
        /* pliegues: derivada del ruido grueso = luz rasante */
        const v = tone + (n1[i] - 0.5) * 26 + (n2[i] - 0.5) * 20 + (n3[i] - 0.5) * 7;
        d[i * 4] = v; d[i * 4 + 1] = v; d[i * 4 + 2] = v - 2; d[i * 4 + 3] = 255;
      }
      g.putImageData(im, 0, 0);
      /* arrugas: trazos finos claros/oscuros */
      const r = K.rng(seed + 77);
      for (let k = 0; k < 60; k++) {
        let x = r() * w, y = r() * h, a = r() * Math.PI * 2;
        g.beginPath(); g.moveTo(x, y);
        for (let s = 0; s < 6; s++) { a += (r() - 0.5) * 1.1; x += Math.cos(a) * 30; y += Math.sin(a) * 30; g.lineTo(x, y); }
        g.strokeStyle = r() < 0.5 ? "rgba(255,255,255,.10)" : "rgba(0,0,0,.08)"; g.lineWidth = 1 + r() * 1.5; g.stroke();
      }
      return T.c;
    });
  }
  /** textura de cartulina blanca / cinta: devuelve canvas pequeño */
  function fibers(seed = 11, size = 256, dark = false) {
    return memo(`fib${seed}:${size}:${dark}`, () => {
      const T = mk(size, size), g = T.g, n = valueNoise(size, size, seed, 6), m = valueNoise(size, size, seed + 3, 30);
      const im = g.createImageData(size, size), d = im.data;
      for (let i = 0; i < size * size; i++) {
        const v = dark ? 14 + n[i] * 22 + m[i] * 10 : 222 + (n[i] - 0.5) * 18 + (m[i] - 0.5) * 16;
        d[i * 4] = v; d[i * 4 + 1] = v; d[i * 4 + 2] = v - (dark ? 0 : 3); d[i * 4 + 3] = 255;
      }
      g.putImageData(im, 0, 0);
      return T.c;
    });
  }
  /** pinta un patrón (textura) dentro de la región actual */
  function pattern(G, tex, x, y, w, h, scale = 1) {
    const p = G.createPattern(tex, "repeat");
    if (p.setTransform) p.setTransform(new DOMMatrix([scale, 0, 0, scale, x, y]));
    G.fillStyle = p; G.fillRect(x, y, w, h);
  }

  /* ------------------------------------------------------------ texto con tinta */
  /**
   * Texto en canvas con textura de impresión (claro sobre negro o tinta negra sobre papel).
   * o = { kind, px, weight, color, ink:"light"|"dark", spacing(em), wear(0..1), seed, stroke }
   * Devuelve { c, w, h, base } en px CSS (el canvas está a dpr).
   */
  function inkText(str, o, dpr = 2) {
    const key = JSON.stringify([str, o, dpr]);
    return memo(key, () => {
      const px = o.px, fnt = font(o.kind || "grot", px, o.weight);
      const M = mk(4, 4).g; M.font = fnt; if (o.spacing) M.letterSpacing = (o.spacing * px).toFixed(1) + "px";
      const m = M.measureText(str), w = Math.ceil(m.width + px * 0.3), asc = m.actualBoundingBoxAscent || px * 0.75, desc = m.actualBoundingBoxDescent || px * 0.2;
      const pad = px * 0.12, h = Math.ceil(asc + desc + pad * 2);
      const T = mk(w, h, dpr), g = T.g;
      g.font = fnt; if (o.spacing) g.letterSpacing = (o.spacing * px).toFixed(1) + "px";
      g.textBaseline = "alphabetic"; g.fillStyle = o.color || "#d6d0c5";
      g.fillText(str, px * 0.15, pad + asc);
      const wear = o.wear ?? 0.8;
      if (wear > 0) {
        const gr = grunge(o.seed ?? 7), sc = Math.max(0.35, px / 260);
        g.save(); g.globalCompositeOperation = "source-atop";
        g.globalAlpha = (o.ink === "dark" ? 0.55 : 0.85) * wear;
        const pat = g.createPattern(gr, "repeat"); pat.setTransform(new DOMMatrix([sc, 0, 0, sc, (o.seed ?? 7) * 37 % 300, 0]));
        g.fillStyle = o.ink === "dark" ? pat : pat;
        if (o.ink === "dark") { g.globalCompositeOperation = "destination-out"; g.globalAlpha = 0.7 * wear; }
        else g.filter = "none";
        g.fillRect(0, 0, w, h);
        if (o.ink !== "dark") {                    /* vetas claras (rodillo) */
          g.globalCompositeOperation = "source-atop"; g.globalAlpha = 0.18 * wear; g.fillStyle = "#fff";
          const r = K.rng((o.seed ?? 7) + 9);
          for (let k = 0; k < w / (px * 0.08); k++) g.fillRect(r() * w, 0, px * (0.01 + r() * 0.03), h);
        } else {                                   /* tinta seca: bordes con huecos horizontales */
          g.globalCompositeOperation = "destination-out"; g.globalAlpha = 0.35 * wear; const r = K.rng((o.seed ?? 7) + 13);
          for (let k = 0; k < h / (px * 0.03); k++) g.fillRect(0, r() * h, w, px * (0.005 + r() * 0.012));
        }
        g.restore();
      }
      return { c: T.c, w, h, asc, base: pad + asc };
    });
  }
  /** mide el ancho de un texto con la fuente de la familia */
  const _mg = mk(4, 4).g;
  function measure(str, kind, px, weight, spacing = 0) { _mg.font = font(kind, px, weight); _mg.letterSpacing = spacing ? (spacing * px) + "px" : "0px"; return _mg.measureText(str).width; }
  /** tamaño de fuente para que el texto ocupe `w` px (con tope) */
  function fit(str, kind, w, max, weight, spacing = 0) { const m = measure(str, kind, 100, weight, spacing) || 1; return Math.min(max, 100 * w / m); }

  /* ------------------------------------------------------------ erosión */
  /**
   * Máscara de disolución "grunge" (baja resolución → bordes manchados al escalar).
   * at(p) devuelve un canvas cuyo alfa = zonas visibles para progreso p (0 nada → 1 todo).
   * o.streak: vetas horizontales (la erosión "por líneas de barrido" de la referencia).
   */
  function dissolver(seed, gw = 160, gh = 90, o = {}) {
    const n = valueNoise(gw, gh, seed, o.cell ?? 6, o.aniso ?? 1, o.angle ?? 0), f = valueNoise(gw, gh, seed + 1, 1.6);
    const r = K.rng(seed + 2), rows = new Float32Array(gh);
    for (let y = 0; y < gh; y++) rows[y] = r();
    const v = new Float32Array(gw * gh);
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
      const i = y * gw + x;
      v[i] = n[i] * 0.62 + f[i] * 0.23 + (o.streak ? rows[y] * 0.35 : 0.15 * r());
      if (o.dir) v[i] = v[i] * 0.45 + (o.dir === "x" ? x / gw : y / gh) * 0.55;
    }
    /* normalizar 0..1 */
    let lo = 1e9, hi = -1e9; for (const a of v) { lo = Math.min(lo, a); hi = Math.max(hi, a); }
    for (let i = 0; i < v.length; i++) v[i] = (v[i] - lo) / (hi - lo || 1);
    const T = mk(gw, gh), im = T.g.createImageData(gw, gh), soft = o.soft ?? 0.08;
    let last = -1;
    return {
      at(p) {
        p = clamp(p);
        if (p !== last) {
          const d = im.data, th = p * (1 + soft) - soft;
          for (let i = 0; i < v.length; i++) { d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = 255; d[i * 4 + 3] = clamp((th - v[i]) / soft + 1) * 255; }
          T.g.putImageData(im, 0, 0); last = p;
        }
        return T.c;
      },
    };
  }
  /** dibuja `src` (canvas) en (x,y,w,h) a través de la máscara (canvas de alfa) */
  const tmp = { c: null };
  function masked(G, src, mask, x, y, w, h, alpha = 1, sx, sy, sw, sh) {
    const dpr = 2, cw = Math.ceil(w * dpr), ch = Math.ceil(h * dpr);
    if (!tmp.c || tmp.c.width < cw || tmp.c.height < ch) { tmp.c = document.createElement("canvas"); tmp.c.width = Math.max(cw, tmp.c?.width || 0); tmp.c.height = Math.max(ch, tmp.c?.height || 0); tmp.g = tmp.c.getContext("2d"); }
    const g = tmp.g; g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "source-over"; g.clearRect(0, 0, cw, ch);
    if (sw) g.drawImage(src, sx, sy, sw, sh, 0, 0, cw, ch); else g.drawImage(src, 0, 0, cw, ch);
    g.globalCompositeOperation = "destination-in"; g.imageSmoothingEnabled = true; g.drawImage(mask, 0, 0, cw, ch);
    g.globalCompositeOperation = "source-over";
    G.save(); G.globalAlpha *= alpha; G.drawImage(tmp.c, 0, 0, cw, ch, x, y, w, h); G.restore();
  }

  /* ------------------------------------------------------------ fotos */
  /** foto en B/N con contraste de archivo (cacheada); tone: bw | warm | hot (sobreexpuesta) */
  function photo(img, tone = "bw") {
    if (!img) return null;
    return memo("ph:" + img.src + ":" + tone, () => {
      const T = mk(img.width, img.height), g = T.g;
      g.filter = tone === "hot" ? "grayscale(1) brightness(2.6) contrast(1.6) blur(2px)" : tone === "soft" ? "grayscale(1) contrast(1.05) brightness(0.95)" : "grayscale(1) contrast(1.32) brightness(0.92)";
      g.drawImage(img, 0, 0);
      g.filter = "none";
      if (tone === "warm") { g.globalCompositeOperation = "multiply"; g.fillStyle = "#efe6d6"; g.fillRect(0, 0, img.width, img.height); }
      return T.c;
    });
  }
  /** encuadre "cover" con foco [fx,fy] (0..1) y zoom (≥1) */
  function cover(G, src, x, y, w, h, focus = [0.5, 0.5], zoom = 1) {
    const iw = src.width, ih = src.height, ar = w / h;
    let sw = iw, sh = iw / ar; if (sh > ih) { sh = ih; sw = ih * ar; }
    sw /= zoom; sh /= zoom;
    const sx = clamp(focus[0] * iw - sw / 2, 0, iw - sw), sy = clamp(focus[1] * ih - sh / 2, 0, ih - sh);
    G.drawImage(src, sx, sy, sw, sh, x, y, w, h);
  }

  /* ------------------------------------------------------------ piezas */
  /** cinta negra con bordes rasgados (x,y = centro) */
  function tape(G, cx, cy, w, h, rot, seed) {
    const r = K.rng(seed), pts = [], n = 7;
    for (let i = 0; i <= n; i++) pts.push([-w / 2 + (r() - 0.5) * h * 0.25, -h / 2 + (i / n) * h]);
    const right = []; for (let i = 0; i <= n; i++) right.push([w / 2 + (r() - 0.5) * h * 0.3, h / 2 - (i / n) * h]);
    G.save(); G.translate(cx, cy); G.rotate(rot);
    G.beginPath(); G.moveTo(-w / 2, -h / 2);
    for (let x = -w / 2; x <= w / 2; x += w / 12) G.lineTo(x, -h / 2 + (r() - 0.5) * h * 0.04);
    for (const p of right) G.lineTo(p[0], p[1]);
    for (let x = w / 2; x >= -w / 2; x -= w / 12) G.lineTo(x, h / 2 + (r() - 0.5) * h * 0.04);
    for (const p of pts.reverse()) G.lineTo(p[0], p[1]);
    G.closePath();
    G.shadowColor = "rgba(0,0,0,.35)"; G.shadowBlur = h * 0.12; G.shadowOffsetY = h * 0.04;
    const tx = fibers(31, 256, true), pat = G.createPattern(tx, "repeat"); G.fillStyle = pat; G.fill();
    G.shadowColor = "transparent"; G.globalAlpha = 0.25; G.strokeStyle = "#000"; G.lineWidth = 1; G.stroke();
    G.restore();
  }
  /** cartulina blanca con sombra suave (x,y = centro) */
  function card(G, cx, cy, w, h, rot, tone = 1) {
    G.save(); G.translate(cx, cy); G.rotate(rot);
    G.shadowColor = "rgba(0,0,0,.28)"; G.shadowBlur = Math.min(w, h) * 0.05; G.shadowOffsetY = Math.min(w, h) * 0.02;
    G.fillStyle = "#e4e3df"; G.fillRect(-w / 2, -h / 2, w, h);
    G.shadowColor = "transparent";
    G.globalAlpha = 0.55 * tone; pattern(G, fibers(12), -w / 2, -h / 2, w, h, 1);
    G.restore();
  }
  /** viñeta (oscurece bordes) */
  function vignette(G, W, H, a = 0.6, inner = 0.35, cx = W / 2, cy = H / 2) {
    const R = Math.hypot(W, H) / 2, vg = G.createRadialGradient(cx, cy, R * inner, cx, cy, R * 1.05);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, `rgba(0,0,0,${a})`);
    G.fillStyle = vg; G.fillRect(0, 0, W, H);
  }
  /** foco de luz (ilumina una elipse sobre el fondo oscuro) */
  function spot(G, cx, cy, rx, ry, a = 1, color = "255,255,255") {
    G.save(); G.translate(cx, cy); G.scale(1, ry / rx);
    const gr = G.createRadialGradient(0, 0, 0, 0, 0, rx); gr.addColorStop(0, `rgba(${color},${a})`); gr.addColorStop(0.55, `rgba(${color},${a * 0.55})`); gr.addColorStop(1, `rgba(${color},0)`);
    G.fillStyle = gr; G.fillRect(-rx, -rx, rx * 2, rx * 2); G.restore();
  }
  /**
   * Trazo de pincel seco (marcador / pintura) a lo largo de una polilínea, dibujado hasta q (0..1).
   * pts en px; o = { width, color, alpha, seed, hairs }
   */
  function brush(G, pts, q, o = {}) {
    if (q <= 0 || pts.length < 2) return;
    const r = K.rng(o.seed ?? 5), hairs = o.hairs ?? 9, w = o.width ?? 10;
    let L = 0; const seg = []; for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(l); L += l; }
    const lim = L * q;
    G.save(); G.lineCap = "round"; G.lineJoin = "round"; G.strokeStyle = o.color || "#d8d2c6";
    for (let hh = 0; hh < hairs; hh++) {
      const off = (hh / (hairs - 1) - 0.5) * w, a = (o.alpha ?? 0.9) * (0.35 + r() * 0.65), gap = r();
      G.globalAlpha = a; G.lineWidth = w / hairs * (1.2 + r() * 1.6);
      G.beginPath(); let acc = 0, started = false;
      for (let i = 1; i < pts.length && acc < lim; i++) {
        const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], l = seg[i - 1], nx = -(y1 - y0) / (l || 1), ny = (x1 - x0) / (l || 1);
        const t1 = Math.min(1, (lim - acc) / (l || 1));
        if (!started) { G.moveTo(x0 + nx * off, y0 + ny * off); started = true; }
        /* pelos que se cortan (pincel seco) */
        if (gap > 0.75 && i % 3 === 0) { G.moveTo(x0 + (x1 - x0) * t1 + nx * off, y0 + (y1 - y0) * t1 + ny * off); }
        else G.lineTo(x0 + (x1 - x0) * t1 + nx * off, y0 + (y1 - y0) * t1 + ny * off);
        acc += l;
      }
      G.stroke();
    }
    G.restore();
  }
  /** polilíneas de garabato: x (cruz), circle, underline, scribble, check */
  function scribble(kind, cx, cy, w, h, seed) {
    const r = K.rng(seed), out = [], jit = () => (r() - 0.5) * Math.min(w, h) * 0.05;
    if (kind === "x") {
      out.push([[cx - w / 2, cy - h / 2], [cx, cy + jit()], [cx + w / 2 + jit(), cy + h / 2]]);
      out.push([[cx + w / 2, cy - h / 2 + jit()], [cx + jit(), cy], [cx - w / 2, cy + h / 2]]);
    } else if (kind === "circle") {
      const p = []; for (let k = 0; k <= 34; k++) { const a = -2.2 + k / 34 * Math.PI * 2.15; p.push([cx + Math.cos(a) * w / 2 * (1 + jit() * 0.004), cy + Math.sin(a) * h / 2 * (1 + jit() * 0.004)]); } out.push(p);
    } else if (kind === "underline") {
      out.push([[cx - w / 2, cy + jit()], [cx, cy + jit()], [cx + w / 2, cy + jit()]]);
    } else if (kind === "scribble") {
      const p = []; for (let k = 0; k <= 14; k++) p.push([cx - w / 2 + (k / 14) * w + jit(), cy + (k % 2 ? -h / 2 : h / 2) * (0.6 + r() * 0.4)]); out.push(p);
    }
    return out;
  }
  /** mira telescópica (PUBLIC ENEMY): círculos y cruz que se dibujan girando */
  function crosshair(G, cx, cy, R, q, lw, color = "#cfc9be") {
    if (q <= 0) return;
    const a = (1 - ease.out(q)) * -0.9, s = 1 + (1 - ease.out(q)) * 0.35;
    G.save(); G.translate(cx, cy); G.rotate(a); G.scale(s, s); G.strokeStyle = color; G.lineWidth = lw; G.globalAlpha = 0.9;
    const d = clamp(q * 1.6);
    G.beginPath(); G.arc(0, 0, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * d); G.stroke();
    G.beginPath(); G.arc(0, 0, R * 0.36, 0, Math.PI * 2 * clamp(q * 2 - 0.4)); G.stroke();
    const e = clamp(q * 1.8 - 0.3) * R * 1.15;
    G.beginPath(); G.moveTo(0, -e); G.lineTo(0, e); G.moveTo(-e, 0); G.lineTo(e, 0); G.stroke();
    G.restore();
  }

  /* ------------------------------------------------------------ movimiento */
  /** stop-motion: cuantiza el tiempo a `fps` cuadros por segundo */
  const stop = (t, fps = 12) => Math.floor(t * fps) / fps;
  /** desplazamiento de "hervor" determinista por cuadro (animación cuadro a cuadro) */
  function boil(seed, t, amp, fps = 8) { const r = K.rng(seed * 997 + Math.floor(t * fps)); return [(r() - 0.5) * amp, (r() - 0.5) * amp, (r() - 0.5) * amp * 0.01]; }
  /** cámara: empuje lento + deriva; aplica la transformación alrededor del centro */
  function camera(G, st, lt, o = {}) {
    const s = (o.zoom ?? 1) * (1 + (o.push ?? 0.012) * lt), dx = Math.sin(lt * 0.35 + (o.seed ?? 0)) * st.u * (o.drift ?? 0.4), dy = Math.cos(lt * 0.27 + (o.seed ?? 0)) * st.u * (o.drift ?? 0.4) * 0.6;
    const cx = o.cx ?? st.W / 2, cy = o.cy ?? st.H / 2;
    G.translate(cx + dx + (o.x ?? 0), cy + dy + (o.y ?? 0)); G.rotate(o.rot ?? 0); G.scale(s, s); G.translate(-cx, -cy);
  }
  /** desenfoque de movimiento horizontal: dibuja `draw(offset)` N veces */
  function smear(G, amount, n, draw) {
    if (Math.abs(amount) < 0.5) { draw(0); return; }
    const a0 = G.globalAlpha;
    for (let i = 0; i < n; i++) { G.globalAlpha = a0 * (i === 0 ? 0.55 : 0.45 / (n - 1) * 1.6); draw((i / (n - 1) - 0.5) * amount); }
    G.globalAlpha = a0;
  }
  /** salida estándar en el solape posterior: 0 → 1 */
  const outQ = (lt, b, post = 0.6) => clamp((lt - b.dur) / post);

  /* ------------------------------------------------------------ figura humana */
  /** silueta de persona (de pie) como Path2D en caja (0,0)-(w,h) */
  function person(w, h, arms = 0) {
    const p = new Path2D(), hx = w / 2, hr = w * 0.16;
    p.arc(hx, hr + h * 0.01, hr, 0, Math.PI * 2);
    p.moveTo(hx - w * 0.07, h * 0.13); p.lineTo(hx + w * 0.07, h * 0.13);
    p.moveTo(hx - w * 0.36, h * 0.18);
    p.bezierCurveTo(hx - w * 0.44, h * 0.19, hx - w * 0.46, h * 0.25, hx - w * 0.46, h * 0.3);
    p.lineTo(hx - w * 0.47, h * 0.55); p.lineTo(hx - w * 0.36, h * 0.56); p.lineTo(hx - w * 0.33, h * 0.36);
    p.lineTo(hx - w * 0.31, h * 0.6); p.lineTo(hx - w * 0.28, h * 0.99); p.lineTo(hx - w * 0.06, h * 0.99); p.lineTo(hx - w * 0.02, h * 0.62);
    p.lineTo(hx + w * 0.02, h * 0.62); p.lineTo(hx + w * 0.06, h * 0.99); p.lineTo(hx + w * 0.28, h * 0.99); p.lineTo(hx + w * 0.31, h * 0.6);
    p.lineTo(hx + w * 0.33, h * 0.36); p.lineTo(hx + w * 0.36, h * 0.56); p.lineTo(hx + w * 0.47, h * 0.55); p.lineTo(hx + w * 0.46, h * 0.3);
    p.bezierCurveTo(hx + w * 0.46, h * 0.25, hx + w * 0.44, h * 0.19, hx + w * 0.36, h * 0.18);
    p.closePath();
    p.rect(hx - w * 0.08, h * 0.12, w * 0.16, h * 0.08);
    return p;
  }
  /** busto (cabeza + hombros) para los planos de presos/placa */
  function bust(w, h) {
    const p = new Path2D(), hx = w / 2;
    p.ellipse(hx, h * 0.17, w * 0.13, h * 0.16, 0, 0, Math.PI * 2);
    p.rect(hx - w * 0.07, h * 0.28, w * 0.14, h * 0.1);
    p.moveTo(hx - w * 0.1, h * 0.35);
    p.bezierCurveTo(hx - w * 0.38, h * 0.37, hx - w * 0.47, h * 0.45, hx - w * 0.5, h * 0.62);
    p.lineTo(hx - w * 0.5, h); p.lineTo(hx + w * 0.5, h); p.lineTo(hx + w * 0.5, h * 0.62);
    p.bezierCurveTo(hx + w * 0.47, h * 0.45, hx + w * 0.38, h * 0.37, hx + w * 0.1, h * 0.35); p.closePath();
    return p;
  }

  /* ------------------------------------------------------------ lower third */
  /** nombre / cargo / institución (Barlow Condensed) como en las entrevistas */
  function lowerThird(G, st, lt, b, o) {
    if (!o || !(o.name || o.role)) return;
    const { W, H, portrait } = st, a = prog(lt, o.at ?? 0.5, 0.35, "linear") * (1 - clamp((lt - (b.dur - 0.25)) / 0.25));
    if (a <= 0) return;
    const x = portrait ? W * 0.08 : W * 0.107, fs = portrait ? W * 0.075 : H * 0.068, y = portrait ? H * 0.62 : H * 0.565;
    G.save(); G.globalAlpha = a;
    /* sombra suave detrás del rótulo para que se lea sobre fotos claras */
    const sg = G.createLinearGradient(0, 0, portrait ? W : W * 0.55, 0); sg.addColorStop(0, "rgba(0,0,0,.55)"); sg.addColorStop(1, "rgba(0,0,0,0)");
    G.fillStyle = sg; G.fillRect(0, y - fs * 1.3, portrait ? W : W * 0.55, fs * 3.2);
    G.textBaseline = "alphabetic"; G.shadowColor = "rgba(0,0,0,.6)"; G.shadowBlur = fs * 0.25;
    G.font = font("cond", fs, 700); G.letterSpacing = (fs * 0.04) + "px"; G.fillStyle = "#efeeea"; G.fillText(String(o.name || "").toUpperCase(), x, y);
    const fs2 = fs * 0.5; G.font = font("cond", fs2, 700); G.letterSpacing = (fs2 * 0.06) + "px";
    if (o.role) { G.fillStyle = "#9a9590"; G.fillText(String(o.role).toUpperCase(), x + fs * 0.03, y + fs * 1.03); }
    if (o.org) { G.fillStyle = "#efeeea"; G.fillText(String(o.org).toUpperCase(), x + fs * 0.03, y + fs * 1.03 + fs2 * 1.12); }
    G.restore();
  }

  /* ------------------------------------------------------------ runtime */
  const grainTiles = [];
  K.family("enmienda", {
    setup(ctx) {
      if (!grainTiles.length) for (let k = 0; k < 6; k++) {
        const T = mk(256, 256), im = T.g.createImageData(256, 256), d = im.data, r = K.rng(900 + k);
        for (let i = 0; i < 256 * 256; i++) { const v = r(); const lum = v > 0.5 ? 255 : 0; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = lum; d[i * 4 + 3] = Math.abs(v - 0.5) * 2 * 60; }
        T.g.putImageData(im, 0, 0); grainTiles.push(T.c);
      }
      /* subtítulos: Barlow Condensed discreta, como rótulo de documental */
      if (!document.getElementById("enm-css")) {
        const s = document.createElement("style"); s.id = "enm-css";
        s.textContent = `[data-family="enmienda"] .k-cap{font-family:'Barlow Condensed',sans-serif;font-weight:500;letter-spacing:.035em;color:rgba(214,208,198,.62);font-size:clamp(15px,3.3vmin,42px);text-shadow:0 2px 14px rgba(0,0,0,.95),0 0 3px rgba(0,0,0,.9)}
[data-family="enmienda"] .k-w-cur{color:#f1ede5;font-weight:700}`;
        document.head.appendChild(s);
      }
      return { grain: ctx.C.enmienda?.grain ?? 1, dust: ctx.C.enmienda?.dust ?? 1, flicker: ctx.C.enmienda?.flicker ?? 1 };
    },
    frame(t, ctx) {
      const { stage, g } = ctx;
      g.bg.fillStyle = ctx.C.palette.bg; g.bg.fillRect(0, 0, stage.W, stage.H);
    },
    post(t, ctx, S) {
      const { stage, g } = ctx, G = g.top, { W, H, u } = stage, fr = Math.floor(t * FPS), r = K.rng(5000 + fr);
      /* grano de película (cambia cada cuadro) */
      if (S.grain > 0) {
        const tile = grainTiles[fr % grainTiles.length], p = G.createPattern(tile, "repeat"), s = Math.max(0.5, u / 6);
        p.setTransform(new DOMMatrix([s, 0, 0, s, r() * 256, r() * 256]));
        G.save(); G.globalAlpha = 0.5 * S.grain; G.fillStyle = p; G.fillRect(0, 0, W, H); G.restore();
      }
      /* polvo y pelusas blancas */
      if (S.dust > 0) {
        G.save(); G.fillStyle = "#e9e4da";
        const n = Math.floor(r() * 4 * S.dust);
        for (let k = 0; k < n; k++) { G.globalAlpha = 0.25 + r() * 0.5; G.beginPath(); G.arc(r() * W, r() * H, u * (0.08 + r() * 0.22), 0, 7); G.fill(); }
        if (r() < 0.06 * S.dust) {                 /* pelo */
          G.strokeStyle = "#ddd6ca"; G.globalAlpha = 0.35; G.lineWidth = Math.max(1, u * 0.06);
          let x = r() * W, y = r() * H, a = r() * 6.28; G.beginPath(); G.moveTo(x, y);
          for (let s = 0; s < 6; s++) { a += (r() - 0.5) * 1.4; x += Math.cos(a) * u * 1.2; y += Math.sin(a) * u * 1.2; G.lineTo(x, y); } G.stroke();
        }
        G.restore();
      }
      /* viñeta + parpadeo de exposición */
      vignette(G, W, H, 0.5, 0.42);
      if (S.flicker > 0) { G.fillStyle = `rgba(0,0,0,${(r() * 0.05 * S.flicker).toFixed(3)})`; G.fillRect(0, 0, W, H); }
    },
  });

  K.enm = { FPS, F, font, mk, memo, valueNoise, grunge, paper, fibers, pattern, inkText, measure, fit, dissolver, masked, photo, cover,
            tape, card, vignette, spot, brush, scribble, crosshair, stop, boil, camera, smear, outQ, person, bust, lowerThird };
})();
