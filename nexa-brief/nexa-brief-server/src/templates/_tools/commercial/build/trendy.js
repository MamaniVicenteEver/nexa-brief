/* ======================= ESCENAS · promo-trendy ==========================
   Réplica del promo "Trendy": metraje en B/N cálido con duotono lima,
   itálica pesada, pantallas partidas, mosaico, tarjeta azul noche con
   círculo, letras gigantes, túnel de zoom radial y marcas × / + / puntos.
   Cada escena = un segmento del guion; config.scenes[i] = { type, media,
   repeat, in, out }. in/out: "zoom" (golpe de zoom con desenfoque) | "none". */
const P = C.palette;
const DUO = "duoLime", BW = "bwWarm";   /* keys de C.grades */

/* ---- decoración ---- */
function mark(X, parent, ch, x, y, s, color, t0 = 0) {
  const o = tx(parent, ch, { cls: "mk", fs: s * 1.7, x, y, color });
  if (t0 > 0.001) X.T(o.el, "transform", "scale(0) rotate(-90deg)").to(t0, 0.22, "scale(1) rotate(0deg)", EASE_BACK);
  return o;
}
function dots(parent, x, y, w, h, color, cell) {
  return div(parent, "patch", { left: x + "px", top: y + "px", width: w + "px", height: h + "px",
    backgroundImage: `radial-gradient(${color} 30%, transparent 34%)`, backgroundSize: `${cell}px ${cell}px`, opacity: 0.55 });
}
function ring(parent, cx, cy, r, color, bw = 1.5) {
  return div(parent, "patch", { left: cx - r + "px", top: cy - r + "px", width: 2 * r + "px", height: 2 * r + "px",
    borderRadius: "50%", border: `${bw}px solid ${color}` });
}
function svgShape(parent, W, H, inner) {
  const s = doc.createElementNS(SVGNS, "svg");
  s.setAttribute("width", W); s.setAttribute("height", H); s.setAttribute("viewBox", `0 0 ${W} ${H}`);
  s.style.cssText = "position:absolute;left:0;top:0;overflow:visible;pointer-events:none";
  s.innerHTML = inner; parent.appendChild(s); return s;
}
function leak(parent, where = "100% 65%", a = 0.42) {
  return div(parent, "lay", { background: `radial-gradient(ellipse at ${where}, rgba(226,86,58,${a}) 0%, rgba(226,86,58,0) 55%)` });
}
function vignette(parent) { return div(parent, "lay", { background: "radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(0,0,0,0.55) 100%)" }); }
/* media a pantalla completa, con Ken Burns suave */
function full(X, parent, k, filter, from = 1.06, to = 1.14, o = {}) {
  const m = mbox(X, parent, k, { left: 0, top: 0, width: X.W + "px", height: X.H + "px" }, { filter, off: o.off });
  kenBurns(X, m, `scale(${from}) translate(0%, 0%)`, `scale(${to}) translate(${o.pan ?? -1.5}%, 0%)`);
  return m;
}
/* la misma toma dentro de un rectángulo (duotono distinto sobre la misma imagen):
   caja del tamaño del rectángulo con la toma desplazada, no un video a pantalla completa recortado */
