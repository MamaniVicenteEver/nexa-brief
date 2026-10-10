/* =============================================================================
   pop · planos con fotos recortadas en formas: dos círculos, caja rayada, tríptico,
   marco paralelogramo, círculos en los bordes, columnas "posters", triángulo
   ========================================================================== */
(function () {
  const K = Kit, P0 = Kit.pop, { clamp, lerp, prog, ease } = K;
  const TAU = Math.PI * 2;
  const F = (p) => p.focus || [0.5, 0.5];

  /* ------------------------------------------------------------------ dos círculos */
  K.register({
    name: "pop.circles", tags: ["foto", "texto", "persona", "lugar"], layer: "main",
    summary: "Dos círculos con la MISMA foto en duotono que crecen desde 0 (el izquierdo primero) y una palabra violeta gigante encima cuya interletra se abre, con letras que faltan al entrar y una letra que parpadea rosa; barra menta, '× × ×' uno por uno y escuadra (ref. 48,1 'STYLE').",
    example: { text: "ESTE", src: "assets/media/leipzig.jpg" },
    params: {
      text: { type: "string", required: true, doc: "Palabra (ideal 4–7 letras)." },
      src: { type: "image", required: true, doc: "Foto (se ve a través de los dos círculos)." },
      ...P0.FOCUS, ...P0.FX("cut"),
    },
    create(ctx, p) {
      const P = ctx.C.palette, cv = P0.duo(ctx, p.src, "normal");
      return {
        render(lt, b) {
          const { W, H, portrait } = ctx.stage, G = ctx.g.main, S = Math.min(W, H), f = P0.frameOf(lt), fo = F(p);
          const c1 = portrait ? [W * 0.5, H * 0.3, W * 0.46] : [W * 0.21, H * 0.515, H * 0.415];
          const c2 = portrait ? [W * 0.5, H * 0.66, W * 0.46] : [W * 0.6, H * 0.515, H * 0.415];
          const r1 = c1[2] * ease.expoOut(clamp((lt - 0.03) / 0.2)), r2 = c2[2] * ease.expoOut(clamp((lt - 0.07) / 0.2));
          if (r1 > 1 || r2 > 1) {
            G.save(); G.beginPath(); if (r1 > 1) G.arc(c1[0], c1[1], r1, 0, TAU); if (r2 > 1) { G.moveTo(c2[0] + r2, c2[1]); G.arc(c2[0], c2[1], r2, 0, TAU); } G.clip("nonzero");
            P0.cover(G, cv, 0, 0, W, H, { zoom: 1.08 + lt * 0.01, fx: fo[0], fy: fo[1] }); G.restore();
          }
          const size = P0.fit(p.text, W * (portrait ? 0.8 : 0.46), H * (portrait ? 0.14 : 0.26), 800, "expanded", 0), fnt = P0.font(size, 800);
          const sp = lerp(-size * 0.07, size * 0.01, prog(lt, 0, 0.7, "out"));
          const gl = P0.glyphs(p.text, fnt, sp), x0 = portrait ? (W - gl.width) / 2 : W * 0.3 + lt * S * 0.03, y = portrait ? H * 0.5 : H * 0.52;
          const pink = f >= 6 ? (f < 12 ? 1 : 2) : -1;
          gl.list.forEach((g, i) => { if (f < 4 && P0.missing(i, f, 9, 0.28)) return; P0.text(G, g.c, x0 + g.x, y, { font: fnt, color: i === pink ? P.accent : P.ink }); });
          if (f >= 3) {
            G.fillStyle = P.light; G.fillRect(x0 + size * 0.15, y + size * 0.25, size * 0.75, S * 0.012);
            const bx = portrait ? W * 0.88 : W * 0.86, by = portrait ? H * 0.08 : H * 0.115, bs = S * 0.035;
            G.save(); G.strokeStyle = P.ink; G.lineWidth = S * 0.005; G.beginPath(); G.moveTo(bx - bs, by); G.lineTo(bx, by); G.lineTo(bx, by + bs); G.stroke(); G.restore();
          }
          const xs = [P.ink, P.light, P.accent];
          for (let i = 0; i < 3; i++) if (f >= 12 + i * 3) P0.cross(G, x0 - size * 0.2 + i * S * 0.045, y + size * 0.82, S * (i === 2 ? 0.015 : 0.03), S * (i === 2 ? 0.003 : 0.008), xs[i]);
          P0.enter(ctx, p.fx, lt, b.i);
        },
      };
    },
  });

  /* ------------------------------------------------------------------ caja con rayas */
  K.register({
    name: "pop.stripes", tags: ["foto", "texto", "documento"], layer: "main",
    summary: "Caja de marco fino con la foto lavada y RAYAS diagonales violeta que entran gruesas y se afinan hasta pelos; palabra violeta con eco rosa desplazado (letras que faltan), '|||' antes, flechas ↑↓; todo el grupo se desliza a la izquierda (ref. 48,65 'STYLE' en caja).",
    example: { text: "LA NOTA", src: "assets/media/nota.jpg" },
    params: {
      text: { type: "string", required: true, doc: "Palabra corta." },
      src: { type: "image", required: true, doc: "Foto dentro de la caja." },
      ...P0.FOCUS, ...P0.FX("cut"),
    },
    create(ctx, p) {
      const P = ctx.C.palette, cv = P0.duo(ctx, p.src, "light");
      return {
        render(lt, b) {
          const { W, H, portrait } = ctx.stage, G = ctx.g.main, S = Math.min(W, H), f = P0.frameOf(lt), fo = F(p);
          const gx = -W * (portrait ? 0.06 : 0.2) * (1 - Math.exp(-lt * 1.6));
          const bx = (portrait ? W * 0.08 : W * 0.33) + gx, by = portrait ? H * 0.3 : H * 0.17, bw = portrait ? W * 0.86 : W * 0.57, bh = portrait ? H * 0.28 : H * 0.5;
          /* textura de fondo: cuadros apenas más claros y grilla de puntos */
          G.save(); G.fillStyle = P0.mix(P.bg, "#ffffff", 0.08); G.fillRect(W * 0.015 + gx * 0.5, H * 0.22, S * 0.12, S * 0.14); G.fillRect(0, H * 0.62, S * 0.1, S * 0.13);
          G.fillStyle = P0.rgba(P.ink, 0.12); for (let y = H * 0.75; y < H * 0.9; y += S * 0.012) for (let x = S * 0.01; x < S * 0.1; x += S * 0.012) G.fillRect(x, y, S * 0.003, S * 0.003); G.restore();
          G.save(); G.beginPath(); G.rect(bx, by, bw, bh); G.clip();
          P0.cover(G, cv, bx, by, bw, bh, { zoom: 1.15, fx: fo[0], fy: fo[1], dx: -gx * 0.3 });
          if (f >= 2) { const q = prog(lt, 0.07, 0.38, "out"), gap = bh * 0.42; P0.hatch(G, bx, by, bw, bh, { gap, bw: lerp(gap * 0.5, S * 0.003, q), ang: -45, color: P.ink, off: -lt * S * 0.2 }); }
          G.restore();
          G.save(); G.strokeStyle = P.ink; G.lineWidth = Math.max(1, S * 0.0022); G.strokeRect(bx, by, bw, bh); G.restore();
          const size = P0.fit(p.text, bw * 0.55, H * (portrait ? 0.08 : 0.15), 800, "expanded", -0.02), fnt = P0.font(size, 800);
          const gl = P0.glyphs(p.text, fnt, -size * 0.02), tx = bx + bw - gl.width - bw * 0.02, ty = by + bh + size * 0.08;
          const k = f >> 1, gli = f < 36;   /* letras que faltan solo el primer segundo */
          gl.list.forEach((g, i) => { if (!gli || !P0.missing(i, k, 21, 0.2)) P0.text(G, g.c, tx + g.x, ty + size * 0.62, { font: fnt, color: P.accent }); });
          gl.list.forEach((g, i) => { if (!gli || !P0.missing(i, k, 22, 0.18)) P0.text(G, g.c, tx + g.x, ty, { font: fnt, color: P.ink }); });
          /* |||  */
          for (let i = 0; i < 4; i++) {
            const hx = tx - size * 0.95 + i * size * 0.16, hh = size * (0.3 + i * 0.12);
            P0.poly(G, [[hx, ty], [hx + size * 0.07, ty], [hx + size * 0.12, ty - hh], [hx + size * 0.05, ty - hh]]); G.fillStyle = i % 2 ? P.accent : P.ink; G.fill();
          }
          const ax = bx + bw + S * 0.06, ay = by + bh * 0.25, al = S * 0.05;
          if (f >= 1) P0.thinArrow(G, ax, ay + al, ax, ay, S * 0.005, P.ink, S * 0.018);
          if (f >= 3) P0.thinArrow(G, ax, ay + al * 1.4, ax, ay + al * 2.4, S * 0.005, P.ink, S * 0.018);
          P0.enter(ctx, p.fx, lt, b.i);
        },
      };
    },
  });

  /* ------------------------------------------------------------------ tríptico */
  const WAVE = [0, -0.34, 0, 0.3, 0, 0, -0.22, 0.2, 0, -0.2];
  K.register({
    name: "pop.split", tags: ["foto", "persona", "texto", "collage"], layer: "main",
    summary: "Tríptico (ref. 51,95 'STRONG'): columna con 2 fotos chicas entre bandas rayadas, panel menta con letras GIGANTES en contorno fino que se dibujan y la palabra con letras en ola que rebotan al entrar, foto grande a la derecha que se desliza a la izquierda con rótulo menta glitcheado.",
    example: { text: "VOCERO", src: "assets/media/schabowski.jpg", tag: "GÜNTER SCHABOWSKI · SED" },
    params: {
      text: { type: "string", required: true, doc: "Palabra (ideal 5–8 letras)." },
      src: { type: "image", required: true, doc: "Foto grande (derecha / abajo)." },
      src2: { type: "image", default: "", doc: "Foto de las 2 chicas (vacío = la misma)." },
      tag: { type: "string", default: "", doc: "Rótulo menta sobre la foto grande." },
      outline: { type: "string", default: "", doc: "Letras gigantes en contorno (vacío = 2 primeras de text)." },
      ...P0.FOCUS, ...P0.FX("cut"),
    },
    create(ctx, p) {
      const P = ctx.C.palette, cv = P0.duo(ctx, p.src, "normal"), cv2 = P0.duo(ctx, p.src2 || p.src, "normal"), cv3 = P0.duo(ctx, p.src2 || p.src, "light");
      const ol = p.outline || [...p.text].slice(0, 2).join("");
      return {
        render(lt, b) {
          const { W, H, portrait } = ctx.stage, G = ctx.g.main, S = Math.min(W, H), f = P0.frameOf(lt), fo = F(p);
          const band = (x, y, w, h) => { G.fillStyle = P.bg; G.fillRect(x, y, w, h); P0.hatch(G, x, y, w, h, { gap: S * 0.035, bw: S * 0.012, ang: 45, color: P.ink }); };
          let px, py, pw, ph, cx0, cw;
          if (!portrait) {
            const lw = W * 0.225;
            band(0, 0, lw, H * 0.1); band(0, H * 0.465, lw, H * 0.065); band(0, H * 0.88, lw, H * 0.12);
            G.save(); G.beginPath(); G.rect(0, H * 0.1, lw, H * 0.365); G.clip(); P0.cover(G, cv2, 0, H * 0.1, lw, H * 0.365, { zoom: 1.1 + lt * 0.02 }); G.restore();
            G.save(); G.beginPath(); G.rect(0, H * 0.53, lw, H * 0.35); G.clip(); P0.cover(G, cv3, 0, H * 0.53, lw, H * 0.35, { zoom: 1.25 }); G.restore();
            px = lerp(W * 0.64, W * 0.578, prog(lt, 0, 0.6, "out")) - lt * S * 0.006; py = 0; pw = W - px; ph = H; cx0 = lw; cw = px - lw;
          } else {
            const th = H * 0.2;
            band(0, 0, W, H * 0.03); band(0, th + H * 0.03, W, H * 0.025);
            G.save(); G.beginPath(); G.rect(0, H * 0.03, W * 0.49, th); G.clip(); P0.cover(G, cv2, 0, H * 0.03, W * 0.49, th, { zoom: 1.1 }); G.restore();
            G.save(); G.beginPath(); G.rect(W * 0.51, H * 0.03, W * 0.49, th); G.clip(); P0.cover(G, cv3, W * 0.51, H * 0.03, W * 0.49, th, { zoom: 1.25 }); G.restore();
            px = 0; py = lerp(H * 0.62, H * 0.58, prog(lt, 0, 0.6, "out")); pw = W; ph = H - py; cx0 = 0; cw = W;
          }
          /* letras gigantes en contorno que se dibujan (revelado de izquierda a derecha) */
          const os = portrait ? H * 0.2 : H * 0.42, oy = portrait ? H * 0.43 : H * 0.56, ox = cx0 + S * 0.01;
          G.save(); G.beginPath(); G.rect(ox, 0, (portrait ? W : W * 0.6) * prog(lt, 0.05, 0.35, "inOut"), H); G.clip();
          P0.text(G, ol, ox, oy, { font: P0.font(os, 800), stroke: P.ink, lw: Math.max(1, S * 0.0022), sp: -os * 0.02 }); G.restore();
          /* foto grande */
          G.save(); G.beginPath(); G.rect(px, py, pw, ph); G.clip(); P0.cover(G, cv, px, py, pw, ph, { zoom: 1.08 + lt * 0.01, fx: fo[0], fy: fo[1] }); G.restore();
          /* rectángulo fino que cruza y línea superior */
          G.save(); G.strokeStyle = P.light; G.lineWidth = Math.max(1, S * 0.003);
          if (!portrait) { G.strokeRect(W * 0.5, H * 0.445, W * 0.19, H * 0.07); G.strokeStyle = P.ink; G.beginPath(); G.moveTo(W * 0.465, H * 0.2); G.lineTo(px, H * 0.2); G.stroke(); }
          G.restore();
          /* palabra con letras en ola */
          const size = P0.fit(p.text, cw * 0.8, H * (portrait ? 0.08 : 0.11), 800, "expanded", 0), fnt = P0.font(size, 800);
          const gl = P0.glyphs(p.text, fnt, size * 0.01), tx = portrait ? (W - gl.width) / 2 : cx0 + cw * 0.06, ty = portrait ? H * 0.5 : H * 0.68;
          gl.list.forEach((g, i) => {
            const q = clamp((lt - 0.1 - i * 0.02) / 0.22), amp = f < 3 ? 2.6 : 1 + (1 - ease.back(q)) * 1.6;
            P0.text(G, g.c, tx + g.x, ty + WAVE[i % WAVE.length] * size * 0.5 * amp, { font: fnt, color: P.ink });
          });
          /* rótulo menta sobre la foto con cortes glitch */
          if (p.tag) {
            let fs = S * 0.021, tw = P0.measure(p.tag, P0.font(fs, 700), fs * 0.06) + fs * 2.2;
            const room = portrait ? W * 0.9 : pw * 0.92;
            if (tw > room) { fs *= room / tw; tw = room; }
            const rx = portrait ? W * 0.05 : Math.min(px + pw * 0.4, W - tw - S * 0.03), ry = portrait ? py + ph * 0.12 : H * 0.235;
            const r = K.rng(33 + (f >> 2));
            G.save(); G.fillStyle = P0.rgba(P.light, 0.85); G.fillRect(rx + S * 0.03 * r(), ry - fs * 2.2, tw * 0.9, fs * 1.2); G.fillRect(rx - S * 0.02, ry + fs * 1.3, tw * 1.1, fs * 1.1);
            G.fillStyle = P.light; G.fillRect(rx, ry - fs * 0.85, tw, fs * 1.7);
            P0.text(G, p.tag, rx + fs * 1.1, ry + fs * 0.36, { font: P0.font(fs, 700), color: P.ink, sp: fs * 0.06 }); G.restore();
          }
          P0.enter(ctx, p.fx, lt, b.i);
        },
      };
    },
  });

  /* ------------------------------------------------------------------ marco paralelogramo */
  K.register({
    name: "pop.frame", tags: ["foto", "texto", "título", "lugar"], layer: "main",
    summary: "Foto muy desenfocada que se enfoca; un marco paralelogramo menta GRUESO rota (−35°→0), crece y se afina hasta ser un marco rectangular fino con esquinas en triángulo; título menta con ecos en contorno que se abren a los lados (ref. 52,52 'THE POWER').",
    example: { text: "BORNHOLMER STRASSE", src: "assets/media/bornholmer.jpg", sub: "PASO FRONTERIZO · BERLÍN" },
    params: {
      text: { type: "string", required: true, doc: "Título (1 renglón)." },
      sub: { type: "string", default: "", doc: "Línea chica debajo." },
      src: { type: "image", required: true, doc: "Foto de fondo." },
      ...P0.FOCUS, ...P0.FX("cut"),
    },
    create(ctx, p) {
      const P = ctx.C.palette, cv = P0.duo(ctx, p.src, "dark");
      return {
        render(lt, b) {
          const { W, H, portrait } = ctx.stage, G = ctx.g.main, S = Math.min(W, H), fo = F(p);
          P0.cover(G, cv, 0, 0, W, H, { zoom: 1.12 + lt * 0.03, fx: fo[0], fy: fo[1], blur: lerp(S * 0.035, S * 0.002, prog(lt, 0, 0.55, "out")) });
          const q = prog(lt, 0.03, 0.32, "inOut"), cx = W / 2, cy = H * 0.495;
          const fw = lerp(W * 0.36, W * (portrait ? 0.86 : 0.8), q), fh = lerp(H * 0.16, H * (portrait ? 0.5 : 0.71), q);
          const rot = lerp(-0.6, 0, q), sk = lerp(0.55, 0, q), th = lerp(S * 0.075, S * 0.007, q);
          G.save(); G.translate(cx, cy); G.rotate(rot); G.transform(1, 0, -sk, 1, 0, 0);
          G.beginPath(); G.rect(-fw / 2, -fh / 2, fw, fh); G.rect(-fw / 2 + th, -fh / 2 + th, fw - 2 * th, fh - 2 * th);
          G.fillStyle = P.light; G.fill("evenodd");
          /* velo violeta suave dentro del marco: el título menta se lee sobre fotos claras */
          G.fillStyle = P0.rgba(P.ink, 0.3 * q); G.fillRect(-fw / 2 + th, -fh / 2 + th, fw - 2 * th, fh - 2 * th); G.fillStyle = P.light;
          if (q >= 1) { const c = S * 0.08; P0.poly(G, [[-fw / 2, fh / 2 - c], [-fw / 2 + c, fh / 2], [-fw / 2, fh / 2]]); G.fill(); P0.poly(G, [[fw / 2, -fh / 2 + c], [fw / 2 - c, -fh / 2], [fw / 2, -fh / 2]]); G.fill(); }
          G.restore();
          const size = P0.fit(p.text, W * (portrait ? 0.7 : 0.38), S * 0.075, 800, "expanded", -0.03), fnt = P0.font(size, 800);
          /* ecos en contorno que se abren */
          const e = prog(lt, 0.05, 0.6, "out");
          for (const d of [-1, 1]) {
            G.save(); G.translate(cx + d * W * 0.24 * e, cy); G.transform(1, 0, -0.25, 1, 0, 0); G.scale(1.9, 1.9); G.globalAlpha = 0.75 * (1 - e * 0.6);
            P0.text(G, p.text, 0, size * 0.36, { font: fnt, stroke: P.ink, lw: Math.max(0.6, S * 0.0012), align: "center", sp: -size * 0.03 }); G.restore();
          }
          G.save(); G.translate(cx, cy); if (lt < 0.1) G.transform(1, 0, -0.35, 1, 0, 0);
          P0.text(G, p.text, 0, size * 0.36, { font: fnt, color: P.light, align: "center", sp: -size * 0.03 }); G.restore();
          if (p.sub) P0.text(G, p.sub, cx, cy + size * 1.25, { font: P0.font(S * 0.02, 700), color: P.light, align: "center", sp: S * 0.004, alpha: prog(lt, 0.3, 0.3) });
          P0.enter(ctx, p.fx, lt, b.i);
        },
      };
    },
  });

  /* ------------------------------------------------------------------ círculos en los bordes */
  K.register({
    name: "pop.duo", tags: ["foto", "comparación", "consecuencia", "multitud"], layer: "main",
    summary: "Dos círculos-foto enormes en los bordes que crecen, flecha gruesa al centro, '×' rosa, flechitas, rótulo de 2 renglones y línea superior con texto mínimo (ref. 54,75 'NEXT GENERATION'). Entra con esquirlas.",
    example: { src: "assets/media/bornholmer.jpg", src2: "assets/media/leipzig.jpg", text: "MILES\nDE PERSONAS", kicker: "9 NOV 1989 · 23:30" },
    params: {
      src: { type: "image", required: true, doc: "Foto del círculo derecho (grande)." },
      src2: { type: "image", default: "", doc: "Foto del círculo izquierdo (vacío = la misma)." },
      text: { type: "string", default: "", doc: "Rótulo (\\n = 2 renglones)." },
      kicker: { type: "string", default: "", doc: "Texto mínimo bajo la línea superior." },
      ...P0.FOCUS, ...P0.FX("shards"),
    },
    create(ctx, p) {
      const P = ctx.C.palette, cv = P0.duo(ctx, p.src, "normal"), cv2 = P0.duo(ctx, p.src2 || p.src, "normal");
      return {
        render(lt, b) {
          const { W, H, portrait } = ctx.stage, G = ctx.g.main, S = Math.min(W, H), fo = F(p);
          const g = 0.88 + 0.12 * prog(lt, 0, 0.2, "out") + lt * 0.012;
          const C1 = portrait ? [W * 0.5, -H * 0.08, W * 0.55] : [-W * 0.1, H * 0.5, H * 0.56], C2 = portrait ? [W * 0.5, H * 1.06, W * 0.58] : [W * 0.93, H * 0.5, H * 0.62];
          for (const [c, im, z] of [[C1, cv2, 1.0], [C2, cv, 1.0]]) {
            G.save(); G.beginPath(); G.arc(c[0], c[1], c[2] * g, 0, TAU); G.clip();
            P0.cover(G, im, c[0] - c[2] * 1.1, c[1] - c[2] * 1.1, c[2] * 2.2, c[2] * 2.2, { zoom: z + lt * 0.015, fx: fo[0], fy: fo[1] }); G.restore();
          }
          const ax = portrait ? W * 0.36 : W * 0.42, ay = H * (portrait ? 0.44 : 0.5), aw = portrait ? W * 0.32 : H * 0.32;
          P0.arrow(G, ax, ay - aw / 2, aw, aw, P.ink, 0.21);
          P0.cross(G, ax - S * 0.08, ay, S * 0.06, S * 0.013, P.accent);
          P0.thinArrow(G, ax - S * 0.11, ay - S * 0.2, ax - S * 0.05, ay - S * 0.17, S * 0.011, P.ink, S * 0.03);
          P0.thinArrow(G, ax - S * 0.11, ay + S * 0.17, ax - S * 0.05, ay + S * 0.2, S * 0.011, P.ink, S * 0.03);
          if (p.text) String(p.text).toUpperCase().split("\n").forEach((ln, i) => P0.text(G, ln, portrait ? W * 0.1 : W * 0.225, (portrait ? H * 0.6 : H * 0.74) + i * S * 0.065, { font: P0.font(S * 0.045, 800), color: P.ink }));
          const lx0 = portrait ? W * 0.12 : W * 0.28, lx1 = portrait ? W * 0.88 : W * 0.63, ly = portrait ? H * 0.25 : H * 0.16;
          G.save(); G.fillStyle = P.ink; G.fillRect(lx0, ly, (lx1 - lx0) * prog(lt, 0.05, 0.4, "out"), Math.max(1.5, S * 0.003)); G.restore();
          if (p.kicker) P0.text(G, p.kicker, lx0, ly + S * 0.035, { font: P0.font(S * 0.016, 700), color: P0.rgba(P.ink, 0.7), sp: S * 0.002 });
          P0.enter(ctx, p.fx, lt, b.i);
        },
      };
    },
  });

  /* ------------------------------------------------------------------ arcos grises + columnas */
  function arcs(G, W, H, S, lt, P, portrait) {
    const cx = portrait ? W * 0.62 : W * 0.72, cy = portrait ? H * 0.35 : H * 0.42, R = S * 0.36, rot = lt * 0.35;
    G.save(); G.strokeStyle = P0.rgba(P.muted, 0.75); G.lineCap = "round";
    G.lineWidth = S * 0.045; for (const [a, b2] of [[0, 1.5], [2.1, 2.9], [3.5, 5.3]]) { G.beginPath(); G.arc(cx, cy, R, a + rot, b2 + rot); G.stroke(); }
    G.lineWidth = S * 0.03; for (const [a, b2] of [[0.8, 2.2], [3.0, 4.1], [4.8, 5.9]]) { G.beginPath(); G.arc(cx, cy, R * 1.22, a - rot * 0.7, b2 - rot * 0.7); G.stroke(); }
    G.restore();
  }
  function column(G, cv, x, y, w, h, text, size, P, lt) {
    G.save(); G.beginPath(); G.rect(x, y, w, h); G.clip(); P0.cover(G, cv, x, y, w, h, { zoom: 1.2, dy: -lt * h * 0.03 }); G.restore();
    if (text) P0.text(G, text, x + w / 2, y + h * 0.5 + size * 0.36, { font: P0.font(size, 800), color: P.light, align: "center", sp: -size * 0.02 });
  }
  function triMark(G, x, y, s, color) { P0.poly(G, [[x - s, y], [x + s * 0.7, y - s * 0.9], [x + s * 0.7, y + s * 0.9]]); G.fillStyle = color; G.fill(); }
  K.register({
    name: "pop.posters", tags: ["foto", "texto", "collage", "lugar"], layer: "main",
    summary: "Columnas verticales de foto (ref. 55,26 'NICE / POSTERS'): una columna entra barriendo desde la derecha en 2 cuadros y deriva; en `p2` aparece la 2ª columna y la cámara panea; en `p3` todo se aleja al 35 % con regla y texto mínimo debajo. Arcos grises gruesos que giran y triángulo ◄.",
    example: { src: "assets/media/muro-gente.jpg", text: "BERLÍN", src2: "assets/media/mauerspecht.jpg", text2: "ESTE", caption: "LAS DOS MITADES DE UNA CIUDAD" },
    params: {
      src: { type: "image", required: true, doc: "Foto de la 1ª columna." },
      text: { type: "string", default: "", doc: "Palabra de la 1ª columna." },
      src2: { type: "image", default: "", doc: "Foto de la 2ª columna (vacío = la misma con otro encuadre)." },
      text2: { type: "string", default: "", doc: "Palabra de la 2ª columna." },
      caption: { type: "string", default: "", doc: "Texto mínimo bajo la regla (fase alejada)." },
      p2: { type: "number", default: 0.55, doc: "Segundos hasta la 2ª columna." },
      p3: { type: "number", default: 1.1, doc: "Segundos hasta el alejamiento (<0 = nunca)." },
      ...P0.FX("cut"),
    },
    create(ctx, p) {
      const P = ctx.C.palette, cv = P0.duo(ctx, p.src, "dark"), cv2 = P0.duo(ctx, p.src2 || p.src, "dark");
      return {
        render(lt, b) {
          const { W, H, portrait } = ctx.stage, G = ctx.g.main, S = Math.min(W, H);
          arcs(G, W, H, S, lt, P, portrait);
          const cw = portrait ? W * 0.42 : W * 0.275, fs = S * 0.048;
          const ph3 = p.p3 >= 0 && lt >= p.p3, ph2 = lt >= p.p2;
          if (!ph3) {
            if (!ph2) {
              const x = lerp(W * 1.02, W * 0.06, prog(lt, 0, 0.07, "linear")) + Math.max(0, lt - 0.07) * W * 0.12;
              column(G, cv, x, 0, cw, H, p.text, fs, P, lt);
              triMark(G, W * 0.55 - lt * W * 0.05, H * 0.78, S * 0.025, P.ink);
            } else {
              const k = lt - p.p2, d = W * 0.15 * (1 - Math.exp(-k * 3)) + k * W * 0.02, x2 = -W * 0.06 + d;
              column(G, cv2, x2, 0, cw, H, p.text2, fs, P, lt);
              column(G, cv, x2 + cw + W * (portrait ? 0.06 : 0.075), 0, cw, H, p.text, fs, P, lt);
              triMark(G, x2 + cw * 0.85, H * 0.82, S * 0.03, P.ink);
            }
          } else {
            const k = lt - p.p3, s = lerp(0.4, 0.33, prog(k, 0, 0.8, "out")), gcx = W * (portrait ? 0.55 : 0.6), gcy = H * 0.48;
            const w = cw * s * 1.25, h = H * s * (portrait ? 0.7 : 1.2), gap = W * 0.025;
            column(G, cv2, gcx - w - gap / 2, gcy - h / 2, w, h, p.text2, fs * s * 1.1, P, lt);
            column(G, cv, gcx + gap / 2, gcy - h / 2, w, h, p.text, fs * s * 1.1, P, lt);
            const ly = gcy + h / 2 + S * 0.08;
            G.fillStyle = P.ink; G.fillRect(gcx - w * 0.2, ly, w * 2.2, Math.max(1.5, S * 0.004));
            if (p.caption) P0.text(G, p.caption, gcx - w * 0.2, ly + S * 0.035, { font: P0.font(S * 0.015, 800), color: P.ink, sp: S * 0.001 });
            triMark(G, W * (portrait ? 0.15 : 0.25) - k * W * 0.01, H * 0.6, S * 0.025, P.ink);
          }
          P0.enter(ctx, p.fx, lt, b.i);
        },
      };
    },
  });

  K.register({
    name: "pop.triangle", tags: ["foto", "persona", "transición"], layer: "main",
    summary: "Un triángulo ◄ chico crece en 4 cuadros hasta un TRIÁNGULO grande con foto a la izquierda (ref. 56,85), junto a las columnas alejadas, la regla con texto mínimo y los arcos grises que giran.",
    example: { src: "assets/media/schabowski.jpg", src2: "assets/media/nota.jpg", text: "PRENSA", caption: "CONFERENCIA · 18:00" },
    params: {
      src: { type: "image", required: true, doc: "Foto del triángulo." },
      src2: { type: "image", default: "", doc: "Foto de las columnas chicas (vacío = la misma)." },
      text: { type: "string", default: "", doc: "Palabra en la columna chica." },
      caption: { type: "string", default: "", doc: "Texto mínimo bajo la regla." },
      tone: { type: "enum", options: ["dark", "normal", "light", "inv"], default: "normal", doc: "Duotono del triángulo (fotos muy claras: dark)." },
      ...P0.FOCUS, ...P0.FX("cut"),
    },
    create(ctx, p) {
      const P = ctx.C.palette, cv = P0.duo(ctx, p.src, p.tone), cv2 = P0.duo(ctx, p.src2 || p.src, "dark");
      return {
        render(lt, b) {
          const { W, H, portrait } = ctx.stage, G = ctx.g.main, S = Math.min(W, H), fo = F(p);
          arcs(G, W, H, S, lt + 1, P, portrait);
          const gcx = W * (portrait ? 0.7 : 0.6), gcy = H * (portrait ? 0.62 : 0.48), w = (portrait ? W * 0.18 : W * 0.105), h = portrait ? H * 0.22 : H * 0.4, gap = W * 0.022;
          column(G, cv2, gcx - w - gap / 2, gcy - h / 2, w, h, "", 0, P, lt);
          column(G, cv2, gcx + gap / 2, gcy - h / 2, w, h, p.text, S * 0.02, P, lt);
          const ly = gcy + h / 2 + S * 0.07;
          G.fillStyle = P.ink; G.fillRect(gcx - w * 0.2, ly, w * 2.2, Math.max(1.5, S * 0.004));
          if (p.caption) P0.text(G, p.caption, gcx - w * 0.2, ly + S * 0.03, { font: P0.font(S * 0.014, 800), color: P.ink });
          /* triángulo: de ◄ chico a grande (apex a la izquierda) */
          const q = ease.expoOut(clamp((lt - 0.03) / 0.16));
          const small = [[W * 0.24, H * 0.6], [W * 0.24 + S * 0.045, H * 0.6 - S * 0.04], [W * 0.24 + S * 0.045, H * 0.6 + S * 0.04]];
          const big = portrait ? [[-W * 0.05, H * 0.4], [W * 0.72, -H * 0.02], [W * 0.72, H * 0.72]] : [[-W * 0.02, H * 0.58], [W * 0.405, -H * 0.01], [W * 0.405, H * 1.01]];
          const tri = small.map((pt, i) => [lerp(pt[0], big[i][0], q), lerp(pt[1], big[i][1], q)]);
          G.save(); P0.clipPoly(G, tri);
          if (q > 0.2) P0.cover(G, cv, 0, 0, big[1][0], H * (portrait ? 0.74 : 1), { zoom: 1.05 + lt * 0.02, fx: fo[0], fy: fo[1] }); else { G.fillStyle = P.ink; G.fillRect(0, 0, W, H); }
          G.restore();
          P0.enter(ctx, p.fx, lt, b.i);
        },
      };
    },
  });
})();
