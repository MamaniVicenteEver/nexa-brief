import {Tactico} from '../core.js';

// Geometría isométrica dibujada una vez; el cuadro solo compone bitmaps.
const defaults={ink:'#081e2c',ground:'#399e58',roof:'#e9e3ba',wall:'#8b999b',side:'#47595c',metal:'#bac9ca',accent:'#f6edb4',fire:'#ef8138',smoke:'#47595c',water:'#084c68'};
const cache=new Map();
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function palette(ctx){return {...defaults,...ctx.palette,...ctx.scene?.defs?.palette,ink:ctx.scene?.defs?.palette?.ink??ctx.palette?.dark??ctx.palette?.background??defaults.ink};}
function canvas(w,h){const c=typeof OffscreenCanvas==='function'?new OffscreenCanvas(w,h):Object.assign(document.createElement('canvas'),{width:w,height:h});return c;}
function polygon(g,points,color,stroke){g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fillStyle=color;g.fill();if(stroke){g.strokeStyle=stroke;g.lineWidth=1.7;g.stroke();}}
const iso=(x,y,z=0)=>[x-y,(x+y)*.48-z];
function box(g,x,y,w,d,h,p){
 const a=iso(x,y,h),b=iso(x+w,y,h),c=iso(x+w,y+d,h),e=iso(x,y+d,h),aa=iso(x,y),bb=iso(x+w,y),cc=iso(x+w,y+d),ee=iso(x,y+d);
 polygon(g,[e,c,cc,ee],p.side,p.ink);polygon(g,[b,c,cc,bb],p.wall,p.ink);polygon(g,[a,b,c,e],p.roof,p.ink);
}
function tank(g,x,y,r,h,p){
 const [a,b]=iso(x,y);g.fillStyle=p.wall;g.strokeStyle=p.ink;g.lineWidth=1.8;g.beginPath();g.ellipse(a,b,r,r*.48,0,0,Math.PI);g.lineTo(a-r,b-h);g.ellipse(a,b-h,r,r*.48,0,Math.PI,2*Math.PI);g.closePath();g.fill();g.stroke();
 g.fillStyle=p.metal;g.beginPath();g.ellipse(a,b-h,r,r*.48,0,0,2*Math.PI);g.fill();g.stroke();g.strokeStyle=p.side;g.beginPath();g.ellipse(a,b-h,r*.66,r*.32,0,0,2*Math.PI);g.stroke();
}
function pipe(g,points,p,width=4){g.beginPath();points.map(([x,y,z])=>iso(x,y,z)).forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.lineWidth=width+2;g.strokeStyle=p.ink;g.stroke();g.lineWidth=width;g.strokeStyle=p.metal;g.stroke();}
function tower(g,x,y,h,p){
 const a=iso(x,y);g.lineWidth=4;g.strokeStyle=p.ink;g.beginPath();g.moveTo(a[0]-15,a[1]);g.lineTo(a[0],a[1]-h);g.lineTo(a[0]+15,a[1]);g.stroke();
 g.lineWidth=2;g.strokeStyle=p.accent;for(let i=0;i<4;i++){const v=i/4;g.beginPath();g.moveTo(a[0]-15*(1-v),a[1]-h*v);g.lineTo(a[0]+15*(1-v-.24),a[1]-h*(v+.24));g.stroke();}
}
function asset(kind,state,p){
 const key=JSON.stringify([kind,state,p]);if(cache.has(key))return cache.get(key);
 const c=canvas(440,360),g=c.getContext('2d');g.translate(220,180);
 // Sombra sin filtro de desenfoque durante la reproducción.
 polygon(g,[[-164,34],[-10,110],[181,32],[27,-46]],p.ink);g.save();g.translate(0,-10);
 const dark=state==='ruined';const mat=dark?{...p,roof:p.side,wall:p.ink,metal:p.side,ground:p.side}:p;
 box(g,-76,-76,152,152,9,{...mat,roof:kind==='port'||kind==='platform'?p.side:mat.ground});
 if(state==='ruined'){
  for(let i=0;i<9;i++)box(g,-62+(i%3)*44,-48+Math.floor(i/3)*41,18+(i%2)*14,24,8+(i%3)*9,mat);
  pipe(g,[[-55,-30,0],[0,-30,14],[32,16,2]],mat,5);
 }else if(kind==='plant'){
  box(g,-53,-30,70,64,48,mat);tank(g,39,-16,24,30,mat);tank(g,42,39,24,30,mat);
  // Torre de enfriamiento y chimenea, distintas de una refinería.
  const [x,y]=iso(-30,-50);polygon(g,[[x-17,y],[x-12,y-51],[x+12,y-51],[x+17,y]],mat.wall,p.ink);g.fillStyle=mat.metal;g.beginPath();g.ellipse(x,y-51,12,5,0,0,Math.PI*2);g.fill();g.strokeStyle=p.ink;g.stroke();
  box(g,8,-58,12,12,80,{...mat,roof:p.accent});
 }else if(kind==='refinery'){
  tank(g,-43,-35,23,29,mat);tank(g,-42,29,22,29,mat);box(g,11,0,42,42,32,mat);
  for(const [x,y,h] of [[6,-47,72],[34,-40,91],[57,-21,62]]){tank(g,x,y,8,h,mat);pipe(g,[[x,y,h*.8],[x+15,y,h*.8],[x+15,y,10]],mat,3);}
  pipe(g,[[-43,-35,30],[-6,-35,30],[-6,29,10],[33,29,10]],mat);
 }else if(kind==='oilfield'){
  for(const [x,y] of [[-42,-32],[20,-22],[-8,42]]){
   box(g,x-16,y-10,32,20,9,mat);tower(g,x,y,44,mat);const a=iso(x,y,38);
   polygon(g,[[a[0]-27,a[1]-4],[a[0]+24,a[1]-15],[a[0]+28,a[1]-4],[a[0]-24,a[1]+5]],mat.accent,p.ink);
   g.strokeStyle=p.ink;g.lineWidth=3;g.beginPath();g.moveTo(a[0]+27,a[1]-3);g.lineTo(a[0]+27,a[1]+38);g.stroke();
  }
  tank(g,47,46,17,23,mat);
 }else if(kind==='port'){
  // Terminal con depósitos y muelle; Kharg no se presenta como refinería.
  tank(g,-37,-35,25,28,mat);tank(g,19,-38,25,28,mat);box(g,-48,17,62,28,23,mat);
  box(g,40,12,20,118,9,{...mat,roof:mat.metal});pipe(g,[[13,-37,12],[50,-37,12],[50,115,12]],mat,4);
  for(const y of [45,82]){const a=iso(60,y);g.fillStyle=p.accent;g.fillRect(a[0]-3,a[1]-3,6,6);}
 }else if(kind==='base'){
  box(g,-61,-49,120,30,3,{...mat,roof:p.side});const a=iso(-54,-34),b=iso(52,-34);
  g.setLineDash([8,6]);g.strokeStyle=p.roof;g.lineWidth=2;g.beginPath();g.moveTo(...a);g.lineTo(...b);g.stroke();g.setLineDash([]);
  box(g,-43,7,46,42,29,mat);box(g,18,14,42,34,22,mat);box(g,-7,-6,11,12,62,{...mat,roof:p.accent});
 }else if(kind==='platform'){
  for(const [x,y] of [[-54,-54],[54,-54],[-54,54],[54,54]])box(g,x,y,9,9,35,{...mat,roof:p.accent});
  box(g,-62,-62,124,124,42,{...mat,roof:p.wall});box(g,-46,4,48,41,65,mat);tower(g,35,-25,128,mat);
  const [x,y]=iso(23,34,43);g.strokeStyle=p.accent;g.lineWidth=3;g.beginPath();g.ellipse(x,y,24,12,0,0,Math.PI*2);g.stroke();g.font='bold 17px sans-serif';g.fillStyle=p.roof;g.textAlign='center';g.fillText('H',x,y+5);
 }
 if(state==='hit'||state==='burning'){
  g.fillStyle=p.ink;for(const [x,y,r] of [[-34,-20,21],[9,0,17],[45,-14,12]]){g.beginPath();g.ellipse(x,y,r,r*.5,0,0,Math.PI*2);g.fill();}
 }
 g.restore();cache.set(key,c);return c;
}
function fireSheet(p){
 const key='fire'+JSON.stringify(p);if(cache.has(key))return cache.get(key);
 const frames=[];for(let f=0;f<12;f++){
  const c=canvas(150,200),g=c.getContext('2d');
  for(let i=6;i>=0;i--){g.globalAlpha=.16+(6-i)*.05;g.fillStyle=p.smoke;g.beginPath();g.ellipse(70+Math.sin(i+f*.52)*9,75-i*10,19+i*3,18+i*3,0,0,Math.PI*2);g.fill();}
  g.globalAlpha=1;for(let i=0;i<3;i++){
   const x=38+i*32,h=46+Math.sin(f*.52+i*2)*13;
   polygon(g,[[x-14,174],[x-18,154],[x-6,145],[x-2,174-h],[x+10,145],[x+18,160],[x+10,174]],p.fire);
   polygon(g,[[x-8,174],[x-4,151],[x+7,163],[x+7,174]],p.accent);
  }frames.push(c);
 }cache.set(key,frames);return frames;
}
function position(s,view){const a=s.pos??s.item.at;if(Array.isArray(a))return view.project(...a);if(a&&Number.isFinite(a.lon))return view.project(a.lon,a.lat);return null;}
const params={scale:{type:'number',default:1,min:.15,max:4},zoomScale:{type:'boolean',default:true},label:{type:'string',default:''},labelSize:{type:'number',default:24}};
for(const kind of ['plant','refinery','oilfield','port','base','platform'])Tactico.component('site.'+kind,{
 layer:20,summary:`${{plant:'Planta industrial',refinery:'Refinería con torres y tuberías',oilfield:'Campo petrolero con balancines',port:'Terminal de tanques y muelle',base:'Base con pista y hangares',platform:'Plataforma petrolera elevada'}[kind]}; extrusión, sombra y daño persistente.`,
 params,states:['normal','hit','burning','ruined'],
 validate(item){const errors=[];if(item.scale!=null&&(!Number.isFinite(item.scale)||item.scale<=0||item.scale>4))errors.push('scale debe estar entre 0 y 4');if(item.labelSize!=null&&(!Number.isFinite(item.labelSize)||item.labelSize<12||item.labelSize>60))errors.push('labelSize debe estar entre 12 y 60');if(item.state&&!['normal','hit','burning','ruined'].includes(item.state))errors.push('state no admitido');return errors;},
 animated:s=>s.state==='burning'||s.stateT<1,
 prepare(item,ctx){const p=palette(ctx);return {images:Object.fromEntries(['normal','hit','burning','ruined'].map(state=>[state,asset(kind,state,p)])),fire:fireSheet(p),palette:p,hits:(item.states??[]).filter(k=>k.state==='hit').map(k=>k.at)};},
 draw(g,s,view,env){
  const point=position(s,view);if(!point||point.visible===false)return;
  const scale=(s.item.scale??1)*(s.item.zoomScale===false?1:clamp(2**(((view.zoom??6)-6)*.16),.65,1.45));
  const w=300*env.U*scale,h=w*360/440,p=s.internal.palette,state=s.state??s.item.state??'normal';
  g.save();g.translate(point.x,point.y);
  for(const [name,weight] of Object.entries(s.stateWeights??{[state]:1})){if(weight<=0)continue;g.save();g.globalAlpha*=weight;g.drawImage(s.internal.images[name]??s.internal.images.normal,-w/2,-h/2,w,h);g.restore();}
  const burning=s.stateWeights?.burning??+(state==='burning');
  if(burning>0){const frame=((Math.floor(s.t*12)%12)+12)%12;g.save();g.globalAlpha*=burning;g.drawImage(s.internal.fire[frame],-w*.24,-h*.63,w*.49,h*.8);g.restore();}
  const hit=s.internal.hits.filter(at=>at<=s.t).at(-1);const pulse=hit==null?0:Math.max(0,1-(s.t-hit)/.32);
  if(pulse){g.save();g.globalAlpha*=pulse;g.fillStyle=p.accent;g.beginPath();g.arc(0,-h*.14,w*.16,0,Math.PI*2);g.fill();g.restore();}
  if(s.item.label){g.font=`800 ${(s.item.labelSize??24)*env.U}px ${env.font?.('label')??'sans-serif'}`;g.textAlign='center';g.lineJoin='round';g.lineWidth=6*env.U;g.strokeStyle=p.ink;g.strokeText(s.item.label,0,h*.51);g.fillStyle=p.roof;g.fillText(s.item.label,0,h*.51);}
  g.restore();
 },
 demo:{id:'demo-site-'+kind,type:'site.'+kind,at:[50.33,29.25],label:kind==='port'?'Kharg · terminal':kind==='refinery'?'Abadán · refinería':kind,t:0,dur:8,out:7,states:[{at:3,state:'hit'},{at:3.4,state:'burning'},{at:6,state:'ruined'}]},
});
