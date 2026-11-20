/* Lyrics Hologram · escenas del mazo. El motor parte la letra en frases
   (phrases.maxWords / maxSec) y elige un tipo por frase con config.layouts
   (peso, fondos, medios y parámetros) entre los que cumplen `fits`. Cada palabra
   entra cuando se canta (K.words). Parámetros y fondos en DESIGN.md. */
const R = window.NexaPromo_lyrics_hologram_worlds, k = R.kit, S = R.S;
const IN = def => S.enum(["slide", "stamp", "glitch", "spread", "fade", "cut"], def);
const len = sc => k.J(sc.words).length;

/* 1 · holoWord: palabra fuerte enorme con relleno holográfico, ecos en contorno y el resto pequeño (THE / BADDEST) */
R.scenes.holoWord = {
  label: "Palabra holográfica con ecos", fits: () => true,
  params: { textIn: IN("stamp"), echoes: S.num(0, 3, 1), holo: S.bool(true) },
  render(sc, X, K) {
    const { W, H } = X, p = X.p, { L, fg } = k.bg(X, K), ws = K.words(X), hi = k.hero(ws), h = ws[hi], pt = k.port(X);
    const pre = ws.slice(0, hi), post = ws.slice(hi + 1);
    const fs = Math.min(k.fit(K, h.text, "fc", (pt ? 0.88 : 0.66) * W, (pt ? 0.2 : 0.36) * H), 0.4 * H), cy = 0.5 * H;
    if (p.echoes > 0) k.echoes(X, K, L, h.text, "fc", fs, W / 2, cy, Math.round(p.echoes), fg, h.rt + 0.06);
    const t = k.line(X, K, L, [h], { cls: "fc", fs, x: W / 2, y: cy, color: fg, holo: p.holo });
    const sf = Math.max(0.024 * H, fs * 0.2);
    if (pre.length) {
      const wp = K.textW(k.U(k.J(pre)), "fc", 0.04, sf), room = W / 2 - t.width / 2 - 0.03 * W;
      if (wp < room) k.line(X, K, L, pre, { cls: "fc", fs: sf, x: W / 2 - t.width / 2 - 0.012 * W, y: cy - fs * 0.3, ax: 1, color: fg, ls: 0.04, mode: "cut" });
      else k.line(X, K, L, pre, { cls: "fc", fs: Math.min(sf, k.fit(K, k.J(pre), "fc", 0.8 * W, sf)), x: W / 2, y: cy - fs * 0.62, color: fg, ls: 0.04, mode: "cut" });
    }
    if (post.length) k.line(X, K, L, post, { cls: "fc", fs: Math.min(sf, k.fit(K, k.J(post), "fc", 0.8 * W, sf, 0.2)), x: W / 2, y: cy + fs * 0.64, color: fg, ls: 0.2, mode: "cut" });
    k.ornaments(X, K, L, W / 2, cy - fs * (p.echoes > 0 ? 1.55 : 0.7), 4, 0.012 * Math.min(W, H) * 1.4, K.P.h1, h.rt);
  },
};

/* 2 · outlineBack: palabra gigante itálica en contorno (o holo) detrás y el resto en una banda blanca (BREAK / RULES) */
R.scenes.outlineBack = {
  label: "Gigante en contorno + banda", fits: sc => k.heroLen(sc) <= 9,
  params: { textIn: IN("cut"), fill: S.enum(["outline", "holo"], "outline"), band: S.bool(true) },
  render(sc, X, K) {
    const { W, H, u } = X, p = X.p, { L, fg } = k.bg(X, K), ws = K.words(X), h = ws[k.hero(ws)];
    const fb = Math.min(k.fit(K, h.text, "fw", 0.96 * W, 0.6 * H), 0.62 * H);
    const big = K.tx(L, k.U(h.text), { cls: "fw", fs: fb, x: W / 2, y: H / 2, ax: 0.5, color: fg, stroke: p.fill === "outline", sw: 0.006 });
    if (p.fill === "holo") k.holoFill(X, K, big.el);
    big.box.style.opacity = p.fill === "outline" ? "0.75" : "1";
    X.T(big.el, "clipPath", "inset(0% 100% 0% 0%)").to(Math.max(0, h.rt - 0.12), 0.3, "inset(0% 0% 0% 0%)", K.EASE_OUT);
    X.T(big.el, "transform", "scale(1.06)").to(0, X.dur, "scale(1)");
    const rest = ws.filter(w => w !== h), lab = rest.length ? rest : [h];
    const fr = Math.min(k.fit(K, k.J(lab), "fc", 0.5 * W, 0.13 * H), 0.13 * H), wr = K.textW(k.U(k.J(lab)), "fc", 0, fr);
    if (p.band) {
      const b = K.div(L, "patch", { left: W / 2 - wr / 2 - fr * 0.35 + "px", top: H / 2 - fr * 0.52 + "px", width: wr + fr * 0.7 + "px", height: fr * 1.04 + "px", background: K.P.white, transformOrigin: "0% 50%" });
      X.T(b, "transform", "scaleX(0)").to(Math.max(0, lab[0].rt - 0.08), 0.18, "scaleX(1)", K.EASE_OUT);
    }
    k.line(X, K, L, lab, { cls: "fc", fs: fr, x: W / 2, y: H / 2, color: p.band ? K.P.ink : fg });
    const os = 0.011 * Math.min(W, H) * 1.3;
    k.ornaments(X, K, L, W / 2, H / 2 - fb * 0.58, 4, os, K.P.h2, h.rt);
    k.ornaments(X, K, L, W / 2, H / 2 + fb * 0.58, 4, os, K.P.h2, h.rt + 0.1);
  },
};

