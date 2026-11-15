/* ====================== ESCENAS · lyrics-lluvia-gris ======================
   Balada triste bajo la lluvia: metraje frío y desaturado (vidrio mojado,
   calle nocturna, paraguas, ventana), pizarra azul-gris, serif itálica fina +
   sans liviana muy espaciada, lluvia real en pantalla, letras que entran con
   desenfoque y se derriten como gotas, reflejos en el asfalto mojado, texto
   que limpia el vaho del vidrio. Transiciones: cortina de lluvia, disolvencia
   desenfocada, barrido hacia abajo. */
const ser = "ser", sans = "sn";
function wet(X, L) { vignette(L, 0.78, 38); tint(L, P.slate, 0.28); }

const B = {};

/* 1. vidrio mojado: frase grande en serif que entra desenfocada, lluvia encima, se derrite al salir */
B.window = (sc, X) => {
  const { W, H } = X, L = div(X.root, "lay", { background: P.slate });
  footage(X, L, 0, "rain"); wet(X, L);
  const ls = rows(sc.words, sc.words.length > 4 ? 2 : 1);
  const fs = Math.min(...ls.map(l => fit(J(l), ser, 0, 0.78 * W, 0.2 * H)));
  const ts = ls.map((l, i) => line(X, L, l, { cls: ser, fs, x: W / 2, y: H / 2 + (i - (ls.length - 1) / 2) * fs * 1.02, color: P.pale }, "blur"));
  rainFx(X, L, 70);
  ts.forEach(t => { const ch = [...t.el.querySelectorAll(".wd")]; leave(X, t.box, "blur"); });
  enterFx(X, pickTrans(X), OV());
};

/* 2. derretido: palabra protagonista enorme que gotea letra a letra */
B.melt = (sc, X) => {
  const { W, H, u } = X, L = div(X.root, "lay", { background: P.slate });
  footage(X, L, 0, "cold", { opacity: 0.35 }); wet(X, L);
  const hi = heroIdx(sc.words), hero = sc.words[hi];
  const fs = fit(hero.text, ser, 0.02, 0.8 * W, 0.42 * H);
  const t = lineNested(X, L, [hero], { cls: ser, fs, x: W / 2, y: 0.46 * H, color: P.pale, ls: 0.02, revealSec: 1.0 }, "blur");
  drip(X, t.chars, Math.max(0.8, X.dur * 0.55), Math.max(0.6, X.dur * 0.35));
  const rest = sc.words.filter((_, i) => i !== hi);
  if (rest.length) line(X, L, rest, { cls: sans, fs: Math.min(0.045 * H, fit(U(J(rest)), sans, 0.5, 0.8 * W, 1e9)), x: W / 2, y: 0.46 * H + fs * 0.66, color: P.steel, ls: 0.5 }, "blur");
  rainFx(X, L, 40, { speed: 1.2 });
  enterFx(X, pickTrans(X), OV());
};

/* 3. calle mojada: subtítulo espaciado abajo + palabra reflejada en el asfalto */
B.street = (sc, X) => {
  const { W, H, u } = X, L = div(X.root, "lay", { background: P.slate });
  footage(X, L, 0, "rain", { from: 1.1, to: 1.02 }); wet(X, L);
  const hi = heroIdx(sc.words), hero = sc.words[hi];
  const fs = fit(hero.text, sans, 0.45, 0.7 * W, 0.12 * H), y = 0.56 * H;
  const t = word(X, L, hero.text, { cls: sans, fs, x: W / 2, y, color: P.pale, ls: 0.45 });
  reveal(X, t.el, Math.max(0.02, hero.rt), "blur", 1.0);
  /* reflejo: copia invertida, desenfocada, que ondula */
  const rf = word(X, L, hero.text, { cls: sans, fs, x: W / 2, y: y + fs * 0.98, color: P.pale, ls: 0.45 });
  rf.box.style.transform += " scaleY(-1)";
  Object.assign(rf.el.style, { opacity: "0.32", filter: "blur(2.5px)", webkitMaskImage: "linear-gradient(to top, rgba(0,0,0,0.9), transparent 75%)" });
  reveal(X, rf.el, Math.max(0.02, hero.rt) + 0.1, "fade", 1.2);
  const wob = X.T(rf.el, "transform", "skewX(0deg) scaleX(1)");
  for (let k = 0; k * 0.7 < X.dur + OV(); k++) wob.to(k * 0.7, 0.7, `skewX(${(k % 2 ? 2.5 : -2.5)}deg) scaleX(${k % 2 ? 1.02 : 0.99})`);
  line(X, L, sc.words, { cls: sans, fs: 12 * u, x: W / 2, y: 0.88 * H, color: P.steel, ls: 0.35 }, "fade");
  rainFx(X, L, 55, { angle: 4 });
  leave(X, t.box, "blur");
  enterFx(X, pickTrans(X), OV());
};

/* 4. vaho: vidrio empañado (metraje muy desenfocado) y el texto "limpia" el vidrio
   dejando ver la imagen nítida a través de las letras */
