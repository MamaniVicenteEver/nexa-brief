/* lyrics-grunge-rojo · garabatos de tiza y pincel rojo.
   Cada garabato recibe un rectángulo {x,y,w,h} (la palabra o frase a señalar) y
   devuelve update(p) con p = progreso de dibujo 0..1.
   Tiza (blanca): circle, arrow, underline, box, crown, bolt, xmarks, eyes.
   Pincel (rojo): strike (tachón en X), slash (barra), smear (mancha horizontal). */
(function (root) {
  "use strict";
  const G = root.GrungeRojo, K = G.core, R = G.registry;
  const chalk = ctx => Math.max(2, ctx.u * 0.42);
  const brush = ctx => Math.max(5, ctx.u * 1.6);

  const D = R.doodles;
  D.circle = (s, b, ctx, r) => { const ps = K.strokePaths(s, [K.wobblyEllipse(b.x + b.w / 2, b.y + b.h / 2, b.w * 0.6, b.h * 0.72, r, 1.25, 0.05)], ctx.chalk, chalk(ctx), "gr-chalk"); return p => K.setDraw(ps[0], p); };
  D.arrow = (s, b, ctx, r) => {
    const x0 = b.x + b.w * 0.15, y0 = b.y + b.h * 1.25, x1 = b.x + b.w * 0.95, y1 = b.y + b.h * 1.05, hd = ctx.u * 2.6;
    const ds = [K.smooth([[x0, y0], [b.x + b.w * 0.55, y0 + ctx.u * 2.5], [x1, y1]], false), K.wobblyLine(x1, y1, x1 - hd, y1 - hd * 0.2, r, 0.05, 2), K.wobblyLine(x1, y1, x1 - hd * 0.5, y1 + hd * 0.9, r, 0.05, 2)];
    const ps = K.strokePaths(s, ds, ctx.chalk, chalk(ctx), "gr-chalk");
    return p => ps.forEach((x, i) => K.setDraw(x, K.prog(p, i * 0.25, 0.6 + i * 0.2)));
  };
  D.underline = (s, b, ctx, r) => { const y = b.y + b.h * 1.08; const ps = K.strokePaths(s, [K.wobblyLine(b.x, y, b.x + b.w, y - ctx.u, r, 0.03, 6)], ctx.chalk, chalk(ctx) * 1.3, "gr-chalk"); return p => K.setDraw(ps[0], p); };
  D.box = (s, b, ctx, r) => {
    const m = ctx.u * 2, x0 = b.x - m, y0 = b.y - m, x1 = b.x + b.w + m, y1 = b.y + b.h + m;
    const ps = K.strokePaths(s, [K.wobblyLine(x0, y0, x1 + m, y0, r, 0.01, 4), K.wobblyLine(x1, y0 - m, x1, y1, r, 0.02, 4), K.wobblyLine(x1 + m, y1, x0, y1, r, 0.01, 4), K.wobblyLine(x0, y1 + m, x0, y0, r, 0.02, 4)], ctx.chalk, chalk(ctx) * 1.4, "gr-chalk");
    return p => ps.forEach((x, i) => K.setDraw(x, K.prog(p, i * 0.22, 0.3 + i * 0.22)));
  };
  D.crown = (s, b, ctx, r) => {
    const w = Math.max(ctx.u * 7, b.w * 0.18), x = b.x + b.w * r.range(0.05, 0.3), y = b.y - ctx.u * 1.2, h = w * 0.6;
    const pts = [[x, y], [x, y - h], [x + w * 0.25, y - h * 0.5], [x + w * 0.5, y - h * 1.1], [x + w * 0.75, y - h * 0.5], [x + w, y - h], [x + w, y], [x, y]];
    const ps = K.strokePaths(s, [pts.map((q, i) => (i ? "L" : "M") + q[0].toFixed(1) + "," + q[1].toFixed(1)).join("")], ctx.chalk, chalk(ctx), "gr-chalk");
    return p => K.setDraw(ps[0], p);
  };
  D.bolt = (s, b, ctx, r) => {
    const x = b.x + b.w + ctx.u * 2, y = b.y, h = b.h * 0.9;
    const pts = [[x + h * 0.25, y], [x, y + h * 0.5], [x + h * 0.22, y + h * 0.5], [x - h * 0.05, y + h]];
    const ps = K.strokePaths(s, [pts.map((q, i) => (i ? "L" : "M") + q[0].toFixed(1) + "," + q[1].toFixed(1)).join("")], ctx.chalk, chalk(ctx), "gr-chalk");
    return p => K.setDraw(ps[0], p);
  };
  D.xmarks = (s, b, ctx, r) => {
    const ds = [];
    for (let i = 0; i < 3; i++) { const x = b.x + r.range(-0.1, 1.1) * b.w, y = b.y + r.range(-0.4, 1.4) * b.h, k = ctx.u * 1.4; ds.push(K.wobblyLine(x - k, y - k, x + k, y + k, r, 0.05, 2), K.wobblyLine(x + k, y - k, x - k, y + k, r, 0.05, 2)); }
    ds.push(K.wobblyLine(b.x - ctx.u * 3, b.y + b.h * 1.3, b.x + b.w * 0.3, b.y + b.h * 1.3, r, 0.02, 3));
    const ps = K.strokePaths(s, ds, ctx.chalk, chalk(ctx) * 0.8, "gr-chalk");
    return p => ps.forEach((x, i) => K.setDraw(x, K.prog(p, i * 0.08, 0.2 + i * 0.08)));
  };
  /* ojos dibujados (sobre el metraje, en silencios) */
  D.eyes = (s, b, ctx, r) => {
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2, gap = ctx.u * 6, rx = ctx.u * 3.2, ry = ctx.u * 1.6;
    const ds = [-1, 1].flatMap(k => [K.wobblyEllipse(cx + k * gap, cy, rx, ry, r, 1.1, 0.06), K.wobblyEllipse(cx + k * gap, cy, ry * 0.45, ry * 0.45, r, 1.4, 0.1)]);
    const ps = K.strokePaths(s, ds, ctx.chalk, chalk(ctx), "gr-chalk");
    return p => ps.forEach((x, i) => K.setDraw(x, K.prog(p, (i % 2) * 0.3, 0.6 + (i % 2) * 0.3)));
  };
  /* pincel rojo */
  D.strike = (s, b, ctx, r) => {
    const ds = [K.wobblyLine(b.x - b.w * 0.05, b.y + b.h * 0.25, b.x + b.w * 1.05, b.y + b.h * 0.8, r, 0.02, 4), K.wobblyLine(b.x - b.w * 0.05, b.y + b.h * 0.8, b.x + b.w * 1.05, b.y + b.h * 0.3, r, 0.02, 4)];
    const ps = K.strokePaths(s, ds, ctx.red, brush(ctx) * 0.6, "gr-brush");
    return p => ps.forEach((x, i) => K.setDraw(x, K.prog(p, i * 0.45, 0.5 + i * 0.45)));
  };
  D.slash = (s, b, ctx, r) => {
    const ps = K.strokePaths(s, [K.wobblyLine(b.x + b.w * 0.2, b.y + b.h * 1.1, b.x + b.w * 0.8, b.y - b.h * 0.15, r, 0.02, 4)], ctx.red, brush(ctx), "gr-brush");
    return p => K.setDraw(ps[0], p);
  };
  D.smear = (s, b, ctx, r) => {
    const y = b.y + b.h * 0.5;
    const ps = K.strokePaths(s, [K.wobblyLine(b.x - b.w * 0.1, y, b.x + b.w * 1.1, y + r.range(-4, 4), r, 0.015, 6)], ctx.red, b.h * 0.35, "gr-brush");
    return p => K.setDraw(ps[0], p);
  };

  /* dibuja un garabato sobre un rectángulo, en una capa SVG nueva */
  function doodle(parent, ctx, name, box, seed) {
    if (!R.doodles[name]) return () => {};
    const s = K.layer(parent, ctx.W, ctx.H, "gr-doodles");
    return R.doodles[name](s, box, ctx, K.rng(seed));
  }
  G.doodle = doodle;
  G.DOODLES = Object.keys(R.doodles);
})(typeof window !== "undefined" ? window : globalThis);
