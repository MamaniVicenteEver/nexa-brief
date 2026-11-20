/* lyrics-kinetic-noir · outro v1 (por defecto): título slab tecleado con cursor rojo, subtítulo espaciado,
   línea final tenue y fundido a negro. Toma config.outro {title, sub, feats}. */
(function (root) {
  "use strict";
  const N = root.Noir, K = N.core, R = N.registry;
  R.outros["noir.outrov1"] = (sc, ctx) => {
    const O = ctx.C.outro;
    const tw = N.synthWords(O.title || "Gracias", 0.2, 0.18, 0.35);
    const sw = N.synthWords(O.sub, 0.25 + tw.length * 0.18 + 0.3, 0.12, 0.25);
    const inner = R.scenes.subtitle({ ...sc, words: tw.concat(sw), split: tw.length, glitch: 0 }, ctx);
    let feats = null;
    if (String(O.feats || "").trim()) {
      feats = K.el("div", "nz-feats", inner.root, String(O.feats).toLocaleUpperCase("es"));
      K.applyFont(feats, ctx.fonts.sans, Math.max(10, ctx.u * 1.5));
      feats.style.top = (ctx.H * 0.84) + "px";
    }
    return { root: inner.root, update(lt) {
      const d = sc.t1 - sc.t0;
      inner.update(lt);
      if (feats) feats.style.opacity = String(K.ease.out(K.prog(lt, 1.1, 0.6)));
      return { fade: K.ease.inOut(K.prog(lt, d - 0.75, 0.7)) };
    } };
  };
})(typeof window !== "undefined" ? window : globalThis);
