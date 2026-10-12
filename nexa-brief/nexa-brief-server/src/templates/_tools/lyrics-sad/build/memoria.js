/* ======================== ESCENAS · lyrics-memoria ========================
   Recuerdos que se desvanecen: películas caseras (8 mm / VHS) en sepia
   lavado, polaroids que caen, proyector que titila, fecha VHS en la esquina,
   máquina de escribir que escribe y BORRA la letra, letra manuscrita que se
   desvanece, destellos de luz cálida (light leaks), rayas de película y
   quemado del fotograma. Paleta: crema, sepia, rosa polvoriento, marrón
   oscuro, naranja VHS apagado. Transiciones: quemado, desenfoque, flash
   cálido, glitch VHS. */
const tw = "tw", hw = "hw", vhs = "vh";
const MONTHS = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

/* ---------------- capas de "recuerdo" ---------------- */
function oldFilm(X, L, o = {}) {
  const { W, H, u, r } = X, T = X.dur + OV();
  tint(L, P.sepia, 0.22, "soft-light");
  vignette(L, 0.8, 34);
  /* rayas y motas de película que saltan cuadro a cuadro */
  for (let i = 0; i < (o.scratches ?? 3); i++) {
    const s = div(L, "patch", { left: r() * W + "px", top: 0, width: Math.max(1, u * (0.6 + r())) + "px", height: H + "px", background: "rgba(240,230,210,0.35)" });
    const tr = X.T(s, "transform", "translateX(0px)", true), op = X.T(s, "opacity", "0", true);
    for (let t = 0; t < T; t += 0.08 + r() * 0.2) { tr.set(t, `translateX(${((r() - 0.5) * 0.3 * W).toFixed(0)}px)`); op.set(t, r() < 0.45 ? (0.3 + r() * 0.6).toFixed(2) : "0"); }
  }
  /* destello de luz cálida que cruza */
  if (o.leak !== false) {
    const lk = div(L, "lay", { background: `radial-gradient(ellipse 45% 70% at 50% 50%, rgba(255,150,70,0.55) 0%, rgba(255,90,60,0.25) 35%, transparent 70%)`, mixBlendMode: "screen", pointerEvents: "none" });
    const at = r() * Math.max(0.2, X.dur - 1.6), side = r() < 0.5 ? -1 : 1;
    X.T(lk, "transform", `translateX(${side * 0.75 * W}px)`).to(at, 1.8, `translateX(${-side * 0.75 * W}px)`, EASE_IO);
    X.T(lk, "opacity", "0").to(at, 0.6, "1").to(at + 1.2, 0.6, "0");
  }
  /* parpadeo de exposición */
  if (o.flicker !== false) { const fl = div(L, "lay", { background: "#fff3dc", mixBlendMode: "overlay", pointerEvents: "none" }), tr = X.T(fl, "opacity", "0", true); for (let t = 0; t < T; t += 0.1) tr.set(t, (r() * 0.12).toFixed(3)); }
}
/* gate weave: el fotograma tiembla como en el proyector */
function weave(X, el, amp = 1) {
  const tr = X.T(el, "transform", "translate(0px, 0px)", true), T = X.dur + OV();
  for (let t = 0; t < T; t += 1 / 12) tr.set(t, `translate(${((X.r() - 0.5) * 2 * amp * X.u).toFixed(1)}px, ${((X.r() - 0.5) * 3 * amp * X.u).toFixed(1)}px)`);
}
function vhsHud(X, L) {
  const { W, H, u, r, sc } = X;
  const y = 2006 + Math.floor(r() * 6), d = 1 + Math.floor(r() * 28), m = MONTHS[Math.floor(r() * 12)], hh = 1 + Math.floor(r() * 11), mm = Math.floor(r() * 60);
  const c = P.vhs, f = 26 * u;
  const play = word(X, L, "▶ PLAY", { cls: vhs, fs: f, x: 0.05 * W, y: 0.09 * H, ax: 0, color: c });
  const bl = X.T(play.el, "opacity", "1", true); for (let k = 0; k * 0.7 < X.dur + OV(); k++) bl.set(k * 0.7, k % 2 ? "0.35" : "1");
  word(X, L, `${hh < 10 ? "AM" : "PM"} ${String(hh).padStart(2, " ")}:${String(mm).padStart(2, "0")}`, { cls: vhs, fs: f, x: 0.05 * W, y: 0.86 * H, ax: 0, color: c });
  word(X, L, `${m}. ${String(d).padStart(2, "0")} ${y}`, { cls: vhs, fs: f, x: 0.05 * W, y: 0.92 * H, ax: 0, color: c });
  const sp = word(X, L, "SP", { cls: vhs, fs: f, x: 0.95 * W, y: 0.09 * H, ax: 1, color: c });
  /* barra de tracking que baja */
  const tb = div(L, "patch", { left: 0, top: 0, width: W + "px", height: 0.05 * H + "px", background: "linear-gradient(transparent, rgba(255,255,255,0.12), transparent)", pointerEvents: "none" });
  X.T(tb, "transform", `translateY(${-0.1 * H}px)`).to(0, X.dur + OV(), `translateY(${1.1 * H}px)`);
}
function polaroid(X, L, k, cx, cy, w, rot, o = {}) {
  const h = w * 1.18, pad = w * 0.06;
  const card = div(L, "patch", { left: cx - w / 2 + "px", top: cy - h / 2 + "px", width: w + "px", height: h + "px", background: P.cream, boxShadow: `0 ${12 * X.u}px ${40 * X.u}px rgba(0,0,0,0.55)`, transform: `rotate(${rot}deg)` });
  const ph = mbox(X, card, typeof k === "object" ? k : (o.still ? asStill(mediaSpec(X.sc, k)) : k), { left: pad + "px", top: pad + "px", width: w - 2 * pad + "px", height: w - 2 * pad + "px" }, { filter: "faded", off: X.r() * 3 });
  div(ph.box, "lay", { background: "radial-gradient(ellipse at 50% 50%, transparent 50%, rgba(60,40,20,0.45) 100%)" });
  return { card, ph, w, h, pad };
}

