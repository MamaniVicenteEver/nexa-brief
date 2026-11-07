import {Tactico} from '../core.js';
import {pathAt} from '../util.js';
import {clamp,smooth,RAD,time,place,prepareMotion,screenPose,stateWeights,ink,text,polygon,motionErrors,motionParams,cachedArt} from './units.js';
import {carrierDeckPose,unitLength} from './naval.js';

const AIR_TYPES={
  'air.bomber':{wing:['air-bomber-wing',.24],swept:['air-bomber-swept',.23]},
  'air.jet':{attack:['air-jet-attack',.12],fighter:['air-jet-fighter',.115]},
  'air.helicopter':{utility:['air-helicopter-body',.09]},
  'air.prop':{transport:['air-prop-transport',.19]},
};
const defaultVariant=type=>Object.keys(AIR_TYPES[type]||{fighter:1})[0];
const AIR_STATES=['normal','active','hit','destroyed'];
const shadows=new Map();
function airSprite(item,env) {
  const [name,relative]=AIR_TYPES[item.type]?.[item.variant||defaultVariant(item.type)]||AIR_TYPES['air.jet'].fighter,sprite=env.sprite(name);
  return {name,sprite,relative:sprite.available?sprite.relativeLength||relative:relative};
}
function shadowImage(record,dark) {
  const key=`${record.name}:${record.sprite.image?.src||record.sprite.available}:${dark}`;if(shadows.has(key))return shadows.get(key);
  if(shadows.size>=64){const first=shadows.keys().next().value;shadows.get(first).close?.();shadows.delete(first);}
  const canvas=new OffscreenCanvas(192,192),g=canvas.getContext('2d',{willReadFrequently:true});record.sprite.draw(g,96,96,{length:150,shadow:false});
  g.globalCompositeOperation='source-in';g.fillStyle=dark;g.fillRect(0,0,192,192);
  const bitmap=canvas.transferToImageBitmap();shadows.set(key,bitmap);return bitmap;
}
async function prepareAircraft(item,ctx) {
  await ctx.loadSprites?.();
  const motion=prepareMotion(item,ctx),def=item.contrail&&Tactico.get('trail.contrail');
  const trailItem=def?{id:`${item.id}-contrail`,type:'trail.contrail',at:item.at,path:motion.path,t:item.t??0,dur:item.dur??8,life:1.5,width:2.5,particles:18,scale:item.scale??1,follow:item.id}:null;
  return {motion,trail:def?{def,item:trailItem,internal:await def.prepare?.(trailItem,ctx)}:null};
}
function aircraftDetails(g,item,L,t,env,available) {
  const c=ink(env);g.save();g.fillStyle=c.gray;g.strokeStyle=c.dark;g.lineWidth=L*.015;
  if(item.type==='air.bomber'&&!available){
    if(item.variant==='wing') {polygon(g,[[0,-L*.5],[L*.59,L*.3],[L*.2,L*.23],[0,L*.38],[-L*.2,L*.23],[-L*.59,L*.3]]);g.fill();g.stroke();}
    else for(const x of [-.25,-.13,.13,.25]){g.fillStyle=c.smoke;g.fillRect(L*x,-L*.02,L*.055,L*.2);}
  }
  if(item.type==='air.helicopter'){
    if(!available){g.fillStyle=c.gray;g.beginPath();g.ellipse(0,-L*.09,L*.15,L*.3,0,0,Math.PI*2);g.fill();g.stroke();g.fillRect(-L*.035,L*.1,L*.07,L*.4);}
    g.rotate(t*25);const rotor=env.sprite('air-helicopter-rotor');
    if(rotor.available)rotor.draw(g,0,-L*.06,{length:L*1.45,shadow:false});
    else {g.globalAlpha*=.65;g.lineWidth=L*.045;g.strokeStyle=c.light;for(let i=0;i<4;i++){g.rotate(Math.PI/2);g.beginPath();g.moveTo(L*.06,0);g.lineTo(L*.7,0);g.stroke();}}
  }
  if(item.type==='air.prop'){g.strokeStyle=c.light;g.lineWidth=L*.025;for(const x of [-.24,.24]){g.save();g.translate(L*x,-L*.06);g.rotate(t*28);g.beginPath();g.moveTo(-L*.1,0);g.lineTo(L*.1,0);g.stroke();g.restore();}}
  if(!available){g.fillStyle=c.dark;g.beginPath();g.ellipse(0,-L*.27,L*.035,L*.07,0,0,Math.PI*2);g.fill();}
  g.restore();
}
export function drawAircraft(g,s,view,env,override) {
  const item=s.item,p=override||screenPose(s,view),record=airSprite(item,env),c=ink(env),U=env.U||1;
  // Physical relative lengths may be enlarged editorially with scale, as in the references.
  const L=override?.length??unitLength(item,p,view,env,record.relative),altitude=override?.altitude??item.altitude??2,shadow=shadowImage(record,c.dark);
  const offset=(10+altitude*12)*U,shadowL=L*(.8+altitude*.1);
  g.save();g.save();g.globalAlpha*=.30/(1+altitude*.08);g.translate(p.x+offset,p.y+offset*1.3);g.rotate(p.angle);g.drawImage(shadow,-shadowL*.64,-shadowL*.64,shadowL*1.28,shadowL*1.28);g.restore();
  g.save();g.translate(p.x,p.y);g.rotate(p.angle);
  const animated=item.type==='air.helicopter'||item.type==='air.prop',size=Math.ceil(L*1.6+4*U),paint=ctx=>{
    record.sprite.draw(ctx,0,0,{length:L,shadow:false,color:item.type==='air.bomber'?c.smoke:c.gray});
    if(!animated)aircraftDetails(ctx,item,L,0,env,record.sprite.available);
  };
  const art=cachedArt(JSON.stringify(['air',record.name,record.sprite.image?.src,L,c]),size,paint);
  if(art)g.drawImage(art,-size/2,-size/2,size,size);else paint(g);
  if(animated)aircraftDetails(g,item,L,s.t,env,record.sprite.available);
  const weights=stateWeights(s,AIR_STATES);
  for(const state of ['hit','destroyed'])if(weights[state]>.001){g.save();g.globalAlpha*=weights[state];record.sprite.draw(g,0,0,{length:L,shadow:false,state,color:state==='hit'?c.light:c.smoke});g.restore();}g.restore();
  if(item.label)text(g,item.label,p.x,p.y+L*.7+15*U,21*U,env,c.light);g.restore();
}
function drawAir(g,s,view,env) {
  const trail=s.internal.trail;
  if(trail){
    const internal=trail.internal,path=internal?.path,begin=path&&Math.max(path.t,s.t-internal.life),end=path&&Math.min(s.t,path.t+path.dur);
    if(path&&end>begin){
      const points=Array.from({length:internal.count+1},(_,i)=>{const p=pathAt(path,begin+(end-begin)*i/internal.count);return view.project(p.lon,p.lat);});
      const pad=40*(env.U||1),xs=points.map(p=>p.x),ys=points.map(p=>p.y),left=Math.min(...xs)-pad,top=Math.min(...ys)-pad;
      // Screen blending otherwise touches the full software surface for each segment.
      g.save();g.beginPath();g.rect(left,top,Math.max(...xs)+pad-left,Math.max(...ys)+pad-top);g.clip();
      trail.def.draw(g,{...s,item:trail.item,internal},view,env);g.restore();
    }
  }
  drawAircraft(g,s,view,env);
}
function jetUnit(unit) {const [,variant]=String(unit||'air.jet:fighter').split(':');return {type:'air.jet',variant:variant==='a6'?'attack':variant==='attack'?'attack':'fighter'};}
async function prepareAction(item,ctx) {
  await ctx.loadSprites?.();
  const carrierRef=item.carrier||item.from||item.at,carrier=typeof carrierRef==='object'&&!Array.isArray(carrierRef)?carrierRef:ctx.scene?.items?.find(i=>i.id===carrierRef);
  return {motion:prepareMotion(item,ctx),carrier,carrierMotion:carrier?prepareMotion(carrier,ctx):null,target:place(item.to,ctx),source:place(item.from,ctx),jet:jetUnit(item.unit)};
}
function bezier(points,u) {let p=points.map(p=>({...p}));while(p.length>1)p=p.slice(1).map((b,i)=>({x:p[i].x+(b.x-p[i].x)*u,y:p[i].y+(b.y-p[i].y)*u}));return p[0];}
function cubicPose(points,u){const p=bezier(points,u),a=bezier(points,Math.max(0,u-1e-4)),b=bezier(points,Math.min(1,u+1e-4));return {...p,angle:Math.atan2(b.x-a.x,a.y-b.y)};}
export function actionPose(s,view,env,index=0) {
  const {carrier,carrierMotion,target,source}=s.internal,item=s.item,start=(s.internal.motion.start||0)+index*(item.interval??.65),age=s.t-start;
  const duration=item.flightDur??3.8,deckTime=item.deckDur??.75;
  if(!carrier||age<0||age>duration+deckTime)return null;
  const recover=item.type==='air.recover',deck=carrierDeckPose(carrier,carrierMotion,s.t,view,env);
  const deckSize=deck.length*.062,airSize=Math.max(deckSize,32*(env.U||1)*(item.scale??1));
  if(!recover&&age<=deckTime){
    const u=(age/deckTime)**2;return {x:deck.stern.x+(deck.bow.x-deck.stern.x)*u,y:deck.stern.y+(deck.bow.y-deck.stern.y)*u,angle:deck.deckAngle,length:deckSize,altitude:0,phase:'deck',progress:u};
  }
  if(recover&&age>=duration){
    const u=1-(1-clamp((age-duration)/deckTime))**2;
    return {x:deck.stern.x+(deck.bow.x-deck.stern.x)*u,y:deck.stern.y+(deck.bow.y-deck.stern.y)*u,angle:deck.deckAngle,length:deckSize,altitude:0,phase:'deck',progress:u};
  }
  if(recover){
    // Predicted deck at touchdown, recomputed from absolute time; reverse the angled-deck direction.
    const touch=carrierDeckPose(carrier,carrierMotion,start+duration,view,env),p0=source?view.project(...source):{x:touch.stern.x-Math.sin(touch.deckAngle)*700*(env.U||1),y:touch.stern.y+Math.cos(touch.deckAngle)*700*(env.U||1)},p3=touch.stern;
    const distance=Math.hypot(p3.x-p0.x,p3.y-p0.y),p1={x:p0.x+(p3.x-p0.x)*.35,y:p0.y+(p3.y-p0.y)*.35},p2={x:p3.x-Math.sin(touch.deckAngle)*distance*.3,y:p3.y+Math.cos(touch.deckAngle)*distance*.3},u=clamp(age/duration);
    return {...cubicPose([p0,p1,p2,p3],u),length:airSize+(deckSize-airSize)*smooth(u),altitude:(item.altitude??2)*(1-u),phase:'flight',progress:u};
  }
  const release=carrierDeckPose(carrier,carrierMotion,start+deckTime,view,env),p0=release.bow,p3=target?view.project(...target):{x:p0.x+Math.sin(release.deckAngle)*900*(env.U||1),y:p0.y-Math.cos(release.deckAngle)*900*(env.U||1)},distance=Math.hypot(p3.x-p0.x,p3.y-p0.y);
  const control=Math.max(release.length*.7,Math.min(distance*.32,550*(env.U||1))),p1={x:p0.x+Math.sin(release.deckAngle)*control,y:p0.y-Math.cos(release.deckAngle)*control},p2={x:p3.x-(p3.x-p0.x)*.24,y:p3.y-(p3.y-p0.y)*.24},u=clamp((age-deckTime)/duration);
  return {...cubicPose([p0,p1,p2,p3],u),length:deckSize+(airSize-deckSize)*smooth(u*3),altitude:(item.altitude??2)*smooth(u*3),phase:'flight',progress:u};
}
function drawAction(g,s,view,env) {
  const c=ink(env);for(let i=0;i<(s.item.count??1);i++){
    const p=actionPose(s,view,env,i);if(!p)continue;
    g.save();if(p.phase==='flight'&&s.item.type==='air.launch'){
      for(let k=1;k<=8;k++){const prev=actionPose({...s,t:s.t-k*.035},view,env,i),next=actionPose({...s,t:s.t-(k-1)*.035},view,env,i);if(!prev||!next||prev.phase!=='flight')continue;
        g.save();g.globalAlpha*=.55*(1-k/9);g.strokeStyle=c.light;g.lineWidth=2*(env.U||1);g.beginPath();g.moveTo(prev.x,prev.y);g.lineTo(next.x,next.y);g.stroke();g.restore();}
    }
    if(p.phase==='flight')g.globalAlpha*=1-smooth((p.progress-.92)/.08)*(s.item.type==='air.launch'?1:0);
    if(p.phase==='deck'&&s.item.type==='air.recover')g.globalAlpha*=1-smooth((p.progress-.8)/.2);
    drawAircraft(g,{...s,item:{...s.internal.jet,scale:s.item.scale??1}},view,env,p);g.restore();
  }
}
function validateAction(item,ctx) {
  const errors=motionErrors(item,ctx),carrier=item.carrier||item.at,found=typeof carrier==='object'?carrier:ctx.scene?.items?.find(i=>i.id===carrier);
  if(!found||found.type!=='naval.carrier')errors.push('air.launch/recover requiere carrier con id de naval.carrier');
  if(item.type==='air.launch'&&!place(item.to,ctx))errors.push('air.launch requiere to resoluble');
  if(item.interval!=null&&!(item.interval>0))errors.push('interval debe ser positivo');
  for(const key of ['deckDur','flightDur'])if(item[key]!=null&&!(item[key]>0))errors.push(`${key} debe ser positivo`);
  if(item.unit&&!/^air\.jet:(a6|attack|fighter)$/.test(item.unit))errors.push('unit debe ser air.jet:a6, air.jet:attack o air.jet:fighter');
  return errors;
}
for(const type of Object.keys(AIR_TYPES))Tactico.component(type,{
  layer:50,domain:'air',summary:({'air.bomber':'Bombardero de ala volante o alas en flecha, rumbo y sombra con altura.','air.jet':'Avión de ataque o caza.','air.helicopter':'Helicóptero con rotor animado por tiempo absoluto.','air.prop':'Transporte de hélices animadas.'})[type],
  params:{...motionParams,variant:{type:'enum',values:Object.keys(AIR_TYPES[type]),default:defaultVariant(type)},altitude:{type:'number',default:2,min:0,max:20},contrail:{type:'boolean',default:false}},states:AIR_STATES,
  validate:(item,ctx)=>motionErrors(item,ctx,{variants:Object.keys(AIR_TYPES[type]),states:AIR_STATES}),prepare:prepareAircraft,draw:drawAir,
  sfx:(item,ctx)=>[{sfx:type==='air.helicopter'?'helicopter-rotor':type==='air.prop'?'air-prop-pass':'air-jet-pass',at:time(item.t,ctx),dur:item.dur??6,gain_db:-21}],
  demo:{id:type.replace('.','-'),type,at:[58.4,24.9],variant:defaultVariant(type),scale:type==='air.bomber'?2.7:4,heading:'auto',altitude:2,contrail:true,t:0,dur:8,label:({'air.bomber':'ALA VOLANTE','air.jet':'CAZA','air.helicopter':'HELICÓPTERO','air.prop':'TRANSPORTE'})[type],path:{via:[[58.4,24.9],[58.14,25.02],[57.95,25.06]],t:.3,dur:6.5,curve:'smooth'}},
});
for(const type of ['air.launch','air.recover'])Tactico.component(type,{
  layer:50,domain:'air',summary:type==='air.launch'?'Agregado: despegues escalonados por la cubierta angulada de un portaaviones móvil.':'Agregado: aproximación y recuperación sobre la cubierta de un portaaviones móvil.',
  params:{carrier:{type:'string',default:null},to:{default:null},from:{default:null},unit:{type:'string',default:'air.jet:fighter'},count:{type:'number',default:1,min:1,max:20},interval:{type:'number',default:.65},deckDur:{type:'number',default:.75},flightDur:{type:'number',default:3.8},scale:{type:'number',default:1}},states:[],
  validate:validateAction,prepare:prepareAction,draw:drawAction,
  sfx:(item,ctx)=>Array.from({length:item.count??1},(_,i)=>({sfx:'air-jet-pass',at:time(item.t,ctx)+i*(item.interval??.65),dur:2,gain_db:-18})),
  demo:{id:type.replace('.','-'),type,carrier:'demo-carrier',at:'demo-carrier',to:[57.6,25.6],from:type==='air.recover'?[57.6,25.6]:undefined,count:2,t:0,dur:7,unit:'air.jet:attack',note:'Agregado: no aparece en las referencias. Requiere el item demo-carrier.'},
});
Tactico.component('air.drop',{
  layer:50,domain:'air',summary:'Agregado: caída de bombas con sombra convergente y destello, ausente de las referencias.',
  params:{...motionParams,to:{default:null},count:{type:'number',default:3,min:1,max:20},interval:{type:'number',default:.3},fallDur:{type:'number',default:1.4},height:{type:'number',default:150}},states:[],
  validate:(item,ctx)=>[...motionErrors(item,ctx),...(!place(item.to,ctx)?['air.drop requiere to resoluble']:[]),...(item.fallDur!=null&&!(item.fallDur>0)?['fallDur debe ser positivo']:[])],
  prepare:(item,ctx)=>({motion:prepareMotion(item,ctx),target:place(item.to,ctx)}),
  draw(g,s,view,env){
    const U=env.U||1,c=ink(env),target=s.internal.target;if(!target)return;const q=view.project(...target),count=s.item.count??3;
    for(let i=0;i<count;i++){const age=s.lt-i*(s.item.interval??.3),d=s.item.fallDur??1.4;if(age<0||age>d+.45)continue;
      const u=clamp(age/d),h=(s.item.height??150)*U*(1-u*u),x=q.x+(i-(count-1)/2)*14*U,y=q.y;
      g.save();if(age<d){g.globalAlpha*=.2+.4*u;g.fillStyle=c.dark;g.beginPath();g.ellipse(x+30*U*(1-u),y+28*U*(1-u),5*U*(1+u),9*U*(1+u),-.4,0,Math.PI*2);g.fill();g.globalAlpha/= .2+.4*u;g.fillStyle=c.gray;g.strokeStyle=c.dark;g.lineWidth=2*U;g.beginPath();g.ellipse(x,y-h,4*U,12*U,0,0,Math.PI*2);g.fill();g.stroke();}
      else {const v=(age-d)/.45,r=(12+v*48)*U;g.globalAlpha*=1-v;g.fillStyle=c.fire;g.beginPath();g.arc(x,y,r*.6,0,Math.PI*2);g.fill();g.fillStyle=c.gold;g.beginPath();g.arc(x,y,r*.25,0,Math.PI*2);g.fill();g.strokeStyle=c.light;g.lineWidth=3*U;g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.stroke();}g.restore();
    }
  },
  demo:{id:'air-drop',type:'air.drop',at:[58.2,25],to:[58.2,25],count:4,t:0,dur:4,note:'Caída agregada, no observada en las referencias.'},
});
