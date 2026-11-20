import {clamp} from '../core/math.js';
import {sampleScene} from '../core/sample.js';
import {resolveView,resolveFraming,safeArea} from '../core/view.js';
import {actorBounds,faceBounds,paintedObjectBounds,unionBounds} from '../core/bounds.js';
import {cameraConfig,compositionConfig,canonicalMove} from './config.js';
import {progress,minimumDuration,interpolate,rootTrack,breath} from './motion.js';
const cache=new WeakMap(),geometry=new WeakMap();
const selected=s=>s.scene.cameraPlan.find(p=>s.t>=p.t0&&s.t<p.t1)??s.scene.cameraPlan.at(-1);
const rect=(r,aspect)=>({...r,w:r.h*aspect,x:r.cx-r.h*aspect/2,y:r.cy-r.h/2});
export function protectedGeometry(shot,state){
 const t=state.t;
 if(shot.type==='close'){const a=state.actors[shot.target]??Object.values(state.actors)[0];return {[a.id]:faceBounds(a,t)};}
 if(shot.type==='insert'){
  const o=state.objects[shot.target],boxes=o&&!o.hidden?{[o.id]:paintedObjectBounds(o)}:Object.fromEntries(Object.values(state.actors).map(a=>[a.id,faceBounds(a,t)]));
  const e=state.active.find(e=>e.action==='eat'&&e.object===o?.id);if(e)boxes[e.who]=faceBounds(state.actors[e.who],t);return boxes;
 }
 return Object.fromEntries(Object.values(state.actors).map(a=>[a.id,unionBounds([actorBounds(a,t),...Object.values(state.objects).filter(o=>!o.hidden&&o.owner.actor===a.id).map(paintedObjectBounds)])]));
}
function samplesFor(c,shot){
 let map=geometry.get(c);if(!map)geometry.set(c,map=new Map());if(map.has(shot))return map.get(shot);
 const scene=c.scenes.find(s=>shot.t0>=s.t0&&shot.t0<s.t1)??c.scenes.at(-1);
 const sig=s=>JSON.stringify([['close','insert'].includes(s.type)?s.type:'group',...(s.targets??(s.target?[s.target]:[])).slice().sort()]);
 let first=scene.cameraPlan.indexOf(shot),last=first;while(first>0&&sig(scene.cameraPlan[first-1])===sig(shot))first--;while(last+1<scene.cameraPlan.length&&sig(scene.cameraPlan[last+1])===sig(shot))last++;
 const from=scene.cameraPlan[first].t0,to=scene.cameraPlan[last].t1;
 const times=new Set([from,Math.max(from,to-1e-7),shot.t0,shot.t1-1e-7]);
 // A global 30 Hz grid plus every action edge. Geometry is shared by the two views.
 for(let f=Math.ceil(from*30);f/30<to;f++)times.add(f/30);
 for(const e of scene.events)for(const t of [e.t0,e.t1,e.transferAt])if(t>from&&t<to){times.add(t);times.add(Math.max(from,t-1e-6));times.add(Math.min(to-1e-7,t+1e-6));}
 const rows=[...times].sort((a,b)=>a-b).map(t=>{const s=sampleScene(c,t),a=s.actors[shot.target]??Object.values(s.actors)[0],o=s.objects[shot.target],owner=o&&s.actors[o.owner.actor];return {t,b:unionBounds(Object.values(protectedGeometry(shot,s))),x:(owner??a).pose.x,y:(owner??a).pose.y,eye:a.rig.anchors.head,look:Math.sign((a.face.lookAt?.[0]??a.pose.x)-a.rig.anchors.head[0])||Math.sign(a.rig.yaw)||0};});
 map.set(shot,rows);return rows;
}
function fitTrajectory(raw,rows,safe,aspect,padding,weight=()=>1){
 // One global feasible intersection for the whole shot. It is a conservative temporal
 // envelope (lookahead extends to the end of this shot), so gestures cannot pump zoom.
 const sampled=rows.map(s=>({q:weight(s.t),r:raw(s.t),b:[s.b[0]-padding,s.b[1]-padding,s.b[2]+padding,s.b[3]+padding]}));
 const interval=k=>{let xl=-Infinity,xh=Infinity,yl=-Infinity,yh=Infinity;
  for(const {r,b,q}of sampled){if(q<1e-8)continue;const scale=k**q,w=r.h*aspect*scale,h=r.h*scale;xl=Math.max(xl,(b[2]-r.cx-(safe.right-.5)*w)/q);xh=Math.min(xh,(b[0]-r.cx+(.5-safe.left)*w)/q);yl=Math.max(yl,(b[3]-r.cy-(safe.bottom-.5)*h)/q);yh=Math.min(yh,(b[1]-r.cy+(.5-safe.top)*h)/q);}
  return {xl,xh,yl,yh,ok:xl<=xh&&yl<=yh};
 };
 let lo=1,hi=1;while(!interval(hi).ok&&hi<1024)hi*=1.2;
 for(let i=0;i<42;i++){const mid=(lo+hi)/2;if(interval(mid).ok)hi=mid;else lo=mid;}
 const k=interval(1).ok?1:hi*(1+1e-10),r=interval(k),dx=clamp(0,r.xl,r.xh),dy=clamp(0,r.yl,r.yh);
 return {at:t=>{const a=raw(t),q=weight(t),scale=k**q;return {...a,cx:a.cx+dx*q,cy:a.cy+dy*q,h:a.h*scale,w:a.w*scale};},scale:k,dx,dy};
}
function build(c,shot,state,view,fit,baseRect,call){
 const config=cameraConfig(c.episode.camera),composition=compositionConfig(shot),move=canonicalMove(shot.move),aspect=view.w/view.h,group=!['close','insert'].includes(shot.type),rows=samplesFor(c,shot),ref=sampleScene(c,shot.frameAt??shot.t0),subtitles=c.episode.ui?.subtitles!==false&&c.lines.some(l=>l.scene===state.scene.id),safe=safeArea(view,subtitles),warnings=[];
 const handheld=shot.handheld??config.handheld,noiseMargin=.0035*handheld;
 const protectedSafe={...safe,left:safe.left+noiseMargin,right:safe.right-noiseMargin,top:safe.top+noiseMargin,bottom:safe.bottom-noiseMargin};
 if(composition.headroom!=null)protectedSafe.top=Math.max(protectedSafe.top,composition.headroom+noiseMargin);
 const previousIndex=state.scene.cameraPlan.indexOf(shot)-1,previousShot=state.scene.cameraPlan[previousIndex];
 if(group&&move==='track'&&shot.transition==='move'&&previousShot&&!['close','insert'].includes(previousShot.type)&&canonicalMove(previousShot.move)==='track'&&previousShot.target===shot.target){
  call(c,previousShot.t1-1e-7,undefined,{view,framing:fit?'fit':'tight'});
  const priorModel=cache.get(c).get(`${state.scene.id}:${previousIndex}:${view.orientation}:${fit}`);
  if(priorModel)return {...priorModel,transition:'move',composition,move,continued:true};
 }
 if(composition.leadRoom!=null){if(rows.some(r=>r.look>0))protectedSafe.right=Math.min(protectedSafe.right,1-composition.leadRoom-noiseMargin);if(rows.some(r=>r.look<0))protectedSafe.left=Math.max(protectedSafe.left,composition.leadRoom+noiseMargin);}
 const bounds=unionBounds(rows.map(r=>r.b));
 function endpoint(end,zoom){
  const s={...shot,target:end?.target??shot.target,targets:end?.target?undefined:shot.targets,offset:end?.offset??shot.offset,zoom:1,move:'fixed'},r=baseRect(s,ref,c);r.h/=zoom*(shot.lens??1);
  if(fit&&group){if(view.orientation==='landscape')r.h=Math.max(state.scene.set.plate.w/aspect,r.h*1080/1920);const namedPan=shot.fromTarget||shot.from?.target||shot.to?.target,base=ref.actors[shot.target]?.pose.x??(bounds[0]+bounds[2])/2,position=ref.actors[s.target]?.pose.x??ref.objects[s.target]?.point[0]??state.scene.set.anchors[s.target]?.x??base;r.cx=(bounds[0]+bounds[2])/2+(s.offset?.[0]??0)+(namedPan?position-base:0);r.cy=(bounds[1]+bounds[3])/2+r.h*(.5-(safe.top+safe.bottom)/2)+(s.offset?.[1]??0);}
  const a=ref.actors[s.target]??Object.values(ref.actors)[0],look=rows[0].look;
  if(composition.leadRoom!=null)r.cx+=look*composition.leadRoom*r.h*aspect;
  if(composition.thirds)r.cx+=look*r.h*aspect/6;
  if(composition.eyeLine!=null)r.cy=a.rig.anchors.head[1]+r.h*(.5-composition.eyeLine);
  return rect(r,aspect);
 }
 const amount=shot.amount??(move==='drift'?config.breath:shot.move==='punch'?.08:.06),z=shot.zoom??1;
 let z0=shot.from?.zoom??shot.zoomFrom??(move==='dolly'?z/1.2:move==='push'||move==='drift'?z/(1+amount):z),z1=shot.to?.zoom??shot.zoomTo??(['pull','reveal'].includes(move)?z/(1+amount):z);
 let a=endpoint(shot.from??(shot.fromTarget?{target:shot.fromTarget}:undefined),z0),b=endpoint(shot.to,z1);
 if(move==='hold'||move==='track')b={...a};
 let inherited;
 if(shot.resumeAt!=null||shot.holdAt!=null){inherited=call(c,shot.resumeAt??shot.holdAt,undefined,{view,framing:fit?'fit':'tight'});a={...inherited};b={...inherited};}
 const scene=state.scene,index=scene.cameraPlan.indexOf(shot),prior=scene.cameraPlan[index-1];
 let transition=shot.transition??'cut';
 if(prior&&['move','dissolve','whip'].includes(transition)){
  const old=call(c,prior.t1-1e-7,undefined,{view,framing:fit?'fit':'tight'});a={...old};if(move==='track')b={...a};
  // An explicit push continuing an existing shot starts at its current lens. Without
  // explicit zoom endpoints, apply amount relative to it rather than cancelling
  // the push against the same nominal zoom used by the preceding hold.
  if(shot.auto===false&&shot.from?.zoom==null&&shot.to?.zoom==null&&shot.zoomFrom==null&&shot.zoomTo==null&&['push','pull','drift','reveal'].includes(move)){
   const factor=['push','drift'].includes(move)?1/(1+amount):1+amount;b={...a,h:a.h*factor,w:a.w*factor};
  }
 }
 const curve=shot.ease??config.defaultEase,available=Math.max(.001,shot.t1-shot.t0-(shot.hold??0)-(shot.settle??0)),requested=shot.ramp??(shot.move==='punch'?.4:['push','pull','reveal'].includes(move)?Math.min(2,available):available),whip=move==='whip'||transition==='whip';
 let duration=whip?(shot.ramp??.22):Math.max(requested,minimumDuration(a,b,config,curve),shot.move==='punch'?.4:0);
 if(duration>requested+.001)warnings.push({code:'duracion-ampliada',requested,duration,message:'La trayectoria necesita más tiempo para respetar velocidad, aceleración y jerk; el corte editorial no se desplaza.'});
 if(duration>available+.001)warnings.push({code:'plano-insuficiente',available,duration,message:'El movimiento no termina antes del corte; ampliar el plano o reducir el recorrido.'});
 const start=shot.t0+(shot.hold??0),tracking=move==='track'&&!inherited,rootSamples=rows.filter((r,i)=>i===0||i===rows.length-1||r.t-rows[i-1].t>1/300),origin=tracking?rootTrack(rootSamples,start,config.smoothing+config.anticipation/2,config.deadzone,a.w):[0,0];
 let trackScale=1;
 const track=t=>{const p=rootTrack(rootSamples,t,config.smoothing+config.anticipation/2,config.deadzone,a.w);return [(p[0]-origin[0])*trackScale,(p[1]-origin[1])*trackScale];};
 if(tracking){let prev,vel,acc,maxV=0,maxA=0,maxJ=0;const dt=1/60;
  for(let t=shot.t0;t<=shot.t1+dt/2;t+=dt){const p=track(t);if(prev){const v=p.map((x,k)=>(x-prev[k])/dt/a.w);maxV=Math.max(maxV,Math.hypot(...v));if(vel){const aa=v.map((x,k)=>(x-vel[k])/dt);maxA=Math.max(maxA,Math.hypot(...aa));if(acc)maxJ=Math.max(maxJ,Math.hypot(...aa.map((x,k)=>(x-acc[k])/dt)));acc=aa;}vel=v;}prev=p;}
  trackScale=Math.min(1,.2*config.maxPan/(maxV||1e-9),.2*config.maxPanAcceleration/(maxA||1e-9),.2*config.maxPanJerk/(maxJ||1e-9));
  if(trackScale<.999)warnings.push({code:'seguimiento-limitado',scale:trackScale,message:'Se reduce el recorrido de seguimiento para respetar la inercia; fit reserva el desplazamiento restante.'});
 }
 const raw=t=>{const q=progress((t-start)/duration,curve),r=interpolate(a,b,q,aspect,shot.ease==='linear'&&move==='dolly');if(tracking){const p=track(t);r.cx+=p[0];r.cy+=p[1];}return r;};
 const anchored=prior&&['move','dissolve','whip'].includes(transition);
 const fitted=fit?fitTrajectory(raw,anchored?rows.filter(r=>r.t>=shot.t0&&r.t<shot.t1):rows,protectedSafe,aspect,state.scene.set.charHeight*.009,anchored?t=>progress((t-start)/duration,curve):undefined):{at:raw,scale:1,dx:0,dy:0};
 if(fit&&fitted.scale>1.01)warnings.push({code:'encuadre-protegido',scale:fitted.scale,message:'La envolvente de actores limita la lente o el movimiento solicitado.'});
 const priorModel=anchored?cache.get(c)?.get(`${state.scene.id}:${index-1}:${view.orientation}:${fit}`):null;
 const joinDuration=priorModel&&!whip?Math.max(duration,config.smoothing*3,2*minimumDuration(priorModel.at(shot.t1),fitted.at(shot.t1),config,curve)):duration;
 // Blend two absolute-time trajectories, not a frozen previous frame: derivatives
 // at a move boundary inherit the incoming velocity and acceleration exactly.
 const noisy=t=>{const r=fitted.at(t),n=breath(t,config.seed,handheld);return {...r,cx:r.cx+n[0]*r.w,cy:r.cy+n[1]*r.h};};
 const joined=t=>priorModel&&!whip?interpolate(priorModel.at(t),noisy(t),progress((t-start)/joinDuration,curve),aspect):noisy(t);
 return {at:t=>rect(joined(t),aspect),safe,safeBottom:a.safeBottom,config,composition,warnings,duration:joinDuration,transition,whip,fit,move,group,adjusted:fitted.scale>1.0001||Math.abs(fitted.dx)+Math.abs(fitted.dy)>.01};
}
export function plannedCameraAt(compiled,t,state,options,baseRect,call){
 state??=sampleScene(compiled,t);const view=resolveView(options.view??(compiled.episode.view==='landscape'?'landscape':'portrait')),framing=resolveFraming(compiled,options),shot=selected(state),fit=framing==='fit'&&shot.fit!==false;
 let models=cache.get(compiled);if(!models)cache.set(compiled,models=new Map());const key=`${state.scene.id}:${state.scene.cameraPlan.indexOf(shot)}:${view.orientation}:${fit}`;
 let model=models.get(key);if(!model){model=build(compiled,shot,state,view,fit,baseRect,call);models.set(key,model);}
 let r=model.at(t);const boxes=fit?protectedGeometry(shot,state):undefined;
 // Exact geometry is the final safety guard for sub-frame seeks and pathological gestures.
 // Normal motion uses the cached envelope; guard activation is exposed, never hidden.
 let safetyCorrection=false;
 if(!fit){const plate=state.scene.set.plate;let x=r.w<=plate.w?clamp(r.x,0,plate.w-r.w):r.x,y=r.h<=plate.h?clamp(r.y,0,plate.h-r.h):r.y;if(model.safeBottom!=null)y=Math.max(y,model.safeBottom-r.h*1340/1920);r={...r,x,y,cx:x+r.w/2,cy:y+r.h/2,safeBottom:model.safeBottom};}
 if(fit){const b=unionBounds(Object.values(boxes)),s=model.safe,needed=Math.max((b[2]-b[0])/(s.right-s.left)/(view.w/view.h),(b[3]-b[1])/(s.bottom-s.top));
  const h=Math.max(r.h,needed*1.000001),w=h*view.w/view.h,x=clamp(r.cx-w/2,b[2]-s.right*w,b[0]-s.left*w),y=clamp(r.cy-h/2,b[3]-s.bottom*h,b[1]-s.top*h);
  safetyCorrection=Math.abs(x-r.x)+Math.abs(y-r.y)+Math.abs(h-r.h)>1e-7;if(safetyCorrection)r={...r,x,y,h,w,cx:x+w/2,cy:y+h/2};
 }
 const subject=state.actors[shot.target]??Object.values(state.actors)[0],head=subject&&faceBounds(subject,t),look=subject?Math.sign((subject.face.lookAt?.[0]??subject.pose.x)-subject.rig.anchors.head[0])||Math.sign(subject.rig.yaw)||0:0;
 const headroom=head?(head[1]-r.y)/r.h:1,lead=head?(look>=0?(r.x+r.w-head[2])/r.w:(head[0]-r.x)/r.w):1;
 return {...r,viewportHeight:view.h,view,framing,fit,safe:model.safe,protectedBounds:boxes,type:shot.type,move:shot.move??'fixed',target:shot.target,targets:fit&&model.group?Object.keys(state.actors):shot.targets??(shot.target?[shot.target]:Object.keys(state.actors)),blur:['close','insert'].includes(shot.type)?3:0,motionBlur:model.whip?Math.sin(Math.PI*clamp((t-shot.t0)/model.duration))*13:0,transitioning:model.whip&&t-shot.t0<model.duration,shot,overrideAdjusted:shot.auto===false&&model.adjusted,safetyCorrection,motion:{duration:model.duration,warnings:model.warnings,transition:model.transition},composition:{headroom,leadRoom:lead,headroomOK:model.composition.headroom==null||headroom>=model.composition.headroom-1e-4,leadRoomOK:model.composition.leadRoom==null||!look||lead>=model.composition.leadRoom-1e-4}};
}
