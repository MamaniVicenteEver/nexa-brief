/* Lyrics Hologram · Outro v1 (por defecto). Tarjeta de marca sobre casi negro:
   emblema pequeño, título (outro.title) en la extendida itálica con relleno
   holográfico, subtítulo (outro.sub) espaciado, créditos (outro.feats) abajo y
   fundido a negro final. */
const R = window.NexaPromo_lyrics_hologram, k = R.kit, S = R.S;

R.scenes.outroV1 = {
  label: "Outro v1 · tarjeta holográfica",
  params: { fadeSec: S.num(0, 3, 0.8), emblem: S.bool(true) },
  render(sc, X, K) {
    const { W, H } = X, p = X.p, O = K.C.outro, pt = k.port(X), m = Math.min(W, H);
    const { L } = k.bg(X, K, { bg: "void" });
    const title = k.U(O.title || K.BR.name || ""), sub = k.U(O.sub || ""), feats = O.feats || "";
    const fs = Math.min(k.fit(K, title, "fw", 0.76 * W, (pt ? 0.12 : 0.2) * H), 0.22 * H), cy = 0.47 * H;
    if (p.emblem) {
      const es = 0.05 * m, e = k.holoBox(X, K, L, { left: W / 2 - es + "px", top: cy - fs * 0.7 - 2.4 * es + "px", width: 2 * es + "px", height: 2 * es + "px", clipPath: "polygon(50% 0%, 84% 46%, 50% 100%, 16% 46%)" });
      X.T(e, "transform", "scale(0) rotate(-45deg)").to(0.05, 0.4, "scale(1) rotate(0deg)", K.EASE_BACK);
    }
    const ws = title.split(/\s+/).map((w, i) => ({ text: w, rt: 0.12 + i * 0.12 }));
    const t = k.line(X, K, L, ws, { cls: "fw", fs, x: W / 2, y: cy, color: K.P.white, holo: true, mode: "glitch" });
    k.later(X, t.el, b => { const bar = k.holoBox(X, K, L, { left: b.x + "px", top: b.y + b.h + 0.012 * H + "px", width: b.w + "px", height: Math.max(2, 0.006 * H) + "px", transformOrigin: "50% 50%" }); X.T(bar, "transform", "scaleX(0)").to(0.4, 0.5, "scaleX(1)", K.EASE_OUT); });
    if (sub) {   /* debajo de la barra (b.h ≈ fs·0.92 + 0.012H + grosor), según su propio tamaño */
      const sf = Math.min(k.fit(K, sub, "fc", 0.6 * W, 0.06 * H, 0.3), 0.06 * H);
      const s = K.tx(L, sub, { cls: "fc", fs: sf, x: W / 2, y: cy + fs * 0.5 + 0.03 * H + sf * 0.6, ax: 0.5, color: K.P.white, ls: 0.3 }); k.enter(X, K, s.el, "spread", 0.55);
    }
    if (feats) { const f = K.tx(L, feats, { cls: "fc", fs: Math.max(0.026 * H, 0.03 * m), x: W / 2, y: 0.84 * H, ax: 0.5, color: "rgba(255,255,255,0.75)", ls: 0.18 }); K.hide(X, f.box, 0.85); }
    k.ornaments(X, K, L, W / 2, 0.9 * H, 4, 0.01 * m * 1.3, K.P.h2, 0.9);
    if (p.fadeSec > 0) { const f = K.div(X.root, "patch", { left: "0px", top: "0px", width: W + "px", height: H + "px", background: "#000", zIndex: 70 }); X.T(f, "opacity", "0").to(Math.max(0, X.dur - p.fadeSec), p.fadeSec, "1"); }
  },
};