function region(X, parent, k, rect, filter, o = {}) {
  const box = div(parent, "mbox", { left: rect.x + "px", top: rect.y + "px", width: rect.w + "px", height: rect.h + "px" });
  const inner = div(box, "lay", { left: -rect.x + "px", top: -rect.y + "px", width: X.W + "px", height: X.H + "px", inset: "auto" });
  const m = full(X, inner, k, filter, o.from, o.to, o);
  return { box, m };
}
/* franjas diagonales que barren la pantalla (transición "streak") */
function streak(X, parent, t0, d = 0.32, angle = -32) {
  const g = div(parent, "lay", { overflow: "hidden" });
  const cols = [P.lime, P.paper, "#E7A2A0", P.lime];
  cols.forEach((c, i) => {
    const b = div(g, "patch", { left: -0.3 * X.W + "px", top: (0.18 + i * 0.16) * X.H + "px", width: 1.6 * X.W + "px",
      height: (0.06 + (i % 2) * 0.05) * X.H + "px", background: c, transform: `rotate(${angle}deg) translateX(${-1.6 * X.W}px)` });
    X.T(b, "transform", `rotate(${angle}deg) translateX(${-1.6 * X.W}px)`)
      .to(t0 + i * 0.03, d, `rotate(${angle}deg) translateX(${1.6 * X.W}px)`, EASE_IO);
  });
  return g;
}
/* rastro de zoom radial: copias escaladas y translúcidas de la toma */
function zoomTrail(X, parent, k, filter, t0, d, dir = 1) {
  [1.12, 1.28, 1.5].forEach((s, i) => {
    const box = div(parent, "lay", { opacity: "0" });
    /* foto fija (no otro <video>): el rastro dura 0.4 s y va desenfocado */
    const m = mbox(X, box, asStill(mediaSpec(X.sc, k)), { left: 0, top: 0, width: X.W + "px", height: X.H + "px" }, { filter });
    m.el.style.transform = `scale(${s})`;
    X.T(box, "opacity", "0").set(t0, String(0.42 - i * 0.1)).to(t0 + d * 0.6, d * 0.4, "0");
    X.T(m.el, "transform", `scale(${dir > 0 ? s : 1})`).to(t0, d, `scale(${dir > 0 ? 1 : s})`, EASE_OUT);
  });
}
/* texto itálico con entrada "glitch": salto lateral en seco + copia fantasma */
function glitchIn(X, o, t0) {
  X.T(o.el, "transform", "translateX(-9%) skewX(-12deg)").set(t0, "translateX(6%) skewX(8deg)").set(t0 + 0.05, "translateX(-3%) skewX(-4deg)")
    .set(t0 + 0.1, "translateX(0%) skewX(0deg)");
  if (t0 > 0.001) X.T(o.box, "visibility", "hidden", true).set(t0, "visible");
}
/* golpe de zoom con desenfoque al entrar / salir de la escena */
function punches(X, layer) {
  const s = X.sc.slot, tr = X.T(layer, "transform", "scale(1)"), fl = X.T(layer, "filter", "none", true);
  if ((s.in ?? "zoom") === "zoom" && X.sc.idx > 0) {
    tr.set(0, "scale(1.28)").to(0, 0.24, "scale(1)", EASE_OUT);
    blurPass(fl, 0, 0.22, "y");
  }
  const tail = Math.min(0.24, X.dur * 0.2);
  if ((s.out ?? "zoom") === "zoom" && X.sc.idx < scenes.length - 1) {
    tr.to(X.dur - tail, tail, "scale(1.3)", EASE_IN);
    blurPass(fl, X.dur - tail, tail, "y", true);
  }
}
const word0 = X => (X.lines[0]?.text || X.sc.seg.text || "").toUpperCase();

const B = {};

