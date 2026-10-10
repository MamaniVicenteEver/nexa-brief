/* =============================================================================
   periodico · runtime de la familia "TITULARES" (cámara que vuela sobre un periódico)
   -----------------------------------------------------------------------------
   Réplica del estilo "Newspaper opener": un periódico infinito, monocromo con virado
   magenta en zonas, fotos B/N con marco negro fino, títulos typewriter cuyas letras se
   aleatorizan (scramble) antes de asentarse y barras negras con subtítulo blanco.

   Cómo funciona (todo en canvas, todo función pura de t):
   · cada beat principal de la familia es una ESTACIÓN de la cámara en un mundo 2D
     infinito (papel). Entre estaciones la cámara viaja: "whip" (latigazo con desenfoque
     de movimiento), "glide" (paneo suave), "cut" o "intro" (rack focus inicial);
   · los componentes NO dibujan directo: en render() entregan "items" (funciones de dibujo
     en coordenadas locales de su estación, con profundidad p) con F.add(); el post() de la
     familia compone: papel (con profundidad de campo) → items con paralaje → desenfoque
     de movimiento según la velocidad de la cámara → luz, viñeta, virado magenta, grano;
   · todo se dibuja en la capa ctx.g.bg (los subtítulos DOM quedan arriba).
   Utilidades en Kit.periodico: scramble, tw, measure, titleBar, icon, photo, clipping,
   bracket, wrap, CAM (params de cámara comunes a todos los componentes).
   ========================================================================== */
