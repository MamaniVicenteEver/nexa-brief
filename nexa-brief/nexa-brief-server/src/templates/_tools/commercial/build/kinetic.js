/* ======================= ESCENAS · promo-kinetic =======================
   Réplica del pack "kinetic typography" (30 animaciones de texto repetido):
   gris carbón con grano, rayas y pelos de película, contador "07 / 30" y
   código de tiempo en las esquinas; UNA palabra/frase por escena, repetida en
   filas, con una animación distinta cada vez (desde el centro, ola, cascada,
   rotación, ondas, escala dinámica, marcador, perspectiva, cortes, etc.).
   Sin metraje: todo es texto → funciona igual con cualquier guion.
   config.scenes[i] = { type, color: "white"|"red"|"green"|"orange"|"yellow"|
   "grad", bg: "none"|"block" } · guion en lyrics.json (1 segmento = 1 escena). */
const P = C.palette;
const U = s => String(s).toUpperCase();
const COL = { white: P.white, red: P.red, green: P.green, orange: P.orange, yellow: P.yellow, teal: P.teal };
const col = X => COL[X.sc.slot.color] || P.white;
const W0 = X => U(X.lines[0]?.text || X.sc.seg.text || "");
const T0 = X => Math.max(0.02, X.lines[0]?.rt ?? 0.05);
const GRAD = ["#F2C81E", "#F08A1A", "#E3401E", "#C02B8E", "#5A3FD6", "#2F5FE0", "#B8B7B0"];

/* ---- fondo: carbón + grano + rayas de película + HUD de esquinas ---- */
const HAIRS = (() => {
  const cv = doc.createElement("canvas"); cv.width = 1280; cv.height = 720;
  const cx = cv.getContext("2d");
  for (let i = 0; i < 26; i++) {
    cx.strokeStyle = `rgba(0,0,0,${0.25 + texRng() * 0.35})`; cx.lineWidth = 0.8 + texRng();
    cx.beginPath(); let x = texRng() * 1280, y = texRng() * 720; cx.moveTo(x, y);
    for (let k = 0; k < 4; k++) { x += (texRng() - 0.5) * 40; y += (texRng() - 0.5) * 40; cx.quadraticCurveTo(x + (texRng() - 0.5) * 30, y + (texRng() - 0.5) * 30, x, y); }
    cx.stroke();
  }
  return `url(${cv.toDataURL()})`;
})();
function base(X) {
  const { W, H, u, r, sc } = X;
  const L = div(X.root, "lay", { background: P.bg });
  div(L, "lay", { background: "radial-gradient(ellipse at 50% 45%, rgba(255,255,255,0.05), transparent 65%)" });
  div(L, "lay", { backgroundImage: HAIRS, backgroundSize: "cover", opacity: 0.9, transform: `translate(${(r() - 0.5) * 40}px, ${(r() - 0.5) * 30}px)` });
  for (let i = 0; i < 2; i++) div(L, "patch", { left: r() * W + "px", top: 0, width: Math.max(1, u) + "px", height: H + "px", background: `rgba(255,255,255,${0.04 + r() * 0.05})` });
  const n = String(sc.idx + 1).padStart(2, "0"), tot = String(scenes.length).padStart(2, "0");
  const hud = (s, x, y, ax) => { const o = tx(L, s, { cls: "mono", fs: 7 * u, x, y, ax, color: "rgba(230,230,230,0.55)" }); o.el.style.letterSpacing = "0.05em"; };
  hud(`${n} / ${tot}`, 0.95 * W, 0.05 * H, 1);
  hud(C.brand?.tag || "", 0.03 * W, 0.05 * H, 0);
  const tc = Math.max(0, (C.duration || 60) - sc.t0);
  hud(`00:${String(Math.floor(tc)).padStart(2, "0")}.${String(Math.floor((tc % 1) * 100)).padStart(2, "0")}`, 0.03 * W, 0.95 * H, 0);
  div(L, "patch", { left: 0.955 * W + "px", top: 0.935 * H + "px", width: 7 * u + "px", height: 7 * u + "px", background: "rgba(230,230,230,0.6)" });
  if (sc.slot.bg === "block") {
    const b = div(L, "patch", { left: 0.22 * W + "px", top: 0.02 * H + "px", width: 0.56 * W + "px", height: 0.96 * H + "px", background: COL[sc.slot.block] || P.orange });
    X.T(b, "transform", "scaleY(0)").to(0.05, 0.25, "scaleY(1)", EASE_OUT); b.style.transformOrigin = "50% 0%";
  }
  return L;
}
/* filas de la misma palabra: n filas, alto de fila lh, tamaño fs */
function rowsOf(X, L, s, n, o = {}) {
  const { W, H } = X;
  const fs = o.fs ?? Math.min(fit(s, "ki", o.ls ?? 0, (o.w ?? 0.62) * W, 1e9), (0.9 * H / n) / (o.lh ?? 0.92));
  const lh = fs * (o.lh ?? 0.92), y0 = H / 2 - (n - 1) * lh / 2;
  const out = [];
  for (let i = 0; i < n; i++) {
    const c = o.color ? (typeof o.color === "function" ? o.color(i) : o.color) : col(X);
    const t = tx(L, s, { cls: "ki", fs, x: o.x ?? W / 2, y: y0 + i * lh, ax: o.ax ?? 0.5, color: c, ls: o.ls, split: o.split, stroke: o.stroke });
    if (o.stroke) t.el.style.webkitTextStroke = `${Math.max(1, fs * 0.02)}px ${c}`;
    out.push(t);
  }
  return { rows: out, fs, lh, y0 };
}
const show = (X, el, t) => { if (t > 0.001) X.T(el, "visibility", "hidden", true).set(t, "visible"); };
const hideAt = (X, el, t) => X.T(el, "visibility", "visible", true).set(t, "hidden");
const mid = n => (n - 1) / 2;
/* salida común: todo se comprime hacia el centro o baja */
function exit(X, L, kind = "squash") {
  const te = X.dur - 0.26;
  if (te < 0.3) return;
  if (kind === "squash") X.T(L, "transform", "scaleY(1)").to(te, 0.24, "scaleY(0)", EASE_IN);
  else if (kind === "slide") X.T(L, "transform", "translateX(0px)").to(te, 0.24, `translateX(${-X.W}px)`, EASE_IN);
  else X.T(L, "opacity", "1").to(te, 0.22, "0");
}

