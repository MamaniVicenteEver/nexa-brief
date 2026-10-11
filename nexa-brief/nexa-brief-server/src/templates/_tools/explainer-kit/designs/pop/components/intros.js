/* =============================================================================
   pop · intros (el gancho: lo primero que se ve en YouTube)
   introv1 = titular GIGANTE apilado en tiras violeta: cada palabra entra
             aplastada en rosa → rebanada en bloques glitch → se asienta en menta
             con sacudida; la palabra ^destacada^ va en caja menta con op-art (o la
             foto) DENTRO de las letras. En glitchAt el cuadro entero se rompe en
             bloques + parpadeo de paleta, aparece la sombra rosa y anillos.
   introv2 = cortina líquida violeta; la pregunta se DECODIFICA letra por letra
             (letras al azar en rosa que se resuelven en menta) y la respuesta
             llega como CINTA menta inclinada que golpea con glitch, flecha gruesa
             que entra parpadeando y anillos.
   Fondos propios (Kit.pop.hook.scenes, también los usa outro.js), todos neutros:
     columns · columnas de mosaicos (rayado, op-art, círculos, triángulos, foto)
               que se deslizan en sentidos opuestos + arcos grises que giran
     opart   · ondas op-art del duotono que se deforman + anillos punteados
     shapes  · círculo violeta, triángulo rosa que gira, barrido de rayas,
               flechas en fila, cruces que parpadean
     kanji   · violeta con renglones de kanji en diagonal isométrica que derivan
               y un triángulo menta que crece (el texto cambia de color al cruzarlo)
     tiles   · mosaico de marcas del canal con filas desfasadas (cierre)
   Todo es función pura de lt (render cuadro a cuadro con seek).
   ========================================================================== */
