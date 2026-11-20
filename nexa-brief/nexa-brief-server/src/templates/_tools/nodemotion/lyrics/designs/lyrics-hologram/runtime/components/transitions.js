/* Lyrics Hologram · transiciones de entrada (transition.overlapSec mantiene la
   escena anterior debajo).
   · holoWipe   una franja holográfica diagonal cruza y descubre la escena nueva
   · glitch     la escena nueva entra a cortes horizontales con desplazamiento
   · flashWhite destello blanco que se apaga sobre la escena nueva
   · shutter    dos persianas oscuras que se abren desde el centro
   Además: cut y las del motor (fade, slice, flash, zoomIn…). */
const R = window.NexaPromo_lyrics_hologram, k = R.kit;
const poly = pts => `polygon(${pts.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(", ")})`;

R.transitions.holoWipe = (X, d, K) => {
  const { W, H } = X, sk = 0.28 * W, steps = 10;
  /* p = 0 → nada visible; p = 1 → cubre todo. Borde diagonal (arriba adelantado). */
  const edge = p => -sk + p * (W + 2 * sk);
  const mk = p => poly([[-sk, 0], [edge(p) + sk * 0.5, 0], [edge(p) - sk * 0.5, H], [-sk, H]]);
  const tr = X.T(X.L, "clipPath", mk(0));
  for (let j = 1; j <= steps; j++) tr.set(d * j / steps, mk(Math.pow(j / steps, 0.85)));
  tr.set(d + 0.001, "none");
  const bw = 0.07 * W;
  const band = K.div(X.root, "patch", { left: "0px", top: (-0.1 * H) + "px", width: bw + "px", height: 1.2 * H + "px", zIndex: 40 });
  k.holoFill(X, K, band, { text: false, size: "300% 200%" });
  const bt = X.T(band, "transform", `translateX(${(edge(0) - bw / 2).toFixed(1)}px) skewX(${(-Math.atan2(sk, H) * 180 / Math.PI).toFixed(1)}deg)`);
  for (let j = 1; j <= steps; j++) bt.set(d * j / steps, `translateX(${(edge(Math.pow(j / steps, 0.85)) - bw / 2).toFixed(1)}px) skewX(${(-Math.atan2(sk, H) * 180 / Math.PI).toFixed(1)}deg)`);
  X.T(band, "visibility", "visible", true).set(d, "hidden");
};

R.transitions.glitch = (X, d, K) => {
  const { u } = X, g = Math.max(0.3, K.C.look.glitch), n = 6;
  const tc = X.T(X.L, "clipPath", "inset(0% 0% 100% 0%)", true), tt = X.T(X.L, "transform", "translateX(0px)", true);
  for (let i = 0; i < n; i++) {
    const t = d * i / n, a = Math.floor(X.r() * 70), b = Math.min(100, a + 15 + Math.floor(X.r() * 40));
    tc.set(t, `inset(${a}% 0% ${100 - b}% 0%)`);
    tt.set(t, `translateX(${((X.r() - 0.5) * 40 * u * g).toFixed(1)}px)`);
  }
  tc.set(d, "none"); tt.set(d, "translateX(0px)");
};

R.transitions.flashWhite = (X, d, K) => {
  const f = K.div(X.root, "patch", { left: "0px", top: "0px", width: X.W + "px", height: X.H + "px", background: "#fff", zIndex: 40 });
  X.T(f, "opacity", "1").to(0, d, "0", K.EASE_OUT);
  X.T(f, "visibility", "visible", true).set(d, "hidden");
};

R.transitions.shutter = (X, d, K) => {
  const { W, H } = X;
  for (const s of [-1, 1]) {
    const b = K.div(X.root, "patch", { left: "0px", top: (s < 0 ? 0 : H / 2) + "px", width: W + "px", height: H / 2 + 1 + "px", background: K.P.void, zIndex: 40 });
    k.holoBox(X, K, b, { left: "0px", top: (s < 0 ? H / 2 - 2 : 0) + "px", width: W + "px", height: "3px" });
    X.T(b, "transform", "translateY(0%)").to(0, d, `translateY(${s * 101}%)`, K.EASE_IO);
    X.T(b, "visibility", "visible", true).set(d, "hidden");
  }
};
