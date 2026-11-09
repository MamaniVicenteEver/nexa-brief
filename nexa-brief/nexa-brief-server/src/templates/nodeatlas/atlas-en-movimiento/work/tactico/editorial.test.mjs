import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Tactico,validateScene} from '../../../_tactico/core.js';
await import('../../../_tactico/components/sites.js');
await import('../../../_tactico/components/economy.js');
await import('../../../_tactico/components/editorial.js');
const json=async file=>JSON.parse(await readFile(new URL(file,import.meta.url),'utf8'));
const errors=item=>validateScene({duration:12,items:[{id:'case',t:0,dur:8,at:[51,28],...item}]}).errors;
const demo=type=>structuredClone(Tactico.get(type).demo);

test('las cuatro escenas D/F validan y todos los registros incluyen demos',async()=>{
 for(const file of ['scene-editorial','scene-sites','scene-economy','scene-portraits']){
  const scene=await json(file+'.json');assert.deepEqual(validateScene(scene).errors,[],file);
 }
 assert.equal((await json('scene-editorial.json')).items.length,13);
 for(const def of Tactico.list()){
  assert.ok(def.summary&&def.params&&def.validate&&def.demo,def.name);
  assert.deepEqual(errors(def.demo),[],def.name);
 }
});
test('sitios aceptan la secuencia de daño persistente y rechazan estados desconocidos',()=>{
 for(const kind of ['plant','refinery','oilfield','port','base','platform']){
  const item=demo('site.'+kind);assert.deepEqual(errors(item),[]);
  assert.ok(errors({...item,states:[{at:3,state:'sunk'}]}).some(e=>e.code==='state'));
  assert.ok(errors({...item,scale:-1}).length);
 }
});
test('money.flow valida la ruta que prepara, incluido su valor por defecto',()=>{
 assert.deepEqual(errors({type:'money.flow'}),[]);
 assert.ok(errors({...demo('money.flow'),via:[[0,0],[0,90]]}).length);
 // path.via tiene precedencia; via no debe ocultar una ruta animada inválida.
 assert.ok(errors({...demo('money.flow'),path:{via:[[0,0],[0,89]],t:0,dur:4}}).some(e=>e.message.includes('via necesita')));
 assert.deepEqual(errors({...demo('money.flow'),path:{via:[[51,27],[52,26]],t:0,dur:4}}),[]);
 for(const [type,patch] of [['money.flow',{period:0}],['money.flow',{count:1.5}],['money.stack',{count:37}],['money.stack',{buildDur:-1}]])assert.ok(errors({...demo(type),...patch}).length);
});
test('no se admiten medios remotos, prensa sin texto del episodio ni créditos vacíos',()=>{
 for(const type of ['portrait.badge','portrait.cutout','editorial.press','callout.photo']){
  for(const src of ['https://example.org/image.png','//example.org/image.png','../photo.png','/photo.png'])assert.ok(errors({...demo(type),src}).length,type+' '+src);
  assert.ok(errors({...demo(type),credit:'  '}).length,type);
 }
 assert.ok(errors({...demo('editorial.press'),docText:''}).length);
 assert.ok(errors({...demo('editorial.press'),docCredit:''}).length);
 assert.ok(errors({...demo('portrait.badge'),role:''}).length);
 assert.ok(errors({...demo('portrait.cutout'),mask:[[0,0],[1,1]]}).length);
 assert.ok(errors({...demo('portrait.badge'),focus:[-1,2]}).length);
});
test('el contador no puede declarar menos unidades que los iconos que muestra',()=>{
 for(const patch of [{total:10},{count:61},{count:-1},{columns:0},{count:1.5}])assert.ok(errors({...demo('inventory.units'),...patch}).length);
 assert.deepEqual(errors({...demo('inventory.units'),count:0,total:0}),[]);
});
test('las 23 candidatas tienen una decisión y cada medio listo conserva archivos y hashes',async()=>{
 const credits=await json('../../assets/media/credits.json');assert.equal(credits.assets.length,23);
 assert.equal(credits.assets.filter(a=>a.status==='ready').length,14);
 for(const asset of credits.assets){
  if(asset.status!=='ready'){assert.ok(asset.reason||asset.error,asset.id);continue;}
  assert.match(asset.license,/^(Public domain|CC0(?: 1\.0)?|CC BY(?:-SA)? [234]\.0)$/);
  for(const key of ['author','url','date','use','verifiedAt'])assert.ok(asset[key],asset.id+' '+key);
  for(const [file,hash] of [[asset.original,asset.sha256],[asset.file,asset.derivativeSha256]]){
   const bytes=await readFile(new URL('../../'+file,import.meta.url));
   assert.equal(createHash('sha256').update(bytes).digest('hex'),hash,asset.id+' '+file);
  }
  if(asset.softMask)assert.ok((await readFile(new URL('../../'+asset.softMask,import.meta.url))).length);
  const evidence='../../assets/media/provenance/'+asset.id+(asset.title?'.json':'-license.txt');
  assert.ok((await readFile(new URL(evidence,import.meta.url))).length,asset.id);
 }
});
