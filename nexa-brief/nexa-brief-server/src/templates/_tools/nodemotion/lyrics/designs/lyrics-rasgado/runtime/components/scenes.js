/* Lyrics Rasgado · escenas del mazo. El motor parte la letra en frases
   (phrases.maxWords / maxSec) y elige un tipo por frase con config.layouts
   (peso, fondos y parámetros) entre los que cumplen `fits`. Cada palabra entra
   cuando se canta (K.words). Ver DESIGN.md para parámetros. */
const R = window.NexaPromo_lyrics_rasgado, k = R.kit, S = R.S;
const TEXT_IN = S.enum(["mask", "stamp", "type", "fade", "cut"], "mask");
const len = sc => k.J(sc.words).length;
const heroLen = sc => sc.words.length ? sc.words[k.hero(sc.words)].text.length : 0;
/* reparte palabras en n renglones equilibrando caracteres */
function rows(ws, n) {
  if (n <= 1 || ws.length <= 1) return [ws];
  const total = k.J(ws).length, out = [[]]; let acc = 0;
  for (const w of ws) {
    if (out[out.length - 1].length && acc >= total * out.length / n && out.length < n) out.push([]);
    out[out.length - 1].push(w); acc += w.text.length + 1;
  }
  return out.filter(r => r.length);
}
const port = X => X.W < X.H;

/* 1 · build: palabras condensadas que se suman una a una con tamaños distintos e inclinación */
R.scenes.build = {
  label: "Palabras que se suman (condensada)", fits: sc => sc.words.length <= 7,
  params: { textIn: TEXT_IN, sizeJitter: S.num(0, 0.5, 0.25), tiltDeg: S.num(-12, 12, -4) },
  render(sc, X, K) {
    const { W, H } = X, p = X.p, { L, bg } = k.bg(X, K), ws = K.words(X), col = k.colorOn(K, bg);
    const rs = rows(ws, port(X) ? Math.min(3, Math.ceil(ws.length / 2)) : ws.length > 4 ? 2 : 1);
    const lh = (port(X) ? 0.2 : (ws.length <= 3 ? 0.36 : 0.28)) * H / Math.max(1, rs.length * 0.75);
    const grp = K.div(L, "lay");
    let i0 = 0;
    rs.forEach((r, i) => {
      const sizes = r.map((_, j) => 1 - p.sizeJitter / 2 + X.r() * p.sizeJitter + (j === r.length - 1 ? p.sizeJitter * 0.4 : 0));
      const fs = Math.min(lh, k.fit(K, k.J(r), "fc", 0.88 * W, lh));
      k.line(X, K, grp, r, { cls: "fc", fs, x: W / 2, y: H / 2 + (i - (rs.length - 1) / 2) * fs * 0.98, color: col, sizes });
      i0 += r.length;
    });
    k.tilt(X, K, grp, p.tiltDeg);
    k.scatter(X, K, L, 2, k.accentOn(K, bg), { x: 0.1 * W, y: 0.3 * H, w: 0.8 * W, h: 0.4 * H });
  },
};

/* 2 · stack2: renglón extendido muy negro + renglón condensado */
R.scenes.stack2 = {
  label: "Extendida + condensada", fits: sc => sc.words.length >= 2 && sc.words.length <= 8,
  params: { textIn: TEXT_IN, swap: S.bool(false) },
  render(sc, X, K) {
    const { W, H } = X, p = X.p, { L, bg } = k.bg(X, K), ws = K.words(X), col = k.colorOn(K, bg);
    const [a, b] = rows(ws, 2);
    const ca = p.swap ? "fc" : "fw", cb = p.swap ? "fw" : "fc";
    const fa = k.fit(K, k.J(a), ca, 0.86 * W, (port(X) ? 0.13 : 0.27) * H), fb = b ? k.fit(K, k.J(b), cb, 0.86 * W, (port(X) ? 0.13 : 0.27) * H) : 0;
    const top = H / 2 - (fa + fb * 0.95) / 2 + fa / 2;
    k.line(X, K, L, a, { cls: ca, fs: fa, x: W / 2, y: top, color: col });
    if (b) k.line(X, K, L, b, { cls: cb, fs: fb, x: W / 2, y: top + fa * 0.5 + fb * 0.52, color: col });
    k.scatter(X, K, L, 2, k.accentOn(K, bg), { x: 0.08 * W, y: top - fa, w: 0.84 * W, h: fa + fb * 1.2 });
  },
};

