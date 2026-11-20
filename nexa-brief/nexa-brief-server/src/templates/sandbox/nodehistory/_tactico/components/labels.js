import {Tactico} from '../core.js';
import {ease} from '../util.js';

// Helpers compartidos por estas tres familias; no sustituyen al núcleo.
export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const smooth = v => { v = clamp(v); return v * v * (3 - 2 * v); };
export const transitionAt = (t,k,d=.35) => (k.dur??d)===0?1:ease(k.ease??'inOut',clamp((t-k.at)/(k.dur??d)));
export const color = (env, key = 'text') => env.palette?.[key] || ({text:'#e9e3ba', dark:'#081e2c', accent:'#f6edb4', success:'#399e58', cyan:'#084c68', danger:'#f6edb4'})[key] || key;
export const resolveTime = (ctx, value, fallback = 0) => ctx.T ? ctx.T(value, fallback) : Number.isFinite(value) ? value : fallback;
export function dated(item, ctx) {
  return (item.states || []).map(k => ({...k, at:resolveTime(ctx, k.at, NaN)})).sort((a,b) => a.at-b.at);
}
export function position(s, view, env) {
  const item=s.item;
  if (item.screen) return {x:item.screen[0]*env.W, y:item.screen[1]*env.H};
  const p=s.pos || item.at;
  if (Array.isArray(p)) return view.project(p[0],p[1]);
  if (p?.lon!=null) return view.project(p.lon,p.lat);
  if (p?.x!=null) return p;
  return {x:env.W/2,y:env.H*.44};
}
if(typeof document!=='undefined') {
  const face=new FontFace('AtlasDisplay',`url(${new URL('../../../../_tools/explainer-kit/vendor/fonts/Archivo-900.ttf',import.meta.url)})`,{weight:'800 900'});
  document.fonts.add(await face.load());
}
const font = (env, size, weight = 800) => {
  const family=env.font?.('display');
  return `${weight} ${size}px ${!family||family==='display'?'AtlasDisplay, sans-serif':family}`;
};
const safe = env => ({left:24*env.U, right:env.W-24*env.U, top:env.H*.08+8*env.U, bottom:env.H*.8-8*env.U});
function splitLines(g, text, width) {
  const lines=[]; let line='';
  for (const word of String(text).split(/\s+/)) {
    if (g.measureText(word).width>width) {
      if(line) lines.push(line); line='';
      for(const char of Array.from(word)) {
        if(line && g.measureText(line+char).width>width) {lines.push(line);line='';}
        line+=char;
      }
    } else if(line && g.measureText(line+' '+word).width>width) {lines.push(line);line=word;}
    else line+=(line?' ':'')+word;
  }
  if(line) lines.push(line);
  return lines.length?lines:[''];
}
export function fit(g, text, width, height, size, env) {
  let lines=[];
  for (let pass=0;pass<200;pass++) {
    g.font=font(env,size); lines=splitLines(g,text,width);
    if(lines.length*size*1.18<=height && lines.every(line=>g.measureText(line).width<=width)) break;
    size*=.87;
  }
  return {lines,size,lineHeight:size*1.18, width:Math.min(width, Math.max(...lines.map(x=>g.measureText(x).width)))};
}
export function ink(g, text, x, y, size, env, tone='text', align='center') {
  g.font=font(env,size); g.textAlign=align; g.textBaseline='middle'; g.lineJoin='round';
  g.strokeStyle=color(env,'dark');g.lineWidth=Math.max(2*env.U,size*.11);g.strokeText(String(text),x,y);
  g.fillStyle=color(env,tone);g.fillText(String(text),x,y);
}
export function chip(g, text, anchor, env, opts={}) {
  const b=safe(env), pad=(opts.padding??15)*env.U;
  const width=Math.max(1,Math.min((opts.width??480)*env.U,b.right-b.left)-pad*2);
  const f=fit(g,text,width,Math.min((opts.height??180)*env.U,b.bottom-b.top)-pad*2,(opts.size??30)*env.U,env);
  const w=f.width+pad*2,h=f.lines.length*f.lineHeight+pad*2;
  const x=clamp(anchor.x,b.left+w/2,b.right-w/2),y=clamp(anchor.y,b.top+h/2,b.bottom-h/2);
  g.save();g.translate(x,y);g.fillStyle=color(env,'dark');g.strokeStyle=color(env,opts.color??'accent');g.lineWidth=1.5*env.U;
  g.beginPath();g.roundRect(-w/2,-h/2,w,h,8*env.U);g.fill();g.stroke();
  f.lines.forEach((line,i)=>ink(g,line,0,(i-(f.lines.length-1)/2)*f.lineHeight,f.size,env,opts.color??'text'));
  g.restore();return {x,y,w,h};
}
function labelValidate(item) {
  const errors=[];
  if(!String(item.text||item.label||'').trim()) errors.push('text o label es obligatorio');
  if(item.size!=null && (!(item.size>0)||!Number.isFinite(item.size))) errors.push('size debe ser positivo y finito');
  if(item.screen && (!Array.isArray(item.screen)||item.screen.length!==2||item.screen.some(x=>!Number.isFinite(x)||x<0||x>1))) errors.push('screen debe ser [x,y] normalizado');
  for(const key of ['width','height'])if(item[key]!=null&&(!(item[key]>0)||!Number.isFinite(item[key])))errors.push(`${key} debe ser positivo y finito`);
  return errors;
}
const baseParams={text:{type:'string',default:''},size:{type:'number',default:42},width:{type:'number',default:650},height:{type:'number',default:220},color:{type:'string',default:'text'},fit:{type:'boolean',default:true},screen:{type:'array',default:null}};
function textBlock(g,s,view,env,opts={}) {
  const p=position(s,view,env),i=s.item,b=safe(env), angle=(i.rotation??0)*Math.PI/180;
  // Conserva toda la caja rotada dentro de la zona segura.
  const c=Math.abs(Math.cos(angle)),q=Math.abs(Math.sin(angle));
  let w=Math.min((i.width??opts.width??650)*env.U,b.right-b.left),h=Math.min((i.height??opts.height??220)*env.U,b.bottom-b.top);
  const scale=Math.min(1,(b.right-b.left)/(w*c+h*q),(b.bottom-b.top)/(w*q+h*c));w*=scale;h*=scale;
  const fitText=fit(g,i.text||i.label||'',w,h,(i.size??opts.size??42)*env.U,env),hh=fitText.lines.length*fitText.lineHeight;
  const ex=(w*c+hh*q)/2,ey=(w*q+hh*c)/2;
  g.save();g.translate(clamp(p.x,b.left+ex,b.right-ex),clamp(p.y,b.top+ey,b.bottom-ey));g.rotate(angle);
  if(opts.neon) {g.shadowColor=color(env,i.color??'accent');g.shadowBlur=12*env.U;}
  fitText.lines.forEach((line,n)=>ink(g,line,0,(n-(fitText.lines.length-1)/2)*fitText.lineHeight,fitText.size,env,i.color??opts.color??'text'));
  g.restore();
}
Tactico.component('label.callout',{
  layer:70,summary:'Ficha ajustada a zona segura con guía, estrella vectorial y escritura progresiva.',params:{...baseParams,size:{type:'number',default:32},offset:{type:'array',default:[110,-100]},reveal:{type:'number',default:.65}},states:[],validate:labelValidate,
  draw(g,s,v,e){const p=position(s,v,e),i=s.item,o=i.offset??[110,-100],full=String(i.text||i.label||''),text=Array.from(full).slice(0,Math.ceil(Array.from(full).length*clamp(s.lt/(i.reveal??.65)))).join('');
    // La caja se mide con el texto entero: no salta mientras se escribe.
    const box=chip(g,full,{x:p.x+o[0]*e.U,y:p.y+o[1]*e.U},e,{...i,color:i.color??'cyan',size:i.size??32});
    g.save();g.beginPath();g.rect(box.x-box.w/2+4*e.U,box.y-box.h/2+4*e.U,box.w-8*e.U,box.h-8*e.U);g.clip();g.fillStyle=color(e,'dark');g.fillRect(box.x-box.w/2+4*e.U,box.y-box.h/2+4*e.U,box.w-8*e.U,box.h-8*e.U);
    const f=fit(g,text,box.w-30*e.U,box.h-20*e.U,(i.size??32)*e.U,e);f.lines.forEach((l,n)=>ink(g,l,box.x,box.y+(n-(f.lines.length-1)/2)*f.lineHeight,f.size,e,i.color??'cyan'));g.restore();
    g.save();g.strokeStyle=color(e,i.color??'cyan');g.lineWidth=2*e.U;g.beginPath();g.moveTo(p.x,p.y);g.lineTo(box.x,box.y+box.h/2+16*e.U);g.lineTo(box.x,box.y+box.h/2);g.stroke();g.fillStyle=color(e,'accent');g.beginPath();for(let n=0;n<10;n++){const a=-Math.PI/2+n*Math.PI/5,r=(n%2?4:10)*e.U;g.lineTo(p.x+Math.cos(a)*r,p.y+Math.sin(a)*r);}g.closePath();g.fill();g.restore();},
  demo:{type:'label.callout',at:[53,27],text:'Unidad de demostración',offset:[100,-120],t:0,dur:6,out:5.5}
});
Tactico.component('label.neon',{layer:70,summary:'Rótulo neón con contorno oscuro, rotación y ajuste de líneas.',params:{...baseParams,size:{type:'number',default:64},color:{type:'string',default:'accent'},rotation:{type:'number',default:0}},states:[],validate:labelValidate,draw:(g,s,v,e)=>textBlock(g,s,v,e,{neon:true,size:64,color:'accent'}),demo:{type:'label.neon',at:[54,32],text:'IRÁN',color:'cyan',size:78,t:0,dur:6,out:5.5}});
Tactico.component('label.chip',{layer:70,summary:'Fecha o ficha pequeña con borde y texto ajustado.',params:{...baseParams,size:{type:'number',default:30}},states:[],validate:labelValidate,draw:(g,s,v,e)=>chip(g,s.item.text||s.item.label,position(s,v,e),e,s.item),demo:{type:'label.chip',at:[56.4,26.5],text:'ESTRECHO DE ORMUZ',t:0,dur:6,out:5.5}});
Tactico.component('label.figure',{
  layer:70,summary:'Cifra grande con unidad y procedencia obligatoria; no genera valores.',params:{...baseParams,size:{type:'number',default:96},value:{type:'number',default:null},unit:{type:'string',default:''},source:{type:'string',default:''},rotation:{type:'number',default:-8}},states:[],
  validate(i){return [...labelValidate({...i,text:String(i.value??'')}),...(!Number.isFinite(i.value)?['value debe ser una cifra explícita']:[]),...(!String(i.source??'').trim()?['source es obligatorio para la cifra']:[])];},
  draw(g,s,v,e){textBlock(g,{...s,item:{...s.item,text:`${s.item.value} ${s.item.unit??''}`,rotation:s.item.rotation??-8}},v,e,{size:96,height:280});},demo:{type:'label.figure',screen:[.5,.48],value:4,unit:'países',source:'Los cuatro países de scene-territorios.json; dato de la demostración',t:0,dur:6,out:5.5}
});
Tactico.component('text.year',{layer:90,summary:'Año gigante con contorno, giro y ajuste dentro del encuadre.',params:{...baseParams,size:{type:'number',default:180},rotation:{type:'number',default:0}},states:[],validate:labelValidate,draw:(g,s,v,e)=>textBlock(g,s,v,e,{size:180,height:300,width:900}),demo:{type:'text.year',screen:[.5,.24],text:'1987',size:180,t:0,dur:6,out:5.5,note:'Año ilustrativo; no representa un cambio territorial.'}});
Tactico.component('badge.count',{
  layer:90,summary:'Contador circular con dígitos rodantes y valores explícitos por estados fechados.',params:{value:{type:'number',default:0},radius:{type:'number',default:66},color:{type:'string',default:'success'}},states:['count'],
  validate(i){const values=[i.value??0,...(i.states??[]).map(k=>k.value)];return values.every(x=>Number.isSafeInteger(x)&&x>=0&&x<=999999)?[]:['value de contador y estados debe ser entero entre 0 y 999999'];},
  prepare:(i,c)=>({keys:dated(i,c)}),
  draw(g,s,v,e){const i=s.item,keys=s.internal?.keys??[],p=position(s,v,e),b=safe(e);let from=i.value??0,to=from,u=1;
    for(const k of keys)if(s.t>=k.at){from=to;to=k.value;u=transitionAt(s.t,k);}
    const digits=String(Math.max(from,to)).length,r=Math.min((i.radius??66)*e.U,(b.right-b.left)/2,(b.bottom-b.top)/2),cx=clamp(p.x,b.left+r,b.right-r),cy=clamp(p.y,b.top+r,b.bottom-r),size=Math.min(r*1.08,r*1.55/digits),step=size*.64;
    g.save();g.translate(cx,cy);g.fillStyle=color(e,'dark');g.strokeStyle=color(e,i.color??'success');g.lineWidth=5*e.U;g.beginPath();g.arc(0,0,r,0,Math.PI*2);g.fill();g.stroke();g.beginPath();g.rect(-r*.83,-size*.62,r*1.66,size*1.24);g.clip();
    const a=String(from).padStart(digits,'0'),z=String(to).padStart(digits,'0');for(let n=0;n<digits;n++){const x=(n-(digits-1)/2)*step;if(a[n]===z[n]||u>=1)ink(g,z[n],x,0,size,e,'text');else{const dir=to>=from?1:-1;ink(g,a[n],x,-u*size*1.3*dir,size,e,'text');ink(g,z[n],x,(1-u)*size*1.3*dir,size,e,'text');}}g.restore();},
  demo:{type:'badge.count',screen:[.5,.35],value:2,states:[{at:2,state:'count',value:3,dur:.8}],t:0,dur:6,out:5.5,note:'Contador sintético para demostrar la animación.'}
});
const ICONS={
  plane:'M 0 -30 L 7 -7 L 29 10 L 29 17 L 7 9 L 5 25 L 13 30 L 13 34 L 0 30 L -13 34 L -13 30 L -5 25 L -7 9 L -29 17 L -29 10 L -7 -7 Z',
  ship:'M -31 10 L 31 10 L 21 30 L -19 30 Z M -19 6 L -19 -10 L 17 -10 L 17 6 Z M -6 -14 L -6 -28 L 3 -28 L 3 -14 Z',
  oil:'M -20 -25 L 20 -25 L 24 -17 L 24 23 L 18 29 L -18 29 L -24 23 L -24 -17 Z M -22 -11 L 22 -11 M -22 14 L 22 14',
  building:'M -26 30 L -26 -16 L 0 -30 L 26 -16 L 26 30 Z M -13 -7 L -13 19 M 0 -7 L 0 19 M 13 -7 L 13 19 M -33 31 L 33 31',
  shield:'M 0 -30 L 28 -19 L 24 10 Q 18 26 0 35 Q -18 26 -24 10 L -28 -19 Z M -12 0 L -2 12 L 17 -10',
  star:'M 0 -32 L 9 -10 L 32 -9 L 14 6 L 20 30 L 0 17 L -20 30 L -14 6 L -32 -9 L -9 -10 Z'
};
const iconCache=new Map();
Tactico.component('icon.badge',{
  layer:70,summary:'Medallón vectorial propio: avión, barco, petróleo, edificio, escudo o estrella.',params:{icon:{type:'enum',values:Object.keys(ICONS),default:'ship'},radius:{type:'number',default:60},color:{type:'string',default:'accent'}},states:[],validate:i=>ICONS[i.icon??'ship']?[]:['icon desconocido'],
  draw(g,s,v,e){const i=s.item,p=position(s,v,e),b=safe(e),r=Math.min((i.radius??60)*e.U,(b.right-b.left)/2,(b.bottom-b.top)/2);g.save();g.translate(clamp(p.x,b.left+r,b.right-r),clamp(p.y,b.top+r,b.bottom-r));g.fillStyle=color(e,'dark');g.strokeStyle=color(e,i.color??'accent');g.lineWidth=3*e.U;g.beginPath();g.arc(0,0,r,0,Math.PI*2);g.fill();g.stroke();g.scale(r/52,r/52);const name=i.icon??'ship';if(!iconCache.has(name))iconCache.set(name,new Path2D(ICONS[name]));g.lineWidth=3;g.lineJoin='round';g.stroke(iconCache.get(name));g.restore();},demo:{type:'icon.badge',screen:[.5,.4],icon:'ship',t:0,dur:6,out:5.5}
});
