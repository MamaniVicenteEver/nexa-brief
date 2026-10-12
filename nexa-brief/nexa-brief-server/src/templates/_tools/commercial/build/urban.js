/* ======================= ESCENAS · promo-urban ==========================
   Réplica del "Urban Opener": fondo negro con grano, metraje en duotono rojo
   y en B/N dentro de paneles, texto blanco condensado en escalera que se
   teclea, bloques naranjas que tapan / destapan la pantalla entre escenas,
   año gigante y "R" en contorno, rayados, flechas, corredor y rótulos chicos.
   Marcas en el guion ("lines"): "^PALABRA" = naranja, "~PALABRA" = contorno.
   config.scenes[i] = { type, media, trans: "blocks" | "cut" }. */
const P = C.palette;
const BR = C.brand || {};
const RED = "duoRed", BW = "bwCold";   /* keys de C.grades */

/* ---- piezas gráficas ---- */
const style = s => s.startsWith("^") ? { t: s.slice(1), color: P.orange } : s.startsWith("~") ? { t: s.slice(1), stroke: true } : { t: s };
function hatch(L, x, y, w, h, color, u) {
  return div(L, "patch", { left: x + "px", top: y + "px", width: w + "px", height: h + "px",
    backgroundImage: `repeating-linear-gradient(-55deg, ${color} 0 ${3.2 * u}px, transparent ${3.2 * u}px ${8 * u}px)` });
}
function svg(L, W, H, inner, css = "") {
  const s = doc.createElementNS(SVGNS, "svg");
  s.setAttribute("width", W); s.setAttribute("height", H); s.setAttribute("viewBox", `0 0 ${W} ${H}`);
  s.style.cssText = "position:absolute;left:0;top:0;overflow:visible;pointer-events:none;" + css;
  s.innerHTML = inner; L.appendChild(s); return s;
}
function arrow(L, x, y, s, color, dir = "se", u = 1) {
  const rot = { se: 0, sw: 90, nw: 180, ne: -90 }[dir];
  return svg(L, s, s, `<g transform="rotate(${rot} ${s / 2} ${s / 2})" fill="none" stroke="${color}" stroke-width="${Math.max(2, s * 0.09)}" stroke-linecap="square">
    <line x1="${s * 0.12}" y1="${s * 0.12}" x2="${s * 0.86}" y2="${s * 0.86}"/><polyline points="${s * 0.86},${s * 0.34} ${s * 0.86},${s * 0.86} ${s * 0.34},${s * 0.86}"/></g>`,
    `left:${x}px;top:${y}px`);
}
function runner(L, x, y, s, color, fill = true) {
  const st = fill ? `fill="${color}"` : `fill="none" stroke="${color}" stroke-width="${s * 0.02}"`;
  return svg(L, s, s, `<g ${st}><circle cx="${s * 0.62}" cy="${s * 0.12}" r="${s * 0.1}"/>
    <path d="M${s * 0.5} ${s * 0.25} L${s * 0.72} ${s * 0.3} L${s * 0.85} ${s * 0.46} L${s * 0.78} ${s * 0.5} L${s * 0.68} ${s * 0.4} L${s * 0.6} ${s * 0.56} L${s * 0.78} ${s * 0.72} L${s * 0.74} ${s * 0.96} L${s * 0.64} ${s * 0.94} L${s * 0.66} ${s * 0.77} L${s * 0.46} ${s * 0.64} L${s * 0.34} ${s * 0.8} L${s * 0.12} ${s * 0.78} L${s * 0.14} ${s * 0.7} L${s * 0.3} ${s * 0.7} L${s * 0.42} ${s * 0.46} L${s * 0.36} ${s * 0.4} L${s * 0.24} ${s * 0.52} L${s * 0.17} ${s * 0.47} L${s * 0.32} ${s * 0.3} Z"/></g>`,
    `left:${x}px;top:${y}px`);
}
function tinyText(L, s, x, y, u, color = "rgba(244,244,242,0.7)", ax = 0) {
  const o = tx(L, s, { cls: "sm", fs: 6.5 * u, x, y, ax, color }); o.el.style.whiteSpace = "pre"; o.el.style.lineHeight = "1.35"; return o;
}
function chrome(X, L) {
  const { W, H, u, r } = X;
  tinyText(L, BR.tagTop || "", 0.03 * W, 0.05 * H, u);
  tinyText(L, BR.tagRight || "", 0.94 * W, 0.05 * H, u, "rgba(244,244,242,0.7)", 1);
  const sq = tx(L, "■ ■ ■", { cls: "sm", fs: 7 * u, x: (0.7 + r() * 0.1) * W, y: 0.06 * H, color: P.orange }); sq.el.style.letterSpacing = "0.1em";
  div(L, "patch", { left: (0.08 + r() * 0.5) * W + "px", top: 0.03 * H + "px", width: 0.035 * W + "px", height: Math.max(2, 2 * u) + "px", background: P.orange });
  tinyText(L, `[${BR.year || "2026"}]`, 0.95 * W, 0.93 * H, u, P.orange, 1);
}
/* bloques naranjas que tapan al salir y destapan al entrar */
function blocks(X, L, mode) {
  const { W, H, r } = X, n = 9;
  for (let i = 0; i < n; i++) {
    const w = (0.08 + r() * 0.2) * W, h = (0.1 + r() * 0.26) * H;
    const b = div(L, "patch", { left: r() * (W - w) + "px", top: r() * (H - h) + "px", width: w + "px", height: h + "px", background: P.orange, visibility: "hidden" });
    if (mode === "in") X.T(b, "visibility", "visible", true).set(0.04 + r() * 0.2, "hidden");
    else { const t = X.dur - 0.22 + r() * 0.18; X.T(b, "visibility", "hidden", true).set(t, "visible"); }
  }
}
/* renglón tecleado letra a letra */
function typeLine(X, L, s, x, y, fs, o = {}) {
  const st = style(s);
  const w = tx(L, st.t, { cls: "ub", fs, x, y, ax: o.ax ?? 0, color: o.color || st.color || P.white, stroke: st.stroke, sw: 0.02, split: "chars" });
  if (st.stroke) w.el.style.webkitTextStroke = `${Math.max(1, fs * 0.018)}px ${P.white}`;
  const t0 = o.t0 ?? 0.1;
  w.chars.forEach((ch, i) => { const t = t0 + i * (o.step ?? 0.035); if (t > 0.001) X.T(ch, "visibility", "hidden", true).set(t, "visible"); });
  return { ...w, width: textW(st.t, "ub", -0.02, fs), st };
}
/* escalera: cada renglón corrido a la derecha */
function stair(X, L, x0, y0, maxW, maxH, o = {}) {
  const ls = X.lines;
  const fs = Math.min(...ls.map(l => fit(style(l.text).t, "ub", -0.02, maxW, maxH / ls.length / 0.95)));
  const step = o.step ?? fs * 1.1;
  return ls.map((l, i) => typeLine(X, L, l.text, x0 + i * step * (o.dir ?? 1), y0 + i * fs * 0.95, fs, { t0: Math.max(0.12, l.rt) + i * 0.05 }));
}
function panel(X, L, k, rect, filter, o = {}) {
  const m = mbox(X, L, k, { left: rect.x + "px", top: rect.y + "px", width: rect.w + "px", height: rect.h + "px" }, { filter, off: o.off });
  kenBurns(X, m, "scale(1.04)", `scale(1.12) translateX(${o.pan ?? -1}%)`);
  if (o.wipe) X.T(m.box, "clipPath", "inset(0% 100% 0% 0%)").to(o.wipe, 0.3, "inset(0% 0% 0% 0%)", EASE_OUT);
  return m;
}
function bigYear(X, L, x, y, h, a = 0.14) {
  const o = tx(L, BR.year || "2026", { cls: "ub", fs: h, x, y, ax: 0, color: `rgba(244,244,242,${a})`, stroke: true });
  o.el.style.webkitTextStroke = `${Math.max(1, 1.5 * X.u)}px rgba(244,244,242,${a + 0.1})`;
  return o;
}
function ringR(X, L, cx, cy, rad, a = 0.2) {
  div(L, "patch", { left: cx - rad + "px", top: cy - rad + "px", width: 2 * rad + "px", height: 2 * rad + "px", borderRadius: "50%", border: `${Math.max(2, 3 * X.u)}px solid rgba(244,244,242,${a})` });
  const o = tx(L, "R", { cls: "ub", fs: rad * 1.3, x: cx, y: cy, color: "transparent", stroke: true });
  o.el.style.webkitTextStroke = `${Math.max(2, 3 * X.u)}px rgba(244,244,242,${a})`;
}
function base(X, bg = P.black) {
  const L = div(X.root, "lay", { background: bg });
  const mode = X.sc.slot.trans ?? "blocks";
  return { L, done: () => { chrome(X, L); if (mode === "blocks") { if (X.sc.idx > 0) blocks(X, L, "in"); if (X.sc.idx < scenes.length - 1) blocks(X, L, "out"); } } };
}