/* 3 · echo3: la palabra fuerte tres veces (contorno · sólida · contorno) */
R.scenes.echo3 = {
  label: "Palabra ×3 contorno/sólida", fits: sc => heroLen(sc) <= 10,
  params: { textIn: S.enum(["mask", "stamp", "type", "fade", "cut"], "stamp") },
  render(sc, X, K) {
    const { W, H, u } = X, p = X.p, { L, bg } = k.bg(X, K), ws = K.words(X), col = k.colorOn(K, bg);
    const h = ws[k.hero(ws)], word = [h];
    const fs = Math.min(k.fit(K, h.text, "fw", 0.78 * W, (port(X) ? 0.11 : 0.19) * H), 0.2 * H);
    [-1, 0, 1].forEach(d => {
      const t = k.line(X, K, L, word, { cls: "fw", fs, x: W / 2, y: H / 2 + d * fs * 0.98, color: col, stroke: d !== 0, mode: d === 0 ? p.textIn : "fade" });
      if (d) X.T(t.el, "transform", `translateX(${(d * 10 * u).toFixed(1)}px)`).to(h.rt, 0.5, "translateX(0px)", K.EASE_OUT);
    });
    const rest = ws.filter(w => w !== h);
    if (rest.length) k.line(X, K, L, rest, { cls: "ft", fs: fs * 0.22, x: W / 2, y: H / 2 + fs * 1.75, color: col, ls: 0.4 });
    k.scatter(X, K, L, 2, k.accentOn(K, bg), { x: 0.1 * W, y: H / 2 - fs * 1.6, w: 0.8 * W, h: fs * 3.2 });
  },
};

/* 4 · warp: primera palabra enorme e inclinada en perspectiva, resto mezclando fina y negra */
R.scenes.warp = {
  label: "Palabra en perspectiva + mezcla fina/negra", fits: sc => sc.words.length >= 2 && sc.words.length <= 4,
  params: { textIn: S.enum(["mask", "stamp", "type", "fade", "cut"], "stamp"), angle: S.num(-25, 25, -12) },
  render(sc, X, K) {
    const { W, H } = X, p = X.p, { L, bg } = k.bg(X, K), ws = K.words(X), col = k.colorOn(K, bg);
    const [a, ...rest] = ws;
    const fa = Math.min(k.fit(K, a.text, "fw", 0.62 * W, 0.34 * H), 0.36 * H);
    const g = K.div(L, "lay", { transform: `perspective(${(1.4 * W).toFixed(0)}px) rotateY(${(-p.angle * 1.4).toFixed(1)}deg) rotate(${p.angle.toFixed(1)}deg)`, transformOrigin: "35% 50%" });
    const ta = k.line(X, K, g, [a], { cls: "fw", fs: fa, x: port(X) ? W / 2 : 0.42 * W, y: 0.46 * H, color: col });
    if (rest.length) {
      const fr = Math.min(k.fit(K, k.J(rest), "fw", 0.45 * W, 0.14 * H), fa * 0.45);
      k.line(X, K, g, rest, { cls: "fw", fs: fr, x: port(X) ? W / 2 : 0.42 * W + ta.width * 0.38, y: port(X) ? 0.46 * H + fa * 0.62 : 0.46 * H - fa * 0.18, ax: port(X) ? 0.5 : 0, color: col,
        wordCls: rest.map((_, i) => (i % 2 ? "fw" : "ft")) });
    }
    k.scatter(X, K, L, 1, k.accentOn(K, bg));
  },
};

/* 5 · circle: frase condensada con una palabra corta rodeada a mano (IT'S HIM (OR) ME) */
R.scenes.circle = {
  label: "Frase + palabra rodeada a mano", fits: sc => sc.words.length >= 2 && sc.words.length <= 6 && sc.words.some(w => w.text.length <= 4),
  params: { textIn: TEXT_IN },
  render(sc, X, K) {
    const { W, H } = X, p = X.p, { L, bg } = k.bg(X, K), ws = K.words(X), col = k.colorOn(K, bg), acc = k.accentOn(K, bg);
    const fs = Math.min(k.fit(K, k.J(ws), "fc", 0.84 * W, (port(X) ? 0.12 : 0.24) * H), 0.26 * H);
    const t = k.line(X, K, L, ws, { cls: "fc", fs, x: W / 2, y: H / 2, color: col });
    let ci = ws.findIndex((w, i) => i > 0 && w.text.length <= 3);
    if (ci < 0) ci = ws.findIndex(w => w.text.length <= 4);
    const span = t.words[ci];
    if (span) { span.style.color = acc; span.style.fontSize = "62%"; span.style.verticalAlign = "middle"; k.later(X, span, b => k.doodle(X, K, L, "circle", b, ws[ci].rt, acc, 0.3)); }
    k.scatter(X, K, L, 1, acc, { x: 0.1 * W, y: 0.35 * H, w: 0.8 * W, h: 0.3 * H });
  },
};

