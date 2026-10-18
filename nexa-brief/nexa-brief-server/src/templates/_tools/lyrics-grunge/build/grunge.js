/* ====================== ESCENAS · LYRICS-grunge-rojo ======================
   Réplica del lyric video grunge de rap: metraje en blanco y negro duro con
   niebla y bordes de papel rasgado, letra condensada gastada (máscara de
   desgaste) en blanco y rojo, fantasmas con desenfoque de movimiento, filas
   repetidas en grilla, palabras gigantes que se aplastan contra la cámara y
   garabatos de tiza blanca (círculo, subrayado, flechas, tachón, corona,
   rayo, cruces) que se dibujan solos. Barridos de "mancha" entre escenas.
   La letra viene de lyrics.json (Whisper); el mazo de escenas de config.layouts. */
const P = C.palette;
const U = s => String(s).toUpperCase();
const J = ws => ws.map(w => w.text).join(" ");
const show = (X, el, t) => { if (t > 0.001) X.T(el, "visibility", "hidden", true).set(t, "visible"); };
function rows(ws, n) {
  if (n <= 1 || ws.length <= 1) return [ws];
  const total = J(ws).length, out = [[]]; let acc = 0;
  for (const w of ws) {
    if (out[out.length - 1].length && acc >= total * out.length / n && out.length < n) out.push([]);
    out[out.length - 1].push(w); acc += w.text.length + 1;
  }
  return out.filter(r => r.length);
}

/* ---- máscara de desgaste para la letra (manchas y rayas transparentes) ---- */
const DISTRESS = (() => {
  const cv = doc.createElement("canvas"); cv.width = cv.height = 256;
  const cx = cv.getContext("2d");
  cx.fillStyle = "#000"; cx.fillRect(0, 0, 256, 256);
  cx.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 900; i++) { cx.fillStyle = `rgba(0,0,0,${0.4 + texRng() * 0.6})`; const s = 0.6 + texRng() * 2.2; cx.fillRect(texRng() * 256, texRng() * 256, s, s); }
  for (let i = 0; i < 14; i++) { cx.strokeStyle = `rgba(0,0,0,${0.3 + texRng() * 0.5})`; cx.lineWidth = 0.6 + texRng(); cx.beginPath(); const x = texRng() * 256, y = texRng() * 256; cx.moveTo(x, y); cx.lineTo(x + (texRng() - 0.5) * 90, y + (texRng() - 0.5) * 12); cx.stroke(); }
  return `url(${cv.toDataURL()})`;
})();
doc.documentElement.style.setProperty("--distress", DISTRESS);

/* ---------------- fondo: metraje B/N + niebla + papel rasgado ---------------- */
function jagged(w, h, amp, r, top) {
  const pts = [], n = Math.ceil(w / 14);
  for (let i = 0; i <= n; i++) pts.push([i / n * w, (top ? h : 0) + (top ? -1 : 1) * (amp * (0.3 + r() * 0.7))]);
  return top ? `polygon(0px 0px, ${w}px 0px, ${pts.reverse().map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(", ")})`
             : `polygon(${pts.map(([x, y]) => `${x.toFixed(1)}px ${(h - y).toFixed(1)}px`).join(", ")}, ${w}px ${h}px, 0px ${h}px)`;
}
function tornEdge(X, L, top, color, hf) {
  const { W, H, r } = X, h = hf * H;
  return div(L, "patch", { left: 0, top: (top ? 0 : H - h) + "px", width: W + "px", height: h + "px", background: color, clipPath: jagged(W, h, h * 0.35, r, top) });
}
function bgLayer(X) {
  const { W, H, r, sc } = X;
  const L = div(X.root, "lay", { background: P.black });
  const m = mbox(X, L, 0, { left: 0, top: 0, width: W + "px", height: H + "px" }, { filter: "bw", off: r() * 4 });
  kenBurns(X, m, "scale(1.04)", "scale(1.1)");
  /* niebla: dos manchas claras que derivan */
  for (let i = 0; i < 2; i++) {
    const f = div(L, "lay", { background: `radial-gradient(ellipse at ${20 + r() * 60}% ${20 + r() * 60}%, rgba(235,235,235,${0.28 + r() * 0.22}) 0%, transparent 45%)` });
    X.T(f, "transform", "translateX(0px)").to(0, X.dur, `translateX(${(r() - 0.5) * 0.2 * W}px)`);
  }
  div(L, "lay", { background: "radial-gradient(ellipse at 50% 50%, transparent 50%, rgba(0,0,0,0.6) 100%)" });
  const e = r();
  if (e < 0.35) tornEdge(X, L, true, r() < 0.5 ? P.white : P.black, 0.12 + r() * 0.08);
  else if (e < 0.7) tornEdge(X, L, false, r() < 0.5 ? P.white : P.black, 0.12 + r() * 0.08);
  return L;
}
/* barrido de "mancha" al entrar: barras estiradas con desenfoque, 0.14 s */
function smear(X, L) {
  if (X.sc.idx === 0 || X.r() < 0.35) return;
  const { W, H, r } = X, g = div(L, "lay", { visibility: "hidden" });
  for (let i = 0; i < 5; i++)
    div(g, "patch", { left: -0.1 * W + "px", top: r() * H + "px", width: 1.2 * W + "px", height: (0.03 + r() * 0.12) * H + "px",
      background: r() < 0.4 ? P.red : `rgba(240,240,240,${0.5 + r() * 0.4})`, filter: "url(#mbx3)" });
  X.T(g, "visibility", "visible", true).set(0.14, "hidden");
}