/* 3 · slice: frase grande tapada por barras holográficas/blancas que se retiran (BAD DES T · LIVE · DIAMONDS) */
R.scenes.slice = {
  label: "Frase cortada por barras", fits: sc => sc.words.length <= 5,
  params: { textIn: IN("glitch"), bars: S.num(1, 6, 4), keep: S.num(0, 1, 0.15) },
  render(sc, X, K) {
    const { W, H } = X, p = X.p, { L, bg, fg } = k.bg(X, K), ws = K.words(X), pt = k.port(X);
    const rs = k.rows(ws, pt && ws.length > 1 ? 2 : 1);
    const fs = Math.min(...rs.map(r => k.fit(K, k.J(r), "fc", 0.82 * W, (pt ? 0.16 : 0.32) * H)), 0.34 * H);
    const hi = k.hero(ws);
    rs.forEach((r, i) => {
      const t = k.line(X, K, L, r, { cls: "fc", fs, x: W / 2, y: H / 2 + (i - (rs.length - 1) / 2) * fs * 0.95, color: fg, holoIdx: r.map((w, j) => (ws.indexOf(w) === hi ? j : -1)).filter(j => j >= 0) });
      k.bars(X, K, L, t.el, r[0].rt, { n: Math.round(p.bars), keep: p.keep, solid: K.P.white, kinds: X.light ? ["holo"] : null });
    });
  },
};

/* 4 · assemble: letras repartidas que se juntan en su sitio (R A / W D → REAL WILD) y un panel holo que cruza */
R.scenes.assemble = {
  label: "Letras que se ensamblan", fits: sc => sc.words.length <= 2 && len(sc) <= 11,
  params: { spread: S.num(1, 3, 1.9), holo: S.bool(true) },
  render(sc, X, K) {
    const { W, H } = X, p = X.p, { L, fg } = k.bg(X, K), ws = K.words(X), pt = k.port(X);
    const rs = ws.length === 2 ? [[ws[0]], [ws[1]]] : [ws];
    const fs = Math.min(...rs.map(r => k.fit(K, k.J(r), "fc", (pt ? 0.8 : 0.5) * W, (pt ? 0.2 : 0.34) * H)), 0.36 * H);
    const tA = Math.max(ws[ws.length - 1].rt + 0.12, 0.35);
    const pane = k.holoBox(X, K, L, { left: 0.36 * W + "px", top: H / 2 - fs * 0.5 + "px", width: 0.28 * W + "px", height: fs + "px", opacity: "0.95" });
    X.T(pane, "transform", `translateX(${(-0.5 * W).toFixed(0)}px)`).to(tA - 0.05, 0.55, `translateX(${(0.45 * W).toFixed(0)}px)`, K.EASE_IO);
    rs.forEach((r, ri) => {
      const T = k.U(k.J(r)), w = K.textW(T, "fc", 0, fs), x0 = W / 2 - w / 2, yf = H / 2 + (ri - (rs.length - 1) / 2) * fs * 0.95;
      [...T].forEach((c, i) => {
        if (c === " ") return;
        const xf = x0 + K.textW(T.slice(0, i), "fc", 0, fs);
        const t = K.tx(L, c, { cls: "fc", fs, x: xf, y: yf, ax: 0, color: fg });
        if (p.holo && (i + ri) % 2 === 0) k.holoFill(X, K, t.el);
        const dx = (xf + K.textW(c, "fc", 0, fs) / 2 - W / 2) * (p.spread - 1), dy = (ri - 0.5) * fs * 0.35 * (p.spread - 1);
        X.T(t.box, "transform", `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`).to(tA, 0.38, "translate(0px, 0px)", K.EASE_OUT);
        K.hide(X, t.box, r[0].rt + i * 0.025);
      });
    });
  },
};

