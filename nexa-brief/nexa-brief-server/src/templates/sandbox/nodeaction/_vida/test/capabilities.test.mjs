import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createCanvas} from '@napi-rs/canvas';
import {loadEpisode,ROOT} from '../tools/runtime.mjs';
import {compile} from '../engine/core/compile.js';
import {sampleScene,renderFrame,transitionAt} from '../engine/render.js';
import {cameraAt,worldToScreen} from '../engine/camera/index.js';
import {subtitleAt} from '../engine/ui/index.js';
import {mouthShape} from '../engine/face/mouth.js';
import {GESTURE_NAMES} from '../engine/act/index.js';
import {FX} from '../engine/fx/index.js';
import {validateEpisodeFile} from '../tools/validate-episode.mjs';
const source=await loadEpisode(new URL('../../vida-en-escena/assets/episode.json',import.meta.url).pathname);
const build=e=>({...compile(e,source.timing,source.catalog),resources:source.resources});
const episode=(set='escuela-entrada')=>({version:1,framing:'tight',id:'capabilities-test',scenes:[{set,actors:{tomas:{at:set==='aula'?'seat-tomas':'arrive',view:'front'},nico:{at:set==='aula'?'seat-nico':'meet',view:'front'}},steps:[{wait:3}]}]});
const action=(name,params={})=>({who:'tomas',action:name,...params});
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const hash=(c,t)=>{const canvas=createCanvas(270,480);renderFrame(canvas.getContext('2d'),c,t);return createHash('sha256').update(canvas.data()).digest('hex');};

test('offscreen has no body, listeners, look targets or camera subject; subtitles are italic',()=>{
 const e=episode();e.cast={narrador:{offscreen:true,voice:'narrador'}};e.scenes[0].steps=[{say:'N01'}];const c=build(e);
 assert.deepEqual(Object.keys(sampleScene(c,1).actors),['tomas','nico']);assert.equal(c.scenes[0].events.length,0);
 assert.equal(subtitleAt(c,c.lines[0].words[0].s+.02).italic,true);assert.ok(c.scenes[0].cameraPlan.every(s=>s.target!=='narrador'));
 for(const name of ['look','listen']){e.scenes[0].actions=[action(name,{to:'narrador'})];assert.throws(()=>build(e),/offscreen/);}
});

test('stow/unstow: hip contact, hidden pocket ownership, free hand, continuous reappearance',()=>{
 for(const hand of ['left','right']){
  const e=episode();e.scenes[0].objects={phone:{prop:'phone',owner:{actor:'tomas',hand}}};e.scenes[0].steps=[{do:action('stow',{object:'phone',hand,dur:1})},{wait:1},{do:action('unstow',{object:'phone',hand,dur:1})}];const c=build(e);
  const pocket=sampleScene(c,1.5);assert.deepEqual(pocket.objects.phone.owner,{actor:'tomas',slot:'pocket'});assert.equal(pocket.objects.phone.hidden,true);
  assert.ok(distance(sampleScene(c,.649).objects.phone.point,sampleScene(c,.649).actors.tomas.rig.anchors.hip)<60);
  assert.equal(sampleScene(c,2.66).objects.phone.hidden,false);assert.equal(sampleScene(c,2.66).objects.phone.owner.hand,hand);
  for(const event of c.scenes[0].events)for(const t of [event.t0,event.t1,event.transferAt].filter(t=>t>0&&t<3)){
   const a=sampleScene(c,t-1e-6),b=sampleScene(c,t+1e-6);assert.ok(distance(a.actors.tomas.rig.anchors[hand+'Hand'],b.actors.tomas.rig.anchors[hand+'Hand'])<.02);
  }
  assert.equal(hash(c,1.5),hash(c,1.5));
 }
});

