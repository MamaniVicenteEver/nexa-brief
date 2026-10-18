/* ======================= ESCENAS · promo-sports =========================
   Réplica del promo "Sports": metraje cinematográfico oscuro (verde azulado),
   acentos amarillos, itálica pesada espaciada, palabras gigantes en contorno
   detrás, letras con textura de piedra, marcos amarillos que hacen zoom,
   paneles que destellan en amarillo, letras que se barajan y polvo en pantalla.
   config.scenes[i] = { type, media }. */
const P = C.palette;
const BR = C.brand || {};
const YEL = "duoYel", CINE = "cine";   /* keys de C.grades */
const STONE = noiseTile(160, 120);

/* ---- piezas ---- */
function footage(X, L, k, o = {}) {
  const { W, H } = X;
  const m = mbox(X, L, k, { left: (o.x ?? 0) + "px", top: (o.y ?? 0) + "px", width: (o.w ?? W) + "px", height: (o.h ?? H) + "px" }, { filter: o.filter || CINE, off: o.off });
  kenBurns(X, m, `scale(${o.from ?? 1.06})`, `scale(${o.to ?? 1.13}) translateX(${o.pan ?? -1}%)`);
  if (!o.filter) div(m.box, "lay", { background: `linear-gradient(180deg, rgba(8,28,40,0.38), rgba(4,14,22,0.5))` });
  return m;
}
function dust(X, L, n = 14) {
  const { W, H, u, r } = X;
  for (let i = 0; i < n; i++) {
    const s = (1.2 + r() * 3.2) * u;
    div(L, "patch", { left: r() * W + "px", top: r() * H + "px", width: s + "px", height: s * (0.6 + r()) + "px", background: "rgba(0,0,0,0.75)", borderRadius: "50%" });
  }
  div(L, "lay", { background: "radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(0,0,0,0.6) 100%)" });
}
function outlineBig(X, L, word, o = {}) {
  const { W, H, u } = X, fs = o.fs ?? 1.05 * H;
  const t = tx(L, word, { cls: "sp", fs, x: o.x ?? 0, y: o.y ?? 0.5 * H, ax: 0, color: "transparent", stroke: true });
  t.el.style.webkitTextStroke = `${Math.max(1, 1.4 * u)}px ${o.color || "rgba(235,230,9,0.55)"}`;
  const w = textW(word, "sp", 0.02, fs);
  X.T(t.el, "transform", `translateX(${o.from ?? 0.1 * W}px)`).to(0, X.dur, `translateX(${o.to ?? 0.1 * W - (o.drift ?? 0.12) * W}px)`);
  return t;
}
function word(X, L, s, x, y, fs, o = {}) {
  return tx(L, s, { cls: "sp", fs, x, y, ax: o.ax ?? 0.5, color: o.color || P.white, ls: o.ls ?? 0.08, split: o.split, stroke: o.stroke, sw: 0.014 });
}
/* letras que se barajan antes de asentarse */
function scramble(X, w, t0, dur = 0.4) {
  const pool = "ABCDEFGHJKLMNOPRSTUVWXYZ0123456789#";
  w.chars.forEach((ch, i) => {
    const real = ch.textContent; if (real === " ") return;
    const n = 4, span = dur * (0.5 + X.r() * 0.5);
    X.T(ch, "visibility", "hidden", true).set(t0 + X.r() * 0.08, "visible");
    const tr = X.T(ch, "@textContent", pool[Math.floor(X.r() * pool.length)], true);
    for (let k = 1; k < n; k++) tr.set(t0 + span * k / n, pool[Math.floor(X.r() * pool.length)]);
    tr.set(t0 + span, real);
  });
}
function frameBox(X, L, rect, t0, o = {}) {
  const { u } = X, bw = o.bw ?? 0.032 * X.H;
  const f = div(L, "patch", { left: rect.x + "px", top: rect.y + "px", width: rect.w + "px", height: rect.h + "px", border: `${bw}px solid ${P.yellow}`, boxSizing: "border-box" });
  X.T(f, "transform", `scale(${o.from ?? 1.35})`).to(t0, o.d ?? 0.35, "scale(1)", EASE_OUT);
  if (t0 > 0.001) X.T(f, "visibility", "hidden", true).set(t0, "visible");
  return f;
}
const w0 = X => (X.lines[0]?.text || X.sc.seg.text || "").toUpperCase();
const rt = (X, i = 0) => Math.max(0.06, X.lines[i]?.rt ?? 0.1);
function base(X) { return div(X.root, "lay", { background: P.dark }); }

