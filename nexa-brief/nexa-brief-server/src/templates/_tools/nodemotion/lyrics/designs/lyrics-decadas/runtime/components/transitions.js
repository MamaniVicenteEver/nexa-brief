/* lyrics-decadas · transiciones de entrada (capa encima de la escena nueva).
   cut        : corte seco (base de la referencia).
   photoFlash : 2–3 cuadros de foto en semitono a pantalla completa.
   blueWipe   : rectángulo azul que cruza y descubre la escena.
   letterSlam : una letra gigante azul o blanca atraviesa la pantalla.
   Duración: config.transitions.flashSec / wipeSec. */
(function (root) {
  "use strict";
  const DC = root.Decadas, K = DC.core, R = DC.registry;

  R.transitions.cut = () => null;
  R.transitions.photoFlash = (sc, ctx) => {
    if (!ctx.photos.length) return null;
    const e = K.el("div", "dc-overlay dc-photo-bg");
    e.style.backgroundImage = `url(${ctx.photos[(sc.seed + 5) % ctx.photos.length]})`;
    return { root: e, update(lt) { e.style.display = lt < ctx.C.transitions.flashSec ? "block" : "none"; } };
  };
  R.transitions.blueWipe = (sc, ctx) => {
    const e = K.el("div", "dc-overlay", null, { background: ctx.C.colors.blue });
    const d = ctx.C.transitions.wipeSec;
    return { root: e, update(lt) {
      const p = K.prog(lt, 0, d);
      e.style.display = p < 1 ? "block" : "none";
      /* entra tapando desde la izquierda y sale por la derecha */
      e.style.clipPath = p < 0.5 ? `inset(0 ${((1 - K.ease.out(p * 2)) * 100).toFixed(1)}% 0 0)` : `inset(0 0 0 ${(K.ease.in((p - 0.5) * 2) * 100).toFixed(1)}%)`;
    } };
  };
  R.transitions.letterSlam = (sc, ctx) => {
    const ch = DC.parts.up(sc.text).replace(/[^\p{L}\p{N}]/gu, "").charAt(0) || "D";
    const e = K.el("div", "dc-overlay dc-slam");
    K.useFont(e, ctx.fonts.display, ctx.H * 0.9);
    e.textContent = ch;
    e.style.color = sc.seed % 2 ? ctx.C.colors.blue : ctx.C.colors.pale;
    const d = ctx.C.transitions.wipeSec;
    return { root: e, update(lt) {
      const p = K.prog(lt, 0, d);
      e.style.display = p < 1 ? "flex" : "none";
      e.style.transform = `translateX(${((0.6 - p * 1.4) * ctx.W).toFixed(1)}px)`;
    } };
  };
  DC.TRANSITIONS = Object.keys(R.transitions);
})(typeof window !== "undefined" ? window : globalThis);
