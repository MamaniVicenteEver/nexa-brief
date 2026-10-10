/* =============================================================================
   collage · planos especiales: cinta ornamental, homenaje (pétalos), retratos en
   medallón, emblema 3D, destello de luz (overlay) y cierre del canal.
   ========================================================================== */
(function () {
  "use strict";
  const K = window.Kit, CL = K.collage, { clamp, lerp, prog, ease } = K;
  const { card, drawCard, txt, measure, filler, common, mk, bell } = CL;
  const img = (doc, req) => ({ type: "image", default: "", required: !!req, doc });
  const photosOf = p => ["photo", "photo2", "photo3", "photo4"].map(k => p[k]).filter(Boolean);
  const toneOf = (p, i, d) => (Array.isArray(p.tones) && p.tones.length ? p.tones[i % p.tones.length] : d);
  const fit = (font, s, size, maxW) => Math.min(size, size * maxW / Math.max(1e-6, measure(font.replace("{s}", "100px"), s) / 100 * size / 100));

  /** voluta ornamental (extremo de la cinta): espirales y hojitas, en unidades de placa */
  function flourish(g, side, h, col, col2) {
    g.save(); g.scale(side, 1); g.strokeStyle = col; g.fillStyle = col; g.lineCap = "round";
    const s = h;
    g.lineWidth = s * 0.06;
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
  /** cinta bordó con filetes rosados y texto crema centrado (lines: renglones) */
  function ribbonBand(g, w, h, lines, size, P) {
    const gr = g.createLinearGradient(0, -h / 2, 0, h / 2); gr.addColorStop(0, P.accent2 || "#b13a5c"); gr.addColorStop(0.5, P.accent || "#9e2f4f"); gr.addColorStop(1, "#7f2140");
    g.fillStyle = gr; g.fillRect(-w / 2, -h / 2, w, h);
    g.strokeStyle = "rgba(255,215,225,.75)"; g.lineWidth = h * 0.025; g.strokeRect(-w / 2 + h * 0.07, -h / 2 + h * 0.07, w - h * 0.14, h - h * 0.14);
    for (const sd of [-1, 1]) { g.fillStyle = "#e8b8a0"; g.beginPath(); const x = sd * (w / 2 - h * 0.24); g.moveTo(x, -h * 0.13); g.lineTo(x + h * 0.08, 0); g.lineTo(x, h * 0.13); g.lineTo(x - h * 0.08, 0); g.closePath(); g.fill(); }
    lines.forEach((l, i) => txt(g, l, 0, (i - (lines.length - 1) / 2) * size * 0.0125 + size * 0.0035, { size, weight: 700, font: "Cinzel, serif", color: "#fff3ef", spacing: size * 0.02 }));
    flourish(g, -1, h * 0.55, "#8e2a45", "#d9a3ae"); g.save(); g.translate(-w / 2, 0); flourish(g, -1, h * 0.75, "#8e2a45", "#e7b3bd"); g.restore();
    g.save(); g.translate(w / 2, 0); flourish(g, 1, h * 0.75, "#8e2a45", "#e7b3bd"); g.restore();
  }

  /* ===================================================================== cinta ornamental */
  K.register({
    name: "collage.ribbon", tags: ["celebración", "título", "cinta", "momento"], layer: "main", post: CL.POST,
    summary: "Columna central: foto arriba, cinta bordó con volutas ornamentales y texto crema, foto abajo; a los costados fotos grandes desenfocadas y estelas de fuegos artificiales/destellos. Para celebraciones y momentos solemnes.",
    example: { text: "LA NOCHE EN QUE\nCAYÓ EL MURO", photo: "assets/media/muro-gente.jpg", photo2: "assets/media/mauerspecht.jpg", photo3: "assets/media/bornholmer.jpg" },
    params: { text: { type: "string", required: true, doc: "Texto de la cinta ('\\n' = 2 renglones)." }, photo: img("Foto superior.", true), photo2: img("Foto inferior."), photo3: img("Fotos laterales desenfocadas."), photo4: img("Otra foto lateral."), sparks: { type: "bool", default: true, doc: "Estelas de fuegos artificiales." }, tones: { type: "array", default: [], doc: "Virados." }, ...common, move: { ...common.move, default: "in" }, speed: { ...common.speed, default: 0.03 } },
    create(ctx, p) {
      const P = ctx.C.palette;
      return CL.scene(ctx, p, { noTilt: true, build(S) {
        const { F, portrait, r } = S, ps = photosOf(p);
        filler(S, 8);
        const side = [ps[2] || ps[0], ps[3] || ps[1] || ps[0]];
        side.forEach((src, i) => {
          const k = card(F, src, { tone: i ? "teal" : "rose", ar: portrait ? 1.4 : 0.85, size: 560, border: 0, shadow: false, zoom: 1.3, focus: [0.4 + i * 0.2, 0.5] });
          const bl = mk(k.c.width, k.c.height), bg = bl.getContext("2d"); bg.filter = "blur(6px)"; bg.drawImage(k.c, 0, 0);
          const kb = { c: bl, iw: k.iw, ih: k.ih };
          S.add(portrait ? { x: (i ? 0.32 : -0.32), y: i ? 0.95 : -0.95, raw: true, z: -0.01, enter: "none", draw: g => drawCard(g, kb, 0.9) } : { x: i ? 0.78 : -0.78, y: i ? 0.06 : -0.02, raw: true, z: -0.01, enter: "none", draw: g => drawCard(g, kb, 0.66) });
        });
        const top = card(F, ps[0], { tone: toneOf(p, 0, "color"), ar: portrait ? 1.25 : 1.7, size: 900, border: 0.012 });
        const bot = card(F, ps[1] || ps[0], { tone: toneOf(p, 1, "color"), ar: portrait ? 1.25 : 1.75, size: 900, border: 0.012, zoom: ps[1] ? 1 : 1.5 });
        const cw = portrait ? 0.86 : 0.74, ty = portrait ? -0.47 : -0.255, byy = portrait ? 0.47 : 0.29;
        S.add({ x: 0, y: ty, raw: true, z: 0.01, enter: "none", draw: g => drawCard(g, top, cw) });
        S.add({ x: 0, y: byy, raw: true, z: 0.01, t0: 0.3, enter: "slide", sdx: 0, sdy: 0.4, draw: g => drawCard(g, bot, cw) });
        const lines = String(p.text).split("\n"), bw = portrait ? 0.78 : 0.72, size = Math.min(...lines.map(l => fit("700 {s} Cinzel", l, 4.2, bw * 0.82)));
        const bh = (size * 1.3 * lines.length + 2.4) / 100;
        S.add({ x: 0, y: portrait ? 0 : 0.02, raw: true, z: 0.03, t0: 0.15, din: 0.5, enter: "pop", draw: g => ribbonBand(g, bw, bh, lines, size, P) });
        if (p.sparks) {
          const sp = Array.from({ length: 34 }, () => ({ cx: (r() < 0.5 ? -1 : 1) * (0.55 + r() * 0.5), cy: -0.45 + r() * 0.5, an: r() * Math.PI * 2, t0: r() * 3, len: 0.05 + r() * 0.12 }));
          S.add({ x: 0, y: 0, raw: true, z: 0.1, enter: "none", draw(g, lt) {
            g.lineCap = "round";
            for (const s of sp) {
              const ph = ((lt + s.t0) % 2.4) / 2.4, d = 0.03 + ph * 0.32, a = Math.sin(Math.PI * ph) * 0.8;
              const [cx, cy] = portrait ? [s.cy * 0.9, s.cx * 1.3] : [s.cx, s.cy];
              g.strokeStyle = `rgba(255,236,210,${a.toFixed(3)})`; g.lineWidth = 0.004;
              g.beginPath(); g.moveTo(cx + Math.cos(s.an) * d, cy + Math.sin(s.an) * d); g.lineTo(cx + Math.cos(s.an) * (d + s.len), cy + Math.sin(s.an) * (d + s.len)); g.stroke();
              g.globalAlpha = a * 0.6; g.drawImage(F.bokehGold, cx + Math.cos(s.an) * (d + s.len) - 0.012, cy + Math.sin(s.an) * (d + s.len) - 0.012, 0.024, 0.024); g.globalAlpha = 1;
            }
          } });
        }
        S.focus = { x: 0, y: 0 };
      } });
    },
  });

  /* ===================================================================== homenaje con pétalos */
  K.register({
    name: "collage.tribute", tags: ["homenaje", "víctimas", "memoria", "duelo"], layer: "main", post: CL.POST,
    summary: "Homenaje sobrio: foto en óvalo que se funde con el papel, fecha chica y titular bordó sobre una regla, bruma rosada y pétalos rojos que caen (algunos grandes y desenfocados, cerca de cámara).",
    example: { photo: "assets/media/muro-gente.jpg", date: "1961 · 1989", text: "AL MENOS 140 PERSONAS MURIERON EN EL MURO" },
    params: { photo: img("Foto del homenaje.", true), date: { type: "string", default: "", doc: "Fecha chica." }, text: { type: "string", default: "", doc: "Titular ('\\n' parte)." }, petals: { type: "number", default: 16, min: 0, max: 40, doc: "Cantidad de pétalos." }, tone: { type: "enum", options: Object.keys(CL.TONES), default: "rose", doc: "Virado de la foto." }, ...common, move: { ...common.move, default: "in" }, speed: { ...common.speed, default: 0.025 } },
    create(ctx, p) {
      const P = ctx.C.palette;
      return CL.scene(ctx, p, { noTilt: true, build(S) {
        const { F, portrait, r } = S;
        filler(S, 8);
        S.add({ x: 0, y: 0, raw: true, z: -0.01, enter: "none", draw(g) { g.drawImage(F.paperLight, -1.2, -1.1, 2.4, 2.2); } });
        const k = card(F, p.photo, { tone: p.tone, ar: portrait ? 0.9 : 1.75, size: 980, oval: true, shadow: false });
        S.add({ x: 0, y: portrait ? 0.14 : 0.15, raw: true, enter: "none", draw: g => drawCard(g, k, portrait ? 1.0 : 1.05) });
        const lines = String(p.text || "").split("\n").filter(Boolean), maxW = portrait ? 0.86 : 1.1, size = Math.min(4.2, ...lines.map(l => fit("700 {s} 'Playfair Display'", l, 4.2, maxW)));
        const y0 = portrait ? -0.6 : -0.34;
        S.add({ x: 0, y: y0, raw: true, z: 0.02, t0: 0.3, din: 0.8, enter: "fade", draw(g) {
          if (p.date) txt(g, p.date, 0, -0.035, { size: 3, weight: 600, color: P.year });
          g.fillStyle = "rgba(90,30,40,.6)"; g.fillRect(-maxW * 0.48, -0.02, maxW * 0.96, 0.0025);
          lines.forEach((l, i) => txt(g, l, 0, 0.035 + i * size * 0.012, { size, weight: 700, font: "'Playfair Display', serif", color: P.headline || "#5e1a22" }));
        } });
        const pts = Array.from({ length: p.petals }, (_, i) => ({ x: r() * 2.2 - 1.1, y0: r() * 2, v: 0.08 + r() * 0.12, s: (i % 5 === 0 ? 0.2 : 0.06) * (0.7 + r() * 0.6), rot: r() * 6, vr: (r() - 0.5) * 2, k: i % 3, sway: r() * 6, big: i % 5 === 0 }));
        S.add({ x: 0, y: 0, raw: true, z: 0.3, enter: "none", draw(g, lt) {
          for (const q of pts) {
            const y = ((q.y0 + lt * q.v) % 2) - 1, x = q.x + Math.sin(lt * 0.8 + q.sway) * 0.05, a = clamp(lt / 0.8) * (q.big ? 0.75 : 0.95);
            g.save(); g.translate(x, y); g.rotate(q.rot + lt * q.vr); g.scale(1, 0.55 + 0.45 * Math.abs(Math.sin(lt * 1.3 + q.sway)));
            if (q.big) g.filter = `blur(${(ctx.stage.u * ctx.dpr * 0.5).toFixed(1)}px)`;
            g.globalAlpha = a; g.drawImage(F.petals[q.k], -q.s / 2, -q.s / 2, q.s, q.s); g.restore();
          }
        } });
        S.focus = { x: 0, y: y0 };
      }, over() { ctx.family.collage.boost.push({ col: [255, 200, 210], a: 0.35, x: 0.5, y: 0.55, r: 0.7 }); } });
    },
  });

  /* ===================================================================== retratos en medallón */
  K.register({
    name: "collage.portraits", tags: ["personas", "protagonistas", "retratos", "líderes"], layer: "main", post: CL.POST,
    summary: "Página de libro con un gran medallón: 2–4 retratos en óvalos viñeteados (virados verde azulado/sepia), adornos rojos y un título en versalitas; la cámara se aleja y gira como al levantar el libro.",
    example: { photo: "assets/media/schabowski.jpg", photo2: "assets/media/mauerspecht.jpg", photo3: "assets/media/muro-gente.jpg", title: "GRANDES BATALLAS, GRANDES LÍDERES" },
    params: { photo: img("Retrato 1.", true), photo2: img("Retrato 2."), photo3: img("Retrato 3."), photo4: img("Retrato superior (opcional)."), title: { type: "string", default: "", doc: "Título en versalitas." }, tones: { type: "array", default: [], doc: "Virados." }, ...common, move: { ...common.move, default: "out" }, speed: { ...common.speed, default: 0.04 } },
    create(ctx, p) {
      const P = ctx.C.palette;
      return CL.scene(ctx, p, { zoom: 1.05, build(S) {
        const { F, portrait } = S, ps = photosOf(p);
        S.add({ x: 0, y: 0, raw: true, z: -0.02, enter: "none", draw(g) {
          g.drawImage(F.paperLight, -1.4, -1.2, 2.8, 2.4);
          const gr = g.createLinearGradient(-1.4, 0, -0.9, 0); gr.addColorStop(0, "rgba(60,35,30,.55)"); gr.addColorStop(1, "rgba(60,35,30,0)"); g.fillStyle = gr; g.fillRect(-1.4, -1.2, 0.5, 2.4);
          g.strokeStyle = "rgba(150,120,110,.45)"; g.lineWidth = 0.004; g.beginPath(); g.ellipse(0, 0.02, portrait ? 0.46 : 0.72, portrait ? 0.86 : 0.48, 0, 0, 7); g.stroke();
          g.globalAlpha *= 0.3; g.fillStyle = "#fff8ef"; g.beginPath(); g.ellipse(0, 0.02, portrait ? 0.45 : 0.7, portrait ? 0.85 : 0.47, 0, 0, 7); g.fill();
        } });
        const n = Math.min(4, Math.max(3, ps.length));
        const pos = portrait ? [[-0.22, 0.08, 0.46], [0.22, 0.08, 0.46], [0, 0.5, 0.42], [0, -0.42, 0.42]] : [[-0.42, 0.12, 0.44], [0, 0.06, 0.48], [0.42, 0.12, 0.44], [0, -0.3, 0.3]];
        for (let i = 0; i < n; i++) {
          const src = ps[i % ps.length], k = card(F, src, { tone: toneOf(p, i, ["teal", "sepia", "bw", "sepia"][i]), ar: 0.82, size: 520, oval: true, shadow: false, zoom: 1 + Math.floor(i / ps.length) * 0.5, focus: [0.5, 0.38] });
          const [x, y, w] = pos[i];
          S.add({ x, y, raw: true, z: 0.01, t0: i * 0.2, enter: i ? "fade" : "none", draw: g => drawCard(g, k, w) });
        }
        S.add({ x: 0, y: portrait ? -0.72 : -0.42, raw: true, z: 0.01, enter: "none", draw(g) {
          for (const sd of [-1, 1]) { g.save(); g.translate(sd * 0.24, 0); g.rotate(sd > 0 ? 0 : Math.PI); g.scale(1, 1); g.strokeStyle = "#a33a4a"; g.fillStyle = "#a33a4a"; g.lineWidth = 0.004; g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(0.04, -0.04, 0.08, 0.03, 0.05, 0.04); g.stroke(); g.beginPath(); g.arc(0.05, 0.035, 0.008, 0, 7); g.fill(); g.restore(); }
        } });
        if (p.title) {
          const maxW = portrait ? 0.85 : 1.1, size = fit("700 {s} Cinzel", p.title, 3.6, maxW);
          S.add({ x: 0, y: portrait ? 0.84 : 0.47, raw: true, z: 0.02, t0: 0.5, enter: "fade", draw: g => txt(g, p.title, 0, 0, { size, weight: 700, font: "Cinzel, serif", color: P.year, spacing: size * 0.08 }) });
        }
        S.focus = { x: 0, y: 0 };
      } });
    },
  });

  /* ===================================================================== emblema 3D */
  /** número/nombre con extrusión dorada que entra girando letra por letra (dibujado en px de dispositivo) */
  function emblem(g, F, o) {
    const { cx, cy, U, lt, text, title, sub, alpha, blur, P } = o;
    if (alpha <= 0.003) return;
    g.save(); g.globalAlpha = alpha; if (blur > 0.3) g.filter = `blur(${blur.toFixed(1)}px)`;
    const chars = [...String(text)], maxW = o.maxW;
    let fs = U * (chars.length <= 4 ? 0.22 : 0.16); g.font = `700 ${fs}px 'Cormorant Garamond', serif`;
    let tw = g.measureText(text).width; if (tw > maxW) { fs *= maxW / tw; g.font = `700 ${fs}px 'Cormorant Garamond', serif`; tw = maxW; }
    const ex = fs * 0.045;
    /* libro abierto de línea, debajo */
    const bw = Math.max(tw * 0.62, U * 0.26), by = cy + fs * 0.32, bq = prog(lt, 0.9, 0.7, "out");
    if (bq > 0) {
      g.save(); g.globalAlpha = alpha * bq; g.strokeStyle = "#b08a4a"; g.lineWidth = U * 0.006;
      for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(cx, by + fs * 0.12); g.quadraticCurveTo(cx + sd * bw * 0.5, by - fs * 0.05, cx + sd * bw, by + fs * 0.06); g.lineTo(cx + sd * bw, by - fs * 0.62); g.stroke(); }
      g.restore();
    }
    let x = cx - tw / 2;
    chars.forEach((ch, i) => {
      const w = g.measureText(ch).width, q = prog(lt, 0.1 + i * 0.12, 1.0, "out"); if (q <= 0) { x += w; return; }
      const ang = (1 - q) * Math.PI * 2.2, sx = Math.cos(ang), sc = 1 + 2.2 * Math.pow(1 - q, 2), dx = (1 - q) * (i % 2 ? 1 : -1) * U * 0.5, dy = -(1 - q) * U * 0.15;
      g.save(); g.translate(x + w / 2 + dx, cy + dy); g.scale(sc * (Math.abs(sx) < 0.04 ? 0.04 : sx), sc); g.globalAlpha = alpha * clamp(q * 3);
      g.textAlign = "center"; g.textBaseline = "alphabetic";
      g.fillStyle = sx > 0 ? "#5c3a14" : "#3b250c";
      for (let k = 6; k >= 1; k--) g.fillText(ch, k * ex * 0.25, k * ex * 0.32);
      const gr = g.createLinearGradient(0, -fs * 0.72, 0, 0); gr.addColorStop(0, sx > 0 ? "#f6e3a8" : "#9a7432"); gr.addColorStop(0.5, sx > 0 ? "#d2a24c" : "#7a5520"); gr.addColorStop(1, sx > 0 ? "#a8752c" : "#5c3a14");
      g.fillStyle = gr; g.fillText(ch, 0, 0);
      g.restore(); x += w;
    });
    /* cinta en arco con el título */
    if (title) {
      const tq = prog(lt, 0.6, 0.6, "out");
      if (tq > 0) {
        const R = Math.max(tw * 0.62, U * 0.3), hh = U * 0.05, acy = cy - fs * 0.86 - hh * 0.5 + R, span = Math.min(1.25, (Math.max(tw, U * 0.3) * 0.95) / R);
        g.save(); g.globalAlpha = alpha * tq;
        g.lineWidth = hh; g.strokeStyle = P.accent || "#9e2f4f"; g.beginPath(); g.arc(cx, acy, R, -Math.PI / 2 - span / 2, -Math.PI / 2 + span / 2); g.stroke();
        g.lineWidth = U * 0.002; g.strokeStyle = "rgba(255,220,225,.8)"; for (const d of [-hh * 0.38, hh * 0.38]) { g.beginPath(); g.arc(cx, acy, R + d, -Math.PI / 2 - span / 2, -Math.PI / 2 + span / 2); g.stroke(); }
        let ffs = hh * 0.55; g.font = `700 ${ffs}px Cinzel, serif`; const tt = String(title), tlen = g.measureText(tt).width;
        if (tlen > R * span * 0.92) { ffs *= R * span * 0.92 / tlen; g.font = `700 ${ffs}px Cinzel, serif`; }
        g.fillStyle = "#fff3ef"; g.textAlign = "center"; g.textBaseline = "middle";
        let a = -Math.PI / 2 - g.measureText(tt).width / R / 2;
        for (const c of tt) { const cw = g.measureText(c).width; a += cw / R / 2; g.save(); g.translate(cx + Math.cos(a) * R, acy + Math.sin(a) * R); g.rotate(a + Math.PI / 2); g.fillText(c, 0, 0); g.restore(); a += cw / R / 2; }
        g.restore();
      }
    }
    if (sub) {
      const sq = prog(lt, 1.3, 0.6); g.save(); g.globalAlpha = alpha * sq; g.textAlign = "center"; g.textBaseline = "alphabetic";
      const lines = String(sub).split("\n"); lines.forEach((l, i) => { g.font = i ? `600 ${U * 0.022}px 'Cormorant Garamond', serif` : `700 ${U * 0.03}px Cinzel, serif`; g.fillStyle = i ? "#6a5a5e" : "#5a3a40"; g.letterSpacing = `${U * (i ? 0.002 : 0.006)}px`; g.fillText(l, cx, by + fs * 0.32 + U * (0.012 + i * 0.045)); });
      g.restore();
    }
    g.restore();
  }
  /** fondo del emblema: cielo nublado desenfocado → blanco suave */
  function emblemBg(g, F, W, H, lt, white) {
    g.fillStyle = "#0f1a1f"; g.fillRect(0, 0, W, H);
    const z = 1.25 + lt * 0.02, sw = W * z, sh = Math.max(H, W * 9 / 16) * z;
    g.save(); g.filter = `blur(${(Math.min(W, H) * 0.006).toFixed(1)}px)`; g.drawImage(F.skyDark, (W - sw) / 2 + lt * W * 0.01, (H - sh) / 2, sw, sh); g.restore();
    g.globalCompositeOperation = "screen"; g.fillStyle = "rgba(60,95,110,.55)"; g.fillRect(0, 0, W, H); g.globalCompositeOperation = "source-over";
    if (white > 0) {
      const gr = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7); gr.addColorStop(0, `rgba(246,244,242,${white})`); gr.addColorStop(0.6, `rgba(232,228,226,${white})`); gr.addColorStop(1, `rgba(176,170,172,${white})`);
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
    }
  }
  K.register({
    name: "collage.emblem", tags: ["cierre", "emblema", "aniversario", "cifra"], layer: "main", post: CL.POST,
    summary: "Emblema conmemorativo: sobre cielo desenfocado, un número/año dorado en 3D entra girando letra por letra, cinta bordó en arco con el título, libro abierto de línea y bajada; el fondo se aclara a blanco.",
    example: { number: "1989", title: "DE INMEDIATO", sub: "SIN DEMORA\nBerlín · 9 de noviembre" },
    params: { number: { type: "string", required: true, doc: "Número/año/palabra corta en 3D." }, title: { type: "string", default: "", doc: "Texto de la cinta en arco." }, sub: { type: "string", default: "", doc: "Bajada ('\\n' = segundo renglón)." }, white: { type: "bool", default: true, doc: "El fondo se aclara a blanco." }, tin: { ...common.tin, default: "flip" } },
    create(ctx, p) {
      const F = ctx.family.collage, { W, H } = ctx.stage, dpr = ctx.dpr, U = Math.min(W, H) * dpr, P = ctx.C.palette;
      return CL.scene(ctx, p, { grade: 0.2, dof: 0.4, leak: 0.3, vig: 0.6, paint(g, cam, lt) {
        const Wd = W * dpr, Hd = H * dpr, wh = p.white ? prog(lt, 1.2, 1.1, "inOut") : 0;
        emblemBg(g, F, Wd, Hd, lt, wh);
        emblem(g, F, { cx: Wd / 2, cy: Hd * 0.53, U, lt, text: p.number, title: p.title, sub: p.sub, alpha: 1, blur: 0, P, maxW: Wd * 0.8 });
      } });
    },
  });

  /* ===================================================================== destello / fuga de luz (overlay) */
  K.register({
    name: "collage.leak", tags: ["transición", "golpe", "luz", "énfasis"], layer: "overlay", post: 0,
    summary: "Cortina de luz cálida (fuga de película) que barre el cuadro para marcar un golpe o una frase clave. Se suma a la lente global (modo pantalla).",
    example: { color: "warm", strength: 0.9 },
    params: { color: { type: "enum", options: ["warm", "pink", "red", "white"], default: "warm", doc: "Color de la luz." }, strength: { type: "number", default: 0.85, min: 0, max: 1, doc: "Intensidad." } },
    create(ctx, p) {
      const F = ctx.family.collage, col = { warm: [255, 170, 110], pink: [255, 120, 190], red: [255, 70, 60], white: [255, 248, 240] }[p.color];
      return { render(lt, b) {
        const q = clamp(lt / Math.max(0.3, b.dur)), a = p.strength * Math.sin(Math.PI * q);
        F.boost.push({ col, a, x: lerp(-0.1, 1.1, q), y: 0.45, r: 0.9 }, { col: [255, 250, 240], a: a * 0.5, x: lerp(-0.1, 1.1, q), y: 0.5, r: 0.4 });
      } };
    },
  });
})();
