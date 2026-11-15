/* Promo Breaking · transiciones de entrada. Se dibujan en la escena nueva
   durante d segundos (transition.duration, limitado por transition.overlapSec):
   la escena anterior sigue viva debajo mientras dura el solapamiento.
   · stripes  franjas verticales blancas y rojas que tapan y destapan
   · redBlock bloque rojo (y uno blanco) que baja tapando y sigue de largo
   · panels   la escena nueva entra en 5 columnas que suben y bajan alternadas
   · squash   la escena se abre desde una línea horizontal con un destello
   · zoomCut  corte seco con golpe de zoom
   Además sirven las del motor: fade, flash, slice, wipeL, wipeR, zoomIn, bars… */
(() => {
const R = window.NexaPromo_promo_breaking;
const poly = pts => `polygon(${pts.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(", ")})`;

R.transitions.stripes = (X, d, K) => {
  const { W, H, r, root } = X, n = 9, half = d * 0.5;
  K.hide(X, X.L, half);
  const ws = Array.from({ length: n }, () => 0.35 + r()), sum = ws.reduce((a, b) => a + b, 0);
  const cols = [K.P.white, K.P.red, K.P.white, K.P.ink];
  let x = 0;
  ws.forEach((w, i) => {
    const ww = w / sum * W, top = r() < 0.5, s = r() * half * 0.45;
    const bar = K.div(root, "patch", { left: x - 0.5 + "px", top: "0px", width: ww + 1 + "px", height: H + "px", zIndex: 60,
      background: cols[Math.floor(r() * cols.length)], transformOrigin: top ? "50% 0%" : "50% 100%" });
    const out = top ? "100" : "-100";
    X.T(bar, "transform", "translateY(0%) scaleY(0)").to(s, half - s, "translateY(0%) scaleY(1)", K.EASE_IN)
      .to(half + s * 0.5, half - s * 0.5, `translateY(${out}%) scaleY(1)`, K.EASE_OUT);
    x += ww;
  });
};

R.transitions.redBlock = (X, d, K) => {
  const { W, H, root } = X, half = d * 0.5;
  K.hide(X, X.L, half);
  const mk = (col, delay) => {
    const b = K.div(root, "patch", { left: "0px", top: "0px", width: W + "px", height: H + "px", background: col, zIndex: 60 });
    X.T(b, "transform", "translateY(-100%)").to(delay, half - delay * 0.5, "translateY(0%)", K.EASE_IN).to(half + delay * 0.5, half - delay * 0.5, "translateY(100%)", K.EASE_OUT);
  };
  mk(K.P.white, 0);
  mk(K.P.red, d * 0.12);
};

R.transitions.panels = (X, d, K) => {
  const { W, H } = X, n = 5, steps = 12, delay = Array.from({ length: n }, (_, i) => i / n * 0.45);
  const mk = p => { const pts = [];
    for (let i = 0; i < n; i++) {
      const x0 = i * W / n, x1 = x0 + W / n + 1, q = Math.min(1, Math.max(0, (p - delay[i]) / 0.55)), e = 1 - Math.pow(1 - q, 3), h = H * e;
      const y0 = i % 2 ? 0 : H - h;
      pts.push([x0, y0], [x1, y0], [x1, y0 + h], [x0, y0 + h], [x0, y0]);
    }
    return poly(pts); };
  const tr = X.T(X.L, "clipPath", mk(0));
  for (let j = 1; j <= steps; j++) tr.set(d * j / steps, mk(j / steps));
  tr.set(d + 0.001, "none");
  /* separadores rojos finos durante la entrada */
  for (let i = 1; i < n; i++) {
    const s = K.div(X.root, "patch", { left: i * W / n - 1.5 * X.u + "px", top: "0px", width: 3 * X.u + "px", height: H + "px", background: K.P.red, zIndex: 60 });
    X.T(s, "opacity", "1").to(d * 0.8, d * 0.2, "0");
  }
};

R.transitions.squash = (X, d, K) => {
  X.T(X.L, "transform", "scaleY(0.02)").to(0, d, "scaleY(1)", K.EASE_OUT);
  const ln = K.div(X.root, "patch", { left: "0px", top: X.H / 2 - X.u + "px", width: X.W + "px", height: Math.max(2, 2 * X.u) + "px", background: K.P.white, zIndex: 60 });
  X.T(ln, "opacity", "1").to(d * 0.3, d * 0.5, "0");
};

R.transitions.zoomCut = (X, d, K) => {
  X.T(X.L, "transform", "scale(1.16)").to(0, d * 0.8, "scale(1)", K.EASE_OUT);
  const f = K.div(X.root, "patch", { left: "0px", top: "0px", width: X.W + "px", height: X.H + "px", background: K.P.white, zIndex: 60 });
  X.T(f, "opacity", "0.55").to(0, d * 0.35, "0", K.EASE_OUT);
};
})();
