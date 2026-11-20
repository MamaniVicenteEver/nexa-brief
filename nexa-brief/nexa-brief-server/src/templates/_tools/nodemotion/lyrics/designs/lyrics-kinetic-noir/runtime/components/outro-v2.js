/* lyrics-kinetic-noir · outro v2: título en caja blanca invertida con sub y feats debajo (mezcla de caracteres),
   humo bajo y fundido a negro. Toma config.outro {title, sub, feats}. */
(function (root) {
  "use strict";
  const N = root.Noir, K = N.core, R = N.registry;
  R.outros["noir.outrov2"] = (sc, ctx) => {
    const O = ctx.C.outro;
    const words = N.synthWords([O.title || "Gracias", O.sub, O.feats].filter(Boolean).join(" "), 0.25, 0.12, 0.3);
    const inner = R.scenes.box({ ...sc, words, glitch: 0 }, ctx);
    return { root: inner.root, update(lt) {
      const d = sc.t1 - sc.t0;
      inner.update(Math.min(lt, d - 0.3));
      return { smoke: K.ease.out(K.prog(lt, 0.2, 1)), fade: K.ease.inOut(K.prog(lt, d - 0.75, 0.7)) };
    } };
  };
})(typeof window !== "undefined" ? window : globalThis);