B.title = (sc, X) => {
  const { W, H, u, root } = X, L = div(root, "lay");
  full(X, L, 0, BW);
  const lime = region(X, L, 0, { x: 0, y: 0, w: 0.34 * W, h: H }, DUO);
  X.T(lime.box, "clipPath", `inset(0px ${0.34 * W}px 0px 0px)`).to(0, 0.4, "inset(0px 0px 0px 0px)", EASE_OUT);
  leak(L); vignette(L);
  svgShape(L, W, H, `<g fill="none" stroke="${P.paper}" stroke-width="${1.4 * u}" opacity=".75">
      <polyline points="${0.05 * W},${0.9 * H} ${0.2 * W},${0.25 * H} ${0.36 * W},${0.9 * H}"/>
      <line x1="${0.12 * W}" y1="${0.18 * H}" x2="${0.34 * W}" y2="${0.72 * H}" stroke="${P.lime}"/>
      <line x1="${0.36 * W}" y1="${0.3 * H}" x2="${0.78 * W}" y2="${0.3 * H}" opacity=".5"/>
      <line x1="${0.52 * W}" y1="${0.66 * H}" x2="${0.95 * W}" y2="${0.66 * H}"/></g>`);
  const [l1, l2] = [X.lines[0] || { text: "" }, X.lines[1] || { text: "" }];
  const fs = Math.min(fit(l1.text.toUpperCase(), "mi", 0, 0.36 * W, 0.13 * H), fit(l2.text.toUpperCase(), "mi", 0, 0.36 * W, 0.13 * H));
  const a = tx(L, l1.text.toUpperCase(), { cls: "mi", fs, x: 0.66 * W, y: 0.44 * H, color: P.paper });
  const b = tx(L, l2.text.toUpperCase(), { cls: "mi", fs, x: 0.7 * W, y: 0.44 * H + fs * 0.9, color: P.lime });
  glitchIn(X, a, Math.max(0.12, l1.rt)); glitchIn(X, b, Math.max(0.2, l2.rt));
  [["×", 0.64], ["+", 0.68], ["×", 0.72]].forEach(([c, fx], i) => mark(X, L, c, fx * W, 0.19 * H, 22 * u, i === 1 ? P.lime : P.paper, 0.3 + i * 0.05));
  [["+", 0.76], ["+", 0.8], ["+", 0.84]].forEach(([c, fx], i) => mark(X, L, c, fx * W, 0.84 * H, 20 * u, i === 1 ? P.lime : P.paper, 0.45 + i * 0.05));
  const bar = div(L, "patch", { left: 0.33 * W + "px", top: 0.93 * H + "px", width: 0.26 * W + "px", height: 0.028 * H + "px", background: P.lime, transformOrigin: "left" });
  X.T(bar, "transform", "scaleX(0)").to(0.35, 0.3, "scaleX(1)", EASE_OUT);
  dots(L, 0.88 * W, 0.8 * H, 0.08 * W, 0.08 * H, P.paper, 7 * u);
  punches(X, L);
};

B.stack = (sc, X) => {
  const { W, H, u, root } = X, L = div(root, "lay");
  full(X, L, 0, BW, 1.08, 1.12, { pan: 2 });
  leak(L, "100% 30%", 0.35); vignette(L);
  const blk = div(L, "patch", { left: 0.12 * W + "px", top: 0.28 * H + "px", width: 0.3 * W + "px", height: 0.3 * H + "px", background: P.lime });
  const word = word0(X), n = sc.slot.repeat || 5;
  const fs = fit(word, "mi", 0, 0.36 * W, 0.155 * H), lh = fs * 0.92;
  const t0 = Math.max(0.2, X.lines[0]?.rt ?? 0.3);
  X.T(blk, "transform", "translateX(0px) scaleX(1)").to(t0 - 0.1, 0.35, `translateX(${0.55 * W}px) scaleX(1.8)`, EASE_IO);
  X.T(blk, "clipPath", "inset(0% 0% 0% 0%)").to(t0 - 0.1, 0.35, "inset(12% 0% 18% 0%)", EASE_IO);
  for (let i = 0; i < n; i++) {
    const o = tx(L, word, { cls: "mi", fs, x: 0.12 * W, y: 0.13 * H + i * lh, ax: 0, ay: 0, color: P.paper });
    const t = t0 + (i < 2 ? i * 0.08 : 0.2 + (i - 1) * 0.22);
    X.T(o.box, "visibility", "hidden", true).set(t, "visible");
    X.T(o.el, "transform", "translateX(-14%)").to(t, 0.18, "translateX(0%)", EASE_OUT);
  }
  dots(L, 0.82 * W, 0.66 * H, 0.1 * W, 0.12 * H, P.paper, 7 * u);
  /* rasgado a mitad de escena (franjas blancas/rojas con desenfoque) */
  const tg = X.dur * 0.34;
  if (X.dur > 1.8) {
    const g = div(L, "lay", { visibility: "hidden" });
    [[0.18, "#F2EFE6", 0.2], [0.34, "#D8322A", 0.05], [0.44, "#F2EFE6", 0.16], [0.7, "#F2EFE6", 0.08]].forEach(([y, c, h]) =>
      div(g, "patch", { left: 0, top: y * H + "px", width: W + "px", height: h * H + "px", background: c, filter: "url(#mbx3)" }));
    X.T(g, "visibility", "hidden", true).set(tg, "visible").set(tg + 0.14, "hidden");
  }
  punches(X, L);
};

