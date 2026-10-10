/* =============================================================================
   collage · runtime de la familia "collage de archivo" (documental conmemorativo)
   -----------------------------------------------------------------------------
   Réplica del estilo de un documental de aniversario hecho con recortes: una mesa
   infinita de papel de diario donde se apilan fotos con borde blanco, recortes de
   periódico, sellos, monedas y años en serif; la cámara se desliza sobre ese
   collage (paralaje, rotación leve) y entre plano y plano pasan hojas de libro,
   ráfagas de luz, barridos con desenfoque, "zambullidas" en titulares, humo y
   cortinas de luz cálida.

   Arquitectura (todo en canvas 2D, determinista):
   · cada plano (beat) dibuja su "placa" en un canvas propio S con su cámara;
     después la compone sobre ctx.g.main con la transición de ENTRADA propia
     (param `tin`) y la de SALIDA que pide el plano siguiente (se lee de ctx.beats);
   · el post de la familia (sobre ctx.g.main) aplica la "lente": desenfoque de
     bordes (profundidad de campo), grade rosa/verde azulado, fugas de luz,
     viñeta y grano de película. Los subtítulos (DOM) quedan nítidos encima.
   · texturas (papel de diario, cielo, hojas de libro, ruido) se generan UNA vez en
     setup con semilla fija; las fotos se viran (B/N, verde azulado, rosa, sepia,
     color desvaído) con trama de semitono y aberración cromática, y se cachean.
   Exporta utilidades en Kit.collage.
   ========================================================================== */
