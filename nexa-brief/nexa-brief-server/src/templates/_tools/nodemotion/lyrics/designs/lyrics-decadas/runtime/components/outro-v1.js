/* lyrics-decadas · Outro v1 «Firma» (cierre de la referencia).
   Fondo oscuro. Una línea pequeña (config.outro.line) se teclea junto a una raya
   fina; la marca (config.outro.brand) se escribe a mano en azul y crece hasta
   ocupar el centro; «title sub» aparece pequeño debajo. */
(function (root) {
  "use strict";
  const DC = root.Decadas, K = DC.core, R = DC.registry;
  R.outros["decadas.outrov1"] = function buildOutroV1(sc, ctx) {
    const O = ctx.C.outro, col = ctx.C.colors, P = DC.parts;
    const D = Math.max(0.6, sc.t1 - sc.t0);
    const rootEl = K.el("div", "dc-scene"); rootEl.style.background = col.dark;
    const line = K.el("div", "dc-outro-line", rootEl);
    K.useFont(line, ctx.fonts.display, ctx.u * 3.8);
    line.style.color = col.white;
    const rule = K.el("div", "dc-outro-rule", rootEl, { background: col.white });
    const lineText = P.up(O.line);
    const brand = K.el("div", "dc-brand", rootEl);
    const bf = ctx.fonts.brand;
    const bsize = K.fit(O.brand || "", bf, ctx.W * 0.7, ctx.H * 0.22);
    K.useFont(brand, bf, bsize);
    brand.style.color = col.blue; brand.textContent = O.brand || "";
    const thanks = K.el("div", "dc-outro-thanks", rootEl);
    K.useFont(thanks, ctx.fonts.display, ctx.u * 6.5);
    thanks.style.color = col.white;
    const thanksText = P.up([O.title, O.sub].filter(Boolean).join(" "));
    return { root: rootEl, update(lt) {
      line.textContent = lineText.slice(0, Math.round(lineText.length * K.prog(lt, 0, D * 0.3)));
      rule.style.width = (K.ease.out(K.prog(lt, 0, D * 0.25)) * ctx.W * 0.22).toFixed(1) + "px";
      const w = K.prog(lt, D * 0.2, D * 0.55);
      brand.style.clipPath = `inset(-30% ${((1 - K.ease.inOut(w)) * 100).toFixed(1)}% -30% -10%)`;
      const grow = K.ease.inOut(K.prog(lt, D * 0.55, D * 0.85));
      brand.style.transform = `translate(-50%,-50%) skewX(-8deg) scale(${(0.45 + 0.55 * grow).toFixed(4)})`;
      line.style.opacity = rule.style.opacity = String(1 - grow);
      thanks.textContent = thanksText.slice(0, Math.round(thanksText.length * K.prog(lt, D * 0.75, D * 0.95)));
    } };
  };
})(typeof window !== "undefined" ? window : globalThis);