B.split = (sc, X) => {
  const { W, H, u, root } = X, L = div(root, "lay", { background: P.navy });
  const left = mbox(X, L, 0, { left: 0, top: 0, width: 0.5 * W + "px", height: H + "px" }, { filter: DUO });
  const right = mbox(X, L, 1, { left: 0.5 * W + "px", top: 0, width: 0.5 * W + "px", height: H + "px" }, { filter: BW, off: 0.4 });
  X.T(left.box, "transform", `translateY(${-H}px)`).to(0, 0.3, "translateY(0px)", EASE_OUT);
  X.T(right.box, "transform", `translateY(${H}px)`).to(0.05, 0.3, "translateY(0px)", EASE_OUT);
  for (const m of [left, right]) kenBurns(X, m, "scale(1.05)", "scale(1.12)");
  leak(L, "100% 20%", 0.3);
  const word = word0(X), t0 = Math.max(0.3, X.lines[0]?.rt ?? 0.4);
  const band = div(L, "patch", { left: 0.5 * W + "px", top: 0.6 * H + "px", width: 0.5 * W + "px", height: 0.2 * H + "px", background: P.lime, transformOrigin: "right" });
  X.T(band, "transform", "scaleX(0)").to(t0 - 0.1, 0.25, "scaleX(1)", EASE_OUT);
  const fs = fit(word, "mi", 0, 0.34 * W, 0.12 * H);
  const o = tx(L, word, { cls: "mi", fs, x: 0.78 * W, y: 0.7 * H, color: P.ink });
  X.T(o.el, "transform", "translateY(90%)").to(t0, 0.22, "translateY(0%)", EASE_OUT);
  X.T(o.box, "clipPath", "inset(0% 0% 0% 0%)");
  /* fase 2: la banda crece al centro con la palabra grande */
  const t2 = X.dur * 0.62;
  if (X.dur > 1.4) {
    X.T(band, "clipPath", "inset(0px 0px 0px 0px)");
    const big = div(L, "patch", { left: 0.06 * W + "px", top: 0.3 * H + "px", width: 0.88 * W + "px", height: 0.3 * H + "px", background: P.lime, visibility: "hidden" });
    X.T(big, "visibility", "hidden", true).set(t2, "visible");
    X.T(big, "transform", "scale(0.4, 0.6)").to(t2, 0.22, "scale(1, 1)", EASE_OUT);
    const g = tx(L, word, { cls: "mi", fs: fs * 1.7, x: 0.5 * W, y: 0.45 * H, color: P.ink });
    X.T(g.box, "visibility", "hidden", true).set(t2 + 0.05, "visible");
    X.T(g.el, "transform", "scale(0.6)").to(t2 + 0.05, 0.2, "scale(1)", EASE_OUT);
    mark(X, L, "×", 0.9 * W, 0.34 * H, 22 * u, P.paper, t2 + 0.1);
  }
  mark(X, L, "×", 0.07 * W, 0.12 * H, 20 * u, P.paper, 0.2);
  mark(X, L, "+", 0.53 * W, 0.12 * H, 20 * u, P.paper, 0.25);
  if ((sc.slot.out ?? "zoom") === "zoom") punches(X, L);
};

