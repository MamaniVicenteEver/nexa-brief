/* Promo Pulse · escenas reutilizables (renglón 1 = palabra principal,
   renglón 2 = frase corta o palabra secundaria; parámetros del slot en
   config.scenes[i], ver DESIGN.md).
   De la referencia: full, framed, knockout, badge, split3.
   Nuevas en el mismo lenguaje: marquee, counter. */
const R = window.NexaPromo_promo_pulse, k = R.kit, S = R.S;
const GRADE = S.enum(["cine", "dim", "none"], "cine");
const MOTION = S.enum(["zoom", "drift", "still"], "zoom");
const TEXT_IN = S.enum(["slam", "rise", "wipe", "type", "fade", "cut"], "slam");

R.scenes.full = {
  label: "Video completo + palabra + medidor",
  params: { grade: GRADE, motion: MOTION, textIn: TEXT_IN, pos: S.enum(["bl", "br", "center", "l", "r"], "bl"), size: S.num(0.5, 1.6, 1),
    meter: S.bool(true), brackets: S.bool(false) },
  render(sc, X, K) {
    const { W, H, u } = X, p = X.p, ls = K.lines(X), main = ls[0]?.text || "", sub = ls[1]?.text || "";
    const L = k.black(X, K);
    k.full(X, K, L, 0, p);
    k.vignette(X, K, L);
    const port = W < H;
    const fs = Math.min(k.fitFs(K, main, "dp", (port ? 0.8 : 0.42) * W * p.size, (port ? 0.15 : 0.24) * H * p.size), 0.3 * H);
    const pos = { bl: [0.07, 0.72, 0], br: [0.93, 0.72, 1], center: [0.5, 0.5, 0.5], l: [0.07, 0.5, 0], r: [0.93, 0.5, 1] }[p.pos];
    const x = pos[0] * W, y = pos[1] * H, t0 = ls[0]?.rt ?? 0.1;
    const w = k.title(X, K, L, main, { x, y, ax: pos[2], fs, t0 });
    if (p.meter) k.meter(X, K, L, w.left + w.width * 0.25, y - fs * 0.62, { n: 8, len: Math.min(140, w.width / u * 0.5), t0: t0 + 0.1 });
    if (sub) k.tagline(X, K, L, sub, { x: pos[2] === 1 ? w.left : w.left + w.width * 0.55, y: y - fs * 0.85, fs: Math.max(11 * u, fs * 0.1), t0: ls[1]?.rt ?? t0 + 0.3 });
    if (p.brackets) k.brackets(X, K, L, { x: 0.05 * W, y: 0.08 * H, w: 0.9 * W, h: 0.84 * H }, t0);
  },
};

R.scenes.framed = {
  label: "Video enmarcado + palabra gigante en contorno",
  params: { grade: GRADE, motion: MOTION, textIn: TEXT_IN, giant: S.bool(true), frame: S.num(0.5, 1.3, 1), side: S.enum(["center", "left", "right"], "center"),
    textPos: S.enum(["center", "left", "right"], "center") },
  render(sc, X, K) {
    const { W, H, u } = X, p = X.p, ls = K.lines(X), main = ls[0]?.text || "", sub = ls[1]?.text || "";
    const L = k.black(X, K);
    if (p.giant) k.giant(X, K, L, main, { dir: sc.idx % 2 ? 1 : -1 });
    const r = k.frameRect(X, p.frame, p.side);
    k.frame(X, K, L, 0, r, p);
    const fs = Math.min(k.fitFs(K, main, "dp", r.w * (p.textPos === "center" ? 0.8 : 0.55), r.h * 0.5), 0.36 * H);
    const ax = { center: 0.5, left: 0, right: 1 }[p.textPos], x = p.textPos === "center" ? r.x + r.w / 2 : p.textPos === "left" ? r.x - fs * 0.15 : r.x + r.w + fs * 0.15;
    const t0 = ls[0]?.rt ?? 0.1;
    k.title(X, K, L, main, { x, y: r.y + r.h * 0.55, ax, fs, t0 });
    if (sub) k.tagline(X, K, L, sub, { x: r.x + r.w * 0.06, y: r.y + r.h * 0.88, fs: Math.max(11 * u, fs * 0.1), t0: ls[1]?.rt ?? t0 + 0.3 });
  },
};