(function () {
  "use strict";
  const K = window.Kit, { clamp, lerp, prog, ease } = K;
  for (const f of ["600 40px 'Cormorant Garamond'", "700 40px 'Cormorant Garamond'", "italic 500 40px 'Cormorant Garamond'",
    "italic 600 40px 'Cormorant Garamond'", "700 40px Cinzel", "800 40px 'Playfair Display'", "900 40px 'Playfair Display'",
    "400 20px 'Old Standard TT'", "700 20px 'Old Standard TT'", "italic 400 20px 'Old Standard TT'", "400 20px 'Open Sans'", "600 20px 'Open Sans'"]) K.fonts.add(f);

  const POST = 1.0;                       /* segundos que vive un plano después de su fin (transición) */
  const mk = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
  const rgb = h => { h = String(h).replace("#", ""); if (h.length === 3) h = h.split("").map(c => c + c).join(""); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const rgba = (c, a) => { const [r, g, b] = Array.isArray(c) ? c : rgb(c); return `rgba(${r | 0},${g | 0},${b | 0},${a})`; };
  const sm = t => t * t * (3 - 2 * t);
  /** caché con tope (evita acumular cientos de MB en un render largo; lo que sale se regenera igual) */
  function cput(F, k, v) { F.cache.set(k, v); while (F.cache.size > 140) F.cache.delete(F.cache.keys().next().value); return v; }
  const bell = (x, c, w) => Math.exp(-Math.pow((x - c) / w, 2));

  /* ------------------------------------------------------------ ruido (periódico) */
  function noise(w, h, seed, oct = 4, base = 3) {
    const r = K.rng(seed), out = new Float32Array(w * h); let amp = 1, tot = 0;
    for (let o = 0; o < oct; o++) {
      const gx = base << o, gy = Math.max(2, Math.round(gx * h / w));
      const grid = new Float32Array(gx * gy); for (let i = 0; i < grid.length; i++) grid[i] = r();
      for (let y = 0; y < h; y++) {
        const fy = y / h * gy, iy = Math.floor(fy), ty = sm(fy - iy), y0 = (iy % gy) * gx, y1 = ((iy + 1) % gy) * gx;
        for (let x = 0; x < w; x++) {
          const fx = x / w * gx, ix = Math.floor(fx), tx = sm(fx - ix), x0 = ix % gx, x1 = (ix + 1) % gx;
          out[y * w + x] += amp * lerp(lerp(grid[y0 + x0], grid[y0 + x1], tx), lerp(grid[y1 + x0], grid[y1 + x1], tx), ty);
        }
      }
      tot += amp; amp *= 0.55;
    }
    for (let i = 0; i < out.length; i++) out[i] /= tot;
    return out;
  }

  /* ------------------------------------------------------------ texto falso (con palabras de la narración) */
  function wordsFrom(ctx) {
    const ws = (ctx.words || []).map(w => w.text.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase()).filter(w => w.length > 1);
    return ws.length > 20 ? ws : "la historia de una ciudad que durante años estuvo partida en dos por un muro de hormigón y alambre y una noche cambió".split(" ");
  }
  function para(F, r, n) { const out = []; for (let i = 0; i < n; i++) out.push(F.words[Math.floor(r() * F.words.length)]); return out.join(" "); }
  /** escribe renglones justificados a la izquierda en una caja (texto de columna de diario) */
  function column(g, F, r, x, y, w, h, size, lh, color, font) {
    g.fillStyle = color; g.font = font || `400 ${size}px 'Old Standard TT', serif`; g.textBaseline = "alphabetic";
    let yy = y + size;
    while (yy < y + h) {
      let line = "", tries = 0;
      while (tries++ < 30) { const wd = F.words[Math.floor(r() * F.words.length)]; const t = line ? line + " " + wd : wd; if (g.measureText(t).width > w) break; line = t; }
      if (r() < 0.06) { yy += lh * 0.6; continue; }                 /* fin de párrafo */
      g.fillText(line, x, yy); yy += lh;
    }
  }
  function wrap(g, text, maxW) {
    const out = [];
    for (const par of String(text).split("\n")) {
      let line = "";
      for (const w of par.split(/\s+/)) { const t = line ? line + " " + w : w; if (line && g.measureText(t).width > maxW) { out.push(line); line = w; } else line = t; }
      out.push(line);
    }
    return out;
  }

  /* ------------------------------------------------------------ texturas generadas */
  /** papel de diario viejo (tileable): manchas, fibras, columnas de texto apagado */
  function makePaper(F, seed, o = {}) {
    const N = o.size || 1024, c = mk(N, N), g = c.getContext("2d"), r = K.rng(seed);
    const lo = 192, n = noise(lo, lo, seed, 5, 3), n2 = noise(lo, lo, seed + 9, 3, 2), lc = mk(lo, lo), lg = lc.getContext("2d"), id = lg.createImageData(lo, lo);
    const [br, bgc, bb] = rgb(o.base || "#d6c2b7");
    for (let i = 0; i < lo * lo; i++) {
      const v = (n[i] - 0.5) * 46 + (n2[i] - 0.5) * 22, warm = (n2[i] - 0.5) * 14;
      id.data[i * 4] = br + v + warm; id.data[i * 4 + 1] = bgc + v; id.data[i * 4 + 2] = bb + v - warm * 0.6; id.data[i * 4 + 3] = 255;
    }
    lg.putImageData(id, 0, 0); g.imageSmoothingQuality = "high"; g.drawImage(lc, 0, 0, N, N);
    if (o.text !== false) {                                 /* columnas de texto, muy apagadas */
      const cols = 4, cw = N / cols;
      for (let k = 0; k < cols; k++) {
        let y = 18 + r() * 30;
        while (y < N - 30) {
          const blockH = 90 + r() * 260;
          if (r() < 0.18) { g.font = `800 ${22 + r() * 18}px 'Playfair Display', serif`; g.fillStyle = "rgba(70,40,45,.20)"; g.fillText(para(F, r, 2 + Math.floor(r() * 2)), k * cw + 10, y + 26); y += 44; }
          column(g, F, r, k * cw + 12, y, cw - 26, Math.min(blockH, N - y - 10), 10, 13, "rgba(55,40,45,.20)");
          y += blockH + 18 + r() * 30;
        }
        g.fillStyle = "rgba(60,40,45,.10)"; g.fillRect(k * cw + cw - 6, 0, 1, N);
      }
    }
    /* grano fino + fibras */
    const im = g.getImageData(0, 0, N, N), d = im.data;
    for (let i = 0; i < d.length; i += 4) { const v = (r() - 0.5) * 16; d[i] += v; d[i + 1] += v; d[i + 2] += v; }
    g.putImageData(im, 0, 0);
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(60,40,40,${0.05 + r() * 0.18})`; g.fillRect(r() * N, r() * N, 1 + r() * 2, 1 + r() * 2); }
    g.strokeStyle = "rgba(255,250,240,.10)";
    for (let i = 0; i < 40; i++) { g.lineWidth = 0.5 + r(); g.beginPath(); const x = r() * N, y = r() * N; g.moveTo(x, y); g.lineTo(x + (r() - .5) * 80, y + (r() - .5) * 40); g.stroke(); }
    return c;
  }
  /** cielo nublado (apertura y emblema): verde azulado oscuro o cálido con sol a la derecha */
  function makeSky(seed, warm) {
    const w = 320, h = 270, n = noise(w, h, seed, 6, 2), n2 = noise(w, h, seed + 3, 4, 2), c = mk(w, h), g = c.getContext("2d"), id = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, j = y * w + Math.floor(x * 0.4 + (warm ? 60 : 0)), v = clamp((n[j] - 0.5) * 2.4 + 0.5), yy = y / h, xx = x / w;
      let R, G, B;
      if (!warm) {
        const band = bell(yy, 0.72, 0.09) * 0.8;                           /* banda de nubes clara abajo */
        R = lerp(10, 40, v) + band * 50 * n2[i]; G = lerp(18, 72, v * (1 - yy * 0.4)) + band * 38 * n2[i]; B = lerp(22, 86, v * (1 - yy * 0.3)) + band * 26 * n2[i];
      } else {
        const sun = Math.pow(clamp(1 - Math.hypot((xx - 0.86) * 1.6, (yy - 0.4) * 3)), 2.4), lit = clamp((v - 0.5) * 3.2) * clamp(xx * 1.3 - 0.25);
        R = lerp(22, 255, clamp(lit + sun)); G = lerp(30, 196, clamp(lit * 0.8 + sun * 0.95)); B = lerp(40, 140, clamp(lit * 0.5 + sun * 0.8));
        const cool = clamp(1 - lit * 1.6 - sun); R = lerp(R, 18 + 30 * v, cool); G = lerp(G, 44 + 40 * v, cool); B = lerp(B, 56 + 40 * v, cool);
      }
      id.data[i * 4] = R; id.data[i * 4 + 1] = G; id.data[i * 4 + 2] = B; id.data[i * 4 + 3] = 255;
    }
    g.putImageData(id, 0, 0);
    const out = mk(960, 540), og = out.getContext("2d"); og.imageSmoothingQuality = "high"; og.filter = "blur(2px)"; og.drawImage(c, -40, 0, 1040, 540);
    return out;
  }
  /** hoja de libro llena de texto (para el pase de páginas): ya desenfocada (está cerca de cámara) */
  function makePage(F, seed, seal) {
    const w = 520, h = 760, c = mk(w, h), g = c.getContext("2d"), r = K.rng(seed);
    const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, "#d9cdbf"); gr.addColorStop(0.5, "#efe6da"); gr.addColorStop(1, "#e2d6c8");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    column(g, F, r, 40, 46, w - 80, h - 90, 15, 19, "rgba(40,32,34,.82)");
    if (seal) { g.strokeStyle = "rgba(40,90,90,.55)"; g.lineWidth = 3; for (const [x, y] of [[110, 180], [120, 470]]) { g.beginPath(); g.arc(x, y, 52, 0, 7); g.stroke(); g.beginPath(); g.arc(x, y, 40, 0, 7); g.stroke(); } }
    const b = mk(w, h), bg = b.getContext("2d"); bg.filter = "blur(2.2px)"; bg.drawImage(c, 0, 0);
    return b;
  }
  /** gota/rombo rojo oscuro desenfocado (salida "zambullida": tinta que pasa frente a cámara) */
  function makeBlob() {
    const c = mk(256, 256), g = c.getContext("2d"); g.filter = "blur(14px)"; g.fillStyle = "#5c0f18";
    g.beginPath(); g.moveTo(128, 30); g.lineTo(226, 128); g.lineTo(128, 226); g.lineTo(30, 128); g.closePath(); g.fill();
    return c;
  }
  function makeBokeh(col) {
    const c = mk(128, 128), g = c.getContext("2d"), gr = g.createRadialGradient(64, 64, 0, 64, 64, 62);
    gr.addColorStop(0, rgba(col, 0.55)); gr.addColorStop(0.7, rgba(col, 0.42)); gr.addColorStop(0.86, rgba(col, 0.6)); gr.addColorStop(1, rgba(col, 0));
    g.fillStyle = gr; g.beginPath(); g.arc(64, 64, 62, 0, 7); g.fill(); return c;
  }
  function makePetal(seed) {
    const c = mk(96, 96), g = c.getContext("2d"), r = K.rng(seed), gr = g.createRadialGradient(40, 38, 4, 48, 50, 44);
    gr.addColorStop(0, "#d23a4a"); gr.addColorStop(0.6, "#a3122a"); gr.addColorStop(1, "#5e0816");
    g.fillStyle = gr; g.beginPath(); g.moveTo(48, 4); g.bezierCurveTo(72 + r() * 6, 22, 70, 70, 48, 92); g.bezierCurveTo(26, 70, 22 - r() * 6, 24, 48, 4); g.fill();
    g.strokeStyle = "rgba(120,10,25,.35)"; g.lineWidth = 2; g.beginPath(); g.moveTo(48, 14); g.quadraticCurveTo(52, 50, 46, 84); g.stroke();
    return c;
  }

  /* ------------------------------------------------------------ fotos viradas */
  const TONES = {
    bw: { d: "#2b2427", l: "#efe6de", sat: 0 },
    teal: { d: "#17323d", m: "#6c8d93", l: "#e7eee8", sat: 0 },
    rose: { d: "#4a1b27", m: "#ad767b", l: "#f6dfd8", sat: 0 },
    sepia: { d: "#33241d", m: "#94765f", l: "#efe0ca", sat: 0 },
    color: { d: "#2d2329", l: "#f4e7e0", sat: 0.62 },
    red: { d: "#5a1520", m: "#c0545a", l: "#fbe3dc", sat: 0 },
  };
  /** foto → versión archivo (duotono + trama de semitono + aberración cromática), cacheada */
  function toned(F, src, tone = "bw") {
    const key = src + "|" + tone; if (F.cache.has(key)) return F.cache.get(key);
    const im = K.loaded.get(src); if (!im) return null;
    const sc = Math.min(1, 1000 / Math.max(im.width, im.height)), w = Math.round(im.width * sc), h = Math.round(im.height * sc);
    const c = mk(w, h), g = c.getContext("2d"); g.drawImage(im, 0, 0, w, h);
    const id = g.getImageData(0, 0, w, h), d = id.data, T = TONES[tone] || TONES.bw, D = rgb(T.d), L = rgb(T.l), M = T.m ? rgb(T.m) : null;
    const out = new Uint8ClampedArray(d.length), cell = Math.max(2.4, w / 330), ca = Math.max(1, Math.round(w / 420));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4; let R = d[i], G = d[i + 1], B = d[i + 2];
      let Lm = (0.3 * R + 0.59 * G + 0.11 * B) / 255; Lm = clamp((Lm - 0.5) * 1.15 + 0.52);
      let cr, cg, cb;
      if (M) { const k = Lm < 0.5 ? Lm * 2 : (Lm - 0.5) * 2, A = Lm < 0.5 ? D : M, Bc = Lm < 0.5 ? M : L; cr = lerp(A[0], Bc[0], k); cg = lerp(A[1], Bc[1], k); cb = lerp(A[2], Bc[2], k); }
      else { cr = lerp(D[0], L[0], Lm); cg = lerp(D[1], L[1], Lm); cb = lerp(D[2], L[2], Lm); }
      if (T.sat) { const lr = lerp(D[0], 255, R / 255) * 0.95, lg = lerp(D[1], 250, G / 255) * 0.95, lb = lerp(D[2], 245, B / 255) * 0.95; cr = lerp(cr, lr, T.sat); cg = lerp(cg, lg, T.sat); cb = lerp(cb, lb, T.sat); }
      /* semitono a 45°: puntos cuyo radio crece con la sombra */
      const u = (x + y) * 0.7071 / cell, v = (x - y) * 0.7071 / cell, fu = u - Math.floor(u) - 0.5, fv = v - Math.floor(v) - 0.5;
      const dd = Math.sqrt(fu * fu + fv * fv), rad = 0.56 * Math.sqrt(1 - Lm), dot = clamp((rad - dd) * 3 + 0.5), k2 = 1 - 0.2 * dot;
      out[i] = cr * k2; out[i + 1] = cg * k2; out[i + 2] = cb * k2; out[i + 3] = 255;
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {        /* aberración: rojo a la derecha, azul a la izquierda */
      const i = (y * w + x) * 4, ir = (y * w + Math.max(0, x - ca)) * 4, ib = (y * w + Math.min(w - 1, x + ca)) * 4;
      d[i] = out[ir]; d[i + 1] = out[i + 1]; d[i + 2] = out[ib + 2]; d[i + 3] = 255;
    }
    g.putImageData(id, 0, 0);
    cput(F, key, c); return c;
  }
  /** recorte "cover" de la foto virada a una proporción, con encuadre (focus) y zoom */
  function crop(g, src, x, y, w, h, focus = [0.5, 0.5], zoom = 1) {
    const iar = src.width / src.height, ar = w / h; let sw = src.width, sh = src.height;
    if (iar > ar) sw = sh * ar; else sh = sw / ar;
    sw /= zoom; sh /= zoom;
    const sx = clamp(focus[0] * src.width - sw / 2, 0, src.width - sw), sy = clamp(focus[1] * src.height - sh / 2, 0, src.height - sh);
    g.drawImage(src, sx, sy, sw, sh, x, y, w, h);
  }
  /**
   * tarjeta de foto: borde blanco + sombra, cacheada.
   * o = { tone, ar (0 = la de la foto), border (fracción), size (px de ancho), focus, zoom, line, shadow, oval }
   * devuelve { c, iw, ih } (c incluye margen para la sombra)
   */
  function card(F, src, o = {}) {
    const key = ["card", src, o.tone, o.ar, o.border, o.size, o.focus, o.zoom, o.line, o.shadow, o.oval, o.cut].join("|");
    if (F.cache.has(key)) return F.cache.get(key);
    const t = toned(F, src, o.tone || "bw"); if (!t) return null;
    const ar = o.ar || t.width / t.height, iw = o.size || 620, ih = Math.round(iw / ar), pad = Math.round(iw * (o.shadow === false ? 0.01 : 0.07));
    const c = mk(iw + pad * 2, ih + pad * 2), g = c.getContext("2d"), bw = o.border == null ? 0.035 : o.border, b = Math.round(iw * bw);
    if (o.oval) {                                                    /* medallón: viñeta ovalada que se funde con el papel */
      const m = mk(iw, ih), mg = m.getContext("2d"); crop(mg, t, 0, 0, iw, ih, o.focus, o.zoom);
      mg.globalCompositeOperation = "destination-in"; mg.setTransform(1, 0, 0, ih / iw, 0, 0);
      const gr = mg.createRadialGradient(iw / 2, iw / 2, iw * 0.2, iw / 2, iw / 2, iw * 0.5);
      gr.addColorStop(0, "#000"); gr.addColorStop(0.72, "rgba(0,0,0,.85)"); gr.addColorStop(1, "rgba(0,0,0,0)"); mg.fillStyle = gr; mg.fillRect(0, 0, iw, iw);
      g.drawImage(m, pad, pad);
    } else if (o.cut) {                                              /* recorte de bordes suaves (sin marco) */
      const m = mk(iw, ih), mg = m.getContext("2d"); crop(mg, t, 0, 0, iw, ih, o.focus, o.zoom);
      mg.globalCompositeOperation = "destination-in"; const e = iw * 0.08;
      for (const [x0, y0, x1, y1, rx, ry, rw, rh] of [[0, 0, e, 0, 0, 0, e, ih], [iw, 0, iw - e, 0, iw - e, 0, e, ih]]) { const gr = mg.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "#000"); mg.fillStyle = gr; mg.fillRect(rx, ry, rw, rh); }
      g.drawImage(m, pad, pad);
    } else {
      if (o.shadow !== false) { g.save(); g.shadowColor = "rgba(35,18,22,.5)"; g.shadowBlur = pad * 0.55; g.shadowOffsetX = pad * 0.12; g.shadowOffsetY = pad * 0.18; g.fillStyle = "#efe8e0"; g.fillRect(pad, pad, iw, ih); g.restore(); }
      g.fillStyle = "#f1ebe3"; g.fillRect(pad, pad, iw, ih);
      crop(g, t, pad + b, pad + b, iw - b * 2, ih - b * 2, o.focus, o.zoom);
      if (o.line) { g.strokeStyle = "rgba(50,35,40,.55)"; g.lineWidth = Math.max(1, iw * 0.0025); g.strokeRect(pad + b * 0.45, pad + b * 0.45, iw - b * 0.9, ih - b * 0.9); }
      g.strokeStyle = "rgba(0,0,0,.18)"; g.lineWidth = 1; g.strokeRect(pad + b, pad + b, iw - b * 2, ih - b * 2);
    }
    const k = { c, iw, ih }; cput(F, key, k); return k;
  }
  /** dibuja una tarjeta centrada en el origen con ancho `w` (unidades de placa) */
  function drawCard(g, k, w) { if (!k) return; const s = w / k.iw; g.drawImage(k.c, -k.c.width * s / 2, -k.c.height * s / 2, k.c.width * s, k.c.height * s); }
  const cardH = (k, w) => (k ? w * k.ih / k.iw : w * 0.7);

  /**
   * recorte de periódico: papel claro, titular serif, columnas de texto y foto opcional.
   * o = { seed, w, h, title, red, photo:{src,tone,ar,focus}, cols, kicker, tint }
   */
  function clipping(F, o = {}) {
    const key = "clip|" + JSON.stringify(o); if (F.cache.has(key)) return F.cache.get(key);
    const iw = o.w || 520, ih = o.h || 640, pad = Math.round(iw * 0.06), c = mk(iw + pad * 2, ih + pad * 2), g = c.getContext("2d"), r = K.rng(o.seed || 1);
    g.save(); g.shadowColor = "rgba(35,18,22,.42)"; g.shadowBlur = pad * 0.5; g.shadowOffsetY = pad * 0.15; g.fillStyle = o.tint || "#ece2d8"; g.fillRect(pad, pad, iw, ih); g.restore();
    g.save(); g.beginPath(); g.rect(pad, pad, iw, ih); g.clip();
    g.globalAlpha = 0.55; g.drawImage(F.paperLight, pad - r() * 300, pad - r() * 300); g.globalAlpha = 1;
    const m = iw * 0.06; let y = pad + m;
    if (o.kicker) { g.font = `italic 400 ${iw * 0.04}px 'Old Standard TT', serif`; g.fillStyle = "rgba(50,35,40,.8)"; g.fillText(o.kicker, pad + m, y + iw * 0.04); y += iw * 0.065; }
    if (o.title) {
      const fs = o.titleSize || iw * 0.085; g.font = `800 ${fs}px 'Playfair Display', serif`; g.fillStyle = o.red ? "#7a1f2b" : "#2b2226";
      for (const ln of wrap(g, o.title, iw - m * 2).slice(0, 3)) { g.fillText(ln, pad + m, y + fs * 0.9); y += fs * 1.08; }
      y += iw * 0.012; g.fillStyle = "rgba(40,30,34,.7)"; g.fillRect(pad + m, y, iw - m * 2, Math.max(1, iw * 0.003)); y += iw * 0.03;
    }
    const cols = o.cols || 2, gap = iw * 0.035, cw = (iw - m * 2 - gap * (cols - 1)) / cols;
    if (o.photo) {
      const t = toned(F, o.photo.src, o.photo.tone || "bw");
      if (t) { const ph = Math.min(ih * 0.5, (iw - m * 2) / (o.photo.ar || 1.5)); crop(g, t, pad + m, y, iw - m * 2, ph, o.photo.focus); g.strokeStyle = "rgba(30,20,25,.4)"; g.strokeRect(pad + m, y, iw - m * 2, ph); y += ph + iw * 0.03; }
    }
    for (let k = 0; k < cols; k++) column(g, F, r, pad + m + k * (cw + gap), y, cw, pad + ih - m - y, Math.max(7, iw * 0.021), Math.max(9, iw * 0.028), "rgba(45,35,40,.78)");
    g.restore();
    const k = { c, iw, ih }; cput(F, key, k); return k;
  }
  /** sello postal dentado con foto virada y valor */
  function stamp(F, src, seed, tone) {
    const key = "stamp|" + src + seed + tone; if (F.cache.has(key)) return F.cache.get(key);
    const iw = 260, ih = 320, pad = 18, c = mk(iw + pad * 2, ih + pad * 2), g = c.getContext("2d"), r = K.rng(seed);
    g.save(); g.shadowColor = "rgba(30,15,20,.4)"; g.shadowBlur = 10; g.shadowOffsetY = 3; g.fillStyle = "#f3eee6"; g.fillRect(pad, pad, iw, ih); g.restore();
    g.globalCompositeOperation = "destination-out"; const st = 16;
    for (let x = pad; x <= pad + iw; x += st) { g.beginPath(); g.arc(x, pad, 5, 0, 7); g.arc(x, pad + ih, 5, 0, 7); g.fill(); }
    for (let y = pad; y <= pad + ih; y += st) { g.beginPath(); g.arc(pad, y, 5, 0, 7); g.arc(pad + iw, y, 5, 0, 7); g.fill(); }
    g.globalCompositeOperation = "source-over";
    const t = toned(F, src, tone || (r() < 0.5 ? "teal" : "red")); if (t) crop(g, t, pad + 22, pad + 22, iw - 44, ih - 80, [0.5, 0.4]);
    g.fillStyle = tone === "teal" ? "#1f5a68" : "#a2332e"; g.font = "700 30px Cinzel, serif"; g.textAlign = "center"; g.fillText(["20", "50", "10", "35"][Math.floor(r() * 4)] + " PF", pad + iw / 2, pad + ih - 22);
    g.strokeStyle = "rgba(60,30,30,.35)"; g.lineWidth = 2; g.strokeRect(pad + 14, pad + 14, iw - 28, ih - 28);
    const k = { c, iw, ih }; cput(F, key, k); return k;
  }
  /** moneda dorada en relieve */
  function coin(F, seed, label) {
    const key = "coin|" + seed + label; if (F.cache.has(key)) return F.cache.get(key);
    const R = 120, pad = 22, c = mk(R * 2 + pad * 2, R * 2 + pad * 2), g = c.getContext("2d"), cx = R + pad, r = K.rng(seed);
    g.save(); g.shadowColor = "rgba(30,15,10,.5)"; g.shadowBlur = 14; g.shadowOffsetY = 5;
    const gr = g.createRadialGradient(cx - R * 0.35, cx - R * 0.4, R * 0.1, cx, cx, R); gr.addColorStop(0, "#f8e2a0"); gr.addColorStop(0.55, "#c99a45"); gr.addColorStop(1, "#7d5a24");
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cx, R, 0, 7); g.fill(); g.restore();
    g.strokeStyle = "rgba(90,60,20,.7)"; g.lineWidth = 4; g.beginPath(); g.arc(cx, cx, R * 0.86, 0, 7); g.stroke();
    g.strokeStyle = "rgba(255,240,200,.5)"; g.lineWidth = 2; g.beginPath(); g.arc(cx + 1, cx + 1, R * 0.83, 0, 7); g.stroke();
    g.fillStyle = "rgba(95,64,22,.85)"; g.font = `700 ${R * 0.42}px 'Cormorant Garamond', serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(label || "1989", cx, cx + R * 0.05);
    g.font = `700 ${R * 0.14}px Cinzel, serif`; const txt = "· DEUTSCHLAND · EINIGKEIT · RECHT · FREIHEIT ";
    for (let i = 0; i < txt.length; i++) { const a = -Math.PI / 2 + i / txt.length * Math.PI * 2; g.save(); g.translate(cx + Math.cos(a) * R * 0.72, cx + Math.sin(a) * R * 0.72); g.rotate(a + Math.PI / 2); g.fillText(txt[i], 0, 0); g.restore(); }
    const k = { c, iw: R * 2, ih: R * 2 }; cput(F, key, k); return k;
  }

  /* ------------------------------------------------------------ escena (placa + cámara + transiciones) */
  const TIN = ["cut", "flip", "burst", "whip", "leak", "dive", "smoke", "flare"];
  const MOVES = ["left", "right", "up", "down", "in", "out", "diag", "drift", "none"];
  /** parámetros comunes de todo plano-collage */
  const common = {
    tin: { type: "enum", options: TIN, default: "flip", doc: "Transición de ENTRADA: flip (pasan hojas de libro), burst (ráfaga de luz hacia adelante), whip (barrido lateral con desenfoque), leak (cortina de luz rosa), dive (sale zambulléndose en el titular del plano anterior; usar después de collage.headline), smoke (disolución de humo), flare (mancha roja que cruza), cut." },
    move: { type: "enum", options: MOVES, default: "left", doc: "Movimiento de cámara sobre el collage (en 9:16 se gira 90°)." },
    speed: { type: "number", default: 0.05, min: 0, max: 0.3, doc: "Velocidad de cámara (alto de cuadro por segundo)." },
    tilt: { type: "number", default: 0, doc: "Rotación de la mesa en grados (0 = automática ±2°)." },
  };
  /** la transición de entrada del plano siguiente (decide la salida de éste) */
  function nextTin(ctx) {
    const b0 = ctx.beat, nb = ctx.beats.filter(x => x.layer === "main" && x.t0 > b0.t0 + 0.01 && x.i !== b0.i).sort((a, b) => a.t0 - b.t0)[0];
    if (!nb || nb.t0 > b0.t1 + 0.3) return "cut";
    return nb.params?.tin ?? K.registry.get(nb.use)?.params?.tin?.default ?? "cut";
  }

  function scene(ctx, p, o = {}) {
    const F = ctx.family.collage, st = ctx.stage, { W, H, portrait } = st, dpr = ctx.dpr, U = portrait ? W : H;
    const S = mk(W * dpr, H * dpr), sg = S.getContext("2d");
    const T2 = o.tmp ? mk(W * dpr, H * dpr) : null;
    const pat = sg.createPattern(o.paper || F.paper, "repeat");
    const r = ctx.rng, items = [], b0 = ctx.beat;
    const Ttot = b0.dur + POST;
    const api = {
      ctx, F, p, U, W, H, dpr, portrait, r, items, S, sg, Ttot, pk: portrait ? 0.86 : 1, focus: { x: 0, y: 0 },
      /** coordenadas pensadas en 16:9; en 9:16 se trasponen (la composición gira 90°) */
      T: (x, y) => portrait ? [y, x] : [x, y],
      add(it) { const [x, y] = it.raw ? [it.x || 0, it.y || 0] : api.T(it.x || 0, it.y || 0); Object.assign(it, { x, y }); it.z ??= 0; it.t0 ??= 0; it.din ??= 0.6; it.enter ??= "fade"; it.rot ??= 0; it.alpha ??= 1; it.order = items.length; items.push(it); return it; },
      camTf(g, cam, z = 0) { const zs = cam.s * (1 + z * 0.3), par = 1 + z * 0.7; g.setTransform(1, 0, 0, 1, 0, 0); g.translate(W * dpr / 2, H * dpr / 2); g.scale(U * dpr * zs, U * dpr * zs); g.rotate(cam.r); g.translate(-cam.x * par, -cam.y * par); },
    };
    if (o.build) o.build(api);
    items.sort((a, b) => a.z - b.z || a.order - b.order);
    const nTin = nextTin(ctx), tin = p.tin || "cut";
    const tilt = (p.tilt || ((r() - 0.5) * 4)) * Math.PI / 180, rotDrift = (r() - 0.5) * 1.2 * Math.PI / 180;
    const d = (p.speed ?? 0.05) * Ttot, zb = o.zoom || 1, zz = 0.03 * Ttot;
    const P = { left: [[-d / 2, 0, 1], [d / 2, 0, 1]], right: [[d / 2, 0, 1], [-d / 2, 0, 1]], up: [[0, d / 2, 1], [0, -d / 2, 1]], down: [[0, -d / 2, 1], [0, d / 2, 1]],
      in: [[0, 0, 1], [0, 0, 1 + zz]], out: [[0, 0, 1 + zz], [0, 0, 1]], diag: [[-d * 0.45, d * 0.35, 1], [d * 0.45, -d * 0.35, 1]], drift: [[-d * 0.25, d * 0.1, 1], [d * 0.25, -d * 0.1, 1 + zz * 0.5]], none: [[0, 0, 1], [0, 0, 1]] }[p.move || o.move || "left"] || [[0, 0, 1], [0, 0, 1]];
    const c0 = o.cam0 || [0, 0];
    function camAt(q) {
      const [x, y] = api.T(lerp(P[0][0], P[1][0], q) + c0[0], lerp(P[0][1], P[1][1], q) + c0[1]);
      return { x, y, s: zb * lerp(P[0][2], P[1][2], q), r: (o.noTilt ? 0 : tilt) + rotDrift * (q - 0.5) };
    }
    /* sprite desenfocado para el barrido (objeto que cruza cerca de cámara) */
    let whipSprite = null;
    if (tin === "whip") {
      const src = o.whipSrc || [...K.loaded.keys()][Math.floor(r() * K.loaded.size)];
      const k = src && card(F, src, { tone: r() < 0.5 ? "rose" : "color", border: 0, shadow: false, size: 520 });
      if (k) { whipSprite = mk(k.c.width, k.c.height); const g = whipSprite.getContext("2d"); g.filter = "blur(10px)"; g.drawImage(k.c, 0, 0); }
    }

    function paintItems(g, cam, lt, t) {
      for (const it of items) {
        let a = it.alpha, sc = 1, dx = 0, dy = 0;
        if (it.enter !== "none" && lt < it.t0 + it.din) {
          const q = clamp((lt - it.t0) / it.din); if (q <= 0) continue;
          if (it.enter === "drop") { const e = ease.expoOut(q); a *= clamp(q * 2.2); sc = 1 + 1.3 * (1 - e); }
          else if (it.enter === "slide") { const e = ease.out(q); a *= clamp(q * 2.5); const [sx, sy] = api.T(it.sdx ?? 0.5, it.sdy ?? 0); dx = sx * (1 - e); dy = sy * (1 - e); }
          else if (it.enter === "pop") { const e = ease.back(q); a *= clamp(q * 3); sc = 0.6 + 0.4 * e; }
          else { a *= q; sc = 1.035 - 0.035 * ease.out(q); }
        }
        if (it.t1 != null && lt > it.t1) a *= clamp(1 - (lt - it.t1) / (it.dout || 0.4));
        if (a <= 0.003) continue;
        api.camTf(g, cam, it.z);
        g.translate(it.x + dx, it.y + dy); if (it.rot) g.rotate(it.rot); if (sc !== 1) g.scale(sc, sc);
        g.globalAlpha = Math.min(1, a);
        it.draw(g, lt, t, it, cam);
      }
      g.globalAlpha = 1;
    }
    function paint(cam, lt, t) {
      sg.setTransform(1, 0, 0, 1, 0, 0); sg.globalAlpha = 1; sg.globalCompositeOperation = "source-over"; sg.filter = "none";
      if (o.paint) o.paint(sg, cam, lt, t, api);
      else {
        api.camTf(sg, cam, -0.05);
        pat.setTransform(new DOMMatrix().scaleSelf(1.7 / 1024)); sg.fillStyle = pat; sg.fillRect(-8, -8, 16, 16);
      }
      paintItems(sg, cam, lt, t);
      if (o.over) { sg.globalAlpha = 1; o.over(sg, cam, lt, t, api); }
      sg.setTransform(1, 0, 0, 1, 0, 0); sg.globalAlpha = 1; sg.globalCompositeOperation = "source-over"; sg.filter = "none";
    }
    /** compone S sobre g (px de dispositivo): zoom z, desplazamiento, copias de desenfoque de movimiento */
    function blit(g, a, z, ox, oy, mb, blur) {
      if (a <= 0.003) return;
      const w = S.width, h = S.height, one = (s, dx, dy, al) => { g.globalAlpha = al; const ww = w * s, hh = h * s; g.drawImage(S, (w - ww) / 2 + dx, (h - hh) / 2 + dy, ww, hh); };
      if (blur > 0.3) g.filter = `blur(${(blur * dpr).toFixed(1)}px)`;
      one(1 + z, ox, oy, a);
      if (mb && mb.k > 0.02) for (let i = 1; i <= 4; i++) {
        if (mb.type === "zoom") one((1 + z) * (1 + i * 0.05 * mb.k), ox, oy, a * 0.26);
        else if (mb.type === "h") one(1 + z, ox - i * mb.k * 0.035 * w * (mb.dir || 1), oy, a * 0.26);
        else one(1 + z, ox, oy - i * mb.k * 0.035 * h * (mb.dir || 1), a * 0.26);
      }
      g.filter = "none"; g.globalAlpha = 1;
    }

    return {
      api,
      render(lt, b, t) {
        const g = ctx.g.main, e = lt - b.dur;
        const cam = camAt(clamp(lt / Ttot));
        /* ---- salida (la pide el plano siguiente) */
        let mbOut = null, blurOut = 0, k;
        if (nTin === "burst" && (k = clamp((e + 0.2) / 0.5)) > 0) { cam.s *= 1 + 2.4 * k * k; mbOut = { type: "zoom", k }; }
        else if (nTin === "whip" && (k = clamp((e + 0.12) / 0.5)) > 0) { const dx = 1.3 * k * k; if (portrait) cam.y += dx; else cam.x += dx; mbOut = { type: portrait ? "v" : "h", k, dir: -1 }; }
        else if (nTin === "dive" && (k = ease.in(clamp((e + 0.5) / 0.85))) > 0) { const f = api.focus, q = Math.min(1, k * 2.5); cam.x = lerp(cam.x, f.x, q); cam.y = lerp(cam.y, f.y, q); cam.s *= 1 + 7 * k; blurOut = k * 9; }
        else if (nTin === "smoke" && (k = clamp(e / 0.8)) > 0) { blurOut = k * 7; cam.s *= 1 + 0.06 * k; }
        else if (nTin === "flare" && (k = clamp((e + 0.1) / 0.8)) > 0) { const dx = 0.3 * k; if (portrait) cam.y += dx; else cam.x += dx; cam.s *= 1 + 0.12 * k; }
        else if (nTin === "leak" && (k = clamp(e / 0.9)) > 0) { cam.s *= 1 + 0.05 * k; }
        paint(cam, lt, t);
        /* ---- entrada propia */
        const tl = lt, Wd = W * dpr, Hd = H * dpr;
        let a = 1, z = 0, ox = 0, oy = 0, mb = mbOut, blur = blurOut, vis = 1, clipX = null;
        if (tin === "flip") { const xl = flipEdge(tl, W) * dpr; if (xl < Wd) { clipX = Math.max(0, xl); vis = clipX / Wd; } }
        else if (tin === "burst") { a = clamp((tl - 0.16) / 0.2); const q = clamp((tl - 0.16) / 0.7); z = 0.45 * (1 - ease.out(q)); if (q < 1) mb = { type: "zoom", k: 1 - q }; vis = a; }
        else if (tin === "whip") { const q = clamp((tl - 0.1) / 0.6), off = (1 - ease.out(q)) * 0.9; a = clamp((tl - 0.1) / 0.22); if (portrait) oy = off * Hd; else ox = off * Wd; if (q < 1) mb = { type: portrait ? "v" : "h", k: (1 - q), dir: 1 }; vis = a; }
        else if (tin === "leak") { a = ease.inOut(clamp((tl - 0.12) / 0.7)); vis = a; }
        else if (tin === "dive") { a = clamp((tl - 0.38) / 0.3); z = 0.15 * (1 - ease.out(clamp((tl - 0.38) / 0.6))); vis = a; }
        else if (tin === "smoke") { vis = clamp(tl / 0.9); }
        else if (tin === "flare") { a = clamp((tl - 0.32) / 0.35); vis = a; }
        g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
        if (tin === "smoke" && tl < 0.95) smokeBlit(g, F, S, tl, mb, blur);
        else {
          if (clipX != null) { g.beginPath(); g.rect(0, 0, clipX, Hd); g.clip(); }
          blit(g, a, z, ox, oy, mb, blur);
        }
        g.restore();
        /* ---- efectos de la transición de entrada (encima de todo) */
        g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
        if (tin === "flip") fxFlip(g, F, tl, Wd, Hd);
        else if (tin === "burst") fxBurst(g, F, tl, Wd, Hd);
        else if (tin === "whip") fxWhip(g, F, tl, Wd, Hd, whipSprite, portrait);
        else if (tin === "dive") fxDive(g, F, tl, Wd, Hd);
        else if (tin === "flare") fxFlare(g, F, tl, Wd, Hd);
        else if (tin === "leak") F.boost.push({ col: [255, 120, 190], a: 0.95 * bell(tl, 0.5, 0.3), x: 0.1, y: 0.4, r: 1.1 }, { col: [255, 210, 230], a: 0.5 * bell(tl, 0.55, 0.22), x: 0.35, y: 0.3, r: 0.8 });
        else if (tin === "smoke") F.boost.push({ col: [255, 230, 120], a: 0.45 * bell(tl, 0.85, 0.25), x: 0.75, y: 0.4, r: 0.8 }, { col: [255, 110, 120], a: 0.35 * bell(tl, 0.9, 0.3), x: 0.35, y: 0.5, r: 0.7 });
        g.restore();
        /* ---- look global (grade, desenfoque de bordes) ponderado por visibilidad */
        F.grade = lerp(F.grade, o.grade ?? 1, vis); F.dof = lerp(F.dof, o.dof ?? 1, vis); F.vig = lerp(F.vig, o.vig ?? 1, vis); F.leakBase = lerp(F.leakBase, o.leak ?? 1, vis);
      },
      dispose() { S.width = S.height = 1; },
    };
  }

  /* ------------------------------------------------------------ efectos de transición */
  const FLIP = { n: 3, gap: 0.13, dur: 0.6 };
  /** borde izquierdo de la PRIMERA hoja (todo lo que queda a su izquierda ya es el plano nuevo) */
  function flipEdge(tl, W) {
    const u = clamp(tl / FLIP.dur); if (u <= 0) return 0; if (u >= 1) return W * 2;
    const xR = lerp(-0.05, 1.75, ease.inOut(u)) * W, wv = W * (0.62 + 0.3 * Math.sin(Math.PI * u));
    return xR - wv;
  }
  function fxFlip(g, F, tl, W, H) {
    for (let i = FLIP.n - 1; i >= 0; i--) {
      const u = clamp((tl - i * FLIP.gap) / FLIP.dur); if (u <= 0 || u >= 1) continue;
      const xR = lerp(-0.05, 1.75, ease.inOut(u)) * W, wv = W * (0.62 + 0.3 * Math.sin(Math.PI * u)), xL = xR - wv, tex = F.pages[i % 2], n = 22;
      /* sombra proyectada delante de la hoja */
      const sh = g.createLinearGradient(xR, 0, xR + W * 0.14, 0); sh.addColorStop(0, "rgba(25,12,15,.32)"); sh.addColorStop(1, "rgba(25,12,15,0)");
      g.fillStyle = sh; g.fillRect(xR, 0, W * 0.14, H);
      for (let k = 0; k < n; k++) {
        const s = k / n, x0 = xL + wv * s, x1 = xL + wv * (k + 1) / n, hf = 1.12 + 0.6 * s * Math.sin(Math.PI * u), hh = H * hf, y0 = H / 2 - hh / 2 - H * 0.05 * s;
        g.globalAlpha = 1; g.drawImage(tex, tex.width * s, 0, tex.width / n, tex.height, x0, y0, x1 - x0 + 1.5, hh);
        const shade = 0.42 * Math.pow(1 - s, 2.2) - 0.1 * bell(s, 0.8, 0.12);
        g.fillStyle = shade > 0 ? `rgba(40,22,26,${shade.toFixed(3)})` : `rgba(255,248,236,${(-shade).toFixed(3)})`; g.fillRect(x0, y0, x1 - x0 + 1.5, hh);
      }
    }
    g.globalAlpha = 1;
  }
  function fxBurst(g, F, tl, W, H) {
    const a = bell(tl, 0.27, 0.14); if (a < 0.01) return;
    const cx = W * 0.52, cy = H * 0.47, R = Math.max(W, H) * 0.85, gr = g.createRadialGradient(cx, cy, 0, cx, cy, R);
    gr.addColorStop(0, `rgba(255,252,246,${a})`); gr.addColorStop(0.35, `rgba(255,236,220,${a * 0.85})`); gr.addColorStop(1, `rgba(255,200,180,${a * 0.25})`);
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const r = K.rng(77), k = clamp(tl / 0.6); g.lineCap = "round";
    for (let i = 0; i < 46; i++) {
      const an = r() * Math.PI * 2, r0 = (0.08 + r() * 0.3 + k * 0.5) * W, len = (0.15 + r() * 0.35) * W;
      g.strokeStyle = `rgba(255,255,255,${(a * (0.25 + r() * 0.5)).toFixed(3)})`; g.lineWidth = (1 + r() * 5) * W / 1920;
      g.beginPath(); g.moveTo(cx + Math.cos(an) * r0, cy + Math.sin(an) * r0); g.lineTo(cx + Math.cos(an) * (r0 + len), cy + Math.sin(an) * (r0 + len)); g.stroke();
    }
    F.boost.push({ col: [255, 190, 140], a: 0.6 * a, x: 0.5, y: 0.5, r: 1 });
  }
  function fxWhip(g, F, tl, W, H, sprite, portrait) {
    if (sprite) {
      const q = clamp((tl - 0.05) / 0.55); if (q > 0 && q < 1) {
        const s = Math.max(W, H) * 0.75 / sprite.width * 1.5, w = sprite.width * s, h = sprite.height * s, p = ease.inOut(q);
        const x = portrait ? W * 0.5 : lerp(1.25, -0.6, p) * W, y = portrait ? lerp(1.25, -0.6, p) * H : H * 0.55;
        g.globalAlpha = 0.95; g.save(); g.translate(x, y); g.rotate(-0.12); g.drawImage(sprite, -w / 2, -h / 2, w, h); g.restore(); g.globalAlpha = 1;
      }
    }
    F.boost.push({ col: [255, 140, 170], a: 0.7 * bell(tl, 0.5, 0.25), x: 0.25, y: 0.75, r: 0.9 }, { col: [255, 245, 245], a: 0.45 * bell(tl, 0.42, 0.15), x: 0.65, y: 0.5, r: 0.8 });
  }
  function fxDive(g, F, tl, W, H) {
    const r = K.rng(31);
    for (let i = 0; i < 5; i++) {
      const s0 = 0.12 + i * 0.07, q = clamp((tl - s0) / 0.45); if (q <= 0 || q >= 1) continue;
      const an = r() * Math.PI * 2, d0 = 0.05 + r() * 0.15, sz = (0.18 + r() * 0.2) * H * (1 + q * 5), dd = (d0 + q * q * 0.9) * W;
      const x = W / 2 + Math.cos(an) * dd, y = H / 2 + Math.sin(an) * dd * 0.6;
      g.globalAlpha = 0.9 * Math.sin(Math.PI * q); g.drawImage(F.blob, x - sz / 2, y - sz / 2, sz, sz);
    }
    g.globalAlpha = 1;
    F.boost.push({ col: [255, 240, 230], a: 0.55 * bell(tl, 0.36, 0.12), x: 0.5, y: 0.45, r: 0.9 }, { col: [255, 90, 80], a: 0.4 * bell(tl, 0.5, 0.2), x: 0.2, y: 0.5, r: 0.8 });
  }
  function fxFlare(g, F, tl, W, H) {
    const q = clamp(tl / 0.95); if (q <= 0 || q >= 1) return;
    const x = lerp(-0.45, 1.45, ease.inOut(q)) * W, y = H * 0.5, R = H * 1.05, a = Math.sin(Math.PI * q);
    g.save(); g.translate(x, y); g.scale(0.7, 1);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, R); gr.addColorStop(0, `rgba(58,6,14,${0.97 * a})`); gr.addColorStop(0.45, `rgba(110,16,26,${0.85 * a})`); gr.addColorStop(1, "rgba(140,30,34,0)");
    g.fillStyle = gr; g.fillRect(-R, -R, R * 2, R * 2); g.restore();
    F.boost.push({ col: [255, 70, 60], a: 0.3 * a, x: x / W + 0.2, y: 0.5, r: 0.8 });
  }
  /** disolución por humo: máscara de ruido con umbral que avanza + virado verde azulado */
  function smokeBlit(g, F, S, tl, mb, blur) {
    const q = clamp(tl / 0.9), m = F.smokeC, mg = m.getContext("2d"), id = F.smokeId, d = id.data, n = F.smokeN, th = 1 - q * 1.5;
    for (let i = 0; i < n.length; i++) d[i * 4 + 3] = clamp((n[i] - th) * 5) * 255;
    mg.putImageData(id, 0, 0);
    const T = F.smokeT; if (T.width !== S.width || T.height !== S.height) { T.width = S.width; T.height = S.height; }
    const tg = T.getContext("2d"); tg.setTransform(1, 0, 0, 1, 0, 0); tg.globalCompositeOperation = "copy"; tg.globalAlpha = 1; tg.drawImage(S, 0, 0);
    tg.globalCompositeOperation = "source-atop"; tg.fillStyle = `rgba(40,110,120,${(0.55 * (1 - q)).toFixed(3)})`; tg.fillRect(0, 0, T.width, T.height);
    tg.globalCompositeOperation = "destination-in"; tg.imageSmoothingQuality = "high"; tg.drawImage(m, 0, 0, T.width, T.height);
    tg.globalCompositeOperation = "source-over";
    g.drawImage(T, 0, 0);
  }

  /* ------------------------------------------------------------ dibujo de texto en placa (unidades → centi) */
  /** texto centrado en el origen; size en centésimas del alto de cuadro */
  function txt(g, s, x, y, o = {}) {
    g.save(); g.scale(0.01, 0.01);
    g.font = `${o.style || ""} ${o.weight || 600} ${o.size || 5}px ${o.font || "'Cormorant Garamond', serif"}`.trim();
    g.textAlign = o.align || "center"; g.textBaseline = o.base || "alphabetic";
    if (o.spacing) g.letterSpacing = o.spacing + "px";
    if (o.shadow) { g.shadowColor = o.shadow; g.shadowBlur = o.blur ?? 1.2; }
    g.fillStyle = o.color || "#2a2226"; g.fillText(s, x * 100, y * 100);
    g.restore();
  }
  function measure(font, s) { const g = measure.g ||= mk(4, 4).getContext("2d"); g.font = font; return g.measureText(s).width; }
  /** año en serif bordó con fecha chica arriba (como "1919 / 1920" de la referencia) */
  function yearItem(S, p, o) {
    const col = o.color || S.ctx.C.palette.year || "#7c2b37";
    return S.add({
      x: o.x, y: o.y, z: o.z ?? 0.02, t0: o.t0 ?? 0.5, din: 0.7, enter: "fade",
      draw(g, lt) {
        let year = o.text;
        if (o.from != null && /^\d+$/.test(String(o.text))) { const q = prog(lt, (o.t0 ?? 0.5) + 0.3, o.count || 1.6, "inOut"); year = String(Math.round(lerp(+o.from, +o.text, q))); }
        const sz = (o.size || 6.6) * S.pk;
        txt(g, year, 0, 0, { size: sz, weight: 600, color: col, align: o.align || "left" });
        if (o.small) txt(g, o.small, (o.align === "right" ? -0.02 : 0.01), -sz * 0.0105, { size: sz * 0.46, weight: 600, color: col, align: o.align || "left" });
        if (o.below) txt(g, o.below, 0.004, sz * 0.0058, { size: sz * 0.42, weight: 600, color: col, align: o.align || "left" });
      },
    });
  }

  /* ------------------------------------------------------------ relleno: el collage denso de fondo */
  function filler(S, n = 12, o = {}) {
    const { F, r } = S, srcs = [...K.loaded.keys()];
    const ext = o.ext || [1.55, 1.0];
    for (let i = 0; i < n; i++) {
      const x = (r() * 2 - 1) * ext[0], y = (r() * 2 - 1) * ext[1], kind = r(), rot = (r() - 0.5) * 0.08;
      if (o.avoid && Math.abs(x) < o.avoid[0] && Math.abs(y) < o.avoid[1]) { i--; if (r() < 0.04) break; continue; }
      if (kind < 0.5 || !srcs.length) {
        const w = 0.32 + r() * 0.28, k = clipping(F, { seed: (r() * 1e6) | 0, w: 420, h: Math.round(420 * (0.6 + r() * 0.9)), title: r() < 0.6 ? para(F, r, 2 + (r() * 3 | 0)).toUpperCase() : "", red: r() < 0.3, cols: 2 + (r() < 0.3), photo: r() < 0.45 && srcs.length ? { src: srcs[(r() * srcs.length) | 0], tone: ["bw", "teal", "rose", "sepia"][(r() * 4) | 0], ar: 1.4 + r() * 0.4, focus: [r(), 0.4] } : null });
        S.add({ x, y, rot, z: -0.04, enter: "none", draw: g => drawCard(g, k, w) });
      } else if (kind < 0.85) {
        const src = srcs[(r() * srcs.length) | 0], w = 0.22 + r() * 0.24, k = card(F, src, { tone: ["bw", "teal", "rose", "sepia", "color"][(r() * 5) | 0], ar: [0.75, 1.3, 1.5][(r() * 3) | 0], focus: [0.2 + r() * 0.6, 0.3 + r() * 0.4], zoom: 1 + r() * 0.6, size: 380, border: r() < 0.5 ? 0.04 : 0 });
        S.add({ x, y, rot, z: -0.03, enter: "none", draw: g => drawCard(g, k, w) });
      } else if (kind < 0.94) {
        const src = srcs[(r() * srcs.length) | 0], k = stamp(F, src, (r() * 1e5) | 0), w = 0.12 + r() * 0.04;
        S.add({ x, y, rot: (r() - 0.5) * 0.3, z: -0.02, enter: "none", draw: g => drawCard(g, k, w) });
      } else {
        const k = coin(F, (r() * 1e5) | 0, ["1961", "1989", "1990", "10"][(r() * 4) | 0]), w = 0.09 + r() * 0.04;
        S.add({ x, y, rot: r() * 6, z: 0.04, enter: "none", draw: g => drawCard(g, k, w) });
      }
    }
  }

  /* ------------------------------------------------------------ familia: lente global */
  K.family("collage", {
    setup(ctx) {
      const F = { cache: new Map(), boost: [], grade: 1, dof: 1, vig: 1, leakBase: 1, grain: ctx.C.collage?.grain ?? 0.2 };
      F.words = wordsFrom(ctx);
      F.paper = makePaper(F, 11);
      F.paperLight = makePaper(F, 23, { base: "#eee5dc", text: false, size: 512 });
      F.skyDark = makeSky(5, false); F.skyWarm = makeSky(5, true);
      F.pages = [makePage(F, 3, false), makePage(F, 4, true)];
      F.blob = makeBlob(); F.bokehRed = makeBokeh([235, 80, 50]); F.bokehLight = makeBokeh([200, 235, 240]); F.bokehGold = makeBokeh([255, 210, 150]);
      F.petals = [makePetal(1), makePetal(2), makePetal(3)];
      F.noise = [0, 1, 2, 3].map(s => { const c = mk(256, 256), g = c.getContext("2d"), id = g.createImageData(256, 256), r = K.rng(900 + s); for (let i = 0; i < 65536; i++) { const v = 128 + (r() - 0.5) * 255 * (r() < 0.5 ? 0.6 : 1); id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255; } g.putImageData(id, 0, 0); return c; });
      F.smokeN = noise(192, 108, 77, 5, 3); F.smokeC = mk(192, 108); F.smokeId = F.smokeC.getContext("2d").createImageData(192, 108); F.smokeT = mk(4, 4);
      for (let i = 0; i < F.smokeId.data.length; i += 4) { F.smokeId.data[i] = F.smokeId.data[i + 1] = F.smokeId.data[i + 2] = 0; }
      F.grainPat = F.noise.map(c => ctx.g.main.createPattern(c, "repeat"));
      sizeLens(ctx, F);
      if (!document.getElementById("collage-css")) {
        const s = document.createElement("style"); s.id = "collage-css";
        s.textContent = `[data-family="collage"] .k-cap{font-family:'Cormorant Garamond',Georgia,serif;font-weight:600;color:rgba(255,246,240,.74);letter-spacing:.01em;font-size:clamp(16px,3.9vmin,50px);text-shadow:0 1px 2px rgba(40,10,20,.8),0 0 22px rgba(40,10,20,.65)}
[data-family="collage"] .k-w-cur{color:#fffaf4;font-weight:700}`;
        document.head.appendChild(s);
      }
      return F;
    },
    resize(ctx, F) { sizeLens(ctx, F); F.cache.clear(); },
    frame(t, ctx, F) {
      F.boost.length = 0; F.grade = 1; F.dof = 1; F.vig = 1; F.leakBase = 1;
      const { g, stage } = ctx; g.bg.fillStyle = "#14191c"; g.bg.fillRect(0, 0, stage.W, stage.H);
    },
    post(t, ctx, F) {
      const g = ctx.g.main, { W, H } = ctx.stage, dpr = ctx.dpr;
      g.save(); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.globalAlpha = 1; g.filter = "none";
      /* 1 · profundidad de campo: bordes desenfocados (copia reducida + máscara elíptica) */
      if (F.dof > 0.02) {
        const s1 = F.lensS, s1g = s1.getContext("2d"), s2 = F.lensT, s2g = s2.getContext("2d");
        s1g.globalCompositeOperation = "copy"; s1g.filter = "blur(2.5px)"; s1g.drawImage(ctx.layers.main, 0, 0, s1.width, s1.height); s1g.filter = "none";
        s2g.globalCompositeOperation = "copy"; s2g.imageSmoothingQuality = "high"; s2g.drawImage(s1, 0, 0, s2.width, s2.height);
        s2g.globalCompositeOperation = "destination-in"; s2g.drawImage(F.lensM, 0, 0, s2.width, s2.height); s2g.globalCompositeOperation = "source-over";
        g.globalAlpha = Math.min(1, F.dof); g.drawImage(s2, 0, 0, W, H); g.globalAlpha = 1;
      }
      /* 2 · grade: altas rosadas, sombras levantadas hacia verde azulado */
      const gr = F.grade;
      if (gr > 0.01) {
        g.globalCompositeOperation = "overlay"; g.globalAlpha = 0.32 * gr; g.drawImage(ctx.layers.main, 0, 0, W, H);
        g.globalCompositeOperation = "soft-light"; g.globalAlpha = 0.42 * gr; g.fillStyle = "#d48c8a"; g.fillRect(0, 0, W, H);
        g.globalCompositeOperation = "screen"; g.globalAlpha = 0.34 * gr; g.fillStyle = "#1a2a2e"; g.fillRect(0, 0, W, H);
        g.globalCompositeOperation = "multiply"; g.globalAlpha = 0.22 * gr; g.fillStyle = "#f2d4cf"; g.fillRect(0, 0, W, H);
      }
      /* 3 · fugas de luz cálidas (siempre en movimiento) + refuerzos de transición */
      g.globalCompositeOperation = "screen"; g.globalAlpha = 1;
      const L = F.leakBase * gr, M = Math.max(W, H);
      const leaks = [
        { col: [255, 92, 72], a: L * clamp(0.1 + 0.1 * Math.sin(t * 0.31) + 0.08 * Math.sin(t * 0.73 + 2)), x: 0.02 + 0.05 * Math.sin(t * 0.2), y: 0.78, r: 0.62 },
        { col: [255, 170, 110], a: L * clamp(0.06 + 0.1 * Math.sin(t * 0.27 + 1.3)), x: 0.98, y: 0.22 + 0.08 * Math.sin(t * 0.17), r: 0.55 },
        { col: [220, 90, 200], a: L * clamp(0.02 + 0.1 * Math.sin(t * 0.19 + 4)), x: 0.12, y: 0.12, r: 0.5 },
        ...F.boost,
      ];
      for (const l of leaks) {
        if (!(l.a > 0.01)) continue;
        const x = l.x * W, y = l.y * H, R = l.r * M, grd = g.createRadialGradient(x, y, 0, x, y, R);
        grd.addColorStop(0, rgba(l.col, Math.min(1, l.a))); grd.addColorStop(0.45, rgba(l.col, Math.min(1, l.a) * 0.5)); grd.addColorStop(1, rgba(l.col, 0));
        g.fillStyle = grd; g.fillRect(0, 0, W, H);
      }
      /* 4 · viñeta */
      if (F.vig > 0.01) { g.globalCompositeOperation = "multiply"; g.globalAlpha = Math.min(1, F.vig); g.drawImage(F.lensV, 0, 0, W, H); }
      /* 5 · grano de película (cambia cada cuadro de 25 fps) */
      const fr = Math.floor(t * 25), pt = F.grainPat[fr % 4], rr = K.rng(fr + 1);
      pt.setTransform(new DOMMatrix().translateSelf(rr() * 256, rr() * 256).scaleSelf(0.75));
      g.globalCompositeOperation = "overlay"; g.globalAlpha = F.grain; g.fillStyle = pt; g.fillRect(0, 0, W, H);
      g.restore();
    },
  });
  function sizeLens(ctx, F) {
    const { W, H } = ctx.stage;
    F.lensS = mk(W / 4, H / 4); F.lensT = mk(W / 2, H / 2);
    const m = mk(256, 256 * H / W), mg = m.getContext("2d"); mg.setTransform(1, 0, 0, H / W, 0, 0);
    const gr = mg.createRadialGradient(128, 128, 0, 128, 128, 182); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(0.5, "rgba(0,0,0,0)"); gr.addColorStop(0.78, "rgba(0,0,0,.75)"); gr.addColorStop(1, "#000");
    mg.fillStyle = gr; mg.fillRect(0, 0, 256, 256 * W / H); F.lensM = m;
    const v = mk(256, 256 * H / W), vg = v.getContext("2d"); vg.setTransform(1, 0, 0, H / W, 0, 0);
    const g2 = vg.createRadialGradient(128, 128, 40, 128, 128, 190); g2.addColorStop(0, "#ffffff"); g2.addColorStop(0.55, "#f6eeee"); g2.addColorStop(1, "#5e4a52");
    vg.fillStyle = g2; vg.fillRect(0, 0, 256, 256 * W / H); F.lensV = v;
  }

  K.collage = { POST, cput, mk, rgb, rgba, bell, noise, para, column, wrap, makePaper, toned, crop, card, drawCard, cardH, clipping, stamp, coin, scene, common, txt, measure, yearItem, filler, TONES, MOVES, TIN };
})();