const B = {};

B.title = (sc, X) => {
  const { W, H, u } = X, { L, done } = base(X);
  bigYear(X, L, 0.03 * W, 0.5 * H, 0.9 * H, 0.1);
  panel(X, L, 0, { x: 0.52 * W, y: 0.04 * H, w: 0.3 * W, h: 0.5 * H }, RED, { wipe: 0.6 });
  panel(X, L, 1, { x: 0.3 * W, y: 0.45 * H, w: 0.28 * W, h: 0.5 * H }, BW, { wipe: 0.75, off: 0.5 });
  ringR(X, L, 0.62 * W, 0.5 * H, 0.26 * H, 0.12);
  const [a, b] = X.lines;
  const fa = fit(style(a.text).t, "ub", -0.02, 0.5 * W, 0.2 * H), fb = fa * 0.42;
  const la = typeLine(X, L, a.text, 0.5 * W, 0.42 * H, fa, { ax: 0.5, t0: Math.max(0.1, a.rt), step: 0.06 });
  if (b) {
    const lb = typeLine(X, L, b.text, 0.5 * W + la.width * 0.08, 0.42 * H + fa * 0.62, fb, { t0: Math.max(0.3, b.rt) });
    arrow(L, 0.5 * W + la.width * 0.08 + lb.width + 8 * u, 0.42 * H + fa * 0.62 - fb * 0.45, fb * 0.9, P.orange, "sw");
  }
  hatch(L, 0.08 * W, 0.62 * H, 0.14 * W, 0.06 * H, P.white, u);
  tinyText(L, BR.blurb || "", 0.08 * W, 0.78 * H, u);
  done();
};

