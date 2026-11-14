/* lyrics-trazo · Outro v1 «Burbuja».
   Fondo negro. El título (config.outro.title) aparece en letras de burbuja
   apiladas con rebote, «sub» se escribe a mano debajo, un garabato lo subraya
   y la línea final (feats) se teclea. Queda quieto en su estado final. */
(function (root) {
  "use strict";
  const T = root.Trazo, K = T.core, R = T.registry;
  R.outros["trazo.outrov1"] = function buildOutroV1(sc, ctx) {
    const O = ctx.C.outro, r = K.rng(sc.seed);
    const D = Math.max(0.5, sc.t1 - sc.t0);
    const rootEl = K.el("div", "tz-scene");
    const holder = K.el("div", "tz-holder", rootEl, { top: "-12%" });
    const L = T.lettering(holder, O.title || "", { font: O.titleFont, treatment: "solid", case: "upper" }, "line", ctx, r, { w: 0.86, h: 0.3 });
    const subHolder = K.el("div", "tz-holder", rootEl, { top: (L.bh * 0.5 / ctx.H * 100 + 6).toFixed(1) + "%" });
    const S = T.lettering(subHolder, O.sub || "", { font: O.subFont, treatment: "solid", case: "asis" }, "line", ctx, r, { w: 0.66, h: 0.17 });
    S.block.style.transform = "rotate(-5deg)";
    const s = K.svgLayer(rootEl, ctx.W, ctx.H); s.classList.add("tz-doodle");
    const uy = ctx.H / 2 + L.bh * 0.5 + ctx.H * 0.15;
    const under = K.strokePaths(s, [K.wobblyLine(ctx.W * 0.3, uy, ctx.W * 0.7, uy - ctx.u, r, 0.04, 7)], { width: Math.max(2, ctx.u * 0.5) });
    const feats = K.el("div", "tz-outro-feats", rootEl);
    const ff = ctx.fonts[O.featsFont] || {};
    feats.style.fontFamily = `"${ff.family || "sans-serif"}"`;
    feats.style.fontSize = (Math.min(ctx.W, ctx.H) * 0.095).toFixed(1) + "px";
    const featsText = String(O.feats || "");
    let lastBoil = -1;
    return {
      root: rootEl,
      update(lt, frame) {
        const k = 0.78 + 0.22 * K.ease.back(K.prog(lt, 0, Math.min(0.3, D * 0.2)));
        holder.style.transform = `scale(${k.toFixed(4)})`;
        S.block.style.clipPath = `inset(-20% ${((1 - K.ease.inOut(K.prog(lt, D * 0.18, D * 0.42))) * 100).toFixed(1)}% -20% -5%)`;
        K.setDraw(under[0],K.prog(lt, D * 0.4, D * 0.55));
        feats.textContent = featsText.slice(0, Math.round(featsText.length * K.prog(lt, D * 0.5, D * 0.75)));
        if (frame.boilStep !== lastBoil) {
          T.boilRows(L.rows, frame.boilStep, sc.seed, ctx.C.motion.boil * ctx.u);
          T.boilRows(S.rows, frame.boilStep, sc.seed + 1, ctx.C.motion.boil * ctx.u);
          lastBoil = frame.boilStep;
        }
        return { inv: false };
      }
    };
  };
})(typeof window !== "undefined" ? window : globalThis);
