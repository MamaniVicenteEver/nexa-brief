/* =============================================================================
   collage · intros (el gancho: lo primero que se ve en YouTube)
   introv1 = mesa de archivo en plano secuencia (recortes que caen y se apilan,
             paralaje, bokeh) + banda oscura que se desliza + titular GIGANTE en
             romana que cae palabra por palabra como un recorte; ^palabra^ en
             dorado 3D. Momento propio: fuga de luz cálida (flashAt) que barre el
             cuadro, la cámara se adelanta y el dorado destella.
   introv2 = primera plana: una hoja de diario cae sobre la mesa, la pregunta se
             IMPRIME letra a letra en Playfair negra y la respuesta llega en una
             CINTA bordó con volutas que golpea encima (con destello).
   Fondos propios (neutros): table (mesa de recortes), sky (cielo de apertura con
   bokeh y polvo), map (mapa antiguo con rutas y lupa), press (pila de diarios con
   pase de hojas). Se exportan en Kit.collage.hook para el cierre (outro.js).
   Todo es función pura de lt (render cuadro a cuadro con seek).
   ========================================================================== */
(function () {
  "use strict";
  const K = window.Kit, CL = K.collage, { clamp, lerp, prog, ease } = K;
  const { mk, bell, card, drawCard, clipping } = CL;
  const CREAM = "#f6e8e2", BAND = "rgba(46,34,50,.88)", INKC = "#2a2226", WINE = "#5e1a22";
  const PRESETS = ["table", "sky", "map", "press"];

  /** memo propio por familia (las claves llevan W/H: un resize genera otras) */
  function memo(F, key, fn) {
    F.hk ||= new Map();
    if (!F.hk.has(key)) { if (F.hk.size > 60) F.hk.clear(); F.hk.set(key, fn()); }
    return F.hk.get(key);
  }

  /* ------------------------------------------------------------ texto */
  /** "¿POR QUÉ CAYÓ\nEL ^MURO^?" → [[{w, acc, glue}]] (^x^ = palabra en dorado 3D) */
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
  /** sacudida de cámara: suma de golpes que decaen (determinista) */
  function shake(lt, hits, amp) {
    let a = 0; for (const h of hits) { const d = lt - h; if (d >= 0 && d < 0.34) a += Math.pow(1 - d / 0.34, 2); }
    return [Math.sin(lt * 89) * amp * a, Math.cos(lt * 67) * amp * a * 0.8];
  }
  const fontOf = (px, fam = "Cinzel", w = 700, st = "") => `${st} ${w} ${px}px ${fam === "Cinzel" ? "Cinzel, serif" : `'${fam}', serif`}`.trim();
  const wOf = (s, px, fam, w, st) => CL.measure(fontOf(px, fam, w, st), s);
  /** tamaño que hace entrar `s` en maxW */
  const fitPx = (s, maxW, fam, w, st) => maxW / Math.max(1e-6, wOf(s, 100, fam, w, st)) * 100;

  /** letra/palabra dorada en 3D (extrusión + degradé), cacheada a resolución de dispositivo */
  function gold(F, str, px, dpr, fam = "Cinzel", weight = 700, st = "") {
    return memo(F, `gold|${str}|${px.toFixed(1)}|${dpr}|${fam}|${weight}|${st}`, () => {
      const s = px * dpr, font = fontOf(s, fam, weight, st), g0 = mk(4, 4).getContext("2d"); g0.font = font;
      const tw = g0.measureText(str).width, ex = s * 0.055, pad = Math.ceil(s * 0.3);
      const c = mk(tw + pad * 2 + ex * 2, s * 1.45 + pad), g = c.getContext("2d"); g.font = font; g.textBaseline = "alphabetic";
      const bx = pad, by = pad + s * 0.92;
      for (let k = 8; k >= 1; k--) { g.fillStyle = k > 5 ? "#2a1906" : k > 2 ? "#4a2f10" : "#6e4a1a"; g.fillText(str, bx + k * ex * 0.2, by + k * ex * 0.28); }
      const gr = g.createLinearGradient(0, by - s * 0.78, 0, by + s * 0.05);
      gr.addColorStop(0, "#fff0c4"); gr.addColorStop(0.38, "#e9c46e"); gr.addColorStop(0.52, "#c8923a"); gr.addColorStop(0.7, "#e2b25a"); gr.addColorStop(1, "#8f6024");
      g.fillStyle = gr; g.fillText(str, bx, by);
      g.lineWidth = Math.max(1, s * 0.01); g.strokeStyle = "rgba(80,48,12,.45)"; g.strokeText(str, bx, by);
      return { c, w: tw / dpr, h: c.height / dpr, cw: c.width / dpr, ox: bx / dpr, base: by / dpr };
    });
  }
  /** dibuja un sprite dorado con su línea de base en (x, y) */
  const drawGold = (G, sp, x, y) => G.drawImage(sp.c, x - sp.ox, y - sp.base, sp.cw, sp.h);
  /** brillo que recorre el dorado (ph 0..1) */
  let SH = null;
  function sheen(G, sp, x, y, ph) {
    if (ph <= 0 || ph >= 1) return;
    SH ||= mk(4, 4); if (SH.width < sp.c.width || SH.height < sp.c.height) { SH.width = sp.c.width; SH.height = sp.c.height; }
    const g = SH.getContext("2d"), w = sp.c.width, h = sp.c.height;
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "copy"; g.drawImage(sp.c, 0, 0);
    g.globalCompositeOperation = "source-atop";
    const cx = lerp(-0.3, 1.3, ease.inOut(ph)) * w, gr = g.createLinearGradient(cx - h * 0.6, 0, cx + h * 0.6, h * 0.5);
    gr.addColorStop(0, "rgba(255,250,230,0)"); gr.addColorStop(0.5, "rgba(255,250,230,.85)"); gr.addColorStop(1, "rgba(255,250,230,0)");
    g.fillStyle = gr; g.fillRect(0, 0, w, h); g.globalCompositeOperation = "source-over";
    G.drawImage(SH, 0, 0, w, h, x - sp.ox, y - sp.base, sp.cw, sp.h);
  }

  /** rótulo en versalitas doradas con filetes y rombos (como el "YEARS AGO" de la referencia) */
  function kicker(G, str, cx, y, size, a, align = "center") {
    if (!str || a <= 0) return;
    G.save(); G.globalAlpha *= a; G.font = fontOf(size, "Cinzel", 700); const sp = size * (0.28 + 0.25 * (1 - a));
    G.letterSpacing = sp + "px"; G.fillStyle = "#ecd08e"; G.textAlign = align; G.textBaseline = "middle";
    G.shadowColor = "rgba(20,8,14,.8)"; G.shadowBlur = size * 0.6;
    const s = String(str).toUpperCase(), w = G.measureText(s).width - sp;
    G.fillText(s, align === "center" ? cx + sp / 2 : cx, y); G.shadowBlur = 0;
    const lx = align === "center" ? cx - w / 2 : cx, rw = size * 3.2 * a, gap = size * 1.1;
    G.fillStyle = "rgba(236,208,142,.75)";
    const rule = (x0, x1) => { G.fillRect(Math.min(x0, x1), y - Math.max(1, size * 0.05), Math.abs(x1 - x0), Math.max(1, size * 0.1)); };
    const dia = x => { G.beginPath(); G.moveTo(x, y - size * 0.22); G.lineTo(x + size * 0.16, y); G.lineTo(x, y + size * 0.22); G.lineTo(x - size * 0.16, y); G.closePath(); G.fill(); };
    if (align === "center") { rule(lx - gap, lx - gap - rw); dia(lx - gap - rw - size * 0.25); }
    rule(lx + w + gap, lx + w + gap + rw); dia(lx + w + gap + rw + size * 0.25);
    G.restore();
  }

  /** voluta ornamental (extremo de la cinta), en las unidades de `h` */
  function flourish(g, side, h, col, col2) {
    g.save(); g.scale(side, 1); g.strokeStyle = col; g.fillStyle = col; g.lineCap = "round";
    const s = h; g.lineWidth = s * 0.06;
    for (const v of [-1, 1]) {
      g.beginPath(); g.moveTo(0, v * s * 0.5); g.bezierCurveTo(s * 0.35, v * s * 0.6, s * 0.55, v * s * 1.25, s * 0.25, v * s * 1.45);
      g.bezierCurveTo(s * 0.05, v * s * 1.55, s * 0.0, v * s * 1.25, s * 0.18, v * s * 1.18); g.stroke();
      g.beginPath(); g.moveTo(s * 0.3, v * s * 0.62); g.bezierCurveTo(s * 0.75, v * s * 0.7, s * 0.95, v * s * 0.3, s * 0.72, v * s * 0.18); g.stroke();
      g.beginPath(); g.ellipse(s * 0.5, v * s * 1.05, s * 0.07, s * 0.16, v * 0.6, 0, 7); g.fill();
    }
    g.lineWidth = s * 0.05; g.beginPath(); g.moveTo(0, 0); g.lineTo(s * 0.9, 0); g.stroke();
    g.beginPath(); g.moveTo(s * 0.9, 0); g.lineTo(s * 1.05, -s * 0.12); g.lineTo(s * 1.2, 0); g.lineTo(s * 1.05, s * 0.12); g.closePath(); g.fill();
    g.fillStyle = col2; g.beginPath(); g.arc(s * 0.62, 0, s * 0.07, 0, 7); g.fill();
    g.restore();
  }
  /** cinta bordó con filetes rosados, volutas y texto crema en Cinzel; centrada en el origen (px) */
  function ribbon(g, w, h, lines, fs) {
    g.save(); g.shadowColor = "rgba(20,6,12,.55)"; g.shadowBlur = h * 0.35; g.shadowOffsetY = h * 0.12;
    const gr = g.createLinearGradient(0, -h / 2, 0, h / 2); gr.addColorStop(0, "#c04a6a"); gr.addColorStop(0.5, "#9e2f4f"); gr.addColorStop(1, "#6f1a36");
    g.fillStyle = gr; g.fillRect(-w / 2, -h / 2, w, h); g.restore();
    g.strokeStyle = "rgba(255,215,225,.75)"; g.lineWidth = Math.max(1, h * 0.025); g.strokeRect(-w / 2 + h * 0.08, -h / 2 + h * 0.08, w - h * 0.16, h - h * 0.16);
    for (const sd of [-1, 1]) { g.fillStyle = "#e8b8a0"; g.beginPath(); const x = sd * (w / 2 - h * 0.26); g.moveTo(x, -h * 0.13); g.lineTo(x + h * 0.08, 0); g.lineTo(x, h * 0.13); g.lineTo(x - h * 0.08, 0); g.closePath(); g.fill(); }
    g.font = fontOf(fs, "Cinzel", 700); g.letterSpacing = fs * 0.06 + "px"; g.fillStyle = "#fff3ef"; g.textAlign = "center"; g.textBaseline = "middle";
    g.shadowColor = "rgba(40,0,15,.5)"; g.shadowBlur = fs * 0.1;
    lines.forEach((l, i) => g.fillText(l, fs * 0.03, (i - (lines.length - 1) / 2) * fs * 1.15 + fs * 0.04));
    g.shadowBlur = 0;
    g.save(); g.translate(-w / 2, 0); flourish(g, -1, h * 0.62, "#8e2a45", "#e7b3bd"); g.restore();
    g.save(); g.translate(w / 2, 0); flourish(g, 1, h * 0.62, "#8e2a45", "#e7b3bd"); g.restore();
  }

  /** moneda dorada neutra (sin leyendas de país) */
  function coin(F, seed, label) {
    return memo(F, "coin|" + seed + label, () => {
      const R = 120, pad = 22, c = mk(R * 2 + pad * 2, R * 2 + pad * 2), g = c.getContext("2d"), cx = R + pad;
      g.save(); g.shadowColor = "rgba(30,15,10,.5)"; g.shadowBlur = 14; g.shadowOffsetY = 5;
      const gr = g.createRadialGradient(cx - R * 0.35, cx - R * 0.4, R * 0.1, cx, cx, R); gr.addColorStop(0, "#f8e2a0"); gr.addColorStop(0.55, "#c99a45"); gr.addColorStop(1, "#7d5a24");
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cx, R, 0, 7); g.fill(); g.restore();
      g.strokeStyle = "rgba(90,60,20,.7)"; g.lineWidth = 4; g.beginPath(); g.arc(cx, cx, R * 0.86, 0, 7); g.stroke();
      g.fillStyle = "rgba(95,64,22,.85)"; g.font = `700 ${R * 0.42}px 'Cormorant Garamond', serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(label, cx, cx + R * 0.05);
      g.font = `700 ${R * 0.14}px Cinzel, serif`; const txt = "· ARCHIVO · MEMORIA · HISTORIA ";
      for (let i = 0; i < txt.length; i++) { const a = -Math.PI / 2 + i / txt.length * Math.PI * 2; g.save(); g.translate(cx + Math.cos(a) * R * 0.72, cx + Math.sin(a) * R * 0.72); g.rotate(a + Math.PI / 2); g.fillText(txt[i], 0, 0); g.restore(); }
      return { c, iw: R * 2, ih: R * 2 };
    });
  }

  /* ================================================================ fondos */
  const TONES5 = ["bw", "teal", "rose", "sepia", "color"];
  /** piezas de la mesa: relleno fijo + recortes que caen sobre la pila (en unidades = lado corto) */
  function tableItems(F, W, H, seed) {
    return memo(F, `table|${W | 0}|${H | 0}|${seed}|${K.loaded.size}`, () => {
      const r = K.rng(seed), U = Math.min(W, H), hx = W / U / 2, hy = H / U / 2, srcs = [...K.loaded.keys()], out = [];
      const piece = big => {
        const kind = r();
        if (kind < 0.5 || !srcs.length) {
          const w = big ? 0.46 + r() * 0.1 : 0.3 + r() * 0.24;
          return { w, k: clipping(F, { seed: (r() * 1e6) | 0, w: 420, h: Math.round(420 * (0.55 + r() * 0.75)), title: r() < 0.75 ? CL.para(F, r, 2 + (r() * 3 | 0)).toUpperCase() : "", red: r() < 0.35, cols: 2 + (r() < 0.3), photo: r() < 0.5 && srcs.length ? { src: srcs[(r() * srcs.length) | 0], tone: TONES5[(r() * 4) | 0], ar: 1.4 + r() * 0.3, focus: [r(), 0.4] } : null }) };
        }
        if (kind < 0.9) {
          const w = big ? 0.4 + r() * 0.12 : 0.24 + r() * 0.2;
          return { w, k: card(F, srcs[(r() * srcs.length) | 0], { tone: TONES5[(r() * 5) | 0], ar: [0.78, 1.3, 1.5][(r() * 3) | 0], focus: [0.25 + r() * 0.5, 0.3 + r() * 0.4], zoom: 1 + r() * 0.5, size: big ? 560 : 380, border: 0.04 }) };
        }
        return { w: 0.1 + r() * 0.03, k: coin(F, (r() * 1e5) | 0, ["1914", "1945", "1969", "100", "50", "10"][(r() * 6) | 0]), spin: true };
      };
      /* relleno: cuadrícula con desorden que cubre el recorrido de la cámara */
      const ex = hx + 0.7, ey = hy + 0.45, step = 0.4, nx = Math.ceil(ex * 2 / step), ny = Math.ceil(ey * 2 / step);
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const pc = piece(false);
        out.push({ ...pc, x: -ex + (i + 0.5) * (ex * 2 / nx) + (r() - 0.5) * 0.18, y: -ey + (j + 0.5) * (ey * 2 / ny) + (r() - 0.5) * 0.18, rot: (r() - 0.5) * 0.12 + (pc.spin ? r() * 6 : 0), z: -0.04 + r() * 0.03, t0: -1 });
      }
      /* recortes que caen y se apilan (posición de pantalla, normalizada) */
      const drops = [[-0.62, -0.42], [0.58, 0.4], [-0.3, 0.5], [0.66, -0.46], [0.05, -0.55], [-0.72, 0.12], [0.3, 0.05]];
      drops.forEach(([sx, sy], k) => {
        const pc = piece(true);
        out.push({ ...pc, sx: sx * hx, sy: sy * hy, rot: (r() - 0.5) * 0.16, z: 0.05 + k * 0.012, t0: 0.15 + k * 0.48 });
      });
      return out.sort((a, b) => a.z - b.z);
    });
  }
  /** cámara de la mesa (plano secuencia): avanza en x (en 9:16, en y) */
  const camOf = (t, portrait, speed) => { const a = -0.14 + t * speed, b = 0.025 * Math.sin(t * 0.45); return portrait ? [b, a] : [a, b]; };

  /** mesa de archivo con paralaje, recortes que caen, bokeh y fugas */
  function tableScene(G, st, F, lt, o = {}) {
    const { W, H, portrait } = st, U = Math.min(W, H), items = tableItems(F, W, H, o.seed ?? 7), sp = o.speed ?? 0.045;
    const [cx, cy] = camOf(lt, portrait, sp), rot = (-1.4 + 0.6 * Math.sin(lt * 0.21)) * Math.PI / 180, zs = (o.zoom ?? 1.02) + 0.012 * lt;
    G.save();
    G.fillStyle = "#14191c"; G.fillRect(0, 0, W, H);
    const view = z => { const par = 1 + z * 0.7; G.translate(W / 2, H / 2); G.scale(U * zs * (1 + z * 0.3), U * zs * (1 + z * 0.3)); G.rotate(rot); G.translate(-cx * par, -cy * par); };
    G.save(); view(-0.05);
    F.hkPat ||= G.createPattern(F.paper, "repeat"); F.hkPat.setTransform(new DOMMatrix().scaleSelf(1.7 / 1024));
    G.fillStyle = F.hkPat; G.fillRect(-8, -8, 16, 16); G.restore();
    for (const it of items) {
      let a = 1, sc = 1, x = it.x, y = it.y, rr = it.rot;
      if (it.t0 >= 0) {
        const q = clamp((lt - it.t0) / 0.55); if (q <= 0) continue;
        const e = ease.expoOut(q), [kx, ky] = camOf(it.t0, portrait, sp), par = 1 + it.z * 0.7;
        x = it.sx + kx * par; y = it.sy + ky * par; sc = 1 + 1.6 * (1 - e); a = clamp(q * 2.6); rr += (1 - e) * 0.35 * (it.z * 100 % 2 ? 1 : -1);
      }
      G.save(); view(it.z); G.translate(x, y); G.rotate(rr); if (sc !== 1) G.scale(sc, sc); G.globalAlpha *= a;
      drawCard(G, it.k, it.w); G.restore();
    }
    G.restore();
    bokeh(G, st, F, lt, o.bokeh ?? 1);
    F.boost.push({ col: [255, 170, 110], a: 0.28 + 0.12 * Math.sin(lt * 0.7), x: 0.95, y: 0.2, r: 0.6 });
    shade(G, st, o.dark ?? 0.3);
  }
  /** discos de bokeh cálidos muy cerca de cámara (pantalla) */
  function bokeh(G, st, F, lt, k = 1) {
    if (k <= 0) return;
    const { W, H } = st, M = Math.max(W, H), r = K.rng(404);
    G.save(); G.globalCompositeOperation = "screen";
    for (let i = 0; i < 9; i++) {
      const bx = r(), by = 0.55 + r() * 0.5, s = M * (0.05 + r() * 0.09), v = 0.01 + r() * 0.025, ph = r() * 6, img = i % 3 ? F.bokehRed : F.bokehGold;
      const x = ((bx + lt * v) % 1.2 - 0.1) * W, y = (by + Math.sin(lt * 0.5 + ph) * 0.02) * H;
      G.globalAlpha = k * (0.35 + 0.25 * Math.sin(lt * 0.8 + ph)) ; G.drawImage(img, x - s / 2, y - s / 2, s, s);
    }
    G.restore();
  }
  /** oscurecido + viñeta (legibilidad sobre cualquier fondo) */
  function shade(G, st, a) {
    if (a <= 0) return;
    const { W, H } = st;
    G.save(); G.fillStyle = `rgba(22,14,20,${a})`; G.fillRect(0, 0, W, H);
    const v = G.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
    v.addColorStop(0, "rgba(14,10,14,0)"); v.addColorStop(1, `rgba(14,10,14,${Math.min(0.8, a * 1.6)})`);
    G.fillStyle = v; G.fillRect(0, 0, W, H); G.restore();
  }

  /** cielo de apertura: nubes verde azuladas que derivan, luz de atardecer que entra, polvo y bokeh */
  function skyScene(G, st, F, lt, o = {}) {
    const { W, H } = st, M = Math.max(W, H);
    G.save(); G.fillStyle = "#0b1418"; G.fillRect(0, 0, W, H);
    const z = 1.18 + lt * 0.012, dw = Math.max(W, H * 16 / 9) * z, dh = dw * 9 / 16, dx = (W - dw) / 2 - lt * W * 0.012, dy = (H - dh) / 2;
    G.globalAlpha = clamp(lt / 0.6); G.drawImage(F.skyDark, dx, dy, dw, dh);
    const wq = 0.75 * prog(lt, 0.6, 3.2, "inOut") * (o.warm ?? 1);
    if (wq > 0) { G.globalAlpha = wq; G.drawImage(F.skyWarm, dx - W * 0.02, dy, dw, dh); }
    G.globalAlpha = 1;
    /* polvo flotando */
    const r = K.rng(911); G.fillStyle = "#f3e2c8";
    for (let i = 0; i < 70; i++) {
      const x = ((r() + lt * (0.006 + r() * 0.01)) % 1) * W, y = ((r() - lt * (0.004 + r() * 0.006)) % 1 + 1) % 1 * H, s = M * (0.0008 + r() * 0.0022), ph = r() * 6;
      G.globalAlpha = 0.25 + 0.35 * Math.abs(Math.sin(lt * 1.2 + ph)); G.fillRect(x, y, s, s);
    }
    G.restore();
    bokeh(G, st, F, lt, 0.9);
    F.boost.push({ col: [255, 150, 90], a: 0.45 * prog(lt, 0.8, 2.5, "inOut"), x: 1.02, y: 0.38, r: 0.8 }, { col: [255, 90, 80], a: 0.25, x: 0.1, y: 0.95, r: 0.6 });
    shade(G, st, o.dark ?? 0.12);
  }

  /** mapa antiguo genérico (costas, retícula, ríos, fronteras punteadas, nombres de relleno) */
  function oldMap(F) {
    return memo(F, "oldmap", () => {
      const Wm = 2048, Hm = 1400, c = mk(Wm, Hm), g = c.getContext("2d"), r = K.rng(61), seed = 61;
      g.drawImage(F.paperLight, 0, 0, Wm, Hm);
      const n = CL.noise(256, 176, seed, 5, 2), lc = mk(256, 176), lg = lc.getContext("2d"), id = lg.createImageData(256, 176);
      const val = (x, y) => n[y * 256 + x] + x / 256 * 0.2 - y / 176 * 0.12;
      for (let i = 0; i < n.length; i++) { const v = val(i % 256, Math.floor(i / 256)), sea = v < 0.45; id.data[i * 4] = 150; id.data[i * 4 + 1] = 196; id.data[i * 4 + 2] = 196; id.data[i * 4 + 3] = sea ? 120 + (0.45 - v) * 300 : 0; }
      lg.putImageData(id, 0, 0); g.imageSmoothingQuality = "high"; g.drawImage(lc, 0, 0, Wm, Hm);
      g.fillStyle = "rgba(40,45,55,.75)";
      for (let y = 1; y < 175; y++) for (let x = 1; x < 255; x++) { const a = val(x, y) < 0.45, b = val(x + 1, y) < 0.45, d = val(x, y + 1) < 0.45; if (a !== b || a !== d) g.fillRect(x * 8, y * 7.95, 7, 3); }
      g.strokeStyle = "rgba(60,70,80,.18)"; g.lineWidth = 2;
      for (let x = 0; x < Wm; x += 256) { g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + 40, Hm / 2, x, Hm); g.stroke(); }
      for (let y = 0; y < Hm; y += 230) { g.beginPath(); g.moveTo(0, y); g.quadraticCurveTo(Wm / 2, y - 40, Wm, y); g.stroke(); }
      g.strokeStyle = "rgba(70,90,110,.45)"; g.lineWidth = 2.5;
      for (let i = 0; i < 7; i++) { let x = r() * Wm, y = r() * Hm; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 18; k++) { x += (r() - 0.3) * 60; y += (r() - 0.5) * 60; g.lineTo(x, y); } g.stroke(); }
      g.setLineDash([14, 8, 3, 8]); g.strokeStyle = "rgba(120,50,60,.45)"; g.lineWidth = 3;
      for (let i = 0; i < 5; i++) { let x = r() * Wm, y = r() * Hm; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 10; k++) { x += (r() - 0.5) * 220; y += (r() - 0.5) * 220; g.lineTo(x, y); } g.stroke(); }
      g.setLineDash([]);
      g.fillStyle = "rgba(40,40,50,.55)"; g.font = "italic 400 26px 'Old Standard TT', serif";
      for (let i = 0; i < 30; i++) g.fillText(F.words[Math.floor(r() * F.words.length)].replace(/^./, m => m.toUpperCase()), r() * Wm, r() * Hm);
      /* rosa de los vientos */
      g.save(); g.translate(Wm * 0.84, Hm * 0.78); g.strokeStyle = "rgba(90,60,50,.55)"; g.fillStyle = "rgba(120,50,60,.45)"; g.lineWidth = 2;
      g.beginPath(); g.arc(0, 0, 90, 0, 7); g.stroke(); g.beginPath(); g.arc(0, 0, 70, 0, 7); g.stroke();
      for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, L = k % 2 ? 70 : 120; g.beginPath(); g.moveTo(Math.cos(a) * L, Math.sin(a) * L); g.lineTo(Math.cos(a + 0.25) * 18, Math.sin(a + 0.25) * 18); g.lineTo(Math.cos(a - 0.25) * 18, Math.sin(a - 0.25) * 18); g.closePath(); g.fill(); }
      g.restore();
      const pts = [[0.22, 0.34], [0.4, 0.6], [0.58, 0.38], [0.74, 0.58], [0.5, 0.2], [0.3, 0.76]].map(([x, y]) => [x * Wm, y * Hm]);
      return { c, Wm, Hm, pts };
    });
  }
  /** mapa con cámara que deriva, rutas rojas que se trazan, alfileres y lupa de bronce */
  function mapScene(G, st, F, lt, o = {}) {
    const { W, H, portrait } = st, M = oldMap(F);
    const s = Math.max(W / M.Wm, H / M.Hm) * (portrait ? 1.5 : 1.3) * (1 + 0.025 * lt), ox = W / 2 - M.Wm * s * (0.5 + 0.08 * Math.sin(lt * 0.12) - 0.012 * lt), oy = H / 2 - M.Hm * s * (0.5 - 0.01 * lt);
    const drawMap = () => { G.drawImage(M.c, 0, 0, M.Wm, M.Hm); routes(); };
    const routes = () => {
      G.strokeStyle = "#b8303f"; G.fillStyle = "#b8303f"; G.lineWidth = 7; G.lineCap = "round";
      for (let i = 1; i < M.pts.length; i++) {
        const q = prog(lt, 0.3 + (i - 1) * 0.6, 1.0, "inOut"); if (q <= 0) continue;
        const [x0, y0] = M.pts[i - 1], [x1, y1] = M.pts[i], mx = (x0 + x1) / 2 + (y1 - y0) * 0.3, my = (y0 + y1) / 2 - (x1 - x0) * 0.3;
        G.beginPath(); G.moveTo(x0, y0);
        for (let k = 1; k <= 40 * q; k++) { const t = k / 40, a = 1 - t; G.lineTo(a * a * x0 + 2 * a * t * mx + t * t * x1, a * a * y0 + 2 * a * t * my + t * t * y1); }
        G.stroke();
      }
      M.pts.forEach(([x, y], i) => {
        const q = prog(lt, 0.2 + i * 0.6, 0.3); if (q <= 0) return;
        G.globalAlpha = q; G.fillStyle = "#3b2b30"; G.beginPath(); G.arc(x, y, 11, 0, 7); G.fill();
        const ring = ((lt * 0.6 + i * 0.3) % 1); G.strokeStyle = `rgba(184,48,63,${0.7 * (1 - ring)})`; G.lineWidth = 4; G.beginPath(); G.arc(x, y, 14 + ring * 60, 0, 7); G.stroke(); G.globalAlpha = 1;
      });
    };
    G.save(); G.fillStyle = "#14191c"; G.fillRect(0, 0, W, H);
    G.globalAlpha = clamp(lt / 0.5);
    G.save(); G.translate(ox, oy); G.scale(s, s); drawMap(); G.restore();
    /* lupa de bronce que recorre el mapa */
    const q = ease.inOut(clamp(lt / 7)), lx = W * (portrait ? lerp(0.25, 0.7, q) : lerp(0.18, 0.62, q)), ly = H * (portrait ? lerp(0.78, 0.6, q) : lerp(0.72, 0.6, q)), R = Math.min(W, H) * 0.16;
    G.save(); G.beginPath(); G.arc(lx, ly, R, 0, 7); G.clip(); G.translate(lx, ly); G.scale(1.7, 1.7); G.translate(-lx, -ly); G.translate(ox, oy); G.scale(s, s); drawMap(); G.restore();
    const gl = G.createRadialGradient(lx - R * 0.4, ly - R * 0.4, 0, lx, ly, R); gl.addColorStop(0, "rgba(255,255,255,.3)"); gl.addColorStop(0.6, "rgba(255,255,255,0)"); gl.addColorStop(1, "rgba(30,40,40,.28)");
    G.fillStyle = gl; G.beginPath(); G.arc(lx, ly, R, 0, 7); G.fill();
    const rim = G.createLinearGradient(lx - R, ly - R, lx + R, ly + R); rim.addColorStop(0, "#e8d08e"); rim.addColorStop(0.5, "#7a5a22"); rim.addColorStop(1, "#c8a55a");
    G.strokeStyle = rim; G.lineWidth = R * 0.12; G.beginPath(); G.arc(lx, ly, R + R * 0.06, 0, 7); G.stroke();
    G.lineWidth = R * 0.16; G.lineCap = "round"; G.beginPath(); G.moveTo(lx + R * 0.8, ly + R * 0.8); G.lineTo(lx + R * 1.5, ly + R * 1.5); G.stroke();
    G.restore();
    F.boost.push({ col: [255, 120, 190], a: 0.22 + 0.1 * Math.sin(lt * 0.6), x: 0.05, y: 0.15, r: 0.6 });
    shade(G, st, o.dark ?? 0.32);
  }

  /** pase de hojas de libro (3 hojas cerca de cámara de izquierda a derecha); devuelve el borde revelado */
  const FL = { n: 3, gap: 0.13, dur: 0.6 };
  function flipEdge(tl, W) {
    const u = clamp(tl / FL.dur); if (u <= 0) return 0; if (u >= 1) return W * 2;
    return lerp(-0.05, 1.75, ease.inOut(u)) * W - W * (0.62 + 0.3 * Math.sin(Math.PI * u));
  }
  function pagePass(G, F, tl, W, H) {
    for (let i = FL.n - 1; i >= 0; i--) {
      const u = clamp((tl - i * FL.gap) / FL.dur); if (u <= 0 || u >= 1) continue;
      const xR = lerp(-0.05, 1.75, ease.inOut(u)) * W, wv = W * (0.62 + 0.3 * Math.sin(Math.PI * u)), xL = xR - wv, tex = F.pages[i % 2], n = 22;
      const sh = G.createLinearGradient(xR, 0, xR + W * 0.14, 0); sh.addColorStop(0, "rgba(25,12,15,.32)"); sh.addColorStop(1, "rgba(25,12,15,0)");
      G.fillStyle = sh; G.fillRect(xR, 0, W * 0.14, H);
      for (let k = 0; k < n; k++) {
        const s = k / n, x0 = xL + wv * s, x1 = xL + wv * (k + 1) / n, hh = H * (1.12 + 0.6 * s * Math.sin(Math.PI * u)), y0 = H / 2 - hh / 2 - H * 0.05 * s;
        G.drawImage(tex, tex.width * s, 0, tex.width / n, tex.height, x0, y0, x1 - x0 + 1.5, hh);
        const sd = 0.42 * Math.pow(1 - s, 2.2) - 0.1 * bell(s, 0.8, 0.12);
        G.fillStyle = sd > 0 ? `rgba(40,22,26,${sd.toFixed(3)})` : `rgba(255,248,236,${(-sd).toFixed(3)})`; G.fillRect(x0, y0, x1 - x0 + 1.5, hh);
      }
    }
  }
  /** pila de diarios: primeras planas superpuestas, dos que se deslizan encima, cámara que se acerca */
  function pressItems(F, W, H) {
    return memo(F, `press|${W | 0}|${H | 0}|${K.loaded.size}`, () => {
      const r = K.rng(83), srcs = [...K.loaded.keys()], U = Math.min(W, H), hx = W / U / 2, hy = H / U / 2, out = [];
      const sheet = (i, big) => clipping(F, { seed: 300 + i, w: 760, h: big ? 980 : 900, title: CL.para(F, r, 3 + (r() * 3 | 0)).toUpperCase(), red: i % 3 === 0, cols: 4, kicker: CL.para(F, r, 4), titleSize: 760 * 0.075, photo: srcs.length && r() < 0.7 ? { src: srcs[(r() * srcs.length) | 0], tone: TONES5[(r() * 4) | 0], ar: 1.6, focus: [0.5, 0.4] } : null });
      const pos = [[-0.95, -0.35], [0.9, -0.3], [-0.55, 0.45], [0.55, 0.5], [0, -0.1], [-1.2, 0.5], [1.25, 0.4]];
      pos.forEach(([x, y], i) => out.push({ k: sheet(i), w: 0.95, x: x * hx, y: y * hy, rot: (r() - 0.5) * 0.18, t0: -1 }));
      [[-0.25, 0.08, 1.0], [0.3, -0.05, 2.3]].forEach(([x, y, t0], i) => out.push({ k: sheet(10 + i, true), w: 1.0, x: x * hx, y: y * hy, rot: (r() - 0.5) * 0.12, t0 }));
      return out;
    });
  }
  function pressScene(G, st, F, lt, o = {}) {
    const { W, H, portrait } = st, U = Math.min(W, H), items = pressItems(F, W, H), zs = 0.9 + 0.022 * lt, px = 0.03 * lt;
    const edge = o.pass === false ? W * 2 : flipEdge(lt, W);
    G.save(); G.fillStyle = "#14191c"; G.fillRect(0, 0, W, H);
    G.save(); if (edge < W) { G.beginPath(); G.rect(0, 0, Math.max(0, edge), H); G.clip(); }
    G.translate(W / 2, H / 2); G.scale(U * zs, U * zs); G.rotate(-0.025); G.translate(portrait ? 0 : -px, portrait ? -px : 0);
    G.drawImage(F.paper, -2, -2, 4, 4);
    for (const it of items) {
      let a = 1, dx = 0;
      if (it.t0 >= 0) { const q = clamp((lt - it.t0) / 0.7); if (q <= 0) continue; const e = ease.out(q); a = clamp(q * 2.5); dx = (1 - e) * 1.2; }
      G.save(); G.translate(it.x + (portrait ? 0 : dx), it.y + (portrait ? dx : 0)); G.rotate(it.rot); G.globalAlpha *= a; drawCard(G, it.k, it.w); G.restore();
    }
    G.restore();
    if (edge < W) pagePass(G, F, lt, W, H);
    G.restore();
    bokeh(G, st, F, lt, 0.6);
    shade(G, st, o.dark ?? 0.34);
  }

  /** fábrica de presets para Kit.hook.bg; dark = oscurecido extra (más alto en el cierre) */
  function presets(ctx, dark = 0) {
    const F = ctx.family.collage;
    return {
      table: (G, st, lt) => tableScene(G, st, F, lt, { dark: 0.42 + dark }),
      sky: (G, st, lt) => skyScene(G, st, F, lt, { dark: 0.12 + dark }),
      map: (G, st, lt) => mapScene(G, st, F, lt, { dark: 0.36 + dark }),
      press: (G, st, lt) => pressScene(G, st, F, lt, { dark: 0.44 + dark }),
    };
  }
  /** foto de fondo virada con el tratamiento del diseño (duotono + semitono) */
  const toneFn = (ctx, p) => img => CL.toned(ctx.family.collage, p.src, p.photoTone || "teal") || img;
  const photoTone = def => ({ type: "enum", options: Object.keys(CL.TONES), default: def, doc: "Virado de la foto de fondo (bg=image): bw, teal, rose, sepia, color, red." });

  /** chispas doradas que saltan cuando un recorte aterriza */
  function sparks(G, x, y, w, d, seed, u) {
    if (d < 0 || d > 0.9) return;
    const r = K.rng(seed); G.save(); G.globalCompositeOperation = "lighter";
    for (let k = 0; k < 16; k++) {
      const px = x + (r() - 0.5) * w, vx = (r() - 0.5) * u * 22, vy = -u * (6 + r() * 16), life = 0.5 + r() * 0.4, s = u * (0.15 + r() * 0.3);
      if (d > life) continue;
      G.globalAlpha = 0.9 * (1 - d / life); G.fillStyle = r() < 0.5 ? "#ffd98a" : "#ffb070";
      G.beginPath(); G.arc(px + vx * d, y + vy * d + u * 30 * d * d, s, 0, 7); G.fill();
    }
    G.restore();
  }
  /** destello cálido con estelas (la "ráfaga" de la referencia), en px CSS */
  function flash(G, st, F, lt, at) {
    if (at < 0) return 0;
    const a = bell(lt, at + 0.12, 0.13), { W, H } = st;
    if (a > 0.01) {
      const cx = W * 0.5, cy = H * 0.47, R = Math.max(W, H) * 0.85;
      G.save(); G.globalCompositeOperation = "screen";
      const gr = G.createRadialGradient(cx, cy, 0, cx, cy, R); gr.addColorStop(0, `rgba(255,248,236,${0.7 * a})`); gr.addColorStop(0.4, `rgba(255,214,180,${0.45 * a})`); gr.addColorStop(1, `rgba(255,180,160,${0.1 * a})`);
      G.fillStyle = gr; G.fillRect(0, 0, W, H);
      const r = K.rng(77), k = clamp((lt - at) / 0.6); G.lineCap = "round";
      for (let i = 0; i < 40; i++) {
        const an = r() * Math.PI * 2, r0 = (0.1 + r() * 0.3 + k * 0.5) * W, len = (0.12 + r() * 0.3) * W;
        G.strokeStyle = `rgba(255,246,230,${(a * (0.2 + r() * 0.45)).toFixed(3)})`; G.lineWidth = (1 + r() * 4) * W / 1920;
        G.beginPath(); G.moveTo(cx + Math.cos(an) * r0, cy + Math.sin(an) * r0); G.lineTo(cx + Math.cos(an) * (r0 + len), cy + Math.sin(an) * (r0 + len)); G.stroke();
      }
      G.restore();
    }
    /* fuga de luz que cruza de derecha a izquierda */
    F.boost.push({ col: [255, 190, 130], a: 0.75 * bell(lt, at + 0.3, 0.4), x: lerp(1.1, -0.2, prog(lt, at, 1.4, "inOut")), y: 0.45, r: 1.0 }, { col: [255, 120, 190], a: 0.45 * bell(lt, at + 0.4, 0.35), x: 0.2, y: 0.8, r: 0.8 });
    return a;
  }

  CL.hook = { words, shake, gold, drawGold, sheen, kicker, ribbon, flourish, coin, presets, toneFn, photoTone, sparks, flash, shade, bokeh, pagePass, flipEdge, fontOf, wOf, fitPx, PRESETS, memo };

  /* ================================================================ introv1 */
  K.register({
    name: "collage.introv1", tags: ["intro", "gancho", "apertura", "título", "archivo", "impacto"], layer: "main", post: 0.6,
    summary: "GANCHO de apertura (lo primero que se ve). Fondo adaptable al tema (bg: table | sky | map | press | image con src | component con use/useParams); por defecto la mesa de archivo en plano secuencia con paralaje, recortes y fotos que caen y se apilan, bokeh y fugas de luz. Una banda oscura se desliza y el titular GIGANTE en romana cae palabra por palabra como un recorte (escala + desenfoque + sacudida + chispas); '^palabra^' va en dorado 3D. En flashAt, ráfaga de luz cálida: la cámara se adelanta y el dorado destella.",
    example: { text: "¿POR QUÉ CAYÓ\nEL ^MURO^?", kicker: "Berlín · 9 nov 1989", sub: "la noche que nadie vio venir", flashAt: 2.3 },
    params: {
      text: { type: "string", required: true, doc: "Titular gancho, corto (2–6 palabras). '\\n' = renglón; '^x^' = palabra en dorado 3D." },
      kicker: { type: "string", default: "", doc: "Rótulo chico arriba (lugar · fecha), en versalitas doradas." },
      sub: { type: "string", default: "", doc: "Línea chica debajo del titular (itálica)." },
      wordAt: { type: "number", default: 0.45, doc: "Segundo del primer golpe de palabra." },
      stagger: { type: "number", default: 0.3, min: 0.08, doc: "Segundos entre palabra y palabra." },
      flashAt: { type: "number", default: 2.3, doc: "Segundo de la ráfaga de luz cálida (cámara adelante + destello del dorado). -1 = sin ráfaga." },
      photoTone: photoTone("teal"),
      ...K.hook.bgParams(PRESETS),
    },
    create(ctx, p) {
      ctx.beat.hideCaptions = true;
      const F = ctx.family.collage, { W, H, u, portrait } = ctx.stage, dpr = ctx.dpr;
      let Ls = words(p.text);
      /* tamaño: ~80 % del ancho, limitado por alto; en 9:16 se prueba partir renglones largos */
      const lineStr = l => l.map((w, i) => (i && !w.glue ? " " : "") + w.w).join("");
      const sizeFor = L => { const longest = L.map(lineStr).reduce((a, s) => wOf(s, 100, "Cinzel", 700) > wOf(a, 100, "Cinzel", 700) ? s : a, ""); return Math.min(fitPx(longest, W * (portrait ? 0.88 : 0.8), "Cinzel", 700), H * (portrait ? 0.56 : 0.56) / (L.length * 1.08 + 0.4), H * (portrait ? 0.14 : 0.24)); };
      if (portrait) {
        /* 9:16: se reparte el titular en 2–4 renglones equilibrados (el que dé letra más grande) */
        const units = []; Ls.flat().forEach(w => { if (w.glue && units.length) units[units.length - 1].push(w); else units.push([{ ...w, glue: false }]); });
        let best = Ls, bf = sizeFor(Ls) * 1.04;
        const tryCuts = (k, start, cuts) => {
          if (cuts.length === k - 1) {
            const bounds = [0, ...cuts, units.length], L = [];
            for (let i = 0; i < k; i++) L.push(units.slice(bounds[i], bounds[i + 1]).flat());
            const f = sizeFor(L); if (f > bf) { bf = f; best = L; } return;
          }
          for (let c = start + 1; c < units.length; c++) tryCuts(k, c, cuts.concat([c]));
        };
        for (let k = 2; k <= Math.min(4, units.length); k++) tryCuts(k, 0, []);
        Ls = best;
      }
      const fs = sizeFor(Ls), lh = fs * 1.08, cy = H * (portrait ? 0.42 : 0.47), sp = wOf(" ", fs, "Cinzel", 700) * 1.1;
      let idx = 0; const placed = [];
      Ls.forEach((line, li) => {
        const ws = line.map(w => wOf(w.w, fs, "Cinzel", 700)), tot = ws.reduce((a, b) => a + b, 0) + sp * line.filter((w, k) => k && !w.glue).length;
        let x = W / 2 - tot / 2; const yb = cy + (li - (Ls.length - 1) / 2) * lh + fs * 0.36;
        line.forEach((w, k) => { if (k && !w.glue) x += sp; placed.push({ ...w, x, yb, ww: ws[k], i: w.glue ? idx - 1 : idx++, seed: 31 + placed.length * 7 }); x += ws[k]; });
      });
      const hits = placed.filter(w => !w.glue).map(w => p.wordAt + w.i * p.stagger + 0.12);
      const lastHit = hits[hits.length - 1] ?? p.wordAt;
      const blockH = lh * Ls.length, top = cy - blockH / 2, bot = cy + blockH / 2;
      const kfs = u * (portrait ? 2.6 : 1.9), sfs = u * (portrait ? 4.4 : 3.8);
      const bandTop = top - (p.kicker ? kfs * 3.4 : fs * 0.35), bandBot = bot + (p.sub ? sfs * 2.2 : fs * 0.2);
      const BG = K.hook.bg(ctx, p, { auto: "table", tone: toneFn(ctx, p), presets: presets(ctx) });
      return {
        dispose() { BG.dispose(); },
        render(lt, b) {
          const G = ctx.g.main, oq = clamp((lt - b.dur) / 0.6);
          const fa = flashAtOk(p) ? bell(lt, p.flashAt + 0.2, 0.25) : 0;
          const cam = 1.02 + 0.04 * clamp(lt / Math.max(4, b.dur)) + 0.045 * fa + 0.08 * ease.in(oq);
          const [sx, sy] = shake(lt, hits.concat(flashAtOk(p) ? [p.flashAt + 0.05] : []), u * 0.7);
          G.save(); G.globalAlpha = 1 - oq;
          G.translate(W / 2 + sx, H / 2 + sy); G.scale(cam, cam); G.translate(-W / 2, -H / 2);
          BG.render(lt, b);
          G.restore();
          F.dof = 0.3;                       /* el titular llega casi al borde: menos desenfoque de lente */
          /* banda oscura que se desliza desde la izquierda */
          const bq = prog(lt, p.wordAt - 0.4, 0.55, "out");
          if (bq > 0) {
            G.save(); G.globalAlpha = (1 - oq);
            const bw = W * bq, bx = 0;
            G.fillStyle = BAND; G.fillRect(bx, bandTop, bw, bandBot - bandTop);
            G.fillStyle = "rgba(255,215,225,.22)"; G.fillRect(bx, bandTop + u * 0.5, bw, Math.max(1, u * 0.12)); G.fillRect(bx, bandBot - u * 0.62, bw, Math.max(1, u * 0.12));
            const eg = G.createLinearGradient(bw - u * 6, 0, bw, 0); eg.addColorStop(0, "rgba(255,190,150,0)"); eg.addColorStop(1, `rgba(255,190,150,${0.35 * (1 - bq)})`);
            G.fillStyle = eg; G.fillRect(bw - u * 6, bandTop, u * 6, bandBot - bandTop);
            G.restore();
          }
          /* titular: cada palabra cae desde la cámara como un recorte */
          G.save(); G.translate(sx * 0.5, sy * 0.5);
          for (const w of placed) {
            const t0 = p.wordAt + w.i * p.stagger, q = prog(lt, t0, 0.24, "linear");
            if (q <= 0) continue;
            const e = ease.expoOut(q), s = 1 + 1.1 * (1 - e) + 0.06 * ease.in(oq), bl = (1 - e) * fs * 0.09, rot = (1 - e) * (w.i % 2 ? 0.12 : -0.12);
            const ccx = w.x + w.ww / 2, ccy = w.yb - fs * 0.36, drift = oq * W * 0.05 * (ccx < W / 2 ? -1 : 1);
            G.save(); G.globalAlpha = clamp(q * 3) * (1 - oq);
            G.translate(ccx + drift, ccy); G.rotate(rot); G.scale(s, s); G.translate(-ccx, -ccy);
            if (bl > 0.4 || oq > 0.05) G.filter = `blur(${Math.max(bl, oq * fs * 0.06).toFixed(1)}px)`;
            if (w.acc) {
              const spg = gold(F, w.w, fs, dpr);
              G.shadowColor = "rgba(10,4,8,.6)"; G.shadowBlur = fs * 0.12; G.shadowOffsetY = fs * 0.04;
              drawGold(G, spg, w.x, w.yb); G.shadowColor = "transparent";
              const ph = flashAtOk(p) ? prog(lt, p.flashAt + 0.05, 0.75, "linear") : prog(lt, t0 + 0.4, 0.8, "linear");
              sheen(G, spg, w.x, w.yb, ph);
            } else {
              G.font = fontOf(fs, "Cinzel", 700); G.textBaseline = "alphabetic"; G.fillStyle = CREAM;
              G.shadowColor = "rgba(20,6,14,.75)"; G.shadowBlur = fs * 0.1; G.shadowOffsetY = fs * 0.03;
              G.fillText(w.w, w.x, w.yb);
            }
            G.restore();
            if (!w.glue) sparks(G, ccx, w.yb + fs * 0.02, w.ww, lt - t0 - 0.12, w.seed, u);
          }
          G.restore();
          /* ráfaga de luz cálida (el momento de impacto) */
          if (flashAtOk(p)) flash(G, ctx.stage, F, lt, p.flashAt);
          /* rótulos */
          kicker(G, p.kicker, W / 2, top - kfs * 1.7, kfs, prog(lt, 0.15, 0.7, "out") * (1 - oq));
          if (p.sub) {
            const a = prog(lt, lastHit + 0.2, 0.6, "out") * (1 - oq);
            G.save(); G.globalAlpha = a; G.font = fontOf(sfs, "Cormorant Garamond", 600, "italic"); G.letterSpacing = sfs * 0.02 + "px";
            G.textAlign = "center"; G.textBaseline = "alphabetic"; G.fillStyle = "#fbefe8"; G.shadowColor = "rgba(20,6,14,.9)"; G.shadowBlur = u;
            G.fillText(String(p.sub), W / 2, bot + sfs * 1.15 + (1 - a) * u * 1.2); G.restore();
          }
        },
      };
    },
  });
  const flashAtOk = p => typeof p.flashAt === "number" && p.flashAt >= 0;

  /* ================================================================ introv2 */
  K.register({
    name: "collage.introv2", tags: ["intro", "gancho", "apertura", "pregunta", "diario", "cinta"], layer: "main", post: 0.6,
    summary: "GANCHO 'primera plana'. Fondo adaptable al tema (bg: map | table | sky | press | image con src | component con use/useParams); por defecto un mapa antiguo con rutas rojas que se trazan y una lupa de bronce. Una hoja de diario cae sobre la mesa, la pregunta se IMPRIME letra a letra en titular negro con cursor, las columnas aparecen, y la respuesta llega en una CINTA bordó con volutas que golpea encima con destello y chispas doradas.",
    example: { text: "¿QUIÉN ABRIÓ\nEL MURO?", kicker: "Berlín · 9 de noviembre de 1989", stamp: "NADIE DIO LA ORDEN", stampAt: 2.4 },
    params: {
      text: { type: "string", required: true, doc: "Pregunta gancho ('\\n' = renglón)." },
      kicker: { type: "string", default: "", doc: "Bajada en itálica sobre el titular (fecha, lugar)." },
      masthead: { type: "string", default: "EDICIÓN ESPECIAL", doc: "Cabecera de la hoja de diario." },
      stamp: { type: "string", default: "", doc: "Respuesta en la cinta bordó que golpea (vacío = sin cinta; '\\n' = 2 renglones)." },
      stampAt: { type: "number", default: 2.4, doc: "Segundo de la cinta (acepta '@palabra')." },
      typeAt: { type: "number", default: 0.5, doc: "Segundo en que empieza a imprimirse la pregunta." },
      cps: { type: "number", default: 18, min: 4, doc: "Letras por segundo." },
      photoTone: photoTone("sepia"),
      ...K.hook.bgParams(["map", "table", "sky", "press"]),
    },
    create(ctx, p) {
      ctx.beat.hideCaptions = true;
      const F = ctx.family.collage, { W, H, u, portrait } = ctx.stage;
      const Ls = String(p.text).toUpperCase().split("\n").map(s => s.trim()).filter(Boolean);
      const total = Ls.reduce((a, s) => a + s.length, 0);
      /* hoja de diario */
      const pw = portrait ? W * 0.9 : Math.min(W * 0.66, H * 1.25), ph = portrait ? H * 0.6 : H * 0.84;
      const pcx = W / 2, pcy = portrait ? H * 0.43 : H * 0.5, m = pw * 0.06;
      const longest = Ls.reduce((a, s) => wOf(s, 100, "Playfair Display", 900) > wOf(a, 100, "Playfair Display", 900) ? s : a, "");
      const fs = Math.min(fitPx(longest, pw - m * 2, "Playfair Display", 900), ph * 0.42 / (Ls.length * 1.02));
      const mastFs = pw * 0.038, headTop = -ph / 2 + m + mastFs * 2.4 + (p.kicker ? pw * 0.05 : 0);
      const paperC = memo(F, `v2page|${pw | 0}|${ph | 0}|${ctx.dpr}`, () => {
        const d = ctx.dpr, c = mk(pw * d, ph * d), g = c.getContext("2d"), r = K.rng(12);
        g.scale(d, d); g.drawImage(F.paperLight, 0, 0, pw, ph);
        const gr = g.createRadialGradient(pw / 2, ph / 2, pw * 0.2, pw / 2, ph / 2, pw * 0.8); gr.addColorStop(0, "rgba(255,250,240,0)"); gr.addColorStop(1, "rgba(120,80,60,.22)");
        g.fillStyle = gr; g.fillRect(0, 0, pw, ph);
        /* columnas de texto en la mitad inferior */
        const y0 = ph / 2 + headTop + Ls.length * fs * 1.02 + pw * 0.05, cols = portrait ? 2 : 3, gap = pw * 0.03, cw = (pw - m * 2 - gap * (cols - 1)) / cols;
        for (let k = 0; k < cols; k++) CL.column(g, F, r, m + k * (cw + gap), y0, cw, ph - m - y0, Math.max(6, pw * 0.017), Math.max(8, pw * 0.023), "rgba(45,35,40,.75)");
        return c;
      });
      const colY = ph / 2 + headTop + Ls.length * fs * 1.02 + pw * 0.04;
      const stLines = String(p.stamp || "").toUpperCase().split("\n").map(s => s.trim()).filter(Boolean);
      const rw = portrait ? W * 0.84 : Math.min(W * 0.62, pw * 1.0);
      const rfs = stLines.length ? Math.min(...stLines.map(s => fitPx(s, rw * 0.74, "Cinzel", 700) * 0.92), H * (portrait ? 0.05 : 0.08)) : 0;
      const rh = rfs * (1.15 * stLines.length + 0.95), rcy = portrait ? pcy + ph / 2 - rh * 0.1 : pcy + ph * 0.24;
      const BG = K.hook.bg(ctx, p, { auto: "map", tone: toneFn(ctx, p), presets: presets(ctx) });
      return {
        dispose() { BG.dispose(); },
        render(lt, b) {
          const G = ctx.g.main, oq = clamp((lt - b.dur) / 0.6);
          const hits = p.stamp ? [p.stampAt + 0.1] : [], [sx, sy] = shake(lt, hits.concat([0.42]), u * 0.9);
          G.save(); G.globalAlpha = 1 - oq; G.translate(sx, sy);
          BG.render(lt, b);
          G.restore();
          F.dof = 0.45;
          /* la hoja cae desde la cámara y queda derivando (plano secuencia) */
          const q = prog(lt, 0.05, 0.4, "linear"), e = ease.expoOut(q);
          const s = (1 + 1.2 * (1 - e)) * (1 + 0.02 * lt) * (1 + 0.1 * ease.in(oq)), rot = -0.022 + (1 - e) * 0.14 + 0.004 * Math.sin(lt * 0.5);
          G.save(); G.globalAlpha = clamp(q * 3) * (1 - oq);
          G.translate(pcx + sx * 0.8 - oq * W * 0.04, pcy + sy * 0.8); G.rotate(rot); G.scale(s, s);
          if ((1 - e) > 0.02) G.filter = `blur(${((1 - e) * u * 0.8).toFixed(1)}px)`;
          G.save(); G.shadowColor = "rgba(15,6,10,.6)"; G.shadowBlur = u * 3; G.shadowOffsetY = u * 1.2; G.fillStyle = "#ece2d8"; G.fillRect(-pw / 2, -ph / 2, pw, ph); G.restore();
          G.drawImage(paperC, -pw / 2, -ph / 2, pw, ph);
          G.filter = "none";
          /* cabecera */
          G.textAlign = "center"; G.textBaseline = "alphabetic"; G.fillStyle = INKC;
          G.font = fontOf(mastFs, "Cinzel", 700); G.letterSpacing = mastFs * 0.35 + "px";
          G.fillText(String(p.masthead || "").toUpperCase(), mastFs * 0.17, -ph / 2 + m + mastFs * 0.9);
          G.letterSpacing = "0px";
          G.fillStyle = "rgba(42,34,38,.8)"; G.fillRect(-pw / 2 + m, -ph / 2 + m + mastFs * 1.35, pw - m * 2, Math.max(1, pw * 0.004)); G.fillRect(-pw / 2 + m, -ph / 2 + m + mastFs * 1.6, pw - m * 2, Math.max(1, pw * 0.0015));
          if (p.kicker) { const kf = pw * 0.028; G.font = fontOf(kf, "Old Standard TT", 400, "italic"); G.fillStyle = "rgba(50,35,40,.85)"; G.fillText(String(p.kicker), 0, headTop - kf * 0.5); }
          /* pregunta que se imprime (tipos que caen con un leve golpe de tinta) */
          let n = Math.floor(clamp((lt - p.typeAt) * p.cps, 0, total)), left = n;
          G.font = fontOf(fs, "Playfair Display", 900); G.textAlign = "left"; G.fillStyle = WINE;
          let caret = null;
          Ls.forEach((str, i) => {
            const k = Math.min(str.length, left); left -= k;
            const full = wOf(str, fs, "Playfair Display", 900), x0 = -full / 2, yb = headTop + fs * (0.86 + i * 1.02);
            if (k > 0) { G.fillText(str.slice(0, k), x0, yb); }
            if (k < str.length && caret == null && (k > 0 || left === 0)) caret = [x0 + wOf(str.slice(0, k), fs, "Playfair Display", 900), yb];
            if (k === str.length && i === Ls.length - 1) caret = caret || [x0 + full, yb];
          });
          if (caret && Math.floor(lt * 2.6) % 2 === 0 && lt > p.typeAt - 0.3) { G.fillStyle = "rgba(94,26,34,.85)"; G.fillRect(caret[0] + fs * 0.05, caret[1] - fs * 0.78, Math.max(2, fs * 0.07), fs * 0.86); }
          /* regla bajo el titular */
          const done = p.typeAt + total / p.cps, rq = prog(lt, done, 0.5, "out");
          if (rq > 0) { G.fillStyle = "rgba(42,34,38,.75)"; G.fillRect(-(pw / 2 - m) * rq, -ph / 2 + colY, (pw - m * 2) * rq, Math.max(1, pw * 0.003)); }
          G.restore();
          /* respuesta: cinta bordó que golpea encima */
          if (stLines.length && lt >= p.stampAt) {
            const q2 = prog(lt, p.stampAt, 0.2, "linear"), e2 = ease.expoOut(q2), s2 = 1 + 1.4 * (1 - e2);
            G.save(); G.globalAlpha = clamp(q2 * 4) * (1 - oq); G.translate(W / 2 + sx, rcy + sy); G.rotate(-0.04 + (1 - e2) * 0.1); G.scale(s2, s2);
            if (1 - e2 > 0.05) G.filter = `blur(${((1 - e2) * u).toFixed(1)}px)`;
            ribbon(G, rw, rh, stLines, rfs); G.restore();
            sparks(G, W / 2, rcy - rh * 0.3, rw * 0.9, lt - p.stampAt - 0.1, 99, u);
            sparks(G, W / 2, rcy + rh * 0.3, rw * 0.7, lt - p.stampAt - 0.14, 98, u);
            flash(G, ctx.stage, F, lt, p.stampAt - 0.05);
          }
        },
      };
    },
  });
})();