(function () {
  const K = Kit, P0 = Kit.pop, { clamp, lerp, prog, ease } = K;
  const TAU = Math.PI * 2, SCR = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const fr = lt => Math.floor(lt * 30 + 1e-6);
  const mkc = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
  const outQ = (lt, b, post = 0.6) => clamp((lt - b.dur) / post);

  /* ------------------------------------------------------------ texto */
  /** "¿POR QUÉ CAYÓ\nEL ^MURO^?" → [[{w, acc, glue}]] (renglones de palabras; ^x^ = destacada) */
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
  /** en 9:16 rearma los renglones largos (≤ max letras) para que el titular sea más grande */
  function rewrap(Ls, max) {
    /* si ningún renglón se pasa, se respetan los cortes del autor; si no, se reparte todo de nuevo */
    if (Ls.every(l => l.reduce((a, w, k) => a + w.w.length + (k && !w.glue ? 1 : 0), 0) <= max)) return Ls;
    const out = [];
    for (const line of [Ls.flat()]) {
      let cur = [], n = 0;
      for (const w of line) {
        const len = w.w.length;
        if (cur.length && !w.glue && n + 1 + len > max) { out.push(cur); cur = []; n = 0; }
        n += (cur.length && !w.glue ? 1 : 0) + len; cur.push(cur.length ? w : { ...w, glue: false });
      }
      if (cur.length) out.push(cur);
    }
    return out;
  }
  /** sacudida de cámara: suma de golpes que decaen (determinista) */
  function shake(lt, hits, amp) {
    let a = 0; for (const h of hits) { const d = lt - h; if (d >= 0 && d < 0.28) a += Math.pow(1 - d / 0.28, 2); }
    return [Math.sin(lt * 93) * amp * a, Math.cos(lt * 71) * amp * a * 0.8];
  }
  /** texto que se decodifica: letras al azar que se van resolviendo de izquierda a derecha */
  function decode(s, k, rate, seed) {
    if (k < 0) return "";
    const r = K.rng(seed * 131 + fr(k) * 7 + 1), solved = Math.floor(k * rate);
    return [...String(s)].map((c, j) => (j < solved || c === " " ? c : SCR[Math.floor(r() * SCR.length)])).join("");
  }
  /** palabra pre-renderizada (Archivo extendida 900) en un lienzo propio */
  function wordCanvas(s, fs, color, dpr, st = "expanded") {
    const f = P0.font(fs, 900, st), sp = -fs * 0.03, w = P0.measure(s, f, sp), pad = fs * 0.22;
    const c = mkc((w + pad * 2) * dpr, fs * 1.4 * dpr), g = c.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.font = f; g.letterSpacing = sp + "px"; g.fillStyle = color; g.fillText(s, pad, fs * 1.05);
    return { c, g, w, pad, cw: w + pad * 2, ch: fs * 1.4, base: fs * 1.05, dpr };
  }

  /* ------------------------------------------------------------ formas */
  /** paralelogramo inclinado (x,y = esquina sup. izq. de la caja, sk = inclinación) */
  function para(G, x, y, w, h, sk) { P0.poly(G, [[x + sk, y], [x + w + sk, y], [x + w - sk, y + h], [x - sk, y + h]]); }
  /** recorte de barrido desde la izquierda con borde de sierra mientras avanza (q 0..1) */
  function wipeClip(G, x, y, w, h, q, tooth) {
    const ex = x + w * q;
    G.beginPath(); G.moveTo(x - tooth * 3, y - tooth * 3);
    if (q < 1) { let k = 0; for (let yy = y - tooth * 3; yy <= y + h + tooth * 4; yy += tooth * 0.6, k++) G.lineTo(ex + (k % 2 ? tooth : -tooth), yy); }
    else { G.lineTo(ex + tooth * 4, y - tooth * 3); G.lineTo(ex + tooth * 4, y + h + tooth * 3); }
    G.lineTo(x - tooth * 3, y + h + tooth * 3); G.closePath(); G.clip();
  }
  /** sombra rayada desplazada (d) de un paralelogramo */
  function hatchShadow(G, x, y, w, h, sk, d, color) {
    G.save(); para(G, x + d, y + d, w, h, sk); G.clip();
    P0.hatch(G, x + d - Math.abs(sk) - 2, y + d, w + Math.abs(sk) * 2 + 4, h, { gap: Math.max(3, h * 0.11), bw: Math.max(1, h * 0.035), ang: -45, color });
    G.restore();
  }
  /** rótulo en placa paralelogramo (Archivo extendida 800); align center|left; q = barrido */
  function tag(G, s, x, y, size, fill, ink, q = 1, align = "center") {
    if (!s || q <= 0) return 0;
    const f = P0.font(size, 800), sp = size * 0.16, full = String(s), tw = P0.measure(full, f, sp), pad = size * 0.85, h = size * 2.1, w = tw + pad * 2;
    const bx = align === "center" ? x - w / 2 : x;
    G.save(); wipeClip(G, bx - size, y - h / 2, w + size * 2, h, q, size * 0.35);
    G.fillStyle = fill; para(G, bx, y - h / 2, w, h, size * 0.32); G.fill();
    P0.text(G, s, bx + pad, y + size * 0.37, { font: f, color: ink, sp });
    G.restore();
    return w;
  }
  /** arcos grises gruesos que giran (como "POSTERS") */
  function arcs(G, cx, cy, R, lt, lw, P) {
    G.save(); G.strokeStyle = P0.rgba(P.muted, 0.6); G.lineCap = "butt"; G.lineWidth = lw;
    for (const [a, b] of [[0, 1.4], [2.1, 2.9], [3.5, 5.2]]) { G.beginPath(); G.arc(cx, cy, R, a + lt * 0.35, b + lt * 0.35); G.stroke(); }
    G.lineWidth = lw * 0.6; for (const [a, b] of [[0.8, 2.2], [3.0, 4.1], [4.8, 5.9]]) { G.beginPath(); G.arc(cx, cy, R * 1.24, a - lt * 0.25, b - lt * 0.25); G.stroke(); }
    G.restore();
  }
  /** ondas op-art a baja resolución (L = LUT de 256 colores) */
  function opart(c, t, L, ph = 0) {
    const g = c.getContext("2d"), w = c.width, h = c.height, d = g.createImageData(w, h), a = d.data, asp = w / h;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = x / w * Math.max(1, asp), v = y / h * Math.max(1, 1 / asp);
      const r1 = Math.hypot(u - 0.3, v - 0.35) * 26, r2 = Math.hypot(u - 0.85, v - 0.8) * 22;
      const s = Math.sin(r1 + 2.2 * Math.sin(v * 6 + t * 0.9 + ph) + 1.6 * Math.cos(u * 5 - t * 0.7)) + Math.sin(r2 - t * 1.4 + ph);
      const k = Math.round(clamp(0.5 + s * 0.45) * 255) * 3, i = (y * w + x) * 4;
      a[i] = L[k]; a[i + 1] = L[k + 1]; a[i + 2] = L[k + 2]; a[i + 3] = 255;
    }
    g.putImageData(d, 0, 0);
  }
  /** anillos que se expanden desde (cx,cy) a partir de `at` */
  function rings(G, cx, cy, lt, at, R0, R1, lw, color) {
    const k = lt - at; if (k < 0 || k > 0.75) return;
    G.save(); G.strokeStyle = color;
    for (const dl of [0, 0.12]) {
      const q = clamp((k - dl) / 0.6); if (q <= 0 || q >= 1) continue;
      G.globalAlpha = 1 - q; G.lineWidth = lw * (1 - q * 0.7); G.beginPath(); G.arc(cx, cy, lerp(R0, R1, ease.out(q)), 0, TAU); G.stroke();
    }
    G.restore();
  }

  /* ================================================================ fondos propios */
  const KJ = "時代 記憶 世界 歴史 未来 声 ";
  const KCH = ["時", "記", "世", "史", "声", "未"];
  function scenes(ctx, p) {
    const P = ctx.C.palette;
    const Lop = P0.lut([[0, P.ink], [0.35, P.mid], [0.55, P.accent], [0.75, P.light], [1, P.light]]);
    let op = null;
    const opC = st => { const w = st.portrait ? 54 : 96, h = st.portrait ? 96 : 54; if (!op || op.width !== w) op = mkc(w, h); return op; };
    const photo = () => (p.src && ctx.img(p.src) ? P0.duo(ctx, p.src, "dark") : null);

    function tile(G, x, y, w, h, seed, lt, O, cv) {
      const r = K.rng(seed), type = [0, 1, 2, 3, 0, 1, 2, 3, 5, 4][Math.floor(r() * 10)];
      G.save(); G.beginPath(); G.rect(x, y, w, h); G.clip();
      if (type === 0) { G.fillStyle = P.light; G.fillRect(x, y, w, h); P0.hatch(G, x, y, w, h, { gap: w * 0.11, bw: w * 0.045, ang: -45, color: P.ink, off: lt * w * 0.25 }); }
      else if (type === 1) { G.imageSmoothingEnabled = true; G.drawImage(O, x - w * r(), y - h * r() * 0.5, w * 2.2, h * 1.6); }
      else if (type === 2) {
        G.fillStyle = P.ink; G.fillRect(x, y, w, h);
        G.strokeStyle = P.light; G.lineWidth = w * 0.045; G.beginPath(); G.arc(x + w / 2, y + h / 2, w * 0.3, 0, TAU); G.stroke();
        const a = lt * 1.6 + r() * 6; G.fillStyle = P.accent; G.beginPath(); G.arc(x + w / 2 + Math.cos(a) * w * 0.3, y + h / 2 + Math.sin(a) * w * 0.3, w * 0.07, 0, TAU); G.fill();
      } else if (type === 3) {
        if (cv) P0.cover(G, cv, x, y, w, h, { zoom: 1.2 + r() * 0.4, fx: r(), fy: 0.3 + r() * 0.4 });
        else if (r() < 0.35) { G.fillStyle = P.mid; G.fillRect(x, y, w, h); P0.text(G, KCH[Math.floor(r() * KCH.length)], x + w / 2, y + h * 0.66, { font: P0.JP(w * 0.62), color: P.light, align: "center" }); }
        else { G.fillStyle = P.mid; G.fillRect(x, y, w, h); G.fillStyle = P.light; G.beginPath(); G.arc(x + w / 2, y + h, w * 0.42, Math.PI, TAU); G.fill(); G.fillStyle = P.ink; G.beginPath(); G.arc(x + w / 2, y + h, w * 0.2, Math.PI, TAU); G.fill(); }
      } else if (type === 4) { G.fillStyle = P.accent; G.fillRect(x, y, w, h); P0.plus(G, x + w / 2, y + h / 2, w * 0.42, w * 0.11, P.ink); }
      else {
        G.fillStyle = P.light; G.fillRect(x, y, w, h); G.fillStyle = P.ink;
        P0.poly(G, [[x + w * 0.22, y + h / 2], [x + w * 0.78, y + h * 0.28], [x + w * 0.78, y + h * 0.72]]); G.fill();
        G.strokeStyle = P.ink; G.lineWidth = Math.max(1, w * 0.02); G.strokeRect(x + w * 0.06, y + w * 0.06, w * 0.88, h - w * 0.12);
      }
      G.restore();
    }
    const columns = (G, st, lt) => {
      const { W, H, u, portrait } = st, S = Math.min(W, H), cv = photo(), O = opC(st);
      G.fillStyle = P.bg; G.fillRect(0, 0, W, H);
      arcs(G, W * 0.5, H * 0.5, S * 0.4, lt, S * 0.045, P);
      opart(O, lt * 1.4, Lop);
      const n = portrait ? 3 : 5, cw = W * (portrait ? 0.27 : 0.135), step = W * (portrait ? 0.33 : 0.2), pan = -lt * u * 0.8;
      const th = cw * 1.3, per = th + u * 1.2;
      for (let j = 0; j < n; j++) {
        const q = prog(lt, 0.05 * j, 0.07, "linear"); if (q <= 0) continue;
        const x = lerp(W + cw, W * 0.035 + j * step + pan + u * 1.5, q);
        const dir = j % 2 ? 1 : -1, offY = dir * lt * u * (4 + (j % 3) * 2.5) + j * th * 0.37;
        for (let k = Math.floor(-offY / per) - 1; k * per + offY < H; k++) tile(G, x, k * per + offY, cw, th, (j + 1) * 7919 + (k + 1000) * 104729, lt, O, cv);
      }
      /* reglas finas arriba y abajo */
      G.fillStyle = P.ink; G.fillRect(0, H * 0.035, W, Math.max(1, S * 0.003)); G.fillRect(0, H * 0.965, W, Math.max(1, S * 0.003));
    };
    const opartS = (G, st, lt) => {
      const { W, H, portrait } = st, S = Math.min(W, H), O = opC(st);
      opart(O, lt * 1.3, Lop, 1.3);
      G.save(); G.imageSmoothingEnabled = true; G.drawImage(O, 0, 0, W, H); G.restore();
      G.save(); G.lineCap = "butt";
      G.strokeStyle = P0.rgba(P.light, 0.85); G.lineWidth = S * 0.008; G.setLineDash([S * 0.05, S * 0.03]); G.lineDashOffset = -lt * S * 0.12;
      G.beginPath(); G.arc(W / 2, H / 2, S * 0.44 * ease.expoOut(clamp(lt / 0.3)), 0, TAU); G.stroke();
      G.strokeStyle = P0.rgba(P.ink, 0.8); G.lineWidth = S * 0.004; G.setLineDash([S * 0.012, S * 0.02]); G.lineDashOffset = lt * S * 0.08;
      G.beginPath(); G.arc(W / 2, H / 2, S * 0.52, 0, TAU); G.stroke(); G.restore();
      const m = S * 0.07;
      for (const [x, y] of [[m, m], [W - m, m], [m, H - m], [W - m, H - m]]) P0.plus(G, x, y, S * 0.04, S * 0.009, P.ink);
      if (!portrait) for (let i = 0; i < 14; i++) { G.fillStyle = i % 4 === 1 ? P.accent : P.ink; G.fillRect(W * 0.025, H * 0.2 + i * S * 0.022, S * 0.004, S * 0.012); }
    };
    const shapes = (G, st, lt) => {
      const { W, H, u, portrait } = st, S = Math.min(W, H), f = fr(lt);
      G.fillStyle = P.bg; G.fillRect(0, 0, W, H);
      arcs(G, W * (portrait ? 0.3 : 0.28), H * 0.4, S * 0.24, lt, S * 0.035, P);
      /* círculo violeta que crece y respira, con anillo menta que gira */
      const ccx = W * (portrait ? 0.86 : 0.84), ccy = H * (portrait ? 0.2 : 0.3), cR = S * (portrait ? 0.4 : 0.46) * ease.expoOut(clamp(lt / 0.25)) * (1 + 0.025 * Math.sin(lt * 1.7));
      G.fillStyle = P.ink; G.beginPath(); G.arc(ccx, ccy, cR, 0, TAU); G.fill();
      G.save(); G.strokeStyle = P.light; G.lineWidth = S * 0.006; G.setLineDash([S * 0.04, S * 0.025]); G.lineDashOffset = lt * S * 0.1;
      G.beginPath(); G.arc(ccx, ccy, cR * 0.72, 0, TAU); G.stroke(); G.restore();
      /* triángulo rosa que gira (entra en 4 cuadros) */
      const tq = clamp(fr(lt - 0.15) / 4), ts = S * 0.34 * tq, tx = W * (portrait ? 0.16 : 0.12), ty = H * (portrait ? 0.86 : 0.8), ta = lt * 0.35;
      if (tq > 0) { G.fillStyle = P.accent; P0.poly(G, [0, 1, 2].map(i => [tx + Math.cos(ta + i * TAU / 3) * ts, ty + Math.sin(ta + i * TAU / 3) * ts])); G.fill(); }
      /* barrido de rayas en diagonal (cada 2,6 s) */
      const ph = (lt % 2.6) / 0.9;
      if (ph < 1) {
        const bx = lerp(-W * 0.45, W * 1.15, ease.inOut(ph)), bw = W * 0.22, sk = H * 0.3;
        G.save(); P0.poly(G, [[bx + sk, 0], [bx + bw + sk, 0], [bx + bw - sk, H], [bx - sk, H]]); G.clip();
        P0.hatch(G, 0, 0, W, H, { gap: S * 0.02, bw: S * 0.006, ang: -45, color: P.ink }); G.restore();
      }
      /* fila de flechas gruesas que avanzan */
      const aw = S * 0.11, span = W + aw * 3;
      for (let i = 0; i < 7; i++) {
        const x = ((lt * u * 9 + i * aw * 1.7) % span) - aw * 1.5;
        P0.arrow(G, x, H * (portrait ? 0.93 : 0.9) - aw * 0.25, aw, aw * 0.5, i === 3 ? P.accent : P.ink, 0.3);
      }
      /* grilla de cruces que parpadean */
      for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
        if (K.rng((f >> 2) * 37 + r * 5 + c + 11)() < 0.3) continue;
        P0.plus(G, W * (portrait ? 0.55 : 0.6) + c * S * 0.06, H * (portrait ? 0.62 : 0.62) + r * S * 0.06, S * 0.025, S * 0.006, P.ink);
      }
    };
    let kjW = 0;
    const kanji = (G, st, lt) => {
      const { W, H, u, portrait } = st, S = Math.min(W, H);
      G.fillStyle = P.ink; G.fillRect(0, 0, W, H);
      const tq = clamp(fr(lt - 0.1) / 4);
      const tri = portrait ? [[W, H * (1 - 0.6 * tq)], [W, H], [W * (1 - 1.1 * tq), H]] : [[W, H * (1 - 0.95 * tq)], [W, H], [W * (1 - 0.62 * tq), H]];
      G.fillStyle = P.light; P0.poly(G, tri); G.fill();
      const fs = S * 0.14, font = P0.JP(fs);
      kjW ||= P0.measure(KJ, font);
      const rows = color => {
        G.save(); G.translate(W / 2, H / 2); G.transform(0.883, -0.469, 0.26, 0.966, 0, 0);
        for (let r = -7; r <= 7; r++) {
          const dir = r % 2 ? 1 : -1, o = (((dir * lt * u * 5 + r * fs * 1.7) % kjW) + kjW) % kjW;
          P0.text(G, KJ.repeat(5), -kjW * 2 - o, r * fs * 1.3 + fs * 0.35, { font, color });
        }
        G.restore();
      };
      G.save(); G.beginPath(); G.rect(0, 0, W, H); P0.poly(G, tri); G.clip("evenodd"); rows(P0.rgba(P.mid, 0.6)); G.restore();
      if (tq > 0) { G.save(); P0.clipPoly(G, tri); rows(P0.rgba(P.ink, 0.35)); G.restore(); }
      /* borde violeta del cuadro + sub-renglón chico */
      const fw = S * 0.012; G.fillStyle = P.mid; G.fillRect(0, 0, W, fw); G.fillRect(0, H - fw, W, fw);
    };
    const tiles = (G, st, lt) => {
      const { W, H } = st, S = Math.min(W, H), f = fr(lt), cell = S * 0.17, ts = S * 0.135;
      G.fillStyle = P.bg; G.fillRect(0, 0, W, H);
      for (let r = -1, y = -cell * 0.5; y < H + cell; r++, y += cell * 0.98) {
        const off = (((r % 2 ? cell / 2 : 0) + lt * S * 0.05 * (r % 2 ? 1 : -1)) % cell + cell) % cell;
        for (let c = -2, x = -cell * 2 + off; x < W + cell; c++, x += cell) {
          const hot = K.rng((f >> 2) * 131 + (r + 9) * 17 + (c + 9) * 3)() < 0.06;
          G.fillStyle = hot ? P.accent : P.ink; G.fillRect(x, y, ts, ts * 0.86);
          G.save(); G.globalAlpha = hot ? 1 : 0.85; P0.mark(G, x + ts / 2, y + ts * 0.43, ts * 0.27, P.light); G.restore();
        }
      }
    };
    return { columns, opart: opartS, shapes, kanji, tiles };
  }
  const PRESETS = ["columns", "opart", "shapes", "kanji", "tiles"];
  /** fondo intercambiable con el lenguaje pop (fotos en duotono oscuro + velo violeta) */
  function hookBg(ctx, p, auto) {
    const BG = K.hook.bg(ctx, p, { auto, presets: scenes(ctx, p), tone: () => P0.duo(ctx, p.src, "dark") });
    const ink = ctx.C.palette.ink;
    return {
      mode: BG.mode,
      render(lt, b, t) {
        BG.render(lt, b, t);
        if (BG.mode === "image" || BG.mode === "component") {
          const G = ctx.g.main, { W, H } = ctx.stage;
          G.save(); G.fillStyle = P0.rgba(ink, 0.25); G.fillRect(0, 0, W, H); G.restore();
        }
      },
      dispose() { BG.dispose(); },
    };
  }

  P0.hook = { words, shake, decode, wordCanvas, para, wipeClip, hatchShadow, tag, arcs, opart, rings, scenes, hookBg, PRESETS, fr, mkc };

  /* ================================================================ introv1 */
  K.register({
    name: "pop.introv1", tags: ["intro", "gancho", "apertura", "título", "impacto", "glitch"], layer: "main", post: 0.6,
    summary: "GANCHO de apertura (lo primero que se ve). Titular GIGANTE apilado en tiras violeta que golpea palabra por palabra: cada palabra entra APLASTADA en rosa, se rebana en bloques glitch y se asienta en menta con sacudida; la '^palabra^' va en caja menta con op-art animado (o la foto en duotono) DENTRO de las letras. En glitchAt el cuadro se rompe en bloques + parpadeo de paleta, salta la sombra rosa de las tiras y salen anillos. Fondo adaptable (bg: columns | opart | shapes | kanji | tiles | image con src | component con use/useParams); por defecto columnas de mosaicos que se deslizan.",
    example: { text: "¿POR QUÉ CAYÓ\nEL ^MURO^?", kicker: "Berlín · 9 nov 1989", sub: "la noche que nadie vio venir", glitchAt: 2.3 },
    params: {
      text: { type: "string", required: true, doc: "Titular gancho, corto (2–6 palabras). '\\n' = renglón; '^x^' = palabra destacada (caja menta con op-art/foto dentro de las letras)." },
      kicker: { type: "string", default: "", doc: "Rótulo chico arriba (lugar · fecha), se decodifica." },
      sub: { type: "string", default: "", doc: "Línea chica debajo del titular (placa menta)." },
      wordAt: { type: "number", default: 0.4, doc: "Segundo del primer golpe de palabra." },
      stagger: { type: "number", default: 0.28, min: 0.08, doc: "Segundos entre palabra y palabra." },
      glitchAt: { type: "number", default: 2.3, doc: "Segundo del IMPACTO: glitch de bloques + parpadeo de paleta, sombra rosa y anillos (-1 = sin impacto). Acepta '@palabra'." },
      ...K.hook.bgParams(PRESETS),
    },
    create(ctx, p) {
      ctx.beat.hideCaptions = true;
      const P = ctx.C.palette, { W, H, u, portrait } = ctx.stage, S = Math.min(W, H), dpr = ctx.dpr;
      const Ls = portrait ? rewrap(words(p.text), 9) : words(p.text), nL = Math.max(1, Ls.length);
      /* tamaño: el renglón más ancho ocupa ~80 % del ancho, con tope de alto */
      const ST = portrait ? "normal" : "expanded";
      const lineW = (line, fs) => line.reduce((a, w, k) => a + P0.measure(w.w, P0.font(fs, 900, ST), -fs * 0.03) + (w.acc ? fs * 0.28 : 0) + (k && !w.glue ? fs * 0.3 : 0), 0);
      const w100 = Math.max(1, ...Ls.map(l => lineW(l, 100)));
      const fs = Math.min(W * (portrait ? 0.86 : 0.8) / w100 * 100, H * (portrait ? 0.11 : 0.21) * (nL > 2 ? 0.8 : 1));
      const lh = fs * 1.22, cy = H * (portrait ? 0.45 : 0.48), sh = fs * 1.06, sk = fs * 0.16, ap = fs * 0.14;
      let idx = 0; const placed = [], strips = [];
      Ls.forEach((line, li) => {
        const tot = lineW(line, fs), yc = cy + (li - (nL - 1) / 2) * lh;
        let x = W / 2 - tot / 2; const first = idx;
        line.forEach((w, k) => {
          if (k && !w.glue) x += fs * 0.3;
          if (w.acc) x += ap;
          const wc = wordCanvas(w.w, fs, P.light, dpr, ST), pk = wordCanvas(w.w, fs, P.accent, dpr, ST);
          const mask = w.acc ? wordCanvas(w.w, fs, "#000", dpr, ST) : null, fill = w.acc ? mkc(wc.c.width, wc.c.height) : null;
          placed.push({ ...w, x, yc, ww: wc.w, li, wc, pk, mask, fill, i: w.glue ? idx - 1 : idx++ });
          x += wc.w + (w.acc ? ap : 0);
        });
        strips.push({ x: W / 2 - tot / 2 - fs * 0.32, w: tot + fs * 0.64, yc, i0: first });
      });
      const tOf = i => p.wordAt + i * p.stagger;
      const hits = [...new Set(placed.map(w => w.i))].map(i => tOf(i) + 0.07);
      const lastHit = hits.length ? hits[hits.length - 1] : p.wordAt;
      const gAt = p.glitchAt != null && p.glitchAt >= 0 ? p.glitchAt : -1;
      const Ldk = P0.lut([[0, P.ink], [0.55, P.ink], [0.8, P.mid], [1, P.accent]]), opW = mkc(64, 40);
      const BG = hookBg(ctx, p, "columns");
      const top = cy - nL * lh / 2, bot = cy + nL * lh / 2;
      return {
        dispose() { BG.dispose(); },
        render(lt, b, t) {
          const G = ctx.g.main, oq = outQ(lt, b, 0.6), cam = 1.03 + 0.04 * clamp(lt / Math.max(4, b.dur));
          const [sx, sy] = shake(lt, gAt >= 0 ? hits.concat([gAt + 0.02]) : hits, u * 0.8);
          const imp = gAt >= 0 && lt >= gAt, ik = lt - gAt;
          /* fondo */
          G.save(); G.globalAlpha = 1 - oq;
          G.translate(W / 2 + sx, H / 2 + sy); G.scale(cam, cam); G.translate(-W / 2, -H / 2);
          BG.render(lt, b, t);
          G.restore();
          G.save(); G.globalAlpha = 1 - oq; G.translate(sx * 0.6, sy * 0.6);
          /* velo violeta suave detrás del bloque (legibilidad sobre cualquier fondo) */
          const vq = prog(lt, p.wordAt - 0.15, 0.3, "linear");
          if (vq > 0) {
            const vg = G.createLinearGradient(0, top - lh, 0, bot + lh);
            vg.addColorStop(0, P0.rgba(P.ink, 0)); vg.addColorStop(0.5, P0.rgba(P.ink, 0.35 * vq)); vg.addColorStop(1, P0.rgba(P.ink, 0));
            G.fillStyle = vg; G.fillRect(0, top - lh, W, bot - top + lh * 2);
          }
          if (imp) rings(G, W / 2, cy, lt, gAt, S * 0.12, Math.max(W, H) * 0.75, S * 0.025, P.light);
          /* triángulos ►◄ que apuntan al titular (aparecen en el impacto, 4 cuadros) */
          if (imp) {
            const q = clamp(fr(ik) / 4), ts = fs * 0.42 * q, d = Math.sin(lt * 2) * u * 0.6;
            const lx = Math.max(u * 3, strips.reduce((a, s) => Math.min(a, s.x), W) - fs * 0.75) + d, rx = Math.min(W - u * 3, strips.reduce((a, s) => Math.max(a, s.x + s.w), 0) + fs * 0.75) - d;
            if (!portrait && ts > 0) {
              G.fillStyle = P.light; G.strokeStyle = P.ink; G.lineWidth = Math.max(1, fs * 0.04);
              P0.poly(G, [[lx + ts * 0.5, cy], [lx - ts * 0.5, cy - ts * 0.6], [lx - ts * 0.5, cy + ts * 0.6]]); G.fill(); G.stroke();
              P0.poly(G, [[rx - ts * 0.5, cy], [rx + ts * 0.5, cy - ts * 0.6], [rx + ts * 0.5, cy + ts * 0.6]]); G.fill(); G.stroke();
            }
          }
          /* tiras violeta por renglón (barrido con sierra), sombra rayada y sombra rosa tras el impacto */
          strips.forEach((s, li) => {
            const t0 = tOf(placed[s.i0].i) - 0.06, q = prog(lt, t0, 0.12, "linear");
            if (q <= 0) return;
            const ox = -oq * W * 0.3 * (1 + li * 0.35), y = s.yc - sh / 2;
            G.save(); G.translate(ox, 0); wipeClip(G, s.x - sk * 2, y, s.w + sk * 4, sh, q, fs * 0.08);
            hatchShadow(G, s.x, y, s.w, sh, sk, fs * 0.11, P.ink);
            if (imp) { const d = fs * 0.11 * ease.expoOut(clamp(ik / 0.15)); G.fillStyle = P.accent; para(G, s.x - d * 0.6, y - d * 0.6, s.w, sh, sk); G.fill(); }
            G.fillStyle = P.ink; para(G, s.x, y, s.w, sh, sk); G.fill();
            G.restore();
          });
          /* palabras */
          for (const w of placed) {
            const k = lt - tOf(w.i); if (k < 0) continue;
            const f = fr(k), ccx = w.x + w.ww / 2, ox = -oq * W * 0.3 * (1 + w.li * 0.35);
            const dx = w.x - w.wc.pad + ox, dy = w.yc + fs * 0.36 - w.wc.base;
            G.save();
            if (f < 2) {                                       /* aplastada en rosa */
              G.translate(ccx + ox, w.yc); G.scale(1.45, 0.3); G.translate(-ccx - ox, -w.yc);
              G.drawImage(w.pk.c, dx, dy, w.wc.cw, w.wc.ch);
            } else if (f < 4) {                                /* rebanada en bloques glitch */
              const r = K.rng(f * 977 + w.i * 31 + 5), n = 5;
              for (let s = 0; s < n; s++) {
                const sy0 = s / n, jx = (r() - 0.5) * fs * 0.6, src = s === 2 ? w.pk : w.wc;
                G.drawImage(src.c, 0, sy0 * src.c.height, src.c.width, src.c.height / n, dx + jx, dy + sy0 * w.wc.ch, w.wc.cw, w.wc.ch / n);
              }
            } else {
              const s = 1 + 0.07 * Math.exp(-(k - 0.13) * 14), [jx, jy] = imp && ik < 0.3 ? [(K.rng(fr(ik) * 13 + w.i)() - 0.5) * fs * 0.12, 0] : [0, 0];
              G.translate(ccx + ox + jx, w.yc + jy); G.scale(s, s); G.translate(-ccx - ox, -w.yc);
              if (w.acc) {
                /* caja menta + letras con op-art (o la foto) dentro */
                G.save(); G.translate(ccx + ox, w.yc); G.rotate(-0.025); G.fillStyle = P.light;
                G.fillRect(-w.ww / 2 - ap * 1.4, -sh * 0.5, w.ww + ap * 2.8, sh); G.restore();
                const cv = BG.mode === "image" && p.src && ctx.img(p.src) ? P0.duo(ctx, p.src, "dark") : null;
                const fg = w.fill.getContext("2d"); fg.setTransform(1, 0, 0, 1, 0, 0); fg.clearRect(0, 0, w.fill.width, w.fill.height);
                fg.globalCompositeOperation = "source-over";
                if (cv) P0.cover(fg, cv, 0, 0, w.fill.width, w.fill.height, { zoom: 1.1 + lt * 0.01 });
                else { opart(opW, lt * 2.2, Ldk, w.i); fg.imageSmoothingEnabled = true; fg.drawImage(opW, 0, 0, w.fill.width, w.fill.height); }
                if (cv) { fg.globalCompositeOperation = "multiply"; fg.fillStyle = P.mid; fg.fillRect(0, 0, w.fill.width, w.fill.height); }
                fg.globalCompositeOperation = "destination-in"; fg.drawImage(w.mask.c, 0, 0);
                G.drawImage(w.fill, dx, dy, w.wc.cw, w.wc.ch);
              } else G.drawImage(w.wc.c, dx, dy, w.wc.cw, w.wc.ch);
            }
            G.restore();
          }
          G.restore();
          /* rótulos */
          const ks = u * (portrait ? 1.9 : 1.5);
          if (p.kicker) tag(G, decode(String(p.kicker).toUpperCase(), lt - 0.15, 22, 3), W / 2, top - ks * 2.2, ks, P.ink, P.light, prog(lt, 0.1, 0.14, "linear") * (1 - oq));
          if (p.sub) {
            const ss = u * (portrait ? 2.3 : 2.05), str = String(p.sub).toUpperCase(), f = P0.MONT(ss, 700), sp = ss * 0.3;
            const tw = P0.measure(str, f, sp), pw = tw + ss * 2, py = bot + ss * 2.4, q = prog(lt, lastHit + 0.15, 0.14, "linear") * (1 - oq);
            if (q > 0) {
              G.save(); wipeClip(G, W / 2 - pw / 2 - ss, py - ss * 1.1, pw + ss * 2, ss * 2.2, q, ss * 0.3);
              G.fillStyle = P.light; para(G, W / 2 - pw / 2, py - ss * 1.05, pw, ss * 2.1, ss * 0.3); G.fill();
              const gl = P0.glyphs(str, f, sp), x0 = W / 2 - gl.width / 2;
              gl.list.forEach((g, i) => { const a = prog(lt, lastHit + 0.2 + i * 0.018, 0.2, "linear"); if (a > 0) P0.text(G, g.c, x0 + g.x, py + ss * 0.36, { font: f, color: P.ink, alpha: a }); });
              G.restore();
              /* × × × rosas que aparecen de a uno */
              for (let i = 0; i < 3; i++) if (fr(lt - lastHit - 0.5) >= i * 3 && lt > lastHit + 0.5) P0.cross(G, W / 2 + pw / 2 + ss * (1.8 + i * 1.5), py, ss * 0.9, ss * 0.28, P.accent);
            }
          }
          /* impacto: bloques glitch + parpadeo de paleta sobre todo el cuadro */
          if (imp && ik < 0.32) P0.enter(ctx, "flicker", ik, 9);
        },
      };
    },
  });

  /* ================================================================ introv2 */
  K.register({
    name: "pop.introv2", tags: ["intro", "gancho", "apertura", "pregunta", "revelación", "cinta"], layer: "main", post: 0.6,
    summary: "GANCHO pregunta + revelación. Una cortina líquida violeta baja y la pregunta GIGANTE se DECODIFICA letra por letra (letras al azar en rosa que se resuelven en menta, con cursor); en stampAt la respuesta golpea como CINTA menta inclinada con glitch de bloques, sombra rosa, flecha gruesa que entra parpadeando y anillos; la pregunta pierde letras un instante. Fondo adaptable (bg: opart | columns | shapes | kanji | tiles | image con src | component con use/useParams); por defecto ondas op-art del duotono.",
    example: { text: "¿QUIÉN ABRIÓ\nEL MURO?", kicker: "Berlín · 1989", stamp: "NADIE DIO LA ORDEN", stampAt: 2.4 },
    params: {
      text: { type: "string", required: true, doc: "Pregunta gancho ('\\n' = renglón)." },
      kicker: { type: "string", default: "", doc: "Rótulo chico arriba." },
      stamp: { type: "string", default: "", doc: "Respuesta que golpea en la cinta (vacío = sin cinta)." },
      stampAt: { type: "number", default: 2.4, doc: "Segundo de la cinta (acepta '@palabra')." },
      typeAt: { type: "number", default: 0.45, doc: "Segundo en que empieza a decodificarse la pregunta." },
      cps: { type: "number", default: 18, min: 4, doc: "Letras por segundo." },
      ...K.hook.bgParams(PRESETS, "auto"),
    },
    create(ctx, p) {
      ctx.beat.hideCaptions = true;
      const P = ctx.C.palette, { W, H, u, portrait } = ctx.stage, S = Math.min(W, H);
      const L0 = String(p.text).toUpperCase().split("\n").map(s => s.trim()).filter(Boolean);
      const Ls = portrait ? rewrap(L0.map(l => l.split(/\s+/).map(w => ({ w }))), 10).map(l => l.map(x => x.w).join(" ")) : L0, nL = Math.max(1, Ls.length);
      const ST = portrait ? "normal" : "expanded", w100 = Math.max(1, ...Ls.map(s => P0.measure(s, P0.font(100, 900, ST), -3)));
      const fs = Math.min(W * (portrait ? 0.86 : 0.5) / w100 * 100, H * (portrait ? 0.105 : 0.16) * (nL > 2 ? 0.85 : 1));
      const fnt = P0.font(fs, 900, ST), sp = -fs * 0.03, lh = fs * 1.08;
      const x0 = portrait ? W * 0.08 : W * 0.06, y0 = H * (portrait ? 0.3 : 0.38) - (nL - 1) * lh / 2 + fs * 0.36;
      const GL = Ls.map(s => P0.glyphs(s, fnt, sp));
      const starts = []; Ls.reduce((a, s) => (starts.push(a), a + s.length), 0);
      const panel = portrait ? [[0, 0], [W, 0], [W, H * 0.5], [0, H * 0.56]] : [[0, 0], [W * 0.68, 0], [W * 0.6, H], [0, H]];
      const BG = hookBg(ctx, { ...p, bg: p.bg }, "opart");
      /* cinta */
      const stamp = String(p.stamp || "").toUpperCase();
      const sfs = stamp ? Math.min(P0.fit(stamp, W * (portrait ? 0.78 : 0.55), 1e9, 900, ST, -0.02), fs * 0.78) : 0;
      const stw = stamp ? P0.measure(stamp, P0.font(sfs, 900, ST), -sfs * 0.02) : 0, cwid = stw + sfs * 1.8, chei = sfs * 1.65;
      const lastY = y0 + (nL - 1) * lh;
      const scx = portrait ? W / 2 : Math.max(x0 + cwid / 2 - sfs * 0.4, W * 0.42), scy = portrait ? H * 0.68 : Math.min(H * 0.84, lastY + fs * 0.5 + chei * 0.95);
      return {
        dispose() { BG.dispose(); },
        render(lt, b, t) {
          const G = ctx.g.main, oq = outQ(lt, b, 0.6), sk = lt - p.stampAt, on = stamp && sk >= 0;
          const [sx, sy] = shake(lt, on ? [p.stampAt + 0.05] : [], u * 1.0);
          G.save(); G.globalAlpha = 1 - oq; G.translate(sx, sy);
          BG.render(lt, b, t);
          /* cortina líquida violeta: baja con borde ondulado y queda como panel */
          const cq = prog(lt, Math.max(0, p.typeAt - 0.4), 0.42, "in");
          if (cq > 0) {
            G.save(); P0.clipPoly(G, panel);
            const base = lerp(-H * 0.12, H * 1.12, cq);
            G.fillStyle = P.ink; G.beginPath(); G.moveTo(0, 0);
            for (let x = 0; x <= W; x += W / 48) G.lineTo(x, base + Math.sin(x / W * 9 + lt * 14) * H * 0.03 * (1 - cq) + Math.sin(x / W * 23 + 2) * H * 0.012 * (1 - cq));
            G.lineTo(W, 0); G.closePath(); G.fill();
            /* rayado fino en el borde del panel */
            G.globalAlpha *= 0.25; P0.hatch(G, 0, 0, W, H, { gap: S * 0.02, bw: S * 0.004, ang: -45, color: P.mid });
            G.restore();
            if (cq >= 1) { G.save(); G.strokeStyle = P.light; G.lineWidth = Math.max(1.5, S * 0.005); G.beginPath(); G.moveTo(...panel[1]); G.lineTo(...panel[2]); if (portrait) G.lineTo(...panel[3]); G.stroke(); G.restore(); }
          }
          G.restore();
          /* pregunta que se decodifica */
          G.save(); G.globalAlpha = 1 - oq; G.translate(sx * 0.6 - oq * W * 0.15, sy * 0.6);
          const f = fr(lt); let caret = null;
          Ls.forEach((s, li) => {
            const yb = y0 + li * lh;
            GL[li].list.forEach((g, j) => {
              const tj = p.typeAt + (starts[li] + j) / p.cps, k = lt - tj;
              if (k < 0) return;
              if (on && sk < 0.3 && P0.missing(starts[li] + j, fr(sk), 17, 0.35)) return;
              const scr = k < 0.1 && g.c !== " ", c = scr ? SCR[Math.floor(K.rng(f * 31 + j * 7 + li)() * SCR.length)] : g.c;
              P0.text(G, c, x0 + g.x, yb, { font: fnt, color: scr ? P.accent : P.light });
              caret = [x0 + g.x + g.w + fs * 0.08, yb];
            });
          });
          const typed = lt - p.typeAt < Ls.join("").length / p.cps;
          if (caret && (typed || (f >> 3) % 2 === 0) && !(on && sk > 0.3)) { G.fillStyle = P.accent; G.fillRect(caret[0], caret[1] - fs * 0.74, fs * 0.42, fs * 0.76); }
          G.restore();
          if (p.kicker) {
            const ks = u * (portrait ? 1.9 : 1.5);
            G.save(); G.globalAlpha = 1 - oq;
            tag(G, decode(String(p.kicker).toUpperCase(), lt - 0.3, 20, 5), x0 - ks * 0.4, y0 - fs * 0.78 - ks * 2.4, ks, P.light, P.ink, prog(lt, 0.25, 0.14, "linear"), "left");
            G.restore();
          }
          /* la respuesta: cinta menta inclinada que golpea */
          if (on) {
            const q = prog(sk, 0, 0.16, "linear"), s = 1 + 0.5 * (1 - ease.expoOut(q)), kf = fr(sk);
            rings(G, scx, scy, lt, p.stampAt + 0.03, chei * 0.6, Math.max(W, H) * 0.6, S * 0.02, P.light);
            /* flecha gruesa que entra en 4 cuadros parpadeando */
            const seq = [P.ink, P.accent, null, P.muted, P.accent], col = kf < seq.length ? seq[kf] : P.ink, aq = prog(sk, 0.04, 0.14, "out");
            if (col && aq > 0) {
              G.save(); G.globalAlpha = 1 - oq;
              if (portrait) { const aw = S * 0.2; G.translate(W / 2, lerp(H * 1.05, scy + chei * 0.7 + aw, aq)); G.rotate(-Math.PI / 2); P0.arrow(G, 0, -aw * 0.5, aw, aw, col, 0.26); }
              else { const aw = Math.min(chei * 1.6, scx - cwid / 2 - u * 2); if (aw > u * 4) P0.arrow(G, lerp(-aw, scx - cwid / 2 - aw - u * 2.5, aq), scy - aw / 2, aw, aw, col, 0.26); }
              G.restore();
            }
            G.save(); G.globalAlpha = 1 - oq; G.translate(scx, scy); G.rotate(-0.06); G.scale(s, s);
            wipeClip(G, -cwid / 2 - sfs, -chei, cwid + sfs * 2, chei * 2, prog(sk, 0, 0.12, "linear"), sfs * 0.25);
            const d = sfs * 0.16 * ease.expoOut(clamp(sk / 0.2));
            G.fillStyle = P.accent; para(G, -cwid / 2 + d, -chei / 2 + d, cwid, chei, sfs * 0.18); G.fill();
            G.fillStyle = P.light; para(G, -cwid / 2, -chei / 2, cwid, chei, sfs * 0.18); G.fill();
            G.save(); para(G, -cwid / 2, -chei / 2, cwid, chei, sfs * 0.18); G.clip();
            for (const ex of [-cwid / 2 - sfs * 0.2, cwid / 2 - sfs * 0.45]) P0.hatch(G, ex, -chei / 2, sfs * 0.65, chei, { gap: sfs * 0.18, bw: sfs * 0.07, ang: -45, color: P.ink });
            G.restore();
            G.fillStyle = P.ink; G.fillRect(-cwid / 2 + sfs * 0.6, chei * 0.32, cwid - sfs * 1.2, Math.max(1, sfs * 0.04));
            P0.text(G, stamp, 0, sfs * 0.36, { font: P0.font(sfs, 900, ST), color: P.ink, align: "center", sp: -sfs * 0.02 });
            G.restore();
            if (sk < 0.1) P0.enter(ctx, "glitch", sk, 21);
          }
        },
      };
    },
  });
})();
