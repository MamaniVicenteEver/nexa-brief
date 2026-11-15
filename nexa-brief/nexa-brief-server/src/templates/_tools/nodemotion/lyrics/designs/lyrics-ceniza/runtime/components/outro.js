(function attach(root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.NexaCenizaOutro = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createApi() {
  "use strict";
  const SUPPORT = "Tu apoyo hace posible que sigamos trayendo más contenido.";
  const URL = "youtube.com/@nodemotion";
  function render(sc, X, a) {

    const doc = X.root.ownerDocument || document;
    X.root.dataset.kind = "outro";
    const styleId = "nm-ceniza-outro-lyrics";
    if (!doc.getElementById(styleId)) {
      const style = doc.createElement("style");
      style.id = styleId;
      style.textContent = '#stage:has(> .scene[data-kind="outro"]) > .scene:not([data-kind="outro"]) .tx { opacity: 0 !important; transition: opacity .3s ease !important; }';
      doc.head.appendChild(style);
    }
    const { W, H } = X, P = a.P, cfg = a.config || {};
    const timing = Math.min(1, Math.max(.18, X.dur / 4));
    const layer = a.div(X.root, "lay", { background: "linear-gradient(180deg,rgba(10,7,5,.08),rgba(10,7,5,.18))" });
    a.footage(X, layer, 0, "ash", { opacity: .84, from: 1.04, to: 1.08 });
    a.ashLayer(X, layer);
    const rule = a.div(layer, "patch", { left: .39 * W + "px", top: .47 * H + "px", width: .22 * W + "px", height: Math.max(2, H * .003) + "px", background: P.ember || "#D9602F", transform: "scaleX(0)", transformOrigin: "center", boxShadow: "0 0 12px rgba(255,120,45,.42)" });
    X.T(rule, "transform", "scaleX(0)").to(.18, .5, "scaleX(1)", "cubic-bezier(.16,.84,.24,1)");
    const add = (text, cls, ls, maxH, y, color, at, mode = "fade", maxW = .84 * W) => {
      const fs = a.fit(text, cls, ls, maxW, maxH);
      const item = a.word(X, layer, text, { cls, fs, x: W / 2, y: y * H, color, ls });
      item.el.style.whiteSpace = "nowrap";
      a.reveal(X, item.el, at, mode, Math.min(.72, Math.max(.2, X.dur * .16)));
      return item;
    };
    const title = add(cfg.title || "Gracias", "pf", .01, .15 * H, .38, P.bone || "#E6E1DA", .03, "ember", .88 * W);
    title.el.style.textShadow = "0 0 18px rgba(224,122,72,.25)";
    add(cfg.sub || "Por ver", "mn", .28, .034 * H, .55, P.emberText || "#E07A48", .48 * timing, "fade", .78 * W);
    add(cfg.feats || "Suscribite | NodeMotion", "mn", .12, .022 * H, .65, P.bone || "#E6E1DA", .82 * timing, "fade", .82 * W);
    add(SUPPORT, "mn", .02, .018 * H, .78, "rgba(230,225,218,.9)", 1.15 * timing, "fade", .84 * W);
    const fs = a.fit(URL, "mn", .04, .34 * W, .013 * H);
    const url = a.word(X, layer, URL, { cls: "mn", fs, x: .96 * W, y: .93 * H, ax: 1, color: "rgba(230,225,218,.78)", ls: .04 });
    url.el.style.whiteSpace = "nowrap";
    a.reveal(X, url.el, 1.55 * timing, "fade", Math.max(.12, .32 * timing));
  }
  return { render };
});
