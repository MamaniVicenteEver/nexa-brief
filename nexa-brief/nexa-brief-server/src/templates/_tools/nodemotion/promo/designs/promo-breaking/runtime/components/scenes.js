/* Promo Breaking · escenas reutilizables. Cada una usa los renglones de su
   segmento del guion (renglón 1 = titular, renglón 2 = complemento) y sus
   parámetros del slot en config.scenes[i]. Ver DESIGN.md para la tabla.
   De la referencia: word, stacked, repeat, flash.
   Nuevas en el mismo lenguaje: ticker, stat, split. */
const R = window.NexaPromo_promo_breaking, k = R.kit, S = R.S;
const GRADE = S.enum(["mono", "red", "none"], "mono");
const TINT = S.enum(["auto", "tl", "tr", "bl", "br", "none"], "auto");
const OUTLINE = S.enum(["auto", "none", "all", "alt", "rand"], "auto");
const TEXT_IN = S.enum(["type", "rise", "squash", "pop", "fade", "cut"], "rise");
const MOTION = S.enum(["drift", "zoom", "still"], "drift");

/* titular centrado o a la izquierda + subrayado + subtítulo espaciado */
function headline(X, K, L, main, sub, o) {
  const { W, H } = X, p = X.p, left = (o.align ?? p.align) === "left";
  const fs = Math.min(k.fitFs(K, main, "hd", 0, o.maxW ?? k.maxW(X) * (p.scale ?? 1), (o.maxH ?? 0.18) * H * (p.scale ?? 1)), 0.22 * H);
  const x = left ? 0.08 * W : (p.x ?? 0.5) * W, y = (o.y ?? p.y ?? 0.5) * H;
  const w = k.word(X, K, L, main, { x, y, ax: left ? 0 : 0.5, fs, t0: o.t0 });
  if (o.underline !== false) k.underline(X, K, L, w.left + w.width * (left ? 0 : 0.18), y + fs * 0.48, w.width * (left ? 0.55 : 0.62), o.t0 + 0.18, Math.max(2, fs * 0.055));
  if (sub) {
    const fs2 = Math.min(fs * 0.24, k.fitFs(K, sub, "hl", 0.42, Math.max(w.width * 1.1, 0.3 * W), fs * 0.3));
    k.spaced(X, K, L, sub, { x: left ? w.left : x, ax: left ? 0 : 0.5, y: y + fs * 0.68, fs: fs2, t0: o.t1 ?? o.t0 + 0.25 });
  }
  return { w, fs, x, y };
}

R.scenes.word = {
  label: "Palabra con contorno sobre foto",
  params: { outline: OUTLINE, grade: GRADE, tint: TINT, giant: S.bool(true), align: S.enum(["center", "left"], "center"),
    x: S.num(0.15, 0.85, 0.5), y: S.num(0.2, 0.8, 0.5), scale: S.num(0.5, 1.5, 1), motion: MOTION, textIn: TEXT_IN, decor: S.bool(true) },
  render(sc, X, K) {
    const ls = K.lines(X), main = ls[0]?.text || "", sub = ls[1]?.text || "";
    const L = k.backdrop(X, K, { giant: X.p.giant ? k.chunk(main) : null });
    k.decor(X, K, L, 4);
    headline(X, K, L, main, sub, { t0: ls[0]?.rt ?? 0.1, t1: ls[1]?.rt });
  },
};

R.scenes.stacked = {
  label: "Palabra en sílabas apiladas + titular grande",
  params: { outline: OUTLINE, grade: GRADE, tint: S.enum(["auto", "tl", "tr", "bl", "br", "none"], "tl"), arrows: S.bool(true), motion: MOTION, textIn: TEXT_IN, scale: S.num(0.5, 1.5, 1) },
  render(sc, X, K) {
    const { W, H } = X, p = X.p, ls = K.lines(X);
    const a = ls[0]?.text || "", b = ls[1]?.text || k.plain(a).replace(/-/g, "");
    const L = k.backdrop(X, K, {});
    k.decor(X, K, L, 3);
    /* sílabas: "ECO-NO-MÍA" usa los guiones; sin guiones, trozos de 3 letras */
    const src = k.plain(a);
    const parts = src.includes("-") ? src.split("-").filter(Boolean) : (src.replace(/\s+/g, "").match(/.{1,3}/g) || [src]);
    const rows = parts.map((s, i) => i < parts.length - 1 ? s + "-" : s + (p.arrows ? "›››" : ""));
    if (p.arrows) rows[0] = "‹" + rows[0];
    const port = W < H;
    const longest = rows.reduce((m, s) => s.length > m.length ? s : m, "");
    const fs = Math.min(k.fitFs(K, longest, "hd", 0, (port ? 0.66 : 0.36) * W * p.scale, 0.12 * H * p.scale), 0.13 * H);
    const x = 0.07 * W, y0 = (port ? 0.16 : 0.1) * H + fs / 2;
    rows.forEach((s, i) => k.word(X, K, L, s, { x, y: y0 + i * fs * 1.0, ax: 0, fs, mode: "alt", t0: (ls[0]?.rt ?? 0.1) + i * 0.1 }));
    const fsB = Math.min(k.fitFs(K, b, "hd", 0, (port ? 0.86 : 0.6) * W * p.scale, 0.2 * H * p.scale), 0.24 * H);
    const yB = Math.max(y0 + rows.length * fs + fsB * 0.55, (port ? 0.72 : 0.76) * H);
    const t1 = ls[1]?.rt ?? (ls[0]?.rt ?? 0.1) + 0.35;
    const w = k.word(X, K, L, b, { x, y: yB, ax: 0, fs: fsB, t0: t1 });
    k.underline(X, K, L, x, yB + fsB * 0.48, w.width * 0.55, t1 + 0.2, Math.max(3, fsB * 0.05));
  },
};

