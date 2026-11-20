import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas} from '@napi-rs/canvas';
import {loadEpisode} from '../tools/runtime.mjs';
import {compile} from '../engine/core/compile.js';
import {renderFrame,sampleScene} from '../engine/render.js';
import {seatSurfaceWarnings} from '../engine/core/inspect.js';
import {SPOON_BOWL} from '../engine/props/index.js';
import {rotate} from '../engine/core/math.js';
const source=await loadEpisode(new URL('../../vida-en-escena/assets/episode.json',import.meta.url).pathname);
const build=(episode,catalog=source.catalog)=>({...compile(episode,source.timing,catalog),resources:source.resources});
const chars=['tomas','nico','valeria','mama'],views=['front','3q-left','3q-right','side-left','side-right'];
const single=(id='tomas',view='front')=>({version:1,id:'pulido',scenes:[{set:'casa-comedor',actors:{[id]:{start:{seated:'seat-tomas',view}}},steps:[{wait:4}]}]});
const pixels=(c,t,w=216,h=384)=>{const canvas=createCanvas(w,h);renderFrame(canvas.getContext('2d'),c,t);return canvas.data();};
const cuts=c=>({...c,scenes:c.scenes.map(s=>({...s,transition:{type:'cut',dur:1}}))});
const maxError=(a,b)=>a.reduce((max,v,i)=>Math.max(max,Math.abs(v-b[i])),0);
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);

test('fade mixes complete frames, including UI, with every channel error < 2/255',()=>{
 const e=single();e.ui={title:{text:'CUADRO COMPLETO',dur:2.7}};e.scenes[0].steps=[{wait:2}];e.scenes.push({set:'parque',actors:{valeria:{start:{seated:'bench-seat-right'}}},steps:[{wait:2}],transition:'fade',dur:1});
 const synthetic=build(e);
 for(const c of [synthetic,source])for(const scene of c.scenes.filter(s=>s.transition.type==='fade')){
  const plain=cuts(c),out=pixels(plain,scene.t0-1e-6);
  for(const u of [0,.25,.5,.75,1]){const t=scene.t0+u*scene.transition.dur,q=u*u*(3-2*u),incoming=pixels(plain,t),expected=Float64Array.from(incoming,(v,i)=>out[i]*(1-q)+v*q),actual=pixels(c,t);
   assert.ok(maxError(actual,expected)<2,`fade ${u}: ${maxError(actual,expected)}/255`);
  }
 }
});

test('wipe clips complete images and dip-white mixes finished images through opaque white',()=>{
 for(const type of ['wipe','dip-white']){
  const e=single();e.scenes[0].steps=[{wait:2}];e.scenes.push({set:'parque',actors:{valeria:{start:{seated:'bench-seat-right'}}},steps:[{wait:2}],transition:type,dur:1});const c=build(e),plain=cuts(c),out=pixels(plain,2-1e-6);
  for(const u of [.25,.5,.75]){const q=u*u*(3-2*u),inc=pixels(plain,2+u),actual=pixels(c,2+u);
   for(let i=0;i<actual.length;i++){const x=(i/4|0)%216;if(type==='wipe'&&Math.abs(x-216*q)<1)continue;
    const expected=type==='wipe'?(x<216*q?inc[i]:out[i]):255*(1-Math.abs(2*q-1))+(q<.5?out[i]:inc[i])*Math.abs(2*q-1);
    assert.ok(Math.abs(actual[i]-expected)<2,`${type}, channel ${i}`);
   }
  }
 }
});

test('transition cannot silently fall back to per-shape alpha or an unrequested cut',()=>{
 const c={...source,resources:{...source.resources,createCanvas:undefined}},scene=c.scenes.find(s=>s.transition.type==='fade');assert.throws(()=>pixels(c,scene.t0+.2),/createCanvas.*cuadros completos/);
});

