/* ============ BASE · ESCENAS DE lyrics-grunge (se conservan sin cambios) ============
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

/* ============================ MONTAJE · lyrics-grunge-montage ============================
   Variante de lyrics-grunge con LINEA DE TIEMPO EXPLICITA. Si config.timeline existe,
   cada escena la dirige el JSON: { t0, t1, bg, pieces[], tr } (tiempos de la referencia,
   config.timeOffsetSec se resta al reloj de la cancion). Sin timeline se usa el mazo
   procedural de la base (B.* + FITS de arriba). Todo el contenido (texto, medios, tiempos,
   colores, posiciones) sale del JSON: el codigo solo dibuja piezas.
   Piezas (k): text · stack · grid · chalk · rect · paper · glitch · outro.
   Posiciones y tamanos en fracciones del lienzo (x/W, y/H; fs = alto de fuente / H). */
const TOFF = Number(C.timeOffsetSec) || 0;
const COL = k => ({ red: P.red, white: P.white, black: P.black, paper: P.paper, ink: P.ink, chalk: P.chalk })[k] || k;
/* una sola pista por (elemento, propiedad): entrada y salida comparten la misma */
const TRK = (X, el, prop, init, discrete) => { const m = el.__tr || (el.__tr = {}); return m[prop] || (m[prop] = X.T(el, prop, init, discrete)); };
const visTo = (X, el, at, until) => {
  const t = TRK(X, el, "visibility", at > 0.001 ? "hidden" : "visible", true);
  if (at > 0.001) t.set(at, "visible");
  if (until != null) t.set(until, "hidden");
};
const rnd = (X, a = 1) => (X.r() - 0.5) * a;

/* ---------------- filtros extra: pincel seco y borde rugoso ---------------- */
fx.insertAdjacentHTML("beforeend", `<filter id="brush" x="-5%" y="-5%" width="110%" height="110%">
  <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="8" result="w"/>
  <feDisplacementMap in="SourceGraphic" in2="w" scale="9" result="d"/>
  <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" seed="4" result="n"/>
  <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.7 1.85" result="m"/>
  <feComposite in="d" in2="m" operator="in"/></filter>`);

/* ---------------- fondo: clip B/N, niebla, vineta, bordes de papel rasgado ---------------- */
function edgePoly(W, H, e, r) {
  const jig = (n, amp) => Array.from({ length: n + 1 }, () => amp * (0.35 + r() * 0.65));
  const d = e.d ?? 0.12, j = e.j ?? 0.35, n = 34;
  const P2 = pts => `polygon(${pts.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(", ")})`;
  const side = e.side;
  if (side === "top" || side === "bottom") {
    const dep = d * H, js = jig(n, dep * j), line = js.map((a, i) => [i / n * W, dep + (a - dep * j * 0.5)]);
    return side === "top" ? P2([[0, 0], [W, 0], ...line.slice().reverse()])
      : P2([[0, H], ...line.map(([x, y]) => [x, H - y]), [W, H]]);
  }
  if (side === "left" || side === "right") {
    const dep = d * W, js = jig(n, dep * j), line = js.map((a, i) => [dep + (a - dep * j * 0.5), i / n * H]);
    return side === "left" ? P2([[0, 0], ...line, [0, H]])
      : P2([[W, 0], [W, H], ...line.slice().reverse().map(([x, y]) => [W - x, y])]);
  }
  /* esquinas: tl tr bl br · rasgon diagonal */
  const a = d * W, b = (e.dy ?? d * 1.2) * H, pts = [];
  for (let i = 0; i <= 20; i++) { const p = i / 20; pts.push([a * (1 - p) + rnd({ r }, a * j * 0.5), b * p + rnd({ r }, b * j * 0.5)]); }
  const fl = ([x, y]) => [side[1] === "r" ? W - x : x, side[0] === "b" ? H - y : y];
  const cx = side[1] === "r" ? W : 0, cy = side[0] === "b" ? H : 0;
  return P2([[cx, cy], fl([a, 0]), ...pts.map(fl), fl([0, b])]);
}
function bgScene(X, d = {}) {
  const { W, H, r } = X;
  const L = div(X.root, "lay", { background: d.paper ? "#8e8e8b" : d.light ? "#c4c4c1" : P.black });
  if (d.light) {
    /* niebla clara: gris perla con nubes oscuras y claras que derivan (escenas "blancas" de la referencia) */
    for (const [x, y, sz, c] of d.blobs || [[18, 30, 42, "rgba(70,70,68,0.55)"], [78, 70, 38, "rgba(90,90,88,0.45)"], [60, 25, 35, "rgba(245,245,243,0.75)"], [30, 80, 40, "rgba(235,235,233,0.6)"]]) {
      const f = div(L, "lay", { background: `radial-gradient(ellipse at ${x}% ${y}%, ${c} 0%, transparent ${sz}%)` });
      X.T(f, "transform", "translateX(0px)").to(0, X.dur, `translateX(${rnd(X, 0.08) * W}px)`);
    }
  } else if (!d.paper) {
    const m = mbox(X, L, 0, { left: 0, top: 0, width: W + "px", height: H + "px" }, { filter: d.grade === undefined ? "bw" : d.grade, off: d.off ?? r() * 4 });
    if (d.flip) m.box.style.transform = "scaleX(-1)";
    const k = d.kb || [1.04, 1.1]; kenBurns(X, m, `scale(${k[0]})`, `scale(${k[1]})`);
    const dk = (d.dark ?? 0) * (C.look?.darkScale ?? 1);
    if (dk > 0.001) div(L, "lay", { background: `rgba(0,0,0,${dk})` });
    if (C.look?.haze) div(L, "lay", { background: `rgba(225,225,222,${C.look.haze})`, mixBlendMode: "screen" });
  } else {
    /* tarjeta de papel: oscuro a la izquierda, manchas claras a la derecha */
    div(L, "lay", { background: "linear-gradient(90deg, #141414 0%, #6a6a68 28%, #b4b4b1 62%, #d9d9d6 100%)" });
    for (const [x, y, s, a] of d.blobs || [[70, 70, 38, 0.55], [38, 30, 30, 0.35], [88, 25, 26, 0.4]])
      div(L, "lay", { background: `radial-gradient(ellipse at ${x}% ${y}%, rgba(240,240,238,${a}) 0%, transparent ${s}%)` });
  }
  const fog = d.fog ?? 1;
  if (fog > 0 && !d.paper && !d.light) for (let i = 0; i < 2; i++) {
    const f = div(L, "lay", { background: `radial-gradient(ellipse at ${20 + r() * 60}% ${20 + r() * 60}%, rgba(235,235,235,${(0.28 + r() * 0.22) * fog * (C.look?.fogScale ?? 1)}) 0%, transparent ${C.look?.fogSize ?? 45}%)` });
    X.T(f, "transform", "translateX(0px)").to(0, X.dur, `translateX(${rnd(X, 0.2) * W}px)`);
  }
  if (!d.paper && !d.light) div(L, "lay", { background: `radial-gradient(ellipse at 50% 50%, transparent 50%, rgba(0,0,0,${d.vig ?? C.look?.vignette ?? 0.6}) 100%)` });
  for (const e of d.edges || []) {
    const col = e.color === "black" ? P.black : e.color === "white" ? P.white : e.color || P.paper;
    const polys = [edgePoly(W, H, e, r), edgePoly(W, H, e, r), edgePoly(W, H, e, r)];
    const patch = div(L, "patch", { left: 0, top: 0, width: W + "px", height: H + "px", background: col, clipPath: polys[0] });
    if (e.boil !== false) patch.dataset.edge = JSON.stringify(polys);
    div(patch, "lay", { backgroundImage: GRAIN, opacity: 0.22 });
    if (e.fog) div(patch, "lay", { background: `radial-gradient(ellipse at ${e.fx ?? 50}% ${e.fy ?? 50}%, rgba(120,120,118,${e.fog}) 0%, transparent 70%)` });
    if (e.at) { patch.style.visibility = "hidden"; visTo(X, patch, e.at, e.until); }
    else if (e.until != null) visTo(X, patch, 0, e.until);
  }
  return L;
}

