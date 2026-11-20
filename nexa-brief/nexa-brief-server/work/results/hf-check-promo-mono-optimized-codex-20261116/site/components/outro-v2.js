/* Promo Mono · Outro v2 «Píldora y chips»: una lluvia de chips de texto
   (config.chips) se aparta y deja una píldora central con pin y el llamado;
   la marca queda abajo. Queda quieto al final. */
const R = window.NexaPromo_promo_mono, k = R.kit, S = R.S;

R.scenes.outroV2 = {
  label: "Outro v2: chips que se apartan + píldora con pin + marca",
  params: { count: S.num(6, 40, 22) },
  render(sc, X, K) {
    const { W, H, u } = X, p = X.p, BR = K.BR, r = X.r;
    k.bg(X, K);
    const L = k.layer(X, K);
    const pool = k.chipPool(K, X), fs = 15 * u * (K.C.look.chipScale || 1);
    for (let i = 0; i < p.count; i++) {
      const a = r() * Math.PI * 2, d0 = 0.08 + r() * 0.12, d1 = 0.55 + r() * 0.35;
      const c = k.pill(X, K, L, pool[i % pool.length], { fs, x: W / 2, y: H / 2, rot: (r() - 0.5) * 40 });
      const x0 = Math.cos(a) * W * d0, y0 = Math.sin(a) * H * d0, x1 = Math.cos(a) * W * d1, y1 = Math.sin(a) * H * d1;
      X.T(c.box, "translate", `${x0.toFixed(0)}px ${y0.toFixed(0)}px`).to(0.05 + i * 0.01, 0.9, `${x1.toFixed(0)}px ${y1.toFixed(0)}px`, K.EASE_OUT);
      X.T(c.box, "opacity", "1").to(0.6, 0.6, "0");
    }
    const cta = K.C.outro.cta || BR.cta || K.C.outro.title || "";
    const big = Math.min(k.fitFs(K, cta, "ui", 0.62 * W, 0.08 * H), 46 * u);
    const pl = k.pill(X, K, L, cta, { fs: big, x: W / 2, y: H * 0.47, outline: true, icon: "pin", z: 5 });
    X.T(pl.box, "opacity", "0").to(0.75, 0.3, "1", K.EASE_OUT);
    X.T(pl.box, "scale", "0.6").to(0.75, 0.45, "1", K.EASE_BACK);
    const name = K.C.outro.title && K.C.outro.title !== cta ? K.C.outro.title : (BR.name || "");
    if (name) {
      const w = K.tx(L, name, { cls: "hd", fs: big * 1.1, x: W / 2, y: H * 0.8, color: K.P.fg });
      X.T(w.el, "opacity", "0").to(1.2, 0.5, "1", K.EASE_OUT);
    }
  },
};