const B = {};

B.giant = (sc, X) => {
  const { W, H } = X, L = base(X), s = w0(X);
  footage(X, L, 0);
  const fs = 1.02 * H, g = tx(L, s, { cls: "sp", fs, x: 0, y: 0.52 * H, ax: 0, color: "#DEDBD3", ls: -0.02, canvas: true, texture: true });
  g.el.style.opacity = "0.9";
  const gw = textW(s, "sp", -0.02, fs);
  X.T(g.el, "transform", `translateX(${-0.05 * W}px)`).to(0, X.dur, `translateX(${-0.05 * W - Math.min(gw - W, 0.5 * W) * 0.4}px)`);
  const f2 = fit(s, "sp", 0.08, 0.28 * W, 0.1 * H);
  const m = word(X, L, s, 0.47 * W, 0.5 * H, f2, { color: P.yellow });
  X.T(m.box, "visibility", "hidden", true).set(rt(X), "visible");
  dust(X, L);
};

B.rows = (sc, X) => {
  const { W, H } = X, L = base(X), s = w0(X);
  footage(X, L, 0, { pan: 3 });
  const fs = fit(s, "sp", 0.02, 0.95 * W, 0.34 * H);
  [-1, 1].forEach(k => {
    const o = word(X, L, s, 0, 0.5 * H + k * fs * 0.92, fs, { ax: 0, ls: 0.02, stroke: true, color: "rgba(243,243,241,0.6)" });
    o.el.style.webkitTextStroke = `${Math.max(1, 1.3 * X.u)}px rgba(243,243,241,0.6)`;
    X.T(o.el, "transform", `translateX(${k * 0.08 * W}px)`).to(0, X.dur, `translateX(${-k * 0.08 * W}px)`);
  });
  const m = word(X, L, s, 0.02 * W, 0.5 * H, fs, { ax: 0, ls: 0.02 });
  X.T(m.el, "transform", `translateX(${0.3 * W}px)`).to(rt(X), 0.3, "translateX(0px)", EASE_OUT).to(rt(X) + 0.3, X.dur, `translateX(${-0.04 * W}px)`);
  blurPass(X.T(m.el, "filter", "none", true), rt(X), 0.25, "x");
  dust(X, L);
};

B.panels3 = (sc, X) => {
  const { W, H } = X, L = base(X);
  const ws = X.lines.length >= 3 ? X.lines.map(l => ({ text: l.text, rt: l.rt })) : sc.words;
  const pw = W / 3;
  for (let i = 0; i < 3; i++) {
    const x = i * pw, t = Math.max(0.1, ws[i]?.rt ?? 0.3 + i * 0.3);
    const box = div(L, "patch", { left: x + "px", top: 0, width: pw - 2 * X.u + "px", height: H + "px", overflow: "hidden" });
    footage(X, box, i % 2, { w: pw, off: i * 0.7 });
    const yel = mbox(X, box, asStill(mediaSpec(sc, i % 2)), { left: 0, top: 0, width: pw + "px", height: H + "px" }, { filter: YEL });
    const yv = X.T(yel.box, "visibility", "hidden", true);
    const solid = div(box, "lay", { background: P.yellow, visibility: "hidden" });
    X.T(solid, "visibility", "hidden", true).set(t, "visible").set(t + 0.2, "hidden");
    if (i !== 1) yv.set(t + 0.2, "visible");
    const txt = (ws[i]?.text || "").toUpperCase();
    const fs = fit(txt, "sp", 0.04, pw * 0.7, 0.1 * H);
    const o = word(X, box, txt, pw / 2, 0.5 * H, fs, { ls: 0.04, color: i === 1 ? P.white : P.ink });
    X.T(o.box, "visibility", "hidden", true).set(t, "visible");
  }
  dust(X, L, 10);
};

