(function attach(root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.NexaNightJourneyOutro = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createApi() {
  "use strict";
  const SUPPORT = "Tu apoyo hace posible que sigamos trayendo más contenido.";
  const URL = "youtube.com/@nodemotion";
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const ease = n => 1 - Math.pow(1 - n, 3);

  function mount(options) {
    const root = options && options.root;
    if (!root) throw new Error("mount requiere el elemento #outro");
    const doc = root.ownerDocument || document;
    const config = options.config || {};
    const panel = doc.createElement("div");
    Object.assign(panel.style, {
      position: "absolute", left: "50%", top: "50%", width: "min(88vw,1120px)",
      height: innerHeight > innerWidth ? "min(58vh,640px)" : "min(68vh,720px)",
      transform: "translate(-50%,-50%) rotate(-1deg) scale(.94)",
      border: "1px solid rgba(255,205,145,.42)",
      background: "rgba(8,5,4,.24)",
      clipPath: "polygon(2% 0,98% 1.5%,100% 98%,0 100%)",
      boxShadow: "inset 0 0 55px rgba(255,174,90,.05)"
    });
    const make = (tag, text, css) => {
      const el = doc.createElement(tag);
      el.textContent = text;
      Object.assign(el.style, css);
      return el;
    };
    const title = make("div", config.title || "Gracias", {
      position: "relative", zIndex: "1", maxWidth: "88vw", whiteSpace: "nowrap",
      fontFamily: "var(--display)", fontWeight: "700", fontStretch: "extra-condensed",
      fontSize: "calc(15vh + 4px)", lineHeight: ".88", textTransform: "uppercase",
      letterSpacing: ".01em", color: "#3A1B0D", WebkitTextStroke: ".75px rgba(255,239,218,.82)",
      textShadow: "0 4px 20px rgba(0,0,0,.55), 0 0 28px rgba(255,164,82,.24)"
    });
    const rule = doc.createElement("div");
    Object.assign(rule.style, {
      position: "relative", zIndex: "1", width: "0", height: "2px",
      background: "#E58A4D", boxShadow: "0 0 12px rgba(255,164,82,.48)"
    });
    const sub = make("div", config.sub || "Por ver", {
      position: "relative", zIndex: "1", fontFamily: "var(--ui)", fontWeight: "600",
      fontSize: "calc(2.8vh + 4px)", letterSpacing: ".34em", textTransform: "uppercase",
      color: "#3A1B0D", WebkitTextStroke: ".25px rgba(255,239,218,.72)"
    });
    const brand = doc.createElement("div");
    Object.assign(brand.style, {
      position: "relative", zIndex: "1", fontFamily: "var(--ui)", fontSize: "2vh",
      letterSpacing: ".13em", textTransform: "uppercase", color: "#3A1B0D", WebkitTextStroke: ".2px rgba(255,239,218,.65)"
    });
    const brandCopy = String(config.feats || "Suscribite | NodeMotion").split("|");
    brand.append(doc.createTextNode((brandCopy[0] || "Suscribite").trim() + " | "));
    const brandName = doc.createElement("span");
    brandName.textContent = (brandCopy[1] || "NodeMotion").trim();
    brandName.style.color = "#7B351A"; brandName.style.webkitTextStroke = ".2px rgba(255,239,218,.65)";
    brand.appendChild(brandName);
    const support = make("div", SUPPORT, {
      position: "absolute", zIndex: "1", right: "9vw", bottom: "12vh", left: "9vw",
      maxWidth: "680px", margin: "0 auto", fontFamily: "var(--humanist)",
      fontSize: "calc(1.4vh + 2px)", lineHeight: "1.45", letterSpacing: ".02em",
      color: "rgba(255,239,218,.88)"
    });
    const url = make("div", URL, {
      position: "absolute", zIndex: "1", right: "3vw", bottom: "22px",
      font: "10px Arial,sans-serif", letterSpacing: ".01em", color: "#3A1B0D", textShadow: "0 1px 3px rgba(255,239,218,.8)"
    });
    root.replaceChildren(panel, title, rule, sub, brand, support, url);
    Object.assign(root.style, {
      position: "fixed", inset: "0", zIndex: "8", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: "clamp(16px,2.25vh,27px)",
      padding: "5vh 7vw", textAlign: "center", textTransform: "uppercase",
      pointerEvents: "none", overflow: "hidden", background: "transparent", transition: "none", opacity: "0"
    });
    root.setAttribute("role", "group");
    root.setAttribute("aria-label", "Cierre de video NodeMotion");

    function resize() {
      panel.style.height = innerHeight > innerWidth ? "min(58vh,640px)" : "min(68vh,720px)";
      title.style.fontSize = innerHeight > innerWidth ? "calc(min(15vh,21vw) + 4px)" : "calc(15vh + 4px)";
      sub.style.fontSize = innerHeight > innerWidth ? "calc(min(2.8vh,4vw) + 4px)" : "calc(2.8vh + 4px)";
    }
    resize();
    doc.defaultView && doc.defaultView.addEventListener("resize", resize);

    function enter(el, elapsed, start, span, y, extra = "") {
      const p = ease(clamp((elapsed - start) / Math.max(.12, span), 0, 1));
      el.style.opacity = p.toFixed(3);
      el.style.transform = `translateY(${((1 - p) * y).toFixed(1)}px) ${extra}`.trim();
      return p;
    }
    function update(time, duration, ended) {
      const d = Number(duration), t = Number(time);
      const lead = Number.isFinite(Number(config.leadSec)) ? Math.max(0, Number(config.leadSec)) : 8;
      const active = ended === true || (Number.isFinite(d) && d > 0 && Number.isFinite(t) && t >= d - lead);
      const start = Number.isFinite(d) ? Math.max(0, d - lead) : 0;
      const elapsed = active ? Math.max(0, (Number.isFinite(t) ? t : d) - start) : 0;
      const unit = Math.min(1, Math.max(.25, d / 4));
      root.style.opacity = active ? "1" : "0";
      root.style.pointerEvents = active ? "auto" : "none";
      root.classList.toggle("show", active);
      doc.body.classList.toggle("outroActive", active);
      const p = enter(panel, elapsed, 0, .55 * unit, 20, `rotate(${(-1 + ease(clamp(elapsed / (.7 * unit), 0, 1))).toFixed(2)}deg) scale(${(.94 + .06 * ease(clamp(elapsed / (.55 * unit), 0, 1))).toFixed(3)})`);
      const titleP = enter(title, elapsed, .02 * unit, .55 * unit, 34, `scale(${(.96 + .04 * p).toFixed(3)})`);
      const ruleP = ease(clamp((elapsed - .25 * unit) / (.5 * unit), 0, 1));
      rule.style.width = `${(22 * ruleP).toFixed(2)}vw`;
      sub.style.opacity = ease(clamp((elapsed - .38 * unit) / (.46 * unit), 0, 1)).toFixed(3);
      sub.style.transform = `translateY(${((1 - ease(clamp((elapsed - .38 * unit) / (.46 * unit), 0, 1))) * 16).toFixed(1)}px)`;
      brand.style.opacity = ease(clamp((elapsed - .72 * unit) / (.45 * unit), 0, 1)).toFixed(3);
      brand.style.transform = `translateY(${((1 - ease(clamp((elapsed - .72 * unit) / (.45 * unit), 0, 1))) * 12).toFixed(1)}px)`;
      support.style.opacity = (.88 * ease(clamp((elapsed - 1.12 * unit) / (.5 * unit), 0, 1))).toFixed(3);
      url.style.opacity = (.74 * ease(clamp((elapsed - 1.72 * unit) / (.48 * unit), 0, 1))).toFixed(3);
      return active;
    }
    return { root, update, destroy() { doc.defaultView && doc.defaultView.removeEventListener("resize", resize); } };
  }

  return { mount };
});