/* ---------------- texto ---------------- */
function word(X, L, s, o) {
  const t = tx(L, U(s), { cls: o.cls || "cd", fs: o.fs, x: o.x, y: o.y, ax: o.ax ?? 0.5, ay: o.ay ?? 0.5, color: o.color || P.white, ls: o.ls, split: o.split });
  if (o.distress !== false) t.el.classList.add("gr");
  return t;
}
/* línea con palabras en su tiempo */
function line(X, L, ws, o) {
  const t = word(X, L, J(ws), { ...o, split: "words" });
  t.words.forEach((s, i) => show(X, s, Math.max(0.02, ws[i]?.rt ?? 0)));
  return t;
}
/* golpe: entra grande y desenfocado, se asienta; fantasma detrás en rojo/blanco */
function slamIn(X, t, at, from = 1.35) {
  X.T(t.el, "transform", `scale(${from})`).to(at, 0.2, "scale(1)", EASE_OUT);
  blurPass(X.T(t.el, "filter", "none", true), at, 0.18, X.r() < 0.5 ? "x" : "y");
  show(X, t.box, at);
}
function ghost(X, L, s, o, at, color) {
  const g = word(X, L, s, { ...o, color, distress: false });
  g.el.style.opacity = "0.55"; g.el.style.filter = "url(#mbx2)";
  X.T(g.el, "transform", `translateX(${(X.r() < 0.5 ? -1 : 1) * 0.04 * X.W}px)`).to(at, X.dur, `translateX(${(X.r() - 0.5) * 0.02 * X.W}px)`);
  show(X, g.box, at);
  return g;
}

