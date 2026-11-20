/* =============================================================================
   memorias · runtime de la familia "historia en acuarela" (réplica de la
   plantilla "Historical Memories · Watercolor Ink Slideshow")
   -----------------------------------------------------------------------------
   · Fondo: yeso/papel gris cálido con moteado y grietas finas, generado UNA vez.
   · Cada lugar nace como BOCETO A LÁPIZ (la misma foto pasada por "esquisse":
     gris / desenfoque invertido en color-dodge) dibujado con multiplicar sobre
     el papel; después la foto A COLOR florece por manchas de tinta, revienta una
     salpicadura de acuarela (azul, o negra en B/N) con gotas, y aparecen el
     bloque de texto (manuscrita + MAYÚSCULAS que se arman letra a letra) y un
     recorte de periódico fantasma.
   · post(): humo gris que barre el cuadro en cada corte con un destello frío,
     viñeta y grano. Todo es función pura de t (ctx.beats + t).
   Utilidades en Kit.memorias: scene(ctx, spec) arma un plano completo.
   ========================================================================== */
(function () {
  const K = window.Kit, { clamp, lerp, prog } = K;
  for (const f of ["400 40px 'Mr Dafoe'", "700 40px Barlow", "600 40px Barlow", "700 20px Quicksand", "500 20px Quicksand", "400 20px 'Old Standard TT'", "700 20px 'Old Standard TT'"]) K.fonts.add(f);

  const mine = b => typeof b.use === "string" && b.use.startsWith("memorias.") && b.layer !== "overlay";
  const ss = x => x * x * (3 - 2 * x);
  const ease4 = x => 1 - Math.pow(1 - clamp(x), 4);
  const bell = (t, c, w) => Math.exp(-Math.pow((t - c) / w, 2));
  const mkCanvas = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
  function hex(c) { const m = String(c).replace("#", ""); const v = parseInt(m.length === 3 ? m.split("").map(x => x + x).join("") : m, 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
  function rgba(c, a) { const [r, g, b] = hex(c); return `rgba(${r},${g},${b},${clamp(a).toFixed(3)})`; }

  /* ------------------------------------------------------------ ruido */
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
      const f = cells * Math.pow(2, o), gw = Math.ceil(f) + 1, gh = Math.ceil(f * mh / mw) + 1, n = lattice(seed * 7 + o * 131, gw, gh), k = f / mw;
      for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) out[y * mw + x] += amp * n(x * k, y * k);
      amp *= gain;
    }
    let lo = Infinity, hi = -Infinity;
    for (const v of out) { if (v < lo) lo = v; if (v > hi) hi = v; }
    for (let i = 0; i < out.length; i++) out[i] = (out[i] - lo) / (hi - lo || 1);
    return out;
  }

  /* ------------------------------------------------------------ campos de máscara */
  /** mancha: lóbulos elípticos (fracciones de la caja) + ruido → borde irregular */
  function fieldBlot(seed, mw, mh, lobes, rough = 0.45, cells = 3.4) {
    const n = fbm(seed, mw, mh, cells, 7, 0.62), f = new Float32Array(mw * mh);
    for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
      const nx = (x + 0.5) / mw, ny = (y + 0.5) / mh; let b = 0;
      for (const L of lobes) b = Math.max(b, 1 - Math.hypot((nx - L.x) / L.rx, (ny - L.y) / L.ry));
      const i = y * mw + x; f[i] = clamp(b) * (1 - rough) + n[i] * rough;
    }
    return f;
  }
  /** barrido direccional con ruido: from = left | right | top | bottom | center */
  function fieldDir(seed, mw, mh, from = "left", rough = 0.4, cells = 5) {
    const n = fbm(seed, mw, mh, cells, 4), f = new Float32Array(mw * mh);
    for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
      const nx = x / Math.max(1, mw - 1), ny = y / Math.max(1, mh - 1);
      const b = from === "right" ? nx : from === "top" ? 1 - ny : from === "bottom" ? ny : from === "center" ? 1 - Math.hypot(nx - 0.5, (ny - 0.5) * mh / mw) * 1.6 : 1 - nx;
      const i = y * mw + x; f[i] = clamp(b) * (1 - rough) + n[i] * rough;
    }
    return f;
  }
  /**
   * Salpicadura: radio que depende del ángulo (picos finos = las "puntas" de la mancha
   * de tinta que cae) + ruido de borde. Centro en la mitad de la caja.
   */
  function fieldSplat(seed, mw, mh, spikes = 24, rough = 0.3) {
    const r = K.rng(seed), n = fbm(seed + 5, mw, mh, 7, 6, 0.62), f = new Float32Array(mw * mh);
    const peaks = Array.from({ length: spikes }, () => ({ a: r() * Math.PI * 2, w: 0.012 + r() * 0.04, h: 0.03 + Math.pow(r(), 2.2) * 0.24 }));
    const wob = Array.from({ length: 5 }, (_, i) => ({ k: i + 2, p: r() * 7, h: 0.03 + r() * 0.05 }));
    for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
      const dx = (x + 0.5) / mw - 0.5, dy = (y + 0.5) / mh - 0.5, a = Math.atan2(dy, dx), d = Math.hypot(dx, dy) * 2;
      let R = 0.56;
      for (const w of wob) R += Math.sin(a * w.k + w.p) * w.h;
      for (const pk of peaks) { let da = Math.abs(a - pk.a); da = Math.min(da, Math.PI * 2 - da); R += pk.h * Math.exp(-Math.pow(da / pk.w, 2)); }
      /* fuera del radio cae a 0 (nunca toca el borde de la caja) */
      const i = y * mw + x, b = 1 - d / Math.min(R, 0.98);
      f[i] = b > 0 ? b * (1 - rough) + n[i] * rough + 0.12 : Math.max(0, b * 4 + n[i] * 0.2);
    }
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
  /** fuente × máscara: draw(G, x, y, w, h, th, alpha) en px CSS */
  function Reveal(src, mask) {
    const scr = mkCanvas(src.width, src.height), g = scr.getContext("2d");
    let ready = false;
    return {
      src, mask,
      draw(G, x, y, w, h, th, alpha = 1) {
        if (alpha <= 0.003) return;
        if (th <= -0.3) { G.globalAlpha = alpha; G.drawImage(src, x, y, w, h); G.globalAlpha = 1; return; }
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
  const thFull = (p, soft = 0.07) => lerp(1.0, -soft - 0.02, clamp(p));

  /* ------------------------------------------------------------ papel */
  /** yeso/papel gris cálido: moteado grande + fino, manchas de humedad y grietas finas */
  function makePaper(W, H, P, seed) {
    const s = 0.5, cw = Math.ceil(W * s), ch = Math.ceil(H * s), cv = mkCanvas(cw, ch), g = cv.getContext("2d");
    const big = fbm(seed, cw, ch, 2.4, 5, 0.55), fine = fbm(seed + 9, cw, ch, 70, 2, 0.6), damp = fbm(seed + 4, cw, ch, 5, 4, 0.5);
    const lo = hex(P.paper), hi = hex(P.paperHi || P.paper);
    const img = g.createImageData(cw, ch), d = img.data;
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const i = y * cw + x, c = clamp(1 - Math.hypot(x / cw - 0.5, (y / ch - 0.5) * 1.2) * 1.25);
      const m = (big[i] - 0.5) * 16 + (fine[i] - 0.5) * 18 - Math.max(0, damp[i] - 0.62) * 40;
      for (let k = 0; k < 3; k++) d[i * 4 + k] = clamp((lerp(lo[k], hi[k], c) + m) / 255) * 255;
      d[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    /* grietas finas: caminos quebrados que se ramifican */
    const r = K.rng(seed + 3); g.lineCap = "round"; g.lineJoin = "round";
    const crack = (x, y, a, len, w, depth) => {
      g.strokeStyle = `rgba(70,66,62,${0.16 + r() * 0.14})`; g.lineWidth = w; g.beginPath(); g.moveTo(x, y);
      const n = 10 + (r() * 10 | 0);
      for (let k = 0; k < n; k++) {
        a += (r() - 0.5) * 0.9; x += Math.cos(a) * len / n; y += Math.sin(a) * len / n; g.lineTo(x, y);
        if (depth < 2 && r() < 0.12) { g.stroke(); crack(x, y, a + (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.6), len * 0.45, w * 0.7, depth + 1); g.beginPath(); g.moveTo(x, y); g.strokeStyle = `rgba(70,66,62,${0.16 + r() * 0.14})`; g.lineWidth = w; }
      }
      g.stroke();
    };
    const M = Math.max(cw, ch);
    for (let i = 0; i < 5; i++) crack(r() * cw, r() * ch, r() * Math.PI * 2, M * (0.25 + r() * 0.35), 0.5 + r() * 0.5, 0);
    /* motas y fibras */
    for (let i = 0; i < 320; i++) { g.fillStyle = r() < 0.6 ? `rgba(60,56,52,${0.05 + r() * 0.12})` : `rgba(255,255,255,${0.1 + r() * 0.2})`; g.beginPath(); g.arc(r() * cw, r() * ch, 0.3 + r() * 1.1, 0, 7); g.fill(); }
    return cv;
  }
  function makeGrain(seed) {
    const r = K.rng(seed), tiles = [];
    for (let t = 0; t < 4; t++) {
      const cv = mkCanvas(256, 256), g = cv.getContext("2d"), img = g.createImageData(256, 256), d = img.data;
      for (let i = 0; i < 256 * 256; i++) { const v = r() * 255; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
      g.putImageData(img, 0, 0);
      for (let k = 0; k < 5; k++) { g.fillStyle = r() < 0.5 ? "#000" : "#fff"; g.beginPath(); g.arc(r() * 256, r() * 256, 0.5 + r() * 1.2, 0, 7); g.fill(); }
      tiles.push(cv);
    }
    return tiles;
  }
  /** nube de humo/tinta diluida: alfa = fbm × caída radial (gris), 256×256 */
  function makeSmoke(seed, color = "#6f6c69") {
    const N = 256, n = fbm(seed, N, N, 3, 6, 0.58), cv = mkCanvas(N, N), g = cv.getContext("2d"), img = g.createImageData(N, N), d = img.data, [r0, g0, b0] = hex(color);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x, fall = clamp(1 - Math.hypot(x / N - 0.5, y / N - 0.5) * 2.05), a = clamp((n[i] - 0.38) * 2.2) * fall * fall;
      d[i * 4] = r0; d[i * 4 + 1] = g0; d[i * 4 + 2] = b0; d[i * 4 + 3] = a * 255;
    }
    g.putImageData(img, 0, 0);
    return cv;
  }

  /** mancha de tinta gris diluida (la que cruza el papel en el barrido): salpicadura blanda, 256×256 */
  function makeInkBlot(seed, color) {
    const N = 256, f = fieldSplat(seed, N, N, 18, 0.35), n = fbm(seed + 3, N, N, 5, 5, 0.6), cv = mkCanvas(N, N), g = cv.getContext("2d"), img = g.createImageData(N, N), d = img.data, [r0, g0, b0] = hex(color);
    for (let i = 0; i < N * N; i++) { const a = clamp((f[i] - 0.2) / 0.18) * (0.55 + n[i] * 0.45); d[i * 4] = r0; d[i * 4 + 1] = g0; d[i * 4 + 2] = b0; d[i * 4 + 3] = a * 255; }
    g.putImageData(img, 0, 0);
    return cv;
  }
  /** lavado de papel: denso al centro, borde irregular de aguada (256×256) */
  function makeWash(seed, color) {
    const N = 256, n = fbm(seed, N, N, 4, 6, 0.6), cv = mkCanvas(N, N), g = cv.getContext("2d"), img = g.createImageData(N, N), d = img.data, [r0, g0, b0] = hex(color);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x, v = 1 - Math.hypot(x / N - 0.5, y / N - 0.5) * 2 + (n[i] - 0.5) * 0.55, a = clamp(v * 2.4);
      d[i * 4] = r0; d[i * 4 + 1] = g0; d[i * 4 + 2] = b0; d[i * 4 + 3] = a * 235;
    }
    g.putImageData(img, 0, 0);
    return cv;
  }

  /* ------------------------------------------------------------ fotos */
  /** foto "cover" a w×h px de dispositivo, con foco y tratamiento (color | bw) */
  function coverPhoto(im, w, h, focus = [0.5, 0.5], tone = "color") {
    const cv = mkCanvas(w, h), g = cv.getContext("2d");
    if (!im) { g.fillStyle = "#9a9792"; g.fillRect(0, 0, w, h); return cv; }
    const iar = im.width / im.height, ar = w / h; let sw = im.width, sh = im.height, sx = 0, sy = 0;
    if (iar > ar) { sw = im.height * ar; sx = (im.width - sw) * clamp(focus[0]); } else { sh = im.width / ar; sy = (im.height - sh) * clamp(focus[1]); }
    g.filter = tone === "bw" ? "grayscale(1) contrast(1.22) brightness(0.98)" : "saturate(1.12) contrast(1.08) brightness(1.03)";
    g.drawImage(im, sx, sy, sw, sh, 0, 0, w, h); g.filter = "none";
    return cv;
  }
  /**
   * Boceto a lápiz de una foto (canvas de dispositivo): gris + gris invertido desenfocado en
   * color-dodge → trazo; después el blanco pasa a transparente (alfa = oscuridad) para poder
   * dibujarlo con multiplicar sobre el papel. color = tinta del lápiz.
   */
  const sketches = new Map();
  function sketchOf(key, photo, color, strength = 1) {
    if (sketches.has(key)) return sketches.get(key);
    const w = photo.width, h = photo.height, a = mkCanvas(w, h), ga = a.getContext("2d", { willReadFrequently: true });
    const b = mkCanvas(w, h), gb = b.getContext("2d"), rad = Math.max(1.4, Math.min(w, h) / 380);
    ga.filter = "grayscale(1) contrast(1.15)"; ga.drawImage(photo, 0, 0); ga.filter = "none";
    gb.filter = `grayscale(1) invert(1) blur(${rad.toFixed(2)}px)`; gb.drawImage(photo, 0, 0); gb.filter = "none";
    ga.globalCompositeOperation = "color-dodge"; ga.drawImage(b, 0, 0); ga.globalCompositeOperation = "source-over";
    const img = ga.getImageData(0, 0, w, h), d = img.data, [r0, g0, b0] = hex(color);
    for (let i = 0; i < d.length; i += 4) {
      const v = 1 - (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255;
      const al = clamp(Math.pow(clamp((v - 0.06) * 2.8 * strength), 1.15));
      d[i] = r0; d[i + 1] = g0; d[i + 2] = b0; d[i + 3] = al * 255;
    }
    ga.putImageData(img, 0, 0);
    sketches.set(key, a);
    if (sketches.size > 24) sketches.delete(sketches.keys().next().value);
    return a;
  }

  /* ------------------------------------------------------------ texto */
  const LATIN = "Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt in culpa qui officia deserunt mollit anim id est laborum".split(" ");
  const HEADS = ["Near up doubtful such this far", "Lectus nibh magna", "Strategia nostra semper", "Washington diario", "Memoria et tempus", "Historia magistra vitae"];
  /** recorte de periódico fantasma: titular grande en serif + columna con filetes y renglones */
  function ghostClip(w, h, dpr, seed, color) {
    const cv = mkCanvas(w * dpr, h * dpr), g = cv.getContext("2d"), r = K.rng(seed);
    g.scale(dpr, dpr); g.fillStyle = color; g.strokeStyle = color; g.textBaseline = "alphabetic";
    const fs = h * 0.075;
    g.lineWidth = Math.max(0.6, fs * 0.05);
    g.beginPath(); g.moveTo(0, fs * 0.4); g.lineTo(w, fs * 0.4); g.stroke();
    g.font = `700 ${fs * 0.6}px 'Old Standard TT', serif`; g.fillText("BY NAME SURNAME, NAME", 0, fs * 1.4);
    g.font = `700 ${fs * 1.35}px 'Old Standard TT', serif`;
    const head = HEADS[(r() * HEADS.length) | 0].split(" ");
    let y = fs * 3.0, line = "";
    for (const wd of head) { const t = line ? line + " " + wd : wd; if (g.measureText(t).width > w && line) { g.fillText(line, 0, y); y += fs * 1.45; line = wd; } else line = t; }
    g.fillText(line, 0, y); y += fs * 0.8;
    g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); y += fs * 1.1;
    g.font = `400 ${fs * 0.62}px 'Old Standard TT', serif`;
    let wi = (r() * LATIN.length) | 0;
    while (y < h - fs * 0.3) {
      let l = "";
      while (true) { const nx = LATIN[wi % LATIN.length], t = l ? l + " " + nx : nx; if (g.measureText(t).width > w) break; l = t; wi++; }
      g.fillText(l, 0, y); y += fs * 0.82;
    }
    return cv;
  }
  /** titular fantasma suelto (serif grande, como "near up doubtful such this far.") */
  function ghostHead(size, dpr, seed, color) {
    const m = mkCanvas(4, 4).getContext("2d"), r = K.rng(seed), txt = HEADS[(r() * HEADS.length) | 0].toLowerCase() + ".";
    m.font = `400 ${size}px 'Old Standard TT', serif`;
    const w = m.measureText(txt).width + size, h = size * 1.5, cv = mkCanvas(w * dpr, h * dpr), g = cv.getContext("2d");
    g.scale(dpr, dpr); g.font = m.font; g.fillStyle = color; g.textBaseline = "middle"; g.fillText(txt, size * 0.5, h * 0.55);
    return { cv, w, h };
  }

  /** medida de texto con fuente CSS */
  const meas = mkCanvas(4, 4).getContext("2d");
  function measure(str, font, spacing = 0) { meas.font = font; meas.letterSpacing = spacing + "px"; return meas.measureText(str).width; }
  const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_#/";
  /**
   * Texto que se arma letra a letra de izquierda a derecha: cada letra pasa ~0,12 s por
   * glifos al azar (función de t) antes de fijarse; los espacios no parpadean.
   */
  function scramble(str, p, lt, seed, hold = 0.18) {
    const n = str.length; if (p >= 1) return str; if (p <= 0) return "";
    let out = "";
    const head = p * (n + n * hold);
    for (let i = 0; i < n; i++) {
      const c = str[i];
      if (i > head) break;
      if (c === " " || i < head - n * hold) { out += c; continue; }
      const h = K.hash(`${seed}:${i}:${Math.floor(lt * 22)}`);
      out += h % 5 === 0 ? " " : GLYPHS[h % GLYPHS.length];
    }
    return out;
  }
  /**
   * Bloque de texto de la referencia: renglones manuscritos (Mr Dafoe) y en MAYÚSCULAS
   * (Barlow 700) alternados. lines = [{ kind: "script"|"caps", text }]. Devuelve un objeto
   * con draw(G, lt, alpha) que anima: la manuscrita se "escribe" con un barrido y las
   * mayúsculas se arman letra a letra, renglón tras renglón.
   */
  function textBlock(ctx, lines, o) {
    const { W, H, portrait } = ctx.stage, P = ctx.C.palette;
    const caps = o.caps || (portrait ? W * 0.058 : H * 0.036), scr = o.script || caps * 1.02;
    const fCaps = `700 ${caps}px Barlow`, fScr = `400 ${scr}px 'Mr Dafoe'`, sp = caps * 0.02;
    const rows = lines.filter(l => l.text).map(l => {
      const font = l.kind === "script" ? fScr : fCaps, text = l.kind === "script" ? l.text : String(l.text).toUpperCase();
      return { ...l, font, text, w: measure(text, font, l.kind === "script" ? 0 : sp), lh: l.kind === "script" ? scr * 1.0 : caps * 1.12 };
    });
    const total = rows.reduce((a, r) => a + r.lh, 0);
    const align = o.align || "left";
    let y = o.anchorY === "bottom" ? o.y - total : o.y;
    rows.forEach(r => { r.y = y + r.lh * 0.72; y += r.lh; });
    const at = o.at ?? 1.3, step = o.step ?? 0.32, seed = o.seed ?? 1;
    const bwid = Math.max(...rows.map(r => r.w), 1), bx0 = align === "right" ? o.x - bwid : align === "center" ? o.x - bwid / 2 : o.x;
    return {
      rows, total, at, box: { x: bx0, y: rows.length ? rows[0].y - rows[0].lh * 0.72 : o.y, w: bwid, h: total },
      draw(G, lt, alpha = 1) {
        if (alpha <= 0.003) return;
        G.save(); G.textBaseline = "alphabetic"; G.textAlign = align;
        G.shadowColor = rgba(P.paperHi, 0.85); G.shadowBlur = caps * 0.5;
        rows.forEach((r, i) => {
          const t0 = at + i * step;
          if (lt < t0) return;
          G.fillStyle = r.kind === "script" ? P.script : P.ink; G.font = r.font;
          G.globalAlpha = alpha * clamp((lt - t0) / 0.12);
          if (r.kind === "script") {
            /* se escribe: barrido de recorte con borde suave */
            const p = ease4((lt - t0) / 0.75), x0 = align === "right" ? o.x - r.w : align === "center" ? o.x - r.w / 2 : o.x;
            G.save(); G.beginPath(); G.rect(x0 - scr, r.y - scr * 1.3, (r.w + scr * 1.5) * p, scr * 2); G.clip();
            G.fillText(r.text, o.x, r.y); G.restore();
          } else {
            G.letterSpacing = sp + "px";
            const p = clamp((lt - t0) / Math.max(0.35, r.text.length * 0.028));
            const s = scramble(r.text, p, lt, seed * 31 + i);
            /* alineación a la derecha: medir la cadena completa para que no "camine" */
            const x = align === "right" ? o.x - r.w : align === "center" ? o.x - r.w / 2 : o.x;
            G.textAlign = "left"; G.fillText(s, x, r.y); G.textAlign = align;
            G.letterSpacing = "0px";
          }
        });
        G.restore();
      },
    };
  }

  /* ------------------------------------------------------------ gotas de la salpicadura */
  function makeDrops(seed, cx, cy, R, n, spread = 2.2) {
    const r = K.rng(seed), out = [];
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, d = R * (0.85 + Math.pow(r(), 1.6) * spread), s = R * (0.015 + Math.pow(r(), 3) * 0.11);
      out.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d * 0.85, s, a, e: 1 + r() * 0.5, at: r() * 0.25, sat: r() < 0.35 });
    }
    return out;
  }
  function drawDrops(G, drops, lt, t0, color, alpha) {
    G.save(); G.fillStyle = color;
    for (const d of drops) {
      const q = clamp((lt - t0 - d.at) / 0.16);
      if (q <= 0) continue;
      const sc = q < 1 ? 1.25 - 0.25 * q : 1;
      G.globalAlpha = alpha * Math.min(1, q * 1.6);
      G.save(); G.translate(d.x, d.y); G.rotate(d.a); G.scale(d.e * sc, sc);
      G.beginPath(); G.arc(0, 0, d.s, 0, 7); G.fill();
      if (d.sat) { G.beginPath(); G.arc(d.s * 1.9, 0, d.s * 0.35, 0, 7); G.fill(); G.beginPath(); G.arc(d.s * 2.7, d.s * 0.2, d.s * 0.18, 0, 7); G.fill(); }
      G.restore();
    }
    G.restore();
  }

  /** textura de acuarela de un color: granulación + variación hacia el tono profundo */
  function washTexture(w, h, c1, c2, seed, gran = true) {
    const mw = Math.max(8, Math.ceil(w / 2)), mh = Math.max(8, Math.ceil(h / 2));
    const n = fbm(seed, mw, mh, 4, 5, 0.55), gr = gran ? fbm(seed + 3, mw, mh, 40, 2, 0.6) : null;
    const cv = mkCanvas(mw, mh), g = cv.getContext("2d"), img = g.createImageData(mw, mh), d = img.data, A = hex(c1), B = hex(c2);
    for (let i = 0; i < mw * mh; i++) {
      const k = clamp((n[i] - 0.3) * 1.5), a = gran ? 0.72 + n[i] * 0.28 - (gr[i] - 0.5) * 0.25 : 0.94 + n[i] * 0.06;
      for (let j = 0; j < 3; j++) d[i * 4 + j] = lerp(A[j], B[j], k);
      d[i * 4 + 3] = clamp(a) * 255;
    }
    g.putImageData(img, 0, 0);
    const out = mkCanvas(w, h), go = out.getContext("2d"); go.imageSmoothingQuality = "high"; go.drawImage(cv, 0, 0, w, h);
    return out;
  }

  /**
   * Salpicadura de acuarela lista para dibujar: mancha con puntas (textura granulada,
   * borde algo más oscuro) + gotas alrededor + un racimo de gotas al costado.
   * o = { tone: "color"|"bw", color, seed, side (dónde cae el racimo, en radios) }
   * draw(G, lt, t0, alpha): revienta en t0 (≈0,55 s, expoOut) y queda.
   */
  function makeSplash(ctx, cx, cy, R, o = {}) {
    const P = ctx.C.palette, dpr = ctx.dpr, bw = o.tone === "bw", seed = o.seed ?? 7;
    const box = R * 2.4, px = Math.ceil(box * dpr), sw = Math.max(16, Math.ceil(box / 1.4));
    const col = o.color || (bw ? "#121111" : P.splash), deep = o.deep || (bw ? "#000000" : P.splashDeep);
    const rv = Reveal(washTexture(px, px, col, deep, seed, !bw), Mask(fieldSplat(seed + 1, sw, sw, 20 + (seed % 8)), sw, sw, { soft: 0.04, rim: bw ? 0 : 0.22 }));
    const drops = makeDrops(seed + 2, cx, cy, R, 26), drops2 = makeDrops(seed + 12, cx + R * (o.side ?? 1.4), cy - R * 0.55, R * 0.45, 12, 1.4);
    const mode = bw || o.mode === "normal" ? "source-over" : "multiply";
    return {
      cx, cy, R, col,
      draw(G, lt, t0, alpha = 1, dur = 0.55) {
        const p = prog(lt, t0, dur, "expoOut");
        if (p <= 0 || alpha <= 0.003) return;
        G.save(); G.globalCompositeOperation = mode;
        rv.draw(G, cx - box / 2, cy - box / 2, box, box, lerp(1.0, 0.17, p), alpha * (mode === "multiply" ? 0.9 : 1));
        G.restore();
        drawDrops(G, drops, lt, t0 + 0.04, col, alpha * 0.85);
        drawDrops(G, drops2, lt, t0 + 0.3, col, alpha * 0.8);
      },
    };
  }

  /* ------------------------------------------------------------ familia */
  K.family("memorias", {
    setup(ctx) {
      const st = ctx.stage, P = ctx.C.palette, seed = (ctx.C.seed ?? 1);
      const css = document.createElement("style");
      /* subtítulos con el lenguaje del bloque de texto de la referencia: Barlow 600 en tinta
         sobre un lavado de papel (como "FIRST INFORMATION"); la palabra que suena, en el azul de la acuarela */
      css.textContent = `[data-family="memorias"] .k-cap{font-family:Barlow,sans-serif;font-weight:600;color:${P.ink};font-size:clamp(15px,3.5vmin,44px);letter-spacing:.01em;line-height:1.15;text-shadow:0 0 6px ${P.paperHi},0 0 2px ${P.paperHi}}
@media (orientation: portrait){[data-family="memorias"] .k-cap{font-size:clamp(16px,4.8vw,52px)}}
[data-family="memorias"] .k-cap-line{padding:.55em 1.6em;background:radial-gradient(ellipse closest-side at 50% 52%,${P.paperHi}f2 0%,${P.paperHi}d9 55%,${P.paperHi}00 100%)}
[data-family="memorias"] .k-w-cur{color:${P.splashDeep};font-weight:700;text-shadow:0 0 6px ${P.paperHi},0 0 2px ${P.paperHi},0 0 1px ${P.splash}55}`;
      document.head.appendChild(css);
      return { paper: makePaper(st.W, st.H, P, seed + 11), grain: makeGrain(seed + 5), smoke: [makeSmoke(seed + 21, P.smoke), makeSmoke(seed + 22, P.smoke), makeSmoke(seed + 23, "#55524f")], wash: makeWash(seed + 24, P.paperHi), blots: [0, 1, 2].map(i => makeInkBlot(seed + 31 + i, i === 2 ? "#3e3c3a" : "#5d5a57")) };
    },
    resize(ctx, F) { F.paper = makePaper(ctx.stage.W, ctx.stage.H, ctx.C.palette, (ctx.C.seed ?? 1) + 11); },
    frame(t, ctx, F) {
      const { W, H } = ctx.stage;
      ctx.g.bg.drawImage(F.paper, 0, 0, W, H);
    },
    post(t, ctx, F) {
      const { W, H } = ctx.stage, P = ctx.C.palette, A = ctx.C.memorias || {}, T = ctx.g.top;
      /* 1) corte: humo gris que barre el cuadro de izquierda a derecha + destello frío */
      if (A.smoke !== false) {
        for (const b of ctx.beats) {
          if (!mine(b) || /outro$/.test(b.use) || b.t1 >= ctx.total - 0.1) continue;
          const c = b.t1, d = t - c, whip = cutType(ctx, b) === "whip";
          if (d < -0.5 || d > (whip ? 1.6 : 0.9)) continue;
          const r = K.rng(K.hash("smk" + b.i));
          T.save();
          if (whip) {
            /* tinta gris estirada que cruza rápido hacia la izquierda mientras la cámara barre */
            for (let k = 0; k < 5; k++) {
              const sz = Math.max(W, H) * (0.24 + r() * 0.22), y = H * (0.15 + r() * 0.7), x = lerp(1.3 * W + k * 0.25 * W, -0.6 * W, clamp((d + 0.1) / 1.5 + r() * 0.05));
              const al = 0.7 * clamp((d + 0.15) / 0.3) * clamp((1.45 - d) / 0.4), spr = F.blots[k % 3];
              /* estirada en horizontal + estela = desenfoque de movimiento del barrido */
              for (let j = 0; j < 4; j++) { T.globalAlpha = al * (j ? 0.22 : 0.6); T.drawImage(spr, x - sz + j * sz * 0.12, y - sz * 0.4, sz * 2.0, sz * 0.8); }
            }
          } else {
            for (let k = 0; k < 3; k++) {
              const sz = Math.max(W, H) * (0.55 + r() * 0.35), y = H * (0.1 + r() * 0.8), x = lerp(-0.3 * W, 1.2 * W, clamp((d + 0.5) / 1.4 + r() * 0.2));
              T.globalAlpha = 0.35 * bell(d, 0.1, 0.4);
              T.drawImage(F.smoke[k % 3], x - sz / 2, y - sz / 2, sz * 1.3, sz);
            }
            T.globalAlpha = 0.22 * bell(d, 0.12, 0.3); T.fillStyle = P.flash; T.fillRect(0, 0, W, H);
          }
          T.restore();
        }
      }
      /* 2) viñeta: esquinas más oscuras sobre todo (como la referencia) */
      const vg = T.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.hypot(W, H) * 0.62);
      vg.addColorStop(0, "rgba(40,37,34,0)"); vg.addColorStop(1, "rgba(40,37,34,0.38)");
      T.fillStyle = vg; T.fillRect(0, 0, W, H);
      /* 3) grano (cambia a 12 fps, función de t) */
      const gr = A.grain ?? 0.045;
      if (gr > 0) {
        const f = Math.floor(t * 12), tile = F.grain[f % F.grain.length];
        T.save(); T.globalAlpha = gr; T.fillStyle = T.createPattern(tile, "repeat"); T.translate((f * 37) % 256, (f * 91) % 256); T.fillRect(-256, -256, W + 512, H + 512); T.restore();
      }
    },
  });

  /* ------------------------------------------------------------ cortes */
  const isScene = b => /^memorias\.scene$/.test(b.use);
  /** beat anterior de la misma capa */
  function prevBeat(ctx, b) { let p = null; for (const x of ctx.beats) if (x.i < b.i && x.layer === b.layer) p = x; return p; }
  /**
   * Tipo de corte al FINAL de un beat (como la referencia): "wash" = el plano se borra con una
   * mancha de papel mientras ya asoma el boceto del siguiente (la mayoría); "whip" = barrido de
   * cámara con estela, ~1 s de papel con tinta gris estirada y el siguiente entra deslizándose
   * (1 de cada 3 escenas). params.cut lo fuerza.
   */
  function cutType(ctx, b) {
    const own = b.params && b.params.cut;
    if (own && own !== "auto") return own;
    if (!isScene(b)) return "wash";
    const nx = ctx.beats.find(x => x.i > b.i && x.layer === b.layer);
    if (!nx || !isScene(nx)) return "wash";
    const n = ctx.beats.filter(x => x.i <= b.i && isScene(x)).length;
    return n % 3 === 0 ? "whip" : "wash";
  }

  /* ------------------------------------------------------------ plano */
  /** zonas que se colorean (lóbulos en fracciones del cuadro); lo demás queda en boceto */
  const REVEAL = {
    full: [{ x: 0.5, y: 0.5, rx: 0.72, ry: 0.85 }, { x: 0.15, y: 0.75, rx: 0.3, ry: 0.4 }, { x: 0.85, y: 0.3, rx: 0.3, ry: 0.4 }],
    right: [{ x: 0.68, y: 0.55, rx: 0.42, ry: 0.72 }, { x: 0.86, y: 0.3, rx: 0.22, ry: 0.4 }, { x: 0.44, y: 0.7, rx: 0.18, ry: 0.3 }],
    left: [{ x: 0.32, y: 0.55, rx: 0.42, ry: 0.72 }, { x: 0.14, y: 0.3, rx: 0.22, ry: 0.4 }, { x: 0.56, y: 0.7, rx: 0.18, ry: 0.3 }],
    center: [{ x: 0.5, y: 0.5, rx: 0.42, ry: 0.6 }, { x: 0.36, y: 0.66, rx: 0.2, ry: 0.3 }, { x: 0.64, y: 0.36, rx: 0.2, ry: 0.3 }],
    bottom: [{ x: 0.5, y: 0.7, rx: 0.7, ry: 0.42 }, { x: 0.3, y: 0.5, rx: 0.26, ry: 0.3 }, { x: 0.72, y: 0.52, rx: 0.26, ry: 0.3 }],
  };
  /** centro de la salpicadura por posición (fracciones) */
  const SPLASH = { tl: [0.24, 0.26], tr: [0.62, 0.24], t: [0.48, 0.22], l: [0.22, 0.48], r: [0.76, 0.42], c: [0.5, 0.45], bl: [0.26, 0.72], br: [0.74, 0.7] };
  /** posición del bloque de texto: {x, y, align, anchorY} en fracciones (16:9 / 9:16) */
  const TEXTPOS = {
    bl: { L: { x: 0.08, y: 0.86, align: "left", anchorY: "bottom" }, P: { x: 0.07, y: 0.74, align: "left", anchorY: "bottom" } },
    tl: { L: { x: 0.105, y: 0.13, align: "left" }, P: { x: 0.07, y: 0.08, align: "left" } },
    tr: { L: { x: 0.905, y: 0.13, align: "right" }, P: { x: 0.93, y: 0.08, align: "right" } },
    br: { L: { x: 0.905, y: 0.86, align: "right", anchorY: "bottom" }, P: { x: 0.93, y: 0.74, align: "right", anchorY: "bottom" } },
  };

  /**
   * Arma un plano. spec:
   *  src, focus, tone ("color"|"bw")
   *  reveal: clave de REVEAL | lóbulos | "none" (solo boceto)
   *  splash: clave de SPLASH | [x,y] | "none";  splashSize (fracción del lado corto), splashColor
   *  ghost: true/false (recorte de periódico + titular fantasma)
   *  lines: [{kind,text}], textPos: clave de TEXTPOS
   *  sketch: fuerza del boceto (0 = sin boceto)
   */
  function scene(ctx, spec) {
    const st = ctx.stage, { W, H, portrait } = st, dpr = ctx.dpr, P = ctx.C.palette, A = ctx.C.memorias || {}, F = ctx.family.memorias;
    const seed = ctx.rng() * 1e6 | 0, k = clamp(ctx.beat.dur / 5, 0.55, 1), tone = spec.tone || "color";
    const im = spec.src ? ctx.img(spec.src) : null;
    const drift = spec.drift ?? A.drift ?? 0.07;
    /* --- foto y boceto (mismo encuadre) */
    /* caja de la foto (fracciones): por defecto todo el cuadro */
    const bx = spec.box || [0, 0, 1, 1], BX = bx[0] * W, BY = bx[1] * H, BW = bx[2] * W, BH = bx[3] * H;
    const PW = Math.round(BW * dpr), PH = Math.round(BH * dpr);
    const photo = im ? coverPhoto(im, PW, PH, spec.focus || [0.5, 0.5], tone) : null;
    const sk = photo && spec.sketch !== 0 ? sketchOf([spec.src, PW, PH, (spec.focus || []).join(","), tone].join("|"), photo, P.pencil, spec.sketch ?? 1) : null;
    const mw = Math.ceil(BW / 3), mh = Math.ceil(BH / 3);
    /* el boceto se "dibuja" con un barrido; con sketchLobes queda recortado por una mancha */
    const skField = spec.sketchLobes ? fieldBlot(seed + 1, mw, mh, spec.sketchLobes, 0.36, 4) : fieldDir(seed + 1, mw, mh, spec.sketchFrom || "left", 0.45, 4);
    const skTh = spec.sketchLobes ? 0.4 : -0.2;
    const skRv = sk ? Reveal(sk, Mask(skField, mw, mh, { soft: 0.12 })) : null;
    let colRv = null, colTh = 0.36;
    if (photo && spec.reveal !== "none") {
      const lobes = Array.isArray(spec.reveal) ? spec.reveal : REVEAL[spec.reveal || "full"] || REVEAL.full;
      const L = portrait ? lobes.map(l => ({ ...l, rx: l.rx * 1.25, ry: l.ry * 0.85 })) : lobes;
      const gran = fbm(seed + 2, mw, mh, 30, 3, 0.6); for (let i = 0; i < gran.length; i++) gran[i] = 0.7 + gran[i] * 0.3;
      colRv = Reveal(photo, Mask(fieldBlot(seed + 3, mw, mh, L, spec.rough ?? 0.36, 4.2), mw, mh, { soft: 0.045, gran, rim: 0.12 }));
      colTh = spec.colorTh ?? 0.38;
    }
    /* --- salpicadura */
    let splash = null;
    if (spec.splash && spec.splash !== "none") {
      const c = Array.isArray(spec.splash) ? spec.splash : SPLASH[spec.splash] || SPLASH.tr;
      const cx = c[0] * W, cy = (portrait ? lerp(0.12, 0.62, c[1]) : c[1]) * H, R = Math.min(W, H) * (spec.splashSize ?? 0.26) * (tone === "bw" ? 0.62 : 1) * (portrait ? (tone === "bw" ? 1 : 1.15) : 1);
      splash = makeSplash(ctx, cx, cy, R, { tone, color: spec.splashColor, seed: seed + 7, side: portrait ? 0.2 : 1.4 });
    }
    /* --- periódico fantasma */
    const ghosts = [];
    if (spec.ghost !== false && A.ghostText !== false) {
      const r = K.rng(seed + 41);
      const cw = portrait ? W * 0.42 : W * 0.15, chh = portrait ? H * 0.17 : H * 0.36;
      const gx = spec.ghostAt ? spec.ghostAt[0] * W : (portrait ? (0.08 + r() * 0.45) * W : (0.42 + r() * 0.4) * W), gy = spec.ghostAt ? spec.ghostAt[1] * H : (portrait ? 0.08 + r() * 0.12 : 0.12 + r() * 0.3) * H;
      ghosts.push({ cv: ghostClip(cw, chh, dpr, seed + 42, P.ghost), x: gx, y: gy, w: cw, h: chh, a: 0.32 });
      const hd = ghostHead(portrait ? W * 0.055 : H * 0.05, dpr, seed + 43, P.ghost);
      ghosts.push({ cv: hd.cv, x: portrait ? W * 0.05 : W * (0.1 + r() * 0.12), y: portrait ? H * 0.04 : H * 0.05, w: hd.w, h: hd.h, a: 0.45 });
    }
    /* --- humo en los bordes */
    const r2 = K.rng(seed + 61), smokes = Array.from({ length: spec.smokes ?? 2 }, (_, i) => ({ k: i % 3, x: (r2() < 0.5 ? -0.05 : 0.8) + r2() * 0.2, y: r2() * 0.8, s: 0.45 + r2() * 0.35, a: 0.35 + r2() * 0.25 }));
    /* --- texto */
    const pos = (TEXTPOS[spec.textPos || "bl"] || TEXTPOS.bl)[portrait ? "P" : "L"];
    const tb = spec.lines && spec.lines.some(l => l.text) ? textBlock(ctx, spec.lines, { x: pos.x * W, y: pos.y * H, align: pos.align, anchorY: pos.anchorY, at: (spec.textAt ?? 1.8) * k, seed }) : null;

    /* tiempos medidos en la referencia (escalados con k si el plano es corto):
       boceto al cortar · color 0,35→2,3 s · salpicadura 1,6 s · texto 1,8 s.
       Si el plano entra con barrido, todo arranca 0,55 s después y ya llega coloreándose. */
    const prev = prevBeat(ctx, ctx.beat), whipIn = !!prev && Math.abs(prev.t1 - ctx.beat.t0) < 0.05 && cutType(ctx, prev) === "whip";
    const exit = cutType(ctx, ctx.beat), last = ctx.beat.t1 >= ctx.total - 0.1;
    const D0 = whipIn ? 0.55 : 0;
    const T = { sk: spec.sketchAt ?? 0.0, skD: (spec.sketchDur ?? 1.0) * k, col: (whipIn ? 0 : 0.35) * k, colD: (whipIn ? 1.4 : 2.0) * k, spl: 1.6 * k, splD: 0.6, ghost: 0.3 * k };
    /* capa propia: el plano entero (boceto incluido) se borra o se desliza en el corte */
    const L = mkCanvas(W * dpr, H * dpr), g = L.getContext("2d");
    const emw = Math.ceil(W / 4), emh = Math.ceil(H / 4), r3 = K.rng(seed + 77);
    const eraser = exit === "wash" ? Mask(fieldBlot(seed + 78, emw, emh, [{ x: r3() < 0.5 ? 0 : 1, y: 1, rx: 0.9, ry: 1.1 }, { x: 0.5, y: 0.75, rx: 0.5, ry: 0.5 }, { x: r3(), y: 0.2, rx: 0.35, ry: 0.4 }], 0.45, 4), emw, emh, { soft: 0.06 }) : null;
    /* copia con estela horizontal (desenfoque de movimiento barato) */
    const blit = (G, x, dir, amt, a) => {
      G.save(); G.setTransform(1, 0, 0, 1, 0, 0);
      if (amt > 0.01) for (let i = 6; i >= 1; i--) { G.globalAlpha = a * 0.3 * (1 - i / 7); G.drawImage(L, (x + dir * i * amt * W * 0.035) * dpr, 0); }
      G.globalAlpha = a * (amt > 0.01 ? 0.75 : 1); G.drawImage(L, x * dpr, 0); G.restore();
    };
    return {
      render(lt, b) {
        const G = ctx.g.main, d = lt - b.dur;
        if (d > 0.95) return;
        const lt2 = lt - D0;
        if (lt2 < 0) return;
        const inA = whipIn ? 1 : clamp(lt / 0.35), tOut = last ? 1 - prog(lt, b.dur - 0.2, 0.6, "sine") : 1 - prog(lt, b.dur - 0.45, 0.35, "sine");
        const z = 1 + drift * clamp(lt2 / Math.max(5, b.dur + 0.8));
        const tr = c => { c.translate(W / 2, H / 2); c.scale(z, z); c.translate(-W / 2, -H / 2); };
        g.setTransform(dpr, 0, 0, dpr, 0, 0); g.globalCompositeOperation = "source-over"; g.globalAlpha = 1; g.clearRect(0, 0, W, H);
        /* humo de fondo y periódico fantasma */
        for (const sm of smokes) { const sz = Math.max(W, H) * sm.s; g.globalAlpha = sm.a * inA; g.drawImage(F.smoke[sm.k], sm.x * W - sz * 0.2 + lt * W * 0.004, sm.y * H - sz * 0.3, sz, sz * 0.8); }
        for (const gh of ghosts) { g.globalAlpha = gh.a * prog(lt2, T.ghost, 0.8, "sine"); g.drawImage(gh.cv, gh.x, gh.y, gh.w, gh.h); }
        g.globalAlpha = 1;
        g.save(); tr(g);
        /* boceto a lápiz */
        if (skRv) { const p = prog(lt2, T.sk, T.skD, "out"); skRv.draw(g, BX, BY, BW, BH, lerp(1.0, skTh - 0.12, p), inA * 0.92); }
        /* foto a color que florece por manchas */
        if (colRv) { const p = prog(lt2, T.col, T.colD, "out"); if (p > 0) colRv.draw(g, BX, BY, BW, BH, lerp(1.0, colTh, p), 0.96); }
        /* salpicadura de acuarela con gotas */
        if (splash) splash.draw(g, lt2, T.spl, 1);
        g.restore();
        if (tb && tOut > 0.003) {
          /* lavado de papel detrás del bloque (la foto se disuelve en el papel donde va el texto) */
          const wa = prog(lt2, tb.at - 0.35, 0.6, "sine");
          if (wa > 0) { g.save(); g.globalAlpha = wa * 0.9; g.drawImage(F.wash, tb.box.x - tb.box.w * 0.4, tb.box.y - tb.box.h * 0.75, tb.box.w * 1.8, tb.box.h * 2.5); g.restore(); }
          tb.draw(g, lt2, tOut);
        }
        /* corte de salida */
        let x = 0, dir = 0, amt = 0, a = 1;
        if (!last && exit === "wash" && eraser) {
          const th = lerp(1.0, -0.12, prog(lt, b.dur - 0.15, 0.65, "inOut"));
          if (th < 0.999) { eraser.set(th); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "destination-out"; g.imageSmoothingQuality = "high"; g.drawImage(eraser.canvas, 0, 0, L.width, L.height); g.globalCompositeOperation = "source-over"; }
        } else if (!last && exit === "whip") {
          const q = prog(lt, b.dur - 0.25, 0.6, "in");
          x = -q * W * 1.35; dir = 1; amt = q;
        } else if (last) a = 1 - prog(lt, b.dur - 0.2, 0.7, "sine");
        if (d > 0.7) a *= 1 - clamp((d - 0.7) / 0.2);
        /* entrada con barrido: llega desde la derecha y frena */
        if (whipIn && lt < D0 + 1.0) { const q = ease4((lt - D0) / 0.95); x += (1 - q) * W * 1.1; dir = 1; amt = Math.max(amt, (1 - q) * 0.9); }
        if (a > 0.003) blit(G, x, dir, amt, a);
      },
      dispose() {},
    };
  }

  K.memorias = { scene, makeSplash, cutType, textBlock, fbm, Mask, Reveal, fieldBlot, fieldDir, fieldSplat, thFull, coverPhoto, sketchOf, washTexture, makeDrops, drawDrops, makeSmoke, ghostClip, ghostHead, measure, scramble, mkCanvas, rgba, hex, ease4, bell, REVEAL, SPLASH, TEXTPOS };
})();
