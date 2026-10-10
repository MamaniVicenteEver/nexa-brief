/* =============================================================================
   pelicula · escenas (cada TIPO de plano de la referencia es un componente)
   -----------------------------------------------------------------------------
   Todas se componen en un lienzo propio (P.surface) en este orden:
     fondo (foto virada + cámara) → tiras/perforaciones → arcos finos → papel
     → bloque de texto → rubor → P.composite (entrada: barrido/zoom/foco/glitch)
     → destello de entrada en ctx.g.top
   Los tiempos (0.28 s de caída, 0.6 s de barrido, glitch 0.3 s…) están medidos
   en la referencia: ver DESIGN.md §1.4.
   ========================================================================== */
(function () {
  const K = Kit, P = Kit.pelicula, { clamp, lerp, prog, ease } = K;

  const ENTER = ["cut", "whip", "whipR", "whipUp", "whipDown", "zoom", "focus", "glitch", "fade"];
  const EXIT = ["none", "whip", "whipR", "whipUp", "whipDown", "zoom"];
  const LEAK = ["none", "burn", "prism", "flash", "bar"];
  const STRIPS = ["frame", "top", "bottom", "double", "side", "none"];
  const CAMERA = ["in", "out", "left", "right", "rise", "fall", "still"];
  const TEXTIN = ["drop", "rise", "glitch", "flash", "fade", "none"];
  const POS = ["center", "left", "right", "topLeft", "topRight", "bottomLeft", "bottomRight", "bigLeft", "bigRight"];
  const LEAKDUR = { burn: 0.95, prism: 0.6, flash: 0.4, bar: 0.8 };

  /* parámetros comunes de las escenas */
  const common = {
    enter: { type: "enum", options: ENTER, default: "whip", doc: "Entrada del plano: barrido (whip/whipR/whipUp/whipDown) con motion blur, zoom radial, foco, glitch de franjas, fundido o corte." },
    exit: { type: "enum", options: EXIT, default: "none", doc: "Salida en los últimos 0.3 s (barrido/zoom). Combinada con la entrada del plano siguiente arma el 'whip pan' completo." },
    leak: { type: "enum", options: LEAK, default: "none", doc: "Destello al entrar: burn (naranja→blanco, tapa el corte), prism (banda rojo-blanco-verde), flash, bar (barra de luz)." },
    leakDir: { type: "enum", options: ["ltr", "rtl"], default: "ltr", doc: "Dirección del destello." },
    flush: { type: "bool", default: false, doc: "Rubor rojo-marrón en el último segundo del plano (como antes de varios cortes de la referencia)." },
  };
  const cardParams = {
    year: { type: "string", default: "", doc: "Número GIGANTE naranja (año, fecha, cifra: '1989', '28', '23:30')." },
    title: { type: "string", default: "", doc: "Titular en mayúsculas crema ('\\n' parte renglones)." },
    sub: { type: "string", default: "", doc: "Subtítulo chico con barra roja delante." },
    kicker: { type: "string", default: "", doc: "Rótulo mínimo arriba del titular (opcional)." },
    layout: { type: "enum", options: ["under", "over"], default: "under", doc: "under = titular debajo del año (1930); over = titular arriba del año (1940)." },
    color: { type: "enum", options: ["orange", "red"], default: "orange", doc: "Color del número: naranja (#c9501f) o rojo (#c4352a)." },
    pos: { type: "enum", options: POS, default: "right", doc: "Posición del bloque. bigLeft/bigRight = gigante y cortado por el borde." },
    size: { type: "number", default: 0.42, min: 0.12, max: 1.2, doc: "Ancho del número como fracción del ancho del cuadro (en 9:16 se agranda solo)." },
    textIn: { type: "enum", options: TEXTIN, default: "drop", doc: "Entrada del bloque: drop (cae desde arriba con estela), rise (sube), glitch, flash (aparece tras el destello), fade." },
    textAt: { type: "number", default: 0.28, doc: "Segundos desde el inicio del plano hasta que entra el bloque." },
    glitches: { type: "array", default: [], doc: "Segundos (desde el inicio del plano) donde el bloque hace glitch de franjas 0.3 s." },
    drift: { type: "enum", options: ["left", "right", "up", "none"], default: "left", doc: "Deriva lenta del bloque después de entrar (se frena en ~3 s)." },
  };

  /* ------------------------------------------------------------ utilidades de escena */
  const W_OF = (st, size) => st.W * (st.portrait ? Math.min(0.82, size * 1.9) : size);
  function buildCard(ctx, p, size, res = 1) {
    const st = ctx.stage;
    if (!p.year && !p.title && !p.sub) return null;
    return P.card({ year: p.year, title: p.title, sub: p.sub, kicker: p.kicker, layout: p.layout, color: p.color === "red" ? P.COL.red : P.COL.orange,
      width: W_OF(st, size), maxW: st.W * (st.portrait ? 0.9 : 0.82), res: ctx.dpr * res, seed: ctx.beat.i * 53 });
  }
  /** estado animado del bloque: posición, escala, estela, glitch y alfa */
  function cardState(ctx, card, p, lt, st, o = {}) {
    const { W, H } = st, t0 = o.at ?? p.textAt ?? 0.28, f = P.fi(ctx.beat.t0 + lt), sc = o.s ?? 1;
    const fit = Math.min(1, (o.maxH ?? H * 0.62) / (card.h * sc), (o.maxW ?? W * 1.2) / (card.w * sc));
    const s = sc * fit, pos = P.place(st, o.pos || p.pos, card.w * s, card.h * s);
    let x = pos.x, y = pos.y, alpha = 1, smY = 0, glitch = 0, sAnim = 1;
    const mode = o.textIn ?? p.textIn, q = lt - t0;
    if (q < 0 && mode !== "none") return null;
    if (mode === "drop" || mode === "rise") {
      const e = ease.expoOut(clamp(q / 0.42)), A = (mode === "drop" ? -1 : 1) * H * 0.55, off = A * (1 - e);
      y += off; smY = -off * 0.45; alpha = clamp(q / 0.06);
    } else if (mode === "flash") { const e = ease.out(clamp(q / 0.6)); alpha = e; sAnim = 1.08 - 0.08 * e; }
    else if (mode === "fade") alpha = ease.out(clamp(q / 0.5));
    else if (mode === "glitch") { if (q < 0.5) { const r = K.rng(f * 13 + 5); glitch = r() < 0.75 ? 1 - q : 0; alpha = r() < 0.15 ? 0.3 : 1; } }
    for (const g of p.glitches || []) if (lt >= g && lt < g + 0.3) { const r = K.rng(f * 17 + 3); if (r() < 0.8) glitch = Math.max(glitch, 0.8); }
    /* deriva: llega desplazado y se frena */
    const dq = 1 - ease.out(clamp(Math.max(0, q) / 3.2)), D = o.drift ?? p.drift;
    if (D === "left") x += W * 0.035 * dq; else if (D === "right") x -= W * 0.035 * dq; else if (D === "up") y += H * 0.04 * dq;
    x += o.dx || 0; y += o.dy || 0;
    if (sAnim !== 1) { const cx = x + card.w * s / 2, cy = y + card.h * s / 2; x = cx - card.w * s * sAnim / 2; y = cy - card.h * s * sAnim / 2; }
    return { x, y, s: s * sAnim, alpha, smearY: smY, glitch, f };
  }
  const drawState = (G, card, cs) => cs && P.drawCard(G, card, cs.x, cs.y, cs.s, cs);

  /** destello automático de entrada (en la capa de arriba, por encima de todo) */
  function entryLeak(ctx, p, lt, at = 0, kind = p.leak) {
    if (!kind || kind === "none") return;
    const D = LEAKDUR[kind] || 0.6;
    P.leak(ctx.g.top, ctx.stage, kind, (lt - at) / D, { dir: p.leakDir });
  }
  /** cámara del fondo según `camera` → {zoom, px, py, dy (para tiras y texto)} */
  function camera(kind, lt, b, st) {
    const q = clamp(lt / Math.max(2, b.dur)), H = st.H;
    switch (kind) {
      case "out": return { zoom: 1.2 - 0.13 * q, px: 0, py: 0, dy: 0 };
      case "left": return { zoom: 1.14, px: 0.05 - 0.1 * q, py: 0, dy: 0 };
      case "right": return { zoom: 1.14, px: -0.05 + 0.1 * q, py: 0, dy: 0 };
      case "rise": { const e = ease.sine(q); return { zoom: 1.32, px: 0, py: -0.22 + 0.44 * e, dy: lerp(0.3, -0.22, e) * H }; }
      case "fall": { const e = ease.sine(q); return { zoom: 1.32, px: 0, py: 0.22 - 0.44 * e, dy: lerp(-0.22, 0.3, e) * H }; }
      case "still": return { zoom: 1.08, px: 0, py: 0, dy: 0 };
      default: return { zoom: 1.05 + 0.09 * q, px: 0, py: 0, dy: 0 };
    }
  }
  /** filas de perforaciones / tiras según el preset (todas se desplazan con paralaje) */
  function strips(G, st, preset, lt, o = {}) {
    const { W, H, portrait } = st, dy = o.dy || 0, v = W * 0.022, slide = o.slide || 0;
    const row = (at, k, sp, a, band = 0.42, holes = 0.9) => P.perfRow(G, st, { axis: "x", at: at + dy, k, scroll: lt * sp + slide * Math.sign(sp || 1), alpha: a, band, holes });
    switch (preset) {
      case "frame":
        row(H * 0.055, 1, -v, 1, 0.5); row(H * 0.185, 1.3, v * 0.6, 0.32, 0.15, 0.7); row(H * (portrait ? 0.955 : 0.94), 1, v * 0.8, 1, 0.5); break;
      case "top":
        row(H * 0.06, 1, -v, 1, 0.5); row(H * 0.2, 1.35, v * 0.5, 0.3, 0.12, 0.7); break;
      case "bottom":
        row(H * 0.92, 1, v, 1, 0.5); row(H * 0.78, 1.35, -v * 0.6, 0.3, 0.12, 0.7); break;
      case "double":
        row(H * 0.3, 1.7, -v * 1.2, 0.78, 0.35, 0.85); row(H * 0.5, 1.7, v * 0.8, 0.55, 0.3, 0.8); row(H * 0.04, 1, -v, 0.9, 0.45); break;
      case "side": {
        if (portrait) { P.filmStrip(G, st, { axis: "x", a0: -H * 0.02 + dy, a1: H * 0.2 + dy, imgs: [o.img2 || o.img], ar: 1.5, scroll: -lt * v * 2 + slide, edges: "end", alpha: 0.95 }); break; }
        P.filmStrip(G, st, { axis: "y", a0: -W * 0.02, a1: W * 0.27, imgs: [o.img2 || o.img], ar: 1.4, scroll: -lt * H * 0.04 + dy + slide, edges: "end", alpha: 0.96, zoom: 1.1 });
        row(H * 0.06, 1, -v, 0.85, 0.35); break;
      }
      default: break;
    }
  }
  /** desenfoque barato: miniatura reescalada (cacheada por imagen) */
  const blurCache = new Map();
  function blurred(im, k = 48) {
    if (!im) return null; const key = im; if (blurCache.has(key)) return blurCache.get(key);
    const c = P.canvas(k, k * im.height / im.width), g = c.getContext("2d"); g.imageSmoothingQuality = "high"; g.drawImage(im, 0, 0, c.width, c.height);
    blurCache.set(key, c); return c;
  }

  /* ============================================================ título de apertura */
  K.register({
    name: "pelicula.title", tags: ["apertura", "título", "año"], layer: "main", post: 0.5,
    summary: "Apertura (ref 0–3 s): foto de archivo que entra desenfocada y hace foco, dos filas de perforaciones arriba y una abajo que entran deslizándose, arcos finos, y el bloque año + titular + subtítulo que CAE desde arriba con estela y hace glitch de franjas.",
    example: { src: "assets/media/muro-gente.jpg", year: "1989", title: "LA NOCHE QUE\nCAYÓ EL MURO", sub: "BERLÍN · 9 DE NOVIEMBRE" },
    params: {
      src: { type: "image", required: true, doc: "Foto de fondo." },
      ...cardParams,
      pos: { ...cardParams.pos, default: "right" },
      size: { ...cardParams.size, default: 0.44 },
      glitches: { ...cardParams.glitches, default: [0.68] },
      focus: { type: "array", default: [0.5, 0.5], doc: "Punto de interés [x,y] 0..1 del encuadre." },
      ...common,
      enter: { ...common.enter, default: "focus" },
    },
    create(ctx, p) {
      const st = ctx.stage, S = P.surface(ctx), img = P.grade(ctx, p.src), lines = P.makeLines(ctx.rng, st, 2), card = buildCard(ctx, p, p.size), seed = ctx.beat.i * 101 + 7;
      return {
        render(lt, b) {
          const G = S.begin(), { W, H } = st, q = clamp(lt / Math.max(2, b.dur));
          P.cover(G, img, 0, 0, W, H, { zoom: 1.06 + 0.06 * q, fx: p.focus[0], fy: p.focus[1] });
          /* las filas entran deslizándose rápido (0–0.6 s) y siguen a paso lento en sentidos opuestos */
          const sl = W * 0.7 * (1 - ease.expoOut(clamp(lt / 0.65))), v = W * 0.022, a = clamp(lt / 0.15);
          P.perfRow(G, st, { at: H * 0.1, k: 1, scroll: -lt * v - sl, alpha: a, band: 0.38 });
          P.perfRow(G, st, { at: H * 0.25, k: 1, scroll: lt * v * 0.7 + sl, alpha: a, band: 0.38 });
          P.perfRow(G, st, { at: H * (st.portrait ? 0.955 : 0.91), k: 1, scroll: -lt * v * 0.8 - sl * 0.6, alpha: a, band: 0.45 });
          P.lines(G, st, lines, lt, clamp((lt - 0.3) / 0.5));
          P.paper(G, st, seed);
          if (card) drawState(G, card, cardState(ctx, card, p, lt, st));
          P.flush(G, st, p.flush ? 0.55 * clamp((lt - (b.dur - 0.9)) / 0.6) : 0);
          P.composite(ctx, S, lt, b, { enter: p.enter, exit: p.exit, enterDur: 0.7 });
          entryLeak(ctx, p, lt);
        },
        dispose() { S.free(); },
      };
    },
  });

  /* ============================================================ año / fecha sobre foto */
  K.register({
    name: "pelicula.year", tags: ["año", "fecha", "cifra", "titular", "foto"], layer: "main", post: 0.5,
    summary: "Plano principal de la referencia: número GIGANTE naranja/rojo + titular crema + subtítulo con barra roja sobre una foto virada con filas de perforaciones en doble exposición. Entradas del bloque (cae / sube / glitch / tras destello), cámara (in/out/rise…) y 'punch' opcional: corte a otra escala del mismo bloque escondido por un prisma de luz.",
    example: { src: "assets/media/mauerbau.jpg", year: "1961", title: "SE LEVANTA EL MURO", sub: "AGOSTO · BERLÍN", pos: "right", strips: "frame", punch: 3.2 },
    params: {
      src: { type: "image", required: true, doc: "Foto de fondo." },
      src2: { type: "image", default: "", doc: "Segunda foto (tira lateral o doble exposición)." },
      ...cardParams,
      strips: { type: "enum", options: STRIPS, default: "frame", doc: "Perforaciones: frame (arriba y abajo), top, bottom, double (filas grandes cruzando), side (tira vertical con src2), none." },
      camera: { type: "enum", options: CAMERA, default: "in", doc: "Movimiento de cámara: in/out (Ken Burns), left/right (paneo), rise (todo sube, ref 1932), fall, still." },
      ghost: { type: "number", default: 0, min: 0, max: 0.6, doc: "Opacidad de src2 en doble exposición sobre toda la escena." },
      punch: { type: "number", default: -1, doc: "Segundos (o '@palabra') en que el plano corta a la versión punch del bloque (−1 = sin punch)." },
      punchPos: { type: "enum", options: POS, default: "bigLeft", doc: "Posición del bloque después del punch." },
      punchSize: { type: "number", default: 0.95, min: 0.12, max: 1.4, doc: "Tamaño del número después del punch." },
      focus: { type: "array", default: [0.5, 0.5], doc: "Punto de interés [x,y] 0..1." },
      ...common,
    },
    create(ctx, p) {
      const st = ctx.stage, S = P.surface(ctx), img = P.grade(ctx, p.src), img2 = P.grade(ctx, p.src2) || img;
      const lines = P.makeLines(ctx.rng, st, 2), seed = ctx.beat.i * 101 + 7;
      const punch = p.punch != null && p.punch >= 0 ? p.punch : null;
      const ratio = punch != null ? Math.max(1, W_OF(st, p.punchSize) / W_OF(st, p.size)) : 1;
      const card = buildCard(ctx, p, p.size, Math.min(3, ratio));
      return {
        render(lt, b) {
          const G = S.begin(), { W, H } = st, after = punch != null && lt >= punch;
          const cam = camera(p.camera, lt, b, st), zm = after ? 1.28 : 1;
          P.cover(G, img, 0, 0, W, H, { zoom: cam.zoom * zm, fx: p.focus[0] + (after ? -0.1 : 0), fy: p.focus[1], px: cam.px, py: cam.py });
          if (p.ghost > 0 && img2) { G.save(); G.globalAlpha = p.ghost; G.globalCompositeOperation = "screen"; P.cover(G, img2, 0, 0, W, H, { zoom: 1.15 + lt * 0.01 }); G.restore(); }
          strips(G, st, p.strips, lt, { dy: cam.dy, img, img2, slide: -W * 0.5 * (1 - ease.expoOut(clamp(lt / 0.6))) });
          P.lines(G, st, lines, lt);
          P.paper(G, st, seed + (after ? 3 : 0));
          if (card) {
            const o = after ? { pos: p.punchPos, s: ratio, textIn: "none", at: punch, maxH: H * 0.85, maxW: W * 1.6 } : { dy: cam.dy * 0.92 };
            if (after) o.drift = p.drift;
            drawState(G, card, cardState(ctx, card, p, lt, st, o));
          }
          P.flush(G, st, p.flush ? 0.55 * clamp((lt - (b.dur - 0.9)) / 0.6) : 0);
          P.composite(ctx, S, lt, b, { enter: p.enter, exit: p.exit });
          entryLeak(ctx, p, lt);
          if (punch != null) P.leak(ctx.g.top, st, "prism", (lt - punch + 0.22) / 0.6, { dir: p.leakDir === "ltr" ? "rtl" : "ltr" });
        },
        dispose() { S.free(); },
      };
    },
  });

  /* ============================================================ foto a sangre */
  K.register({
    name: "pelicula.photo", tags: ["foto", "lugar", "personas", "evidencia"], layer: "main", post: 0.5,
    summary: "Foto de archivo a pantalla completa (ref 18.6–24 s y 30.6–32.4 s): fila de perforaciones cortada por el borde, Ken Burns lento, arcos finos, doble exposición opcional y un titular chico opcional. Entra con barrido horizontal con motion blur.",
    example: { src: "assets/media/bornholmer.jpg", title: "BORNHOLMER STRASSE", sub: "PASO FRONTERIZO · BERLÍN" },
    params: {
      src: { type: "image", required: true, doc: "Foto." },
      src2: { type: "image", default: "", doc: "Foto en doble exposición (opcional)." },
      ghost: { type: "number", default: 0.22, min: 0, max: 0.6, doc: "Opacidad de la doble exposición." },
      title: { type: "string", default: "", doc: "Titular chico (opcional)." },
      sub: { type: "string", default: "", doc: "Subtítulo con barra roja (opcional)." },
      pos: { type: "enum", options: POS, default: "bottomLeft", doc: "Posición del titular." },
      perfs: { type: "enum", options: ["top", "bottom", "both", "none"], default: "top", doc: "Fila de perforaciones cortada por el borde." },
      camera: { type: "enum", options: CAMERA, default: "in", doc: "Movimiento de cámara." },
      focus: { type: "array", default: [0.5, 0.45], doc: "Punto de interés [x,y] 0..1." },
      ...common,
    },
    create(ctx, p) {
      const st = ctx.stage, S = P.surface(ctx), img = P.grade(ctx, p.src), img2 = P.grade(ctx, p.src2), lines = P.makeLines(ctx.rng, st, 2), seed = ctx.beat.i * 101 + 7;
      const card = p.title || p.sub ? P.card({ title: p.title, sub: p.sub, width: st.W * (st.portrait ? 0.62 : 0.34), maxW: st.W * (st.portrait ? 0.88 : 0.6), res: ctx.dpr, seed }) : null;
      const pc = { ...p, textIn: "fade", textAt: 0.7, drift: "left", glitches: [] };
      return {
        render(lt, b) {
          const G = S.begin(), { W, H } = st, cam = camera(p.camera, lt, b, st), v = W * 0.02;
          P.cover(G, img, 0, 0, W, H, { zoom: cam.zoom, fx: p.focus[0], fy: p.focus[1], px: cam.px, py: cam.py });
          if (img2 && p.ghost > 0) { G.save(); G.globalAlpha = p.ghost; G.globalCompositeOperation = "screen"; P.cover(G, img2, 0, 0, W, H, { zoom: 1.2 - lt * 0.01 }); G.restore(); }
          if (p.perfs === "top" || p.perfs === "both") P.perfRow(G, st, { at: H * 0.012, k: 1, scroll: -lt * v, band: 0.35 });
          if (p.perfs === "bottom" || p.perfs === "both") P.perfRow(G, st, { at: H * 0.99, k: 1, scroll: lt * v, band: 0.35 });
          P.lines(G, st, lines, lt);
          P.paper(G, st, seed);
          if (card) drawState(G, card, cardState(ctx, card, pc, lt, st, { maxH: H * 0.3 }));
          P.flush(G, st, p.flush ? 0.55 * clamp((lt - (b.dur - 0.9)) / 0.6) : 0);
          P.composite(ctx, S, lt, b, { enter: p.enter, exit: p.exit, enterDur: 0.7 });
          entryLeak(ctx, p, lt);
        },
        dispose() { S.free(); },
      };
    },
  });

  /* ============================================================ montaje en tiras */
  K.register({
    name: "pelicula.strip", tags: ["montaje", "collage", "varias fotos", "contexto"], layer: "main", post: 0.5,
    summary: "Montaje en tiras de película (ref 3.6–6.8 s y 38–43.7 s): 2–3 fotos como cuadros de tiras horizontales que corren en sentidos opuestos, perforaciones en los bordes, doble exposición y una barra de luz que cruza el cuadro.",
    example: { src: "assets/media/mauerbau.jpg", src2: "assets/media/bornholmer.jpg", src3: "assets/media/muro-gente.jpg", layout: "split" },
    params: {
      src: { type: "image", required: true, doc: "Foto 1 (cuadro grande)." },
      src2: { type: "image", default: "", doc: "Foto 2." },
      src3: { type: "image", default: "", doc: "Foto 3 (tira de abajo / fondo)." },
      layout: { type: "enum", options: ["split", "band"], default: "split", doc: "split = tira grande arriba + tira chica abajo (ref 4 s); band = una tira ancha al medio sobre la foto de fondo (ref 39 s)." },
      sweep: { type: "bool", default: true, doc: "Barra de luz que cruza el cuadro a mitad del plano." },
      ...common,
    },
    create(ctx, p) {
      const st = ctx.stage, S = P.surface(ctx), a = P.grade(ctx, p.src), b2 = P.grade(ctx, p.src2) || a, c3 = P.grade(ctx, p.src3) || b2;
      const lines = P.makeLines(ctx.rng, st, 2), seed = ctx.beat.i * 101 + 7;
      return {
        render(lt, b) {
          const G = S.begin(), { W, H, portrait } = st, v = W * 0.022, sl = W * 0.8 * (1 - ease.expoOut(clamp(lt / 0.7)));
          G.fillStyle = "#3b3322"; G.fillRect(0, 0, W, H);
          if (p.layout === "band") {
            P.cover(G, c3, 0, 0, W, H, { zoom: 1.1 + lt * 0.01 });
            G.fillStyle = "rgba(30,22,12,.35)"; G.fillRect(0, 0, W, H);
            P.filmStrip(G, st, { a0: H * (portrait ? 0.12 : 0.04), a1: H * (portrait ? 0.62 : 0.8), imgs: [a, b2], ar: portrait ? 0.9 : 1.6, scroll: -lt * v - sl + W * 0.05, edges: "both", zoom: 1.04 });
            P.filmStrip(G, st, { a0: H * (portrait ? 0.66 : 0.82), a1: H * 1.08, imgs: [c3, a], ar: 1.5, scroll: lt * v * 1.3 + sl, edges: "start", alpha: 0.88 });
          } else if (portrait) {
            P.filmStrip(G, st, { a0: -H * 0.04, a1: H * 0.4, imgs: [a, b2], ar: 1.25, scroll: -lt * v - sl, edges: "end" });
            P.filmStrip(G, st, { a0: H * 0.4, a1: H * 0.69, imgs: [b2, c3], ar: 1.5, scroll: lt * v * 1.2 + sl - W * 0.3, edges: "both" });
            P.filmStrip(G, st, { a0: H * 0.69, a1: H * 1.04, imgs: [c3, a], ar: 1.4, scroll: -lt * v * 0.8 - sl - W * 0.2, edges: "start" });
          } else {
            P.filmStrip(G, st, { a0: -H * 0.3, a1: H * 0.68, imgs: [a, b2], ar: 1.65, scroll: -lt * v - sl - W * 0.05, edges: "end", zoom: 1.03 });
            P.filmStrip(G, st, { a0: H * 0.68, a1: H * 1.07, imgs: [c3, a, b2], ar: 1.6, scroll: lt * v * 1.3 + sl - W * 0.2, edges: "end" });
          }
          /* doble exposición suave de la primera foto sobre todo el montaje */
          G.save(); G.globalAlpha = 0.16; G.globalCompositeOperation = "screen"; P.cover(G, a, 0, 0, W, H, { zoom: 1.25 }); G.restore();
          P.lines(G, st, lines, lt);
          P.paper(G, st, seed);
          if (p.sweep) P.leak(G, st, "bar", (lt - b.dur * 0.3) / 0.9, { strength: 1 });
          P.flush(G, st, p.flush ? 0.55 * clamp((lt - (b.dur - 0.9)) / 0.6) : 0);
          P.composite(ctx, S, lt, b, { enter: p.enter, exit: p.exit });
          entryLeak(ctx, p, lt);
        },
        dispose() { S.free(); },
      };
    },
  });

  /* ============================================================ rollo vertical */
  K.register({
    name: "pelicula.reel", tags: ["foto", "documento", "retrato", "rollo"], layer: "main", post: 0.5,
    summary: "Rollo vertical (ref 13–15 s y 53–55.6 s): la foto como cuadros de una tira vertical con perforaciones a ambos lados que corre hacia arriba, tira lateral a la derecha y fondo lavado en blanco; bloque de año/titular opcional al costado.",
    example: { src: "assets/media/nota.jpg", src2: "assets/media/schabowski.jpg", title: "LA NOTA", sub: "9 DE NOVIEMBRE DE 1989" },
    params: {
      src: { type: "image", required: true, doc: "Foto principal (cuadros del rollo)." },
      src2: { type: "image", default: "", doc: "Foto alternada en el rollo / tira lateral." },
      src3: { type: "image", default: "", doc: "Foto de la tira lateral (si falta, src2)." },
      ...cardParams,
      pos: { ...cardParams.pos, default: "right" },
      size: { ...cardParams.size, default: 0.3 },
      textIn: { ...cardParams.textIn, default: "flash" },
      textAt: { ...cardParams.textAt, default: 0.45 },
      speed: { type: "number", default: 0.05, min: 0, max: 0.4, doc: "Velocidad del rollo (fracción del alto por segundo)." },
      ...common,
      enter: { ...common.enter, default: "whipUp" },
    },
    create(ctx, p) {
      const st = ctx.stage, S = P.surface(ctx), a = P.grade(ctx, p.src), b2 = P.grade(ctx, p.src2) || a, c3 = P.grade(ctx, p.src3) || b2;
      const blur = blurred(a), lines = P.makeLines(ctx.rng, st, 1), seed = ctx.beat.i * 101 + 7, card = buildCard(ctx, p, p.size);
      const imgs = [a, a, b2].filter(Boolean);
      return {
        render(lt, b) {
          const G = S.begin(), { W, H, portrait } = st, sp = H * p.speed;
          /* fondo: la misma foto muy desenfocada y lavada (luz detrás del rollo) */
          G.save(); G.imageSmoothingQuality = "high"; P.cover(G, blur, 0, 0, W, H, { zoom: 1.2 }); G.restore();
          G.fillStyle = "rgba(246,239,224,.5)"; G.fillRect(0, 0, W, H);
          const has = !!card && !portrait, ws = portrait ? W * 0.88 : has ? W * 0.5 : W * 0.66, cx = portrait ? W / 2 : has ? W * 0.33 : W * 0.46;
          const iar = a ? a.width / a.height : 1.4;
          P.filmStrip(G, st, { axis: "y", a0: cx - ws / 2, a1: cx + ws / 2, imgs, ar: Math.max(0.6, Math.min(1.9, iar)), scroll: -lt * sp + H * 0.12, edges: "both", zoom: 1.02 });
          if (!portrait) P.filmStrip(G, st, { axis: "y", a0: W * 0.87, a1: W * 1.12, imgs: [c3], ar: 1.3, scroll: lt * sp * 0.8, edges: "start", alpha: 0.8 });
          P.lines(G, st, lines, lt, 0.8);
          P.paper(G, st, seed);
          if (card) drawState(G, card, cardState(ctx, card, p, lt, st, portrait ? { pos: "bottomLeft", maxH: H * 0.3 } : { maxW: W * 0.42 }));
          P.flush(G, st, p.flush ? 0.55 * clamp((lt - (b.dur - 0.9)) / 0.6) : 0);
          P.composite(ctx, S, lt, b, { enter: p.enter, exit: p.exit, enterDur: 0.55 });
          entryLeak(ctx, p, lt);
        },
        dispose() { S.free(); },
      };
    },
  });

  /* ============================================================ frase narrada grande */
  K.register({
    name: "pelicula.quote", tags: ["frase", "cita", "impacto", "letra"], layer: "main", post: 0.5,
    summary: "Frase narrada en titular grande (ref 15.5–17 s, el punch de 'NO PLUGINS REQUIRED'): las palabras dichas dentro del plano caen en mayúsculas crema erosionadas justo cuando la voz las dice; 'accent' las pinta naranja; número gigante opcional detrás y subtítulo con barra roja.",
    example: { src: "assets/media/schabowski.jpg", accent: ["inmediato"], ghost: "1989" },
    params: {
      src: { type: "image", required: true, doc: "Foto de fondo." },
      src2: { type: "image", default: "", doc: "Foto en doble exposición (opcional)." },
      accent: { type: "array", default: [], doc: "Palabras en naranja (sin importar tildes/mayúsculas)." },
      ghost: { type: "string", default: "", doc: "Número gigante naranja detrás de la frase (opcional)." },
      sub: { type: "string", default: "", doc: "Subtítulo con barra roja debajo (opcional)." },
      strips: { type: "enum", options: STRIPS, default: "side", doc: "Perforaciones (ver pelicula.year)." },
      camera: { type: "enum", options: CAMERA, default: "in", doc: "Movimiento de cámara." },
      size: { type: "number", default: 0.8, min: 0.3, max: 1, doc: "Ancho máximo del renglón más largo (fracción del ancho)." },
      maxChars: { type: "number", default: 0, doc: "Caracteres por renglón (0 = 17 en 16:9, 11 en 9:16)." },
      ...common,
      enter: { ...common.enter, default: "cut" },
      leak: { ...common.leak, default: "prism" },
    },
    create(ctx, p) {
      const st = ctx.stage, S = P.surface(ctx), img = P.grade(ctx, p.src), img2 = P.grade(ctx, p.src2) || img, seed = ctx.beat.i * 101 + 7, b0 = ctx.beat;
      ctx.beat.hideCaptions = true;
      const { W, H, portrait } = st, lines0 = P.makeLines(ctx.rng, st, 2);
      const ws = ctx.words.filter(w => w.start >= b0.t0 - 0.05 && w.start < b0.t1 - 0.05);
      const max = p.maxChars || (portrait ? 11 : 17), rows = [[]];
      for (const w of ws) { const cur = rows[rows.length - 1], len = cur.reduce((a, x) => a + x.text.length + 1, 0); if (cur.length && len + w.text.length > max) rows.push([]); rows[rows.length - 1].push(w); }
      const clean = s => s.replace(/[.,;:]+$/, "").toUpperCase();
      const widest = Math.max(1, ...rows.map(r => P.measure(r.map(w => clean(w.text)).join(" "), "800 100px Montserrat", 1.2)));
      const fs = Math.min(100 * W * (portrait ? 0.9 : p.size) / widest, H * (portrait ? 0.085 : 0.13), H * 0.5 / (rows.length * 1.0));
      const acc = new Set((p.accent || []).map(K.norm)), T = P.tex(), R = ctx.dpr;
      const space = P.measure(" ", `800 ${fs}px Montserrat`);
      const items = [];
      rows.forEach((r, ri) => { let x = 0; r.forEach(w => {
        const t = clean(w.text), wd = P.measure(t, `800 ${fs}px Montserrat`, fs * 0.012), c = P.canvas((wd + fs * 0.2) * R, fs * 1.25 * R), g = c.getContext("2d");
        g.scale(R, R); g.font = `800 ${fs}px Montserrat`; g.letterSpacing = fs * 0.012 + "px"; g.fillStyle = acc.has(K.norm(w.text)) && !p.ghost ? P.COL.orange : P.COL.cream; g.fillText(t, fs * 0.05, fs * 0.95);
        g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "destination-out"; g.globalAlpha = 0.6; const pat = g.createPattern(T.speck, "repeat"); pat.setTransform(new DOMMatrix().translate(-x * 3, -ri * 77)); g.fillStyle = pat; g.fillRect(0, 0, c.width, c.height);
        items.push({ w, c, x, row: ri, wd: wd + fs * 0.2 }); x += wd + space; }); });
      const rowW = rows.map((_, ri) => Math.max(0, ...items.filter(i => i.row === ri).map(i => i.x + i.wd)));
      const blockH = rows.length * fs * 1.02;
      /* número fantasma detrás (solo el número) y subtítulo aparte, debajo de la frase */
      const gcard = p.ghost ? P.card({ year: p.ghost, width: W * (portrait ? 0.92 : 0.7), maxW: W, res: R, seed }) : null;
      const scard = p.sub ? P.card({ sub: p.sub, width: fs * 0.3 / 0.105 * 2.75, maxW: W * 0.9, res: R, seed }) : null;
      return {
        render(lt, b, t) {
          const G = S.begin(), cam = camera(p.camera, lt, b, st);
          P.cover(G, img, 0, 0, W, H, { zoom: cam.zoom * 1.1, px: cam.px, py: cam.py });
          if (img2 !== img) { G.save(); G.globalAlpha = 0.2; G.globalCompositeOperation = "screen"; P.cover(G, img2, 0, 0, W, H, { zoom: 1.2 }); G.restore(); }
          strips(G, st, p.strips, lt, { img, img2 });
          P.lines(G, st, lines0, lt);
          P.paper(G, st, seed);
          /* bloque a la izquierda, centrado en vertical; el número fantasma detrás (deriva lenta hacia arriba-izquierda) */
          const dq = 1 - ease.out(clamp(lt / 4)), x0 = W * (portrait ? 0.06 : 0.05) + W * 0.02 * dq, y0 = (portrait ? H * 0.44 : H * 0.5) - blockH / 2 + H * 0.02 * dq;
          /* sombra suave detrás del bloque para que se lea sobre fotos cargadas */
          G.save(); G.globalCompositeOperation = "multiply"; const sg = G.createLinearGradient(0, 0, W * 0.9, 0); sg.addColorStop(0, "rgba(60,46,28,.55)"); sg.addColorStop(1, "rgba(60,46,28,0)"); G.fillStyle = sg; G.fillRect(0, 0, W, H); G.restore();
          if (gcard) { const s = Math.min(1, H * 0.7 / gcard.h, W * 1.05 / gcard.w); P.drawCard(G, gcard, x0 - gcard.pad * s - gcard.fs * 0.04 * s, y0 + fs * 0.55 - (gcard.pad + 0.72 * gcard.fs) * s, s, { alpha: ease.out(clamp(lt / 0.5)) * 0.9 }); }
          if (scard) P.drawCard(G, scard, x0 - scard.pad, y0 + blockH + fs * 0.05, 1, { alpha: ease.out(clamp((lt - 0.4) / 0.5)) });
          for (const it of items) {
            const q = ease.expoOut(clamp((t - (it.w.start - 0.06)) / 0.32)); if (q <= 0) continue;
            const off = -(1 - q) * fs * 0.9;
            P.drawCard(G, { c: it.c, w: it.wd, h: fs * 1.25 }, x0 + it.x, y0 + it.row * fs * 1.02 - fs * 0.2 + off, 1, { alpha: clamp(q * 3), smearY: -off * 0.5 });
          }
          P.flush(G, st, p.flush ? 0.55 * clamp((lt - (b.dur - 0.9)) / 0.6) : 0);
          P.composite(ctx, S, lt, b, { enter: p.enter, exit: p.exit });
          entryLeak(ctx, p, lt);
        },
        dispose() { S.free(); },
      };
    },
  });
})();
