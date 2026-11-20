(function () {
  "use strict";
  const K = window.Kit, T = K.titanes, D = T.data;
  K.register({
    name: "titanes.cronologia", layer: "main", opaque: true, post: 0, tags: ["tiempo", "eras", "saltos"],
    summary: "Una era ocupa el cuadro. Años monumentales que saltan por barrido de luz y dejan visible el punto de partida.",
    example: { eras: [{ ano: "1964", titulo: "SYSTEM/360" }, { ano: "1981", titulo: "EL PC" }, { ano: "1993", titulo: "LA CRISIS" }], bg: "archivo" },
    params: {
      ...D.params,
      eras: { type: "array", default: [{ ano: "1964", titulo: "SYSTEM/360" }, { ano: "1981", titulo: "EL PC" }], doc: "Eras {ano,titulo,at?}. at en segundos locales. Sin at se reparte el beat." },
    },
    create(ctx, p) {
      const st = ctx.stage, { H, W, u, portrait } = st, g = ctx.g.main, P = T.palette(ctx, p), box = D.box(st);
      const eras = p.eras.length ? p.eras : [{ ano: "", titulo: "" }];
      return D.scene(ctx, p, "archivo", (t, beat) => {
        const { item, index, at } = D.active(eras, t, beat.dur), local = t - at;
        const push = 1 + .025 * K.prog(local, 0, 2.2), py = H * .24, ph = H * (portrait ? .42 : .48);
        g.save(); g.translate(W * .46, H * .46); g.scale(push, push); g.translate(-W * .46, -H * .46);
        D.panel(g, box.x - u * 2, py, box.w + u * 4, ph, P);
        D.heading(g, st, p.titulo, P);
        if (index > 0) {
          D.label(g, eras[index - 1].ano, box.x + u * 3, py + u * 7, box.w * .6, u * 5, P.rim);
          const ax = box.right - u * 14, ay = py + u * 5;
          D.line(g, [[ax, ay], [ax + u * 10, ay], [ax + u * 8, ay - u * 2]], P.rim, u * .35);
          D.line(g, [[ax + u * 10, ay], [ax + u * 8, ay + u * 2]], P.rim, u * .35);
        }
        const year = String(item.ano ?? ""), yearY = H * (portrait ? .48 : .58);
        D.number(g, year, box.x + u * 2, yearY, box.w - u * 4, u * (portrait ? 28 : 32), P.ink);
        const L = T.titleLayout(g, item.titulo, box.w - u * 6, u * (portrait ? 7 : 9), 2);
        T.title(g, L, box.x + u * 3, yearY + u * 11, local, P, { at: .1, highlight: 0 });
        g.restore();
        if (index > 0 && local < .35) T.transition(g, st, "luz", 1 - K.prog(local, 0, .35), P, p.semilla);
        D.source(g, st, p.fuente, P);
      });
    },
  });
})();
