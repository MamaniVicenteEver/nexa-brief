/* ====================== ESCENAS · promo-dynamic =========================
   Réplica del opener "Dynamic": fondo neón, letra negra extendida, palabra
   gigante en contorno que se desplaza detrás, letras negras enormes que
   barren la pantalla como transición ("flyer"), fotos recortadas con borde
   escalonado que entran con estela de copias y tira de pixel estirado, HUD
   de puntos / rayados / cuadritos / rótulos y logo final con foto en la letra.
   config.scenes[i] = { type, media, flyer, side, shape, rows }. */
const P = C.palette;
const BR = C.brand || {};

/* ---- HUD ---- */
function hudDecor(X, L) {
  const { W, H, u, r } = X;
  div(L, "lay", { backgroundImage: `radial-gradient(${P.ink} 0.9px, transparent 1.3px)`, backgroundSize: `${22 * u}px ${22 * u}px`, opacity: 0.22 });
  const hatch = (x, y, w, h, ang) => div(L, "patch", { left: x + "px", top: y + "px", width: w + "px", height: h + "px",
    backgroundImage: `repeating-linear-gradient(${ang}deg, ${P.ink} 0 ${1.4 * u}px, transparent ${1.4 * u}px ${7 * u}px)`, opacity: 0.8 });
  hatch(W * (0.02 + r() * 0.1), H * (0.03 + r() * 0.08), 70 * u, 14 * u, 60);
  hatch(W * (0.55 + r() * 0.3), H * (0.05 + r() * 0.06), 64 * u, 14 * u, 120);
  if (r() < 0.6) hatch(W * (0.05 + r() * 0.3), H * (0.84 + r() * 0.06), 58 * u, 14 * u, 70);
  for (let i = 0; i < 3; i++) div(L, "patch", { left: W * r() + "px", top: H * (0.05 + r() * 0.9) + "px", width: 7 * u + "px", height: 7 * u + "px", background: P.ink });
  const tiny = (s, x, y, rot = 0) => { const o = tx(L, s, { cls: "lb", fs: 8.5 * u, x, y, ax: 0, color: P.ink, rot }); o.el.style.lineHeight = "1.1"; return o; };
  tiny(String(Math.floor(r() * 9) + 1).padStart(2, "0"), W * 0.03, H * 0.93);
  tiny(`${String(Math.floor(r() * 28) + 1).padStart(2, "0")}      ${String(Math.floor(r() * 12) + 1).padStart(2, "0")}`, W * 0.62, H * 0.2);
  const ln = div(L, "patch", { left: W * 0.05 + "px", top: H * 0.935 + "px", width: 60 * u + "px", height: Math.max(1, u) + "px", background: P.ink });
  if (BR.vertical) tiny(BR.vertical, W * 0.975, H * 0.75, -90);
  return ln;
}
/* borde escalonado tipo pixel: polígono en px alrededor de w×h */
function jag(w, h, r, d) {
  const pts = [];
  const edge = (len, f) => { let p = 0; while (p < len) { const seg = 14 + r() * 38, o = r() < 0.45 ? 0 : d * (1 + Math.floor(r() * 2)); f(p, o); f(Math.min(len, p + seg), o); p += seg; } };
  edge(w, (x, o) => pts.push([x, o]));
  edge(h, (y, o) => pts.push([w - o, y]));
  edge(w, (x, o) => pts.push([w - x, h - o]));
  edge(h, (y, o) => pts.push([o, h - y]));
  return `polygon(${pts.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(", ")})`;
}
const still = asStill;
/* foto recortada con estela de copias al entrar (y al salir); dir = de dónde viene */
function cut(X, L, k, rect, o = {}) {
  const { r, u } = X;
  const spec = typeof k === "object" ? k : mediaSpec(X.sc, k);
  const clip = jag(rect.w, rect.h, r, 6 * u);
  const t0 = o.t0 ?? 0.05, d = o.d ?? 0.34, dir = o.dir || "up", n = o.echo ?? 5;
  const vec = { up: [0, 1], down: [0, -1], left: [1, 0], right: [-1, 0] }[dir];
  const gap = dir === "up" || dir === "down" ? rect.h * 0.22 : rect.w * 0.22;
  for (let i = n; i >= 1; i--) {
    const c = mbox(X, L, still(spec), { left: rect.x + vec[0] * gap * i + "px", top: rect.y + vec[1] * gap * i + "px", width: rect.w + "px", height: rect.h + "px", clipPath: clip, visibility: "hidden" });
    const vt = X.T(c.box, "visibility", "hidden", true).set(t0, "visible").set(t0 + d * (1 - i / (n + 1)), "hidden");
    if (o.out) vt.set(X.dur - 0.22 + i * 0.02, "visible");
  }
  const m = mbox(X, L, spec, { left: rect.x + "px", top: rect.y + "px", width: rect.w + "px", height: rect.h + "px", clipPath: clip }, { off: o.off });
  const tr = X.T(m.box, "transform", `translate(${vec[0] * gap * (n + 1)}px, ${vec[1] * gap * (n + 1)}px)`).to(t0, d, "translate(0px, 0px)", EASE_OUT);
  if (t0 > 0.001) X.T(m.box, "visibility", "hidden", true).set(t0, "visible");
  if (o.out) tr.to(X.dur - 0.22, 0.2, `translate(${-vec[0] * gap * 5}px, ${-vec[1] * gap * 5}px)`, EASE_IN);
  kenBurns(X, m, "scale(1.08)", "scale(1.15)");
  /* tira de pixel estirado pegada al borde de entrada */
  if (o.stretch !== false && spec) {
    const sw = rect.w * 0.45, sx = dir === "right" ? rect.x + rect.w : rect.x - sw;
    const s = mbox(X, L, still(spec), { left: sx + "px", top: rect.y + rect.h * 0.1 + "px", width: sw + "px", height: rect.h * 0.62 + "px", visibility: "hidden" });
    s.el.style.transformOrigin = dir === "right" ? "0% 50%" : "100% 50%";
    s.el.style.width = rect.w + "px"; s.el.style.left = dir === "right" ? "0px" : (sw - rect.w) + "px";
    s.el.style.transform = "scaleX(1)";
    X.T(s.el, "transform", "scaleX(18)").to(t0 + d * 0.5, 0.25, "scaleX(1)", EASE_OUT);
    X.T(s.box, "visibility", "hidden", true).set(t0 + d * 0.5, "visible").set(t0 + d * 0.5 + 0.26, "hidden");
  }
  return m;
}
/* letras negras enormes barriendo de derecha a izquierda (transición) */
function flyer(X, L, text, t0 = 0, d = 0.5, y = 0.5) {
  if (!text) return;
  const { W, H } = X, fs = 0.82 * H, w = textW(text, "ex", -0.02, fs);
  const o = tx(L, text, { cls: "ex", fs, x: W, y: y * H, ax: 0, color: P.ink, ls: -0.02 });
  X.T(o.el, "transform", "translateX(0px)").to(t0, d, `translateX(${-(W + w)}px)`, "cubic-bezier(.45,.05,.4,1)");
  blurPass(X.T(o.el, "filter", "none", true), t0, d, "x");
  X.T(o.box, "visibility", "hidden", true).set(t0, "visible").set(t0 + d, "hidden");
}
/* palabra gigante en contorno desplazándose detrás */
function bgWord(X, L, text, y = 0.5, speed = 0.18) {
  const { W, H, u } = X, fs = 0.58 * H;
  const o = tx(L, text, { cls: "ex", fs, x: 0, y: y * H, ax: 0, color: P.ink, stroke: true, sw: 0.003 });
  o.el.style.webkitTextStroke = `${Math.max(1, 1.3 * u)}px ${P.ink}`;
  const w = textW(text, "ex", 0, fs);
  X.T(o.el, "transform", `translateX(${0.15 * W}px)`).to(0, X.dur, `translateX(${0.15 * W - speed * W * X.dur}px)`);
  return w;
}
/* palabra sólida que aparece tecleada (orden aleatorio) y se estira al salir */
function mainWord(X, L, text, x, y, fs, o = {}) {
  const w = tx(L, text, { cls: "ex", fs, x, y, ax: o.ax ?? 0, color: o.color || P.ink, split: "chars", stroke: o.stroke, sw: 0.012 });
  if (o.stroke) w.el.style.webkitTextStroke = `${Math.max(1, 1.2 * X.u)}px ${P.ink}`;
  const t0 = o.t0 ?? 0.1, ord = w.chars.map((_, i) => i).sort(() => X.r() - 0.5);
  ord.forEach((ci, k) => { const t = t0 + k * 0.025; if (t > 0.001) X.T(w.chars[ci], "visibility", "hidden", true).set(t, "visible"); });
  if (o.stretch) {
    const te = X.dur - 0.28, pick = Math.floor(w.chars.length * 0.35);
    w.chars.forEach((ch, i) => {
      if (i === pick) { ch.style.transformOrigin = "0% 50%"; X.T(ch, "transform", "scaleX(1)").to(te, 0.2, "scaleX(9)", EASE_IN); }
      else if (i > pick) X.T(ch, "transform", "translateX(0px)").to(te, 0.2, `translateX(${fs * 5.4}px)`, EASE_IN);
    });
  }
  return w;
}
const L0 = X => (X.lines[0]?.text || X.sc.seg.text || "").toUpperCase();
const L1 = X => (X.lines[1]?.text || "").toUpperCase();
const rt0 = (X, i = 0) => Math.max(0.08, X.lines[i]?.rt ?? 0.15);
function base(X) { const L = div(X.root, "lay", { background: P.neon }); hudDecor(X, L); return L; }

