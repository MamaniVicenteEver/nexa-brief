/* =============================================================================
   dinero · tipografía cinética: palabra fina con brillo sobre fieltro verde
   (ref. 2,0–3,1 s) y palabras 3D que giran con desenfoque de movimiento, monedas
   que caen y lente ojo de pez (ref. 3,8–8,4 s).
   ========================================================================== */
(function () {
  const K = Kit, D = Kit.dinero, { clamp, lerp, prog, ease } = K, TAU = Math.PI * 2;

  /** ornamento de billete (guilloché) en los bordes de arriba y abajo */
  function guilloche(G, W, H, u, color, a, lt) {
    if (a <= 0) return;
    G.save(); G.globalAlpha *= a; G.strokeStyle = color; G.lineWidth = Math.max(1, u * 0.14);
    for (const edge of [u * 2.2, H - u * 2.2]) for (let k = 0; k < 4; k++) {
      G.beginPath();
      for (let x = 0; x <= W; x += u * 0.8) { const y = edge + Math.sin(x / (u * 3.2) + k * 1.6 + lt * 0.6) * u * 1.4 * (k % 2 ? 1 : -0.7); x ? G.lineTo(x, y) : G.moveTo(x, y); }
      G.stroke();
    }
    G.restore();
  }

  /* ------------------------------------------------------------------ neón fino sobre fieltro */
  K.register({
    name: "dinero.neon", tags: ["texto", "palabra", "brillo", "elegante"], layer: "main",
    summary: "Palabra en MAYÚSCULAS finas blancas con brillo y sombra larga sobre fieltro verde con viñeta (ref. 2,0 s 'MONEY'): las letras aparecen desenfocadas y se enfocan, un cuadro oscuro, líneas finas de cursor, barrido con destello y re-encuadre más chico con la 2ª línea en minúsculas, anillo de chispa y subrayado que se dibuja con punta brillante; ornamento de billete en los bordes. Para nombrar un concepto con elegancia.",
    example: { text: "PRESUPUESTO", sub: "la apuesta" },
    params: {
      text: { type: "string", required: true, doc: "Palabra o frase corta (≤ 14 caracteres en MAYÚSCULAS)." },
      sub: { type: "string", default: "", doc: "Segunda línea en minúsculas que llega en el re-encuadre (vacío = sin 2ª fase)." },
      subAt: { type: "number", default: 0.75, doc: "Segundo del barrido y re-encuadre (acepta '@palabra')." },
      ...D.FX("blob"),
    },
    create(ctx, p) {
      const P = ctx.C.palette, { W, H, u, portrait } = ctx.stage, txt = String(p.text).toUpperCase(), n = [...txt].length;
      const fs = Math.min(D.fit(txt, W * (portrait ? 0.86 : 0.58), 1e9, s => D.THIN(s, 200), 0.02), u * (portrait ? 13 : 15));
      const gl = D.glyphs(txt, D.THIN(fs, 200), fs * 0.02), step = Math.min(0.045, 0.3 / n);
      const has2 = !!p.sub, s2 = has2 ? p.subAt : 1e9;
      const dpr = ctx.dpr;
      return {
        render(lt, b) {
          if (!D.keep(ctx, b, lt)) return;
          const G = ctx.g.main, T = D.enter(ctx, p.fx, lt, b);
          T.begin(G);
          D.feltBg(G, W, H, P, lt);
          D.vignette(G, W, H, 0.6, P.black, 0.25);
          guilloche(G, W, H, u, P.feltDark, 0.55 * prog(lt, s2 > 50 ? 0.6 : s2 + 0.05, 0.3), lt);
          const ph2 = lt >= s2 + 0.07, z = 1 + lt * 0.01;
          const sc = ph2 ? 0.72 : 1, cx = W / 2 - (ph2 ? fs * 0.25 : 0), cy = H * (portrait ? 0.42 : 0.46) - (ph2 ? fs * 0.2 : 0);
          G.save(); G.translate(W / 2, H / 2); G.scale(z, z); G.translate(-W / 2, -H / 2);
          G.translate(cx, cy); G.scale(sc, sc);
          const x0 = -gl.width / 2, base = fs * 0.36;
          /* letras: desenfocadas → nítidas, con sombra larga y brillo blanco */
          gl.list.forEach((g, i) => {
            const t0 = 0.12 + i * step, q = ph2 ? 1 : prog(lt, t0, 0.12, "out"); if (q <= 0) return;
            G.save(); G.globalAlpha = q;
            if (q < 0.98) G.filter = `blur(${((1 - q) * fs * 0.08).toFixed(1)}px)`;
            const dx = (1 - q) * -fs * 0.15;
            G.shadowColor = D.rgba(P.black, 0.8); G.shadowBlur = fs * 0.1 * sc * dpr; G.shadowOffsetX = fs * 0.08 * sc * dpr; G.shadowOffsetY = fs * 0.12 * sc * dpr;
            D.text(G, g.c, x0 + g.x + dx, base, { font: D.THIN(fs, 200), color: P.white });
            G.shadowColor = D.rgba(P.white, 0.75); G.shadowBlur = fs * 0.06 * sc * dpr; G.shadowOffsetX = 0; G.shadowOffsetY = 0;
            D.text(G, g.c, x0 + g.x + dx, base, { font: D.THIN(fs, 200), color: P.white });
            G.restore();
          });
          if (has2) {
            const ss = fs * 0.82, sx = x0 - fs * 0.12, sy = base + fs * 0.92;
            /* líneas finas de cursor y tipeo antes del barrido */
            const cq = prog(lt, s2 - 0.17, 0.08, "out");
            if (cq > 0) {
              G.fillStyle = D.rgba(P.white, 0.9);
              G.fillRect(sx - fs * 0.1, base + fs * 0.06, fs * 0.55 * cq, Math.max(1, fs * 0.02));
              G.fillRect(sx + fs * 0.12, base + fs * 0.06, Math.max(1, fs * 0.02), fs * 0.62 * cq);
            }
            const typed = ph2 ? p.sub : p.sub.slice(0, Math.floor(clamp((lt - (s2 - 0.1)) / 0.1) * 2));
            G.save(); G.shadowColor = D.rgba(P.black, 0.6); G.shadowBlur = fs * 0.08 * dpr; G.shadowOffsetX = fs * 0.04 * dpr; G.shadowOffsetY = fs * 0.06 * dpr;
            D.text(G, typed, sx, sy, { font: D.THIN(ss, 300), color: P.white }); G.restore();
            if (ph2) {
              const l2 = lt - s2 - 0.07, sw = D.measure(p.sub, D.THIN(ss, 300));
              /* anillo de chispa sobre la 2ª letra + rayos */
              const rq = prog(l2, 0, 0.3, "out"), g1 = gl.list[Math.min(1, gl.list.length - 1)], rx = x0 + g1.x + g1.w / 2, ry = base - fs * 0.36;
              if (rq < 1) {
                G.save(); G.globalAlpha = 1 - rq; G.strokeStyle = P.white; G.lineWidth = fs * 0.06 * (1 - rq) + 1;
                G.shadowColor = P.white; G.shadowBlur = fs * 0.2 * dpr;
                G.beginPath(); G.arc(rx, ry, fs * (0.28 + 0.3 * rq), 0, TAU); G.stroke(); G.restore();
                D.sparks(G, rx, ry, fs * (0.4 + 0.5 * rq), fs * (0.55 + 0.8 * rq), 7, 0.4, D.rgba(P.white, 1 - rq), Math.max(1, fs * 0.025));
              }
              /* subrayado que se dibuja con punta brillante */
              const uq = prog(l2, 0.15, 0.35, "inOut");
              if (uq > 0) {
                const ax = sx - fs * 0.15, ay = sy + fs * 0.22, bx = sx + sw * 1.05, by = sy + fs * 0.12;
                const pt = q => [lerp(ax, bx, q), lerp(ay, by, q) + Math.sin(q * Math.PI) * fs * 0.12];
                G.save(); G.strokeStyle = P.white; G.lineWidth = Math.max(1, fs * 0.03); G.lineCap = "round"; G.beginPath();
                for (let q = 0; q <= uq + 1e-6; q += 0.04) { const [x, y] = pt(Math.min(q, uq)); q ? G.lineTo(x, y) : G.moveTo(x, y); }
                G.stroke();
                const [tx, ty] = pt(uq); G.fillStyle = P.white; G.shadowColor = P.white; G.shadowBlur = fs * 0.3 * dpr;
                G.beginPath(); G.arc(tx, ty, fs * 0.05, 0, TAU); G.fill(); G.restore();
              }
            }
          }
          G.restore();
          /* un cuadro oscuro (parpadeo de la referencia) y barrido con destello al re-encuadrar */
          const f = D.frameOf(lt);
          if (f === 4 + Math.floor(n * step * 30)) { G.fillStyle = D.rgba(P.black, 0.55); G.fillRect(0, 0, W, H); }
          if (has2 && lt >= s2 && lt < s2 + 0.07) {
            D.smear(ctx, W * 0.12, 0, 7, 0.22);
            const Tg = ctx.g.top; Tg.save(); Tg.fillStyle = D.rgba(P.fog, 0.55); Tg.fillRect(0, 0, W, H); Tg.restore();
          }
          if (has2 && lt >= s2 + 0.07 && lt < s2 + 0.11) {
            const Tg = ctx.g.top, r = Tg.createRadialGradient(W * 0.48, H * 0.45, 0, W * 0.48, H * 0.45, fs * 1.2);
            r.addColorStop(0, D.rgba(P.white, 0.95)); r.addColorStop(1, D.rgba(P.white, 0)); Tg.fillStyle = r; Tg.fillRect(0, 0, W, H);
          }
          T.end(G);
        },
      };
    },
  });

  /* ------------------------------------------------------------------ palabras 3D + monedas + lente */
  const SLOTS = [[0, 0, -0.1], [0.7, 0.1, -0.34], [0.1, 0.55, 0.12], [0.02, -0.52, -0.06], [-0.62, 0.25, 0.26], [0.6, -0.48, 0.18], [-0.5, -0.42, -0.22], [0.66, 0.6, -0.14]];
  K.register({
    name: "dinero.spin", tags: ["texto", "3D", "cinético", "monedas", "clímax"], layer: "main",
    summary: "Palabras 3D que GIRAN con desenfoque de movimiento sobre gris claro con viñeta mientras caen monedas doradas (ref. 3,8–8,4 s 'Dirty Cash I Want YOU'): cada palabra entra volteándose (la 1ª se tipea), la cámara gira y salta de una a otra, las anteriores quedan desenfocadas; en `lensAt` un lente OJO DE PEZ encierra el cuadro en un rectángulo redondeado que rebota y la palabra verde parpadea. Para frases de impacto y momentos de tensión con el dinero.",
    example: { words: ["Dinero", "^sucio^", "lo quiero", "^YA^"] },
    params: {
      words: { type: "array", default: [], doc: "Palabras/frases cortas en orden ('^x^' = verde billete). Vacío = las palabras narradas en el beat (≥ 3 letras, máx. 6)." },
      accent: { type: "array", default: [], doc: "Palabras narradas que van en verde (modo automático)." },
      lensAt: { type: "number", default: -2, doc: "Segundo del lente ojo de pez (-2 = cuando entra la última palabra; -1 = sin lente). Acepta '@palabra'." },
      coins: { type: "number", default: 14, min: 0, max: 40, doc: "Monedas que caen." },
      ...D.FX("leak"),
    },
    create(ctx, p) {
      const P = ctx.C.palette, { W, H, u, portrait } = ctx.stage, b0 = ctx.beat;
      let items;
      if (p.words && p.words.length) items = p.words.map(s => { const m = D.marks(s); return { s: m.map(x => x.w).join(" "), acc: m.some(x => x.acc), t: null }; });
      else {
        const acc = new Set((p.accent || []).map(K.norm));
        items = D.words(ctx, b0).filter(w => K.norm(w.text).length >= 3).slice(0, 6).map(w => ({ s: w.text.replace(/[.,;:!?…]+$/, ""), acc: acc.has(K.norm(w.text)), t: w.start - b0.t0 }));
        if (!items.length) items = [{ s: "Dinero", acc: false, t: null }];
      }
      const n = items.length, step = clamp((b0.dur * 0.75) / n, 0.35, 1.4);
      items.forEach((it, i) => { if (it.t == null) it.t = 0.05 + i * step; });
      const S = Math.min(W, H) * (portrait ? 0.62 : 0.56), fs = S * (portrait ? 0.36 : 0.44);
      items.forEach((it, i) => {
        const sl = SLOTS[i % SLOTS.length]; it.x = W / 2 + sl[0] * S * (portrait ? 0.8 : 1.15); it.y = H * 0.45 + sl[1] * S; it.r = sl[2];
        it.fs = fs * (it.acc ? 1.6 : 1) * Math.min(1, 7 / Math.max(4, it.s.length));
      });
      const lensAt = p.lensAt === -2 ? items[n - 1].t : p.lensAt;
      const rc = K.rng(9137), coins = Array.from({ length: p.coins | 0 }, () => ({ x: rc(), r: 1.8 + rc() * 4.2, v: 0.22 + rc() * 0.4, ph: rc() * 1.3, sp: 3 + rc() * 5, s0: rc() * 6, blur: rc() < 0.35, front: rc() < 0.4 }));
      /* cámara: salta hacia la palabra actual (0,3 s) y gira; respiración lenta */
      function cam(lt) {
        let i = 0; for (let k = 0; k < n; k++) if (items[k].t <= lt) i = k;
        const cur = items[i], prv = items[Math.max(0, i - 1)], q = ease.inOut(clamp((lt - cur.t) / 0.32));
        const x = lerp(prv.x, cur.x, q), y = lerp(prv.y, cur.y, q), r = lerp(prv.r, cur.r, q) + Math.sin(lt * 1.1) * 0.09;
        const z = 1.08 + Math.sin(lt * 0.8) * 0.05 + (1 - Math.abs(q * 2 - 1)) * -0.12;
        return { x, y, r, z, i };
      }
      function world(G, lt, c, alpha, mvBlur) {
        G.save(); G.translate(W / 2, H * 0.47); G.scale(c.z, c.z); G.rotate(-c.r); G.translate(-c.x, -c.y);
        items.forEach((it, i) => {
          if (lt < it.t) return;
          const age = c.i - i, q = prog(lt, it.t, 0.26, "back"), first = i === 0;
          const shown = first ? it.s.slice(0, Math.max(1, Math.ceil(clamp((lt - it.t) / 0.3) * it.s.length))) : it.s;
          G.save(); G.translate(it.x, it.y); G.rotate(it.r);
          /* giro 3D continuo sobre el eje Y (la referencia nunca deja una palabra plana) */
          const yaw = Math.sin(lt * 1.7 + i * 1.3) * 0.62;
          G.transform(Math.max(0.42, Math.cos(yaw)), Math.sin(yaw) * 0.24, 0, 1, 0, 0);
          if (!first) { G.transform(1, 0, (1 - Math.min(1, q)) * 0.7, 1, 0, 0); G.scale(1, Math.max(0.04, Math.min(1.1, q))); }
          G.globalAlpha = alpha * clamp(first ? 1 : q * 2) * clamp(2.6 - age);   /* ref: nunca más de 2–3 palabras a la vez */
          const blur = Math.max(0, age) * u * 0.28 + (age < 0 ? u * 0.6 : 0) + (mvBlur || 0);
          if (blur > 0.3) G.filter = `blur(${blur.toFixed(1)}px)`;
          let col = it.acc ? P.green : P.black;
          const lq = lt - lensAt;
          if (it.acc && i === c.i && lq > 0.2 && lq < 0.62 && (D.frameOf(lq) % 6) < 3) col = P.muted;
          D.text(G, shown, 0, it.fs * 0.35, { font: D.SANS(it.fs, 700), color: col, align: "center", sp: -it.fs * 0.01 });
          G.restore();
        });
        G.restore();
      }
      function coinsAt(G, lt, front) {
        for (const k of coins) {
          if (k.front !== front) continue;
          const r = k.r * u * (portrait ? 1.2 : 1), y = (((k.ph + lt * k.v) % 1.3) - 0.15) * H, x = k.x * W + Math.sin(lt * 1.3 + k.s0) * u;
          const spin = Math.cos(lt * k.sp + k.s0), bl = (k.blur ? u * 0.5 : 0) + (front ? u * 0.3 : 0);
          for (let s = 2; s >= 0; s--) D.coin(G, x, y - s * k.v * H * 0.03, r, spin, P, bl, s ? 0.3 : 1);
        }
      }
      function scene(G, lt) {
        D.paperBg(G, W, H, P);
        coinsAt(G, lt, false);
        const c = cam(lt), c2 = cam(lt - 0.03), mv = Math.hypot(c.x - c2.x, c.y - c2.y) * c.z + Math.abs(c.r - c2.r) * S;
        /* desenfoque de movimiento fuerte como la referencia: estela de 5 tomas + blur según velocidad */
        const mb = Math.min(u * 1.6, mv * 0.12);
        if (mv > u * 0.6) for (let s = 5; s >= 1; s--) world(G, lt, cam(lt - s * 0.016), 0.22, mb);
        world(G, lt, c, mv > u * 0.6 ? 0.65 : 1, mb * 0.5);
        coinsAt(G, lt, true);
        D.vignette(G, W, H, 0.5, P.black, 0.4);
      }
      return {
        render(lt, b) {
          if (!D.keep(ctx, b, lt)) return;
          const G = ctx.g.main, T = D.enter(ctx, p.fx, lt, b), lq = lensAt >= 0 ? (lt - lensAt) / 0.85 : -1;
          T.begin(G);
          if (lq > 0 && lq < 1) {
            const [sc, sg] = D.scratch(ctx, 0); scene(sg, lt);
            D.solid(G, W, H, P.black);
            const sz = lq < 0.12 ? lerp(1, 0.8, ease.out(lq / 0.12)) : lq < 0.75 ? 0.8 + Math.sin((lq - 0.12) / 0.63 * Math.PI * 2.5) * 0.06 * (1 - (lq - 0.12) / 0.63) : lerp(0.8, 1.04, ease.inOut((lq - 0.75) / 0.25));
            const k = 0.42 * (1 - prog(lq, 0.7, 0.3, "inOut")), bw = W * sz, bh = H * (portrait ? sz * 0.75 + 0.2 : sz);
            D.fisheye(ctx, G, sc, k, { x: (W - bw) / 2, y: (H - bh) / 2, w: bw, h: bh }, Math.min(bw, bh) * 0.24 * (1 - prog(lq, 0.8, 0.2)));
          } else scene(G, lt);
          T.end(G);
        },
      };
    },
  });
})();
