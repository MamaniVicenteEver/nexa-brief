(function () {
  "use strict";
  const K=window.Kit,T=K.titanes,{prog,clamp}=K;
  const typeParams={
    text:{type:"string",default:"EL PRECIO\nDEL PODER",doc:"Titular de 2–4 palabras. Admite salto de línea; máximo recomendado 7 palabras sumando kicker y contexto."},
    kicker:{type:"string",default:"IBM",doc:"Rótulo pequeño espaciado; vacío lo apaga."},
    contexto:{type:"string",default:"",doc:"Línea breve de contexto, opcional."},
  };
  function create(ctx,p,variant){
    ctx.beat.hideCaptions=true;
    const st=ctx.stage,{W,H,portrait}=st,P=T.palette(ctx,p),G=ctx.g.main,BG=T.background(ctx,p,variant===2?"horizonte":"foco"),fig=T.figure(ctx,p);
    const x=W*(portrait?.08:.085),width=W*(portrait?.75:.55),max=H*(portrait?.076:.205);
    const L=T.titleLayout(G,p.text,width,max),Q=variant===2?T.titleLayout(G,p.pregunta,width,max):null;
    let photo=null;const im=ctx.img(p.src);
    if(variant===2&&im&&["auto","foco","horizonte","ciudad","sala","rayos","mercado","archivo"].includes(p.bg))photo=T.tone(im,P.accent,false);
    function content(lt,b){
      const reveal=variant===2?p.revelarEn:0,switched=variant!==2||lt>=reveal;
      const Lnow=switched?L:Q,local=switched?lt-reveal:lt;
      BG.render(lt,b,lt+b.t0);
      if(!photo&&variant===2&&ctx.img(p.src)&&!["image","component","none"].includes(p.bg))photo=T.tone(ctx.img(p.src),P.accent,false);
      const fx=W*(portrait?.47:.76),bottom=H*(portrait?.835:.89),height=H*(portrait?.46:.76);
      if(photo){
        const px=W*(portrait?.13:.60),py=H*(portrait?.40:.12),pw=W*(portrait?.68:.34),ph=H*(portrait?.39:.76),q=prog(lt,reveal,.8);
        T.glow(G,px+pw/2,py+ph/2,pw,ph*.8,P.accent,.6);
        G.save();G.beginPath();G.rect(px,py+ph*(1-q),pw,ph*q);G.clip();K.hook.cover(G,photo,px,py,pw,ph,p.focus,1.03+clamp(lt/b.dur)*.05);G.restore();
        G.strokeStyle=T.color(P.rim,.6);G.lineWidth=st.u*.12;G.strokeRect(px,py,pw,ph);
      }else fig.draw(G,fx,bottom,height,lt,variant===2?.28+.72*prog(lt,reveal,.8):1);
      T.scrim(G,st,P);
      const ky=H*(portrait?.135:.245),ty=H*(portrait?.233:.465);
      T.kicker(G,p.kicker,x,ky,st.u*(portrait?2.4:1.9),P);
      T.title(G,Lnow,x,ty,local,P,{at:variant===1?.06:0,highlight:Lnow.lines.length-1});
      const cy=Math.min(H*(portrait?.365:.77),ty+(Lnow.lines.length-1)*Lnow.size*1.08+Lnow.size*.66);
      if(p.contexto&&switched&&local>.75)T.text(G,p.contexto,x,cy,st.u*(portrait?2.8:2.4),P.ink,{maxWidth:width});
      // Filete editorial: termina antes del cuerpo del protagonista.
      G.fillStyle=T.color(P.rim,.7);G.fillRect(x,ky-st.u*5,st.u*7*prog(lt,.1,1.3),st.u*.20);
      if(variant===2&&Math.abs(lt-reveal)<.27){const q=1-Math.abs(lt-reveal)/.27;T.transition(G,st,"luz",q,P,p.semilla);}
    }
    return {render(lt,b){
      G.save();const impact=variant===1?Math.sin(lt*68)*8*(1-prog(lt,.14,.35))*prog(lt,.1,.05):0;G.translate(impact,impact*.4);content(lt,b);G.restore();T.edges(ctx,p,lt,b);
    },dispose(){BG.dispose();fig.dispose();if(photo)photo.width=photo.height=1;}};
  }
  K.register({name:"titanes.introv1",layer:"main",opaque:true,post:0,tags:["intro","golpe","silueta","miniatura"],summary:"Título monumental de 2–4 palabras, kicker y protagonista ilustrado a contraluz. Golpe breve, revelado desde abajo y deriva pesada.",example:{text:"EL PRECIO\nDEL PODER",kicker:"IBM",figura:T.sample("de-pie"),bg:"foco"},params:{...T.params,...T.figureParams,...typeParams,...T.transitionParams},create(ctx,p){return create(ctx,p,1);}});
  K.register({name:"titanes.introv2",layer:"main",opaque:true,post:0,tags:["intro","pregunta","revelación","foto"],summary:"Pregunta que abre el conflicto y revelación por barrido de luz. Foto duotono (src) o figura iluminada; compatible con todos los fondos del contrato hook.",example:{pregunta:"¿QUIÉN\nMANDA?",text:"EL PODER\nCAMBIA",kicker:"IBM",figura:T.sample("encoge"),bg:"horizonte",revelarEn:1.8},params:{...T.params,...T.figureParams,...typeParams,...T.transitionParams,entrada:{...T.transitionParams.entrada,default:"luz"},pregunta:{type:"string",default:"¿QUIÉN\nMANDA?",doc:"Pregunta inicial. Máximo recomendado 4 palabras."},revelarEn:{type:"number",default:1.8,min:.6,max:12,doc:"Segundo local en que la pregunta da paso al titular y la figura/foto se revela."}},create(ctx,p){return create(ctx,p,2);}});
})();
