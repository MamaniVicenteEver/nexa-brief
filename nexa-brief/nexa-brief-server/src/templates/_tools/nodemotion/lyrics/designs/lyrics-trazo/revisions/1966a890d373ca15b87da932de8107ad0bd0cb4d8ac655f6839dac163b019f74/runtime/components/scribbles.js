/* lyrics-trazo · garabatos.
   doodles    : adornos sobre una palabra (rayos, destello, subrayado, círculo, flecha).
   interludes : escenas sin letra para silencios e instrumentales
                (sun, holes, crack, scribble, spark). Todo es trazo SVG que se
                “dibuja” con stroke-dashoffset en función del tiempo local. */
(function (root) {
  "use strict";
  const T = root.Trazo, K = T.core, R = T.registry;

  function layer(rootEl, ctx) { const s = K.svgLayer(rootEl, ctx.W, ctx.H); s.classList.add("tz-doodle"); return s; }
  const sw = ctx => Math.max(2, ctx.u * 0.55);

  /* ------------------------------ doodles ----------------------------- */
  R.doodles.rays = (rootEl, L, ctx, r) => {
    const s = layer(rootEl, ctx), cx = ctx.W / 2, cy = ctx.H / 2;
    const rad = Math.max(L.bw, L.bh) * 0.55;
    const paths = K.strokePaths(s, K.rays(cx, cy, rad * 1.05, rad * 1.35, r.int(9, 13), r), { width: sw(ctx) });
    return { update(lt) { paths.forEach((p, i) => K.setDraw(p, K.prog(lt, 0.02 + i * 0.012, 0.16 + i * 0.012))); } };
  };
  R.doodles.star = (rootEl, L, ctx, r) => {
    const s = layer(rootEl, ctx);
    const x = ctx.W / 2 + L.bw * 0.48, y = ctx.H / 2 - L.bh * 0.5;
    const g = K.svg("g", {}, s);
    const paths = K.strokePaths(g, K.sparkle(x, y, ctx.u * 6, r), { width: sw(ctx) * 0.8 });
    return { update(lt) {
      paths.forEach(p => K.setDraw(p, K.prog(lt, 0.03, 0.14)));
      const k = 1 + 0.25 * Math.sin(lt * 18);
      g.setAttribute("transform", `translate(${x},${y}) scale(${k.toFixed(3)}) translate(${-x},${-y})`);
    } };
  };
  R.doodles.underline = (rootEl, L, ctx, r) => {
    const s = layer(rootEl, ctx), y = ctx.H / 2 + L.bh * 0.55, x0 = ctx.W / 2 - L.bw * 0.45, x1 = ctx.W / 2 + L.bw * 0.45;
    const ds = [K.wobblyLine(x0, y, x1, y + r.range(-6, 6), r, 0.03, 6), K.wobblyLine(x0 + L.bw * 0.08, y + ctx.u * 2, x1 - L.bw * 0.05, y + ctx.u * 2.4, r, 0.04, 6)];
    const paths = K.strokePaths(s, ds, { width: sw(ctx) * 1.2 });
    return { update(lt) { paths.forEach((p, i) => K.setDraw(p, K.prog(lt, 0.04 + i * 0.08, 0.22 + i * 0.08))); } };
  };
  R.doodles.circle = (rootEl, L, ctx, r) => {
    const s = layer(rootEl, ctx);
    const paths = K.strokePaths(s, [K.wobblyEllipse(ctx.W / 2, ctx.H / 2, L.bw * 0.62, L.bh * 0.68, r, 1.3, 0.05)], { width: sw(ctx) });
    return { update(lt) { K.setDraw(paths[0], K.prog(lt, 0.02, 0.3)); } };
  };
  R.doodles.arrow = (rootEl, L, ctx, r) => {
    const s = layer(rootEl, ctx), x = ctx.W / 2 + L.bw * 0.56, y0 = ctx.H / 2 + L.bh * 0.35, y1 = ctx.H / 2 - L.bh * 0.4;
    const head = ctx.u * 3.5;
    const ds = [K.wobblyLine(x, y0, x, y1, r, 0.03, 4), K.wobblyLine(x, y1, x - head, y1 + head, r, 0.05, 2), K.wobblyLine(x, y1, x + head, y1 + head, r, 0.05, 2)];
    const paths = K.strokePaths(s, ds, { width: sw(ctx) * 1.1 });
    return { update(lt) { paths.forEach((p, i) => K.setDraw(p, K.prog(lt, 0.03 + i * 0.05, 0.14 + i * 0.05))); } };
  };

  /* ----------------------------- interludes --------------------------- */
  function scene(ctx) { const rootEl = K.el("div", "tz-scene"); return { rootEl, s: layer(rootEl, ctx) }; }

  /* círculo diminuto que crece y suelta rayos (apertura de la referencia) */
  R.interludes.sun = (sc, ctx) => {
    const { rootEl, s } = scene(ctx), r = K.rng(sc.seed), cx = ctx.W / 2, cy = ctx.H / 2;
    const g = K.svg("g", {}, s);
    const ring = K.strokePaths(g, [K.wobblyEllipse(0, 0, 10, 12, r, 1.6, 0.08), K.wobblyEllipse(0, 0, 7, 8, r, 1.2, 0.12)], { width: 1.6 });
    const rayG = K.svg("g", {}, s);
    const rayPaths = K.strokePaths(rayG, K.rays(cx, cy, ctx.u * 15, ctx.u * 25, 11, r), { width: sw(ctx) * 0.8 });
    const dur = sc.t1 - sc.t0;
    return { root: rootEl, update(lt) {
      const p = K.prog(lt, 0, dur);
      const k = (ctx.u * 0.18) + K.ease.in(p) * ctx.u * 1.3;
      g.setAttribute("transform", `translate(${cx},${cy}) scale(${k.toFixed(3)})`);
      ring.forEach(x => { K.setDraw(x, K.prog(lt, 0, Math.min(0.35, dur * 0.4))); x.setAttribute("stroke-width", (1.6 / Math.max(0.4, k / ctx.u)).toFixed(2)); });
      rayPaths.forEach((x, i) => K.setDraw(x, K.prog(p, 0.55 + i * 0.015, 0.8 + i * 0.015)));
      return { inv: false };
    } };
  };
  /* impactos de bala que aparecen uno tras otro sobre papel blanco */
  R.interludes.holes = (sc, ctx) => {
    const { rootEl, s } = scene(ctx), r = K.rng(sc.seed);
    const n = r.int(5, 8), holes = [];
    for (let i = 0; i < n; i++) {
      const x = ctx.W * r.range(0.18, 0.82), y = ctx.H * r.range(0.14, 0.86), rad = ctx.u * r.range(2.6, 4.6);
      holes.push(K.strokePaths(K.svg("g", {}, s), K.bulletHole(x, y, rad, r), { width: sw(ctx) * 0.7 }));
    }
    const dur = sc.t1 - sc.t0;
    return { root: rootEl, update(lt) {
      holes.forEach((ps, i) => { const a = (i / n) * dur * 0.75; ps.forEach(p => K.setDraw(p, K.prog(lt, a, a + 0.07))); });
      return { inv: true };
    } };
  };
  /* grieta que se abre desde el centro */
  R.interludes.crack = (sc, ctx) => {
    const { rootEl, s } = scene(ctx), r = K.rng(sc.seed);
    const parts = K.crack(ctx.W / 2, ctx.H / 2, Math.max(ctx.W, ctx.H) * 0.55, r);
    const paths = parts.map(pt => ({ p: K.strokePaths(s, [pt.d], { width: sw(ctx) * (pt.gen ? 0.55 : 0.9) })[0], gen: pt.gen }));
    const dur = sc.t1 - sc.t0;
    const inv = sc.inverted !== false;
    return { root: rootEl, update(lt) {
      const p = K.prog(lt, 0, dur * 0.85);
      paths.forEach(x => K.setDraw(x.p, K.prog(p, x.gen * 0.18, 0.45 + x.gen * 0.18)));
      return { inv };
    } };
  };
  /* ovillo de garabato que se enreda y crece */
  R.interludes.scribble = (sc, ctx) => {
    const { rootEl, s } = scene(ctx), r = K.rng(sc.seed), cx = ctx.W / 2, cy = ctx.H / 2;
    const g = K.svg("g", {}, s);
    const paths = K.strokePaths(g, [K.scribble(0, 0, 40, r, 34), K.scribble(0, 0, 32, r, 22)], { width: 1.2 });
    const dur = sc.t1 - sc.t0;
    return { root: rootEl, update(lt) {
      const p = K.prog(lt, 0, dur);
      const k = ctx.u * (0.25 + 0.6 * K.ease.out(p));
      g.setAttribute("transform", `translate(${cx},${cy}) scale(${k.toFixed(3)})`);
      paths.forEach((x, i) => { K.setDraw(x, K.prog(p, i * 0.2, 0.8 + i * 0.2)); x.setAttribute("stroke-width", (Math.max(2, ctx.u * 0.35) / k).toFixed(3)); });
      return { inv: !!sc.inverted };
    } };
  };
  /* destello pequeño que late (cierre de frase) */
  R.interludes.spark = (sc, ctx) => {
    const { rootEl, s } = scene(ctx), r = K.rng(sc.seed), cx = ctx.W * r.range(0.4, 0.6), cy = ctx.H * r.range(0.42, 0.58);
    const g = K.svg("g", {}, s);
    const paths = K.strokePaths(g, K.sparkle(cx, cy, ctx.u * 5, r), { width: sw(ctx) * 0.7 });
    return { root: rootEl, update(lt) {
      paths.forEach(p => K.setDraw(p, K.prog(lt, 0, 0.12)));
      const k = 1 + 0.35 * Math.sin(lt * 10);
      g.setAttribute("transform", `translate(${cx},${cy}) scale(${k.toFixed(3)}) translate(${-cx},${-cy})`);
      return { inv: !!sc.inverted };
    } };
  };

  T.DOODLES = Object.keys(R.doodles);
  T.INTERLUDES = Object.keys(R.interludes);
})(typeof window !== "undefined" ? window : globalThis);
