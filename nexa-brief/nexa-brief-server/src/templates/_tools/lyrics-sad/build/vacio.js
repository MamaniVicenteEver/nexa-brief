/* ========================= ESCENAS · lyrics-vacio =========================
   Soledad y vacío: blanco y negro frío con niebla (ruta perdida, camino en
   la bruma, cuarto vacío, figura frente al mar, nieve, ventana). Tipografía
   condensada (Big Shoulders) muy fina o muy pesada + sans liviana. Las letras
   se separan hasta perderse, se desmoronan con gravedad, dejan estelas de
   eco, se reflejan en la niebla; la pantalla se rasga en dos; en el negro
   total una sola palabra respira. Transiciones: iris, glitch, persiana,
   alejamiento, fundido. */
const thin = "th", heavy = "hv", sans = "in";
function cold(X, L, a = 0.82) { vignette(L, a, 30); tint(L, "#0B1116", 0.25); }

const B = {};

/* 1. soledad: metraje a pantalla completa; frase gigante y finísima cuyas letras se separan */
B.lonely = (sc, X) => {
  const { W, H } = X, L = div(X.root, "lay", { background: P.black });
  footage(X, L, 0, "mist", { from: 1.14, to: 1.02 }); cold(X, L); fog(X, L, 2, 0.12);
  const s = U(J(sc.words)), fs = Math.min(fit(s, thin, 0.05, 0.92 * W, 0.3 * H), 0.3 * H);
  const t = line(X, L, sc.words.map(w => ({ ...w, text: U(w.text) })), { cls: thin, fs, x: W / 2, y: 0.5 * H, color: P.white, ls: 0.05 }, "blur");
  X.T(t.el, "letterSpacing", "0.05em").to(0, X.dur + OV(), "0.22em", "cubic-bezier(.3,.1,.4,1)");
  leave(X, t.box, "blur");
  enterFx(X, pickTrans(X), OV());
};

/* 2. derrumbe: negro, palabra pesada que se desmorona letra a letra */
B.crumble = (sc, X) => {
  const { W, H } = X, L = div(X.root, "lay", { background: P.black });
  fog(X, L, 2, 0.06);
  const hi = heroIdx(sc.words), hero = sc.words[hi];
  const fs = fit(U(hero.text), heavy, 0.01, 0.84 * W, 0.46 * H);
  const t = lineNested(X, L, [{ ...hero, rt: Math.max(0.02, sc.words[0].rt) }], { cls: heavy, fs, x: W / 2, y: 0.46 * H, color: P.white, ls: 0.01, revealSec: 0.8 }, "rise");
  crumble(X, t.chars, Math.max(hero.rt + 0.6, X.dur * 0.5), Math.max(0.5, X.dur * 0.3));
  const rest = sc.words.filter((_, i) => i !== hi);
  if (rest.length) line(X, L, rest, { cls: sans, fs: Math.min(0.05 * H, fit(U(J(rest)), sans, 0.4, 0.8 * W, 1e9)), x: W / 2, y: 0.46 * H + fs * 0.62, color: P.white, ls: 0.4 }, "fade");
  enterFx(X, pickTrans(X), OV());
};

/* 3. estela: la frase deja copias que se quedan atrás (eco de movimiento) */
B.trail = (sc, X) => {
  const { W, H } = X, L = div(X.root, "lay", { background: P.black });
  footage(X, L, 0, "bw", { opacity: 0.4 }); cold(X, L);
  const s = U(J(sc.words)), fs = Math.min(fit(s, heavy, 0.02, 0.7 * W, 0.17 * H), 0.17 * H), n = 6, drift = 0.12 * W;
  for (let i = n; i >= 0; i--) {
    const t = i === 0 ? line(X, L, sc.words.map(w => ({ ...w, text: U(w.text) })), { cls: heavy, fs, x: W / 2, y: 0.5 * H, color: P.white, ls: 0.02 }, "blur")
                      : word(X, L, s, { cls: heavy, fs, x: W / 2, y: 0.5 * H, color: "transparent", ls: 0.02 });
    if (i) { t.el.style.webkitTextStroke = `${Math.max(1, X.u)}px rgba(220,224,226,${(0.5 - i * 0.07).toFixed(2)})`; reveal(X, t.el, Math.max(0.05, sc.words[0].rt) + i * 0.05, "fade", 0.6); }
    /* cada copia llega con retraso → estela */
    X.T(t.el, "transform", `translateX(${-drift}px)`).to(i * 0.09, X.dur + OV(), `translateX(${drift * (1 - i * 0.12)}px)`, "cubic-bezier(.25,.1,.25,1)");
    leave(X, t.box, "fade");
  }
  enterFx(X, pickTrans(X), OV());
};