/* ---------------- garabatos de tiza (SVG que se dibuja) ---------------- */
function doodle(X, L, kind, b, t0, d = 0.35) {
  const { W, H, u, r } = X;
  const s = doc.createElementNS(SVGNS, "svg");
  s.setAttribute("width", W); s.setAttribute("height", H); s.setAttribute("viewBox", `0 0 ${W} ${H}`);
  s.style.cssText = "position:absolute;left:0;top:0;overflow:visible;pointer-events:none";
  const j = a => (r() - 0.5) * a;
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  let paths = [];
  if (kind === "circle") {
    const pts = []; for (let i = 0; i <= 40; i++) { const a = -0.4 + i / 40 * Math.PI * 2.15; pts.push([cx + Math.cos(a) * (b.w * 0.62 + j(8 * u)), cy + Math.sin(a) * (b.h * 0.85 + j(6 * u))]); }
    paths.push("M" + pts.map(p => p.map(v => v.toFixed(1)).join(" ")).join(" L"));
  } else if (kind === "underline") {
    paths.push(`M${b.x - 10 * u} ${b.y + b.h * 1.08} Q ${cx} ${b.y + b.h * 1.2 + j(10 * u)} ${b.x + b.w + 14 * u} ${b.y + b.h * 1.02}`);
  } else if (kind === "strike") {
    paths.push(`M${b.x - 8 * u} ${cy + j(6 * u)} L ${b.x + b.w + 8 * u} ${cy + j(8 * u)}`);
  } else if (kind === "arrows") {
    for (const [x, dir] of [[b.x - 0.06 * W, -1], [b.x + b.w + 0.06 * W, 1]]) {
      const y0 = cy + dir * 0.12 * H, y1 = cy - dir * 0.12 * H;
      paths.push(`M${x} ${y0} L ${x + j(4 * u)} ${y1}`, `M${x - 14 * u} ${y1 + dir * 16 * u} L ${x} ${y1} L ${x + 14 * u} ${y1 + dir * 16 * u}`);
    }
  } else if (kind === "crown") {
    const x = b.x + b.w * 0.1, y = b.y - 0.05 * H, w = 0.06 * W, h = 0.05 * H;
    paths.push(`M${x} ${y + h} L ${x} ${y} L ${x + w * 0.3} ${y + h * 0.6} L ${x + w * 0.5} ${y - h * 0.1} L ${x + w * 0.7} ${y + h * 0.6} L ${x + w} ${y} L ${x + w} ${y + h} Z`);
  } else if (kind === "bolt") {
    const x = b.x + b.w * (0.3 + r() * 0.4), y = b.y - 0.02 * H, h = b.h * 1.2;
    paths.push(`M${x + 20 * u} ${y} L ${x - 18 * u} ${y + h * 0.55} L ${x + 10 * u} ${y + h * 0.5} L ${x - 20 * u} ${y + h}`);
  } else if (kind === "cross") {
    for (let i = 0; i < 4; i++) { const x = b.x + r() * b.w, y = b.y - 0.1 * H + r() * (b.h + 0.2 * H), k = (8 + r() * 10) * u; paths.push(`M${x - k} ${y - k} L ${x + k} ${y + k}`, `M${x + k} ${y - k} L ${x - k} ${y + k}`); }
  } else if (kind === "box") {
    const p = 14 * u;
    paths.push(`M${b.x - p} ${b.y - p + j(6 * u)} L ${b.x + b.w + p} ${b.y - p} L ${b.x + b.w + p + j(6 * u)} ${b.y + b.h + p} L ${b.x - p} ${b.y + b.h + p + j(6 * u)} Z`);
  }
  s.innerHTML = paths.map(d0 => `<path d="${d0}" fill="none" stroke="${P.chalk}" stroke-width="${Math.max(2, 5 * u)}" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1"/>`).join("");
  L.appendChild(s);
  s.style.filter = "url(#chalk)";
  [...s.querySelectorAll("path")].forEach((p, i) => X.T(p, "strokeDashoffset", "1").to(t0 + i * 0.06, d, "0", EASE_OUT));
  return s;
}
fx.insertAdjacentHTML("beforeend", `<filter id="chalk"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="3" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="3"/></filter>`);
const box = (X, t) => { const r = t.el.getBoundingClientRect(), R = X.root.getBoundingClientRect(); return { x: r.left - R.left, y: r.top - R.top, w: r.width, h: r.height }; };
/* el tamaño real sale del layout: medimos en el cuadro siguiente al montaje */
function later(X, t, fn) { X.pend.push(() => fn(box(X, t))); }

const B = {};

B.slam = (sc, X) => {
  const { W, H } = X, L = bgLayer(X), ws = sc.words, s = J(ws);
  const red = X.r() < 0.45, fs = fit(U(s), "cd", 0.01, 0.86 * W, 0.46 * H);
  const o = { cls: "cd", fs, x: W / 2, y: 0.5 * H, color: red ? P.red : P.white, ls: 0.01 };
  ghost(X, L, s, o, Math.max(0.02, ws[0].rt), red ? P.white : P.red);
  const t = line(X, L, ws, o);
  slamIn(X, t, Math.max(0.02, ws[0].rt));
  const k = ["underline", "strike", "cross", "none"][Math.floor(X.r() * 4)];
  if (k !== "none") later(X, t, b => doodle(X, L, k, b, Math.max(0.2, ws[ws.length - 1].rt + 0.1)));
  smear(X, L);
};

