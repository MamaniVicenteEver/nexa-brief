(function attach(root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.NexaVacioOutro = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createApi() {
  "use strict";
  const SUPPORT = "Tu apoyo hace posible que sigamos trayendo más contenido.";
  const URL = "youtube.com/@nodemotion";
  function render(sc, X, a) {

    const doc = X.root.ownerDocument || document;
    X.root.dataset.kind = "outro";
    const styleId = "nm-vacio-outro-lyrics";
    if (!doc.getElementById(styleId)) {
      const style = doc.createElement("style");
      style.id = styleId;
      style.textContent = '#stage:has(> .scene[data-kind="outro"]) > .scene:not([data-kind="outro"]) .tx { opacity: 0 !important; transition: opacity .3s ease !important; }';
      doc.head.appendChild(style);
    }
    const { W, H } = X, P = a.P, cfg = a.config || {};
    const timing = Math.min(1, Math.max(.18, X.dur / 4));
    const layer = a.div(X.root, "lay", { background: "linear-gradient(180deg,rgba(6,8,10,.06),rgba(6,8,10,.16))" });
    a.footage(X, layer, 0, "mist", { opacity: .86, from: 1.025, to: 1.055 });
    a.fog(X, layer, 2, .08, "190,198,205");
    const rule = a.div(layer, "patch", { left: .39 * W + "px", top: .47 * H + "px", width: .22 * W + "px", height: Math.max(2, H * .0025) + "px", background: "rgba(236,237,238,.76)", transform: "scaleX(0)", transformOrigin: "center" });
    X.T(rule, "transform", "scaleX(0)").to(.24, .56, "scaleX(1)", "cubic-bezier(.16,.84,.24,1)");
    const add = (text, cls, ls, maxH, y, color, at, mode, maxW = .84 * W) => {
      const fs = a.fit(text, cls, ls, maxW, maxH);
      const item = a.word(X, layer, text, { cls, fs, x: W / 2, y: y * H, color, ls });
      item.el.style.whiteSpace = "nowrap";
      a.reveal(X, item.el, at, mode, Math.min(.76, Math.max(.22, X.dur * .16)));
      return item;
    };
    const title = add(cfg.title || "Gracias", "th", .04, .15 * H, .38, P.white || "#ECEDEE", .05, "blur", .88 * W);
    X.T(title.el, "letterSpacing", ".04em").to(0, Math.min(1.6, X.dur), ".16em", "cubic-bezier(.65,0,.3,1)");
    add(cfg.sub || "Por ver", "in", .28, .034 * H, .55, P.fog || "#8F969A", .48 * timing, "fade", .78 * W);
    add(cfg.feats || "Suscribite | NodeMotion", "in", .12, .022 * H, .65, P.white || "#ECEDEE", .82 * timing, "fade", .82 * W);
    add(SUPPORT, "in", .02, .018 * H, .78, "rgba(236,237,238,.88)", 1.15 * timing, "fade", .84 * W);
    const fs = a.fit(URL, "in", .04, .34 * W, .013 * H);
    const url = a.word(X, layer, URL, { cls: "in", fs, x: .96 * W, y: .93 * H, ax: 1, color: "rgba(236,237,238,.72)", ls: .04 });
    url.el.style.whiteSpace = "nowrap";
    a.reveal(X, url.el, 1.55 * timing, "fade", Math.max(.12, .32 * timing));
  }
  return { render };
});