/* ---------------- trazos de tiza / pincel (SVG que se dibuja solo) ---------------- */
function strokes(X, L, paths, o = {}) {
  const { W, H, u } = X;
  const s = doc.createElementNS(SVGNS, "svg");
  s.setAttribute("width", W); s.setAttribute("height", H); s.setAttribute("viewBox", `0 0 ${W} ${H}`);
  s.style.cssText = "position:absolute;left:0;top:0;overflow:visible;pointer-events:none";
  const sw = Math.max(1.5, (o.sw ?? 5) * u * (C.strokeScale ?? 2.3)), col = COL(o.color || "chalk");
  s.innerHTML = paths.map(d0 => `<path d="${d0}" fill="${o.fill || "none"}" stroke="${col}" stroke-width="${sw}" stroke-linecap="${o.cap || "round"}" stroke-linejoin="round" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1"/>`).join("");
  L.appendChild(s);
  s.style.filter = o.rough === false ? "none" : (o.sw ?? 5) >= 7 ? "url(#brush)" : "url(#chalk)";
  if (o.op != null) s.style.opacity = o.op;
  const at = o.at ?? 0, d = o.d ?? 0.35;
  const ps = [...s.querySelectorAll("path")];
  ps.forEach((p, i) => {
    const tr = X.T(p, "strokeDashoffset", "1").to(at + i * (o.step ?? 0.06), d, "0", EASE_OUT);
    /* borrado: el trazo se deshace en el mismo sentido en que se dibujó (cierre de la referencia) */
    if (o.erase) tr.to(o.erase.at + (ps.length - 1 - i) * (o.erase.step ?? 0.05), o.erase.d ?? 0.25, "-1", EASE_IN);
  });
  if (o.at != null && o.at > 0.001) { s.style.visibility = "hidden"; visTo(X, s, at, o.until); }
  else if (o.until != null) visTo(X, s, 0, o.until);
  return s;
}
const poly = pts => "M" + pts.map(p => p.map(v => v.toFixed(1)).join(" ")).join(" L");
const SHAPE = {
  /* b = caja del texto en px; o = parametros de la pieza */
  ellipse(b, X, o) { const { u, r } = X, cx = b.x + b.w / 2 + (o.ox || 0) * X.W, cy = b.y + b.h / 2 + (o.oy || 0) * X.H, rx = b.w * (o.rx ?? 0.62), ry = b.h * (o.ry ?? 0.8), a0 = o.a0 ?? -0.5, turns = o.turns ?? 1.12, pts = [];
    for (let i = 0; i <= 48; i++) { const a = a0 + i / 48 * Math.PI * 2 * turns, k = 1 + (i / 48) * 0.06; pts.push([cx + Math.cos(a) * rx * k + rnd(X, 5 * u), cy + Math.sin(a) * ry * k + rnd(X, 5 * u)]); }
    return [poly(pts)]; },
  spiral(b, X, o) { const { u } = X, cx = b.x + b.w / 2, cy = b.y + b.h / 2, pts = [], turns = o.turns ?? 2.2;
    for (let i = 0; i <= 70; i++) { const p = i / 70, a = -0.4 + p * Math.PI * 2 * turns, k = 0.78 + p * 0.3; pts.push([cx + Math.cos(a) * b.w * 0.58 * k + rnd(X, 4 * u), cy + Math.sin(a) * b.h * 0.95 * k + rnd(X, 4 * u)]); }
    return [poly(pts)]; },
  underline(b, X, o) { const { u } = X, y = b.y + b.h * (o.dy ?? 1.1); return [`M${b.x - 10 * u} ${y} Q ${b.x + b.w / 2} ${y + rnd(X, 14 * u)} ${b.x + b.w + 14 * u} ${y - 4 * u}`]; },
  strike(b, X, o) { const { u } = X, cy = b.y + b.h * (o.dy ?? 0.5); return [`M${b.x - 12 * u} ${cy + rnd(X, 6 * u)} L ${b.x + b.w + 12 * u} ${cy + rnd(X, 8 * u)}`]; },
  brush(b, X, o) { const { u } = X, cy = b.y + b.h * (o.dy ?? 0.5); return [`M${b.x - 20 * u} ${cy + rnd(X, 8 * u)} C ${b.x + b.w * 0.3} ${cy - 10 * u}, ${b.x + b.w * 0.7} ${cy + 10 * u}, ${b.x + b.w + 20 * u} ${cy + rnd(X, 10 * u)}`]; },
  cross(b, X, o) { const { u } = X, out = [], n = o.n ?? 6; for (let i = 0; i < n; i++) { const x = b.x + X.r() * b.w * 1.1 - b.w * 0.05, y = b.y - b.h * 0.6 + X.r() * b.h * 2.2, k = (6 + X.r() * 9) * u; out.push(`M${x - k} ${y - k} L ${x + k} ${y + k}`, `M${x + k} ${y - k} L ${x - k} ${y + k}`); } return out; },
  crown(b, X, o) { const { W, H } = X, x = b.x + b.w * (o.cx ?? 0.1), y = b.y - (o.up ?? 0.07) * H, w = (o.w ?? 0.075) * W, h = (o.h ?? 0.06) * H; return [`M${x} ${y + h} L ${x - w * 0.04} ${y} L ${x + w * 0.28} ${y + h * 0.62} L ${x + w * 0.5} ${y - h * 0.12} L ${x + w * 0.72} ${y + h * 0.62} L ${x + w * 1.04} ${y} L ${x + w} ${y + h} Z`]; },
  bolt(b, X, o) { const { u } = X, x = b.x + b.w * (o.cx ?? 0.5), y = b.y - 0.02 * X.H, h = b.h * (o.h ?? 1.3); return [`M${x + 22 * u} ${y} L ${x - 18 * u} ${y + h * 0.55} L ${x + 12 * u} ${y + h * 0.5} L ${x - 22 * u} ${y + h}`]; },
  arrowR(b, X, o) { const { u } = X, x0 = b.x - (o.len ?? 0.09) * X.W, x1 = b.x - 8 * u, y = b.y + b.h * 0.5; return [`M${x0} ${y} L ${x1} ${y}`, `M${x1 - 16 * u} ${y - 13 * u} L ${x1} ${y} L ${x1 - 16 * u} ${y + 13 * u}`]; },
  arrowUp(b, X, o) { const { u } = X, x = b.x + b.w * (o.cx ?? 0.5), y0 = b.y + b.h * (o.y0 ?? 1.2), y1 = b.y + b.h * (o.y1 ?? -0.3); return [`M${x} ${y0} L ${x + rnd(X, 5 * u)} ${y1}`, `M${x - 16 * u} ${y1 + 22 * u} L ${x} ${y1} L ${x + 16 * u} ${y1 + 22 * u}`]; },
  arrowDown(b, X, o) { const { u } = X, x = b.x + b.w * (o.cx ?? 0.5), y0 = b.y + b.h * (o.y0 ?? -0.3), y1 = b.y + b.h * (o.y1 ?? 1.2); return [`M${x} ${y0} L ${x + rnd(X, 5 * u)} ${y1}`, `M${x - 16 * u} ${y1 - 22 * u} L ${x} ${y1} L ${x + 16 * u} ${y1 - 22 * u}`]; },
  arrowDiag(b, X, o) { const { u } = X, cx = b.x + b.w * (o.cx ?? 0.5), cy = b.y + b.h * (o.cy ?? 0.5), L = (o.len ?? 0.1) * X.W, dx = (o.dx ?? 1), dy = (o.dy ?? -1), x1 = cx + dx * L * 0.7, y1 = cy + dy * L * 0.7, x0 = cx - dx * L * 0.3, y0 = cy - dy * L * 0.3, hd = 15 * u;
    return [`M${x0} ${y0} L ${x1} ${y1}`, `M${x1 - dx * hd * 1.4} ${y1} L ${x1} ${y1} L ${x1} ${y1 - dy * hd * 1.4}`]; },
  swoosh(b, X, o) { const { u } = X, x0 = b.x + b.w * (o.x0 ?? 0.1), y0 = b.y + b.h * (o.y0 ?? 1.9), x1 = b.x + b.w * (o.x1 ?? 0.95), y1 = b.y + b.h * (o.y1 ?? 1.5); return [`M${x0} ${y0} Q ${(x0 + x1) / 2} ${y0 + 44 * u} ${x1} ${y1}`, `M${x1 - 22 * u} ${y1 + 6 * u} L ${x1} ${y1} L ${x1 - 8 * u} ${y1 + 22 * u}`]; },
  frame(b, X, o) { const { u } = X, p = (o.pad ?? 16) * u, x0 = b.x - p, y0 = b.y - p, x1 = b.x + b.w + p, y1 = b.y + b.h * (o.hh ?? 1) + p; return [`M${x0} ${y0 + rnd(X, 4 * u)} L ${x1} ${y0} L ${x1 + rnd(X, 5 * u)} ${y1} L ${x0} ${y1 + rnd(X, 5 * u)} Z`]; },
  play(b, X, o) { const s = (o.size ?? 0.055) * X.H, cx = b.x, cy = b.y; return [`M${cx - s * 0.5} ${cy - s * 0.6} L ${cx + s * 0.6} ${cy} L ${cx - s * 0.5} ${cy + s * 0.6} Z`]; },
  next(b, X, o) { const s = (o.size ?? 0.05) * X.H, cx = b.x, cy = b.y; return [`M${cx - s} ${cy - s * 0.55} L ${cx} ${cy} L ${cx - s} ${cy + s * 0.55} Z`, `M${cx} ${cy - s * 0.55} L ${cx + s} ${cy} L ${cx} ${cy + s * 0.55} Z`, `M${cx + s * 1.15} ${cy - s * 0.6} L ${cx + s * 1.15} ${cy + s * 0.6}`]; },
  prev(b, X, o) { const s = (o.size ?? 0.05) * X.H, cx = b.x, cy = b.y; return [`M${cx + s} ${cy - s * 0.55} L ${cx} ${cy} L ${cx + s} ${cy + s * 0.55} Z`, `M${cx} ${cy - s * 0.55} L ${cx - s} ${cy} L ${cx} ${cy + s * 0.55} Z`, `M${cx - s * 1.15} ${cy - s * 0.6} L ${cx - s * 1.15} ${cy + s * 0.6}`]; },
  tri(b, X, o) { const s = (o.size ?? 0.035) * X.H, cx = b.x, cy = b.y, d = o.dir === "left" ? -1 : 1; return [`M${cx - d * s * 0.5} ${cy - s * 0.6} L ${cx + d * s * 0.6} ${cy} L ${cx - d * s * 0.5} ${cy + s * 0.6} Z`]; },
  xmark(b, X, o) { const k = (o.size ?? 0.05) * X.H, cx = b.x, cy = b.y; return [`M${cx - k} ${cy - k} L ${cx + k} ${cy + k}`, `M${cx + k} ${cy - k} L ${cx - k} ${cy + k}`]; },
  plus(b, X, o) { const k = (o.size ?? 0.025) * X.H, cx = b.x, cy = b.y; return [`M${cx - k} ${cy} L ${cx + k} ${cy}`, `M${cx} ${cy - k} L ${cx} ${cy + k}`]; },
  ring(b, X, o) { const { u } = X, k = (o.size ?? 0.03) * X.H, cx = b.x, cy = b.y, pts = []; for (let i = 0; i <= 28; i++) { const a = i / 28 * Math.PI * 2.1; pts.push([cx + Math.cos(a) * k + rnd(X, 2 * u), cy + Math.sin(a) * k * (o.sq ?? 1) + rnd(X, 2 * u)]); } return [poly(pts)]; },
  star(b, X, o) { const k = (o.size ?? 0.03) * X.H, cx = b.x, cy = b.y, pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? k * 0.45 : k; pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); } return [poly(pts) + " Z"]; },
  face(b, X, o) { const { u } = X, cx = b.x, cy = b.y, k = (o.size ?? 0.085) * X.H, pts = []; for (let i = 0; i <= 30; i++) { const a = i / 30 * Math.PI * 2.1; pts.push([cx + Math.cos(a) * k * 0.78 + rnd(X, 3 * u), cy + Math.sin(a) * k + rnd(X, 3 * u)]); }
    return [poly(pts), `M${cx - k * 0.3} ${cy - k * 0.15} l 0 ${k * 0.1}`, `M${cx + k * 0.3} ${cy - k * 0.15} l 0 ${k * 0.1}`, `M${cx} ${cy} L ${cx - k * 0.1} ${cy + k * 0.22} L ${cx + k * 0.1} ${cy + k * 0.22}`, `M${cx - k * 0.25} ${cy + k * 0.55} Q ${cx} ${cy + k * 0.4} ${cx + k * 0.25} ${cy + k * 0.55}`]; },
  eyes(b, X, o) { const { u } = X, cx = b.x, cy = b.y, k = (o.size ?? 0.05) * X.H, e = (dx) => { const pts = []; for (let i = 0; i <= 14; i++) { const a = i / 14 * Math.PI * 2.1; pts.push([cx + dx + Math.cos(a) * k * 0.4, cy + Math.sin(a) * k * 0.16]); } return poly(pts); }; return [e(-k * 0.55), e(k * 0.55)]; },
  slash(b, X, o) { const { u } = X, cx = b.x + b.w * (o.cx ?? 0.5), cy = b.y + b.h * (o.cy ?? 0.5), L = (o.len ?? 1.5) * b.h, a = (o.ang ?? -62) * Math.PI / 180; return [`M${cx - Math.cos(a) * L / 2} ${cy - Math.sin(a) * L / 2} L ${cx + Math.cos(a) * L / 2} ${cy + Math.sin(a) * L / 2}`]; },
  line(b, X, o) { const { W, H } = X; return [`M${o.x0 * W} ${o.y0 * H} L ${o.x1 * W} ${o.y1 * H}`]; },
  path(b, X, o) { const { W, H } = X; return (o.paths || [o.pts || []]).map(pts => poly(pts.map(([x, y]) => [x * W, y * H]))); }
};
const absBox = (X, a) => ({ x: a.x * X.W, y: a.y * X.H, w: (a.w ?? 0) * X.W, h: (a.h ?? 0) * X.H });

