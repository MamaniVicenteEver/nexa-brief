/* lyrics-trazo · Outro v2 «Grieta».
   Papel blanco. Una grieta negra se abre desde el centro; después el título
   aparece letra por letra, cada letra con un estilo distinto del mazo
   (rotulación mezclada), «sub» y feats debajo, y tres impactos rematan. */
(function (root) {
  "use strict";
  const T = root.Trazo, K = T.core, R = T.registry;
  R.outros["trazo.outrov2"] = function buildOutroV2(sc, ctx) {
    const O = ctx.C.outro, r = K.rng(sc.seed);
    const D = Math.max(0.5, sc.t1 - sc.t0);
    const rootEl = K.el("div", "tz-scene");
    const s = K.svgLayer(rootEl, ctx.W, ctx.H); s.classList.add("tz-doodle");
    const cracks = K.crack(ctx.W / 2, ctx.H / 2, Math.max(ctx.W, ctx.H) * 0.6, r, 8)
      .map(pt => ({ p: K.strokePaths(s, [pt.d], { width: Math.max(1.5, ctx.u * (pt.gen ? 0.3 : 0.5)) })[0], gen: pt.gen }));
    /* letras del título: cada una en otro estilo */
    const title = [...String(O.title || "").toLocaleUpperCase("es")];
    const styleIds = Object.keys(ctx.C.styles).filter(k => ctx.C.styles[k].weight > 0);
    const row = K.el("div", "tz-holder tz-ransom", rootEl, { top: "-8%" });
    const letterW = ctx.W * 0.84 / Math.max(4, title.length);
    const letters = title.map((ch, i) => {
      const st = ctx.C.styles[styleIds[(i * 5 + (sc.seed % 7)) % styleIds.length]];
      const span = K.el("span", "tz-ransom-l", row);
      const f = ctx.fonts[st.font] || {};
      span.textContent = ch === " " ? " " : ch;
      span.style.fontFamily = `"${f.family}"`;
      span.style.fontSize = Math.min(letterW * 1.45, ctx.H * 0.2).toFixed(1) + "px";
      span.style.transform = `rotate(${r.range(-8, 8).toFixed(1)}deg) translateY(${r.range(-6, 6).toFixed(0)}%)`;
      return span;
    });
    const sub = K.el("div", "tz-outro-sub", rootEl);
    const sf = ctx.fonts[O.subFont] || {}, ff = ctx.fonts[O.featsFont] || {};
    sub.style.fontFamily = `"${sf.family}"`;
    sub.style.fontSize = (Math.min(ctx.W, ctx.H) * 0.11).toFixed(1) + "px";
    sub.textContent = O.sub || "";
    const feats = K.el("div", "tz-outro-feats", rootEl);
    feats.style.fontFamily = `"${ff.family}"`;
    feats.style.fontSize = (Math.min(ctx.W, ctx.H) * 0.065).toFixed(1) + "px";
    const featsText = String(O.feats || "");
    const holes = [0, 1, 2].map(i => K.strokePaths(K.svg("g", {}, s), K.bulletHole(ctx.W * (0.2 + 0.3 * i + r.range(-0.05, 0.05)), ctx.H * r.range(0.72, 0.84), ctx.u * r.range(2.4, 3.4), r), { width: Math.max(1.5, ctx.u * 0.35) }));
    return {
      root: rootEl,
      update(lt) {
        const pc = K.prog(lt, 0, D * 0.35);
        cracks.forEach(x => { K.setDraw(x.p, K.prog(pc, x.gen * 0.18, 0.45 + x.gen * 0.18)); x.p.style.opacity = String(1 - 0.7 * K.prog(lt, D * 0.35, D * 0.5)); });
        letters.forEach((sp, i) => { sp.style.visibility = lt >= D * 0.3 + i * Math.min(0.09, D * 0.3 / letters.length) ? "visible" : "hidden"; });
        sub.style.clipPath = `inset(-20% ${((1 - K.prog(lt, D * 0.55, D * 0.7)) * 100).toFixed(1)}% -20% -5%)`;
        feats.textContent = featsText.slice(0, Math.round(featsText.length * K.prog(lt, D * 0.62, D * 0.82)));
        holes.forEach((ps, i) => ps.forEach(p => K.setDraw(p, K.prog(lt, D * (0.78 + i * 0.05), D * (0.78 + i * 0.05) + 0.06))));
        return { inv: true };
      }
    };
  };
})(typeof window !== "undefined" ? window : globalThis);
