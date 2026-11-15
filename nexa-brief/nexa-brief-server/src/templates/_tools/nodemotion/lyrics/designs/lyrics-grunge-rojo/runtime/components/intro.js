// @nexa thumbnail-at: 1.8 — segundo en que el título de la intro está completo
// (canción demo). De ahí sale el fotograma de miniatura.
/* lyrics-grunge-rojo · intro.
   Metraje B/N con papel rasgado arriba y abajo; el título entra en rojo con estela
   (como «BOWL FULL OF PLENTY»), el artista aparece en blanco muy espaciado debajo,
   una corona de tiza remata y un destello cierra. Textos: config.intro.title / artist. */
(function (root) {
  "use strict";
  const G = root.GrungeRojo = root.GrungeRojo || {};
  root.NexaTemplateIntro = {
    cards(config) {
      const title = String(config?.title || "").trim();
      return title ? [{ text: title, label: String(config?.artist || ""), scale: 1 }] : [];
    }
  };
  if (!G.core) return;
  const K = G.core, R = G.registry, F = G.fondo;
  R.intro = function buildIntro(sc, ctx) {
    const P = G.parts, I = ctx.C.intro, D = sc.t1 - sc.t0;
    const S = P.scaffold({ ...sc, bg: "footage", v: { strip: "bottom" } }, ctx);
    const top = ctx.C.components.paper ? F.tornStrip(S.rootEl, ctx, "top", 0.1, sc.seed + 3) : null;
    const words = String(I.title || "").split(/\s+/).filter(Boolean).map((w, i) => ({ text: w, t: 0.25 + i * 0.12 }));
    const box = P.centerBox(S.txt, "gr-stack");
    const rows = P.split(words, P.portrait(ctx) && words.length > 2 ? 2 : 1);
    const size = K.fit(rows.map(P.textOf), ctx.fonts.condensed, ctx.W * 0.84, ctx.H * (P.portrait(ctx) ? 0.3 : 0.24));
    const T = rows.map(ws => P.row(box, ws, ctx.fonts.condensed, size, ctx.red));
    const thin = { ...ctx.fonts.thin, weight: 500, tracking: 0.5 };
    const art = I.artist ? P.row(box, [{ text: I.artist, t: 0.25 + words.length * 0.12 + 0.2 }], thin, Math.min(size * 0.24, K.fit([P.up(I.artist)], thin, ctx.W * 0.7, ctx.H * 0.06)), ctx.white, "gr-spaced") : { spans: [] };
    let crown = null;
    const L = F.leak(S.rootEl, "rgba(255,255,255,.9)");
    return P.finish(S, sc, ctx, { target: null, update: lt => {
      if (top) top.update(K.prog(lt, 0, 0.3));
      P.enter(T.flatMap(r => r.spans), lt, ctx);
      P.enter(art.spans, lt, ctx);
      if (!crown && ctx.C.components.doodles) crown = G.doodle(S.rootEl, ctx, "crown", P.boxOf(T[0].e, S.rootEl), sc.seed + 9);
      if (crown) crown(K.prog(lt, 0.8, 1.2));
      L.update(K.prog(lt, D - 0.35, D + 0.05));
    } });
  };
})(typeof window !== "undefined" ? window : globalThis);