const B = {};

/* desde el centro: filas que nacen desde la del medio (arriba/abajo) */
B.fromCenter = (sc, X) => {
  const L = base(X), G = div(X.root, "lay"), s = W0(X), n = 9, { rows: R, lh } = rowsOf(X, G, s, n, { w: 0.5 });
  R.forEach((t, i) => { const d = i - mid(n), at = T0(X) + Math.abs(d) * 0.05; X.T(t.box, "transform", `translate(-50%, ${-d * lh - 50}%)`).to(at, 0.35, "translate(-50%, -50%)", EASE_OUT); show(X, t.box, at); });
  const t2 = X.dur * 0.55;
  X.T(G, "transform", "scale(1)").to(t2, 0.35, "scale(3.2)", EASE_IN);
  R.forEach((t, i) => { if (i !== Math.round(mid(n))) hideAt(X, t.box, t2 + 0.2); });
};

/* letras estiradas: la palabra crece estirando las letras de los bordes */
B.stretchChars = (sc, X) => {
  const { W, H } = X, L = base(X), G = div(X.root, "lay"), s = W0(X);
  const fs = fit(s, "ki", 0.2, 0.6 * W, 0.16 * H);
  const t = tx(G, s, { cls: "ki", fs, x: W / 2, y: H / 2, color: col(X), ls: 0.2, split: "chars" });
  const n = t.chars.length;
  t.chars.forEach((c, i) => {
    const edge = i === 0 || i === n - 1;
    show(X, c, T0(X) + Math.abs(i - mid(n)) * 0.03);
    if (edge) { c.style.transformOrigin = i === 0 ? "100% 50%" : "0% 50%"; X.T(c, "transform", "scaleX(1)").to(X.dur * 0.35, 0.4, "scaleX(6)", EASE_IO); }
  });
  X.T(t.el, "letterSpacing", "0.2em").to(T0(X), 0.6, "0.5em", EASE_OUT);
  exit(X, G, "fade");
};