/* 6 · spaced: letras de la palabra fuerte repartidas a lo ancho (fina) que se juntan en la frase extendida */
R.scenes.spaced = {
  label: "Letras repartidas que se juntan", fits: sc => heroLen(sc) <= 8,
  params: { collapseAt: S.num(0.3, 0.9, 0.55) },
  render(sc, X, K) {
    const { W, H, u } = X, p = X.p, { L, bg } = k.bg(X, K), ws = K.words(X), col = k.colorOn(K, bg);
    const h = ws[k.hero(ws)], letters = [...k.U(h.text)], n = letters.length;
    const fs = Math.min(0.2 * H, 0.9 * W / n * 0.9), tc = Math.max(h.rt + 0.3, X.dur * p.collapseAt);
    const g = K.div(L, "lay");
    letters.forEach((c, i) => {
      const x = W * (0.08 + 0.84 * (n > 1 ? i / (n - 1) : 0.5));
      const t = K.tx(g, c, { cls: "ft", fs, x, y: H / 2, ax: 0.5, color: col });
      K.hide(X, t.box, h.rt + i * 0.04);
    });
    X.T(g, "opacity", "1").to(tc, 0.1, "0");
    const fp = Math.min(k.fit(K, k.J(ws), "fw", 0.78 * W, 0.11 * H), 0.12 * H);
    const ph = k.line(X, K, L, ws, { cls: "fw", fs: fp, x: W / 2, y: H / 2, color: col, mode: "cut" });
    K.hide(X, ph.box, tc + 0.12);
    X.T(ph.el, "letterSpacing", "0.6em").to(tc + 0.12, 0.3, "0em", K.EASE_OUT);
    k.scatter(X, K, L, 1, k.accentOn(K, bg));
  },
};

/* 7 · brush: palabra extendida negra con pincelada lima detrás */
R.scenes.brush = {
  label: "Palabra con pincelada", fits: sc => heroLen(sc) <= 10,
  params: { textIn: TEXT_IN },
  render(sc, X, K) {
    const { W, H } = X, p = X.p, { L, bg } = k.bg(X, K, { bg: X.sc.slot.bg === "lime" ? "paper" : X.sc.slot.bg }), ws = K.words(X);
    const h = ws[k.hero(ws)], col = k.colorOn(K, bg), brushCol = bg === "ink" || bg === "media" ? K.P.lime : K.P.lime;
    const fs = Math.min(k.fit(K, h.text, "fw", 0.78 * W, 0.26 * H), 0.26 * H);
    const t = k.line(X, K, L, [h], { cls: "fw", fs, x: W / 2, y: H / 2, color: bg === "ink" || bg === "media" ? K.P.ink : col });
    k.brush(X, K, L, t.el, Math.max(0.02, h.rt - 0.08), brushCol);
    const rest = ws.filter(w => w !== h);
    if (rest.length) k.line(X, K, L, rest, { cls: "fc", fs: fs * 0.4, x: W / 2, y: H / 2 - fs * 0.85, color: col });
    k.scatter(X, K, L, 2, bg === "paper" ? K.P.lime : K.P.paper, { x: 0.1 * W, y: H / 2 - fs, w: 0.8 * W, h: fs * 2 });
  },
};

