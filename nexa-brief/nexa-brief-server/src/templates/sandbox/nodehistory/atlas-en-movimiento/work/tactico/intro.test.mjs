import test from 'node:test';
import assert from 'node:assert/strict';
import {Tactico,validateScene,create} from '../../../_tactico/core.js';
import {outroSchedule} from '../../../_tactico/components/intro.js';
const T=(x,f=0)=>typeof x==='number'?x:f;
const intro={...Tactico.get('intro.title').demo};
const outro={...Tactico.get('outro.channel').demo};
const scene={duration:14,camera:[{t:0,center:[53,24],zoom:4.7}],items:[intro,outro]};
function errors(patch={},which=0){const value=structuredClone(scene);Object.assign(value.items[which],patch);return validateScene(value).errors;}
test('defaults admit a six-second intro and eight-second ending, on HUD layer',()=>{
 assert.deepEqual(validateScene(scene).errors,[]);
 assert.equal(Tactico.get('intro.title').layer,90);assert.equal(Tactico.get('outro.channel').layer,90);
 assert.equal(Tactico.get('outro.channel').params.handle.default,'youtube.com/@nodehistory');
});
test('rejects missing focus, unknown style, excess duration and shifted intro',()=>{
 for(const patch of [{focus:'NoExiste'},{focus:[181,0]},{style:'v1'},{dur:6.01},{t:1},{title:''}])assert.ok(errors(patch).length,JSON.stringify(patch));
});
test('outro must end with the scene and retain a parameterized bare address',()=>{
 for(const patch of [{dur:8.01},{t:5},{handle:'@inventado'},{handle:''},{channel:''},{dim:1.1}])assert.ok(errors(patch,1).length,JSON.stringify(patch));
 assert.deepEqual(errors({handle:'youtube.com/@canal-confirmado'},1),[]);
});
test('all six requests are sequential and leave a final reading interval at 4, 6, 8 seconds',()=>{
 for(const dur of [4,6,8]){
  const times=Object.values(outroSchedule(dur));assert.equal(times.length,6);assert.equal(times[0],0);
  for(let i=1;i<times.length;i++)assert.ok(times[i]>times[i-1]);assert.ok(dur-times.at(-1)>.9);
 }
});
test('runtime rejects moving map during the closing interval',async()=>{
 await assert.rejects(create({st:{W:1080,H:1920,U:1},T,camera:{at:t=>({center:[53+t/100,24],zoom:4.7})}},scene),/cámara debe quedar quieta/);
});
test('runtime lifetimes do not spill beyond 6 seconds or the last 8 seconds',async()=>{
 const runtime=await create({st:{W:1080,H:1920,U:1},T},scene);
 assert.equal(runtime.duration,14);assert.equal(runtime.key(6).includes('intro-atlas'),false);assert.equal(runtime.key(6).includes('outro-atlas'),true);
 assert.equal(runtime.key(14),'tactico:idle');
});