/* ola: filas desplazadas en onda que se enderezan */
B.wave = (sc, X) => {
  const L = base(X), G = div(X.root, "lay"), s = W0(X), n = 9, { rows: R } = rowsOf(X, G, s, n, { w: 0.62, split: "chars" });
  R.forEach((t, i) => t.chars.forEach((c, k) => {
    const ph = Math.sin(k * 0.6 + i * 0.5);
    X.T(c, "transform", `translateY(${ph * 60}%) rotate(${ph * 25}deg)`).to(T0(X) + k * 0.02, 0.6, "translateY(0%) rotate(0deg)", EASE_OUT);
    show(X, c, T0(X) + k * 0.015 + i * 0.02);
  }));
  X.T(G, "transform", "skewY(0deg)").to(X.dur * 0.6, 0.4, "skewY(-6deg)", EASE_IO);
  exit(X, G);
};

/* cascada: filas que caen y se apilan desde arriba */
B.cascade = (sc, X) => {
  const L = base(X), G = div(X.root, "lay"), s = W0(X), n = 8, { rows: R, lh } = rowsOf(X, G, s, n, { w: 0.48 });
  R.forEach((t, i) => { const at = T0(X) + (n - 1 - i) * 0.07; X.T(t.el, "transform", `translateY(${-(i + 2) * 100}%)`).to(at, 0.3, "translateY(0%)", "cubic-bezier(.5,0,.8,.6)"); show(X, t.box, at); });
  const te = X.dur * 0.62;
  R.forEach((t, i) => X.T(t.box, "opacity", "1").to(te + i * 0.04, 0.2, i % 2 ? "0.25" : "1"));
  exit(X, G);
};

/* rotación: una fila gira sola, luego se multiplica */
B.rotating = (sc, X) => {
  const { W, H } = X, L = base(X), G = div(X.root, "lay"), s = W0(X), n = 7, { rows: R, lh } = rowsOf(X, G, s, n, { w: 0.5 });
  const c = Math.round(mid(n));
  X.T(R[c].el, "transform", "rotate(-90deg) scale(0.6)").to(T0(X), 0.5, "rotate(0deg) scale(1)", EASE_OUT);
  show(X, R[c].box, T0(X));
  R.forEach((t, i) => { if (i === c) return; const at = T0(X) + 0.5 + Math.abs(i - c) * 0.06; show(X, t.box, at); X.T(t.el, "transform", `translateY(${(c - i) * 100}%)`).to(at, 0.25, "translateY(0%)", EASE_OUT); });
  exit(X, G);
};

/* letras con ondas "((( )))" alrededor que se juntan */
B.ripple = (sc, X) => {
  const { W, H } = X, L = base(X), G = div(X.root, "lay"), s = W0(X);
  const fs = fit(s, "ki", 0.06, 0.52 * W, 0.18 * H);
  const main = tx(G, s, { cls: "ki", fs, x: W / 2, y: H / 2, color: col(X), ls: 0.06 });
  show(X, main.box, T0(X));
  for (let k = 1; k <= 4; k++) for (const side of [-1, 1]) {
    const o = tx(G, side < 0 ? "(" : ")", { cls: "ki", fs: fs * (1 - k * 0.1), x: W / 2 + side * (textW(s, "ki", 0.06, fs) / 2 + k * fs * 0.28), y: H / 2, color: col(X) });
    X.T(o.el, "opacity", "0").to(T0(X) + k * 0.05, 0.15, String(1 - k * 0.18)).to(X.dur * 0.6, 0.25, "0");
    X.T(o.el, "transform", `translateX(${side * k * 30}px)`).to(T0(X), 0.4, "translateX(0px)", EASE_OUT);
  }
  exit(X, G, "fade");
};

/* degradado de color fila por fila */
B.gradient = (sc, X) => {
  const L = base(X), G = div(X.root, "lay"), s = W0(X), n = 7, { rows: R } = rowsOf(X, G, s, n, { w: 0.46, color: i => GRAD[i % GRAD.length] });
  R.forEach((t, i) => { const at = T0(X) + i * 0.08; show(X, t.box, at); X.T(t.el, "transform", "scaleY(0.2)").to(at, 0.25, "scaleY(1)", EASE_OUT); });
  const th = X.dur * 0.55;
  R.forEach((t, i) => X.T(t.el, "color", GRAD[i % GRAD.length], true).set(th, GRAD[(i + 3) % GRAD.length]).set(th + 0.2, GRAD[(i + 5) % GRAD.length]));
  exit(X, G);
};

