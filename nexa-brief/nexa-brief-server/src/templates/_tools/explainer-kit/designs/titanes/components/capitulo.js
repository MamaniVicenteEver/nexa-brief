(function(){
  "use strict";
  const K=window.Kit,T=K.titanes;
  K.register({name:"titanes.capitulo",layer:"main",opaque:true,post:0,tags:["capítulo","número","transición"],summary:"Número monumental en segundo plano, título y protagonista en escenario. Tinta de entrada/salida, cámara lenta y luz de borde del episodio.",example:{numero:"03",titulo:"EL TRONO",kicker:"IBM",contexto:"",figura:T.sample("brazos-arriba"),bg:"ciudad"},params:{...T.params,...T.figureParams,...T.transitionParams,entrada:{...T.transitionParams.entrada,default:"tinta"},numero:{type:"string",default:"03",doc:"Número de capítulo; se conserva el cero inicial."},titulo:{type:"string",default:"EL TRONO",doc:"Título corto, máximo recomendado 4 palabras."},kicker:{type:"string",default:"IBM",doc:"Nombre o contexto superior; vacío lo apaga."},contexto:{type:"string",default:"",doc:"Línea de contexto opcional; mantener máximo 7 palabras totales."}},create(ctx,p){
    ctx.beat.hideCaptions=true;
    const st=ctx.stage,{W,H,portrait}=st,G=ctx.g.main,P=T.palette(ctx,p),BG=T.background(ctx,p,"ciudad"),fig=T.figure(ctx,p);
    const L=T.titleLayout(G,p.titulo,W*(portrait?.74:.54),H*(portrait?.08:.18));
    return{render(t,b){
      BG.render(t,b,t+b.t0);
      G.save();G.globalAlpha=.2;T.number(G,p.numero,W*(portrait?.06:.055),H*(portrait?.58:.77),H*(portrait?.39:.72),P.rim,{font:"Anton"});G.restore();
      fig.draw(G,W*(portrait?.48:.77),H*(portrait?.85:.9),H*(portrait?(p.contexto?.42:.47):.72),t);
      T.scrim(G,st,P);
      const x=W*(portrait?.08:.085),y=H*(portrait?.28:.53);
      T.kicker(G,p.kicker,x,H*(portrait?.132:.245),st.u*(portrait?2.4:1.9),P);
      T.number(G,p.numero,x,H*(portrait?.181:.34),st.u*(portrait?5:5.8),P.rim,{font:"Inter",weight:900});
      T.title(G,L,x,y,t,P,{at:.25,highlight:L.lines.length-1});
      if(p.contexto&&t>1)T.text(G,p.contexto,x,y+(L.lines.length-1)*L.size*1.08+L.size*.7,st.u*(portrait?2.8:2.4),P.ink,{maxWidth:W*.72});
      T.edges(ctx,p,t,b);
    },dispose(){BG.dispose();fig.dispose();}};
  }});
})();
