/* =============================================================================
   acuarela · escenas (cada tipo de plano de la referencia)
   -----------------------------------------------------------------------------
   title  → "THE HISTORY": título grande con rayas sobre una mancha-foto que llena el cuadro
   photo  → una foto + fecha + párrafo (3 diagramaciones: top / right / left)
   pair   → dos fotos superpuestas + fecha(s) (above / right / below / center / dual)
   quote  → retrato + cita + firma en rojo ladrillo
   Las cajas están en fracciones del cuadro; hay una tabla para 16:9 y otra para 9:16.
   ========================================================================== */
(function () {
  const K = Kit, A = Kit.acuarela;

  const FOCUS = { type: "array", default: [0.5, 0.5], doc: "Punto de interés [x,y] 0..1 para el recorte 'cover'." };
  const ENTERS = ["auto", "down", "up", "left", "right", "zoom", "tilt", "shrink", "none"];

  /* ------------------------------------------------------------ diagramaciones */
  /* p = fotos [x,y,w,h]; t = bloques de texto {x,y,align}; h = manuscritos {x,y,w,h,over} */
  const PHOTO = {
    top: {
      L: { p: [[0.255, 0.355, 0.49, 0.45]], t: [{ x: 0.5, y: 0.1, align: "center", maxW: 0.47 }], h: [{ x: 0.12, y: 0.3, w: 0.19, h: 0.36 }, { x: 0.655, y: 0.44, w: 0.22, h: 0.36, over: true }], enter: "down" },
      P: { p: [[0.06, 0.4, 0.88, 0.33]], t: [{ x: 0.5, y: 0.08, align: "center" }], h: [{ x: 0.05, y: 0.3, w: 0.5, h: 0.12 }, { x: 0.45, y: 0.6, w: 0.5, h: 0.16, over: true }], enter: "down" },
    },
    right: {
      L: { p: [[0.17, 0.09, 0.52, 0.45]], t: [{ x: 0.885, y: 0.58, align: "right", maxW: 0.46 }], h: [{ x: 0.67, y: 0.07, w: 0.2, h: 0.42, over: true }, { x: 0.12, y: 0.6, w: 0.24, h: 0.2 }], enter: "right" },
      P: { p: [[0.06, 0.1, 0.88, 0.33]], t: [{ x: 0.94, y: 0.5, align: "right" }], h: [{ x: 0.4, y: 0.06, w: 0.55, h: 0.14, over: true }, { x: 0.05, y: 0.62, w: 0.5, h: 0.12 }], enter: "right" },
    },
    left: {
      L: { p: [[0.33, 0.1, 0.52, 0.45]], t: [{ x: 0.115, y: 0.62, align: "left", maxW: 0.46 }], h: [{ x: 0.11, y: 0.15, w: 0.22, h: 0.32 }, { x: 0.62, y: 0.58, w: 0.24, h: 0.2 }], enter: "left" },
      P: { p: [[0.06, 0.1, 0.88, 0.33]], t: [{ x: 0.06, y: 0.5, align: "left" }], h: [{ x: 0.05, y: 0.06, w: 0.5, h: 0.14 }, { x: 0.45, y: 0.62, w: 0.5, h: 0.12 }], enter: "left" },
    },
  };
  const PAIR = {
    above: {
      L: { p: [[0.125, 0.47, 0.375, 0.355], [0.485, 0.355, 0.385, 0.42]], t: [{ x: 0.115, y: 0.12, align: "left", maxW: 0.47 }], h: [{ x: 0.665, y: 0.17, w: 0.24, h: 0.24, over: true }, { x: 0.12, y: 0.37, w: 0.18, h: 0.1 }], enter: "up" },
      P: { p: [[0.05, 0.4, 0.62, 0.2], [0.35, 0.53, 0.6, 0.22]], t: [{ x: 0.06, y: 0.07, align: "left" }], h: [{ x: 0.45, y: 0.36, w: 0.5, h: 0.12, over: true }] , enter: "up" },
    },
    right: {
      L: { p: [[0.135, 0.3, 0.49, 0.47], [0.575, 0.35, 0.235, 0.47]], t: [{ x: 0.885, y: 0.09, align: "right", maxW: 0.46 }], h: [{ x: 0.11, y: 0.19, w: 0.24, h: 0.38, over: true }, { x: 0.795, y: 0.38, w: 0.13, h: 0.46, over: true }], enter: "tilt" },
      P: { p: [[0.05, 0.36, 0.7, 0.24], [0.52, 0.47, 0.42, 0.27]], t: [{ x: 0.94, y: 0.07, align: "right" }], h: [{ x: 0.05, y: 0.6, w: 0.45, h: 0.14, over: true }], enter: "tilt" },
    },
    below: {
      L: { p: [[0.11, 0.1, 0.4, 0.42], [0.475, 0.2, 0.39, 0.4]], t: [{ x: 0.115, y: 0.64, align: "left", maxW: 0.46 }], h: [{ x: 0.66, y: 0.05, w: 0.22, h: 0.14, over: true }, { x: 0.62, y: 0.63, w: 0.25, h: 0.18 }], enter: "right" },
      P: { p: [[0.05, 0.08, 0.62, 0.22], [0.33, 0.24, 0.62, 0.24]], t: [{ x: 0.06, y: 0.54, align: "left" }], h: [{ x: 0.45, y: 0.04, w: 0.5, h: 0.1, over: true }] , enter: "right" },
    },
    center: {
      L: { p: [[0.11, 0.16, 0.37, 0.38], [0.52, 0.16, 0.37, 0.38]], t: [{ x: 0.5, y: 0.62, align: "center", maxW: 0.5 }], h: [{ x: 0.69, y: 0.02, w: 0.22, h: 0.13 }, { x: 0.12, y: 0.55, w: 0.2, h: 0.14 }], enter: "zoom" },
      P: { p: [[0.06, 0.08, 0.88, 0.22], [0.06, 0.32, 0.88, 0.22]], t: [{ x: 0.5, y: 0.59, align: "center" }], h: [{ x: 0.45, y: 0.03, w: 0.5, h: 0.08 }], enter: "zoom" },
    },
    dual: {
      L: { p: [[0.11, 0.11, 0.415, 0.42], [0.49, 0.46, 0.4, 0.37]], t: [{ x: 0.885, y: 0.17, align: "right", maxW: 0.33 }, { x: 0.115, y: 0.6, align: "left", maxW: 0.3 }], h: [{ x: 0.6, y: 0.36, w: 0.29, h: 0.16, over: true }, { x: 0.12, y: 0.53, w: 0.25, h: 0.07 }], enter: "left" },
      P: { p: [[0.05, 0.19, 0.62, 0.19], [0.33, 0.36, 0.62, 0.2]], t: [{ x: 0.94, y: 0.055, align: "right" }, { x: 0.06, y: 0.59, align: "left" }], h: [], enter: "left" },
    },
  };
  const pick = (T, ctx) => (ctx.stage.portrait ? T.P : T.L);
  const shiftBox = ([x, y, w, h], dx, dy) => [x + dx, y + dy, w, h];

  /** bloques de texto de un layout con fecha/párrafo de los params */
  function blocks(L, texts) { return L.t.map((t, i) => ({ ...t, ...(texts[i] || {}), maxW: t.maxW })); }

  /* ------------------------------------------------------------ title */
  K.register({
    name: "acuarela.title", tags: ["apertura", "título", "portada"], layer: "main",
    summary: "Apertura 'THE HISTORY': título condensado en rojo ladrillo con rayas finas a ambos lados y subtítulo, sobre una gran mancha de acuarela que es una foto lavada (florece desde varios focos) y bloques manuscritos.",
    example: { title: "La noche que cayó el muro", sub: "Berlín · 9 de noviembre de 1989", bg: "assets/media/muro-gente.jpg" },
    params: {
      title: { type: "string", required: true, doc: "Título (se escribe en mayúsculas)." },
      sub: { type: "string", default: "", doc: "Subtítulo chico bajo el título." },
      bg: { type: "image", default: "", doc: "Foto que forma la mancha de fondo (se lava a gris)." },
      focus: FOCUS,
      titlePortrait: { type: "string", default: "", doc: "Título alternativo para 9:16 ('\\n' parte renglones)." },
    },
    create(ctx, p) {
      const pr = ctx.stage.portrait;
      ctx.beat.hideCaptions = ctx.beat.hideCaptions ?? false;
      return A.scene(ctx, {
        blot: { src: p.bg, focus: p.focus, lobes: [{ x: 0.24, y: 0.42, rx: 0.3, ry: 0.55 }, { x: 0.55, y: 0.36, rx: 0.32, ry: 0.5 }, { x: 0.78, y: 0.55, rx: 0.28, ry: 0.5 }, { x: 0.45, y: 0.75, rx: 0.3, ry: 0.35 }, { x: 0.12, y: 0.75, rx: 0.15, ry: 0.25 }], th: 0.34, alpha: 0.9, wash: 0.46, at: 0.05, dur: 0.75 },
        hands: pr ? [{ x: 0.08, y: 0.62, w: 0.5, h: 0.15 }, { x: 0.5, y: 0.08, w: 0.45, h: 0.14 }] : [{ x: 0.75, y: 0.13, w: 0.17, h: 0.27 }, { x: 0.065, y: 0.55, w: 0.23, h: 0.37 }],
        photos: [], enter: "none",
        blocks: [{ x: 0.5, y: pr ? 0.36 : 0.42, align: "center", title: (pr && p.titlePortrait) || p.title, sub: p.sub, at: 0.45 }],
      });
    },
  });

  /* ------------------------------------------------------------ photo */
  K.register({
    name: "acuarela.photo", tags: ["foto", "fecha", "lugar", "evento"], layer: "main",
    summary: "Una foto de archivo con marco (estampilla o copia vieja) que entra deslizándose y se asienta, mancha-foto que florece detrás, fecha grande con raya fina y párrafo corto que aparecen por tinta. layout: top (fecha centrada arriba), right (fecha abajo a la derecha), left (fecha abajo a la izquierda).",
    example: { src: "assets/media/mauerbau.jpg", date: "Agosto de 1961", text: "En una sola noche, soldados y obreros levantan alambre y bloques en medio de Berlín.", layout: "top", bg: "assets/media/leipzig.jpg" },
    params: {
      src: { type: "image", required: true, doc: "La foto principal." },
      date: { type: "string", default: "", doc: "Fecha o rótulo grande (Oswald, rojo ladrillo)." },
      text: { type: "string", default: "", doc: "Párrafo corto (1–3 renglones)." },
      layout: { type: "enum", options: ["top", "right", "left"], default: "top", doc: "Diagramación de la referencia." },
      bg: { type: "image", default: "", doc: "Foto de la mancha de fondo (vacío = la misma foto)." },
      frame: { type: "enum", options: ["stamp", "deckle"], default: "stamp", doc: "Marco: estampilla perforada o copia vieja." },
      enter: { type: "enum", options: ENTERS, default: "auto", doc: "Entrada de la foto (auto = la del layout)." },
      focus: FOCUS,
      bgFocus: FOCUS,
    },
    create(ctx, p) {
      const L = pick(PHOTO[p.layout], ctx);
      return A.scene(ctx, {
        blot: { src: p.bg || p.src, focus: p.bgFocus, lobes: A.lobesAround(L.p, 7 + p.layout.length, 5, ctx.stage.portrait ? 1.1 : 1.3), th: 0.42 },
        hands: L.h,
        photos: L.p.map((box, i) => ({ src: p.src, box, frame: p.frame, focus: p.focus })),
        enter: p.enter === "auto" ? L.enter : p.enter,
        blocks: blocks(L, [{ date: p.date, para: p.text }]),
      });
    },
  });

  /* ------------------------------------------------------------ pair */
  K.register({
    name: "acuarela.pair", tags: ["fotos", "comparación", "fecha", "collage"], layer: "main",
    summary: "Dos fotos superpuestas (la segunda tapa el borde de la primera y llega un instante después) + fecha y párrafo; mancha-foto y manuscrito detrás. layout: above (texto arriba, fotos abajo), right (fotos a la izquierda, fecha arriba a la derecha; entra girada con zoom), below (fotos arriba, fecha abajo), center (fotos lado a lado, fecha centrada; entra con zoom hacia atrás), dual (dos fechas, una por foto).",
    example: { a: "assets/media/bornholmer.jpg", b: "assets/media/muro-gente.jpg", date: "9 de noviembre", text: "Miles de personas llegan a los pasos fronterizos.", layout: "right" },
    params: {
      a: { type: "image", required: true, doc: "Primera foto (abajo en la pila)." },
      b: { type: "image", required: true, doc: "Segunda foto (arriba en la pila)." },
      date: { type: "string", default: "", doc: "Fecha principal." },
      text: { type: "string", default: "", doc: "Párrafo principal." },
      date2: { type: "string", default: "", doc: "Solo layout dual: segunda fecha." },
      text2: { type: "string", default: "", doc: "Solo layout dual: segundo párrafo." },
      layout: { type: "enum", options: ["above", "right", "below", "center", "dual"], default: "above", doc: "Diagramación de la referencia." },
      bg: { type: "image", default: "", doc: "Foto de la mancha de fondo (vacío = la primera)." },
      frameA: { type: "enum", options: ["stamp", "deckle"], default: "stamp", doc: "Marco de la primera foto." },
      frameB: { type: "enum", options: ["stamp", "deckle"], default: "deckle", doc: "Marco de la segunda foto." },
      enter: { type: "enum", options: ENTERS, default: "auto", doc: "Entrada del par (auto = la del layout)." },
      focusA: FOCUS, focusB: FOCUS, bgFocus: FOCUS,
    },
    create(ctx, p) {
      const L = pick(PAIR[p.layout], ctx);
      const texts = p.layout === "dual" ? [{ date: p.date, para: p.text }, { date: p.date2, para: p.text2 }] : [{ date: p.date, para: p.text }];
      return A.scene(ctx, {
        blot: { src: p.bg || p.a, focus: p.bgFocus, lobes: A.lobesAround(L.p, 13 + p.layout.length, 5, ctx.stage.portrait ? 1.05 : 1.2), th: 0.42 },
        hands: L.h,
        photos: [{ src: p.a, box: L.p[0], frame: p.frameA, focus: p.focusA }, { src: p.b, box: L.p[1], frame: p.frameB, focus: p.focusB }],
        enter: p.enter === "auto" ? L.enter : p.enter,
        blocks: blocks(L, texts),
      });
    },
  });

  /* ------------------------------------------------------------ quote */
  K.register({
    name: "acuarela.quote", tags: ["cita", "retrato", "frase", "personaje"], layer: "main",
    summary: "Retrato vertical (copia vieja) que entra desde la izquierda achicándose, cita en sans condensada a su derecha que aparece por manchas, firma en rojo ladrillo y una 'isla' de mancha-foto detrás.",
    example: { src: "assets/media/schabowski.jpg", quote: "Eso entra en vigor, según mi información, de inmediato, sin demora.", name: "Günter Schabowski", bg: "assets/media/bornholmer.jpg" },
    params: {
      src: { type: "image", required: true, doc: "Retrato (se recorta vertical)." },
      quote: { type: "string", required: true, doc: "La cita (2–5 renglones)." },
      name: { type: "string", default: "", doc: "Firma (rojo ladrillo)." },
      bg: { type: "image", default: "", doc: "Foto de la mancha de fondo." },
      focus: { type: "array", default: [0.5, 0.3], doc: "Punto de interés del retrato [x,y]." },
      bgFocus: FOCUS,
      frame: { type: "enum", options: ["stamp", "deckle"], default: "deckle", doc: "Marco del retrato." },
    },
    create(ctx, p) {
      const pr = ctx.stage.portrait;
      const box = pr ? [0.24, 0.07, 0.52, 0.36] : [0.165, 0.17, 0.21, 0.55];
      const lobes = pr ? [{ x: 0.6, y: 0.62, rx: 0.5, ry: 0.2 }, { x: 0.3, y: 0.3, rx: 0.4, ry: 0.2 }, { x: 0.75, y: 0.4, rx: 0.3, ry: 0.15 }]
                       : [{ x: 0.6, y: 0.42, rx: 0.32, ry: 0.42 }, { x: 0.36, y: 0.34, rx: 0.25, ry: 0.35 }, { x: 0.78, y: 0.62, rx: 0.17, ry: 0.3 }, { x: 0.5, y: 0.72, rx: 0.2, ry: 0.2 }];
      return A.scene(ctx, {
        blot: { src: p.bg || p.src, focus: p.bgFocus, lobes, th: 0.44, at: 0.55, dur: 1.2 },
        hands: pr ? [{ x: 0.05, y: 0.44, w: 0.45, h: 0.08 }] : [{ x: 0.07, y: 0.25, w: 0.1, h: 0.24 }, { x: 0.3, y: 0.58, w: 0.17, h: 0.29, over: true }, { x: 0.76, y: 0.15, w: 0.18, h: 0.33 }],
        photos: [{ src: p.src, box, frame: p.frame, focus: p.focus }],
        enter: "shrink",
        blocks: [pr ? { x: 0.07, y: 0.5, align: "left", quote: p.quote, name: p.name, nameX: 0.93, maxW: 0.86, at: 0.75 }
                    : { x: 0.455, y: 0.37, align: "left", quote: p.quote, name: p.name, nameX: 0.845, maxW: 0.39, at: 0.75 }],
      });
    },
  });
})();