/* ---------------- texto ---------------- */
function textOf(X, L, p, over = {}) {
  const q = { ...p, ...over }, { W, H } = X, cls = q.font || "cd", s = U(slotText(q)), ls = q.ls ?? 0.01;
  const fs = q.fs != null ? q.fs * H : fit(s, cls, ls, (q.w ?? 0.8) * W, (q.h == null ? 9 : q.h < 0.3 ? q.h * (C.textBoost ?? 1.8) : q.h) * H);
  const mode = (q.in === "words" || q.grow) ? "words" : (q.in === "chars" || q.in === "scatter") ? "chars" : undefined;
  const t = tx(L, s, { cls, fs, x: (q.x ?? 0.5) * W, y: (q.y ?? 0.5) * H, ax: q.ax ?? 0.5, ay: q.ay ?? 0.5, color: COL(q.color || "white"), ls, rot: q.rot, split: mode });
  if (q.distress !== false) t.el.classList.add("gr");
  if (q.fw != null) t.el.style.fontWeight = q.fw;
  if (q.fst != null) t.el.style.fontStretch = q.fst;
  if (q.op != null) t.box.style.opacity = q.op;
  if (q.blend) t.box.style.mixBlendMode = q.blend;
  /* palabra roja gigante: el metraje se ve dentro de la letra (como «LIKE» en la referencia) */
  else if (q.screen !== false && COL(q.color || "white") === P.red && fs > 0.3 * H && !over.color) t.box.style.mixBlendMode = "screen";
  if (q.z != null) t.box.style.zIndex = q.z;
  if (q.glow) t.el.style.textShadow = `0 0 ${0.07 * fs}px ${COL(q.glow === true ? "red" : q.glow)}`;
  t.fs = fs;
  return t;
}
function enterText(X, t, p, at) {
  const kind = p.in || "cut", d = p.d ?? 0.2, el = t.el, box = t.box;
  const hideUntil = (until) => visTo(X, box, at, until);
  switch (kind) {
    case "slam": {
      TRK(X, el, "transform", `scale(${p.from ?? 1.3})`).to(at, d, "scale(1)", EASE_OUT);
      blurPass(TRK(X, el, "filter", "none", true), at, Math.min(0.2, d), p.axis || (X.r() < 0.5 ? "x" : "y"));
      hideUntil(p.until); break; }
    case "spread": {
      TRK(X, el, "letterSpacing", `${p.ls0 ?? 0.6}em`).to(at, d, `${p.ls ?? 0.01}em`, EASE_OUT);
      TRK(X, box, "opacity", "0").to(at, Math.min(0.12, d), p.op != null ? String(p.op) : "1");
      hideUntil(p.until); break; }
    case "fade": { TRK(X, box, "opacity", "0").to(at, d, p.op != null ? String(p.op) : "1", EASE_IO); hideUntil(p.until); break; }
    case "wipe": {
      const f = p.dir === "R" ? ["inset(0% 0% 0% 100%)", "inset(0% 0% 0% 0%)"] : p.dir === "U" ? ["inset(100% 0% 0% 0%)", "inset(0% 0% 0% 0%)"] : p.dir === "D" ? ["inset(0% 0% 100% 0%)", "inset(0% 0% 0% 0%)"] : ["inset(0% 100% 0% 0%)", "inset(0% 0% 0% 0%)"];
      TRK(X, el, "clipPath", f[0]).to(at, d, f[1], EASE_OUT); hideUntil(p.until); break; }
    case "rise": {
      TRK(X, el, "transform", `translateY(${(p.dy ?? 0.35) * 100}%)`).to(at, d, "translateY(0%)", EASE_OUT);
      TRK(X, box, "opacity", "0").to(at, d * 0.6, "1"); hideUntil(p.until); break; }
    case "words": {
      const wt = p.wt || t.words.map((_, i) => at + i * (p.step ?? 0.18));
      t.words.forEach((w, i) => visTo(X, w, wt[i] ?? at, p.until)); break; }
    case "chars": {
      t.chars.forEach((c, i) => visTo(X, c, at + i * (p.step ?? 0.04), p.until)); break; }
    case "scatter": {
      t.chars.forEach((c, i) => {
        const a = at + i * (p.step ?? 0.02), R = 0.5 * X.W;
        TRK(X, c, "transform", `translate(${rnd(X, 0.18 * X.W)}px, ${rnd(X, 0.25 * X.H)}px) scale(${1.4 + X.r()})`).to(a, d, "translate(0px, 0px) scale(1)", EASE_OUT);
        TRK(X, c, "opacity", "0").to(a, d * 0.6, "1");
        blurPass(TRK(X, c, "filter", "none", true), a, d * 0.8, X.r() < 0.5 ? "x" : "y");
      });
      hideUntil(p.until); break; }
    case "glitch": {
      const j = 0.035 * X.W;
      TRK(X, el, "transform", `translateX(${-j}px)`).set(at + 0.04, `translateX(${j}px)`).set(at + 0.08, `translateX(${-j * 0.5}px)`).set(at + 0.12, "translateX(0px)");
      blurPass(TRK(X, el, "filter", "none", true), at, 0.14, "x");
      hideUntil(p.until); break; }
    default: hideUntil(p.until);
  }
}
function exitText(X, t, p, o) {
  if (!o) return;
  const at = o.at, d = o.d ?? 0.18, box = t.box, el = t.el;
  switch (o.fx || "cut") {
    case "fade": TRK(X, box, "opacity", p.op != null ? String(p.op) : "1").to(at, d, "0", EASE_IO); visTo(X, box, p.at ?? 0, at + d); break;
    case "smear": {
      blurPass(TRK(X, el, "filter", "none", true), at, d, "x");
      TRK(X, box, "opacity", "1").to(at + d * 0.4, d * 0.6, "0");
      TRK(X, el, "transform", "translateX(0px)").to(at, d, `translateX(${(o.dx ?? 0.05) * X.W}px)`, EASE_IN);
      visTo(X, box, p.at ?? 0, at + d); break; }
    default: visTo(X, box, p.at ?? 0, at);
  }
}
/* textos de intro/outro: la pieza marcada toma el texto de config.intro / config.outro */
function slotText(q) {
  if (q.intro && introOn() && String(C.intro[q.intro] || "").trim()) return C.intro[q.intro];
  if (q.outro && String((C.outro || {})[q.outro] || "").trim()) return C.outro[q.outro];
  return q.s;
}
const introOn = () => C.intro && C.intro.enabled !== false && !!String(C.intro.title || "").trim();
const PIECE = {};
PIECE.text = (X, L, p0) => {
  const at = p0.at ?? 0;
  /* la pieza se va del todo: ecos y fantasma se van con ella (salida o until) */
  const gone = p0.until ?? (p0.out ? p0.out.at + (p0.out.d ?? 0.18) : undefined);
  const p = gone != null ? { ...p0, until: gone } : p0;
  if (p.ghost) {
    const g = p.ghost, gt = textOf(X, L, p, { color: g.color || "red", distress: false, glow: false, op: g.op ?? 0.55, ls: p.ls });
    gt.el.style.filter = `url(#mbx${g.blur ?? 2})`;
    const dx = (g.dx ?? 0.04) * X.W;
    TRK(X, gt.el, "transform", `translateX(${dx}px)`).to(at, (p.until ?? X.dur) - at, `translateX(${dx * 0.3}px)`);
    visTo(X, gt.box, at + (g.delay || 0), p.until);
  }
  echoes(X, L, p, at);
  const t = textOf(X, L, p);
  if (p.id) X.ids[p.id] = t;
  enterText(X, t, p, at);
  if (p.boil !== false) boil(X, t.box, { at: 0, until: X.dur + 0.05, amp: p.boil ?? 1, sc: p.font === "th" ? 0.004 : 0.012 });
  if (p.distress !== false && p.erode !== false) erode(X, t.el, { size: p.erodeSize ?? Math.max(0.16, (t.fs / X.H) * 1.4) });   /* el tamaño de la erosión acompaña a la letra (sin trama repetida visible) */
  if (p.weight) { const w = p.weight; TRK(X, t.el, "fontWeight", String(w.from)).to(at + (w.delay || 0), w.d ?? 0.4, String(w.to), EASE_OUT); }
  if (p.ls2 != null) TRK(X, t.el, "letterSpacing", `${p.ls ?? 0.01}em`).to(p.ls2at ?? at, p.ls2d ?? 0.4, `${p.ls2}em`, EASE_OUT);
  if (p.scale) { const s = p.scale; TRK(X, t.el, "transform", `scale(${s.from ?? 1})`).to(s.at ?? at, s.d ?? 0.4, `scale(${s.to})`, EASE_OUT); }
  if (p.drift) TRK(X, t.el, "transform", "translateX(0px)").to(at, (p.until ?? X.dur) - at, `translateX(${p.drift * X.W}px)`);
  if (p.move) { const m = p.move, f = { x: p.x ?? 0.5, y: p.y ?? 0.5 };
    if (m.to.x != null) TRK(X, t.box, "left", f.x * X.W + "px").to(m.at ?? at, m.d ?? 0.3, m.to.x * X.W + "px", m.ease || EASE_OUT);
    if (m.to.y != null) TRK(X, t.box, "top", f.y * X.H + "px").to(m.at ?? at, m.d ?? 0.3, m.to.y * X.H + "px", m.ease || EASE_OUT); }
  if (p.grow) { const g = p.grow; t.words.forEach((w, i) => { const a = g.at[i] ?? g.at[g.at.length - 1], dd = g.d ?? 0.2;
      TRK(X, w, "fontFamily", "var(--fTh)", true).set(a, "var(--fCd)");
      TRK(X, w, "fontSize", `${g.from ?? 0.45}em`).to(a, dd, "1em", EASE_OUT);
      TRK(X, w, "letterSpacing", `${g.ls0 ?? 0.35}em`).to(a, dd, `${p.ls ?? 0.01}em`, EASE_OUT); }); }
  /* palabras repartidas en diagonal que se juntan en la línea (apertura de la referencia) */
  if (p.gather && t.words) { const g = p.gather, mid = (t.words.length - 1) / 2;
    t.words.forEach((w, i) => TRK(X, w, "transform", `translate(${(g.dx ?? 0.06) * (i - mid) * X.W}px, ${(g.dy ?? 0.12) * (i - mid) * X.H}px)`).to(g.at ?? at, g.d ?? 0.3, "translate(0px, 0px)", EASE_OUT)); }
  exitText(X, t, p0, p0.out);
  return t;
};
PIECE.stack = (X, L, p) => {
  const n = p.n ?? 4, cols = p.colors || ["white"], dy = (p.dy ?? 0.15), y0 = (p.y ?? 0.5) - (n - 1) * dy / 2;
  const mid = (n - 1) / 2;
  for (let i = 0; i < n; i++) {
    const sc = p.scales ? p.scales[i % p.scales.length] : 1;
    PIECE.text(X, L, { ...p, k: "text", y: y0 + i * dy, color: cols[i % cols.length], fs: p.fs != null ? p.fs * sc : undefined, w: p.w != null ? p.w * (p.fitScale ? sc : 1) : undefined, at: (p.at ?? 0) + i * (p.step ?? 0.05), ghost: i === Math.round(mid) ? p.ghost : undefined, out: p.out ? { ...p.out, at: p.out.at + i * (p.out.step ?? 0) } : undefined });
  }
};
PIECE.grid = (X, L, p) => {
  const cols = p.cols ?? 3, rows = p.rows ?? 3, cw = (p.w ?? 1) * X.W / cols, rh = (p.h ?? 1) * X.H / rows, x0 = p.x0 ?? 0, y0 = p.y0 ?? 0;
  const col = p.colors || ["white"];
  let k = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++, k++) {
    const sx = p.stagger?.dir === "col" ? c : p.stagger?.dir === "row" ? r : k;
    PIECE.text(X, L, { ...p, k: "text", s: p.s, x: x0 + (c + 0.5) * cw / X.W, y: y0 + (r + 0.5) * rh / X.H, w: cw * (p.fillW ?? 0.9) / X.W, h: rh * (p.fillH ?? 0.8) / X.H, color: col[(r * (p.shift ?? 1) + c) % col.length], at: (p.at ?? 0) + sx * (p.step ?? 0.035), ghost: undefined, out: p.out });
  }
};
PIECE.chalk = (X, L, p) => {
  const at = p.at ?? 0;
  const run = b => {
    const f = SHAPE[p.shape]; if (!f) { console.warn(`[${NAME}] forma desconocida`, p.shape); return; }
    const base = f(b, X, p), o = { color: p.color || "chalk", sw: p.sw ?? 5, at, d: p.d ?? 0.35, step: p.step, until: p.until ?? (p.erase ? p.erase.at + (p.erase.d ?? 0.25) + 0.4 : undefined), op: p.op, rough: p.rough, erase: p.erase };
    if (!(FX.boil > 0) || p.boil === false) { strokes(X, L, base, o); return; }
    const amp = (p.jit ?? 2.6) * X.u * (C.strokeScale ?? 2.3) * 0.6, sd = Math.floor(X.r() * 1e6);
    const vs = [0, 1, 2].map(i => strokes(X, L, i ? base.map((d0, j) => jitterPath(d0, amp, sd + i * 97 + j)) : base, o));
    cycle(X, vs, { op: p.op ?? 1 });
    if (p.erode !== false) vs.forEach(v => erode(X, v, { size: 0.12 }));
  };
  if (p.ref) { const t = X.ids[p.ref]; if (!t) { console.warn(`[${NAME}] ref sin texto`, p.ref); return; } later(X, t, b => run({ x: b.x + (p.bx || 0) * X.W, y: b.y + (p.by || 0) * X.H, w: b.w * (p.bw ?? 1), h: b.h * (p.bh ?? 1) })); }
  else run(absBox(X, p.box || { x: p.x ?? 0.5, y: p.y ?? 0.5, w: p.w ?? 0, h: p.h ?? 0 }));
};
PIECE.rect = (X, L, p) => {
  const { W, H } = X, el = div(L, "patch", { left: p.x * W + "px", top: p.y * H + "px", width: p.w * W + "px", height: p.h * H + "px", background: COL(p.color || "red"), opacity: p.op ?? 1 });
  if (p.blur) el.style.filter = `url(#mb${p.axis || "x"}${p.blur})`;
  if (p.blend) el.style.mixBlendMode = p.blend;
  if (p.z != null) el.style.zIndex = p.z;
  const at = p.at ?? 0;
  if (p.fade) TRK(X, el, "opacity", "0").to(at, p.fade, String(p.op ?? 1), EASE_OUT);
  if (p.drift) TRK(X, el, "transform", "translateX(0px)").to(at, (p.until ?? X.dur) - at, `translateX(${p.drift * W}px)`);
  visTo(X, el, at, p.until);
};
PIECE.paper = (X, L, p) => {
  const { W, H, r } = X, x0 = p.x * W, x1 = (p.x + p.w) * W, y0 = p.y * H, y1 = (p.y + p.h) * H, n = 40, jg = (p.j ?? 0.04) * H;
  const top = [], bot = [];
  for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n; top.push([x, y0 + r() * jg]); bot.push([x, y1 - r() * jg]); }
  const el = div(L, "patch", { left: 0, top: 0, width: W + "px", height: H + "px", background: COL(p.color || "paper"), clipPath: `polygon(${[...top, ...bot.reverse()].map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(", ")})` });
  div(el, "lay", { backgroundImage: GRAIN, opacity: 0.2 });
  const at = p.at ?? 0;
  if (p.grow) TRK(X, el, "transform", "scaleY(0)").to(at, p.grow, "scaleY(1)", EASE_OUT);
  visTo(X, el, at, p.until);
};
/* corte "scan": franjas horizontales del propio cuadro desplazadas a los lados (filtro SVG
   aplicado a toda la escena: metraje y letra se corren juntos), con estela desenfocada */
