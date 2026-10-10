/* =============================================================================
   carta · runtime de la familia "carta antigua / álbum de fotografía histórica"
   -----------------------------------------------------------------------------
   Réplica del estilo "Historical Photography": una HOJA DE PAPEL VIEJO enorme con
   caligrafía de carta de fondo, y paneles (foto sepia con borde de pincel + textos de
   máquina de escribir) repartidos por ella. Una CÁMARA viaja de panel en panel:
     · enter = left|right|up|down|upleft|upright|downleft|downright → paneo de ~1 pantalla
       en 1,9 s (ease in-out) y después deriva lenta en la misma dirección;
     · enter = fly → los elementos del panel nuevo llegan desde delante del lente
       (escala ×7 → ×1, desenfocados, escalonados) y el panel viejo se borra con tinta;
     · enter = ink → igual que fly pero la foto nueva entra con una banda de tinta ancha.
   La cámara se calcula UNA vez (setup) a partir del storyboard: cada cuadro es función
   pura de t. Texturas (papel, manchas, grietas, caligrafía, grano, bokeh) procedurales
   con semillas fijas, cacheadas en canvas fuera de pantalla.
   Utilidades para los componentes en Kit.carta.
   ========================================================================== */
(function () {
  const K = window.Kit, { clamp, lerp, prog, ease } = K;
  const TYPE = "'Special Elite'", HAND = "'La Belle Aurore'", SIGN = "'Mrs Saint Delafield'";
  for (const f of [`400 40px ${TYPE}`, `400 40px ${HAND}`, `400 40px ${SIGN}`]) K.fonts.add(f);

  const PAN_DUR = 1.9, PAN_X = 1.06, PAN_Y = 1.0, DRIFT = 0.012;
  const DIRS = { left: [1, 0], right: [-1, 0], up: [0, 1], down: [0, -1],
    upleft: [0.82, 0.8], upright: [-0.82, 0.8], downleft: [0.82, -0.8], downright: [-0.82, -0.8] };
  const ENTERS = ["left", "right", "up", "down", "upleft", "upright", "downleft", "downright", "fly", "ink"];

  /* ------------------------------------------------------------ ruido (value noise) */
  function noise(seed) {
    const r = K.rng(seed), val = new Float32Array(256), perm = new Uint8Array(512);
    for (let i = 0; i < 256; i++) { val[i] = r(); perm[i] = i; }
    for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
    for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
    const sm = t => t * t * (3 - 2 * t);
    const h = (x, y) => val[perm[(x & 255) + perm[y & 255]]];
    /* px/py > 0 → ruido periódico (para texturas que se repiten sin costura) */
    function n2(x, y, px = 0, py = 0) {
      const xi = Math.floor(x), yi = Math.floor(y), xf = sm(x - xi), yf = sm(y - yi);
      const w = (a, p) => (p ? ((a % p) + p) % p : a);
      const x0 = w(xi, px), x1 = w(xi + 1, px), y0 = w(yi, py), y1 = w(yi + 1, py);
      return lerp(lerp(h(x0, y0), h(x1, y0), xf), lerp(h(x0, y1), h(x1, y1), xf), yf);
    }
    function fbm(x, y, oct = 4, px = 0, py = 0) {
      let a = 0.5, s = 0, n = 0, f = 1;
      for (let o = 0; o < oct; o++) { s += a * n2(x * f, y * f, px * f, py * f); n += a; a *= 0.5; f *= 2; }
      return s / n;
    }
    return { n2, fbm };
  }

  const canvas = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };

  /* ------------------------------------------------------------ papel del mundo */
  /** Caligrafía de carta antigua (texto propio, genérico): bloques de 4–6 renglones */
  const LETTER = [
    "Querida Elsa, te escribo con la luz que queda",
    "esta tarde la ciudad parece otra, más callada",
    "y yo pienso en los años que nos separaron",
    "guardo tus cartas en la caja de las fotos",
    "dicen que mañana habrá noticias del otro lado",
    "no sé si creerlo, pero quiero creerlo",
    "mi madre pregunta por ti cada domingo",
    "te mando este retrato para que no me olvides",
    "el invierno llega temprano y el pan escasea",
    "con todo mi cariño, tu hermano que te espera",
    "recuerdo la calle, el puente y la panadería",
    "si algún día vuelves, la puerta estará abierta",
  ];
  function paperTile(ctx, TW, TH) {
    const dpr = ctx.dpr, P = ctx.C.palette, u = ctx.stage.u;
    const c = canvas(TW * dpr, TH * dpr), g = c.getContext("2d");
    g.scale(dpr, dpr);
    g.fillStyle = P.bg; g.fillRect(0, 0, TW, TH);
    const N = noise(9011), r = K.rng(4242);
    /* manchas grandes: ruido periódico a baja resolución, escalado suave */
    const sw = Math.round(TW / 6), sh = Math.round(TH / 6), sc = canvas(sw, sh), sg = sc.getContext("2d"), id = sg.createImageData(sw, sh);
    const cx = 5, cy = Math.max(3, Math.round(5 * TH / TW));
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
      const v = N.fbm(x / sw * cx, y / sh * cy, 5, cx, cy), w2 = N.fbm(x / sw * cx * 3 + 7, y / sh * cy * 3 + 3, 3, cx * 3, cy * 3);
      const k = (y * sw + x) * 4, d = (v - 0.5) * 2.2 + (w2 - 0.5) * 0.6;
      if (d > 0) { id.data[k] = 226; id.data[k + 1] = 218; id.data[k + 2] = 199; id.data[k + 3] = Math.min(255, d * 190); }
      else { id.data[k] = 98; id.data[k + 1] = 84; id.data[k + 2] = 58; id.data[k + 3] = Math.min(255, -d * 170); }
    }
    sg.putImageData(id, 0, 0);
    g.imageSmoothingEnabled = true; g.drawImage(sc, 0, 0, TW, TH);
    /* yeso descascarado: parches claros con borde oscuro + grietas finas */
    const wrap = fn => { for (const ox of [-TW, 0, TW]) for (const oy of [-TH, 0, TH]) { g.save(); g.translate(ox, oy); fn(); g.restore(); } };
    for (let i = 0; i < 40; i++) {
      const x = r() * TW, y = r() * TH, R = u * (0.6 + r() * 3.2), pts = [];
      const n = 9 + Math.floor(r() * 8);
      for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2, rr = R * (0.45 + r() * 0.9); pts.push([Math.cos(a) * rr * (1 + r() * 0.6), Math.sin(a) * rr]); }
      wrap(() => {
        g.beginPath(); pts.forEach(([px, py], k) => k ? g.lineTo(x + px, y + py) : g.moveTo(x + px, y + py)); g.closePath();
        g.fillStyle = "rgba(226,219,200,.55)"; g.fill();
        g.strokeStyle = "rgba(70,58,38,.42)"; g.lineWidth = Math.max(0.6, u * 0.12); g.stroke();
      });
    }
    for (let i = 0; i < 120; i++) {
      let x = r() * TW, y = r() * TH, a = r() * Math.PI * 2;
      const n = 6 + Math.floor(r() * 14), seg = u * (0.4 + r() * 1.2), path = [[x, y]];
      for (let k = 0; k < n; k++) { a += (r() - 0.5) * 1.3; x += Math.cos(a) * seg; y += Math.sin(a) * seg; path.push([x, y]); }
      const al = 0.12 + r() * 0.3, lw = Math.max(0.5, u * (0.05 + r() * 0.08));
      wrap(() => { g.beginPath(); path.forEach(([px, py], k) => k ? g.lineTo(px, py) : g.moveTo(px, py)); g.strokeStyle = `rgba(60,48,30,${al})`; g.lineWidth = lw; g.stroke(); });
    }
    /* caligrafía: bloques de carta, tinta marrón semitransparente */
    const fs = u * 4.1, lh = u * 6.1;
    /* bloques en una grilla con desorden (no se pisan entre sí), como renglones de cartas pegadas */
    const cols = Math.max(2, Math.round(TW / (ctx.stage.W * 0.62))), rows = Math.max(2, Math.round(TH / (lh * 6.6)));
    for (let cy2 = 0; cy2 < rows; cy2++) for (let cx2 = 0; cx2 < cols; cx2++) {
      if (r() < 0.42) continue;
      const x = (cx2 + r() * 0.25) * TW / cols, y = (cy2 + 0.15 + r() * 0.2) * TH / rows, n = 4 + Math.floor(r() * 3), al = 0.3 + r() * 0.32, li = Math.floor(r() * LETTER.length);
      wrap(() => {
        g.font = `400 ${fs}px ${HAND}`; g.fillStyle = `rgba(48,34,18,${al})`; g.textBaseline = "alphabetic";
        for (let k = 0; k < n; k++) g.fillText(LETTER[(li + k) % LETTER.length], x + (k === 0 ? fs * 1.5 : k % 2 ? fs * 0.4 : 0), y + k * lh);
      });
    }
    /* grano fino */
    const gs = 220, gc = canvas(gs, gs), gg = gc.getContext("2d"), gd = gg.createImageData(gs, gs);
    for (let k = 0; k < gs * gs; k++) { const v = r(); gd.data[k * 4] = gd.data[k * 4 + 1] = gd.data[k * 4 + 2] = v < 0.5 ? 40 : 245; gd.data[k * 4 + 3] = Math.abs(v - 0.5) * 70; }
    gg.putImageData(gd, 0, 0);
    g.fillStyle = g.createPattern(gc, "repeat"); g.fillRect(0, 0, TW, TH);
    return c;
  }

  /* ------------------------------------------------------------ cámara */
  /** Recorre los beats-panel y arma: anclas de cada panel, paneos y deriva (todo en
      unidades de pantalla: x en anchos, y en altos → sirve igual en 9:16 y 16:9) */
  function buildCamera(ctx) {
    const isPanel = b => K.registry.get(b.use)?.panel;
    const panels = ctx.beats.filter(isPanel).sort((a, b) => a.t0 - b.t0);
    const keys = [], info = new Map();
    let A = { x: 0, y: 0 };
    const evalP = t => {
      let p = { x: 0, y: 0 };
      for (const k of keys) {
        if (t < k.t) break;
        const q = ease.inOut(clamp((t - k.t) / k.dur));
        p = { x: lerp(k.from.x, k.to.x, q), y: lerp(k.from.y, k.to.y, q) };
      }
      return p;
    };
    panels.forEach((b, k) => {
      const def = K.registry.get(b.use);
      const enter = b.params?.enter ?? def.params.enter?.default ?? "left";
      const v = DIRS[enter];
      if (v) {
        const from = evalP(b.t0);
        A = { x: A.x + v[0] * PAN_X, y: A.y + v[1] * PAN_Y };
        keys.push({ t: b.t0, dur: PAN_DUR, from, to: { ...A } });
      }
      const L = v ? Math.hypot(v[0], v[1]) : 1;
      const drift = v ? { x: v[0] / L * DRIFT, y: v[1] / L * DRIFT * 0.8 } : { x: (k % 2 ? 1 : -1) * DRIFT * 0.6, y: 0 };
      info.set(b.i, { k, enter, fly: !v, A: { ...A }, drift, t0: b.t0, t1: b.t1 });
    });
    /* deriva: integral de la velocidad del panel vigente (continua en el tiempo) */
    const segs = panels.map(b => ({ t: b.t0, v: info.get(b.i).drift }));
    let acc = { x: 0, y: 0 };
    segs.forEach((s, i) => { s.acc = { ...acc }; const nx = segs[i + 1]; if (nx) { acc = { x: acc.x + s.v.x * (nx.t - s.t), y: acc.y + s.v.y * (nx.t - s.t) }; } });
    const evalD = t => {
      let s = null;
      for (const x of segs) { if (x.t <= t) s = x; else break; }
      if (!s) return { x: 0, y: 0 };
      return { x: s.acc.x + s.v.x * (t - s.t), y: s.acc.y + s.v.y * (t - s.t) };
    };
    panels.forEach((b, k) => {
      const I = info.get(b.i), mid = (b.t0 + b.t1) / 2 + (I.fly ? 0 : 0.7), D = evalD(mid);
      I.P = { x: I.A.x + D.x, y: I.A.y + D.y };
      I.prev = k ? info.get(panels[k - 1].i) : null;
      I.next = panels[k + 1] ? info.get(panels[k + 1].i) : null;
    });
    return { info, cam: t => { const p = evalP(t), d = evalD(t); return { x: p.x + d.x, y: p.y + d.y }; } };
  }

  /* ------------------------------------------------------------ runtime */
  let STYLE = null;
  function injectStyle() {
    if (STYLE) return;
    STYLE = document.createElement("style");
    STYLE.textContent = `
[data-family="carta"] .k-cap { font-family: ${TYPE}, "Courier New", monospace; font-weight: 400; color: rgba(42,32,18,.72);
  font-size: clamp(14px, 3.3vmin, 44px); letter-spacing: .01em; text-transform: uppercase; line-height: 1.15;
  text-shadow: 0 0 .35em rgba(226,218,199,.95), 0 0 .8em rgba(226,218,199,.8); }
[data-family="carta"] .k-cap-line { background: linear-gradient(90deg, rgba(222,214,194,0), rgba(222,214,194,.55) 12%, rgba(222,214,194,.55) 88%, rgba(222,214,194,0));
  padding: .12em 1.1em; }
[data-family="carta"] .k-w-cur { color: #120a03; -webkit-text-stroke: .025em #120a03; }`;
    document.head.appendChild(STYLE);
  }

  K.family("carta", {
    setup(ctx) {
      injectStyle();
      const st = { tile: null, TW: 0, TH: 0 };
      const camera = buildCamera(ctx);
      st.info = camera.info; st.camAt = camera.cam; st.cam = { x: 0, y: 0 };
      /* bokeh: discos crema que respiran (pantalla, no papel) */
      const r = K.rng(777);
      st.bokeh = Array.from({ length: 8 }, (_, i) => ({ x: r(), y: r(), rad: 0.05 + r() * 0.07, vx: (r() - 0.5) * 0.012, vy: (r() - 0.5) * 0.008,
        w: 0.25 + r() * 0.5, ph: r() * 6.28, a: 0.24 + r() * 0.3 }));
      /* grano animado: 4 cuadros de ruido a media resolución */
      st.grain = [];
      for (let k = 0; k < 4; k++) {
        const gw = 360, gh = 360, c = canvas(gw, gh), g = c.getContext("2d"), d = g.createImageData(gw, gh), rr = K.rng(100 + k);
        for (let i = 0; i < gw * gh; i++) { const v = rr(); d.data[i * 4] = d.data[i * 4 + 1] = d.data[i * 4 + 2] = v < 0.5 ? 30 : 250; d.data[i * 4 + 3] = v < 0.04 || v > 0.96 ? 90 : Math.abs(v - 0.5) * 40; }
        g.putImageData(d, 0, 0); st.grain.push(c);
      }
      return st;
    },
    resize(ctx, st) { st.tile = null; },
    frame(t, ctx, st) {
      const { stage, g } = ctx, { W, H } = stage, G = g.bg;
      st.cam = st.camAt(t);
      if (!st.tile) { st.TW = Math.round(W * 1.6); st.TH = Math.round(H * 1.6); st.tile = paperTile(ctx, st.TW, st.TH); }
      /* papel en el mundo: se mueve con la cámara (es la misma hoja) */
      const ox = -(((st.cam.x * W) % st.TW) + st.TW) % st.TW, oy = -(((st.cam.y * H) % st.TH) + st.TH) % st.TH;
      for (let x = ox; x < W; x += st.TW) for (let y = oy; y < H; y += st.TH) G.drawImage(st.tile, x, y, st.TW, st.TH);
    },
    post(t, ctx, st) {
      const { stage, g } = ctx, { W, H } = stage, G = g.top;
      /* viñeta marrón suave */
      const vg = G.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.62);
      vg.addColorStop(0, "rgba(70,52,28,0)"); vg.addColorStop(1, "rgba(70,52,28,.32)");
      G.fillStyle = vg; G.fillRect(0, 0, W, H);
      /* bokeh: deriva lenta + algo de paralaje con la cámara */
      const S = Math.min(W, H) > 0 ? Math.max(W, H) : W;
      for (const b of st.bokeh) {
        let x = ((b.x + b.vx * t - st.cam.x * 0.18) % 1.2 + 1.2) % 1.2 - 0.1, y = ((b.y + b.vy * t - st.cam.y * 0.18) % 1.2 + 1.2) % 1.2 - 0.1;
        const a = b.a * (0.45 + 0.55 * Math.sin(t * b.w + b.ph) ** 2), R = b.rad * S;
        const gr = G.createRadialGradient(x * W, y * H, 0, x * W, y * H, R);
        gr.addColorStop(0, `rgba(246,240,224,${a})`); gr.addColorStop(0.62, `rgba(246,240,224,${a * 0.85})`); gr.addColorStop(1, "rgba(246,240,224,0)");
        G.fillStyle = gr; G.beginPath(); G.arc(x * W, y * H, R, 0, 7); G.fill();
      }
      /* grano / parpadeo de película (función del número de cuadro) */
      const f = Math.floor(t * 24), gc = st.grain[f % 4];
      G.save(); G.globalAlpha = 0.16; G.imageSmoothingEnabled = false;
      const s = 2.2, ox = -((f * 37) % 90), oy = -((f * 53) % 90);
      for (let x = ox; x < W; x += gc.width * s) for (let y = oy; y < H; y += gc.height * s) G.drawImage(gc, x, y, gc.width * s, gc.height * s);
      G.restore();
      const fl = 0.025 * Math.sin(f * 1.7) * Math.sin(f * 0.61);
      if (fl > 0) { G.fillStyle = `rgba(255,248,230,${fl})`; G.fillRect(0, 0, W, H); }
    },
  });

  /* ================================================================ prerender de piezas */
  const INK = "#1f180d", INK2 = "#2a2116";
  /** texto de máquina de escribir prerenderizado (con engrosado y desgaste de tinta) */
  function typeText(ctx, str, fs, o = {}) {
    const dpr = ctx.dpr, font = `400 ${fs}px ${o.font || TYPE}`;
    const m = canvas(4, 4).getContext("2d"); m.font = font;
    const tw = m.measureText(str).width, pad = fs * 0.25;
    const w = tw + pad * 2, h = fs * 1.45 + pad * 2, base = pad + fs * 1.05;
    const c = canvas(w * dpr, h * dpr), g = c.getContext("2d");
    g.scale(dpr, dpr); g.font = font; g.textBaseline = "alphabetic"; g.fillStyle = o.color || INK; g.strokeStyle = o.color || INK;
    g.lineJoin = "round";
    const heavy = o.heavy ?? 0;
    if (heavy > 0) { g.save(); g.shadowColor = "rgba(25,15,5,.45)"; g.shadowBlur = fs * 0.05; g.lineWidth = fs * heavy; g.strokeText(str, pad, base); g.restore(); }
    g.fillText(str, pad, base);
    /* desgaste: motas que se comen la tinta (semilla = texto) */
    const r = K.rng(K.hash(str + fs.toFixed(0))), n = Math.round(tw * fs / (fs * fs) * (o.wear ?? 30));
    g.globalCompositeOperation = "destination-out";
    for (let i = 0; i < n; i++) { g.globalAlpha = 0.35 + r() * 0.65; g.beginPath(); g.arc(pad + r() * tw, pad + fs * 0.25 + r() * fs * 0.85, fs * (0.006 + r() * 0.022), 0, 7); g.fill(); }
    return { c, w, h, pad, base, tw };
  }
  /** ajusta el cuerpo para que el texto no pase de maxW px */
  function fitSize(str, fs, maxW, font = TYPE) {
    if (!maxW) return fs;
    const m = canvas(4, 4).getContext("2d"); m.font = `400 ${fs}px ${font}`;
    const w = m.measureText(str).width * 1.04;
    return w > maxW ? fs * maxW / w : fs;
  }
  /** parte un párrafo en renglones de ~chars caracteres */
  function wrapText(str, chars) {
    const out = [];
    for (const para of String(str).split("\n")) {
      let cur = "";
      for (const w of para.split(/\s+/).filter(Boolean)) { if (cur && (cur + " " + w).length > chars) { out.push(cur); cur = w; } else cur = cur ? cur + " " + w : w; }
      if (cur) out.push(cur);
    }
    return out;
  }

  /* ================================================================ foto con máscara de tinta */
  /** gradiente sepia: sombras tinta → luces papel claro */
  const STOPS = [[0, [24, 17, 9]], [0.3, [74, 60, 40]], [0.62, [150, 136, 108]], [0.86, [210, 200, 178]], [1, [232, 224, 206]]];
  function sepia(img, w, h, focus = [0.5, 0.5], zoom = 1) {
    const c = canvas(w, h), g = c.getContext("2d");
    const iar = img.width / img.height, ar = w / h;
    let sw = img.width, sh = img.height;
    if (iar > ar) sw = img.height * ar; else sh = img.width / ar;
    sw /= zoom; sh /= zoom;
    const sx = clamp(focus[0] * img.width - sw / 2, 0, img.width - sw), sy = clamp(focus[1] * img.height - sh / 2, 0, img.height - sh);
    g.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h), a = d.data;
    const lut = new Uint8ClampedArray(256 * 3);
    for (let i = 0; i < 256; i++) {
      let v = i / 255; v = clamp((v - 0.5) * 1.12 + 0.52);
      let k = 0; while (k < STOPS.length - 2 && v > STOPS[k + 1][0]) k++;
      const [p0, c0] = STOPS[k], [p1, c1] = STOPS[k + 1], q = clamp((v - p0) / (p1 - p0));
      for (let j = 0; j < 3; j++) lut[i * 3 + j] = lerp(c0[j], c1[j], q);
    }
    for (let i = 0; i < a.length; i += 4) { const l = Math.round(a[i] * 0.3 + a[i + 1] * 0.59 + a[i + 2] * 0.11); a[i] = lut[l * 3]; a[i + 1] = lut[l * 3 + 1]; a[i + 2] = lut[l * 3 + 2]; }
    g.putImageData(d, 0, 0);
    return c;
  }
  /**
   * Foto sepia revelada por una máscara de tinta/pincel.
   * reveal(p, band, inkAlpha) → canvas compuesto (p 0..1: 0 nada, 1 foto entera con borde de pincel)
   */
  function inkPhoto(ctx, img, w, h, o = {}) {
    const dpr = ctx.dpr, sc = Math.min(dpr, 1600 / Math.max(w, h));
    const pw = Math.round(w * sc), ph = Math.round(h * sc);
    const src = img ? sepia(img, pw, ph, o.focus, o.zoom) : null;
    const mw = Math.round(clamp(w / 1.5, 60, 420)), mh = Math.max(20, Math.round(mw * h / w));
    /* dos mapas: O = orden de aparición (manchas internas primero), E = borde final de pincel */
    const N = noise(o.seed || 5), O = new Float32Array(mw * mh), E = new Float32Array(mw * mh), r = K.rng((o.seed || 5) + 1);
    const ox = r() * 50, oy = r() * 50, spl = o.style === "splatter";
    const drops = [];
    if (spl) for (let i = 0; i < 55; i++) { const a = r() * 6.283, d = 0.72 + r() * 0.25; drops.push([Math.cos(a) * d, Math.sin(a) * d, 0.01 + r() * 0.045]); }
    for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
      const nx = (x + 0.5) / mw * 2 - 1, ny = (y + 0.5) / mh * 2 - 1, i = y * mw + x;
      const d = Math.pow(Math.pow(Math.abs(nx), 3.4) + Math.pow(Math.abs(ny), 3.4), 1 / 3.4);
      const streak = N.fbm(nx * 11 + ox, ny * 1.4 + oy, 3), streak2 = N.fbm(nx * 1.4 + oy, ny * 9 + ox, 2), blob = N.fbm(nx * 2.6 + oy, ny * 2.6 + ox, 3);
      O[i] = d * 0.55 + blob * 0.6;
      /* borde: trazos verticales a los lados, algo horizontales arriba/abajo, más un temblor general */
      const side = Math.abs(nx) > Math.abs(ny) ? 1 : 0.55;
      let e = d + (streak - 0.5) * 0.42 * side + (streak2 - 0.5) * 0.18 * (1 - side * 0.6) + (blob - 0.5) * 0.12;
      if (spl) { e = d * 1.08 + (streak - 0.5) * 0.3 + (blob - 0.5) * 0.25; for (const [dx, dy, dr] of drops) if (Math.hypot((nx - dx) * w / h, ny - dy) < dr) e = Math.min(e, 0.5); }
      if (d > 0.985) e = 9;
      E[i] = e;
    }
    const EDGE = spl ? 0.8 : 0.9;
    const mc = canvas(mw, mh), mg = mc.getContext("2d"), md = mg.createImageData(mw, mh);
    const ic = canvas(mw, mh), ig = ic.getContext("2d"), idt = ig.createImageData(mw, mh);
    for (let i = 0; i < mw * mh; i++) { idt.data[i * 4] = 26; idt.data[i * 4 + 1] = 18; idt.data[i * 4 + 2] = 8; }
    const out = canvas(pw, ph), og = out.getContext("2d");
    let key = "";
    function reveal(p, band = 0.07, inkA = 0.8) {
      const k = `${p.toFixed(3)}|${band.toFixed(3)}|${inkA}`;
      if (k === key) return out;
      key = k;
      const thr = lerp(0.12, 1.32, clamp(p));
      for (let i = 0; i < O.length; i++) {
        const de = EDGE - E[i], dd = thr - O[i];
        const a = clamp(de / 0.025) * clamp(dd / 0.03);
        const ink = a > 0 ? Math.max(clamp(1 - dd / band), clamp(1 - de / 0.07) * 0.75) : 0;
        md.data[i * 4 + 3] = a * 255;
        idt.data[i * 4 + 3] = ink * inkA * 255;
      }
      mg.putImageData(md, 0, 0); ig.putImageData(idt, 0, 0);
      og.globalCompositeOperation = "copy";
      if (src) og.drawImage(src, 0, 0); else { og.fillStyle = "#8a7a5e"; og.fillRect(0, 0, pw, ph); }
      og.imageSmoothingEnabled = true;
      og.globalCompositeOperation = "destination-in"; og.drawImage(mc, 0, 0, pw, ph);
      og.globalCompositeOperation = "source-atop"; og.drawImage(ic, 0, 0, pw, ph);
      og.globalCompositeOperation = "source-over";
      return out;
    }
    /* fantasma: la misma foto, borde difuso, para el fondo detrás de los textos */
    function ghost() {
      const gc = canvas(pw, ph), gg = gc.getContext("2d");
      if (src) gg.drawImage(src, 0, 0);
      gg.globalCompositeOperation = "destination-in";
      const gr = gg.createRadialGradient(pw / 2, ph / 2, Math.min(pw, ph) * 0.15, pw / 2, ph / 2, Math.max(pw, ph) * 0.55);
      gr.addColorStop(0, "rgba(0,0,0,1)"); gr.addColorStop(1, "rgba(0,0,0,0)");
      gg.fillStyle = gr; gg.fillRect(0, 0, pw, ph);
      return gc;
    }
    return { reveal, ghost, w, h };
  }

  K.carta = { TYPE, HAND, SIGN, INK, INK2, ENTERS, PAN_DUR, noise, canvas, typeText, fitSize, wrapText, inkPhoto, sepia };
})();
