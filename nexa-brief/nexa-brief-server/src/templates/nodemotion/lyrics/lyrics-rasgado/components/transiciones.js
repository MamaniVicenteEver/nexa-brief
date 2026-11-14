/* Lyrics Rasgado · transiciones: la hoja nueva entra rasgada sobre la anterior
   (transition.overlapSec mantiene la anterior debajo).
   · tear  la hoja nueva sube (o baja) con el borde rasgado y reborde de fibra
   · rip   la hoja nueva se descubre en diagonal por una rasgadura irregular
   · slam  corte con golpe de escala
   Además: cut y las del motor (fade, slice, flash, wipeL…). */
const R = window.NexaPromo_lyrics_rasgado, k = R.kit;
const poly = pts => `polygon(${pts.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(", ")})`;

R.transitions.tear = (X, d, K) => {
  const { W, H, r, u } = X, up = r() < 0.6, amp = 0.07 * H, edge = k.tearPath(W, amp, r), steps = 10;
  /* p = 0 → hoja fuera del cuadro; p = 1 → cubre todo */
  const mk = (p, off = 0) => {
    const y0 = up ? H * (1 - p) - amp : H * p + amp;
    const e = edge.map(([x, y]) => [x, up ? y0 + y - off : y0 - y + off]);
    return up ? poly([...e, [W, H + amp * 2], [0, H + amp * 2]]) : poly([[0, -amp * 2], [W, -amp * 2], ...e.slice().reverse()]);
  };
  const rim = K.div(X.root, "patch", { left: "0px", top: "0px", width: W + "px", height: H + "px", background: "#F4F2EC" });
  X.root.insertBefore(rim, X.L);   /* reborde de fibra: debajo de la hoja nueva, encima de la anterior */
  const rt = X.T(X.L, "clipPath", mk(0)), rr = X.T(rim, "clipPath", mk(0, 4 * u));
  for (let j = 1; j <= steps; j++) { const p = 1 - Math.pow(1 - j / steps, 3); rt.set(d * j / steps, mk(p * 1.15)); rr.set(d * j / steps, mk(p * 1.15, 4 * u)); }
  rt.set(d + 0.001, "none");
  X.T(rim, "opacity", "1", true).set(d, "0");
};

R.transitions.rip = (X, d, K) => {
  const { W, H, r } = X, steps = 10, n = 16, jit = Array.from({ length: n + 1 }, () => (r() - 0.5) * 0.08 * W);
  const mk = p => { const pts = [[0, 0]];
    for (let i = 0; i <= n; i++) { const y = i / n * H; pts.push([Math.max(0, (p * 1.5 - 0.25) * W + jit[i] - (y / H) * 0.25 * W), y]); }
    pts.push([0, H]); return poly(pts); };
  const tr = X.T(X.L, "clipPath", mk(0));
  for (let j = 1; j <= steps; j++) tr.set(d * j / steps, mk(j / steps));
  tr.set(d + 0.001, "none");
};

R.transitions.slam = (X, d, K) => {
  X.T(X.L, "transform", "scale(1.12)").to(0, d * 0.7, "scale(1)", K.EASE_OUT);
  X.T(X.L, "opacity", "0").to(0, d * 0.2, "1");
};
