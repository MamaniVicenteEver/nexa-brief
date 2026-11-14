/* Lyrics Rasgado · Outro v2. Capas rasgadas lima, carbón y papel que se
   apilan; filas del título que corren de fondo; el subtítulo (outro.sub) en
   una tira de papel inclinada y los créditos (outro.feats) en lima. */
const R = window.NexaPromo_lyrics_rasgado, k = R.kit, S = R.S;

R.scenes.outroV2 = {
  label: "Outro v2 · capas rasgadas + filas",
  params: { rows: S.num(3, 7, 5), speed: S.num(0, 2, 1), fadeSec: S.num(0, 3, 0.6) },
  render(sc, X, K) {
    const { W, H, u } = X, p = X.p, O = K.C.outro;
    const L = X.L; L.style.background = K.P.ink;
    const title = k.U(O.title || K.BR.name || ""), sub = O.sub || "", feats = O.feats || "";
    const n = Math.round(p.rows), lh = H / n;
    for (let i = 0; i < n; i++) {
      const row = K.div(L, "lay");
      const t = K.tx(row, (title + "  ").repeat(5), { cls: "fw", fs: lh * 0.85, x: W / 2, y: lh * (i + 0.5), ax: 0.5, color: i % 2 ? K.P.lime : K.P.paper, ls: 0.02 });
      t.el.style.opacity = i % 2 ? "0.9" : "0.12";
      const dx = (i % 2 ? 1 : -1) * 0.1 * W * p.speed;
      X.T(row, "transform", `translateX(${(-dx).toFixed(1)}px)`).to(0, X.dur, `translateX(${dx.toFixed(1)}px)`);
    }
    const top = k.tornBand(X, K, L, "top", K.P.lime, 0.22 * H);
    X.T(top, "transform", "translateY(-100%)").to(0.1, 0.35, "translateY(0%)", K.EASE_OUT);
    const bot = k.tornBand(X, K, L, "bottom", K.P.paper, 0.22 * H);
    X.T(bot, "transform", "translateY(100%)").to(0.2, 0.35, "translateY(0%)", K.EASE_OUT);
    const strip = K.div(L, "lay", { transform: "rotate(-4deg)" });
    const sh = 0.2 * H, sp = k.tornBand(X, K, strip, "bottom", K.P.paper, sh, { amp: 0.15 });
    sp.style.top = H / 2 - sh / 2 + "px";
    const fs = Math.min(k.fit(K, title, "fw", 0.7 * W, sh * 0.55), sh * 0.6);
    K.tx(strip, title, { cls: "fw", fs, x: W / 2, y: H / 2, ax: 0.5, color: K.P.ink });
    X.T(strip, "clipPath", "inset(0% 100% 0% 0%)").to(0.35, 0.35, "inset(0% 0% 0% 0%)", K.EASE_OUT);
    if (sub) { const s = K.tx(L, k.U(sub), { cls: "fc", fs: 0.07 * H, x: W / 2, y: 0.12 * H, ax: 0.5, color: K.P.ink }); K.hide(X, s.box, 0.55); }
    if (feats) { const f = K.tx(L, feats, { cls: "ft", fs: Math.max(12 * u, 0.03 * H), x: W / 2, y: 0.88 * H, ax: 0.5, color: K.P.ink, ls: 0.2 }); K.hide(X, f.box, 0.75); }
    if (p.fadeSec > 0) { const f = K.div(X.root, "patch", { left: "0px", top: "0px", width: W + "px", height: H + "px", background: "#000", zIndex: 70 }); X.T(f, "opacity", "0").to(Math.max(0, X.dur - p.fadeSec), p.fadeSec, "1"); }
  },
};