const B = {};

/* 1. polaroid: cae girando sobre la mesa; la frase manuscrita en el borde blanco */
B.polaroid = (sc, X) => {
  const { W, H } = X, L = div(X.root, "lay", { background: P.dark });
  footage(X, L, 1, "sepia", { opacity: 0.25 });
  const w = 0.32 * W, rot = (X.r() - 0.5) * 10, p = polaroid(X, L, 0, 0.5 * W, 0.47 * H, w, rot);
  X.T(p.card, "transform", `translate(${(X.r() - 0.5) * 0.3 * W}px, ${-0.9 * H}px) rotate(${rot - 25}deg)`).to(0, 0.9, `translate(0px, 0px) rotate(${rot}deg)`, "cubic-bezier(.2,.9,.25,1)")
    .to(0.9, X.dur + OV() - 0.9, `translate(0px, ${-0.02 * H}px) rotate(${rot + 1.5}deg) scale(1.04)`);
  const s = J(sc.words), fs = Math.min(fit(s, hw, 0, p.w - 2 * p.pad, (p.h - p.w) * 0.55), (p.h - p.w) * 0.5);
  const t = line(X, p.card, sc.words, { cls: hw, fs, x: p.w / 2, y: p.w + (p.h - p.w) / 2 - p.pad * 0.2, color: P.ink }, "fade");
  oldFilm(X, L, { scratches: 2 });
  enterFx(X, pickTrans(X), OV());
};

/* 2. video casero: metraje VHS a pantalla completa, máquina de escribir que escribe y borra */
B.homevideo = (sc, X) => {
  const { W, H } = X, L = div(X.root, "lay", { background: P.dark });
  const f = footage(X, L, 0, "faded"); weave(X, f.m.box, 0.6);
  oldFilm(X, L, { leak: X.r() < 0.6 });
  vhsHud(X, L);
  const s = J(sc.words), fs = Math.min(fit(s, tw, 0, 0.8 * W, 0.08 * H), 0.075 * H);
  const t = word(X, L, s, { cls: tw, fs, x: 0.1 * W, y: 0.72 * H, ax: 0, color: P.cream, split: "chars" });
  Object.assign(t.el.style, { textShadow: "0 2px 10px rgba(0,0,0,0.7)" });
  const at = Math.max(0.05, sc.words[0].rt), last = Math.max(at + 0.4, sc.words[sc.words.length - 1].rt + 0.4);
  typeErase(X, t, at, X.dur > last + 1.0 ? Math.max(last + 0.5, X.dur - 0.9) : null, { step: Math.min(0.065, (last - at) / Math.max(1, t.chars.length)), cursorColor: P.vhs });
  enterFx(X, pickTrans(X), OV());
};

