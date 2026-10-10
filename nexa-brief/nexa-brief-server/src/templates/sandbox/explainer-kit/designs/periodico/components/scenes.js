/* =============================================================================
   periodico · escenas (cada una replica un TIPO de plano de la referencia)
   Todas dibujan en canvas a través de F.add() (ver _periodico.js): coordenadas locales
   en px CSS con (0,0) = centro de la pantalla cuando la cámara descansa en su estación.
   La transición entre planos la hace la cámara (whip/glide): por eso `post` = 1.0 s
   (el plano saliente sigue dibujado mientras la cámara se va).
   ========================================================================== */
(function () {
  const K = Kit, P = Kit.periodico, { clamp, prog, ease, lerp } = K;
  const INK = "#141113", BAR = "#161315", BARINK = "#efecef";
  const Z = 1.04;                        /* profundidad del contenido: flota apenas sobre el papel */
  const dims = ctx => { const { W, H, portrait } = ctx.stage; return { W, H, S: Math.min(W, H), portrait }; };
  const seedOf = ctx => (ctx.beat.i + 1) * 97;

  /* ------------------------------------------------------------ opener */
  K.register({
    name: "periodico.title", tags: ["apertura", "título", "portada"], layer: "main", post: 1.0,
    cam: { move: "whip", first: "intro" },
    summary: "Apertura sobre el periódico: negro → papel desenfocado → rack focus y la cámara se aleja de un título ENORME cuyas letras se aleatorizan hasta asentarse (typewriter), con subtítulo chico, icono ⊠, columna de texto al costado y recuadro negro cortado. Si es el primer plano hace la intro completa; si no, llega con latigazo.",
    example: { title: "LA NOCHE QUE CAYÓ EL MURO", sub: "Berlín · 9 nov 1989" },
    params: {
      title: { type: "string", required: true, doc: "Título ('\\n' parte renglones)." },
      titlePortrait: { type: "string", default: "", doc: "Título para 9:16 (si hace falta otro corte de renglones)." },
      sub: { type: "string", default: "", doc: "Subtítulo chico debajo (typewriter)." },
      aside: { type: "bool", default: true, doc: "Columna de texto chico a la derecha del título (solo 16:9)." },
      box: { type: "bool", default: true, doc: "Recuadro de contorno negro cortado abajo a la izquierda." },
      ...P.CAM,
    },
    create(ctx, p) {
      const F = ctx.family.periodico, { W, H, S, portrait } = dims(ctx), seed = seedOf(ctx);
      const st = F.station(ctx.beat), intro = st && st.move === "intro";
      const lines = String((portrait && p.titlePortrait) || p.title).split("\n");
      const w1 = Math.max(...lines.map(l => P.measure(l, `400 100px ${P.FT}`))) / 100;
      const fs = Math.min(S * (portrait ? 0.1 : 0.088), W * (portrait ? 0.84 : 0.6) / w1), lh = fs * 1.08;
      const tw = w1 * fs, top = -lines.length * lh / 2 - (p.sub ? fs * 0.25 : 0);
      const aside = [], af = `400 ${S * 0.0185}px ${P.FN}`;
      if (p.aside && !portrait) { let s = P.NEWS.slice(seed % 40, seed % 40 + 60).join(" "); aside.push(...P.wrap(s, af, S * 0.2).slice(0, 10)); }
      const t0 = intro ? 1.0 : 0.12;
      return {
        render(lt, b) {
          if (intro) {
            const fade = lt < 0.3 ? 1 : 1 - ease.inOut(clamp((lt - 0.3) / 0.7));
            const q = ease.inOut(clamp((lt - 0.95) / 0.95));
            F.hint({ fade, zoom: lerp(3.4, 1, q), blur: lt < 1.0 ? 7 : lerp(5, 0, ease.out(clamp((lt - 1.0) / 0.8))) });
          }
          F.add(b, Z, g => {
            P.glow(g, 0, top + lines.length * lh / 2, tw * 0.75 + S * 0.1, lines.length * lh + S * 0.12);
            lines.forEach((l, i) => P.tw(g, P.scramble(l, lt, t0 + i * 0.25, 1.9, seed + i), 0, top + lh * (i + 0.8), fs, { align: "center" }));
            if (p.sub) P.tw(g, P.scramble(p.sub, lt, t0 + 0.5, 1.6, seed + 9), 0, top + lh * lines.length + fs * 0.42, fs * 0.42, { align: "center", weight: 0.02 });
            P.icon(g, -tw / 2 - S * 0.045, top + fs * 0.15, S * 0.028);
            g.font = af; g.fillStyle = INK; g.textAlign = "left";
            aside.forEach((l, i) => g.fillText(l, tw / 2 + S * 0.03, top + fs * 0.05 + i * S * 0.0235));
            if (p.box) { g.strokeStyle = INK; g.lineWidth = S * 0.009; g.strokeRect(-W * 0.62, H * (portrait ? 0.3 : 0.28), W * (portrait ? 0.75 : 0.57), H * 0.5); }
          });
        },
      };
    },
  });

  /* ------------------------------------------------------------ headline */
  K.register({
    name: "periodico.headline", tags: ["título", "texto", "capítulo", "dato"], layer: "main", post: 1.0,
    cam: { move: "whip" },
    summary: "Título typewriter sobre el papel, sin foto. style: plain = título + subtítulo centrados con ⊠; bracket = escuadra ⌐ negra arriba-izquierda, el título entra deslizándose y ⊠ grande al lado ('Newspaper / slideshow'); corner = escuadra L negra abajo-izquierda con subtítulo en itálica ('Elegant / Clean Design'). Letras con scramble. Sirve para fechas, cifras y frases cortas.",
    example: { title: "Un papel", sub: "leído en voz alta", style: "bracket" },
    params: {
      title: { type: "string", required: true, doc: "Título (corto)." },
      sub: { type: "string", default: "", doc: "Subtítulo." },
      style: { type: "enum", options: ["plain", "bracket", "corner"], default: "bracket", doc: "Variante de la referencia." },
      year: { type: "string", default: "", doc: "Número/año decorativo cuyos dígitos titilan antes de asentarse." },
      icon: { type: "bool", default: true, doc: "Mostrar ⊠." },
      ...P.CAM,
    },
    create(ctx, p) {
      const F = ctx.family.periodico, { W, H, S, portrait } = dims(ctx), seed = seedOf(ctx);
      const fs0 = S * (p.style === "plain" ? 0.085 : 0.08);
      const tw1 = P.measure(p.title, `400 ${fs0}px ${P.FT}`), fs = Math.min(fs0, fs0 * W * (portrait ? 0.7 : 0.55) / tw1), tw = tw1 * fs / fs0;
      const ifs = S * 0.036;
      return {
        render(lt, b) {
          F.add(b, Z, (g, k) => {
            const T = P.scramble(p.title, lt, 0.2, 1.5, seed);
            P.glow(g, 0, -fs * 0.3, tw * 0.75 + S * 0.12, fs * 1.6);
            if (p.style === "plain") {
              const y = fs * 0.2;
              P.tw(g, T, 0, y, fs, { align: "center" });
              if (p.sub) P.tw(g, P.scramble(p.sub, lt, 0.5, 1.3, seed + 3), 0, y + fs * 0.55, fs * 0.42, { align: "center", weight: 0.02 });
              if (p.icon) P.icon(g, -tw / 2 - S * 0.05, y - fs * 0.85, S * 0.03);
              if (p.year) P.tw(g, P.scramble(p.year, lt, 1.4, 0.5, seed + 5, 12), -tw / 2, y - fs * 1.35, S * 0.05, { weight: 0.05 });
              return;
            }
            const bw = S * (p.style === "corner" ? 0.013 : 0.0095), blockW = tw + S * 0.12;
            const bx = -blockW / 2 - (p.style === "bracket" && !portrait ? W * 0.05 : 0), x = bx + S * (p.style === "corner" ? 0.075 : 0.035);
            const y = 0;
            g.fillStyle = BAR;
            if (p.style === "bracket") {
              const qa = ease.out(clamp(lt / 0.35)), qb = ease.out(clamp((lt - 0.15) / 0.35));
              g.fillRect(bx, -fs * 1.25, bw, fs * 1.55 * qa);
              g.fillRect(bx, -fs * 1.25, S * 0.11 * qb, bw);
              const q = ease.expoOut(clamp((lt - 0.1) / 0.7));
              g.save(); g.globalAlpha = clamp(q * 1.5);
              /* entra deslizándose desde la izquierda con estela (desenfoque de movimiento barato) */
              P.soft(g, T, x - S * 0.18 * (1 - q), y, fs, 0, S * 0.03 * (1 - q));
              if (p.sub) P.soft(g, P.scramble(p.sub, lt, 0.5, 1.3, seed + 3), x - S * 0.14 * (1 - q), y + fs * 0.45, fs * 0.36, 0, S * 0.025 * (1 - q), { weight: 0.015 });
              g.restore();
              if (p.icon) P.icon(g, x + tw + S * 0.075, y - fs * 0.45, S * 0.05, { heavy: true });
            } else {
              const sfs = fs * 0.42, bot = y + (p.sub ? fs * 0.75 : fs * 0.45);
              const qa = ease.out(clamp(lt / 0.4)), qb = ease.out(clamp((lt - 0.3) / 0.35));
              g.fillRect(bx, bot - (fs * 2.2) * qa, bw, fs * 2.2 * qa);
              g.fillRect(bx, bot - bw, S * 0.27 * qb, bw);
              P.tw(g, T, x, y, fs);
              if (p.sub) { g.font = `italic 400 ${sfs}px ${P.FN}`; g.fillStyle = INK; g.textAlign = "left"; g.fillText(P.scramble(p.sub, lt, 0.6, 1.2, seed + 3), x + fs * 0.05, y + fs * 0.42); }
              if (p.icon) P.icon(g, x + tw + S * 0.06, y - fs * 1.1, S * 0.03);
            }
            if (p.year) P.tw(g, P.scramble(p.year, lt, 1.4, 0.5, seed + 5, 12), x + tw * 0.55, y - fs * 1.45, S * 0.05, { weight: 0.05 });
          });
        },
      };
    },
  });

  /* ------------------------------------------------------------ article */
  K.register({
    name: "periodico.article", tags: ["texto", "explicación", "cifra", "dato"], layer: "main", post: 1.0,
    cam: { move: "whip" },
    summary: "Artículo: título typewriter con scramble + regla negra gruesa que se traza + párrafo que se escribe letra a letra ('Exclusive' de la referencia). size=big: título enorme, la cámara se acerca y la profundidad de campo se achica (párrafo desenfocado). Foto chica opcional cortada a la izquierda.",
    example: { title: "28 años", sub: "una ciudad partida en dos", body: "Berlín estuvo partida en dos. Una frontera de hormigón cruzaba calles, plazas y familias." },
    params: {
      title: { type: "string", required: true, doc: "Título (corto: cifra, fecha o palabra)." },
      sub: { type: "string", default: "", doc: "Bajada (normal: itálica chica; big: typewriter bajo el título)." },
      body: { type: "string", default: "", doc: "Párrafo que se escribe letra a letra." },
      size: { type: "enum", options: ["normal", "big"], default: "normal", doc: "normal o big (más cerca, título enorme)." },
      src: { type: "image", default: "", doc: "Foto chica opcional a la izquierda (cortada por el borde)." },
      icon: { type: "bool", default: true, doc: "Mostrar ⊠." },
      ...P.CAM,
    },
    create(ctx, p) {
      const F = ctx.family.periodico, { W, H, S, portrait } = dims(ctx), seed = seedOf(ctx), big = p.size === "big";
      const fs0 = S * (big ? 0.16 : 0.095), tw1 = P.measure(p.title, `400 ${fs0}px ${P.FT}`);
      const fs = Math.min(fs0, fs0 * W * (portrait ? (big ? 0.7 : 0.84) : big ? 0.62 : 0.5) / tw1), tw = tw1 * fs / fs0;   /* big: deja lugar al acercamiento de cámara */
      const colW = portrait ? W * 0.84 : big ? W * 0.66 : W * 0.42;
      const x0 = big ? -colW / 2 : portrait ? -W * 0.42 : -W * 0.2;
      const bfs = S * (big ? 0.042 : portrait ? 0.034 : 0.029), bf = `400 ${bfs}px ${P.FT}`;
      const lines = p.body ? P.wrap(p.body, bf, colW) : [];
      const total = lines.reduce((a, l) => a + l.length, 0);
      const ty = big ? -H * (portrait ? 0.1 : 0.14) : -H * (portrait ? 0.14 : 0.13), ry = ty + (big ? fs * 0.75 : fs * 0.95);
      return {
        render(lt, b) {
          if (big && lt < b.dur + 0.3) F.hint({ zoom: 1 + 0.045 * Math.min(lt, b.dur), focusR: 0.72 });
          const rate = Math.max(28, total / Math.max(0.8, b.dur * 0.7 - 0.9));
          const nC = Math.floor(Math.max(0, lt - 0.9) * rate);
          if (p.src && !portrait) F.add(b, 0.98, g => P.photo(F, g, p.src, -W * 0.64, -H * 0.3, W * 0.38, H * 0.42, { S, seed, fx: 0.4, blur: S * 0.003 }));
          F.add(b, Z, (g, k) => {
            const T = P.scramble(p.title, lt, 0.15, 1.6, seed);
            P.glow(g, x0 + colW / 2, ry, colW * 0.75, (ry - ty) + fs + lines.length * bfs * 1.4, 0.75);
            const tx = big ? -tw / 2 + (portrait ? 0 : -W * 0.03) : x0;
            P.tw(g, T, tx, ty, fs);
            if (p.sub) {
              const S2 = P.scramble(p.sub, lt, 0.45, 1.4, seed + 2);
              if (big) P.tw(g, S2, tx + tw * 0.62, ty + fs * 0.5, fs * 0.33, { align: "center", weight: 0.02 });
              else { g.font = `italic 400 ${fs * 0.26}px ${P.FN}`; g.fillStyle = INK; g.textAlign = "left"; g.fillText(S2, x0 + fs * 0.05, ty + fs * 0.42); }
            }
            if (p.icon) P.icon(g, (big ? tx + tw : x0 + tw) + S * 0.06, ty - fs * 0.6, S * 0.032);
            const rq = ease.inOut(clamp((lt - 0.35) / 0.6));
            g.fillStyle = BAR; g.fillRect(big ? x0 - W * 0.02 : x0, ry, (big ? colW * 1.12 : colW * 0.98) * rq, S * (big ? 0.011 : 0.0095));
            let left = nC;
            lines.forEach((l, i) => {
              if (left <= 0) return;
              const s = l.slice(0, left); left -= l.length;
              const yy = ry + bfs * (big ? 2.4 : 2.1) + i * bfs * 1.36;
              if (big) P.soft(g, s, x0, yy, bfs, S * 0.003, 0, { weight: 0.012 });   /* fuera de foco: la cámara está muy cerca */
              else P.tw(g, s, x0, yy, bfs, { weight: 0.012 });
            });
          });
        },
      };
    },
  });

  /* ------------------------------------------------------------ photo */
  /* posiciones (16:9) medidas en la referencia, en fracciones de W/H */
  const LAY = {
    left:        { pc: [0.12, 0.0], tx: -0.375, ty: 0.2, al: "left", icon: "tr" },
    right:       { pc: [-0.12, 0.0], tx: 0.375, ty: 0.2, al: "right", icon: "tl" },
    topright:    { pc: [-0.06, 0.05], tx: 0.39, ty: -0.31, al: "right", icon: "", year: "tl" },
    topleft:     { pc: [0.06, 0.05], tx: -0.39, ty: -0.31, al: "left", icon: "bl", year: "tr" },
    bottomright: { pc: [-0.07, -0.04], tx: 0.38, ty: 0.29, al: "right", icon: "", year: "in" },
    bottomleft:  { pc: [0.08, -0.04], tx: -0.38, ty: 0.29, al: "left", icon: "tr", year: "" },
  };
  K.register({
    name: "periodico.photo", tags: ["foto", "persona", "lugar", "documento"], layer: "main", post: 1.0,
    cam: { move: "whip" },
    summary: "Foto B/N con marco negro fino (borde de foto impresa) y sombra, apoyada en el periódico, con título typewriter + barra negra con subtítulo blanco ('Stylish / headlines'). layout elige dónde va el rótulo (left/right/topright/topleft/bottomright/bottomleft); año opcional cuyos dígitos titilan; ⊠ en una esquina. Llega con latigazo de cámara.",
    example: { src: "assets/media/mauerbau.jpg", title: "Agosto", sub: "se levanta el muro", layout: "topright", year: "1961" },
    params: {
      src: { type: "image", required: true, doc: "Foto (jpg/png local)." },
      title: { type: "string", default: "", doc: "Título (1–2 palabras)." },
      sub: { type: "string", default: "", doc: "Subtítulo en la barra negra." },
      layout: { type: "enum", options: Object.keys(LAY), default: "left", doc: "Dónde va el rótulo respecto de la foto." },
      year: { type: "string", default: "", doc: "Año / número decorativo (dígitos que titilan)." },
      icon: { type: "bool", default: true, doc: "Mostrar ⊠." },
      ar: { type: "number", default: 0, doc: "Proporción del recorte (0 = 1.5 en 16:9, 1.2 en 9:16)." },
      size: { type: "number", default: 0.55, min: 0.3, max: 0.8, doc: "Ancho de la foto (fracción del ancho en 16:9)." },
      focus: { type: "array", default: [0.5, 0.45], doc: "Punto [x,y] 0..1 del recorte." },
      ...P.CAM,
    },
    create(ctx, p) {
      const F = ctx.family.periodico, { W, H, S, portrait } = dims(ctx), seed = seedOf(ctx), L = LAY[p.layout] || LAY.left;
      const ar = p.ar || (portrait ? 1.2 : 1.5);
      let pw, ph, px, py, tx, ty, al = L.al;
      if (!portrait) { pw = W * p.size; ph = pw / ar; px = L.pc[0] * W - pw / 2; py = L.pc[1] * H - ph / 2; tx = L.tx * W; ty = L.ty * H; }
      else {
        pw = W * 0.9; ph = pw / ar; px = -pw / 2; py = -H * 0.04 - ph / 2;
        const top = /^top/.test(p.layout);
        ty = top ? py - S * 0.12 : py + ph + S * 0.12; tx = al === "left" ? -W * 0.43 : W * 0.43;
      }
      /* la barra llega hasta el borde de la foto (como en la referencia) */
      const barW = !portrait && (p.layout === "left" || p.layout === "right") ? Math.abs((al === "left" ? px : px + pw) - tx) : 0;
      const maxW = barW ? barW - S * 0.03 : portrait ? W * 0.86 : W * 0.42;
      const sd = Math.min(1.5, ctx.beat.dur * 0.38);          /* el scramble se asienta aunque el plano sea corto */
      const ic = { tr: [px + pw - S * 0.005, py + S * 0.08], tl: [px + S * 0.005, py + S * 0.08], bl: [px - S * 0.06, py + ph - S * 0.08] }[L.icon];
      const yr = portrait ? { tl: [px + S * 0.01, py - S * 0.035, "left"], tr: [px + pw - S * 0.01, py - S * 0.035, "right"], in: [px + pw - S * 0.06, py + S * 0.14, "right"] }[L.year]
        : { tl: [px - S * 0.06, py - S * 0.04, "left"], tr: [px + pw + S * 0.06, py - S * 0.04, "right"], in: [px + pw - S * 0.06, py + S * 0.14, "right"] }[L.year];
      return {
        render(lt, b) {
          F.add(b, Z, (g, k) => {
            P.photo(F, g, p.src, px, py, pw, ph, { S, seed, fx: p.focus[0], fy: p.focus[1] });
            if (p.year && yr) {
              g.save(); if (L.year === "in") g.globalAlpha = 0.62;
              const yv = lt < 1.9 ? p.year.slice(0, 2) + P.scramble(p.year.slice(2), lt, 1.9, 0.01, seed + Math.floor(lt * 8), 14) : p.year;
              P.tw(g, yv, yr[0], yr[1], S * (L.year === "in" ? 0.08 : 0.055), { align: yr[2], weight: 0.06, color: L.year === "in" ? "#1d181b" : INK });
              g.restore();
            }
            if (p.icon && ic) P.icon(g, ic[0], ic[1], S * 0.034, { heavy: false });
            if (p.title || p.sub) P.titleBar(g, { x: tx, y: ty, align: al, title: p.title, sub: p.sub, lt, seed, S, barW, maxW, dur: sd });
          });
        },
      };
    },
  });

  /* ------------------------------------------------------------ collage */
  K.register({
    name: "periodico.collage", tags: ["foto", "collage", "multitud", "contexto"], layer: "main", post: 1.0,
    cam: { move: "whip" },
    summary: "Varias fotos y recortes de periódico en capas a distinta profundidad (paralaje y desenfoque) con rótulo de barra negra. layout: history = foto grande a la derecha + foto y recortes detrás ('History / opener'); modular = tres fotos superpuestas ('Modular / structure'); plugins = foto + foto desenfocada + recuadro + caja negra con texto blanco ('No Plugins / Required').",
    example: { src: "assets/media/muro-gente.jpg", src2: "assets/media/leipzig.jpg", title: "Miles", sub: "salieron a la calle", layout: "history" },
    params: {
      src: { type: "image", required: true, doc: "Foto principal." },
      src2: { type: "image", default: "", doc: "Segunda foto." },
      src3: { type: "image", default: "", doc: "Tercera foto (modular / history)." },
      title: { type: "string", default: "", doc: "Título." },
      sub: { type: "string", default: "", doc: "Subtítulo (barra negra; en plugins va debajo del título)." },
      note: { type: "string", default: "", doc: "plugins: texto blanco sobre la caja negra (2–3 renglones)." },
      layout: { type: "enum", options: ["history", "modular", "plugins"], default: "history", doc: "Composición." },
      ...P.CAM,
    },
    create(ctx, p) {
      const F = ctx.family.periodico, { W, H, S, portrait } = dims(ctx), seed = seedOf(ctx);
      const src2 = p.src2 || p.src, src3 = p.src3 || src2;
      const R = (x, y, w, h) => ({ x: x * W, y: y * H, w: w * W, h: h * H });
      let main, back, back2, fgc, tb, al = "left", extra = {};
      if (portrait) {
        main = R(-0.45, -0.27, 0.9, 0.34); back = R(-0.5, -0.46, 0.62, 0.21); back2 = R(0.12, -0.42, 0.45, 0.2);
        fgc = R(-0.2, 0.38, 0.9, 0.2); tb = { x: -0.43 * W, y: 0.15 * H };
      } else if (p.layout === "history") {
        main = R(-0.168, -0.29, 0.574, 0.675); back = R(-0.5, -0.29, 0.38, 0.38); back2 = null;
        fgc = R(-0.45, 0.36, 0.42, 0.3); tb = { x: -0.4 * W, y: 0.175 * H }; extra.clipTop = R(-0.04, -0.62, 0.62, 0.2);
      } else if (p.layout === "modular") {
        main = R(-0.3, -0.12, 0.48, 0.6); back = R(-0.52, -0.02, 0.26, 0.5); back2 = R(0.1, -0.24, 0.34, 0.42);
        fgc = R(0.25, 0.3, 0.4, 0.3); tb = { x: -0.44 * W, y: -0.29 * H };
      } else {
        main = R(-0.08, -0.31, 0.38, 0.44); back = R(-0.39, -0.2, 0.22, 0.26); back2 = null;
        fgc = null; tb = { x: 0.1 * W, y: -0.31 * H }; extra.box = R(-0.42, 0.14, 0.4, 0.22); extra.note = R(-0.07, 0.2, 0.52, 0.14);
        if (true) main = R(0.115, -0.26, 0.37, 0.44);
      }
      const nf = `400 ${S * 0.03}px ${P.FT}`, noteL = p.note ? P.wrap(p.note, nf, (extra.note ? extra.note.w : W * 0.8) - S * 0.03).slice(0, 4) : [];
      if (portrait && p.layout === "plugins") extra.note = { x: -0.45 * W, y: 0.19 * H, w: 0.9 * W, h: noteL.length * S * 0.042 + S * 0.03 };
      return {
        render(lt, b) {
          /* capas de atrás hacia adelante: foto trasera (p<1 → desenfocada) */
          const bb = p.layout === "plugins" ? S * 0.004 : S * 0.0016;
          F.add(b, 0.97, g => {
            P.photo(F, g, src2, back.x, back.y, back.w, back.h, { S, seed: seed + 1, fx: 0.4, blur: bb });
            if (back2) P.photo(F, g, src3, back2.x, back2.y, back2.w, back2.h, { S, seed: seed + 2, fx: 0.6, blur: bb });
          });
          if (extra.clipTop) F.add(b, 1.12, g => P.clipping(F, g, extra.clipTop.x, extra.clipTop.y, extra.clipTop.w, extra.clipTop.h, { S, sx: 0.05, sy: 0.04, zoom: 1.6, blur: S * 0.005 }));
          F.add(b, Z, (g, k) => {
            if (extra.box) { g.strokeStyle = INK; g.lineWidth = S * 0.007; g.strokeRect(extra.box.x, extra.box.y, extra.box.w, extra.box.h); }
            P.photo(F, g, p.src, main.x, main.y, main.w, main.h, { S, seed });
            if (p.layout === "plugins") {
              const T = P.scramble(p.title, lt, 0.2, 1.5, seed);
              const tx = portrait ? -0.43 * W : main.x - S * 0.02, ty = portrait ? 0.14 * H : main.y - S * 0.035;
              P.tw(g, T, portrait ? tx : main.x + main.w * 0.1, ty, S * 0.085, { align: portrait ? "left" : "center" });
              if (p.sub) { g.font = `italic 400 ${S * 0.03}px ${P.FN}`; g.fillStyle = INK; g.textAlign = portrait ? "left" : "right"; g.fillText(P.scramble(p.sub, lt, 0.5, 1.2, seed + 4), portrait ? tx : main.x + main.w * 0.1 + S * 0.16, ty + S * 0.04); }
              if (noteL.length) {
                const n = extra.note, q = ease.out(clamp((lt - 0.5) / 0.5)), h = noteL.length * S * 0.042 + S * 0.03;
                g.fillStyle = BAR; g.fillRect(n.x, n.y, n.w * q, h);
                g.save(); g.beginPath(); g.rect(n.x, n.y, n.w * q, h); g.clip();
                noteL.forEach((l, i) => P.tw(g, l, n.x + S * 0.015, n.y + S * (0.045 + i * 0.042), S * 0.03, { color: BARINK, weight: 0.008 }));
                g.restore();
              }
            } else if (p.title || p.sub) {
              const barW = portrait ? 0 : Math.abs(main.x - tb.x) + S * 0.04;
              P.titleBar(g, { x: tb.x, y: tb.y, align: al, title: p.title, sub: p.sub, lt, seed, S, barW: p.layout === "history" ? barW : 0, maxW: p.layout === "history" && !portrait ? barW - S * 0.05 : W * 0.6, dur: Math.min(1.5, b.dur * 0.38) });
            }
          });
          if (fgc) F.add(b, 1.3, g => P.photo(F, g, src3, fgc.x, fgc.y, fgc.w, fgc.h, { S, seed: seed + 3, fx: 0.5, fy: 0.3, blur: S * 0.009 }));
        },
      };
    },
  });

  /* ------------------------------------------------------------ quote */
  K.register({
    name: "periodico.quote", tags: ["frase", "cita", "impacto", "clímax"], layer: "main", post: 1.0,
    cam: { move: "whip" },
    summary: "La frase narrada en typewriter grande sobre el papel: cada palabra aparece cuando la voz la dice, con sus letras aleatorizándose hasta asentarse; las palabras de `accent` van en blanco sobre barra negra (como los subtítulos de la referencia). Regla negra que crece debajo y ⊠. Oculta los subtítulos.",
    example: { accent: ["inmediato"] },
    params: {
      accent: { type: "array", default: [], doc: "Palabras (sin tildes/mayúsculas importa) en barra negra." },
      maxChars: { type: "number", default: 0, doc: "Caracteres por renglón (0 = auto: 13 en 9:16, 20 en 16:9)." },
      ...P.CAM,
    },
    create(ctx, p) {
      const F = ctx.family.periodico, { W, H, S, portrait } = dims(ctx), seed = seedOf(ctx), b0 = ctx.beat;
      b0.hideCaptions = true;
      const ws = ctx.words.filter(w => w.start >= b0.t0 - 0.05 && w.start < b0.t1 - 0.05);
      const max = p.maxChars || (portrait ? 13 : 20), lines = [[]];
      for (const w of ws) { const cur = lines[lines.length - 1], len = cur.reduce((a, x) => a + x.text.length + 1, 0); if (cur.length && len + w.text.length > max) lines.push([]); lines[lines.length - 1].push(w); }
      const acc = new Set((p.accent || []).map(K.norm));
      const txt = l => l.map(w => w.text).join(" ");
      const wid = Math.max(1, ...lines.map(l => P.measure(txt(l), `400 100px ${P.FT}`))) / 100;
      const fs = Math.min(S * 0.11, W * (portrait ? 0.84 : 0.7) / wid, H * 0.55 / (lines.length * 1.25)), lh = fs * 1.28;
      const x0 = -wid * fs / 2, y0 = -lines.length * lh / 2 + fs * 0.8;
      return {
        render(lt, b, t) {
          F.add(b, Z, g => {
            P.glow(g, 0, y0 + (lines.length - 1) * lh / 2 - fs * 0.3, wid * fs * 0.72 + S * 0.1, lines.length * lh * 0.9 + S * 0.1);
            g.font = `400 ${fs}px ${P.FT}`;
            const sp = P.measure(" ", g.font);
            lines.forEach((l, li) => {
              let x = x0; const y = y0 + li * lh;
              l.forEach((w, wi) => {
                const clean = w.text, ww = P.measure(clean, `400 ${fs}px ${P.FT}`);
                if (t >= w.start - 0.06) {
                  const s = P.scramble(clean, t - w.start, 0.02, 0.38, seed + li * 31 + wi);
                  if (acc.has(K.norm(clean))) {
                    const q = ease.out(clamp((t - w.start) / 0.25));
                    g.fillStyle = BAR; g.fillRect(x - fs * 0.12, y - fs * 0.82, (ww + fs * 0.24) * q, fs * 1.08);
                    P.tw(g, s, x, y, fs, { color: BARINK, weight: 0.015 });
                  } else P.tw(g, s, x, y, fs);
                }
                x += ww + sp;
              });
            });
            const pr = clamp((t - b.t0) / Math.max(0.5, b.dur - 0.3));
            g.fillStyle = BAR; g.fillRect(x0, y0 + (lines.length - 1) * lh + fs * 0.55, wid * fs * pr, S * 0.008);
            P.icon(g, x0 + wid * fs + S * 0.05, y0 - fs * 0.9, S * 0.03);
          });
        },
      };
    },
  });
})();