B.stair = (sc, X) => {
  const { W, H, u } = X, { L, done } = base(X);
  const full = sc.slot.full;
  if (full) panel(X, L, 0, { x: 0, y: 0, w: W, h: H }, BW);
  else {
    panel(X, L, 0, { x: 0.18 * W, y: 0.08 * H, w: 0.34 * W, h: 0.42 * H }, BW);
    panel(X, L, 1, { x: 0.3 * W, y: 0.45 * H, w: 0.62 * W, h: 0.5 * H }, RED, { off: 0.4 });
  }
  const ls = stair(X, L, full ? 0.06 * W : 0.34 * W, full ? 0.4 * H : 0.33 * H, 0.46 * W, 0.46 * H, { step: 0.05 * W });
  const last = ls[ls.length - 1];
  if (sc.slot.ring && ls[ls.length - 1]) {
    div(L, "patch", { left: (full ? 0.06 * W : 0.34 * W) + (ls.length - 1) * 0.05 * W - 0.02 * W + "px", top: (full ? 0.4 * H : 0.33 * H) + (ls.length - 1) * 0.1 * H - 0.02 * H + "px",
      width: 0.07 * H + "px", height: 0.07 * H + "px", borderRadius: "50%", border: `${3 * u}px solid ${P.orange}` });
  }
  arrow(L, 0.78 * W, 0.4 * H, 0.05 * H, P.orange, "se");
  hatch(L, 0.66 * W, 0.26 * H, 0.14 * W, 0.045 * H, P.white, u);
  runner(L, 0.06 * W, 0.84 * H, 0.05 * H, P.white);
  tinyText(L, BR.blurb || "", 0.1 * W, 0.86 * H, u);
  done();
};

