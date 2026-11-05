import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Tactico,validateScene,resolveScene,expandScene} from '../../../_tactico/core.js';
import {timerFromWords} from '../../../_tactico/tools/anchors.js';
import {pathAt} from '../../../_tactico/util.js';
import {landIndex} from '../../../_tactico/tools/geometry.js';
import {prepareMotion,poseAt,angleDelta,stateWeights} from '../../../_tactico/components/units.js';
import {prepareNaval,formationMembers,carrierDeckPose,unitLength} from '../../../_tactico/components/naval.js';
import {actionPose} from '../../../_tactico/components/air.js';
import '../../../_tactico/components/strike.js';
import {createView} from '../../../_atlas/plano/view.js';
const json=async file=>JSON.parse(await readFile(new URL(file,import.meta.url),'utf8'));
const scene=await json('./scene-unidades.json'),motion=await json('./scene-unidades-movimiento.json');
const env={W:1080,H:1920,U:1,palette:{},sprite:name=>({name,relativeLength:1,available:false,draw(){}})};
const view=createView({lon:60.4,lat:20.5,zoom:8,bearing:27},1080,1920);
const ctx={T:(v,f=0)=>v??f,scene:motion};
test('Enterprise is the exact JSON from PLAN section 5; anchors and follow resolve',async()=>{
 const plan=await readFile(new URL('../../PLAN.md',import.meta.url),'utf8'),expected=JSON.parse(plan.split('## 5. Portaaviones')[1].match(/```json\n([\s\S]*?)```/)[1]);
 assert.deepEqual(scene.items[0],expected);const T=timerFromWords(scene.words),result=validateScene(scene,{T});assert.deepEqual(result.errors,[]);
 const copy=structuredClone(scene);expandScene(copy,{T});assert(copy.camera.length>40);assert(copy.camera.every(k=>!k.follow));
});
test('all gallery cases and five complete scenes validate against Natural Earth land',async()=>{
 const land=landIndex(await json('../../../_atlas/data/geo/admin0.geojson'));
 for(const c of (await json('./cases-unidades.json')).cases)assert.deepEqual(validateScene(c.scene,{land}).errors,[],c.id);
 for(const file of ['scene-unidades.json','scene-unidades-movimiento.json','items-units.json','items-naval.json','items-air.json']){
  const source=await json('./'+file);assert.deepEqual(validateScene(source,{land,T:timerFromWords(source.words||[])}).errors,[],file);
 }
});
test('group scale applies uniformly to referenced leader and escorts without mutating the source',async()=>{
 const leader={id:'lead',type:'naval.carrier',scale:1.2,path:motion.items[0].path,states:[{at:2,state:'hit',dur:1}]};
 const escort={id:'escort',type:'naval.warship',variant:'frigate',scale:.9};
 const item={id:'group',type:'naval.group',leader:'lead',units:['escort'],scale:.5};
 const local={...ctx,scene:{items:[leader,escort,item]}},internal=await prepareNaval(item,local);
 assert.equal(internal.leader.item.scale,.6);assert.equal(internal.members[0].item.scale,.45);
 assert.equal(internal.motion.path.via.length,leader.path.via.length);assert.equal(leader.scale,1.2);assert.equal(escort.path,undefined);
 assert.equal(stateWeights({item:leader,t:3,internal:{motion:internal.leader.motion,child:true}},['normal','hit']).hit,1);
});
test('interrupted child transitions preserve the mixture at the interruption, including random seeks',()=>{
 const item={states:[{at:1,state:'hit',dur:2,ease:'linear'},{at:2,state:'burning',dur:2,ease:'linear'}]},internal={motion:prepareMotion(item,ctx),child:true};
 const sample=t=>stateWeights({t,item,internal},['normal','hit','burning']);
 assert.deepEqual(sample(3),{normal:.25,hit:.25,burning:.5});
 assert.deepEqual(sample(2),{normal:.5,hit:.5,burning:0});
 assert.deepEqual(sample(3),{normal:.25,hit:.25,burning:.5});
});
test('all naval formations keep hulls separated throughout the convoy turn',async()=>{
 for(const formation of ['line','diamond','box','escort-ring']){
  const item={...motion.items[1],formation},internal=await prepareNaval(item,ctx);
  for(let i=0;i<=100;i++){
   const t=1+i/10,p=poseAt(internal,item,t),points=[{pose:view.project(p.lon,p.lat),item:internal.leader.item},...formationMembers({t,item,internal},view,env)];
   for(let a=0;a<points.length;a++)for(let b=a+1;b<points.length;b++)assert(Math.hypot(points[a].pose.x-points[b].pose.x,points[a].pose.y-points[b].pose.y)>100,formation);
  }
 }
});
test('motion shares the core path sampler and preserves path.speed',()=>{
 const item={type:'naval.warship',heading:'auto',path:{via:[[59,22],[60,23],[61,22]],t:1,speed:30,curve:'smooth'}};
 const prepared=prepareMotion(item,ctx);for(const t of [1,3,2,6])assert.deepEqual(poseAt(prepared,item,t),pathAt(prepared.path,t));assert.equal(prepared.path.dur,undefined);
});
test('formation labels retain every pairwise distance through the complete turn',async()=>{
 const item=motion.items[0],internal=await prepareNaval(item,ctx);let ref=null,last=null,maxStep=0;
 for(let k=0;k<=300;k++){
  const t=1+k/30,pose=poseAt(internal,item,t),center=view.project(pose.lon,pose.lat),points=[center,...formationMembers({t,item,internal},view,env).map(m=>m.pose)],distances=[];
  for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++)distances.push(Math.hypot(points[i].x-points[j].x,points[i].y-points[j].y));
  if(!ref)ref=distances;distances.forEach((d,i)=>assert(Math.abs(d-ref[i])<1e-8));assert(Math.min(...distances)>180);
  if(last!=null)maxStep=Math.max(maxStep,Math.abs(angleDelta(last,pose.heading)));last=pose.heading;
 }
 assert(maxStep<3,`max step ${maxStep}`);
});
test('two jets leave the moving angled deck in sequence and without a spatial/heading discontinuity',async()=>{
 const item=motion.items[0],nav=await prepareNaval(item,ctx),action=nav.actions[0],s={item:action.item,internal:action.internal},release=action.item.t+.75;
 assert(actionPose({...s,t:action.item.t+.1},view,env,0));assert.equal(actionPose({...s,t:action.item.t+.1},view,env,1),null);
 const a=actionPose({...s,t:release-1e-6},view,env),b=actionPose({...s,t:release+1e-6},view,env);assert(Math.hypot(a.x-b.x,a.y-b.y)<.01);assert(Math.abs(angleDelta(a.angle*180/Math.PI,b.angle*180/Math.PI))<.1);
 const deck=carrierDeckPose(item,nav.motion,release,view,env);assert(Math.hypot(a.x-deck.bow.x,a.y-deck.bow.y)<.01);
});
test('recovery enters the stern then moves toward the bow, continuously',async()=>{
 const carrier=motion.items[0],item={id:'recover-test',type:'air.recover',carrier:carrier.id,from:[59.5,19.7],t:3,count:1},internal=await Tactico.get(item.type).prepare(item,ctx),s={item,internal},touch=6.8;
 const a=actionPose({...s,t:touch-1e-6},view,env),b=actionPose({...s,t:touch+1e-6},view,env);assert(Math.hypot(a.x-b.x,a.y-b.y)<.01);assert(Math.abs(angleDelta(a.angle*180/Math.PI,b.angle*180/Math.PI))<.1);
});
test('geo size doubles at one extra zoom level; screen size is fixed',()=>{
 const pose={lon:60,lat:20},v2=createView({lon:60.4,lat:20.5,zoom:9},1080,1920),item={scaleMode:'geo',kmLength:2};
 assert(Math.abs(unitLength(item,pose,v2,env)/unitLength(item,pose,view,env)-2)<1e-8);
 assert.equal(unitLength({scaleMode:'screen'},pose,v2,env),unitLength({scaleMode:'screen'},pose,view,env));
});
test('invalid aircraft actions and malformed naval variants are rejected',()=>{
 for(const item of [{id:'bad',type:'naval.cargo',variant:'fighter'},{id:'bad',type:'air.launch',carrier:'absent',to:[60,20]},{id:'bad',type:'naval.carrier',deck:{aircraft:-2}},{id:'bad',type:'naval.group',leader:'bad'}])assert(validateScene({items:[item]}).errors.length>0);
});