/* escala dinámica: filas con ancho que crece hacia el centro (rombo) */
B.dynamicScale = (sc, X) => {
  const L = base(X), G = div(X.root, "lay"), s = W0(X), n = 11, { rows: R } = rowsOf(X, G, s, n, { w: 0.58 });
  R.forEach((t, i) => { const d = Math.abs(i - mid(n)) / mid(n), sx = 1 - d * 0.7; show(X, t.box, T0(X) + d * 0.2); X.T(t.el, "transform", "scaleX(0.05)").to(T0(X) + d * 0.2, 0.4, `scaleX(${sx.toFixed(3)})`, EASE_OUT); });
  exit(X, G);
};

/* marcador: bloques de color que barren detrás de cada fila */
B.marker = (sc, X) => {
  const { W } = X, L = base(X), G = div(X.root, "lay"), s = W0(X), n = 6, { rows: R, fs, lh } = rowsOf(X, G, s, n, { w: 0.72, color: P.white });
  R.forEach((t, i) => {
    const at = T0(X) + i * 0.07, w = textW(s, "ki", 0, fs) * 1.04;
    const b = div(G, "patch", { left: W / 2 - w / 2 + "px", top: parseFloat(t.box.style.top) - lh * 0.5 + "px", width: w + "px", height: lh * 0.96 + "px", background: COL[sc.slot.color] || P.orange, transformOrigin: "0% 50%" });
    G.insertBefore(b, G.firstChild);
    X.T(b, "transform", "scaleX(0)").to(at, 0.25, "scaleX(1)", EASE_OUT);
    show(X, t.box, at + 0.12);
  });
  X.T(G, "transform", "scale(1)").to(X.dur * 0.5, 0.4, "scale(1.9)", EASE_IO);
  exit(X, G, "fade");
};

/* perspectiva: filas en 3D que se abren desde el horizonte */
B.perspective = (sc, X) => {
  const L = base(X), G = div(X.root, "lay", { perspective: "900px" }), s = W0(X), n = 7, { rows: R } = rowsOf(X, G, s, n, { w: 0.42 });
  R.forEach((t, i) => { const d = i - mid(n), at = T0(X) + Math.abs(d) * 0.05; X.T(t.el, "transform", `rotateX(${d * 30}deg) scale(0.4)`).to(at, 0.5, `rotateX(${d * 8}deg) scale(1)`, EASE_OUT); show(X, t.box, at); });
  X.T(G, "transform", "rotateY(0deg)").to(X.dur * 0.5, 0.5, "rotateY(-25deg)", EASE_IO);
  exit(X, G);
};

/* cortes: filas cortadas por la mitad que se desfasan y se juntan */
B.sliced = (sc, X) => {
  const L = base(X), G = div(X.root, "lay"), s = W0(X), n = 7, { rows: R } = rowsOf(X, G, s, n, { w: 0.44 });
  R.forEach((t, i) => {
    const at = T0(X) + i * 0.05, top = tx(G, s, { cls: "ki", fs: parseFloat(t.el.style.fontSize), x: X.W / 2, y: parseFloat(t.box.style.top), color: col(X) });
    t.el.style.clipPath = "inset(50% 0% 0% 0%)"; top.el.style.clipPath = "inset(0% 0% 50% 0%)";
    X.T(t.el, "transform", `translateX(${(i % 2 ? 1 : -1) * 20}%)`).to(at, 0.4, "translateX(0%)", EASE_OUT);
    X.T(top.el, "transform", `translateX(${(i % 2 ? -1 : 1) * 20}%)`).to(at, 0.4, "translateX(0%)", EASE_OUT);
    show(X, t.box, at); show(X, top.box, at);
  });
  exit(X, G);
};

/* empuje: filas que suben una tras otra (scroll) */
B.pushUp = (sc, X) => {
  const L = base(X), G = div(X.root, "lay"), s = W0(X), n = 7, { rows: R, lh } = rowsOf(X, G, s, n, { w: 0.46 });
  const g2 = div(G, "lay");
  R.forEach((t, i) => { g2.appendChild(t.box); show(X, t.box, T0(X) + i * 0.1); });
  X.T(g2, "transform", `translateY(${n * lh * 0.5}px)`).to(T0(X), X.dur * 0.8, "translateY(0px)", EASE_OUT);
  exit(X, G);
};