/* 8 · rise: frase condensada lima que sube palabra a palabra sobre carbón (+ palabra en contorno) */
R.scenes.rise = {
  label: "Frase lima que sube", fits: sc => sc.words.length >= 2,
  params: { textIn: S.enum(["mask", "stamp", "type", "fade", "cut"], "mask"), outlineHero: S.bool(true) },
  render(sc, X, K) {
    const { W, H } = X, p = X.p, { L, bg } = k.bg(X, K, { bg: X.sc.slot.bg === "paper" ? "ink" : X.sc.slot.bg }), ws = K.words(X);
    const col = bg === "lime" ? K.P.ink : K.P.lime;
    /* en vertical la frase se reparte en renglones para ganar tamaño */
    const rs = port(X) ? rows(ws, Math.min(3, Math.ceil(ws.length / 2))) : [ws];
    const fs = Math.min(...rs.map(r => k.fit(K, k.J(r), "fc", 0.84 * W, (port(X) ? 0.12 : 0.17) * H)), 0.18 * H);
    rs.forEach((r, i) => k.line(X, K, L, r, { cls: "fc", fs, x: W / 2, y: 0.56 * H + i * fs * 0.98, color: col }));
    if (p.outlineHero) {
      const h = ws[k.hero(ws)], fh = Math.min(k.fit(K, h.text, "fc", 0.9 * W, 0.34 * H), 0.36 * H);
      const t = k.line(X, K, L, [h], { cls: "fc", fs: fh, x: W / 2, y: 0.22 * H, color: col, stroke: true, mode: "fade" });
      t.box.style.opacity = "0.6";
    }
    k.scatter(X, K, L, 2, col, { x: 0.1 * W, y: 0.45 * H, w: 0.8 * W, h: 0.2 * H });
  },
};

/* 9 · giant: la palabra fuerte enorme recortada por el cuadro; el resto como rótulo */
R.scenes.giant = {
  label: "Palabra gigante", fits: sc => heroLen(sc) <= 9,
  params: { textIn: S.enum(["mask", "stamp", "type", "fade", "cut"], "stamp"), color: S.enum(["auto", "lime", "ink", "paper"], "auto") },
  render(sc, X, K) {
    const { W, H } = X, p = X.p, { L, bg } = k.bg(X, K), ws = K.words(X);
    const col = p.color === "auto" ? (bg === "ink" || bg === "media" ? K.P.lime : K.P.ink) : K.P[p.color];
    const h = ws[k.hero(ws)];
    const fs = Math.min(k.fit(K, h.text, "fc", 0.96 * W, 0.92 * H), 0.95 * H);
    const t = k.line(X, K, L, [h], { cls: "fc", fs, x: W / 2, y: 0.54 * H, color: col });
    k.tilt(X, K, t.box, (X.r() - 0.5) * 6);
    const rest = ws.filter(w => w !== h);
    if (rest.length) k.line(X, K, L, rest, { cls: "fw", fs: Math.min(0.06 * H, k.fit(K, k.J(rest), "fw", 0.6 * W, 0.06 * H)), x: W / 2, y: 0.1 * H, color: k.colorOn(K, bg) });
    k.scatter(X, K, L, 3, bg === "lime" ? K.P.paper : K.P.lime);
  },
};

/* 10 · wide: frase extendida negra en 2-3 renglones escalonados (THE SQUAD / THE ANGELIC / SLUM RATS) */
R.scenes.wide = {
  label: "Renglones extendidos escalonados", fits: sc => sc.words.length >= 3,
  params: { textIn: TEXT_IN, rows: S.num(2, 4, 3) },
  render(sc, X, K) {
    const { W, H } = X, p = X.p, { L, bg } = k.bg(X, K), ws = K.words(X), col = k.colorOn(K, bg);
    const rs = rows(ws, Math.min(Math.round(p.rows), ws.length));
    const fs = Math.min(...rs.map(r => k.fit(K, k.J(r), "fw", 0.8 * W, (port(X) ? 0.085 : 0.14) * H)));
    rs.forEach((r, i) => {
      const off = [0, 0.04, -0.02, 0.05][i % 4] * W;
      k.line(X, K, L, r, { cls: "fw", fs, x: 0.1 * W + off, y: H / 2 + (i - (rs.length - 1) / 2) * fs * 1.12, ax: 0, color: col });
    });
    k.scatter(X, K, L, 2, bg === "lime" ? K.P.ink : K.P.lime, { x: 0.08 * W, y: H / 2 - rs.length * fs * 0.6, w: 0.84 * W, h: rs.length * fs * 1.2 });
  },
};

