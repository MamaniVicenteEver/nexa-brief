/* ======================== ESCENAS · lyrics-ceniza ========================
   Desamor que se quema: carbón, ceniza y hueso con brasas moribundas. Serif
   dramática (Playfair Display) + mono fina. Las palabras aparecen al rojo y
   se enfrían, arden y estallan en fragmentos de ceniza que suben, se
   deshacen en humo, una vela se apaga con la frase, un diario arde, la
   palabra se agrieta en dos (corazón roto). Ceniza cayendo, brasas subiendo.
   Transiciones: quemado con borde incandescente, mancha de humo, flash brasa,
   disolvencia desenfocada. */
const ser = "pf", mono = "mn";
function ashLayer(X, L) {
  motes(X, L, 26, { dir: 1, size: 2.4, color: ["rgba(170,165,160,0.55)", "rgba(120,115,110,0.5)"], dist: 0.35, sway: 80, square: true });
  motes(X, L, 14, { dir: -1, size: 2.2, color: ["rgba(240,140,70,0.85)", "rgba(255,180,90,0.8)"], dist: 0.6, sway: 50, glow: true, flicker: true });
}
function dark(X, L) { vignette(L, 0.85, 32); tint(L, "#1A0E0A", 0.25); }

const B = {};

/* 1. arder: frase grande al rojo, se enfría y luego arde y se vuelve ceniza */
B.burnAway = (sc, X) => {
  const { W, H } = X, L = div(X.root, "lay", { background: P.charcoal });
  footage(X, L, 0, "ash", { opacity: 0.55 }); dark(X, L);
  const ls = rows(sc.words, sc.words.length > 3 ? 2 : 1);
  const fs = Math.min(...ls.map(l => fit(J(l), ser, 0, 0.82 * W, 0.2 * H)));
  ls.forEach((l, i) => {
    const t = lineNested(X, L, l, { cls: ser, fs, x: W / 2, y: H / 2 + (i - (ls.length - 1) / 2) * fs * 1.05, color: P.bone }, "ember");
    const t0 = Math.max(l[l.length - 1].rt + 0.6, X.dur - 1.3);
    burnChars(X, L, t, t0, 0.9);
  });
  ashLayer(X, L);
  enterFx(X, pickTrans(X), OV());
};

/* 2. vela: llamas en la oscuridad, frase chica centrada; al final la vela se apaga */
B.candle = (sc, X) => {
  const { W, H } = X, L = div(X.root, "lay", { background: "#050302" });
  const f = footage(X, L, 0, "ember", { from: 1.04, to: 1.1 });
  dark(X, L);
  const s = J(sc.words), fs = Math.min(fit(s, ser, 0, 0.7 * W, 0.09 * H), 0.085 * H);
  const t = line(X, L, sc.words, { cls: ser, fs, x: W / 2, y: 0.78 * H, color: P.bone }, "flicker");
  /* la luz se apaga: todo baja a casi negro en los últimos 0.8 s */
  const off = div(L, "lay", { background: "#000" });
  X.T(off, "opacity", "0").to(Math.max(0.4, X.dur - 0.8), 0.8 + OV(), "0.82", EASE_IN);
  motes(X, L, 8, { dir: -1, size: 2, color: "rgba(255,170,90,0.8)", dist: 0.5, glow: true, flicker: true });
  enterFx(X, pickTrans(X), OV());
};

/* 3. ceniza cayendo: negro, la ceniza cae lenta y las palabras se enfrían de brasa a gris */
B.ashFall = (sc, X) => {
  const { W, H } = X, L = div(X.root, "lay", { background: P.charcoal });
  div(L, "lay", { background: "radial-gradient(ellipse at 50% 60%, rgba(120,50,20,0.25), transparent 65%)" });
  motes(X, L, 60, { dir: 1, size: 3, color: ["rgba(180,175,170,0.6)", "rgba(110,105,100,0.55)", "rgba(220,120,60,0.6)"], dist: 0.55, sway: 120, square: true });
  const ls = rows(sc.words, sc.words.length > 4 ? 2 : 1);
  const fs = Math.min(...ls.map(l => fit(J(l), ser, 0, 0.78 * W, 0.15 * H)));
  ls.forEach((l, i) => {
    const t = line(X, L, l, { cls: ser, fs, x: W / 2, y: H / 2 + (i - (ls.length - 1) / 2) * fs * 1.1, color: P.ashText }, "ember");
    t.words.forEach((s, k) => X.T(s, "color", P.emberText).to(Math.max(0.02, l[k].rt), 1.6, P.ashText, EASE_OUT));
    leave(X, t.box, "blur");
  });
  enterFx(X, pickTrans(X), OV());
};

