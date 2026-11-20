import {Tactico} from '../core.js';
import {mercator, unmercator} from '../util.js';
import {seaCrossings, landIndex} from '../tools/geometry.js';
import {readJSON, atlasGeoURL} from '../tools/io.js';
import {clamp, smooth, transitionAt, color, chip, position, dated} from './labels.js';

// validate es síncrono y core todavía no transmite land a los validadores de componentes.
// Se precarga una vez, fuera del render, usando la misma geometría que su CLI.
const fallbackLand=landIndex(await readJSON(atlasGeoURL));
const resolvePoint=(p,ctx)=>Array.isArray(p)?p:ctx.place?.(p)??ctx.geo?.place?.(p)??ctx.scene?.places?.[p];
const validPoint=p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(p[0])&&Number.isFinite(p[1])&&Math.abs(p[0])<=180&&Math.abs(p[1])<=85.0511287798066;
function pointsOf(i,ctx) {return (i.path?.via??(i.from!=null&&i.to!=null?[i.from,i.to]:i.via)??[]).map(p=>resolvePoint(p,ctx));}
function routeErrors(i,ctx) {
  const points=pointsOf(i,ctx),errors=[];
  if(points.length<2||points.some(p=>!validPoint(p)))errors.push('via necesita dos o más posiciones válidas [lon,lat] o lugares resueltos');
  if(i.width!=null&&(!(i.width>0)||!Number.isFinite(i.width)))errors.push('width debe ser positivo y finito');
  return errors;
}
function routePrepare(i,ctx) {return {via:pointsOf(i,ctx),keys:dated(i,ctx),control:i.control?resolvePoint(i.control,ctx):null,screen:new Map()};}
export function validateSeaRoute(path,land) {
  if(!Array.isArray(path?.via)||path.via.length<2||path.via.some(p=>!validPoint(p)))return ['La ruta marítima necesita al menos dos coordenadas válidas'];
  if(!land)return ['No hay máscara de tierra para validar la ruta marítima'];
  const index=Array.isArray(land)?land:landIndex(land);
  return seaCrossings({...path,curve:'line'},index).map(c=>`Ruta marítima: segmento ${c.segment+1} cruza ${c.place}. ${c.suggestion}`);
}
function availableLand(ctx){return ctx.land??ctx.landIndex??fallbackLand;}
function projected(via,view){return via.map(p=>view.project(...p));}
const lengthCache=new WeakMap();
function lengthsOf(points){
  if(!lengthCache.has(points)){const lengths=[0];for(let n=1;n<points.length;n++)lengths.push(lengths.at(-1)+Math.hypot(points[n].x-points[n-1].x,points[n].y-points[n-1].y));lengthCache.set(points,lengths);}
  return lengthCache.get(points);
}
function sampleAt(points,u) {
  const lengths=lengthsOf(points);
  const d=clamp(u)*lengths.at(-1);let n=1;while(n<lengths.length-1&&lengths[n]<d)n++;
  const a=points[n-1],b=points[n]??a,f=(d-lengths[n-1])/(lengths[n]-lengths[n-1]||1);
  return {x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f,angle:Math.atan2(b.y-a.y,b.x-a.x)};
}
function line(g,points){g.beginPath();points.forEach((p,n)=>n?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));}
function head(g,p,e,tone,size=18){g.save();g.translate(p.x,p.y);g.rotate(p.angle);g.fillStyle=color(e,tone);g.strokeStyle=color(e,'dark');g.lineWidth=2*e.U;g.beginPath();g.moveTo(0,0);g.lineTo(-size*e.U,-size*.47*e.U);g.lineTo(-size*.75*e.U,0);g.lineTo(-size*e.U,size*.47*e.U);g.closePath();g.fill();g.stroke();g.restore();}
function strokeRoute(g,ps,e,i,{dash=null,alpha=1,width=i.width??4}={}) {
  g.save();g.lineJoin=g.lineCap='round';g.globalAlpha*=alpha;line(g,ps);g.strokeStyle=color(e,'dark');g.lineWidth=(width+3)*e.U;g.stroke();g.strokeStyle=color(e,i.color??'text');g.lineWidth=width*e.U;if(dash)g.setLineDash(dash.map(x=>x*e.U));g.lineDashOffset=-(i.offset??0)*e.U;g.stroke();g.restore();
}
export function partial(ps,u){const lengths=lengthsOf(ps),end=clamp(u)*lengths.at(-1),out=[ps[0]];for(let n=1;n<ps.length&&lengths[n]<end;n++)out.push(ps[n]);out.push(sampleAt(ps,u));return out;}
function cachedGeometry(s,v,key,build){
  const cache=s.internal.screen,k=`${v.mercatorToScreen}/${key}`;
  if(!cache.has(k)){cache.set(k,build());if(cache.size>4)cache.delete(cache.keys().next().value);}
  return cache.get(k);
}
const routeParams={via:{type:'array',default:[[49,28],[56.3,26.5],[59,24]]},width:{type:'number',default:4},color:{type:'string',default:'text'},reveal:{type:'number',default:1}};
const demo={via:[[50.5,28.8],[53,27],[56.4,26.4],[58.5,24.8]],t:0,dur:6,out:5.5};
Tactico.component('arrow.route',{
  layer:15,summary:'Flecha por waypoints con contorno y punta que avanza a longitud constante.',params:routeParams,states:[],validate:routeErrors,prepare:routePrepare,
  draw(g,s,v,e){const i=s.item,ps=projected(s.internal.via,v),u=smooth(s.lt/(i.reveal??1));strokeRoute(g,partial(ps,u),e,i);head(g,sampleAt(ps,u),e,i.color??'text',i.head??24);},demo:{...demo,type:'arrow.route',color:'accent'}
});
function curvePoints(s,v){return cachedGeometry(s,v,'curve',()=>{const i=s.item,ps=projected(s.internal.via,v);if(ps.length>2)return ps;const [a,b]=ps,c=s.internal.control?v.project(...s.internal.control):{x:(a.x+b.x)/2-(b.y-a.y)*(i.bend??.3),y:(a.y+b.y)/2+(b.x-a.x)*(i.bend??.3)};return Array.from({length:65},(_,n)=>{const u=n/64,q=1-u;return {x:q*q*a.x+2*q*u*c.x+u*u*b.x,y:q*q*a.y+2*q*u*c.y+u*u*b.y};});});}
Tactico.component('arrow.curve',{
  layer:15,summary:'Curva cuadrática con punta, revelado y estela luminosa en movimiento.',params:{...routeParams,bend:{type:'number',default:.3},trail:{type:'number',default:.24}},states:[],validate:routeErrors,prepare:routePrepare,
  draw(g,s,v,e){const i=s.item,ps=curvePoints(s,v),u=smooth(s.lt/(i.reveal??1)),end=sampleAt(ps,u);strokeRoute(g,partial(ps,u),e,i,{alpha:.7,width:i.width??7});const phase=(s.lt*.27)%1,lo=Math.max(0,phase-(i.trail??.24)),hi=Math.min(phase,u);if(hi>lo){const tail=Array.from({length:20},(_,n)=>sampleAt(ps,lo+(hi-lo)*n/19));strokeRoute(g,tail,e,{...i,color:i.trailColor??'accent'},{width:(i.width??7)*1.35});}head(g,end,e,i.color??'text',i.head??30);},demo:{...demo,type:'arrow.curve',via:[[48,33],[56,27]],color:'text',width:9}
});
Tactico.component('arrow.bolt',{
  layer:15,summary:'Rayo angular determinista entre dos puntos con núcleo brillante y pulso.',params:{...routeParams,teeth:{type:'number',default:8},amplitude:{type:'number',default:24},seed:{type:'number',default:1}},states:[],validate:routeErrors,prepare:routePrepare,
  draw(g,s,v,e){const i=s.item,[a,b]=projected([s.internal.via[0],s.internal.via.at(-1)],v),angle=Math.atan2(b.y-a.y,b.x-a.x),random=e.rng(i.seed??i.id??1),count=Math.max(2,Math.min(32,i.teeth??8)),ps=[];for(let n=0;n<=count;n++){const u=n/count,offset=n===0||n===count?0:(n%2?1:-1)*(i.amplitude??24)*e.U*(.7+.3*random());ps.push({x:a.x+(b.x-a.x)*u-Math.sin(angle)*offset,y:a.y+(b.y-a.y)*u+Math.cos(angle)*offset});}
    const active=partial(ps,smooth(s.lt/(i.reveal??.5)));strokeRoute(g,active,e,i,{width:15,alpha:.1});strokeRoute(g,active,e,{...i,color:i.color??'accent'},{width:5,alpha:.75+.25*Math.sin(s.t*7)**2});strokeRoute(g,active,e,{color:'text'},{width:1.5});head(g,sampleAt(ps,smooth(s.lt/(i.reveal??.5))),e,i.color??'accent',20);},demo:{...demo,type:'arrow.bolt',via:[[48,32],[58,25]],color:'accent'}
});
Tactico.component('arrow.flow',{
  layer:15,summary:'Flujo ondulado con flechas que recorren la curva según tiempo absoluto.',params:{...routeParams,amplitude:{type:'number',default:14},wavelength:{type:'number',default:150},heads:{type:'number',default:5},speed:{type:'number',default:.13}},states:[],validate:routeErrors,prepare:routePrepare,
  draw(g,s,v,e){const i=s.item,base=projected(s.internal.via,v),length=base.slice(1).reduce((sum,p,n)=>sum+Math.hypot(p.x-base[n].x,p.y-base[n].y),0),steps=Math.max(24,Math.min(240,Math.ceil(length/(8*e.U)))),ps=Array.from({length:steps+1},(_,n)=>{const u=n/steps,p=sampleAt(base,u),d=Math.sin(u*length/((i.wavelength??150)*e.U)*Math.PI*2-s.t*2)*Math.sin(Math.PI*u)*(i.amplitude??14)*e.U;return {x:p.x-Math.sin(p.angle)*d,y:p.y+Math.cos(p.angle)*d};});strokeRoute(g,ps,e,{...i,color:i.color??'accent'},{width:i.width??5});const count=Math.max(1,Math.min(20,i.heads??5));for(let n=0;n<count;n++)head(g,sampleAt(ps,((n/count+s.lt*(i.speed??.13))%1+1)%1),e,i.color??'accent',20);},demo:{...demo,type:'arrow.flow',color:'accent'}
});
Tactico.component('route.sea',{
  layer:15,summary:'Ruta marítima por waypoints, puntos y guiones animados; rechaza cada cruce con tierra.',params:{...routeParams,speed:{type:'number',default:20},points:{type:'boolean',default:true}},states:[],
  validate(i,c){const errors=routeErrors(i,c);if(errors.length)return errors;return validateSeaRoute({via:pointsOf(i,c)},availableLand(c));},
  prepare:routePrepare,
  draw(g,s,v,e){const i=s.item,ps=projected(s.internal.via,v);strokeRoute(g,ps,e,{...i,offset:s.lt*(i.speed??20)},{dash:[8,12],width:i.width??3});if(i.points!==false){g.save();g.fillStyle=color(e,i.color??'text');g.strokeStyle=color(e,'dark');g.lineWidth=2*e.U;for(const p of ps){g.beginPath();g.arc(p.x,p.y,5*e.U,0,Math.PI*2);g.fill();g.stroke();}g.restore();}},demo:{...demo,type:'route.sea',via:[[50,28],[52,27],[54.5,26],[56.4,26.5],[57.4,25.3],[59,24.5]],color:'text'}
});
Tactico.component('route.lanes',{
  layer:15,summary:'Haz de carriles convergentes de pantalla con chip ajustado al punto de paso.',params:{...routeParams,lanes:{type:'number',default:5},spacing:{type:'number',default:14},text:{type:'string',default:'ORMUZ'}},states:[],validate:(i,c)=>[...routeErrors(i,c),...(i.lanes!=null&&(!Number.isInteger(i.lanes)||i.lanes<1||i.lanes>16)?['lanes debe ser entero entre 1 y 16']:[])],prepare:routePrepare,
  draw(g,s,v,e){const i=s.item,base=projected(s.internal.via,v),count=i.lanes??5,lanes=cachedGeometry(s,v,`lanes/${e.U}`,()=>Array.from({length:count},(_,lane)=>{const shift=(lane-(count-1)/2)*(i.spacing??14)*e.U;return Array.from({length:49},(_,n)=>{const u=n/48,p=sampleAt(base,u),d=shift*Math.sin(Math.PI*u);return {x:p.x-Math.sin(p.angle)*d,y:p.y+Math.cos(p.angle)*d};});}));for(let lane=0;lane<count;lane++){const ps=lanes[lane];strokeRoute(g,ps,e,i,{width:i.width??1.5,alpha:.7});head(g,sampleAt(ps,(s.lt*.12+lane/count)%1),e,i.color??'text',10);}const mid=sampleAt(base,i.chipAt??.5);chip(g,i.text??'ORMUZ',{x:mid.x,y:mid.y-34*e.U},e,{size:24,width:430,color:i.color??'text'});},demo:{...demo,type:'route.lanes',text:'ESTRECHO DE ORMUZ',width:1.5}
});
Tactico.component('front.line',{
  layer:15,summary:'Frente discontinuo rotulado «aproximado»; interpola posiciones fechadas de avance o retirada.',params:{...routeParams,approximate:{type:'boolean',default:true}},states:['advance','retreat','hold'],
  validate(i,c){const errors=routeErrors(i,c),count=pointsOf(i,c).length;for(const k of i.states??[]){if(k.via&&(k.via.length!==count||k.via.some(p=>!validPoint(resolvePoint(p,c)))))errors.push('Cada posición del frente debe tener tantos puntos válidos como via');}return errors;},
  prepare(i,c){return {...routePrepare(i,c),keys:dated(i,c).map(k=>({...k,via:k.via?.map(p=>resolvePoint(p,c))}))};},
  draw(g,s,v,e){const i=s.item,n=s.internal;let from=n.via,to=from,u=1;for(const k of n.keys)if(s.t>=k.at&&k.via){from=to;to=k.via;u=transitionAt(s.t,k);}
    const ps=to.map((p,j)=>{const a=mercator(...from[j]),b=mercator(...p),q=unmercator(a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u);return v.project(...q);});strokeRoute(g,ps,e,{...i,color:i.color??'danger'},{dash:[15,10],width:i.width??4});const p=sampleAt(ps,.5);chip(g,'FRENTE · aproximado',{x:p.x,y:p.y-38*e.U},e,{size:24,width:460,color:i.color??'danger'});},
  demo:{type:'front.line',via:[[47,33],[48.5,31.5],[49,30]],states:[{at:1,state:'advance',via:[[48,33],[49.5,31.5],[50,30]],dur:1.5},{at:3.5,state:'retreat',via:[[47.3,33],[48.8,31.5],[49.3,30]],dur:1}],color:'danger',t:0,dur:6,out:5.5,note:'Frente esquemático sin valor histórico.'}
});
function ringErrors(i){return i.radiusKm!=null&&(!(i.radiusKm>0)||i.radiusKm>20000)?['radiusKm debe ser positivo y menor o igual a 20000']:i.radius!=null&&!(i.radius>0)?['radius debe ser positivo']:[];}
Tactico.component('range.ring',{
  layer:15,summary:'Anillo de alcance geodésico o simbólico en pantalla, pulso y guiones móviles.',params:{radiusMode:{type:'enum',values:['geo','screen'],default:'geo'},radiusKm:{type:'number',default:180},radius:{type:'number',default:160},color:{type:'string',default:'danger'},pulse:{type:'boolean',default:true}},states:[],validate:ringErrors,
  draw(g,s,v,e){const i=s.item,p=position(s,v,e),pulse=i.pulse===false?1:1+.055*Math.sin(s.t*2.8);let ps;
    const geo=Array.isArray(s.pos)?s.pos:s.pos?.lon!=null?[s.pos.lon,s.pos.lat]:Array.isArray(i.at)?i.at:null;
    if(i.radiusMode!=='screen'&&i.radiusKm&&geo){const rad=Math.PI/180,phi=geo[1]*rad,lambda=geo[0]*rad,d=i.radiusKm/6371*pulse;ps=Array.from({length:97},(_,n)=>{const a=n/96*Math.PI*2,lat=Math.asin(Math.sin(phi)*Math.cos(d)+Math.cos(phi)*Math.sin(d)*Math.cos(a)),lon=lambda+Math.atan2(Math.sin(a)*Math.sin(d)*Math.cos(phi),Math.cos(d)-Math.sin(phi)*Math.sin(lat));return v.project(lon/rad,lat/rad);});}
    else ps=Array.from({length:97},(_,n)=>{const a=n/96*Math.PI*2,r=(i.radius??160)*e.U*pulse;return {x:p.x+Math.cos(a)*r,y:p.y+Math.sin(a)*r};});
    strokeRoute(g,ps,e,{...i,color:i.color??'danger',offset:s.t*10},{dash:[12,8],width:i.width??3});},demo:{type:'range.ring',at:[53,29],radiusKm:180,color:'danger',t:0,dur:6,out:5.5}
});
