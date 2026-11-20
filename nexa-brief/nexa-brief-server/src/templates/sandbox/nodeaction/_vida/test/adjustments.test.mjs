import test from 'node:test';
import {createCanvas} from '@napi-rs/canvas';
import {renderFrame} from '../engine/render.js';
import assert from 'node:assert/strict';
import {loadEpisode} from '../tools/runtime.mjs';
import {compile} from '../engine/core/compile.js';
import {ACTIONS} from '../engine/act/index.js';
import {GESTURES} from '../engine/act/gestures.js';
import {sampleScene} from '../engine/core/sample.js';
import {cameraAt} from '../engine/camera/index.js';
import {inspectEpisode} from '../engine/core/inspect.js';
import {conversationDistance} from '../engine/core/staging.js';
import {gaitPose,resolveSkeleton,VIEWS} from '../engine/rig/skeleton.js';
import {subtitleAt,subtitleY} from '../engine/ui/index.js';
import {alignScript,emotionFace} from '../engine/core/dialogue.js';

const c=await loadEpisode(new URL('../../vida-en-escena/assets/episodes/prueba-corta.json',import.meta.url).pathname,{images:false});
const minimal=()=>({version:1,id:'adjustments',scenes:[{set:'escuela-entrada',actors:{tomas:{at:'enter-left'},nico:{at:'meet'}},steps:[{wait:18}]}]});
const build=ep=>compile(ep,c.timing,c.catalog);
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);

test('walk and gait: forward knee branch in five views and both directions; profile by .25 s',()=>{
 for(const view of Object.keys(VIEWS))for(const dir of [-1,1]){
  const event=ACTIONS.walk.plan({params:{to:dir*200,view},from:[0,960],fromView:view,scale:560,dur:2,resolve:x=>[x,960]});event.dur=2;event.t0=0;
  for(let t=0;t<=2;t+=1/120){const p=ACTIONS.walk.sample(event,t).pose,rig=resolveSkeleton(c.catalog.characters.tomas,{...p,scale:560});
   if(t>.25&&t<1.6)assert.equal(p.view,dir);
   for(const side of ['left','right']){const l=rig.limbs[side].leg,dx=l.end[0]-l.origin[0],dy=l.end[1]-l.origin[1];assert.ok(dir*(dx*(l.joint[1]-l.origin[1])-dy*(l.joint[0]-l.origin[0]))<=1e-8);}
  }
  assert.equal(ACTIONS.walk.sample(event,2).pose.view,VIEWS[view]);
  for(let d=0;d<1;d+=.013){const rig=resolveSkeleton(c.catalog.characters.tomas,gaitPose(d,{view,direction:dir}));for(const side of ['left','right']){const l=rig.limbs[side].leg;assert.ok(dir*((l.end[0]-l.origin[0])*(l.joint[1]-l.origin[1])-(l.end[1]-l.origin[1])*(l.joint[0]-l.origin[0]))<=1e-8);}}
 }
});

test('world foot support stays below 2 px in both directions and all starting views',()=>{
 for(const view of Object.keys(VIEWS))for(const dir of [-1,1]){const e=minimal();e.scenes[0].actors={tomas:{at:dir>0?400:1000,view}};e.scenes[0].steps=[{do:{who:'tomas',action:'walk',to:dir>0?700:700,dur:2,view}}];const x=build(e),contacts=new Map();let max=0;
  for(let t=0;t<2;t+=1/120){const a=sampleScene(x,t).actors.tomas;for(const side of ['left','right']){const s=a.support[side];if(!s.planted)continue;const p=a.rig.anchors[side+'Foot'];if(contacts.has(s.contact))max=Math.max(max,distance(p,contacts.get(s.contact)));else contacts.set(s.contact,p);assert.ok(Math.abs(a.pose.footAngles[side]??0)<1e-8);}}
  assert.ok(max<2,`${view}, ${dir}: ${max}`);
 }
});

test('walk stops at a conversation gap before an occupied anchor and faces the occupant',()=>{
 for(const to of ['meet','nico','arrive',820]){const e=minimal();e.scenes[0].steps=[{do:{who:'tomas',action:'walk',to,dur:1.5}},{wait:.5}];const x=build(e),s=sampleScene(x,1.7),a=s.actors.tomas,b=s.actors.nico;
  assert.ok(Math.abs(a.pose.x-b.pose.x)>=conversationDistance(a,b)-.001);assert.equal(a.look,'nico');assert.deepEqual(a.face.lookAt,b.rig.anchors.head);
 }
 const e=minimal();e.scenes[0].actors.tomas.at=1300;e.scenes[0].steps=[{do:{who:'tomas',action:'walk',to:'meet',dur:1.5}}];const s=sampleScene(build(e),1.5);assert.ok(s.actors.tomas.pose.x>s.actors.nico.pose.x);
});