/* 3. álbum: varias polaroids sobre la mesa, la cámara se desliza; frase a máquina al centro */
B.album = (sc, X) => {
  const { W, H } = X, L = div(X.root, "lay", { background: P.dark });
  const table = div(L, "lay");
  X.T(table, "transform", "translate(0px, 0px) scale(1.12)").to(0, X.dur + OV(), `translate(${-0.06 * W}px, ${-0.03 * H}px) scale(1.02)`);
  const spots = [[0.2, 0.3, -9], [0.52, 0.22, 6], [0.82, 0.34, -4], [0.3, 0.74, 7], [0.72, 0.76, -8]];
  spots.forEach(([x, y, rot], i) => {
    const p = polaroid(X, table, asStill((C.media || [])[(sc.idx + i) % C.media.length]), x * W, y * H, 0.2 * W, rot + (X.r() - 0.5) * 4);
    show(X, p.card, i * 0.12);
    X.T(p.card, "opacity", "0").to(i * 0.12, 0.5, i === 1 ? "1" : "0.75");
  });
  div(L, "lay", { background: "radial-gradient(ellipse at 50% 50%, rgba(20,14,10,0.35) 0%, rgba(20,14,10,0.85) 70%)" });
  const ls = rows(sc.words, sc.words.length > 4 ? 2 : 1);
  const fs = Math.min(...ls.map(l => fit(J(l), tw, 0, 0.78 * W, 0.11 * H)));
  ls.forEach((l, i) => { const t = line(X, L, l, { cls: tw, fs, x: W / 2, y: H / 2 + (i - (ls.length - 1) / 2) * fs * 1.15, color: P.cream }, "blur"); leave(X, t.box, "blur"); });
  oldFilm(X, L, { scratches: 2, leak: true });
  enterFx(X, pickTrans(X), OV());
};

/* 4. proyector: cuarto oscuro, rectángulo de luz con el metraje titilando, perforaciones */
B.projector = (sc, X) => {
  const { W, H, u } = X, L = div(X.root, "lay", { background: "#060403" });
  const fw = 0.62 * W, fh = fw * 0.66, fx = (W - fw) / 2, fy = 0.12 * H;
  const glow = div(L, "patch", { left: fx - 0.08 * W + "px", top: fy - 0.08 * H + "px", width: fw + 0.16 * W + "px", height: fh + 0.16 * H + "px", background: "radial-gradient(ellipse at 50% 50%, rgba(255,220,170,0.18), transparent 70%)" });
  const fr = div(L, "patch", { left: fx + "px", top: fy + "px", width: fw + "px", height: fh + "px", overflow: "hidden", borderRadius: `${6 * u}px` });
  mbox(X, fr, 0, { left: 0, top: 0, width: fw + "px", height: fh + "px" }, { filter: "sepia" });
  weave(X, fr, 1.2);
  const fl = X.T(fr, "opacity", "1", true); for (let t = 0; t < X.dur + OV(); t += 1 / 12) fl.set(t, (0.82 + X.r() * 0.18).toFixed(2));
  for (const side of [0, 1]) for (let i = 0; i < 9; i++)
    div(L, "patch", { left: (side ? fx + fw + 0.012 * W : fx - 0.03 * W) + "px", top: fy + i * fh / 9 + fh / 36 + "px", width: 0.018 * W + "px", height: fh / 18 + "px", background: "#1d1712", borderRadius: `${2 * u}px` });
  oldFilm(X, L, { leak: false, scratches: 2 });
  const s = J(sc.words), fs = Math.min(fit(s, tw, 0, 0.78 * W, 0.07 * H), 0.065 * H);
  const t = line(X, L, sc.words, { cls: tw, fs, x: W / 2, y: fy + fh + 0.12 * H, color: P.cream }, "flicker");
  leave(X, t.box, "blur");
  enterFx(X, pickTrans(X), OV());
};

