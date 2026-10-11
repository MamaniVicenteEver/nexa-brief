/* =============================================================================
   carta · intros (el gancho: lo primero que se ve en YouTube)
   introv1 = la cámara VUELA desde el lente hasta la gran hoja (papel con fotos
             de borde de pincel quemado que se revelan, carta que se escribe sola)
             y el titular GIGANTE de máquina de escribir llega palabra por palabra
             desde delante del lente; un MATASELLOS golpea encima (sealAt).
   introv2 = hoja metida en la máquina: la pregunta se tipea tecla a tecla y un
             SELLO de goma entintado golpea con la respuesta (fondo: un sobre que
             se abre y deja salir la carta).
   Fondos propios (presets) compartidos con el cierre en Kit.carta.hook:
     hoja  · la cámara viaja por la hoja: fotos que se revelan, carta que se
             escribe, sello postal + matasellos, firma.
     sobre · sobre lacrado que se abre y la carta que sale.
     bokeh · penumbra sepia con bokeh, polvo en suspensión y fuga de luz.
   Todo es función pura de lt (render cuadro a cuadro con seek).
   ========================================================================== */
(function () {
  "use strict";
  const K = window.Kit, C = K.carta, { clamp, lerp, prog, ease } = K;
  const INK = C.INK, ACC = "#120903", PAPER = "#dcd4be";
  const STAMP_RGB = "70,30,18";                    /* tinta de sello: marrón rojizo apagado */
  const PRESETS = ["hoja", "sobre", "bokeh"];
  const PAPERISH = new Set(["hoja", "sobre", "none"]);

  /* ------------------------------------------------------------ utilidades */
  const memo = new Map();
  const M = (k, f) => { if (!memo.has(k)) { if (memo.size > 120) memo.clear(); memo.set(k, f()); } return memo.get(k); };
  const mctx = C.canvas(4, 4).getContext("2d");
  const meas = (s, fs, font = C.TYPE) => { mctx.font = `400 ${fs}px ${font}`; return mctx.measureText(s).width; };

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
  /** reparte las palabras en renglones cortos (≈ la palabra más larga, mínimo 9 letras) */
  function rewrap(Ls) {
    const units = [];                                 /* palabra + signos pegados = una unidad */
    for (const l of Ls) l.forEach(w => { if (w.glue && units.length) units[units.length - 1].push(w); else units.push([w]); });
    const len = un => un.reduce((a, w) => a + w.w.length, 0);
    const max = Math.max(9, ...units.map(len)), out = [];
    let cur = [], n = 0;
    for (const un of units) {
      const add = len(un) + (cur.length ? 1 : 0);
      if (cur.length && n + add > max) { out.push(cur); cur = []; n = 0; }
      n += len(un) + (cur.length ? 1 : 0); cur.push(...un.map((w, i) => ({ ...w, glue: i > 0 })));
    }
    if (cur.length) out.push(cur);
    return out.length > 4 ? Ls : out;
  }
  /** sacudida de cámara: suma de golpes que decaen (determinista) */
  function shake(lt, hits, amp) {
    let a = 0; for (const h of hits) { const d = lt - h; if (d >= 0 && d < 0.34) a += Math.pow(1 - d / 0.34, 2); }
    return [Math.sin(lt * 89) * amp * a, Math.cos(lt * 67) * amp * a * 0.8];
  }
  /** vuelo desde el lente: escala grande → 1, desenfocado (firma del diseño) */
  function flyQ(lt, t0, dur = 0.34, from = 5.5) {
    const q = prog(lt, t0, dur, "linear"), e = 1 - Math.pow(1 - q, 3);
    const s = 1 + from * (1 - e) * (1 - e);
    return { q, s, blur: Math.min(16, (s - 1) * 3), a: clamp(q * 5) };
  }

  /* ------------------------------------------------------------ piezas prerenderizadas */
  /** hoja del mundo (la textura de la familia) desplazada por una cámara en px */
  function sheet(G, ctx, x, y) {
    const fs = ctx.family && ctx.family.carta, { W, H } = ctx.stage;
    G.fillStyle = ctx.C.palette.bg; G.fillRect(-W * 0.2, -H * 0.2, W * 1.4, H * 1.4);
    if (!fs || !fs.tile) return;
    const TW = fs.TW, TH = fs.TH, ox = -(((x % TW) + TW) % TW), oy = -(((y % TH) + TH) % TH);
    for (let a = ox - TW; a < W * 1.2; a += TW) for (let b = oy - TH; b < H * 1.2; b += TH) G.drawImage(fs.tile, a, b, TW, TH);
  }
  /** paisaje sepia genérico (cielo, sol, colinas, postes): "foto antigua" sin tema */
  function vintage(w, h, seed) {
    return M(`vin:${w | 0}:${h | 0}:${seed}`, () => {
      const c = C.canvas(w, h), g = c.getContext("2d"), r = K.rng(seed), N = C.noise(seed);
      const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, "#bfb398"); sky.addColorStop(0.55, "#e4dac2"); sky.addColorStop(1, "#a89a7a");
      g.fillStyle = sky; g.fillRect(0, 0, w, h);
      const sx = w * (0.25 + r() * 0.5), sy = h * (0.22 + r() * 0.14), sg = g.createRadialGradient(sx, sy, 0, sx, sy, h * 0.4);
      sg.addColorStop(0, "rgba(252,247,232,.95)"); sg.addColorStop(1, "rgba(252,247,232,0)"); g.fillStyle = sg; g.fillRect(0, 0, w, h);
      /* nubes: vetas suaves */
      for (let k = 0; k < 5; k++) { g.fillStyle = `rgba(250,244,228,${0.12 + r() * 0.18})`; g.beginPath(); g.ellipse(r() * w, h * (0.1 + r() * 0.3), w * (0.12 + r() * 0.2), h * 0.025, 0, 0, 7); g.fill(); }
      const layers = [[0.6, 0.2, "#9c8e6e"], [0.7, 0.17, "#74654a"], [0.82, 0.15, "#4a3c25"], [0.95, 0.1, "#251c0f"]];
      layers.forEach(([base, amp, col], i) => {
        g.fillStyle = col; g.beginPath(); g.moveTo(0, h);
        const ys = [];
        for (let x = 0; x <= w + 1; x += w / 90) { const y = h * (base - amp * N.fbm(x / w * (1.6 + i * 1.4) + i * 7, i * 3.1 + 0.5, 4)); ys.push([x, y]); g.lineTo(x, y); }
        g.lineTo(w, h); g.closePath(); g.fill();
        if (i === 2) {                                     /* postes / árboles finos */
          for (let k = 0; k < 7; k++) { const [x, y] = ys[(r() * ys.length) | 0], ph = h * (0.06 + r() * 0.12); g.fillRect(x, y - ph, Math.max(1, w * 0.004), ph); g.beginPath(); g.ellipse(x, y - ph, w * 0.012, ph * 0.25, 0, 0, 7); g.fill(); }
        }
      });
      for (let k = 0; k < 2600; k++) { g.fillStyle = r() < 0.5 ? "rgba(20,14,6,.25)" : "rgba(255,250,236,.22)"; g.fillRect(r() * w, r() * h, 1.2, 1.2); }
      return c;
    });
  }
  /** sello postal dentado; draw(g,x,y,w,h) pinta el motivo interior */
  function postage(ctx, w, h, seed, draw) {
    return M(`post:${w | 0}:${h | 0}:${seed}:${ctx.dpr}`, () => {
      const dpr = ctx.dpr, c = C.canvas(w * dpr, h * dpr), g = c.getContext("2d"); g.scale(dpr, dpr);
      g.fillStyle = "#e6dfca"; g.fillRect(0, 0, w, h);
      const pr = Math.min(w, h) * 0.035, step = pr * 2.8;
      g.globalCompositeOperation = "destination-out";
      const hole = (x, y) => { g.beginPath(); g.arc(x, y, pr, 0, 7); g.fill(); };
      for (let x = step / 2; x < w; x += step) { hole(x, 0); hole(x, h); }
      for (let y = step / 2; y < h; y += step) { hole(0, y); hole(w, y); }
      g.globalCompositeOperation = "source-over";
      const m = Math.min(w, h) * 0.11, iw = w - 2 * m, ih = h - 2 * m;
      g.save(); g.beginPath(); g.rect(m, m, iw, ih); g.clip(); draw(g, m, m, iw, ih); g.restore();
      g.strokeStyle = "rgba(31,24,13,.85)"; g.lineWidth = Math.max(1, m * 0.12); g.strokeRect(m, m, iw, ih);
      g.lineWidth = Math.max(0.6, m * 0.05); g.strokeRect(m * 0.55, m * 0.55, w - m * 1.1, h - m * 1.1);
      return c;
    });
  }
  /** motivo genérico de estampilla: paisaje + banda "CORREO" + valor */
  const stampMotif = (seed, label = "CORREO", value = "25") => (g, x, y, w, h) => {
    g.drawImage(vintage(w * 2, h * 2, seed), x, y, w, h);
    g.fillStyle = "rgba(230,222,200,.88)"; g.fillRect(x, y + h * 0.78, w, h * 0.22);
    g.fillStyle = INK; g.textAlign = "center"; g.textBaseline = "middle"; g.font = `400 ${h * 0.13}px ${C.TYPE}`;
    g.fillText(label, x + w / 2, y + h * 0.89);
    g.textAlign = "left"; g.font = `400 ${h * 0.16}px ${C.TYPE}`; g.fillStyle = "rgba(31,24,13,.9)"; g.fillText(value, x + w * 0.06, y + h * 0.12);
  };
  /** matasellos circular (texto en anillo + barra central calada) con ondas de cancelación */
  function postmark(ctx, R, str, waves = true) {
    return M(`pm:${R | 0}:${str}:${waves}:${ctx.dpr}`, () => {
      const dpr = ctx.dpr, wv = waves ? R * 3.3 : 0, cw = R * 2.4 + wv, ch = R * 2.4;
      const c = C.canvas(cw * dpr, ch * dpr), g = c.getContext("2d"); g.scale(dpr, dpr);
      g.strokeStyle = g.fillStyle = "rgba(30,21,12,.88)";
      g.save(); g.translate(R * 1.2, R * 1.2);
      g.lineWidth = R * 0.075; g.beginPath(); g.arc(0, 0, R, 0, 7); g.stroke();
      g.lineWidth = R * 0.035; g.beginPath(); g.arc(0, 0, R * 0.74, 0, 7); g.stroke();
      const [top, mid, bot] = String(str || "CORREO|★|ARCHIVO").toUpperCase().split("|");
      const ring = (txt, dir) => {
        g.font = `400 ${R * 0.2}px ${C.TYPE}`; g.textAlign = "center"; g.textBaseline = "middle";
        const n = txt.length, step = Math.min(0.26, 2.3 / Math.max(1, n));
        [...txt].forEach((chh, i) => { const a = dir * (i - (n - 1) / 2) * step; g.save(); g.rotate(a); g.translate(0, -dir * R * 0.87); if (dir < 0) g.rotate(Math.PI); g.fillText(chh, 0, 0); g.restore(); });
      };
      ring(top || "", 1); ring(bot || "", -1);
      g.fillRect(-R * 0.86, -R * 0.2, R * 1.72, R * 0.4);
      g.globalCompositeOperation = "destination-out";
      const mfs = Math.min(R * 0.3, R * 1.5 / Math.max(1, meas(mid || "", 1) || 1));
      g.font = `400 ${mfs}px ${C.TYPE}`; g.textAlign = "center"; g.textBaseline = "middle"; g.lineWidth = R * 0.02;
      g.fillText(mid || "", 0, R * 0.02); g.strokeText(mid || "", 0, R * 0.02);
      g.restore();
      g.globalCompositeOperation = "source-over";
      if (waves) {
        g.lineWidth = R * 0.065; g.lineCap = "round";
        for (let k = 0; k < 5; k++) {
          const yy = R * 1.2 + (k - 2) * R * 0.3; g.beginPath();
          for (let x = R * 2.3; x <= cw - R * 0.1; x += R * 0.08) { const y = yy + Math.sin((x - R * 2.3) / R * 3.2) * R * 0.1; x === R * 2.3 ? g.moveTo(x, y) : g.lineTo(x, y); }
          g.stroke();
        }
      }
      const r = K.rng(K.hash("pm" + str)); g.globalCompositeOperation = "destination-out";
      for (let i = 0; i < 260; i++) { g.globalAlpha = 0.3 + r() * 0.7; g.beginPath(); g.arc(r() * cw, r() * ch, R * (0.008 + r() * 0.04), 0, 7); g.fill(); }
      return { c, w: cw, h: ch, cx: R * 1.2, cy: R * 1.2 };
    });
  }
  /** sello de goma entintado: doble marco + texto de máquina gruesa, gastado */
  function rubber(ctx, str, fs, rgb = STAMP_RGB, fill = false) {
    return M(`rub:${str}:${fs | 0}:${rgb}:${fill}:${ctx.dpr}`, () => {
      const dpr = ctx.dpr, tw = meas(str, fs), pad = fs * 0.6, w = tw + pad * 2, h = fs * 1.75, m = fs * 0.25;
      const c = C.canvas((w + m * 2) * dpr, (h + m * 2) * dpr), g = c.getContext("2d"); g.scale(dpr, dpr);
      const col = `rgba(${rgb},.93)`; g.strokeStyle = g.fillStyle = col; g.lineJoin = "round";
      if (fill) { g.fillRect(m, m, w, h); g.globalCompositeOperation = "destination-out"; }
      else { g.lineWidth = fs * 0.12; g.strokeRect(m, m, w, h); }
      g.lineWidth = fs * 0.045; g.strokeRect(m + fs * 0.2, m + fs * 0.2, w - fs * 0.4, h - fs * 0.4);
      g.font = `400 ${fs}px ${C.TYPE}`; g.textAlign = "center"; g.textBaseline = "alphabetic"; g.lineWidth = fs * 0.06;
      g.strokeText(str, m + w / 2, m + h / 2 + fs * 0.36); g.fillText(str, m + w / 2, m + h / 2 + fs * 0.36);
      g.globalCompositeOperation = "destination-out";
      const r = K.rng(K.hash("rub" + str));
      for (let i = 0; i < Math.round(w * h / (fs * fs) * 55); i++) { g.globalAlpha = 0.25 + r() * 0.75; g.beginPath(); g.arc(m + r() * w, m + r() * h, fs * (0.006 + r() * r() * 0.05), 0, 7); g.fill(); }
      for (let i = 0; i < 6; i++) { g.globalAlpha = 0.18 + r() * 0.2; g.fillRect(m + r() * w * 0.3, m + r() * h, w * (0.3 + r() * 0.6), fs * (0.02 + r() * 0.05)); }
      return { c, w: w + m * 2, h: h + m * 2 };
    });
  }
  /** salpicadura de tinta alrededor de un golpe */
  function splat(G, x, y, R, q, seed, a = 0.8, rgb = "30,20,10") {
    if (q <= 0) return;
    const r = K.rng(seed); G.save(); G.fillStyle = `rgba(${rgb},${a})`;
    for (let i = 0; i < 30; i++) {
      const ang = r() * 6.283, d = R * (0.75 + r() * 0.9) * (0.5 + 0.5 * q), s = R * (0.012 + r() * r() * 0.07) * (0.3 + 0.7 * q);
      G.beginPath(); G.ellipse(x + Math.cos(ang) * d, y + Math.sin(ang) * d * 0.85, s * (1 + r() * 1.8), s, ang, 0, 7); G.fill();
    }
    G.restore();
  }
  /** papel rasgado (hoja de carta) con textura del mundo y borde quemado */
  function scrap(ctx, w, h, seed) {
    return M(`scrap:${w | 0}:${h | 0}:${seed}:${ctx.dpr}`, () => {
      const dpr = ctx.dpr, u = ctx.stage.u, m = u * 1.5, c = C.canvas((w + 2 * m) * dpr, (h + 2 * m) * dpr), g = c.getContext("2d"); g.scale(dpr, dpr);
      const r = K.rng(seed), j = () => (r() - 0.5) * u * 0.9, step = u * 0.8, pts = [];
      for (let x = 0; x <= w; x += step) pts.push([m + x, m + j()]);
      for (let y = 0; y <= h; y += step) pts.push([m + w + j() * 0.4, m + y]);
      for (let x = w; x >= 0; x -= step) pts.push([m + x, m + h + j()]);
      for (let y = h; y >= 0; y -= step) pts.push([m + j() * 0.4, m + y]);
      const path = new Path2D(); pts.forEach(([x, y], i) => i ? path.lineTo(x, y) : path.moveTo(x, y)); path.closePath();
      g.save(); g.clip(path);
      g.fillStyle = PAPER; g.fillRect(0, 0, w + 2 * m, h + 2 * m);
      const fam = ctx.family && ctx.family.carta;
      if (fam && fam.tile) { g.globalAlpha = 0.5; g.globalCompositeOperation = "multiply"; g.drawImage(fam.tile, -r() * fam.TW * 0.4, -r() * fam.TH * 0.4, fam.TW, fam.TH); }
      g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
      g.strokeStyle = "rgba(110,84,48,.32)"; g.lineWidth = u * 1.6; g.stroke(path);
      g.strokeStyle = "rgba(70,50,24,.4)"; g.lineWidth = u * 0.3; g.stroke(path);
      g.restore();
      return { c, w: w + 2 * m, h: h + 2 * m, m };
    });
  }
  function drawScrap(G, S, cx, cy, rot, s, a, u) {
    G.save(); G.globalAlpha *= a; G.translate(cx, cy); G.rotate(rot); G.scale(s, s);
    G.shadowColor = "rgba(30,20,8,.5)"; G.shadowBlur = u * 2.4; G.shadowOffsetY = u * 0.7;
    G.drawImage(S.c, -S.w / 2, -S.h / 2, S.w, S.h); G.restore();
  }
  /** texto prerenderizado que se escribe de izquierda a derecha (pluma o máquina) */
  function reveal(G, T, x, y, q, nib) {
    if (q <= 0) return;
    const cw = T.c.width * q, w = T.w * q;
    G.drawImage(T.c, 0, 0, cw, T.c.height, x, y, w, T.h);
    if (nib && q < 1) { G.fillStyle = "rgba(25,16,6,.9)"; G.beginPath(); G.arc(x + w, y + T.base - T.h * 0.12, Math.max(1, T.h * 0.03), 0, 7); G.fill(); }
  }
  /** trazo de pluma que se dibuja (rúbrica, subrayado, flecha) */
  function inkStroke(G, pts, q, width, a = 0.9) {
    if (q <= 0 || pts.length < 2) return;
    const n = Math.max(1, Math.floor(q * (pts.length - 1)));
    G.save(); G.strokeStyle = `rgba(28,19,9,${a})`; G.lineCap = "round"; G.lineJoin = "round";
    for (let i = 1; i <= n; i++) { const t = i / (pts.length - 1); G.lineWidth = width * (0.55 + 0.6 * Math.sin(Math.PI * t)); G.beginPath(); G.moveTo(pts[i - 1][0], pts[i - 1][1]); G.lineTo(pts[i][0], pts[i][1]); G.stroke(); }
    G.restore();
  }
  const bez = (x0, y0, mx, my, x1, y1, n = 28) => Array.from({ length: n + 1 }, (_, k) => { const s = k / n, a = 1 - s; return [a * a * x0 + 2 * a * s * mx + s * s * x1, a * a * y0 + 2 * a * s * my + s * s * y1]; });

  /* ================================================================ fondos propios */
  const LINES = [
    "Querido amigo: hay noches que cambian todo",
    "y uno no lo sabe hasta que ya pasaron.",
    "Te escribo para que no se pierda lo que vimos,",
    "lo que dijimos y lo que nadie quiso contar.",
    "Guarda esta carta con las fotografías.",
  ];
  /** hoja: la cámara viaja por la gran hoja; fotos que se revelan con tinta, carta que se escribe, estampilla + matasellos y firma */
  function hojaScene(ctx, o = {}) {
    const { W, H, u, portrait } = ctx.stage, seed = o.seed ?? 3;
    const L = portrait
      ? { ph: [[0.4, 0.035, 0.66, 0.2, 0.04, 0.3], [-0.14, 0.8, 0.6, 0.18, -0.035, 1.3]], hand: [0.06, 0.72, 0.022], st: [0.06, 0.07, 0.2], sign: [0.06, 0.95] }
      : { ph: [[0.63, 0.05, 0.32, 0.44, 0.035, 0.3], [0.88, 0.56, 0.3, 0.4, -0.03, 1.3]], hand: [0.04, 0.7, 0.04], st: [0.05, 0.07, 0.075], sign: [0.42, 0.95] };
    const photos = L.ph.slice(0, o.photos ?? 2).map(([x, y, w, h, rot, t0], i) => {
      const pw = w * W, ph = h * H;
      return { x: x * W, y: y * H, w: pw, h: ph, rot, t0, P: C.inkPhoto(ctx, vintage(pw * 1.3, ph * 1.3, seed + 11 * i), pw, ph, { seed: seed + 5 + i }) };
    });
    const hfs = L.hand[2] * H;
    const hand = LINES.slice(0, 4).map(s => C.typeText(ctx, s, hfs, { font: C.HAND, heavy: 0, color: "rgba(40,28,14,.85)", wear: 0 }));
    const sw = L.st[2] * W, stC = postage(ctx, sw, sw * 1.22, seed + 1, stampMotif(seed + 21));
    const pm = postmark(ctx, sw * 0.42, "CORREO|★|ARCHIVO");
    const sg = C.typeText(ctx, "con todo mi cariño", u * (portrait ? 5.5 : 6), { font: C.SIGN, color: "rgba(42,33,22,.85)", wear: 0 });
    return (G, st, lt) => {
      const cx = W * 0.032 * lt, cy = H * 0.012 * lt;           /* la cámara viaja (derecha y abajo) */
      sheet(G, ctx, cx, cy);
      G.save(); G.translate(-cx, -cy);
      for (const f of photos) {
        const q = prog(lt, f.t0, 1.9, "sine"); if (q <= 0.001) continue;
        G.save(); G.translate(f.x + f.w / 2, f.y + f.h / 2); G.rotate(f.rot);
        G.globalAlpha *= 0.95; G.drawImage(f.P.reveal(q, lerp(0.2, 0.075, q), 0.85), -f.w / 2, -f.h / 2, f.w, f.h); G.restore();
      }
      /* la carta se escribe sola, renglón a renglón */
      hand.forEach((T, i) => {
        const q = prog(lt, 0.3 + i * 1.05, 1.0, "linear");
        reveal(G, T, L.hand[0] * W + (i === 0 ? hfs * 1.2 : 0), L.hand[1] * H + i * hfs * 1.45 - T.base, q, true);
      });
      /* estampilla + matasellos que golpea */
      const sx = L.st[0] * W, sy = L.st[1] * H;
      G.save(); G.translate(sx + sw / 2, sy + sw * 0.61); G.rotate(0.05); G.shadowColor = "rgba(30,20,8,.35)"; G.shadowBlur = u; G.drawImage(stC, -sw / 2, -sw * 0.61, sw, sw * 1.22); G.restore();
      const pq = prog(lt, 0.9, 0.13, "linear");
      if (pq > 0) {
        const s = 1 + 1.2 * (1 - ease.out(pq));
        G.save(); G.globalAlpha *= clamp(pq * 4) * 0.9; G.translate(sx + sw * 0.95, sy + sw * 0.85); G.rotate(-0.18); G.scale(s, s);
        G.drawImage(pm.c, -pm.cx, -pm.cy, pm.w, pm.h); G.restore();
      }
      /* firma */
      reveal(G, sg, L.sign[0] * W, L.sign[1] * H - sg.base, prog(lt, 2.4, 1.3, "linear"), true);
      G.restore();
    };
  }
  /** sobre: un sobre lacrado que se abre (solapa), la carta escrita sale y queda flotando */
  function sobreScene(ctx, o = {}) {
    const { W, H, u, portrait } = ctx.stage, side = o.side || "center";
    const ew = portrait ? W * 0.84 : W * (side === "right" ? 0.4 : 0.5), eh = ew * 0.62;
    const ecx = portrait ? W / 2 : side === "right" ? W * 0.73 : W / 2;
    const ey = portrait ? H * 0.66 : side === "right" ? H * 0.42 : H * 0.6;
    const lfs = ew * 0.045, hand = LINES.map(s => C.typeText(ctx, s, lfs, { font: C.HAND, heavy: 0, color: "rgba(40,28,14,.8)", wear: 0 }));
    const sw = ew * 0.16, stC = postage(ctx, sw, sw * 1.22, 77, stampMotif(91, "CORREO", "10"));
    const pm = postmark(ctx, sw * 0.5, "CORREO|★|URGENTE");
    const S = scrap(ctx, ew * 0.9, eh * 1.25, 61);
    return (G, st, lt) => {
      const dx = Math.sin(lt * 0.25) * u * 1.5, dy = -lt * u * 0.25;
      sheet(G, ctx, lt * W * 0.01, lt * H * 0.004);
      const x0 = ecx - ew / 2 + dx, y0 = ey - eh / 2 + dy, x1 = x0 + ew, y1 = y0 + eh, mx = (x0 + x1) / 2;
      const fo = prog(lt, 0.35, 0.8, "inOut"), f = Math.cos(fo * Math.PI * 0.92);         /* 1 cerrado → -0.97 abierto */
      const ls = prog(lt, 1.0, 1.5, "inOut");
      /* sombra y cuerpo trasero (interior) */
      G.save(); G.shadowColor = "rgba(30,20,8,.45)"; G.shadowBlur = u * 3; G.shadowOffsetY = u;
      G.fillStyle = "#b9ad90"; G.fillRect(x0, y0, ew, eh); G.restore();
      const apex = y0 + eh * 0.55 * f;
      const flap = () => {
        G.save(); G.beginPath(); G.moveTo(x0, y0); G.lineTo(mx, apex); G.lineTo(x1, y0); G.closePath();
        G.fillStyle = f > 0 ? "#d6ccb1" : "#c7bc9f"; G.fill(); G.strokeStyle = "rgba(80,62,36,.45)"; G.lineWidth = Math.max(1, u * 0.15); G.stroke(); G.restore();
      };
      if (f < 0) flap();
      /* carta que sale */
      if (ls > 0 || f < 0.2) {
        const lw = ew * 0.9, lh = eh * 1.25, lx = mx - lw / 2, ly = y0 + eh * 0.1 - ls * eh * 0.9;
        G.save(); G.beginPath(); G.rect(x0 - ew, y0 - H, ew * 3, y1 - (y0 - H) - eh * 0.05); G.clip();
        G.drawImage(S.c, lx - S.m, ly - S.m, S.w, S.h);
        hand.forEach((T, i) => G.drawImage(T.c, lx + lw * 0.07 + (i ? 0 : lfs), ly + lh * 0.12 + i * lfs * 1.6 - T.base, T.w, T.h));
        G.restore();
      }
      /* bolsillo delantero (solapas laterales e inferior) */
      G.save(); G.beginPath(); G.moveTo(x0, y0); G.lineTo(mx, y0 + eh * 0.52); G.lineTo(x1, y0); G.lineTo(x1, y1); G.lineTo(x0, y1); G.closePath();
      const pg = G.createLinearGradient(0, y0, 0, y1); pg.addColorStop(0, "#d9cfb4"); pg.addColorStop(1, "#cbbf9f"); G.fillStyle = pg; G.fill();
      const fam = ctx.family && ctx.family.carta;
      if (fam && fam.tile) { G.clip(); G.globalAlpha *= 0.35; G.globalCompositeOperation = "multiply"; G.drawImage(fam.tile, x0, y0, fam.TW, fam.TH); }
      G.restore();
      G.save(); G.strokeStyle = "rgba(80,62,36,.4)"; G.lineWidth = Math.max(1, u * 0.15);
      G.beginPath(); G.moveTo(x0, y1); G.lineTo(mx - ew * 0.06, y0 + eh * 0.58); G.moveTo(x1, y1); G.lineTo(mx + ew * 0.06, y0 + eh * 0.58); G.stroke(); G.restore();
      /* estampilla + matasellos en el frente */
      G.save(); G.translate(x1 - sw * 0.8, y1 - sw * 0.85); G.rotate(0.04); G.drawImage(stC, -sw / 2, -sw * 0.61, sw, sw * 1.22); G.restore();
      G.save(); G.globalAlpha *= 0.85; G.translate(x1 - sw * 1.3, y1 - sw * 0.7); G.rotate(-0.2); G.drawImage(pm.c, -pm.cx, -pm.cy, pm.w * 0.9, pm.h * 0.9); G.restore();
      if (f >= 0) flap();
      /* lacre en la punta de la solapa (se va con ella) */
      const wy = y0 + (apex - y0) * 0.92, wr = ew * 0.055;
      G.save(); G.translate(mx, wy); G.scale(1, Math.max(0.15, Math.abs(f)));
      const wg = G.createRadialGradient(-wr * 0.3, -wr * 0.3, wr * 0.1, 0, 0, wr); wg.addColorStop(0, "#6a2e1e"); wg.addColorStop(1, "#3a160d");
      G.fillStyle = wg; G.beginPath(); for (let k = 0; k <= 24; k++) { const a = k / 24 * 6.283, rr = wr * (1 + 0.08 * Math.sin(k * 2.7)); k ? G.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : G.moveTo(rr, 0); } G.fill();
      G.strokeStyle = "rgba(240,210,180,.25)"; G.lineWidth = wr * 0.08; G.beginPath(); G.arc(0, 0, wr * 0.62, 0, 7); G.stroke();
      G.fillStyle = "rgba(240,210,180,.3)"; G.font = `400 ${wr * 0.8}px ${C.TYPE}`; G.textAlign = "center"; G.textBaseline = "middle"; G.fillText("C", 0, wr * 0.05);
      G.restore();
    };
  }
  /** bokeh: penumbra sepia con discos de luz, polvo en suspensión y una fuga de luz que barre */
  function bokehScene(ctx) {
    const { W, H } = ctx.stage, r = K.rng(901), S = Math.max(W, H);
    const discs = Array.from({ length: 14 }, () => ({ x: r(), y: r(), rad: 0.04 + r() * 0.1, vx: (r() - 0.5) * 0.02, vy: -0.004 - r() * 0.01, w: 0.3 + r() * 0.6, ph: r() * 6.28, a: 0.18 + r() * 0.3 }));
    const dust = Array.from({ length: 70 }, () => ({ x: r(), y: r(), s: 0.6 + r() * 1.8, vx: (r() - 0.5) * 0.01, vy: -0.006 - r() * 0.012, ph: r() * 6.28 }));
    return (G, st, lt) => {
      const bg = G.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#3a2c19"); bg.addColorStop(1, "#160d05");
      G.fillStyle = bg; G.fillRect(-W * 0.2, -H * 0.2, W * 1.4, H * 1.4);
      const fam = ctx.family && ctx.family.carta;
      if (fam && fam.tile) { G.save(); G.globalAlpha *= 0.14; G.globalCompositeOperation = "overlay"; G.drawImage(fam.tile, -lt * W * 0.01, 0, fam.TW, fam.TH); G.restore(); }
      const gl = G.createRadialGradient(W * 0.5, H * 0.45, 0, W * 0.5, H * 0.45, S * 0.6); gl.addColorStop(0, "rgba(214,170,110,.28)"); gl.addColorStop(1, "rgba(214,170,110,0)");
      G.fillStyle = gl; G.fillRect(0, 0, W, H);
      G.save(); G.globalCompositeOperation = "lighter";
      for (const d of discs) {
        const x = ((d.x + d.vx * lt) % 1.2 + 1.2) % 1.2 - 0.1, y = ((d.y + d.vy * lt) % 1.2 + 1.2) % 1.2 - 0.1, R = d.rad * S;
        const a = d.a * (0.5 + 0.5 * Math.sin(lt * d.w + d.ph) ** 2), gr = G.createRadialGradient(x * W, y * H, 0, x * W, y * H, R);
        gr.addColorStop(0, `rgba(240,205,150,${a})`); gr.addColorStop(0.7, `rgba(240,205,150,${a * 0.8})`); gr.addColorStop(1, "rgba(240,205,150,0)");
        G.fillStyle = gr; G.beginPath(); G.arc(x * W, y * H, R, 0, 7); G.fill();
      }
      for (const d of dust) {
        const x = (((d.x + d.vx * lt + Math.sin(lt * 0.7 + d.ph) * 0.01) % 1) + 1) % 1, y = (((d.y + d.vy * lt) % 1) + 1) % 1;
        G.fillStyle = `rgba(255,236,200,${0.25 + 0.25 * Math.sin(lt * 2 + d.ph)})`; G.beginPath(); G.arc(x * W, y * H, d.s, 0, 7); G.fill();
      }
      /* fuga de luz diagonal que cruza lento */
      const lx = (((lt * 0.12 + 0.1) % 1.6) - 0.3) * W, lk = G.createLinearGradient(lx - W * 0.25, 0, lx + W * 0.25, H * 0.3);
      lk.addColorStop(0, "rgba(255,190,120,0)"); lk.addColorStop(0.5, "rgba(255,190,120,.12)"); lk.addColorStop(1, "rgba(255,190,120,0)");
      G.fillStyle = lk; G.fillRect(0, 0, W, H);
      G.restore();
    };
  }
  /** fondo intercambiable con el lenguaje de carta (paper wash en vez de oscurecer) */
  function makeBG(ctx, p, o = {}) {
    const presets = {};
    const lazy = (name, mk) => { let f = null; presets[name] = (G, st, lt, b) => { (f || (f = mk()))(G, st, lt, b); }; };
    lazy("hoja", () => hojaScene(ctx, o));
    lazy("sobre", () => sobreScene(ctx, o));
    lazy("bokeh", () => bokehScene(ctx));
    const sepiaCache = new WeakMap();
    const BG = K.hook.bg(ctx, { ...p, dim: 0 }, {
      auto: o.auto || "hoja", presets,
      tone: img => { let c = sepiaCache.get(img); if (!c) { const s = Math.min(1, 1600 / Math.max(img.width, img.height)); c = C.sepia(img, Math.round(img.width * s), Math.round(img.height * s)); sepiaCache.set(img, c); } return c; },
    });
    return {
      mode: BG.mode, paperish: PAPERISH.has(BG.mode),
      render(lt, b, t) {
        BG.render(lt, b, t);
        if (BG.mode === "image" || BG.mode === "component") {
          const G = ctx.g.main, { W, H } = ctx.stage, d = p.dim ?? 0.45;
          /* "dim" del diseño: lavado de papel (la foto queda como una copia vieja y desvaída) */
          if (d > 0) { G.fillStyle = `rgba(222,214,194,${d})`; G.fillRect(-W * 0.2, -H * 0.2, W * 1.4, H * 1.4); }
          const vg = G.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) * 0.6);
          vg.addColorStop(0, "rgba(60,42,20,0)"); vg.addColorStop(1, "rgba(60,42,20,.45)"); G.fillStyle = vg; G.fillRect(0, 0, W, H);
        }
      },
      dispose() { BG.dispose(); },
    };
  }
  /** cámara que vuela desde el lente (zoom grande + desenfoque) y sigue acercándose despacio */
  function lensCam(lt, dur) {
    const q = prog(lt, 0, 1.05, "out");
    const z = 1 + 0.36 * (1 - q) + 0.05 * clamp(lt / Math.max(4, dur));
    return { z, blur: (1 - q) * 9 };
  }

  C.hook = { words, shake, flyQ, sheet, vintage, postage, stampMotif, postmark, rubber, splat, scrap, drawScrap, reveal, inkStroke, bez, makeBG, lensCam, meas, PRESETS, STAMP_RGB };

  /* ================================================================ introv1 */
  K.register({
    name: "carta.introv1", tags: ["intro", "gancho", "apertura", "título", "carta", "impacto"], layer: "main", post: 0.6,
    summary: "GANCHO de apertura (lo primero que se ve). La cámara vuela desde el lente hasta la gran hoja de papel viejo (bg: hoja | sobre | bokeh | image con src | component con use/useParams). Por defecto 'hoja': la cámara viaja por la hoja, dos fotos sepia se revelan con borde de pincel quemado, una carta se escribe sola, estampilla con matasellos y firma. El titular GIGANTE de máquina de escribir llega palabra por palabra desde delante del lente (escala, desenfoque y sacudida); '^palabra^' va en un rótulo crema de doble borde con subrayado de pluma. Momento de impacto: un MATASELLOS golpea encima (sealAt) con salpicadura de tinta. Sale volando hacia el lente.",
    example: { text: "LA NOCHE QUE\nCAYÓ EL ^MURO^", kicker: "Berlín · 9 de noviembre de 1989", sub: "la historia que nadie esperaba", seal: "BERLÍN|1989|ARCHIVO", sealAt: 2.3 },
    params: {
      text: { type: "string", required: true, doc: "Titular gancho, corto (2–6 palabras). '\\n' = renglón; '^x^' = palabra destacada (rótulo crema + subrayado de pluma)." },
      kicker: { type: "string", default: "", doc: "Rótulo chico arriba, tipeado (lugar · fecha)." },
      sub: { type: "string", default: "", doc: "Línea manuscrita debajo del titular (se escribe con pluma)." },
      seal: { type: "string", default: "CORREO|★|ARCHIVO", doc: "Matasellos 'ARRIBA|CENTRO|ABAJO' que golpea (vacío = sin matasellos)." },
      sealAt: { type: "number", default: 2.3, doc: "Segundo en que golpea el matasellos (-1 = no golpea; acepta '@palabra')." },
      wordAt: { type: "number", default: 0.5, doc: "Segundo en que llega la primera palabra." },
      stagger: { type: "number", default: 0.3, min: 0.08, doc: "Segundos entre palabra y palabra." },
      ...K.hook.bgParams(PRESETS),
      dim: { type: "number", default: 0.35, min: 0, max: 1, doc: "Lavado de papel sobre el fondo foto/componente (0 = nada)." },
    },
    create(ctx, p) {
      ctx.beat.hideCaptions = true;
      const { W, H, u, portrait } = ctx.stage;
      /* 9:16: se vuelven a partir los renglones (palabras más grandes, toda la altura) */
      const Ls = portrait ? rewrap(words(p.text)) : words(p.text);
      /* cuerpo: el renglón más ancho llena ~80 % del ancho, limitado por alto */
      const SP = 0.34, ACCP = 0.5;
      const lineW = (l, fs) => l.reduce((a, w, i) => a + meas(w.w, fs) + (i && !w.glue ? fs * SP : 0) + (w.acc ? fs * ACCP : 0), 0);
      const maxW = Math.max(1, ...Ls.map(l => lineW(l, 100)));
      const fs = portrait ? Math.min(100 * W * 0.88 / maxW, H * 0.4 / (Ls.length * 1.2)) : Math.min(100 * W * 0.8 / maxW, H * 0.21 * (Ls.length > 2 ? 0.8 : 1));
      const lh = fs * 1.2, cy = H * (portrait ? 0.4 : 0.45);
      let idx = 0; const placed = [];
      Ls.forEach((line, li) => {
        let x = W / 2 - lineW(line, fs) / 2; const yb = cy + (li - (Ls.length - 1) / 2) * lh + fs * 0.36;
        line.forEach((w, k) => {
          if (k && !w.glue) x += fs * SP;
          if (w.acc) x += fs * ACCP / 2;
          const T = C.typeText(ctx, w.w, fs, { heavy: 0.055, color: w.acc ? ACC : INK, wear: 26 });
          const r = K.rng(K.hash(w.w + li + k));
          placed.push({ ...w, x, yb, T, ww: T.tw, i: w.glue ? idx - 1 : idx++, rot: (r() - 0.5) * 0.03, dy: (r() - 0.5) * fs * 0.04, seed: 31 + idx * 7 });
          x += T.tw + (w.acc ? fs * ACCP / 2 : 0);
        });
      });
      const t0Of = w => p.wordAt + w.i * p.stagger;
      const hits = placed.map(w => t0Of(w) + 0.3);
      const lastHit = hits.length ? Math.max(...hits) : p.wordAt;
      const blockTop = cy - lh * Ls.length / 2 - fs * 0.1, blockBot = cy + lh * Ls.length / 2;
      const blockW = maxW * fs / 100;
      /* rótulo superior (máquina) y línea manuscrita */
      const ks = u * (portrait ? 2.9 : 2.4), kT = p.kicker ? C.typeText(ctx, String(p.kicker).toUpperCase(), ks, { heavy: 0.03, wear: 14 }) : null;
      const ss = C.fitSize(p.sub || "", u * (portrait ? 6.4 : 6.2), W * 0.86, C.HAND);
      const sT = p.sub ? C.typeText(ctx, p.sub, ss, { font: C.HAND, heavy: 0, color: "rgba(32,22,10,.95)", wear: 0 }) : null;
      /* matasellos */
      const R = portrait ? W * 0.12 : Math.min(fs * 0.55, H * 0.1);
      const PM = p.seal ? postmark(ctx, R, p.seal, true) : null;
      const sealOn = PM && p.sealAt >= 0;
      const sealX = portrait ? W * 0.72 : Math.min(W - R * 1.2, W / 2 + blockW / 2 + R * 0.3);
      const sealY = portrait ? blockBot + R * 2.0 : Math.max(R * 1.15, blockTop - R * 0.3);
      const allHits = hits.concat(sealOn ? [p.sealAt + 0.12] : []);
      const BG = makeBG(ctx, p, { auto: "hoja", seed: 3 });
      const band = !BG.paperish;
      const SC = band ? scrap(ctx, Math.min(W * 0.96, blockW + fs * 1.2), (blockBot - blockTop) + fs * 0.7 + (sT ? ss * 1.8 : 0), 17) : null;
      return {
        dispose() { BG.dispose(); },
        render(lt, b) {
          const G = ctx.g.main, oq = clamp((lt - b.dur) / 0.6), cam = lensCam(lt, b.dur);
          const [sx, sy] = shake(lt, allHits, u * 0.85);
          G.save(); G.globalAlpha = 1 - oq;
          G.translate(W / 2 + sx, H / 2 + sy); G.scale(cam.z * (1 + oq * 0.2), cam.z * (1 + oq * 0.2)); G.translate(-W / 2, -H / 2);
          if (cam.blur > 0.4) G.filter = `blur(${cam.blur.toFixed(1)}px)`;
          BG.render(lt, b);
          G.restore();
          /* legibilidad: lavado de papel detrás del titular (y un trozo de carta sobre fondos oscuros/foto) */
          G.save(); G.globalAlpha = (1 - oq) * prog(lt, p.wordAt - 0.3, 0.5, "linear");
          const bh = (blockBot - blockTop) * 0.9 + fs, gr = G.createLinearGradient(0, cy - bh, 0, cy + bh);
          gr.addColorStop(0, "rgba(222,214,194,0)"); gr.addColorStop(0.5, `rgba(222,214,194,${band ? 0.75 : 0.62})`); gr.addColorStop(1, "rgba(222,214,194,0)");
          G.fillStyle = gr; G.fillRect(0, cy - bh, W, bh * 2); G.restore();
          if (SC) {
            const f = flyQ(lt, p.wordAt - 0.25, 0.4, 3);
            if (f.q > 0) { G.save(); if (f.blur > 0.4) G.filter = `blur(${f.blur.toFixed(1)}px)`; drawScrap(G, SC, W / 2 + sx * 0.5, cy + (sT ? ss * 0.8 : 0) + sy * 0.5, -0.012, f.s * (1 + oq * 0.5), f.a * (1 - oq), u); G.restore(); }
          }
          /* titular: cada palabra llega desde el lente y se asienta con un golpe */
          /* salida: todo el titular pasa de largo hacia el lente (escala desde el centro) */
          G.save(); G.translate(sx * 0.6, sy * 0.6); G.translate(W / 2, cy); G.scale(1 + oq * 0.7, 1 + oq * 0.7); G.translate(-W / 2, -cy);
          for (const w of placed) {
            const f = flyQ(lt, t0Of(w), 0.34, 5.5);
            if (f.q <= 0) continue;
            const ccx = w.x + w.ww / 2, ccy = w.yb - fs * 0.36 + w.dy, s = f.s;
            G.save(); G.globalAlpha = f.a * (1 - oq);
            G.translate(ccx, ccy); G.rotate(w.rot + (1 - f.q) * (w.i % 2 ? 0.12 : -0.12)); G.scale(s, s); G.translate(-ccx, -ccy);
            const bl = f.blur + oq * 8; if (bl > 0.4) G.filter = `blur(${bl.toFixed(1)}px)`;
            if (w.acc) {
              /* rótulo crema de doble borde (como los de los paneles) */
              const bw = w.ww + fs * 0.42, bhh = fs * 1.12, bx = ccx - bw / 2, by = ccy - bhh / 2 + fs * 0.02;
              G.fillStyle = "rgba(232,225,207,.92)"; G.fillRect(bx, by, bw, bhh);
              G.strokeStyle = "rgba(216,208,188,1)"; G.lineWidth = Math.max(1.5, fs * 0.05); G.strokeRect(bx, by, bw, bhh);
              G.strokeStyle = "rgba(70,56,34,.75)"; G.lineWidth = Math.max(0.8, fs * 0.014); G.strokeRect(bx + fs * 0.06, by + fs * 0.06, bw - fs * 0.12, bhh - fs * 0.12);
            } else { G.shadowColor = "rgba(226,218,199,.9)"; G.shadowBlur = fs * 0.1; }
            G.drawImage(w.T.c, w.x - w.T.pad, w.yb - w.T.base + w.dy, w.T.w, w.T.h);
            G.restore();
            /* subrayado de pluma bajo la palabra destacada */
            if (w.acc) {
              const uq = prog(lt, t0Of(w) + 0.45, 0.45, "out");
              const y = w.yb + fs * 0.32 + w.dy, x0 = w.x - fs * 0.25, x1 = w.x + w.ww + fs * 0.3;
              G.save(); G.globalAlpha = 1 - oq; inkStroke(G, bez(x0, y + fs * 0.04, (x0 + x1) / 2, y + fs * 0.16, x1, y - fs * 0.03), uq, fs * 0.07); G.restore();
            }
          }
          G.restore();
          /* rótulo tipeado arriba, con dos reglas */
          if (kT) {
            const ky = blockTop - u * (portrait ? 3.4 : 3.8), nch = String(p.kicker).length;
            const q = Math.floor(prog(lt, 0.2, nch / 32, "linear") * nch) / nch;      /* tecla a tecla */
            const kx = W / 2 - kT.tw / 2 - kT.pad;
            G.save(); G.globalAlpha = 1 - oq; reveal(G, kT, kx, ky - kT.base, q, false);
            const rq = prog(lt, 0.25, 0.6, "out"), rw = Math.min(u * 12, W * 0.12) * rq, gap = u * 2;
            G.strokeStyle = "rgba(30,22,12,.8)"; G.lineWidth = Math.max(1, u * 0.2);
            G.beginPath(); G.moveTo(W / 2 - kT.tw / 2 - gap, ky - ks * 0.35); G.lineTo(W / 2 - kT.tw / 2 - gap - rw, ky - ks * 0.35);
            G.moveTo(W / 2 + kT.tw / 2 + gap, ky - ks * 0.35); G.lineTo(W / 2 + kT.tw / 2 + gap + rw, ky - ks * 0.35); G.stroke();
            G.restore();
          }
          /* línea manuscrita que se escribe con pluma */
          if (sT) {
            G.save(); G.globalAlpha = 1 - oq;
            reveal(G, sT, W / 2 - sT.tw / 2 - sT.pad, blockBot + ss * (portrait ? 0.9 : 0.75) - sT.base + ss * 0.6, prog(lt, lastHit + 0.15, 1.1, "linear"), true);
            G.restore();
          }
          /* matasellos que golpea (momento de impacto) */
          if (sealOn && lt >= p.sealAt) {
            const q = prog(lt, p.sealAt, 0.14, "linear"), s = 1 + 1.6 * (1 - ease.out(q));
            G.save(); G.globalAlpha = clamp(q * 4) * (1 - oq) * 0.92; G.translate(sealX + sx * 0.4, sealY + sy * 0.4); G.rotate(-0.22); G.scale(s, s);
            if (q < 1) G.filter = `blur(${((1 - q) * 6).toFixed(1)}px)`;
            G.drawImage(PM.c, -PM.cx, -PM.cy, PM.w, PM.h); G.restore();
            G.save(); G.globalAlpha = 1 - oq; splat(G, sealX, sealY, R * 1.25, prog(lt, p.sealAt + 0.1, 0.12, "out"), 404, 0.7); G.restore();
          }
        },
      };
    },
  });

  /* ================================================================ introv2 */
  K.register({
    name: "carta.introv2", tags: ["intro", "gancho", "apertura", "pregunta", "sello", "máquina de escribir"], layer: "main", post: 0.6,
    summary: "GANCHO pregunta + revelación. Una hoja de carta entra a la máquina y la pregunta se TIPEA tecla a tecla (cada golpe sacude la hoja, cursor de tipos); después un SELLO de goma entintado golpea encima con la respuesta, con salpicadura y sacudida. Fondo adaptable (bg: sobre | hoja | bokeh | image con src | component con use/useParams); por defecto un sobre lacrado que se abre y deja salir la carta escrita.",
    example: { text: "¿QUIÉN ABRIÓ\nEL MURO?", kicker: "Berlín · 9 de noviembre de 1989", stamp: "NADIE DIO LA ORDEN", stampAt: 2.6 },
    params: {
      text: { type: "string", required: true, doc: "Pregunta gancho ('\\n' = renglón)." },
      kicker: { type: "string", default: "", doc: "Rótulo chico arriba de la hoja." },
      stamp: { type: "string", default: "", doc: "Respuesta del sello de goma que golpea (vacío = sin sello)." },
      stampAt: { type: "number", default: 2.6, doc: "Segundo del sello (acepta '@palabra')." },
      typeAt: { type: "number", default: 0.45, doc: "Segundo en que empieza a tipearse la pregunta." },
      cps: { type: "number", default: 16, min: 4, doc: "Letras por segundo del tipeo." },
      ...K.hook.bgParams(PRESETS, "sobre"),
      dim: { type: "number", default: 0.35, min: 0, max: 1, doc: "Lavado de papel sobre el fondo foto/componente (0 = nada)." },
    },
    create(ctx, p) {
      ctx.beat.hideCaptions = true;
      const { W, H, u, portrait } = ctx.stage;
      const Ls0 = String(p.text ?? "").toUpperCase().split("\n").map(s => s.trim()).filter(Boolean);
      /* 9:16: renglones cortos y letra grande (toda la altura) */
      const Ls = portrait ? rewrap([Ls0.join(" ").split(/\s+/).map(w => ({ w, acc: false, glue: false }))]).map(l => l.map(w => w.w).join(" ")) : Ls0;
      const colW = portrait ? W * 0.8 : W * 0.46;
      const widest = Math.max(1, ...Ls.map(s => meas(s, 100)));
      const fs = Math.min(100 * colW / widest, portrait ? H * 0.34 / (Ls.length * 1.18) : H * 0.15);
      const lh = fs * 1.18, padX = fs * 0.55, padY = fs * 0.6;
      const textW = widest * fs / 100;
      const stamp = String(p.stamp || "").toUpperCase();
      const sfs0 = Math.min(fs * 0.8, (portrait ? W * 0.82 : W * 0.44) / Math.max(1, meas(stamp, 1) * 1.25));
      const RB = stamp ? rubber(ctx, stamp, sfs0) : null;
      const sheetW = Math.max(textW, RB ? RB.w * 0.9 : 0) + padX * 2, sheetH = Ls.length * lh + padY * 2 + (RB ? RB.h * 0.95 : 0);
      const sx0 = portrait ? W / 2 - sheetW / 2 : W * 0.06, sy0 = portrait ? Math.max(H * 0.1, H * 0.4 - sheetH / 2) : Math.max(H * 0.12, H * 0.5 - sheetH / 2 + u * 2);
      const tx = sx0 + padX, ty = sy0 + padY;
      const Ts = Ls.map(s => C.typeText(ctx, s, fs, { heavy: 0.05, wear: 24 }));
      const total = Ls.reduce((a, s) => a + s.length, 0);
      const SC = scrap(ctx, sheetW, sheetH, 29);
      const ks = u * (portrait ? 2.8 : 2.3), kT = p.kicker ? C.typeText(ctx, String(p.kicker).toUpperCase(), ks, { heavy: 0.03, wear: 14 }) : null;
      const BG = makeBG(ctx, p, { auto: "sobre", side: portrait ? "center" : "right", seed: 7 });
      const stX = portrait ? W / 2 : sx0 + sheetW / 2 + u * 2, stY = ty + Ls.length * lh + (RB ? RB.h * 0.42 : 0);
      return {
        dispose() { BG.dispose(); },
        render(lt, b) {
          const G = ctx.g.main, oq = clamp((lt - b.dur) / 0.6), cam = lensCam(lt, b.dur);
          const hits = RB ? [p.stampAt + 0.12] : [], [sx, sy] = shake(lt, hits, u * 1.0);
          G.save(); G.globalAlpha = 1 - oq; G.translate(W / 2 + sx, H / 2 + sy); G.scale(cam.z, cam.z); G.translate(-W / 2, -H / 2);
          if (cam.blur > 0.4) G.filter = `blur(${cam.blur.toFixed(1)}px)`;
          BG.render(lt, b);
          G.restore();
          if (!BG.paperish) { G.save(); G.globalAlpha = 1 - oq; const gr = portrait ? G.createLinearGradient(0, 0, 0, H * 0.75) : G.createLinearGradient(0, 0, W * 0.7, 0); gr.addColorStop(0, "rgba(30,20,8,.55)"); gr.addColorStop(1, "rgba(30,20,8,0)"); G.fillStyle = gr; G.fillRect(0, 0, W, H); G.restore(); }
          /* teclas: n letras escritas (stop-motion a 24 fps); cada golpe sacude la hoja */
          const tt = Math.floor(lt * 24) / 24, n = Math.floor(clamp((tt - p.typeAt) * p.cps, 0, total));
          const kAge = (tt - p.typeAt) * p.cps - n, strike = n > 0 && n < total ? Math.max(0, 1 - kAge * 3) : 0;
          /* hoja que entra desde abajo (como al meterla en el rodillo) */
          const enter = prog(lt, 0.05, 0.55, "out"), ox = -oq * W * 0.15, oy = (1 - enter) * H * 0.6 + strike * u * 0.25;
          G.save(); G.globalAlpha = 1 - oq; G.translate(ox, oy);
          drawScrap(G, SC, sx0 + SC.w / 2 - SC.m, sy0 + SC.h / 2 - SC.m, portrait ? 0.008 : -0.012, 1, 1, u);
          G.translate(sx * 0.3, sy * 0.3);
          let left = n, caretDone = false;
          Ts.forEach((T, i) => {
            const s = Ls[i], k = Math.min(s.length, left); left -= k;
            const x = portrait ? W / 2 - meas(s, fs) / 2 : tx, y = ty + i * lh + fs * 0.85;
            if (k > 0) { const w = T.pad + meas(s.slice(0, k), fs) + fs * 0.04; G.drawImage(T.c, 0, 0, w / T.w * T.c.width, T.c.height, x - T.pad, y - T.base, w, T.h); }
            /* cursor (barra de tipos) donde cae la próxima tecla */
            if (!caretDone && k < s.length && n < total && lt > p.typeAt - 0.5) {
              caretDone = true;
              const cx = x + meas(s.slice(0, k), fs) + fs * 0.05, on = n > 0 || Math.floor(lt * 3) % 2 === 0;
              if (on) { G.fillStyle = "rgba(30,22,12,.75)"; G.fillRect(cx, y + fs * 0.12, fs * 0.5, Math.max(2, fs * 0.07)); }
            }
          });
          G.restore();
          if (kT) {
            const kx = portrait ? W / 2 - kT.tw / 2 - kT.pad : sx0 + u * 0.5 - kT.pad, ky = sy0 - u * 2.2 + oy;
            G.save(); G.globalAlpha = (1 - oq) * prog(lt, 0.2, 0.3, "linear"); reveal(G, kT, kx, ky - kT.base, prog(lt, 0.2, 0.7, "linear"), false);
            G.fillStyle = BG.paperish ? "rgba(30,22,12,.8)" : "rgba(226,218,199,.8)"; const rx = portrait ? W / 2 - kT.tw / 2 : sx0 + u * 0.5;
            G.fillRect(rx, ky + ks * 0.35, kT.tw * prog(lt, 0.5, 0.6, "out"), Math.max(1, u * 0.18)); G.restore();
          }
          /* sello de goma con la respuesta */
          if (RB && lt >= p.stampAt) {
            const q = prog(lt, p.stampAt, 0.15, "linear"), s = 1 + 1.5 * (1 - ease.expoOut(q));
            G.save(); G.globalAlpha = clamp(q * 4) * (1 - oq); G.translate(stX + sx + ox, stY + sy + oy); G.rotate(-0.075); G.scale(s, s);
            if (q < 1) G.filter = `blur(${((1 - q) * 6).toFixed(1)}px)`;
            G.globalCompositeOperation = "multiply"; G.drawImage(RB.c, -RB.w / 2, -RB.h / 2, RB.w, RB.h); G.restore();
            G.save(); G.globalAlpha = 1 - oq; splat(G, stX + ox, stY + oy, RB.w * 0.42, prog(lt, p.stampAt + 0.1, 0.12, "out"), 77, 0.55, STAMP_RGB); G.restore();
          }
        },
      };
    },
  });
})();
