(function attach(root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.NexaCollageOutro = api;
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
    if (!root) throw new Error("createDOMOutro requiere #outro");
    const doc = options.document || root.ownerDocument || document, config = options.config || {};
    const panel = doc.createElement("div"); panel.setAttribute("aria-hidden", "true");
    Object.assign(panel.style, {position:"absolute", left:"50%", top:"50%", width:"min(88vw,1120px)", height:"min(68vh,720px)", transform:"translate(-50%,-50%) rotate(-1deg)", background:"rgba(25,19,14,.34)", border:"1px solid rgba(245,239,221,.58)", boxShadow:"0 22px 64px rgba(0,0,0,.26),inset 0 0 60px rgba(245,239,221,.04)", clipPath:"polygon(1.5% 3%,40% 0,60% 1.5%,98.5% 4%,100% 40%,98% 97%,55% 100%,20% 98.5%,0 62%)"});
    const tape = doc.createElement("div"); Object.assign(tape.style, {position:"absolute",left:"50%",top:"-1.7vh",width:"10vw",height:"3vh",transform:"translateX(-50%) rotate(-2deg)",background:"rgba(184,31,25,.66)",boxShadow:"0 1px 3px rgba(0,0,0,.3)"}); panel.appendChild(tape);
    const make = (tag, text, css) => { const el=doc.createElement(tag); el.textContent=text; Object.assign(el.style,css); root.appendChild(el); return el; };
    const title=make("div",config.title||"Gracias",{fontFamily:'"Anton",sans-serif',fontSize:"calc(15vh + 4px)",lineHeight:".92",letterSpacing:".01em",color:"#F5EFDD",maxWidth:"82vw",textShadow:"0 4px 20px rgba(0,0,0,.42)"});
    const sub=make("div",config.sub||"Por ver",{fontFamily:'"Bebas Neue",sans-serif',fontSize:"calc(2.8vh + 4px)",letterSpacing:".34em",color:"#E85A43"});
    const subscribe=doc.createElement("div"); subscribe.style.cssText='font-family:"Courier Prime",monospace;font-size:2vh;letter-spacing:.13em;color:#F5EFDD'; subscribe.append(doc.createTextNode("Suscribite | ")); const brand=doc.createElement("span"); brand.textContent="NodeMotion"; brand.style.color="#E85A43"; subscribe.appendChild(brand); root.appendChild(subscribe);
    const support=make("div",SUPPORT,{position:"absolute",right:"9vw",bottom:"12vh",left:"9vw",maxWidth:"680px",margin:"0 auto",fontFamily:'"Courier Prime",monospace',fontSize:"calc(1.4vh + 2px)",lineHeight:"1.45",color:"rgba(245,239,221,.82)",textTransform:"none"});
    const url=make("div",URL,{position:"absolute",right:"3vw",bottom:"22px",font:"10px Arial,sans-serif",color:"rgba(245,239,221,.7)",textTransform:"none"});
    root.replaceChildren(panel,title,sub,subscribe,support,url);
    root.classList.add("cardScreen"); root.classList.remove("show");
    Object.assign(root.style,{position:"fixed",inset:"0",zIndex:"8",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"clamp(16px,2.25vh,27px)",padding:"5vh 7vw",textAlign:"center",textTransform:"uppercase",pointerEvents:"none",opacity:"0",overflow:"hidden",background:"transparent",transition:"none"});
    root.setAttribute("role","group"); root.setAttribute("aria-label","Cierre de video NodeMotion");
    function resize(){const portrait=innerHeight>innerWidth; title.style.fontSize=portrait?"calc(min(15vh,21vw) + 4px)":"calc(15vh + 4px)"; sub.style.fontSize=portrait?"calc(min(2.8vh,4vw) + 4px)":"calc(2.8vh + 4px)"; panel.style.height=portrait?"min(58vh,640px)":"min(68vh,720px)";}
    resize(); doc.defaultView&&doc.defaultView.addEventListener("resize",resize);
    let shown=false,maxOpacity=0;
    function update(time,duration,ended){const s=stateAt(time,duration,config,ended),firstShow=s.active&&!shown; if(s.active){shown=true;maxOpacity=Math.max(maxOpacity,s.opacity);} root.style.opacity=maxOpacity.toFixed(3); root.style.pointerEvents=shown?"auto":"none"; root.classList.toggle("show",shown); doc.body.classList.toggle("outroActive",shown); if(firstShow&&typeof options.onShow==="function")options.onShow();
      const rev=(start,span)=>ease(clamp((s.elapsed-start)/span,0,1));
      if(s.active){const p=rev(0,.55),q=rev(.35,.5),b=rev(.9,.46),u=rev(1.5,.55),v=rev(2,.45);
        panel.style.opacity=(.72*p).toFixed(3); panel.style.transform=`translate(-50%,-50%) rotate(${(-1+1.2*p).toFixed(2)}deg) scale(${(.94+.06*p).toFixed(3)})`;
        title.style.opacity=p; title.style.transform=`translateY(${(1-p)*34}px) rotate(-1deg)`; sub.style.opacity=q; sub.style.transform=`translateY(${(1-q)*16}px)`; subscribe.style.opacity=b; subscribe.style.transform=`translateY(${(1-b)*12}px)`; support.style.opacity=.86*u; url.style.opacity=.68*v; }
      return {...s,active:shown,opacity:maxOpacity};}
    return {root,title,sub,subscribe,support,url,update,destroy(){doc.defaultView&&doc.defaultView.removeEventListener("resize",resize);}};
  }
  return {DEFAULT_LEAD_SECONDS,stateAt,createDOMOutro};
});