/* 5. papel crema: la frase manuscrita aparece y se va borrando letra a letra (el recuerdo se va) */
B.fading = (sc, X) => {
  const { W, H } = X, L = div(X.root, "lay", { background: P.cream });
  div(L, "lay", { background: "radial-gradient(ellipse at 50% 40%, rgba(255,250,235,0.6), rgba(140,110,80,0.35) 100%)" });
  const ls = rows(sc.words, sc.words.length > 4 ? 2 : 1);
  const fs = Math.min(...ls.map(l => fit(J(l), hw, 0, 0.78 * W, 0.2 * H)));
  ls.forEach((l, i) => {
    const t = lineNested(X, L, l, { cls: hw, fs, x: W / 2, y: H / 2 + (i - (ls.length - 1) / 2) * fs * 1.05, color: P.ink, revealSec: 0.8 }, "fade");
    const t0 = Math.max(l[l.length - 1].rt + 0.9, X.dur * 0.55);
    t.chars.forEach(c => { const at = t0 + X.r() * Math.max(0.6, X.dur - t0); X.T(c, "opacity", "1").to(at, 0.8, "0"); X.T(c, "filter", "blur(0px)").to(at, 0.8, "blur(5px)"); });
  });
  /* manchas de tinta / humedad */
  for (let i = 0; i < 3; i++) div(L, "patch", { left: X.r() * W + "px", top: X.r() * H + "px", width: (0.1 + X.r() * 0.2) * W + "px", height: (0.1 + X.r() * 0.2) * W + "px", borderRadius: "50%", background: "radial-gradient(circle, rgba(120,90,60,0.18), transparent 70%)" });
  tint(L, P.sepia, 0.12, "multiply"); vignette(L, 0.5, 45);
  enterFx(X, pickTrans(X), OV());
};

/* 6. quemado: el fotograma se derrite desde el centro (agujero que crece con borde
   incandescente) y deja ver la frase sobre negro */
B.filmBurn = (sc, X) => {
  const { W, H } = X, L = div(X.root, "lay", { background: "#050302" });
  const ls = rows(sc.words, sc.words.length > 4 ? 2 : 1);
  const fs = Math.min(...ls.map(l => fit(J(l), tw, 0, 0.78 * W, 0.12 * H)));
  ls.forEach((l, i) => line(X, L, l, { cls: tw, fs, x: W / 2, y: H / 2 + (i - (ls.length - 1) / 2) * fs * 1.15, color: P.cream }, "blur"));
  const top = div(L, "lay"); const f = footage(X, top, 0, "faded"); weave(X, f.m.box, 0.7);
  oldFilm(X, top, { leak: false });
  const tb = Math.max(0.3, Math.min(sc.words[0].rt - 0.5, X.dur * 0.35)), d = 0.9;
  const cx = 40 + X.r() * 20, cy = 40 + X.r() * 20;
  X.T(top, "webkitMaskImage", `radial-gradient(circle at ${cx}% ${cy}%, transparent 0%, #000 0.5%)`).to(tb, d, `radial-gradient(circle at ${cx}% ${cy}%, transparent 85%, #000 90%)`, EASE_IN);
  const ring = div(L, "lay", { background: `radial-gradient(circle at ${cx}% ${cy}%, transparent 0%, rgba(255,170,80,0.0) 0%, rgba(255,170,80,0) 1%)`, mixBlendMode: "screen", pointerEvents: "none" });
  X.T(ring, "background", `radial-gradient(circle at ${cx}% ${cy}%, transparent 0%, rgba(255,190,110,0.95) 0.5%, rgba(255,90,30,0) 3%)`)
    .to(tb, d, `radial-gradient(circle at ${cx}% ${cy}%, transparent 84%, rgba(255,190,110,0.95) 85%, rgba(255,90,30,0) 90%)`, EASE_IN);
  X.T(ring, "opacity", "0", true).set(tb, "1").set(tb + d, "0");
  enterFx(X, pickTrans(X), OV());
};

/* 7. doble exposición: dos recuerdos superpuestos (screen), frase grande a máquina */
B.double = (sc, X) => {
  const { W, H } = X, L = div(X.root, "lay", { background: P.dark });
  footage(X, L, 0, "sepia");
  const b = footage(X, L, 1, "faded", { from: 1.2, to: 1.05, off: 2 }); b.box.style.mixBlendMode = "screen"; b.box.style.opacity = "0.55";
  oldFilm(X, L);
  const ls = rows(sc.words, sc.words.length > 3 ? 2 : 1);
  const fs = Math.min(...ls.map(l => fit(U(J(l)), tw, 0.08, 0.84 * W, 0.16 * H)));
  ls.forEach((l, i) => {
    const t = line(X, L, l.map(w => ({ ...w, text: U(w.text) })), { cls: tw, fs, x: W / 2, y: H / 2 + (i - (ls.length - 1) / 2) * fs * 1.08, color: P.cream, ls: 0.08 }, "blur");
    t.el.style.mixBlendMode = "overlay"; leave(X, t.box, "blur");
  });
  enterFx(X, pickTrans(X), OV());
};