B.twoTone = (sc, X) => {
  const { W, H } = X, L = bgLayer(X), ws = sc.words;
  const [a, b] = rows(ws, 2);
  const fa = fit(U(J(a)), "cd", 0.01, 0.8 * W, 0.13 * H);
  line(X, L, a, { cls: "cd", fs: fa, x: W / 2, y: 0.3 * H, color: P.red });
  if (b) {
    const thin = X.r() < 0.5 && J(b).length <= 12;
    const fb = fit(U(J(b)), thin ? "th" : "cd", thin ? 0.12 : 0.01, 0.78 * W, 0.34 * H);
    const t = line(X, L, b, { cls: thin ? "th" : "cd", fs: fb, x: W / 2, y: 0.62 * H, color: P.white, ls: thin ? 0.12 : 0.01 });
    slamIn(X, t, Math.max(0.03, b[0].rt), 1.2);
    later(X, t, bx => doodle(X, L, X.r() < 0.5 ? "crown" : "bolt", bx, Math.max(0.2, b[0].rt + 0.15)));
  }
  smear(X, L);
};

B.circle = (sc, X) => {
  const { W, H, u } = X, L = bgLayer(X), ws = sc.words, hi = heroIdx(ws);
  const hero = ws[hi].text, fs = fit(U(hero), "cd", 0.01, 0.46 * W, 0.26 * H);
  const t = word(X, L, hero, { cls: "cd", fs, x: W / 2, y: 0.46 * H, color: P.red });
  slamIn(X, t, Math.max(0.03, ws[hi].rt), 1.15);
  const rest = ws.filter((_, i) => i !== hi);
  if (rest.length) line(X, L, rest, { cls: "cd", fs: Math.min(0.08 * H, fit(U(J(rest)), "cd", 0.02, 0.6 * W, 1e9)), x: W / 2, y: 0.46 * H + fs * 0.62, color: P.white, ls: 0.02 });
  later(X, t, b => doodle(X, L, "circle", b, Math.max(0.1, ws[hi].rt + 0.12), 0.4));
  smear(X, L);
};

B.spacedWide = (sc, X) => {
  const { W, H } = X, L = bgLayer(X), ws = sc.words, hi = heroIdx(ws);
  const hero = U(ws[hi].text).split("").join(" "), rest = ws.filter((_, i) => i !== hi);
  const fs = fit(hero, "ex", 0.25, 0.8 * W, 0.16 * H);
  const t = word(X, L, hero, { cls: "ex", fs, x: W / 2, y: 0.58 * H, color: P.white, ls: 0.25 });
  show(X, t.box, Math.max(0.03, ws[hi].rt));
  X.T(t.el, "letterSpacing", "0.7em").to(Math.max(0.03, ws[hi].rt), 0.35, "0.25em", EASE_OUT);
  if (rest.length) {
    const fr = fit(U(J(rest)), "cd", 0.02, 0.5 * W, 0.2 * H);
    const r1 = line(X, L, rest, { cls: "cd", fs: fr, x: W / 2, y: 0.58 * H - fs * 0.5 - fr * 0.45, color: P.red, ls: 0.02 });
  }
  later(X, t, b => doodle(X, L, "arrows", b, Math.max(0.2, ws[hi].rt + 0.1)));
  smear(X, L);
};

B.grid = (sc, X) => {
  const { W, H } = X, L = bgLayer(X), ws = sc.words, s = U(J(ws));
  const cols = s.length <= 10 ? 3 : 2, rw = 3, cw = W / cols, rh = H / rw;
  const fs = fit(s, "cd", 0.01, cw * 0.92, rh * 0.8);
  let k = 0;
  for (let r = 0; r < rw; r++) for (let c = 0; c < cols; c++, k++) {
    const t = word(X, L, s, { cls: "cd", fs, x: (c + 0.5) * cw, y: (r + 0.5) * rh, color: (r + c) % 3 === 1 ? P.red : P.white, ls: 0.01 });
    const at = Math.max(0.02, ws[0].rt) + k * 0.035;
    show(X, t.box, at);
    X.T(t.el, "transform", "scaleX(2.2)").to(at, 0.2, "scaleX(1)", EASE_OUT);
    blurPass(X.T(t.el, "filter", "none", true), at, 0.18, "x");
  }
};

