(function () {
  "use strict";
  const K = window.Kit, T = K.titanes, D = T.data;
  function object(g, kind, x, bottom, w, h, P, color) {
    if (h <= 0 || w <= 0) return;
    g.save();
    T.glow(g, x, bottom - h * .5, Math.max(w * 1.2, 1), h * .8, color, .24);
    const fill = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    fill.addColorStop(0, P.tinta); fill.addColorStop(.65, P.graphite); fill.addColorStop(1, T.color(color, .5));
    g.fillStyle = fill; g.strokeStyle = color; g.lineWidth = Math.max(1, w * .012);
    if (kind === "moneda") {
      g.beginPath(); g.ellipse(x + w * .06, bottom - h * .48, w / 2, h * .48, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(x, bottom - h * .5, w / 2, h * .48, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      g.beginPath(); g.ellipse(x, bottom - h * .5, w * .39, h * .38, 0, 0, Math.PI * 2); g.stroke();
      for (let i = 0; i < 18; i++) {
        const angle = i * Math.PI / 9;
        D.line(g, [[x + Math.cos(angle) * w * .41, bottom - h * .5 + Math.sin(angle) * h * .40], [x + Math.cos(angle) * w * .46, bottom - h * .5 + Math.sin(angle) * h * .45]], T.color(color, .55), Math.max(.5, w * .012));
      }
    } else if (kind === "tarjeta") {
      g.fillRect(x - w / 2, bottom - h, w, h); g.strokeRect(x - w / 2, bottom - h, w, h);
      for (let col = 0; col < 9; col++) for (let row = 0; row < 4; row++) if ((col * 7 + row * 3) % 4) {
        g.fillStyle = T.color(color, .7); g.fillRect(x - w * .4 + col * w * .09, bottom - h * .8 + row * h * .16, w * .025, h * .07);
      }
    } else {
      g.fillRect(x - w / 2, bottom - h, w * .83, h);
      g.beginPath(); g.moveTo(x + w * .33, bottom - h); g.lineTo(x + w * .5, bottom - h * .94); g.lineTo(x + w * .5, bottom); g.lineTo(x + w * .33, bottom); g.closePath(); g.fill();
      D.line(g, [[x - w / 2, bottom], [x - w / 2, bottom - h], [x + w * .33, bottom - h], [x + w * .33, bottom]], color, Math.max(1, w * .012));
      for (let row = 0; row < 13; row++) for (let col = 0; col < 5; col++) {
        g.fillStyle = T.color(color, ((row + col * 3) % 4 === 0) ? .8 : .2);
        g.fillRect(x - w * .39 + col * w * .13, bottom - h * .94 + row * h * .067, w * .05, h * .025);
      }
    }
    T.glow(g, x, bottom + h * .015, w * .8, Math.max(1, h * .035), color, .35); g.restore();
  }
  K.register({
    name: "titanes.escala", layer: "main", opaque: true, post: 0, tags: ["datos", "escala", "proporción"],
    summary: "Compara entidades mediante edificios, monedas, tarjetas o ilustraciones por imagen. Área o altura proporcional explícita.",
    example: { titulo: "CAPITAL", entidades: [{ nombre: "MATRIZ", valor: 100 }, { nombre: "FILIAL", valor: 10 }], unidad: "M", forma: "edificio", bg: "ciudad" },
    params: {
      ...D.params,
      entidades: { type: "array", default: [{ nombre: "A", valor: 100 }, { nombre: "B", valor: 10 }], doc: "Entidades {nombre,valor,src?}. Usar valores positivos. Las imágenes src se precargan automáticamente." },
      forma: { type: "enum", default: "edificio", options: ["edificio", "moneda", "tarjeta", "figura"], doc: "Silueta económica o figura de la biblioteca por src." },
      proporcion: { type: "enum", default: "area", options: ["area", "altura"], doc: "area escala ambos ejes con raíz del dato. altura conserva ancho y escala alto. En figura, altura mantiene proporciones del PNG." },
      figura: { ...T.figureParams.figura, default: T.sample("de-pie"), doc: "Imagen común para forma figura cuando una entidad no indica src." },
      unidad: { type: "string", default: "", doc: "Unidad junto a cada valor." },
      decimales: { type: "number", default: 0, min: 0, max: 6, doc: "Decimales de las etiquetas." },
    },
    async prepare(beats) {
      await D.prepareImages(beats.flatMap(b => [b.params?.figura || T.sample("de-pie"), ...(b.params?.entidades || []).map(e => e.src)]));
    },
    create(ctx, p) {
      const st = ctx.stage, { H, u, portrait } = st, box = D.box(st), g = ctx.g.main, P = T.palette(ctx, p);
      const entities = p.entidades.filter(Boolean).map(v => ({ ...v, valor: Math.max(0, D.finite(v.valor)) }));
      const maximum = Math.max(1, ...entities.map(v => v.valor)), columns = Math.min(entities.length || 1, portrait ? 2 : 4), rows = Math.ceil(entities.length / columns);
      const figures = entities.map(e => p.forma === "figura" ? T.figure(ctx, { ...p, figura: e.src || p.figura, escalaFigura: 1 }) : null);
      return D.scene(ctx, p, "ciudad", t => {
        D.heading(g, st, p.titulo, P);
        const cellW = box.w / columns, cellH = H * (portrait ? .45 : .57) / Math.max(1, rows), startY = H * (portrait ? .23 : .24);
        entities.forEach((entity, i) => {
          const col = i % columns, row = Math.floor(i / columns), x = box.x + cellW * (col + .5), bottom = startY + row * cellH + cellH * .72;
          const ratio = entity.valor / maximum, scale = p.proporcion === "area" ? Math.sqrt(ratio) : ratio;
          const aspect = p.forma === "moneda" ? 1 : p.forma === "tarjeta" ? 1.8 : null;
          const baseH = aspect ? Math.min(cellH * .69, cellW * .70 / aspect) : cellH * .69;
          const baseW = aspect ? baseH * aspect : cellW * .62;
          const grow = K.prog(t, .08, 2.2, "out"), h = baseH * scale * grow;
          const width = baseW * (p.proporcion === "area" ? scale : 1) * grow;
          const color = i === 0 ? P.rim : P.gold;
          if (figures[i]) figures[i].draw(g, x, bottom, h, 0);
          else object(g, p.forma, x, bottom, width, h, P, color);
          D.label(g, entity.nombre, x, bottom + u * 5, cellW * .90, u * (portrait ? 5 : 4.7), P.ink, { align: "center", font: "Anton", weight: 400 });
          D.label(g, `${D.format(entity.valor, p.decimales)}${p.unidad ? " " + p.unidad : ""}`, x, bottom + u * 10, cellW * .90, u * 4.8, color, { align: "center" });
        });
        D.source(g, st, p.fuente, P);
      }, () => figures.forEach(f => f?.dispose()));
    },
  });
})();