test('unwear and take from back reach the bag before acquiring it, in five views',()=>{
 for(const view of ['front','3q-left','3q-right','side-left','side-right'])for(const name of ['unwear','take']){
  const e=episode();e.scenes[0].actors.tomas.view=view;e.scenes[0].objects={bag:{prop:'backpack',owner:{actor:'tomas',slot:'back'}}};e.scenes[0].steps=[{do:action(name,{object:'bag',hand:'left',dur:1})},{wait:1}];const c=build(e);
  const before=sampleScene(c,.65-1e-6),after=sampleScene(c,.65+1e-6);assert.equal(before.objects.bag.owner.slot,'back');assert.equal(after.objects.bag.owner.hand,'left');assert.ok(distance(before.objects.bag.point,after.objects.bag.point)<.02,view);
  assert.ok(distance(sampleScene(c,.65).objects.bag.point,sampleScene(c,.65).actors.tomas.rig.anchors.leftHand)<.02);
 }
});

test('initial scene state needs no entering animation, and rejects contradictory ownership',()=>{
 const e=episode('aula');e.scenes[0].actors=[{id:'tomas',start:{seated:'seat-tomas',holding:{right:{object:'book',carry:'chest',hug:true}},wearing:'bag',view:'3q-left',expression:'think'}}];e.scenes[0].objects={book:{prop:'notebook'},bag:{prop:'backpack'}};
 const c=build(e),a=sampleScene(c,0).actors.tomas;assert.equal(a.rig.anchors.pelvisBottom[1],816);assert.equal(a.pose.view,'3q-left');assert.equal(a.face.expression,'think');assert.ok(a.pose.hands.right[1]<.1);assert.equal(sampleScene(c,0).objects.bag.owner.slot,'back');assert.equal(c.scenes[0].events.length,0);
 e.scenes[0].objects.book.owner={actor:'tomas',hand:'left'};assert.throws(()=>build(e),/contradice/);
});

test('every seated reaction preserves the seat and both planted feet, including shock',()=>{
 for(const kind of ['surprise','shock','laugh','shy','worry','annoyed','relief']){
  const e=episode('aula');e.scenes[0].actors.tomas.start={seated:'seat-tomas'};e.scenes[0].steps=[{do:action('react',{kind,dur:1.2})}];const c=build(e),base=sampleScene(c,0).actors.tomas;
  for(let t=.01;t<1.2;t+=.04){const a=sampleScene(c,t).actors.tomas;assert.equal(a.pose.rootY,base.pose.rootY);assert.equal(a.rig.anchors.pelvisBottom[1],816);for(const side of ['left','right']){assert.equal(a.support[side].planted,true);assert.ok(distance(a.rig.anchors[side+'Foot'],base.rig.anchors[side+'Foot'])<.001);}}
 }
});

test('shock touches ipsilateral cheeks rather than crossing in front of the mouth',()=>{
 for(const view of ['front','3q-left','3q-right','side-left','side-right']){const e=episode();e.scenes[0].actors.tomas.view=view;e.scenes[0].steps=[{do:action('react',{kind:'shock',dur:1.2})}];const a=sampleScene(build(e),.6).actors.tomas;
  for(const [side,sign]of [['left',-1],['right',1]]){const hand=a.rig.anchors[side+'Hand'],head=a.rig.anchors.head,arm=a.rig.limbs[side].arm;assert.ok((hand[0]-head[0])*sign>60);assert.ok(Math.abs(hand[1]-head[1]-a.rig.scale*.045)<.1);assert.ok((arm.joint[0]-arm.origin[0])*sign>0,'elbow opens outward');}
 }
});

test('eat accepts item and legacy spoon+plate; icecream has three L/tongue cycles, speech keeps priority',()=>{
 const e=episode('aula');e.scenes[0].actors.tomas.start={seated:'seat-tomas'};e.scenes[0].objects={cone:{prop:'icecream',owner:{actor:'tomas',hand:'right'}}};e.scenes[0].steps=[{do:action('eat',{item:'cone',dur:3})}];const c=build(e);assert.equal(c.scenes[0].events[0].cycles,3);
 for(const t of [.5,1.5,2.5]){const a=sampleScene(c,t).actors.tomas,m=mouthShape(a.face);assert.equal(a.face.viseme,'L');assert.ok(m.tongue>.8);assert.equal(a.speech.voiced,false);}
 for(const t of [0,1,2,3])assert.equal(mouthShape(sampleScene(c,t).actors.tomas.face).h,0);
 const withSpeech=structuredClone(e);withSpeech.scenes[0].steps=[{say:'L02'}];withSpeech.scenes[0].actions=[action('eat',{item:'cone',dur:3})];const voiced=build(withSpeech);for(let t=0;t<3;t+=.05){const a=sampleScene(voiced,t).actors.tomas;if(a.speech.voiced)assert.deepEqual(a.face.viseme,a.speech.viseme);}
});