const SCAN = {};
function scanFilter(X, k) {
  const id = `scan${Math.round(X.W)}_${k}`;
  if (SCAN[id]) return id;
  SCAN[id] = 1;
  const steps = ["0.5 0.5 0.15 0.5 0.85 0.5 0.5 0.3 0.5 0.5 0.95 0.5", "0.5 0.8 0.5 0.5 0.2 0.5 0.5 0.5 0.7 0.5 0.05 0.5", "0.5 0.5 0.5 0.9 0.5 0.35 0.5 0.5 0.1 0.5 0.5 0.65"][k % 3];
  fx.insertAdjacentHTML("beforeend", `<filter id="${id}" x="-20%" y="0%" width="140%" height="100%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0 ${(0.008 + k * 0.004).toFixed(4)}" numOctaves="1" seed="${11 + k * 7}" result="t"/>
    <feComponentTransfer in="t" result="m"><feFuncR type="discrete" tableValues="${steps}"/><feFuncG type="table" tableValues="0.5 0.5"/></feComponentTransfer>
    <feDisplacementMap in="SourceGraphic" in2="m" scale="${(0.22 * X.W).toFixed(0)}" xChannelSelector="R" yChannelSelector="G" result="d"/>
    <feGaussianBlur in="d" stdDeviation="${(0.006 * X.W).toFixed(1)} 0" result="b"/>
    <feBlend in="d" in2="b" mode="lighten"/></filter>`);
  return id;
}
PIECE.glitch = (X, L, p) => {
  const at = p.at ?? 0, d = p.d ?? 0.25, n = Math.max(2, Math.min(4, Math.round((p.n ?? 6) / 2)));
  const tr = TRK(X, L, "filter", "none", true);
  for (let i = 0; i < n; i++) tr.set(at + d * i / n, `url(#${scanFilter(X, (Math.floor(X.r() * 3) + i) % 3)})`);
  tr.set(at + d, "none");
  /* estela roja tenue: el rojo de la letra arrastrado por el corte */
  if ((p.redP ?? 0.4) > 0.05) {
    const g = div(L, "lay", { zIndex: 30, pointerEvents: "none" });
    for (let i = 0; i < 2; i++) {
      const y = (p.y0 ?? 0.2) + X.r() * ((p.y1 ?? 0.8) - (p.y0 ?? 0.2)), hh = (0.01 + X.r() * 0.025) * X.H;
      const b = div(g, "patch", { left: -0.1 * X.W + "px", top: y * X.H + "px", width: 1.2 * X.W + "px", height: hh + "px", background: P.red, opacity: 0.35 * (p.redP ?? 0.4) + 0.15, filter: "url(#mbx3)" });
      TRK(X, b, "transform", `translateX(${rnd(X, 0.3 * X.W)}px)`).to(at, d, `translateX(${rnd(X, 0.3 * X.W)}px)`);
    }
    visTo(X, g, at, at + d);
  }
};