B.converge = (sc, X) => {
  const { W, H } = X, L = base(X), s = w0(X);
  footage(X, L, 0);
  const half = footage(X, L, 0, { filter: YEL, w: 0.34 * W });
  outlineBig(X, L, s, { fs: 0.62 * H, y: 0.45 * H, color: "rgba(243,243,241,0.25)" });
  const fs = fit(s, "sp", 0.12, 0.62 * W, 0.16 * H);
  const m = word(X, L, s, 0.5 * W, 0.5 * H, fs, { ls: 0.12 });
  X.T(m.el, "letterSpacing", "1.1em").to(rt(X), 0.6, "0.12em", EASE_OUT);
  blurPass(X.T(m.el, "filter", "none", true), rt(X), 0.45, "x");
  dust(X, L);
};

B.frame = (sc, X) => {
  const { W, H } = X, L = base(X), s = w0(X);
  const inner = { x: 0.1 * W, y: 0.12 * H, w: 0.8 * W, h: 0.76 * H };
  footage(X, L, 0, { ...inner, from: 1.25, to: 1.05 });
  const f = frameBox(X, L, { x: inner.x - 0.012 * W, y: inner.y - 0.02 * H, w: inner.w + 0.024 * W, h: inner.h + 0.04 * H }, 0, { from: 1.4, d: 0.5 });
  if (sc.slot.flash) {
    const y = div(L, "lay", { background: P.yellow, visibility: "hidden" });
    X.T(y, "visibility", "hidden", true).set(X.dur * 0.55, "visible");
    X.T(y, "clipPath", `inset(0px)`).set(X.dur * 0.55, `inset(0px)`).to(X.dur * 0.6, 0.2, `inset(${inner.y}px ${W - inner.x - inner.w}px ${H - inner.y - inner.h}px ${inner.x}px round 0px)`, EASE_OUT);
  }
  if (s) {
    const fs = fit(s, "sp", 0.08, 0.5 * W, 0.14 * H);
    const o = word(X, L, s, 0.5 * W, 0.5 * H, fs, { stroke: true, color: "rgba(243,243,241,0.4)" });
    o.el.style.webkitTextStroke = `${Math.max(1, 1.2 * X.u)}px rgba(243,243,241,0.35)`;
  }
  dust(X, L, 10);
};

B.stack3 = (sc, X) => {
  const { W, H } = X, L = base(X), s = w0(X);
  footage(X, L, 0, { pan: 2 });
  [0.12, 0.2].forEach(y => div(L, "patch", { left: 0.28 * W + "px", top: y * H + "px", width: 0.36 * W + "px", height: 0.012 * H + "px",
    background: "rgba(255,255,240,0.9)", boxShadow: "0 0 18px 6px rgba(255,255,230,0.5)", transform: `rotate(${y === 0.12 ? 0 : 8}deg)` }));
  const fs = fit(s, "sp", 0.06, 0.52 * W, 0.28 * H), lh = fs * 0.95;
  for (let i = 0; i < 3; i++) {
    const y = 0.5 * H + (i - 1) * lh;
    const ol = word(X, L, s, 0.5 * W, y, fs, { stroke: true, ls: 0.06 });
    ol.el.style.webkitTextStroke = `${Math.max(1, 1.2 * X.u)}px rgba(243,243,241,0.7)`;
    const sol = word(X, L, s, 0.5 * W, y, fs, { ls: 0.06 });
    const t = rt(X) + 0.45 + i * 0.35;
    X.T(sol.box, "visibility", "hidden", true).set(t, "visible");
    X.T(sol.el, "clipPath", "inset(0% 100% 0% 0%)").to(t, 0.18, "inset(0% 0% 0% 0%)", EASE_OUT);
  }
  dust(X, L);
};