test('dolly interpolates zoom both directions; pan moves continuously and arbitrary seeks are stable',()=>{
 for(const [zoomFrom,zoomTo]of [[1.5,1],[1,1.5]]){const e=episode();e.scenes[0].steps=[{wait:4}];e.scenes[0].camera=[{type:'wide',target:'tomas',move:'dolly',zoomFrom,zoomTo,ease:'linear',dur:4,locked:true}];const c=build(e),baseEpisode=structuredClone(e);baseEpisode.scenes[0].camera[0]={type:'wide',target:'tomas',move:'dolly',zoomFrom:1,zoomTo:1,locked:true,dur:4};const baseHeight=cameraAt(build(baseEpisode),0).h;
  assert.ok(Math.abs(cameraAt(c,0).h-baseHeight/zoomFrom)<.001);assert.ok(Math.abs(cameraAt(c,4).h-baseHeight/zoomTo)<.001);assert.ok(Math.abs(cameraAt(c,2).h-baseHeight/((zoomFrom+zoomTo)/2))<.001);
  const values=[0,.7,1.1,2,3.8].map(t=>cameraAt(c,t));[3.8,2,1.1,.7,0].forEach((t,i)=>assert.deepEqual(cameraAt(c,t),values[4-i]));
 }
 const e=episode();e.scenes[0].camera=[{type:'medium',target:'nico',fromTarget:'tomas',move:'pan',dur:3,locked:true}];const c=build(e);assert.ok(cameraAt(c,2.9).cx>cameraAt(c,.1).cx+150);assert.ok(Math.abs(cameraAt(c,1.5+1e-6).cx-cameraAt(c,1.5-1e-6).cx)<.001);
});

test('cut/fade/wipe/dip-white are distinct, opaque and seek-deterministic without shifting timing',()=>{
 const middle=[];for(const type of ['cut','fade','wipe','dip-white']){
  const e=episode();e.scenes[0].steps=[{wait:2}];e.scenes.push({...structuredClone(e.scenes[0]),set:'parque',actors:{tomas:{at:'bench-seat-left'},nico:{at:'bench-seat-right'}},transition:type,dur:1});const c=build(e);assert.equal(c.duration,4);assert.equal(c.scenes[1].t0,2);
  const times=[1.99,2,2.25,2.5,2.75,3,3.2],hashes=times.map(t=>hash(c,t));for(let i=times.length-1;i>=0;i--)assert.equal(hash(c,times[i]),hashes[i]);middle.push(hash(c,2.5));
  const canvas=createCanvas(108,192);renderFrame(canvas.getContext('2d'),c,2.5);const data=canvas.data();for(let i=3;i<data.length;i+=4)assert.equal(data[i],255);
  if(type==='dip-white')assert.ok(data.every(v=>v===255));assert.equal(transitionAt(c,3),null);
 }
 assert.equal(new Set(middle).size,4);
});

test('all autonomous gestures and head-anchored FX work without a spoken line',()=>{
 const poses=[];for(const kind of GESTURE_NAMES){const e=episode();e.scenes[0].steps=[{do:action('gesture',{kind,dur:1.2,intensity:.8})}];const c=build(e),a=sampleScene(c,.5).actors.tomas;assert.equal(mouthShape(a.face).h,0);poses.push(JSON.stringify([a.pose.hands,a.pose.handShapes,a.pose.headTilt,a.pose.headTurn]));assert.equal(JSON.stringify(sampleScene(c,.5)),JSON.stringify(sampleScene(c,.5)));}
 assert.equal(new Set(poses).size,GESTURE_NAMES.length);
 for(const kind of FX){const e=episode();e.scenes[0].steps=[{do:action('fx',{kind,offset:[-.2,-.1],size:1.5,intensity:.7})}];const c=build(e),fx=sampleScene(c,.5).actors.tomas.fx[0];assert.equal(fx.type,kind);assert.equal(fx.size,1.5);assert.deepEqual(fx.offset,[-.2,-.1]);assert.equal(fx.intensity,.7);}
});