/* 5 · repeatStack: la frase repetida en columna (contorno tenue) y la central sólida holográfica (LIGHT IT UP · SPLASH) */
R.scenes.repeatStack = {
  label: "Frase repetida en columna", fits: sc => len(sc) <= 16,
  params: { textIn: IN("slide"), rows: S.num(3, 11, 7), drift: S.num(0, 2, 1) },
  render(sc, X, K) {
    const { W, H } = X, p = X.p, { L, fg } = k.bg(X, K), ws = K.words(X), n = Math.round(p.rows) | 1, c = Math.floor(n / 2);
    const T = k.U(k.J(ws)), fs = Math.min(k.fit(K, T, "fc", 0.6 * W, H / (n * 0.9)), 0.2 * H), lh = fs * 0.88;
    const g = K.div(L, "lay");
    for (let i = 0; i < n; i++) {
      if (i === c) continue;
      const t = K.tx(g, T, { cls: "fc", fs, x: W / 2, y: H / 2 + (i - c) * lh, ax: 0.5, color: fg, stroke: true, sw: 0.01 });
      t.box.style.opacity = String(Math.max(0.15, 0.6 - Math.abs(i - c) * 0.1));
      K.hide(X, t.box, ws[0].rt + Math.abs(i - c) * 0.04);
    }
    const dy = 0.05 * H * p.drift;
    X.T(g, "transform", `translateY(${dy.toFixed(1)}px)`).to(0, X.dur, `translateY(${(-dy).toFixed(1)}px)`);
    k.line(X, K, L, ws, { cls: "fc", fs, x: W / 2, y: H / 2, color: fg, holo: true });
  },
};

/* 6 · verse: frase pequeña espaciada sobre la seda holográfica y la palabra fuerte enorme y tenue detrás (DOING · WANT) */
R.scenes.verse = {
  label: "Verso espaciado + fantasma", fits: () => true,
  params: { textIn: IN("cut"), ghost: S.bool(true), size: S.num(0.6, 1.6, 1) },
  render(sc, X, K) {
    const { W, H } = X, p = X.p, { L, fg } = k.bg(X, K), ws = K.words(X), h = ws[k.hero(ws)], pt = k.port(X);
    if (p.ghost) {
      const fg2 = Math.min(k.fit(K, h.text, "fc", 1.05 * W, 0.86 * H), 0.9 * H);
      const g = K.tx(L, k.U(h.text), { cls: "fc", fs: fg2, x: W / 2, y: H / 2, ax: 0.5, color: "rgba(255,255,255,0.16)" });
      g.el.style.webkitTextStroke = `${Math.max(1, fg2 * 0.004).toFixed(1)}px rgba(255,255,255,0.55)`;
      X.T(g.el, "transform", "scale(1.08)").to(0, X.dur, "scale(1)");
      X.T(g.box, "opacity", "0").to(Math.max(0, h.rt - 0.1), 0.35, "1");
    }
    const rs = k.rows(ws, pt && ws.length > 3 ? 2 : 1);
    const fs = Math.min(...rs.map(r => k.fit(K, k.J(r), "fc", (pt ? 0.8 : 0.62) * W, 0.06 * H * p.size, 0.3)), 0.07 * H * p.size);
    rs.forEach((r, i) => k.line(X, K, L, r, { cls: "fc", fs, x: W / 2, y: H / 2 + (i - (rs.length - 1) / 2) * fs * 1.4, color: fg, ls: 0.3 }));
  },
};

