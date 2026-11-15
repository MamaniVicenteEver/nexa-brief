/* Promo Pulse · Outro v2. Fondo negro con filas inclinadas de la marca que
   corren (crema sólida y contorno verde alternados) y, al centro, caja verde
   con la llamada a la acción en negro (brand.cta) sobre la marca; la
   dirección (outro.cta / renglón 2 / brand.url) en itálica debajo. */
const R = window.NexaPromo_promo_pulse, k = R.kit, S = R.S;

R.scenes.outroV2 = {
  label: "Outro v2 · filas de marca + caja verde",
  params: {
    rows: S.num(3, 8, 5),
    speed: S.num(0, 2, 1),
    skew: S.num(-15, 15, -8),
    fadeSec: S.num(0, 3, 0.7),
  },
  render(sc, X, K) {
    const { W, H, u } = X, p = X.p, ls = K.lines(X);
    const title = (K.C.outro.title || ls[0]?.text || K.BR.name || "").toUpperCase();
    const sub = K.C.outro.cta || ls[1]?.text || K.BR.url || "";
    const L = k.black(X, K), n = Math.round(p.rows);
    const band = K.div(L, "lay", { transform: `skewY(${p.skew}deg) scale(1.15)` }), lh = H / n, fs = lh * 0.9, txt = (title + "  ").repeat(5);
    for (let i = 0; i < n; i++) {
      const row = K.div(band, "lay"), outline = i % 2 === 0;
      K.tx(row, txt, { x: W / 2, y: lh * (i + 0.5), ax: 0.5, fs, cls: "dp", color: outline ? K.P.green : K.P.cream, stroke: outline, sw: 0.01 });
      row.style.opacity = outline ? "0.9" : "0.16";
      const dx = (i % 2 ? 1 : -1) * 0.1 * W * p.speed;
      X.T(row, "transform", `translateX(${(-dx).toFixed(1)}px)`).to(0, X.dur, `translateX(${dx.toFixed(1)}px)`);
    }
    const port = W < H;
    const fsT = Math.min(k.fitFs(K, title, "dp", (port ? 0.84 : 0.56) * W, 0.22 * H), 0.26 * H);
    k.title(X, K, L, title, { x: W / 2, y: H / 2 - fsT * 0.15, fs: fsT, t0: 0.2 });
    const cta = (K.BR.cta || "").toUpperCase();
    if (cta) {
      const cf = Math.max(14 * u, fsT * 0.2), cw = K.textW(cta, "lb", 0.12, cf) + cf * 1.6;
      const box = K.div(L, "patch", { left: W / 2 - cw / 2 + "px", top: H / 2 + fsT * 0.42 + "px", width: cw + "px", height: cf * 1.9 + "px", background: K.P.green, transform: "skewX(-8deg)" });
      X.T(box, "transform", "skewX(-8deg) scaleX(0)").to(0.55, 0.3, "skewX(-8deg) scaleX(1)", K.EASE_OUT);
      K.tx(box, cta, { x: cw / 2, y: cf * 0.95, ax: 0.5, fs: cf, cls: "lb", ls: 0.12, color: K.P.ink });
      if (sub) k.title(X, K, L, sub, { x: W / 2, y: H / 2 + fsT * 0.42 + cf * 3.1, fs: Math.max(13 * u, cf * 0.95), cls: "tg", t0: 0.85, textIn: "rise" });
    } else if (sub) k.title(X, K, L, sub, { x: W / 2, y: H / 2 + fsT * 0.6, fs: Math.max(13 * u, fsT * 0.2), cls: "tg", t0: 0.6, textIn: "rise" });
    if (p.fadeSec > 0) {
      const f = K.div(X.root, "patch", { left: "0px", top: "0px", width: W + "px", height: H + "px", background: "#000", zIndex: 70 });
      X.T(f, "opacity", "0").to(Math.max(0, X.dur - p.fadeSec), p.fadeSec, "1");
    }
  },
};