const B = {};

B.word = (sc, X) => {
  const { W, H } = X, L = base(X), word = L0(X);
  bgWord(X, L, word, 0.5);
  const fs = fit(word, "ex", 0, 0.34 * W, 0.075 * H);
  mainWord(X, L, word, 0.5 * W, 0.5 * H, fs, { ax: 0.5, t0: rt0(X), stretch: sc.slot.stretch !== false && X.dur > 1 });
  flyer(X, L, sc.slot.flyer, sc.slot.flyerAt ?? 0, 0.45);
  const sub = sc.seg.sub;
  if (sub) tx(L, sub.toUpperCase(), { cls: "lb", fs: 8.5 * X.u, x: 0.76 * W, y: 0.78 * H, ax: 0, color: P.ink });
};

B.photo = (sc, X) => {
  const { W, H, u } = X, L = base(X), word = L0(X), sub = L1(X);
  const right = (sc.slot.side || (sc.idx % 2 ? "left" : "right")) === "right";
  const shape = sc.slot.shape || "portrait";
  const pw = shape === "square" ? 0.28 * W : shape === "landscape" ? 0.36 * W : 0.22 * W;
  const ph = shape === "square" ? 0.44 * H : shape === "landscape" ? 0.48 * H : 0.56 * H;
  bgWord(X, L, word, 0.52);
  const px = right ? 0.56 * W : 0.14 * W, py = 0.5 * H - ph / 2;
  cut(X, L, 0, { x: px, y: py, w: pw, h: ph }, { dir: right ? "right" : "left", out: true });
  const fs = fit(word, "ex", 0, 0.3 * W, 0.085 * H);
  const tx0 = right ? px - 0.03 * W : px + pw + 0.03 * W;
  mainWord(X, L, word, tx0, 0.47 * H, fs, { ax: right ? 1 : 0, t0: rt0(X), stretch: X.dur > 1.2 });
  if (sub) mainWord(X, L, sub, tx0, 0.47 * H + fs * 1.02, fs, { ax: right ? 1 : 0, t0: rt0(X, 1), stroke: true });
  if (BR.tag) tx(L, BR.tag.toUpperCase(), { cls: "lb", fs: 8.5 * u, x: right ? px + pw + 0.012 * W : px - 0.012 * W, y: py + ph * 0.93, ax: right ? 0 : 1, color: P.ink });
  flyer(X, L, sc.slot.flyer, sc.slot.flyerAt ?? 0.3, 0.5);
};