B.grid = (sc, X) => {
  const { W, H, u, root } = X, L = div(root, "lay", { background: P.navy });
  const g = div(L, "grp", { left: W / 2 + "px", top: H / 2 + "px" });
  const cols = 5, rows = 5, tw = W / 3.1, th = H / 2.35, word = word0(X);
  const fs = fit(word, "mi", 0, tw * 0.42, th * 0.12);
  let k = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = (c - (cols - 1) / 2) * tw - tw / 2, y = (r - (rows - 1) / 2) * th - th / 2;
    const spec = mediaSpec(sc, k++ % Math.max(1, (sc.slot.media || [1, 2, 3, 4]).length));
    const img = asStill(spec);
    const tile = div(g, "patch", { left: x + "px", top: y + "px", width: tw + "px", height: th + "px", overflow: "hidden" });
    mbox(X, tile, img, { left: 0, top: 0, width: "100%", height: "100%" }, { filter: (r + c) % 2 ? BW : DUO });
    const band = div(tile, "patch", { left: (c % 2 ? 0.48 : 0.05) * tw + "px", top: 0.66 * th + "px", width: 0.47 * tw + "px", height: 0.16 * th + "px", background: P.lime });
    tx(band, word, { cls: "mi", fs, x: 0.235 * tw, y: 0.08 * th, color: P.ink });
    tx(tile, "×", { cls: "mk", fs: 14 * u, x: 0.9 * tw, y: 0.12 * th, color: P.paper });
  }
  X.T(g, "transform", "scale(2.05)").to(0, X.dur, "scale(0.92)", "cubic-bezier(.3,.1,.3,1)");
  leak(L, "0% 100%", 0.25);
};

B.circle = (sc, X) => {
  const { W, H, u, root } = X, L = div(root, "lay", { background: `radial-gradient(ellipse at 50% 45%, ${P.navy2} 0%, ${P.navy} 70%)` });
  leak(L, "10% 100%", 0.25);
  const R = 0.3 * H, rg = ring(L, W / 2, H / 2, R, "rgba(242,239,230,0.55)", 1.4 * u);
  X.T(rg, "transform", "scale(0.12)").to(0, 0.35, "scale(1)", EASE_OUT).to(0.35, X.dur, "scale(1.08)");
  const word = word0(X), n = sc.slot.repeat || 3;
  const fs = fit(word, "mi", 0, 0.38 * W, 0.12 * H), lh = fs * 0.95;
  const grp = div(L, "lay");
  for (let i = 0; i < n; i++) {
    const o = tx(grp, word, { cls: "mi", fs, x: W / 2, y: H / 2 + (i - (n - 1) / 2) * lh, color: i % 2 ? P.paper : P.lime });
    const t = Math.max(0.12, X.lines[0]?.rt ?? 0.15) + i * 0.06;
    X.T(o.el, "transform", "scale(0)").to(t, 0.22, "scale(1)", EASE_BACK);
  }
  X.T(grp, "transform", "scale(1)").to(0.4, X.dur, "scale(1.06)");
  mark(X, L, "+", 0.1 * W, 0.84 * H, 46 * u, P.paper, 0.3);
  mark(X, L, "×", 0.86 * W, 0.12 * H, 18 * u, P.paper, 0.35);
  dots(L, 0.06 * W, 0.08 * H, 0.08 * W, 0.08 * H, P.paper, 6 * u);
  dots(L, 0.86 * W, 0.8 * H, 0.08 * W, 0.1 * H, P.paper, 6 * u);
  if (X.dur > 1.6) streak(X, L, X.dur * 0.42);
  punches(X, L);
};

