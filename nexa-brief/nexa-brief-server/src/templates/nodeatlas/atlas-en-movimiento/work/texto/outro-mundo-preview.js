// Vista de comparación inspirada en atlas.outro; no modifica el motor de vídeo.
export async function prepareOutros(observer){
 const img=new Image(); img.src=new URL('./mapa-mundo-preview.jpg',import.meta.url).href; await img.decode();
 const clamp=x=>Math.max(0,Math.min(1,x)), show=(t,start,d=.35)=>clamp((t-start)/d);
 return [...document.querySelectorAll('.outro-option')].map((article,index)=>{
  const canvas=article.querySelector('canvas'),g=canvas.getContext('2d'); observer.observe(article);
  function text(s,x,y,size,color='#fff',weight=700,thicken=0){g.font=`${weight} ${size}px Arial, sans-serif`;g.textAlign='center';g.textBaseline='middle';g.lineJoin='round';g.lineWidth=Math.max(2,size*.085);g.strokeStyle='rgba(0,0,0,.95)';g.strokeText(s,x,y);if(thicken){g.strokeStyle=color;g.lineWidth=thicken;g.strokeText(s,x,y);}g.fillStyle=color;g.fillText(s,x,y);}
  function paint(seconds){const t=seconds%8;g.clearRect(0,0,960,540);g.fillStyle='#20252b';g.fillRect(0,0,960,540);
   // Alejamiento leve y oscurecimiento gradual, como en el cierre de referencia.
   const zoom=1.13-.13*show(t,0,1.6),w=960*zoom,h=540*zoom;g.drawImage(img,(960-w)/2,(540-h)/2,w,h);
   g.fillStyle=`rgba(10,12,15,${(index===0?.20:.30)+.06*show(t,4,3)})`;g.fillRect(0,0,960,540);
   g.save();g.globalAlpha=show(t,.1,.4);text('GRACIAS POR VER',480,92,22,'#d4d4d4');g.restore();
   g.save();g.globalAlpha=show(t,.3,.7);text('NODEHISTORY',480,181,76,'#e8e8e8',900,2.5);g.fillStyle='#d8d8d8';g.fillRect(260,230,440*show(t,.3,.7),3);g.restore();
   const like=show(t,1,.24);if(like){g.save();g.globalAlpha=like;const y=335-(1-like)*35;g.fillStyle='#f4f4f4';g.strokeStyle='#090909';g.lineWidth=4;g.beginPath();g.arc(190,y-12,30,Math.PI,0);g.lineTo(190,y+35);g.closePath();g.fill();g.stroke();g.save();g.translate(176,y-24);g.scale(1.2,1.2);g.fillStyle='#20252b';g.fill(new Path2D('M9.2 10.2V6.8c0-.65.35-1.26.92-1.58.57-.32 1.28-.27 1.8.12l1.66 1.27c.42.32.67.82.67 1.35v2.24h3.25c1.02 0 1.79.96 1.56 1.96l-1.1 4.76c-.2.86-.97 1.47-1.85 1.47H9.2v-6.19ZM5.4 10.2h2v8.19h-2z'));g.restore();text('ME GUSTA',278,y-10,25,'#e2e2e2');g.restore();}
   const route=show(t,1.25,1.2);if(route){g.save();g.strokeStyle='#eeeeee';g.lineWidth=3;g.setLineDash([10,8]);g.beginPath();g.moveTo(350,319);g.lineTo(350+90*route,319);g.stroke();g.restore();}
   const sub=show(t,2.5,.2);if(sub){g.save();g.globalAlpha=sub;g.fillStyle='#e8e8e8';g.fillRect(454,278,268,74);g.strokeStyle='#151515';g.lineWidth=3;g.strokeRect(454,278,268,74);g.fillStyle='#171717';g.font='900 30px Arial';g.textAlign='center';g.textBaseline='middle';g.fillText('SUSCRÍBETE',588,315);g.restore();}
   const bell=show(t,3.25,.2);if(bell){g.save();g.globalAlpha=bell;g.translate(766,315);g.rotate(Math.sin((t-3.25)*16)*Math.exp(-(t-3.25)*3)*.3);g.fillStyle='#f4f4f4';g.strokeStyle='#111';g.lineWidth=3;g.beginPath();g.moveTo(-18,12);g.lineTo(-13,5);g.lineTo(-13,-6);g.bezierCurveTo(-13,-25,13,-25,13,-6);g.lineTo(13,5);g.lineTo(18,12);g.closePath();g.fill();g.stroke();g.beginPath();g.arc(0,15,4,0,Math.PI);g.fill();g.restore();}
   if(t>3.65){const msg='Apoya el canal y comparte esta historia.';text(msg.slice(0,Math.floor((t-3.65)*45)),480,421,22,'#d6d6d6');g.save();g.globalAlpha=show(t,4,.4);text('youtube.com/@nodehistory',480,465,18,'#f1f1f1');g.fillStyle='#eee';g.fillRect(353,481,254,2);g.restore();}
  }
  paint(5);return {article,paint};
 });
}
