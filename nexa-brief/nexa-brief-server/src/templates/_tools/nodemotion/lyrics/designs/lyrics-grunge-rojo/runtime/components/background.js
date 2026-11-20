/* lyrics-grunge-rojo · fondos y capas.
   footage : hueco donde el orquestador coloca el <video> B/N de la escena (o su póster).
   paper   : papel gris arrugado.  dark : negro con viñeta.
   Capas: tiras de papel rasgado arriba/abajo, niebla, destello de luz (blanco o rojo). */
(function (root) {
  "use strict";
  const G = root.GrungeRojo, K = G.core;

  function background(rootEl, ctx, sc) {
    const mode = sc.bg || "footage";
    const bg = K.el("div", "gr-bg gr-bg-" + mode, rootEl);
    let slot = null;
    if (mode === "footage") {
      slot = K.el("div", "gr-slot", bg);
      const m = ctx.media[sc.clip];
      if (m && m.poster) slot.style.backgroundImage = `url("${encodeURI(m.poster)}")`;
      K.el("div", "gr-vignette", bg);
    } else if (mode === "paper") {
      bg.style.backgroundImage = `url(${ctx.tex.paper})`;
      K.el("div", "gr-vignette gr-vignette-soft", bg);
    } else {
      K.el("div", "gr-vignette", bg);
    }
    return { bg, slot, update(lt, D) {
      /* deriva lenta de cámara sobre el metraje */
      if (slot) slot.style.transform = `scale(${(1.06 + 0.05 * K.prog(lt, 0, Math.max(0.5, D))).toFixed(4)})`;
    } };
  }

  /* tira de papel rasgado (arriba o abajo), entra deslizándose */
  function tornStrip(rootEl, ctx, side, frac, seed) {
    const { W, H } = ctx, r = K.rng(seed);
    const s = K.layer(rootEl, W, H, "gr-strip");
    const id = "grp" + (seed >>> 0);
    const defs = K.svg("defs", {}, s);
    const pat = K.svg("pattern", { id, patternUnits: "userSpaceOnUse", width: 512, height: 512 }, defs);
    K.svg("image", { href: ctx.tex.paperLight, width: 512, height: 512 }, pat);
    const y0 = side === "top" ? H * frac : H * (1 - frac);
    const depth = ctx.u * 1.6;
    const g = K.svg("g", {}, s);
    K.svg("path", { d: K.tornPath(W, y0 + (side === "top" ? depth * 0.9 : -depth * 0.9), depth, side === "top" ? -1 : 1, K.rng(seed + 1)), fill: "rgba(0,0,0,.55)" }, g);
    K.svg("path", { d: K.tornPath(W, y0, depth, side === "top" ? -1 : 1, r), fill: `url(#${id})` }, g);
    return { update(p) { const off = (1 - K.ease.out(p)) * H * frac * 1.3 * (side === "top" ? -1 : 1); g.setAttribute("transform", `translate(0,${off.toFixed(1)})`); } };
  }
  function fog(rootEl, seed) {
    const r = K.rng(seed), e = K.el("div", "gr-fog", rootEl);
    e.style.background = `radial-gradient(ellipse at ${r.int(20, 80)}% ${r.int(30, 70)}%, rgba(235,235,235,.38), rgba(235,235,235,0) 62%)`;
    return { update(lt) { e.style.opacity = (0.55 + 0.35 * Math.sin(lt * 1.3 + seed)).toFixed(3); e.style.transform = `translateX(${(Math.sin(lt * 0.6 + seed) * 4).toFixed(2)}%)`; } };
  }
  function leak(rootEl, color) {
    const e = K.el("div", "gr-leak", rootEl);
    e.style.background = `linear-gradient(100deg, rgba(0,0,0,0) 20%, ${color} 50%, rgba(0,0,0,0) 80%)`;
    return { update(p) { e.style.opacity = (Math.sin(K.clamp(p) * Math.PI) * 0.85).toFixed(3); e.style.transform = `translateX(${((p - 0.5) * 60).toFixed(1)}%)`; } };
  }

  G.fondo = { background, tornStrip, fog, leak };
})(typeof window !== "undefined" ? window : globalThis);
