import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Tactico,create,validateScene} from '../../../_tactico/core.js';
import {pathAt} from '../../../_tactico/util.js';
import '../../../_tactico/components/_base.js';
import '../../../_tactico/components/fx.js';
import {prepareStrike,samplePath} from '../../../_tactico/components/strike.js';

const scene=JSON.parse(await readFile(new URL('scene-fx.json',import.meta.url)));
const ctx={scene,T:(v,f=0)=>typeof v==='number'?v:v==='@launch'?4:f};
const owned=Tactico.list().filter(d=>/^(fx\.|strike\.|trail\.)/.test(d.name));

test('19 casos: registro, metadatos y escena validan contra el núcleo real',()=>{
  assert.deepEqual(validateScene(scene).errors,[]);
  const defs=owned;
  assert.equal(defs.length,12);
  for(const d of defs){assert.ok(d.summary);assert.ok(d.demo);assert.ok(d.params.dur.default>0);assert.equal(d.particleLimit,300);}
});

test('cada demo individual valida sin referencias externas obligatorias',()=>{
  for(const d of owned) assert.deepEqual(validateScene({items:[structuredClone(d.demo)]}).errors,[],d.name);
});

test('onHit se programa una vez por llegada, sin mutar escena ni insertar items',()=>{
  const item={...Tactico.get('strike.missile').demo,t:'@launch',path:{via:[[179,65],[-179,66]],t:'@launch',dur:2,curve:'arc'},dur:6,
    onHit:{fx:'fx.explosion',variant:'air',dur:2.8,size:90}};
  const before=JSON.stringify(item),internal=prepareStrike(item,ctx);
  assert.equal(internal.start,4);assert.equal(internal.launches[0].arrival,6);
  assert.equal(internal.launches[0].hit.t,6);assert.equal(internal.launches[0].hit.type,'fx.explosion');
  assert.deepEqual(internal.launches[0].hit.at,[-179,66]);
  assert.ok(Object.isFrozen(internal));assert.ok(Object.isFrozen(internal.launches));
  assert.equal(JSON.stringify(item),before);
  assert.ok(Math.abs(samplePath(internal.launches[0].path,5).at[0])>170,'toma el camino corto por el antimeridiano');
});

test('salva: diez llegadas escalonadas, presupuesto agregado <=300 y efectos acotados',()=>{
  const item={...Tactico.get('strike.salvo').demo,count:10,stagger:.12,particles:300,dur:7,onHit:{fx:'fx.explosion',particles:300}};
  const internal=prepareStrike(item,ctx);
  assert.equal(internal.launches.length,10);
  let total=0;
  for(const [i,l] of internal.launches.entries()){
    assert.ok(Math.abs(l.arrival-(2.4+i*.12))<1e-9);
    total+=internal.resources.segments+l.hit.particles;
  }
  assert.ok(total<=300);
});

test('contrail evalúa el mismo path que el núcleo, incluyendo ease y velocidad sobre curvas',()=>{
  const source={id:'plane',type:'debug.dot',at:[51,27],t:2,dur:9,path:{via:[[51,27],[52,30],[57,28]],t:2,dur:6,curve:'smooth',ease:'inOut'}};
  const item={id:'trail',type:'trail.contrail',follow:'plane',t:2,dur:8};
  const internal=Tactico.get(item.type).prepare(item,{scene:{items:[source]}});
  for(const t of [2,2.5,3.2,5,7.5,8]){
    const actual=samplePath(internal.path,t),expected=pathAt(source.path,t);
    assert.ok(Math.abs(actual.at[0]-expected.lon)<1e-10);assert.ok(Math.abs(actual.at[1]-expected.lat)<1e-10);
  }
});

test('contrail conserva bend y speed sin dur, y deja disipar la cola tras la llegada',()=>{
  for (const path of [
    {via:[[51,27],[57,28]], t:2, dur:6, curve:'arc', bend:-.6, ease:'inOut'},
    {via:[[51,27],[53,29],[57,28]], t:2, speed:110, curve:'smooth', ease:'linear'},
  ]) {
    const source={id:'plane',type:'debug.dot',t:2,dur:20,path};
    const item={id:'trail',type:'trail.contrail',follow:'plane',t:2,dur:20};
    const internal=Tactico.get(item.type).prepare(item,{scene:{items:[source]}});
    for(const t of [2,2.5,3.2,5,7.5,8]) {
      assert.deepEqual(samplePath(internal.path,t).at, [pathAt(path,t).lon,pathAt(path,t).lat]);
    }
    assert.ok(internal.pathEnd>2);
    assert.ok(pathAt(path,internal.pathEnd-1e-4).u<1);
    assert.ok(Math.abs(pathAt(path,internal.pathEnd).u-1)<1e-8);
  }
});

test('torpedo: onHit programable respeta las variantes propias de cada efecto',()=>{
  for(const fx of ['fx.explosion','fx.fire','fx.impact','fx.shockwave']) {
    const item={...Tactico.get('strike.torpedo').demo,dur:15,onHit:{fx}};
    const hit=prepareStrike(item,ctx).launches[0].hit;
    assert.deepEqual(Tactico.get(fx).validate(hit),[]);
    if(['fx.impact','fx.shockwave'].includes(fx)) assert.equal(hit.variant,'water');
  }
});

test('resolución de objetivos móviles y path.bend coinciden con el núcleo',()=>{
  const target={id:'target',type:'debug.dot',t:0,dur:8,path:{via:[[54,27],[55,29]],t:0,dur:5,curve:'arc',bend:-.4}};
  const item={...Tactico.get('strike.missile').demo,to:'target',path:{via:[[51,27],'target'],t:0,dur:2,curve:'arc',bend:-.7}};
  const internal=prepareStrike(item,{scene:{items:[target]}});
  const expected=pathAt(target.path,2);
  assert.deepEqual(internal.launches[0].hit.at,[expected.lon,expected.lat]);
  assert.equal(internal.launches[0].path.bend,-.7);
});

test('SFX: ids del contrato, tiempos resueltos y apagado explícito',async()=>{
  const runtime=await create({st:{W:1080,H:1920,U:1}},scene);
  const ids=new Set(['explosion-near','explosion-far','water-impact','missile-pass','torpedo','bomb-whistle']);
  assert.ok(runtime.sfx().length>0);
  for(const cue of runtime.sfx()){assert.ok(ids.has(cue.sfx));assert.ok(Number.isFinite(cue.at+cue.dur));}
  for(const d of owned)assert.deepEqual(d.sfx({...d.demo,sfx:false},ctx),[]);
  const missile=Tactico.get('strike.missile');
  const cues=missile.sfx({...missile.demo,t:4,onHit:{fx:'fx.impact',variant:'water'}},ctx);
  assert.equal(cues[0].at,4);assert.equal(cues[1].at,6.4);assert.equal(cues[1].sfx,'water-impact');
});

test('validadores rechazan partículas, referencias, variantes y duraciones truncadas',()=>{
  assert.ok(Tactico.get('fx.smoke').validate({particles:301,drift:[1,NaN]}).length>=2);
  assert.ok(Tactico.get('fx.impact').validate({variant:'lava'}).length);
  assert.ok(Tactico.get('strike.missile').validate({...Tactico.get('strike.missile').demo,dur:.5},ctx).length);
  assert.ok(Tactico.get('strike.missile').validate({...Tactico.get('strike.missile').demo,onHit:{fx:'strike.missile'}},ctx).length);
  assert.ok(Tactico.get('trail.contrail').validate({follow:'missing'},ctx).length);
});
