/* ===================== ESCENAS · LYRICS-escenas-mixtas =====================
   Réplica del "lyric pack" de estilos mezclados: cada frase de la canción cae
   en una escena distinta — metraje cinematográfico, rojo plano, papel blanco
   con manchas de fotocopia o negro grunge — con tres familias tipográficas
   (extendida pesada, condensada alta, sans liviana), ecos chicos de la frase
   apilados, palabras gigantes espaciadas con etiqueta, tickers en los bordes,
   filas en contorno y una sola palabra en color de acento (lima / rojo /
   naranja). La letra viene 100% de lyrics.json (Whisper) y el mazo de escenas
   de config.layouts. */
const P = C.palette;
const U = s => String(s).toUpperCase();
const show = (X, el, t) => { if (t > 0.001) X.T(el, "visibility", "hidden", true).set(t, "visible"); };
const J = ws => ws.map(w => w.text).join(" ");
/* partir palabras en n renglones parejos (por caracteres) */
function rows(ws, n) {
  if (n <= 1 || ws.length <= 1) return [ws];
  const total = J(ws).length, out = [[]]; let acc = 0;
  for (const w of ws) {
    if (out[out.length - 1].length && acc >= total * out.length / n && out.length < n) out.push([]);
    out[out.length - 1].push(w); acc += w.text.length + 1;
  }
  return out.filter(r => r.length);
}
const ACC = X => [P.lime, P.red, P.orange][Math.floor(X.r() * 3)];

/* ---------------- fondos ---------------- */
function speckTile(rgb, dens) {
  const cv = doc.createElement("canvas"); cv.width = cv.height = 256;
  const cx = cv.getContext("2d");
  for (let i = 0; i < 256 * 256 * dens; i++) {
    cx.fillStyle = `rgba(${rgb},${0.25 + texRng() * 0.6})`;
    const s = texRng() < 0.9 ? 1 : 2; cx.fillRect(texRng() * 256, texRng() * 256, s, s);
  }
  return `url(${cv.toDataURL()})`;
}
const SPECK_D = speckTile("40,40,40", 0.08), SPECK_L = speckTile("230,230,230", 0.03), SPECK_R = speckTile("70,0,0", 0.07);
function bgLayer(X) {
  const { W, H, r, sc } = X, bg = sc.slot.bg;
  const L = div(X.root, "lay");
  if (bg === "media") {
    const m = mbox(X, L, 0, { left: 0, top: 0, width: W + "px", height: H + "px" }, { filter: "cine" });
    kenBurns(X, m, "scale(1.04)", "scale(1.1)");
    div(L, "lay", { background: "linear-gradient(180deg, rgba(0,0,0,0.25), rgba(0,0,0,0.45))" });
  } else if (bg === "red") {
    L.style.background = P.red;
    div(L, "lay", { backgroundImage: SPECK_R, opacity: 0.8 });
    div(L, "lay", { background: `linear-gradient(90deg, rgba(0,0,0,0.12), transparent 30%, transparent 70%, rgba(0,0,0,0.14))` });
  } else if (bg === "paper") {
    L.style.background = P.paper;
    for (let i = 0; i < 2; i++) {
      const w = (0.2 + r() * 0.25) * W, h = (0.25 + r() * 0.35) * H;
      div(L, "patch", { left: (i ? W - w * (0.7 + r() * 0.3) : -w * 0.2 * r()) + "px", top: (i ? H - h * (0.6 + r() * 0.4) : -h * 0.2 * r()) + "px",
        width: w + "px", height: h + "px", backgroundImage: SPECK_D, opacity: 0.8 });
    }
  } else {
    L.style.background = P.black;
    div(L, "lay", { backgroundImage: SPECK_L, opacity: 0.9 });
    div(L, "lay", { background: "radial-gradient(ellipse at 50% 50%, rgba(40,40,40,0.4), transparent 70%)" });
  }
  return L;
}
const onLight = X => X.sc.slot.bg === "paper";
const ink = X => onLight(X) ? P.ink : P.white;