B.stack = (sc, X) => {
  const { W, H } = X, L = base(X), word = L0(X), n = sc.slot.rows || 4;
  const pw = 0.18 * W, ph = 0.52 * H, px = 0.6 * W, py = 0.26 * H;
  cut(X, L, 0, { x: px, y: py, w: pw, h: ph }, { dir: "right", echo: 6, d: 0.45 });
  const fs = fit(word, "ex", 0, 0.28 * W, 0.08 * H), lh = fs * 0.98;
  for (let i = 0; i < n; i++) {
    const solid = i === n - 2;
    mainWord(X, L, word, 0.56 * W, 0.5 * H + (i - (n - 1) / 2) * lh, fs, { ax: 1, t0: rt0(X) + i * 0.05, stroke: !solid });
  }
};

B.collage = (sc, X) => {
  const { W, H, u } = X, L = base(X), a = L0(X), b = L1(X);
  const rects = [
    { x: 0.04 * W, y: 0.05 * H, w: 0.22 * W, h: 0.3 * H, dir: "left" },
    { x: 0.3 * W, y: 0.02 * H, w: 0.2 * W, h: 0.64 * H, dir: "up" },
    { x: 0.6 * W, y: 0.55 * H, w: 0.2 * W, h: 0.34 * H, dir: "right" },
    { x: 0.2 * W, y: 0.62 * H, w: 0.12 * W, h: 0.2 * H, dir: "down" }
  ];
  rects.forEach((rc, i) => cut(X, L, i, rc, { dir: rc.dir, t0: 0.05 + i * 0.12, echo: 4, stretch: i === 1 }));
  bgWord(X, L, a, 0.6, 0.12);
  const fs = fit(a, "ex", 0, 0.24 * W, 0.08 * H);
  mainWord(X, L, a, 0.03 * W, 0.47 * H, fs, { t0: rt0(X) });
  if (b) mainWord(X, L, b, 0.56 * W, 0.22 * H, fit(b, "ex", 0, 0.28 * W, 0.09 * H), { t0: rt0(X, 1), stretch: X.dur > 2 });
  if (sc.seg.sub) {
    const s = tx(L, sc.seg.sub.toUpperCase(), { cls: "lb", fs: 8.5 * u, x: 0.03 * W, y: 0.55 * H, ax: 0, color: P.ink });
    s.el.style.whiteSpace = "pre"; s.el.style.lineHeight = "1.2";
  }
};