R.scenes.repeat = {
  label: "Filas repetidas sobre foto roja",
  params: { rows: S.num(3, 7, 5), grade: S.enum(["mono", "red", "none"], "red"), speed: S.num(0, 2, 1), outline: S.enum(["auto", "none", "all", "alt", "rand"], "rand"), motion: MOTION },
  render(sc, X, K) {
    const { W, H, u } = X, p = X.p, ls = K.lines(X);
    const text = [ls[0]?.text, ls[1]?.text].filter(Boolean).join(" ") || "";
    const L = k.backdrop(X, K, { tint: false });
    K.div(L, "lay", { background: K.P.red, mixBlendMode: "multiply", opacity: 0.45 });
    k.decor(X, K, L, 3);
    const n = Math.round(p.rows), lsp = 0.28;
    const fs = Math.min(k.fitFs(K, text, "hd", lsp, 0.84 * W, 0.82 * H / n / 1.12), 0.14 * H);
    const lh = fs * 1.12, top = H / 2 - (n - 1) * lh / 2;
    for (let i = 0; i < n; i++) {
      const row = K.div(L, "lay");
      k.word(X, K, row, text, { x: W / 2, y: top + i * lh, fs, ls: lsp, mode: p.outline, sw: 0.03, textIn: "fade", t0: (ls[0]?.rt ?? 0.1) + i * 0.06 });
      const dx = (i % 2 ? 1 : -1) * 0.05 * W * p.speed * (K.C.anim.intensity ?? 1);
      X.T(row, "transform", `translateX(${(-dx).toFixed(1)}px)`).to(0, X.dur + 0.5, `translateX(${dx.toFixed(1)}px)`);
    }
    for (const yy of [top - lh * 0.6, top + (n - 0.4) * lh]) {
      const ln = K.div(L, "patch", { left: 0.1 * W + "px", top: yy + "px", width: 0.8 * W + "px", height: Math.max(1, u) + "px", background: K.P.white, opacity: 0.5, transformOrigin: "0% 50%" });
      X.T(ln, "transform", "scaleX(0)").to(0.1, 0.5, "scaleX(1)", K.EASE_OUT);
    }
  },
};

R.scenes.flash = {
  label: "Palabra gigante de corte rápido",
  params: { outline: OUTLINE, grade: S.enum(["mono", "red", "none"], "red"), zoom: S.num(0, 0.3, 0.1), motion: MOTION, textIn: S.enum(["type", "rise", "squash", "pop", "fade", "cut"], "cut") },
  render(sc, X, K) {
    const { W, H, u } = X, p = X.p, ls = K.lines(X), main = ls[0]?.text || "";
    const L = k.backdrop(X, K, { tint: p.grade !== "red" });
    const fs = Math.min(k.fitFs(K, main, "hd", -0.01, 0.97 * W, 0.4 * H), 0.42 * H);
    const w = k.word(X, K, L, main, { x: W / 2, y: H / 2, fs, ls: -0.01, t0: 0.02, sw: 0.016 });
    X.T(w.box, "transform", `translate(-50%, -50%) scale(${(1 + p.zoom).toFixed(3)})`).to(0, Math.min(0.6, X.dur), "translate(-50%, -50%) scale(1)", K.EASE_OUT);
    if (ls[1]?.text) k.spaced(X, K, L, ls[1].text, { x: W / 2, y: H / 2 + fs * 0.62, fs: Math.min(fs * 0.12, 26 * u), t0: ls[1].rt });
    for (const yy of [H / 2 - fs * 0.62, H / 2 + fs * 0.5]) K.div(L, "patch", { left: "0px", top: yy + "px", width: W + "px", height: Math.max(1, u) + "px", background: K.P.white, opacity: 0.35 });
  },
};