/* ---------------- piezas ---------------- */
function echo(X, L, text, x, y, n, fs, color, ax = 0.5, t0 = 0.1) {
  for (let i = 0; i < n; i++) {
    const o = tx(L, U(text), { cls: "ex", fs, x, y: y + i * fs * 0.95, ax, color });
    show(X, o.box, t0 + i * 0.05);
  }
}
/* renglón con cada palabra apareciendo en su tiempo */
function line(X, L, ws, o) {
  const t = tx(L, U(J(ws)), { ...o, split: "words" });
  t.words.forEach((s, i) => show(X, s, Math.max(0.02, ws[i]?.rt ?? 0)));
  return t;
}
function roll(X, el, t, d = 0.22, from = 100) {
  X.T(el, "transform", `translateY(${from}%)`).to(t, d, "translateY(0%)", EASE_OUT);
}
function label(X, L, text, x, y, fs, bg, color, t) {
  const b = div(L, "patch", { left: x + "px", top: y + "px", transform: "translateY(-50%)", background: bg, padding: `${fs * 0.25}px ${fs * 0.6}px`, overflow: "hidden" });
  const o = tx(b, U(text), { cls: "sp", fs, x: 0, y: 0, ax: 0, ay: 0, color, ls: 0.35 });
  o.box.style.position = "relative";
  X.T(b, "clipPath", "inset(0% 100% 0% 0%)").to(t, 0.2, "inset(0% 0% 0% 0%)", EASE_OUT);
  return b;
}
function ticker(X, L, text, y, fs, color, dir) {
  const s = (U(text) + "   ").repeat(12);
  const o = tx(L, s, { cls: "ex", fs, x: 0, y, ax: 0, color });
  X.T(o.el, "transform", `translateX(${dir > 0 ? -0.3 * X.W : -0.05 * X.W}px)`).to(0, X.dur, `translateX(${dir > 0 ? -0.05 * X.W : -0.3 * X.W}px)`);
}

const B = {};

/* ---- 1. línea extendida al centro + eco chico apilado ---- */
B.echoCenter = (sc, X) => {
  const { W, H, u } = X, L = bgLayer(X), ws = sc.words;
  const fs = Math.min(fit(U(J(ws)), "ex", 0.01, 0.8 * W, 0.12 * H), 0.1 * H);
  const box = div(L, "lay", { clipPath: `inset(${0.5 * H - fs * 0.75}px 0px ${0.5 * H - fs * 0.75}px 0px)` });
  const t = line(X, box, ws, { cls: "ex", fs, x: W / 2, y: H / 2, color: ink(X), ls: 0.01 });
  roll(X, t.el, Math.max(0, ws[0].rt - 0.05));
  if (X.dur > 0.6) X.T(t.box, "opacity", "1").to(X.dur - 0.14, 0.12, "0");
  const hero = ws[heroIdx(ws)].text, pos = X.r();
  echo(X, L, hero, pos < 0.5 ? 0.5 * W : 0.36 * W, pos < 0.5 ? 0.62 * H : 0.08 * H, 3, 9 * u, pos < 0.5 ? ink(X) : P.lime, 0.5, ws[heroIdx(ws)].rt);
};

/* ---- 2. palabra liviana en acento + línea pesada debajo ---- */
B.duoLight = (sc, X) => {
  const { W, H, u } = X, L = bgLayer(X), ws = sc.words;
  const k = Math.max(1, Math.min(ws.length - 1, heroIdx(ws) || Math.ceil(ws.length / 2)));
  const a = ws.slice(0, k), b = ws.slice(k);
  const fb = Math.min(fit(U(J(b)), "ex", 0.02, 0.62 * W, 0.12 * H), 0.11 * H);
  const fa = Math.min(fb * 0.62, fit(U(J(a)), "lt", 0, 0.5 * W, 0.1 * H));
  const acc = X.r() < 0.6 ? P.lime : P.white;
  const ta = line(X, L, a, { cls: "lt", fs: fa, x: W / 2, y: 0.5 * H - fb * 0.62, color: acc === P.lime ? P.white : P.lime });
  const tb = tx(L, U(J(b)), { cls: "ex", fs: fb, x: W / 2, y: 0.5 * H + fb * 0.12, color: acc, ls: 0.02 });
  const t1 = Math.max(0.05, b[0].rt);
  show(X, tb.box, t1);
  X.T(tb.el, "letterSpacing", "0.5em").to(t1, 0.35, "0.02em", EASE_OUT);
  echo(X, L, J(b), 0.8 * W, 0.16 * H, 1, 8 * u, P.lime, 0.5, t1);
  echo(X, L, J(a), 0.04 * W, 0.84 * H, 3, 6.5 * u, P.white, 0, 0.1);
};

