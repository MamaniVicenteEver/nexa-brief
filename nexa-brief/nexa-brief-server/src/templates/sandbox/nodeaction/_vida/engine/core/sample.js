import { ACTIONS, envelope, ease } from '../act/index.js';
import { resolveSkeleton, createPose, blendPose } from '../rig/skeleton.js';
import { clamp, lerp, smoothstep, rotate } from './math.js';
import { ownerAt } from './compile.js';
import { visemesForWord } from '../face/mouth.js';
import { PROPS, SPOON_BOWL } from '../props/index.js';
const mix=(a,b,q)=>Array.isArray(b)?b.map((v,i)=>lerp(a?.[i]??v,v,q)):typeof b==='number'?lerp(typeof a==='number'?a:b,b,q):b&&typeof b==='object'?Object.fromEntries([...new Set([...Object.keys(a??{}),...Object.keys(b)])].map(k=>[k,k in b?mix(a?.[k],b[k],q):a[k]])):q>=.5?b:a;
const limbKeys=['hands','elbows','handShapes','handAngles','armLayer'];
function applyPose(actor,patch,weight,layers){
 const allowed=new Set();if(layers.includes('locomotion'))for(const k of ['x','y','rootY','sitting','seatLevel','feet','footAngles','knees','lean','view','secondary'])allowed.add(k);
 if(layers.includes('orientation'))allowed.add('view');if(layers.includes('body'))for(const k of ['rootY','lean','feet','knees'])allowed.add(k);
 if(layers.includes('head'))for(const k of ['headTilt','headTurn'])allowed.add(k);
 for(const k of allowed)if(k in patch)actor.pose[k]=mix(actor.pose[k],patch[k],weight);
 for(const side of ['left','right'])if(layers.includes('arm.'+side))for(const k of limbKeys)if(patch[k]?.[side]!==undefined)actor.pose[k][side]=mix(actor.pose[k][side],patch[k][side],weight);
}
function rig(a){a.rig=resolveSkeleton(a.character,a.pose);return a.rig;}
function setHand(a,side,world,q=1,shape='hold'){
 const r=rig(a), shoulder=r.world(r.limbs[side].shoulder), local=[(world[0]-shoulder[0])/r.scale,(world[1]-shoulder[1])/r.scale];
 const length=Math.hypot(...local);if(length>.289){local[0]*=.289/length;local[1]*=.289/length;}
 a.pose.hands[side]=mix(a.pose.hands[side],local,q);a.pose.handShapes[side]=shape;a.pose.handAngles[side]=shape==='point'?Math.atan2(local[1],local[0])+Math.PI/2:0;a.pose.armLayer[side]=2;rig(a);
}
const handWorld=(a,side)=>rig(a).anchors[side+'Hand'];
export function carryTarget(a,side,mode='side'){
 const r=rig(a),s=r.world(r.limbs[side].shoulder),sign=side==='left'?-1:1;
 const offsets={side:[sign*.04,.275],chest:[-sign*.095,.085],front:[sign*.12,.145],behind:[-(Math.sign(r.yaw)||sign)*.13,.245]};
 const p=offsets[mode]??offsets.side;return [s[0]+p[0]*r.scale,s[1]+p[1]*r.scale];
}
function carriedTarget(scene,id,a,side,t){
 if(scene.objects[id]?.prop==='spoon'&&a.seated){const table=scene.set.props.find(p=>['table','desk'].includes(p.prop)&&Math.abs(p.x-a.pose.x)<=p.w/2);if(table){const tip=rotate(SPOON_BOWL,spoonAngle(a)),scale=a.rig.scale/560;return [a.pose.x+(side==='left'?-1:1)*a.rig.scale*.055-tip[0]*scale,table.params.surfaceY-10-tip[1]*scale];}}
 let target=carryTarget(a,side,a.holding?.[side]?.object===id?a.holding[side].carry:'side');for(const e of scene.events.filter(e=>e.action==='hold'&&e.object===id&&e.who===a.id&&e.t0<=t&&e.carry))target=mix(target,carryTarget(a,side,e.carry),ease((t-e.t0)/Math.min(.3,e.dur/3)));
 return target;
}
const spoonAngle=a=>(Math.sign(a.rig.yaw)||1)*Math.PI/2;
export function slotPoint(a,slot,side='right'){const r=rig(a);return slot==='back'?[r.anchors.hip[0]-(r.yaw>=0?1:-1)*r.scale*.10,r.anchors.hip[1]-r.scale*.13]:[r.anchors.hip[0]+(side==='left'?-1:1)*r.scale*.075,r.anchors.hip[1]+r.scale*.005];}
function restTarget(a,side){const r=rig(a),s=r.world(r.limbs[side].shoulder);return [s[0]+(side==='left'?-.025:.025)*r.scale,s[1]+.279*r.scale];}
export function surfacePoint(scene,target){if(Array.isArray(target))return [...target];const a=scene.set.anchors[target];if(!a)return [0,0];let y=a.y; if(a.kind==='table'){const prop=scene.set.props.find(p=>['desk','table'].includes(p.prop)&&Math.abs(p.x-a.x)<=p.w/2);y=prop?.params.surfaceY??y;}return [a.x,y];}
export function speechAt(line,t){
 if(!line||t<line.t0||t>=line.t1)return {viseme:'X',open:0,speechWeight:1,silent:true,voiced:false};
 const local=t-line.t0+line.trimIn,index=local*line.rmsHz,i=Math.floor(index),raw=lerp(line.rms[i]??0,line.rms[i+1]??0,index-i);
 const word=line.words.find(w=>local>=w.s&&local<w.e), voiced=raw>.025;
 if(!word||!voiced)return {viseme:'X',open:0,speechWeight:1,silent:true,voiced};
 const list=visemesForWord(word.w);if(!list.length)list.push('A');const phase=clamp((local-word.s)/(word.e-word.s))*list.length,j=Math.min(list.length-1,Math.floor(phase));
 return {viseme:{from:list[j],to:list[Math.min(j+1,list.length-1)],mix:phase-j},open:clamp((raw-.025)*2.9,0,1),speechWeight:1,silent:false,voiced,word:word.w};
}
export function sampleScene(compiled,t){
 t=clamp(t,0,compiled.duration);const scene=compiled.scenes.find(s=>t>=s.t0&&t<s.t1)??compiled.scenes.at(-1);
 const actors=Object.fromEntries(Object.entries(scene.actors).map(([id,a])=>[id,{...a,pose:createPose(structuredClone(a.pose)),face:{...a.face,viseme:'X',open:0,speechWeight:1},fx:[],support:{left:{planted:true,contact:`${scene.id}:${id}:initial:left`},right:{planted:true,contact:`${scene.id}:${id}:initial:right`}}}]));
 const active=scene.events.filter(e=>t>=e.t0&&t<=e.t1);
 // Persistent lower-body and orientation tracks. Every seek reconstructs them from data.
 for(const e of scene.events.filter(e=>['walk','sit','stand','turn'].includes(e.action)&&t>=e.t0)){
  const a=actors[e.who],local=clamp(t-e.t0,0,e.dur),s=ACTIONS[e.action].sample(e,local);applyPose(a,s.pose,1,e.layers);
  if(e.action==='walk'&&t<e.t1)applyPose(a,s.pose,1,['arm.left','arm.right']);
  if(e.action==='sit')a.seated=e.seat;if(e.action==='stand'&&t>=e.t1)a.seated=null;if(e.action==='walk')a.seated=null;
  if(s.support)a.support=s.support;if(e.faceTo)a.look=e.faceTo;
 }
 for(const a of Object.values(actors)){a.pose.lean+=.004*Math.sin((t-scene.t0)*2.6);a.pose.headTilt+=.008*Math.sin(t*1.8);rig(a);}
 for(const e of active.filter(e=>!['walk','sit','stand','turn'].includes(e.action)).sort((a,b)=>Number(!a.auto)-Number(!b.auto)||a.t0-b.t0)){
  const a=actors[e.who],local=t-e.t0,s=ACTIONS[e.action].sample(e.action==='talk'?{...e,heldHands:Object.values(scene.objects).map(o=>ownerAt(o,t)).filter(o=>o.actor===e.who&&o.hand).map(o=>o.hand)}:e,local),weight=envelope(local,e.dur,e.fade??.18)*(e.weight??1);
  if(e.action==='react'&&a.seated&&s.pose){delete s.pose.rootY;delete s.pose.feet;delete s.pose.knees;if(['shock','surprise'].includes(e.kind))s.pose.lean=-.10*Math.sin(Math.PI*local/e.dur)*(e.intensity??1);}
  if(e.action==='react'&&e.kind==='shock'&&s.pose){delete s.pose.hands;delete s.pose.handShapes;delete s.pose.handAngles;}
  if(s.pose)applyPose(a,s.pose,weight,e.layers);
  if(s.face){const prev=a.face.expression;a.face={...a.face,...s.face,mix:{from:prev,to:s.face.expression??prev,weight:weight*(s.face.intensity??1)}};}
  if(s.look)a.look=s.look;if(s.targetHand)a.point={side:s.targetHand,to:s.target,weight,shape:s.shape};
  for(const f of s.fx??[])a.fx.push({...f,intensity:f.intensity*weight});
  if(e.action==='react'&&['shock','surprise'].includes(e.kind)&&weight>.01&&!a.seated)for(const side of ['left','right'])a.support[side]={planted:false,contact:e.id};
  rig(a);
 }
 // A small torso anticipation brings distant conversation partners into hand reach.
 for(const e of active.filter(e=>['give','highfive'].includes(e.action))){
  const a=actors[e.who],b=actors[e.to??e.recipient],distance=Math.abs(a.pose.x-b.pose.x),sign=Math.sign(b.pose.x-a.pose.x),k=envelope(t-e.t0,e.dur,.25);
  const lean=clamp((distance-290)/700,0,.20)*k;
  for(const [actor,dir] of [[a,sign],[b,-sign]]){actor.pose.lean+=dir*lean;actor.pose.rootY+=lean*.06;rig(actor);}
 }
 const targetPoint=(name)=>{if(Array.isArray(name))return name;if(actors[name])return actors[name].rig.anchors.head;if(scene.objects[name]){const own=ownerAt(scene.objects[name],t);return own.actor?actors[own.actor].rig.anchors[own.hand?own.hand+'Hand':'hip']:surfacePoint(scene,own.anchor);}return surfacePoint(scene,name);};
 for(const a of Object.values(actors)){if(a.look)a.face.lookAt=a.look==='camera'?a.rig.anchors.head:targetPoint(a.look);if(a.point)setHand(a,a.point.side,targetPoint(a.point.to),a.point.weight,a.point.shape);}
 // A held prop reserves its hand. Gestures on the free arm remain available.
 for(const [id,o] of Object.entries(scene.objects)){
  const own=ownerAt(o,t),a=actors[own.actor];if(!a||!own.hand)continue;
  const hold=active.find(e=>e.action==='hold'&&e.object===id),initialHug=a.holding?.[own.hand]?.object===id&&a.holding[own.hand].hug;
  const release=scene.events.find(e=>e.object===id&&e.who===a.id&&['give','put','wear','stow'].includes(e.action)&&t>=e.t0&&t<=e.t1);
  const initialWeight=initialHug?(release?1-ease((t-release.t0)/Math.min(.25,release.dur*.5)):1):0;
  const hugWeight=hold?.hug?Math.max(initialWeight,envelope(t-hold.t0,hold.dur)):initialWeight;
  const target=mix(carriedTarget(scene,id,a,own.hand,t),carryTarget(a,own.hand,hugWeight?'chest':hold?.carry??'side'),hold?envelope(t-hold.t0,hold.dur):hugWeight);setHand(a,own.hand,target);
  if(hugWeight){const other=own.hand==='left'?'right':'left';setHand(a,other,[target[0]+(other==='left'?-25:25),target[1]-20],hugWeight);}
 }
 const propStates=Object.fromEntries(scene.set.props.map(p=>[p.id??p.prop,{...p,params:{...p.params}}]));
 for(const e of active){
  const a=actors[e.who],side=e.hand??'right',u=(t-e.t0)/e.dur;
  if(e.action==='give'){
   const b=actors[e.to??e.recipient],bs=e.recipientHand??'right',ra=rig(a),rb=rig(b);
   const meeting=[(ra.world(ra.limbs[side].shoulder)[0]+rb.world(rb.limbs[bs].shoulder)[0])/2,Math.max(ra.world(ra.limbs[side].shoulder)[1],rb.world(rb.limbs[bs].shoulder)[1])+.045*ra.scale];
   const half=.1/e.dur, enter=.5-half, exit=.5+half,freeHand=handWorld(a,side);
   if(u<=exit){const k=ease(u/enter,'smoother');setHand(a,side,mix(carriedTarget(scene,e.object,a,side,t),meeting,k));setHand(b,bs,mix(restTarget(b,bs),meeting,k));}
   else{const k=ease((u-exit)/(1-exit),'smoother');setHand(a,side,mix(meeting,freeHand,k));setHand(b,bs,mix(meeting,carriedTarget(scene,e.object,b,bs,t),k));}
  }
  if(['pick','take','put'].includes(e.action)&&!e.previousOwner?.slot){
   const o=scene.objects[e.object],point=surfacePoint(scene,e.action==='put'?e.to:e.previousOwner.anchor),k=u<.65?ease(u/.65):1-ease((u-.65)/.35);
   const dy=point[1]-a.rig.world(a.rig.limbs[side].shoulder)[1];if(dy>a.rig.scale*.27){a.pose.rootY+=Math.min(.32,(dy/a.rig.scale-.26))*k;a.pose.lean+=.10*k;rig(a);}
   setHand(a,side,point,k); // Object follows this exact resolved hand before release / after pickup.
  }
  if(['wear','unwear','stow','unstow'].includes(e.action)||e.action==='take'&&e.previousOwner?.slot==='back'){
   const storing=['wear','stow'].includes(e.action),slot=storing?(e.action==='wear'?'back':'pocket'):e.previousOwner.slot;
   const point=slotPoint(a,slot,side),k=u<=.65?ease(u/.65):1-ease((u-.65)/.35);
   const base=storing&&u<=.65||!storing&&u>=.65?carriedTarget(scene,e.object,a,side,t):restTarget(a,side);
   setHand(a,side,mix(base,point,k));
  }
  if(e.action==='react'&&e.kind==='shock'){
   const weight=envelope(t-e.t0,e.dur,e.fade??.18)*(e.weight??1)*(e.intensity??1),r=rig(a);
   for(const hand of ['left','right'])if(!Object.values(scene.objects).some(o=>{const own=ownerAt(o,t);return own.actor===a.id&&own.hand===hand;})){
    const cheek=[r.anchors.head[0]+(hand==='left'?-1:1)*r.r*r.scale*.80,r.anchors.head[1]+r.scale*.045];
    const from=createPose(a.pose);setHand(a,hand,cheek,1,'flat');a.pose.elbows[hand]=hand==='left'?-1:1;
    // Unfold through full reach before changing IK branch; elbows open away from the face.
    const blended=blendPose(from,a.pose,weight);a.pose.hands[hand]=blended.hands[hand];a.pose.elbows[hand]=blended.elbows[hand];a.pose.handAngles[hand]=hand==='left'?-.22:.22;rig(a);
   }
  }
  if(e.action==='highfive'){
   const b=actors[e.to],bs=e.recipientHand??'left',meeting=[(a.pose.x+b.pose.x)/2,Math.min(a.rig.anchors.head[1],b.rig.anchors.head[1])+.05*a.rig.scale],k=Math.sin(Math.PI*u)**2;
   setHand(a,side,meeting,k,'flat');setHand(b,bs,meeting,k,'flat');if(Math.abs(u-.5)<.09)a.fx.push({type:'sparkle',intensity:1,point:meeting});
  }
  if(e.action==='eat'){
   const object=scene.objects[e.object],spoon=object.prop==='spoon',plate=scene.objects[e.plate],own=plate?ownerAt(plate,t):null;
   const from=spoon?(own?.actor?[...handWorld(actors[own.actor],own.hand)]:surfacePoint(scene,own?.anchor??e.plate)):carriedTarget(scene,e.object,a,side,t);
   const q=(u*(e.cycles??1))%1,k=Math.sin(Math.PI*q)**2,weight=envelope(t-e.t0,e.dur,.3);
   a.pose.headTilt+=.05*k*weight;rig(a);
   const angle=spoon?lerp(spoonAngle(a),-(Math.sign(a.rig.yaw)||1)*.65,k):0;
   const def=PROPS[object.prop],tip=spoon?rotate(SPOON_BOWL,angle):[0,-def.h/2-def.grip[1]+12],scale=a.rig.scale/560;
   if(spoon){from[0]-=tip[0]*scale;from[1]-=tip[1]*scale;}
   const mouth=a.rig.anchors.mouth,to=[mouth[0]-tip[0]*scale,mouth[1]-tip[1]*scale];
   setHand(a,side,mix(from,to,k),weight);if(spoon)a.spoonAngle=lerp(spoonAngle(a),angle,weight);
   const lick=object.prop==='icecream'&&k>.55?ease((k-.55)/.35)*weight:0;
   a.eating={object:e.object,kind:object.prop==='icecream'?'lick':'bite',open:lick};
  }
  if(e.action==='open'){
   const p=propStates[e.object],amount=(e.amount??1)*ease(clamp((u-.25)/.6));p.params.open=amount;
   const point=[p.x-p.w/2+p.w*Math.cos(amount*1.3)*.84,p.params.handleY??p.y-p.params.h*.41];setHand(a,side,point,envelope(t-e.t0,e.dur,.15));
  }
 }
 // Persist open-door values after their action has completed.
 for(const e of scene.events.filter(e=>e.action==='open'&&t>e.t1))propStates[e.object].params.open=e.amount??1;
 const objects={};for(const [id,o] of Object.entries(scene.objects)){
  const own=ownerAt(o,t),a=actors[own.actor];let point,angle=0;
  if(a){if(own.slot){point=slotPoint(a,own.slot);angle=a.pose.lean;}else point=handWorld(a,own.hand);}else point=surfacePoint(scene,own.anchor);
  if(o.prop==='spoon')angle=a?(a.spoonAngle??spoonAngle(a)):Math.PI/2;
  const carry=scene.events.filter(e=>e.action==='hold'&&e.object===id&&e.who===own.actor&&e.carry&&e.t0<=t).at(-1)?.carry??a?.holding?.[own.hand]?.carry??'side';
  const hidden=o.hidden===true||own.slot==='pocket';
  objects[id]={...o,id,owner:own,point,angle,carry,hidden,scale:(a?.rig.scale??scene.set.charHeight)/560,grip:PROPS[o.prop].grip};
 }
 for(const [id,a] of Object.entries(actors)){
  const line=compiled.lines.find(l=>l.who===id&&t>=l.t0&&t<l.t1);a.speech=speechAt(line,t);Object.assign(a.face,a.speech);if(a.eating?.open>0&&!a.speech.voiced)Object.assign(a.face,{silent:false,viseme:'L',open:a.eating.open,speechWeight:1});rig(a);
  a.bounds=[Math.min(a.pose.x-a.rig.scale*.20,a.rig.anchors.leftHand[0]-a.rig.scale*.045,a.rig.anchors.rightHand[0]-a.rig.scale*.045),Math.min(a.rig.anchors.head[1]-a.rig.scale*.24,a.rig.anchors.leftHand[1]-a.rig.scale*.06,a.rig.anchors.rightHand[1]-a.rig.scale*.06),Math.max(a.pose.x+a.rig.scale*.20,a.rig.anchors.leftHand[0]+a.rig.scale*.045,a.rig.anchors.rightHand[0]+a.rig.scale*.045),a.pose.y+a.rig.scale*.009];
 }
 return {t,scene,actors,objects,props:Object.values(propStates),active};
}
