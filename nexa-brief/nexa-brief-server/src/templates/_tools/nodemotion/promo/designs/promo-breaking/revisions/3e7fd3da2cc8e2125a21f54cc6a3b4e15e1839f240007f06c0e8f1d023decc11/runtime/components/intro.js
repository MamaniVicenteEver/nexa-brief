/* Promo Breaking · intro (primer segmento del guion).
   Arranca en negro, entra la foto en B/N con el tinte rojo y las letras
   gigantes deslizando; el titular se teclea letra a letra, crece el subrayado
   rojo y aparece el subtítulo espaciado. Textos: intro.title / intro.sub del
   config o, si están vacíos, los renglones 1 y 2 del primer segmento. */
const R = window.NexaPromo_promo_breaking, k = R.kit, S = R.S;

R.scenes.intro = {
  label: "Intro · titular tecleado",
  params: {
    grade: S.enum(["mono", "red", "none"], "mono"),
    tint: S.enum(["auto", "tl", "tr", "bl", "br", "none"], "tl"),
    outline: S.enum(["auto", "none", "all", "alt"], "auto"),
    textIn: S.enum(["type", "rise", "squash", "pop", "fade"], "type"),
    giant: S.bool(true),
    motion: S.enum(["drift", "zoom", "still"], "zoom"),
    blackSec: S.num(0, 2, 0.35),
    scale: S.num(0.5, 1.5, 1),
  },
  render(sc, X, K) {
    const { W, H } = X, p = X.p, ls = K.lines(X);
    const title = K.C.intro.title || ls[0]?.text || K.BR.name || "";
    const sub = K.C.intro.sub || ls[1]?.text || K.BR.tag || "";
    const L = X.L;
    L.style.background = K.P.ink;
    const bg = K.div(L, "lay");
    k.photo(X, K, bg, 0, { grade: p.grade, motion: p.motion });
    if (p.giant) k.giant(X, K, bg, k.chunk(title), { slideIn: 0.9 });
    k.vignette(X, K, bg);
    k.tint(X, K, bg, p.tint);
    X.T(bg, "opacity", "0").to(p.blackSec, 0.5, "1", K.EASE_OUT);
    k.decor(X, K, L, 5);
    /* en vertical, un titular de varias palabras se apila (una palabra por renglón) para ganar tamaño */
    const rows = W < H && title.trim().includes(" ") ? title.trim().split(/\s+/) : [title];
    const longest = rows.reduce((a, c) => k.plain(c).length > k.plain(a).length ? c : a, rows[0]);
    const fs = Math.min(k.fitFs(K, longest, "hd", 0, k.maxW(X, 0.6, 0.86) * p.scale, 0.16 * H * p.scale), 0.2 * H);
    const t0 = p.blackSec + 0.25, y = 0.47 * H + (rows.length - 1) * fs * 0.5;
    let w, tt = t0;
    rows.forEach((row, i) => {
      w = k.word(X, K, L, row, { x: W / 2, y: y - (rows.length - 1 - i) * fs * 1.0, fs, t0: tt, textIn: p.textIn });
      tt += p.textIn === "type" ? w.chars.length * 0.07 / K.C.anim.speed : 0.12;
    });
    const typed = tt - t0 + (p.textIn === "type" ? 0 : 0.23);
    k.underline(X, K, L, w.left + w.width * 0.16, y + fs * 0.48, w.width * 0.62, t0 + typed * 0.6, Math.max(2, fs * 0.05));
    if (sub) {
      const fs2 = Math.min(fs * 0.24, k.fitFs(K, sub, "hl", 0.42, w.width * 1.05, fs * 0.3));
      k.spaced(X, K, L, sub, { x: W / 2, y: y + fs * 0.66, fs: fs2, t0: t0 + typed + 0.1 });
    }
  },
};
