(function attach(root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.NexaLluviaOutro = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createApi() {
  "use strict";
  const SUPPORT = "Tu apoyo hace posible que sigamos trayendo más contenido.";
  const URL = "youtube.com/@nodemotion";
  function render(sc, X, a) {

    const doc = X.root.ownerDocument || document;
    X.root.dataset.kind = "outro";
    const styleId = "nm-lluvia-outro-lyrics";
    if (!doc.getElementById(styleId)) {
      const style = doc.createElement("style");
      style.id = styleId;
      style.textContent = '#stage:has(> .scene[data-kind="outro"]) > .scene:not([data-kind="outro"]) .tx { opacity: 0 !important; transition: opacity .3s ease !important; }';
      doc.head.appendChild(style);
    }
    const { W, H } = X, P = a.P, cfg = a.config || {};
    const timing = Math.min(1, Math.max(.18, X.dur / 4));
    const layer = a.div(X.root, "lay", { background: "linear-gradient(180deg,rgba(6,13,18,.10),rgba(6,13,18,.24))" });
    a.footage(X, layer, 0, "rain", { opacity: .84, from: 1.02, to: 1.05 });
    a.rainFx(X, layer, 32, { color: "174,195,210", angle: 7, speed: .72 });
    const rule = a.div(layer, "patch", { left: .39 * W + "px", top: .47 * H + "px", width: .22 * W + "px", height: Math.max(2, H * .003) + "px", background: P.steel || "#8A98A3", transform: "scaleX(0)", transformOrigin: "center" });
    X.T(rule, "transform", "scaleX(0)").to(.16, .5, "scaleX(1)", "cubic-bezier(.16,.84,.24,1)");
    const add = (text, cls, ls, maxH, y, color, at, mode, maxW = .84 * W) => {
      const fs = a.fit(text, cls, ls, maxW, maxH);
      const item = a.word(X, layer, text, { cls, fs, x: W / 2, y: y * H, color, ls });
      item.el.style.whiteSpace = "nowrap";
      a.reveal(X, item.el, at, mode, Math.min(.72, Math.max(.22, X.dur * .16)));
      return item;
    };
    add(cfg.title || "Gracias", "ser it", .01, .15 * H, .38, P.pale || "#DCE2E6", .04, "blur", .88 * W);
    add(cfg.sub || "Por ver", "sn", .28, .034 * H, .55, P.pale || "#DCE2E6", .48 * timing, "drop", .78 * W);
    add(cfg.feats || "Suscribite | NodeMotion", "sn", .12, .022 * H, .65, P.steel || "#8A98A3", .82 * timing, "fade", .82 * W);
    add(SUPPORT, "sn", .02, .018 * H, .78, "rgba(230,238,242,.9)", 1.15 * timing, "fade", .84 * W);
    const fs = a.fit(URL, "sn", .04, .34 * W, .013 * H);
    const url = a.word(X, layer, URL, { cls: "sn", fs, x: .96 * W, y: .93 * H, ax: 1, color: "rgba(220,230,236,.8)", ls: .04 });
    url.el.style.whiteSpace = "nowrap";
    a.reveal(X, url.el, 1.55 * timing, "fade", Math.max(.12, .34 * timing));
  }
  return { render };
});