/* 4. humo: humo real (screen) y la frase se disuelve en él */
B.smoke = (sc, X) => {
  const { W, H } = X, L = div(X.root, "lay", { background: "#060505" });
  const f = footage(X, L, 0, "ash", { from: 1.0, to: 1.12 }); f.box.style.mixBlendMode = "screen"; f.box.style.opacity = "0.85";
  const ls = rows(sc.words, sc.words.length > 3 ? 2 : 1);
  const fs = Math.min(...ls.map(l => fit(J(l), ser, 0, 0.78 * W, 0.17 * H)));
  ls.forEach((l, i) => {
    const t = lineNested(X, L, l, { cls: ser, fs, x: W / 2, y: H / 2 + (i - (ls.length - 1) / 2) * fs * 1.05, color: P.bone, revealSec: 1.0 }, "blur");
    smokeOut(X, t.chars, Math.max(l[l.length - 1].rt + 0.5, X.dur - 1.4), 0.9);
  });
  vignette(L, 0.8, 35);
  enterFx(X, pickTrans(X), OV());
};

/* 5. diario: hoja que arde; la frase como entrada de diario a máquina con fecha */
B.diary = (sc, X) => {
  const { W, H, u } = X, L = div(X.root, "lay", { background: P.charcoal });
  footage(X, L, 0, "ember", { from: 1.1, to: 1.0 }); dark(X, L);
  const dt = word(X, L, `— ${["12", "03", "28", "17"][Math.floor(X.r() * 4)]} · ${["ENERO", "MARZO", "AGOSTO", "NOVIEMBRE"][Math.floor(X.r() * 4)]} —`, { cls: mono, fs: 14 * u, x: 0.12 * W, y: 0.3 * H, ax: 0, color: P.emberText, ls: 0.3 });
  reveal(X, dt.el, 0.15, "fade");
  const s = J(sc.words), fs = Math.min(fit(s, mono, 0, 0.76 * W, 0.07 * H), 0.06 * H);
  const ls = rows(sc.words, s.length > 26 ? 2 : 1);
  ls.forEach((l, i) => {
    const t = word(X, L, J(l), { cls: mono, fs, x: 0.12 * W, y: 0.42 * H + i * fs * 1.5, ax: 0, color: P.bone, split: "chars" });
    typeErase(X, t, Math.max(0.05, l[0].rt), null, { step: Math.min(0.05, 0.9 / Math.max(1, t.chars.length)), cursor: i === ls.length - 1, cursorChar: "_" });
    const ul = div(L, "patch", { left: 0.12 * W + "px", top: 0.42 * H + i * fs * 1.5 + fs * 0.7 + "px", width: 0.7 * W + "px", height: Math.max(1, u) + "px", background: "rgba(230,225,218,0.18)" });
  });
  ashLayer(X, L);
  enterFx(X, pickTrans(X), OV());
};

/* 6. brasas: la palabra protagonista en contorno, se "calienta" llenándose de brasa desde abajo */
B.embers = (sc, X) => {
  const { W, H, u } = X, L = div(X.root, "lay", { background: "#060303" });
  footage(X, L, 0, "ember", { opacity: 0.7 }); dark(X, L);
  const hi = heroIdx(sc.words), hero = sc.words[hi], s = U(hero.text);
  const fs = fit(s, ser, 0.04, 0.84 * W, 0.4 * H);
  const ol = word(X, L, s, { cls: ser, fs, x: W / 2, y: 0.47 * H, color: "transparent", ls: 0.04 });
  ol.el.style.webkitTextStroke = `${Math.max(1, 1.4 * u)}px rgba(230,225,218,0.7)`;
  reveal(X, ol.el, Math.max(0.02, hero.rt - 0.2), "fade", 0.6);
  const fill = word(X, L, s, { cls: ser, fs, x: W / 2, y: 0.47 * H, color: P.ember, ls: 0.04 });
  fill.el.style.textShadow = "0 0 30px rgba(255,100,30,0.6)";
  X.T(fill.el, "clipPath", "inset(100% 0% 0% 0%)").to(Math.max(0.05, hero.rt), Math.max(0.8, X.dur - hero.rt - 0.3), "inset(8% 0% 0% 0%)", EASE_OUT);
  const rest = sc.words.filter((_, i) => i !== hi);
  if (rest.length) line(X, L, rest, { cls: mono, fs: Math.min(0.04 * H, fit(U(J(rest)), mono, 0.4, 0.8 * W, 1e9)), x: W / 2, y: 0.47 * H + fs * 0.6, color: P.bone, ls: 0.4 }, "fade");
  motes(X, L, 30, { dir: -1, size: 2.6, color: ["rgba(255,140,60,0.9)", "rgba(255,200,120,0.8)"], dist: 0.8, sway: 70, glow: true, flicker: true });
  leave(X, ol.box, "blur"); leave(X, fill.box, "blur");
  enterFx(X, pickTrans(X), OV());
};