test('validate inspection warns for >.3 s head overlap, with pair-specific interaction exemptions',()=>{
 const e=minimal();e.scenes[0].actors.tomas.at=790;e.scenes[0].steps=[{wait:.7}];assert.ok(inspectEpisode(build(e)).warnings.some(w=>w.code==='head-overlap'&&w.path==='$.scenes[0].actors'));
 e.scenes[0].steps=[{do:{who:'tomas',action:'highfive',to:'nico',dur:.7}}];assert.equal(inspectEpisode(build(e)).head_overlaps.length,0);
 e.scenes[0].steps=[{wait:.3}];assert.equal(inspectEpisode(build(e)).head_overlaps.length,0);
});

test('subtitles reproduce every script token and preserve original Whisper anchors/times',()=>{
 for(const line of c.lines){assert.equal(line.subtitleWords.map(w=>w.w).join(' '),line.text);assert.deepEqual(line.subtitleWords.map(({s,e})=>[s,e]),line.words.map(({s,e})=>[s,e]));}
 assert.equal(c.lines.find(l=>l.id==='L05').words[5].w,'10');assert.match(subtitleAt(c,10.95).text,/diez/);
 const e=minimal();e.script=[{id:'L01',who:'nico',text:'¡TOMÁS! Llegas tarde... y despeinado.'}];e.scenes[0].steps=[{say:'L01'}];assert.equal(build(e).lines[0].subtitleWords[0].w,'¡TOMÁS!');
 const warnings=[],aligned=alignScript([{w:'Hola',s:0,e:.2},{w:'cosa',s:.2,e:.4},{w:'amigo',s:.4,e:.6}],'¡Hola! mundo, amigo.','$.say',warnings);assert.deepEqual(aligned.map(w=>w.w),['¡Hola!','cosa','amigo.']);assert.equal(warnings.length,1);
 const skipped=[];const recovered=alignScript([{w:'Hola',s:0,e:.2},{w:'eh',s:.2,e:.4},{w:'amigo',s:.4,e:.6}],'Hola amigo.','$.say',skipped);assert.deepEqual(recovered.map(w=>w.w),['Hola','eh','amigo.']);assert.equal(skipped.length,1);
});

test('emotion words map through data; say face and intensity override; listener reacts halfway',()=>{
 const cases={alegre:'smile','alegre, burlón':'smirk','pánico':'shock','tímido':'shy',aliviado:'smile','escéptica':'skeptical',riendo:'laugh',susurrando:'think',orgulloso:'grin','cariñosa':'love',curioso:'think',cansado:'worry'};
 for(const [text,expression] of Object.entries(cases))assert.equal(emotionFace(text,c.catalog.emotions).expression,expression,text);
 const e=minimal();e.script=[{id:'L01',who:'nico',text:c.lines[0].text,emotion:'pánico'}];e.scenes[0].steps=[{say:'L01',listen:{react:'skeptical'}}];let x=build(e);assert.equal(x.lines[0].faceState.expression,'shock');assert.equal(sampleScene(x,2.7).actors.tomas.face.expression,'skeptical');
 e.scenes[0].steps[0].face='smile';e.scenes[0].steps[0].intensity=.4;x=build(e);assert.deepEqual(x.lines[0].faceState,{expression:'smile',intensity:.4});
 delete e.scenes[0].steps[0].listen;x=build(e);assert.equal(sampleScene(x,2.7).actors.tomas.face.expression,'surprise');
 const listener=x.scenes[0].events.find(e=>e.action==='listen');const p=listener.pauses[0];assert.ok(Math.abs(ACTIONS.listen.sample(listener,p+.175).pose.headTilt-Math.PI/30)<1e-10);
});

test('six distinct large gestures per intent with anticipation, held accents and index silhouettes',()=>{
 for(const [intent,bank] of Object.entries(GESTURES)){assert.ok(bank.length>=6);assert.equal(new Set(bank.map(g=>JSON.stringify(g))).size,bank.length);const event=ACTIONS.talk.plan({params:{intent},dur:3,line:c.lines[0]});assert.ok(event.accents.every(a=>a.hold>=.3&&a.hold<=.8));}
 const ask=ACTIONS.talk.sample({intent:'ask',accents:[{at:1,index:0,hold:.7}]},1.3).pose;assert.ok(ask.hands.left[0]<-.22&&ask.hands.right[0]>.22);assert.ok(ask.hands.left[1]<0&&ask.hands.right[1]<0);
 const exclaim=ACTIONS.talk.sample({intent:'exclaim',accents:[{at:1,index:1,hold:.5}]},1.3).pose;assert.equal(exclaim.handShapes.right,'point');
 const occupied=ACTIONS.talk.sample({intent:'exclaim',heldHands:['left'],accents:[{at:1,index:0,hold:.5}]},1.3).pose;assert.ok(occupied.hands.right[1]<-.15);assert.equal(occupied.handShapes.right,'point');
 const shock=ACTIONS.react.sample({kind:'shock',intensity:1,dur:1.2},.65);assert.ok(shock.pose.hands.left[1]<-.15&&shock.pose.hands.right[1]<-.15);
});

