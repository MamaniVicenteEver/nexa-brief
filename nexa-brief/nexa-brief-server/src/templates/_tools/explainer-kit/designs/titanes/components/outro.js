(function(){
  "use strict";
  const K=window.Kit,T=K.titanes,{prog}=K;
  function bell(g,x,y,s,t,P){
    g.save();g.translate(x,y);g.rotate(Math.sin(t*23)*.12*(1-prog(t,0,.8)));g.strokeStyle=P.ink;g.fillStyle=P.ink;g.lineWidth=s*.1;g.lineJoin="round";
    g.beginPath();g.moveTo(-s*.45,s*.3);g.lineTo(-s*.32,s*.12);g.lineTo(-s*.32,-s*.12);g.bezierCurveTo(-s*.32,-s*.57,s*.32,-s*.57,s*.32,-s*.12);g.lineTo(s*.32,s*.12);g.lineTo(s*.45,s*.3);g.closePath();g.stroke();g.beginPath();g.arc(0,s*.47,s*.09,0,Math.PI);g.stroke();g.restore();
  }
  K.register({name:"titanes.outro",layer:"main",opaque:true,post:0,tags:["cierre","canal","suscripción"],summary:"Cierre común: gracias, canal, LIKE, flecha, suscripción, campana, apoyo y dirección. Los tiempos se comprimen con hook.outroTimes y el texto se mantiene en zona segura.",example:{thanks:"GRACIAS POR VER",channel:"TITANES",cta:"SUSCRÍBETE",support:"Comparte estas historias.",handle:"",bg:"rayos"},params:{...T.params,...K.hook.outroParams({channel:"TITANES",support:"Comparte estas historias.",handle:""}),like:{type:"string",default:"LIKE",doc:"Etiqueta de la acción de aprobación."},salida:{type:"enum",options:["tinta","luz","golpe","ninguna"],default:"golpe",doc:"Cierre final; corte por defecto."}},create(ctx,p){
    ctx.beat.hideCaptions=true;
    const st=ctx.stage,{W,H,portrait}=st,G=ctx.g.main,P=T.palette(ctx,p),BG=T.background(ctx,p,"rayos"),cx=W*(portrait?.46:.5),L=T.titleLayout(G,p.channel,W*(portrait?.76:.69),H*(portrait?.104:.24),1);
    return{render(t,b){
      const times=K.hook.outroTimes(p,b.dur),{likeAt,subAt,bellAt,supAt}=times;
      BG.render(t,b,t+b.t0);G.fillStyle=T.color(P.black,.34);G.fillRect(0,0,W,H);
      // Cada fase deja espacio a la siguiente, para no acumular rótulos.
      if(t<likeAt+.2)T.kicker(G,p.thanks,cx,H*(portrait?.22:.19),st.u*(portrait?2.8:1.9),P,"center");
      T.title(G,L,cx,H*(portrait?.35:.43),t,P,{at:.12,align:"center"});
      const ay=H*(portrait?.51:.61),lx=cx-W*(portrait?.23:.19),sx=cx+W*(portrait?.06:.08),bw=W*(portrait?.43:.23),bh=H*(portrait?.055:.095);
      if(t>=likeAt){const q=prog(t,likeAt,.4);G.save();G.globalAlpha=q;T.text(G,p.like,lx,ay+st.u,st.u*(portrait?3.5:2.5),P.ink,{weight:900,align:"center"});G.restore();}
      if(p.arrow&&t>likeAt+.25){const q=prog(t,likeAt+.25,Math.max(.25,subAt-likeAt-.25)),ax=lx+W*.055,bx=sx-bw/2-W*.02,y=ay;G.strokeStyle=P.rim;G.lineWidth=st.u*.2;G.beginPath();G.moveTo(ax,y);G.lineTo(ax+(bx-ax)*q,y);if(q>.98){G.lineTo(bx-st.u,y-st.u*.65);G.moveTo(bx,y);G.lineTo(bx-st.u,y+st.u*.65);}G.stroke();}
      if(t>=subAt){const q=prog(t,subAt,.5);G.save();G.beginPath();G.rect(sx-bw/2,ay-bh/2,bw*q,bh);G.clip();G.fillStyle=P.accent;G.fillRect(sx-bw/2,ay-bh/2,bw,bh);T.text(G,p.cta,sx,ay+bh*.16,Math.min(bh*.45,bw*.095),P.accentInk,{weight:900,align:"center",maxWidth:bw*.85});G.restore();}
      if(t>=bellAt)bell(G,cx+W*(portrait?.35:.26),ay,st.u*(portrait?4:3.6),t-bellAt,P);
      if(t>=supAt){const q=prog(t,supAt,.5),y=H*(portrait?.64:.77);G.save();G.beginPath();G.rect(W*.07,y-st.u*5,W*.80,st.u*14*q);G.clip();T.text(G,p.support,cx,y,st.u*(portrait?3.7:2.3),P.ink,{align:"center",maxWidth:W*(portrait?.73:.72)});if(p.handle)T.text(G,p.handle,cx,y+st.u*5.2,st.u*(portrait?3:1.9),P.rim,{align:"center",maxWidth:W*.72});G.restore();}
      T.transition(G,st,p.salida,prog(t,b.dur-.22,.22,"in"),P,p.semilla);
    },dispose(){BG.dispose();}};
  }});
})();