B.full = (sc, X) => {
  const { W, H, u } = X, { L, done } = base(X);
  panel(X, L, 0, { x: 0, y: 0, w: W, h: H }, sc.slot.bw ? BW : RED);
  ringR(X, L, 0.2 * W, 0.5 * H, 0.34 * H, 0.14);
  const word = style(X.lines[0].text).t, fs = fit(word, "ub", -0.02, 0.44 * W, 0.2 * H);
  const lw = typeLine(X, L, X.lines[0].text, 0.5 * W, 0.47 * H, fs, { ax: 0.5, t0: Math.max(0.12, X.lines[0].rt), step: 0.05 });
  const reg = tx(L, "®", { cls: "ub", fs: fs * 0.45, x: 0.5 * W + lw.width / 2 + fs * 0.12, y: 0.47 * H - fs * 0.05, ax: 0, color: P.orange });
  X.T(reg.box, "visibility", "hidden", true).set(Math.max(0.3, X.lines[0].rt + 0.3), "visible");
  runner(L, 0.5 * W - lw.width / 2 - fs * 0.95, 0.47 * H - fs * 0.45, fs * 0.8, P.white);
  const sub = tinyText(L, BR.blurb || "", 0.5 * W - lw.width / 2 + fs * 0.1, 0.47 * H + fs * 0.55, u);
  div(L, "patch", { left: 0.5 * W - lw.width / 2 + fs * 0.1 + "px", top: 0.47 * H + fs * 0.95 + "px", width: 0.05 * W + "px", height: 2 * u + "px", background: P.orange });
  hatch(L, 0.72 * W, 0.72 * H, 0.08 * W, 0.04 * H, P.white, u);
  hatch(L, 0.3 * W, 0.8 * H, 0.06 * W, 0.03 * H, P.orange, u);
  done();
};

B.bottom = (sc, X) => {
  const { W, H, u } = X, { L, done } = base(X);
  panel(X, L, 0, { x: 0, y: 0.04 * H, w: W, h: 0.74 * H }, BW, { pan: -3 });
  bigYear(X, L, 0.02 * W, 0.14 * H, 0.3 * H, 0.15);
  const [a, b] = X.lines;
  const fb = fit(style((b || a).text).t, "ub", -0.02, 0.5 * W, 0.16 * H);
  if (b) typeLine(X, L, "~" + style(a.text).t, 0.04 * W, 0.86 * H, fb * 0.8, { t0: Math.max(0.12, a.rt) });
  const x2 = b ? 0.04 * W + textW(style(a.text).t + " ", "ub", -0.02, fb * 0.8) : 0.04 * W;
  typeLine(X, L, (b || a).text, x2, 0.85 * H, fb, { t0: Math.max(0.2, (b || a).rt) });
  runner(L, 0.9 * W, 0.84 * H, 0.05 * H, P.white);
  tinyText(L, "■ ■ ■", 0.8 * W, 0.87 * H, u, P.orange);
  done();
};