B.outlineBg = (sc, X) => {
  const { W, H } = X, L = base(X), s = w0(X);
  footage(X, L, 0, { pan: -2 });
  if (sc.slot.glow) {
    const g = div(L, "lay", { background: `radial-gradient(circle at 78% 45%, rgba(235,230,9,0.75) 0%, rgba(235,230,9,0.25) 22%, transparent 45%)` });
    X.T(g, "opacity", "0").to(X.dur * 0.4, 0.4, "1", EASE_OUT);
  }
  outlineBig(X, L, s, { fs: 1.15 * H, y: 0.5 * H, from: -0.02 * W, drift: 0.2 });
  const fs = fit(s, "sp", 0.1, 0.5 * W, 0.15 * H);
  const m = word(X, L, s, 0.5 * W, 0.5 * H, fs, { ls: 0.1, split: "chars" });
  m.chars.forEach((ch, i) => { const t = rt(X) + X.r() * 0.2; X.T(ch, "visibility", "hidden", true).set(t, "visible"); });
  X.T(m.el, "transform", "scale(1.12)").to(rt(X), X.dur, "scale(1)", EASE_OUT);
  dust(X, L);
};

B.bars = (sc, X) => {
  const { W, H } = X, L = base(X), s = w0(X);
  footage(X, L, 0);
  const y = footage(X, L, 0, { filter: YEL });
  X.T(y.box, "visibility", "visible", true).set(0.35, "hidden");
  outlineBig(X, L, s, { fs: 0.7 * H, y: 0.2 * H, color: "rgba(243,243,241,0.3)" });
  [[0, "down"], [0.88, "up"]].forEach(([yy, d]) => {
    const b = div(L, "patch", { left: 0, top: yy * H + "px", width: W + "px", height: 0.12 * H + "px", background: P.yellow });
    X.T(b, "transform", `scaleY(0)`).to(0.3, 0.2, "scaleY(1)", EASE_OUT); b.style.transformOrigin = d === "down" ? "top" : "bottom";
  });
  const fs = fit(s, "sp", 0.12, 0.6 * W, 0.13 * H);
  const m = word(X, L, s, 0.5 * W, 0.5 * H, fs, { ls: 0.12 });
  X.T(m.box, "visibility", "hidden", true).set(rt(X), "visible");
  dust(X, L);
};

B.frameWord = (sc, X) => {
  const { W, H, u } = X, L = base(X), s = w0(X);
  const wide = !!sc.slot.wide;
  const inner = wide ? { x: 0.02 * W, y: 0.22 * H, w: 0.96 * W, h: 0.56 * H } : { x: 0.1 * W, y: 0.1 * H, w: 0.8 * W, h: 0.8 * H };
  if (wide) outlineBig(X, L, s, { fs: 0.9 * H, y: 0.5 * H, color: "rgba(235,230,9,0.45)" });
  footage(X, L, 0, { ...inner, from: 1.2, to: 1.05 });
  frameBox(X, L, { x: inner.x - 0.01 * W, y: inner.y - 0.02 * H, w: inner.w + 0.02 * W, h: inner.h + 0.04 * H }, 0, { from: 1.3, bw: 0.028 * H });
  if (!wide) div(L, "patch", { left: inner.x - 0.035 * W + "px", top: inner.y - 0.05 * H + "px", width: inner.w + 0.07 * W + "px", height: inner.h + 0.1 * H + "px", border: `${Math.max(1, 1.5 * u)}px solid ${P.yellow}` });
  const fs = fit(s, "sp", 0.06, 0.5 * W, 0.13 * H);
  const m = word(X, L, s, 0.5 * W, 0.5 * H, fs, { ls: 0.06, split: "chars" });
  scramble(X, m, rt(X), 0.45);
  dust(X, L);
};

B.scramble = (sc, X) => {
  const { W, H } = X, L = base(X), s = w0(X);
  footage(X, L, 0);
  outlineBig(X, L, s, { fs: 1.1 * H, y: 0.5 * H, color: "rgba(235,230,9,0.4)" });
  const fs = fit(s, "sp", 0.1, 0.56 * W, 0.15 * H);
  const m = word(X, L, s, 0.5 * W, 0.5 * H, fs, { ls: 0.1, split: "chars" });
  scramble(X, m, rt(X), 0.5);
  dust(X, L);
};

