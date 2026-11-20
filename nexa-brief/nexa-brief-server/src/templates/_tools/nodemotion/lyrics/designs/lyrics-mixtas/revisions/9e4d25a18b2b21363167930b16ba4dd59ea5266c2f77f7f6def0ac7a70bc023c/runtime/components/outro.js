(function attach(root, factory) {
  "use strict";
  const api=factory(); if(typeof module==="object"&&module.exports) module.exports=api;
  if(root) root.NexaMixtasOutro=api;
})(typeof globalThis!=="undefined"?globalThis:this,function createApi(){
  "use strict";
  const BRAND="Suscribite | NodeMotion", SUPPORT="Tu apoyo hace posible que sigamos trayendo más contenido.", URL="youtube.com/@nodemotion";
  function render(sc,X,a){
    sc.slot.bg="media";
    const {W,H}=X, L=a.bgLayer(X), P=a.P;
    const add=(text,cls,fs,color,y,at,ls=0)=>{
      const clean=String(text), size=a.fit(clean,cls,ls,W*.86,fs);
      const t=a.tx(L,clean,{cls,fs:size,x:W/2,y,ax:.5,ay:.5,color,ls});
      if(at>0)a.show(X,t.box,at);
      t.el.style.opacity="0";
      X.T(t.el,"opacity","0").to(at,.28,"1");
      X.T(t.el,"transform","translateY(34px)").to(at,.46,"translateY(0px)",a.EASE_OUT);
      return t;
    };
    const title=add(a.U(value(a.config,"title","Gracias")),"cd",.15*H,P.lime,.385*H,.04,.01);
    const rule=a.div(L,"patch",{left:W*.39+"px",top:.49*H+"px",width:W*.22+"px",height:Math.max(2,H*.003)+"px",background:P.orange,transform:"scaleX(0)",transformOrigin:"center"});
    X.T(rule,"transform","scaleX(0)").to(.22,.48,"scaleX(1)",a.EASE_OUT);
    add(a.U(value(a.config,"sub","Por ver")),"lt",.029*H,P.white,.55*H,.34,.3);
    const cta=add(BRAND,"sp",.021*H,P.orange,.65*H,.72,.1);
    cta.el.style.letterSpacing=".12em";
    add(SUPPORT,"lt",.016*H,"rgba(255,255,255,.84)",.79*H,1.15,.005);
    const urlText=URL, urlFs=a.fit(urlText,"lt",0,.34*W,Math.max(10,.011*H));
    const url=a.tx(L,urlText,{cls:"lt",fs:urlFs,x:W*.97,y:.94*H,ax:1,ay:.5,color:"rgba(255,255,255,.78)"});
    a.show(X,url.box,1.05); url.el.style.opacity="0";
    X.T(url.el,"opacity","0").to(1.05,.28,"1");
    X.T(url.el,"transform","translateY(12px)").to(1.05,.32,"translateY(0px)",a.EASE_OUT);
    X.T(title.el,"filter","drop-shadow(0 0 0px rgba(190,255,10,0))").to(.1,.5,"drop-shadow(0 0 22px rgba(190,255,10,.38))");
  }
  function value(c,k,f){const v=c&&c[k];return v==null||v===""?f:String(v);}
  return {render};
});
