(function () {
  "use strict";
  const K = window.Kit, T = K.titanes, D = T.data;
  function wrap(g, text, width, maxSize, maxLines) {
    const words = String(text || "").toUpperCase().split(/\s+/).filter(Boolean);
    let size = maxSize, lines = [];
    // El tamaño cae solo hasta que todas las palabras caben, sin truncar el texto propio.
    for (let attempt = 0; attempt < 40; attempt++) {
      g.font = `400 ${size}px Anton`; lines = []; let current = "";
      for (const word of words) {
        const candidate = current ? current + " " + word : word;
        if (current && g.measureText(candidate).width > width) { lines.push(current); current = word; }
        else current = candidate;
      }
      if (current) lines.push(current);
      if (lines.length <= maxLines && lines.every(line => g.measureText(line).width <= width)) break;
      size *= .94;
    }
    return { lines, size, h: lines.length * size * 1.08 };
  }
  K.register({
    name: "titanes.titular", layer: "main", opaque: true, post: 0, tags: ["documento", "cita", "cartel", "titular"],
    summary: "Documento propio con sello y referencia, cita atribuida, cartel de una palabra o titular editorial compuesto.",
    example: { variante: "documento", text: "CORTE SUPREMA", fecha: "1936", sello: "ARCHIVO", referencia: "EE. UU.", bg: "archivo" },
    params: {
      ...D.params,
      variante: { type: "enum", default: "titular", options: ["documento", "cita", "cartel", "titular"], doc: "Composición editorial de texto propio." },
      text: { type: "string", default: "EL IMPERIO\nDE IBM", doc: "Texto principal. Cita breve hasta 25 palabras. Cartel de una palabra." },
      autor: { type: "string", default: "", doc: "Autor real de la cita. Se imprime exactamente como se suministra." },
      fecha: { type: "string", default: "", doc: "Año o fecha." },
      sello: { type: "string", default: "ARCHIVO", doc: "Sello tipográfico propio para documento." },
      referencia: { type: "string", default: "", doc: "Referencia judicial u oficial breve y verificada por producción." },
      antetitulo: { type: "string", default: "", doc: "Antetítulo del titular compuesto." },
    },
    create(ctx, p) {
      const st = ctx.stage, { H, u, portrait } = st, box = D.box(st), g = ctx.g.main, P = T.palette(ctx, p);
      const isDoc = p.variante === "documento", isQuote = p.variante === "cita", isPoster = p.variante === "cartel";
      const left = box.x + (isDoc ? u * 4 : 0), width = box.w - (isDoc ? u * 8 : 0);
      const layout = wrap(g, p.text, width, u * (isPoster ? 24 : isQuote ? 10 : 13), portrait ? (isQuote ? 6 : 4) : (isQuote ? 4 : 3));
      const textHeight = H * (portrait ? .45 : .58) - u * (isDoc ? 34 : isQuote ? 30 : 14);
      layout.size = Math.min(layout.size, textHeight / Math.max(1, layout.lines.length) / 1.08);
      layout.h = layout.lines.length * layout.size * 1.08;
      return D.scene(ctx, p, isDoc || isPoster ? "archivo" : "foco", t => {
        const y = H * (portrait ? .23 : .20), height = H * (portrait ? .45 : .58), ink = isDoc ? P.tinta : P.ink;
        g.save();
        const drift = (1 - K.prog(t, 0, 2.4)) * u * 4;
        g.translate(0, drift);
        if (isDoc) {
          g.save(); g.shadowColor = T.color(P.black, .85); g.shadowBlur = u * 4; g.shadowOffsetY = u * 2;
          g.fillStyle = P.graphite; g.fillRect(box.x + u * .8, y + u * .8, box.w, height);
          g.fillStyle = P.ink; g.fillRect(box.x, y, box.w, height); g.restore();
          D.line(g, [[left, y + u * 12], [left + width, y + u * 12]], T.color(P.tinta, .32), u * .2);
          D.label(g, p.fecha, left, y + u * 8, width * .8, u * 5.5, P.tinta);
          const textY = y + u * 18 + layout.size;
          T.title(g, layout, left, textY, t, { ...P, ink, rim: P.accent }, { at: .1 });
          D.label(g, p.referencia, left, y + height - u * 5, width * .63, u * 4.5, P.tinta, { weight: 400 });
          const stampW = width * .34, stampH = u * 8, stampX = left + width - stampW, stampY = y + height - u * 12;
          const impact = K.prog(t, 1.0, .35, "in");
          if (impact > 0) {
            g.save(); g.translate(stampX + stampW / 2, stampY + stampH / 2); g.rotate(-.10); g.scale(1 + .35 * (1 - impact), 1 + .35 * (1 - impact));
            g.strokeStyle = T.color(P.accent, .85); g.lineWidth = u * .3; g.strokeRect(-stampW / 2, -stampH / 2, stampW, stampH);
            D.label(g, p.sello, 0, u * 1.5, stampW * .86, u * 5, P.accent, { align: "center" }); g.restore();
          }
        } else {
          D.panel(g, box.x - u * 2, y - u * 5, box.w + u * 4, height + u * 5, P);
          if (isQuote) T.text(g, "“", left - u, y + u * 13, u * 25, P.rim, { font: "Anton" });
          const top = isQuote ? y + u * 15 : y + u * 5;
          const titleY = isPoster ? y + height * .58 : top + layout.size;
          if (!isQuote && !isPoster) D.label(g, p.antetitulo, left, y + u, width, u * 4, P.rim);
          T.title(g, layout, left, titleY, t, P, { at: .08, highlight: isPoster ? 0 : layout.lines.length - 1 });
          if (isQuote) {
            D.label(g, p.autor, left, y + height - u * 8, width, u * 4, P.ink);
            D.label(g, p.fecha, left, y + height - u * 2, width, u * 3.7, P.rim);
          } else D.label(g, p.fecha, left, y + height - u * 3, width, u * 4, P.rim);
        }
        g.restore(); D.source(g, st, p.fuente, P);
      });
    },
  });
})();
