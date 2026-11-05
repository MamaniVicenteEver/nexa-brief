import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas} from '@napi-rs/canvas';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {loadEpisode,ROOT} from '../tools/runtime.mjs';
import {compile} from '../engine/core/compile.js';
import {sampleScene,cameraAt,renderFrame} from '../engine/render.js';
import {compositionAt,createCompositionMetrics,recordComposition} from '../engine/core/composition.js';
import {worldToScreen} from '../engine/camera/index.js';

const source=await loadEpisode(new URL('../../vida-en-escena/assets/episode.json',import.meta.url).pathname);
const episode=()=>({version:1,framing:'tight',id:'framing-test',scenes:[{set:'escuela-entrada',actors:{tomas:{at:'a'},nico:{character:'tomas',at:'b'}},steps:[{wait:3}]}]});
function fixture(height,type,subtitles=false){
 const catalog=structuredClone(source.catalog),set=catalog.sets['escuela-entrada'];
 set.charHeight=height;set.props=[];set.anchors.a={x:768-height*.20,y:960,kind:'stand',facing:'front'};set.anchors.b={x:768+height*.20,y:960,kind:'stand',facing:'front'};
 const ep=episode();ep.ui={subtitles:subtitles?{}:false};ep.scenes[0].camera=[{type,targets:type==='two'?['tomas','nico']:undefined,target:type==='two'?undefined:'tomas',locked:true}];
 if(subtitles)ep.scenes[0].steps=[{say:'L02'}];
 return {...compile(ep,source.timing,catalog),resources:source.resources};
}

test('same anchored episode at charHeight 400/560/700 keeps two/medium/close subject scale within 5%, with and without dialogue',()=>{
 for(const subtitles of [false,true])for(const type of ['two','medium','close']){
  const ratios=[];
  for(const height of [400,560,700]){
   const c=fixture(height,type,subtitles),s=sampleScene(c,.3),cam=cameraAt(c,.3,s),a=s.actors.tomas;
   assert.equal(cam.type,type);assert.equal(cam.viewportHeight,1920);
   const subject=compositionAt(s,cam).subjects.find(x=>x.actor==='tomas');assert.ok(subject.ok,`${height} ${type}: ${subject.ratio}`);ratios.push(subject.ratio);
   assert.ok(compositionAt(s,cam).emptyFloor.ok);
   if(subtitles&&type!=='close')for(const actor of Object.values(s.actors).filter(a=>cam.targets.includes(a.id)))for(const side of ['left','right'])assert.ok(worldToScreen(actor.rig.anchors[side+'Hand'],cam)[1]<1340);
   assert.deepEqual(cameraAt(c,.3),cam);cameraAt(c,2.5);assert.deepEqual(cameraAt(c,.3),cam);
  }
  assert.ok(Math.max(...ratios)/Math.min(...ratios)<=1.05,`${type} subtitles=${subtitles}: ${ratios}`);
 }
});

test('composition catches small subjects, empty lower frame and excludes only opening wide floor',()=>{
 const c=fixture(400,'medium'),s=sampleScene(c,1),cam=cameraAt(c,1,s);
 const tiny={...cam,x:0,y:0,w:2160,h:3840};assert.ok(compositionAt(s,tiny).subjects.every(v=>!v.ok));
 const floor=compositionAt(s,{...cam,y:500,h:1000});assert.ok(floor.emptyFloor.ratio>.22&&!floor.emptyFloor.ok);
 assert.ok(compositionAt(s,{...cam,type:'wide',y:500,h:1000,shot:{t0:s.scene.t0}}).emptyFloor.ok);
 assert.equal(compositionAt(s,{...cam,type:'wide',y:500,h:1000,shot:{t0:s.scene.t0+.1}}).emptyFloor.ok,false);
 const close=cameraAt(fixture(400,'close'),1);assert.ok(compositionAt(s,{...close,h:1600}).subjects.every(v=>!v.ok));
 const metrics=createCompositionMetrics();recordComposition(metrics,s,tiny);assert.ok(metrics.sujeto_suficiente.failed_samples>0&&metrics.sin_suelo_vacio.failed_samples>0);
});

