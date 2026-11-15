/* Promo Pulse · Outro v1 (por defecto). Cierre de la referencia: video
   enmarcado al centro, palabra gigante de la marca en contorno verde por
   detrás, marca crema grande con un punto verde y la dirección en itálica
   debajo con una línea verde segmentada; termina con fundido a negro.
   Textos: outro.title → renglón 1 del último segmento → brand.name;
           outro.cta → renglón 2 → brand.url. */
const R = window.NexaPromo_promo_pulse, k = R.kit, S = R.S;

R.scenes.outroV1 = {
  label: "Outro v1 · marca sobre video enmarcado",
  params: {
    grade: S.enum(["cine", "dim", "none"], "cine"),
    frame: S.num(0.6, 1.3, 1.05),
    fadeSec: S.num(0, 3, 0.8),
    motion: S.enum(["zoom", "drift", "still"], "zoom"),
  },
  render(sc, X, K) {
    const { W, H, u } = X, p = X.p, ls = K.lines(X);
    const title = K.C.outro.title || ls[0]?.text || K.BR.name || "";
    const sub = K.C.outro.cta || ls[1]?.text || K.BR.url || "";
    const L = k.black(X, K);
    k.giant(X, K, L, title.replace(/\s+/g, ""), { speed: 0.03 });
    const r = k.frameRect(X, p.frame);
    k.frame(X, K, L, 0, r, { ...p, square: false });
    K.div(L, "patch", { left: r.x + "px", top: r.y + "px", width: r.w + "px", height: r.h + "px", background: "rgba(0,0,0,0.42)" });
    /* marca: mismo crema, sin itálica forzada en el nombre (clase "bn") y un punto verde delante */
    const fs = Math.min(K.fit(title, "bn", 0, r.w * 0.66, r.h * 0.3), 0.2 * H);
    const tw = K.textW(title, "bn", 0, fs), dot = fs * 0.62, x0 = W / 2 - (tw + dot * 1.3) / 2, y = H / 2 - fs * 0.1;
    const d = K.div(L, "patch", { left: x0 + "px", top: y - dot / 2 + "px", width: dot + "px", height: dot + "px", borderRadius: "50% 50% 50% 8%", background: K.P.green, transform: "rotate(-20deg)" });
    X.T(d, "transform", "rotate(-20deg) scale(0)").to(0.35, 0.35, "rotate(-20deg) scale(1)", K.EASE_BACK);
    k.title(X, K, L, title, { x: x0 + dot * 1.3, y, ax: 0, fs, cls: "bn", t0: 0.45, textIn: "wipe" });
    if (sub) {
      const fs2 = Math.max(13 * u, fs * 0.3);
      k.title(X, K, L, sub, { x: W / 2, y: y + fs * 0.85, ax: 0.5, fs: fs2, cls: "tg", t0: 0.8, textIn: "rise" });
      k.meter(X, K, L, W / 2 - fs * 0.9, y + fs * 1.18, { n: 9, len: fs * 1.8 / u, th: 3, t0: 1 });
    }
    if (p.fadeSec > 0) {
      const f = K.div(X.root, "patch", { left: "0px", top: "0px", width: W + "px", height: H + "px", background: "#000", zIndex: 70 });
      X.T(f, "opacity", "0").to(Math.max(0, X.dur - p.fadeSec), p.fadeSec, "1");
    }
  },
};
