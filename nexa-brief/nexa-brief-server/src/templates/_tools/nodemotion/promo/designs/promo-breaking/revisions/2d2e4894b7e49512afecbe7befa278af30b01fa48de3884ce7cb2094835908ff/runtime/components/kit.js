/* Promo Breaking · kit visual compartido por intro, escenas y outros.
   Lenguaje de la referencia: foto en blanco y negro, tinte rojo desde una
   esquina, letras gigantes claras detrás, titular Poppins extra negrita con un
   tramo de letras en contorno, subrayado rojo, subtítulo espaciado y
   decoraciones finas (cruces, rombos, puntos y líneas).
   Todas las funciones reciben (X, K, ...): X = escena (W, H, u, r, T, dur, p),
   K = herramientas del motor (div, tx, fit, textW, mbox, C, P, BR...). */
const R = window.NexaPromo_promo_breaking;
const k = R.kit;

R.meta = {
  fallback: "word",
  textIn: "rise",
  hud: false,
  look: {
    tint: R.S.num(0, 1, 0.85),          /* fuerza del tinte rojo */
    giantOpacity: R.S.num(0, 1, 0.6),   /* opacidad de las letras gigantes */
    decor: R.S.num(0, 2, 1),            /* cantidad de cruces/rombos/líneas (0 = sin decoración) */
    vignette: R.S.num(0, 1, 0.55),      /* oscurecido de bordes */
  },
};

k.rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };
k.plain = t => String(t || "").replace(/~/g, "");
/* tramo de letras en contorno: "~" en el texto marca el tramo (BR~EA~KING);
   si no hay marcas: auto = tramo central de la palabra más larga, alt = una
   de cada tres, rand = sorteo con la semilla, all / none */
k.marks = (text, mode, rnd) => {
  const raw = String(text || "");
  if (raw.includes("~")) {
    let on = false; const out = [];
    for (const ch of raw) { if (ch === "~") { on = !on; continue; } out.push({ ch, o: on && ch !== " " }); }
    return out;
  }
  const out = [...raw].map(ch => ({ ch, o: false }));
  if (mode === "none") return out;
  if (mode === "all") return out.map(c => ({ ...c, o: c.ch !== " " }));
  if (mode === "alt") return out.map((c, i) => ({ ...c, o: c.ch !== " " && i % 3 === 1 }));
  if (mode === "rand") return out.map(c => ({ ...c, o: c.ch !== " " && (rnd ? rnd() : Math.random()) < 0.4 }));
  const words = raw.split(" ");
  let best = 0, bestOff = 0, off = 0;
  words.forEach((w, i) => { if (w.length > words[best].length) { best = i; bestOff = off; } off += w.length + 1; });
  const n = words[best].length;
  if (n < 4) return out;
  const a = bestOff + Math.floor(n * 0.3), b = a + Math.max(1, Math.round(n * 0.28));
  for (let i = a; i < b && i < out.length; i++) out[i].o = true;
  return out;
};
/* letras gigantes: un trozo de 4 letras de la palabra más larga (como «AKIN» de BREAKING) */
k.chunk = text => {
  const w = k.plain(text).split(/\s+/).reduce((a, c) => c.length > a.length ? c : a, "");
  if (w.length <= 5) return w;
  const s = Math.floor(w.length * 0.25);
  return w.slice(s, s + 4);
};

/* entrada del texto (anim.textIn o parámetro textIn de la escena) */
k.textIn = (X, K, w, mode, t0) => {
  const sp = 1 / (K.C.anim.speed || 1), I = K.C.anim.intensity ?? 1;
  const ch = w.chars.length ? w.chars : [w.el];
  if (mode === "cut") return;
  if (mode === "type") ch.forEach((c, i) => K.hide(X, c, t0 + i * 0.07 * sp));
  else if (mode === "rise") {
    w.el.style.clipPath = "inset(-20% -8% -12% -8%)";
    ch.forEach((c, i) => { const t = t0 + i * 0.028 * sp; X.T(c, "transform", `translateY(${(1.05 * Math.max(0.3, I)).toFixed(2)}em)`).to(t, 0.34 * sp, "translateY(0em)", K.EASE_OUT); });
  } else if (mode === "squash") {
    X.T(w.el, "transform", "scaleY(0.04) scaleX(1.3)").to(t0, 0.3 * sp, "scaleY(1) scaleX(1)", K.EASE_OUT);
    X.T(w.el, "opacity", "0").to(t0, 0.1, "1");
  } else if (mode === "pop") {
    X.T(w.el, "transform", `scale(${(1 + 0.22 * I).toFixed(3)})`).to(t0, 0.32 * sp, "scale(1)", K.EASE_OUT);
    X.T(w.el, "opacity", "0").to(t0, 0.12, "1");
  } else X.T(w.el, "opacity", "0").to(t0, 0.35 * sp, "1", K.EASE_OUT);
};