/* ============ MOVIMIENTO ERRÁTICO · lenguaje del montaje de referencia ============
   La referencia anima "a cuadros": cada 2 cuadros (25 fps) la letra, la tiza y los bordes de
   papel saltan a otra posición/forma (boil de stop-motion); cada palabra lleva ecos desplazados
   y borrosos; el metraje cambia de toma dentro de la misma frase (a veces por un agujero de
   papel rasgado); casi cada cambio pasa por un barrido scan; polvo, rayones y grano parpadean.
   Todo es determinista: tablas de pasos discretos con semilla, nunca Math.random ni tiempo real.
   config.fx = { step, boil, echo, shake, tex, cuts, endScan } (0 apaga cada capa). */
const FX = Object.assign({ step: 0.08, boil: 1, echo: 1, shake: 1, tex: 1, cuts: 1, endScan: 0.55 }, C.fx || {});
const STEP = Math.max(0.04, +FX.step || 0.08);
const hsh = (a, b) => { let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
/* pasos de temblor sobre las propiedades CSS individuales (translate/rotate/scale): no pisan
   las transformaciones de entrada, que van en `transform` */
function boil(X, el, o = {}) {
  const k0 = +(o.amp ?? 1) * FX.boil; if (!(k0 > 0)) return;
  const t0 = Math.max(0, o.at ?? 0), t1 = Math.min(X.dur + 0.05, o.until ?? X.dur + 0.05), seed = (o.seed ?? Math.floor(X.r() * 1e6)) | 0;
  const ax = (o.tx ?? 0.0024) * X.W * k0, ay = (o.ty ?? 0.0032) * X.H * k0, ar = (o.rot ?? 0.5) * k0, as = (o.sc ?? 0.012) * k0;
  const tr = X.T(el, "translate", "0px 0px", true), rt = X.T(el, "rotate", "0deg", true), sc = as > 0 ? X.T(el, "scale", "1", true) : null;
  const st = o.step ?? STEP;
  for (let k = 0, t = t0; t < t1; k++, t += st) {
    tr.set(t, `${((hsh(seed, k * 4) - 0.5) * 2 * ax).toFixed(1)}px ${((hsh(seed, k * 4 + 1) - 0.5) * 2 * ay).toFixed(1)}px`);
    rt.set(t, `${((hsh(seed, k * 4 + 2) - 0.5) * 2 * ar).toFixed(2)}deg`);
    if (sc) sc.set(t, (1 + (hsh(seed, k * 4 + 3) - 0.5) * 2 * as).toFixed(4));
  }
}
/* ecos: copias detrás de la palabra, desplazadas y desenfocadas, que saltan por su cuenta */
function echoes(X, L, p, at) {
  const e = p.echo === false ? null : { n: 2, dx: 0.014, op: 0.32, ...(typeof p.echo === "object" ? p.echo : {}) };
  if (!e || !(FX.echo > 0) || p.font === "th") return;
  const red = (p.color || "white") === "red";
  for (let i = 0; i < e.n; i++) {
    const g = textOf(X, L, p, { color: e.color || (red ? "red" : i ? "red" : "white"), distress: false, glow: false, op: (e.op / (i + 1)) * FX.echo });
    g.el.style.filter = `url(#mbx${i ? 3 : 2})`;
    boil(X, g.box, { at, until: p.until, tx: e.dx * (1 + i), ty: 0.006 * (1 + i), rot: 0.8, sc: 0.03, amp: 1 });
    visTo(X, g.box, at + 0.04 * (i + 1), p.until);
    if (p.in === "words" && g.words && p.wt) g.words.forEach((w, j) => visTo(X, w, p.wt[j] ?? at, p.until));
  }
}
/* erosión de fotocopia: vetas verticales y motas que comen la letra; la máscara salta de
   posición cada paso, así la erosión cambia por cuadros como en la referencia */
const ERODE = (() => {
  const cv = doc.createElement("canvas"); cv.width = cv.height = 256; const cx = cv.getContext("2d");
  cx.fillStyle = "#000"; cx.fillRect(0, 0, 256, 256); cx.globalCompositeOperation = "destination-out";
  let k = 0; const R = () => hsh(4242, k++);
  for (let i = 0; i < 520; i++) { cx.fillStyle = `rgba(0,0,0,${0.45 + R() * 0.55})`; const x = R() * 256, y = R() * 256; cx.fillRect(x, y, 0.7 + R() * 1.6, 3 + R() * 34); }
  for (let i = 0; i < 1400; i++) { cx.fillStyle = `rgba(0,0,0,${0.3 + R() * 0.7})`; const sz = 0.5 + R() * 1.8; cx.fillRect(R() * 256, R() * 256, sz, sz); }
  for (let i = 0; i < 6; i++) { cx.fillStyle = `rgba(0,0,0,${0.5 + R() * 0.4})`; cx.fillRect(0, R() * 256, 256, 0.6 + R() * 1.5); }
  return `url(${cv.toDataURL()})`;
})();
function erode(X, el, o = {}) {
  const sz = Math.round((o.size ?? 0.16) * X.H);
  Object.assign(el.style, { webkitMaskImage: ERODE, maskImage: ERODE, webkitMaskSize: `${sz}px ${sz}px`, maskSize: `${sz}px ${sz}px` });
  if (!(FX.boil > 0)) return;
  const tr = X.T(el, "webkitMaskPosition", "0px 0px", true), tr2 = X.T(el, "maskPosition", "0px 0px", true), seed = Math.floor(X.r() * 1e6);
  for (let k = 0, t = 0; t < X.dur + 0.05; k++, t += STEP) { const v = `${Math.floor(hsh(seed, k * 2) * sz)}px ${Math.floor(hsh(seed, k * 2 + 1) * sz)}px`; tr.set(t, v); tr2.set(t, v); }
}
/* variantes de un trazo: mismos puntos con otra rugosidad (para alternarlas) */
function jitterPath(d, amp, seed) { let k = 0; return d.replace(/-?\d+(\.\d+)?/g, m => (parseFloat(m) + (hsh(seed, k++) - 0.5) * 2 * amp).toFixed(1)); }
/* alterna N elementos: solo uno visible por paso (opacidad discreta) */
function cycle(X, els, o = {}) {
  const st = o.step ?? STEP, t0 = Math.max(0, o.at ?? 0), t1 = Math.min(X.dur + 0.05, o.until ?? X.dur + 0.05), seed = (o.seed ?? Math.floor(X.r() * 1e6)) | 0;
  const trs = els.map((el, i) => X.T(el, "opacity", i === 0 ? String(o.op ?? 1) : "0", true));
  let prev = 0;
  for (let k = 0, t = t0; t < t1; k++, t += st) {
    let n = Math.floor(hsh(seed, k) * els.length); if (n === prev && els.length > 1) n = (n + 1) % els.length;
    trs.forEach((tr, i) => tr.set(t, i === n ? String(o.op ?? 1) : "0")); prev = n;
  }
}
/* texturas que parpadean: polvo, pelos y rayones verticales (6 cuadros pregenerados) */
const DUST = (() => {
  const out = [], W = 640, H = 360;
  for (let f = 0; f < 6; f++) {
    const cv = doc.createElement("canvas"); cv.width = W; cv.height = H; const cx = cv.getContext("2d");
    const R = (k) => hsh(9001 + f, k);
    let k = 0;
    for (let i = 0; i < 26; i++) { const x = R(k++) * W, y = R(k++) * H, s = 0.4 + R(k++) * 1.1; cx.fillStyle = R(k++) < 0.6 ? `rgba(255,255,255,${0.35 + R(k++) * 0.5})` : `rgba(0,0,0,${0.4 + R(k++) * 0.5})`; cx.beginPath(); cx.arc(x, y, s, 0, 7); cx.fill(); }
    for (let i = 0; i < (f % 3 === 0 ? 1 : 0); i++) { cx.strokeStyle = `rgba(255,255,255,${0.12 + R(k++) * 0.25})`; cx.lineWidth = 0.6 + R(k++); const x = R(k++) * W; cx.beginPath(); cx.moveTo(x, 0); cx.lineTo(x + (R(k++) - 0.5) * 8, H); cx.stroke(); }
    for (let i = 0; i < 2; i++) { cx.strokeStyle = `rgba(${R(k++) < 0.5 ? "255,255,255" : "0,0,0"},${0.4 + R(k++) * 0.4})`; cx.lineWidth = 0.8; const x = R(k++) * W, y = R(k++) * H; cx.beginPath(); cx.moveTo(x, y); cx.bezierCurveTo(x + 10, y + 6, x - 4, y + 14, x + 8 + R(k++) * 10, y + 20); cx.stroke(); }
    out.push(`url(${cv.toDataURL()})`);
  }
  return out;
})();
function textures(X, L) {
  if (!(FX.tex > 0)) return;
  const d = div(L, "lay", { zIndex: 45, pointerEvents: "none", backgroundSize: "100% 100%", mixBlendMode: "normal", opacity: String(0.85 * FX.tex) });
  const tr = X.T(d, "backgroundImage", DUST[0], true), seed = Math.floor(X.r() * 1e6);
  for (let k = 0, t = 0; t < X.dur + 0.05; k++, t += STEP) tr.set(t, DUST[Math.floor(hsh(seed, k) * DUST.length)]);
  const g = div(L, "lay", { zIndex: 44, pointerEvents: "none", backgroundImage: GRAIN, backgroundSize: "96px 96px", opacity: String(0.42 * FX.tex), mixBlendMode: "overlay" });
  const gp = X.T(g, "backgroundPosition", "0px 0px", true);
  for (let k = 0, t = 0; t < X.dur + 0.05; k++, t += STEP) gp.set(t, `${Math.floor(hsh(seed + 7, k) * 96)}px ${Math.floor(hsh(seed + 11, k) * 96)}px`);
  /* parpadeo de exposición del metraje (luz que respira por cuadros) */
  const fl = div(L, "lay", { zIndex: 43, pointerEvents: "none", background: "#000" });
  const ft = X.T(fl, "opacity", "0", true);
  for (let k = 0, t = 0; t < X.dur + 0.05; k++, t += STEP) ft.set(t, (hsh(seed + 3, k) * 0.12).toFixed(3));
}
/* cámara: temblor fino continuo y golpe al entrar en la escena */
function shake(X, G, d = {}) {
  if (!(FX.shake > 0)) return;
  const seed = Math.floor(X.r() * 1e6), base = (d.shake ?? 1) * FX.shake, hit = (d.hit ?? 0.5) * FX.shake;
  const tr = X.T(G, "translate", "0px 0px", true), sc = X.T(G, "scale", "1", true);
  for (let k = 0, t = 0; t < X.dur + 0.05; k++, t += STEP) {
    const h = t < 0.2 ? hit * (1 - t / 0.2) : 0, ax = (0.0025 * base + 0.018 * h) * X.W, ay = (0.003 * base + 0.02 * h) * X.H;
    tr.set(t, `${((hsh(seed, k * 2) - 0.5) * 2 * ax).toFixed(1)}px ${((hsh(seed, k * 2 + 1) - 0.5) * 2 * ay).toFixed(1)}px`);
    sc.set(t, (1 + 0.06 * h + (hsh(seed, k * 3 + 9) - 0.5) * 0.006 * base).toFixed(4));
  }
}
/* cortes de toma dentro de la escena: otra toma (otro clip, otro punto, otro encuadre), a veces
   revelada por un agujero de papel rasgado que se abre en dos cuadros */
const CLIPS = () => (C.media || []).map(m => m.id);
function tornHole(W, H, seed, f) {
  const cx = (0.25 + hsh(seed, 1) * 0.5) * W, cy = (0.3 + hsh(seed, 2) * 0.4) * H, rx = (0.35 + 0.65 * f) * W * 0.75, ry = (0.35 + 0.65 * f) * H * 0.85, pts = [];
  for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2, k = 0.78 + hsh(seed, 10 + i) * 0.32; pts.push(`${(cx + Math.cos(a) * rx * k).toFixed(1)}px ${(cy + Math.sin(a) * ry * k).toFixed(1)}px`); }
  return `polygon(${pts.join(", ")})`;
}
function bgCuts(X, L, d) {
  if (!(FX.cuts > 0) || d.light || d.paper || d.clip == null || d.cuts === false) return;
  const list = Array.isArray(d.cuts) ? d.cuts : (C.bgCuts || []).map(t => ({ t: t - TOFF - X.sc.t0 })).filter(c => c.t > 0.12 && c.t < X.dur - 0.1);
  const ids = CLIPS(); if (ids.length < 2) return;
  const cur = typeof d.clip === "string" ? d.clip : ids[d.clip % ids.length];
  let prevBox = null;
  list.forEach((c, i) => {
    const at = c.t ?? c.at, seed = Math.floor(hsh(Math.round((X.sc.t0 + at) * 100), 77) * 1e6);
    const id = c.clip ?? ids[(ids.indexOf(cur) + 1 + Math.floor(hsh(seed, 3) * (ids.length - 1))) % ids.length];
    const spec = (C.media || []).find(m => m.id === id) || 0;
    const box = mbox(X, L, spec, { left: 0, top: 0, width: X.W + "px", height: X.H + "px" }, { filter: d.grade === undefined ? "bw" : d.grade, off: c.off ?? hsh(seed, 4) * 6 });
    const z = c.zoom ?? 1.04 + hsh(seed, 5) * 0.35;
    box.el.style.transform = `scale(${z.toFixed(3)})${hsh(seed, 6) < 0.3 ? " scaleX(-1)" : ""}`;
    box.el.style.objectPosition = `${(hsh(seed, 7) * 100).toFixed(0)}% ${(30 + hsh(seed, 8) * 40).toFixed(0)}%`;
    if (L.children[1]) L.insertBefore(box.box, L.children[1 + i]); /* debajo de niebla, viñeta, bordes y letra */
    box.box.style.visibility = "hidden"; visTo(X, box.box, at, c.until);
    if ((c.tear ?? (hsh(seed, 9) < 0.45))) {
      const cp = X.T(box.box, "clipPath", tornHole(X.W, X.H, seed, 0.25), true);
      cp.set(at + STEP, tornHole(X.W, X.H, seed, 0.6)).set(at + STEP * 2, "none");
    }
    prevBox = box;
  });
}
/* barrido scan corto al final de la escena (la mayoría de los cortes de la referencia) */
function endScan(X, L, d) {
  const p = d.endScan ?? FX.endScan;
  if (!(p > 0) || X.dur < 0.5 || X.sc.kind === "outro") return;
  if (hsh(Math.round(X.sc.t0 * 100), 5) > p) return;
  PIECE.glitch(X, L, { at: X.dur - 0.12, d: 0.12, n: 4, redP: 0.5 });
}
/* bordes de papel que tiemblan: 3 recortes alternados */
function boilEdges(X, L) {
  if (!(FX.boil > 0)) return;
  for (const patch of L.querySelectorAll(":scope > .patch[data-edge]")) {
    const vs = JSON.parse(patch.dataset.edge); if (vs.length < 2) continue;
    const tr = X.T(patch, "clipPath", vs[0], true), seed = Math.floor(X.r() * 1e6);
    for (let k = 0, t = 0; t < X.dur + 0.05; k++, t += STEP * 1.5) tr.set(t, vs[Math.floor(hsh(seed, k) * vs.length)]);
  }
}