/* 7. grieta: la palabra se parte en dos (arriba / abajo) con una grieta brillante */
B.crack = (sc, X) => {
  const { W, H, u } = X, L = div(X.root, "lay", { background: P.charcoal });
  footage(X, L, 0, "ash", { opacity: 0.3 }); dark(X, L);
  const hi = heroIdx(sc.words), hero = sc.words[hi], s = U(hero.text);
  const fs = fit(s, ser, 0.02, 0.84 * W, 0.36 * H), y = 0.47 * H, tc = Math.max(hero.rt + 0.7, X.dur * 0.5);
  /* línea de grieta en zigzag (la misma para ambas mitades) */
  const n = 14, pts = Array.from({ length: n + 1 }, (_, i) => [i / n * 100, 50 + (X.r() - 0.5) * 18]);
  const topClip = `polygon(0% 0%, 100% 0%, ${pts.slice().reverse().map(([x, y0]) => `${x.toFixed(1)}% ${y0.toFixed(1)}%`).join(", ")})`;
  const botClip = `polygon(${pts.map(([x, y0]) => `${x.toFixed(1)}% ${y0.toFixed(1)}%`).join(", ")}, 100% 100%, 0% 100%)`;
  for (const [clip, dir] of [[topClip, -1], [botClip, 1]]) {
    const t = word(X, L, s, { cls: ser, fs, x: W / 2, y, color: P.bone, ls: 0.02 });
    t.el.style.clipPath = clip;
    reveal(X, t.el, Math.max(0.02, hero.rt), "ember");
    X.T(t.box, "filter", "none", true).set(tc, "drop-shadow(0 0 12px rgba(255,120,40,0.7))");
    X.T(t.el, "transform", "translate(0px, 0px) rotate(0deg)").to(tc, 0.25, `translate(${dir * -6 * u}px, ${dir * 0.025 * H}px) rotate(${dir * 1.5}deg)`, EASE_OUT)
      .to(tc + 0.25, Math.max(0.3, X.dur + OV() - tc - 0.25), `translate(${dir * -14 * u}px, ${dir * 0.06 * H}px) rotate(${dir * 3}deg)`);
  }
  const fl = div(L, "lay", { background: "rgba(255,150,70,0.5)", mixBlendMode: "screen" });
  X.T(fl, "opacity", "0", true).set(tc, "0.7").set(tc + 0.06, "0.2").set(tc + 0.12, "0");
  const rest = sc.words.filter((_, i) => i !== hi);
  if (rest.length) line(X, L, rest, { cls: mono, fs: Math.min(0.04 * H, fit(U(J(rest)), mono, 0.4, 0.8 * W, 1e9)), x: W / 2, y: 0.84 * H, color: P.ashText, ls: 0.4 }, "fade");
  ashLayer(X, L);
  enterFx(X, pickTrans(X), OV());
};

/* 8. lágrimas: metraje íntimo muy oscuro y desaturado, frase itálica abajo, palabras que suben */
B.tears = (sc, X) => {
  const { W, H } = X, L = div(X.root, "lay", { background: "#050404" });
  footage(X, L, 0, "ash", { from: 1.15, to: 1.05 }); dark(X, L); letterbox(X, L, 0.11);
  const s = J(sc.words), fs = Math.min(fit(s, ser + " it", 0, 0.78 * W, 0.08 * H), 0.075 * H);
  const t = line(X, L, sc.words, { cls: ser + " it", fs, x: W / 2, y: 0.8 * H, color: P.bone }, "rise");
  leave(X, t.box, "blur");
  motes(X, L, 10, { dir: 1, size: 2.4, color: "rgba(170,165,160,0.5)", dist: 0.3, square: true });
  enterFx(X, pickTrans(X), OV());
};

B.intro = (sc, X) => B.embers(sc, X);
B.outro = (sc, X) => {
  const { W, H } = X, L = div(X.root, "lay", { background: "#050302" });
  footage(X, L, 0, "ember", { opacity: 0.5 }); dark(X, L);
  const [a, b, c] = sc.words;
  if (a) { const t = lineNested(X, L, [a], { cls: ser, fs: 0.17 * H, x: W / 2, y: 0.42 * H, color: P.bone }, "ember"); burnChars(X, L, t, Math.max(a.rt + 1.6, X.dur - 1.2), 0.8); }
  if (b) { const t = word(X, L, U(b.text), { cls: mono, fs: 0.035 * H, x: W / 2, y: 0.56 * H, color: P.ashText, ls: 0.5 }); reveal(X, t.el, b.rt, "fade", 1); }
  if (c) { const t = word(X, L, U(c.text), { cls: mono, fs: 0.025 * H, x: W / 2, y: 0.63 * H, color: P.emberText, ls: 0.3 }); reveal(X, t.el, c.rt, "fade", 1); }
  ashLayer(X, L);
  enterFx(X, "burn", OV() * 1.6);
};

const FITS = {
  burnAway: sc => J(sc.words).length <= 36 && sc.dur > 1.6,
  candle: sc => J(sc.words).length <= 44,
  ashFall: sc => J(sc.words).length <= 40,
  smoke: sc => J(sc.words).length <= 34 && sc.dur > 1.5,
  diary: sc => J(sc.words).length <= 50,
  embers: sc => sc.words[heroIdx(sc.words)].text.length <= 10,
  crack: sc => sc.words[heroIdx(sc.words)].text.length <= 10 && sc.dur > 1.2,
  tears: sc => J(sc.words).length <= 46
};
function makeTimeline(segs, dur) { return lyricTimeline(segs, dur, FITS); }
