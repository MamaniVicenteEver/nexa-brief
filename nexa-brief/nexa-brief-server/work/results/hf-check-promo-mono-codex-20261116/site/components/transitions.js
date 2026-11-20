/* Promo Mono · transiciones propias (además de las del núcleo: fade, blur, iris,
   wipeL/R/Up/Down, bars, flash, zoomIn, zoomOut, slice).
   dots      : rejilla de puntos negros que se encogen y descubren la escena nueva
   lineSweep : una línea blanca barre la pantalla y deja la escena detrás
   blink     : un cuadro negro breve (corte con respiración)
   pillPop   : la escena entra desde una píldora blanca que se expande */
const R = window.NexaPromo_promo_mono, k = R.kit;

R.transitions.dots = (X, d, K) => {
  const { W, H } = X, cell = 34 * X.u;
  const s = k.svg(X.root, W, H, 60);
  const cols = Math.ceil(W / cell) + 1, rows = Math.ceil(H / cell) + 1;
  const id = "dt" + X.sc.idx;
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  defs.innerHTML = `<pattern id="${id}" width="${cell}" height="${cell}" patternUnits="userSpaceOnUse"><circle cx="${cell / 2}" cy="${cell / 2}" r="${cell * 0.72}" fill="${K.P.bg}"/></pattern>`;
  s.appendChild(defs);
  const c = defs.querySelector("circle");
  k.path(s, `M0,0 H${cols * cell} V${rows * cell} H0 Z`, { fill: `url(#${id})` });
  /* la propiedad r del círculo se escribe como atributo */
  const tr = X.T({ set r(v) { c.setAttribute("r", v); } }, "@r", String(cell * 0.72)); tr.to(0, d, "0", K.EASE_IN);
  X.T(s, "visibility", "visible", true).set(d + 0.01, "hidden");
};
R.transitions.lineSweep = (X, d, K) => {
  const line = K.div(X.root, "patch", { left: 0, top: 0, width: Math.max(2, 3 * X.u) + "px", height: X.H + "px", background: K.P.fg, zIndex: 60 });
  X.T(X.L, "clipPath", "inset(0% 100% 0% 0%)").to(0, d, "inset(0% 0% 0% 0%)", K.EASE_IO);
  X.T(line, "transform", "translateX(0px)").to(0, d, `translateX(${X.W}px)`, K.EASE_IO);
  X.T(line, "opacity", "1").to(d * 0.9, d * 0.1, "0");
};
R.transitions.blink = (X, d, K) => {
  const f = K.div(X.root, "patch", { left: 0, top: 0, width: X.W + "px", height: X.H + "px", background: K.P.bg, zIndex: 60 });
  X.T(f, "visibility", "visible", true).set(Math.min(0.08, d * 0.4), "hidden");
};
R.transitions.pillPop = (X, d, K) => {
  const { W, H } = X;
  X.T(X.L, "clipPath", `inset(${H / 2 - 22 * X.u}px ${W / 2 - 60 * X.u}px round ${40 * X.u}px)`).to(0, d, "inset(0px 0px round 0px)", K.EASE_IO);
};