B.banner = (sc, X) => {
  const { W, H, u } = X, L = base(X), word = L0(X);
  bgWord(X, L, word, 0.2, 0.06);
  cut(X, L, 0, { x: 0.18 * W, y: 0.31 * H, w: 0.64 * W, h: 0.3 * H }, { dir: "up", t0: 0.05, out: true });
  const fs = fit(word, "ex", 0, 0.24 * W, 0.1 * H);
  mainWord(X, L, word, 0.64 * W, 0.2 * H, fs, { ax: 0.5, t0: rt0(X) });
  if (BR.tag) tx(L, BR.tag.toUpperCase(), { cls: "lb", fs: 8.5 * u, x: 0.8 * W, y: 0.66 * H, ax: 1, color: P.ink });
  flyer(X, L, sc.slot.flyer, sc.slot.flyerAt ?? 1.2, 0.55, 0.3);
};

B.duo = (sc, X) => {
  const { W, H } = X, L = base(X), word = L0(X);
  bgWord(X, L, word, 0.5, 0.1);
  cut(X, L, 0, { x: 0.42 * W, y: 0.02 * H, w: 0.52 * W, h: 0.3 * H }, { dir: "right" });
  cut(X, L, 1, { x: 0.02 * W, y: 0.6 * H, w: 0.55 * W, h: 0.33 * H }, { dir: "left", t0: 0.15 });
  const fs = fit(word, "ex", 0, 0.26 * W, 0.09 * H);
  mainWord(X, L, word, 0.5 * W, 0.47 * H, fs, { ax: 0.5, t0: rt0(X) });
  flyer(X, L, sc.slot.flyer, sc.slot.flyerAt ?? X.dur * 0.5, 0.5);
};