/* 7 · band: frase condensada alineada con barra holográfica que crece (THAT'S WHAT THE · YOUR BAGS · BREAKING) */
R.scenes.band = {
  label: "Frase con barra holográfica", fits: sc => sc.words.length >= 2,
  params: { textIn: IN("slide"), strike: S.bool(false), align: S.enum(["left", "center"], "left") },
  render(sc, X, K) {
    const { W, H } = X, p = X.p, { L, fg } = k.bg(X, K), ws = K.words(X), pt = k.port(X), center = p.align === "center" || pt;
    const rs = k.rows(ws, ws.length >= 4 ? 2 : 1);
    const fs = Math.min(...rs.map(r => k.fit(K, k.J(r), "fc", (pt ? 0.84 : 0.7) * W, (pt ? 0.1 : 0.17) * H)), 0.18 * H);
    const x = center ? W / 2 : 0.08 * W, ax = center ? 0.5 : 0, y0 = (pt ? 0.5 : 0.56) * H - (rs.length - 1) * fs * 0.48;
    let first = null;
    rs.forEach((r, i) => { const t = k.line(X, K, L, r, { cls: "fc", fs, x, y: y0 + i * fs * 0.96, ax, color: fg }); if (!first) first = t; });
    k.later(X, first.el, b => {
      const by = y0 + (rs.length - 1) * fs * 0.96 + fs * 0.62, bw = Math.max(b.w, 0.2 * W);
      const bar = k.holoBox(X, K, L, { left: (center ? W / 2 - bw / 2 : b.x) + "px", top: by + "px", width: bw + "px", height: Math.max(3, 0.018 * H) + "px", transformOrigin: "0% 50%" });
      X.T(bar, "transform", "scaleX(0)").to(ws[0].rt + 0.05, 0.45, "scaleX(1)", K.EASE_OUT);
      if (p.strike) {
        const s = k.holoBox(X, K, L, { left: b.x - 0.02 * W + "px", top: b.y + b.h * 0.5 + "px", width: b.w + 0.04 * W + "px", height: Math.max(2, 0.008 * H) + "px", transformOrigin: "0% 50%" });
        X.T(s, "transform", "scaleX(0)").to(ws[ws.length - 1].rt + 0.1, 0.3, "scaleX(1)", K.EASE_OUT);
      }
    });
    k.ornaments(X, K, L, center ? W / 2 : 0.08 * W + 0.06 * W, y0 - fs * 0.75, 3, 0.011 * Math.min(W, H) * 1.2, K.P.h2, ws[0].rt);
  },
};

/* 8 · panel: ventanas con medio holográfico que entran y la frase grande abajo a la izquierda (IN TWOS · paneles) */
R.scenes.panel = {
  label: "Ventanas de medio + frase", fits: sc => sc.words.length <= 6,
  params: { textIn: IN("slide"), windows: S.num(1, 3, 2) },
  render(sc, X, K) {
    const { W, H, u } = X, p = X.p, { L, fg } = k.bg(X, K, { bg: X.sc.slot.bg === "media" ? "void" : X.sc.slot.bg }), ws = K.words(X), pt = k.port(X);
    const n = Math.round(p.windows);
    const boxes = pt ? [[0.08, 0.1, 0.84, 0.42], [0.5, 0.06, 0.4, 0.2], [0.1, 0.4, 0.34, 0.16]] : [[0.5, 0.12, 0.42, 0.62], [0.3, 0.08, 0.22, 0.3], [0.78, 0.6, 0.17, 0.3]];
    for (let i = 0; i < n; i++) {
      const [bx, by, bw, bh] = boxes[i], lw = Math.max(2, 2 * u);
      const g = K.div(L, "patch", { left: bx * W + "px", top: by * H + "px", width: bw * W + "px", height: bh * H + "px" });
      k.holoBox(X, K, g, { left: -lw + "px", top: -lw + "px", width: bw * W + 2 * lw + "px", height: bh * H + 2 * lw + "px" });
      k.media(X, K, g, i % 2, { x: 0, y: 0, w: bw * W, h: bh * H }, { screen: false });
      const t0 = 0.04 + i * 0.12;
      X.T(g, "transform", `translateX(${((i % 2 ? -1 : 1) * 0.25 * W).toFixed(0)}px)`).to(t0, 0.42, "translateX(0px)", K.EASE_OUT);
      X.T(g, "clipPath", "inset(0% 0% 0% 100%)").to(t0, 0.35, "inset(0% 0% 0% 0%)", K.EASE_OUT);
    }
    const rs = k.rows(ws, ws.length >= 3 ? 2 : 1), hi = k.hero(ws);
    const fs = Math.min(...rs.map(r => k.fit(K, k.J(r), "fc", (pt ? 0.84 : 0.5) * W, (pt ? 0.1 : 0.15) * H)), 0.16 * H);
    const x = pt ? W / 2 : 0.06 * W, ax = pt ? 0.5 : 0, y0 = (pt ? 0.7 : 0.72) * H - (rs.length - 1) * fs * 0.46;
    rs.forEach((r, i) => k.line(X, K, L, r, { cls: "fc", fs, x, y: y0 + i * fs * 0.94, ax, color: fg, holoIdx: r.map((w, j) => (ws.indexOf(w) === hi ? j : -1)).filter(j => j >= 0) }));
  },
};

