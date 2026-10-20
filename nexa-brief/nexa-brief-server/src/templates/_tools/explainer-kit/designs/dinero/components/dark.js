/* =============================================================================
   dinero · planos sobre negro verdoso: alfiler-persona con anillo (ref. 11,6 s),
   palabras contorneadas + rellenas que se tipean al ritmo de la voz (ref. 12,3 s),
   ojo gigante que se aleja (ref. 14,3 s) y ojos que flotan (ref. 15,5 s).
   ========================================================================== */
(function () {
  const K = Kit, D = Kit.dinero, { clamp, lerp, prog, ease } = K, TAU = Math.PI * 2;

  /* ------------------------------------------------------------------ alfiler-persona */
  K.register({
    name: "dinero.pin", tags: ["persona", "uno", "foco", "individuo"], layer: "main",
    summary: "Sobre negro verdoso, un ALFILER-PERSONA verde (cono con cabeza) sube desde abajo con un anillo blanco alrededor de la cabeza; a mitad del plano la cámara se aleja de golpe y el anillo se cierra sobre la cabeza; el rótulo se tipea al lado (ref. 11,6 s). Para señalar a una persona, un 'tú' o 'uno solo'.",
    example: { label: "UNO SOLO" },
    params: {
      label: { type: "string", default: "", doc: "Rótulo blanco que se tipea junto al alfiler (≤ 16 caracteres)." },
      zoomAt: { type: "number", default: 0.5, doc: "Segundo del alejamiento." },
      ...D.FX("cut"),
    },
    create(ctx, p) {
      const P = ctx.C.palette, { W, H, u, portrait } = ctx.stage, S = Math.min(W, H);
      const label = String(p.label).toUpperCase(), lfs = u * (portrait ? 6 : 5);
      return {
        render(lt, b) {
          if (!D.keep(ctx, b, lt)) return;
          const G = ctx.g.main, T = D.enter(ctx, p.fx, lt, b);
          T.begin(G); D.solid(G, W, H, P.black);
          /* referencia 11,6–12,2 s: el ojo de cerradura ya está centrado (anillo r ≈ 0,13·H a 0,42·H)
             y se ACERCA apenas; no sube ni se aleja */
          const zq = prog(lt, p.zoomAt, 0.16, "expoOut"), up = prog(lt, 0, 0.18, "out");
          const s = lerp(0.94, 1, up) + 0.08 * prog(lt, 0.1, 0.7, "inOut"), hr = S * 0.075;
          const hx = W / 2 - (label ? lerp(0, W * (portrait ? 0 : 0.14), zq) : 0), hy = H * (portrait ? 0.42 : 0.43);
          G.save(); G.translate(hx, hy); G.scale(s, s);
          const coneH = H * 1.1, cw = hr * 1.15;
          const gr = G.createLinearGradient(-cw, 0, cw, 0); gr.addColorStop(0, D.mix(P.green, P.sageLight, 0.25)); gr.addColorStop(0.45, P.green); gr.addColorStop(1, P.deep);
          G.fillStyle = gr; G.beginPath(); G.moveTo(0, -hr * 0.4); G.lineTo(cw, coneH); G.lineTo(-cw, coneH); G.closePath(); G.fill();
          const vg = G.createLinearGradient(0, 0, 0, coneH * 0.4); vg.addColorStop(0, D.rgba(P.deep, 0.9)); vg.addColorStop(1, D.rgba(P.deep, 0));
          G.fillStyle = vg; G.beginPath(); G.moveTo(0, -hr * 0.4); G.lineTo(cw, coneH); G.lineTo(-cw, coneH); G.closePath(); G.fill();
          G.fillStyle = P.deep; G.beginPath(); G.arc(0, 0, hr, 0, TAU); G.fill();
          const rr = hr * 2.5;   /* ref: anillo r ≈ 0,19·H */
          G.strokeStyle = P.white; G.lineWidth = hr * 0.33; G.beginPath(); G.arc(0, 0, rr, 0, TAU); G.stroke();
          G.restore();
          if (label && zq > 0.5) {
            const n = Math.floor(clamp((lt - p.zoomAt - 0.12) / (label.length * 0.04)) * label.length);
            const lx = portrait ? W / 2 : hx + hr * 1.5, ly = portrait ? hy + hr * 1.6 + lfs : hy + lfs * 0.36;
            D.text(G, label.slice(0, n), lx, ly, { font: D.SANS(lfs, 800), color: P.white, align: portrait ? "center" : "left" });
          }
          T.end(G);
        },
      };
    },
  });

  /* ------------------------------------------------------------------ palabras contorneadas + rellenas (letra narrada) */
  function star(G, x, y, r, rot, color, lw) {
    G.save(); G.strokeStyle = color; G.lineWidth = lw; G.lineJoin = "round"; G.beginPath();
    for (let i = 0; i < 10; i++) { const a = rot + i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? r * 0.42 : r; i ? G.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : G.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    G.closePath(); G.stroke(); G.restore();
  }
  K.register({
    name: "dinero.outline", tags: ["letra", "frase", "karaoke", "texto", "clímax"], layer: "main",
    summary: "La frase NARRADA sobre negro verdoso (ref. 12,3–14,2 s 'dirty cash want i you'): cada palabra se tipea cuando la voz la dice, en blanco Open Sans 800 con tamaños escalonados (la 1ª del renglón grande, las siguientes chicas y corridas), detrás la 1ª palabra GIGANTE solo en contorno, una estrella verde, la palabra clave en verde grande con un ojito y rayos verdes tenues. Es la 'letra grande' del diseño (reemplaza a common.lyric).",
    example: { words: ["el", "dinero", "se", "^congeló^"] },
    params: {
      words: { type: "array", default: [], doc: "Palabras a mostrar ('^x^' = clave en verde). Vacío = las palabras NARRADAS en el beat, a su tiempo." },
      accent: { type: "array", default: [], doc: "Palabras narradas que van en verde grande (modo automático)." },
      ghost: { type: "string", default: "", doc: "Palabra gigante en contorno detrás (vacío = la 1ª de cada página)." },
      ...D.FX("cut"),
    },
    create(ctx, p) {
      const P = ctx.C.palette, { W, H, u, portrait } = ctx.stage, b0 = ctx.beat;
      ctx.beat.hideCaptions = ctx.beat.hideCaptions ?? true;
      let items;
      if (p.words && p.words.length) {
        const flat = p.words.flatMap(s => D.marks(s)), step = clamp(b0.dur * 0.9 / Math.max(1, flat.length), 0.15, 0.6);
        items = flat.map((m, i) => ({ s: m.w, acc: m.acc, t: 0.05 + i * step, d: step }));
      } else {
        const acc = new Set((p.accent || []).map(K.norm));
        items = D.words(ctx, b0).map(w => ({ s: w.text.replace(/[.,;:…]+$/, ""), acc: acc.has(K.norm(w.text)), t: w.start - b0.t0, d: Math.max(0.12, w.end - w.start) }));
      }
      const S = u * (portrait ? 11 : 16), max = portrait ? 9 : 11, perPage = portrait ? 4 : 3;   /* ref: 'dirty' blanco ≈ 0,16·H, dos palabras por renglón */
      /* renglones: corte por largo; la palabra clave va sola en su renglón */
      const lines = []; let cur = null;
      for (const it of items) {
        const len = cur ? cur.reduce((a, x) => a + x.s.length + 1, 0) : 0;
        if (!cur || it.acc || cur.some(x => x.acc) || len + it.s.length > max) { cur = []; lines.push(cur); }
        cur.push(it);
      }
      const pages = []; for (let i = 0; i < lines.length; i += perPage) pages.push(lines.slice(i, i + perPage));
      /* medidas: 1ª palabra del renglón = S, resto 0,62 S un poco más abajo; clave = 1,75 S */
      const layout = pages.map(pg => {
        const rows = pg.map(ln => {
          let x = 0; const ws = ln.map((it, k) => {
            const fs = it.acc ? S * 1.75 : k === 0 ? S : S * 0.62, w = D.measure(it.s, D.SANS(fs, 800));
            const o = { ...it, fs, x, dy: k === 0 || it.acc ? 0 : S * 0.08 }; x += w + S * 0.28; o.w = w; return o;
          });
          return { ws, w: x - S * 0.28, h: Math.max(...ws.map(o => o.fs)) * 0.95 };
        });
        const bw = Math.max(...rows.map(r => r.w)), bh = rows.reduce((a, r) => a + r.h, 0);
        let y = H * 0.47 - bh / 2;
        rows.forEach(r => { y += r.h; r.y = y; r.x = W / 2 - bw / 2 + (portrait ? (bw - r.w) / 2 : 0); });
        return { rows, t0: pg[0][0].t, ghost: p.ghost || pg[0][0].s, gx: W / 2 - bw / 2 - S * 0.5, gy: rows[0].y + S * 0.25 };
      });
      return {
        render(lt, b) {
          if (!D.keep(ctx, b, lt)) return;
          const G = ctx.g.main, T = D.enter(ctx, p.fx, lt, b);
          T.begin(G); D.solid(G, W, H, P.black);
          /* rayos verdes tenues desde abajo */
          G.save(); G.strokeStyle = D.rgba(P.leaf, 0.12); G.lineWidth = Math.max(1, u * 0.12);
          for (let i = 0; i < 4; i++) { const a = -1.2 - i * 0.18 + Math.sin(lt * 0.4 + i) * 0.04, x = W * (0.45 + i * 0.05); G.beginPath(); G.moveTo(x, H); G.lineTo(x + Math.cos(a) * H * 0.35, H + Math.sin(a) * H * 0.35); G.stroke(); }
          G.restore();
          let pi = 0; layout.forEach((pg, i) => { if (lt >= pg.t0 - 0.05) pi = i; });
          const pg = layout[pi]; if (!pg) { T.end(G); return; }
          const z = 1 + 0.012 * (lt - pg.t0);
          G.save(); G.translate(W / 2, H / 2); G.scale(z, z); G.translate(-W / 2, -H / 2 - u * 0.4 * (lt - pg.t0));
          /* fantasma en contorno */
          const first = pg.rows[0].ws[0], gq = clamp((lt - first.t) / Math.max(0.15, first.d));
          const gfs = S * 2.3 * (portrait ? 0.85 : 1), gtxt = pg.ghost.slice(0, Math.ceil(gq * pg.ghost.length));
          D.text(G, gtxt, pg.gx, pg.gy, { font: D.SANS(gfs, 700), stroke: D.rgba(P.muted, 1), lw: Math.max(1, u * 0.24) });
          pg.rows.forEach((r, ri) => r.ws.forEach((o, k) => {
            if (lt < o.t - 0.03) return;
            const q = clamp((lt - o.t + 0.03) / Math.min(0.3, o.d)), txt = o.s.slice(0, Math.max(1, Math.ceil(q * o.s.length)));
            const x = r.x + o.x, y = r.y + o.dy;
            D.text(G, txt, x, y, { font: D.SANS(o.fs, 800), color: o.acc ? P.leaf : P.white });
            if (o.acc && q >= 1) {
              const ex = x + o.w + o.fs * 0.2, ey = y - o.fs * 0.42, er = o.fs * 0.17;
              G.save(); G.fillStyle = P.deep; G.beginPath(); G.arc(ex, ey, er, 0, TAU); G.fill();
              G.strokeStyle = P.white; G.lineWidth = er * 0.3; G.beginPath(); G.arc(ex + er * 0.1, ey, er * 0.45, -2.2 + Math.sin(lt * 2) * 0.3, 1.6); G.stroke(); G.restore();
            }
            if (ri === 0 && k === 1) star(G, x + o.w + S * 0.15, y - S * 0.15, S * 0.32, lt * 0.5, P.leaf, Math.max(1, u * 0.2));
          }));
          G.restore();
          T.end(G);
        },
      };
    },
  });

  /* ------------------------------------------------------------------ ojo gigante */
  function almondPath(G, w, h) { G.beginPath(); G.moveTo(-w / 2, 0); G.bezierCurveTo(-w * 0.2, -h * 0.75, w * 0.2, -h * 0.75, w / 2, 0); G.bezierCurveTo(w * 0.2, h * 0.75, -w * 0.2, h * 0.75, -w / 2, 0); G.closePath(); }
  function bigEye(G, x, y, w, rot, look, P) {
    const h = w * 0.62;
    G.save(); G.translate(x, y); G.rotate(rot);
    G.save(); G.translate(-w * 0.035, h * 0.06); G.scale(1.07, 1.12); G.fillStyle = P.deep; almondPath(G, w, h); G.fill(); G.restore();
    G.fillStyle = P.white; almondPath(G, w, h); G.fill();
    G.save(); almondPath(G, w, h); G.clip();
    const ir = h * 0.5, ix = look[0] * w * 0.08, iy = look[1] * h * 0.08;
    const g = G.createRadialGradient(ix, iy, ir * 0.3, ix, iy, ir); g.addColorStop(0, P.deep); g.addColorStop(1, D.mix(P.deep, P.black, 0.35));
    G.fillStyle = g; G.beginPath(); G.arc(ix, iy, ir, 0, TAU); G.fill();
    G.fillStyle = D.mix(P.leaf, P.deep, 0.25); G.beginPath(); G.arc(ix + ir * 0.06, iy + ir * 0.06, ir * 0.48, 0, TAU); G.fill();
    G.restore(); G.restore();
  }
  K.register({
    name: "dinero.eye", tags: ["mirada", "vigilancia", "atención", "texto"], layer: "main",
    summary: "OJO gigante plano (almendra blanca con borde verde e iris verde) sobre negro verdoso (ref. 14,3 s): primero muy cerca, cortado por el borde, mientras el texto en mayúsculas blancas se tipea a la izquierda; en `split` la cámara se aleja de golpe y queda el ojo entero, inclinado, mirando, con el texto al costado. Para 'alguien mira', vigilancia, atención o deseo.",
    example: { text: "TODOS\nMIRABAN" },
    params: {
      text: { type: "string", required: true, doc: "1–2 renglones cortos ('\\n')." },
      split: { type: "number", default: 0.5, doc: "Segundo del alejamiento." },
      ...D.FX("cut"),
    },
    create(ctx, p) {
      const P = ctx.C.palette, { W, H, u, portrait } = ctx.stage, S = Math.min(W, H);
      const lines = String(p.text).toUpperCase().split("\n").filter(Boolean), total = lines.join("").length;
      return {
        render(lt, b) {
          if (!D.keep(ctx, b, lt)) return;
          const G = ctx.g.main, T = D.enter(ctx, p.fx, lt, b);
          T.begin(G); D.solid(G, W, H, P.black);
          const zq = prog(lt, p.split, 0.14, "expoOut"), look = [Math.sin(lt * 1.3) * 0.8, Math.cos(lt * 0.9) * 0.5];
          const ex = lerp(W * (portrait ? 0.85 : 0.82), W * (portrait ? 0.5 : 0.6), zq), ey = lerp(H * (portrait ? 0.62 : 0.78), H * (portrait ? 0.56 : 0.48), zq);
          const ew = lerp(S * 1.9, S * (portrait ? 0.62 : 0.46), zq) * (1 + 0.01 * lt);
          bigEye(G, ex, ey, ew, -1.05, look, P);
          const fs = lerp(u * (portrait ? 6.5 : 5), u * (portrait ? 5 : 3.4), zq), lx = portrait ? W / 2 : lerp(W * 0.22, ex - ew * 0.42, zq);
          const ly = portrait ? lerp(H * 0.25, H * 0.3, zq) : lerp(H * 0.38, ey - fs * 0.3, zq);
          let n = Math.floor(clamp((lt - 0.05) / Math.max(0.3, total * 0.06)) * total);
          lines.forEach((l, i) => {
            const s = l.slice(0, Math.max(0, n)); n -= l.length;
            D.text(G, s, lx, ly + i * fs * 1.05, { font: D.SANS(fs, 800), color: P.white, align: portrait ? "center" : zq > 0.5 ? "right" : "center" });
          });
          if (zq > 0 && zq < 0.8) D.smear(ctx, 0, u * 2, 3, 0.18);
          T.end(G);
        },
      };
    },
  });

  /* ------------------------------------------------------------------ ojos que flotan */
  const SPOTS = [[0.13, 0.32, 0.055], [0.86, 0.4, 0.1], [0.12, 0.74, 0.07], [0.69, 0.23, 0.016], [0.73, 0.88, 0.017], [0.35, 0.15, 0.025], [0.9, 0.78, 0.04]];
  K.register({
    name: "dinero.eyes", tags: ["mirada", "miedo", "todos", "público", "texto"], layer: "main",
    summary: "OJOS de dibujo animado (esferas blancas con pupila) de distintos tamaños que aparecen, flotan y miran para todos lados sobre negro verdoso, con un texto corto verde al centro (ref. 15,5 s 'NEED YOU'). Para 'todos miran', la presión del público o una sensación de ser observado.",
    example: { text: "TODOS\nQUIEREN" },
    params: {
      text: { type: "string", default: "", doc: "Texto corto central (1–2 renglones)." },
      count: { type: "number", default: 6, min: 2, max: 7, doc: "Cantidad de ojos." },
      ...D.FX("cut"),
    },
    create(ctx, p) {
      const P = ctx.C.palette, { W, H, u, portrait } = ctx.stage, S = Math.min(W, H);
      const lines = String(p.text).toUpperCase().split("\n").filter(Boolean), fs = u * (portrait ? 8 : 6.5);
      const rr = K.rng(77), spots = SPOTS.slice(0, p.count).map((s, i) => ({ x: portrait ? s[1] * 0.9 + 0.05 : s[0], y: portrait ? s[0] : s[1], r: s[2] * (portrait ? 1.5 : 1.25), ph: rr() * 6, seed: i * 31 + 5 }));
      return {
        render(lt, b) {
          if (!D.keep(ctx, b, lt)) return;
          const G = ctx.g.main, T = D.enter(ctx, p.fx, lt, b);
          T.begin(G); D.solid(G, W, H, P.black);
          spots.forEach((s, i) => {
            const q = prog(lt, 0.03 + i * 0.04, 0.22, "back"); if (q <= 0) return;
            const seg = Math.floor(lt / 0.45), f = ease.inOut(clamp((lt - seg * 0.45) / 0.15));
            const a = K.rng(s.seed + seg * 7)(), a0 = K.rng(s.seed + (seg - 1) * 7)();
            const ang = lerp(a0, a, f) * TAU, lx = Math.cos(ang) * 0.9, ly = Math.sin(ang) * 0.9;
            const x = s.x * W + Math.sin(lt * 0.9 + s.ph) * u * 1.2, y = s.y * H + Math.cos(lt * 1.1 + s.ph) * u * 1.2;
            G.save(); G.translate(x, y); G.scale(q, q); D.googly(G, 0, 0, s.r * S, lx, ly, P); G.restore();
          });
          lines.forEach((l, i) => {
            const q = prog(lt, 0.12 + i * 0.08, 0.15, "out"); if (q <= 0) return;
            D.text(G, l, W / 2, H * 0.5 - (lines.length - 1) * fs * 0.45 + i * fs * 0.9 + fs * 0.36, { font: D.SANS(fs, 800), color: P.leaf, align: "center", alpha: q });
          });
          T.end(G);
        },
      };
    },
  });
})();