/* ---- 3. condensada gigante en acento, con copias cortadas arriba y abajo ---- */
B.condensed = (sc, X) => {
  const { W, H } = X, L = bgLayer(X), ws = sc.words;
  const ls = ws.length >= 3 ? rows(ws, 2) : [ws];
  const col = X.r() < 0.7 ? P.lime : P.white;
  const fs = Math.min(...ls.map(l => fit(U(J(l)), "cd", 0.01, 0.7 * W, (0.62 * H) / ls.length)));
  const lh = fs * 1.02, y0 = H / 2 - (ls.length - 1) * lh / 2;
  ls.forEach((l, i) => {
    const t = line(X, L, l, { cls: "cd", fs, x: W / 2, y: y0 + i * lh, color: col, ls: 0.01 });
    X.T(t.el, "transform", "scale(1.25)").to(Math.max(0, l[0].rt), 0.25, "scale(1)", EASE_OUT);
  });
  /* copias recortadas del último / primer renglón asomando por los bordes */
  if (X.dur > 0.9) {
    const tt = Math.max(0.3, ws[ws.length - 1].rt + 0.2);
    for (const [txt, y, clip] of [[J(ls[ls.length - 1]), y0 - lh, "inset(55% 0% 0% 0%)"], [J(ls[0]), y0 + ls.length * lh, "inset(0% 0% 55% 0%)"]]) {
      const o = tx(L, U(txt), { cls: "cd", fs, x: W / 2, y, color: col });
      o.el.style.clipPath = clip; show(X, o.box, tt);
    }
  }
};

/* ---- 4. renglón liviano con fantasmas que suben ---- */
B.fadeStack = (sc, X) => {
  const { W, H } = X, L = bgLayer(X), ws = sc.words;
  const fs = Math.min(fit(U(J(ws)), "lt", 0, 0.62 * W, 0.08 * H), 0.06 * H);
  const lh = fs * 1.35, y = 0.62 * H;
  const main = line(X, L, ws, { cls: "lt", fs, x: 0.02 * W + (X.r() < 0.5 ? 0 : 0.26 * W), y, ax: 0, color: P.white });
  const x0 = parseFloat(main.box.style.left);
  for (let i = 1; i <= 4; i++) {
    const o = tx(L, U(J(ws)), { cls: "lt", fs, x: x0, y: y - i * lh, ax: 0, color: `rgba(255,255,255,${0.42 - i * 0.08})` });
    const t = Math.max(0.2, ws[ws.length - 1].rt) + i * 0.08;
    show(X, o.box, t); X.T(o.el, "transform", `translateY(${lh}px)`).to(t, 0.25, "translateY(0px)", EASE_OUT);
  }
  const g = tx(L, U(J(ws)), { cls: "lt", fs, x: x0, y: y + 3.5 * lh, ax: 0, color: "rgba(255,255,255,0.18)" });
  show(X, g.box, 0.3);
};

/* ---- 5. rojo plano: extendida blanca + eco debajo ---- */
B.redFlat = (sc, X) => {
  sc.slot.bg = "red";
  const { W, H, u } = X, L = bgLayer(X), ws = sc.words;
  const fs = Math.min(fit(U(J(ws)), "ex", 0.01, 0.84 * W, 0.11 * H), 0.1 * H);
  const box = div(L, "lay", { clipPath: `inset(${0.5 * H - fs * 0.75}px 0px ${0.5 * H - fs * 0.75}px 0px)` });
  const t = line(X, box, ws, { cls: "ex", fs, x: W / 2, y: H / 2, color: P.white, ls: 0.01 });
  roll(X, t.el, Math.max(0, ws[0].rt - 0.05), 0.2);
  const hero = ws[heroIdx(ws)].text;
  echo(X, L, hero, W / 2, 0.6 * H, 3, 7 * u, P.white, 0.5, ws[heroIdx(ws)].rt);
  echo(X, L, hero, 0.2 * W, 0.04 * H, 3, 7 * u, "rgba(0,0,0,0.55)", 0.5, 0.1);
};