B.full = (sc, X) => {
  const { W, H } = X, L = base(X), word = L0(X);
  bgWord(X, L, word, 0.5, 0.2);
  const land = (sc.slot.shape || "portrait") === "landscape";
  const pw = land ? 0.62 * W : 0.34 * W, ph = land ? 0.9 * H : 0.96 * H;
  cut(X, L, 0, { x: (W - pw) / 2, y: (H - ph) / 2, w: pw, h: ph }, { dir: "up", d: 0.22, echo: 3, stretch: false });
  const fs = fit(word, "ex", 0, 0.3 * W, 0.1 * H);
  [-2, -1, 1, 2].forEach(k => mainWord(X, L, word, 0.5 * W, 0.5 * H + k * fs * 0.95, fs, { ax: 0.5, t0: rt0(X) + Math.abs(k) * 0.04, stroke: true, color: "#FFFFFF" }));
  mainWord(X, L, word, 0.5 * W, 0.5 * H, fs, { ax: 0.5, t0: rt0(X) });
};

B.logo = (sc, X) => {
  const { W, H, u } = X, L = base(X), word = L0(X), url = (L1(X) || BR.url || "").toUpperCase();
  const grp = div(L, "lay");
  bgWord(X, grp, word.replace(/ /g, ""), 0.28, 0.05);
  const gap = 0.1 * W, sp = word.indexOf(" ");
  const fs = fit(word, "ex", 0, W * 0.8 - (sp >= 0 ? gap : 0), 0.17 * H);
  const w = mainWord(X, grp, word, 0.5 * W, 0.44 * H, fs, { ax: 0.5, t0: rt0(X) });
  /* la foto va en el hueco entre palabras (o sobre la letra central si es una sola) */
  let cx;
  if (sp >= 0) {
    w.chars[sp].style.width = gap + "px";
    const full = textW(word, "ex", 0, fs) - textW(" ", "ex", 0, fs) + gap;
    cx = 0.5 * W - full / 2 + textW(word.slice(0, sp), "ex", 0, fs) + gap / 2;
  } else {
    const tw = textW(word, "ex", 0, fs), mid = Math.floor(word.length / 2);
    cx = 0.5 * W - tw / 2 + textW(word.slice(0, mid), "ex", 0, fs) + textW(word[mid] || "O", "ex", 0, fs) / 2;
  }
  cut(X, grp, 0, { x: cx - gap * 0.42, y: 0.44 * H - 0.13 * H, w: gap * 0.84, h: 0.26 * H }, { dir: "up", t0: rt0(X) + 0.2, echo: 3, stretch: false });
  const fu = fit(url, "ex", 0, 0.42 * W, 0.04 * H);
  const rows = [];
  for (let i = 0; i < 3; i++) rows.push(mainWord(X, L, url, 0.5 * W, 0.63 * H + i * fu * 1.05, fu, { ax: 0.5, t0: rt0(X, 1) + i * 0.08, stroke: i !== 1 }));
  /* al final queda solo la URL, centrada (las letras tienen visibility propia → se oculta con opacity) */
  const tf = Math.max(1.2, X.dur * 0.3);
  X.T(grp, "opacity", "1", true).set(tf, "0");
  rows.forEach((o, i) => {
    if (i !== 1) X.T(o.box, "opacity", "1", true).set(tf + 0.1, "0");
    else X.T(o.el, "transform", "translateY(0px)").to(tf, 0.3, `translateY(${0.5 * H - (0.63 * H + fu * 1.05)}px)`, EASE_IO);
  });
};
