import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {validateScene,resolveScene,loadComponents} from '../core.js';
import {landIndex,seaCrossings,segmentsIntersect} from '../tools/geometry.js';
import {timerFromWords} from '../tools/anchors.js';
await loadComponents();
const island={type:'FeatureCollection',features:[{properties:{name:'Isla de prueba'},geometry:{type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[0,1],[0,0]],[[.4,.4],[.6,.4],[.6,.6],[.4,.6],[.4,.4]]]}}]};
test('segmento/polígono detecta cruce aun con ambos extremos en agua',()=>{
  const land=landIndex(island),hits=seaCrossings({via:[[-1,.5],[2,.5]]},land);assert.equal(hits.length,1);assert.equal(hits[0].segment,0);assert.equal(hits[0].place,'Isla de prueba');assert.ok(hits[0].suggestion);
  assert.equal(seaCrossings({via:[[.45,.5],[.55,.5]]},land).length,0);assert.equal(seaCrossings({via:[[-1,2],[2,2]]},land).length,0);
  assert.equal(segmentsIntersect([0,0],[1,0],[.5,-1],[.5,1]),true);
});
test('dominio marítimo se valida y vuelo aéreo puede cruzar tierra',()=>{
  const item={id:'ruta',type:'debug.path',domain:'sea',path:{via:[[-1,.5],[2,.5]],dur:4}},land=landIndex(island);
  const a=validateScene({items:[item]},{land});assert.ok(a.errors.some(e=>e.code==='sea-land'));
  const b=validateScene({items:[{...item,domain:'air'}]},{land});assert.equal(b.errors.length,0);
});
test('anclas coinciden con la sintaxis de Proto, también en acciones y estados',()=>{
  const T=timerFromWords([{word:' El',start:1,end:1.2},{word:'barco',start:1.2,end:2},{word:'barco',start:3,end:4}]);
  assert.equal(T('@el barco:end+0.4'),2.4);assert.equal(T('@barco#2:end-0.5'),3.5);assert.ok(Number.isNaN(T('@ausente',NaN)));
  const errors=[],s=resolveScene({items:[{at:[1,2],t:'@barco',path:{t:'@barco:end',dur:2},states:[{at:'@barco#2',state:'hit'}],actions:[{at:'@barco:end+0.3'}]}]},{T,errors});
  assert.equal(errors.length,0);assert.equal(s.items[0].actions[0].at,2.3);assert.deepEqual(s.items[0].at,[1,2]);
});
test('IDs, tipos, lugar, rutas y referencia circular generan diagnósticos',()=>{
  const a=validateScene({items:[{id:'x',type:'debug.dot',at:'x'},{id:'x',type:'desconocido.tipo'}]});assert.ok(a.errors.some(e=>e.code==='duplicate-id'));assert.ok(a.errors.some(e=>e.code==='component'));
  const b=validateScene({items:[{id:'a',type:'debug.dot',at:'b'},{id:'b',type:'debug.dot',at:'a'}]});assert.ok(b.errors.some(e=>e.message.includes('circular')));
  assert.ok(validateScene({items:[{id:'a',type:'debug.path',path:{via:[[0,0]],dur:1}}]}).errors.length);
});
test('formatos rotos devuelven diagnósticos y los SFX también se validan en CLI',()=>{
  for(const input of [null,[],{items:{}},{items:[null]},{items:[[]]},{items:[{id:'a',type:'debug.dot',states:{at:1}}]},{items:[{id:'a',type:'debug.dot',states:[null]}]},{items:[],sound:{cues:{}}},{items:[],sound:{cues:[{at:1,dur:-2}]}}]){
    const result=validateScene(input);assert.ok(result.errors.length);
  }
});
test('cruces de antimeridiano no confunden una isla con el hemisferio opuesto',()=>{
  const land=landIndex({features:[{properties:{name:'Isla del límite'},geometry:{type:'Polygon',coordinates:[[[179,0],[-179,0],[-179,1],[179,1],[179,0]]]}}]});
  assert.equal(seaCrossings({via:[[178,.5],[-178,.5]]},land).length,1);
  assert.equal(seaCrossings({via:[[-1,.5],[1,.5]]},land).length,0);
});
test('SFX explícitos resuelven anclas y rechazan tiempos, ganancias y acciones inválidas',()=>{
  const T=timerFromWords([{word:'motor',start:1,end:2}]);
  const good=validateScene({items:[{id:'a',type:'debug.dot',sfx:[{sfx:'engine',at:'@motor:end+0.2',dur:1}]}]},{T});
  assert.equal(good.errors.length,0);assert.equal(good.scene.items[0].sfx[0].at,2.2);
  const bad=validateScene({items:[{id:'a',type:'debug.dot',state:'ausente',sfx:[{sfx:'engine',at:'@ausente',gain_db:'alto'}],actions:[{type:'no.existe',at:0}]}]},{T});
  for(const code of ['anchor','sfx-gain','state','action'])assert.ok(bad.errors.some(e=>e.code===code));
});
test('CLI real: escena núcleo válida y fixture rechazada con tres fallos esperados',()=>{
  const project=fileURLToPath(new URL('../../../',import.meta.url)), cli=fileURLToPath(new URL('../tools/validate.mjs',import.meta.url));
  const good=spawnSync(process.execPath,[cli,'work/tactico/scene-core.json','--json'],{cwd:project,encoding:'utf8'});assert.equal(good.status,0,good.stderr||good.stdout);assert.equal(JSON.parse(good.stdout).errors.length,0);
  const bad=spawnSync(process.execPath,[cli,'engine/tactico/test/fixtures/invalid-scene.json','--json'],{cwd:project,encoding:'utf8'});assert.equal(bad.status,1,bad.stderr||bad.stdout);const errors=JSON.parse(bad.stdout).errors;
  for(const code of ['duplicate-id','anchor','sea-land'])assert.ok(errors.some(e=>e.code===code),code);
  assert.ok(errors.find(e=>e.code==='sea-land').place);
});
