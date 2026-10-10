/* =============================================================================
   pop · planos tipográficos: palabra sobre foto, rayada con parpadeo, renglones apilados,
   letras gigantes con foto/op-art, banda "2 COLOURS", flecha con rótulo que se decodifica,
   texto mínimo espaciado
   ========================================================================== */
(function () {
  const K = Kit, P0 = Kit.pop, { clamp, lerp, prog, ease } = K;
  const TAU = Math.PI * 2;
  const offscreen = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
  /** canvas del tamaño del escenario (en px CSS × dpr) para máscaras de texto */
  const stageCanvas = ctx => { const { W, H } = ctx.stage, c = offscreen(W * ctx.dpr, H * ctx.dpr); const g = c.getContext("2d"); g.setTransform(ctx.dpr, 0, 0, ctx.dpr, 0, 0); return [c, g]; };
  const SCR = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

  /* ------------------------------------------------------------------ palabra sobre foto */
  K.register({
    name: "pop.word", tags: ["texto", "foto", "impacto"], layer: "main",
    summary: "Palabra GIGANTE menta sobre foto a sangre en duotono oscuro con zoom lento (ref. 47,55 'BLACK'): entra creciendo 0,75→1 y deslizando a la izquierda en 5 cuadros; repetición chica glitcheada abajo a la derecha y '=' abajo a la izquierda.",
    example: { text: "28 AÑOS", src: "assets/media/mauerbau.jpg" },
    params: {
      text: { type: "string", required: true, doc: "Palabra o frase corta (1 renglón)." },
      small: { type: "string", default: "", doc: "Repetición chica abajo a la derecha (vacío = el mismo texto)." },
      src: { type: "image", required: true, doc: "Foto de fondo." },
      tone: { type: "enum", options: ["dark", "normal", "light", "inv"], default: "dark", doc: "Duotono: dark = domina el violeta (como la referencia)." },
      ...P0.FOCUS, ...P0.FX("cut"),
    },
    create(ctx, p) {
      const P = ctx.C.palette, cv = P0.duo(ctx, p.src, p.tone), small = p.small || p.text;
      return {
        render(lt, b) {
          const { W, H, portrait } = ctx.stage, G = ctx.g.main, fo = p.focus || [0.5, 0.5];
          P0.cover(G, cv, 0, 0, W, H, { zoom: 1.04 + lt * 0.012, fx: fo[0], fy: fo[1] });
          const size = P0.fit(p.text, W * (portrait ? 0.88 : Math.min(0.86, 0.11 * p.text.length + 0.0)), H * (portrait ? 0.15 : 0.28), 800, "expanded", -0.02);
          const q = prog(lt, 0.03, 0.18, "expoOut");
          if (lt >= 0.03) {
            const sc = 0.75 + 0.25 * q, x = lerp(W * 0.2, W * (portrait ? 0.06 : 0.075), q), y = H * (portrait ? 0.48 : 0.52);
            G.save(); G.translate(x, y); G.scale(sc, sc);
            P0.text(G, p.text, 0, 0, { font: P0.font(size, 800), color: P.light, sp: -size * 0.02 }); G.restore();
          }
          /* repetición chica con letras que saltan (glitch) */
          const f = P0.frameOf(lt), ss = Math.min(H, W) * 0.042, gl = P0.glyphs(small, P0.font(ss, 800), -ss * 0.03);
          const sx = W * (portrait ? 0.94 : 0.77) - gl.width;
          gl.list.forEach((g, i) => {
            if (f < 9 && P0.missing(i, f, 3, 0.35)) return;
            const j = f < 9 ? (K.rng(f * 13 + i)() - 0.5) * ss * 0.4 : 0;
            P0.text(G, g.c, sx + g.x + j, H * 0.8, { font: P0.font(ss, 800), color: P.light });
          });
          const u = Math.min(W, H);
          G.save(); G.fillStyle = P.light; G.fillRect(W * 0.085, H * 0.765, u * 0.03, u * 0.006); G.fillRect(W * 0.085, H * 0.785, u * 0.03, u * 0.006); G.restore();
          P0.enter(ctx, p.fx, lt, b.i);
        },
      };
    },
  });

  /* ------------------------------------------------------------------ palabra rayada + parpadeo */
  K.register({
    name: "pop.hatch", tags: ["texto", "foto", "glitch", "impacto"], layer: "main",
    summary: "Palabra gigante menta sobre foto violeta (ref. 49,35 'FOREVER'): entra con glitch de bloques y 6 cuadros de parpadeo de paleta con letras que faltan; algunas letras quedan RAYADAS en diagonal, '★★★' y tiras glitch de la palabra estiradas arriba.",
    example: { text: "1961", src: "assets/media/mauerbau.jpg", hatch: [1, 3] },
    params: {
      text: { type: "string", required: true, doc: "Palabra (1 renglón, ideal 4–9 letras)." },
      src: { type: "image", required: true, doc: "Foto de fondo." },
      hatch: { type: "array", default: [], doc: "Índices de letras rayadas (vacío = automático: 2ª y antepenúltima)." },
      stars: { type: "bool", default: true, doc: "Dibuja '★★★' sobre la penúltima letra." },
      ...P0.FOCUS, ...P0.FX("flicker"),
    },
    create(ctx, p) {
      const P = ctx.C.palette, cv = P0.duo(ctx, p.src, "dark");
      const n = [...p.text].length, hset = new Set(p.hatch.length ? p.hatch : [1, Math.max(2, n - 3)]);
      const { W, H, portrait } = ctx.stage;
      const size = P0.fit(p.text, W * (portrait ? 0.9 : 0.86), H * (portrait ? 0.16 : 0.27), 900, "expanded", -0.03), fnt = P0.font(size, 900);
      const gl = P0.glyphs(p.text, fnt, -size * 0.03), x0 = (W - gl.width) / 2, base = H * 0.56;
      /* máscara: cada letra en su propio lienzo para poder rayarla o borrarla en el glitch */
      const [tc, tg] = stageCanvas(ctx);
      gl.list.forEach((g, i) => {
        tg.save(); tg.font = fnt; tg.fillStyle = P.light; tg.fillText(g.c, x0 + g.x, base);
        if (hset.has(i)) { tg.globalCompositeOperation = "destination-out"; P0.hatch(tg, x0 + g.x, base - size, g.w, size * 1.1, { gap: size * 0.09, bw: size * 0.045, ang: -50, color: "#000" }); }
        tg.restore();
      });
      return {
        render(lt, b) {
          const G = ctx.g.main, f = P0.frameOf(lt), fo = p.focus || [0.5, 0.5];
          P0.cover(G, cv, 0, 0, W, H, { zoom: 1.08 + lt * 0.015, fx: fo[0], fy: fo[1], blur: Math.min(W, H) * 0.004 });
          if (f < 10) {
            /* letras que faltan durante el parpadeo */
            gl.list.forEach((g, i) => { if (!P0.missing(i, f, 5, 0.3)) G.drawImage(tc, (x0 + g.x - 2) * ctx.dpr, 0, (g.w + 4) * ctx.dpr, H * ctx.dpr, x0 + g.x - 2, 0, g.w + 4, H); });
          } else G.drawImage(tc, 0, 0, W, H);
          if (p.stars && n > 2) {
            const g = gl.list[n - 2], sy = base - size * 0.45;
            G.save(); G.fillStyle = P.ink; G.font = P0.font(size * 0.2, 900, "normal"); G.textAlign = "center";
            G.fillText("★★★", x0 + g.x + g.w * 0.5, sy); G.restore();
          }
          /* tiras glitch arriba: rebanadas de la palabra estiradas en x */
          if (lt > 0.37) {
            const k = P0.frameOf(lt - 0.37), r = K.rng(91 + (k >> 1));
            G.save(); G.fillStyle = P.light;
            G.fillRect(0, H * 0.06, W * (0.25 + r() * 0.2), H * 0.012); G.fillRect(W * 0.05, H * 0.085, W * (0.1 + r() * 0.15), H * 0.02);
            const sy = base - size * 0.6, sh = size * 0.18;
            G.drawImage(tc, x0 * ctx.dpr, sy * ctx.dpr, gl.width * 0.45 * ctx.dpr, sh * ctx.dpr, W * (0.25 + r() * 0.2), H * 0.05, gl.width * 0.75, sh * 0.9);
            G.restore();
          }
          P0.enter(ctx, p.fx, lt, b.i);
        },
      };
    },
  });

  /* ------------------------------------------------------------------ renglones apilados */
  /** renglones del modo automático: palabras de la narración agrupadas (≤ max caracteres, ≤ 4 por página) */
  function autoLines(ctx, b, max) {
    const ws = P0.words(ctx, b), lines = [];
    for (const w of ws) {
      const t = w.text.replace(/[.,;:¿?¡!"«»]+/g, "").toUpperCase(); if (!t) continue;
      const cur = lines[lines.length - 1];
      if (cur && cur.text.length + t.length + 1 <= max) cur.text += " " + t; else lines.push({ text: t, t: w.start });
    }
    return lines;
  }
  K.register({
    name: "pop.stack", tags: ["texto", "foto", "título", "letra", "clímax"], layer: "main",
    summary: "Renglones apilados menta en grotesca extendida sobre foto (ref. 50,98 'NEW WAY TO PROMOTE'): entra con cortina líquida violeta, cada renglón aparece aplastado y se asienta (uno cada 2 cuadros, o cuando la voz dice la palabra si text está vacío), cruz violeta + flecha-pentágono menta que crecen; en `phase2` re-encuadre más grande con eco en contorno, tira glitch, círculo con cruz y chevrones rosas (ref. 51,45).",
    example: { text: "LA NOCHE\nQUE CAYÓ\nEL MURO", src: "assets/media/muro-gente.jpg" },
    params: {
      text: { type: "string", default: "", doc: "Renglones con '\\n'. Vacío = modo LETRA: las palabras narradas en el beat aparecen al decirse (páginas de 4 renglones)." },
      src: { type: "image", required: true, doc: "Foto de fondo." },
      tone: { type: "enum", options: ["dark", "normal", "light", "inv"], default: "dark", doc: "Duotono de la foto (dark = domina el violeta: el texto menta se lee)." },
      shapes: { type: "bool", default: true, doc: "Cruz violeta + flecha-pentágono menta a la derecha." },
      phase2: { type: "number", default: -1, doc: "Segundos hasta el re-encuadre grande (<0 = nunca)." },
      ...P0.FOCUS, ...P0.FX("liquid"),
    },
    create(ctx, p) {
      const P = ctx.C.palette, cv = P0.duo(ctx, p.src, p.tone), cvD = P0.duo(ctx, p.src, "dark");
      const auto = !p.text.trim();
      if (auto) ctx.beat.hideCaptions = ctx.beat.hideCaptions ?? true;
      const { portrait } = ctx.stage;
      const lines = auto ? autoLines(ctx, ctx.beat, portrait ? 9 : 11) : p.text.split("\n").map((s, i) => ({ text: s.toUpperCase(), t: null, i }));
      const pages = []; for (let i = 0; i < lines.length; i += 4) pages.push(lines.slice(i, i + 4));
      const shapes = (G, W, H, S, lt, sc0, ox) => {
        const q = prog(lt, 0.12, 0.22, "expoOut"), s = (0.15 + 0.85 * q) * sc0, ax = W * 0.875 + ox, ay = H * 0.88;
        G.save(); G.translate(ax, ay); G.scale(s, s); G.translate(-ax, -ay);
        const vb = S * 0.12, hb = S * 0.15;
        G.fillStyle = P.ink;
        G.fillRect(ax - vb / 2, H * 0.52, vb, H);                         /* barra vertical */
        P0.poly(G, [[W * 0.62 + ox + hb * 0.5, ay - hb / 2], [W * 1.05, ay - hb / 2], [W * 1.05, ay + hb / 2], [W * 0.62 + ox + hb * 0.5, ay + hb / 2], [W * 0.62 + ox, ay]]); G.fill();
        G.fillStyle = P.light;                                            /* flecha-pentágono menta arriba */
        P0.poly(G, [[ax - vb / 2, H * 0.52], [ax, H * 0.52 - vb * 0.55], [ax + vb / 2, H * 0.52], [ax + vb / 2, H * 0.6], [ax - vb / 2, H * 0.6]]); G.fill();
        G.restore();
      };
      return {
        render(lt, b, t) {
          const { W, H } = ctx.stage, G = ctx.g.main, S = Math.min(W, H), fo = p.focus || [0.5, 0.5];
          const ph2 = p.phase2 >= 0 && lt >= p.phase2;
          P0.cover(G, ph2 ? cvD : cv, 0, 0, W, H, { zoom: (ph2 ? 1.18 : 1.06) + lt * 0.01, fx: fo[0], fy: fo[1] });
          /* página visible (modo letra: la del último renglón dicho) */
          let page = pages[0] || [];
          if (auto) { for (const pg of pages) if (t >= pg[0].t - 0.1) page = pg; }
          const longest = Math.max(1, ...page.map(l => l.text.length));
          const maxW = W * (portrait ? 0.86 : ph2 ? 0.62 : 0.5);
          let size = Math.min(P0.fit("M".repeat(Math.max(4, longest)), maxW, S * (ph2 ? 0.15 : 0.13), 900, "expanded", -0.04) * 1.05, H * 0.62 / Math.max(1, page.length) / 0.95);
          const lead = size * 0.93, x0 = W * (ph2 ? 0.025 : portrait ? 0.07 : 0.07);
          const y0 = (portrait ? H * 0.16 : H * (ph2 ? 0.1 : 0.17)) + size * 0.72;
          if (p.shapes) shapes(G, W, H, S, lt, ph2 ? 1.05 : 1, ph2 ? -W * 0.18 : 0);
          page.forEach((l, i) => {
            const ta = auto ? l.t - b.t0 - 0.05 : 0.03 + i * 0.07, k = lt - ta;
            if (k < 0) return;
            const sq = k < 0.066 ? 0.3 : 1, y = y0 + i * lead;
            G.save(); G.translate(x0, y); G.scale(sq < 1 ? 1.25 : 1, sq);
            P0.text(G, l.text, 0, 0, { font: P0.font(size, 900), color: P.light, sp: -size * 0.04, alpha: sq < 1 ? 0.6 : 1 });
            G.restore();
            if (ph2 && i === page.length - 1) P0.text(G, l.text, x0, y + size * 0.55, { font: P0.font(size, 900), stroke: P0.rgba(P.light, 0.45), lw: Math.max(1, size * 0.012), sp: -size * 0.04 });
          });
          if (ph2) {
            const k2 = lt - p.phase2, r = K.rng(5 + P0.frameOf(k2));
            /* tira glitch de píxeles: un rectángulo de la foto desplazado */
            const gx = W * 0.6, gy = H * 0.28, gw = W * 0.09, gh = H * 0.3;
            G.save(); G.beginPath(); G.rect(gx, gy, gw, gh); G.clip(); P0.cover(G, cv, gx - W * 0.1 * r(), gy - H * 0.05, W * 0.4, H * 0.5); G.restore();
            G.save(); G.strokeStyle = P0.rgba(P.light, 0.8); G.lineWidth = Math.max(1, S * 0.002); G.strokeRect(gx - W * 0.03, gy + gh * 0.2, gw + W * 0.06, gh * 0.25); G.restore();
            /* círculo con cruz + chevrones rosas */
            const cr = S * 0.075, ccx = W * 0.08, ccy = H * 0.84;
            G.save(); G.strokeStyle = P0.rgba(P.ink, 0.75); G.lineWidth = S * 0.018; G.beginPath(); G.arc(ccx, ccy, cr, 0, TAU); G.stroke();
            G.lineWidth = S * 0.014; G.beginPath(); G.moveTo(ccx - cr * 0.6, ccy - cr * 0.6); G.lineTo(ccx + cr * 0.6, ccy + cr * 0.6); G.moveTo(ccx + cr * 0.6, ccy - cr * 0.6); G.lineTo(ccx - cr * 0.6, ccy + cr * 0.6); G.stroke(); G.restore();
            const ay = H * 0.86, ah = S * 0.07;
            G.save(); G.fillStyle = P0.rgba(P.accent, 0.85);
            P0.poly(G, [[W * 0.26, ay], [W * 0.26 + ah, ay - ah / 2], [W * 0.6 - ah, ay - ah / 2], [W * 0.6, ay], [W * 0.6 - ah, ay + ah / 2], [W * 0.26 + ah, ay + ah / 2]]); G.fill(); G.restore();
          } else if (p.phase2 >= 0 && P0.frameOf(lt) === P0.frameOf(p.phase2) - 1) {
            /* último cuadro antes del re-encuadre: flash de paleta rosa */
            G.save(); G.globalCompositeOperation = "color"; G.fillStyle = P.accent; G.fillRect(0, 0, W, H); G.restore();
          }
          P0.enter(ctx, p.fx, lt, b.i);
        },
      };
    },
  });

  /* ------------------------------------------------------------------ letras gigantes */
  /** patrón op-art (bandas onduladas violeta / rosa / menta) a baja resolución, función de t */
  function opart(c, t, L) {
    const g = c.getContext("2d"), w = c.width, h = c.height, d = g.createImageData(w, h), a = d.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = x / w, v = y / h;
      const r1 = Math.hypot(u - 0.3, v - 0.35) * 30, r2 = Math.hypot(u - 0.8, v - 0.75) * 26;
      const s = Math.sin(r1 + 2.2 * Math.sin(v * 6 + t * 0.9) + 1.6 * Math.cos(u * 5 - t * 0.7)) + Math.sin(r2 - t * 1.4);
      const k = Math.round(clamp(0.5 + s * 0.45) * 255) * 3, i = (y * w + x) * 4;
      a[i] = L[k]; a[i + 1] = L[k + 1]; a[i + 2] = L[k + 2]; a[i + 3] = 255;
    }
    g.putImageData(d, 0, 0);
  }
  K.register({
    name: "pop.letters", tags: ["texto", "foto", "op-art", "cifra"], layer: "main",
    summary: "2–3 letras/cifras GIGANTES (ref. 53,05 'OE'): la 1ª rellena con la foto en duotono, la 2ª con ondas op-art que se deforman, bordes suaves y deriva lenta; etiqueta paralelogramo violeta que entra con borde dentado (sierra) con texto menta; marca chica abajo-izq. y línea punteada arriba-izq.",
    example: { text: "89", src: "assets/media/muro-gente.jpg", tag: "LA NOCHE QUE\nCAMBIÓ TODO" },
    params: {
      text: { type: "string", required: true, doc: "2–3 caracteres (letras o cifras)." },
      src: { type: "image", required: true, doc: "Foto que rellena la 1ª letra." },
      tag: { type: "string", default: "", doc: "Texto de la etiqueta violeta (\\n = 2 renglones; vacío = sin etiqueta)." },
      ...P0.FOCUS, ...P0.FX("cut"),
    },
    create(ctx, p) {
      const P = ctx.C.palette, cv = P0.duo(ctx, p.src, "normal");
      const L = P0.lut([[0, P.ink], [0.4, P.mid], [0.55, P.accent], [0.7, P.light], [1, P.light]]);
      const op = offscreen(240, 150);
      const { W, H, portrait } = ctx.stage, S = Math.min(W, H);
      const size = P0.fit(p.text, W * (portrait ? 0.8 : 0.7), H * (portrait ? 0.42 : 0.86), 900, "expanded", -0.08), fnt = P0.font(size, 900);
      const gl = P0.glyphs(p.text, fnt, -size * 0.08), x0 = (W - gl.width) / 2, base = H * (portrait ? 0.56 : 0.5) + size * 0.36;
      const [mc, mg] = stageCanvas(ctx);
      return {
        render(lt, b) {
          const G = ctx.g.main, dx = lt * S * 0.03, fo = p.focus || [0.5, 0.5];
          opart(op, lt * 2.2, L);
          gl.list.forEach((g, i) => {
            mg.save(); mg.setTransform(ctx.dpr, 0, 0, ctx.dpr, 0, 0); mg.clearRect(0, 0, W, H);
            mg.filter = `blur(${(S * 0.0025).toFixed(1)}px)`; mg.font = fnt; mg.fillStyle = "#000"; mg.fillText(g.c, x0 + g.x + dx, base); mg.filter = "none";
            mg.globalCompositeOperation = "source-in";
            if (i % 2 === 0) P0.cover(mg, cv, x0 + g.x + dx, base - size, g.w, size * 1.05, { zoom: 1.05, fx: fo[0], fy: fo[1] });
            else mg.drawImage(op, x0 + g.x + dx - size * 0.1, base - size * 0.95, g.w + size * 0.2, size);
            /* disolución de un borde de la letra (como el 'O' de la referencia) */
            mg.globalCompositeOperation = "destination-out";
            const gr = mg.createLinearGradient(x0 + g.x + dx + g.w * 0.55, 0, x0 + g.x + dx + g.w * 1.05, 0);
            gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, `rgba(0,0,0,${i % 2 ? 0.15 : 0.55})`);
            mg.fillStyle = gr; mg.fillRect(0, 0, W, H);
            mg.restore();
            G.drawImage(mc, 0, 0, W, H);
          });
          /* etiqueta paralelogramo con entrada dentada */
          if (p.tag) {
            const X = W * (portrait ? 0.2 : 0.565), Y = portrait ? base + S * 0.08 : H * 0.667, w = portrait ? W * 0.72 : W * 0.37, h = S * 0.19;
            const pts = [[X + w * 0.08, Y], [X + w, Y + h * 0.3], [X + w * 0.77, Y + h], [X, Y + h * 0.6]];
            const q = prog(lt, 0.03, 0.4, "out"), wx = X + w * 1.1 * q, tooth = S * 0.025;
            G.save(); G.beginPath(); G.moveTo(X - 10, Y - 10);
            for (let yy = Y - 10, k = 0; yy < Y + h + 10; yy += tooth * 0.6, k++) G.lineTo(wx + (k % 2 ? tooth : -tooth) * (q < 1 ? 1 : 0), yy);
            G.lineTo(X - 10, Y + h + 10); G.closePath(); G.clip();
            G.fillStyle = P.ink; P0.poly(G, pts); G.fill();
            String(p.tag).split("\n").forEach((ln, i) => P0.text(G, ln.toUpperCase(), X + w * 0.12, Y + h * 0.42 + i * S * 0.034, { font: P0.font(S * 0.026, 700), color: P.light, sp: S * 0.003 }));
            G.restore();
          }
          P0.mark(G, W * 0.065, H * 0.9, S * 0.022, P.ink);
          G.save(); for (let i = 0; i < 18; i++) { G.fillStyle = i % 4 === 1 ? P.accent : P.ink; G.fillRect(W * 0.038, H * 0.08 + i * S * 0.012, S * 0.003, S * 0.007); } G.restore();
          P0.enter(ctx, p.fx, lt, b.i);
        },
      };
    },
  });

  /* ------------------------------------------------------------------ banda "2 COLOURS" */
  K.register({
    name: "pop.band", tags: ["texto", "foto", "transición", "cifra"], layer: "main",
    summary: "Texto grande que pasa de negro a foto (ref. 53,59 '2 COLOURS'): cuadro negro con el texto menta → cae una banda de rayas diagonales → la foto se abre como banda hacia abajo (doble exposición desplazada con costura negra) mientras el texto parpadea rosa/menta y las rayas se afinan.",
    example: { text: "140 VIDAS", src: "assets/media/mauerbau.jpg" },
    params: {
      text: { type: "string", required: true, doc: "Texto (1 renglón)." },
      src: { type: "image", required: true, doc: "Foto de la banda." },
      ...P0.FOCUS, ...P0.FX("cut"),
    },
    create(ctx, p) {
      const P = ctx.C.palette, cv = P0.duo(ctx, p.src, "normal");
      return {
        render(lt, b) {
          const { W, H, portrait } = ctx.stage, G = ctx.g.main, S = Math.min(W, H), f = P0.frameOf(lt), fo = p.focus || [0.5, 0.5];
          G.fillStyle = "#000"; G.fillRect(0, 0, W, H);
          const yb = f < 1 ? 0 : H * (0.27 + 0.71 * prog(lt, 0.07, 0.22, "out"));
          if (f >= 3) {
            const top = Math.min(yb, H * 0.49);
            G.save(); G.beginPath(); G.rect(0, 0, W, top); G.clip(); P0.cover(G, cv, 0, -H * 0.12, W, H * 1.2, { zoom: 1.1 + lt * 0.01, fx: fo[0], fy: fo[1] }); G.restore();
            if (yb > H * 0.49) { G.save(); G.beginPath(); G.rect(0, H * 0.495, W, yb - H * 0.495); G.clip(); P0.cover(G, cv, 0, H * 0.25, W, H * 1.2, { zoom: 1.1 + lt * 0.01, fx: fo[0], fy: fo[1] }); G.restore(); }
            G.fillStyle = "#000"; G.fillRect(0, H * 0.488, W, Math.max(2, S * 0.006));
          }
          if (f >= 1) {
            /* rayas: gruesas al caer, se afinan hasta pelos */
            const th = lerp(S * 0.06, S * 0.0025, prog(lt, 0.07, 0.3, "out")), bandH = f < 3 ? H * 0.27 : Math.min(yb, H * 0.48);
            if (f < 3) { G.fillStyle = P.light; G.fillRect(0, 0, W, bandH); }
            P0.hatch(G, 0, 0, W, bandH, { gap: S * 0.17, bw: th, ang: 60, color: P.ink, off: lt * S * 0.3 });
          }
          const cols = [P.light, P0.rgba(P.light, 0.55), P0.rgba(P.light, 0.55), P0.mix(P.light, "#204a40", 0.5), P.accent, P.accent, P0.rgba(P0.mix(P.light, "#ffffff", 0.25), 0.8)];
          const col = cols[Math.min(f, cols.length - 1)];
          const size = P0.fit(p.text, W * (portrait ? 0.86 : 0.8), H * (portrait ? 0.12 : 0.21), 800, "expanded", -0.02);
          G.save(); const sc = 1 + lt * 0.01; G.translate(W / 2, H * 0.5); G.scale(sc, sc);
          P0.text(G, p.text, 0, size * 0.36, { font: P0.font(size, 800), color: col, align: "center", sp: -size * 0.02 }); G.restore();
          G.fillStyle = "#000"; G.fillRect(0, H - S * 0.02, W, S * 0.02);
          P0.enter(ctx, p.fx, lt, b.i);
        },
      };
    },
  });

  /* ------------------------------------------------------------------ flecha + rótulo que se decodifica */
  K.register({
    name: "pop.arrow", tags: ["flecha", "texto", "consecuencia", "transición"], layer: "main",
    summary: "Flecha gruesa que entra desde la izquierda en 4 cuadros parpadeando violeta→rosa→gris→rosa→violeta, con un rótulo de 1–2 renglones que se DECODIFICA letra por letra (ref. 54,12 'NEXT GENERATION').",
    example: { text: "AL DÍA\nSIGUIENTE" },
    params: {
      text: { type: "string", required: true, doc: "Rótulo (\\n = 2 renglones)." },
      ...P0.FX("cut"),
    },
    create(ctx, p) {
      const P = ctx.C.palette, lines = String(p.text).toUpperCase().split("\n");
      return {
        render(lt, b) {
          const { W, H, portrait } = ctx.stage, G = ctx.g.main, S = Math.min(W, H), f = P0.frameOf(lt);
          const aw = S * 0.62, q = prog(lt, 0, 0.14, "out");
          const ax = lerp(-aw * 0.85, W * (portrait ? 0.1 : 0.16), q) + lt * S * 0.04, ay = H * (portrait ? 0.4 : 0.5) - aw / 2;
          const seq = [P.ink, P.accent, null, P.muted, P.accent];
          const col = f < seq.length ? seq[f] : P.ink;
          if (col) P0.arrow(G, ax, ay, aw, aw, col, 0.21);
          const fs = S * 0.042, tx = portrait ? W * 0.12 : W * 0.6, ty = portrait ? H * 0.62 : H * 0.72;
          let start = 2;
          lines.forEach((ln, i) => {
            const k = f - start; start += 3;
            if (k < 0) return;
            const r = K.rng(f * 7 + i * 3), solved = Math.floor(k * 1.4);
            const s = [...ln].map((c, j) => (j < solved || c === " " ? c : SCR[Math.floor(r() * SCR.length)])).join("");
            P0.text(G, s, tx, ty + i * fs * 1.2, { font: P0.font(fs, 800), color: P.ink, sp: fs * 0.02 });
          });
          P0.enter(ctx, p.fx, lt, b.i);
        },
      };
    },
  });

  /* ------------------------------------------------------------------ texto mínimo */
  K.register({
    name: "pop.minimal", tags: ["texto", "pausa", "dato", "cierre"], layer: "main",
    summary: "Texto mínimo y aireado sobre gris claro (ref. 63,5 'USE ANY MEDIA / PHOTOS OR VIDEO'): kicker diminuto muy espaciado + línea en Montserrat espaciada que aparece letra a letra; o variante 'small' (ref. 21 s, 'YOU CAN SET ANY COLORS') de una línea chica con las primeras palabras en rosa.",
    example: { kicker: "9 DE NOVIEMBRE", text: "BERLÍN · 1989" },
    params: {
      text: { type: "string", required: true, doc: "Línea principal." },
      kicker: { type: "string", default: "", doc: "Línea diminuta arriba (solo style=spaced)." },
      style: { type: "enum", options: ["spaced", "small"], default: "spaced", doc: "spaced = Montserrat muy espaciada · small = una línea chica Archivo extendida." },
      accent: { type: "number", default: 2, doc: "style=small: cuántas palabras iniciales van en rosa." },
      bg: { type: "enum", options: ["paper", "mint"], default: "paper", doc: "Fondo gris claro (paper) o menta." },
      ...P0.FX("cut"),
    },
    create(ctx, p) {
      const P = ctx.C.palette;
      return {
        render(lt, b) {
          const { W, H } = ctx.stage, G = ctx.g.main, S = Math.min(W, H);
          G.fillStyle = p.bg === "paper" ? P.paper : P.bg; G.fillRect(0, 0, W, H);
          const ink = p.bg === "paper" ? P.black : P.ink, out = clamp((b.dur - lt) / 0.45);
          if (p.style === "spaced") {
            const fs = Math.min(S * 0.036, W * 0.85 / Math.max(6, p.text.length * 1.12)), sp = fs * 0.5, n = [...p.text].length;
            const gl = P0.glyphs(p.text, P0.MONT(fs, 600), sp), x0 = (W - gl.width) / 2;
            gl.list.forEach((g, i) => { const a = prog(lt, 0.1 + i * 0.03, 0.4, "inOut") * out; if (a > 0.01) P0.text(G, g.c, x0 + g.x, H / 2 + fs * 0.36, { font: P0.MONT(fs, 600), color: ink, alpha: a }); });
            if (p.kicker) P0.text(G, p.kicker, W / 2 + fs * 0.25, H / 2 - fs * 0.95, { font: P0.MONT(fs * 0.33, 700), color: ink, align: "center", sp: fs * 0.25, alpha: prog(lt, 0.05, 0.5) * out });
          } else {
            const fs = S * 0.022, ws = p.text.split(" "), fnt = P0.font(fs, 800);
            const total = P0.measure(p.text, fnt, fs * 0.05); let x = (W - total) / 2;
            const shown = Math.floor(clamp((lt - 0.05) / 0.5) * p.text.length); let used = 0;
            ws.forEach((w, i) => {
              const k = Math.max(0, Math.min(w.length, shown - used)); used += w.length + 1;
              P0.text(G, w.slice(0, k), x, H / 2 + fs * 0.36, { font: fnt, color: i < p.accent ? (P.red || "#e2463c") : ink, sp: fs * 0.05, alpha: out });
              x += P0.measure(w + " ", fnt, fs * 0.05);
            });
          }
          P0.enter(ctx, p.fx, lt, b.i);
        },
      };
    },
  });

  K.pop.offscreen = offscreen; K.pop.stageCanvas = stageCanvas;
})();