R.scenes.knockout = {
  label: "Palabra calada con el video dentro",
  params: { grade: S.enum(["cine", "dim", "none"], "dim"), motion: MOTION, scaleFrom: S.num(1, 2, 1.25), fill: S.num(0.5, 1, 0.92) },
  render(sc, X, K) {
    const { W, H } = X, p = X.p, ls = K.lines(X), main = ls[0]?.text || "";
    const L = k.black(X, K);
    /* fondo: el mismo medio oscurecido (grade dim pregradado; sin blur en vivo, caro en el render) */
    k.full(X, K, L, 0, { grade: p.grade, motion: p.motion });
    K.div(L, "lay", { background: "rgba(0,0,0,0.62)" });
    const port = W < H;
    const fs = Math.min(k.fitFs(K, main, "dp", p.fill * W, (port ? 0.3 : 0.62) * H), (port ? 0.34 : 0.7) * H);
    const kn = k.knock(X, K, L, main, 0, { fs, grade: "none", motion: p.motion });
    const t0 = ls[0]?.rt ?? 0.1;
    X.T(kn.box, "transform", `scale(${p.scaleFrom})`).to(t0, 0.5, "scale(1)", K.EASE_OUT);
    X.T(kn.box, "opacity", "0").to(t0, 0.15, "1");
    k.vignette(X, K, L);
  },
};

R.scenes.badge = {
  label: "Palabra en caja verde + palabra crema",
  params: { grade: GRADE, motion: MOTION, giant: S.bool(true), frame: S.num(0.5, 1.3, 0.85) },
  render(sc, X, K) {
    const { W, H, u } = X, p = X.p, ls = K.lines(X), a = ls[0]?.text || "", b = ls[1]?.text || "";
    const L = k.black(X, K);
    if (p.giant) k.giant(X, K, L, b || a, { size: 1.05 });
    const r = k.frameRect(X, p.frame);
    k.frame(X, K, L, 0, r, { ...p, square: false });
    const fs = Math.min(k.fitFs(K, a, "dp", r.w * 0.45, r.h * 0.42), 0.3 * H), t0 = ls[0]?.rt ?? 0.1;
    const tw = K.textW(a, "dp", 0, fs), bx = r.x + r.w * 0.08, by = r.y + r.h * 0.3;
    const box = K.div(L, "patch", { left: bx + "px", top: by + "px", width: tw + fs * 0.4 + "px", height: fs * 1.05 + "px", background: K.P.green, transform: "skewX(-8deg)", transformOrigin: "0% 50%" });
    X.T(box, "transform", "skewX(-8deg) scaleX(0)").to(t0, 0.25, "skewX(-8deg) scaleX(1)", K.EASE_OUT);
    k.title(X, K, L, a, { x: bx + fs * 0.2, y: by + fs * 0.54, ax: 0, fs, color: K.P.ink, t0: t0 + 0.12, textIn: "wipe" });
    if (b) {
      const fs2 = Math.min(fs * 0.45, k.fitFs(K, b, "dp", r.w * 0.4, fs * 0.5));
      k.title(X, K, L, b, { x: bx + tw + fs * 0.6, y: by + fs * 0.75, ax: 0, fs: fs2, t0: ls[1]?.rt ?? t0 + 0.3, textIn: "rise" });
    }
  },
};

R.scenes.split3 = {
  label: "Tres columnas de video + palabra",
  params: { grade: GRADE, motion: MOTION, textIn: TEXT_IN, panels: S.num(2, 4, 3) },
  render(sc, X, K) {
    const { W, H, u } = X, p = X.p, ls = K.lines(X), n = Math.round(p.panels), main = ls[0]?.text || "";
    const L = k.black(X, K), gap = 6 * u, pw = (W - gap * (n - 1)) / n;
    for (let i = 0; i < n; i++) {
      const box = K.div(L, "patch", { left: i * (pw + gap) + "px", top: "0px", width: pw + "px", height: H + "px", overflow: "hidden" });
      k.media(X, K, box, i, { x: -(W - pw) / 2, y: 0, w: W, h: H }, { grade: p.grade, motion: "still", off: i * 0.5 });
      X.T(box, "transform", `translateY(${i % 2 ? -100 : 100}%)`).to(i * 0.08, 0.45, "translateY(0%)", K.EASE_OUT);
    }
    k.vignette(X, K, L);
    const fs = Math.min(k.fitFs(K, main, "dp", 0.7 * W, 0.26 * H), 0.3 * H), t0 = Math.max(0.3, ls[0]?.rt ?? 0.1);
    k.title(X, K, L, main, { x: W / 2, y: H / 2, fs, t0 });
    if (ls[1]?.text) k.tagline(X, K, L, ls[1].text, { x: W / 2 + K.textW(main, "dp", 0, fs) * 0.1, y: H / 2 + fs * 0.62, fs: Math.max(11 * u, fs * 0.1), t0: ls[1].rt });
  },
};