R.scenes.ticker = {
  label: "Franja de directo con rótulo que corre",
  params: { grade: GRADE, tint: TINT, label: S.str(16), speed: S.num(0.3, 3, 1), outline: OUTLINE, motion: MOTION, textIn: TEXT_IN },
  render(sc, X, K) {
    const { W, H, u } = X, p = X.p, ls = K.lines(X), main = ls[0]?.text || "", sub = ls[1]?.text || main;
    const port = W < H;
    const L = k.backdrop(X, K, { giant: k.chunk(main), giantOpts: { opacity: 0.35 } });
    k.decor(X, K, L, 2);
    const fs = Math.min(k.fitFs(K, main, "hd", 0, (port ? 0.86 : 0.6) * W, 0.15 * H), 0.2 * H);
    const t0 = ls[0]?.rt ?? 0.1, y = (port ? 0.56 : 0.5) * H;
    const w = k.word(X, K, L, main, { x: 0.06 * W, y, ax: 0, fs, t0 });
    k.underline(X, K, L, 0.06 * W, y + fs * 0.48, w.width * 0.5, t0 + 0.18, Math.max(2, fs * 0.05));
    /* rótulo inferior: caja roja con punto que parpadea + barra blanca con texto que corre */
    const bh = (port ? 0.055 : 0.08) * H, by = (port ? 0.8 : 0.78) * H, lab = (p.label || K.BR.live || "EN VIVO").toUpperCase();
    const lfs = bh * 0.42, lw = K.textW(lab, "hl", 0.12, lfs) + bh * 1.2;
    const box = K.div(L, "patch", { left: 0.05 * W + "px", top: by + "px", width: lw + "px", height: bh + "px", background: K.P.red, transformOrigin: "0% 50%" });
    X.T(box, "transform", "scaleX(0)").to(0.05, 0.3, "scaleX(1)", K.EASE_OUT);
    const dot = K.div(box, "patch", { left: bh * 0.32 + "px", top: bh / 2 - bh * 0.11 + "px", width: bh * 0.22 + "px", height: bh * 0.22 + "px", borderRadius: "50%", background: K.P.white });
    const blink = X.T(dot, "opacity", "1", true);
    for (let t = 0.5; t < X.dur; t += 0.5) blink.set(t, Math.round(t * 2) % 2 ? "0.15" : "1");
    K.tx(box, lab, { x: bh * 0.75, y: bh / 2, ax: 0, fs: lfs, cls: "hl", ls: 0.12, color: K.P.white });
    const bx = 0.05 * W + lw, bw = 0.95 * W - bx;
    const bar = K.div(L, "patch", { left: bx + "px", top: by + "px", width: bw + "px", height: bh + "px", background: K.P.white, overflow: "hidden", transformOrigin: "0% 50%" });
    X.T(bar, "transform", "scaleX(0)").to(0.2, 0.4, "scaleX(1)", K.EASE_OUT);
    const crawl = (k.plain(sub) + "   •   ").repeat(6).toUpperCase();
    const c = K.tx(bar, crawl, { x: bh * 0.5, y: bh / 2, ax: 0, fs: lfs * 1.05, cls: "hl", ls: 0.06, color: K.P.ink });
    X.T(c.el, "transform", "translateX(0px)").to(0, X.dur + 0.5, `translateX(${(-0.09 * W * p.speed * (X.dur + 0.5)).toFixed(1)}px)`);
    if (K.BR.name) K.tx(L, K.BR.name.toUpperCase(), { x: 0.05 * W, y: by - bh * 0.45, ax: 0, fs: lfs * 0.85, cls: "hl", ls: 0.3, color: K.P.white });
  },
};