B.maskword = (sc, X) => {
  const { W, H, u, root } = X, L = div(root, "lay");
  full(X, L, 0, DUO, 1.1, 1.2, { pan: 3 });
  const word = word0(X), fs = 1.25 * H;
  const w = textW(word, "mi", 0, fs);
  const big = tx(L, word, { cls: "mi", fs, x: 0, y: 0.5 * H, ax: 0, color: P.paper, canvas: true });
  X.T(big.el, "transform", `translateX(${0.55 * W}px)`).to(0, X.dur, `translateX(${-w + 0.2 * W}px)`, "cubic-bezier(.35,.1,.45,1)");
  const cw = 0.52 * W, ch = 0.4 * H;
  const card = mbox(X, L, 1, { left: (W - cw) / 2 + "px", top: (H - ch) / 2 + "px", width: cw + "px", height: ch + "px",
    boxShadow: "0 20px 60px rgba(0,0,0,0.35)" }, { filter: BW, off: 0.3 });
  X.T(card.box, "transform", "translateY(40%) scale(0.35) rotate(-8deg)").to(0.1, 0.5, "translateY(0%) scale(1) rotate(-3deg)", EASE_OUT)
    .to(0.6, Math.max(0.3, X.dur - 0.6), "translateY(0%) scale(1.1) rotate(2deg)");
  dots(L, 0.78 * W, 0.72 * H, 0.08 * W, 0.1 * H, P.paper, 6 * u);
  punches(X, L);
};

B.spaced = (sc, X) => {
  const { W, H, u, root } = X, L = div(root, "lay");
  full(X, L, 0, BW, 1.04, 1.1);
  const lime = region(X, L, 0, { x: 0, y: 0, w: 0.38 * W, h: H }, DUO);
  leak(L); vignette(L);
  zoomTrail(X, L, 0, DUO, 0, 0.4, 1);
  const word = word0(X), n = sc.slot.repeat || 3;
  const fs = fit(word, "mi", 0.38, 0.5 * W, 0.12 * H), lh = fs * 0.98, t0 = Math.max(0.15, X.lines[0]?.rt ?? 0.2);
  for (let i = 0; i < n; i++) {
    const ghost = i % 2 === 1;
    const o = tx(L, word, { cls: "mi", fs, x: 0.22 * W, y: 0.5 * H + (i - (n - 1) / 2) * lh, ax: 0, color: ghost ? "rgba(242,239,230,0.55)" : P.paper, ls: 0.38, stroke: ghost, sw: 0.02 });
    slideIn(X, o.el, t0 + i * 0.07, 0.5 * W);
  }
  if (X.dur > 1.3) {
    const t = X.dur * 0.45, g = div(L, "lay", { visibility: "hidden" });
    [[0.2, P.paper, 0.1], [0.34, P.lime, 0.06], [0.48, "#E7A2A0", 0.05], [0.62, P.paper, 0.12]].forEach(([y, c, h], i) => {
      const b = div(g, "patch", { left: 0.3 * W + "px", top: y * H + "px", width: 0.7 * W + "px", height: h * H + "px", background: c, transformOrigin: "right" });
      X.T(b, "transform", "scaleX(0)").to(t + i * 0.02, 0.14, "scaleX(1)", EASE_OUT).to(t + 0.2, 0.12, "scaleX(0)", EASE_IN);
    });
    X.T(g, "visibility", "hidden", true).set(t, "visible").set(t + 0.34, "hidden");
  }
  const bar = div(L, "patch", { left: 0.05 * W + "px", top: 0.88 * H + "px", width: 0.16 * W + "px", height: 0.022 * H + "px", background: P.paper });
  X.T(bar, "transform", "scaleX(0)").to(t0, 0.3, "scaleX(1)", EASE_OUT); bar.style.transformOrigin = "left";
  mark(X, L, "×", 0.58 * W, 0.93 * H, 20 * u, P.lime, t0 + 0.2);
  mark(X, L, "×", 0.53 * W, 0.08 * H, 16 * u, P.paper, t0 + 0.25);
  punches(X, L);
};