/* 9 · silhouette: silueta holográfica sobre filas gigantes de la palabra y la palabra sólida delante (MURDER · BLAZE) */
R.scenes.silhouette = {
  label: "Silueta holográfica + palabra", fits: sc => k.heroLen(sc) <= 10,
  params: { textIn: IN("stamp"), rows: S.num(0, 5, 3) },
  render(sc, X, K) {
    const { W, H } = X, p = X.p, { L, fg } = k.bg(X, K, { bg: X.sc.slot.bg === "holo" || X.sc.slot.bg === "pale" ? "void" : X.sc.slot.bg }), ws = K.words(X), h = ws[k.hero(ws)], pt = k.port(X);
    const n = Math.round(p.rows), T = k.U(h.text);
    if (n > 0) {
      const g = K.div(L, "lay", { transform: "rotate(-8deg) scale(1.25)" }), fr = H / n * 1.02;
      for (let i = 0; i < n; i++) {
        const t = K.tx(g, (T + " ").repeat(4), { cls: "fw", fs: fr, x: W / 2, y: H * (i + 0.5) / n, ax: 0.5, color: fg, stroke: true, sw: 0.006 });
        t.box.style.opacity = "0.32";
        const dx = (i % 2 ? 1 : -1) * 0.08 * W;
        X.T(t.box, "transform", `translate(-50%, -50%) translateX(${(-dx).toFixed(1)}px)`).to(0, X.dur, `translate(-50%, -50%) translateX(${dx.toFixed(1)}px)`);
      }
    }
    const sil = k.silSlot(X, K);
    if (sil !== null) k.media(X, K, L, sil, pt ? { x: -0.2 * W, y: 0.08 * H, w: 1.4 * W, h: 0.8 * H } : { x: -0.08 * W, y: 0, w: 0.9 * W, h: H });
    const fs = Math.min(k.fit(K, h.text, "fw", (pt ? 0.86 : 0.5) * W, (pt ? 0.12 : 0.28) * H), 0.3 * H);
    k.line(X, K, L, [h], { cls: "fw", fs, x: pt ? W / 2 : 0.7 * W, y: pt ? 0.8 * H : 0.56 * H, color: fg });
    const rest = ws.filter(w => w !== h);
    if (rest.length) k.line(X, K, L, rest, { cls: "fc", fs: Math.min(fs * 0.3, k.fit(K, k.J(rest), "fc", 0.4 * W, fs * 0.3, 0.12)), x: pt ? W / 2 : 0.7 * W, y: (pt ? 0.8 * H : 0.56 * H) - fs * 0.7, color: fg, ls: 0.12, mode: "cut" });
  },
};

/* 10 · trio: la palabra fuerte tres veces con el resto pequeño encima de cada una (WANT WANT WANT) */
R.scenes.trio = {
  label: "Palabra ×3 con rótulo", fits: sc => k.heroLen(sc) <= 8,
  params: { textIn: IN("cut"), box: S.bool(true) },
  render(sc, X, K) {
    const { W, H } = X, p = X.p, { L, bg, fg } = k.bg(X, K), ws = K.words(X), h = ws[k.hero(ws)], pt = k.port(X), rest = ws.filter(w => w !== h);
    const boxed = p.box && !k.dark(bg), col = boxed ? K.P.white : fg;
    const fs = Math.min(k.fit(K, h.text, "fc", (pt ? 0.6 : 0.21) * W, (pt ? 0.14 : 0.2) * H), 0.22 * H);
    if (boxed) { const b = K.div(L, "patch", { left: (pt ? 0.12 : 0.1) * W + "px", top: (pt ? 0.22 : 0.18) * H + "px", width: (pt ? 0.76 : 0.8) * W + "px", height: (pt ? 0.56 : 0.64) * H + "px", background: K.P.void }); X.T(b, "transform", "scaleY(0)").to(0.02, 0.25, "scaleY(1)", K.EASE_OUT); }
    for (let i = 0; i < 3; i++) {
      const x = pt ? W / 2 : W * (0.25 + i * 0.25), y = pt ? H * (0.33 + i * 0.17) : H / 2, t0 = h.rt + i * 0.12;
      const t = k.line(X, K, L, [{ text: h.text, rt: t0 }], { cls: "fc", fs, x, y, color: col, holo: i === 1 });
      if (rest.length) { const s = K.tx(L, k.U(k.J(rest)), { cls: "fc", fs: Math.min(fs * 0.24, k.fit(K, k.J(rest), "fc", (pt ? 0.5 : 0.2) * W, fs * 0.24, 0.1)), x, y: y - fs * 0.62, ax: 0.5, color: col, ls: 0.1 }); s.box.style.opacity = "0.7"; K.hide(X, s.box, rest[0].rt); }
    }
  },
};

