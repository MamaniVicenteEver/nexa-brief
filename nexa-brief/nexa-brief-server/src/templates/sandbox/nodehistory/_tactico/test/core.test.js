import test from 'node:test';
import assert from 'node:assert/strict';
import {Tactico,create,loadComponents} from '../core.js';
import {timerFromWords} from '../tools/anchors.js';
await loadComponents();
const context=()=>({st:{W:1080,H:1920,U:1},T:timerFromWords([{word:'inicio',start:2,end:3}]),look:{background:'#000'}});
const view={W:1080,H:1920,zoom:6,project:(lon,lat)=>({x:lon,y:lat,k:1,visible:true})};
function recorder(){
  const calls=[],stack=[],g={globalAlpha:1,save(){stack.push(this.globalAlpha);},restore(){this.globalAlpha=stack.pop();}};
  return {g,calls};
}
Tactico.component('test.probe',{layer:40,animated:false,params:{size:{type:'number',default:10}},states:['normal','hit','wrecked'],
  validate:item=>item.size<1?['size inválido']:[],prepare:async item=>({value:item.size}),
  draw(g,s){g.calls.push({...s,drawAlpha:g.globalAlpha});},sfx:item=>[{sfx:'derived',at:item.t??0,dur:1}]});
const item=extra=>({id:'test',type:'test.probe',at:[0,0],t:2,dur:4,fade:1,...extra});
function draw(runtime,t){const {g,calls}=recorder();g.calls=calls;runtime.draw(g,view,t);assert.equal(g.globalAlpha,1);return calls;}
test('registro global, duplicados, prepare async y defaults antes de validar',async()=>{
  assert.ok(Tactico.get('debug.dot'));assert.throws(()=>Tactico.component('test.probe',{draw(){}}),/registrado/);
  const original={duration:10,items:[item()]},before=structuredClone(original),r=await create(context(),original),s=draw(r,4)[0];
  assert.equal(s.internal.value,10);assert.ok(Object.isFrozen(s.item));assert.deepEqual(original,before);
});
test('t/dur/out/fade: entrada, sostén, salida y límites abiertos',async()=>{
  const r=await create(context(),{items:[item()]});
  assert.equal(draw(r,1).length,0);assert.equal(draw(r,2).length,0);assert.equal(draw(r,2.5)[0].alpha,.5);
  assert.equal(draw(r,4)[0].alpha,1);assert.equal(draw(r,6.5)[0].alpha,.5);assert.equal(draw(r,7).length,0);assert.equal(r.duration,7);
  const cut=await create(context(),{items:[item({fade:0,out:3})]});assert.equal(draw(cut,2).length,1);assert.equal(draw(cut,3).length,0);
});
test('orden por layer, z y posición original',async()=>{
  const r=await create(context(),{items:[item({id:'a',layer:70}),item({id:'b',z:1}),item({id:'c',z:-1}),item({id:'d',z:-1})]});
  assert.deepEqual(draw(r,4).map(s=>s.item.id),['c','d','b','a']);
});
test('posiciones referidas siguen al líder; heading fijo prevalece',async()=>{
  const r=await create(context(),{items:[item({id:'leader',path:{via:[[0,0],[4,0]],t:2,dur:4},heading:'auto'}),item({id:'label',at:'leader',heading:12})]});
  const [a,b]=draw(r,4);assert.ok(Math.abs(a.pos.lon-2)<1e-8);assert.equal(a.heading,90);assert.equal(b.pos.lon,a.pos.lon);assert.equal(b.heading,12);
});
test('estados interpolados e interrupciones continuas, independientes del seek',async()=>{
  const r=await create(context(),{items:[item({t:0,dur:10,fade:0,states:[{at:1,state:'hit',dur:2},{at:2,state:'wrecked',dur:2}]})]});
  assert.equal(draw(r,2)[0].stateT,0);const a=draw(r,2-1e-6)[0].stateWeights,b=draw(r,2+1e-6)[0].stateWeights;
  for(const k of ['normal','hit'])assert.ok(Math.abs(a[k]-b[k])<1e-5);
  const expected=draw(r,3);draw(r,9);draw(r,0);assert.deepEqual(draw(r,3),expected);
  assert.ok(Math.abs(Object.values(expected[0].stateWeights).reduce((a,b)=>a+b,0)-1)<1e-10);
});
test('caché: reposo estable, cambios visuales invalidan, sin serializar escena',async()=>{
  const r=await create(context(),{items:[item()]});assert.equal(r.key(3.1),r.key(5));assert.equal(r.key(0),r.key(100));assert.equal(r.key(100),'tactico:idle');assert.notEqual(r.key(2.1),r.key(2.2));
  const active=await create(context(),{items:[item({path:{via:[[0,0],[4,0]],t:2,dur:4}})]});assert.notEqual(active.key(3.1),active.key(3.2));
  const stringify=JSON.stringify;try{JSON.stringify=()=>{throw Error('serializó');};assert.ok(active.key(4));}finally{JSON.stringify=stringify;}
  const empty=await create(context(),{items:[]});assert.equal(empty.key(0),empty.key(99));assert.doesNotThrow(()=>empty.draw({},view,2));
});
test('animación interna usa tiempo y la clave propia tiene precedencia',async()=>{
  Tactico.component('test.animated',{draw(){},states:[]});
  const r=await create(context(),{items:[{id:'anim',type:'test.animated',t:0,fade:0}]});assert.notEqual(r.key(1),r.key(2));
  Tactico.component('test.customkey',{draw(){},key:s=>Math.floor(s.t)});
  const k=await create(context(),{items:[{id:'key',type:'test.customkey',t:0,fade:0}]});assert.equal(k.key(1.1),k.key(1.2));assert.notEqual(k.key(1.1),k.key(2.2));
});
test('resuelve tiempos anidados y eventos; sfx false y lista explícita',async()=>{
  const r=await create(context(),{items:[item({id:'quiet',t:'@inicio',sfx:false}),item({id:'own',sfx:[{sfx:'engine',at:'@inicio:end+0.4',dur:2}]})],sound:{cues:[{sfx:'global',at:'@inicio',dur:1}]}});
  assert.deepEqual(r.sfx().map(e=>e.sfx),['global','engine']);assert.equal(r.sfx()[1].at,3.4);const events=r.sfx();events[0].at=99;assert.equal(r.sfx()[0].at,2);
  await assert.rejects(create(context(),{items:[item({path:{via:[[0,0],[1,1]],t:'@ausente',dur:2}})]}),/sin resolver/);
});
test('restore se ejecuta cuando un componente falla',async()=>{
  Tactico.component('test.failure',{animated:false,draw(){throw Error('boom');}});
  const r=await create(context(),{items:[{id:'fail',type:'test.failure',fade:0}]});const {g}=recorder();assert.throws(()=>r.draw(g,view,1),/boom/);assert.equal(g.globalAlpha,1);
});
test('un estado inicial explícito y las claves propias como objetos son válidos',async()=>{
  const r=await create(context(),{items:[item({state:'hit'})]});assert.equal(draw(r,4)[0].state,'hit');
  Tactico.component('test.objectkey',{draw(){},key:s=>({phase:Math.floor(s.t)})});
  const k=await create(context(),{items:[{id:'obj',type:'test.objectkey',t:0,fade:0}]});assert.equal(k.key(1.1),k.key(1.2));assert.notEqual(k.key(1.1),k.key(2.2));
});
test('prepare recibe las anclas de acciones y SFX resueltas; se apaga al terminar la escena',async()=>{
  const r=await create(context(),{duration:8,items:[item({t:'@inicio',dur:undefined,actions:[{type:'debug.dot',at:'@inicio:end',dur:1}],sfx:[{sfx:'motor',at:'@inicio+0.2',fade_in:.4,fade_out:.5}]})]});
  const s=draw(r,4)[0];assert.equal(s.item.actions[0].at,3);assert.equal(r.sfx()[0].at,2.2);assert.equal(r.sfx()[0].fade_out,.5);
  assert.equal(r.duration,8);assert.equal(draw(r,8).length,0);assert.equal(r.key(8),'tactico:idle');
});
test('duración y posición respetan una ruta definida por velocidad',async()=>{
  const r=await create(context(),{items:[item({t:0,dur:undefined,fade:0,sfx:false,path:{via:[[0,0],[1,0]],t:1,speed:111.3194908}})]});
  assert.ok(Math.abs(r.duration-2)<1e-6);assert.ok(Math.abs(draw(r,1.5)[0].pos.lon-.5)<1e-6);
});
test('el progreso de una ruta que vuelve a pasar por el mismo punto invalida la caché',async()=>{
  const r=await create(context(),{items:[item({t:0,dur:20,fade:0,path:{via:[[0,0],[4,0],[0,0],[4,0]],dur:12}})]});
  const a=draw(r,2)[0],b=draw(r,10)[0];assert.ok(Math.abs(a.pos.lon-b.pos.lon)<1e-9);assert.equal(a.heading,b.heading);
  assert.notEqual(a.pos.u,b.pos.u);assert.notEqual(r.key(2),r.key(10));
});
test('spring no produce pesos negativos al mezclar estados visuales',async()=>{
  const r=await create(context(),{items:[item({t:0,dur:10,fade:0,states:[{at:1,state:'hit',dur:1,ease:'spring'}]})]});
  for(const t of [1,1.1,1.3,1.4,1.5,2,3]){
    const s=draw(r,t)[0];assert.ok(s.stateT>=0&&s.stateT<=1);
    assert.ok(Object.values(s.stateWeights).every(w=>w>=0&&w<=1));
    assert.ok(Math.abs(Object.values(s.stateWeights).reduce((a,b)=>a+b,0)-1)<1e-10);
  }
});
