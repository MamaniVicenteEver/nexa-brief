import {Tactico} from '../core.js';

const defaults={ink:'#081e2c',money:'#399e58',paper:'#e9e3ba',accent:'#f6edb4',side:'#47595c'};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const sprites=new Map();
const stacks=new Map();
const defaultVia=[[50.33,29.25],[52,27.5],[56.4,26.5],[58,24]];
const route=item=>item.path?.via??item.via??defaultVia;
function noteSprite(p){const k=JSON.stringify(p);if(sprites.has(k))return sprites.get(k);const c=typeof OffscreenCanvas==='function'?new OffscreenCanvas(140,80):Object.assign(document.createElement('canvas'),{width:140,height:80});const g=c.getContext('2d');
 g.fillStyle=p.ink;g.beginPath();g.moveTo(4,21);g.lineTo(104,3);g.lineTo(138,54);g.lineTo(34,78);g.closePath();g.fill();
 g.fillStyle=p.side;g.beginPath();g.moveTo(6,20);g.lineTo(106,3);g.lineTo(135,46);g.lineTo(135,57);g.lineTo(34,77);g.lineTo(6,31);g.closePath();g.fill();
 g.fillStyle=p.paper;g.beginPath();g.moveTo(6,18);g.lineTo(106,1);g.lineTo(135,46);g.lineTo(34,67);g.closePath();g.fill();g.strokeStyle=p.ink;g.lineWidth=2;g.stroke();
 g.strokeStyle=p.money;g.lineWidth=3;g.beginPath();g.moveTo(18,21);g.lineTo(100,8);g.lineTo(122,43);g.lineTo(37,59);g.closePath();g.stroke();
 g.fillStyle=p.money;g.beginPath();g.ellipse(71,32,20,12,-.2,0,Math.PI*2);g.fill();
 g.fillStyle=p.accent;g.beginPath();g.moveTo(59,9);g.lineTo(77,6);g.lineTo(104,53);g.lineTo(87,56);g.closePath();g.fill();sprites.set(k,c);return c;
}
function pos(s,view){const a=s.pos??s.item.at;return Array.isArray(a)?view.project(...a):a&&Number.isFinite(a.lon)?view.project(a.lon,a.lat):null;}
const scaleParam={type:'number',default:1,min:.2,max:4};
function validate(item){const e=[];if(item.scale!=null&&(!Number.isFinite(item.scale)||item.scale<=0||item.scale>4))e.push('scale debe estar entre 0 y 4');return e;}
function prepare(item,ctx){const p={...defaults,...ctx.palette,...ctx.scene?.defs?.palette,ink:ctx.scene?.defs?.palette?.ink??ctx.palette?.dark??ctx.palette?.background??defaults.ink};return {image:noteSprite(p)};}
function prepareStack(item,ctx){
 const internal=prepare(item,ctx),count=item.count??8,key=JSON.stringify([count,ctx.palette,ctx.scene?.defs?.palette]);
 if(!stacks.has(key)){
  const w=286,h=105+Math.floor((count-1)/3)*15,c=typeof OffscreenCanvas==='function'?new OffscreenCanvas(w,h):Object.assign(document.createElement('canvas'),{width:w,height:h});
  const g=c.getContext('2d'),top=-15-Math.floor((count-1)/3)*15;
  for(let i=0;i<count;i++)g.drawImage(internal.image,(i%3)*76,-15+(i%3)*14-Math.floor(i/3)*15-top,130,74);
  if(stacks.size>=128)stacks.delete(stacks.keys().next().value);
  stacks.set(key,{image:c,top});
 }
 return {...internal,stack:stacks.get(key)};
}
Tactico.component('money.stack',{
 layer:30,summary:'Fajos simbólicos que se deslizan y apilan; sin moneda ni cifra económica implícita.',
 params:{count:{type:'number',default:8,min:1,max:36},scale:scaleParam,buildDur:{type:'number',default:1.8,min:0,max:10}},
 validate(item){const e=validate(item);if(item.count!=null&&(!Number.isInteger(item.count)||item.count<1||item.count>36))e.push('count debe ser entero entre 1 y 36');if(item.buildDur!=null&&(!Number.isFinite(item.buildDur)||item.buildDur<0||item.buildDur>10))e.push('buildDur debe estar entre 0 y 10');return e;},prepare:prepareStack,
 animated:s=>s.lt<(s.item.buildDur??1.8)+.38,
 draw(g,s,view,env){const p=pos(s,view);if(!p||p.visible===false)return;const n=s.item.count??8,scale=env.U*(s.item.scale??1),dur=s.item.buildDur??1.8;g.save();g.translate(p.x,p.y);g.scale(scale,scale);
  // El fade sigue componiendo cada fajo para conservar la transparencia original.
  if(s.alpha===1&&(dur===0||s.lt>=dur+.38))g.drawImage(s.internal.stack.image,-155,s.internal.stack.top);
  else for(let i=0;i<n;i++){const reveal=dur===0?1:clamp((s.lt-dur*i/n)/.38,0,1);if(reveal===0)continue;const eased=1-(1-reveal)**3;const col=i%3,row=Math.floor(i/3);g.save();g.globalAlpha*=reveal;g.drawImage(s.internal.image,-155+col*76-(1-eased)*100,-15+col*14-row*15,130,74);g.restore();}g.restore();
 },demo:{id:'demo-money-stack',type:'money.stack',at:[51,28],count:12,t:0,dur:8,out:7},
});
Tactico.component('money.flow',{
 layer:30,summary:'Billetes simbólicos por una ruta geográfica; fase y rumbo puros de t, sin afirmar un valor comercial.',
 params:{via:{type:'array',default:defaultVia},count:{type:'number',default:7,min:1,max:40},period:{type:'number',default:5,min:.2,max:60},scale:scaleParam,routeVisible:{type:'boolean',default:false}},
 validate(item){const e=validate(item),via=route(item);if(!Array.isArray(via)||via.length<2||via.some(p=>!Array.isArray(p)||p.length!==2||!Number.isFinite(p[0])||!Number.isFinite(p[1])||Math.abs(p[0])>180||Math.abs(p[1])>85))e.push('via necesita al menos dos pares lon/lat válidos');if(item.count!=null&&(!Number.isInteger(item.count)||item.count<1||item.count>40))e.push('count debe ser entero entre 1 y 40');if(item.period!=null&&(!Number.isFinite(item.period)||item.period<.2||item.period>60))e.push('period debe estar entre .2 y 60');return e;},
 prepare(item,ctx){
  const internal=prepare(item,ctx),points=route(item).map(([lon,lat])=>[lon,Math.log(Math.tan(Math.PI/4+lat*Math.PI/360))*180/Math.PI]);
  const lengths=[0];for(let i=1;i<points.length;i++)lengths.push(lengths.at(-1)+Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]));return {...internal,points,lengths,total:lengths.at(-1)};
 },
 draw(g,s,view,env){
  const n=s.item.count??7,{points,lengths,total}=s.internal,period=s.item.period??5,scale=(s.item.scale??1)*env.U;
  // Proyectar la ruta una vez por grupo, no una vez por billete.
  const projected=points.map(([lon,y])=>view.project(lon,(2*Math.atan(Math.exp(y*Math.PI/180))-Math.PI/2)*180/Math.PI));
  g.save();
  if(s.item.routeVisible){g.save();g.strokeStyle=env.palette?.accent??defaults.accent;g.globalAlpha*=.35;g.lineWidth=env.U;g.beginPath();projected.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.stroke();g.restore();}
  for(let i=0;i<n;i++){
   const u=((s.lt/period+i/n)%1+1)%1,d=u*total;let j=1;while(j<lengths.length-1&&lengths[j]<d)j++;const f=total?clamp((d-lengths[j-1])/(lengths[j]-lengths[j-1]||1),0,1):0;
   const a=projected[j-1],b=projected[j];if(!a||!b)continue;g.save();g.translate(a.x+(b.x-a.x)*f,a.y+(b.y-a.y)*f);g.rotate(Math.atan2(b.y-a.y,b.x-a.x)+.18);g.globalAlpha*=clamp(Math.min(u,1-u)*12,0,1);g.drawImage(s.internal.image,-40*scale,-23*scale,80*scale,46*scale);g.restore();
  }g.restore();
 },demo:{id:'demo-money-flow',type:'money.flow',at:[50.33,29.25],via:[[50.33,29.25],[51.8,27.4],[54.5,26.1],[56.4,26.5],[58,24]],count:7,period:5,t:0,dur:8,out:7,note:'Flujo simbólico · rutas esquemáticas'},
});