B.ticker = (sc, X) => {
  const { W, H } = X, L = base(X), s = w0(X);
  footage(X, L, 0, { x: 0.3 * W, y: 0.25 * H, w: 0.4 * W, h: 0.5 * H });
  const line = (s + "   ").repeat(6);
  const fs = 0.13 * H;
  [[0.1, 1], [0.24, -1], [0.78, 1], [0.92, -1]].forEach(([y, d]) => {
    const o = word(X, L, line, 0, y * H, fs, { ax: 0, ls: 0.02, color: P.yellow });
    X.T(o.el, "transform", `translateX(${d > 0 ? -0.2 * W : -0.8 * W}px)`).to(0, X.dur, `translateX(${d > 0 ? -0.8 * W : -0.2 * W}px)`);
  });
  dust(X, L, 8);
};

B.tags = (sc, X) => {
  const { W, H, u } = X, L = base(X), s = w0(X);
  const pw = 0.12 * W, ph = 0.34 * H, y = 0.33 * H;
  for (let i = 0; i < 3; i++) {
    const x = 0.31 * W + i * (pw + 0.01 * W), t = 0.05 + i * 0.25;
    const box = div(L, "patch", { left: x + "px", top: y + "px", width: pw + "px", height: ph + "px", overflow: "hidden", visibility: "hidden" });
    X.T(box, "visibility", "hidden", true).set(t, "visible");
    footage(X, box, i, { w: pw, h: ph, off: i * 0.5 });
    const fl = div(box, "lay", { background: P.yellow, visibility: "hidden" });
    X.T(fl, "visibility", "hidden", true).set(X.dur * 0.55, "visible").set(X.dur * 0.55 + 0.25, "hidden");
  }
  const fs = 0.045 * H;
  for (let i = 0; i < 4; i++) {
    const a = word(X, L, s, 0.31 * W, y - 0.02 * H + i * fs * 0.95 - 4 * fs * 0.95, fs, { ax: 0, ls: 0.04, color: i === 3 ? P.white : P.yellow });
    X.T(a.box, "visibility", "hidden", true).set(0.1 + i * 0.08, "visible");
    const b = word(X, L, s, 0.69 * W, y + ph + 0.02 * H + i * fs * 0.95, fs, { ax: 1, ls: 0.04, color: i === 0 ? P.white : P.yellow });
    X.T(b.box, "visibility", "hidden", true).set(0.3 + i * 0.08, "visible");
  }
};

B.face = (sc, X) => {
  const { W, H } = X, L = base(X), s = w0(X);
  const inner = { x: 0.31 * W, y: 0.3 * H, w: 0.38 * W, h: 0.34 * H };
  const y = footage(X, L, 0, { ...inner, filter: YEL });
  footage(X, L, 0, inner);
  X.T(y.box, "visibility", "visible", true).set(0.25, "hidden");
  const fs = fit(s, "sp", 0.04, 0.24 * W, 0.09 * H);
  const o = word(X, L, s, 0.5 * W, 0.47 * H, fs, { ls: 0.04 });
  X.T(o.el, "opacity", "1").to(0.4, 0.5, "0.25");
  dust(X, L, 8);
};

B.end = (sc, X) => {
  const { W, H } = X, L = base(X), s = w0(X);
  div(L, "lay", { background: "radial-gradient(ellipse at 50% 70%, rgba(40,44,50,0.55) 0%, rgba(0,0,0,0) 60%)" });
  const fs = fit(s, "sp", 0.06, 0.36 * W, 0.06 * H);
  const m = word(X, L, s, 0.5 * W, 0.5 * H, fs, { ls: 0.06, split: "chars" });
  m.chars.forEach(ch => {
    const t = rt(X) + X.r() * 0.6;
    X.T(ch, "opacity", "0", true).set(t, "0.35").set(t + 0.08, "0").set(t + 0.16, "1");
  });
  if (X.lines[1]) {
    const f2 = fs * 0.5, o = word(X, L, X.lines[1].text.toUpperCase(), 0.5 * W, 0.5 * H + fs * 1.1, f2, { ls: 0.2, color: P.yellow });
    X.T(o.box, "visibility", "hidden", true).set(Math.max(0.8, X.lines[1].rt), "visible");
  }
  dust(X, L, 6);
};
