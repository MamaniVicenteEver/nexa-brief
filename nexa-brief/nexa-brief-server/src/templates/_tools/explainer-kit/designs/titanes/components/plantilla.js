(function () {
  "use strict";
  const K = window.Kit, T = K.titanes, D = T.data;
  K.register({
    name: "titanes.plantilla", layer: "main", opaque: true, post: 0, tags: ["datos", "empleo", "despidos", "cuadrícula"],
    summary: "Cuadrícula de ilustraciones que crece y se vacía en sangre. Conteo exacto y equivalencia por figura, incluidas celdas parciales.",
    example: { titulo: "PERSONAS", total: 405000, hasta: 220000, porFigura: 15000, figura: T.sample("de-pie"), bg: "ciudad" },
    params: {
      ...D.params,
      titulo: { type: "string", default: "PERSONAS", doc: "Qué cuenta la cuadrícula." },
      total: { type: "number", default: 405000, min: 0, doc: "Plantilla máxima." },
      desde: { type: "number", default: 0, min: 0, doc: "Valor desde el que crece, entre cero y total." },
      hasta: { type: "number", default: 220000, min: 0, doc: "Plantilla restante tras el recorte. Igualar a total para solo crecer." },
      porFigura: { type: "number", default: 15000, min: 1, doc: "Personas por figura. Hasta 240 celdas visibles, luego se ajusta y se rotula la equivalencia efectiva." },
      crecerEn: { type: "number", default: 1.7, min: .3, max: 3, doc: "Duración del crecimiento." },
      vaciarEn: { type: "number", default: 3.1, min: 0, doc: "Inicio del vaciado, admite @palabra." },
      vaciadoDur: { type: "number", default: .5, min: .3, max: 3, doc: "Duración del vaciado." },
      abreviar: { type: "bool", default: false, doc: "Usar 405 mil. El formato completo 405.000 también cabe en vertical." },
      fecha: { type: "string", default: "", doc: "Contexto temporal breve." },
      equivalencia: { type: "string", default: "personas / figura", doc: "Texto de la equivalencia junto al valor numérico." },
      figura: { ...T.figureParams.figura, default: T.sample("de-pie") },
    },
    async prepare(beats) { await D.prepareImages(beats.map(b => b.params?.figura || T.sample("de-pie"))); },
    create(ctx, p) {
      const st = ctx.stage, { H, u, portrait } = st, box = D.box(st), P = T.palette(ctx, p), g = ctx.g.main;
      const total = D.finite(p.total), unit = Math.max(p.porFigura, Math.ceil(total / 240)), count = Math.ceil(total / unit);
      const columns = Math.max(1, Math.ceil(Math.sqrt(count * (portrait ? 1.05 : 3.4)))), rows = Math.max(1, Math.ceil(count / columns));
      const cellW = box.w / columns, height = H * (portrait ? .29 : .35), cellH = height / rows, y = H * (portrait ? .35 : .39);
      const sprites = [P.rim, P.blood].map(color => {
        const c = T.canvas(120, 180), cg = c.getContext("2d");
        const figure = T.figure(ctx, { ...p, borde: color, acento: color, escalaFigura: 1 });
        figure.draw(cg, 60, 169, 154, 0); figure.dispose(); return c;
      });
      return D.scene(ctx, p, "ciudad", t => {
        const before = K.clamp(p.desde, 0, total), target = K.clamp(p.hasta, 0, total);
        const grown = K.lerp(before, total, K.prog(t, .08, p.crecerEn)), cut = K.prog(t, p.vaciarEn, p.vaciadoDur, "in");
        const countAtCut = K.lerp(before, total, K.prog(p.vaciarEn, .08, p.crecerEn));
        const value = t < p.vaciarEn ? grown : K.lerp(countAtCut, target, cut), color = cut > 0 && target < total ? P.blood : P.rim;
        D.heading(g, st, p.titulo, P);
        D.number(g, D.format(Math.round(value), 0, p.abreviar), box.x, H * (portrait ? .29 : .35), box.w, u * 18, color);
        T.glow(g, box.x + box.w * .5, y + height * .5, box.w * .8, height, color, .28);
        D.panel(g, box.x - u * 2, y - u * 2, box.w + u * 4, height + u * 4, P, color);
        const spriteH = Math.min(cellH * .94, cellW * 1.65), spriteW = spriteH * 2 / 3;
        for (let i = 0; i < count; i++) {
          const xx = box.x + (i % columns + .5) * cellW - spriteW / 2, yy = y + Math.floor(i / columns) * cellH;
          const fraction = K.clamp(value / unit - i), occupied = K.clamp(total / unit - i);
          g.save(); g.globalAlpha = .10; g.drawImage(sprites[cut > 0 && i >= value / unit ? 1 : 0], xx, yy, spriteW, spriteH); g.restore();
          if (t >= p.vaciarEn && i >= Math.floor(target / unit)) {
            const alpha = K.clamp(1 - cut) * occupied;
            g.save(); g.globalAlpha = alpha; g.drawImage(sprites[1], xx, yy + cut * cellH * .35, spriteW, spriteH); g.restore();
          }
          if (fraction > 0) {
            g.save(); g.beginPath(); g.rect(xx, yy + spriteH * (1 - fraction), spriteW, spriteH * fraction); g.clip();
            g.drawImage(sprites[0], xx, yy, spriteW, spriteH); g.restore();
          }
        }
        const labelY = y + height + u * 4;
        D.label(g, `${D.format(unit)} ${p.equivalencia}`, box.x, labelY, box.w, u * 3, P.ink, { weight: 400 });
        D.label(g, p.fecha, box.x, labelY + u * 4.7, box.w, u * 3.1, P.rim);
        D.source(g, st, p.fuente, P);
      }, () => sprites.forEach(c => { c.width = c.height = 1; }));
    },
  });
})();