B.black3 = (sc, X) => {
  const { W, H, u } = X, { L, done } = base(X);
  ringR(X, L, 0.12 * W, 0.62 * H, 0.3 * H, 0.1);
  bigYear(X, L, 0.62 * W, 0.8 * H, 0.35 * H, 0.1);
  const ls = X.lines, fs = Math.min(...ls.map(l => fit(style(l.text).t, "ub", -0.02, 0.5 * W, 0.15 * H)));
  const y0 = 0.5 * H - (ls.length - 1) * fs * 0.48;
  ls.forEach((l, i) => typeLine(X, L, l.text, 0.5 * W + (i === 0 ? fs * 0.3 : i === ls.length - 1 ? fs * 0.9 : 0), y0 + i * fs * 0.95, fs, { ax: 0.5, t0: Math.max(0.12, l.rt) + i * 0.06 }));
  arrow(L, 0.5 * W - 0.26 * W, y0 - fs * 0.5, fs * 0.8, P.orange, "se");
  arrow(L, 0.72 * W, y0 + (ls.length - 1) * fs * 0.95 - fs * 0.2, fs * 0.55, P.orange, "se");
  hatch(L, 0.64 * W, y0 - fs * 0.35, 0.12 * W, 0.05 * H, P.white, u);
  tinyText(L, BR.blurb || "", 0.36 * W, 0.84 * H, u);
  done();
};

B.twoTone = (sc, X) => {
  const { W, H, u } = X, { L, done } = base(X);
  panel(X, L, 0, { x: 0, y: 0, w: W, h: H }, BW, { pan: 2 });
  const red = div(L, "patch", { left: 0.48 * W + "px", top: 0, width: 0.24 * W + "px", height: 0.55 * H + "px", background: P.red, opacity: 0.85 });
  X.T(red, "transform", `translateY(${-0.6 * H}px)`).to(0.3, 0.3, "translateY(0px)", EASE_OUT);
  bigYear(X, L, 0.04 * W, 0.2 * H, 0.3 * H, 0.14);
  const [a, b] = X.lines;
  const fa = fit(style(a.text).t, "ub", -0.02, 0.3 * W, 0.26 * H);
  div(L, "patch", { left: 0.02 * W + "px", top: 0.4 * H + "px", width: 0.1 * W + "px", height: 2 * u + "px", background: P.white });
  typeLine(X, L, a.text.startsWith("^") ? a.text : "^" + a.text, 0.14 * W, 0.4 * H, fa, { t0: Math.max(0.1, a.rt) });
  if (b) typeLine(X, L, b.text, 0.34 * W, 0.4 * H + fa * 0.9, fa, { t0: Math.max(0.25, b.rt) });
  const reg = tx(L, "®", { cls: "ub", fs: fa * 0.3, x: 0.34 * W + textW(style((b || a).text).t, "ub", -0.02, fa) + fa * 0.05, y: 0.4 * H + fa * 0.7, ax: 0, color: P.orange });
  hatch(L, 0.52 * W, 0.3 * H, 0.2 * W, 0.05 * H, P.orange, u);
  arrow(L, 0.1 * W, 0.62 * H, 0.06 * H, P.orange, "se");
  done();
};

B.ghost = (sc, X) => {
  const { W, H, u } = X, { L, done } = base(X);
  panel(X, L, 0, { x: 0.24 * W, y: 0.16 * H, w: 0.52 * W, h: 0.6 * H }, RED);
  const ls = X.lines, fs = Math.min(...ls.map(l => fit(style(l.text).t, "ub", -0.02, 0.4 * W, 0.14 * H)));
  ls.forEach((l, i) => {
    const g = tx(L, style(l.text).t, { cls: "ub", fs, x: 0.3 * W + i * fs * 1.2, y: 0.3 * H + i * fs * 0.9, ax: 0, color: "transparent", stroke: true });
    g.el.style.webkitTextStroke = `${Math.max(1, fs * 0.012)}px rgba(244,244,242,0.35)`;
    typeLine(X, L, l.text, 0.36 * W + i * fs * 1.2, 0.74 * H + i * fs * 0.9 - (ls.length - 1) * fs * 0.9, fs, { t0: Math.max(0.12, l.rt) + i * 0.06 });
    typeLine(X, L, l.text, 0.46 * W + i * fs * 1.2, 0.02 * H + i * fs * 0.9, fs * 0.8, { t0: 0.1 + i * 0.05 });
  });
  hatch(L, 0.72 * W, 0.46 * H, 0.1 * W, 0.04 * H, P.white, u);
  arrow(L, 0.62 * W, 0.62 * H, 0.04 * H, P.orange, "sw");
  done();
};