/* separación: la palabra se parte en fragmentos rotados y se recompone */
B.breakDown = (sc, X) => {
  const { W, H } = X, L = base(X), G = div(X.root, "lay"), s = W0(X), n = 5, { rows: R } = rowsOf(X, G, s, n, { w: 0.62, split: "chars" });
  R.forEach((t, i) => t.chars.forEach((c, k) => {
    const rr = (X.r() - 0.5) * 90, dx = (X.r() - 0.5) * 160, dy = (X.r() - 0.5) * 120;
    X.T(c, "transform", `translate(${dx}%, ${dy}%) rotate(${rr}deg)`).to(T0(X) + X.r() * 0.2, 0.45, "translate(0%, 0%) rotate(0deg)", EASE_OUT);
    show(X, c, T0(X));
  }));
  exit(X, G);
};

/* crecimiento: filas que crecen de tamaño hacia abajo */
B.growing = (sc, X) => {
  const { W, H } = X, L = base(X), G = div(X.root, "lay"), s = W0(X), n = 7;
  const fs0 = fit(s, "ki", 0, 0.46 * W, 1e9), lhs = []; let y = 0.06 * H;
  for (let i = 0; i < n; i++) {
    const f = fs0 * (0.35 + i * 0.11);
    const t = tx(G, s, { cls: "ki", fs: Math.min(f, 0.16 * H), x: W / 2, y: y + Math.min(f, 0.16 * H) * 0.46, color: col(X) });
    y += Math.min(f, 0.16 * H) * 0.92;
    const at = T0(X) + i * 0.07; show(X, t.box, at);
    X.T(t.el, "transform", "scaleY(0)").to(at, 0.25, "scaleY(1)", EASE_OUT);
  }
  X.T(G, "transform", "translateY(0px)").to(X.dur * 0.55, 0.45, `translateY(${-(y - H) * 0.5}px)`, EASE_IO);
  exit(X, G);
};

/* gran palabra en bloque de color: filas gigantes cortadas por el marco */
B.bigBlock = (sc, X) => {
  sc.slot.bg = "block";
  const { W, H } = X, L = base(X), G = div(X.root, "lay", { clipPath: `inset(${0.02 * H}px ${0.22 * W}px ${0.02 * H}px ${0.22 * W}px)` }), s = W0(X), n = 5;
  const fs = 0.25 * H, lh = fs * 0.9, y0 = H / 2 - (n - 1) * lh / 2;
  for (let i = 0; i < n; i++) {
    const t = tx(G, s, { cls: "ki", fs, x: W / 2, y: y0 + i * lh, color: P.white });
    const at = T0(X) + 0.1 + i * 0.05; show(X, t.box, at);
    X.T(t.el, "transform", `translateX(${(i % 2 ? 1 : -1) * 40}%)`).to(at, 0.4, `translateX(${(i % 2 ? -1 : 1) * 4}%)`, EASE_OUT);
  }
  X.T(G, "clipPath", `inset(${0.02 * H}px ${0.22 * W}px ${0.02 * H}px ${0.22 * W}px)`).to(X.dur * 0.55, 0.35, "inset(0px 0px 0px 0px)", EASE_IO);
  exit(X, G);
};

/* constructor: letras que faltan y se completan (se construye la palabra) */
B.constructor_ = (sc, X) => {
  const L = base(X), G = div(X.root, "lay"), s = W0(X), n = 7, { rows: R } = rowsOf(X, G, s, n, { w: 0.5, split: "chars" });
  R.forEach((t, i) => t.chars.forEach((c, k) => show(X, c, T0(X) + ((k * 7 + i * 3) % 10) * 0.05)));
  X.T(G, "transform", "scale(1)").to(X.dur * 0.55, 0.4, "scale(1.6)", EASE_IO);
  exit(X, G);
};

/* inclinada: bloque de filas en diagonal que se endereza */
B.starway = (sc, X) => {
  const L = base(X), G = div(X.root, "lay"), s = W0(X), n = 8, { rows: R } = rowsOf(X, G, s, n, { w: 0.34 });
  R.forEach((t, i) => { const at = T0(X) + i * 0.05; show(X, t.box, at); X.T(t.el, "transform", `translateX(${(i - mid(n)) * -18}%) skewX(-35deg)`).to(at, 0.5, "translateX(0%) skewX(0deg)", EASE_OUT); });
  exit(X, G);
};

