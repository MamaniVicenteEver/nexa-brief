import { createPose, posePreset, viewValue } from '../rig/skeleton.js';
import { clamp, lerp, smoothstep } from '../core/math.js';
import {planAccents,talkPose} from './gestures.js';
import {normalizeText} from '../core/dialogue.js';
import {FX} from '../fx/index.js';
export const ease = (u, name = 'smooth') => name === 'linear' ? clamp(u) : name === 'smoother' ? (u=clamp(u), u*u*u*(u*(u*6-15)+10)) : smoothstep(clamp(u));
export const envelope = (t, dur, fade = .18) => smoothstep(clamp(t / Math.min(fade,dur/3))) * smoothstep(clamp((dur-t) / Math.min(fade,dur/3)));
const num = (min,max,def) => ({type:'number',min,max,default:def});
const choice = (values,def=values[0]) => ({type:'string',enum:values,default:def});
const target = {type:'target'};
const hand = choice(['left','right'],'right');
const common = { hand, weight:num(0,1,1), fade:num(.04,1,.18) };
const reg = (params,minDur,defaultDur,layers,fn,plan=ctx=>({...ctx.params})) => ({params:{...common,...params},minDur,defaultDur,layers,plan,sample:fn});
const body = ['body'], arms=['arm.left','arm.right'], head=['head'], face=['face'];
const armPose = (side,p,shape='open',angle=null) => ({hands:{[side]:p},handShapes:{[side]:shape},handAngles:{[side]:angle},armLayer:{[side]:1}});
const reactionNames = ['surprise','laugh','shy','worry','annoyed','relief','shock'];
export const ACTIONS = {};
ACTIONS.idle = reg({},.1,1,[],(s,t)=>({pose:{lean:.006*Math.sin(t*2.5),headTilt:.009*Math.sin(t*1.6)}}));
ACTIONS.walk = reg({to:target,speed:num(.1,3,1),ease:choice(['smooth','smoother','linear']),view:{type:'string',enum:['front','3q-left','3q-right','side-left','side-right'],summary:'Vista final: hereda la vista del plano si se omite.'},spacing:num(0,2,1.15)},.45,1.4,['locomotion'],(s,t)=>{
  const {from,to,scale,dur,nSteps} = s; const travel=dur*.8, u=clamp(t/travel), d=Math.abs(to[0]-from[0]), dir=Math.sign(to[0]-from[0])||1;
  const distance=d*ease(u,s.ease), settle=clamp((t-travel)/(dur-travel));
  const overshoot=t>travel?Math.sin(Math.PI*settle)*Math.exp(-3*settle)*scale*.018*dir:0;
  const x=from[0]+dir*distance+overshoot, y=lerp(from[1],to[1],ease(u,s.ease));
  const phase=d?distance/d*nSteps:nSteps; const feet={}, footAngles={}, support={};
  for(const [side,sign] of [['left',-1],['right',1]]) {
    let foot=from[0]+sign*.065*scale, footY=from[1], lift=0, planted=true, contact=`${s.id}:${side}:initial`;
    for(let i=0;i<nSteps;i++) {
      if((i%2===0?'right':'left')!==side) continue;
      const landing=i>=nSteps-2?to[0]+sign*.065*scale:from[0]+dir*((i+1)*d/nSteps)+sign*.035*scale;
      const landingY=i>=nSteps-2?to[1]:lerp(from[1],to[1],Math.min(1,(i+1)/nSteps));
      if(phase>=i+1) {foot=landing;footY=landingY;contact=`${s.id}:${side}:${i}`;continue;}
      if(phase>=i) {const q=clamp((phase-i-.1)/.8); foot=lerp(foot,landing,ease(q,'smoother'));footY=lerp(footY,landingY,ease(q,'smoother'));lift=-.055*Math.sin(Math.PI*q)**2;footAngles[side]=.24*dir*Math.sin(Math.PI*q*2);planted=q<=0||q>=1;if(q>=1)contact=`${s.id}:${side}:${i}`;}
      break;
    }
    feet[side]=[(foot-x)/scale,(footY-y)/scale+lift]; support[side]={planted,contact};
  }
  const blend=smoothstep(clamp(t/.15))*(1-smoothstep(settle));
  const bob=.006*Math.sin(phase*Math.PI*2)**2*blend;
  const swing=(feet.right[0]-feet.left[0])*.75*blend;
  const yaw=lerp(viewValue(s.fromView),dir,smoothstep(clamp(t/.23)));
  const view=lerp(yaw,viewValue(s.view??s.fromView),smoothstep(settle));
  const hipWidth=.038*(.56+.44*Math.cos(view*Math.PI/2));
  const safeRoot=Math.max(...['left','right'].map((side,i)=>feet[side][1]-.022-Math.sqrt(Math.max(.01,.327**2-(feet[side][0]-(i?1:-1)*hipWidth)**2))+.002));
  const rootY=lerp(-.348,Math.max(-.337+bob,safeRoot),blend);
  return {pose:{x,y,rootY,sitting:0,knees:{left:-dir,right:-dir},lean:dir*(.065*blend-.05*Math.sin(Math.PI*settle)),view,feet,footAngles,hands:{left:[lerp(-.025,swing,blend),lerp(.279,.235,blend)],right:[lerp(.025,-swing,blend),lerp(.279,.235,blend)]},secondary:{at:s.t0+travel,amplitude:.15*dir,frequency:2.6,damping:.48}},support,distance};
},ctx=>{
  const from=ctx.from, to=ctx.resolve(ctx.params.to), scale=ctx.scale;
  return {...ctx.params,from,to,scale,fromView:ctx.fromView,view:ctx.params.view??ctx.fromView,nSteps:Math.max(2,Math.ceil(Math.abs(to[0]-from[0])/(scale*.12)/2)*2),dur:ctx.dur??Math.max(.65,Math.abs(to[0]-from[0])/(scale*(ctx.params.speed??1))+.4)};
});
ACTIONS.stop=reg({breath:num(0,1,0)},.2,.4,[...body,...head],(s,t)=>({pose:{lean:(s.breath?.065:-.035)*Math.sin(Math.PI*t/s.dur),rootY:-.348+(s.breath??0)*.006*(1+Math.sin(t*28)),headTilt:.025*Math.sin(Math.PI*t/s.dur)}}));
ACTIONS.talk=reg({intent:choice(['explain','ask','exclaim','deny','whisper','list']),line:{type:'string'},face:{type:'string'},intensity:num(0,1,1)},.2,2,[...arms,...head],(s,t)=>({pose:talkPose(s,t),face:s.faceState}),ctx=>({...ctx.params,faceState:ctx.params.face?{expression:ctx.params.face,intensity:ctx.params.intensity??1}:ctx.line?.faceState,accents:planAccents(ctx.line,ctx.dur??2)}));
ACTIONS.listen=reg({to:target,line:{type:'string'},reactions:{type:'array'},react:{type:'reaction'}},.2,2,head,(s,t)=>{
  const pause=s.pauses?.find(p=>t>=p&&t<p+.7);const nod=pause!=null?Math.sin((t-pause)/.7*Math.PI*2)*Math.PI/30:0;
  const r=[...(s.reactions??[])].reverse().find(r=>t>=r.at-.16);
  const intensity=r?(r.intensity??.6)*smoothstep(clamp((t-r.at+.16)/.25)):0;
  return {pose:{headTilt:nod},look:s.to,face:{blink:'auto',...(r?{expression:r.kind??'surprise',intensity}:{} )}};
},ctx=>{
  const line=ctx.line,dur=ctx.dur??2,mid=dur*.5,text=line?.text??line?.words.map(w=>w.w).join(' ')??'';
  const reaction=ctx.params.react===false?null:typeof ctx.params.react==='string'?{kind:ctx.params.react}:ctx.params.react??(/[!¡]/.test(text)?{kind:'surprise',intensity:.6}:/[?¿]/.test(text)?{kind:'think',intensity:.55}:null);
  const reactions=[...(reaction?[{at:mid,...reaction,kind:reaction.kind??reaction.expression}]:[]),...(ctx.params.reactions??[])].map(r=>({...r,kind:r.kind==='relief'?'smile':r.kind,at:typeof r.at==='number'?r.at:(line?.words.find(w=>normalizeText(w.w).replace(/[^\p{L}\p{N}]/gu,'')===normalizeText(r.word??''))?.s??mid)-(line?.trimIn??0)})).sort((a,b)=>a.at-b.at);
  const pauses=(line?.words??[]).filter((w,i,a)=>i===a.length-1||(a[i+1].s-w.e)>.1).map(w=>w.e-line.trimIn).filter(t=>t<dur-.4);
  if(!pauses.length)pauses.push(Math.max(.2,mid-.35));
  return {...ctx.params,pauses,reactions};
});
ACTIONS.react=reg({kind:choice(reactionNames),intensity:num(0,1,1)},.35,1.1,[...body,...head,...face],(s,t)=>{
  const u=clamp(t/s.dur), peak=u<.22?-Math.sin(Math.PI*u/.22)*.15:Math.sin(Math.PI*clamp((u-.22)/.78))**.7, k=peak*(s.intensity??1), kind=s.kind;
  let p={headTilt:-.08*k,lean:0,rootY:-.348};let expression=kind==='relief'?'smile':kind;let fx=[];
  if(kind==='laugh'){p.lean=.20*k;p.rootY+=.02*k+Math.abs(Math.sin(t*20))*.012*Math.max(0,k);p.headTilt=.12*k;fx=['tears'];}
  if(kind==='surprise'||kind==='shock'){p.rootY-=.075*k;p.headTilt=-.07*k;p.feet={left:[-.075,-.075*Math.max(0,k)],right:[.075,-.075*Math.max(0,k)]};fx=kind==='shock'?['shock','!']:['!'];}
  // Compatible local silhouette; exact cheek contacts follow torso/seat and held props.
  if(kind==='shock'){p.hands={left:[-.06,-.16],right:[.06,-.16]};p.handShapes={left:'flat',right:'flat'};p.handAngles={left:-.22,right:.22};p.armLayer={left:2,right:2};}
  if(kind==='shy'){p.headTilt=.17*k;p.lean=-.02*k;fx=['blush'];}
  if(kind==='worry'){p.lean=-.05*k;fx=['sweat','?'];}
  if(kind==='annoyed'){p.headTilt=-.12*k;p.lean=-.055*k;p.rootY+=.01*k;fx=['motion'];}
  if(kind==='relief'){p.rootY+=.012*k;p.headTilt=.07*k;fx=['sparkle'];}
  return {pose:p,face:{expression,intensity:Math.max(0,k),eyeScale:kind==='shock'?1+(2/1.46-1)*Math.max(0,k):1},fx:fx.map(type=>({type,intensity:Math.max(0,k)}))};
});
ACTIONS.look=reg({to:target},.15,1,head,s=>({look:s.to}));
ACTIONS.point=reg({to:target},.2,1,['arm.hand','head'],s=>({targetHand:s.hand??'right',target:s.to,shape:'point',look:s.to}));
ACTIONS.turn=reg({view:choice(['front','3q-left','3q-right','side-left','side-right'])},.2,.45,['orientation'],(s,t)=>({pose:{view:lerp(viewValue(s.fromView),viewValue(s.view),ease(t/s.dur))}}),ctx=>({...ctx.params,fromView:ctx.fromView}));
ACTIONS.wave=reg({},.3,1.2,['arm.hand'],(s,t)=>({pose:armPose(s.hand??'right',[(s.hand==='left'?-1:1)*.16,-.15],'wave',.25*Math.sin(t*16))}));
ACTIONS['cross-arms']=reg({},.3,1.5,arms,()=>({pose:posePreset('cross-arms')}));
ACTIONS['hands-hips']=reg({},.3,1.5,arms,()=>({pose:posePreset('hands-hips')}));
ACTIONS['touch-head']=reg({},.3,1,['arm.hand'],s=>({pose:{...armPose(s.hand??'right',[(s.hand==='left'?-1:1)*.085,-.25],'flat',s.hand==='left'?-.5:.5),armLayer:{[s.hand??'right']:2}}}));
ACTIONS.sit=reg({seat:target,view:{type:'string',enum:['front','3q-left','3q-right','side-left','side-right'],summary:'Default: 3q hacia el interlocutor según facing del asiento.'}},.4,.85,['locomotion'],(s,t)=>{
 const q=ease(t/s.dur);return {pose:{x:lerp(s.from[0],s.seat[0],q),y:lerp(s.from[1],s.seat[1],q),rootY:lerp(s.fromRoot??-.348,(s.seatY-s.seat[1])/s.scale-s.pelvisDepth,q),sitting:q,seatLevel:(s.seatY-s.seat[1])/s.scale,view:lerp(viewValue(s.fromView),viewValue(s.view),q),feet:{left:[-.065,0],right:[.065,0]},knees:{left:-1,right:-1},lean:-.035*Math.sin(q*Math.PI)},support:Object.fromEntries(['left','right'].map(side=>[side,{planted:q===1,contact:`${s.id}:seated:${side}`}]))};
},ctx=>({...ctx.params,from:ctx.from,fromRoot:ctx.fromRoot,fromView:ctx.fromView,view:ctx.params.view??ctx.seatView,seat:ctx.resolve(ctx.params.seat),seatY:ctx.seatY,pelvisDepth:ctx.pelvisDepth,scale:ctx.scale}));
ACTIONS.stand=reg({seat:target},.4,.75,['locomotion'],(s,t)=>{const q=ease(t/s.dur);return {pose:{rootY:lerp(s.fromRoot??-.25,-.348,q),sitting:(s.fromSitting??1)*(1-q),lean:.07*Math.sin(Math.PI*clamp(t/s.dur)),feet:{left:[-.065,0],right:[.065,0]}},support:Object.fromEntries(['left','right'].map(side=>[side,{planted:q===1,contact:`${s.id}:standing:${side}`}]))};},ctx=>({...ctx.params,fromRoot:ctx.fromRoot,fromSitting:ctx.fromSitting}));
for(const name of ['pick','take','hold','give','put','wear','unwear','stow','unstow']) ACTIONS[name]=reg({object:{type:'string'},to:target,recipient:{type:'string'},recipientHand:hand,hug:{type:'boolean',default:false},...(name==='hold'?{carry:choice(['side','chest','front','behind'],'side')}:{})},name==='hold'?.1:.4,name==='give'?1.2: .8,['arm.hand'],(s,t)=>({interaction:name,progress:clamp(t/s.dur)}));
ACTIONS.highfive=reg({to:target,recipientHand:choice(['left','right'],'left')},.6,1.2,['arm.hand'],(s,t)=>({interaction:'highfive',progress:clamp(t/s.dur)}));
ACTIONS.eat=reg({object:{type:'string'},item:{type:'string',summary:'Alias de object; cuchara con plate u objeto de mano.'},plate:{type:'string'},cycles:num(1,8,1)},.8,2,['arm.hand','head','mouth'],(s,t)=>({interaction:'eat',progress:clamp(t/s.dur)}));
export const GESTURE_NAMES=['shrug','open-arms','facepalm','count-fingers','thumbs-up','nod','shake-head'];
ACTIONS.gesture=reg({kind:choice(GESTURE_NAMES),intensity:num(0,1,1)},.25,1.2,[...arms,...head],(s,t)=>{
 const k=s.intensity??1,side=s.hand??'right',sign=side==='left'?-1:1;
 const p={headTilt:0,headTurn:0};
 if(s.kind==='shrug'||s.kind==='open-arms')Object.assign(p,{hands:{left:[-.22,-.05-(s.kind==='shrug'?.05:0)],right:[.22,-.05-(s.kind==='shrug'?.05:0)]},handShapes:{left:'open',right:'open'},handAngles:{left:-1.1,right:1.1},headTilt:s.kind==='shrug'?.09:0});
 if(s.kind==='facepalm')Object.assign(p,armPose(side,[-sign*.035,-.24],'flat'),{headTilt:.08});
 if(s.kind==='thumbs-up')Object.assign(p,armPose(side,[sign*.16,-.10],'thumb',0));
 if(s.kind==='count-fingers'){const count=Math.min(3,1+Math.floor(t/s.dur*3));Object.assign(p,armPose(side,[sign*.19,-.09],count===1?'point':count===2?'two':'three',0));}
 if(s.kind==='nod')p.headTilt=.12*Math.sin(t/s.dur*Math.PI*4);
 if(s.kind==='shake-head')p.headTurn=.22*Math.sin(t/s.dur*Math.PI*4);
 if(p.hands)for(const [hand,v]of Object.entries(p.hands))p.hands[hand]=v.map((x,i)=>lerp(i===0?(hand==='left'?-.025:.025):.279,x,k));
 p.headTilt*=k;p.headTurn*=k;return {pose:p};
});
ACTIONS.fx=reg({kind:choice(FX),intensity:num(0,1,1),offset:{type:'point',default:[.19,-.14]},size:num(.25,3,1)},.1,1,[],s=>({fx:[{type:s.kind,intensity:s.intensity??1,offset:s.offset,size:s.size??1}]}));
ACTIONS.open=reg({object:{type:'string'},amount:num(0,1,1)},.6,1.2,['arm.hand'],(s,t)=>({interaction:'open',progress:clamp(t/s.dur)}));
export const actionLayers = a => a.action==='gesture' ? (['nod','shake-head'].includes(a.kind)?head:['facepalm','count-fingers','thumbs-up'].includes(a.kind)?[`arm.${a.hand??'right'}`,...head]:[...arms,...head]) : [...(ACTIONS[a.action]?.layers.map(l=>l==='arm.hand'?`arm.${a.hand??'right'}`:l)??[]),...(a.action==='react'&&a.kind==='shock'?arms:[])];
// Required data are shared by compile and the generated JSON Schema.
for(const [name,required] of Object.entries({walk:['to'],talk:['line'],listen:['to'],react:['kind'],look:['to'],point:['to'],turn:['view'],sit:['seat'],pick:['object'],take:['object'],hold:['object'],give:['object'],put:['object','to'],wear:['object'],unwear:['object'],stow:['object'],unstow:['object'],gesture:['kind'],fx:['kind'],highfive:['to'],open:['object']}))ACTIONS[name].required=required;