B.fogged = (sc, X) => {
  const { W, H } = X, L = div(X.root, "lay", { background: P.slate });
  const f = footage(X, L, 0, "cold"); f.box.style.filter = "blur(16px) brightness(0.75)";
  tint(L, "#C9D2D8", 0.22, "screen");
  const spec = asStill(mediaSpec(sc, 0));
  const ls = rows(sc.words, sc.words.length > 3 ? 2 : 1);
  const fs = Math.min(...ls.map(l => fit(U(J(l)), sans, 0.04, 0.82 * W, 0.26 * H)));
  const img = `url("${encodeURI((spec.graded?.cold?.src) || spec.src)}")`;
  ls.forEach((l, i) => {
    const t = word(X, L, U(J(l)), { cls: sans + " bold", fs, x: W / 2, y: H / 2 + (i - (ls.length - 1) / 2) * fs * 0.95, color: "transparent", ls: 0.04, split: "words" });
    /* cada palabra recorta la imagen nítida en su lugar exacto y se "limpia" de izquierda a derecha */
    t.words.forEach((s0, k) => {
      Object.assign(s0.style, { filter: "brightness(1.9) contrast(1.1)", backgroundImage: img, backgroundSize: `${W}px ${H}px`, webkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
        webkitMaskImage: "linear-gradient(90deg, #000 50%, transparent 50%)", webkitMaskSize: "200% 100%" });
      X.T(s0, "webkitMaskPosition", "100% 0%").to(Math.max(0.02, l[k].rt), 0.55, "0% 0%", EASE_OUT);
      X.pend.push(() => { const r0 = s0.getBoundingClientRect(), R = X.root.getBoundingClientRect(); s0.style.backgroundPosition = `${-(r0.left - R.left)}px ${-(r0.top - R.top)}px`; });
    });
    leave(X, t.box, "blur");
  });
  vignette(L, 0.7, 45); rainFx(X, L, 30, { speed: 0.8 });
  enterFx(X, pickTrans(X), OV());
};

/* 5. eco de lluvia: la frase repetida hacia abajo, cada copia más tenue y borrosa */
B.echo = (sc, X) => {
  const { W, H } = X, L = div(X.root, "lay", { background: P.slate });
  footage(X, L, 0, "cold", { opacity: 0.45 }); wet(X, L);
  const s = J(sc.words), n = 5, fs = Math.min(fit(s, ser, 0, 0.7 * W, 0.1 * H), 0.1 * H), lh = fs * 1.15, y0 = 0.3 * H;
  for (let i = 0; i < n; i++) {
    const t = i === 0 ? line(X, L, sc.words, { cls: ser, fs, x: W / 2, y: y0, color: P.pale }, "blur")
                      : word(X, L, s, { cls: ser, fs, x: W / 2, y: y0 + i * lh, color: P.pale });
    if (i) {
      const at = Math.max(0.1, sc.words[sc.words.length - 1].rt) + i * 0.22;
      Object.assign(t.el.style, { filter: `blur(${i * 1.6}px)` });
      X.T(t.el, "opacity", "0").to(at, 0.9, String((0.55 - i * 0.1).toFixed(2)), EASE_OUT);
      X.T(t.el, "transform", "translateY(-40%)").to(at, 1.1, "translateY(0%)", EASE_OUT);
    }
    leave(X, t.box, "blur");
  }
  rainFx(X, L, 45);
  enterFx(X, pickTrans(X), OV());
};

/* 6. dos ventanas: dos tomas partidas por una línea fina, la frase cruza el corte */
B.split = (sc, X) => {
  const { W, H, u } = X, L = div(X.root, "lay", { background: "#000" });
  const a = div(L, "patch", { left: 0, top: 0, width: W / 2 - 1 + "px", height: H + "px", overflow: "hidden" });
  const b = div(L, "patch", { left: W / 2 + 1 + "px", top: 0, width: W / 2 + "px", height: H + "px", overflow: "hidden" });
  const fa = mbox(X, a, 0, { left: -W / 4 + "px", top: 0, width: W + "px", height: H + "px" }, { filter: "rain" });
  const fb = mbox(X, b, 1, { left: -W / 4 + "px", top: 0, width: W + "px", height: H + "px" }, { filter: "cold", off: 1.5 });
  X.T(a, "transform", `translateY(${-0.06 * H}px)`).to(0, X.dur + OV(), `translateY(${0.06 * H}px)`);
  X.T(b, "transform", `translateY(${0.06 * H}px)`).to(0, X.dur + OV(), `translateY(${-0.06 * H}px)`);
  wet(X, L);
  const ln = div(L, "patch", { left: W / 2 - 0.5 * u + "px", top: 0, width: Math.max(1, u) + "px", height: H + "px", background: P.pale, opacity: 0.6, transformOrigin: "50% 0%" });
  X.T(ln, "transform", "scaleY(0)").to(0.05, 0.8, "scaleY(1)", EASE_OUT);
  const [l1, l2] = rows(sc.words, 2);
  const fs = Math.min(fit(J(l1), ser, 0, 0.42 * W, 0.12 * H), l2 ? fit(J(l2), ser, 0, 0.42 * W, 0.12 * H) : 1e9);
  line(X, L, l1, { cls: ser, fs, x: 0.47 * W, y: 0.46 * H, ax: 1, color: P.pale }, "blur");
  if (l2) line(X, L, l2, { cls: ser, fs, x: 0.53 * W, y: 0.46 * H + fs * 1.05, ax: 0, color: P.pale }, "blur");
  rainFx(X, L, 40);
  enterFx(X, pickTrans(X), OV());
};