/* 11 · marquee: palabra fuerte repetida en filas enormes que corren (negra / lima / contorno) */
R.scenes.marquee = {
  label: "Filas enormes que corren", fits: sc => heroLen(sc) <= 7,
  params: { rows: S.num(3, 6, 4), speed: S.num(0, 2, 1) },
  render(sc, X, K) {
    const { W, H } = X, p = X.p, { L } = k.bg(X, K, { bg: "paper", bands: false }), ws = K.words(X);
    const h = ws[k.hero(ws)], n = Math.round(p.rows), lh = H / n, fs = lh * 1.05, txt = (k.U(h.text) + " ").repeat(4);
    for (let i = 0; i < n; i++) {
      const row = K.div(L, "lay"), kind = i % 3;
      const t = K.tx(row, txt, { cls: "fw", fs, x: W / 2, y: lh * (i + 0.5), ax: 0.5, color: kind === 1 ? K.P.lime : K.P.ink, ls: 0.02 });
      if (kind === 2) { t.el.style.color = "transparent"; t.el.style.webkitTextStroke = `${Math.max(1.5, fs * 0.012)}px ${K.P.ink}`; }
      const dx = (i % 2 ? 1 : -1) * 0.12 * W * p.speed;
      X.T(row, "transform", `translateX(${(-dx).toFixed(1)}px)`).to(0, X.dur + 0.4, `translateX(${dx.toFixed(1)}px)`);
      K.hide(X, row, h.rt + i * 0.05);
    }
  },
};

/* 12 · strike: frase condensada con su copia en contorno tachada encima y el resto en lima contorno */
R.scenes.strike = {
  label: "Frase con copia tachada", fits: sc => sc.words.length >= 3,
  params: { textIn: TEXT_IN },
  render(sc, X, K) {
    const { W, H, u } = X, p = X.p, { L, bg } = k.bg(X, K, { bg: X.sc.slot.bg === "lime" ? "ink" : X.sc.slot.bg }), ws = K.words(X), col = k.colorOn(K, bg);
    const [a, b] = rows(ws, ws.length >= 5 || (port(X) && ws.length >= 3) ? 2 : 1);
    const fs = Math.min(k.fit(K, k.J(a), "fc", 0.8 * W, (port(X) ? 0.1 : 0.16) * H), 0.17 * H), y = 0.46 * H;
    const ghost = k.line(X, K, L, a, { cls: "fc", fs, x: W / 2, y: y - fs * 0.95, color: col, stroke: true, mode: "fade" });
    k.later(X, ghost.el, bx => k.doodle(X, K, L, "scribble", { x: bx.x, y: bx.y + bx.h * 0.2, w: bx.w, h: bx.h * 0.25 }, a[0].rt + 0.15, K.P.lime, 0.25));
    k.line(X, K, L, a, { cls: "fc", fs, x: W / 2, y, color: col });
    if (b) k.line(X, K, L, b, { cls: "fc", fs, x: W / 2, y: y + fs * 1.0, color: K.P.lime, stroke: true });
    k.scatter(X, K, L, 1, K.P.lime);
  },
};

/* 13 · tear: frase grande partida por una franja de papel rasgado que la cruza */
R.scenes.tear = {
  label: "Frase partida por papel rasgado", fits: sc => sc.words.length <= 4,
  params: { textIn: TEXT_IN },
  render(sc, X, K) {
    const { W, H } = X, p = X.p, { L, bg } = k.bg(X, K, { bg: X.sc.slot.bg === "media" ? "paper" : X.sc.slot.bg, bands: false }), ws = K.words(X), col = k.colorOn(K, bg);
    const fs = Math.min(k.fit(K, k.J(ws), "fc", 0.86 * W, 0.4 * H), 0.42 * H);
    const t = k.line(X, K, L, ws, { cls: "fc", fs, x: W / 2, y: 0.55 * H, color: col });
    /* mitad inferior desplazada: copia recortada debajo de la rasgadura */
    const band = k.tornBand(X, K, L, "bottom", bg === "ink" ? K.P.paper : K.P.ink, 0.47 * H, { amp: 0.12 });
    const low = K.div(band, "lay", { overflow: "hidden", clipPath: band.lastChild.style.clipPath });   /* solo dentro de la hoja rasgada */
    const t2 = K.tx(low, k.U(k.J(ws)), { cls: "fc", fs, x: W / 2 + 0.012 * W, y: 0.55 * H - 0.53 * H, ax: 0.5, color: bg === "ink" ? K.P.ink : K.P.paper });
    K.hide(X, t2.box, ws[ws.length - 1].rt);
    X.T(band, "transform", "translateY(100%)").to(ws[0].rt + 0.1, 0.3, "translateY(0%)", K.EASE_OUT);
    k.scatter(X, K, L, 1, K.P.lime);
  },
};
