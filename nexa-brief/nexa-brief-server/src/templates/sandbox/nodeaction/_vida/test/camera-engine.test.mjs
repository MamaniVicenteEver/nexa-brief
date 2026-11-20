import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createCanvas} from '@napi-rs/canvas';
import {loadEpisode} from '../tools/runtime.mjs';
import {compile} from '../engine/core/compile.js';
import {sampleScene} from '../engine/core/sample.js';
import {cameraAt,MOVES} from '../engine/camera/index.js';
import {renderFrame} from '../engine/render.js';
import {framingAt} from '../engine/core/framing.js';
import {cameraMetrics,collectCameraTrace} from '../engine/camera/metrics.js';
import {validateCamera,validateShot,cameraConfig} from '../engine/camera/config.js';
import {minimumDuration,progress,breath} from '../engine/camera/motion.js';
import {buildShotPlan} from '../engine/camera/director.js';
const source=await loadEpisode(new URL('../../vida-en-escena/assets/episode.json',import.meta.url).pathname);
const episode=()=>({version:1,id:'camera-test',camera:{style:'estable',handheld:0},scenes:[{set:'escuela-entrada',actors:{tomas:{at:'arrive'},nico:{at:'meet'}},steps:[{wait:5}],camera:[{type:'two',targets:['tomas','nico'],move:'hold',locked:true}]}]});
const build=e=>({...compile(e,source.timing,source.catalog),resources:source.resources});
const fail=(p,m)=>{throw new Error(p+': '+m);};
for(const view of ['portrait','landscape']){
 test(`camera ${view}: whole-shot envelope anticipates gestures without pumping, including sub-frame seeks`,()=>{
  const e=episode();e.scenes[0].actions=[{who:'tomas',action:'wave',at:1,dur:1.2}];const c=build(e),values=[];
  for(let t=0;t<5;t+=.037){const s=sampleScene(c,t),cam=cameraAt(c,t,s,{view});values.push(cam.h);assert.ok(framingAt(s,cam,false).every(b=>b.ok));assert.equal(cam.safetyCorrection,false);}
  assert.ok(Math.max(...values)-Math.min(...values)<1e-8);
 });
 test(`camera ${view}: random seek equals sequential pixels; view switching does not mutate compile output`,()=>{
  const e=episode();e.camera.handheld=.5;e.scenes[0].camera[0].move='push';const c=build(e),before=JSON.stringify(c.camera),cv=createCanvas(view==='portrait'?108:192,view==='portrait'?192:108),ctx=cv.getContext('2d'),times=[0,.1,.9,1.7,3.2,4.9];
  const hash=t=>{renderFrame(ctx,c,t,{view});return createHash('sha256').update(cv.data()).digest('hex');};const hashes=times.map(hash);
  for(const i of [4,0,5,1,3,2]){cameraAt(c,times[i],undefined,{view:view==='portrait'?'landscape':'portrait'});assert.equal(hash(times[i]),hashes[i]);}
  assert.equal(JSON.stringify(c.camera),before);
 });
 test(`camera ${view}: handheld stays within protected margins and is repeatable`,()=>{
  const e=episode();e.camera.handheld=1;const c=build(e);
  for(let t=0;t<5;t+=.11){const cam=cameraAt(c,t,undefined,{view});assert.deepEqual(cam,cameraAt(c,t,undefined,{view}));assert.ok(framingAt(sampleScene(c,t),cam,false).every(b=>b.ok));}
 });
 test(`camera ${view}: short requested zoom extends trajectory and emits a warning`,()=>{
  const e=episode();e.scenes[0].camera=[{type:'close',target:'tomas',move:'push',from:{zoom:.5},to:{zoom:3},ramp:.1,locked:true}];const c=build(e),cam=cameraAt(c,.5,undefined,{view});assert.ok(cam.motion.duration>.1);assert.ok(cam.motion.warnings.some(w=>w.code==='duracion-ampliada'));
  const m=cameraMetrics(collectCameraTrace(c,cameraAt,sampleScene,{view}),c.camera.config);assert.ok(m.criteria.camara_velocidad);assert.ok(m.criteria.camara_aceleracion);assert.ok(m.criteria.camara_jerk);
 });
}
test('camera JSON validates names, finite numbers, booleans, targets and curves in Spanish',()=>{
 for(const [cfg,path]of [[{style:'foo'},/camera.style/],[{maxPan:0},/camera.maxPan/],[{smoothing:NaN},/smoothing/],[{handheld:2},/handheld/],[{defaultEase:[.8,0,.2,1]},/monótona/],[{unknown:1},/desconocido/]])assert.throws(()=>validateCamera(cfg,fail),path);
 const c=build(episode()),scene=c.scenes[0];for(const [key,value]of [['move','orbit'],['offset',[0,Infinity]],['from',{target:'absent'}],['ease',[0,1,1,0]],['fit','yes'],['lens',0]])assert.throws(()=>validateShot({type:'close',target:'tomas',[key]:value},'$.shot',scene,fail),/\$\.shot/);
 for(const move of MOVES)assert.doesNotThrow(()=>validateShot({type:'medium',target:'tomas',move},'$.shot',scene,fail));
});
test('camera legacy moves remain deterministic in fit/tight and both views',()=>{
 for(const move of ['fixed','follow','dolly','pan','punch','move']){const e=episode();e.scenes[0].camera[0].move=move;const c=build(e);for(const framing of ['fit','tight'])for(const view of ['portrait','landscape']){const a=cameraAt(c,1,undefined,{framing,view});assert.ok(Number.isFinite(a.h)&&a.h>0);assert.deepEqual(a,cameraAt(c,1,undefined,{framing,view}));}}
});
test('camera fit:false remains explicit tight optics, locked keeps editorial boundaries',()=>{
 const e=episode();e.scenes[0].camera[0].fit=false;e.scenes[0].camera[0].zoom=3;const c=build(e);assert.equal(c.scenes[0].cameraPlan.length,1);for(const k of ['x','y','h','w'])assert.equal(cameraAt(c,1)[k],cameraAt(c,1,undefined,{framing:'tight'})[k]);
});
test('camera director never inserts timer cuts into a long quiet scene',()=>{
 const e=episode();e.scenes[0].steps=[{wait:18}];delete e.scenes[0].camera;const c=build(e);assert.equal(c.scenes[0].cameraPlan.length,1);assert.equal(c.scenes[0].cameraPlan[0].t1,18);
});
test('camera director uses reaction/listener beats and protects explicit overrides',()=>{
 const scene={t0:0,t1:10,actors:{a:{},b:{}},events:[{action:'react',who:'b',t0:4,t1:6,intensity:1}],shots:[{type:'insert',target:'book',t0:6,t1:6.5,locked:true}]};const lines=[{who:'a',t0:0,t1:4,intent:'exclaim'},{who:'a',t0:6.5,t1:10,intent:'explain'}];const plan=buildShotPlan(scene,lines);assert.ok(plan.some(s=>s.move==='push'&&s.target==='b'));assert.ok(plan.some(s=>s.type==='insert'&&s.t0===6&&s.t1===6.5));
 for(let i=1;i<plan.length;i++)if(plan[i].target&&plan[i].target===plan[i-1].target&&plan[i].type===plan[i-1].type)assert.equal(plan[i].transition,'move');
});
test('camera profile bounds duration by actual displacement, with smooth endpoint velocity',()=>{
 const c=cameraConfig(),a={cx:0,cy:0,h:100,w:56.25},b={cx:200,cy:0,h:50,w:28.125};assert.ok(minimumDuration(a,b,c,'smoother')>Math.log2(2)/c.maxZoomRate);
 for(const curve of ['smooth','smoother','linear','gentle','ease-in','ease-out',[.25,.1,.75,.9]]){assert.ok(progress(.0001,curve)<1e-7);assert.ok(1-progress(.9999,curve)<1e-7);assert.equal(progress(0,curve),0);assert.equal(progress(1,curve),1);}
 assert.deepEqual(breath(10,4,0),[0,0]);assert.notDeepEqual(breath(10,4,1),breath(10,5,1));
});
test('camera metrics reject excessive rates and jumps independently of engine implementation',()=>{
 const traces=[0,1].map(i=>({scene:'s',shot:{t0:i*2,t1:(i+1)*2,type:'close',target:'a',move:'fixed'},frames:Array.from({length:60},(_,f)=>({t:i*2+f/30,h:100+(f%2)*20,w:56.25,cx:f*100,cy:0}))}));const m=cameraMetrics(traces);for(const k of ['camara_velocidad','camara_aceleracion','camara_jerk','sin_bombeo','sin_salto'])assert.ok(m.failed.includes(k));
});
