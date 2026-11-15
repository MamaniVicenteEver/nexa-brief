(function () {
  "use strict";
  const K = window.Kit, T = K.titanes, D = T.data;
  function ticker(g, value, x, y, width, maximum, color, progress, decimals) {
    const target = D.format(value, decimals), size = Math.min(maximum, width / D.numberWidth(g, target, 100) * 100);
    const current = D.format(value * progress, decimals);
    const tick = progress < 1 ? (progress * 36) % 1 : 0;
    g.save(); g.beginPath(); g.rect(x - size * .05, y - size * 1.03, width + size * .1, size * 1.15); g.clip();
    D.drawNumber(g, current, x, y + tick * size * .14, size, color);
    g.restore();
    D.line(g, [[x, y + size * .15], [x + width, y + size * .15]], T.color(color, .25), 1);
    return size;
  }
  K.register({
    name: "titanes.cifra", layer: "main", opaque: true, post: 0, tags: ["datos", "contador", "dinero", "comparación"],
    summary: "Cifra monumental con tic mecánico, signo semántico, comparación y hasta tres cifras secuenciales.",
    example: { valor: -8100, sufijo: "M", prefijo: "US$", contexto: "PÉRDIDAS", fecha: "1993", bg: "mercado" },
    params: {
      ...D.params,
      valor: { type: "number", default: 5000, doc: "Valor numérico final. Negativo activa sangre." },
      prefijo: { type: "string", default: "", doc: "Unidad anterior, p. ej. US$." },
      sufijo: { type: "string", default: "", doc: "Unidad posterior, p. ej. M o %." },
      contexto: { type: "string", default: "INVERSIÓN", doc: "Qué mide la cifra." },
      fecha: { type: "string", default: "", doc: "Año o fecha del dato." },
      decimales: { type: "number", default: 0, min: 0, max: 6, doc: "Decimales visibles con coma española." },
      modo: { type: "enum", default: "simple", options: ["simple", "comparacion", "secuencia"], doc: "Una cifra, antes/después o una secuencia de hasta tres." },
      antes: { type: "number", default: 1.21, doc: "Valor anterior en comparación. valor es el posterior." },
      cambioEn: { type: "number", default: 2.2, min: 0, doc: "Segundo local de la comparación, admite ancla @palabra." },
      tachado: { type: "bool", default: false, doc: "Tacha el dato anterior al entrar el posterior." },
      cifras: { type: "array", default: [], doc: "Hasta 3 objetos {valor,prefijo,sufijo,contexto,fecha,decimales,at}. at opcional en segundos locales." },
      contarEn: { type: "number", default: 1.5, min: .3, max: 3, doc: "Duración del contador mecánico." },
    },
    create(ctx, p) {
      const { stage: st } = ctx, { W, H, u, portrait } = st, g = ctx.g.main, P = T.palette(ctx, p), box = D.box(st);
      const items = (p.modo === "secuencia" && p.cifras.length ? p.cifras.slice(0, 3) : [p]).map(v => ({ ...p, ...v, valor: D.finite(v.valor) }));
      return D.scene(ctx, p, "mercado", (t, beat) => {
        g.fillStyle = T.color(P.black, .34); g.fillRect(0, 0, W, H);
        const active = D.active(items, t, beat.dur), item = active.item, local = t - active.at;
        const compare = p.modo === "comparacion", changed = compare && t >= p.cambioEn;
        const value = compare && !changed ? p.antes : item.valor;
        const negative = compare ? item.valor < p.antes : value < 0;
        const color = negative ? P.blood : P.gold;
        T.glow(g, W * .6, H * .52, W * .62, H * .40, color, .25 * K.prog(local, .2, 1.5));
        D.heading(g, st, item.contexto || p.titulo, P);
        D.label(g, item.fecha, box.x, H * (portrait ? .23 : .28), box.w, u * 4.2, P.rim);
        const numberY = H * (portrait ? .49 : .60), time = changed ? t - p.cambioEn : local;
        const progress = K.prog(Math.floor(time * 18) / 18, .08, p.contarEn, "out");
        const shock = changed ? Math.sin(time * 67) * 8 * (1 - K.prog(time, 0, .45)) : 0;
        g.save(); g.translate(shock, shock * .35);
        const size = ticker(g, value, box.x, numberY, box.w, u * (portrait ? 22 : 28), color, progress, item.decimales);
        D.label(g, item.prefijo, box.x, numberY - size * .85 - u * 3, box.w, u * 4, P.ink);
        D.label(g, item.sufijo, box.right, numberY + u * 7, box.w, u * 6, color, { align: "right" });
        g.restore();
        if (changed) {
          const old = D.format(p.antes, item.decimales), y = H * (portrait ? .64 : .78), size = u * (portrait ? 5.5 : 5);
          const oldWidth = D.numberWidth(g, old, size);
          D.drawNumber(g, old, box.x, y, size, P.ink);
          if (p.tachado) D.line(g, [[box.x, y - size * .35], [box.x + oldWidth, y - size * .35]], color, u * .35);
          const ax = box.x + oldWidth + u * 3;
          D.line(g, [[ax, y - size * .35], [ax + u * 7, y - size * .35], [ax + u * 5.5, y - size * .65]], color, u * .3);
          D.line(g, [[ax + u * 7, y - size * .35], [ax + u * 5.5, y]], color, u * .3);
        }
        if (active.index > 0 && local < .3) T.transition(g, st, "luz", 1 - K.prog(local, 0, .3), P, p.semilla);
        D.source(g, st, p.fuente, P);
      });
    },
  });
})();
