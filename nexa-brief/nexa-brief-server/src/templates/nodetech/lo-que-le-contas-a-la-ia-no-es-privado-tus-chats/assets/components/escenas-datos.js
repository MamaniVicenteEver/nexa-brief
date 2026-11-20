(function () {
  const K = Kit, R = K.rough;

  function scene(ctx, p, kind) {
    const P = ctx.C.palette, g = R.root(ctx), c = ctx.stage.content, u = ctx.stage.u;
    const cx = c.x + c.w / 2, y = c.y + c.h * 0.08;
    const h = c.h * (ctx.stage.portrait ? 1.16 : 0.8), w = c.w * 0.9, x = cx - w / 2;
    const sketch = (seed, color, paths) => R.shape(ctx, g, (G, o) => paths(G, o), { seed, color, width: 2 });
    const ink = (seed, paths) => sketch(seed, P.ink, paths);
    const accent = (seed, paths) => sketch(seed, P.accent, paths);
    const title = p.title ? R.mono(ctx, g, p.title, { x: cx, y: c.y, size: 4.2, color: P.ink, weight: 700, anchor: "middle" }) : null;
    let main = [], detail = [], address = null;
    if (kind === "warrant") {
      const pw = w * 0.9, ph = h * 0.82, px = cx - pw / 2, py = y;
      main = ink(110, (G, o) => [G.rectangle(px, py, pw, ph, o), G.line(px + pw * 0.13, py + ph * 0.24, px + pw * 0.83, py + ph * 0.24, o), G.line(px + pw * 0.13, py + ph * 0.38, px + pw * 0.7, py + ph * 0.38, o), G.line(px + pw * 0.13, py + ph * 0.52, px + pw * 0.75, py + ph * 0.52, o)]);
      detail = accent(111, (G, o) => [G.linearPath([[px + pw * 0.42, py + ph * 0.62], [px + pw * 0.65, py + ph * 0.53], [px + pw * 0.76, py + ph * 0.65], [px + pw * 0.53, py + ph * 0.74], [px + pw * 0.42, py + ph * 0.62]], o), G.linearPath([[px + pw * 0.51, py + ph * 0.68], [px + pw * 0.56, py + ph * 0.72], [px + pw * 0.35, py + ph * 0.91], [px + pw * 0.3, py + ph * 0.87], [px + pw * 0.51, py + ph * 0.68]], o), G.rectangle(px + pw * 0.19, py + ph * 0.91, pw * 0.59, ph * 0.06, o)]);
    } else if (kind === "share") {
      main = ink(120, (G, o) => [G.rectangle(x, y, w, h * 0.72, o), G.line(x, y + h * 0.13, x + w, y + h * 0.13, o), G.rectangle(x + w * 0.08, y + h * 0.23, w * 0.84, h * 0.15, o), G.line(x + w * 0.12, y + h * 0.48, x + w * 0.79, y + h * 0.48, o), G.line(x + w * 0.12, y + h * 0.58, x + w * 0.66, y + h * 0.58, o)]);
      detail = accent(121, (G, o) => [G.circle(x + w * 0.8, y + h * 0.3, h * 0.1, o), G.line(x + w * 0.83, y + h * 0.34, x + w * 0.91, y + h * 0.4, o), G.line(cx, y + h * 0.74, cx, y + h * 0.92, o), G.line(cx, y + h * 0.92, cx - u * 1.5, y + h * 0.86, o), G.line(cx, y + h * 0.92, cx + u * 1.5, y + h * 0.86, o)]);
      if (p.address) address = R.mono(ctx, g, p.address, { x: x + w * 0.12, y: y + h * 0.32, size: 3.4, color: P.ink, weight: 700, anchor: "start" });
    } else if (kind === "review") {
      main = ink(130, (G, o) => [G.circle(x + w * 0.25, y + h * 0.23, Math.min(w, h) * 0.31, o), G.arc(x + w * 0.25, y + h * 0.68, w * 0.5, h * 0.65, Math.PI, Math.PI * 2, false, o), G.rectangle(x + w * 0.53, y + h * 0.12, w * 0.45, h * 0.76, o), G.line(x + w * 0.59, y + h * 0.34, x + w * 0.91, y + h * 0.34, o), G.line(x + w * 0.59, y + h * 0.49, x + w * 0.89, y + h * 0.49, o)]);
      detail = accent(131, (G, o) => [G.linearPath([[x + w * 0.61, y + h * 0.62], [x + w * 0.75, y + h * 0.56], [x + w * 0.9, y + h * 0.62], [x + w * 0.88, y + h * 0.78], [x + w * 0.75, y + h * 0.86], [x + w * 0.63, y + h * 0.78], [x + w * 0.61, y + h * 0.62]], o), G.line(x + w * 0.68, y + h * 0.7, x + w * 0.74, y + h * 0.76, o), G.line(x + w * 0.74, y + h * 0.76, x + w * 0.84, y + h * 0.64, o)]);
    } else {
      main = ink(140, (G, o) => [G.linearPath([[x, y], [x + w, y], [x + w, y + h * 0.5], [x + w * 0.3, y + h * 0.5], [x + w * 0.16, y + h * 0.61], [x + w * 0.18, y + h * 0.5], [x, y + h * 0.5], [x, y]], o), G.line(x + w * 0.12, y + h * 0.17, x + w * 0.82, y + h * 0.17, o), G.line(x + w * 0.12, y + h * 0.3, x + w * 0.68, y + h * 0.3, o)]);
      const r = Math.min(w * 0.28, h * 0.22), tcx = cx, tcy = y + h * 0.76;
      detail = accent(141, (G, o) => [G.circle(tcx, tcy, r * 2, o), G.line(tcx, tcy, tcx, tcy - r * 0.65, o), G.line(tcx, tcy, tcx + r * 0.56, tcy + r * 0.26, o)]);
    }
    return { render(lt, beat, t) { R.draw(main, lt, { start: 0, dur: 0.7, t }); R.draw(detail, lt, { start: 0.3, dur: 0.7, t }); if (title) title.setAttribute("opacity", K.prog(lt, 0, 0.3)); if (address) address.setAttribute("opacity", K.prog(lt, 0.4, 0.3)); if (lt > beat.dur) R.exitFx(g, ctx, lt, beat); }, dispose() { g.remove(); } };
  }
  K.register({ name: "rough.legalWarrant", tags: ["justicia", "orden"], layer: "main", summary: "Documento y sello de orden judicial.", example: { title: "ORDEN JUDICIAL" }, params: { title: { type: "string", default: "", doc: "Rótulo opcional." } }, create(ctx, p) { return scene(ctx, p, "warrant"); } });
  K.register({ name: "rough.temporaryChat", tags: ["chat", "retención", "tiempo"], layer: "main", summary: "Conversación temporal y reloj de retención.", example: { title: "CHAT TEMPORAL" }, params: { title: { type: "string", default: "", doc: "Rótulo opcional." } }, create(ctx, p) { return scene(ctx, p, "temporary"); } });
})();