test('two-shot fills at least 55% of the complete frame and protects hands above subtitles',()=>{
 const e=episode();e.scenes[0].actors.nico.character='tomas';e.scenes[0].steps=[{say:'L02'}];e.scenes[0].camera=[{type:'two',targets:['tomas','nico'],locked:true}];const c=build(e),s=sampleScene(c,.1),cam=cameraAt(c,.1);
 const a=s.actors.tomas,top=worldToScreen([a.pose.x,a.bounds[1]],cam)[1],feet=worldToScreen([a.pose.x,a.bounds[3]],cam)[1],occupancy=(feet-top)/cam.viewportHeight;
 assert.ok(occupancy>=.55&&occupancy<=.78,`occupancy ${occupancy}`);assert.ok(feet<=1920);for(const side of ['left','right'])assert.ok(worldToScreen(a.rig.anchors[side+'Hand'],cam)[1]<1340);
});

test('unknown capabilities give the exact path and valid alternatives before AJV union errors',async()=>{
 for(const [change,pattern]of [[s=>s.steps=[{do:action('fly')}],/\.action:.*stow/],[s=>s.steps=[{do:action('gesture',{kind:'dance'})}],/\.kind:.*shrug/],[s=>s.steps=[{do:action('fx',{kind:'smoke'})}],/\.kind:.*sweat/],[s=>s.transition='spin',/\.transition:.*dip-white/],[s=>s.camera=[{type:'two',move:'orbit'}],/\.move:.*dolly/]]){const e=episode();change(e.scenes[0]);assert.throws(()=>build(e),pattern);}
 const dir=await mkdtemp(join(tmpdir(),'vida-capacidades-invalid-'));try{const e=episode();e.scenes[0].steps=[{do:action('fly')}];const file=join(dir,'episode.json');await writeFile(file,JSON.stringify(e));await assert.rejects(validateEpisodeFile(file),/Alternativas válidas:.*unstow/);}finally{await rm(dir,{recursive:true,force:true});}
});

test('review excludes hidden, pocket and off-plate objects while still detecting a visible crop',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'vida-capacidades-review-'));try{
  const e=episode();e.resources={timing:source.paths.timing,audioBase:source.paths.audioBase};e.scenes[0].objects={pocket:{prop:'phone',owner:{actor:'tomas',slot:'pocket'}},hidden:{prop:'cup',owner:{anchor:[-500,-500]},hidden:true},outside:{prop:'cup',owner:{anchor:[900,-2000]}}};
  const file=join(dir,'episode.json');await writeFile(file,JSON.stringify(e));execFileSync(process.execPath,[join(ROOT,'tools/review.mjs'),file,dir,'--view','portrait','--framing','tight','--every','2'],{stdio:'pipe'});const m=JSON.parse(await readFile(join(dir,e.id+'-metrics.json')));assert.equal(m.passed,true);assert.equal(m.framing.object_crop_frames,0);assert.ok(m.framing.hidden_objects>0);
  e.scenes[0].objects.crop={prop:'cup',owner:{anchor:[880,700]}};e.scenes[0].camera=[{type:'wide',target:'tomas',dur:3,locked:true}];const fitted=cameraAt(build(e),0);e.scenes[0].camera[0].offset=[850-(fitted.x+fitted.w),0];await writeFile(file,JSON.stringify(e));assert.throws(()=>execFileSync(process.execPath,[join(ROOT,'tools/review.mjs'),file,dir,'--view','portrait','--framing','tight','--every','2'],{stdio:'pipe'}));const bad=JSON.parse(await readFile(join(dir,e.id+'-metrics.json')));assert.ok(bad.framing.object_crop_frames>0);
 }finally{await rm(dir,{recursive:true,force:true});}
});