test('director alternates coverage, never cuts by the clock, bounds action scenes to six seconds and whips rapid turns',()=>{
 // Contrato de cámara nuevo: una escena sin acciones ni líneas permanece en una toma (sin cortes por reloj).
 let e=minimal();let x=build(e);assert.ok(x.scenes[0].cameraPlan.every(s=>s.t1-s.t0>=1.2));
 e.scenes[0].camera=[{type:'two',targets:['tomas','nico'],at:0,dur:18}];/* un override explícito del JSON manda: se respeta los 18 s */assert.ok(build(e).scenes[0].cameraPlan.some(s=>s.type==='two'&&s.t1-s.t0>=17.9));
 for(const action of [{who:'tomas',action:'walk',to:550,dur:15},{who:'tomas',action:'react',kind:'shock',dur:15}]){const long=minimal();long.scenes[0].steps=[{do:action}];/* acción larga: o se corta, o la toma se mueve (seguimiento/empuje); nunca un encuadre fijo > 6 s */assert.ok(build(long).scenes[0].cameraPlan.every(s=>s.t1-s.t0<=6||s.move!=='fixed'));}
 e=structuredClone(c.episode);delete e.scenes[0].camera;x=build(e);/* director nuevo: cortes motivados (nada < 1,2 s salvo whip/insert) y empuje suave sobre quien habla */assert.ok(x.scenes[0].cameraPlan.every(s=>s.type==='insert'||s.transition==='whip'||s.t1-s.t0>=1.2));assert.ok(x.scenes[0].cameraPlan.some(s=>s.move==='push'));
 const timing=structuredClone(c.timing);timing.lines.L02.dur=17;timing.lines.L02.rms=Array(1700).fill(.2);e=minimal();e.scenes[0].steps=[{say:'L02'}];x=compile(e,timing,c.catalog);/* línea de 17 s: sin cortes por reloj, pero la toma larga nunca queda fija (drift) */assert.ok(x.scenes[0].cameraPlan.every(s=>s.t1-s.t0<=6||s.move!=='fixed'));
});

test('insert restores the exact preceding optical rectangle, also after a moving/punch shot',()=>{
 const result=inspectEpisode(c);assert.ok(result.camera.insert_returns.length);assert.ok(result.camera.insert_returns.every(r=>r.max_rect_error_px===0));
 const e=structuredClone(c.episode);e.scenes[0].camera=[{type:'close',target:'nico',move:'punch',at:8.3,dur:.97},{type:'insert',target:'cuaderno',move:'follow',at:9.27,dur:1.1}];e.framing='tight';const x=build(e),before=cameraAt(x,9.27-1e-6),after=cameraAt(x,10.37);for(const k of ['x','y','w','h','viewportHeight'])assert.equal(before[k],after[k]);
});

test('subtitle band contains glyphs; medium/two keep hands and carried objects above 1340',()=>{
 const y=subtitleY(c.episode.ui.subtitles),size=c.episode.ui.subtitles.size;assert.ok(y-size*.6-5>=1360&&y+size*.6+5<=1500);
 const safe=inspectEpisode(c).subtitle_safe;assert.ok(safe.samples>50);assert.deepEqual(safe.violations,[]);
 for(let t=0;t<c.duration;t+=1/30){const state=sampleScene(c,t),cam=cameraAt(c,t,state);if(cam.type==='two'&&!cam.transitioning)for(const id of cam.targets){const a=state.actors[id];assert.ok(a.bounds[0]>=cam.x-2&&a.bounds[2]<=cam.x+cam.w+2,`gesto recortado ${id} @ ${t}`);}}
});

test('hold supports four persistent carry modes; give raises from each without a transfer jump',()=>{
 const targets=[];
 for(const carry of ['side','chest','front','behind']){const e=minimal();e.scenes[0].actors.tomas.at='arrive';e.scenes[0].objects={book:{prop:'notebook',owner:{actor:'tomas',hand:'right'}}};e.scenes[0].steps=[{do:{who:'tomas',action:'hold',object:'book',carry,dur:.6}},{wait:.4},{do:{who:'tomas',action:'give',object:'book',to:'nico',recipientHand:'left',dur:1.2}}];const x=build(e),a=sampleScene(x,.9).actors.tomas;targets.push(a.pose.hands.right);assert.equal(sampleScene(x,.9).objects.book.carry,carry);
  for(const t of [1,1.6,2.2])assert.ok(distance(sampleScene(x,t-1e-6).objects.book.point,sampleScene(x,t+1e-6).objects.book.point)<.02,carry+' @ '+t);
 }
 assert.equal(new Set(targets.map(p=>JSON.stringify(p))).size,4);assert.ok(targets[0][1]>.26);assert.ok(targets[1][1]<.1);
});


test('blurred plates and safe floor extension stay opaque for native premultiplied RGBA export',async()=>{
 const compiled=await loadEpisode(new URL('../../vida-en-escena/assets/episodes/prueba-corta.json',import.meta.url).pathname);const canvas=createCanvas(270,480),ctx=canvas.getContext('2d');
 for(const t of [0,1.5,2.3,5.05,6.2,8.4,9.82,10.8,12.9,14]){renderFrame(ctx,compiled,t);const pixels=canvas.data();for(let i=3;i<pixels.length;i+=4)assert.equal(pixels[i],255,`alpha @ ${t}`);}
});
