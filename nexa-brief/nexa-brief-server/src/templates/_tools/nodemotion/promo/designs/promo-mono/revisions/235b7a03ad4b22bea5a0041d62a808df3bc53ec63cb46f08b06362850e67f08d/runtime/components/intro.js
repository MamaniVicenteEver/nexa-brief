// @nexa thumbnail-at: 1.6 — segundo en que el logotipo de la intro está completo.
/* Promo Mono · intro: logotipo (marca) en el centro sobre negro, entra con
   fundido y un leve acercamiento; subtítulo opcional tecleado debajo.
   Textos: config.intro.title (o renglón 1, o brand.name) y config.intro.sub. */
const R = window.NexaPromo_promo_mono, k = R.kit, S = R.S;

R.scenes.intro = {
  label: "Intro: logotipo de la marca",
  params: { size: S.num(0.5, 1.6, 1), sub: S.bool(true) },
  render(sc, X, K) {
    const { W, H, u } = X, p = X.p, ls = K.lines(X);
    k.bg(X, K);
    const L = k.layer(X, K);
    const title = K.C.intro.title || ls[0]?.text || K.BR.name || "";
    const fs = Math.min(k.fitFs(K, title, "hd", 0.6 * W * p.size, 0.16 * H * p.size), 120 * u * p.size);
    const w = K.tx(L, title, { cls: "hd", fs, x: W / 2, y: H / 2, color: K.P.fg });
    X.T(w.el, "opacity", "0").to(0.15, 0.5, "1", K.EASE_OUT);
    X.T(w.el, "transform", "scale(0.92)").to(0.15, 1.2, "scale(1)", K.EASE_OUT);
    const sub = K.C.intro.sub || ls[1]?.text;
    if (p.sub && sub) k.text(X, K, L, sub, { cls: "ui", fs: fs * 0.22, x: W / 2, y: H / 2 + fs * 0.75, color: K.P.muted, t0: 0.8 });
    /* salida: el logotipo se apaga justo antes del corte */
    X.T(L, "opacity", "1").to(Math.max(0.6, X.dur - 0.25), 0.2, "0");
  },
};