/* titular con letras en contorno. o = {x, y, ax, ay, fs, cls, ls, color, mode, sw, t0, textIn} */
k.word = (X, K, parent, text, o = {}) => {
  const marks = k.marks(text, o.mode || X.p.outline || "auto", X.r);
  const plain = marks.map(m => m.ch).join("");
  const color = o.color || K.P.white;
  const w = K.tx(parent, plain, { x: o.x, y: o.y, ax: o.ax ?? 0.5, ay: o.ay ?? 0.5, fs: o.fs, cls: o.cls || "hd", color, ls: o.ls, split: "chars" });
  const sw = Math.max(1.2, o.fs * (o.sw ?? 0.024));
  w.chars.forEach((c, i) => { if (marks[i]?.o) { c.style.color = "transparent"; c.style.webkitTextStroke = `${sw.toFixed(2)}px ${color}`; } });
  k.textIn(X, K, w, o.textIn || X.p.textIn || K.C.anim.textIn, o.t0 ?? 0.1);
  w.width = K.textW(plain, o.cls || "hd", o.ls || 0, o.fs);
  w.left = o.x - (o.ax ?? 0.5) * w.width;
  return w;
};
/* tamaño que entra en maxW × maxH (ignora las marcas ~) */
k.fitFs = (K, text, cls, ls, maxW, maxH) => K.fit(k.plain(text) || "A", cls, ls, maxW, maxH);

/* barra roja bajo el titular, crece de izquierda a derecha */
k.underline = (X, K, parent, x, y, w, t0 = 0.2, h) => {
  const bar = K.div(parent, "patch", { left: x + "px", top: y + "px", width: w + "px", height: (h || Math.max(2, 4 * X.u)) + "px", background: K.P.red, transformOrigin: "0% 50%" });
  X.T(bar, "transform", "scaleX(0)").to(t0, 0.45, "scaleX(1)", K.EASE_OUT);
  return bar;
};
/* subtítulo espaciado con alguna letra en contorno (WORLD NEWS) */
k.spaced = (X, K, parent, text, o) => {
  const ls = o.ls ?? 0.42;
  return k.word(X, K, parent, text, { cls: "hl", ls, mode: o.mode || "alt", sw: 0.035, textIn: o.textIn || "fade", ...o, x: o.x + (o.ax ?? 0.5) * o.fs * ls * 0.5 });
};

