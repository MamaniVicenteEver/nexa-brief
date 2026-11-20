/* lyrics-kinetic-noir · intro: título en grotesca extendida dentro del marco, artista pequeño sobre el borde.
   Sin título configurado: pausa (línea y recuadro vacío) hasta la primera frase. */
(function (root) {
  "use strict";
  const N = root.Noir, R = N.registry;
  R.intro = (sc, ctx) => {
    const I = ctx.C.intro;
    if (!String(I.title || "").trim()) return R.pause(sc, ctx);
    const tw = N.synthWords(I.title, 0.15, 0.14);
    const aw = N.synthWords(I.artist, 0.15 + tw.length * 0.14 + 0.35, 0.1, 0.25);
    return R.scenes.frame({ ...sc, words: tw.concat(aw), split: tw.length, glitch: 0.16 }, ctx);
  };
})(typeof window !== "undefined" ? window : globalThis);
