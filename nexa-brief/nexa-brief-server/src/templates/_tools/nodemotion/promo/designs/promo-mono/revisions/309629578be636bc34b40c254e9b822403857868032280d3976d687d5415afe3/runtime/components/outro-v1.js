/* Promo Mono · Outro v1 «Logotipo»: la marca (brand.name) aparece en el centro,
   debajo una píldora con contorno y el llamado (outro.cta o brand.cta) tecleado,
   y una línea fina se dibuja bajo todo. Queda quieto al final. */
const R = window.NexaPromo_promo_mono, k = R.kit, S = R.S;

R.scenes.outroV1 = {
  label: "Outro v1: logotipo + llamado en píldora",
  params: { size: S.num(0.5, 1.6, 1) },
  render(sc, X, K) {
    const { W, H, u } = X, p = X.p, BR = K.BR;
    k.bg(X, K);
    const L = k.layer(X, K);
    const name = K.C.outro.title || BR.name || "";
    const fs = Math.min(k.fitFs(K, name, "hd", 0.6 * W * p.size, 0.16 * H * p.size), 120 * u * p.size);
    const w = K.tx(L, name, { cls: "hd", fs, x: W / 2, y: H * 0.46, color: K.P.fg });
    X.T(w.el, "opacity", "0").to(0.1, 0.5, "1", K.EASE_OUT);
    X.T(w.el, "transform", "scale(1.06)").to(0.1, 1.4, "scale(1)", K.EASE_OUT);
    const cta = K.C.outro.cta || BR.cta;
    if (cta) {
      const pl = k.pill(X, K, L, cta, { fs: fs * 0.2, x: W / 2, y: H * 0.46 + fs * 0.85, outline: true, icon: "pin" });
      X.T(pl.box, "opacity", "0").to(0.7, 0.35, "1", K.EASE_OUT);
    }
    if (BR.url) {
      const t = k.text(X, K, L, BR.url, { cls: "ui", fs: Math.max(12, 18 * u), x: W / 2, y: H * 0.9, color: K.P.muted, t0: 1.1 });
      void t;
    }
  },
};