/* ondulante: filas sobre una curva senoidal */
B.waving = (sc, X) => {
  const { W, H } = X, L = base(X), G = div(X.root, "lay"), s = W0(X), n = 7, { rows: R } = rowsOf(X, G, s, n, { w: 0.5, split: "chars" });
  R.forEach((t, i) => t.chars.forEach((c, k) => {
    const a = Math.sin(k * 0.45 + i * 0.6);
    X.T(c, "transform", `translateY(${a * 45}%) rotate(${a * -12}deg)`).to(0, X.dur, `translateY(${-a * 45}%) rotate(${a * 12}deg)`);
    show(X, c, T0(X) + i * 0.04);
  }));
  X.T(G, "transform", "rotate(-12deg)").to(0, X.dur, "rotate(-6deg)");
  exit(X, G, "slide");
};

/* compresión: filas apretadas que se estiran verticalmente */
B.squeeze = (sc, X) => {
  const L = base(X), G = div(X.root, "lay"), s = W0(X), n = 9, { rows: R } = rowsOf(X, G, s, n, { w: 0.5, lh: 0.6 });
  R.forEach((t, i) => { const d = Math.abs(i - mid(n)); show(X, t.box, T0(X) + d * 0.03); X.T(t.el, "transform", `scaleY(${0.3 + d * 0.05})`).to(T0(X), 0.6, `scaleY(${1.4 - d * 0.12})`, EASE_OUT); });
  exit(X, G);
};

/* atención: filas que parpadean desde la del medio */
B.blink = (sc, X) => {
  const L = base(X), G = div(X.root, "lay"), s = W0(X), n = 7, { rows: R } = rowsOf(X, G, s, n, { w: 0.44 });
  R.forEach((t, i) => { const d = Math.abs(i - mid(n)), at = T0(X) + d * 0.08; X.T(t.box, "visibility", "hidden", true).set(at, "visible").set(at + 0.06, "hidden").set(at + 0.12, "visible"); });
  exit(X, G);
};

/* vertical: letras en columna que se multiplican hacia los lados */
B.verticalWord = (sc, X) => {
  const { W, H } = X, L = base(X), G = div(X.root, "lay"), s = W0(X).replace(/ /g, "");
  const n = s.length, fs = Math.min(0.14 * H, 0.86 * H / n);
  for (let c = -4; c <= 4; c++) s.split("").forEach((ch, i) => {
    const o = tx(G, ch, { cls: "ki", fs, x: W / 2 + c * fs * 0.62, y: H / 2 + (i - mid(n)) * fs * 0.9, color: col(X) });
    const at = T0(X) + Math.abs(c) * 0.06 + i * 0.02;
    show(X, o.box, c === 0 ? T0(X) + i * 0.04 : at + 0.4);
    if (c) X.T(o.el, "transform", `scaleX(${1 - Math.abs(c) * 0.2})`).to(at + 0.4, 0.2, `scaleX(${1 - Math.abs(c) * 0.15})`);
  });
  exit(X, G);
};

/* máquina de escribir: filas que se escriben con cursor */
B.typing = (sc, X) => {
  const { W } = X, L = base(X), G = div(X.root, "lay"), s = W0(X), n = 8, { rows: R } = rowsOf(X, G, s, n, { w: 0.62, x: 0.2 * W, ax: 0, split: "chars" });
  R.forEach((t, i) => t.chars.forEach((c, k) => show(X, c, T0(X) + i * 0.08 + k * 0.035)));
  /* filas fantasma en contorno detrás */
  R.forEach(t => { const g = tx(G, s, { cls: "ki", fs: parseFloat(t.el.style.fontSize), x: 0.2 * W, y: parseFloat(t.box.style.top), ax: 0, color: "transparent", stroke: true }); g.el.style.webkitTextStroke = "1px rgba(230,230,230,0.25)"; G.insertBefore(g.box, G.firstChild); });
  exit(X, G);
};

/* aviso: texto chico de acento al centro (títulos de sección del pack) */
B.note = (sc, X) => {
  const { W, H, u } = X, L = base(X), G = div(X.root, "lay"), ls = X.lines;
  const fs = Math.min(0.05 * H, ...ls.map(l => fit(U(l.text), "ki", 0.02, 0.6 * W, 1e9)));
  ls.forEach((l, i) => { const t = tx(G, U(l.text), { cls: "ki", fs, x: W / 2, y: H / 2 + (i - mid(ls.length)) * fs * 1.2, color: P.orange, ls: 0.02, split: "chars" }); t.chars.forEach((c, k) => show(X, c, Math.max(0.02, l.rt) + k * 0.02)); });
  exit(X, G, "fade");
};
