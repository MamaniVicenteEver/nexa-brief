/* Promo Breaking · Outro v1 (por defecto). Composición de cierre de la
   referencia: foto B/N con tinte, letras gigantes, titular de marca tecleado
   con subrayado rojo, subtítulo espaciado y caja roja con la llamada a la
   acción; termina con un fundido a negro.
   Textos: outro.title → renglón 1 del último segmento → brand.name;
           outro.cta   → renglón 2 del último segmento → brand.url;
           caja roja   = brand.cta (vacío = sin caja). */
const R = window.NexaPromo_promo_breaking, k = R.kit, S = R.S;

R.scenes.outroV1 = {
  label: "Outro v1 · marca + CTA + fundido a negro",
  params: {
    grade: S.enum(["mono", "red", "none"], "mono"),
    tint: S.enum(["auto", "tl", "tr", "bl", "br", "none"], "br"),
    outline: S.enum(["auto", "none", "all", "alt"], "auto"),
    textIn: S.enum(["type", "rise", "squash", "pop", "fade"], "type"),
    fadeSec: S.num(0, 3, 0.9),
    motion: S.enum(["drift", "zoom", "still"], "zoom"),
  },
  render(sc, X, K) {
    const { W, H, u } = X, p = X.p, ls = K.lines(X);
    const title = K.C.outro.title || ls[0]?.text || K.BR.name || "";
    const sub = K.C.outro.cta || ls[1]?.text || K.BR.url || "";
    const L = k.backdrop(X, K, { giant: k.chunk(title) });
    k.decor(X, K, L, 4);
    const fs = Math.min(k.fitFs(K, title, "hd", 0, k.maxW(X, 0.62, 0.86), 0.16 * H), 0.2 * H);
    const y = 0.44 * H, t0 = 0.2;
    const w = k.word(X, K, L, title, { x: W / 2, y, fs, t0, textIn: p.textIn });
    const typed = p.textIn === "type" ? w.chars.length * 0.07 / K.C.anim.speed : 0.35;
    k.underline(X, K, L, w.left + w.width * 0.16, y + fs * 0.48, w.width * 0.62, t0 + typed * 0.6, Math.max(2, fs * 0.05));
    if (sub) k.spaced(X, K, L, sub, { x: W / 2, y: y + fs * 0.68, fs: Math.min(fs * 0.22, k.fitFs(K, sub, "hl", 0.42, w.width * 1.1, fs * 0.3)), t0: t0 + typed + 0.1 });
    const cta = (K.BR.cta || "").toUpperCase();
    if (cta) {
      const cfs = Math.max(15 * u, fs * 0.2), cw = K.textW(cta, "hl", 0.2, cfs) + cfs * 1.6, ch = cfs * 2;
      const box = K.div(L, "patch", { left: W / 2 - cw / 2 + "px", top: y + fs * 0.98 + "px", width: cw + "px", height: ch + "px", background: K.P.red, transformOrigin: "50% 50%" });
      X.T(box, "transform", "scaleX(0)").to(t0 + typed + 0.3, 0.35, "scaleX(1)", K.EASE_OUT);
      K.tx(box, cta, { x: cw / 2 + cfs * 0.1, y: ch / 2, ax: 0.5, fs: cfs, cls: "hl", ls: 0.2, color: K.P.white });
    }
    if (p.fadeSec > 0) {
      const f = K.div(X.root, "patch", { left: "0px", top: "0px", width: W + "px", height: H + "px", background: "#000", zIndex: 70 });
      X.T(f, "opacity", "0").to(Math.max(0, X.dur - p.fadeSec), p.fadeSec, "1");
    }
  },
};