/* 4. espejo: niebla y horizonte; la frase sobre el horizonte con su reflejo desvaneciéndose */
B.mirror = (sc, X) => {
  const { W, H, u } = X, L = div(X.root, "lay", { background: P.black });
  footage(X, L, 0, "mist"); cold(X, L, 0.7); fog(X, L, 3, 0.15);
  const s = U(J(sc.words)), fs = Math.min(fit(s, thin, 0.18, 0.84 * W, 0.12 * H), 0.12 * H), y = 0.52 * H;
  const hz = div(L, "patch", { left: 0, top: y + fs * 0.52 + "px", width: W + "px", height: Math.max(1, u) + "px", background: "rgba(230,232,234,0.35)", transformOrigin: "50% 50%" });
  X.T(hz, "transform", "scaleX(0)").to(0.1, 1.2, "scaleX(1)", EASE_OUT);
  const t = line(X, L, sc.words.map(w => ({ ...w, text: U(w.text) })), { cls: thin, fs, x: W / 2, y, color: P.white, ls: 0.18 }, "blur");
  const rf = word(X, L, s, { cls: thin, fs, x: W / 2, y: y + fs * 1.04, color: P.white, ls: 0.18 });
  rf.box.style.transform += " scaleY(-1)";
  Object.assign(rf.el.style, { opacity: "0.25", filter: "blur(3px)", webkitMaskImage: "linear-gradient(to top, #000, transparent 70%)" });
  reveal(X, rf.el, Math.max(0.1, sc.words[sc.words.length - 1].rt), "fade", 1.2);
  leave(X, t.box, "blur"); leave(X, rf.box, "blur");
  enterFx(X, pickTrans(X), OV());
};

/* 5. respiración: negro total, una palabra chica que crece y late; el resto como susurro */
B.breath = (sc, X) => {
  const { W, H } = X, L = div(X.root, "lay", { background: "#000" });
  const hi = heroIdx(sc.words), hero = sc.words[hi];
  const fs = Math.min(fit(U(hero.text), heavy, 0.04, 0.5 * W, 0.2 * H), 0.2 * H);
  const g = div(L, "lay");
  X.T(g, "transform", "scale(0.7)").to(0, X.dur + OV(), "scale(1.15)", "cubic-bezier(.3,.1,.3,1)");
  const inner = div(g, "lay"); heartbeat(X, inner, 1.5, 0.03);
  const t = word(X, inner, U(hero.text), { cls: heavy, fs, x: W / 2, y: H / 2, color: P.white, ls: 0.04 });
  reveal(X, t.el, Math.max(0.02, sc.words[0].rt), "blur", 1.4);
  const rest = sc.words.filter((_, i) => i !== hi);
  if (rest.length) line(X, L, rest, { cls: sans, fs: Math.min(0.045 * H, fit(U(J(rest)), sans, 0.45, 0.8 * W, 1e9)), x: W / 2, y: 0.76 * H, color: P.white, ls: 0.45 }, "blur");
  leave(X, t.box, "blur");
  enterFx(X, pickTrans(X), OV());
};

