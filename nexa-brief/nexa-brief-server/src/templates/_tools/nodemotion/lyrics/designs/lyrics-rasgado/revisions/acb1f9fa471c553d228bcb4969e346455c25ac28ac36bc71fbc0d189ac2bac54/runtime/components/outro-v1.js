/* Lyrics Rasgado · Outro v1 (por defecto). Hoja de papel con el título
   (outro.title) enorme en la condensada, el subtítulo (outro.sub) en la
   extendida con pincelada lima, la línea de créditos (outro.feats) en la
   fina, garabatos que se dibujan y una franja rasgada carbón abajo. */
const R = window.NexaPromo_lyrics_rasgado, k = R.kit, S = R.S;

R.scenes.outroV1 = {
  label: "Outro v1 · papel + título + pincelada",
  params: { sheet: S.enum(["paper", "lime", "ink"], "paper"), fadeSec: S.num(0, 3, 0.6) },
  render(sc, X, K) {
    const { W, H, u } = X, p = X.p, O = K.C.outro;
    const { L, bg } = k.bg(X, K, { bg: p.sheet, bands: false });
    const col = k.colorOn(K, bg);
    k.tornBand(X, K, L, "bottom", bg === "ink" ? K.P.lime : K.P.ink, 0.16 * H);
    const title = k.U(O.title || K.BR.name || ""), sub = O.sub || "", feats = O.feats || "";
    const fs = Math.min(k.fit(K, title, "fc", 0.8 * W, 0.36 * H), 0.38 * H);
    const t = K.tx(L, title, { cls: "fc", fs, x: W / 2, y: 0.36 * H, ax: 0.5, color: col, split: "words" });
    t.words.forEach((w, i) => k.enter(X, K, w, "stamp", 0.08 + i * 0.12));
    k.tilt(X, K, t.box, -3);
    if (sub) {
      const f2 = Math.min(k.fit(K, sub, "fw", 0.6 * W, 0.08 * H), 0.08 * H);
      const s2 = K.tx(L, k.U(sub), { cls: "fw", fs: f2, x: W / 2, y: 0.36 * H + fs * 0.62, ax: 0.5, color: K.P.ink });
      K.hide(X, s2.box, 0.45);
      k.brush(X, K, L, s2.el, 0.4, K.P.lime);
    }
    if (feats) { const f = K.tx(L, feats, { cls: "ft", fs: Math.max(12 * u, 0.028 * H), x: W / 2, y: 0.36 * H + fs * 0.62 + 0.1 * H, ax: 0.5, color: col, ls: 0.2 }); K.hide(X, f.box, 0.8); }
    k.later(X, t.el, b => { k.doodle(X, K, L, "x", { x: b.x - 30 * u, y: b.y, w: 0, h: 0, s: 24 }, 0.5, K.P.lime); k.doodle(X, K, L, "tri", { x: b.x + b.w + 30 * u, y: b.y + b.h, w: 0, h: 0, s: 20 }, 0.7, K.P.lime); });
    if (p.fadeSec > 0) { const f = K.div(X.root, "patch", { left: "0px", top: "0px", width: W + "px", height: H + "px", background: "#000", zIndex: 70 }); X.T(f, "opacity", "0").to(Math.max(0, X.dur - p.fadeSec), p.fadeSec, "1"); }
  },
};