/* 11 · chrome: palabra a sangre con relleno holográfico y el resto como rótulo cruzado (FLEX · SAY · SORRY) */
R.scenes.chrome = {
  label: "Palabra holográfica a sangre", fits: sc => k.heroLen(sc) <= 8,
  params: { textIn: IN("slide"), caption: S.bool(true) },
  render(sc, X, K) {
    const { W, H } = X, p = X.p, { L, bg } = k.bg(X, K), ws = K.words(X), h = ws[k.hero(ws)], pt = k.port(X);
    const fs = Math.min(k.fit(K, h.text, "fc", 0.94 * W, (pt ? 0.34 : 0.82) * H), 0.86 * H);
    const t = k.line(X, K, L, [h], { cls: "fc", fs, x: W / 2, y: H / 2, color: K.P.white, holo: true });
    X.T(t.box, "transform", "translate(-50%, -50%) scale(1.04)").to(0, X.dur, "translate(-50%, -50%) scale(1)");
    const rest = ws.filter(w => w !== h);
    if (p.caption && rest.length) {
      const fr = Math.min(k.fit(K, k.J(rest), "fc", 0.5 * W, 0.06 * H, 0.08), 0.07 * H);
      const cap = k.line(X, K, L, rest, { cls: "fc", fs: fr, x: W / 2, y: H / 2 + fs * 0.06, color: X.light ? K.P.white : K.P.void, ls: 0.08, mode: "cut" });
      if (X.light) cap.el.style.textShadow = `0 0 ${(0.01 * H).toFixed(1)}px rgba(16,14,28,0.6)`;
    }
    if (k.dark(bg)) k.ornaments(X, K, L, W / 2, H / 2 + fs * 0.5, 5, 0.011 * Math.min(W, H) * 1.3, K.P.h1, h.rt + 0.1);
  },
};

/* 12 · vertical: la palabra fuerte en columna (holo/lila) y el resto repetido a izquierda y derecha (NEVER GOING BACK) */
R.scenes.vertical = {
  label: "Palabra en columna + laterales", fits: sc => k.heroLen(sc) <= 7,
  params: { textIn: IN("cut"), holo: S.bool(true), ghost: S.bool(true) },
  render(sc, X, K) {
    const { W, H } = X, p = X.p, { L, fg } = k.bg(X, K), ws = K.words(X), h = ws[k.hero(ws)], pt = k.port(X), cs = [...k.U(h.text)];
    if (p.ghost) {
      const gf = Math.min(k.fit(K, h.text, "fc", 1.2 * W, 1.1 * H), 1.1 * H), g = K.tx(L, k.U(h.text), { cls: "fc", fs: gf, x: W / 2, y: H / 2, ax: 0.5, color: fg, stroke: true, sw: 0.003 });
      g.box.style.opacity = "0.3";
    }
    const fs = Math.min((pt ? 0.62 : 0.8) * H / cs.length, (pt ? 0.2 : 0.16) * H);
    cs.forEach((c, i) => {
      const t = K.tx(L, c, { cls: "fc", fs, x: W / 2, y: H / 2 + (i - (cs.length - 1) / 2) * fs * 0.92, ax: 0.5, color: K.P.h1 });
      if (p.holo) k.holoFill(X, K, t.el);
      k.enter(X, K, t.el, "slide", h.rt + i * 0.05);
    });
    const rest = ws.filter(w => w !== h);
    if (rest.length) {
      const fr = Math.min(k.fit(K, k.J(rest), "fc", (pt ? 0.36 : 0.3) * W, 0.045 * H), 0.05 * H);
      for (const s of [-1, 1]) k.line(X, K, L, rest, { cls: "fc", fs: fr, x: W / 2 + s * (fs * 0.6 + 0.04 * W), y: H / 2, ax: s < 0 ? 1 : 0, color: fg, mode: "cut" });
    }
  },
};

