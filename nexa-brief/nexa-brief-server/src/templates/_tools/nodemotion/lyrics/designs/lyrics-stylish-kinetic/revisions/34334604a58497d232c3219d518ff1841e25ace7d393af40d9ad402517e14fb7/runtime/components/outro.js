(function attach(root,factory){
  "use strict";const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.NexaStylishOutro=api;
})(typeof globalThis!=="undefined"?globalThis:this,function createApi(){
  "use strict";const BRAND="Suscribite | NodeMotion",SUPPORT="Tu apoyo hace posible que sigamos trayendo más contenido.",URL="youtube.com/@nodemotion";
  function render(sc,X,a){
    const {W,H,G,pal,pal2}=X, C=a.config, title=a.capsText(value(C,"title","Gracias"));
    X.exitT=X.dur+1.5;
    const compact=X.dur<2.2, subAt=compact?.14:.38, brandAt=compact?.36:.72, supportAt=compact?.58:1.12, urlAt=compact?.84:1.72;
    const fs=a.fit(title,"caps",a.sw(X,.86),.15*H), d=a.dims(title,"caps",fs);
    const head=a.mkLine(X,G,title,"caps",fs,pal.accent,-d.w/2,-.205*H);
    head.el.style.opacity="0";
    X.T(head.el,"opacity","0").to(.02,.2,"1");
    a.slideIn(X,head.el,.02,-.62*W,.48);
    const rule=a.div(X.root,"patch",{position:"absolute",pointerEvents:"none",left:(.36*W)+"px",top:(.455*H)+"px",width:(.28*W)+"px",height:Math.max(2,H*.003)+"px",background:pal2.accent||pal.accent,transform:"scaleX(0)",transformOrigin:"center"});
    X.T(rule,"transform","scaleX(0)").to(.28,.48,"scaleX(1)",a.EASE_OUT);
    const sub=a.capsText(value(C,"sub","Por ver")), subFs=a.fit(sub,"caps",a.sw(X,.74),.029*H), sd=a.dims(sub,"caps",subFs);
    const sl=a.mkLine(X,G,sub,"caps",subFs,pal.ink,-sd.w/2,-.015*H);
    a.slideIn(X,sl.el,subAt,.56*W,.34);
    const parts=["SUSCRIBITE |","NODEMOTION"], p1=a.dims(parts[0],"caps",.021*H),p2=a.dims(parts[1],"caps",.021*H),gap=.4*.021*H;
    const left=-(p1.w+p2.w+gap)/2;
    const pre=a.mkLine(X,G,parts[0],"caps",.021*H,pal.ink,left,.105*H);
    const brand=a.mkLine(X,G,parts[1],"caps",.021*H,pal2.accent||pal.accent,left+p1.w+gap,.105*H);
    a.slideIn(X,pre.el,brandAt,-.3*W,.3);a.slideIn(X,brand.el,brandAt,.3*W,.3);
    const support="Tu apoyo hace posible que sigamos trayendo más contenido.";
    const lowFs=a.fit(support,"low",a.sw(X,.86),.018*H), ld=a.dims(support,"low",lowFs);
    const note=a.mkLine(X,G,support,"low",lowFs,pal.ink,-ld.w/2,.292*H);
    a.slideIn(X,note.el,supportAt,.24*W,.34);
    const url=URL, uf=a.fit(url,"low",a.sw(X,.35),10), ud=a.dims(url,"low",uf);
    const link=a.mkLine(X,G,url,"low",uf,pal.ink,.47*W-ud.w,.45*H);
    a.slideIn(X,link.el,urlAt,.16*W,.26);
  }
  function value(c,k,f){const v=c&&c[k];return v==null||v===""?f:String(v);}
  return {render};
});