/* ---- 6. papel: renglones alternando liviano negro / espaciado rojo ---- */
B.paperMix = (sc, X) => {
  sc.slot.bg = "paper";
  const { W, H } = X, L = bgLayer(X), ws = sc.words;
  const ls = rows(ws, Math.min(4, Math.max(2, Math.ceil(ws.length / 2))));
  const fs = Math.min(...ls.map(l => fit(U(J(l)), "sp", 0.3, 0.56 * W, 0.1 * H)));
  const lh = fs * 1.15, y0 = H / 2 - (ls.length - 1) * lh / 2;
  ls.forEach((l, i) => {
    const red = i % 2 === 1;
    line(X, L, l, { cls: red ? "sp" : "lt", fs: red ? fs : fs * 0.7, x: W / 2, y: y0 + i * lh, color: red ? P.red : P.ink, ls: red ? 0.3 : 0.02 });
  });
};

/* ---- 7. letras abiertas a todo el ancho ---- */
B.spacedOut = (sc, X) => {
  sc.slot.bg = "paper";
  const { W, H } = X, L = bgLayer(X), ws = sc.words;
  const s = U(J(ws)), fs = Math.min(0.06 * H, fit(s, "lt", 1.2, 0.9 * W, 1e9));
  const t = tx(L, s, { cls: "lt", fs, x: W / 2, y: H / 2, color: P.ink, split: "chars" });
  let wi = 0; t.chars.forEach(ch => { if (ch.textContent === " ") { wi++; return; } show(X, ch, Math.max(0.02, ws[wi]?.rt ?? 0)); });
  X.T(t.el, "letterSpacing", "0.4em").to(Math.max(0, ws[0].rt), Math.max(0.4, X.dur), "1.2em", EASE_OUT);
};

/* ---- 8. palabra gigante condensada espaciada + etiqueta ---- */
B.giantSpread = (sc, X) => {
  if (!["red", "black"].includes(sc.slot.bg)) sc.slot.bg = X.r() < 0.5 ? "red" : "black";
  const { W, H, u } = X, L = bgLayer(X), ws = sc.words, hi = heroIdx(ws), hero = U(ws[hi].text);
  const col = sc.slot.bg === "red" ? P.black : P.red;
  const fs = 0.62 * H, n = Math.max(1, hero.length - 1);
  const w0 = textW(hero, "cd", 0, fs), ls = clamp((0.94 * W - w0) / n / fs, 0, 0.9);
  const t = tx(L, hero, { cls: "cd", fs: Math.min(fs, fit(hero, "cd", ls, 0.96 * W, 0.62 * H)), x: W / 2, y: 0.52 * H, color: col, ls });
  const th = Math.max(0.03, ws[0].rt);   /* la gigante entra con la frase, como en el original */
  show(X, t.box, th);
  X.T(t.el, "transform", "scaleY(1.2)").to(th, 0.2, "scaleY(1)", EASE_OUT);
  const rest = ws.filter((_, i) => i !== hi);
  if (rest.length) label(X, L, J(rest), 0.03 * W, 0.5 * H, 15 * u, P.white, P.ink, Math.max(0.05, rest[0].rt));
  const tiny = U(J(ws));
  for (const y of [0.06 * H, 0.97 * H]) { const o = tx(L, tiny, { cls: "sp", fs: 7 * u, x: W / 2, y, color: P.white, ls: 0.6 }); show(X, o.box, 0.1); }
};

