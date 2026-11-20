(function () {
  "use strict";
  const K = window.Kit, T = K.titanes, D = T.data;
  K.register({
    name: "titanes.duelo", layer: "main", opaque: true, post: 0, tags: ["competencia", "nombres", "ganador"],
    summary: "Dos o tres nombres monumentales en planos enfrentados, métricas opcionales y resolución con ganador.",
    example: { lados: [{ nombre: "OS/2" }, { nombre: "WINDOWS" }], ganador: "WINDOWS", ganadorEn: 3.2, bg: "sala" },
    params: {
      ...D.params,
      lados: { type: "array", default: [{ nombre: "OS/2" }, { nombre: "WINDOWS" }], doc: "2 o 3 objetos {nombre,metrica?}. Se conserva la tipografía del diseño." },
      ganador: { type: "string", default: "", doc: "Nombre exacto del lado ganador. Vacío mantiene el duelo abierto." },
      ganadorEn: { type: "number", default: 3.2, min: 0, doc: "Segundo local de la resolución, admite @palabra." },
      veredicto: { type: "string", default: "GANA", doc: "Texto breve del resultado." },
    },
    create(ctx, p) {
      const st = ctx.stage, { H, u, portrait } = st, g = ctx.g.main, P = T.palette(ctx, p), box = D.box(st), sides = p.lados.slice(0, 3);
      return D.scene(ctx, p, "sala", t => {
        D.heading(g, st, p.titulo, P);
        const resolved = t >= p.ganadorEn && sides.some(s => s.nombre === p.ganador), q = K.prog(t, p.ganadorEn, .45);
        const n = Math.max(1, sides.length), gap = u * 3.5;
        const width = portrait ? box.w : (box.w - gap * (n - 1)) / n;
        const height = portrait ? H * .47 / n - gap : H * .46;
        sides.forEach((side, i) => {
          const x = portrait ? box.x : box.x + i * (width + gap), y = portrait ? H * .22 + i * (height + gap) : H * .28;
          const winner = resolved && side.nombre === p.ganador, color = winner ? P.gold : P.rim;
          const entry = (1 - K.prog(t, .05 + i * .10, 1.8)) * u * 8;
          g.save(); g.translate(0, entry);
          if (resolved && !winner) g.globalAlpha = .5;
          T.glow(g, x + width / 2, y + height / 2, width, height, color, winner ? .55 : .25);
          D.panel(g, x, y, width, height, P, color);
          const nameSize = u * (portrait ? 9 : n === 3 ? 9 : 12), nameY = y + height * .55;
          D.label(g, String(side.nombre || "").toUpperCase(), x + width * .07, nameY, width * .86, nameSize, winner ? P.gold : P.ink, { font: "Anton", weight: 400 });
          if (side.metrica != null) D.label(g, side.metrica, x + width * .07, y + height * .79, width * .86, u * 4.3, color);
          if (winner) {
            g.fillStyle = color; g.fillRect(x, y, width * q, u * .6);
            D.label(g, p.veredicto, x + width * .07, y + height * .22, width * .86, u * 3.6, color);
          }
          g.restore();
        });
        if (resolved && t - p.ganadorEn < .25) T.transition(g, st, "luz", 1 - K.prog(t, p.ganadorEn, .25), P, p.semilla);
        D.source(g, st, p.fuente, P);
      });
    },
  });
})();
