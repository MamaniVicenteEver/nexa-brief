/* Lyrics Hologram · transiciones de entrada (transition.overlapSec mantiene la
   escena anterior debajo).
   · holoWipe   una franja holográfica diagonal cruza y descubre la escena nueva
   · glitch     la escena nueva entra a cortes horizontales con desplazamiento
   · flashWhite destello blanco que se apaga sobre la escena nueva
   · shutter    dos persianas oscuras que se abren desde el centro
   Además: cut y las del motor (fade, slice, flash, zoomIn…). */
const R = window.NexaPromo_lyrics_hologram_worlds, k = R.kit;
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

/* paneles: la escena anterior queda en rectángulos que se deslizan en direcciones distintas
   (la nueva se ve por fuera de los paneles; requiere transition.overlapSec > 0) */
R.transitions.tiles = (X, d, K) => {
  const { W, H } = X, s = (X.sc?.idx ?? 1) * 1.37;
  const r = i => { const v = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453; return v - Math.floor(v); };
  const cx = W * (0.35 + 0.3 * r(1)), cy = H * (0.35 + 0.3 * r(2)), cx2 = W * (0.3 + 0.4 * r(3));
  const cells = [[0, 0, cx, cy], [cx, 0, W - cx, cy], [0, cy, cx2, H - cy], [cx2, cy, W - cx2, H - cy]];
  const dirs = cells.map((c, i) => { const k2 = Math.floor(r(i + 5) * 4); return [[0, -1], [0, 1], [-1, 0], [1, 0]][k2]; });
  const steps = 8;
  const mk = p => {
    let path = `M0 0 H${W} V${H} H0 Z`;
    cells.forEach(([x, y, w, h], i) => {
      const e = Math.pow(p, 1.6), dx = dirs[i][0] * e * (w + 0.1 * W), dy = dirs[i][1] * e * (h + 0.1 * H);
      path += ` M${(x + dx).toFixed(1)} ${(y + dy).toFixed(1)} h${w.toFixed(1)} v${h.toFixed(1)} h${(-w).toFixed(1)} Z`;
    });
    return `path(evenodd, '${path}')`;
  };
  const tr = X.T(X.L, "clipPath", mk(0), true);
  for (let j = 1; j <= steps; j++) tr.set(d * j / steps, mk(j / steps));
  tr.set(d + 0.001, "none");
};

/* bloques negros de glitch que tapan y destapan la escena nueva */
R.transitions.blocks = (X, d, K) => {
  const { W, H } = X, s = (X.sc?.idx ?? 1) * 2.11;
  const r = i => { const v = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453; return v - Math.floor(v); };
  for (let i = 0; i < 7; i++) {
    const b = K.div(X.root, "patch", { left: r(i) * W * 0.8 + "px", top: r(i + 20) * H * 0.85 + "px", width: (0.12 + 0.35 * r(i + 40)) * W + "px", height: (0.06 + 0.18 * r(i + 60)) * H + "px", background: "#06060a", zIndex: 40 });
    const t0 = r(i + 80) * d * 0.4, t1 = t0 + d * (0.35 + 0.5 * r(i + 90));
    X.T(b, "visibility", "visible", true).set(t1, "hidden");
    if (t0 > 0.01) X.T(b, "opacity", "1", true).set(t0, "1");
  }
};