/* ---- 9. filas en contorno espaciadas, una sólida ---- */
B.outlineRows = (sc, X) => {
  sc.slot.bg = "paper";
  const { W, H, u } = X, L = bgLayer(X), ws = sc.words, s = U(J(ws));
  const fs = Math.min(fit(s, "sp", 0.35, 0.55 * W, 0.07 * H), 0.055 * H), n = 7, lh = fs * 1.35;
  const y0 = H / 2 - (n - 1) * lh / 2, solid = 2 + Math.floor(X.r() * 3);
  for (let i = 0; i < n; i++) {
    const isS = i === solid, isB = i === solid + 1;
    const o = tx(L, s, { cls: "sp", fs, x: W / 2 + (isS ? -0.08 * W : 0), y: y0 + i * lh, color: isS ? P.red : P.ink, ls: 0.35, stroke: !isS && !isB, sw: 0.02 });
    if (!isS && !isB) o.el.style.webkitTextStroke = `${Math.max(1, 1.1 * u)}px rgba(20,20,20,0.55)`;
    const t = Math.max(0.03, ws[0].rt) + Math.abs(i - solid) * 0.06;
    show(X, o.box, t); X.T(o.el, "transform", "translateX(-6%)").to(t, 0.25, "translateX(0%)", EASE_OUT);
  }
};

/* ---- 10. papel: palabra liviana a la izquierda + bloque condensado a la derecha ---- */
B.leftRight = (sc, X) => {
  sc.slot.bg = "paper";
  const { W, H, u } = X, L = bgLayer(X), ws = sc.words, hi = heroIdx(ws);
  const hero = tx(L, U(ws[hi].text), { cls: "lt", fs: Math.min(0.12 * H, fit(U(ws[hi].text), "lt", 0, 0.24 * W, 1e9)), x: 0.05 * W, y: 0.62 * H, ax: 0, color: P.ink });
  show(X, hero.box, Math.max(0.03, ws[hi].rt));
  const ls = rows(ws, ws.length >= 4 ? 2 : 1), fs = Math.min(...ls.map(l => fit(U(J(l)), "cd", 0.02, 0.4 * W, 0.16 * H)));
  ls.forEach((l, i) => line(X, L, l, { cls: "cd", fs, x: 0.72 * W, y: 0.16 * H + i * fs * 1.05, color: P.ink, ls: 0.02 }));
  const by = 0.16 * H + ls.length * fs * 1.05 - fs * 0.35;
  const bar = div(L, "patch", { left: 0.6 * W + "px", top: by + "px", width: 0.24 * W + "px", height: 0.035 * H + "px", background: P.red, transformOrigin: "left" });
  X.T(bar, "transform", "scaleX(0)").to(0.15, 0.3, "scaleX(1)", EASE_OUT);
  const tiny = U(J(ws)), fsm = 8 * u;
  for (let i = 0; i < 4; i++) {
    const o = tx(L, tiny, { cls: "sp", fs: fsm, x: 0.72 * W, y: by + 0.1 * H + i * fsm * 1.6, color: i === 3 ? P.red : P.ink, ls: 0.3 });
    show(X, o.box, 0.2 + i * 0.12);
  }
};

/* ---- 11. franja negra con la palabra a la derecha ---- */
B.band = (sc, X) => {
  sc.slot.bg = "paper";
  const { W, H } = X, L = bgLayer(X), ws = sc.words;
  const bh = 0.14 * H, y = 0.5 * H;
  const b = div(L, "patch", { left: 0, top: y - bh / 2 + "px", width: W + "px", height: bh + "px", background: P.black, transformOrigin: "right" });
  X.T(b, "transform", "scaleX(0)").to(0, 0.2, "scaleX(1)", EASE_OUT);
  const fs = Math.min(bh * 0.8, fit(U(J(ws)), "ex", 0.01, 0.6 * W, 1e9));
  const t = line(X, L, ws, { cls: "ex", fs, x: 0.97 * W, y, ax: 1, color: P.white });
  X.T(t.el, "transform", "translateX(40%)").to(Math.max(0.05, ws[0].rt), 0.25, "translateX(0%)", EASE_OUT);
};