test('four characters in five views: pelvis rests exactly on seat, shins vertical, frontal thighs foreshortened',()=>{
 for(const id of chars)for(const view of views){const c=build(single(id,view)),a=sampleScene(c,1).actors[id],r=a.rig;
  assert.ok(Math.abs(r.anchors.pelvisBottom[1]-816)<1e-8,`${id}/${view}: seat contact`);
  for(const side of ['left','right']){const leg=r.limbs[side].leg;
   assert.ok(Math.abs(leg.joint[0]-leg.end[0])<1e-8,'vertical shin');assert.ok(Math.abs(r.anchors[side+'Foot'][1]-960)<1e-8,'floor contact');
   if(view==='front'){assert.ok(Math.abs(leg.joint[0]-leg.origin[0])<1e-8);assert.ok(dist(leg.origin,leg.joint)<.11,'short projected thigh');}
   if(view.startsWith('side'))assert.ok(Math.abs(leg.joint[0]-leg.origin[0])>.12,'profile thigh remains readable');
  }
  assert.ok(Math.abs(r.limbs.left.leg.joint[0]-r.limbs.right.leg.joint[0])<.085,'knees close together');
 }
});

test('sit defaults to facing 3q, allows front override and maintains contact during reaction and turn',()=>{
 for(const view of [undefined,'front']){const e=single();e.scenes[0].actors={tomas:{at:'seat-tomas',view:'front'}};e.scenes[0].steps=[{do:{who:'tomas',action:'sit',seat:'seat-tomas',...(view?{view}:{}),dur:1}},{do:{who:'tomas',action:'react',kind:'laugh',dur:1}},{do:{who:'tomas',action:'turn',view:'side-left',dur:1}}];const c=build(e);
  assert.equal(sampleScene(c,1).actors.tomas.pose.view,view?0:.5);
  for(let t=1;t<=3;t+=.05)assert.ok(Math.abs(sampleScene(c,t).actors.tomas.rig.anchors.pelvisBottom[1]-816)<1e-8);
 }
 const e=single();delete e.scenes[0].actors.tomas.start.view;e.scenes[0].actors.tomas.start.seated='seat-mama';assert.equal(sampleScene(build(e),0).actors.tomas.pose.view,'3q-left');
});

test('validate reports high and low surfaces only for furniture used while seated',()=>{
 assert.deepEqual(seatSurfaceWarnings(source),[]);
 for(const surfaceY of [675,750]){const catalog=structuredClone(source.catalog);catalog.sets['casa-comedor'].props.find(p=>p.prop==='table').params.surfaceY=surfaceY;
  const e=single(),warnings=seatSurfaceWarnings(build(e,catalog));assert.equal(warnings.length,1);assert.equal(warnings[0].code,'seat-surface-height');assert.match(warnings[0].message,/0.16–0.20/);assert.match(warnings[0].path,/start.seated/);
  e.scenes[0].actors.tomas={at:'seat-tomas'};assert.deepEqual(seatSurfaceWarnings(build(e,catalog)),[]);
  e.scenes[0].steps=[{do:{who:'tomas',action:'sit',seat:'seat-tomas',dur:1}}];assert.equal(seatSurfaceWarnings(build(e,catalog)).length,1);
 }
});

test('spoon bowl reaches the mouth in all views and stays below it between bites',()=>{
 for(const id of chars)for(const view of views){const e=single(id,view);e.scenes[0].objects={spoon:{prop:'spoon',owner:{actor:id,hand:'right'}},plate:{prop:'plate',owner:{anchor:[720,705]}}};e.scenes[0].actions=[{who:id,action:'eat',item:'spoon',plate:'plate',at:1,dur:2}];const c=build(e);
  for(const t of [0,2,4]){const s=sampleScene(c,t),a=s.actors[id],o=s.objects.spoon,tip=rotate(SPOON_BOWL,o.angle).map((v,i)=>o.point[i]+v*o.scale);
   assert.ok(dist(o.point,a.rig.anchors.rightHand)<1e-8,'grip');
   if(t===2)assert.ok(dist(tip,a.rig.anchors.mouth)<.01,`${id}/${view}: bowl contact ${dist(tip,a.rig.anchors.mouth)}`);
   else {assert.ok(tip[1]>a.rig.anchors.mouth[1]+60,'mouth visible at rest');assert.ok(Math.abs(tip[1]-705)<.01,'bowl at table');}
  }
 }
});
