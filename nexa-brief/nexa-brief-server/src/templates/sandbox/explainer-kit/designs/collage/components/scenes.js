/* =============================================================================
   collage · planos principales: apertura, collage, fecha, banda, titular, mapa, paneles
   Todos comparten la placa con cámara de Kit.collage.scene (transición de entrada `tin`,
   movimiento `move`) y la lente global de la familia.
   ========================================================================== */
(function () {
  "use strict";
  const K = window.Kit, CL = K.collage, { clamp, lerp, prog, ease } = K;
  const { card, drawCard, cardH, clipping, txt, measure, yearItem, filler, common, toned, crop, mk, coin, stamp } = CL;
  const PH = { photo: "", photo2: "", photo3: "", photo4: "", photo5: "" };
  const photoParams = n => Object.fromEntries(Object.keys(PH).slice(0, n).map((k, i) => [k, { type: "image", default: "", required: i === 0, doc: i === 0 ? "Foto principal." : `Foto ${i + 1} (opcional; si falta se repiten las anteriores con otro encuadre).` }]));
  const photosOf = p => Object.keys(PH).map(k => p[k]).filter(Boolean);
  const TONES_CYCLE = ["bw", "teal", "rose", "sepia", "color"];
  const toneOf = (p, i, def) => (Array.isArray(p.tones) && p.tones.length ? p.tones[i % p.tones.length] : def);
  /** ancho (unidades) de un texto en `size` (centésimas) */
  const wOf = (font, s, size) => measure(font.replace("{s}", "100px"), s) / 100 * size / 100;
  const fit = (font, s, size, maxW) => Math.min(size, size * maxW / Math.max(1e-6, wOf(font, s, size)));

  /* ===================================================================== collage (el plano tipo) */
  const LAYOUTS = {
    /* [x, y, ancho, proporción, rot, z, tono] en coordenadas 16:9 (alto = 1) */
    hero: { s: [[0.06, 0.0, 0.94, 1.5, -0.012, 0, "bw"], [-0.66, -0.3, 0.34, 0.8, 0.03, 0.03, "teal"], [0.72, 0.3, 0.38, 1.3, -0.03, 0.04, "rose"]], year: [0.3, -0.36], clip: [-0.56, 0.34] },
    duo: { s: [[-0.36, -0.03, 0.68, 1.4, -0.015, 0, "bw"], [0.42, 0.1, 0.52, 1.25, 0.02, 0.02, "teal"]], year: [0.18, -0.36], clip: [-0.62, 0.36] },
    trio: { s: [[0.02, 0.04, 1.0, 1.55, 0, -0.01, "rose"], [-0.64, -0.14, 0.38, 0.78, 0.0, 0.03, "teal"], [0.66, 0.02, 0.42, 0.9, 0.01, 0.03, "bw"]], year: [0.36, -0.36], clip: [-0.2, 0.4] },
    quad: { s: [[-0.42, -0.21, 0.62, 1.45, -0.01, 0, "bw"], [0.37, -0.26, 0.46, 1.3, 0.012, 0.01, "teal"], [0.35, 0.24, 0.56, 1.5, -0.008, 0.02, "bw"], [-0.45, 0.3, 0.5, 1.5, 0.01, 0.01, "rose"]], year: [-0.08, -0.43], clip: [-0.05, 0.05] },
    scatter: { s: [[-0.6, -0.22, 0.44, 1.3, -0.05, 0, "bw"], [0.04, -0.28, 0.4, 0.8, 0.03, 0.01, "teal"], [0.6, -0.16, 0.46, 1.4, 0.04, 0.02, "sepia"], [-0.28, 0.27, 0.52, 1.5, 0.02, 0.03, "rose"], [0.46, 0.31, 0.44, 1.3, -0.03, 0.04, "color"]], year: [-0.2, -0.05], clip: [0.05, 0.12] },
    strip: { s: [[-0.6, -0.1, 0.52, 1.3, -0.02, 0, "bw"], [0.0, -0.06, 0.52, 1.3, 0.01, 0.01, "teal"], [0.6, -0.11, 0.52, 1.3, -0.01, 0.02, "rose"]], year: [0.5, -0.42], clip: [-0.1, 0.36] },
  };
  /** construye un collage estándar en S (fotos por layout + año + recorte con titular + relleno) */
  function board(S, p, layout, o = {}) {
    const { F, r, pk } = S, ps = photosOf(p), L = LAYOUTS[layout] || LAYOUTS.trio;
    filler(S, p.density ?? 14);
    if (!ps.length) return;
    L.s.forEach((sl, i) => {
      const [x, y, w0, ar, rot, z, tone0] = sl, src = ps[i % ps.length], rep = Math.floor(i / ps.length), w = w0 * pk;
      const opt = { tone: toneOf(p, i, tone0), ar, size: i === 0 ? 900 : 560, focus: [0.5 + (rep ? (r() - 0.5) * 0.5 : 0), 0.45], zoom: 1 + rep * 0.45 };
      const enter = i === 0 ? "none" : (p.appear || "slide"), t0 = i === 0 ? 0 : 0.35 + (i - 1) * (p.stagger ?? 0.5);
      if (i === 0 && p.swap && ps.length > 1) {
        const ks = ps.map((s2, j) => card(F, s2, { ...opt, focus: [0.5, 0.42], zoom: 1 + (j % 2) * 0.15 })), every = p.swapEvery || 1.6;
        S.add({ x, y, rot, z, enter: "none", draw(g, lt) {
          const k = Math.max(0, (lt - 0.6) / every), i0 = Math.floor(k) % ks.length, fr = clamp((k - Math.floor(k)) * every / 0.35);
          drawCard(g, ks[i0], w);
          if (k >= 1 && fr < 1) { g.globalAlpha *= 1 - fr; drawCard(g, ks[(i0 + ks.length - 1) % ks.length], w); }
        } });
      } else {
        const k = card(F, src, opt);
        S.add({ x, y, rot, z, enter, t0, sdx: Math.sign(x || 1) * 0.45, draw: g => drawCard(g, k, w) });
      }
    });
    if (p.year) yearItem(S, p, { x: (o.year || L.year)[0], y: (o.year || L.year)[1], text: p.year, small: p.yearSmall, from: p.yearFrom, t0: 0.5 });
    if (p.headline) {
      const [cx, cy] = o.clip || L.clip, w = 0.56 * pk, k = clipping(F, { seed: 7 + S.ctx.beat.i, w: 620, h: 300, title: p.headline, red: true, cols: 3, titleSize: 620 * 0.072 });
      const it = S.add({ x: cx, y: cy, z: 0.05, rot: (r() - 0.5) * 0.03, t0: 0.25, enter: "slide", sdy: 0.4, sdx: 0, draw: g => drawCard(g, k, w) });
      S.focus = { x: it.x - w * 0.15, y: it.y - cardH(k, w) * 0.3 };
    }
    if (p.coins !== false) {
      const k = coin(F, 5 + S.ctx.beat.i, p.year && /^\d{4}$/.test(p.year) ? p.year : "1989"), [cx, cy] = [(r() < 0.5 ? -1 : 1) * (0.72 + r() * 0.12), 0.38 + r() * 0.06];
      S.add({ x: cx, y: cy, z: 0.08, rot: r() * 6, t0: 0.9, enter: "drop", draw: g => drawCard(g, k, 0.11) });
    }
  }
  const boardParams = {
    ...photoParams(5),
    layout: { type: "enum", options: Object.keys(LAYOUTS), default: "trio", doc: "Disposición: hero (una foto grande + 2 chicas), duo, trio (foto de fondo + 2 retratos a los lados), quad, scatter (5 fotos), strip (3 en fila)." },
    tones: { type: "array", default: [], doc: "Virado por foto: bw, teal, rose, sepia, color, red (vacío = el del layout)." },
    year: { type: "string", default: "", doc: "Año en serif bordó (p. ej. '1961')." },
    yearSmall: { type: "string", default: "", doc: "Fecha chica sobre el año ('13.08')." },
    yearFrom: { type: "number", default: null, doc: "Si se da, el año cuenta desde este valor hasta `year`." },
    headline: { type: "string", default: "", doc: "Titular de un recorte de periódico (texto propio)." },
    swap: { type: "bool", default: false, doc: "La foto principal va cambiando entre las fotos del plano (fundido)." },
    swapEvery: { type: "number", default: 1.6, doc: "Segundos entre cambios de foto." },
    appear: { type: "enum", options: ["slide", "drop", "fade", "pop"], default: "slide", doc: "Entrada de las fotos secundarias." },
    stagger: { type: "number", default: 0.5, doc: "Segundos entre entradas de fotos." },
    density: { type: "number", default: 14, min: 0, max: 40, doc: "Recortes de relleno alrededor." },
    coins: { type: "bool", default: true, doc: "Moneda dorada que cae sobre la mesa." },
    ...common,
  };
  K.register({
    name: "collage.board", tags: ["foto", "collage", "archivo", "año"], layer: "main", post: CL.POST,
    summary: "El plano tipo: mesa de papel de diario con fotos de borde blanco viradas (B/N, verde azulado, rosa, sepia), recortes, sellos y moneda; año en serif bordó con fecha chica; recorte con titular opcional. La cámara se desliza (move) con paralaje y las fotos secundarias entran escalonadas.",
    example: { photo: "assets/media/mauerbau.jpg", photo2: "assets/media/leipzig.jpg", layout: "trio", year: "1961", yearSmall: "13.08", headline: "SE LEVANTA EL MURO" },
    params: boardParams,
    create(ctx, p) { return CL.scene(ctx, p, { build: S => board(S, p, p.layout) }); },
  });

  /* ===================================================================== fecha grande */
  K.register({
    name: "collage.date", tags: ["fecha", "año", "cifra", "contador"], layer: "main", post: CL.POST,
    summary: "Fecha/cifra protagonista: número grande en serif bordó (cuenta desde `from` si se da) con fecha chica arriba y una línea en versalitas debajo, sobre el collage con 2 fotos que entran por el costado.",
    example: { text: "1989", from: 1961, small: "28 AÑOS", kicker: "UNA CIUDAD PARTIDA EN DOS", photo: "assets/media/mauerbau.jpg", photo2: "assets/media/muro-gente.jpg" },
    params: {
      text: { type: "string", required: true, doc: "Cifra/fecha grande ('1989', '23:30', '10 NOV')." },
      from: { type: "number", default: null, doc: "Si `text` es un número: cuenta desde este valor." },
      count: { type: "number", default: 1.8, doc: "Segundos que dura la cuenta." },
      small: { type: "string", default: "", doc: "Fecha/etiqueta chica arriba." },
      kicker: { type: "string", default: "", doc: "Línea en versalitas debajo." },
      ...photoParams(3), tones: boardParams.tones, density: boardParams.density, ...common,
    },
    create(ctx, p) {
      return CL.scene(ctx, p, { build(S) {
        const { F, pk, portrait } = S, ps = photosOf(p);
        filler(S, p.density ?? 14);
        [[0.52, -0.12, 0.62, 1.4, 0.02, "bw"], [0.66, 0.3, 0.46, 1.3, -0.03, "teal"], [-0.05, -0.36, 0.3, 1.3, 0.03, "rose"]].forEach(([x, y, w, ar, rot, tone], i) => {
          if (!ps.length) return; const k = card(F, ps[i % ps.length], { tone: toneOf(p, i, tone), ar, size: 620, zoom: 1 + Math.floor(i / ps.length) * 0.4 });
          S.add({ x, y, rot, z: 0.01 * i, t0: i ? 0.4 + i * 0.4 : 0, enter: i ? "slide" : "none", sdx: 0.5, draw: g => drawCard(g, k, w * pk) });
        });
        const col = ctx.C.palette.year, num = /^\d+$/.test(p.text) && p.from != null;
        const [x, y] = portrait ? [0, -0.52] : [-0.42, 0.02];
        const maxW = portrait ? 0.9 : 0.85, font = "600 {s} 'Cormorant Garamond'";
        const size = fit(font, p.text, 17, maxW);
        S.add({ x, y, raw: true, z: 0.06, t0: 0.2, din: 0.8, enter: "fade", draw(g, lt) {
          const s = num ? String(Math.round(lerp(+p.from, +p.text, prog(lt, 0.5, p.count, "inOut")))) : p.text;
          const gw = maxW * 0.62, gr = g.createRadialGradient(0, -size * 0.003, 0, 0, -size * 0.003, gw); gr.addColorStop(0, "rgba(240,228,220,.85)"); gr.addColorStop(0.6, "rgba(240,228,220,.55)"); gr.addColorStop(1, "rgba(240,228,220,0)");
          g.save(); g.scale(1, 0.62); g.fillStyle = gr; g.fillRect(-gw, -gw - size * 0.005, gw * 2, gw * 2); g.restore();
          txt(g, s, 0, 0, { size, weight: 600, color: col, shadow: "rgba(250,240,230,.6)", blur: 3 });
          if (p.small) txt(g, p.small, 0, -size * 0.0085, { size: size * 0.24, weight: 700, color: col, spacing: 0.4 });
          if (p.kicker) txt(g, p.kicker, 0, size * 0.0042, { size: Math.min(size * 0.17, fit("700 {s} Cinzel", p.kicker, 3.2, maxW * 0.82)), weight: 700, font: "Cinzel, serif", color: "#2f2433", spacing: 0.3 });
        } });
        S.focus = { x, y: y - size * 0.003 };
      } });
    },
  });

  /* ===================================================================== banda con titular */
  K.register({
    name: "collage.banner", tags: ["titular", "banda", "cita", "frase"], layer: "main", post: CL.POST,
    summary: "Banda oscura translúcida que cruza el collage con un titular en serif romana mayúscula (como 'GLUBB PASHA FLIES HOME'), retrato pequeño al final de la banda y fotos debajo; cámara en diagonal.",
    example: { text: "HORMIGÓN Y ALAMBRE", photo: "assets/media/mauerbau.jpg", photo2: "assets/media/bornholmer.jpg", photo3: "assets/media/muro-gente.jpg" },
    params: { text: { type: "string", required: true, doc: "Titular (mayúsculas; '\\n' parte en 9:16)." }, year: { type: "string", default: "", doc: "Año bordó junto a la foto inferior." }, ...photoParams(3), tones: boardParams.tones, density: boardParams.density, ...common, move: { ...common.move, default: "diag" } },
    create(ctx, p) {
      return CL.scene(ctx, p, { build(S) {
        const { F, pk, portrait, r } = S, ps = photosOf(p), P = ctx.C.palette;
        filler(S, p.density ?? 14);
        if (ps.length) {
          const ks = [card(F, ps[0], { tone: toneOf(p, 0, "color"), ar: 0.85, size: 420, border: 0.03 }), card(F, ps[1 % ps.length], { tone: toneOf(p, 1, "bw"), ar: 1.45, size: 760, line: true, zoom: ps.length < 2 ? 1.5 : 1 }), card(F, ps[2 % ps.length], { tone: toneOf(p, 2, "teal"), ar: 1.2, size: 560, zoom: ps.length < 3 ? 1.4 : 1, focus: [0.3, 0.5] })];
          const pos = portrait ? [[0.3, -0.33, 0.3], [-0.04, 0.16, 0.84], [0.2, 0.64, 0.6]] : [[0.66, -0.22, 0.28], [-0.12, 0.22, 0.7], [0.62, 0.26, 0.48]];
          pos.forEach(([x, y, w], i) => S.add({ x, y, raw: true, z: i === 0 ? 0.03 : 0.01, rot: (r() - 0.5) * 0.03, t0: i === 2 ? 0.7 : 0, enter: i === 2 ? "slide" : "none", sdx: 0.4, draw: g => drawCard(g, ks[i], w * (i ? pk : 1)) }));
        }
        let lines = portrait ? String(p.text).split("\n") : [String(p.text).replace(/\n/g, " ")];
        if (portrait && lines.length === 1 && lines[0].split(" ").length > 2 && fit("700 {s} Cinzel", lines[0], 6.4, 0.8) < 5) { const ws = lines[0].split(" "); let best = 1, bd = 1e9; for (let i = 1; i < ws.length; i++) { const d = Math.abs(ws.slice(0, i).join(" ").length - ws.slice(i).join(" ").length); if (d < bd) { bd = d; best = i; } } lines = [ws.slice(0, best).join(" "), ws.slice(best).join(" ")]; }
        const font = "700 {s} Cinzel", maxW = portrait ? 0.8 : 1.15, size = Math.min(...lines.map(l => fit(font, l, 6.4, maxW)));
        const bh = (size * 1.55 * lines.length + 2) / 100, by = portrait ? -0.62 : -0.26, bx1 = portrait ? 0.42 : 0.5;
        S.add({ x: 0, y: by, raw: true, z: 0.02, enter: "none", draw(g) {
          g.fillStyle = P.band || "rgba(46,34,50,.88)"; g.fillRect(-2.6, -bh / 2, 2.6 + bx1, bh);
          g.fillStyle = "rgba(255,240,240,.08)"; g.fillRect(-2.6, -bh / 2, 2.6 + bx1, 0.004);
          lines.forEach((l, i) => txt(g, l, bx1 - 0.03, (i - (lines.length - 1) / 2) * size * 0.0135 + size * 0.0036, { size, weight: 700, font: "Cinzel, serif", color: P.bandInk || "#f6e8e2", align: "right", spacing: size * 0.04, shadow: "rgba(0,0,0,.35)", blur: 0.5 }));
        } });
        if (p.year) yearItem(S, p, { x: portrait ? -0.3 : -0.48, y: portrait ? -0.32 : -0.08, text: p.year, t0: 0.6 });
        S.focus = { x: bx1 - 0.3, y: by };
      } });
    },
  });

  /* ===================================================================== titular de periódico (y zambullida) */
  K.register({
    name: "collage.headline", tags: ["titular", "periódico", "frase", "énfasis"], layer: "main", post: CL.POST,
    summary: "Página de diario en primer plano: foto grande con filete, bajada en itálica, regla y titular grande en serif negra bordó; foto rosada desenfocada al costado. Pensado para salir con el plano siguiente en tin:'dive' (la cámara se zambulle en el titular).",
    example: { photo: "assets/media/schabowski.jpg", kicker: "AL FINAL DE LA CONFERENCIA", text: "LO LEYÓ TAL CUAL" },
    params: { text: { type: "string", required: true, doc: "Titular ('\\n' para partir)." }, kicker: { type: "string", default: "", doc: "Bajada en itálica sobre el titular." }, ...photoParams(2), tones: boardParams.tones, ...common, move: { ...common.move, default: "in" }, speed: { ...common.speed, default: 0.03 } },
    create(ctx, p) {
      return CL.scene(ctx, p, { build(S) {
        const { F, portrait, r } = S, ps = photosOf(p), P = ctx.C.palette;
        filler(S, 10, { ext: [1.4, 0.95] });
        S.add({ x: 0, y: 0, raw: true, z: -0.01, enter: "none", draw(g) { g.globalAlpha *= 0.92; g.drawImage(F.paperLight, -1.1, -0.95, 2.2, 1.9); } });
        if (ps.length > 0) {
          const k2 = card(F, ps[1 % ps.length], { tone: toneOf(p, 1, "red"), ar: 0.7, size: 520, border: 0, zoom: ps.length < 2 ? 1.6 : 1, focus: [0.4, 0.5] });
          S.add(portrait ? { x: 0.42, y: -0.75, raw: true, z: 0.25, w: 0.5, draw: g => drawCard(g, k2, 0.5) } : { x: 0.86, y: 0.14, raw: true, z: 0.25, draw: g => drawCard(g, k2, 0.6) });
          const k = card(F, ps[0], { tone: toneOf(p, 0, "bw"), ar: portrait ? 1.1 : 1.75, size: 980, border: 0.02, line: true });
          const [x, y, w] = portrait ? [0, -0.3, 0.86] : [-0.12, -0.19, 0.86];
          S.add({ x, y, raw: true, enter: "none", draw: g => drawCard(g, k, w) });
        }
        const lines = String(p.text).split("\n"), font = "800 {s} 'Playfair Display'", maxW = portrait ? 0.86 : 1.0, size = Math.min(...lines.map(l => fit(font, l, portrait ? 8 : 6.2, maxW)));
        const ky = portrait ? 0.2 : 0.14, hy = ky + 0.075, cx = portrait ? 0 : -0.12;
        S.add({ x: cx, y: ky, raw: true, z: 0.01, t0: 0.2, enter: "fade", draw(g) {
          if (p.kicker) txt(g, p.kicker, 0, 0, { size: Math.min(3, fit("italic 400 {s} 'Old Standard TT'", p.kicker, 3, maxW)), weight: 400, style: "italic", font: "'Old Standard TT', serif", color: "#3a2c30" });
          g.fillStyle = "rgba(45,30,35,.7)"; g.fillRect(-maxW / 2, 0.022, maxW, 0.003);
          lines.forEach((l, i) => txt(g, l, 0, 0.075 + i * size * 0.0118 + size * 0.004, { size, weight: 800, font: "'Playfair Display', serif", color: P.headline || "#5e1a22" }));
        } });
        S.focus = { x: cx + (portrait ? 0 : -0.05), y: hy + size * 0.002 };
      } });
    },
  });

  /* ===================================================================== mapa antiguo */
  function makeMap(F, seed, places, title, portrait) {
    const key = "map|" + seed + "|" + places.join(",") + "|" + title + portrait; if (F.cache.has(key)) return F.cache.get(key);
    const Wm = 2048, Hm = 1400, c = mk(Wm, Hm), g = c.getContext("2d"), r = K.rng(seed);
    g.drawImage(F.paperLight, 0, 0, Wm, Hm);
    const n = CL.noise(256, 176, seed, 5, 2), lc = mk(256, 176), lg = lc.getContext("2d"), id = lg.createImageData(256, 176);
    for (let i = 0; i < n.length; i++) { const v = n[i] + (i % 256) / 256 * 0.25 - (Math.floor(i / 256) / 176) * 0.2, sea = v < 0.42; id.data[i * 4] = sea ? 150 : 0; id.data[i * 4 + 1] = sea ? 196 : 0; id.data[i * 4 + 2] = sea ? 196 : 0; id.data[i * 4 + 3] = sea ? 120 + (0.42 - v) * 300 : 0; }
    lg.putImageData(id, 0, 0); g.imageSmoothingQuality = "high"; g.drawImage(lc, 0, 0, Wm, Hm);
    /* costa: contorno del umbral, trazado como puntos densos */
    g.fillStyle = "rgba(40,45,55,.75)";
    for (let y = 1; y < 175; y++) for (let x = 1; x < 255; x++) { const a = n[y * 256 + x] + x / 256 * 0.25 - y / 176 * 0.2 < 0.42, b = n[y * 256 + x + 1] + (x + 1) / 256 * 0.25 - y / 176 * 0.2 < 0.42, d = n[(y + 1) * 256 + x] + x / 256 * 0.25 - (y + 1) / 176 * 0.2 < 0.42; if (a !== b || a !== d) g.fillRect(x * 8, y * 7.95, 7, 3); }
    /* retícula, ríos y fronteras punteadas */
    g.strokeStyle = "rgba(60,70,80,.18)"; g.lineWidth = 2;
    for (let x = 0; x < Wm; x += 256) { g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + 40, Hm / 2, x, Hm); g.stroke(); }
    for (let y = 0; y < Hm; y += 230) { g.beginPath(); g.moveTo(0, y); g.quadraticCurveTo(Wm / 2, y - 40, Wm, y); g.stroke(); }
    g.strokeStyle = "rgba(70,90,110,.45)"; g.lineWidth = 2.5;
    for (let i = 0; i < 7; i++) { let x = r() * Wm, y = r() * Hm; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 18; k++) { x += (r() - 0.3) * 60; y += (r() - 0.5) * 60; g.lineTo(x, y); } g.stroke(); }
    g.setLineDash([14, 8, 3, 8]); g.strokeStyle = "rgba(120,50,60,.45)"; g.lineWidth = 3;
    for (let i = 0; i < 5; i++) { let x = r() * Wm, y = r() * Hm; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 10; k++) { x += (r() - 0.5) * 220; y += (r() - 0.5) * 220; g.lineTo(x, y); } g.stroke(); }
    g.setLineDash([]);
    /* nombres de relleno + título grande espaciado */
    g.fillStyle = "rgba(40,40,50,.55)"; g.font = "italic 400 26px 'Old Standard TT', serif";
    for (let i = 0; i < 26; i++) g.fillText(F.words[Math.floor(r() * F.words.length)].replace(/^./, m => m.toUpperCase()), r() * Wm, r() * Hm);
    if (title) { g.save(); g.translate(Wm * 0.32, Hm * 0.2); g.rotate(-0.25); g.font = "700 64px Cinzel, serif"; g.letterSpacing = "26px"; g.fillStyle = "rgba(40,60,70,.5)"; g.fillText(title, 0, 0); g.restore(); }
    /* lugares: en una diagonal con dispersión */
    const pts = places.map((name, i) => { const q = places.length > 1 ? i / (places.length - 1) : 0.5; return { name, x: lerp(0.24, 0.66, q) + (r() - 0.5) * 0.18, y: lerp(0.3, 0.72, (i * 0.618) % 1) }; });
    for (const pt of pts) {
      g.fillStyle = "#3b2b30"; g.beginPath(); g.arc(pt.x * Wm, pt.y * Hm, 9, 0, 7); g.fill(); g.strokeStyle = "#3b2b30"; g.lineWidth = 2; g.beginPath(); g.arc(pt.x * Wm, pt.y * Hm, 15, 0, 7); g.stroke();
      g.font = "700 40px 'Old Standard TT', serif"; g.letterSpacing = "3px"; g.fillText(pt.name.toUpperCase(), pt.x * Wm + 24, pt.y * Hm - 14);
    }
    const out = { c, pts }; CL.cput(F, key, out); return out;
  }
  K.register({
    name: "collage.map", tags: ["mapa", "lugar", "ruta", "geografía"], layer: "main", post: CL.POST,
    summary: "Mapa antiguo (costas, retícula, ríos, fronteras punteadas) con lugares rotulados y rutas rojas que se trazan solas; foto recortada de bordes suaves encima (paralaje) y una lupa de bronce que recorre el mapa.",
    example: { places: ["Leipzig", "Praga", "Budapest", "Viena"], title: "EUROPA CENTRAL", photo: "assets/media/leipzig.jpg" },
    params: {
      places: { type: "array", default: ["Berlín", "Praga", "Viena"], doc: "Nombres de lugares (2–6), de izquierda a derecha." },
      routes: { type: "array", default: [], doc: "Rutas [[desde,hasta],…] por índice (vacío = encadenar en orden)." },
      title: { type: "string", default: "", doc: "Nombre de región grande y espaciado." },
      lens: { type: "bool", default: true, doc: "Lupa que recorre el mapa." },
      year: { type: "string", default: "", doc: "Año bordó." },
      photo: { type: "image", default: "", doc: "Foto recortada sobre el mapa (opcional)." },
      tones: boardParams.tones, ...common, move: { ...common.move, default: "drift" },
    },
    create(ctx, p) {
      const F = ctx.family.collage, portrait = ctx.stage.portrait;
      const M = makeMap(F, 40 + ctx.beat.i, p.places || [], p.title, portrait);
      const MW = portrait ? 2.9 : 2.4, MH = MW * 1400 / 2048;
      const P = pt => [(pt.x - 0.5) * MW, (pt.y - 0.5) * MH];
      const routes = (p.routes && p.routes.length ? p.routes : M.pts.slice(1).map((_, i) => [i, i + 1])).filter(([a, b]) => M.pts[a] && M.pts[b]);
      return CL.scene(ctx, p, { cam0: [0, 0], build(S) {
        const drawMap = g => g.drawImage(M.c, -MW / 2, -MH / 2, MW, MH);
        S.add({ x: 0, y: 0, raw: true, z: -0.02, enter: "none", draw: drawMap });
        S.add({ x: 0, y: 0, raw: true, z: -0.02, enter: "none", draw(g, lt) {
          g.strokeStyle = "#b8303f"; g.fillStyle = "#b8303f"; g.lineWidth = 0.008; g.lineCap = "round";
          routes.forEach(([a, b], i) => {
            const q = prog(lt, 0.5 + i * 0.55, 1.0, "inOut"); if (q <= 0) return;
            const [x0, y0] = P(M.pts[a]), [x1, y1] = P(M.pts[b]), mx = (x0 + x1) / 2 + (y1 - y0) * 0.25, my = (y0 + y1) / 2 - (x1 - x0) * 0.25;
            g.beginPath(); let px = x0, py = y0; g.moveTo(x0, y0);
            for (let k = 1; k <= 40 * q; k++) { const s = k / 40; px = (1 - s) * (1 - s) * x0 + 2 * (1 - s) * s * mx + s * s * x1; py = (1 - s) * (1 - s) * y0 + 2 * (1 - s) * s * my + s * s * y1; g.lineTo(px, py); }
            g.stroke();
            if (q >= 1) { const an = Math.atan2(y1 - my, x1 - mx); g.save(); g.translate(x1, y1); g.rotate(an); g.beginPath(); g.moveTo(0.004, 0); g.lineTo(-0.03, -0.016); g.lineTo(-0.03, 0.016); g.closePath(); g.fill(); g.restore(); }
          });
        } });
        if (p.photo) {
          const k = card(F, p.photo, { tone: toneOf(p, 0, "color"), border: 0, shadow: false, cut: true, size: 720 });
          S.add(portrait ? { x: 0, y: 0.55, raw: true, z: 0.22, t0: 0.3, enter: "slide", sdx: 0, sdy: 0.5, draw: g => drawCard(g, k, 0.95) } : { x: 0.5, y: 0.12, raw: true, z: 0.22, t0: 0.3, enter: "slide", sdx: 0.5, draw: g => drawCard(g, k, 0.9) });
        }
        if (p.year) yearItem(S, p, { x: portrait ? -0.38 : -0.78, y: portrait ? -0.7 : -0.38, text: p.year, t0: 0.5 });
        if (p.lens) {
          const b0 = ctx.beat, Tt = b0.dur + CL.POST;
          S.add({ x: 0, y: 0, raw: true, z: 0.12, t0: 0.2, enter: "fade", draw(g, lt) {
            const q = clamp(lt / Tt), [ax, ay] = portrait ? [-0.2, 0.15] : [-0.62, 0.3], [bx, by] = portrait ? [0.15, -0.4] : [-0.18, -0.05];
            const x = lerp(ax, bx, ease.inOut(q)), y = lerp(ay, by, ease.inOut(q)), R = 0.17;
            g.save(); g.beginPath(); g.arc(x, y, R, 0, 7); g.clip();
            g.translate(x, y); g.scale(1.7, 1.7); g.translate(-x, -y); drawMap(g); g.restore();
            const gl = g.createRadialGradient(x - R * 0.4, y - R * 0.4, 0, x, y, R); gl.addColorStop(0, "rgba(255,255,255,.28)"); gl.addColorStop(0.6, "rgba(255,255,255,0)"); gl.addColorStop(1, "rgba(30,40,40,.25)");
            g.fillStyle = gl; g.beginPath(); g.arc(x, y, R, 0, 7); g.fill();
            const rim = g.createLinearGradient(x - R, y - R, x + R, y + R); rim.addColorStop(0, "#e8d08e"); rim.addColorStop(0.5, "#7a5a22"); rim.addColorStop(1, "#c8a55a");
            g.strokeStyle = rim; g.lineWidth = 0.022; g.beginPath(); g.arc(x, y, R + 0.011, 0, 7); g.stroke();
            g.strokeStyle = "rgba(40,25,10,.5)"; g.lineWidth = 0.003; g.beginPath(); g.arc(x, y, R, 0, 7); g.stroke();
          } });
        }
        S.focus = { x: 0, y: 0 };
      } });
    },
  });

  /* ===================================================================== paneles de color */
  const PANEL_COLORS = ["#8c6f9c", "#6f99a6", "#d4b06c", "#9cae6a"];
  function panel(F, o) {
    const key = "panel|" + JSON.stringify(o); if (F.cache.has(key)) return F.cache.get(key);
    const iw = o.w, ih = o.h, pad = Math.round(iw * 0.05), c = mk(iw + pad * 2, ih + pad * 2), g = c.getContext("2d"), r = K.rng(o.seed);
    g.save(); g.shadowColor = "rgba(30,15,20,.45)"; g.shadowBlur = pad * 0.6; g.shadowOffsetY = pad * 0.2; g.fillStyle = o.color; g.fillRect(pad, pad, iw, ih); g.restore();
    g.globalAlpha = 0.25; g.globalCompositeOperation = "multiply"; g.drawImage(F.paperLight, pad, pad, iw, ih); g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
    const m = iw * 0.05, phW = iw * 0.46;
    const t = o.src && toned(F, o.src, o.tone || "color"); if (t) { crop(g, t, pad + iw - m - phW, pad + m, phW, ih - m * 2, o.focus || [0.5, 0.45], o.zoom || 1); g.strokeStyle = "rgba(255,255,255,.6)"; g.lineWidth = 3; g.strokeRect(pad + iw - m - phW, pad + m, phW, ih - m * 2); }
    const tw = iw - phW - m * 3; let fs = iw * 0.075; g.font = `800 ${fs}px 'Playfair Display', serif`;
    const lines = CL.wrap(g, o.title || "", tw); while (lines.length * fs * 1.1 > ih * 0.45 && fs > 10) { fs *= 0.9; g.font = `800 ${fs}px 'Playfair Display', serif`; }
    const L2 = CL.wrap(g, o.title || "", tw); g.fillStyle = "#fffaf2"; g.shadowColor = "rgba(0,0,0,.25)"; g.shadowBlur = 4;
    L2.forEach((l, i) => g.fillText(l, pad + m, pad + m + fs * (0.95 + i * 1.08))); g.shadowBlur = 0;
    const y0 = pad + m + fs * (L2.length * 1.08 + 0.4);
    if (o.text) { g.font = `italic 400 ${iw * 0.036}px 'Old Standard TT', serif`; g.fillStyle = "rgba(255,250,240,.95)"; CL.wrap(g, o.text, tw).slice(0, 3).forEach((l, i) => g.fillText(l, pad + m, y0 + iw * 0.045 * (i + 0.6))); }
    CL.column(g, F, r, pad + m, y0 + iw * (o.text ? 0.16 : 0.03), tw, ih - (y0 - pad) - iw * 0.2, Math.max(7, iw * 0.02), Math.max(9, iw * 0.027), "rgba(255,250,240,.55)");
    const k = { c, iw, ih }; CL.cput(F, key, k); return k;
  }
  K.register({
    name: "collage.panels", tags: ["lista", "comparación", "paneles", "datos"], layer: "main", post: CL.POST,
    summary: "Paneles de color apagado (violeta, verde azulado, mostaza, oliva) con titular, bajada y foto, que caen sobre un mapa desde cerca de cámara de a uno (entrada escalonada). Para listas, comparaciones (2) o hitos (3–4).",
    example: { items: [{ title: "ESTE", text: "una ciudad cerrada" }, { title: "OESTE", text: "al otro lado de la calle" }], photo: "assets/media/mauerbau.jpg", photo2: "assets/media/leipzig.jpg" },
    params: { items: { type: "array", required: true, doc: "2–4 paneles {title, text}." }, ...photoParams(4), tones: boardParams.tones, ...common, move: { ...common.move, default: "in" }, speed: { ...common.speed, default: 0.03 } },
    create(ctx, p) {
      const F = ctx.family.collage, portrait = ctx.stage.portrait, M = makeMap(F, 90, [], "", portrait);
      return CL.scene(ctx, p, { build(S) {
        const { r } = S, ps = photosOf(p), its = (p.items || []).slice(0, 4), n = its.length;
        S.add({ x: 0, y: 0, raw: true, z: -0.03, enter: "none", draw: g => g.drawImage(M.c, -1.5, -1.03, 3, 2.06) });
        const pos = portrait
          ? (n <= 2 ? [[0, -0.36, 0.92], [0, 0.36, 0.92]] : n === 3 ? [[0, -0.6, 0.9], [0, 0, 0.9], [0, 0.6, 0.9]] : [[0, -0.69, 0.88], [0, -0.23, 0.88], [0, 0.23, 0.88], [0, 0.69, 0.88]])
          : (n <= 2 ? [[-0.44, -0.02, 0.8], [0.44, 0.04, 0.8]] : n === 3 ? [[-0.56, -0.2, 0.68], [0.3, -0.22, 0.7], [-0.1, 0.27, 0.7]] : [[-0.42, -0.24, 0.72], [0.4, -0.26, 0.72], [-0.38, 0.24, 0.72], [0.42, 0.22, 0.72]]);
        its.forEach((it, i) => {
          const [x, y, w] = pos[i], ar = portrait ? (n > 3 ? 2.15 : 1.85) : 1.75;
          const k = panel(F, { seed: i + 3, w: 700, h: Math.round(700 / ar), color: PANEL_COLORS[i % 4], title: it.title, text: it.text, src: ps.length ? ps[i % ps.length] : "", tone: toneOf(p, i, i % 2 ? "bw" : "color"), zoom: 1 + Math.floor(i / Math.max(1, ps.length)) * 0.5 });
          S.add({ x, y, raw: true, z: 0.02 + i * 0.01, rot: (r() - 0.5) * 0.03, t0: 0.12 + i * 0.28, din: 0.6, enter: "drop", draw: g => drawCard(g, k, w) });
        });
        S.focus = { x: 0, y: 0 };
      } });
    },
  });
})();