/* 6. fragmentos: las palabras quedan sueltas por la pantalla, unidas por un hilo que se dibuja */
B.fragments = (sc, X) => {
  const { W, H, u } = X, L = div(X.root, "lay", { background: P.black });
  footage(X, L, 0, "bw", { opacity: 0.28 }); cold(X, L);
  const n = sc.words.length, pts = [];
  sc.words.forEach((w, i) => {
    const x = (0.18 + ((i * 0.41 + X.r() * 0.2) % 0.64)) * W, y = (0.18 + (i / Math.max(1, n - 1)) * 0.64 + (X.r() - 0.5) * 0.05) * H;
    const fs = (w.text.length > 3 && !isStop(w) ? 0.12 : 0.065) * H;
    const t = word(X, L, U(w.text), { cls: isStop(w) ? sans : heavy, fs, x, y, color: P.white, ls: isStop(w) ? 0.4 : 0.03 });
    reveal(X, t.el, Math.max(0.02, w.rt), "blur", 0.7); leave(X, t.box, "blur");
    pts.push([x, y, Math.max(0.02, w.rt)]);
  });
  const svg = doc.createElementNS(SVGNS, "svg"); svg.setAttribute("width", W); svg.setAttribute("height", H);
  svg.style.cssText = "position:absolute;left:0;top:0;overflow:visible;pointer-events:none";
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1, at] = pts[i];
    const p = doc.createElementNS(SVGNS, "line");
    Object.entries({ x1: x0, y1: y0, x2: x1, y2: y1, stroke: "rgba(220,224,226,0.35)", "stroke-width": Math.max(1, u), pathLength: 1, "stroke-dasharray": "1 1", "stroke-dashoffset": 1 }).forEach(([k, v]) => p.setAttribute(k, v));
    svg.appendChild(p); X.T(p, "strokeDashoffset", "1").to(at - 0.1, 0.4, "0", EASE_OUT);
  }
  L.appendChild(svg); leave(X, svg, "fade");
  enterFx(X, pickTrans(X), OV());
};

/* 7. desgarro: la imagen se rasga horizontalmente y en la grieta aparece la frase */
B.tear = (sc, X) => {
  const { W, H } = X, L = div(X.root, "lay", { background: "#000" });
  const s = U(J(sc.words)), fs = Math.min(fit(s, heavy, 0.04, 0.8 * W, 0.12 * H), 0.12 * H);
  const t = line(X, L, sc.words.map(w => ({ ...w, text: U(w.text) })), { cls: heavy, fs, x: W / 2, y: 0.5 * H, color: P.white, ls: 0.04 }, "rise");
  leave(X, t.box, "blur");
  const tt = Math.max(0.15, Math.min(sc.words[0].rt - 0.25, 0.8)), gap = fs * 0.9;
  for (const [clip, dir] of [["inset(0% 0% 50% 0%)", -1], ["inset(50% 0% 0% 0%)", 1]]) {
    const half = div(L, "lay", { clipPath: clip });
    footage(X, half, 0, "mist", { off: 1 }); cold(X, half);
    X.T(half, "transform", "translateY(0px)").to(tt, 0.6, `translateY(${dir * gap}px)`, "cubic-bezier(.2,.9,.2,1)")
      .to(tt + 0.6, Math.max(0.3, X.dur + OV() - tt - 0.6), `translateY(${dir * gap * 1.25}px)`);
    const edge = div(half, "patch", { left: 0, top: (dir < 0 ? 0.5 * H - 2 : 0.5 * H) + "px", width: W + "px", height: "2px", background: "rgba(255,255,255,0.6)" });
  }
  enterFx(X, pickTrans(X), OV());
};