/* ---------------- escena dirigida ---------------- */
const shiftTimes = (o, dt) => {
  if (Array.isArray(o)) return o.map(v => shiftTimes(v, dt));
  if (!o || typeof o !== "object") return o;
  const out = {};
  for (const [k, v] of Object.entries(o)) {
    if (["at", "until", "ls2at", "delay"].includes(k) && typeof v === "number") out[k] = v + dt;
    else if (k === "wt" && Array.isArray(v)) out[k] = v.map(x => x + dt);
    else if (k === "at" && Array.isArray(v)) out[k] = v.map(x => x + dt);
    else if (typeof v === "object") out[k] = shiftTimes(v, dt);
    else out[k] = v;
  }
  return out;
};
const expandPieces = d => {
  const out = [];
  for (const u of d.use || []) {
    const ps = (C.defs && C.defs[u.def]) || [];
    for (const p of ps) { let q = shiftTimes(p, u.dt || 0); if (u.set) q = { ...q, ...u.set }; if (u.ids) q = { ...q, id: q.id && u.ids ? q.id : q.id }; out.push(q); }
  }
  return out.concat(d.pieces || []);
};
const fromEnd = (o, dur) => {
  if (Array.isArray(o)) return o.map(v => fromEnd(v, dur));
  if (!o || typeof o !== "object") return o;
  const out = {};
  for (const [k, v] of Object.entries(o)) out[k] = (["at", "until"].includes(k) && typeof v === "number" && v < 0) ? Math.max(0, dur + v) : typeof v === "object" ? fromEnd(v, dur) : v;
  return out;
};
B.compose = (sc, X) => {
  const d = sc.def, bg = d.bg || {}, L = bgScene(X, bg);
  X.ids = {};
  bgCuts(X, L, bg);
  boilEdges(X, L);
  const G = div(L, "lay", { zIndex: 20 });   /* letra y tiza: tiemblan juntas sobre el metraje */
  for (const p0 of expandPieces(d)) {
    const p = fromEnd(p0, X.dur);
    const f = PIECE[p.k || "text"];
    if (!f) { console.warn(`[${NAME}] pieza desconocida`, p.k); continue; }
    try { f(X, p.k === "glitch" || p.k === "paper" && p.under ? L : G, p); } catch (e) { console.warn(`[${NAME}] pieza fallo`, p.k, e); }
  }
  shake(X, G, d.fx || {});
  textures(X, L);
  endScan(X, L, d);
};
/* outro elegido: config.outro.version (v1|v2) o ?outro=v1|v2 en la URL */
const outroVersion = () => { const q = QS.get("outro"); return q === "v1" || q === "v2" ? q : (C.outro && C.outro.version === "v2" ? "v2" : "v1"); };
const outroOn = () => C.outro && C.outro.enabled !== false && C.outroDesigns && C.outroDesigns[outroVersion()];
/* entrada de la línea de tiempo → escena. type "intro": la escena de apertura con el título;
   type "outro": se sustituye por config.outroDesigns[v1|v2] (si el outro está apagado se
   dibujan las piezas propias de la entrada). */
