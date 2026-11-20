/* Lyrics Hologram Worlds · intro. Réplica de la apertura de la referencia (0 a 1,7 s), que también
   sirve de portada: (1) emblema blanco que cambia de forma cada dos cuadros, con rayitas que destellan,
   (2) corte a una ventana de seda que crece con una silueta de perfil enorme; el título (intro.title)
   llega como cuatro ecos en contorno que convergen en la palabra sólida; el artista (intro.artist) en
   rótulos diminutos, y (3) tres emblemas holográficos que caen apilados antes de la primera escena.
   Las fases se reparten según la duración de la intro. */
const R = window.NexaPromo_lyrics_hologram_worlds, k = R.kit, S = R.S;

R.scenes.intro = {
  label: "Intro · emblema que cambia, ventana de seda con silueta y título que converge (apertura del video)",
  params: { emblem: S.enum(["emb-crest", "emb-blades", "emb-star"], "emb-crest"), silhouette: S.enum(["sil-profile", "sil-spiky", "sil-bun", "sil-ponytail"], "sil-profile") },
  render(sc, X, K) {
    const W = R.worlds, D = W.DRAW, M = (node, e) => W.motion(X, K, node, e), p = X.p, I = K.C.intro, pt = k.port(X), d = X.dur || sc.dur;
    const L = W.worldBg(X, K, "void", {});
    const t1 = Math.min(0.5, d * 0.3), t3 = d >= 1.2 ? d - Math.min(0.2, d * 0.13) : d;
    const title = String(I.title || "").trim(), artist = String(I.artist || "").trim();
    const others = ["emb-blades", "emb-crest", "emb-star", "emb-crown"].filter(n => n !== p.emblem);
    /* (1) emblema que cambia de forma */
    D.img(X, K, L, { s: p.emblem, x: 0.5, y: 0.47, h: pt ? 0.26 : 0.42, fill: "white", at: 0, to: t1, glow: 0.008, shuf: others, step: 0.067, shufTo: t1 - 0.12 });
    for (const [y, x] of [[0.43, 0.08], [0.43, 0.9], [0.52, 0.86]]) D.box(X, K, L, { x, y, w: 0.06, h: 0.002, fill: "rgba(255,255,255,0.6)", at: 0.2, to: t1 - 0.05 });
    /* (2) ventana de seda que crece + silueta + título que converge */
    M(D.box(X, K, L, { x: pt ? 0.05 : 0.21, y: 0.2, w: pt ? 0.9 : 0.37, h: 0.8, fill: "holo", at: t1, to: d }), { kf: [[t1, { s: 1 }], [t1 + 0.3, { s: 2.8, x: 0.12 }]] });
    M(D.img(X, K, L, { s: p.silhouette, x: pt ? 0.62 : 0.6, y: 0.64, h: pt ? 0.95 : 1.42, fill: "#040407", at: t1, to: d }), { kf: [[t1, { s: 1.06, x: 0.03 }], [d, { s: 1.0, x: 0, e: "out" }]] });
    if (title) {
      const words = title.split(/\s+/), hero = words.reduce((a, b) => (b.length > a.length ? b : a), words[0]);
      const rest = words.filter(w => w !== hero).join(" ");
      const hw = Math.min(pt ? 0.7 : 0.4, 0.04 + hero.length * 0.03);
      D.text(X, K, L, { t: hero, h: 1, maxw: hw, x: 0.5, y: 0.5, fill: "white", in: "cut", at: t1, to: t3 + 0.1, echo: { n: 4, dy: 0.11, d: 0.25, at: t1 } });
      if (rest) {
        D.box(X, K, L, { x: 0.5 - hw / 2 - 0.004, y: 0.375, w: Math.min(0.2, 0.012 + rest.length * 0.011), h: 0.045, fill: "white", in: "wipeL", at: t1 + 0.28, to: t3 });
        D.text(X, K, L, { t: rest, h: 0.03, x: 0.5 - hw / 2 + 0.004, y: 0.398, ax: 0, fill: "ink", in: "cut", at: t1 + 0.32, to: t3 });
      }
    }
    if (artist) D.lab(X, K, L, { t: artist, rows: [0.055, 0.945], xs: [0.06, 0.5, 0.94], at: t1 });
    D.vcol(X, K, L, { t: artist || "NODEMOTION", x: 0.5, v: -0.02, op: 0.5 });
    /* (3) emblemas que caen apilados */
    if (t3 < d) for (const [i, y] of [0.12, 0.5, 0.88].entries())
      M(D.img(X, K, L, { s: p.emblem, x: 0.5, y, h: pt ? 0.16 : 0.28, fill: "holo", at: t3 - 0.08 + 0.02 * i, glow: 0.01 }), { kf: [[t3 - 0.08 + 0.02 * i, { y: -0.25 }], [t3 + 0.04 + 0.02 * i, { y: 0, e: "out" }]] });
  },
};
