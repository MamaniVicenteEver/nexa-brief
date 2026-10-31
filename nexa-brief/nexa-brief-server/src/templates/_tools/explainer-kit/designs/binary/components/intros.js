/* =============================================================================
   binary · intros para miniaturas del paquete de publicación
   ----------------------------------------------------------------------------
   introv1 (solo texto): el título hecho de partículas 0/1, en blanco puro.
   introv2 (texto e imagen): el mismo texto, más chico, en una mitad y el retrato
   en glifos en la otra. Qué lado lleva la foto lo decide `imageSide` (auto =
   alterna entre videos según el texto, para que las intros no se vean iguales).

   Reglas comunes a las dos (estándar para videos nuevos con este diseño):
   · texto en blanco puro (color 1 = palette.accent), más opaco que un título normal;
   · antetítulo (fecha, lugar) justo encima del texto: letras blancas en introv1, caja blanca con letra negra en introv2;
   · texto, antetítulo y foto centrados en el alto del cuadro;
   · el retrato usa Kit.binary.samplePortrait (recorte, contraste, óvalo, presupuesto).
   El campo tiene un tope de partículas (config.binary.particles): el texto se arma
   primero y la foto usa lo que queda.
   ========================================================================== */
(function () {
  const K = Kit, B = Kit.binary, { clamp } = K;
  const TITLE = K.registry.get("binary.title");
  const WHITE = 1;                       /* fila del atlas con palette.accent */
  const FONT = "900 100px Inter", LEAD = 1.1;
  const measure = document.createElement("canvas").getContext("2d");

  function titleText(ctx, p) {
    return ctx.stage.portrait && p.textPortrait ? p.textPortrait : p.text;
  }

  /** Corta un texto sin saltos en 1–3 renglones: el corte que deja la letra más grande en la caja (aspecto w/h). */
  function wrapLines(text, aspect) {
    if (text.includes("\n")) return text;
    const words = text.trim().split(/\s+/);
    const split = (from, left) => {
      if (left === 1) return [[words.slice(from).join(" ")]];
      const out = [];
      for (let k = from + 1; k <= words.length - left + 1; k++)
        for (const rest of split(k, left - 1)) out.push([words.slice(from, k).join(" "), ...rest]);
      return out;
    };
    let best = null;
    for (let count = 1; count <= Math.min(3, words.length); count++) {
      for (const lines of split(0, count)) {
        /* alto de letra relativo: lo limita el renglón más largo (~0.68 em por letra) o la cantidad de renglones */
        const size = Math.min(aspect / (0.68 * Math.max(...lines.map(l => l.length))), 1 / (LEAD * lines.length));
        if (!best || size > best.size + 1e-9) best = { lines, size };
      }
    }
    return best.lines.join("\n");
  }

  /** Lleva un texto muestreado a blanco puro, más opaco y con glifos de tamaño medio como mínimo. */
  function brightText(points, lift) {
    for (const q of points) { q.a = clamp(q.a * 1.15 + lift); q.c = WHITE; q.s = Math.max(q.s, 1); }
    return points;
  }

  /** Mismo efecto sobre una forma ya empaquetada (la de binary.title). */
  function brightPacked(P, lift) {
    for (let i = 0; i < P.n; i++) { P.a[i] = clamp(P.a[i] * 1.15 + lift); P.c[i] = WHITE; P.s[i] = Math.max(P.s[i], 1); }
    return P;
  }

  /** Antetítulo (fecha, lugar): letras blancas sin caja, para que se lean sobre el negro. */
  function kicker(G, text, x, y, u, alpha, C) {
    B.tag(G, String(text).toUpperCase(), x, y, { u, size: 1.6, alpha, boxed: false, color: C.accent });
  }

  /** Lado de la foto en introv2: "left" | "right"; "auto" alterna según el texto (fijo para un mismo video). */
  function imageSide(p) {
    if (p.imageSide === "left" || p.imageSide === "right") return p.imageSide;
    return K.hash(p.text) % 2 ? "left" : "right";
  }

  /** Cajas de introv2. 16:9: mitades izquierda/derecha según el lado; 9:16: foto arriba, texto abajo
      (abajo la interfaz de TikTok/Reels tapa la imagen). La caja del texto se ajusta al bloque real. */
  function layout(ctx, p) {
    const { content: c, portrait, u, H } = ctx.stage;
    const text = titleText(ctx, p);
    let image, area;
    if (portrait) {
      image = { x: c.x, y: c.y - c.h * 0.04, w: c.w, h: c.h * 0.66 };
      area = { x: c.x, y: c.y + c.h * 0.7, w: c.w, h: c.h * 0.31 };
    } else {
      const imageLeft = imageSide(p) === "left";
      /* centrado en el alto del cuadro (no del área de contenido, que deja lugar a los subtítulos: la intro no los muestra) */
      image = { x: c.x + c.w * (imageLeft ? 0 : 0.52), y: H / 2 - c.h * 0.52, w: c.w * 0.48, h: c.h * 1.04 };
      area = { x: c.x + c.w * (imageLeft ? 0.52 : 0), y: c.y + c.h * 0.17, w: c.w * 0.48, h: c.h * 0.66 };
    }
    const lines = wrapLines(text, area.w / area.h);
    /* alto real del bloque de texto (textLayout lo centra en su caja) → caja justa, centrada en el área */
    const rows = B.textLayout(measure, lines, area.w, area.h, FONT, "block", LEAD);
    const blockH = rows.reduce((sum, r) => sum + r.fs * LEAD, 0);
    /* en 16:9 el grupo antetítulo + texto queda centrado en el alto del cuadro, como la foto */
    const kickerGap = p.kicker ? u * 7 : 0;
    const top = portrait ? area.y + (area.h - blockH) / 2 : H / 2 - (blockH - kickerGap) / 2;
    return { image, text: { x: area.x, y: top, w: area.w, h: blockH }, lines, kickerGap };
  }

  K.register({
    name: "binary.introv1", tags: ["intro", "miniatura", "solo texto"], layer: "main",
    summary: "Miniatura de solo texto en el estilo monocromo de binary: el título hecho de partículas 0/1, en blanco puro, con la fecha en letras blancas encima.",
    example: { text: "EL HOMBRE\nQUE ROMPIÓ\nENIGMA", kicker: "ALAN TURING · 1940", highlight: "ENIGMA" },
    params: {
      ...TITLE.params,
      kicker: { type: "string", default: "", doc: "Antetítulo (fecha, lugar) en letras blancas sobre el título." },
      highlight: { type: "string", default: "", doc: "Frase opcional que se destaca en una etiqueta invertida debajo del título." },
      sub: { type: "string", default: "", doc: "Línea mono opcional debajo del título." },
      glow: { type: "number", default: 0.3, min: 0, max: 0.6, doc: "Opacidad extra de los glifos del texto (más = blanco más luminoso)." },
    },
    points(ctx, p) { return brightPacked(TITLE.points(ctx, p), p.glow); },
    motion: TITLE.motion,
    create(ctx, p) {
      /* el antetítulo lo dibuja este componente (en blanco), no binary.title (en caja) */
      const base = TITLE.create(ctx, { ...p, kicker: "" });
      return {
        render(lt, beat, t) {
          base.render(lt, beat, t);
          const { W, H, u } = ctx.stage, G = ctx.g.top, C = ctx.C.palette, a = clamp((lt - 0.8) / 0.5);
          /* binary.title ocupa de 0,17·H a 0,83·H (16:9) y de 0,17·H a 0,77·H (9:16) */
          if (p.kicker) kicker(G, p.kicker, W / 2, H * 0.17 - u * 4, u, a, C);
          if (p.highlight) B.tag(G, String(p.highlight).toUpperCase(), W / 2, H * 0.91, { u, size: 1.45, alpha: a, bg: C.accent, color: C.bg });
          if (p.sub) B.mono(G, String(p.sub).toUpperCase(), W / 2, H * 0.96, { u, size: 1.25, alpha: a * 0.8, color: C.accent });
        },
      };
    },
  });

  K.register({
    name: "binary.introv2", tags: ["intro", "miniatura", "texto e imagen"], layer: "main",
    summary: "Miniatura de texto e imagen: la frase (como en introv1, más chica) en una mitad y el retrato en glifos 0/1 en la otra; el lado de la foto se elige con imageSide.",
    example: { text: "ELLA LO\nPREVIÓ", kicker: "APOLO 11 · 1969", src: "assets/media/hamilton.jpg", imageSide: "right" },
    params: {
      text: { type: "string", required: true, doc: "Texto de la miniatura; sin '\\n' se corta solo en 1–3 renglones (el corte con la letra más grande)." },
      textPortrait: { type: "string", default: "", doc: "Cortes alternativos para 9:16." },
      kicker: { type: "string", default: "", doc: "Antetítulo (fecha, lugar) en caja blanca con letra negra sobre el texto." },
      highlight: { type: "string", default: "", doc: "Frase opcional que se destaca en una etiqueta invertida debajo del texto." },
      sub: { type: "string", default: "", doc: "Línea mono opcional debajo del texto." },
      src: { type: "image", default: "", doc: "Retrato o foto del tema (archivo de assets/media/ o URL). Vacío = cartel «IMAGEN PENDIENTE»." },
      video: { type: "video", default: "", doc: "Clip .mp4 local, siempre mudo, convertido a glifos." },
      poster: { type: "image", default: "", doc: "Imagen inicial y respaldo; si falta, usa src." },
      start: { type: "number", default: 0, min: 0, doc: "Segundo inicial del clip." },
      rate: { type: "number", default: 1, min: 0.25, max: 2, doc: "Velocidad del clip." },
      loop: { type: "bool", default: true, doc: "Repite el clip si termina antes del beat; evita congelar." },
      imageSide: { type: "enum", options: ["auto", "left", "right"], default: "auto", doc: "Lado de la foto en 16:9 (el texto va en el otro). auto = alterna entre videos según el texto, así las intros no se ven siempre iguales; left/right lo fija (p. ej. para que el rostro mire hacia el texto). En 9:16 la foto va siempre arriba." },
      zoom: { type: "number", default: 1.2, min: 1, max: 3, doc: "Ampliación de la foto (1 = entera): un retrato más grande se reconoce mejor." },
      focusX: { type: "number", default: 0.5, min: 0, max: 1, doc: "Centro del recorte en la foto, horizontal (0 = izquierda). Moverlo hacia el rostro si queda cortado." },
      focusY: { type: "number", default: 0.5, min: 0, max: 1, doc: "Centro del recorte en la foto, vertical (0 = arriba)." },
      imageCell: { type: "number", default: 0.65, min: 0.5, max: 1.5, doc: "Escala de glifos de la fotografía (menor = más detalle)." },
      contrast: { type: "number", default: 1.9, min: 1, max: 2.5, doc: "Contraste de la foto antes de muestrear (más = luces y sombras más separadas)." },
      gamma: { type: "number", default: 1, min: 1, max: 3, doc: "Curva de la foto: más alto = medios tonos y sombras más oscuros." },
      threshold: { type: "number", default: 0.14, min: 0, max: 0.8, doc: "Brillo mínimo para formar la imagen (lo que queda debajo es negro)." },
      glow: { type: "number", default: 0.3, min: 0, max: 0.6, doc: "Opacidad extra de los glifos del texto (más = blanco más luminoso)." },
      morph: { type: "number", default: 1.1, doc: "Segundos para armar texto e imagen." },
      ...K.brandLogo.params,
    },
    dynamicPoints: true,
    points(ctx, p, lt = 0) {
      const L = layout(ctx, p), N = ctx.family.binary.N;
      let media = ctx.img(p.video ? (p.poster || p.src) : p.src);
      if (p.video) {
        const time = p.start + Math.max(0, lt) * p.rate;
        const v = ctx.clip(p.video, time);
        if (v) {
          if (p.loop && Number.isFinite(v.duration) && v.duration > 0) ctx.clip(p.video, time % v.duration);
          v.muted = true; v.playbackRate = p.rate;
          if (lt > 0 || !media) media = v;
        }
      }
      const phrase = brightText(B.sampleText(L.lines, L.text, {
        font: FONT, fit: "block", lead: LEAD, cell: B.cellOf(ctx, 0.55), jitter: 0.12, alpha: 0.95, edge: true,
      }), p.glow);
      /* el texto nunca se submuestrea: la foto se ajusta al resto del presupuesto */
      const photo = B.samplePortrait(media, L.image, {
        zoom: p.zoom, focusX: p.focusX, focusY: p.focusY, cell: B.cellOf(ctx, p.imageCell),
        contrast: p.contrast, gamma: p.gamma, threshold: p.threshold, max: N - phrase.length,
      });
      return B.pack([...photo, ...phrase], N);
    },
    motion(lt) { return { s: 1 + lt * 0.002, x: 0, y: 0, r: 0 }; },
    create(ctx, p) {
      ctx.beat.hideCaptions = true;
      const L = layout(ctx, p), { u, portrait, content: c } = ctx.stage, G = ctx.g.top, C = ctx.C.palette;
      const logo = K.brandLogo.attach(ctx, p, L.image, [p.focusX, p.focusY]);
      const textX = L.text.x + L.text.w / 2, imageX = L.image.x + L.image.w / 2;
      return {
        render(lt, beat) {
          const a = clamp((lt - 0.15) / 0.55) * clamp((beat.dur - lt) / 0.4 + 0.2);
          /* línea que separa las dos mitades */
          G.save(); G.globalAlpha = a * 0.7; G.strokeStyle = C.ink; G.lineWidth = Math.max(1, u * 0.12);
          G.beginPath();
          if (portrait) {
            const y = L.image.y + L.image.h + u * 1.5;
            G.moveTo(c.x + c.w * 0.04, y); G.lineTo(c.x + c.w * 0.96, y);
          } else {
            const x = c.x + c.w * 0.5;
            G.moveTo(x, ctx.stage.H / 2 - c.h * 0.36); G.lineTo(x, ctx.stage.H / 2 + c.h * 0.36);
          }
          G.stroke(); G.restore();
          /* antetítulo en caja blanca con letra negra (como antes, 15% más grande: 1,35 → 1,55) */
          if (p.kicker) B.tag(G, String(p.kicker).toUpperCase(), textX, L.text.y - L.kickerGap / 2 - u * 2, { u, size: 1.55, alpha: a, bg: "#ffffff", color: "#000000" });
          if (p.highlight) B.tag(G, String(p.highlight).toUpperCase(), textX, L.text.y + L.text.h + u * 3, { u, size: 1.25, alpha: a, bg: C.accent, color: C.bg });
          if (p.sub) B.mono(G, String(p.sub).toUpperCase(), textX, L.text.y + L.text.h + u * 7, { u, size: 1.15, alpha: a * 0.8, color: C.accent });
          if (!ctx.img(p.video ? (p.poster || p.src) : p.src) && (!p.video || !K.loadedVideos.has(p.video))) B.tag(G, "IMAGEN PENDIENTE", imageX, L.image.y + L.image.h / 2, { u, size: 1.2, alpha: a, bg: C.accent, color: C.bg });
          if (logo) logo.render(lt);
        },
        dispose() { const v = p.video && K.loadedVideos.get(p.video); if (v) v.playbackRate = 1; if (logo) logo.dispose(); },
      };
    },
  });
})();