test('front occlusion uses painted torso and face regions; behind exempts only its referenced prop, seated only its own chair',()=>{
 const c=fixture(560,'medium'),s=sampleScene(c,1),cam=cameraAt(c,1,s),a=s.actors.tomas;
 const block={id:'obstacle',prop:'counter',layer:'front',x:a.pose.x,y:960,w:300,params:{h:650,surfaceY:310}};
 s.props=[block];let result=compositionAt(s,cam);assert.ok(result.occlusions.some(v=>v.actor==='tomas'&&!v.ok&&v.region==='face'));assert.ok(result.occlusions.some(v=>v.actor==='tomas'&&!v.ok&&v.region==='torso'));
 a.behind='obstacle';assert.ok(compositionAt(s,cam).occlusions.filter(v=>v.actor==='tomas').every(v=>v.ok));
 s.props.push({...block,id:'other'});assert.ok(compositionAt(s,cam).occlusions.some(v=>v.actor==='tomas'&&v.prop==='other'&&!v.ok));
 delete a.behind;a.seated=[a.pose.x,960];s.props=[block];assert.ok(compositionAt(s,cam).occlusions.some(v=>v.actor==='tomas'&&!v.ok));
 s.props=[{...block,prop:'chair'}];assert.ok(compositionAt(s,cam).occlusions.filter(v=>v.actor==='tomas').every(v=>v.ok));
 s.props=[{...block,layer:'back'}];assert.equal(compositionAt(s,cam).occlusions.length,0);
 // Empty space between legs is not an opaque tabletop.
 s.props=[{...block,prop:'table',params:{surfaceY:300}}];assert.ok(compositionAt(s,cam).occlusions.filter(v=>v.actor==='tomas').every(v=>v.ok));
});

test('behind is resolved from set anchor or actor, and invalid references are rejected',()=>{
 const ep={version:1,id:'behind',scenes:[{set:'heladeria',actors:{heladero:{at:'heladero'}},steps:[{wait:1}]}]};
 const build=()=>compile(ep,source.timing,source.catalog);assert.equal(sampleScene(build(),0).actors.heladero.behind,'mostrador');
 ep.scenes[0].actors.heladero={at:[570,720],behind:'mostrador'};assert.equal(sampleScene(build(),0).actors.heladero.behind,'mostrador');
 ep.scenes[0].actors.heladero.behind='missing';assert.throws(build,/actors.heladero.behind.*front/);
});

test('full-frame image extension is opaque, textured and deterministic beyond the plate',()=>{
 const c=fixture(700,'two',true),plate=createCanvas(1536,1024),pc=plate.getContext('2d');const gradient=pc.createLinearGradient(0,0,1536,1024);gradient.addColorStop(0,'#f03020');gradient.addColorStop(1,'#2070f0');pc.fillStyle=gradient;pc.fillRect(0,0,1536,1024);c.resources={...c.resources,plates:{'escuela-entrada':{image:plate}}};const canvas=createCanvas(270,480),ctx=canvas.getContext('2d');
 const state=renderFrame(ctx,c,.3);assert.ok(state.camera.y+state.camera.h>1024);
 const before=Buffer.from(canvas.data());for(let i=3;i<before.length;i+=4)assert.equal(before[i],255);
 const colors=new Set();for(let y=470;y<480;y++)for(let x=0;x<270;x++)colors.add(before.subarray((y*270+x)*4,(y*270+x)*4+3).toString('hex'));assert.ok(colors.size>20,'extension must retain image detail, not a solid stripe');
 renderFrame(ctx,c,2);renderFrame(ctx,c,.3);assert.deepEqual(Buffer.from(canvas.data()),before);
});

test('review CLI returns nonzero and named composition failures for a counter hiding an actor and a tiny face',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'vida-encuadre-review-'));
 try{
  const ep={version:1,framing:'tight',id:'bad-framing',resources:{timing:source.paths.timing,audioBase:source.paths.audioBase},scenes:[{set:'heladeria',actors:{tomas:{at:[570,960]}},steps:[{wait:.3}],camera:[{type:'close',target:'tomas',zoom:.5,locked:true}]}]};
  const path=join(dir,'episode.json');await writeFile(path,JSON.stringify(ep));const result=spawnSync(process.execPath,[join(ROOT,'tools/review.mjs'),path,dir,'--view','portrait','--framing','tight','--every','1'],{encoding:'utf8'});assert.equal(result.status,1,result.stderr);
  const m=JSON.parse(await readFile(join(dir,'bad-framing-metrics.json')));assert.equal(m.passed,false);assert.ok(m.failed.includes('sujeto_suficiente'));assert.ok(m.failed.includes('objeto_no_tapa_cuerpo'));
 }finally{await rm(dir,{recursive:true,force:true});}
});


test('fitted closing dolly keeps moving throughout its span and its fixed hold keeps the final rectangle',()=>{
 const shot=source.scenes.at(-1).cameraPlan.find(s=>s.move==='dolly'),values=Array.from({length:11},(_,i)=>cameraAt({...source,episode:{...source.episode,framing:'tight'}},shot.t0+(shot.t1-shot.t0)*i/10));
 for(let i=1;i<values.length;i++)assert.ok(values[i].h>values[i-1].h,`dolly stalled at sample ${i}`);
 assert.ok(values.at(-1).h/values[0].h>1.1);
 const after=cameraAt({...source,episode:{...source.episode,framing:'tight'}},shot.t1+.5);for(const k of ['x','y','w','h'])assert.ok(Math.abs(after[k]-values.at(-1)[k])<1e-6);
});