/* 8. tarjeta de fecha: negro, fecha VHS grande que se escribe y la frase debajo */
B.dateCard = (sc, X) => {
  const { W, H, u } = X, L = div(X.root, "lay", { background: "#070605" });
  const y = 2006 + Math.floor(X.r() * 6), m = MONTHS[Math.floor(X.r() * 12)], d = String(1 + Math.floor(X.r() * 28)).padStart(2, "0");
  const dt = word(X, L, `${m}. ${d} ${y}`, { cls: vhs, fs: 0.16 * H, x: W / 2, y: 0.4 * H, color: P.vhs, split: "chars" });
  dt.chars.forEach((c, i) => show(X, c, 0.1 + i * 0.07));
  const s = J(sc.words), fs = Math.min(fit(s, tw, 0, 0.8 * W, 0.07 * H), 0.06 * H);
  const t = line(X, L, sc.words, { cls: tw, fs, x: W / 2, y: 0.6 * H, color: P.cream }, "type");
  for (let i = 0; i < 40; i++) div(L, "patch", { left: 0, top: i * H / 40 + "px", width: W + "px", height: Math.max(1, u) + "px", background: "rgba(255,255,255,0.03)" });
  leave(X, t.box, "fade");
  enterFx(X, pickTrans(X), OV());
};

/* intro / cierre */
B.intro = (sc, X) => {
  const { W, H } = X, L = div(X.root, "lay", { background: "#050302" });
  const f = footage(X, L, 0, "sepia", { opacity: 0.5 }); weave(X, f.m.box, 0.8); oldFilm(X, L);
  const [a, b] = sc.words;
  if (a) { const t = word(X, L, a.text, { cls: hw, fs: 0.16 * H, x: W / 2, y: 0.46 * H, color: P.cream }); reveal(X, t.el, a.rt + 0.6, "blur", 2.2); leave(X, t.box, "blur"); }
  if (b) { const t = word(X, L, U(b.text), { cls: tw, fs: 0.035 * H, x: W / 2, y: 0.6 * H, color: P.sepia, ls: 0.3 }); reveal(X, t.el, b.rt + 1.2, "fade", 1.5); }
  enterFx(X, "fade", 1.2);
};
B.outro = (sc, X) => {
  const { W, H } = X, L = div(X.root, "lay", { background: "#050302" });
  const p = polaroid(X, L, 0, 0.5 * W, 0.42 * H, 0.26 * W, -3);
  X.T(p.card, "opacity", "0").to(0.2, 1.2, "1");
  oldFilm(X, L);
  const [a, b, c] = sc.words;
  if (a) { const t = word(X, L, a.text, { cls: hw, fs: (p.h - p.w) * 0.55, x: p.w / 2, y: p.w + (p.h - p.w) / 2, color: P.ink }); p.card.appendChild(t.box); reveal(X, t.el, a.rt + 0.5, "fade", 1); }
  if (b) { const t = word(X, L, U(b.text), { cls: tw, fs: 0.035 * H, x: W / 2, y: 0.84 * H, color: P.cream, ls: 0.3 }); reveal(X, t.el, b.rt + 0.6, "fade", 1); }
  if (c) { const t = word(X, L, c.text, { cls: tw, fs: 0.025 * H, x: W / 2, y: 0.9 * H, color: P.sepia, ls: 0.15 }); reveal(X, t.el, c.rt + 0.6, "fade", 1); }
  enterFx(X, "burn", OV() * 1.6);
};

const FITS = {
  polaroid: sc => J(sc.words).length <= 36,
  homevideo: sc => J(sc.words).length <= 44,
  album: sc => J(sc.words).length <= 46,
  projector: sc => J(sc.words).length <= 44,
  fading: sc => J(sc.words).length <= 40,
  filmBurn: sc => J(sc.words).length <= 40 && sc.dur > 1.6,
  double: sc => J(sc.words).length <= 28,
  dateCard: sc => J(sc.words).length <= 44
};
function makeTimeline(segs, dur) { return lyricTimeline(segs, dur, FITS); }
