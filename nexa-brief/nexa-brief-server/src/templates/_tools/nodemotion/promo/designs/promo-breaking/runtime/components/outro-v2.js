/* Promo Breaking · Outro v2. Pantalla roja con filas de la marca que corren
   en sentidos alternos (letras sólidas y en contorno) y una placa blanca
   central con el titular en tinta y la llamada en rojo. Cierra en negro.
   Mismas fuentes de texto que el Outro v1 (outro.title / outro.cta /
   renglones del último segmento / brand.name / brand.url / brand.cta). */
const R = window.NexaPromo_promo_breaking, k = R.kit, S = R.S;

R.scenes.outroV2 = {
  label: "Outro v2 · filas rojas + placa blanca",
  params: {
    rows: S.num(3, 9, 7),
    speed: S.num(0, 2, 1),
    fadeSec: S.num(0, 3, 0.7),
    textIn: S.enum(["type", "rise", "squash", "pop", "fade"], "rise"),
  },
  render(sc, X, K) {
    const { W, H, u, r } = X, p = X.p, ls = K.lines(X);
    const title = K.C.outro.title || ls[0]?.text || K.BR.name || "";
    const sub = K.C.outro.cta || ls[1]?.text || K.BR.url || "";
    const L = X.L;
    L.style.background = K.P.red;
    const n = Math.round(p.rows), word = (k.plain(title) + "  ").repeat(4).toUpperCase();
    const fsR = (H / n) * 0.82, lh = H / n;
    for (let i = 0; i < n; i++) {
      const row = K.div(L, "lay");
      const o = K.tx(row, word, { x: W / 2, y: lh * (i + 0.5), ax: 0.5, fs: fsR, cls: "hd", color: i % 2 ? K.P.ink : K.P.white, ls: 0.02, split: "chars" });
      o.chars.forEach(c => { if (c.textContent !== " " && r() < 0.35) { c.style.color = "transparent"; c.style.webkitTextStroke = `${Math.max(1, fsR * 0.02)}px ${i % 2 ? K.P.ink : K.P.white}`; } });
      const dx = (i % 2 ? 1 : -1) * 0.08 * W * p.speed;
      X.T(row, "transform", `translateX(${(-dx).toFixed(1)}px)`).to(0, X.dur, `translateX(${dx.toFixed(1)}px)`);
      X.T(row, "opacity", "0").to(0.03 * i, 0.2, "1");
    }
    const port = W < H;
    const fs = Math.min(k.fitFs(K, title, "hd", 0, (port ? 0.72 : 0.46) * W, 0.13 * H), 0.16 * H);
    const fs2 = sub ? Math.min(fs * 0.24, k.fitFs(K, sub, "hl", 0.3, (port ? 0.72 : 0.46) * W, fs * 0.3)) : 0;
    const tw = Math.max(K.textW(k.plain(title), "hd", 0, fs), sub ? K.textW(sub, "hl", 0.3, fs2) : 0);
    const pw = tw + fs * 0.9, ph = fs * (sub ? 1.95 : 1.4), px = W / 2 - pw / 2, py = H / 2 - ph / 2;
    const plate = K.div(L, "patch", { left: px + "px", top: py + "px", width: pw + "px", height: ph + "px", background: K.P.white, boxShadow: `0 ${12 * u}px ${40 * u}px rgba(0,0,0,0.35)`, transformOrigin: "50% 50%" });
    X.T(plate, "transform", "scaleY(0)").to(0.2, 0.35, "scaleY(1)", K.EASE_OUT);
    k.word(X, K, plate, title, { x: pw / 2, y: fs * 0.72, fs, color: K.P.ink, t0: 0.45, textIn: p.textIn });
    if (sub) k.word(X, K, plate, sub, { cls: "hl", ls: 0.3, x: pw / 2 + fs2 * 0.15, y: fs * 1.45, fs: fs2, color: K.P.red, mode: "none", t0: 0.75, textIn: "fade" });
    const bar = K.div(plate, "patch", { left: "0px", top: ph - 6 * u + "px", width: pw + "px", height: 6 * u + "px", background: K.P.ink, transformOrigin: "0% 50%" });
    X.T(bar, "transform", "scaleX(0)").to(0.6, 0.5, "scaleX(1)", K.EASE_OUT);
    if (K.BR.cta) K.tx(L, K.BR.cta.toUpperCase(), { x: W / 2, y: py + ph + fs * 0.45, ax: 0.5, fs: Math.max(11 * u, fs2 * 0.9), cls: "hl", ls: 0.4, color: K.P.white });
    if (p.fadeSec > 0) {
      const f = K.div(X.root, "patch", { left: "0px", top: "0px", width: W + "px", height: H + "px", background: "#000", zIndex: 70 });
      X.T(f, "opacity", "0").to(Math.max(0, X.dur - p.fadeSec), p.fadeSec, "1");
    }
  },
};
