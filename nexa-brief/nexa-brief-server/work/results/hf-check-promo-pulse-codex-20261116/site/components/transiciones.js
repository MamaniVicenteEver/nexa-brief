/* Promo Pulse · transiciones de entrada (d = transition.duration, limitado
   por transition.overlapSec; la escena anterior sigue debajo).
   · zoomBlur   la escena nueva llega con zoom, desenfoque y sobreexposición
   · whip       barrido horizontal con desenfoque de movimiento
   · greenFlash destello verde neón con golpe de zoom
   · panels     tres columnas verticales que se abren desde el centro
   Además sirven las del motor: fade, flash, slice, wipeL, zoomIn, bars… */
const R = window.NexaPromo_promo_pulse;

R.transitions.zoomBlur = (X, d, K) => {
  const I = K.C.anim.intensity ?? 1;
  X.T(X.L, "transform", `scale(${(1 + 0.28 * I).toFixed(3)})`).to(0, d, "scale(1)", K.EASE_OUT);
  X.T(X.L, "filter", "blur(14px) brightness(1.7)").to(0, d, "blur(0px) brightness(1)", K.EASE_OUT);
  X.T(X.L, "opacity", "0").to(0, d * 0.35, "1");
};

R.transitions.whip = (X, d, K) => {
  const dir = X.r() < 0.5 ? 1 : -1;
  X.T(X.L, "transform", `translateX(${(dir * 0.4 * X.W).toFixed(1)}px)`).to(0, d, "translateX(0px)", "cubic-bezier(.2,.7,.2,1)");
  K.blurPass(X.T(X.L, "filter", "none", true), 0, d, "x");
  X.T(X.L, "opacity", "0").to(0, d * 0.3, "1");
};

R.transitions.greenFlash = (X, d, K) => {
  const f = K.div(X.root, "patch", { left: "0px", top: "0px", width: X.W + "px", height: X.H + "px", background: K.P.green, zIndex: 60, mixBlendMode: "screen" });
  X.T(f, "opacity", "0.85").to(0, d, "0", K.EASE_OUT);
  X.T(X.L, "transform", "scale(1.12)").to(0, d, "scale(1)", K.EASE_OUT);
};

R.transitions.panels = (X, d, K) => {
  const { W, H } = X, n = 3, steps = 12;
  const poly = pts => `polygon(${pts.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(", ")})`;
  const mk = p => { const pts = [];
    for (let i = 0; i < n; i++) {
      const q = Math.min(1, Math.max(0, (p - i * 0.15) / 0.7)), e = 1 - Math.pow(1 - q, 3), x0 = i * W / n, w = W / n * e, cx = x0 + W / n / 2;
      pts.push([cx - w / 2, 0], [cx + w / 2 + 1, 0], [cx + w / 2 + 1, H], [cx - w / 2, H], [cx - w / 2, 0]);
    }
    return poly(pts); };
  const tr = X.T(X.L, "clipPath", mk(0));
  for (let j = 1; j <= steps; j++) tr.set(d * j / steps, mk(j / steps));
  tr.set(d + 0.001, "none");
};
