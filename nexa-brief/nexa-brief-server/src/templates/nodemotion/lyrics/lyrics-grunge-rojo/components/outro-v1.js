/* lyrics-grunge-rojo · Outro v1 «Rasgado».
   Una hoja de papel rasgado cruza; detrás, sobre metraje B/N, el título
   (config.outro.title) cae gigante en blanco con eco rojo, «sub» en rojo muy espaciado,
   un tachón de pincel rojo lo subraya y la línea feats aparece abajo. Queda quieto al final. */
(function (root) {
  "use strict";
  const G = root.GrungeRojo, K = G.core, R = G.registry, F = G.fondo;
  R.outros["grunge.outrov1"] = function buildOutroV1(sc, ctx) {
    const P = G.parts, O = ctx.C.outro, D = Math.max(0.6, sc.t1 - sc.t0);
    const S = P.scaffold({ ...sc, bg: "footage", v: { strip: "top" } }, ctx);
    const tear = R.transitions.tear(sc, ctx, S.rootEl);
    const box = P.centerBox(S.txt, "gr-stack");
    const tw = [{ text: O.title || "", t: D * 0.12 }];
    const size = K.fit([P.up(O.title)], ctx.fonts.condensed, ctx.W * 0.82, ctx.H * 0.36);
    const gw = K.el("div", "gr-giant-wrap", box);
    const ghost = P.row(gw, tw, ctx.fonts.condensed, size, ctx.red, "gr-ghost");
    const main = P.row(gw, tw, ctx.fonts.condensed, size, ctx.white);
    const thin = { ...ctx.fonts.thin, weight: 600, tracking: 0.55 };
    const sub = P.row(box, [{ text: O.sub || "", t: D * 0.35 }], thin, Math.min(size * 0.22, K.fit([P.up(O.sub)], thin, ctx.W * 0.7, ctx.H * 0.07)), ctx.red, "gr-spaced");
    const feats = K.el("div", "gr-feats", S.txt);
    K.useFont(feats, { ...ctx.fonts.thin, weight: 500, tracking: 0.25 }, Math.max(11, ctx.u * 2.8));
    feats.style.color = ctx.white;
    const ft = P.up(O.feats);
    let line = null;
    return P.finish(S, sc, ctx, { target: null, update: lt => {
      tear(lt);
      P.enter(main.spans, lt, ctx, "slam"); P.enter(sub.spans, lt, ctx);
      ghost.e.style.visibility = lt >= D * 0.12 ? "visible" : "hidden";
      const r = K.rng(sc.seed + Math.floor(lt / 0.08));
      ghost.e.style.transform = lt < D * 0.6 ? `translate(${(r.range(-1, 1) * ctx.u).toFixed(1)}px,0)` : "translate(0,0)";
      if (!line && ctx.C.components.doodles) line = G.doodle(S.rootEl, ctx, "underline", P.boxOf(main.e, S.rootEl), sc.seed + 4);
      if (line) line(K.prog(lt, D * 0.45, D * 0.6));
      feats.textContent = ft.slice(0, Math.round(ft.length * K.prog(lt, D * 0.6, D * 0.85)));
    } });
  };
})(typeof window !== "undefined" ? window : globalThis);
