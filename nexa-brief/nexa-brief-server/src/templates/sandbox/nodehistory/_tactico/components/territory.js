import {Tactico} from '../core.js';
import {transform} from '../../_atlas/plano/view.js';
import {clamp, smooth, transitionAt, color, dated, position, resolveTime} from './labels.js';
import {readJSON, atlasGeoURL} from '../tools/io.js';

const geometryCache=new WeakMap(), flagCache=new Map(), hatchCache=new Map(),markerCache=new Map();
const rasterLRU=new Map();let rasterPixels=0;
const FLAG_MODES=['fill','marker','both','none'];
const countryNames=new Set((await readJSON(atlasGeoURL)).features.flatMap(f=>Object.values(f.properties).filter(v=>typeof v==='string')).map(v=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()));
let flagCodes;
async function flagsReady() {
  // El catálogo original es un script clásico; se importa sin modificarlo.
  if(typeof window!=='undefined'&&!globalThis.Mapas?.flags) await import('../../_mapas/flags.js');
  const flags=globalThis.Mapas?.flags;
  // KW falta en el catálogo compartido. Extensión local, dibujada por su mismo renderer.
  // Diseño: kuwait-embassy.or.jp/E_outline_06.html. No se modifica el archivo de origen.
  if(flags&&!flags.FLAGS.kw)flags.FLAGS.kw={h:['#007a3d','#ffffff','#ce1126'],emblem(g,w,h){g.fillStyle='#000000';g.beginPath();g.moveTo(0,0);g.lineTo(w*.25,h/3);g.lineTo(w*.25,h*2/3);g.lineTo(0,h);g.closePath();g.fill();}};
  // Corrección local: el original reduce IR a una estrella. Trazado PD de SiBr4,
  // commons.wikimedia.org/wiki/File:Flag_of_Iran.svg (copia en work/research/flag-ir.svg).
  if(flags&&!flags.FLAGS.ir.atlasEmblem){
    const emblem=new Path2D("M 1.015679,-0.01556 A 0.77528237,0.7752862 0 0 1 0.60199011,0.67052066 1.0040699,1.0040749 0 0 0 0.44435035,-0.74067818 q -0.0221518,-0.0177005 -0.0452767,-0.0341288 A 0.77575926,0.7757631 0 0 1 1.015679,-0.01556 Z m 0.65590144,-0.04683837 a 0.92689013,0.92689472 0 0 1 -1.21301321,0.88105983 q 0.0245198,0.00118 0.0492749,0.001178 a 1.0158759,1.0158809 0 0 0 0.84183925,-1.58419413 0.92423346,0.92423804 0 0 1 0.32189906,0.7019563 z M 0.26154437,-0.94393072 A 0.14154065,0.14154135 0 0 1 1.7299476e-6,-0.86887791 L -0.01707249,-0.88602911 1.7299476e-6,-0.96931462 A 0.1321491,0.13214975 0 0 0 0.24983482,-1.0002001 a 0.14021999,0.14022068 0 0 1 0.0117096,0.0562694 z M 0.11992727,-0.71445117 A 0.31475286,0.31475442 0 0 1 1.2855032e-6,-0.81025163 L -0.0506876,-0.01642556 1.2855032e-6,1.0001998 0.07882572,0.89166862 0.0891995,0.64144186 0.09996594,0.3809197 l 0.0014156,-0.0334002 4.7111e-4,-0.0124172 0.002279,-0.0541474 0.006758,-0.1640148 0.005501,-0.13242286 0.001571,-0.03827263 0.002042,-0.04872535 V -0.71445117 Z M 1.2855032e-6,-0.54965037 9.0174383e-5,-0.54949481 1.2855032e-6,-0.54933925 Z m 0,0.86447753 V 0.3145916 L 3.946188e-4,0.31468049 Z"),script1=new Path2D('M0,1H26M1,10V5H9V9H17V5H12M4,9H6M26,9H21V5H29M29,0V9H37V0M33,0V9'),script2=new Path2D('M0,7H9M10,7H19');
    flags.FLAGS.ir={...flags.FLAGS.ir,atlasEmblem:true,emblem(g,w,h){
      g.save();g.scale(w/630,h/360);g.strokeStyle='#ffffff';g.lineWidth=2;
      for(let n=0;n<11;n++)for(const [path,scale,y] of [[script1,1.4,100.4],[script1,1.4,245.6],[script2,2.8,100.4],[script2,2.8,220.4]]){g.save();g.translate(8.4+n*56,y);g.scale(scale,scale);g.stroke(path);g.restore();}
      g.translate(315,180);g.scale(45,45);g.fillStyle='#da0000';g.fill(emblem);g.scale(-1,1);g.fill(emblem);g.restore();
    }};
  }
  return flags;
}
if(typeof window!=='undefined')flagCodes=new Set((await flagsReady()).ids());
else {
  const [{readFile},{runInNewContext}]=await Promise.all([import('node:fs/promises'),import('node:vm')]);
  const sandbox={window:{}};
  runInNewContext(await readFile(new URL('../../_mapas/flags.js',import.meta.url),'utf8'),sandbox);
  flagCodes=new Set(sandbox.window.Mapas.flags.ids());
  flagCodes.add('kw');
}
function flagBitmap(code) {
  const flags=globalThis.Mapas?.flags,key=String(code??'').toLowerCase();
  if(!flags?.FLAGS[key]) return null;
  if(!flagCache.has(key)){const canvas=new OffscreenCanvas(384,256);flags.draw(canvas.getContext('2d'),key,0,0,384,256);flagCache.set(key,canvas);}
  return flagCache.get(key);
}
function regionErrors(i,ctx) {
  const errors=[];
  if(!i.region) errors.push('region es obligatorio');
  else if(!countryNames.has(String(i.region).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()))errors.push(`región desconocida: ${i.region}`);
  else if(ctx.territories?.country && !ctx.territories.country(i.region))errors.push(`región desconocida: ${i.region}`);
  else if(ctx.geo?.region && !ctx.geo.region(i.region))errors.push(`región desconocida: ${i.region}`);
  if(i.opacity!=null && (!Number.isFinite(i.opacity)||i.opacity<0||i.opacity>1))errors.push('opacity debe estar entre 0 y 1');
  return errors;
}
function flagErrors(i) {
  const errors=[];if(!FLAG_MODES.includes(i.flagMode??'fill'))errors.push('flagMode debe ser fill, marker, both o none');
  if((i.flagMode??'fill')!=='none'&&!i.flag)errors.push('flag es obligatorio');
  if(i.flag&&(i.flagMode??'fill')!=='none'&&!flagCodes.has(String(i.flag).toLowerCase()))errors.push(`bandera desconocida: ${i.flag}`);
  if(i.flagAlign!=null&&!['screen','country'].includes(i.flagAlign)) errors.push('flagAlign debe ser screen o country');
  return errors;
}
function prepareRegion(i,ctx) {
  const territories=ctx.territories,parts=territories?.country(i.region)??[];
  let regions=territories&&geometryCache.get(territories);if(territories&&!regions){regions=new Map();geometryCache.set(territories,regions);}
  let geometry=regions?.get(i.region);
  if(!geometry&&typeof Path2D!=='undefined') {
    const path=new Path2D(),bounds=[Infinity,Infinity,-Infinity,-Infinity];
    for(const p of parts){path.addPath(p.path);for(let n=0;n<2;n++){bounds[n]=Math.min(bounds[n],p.bounds[n]);bounds[n+2]=Math.max(bounds[n+2],p.bounds[n+2]);}}
    geometry={path,bounds,screen:new Map()};regions?.set(i.region,geometry);
  }
  const region=ctx.geo?.region?.(i.region),anchor=ctx.geo?.place?.(i.region)??region?.label;
  const style={...(ctx.look?.highlight??{}),...(i.style??{}),fill:i.color??i.style?.fill??ctx.look?.highlight?.fill??'#399e58',opacity:i.opacity??i.style?.opacity??.8,line:i.line??i.style?.line??ctx.look?.highlight?.line??'#f6edb4',width:i.width??i.style?.width??1.2};
  return {territories,parts,geometry,anchor,style,keys:dated(i,ctx),look:{...ctx.look,borders:{visible:false}},start:resolveTime(ctx,i.t),flag:String(i.flag??'').toLowerCase()};
}
function screenGeometry(internal,view) {
  const geo=internal.geometry;if(!geo)return null;
  const key=view.mercatorToScreen.join(',');if(geo.screen.has(key))return geo.screen.get(key);
  const [a,b,c,d,e,f]=view.mercatorToScreen,path=new Path2D();path.addPath(geo.path,{a,b,c,d,e,f});
  const r=geo.bounds,ps=[[r[0],r[1]],[r[2],r[1]],[r[2],r[3]],[r[0],r[3]]].map(([x,y])=>transform(view.mercatorToScreen,x,y));
  const bounds=[Math.min(...ps.map(p=>p.x)),Math.min(...ps.map(p=>p.y)),Math.max(...ps.map(p=>p.x)),Math.max(...ps.map(p=>p.y))];
  const result={path,bounds,rasters:new Map()};geo.screen.set(key,result);if(geo.screen.size>3)geo.screen.delete(geo.screen.keys().next().value);return result;
}
// Recortes de pantalla: evita rasterizar la frontera completa veinte veces.
// Presupuesto global de 16 Mpx (64 MB RGBA); nunca cambia el resultado de un seek.
function raster(geo,key,v,pad,draw){
  let entry=geo.rasters.get(key);
  if(!entry){const [a,b,c,d]=geo.bounds,x=Math.max(0,Math.floor(a-pad)),y=Math.max(0,Math.floor(b-pad)),w=Math.max(0,Math.min(v.W,Math.ceil(c+pad))-x),h=Math.max(0,Math.min(v.H,Math.ceil(d+pad))-y);
    if(!w||!h)return null;
    const canvas=new OffscreenCanvas(w,h),g=canvas.getContext('2d');g.translate(-x,-y);draw(g);
    entry={canvas,x,y,pixels:w*h,owner:geo,key};geo.rasters.set(key,entry);rasterPixels+=entry.pixels;
  }else rasterLRU.delete(entry);
  rasterLRU.set(entry,true);
  while(rasterPixels>16_000_000&&rasterLRU.size>1){const oldest=rasterLRU.keys().next().value;rasterLRU.delete(oldest);oldest.owner.rasters.delete(oldest.key);rasterPixels-=oldest.pixels;}
  return entry;
}
function drawRaster(g,entry){if(entry)g.drawImage(entry.canvas,entry.x,entry.y);}
function inheritedFill(g,s,v,e,extra={}) {
  const n=s.internal;if(!n?.parts?.length)return;
  // Una única implementación del relleno: se delega al motor existente de Atlas plano.
  n.territories.draw(g,v,[{parts:n.parts,t:-1,dur:.001,border:false,style:{...n.style,fill:color(e,n.style.fill),line:color(e,n.style.line),...extra,opacity:n.style.opacity*(s.alpha??1)}}],0,n.look);
  if(s.item.border!==false){const geo=screenGeometry(n,v);if(geo){g.save();g.globalAlpha=s.alpha??1;g.strokeStyle=color(e,n.style.line);g.lineWidth=n.style.width*e.U;g.stroke(geo.path);g.restore();}}
}
function rawFlagMarker(g,s,v,e,anchor) {
  const i=s.item,n=s.internal,bitmap=flagBitmap(i.flag??n?.flag);if(!bitmap)return;
  const p=anchor??position(s,v,e),scale=(i.scale??1)*e.U,w=(i.flagWidth??78)*scale,h=w*2/3,pole=(i.poleHeight??98)*scale;
  g.save();g.translate(p.x,p.y);g.lineCap='round';g.strokeStyle=color(e,'dark');g.lineWidth=7*scale;g.beginPath();g.moveTo(5*scale,5*scale);g.lineTo(5*scale,-pole+5*scale);g.stroke();g.strokeStyle=color(e,'text');g.lineWidth=3*scale;g.beginPath();g.moveTo(0,0);g.lineTo(0,-pole);g.stroke();
  g.fillStyle=color(e,'dark');g.globalAlpha*=.5;g.beginPath();g.ellipse(4*scale,4*scale,13*scale,5*scale,0,0,Math.PI*2);g.fill();g.globalAlpha/=.5;
  const top=-pole+5*scale;g.strokeStyle=color(e,'dark');g.lineWidth=2*scale;g.strokeRect(0,top,w,h);
  const wave=i.wave??true,strips=wave?16:1;
  for(let x=0;x<strips;x++){const u=x/strips,dy=wave?Math.sin(u*5-s.t*4)*h*.065*u:0;g.drawImage(bitmap,bitmap.width*u,0,bitmap.width/strips,bitmap.height,w*u,top+dy,w/strips+.4*scale,h);}
  g.restore();
}
export function drawFlagMarker(g,s,v,e,anchor){
  const i=s.item,scale=(i.scale??1)*e.U,p=anchor??position(s,v,e),w=(i.flagWidth??78)*scale,pole=(i.poleHeight??98)*scale;
  const key=JSON.stringify([i.flag??s.internal?.flag,scale,w,pole,i.wave!==false,i.wave===false?0:s.t]);
  if(!markerCache.has(key)){const x=-20*scale,y=-pole-8*scale,canvas=new OffscreenCanvas(Math.ceil(w+40*scale),Math.ceil(pole+32*scale)),ctx=canvas.getContext('2d');ctx.translate(-x,-y);rawFlagMarker(ctx,s,v,e,{x:0,y:0});markerCache.set(key,{canvas,x,y});if(markerCache.size>8)markerCache.delete(markerCache.keys().next().value);}
  const cached=markerCache.get(key);g.drawImage(cached.canvas,p.x+cached.x,p.y+cached.y);
}
const regionParams={region:{type:'string',default:'IR'},color:{type:'string',default:'success'},opacity:{type:'number',default:.8},border:{type:'boolean',default:true}};
const regionDemo={region:'IR',t:0,dur:6,out:5.5};
Tactico.component('territory.fill',{layer:10,summary:'Envuelve el relleno original de Atlas plano con multiply, screen y overlay.',params:regionParams,states:[],validate:regionErrors,prepare:prepareRegion,draw:inheritedFill,demo:{...regionDemo,type:'territory.fill',color:'success'}});
Tactico.component('territory.flag',{
  layer:10,summary:'Bandera recortada al país, en poste, ambas o ninguna; catálogo original de 148 banderas.',params:{...regionParams,flag:{type:'string',default:'IR'},flagMode:{type:'enum',values:FLAG_MODES,default:'fill'},flagAlign:{type:'enum',values:['screen','country'],default:'screen'},flagWidth:{type:'number',default:78}},states:[],
  validate:(i,c)=>[...regionErrors(i,c),...flagErrors(i)],async prepare(i,c){await flagsReady();return prepareRegion(i,c);},
  draw(g,s,v,e){const i=s.item,mode=i.flagMode??'fill',n=s.internal;if(mode==='none')return;
    if(mode==='fill'||mode==='both'){
      const bitmap=flagBitmap(i.flag),geo=screenGeometry(n,v);if(bitmap&&geo){g.save();g.clip(geo.path,'evenodd');let [x,y,x2,y2]=geo.bounds,w=x2-x,h=y2-y;
        if(i.flagAlign==='country'){const b=n.geometry.bounds;g.setTransform(...v.mercatorToScreen);x=b[0];y=b[1];w=b[2]-x;h=b[3]-y;}
        for(const [blend,mult] of [['multiply',1],['screen',.5],['overlay',.35]]){g.globalCompositeOperation=blend;g.globalAlpha=(s.alpha??1)*(i.opacity??.8)*mult;g.drawImage(bitmap,x,y,w,h);}g.restore();
        if(i.border!==false){g.save();g.strokeStyle=color(e,i.line??'accent');g.lineWidth=1.5*e.U;g.stroke(geo.path);g.restore();}
      }
    }
    if(mode==='marker'||mode==='both'){const p=i.at?position(s,v,e):n.anchor?v.project(...n.anchor):null;if(p)drawFlagMarker(g,s,v,e,p);}
  },demo:{...regionDemo,type:'territory.flag',flag:'IR',flagMode:'both'}
});
Tactico.component('flag.marker',{
  layer:70,summary:'Bandera independiente en mástil, sombra y onda calculada desde el tiempo; admite ancla móvil.',params:{flag:{type:'string',default:'US'},flagWidth:{type:'number',default:78},poleHeight:{type:'number',default:98},wave:{type:'boolean',default:true}},states:[],validate:i=>flagErrors({...i,flagMode:'marker'}),async prepare(){await flagsReady();return {};},draw:drawFlagMarker,demo:{type:'flag.marker',at:[53,27],flag:'US',t:0,dur:6,out:5.5}
});
Tactico.component('territory.hatch',{
  layer:10,summary:'Rayado diagonal de pantalla recortado por costa y huecos del país.',params:{...regionParams,spacing:{type:'number',default:18},width:{type:'number',default:2}},states:[],validate:(i,c)=>[...regionErrors(i,c),...(i.spacing!=null&&i.spacing<4?['spacing debe ser al menos 4']:[])],prepare:prepareRegion,
  draw(g,s,v,e){const geo=screenGeometry(s.internal,v);if(!geo)return;const i=s.item,spacing=Math.max(4,Math.round((i.spacing??18)*e.U)),key=`${spacing}/${i.width??2}/${color(e,i.color??'accent')}`;if(!hatchCache.has(key)){const c=new OffscreenCanvas(spacing,spacing),h=c.getContext('2d');h.strokeStyle=color(e,i.color??'accent');h.lineWidth=(i.width??2)*e.U;for(let k=-1;k<2;k++){h.beginPath();h.moveTo(k*spacing,0);h.lineTo((k+1)*spacing,spacing);h.stroke();}hatchCache.set(key,c);if(hatchCache.size>32)hatchCache.delete(hatchCache.keys().next().value);}
    g.save();g.globalAlpha*=i.opacity??.7;g.fillStyle=g.createPattern(hatchCache.get(key),'repeat');g.fill(geo.path,'evenodd');g.restore();},demo:{...regionDemo,type:'territory.hatch',color:'accent'}
});
Tactico.component('territory.glow',{
  layer:10,summary:'Borde neón de tres trazos sin desenfoque costoso por cuadro.',params:{...regionParams,width:{type:'number',default:2},pulse:{type:'boolean',default:true}},states:[],validate:regionErrors,prepare:prepareRegion,
  draw(g,s,v,e){const geo=screenGeometry(s.internal,v);if(!geo)return;const i=s.item,width=(i.width??2)*e.U,tone=color(e,i.color??'accent'),texture=raster(geo,`glow/${width}/${tone}`,v,width*6,h=>{h.lineJoin='round';h.strokeStyle=tone;for(const [w,alpha] of [[10,.09],[5,.22],[1,1]]){h.lineWidth=width*w;h.globalAlpha=alpha;h.stroke(geo.path);}});g.save();g.globalAlpha=(s.alpha??1)*(i.pulse===false?1:.78+.22*Math.sin(s.t*2.4));drawRaster(g,texture);g.restore();},demo:{...regionDemo,type:'territory.glow',color:'cyan'}
});
Tactico.component('territory.extrude',{
  layer:10,summary:'Losa geográfica con canto y sombra desplazados en píxeles de pantalla.',params:{...regionParams,depth:{type:'number',default:16},offset:{type:'array',default:[10,16]}},states:[],validate:regionErrors,prepare:prepareRegion,
  draw(g,s,v,e){const geo=screenGeometry(s.internal,v);if(!geo)return;const i=s.item,o=i.offset??[10,i.depth??16];g.save();g.fillStyle=color(e,'dark');for(let step=4;step>0;step--){g.save();g.translate(o[0]*e.U*step/4,o[1]*e.U*step/4);g.globalAlpha*=(step===4?.65:.9);g.fill(geo.path,'evenodd');g.restore();}g.restore();inheritedFill(g,s,v,e);},demo:{...regionDemo,type:'territory.extrude',region:'IQ',color:'danger'}
});
const STATUS=['normal','ocupado','disputado','liberado'];
function stateColor(state,i){return i.stateColors?.[state]??({normal:i.color??'success',ocupado:'danger',disputado:'accent',liberado:'success'})[state]??'success';}
function hexMix(a,b,u){if(!/^#[\da-f]{6}$/i.test(a)||!/^#[\da-f]{6}$/i.test(b))return u<.5?a:b;return '#'+[1,3,5].map(k=>Math.round(parseInt(a.slice(k,k+2),16)*(1-u)+parseInt(b.slice(k,k+2),16)*u).toString(16).padStart(2,'0')).join('');}
Tactico.component('territory.state',{
  layer:10,summary:'Cambio territorial fechado, con color interpolado y barrido direccional o radial.',params:{...regionParams,state:{type:'enum',values:STATUS,default:'normal'},transition:{type:'enum',values:['color','wipe','radial'],default:'wipe'},direction:{type:'enum',values:['east','west','north','south'],default:'east'},stateColors:{type:'object',default:{}}},states:STATUS,
  validate:(i,c)=>[...regionErrors(i,c),...((i.states??[]).some(k=>!STATUS.includes(k.state))?['estado territorial desconocido']:[]),...(i.transition&&!['color','wipe','radial'].includes(i.transition)?['transition desconocida']:[])],prepare:prepareRegion,
  draw(g,s,v,e){const i=s.item,n=s.internal;let from=i.state??'normal',to=from,u=1;for(const k of n.keys)if(s.t>=k.at){from=to;to=k.state;u=transitionAt(s.t,k);}
    const a=color(e,stateColor(from,i)),b=color(e,stateColor(to,i));
    if(i.transition==='color'||u>=1){inheritedFill(g,s,v,e,{fill:hexMix(a,b,u)});return;}
    inheritedFill(g,s,v,e,{fill:a});const geo=screenGeometry(n,v);if(!geo)return;const [x,y,x2,y2]=geo.bounds,w=x2-x,h=y2-y,dir=i.direction??'east';g.save();g.beginPath();
    if(i.transition==='radial')g.arc((x+x2)/2,(y+y2)/2,Math.hypot(w,h)*.5*u,0,Math.PI*2);
    else if(dir==='west')g.rect(x2-w*u,y,w*u,h);else if(dir==='north')g.rect(x,y2-h*u,w,h*u);else if(dir==='south')g.rect(x,y,w,h*u);else g.rect(x,y,w*u,h);
    g.clip();inheritedFill(g,s,v,e,{fill:hexMix(a,b,u)});g.restore();},demo:{...regionDemo,type:'territory.state',region:'IQ',states:[{at:1,state:'disputado',dur:1},{at:3,state:'ocupado',dur:1},{at:4.5,state:'liberado',dur:.8}],transition:'wipe',note:'Estados sintéticos: no describen hechos históricos.'}
});
