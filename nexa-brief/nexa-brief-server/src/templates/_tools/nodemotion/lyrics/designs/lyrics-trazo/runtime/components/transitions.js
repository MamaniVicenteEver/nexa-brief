/* lyrics-trazo · movimientos (durante la escena) y transiciones (al entrar).
   Funciones puras de tiempo local: modifican el estado {scale, dx, dy, rot, inv, hide}.
   El corte duro es la base de la referencia; las transiciones añaden el golpe. */
(function (root) {
  "use strict";
  const T = root.Trazo, K = T.core, R = T.registry;

  /* ---- movimientos: m = config.motion ---- */
  R.motions.none = () => {};
  /* entra un poco más grande y se asienta (el “zoom de golpe” de la referencia) */
  R.motions.punch = (lt, dur, m, st) => { st.scale *= 1 + m.punch * (1 - K.ease.out(K.prog(lt, 0, Math.min(0.22, dur * 0.6)))); };
  /* aparece pequeño y rebota a su tamaño */
  R.motions.pop = (lt, dur, m, st) => { st.scale *= 0.8 + 0.2 * K.ease.back(K.prog(lt, 0, Math.min(0.24, dur * 0.7))); };
  /* acercamiento lento y continuo */
  R.motions.drift = (lt, dur, m, st) => { st.scale *= 1 + m.drift * K.prog(lt, 0, Math.max(0.3, dur)); };
  /* se aleja: empieza cerca y retrocede */
  R.motions.recede = (lt, dur, m, st) => { st.scale *= 1 + m.drift * 1.6 * (1 - K.prog(lt, 0, Math.max(0.3, dur))); };
  /* sacudida a la cadencia del dibujo */
  R.motions.shake = (lt, dur, m, st, step, seed) => {
    const r = K.rng(seed + step * 7);
    st.dx += r.range(-1, 1) * m.shake * 10;
    st.dy += r.range(-1, 1) * m.shake * 10;
    st.rot += r.range(-1, 1) * m.shake * 2;
  };

  /* ---- transiciones de entrada: tr = config.transitions ---- */
  R.transitions.cut = () => {};
  /* uno o dos cuadros con el fondo invertido */
  R.transitions.flash = (lt, dur, st, tr) => { if (lt < tr.flashSec) st.inv = !st.inv; };
  /* entra desde muy cerca */
  R.transitions.zoom = (lt, dur, st, tr) => { st.scale *= 1 + 0.35 * (1 - K.ease.out(K.prog(lt, 0, tr.zoomSec))); };
  /* entra corrido hacia un lado */
  R.transitions.shift = (lt, dur, st, tr) => { st.dx += (1 - K.ease.out(K.prog(lt, 0, tr.zoomSec))) * 60; };
  /* pantalla vacía un instante y aparece de golpe */
  R.transitions.blink = (lt, dur, st, tr) => { if (lt < tr.flashSec * 0.75) st.hide = true; };

  T.MOTIONS = Object.keys(R.motions);
  T.TRANSITIONS = Object.keys(R.transitions);
})(typeof window !== "undefined" ? window : globalThis);
