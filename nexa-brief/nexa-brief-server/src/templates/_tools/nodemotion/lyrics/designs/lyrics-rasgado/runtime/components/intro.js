/* Lyrics Rasgado · intro (antes de la primera frase cantada, si dura lo
   suficiente). El medio en B/N con acento lima ocupa el cuadro, entran
   jirones de papel lima y carbón, el título (intro.title) en la extendida
   negra sobre una tira de papel y el artista (intro.artist) en la fina. */
const R = window.NexaPromo_lyrics_rasgado, k = R.kit, S = R.S;

R.scenes.intro = {
  label: "Intro · medio + jirones + título",
  params: { media: S.bool(true), tiltDeg: S.num(-12, 12, -6) },
  render(sc, X, K) {
    const { W, H, u } = X, p = X.p, I = K.C.intro;
    const L = X.L; L.style.background = K.P.ink;
    if (p.media) k.media(X, K, L, 0);
    /* jirones diagonales lima y carbón que entran */
    [[K.P.lime, -0.18, 0.1], [K.P.ink, 0.62, 0.25]].forEach(([c, y, t]) => {
      const g = K.div(L, "lay", { transform: `rotate(${(-14 + X.r() * 6).toFixed(1)}deg) scale(1.3)` });
      const band = k.tornBand(X, K, g, "top", c, 0.32 * H, { amp: 0.3 });
      band.style.top = y * H + "px";
      X.T(g, "opacity", "0").to(t, 0.2, "1");
      X.T(band, "transform", "translateX(-30%)").to(t, 0.5, "translateX(0%)", K.EASE_OUT);
    });
    const title = k.U(I.title || ""), artist = I.artist || "";
    const fs = Math.min(k.fit(K, title, "fw", 0.78 * W, 0.16 * H), 0.16 * H);
    const strip = K.div(L, "lay");
    const sh = fs * 1.5, sy = H / 2 - sh / 2;
    const paper = k.tornBand(X, K, strip, "bottom", K.P.paper, sh, { amp: 0.12 });
    paper.style.top = sy + "px";
    const tt = K.tx(strip, title, { cls: "fw", fs, x: W / 2, y: H / 2, ax: 0.5, color: K.P.ink });
    k.tilt(X, K, strip, p.tiltDeg);
    X.T(strip, "clipPath", "inset(0% 100% 0% 0%)").to(0.35, 0.4, "inset(0% 0% 0% 0%)", K.EASE_OUT);
    if (artist) { const a = K.tx(L, k.U(artist), { cls: "ft", fs: fs * 0.28, x: W / 2, y: H / 2 + sh * 0.75, ax: 0.5, color: K.P.paper, ls: 0.4 }); K.hide(X, a.box, 0.75); }
    k.doodle(X, K, L, "x", { x: 0.16 * W, y: 0.2 * H, w: 0, h: 0, s: 26 }, 0.6, K.P.lime);
    k.doodle(X, K, L, "tri", { x: 0.82 * W, y: 0.78 * H, w: 0, h: 0, s: 22 }, 0.8, K.P.lime);
    k.later(X, tt.el, b => k.doodle(X, K, L, "underline", b, 0.9, K.P.lime));
  },
};
