(function () {
  const K = Kit, R = K.rough;
  function make(ctx, p, mode) {
    const P = ctx.C.palette, g = R.root(ctx), c = ctx.stage.content, u = ctx.stage.u;
    const x = c.x + c.w * 0.05, w = c.w * 0.9, y = c.y + c.h * 0.08;
    const h = c.h * (ctx.stage.portrait ? (mode === "redact" ? 1.32 : 1.17) : 0.84), cx = c.x + c.w / 2;
    const rough = (seed, color, f) => R.shape(ctx, g, f, { seed, color, width: 2 });
    let a, b, masks = [];
    if (mode === "redact") {
      a = rough(201, P.ink, (G, o) => [G.linearPath([[x, y], [x + w, y], [x + w, y + h * 0.65], [x + w * 0.3, y + h * 0.65], [x + w * 0.17, y + h * 0.76], [x + w * 0.19, y + h * 0.65], [x, y + h * 0.65], [x, y]], o), G.line(x + w * 0.12, y + h * 0.2, x + w * 0.83, y + h * 0.2, o), G.line(x + w * 0.12, y + h * 0.37, x + w * 0.75, y + h * 0.37, o), G.line(x + w * 0.12, y + h * 0.53, x + w * 0.86, y + h * 0.53, o)]);
      b = rough(202, P.accent, (G, o) => [G.rectangle(x + w * 0.35, y + h * 0.13, w * 0.33, h * 0.13, { ...o, fill: P.accent, fillStyle: "solid" }), G.rectangle(x + w * 0.17, y + h * 0.3, w * 0.42, h * 0.13, { ...o, fill: P.accent, fillStyle: "solid" }), G.rectangle(x + w * 0.46, y + h * 0.46, w * 0.3, h * 0.13, { ...o, fill: P.accent, fillStyle: "solid" })]);
      masks = [[0.35, 0.13, 0.33], [0.17, 0.3, 0.42], [0.46, 0.46, 0.3]].map(([mx, my, mw]) => R.svg("rect", { x: x + w * mx, y: y + h * my, width: w * mw, height: h * 0.13, fill: P.accent }, g));
    } else {
      const portrait = ctx.stage.portrait;
      const cw = portrait ? w * 0.8 : w * 0.43, ch = portrait ? h * 0.42 : h * 0.75;
      const ax = portrait ? cx - cw / 2 : x, ay = y;
      const bx = portrait ? x : x + w * 0.57, by = portrait ? y + h * 0.55 : y;
      const bw = portrait ? w : w * 0.43, bh = portrait ? h * 0.4 : h * 0.75;
      a = rough(210, P.ink, (G, o) => [G.rectangle(ax, ay, cw, ch, o), G.line(ax, ay + ch * 0.22, ax + cw, ay + ch * 0.22, o), G.line(ax + cw * 0.3, ay, ax + cw * 0.3, ay - u, o), G.line(ax + cw * 0.7, ay, ax + cw * 0.7, ay - u, o), G.line(ax + cw * 0.1, ay + ch * 0.45, ax + cw * 0.9, ay + ch * 0.45, o), G.line(ax + cw * 0.1, ay + ch * 0.7, ax + cw * 0.9, ay + ch * 0.7, o), G.line(ax + cw * 0.37, ay + ch * 0.25, ax + cw * 0.37, ay + ch * 0.9, o), G.line(ax + cw * 0.64, ay + ch * 0.25, ax + cw * 0.64, ay + ch * 0.9, o)]);
      b = rough(211, P.accent, (G, o) => [G.linearPath([[bx, by + bh * 0.15], [bx + bw * 0.34, by + bh * 0.15], [bx + bw * 0.42, by], [bx + bw * 0.65, by], [bx + bw * 0.65, by + bh * 0.15], [bx + bw, by + bh * 0.15], [bx + bw, by + bh], [bx, by + bh], [bx, by + bh * 0.15]], o), G.line(bx + bw * 0.5, by + bh * 0.3, bx + bw * 0.5, by + bh * 0.78, o), G.line(bx + bw * 0.5, by + bh * 0.78, bx + bw * 0.38, by + bh * 0.65, o), G.line(bx + bw * 0.5, by + bh * 0.78, bx + bw * 0.62, by + bh * 0.65, o)]);
    }
    const title = p.title ? R.mono(ctx, g, p.title, { x: cx, y: c.y, size: 4.2, color: P.ink, weight: 700, anchor: "middle" }) : null;
    return { render(lt, beat, t) { R.draw(a, lt, { start: 0, dur: 0.4, total: 0.6, t }); R.draw(b, lt, { start: 0.2, dur: 0.5, total: 0.5, t }); masks.forEach((el, i) => el.setAttribute("opacity", K.prog(lt, 0.25 + i * 0.12, 0.2))); if (title) title.setAttribute("opacity", K.prog(lt, 0, 0.3)); if (lt > beat.dur) R.exitFx(g, ctx, lt, beat); }, dispose() { g.remove(); } };
  }
  function createCalendar(ctx, p) {
    const P = ctx.C.palette, g = R.root(ctx), { content: c, portrait, u, cx } = ctx.stage;
    // El calendario es el objeto principal; la carpeta sugiere archivo sin
    // competir con la cuadrícula reconocible de siete días.
    const cal = portrait
      ? { x: c.x + c.w * .04, y: c.y + c.h * .13, w: c.w * .92, h: c.h * .52 }
      : { x: c.x + c.w * .03, y: c.y + c.h * .16, w: c.w * .60, h: c.h * .74 };
    const folder = portrait
      ? { x: c.x + c.w * .28, y: c.y + c.h * .76, w: c.w * .44, h: c.h * .22 }
      : { x: c.x + c.w * .72, y: c.y + c.h * .45, w: c.w * .25, h: c.h * .39 };
    const shape = (seed, color, draw, width = 2) => R.shape(ctx, g, draw, { seed, color, width });
    const header = cal.h * .20, cellW = cal.w / 7, cellH = (cal.h - header) / 4;
    const frame = shape(710, P.ink, (G, o) => [
      G.rectangle(cal.x, cal.y, cal.w, cal.h, o),
      G.line(cal.x, cal.y + header, cal.x + cal.w, cal.y + header, o),
      G.line(cal.x + cal.w * .19, cal.y - u * 1.6, cal.x + cal.w * .19, cal.y + u * 2, o),
      G.line(cal.x + cal.w * .81, cal.y - u * 1.6, cal.x + cal.w * .81, cal.y + u * 2, o),
      G.line(cal.x + cal.w * .33, cal.y + header * .5, cal.x + cal.w * .67, cal.y + header * .5, o),
    ]);
    const grid = shape(711, P.muted || P.ink, (G, o) => {
      const paths = [];
      for (let i = 1; i < 7; i++) paths.push(G.line(cal.x + cellW * i, cal.y + header, cal.x + cellW * i, cal.y + cal.h, o));
      for (let i = 1; i < 4; i++) paths.push(G.line(cal.x, cal.y + header + cellH * i, cal.x + cal.w, cal.y + header + cellH * i, o));
      return paths;
    }, 1.1);
    const daySize = Math.min(3.4, cellW / u * .42, cellH / u * .46);
    const days = Array.from({ length: 28 }, (_, i) => {
      const col = i % 7, row = Math.floor(i / 7), marked = i === 17;
      return R.mono(ctx, g, String(i + 1), { x: cal.x + cellW * (col + .5),
        y: cal.y + header + cellH * (row + .67), size: daySize,
        color: marked ? P.accent : P.ink, weight: marked ? 800 : 600, anchor: "middle" });
    });
    const selected = shape(712, P.accent, (G, o) => [
      G.circle(cal.x + cellW * 3.5, cal.y + header + cellH * 2.5,
        Math.min(cellW, cellH) * .78, o),
    ], 2.3);
    const archive = shape(713, P.ink, (G, o) => [
      G.linearPath([[folder.x, folder.y + folder.h * .18], [folder.x + folder.w * .34, folder.y + folder.h * .18],
        [folder.x + folder.w * .42, folder.y], [folder.x + folder.w * .66, folder.y],
        [folder.x + folder.w * .66, folder.y + folder.h * .18], [folder.x + folder.w, folder.y + folder.h * .18],
        [folder.x + folder.w, folder.y + folder.h], [folder.x, folder.y + folder.h],
        [folder.x, folder.y + folder.h * .18]], o),
      G.line(folder.x + folder.w * .16, folder.y + folder.h * .46,
        folder.x + folder.w * .78, folder.y + folder.h * .46, o),
    ], 1.8);
    const title = p.title ? R.mono(ctx, g, p.title, { x: cx, y: c.y + u * 2,
      size: 3.2, color: P.ink, weight: 700, anchor: "middle" }) : null;
    return {
      render(lt, beat, t) {
        R.draw(frame, lt, { start: 0, dur: .65, t });
        R.draw(grid, lt, { start: .35, dur: .65, t });
        days.forEach((el, i) => el.setAttribute("opacity", K.prog(lt, .55 + i * .025, .22)));
        R.draw(selected, lt, { start: 1.35, dur: .4, t });
        R.draw(archive, lt, { start: 1.6, dur: .65, t });
        if (title) title.setAttribute("opacity", K.prog(lt, 0, .3));
        if (lt > beat.dur) R.exitFx(g, ctx, lt, beat);
      },
      dispose() { g.remove(); },
    };
  }
  K.register({ name: "rough.chatRedaction", tags: ["chat", "desidentificación"], layer: "main", summary: "Dibuja una conversación y revela tres barras de censura en secuencia; representa datos ocultados o desidentificados.", example: { title: "DATOS OCULTOS" }, params: { title: { type: "string", default: "", doc: "Título superior opcional; una cadena vacía lo oculta." } }, create(ctx, p) { return make(ctx, p, "redact"); } });
  K.register({ name: "rough.retentionCalendar", tags: ["retención", "archivo", "tiempo"], layer: "main", summary: "Dibuja un calendario de siete columnas, destaca una fecha y revela una carpeta; representa plazos de conservación de datos.", example: { title: "TIEMPO DE RETENCIÓN" }, params: { title: { type: "string", default: "", doc: "Título superior opcional; una cadena vacía lo oculta." } }, create(ctx, p) { return createCalendar(ctx, p); } });
})();