/* 7. susurro: casi negro, una línea chica que se escribe letra a letra con mucho aire */
B.whisper = (sc, X) => {
  const { W, H, u } = X, L = div(X.root, "lay", { background: P.night });
  fog(X, L, 3, 0.1);
  const s = U(J(sc.words));
  const baseFs = Math.min(fit(s, sans, 0.5, 0.86 * W, 1e9), 0.068 * H);
  const fs = Math.min(baseFs * 1.25, fit(s, sans, 0.5, 0.94 * W, 0.085 * H));
  const t = word(X, L, s, { cls: sans, fs, x: W / 2, y: H / 2, color: P.pale, ls: 0.5, split: "chars" });
  t.el.style.whiteSpace = "nowrap";
  let wi = 0; t.chars.forEach((c, k) => { if (c.textContent === " ") { wi++; return; } reveal(X, c, Math.max(0.02, sc.words[wi]?.rt ?? 0) + (k % 4) * 0.04, "blur", 0.9); });
  X.T(t.el, "letterSpacing", "0.5em").to(0, X.dur + OV(), "0.75em");
  rainFx(X, L, 25, { color: "180,195,210" });
  leave(X, t.box, "fade");
  enterFx(X, pickTrans(X), OV());
};

/* 8. gotas de texto: cada palabra cae como gota desde arriba y salpica */
B.dropWords = (sc, X) => {
  const { W, H, u } = X, L = div(X.root, "lay", { background: P.slate });
  footage(X, L, 0, "rain", { opacity: 0.7 }); wet(X, L);
  const ls = rows(sc.words, sc.words.length > 3 ? 2 : 1);
  const fs = Math.min(...ls.map(l => fit(J(l), ser, 0, 0.74 * W, 0.17 * H)));
  ls.forEach((l, i) => {
    const y = H / 2 + (i - (ls.length - 1) / 2) * fs * 1.05;
    const t = line(X, L, l, { cls: ser, fs, x: W / 2, y, color: P.pale }, "drop");
    later(X, t, b => t.words.forEach((s, k) => {
      const at = Math.max(0.02, l[k].rt) + 0.36, rr = s.getBoundingClientRect(), R = X.root.getBoundingClientRect();
      const ring = div(L, "patch", { left: rr.left - R.left + rr.width / 2 + "px", top: rr.bottom - R.top - fs * 0.08 + "px", width: 0, height: 0, border: `${Math.max(1, u)}px solid rgba(220,230,240,0.6)`, borderRadius: "50%", visibility: "hidden" });
      show(X, ring, at);
      X.T(ring, "transform", "translate(-50%, -50%) scale(0.2, 0.06)").to(at, 0.6, "translate(-50%, -50%) scale(1, 0.3)", EASE_OUT);
      ring.style.width = fs * 1.2 + "px"; ring.style.height = fs * 1.2 + "px";
      X.T(ring, "opacity", "1").to(at, 0.6, "0");
    }));
    leave(X, t.box, "blur");
  });
  rainFx(X, L, 50);
  enterFx(X, pickTrans(X), OV());
};

/* intro / cierre */
B.intro = (sc, X) => {
  const { W, H } = X, L = div(X.root, "lay", { background: P.night });
  fog(X, L, 3, 0.1);
  const s = U(J(sc.words));
  const baseFs = Math.min(fit(s, sans, 0.5, 0.86 * W, 1e9), 0.068 * H);
  const fs = Math.min(baseFs * 1.25, fit(s, sans, 0.5, 0.94 * W, 0.085 * H));
  const t = word(X, L, s, { cls: sans, fs, x: W / 2, y: H / 2, color: P.pale, ls: 0.5, split: "chars" });
  t.el.style.whiteSpace = "nowrap";
  t.chars.forEach((c, k) => reveal(X, c, 0.02 + k * 0.012, "blur", 0.18));
  rainFx(X, L, 25, { color: "180,195,210" });
  leave(X, t.box, "fade");
  enterFx(X, pickTrans(X), OV());
};
B.outro = (sc, X) => window.NexaLluviaOutro.render(sc, X, { P, ser, sans, div, footage, rainFx, word, fit, reveal, config: C.outro || {} });

const FITS = {
  window: sc => J(sc.words).length <= 46,
  melt: sc => sc.words[heroIdx(sc.words)].text.length <= 10,
  street: sc => sc.words[heroIdx(sc.words)].text.length <= 9,
  fogged: sc => J(sc.words).length <= 22,
  echo: sc => J(sc.words).length <= 30,
  split: sc => sc.words.length >= 2,
  whisper: sc => J(sc.words).length <= 40,
  dropWords: sc => sc.words.length <= 6
};
function makeTimeline(segs, dur) { return lyricTimeline(segs, dur, FITS); }
