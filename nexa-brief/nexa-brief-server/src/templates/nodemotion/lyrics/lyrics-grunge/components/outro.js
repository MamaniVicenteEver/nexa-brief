(function attach(root,factory){
  "use strict";const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.NexaGrungeOutro=api;
})(typeof globalThis!=="undefined"?globalThis:this,function createApi(){
  "use strict";
  const BRAND="Suscribite | NodeMotion", SUPPORT="Tu apoyo hace posible que sigamos trayendo más contenido.", URL="youtube.com/@nodemotion";
  function render(sc,X,a){
    const {W,H}=X,L=a.bgLayer(X),P=a.P;
    const add=(text,o,at)=>{
      const t=a.word(X,L,text,o); if(at>0)a.show(X,t.box,at);
      return t;
    };
    const titleText=value(a.config,"title","Gracias").toUpperCase();
    const f=a.fit(titleText,"cd",.01,.84*W,.15*H);
    const title=add(titleText,{cls:"cd",fs:f,x:W/2,y:.39*H,color:P.red,distress:true},.04);
    a.slamIn(X,title,.04,1.48);
    const titleBox={x:W*.14,y:H*.30,w:W*.72,h:H*.18};
    a.doodle(X,L,"crown",titleBox,.32,.48);
    a.doodle(X,L,"underline",titleBox,.52,.42);
    const sub=add(value(a.config,"sub","Por ver"),{cls:"cd",fs:.029*H,x:W/2,y:.55*H,color:P.white,ls:.31,distress:false},.38);
    X.T(sub.el,"transform","translateY(24px)").to(.38,.35,"translateY(0px)",a.EASE_OUT);
    const cta=add(BRAND,{cls:"th",fs:.022*H,x:W/2,y:.65*H,color:P.white,ls:.18,distress:false},.78);
    const centerText=(txt,cls,fs,color,y,at,ls=0)=>{
      const s=String(txt), size=a.fit(s,cls,ls,.84*W,fs);
      const t=a.word(X,L,s,{cls,fs:size,x:W/2,y,color,ls,distress:false});
      a.show(X,t.box,at); X.T(t.el,"transform","translateY(18px)").to(at,.4,"translateY(0px)",a.EASE_OUT); return t;
    };
    centerText(SUPPORT,"th",.016*H,"rgba(245,245,242,.86)",.79*H,1.12,.01);
    const u=String(URL), uf=a.fit(u,"th",0,.36*W,.011*H), ut=a.word(X,L,u,{cls:"th",fs:uf,x:W*.97,y:.90*H,ax:1,ay:.5,color:"rgba(245,245,242,.72)",distress:false});
    a.show(X,ut.box,1.62);
  }
  function value(c,k,f){const v=c&&c[k];return v==null||v===""?f:String(v);}
  return {render};
});
