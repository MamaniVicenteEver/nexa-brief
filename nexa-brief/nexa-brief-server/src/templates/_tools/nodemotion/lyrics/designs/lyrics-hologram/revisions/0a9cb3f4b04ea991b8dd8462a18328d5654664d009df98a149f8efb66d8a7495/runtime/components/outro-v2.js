/* Lyrics Hologram · Outro v2. Seda holográfica a pantalla completa, filas
   tenues del título que corren, título (outro.title) enorme en tinta con ecos
   en contorno blanco, subtítulo (outro.sub) y créditos (outro.feats) en tinta,
   y fundido final a negro. */
const R = window.NexaPromo_lyrics_hologram, k = R.kit, S = R.S;

R.scenes.outroV2 = {
  label: "Outro v2 · seda holográfica",
  params: { fadeSec: S.num(0, 3, 0.8), rows: S.num(0, 8, 4) },
  render(sc, X, K) {
    const { W, H } = X, p = X.p, O = K.C.outro, pt = k.port(X), m = Math.min(W, H);
    const { L } = k.bg(X, K, { bg: "holo" });
    const title = k.U(O.title || K.BR.name || ""), sub = k.U(O.sub || ""), feats = O.feats || "", ink = K.P.ink;
    const n = Math.round(p.rows);
    for (let i = 0; i < n; i++) {
      const t = K.tx(L, (title + "  ").repeat(6), { cls: "fc", fs: H / n * 0.7, x: W / 2, y: H * (i + 0.5) / n, ax: 0.5, color: "rgba(255,255,255,0.22)" });
      const dx = (i % 2 ? 1 : -1) * 0.08 * W;
      X.T(t.el, "transform", `translateX(${(-dx).toFixed(1)}px)`).to(0, X.dur, `translateX(${dx.toFixed(1)}px)`);
    }
    const fs = Math.min(k.fit(K, title, "fc", 0.8 * W, (pt ? 0.16 : 0.32) * H), 0.34 * H), cy = 0.46 * H;
    k.echoes(X, K, L, title, "fc", fs, W / 2, cy, 1, K.P.white, 0.2);
    const ws = title.split(/\s+/).map((w, i) => ({ text: w, rt: 0.1 + i * 0.12 }));
    k.line(X, K, L, ws, { cls: "fc", fs, x: W / 2, y: cy, color: ink, mode: "stamp" });
    if (sub) { const s = K.tx(L, sub, { cls: "fc", fs: Math.min(k.fit(K, sub, "fc", 0.6 * W, 0.055 * H, 0.3), 0.055 * H), x: W / 2, y: cy + fs * 0.66, ax: 0.5, color: ink, ls: 0.3 }); k.enter(X, K, s.el, "spread", 0.5); }
    if (feats) { const f = K.tx(L, feats, { cls: "fc", fs: Math.max(0.026 * H, 0.03 * m), x: W / 2, y: 0.86 * H, ax: 0.5, color: ink, ls: 0.18 }); K.hide(X, f.box, 0.8); }
    if (p.fadeSec > 0) { const f = K.div(X.root, "patch", { left: "0px", top: "0px", width: W + "px", height: H + "px", background: "#000", zIndex: 70 }); X.T(f, "opacity", "0").to(Math.max(0, X.dur - p.fadeSec), p.fadeSec, "1"); }
  },
};