(function () {
  const K = window.Kit, { clamp, lerp, ease } = K;
  const FT = "Cutive", FN = "'Old Standard TT'", FB = "'Libre Caslon Text'";
  for (const f of ["400 40px Cutive", "400 20px 'Old Standard TT'", "700 20px 'Old Standard TT'", "italic 400 20px 'Old Standard TT'", "700 40px 'Libre Caslon Text'"]) K.fonts.add(f);

  /* texto propio para el papel de fondo (genérico: sirve para cualquier tema) */
  const NEWS = ("La ciudad despertó temprano y nadie sabía todavía lo que traería la noche. " +
    "En los cafés del centro se hablaba de trenes, de cartas y de viejos amigos que se habían ido. " +
    "El concejo resolvió ayer ampliar el horario de los tranvías durante el invierno. " +
    "Los vecinos del barrio norte piden faroles nuevos y una plaza con bancos de madera. " +
    "Se espera lluvia moderada hacia el fin de semana y vientos del sur por la tarde. " +
    "La orquesta municipal ofrecerá un concierto gratuito el domingo en el parque mayor. " +
    "Un lector escribe que la memoria de un pueblo vive en sus periódicos y en sus calles. " +
    "La feria del libro recibió más visitantes que nunca y agotó varias ediciones antiguas. " +
    "El puerto informó la llegada de tres barcos con café, harina y maquinaria agrícola. " +
    "Los precios del pan se mantienen estables según la cámara de comerciantes local. " +
    "Mañana se inaugura la nueva biblioteca con más de veinte mil volúmenes donados. " +
    "Hay noticias que tardan años en escribirse y otras que cambian todo en una sola noche.").split(" ");
  const HEADS = ["NOTICIAS DE LA CIUDAD", "EDICIÓN DE LA MAÑANA", "AVISO IMPORTANTE", "CRÓNICA LOCAL", "ÚLTIMA HORA",
    "EL TIEMPO", "CARTAS DEL LECTOR", "VIDA CULTURAL", "LA SEMANA EN BREVE", "ECONOMÍA Y PUERTO", "MEMORIA"];
  const BIG = ["la noche que todo cambió", "nadie lo esperaba así", "y la ciudad despertó", "una historia de papel",
    "lo que no se dijo", "el día siguiente llegó", "todos lo leyeron"];

  /* ------------------------------------------------------------- utilidades */
  const mkCanvas = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
  const hr = (a, b) => (K.hash(a + ":" + b) % 100000) / 100000;          /* azar puro (determinista) */
  const MC = mkCanvas(4, 4).getContext("2d");
  function measure(str, font) { MC.font = font; return MC.measureText(str).width; }

  /* scramble: cada letra no asentada muestra una letra al azar (cambia ~rate veces/s);
     se asientan de izquierda a derecha entre start y start+dur */
  const LOW = "abcdefghijklmnopqrstuvwxyz", UP = LOW.toUpperCase(), DIG = "0123456789";
  function scramble(str, lt, start = 0, dur = 1.6, seed = 1, rate = 18) {
    const ch = [...String(str)], n = ch.length, f = Math.floor(lt * rate);
    let out = "";
    for (let i = 0; i < n; i++) {
      const c = ch[i];
      const settle = start + dur * (0.82 * (n > 1 ? i / (n - 1) : 0) + 0.18 * hr(seed, i));
      if (lt >= settle) { out += c; continue; }
      const r = hr(seed * 7 + f, i);
      if (/\d/.test(c)) out += DIG[Math.floor(r * 10)];
      else if (/\s/.test(c)) out += r < 0.55 ? " " : LOW[Math.floor(r * 26)];
      else if (c !== c.toLowerCase()) out += UP[Math.floor(r * 26)];
      else if (/[a-zñáéíóúü]/i.test(c)) out += r < 0.1 ? " " : LOW[Math.floor(r * 26)];
      else out += c;
    }
    return out;
  }
  /* typewriter (Cutive + un trazo del mismo color para darle el peso medio de la referencia) */
  function tw(g, str, x, y, fs, o = {}) {
    g.font = `${o.italic ? "italic " : ""}400 ${fs}px ${o.font || FT}`;
    g.textAlign = o.align || "left"; g.textBaseline = o.baseline || "alphabetic";
    g.fillStyle = o.color || "#141113";
    g.fillText(str, x, y);
    const sw = o.weight ?? 0.045;
    if (sw > 0) { g.lineWidth = fs * sw; g.strokeStyle = o.color || "#141113"; g.lineJoin = "round"; g.strokeText(str, x, y); }
  }
  /** texto "fuera de foco" o con estela: copias desplazadas con alfa (r = radio, sx = estela horizontal) */
  /** halo de papel claro detrás de un título (el spot de luz de la referencia lo separa del fondo) */
  function glow(g, x, y, rx, ry, a = 0.86) {
    g.save(); g.translate(x, y); g.scale(rx, ry);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
    gr.addColorStop(0, `rgba(236,233,237,${a})`); gr.addColorStop(0.55, `rgba(236,233,237,${a * 0.55})`); gr.addColorStop(1, "rgba(236,233,237,0)");
    g.fillStyle = gr; g.fillRect(-1, -1, 2, 2); g.restore();
  }
  function soft(g, str, x, y, fs, r, sx, o = {}) {
    if (r < 0.2 && Math.abs(sx) < 0.3) return tw(g, str, x, y, fs, o);
    const a0 = g.globalAlpha, offs = sx ? [-1, -0.66, -0.33, 0].map(f => [f * sx, 0]) : [[-r, 0], [r, 0], [0, -r], [0, r], [0, 0]];
    offs.forEach(([dx, dy], i) => { g.globalAlpha = a0 * (sx ? (i === 3 ? 1 : 0.22) : 0.3); tw(g, str, x + dx, y + dy, fs, o); });
    g.globalAlpha = a0;
  }
  /* corta un párrafo en renglones de ancho máximo w */
  function wrap(str, font, w) {
    const out = []; let cur = "";
    for (const para of String(str).split("\n")) {
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const t = cur ? cur + " " + word : word;
        if (cur && measure(t, font) > w) { out.push(cur); cur = word; } else cur = t;
      }
      out.push(cur); cur = "";
    }
    return out.filter((l, i) => l || i < out.length - 1);
  }

  /* --------------------------------------------------------------- papel */
  /** genera el mosaico de periódico (se repite sin costuras en x e y) */
  function makePaper(S, dpr, seed) {
    const T = S * 2.4, px = Math.round(Math.min(2800, T * dpr)), k = px / T;
    const c = mkCanvas(px, px), g = c.getContext("2d"), r = K.rng(seed);
    g.scale(k, k);
    g.fillStyle = "#cdcacd"; g.fillRect(0, 0, T, T);
    /* manchas de papel viejo */
    for (let i = 0; i < 60; i++) {
      const x = r() * T, y = r() * T, rad = S * (0.08 + r() * 0.3), dark = r() < 0.5;
      for (const ox of [-T, 0, T]) for (const oy of [-T, 0, T]) {
        const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
        gr.addColorStop(0, dark ? "rgba(60,50,58,0.07)" : "rgba(255,255,255,0.10)"); gr.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = gr; g.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
      }
    }
    const ink = "rgba(22,18,21,0.92)";
    /* dibuja en (x,y) y repite si cruza un borde (mosaico sin costura) */
    const put = (fn, x, y, w, h) => { for (const ox of [0, x + w > T ? -T : 0].filter((v, i) => i === 0 || v)) for (const oy of [0, y + h > T ? -T : 0].filter((v, i) => i === 0 || v)) fn(x + ox, y + oy); };
    const cols = 6, colW = T / cols, gut = colW * 0.07, fs = S * 0.0135, lh = fs * 1.24;
    /* bloques de texto grande (renglones enormes de la referencia) y avisos con recuadro */
    const bigBlocks = [
      { c0: 0, c1: 3, y0: T * 0.06, lines: 3, fs: S * 0.058 },
      { c0: 3, c1: 6, y0: T * 0.55, lines: 3, fs: S * 0.05 },
      { c0: 1, c1: 4, y0: T * 0.86, lines: 2, fs: S * 0.072 },
    ];
    const reserved = []; let wi = Math.floor(r() * NEWS.length);
    const nextWord = () => NEWS[(wi++) % NEWS.length];
    bigBlocks.forEach((b, bi) => {
      const x = b.c0 * colW + gut / 2, w = (b.c1 - b.c0) * colW - gut, h = b.lines * b.fs * 1.12 + b.fs * 0.4;
      reserved.push({ c0: b.c0, c1: b.c1, y0: b.y0, y1: b.y0 + h });
      g.font = `700 ${b.fs}px ${FB}`; g.fillStyle = "rgba(22,18,21,0.72)"; g.textBaseline = "alphabetic";
      for (let l = 0; l < b.lines; l++) {
        let s = BIG[(bi * 3 + l) % BIG.length];
        while (measure(s + " " + BIG[(l + 2) % BIG.length].split(" ")[0], g.font) < w) s += " " + BIG[(l + bi + s.length) % BIG.length].split(" ")[(l + s.length) % 3];
        while (measure(s, g.font) > w && s.includes(" ")) s = s.slice(0, s.lastIndexOf(" "));
        const yy = b.y0 + b.fs * (1 + l * 1.12);
        put((X, Y) => g.fillText(s, X, Y), x, yy - b.fs, w, b.fs * 1.3);
      }
    });
    for (let ci = 0; ci < cols; ci++) {
      const x = ci * colW + gut / 2, w = colW - gut;
      let y = r() * T * 0.05;
      while (y < T) {
        const res = reserved.find(b => ci >= b.c0 && ci < b.c1 && y + lh > b.y0 && y < b.y1);
        if (res) { y = res.y1 + lh; continue; }
        const kind = r();
        if (kind < 0.16) {                                   /* titular en versalitas, centrado */
          const hs = fs * (1.35 + r() * 0.6), n = 1 + Math.floor(r() * 2);
          g.font = `700 ${hs}px ${FN}`; g.textAlign = "center"; g.fillStyle = ink;
          for (let l = 0; l < n; l++) {
            let s = HEADS[Math.floor(r() * HEADS.length)];
            while (measure(s, g.font) > w && s.includes(" ")) s = s.slice(0, s.lastIndexOf(" "));
            put((X, Y) => g.fillText(s, X + w / 2, Y + hs), x, y, w, hs * 1.2);
            y += hs * 1.15;
          }
          g.textAlign = "left"; y += lh * 0.6;
          g.fillRect(x + w * 0.3, y - lh * 0.3, w * 0.4, Math.max(0.6, S * 0.0012));
        } else if (kind < 0.24) {                            /* aviso en recuadro */
          const n = 4 + Math.floor(r() * 5), h = (n + 2) * lh;
          g.strokeStyle = ink; g.lineWidth = S * 0.002;
          put((X, Y) => g.strokeRect(X + w * 0.04, Y, w * 0.92, h), x, y, w, h);
          g.font = `700 ${fs * 1.2}px ${FN}`; g.fillStyle = ink; g.textAlign = "center";
          const hd = HEADS[Math.floor(r() * HEADS.length)];
          put((X, Y) => g.fillText(hd, X + w / 2, Y + lh * 1.3), x, y, w, lh * 2);
          g.textAlign = "left"; g.font = `400 ${fs * 0.95}px ${FN}`;
          for (let l = 0; l < n; l++) { let s = ""; while (measure(s + " " + NEWS[wi % NEWS.length], g.font) < w * 0.8) s += (s ? " " : "") + nextWord(); const yy = y + lh * (2.4 + l); put((X, Y) => g.fillText(s, X + w * 0.1, Y + fs), x, yy, w, lh); }
          y += h + lh;
        } else {                                             /* párrafo de cuerpo, justificado */
          const n = 5 + Math.floor(r() * 16);
          g.font = `400 ${fs}px ${FN}`; g.fillStyle = ink;
          for (let l = 0; l < n && y < T; l++) {
            if (reserved.find(b => ci >= b.c0 && ci < b.c1 && y + lh > b.y0 && y < b.y1)) break;
            const words = []; let wsum = 0;
            while (true) { const wd = nextWord(), ww = measure(wd, g.font); if (words.length && wsum + ww + words.length * fs * 0.25 > w) { wi--; break; } words.push(wd); wsum += ww; }
            const last = l === n - 1, gap = last ? fs * 0.28 : (w - wsum) / Math.max(1, words.length - 1);
            const yy = y;
            put((X, Y) => { let xx = X + (l === 0 ? fs : 0); for (const wd of words) { g.fillText(wd, xx, Y + fs); xx += measure(wd, g.font) + gap; } }, x, yy, w, lh);
            y += lh;
          }
          y += lh * 0.7;
        }
      }
      /* filete vertical entre columnas */
      g.fillStyle = "rgba(22,18,21,0.55)"; g.fillRect((ci + 1) * colW - S * 0.0006, 0, Math.max(0.5, S * 0.0012), T);
    }
    /* imperfección de impresión: motas de papel encima de la tinta + grano */
    for (let i = 0; i < 9000; i++) { g.fillStyle = r() < 0.7 ? "rgba(216,213,217,0.55)" : "rgba(30,25,28,0.18)"; const s = S * 0.0012 * (0.5 + r()); g.fillRect(r() * T, r() * T, s, s); }
    return { c, T };
  }
  /** versión desenfocada del mosaico (se desenfoca con los vecinos para no dejar bordes) */
  function blurTile(src, px, sc = 1) {
    const c = mkCanvas(src.width * sc, src.height * sc), g = c.getContext("2d"), n = src.width;
    g.scale(sc, sc); g.filter = `blur(${px * sc}px)`;
    for (const ox of [-n, 0, n]) for (const oy of [-n, 0, n]) g.drawImage(src, ox, oy);
    return c;
  }
  function noiseTiles(seed) {
    const r = K.rng(seed), out = [];
    for (let v = 0; v < 4; v++) {
      const c = mkCanvas(192, 192), g = c.getContext("2d"), im = g.createImageData(192, 192);
      for (let i = 0; i < im.data.length; i += 4) { const n = 128 + (r() - 0.5) * 150; im.data[i] = im.data[i + 1] = im.data[i + 2] = n; im.data[i + 3] = 255; }
      g.putImageData(im, 0, 0); out.push(c);
    }
    return out;
  }

  /* --------------------------------------------------------------- fotos */
  /** foto en B/N con contraste alto y borde interior oscurecido (cacheada por src) */
  function monoOf(F, src) {
    if (F.mono.has(src)) return F.mono.get(src);
    const im = F.ctx.img(src); if (!im) return null;            /* sin caché: puede llegar después (fondo de una intro) */
    const sc = Math.min(1, 1400 / Math.max(im.width, im.height)), w = im.width * sc, h = im.height * sc;
    const c = mkCanvas(w, h), g = c.getContext("2d");
    g.filter = "grayscale(1) contrast(1.28) brightness(0.96)"; g.drawImage(im, 0, 0, c.width, c.height); g.filter = "none";
    F.mono.set(src, c);
    return c;
  }
  /** recorte "cover" con punto de interés */
  function cover(img, w, h, fx = 0.5, fy = 0.5, z = 1) {
    const ar = w / h, iar = img.width / img.height;
    let sw = img.width, sh = img.height;
    if (iar > ar) sw = sh * ar; else sh = sw / ar;
    sw /= z; sh /= z;
    return [clamp(fx * img.width - sw / 2, 0, img.width - sw), clamp(fy * img.height - sh / 2, 0, img.height - sh), sw, sh];
  }
  /** contorno irregular del marco (foto impresa): puntos cacheados por tamaño */
  function raggedRect(g, x, y, w, h, rad, seed) {
    const n = 22, j = rad * 0.35;
    g.beginPath();
    const pts = [];
    for (let i = 0; i < n; i++) pts.push([x + rad + (w - 2 * rad) * i / n, y + (hr(seed, i) - 0.5) * j]);
    pts.push([x + w - rad * 0.3, y + rad * 0.3]);
    for (let i = 0; i < n; i++) pts.push([x + w + (hr(seed + 1, i) - 0.5) * j, y + rad + (h - 2 * rad) * i / n]);
    pts.push([x + w - rad * 0.3, y + h - rad * 0.3]);
    for (let i = 0; i < n; i++) pts.push([x + w - rad - (w - 2 * rad) * i / n, y + h + (hr(seed + 2, i) - 0.5) * j]);
    pts.push([x + rad * 0.3, y + h - rad * 0.3]);
    for (let i = 0; i < n; i++) pts.push([x + (hr(seed + 3, i) - 0.5) * j, y + h - rad - (h - 2 * rad) * i / n]);
    pts.push([x + rad * 0.3, y + rad * 0.3]);
    pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]));
    g.closePath();
  }
  /**
   * Foto con marco negro fino y sombra (coordenadas locales).
   * o = { fx, fy, z (zoom interior), k (px de dispositivo por unidad: para la sombra), S, seed, shadow, tone }
   */
  function paintPhoto(F, g, src, x, y, w, h, o = {}) {
    const S = o.S, img = monoOf(F, src), bw = S * 0.0062, rad = S * 0.009, k = o.k || 1;
    g.save();
    if (o.shadow !== false) {
      g.shadowColor = "rgba(10,6,9,0.55)"; g.shadowBlur = S * 0.045 * k; g.shadowOffsetX = S * 0.004 * k; g.shadowOffsetY = S * 0.014 * k;
      g.fillStyle = "#1a1618"; g.beginPath(); g.roundRect(x, y, w, h, rad); g.fill();
      g.shadowColor = "transparent";
    }
    g.save(); g.beginPath(); g.roundRect(x + bw * 0.5, y + bw * 0.5, w - bw, h - bw, rad * 0.7); g.clip();
    if (img) { const [sx, sy, sw, sh] = cover(img, w, h, o.fx ?? 0.5, o.fy ?? 0.45, o.z ?? 1); g.drawImage(img, sx, sy, sw, sh, x, y, w, h); }
    else { g.fillStyle = "#777"; g.fillRect(x, y, w, h); }
    /* borde interior oscuro (foto impresa) */
    const ig = g.createLinearGradient(x, 0, x + w, 0);
    ig.addColorStop(0, "rgba(10,8,10,0.45)"); ig.addColorStop(0.06, "rgba(10,8,10,0)"); ig.addColorStop(0.94, "rgba(10,8,10,0)"); ig.addColorStop(1, "rgba(10,8,10,0.45)");
    g.fillStyle = ig; g.fillRect(x, y, w, h);
    const jg = g.createLinearGradient(0, y, 0, y + h);
    jg.addColorStop(0, "rgba(10,8,10,0.4)"); jg.addColorStop(0.08, "rgba(10,8,10,0)"); jg.addColorStop(0.9, "rgba(10,8,10,0)"); jg.addColorStop(1, "rgba(10,8,10,0.5)");
    g.fillStyle = jg; g.fillRect(x, y, w, h);
    g.restore();
    g.strokeStyle = "#121012"; g.lineWidth = bw; g.lineJoin = "round";
    raggedRect(g, x, y, w, h, rad, o.seed ?? 3); g.stroke();
    g.restore();
  }
  /** recorte de periódico (pedazo de papel con su propio texto, marco y sombra) */
  function paintClipping(F, g, x, y, w, h, o = {}) {
    const S = o.S, k = o.k || 1, P = F.paper;
    g.save();
    g.shadowColor = "rgba(10,6,9,0.45)"; g.shadowBlur = S * 0.035 * k; g.shadowOffsetY = S * 0.01 * k;
    g.fillStyle = "#dedbdf"; g.fillRect(x, y, w, h); g.shadowColor = "transparent";
    if (P) {
      const sk = P.c.width / P.T, sx = ((o.sx ?? 0.3) * P.T) * sk, sy = ((o.sy ?? 0.3) * P.T) * sk;
      g.drawImage(P.c, sx, sy, Math.min(w * (o.zoom ?? 1) * sk, P.c.width - sx), Math.min(h * (o.zoom ?? 1) * sk, P.c.height - sy), x, y, w, h);
    }
    if (o.border !== false) { g.strokeStyle = "#151214"; g.lineWidth = S * 0.005; g.strokeRect(x, y, w, h); }
    g.restore();
  }

  /* ------------------------------------------------------------- tarjetas horneadas
     Sombra, marco y desenfoque de profundidad son CAROS en canvas por software: cada foto o
     recorte se pinta UNA vez en un canvas propio (con su sombra y su blur) y después cada
     cuadro es un solo drawImage. Cache LRU acotada. */
  function card(F, key, w, h, S, blurL, paint) {
    let c = F.cards.get(key);
    if (c) { F.cards.delete(key); F.cards.set(key, c); return c; }
    const k0 = F.ctx.dpr * 1.1, pad = S * 0.07 + blurL * 2.5;
    const cw = (w + 2 * pad) * k0, ch = (h + 2 * pad) * k0;
    let cv = mkCanvas(cw, ch); const g = cv.getContext("2d");
    g.scale(k0, k0); g.translate(pad, pad); paint(g, k0);
    if (blurL > 0.3) { const b2 = mkCanvas(cw, ch), g2 = b2.getContext("2d"); g2.filter = `blur(${(blurL * k0).toFixed(1)}px)`; g2.drawImage(cv, 0, 0); cv = b2; }
    c = { cv, pad }; F.cards.set(key, c);
    while (F.cards.size > 36) F.cards.delete(F.cards.keys().next().value);
    return c;
  }
  /** foto con marco negro fino y sombra; o = { S, seed, fx, fy, blur (unidades locales), shadow } */
  function photo(F, g, src, x, y, w, h, o = {}) {
    if (!F.ctx.img(src)) { paintPhoto(F, g, src, x, y, w, h, { ...o, k: F.ctx.dpr, z: 1, shadow: false }); return; }   /* aún sin cargar: no hornear el gris */
    const key = ["p", src, w | 0, h | 0, o.fx ?? 0.5, o.fy ?? 0.45, o.seed ?? 3, (o.blur || 0).toFixed(1), o.shadow !== false].join("|");
    const c = card(F, key, w, h, o.S, o.blur || 0, (cg, k0) => paintPhoto(F, cg, src, 0, 0, w, h, { ...o, k: k0, z: 1 }));
    g.drawImage(c.cv, x - c.pad, y - c.pad, w + 2 * c.pad, h + 2 * c.pad);
  }
  /** recorte de periódico horneado */
  function clipping(F, g, x, y, w, h, o = {}) {
    const key = ["c", w | 0, h | 0, o.sx ?? 0.3, o.sy ?? 0.3, o.zoom ?? 1, (o.blur || 0).toFixed(1), o.border !== false].join("|");
    const c = card(F, key, w, h, o.S, o.blur || 0, (cg, k0) => paintClipping(F, cg, 0, 0, w, h, { ...o, k: k0 }));
    g.drawImage(c.cv, x - c.pad, y - c.pad, w + 2 * c.pad, h + 2 * c.pad);
  }
  /** icono ⊠ (cuadro con cruz) centrado en (x,y) */
  function icon(g, x, y, s, o = {}) {
    g.save(); g.strokeStyle = o.color || "#141113"; g.lineWidth = s * (o.heavy ? 0.16 : 0.12); g.lineJoin = "miter";
    const h = s / 2; g.strokeRect(x - h, y - h, s, s);
    g.beginPath(); g.moveTo(x - h, y - h); g.lineTo(x + h, y + h); g.moveTo(x + h, y - h); g.lineTo(x - h, y + h); g.stroke();
    if (o.heavy) { g.lineWidth = s * 0.08; g.strokeRect(x - h * 0.55, y - h * 0.55, s * 0.55, s * 0.55); }
    g.restore();
  }
  /**
   * Título typewriter + barra negra con subtítulo blanco (el "lower third" de la referencia).
   * o = { x, y (línea base del título), align:"left"|"right", title, sub, lt, seed, S, barW, start }
   * Devuelve la caja {x0,x1,y0,y1}.
   */
  function titleBar(g, o) {
    const S = o.S, lt = o.lt, st = o.start ?? 0.1;
    let fs = o.fs || S * 0.074;
    if (o.maxW) fs = Math.min(fs, fs * o.maxW / Math.max(1, measure(o.title || "", `400 ${fs}px ${FT}`)));   /* nunca sobre la foto */
    const bh = S * 0.052, sfs = Math.min(S * 0.043, fs * 0.6);
    const title = scramble(o.title || "", lt, st + 0.15, o.dur ?? 1.5, o.seed || 1);
    const sub = scramble(o.sub || "", lt, st + 0.35, (o.dur ?? 1.5) * 0.9, (o.seed || 1) + 11);
    const right = o.align === "right";
    const tw0 = measure(o.title || "", `400 ${fs}px ${FT}`), sw0 = measure(o.sub || "", `400 ${sfs}px ${FT}`);
    const barW = Math.max(o.barW || 0, sw0 + S * 0.09, tw0 * 0.75);
    tw(g, title, o.x, o.y, fs, { align: right ? "right" : "left" });
    if (o.sub) {
      const q = ease.out(clamp((lt - st) / 0.5));
      const by = o.y + fs * 0.32, w = barW * q, bx = right ? o.x - w : o.x;
      g.fillStyle = "#161315"; g.fillRect(bx, by, w, bh);
      g.save(); g.beginPath(); g.rect(bx, by, w, bh); g.clip();
      tw(g, sub, right ? o.x - S * 0.035 : o.x + S * 0.04, by + bh * 0.76, sfs, { color: "#efecef", align: right ? "right" : "left", weight: 0.012 });
      g.restore();
      return { x0: right ? o.x - barW : o.x, x1: right ? o.x : o.x + barW, y0: o.y - fs, y1: by + bh };
    }
    return { x0: right ? o.x - tw0 : o.x, x1: right ? o.x : o.x + tw0, y0: o.y - fs, y1: o.y + fs * 0.25 };
  }

  /* --------------------------------------------------------------- cámara */
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0], upleft: [-0.75, -0.75], upright: [0.75, -0.75], downleft: [-0.75, 0.75], downright: [0.75, 0.75] };
  /* el recorrido avanza siempre hacia la derecha en promedio: la cámara nunca vuelve a pasar por una estación vieja */
  const AUTO = ["down", "right", "up", "downright", "right", "upright", "down", "right", "up", "right", "downright", "upright"];
  /* latigazo: arranca casi de golpe y frena largo (como el whip de la referencia) */
  const whipEase = q => { const q2 = q < 0.1 ? (q * q / 0.2) : q - 0.05; return 1 - Math.pow(1 - clamp(q2 / 0.95), 4); };
  const CAM = {
    move: { type: "enum", options: ["auto", "whip", "glide", "cut", "intro"], default: "auto", doc: "Cómo llega la cámara a este plano: whip = latigazo con desenfoque de movimiento; glide = paneo suave; cut = corte; intro = rack focus de apertura (auto = whip, o el propio del componente)." },
    dir: { type: "enum", options: ["auto", "up", "down", "left", "right", "upleft", "upright", "downleft", "downright"], default: "auto", doc: "Hacia dónde viaja la cámara para llegar (auto = patrón de la referencia)." },
  };

  function buildStations(ctx, F) {
    const mains = ctx.beats.filter(b => /^periodico\./.test(b.use) && b.layer === "main").sort((a, b) => a.t0 - b.t0);
    const st = []; let x = 0, y = 0, ai = 0;
    mains.forEach((b, i) => {
      const def = K.registry.get(b.use);
      let move = b.params?.move || "auto";
      if (i === 0) move = move === "intro" || (move === "auto" && def?.cam?.first === "intro") ? "intro" : "cut";
      else if (move === "auto") move = def?.cam?.move || "whip";
      let dir = b.params?.dir || "auto";
      if (dir === "auto") dir = move === "glide" ? (i % 2 ? "downright" : "right") : i === 0 ? "down" : AUTO[ai++ % AUTO.length];
      const [dx, dy] = DIRS[dir] || DIRS.down, dist = move === "glide" ? 0.46 : 1.32;
      if (i > 0) { x += dx * dist; y += dy * dist; }
      const r = K.rng(K.hash("st" + i));
      st.push({ b, i: b.i, t0: b.t0, fx: x, fy: y, move, dir: [dx, dy], tw: move === "glide" ? 1.5 : move === "whip" ? 0.95 : 0,
        drift: [(r() - 0.5) * 0.016, (r() - 0.5) * 0.012], z: 1 + (r() - 0.5) * 0.06, img: null });
    });
    F.st = st; F.byBeat = new Map(st.map(s => [s.i, s]));
    /* decorado del mundo: tarjetas en primer plano (desenfocadas) y fotos/recortes a mitad de camino */
    const pool = []; for (const b of ctx.beats) for (const [k, v] of Object.entries(b.params || {})) if (typeof v === "string" && /\.(jpe?g|png|webp)$/i.test(v) && !pool.includes(v)) pool.push(v);
    F.pool = pool;
    /* la última foto que se vio (el cierre la reutiliza, como la referencia cierra con una foto) */
    F.lastImg = null;
    for (const b of mains) if (!/\.outro$/.test(b.use)) for (const v of Object.values(b.params || {})) if (typeof v === "string" && /\.(jpe?g|png|webp)$/i.test(v)) F.lastImg = v;
    F.deco = [];
    st.forEach((s, i) => {
      const r = K.rng(K.hash("deco" + i)), src = pool.length ? pool[(i * 3 + 1) % pool.length] : null;
      if (s.move === "intro") return;
      /* tarjeta en primer plano (p 1.45, muy desenfocada) en un borde */
      const side = r() < 0.5 ? -1 : 1, bottom = r() < 0.6;
      F.deco.push({ si: i, kind: r() < 0.8 && src ? "photo" : "clip", src, sx: s.fx, sy: s.fy, p: 1.42, ox: side * (0.28 + r() * 0.12), oy: bottom ? 0.47 : -0.5, w: 0.42 + r() * 0.12, h: 0.3, seed: i });
      /* a mitad del viaje desde la estación anterior: foto o recorte apoyado en el papel */
      if (i > 0 && s.move === "whip") {
        const pr = st[i - 1], mx = (pr.fx + s.fx) / 2, my = (pr.fy + s.fy) / 2, n2 = r() < 0.5 ? 1 : -1;
        F.deco.push({ si: i, kind: src && r() < 0.6 ? "photo" : "clip", src: pool.length ? pool[(i * 5 + 2) % pool.length] : null, sx: mx, sy: my, p: 1.0, ox: -s.dir[1] * 0.18 * n2, oy: s.dir[0] * 0.2 * n2, w: 0.36, h: 0.27, seed: i + 50 });
        F.deco.push({ si: i, kind: "clip", sx: mx, sy: my, p: 1.0, ox: s.dir[1] * 0.3 * n2 + 0.05, oy: -s.dir[0] * 0.28 * n2 + 0.04, w: 0.3, h: 0.36, seed: i + 90 });
      }
    });
  }
  /** posición de reposo (con deriva lenta) de una estación en el instante t */
  function restPos(s, t, W, H) {
    const d = Math.max(0, t - s.t0);
    return { x: (s.fx + s.drift[0] * d) * W, y: (s.fy + s.drift[1] * d) * H, zoom: s.z * (1 + 0.011 * d) };
  }
  function camAt(F, t, W, H) {
    const st = F.st; if (!st.length) return { x: 0, y: 0, zoom: 1 };
    let i = 0; for (let k = 0; k < st.length; k++) if (st[k].t0 <= t) i = k;
    const s = st[i], base = restPos(s, t, W, H);
    if (i === 0 || s.move === "cut" || s.move === "intro" || !s.tw) return base;
    const q = (t - s.t0) / s.tw; if (q >= 1) return base;
    const prev = restPos(st[i - 1], t, W, H), e = s.move === "glide" ? ease.inOut(clamp(q)) : whipEase(clamp(q));
    const dip = s.move === "whip" ? 1 - 0.1 * Math.sin(Math.PI * clamp(q * 1.2)) : 1;     /* se aleja un poco a mitad del vuelo (sensación 3D) */
    return { x: lerp(prev.x, base.x, e), y: lerp(prev.y, base.y, e), zoom: lerp(prev.zoom, base.zoom, e) * dip, q, whip: s.move === "whip" };
  }

  /* --------------------------------------------------------------- estilos DOM */
  const style = document.createElement("style");
  style.textContent = `
[data-family="periodico"] .k-cap { font-family: Cutive, 'Courier New', serif; font-weight: 400; font-size: clamp(13px, 3.1vmin, 40px); text-shadow: none; color: #9d989c; }
[data-family="periodico"] .k-cap-line { background: #161315; padding: .16em .55em .12em; box-shadow: 0 .25em 1.2em rgba(0,0,0,.35); }
[data-family="periodico"] .k-w-cur { color: #f2eff2; font-weight: 400; }`;
  document.head.appendChild(style);

  /* --------------------------------------------------------------- runtime */
  K.family("periodico", {
    setup(ctx) {
      const F = { ctx, items: [], hints: [], mono: new Map(), cards: new Map(), st: [], deco: [], pool: [] };
      F.init = () => {
        const { W, H } = ctx.stage, S = Math.min(W, H), dpr = ctx.dpr;
        F.paper = makePaper(S, dpr, (ctx.C.seed ?? 1) * 13 + 5);
        const bpx = S * 0.0075 * (F.paper.c.width / F.paper.T);
        F.paperBlur = blurTile(F.paper.c, bpx, 0.5);
        F.noise = F.noise || noiseTiles(77);
        F.m = Math.round(Math.max(W, H) * 0.12);
        F.sc = mkCanvas((W + 2 * F.m) * dpr, (H + 2 * F.m) * dpr);
        F.mk = mkCanvas(F.sc.width / 2, F.sc.height / 2);
        F.size = W + "x" + H; F.cards.clear();
      };
      F.init();
      buildStations(ctx, F);
      /** API para componentes: entrega un item de dibujo en coordenadas locales de la estación del beat */
      F.add = (beat, p, draw, o = {}) => {
        const s = F.byBeat.get(beat.i); if (!s) return;
        F.items.push({ sx: s.fx, sy: s.fy, p, draw, blur: o.blur || 0, ord: F.items.length, alpha: o.alpha ?? 1 });
      };
      F.hint = h => F.hints.push(h);
      F.station = beat => F.byBeat.get(beat.i);
      F.cam = t => camAt(F, t, ctx.stage.W, ctx.stage.H);
      window.__periodico = F;            /* depuración: estaciones y cámara */
      return F;
    },
    resize(ctx, F) { F.init(); },
    frame(t, ctx, F) { F.items.length = 0; F.hints.length = 0; },
    post(t, ctx, F) {
      const { W, H } = ctx.stage, S = Math.min(W, H), dpr = ctx.dpr, m = F.m;
      if (F.size !== W + "x" + H) F.init();
      /* una intro o el cierre del canal tapan todo el cuadro (F.hint({cover:true})): no hace falta componer el periódico */
      if (F.hints.some(h => h.cover)) return;
      /* cámara + pistas de los componentes */
      const cam = camAt(F, t, W, H), H0 = { zoom: 1, blur: 0, fade: 0, focusR: 1, tint: 0, rot: 0, fx: 0.5, fy: 0.5 };
      for (const h of F.hints) {
        if (h.zoom) H0.zoom *= h.zoom; if (h.blur) H0.blur = Math.max(H0.blur, h.blur); if (h.fade) H0.fade = Math.max(H0.fade, h.fade);
        if (h.focusR) H0.focusR *= h.focusR; if (h.tint) H0.tint = Math.max(H0.tint, h.tint); if (h.rot) H0.rot += h.rot;
        if (h.dx) cam.x += h.dx * W; if (h.dy) cam.y += h.dy * H;
        if (h.focus) { H0.fx = h.focus[0]; H0.fy = h.focus[1]; }
      }
      const zoom = cam.zoom * H0.zoom;
      const sg = F.sc.getContext("2d"), SW = F.sc.width, SH = F.sc.height;
      sg.setTransform(1, 0, 0, 1, 0, 0); sg.globalCompositeOperation = "source-over"; sg.globalAlpha = 1; sg.filter = "none";
      sg.fillStyle = "#cfcbd0"; sg.fillRect(0, 0, SW, SH);
      /* papel: desenfocado en todo el cuadro + nítido dentro de la elipse de foco */
      const P = F.paper, Ts = P.T * zoom;
      const tiles = (g, img) => {
        const ox = m + W / 2 - cam.x * zoom, oy = m + H / 2 - cam.y * zoom;
        const x0 = ((ox % Ts) + Ts) % Ts - Ts, y0 = ((oy % Ts) + Ts) % Ts - Ts;
        for (let x = x0; x < W + 2 * m; x += Ts) for (let y = y0; y < H + 2 * m; y += Ts) g.drawImage(img, x * dpr, y * dpr, Ts * dpr + 1, Ts * dpr + 1);
      };
      tiles(sg, P.c);
      /* encima, el papel desenfocado a media resolución (el blur oculta la diferencia) con un
         agujero elíptico en el foco: barato y da la profundidad de campo de la referencia */
      const mg = F.mk.getContext("2d"), hk = F.mk.width / SW;
      mg.setTransform(hk, 0, 0, hk, 0, 0); mg.globalCompositeOperation = "source-over"; mg.clearRect(0, 0, SW, SH);
      tiles(mg, F.paperBlur);
      mg.globalCompositeOperation = "destination-out";
      const fcx = (m + W * H0.fx) * dpr, fcy = (m + H * H0.fy) * dpr, rx = W * 0.5 * H0.focusR * dpr, ry = H * 0.55 * H0.focusR * dpr;
      mg.setTransform(rx * hk, 0, 0, ry * hk, fcx * hk, fcy * hk);
      const rg = mg.createRadialGradient(0, 0, 0, 0, 0, 1);
      rg.addColorStop(0, "rgba(0,0,0,1)"); rg.addColorStop(0.42, "rgba(0,0,0,1)"); rg.addColorStop(1, "rgba(0,0,0,0)");
      mg.fillStyle = rg; mg.fillRect(-20, -20, 40, 40);
      mg.setTransform(1, 0, 0, 1, 0, 0); mg.globalCompositeOperation = "source-over";
      sg.drawImage(F.mk, 0, 0, SW, SH);
      /* decorado + items de los componentes, de lejos a cerca */
      const all = [];
      let ci = 0; F.st.forEach((s, k) => { if (s.t0 <= t) ci = k; });
      const leaving = F.st[ci] && t < F.st[ci].t0 + (F.st[ci].tw || 0);
      /* tarjetas de primer plano: solo las de la estación actual (y la anterior mientras la cámara se va);
         por el paralaje, las de estaciones vecinas caerían en medio del cuadro */
      const showDeco = d => d.p > 1.2 ? (d.si === ci || (leaving && d.si === ci - 1)) : Math.abs(d.si - ci) <= 1;
      for (const d of F.deco) if (showDeco(d)) all.push({ sx: d.sx, sy: d.sy, p: d.p, ord: -1, blur: d.p > 1.2 ? S * 0.011 : 0, alpha: 1, deco: d });
      for (const it of F.items) all.push(it);
      all.sort((a, b) => a.p - b.p || a.ord - b.ord);
      for (const it of all) {
        const s = zoom * it.p, X = m + W / 2 + (it.sx * W - cam.x) * s, Y = m + H / 2 + (it.sy * H - cam.y) * s;
        if (it.deco) {                    /* recorte fino: solo se dibuja lo que entra en cuadro */
          const r = decoRect(it.deco, W, H), pad = S * 0.12;
          if (X + (r.x + r.w + pad) * s < 0 || X + (r.x - pad) * s > W + 2 * m || Y + (r.y + r.h + pad) * s < 0 || Y + (r.y - pad) * s > H + 2 * m) continue;
        } else if (X < -2.2 * W * s || X > W + 2 * m + 2.2 * W * s || Y < -2.2 * H * s || Y > H + 2 * m + 2.2 * H * s) continue;
        sg.setTransform(dpr * s, 0, 0, dpr * s, dpr * X, dpr * Y);
        sg.globalAlpha = it.alpha;
        try { if (it.deco) drawDeco(F, sg, it.deco, W, H, S, it.blur); else it.draw(sg, dpr * s); } catch (e) { console.error("[periodico] item", e); }
        sg.globalAlpha = 1;
      }
      sg.setTransform(1, 0, 0, 1, 0, 0);

      /* salida: desenfoque de movimiento (promedio de copias desplazadas en la dirección del viaje) */
      const G = ctx.g.bg;
      G.save(); G.setTransform(1, 0, 0, 1, 0, 0);
      G.fillStyle = "#000"; G.fillRect(0, 0, W * dpr, H * dpr);
      const dt = 1 / 30, c0 = camAt(F, t - dt, W, H);
      const shutter = cam.whip === false ? 0.45 : 1;            /* el paneo suave casi no se barre */
      let vx = (cam.x - c0.x) * zoom * shutter, vy = (cam.y - c0.y) * zoom * shutter;
      const len = Math.hypot(vx, vy), maxL = m * 1.6;
      if (len > maxL) { vx *= maxL / len; vy *= maxL / len; }
      const n = len > 1.5 ? Math.min(24, Math.ceil(Math.min(len, maxL) / 2.5)) : 1;
      if (H0.blur > 0.2) G.filter = `blur(${(H0.blur * S / 100 * dpr).toFixed(1)}px)`;
      if (H0.rot) { G.translate(W * dpr / 2, H * dpr / 2); G.rotate(H0.rot); G.translate(-W * dpr / 2, -H * dpr / 2); }
      for (let i = 0; i < n; i++) {
        const f = n > 1 ? i / (n - 1) - 0.5 : 0;
        G.globalAlpha = 1 / (i + 1);
        G.drawImage(F.sc, (-m + f * vx) * dpr, (-m + f * vy) * dpr);
      }
      G.restore();
      G.save(); G.setTransform(1, 0, 0, 1, 0, 0);
      const Wd = W * dpr, Hd = H * dpr, D = Math.hypot(Wd, Hd);
      /* luz en el foco (el papel brilla en el centro, como un spot) */
      G.globalCompositeOperation = "screen";
      let gr = G.createRadialGradient(Wd * H0.fx, Hd * H0.fy * 0.95, 0, Wd * H0.fx, Hd * H0.fy, D * 0.38);
      gr.addColorStop(0, "rgba(255,250,255,0.42)"); gr.addColorStop(1, "rgba(255,255,255,0)");
      G.fillStyle = gr; G.fillRect(0, 0, Wd, Hd);
      /* virado magenta: manchas que derivan (y suben durante algunos latigazos) */
      G.globalCompositeOperation = "color";
      const whipT = cam.whip && cam.q < 1 ? Math.sin(Math.PI * cam.q) : 0;
      const blobs = [[0.13, 0.0, 0.34], [0.09, 2.1, 0.22], [0.05, 4.2, 0.28]];
      blobs.forEach(([sp, ph, a], bi) => {
        const bx = Wd * (0.5 + 0.62 * Math.sin(t * sp + ph)), by = Hd * (0.5 + 0.55 * Math.cos(t * sp * 1.3 + ph * 0.7));
        const al = clamp(a * (0.75 + 0.25 * Math.sin(t * 0.4 + bi)) + H0.tint + whipT * 0.35 * ((F.st.findIndex(s => s.t0 > t) + bi) % 2));
        const g2 = G.createRadialGradient(bx, by, 0, bx, by, D * 0.46);
        g2.addColorStop(0, `rgba(150,62,108,${al.toFixed(3)})`); g2.addColorStop(1, "rgba(150,62,108,0)");
        G.fillStyle = g2; G.fillRect(0, 0, Wd, Hd);
      });
      /* viñeta fuerte */
      G.globalCompositeOperation = "multiply";
      gr = G.createRadialGradient(Wd / 2, Hd / 2, D * 0.22, Wd / 2, Hd / 2, D * 0.62);
      gr.addColorStop(0, "rgb(255,255,255)"); gr.addColorStop(1, "rgb(70,64,70)");
      G.fillStyle = gr; G.fillRect(0, 0, Wd, Hd);
      /* grano de película (cambia con el cuadro) */
      G.globalCompositeOperation = "overlay"; G.globalAlpha = 0.2;
      const nt = F.noise[Math.floor(t * 24) % F.noise.length];
      G.fillStyle = G.createPattern(nt, "repeat"); G.fillRect(0, 0, Wd, Hd);
      G.globalAlpha = 1; G.globalCompositeOperation = "source-over";
      if (H0.fade > 0) { G.fillStyle = `rgba(0,0,0,${clamp(H0.fade).toFixed(3)})`; G.fillRect(0, 0, Wd, Hd); }
      G.restore();
    },
  });

  /** decorado del mundo (tarjetas/recortes) en coordenadas locales */
  function decoRect(d, W, H) {
    const w = d.w * Math.max(W, H) * (W > H ? 1 : 1.25), h = w * (d.kind === "clip" ? d.h / d.w : 0.66);
    return { x: d.ox * W - w / 2, y: d.oy * H - h / 2, w, h };
  }
  function drawDeco(F, g, d, W, H, S, blur) {
    const { x, y, w, h } = decoRect(d, W, H);
    if (d.kind === "photo" && d.src) photo(F, g, d.src, x, y, w, h, { S, blur, seed: d.seed, fx: 0.3 + (d.seed % 5) * 0.1 });
    else clipping(F, g, x, y, w, h, { S, blur, sx: 0.1 + (d.seed % 7) * 0.09, sy: 0.05 + (d.seed % 5) * 0.12 });
  }

  K.periodico = { scramble, tw, soft, glow, measure, wrap, titleBar, icon, photo, clipping, cover, monoOf, raggedRect, CAM, FT, FN, FB, NEWS, hr };
})();
