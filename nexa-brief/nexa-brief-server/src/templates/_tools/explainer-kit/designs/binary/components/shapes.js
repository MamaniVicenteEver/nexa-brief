/* =============================================================================
   binary · componentes de FORMA (declaran points() → el campo 0/1 los dibuja)
   -----------------------------------------------------------------------------
   Convenciones para todos:
   · las cajas se calculan desde ctx.stage.content (sirve en 9:16 y 16:9);
   · `points()` es puro (mismos params → mismos puntos) y se cachea;
   · `render(lt)` dibuja SOLO lo que no son glifos (rótulos, anillos, líneas)
     en ctx.g.top, con su propia entrada/salida según lt y beat.dur.
   ========================================================================== */
(function () {
  const K = Kit, B = Kit.binary, { clamp, lerp, prog, ease } = K;
  const cellOf = (ctx, k = 1) => ctx.stage.u * (ctx.C.binary?.cell ?? 1.15) * k;
  /** entrada/salida de los rótulos; `delay` = esperar a que el campo arme la forma (≈ morph·0.5) */
  const fadeIO = (lt, dur, a = 0.5, b = 0.45, delay = 0) => clamp((lt - delay) / a) * clamp((dur - lt) / b + 0.15);
  /** caja centrada dentro del contenido con fracción `f` del lado */
  const boxIn = (ctx, f = 0.8, ar = 1) => {
    const c = ctx.stage.content; let w = c.w * f, h = w / ar;
    if (h > c.h * f) { h = c.h * f; w = h * ar; }
    return { x: c.x + (c.w - w) / 2, y: c.y + (c.h - h) / 2, w, h };
  };

  Object.assign(B, { cellOf, fadeIO, boxIn });   /* compartidos con ui.js y componentes nuevos */

  /* ------------------------------------------------------------------ título */
  /** caja del título: casi todo el cuadro (el gancho visual de los primeros segundos) */
  const titleBox = (ctx, p) => {
    const { W, H, portrait } = ctx.stage, w = W * p.fill, h = portrait ? H * 0.6 : H * 0.66;
    return { x: (W - w) / 2, y: (portrait ? H * 0.47 : H * 0.5) - h / 2, w, h };
  };
  const titleText = (ctx, p) => (ctx.stage.portrait && p.textPortrait ? p.textPortrait : p.text);
  K.register({
    name: "binary.title", tags: ["intro", "texto", "gancho"], layer: "main",
    summary: "Título de apertura GIGANTE hecho de 0 y 1 (~80% del cuadro, estilo cartel: cada renglón ocupa todo el ancho) con antetítulo y línea; las partículas convergen desde el polvo.",
    example: { text: "EL HOMBRE\nQUE ROMPIÓ\nENIGMA", textPortrait: "EL HOMBRE\nQUE\nROMPIÓ\nENIGMA", kicker: "ALAN TURING · 1940" },
    params: {
      text: { type: "string", required: true, doc: "Título; '\\n' parte renglones (2-4 renglones cortos)." },
      textPortrait: { type: "string", default: "", doc: "Cortes alternativos para 9:16 (más renglones = letras más grandes)." },
      kicker: { type: "string", default: "", doc: "Antetítulo chico en mono (época, protagonista)." },
      fit: { type: "enum", options: ["lines", "block"], default: "lines", doc: "lines = cada renglón al ancho total (cartel); block = mismo tamaño." },
      font: { type: "string", default: "900 100px 'Inter', sans-serif", doc: "Fuente canvas del título." },
      fill: { type: "number", default: 0.9, min: 0.4, max: 1, doc: "Fracción del ancho del cuadro que ocupa." },
      morph: { type: "number", default: 1.6, doc: "Segundos que tardan las partículas en armar el título." },
    },
    points(ctx, p) {
      return B.pack(B.sampleText(titleText(ctx, p), titleBox(ctx, p), { font: p.font, fit: p.fit, lead: 1.1, cell: cellOf(ctx, 0.85), jitter: 0.2, alpha: 0.95, edge: true }), ctx.family.binary.N);
    },
    motion: (lt) => ({ s: 1 + lt * 0.006, x: 0, y: 0, r: 0 }),
    create(ctx, p) {
      ctx.beat.hideCaptions = ctx.beat.hideCaptions ?? true;
      const C = ctx.C.palette;
      return { render(lt, b) {
        const { W, u } = ctx.stage, G = ctx.g.top, a = fadeIO(lt, b.dur, 0.8, 0.5), bx = titleBox(ctx, p);
        if (p.kicker) B.tag(G, p.kicker, W / 2, bx.y - u * 4, { u, size: 1.6, alpha: a, bg: C.ink, color: C.bg });
        G.save(); G.globalAlpha = a * 0.6; G.fillStyle = C.ink;
        const lw = W * 0.5 * prog(lt, 0.4, 1.2); G.fillRect(W / 2 - lw / 2, bx.y + bx.h + u * 3, lw, Math.max(1, u * 0.12)); G.restore();
      } };
    },
  });

  /* ------------------------------------------------------------------ palabra / número */
  K.register({
    name: "binary.word", tags: ["texto", "número", "impacto"], layer: "main",
    summary: "Palabra o número grande hecho de glifos (momentos de alto impacto: '159 TRILLONES', '1952'), con rótulo arriba y nota abajo.",
    example: { text: "159\nTRILLONES", kicker: "COMBINACIONES POSIBLES", note: "UN NÚMERO DE 21 CIFRAS" },
    params: {
      text: { type: "string", required: true, doc: "Texto; '\\n' parte renglones." },
      kicker: { type: "string", default: "", doc: "Etiqueta blanca arriba (mono)." },
      note: { type: "string", default: "", doc: "Línea chica mono debajo." },
      size: { type: "number", default: 0.86, min: 0.3, max: 1, doc: "Fracción del ancho de contenido." },
      font: { type: "string", default: "900 100px 'Inter', sans-serif", doc: "Fuente canvas." },
      morph: { type: "number", default: 1.0, doc: "Segundos de armado." },
    },
    points(ctx, p) {
      const c = ctx.stage.content, w = c.w * p.size, lines = String(p.text).split("\n").length, h = Math.min(c.h * 0.7, w * 0.42 * lines);
      return B.pack(B.sampleText(p.text, { x: c.x + (c.w - w) / 2, y: ctx.stage.cy - h / 2, w, h }, { font: p.font, cell: cellOf(ctx, 0.85), jitter: 0.2, alpha: 0.95, edge: true }), ctx.family.binary.N);
    },
    motion: lt => ({ s: 1 + lt * 0.008 }),
    create(ctx, p) {
      return { render(lt, b) {
        const { u, cx, cy, content } = ctx.stage, G = ctx.g.top, a = fadeIO(lt, b.dur, 0.7);
        const lines = String(p.text).split("\n").length, h = Math.min(content.h * 0.7, content.w * p.size * 0.42 * lines);
        if (p.kicker) B.tag(G, p.kicker, cx, cy - h / 2 - u * 4, { u, size: 1.6, alpha: a });
        if (p.note) B.mono(G, p.note, cx, cy + h / 2 + u * 4, { u, size: 1.5, alpha: a * 0.8, spacing: u * 0.25 });
      } };
    },
  });

  /* ------------------------------------------------------------------ retrato */
  K.register({
    name: "binary.portrait", tags: ["persona", "imagen", "histórico"], layer: "main",
    summary: "Retrato (o cualquier foto) reconstruido como grilla de 0 y 1: el brillo de la imagen define la opacidad de cada dígito. Pie de foto y contador de años opcionales.",
    example: { src: "assets/media/turing.jpg", caption: "Alan Turing", counter: { from: 2026, to: 1940, label: "" } },
    params: {
      src: { type: "image", required: true, doc: "Imagen (mejor fondo oscuro/limpio y rostro centrado)." },
      caption: { type: "string", default: "", doc: "Nombre en serif itálica debajo." },
      sub: { type: "string", default: "", doc: "Línea mono debajo del nombre (rol, años)." },
      size: { type: "number", default: 0.86, min: 0.3, max: 1, doc: "Fracción del contenido." },
      contrast: { type: "number", default: 1.3, doc: "Contraste aplicado antes de muestrear." },
      brightness: { type: "number", default: 1.05, doc: "Brillo aplicado antes de muestrear." },
      threshold: { type: "number", default: 0.08, doc: "Brillo mínimo para poner un glifo (más alto = menos fondo)." },
      counter: { type: "object", default: null, doc: "{from,to,label,dur} — año que rueda debajo (p.ej. 2026 → 1940)." },
      cell: { type: "number", default: 0.72, min: 0.5, max: 1.4, doc: "Tamaño de celda (más chico = más detalle, más partículas)." },
      morph: { type: "number", default: 1.4, doc: "Segundos de armado." },
    },
    points(ctx, p) {
      const im = ctx.img(p.src); const bx = boxIn(ctx, p.size, 0.8);
      return B.pack(B.sampleImage(im, bx, { cell: cellOf(ctx, p.cell), contrast: p.contrast, brightness: p.brightness, threshold: p.threshold }), ctx.family.binary.N);
    },
    motion: lt => ({ s: 1.02 + lt * 0.01 }),
    create(ctx, p) {
      return { render(lt, b) {
        const { u, cx } = ctx.stage, G = ctx.g.top, bx = boxIn(ctx, p.size, 0.8), a = fadeIO(lt, b.dur, 1.2);
        let y = bx.y + bx.h + u * 3.2;
        if (p.counter) {
          const c = p.counter, q = prog(lt, 0.2, c.dur ?? 2.2, "inOut"), v = Math.round(lerp(c.from, c.to, q));
          const txt = (v < 0 ? `${-v} a.C.` : String(v)) + (c.label ? " " + c.label : "");
          G.save(); G.globalAlpha = a; G.fillStyle = "#eaeaea"; G.font = `400 ${u * 3.4}px 'Playfair Display', serif`; G.textAlign = "center"; G.fillText(txt, cx, y + u * 2); G.restore();
          /* regla de marcas bajo el retrato */
          G.save(); G.globalAlpha = a * 0.45; G.fillStyle = "#cfcfcf";
          for (let k = -20; k <= 20; k++) G.fillRect(cx + k * u * 2.2, y - u * 2.4, Math.max(1, u * 0.1), k % 5 ? u * 0.6 : u * 1.2);
          G.restore(); y += u * 6;
        }
        if (p.caption) { G.save(); G.globalAlpha = a; G.fillStyle = "#f0f0f0"; G.font = `italic 400 ${u * 3}px 'Playfair Display', serif`; G.textAlign = "center"; G.fillText(p.caption, cx, y); G.restore(); y += u * 3.2; }
        if (p.sub) B.mono(G, p.sub, cx, y, { u, size: 1.3, alpha: a * 0.75, spacing: u * 0.2 });
      } };
    },
  });

  /* ------------------------------------------------------------------ icono */
  K.register({
    name: "binary.icon", tags: ["objeto", "símbolo"], layer: "main",
    summary: "Silueta de un objeto hecha de glifos (bombilla, llave, barco, submarino, manzana, reloj…), con etiqueta tipo 'tag' y pie.",
    example: { icon: "key", tag: "LA LLAVE", caption: "palabras previsibles" },
    params: {
      icon: { type: "icon", required: true, doc: "Nombre en binary/icons.js, 'text:X' (un carácter) o 'svg:<path 100×100>'." },
      size: { type: "number", default: 0.62, min: 0.15, max: 1, doc: "Fracción del contenido." },
      tag: { type: "string", default: "", doc: "Etiqueta blanca sobre la forma." },
      caption: { type: "string", default: "", doc: "Texto mono debajo." },
      outline: { type: "bool", default: false, doc: "Solo el contorno (más liviano y técnico)." },
      spin: { type: "number", default: 0, doc: "Giro lento en vueltas por segundo (0 = quieto)." },
      morph: { type: "number", default: 1.1, doc: "Segundos de armado." },
    },
    points(ctx, p) {
      const bx = boxIn(ctx, p.size, 1);
      const pts = B.sampleShape((g, w, h) => B.drawIcon(g, p.icon, w, h), bx, { cell: cellOf(ctx, p.outline ? 0.7 : 1), edge: true, jitter: 0.6 });
      return B.pack(p.outline ? pts.filter(q => q.s === 1) : pts, ctx.family.binary.N);
    },
    motion: (lt, b) => ({ s: 1 + lt * 0.012, r: (b.params?.spin || 0) * lt * Math.PI * 2 }),
    create(ctx, p) {
      return { render(lt, b) {
        const { u, cx } = ctx.stage, G = ctx.g.top, bx = boxIn(ctx, p.size, 1), a = fadeIO(lt, b.dur, 0.9);
        if (p.tag) B.tag(G, p.tag, cx, bx.y - u * 2.5, { u, size: 1.5, alpha: a });
        if (p.caption) B.mono(G, p.caption.toUpperCase(), cx, bx.y + bx.h + u * 3.5, { u, size: 1.4, alpha: a * 0.85, spacing: u * 0.25 });
      } };
    },
  });

  /* ------------------------------------------------------------------ órbita */
  K.register({
    name: "binary.orbit", tags: ["proceso", "ciclo", "diagrama"], layer: "main",
    summary: "Ciclo: forma central de glifos dentro de un anillo punteado con 2-6 etapas alrededor; un punto recorre el anillo y la etapa activa se ilumina.",
    example: { icon: "gear", labels: ["PROBAR", "OBSERVAR", "AJUSTAR", "REPETIR"], tags: ["INTENTO 1", "INTENTO 2"] },
    params: {
      icon: { type: "icon", default: "bulb", doc: "Forma central." },
      labels: { type: "array", default: ["HACER", "OBSERVAR", "CAMBIAR", "INTENTAR"], doc: "Etapas alrededor (sentido horario desde arriba)." },
      tags: { type: "array", default: [], doc: "Etiquetas que se alternan sobre la forma central." },
      period: { type: "number", default: 3.2, doc: "Segundos por vuelta del punto." },
      morph: { type: "number", default: 1.1, doc: "Segundos de armado." },
    },
    points(ctx, p) {
      const c = ctx.stage.content, R = Math.min(c.w, c.h) * 0.42, bx = { x: ctx.stage.cx - R * 0.6, y: ctx.stage.cy - R * 0.62, w: R * 1.2, h: R * 1.2 };
      return B.pack(B.sampleShape((g, w, h) => B.drawIcon(g, p.icon, w, h), bx, { cell: cellOf(ctx, 0.85), edge: true }), ctx.family.binary.N);
    },
    motion: lt => ({ s: 1 + Math.sin(lt * 1.4) * 0.01 }),
    create(ctx, p) {
      return { render(lt, b) {
        const { u, cx, cy, content } = ctx.stage, G = ctx.g.top, R = Math.min(content.w, content.h) * 0.42, a = fadeIO(lt, b.dur, 0.8);
        const draw = prog(lt, 0.2, 1.0, "inOut");
        B.ring(G, cx, cy, R, { color: "rgba(230,230,230,.45)", dash: [u * 0.25, u * 0.6], alpha: a, a0: -Math.PI / 2, a1: -Math.PI / 2 + draw * Math.PI * 2 });
        const n = p.labels.length, ang = -Math.PI / 2 + ((lt - 0.6) / p.period) * Math.PI * 2;
        const active = ((Math.floor(((ang + Math.PI / 2) / (Math.PI * 2)) * n + 0.5) % n) + n) % n;
        p.labels.forEach((lab, k) => {
          const th = -Math.PI / 2 + k * Math.PI * 2 / n, x = cx + Math.cos(th) * R, y = cy + Math.sin(th) * R;
          G.save(); G.globalAlpha = a; G.fillStyle = "#ddd"; G.beginPath(); G.arc(x, y, u * 0.55, 0, 7); G.fill(); G.restore();
          const ox = Math.cos(th) * u * 5, oy = Math.sin(th) * u * 3.2;
          B.mono(G, lab, x + ox, y + oy, { u, size: k === active && lt > 0.6 ? 1.6 : 1.25, weight: k === active ? 800 : 500, color: k === active ? "#fff" : "#9a9a9a", alpha: a * draw, spacing: u * 0.2 });
        });
        if (lt > 0.6) { const x = cx + Math.cos(ang) * R, y = cy + Math.sin(ang) * R; G.save(); G.globalAlpha = a; G.fillStyle = "#fff"; G.shadowColor = "#fff"; G.shadowBlur = u * 2; G.beginPath(); G.arc(x, y, u * 0.9, 0, 7); G.fill(); G.restore(); }
        if (p.tags.length && lt > 0.8) { const k = Math.floor((lt - 0.8) / (p.period / 2)) % p.tags.length; B.tag(G, p.tags[k], cx, cy - R * 0.72, { u, size: 1.35, alpha: a }); }
      } };
    },
  });

  /* ------------------------------------------------------------------ grilla de copias */
  K.register({
    name: "binary.grid", tags: ["cantidad", "iteración", "versiones"], layer: "main",
    summary: "Grilla de N copias de una forma que van apareciendo una a una con un contador ('VERSIONES 08'): muestra repetición, escala o cantidad.",
    example: { icon: "bulb", count: 16, label: "VERSIONES" },
    params: {
      icon: { type: "icon", default: "bulb", doc: "Forma repetida." },
      count: { type: "number", default: 12, min: 2, max: 40, doc: "Cuántas copias." },
      label: { type: "string", default: "", doc: "Rótulo del contador (vacío = sin contador)." },
      revealSec: { type: "number", default: 2.4, doc: "Segundos hasta mostrar todas las copias." },
      morph: { type: "number", default: 0.9, doc: "Segundos de armado de cada copia." },
    },
    points(ctx, p) {
      const c = ctx.stage.content, n = p.count, cols = Math.ceil(Math.sqrt(n * c.w / c.h)), rows = Math.ceil(n / cols);
      const cw = c.w / cols, ch = c.h * 0.86 / rows, s = Math.min(cw, ch) * 0.82, out = [];
      for (let k = 0; k < n; k++) {
        const col = k % cols, row = Math.floor(k / cols);
        const bx = { x: c.x + col * cw + (cw - s) / 2, y: c.y + c.h * 0.12 + row * ch + (ch - s) / 2, w: s, h: s };
        for (const q of B.sampleShape((g, w, h) => B.drawIcon(g, p.icon, w, h), bx, { cell: cellOf(ctx, 0.6), edge: true, res: 120, seed: k })) { q.o = k / n; out.push(q); }
      }
      return B.pack(out, ctx.family.binary.N);
    },
    reveal: (lt, b, p) => clamp(lt / (p.revealSec || 2.4)) + 1e-6,
    create(ctx, p) {
      return { render(lt, b) {
        if (!p.label) return;
        const { u, cx, content } = ctx.stage, G = ctx.g.top, a = fadeIO(lt, b.dur, 0.5);
        const k = Math.min(p.count, Math.max(1, Math.ceil(clamp(lt / p.revealSec) * p.count)));
        B.mono(G, p.label, cx, content.y + u * 1.2, { u, size: 1.2, alpha: a * 0.7, spacing: u * 0.3 });
        B.mono(G, String(k).padStart(2, "0"), cx, content.y + u * 4.4, { u, size: 2.8, weight: 700, color: "#fff", alpha: a });
      } };
    },
  });

  /* ------------------------------------------------------------------ curva / gráfico */
  K.register({
    name: "binary.chart", tags: ["datos", "tendencia"], layer: "main",
    summary: "Curva de datos hecha de glifos que se dibuja de izquierda a derecha sobre ejes finos; etiqueta en el punto final ('DÍAS → HORAS').",
    example: { curve: "decay", startLabel: "DÍAS", endLabel: "HORAS", axisX: "TIEMPO" },
    params: {
      curve: { type: "enum", options: ["decay", "growth", "linear", "s"], default: "decay", doc: "Forma de la curva." },
      startLabel: { type: "string", default: "", doc: "Etiqueta del punto inicial." },
      endLabel: { type: "string", default: "", doc: "Etiqueta del punto final." },
      axisX: { type: "string", default: "", doc: "Nombre del eje X." },
      axisY: { type: "string", default: "", doc: "Nombre del eje Y." },
      drawSec: { type: "number", default: 2.2, doc: "Segundos que tarda en dibujarse la curva." },
      morph: { type: "number", default: 0.6, doc: "Segundos de armado." },
    },
    points(ctx, p) {
      const bx = boxIn(ctx, 0.8, 1.15), out = [], f = { decay: x => Math.exp(-4 * x) * 0.92 + 0.04, growth: x => (Math.exp(3.4 * x) - 1) / (Math.exp(3.4) - 1) * 0.92 + 0.04, linear: x => 0.08 + x * 0.84, s: x => 0.06 + 0.88 / (1 + Math.exp(-10 * (x - 0.5))) }[p.curve];
      const r = K.rng(5);
      for (let k = 0; k < 2600; k++) {
        const x = r(), y = f(x), spread = (r() - 0.5) * (0.03 + 0.05 * r()) * bx.h;
        out.push({ x: bx.x + x * bx.w, y: bx.y + (1 - y) * bx.h + spread, a: 0.5 + r() * 0.5, s: Math.abs(spread) < bx.h * 0.008 ? 1 : 0, g: r() < .5 ? 0 : 1, o: x });
      }
      out.sort((a, b) => a.o - b.o);
      return B.pack(out, ctx.family.binary.N);
    },
    reveal: (lt, b, p) => clamp((lt - 0.3) / (p.drawSec || 2.2)) + 1e-6,
    create(ctx, p) {
      return { render(lt, b) {
        const { u } = ctx.stage, G = ctx.g.top, bx = boxIn(ctx, 0.8, 1.15), a = fadeIO(lt, b.dur, 0.6);
        G.save(); G.globalAlpha = a * 0.5; G.strokeStyle = "#ddd"; G.lineWidth = Math.max(1, u * 0.12);
        G.beginPath(); G.moveTo(bx.x, bx.y); G.lineTo(bx.x, bx.y + bx.h); G.lineTo(bx.x + bx.w * prog(lt, 0, 0.8), bx.y + bx.h); G.stroke(); G.restore();
        if (p.axisX) B.mono(G, p.axisX, bx.x + bx.w, bx.y + bx.h + u * 2.6, { u, size: 1.1, align: "right", alpha: a * 0.6 });
        if (p.axisY) B.mono(G, p.axisY, bx.x, bx.y - u * 2, { u, size: 1.1, align: "left", alpha: a * 0.6 });
        const f = { decay: x => Math.exp(-4 * x) * 0.92 + 0.04, growth: x => (Math.exp(3.4 * x) - 1) / (Math.exp(3.4) - 1) * 0.92 + 0.04, linear: x => 0.08 + x * 0.84, s: x => 0.06 + 0.88 / (1 + Math.exp(-10 * (x - 0.5))) }[p.curve];
        if (p.startLabel) B.tag(G, p.startLabel, bx.x + u * 2, bx.y + (1 - f(0)) * bx.h - u * 3, { u, size: 1.3, align: "left", alpha: a * prog(lt, 0.5, 0.4) });
        const done = prog(lt, 0.3 + p.drawSec, 0.4);
        if (p.endLabel && done > 0) B.tag(G, p.endLabel, bx.x + bx.w, bx.y + (1 - f(1)) * bx.h - u * 3, { u, size: 1.3, align: "right", alpha: a * done });
      } };
    },
  });

  /* ------------------------------------------------------------------ túnel */
  K.register({
    name: "binary.tunnel", tags: ["transición", "profundidad", "tiempo"], layer: "main",
    summary: "Túnel de anillos concéntricos de glifos que gira y avanza hacia la cámara: pausa dramática, viaje en el tiempo, 'entrar' en una idea.",
    example: { rings: 14, text: "" },
    params: {
      rings: { type: "number", default: 14, min: 4, max: 30, doc: "Cantidad de anillos." },
      speed: { type: "number", default: 0.06, doc: "Velocidad de avance (zoom por segundo)." },
      text: { type: "string", default: "", doc: "Palabra mono en el centro (opcional)." },
      morph: { type: "number", default: 1.2, doc: "Segundos de armado." },
    },
    points(ctx, p) {
      const { cx, cy, W, H } = ctx.stage, out = [], Rm = Math.hypot(W, H) * 0.5, r = K.rng(11);
      for (let k = 0; k < p.rings; k++) {
        const R = Rm * Math.pow((k + 1) / p.rings, 1.6), n = Math.floor(40 + R / (ctx.stage.u * 0.9));
        for (let i = 0; i < n; i++) { if (r() < 0.2) continue; const th = i / n * Math.PI * 2 + k * 0.3; out.push({ x: cx + Math.cos(th) * R, y: cy + Math.sin(th) * R * 1.02, a: 0.4 + 0.6 * (k / p.rings), s: k > p.rings * 0.6 ? 1 : 0, g: r() < .5 ? 0 : 1 }); }
      }
      return B.pack(out, ctx.family.binary.N);
    },
    motion: (lt, b) => ({ s: 1 + lt * (b.params?.speed ?? 0.06), r: lt * 0.08 }),
    create(ctx, p) {
      return { render(lt, b) {
        if (!p.text) return;
        /* texto central partido en renglones cortos (en 9:16 una frase larga no entra en una línea) */
        const { u, cx, cy, portrait } = ctx.stage, words = String(p.text).split(" "), lines = [""];
        for (const w of words) { const L = lines[lines.length - 1]; if (L && (L + " " + w).length > (portrait ? 14 : 26)) lines.push(w); else lines[lines.length - 1] = L ? L + " " + w : w; }
        lines.forEach((l, i) => B.mono(ctx.g.top, l, cx, cy + (i - (lines.length - 1) / 2) * u * 4.2, { u, size: 2.2, weight: 800, color: ctx.C.palette.ink, alpha: fadeIO(lt, b.dur, 1, 0.45, 0.6), spacing: u * 0.35 }));
      } };
    },
  });

  /* ------------------------------------------------------------------ rayos / caminos */
  K.register({
    name: "binary.rays", tags: ["opciones", "caminos", "contradicción", "explosión"], layer: "main",
    summary: "Haz de líneas de glifos que salen de un punto: abanico de caminos posibles, 'X' de contradicción o estallido radial; se dibujan del centro hacia afuera.",
    example: { mode: "fan", count: 10, label: "10 CAMINOS" },
    params: {
      mode: { type: "enum", options: ["fan", "x", "burst"], default: "fan", doc: "fan = abanico hacia abajo, x = cruz, burst = estrella." },
      count: { type: "number", default: 10, min: 2, max: 36, doc: "Cantidad de líneas (fan/burst)." },
      highlight: { type: "number", default: -1, doc: "Índice de la línea resaltada (-1 = ninguna)." },
      label: { type: "string", default: "", doc: "Etiqueta junto a la línea resaltada o arriba." },
      drawSec: { type: "number", default: 1.4, doc: "Segundos en desplegarse." },
      morph: { type: "number", default: 0.6, doc: "Segundos de armado." },
    },
    points(ctx, p) {
      const c = ctx.stage.content, { cx, cy } = ctx.stage, out = [], r = K.rng(21);
      let lines;
      if (p.mode === "x") { const L = Math.min(c.w, c.h) * 0.48; lines = [[-L, -L, L, L], [L, -L, -L, L]].map(([a, b2, cc, d]) => [cx + a, cy + b2, cx + cc, cy + d]); }
      else if (p.mode === "burst") { const L = Math.min(c.w, c.h) * 0.5; lines = Array.from({ length: p.count }, (_, k) => { const th = k / p.count * Math.PI * 2; return [cx, cy, cx + Math.cos(th) * L, cy + Math.sin(th) * L]; }); }
      else { const top = c.y + c.h * 0.08, L = c.h * 0.95; lines = Array.from({ length: p.count }, (_, k) => { const th = Math.PI / 2 + (k / (p.count - 1) - 0.5) * 1.9; return [cx, top, cx + Math.cos(th) * L * 1.1, top + Math.sin(th) * L]; }); }
      lines.forEach(([x0, y0, x1, y1], k) => {
        const len = Math.hypot(x1 - x0, y1 - y0), n = Math.floor(len / (ctx.stage.u * 0.55)), hi = k === p.highlight;
        for (let i = 0; i < n; i++) { const f = p.mode === "x" ? i / n : i / n; const j = (r() - 0.5) * ctx.stage.u * (hi ? 0.8 : 1.4); out.push({ x: lerp(x0, x1, f) + j, y: lerp(y0, y1, f) + j, a: hi ? 0.95 : 0.35 + r() * 0.4, s: hi ? 1 : 0, g: r() < .5 ? 0 : 1, o: p.mode === "x" ? Math.abs(f - 0.5) * 2 * 0.98 : f }); }
      });
      return B.pack(out, ctx.family.binary.N);
    },
    reveal: (lt, b, p) => clamp(lt / (p.drawSec || 1.4)) + 1e-6,
    create(ctx, p) {
      return { render(lt, b) {
        if (!p.label) return;
        const { u, cx, content } = ctx.stage; B.tag(ctx.g.top, p.label, cx, content.y + u * 1, { u, size: 1.5, alpha: fadeIO(lt, b.dur, 1) * prog(lt, p.drawSec * 0.6, 0.4) });
      } };
    },
  });

  /* ------------------------------------------------------------------ marco con foto */
  K.register({
    name: "binary.frame", tags: ["foto", "documento", "evidencia"], layer: "main",
    summary: "Foto real (blanco y negro) dentro de un marco de glifos punteado, con título en serif y ficha mono: documento histórico, lugar, objeto real.",
    example: { src: "assets/media/bletchley.jpg", title: "Bletchley Park", sub: "INGLATERRA · 1939–1945" },
    params: {
      src: { type: "image", required: true, doc: "Foto (se muestra en escala de grises)." },
      title: { type: "string", default: "", doc: "Título en serif itálica bajo la foto." },
      sub: { type: "string", default: "", doc: "Ficha mono bajo el título." },
      ar: { type: "number", default: 0, doc: "Proporción del marco (0 = la de la foto)." },
      size: { type: "number", default: 0.82, min: 0.3, max: 1, doc: "Fracción del contenido." },
      tilt: { type: "number", default: 0, doc: "Inclinación del marco en grados." },
      morph: { type: "number", default: 1.0, doc: "Segundos de armado del marco." },
      ...K.brandLogo.params,
    },
    points(ctx, p) {
      const im = ctx.img(p.src), ar = p.ar || (im ? im.width / im.height : 1.4), bx = boxIn(ctx, p.size, ar), out = [], step = ctx.stage.u * 0.75, r = K.rng(31);
      const pad = ctx.stage.u * 1.6, X0 = bx.x - pad, Y0 = bx.y - pad, X1 = bx.x + bx.w + pad, Y1 = bx.y + bx.h + pad;
      for (let k = 0; k < 2; k++) {                  /* doble borde de glifos */
        const o = k * ctx.stage.u * 0.9;
        for (let x = X0 - o; x <= X1 + o; x += step) { out.push({ x, y: Y0 - o, a: 0.8 - k * 0.35, g: r() < .5 ? 0 : 1, s: 0 }); out.push({ x, y: Y1 + o, a: 0.8 - k * 0.35, g: r() < .5 ? 0 : 1, s: 0 }); }
        for (let y = Y0 - o; y <= Y1 + o; y += step) { out.push({ x: X0 - o, y, a: 0.8 - k * 0.35, g: r() < .5 ? 0 : 1, s: 0 }); out.push({ x: X1 + o, y, a: 0.8 - k * 0.35, g: r() < .5 ? 0 : 1, s: 0 }); }
      }
      return B.pack(out, ctx.family.binary.N);
    },
    motion: (lt, b) => ({ s: 1 + lt * 0.006, r: (b.params?.tilt || 0) * Math.PI / 180 }),
    create(ctx, p) {
      const im = ctx.img(p.src);
      const ar = p.ar || (im ? im.width / im.height : 1.4);
      const logo = K.brandLogo.attach(ctx, p, boxIn(ctx, p.size, ar));
      let gray = null;
      if (im) { gray = document.createElement("canvas"); gray.width = im.width; gray.height = im.height; const g = gray.getContext("2d"); g.filter = "grayscale(1) contrast(1.12) brightness(0.92)"; g.drawImage(im, 0, 0); }
      return { render(lt, b) {
        const { u, cx } = ctx.stage, G = ctx.g.top, ar = p.ar || (im ? im.width / im.height : 1.4), bx = boxIn(ctx, p.size, ar);
        const a = clamp((lt - (p.morph * 0.6)) / 0.6) * clamp((b.dur - lt) / 0.4 + 0.1), s = 1 + lt * 0.006;
        if (gray) {
          G.save(); G.globalAlpha = a; G.translate(cx, ctx.stage.cy); G.rotate((p.tilt || 0) * Math.PI / 180); G.scale(s, s); G.translate(-cx, -ctx.stage.cy);
          /* encuadre "cover" dentro del marco + zoom lento interno */
          const iar = gray.width / gray.height, z = 1.04 + lt * 0.01; let sw = gray.width, sh = gray.height;
          if (iar > ar) sw = gray.height * ar; else sh = gray.width / ar;
          sw /= z; sh /= z;
          G.drawImage(gray, (gray.width - sw) / 2, (gray.height - sh) / 2, sw, sh, bx.x, bx.y, bx.w, bx.h); G.restore();
        }
        const ta = fadeIO(lt, b.dur, 1.2);
        let y = bx.y + bx.h + u * 5.5;
        if (p.title) { G.save(); G.globalAlpha = ta; G.fillStyle = "#f0f0f0"; G.font = `italic 400 ${u * 3}px 'Playfair Display', serif`; G.textAlign = "center"; G.fillText(p.title, cx, y); G.restore(); y += u * 3.4; }
        if (p.sub) B.mono(G, p.sub, cx, y, { u, size: 1.2, alpha: ta * 0.7, spacing: u * 0.25 });
        if (logo) logo.render(lt);
      }, dispose() { if (logo) logo.dispose(); } };
    },
  });

  /* ------------------------------------------------------------------ globo de diálogo */
  K.register({
    name: "binary.bubble", tags: ["diálogo", "pregunta", "espera"], layer: "main",
    summary: "Globo de diálogo de contorno con tres puntos que 'escriben' (esperar una respuesta, una pregunta en el aire).",
    example: { text: "" },
    params: {
      text: { type: "string", default: "", doc: "Texto dentro del globo (vacío = puntos animados)." },
      size: { type: "number", default: 0.6, min: 0.3, max: 1, doc: "Fracción del contenido." },
      morph: { type: "number", default: 0.9, doc: "Segundos de armado." },
    },
    points(ctx, p) {
      const bx = boxIn(ctx, p.size, 1.6), out = [], step = ctx.stage.u * 0.55, r = K.rng(41), R = bx.h * 0.18;
      const path = new Path2D(); path.roundRect(bx.x, bx.y, bx.w, bx.h * 0.8, R);
      path.moveTo(bx.x + bx.w * 0.22, bx.y + bx.h * 0.8); path.lineTo(bx.x + bx.w * 0.16, bx.y + bx.h); path.lineTo(bx.x + bx.w * 0.34, bx.y + bx.h * 0.8);
      const cv = document.createElement("canvas"); const g = cv.getContext("2d");
      /* muestreo del contorno: recorremos el borde con isPointInStroke */
      cv.width = 4; cv.height = 4; g.lineWidth = step * 1.2;
      for (let y = bx.y - step; y < bx.y + bx.h + step; y += step * 0.8) for (let x = bx.x - step; x < bx.x + bx.w + step; x += step * 0.8)
        if (g.isPointInStroke(path, x, y)) out.push({ x: x + (r() - .5) * step * .4, y: y + (r() - .5) * step * .4, a: 0.65 + r() * 0.35, s: 0, g: r() < .5 ? 0 : 1 });
      return B.pack(out, ctx.family.binary.N);
    },
    create(ctx, p) {
      return { render(lt, b) {
        const { u, cx } = ctx.stage, G = ctx.g.top, bx = boxIn(ctx, p.size, 1.6), a = fadeIO(lt, b.dur, 1), cy = bx.y + bx.h * 0.4;
        if (p.text) { B.mono(G, p.text, cx, cy, { u, size: 2.2, weight: 700, color: "#fff", alpha: a }); return; }
        for (let k = 0; k < 3; k++) { const ph = (lt * 2.2 - k * 0.25) % 1.2, s = 1 + 0.35 * Math.max(0, Math.sin(Math.PI * Math.min(1, ph))); G.save(); G.globalAlpha = a; G.fillStyle = "#fff"; G.beginPath(); G.arc(cx + (k - 1) * u * 3.4, cy, u * 0.85 * s, 0, 7); G.fill(); G.restore(); }
      } };
    },
  });

  /* ------------------------------------------------------------------ piso en perspectiva */
  K.register({
    name: "binary.floor", tags: ["espacio", "vacío", "cierre"], layer: "main",
    summary: "Piso infinito en perspectiva hecho de filas de glifos que se desplazan hacia la cámara (vacío, inmensidad, final reflexivo).",
    example: { text: "¿Y AHORA?" },
    params: {
      text: { type: "string", default: "", doc: "Texto mono flotando sobre el horizonte." },
      speed: { type: "number", default: 0.35, doc: "Velocidad de avance." },
      morph: { type: "number", default: 1.2, doc: "Segundos de armado." },
    },
    points(ctx, p) {
      const { W, H, portrait } = ctx.stage, hz = H * (portrait ? 0.55 : 0.5), out = [], r = K.rng(51);
      for (let row = 0; row < 26; row++) {
        const z = Math.pow((row + 1) / 26, 2.2), y = hz + z * (H - hz), n = Math.floor(30 + z * 90);
        for (let i = 0; i < n; i++) { if (r() < 0.35) continue; const x = W / 2 + (i / n - 0.5) * W * (0.25 + z * 2.4); out.push({ x, y, a: 0.15 + z * 0.65, s: z > 0.6 ? 1 : 0, g: r() < .5 ? 0 : 1 }); }
      }
      return B.pack(out, ctx.family.binary.N);
    },
    motion: lt => ({ s: 1 + lt * 0.012 }),
    create(ctx, p) {
      return { render(lt, b) {
        if (!p.text) return;
        const { u, cx, H, portrait } = ctx.stage; B.mono(ctx.g.top, p.text, cx, H * (portrait ? 0.4 : 0.36), { u, size: 2.4, weight: 700, color: "#fff", alpha: fadeIO(lt, b.dur, 1.2), spacing: u * 0.4 });
      } };
    },
  });
})();