B.stackCols = (sc, X) => {
  const { W, H } = X, L = bgLayer(X), ws = sc.words;
  const a = ws.slice(0, 1), b = ws.slice(1);
  const n = 4, lh = 0.19 * H, y0 = 0.5 * H - (n - 1) * lh / 2;
  const fa = Math.min(lh * 0.95, fit(U(J(a)), "ex", 0, 0.24 * W, 1e9));
  const fb = b.length ? Math.min(lh * 0.95, fit(U(J(b)), "cd", 0.01, 0.56 * W, 1e9)) : 0;
  for (let i = 0; i < n; i++) {
    const at = Math.max(0.02, ws[0].rt) + i * 0.06;
    const ta = word(X, L, J(a), { cls: "ex", fs: fa, x: 0.3 * W, y: y0 + i * lh, ax: 1, color: P.white });
    show(X, ta.box, at);
    if (b.length) { const tb = word(X, L, J(b), { cls: "cd", fs: fb, x: 0.33 * W, y: y0 + i * lh, ax: 0, color: P.red, ls: 0.01 }); show(X, tb.box, Math.max(at, b[0].rt)); }
  }
};

B.torn = (sc, X) => {
  const { W, H, r } = X, L = bgLayer(X), ws = sc.words;
  const band = div(L, "patch", { left: 0, top: 0.22 * H + "px", width: W + "px", height: 0.56 * H + "px", background: P.paper });
  band.style.clipPath = `polygon(${Array.from({ length: 41 }, (_, i) => `${i / 40 * W}px ${(0.02 + r() * 0.05) * H}px`).join(", ")}, ${Array.from({ length: 41 }, (_, i) => `${(40 - i) / 40 * W}px ${(0.51 + r() * 0.05) * H}px`).join(", ")})`;
  X.T(band, "transform", "scaleY(0)").to(0, 0.16, "scaleY(1)", EASE_OUT);
  const ls = rows(ws, Math.min(3, Math.max(1, Math.ceil(ws.length / 2))));
  const fs = Math.min(...ls.map(l => fit(U(J(l)), "ex", 0.02, 0.78 * W, 0.14 * H)));
  const y0 = 0.5 * H - (ls.length - 1) * fs * 0.5;
  ls.forEach((l, i) => line(X, L, l, { cls: "ex", fs, x: W / 2, y: y0 + i * fs, color: i % 2 ? P.red : P.ink, ls: 0.02 }));
};

B.vertical = (sc, X) => {
  const { W, H, u } = X, L = bgLayer(X), ws = sc.words, hi = heroIdx(ws);
  const chars = U(ws[hi].text).split(""), n = chars.length, fs = Math.min(0.16 * H, (0.86 * H) / n);
  chars.forEach((c, i) => {
    const t = word(X, L, c, { cls: "cd", fs, x: W / 2, y: 0.5 * H + (i - (n - 1) / 2) * fs * 0.95, color: P.red });
    const at = Math.max(0.02, ws[hi].rt) + i * 0.05;
    show(X, t.box, at); X.T(t.el, "transform", "translateY(-60%)").to(at, 0.15, "translateY(0%)", EASE_OUT);
  });
  const rest = ws.filter((_, i) => i !== hi);
  if (rest.length) line(X, L, rest, { cls: "ex", fs: 0.07 * H, x: W / 2, y: 0.5 * H, color: P.white, ls: 0.4 });
  smear(X, L);
};

B.frameBox = (sc, X) => {
  const { W, H } = X, L = bgLayer(X), ws = sc.words;
  const [a, b] = rows(ws, 2);
  const fa = fit(U(J(a)), "cd", 0.01, 0.72 * W, 0.16 * H);
  const ta = line(X, L, a, { cls: "cd", fs: fa, x: W / 2, y: 0.36 * H, color: P.red, ls: 0.01 });
  if (b) line(X, L, b, { cls: "cd", fs: fa * 0.6, x: W / 2 - 0.3 * W, y: 0.36 * H + fa * 0.85, ax: 0, color: P.white, ls: 0.02 });
  later(X, ta, bx => doodle(X, L, "box", { ...bx, h: bx.h * (b ? 1.9 : 1) }, Math.max(0.1, ws[0].rt + 0.1), 0.5));
  smear(X, L);
};

