(function attach(root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.NexaMemoriaOutro = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createApi() {
  "use strict";
  const SUPPORT = "Tu apoyo hace posible que sigamos trayendo más contenido.";
  const URL = "youtube.com/@nodemotion";
  function render(sc, X, a) {

    const doc = X.root.ownerDocument || document;
    X.root.dataset.kind = "outro";
    const styleId = "nm-memoria-outro-lyrics";
    if (!doc.getElementById(styleId)) {
      const style = doc.createElement("style");
      style.id = styleId;
      style.textContent = '#stage:has(> .scene[data-kind="outro"]) > .scene:not([data-kind="outro"]) .tx { opacity: 0 !important; transition: opacity .3s ease !important; }';
      doc.head.appendChild(style);
    }
    const { W, H } = X, P = a.P, cfg = a.config || {};
    const timing = Math.min(1, Math.max(.18, X.dur / 4));
    const layer = a.div(X.root, "lay", { background: "linear-gradient(180deg,rgba(18,12,8,.08),rgba(18,12,8,.2))" });
    a.footage(X, layer, 0, "faded", { opacity: .84, from: 1.02, to: 1.045 });
    const frame = a.div(layer, "patch", { left: .14 * W + "px", top: .15 * H + "px", width: .72 * W + "px", height: .7 * H + "px", border: "1px solid rgba(234,223,200,.48)", background: "rgba(234,223,200,.055)", transform: "rotate(-1deg) scale(.96)" });
    X.T(frame, "transform", "rotate(-1deg) scale(.96)").to(.04, .58, "rotate(0deg) scale(1)", "cubic-bezier(.16,.84,.24,1)");
    const leak = a.div(layer, "lay", { background: "radial-gradient(ellipse 34% 46% at 18% 40%,rgba(232,168,74,.22),transparent 72%)", mixBlendMode: "screen", pointerEvents: "none", transform: "translateX(-12%)" });
    X.T(leak, "transform", "translateX(-12%)").to(.55, 1.45, "translateX(16%)", "cubic-bezier(.65,0,.3,1)");
    X.T(leak, "opacity", "0", true).set(.55, ".8").set(1.45, ".25").set(2, "0");
    const rule = a.div(layer, "patch", { left: .39 * W + "px", top: .47 * H + "px", width: .22 * W + "px", height: Math.max(2, H * .003) + "px", background: P.vhs || "#E8A84A", transform: "scaleX(0)", transformOrigin: "center" });
    X.T(rule, "transform", "scaleX(0)").to(.2, .46, "scaleX(1)", "cubic-bezier(.16,.84,.24,1)");
    const add = (text, cls, ls, maxH, y, color, at, maxW = .84 * W, span = .55) => {
      const fs = a.fit(text, cls, ls, maxW, maxH);
      const item = a.word(X, layer, text, { cls, fs, x: W / 2, y: y * H, color, ls });
      item.el.style.whiteSpace = "nowrap";
      a.reveal(X, item.el, at, "fade", span);
      X.T(item.el, "transform", "translateY(22px) rotate(-1deg)").to(at, span, "translateY(0px) rotate(0deg)", "cubic-bezier(.16,.84,.24,1)");
      return item;
    };
    add(cfg.title || "Gracias", "hw", .01, .15 * H, .38, P.cream || "#EADFC8", .04, .88 * W, .62);
    add(cfg.sub || "Por ver", "tw", .28, .034 * H, .55, P.sepia || "#A88B62", .48 * timing, .78 * W, .42 * timing);
    add(cfg.feats || "Suscribite | NodeMotion", "tw", .12, .022 * H, .65, P.rose || "#B9877A", .82 * timing, .82 * W, .38 * timing);
    add(SUPPORT, "tw", .02, .018 * H, .78, "rgba(245,232,210,.92)", 1.15 * timing, .84 * W, .34 * timing);
    const fs = a.fit(URL, "tw", .04, .34 * W, .013 * H);
    const url = a.word(X, layer, URL, { cls: "tw", fs, x: .96 * W, y: .93 * H, ax: 1, color: "rgba(234,223,200,.82)", ls: .04 });
    url.el.style.whiteSpace = "nowrap";
    a.reveal(X, url.el, 1.55 * timing, "fade", Math.max(.12, .32 * timing));
  }
  return { render };
});