R.scenes.stat = {
  label: "Cifra que cuenta + rótulo",
  params: { grade: GRADE, tint: TINT, countSec: S.num(0.3, 3, 1.1), bars: S.bool(true), motion: MOTION, outline: OUTLINE, textIn: TEXT_IN },
  render(sc, X, K) {
    const { W, H, u, r } = X, p = X.p, ls = K.lines(X), main = ls[0]?.text || "", sub = ls[1]?.text || "";
    const m = /^([^0-9]*)([0-9][0-9.,]*)(.*)$/.exec(k.plain(main).trim());
    if (!m) return k.fallback("word", sc, X, K);
    const L = k.backdrop(X, K, {});
    k.decor(X, K, L, 3);
    const [, pre, num, post] = m;
    const thousands = /^\d{1,3}([.,]\d{3})+$/.test(num), sep = thousands ? num.replace(/\d/g, "")[0] : "";
    const dec = !thousands && /[.,]\d+$/.test(num) ? num.split(/[.,]/)[1].length : 0;
    const value = parseFloat(thousands ? num.replace(/[.,]/g, "") : num.replace(",", "."));
    const fmt = v => { let s = v.toFixed(dec); if (dec && num.includes(",")) s = s.replace(".", ",");
      if (sep) s = s.replace(/\B(?=(\d{3})+(?!\d))/g, sep); return pre + s + post; };
    const port = W < H, finalTxt = fmt(value);
    const fs = Math.min(K.fit(finalTxt, "hd num", 0, (port ? 0.86 : 0.7) * W, 0.3 * H), 0.34 * H);
    const y = 0.46 * H, t0 = ls[0]?.rt ?? 0.1;
    const n = K.tx(L, finalTxt, { x: W / 2, y, ax: 0.5, fs, cls: "hd num", color: K.P.white });
    const tr = X.T(n.el, "@textContent", fmt(0), true), steps = Math.max(8, Math.round(p.countSec * 25));
    for (let i = 1; i <= steps; i++) { const q = i / steps, e = 1 - Math.pow(1 - q, 3); tr.set(t0 + q * p.countSec, fmt(value * e)); }
    X.T(n.el, "opacity", "0").to(t0, 0.15, "1");
    const tw = K.textW(finalTxt, "hd num", 0, fs);
    k.underline(X, K, L, W / 2 - tw * 0.3, y + fs * 0.48, tw * 0.6, t0 + 0.2, Math.max(3, fs * 0.04));
    if (sub) k.spaced(X, K, L, sub, { x: W / 2, y: y + fs * 0.66, fs: Math.min(fs * 0.13, k.fitFs(K, sub, "hl", 0.42, 0.8 * W, fs * 0.2)), t0: ls[1]?.rt ?? t0 + 0.4 });
    if (p.bars) {
      const nb = 18, bw = (port ? 0.8 : 0.5) * W / nb, base = 0.95 * H, x0 = W / 2 - nb * bw / 2;
      for (let i = 0; i < nb; i++) {
        const h = (0.03 + r() * 0.09 + i / nb * 0.06) * H;
        const b = K.div(L, "patch", { left: x0 + i * bw + "px", top: base - h + "px", width: bw * 0.55 + "px", height: h + "px", background: i % 4 === 3 ? K.P.red : K.P.white, opacity: 0.8, transformOrigin: "50% 100%" });
        X.T(b, "transform", "scaleY(0)").to(t0 + i * 0.03, 0.5, "scaleY(1)", K.EASE_OUT);
      }
    }
  },
};

R.scenes.split = {
  label: "Columnas de fotos + titular",
  params: { panels: S.num(2, 4, 3), grade: GRADE, tint: TINT, outline: OUTLINE, motion: MOTION, textIn: TEXT_IN },
  render(sc, X, K) {
    const { W, H, u } = X, p = X.p, ls = K.lines(X), n = Math.round(p.panels);
    const L = X.L;
    L.style.background = K.P.ink;
    const gap = 4 * u, pw = (W - gap * (n - 1)) / n;
    for (let i = 0; i < n; i++) {
      const box = K.div(L, "lay", { left: i * (pw + gap) + "px", width: pw + "px", overflow: "hidden" });
      const m = K.mbox(X, box, i, { left: -(W - pw) / 2 + "px", top: "0px", width: W + "px", height: H + "px" }, { filter: p.grade === "none" ? null : p.grade, off: i * 0.7 });
      m.el.style.transform = "scale(1.04)";
      const from = i % 2 ? "-100%" : "100%";
      X.T(box, "transform", `translateY(${from})`).to(i * 0.09, 0.5, "translateY(0%)", K.EASE_OUT);
      if (i) { const s = K.div(L, "patch", { left: i * (pw + gap) - gap + "px", top: "0px", width: gap + "px", height: H + "px", background: K.P.red, transformOrigin: "50% 0%" });
        X.T(s, "transform", "scaleY(0)").to(0.2 + i * 0.08, 0.4, "scaleY(1)", K.EASE_OUT); }
    }
    k.vignette(X, K, L);
    k.tint(X, K, L, p.tint);
    k.decor(X, K, L, 3);
    headline(X, K, L, ls[0]?.text || "", ls[1]?.text || "", { t0: Math.max(0.35, ls[0]?.rt ?? 0.1), t1: ls[1]?.rt, align: "center" });
  },
};