/* foto / clip a pantalla completa con grade (mono · red · none) y movimiento (drift · zoom · still) */
k.photo = (X, K, parent, slot = 0, o = {}) => {
  const g = o.grade ?? X.p.grade ?? "mono";
  const m = K.mbox(X, parent, slot, { left: "0px", top: "0px", width: X.W + "px", height: X.H + "px" }, { filter: g === "none" ? null : g, off: o.off });
  const I = K.C.anim.intensity ?? 1, mo = o.motion || X.p.motion || "drift", z = 0.06 * I;
  if (mo === "zoom") K.kenBurns(X, m, "scale(1.02)", `scale(${(1.02 + z * 1.6).toFixed(3)})`);
  else if (mo === "drift") K.kenBurns(X, m, `scale(${(1.08 + z).toFixed(3)}) translateX(-1.5%)`, `scale(${(1.08 + z).toFixed(3)}) translateX(1.5%)`);
  else m.el.style.transform = "scale(1.02)";
  if (g === "red") K.div(parent, "lay", { background: K.P.red, mixBlendMode: "multiply", opacity: 0.35 });
  return m;
};
/* letras gigantes claras que se desplazan detrás del titular */
k.giant = (X, K, parent, text, o = {}) => {
  const t = k.plain(text).toUpperCase();
  if (!t) return null;
  const fs = (o.size ?? 1.12) * Math.max(X.H, X.W * 0.56);
  const g = K.tx(parent, t, { canvas: true, cls: "hd", fs, x: X.W * (o.x ?? 0.5), y: X.H * (o.y ?? 0.5), ax: 0.5, ay: 0.5, color: K.P.white, ls: -0.02 });
  g.box.style.opacity = String(o.opacity ?? K.C.look.giantOpacity);
  const sp = (o.speed ?? 0.045) * X.W * (K.C.anim.intensity ?? 1);
  if (o.slideIn) X.T(g.el, "transform", `translateX(${X.W * 0.7}px)`).to(0, o.slideIn, `translateX(${sp * X.dur / 2}px)`, K.EASE_OUT).to(o.slideIn, X.dur + 0.6 - o.slideIn, `translateX(${-sp * X.dur / 2}px)`);
  else X.T(g.el, "transform", `translateX(${sp * X.dur / 2}px)`).to(0, X.dur + 0.6, `translateX(${-sp * X.dur / 2}px)`);
  return g;
};
/* tinte rojo desde una esquina (auto = sorteo con la semilla) */
k.tint = (X, K, parent, corner) => {
  const s = K.C.look.tint;
  if (corner === "none" || s <= 0) return null;
  const c = corner && corner !== "auto" ? corner : ["tl", "tr", "bl", "br"][Math.floor(X.r() * 4)];
  const pos = { tl: "0% 0%", tr: "100% 0%", bl: "0% 100%", br: "100% 100%" }[c] || "0% 0%";
  const lay = K.div(parent, "lay", { background: `radial-gradient(ellipse 80% 100% at ${pos}, ${k.rgba(K.P.red, s)} 0%, ${k.rgba(K.P.deep, s * 0.55)} 45%, transparent 78%)`, mixBlendMode: "hard-light" });
  X.T(lay, "opacity", "0.7").to(0, X.dur, "1");
  return lay;
};
k.vignette = (X, K, parent) => {
  const v = K.C.look.vignette;
  if (v > 0) K.div(parent, "lay", { background: `radial-gradient(ellipse 75% 70% at 50% 50%, transparent 40%, rgba(0,0,0,${v}) 100%)` });
};
/* cruces ×, rombos ◇, puntos y líneas finas que barren (look.decor = cantidad) */
k.decor = (X, K, parent, n = 4) => {
  const amt = K.C.look.decor;
  if (X.p.decor === false || amt <= 0) return;
  const { W, H, u, r } = X, col = K.P.white, N = Math.round(n * amt);
  const grp = K.div(parent, "lay");
  X.T(grp, "transform", "translate(0px, 0px)").to(0, X.dur, `translate(${(-14 * u).toFixed(1)}px, ${(6 * u).toFixed(1)}px)`);
  for (let i = 0; i < N; i++) {
    const x = W * (0.06 + r() * 0.88), y = H * (0.07 + r() * 0.86), t = 0.08 + r() * 0.7, kind = r();
    let el;
    if (kind < 0.45) {
      el = K.div(grp, "patch", { left: x + "px", top: y + "px", width: 16 * u + "px", height: 16 * u + "px" });
      for (const a of [45, -45]) K.div(el, "patch", { left: "0px", top: 7 * u + "px", width: 16 * u + "px", height: Math.max(1.5, 2 * u) + "px", background: col, transform: `rotate(${a}deg)` });
    } else if (kind < 0.8) el = K.div(grp, "patch", { left: x + "px", top: y + "px", width: 9 * u + "px", height: 9 * u + "px", border: `${Math.max(1.2, 1.6 * u)}px solid ${col}`, transform: "rotate(45deg)" });
    else el = K.div(grp, "patch", { left: x + "px", top: y + "px", width: 4 * u + "px", height: 4 * u + "px", background: col, borderRadius: "50%" });
    X.T(el, "opacity", "0").to(t, 0.05, "1").to(t + 0.08, 0.04, "0.25").to(t + 0.14, 0.04, "1");
  }
  for (let i = 0; i < Math.round(2 * amt); i++) {
    const y = H * (0.18 + r() * 0.64), w = W * (0.3 + r() * 0.4), fromL = r() < 0.5, t = r() * 0.5;
    const ln = K.div(grp, "patch", { left: (fromL ? 0 : W - w) + "px", top: y + "px", width: w + "px", height: Math.max(1, u) + "px", background: col, opacity: 0.45, transformOrigin: fromL ? "0% 50%" : "100% 50%" });
    X.T(ln, "transform", "scaleX(0)").to(t, 0.6, "scaleX(1)", K.EASE_OUT);
  }
};
/* fondo estándar: negro + foto con grade + viñeta + tinte (+ letras gigantes) */
k.backdrop = (X, K, o = {}) => {
  const L = X.L;
  L.style.background = K.P.ink;
  if (o.photo !== false) k.photo(X, K, L, o.slot ?? 0, o);
  if (o.giant) k.giant(X, K, L, o.giant, o.giantOpts || {});
  k.vignette(X, K, L);
  if (o.tint !== false) k.tint(X, K, L, X.p.tint);
  return L;
};
/* escala 16:9 / 9:16: ancho útil para el titular */
k.maxW = (X, land = 0.62, port = 0.88) => (X.W < X.H ? port : land) * X.W;

/* respaldo: dibuja otra escena con SUS valores por defecto (los del slot actual que coincidan se conservan) */
k.fallback = (type, sc, X, K) => {
  const d = {};
  for (const [key, s] of Object.entries(R.scenes[type].params || {})) d[key] = s.def;
  for (const key of Object.keys(d)) if (key in (sc.slot || {})) d[key] = X.p[key];
  X.p = d;
  return R.scenes[type].render(sc, X, K);
};