function sceneOf(s, i, t0, t1) {
  let def = s, kind = "lyric";
  if (s.type === "intro" && introOn()) kind = "intro";
  if (s.type === "outro" && outroOn()) { def = { ...C.outroDesigns[outroVersion()], name: s.name }; kind = "outro"; }
  return { idx: i, t0, t1: Math.max(t0 + 0.05, t1), dur: Math.max(0.05, t1 - t0), kind, seg: { text: s.name || "" }, words: [], type: "compose", def,
           slot: { type: "compose", media: def.bg && def.bg.clip != null ? [def.bg.clip] : [], trans: s.tr } };
}
function explicitTimeline(dur) {
  const T = C.timeline;
  return T.map((s, i) => {
    const t0 = i === 0 ? 0 : Math.max(0, s.t0 - TOFF);
    const next = T[i + 1];
    const t1 = Math.min(dur, (s.t1 ?? (next ? next.t0 : dur + TOFF)) - TOFF);
    return sceneOf(s, i, t0, t1);
  });
}
/* galería: ?only=<componente> monta una sola escena desde 0 (ver showcase/components.json) */
function onlyTimeline(only, dur) {
  let p = {}; try { p = JSON.parse(QS.get("p") || "{}") || {}; } catch (e) { console.warn(`[${NAME}] p inválido`); }
  const T = C.timeline || [], short = only.replace(/^grunge-montage\./, "");
  for (const k of ["title", "artist"]) if (typeof p[k] === "string") { C.intro[k] = p[k]; C.intro.enabled = true; }
  for (const k of ["title", "sub", "feats"]) if (typeof p[k] === "string") C.outro[k] = p[k];
  let src;
  if (short === "intro") { src = T.find(s => s.type === "intro"); if (!String(C.intro.title || "").trim()) C.intro.title = "Título de la canción"; }
  else if (short === "outrov1" || short === "outrov2") { C.outro.version = short.slice(-2); C.outro.enabled = true; src = T.find(s => s.type === "outro") || { type: "outro", t0: 0, t1: 4 }; }
  else src = T.find(s => s.name === (p.scene || "s10")) || T[0];
  if (!src) return [];
  const len = Math.min(dur, p.duration ?? ((src.t1 ?? src.t0 + 3) - src.t0));
  return [sceneOf(src, 0, 0, len)];
}
function makeTimeline(segs, dur) {
  if (QS.get("only")) return onlyTimeline(QS.get("only"), dur);
  return C.timeline && C.timeline.length ? explicitTimeline(dur) : lyricTimeline(segs, dur, FITS);
}
B.intro = B.slam;
B.outro = B.slam;
