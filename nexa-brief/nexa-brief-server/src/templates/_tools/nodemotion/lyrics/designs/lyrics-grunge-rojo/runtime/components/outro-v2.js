/* lyrics-grunge-rojo · Outro v2 «Collage» (cierre de la referencia).
   Sobre papel gris aparecen pequeñas piezas de todo el video: frases ya cantadas en
   blanco, rojo y negro, cruces, flechas, coronas y rayos de tiza; después una franja
   roja cruza con config.outro.title + sub y la línea feats. */
(function (root) {
  "use strict";
  const G = root.GrungeRojo, K = G.core, R = G.registry;
  R.outros["grunge.outrov2"] = function buildOutroV2(sc, ctx) {
    const P = G.parts, O = ctx.C.outro, D = Math.max(0.6, sc.t1 - sc.t0), r = K.rng(sc.seed);
    const S = P.scaffold({ ...sc, bg: "paper", v: {} }, ctx);
    const field = K.el("div", "gr-collage", S.txt);
    const lines = (sc.prev && sc.prev.length ? sc.prev : [O.title]).slice(-14);
    const pieces = lines.map((t, i) => {
      const e = K.el("div", "gr-piece", field);
      const f = i % 3 === 0 ? ctx.fonts.wide : ctx.fonts.condensed;
      K.useFont(e, f, ctx.u * r.range(2.4, 4.4));
      e.textContent = P.up(t);
      e.style.color = [ctx.white, ctx.red, ctx.black][i % 3];
      e.style.left = (r.range(4, 70)).toFixed(1) + "%"; e.style.top = (r.range(6, 86)).toFixed(1) + "%";
      return { e, at: (i / lines.length) * D * 0.4 };
    });
    const s = K.layer(S.rootEl, ctx.W, ctx.H, "gr-doodles");
    const marks = [];
    for (let i = 0; i < 9; i++) {
      const x = ctx.W * r.range(0.05, 0.95), y = ctx.H * r.range(0.05, 0.95), k = ctx.u * r.range(1, 2.4);
      const d = i % 3 === 0 ? `M${x - k},${y - k}L${x + k},${y + k}M${x + k},${y - k}L${x - k},${y + k}` : i % 3 === 1 ? `M${x - k * 2},${y}L${x + k * 2},${y}M${x + k},${y - k}L${x + k * 2},${y}L${x + k},${y + k}` : `M${x},${y - k * 1.5}L${x - k},${y}L${x + k * 0.4},${y}L${x - k * 0.6},${y + k * 1.5}`;
      marks.push(K.strokePaths(s, [d], ctx.black, Math.max(1.5, ctx.u * 0.3), "gr-chalk")[0]);
    }
    const band = K.el("div", "gr-band", S.rootEl, { background: ctx.red });
    const bt = K.el("div", "gr-band-t", band);
    const size = K.fit([P.up(`${O.title} ${O.sub}`)], ctx.fonts.condensed, ctx.W * 0.8, ctx.H * 0.13);
    K.useFont(bt, ctx.fonts.condensed, size); bt.style.color = ctx.white; bt.textContent = P.up(`${O.title} ${O.sub}`.trim());
    const feats = K.el("div", "gr-feats", S.rootEl);
    K.useFont(feats, { ...ctx.fonts.thin, weight: 600, tracking: 0.25 }, Math.max(11, ctx.u * 2.8));
    feats.style.color = ctx.black;
    const ft = P.up(O.feats);
    return P.finish(S, sc, ctx, { target: null, update: lt => {
      pieces.forEach(p => { p.e.style.visibility = lt >= p.at ? "visible" : "hidden"; });
      marks.forEach((m, i) => K.setDraw(m, K.prog(lt, D * 0.05 + i * 0.04, D * 0.15 + i * 0.04)));
      const b = K.ease.expo(K.prog(lt, D * 0.45, D * 0.62));
      band.style.clipPath = `inset(0 ${((1 - b) * 100).toFixed(1)}% 0 0)`;
      field.style.filter = `blur(${(K.prog(lt, D * 0.45, D * 0.6) * 2.5).toFixed(2)}px)`;
      feats.textContent = ft.slice(0, Math.round(ft.length * K.prog(lt, D * 0.65, D * 0.88)));
    } });
  };
})(typeof window !== "undefined" ? window : globalThis);