B.bigSmall = (sc, X) => {
  const { W, H, u } = X, { L, done } = base(X);
  panel(X, L, 0, { x: 0, y: 0, w: W, h: H }, RED, { pan: -2 });
  const [a, b] = X.lines;
  const fa = fit(style(a.text).t, "ub", -0.04, 0.36 * W, 0.4 * H);
  const big = tx(L, style(a.text).t, { cls: "ub", fs: fa, x: 0.42 * W, y: 0.52 * H, color: P.orange, ls: -0.04 });
  X.T(big.el, "transform", "translateY(60%)").to(0.1, 0.35, "translateY(0%)", EASE_OUT);
  X.T(big.box, "clipPath", "inset(0% 0% 0% 0%)");
  if (b) {
    const fb = fit(style(b.text).t, "ub", -0.02, 0.4 * W, 0.15 * H);
    const lb = typeLine(X, L, b.text, 0.34 * W, 0.52 * H, fb, { t0: Math.max(0.3, b.rt) });
    const reg = tx(L, "®", { cls: "ub", fs: fb * 0.4, x: 0.34 * W + lb.width + fb * 0.06, y: 0.52 * H - fb * 0.15, ax: 0, color: P.orange });
    runner(L, 0.34 * W + lb.width + fb * 0.1, 0.52 * H + fb * 0.05, fb * 0.4, P.white);
    tinyText(L, BR.blurb || "", 0.34 * W, 0.52 * H + fb * 0.62, u);
    hatch(L, 0.6 * W, 0.52 * H + fb * 0.6, 0.08 * W, 0.04 * H, P.white, u);
  }
  done();
};

B.big2 = (sc, X) => {
  const { W, H, u } = X, { L, done } = base(X);
  panel(X, L, 0, { x: 0.1 * W, y: 0.08 * H, w: 0.44 * W, h: 0.62 * H }, RED);
  panel(X, L, 1, { x: 0.5 * W, y: 0.3 * H, w: 0.46 * W, h: 0.64 * H }, BW, { off: 0.3 });
  ringR(X, L, 0.2 * W, 0.62 * H, 0.26 * H, 0.14);
  const [a, b] = X.lines;
  const fs = Math.min(fit(style(a.text).t, "ub", -0.02, 0.44 * W, 0.24 * H), b ? fit(style(b.text).t, "ub", -0.02, 0.5 * W, 0.24 * H) : 1e9);
  typeLine(X, L, a.text, 0.1 * W, 0.36 * H, fs, { t0: Math.max(0.1, a.rt), step: 0.05 });
  if (b) {
    const lb = typeLine(X, L, b.text, 0.2 * W, 0.36 * H + fs * 0.92, fs, { t0: Math.max(0.2, b.rt), step: 0.05 });
    hatch(L, 0.2 * W, 0.36 * H + fs * 0.6, lb.width * 0.5, fs * 0.28, P.orange, u);
    tx(L, "®", { cls: "ub", fs: fs * 0.25, x: 0.1 * W + textW(style(a.text).t, "ub", -0.02, fs) + fs * 0.08, y: 0.36 * H - fs * 0.25, ax: 0, color: P.orange });
  }
  arrow(L, 0.07 * W, 0.62 * H, 0.05 * H, P.orange, "se");
  tinyText(L, BR.blurb || "", 0.26 * W, 0.9 * H, u);
  done();
};

