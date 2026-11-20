(function () {
  const K = Kit, R = K.rough;

  function scene(ctx, p, kind) {
    const P = ctx.C.palette, g = R.root(ctx), c = ctx.stage.content, u = ctx.stage.u;
    const cx = c.x + c.w / 2;
    const title = p.title ? R.mono(ctx, g, p.title, {
      x: cx, y: c.y + u * 1.2, size: 3.2, color: P.ink, weight: 700, anchor: "middle",
    }) : null;
    const top = c.y + c.h * 0.12, bottom = c.y + c.h * 0.94;
    const availableH = bottom - top;
    const shape = (parent, seed, color, build, width = 2.2) =>
      R.shape(ctx, parent, build, { seed, color, width });
    let main = [], detail = [], extra = [];

    if (kind === "warrant") {
      // A portrait sheet with a folded corner, signature and judicial seal.
      const ph = availableH * 0.96, pw = Math.min(c.w * 0.73, ph * 0.78);
      const px = cx - pw / 2, py = top, fold = pw * 0.16;
      main = shape(g, 110, P.ink, (G, o) => [
        G.linearPath([[px, py], [px + pw - fold, py], [px + pw, py + fold],
          [px + pw, py + ph], [px, py + ph], [px, py]], o),
        G.linearPath([[px + pw - fold, py], [px + pw - fold, py + fold],
          [px + pw, py + fold]], o),
        G.line(px + pw * 0.14, py + ph * 0.19, px + pw * 0.65, py + ph * 0.19, o),
        G.line(px + pw * 0.14, py + ph * 0.31, px + pw * 0.85, py + ph * 0.31, o),
        G.line(px + pw * 0.14, py + ph * 0.40, px + pw * 0.79, py + ph * 0.40, o),
        G.line(px + pw * 0.14, py + ph * 0.49, px + pw * 0.72, py + ph * 0.49, o),
        G.line(px + pw * 0.14, py + ph * 0.81, px + pw * 0.51, py + ph * 0.81, o),
        G.linearPath([[px + pw * 0.19, py + ph * 0.76], [px + pw * 0.25, py + ph * 0.70],
          [px + pw * 0.31, py + ph * 0.76], [px + pw * 0.37, py + ph * 0.70],
          [px + pw * 0.45, py + ph * 0.76]], o),
      ], 2.5);
      // Circular seal with balanced scales: a recognisable legal symbol.
      const sx = px + pw * 0.73, sy = py + ph * 0.70, radius = pw * 0.19;
      detail = shape(g, 111, P.accent, (G, o) => [
        G.circle(sx, sy, radius * 2, o),
        G.line(sx, sy - radius * 0.65, sx, sy + radius * 0.52, o),
        G.line(sx - radius * 0.63, sy - radius * 0.32, sx + radius * 0.63, sy - radius * 0.32, o),
        G.line(sx - radius * 0.46, sy - radius * 0.32, sx - radius * 0.68, sy + radius * 0.16, o),
        G.line(sx - radius * 0.46, sy - radius * 0.32, sx - radius * 0.24, sy + radius * 0.16, o),
        G.line(sx - radius * 0.68, sy + radius * 0.16, sx - radius * 0.24, sy + radius * 0.16, o),
        G.line(sx + radius * 0.46, sy - radius * 0.32, sx + radius * 0.24, sy + radius * 0.16, o),
        G.line(sx + radius * 0.46, sy - radius * 0.32, sx + radius * 0.68, sy + radius * 0.16, o),
        G.line(sx + radius * 0.24, sy + radius * 0.16, sx + radius * 0.68, sy + radius * 0.16, o),
        G.line(sx - radius * 0.30, sy + radius * 0.52, sx + radius * 0.30, sy + radius * 0.52, o),
      ], 2.3);
    } else {
      // Phone with two message bubbles; the overlaid clock explains transience.
      const ph = availableH * 0.96, pw = Math.min(c.w * 0.68, ph * 0.70);
      const px = cx - pw / 2, py = top, radius = pw * 0.11;
      main = shape(g, 140, P.ink, (G, o) => [
        G.path(`M${px + radius},${py} L${px + pw - radius},${py} Q${px + pw},${py} ${px + pw},${py + radius} L${px + pw},${py + ph - radius} Q${px + pw},${py + ph} ${px + pw - radius},${py + ph} L${px + radius},${py + ph} Q${px},${py + ph} ${px},${py + ph - radius} L${px},${py + radius} Q${px},${py} ${px + radius},${py} Z`, o),
        G.line(px + pw * 0.36, py + ph * 0.06, px + pw * 0.64, py + ph * 0.06, o),
        G.line(px + pw * 0.15, py + ph * 0.14, px + pw * 0.85, py + ph * 0.14, o),
        G.linearPath([[px + pw * 0.10, py + ph * 0.23], [px + pw * 0.72, py + ph * 0.23],
          [px + pw * 0.72, py + ph * 0.39], [px + pw * 0.28, py + ph * 0.39],
          [px + pw * 0.16, py + ph * 0.44], [px + pw * 0.18, py + ph * 0.39],
          [px + pw * 0.10, py + ph * 0.39], [px + pw * 0.10, py + ph * 0.23]], o),
        G.line(px + pw * 0.18, py + ph * 0.28, px + pw * 0.62, py + ph * 0.28, o),
        G.line(px + pw * 0.18, py + ph * 0.34, px + pw * 0.53, py + ph * 0.34, o),
        G.linearPath([[px + pw * 0.29, py + ph * 0.49], [px + pw * 0.89, py + ph * 0.49],
          [px + pw * 0.89, py + ph * 0.64], [px + pw * 0.83, py + ph * 0.64],
          [px + pw * 0.85, py + ph * 0.69], [px + pw * 0.73, py + ph * 0.64],
          [px + pw * 0.29, py + ph * 0.64], [px + pw * 0.29, py + ph * 0.49]], o),
        G.line(px + pw * 0.37, py + ph * 0.54, px + pw * 0.81, py + ph * 0.54, o),
        G.line(px + pw * 0.37, py + ph * 0.59, px + pw * 0.68, py + ph * 0.59, o),
      ], 2.4);
      const r = Math.min(pw * 0.27, ph * 0.18), tx = px + pw * 0.91, ty = py + ph * 0.76;
      const face = R.svg("circle", { cx: tx, cy: ty, r: r * 1.07, fill: P.bg, opacity: 0 }, g);
      detail = shape(g, 141, P.accent, (G, o) => [
        G.circle(tx, ty, r * 2, o),
        G.line(tx, ty - r * 0.72, tx, ty - r * 0.58, o),
        G.line(tx + r * 0.72, ty, tx + r * 0.58, ty, o),
        G.line(tx, ty + r * 0.72, tx, ty + r * 0.58, o),
        G.line(tx - r * 0.72, ty, tx - r * 0.58, ty, o),
        G.line(tx, ty, tx, ty - r * 0.57, o),
        G.line(tx, ty, tx + r * 0.46, ty + r * 0.22, o),
      ], 2.7);
      extra.push(face);
    }
    return {
      render(lt, beat, t) {
        R.draw(main, lt, { start: 0, dur: 0.6, total: 1.1, t });
        extra.forEach(el => el.setAttribute("opacity", K.prog(lt, 0.75, 0.15)));
        R.draw(detail, lt, { start: 0.8, dur: 0.55, total: 0.8, t });
        if (title) title.setAttribute("opacity", K.prog(lt, 0, 0.3));
        if (lt > beat.dur) R.exitFx(g, ctx, lt, beat);
      },
      dispose() { g.remove(); },
    };
  }
  K.register({ name: "rough.legalWarrant", tags: ["justicia", "orden"], layer: "main", summary: "Dibuja un documento con firma y revela un sello con la balanza de la justicia; representa órdenes y solicitudes legales.", example: { title: "ORDEN JUDICIAL" }, params: { title: { type: "string", default: "", doc: "Título superior opcional; una cadena vacía lo oculta." } }, create(ctx, p) { return scene(ctx, p, "warrant"); } });
  K.register({ name: "rough.temporaryChat", tags: ["chat", "retención", "tiempo"], layer: "main", summary: "Dibuja un teléfono con mensajes y revela un reloj en color de acento; representa chats temporales y plazos de retención.", example: { title: "CHAT TEMPORAL" }, params: { title: { type: "string", default: "", doc: "Título superior opcional; una cadena vacía lo oculta." } }, create(ctx, p) { return scene(ctx, p, "temporary"); } });
})();
