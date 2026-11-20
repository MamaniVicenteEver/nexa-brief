/* Lyrics Hologram · intro (antes de la primera frase cantada, si dura lo
   suficiente). Fondo casi negro con rótulos, silueta holográfica opcional, un
   emblema geométrico propio con relleno holográfico que aparece y sube, el
   título (intro.title) en la condensada holográfica y el artista (intro.artist)
   espaciado debajo. */
const R = window.NexaPromo_lyrics_hologram, k = R.kit, S = R.S;
/* emblemas propios (polígonos en unidades -1..1): no reproducen marcas existentes */
const EMBLEMS = {
  crest: [[0, -1], [0.34, -0.62], [0.82, -0.86], [0.66, -0.2], [0.92, 0.18], [0.34, 0.3], [0, 1], [-0.34, 0.3], [-0.92, 0.18], [-0.66, -0.2], [-0.82, -0.86], [-0.34, -0.62]],
  diamond: [[-0.5, -0.72], [0.5, -0.72], [0.88, -0.24], [0, 1], [-0.88, -0.24]],
};

R.scenes.intro = {
  label: "Intro · emblema holográfico + título",
  params: { emblem: S.enum(["crest", "diamond", "none"], "crest"), media: S.bool(true) },
  render(sc, X, K) {
    const { W, H } = X, p = X.p, I = K.C.intro, pt = k.port(X);
    const { L } = k.bg(X, K, { bg: "void" });
    const tT = sc.words[0]?.rt ?? 0.3, dur = X.dur;
    const sil = p.media ? k.silSlot(X, K) : null;
    if (sil !== null) {
      const m = k.media(X, K, L, sil, pt ? { x: -0.3 * W, y: 0.1 * H, w: 1.6 * W, h: 0.8 * H } : { x: 0.1 * W, y: 0, w: 0.8 * W, h: H });
      X.T(m.box, "opacity", "0").to(0, Math.min(1.2, dur * 0.4), "0.75");
    }
    const m = Math.min(W, H), es = (pt ? 0.2 : 0.17) * m;
    if (p.emblem !== "none") {
      const e = k.holoBox(X, K, L, { left: W / 2 - es + "px", top: H / 2 - es + "px", width: 2 * es + "px", height: 2 * es + "px",
        clipPath: `polygon(${EMBLEMS[p.emblem].map(([x, y]) => `${((x + 1) * 50).toFixed(1)}% ${((y + 1) * 50).toFixed(1)}%`).join(", ")})` });
      e.style.filter = `drop-shadow(0 0 ${(0.02 * m).toFixed(1)}px rgba(214,200,255,0.55))`;
      X.T(e, "transform", "scale(0.4)").to(0.05, 0.5, "scale(1)", K.EASE_BACK).to(Math.max(0.6, tT - 0.05), 0.4, `translateY(${(-0.24 * H).toFixed(0)}px) scale(0.55)`, K.EASE_IO);
      X.T(e, "opacity", "0").to(0.05, 0.25, "1");
    }
    const title = k.U(I.title || ""), artist = k.U(I.artist || "");
    if (title) {
      const fs = Math.min(k.fit(K, title, "fc", 0.84 * W, (pt ? 0.14 : 0.24) * H), 0.26 * H);
      const ws = title.split(/\s+/).map((w, i) => ({ text: w, rt: tT + i * 0.1 }));
      k.line(X, K, L, ws, { cls: "fc", fs, x: W / 2, y: 0.53 * H, color: K.P.white, holo: true, mode: "slide" });
      if (artist) { const a = K.tx(L, artist, { cls: "fc", fs: Math.max(0.026 * H, fs * 0.17), x: W / 2, y: 0.53 * H + fs * 0.66, ax: 0.5, color: K.P.white, ls: 0.4 }); k.enter(X, K, a.el, "spread", tT + 0.35); }
      k.ornaments(X, K, L, W / 2, 0.53 * H - fs * 0.66, 5, 0.012 * m * 1.3, K.P.h2, tT + 0.2);
    }
  },
};
