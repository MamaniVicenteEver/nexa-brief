import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas} from '@napi-rs/canvas';
import {createHash} from 'node:crypto';
import {loadEpisode} from '../tools/runtime.mjs';
import {compile} from '../engine/core/compile.js';
import {sampleScene,cameraAt,renderFrame} from '../engine/render.js';
import {resolveView,viewportView} from '../engine/core/view.js';
import {actorBounds,paintedObjectBounds} from '../engine/core/bounds.js';
import {framingAt,plateIntegrity} from '../engine/core/framing.js';
import {drawCharacter,resolveSkeleton} from '../engine/index.js';

const episodes=await Promise.all(['vida-en-escena','vida-en-escena-heladeria'].map(id=>loadEpisode(new URL(`../../${id}/assets/episode.json`,import.meta.url).pathname)));
for(const c of episodes)for(const view of ['landscape','portrait']){
 test(`${c.episode.id} ${view}: all actors, hair, feet and held objects inside 3% safe area at cuts and throughout motion`,()=>{
  const times=[...new Set([30,...c.scenes.flatMap(s=>s.cameraPlan.flatMap(p=>[p.t0,Math.max(p.t0,p.t1-1/300)])),...Array.from({length:Math.ceil(c.duration*4)},(_,i)=>i/4)])].filter(t=>t<c.duration);
  for(const t of times){const s=sampleScene(c,t),cam=cameraAt(c,t,s,{view});assert.ok(Math.abs(cam.w/cam.h-resolveView(view).w/resolveView(view).h)<1e-10);const boxes=framingAt(s,cam,c.episode.ui?.subtitles!==false&&c.lines.some(l=>l.scene===s.scene.id));assert.ok(boxes.every(b=>b.ok),`${t}: ${JSON.stringify(boxes.filter(b=>!b.ok))}`);if(!['close','insert'].includes(cam.type))assert.equal(boxes.length,Object.keys(s.actors).length);}
 });
 test(`${c.episode.id} ${view}: reverse seeks, view switching and repeated rendering are deterministic`,()=>{
  const canvas=createCanvas(view==='landscape'?320:180,view==='landscape'?180:320),ctx=canvas.getContext('2d');const hash=t=>{renderFrame(ctx,c,t,{view});return createHash('sha256').update(canvas.data()).digest('hex');};
  const times=Array.from({length:12},(_,i)=>i*(c.duration-.1)/11),hashes=times.map(hash);for(let i=11;i>=0;i--){cameraAt(c,times[i],undefined,{view:view==='portrait'?'landscape':'portrait'});assert.equal(hash(times[i]),hashes[i]);}
 });
}
test('t=30 principal protects both Tomás and Nico in both orientations',()=>{
 for(const view of ['landscape','portrait']){const s=sampleScene(episodes[0],30),cam=cameraAt(episodes[0],30,s,{view});assert.deepEqual(cam.targets,['tomas','nico']);assert.ok(framingAt(s,cam).every(b=>b.ok));}
});
test('fit:false preserves explicit tight portrait optics; default fit repairs the same aggressive override',()=>{
 const source=episodes[0],ep={version:1,id:'fit-false',scenes:[{set:'escuela-entrada',actors:{tomas:{at:'arrive'},nico:{at:'meet'}},steps:[{wait:2}],camera:[{type:'medium',target:'tomas',zoom:3,offset:[800,0],locked:true,fit:false}]}]};
 const make=()=>compile(ep,source.timing,source.catalog);let c=make(),a=cameraAt(c,.5),b=cameraAt(c,.5,undefined,{framing:'tight'});for(const k of ['x','y','w','h'])assert.equal(a[k],b[k]);assert.equal(a.fit,false);
 delete ep.scenes[0].camera[0].fit;c=make();a=cameraAt(c,.5);assert.equal(a.fit,true);assert.equal(a.overrideAdjusted,true);assert.ok(framingAt(sampleScene(c,.5),a,false).every(b=>b.ok));
 ep.scenes[0].camera[0].fit='false';assert.throws(make,/fit.*booleano/);
});
test('real rig geometry encloses every painted pixel, including spiky hair and rotated wave hands',()=>{
 const c=episodes[0],s=sampleScene(c,30),a=s.actors.tomas;a.pose.handShapes.left='wave';a.pose.handAngles.left=1.5;a.rig=resolveSkeleton(a.character,a.pose);
 const canvas=createCanvas(1536,1200),ctx=canvas.getContext('2d');drawCharacter(ctx,a.character,a.pose,a.face,30);
 const b=actorBounds(a,30),data=canvas.data();let painted=0;
 for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(data[(y*canvas.width+x)*4+3]>20){painted++;assert.ok(x>=Math.floor(b[0])-1&&x<=Math.ceil(b[2])+1&&y>=Math.floor(b[1])-1&&y<=Math.ceil(b[3])+1,`${x},${y} outside ${b}`);}
 assert.ok(painted>10000);
 const backpack={prop:'backpack',point:[500,500],angle:.4,scale:1,params:{}};const bb=paintedObjectBounds(backpack);assert.ok(bb[0]<450&&bb[1]<430,'include handle and side straps outside nominal prop rectangle');
});
test('padding is opaque, textured and feathered for every plate; removing padding fails the criterion',()=>{
 for(const c of episodes)for(const p of Object.values(c.resources.plates))assert.ok(plateIntegrity(p).ok);assert.equal(plateIntegrity({}).ok,false);
});
test('view selection uses viewport aspect including square, and forced view survives resize',()=>{
 assert.deepEqual(viewportView(1000,563),{orientation:'landscape',w:1920,h:1080});assert.deepEqual(viewportView(390,693),{orientation:'portrait',w:1080,h:1920});assert.equal(viewportView(500,500).orientation,'landscape');assert.equal(viewportView(390,693,'landscape').orientation,'landscape');assert.equal(viewportView(1000,563,'portrait').orientation,'portrait');assert.throws(()=>resolveView('square'),/view/);
});
test('compile remains pure, view independent and compatible with unmodified episode data',()=>{
 const c=episodes[0],before=JSON.stringify(c.episode),a=compile(c.episode,c.timing,c.catalog),b=compile(c.episode,c.timing,c.catalog);assert.deepEqual(a,b);cameraAt(a,30,undefined,{view:'landscape'});cameraAt(a,30,undefined,{view:'portrait'});assert.deepEqual(a,b);assert.equal(JSON.stringify(c.episode),before);
});