/* 13 · giantOutline: letras en contorno más grandes que el cuadro y la frase encima (GOING · NAH NOT) */
R.scenes.giantOutline = {
  label: "Contorno gigante + frase", fits: sc => len(sc) <= 18,
  params: { textIn: IN("stamp"), drift: S.num(0, 2, 1) },
  render(sc, X, K) {
    const { W, H } = X, p = X.p, { L, fg } = k.bg(X, K), ws = K.words(X), h = ws[k.hero(ws)], pt = k.port(X);
    const gf = 1.25 * H * (pt ? 0.62 : 1), g = K.tx(L, k.U(h.text), { cls: "fc", fs: gf, x: W / 2, y: H / 2, ax: 0.5, color: fg, stroke: true, sw: 0.0025 });
    g.box.style.opacity = "0.42";
    const dx = 0.06 * W * p.drift;
    X.T(g.el, "transform", `translateX(${dx.toFixed(1)}px)`).to(0, X.dur, `translateX(${(-dx).toFixed(1)}px)`);
    const rs = k.rows(ws, pt && ws.length > 2 ? 2 : 1);
    const fs = Math.min(...rs.map(r => k.fit(K, k.J(r), "fc", (pt ? 0.8 : 0.6) * W, (pt ? 0.11 : 0.2) * H)), 0.2 * H);
    rs.forEach((r, i) => k.line(X, K, L, r, { cls: "fc", fs, x: W / 2, y: H / 2 + (i - (rs.length - 1) / 2) * fs * 0.95, color: fg,
      strokeIdx: r.length > 1 ? r.map((_, j) => j).filter(j => j % 2 === 0) : [], sw: 0.014 }));
  },
};

/* 14 · rows: filas inclinadas de «PALABRA //» que corren, silueta opcional (figure) y la palabra al centro (CLAP // CLAP) */
R.scenes.rows = {
  label: "Filas inclinadas que corren", fits: sc => k.heroLen(sc) <= 10,
  params: { textIn: IN("stamp"), rows: S.num(4, 16, 10), figure: S.bool(true) },
  render(sc, X, K) {
    const { W, H } = X, p = X.p, { L, bg, fg } = k.bg(X, K), ws = K.words(X), h = ws[k.hero(ws)], pt = k.port(X);
    const n = Math.round(p.rows), lh = H * 1.4 / n, T = (k.U(h.text) + " // ").repeat(12);
    const g = K.div(L, "lay", { transform: "rotate(-7deg) scale(1.2)" });
    for (let i = 0; i < n; i++) {
      const t = K.tx(g, T, { cls: "fc", fs: lh * 0.78, x: W / 2, y: -0.2 * H + (i + 0.5) * lh, ax: 0.5, color: fg });
      t.box.style.opacity = String(0.22 + (i % 3 === 0 ? 0.3 : 0));
      const dx = (i % 2 ? 1 : -1) * 0.1 * W;
      X.T(t.el, "transform", `translateX(${(-dx).toFixed(1)}px)`).to(0, X.dur, `translateX(${dx.toFixed(1)}px)`);
      K.hide(X, t.box, Math.min(h.rt, 0.3) + (i % 4) * 0.03);
    }
    const sil = p.figure ? k.silSlot(X, K) : null;
    if (sil !== null) {
      k.media(X, K, L, sil, pt ? { x: -0.25 * W, y: 0.12 * H, w: 1.5 * W, h: 0.76 * H } : { x: 0.05 * W, y: 0, w: 0.9 * W, h: H }, { ink: !k.dark(bg) });
    }
    const fs = Math.min(k.fit(K, h.text, "fc", (pt ? 0.84 : 0.5) * W, (pt ? 0.14 : 0.3) * H), 0.32 * H);
    k.line(X, K, L, [h], { cls: "fc", fs, x: W / 2, y: H / 2, color: fg, holo: k.dark(bg) });
  },
};