R.scenes.marquee = {
  label: "Bandas de la palabra que corren (sólida y contorno)",
  params: { grade: S.enum(["cine", "dim", "none"], "dim"), motion: MOTION, rows: S.num(3, 6, 4), speed: S.num(0, 2, 1), skew: S.num(-15, 15, -6) },
  render(sc, X, K) {
    const { W, H, u } = X, p = X.p, ls = K.lines(X), main = (ls[0]?.text || "").toUpperCase(), sub = ls[1]?.text || "";
    const L = k.black(X, K);
    k.full(X, K, L, 0, p);
    K.div(L, "lay", { background: "rgba(0,0,0,0.5)" });
    const n = Math.round(p.rows), band = K.div(L, "lay", { transform: `skewY(${p.skew}deg)` });
    const lh = H / n, fs = lh * 0.92, txt = (main + "  ").repeat(6);
    for (let i = 0; i < n; i++) {
      const row = K.div(band, "lay");
      const outline = i % 2 === 1;
      K.tx(row, txt, { x: W / 2, y: lh * (i + 0.5), ax: 0.5, fs, cls: "dp", color: outline ? K.P.green : K.P.cream, stroke: outline, sw: 0.012, ls: 0.02 });
      const dx = (i % 2 ? 1 : -1) * 0.12 * W * p.speed * (K.C.anim.intensity ?? 1);
      X.T(row, "transform", `translateX(${(-dx).toFixed(1)}px)`).to(0, X.dur + 0.5, `translateX(${dx.toFixed(1)}px)`);
      X.T(row, "opacity", "0").to((ls[0]?.rt ?? 0.1) + i * 0.06, 0.15, "1");
    }
    if (sub) {
      const fs2 = Math.max(14 * u, H * 0.035), tw = K.textW(sub, "tg", 0, fs2);
      const bx = K.div(L, "patch", { left: W / 2 - tw / 2 - fs2 * 0.6 + "px", top: H / 2 - fs2 * 0.9 + "px", width: tw + fs2 * 1.2 + "px", height: fs2 * 1.8 + "px", background: K.P.green });
      X.T(bx, "transform", "scaleX(0)").to(ls[1]?.rt ?? 0.4, 0.25, "scaleX(1)", K.EASE_OUT);
      K.tx(bx, sub, { x: tw / 2 + fs2 * 0.6, y: fs2 * 0.9, ax: 0.5, fs: fs2, cls: "tg", color: K.P.ink });
    }
  },
};

R.scenes.counter = {
  label: "Cifra que cuenta + video enmarcado lateral",
  params: { grade: GRADE, motion: MOTION, countSec: S.num(0.3, 3, 1), side: S.enum(["left", "right"], "right") },
  render(sc, X, K) {
    const { W, H, u } = X, p = X.p, ls = K.lines(X), main = ls[0]?.text || "", sub = ls[1]?.text || "";
    const m = /^([^0-9]*)([0-9]+)(.*)$/.exec(main.trim());
    if (!m) return k.fallback("framed", sc, X, K);
    const [, pre, num, post] = m, value = parseInt(num, 10), fmt = v => pre + Math.round(v) + post;
    const L = k.black(X, K), port = W < H;
    const r = port ? { x: 0.06 * W, y: 0.08 * H, w: 0.88 * W, h: 0.36 * H } : { ...k.frameRect(X, 0.72, p.side), y: 0.19 * H };
    k.frame(X, K, L, 0, r, p);
    const area = port ? { x: W / 2, y: 0.66 * H, w: 0.86 * W } : { x: p.side === "right" ? 0.24 * W : 0.76 * W, y: 0.48 * H, w: 0.38 * W };
    const fs = Math.min(K.fit(fmt(value), "dp num", 0, area.w, (port ? 0.22 : 0.4) * H), 0.45 * H), t0 = ls[0]?.rt ?? 0.1;
    const n = K.tx(L, fmt(value), { x: area.x, y: area.y, ax: 0.5, fs, cls: "dp num", color: K.P.cream });
    const tr = X.T(n.el, "@textContent", fmt(0), true), steps = Math.max(8, Math.round(p.countSec * 25));
    for (let i = 1; i <= steps; i++) { const q = i / steps; tr.set(t0 + q * p.countSec, fmt(value * (1 - Math.pow(1 - q, 3)))); }
    X.T(n.el, "opacity", "0").to(t0, 0.12, "1");
    const tw = K.textW(fmt(value), "dp num", 0, fs);
    k.meter(X, K, L, area.x - tw / 2, area.y + fs * 0.56, { n: 12, len: tw / u, t0 });
    if (sub) k.tagline(X, K, L, sub, { x: area.x - tw / 2, y: area.y + fs * 0.75, fs: Math.max(12 * u, fs * 0.09), t0: ls[1]?.rt ?? t0 + 0.4 });
  },
};
