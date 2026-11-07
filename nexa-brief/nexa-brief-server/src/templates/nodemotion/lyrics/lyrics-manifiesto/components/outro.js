(function attach(root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.NexaManifiestoOutro = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createApi() {
  "use strict";
  const DEFAULT_LEAD_SECONDS = 8;
  const SUPPORT = "Tu apoyo hace posible que sigamos trayendo más contenido.";
  const URL = "youtube.com/@nodemotion";
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const ease = n => 1 - Math.pow(1 - n, 3);
  function stateAt(time, duration, config, ended) {
    const d = Number(duration), t = Math.max(0, Number(time) || 0);
    const lead = Number.isFinite(Number(config && config.leadSec)) ? Math.max(0, Number(config.leadSec)) : DEFAULT_LEAD_SECONDS;
    const active = Number.isFinite(d) && d > 0 && (ended === true || t >= d - lead);
    return {active, opacity: active ? ended ? 1 : clamp((t - (d - lead)) / 1.1, 0, 1) : 0, elapsed: active ? Math.max(0, t - (d - lead)) : 0, lead};
  }
  function createDOMOutro(options) {
    const root = options && options.root;
    if (!root) throw new Error("createDOMOutro requiere el nodo #outro");
    const doc = options.document || root.ownerDocument || document;
    const config = options.config || {};
    const make = (tag, text, css) => { const el = doc.createElement(tag); el.textContent = text; Object.assign(el.style, css); root.appendChild(el); return el; };
    const title = make("div", config.title || "Gracias", {fontFamily:'"Archivo", sans-serif', fontWeight:"900", fontSize:"calc(15vh + 4px)", lineHeight:".92", letterSpacing:"-.015em", color:"#F4F2EE", maxWidth:"88vw", textShadow:"0 5px 24px rgba(0,0,0,.55)", whiteSpace:"pre-line"});
    const rule = make("div", "", {width:"clamp(56px, 8vw, 140px)", height:"2px", background:"#D2222A", transformOrigin:"center"});
    const sub = make("div", config.sub || "Por ver", {fontFamily:'"Space Grotesk", sans-serif', fontWeight:"500", fontSize:"calc(2.8vh + 4px)", letterSpacing:".34em", color:"#F4F2EE"});
    const subscribe = doc.createElement("div");
    subscribe.style.cssText = 'font-family:"Space Grotesk",sans-serif;font-size:2vh;letter-spacing:.13em;color:rgba(244,242,238,.72)';
    subscribe.append(doc.createTextNode("Suscribite | "));
    const brand = doc.createElement("span"); brand.textContent = "NodeMotion"; brand.style.color = "#D2222A"; brand.style.fontWeight = "700"; subscribe.appendChild(brand); root.appendChild(subscribe);
    const support = make("div", SUPPORT, {position:"absolute", right:"9vw", bottom:"12vh", left:"9vw", maxWidth:"680px", margin:"0 auto", color:"rgba(244,242,238,.76)", fontFamily:'"Space Grotesk",sans-serif', fontSize:"calc(1.4vh + 2px)", lineHeight:"1.45", letterSpacing:".02em", textTransform:"none"});
    const url = make("div", URL, {position:"absolute", right:"3vw", bottom:"22px", color:"rgba(244,242,238,.62)", font:"10px Arial,sans-serif", letterSpacing:".01em", textTransform:"none"});
    root.replaceChildren(title, rule, sub, subscribe, support, url);
    root.classList.add("cardScreen"); root.classList.remove("show");
    Object.assign(root.style, {position:"fixed", inset:"0", zIndex:"8", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:"clamp(18px,2.6vh,30px)", padding:"5vh 7vw", textAlign:"center", textTransform:"uppercase", pointerEvents:"none", opacity:"0", overflow:"hidden", background:"transparent", transition:"none"});
    root.setAttribute("role", "group"); root.setAttribute("aria-label", "Cierre de video NodeMotion");
    const nodes = [title, rule, sub, subscribe, support, url];
    function resize() {
      const portrait = innerHeight > innerWidth;
      title.style.fontSize = portrait ? "calc(min(15vh,21vw) + 4px)" : "calc(15vh + 4px)";
      sub.style.fontSize = portrait ? "calc(min(2.8vh,4vw) + 4px)" : "calc(2.8vh + 4px)";
      support.style.fontSize = "calc(1.4vh + 2px)";
    }
    resize(); doc.defaultView && doc.defaultView.addEventListener("resize", resize);
    let shown = false, maxOpacity = 0;
    function update(time, duration, ended) {
      const s = stateAt(time, duration, config, ended), firstShow = s.active && !shown;
      if (s.active) { shown = true; maxOpacity = Math.max(maxOpacity, s.opacity); }
      root.style.opacity = maxOpacity.toFixed(3);
      root.style.pointerEvents = shown ? "auto" : "none";
      root.classList.toggle("show", shown);
      doc.body.classList.toggle("outroActive", shown);
      if (firstShow) { doc.body.classList.remove("contraActive"); if (typeof options.onShow === "function") options.onShow(); }
      const reveal = (start, span) => ease(clamp((s.elapsed - start) / span, 0, 1));
      const titleP = reveal(0, .6), ruleP = reveal(.26, .46), subP = reveal(.42, .52), brandP = reveal(.95, .45), supportP = reveal(1.45, .55), urlP = reveal(1.95, .48);
      if (s.active) {
        title.style.transform = `translateY(${(1-titleP)*24}px)`; title.style.opacity = titleP;
        rule.style.transform = `scaleX(${ruleP})`; rule.style.opacity = ruleP;
        sub.style.transform = `translateY(${(1-subP)*18}px)`; sub.style.opacity = subP;
        subscribe.style.transform = `translateY(${(1-brandP)*12}px)`; subscribe.style.opacity = brandP;
        support.style.transform = `translateY(${(1-supportP)*12}px)`; support.style.opacity = .86*supportP;
        url.style.opacity = .68*urlP;
      }
      return {...s, active: shown, opacity: maxOpacity};
    }
    return {root, title, sub, subscribe, support, url, update, destroy() { doc.defaultView && doc.defaultView.removeEventListener("resize", resize); }};
  }
  return {DEFAULT_LEAD_SECONDS, stateAt, createDOMOutro};
});
