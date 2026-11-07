import test from 'node:test';
import assert from 'node:assert/strict';
import Ajv from 'ajv/dist/2020.js';
import {readFile} from 'node:fs/promises';
import {loadEpisode} from '../tools/runtime.mjs';
import {compile} from '../engine/core/compile.js';
import {cameraAt,MOVES} from '../engine/camera/index.js';
import {collectCameraTrace,cameraMetrics} from '../engine/camera/metrics.js';
import {sampleScene} from '../engine/core/sample.js';
const c=await loadEpisode(new URL('../../vida-en-escena/assets/episode.json',import.meta.url).pathname,{images:false}),schema=JSON.parse(await readFile(new URL('../schema/episode.schema.json',import.meta.url),'utf8')),validate=new Ajv({strict:false,allErrors:true}).compile(schema);
const ep=()=>({version:1,id:'camera-contract',camera:{style:'estable',handheld:0},scenes:[{set:'escuela-entrada',actors:{tomas:{at:'arrive'},nico:{at:'meet'}},steps:[{wait:6}],camera:[{type:'close',target:'tomas',move:'hold',dur:3},{type:'close',target:'tomas',move:'push',at:3,dur:3,transition:'move'}]}]});
const build=e=>compile(e,c.timing,c.catalog);
test('camera schema admits every move, endpoint, preset and monotone Bezier; rejects unknown fields',()=>{
 for(const move of MOVES){const e=ep();Object.assign(e.scenes[0].camera[0],{move,preset:'tercios',ease:[.25,.1,.75,.9],from:{zoom:.9,offset:[0,2],target:'tomas'},to:{zoom:1,target:'nico'},ramp:1.8,settle:.2,headroom:.06,leadRoom:.08,thirds:true,lens:1});assert.ok(validate(e),JSON.stringify(validate.errors));assert.doesNotThrow(()=>build(e));}
 for(const mutate of [e=>e.camera.smoothing=0,e=>e.camera.extra=true,e=>e.scenes[0].camera[0].from={extra:1},e=>e.scenes[0].camera[0].ramp=-1,e=>e.scenes[0].camera[0].ease=[0,2,1,0]]){const e=ep();mutate(e);assert.equal(validate(e),false);}
});
for(const view of ['portrait','landscape']){
 test(`camera ${view}: continuous transition also preserves derivatives at its boundary`,()=>{
  const e=ep();e.camera.handheld=.1;const x=build(e),a=cameraAt(x,3-1e-7,undefined,{view}),b=cameraAt(x,3,undefined,{view});for(const k of ['h','cx','cy'])assert.ok(Math.abs(a[k]-b[k])<.01);
  const m=cameraMetrics(collectCameraTrace(x,cameraAt,sampleScene,{view}),x.camera.config);assert.ok(m.criteria.camara_continuidad);assert.ok(m.criteria.camara_velocidad);assert.ok(m.criteria.camara_aceleracion);assert.ok(m.criteria.camara_jerk);assert.ok(cameraAt(x,5.99,undefined,{view}).h<a.h*.99,'push must remain visible after a hold');
 });
 test(`camera ${view}: declared headroom and leadRoom are protected`,()=>{
  const e=ep();e.scenes[0].camera=[{type:'close',target:'tomas',move:'hold',headroom:.08,leadRoom:.12,preset:'tercios',locked:true}];const x=build(e);for(let t=0;t<6;t+=.19){const cam=cameraAt(x,t,undefined,{view});assert.ok(cam.composition.headroomOK);assert.ok(cam.composition.leadRoomOK);}
 });
 test(`camera ${view}: pan endpoints produce visible translation while retaining fit`,()=>{
  const e=ep();e.scenes[0].camera=[{type:'medium',target:'nico',move:'pan',from:{target:'tomas'},to:{target:'nico'},locked:true}];const x=build(e),a=cameraAt(x,0,undefined,{view}),b=cameraAt(x,5.99,undefined,{view});assert.ok(b.cx>a.cx+10);
 });
}
