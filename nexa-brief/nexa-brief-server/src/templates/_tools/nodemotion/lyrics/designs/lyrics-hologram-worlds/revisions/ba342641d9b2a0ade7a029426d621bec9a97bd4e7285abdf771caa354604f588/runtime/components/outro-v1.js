/* Lyrics Hologram Worlds · Outro v1 «Palabra gigante y marca». Basado en el cierre de la referencia
   (160 a 163 s): el título (outro.title) ocupa el ancho en holográfico con filas diminutas del
   subtítulo (outro.sub) arriba y abajo, como «FLEX»; corte con filas de rótulos que corren y tarjeta
   de marca sobre el negro azulado: emblema pequeño, nombre de la marca en contorno fino extendido
   y la línea final (outro.feats). Fundido a negro al terminar. */
const R = window.NexaPromo_lyrics_hologram_worlds, k = R.kit, S = R.S;

R.scenes.outroV1 = {
  label: "Outro v1 · palabra gigante holográfica y tarjeta de marca",
  params: { fadeSec: S.num(0, 3, 0.8), split: S.num(0.1, 0.7, 0.18) },
  render(sc, X, K) {
    const W = R.worlds, D = W.DRAW, p = X.p, O = K.C.outro, pt = k.port(X), d = X.dur || sc.dur;
    const L = W.worldBg(X, K, "void", {});
    const title = String(O.title || "Gracias"), sub = String(O.sub || ""), feats = String(O.feats || ""), brand = String(K.BR.name || "NODEMOTION");
    const t1 = Math.min(d * 0.6, Math.max(1.2, d * p.split)), tg = Math.min(0.3, d * 0.04);
    /* 1 · palabra gigante */
    D.text(X, K, L, { t: title, h: 1, maxw: pt ? 0.92 : 0.86, x: 0.5, y: 0.5, fill: "holo", in: "stamp", at: 0.0, to: t1, zm: [1.0, 1.04] });
    if (sub) for (const y of [0.05, 0.95]) for (const x of [0.12, 0.5, 0.88]) D.text(X, K, L, { t: sub, h: 0.022, x, y, fill: "white", op: 0.8, in: "cut", at: 0.1, to: t1, ls: 0.12 });
    /* 2 · filas que corren (transición) */
    for (let i = 0; i < 6; i++) D.text(X, K, L, { t: `${brand}   ${title}   ${brand}   ${title}   ${brand}`, h: 0.03, x: 0.5, y: 0.08 + i * 0.168, fill: i % 2 ? "dim" : "white", op: 0.8, in: "cut", at: t1, to: t1 + tg, mv: [i % 2 ? 0.1 : -0.1, 0] });
    D.box(X, K, L, { x: 0, y: 0.85, w: 1, h: 0.15, fill: "holo", in: "cut", at: t1, to: t1 + tg });
    /* 3 · tarjeta de marca */
    const tb = t1 + tg;
    D.shape(X, K, L, { s: "heart", x: 0.5, y: 0.4, w: pt ? 0.05 : 0.07, fill: "holo", in: "pop", at: tb + 0.05 });
    D.text(X, K, L, { t: brand, h: 1, maxw: pt ? 0.6 : 0.28, x: 0.5, y: 0.52, f: "w", fill: "out", c: "rgba(235,235,255,0.9)", sw: 0.0018, in: "spread", at: tb, zm: [1, 1.05] });
    if (feats) D.text(X, K, L, { t: feats, h: 0.026, x: 0.5, y: 0.66, fill: "white", op: 0.75, ls: 0.18, in: "cut", at: tb + 0.5 });
    D.orn(X, K, L, { x: 0.5, y: 0.84, n: 4, s: 0.009, c: "#9EEFF4", at: tb + 0.6 });
    if (p.fadeSec > 0) { const f = K.div(X.root, "patch", { left: "0px", top: "0px", width: X.W + "px", height: X.H + "px", background: "#000", zIndex: 70 }); X.T(f, "opacity", "0").to(Math.max(0, d - p.fadeSec), p.fadeSec, "1"); }
  },
};