B.panel2 = (sc, X) => {
  const { W, H, u } = X, { L, done } = base(X);
  ringR(X, L, 0.9 * W, 0.62 * H, 0.26 * H, 0.1);
  panel(X, L, 0, { x: 0.03 * W, y: 0.08 * H, w: 0.58 * W, h: 0.74 * H }, RED);
  panel(X, L, 1, { x: 0.58 * W, y: 0.08 * H, w: 0.28 * W, h: 0.74 * H }, BW, { off: 0.2 });
  const [a, b] = X.lines;
  const fs = Math.min(fit(style(a.text).t, "ub", -0.02, 0.44 * W, 0.17 * H), b ? fit(style(b.text).t, "ub", -0.02, 0.5 * W, 0.17 * H) : 1e9);
  typeLine(X, L, a.text, 0.08 * W, 0.44 * H, fs, { t0: Math.max(0.1, a.rt) });
  if (b) {
    const lb = typeLine(X, L, b.text, 0.14 * W, 0.44 * H + fs * 0.92, fs, { t0: Math.max(0.2, b.rt) });
    hatch(L, 0.08 * W, 0.44 * H + fs * 1.1, 0.12 * W, fs * 0.3, P.orange, u);
  }
  div(L, "patch", { left: 0.34 * W + "px", top: 0.44 * H + "px", width: 0.06 * W + "px", height: 3 * u + "px", background: P.orange });
  arrow(L, 0.08 * W, 0.18 * H, 0.04 * H, P.orange, "se");
  arrow(L, 0.8 * W, 0.46 * H, 0.1 * H, "rgba(244,244,242,0.6)", "se");
  done();
};

B.logo = (sc, X) => {
  const { W, H, u } = X, { L, done } = base(X);
  ringR(X, L, 0.62 * W, 0.44 * H, 0.3 * H, 0.14);
  runner(L, 0.08 * W, 0.2 * H, 0.62 * H, "rgba(244,244,242,0.16)", false);
  const word = style(X.lines[0].text).t, fs = fit(word, "ub", -0.02, 0.36 * W, 0.12 * H);
  const lw = typeLine(X, L, X.lines[0].text, 0.5 * W, 0.6 * H, fs, { ax: 0.5, t0: Math.max(0.1, X.lines[0].rt), step: 0.05 });
  const mark = div(L, "patch", { left: 0.5 * W - 0.045 * H + "px", top: 0.34 * H + "px", width: 0.09 * H + "px", height: 0.12 * H + "px",
    background: P.white, borderRadius: "50% 50% 46% 54% / 60% 60% 40% 40%", transform: "rotate(-12deg)" });
  X.T(mark, "transform", "rotate(-12deg) scale(0)").to(0.2, 0.3, "rotate(-12deg) scale(1)", EASE_BACK);
  tx(L, "®", { cls: "ub", fs: fs * 0.3, x: 0.5 * W + 0.06 * H, y: 0.33 * H, ax: 0, color: P.orange });
  hatch(L, 0.5 * W + lw.width / 2 + 0.02 * W, 0.6 * H - fs * 0.25, 0.1 * W, fs * 0.45, P.orange, u);
  tinyText(L, "■ ■ ■", 0.04 * W, 0.63 * H, u, P.orange);
  div(L, "patch", { left: 0, top: 0.6 * H + "px", width: 0.12 * W + "px", height: 2 * u + "px", background: P.orange });
  if (X.lines[1]) typeLine(X, L, X.lines[1].text, 0.5 * W, 0.6 * H + fs * 0.9, fs * 0.28, { ax: 0.5, t0: Math.max(0.3, X.lines[1].rt), step: 0.02 });
  tinyText(L, BR.blurb || "", 0.52 * W, 0.84 * H, u);
  done();
};