B.tunnel = (sc, X) => {
  const { W, H, u, root } = X, L = div(root, "lay");
  full(X, L, 0, DUO, 1.0, 1.08);
  zoomTrail(X, L, 0, DUO, 0, 0.45, 1);
  leak(L, "100% 100%", 0.35); vignette(L);
  const word = word0(X), fs = fit(word, "mi", 0.04, 0.5 * W, 0.24 * H);
  const o = tx(L, word, { cls: "mi", fs, x: 0.5 * W, y: 0.46 * H, color: P.paper, stroke: true, sw: 0.018, ls: 0.04 });
  const t = X.dur * 0.35, d = Math.min(0.9, X.dur * 0.35);
  X.T(o.el, "transform", "scale(1) rotate(0deg)").to(t, d * 0.55, "scale(7) rotate(-6deg)", EASE_IN).set(t + d * 0.55, "scale(0.6) rotate(0deg)")
    .to(t + d * 0.6, d * 0.4, "scale(1) rotate(0deg)", EASE_OUT);
  X.T(o.el, "opacity", "0.85").to(t + d * 0.3, d * 0.25, "0").to(t + d * 0.6, d * 0.3, "0.85");
  zoomTrail(X, L, 0, DUO, t, d * 0.55, 1);
  mark(X, L, "+", 0.84 * W, 0.12 * H, 30 * u, P.paper, 0.3);
  ring(L, 0.08 * W, 0.95 * H, 0.2 * H, "rgba(242,239,230,0.35)", 1.2 * u);
  punches(X, L);
};

B.action = (sc, X) => {
  const { W, H, u, root } = X, L = div(root, "lay");
  full(X, L, 0, BW, 1.05, 1.1, { pan: -1 });
  const panel = mbox(X, L, 1, { left: 0.5 * W + "px", top: 0, width: 0.24 * W + "px", height: H + "px" }, { filter: DUO, off: 0.2 });
  X.T(panel.box, "transform", `translateY(${-H}px)`).to(0, 0.28, "translateY(0px)", EASE_OUT);
  leak(L, "100% 60%", 0.45); vignette(L);
  ring(L, 0.42 * W, 0.5 * H, 0.28 * H, "rgba(242,239,230,0.6)", 1.3 * u);
  svgShape(L, W, H, `<polyline points="${0.3 * W},${0.66 * H} ${0.38 * W},${0.52 * H} ${0.46 * W},${0.66 * H}" fill="none" stroke="${P.paper}" stroke-width="${1.6 * u}" opacity=".8"/>
    <line x1="${0.1 * W}" y1="${0.66 * H}" x2="${0.6 * W}" y2="${0.66 * H}" stroke="${P.paper}" stroke-width="${1.2 * u}" opacity=".6"/>`);
  const word = word0(X), fs = fit(word, "mi", 0, 0.42 * W, 0.16 * H), t0 = Math.max(0.2, X.lines[0]?.rt ?? 0.3);
  const o = tx(L, word, { cls: "mi", fs, x: 0.47 * W, y: 0.5 * H, color: P.paper });
  X.T(o.el, "transform", "scale(1.5)").to(t0, 0.25, "scale(1)", EASE_OUT);
  blurPass(X.T(o.el, "filter", "none", true), t0, 0.22, "x");
  X.T(o.box, "visibility", "hidden", true).set(t0, "visible");
  /* salida glitch: la palabra se duplica desplazada */
  const tg = X.dur - 0.32;
  const gh = tx(L, word, { cls: "mi", fs, x: 0.47 * W, y: 0.5 * H + fs * 0.32, color: P.paper });
  X.T(gh.box, "visibility", "hidden", true).set(tg, "visible");
  X.T(gh.el, "clipPath", "inset(0% 0% 50% 0%)");
  [["×", 0.2, 0.5], ["+", 0.92, 0.6], ["×", 0.9, 0.38]].forEach(([c, fx, fy], i) => mark(X, L, c, fx * W, fy * H, 20 * u, P.paper, 0.3 + i * 0.05));
  dots(L, 0.14 * W, 0.8 * H, 0.08 * W, 0.08 * H, P.paper, 6 * u);
  X.T(L, "transform", "translateX(0px)").set(tg, `translateX(${6 * u}px)`).set(tg + 0.06, `translateX(${-8 * u}px)`).set(tg + 0.12, "translateX(0px)");
};

