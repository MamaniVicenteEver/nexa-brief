import {Tactico} from '../core.js';
import * as util from '../util.js';

// Helpers stay in this family module while the shared contract evolves.
export const clamp = (v, lo=0, hi=1) => Math.max(lo, Math.min(hi, v));
export const smooth = v => { const q=clamp(v); return q*q*(3-2*q); };
export const RAD = Math.PI/180;
export const angleDelta = (a,b) => ((b-a+540)%360+360)%360-180;
const artCache=new Map();let artPixels=0;
// Cache static artwork at 2x resolution. Animated geometry and state blends stay live.
export function cachedArt(key,size,paint) {
  if(typeof OffscreenCanvas==='undefined')return null;
  if(artCache.has(key))return artCache.get(key);
  const side=Math.ceil(size*2),pixels=side*side;
  if(pixels>8e6)return null;
  while(artCache.size&&(artPixels+pixels>8e6||artCache.size>=128)){
    const first=artCache.keys().next().value;artPixels-=artCache.get(first).width**2;artCache.get(first).close?.();artCache.delete(first);
  }
  const canvas=new OffscreenCanvas(side,side),g=canvas.getContext('2d',{willReadFrequently:true});
  g.scale(2,2);g.translate(size/2,size/2);paint(g);
  const bitmap=canvas.transferToImageBitmap();artCache.set(key,bitmap);artPixels+=pixels;return bitmap;
}
export function time(value, ctx, fallback=0) {
  if (value==null) return fallback;
  return ctx?.T ? ctx.T(value,fallback) : Number.isFinite(+value) ? +value : fallback;
}
export function place(value,ctx,seen=new Set()) {
  if (Array.isArray(value)) return value.slice(0,2);
  if (value && Number.isFinite(value.lon)) return [value.lon,value.lat];
  if (typeof value==='string' && !seen.has(value)) {
    seen.add(value);
    const scene=ctx?.scene||{}, own=scene.places?.[value];
    if(own) return place(own.coordinates||own.center||own,ctx,seen);
    const p=ctx?.geo?.place?.(value); if(p) return p;
    const other=(scene.items||[]).find(i=>i.id===value);
    if(other) return place(other.at||other.path?.via?.[0],ctx,seen);
  }
  return null;
}
export function prepareMotion(item,ctx) {
  const start=time(item.t,ctx), source=item.path;
  const path=source ? {...source,via:(source.via||[]).map(p=>place(p,ctx)||p),t:time(source.t,ctx,start),...(source.dur!=null?{dur:time(source.dur,ctx)}:{}),curve:source.curve||'line'} : null;
  const states=(item.states||[]).map(s=>({...s,at:time(s.at,ctx),dur:s.dur??.35})).sort((a,b)=>a.at-b.at);
  return {at:place(item.at,ctx)||path?.via?.[0]||[0,0],path,start,states,ctx};
}
export function poseAt(internal,item,t) {
  const m=internal?.motion||internal||{};
  if(m.path?.via?.length>1 && util.pathAt) {
    const p=util.pathAt(m.path,t);
    return {...p,heading:item.heading==='auto'||item.heading==null?p.heading:Number(item.heading)};
  }
  const p=m.at||[0,0];return {lon:p[0],lat:p[1],heading:Number(item.heading)||0,u:0};
}
export function screenPose(s,view) {
  const p=poseAt(s.internal,s.item,s.t), q=view.project(p.lon,p.lat);
  // A projected short step handles camera rotation and either bearing convention.
  const h=p.heading*RAD,d=.001, tip=view.project(p.lon+Math.sin(h)*d/Math.max(.05,Math.cos(p.lat*RAD)),p.lat+Math.cos(h)*d);
  return {...q,lon:p.lon,lat:p.lat,heading:p.heading,angle:Math.atan2(tip.x-q.x,q.y-tip.y)};
}
export function stateWeights(s,names,initial='normal') {
  if(s.stateWeights && !s.internal?.child) return {...Object.fromEntries(names.map(n=>[n,0])),...s.stateWeights};
  let weights=Object.fromEntries(names.map(n=>[n,Number(n===(s.item?.state||initial))])),current=null;
  const states=s.internal?.motion?.states||s.internal?.states||[];
  const sample=t=>{
    if(!current)return weights;
    const q=current.dur===0?1:util.ease(current.ease||'inOut',clamp((t-current.at)/current.dur));
    return Object.fromEntries(names.map(key=>[key,(current.from[key]||0)*(1-q)+(key===current.state?q:0)]));
  };
  for(const e of states) {
    if(s.t<e.at) break;
    weights=sample(e.at);current={...e,from:weights};
  }
  weights=sample(s.t);
  if(!states.length && names.includes(s.state)) {for(const key of names)weights[key]=Number(key===s.state);}
  return weights;
}
export function color(env,name,fallback) {
  const p=env.palette||{};return p[name]||p.colors?.[name]||fallback;
}
export function ink(env) {
  return {
    dark:color(env,'background','#081e2c'),light:color(env,'white','#e9e3ba'),gold:color(env,'gold','#f6edb4'),
    red:color(env,'red','#d1495b'),green:color(env,'green','#399e58'),blue:color(env,'cyan','#66c6e3'),
    gray:color(env,'steel','#82949c'),smoke:color(env,'smoke','#33424b'),fire:color(env,'orange','#e69b45'),
  };
}
export function text(g,label,x,y,size,env,fill,align='center') {
  const c=ink(env);g.save();g.font=`700 ${size}px ${env.font?.('label')||'Arial, sans-serif'}`;
  g.textAlign=align;g.textBaseline='middle';g.lineJoin='round';g.lineWidth=Math.max(2,size*.16);
  g.strokeStyle=c.dark;g.strokeText(String(label),x,y);g.fillStyle=fill||c.light;g.fillText(String(label),x,y);g.restore();
}
export function polygon(g,points) {g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();}
export function formationOffsets(formation,count,spacing=1) {
  const n=clamp(Math.floor(count),0,80),out=[];
  for(let i=0;i<n;i++) {
    let x=0,y=0;
    if(formation==='line') {x=(i-(n-1)/2)*spacing;y=0;}
    else if(formation==='column') y=i*spacing;
    else if(formation==='wedge') {const row=Math.ceil(i/2);x=(i%2?-1:1)*row*spacing*.8;y=row*spacing;}
    else if(formation==='diamond') {const a=[[-1,0],[1,0],[0,1.25],[0,-1.25]][i%4];x=a[0]*spacing*(1+Math.floor(i/4));y=a[1]*spacing*(1+Math.floor(i/4));}
    else if(formation==='box') {x=(i%2?1:-1)*spacing;y=(Math.floor(i/2)-(Math.ceil(n/2)-1)/2)*spacing*1.4;}
    else {const a=2*Math.PI*i/Math.max(1,n);x=Math.sin(a)*spacing;y=Math.cos(a)*spacing*1.15;}
    out.push({x,y});
  }
  return out;
}
export function motionErrors(item,ctx,{variants,states,requirePath=false}={}) {
  const errors=[];
  if(variants && item.variant!=null && !variants.includes(item.variant))errors.push(`variant desconocida: ${item.variant}`);
  if(item.heading!=null && item.heading!=='auto' && !Number.isFinite(item.heading))errors.push('heading debe ser auto o grados finitos');
  if(item.scale!=null && !(Number.isFinite(item.scale)&&item.scale>0))errors.push('scale debe ser positivo');
  if(item.scaleMode && !['screen','geo'].includes(item.scaleMode))errors.push('scaleMode debe ser screen o geo');
  if(item.scaleMode==='geo' && !(item.kmLength>0))errors.push('scaleMode geo requiere kmLength positivo');
  if(requirePath&&!item.path)errors.push('requiere path');
  if(item.path && (!Array.isArray(item.path.via)||item.path.via.length<2))errors.push('path.via requiere al menos dos puntos');
  if(item.path && item.path.dur!=null && typeof item.path.dur==='number' && !(item.path.dur>0))errors.push('path.dur debe ser positivo');
  for(const e of item.states||[])if(states&&!states.includes(e.state))errors.push(`estado desconocido: ${e.state}`);
  if(item.count!=null&&(!Number.isInteger(item.count)||item.count<1||item.count>80))errors.push('count debe ser entero entre 1 y 80');
  return errors;
}
export const motionParams={
  at:{default:null},heading:{default:'auto'},scale:{type:'number',default:1},
  scaleMode:{type:'enum',values:['screen','geo'],default:'screen'},kmLength:{type:'number',default:null},
  path:{type:'object',default:null},label:{type:'string',default:''},flag:{type:'string',default:'US'},
};
const LAND_STATES=['idle','active','retreat','hit','destroyed'];
function octagon(g,r) {polygon(g,Array.from({length:8},(_,i)=>{const a=(i+.5)*Math.PI/4;return [Math.sin(a)*r,Math.cos(a)*r];}));}
function flagFill(g,flag,r,env) {
  const image=env.flag?.(flag),src=image?.image||image?.bitmap||image;
  if(src && (src.width||src.naturalWidth)) {g.drawImage(src,-r,-r,r*2,r*2);return;}
  // Only identity colors are allowed outside the scene palette.
  const palettes={US:['#b22234','#fff','#b22234','#fff','#b22234','#fff'],RU:['#fff','#0039a6','#d52b1e'],UA:['#0057b7','#ffd700'],IR:['#239f40','#fff','#da0000'],IQ:['#ce1126','#fff','#000'],FR:['#0055a4','#fff','#ef4135'],GB:['#012169','#fff','#c8102e']};
  const colors=palettes[flag]||[ink(env).gray,ink(env).light,ink(env).gray];
  colors.forEach((c,i)=>{g.fillStyle=c;g.fillRect(-r,-r+2*r*i/colors.length,2*r,2*r/colors.length+1);});
  if(flag==='US'){g.fillStyle='#3c3b6e';g.fillRect(-r,-r,r,r);g.fillStyle='#fff';for(let i=0;i<9;i++)g.fillRect(-r*.86+i%3*r*.24,-r*.85+Math.floor(i/3)*r*.24,r*.08,r*.08);}
}
function soldier(g,r,env) {
  const c=ink(env);g.lineJoin='round';g.lineWidth=r*.055;g.strokeStyle=c.dark;
  g.fillStyle=c.dark;g.beginPath();g.ellipse(0,r*.5,r*.48,r*.32,0,Math.PI,0);g.fill();
  g.fillStyle=c.gray;g.fillRect(-r*.23,r*.25,r*.46,r*.32);
  g.fillStyle=c.gold;g.beginPath();g.roundRect(-r*.22,-r*.12,r*.44,r*.48,r*.13);g.fill();g.stroke();
  g.fillStyle=c.green;g.beginPath();g.arc(0,-r*.07,r*.31,Math.PI,0);g.lineTo(r*.34,r*.02);g.lineTo(-r*.34,r*.02);g.closePath();g.fill();g.stroke();
  g.fillStyle=c.dark;g.fillRect(-r*.13,r*.08,r*.08,r*.04);g.fillRect(r*.05,r*.08,r*.08,r*.04);
  g.strokeStyle=c.gold;g.beginPath();g.moveTo(-r*.27,r*.43);g.lineTo(r*.27,r*.43);g.stroke();
}
function drawTokenArt(g,item,x,y,r,w,env) {
  const c=ink(env),alpha=g.globalAlpha;g.save();g.translate(x,y);
  g.save();g.translate(r*.09,r*.13);g.fillStyle=c.dark;g.globalAlpha=alpha*.55;octagon(g,r*1.1);g.fill();g.restore();
  g.globalAlpha=alpha*(1-w.destroyed*.65);g.save();octagon(g,r);g.clip();flagFill(g,item.flag||'US',r,env);soldier(g,r,env);g.restore();
  g.strokeStyle=w.retreat>.4?c.red:c.gold;g.lineWidth=r*.075;octagon(g,r);g.stroke();
  if(w.active>0){g.globalAlpha=alpha*w.active*.55;g.strokeStyle=c.gold;g.lineWidth=r*.035;octagon(g,r*1.14);g.stroke();}
  if(w.hit>0){g.globalAlpha=alpha*w.hit*.8;g.fillStyle=c.light;octagon(g,r);g.fill();}
  if(w.destroyed>0){g.globalAlpha=alpha*w.destroyed;g.strokeStyle=c.red;g.lineWidth=r*.13;g.beginPath();g.moveTo(-r*.5,-r*.5);g.lineTo(r*.5,r*.5);g.moveTo(r*.5,-r*.5);g.lineTo(-r*.5,r*.5);g.stroke();}
  g.restore();
}
function drawToken(g,item,x,y,r,w,env){
  const stable=Object.values(w).every(v=>v===0||v===1),size=Math.ceil(r*2.65);
  const art=stable?cachedArt(JSON.stringify(['token',item.flag,r,w,ink(env)]),size,c=>drawTokenArt(c,item,0,0,r,w,env)):null;
  if(art)g.drawImage(art,x-size/2,y-size/2,size,size);else drawTokenArt(g,item,x,y,r,w,env);
}
function drawLand(g,s,view,env) {
  const item=s.item, p=screenPose(s,view),U=env.U||1;
  const geoTip=item.scaleMode==='geo'?view.project(p.lon,p.lat+item.kmLength/111.32):null;
  const r=(geoTip?Math.hypot(geoTip.x-p.x,geoTip.y-p.y)/2:39*U)*(item.scale??1), count=item.type==='unit.token'?1:(item.count??5), spacing=r*2.6;
  const offsets=formationOffsets(item.formation||'wedge',count,spacing),w=stateWeights(s,LAND_STATES,item.type==='unit.retreat'?'retreat':'idle'),c=ink(env);
  g.save();
  if(item.path && item.trail!==false){
    for(let i=15;i>0;i--){const a=poseAt(s.internal,item,s.t-i*.11),b=poseAt(s.internal,item,s.t-(i-1)*.11),q=view.project(a.lon,a.lat),v=view.project(b.lon,b.lat);
      g.save();g.globalAlpha*=.24*(1-i/16);g.strokeStyle=item.type==='unit.retreat'?c.red:c.gold;g.lineWidth=r*.6;g.lineCap='round';g.beginPath();g.moveTo(q.x,q.y);g.lineTo(v.x,v.y);g.stroke();g.restore();}
  }
  if(['unit.advance','unit.retreat'].includes(item.type)) {
    g.save();g.translate(p.x,p.y);g.rotate(p.angle);g.strokeStyle=item.type==='unit.retreat'?c.red:c.gold;g.lineWidth=4*U;g.setLineDash(item.type==='unit.retreat'?[10*U,6*U]:[]);
    g.beginPath();g.moveTo(-spacing*1.5,-r*1.7);g.quadraticCurveTo(0,-r*2.2,spacing*1.5,-r*1.7);g.stroke();g.restore();
  }
  for(const o of offsets){const x=p.x+o.x*Math.cos(p.angle)-o.y*Math.sin(p.angle),y=p.y+o.x*Math.sin(p.angle)+o.y*Math.cos(p.angle);drawToken(g,item,x,y,r,w,env);}
  if(item.label)text(g,item.label,p.x,p.y-r*2.7,24*U,env);g.restore();
}
for(const type of ['unit.token','unit.group','unit.move','unit.advance','unit.retreat']) {
  Tactico.component(type,{
    layer:30,summary:({ 'unit.token':'Ficha octogonal con bandera, soldado y aro dorado.','unit.group':'Fichas en línea, cuña o columna.','unit.move':'Formación terrestre que recorre una ruta.','unit.advance':'Avance con frente dorado y estela.','unit.retreat':'Retirada con frente rojo discontinuo.'})[type],
    params:{...motionParams,count:{type:'number',default:type==='unit.token'?1:5},formation:{type:'enum',values:['line','wedge','column'],default:'wedge'},trail:{type:'boolean',default:true}},
    states:LAND_STATES,
    validate:(item,ctx)=>[...motionErrors(item,ctx,{states:LAND_STATES,requirePath:['unit.move','unit.advance','unit.retreat'].includes(type)}),...(item.formation&&!['line','wedge','column'].includes(item.formation)?['formation debe ser line, wedge o column']:[])],
    prepare:prepareMotion,draw:drawLand,
    demo:{id:type.replace('.','-'),type,at:[48.4,30.6],flag:'IQ',label:type==='unit.retreat'?'RETIRADA':'FRENTE',count:type==='unit.token'?1:5,t:0,dur:7,
      ...(type==='unit.token'||type==='unit.group'?{}:{path:{via:[[48.2,30.5],[48.6,30.7],[48.9,30.6]],t:.5,dur:5,curve:'smooth'}}),states:[{at:1,state:'active'},{at:5.8,state:type==='unit.retreat'?'retreat':'idle'}]},
  });
}
Tactico.component('fx.clash',{
  layer:60,summary:'Choque entre dos grupos: destello y ondas en el punto medio móvil.',
  params:{at:motionParams.at,groups:{type:'array',default:[]},scale:motionParams.scale},states:[],
  validate:(item,ctx)=>{const errors=motionErrors(item,ctx);if(item.groups?.length&&item.groups.length!==2)errors.push('groups requiere exactamente dos ids');for(const id of item.groups||[])if(!(ctx.scene?.items||[]).some(i=>i.id===id))errors.push(`grupo desconocido: ${id}`);return errors;},
  prepare(item,ctx){return {...prepareMotion(item,ctx),groups:(item.groups||[]).map(id=>(ctx.scene?.items||[]).find(i=>i.id===id)).filter(Boolean).map(item=>({item,motion:prepareMotion(item,ctx)}))};},
  draw(g,s,view,env){
    let p=screenPose(s,view);const refs=s.internal?.groups||[];
    if(refs.length===2){const qs=refs.map(r=>poseAt(r.motion,r.item,s.t)).map(q=>view.project(q.lon,q.lat));p={x:(qs[0].x+qs[1].x)/2,y:(qs[0].y+qs[1].y)/2};}
    const U=env.U||1,c=ink(env),q=clamp(s.lt/(s.item.dur||1.2)),r=(24+90*q)*U*(s.item.scale||1);
    g.save();g.globalAlpha*=1-q;g.strokeStyle=c.gold;g.lineWidth=6*U*(1-q);g.beginPath();g.arc(p.x,p.y,r,0,Math.PI*2);g.stroke();
    g.fillStyle=c.light;g.translate(p.x,p.y);polygon(g,Array.from({length:16},(_,i)=>{const a=i*Math.PI/8,l=r*(i%2?.17:.55)*(1-q);return [Math.cos(a)*l,Math.sin(a)*l];}));g.fill();g.restore();
  },
  demo:{type:'fx.clash',id:'clash',at:[48.5,30.6],t:0,dur:2,scale:1.6},
});
