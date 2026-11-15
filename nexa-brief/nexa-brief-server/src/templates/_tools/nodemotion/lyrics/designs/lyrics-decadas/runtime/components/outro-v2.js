/* lyrics-decadas · Outro v2 «Contador».
   Fondo celeste. config.outro.title rueda en azul gigante carácter a carácter,
   «sub» en rótulos verticales negros arriba y abajo, fragmentos con foto que
   cruzan y una barra azul final con la línea feats. */
(function (root) {
  "use strict";
  const DC = root.Decadas, K = DC.core, R = DC.registry;
  R.outros["decadas.outrov2"] = function buildOutroV2(sc, ctx) {
    const O = ctx.C.outro, col = ctx.C.colors, P = DC.parts;
    const D = Math.max(0.6, sc.t1 - sc.t0);
    const rootEl = K.el("div", "dc-scene"); rootEl.style.background = col.pale;
    const fr = ctx.C.components.fragments ? P.fragments(rootEl, ctx, sc.seed, O.title || ctx.label, 3) : null;
    const T = P.centered(rootEl, ctx, P.up(O.title), ctx.fonts.display, ctx.W * 0.84, ctx.H * 0.22, "dc-blue");
    const times = T.spans.map((_, i) => 0.1 + i * Math.min(0.08, D * 0.3 / Math.max(1, T.spans.length)));
    const l1 = P.vlabel(rootEl, ctx, O.sub, col.black, ctx.W / 2, ctx.H * 0.2, ctx.u * 6.5, 1);
    const l2 = P.vlabel(rootEl, ctx, O.sub, col.black, ctx.W / 2, ctx.H * 0.8, ctx.u * 6.5, -1);
    const bar = K.el("div", "dc-outro-bar", rootEl, { background: col.blue });
    const feats = K.el("div", "dc-outro-feats", bar);
    K.useFont(feats, ctx.fonts.display, ctx.u * 4.2);
    feats.style.color = col.pale;
    const featsText = P.up(O.feats);
    return { root: rootEl, update(lt) {
      P.rollUpdate(T.spans, times, lt, ctx.C.motion.rollSec * 1.4, ctx.C.motion.rollGlyphs, sc.seed);
      l1.update(lt, 0.25); l2.update(lt, 0.25);
      if (fr) fr.update(lt, ctx.C.motion.fragmentSpeed * 0.6);
      const b = K.ease.expo(K.prog(lt, D * 0.62, D * 0.8));
      bar.style.width = (b * ctx.W).toFixed(1) + "px";
      feats.textContent = featsText.slice(0, Math.round(featsText.length * K.prog(lt, D * 0.75, D * 0.95)));
    } };
  };
})(typeof window !== "undefined" ? window : globalThis);
