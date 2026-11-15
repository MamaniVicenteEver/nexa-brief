(function attach(root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.NexaCautionOutro = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createApi() {
  "use strict";
  const SUPPORT = "Tu apoyo hace posible que sigamos trayendo más contenido.";
  const URL = "youtube.com/@nodemotion";

  function render(sc, S, tl, random, palette, config, tools) {
    const { W, H, u } = S;
    const titleText = config.title || "Gracias";
    const subText = config.sub || "Por ver";
    const brandText = config.feats || "Suscribite | NodeMotion";
    const accent = palette.light || "#FFFFFF";
    const dark = palette.dark || "#000000";
    const timing = Math.max(0.25, Math.min(1, sc.dur / 3));

    // La plantilla ya trae su fondo rojo y su grano; el cierre solo suma tipografía.
    const topRule = tools.bar(S.el, 0.08 * W, 0.19 * H, 0.84 * W, Math.max(2, u * 2), "rgba(255,255,255,.34)");
    const bottomRule = tools.bar(S.el, 0.08 * W, 0.86 * H, 0.84 * W, Math.max(2, u * 2), "rgba(255,255,255,.34)");
    const leftMark = tools.bar(S.el, 0.08 * W, 0.19 * H, Math.max(2, u * 2), 0.67 * H, "rgba(0,0,0,.22)");
    const rightMark = tools.bar(S.el, 0.92 * W, 0.19 * H, Math.max(2, u * 2), 0.67 * H, "rgba(0,0,0,.22)");
    [topRule, bottomRule, leftMark, rightMark].forEach(el => { el.style.opacity = "0.72"; });

    const titleSize = tools.fit(titleText, "ext", 0.01, 0.84 * W, 0.17 * H);
    const title = tools.T(S.el, titleText, { cls: "ext", fs: titleSize, x: W / 2, y: 0.38 * H, color: accent, ls: 0.01, split: "chars" });
    tools.typeChars(tl, title.chars, 0.02, 0.34 * timing, random);
    title.el.style.transformOrigin = "center";
    tl.add(title.el, [{ transform: "scale(.94)" }, { transform: "scale(1)" }], 0.02, 0.42 * timing, "cubic-bezier(.2,.8,.2,1)");

    const rule = tools.bar(S.el, 0.39 * W, 0.48 * H, 0.22 * W, Math.max(3, u * 3), "rgba(255,255,255,.92)");
    rule.style.transformOrigin = "center";
    tools.wipeX(tl, rule, 0.28 * timing, 0.42 * timing, "center");

    const subSize = tools.fit(subText, "cond", 0.28, 0.78 * W, 0.036 * H);
    const sub = tools.T(S.el, subText, { cls: "cond", fs: subSize, x: W / 2, y: 0.55 * H, color: accent, ls: 0.28 });
    tools.pop(tl, sub.el, 0.42 * timing, 1.08, 0.24 * timing);

    const brandSize = tools.fit(brandText, "cond2", 0.12, 0.8 * W, 0.024 * H);
    const brand = tools.T(S.el, brandText, { cls: "cond2", fs: brandSize, x: W / 2, y: 0.66 * H, color: accent, ls: 0.12 });
    tools.show(tl, brand.el, 0.78 * timing);

    const supportSize = tools.fit(SUPPORT, "lite", 0.01, 0.8 * W, 0.018 * H);
    const support = tools.T(S.el, SUPPORT, { cls: "lite", fs: supportSize, x: W / 2, y: 0.77 * H, color: "rgba(255,255,255,.9)" });
    tools.show(tl, support.el, 1.02 * timing);

    const urlSize = tools.fit(URL, "cond2", 0, 0.34 * W, 0.013 * H);
    const url = tools.T(S.el, URL, { cls: "cond2", fs: urlSize, x: 0.92 * W, y: 0.9 * H, ax: 1, color: "rgba(255,255,255,.82)" });
    tools.show(tl, url.el, 1.22 * timing);
  }

  return { render };
});
