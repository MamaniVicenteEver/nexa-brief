/* Promo Pulse · intro (primer segmento del guion). Fondo negro, el video
   enmarcado entra escalando, la palabra gigante en contorno verde cruza por
   detrás y el titular crema golpea encima del cuadro; la frase corta en
   itálica aparece debajo. Textos: intro.title / intro.sub o renglones 1 y 2. */
const R = window.NexaPromo_promo_pulse, k = R.kit, S = R.S;

R.scenes.intro = {
  label: "Intro · video enmarcado + palabra que golpea",
  params: {
    grade: S.enum(["cine", "dim", "none"], "cine"),
    giant: S.bool(true),
    frame: S.num(0.6, 1.3, 1),
    textIn: S.enum(["slam", "rise", "wipe", "type", "fade"], "slam"),
    motion: S.enum(["zoom", "drift", "still"], "zoom"),
    blackSec: S.num(0, 2, 0.25),
  },
  render(sc, X, K) {
    const { W, H } = X, p = X.p, ls = K.lines(X);
    const title = K.C.intro.title || ls[0]?.text || K.BR.name || "";
    const sub = K.C.intro.sub || ls[1]?.text || "";
    const L = k.black(X, K);
    if (p.giant) k.giant(X, K, L, title, { speed: 0.08 });
    const r = k.frameRect(X, p.frame);
    k.frame(X, K, L, 0, r, { t0: p.blackSec, grade: p.grade, motion: p.motion });
    k.vignette(X, K, L, -0.2);
    const fs = Math.min(k.fitFs(K, title, "dp", r.w * 0.86, r.h * 0.62), 0.42 * H);
    const t0 = p.blackSec + 0.3;
    k.title(X, K, L, title, { x: W / 2, y: H / 2, fs, t0, textIn: p.textIn });
    k.tagline(X, K, L, sub, { x: r.x + r.w * 0.06, y: r.y + r.h * 0.9, fs: Math.max(11 * X.u, fs * 0.09), t0: t0 + 0.4 });
  },
};
