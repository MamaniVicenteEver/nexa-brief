import {Tactico} from '../core.js';
import {clamp,smooth,RAD,time,place,prepareMotion,poseAt,screenPose,stateWeights,ink,text,polygon,formationOffsets,motionErrors,motionParams,cachedArt} from './units.js';

export const NAVAL_STATES=['normal','detected','targeted','hit','burning','wrecked','sunk','flightops'];
export const NAVAL_TYPES={
  'naval.cargo':{tanker:['cargo-tanker',1.05],container:['cargo-container',.90],bulk:['cargo-bulk',.85]},
  'naval.warship':{destroyer:['warship-destroyer',.45],frigate:['warship-frigate',.38],cruiser:['warship-cruiser',.53]},
  'naval.submarine':{normal:['submarine',.48],translucent:['submarine-translucent',.48]},
  'naval.carrier':{supercarrier:['carrier-super-empty',1],stovl:['carrier-stovl',.72],hero:['carrier-super-empty',1],inventory:['carrier-super-empty',1]},
};
const defaultVariant=type=>({ 'naval.cargo':'tanker','naval.warship':'destroyer','naval.submarine':'normal','naval.carrier':'supercarrier'})[type];
const aliases={cg:'cruiser',ddg:'destroyer',ff:'frigate',cvn:'supercarrier',lhd:'stovl'};
const fxImages=new WeakMap(),fxContexts=new WeakMap();
function stableFxContext(g){
  if(fxContexts.has(g))return fxContexts.get(g);
  const methods=new Map(),proxy=new Proxy(g,{
    get(target,key){
      if(key==='drawImage')return (source,...args)=>{
        // FX radial canvases are immutable artwork. Snapshot their pixels once so
        // a later GPU/CPU backing-store migration cannot change a random seek.
        if(typeof OffscreenCanvas!=='undefined'&&source instanceof OffscreenCanvas){
          if(!fxImages.has(source)){
            const copy=new OffscreenCanvas(source.width,source.height),ctx=copy.getContext('2d',{willReadFrequently:true});
            ctx.putImageData(source.getContext('2d').getImageData(0,0,source.width,source.height),0,0);fxImages.set(source,copy.transferToImageBitmap());
          }
          source=fxImages.get(source);
        }
        return target.drawImage(source,...args);
      };
      const value=Reflect.get(target,key,target);
      if(typeof value!=='function')return value;
      if(!methods.has(key))methods.set(key,value.bind(target));return methods.get(key);
    },
    set(target,key,value){return Reflect.set(target,key,value,target);},
  });
  fxContexts.set(g,proxy);return proxy;
}
export function resolveUnit(value,ctx,domain='naval') {
  if(typeof value==='object'&&value)return {...value};
  const found=ctx?.scene?.items?.find(i=>i.id===value);if(found)return {...found,_reference:value};
  const [type,variant]=String(value||`${domain}.warship`).split(':');
  return {type,variant:aliases[variant]||variant||defaultVariant(type),heading:'auto'};
}
export function navalSprite(item,env) {
  let [name,relativeLength]=NAVAL_TYPES[item.type]?.[item.variant||defaultVariant(item.type)]||NAVAL_TYPES['naval.warship'].destroyer;
  let sprite=env.sprite(name);
  if(item.type==='naval.carrier' && !sprite.available && name==='carrier-super-empty') {
    const full=env.sprite('carrier-super');if(full.available){name='carrier-super';sprite=full;}
  }
  if(item.type==='naval.submarine'&&!sprite.available){const opaque=env.sprite('submarine');if(opaque.available){name='submarine';sprite=opaque;}}
  return {name,sprite,relativeLength:sprite.available?(sprite.relativeLength||relativeLength):relativeLength};
}
export function unitLength(item,pose,view,env,relative=1) {
  if(item.scaleMode==='geo'){
    const d=(item.kmLength||.33)/111.32, a=view.project(pose.lon,pose.lat),b=view.project(pose.lon,pose.lat+d);
    return Math.max(.5,Math.hypot(b.x-a.x,b.y-a.y))*(item.scale??1);
  }
  return 248*(env.U||1)*relative*(item.scale??1)*(item.variant==='hero'?2.05:1);
}
function referenceOwned(item,ctx) {
  if(!item.id)return [];
  return (ctx?.scene?.items||[]).filter(owner=>owner.id!==item.id && (owner.type==='naval.group'&&(owner.leader===item.id||(owner.units||[]).includes(item.id)) || owner.type==='naval.carrier'&&(owner.escorts?.units||[]).includes(item.id)));
}
function prepareChild(child,ctx,parent) {
  const item={...child,t:parent.t,path:parent.path,heading:parent.heading??'auto',scale:(child.scale??1)*(parent.scale??1)};
  return {item,motion:prepareMotion(item,ctx)};
}
function containsRing(p,ring){let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
function inside(p,geometry){const polygons=geometry?.type==='Polygon'?[geometry.coordinates]:geometry?.coordinates||[];return polygons.some(poly=>containsRing(p,poly[0])&&!poly.slice(1).some(r=>containsRing(p,r)));}
function inventoryPositions(item,ctx) {
  const geometry=ctx?.geo?.region?.(item.region||item.country)?.geometry, count=item.count??8;
  if(!geometry)return null;
  const points=geometry.coordinates.flat(geometry.type==='Polygon'?1:2),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  const bounds=[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)],candidates=[];
  // Pick actual land points from a regular grid; islands and polygon holes are respected.
  let step=[0,0];
  for(let n=3;n<=40;n++){
    candidates.length=0;
    step=[(bounds[2]-bounds[0])/n,(bounds[3]-bounds[1])/n];
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){
      const p=[bounds[0]+(x+.5)*step[0],bounds[1]+(y+.5)*step[1]];
      if([-.44,0,.44].every(dx=>[-.44,0,.44].every(dy=>inside([p[0]+dx*step[0],p[1]+dy*step[1]],geometry))))candidates.push(p);
    }
    if(candidates.length>=count)break;
  }
  return {points:candidates.slice(0,count),step};
}
export async function prepareNaval(item,ctx) {
  await ctx.loadSprites?.();
  const internal={motion:prepareMotion(item,ctx),owned:referenceOwned(item,ctx),ctx};
  if(item.escorts) internal.escorts={type:'naval.group',formation:item.escorts.formation||'diamond',units:(item.escorts.units||[]).map(v=>prepareChild(resolveUnit(v,ctx),ctx,item))};
  if(item.type==='naval.group'){
    const leader=resolveUnit(item.leader||{type:'naval.carrier',variant:'supercarrier',deck:{aircraft:8}},ctx);
    // A referenced leader supplies the route when the group has no explicit route.
    const parent={...item,path:item.path||leader.path,at:item.at||leader.at};
    internal.motion=prepareMotion(parent,ctx);internal.leader=prepareChild(leader,ctx,parent);
    internal.members=(item.units||['naval.warship:ddg','naval.warship:ff','naval.warship:cg']).map(v=>prepareChild(resolveUnit(v,ctx),ctx,parent));
  }
  if(item.variant==='inventory'){
    internal.inventory=inventoryPositions(item,ctx);
    const def=Tactico.get('badge.count'),badgeItem={type:'badge.count',value:item.count??8,radius:37,t:item.t??0};
    if(def)internal.badge={def,item:badgeItem,internal:await def.prepare?.(badgeItem,ctx)};
  }
  internal.actions=await Promise.all((item.actions||[]).map(async(action,i)=>{
    const def=Tactico.get(action.type);if(!def)throw new Error(`Acción desconocida: ${action.type}`);
    const child={...action,id:`${item.id}-action-${i}`,carrier:item.id,at:item.id,t:time(action.at,ctx),dur:action.dur??((action.flightDur??3.8)+(action.deckDur??.75)+((action.count??1)-1)*(action.interval??.65)),fade:0};
    return {item:child,def,internal:await def.prepare?.(child,ctx)};
  }));
  return internal;
}
export function formationMembers(s,view,env) {
  const item=s.item, p=screenPose(s,view),group=item.type==='naval.group',lead=group?s.internal.leader.item:item;
  const L=unitLength(lead,p,view,env,navalSprite(lead,env).relativeLength),members=group?s.internal.members:(s.internal.escorts?.units||[]);
  const formation=group?(item.formation||'diamond'):(item.escorts?.formation||'diamond'),spacing=L*(item.spacing??item.escorts?.spacing??.82);
  const offsets=formation==='line'?members.map((_,i)=>({x:0,y:(i+1)*spacing*1.6})):formationOffsets(formation,members.length,spacing);
  return members.map((r,i)=>({...r,pose:{...p,x:p.x+offsets[i].x*Math.cos(p.angle)-offsets[i].y*Math.sin(p.angle),y:p.y+offsets[i].x*Math.sin(p.angle)+offsets[i].y*Math.cos(p.angle)},offset:offsets[i]}));
}
function wake(g,item,p,L,s,env,w) {
  const path=s.internal?.motion?.path||s.internal?.path;if(!path||item.wake===false)return;
  const before=poseAt(s.internal,item,s.t-.12),now=poseAt(s.internal,item,s.t),v=Math.hypot(now.lon-before.lon,now.lat-before.lat);
  const activity=clamp(v*800)*(1-(w.sunk||0));if(activity<.001)return;
  const c=ink(env);g.save();g.translate(p.x,p.y);g.rotate(p.angle);g.strokeStyle=c.light;g.lineCap='round';
  for(let i=0;i<12;i++){
    const u=i/12,j=(i+1)/12;g.save();g.globalAlpha*=activity*.3*(1-u)**1.5;g.lineWidth=(2+3*u)*(env.U||1);
    for(const sign of [-1,1]){g.beginPath();g.moveTo(sign*L*(.08+u*.29),L*(.42+u*.95));g.lineTo(sign*L*(.08+j*.29),L*(.42+j*.95));g.stroke();}g.restore();
  }g.restore();
}
function details(g,item,L,env,available) {
  const c=ink(env),w=L*.24;g.save();g.lineWidth=Math.max(.6,L*.006);g.strokeStyle=c.dark;
  if(item.type==='naval.cargo'&&!available){
    g.fillStyle=c.red;g.fillRect(-w*.35,-L*.34,w*.7,L*.6);
    if(item.variant==='container')for(let y=0;y<6;y++)for(let x=0;x<3;x++){g.fillStyle=[c.red,c.blue,c.gold][(x+y)%3];g.fillRect(-w*.32+x*w*.22,-L*.31+y*L*.083,w*.19,L*.069);g.strokeRect(-w*.32+x*w*.22,-L*.31+y*L*.083,w*.19,L*.069);}
    else if(item.variant==='bulk'){g.fillStyle=c.gray;for(let y=0;y<4;y++){g.fillRect(-w*.3,-L*.3+y*L*.14,w*.6,L*.11);g.strokeRect(-w*.3,-L*.3+y*L*.14,w*.6,L*.11);}}
    else {g.strokeStyle=c.gold;g.beginPath();g.moveTo(0,-L*.34);g.lineTo(0,L*.27);g.stroke();g.fillStyle=c.gray;for(let y=0;y<5;y++){g.beginPath();g.ellipse(0,-L*.27+y*L*.11,w*.24,L*.04,0,0,Math.PI*2);g.fill();g.stroke();}}
    g.fillStyle=c.light;g.fillRect(-w*.38,L*.25,w*.76,L*.13);g.fillStyle=c.dark;g.fillRect(-w*.3,L*.27,w*.6,L*.025);
  }
  if(item.type==='naval.warship'&&!available){
    g.fillStyle=c.light;g.fillRect(-w*.24,-L*.15,w*.48,L*.38);g.strokeRect(-w*.24,-L*.15,w*.48,L*.38);
    for(const y of [-.3,.29]){g.fillStyle=c.gray;g.beginPath();g.arc(0,L*y,w*.21,0,Math.PI*2);g.fill();g.stroke();g.lineWidth=L*.025;g.beginPath();g.moveTo(0,L*y);g.lineTo(0,L*(y-.1));g.stroke();}
    g.lineWidth=L*.013;g.beginPath();g.moveTo(-w*.5,0);g.lineTo(w*.5,0);g.moveTo(0,-L*.09);g.lineTo(0,L*.1);g.stroke();
  }
  if(item.type==='naval.submarine'&&!available){g.fillStyle=c.gray;g.beginPath();g.roundRect(-L*.037,-L*.1,L*.074,L*.2,L*.025);g.fill();g.fillRect(-L*.17,L*.27,L*.34,L*.035);}
  if(item.type==='naval.carrier'){
    if(!available){
      g.fillStyle=c.smoke;polygon(g,[[-L*.14,-L*.42],[L*.09,-L*.47],[L*.14,-L*.31],[L*.14,L*.45],[-L*.14,L*.45],[-L*.18,L*.17]]);g.fill();g.stroke();
      g.fillStyle=c.gray;g.fillRect(L*.07,-L*.08,L*.07,L*.22);g.strokeRect(L*.07,-L*.08,L*.07,L*.22);
      g.strokeStyle=c.light;g.lineWidth=L*.008;g.beginPath();g.moveTo(L*.035,L*.36);g.lineTo(-L*.085,-L*.32);g.stroke();
      g.setLineDash([L*.028,L*.025]);g.beginPath();g.moveTo(-L*.025,L*.36);g.lineTo(-L*.12,-L*.32);g.stroke();g.setLineDash([]);
      if(item.variant==='stovl'){g.fillStyle=c.gray;g.beginPath();g.roundRect(-L*.13,-L*.45,L*.23,L*.13,L*.02);g.fill();g.stroke();g.strokeStyle=c.gold;for(let i=0;i<4;i++){g.beginPath();g.moveTo(-L*.1,-L*.44+i*L*.026);g.lineTo(L*.07,-L*.44+i*L*.026);g.stroke();}}
    }
    // Aircraft are independent deck objects; count is data, including zero.
    const n=clamp(Math.floor(item.deck?.aircraft??12),0,40),jet=env.sprite('air-jet-fighter');
    for(let i=0;i<n;i++){const side=i%2, row=Math.floor(i/2),y=L*(.34-row*.052),x=L*(side?.075:-.115);jet.draw(g,x,y,{length:L*.062,heading:side?0:14,shadow:false,color:c.light});}
  }
  g.restore();
}
function fireAndSmoke(g,p,L,t,amount,env,seed) {
  if(amount<.001)return;const c=ink(env),random=env.rng(seed||'naval-fire');g.save();g.globalAlpha*=amount;
  // Analytic particles: lifetime derives from t and fixed phase, never a frame accumulator.
  for(let i=0;i<9;i++){
    const phase=random(),u=((t*.34+phase)%1+1)%1,x=p.x+(random()-.5)*L*.22-u*L*.22,y=p.y+(random()-.5)*L*.3-u*L*.52;
    g.save();g.globalAlpha*=Math.sin(Math.PI*u)*.5;g.fillStyle=c.smoke;g.beginPath();g.ellipse(x,y,L*(.035+.065*u),L*(.05+.08*u),-.3,0,Math.PI*2);g.fill();g.restore();
  }
  for(let i=0;i<4;i++){const phase=random()*6.28,dx=(random()-.5)*L*.12,dy=(random()-.5)*L*.25,h=L*(.09+.035*Math.sin(t*7+phase));
    g.save();g.translate(p.x+dx,p.y+dy);g.fillStyle=c.fire;polygon(g,[[-L*.035,0],[-L*.02,-h*.6],[0,-h],[L*.03,-h*.3],[L*.035,0]]);g.fill();g.fillStyle=c.gold;polygon(g,[[-L*.015,0],[0,-h*.65],[L*.015,0]]);g.fill();g.restore();}
  g.restore();
}
export function drawNavalHull(g,s,view,env,override) {
  const item=s.item,p=override||screenPose(s,view),c=ink(env),record=navalSprite(item,env),L=unitLength(item,p,view,env,record.relativeLength),w=stateWeights(s,NAVAL_STATES);
  g.save();
  wake(g,item,p,L,s,env,w);
  const submerged=item.variant==='translucent'||item.translucent===true;
  if(w.detected+w.targeted>0){g.save();g.globalAlpha*=clamp(w.detected+w.targeted);g.strokeStyle=c.red;g.lineWidth=2.4*(env.U||1);for(let i=0;i<3;i++){const u=((s.t*.25+i/3)%1+1)%1;g.save();g.globalAlpha*=1-u;g.beginPath();g.ellipse(p.x,p.y,L*(.35+u*.15),L*(.57+u*.13),p.angle,0,Math.PI*2);g.stroke();g.restore();}text(g,w.targeted>.5?'OBJETIVO':'DETECTADO',p.x,p.y-L*.67,20*(env.U||1),env,c.red);g.restore();}
  const sunk=w.sunk,roll=sunk*.5,bodyAlpha=(1-sunk*.96)*(submerged?.48:1),angle=p.angle+roll;
  g.save();g.globalAlpha*=bodyAlpha;g.translate(p.x,p.y+sunk*L*.22);g.rotate(angle);g.scale(1-sunk*.65,1-sunk*.18);
  const bodySize=Math.ceil(L*1.5+40*(env.U||1)),paintBody=ctx=>{
    record.sprite.draw(ctx,0,0,{length:L,heading:0,shadow:true,shadowOffset:[7*(env.U||1),10*(env.U||1)],color:item.type==='naval.carrier'?c.smoke:item.type==='naval.cargo'?c.red:submerged?c.blue:c.gray});
    details(ctx,item,L,env,record.sprite.available);
  };
  const body=cachedArt(JSON.stringify(['hull',record.name,record.sprite.image?.src,L,env.U,item.deck?.aircraft??12,submerged,c]),bodySize,paintBody);
  if(body)g.drawImage(body,-bodySize/2,-bodySize/2,bodySize,bodySize);else paintBody(g);
  for(const name of ['hit','burning','wrecked'])if(w[name]>.001){
    g.save();g.globalAlpha*=w[name];const stateSprite=env.sprite(`${record.name}-${name}`);
    (stateSprite.available?stateSprite:record.sprite).draw(g,0,0,{length:L,heading:0,state:stateSprite.available?'normal':name,shadow:false,color:name==='hit'?c.light:c.smoke});g.restore();
  }
  if(submerged){g.save();g.globalAlpha*=.35;record.sprite.draw(g,0,0,{length:L,shadow:false,color:c.blue});g.restore();}
  if(w.flightops>.001&&item.type==='naval.carrier'){
    g.save();g.globalAlpha*=w.flightops;for(let i=0;i<5;i++){g.fillStyle=(i+Math.floor(s.t*4))%3?c.gold:c.green;g.beginPath();g.arc(-L*.07+i*L*.012,-L*.3+i*L*.1,L*.009,0,Math.PI*2);g.fill();}
    g.fillStyle=c.light;for(let i=0;i<4;i++){const u=((s.t*.8+i/4)%1+1)%1;g.save();g.globalAlpha*=.18*(1-u);g.beginPath();g.ellipse(-L*.1-u*L*.1,-L*.3+u*L*.22,L*(.025+u*.04),L*.035,0,0,Math.PI*2);g.fill();g.restore();}g.restore();
  }g.restore();
  if(sunk>.001&&sunk<1){g.save();g.globalAlpha*=Math.sin(Math.PI*sunk)*.8;g.strokeStyle=c.light;g.lineWidth=3*(env.U||1);for(let i=0;i<3;i++){g.beginPath();g.ellipse(p.x,p.y,L*(.2+sunk*.3+i*.07),L*(.4+sunk*.2+i*.05),p.angle,0,Math.PI*2);g.stroke();}g.restore();}
  const fire=Tactico.get('fx.fire'),smoke=Tactico.get('fx.smoke');
  if(fire&&smoke&&(w.burning+w.wrecked*.18)>.001){
    for(const def of [smoke,fire]){const amount=def===fire?w.burning:w.burning+w.wrecked*.18;if(amount<.001)continue;
      const fxItem={type:def.name,id:`${item.id}-${def.name}`,at:[p.lon,p.lat],t:0,dur:3600,size:L/(env.U||1)*.28,particles:def===fire?18:14,seed:item.id,period:1.3,life:2.8,emitFor:3600,drift:[-12,-20]};
      g.save();g.globalAlpha*=amount;
      const radius=L*.28,pad=radius*4+60*(env.U||1);g.beginPath();g.rect(p.x-pad,p.y-pad,pad*2,pad*2);g.clip();
      def.draw(stableFxContext(g),{item:fxItem,t:s.t,lt:s.t,pos:{lon:p.lon,lat:p.lat},internal:{start:0,duration:3600,size:fxItem.size,count:fxItem.particles,seed:item.id}}, {...view,project:()=>({x:p.x,y:p.y,visible:true,k:1})},env);g.restore();
    }
  }else fireAndSmoke(g,p,L,s.t,w.burning+w.wrecked*.18,env,item.id);
  if(item.label && sunk<.98){
    if(item.type==='naval.submarine'){
      const labelY=p.y-L*.7,labelX=p.x+L*.65;g.strokeStyle=c.blue;g.lineWidth=2*(env.U||1);g.beginPath();g.moveTo(p.x,p.y);g.lineTo(p.x+L*.25,labelY);g.lineTo(labelX,labelY);g.stroke();g.fillStyle=c.gold;polygon(g,Array.from({length:8},(_,i)=>{const a=i*Math.PI/4,r=(i%2?3:8)*(env.U||1);return [p.x+Math.cos(a)*r,p.y+Math.sin(a)*r];}));g.fill();text(g,item.label,labelX,labelY-18*(env.U||1),24*(env.U||1),env,c.blue);
    } else text(g,item.label,p.x,p.y+(item.escorts?.units?.length?L*1.12:L*.63)+18*(env.U||1),22*(env.U||1),env,c.light);
  }
  g.restore();return {pose:p,length:L};
}
export function carrierDeckPose(carrier,motion,t,view,env) {
  const s={item:carrier,t,internal:{motion}},p=screenPose(s,view),L=unitLength(carrier,p,view,env,navalSprite(carrier,env).relativeLength);
  const local=(x,y)=>({x:p.x+L*(x*Math.cos(p.angle)-y*Math.sin(p.angle)),y:p.y+L*(x*Math.sin(p.angle)+y*Math.cos(p.angle))});
  return {...p,length:L,stern:local(.035,.32),bow:local(-.085,-.34),deckAngle:p.angle-Math.atan2(.12,.66)};
}
function drawInventory(g,s,view,env) {
  const item=s.item,n=item.count??8,p=screenPose(s,view),U=env.U||1,cols=item.columns??Math.ceil(Math.sqrt(n)),grid=s.internal.inventory,positions=grid?.points;
  g.save();
  for(let i=0;i<n;i++){
    const q=positions?.[i]?view.project(...positions[i]):{x:p.x+(i%cols-(cols-1)/2)*100*U,y:p.y+(Math.floor(i/cols)-(Math.ceil(n/cols)-1)/2)*146*U};
    let scale=(item.inventoryScale??.42)*(item.scale??1);
    if(positions?.[i]){
      const at=positions[i],a=view.project(at[0]+grid.step[0],at[1]),b=view.project(at[0],at[1]+grid.step[1]);
      const safeLength=Math.min(Math.hypot(a.x-q.x,a.y-q.y),Math.hypot(b.x-q.x,b.y-q.y))*.72;
      scale=Math.min(scale,safeLength/(248*U*navalSprite(item,env).relativeLength));
    }
    drawNavalHull(g,{...s,alpha:1,item:{...item,label:'',variant:'supercarrier',scale,deck:{aircraft:0},path:null}},view,env,{...p,...q,angle:(item.inventoryHeading??-35)*RAD});
  }
  const badgeY=p.y-Math.ceil(n/cols)*77*U-15*U,c=ink(env),badge=s.internal.badge;
  if(badge)badge.def.draw(g,{...s,item:{...badge.item,screen:[p.x/env.W,badgeY/env.H]},internal:badge.internal},view,env);
  else {g.fillStyle=c.green;g.beginPath();g.arc(p.x,badgeY,37*U,0,Math.PI*2);g.fill();g.strokeStyle=c.gold;g.lineWidth=2*U;g.stroke();text(g,n,p.x,badgeY,35*U,env,c.light);}
  if(item.label)text(g,item.label,p.x,badgeY-60*U,28*U,env);g.restore();
}
function drawNaval(g,s,view,env) {
  if(s.internal.owned.some(owner=>s.t>=(owner.t??0)&&s.t<(owner.out??((owner.t??0)+(owner.dur??Infinity)))+(owner.fade??.35)))return;
  if(s.item.variant==='inventory'){drawInventory(g,s,view,env);return;}
  for(const member of formationMembers(s,view,env))drawNavalHull(g,{...s,state:null,stateWeights:null,item:member.item,internal:{motion:member.motion,child:true}},view,env,member.pose);
  if(s.item.type==='naval.group'){
    const leader=s.internal.leader,ownStates=s.item.states?.length||s.item.state;
    drawNavalHull(g,{...s,...(ownStates?{}:{state:null,stateWeights:null}),item:{...leader.item,label:s.item.label||leader.item.label},internal:{motion:leader.motion,child:!ownStates}},view,env,screenPose(s,view));
  }
  else drawNavalHull(g,s,view,env);
  for(const action of s.internal.actions||[])if(s.t>=action.item.t&&s.t<=action.item.t+action.item.dur)action.def.draw(g,{...s,item:action.item,internal:action.internal,lt:s.t-action.item.t,alpha:1},view,env);
}
function validateNaval(item,ctx) {
  const variants=NAVAL_TYPES[item.type]&&Object.keys(NAVAL_TYPES[item.type]),errors=motionErrors(item,ctx,{variants,states:NAVAL_STATES});
  if(item.formation&&!['line','diamond','box','escort-ring'].includes(item.formation))errors.push('formation naval inválida');
  if(item.escorts?.formation&&!['line','diamond','box','escort-ring'].includes(item.escorts.formation))errors.push('escorts.formation inválida');
  if(item.deck?.aircraft!=null&&(!Number.isInteger(item.deck.aircraft)||item.deck.aircraft<0||item.deck.aircraft>40))errors.push('deck.aircraft debe ser entero de 0 a 40');
  if(item.variant==='inventory'&&!item.region&&!item.country)errors.push('inventory requiere region o country');
  for(const action of item.actions||[]){
    if(!['air.launch','air.recover'].includes(action.type))errors.push(`acción no admitida: ${action.type}`);
    else {const def=Tactico.get(action.type);if(def?.validate)errors.push(...def.validate({...action,carrier:item.id,at:item.id,t:action.at},ctx));}
  }
  for(const v of [item.leader,...(item.units||[]),...(item.escorts?.units||[])].filter(Boolean)){
    if(v===item.id)errors.push('un grupo no puede referenciarse a sí mismo');
    const child=resolveUnit(v,ctx);if(!NAVAL_TYPES[child.type])errors.push(`unidad naval desconocida: ${typeof v==='string'?v:child.type}`);
    else errors.push(...motionErrors(child,ctx,{variants:Object.keys(NAVAL_TYPES[child.type]),states:NAVAL_STATES}));
  }
  return errors;
}
for(const type of Object.keys(NAVAL_TYPES).concat('naval.group')) {
  const variants=NAVAL_TYPES[type]&&Object.keys(NAVAL_TYPES[type]);
  Tactico.component(type,{
    layer:40,domain:'sea',summary:({ 'naval.cargo':'Mercante: petrolero, contenedores o granelero, con estados de casco y estela.','naval.warship':'Destructor, fragata o crucero gris con torres.','naval.submarine':'Submarino opaco o azul translúcido, rótulo y línea guía.','naval.carrier':'Portaaviones con cubierta angulada, aviones, escoltas coordinadas y operaciones aéreas.','naval.group':'Líder y escoltas en formación rígida que gira con la ruta, por ids o tipos.'})[type],
    params:{...motionParams,...(variants?{variant:{type:'enum',values:variants,default:defaultVariant(type)}}:{}),wake:{type:'boolean',default:true},
      ...(type==='naval.group'?{leader:{default:'naval.carrier:supercarrier'},formation:{type:'enum',values:['line','diamond','box','escort-ring'],default:'diamond'},units:{type:'array',default:['naval.warship:ddg','naval.warship:ff','naval.warship:cg']},spacing:{type:'number',default:.82}}:{}),
      ...(type==='naval.carrier'?{deck:{type:'object',default:{aircraft:12}},escorts:{type:'object',default:null},actions:{type:'array',default:[]},region:{type:'string',default:null},count:{type:'number',default:8},inventoryScale:{type:'number',default:.42}}:{}),
      ...(type==='naval.submarine'?{translucent:{type:'boolean',default:false}}:{})},
    states:NAVAL_STATES,validate:validateNaval,prepare:prepareNaval,draw:drawNaval,
    sfx:(item,ctx)=>item.sfx===false?[]:[{sfx:typeof item.sfx==='string'?item.sfx:'naval-engine-low',at:time(item.t,ctx),dur:item.dur??9,gain_db:-22,fade_in:.5,fade_out:1},...(item.actions||[]).flatMap(a=>Array.from({length:a.count??1},(_,i)=>({sfx:'air-jet-pass',at:time(a.at,ctx)+i*(a.interval??.65),dur:2,gain_db:-18})))],
    demo:{type,id:type.replace('.','-'),variant:defaultVariant(type),at:[58.4,24.9],heading:'auto',label:({ 'naval.cargo':'PETROLERO','naval.warship':'DESTRUCTOR','naval.submarine':'SUBMARINO','naval.carrier':'PORTAAVIONES','naval.group':'GRUPO NAVAL'})[type],
      t:0,dur:8,path:{via:[[58.4,24.9],[58.18,25.04],[57.95,25.06]],t:.5,dur:6,curve:'smooth'},...(type==='naval.carrier'?{deck:{aircraft:12},escorts:{formation:'diamond',units:['naval.warship:cg','naval.warship:ddg','naval.warship:ff']}}:{}),
      states:[{at:3,state:type==='naval.carrier'?'flightops':'detected'},{at:5.5,state:'normal'}]},
  });
}