/* ---- 12. condensada naranja espaciada + etiqueta + tickers en los bordes ---- */
B.ticker = (sc, X) => {
  const { W, H, u } = X, L = bgLayer(X), ws = sc.words;
  const k = Math.max(1, Math.min(ws.length - 1, Math.floor(ws.length / 2)));
  const a = ws.length > 2 ? ws.slice(0, k) : [], b = ws.length > 2 ? ws.slice(k) : ws;
  const s = U(J(b)), fs = fit(s, "cd", 0.08, 0.96 * W, 0.42 * H);
  const t = tx(L, s, { cls: "cd", fs, x: W / 2, y: 0.5 * H, color: P.orange, ls: 0.08 });
  show(X, t.box, Math.max(0.03, b[0].rt));
  X.T(t.el, "letterSpacing", "0.4em").to(Math.max(0.03, b[0].rt), 0.35, "0.08em", EASE_OUT);
  if (a.length) label(X, L, J(a), 0.04 * W, 0.5 * H, 14 * u, P.white, P.ink, Math.max(0.03, a[0].rt));
  ticker(X, L, J(ws), 0.02 * H, 7 * u, P.white, 1);
  ticker(X, L, J(ws), 0.98 * H, 7 * u, P.white, -1);
};

/* ---- 13. dos renglones condensados lima a la derecha + palabra liviana + lista ---- */
B.rightStack = (sc, X) => {
  const { W, H, u } = X, L = bgLayer(X), ws = sc.words;
  const ls = rows(ws, 2), fs = Math.min(...ls.map(l => fit(U(J(l)), "cd", 0.02, 0.38 * W, 0.16 * H)));
  ls.forEach((l, i) => line(X, L, l, { cls: "cd", fs, x: 0.66 * W, y: 0.16 * H + i * fs * 1.02, color: P.lime, ls: 0.02 }));
  const hero = ws[heroIdx(ws)];
  const hw = tx(L, U(hero.text), { cls: "lt", fs: 0.075 * H, x: 0.05 * W, y: 0.72 * H, ax: 0, color: P.white });
  show(X, hw.box, Math.max(0.05, hero.rt));
  const tiny = U(J(ws)), fsm = 8.5 * u;
  for (let i = 0; i < 4; i++) {
    const o = tx(L, tiny, { cls: "sp", fs: fsm, x: 0.66 * W, y: 0.62 * H + i * fsm * 1.7, color: i === 3 ? P.lime : P.white, ls: 0.3 });
    show(X, o.box, 0.2 + i * 0.1);
  }
};

/* ---- 14. papel: condensada negra + liviana + condensada roja ---- */
B.whiteCenter = (sc, X) => {
  sc.slot.bg = "paper";
  const { W, H } = X, L = bgLayer(X), ws = sc.words;
  const n = ws.length;
  const a = ws.slice(0, 1), c = n >= 3 ? ws.slice(n - Math.ceil((n - 1) / 2)) : ws.slice(1), b = ws.slice(1, n - c.length);
  const fa = Math.min(0.17 * H, fit(U(J(a)), "cd", 0.02, 0.5 * W, 1e9));
  const la = line(X, L, a, { cls: "cd", fs: fa, x: W / 2, y: 0.34 * H, color: P.ink });
  X.T(la.el, "transform", "translateY(-30%)").to(Math.max(0, a[0].rt), 0.25, "translateY(0%)", EASE_OUT);
  if (b.length) line(X, L, b, { cls: "lt", fs: fa * 0.28, x: W / 2, y: 0.49 * H, color: P.ink });
  if (c.length) {
    const fc = Math.min(fa * 0.8, fit(U(J(c)), "cd", 0.02, 0.5 * W, 1e9));
    const lc = line(X, L, c, { cls: "cd", fs: fc, x: W / 2, y: 0.63 * H, color: P.red });
    X.T(lc.el, "transform", "translateY(30%)").to(Math.max(0, c[0].rt), 0.25, "translateY(0%)", EASE_OUT);
  }
};

