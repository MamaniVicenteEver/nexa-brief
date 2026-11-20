/* =============================================================================
   dinero · intros (gancho) con el contrato común de designs/common/hook.js
   -----------------------------------------------------------------------------
   dinero.introv1 · GOLPE: titular en bloque Open Sans 800 que entra palabra por
     palabra volteándose en 3D con desenfoque de movimiento (como "Dirty Cash"),
     la ^palabra^ en verde billete con estallido de monedas; en glitchAt el cuadro
     se abomba con el lente ojo de pez, tiembla y destella.
   dinero.introv2 · PREGUNTA + REVELACIÓN: la pregunta en Montserrat fina con brillo
     se decodifica sobre fieltro; en stampAt barrido con destello, la pregunta se
     achica arriba con subrayado y la respuesta cae GIGANTE en verde volteándose.
   Fondos propios (Kit.dinero.hook.scenes, también los usa outro.js):
     paper (gris claro con monedas que caen) · felt (fieltro verde con ornamento de
     billete) · sage (salvia con garabatos) · black (negro verdoso con rayos verdes) ·
     fog (pared gris verdosa).
   ========================================================================== */
(function () {
  const K = Kit, D = Kit.dinero, { clamp, lerp, prog, ease } = K, TAU = Math.PI * 2;
  const PRESETS = ["paper", "felt", "sage", "black", "fog"];
  const LIGHT = new Set(["paper", "sage", "fog"]);

  function scenes(ctx) {
    const P = ctx.C.palette, rc = K.rng(4401), coins = Array.from({ length: 16 }, () => ({ x: rc(), r: 1.8 + rc() * 4, v: 0.2 + rc() * 0.35, ph: rc() * 1.3, sp: 3 + rc() * 5, s0: rc() * 6, bl: rc() < 0.4 }));
    return {
      paper(G, st, lt) {
        D.paperBg(G, st.W, st.H, P);
        for (const k of coins) { const y = (((k.ph + lt * k.v) % 1.3) - 0.15) * st.H; D.coin(G, k.x * st.W, y, k.r * st.u, Math.cos(lt * k.sp + k.s0), P, k.bl ? st.u * 0.5 : 0); }
        D.vignette(G, st.W, st.H, 0.5, P.black, 0.4);
      },
      felt(G, st, lt) {
        D.feltBg(G, st.W, st.H, P, lt); D.vignette(G, st.W, st.H, 0.6, P.black, 0.25);
        G.save(); G.strokeStyle = D.rgba(P.feltDark, 0.6); G.lineWidth = Math.max(1, st.u * 0.14);
        for (const e of [st.u * 2.2, st.H - st.u * 2.2]) for (let k = 0; k < 4; k++) { G.beginPath(); for (let x = 0; x <= st.W; x += st.u) { const y = e + Math.sin(x / (st.u * 3.2) + k * 1.6 + lt * 0.6) * st.u * 1.4 * (k % 2 ? 1 : -0.7); x ? G.lineTo(x, y) : G.moveTo(x, y); } G.stroke(); }
        G.restore();
      },
      sage(G, st, lt) {
        D.sageBg(G, st.W, st.H, P);
        G.save(); G.strokeStyle = D.rgba(P.black, 0.35); G.lineWidth = Math.max(1, st.u * 0.15);
        for (let i = 0; i < 7; i++) { const r = K.rng(i * 17 + 3), x = r() * st.W, y = (((r() - lt * 0.04) % 1) + 1) % 1 * st.H; G.beginPath(); G.arc(x, y, st.u * (0.6 + r() * 1.2), 0, TAU); G.stroke(); }
        G.restore();
      },
      black(G, st, lt) {
        D.solid(G, st.W, st.H, P.black);
        G.save(); G.strokeStyle = D.rgba(P.leaf, 0.13); G.lineWidth = Math.max(1, st.u * 0.12);
        for (let i = 0; i < 5; i++) { const a = -1.15 - i * 0.16 + Math.sin(lt * 0.4 + i) * 0.05, x = st.W * (0.4 + i * 0.06); G.beginPath(); G.moveTo(x, st.H); G.lineTo(x + Math.cos(a) * st.H * 0.5, st.H + Math.sin(a) * st.H * 0.5); G.stroke(); }
        G.restore();
      },
      fog(G, st) { D.fogBg(G, st.W, st.H, P); },
    };
  }
  /** fondo intercambiable: fotos en plata verdosa + velo */
  function hookBg(ctx, p, auto) {
    const BG = K.hook.bg(ctx, p, { auto, presets: scenes(ctx), tone: () => D.tint(ctx, p.src, "dark") });
    return { mode: BG.mode, light: LIGHT.has(BG.mode), render: (lt, b, t) => BG.render(lt, b, t), dispose: () => BG.dispose() };
  }
  /** "¿QUIÉN ^PAGA^?\nLA CUENTA" → renglones de {w, acc} */
  const parse = text => String(text ?? "").split("\n").map(l => D.marks(l)).filter(l => l.length);
  /** estallido de monedas desde (x,y) */
  function burst(G, x, y, q, S, P, seed) {
    if (q <= 0 || q >= 1) return;
    const r = K.rng(seed);
    for (let i = 0; i < 10; i++) {
      const a = r() * TAU, d = S * (0.25 + r() * 0.5) * ease.out(q), g = S * 0.5 * q * q;
      D.coin(G, x + Math.cos(a) * d, y + Math.sin(a) * d + g, S * (0.025 + r() * 0.03), Math.cos(q * 12 + i), P, 0, 1 - q * q);
    }
  }
  const outQ = (lt, b, post = 0.6) => clamp((lt - b.dur) / post);

  /* ================================================================ introv1 */
  K.register({
    name: "dinero.introv1", tags: ["intro", "gancho", "apertura", "título", "impacto", "3D"], layer: "main", post: 0.6,
    summary: "GANCHO de apertura (lo primero que se ve). Titular en BLOQUE Open Sans 800 que entra palabra por palabra VOLTEÁNDOSE en 3D con desenfoque de movimiento (como 'Dirty Cash' de la referencia); la '^palabra^' va en verde billete y estalla en monedas; en glitchAt el cuadro se ABOMBA con el lente ojo de pez dentro de un rectángulo redondeado, tiembla y destella. Fondo adaptable (bg: paper | felt | sage | black | fog | image con src | component con use/useParams); por defecto gris claro con monedas que caen.",
    example: { text: "¿QUIÉN PAGA\nLA ^CUENTA^?", kicker: "Economía · 2026", sub: "nadie lo dice en voz alta", glitchAt: 2.2 },
    params: {
      text: { type: "string", required: true, doc: "Titular gancho corto (2–6 palabras). '\\n' = renglón; '^x^' = palabra en verde con monedas." },
      kicker: { type: "string", default: "", doc: "Rótulo fino arriba (se decodifica)." },
      sub: { type: "string", default: "", doc: "Línea chica debajo del titular." },
      wordAt: { type: "number", default: 0.35, doc: "Segundo de la primera palabra." },
      stagger: { type: "number", default: 0.26, min: 0.08, doc: "Segundos entre palabras." },
      glitchAt: { type: "number", default: 2.2, doc: "Segundo del IMPACTO: lente ojo de pez + temblor + destello (-1 = sin impacto). Acepta '@palabra'." },
      ...K.hook.bgParams(PRESETS),
    },
    create(ctx, p) {
      ctx.beat.hideCaptions = true;
      const P = ctx.C.palette, { W, H, u, portrait } = ctx.stage, S = Math.min(W, H);
      let Ls = parse(String(p.text).toUpperCase());
      if (portrait) { const flat = Ls.flat(), out = [[]]; for (const w of flat) { const cur = out.at(-1), len = cur.reduce((a, x) => a + x.w.length + 1, 0); if (cur.length && len + w.w.length > 9) out.push([]); out.at(-1).push(w); } Ls = out; }
      const nL = Ls.length, sp = 0.28;
      const lineW = (l, f) => l.reduce((a, w, k) => a + D.measure(w.w, D.SANS(f, 800)) + (k ? f * sp : 0), 0);
      const fs = Math.min(W * (portrait ? 0.88 : 0.82) / Math.max(...Ls.map(l => lineW(l, 100))) * 100, H * (portrait ? 0.12 : 0.2) / (nL > 2 ? 1.2 : 1));
      const lh = fs * 0.95, cy = H * (portrait ? 0.44 : 0.47), y0 = cy - (nL - 1) * lh / 2 + fs * 0.36;
      const W8 = []; let k = 0;
      Ls.forEach((l, li) => { let x = (W - lineW(l, fs)) / 2; l.forEach(w => { const ww = D.measure(w.w, D.SANS(fs, 800)); W8.push({ ...w, x, ww, y: y0 + li * lh, t: p.wordAt + k * p.stagger, r: K.rng(k * 13 + 7)() < 0.5 ? -1 : 1 }); x += ww + fs * sp; k++; }); });
      const BG = hookBg(ctx, p, "paper"), ink = () => (BG.light ? P.black : P.white), acc = () => (BG.light ? P.green : P.accent);
      const words = (G, lt, alpha) => {
        for (const w of W8) {
          const q = prog(lt, w.t, 0.28, "back"); if (lt < w.t) continue;
          const cx = w.x + w.ww / 2;
          const draw = (qq, a) => {
            G.save(); G.translate(cx, w.y); G.rotate((1 - Math.min(1, qq)) * 0.5 * w.r);
            G.transform(1, 0, (1 - Math.min(1, qq)) * 0.8 * w.r, 1, 0, 0); G.scale(1 + (1 - Math.min(1, qq)) * 0.4, Math.max(0.04, Math.min(1.1, qq)));
            G.globalAlpha = alpha * a * clamp(qq * 2);
            if (BG.light) { G.shadowColor = D.rgba(P.black, 0.25); G.shadowBlur = fs * 0.06 * ctx.dpr; G.shadowOffsetY = fs * 0.04 * ctx.dpr; }
            else { G.shadowColor = D.rgba(P.black, 0.7); G.shadowBlur = fs * 0.1 * ctx.dpr; G.shadowOffsetY = fs * 0.05 * ctx.dpr; }
            D.text(G, w.w, -w.ww / 2, 0, { font: D.SANS(fs, 800), color: w.acc ? acc() : ink() });
            G.restore();
          };
          if (q < 0.97) for (let s = 3; s >= 1; s--) draw(prog(lt - s * 0.014, w.t, 0.28, "back"), 0.25);
          draw(q, 1);
          if (w.acc) burst(G, cx, w.y - fs * 0.35, prog(lt, w.t + 0.05, 0.9, "linear"), S, P, k * 31 + 11);
        }
      };
      const scene = (G, lt, b, t, alpha) => {
        const ga = p.glitchAt >= 0 ? lt - p.glitchAt : -1, sh = ga > 0 && ga < 0.45 ? Math.sin(ga * 70) * (1 - ga / 0.45) * u * 1.4 : 0;
        BG.render(lt, b, t);
        G.save(); G.translate(sh, -sh * 0.5);
        if (p.kicker) D.text(G, D.decode(String(p.kicker).toUpperCase(), lt - 0.1, 22, 5), W / 2, y0 - lh - fs * 0.55, { font: D.THIN(u * (portrait ? 3.2 : 2.4), 300), color: ink(), align: "center", sp: u * 0.8 });
        words(G, lt, alpha);
        if (p.sub) {
          const n = Math.floor(clamp((lt - (W8.at(-1)?.t ?? 0) - 0.35) / 0.5) * p.sub.length);
          D.text(G, p.sub.slice(0, n), W / 2, y0 + (nL - 1) * lh + fs * 0.75, { font: D.SANS(u * (portrait ? 3.6 : 2.8), 700), color: ink(), align: "center" });
        }
        G.restore();
      };
      return {
        dispose() { BG.dispose(); },
        render(lt, b, t) {
          const G = ctx.g.main, o = outQ(lt, b), ga = p.glitchAt >= 0 ? (lt - p.glitchAt) / 0.7 : -1;
          if (ga > 0 && ga < 1) {
            const [sc, sg] = D.scratch(ctx, 0), mainG = ctx.g.main;
            ctx.g.main = sg; try { scene(sg, lt, b, t, 1 - o); } finally { ctx.g.main = mainG; }
            D.solid(G, W, H, P.black);
            const sz = ga < 0.15 ? lerp(1, 0.84, ease.out(ga / 0.15)) : lerp(0.84, 1.04, ease.inOut(clamp((ga - 0.5) / 0.5)));
            const bw = W * sz, bh = H * sz;
            D.fisheye(ctx, G, sc, 0.4 * (1 - prog(ga, 0.55, 0.45)), { x: (W - bw) / 2, y: (H - bh) / 2, w: bw, h: bh }, Math.min(bw, bh) * 0.22 * (1 - prog(ga, 0.8, 0.2)));
            if (ga < 0.06) { const T = ctx.g.top; T.save(); T.fillStyle = D.rgba(P.white, 0.75); T.fillRect(0, 0, W, H); T.restore(); }
          } else scene(G, lt, b, t, 1 - o);
          if (o > 0) D.smear(ctx, W * 0.1 * o, 0, 5, 0.15 * (1 - o));
        },
      };
    },
  });

  /* ================================================================ introv2 */
  K.register({
    name: "dinero.introv2", tags: ["intro", "gancho", "apertura", "pregunta", "revelación", "neón"], layer: "main", post: 0.6,
    summary: "GANCHO pregunta + revelación. La pregunta en MAYÚSCULAS finas blancas con brillo y sombra larga se DECODIFICA letra por letra sobre fieltro verde (como 'MONEY' de la referencia); en stampAt barrido con destello, la pregunta se achica arriba con un subrayado de punta brillante y la RESPUESTA cae gigante en Open Sans 800 verde volteándose en 3D con desenfoque, con anillo de chispa. Fondo adaptable (bg: felt | paper | sage | black | fog | image con src | component con use/useParams); por defecto fieltro verde.",
    example: { text: "¿CUÁNTO VALE\nUNA IDEA?", kicker: "Dartmouth · 1956", stamp: "7.500 DÓLARES", stampAt: 2.4 },
    params: {
      text: { type: "string", required: true, doc: "Pregunta gancho ('\\n' = renglón)." },
      kicker: { type: "string", default: "", doc: "Rótulo fino arriba." },
      stamp: { type: "string", default: "", doc: "Respuesta que cae (vacío = sin revelación)." },
      stampAt: { type: "number", default: 2.4, doc: "Segundo de la revelación (acepta '@palabra')." },
      typeAt: { type: "number", default: 0.3, doc: "Segundo en que empieza a decodificarse la pregunta." },
      cps: { type: "number", default: 16, min: 4, doc: "Letras por segundo." },
      ...K.hook.bgParams(PRESETS, "auto"),
    },
    create(ctx, p) {
      ctx.beat.hideCaptions = true;
      const P = ctx.C.palette, { W, H, u, portrait } = ctx.stage, dpr = ctx.dpr;
      const Q = String(p.text).toUpperCase().split("\n").flatMap(l => portrait ? D.wrap(l, 12) : [l.trim()]).filter(Boolean);
      const qfs = Math.min(W * (portrait ? 0.88 : 0.66) / Math.max(...Q.map(l => D.measure(l, D.THIN(100, 200), 2) / 100)), H * (portrait ? 0.075 : 0.13));
      const stamp = String(p.stamp || "").toUpperCase(), sfs = stamp ? Math.min(D.fit(stamp, W * (portrait ? 0.9 : 0.8), 1e9, s => D.SANS(s, 800)), H * (portrait ? 0.12 : 0.22)) : 0;
      const BG = hookBg(ctx, p, "felt"), total = Q.join("").length;
      return {
        dispose() { BG.dispose(); },
        render(lt, b, t) {
          const G = ctx.g.main, o = outQ(lt, b), sa = stamp ? lt - p.stampAt : -1, ph2 = sa >= 0.06;
          BG.render(lt, b, t);
          const col = BG.light ? P.black : P.white;
          G.save(); G.globalAlpha = 1 - o;
          const sc = ph2 ? lerp(1, 0.55, prog(sa, 0.06, 0.2, "expoOut")) : 1, cy = ph2 ? lerp(H * 0.45, H * (portrait ? 0.24 : 0.22), prog(sa, 0.06, 0.2, "expoOut")) : H * (portrait ? 0.42 : 0.45);
          if (p.kicker) D.text(G, D.decode(String(p.kicker).toUpperCase(), lt - 0.1, 22, 5), W / 2, cy - Q.length * qfs * sc * 0.6 - u * 3, { font: D.THIN(u * (portrait ? 3 : 2.3), 300), color: col, align: "center", sp: u * 0.8 });
          let used = 0;
          Q.forEach((l, i) => {
            const vis = Math.max(0, Math.floor((lt - p.typeAt) * p.cps) - used); used += l.length;
            const s = D.decode(l, (lt - p.typeAt) - (used - l.length) / p.cps, p.cps, i * 7 + 2).slice(0, Math.max(0, vis + 3));
            const y = cy + (i - (Q.length - 1) / 2) * qfs * 1.12 * sc + qfs * 0.36 * sc;
            G.save(); G.shadowColor = D.rgba(P.black, 0.75); G.shadowBlur = qfs * 0.1 * dpr * sc; G.shadowOffsetX = qfs * 0.07 * dpr * sc; G.shadowOffsetY = qfs * 0.1 * dpr * sc;
            D.text(G, s, W / 2, y, { font: D.THIN(qfs * sc, 200), color: col, align: "center", sp: qfs * 0.02 * sc });
            G.shadowColor = D.rgba(P.white, BG.light ? 0 : 0.7); G.shadowBlur = qfs * 0.06 * dpr * sc; G.shadowOffsetX = 0; G.shadowOffsetY = 0;
            D.text(G, s, W / 2, y, { font: D.THIN(qfs * sc, 200), color: col, align: "center", sp: qfs * 0.02 * sc });
            G.restore();
          });
          if (ph2) {
            /* subrayado con punta brillante bajo la pregunta */
            const uq = prog(sa, 0.2, 0.35, "inOut"), lw = Math.max(...Q.map(l => D.measure(l, D.THIN(qfs * sc, 200)))) * 0.9, ay = cy + Q.length * qfs * sc * 0.62;
            if (uq > 0) {
              G.save(); G.strokeStyle = col; G.lineWidth = Math.max(1, u * 0.25); G.lineCap = "round"; G.beginPath();
              let tx = 0, ty = 0;
              for (let q = 0; q <= uq + 1e-6; q += 0.04) { const qq = Math.min(q, uq); tx = W / 2 - lw / 2 + lw * qq; ty = ay + Math.sin(qq * Math.PI) * u * 1.2; q ? G.lineTo(tx, ty) : G.moveTo(tx, ty); }
              G.stroke(); G.fillStyle = P.white; G.shadowColor = P.white; G.shadowBlur = u * 3 * dpr; G.beginPath(); G.arc(tx, ty, u * 0.6, 0, TAU); G.fill(); G.restore();
            }
            /* respuesta que cae volteándose */
            const sy = H * (portrait ? 0.5 : 0.6), draw = (q, a) => {
              G.save(); G.translate(W / 2, sy); G.rotate((1 - Math.min(1, q)) * -0.4); G.transform(1, 0, (1 - Math.min(1, q)) * 0.7, 1, 0, 0); G.scale(1 + (1 - Math.min(1, q)) * 0.5, Math.max(0.04, Math.min(1.1, q)));
              G.globalAlpha = (1 - o) * a * clamp(q * 2);
              G.shadowColor = D.rgba(P.black, 0.6); G.shadowBlur = sfs * 0.08 * dpr; G.shadowOffsetX = sfs * 0.04 * dpr; G.shadowOffsetY = sfs * 0.06 * dpr;
              D.text(G, stamp, 0, sfs * 0.36, { font: D.SANS(sfs, 800), color: BG.light ? P.green : P.accent, align: "center" });
              G.restore();
            };
            const q = prog(sa, 0.06, 0.3, "back");
            if (q < 0.97) for (let s = 3; s >= 1; s--) draw(prog(sa - s * 0.015, 0.06, 0.3, "back"), 0.25);
            draw(q, 1);
            const rq = prog(sa, 0.3, 0.35, "out");
            if (rq < 1 && rq > 0) { D.sparks(G, W / 2, sy, sfs * (0.7 + rq), sfs * (0.9 + rq * 1.4), 12, 0.2, D.rgba(P.white, 1 - rq), Math.max(1.5, u * 0.3)); }
          }
          G.restore();
          if (sa >= 0 && sa < 0.06) { D.smear(ctx, W * 0.12, 0, 7, 0.22); const T = ctx.g.top; T.save(); T.fillStyle = D.rgba(P.fog, 0.5); T.fillRect(0, 0, W, H); T.restore(); }
          if (o > 0) D.smear(ctx, W * 0.1 * o, 0, 5, 0.15 * (1 - o));
        },
      };
    },
  });

  D.hook = { scenes, hookBg, PRESETS, parse, burst };
})();
