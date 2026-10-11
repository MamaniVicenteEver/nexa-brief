/* =============================================================================
   grunge · intros (el gancho: lo primero que se ve en YouTube)
   introv1 = titular GIGANTE que golpea palabra por palabra: cada palabra entra en
             negativo sobre una placa de color (2 cuadros) y se reacomoda rasgada en
             franjas; la ^palabra^ queda pintada a rodillo. "Golpe de tinta" (inkAt):
             negativo + zoom, salpicaduras, subrayado de rodillo que chorrea.
   introv2 = la pregunta se "pulveriza" letra a letra (motas que se densifican en
             stop-motion) y la respuesta llega como BROCHAZO: una franja de rodillo
             que se pinta en 3 cuadros con la respuesta rasgada encima + negativo.
   Fondos propios (presets, neutros): roller (pared pintada a rodillo), posters
   (cartelera de afiches que se pegan), film (película rayada con contador),
   splatter (salpicaduras y chorreones). Comparten Kit.grunge.hook con outro.js.
   Todo es función pura de lt (stop-motion = tiempo cuantizado, nada de random).
   ========================================================================== */
(function () {
  const K = Kit, GR = Kit.grunge, { clamp, lerp } = K;
  const CREAM = GR.COLORS.cream.c, DK = "#1a1211";
  const PAL = ["mustard", "mint", "coral", "petrol", "pink"];
  const PRESETS = ["roller", "posters", "film", "splatter"];
  const col = k => GR.COLORS[k] ? GR.COLORS[k].c : (/^#[0-9a-f]{3,6}$/i.test(String(k)) ? k : GR.COLORS.mustard.c);
  const rgba = (h, a) => { const [r, g, b] = GR.hexRgb(h); return `rgba(${r},${g},${b},${a})`; };
  const stop = (t, fps = 12) => Math.floor(t * fps) / fps;
  const fr24 = d => Math.floor(d * 24 + 1e-6);              /* cuadro (a 24 fps) desde un evento */
  const mk = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
  const memo = new Map();
  function mem(key, fn) { let v = memo.get(key); if (!v) { v = fn(); memo.set(key, v); if (memo.size > 24) memo.delete(memo.keys().next().value); } return v; }

  /** colores de la intro: S plano elegido, T medio tono, D casi negro */
  function scene(p, def) {
    const key = p.color && p.color !== "auto" ? p.color : def, S = col(key);
    return { S, T: GR.mix(S, DK, 0.55), D: DK, light: false, flip: "y", key };
  }

  /* ------------------------------------------------------------ texto */
  /** "¿POR QUÉ CAYÓ\nEL ^MURO^?" → [[{w, acc, glue}]] (renglones; ^x^ = destacada; glue = pegada sin espacio) */
  function words(text) {
    return String(text ?? "").split("\n").map(s => s.trim()).filter(Boolean).map(line => {
      const out = []; let acc = false, buf = "", spaced = true;
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
  const rowStr = row => row.map((w, k) => (k && !w.glue ? " " : "") + w.w).join("");
  const TR = -0.01;
  function fitRows(rows, o) {
    const n = rows.length, wMax = Math.max(1, ...rows.map(r => GR.measure(rowStr(r), 100, TR)));
    return Math.min(o.maxW * 100 / wMax, o.lineH / GR.CAP, o.hMax / (GR.CAP * (n + o.gap * (n - 1))));
  }
  /** renglones y tamaño; en 9:16 prueba otros cortes (sin partir "^MURO^?") si la letra crece ≥15 % */
  function arrange(Ls, o, rewrap) {
    const best = { rows: Ls, fs: fitRows(Ls, o) };
    if (!rewrap) return best;
    const toks = []; Ls.flat().forEach(w => { if (w.glue && toks.length) toks[toks.length - 1].push(w); else toks.push([w]); });
    const m = toks.length; if (m < 2 || m > 10) return best;
    let cand = null;
    for (let mask = 0; mask < (1 << (m - 1)); mask++) {
      const rows = [[]];
      toks.forEach((t, i) => { if (i && (mask >> (i - 1)) & 1) rows.push([]); rows[rows.length - 1].push(...t); });
      if (rows.length > 4) continue;
      const fs = fitRows(rows, o);
      if (!cand || fs > cand.fs * 1.001 || (Math.abs(fs - cand.fs) < cand.fs * 0.001 && rows.length < cand.rows.length)) cand = { rows, fs };
    }
    return cand && cand.fs > best.fs * 1.15 ? cand : best;
  }
  /** posición de cada palabra (centrado) */
  function place(rows, fs, cx, cy, gap) {
    const ch = fs * GR.CAP, n = rows.length, top = cy - (ch * n + ch * gap * (n - 1)) / 2, sp = GR.measure(" ", fs), out = [];
    let idx = 0, left = 1e9, right = -1e9;
    rows.forEach((row, li) => {
      const base = top + ch * (li + 1) + ch * gap * li, ws = row.map(w => GR.measure(w.w, fs, TR));
      const tot = ws.reduce((a, b) => a + b, 0) + sp * row.filter((w, k) => k && !w.glue).length;
      let x = cx - tot / 2; left = Math.min(left, x); right = Math.max(right, x + tot);
      row.forEach((w, k) => {
        if (k && !w.glue) x += sp;
        out.push({ ...w, x, base, ww: ws[k], li, i: w.glue && out.length ? out[out.length - 1].i : idx++ });
        x += ws[k];
      });
    });
    return { words: out, top, bottom: top + ch * n + ch * gap * (n - 1), ch, fs, left, right, n: idx };
  }
  function wrap(s, max) {
    const out = [""];
    for (const w of String(s || "").split(/\s+/).filter(Boolean)) { const i = out.length - 1, nx = out[i] ? out[i] + " " + w : w; if (out[i] && nx.length > max) out.push(w); else out[i] = nx; }
    return out.filter(Boolean);
  }
  /** rótulo chico (Montserrat 800 espaciado) */
  function label(G, str, x, y, size, color, align = "center", track = 0.26) {
    G.save(); G.font = `800 ${size}px ${GR.FONT}`; G.fillStyle = color; G.textAlign = align; G.textBaseline = "middle";
    if ("letterSpacing" in G) G.letterSpacing = (size * track) + "px";
    G.fillText(str, x, y); const w = G.measureText(str).width; G.restore(); return w;
  }
  const labelW = (str, size, track = 0.26) => { const g = mk(2, 2).getContext("2d"); g.font = `800 ${size}px ${GR.FONT}`; if ("letterSpacing" in g) g.letterSpacing = (size * track) + "px"; return g.measureText(str).width; };

  /** sacudida stop-motion: golpes que decaen, posición nueva cada cuadro de 24 fps */
  function shake(lt, hits, amp) {
    let a = 0; for (const h of hits) { const d = lt - h; if (d >= 0 && d < 0.3) a += Math.pow(1 - d / 0.3, 2); }
    if (!a) return [0, 0];
    const r = K.rng(Math.floor(lt * 24) * 7 + 3); return [(r() - 0.5) * 2 * amp * a, (r() - 0.5) * 2 * amp * a];
  }

  /**
   * Placa de rodillo: rectángulo de bordes rasgados, color plano con pasadas de
   * rodillo y rayones. wipe 0..1 = cuánto se pintó de izquierda a derecha.
   */
  function slab(G, x, y, w, h, color, seed, wipe = 1, alpha = 1) {
    if (wipe <= 0 || alpha <= 0) return;
    const r = K.rng(seed), n = 7, x1 = x + w * Math.min(1, wipe), p = new Path2D(), j = Math.min(h * 0.09, w * 0.03);
    p.moveTo(x + (r() - 0.5) * j * 2, y + (r() - 0.5) * j);
    for (let k = 1; k <= n; k++) p.lineTo(x + (x1 - x) * k / n, y + (r() - 0.5) * j);
    for (let k = 1; k <= 4; k++) p.lineTo(x1 + (r() - 0.35) * j * 2.4, y + h * k / 4);
    for (let k = n - 1; k >= 0; k--) p.lineTo(x + (x1 - x) * k / n, y + h + (r() - 0.5) * j);
    for (let k = 3; k >= 1; k--) p.lineTo(x + (r() - 0.65) * j * 2.4, y + h * k / 4);
    p.closePath();
    G.save(); G.globalAlpha *= alpha; G.clip(p);
    G.fillStyle = GR.mix(color, DK, 0.16); G.fillRect(x - j * 3, y - j * 3, w + j * 6, h + j * 6);
    G.drawImage(GR.tint(GR.S.tex.band[0], color), x - w * 0.12, y - h * 0.12, w * 1.3, h * 1.24);
    G.globalAlpha *= 0.22; G.drawImage(GR.tint(GR.S.tex.scratch, DK), x - w * 0.3, y - h * 2, w * 1.6, h * 5);
    G.restore();
  }
  /** trazo a pincel seco (para flechas y aros): pts hasta la fracción q */
  function stroke(G, pts, q, width, color, seed, alpha = 1) {
    const n = Math.max(1, Math.round(q * (pts.length - 1))); if (q <= 0) return;
    const r = K.rng(seed);
    G.save(); G.globalAlpha *= alpha; G.strokeStyle = color; G.lineCap = "round"; G.lineJoin = "round";
    for (let pass = 0; pass < 3; pass++) {
      const ox = (r() - 0.5) * width * 0.5, oy = (r() - 0.5) * width * 0.5;
      G.lineWidth = width * (pass ? 0.35 + r() * 0.3 : 1); G.globalAlpha = alpha * (pass ? 0.55 : 1);
      G.beginPath(); for (let i = 0; i <= n; i++) i ? G.lineTo(pts[i][0] + ox, pts[i][1] + oy) : G.moveTo(pts[i][0] + ox, pts[i][1] + oy); G.stroke();
    }
    G.restore();
  }

  /* ------------------------------------------------------------ foto en duotono */
  const TONE = new Map();
  /** foto → duotono (D sombras → S luces) con niveles automáticos, cacheada */
  function tone(img, c0, c1) {
    const key = (img.src || img.width + "x" + img.height) + c0 + c1;
    let c = TONE.get(key); if (c) return c;
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, s = Math.min(1, 1400 / Math.max(iw, ih));
    c = mk(iw * s, ih * s); const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(img, 0, 0, c.width, c.height);
    const id = g.getImageData(0, 0, c.width, c.height), d = id.data, hist = new Uint32Array(256);
    for (let i = 0; i < d.length; i += 4) hist[(d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8]++;
    const nn = d.length / 4; let acc = 0, lo = 0, hi = 255;
    for (let l = 0; l < 256; l++) { acc += hist[l]; if (acc < nn * 0.02) lo = l; if (acc < nn * 0.98) hi = l; }
    const A = GR.hexRgb(c0), B = GR.hexRgb(c1), lut = new Uint8ClampedArray(768);
    for (let l = 0; l < 256; l++) { let q = clamp((l - lo) / Math.max(8, hi - lo)); q = q * q * (3 - 2 * q); for (let k = 0; k < 3; k++) lut[l * 3 + k] = lerp(A[k], B[k], q); }
    for (let i = 0; i < d.length; i += 4) { const l = (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8; d[i] = lut[l * 3]; d[i + 1] = lut[l * 3 + 1]; d[i + 2] = lut[l * 3 + 2]; d[i + 3] = 255; }
    g.putImageData(id, 0, 0);
    TONE.set(key, c); if (TONE.size > 6) TONE.delete(TONE.keys().next().value);
    return c;
  }

  /* ================================================================ fondos propios */
  function presets(ctx, sc) {
    return {
      /** pared pintada a rodillo: pasadas de color (y de negro que tapan) que se pintan en 4 cuadros */
      roller(G, st, lt) {
        const { W, H } = st;
        const B = mem(`gr-roll:${W | 0}:${H | 0}`, () => {
          const r = K.rng(911), out = [];
          for (let k = 0; k < 48; k++) {
            const dark = k % 3 === 2;
            out.push({ t: -2.2 + k * 0.4, y: r() * H * 1.05 - H * 0.08, h: H * (0.12 + r() * 0.2), c: dark ? DK : col(PAL[(k * 2) % 5]), a: dark ? 0.95 : 0.42 + r() * 0.16, dir: r() < 0.5 ? 1 : -1, dx: -r() * W * 0.15 });
          }
          return out;
        });
        GR.fill(ctx, DK);
        for (const b of B.filter(b => b.t <= lt).slice(-14)) {
          const wipe = clamp((fr24(lt - b.t) + 1) / 4);
          G.save(); if (b.dir < 0) { G.translate(W, 0); G.scale(-1, 1); }
          GR.band(ctx, { y0: b.y, y1: b.y + b.h, color: b.c, alpha: b.a, wipe, v: b.c === DK ? 1 : 0, dx: b.dx, sx: 1.3 });
          G.restore();
        }
        GR.grime(ctx, CREAM, 0.3, lt);
      },

      /** cartelera: afiches de color plano (barras, círculo, rayas, trama) que se pegan uno encima de otro */
      posters(G, st, lt) {
        const { W, H, u, portrait } = st;
        const P = mem(`gr-post:${W | 0}:${H | 0}`, () => {
          const r = K.rng(733), d = Math.min(2, ctx.dpr), cols = portrait ? 3 : 5, rows = portrait ? 5 : 3;
          const cw = W / cols, chh = H / rows, pw = cw * 1.16, ph = chh * 1.14, T = GR.S.tex, variants = [];
          const cl = ["cream", "mustard", "mint", "coral", "petrol", "pink"];
          for (let v = 0; v < 12; v++) {
            const c = mk(pw * d, ph * d), g = c.getContext("2d"); g.scale(d, d);
            const base = col(cl[v % 6]), ink = v % 6 === 0 ? DK : GR.mix(base, DK, 0.7);
            g.fillStyle = base; g.fillRect(0, 0, pw, ph); g.fillStyle = ink;
            const kind = (v + (v / 6 | 0)) % 4;
            if (kind === 0) {
              let y = ph * 0.12; for (let i = 0; i < 3; i++) { const bh = ph * (0.1 + r() * 0.06); g.fillRect(pw * 0.08, y, pw * (0.5 + r() * 0.4), bh); y += bh + ph * 0.05; }
              for (let i = 0; i < 6; i++) g.fillRect(pw * 0.08, ph * (0.62 + i * 0.05), pw * (0.3 + r() * 0.5), ph * 0.018);
            } else if (kind === 1) {
              g.beginPath(); g.arc(pw * (0.35 + r() * 0.3), ph * (0.4 + r() * 0.15), Math.min(pw, ph) * (0.24 + r() * 0.1), 0, 6.283); g.fill();
              g.fillRect(pw * 0.08, ph * 0.8, pw * 0.6, ph * 0.06); g.fillRect(pw * 0.08, ph * 0.89, pw * 0.4, ph * 0.025);
            } else if (kind === 2) {
              g.save(); g.rotate(-0.5); for (let i = -8; i < 14; i += 2) g.fillRect(i * pw * 0.12, -ph, pw * 0.07, ph * 3); g.restore();
            } else {
              const s = Math.min(pw, ph) * 0.07; for (let yy = s; yy < ph; yy += s * 1.4) for (let xx = s; xx < pw; xx += s * 1.4) { g.beginPath(); g.arc(xx, yy, s * 0.6 * (0.2 + 0.8 * yy / ph), 0, 6.283); g.fill(); }
            }
            /* desgaste: rayones, agujeros y borde inferior arrancado */
            g.globalAlpha = 0.45; g.drawImage(GR.tint(T.scratch, DK), r() * T.TW * 0.5, r() * T.TH * 0.5, T.TW * 0.4, T.TH * 0.4, 0, 0, pw, ph);
            g.globalCompositeOperation = "destination-out"; g.globalAlpha = 0.6;
            g.drawImage(T.holes, r() * T.TW * 0.5, r() * T.TH * 0.5, T.TW * 0.35, T.TH * 0.35, 0, 0, pw, ph); g.globalAlpha = 1;
            if (r() < 0.6) { const y0 = ph * (0.72 + r() * 0.18); g.beginPath(); g.moveTo(-2, ph + 4); g.lineTo(-2, y0); for (let x = 0; x <= pw + 1; x += pw / 14) g.lineTo(x, y0 + (r() - 0.5) * ph * 0.07 + (x / pw) * ph * 0.06); g.lineTo(pw + 2, ph + 4); g.closePath(); g.fill(); }
            g.globalCompositeOperation = "source-over";
            variants.push(c);
          }
          const slots = [];
          for (let rr = 0; rr < rows; rr++) for (let cc = 0; cc < cols; cc++) slots.push([(cc + 0.5) * cw + (r() - 0.5) * cw * 0.12, (rr + 0.5) * chh + (r() - 0.5) * chh * 0.12]);
          const order = slots.map((_, i) => i); for (let i = order.length - 1; i > 0; i--) { const k = Math.floor(r() * (i + 1)); [order[i], order[k]] = [order[k], order[i]]; }
          const events = [];
          for (let k = 0; k < 64; k++) { const s = slots[order[k % slots.length]]; events.push({ t: -4.6 + k * 0.3, x: s[0], y: s[1], v: (k * 5 + (k / slots.length | 0)) % 12, rot: (r() - 0.5) * 0.1 }); }
          return { variants, events, pw, ph, n: slots.length };
        });
        G.fillStyle = "#231816"; G.fillRect(0, 0, W, H);
        G.save(); G.translate(Math.sin(lt * 0.25) * u * 2, Math.cos(lt * 0.2) * u);
        for (const e of P.events.filter(e => e.t <= lt).slice(-P.n * 2)) {
          const f = fr24(lt - e.t), s = f === 0 ? 1.08 : 1, o = f === 0 ? u * 1.5 : 0;
          G.save(); G.translate(e.x + o, e.y - o); G.rotate(e.rot + (f === 0 ? 0.04 : 0)); G.scale(s, s);
          G.drawImage(P.variants[e.v], -P.pw / 2, -P.ph / 2, P.pw, P.ph); G.restore();
        }
        G.restore();
        G.fillStyle = "rgba(26,18,17,.42)"; G.fillRect(0, 0, W, H);
        GR.grime(ctx, CREAM, 0.35, lt);
      },

      /** película: luz de fuga del color de escena, contador que barre, rayones y perforaciones que corren */
      film(G, st, lt) {
        const { W, H, u } = st, T = GR.S.tex, ts = stop(lt, 12), fl = K.rng(Math.floor(lt * 12) + 77)();
        GR.fill(ctx, DK);
        G.save(); G.globalCompositeOperation = "lighter";
        const lx = W * (0.25 + 0.5 * (0.5 + 0.5 * Math.sin(ts * 0.6))), ly = H * (0.35 + 0.2 * Math.cos(ts * 0.45));
        const rg = G.createRadialGradient(lx, ly, 0, lx, ly, Math.max(W, H) * 0.62);
        rg.addColorStop(0, rgba(sc.S, 0.3 + fl * 0.08)); rg.addColorStop(1, rgba(sc.S, 0));
        G.fillStyle = rg; G.fillRect(0, 0, W, H); G.restore();
        const R = Math.min(W, H) * 0.36, cx = W / 2, cy = H / 2, sweep = (ts % 1) * 6.283;
        G.save(); G.globalAlpha = 0.08; G.fillStyle = CREAM; G.beginPath(); G.moveTo(cx, cy); G.arc(cx, cy, R * 1.7, -Math.PI / 2, -Math.PI / 2 + sweep); G.closePath(); G.fill();
        G.globalAlpha = 0.17; G.strokeStyle = CREAM; G.lineWidth = u * 0.5; G.beginPath(); G.arc(cx, cy, R, 0, 6.283); G.stroke();
        G.lineWidth = u * 0.25; G.beginPath(); G.arc(cx, cy, R * 0.82, 0, 6.283); G.moveTo(0, cy); G.lineTo(W, cy); G.moveTo(cx, 0); G.lineTo(cx, H); G.stroke(); G.restore();
        const off = (ts * H * 0.9) % H, scr = GR.tint(T.scratch, CREAM);
        G.save(); G.globalAlpha = 0.24; G.drawImage(scr, 0, off - H, W, H); G.drawImage(scr, 0, off, W, H); G.restore();
        const pg = u * 5.2, pw = u * 3.2, ph = u * 2.2, o2 = (ts * H * 0.9) % pg;
        G.fillStyle = "rgba(240,232,216,.13)";
        for (let y = -pg + o2; y < H + pg; y += pg) for (const x of [u * 1.2, W - u * 1.2 - pw]) { G.beginPath(); G.roundRect ? G.roundRect(x, y, pw, ph, u * 0.5) : G.rect(x, y, pw, ph); G.fill(); }
        const fy = ((H * 0.15 + ts * H * 0.9) % (H * 1.1)) - H * 0.05; G.fillStyle = "rgba(0,0,0,.55)"; G.fillRect(0, fy, W, u * 1.4);
        GR.grime(ctx, CREAM, 0.55, lt);
        if (Math.floor(lt * 12) % 17 === 5) { G.fillStyle = "rgba(240,232,216,.06)"; G.fillRect(0, 0, W, H); }
      },

      /** salpicaduras de colores que caen en 3 pasos y chorrean; de vez en cuando un rodillo negro limpia */
      splatter(G, st, lt) {
        const { W, H, u } = st;
        const E = mem(`gr-spl:${W | 0}:${H | 0}`, () => {
          const r = K.rng(457), out = [];
          for (let k = 0; k < 80; k++) {
            const dark = k % 9 === 8;
            out.push({ t: -3 + k * 0.2, x: r() * W, y: r() * H, r: u * (1.5 + Math.pow(r(), 1.5) * 6), seed: Math.floor(r() * 1e9), c: dark ? DK : col(PAL[k % 5]), dark,
                       drip: r() < 0.45, dl: u * (6 + r() * 22), by: r() * H * 0.8, bh: H * (0.25 + r() * 0.25), dir: r() < 0.5 ? 1 : -1 });
          }
          return out;
        });
        GR.fill(ctx, DK); GR.grime(ctx, CREAM, 0.25, lt);
        for (const e of E.filter(e => e.t <= lt).slice(-30)) {
          if (e.dark) {
            G.save(); if (e.dir < 0) { G.translate(W, 0); G.scale(-1, 1); }
            GR.band(ctx, { y0: e.by, y1: e.by + e.bh, color: DK, alpha: 0.95, wipe: clamp((fr24(lt - e.t) + 1) / 4), v: 1, sx: 1.2, dx: -W * 0.1 });
            G.restore(); continue;
          }
          G.save(); G.globalAlpha = 0.62;
          GR.splats(ctx, [{ x: e.x, y: e.y, r: e.r, seed: e.seed, at: e.t }], lt, e.c);
          if (e.drip) { const L = Math.min(e.dl, Math.floor((lt - e.t) * 12) * u * 1.6); G.fillStyle = e.c; G.fillRect(e.x - e.r * 0.12, e.y, e.r * 0.24, L); G.beginPath(); G.arc(e.x, e.y + L, e.r * 0.2, 0, 6.283); G.fill(); }
          G.restore();
        }
      },
    };
  }
  /** fondo intercambiable con el tratamiento del diseño (duotono para fotos) */
  function bg(ctx, p, sc, auto) {
    return K.hook.bg(ctx, p, { auto, presets: presets(ctx, sc), tone: img => tone(img, DK, sc.S) });
  }

  GR.hook = { CREAM, DK, PAL, PRESETS, col, rgba, stop, fr24, scene, words, arrange, place, wrap, label, labelW, shake, slab, stroke, tone, presets, bg };

  const lookCream = () => ({ fill: CREAM, tex: [{ tex: GR.S.tex.scratch, color: GR.mix(CREAM, DK, 0.5), alpha: 0.4 }] });
  const lookDark = sc => ({ fill: DK, tex: [{ tex: GR.S.tex.scratch, color: sc.T, alpha: 0.35 }] });

  /* ================================================================ introv1 */
  K.register({
    name: "grunge.introv1", tags: ["intro", "gancho", "apertura", "título", "impacto"], layer: "main", post: 0.6,
    summary: "GANCHO de apertura (lo primero que se ve). Titular GIGANTE que golpea palabra por palabra: cada palabra entra en negativo sobre una placa de color plano (2 cuadros, el color cambia en cada palabra) y se reacomoda rasgada en franjas; la '^palabra^' queda pintada a rodillo en el color de la escena. Golpe de tinta (inkAt): negativo con zoom, salpicaduras, subrayado de rodillo que chorrea, y aparece el rótulo. Fondo adaptable al tema (bg: roller | posters | film | splatter | image con src en duotono | component con use/useParams | none). Sale rasgándose en franjas.",
    example: { text: "¿POR QUÉ CAYÓ\nEL ^MURO^?", kicker: "Berlín · 9 nov 1989", sub: "la noche que nadie vio venir", inkAt: 2.3 },
    params: {
      text: { type: "string", required: true, doc: "Titular gancho, corto (2–6 palabras). '\\n' = renglón (en 9:16 se re-corta solo si así crece); '^x^' = palabra pintada a rodillo. Un signo pegado (^MURO^?) no se separa." },
      kicker: { type: "string", default: "", doc: "Rótulo chico arriba (lugar · fecha), sobre una placa de color." },
      sub: { type: "string", default: "", doc: "Línea chica debajo del subrayado (aparece con el golpe de tinta)." },
      color: { type: "string", default: "mustard", doc: "Color plano de la escena: mustard | mint | coral | petrol | pink | cream | #hex." },
      wordAt: { type: "number", default: 0.3, doc: "Segundo del primer golpe de palabra." },
      stagger: { type: "number", default: 0.3, min: 0.08, doc: "Segundos entre palabra y palabra." },
      inkAt: { type: "number", default: 2.3, doc: "Golpe de tinta: negativo + zoom, salpicaduras y subrayado que chorrea (-1 = sin golpe). Acepta '@palabra'." },
      ...K.hook.bgParams(PRESETS),
    },
    create(ctx, p) {
      ctx.beat.hideCaptions = true;
      const { W, H, u, portrait } = ctx.stage, sc = scene(p, "mustard"), gap = 0.2;
      const A = arrange(words(p.text), { maxW: W * (portrait ? 0.88 : 0.8), lineH: H * (portrait ? 0.15 : 0.27), hMax: H * (portrait ? 0.5 : 0.56), gap }, portrait);
      const cy = H * (portrait ? 0.45 : 0.46), T = place(A.rows, A.fs, W / 2, cy, gap), fs = T.fs, ch = T.ch;
      const rnd = K.rng(K.hash("gr-v1:" + p.text));
      const flashCols = [sc.key, ...PAL.filter(k => k !== sc.key && k !== "petrol")];
      T.words.forEach(w => {
        w.t0 = p.wordAt + w.i * p.stagger; w.flash = w.acc ? CREAM : col(flashCols[w.i % flashCols.length]); w.seed = Math.floor(rnd() * 1e6);
        w.spl = [0, 1].map(j => ({ x: j ? w.x + w.ww + u * (0.5 + rnd() * 2.5) : w.x - u * (0.5 + rnd() * 2.5), y: w.base - ch * (0.1 + rnd() * 1.0), r: u * (0.7 + rnd() * 1.4), seed: Math.floor(rnd() * 1e9), at: w.t0 + 0.02 }));
      });
      const hits = T.words.map(w => w.t0), lastHit = Math.max(...hits), inkOn = p.inkAt >= 0;
      const big = GR.splatSet(ctx, K.rng(Math.floor(rnd() * 1e9)), p.inkAt);
      const uy = T.bottom + ch * 0.3, uh = Math.max(u * 1.6, ch * 0.18);
      const drips = Array.from({ length: 7 }, () => ({ x: lerp(T.left, T.right, rnd()), w: u * (0.25 + rnd() * 0.5), h: u * (3 + rnd() * 12), d: rnd() * 0.3 }));
      const subFs = u * (portrait ? 3.1 : 2.5), subY = uy + uh + u * (portrait ? 3.6 : 3.0);
      const kFs = u * (portrait ? 2.3 : 1.7), kStr = String(p.kicker || "").toUpperCase(), kW = kStr ? labelW(kStr, kFs) : 0, kY = T.top - ch * 0.45 - u * (portrait ? 3.4 : 2.8);
      const subAt = inkOn ? p.inkAt + 0.15 : lastHit + 0.35;
      const LC = lookCream(), LD = lookDark(sc);
      const BG = bg(ctx, p, sc, "roller");
      return {
        dispose() { BG.dispose(); },
        render(lt, b) {
          const G = ctx.g.main, oq = clamp((lt - b.dur) / 0.6), out = lt > b.dur, fade = 1 - oq;
          GR.current(ctx, sc);
          const [sx, sy] = shake(lt, inkOn ? [...hits, p.inkAt] : hits, u * 0.8);
          /* fondo (preset, foto en duotono o componente) */
          G.save(); G.translate(W / 2 + sx * 0.5, H / 2 + sy * 0.5); G.scale(1.04, 1.04); G.translate(-W / 2, -H / 2); BG.render(lt, b); G.restore();
          if (BG.mode === "image" || BG.mode === "component") GR.grime(ctx, CREAM, 0.3, lt);
          /* franja oscura de rodillo detrás del titular (se lee sobre cualquier fondo) */
          const bT = p.wordAt - 0.15;
          if (lt >= bT) {
            const y0 = T.top - ch * 0.8, y1 = Math.max(T.bottom + ch * 0.75, (p.sub ? subY + subFs : uy + uh) + u * 2.5);
            G.save(); G.globalAlpha = clamp((lt - bT) / 0.12) * fade;
            const gr = G.createLinearGradient(0, y0 - ch, 0, y1 + ch); gr.addColorStop(0, rgba(DK, 0)); gr.addColorStop(0.25, rgba(DK, 0.62)); gr.addColorStop(0.75, rgba(DK, 0.62)); gr.addColorStop(1, rgba(DK, 0));
            G.fillStyle = gr; G.fillRect(0, y0 - ch, W, y1 - y0 + ch * 2); G.restore();
            GR.band(ctx, { y0, y1, color: DK, alpha: 0.86 * fade, wipe: clamp((fr24(lt - bT) + 1) / 4), v: 1, dx: -W * 0.1, sx: 1.2 });
          }
          /* golpe de tinta: salpicaduras grandes, subrayado de rodillo, chorreones */
          if (inkOn && lt >= p.inkAt) {
            G.save(); G.globalAlpha = 0.9 * fade; GR.splats(ctx, big, lt, sc.S); G.restore();
            slab(G, T.left - ch * 0.15, uy, (T.right - T.left) + ch * 0.3, uh, sc.S, 919, clamp((fr24(lt - p.inkAt) + 1) / 4), fade);
            G.save(); G.globalAlpha = fade; G.fillStyle = sc.S;
            for (const d of drips) { const q = clamp(Math.floor((lt - p.inkAt - 0.15 - d.d) * 12) / 8); if (q <= 0) continue; G.fillRect(d.x, uy + uh * 0.7, d.w, d.h * q); G.beginPath(); G.arc(d.x + d.w / 2, uy + uh * 0.7 + d.h * q, d.w * 0.9, 0, 6.283); G.fill(); }
            G.restore();
          }
          /* salpicaduras chicas de cada golpe (detrás de las letras) */
          G.save(); G.globalAlpha = fade; for (const w of T.words) GR.splats(ctx, w.spl, lt, w.flash === CREAM ? sc.S : w.flash); G.restore();
          /* titular: cada palabra golpea en negativo y se reacomoda rasgada */
          for (const w of T.words) {
            const d = lt - w.t0; if (d < 0) continue;
            const f = fr24(d), flash = f < 2, s = f === 0 ? 1.3 : f === 1 ? 1.1 : 1;
            const qn = clamp((f - 2) / 6), amt = flash ? 0 : W * 0.05 * Math.pow(1 - qn, 1.5) * (w.i % 2 ? -1 : 1);
            const cxw = w.x + w.ww / 2, cyw = w.base - ch / 2;
            const L = GR.layout({ lines: [w.w], fs: fs * s, align: "center", x: cxw, cy: cyw, track: TR });
            if (flash) slab(G, L.left - fs * 0.12, L.top - fs * 0.11, L.right - L.left + fs * 0.24, L.ch + fs * 0.22, w.flash, w.seed, 1, fade);
            else if (w.acc) slab(G, w.x - fs * 0.13, cyw - ch / 2 - fs * 0.12, w.ww + fs * 0.26, ch + fs * 0.24, sc.S, w.seed, clamp((f - 1) / 3), fade);
            GR.ink(ctx, { L, ...((flash || w.acc) ? LD : LC), holes: { alpha: 0.72, ox: -W * 0.07 * (w.i % 4) } });
            const r = K.rng(GR.boilFrame(lt) * 31 + (w.seed % 997)), jx = (r() - 0.5) * u * 0.25, jy = (r() - 0.5) * u * 0.25;
            const ex = oq > 0 ? W * 0.7 * oq * oq * (w.i % 2 ? 1 : -1) : 0;
            GR.put(ctx, { alpha: fade, dx: sx * 0.6 + jx, dy: sy * 0.6 + jy, slices: (amt || ex) ? GR.tear(L, amt + ex, ex * 0.4) : null });
          }
          /* rótulo de arriba: placa de color que parpadea al encenderse */
          if (kStr && lt >= 0.12 && fr24(lt - 0.12) !== 2) {
            const pad = kFs * 0.7;
            slab(G, W / 2 - kW / 2 - pad, kY - kFs * 0.95, kW + pad * 2, kFs * 1.9, sc.S, 37, clamp((fr24(lt - 0.12) + 1) / 3), fade);
            G.save(); G.globalAlpha = fade; label(G, kStr, W / 2 + kFs * 0.13, kY + kFs * 0.05, kFs, DK); G.restore();
          }
          /* línea de abajo: entra palabra por palabra (cortes de 3 cuadros) */
          if (p.sub && lt >= subAt) {
            const ws = String(p.sub).toUpperCase().split(/\s+/), n = Math.min(ws.length, 1 + Math.floor((lt - subAt) / 0.125));
            const full = ws.join(" "), part = ws.slice(0, n).join(" "), fw = labelW(full, subFs, 0.18);
            G.save(); G.globalAlpha = fade; label(G, part, W / 2 - fw / 2, subY, subFs, CREAM, "left", 0.18); G.restore();
          }
          /* negativo con golpe de zoom (3 cuadros) */
          if (inkOn && !out) { const d = lt - p.inkAt; if (d >= 0 && d < 0.125) GR.fx(ctx, { neg: true, zoom: d < 0.084 ? 1.1 : 1, zx: 0.5, zy: cy / H }); }
          if (oq > 0) { G.fillStyle = rgba(DK, oq * 0.85); G.fillRect(0, 0, W, H); }
        },
      };
    },
  });

  /* ================================================================ introv2 */
  K.register({
    name: "grunge.introv2", tags: ["intro", "gancho", "apertura", "pregunta", "revelación"], layer: "main", post: 0.6,
    summary: "GANCHO pregunta + revelación. La pregunta gigante se pulveriza letra a letra (cada letra aparece como motas de tinta que se densifican en 3 cuadros, con cursor de color) sobre una franja negra de rodillo; la respuesta (stamp) llega como un BROCHAZO del color de la escena que se pinta en 3 cuadros, con la respuesta rasgada encima, negativo espejado y salpicaduras que chorrean. Fondo adaptable (bg: film | roller | posters | splatter | image con src en duotono | component con use/useParams | none).",
    example: { text: "¿QUIÉN ABRIÓ\nEL MURO?", kicker: "Berlín · 1989", stamp: "NADIE DIO LA ORDEN", stampAt: 2.4 },
    params: {
      text: { type: "string", required: true, doc: "Pregunta gancho ('\\n' = renglón; en 9:16 se re-corta solo si así crece)." },
      kicker: { type: "string", default: "", doc: "Rótulo chico arriba." },
      stamp: { type: "string", default: "", doc: "Respuesta que llega en el brochazo (vacío = sin respuesta)." },
      stampAt: { type: "number", default: 2.4, doc: "Segundo del brochazo-respuesta (acepta '@palabra')." },
      typeAt: { type: "number", default: 0.3, doc: "Segundo en que empieza a aparecer la pregunta." },
      cps: { type: "number", default: 18, min: 4, doc: "Letras por segundo." },
      color: { type: "string", default: "coral", doc: "Color plano de la escena (brochazo, cursor, luz): mustard | mint | coral | petrol | pink | cream | #hex." },
      ...K.hook.bgParams(PRESETS),
    },
    create(ctx, p) {
      ctx.beat.hideCaptions = true;
      const { W, H, u, portrait } = ctx.stage, sc = scene(p, "coral"), gap = 0.24;
      const A = arrange(words(String(p.text).replace(/\^/g, "")), { maxW: W * (portrait ? 0.86 : 0.6), lineH: H * (portrait ? 0.13 : 0.19), hMax: H * (portrait ? 0.4 : 0.44), gap }, portrait);
      const x0 = W * 0.07, cy = H * (portrait ? 0.38 : 0.4);
      const L = GR.layout({ lines: A.rows.map(rowStr), fs: A.fs, align: "left", x: x0, cy, gap, track: TR });
      const tk = L.glyphs.map((g, k) => p.typeAt + k / p.cps), typedEnd = tk[tk.length - 1] ?? p.typeAt;
      const st = String(p.stamp || "").toUpperCase();
      let SL = null;
      if (st) {
        const sfs = Math.min(GR.fitFs([st], W * (portrait ? 0.74 : 0.5)), H * (portrait ? 0.062 : 0.105) / GR.CAP, A.fs * 0.85);
        SL = GR.layout({ lines: [st], fs: sfs, align: "left", x: x0 + sfs * 0.4, cy: L.bottom + sfs * GR.CAP * 1.5 + u * (portrait ? 3.2 : 2.6), track: TR });
      }
      const rnd = K.rng(K.hash("gr-v2:" + p.text));
      const sp = SL ? [0, 1, 2, 3].map(i => ({ x: i % 2 ? SL.right + SL.fs * (0.6 + rnd() * 0.8) : x0 - u * (0.3 + rnd()), y: lerp(SL.top, SL.bottom, rnd()) + (i > 1 ? SL.ch * 0.9 : -SL.ch * 0.6), r: u * (1 + rnd() * 1.8), seed: Math.floor(rnd() * 1e9), at: p.stampAt + 0.04 + (i % 2) * 0.042 })) : [];
      const drips = SL ? Array.from({ length: 6 }, () => ({ x: lerp(x0, SL.right, rnd()), w: u * (0.25 + rnd() * 0.45), h: u * (3 + rnd() * 10), d: rnd() * 0.3 })) : [];
      const kFs = u * (portrait ? 2.2 : 1.7), kStr = String(p.kicker || "").toUpperCase(), kY = L.top - L.ch * 0.4 - u * (portrait ? 3 : 2.6);
      const LC = lookCream(), LD = lookDark(sc);
      const BG = bg(ctx, p, sc, "film");
      return {
        dispose() { BG.dispose(); },
        render(lt, b) {
          const G = ctx.g.main, oq = clamp((lt - b.dur) / 0.6), out = lt > b.dur, fade = 1 - oq;
          GR.current(ctx, sc);
          const hit = SL && lt >= p.stampAt, [sx, sy] = shake(lt, SL ? [p.stampAt + 0.04] : [], u * 1.0);
          G.save(); G.translate(W / 2 + sx * 0.5, H / 2 + sy * 0.5); G.scale(1.04, 1.04); G.translate(-W / 2, -H / 2); BG.render(lt, b); G.restore();
          if (BG.mode === "image" || BG.mode === "component") GR.grime(ctx, CREAM, 0.3, lt);
          /* oscurecer la zona del texto + franja negra de rodillo */
          const dk = portrait ? G.createLinearGradient(0, 0, 0, H * 0.72) : G.createLinearGradient(0, 0, W * 0.78, 0);
          dk.addColorStop(0, rgba(DK, 0.82 * fade)); dk.addColorStop(0.7, rgba(DK, 0.5 * fade)); dk.addColorStop(1, rgba(DK, 0));
          G.fillStyle = dk; G.fillRect(0, 0, W, H);
          const bT = p.typeAt - 0.15;
          if (lt >= bT) GR.band(ctx, { y0: L.top - L.ch * 0.75, y1: (SL ? SL.bottom + SL.ch * 0.9 : L.bottom + L.ch * 0.6), color: DK, alpha: 0.85 * fade, wipe: clamp((fr24(lt - bT) + 1) / 4), v: 1, dx: -W * 0.08, sx: portrait ? 1.2 : 0.85 });
          /* rótulo: color de escena con barra */
          if (kStr && lt >= 0.1 && fr24(lt - 0.1) !== 2) {
            G.save(); G.globalAlpha = fade; G.fillStyle = sc.S; G.fillRect(x0, kY - kFs * 0.12, kFs * 2.2, kFs * 0.3);
            label(G, kStr, x0 + kFs * 3, kY, kFs, sc.S, "left"); G.restore();
          }
          /* respuesta: brochazo que se pinta en 3 cuadros, salpicaduras y chorreones */
          if (hit) {
            const d = lt - p.stampAt, f = fr24(d), pad = SL.fs * 0.34;
            G.save(); G.globalAlpha = fade; GR.splats(ctx, sp, lt, sc.S); G.fillStyle = sc.S;
            for (const q0 of drips) { const q = clamp(Math.floor((d - 0.2 - q0.d) * 12) / 8); if (q <= 0) continue; G.fillRect(q0.x, SL.bottom + pad * 0.9, q0.w, q0.h * q); G.beginPath(); G.arc(q0.x + q0.w / 2, SL.bottom + pad * 0.9 + q0.h * q, q0.w * 0.9, 0, 6.283); G.fill(); }
            G.restore();
            slab(G, x0 - pad * 0.6, SL.top - pad, SL.right - x0 + pad * 1.8, SL.bottom - SL.top + pad * 2, sc.S, 4242, clamp((f + 1) / 3), fade);
            if (f >= 1) {
              const qn = clamp((f - 1) / 6), amt = W * 0.06 * Math.pow(1 - qn, 1.5), ex = oq > 0 ? W * 0.7 * oq * oq : 0;
              GR.ink(ctx, { L: SL, ...LD, holes: { alpha: 0.55, ox: -W * 0.2 } });
              GR.put(ctx, { alpha: fade, dx: sx * 0.7, dy: sy * 0.7, slices: (amt > 0.5 || ex) ? GR.tear(SL, amt + ex, ex * 0.3) : null });
            }
            if (!out && d < 0.125) GR.fx(ctx, { neg: true, flipX: d < 0.042, zoom: 1.08, zx: (SL.left + SL.right) / 2 / W, zy: (SL.top + SL.bottom) / 2 / H });
          }
          /* pregunta: cada letra aparece como motas que se densifican (3 cuadros) */
          const now = stop(lt, 24), groups = [[], [], [], []];
          L.glyphs.forEach((g, k) => { const a = now - tk[k]; if (a < 0) return; groups[Math.min(3, Math.floor(a * 24 + 1e-6))].push(g); });
          const ex = oq > 0 ? -W * 0.7 * oq * oq : 0, qa = (hit ? 0.82 : 1) * fade;
          const r = K.rng(GR.boilFrame(lt) * 31 + 5), jx = (r() - 0.5) * u * 0.22, jy = (r() - 0.5) * u * 0.22;
          groups.forEach((gs, k) => {
            if (!gs.length) return;
            const look = k === 3 ? { ...LC, holes: { alpha: 0.72, ox: -W * 0.1 } } : { fill: { tex: GR.S.tex.speck[k], color: CREAM, sc: 1.3, ox: -W * 0.3 } };
            GR.ink(ctx, { L: { ...L, glyphs: gs }, ...look });
            GR.put(ctx, { alpha: qa, dx: sx * 0.6 + jx, dy: sy * 0.6 + jy, slices: ex ? GR.tear(L, ex, ex * 0.3) : null });
          });
          /* cursor de color: fijo mientras aparece, titila después, se va con la respuesta */
          const vis = L.glyphs.filter((g, k) => now >= tk[k]), lastG = vis[vis.length - 1];
          if (lt >= p.typeAt && !hit && !out && (lt < typedEnd + 0.1 || Math.floor(lt * 3) % 2 === 0)) {
            const gx = lastG ? lastG.x + lastG.w + L.fs * 0.05 : x0, gy = lastG ? lastG.y : L.top + L.ch;
            G.fillStyle = sc.S; G.fillRect(gx, gy - L.ch, L.fs * 0.1, L.ch);
          }
          if (oq > 0) { G.fillStyle = rgba(DK, oq * 0.85); G.fillRect(0, 0, W, H); }
        },
      };
    },
  });
})();