/* 8. nieve: nieve cayendo, letras que bajan suaves hasta su lugar */
B.snow = (sc, X) => {
  const { W, H } = X, L = div(X.root, "lay", { background: P.black });
  footage(X, L, 0, "mist"); cold(X, L);
  motes(X, L, 50, { dir: 1, size: 3, color: "rgba(235,238,240,0.7)", dist: 0.5, sway: 70 });
  const ls = rows(sc.words, sc.words.length > 4 ? 2 : 1);
  const fs = Math.min(...ls.map(l => fit(U(J(l)), thin, 0.12, 0.84 * W, 0.15 * H)));
  ls.forEach((l, i) => {
    const t = word(X, L, U(J(l)), { cls: thin, fs, x: W / 2, y: H / 2 + (i - (ls.length - 1) / 2) * fs * 1.08, color: P.white, ls: 0.12, split: "chars" });
    let wi = 0;
    t.chars.forEach((c, k) => { if (c.textContent === " ") { wi++; return; } const at = Math.max(0.02, l[wi]?.rt ?? 0) + (k % 5) * 0.05;
      X.T(c, "opacity", "0").to(at, 0.7, "1", EASE_OUT); X.T(c, "transform", `translateY(${-(40 + X.r() * 80)}%) rotate(${((X.r() - 0.5) * 30).toFixed(0)}deg)`).to(at, 1.1, "translateY(0%) rotate(0deg)", EASE_OUT); });
    leave(X, t.box, "blur");
  });
  enterFx(X, pickTrans(X), OV());
};

B.intro = (sc, X) => {
  const { W, H } = X, L = div(X.root, "lay", { background: "#000" });
  footage(X, L, 0, "mist", { opacity: 0.6, from: 1.25, to: 1.0 }); cold(X, L); fog(X, L, 3, 0.15);
  const [a, b] = sc.words;
  if (a) { const t = word(X, L, U(a.text), { cls: thin, fs: 0.2 * H, x: W / 2, y: 0.47 * H, color: P.white, ls: 0.1 }); reveal(X, t.el, a.rt + 0.8, "blur", 2.4); X.T(t.el, "letterSpacing", "0.1em").to(0, X.dur + OV(), "0.4em"); leave(X, t.box, "blur"); }
  if (b) { const t = word(X, L, U(b.text), { cls: sans, fs: 0.03 * H, x: W / 2, y: 0.62 * H, color: P.fog, ls: 0.6 }); reveal(X, t.el, b.rt + 1.4, "fade", 1.5); }
  enterFx(X, "fade", 1.5);
};
B.outro = (sc, X) => {
  const { W, H } = X, L = div(X.root, "lay", { background: "#000" });
  footage(X, L, 0, "mist", { opacity: 0.45 }); cold(X, L);
  const [a, b, c] = sc.words;
  if (a) { const t = lineNested(X, L, [{ ...a, text: U(a.text) }], { cls: heavy, fs: 0.2 * H, x: W / 2, y: 0.42 * H, color: P.white }, "blur"); crumble(X, t.chars, Math.max(a.rt + 1.8, X.dur - 1.3), 0.8); }
  if (b) { const t = word(X, L, U(b.text), { cls: sans, fs: 0.033 * H, x: W / 2, y: 0.58 * H, color: P.fog, ls: 0.6 }); reveal(X, t.el, b.rt, "fade", 1); }
  if (c) { const t = word(X, L, U(c.text), { cls: sans, fs: 0.024 * H, x: W / 2, y: 0.64 * H, color: P.fog, ls: 0.4 }); reveal(X, t.el, c.rt, "fade", 1); }
  enterFx(X, "iris", OV() * 1.6);
};

const FITS = {
  lonely: sc => J(sc.words).length <= 30,
  crumble: sc => sc.words[heroIdx(sc.words)].text.length <= 10 && sc.dur > 1.4,
  trail: sc => J(sc.words).length <= 28,
  mirror: sc => J(sc.words).length <= 34,
  breath: sc => sc.dur > 1.5,
  fragments: sc => sc.words.length >= 3 && sc.words.length <= 8,
  tear: sc => J(sc.words).length <= 34,
  snow: sc => J(sc.words).length <= 40
};
function makeTimeline(segs, dur) { return lyricTimeline(segs, dur, FITS); }
