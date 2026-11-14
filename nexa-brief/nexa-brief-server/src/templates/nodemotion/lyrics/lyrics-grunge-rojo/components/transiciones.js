/* lyrics-grunge-rojo · transiciones de entrada e interludios.
   Transiciones (capa sobre la escena nueva, duración config.transitions.sec):
     cut, tear (hoja de papel rasgado que cruza), glitch (franjas desplazadas rojo/blanco),
     flash (destello de luz blanca), redflash (destello rojo), blur (entra desenfocada).
   Interludios (silencios sin letra): metraje (ojos de tiza + niebla), franjas
     (barras rojas con la última frase), rejilla (frase ya cantada repetida en cuadrícula). */
(function (root) {
  "use strict";
  const G = root.GrungeRojo, K = G.core, R = G.registry, F = G.fondo;

  /* --------------------------- transiciones --------------------------- */
  R.transitions.cut = () => null;
  R.transitions.tear = (sc, ctx, rootEl) => {
    const { W, H } = ctx, r = K.rng(sc.seed + 77);
    const s = K.layer(rootEl, W, H, "gr-over");
    const g = K.svg("g", {}, s);
    const id = "tear" + sc.seed;
    const pat = K.svg("pattern", { id, patternUnits: "userSpaceOnUse", width: 512, height: 512 }, K.svg("defs", {}, s));
    K.svg("image", { href: ctx.tex.paperLight, width: 512, height: 512 }, pat);
    /* banda de papel con dos bordes rasgados */
    const band = H * 0.55;
    let d = "M-10,0"; let x = -10;
    const top = [], bot = [];
    while (x < W + 20) { top.push([x, r.range(-1, 1) * ctx.u * 1.5]); bot.push([x, band + r.range(-1, 1) * ctx.u * 1.5]); x += r.range(8, 22); }
    d = "M" + top.map(p => p.map(v => v.toFixed(1)).join(",")).join("L") + "L" + bot.reverse().map(p => p.map(v => v.toFixed(1)).join(",")).join("L") + "Z";
    K.svg("path", { d, fill: `url(#${id})` }, g);
    const dur = ctx.C.transitions.sec;
    return lt => { const p = K.prog(lt, 0, dur); s.style.display = p < 1 ? "block" : "none"; g.setAttribute("transform", `translate(0,${(-band + p * (H + band * 1.4) - band * 0.2).toFixed(1)})`); };
  };
  R.transitions.glitch = (sc, ctx, rootEl) => {
    const wrap = K.el("div", "gr-over gr-glitch", rootEl), r = K.rng(sc.seed + 31);
    const bars = Array.from({ length: 6 }, () => { const b = K.el("div", "gr-gbar", wrap); b.style.top = (r() * 92).toFixed(1) + "%"; b.style.height = r.range(2, 9).toFixed(1) + "%"; b.style.background = r() < 0.6 ? ctx.red : ctx.white; return b; });
    const dur = ctx.C.transitions.sec;
    return lt => {
      const on = lt < dur; wrap.style.display = on ? "block" : "none";
      if (!on) { rootEl.style.transform = ""; return; }
      const step = Math.floor(lt / 0.04), q = K.rng(sc.seed + step * 3);
      bars.forEach(b => { b.style.transform = `translateX(${q.range(-30, 30).toFixed(1)}%)`; b.style.opacity = (q() < 0.75 ? 0.9 : 0).toString(); });
      rootEl.style.transform = `translateX(${q.range(-1, 1) * ctx.u * 1.5}px)`;
    };
  };
  R.transitions.flash = (sc, ctx, rootEl) => { const L = F.leak(rootEl, "rgba(255,255,255,.95)"); const dur = ctx.C.transitions.sec * 1.6; return lt => L.update(K.prog(lt, 0, dur)); };
  R.transitions.redflash = (sc, ctx, rootEl) => {
    const e = K.el("div", "gr-over", rootEl, { background: ctx.red, mixBlendMode: "multiply" });
    const dur = ctx.C.transitions.sec;
    return lt => { e.style.opacity = (1 - K.prog(lt, 0, dur)).toFixed(3); e.style.display = lt < dur ? "block" : "none"; };
  };
  R.transitions.blur = (sc, ctx, rootEl) => {
    const dur = ctx.C.transitions.sec;
    return lt => { const q = 1 - K.ease.out(K.prog(lt, 0, dur)); rootEl.style.filter = q > 0.01 ? `blur(${(q * ctx.u * 1.2).toFixed(1)}px)` : ""; };
  };

  /* ----------------------------- interludios ----------------------------- */
  const P = () => G.parts;
  R.interludes.metraje = (sc, ctx) => {
    const S = P().scaffold({ ...sc, bg: "footage", v: { strip: sc.v.strip } }, ctx);
    const r = K.rng(sc.seed);
    const box = { x: ctx.W * r.range(0.35, 0.55), y: ctx.H * r.range(0.3, 0.4), w: ctx.W * 0.1, h: ctx.H * 0.06 };
    const draw = ctx.C.components.doodles ? G.doodle(S.rootEl, ctx, "eyes", box, sc.seed) : () => {};
    const L = F.leak(S.rootEl, "rgba(255,255,255,.7)");
    return P().finish(S, sc, ctx, { target: null, update: (lt, D) => { draw(K.prog(lt, 0.1, 0.6)); L.update(K.prog(lt, D * 0.6, D)); } });
  };
  R.interludes.franjas = (sc, ctx) => {
    const S = P().scaffold({ ...sc, bg: "dark", v: {} }, ctx);
    const r = K.rng(sc.seed);
    const text = P().up(sc.text || "");
    const bars = Array.from({ length: 4 }, (_, i) => {
      const b = K.el("div", "gr-rbar", S.txt, { top: (18 + i * 18 + r.range(-3, 3)).toFixed(1) + "%", background: i % 2 ? ctx.red : "rgba(232,41,46,.55)" });
      const tx = K.el("div", "gr-rbar-t", b); K.useFont(tx, ctx.fonts.condensed, ctx.H * 0.09); tx.textContent = text; tx.style.color = i % 2 ? ctx.white : ctx.black;
      return { b, v: r.range(0.6, 1.4) * (i % 2 ? 1 : -1) };
    });
    return P().finish(S, sc, ctx, { target: null, update: lt => bars.forEach(x => { x.b.style.transform = `translateX(${(x.v * lt * 9 - 10).toFixed(2)}%)`; }) });
  };
  R.interludes.rejilla = (sc, ctx) => {
    const S = P().scaffold({ ...sc, bg: "footage", v: {} }, ctx);
    const grid = K.el("div", "gr-grid", S.txt);
    const text = P().up(sc.text || "");
    const size = K.fit([text], ctx.fonts.condensed, ctx.W * (ctx.W < ctx.H ? 0.46 : 0.3), ctx.H * 0.12);
    const cells = [];
    for (let i = 0; i < 18; i++) { const c = K.el("span", "gr-cell", grid); K.useFont(c, ctx.fonts.condensed, size); c.textContent = text; c.style.color = i % 5 === 2 ? ctx.red : ctx.white; cells.push(c); }
    return P().finish(S, sc, ctx, { target: null, update: (lt, D) => {
      cells.forEach((c, i) => { c.style.visibility = lt >= i * Math.min(0.04, D / 40) ? "visible" : "hidden"; });
      grid.style.transform = `translate(-50%,-50%) translateX(${(-lt * ctx.u * 2).toFixed(1)}px) scale(${(1 + 0.04 * K.prog(lt, 0, D)).toFixed(4)})`;
      grid.style.filter = `blur(${(Math.abs(Math.sin(lt * 3)) * 1.2).toFixed(2)}px)`;
    } });
  };

  G.TRANSITIONS = Object.keys(R.transitions);
  G.INTERLUDES = Object.keys(R.interludes);
})(typeof window !== "undefined" ? window : globalThis);
