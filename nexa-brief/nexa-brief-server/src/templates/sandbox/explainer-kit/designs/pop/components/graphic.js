/* =============================================================================
   pop · gráficos: libro 3D isométrico, mosaico de marcas, nombre/dominio, glitch suelto
   ========================================================================== */
(function () {
  const K = Kit, P0 = Kit.pop, { clamp, lerp, prog, ease } = K;
  const TAU = Math.PI * 2;
  const SCR = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

  /* ------------------------------------------------------------------ libro 3D */
  K.register({
    name: "pop.book", tags: ["objeto", "documento", "foto", "libro", "historia"], layer: "main",
    summary: "Libro 3D isométrico sobre menta apagada (ref. 57,4 s): tapa violeta con la foto en duotono que se desplaza y el título en renglones menta, lomo violeta, cantos rosa, sombra rosada difusa; deriva y se achica lento; en `swapAt` la tapa cambia a la marca del canal.",
    example: { src: "assets/media/nota.jpg", title: "LA NOTA\nDE SCHA-\nBOWSKI", note: "9 NOV 1989 · 18:53" },
    params: {
      src: { type: "image", required: true, doc: "Foto de la tapa." },
      title: { type: "string", default: "", doc: "Título de la tapa (\\n = renglones, 2–5 cortos)." },
      note: { type: "string", default: "", doc: "Texto mínimo de la tapa." },
      swapAt: { type: "number", default: -1, doc: "Segundos hasta que la tapa cambia a la marca (<0 = nunca)." },
      mark: { type: "string", default: "", doc: "Monograma para la tapa final (vacío = gota del canal)." },
      ...P0.FX("cut"),
    },
    create(ctx, p) {
      const P = ctx.C.palette, cv = P0.duo(ctx, p.src, "dark");
      const cw = 600, ch = 820, cover = P0.offscreen(cw, ch), cg = cover.getContext("2d");
      const lines = String(p.title).toUpperCase().split("\n").filter(Boolean);
      const coverCol = P0.mix(P.ink, P.mid, 0.55);
      return {
        render(lt, b) {
          const { W, H, portrait } = ctx.stage, G = ctx.g.main, S = Math.min(W, H);
          G.fillStyle = P.book || P.bg; G.fillRect(0, 0, W, H);
          /* tapa (textura 2D que después se proyecta) */
          const swapped = p.swapAt >= 0 && lt >= p.swapAt;
          cg.fillStyle = coverCol; cg.fillRect(0, 0, cw, ch);
          if (!swapped) {
            const sh = -lt * ch * 0.035;
            cg.save(); cg.beginPath(); cg.rect(cw * 0.3, ch * 0.07, cw * 0.66, ch * 0.5); cg.clip(); P0.cover(cg, cv, cw * 0.3, ch * 0.07 + sh, cw * 0.66, ch * 0.62); cg.restore();
            const fs = ch * 0.072;
            lines.forEach((ln, i) => {
              const a = clamp((lt - 0.1 - i * 0.12) / 0.2);
              P0.text(cg, ln, cw * 0.08, ch * 0.24 + i * fs * 1.15 + sh * 0.6, { font: P0.font(fs, 800), color: P.light, alpha: a, sp: -fs * 0.02 });
            });
            cg.fillStyle = P.light; cg.fillRect(cw * 0.1, ch * 0.24 + lines.length * fs * 1.15 + ch * 0.03 + sh * 0.6, cw * 0.28, 3);
            if (p.note) P0.text(cg, p.note, cw * 0.55, ch * 0.62, { font: P0.font(ch * 0.02, 700), color: P.light, sp: 1 });
          } else P0.mark(cg, cw * 0.5, ch * 0.5, cw * 0.09, P.light, p.mark);
          /* geometría (medida sobre el cuadro 58,3 s de la referencia, en unidades de S) */
          const k = S * (portrait ? 0.95 : 1) * (1.04 - Math.min(0.12, lt * 0.03));
          const U = [0.375 * k, -0.139 * k], V = [0.486 * k, 0.257 * k], D = [-0.014 * k, 0.085 * k];
          const C = [W * 0.5 + (lt - 1.2) * S * 0.025, H * (portrait ? 0.46 : 0.44) + lt * S * 0.006];
          const L = [C[0] - U[0] / 2 - V[0] / 2, C[1] - U[1] / 2 - V[1] / 2], T = [L[0] + U[0], L[1] + U[1]], B = [L[0] + V[0], L[1] + V[1]], R = [B[0] + U[0], B[1] + U[1]];
          const add = (a, d) => [a[0] + d[0], a[1] + d[1]];
          /* sombra rosada difusa */
          G.save(); G.filter = `blur(${(S * 0.03).toFixed(1)}px)`; G.fillStyle = P0.rgba(P.accent, 0.45);
          P0.poly(G, [add(L, [0, S * 0.07]), add(T, [S * 0.02, S * 0.08]), add(R, [S * 0.02, S * 0.1]), add(B, [0, S * 0.1])]); G.fill(); G.restore();
          /* lomo y cantos */
          G.fillStyle = P0.mix(P.ink, P.mid, 0.35); P0.poly(G, [L, B, add(B, D), add(L, D)]); G.fill();
          G.fillStyle = P.accent; P0.poly(G, [B, R, add(R, D), add(B, D)]); G.fill();
          G.save(); G.strokeStyle = P0.rgba(P.ink, 0.25); G.lineWidth = 1;
          for (let i = 1; i < 5; i++) { const q = i / 5; G.beginPath(); G.moveTo(B[0] + D[0] * q, B[1] + D[1] * q); G.lineTo(R[0] + D[0] * q, R[1] + D[1] * q); G.stroke(); }
          G.restore();
          /* tapa proyectada */
          G.save(); G.transform(U[0] / cw, U[1] / cw, V[0] / ch, V[1] / ch, L[0], L[1]); G.drawImage(cover, 0, 0); G.restore();
          G.save(); G.strokeStyle = P.light; G.lineWidth = Math.max(1.5, S * 0.004); G.beginPath(); G.moveTo(...T); G.lineTo(...L); G.lineTo(...B); G.lineTo(...R); G.stroke(); G.restore();
          P0.enter(ctx, p.fx, lt, b.i);
        },
      };
    },
  });

  /* ------------------------------------------------------------------ mosaico de marcas */
  K.register({
    name: "pop.tiles", tags: ["marca", "transición", "patrón"], layer: "main",
    summary: "Marca menta grande sobre violeta (ref. 60,16) que corta a un MOSAICO de cuadrados violeta con la marca, filas desfasadas que se deslizan y parpadean de brillo (ref. 60,6).",
    example: { mark: "" },
    params: {
      mark: { type: "string", default: "", doc: "Monograma (vacío = gota del canal)." },
      solo: { type: "number", default: 0.25, doc: "Segundos de la marca sola sobre violeta antes del mosaico." },
      ...P0.FX("cut"),
    },
    create(ctx, p) {
      ctx.beat.hideCaptions = ctx.beat.hideCaptions ?? true;
      const P = ctx.C.palette;
      return {
        render(lt, b) {
          const { W, H } = ctx.stage, G = ctx.g.main, S = Math.min(W, H), f = P0.frameOf(lt);
          if (lt < p.solo) {
            G.fillStyle = P.ink; G.fillRect(0, 0, W, H);
            G.save(); if (f < 2) { G.beginPath(); G.rect(0, 0, W, H / 2 + S * 0.02); G.clip(); }
            P0.mark(G, W / 2, H / 2, S * 0.08, P.light, p.mark); G.restore();
          } else {
            const k = lt - p.solo, kf = P0.frameOf(k), cell = S * 0.19, ts = S * 0.15;
            G.fillStyle = P.bg; G.fillRect(0, 0, W, H);
            const dim = kf >= 4 && kf < 8 ? 0.3 : kf < 2 ? 0.55 : 1;
            for (let r = -1, y = H / 2 - cell * 3; y < H + cell; r++, y += cell * 0.98) {
              const off = (r % 2 ? cell / 2 : 0) + k * S * 0.05 * (r % 2 ? 1 : -1);
              for (let x = -cell * 2 + (off % cell); x < W + cell; x += cell) {
                G.fillStyle = P.ink; G.fillRect(x, y, ts, ts * 0.86);
                G.save(); G.globalAlpha = dim; P0.mark(G, x + ts / 2, y + ts * 0.43, ts * 0.28, P.light, p.mark); G.restore();
              }
            }
          }
          P0.enter(ctx, p.fx, lt, b.i);
        },
      };
    },
  });

  /* ------------------------------------------------------------------ nombre / dominio */
  K.register({
    name: "pop.name", tags: ["marca", "texto", "dato", "cierre"], layer: "main",
    summary: "Texto chico centrado sobre menta (ref. 61,2 'ENVATO.COM' → nombre del canal/lugar): aparece, pasa por 3 cuadros de itálica con letras que se decodifican, se achica al final y se apaga parpadeando a gris.",
    example: { text: "BERLÍN · 9.11.1989", sub: "" },
    params: {
      text: { type: "string", required: true, doc: "Texto (1 renglón corto)." },
      sub: { type: "string", default: "", doc: "Línea mínima debajo." },
      size: { type: "number", default: 0.045, min: 0.02, max: 0.12, doc: "Alto de letra (fracción del lado corto)." },
      ...P0.FX("cut"),
    },
    create(ctx, p) {
      const P = ctx.C.palette;
      return {
        render(lt, b) {
          const { W, H } = ctx.stage, G = ctx.g.main, S = Math.min(W, H), f = P0.frameOf(lt);
          const end = b.dur - lt, fs = Math.min(S * p.size, W * 0.86 / Math.max(4, P0.measure(p.text, P0.font(100, 800)) / 100));
          G.fillStyle = P.bg; G.fillRect(0, 0, W, H);
          if (f >= 1) {
            const it = f >= 10 && f < 14, sc = (1.15 - 0.15 * prog(lt, 0.03, 0.2, "out")) * (end < 0.5 ? 0.78 : 1);
            const r = K.rng(f * 5 + 1), s = it && f < 12 ? [...p.text].map(c => (c === " " || r() < 0.6 ? c : SCR[Math.floor(r() * SCR.length)])).join("") : p.text;
            G.save(); G.translate(W / 2, H / 2); G.scale(sc, sc); if (it) G.transform(1, 0, -0.22, 1, 0, 0);
            P0.text(G, s, 0, fs * 0.36, { font: P0.font(fs, 800), color: P.ink, align: "center", sp: fs * 0.02 });
            if (p.sub) P0.text(G, p.sub, 0, fs * 1.6, { font: P0.font(fs * 0.36, 700), color: P0.rgba(P.ink, 0.75), align: "center", sp: fs * 0.08 });
            G.restore();
          }
          if (end < 0.3) {
            const k = P0.frameOf(0.3 - end);
            G.save(); G.globalAlpha = k % 3 === 1 ? 0.55 : 0.25 + 0.5 * (1 - end / 0.3); G.fillStyle = k % 3 === 1 ? "#3f6b5f" : P.paper; G.fillRect(0, 0, W, H); G.restore();
          }
          P0.enter(ctx, p.fx, lt, b.i);
        },
      };
    },
  });

  /* ------------------------------------------------------------------ glitch suelto (capa overlay) */
  K.register({
    name: "pop.glitch", tags: ["transición", "glitch", "golpe"], layer: "overlay", post: 0,
    summary: "Glitch de transición encima de cualquier plano (capa overlay): bloques desplazados sobre negro, parpadeo de paleta o esquirlas (ref. 49,25 · 54,65). Usar con 'dur' corto (0,15–0,35 s).",
    example: { kind: "glitch" },
    params: {
      kind: { type: "enum", options: ["glitch", "flicker", "shards", "liquid"], default: "glitch", doc: "Tipo (ver fx)." },
    },
    create(ctx, p) { return { render(lt, b) { P0.enter(ctx, p.kind, lt, b.i + 3); } }; },
  });
})();