/* ---- 15. negro: primera palabra en contorno ×3 + protagonista roja + resto condensado ---- */
B.blackStack = (sc, X) => {
  sc.slot.bg = "black";
  const { W, H, u } = X, L = bgLayer(X), ws = sc.words;
  const first = U(ws[0].text), rest = ws.slice(1);
  const k = Math.max(1, Math.ceil(rest.length / 2)), mid = rest.slice(0, k), end = rest.slice(k);
  const f0 = Math.min(0.1 * H, fit(first, "cd", 0.02, 0.2 * W, 1e9));
  for (let i = 0; i < 3; i++) {
    const o = tx(L, first, { cls: "cd", fs: f0, x: 0.06 * W, y: 0.24 * H + i * f0 * 0.95, ax: 0, color: i === 2 ? P.white : "transparent", stroke: i !== 2, sw: 0.02 });
    if (i !== 2) o.el.style.webkitTextStroke = `${Math.max(1, 1.2 * u)}px ${P.red}`;
    show(X, o.box, Math.max(0.03, ws[0].rt) + i * 0.06);
  }
  if (mid.length) {
    const fm = Math.min(0.14 * H, fit(U(J(mid)), "ex", 0.01, 0.55 * W, 1e9));
    line(X, L, mid, { cls: "ex", fs: fm, x: 0.08 * W + textW(first + " ", "cd", 0.02, f0), y: 0.24 * H + 2 * f0 * 0.95, ax: 0, color: P.red });
  }
  if (end.length) {
    const fe = Math.min(0.13 * H, fit(U(J(end)), "cd", 0.02, 0.6 * W, 1e9));
    line(X, L, end, { cls: "cd", fs: fe, x: 0.18 * W, y: 0.24 * H + 3 * f0 * 0.95 + fe * 0.4, ax: 0, color: P.white });
  }
};

/* ---- tarjetas de intro / cierre ---- */
B.intro = (sc, X) => { sc.slot.bg = "black"; B.echoCenter(sc, X); };
B.outro = (sc, X) => {
  sc.slot.bg = "paper";
  const { W, H, u } = X, L = bgLayer(X), ws = sc.words;
  const [a, b, c] = ws;
  if (a) { const fa = Math.min(0.17 * H, fit(U(a.text), "cd", 0.02, 0.6 * W, 1e9)); const t = tx(L, U(a.text), { cls: "cd", fs: fa, x: W / 2, y: 0.4 * H, color: P.ink }); show(X, t.box, a.rt); }
  if (b) { const t = tx(L, U(b.text), { cls: "lt", fs: 0.05 * H, x: W / 2, y: 0.53 * H, color: P.ink }); show(X, t.box, b.rt); }
  if (c) { const t = tx(L, U(c.text), { cls: "cd", fs: Math.min(0.07 * H, fit(U(c.text), "cd", 0.02, 0.6 * W, 1e9)), x: W / 2, y: 0.64 * H, color: P.red }); show(X, t.box, c.rt); }
};

/* cuándo cabe cada escena (frase = sc.words) */
const FITS = {
  echoCenter: sc => J(sc.words).length <= 34,
  duoLight: sc => sc.words.length >= 2 && sc.words.length <= 6,
  condensed: sc => J(sc.words).length <= 24,
  fadeStack: sc => sc.words.length >= 3,
  redFlat: sc => J(sc.words).length <= 30,
  paperMix: sc => sc.words.length >= 3,
  spacedOut: sc => J(sc.words).length <= 16,
  giantSpread: sc => sc.words[heroIdx(sc.words)].text.length >= 3 && sc.words[heroIdx(sc.words)].text.length <= 8,
  outlineRows: sc => J(sc.words).length <= 22,
  leftRight: sc => sc.words.length >= 3,
  band: sc => J(sc.words).length <= 16,
  ticker: sc => J(sc.words).length <= 28,
  rightStack: sc => sc.words.length >= 3,
  whiteCenter: sc => sc.words.length >= 2 && sc.words.length <= 5,
  blackStack: sc => sc.words.length >= 3 && sc.words.length <= 6
};
function makeTimeline(segs, dur) { return lyricTimeline(segs, dur, FITS); }