B.end = (sc, X) => {
  const { W, H, u, root } = X, L = div(root, "lay", { background: P.navy });
  const glow = div(L, "lay", { background: `radial-gradient(ellipse at 15% 85%, rgba(226,86,58,0.55) 0%, rgba(120,40,60,0.25) 30%, transparent 60%)` });
  X.T(glow, "transform", "translate(0px, 0px) scale(1)").to(0, X.dur, `translate(${0.08 * W}px, ${-0.05 * H}px) scale(1.2)`);
  const R = 0.3 * H;
  const r1 = ring(L, W / 2, H / 2, R, "rgba(242,239,230,0.55)", 1.3 * u), r2 = ring(L, W / 2 + 0.02 * W, H / 2, R * 1.2, "rgba(242,239,230,0.25)", 1 * u);
  X.T(r1, "transform", "scale(0.2)").to(0, 0.4, "scale(1)", EASE_OUT);
  X.T(r2, "transform", "scale(0.2)").to(0.05, 0.45, "scale(1)", EASE_OUT);
  const ls = X.lines.length ? X.lines : [{ text: sc.seg.text, rt: 0.2 }];
  const fs = Math.min(...ls.map(l => fit(l.text.toUpperCase(), "mi", 0.06, 0.38 * W, 0.11 * H)));
  const grp = div(L, "lay");
  ls.forEach((l, i) => {
    const o = tx(grp, l.text.toUpperCase(), { cls: "mi", fs, x: W / 2, y: H / 2 + (i - (ls.length - 1) / 2) * fs * 0.98, color: P.lime, ls: 0.06 });
    slideIn(X, o.el, Math.max(0.15, l.rt) + i * 0.08, -0.4 * W);
  });
  const ln = div(L, "patch", { left: 0, top: 0.62 * H + "px", width: W + "px", height: Math.max(1, 1.5 * u) + "px", background: P.paper, transformOrigin: "left" });
  X.T(ln, "transform", "scaleX(0)").to(0.6, 0.3, "scaleX(1)", EASE_OUT).to(1.1, 0.25, "scaleX(0)", EASE_IN);
  if (X.dur > 1.8) streak(X, L, 1.0, 0.3, -24);
  if (X.dur > 2.6) X.T(grp, "transform", "scale(1)").to(1.9, 0.12, "scale(1.35)", EASE_OUT).to(2.02, 0.25, "scale(1)", EASE_OUT);
  mark(X, L, "+", 0.88 * W, 0.84 * H, 46 * u, P.paper, 0.4);
  mark(X, L, "×", 0.06 * W, 0.12 * H, 18 * u, P.paper, 0.45);
  dots(L, 0.87 * W, 0.06 * H, 0.08 * W, 0.08 * H, P.paper, 6 * u);
  dots(L, 0.02 * W, 0.84 * H, 0.08 * W, 0.1 * H, P.paper, 6 * u);
};

/* entrada lateral con desenfoque (para renglones) */
function slideIn(X, el, t, dx, d = 0.3) {
  X.T(el, "transform", `translateX(${dx}px)`).to(t, d, "translateX(0px)", EASE_OUT);
  blurPass(X.T(el, "filter", "none", true), t, d * 0.8, "x");
  if (t > 0.001) X.T(el, "visibility", "hidden", true).set(t, "visible");
}
