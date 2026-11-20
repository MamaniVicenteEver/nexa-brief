/* Lyrics Hologram Worlds · Outro v2 «Tarjeta y seda». Basado en el final de la referencia (161 a
   175 s): tarjeta sobre el negro azulado con el título (outro.title) en contorno fino extendido y el
   subtítulo (outro.sub); una pared de seda holográfica entra desde la derecha y queda a pantalla
   completa con la línea final (outro.feats) en tinta y rótulos de marca, hasta el corte a negro. */
const R = window.NexaPromo_lyrics_hologram_worlds, k = R.kit, S = R.S;

R.scenes.outroV2 = {
  label: "Outro v2 · tarjeta de título y seda holográfica final",
  params: { split: S.num(0.15, 0.6, 0.32), blackSec: S.num(0, 1, 0.12) },
  render(sc, X, K) {
    const W = R.worlds, D = W.DRAW, p = X.p, O = K.C.outro, pt = k.port(X), d = X.dur || sc.dur;
    const L = W.worldBg(X, K, "void", {});
    const title = String(O.title || "Gracias"), sub = String(O.sub || ""), feats = String(O.feats || ""), brand = String(K.BR.name || "NODEMOTION");
    const t1 = Math.max(1.0, d * p.split);
    /* 1 · tarjeta */
    D.text(X, K, L, { t: title, h: 1, maxw: pt ? 0.7 : 0.34, x: 0.5, y: 0.47, f: "w", fill: "out", c: "rgba(235,235,255,0.92)", sw: 0.0018, in: "spread", at: 0.05, to: t1 + 0.4, zm: [1, 1.04] });
    if (sub) D.text(X, K, L, { t: sub, h: 0.03, x: 0.5, y: 0.6, fill: "white", op: 0.8, ls: 0.3, in: "cut", at: 0.35, to: t1 + 0.4 });
    D.lab(X, K, L, { t: brand, rows: [0.94], xs: [0.06, 0.94], at: 0.2 });
    /* 2 · pared de seda que entra desde la derecha y se queda */
    const wall = K.div(L, "lay", { overflow: "hidden" });
    k.field(X, K, wall);
    X.T(wall, "clipPath", "inset(0 0 0 100%)").to(t1, 0.35, "inset(0 0 0 0%)", K.EASE_IO);
    const top = K.div(L, "lay");
    if (feats) D.text(X, K, top, { t: feats, h: 0.026, x: 0.5, y: 0.5, fill: "ink", ls: 0.25, in: "scatter", d: 0.5, at: t1 + 0.6 });
    D.lab(X, K, top, { t: brand, rows: [0.945], xs: [0.1, 0.9], at: t1 + 0.6 });
    /* 3 · corte a negro */
    if (p.blackSec > 0) { const f = K.div(X.root, "patch", { left: "0px", top: "0px", width: X.W + "px", height: X.H + "px", background: "#000", zIndex: 70 }); X.T(f, "visibility", "hidden", true).set(Math.max(0, d - p.blackSec), "visible"); }
  },
};