B.stack3 = (sc, X) => {
  const { W, H } = X, L = bgLayer(X), ws = sc.words;
  const ls = rows(ws, Math.min(3, ws.length));
  const fs = Math.min(...ls.map(l => fit(U(J(l)), "cd", 0.01, 0.78 * W, 0.24 * H)));
  const y0 = 0.5 * H - (ls.length - 1) * fs * 0.48;
  ls.forEach((l, i) => {
    const t = line(X, L, l, { cls: "cd", fs, x: 0.1 * W, y: y0 + i * fs * 0.96, ax: 0, color: i === 1 ? P.red : P.white, ls: 0.01 });
    X.T(t.el, "transform", "translateX(-8%)").to(Math.max(0, l[0].rt), 0.22, "translateX(0%)", EASE_OUT);
  });
};

B.blurGiant = (sc, X) => {
  const { W, H } = X, L = bgLayer(X), ws = sc.words, s = J(ws);
  const fs = fit(U(s), "cd", 0.01, 0.94 * W, 0.7 * H), o = { cls: "cd", fs, x: W / 2, y: 0.5 * H, color: P.red, ls: 0.01 };
  for (let i = 0; i < 2; i++) ghost(X, L, s, o, Math.max(0.02, ws[0].rt), P.red);
  const t = line(X, L, ws, o);
  t.el.style.mixBlendMode = "screen";
  X.T(t.el, "filter", "url(#mbx3)", true).set(Math.max(0.02, ws[0].rt) + 0.12, "url(#mbx1)").set(Math.max(0.02, ws[0].rt) + 0.26, "none");
  X.T(t.el, "transform", "scale(1.12)").to(0, X.dur, "scale(1)");
};

B.strike = (sc, X) => {
  const { W, H } = X, L = bgLayer(X), ws = sc.words;
  const [a, b] = rows(ws, 2);
  const fa = fit(U(J(a)), "cd", 0.02, 0.62 * W, 0.12 * H);
  const ta = line(X, L, a, { cls: "cd", fs: fa, x: W / 2, y: 0.4 * H, color: P.red, ls: 0.02 });
  later(X, ta, bx => doodle(X, L, "strike", bx, Math.max(0.15, a[a.length - 1].rt + 0.1), 0.25));
  if (b) { const fb = fit(U(J(b)), "cd", 0.01, 0.7 * W, 0.2 * H); const tb = line(X, L, b, { cls: "cd", fs: fb, x: W / 2, y: 0.4 * H + fa * 0.6 + fb * 0.5, color: P.white, ls: 0.01 }); slamIn(X, tb, Math.max(0.05, b[0].rt), 1.15); }
  smear(X, L);
};

B.outro = (sc, X) => {
  const { W, H } = X, L = bgLayer(X), [a, b, c] = sc.words;
  if (a) { const t = word(X, L, a.text, { cls: "cd", fs: 0.2 * H, x: W / 2, y: 0.42 * H, color: P.red }); slamIn(X, t, a.rt); later(X, t, bx => doodle(X, L, "crown", bx, a.rt + 0.3)); }
  if (b) { const t = word(X, L, b.text, { cls: "cd", fs: 0.09 * H, x: W / 2, y: 0.58 * H, color: P.white, ls: 0.05 }); show(X, t.box, b.rt); }
  if (c) { const t = word(X, L, c.text, { cls: "ex", fs: 0.035 * H, x: W / 2, y: 0.68 * H, color: P.white, ls: 0.2 }); show(X, t.box, c.rt); later(X, t, bx => doodle(X, L, "underline", bx, c.rt + 0.2)); }
};
B.intro = B.slam;

const FITS = {
  slam: sc => J(sc.words).length <= 18,
  twoTone: sc => sc.words.length >= 2,
  circle: sc => sc.words[heroIdx(sc.words)].text.length <= 9,
  spacedWide: sc => sc.words[heroIdx(sc.words)].text.length <= 7,
  grid: sc => J(sc.words).length <= 16,
  stackCols: sc => sc.words.length >= 2 && sc.words[0].text.length <= 5,
  torn: sc => sc.words.length >= 2,
  vertical: sc => sc.words[heroIdx(sc.words)].text.length <= 6,
  frameBox: sc => sc.words.length >= 2,
  stack3: sc => sc.words.length >= 3,
  blurGiant: sc => J(sc.words).length <= 12,
  strike: sc => sc.words.length >= 2
};
function makeTimeline(segs, dur) { return lyricTimeline(segs, dur, FITS); }
