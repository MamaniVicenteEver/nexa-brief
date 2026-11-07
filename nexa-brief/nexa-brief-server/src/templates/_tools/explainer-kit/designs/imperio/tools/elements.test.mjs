import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const root = new URL('../', import.meta.url);
const read = file => JSON.parse(fs.readFileSync(new URL(file, root), 'utf8'));

test('el índice, los contratos y las miniaturas cubren la misma selección propia', () => {
  const design = read('design.json'), catalog = read('catalog.json');
  const posters = JSON.parse(fs.readFileSync(new URL('../../showcase/imperio-thumbs/index.json',root),'utf8'));
  const names = design.showcase.components;
  assert.deepEqual(catalog.components.map(c=>c.name),names);
  assert.deepEqual(posters.components.map(c=>c.name),names);
  assert.ok(names.every(n=>n.startsWith('imperio.') || ['common.flash','common.lyric'].includes(n)));
  assert.equal(new Set(names).size,names.length);
  for (const row of catalog.components) {
    const contract = read(row.inputs);
    assert.equal(contract.title,row.name);
    assert.equal(contract.additionalProperties,false);
    for(const k of Object.keys(row.example.params)) assert.ok(k in contract.properties,`${row.name}.${k}`);
  }
  assert.equal(catalog.production.usesMap,true);
  assert.equal(read('contracts/imperio.country.json').$defs.coordinate.maxItems,2);
});

test('las piezas delegan al renderizador original y conservan las coordenadas y medios', () => {
  const registered = new Map(), calls=[];
  const stub = name => ({
    params:read(`contracts/imperio.${name}.json`).properties,
    create(ctx,p){calls.push({name,p,ctx});return {render(){}};},
    mapCam:p=>({from:p.from,to:p.to}), mapLook:p=>({hatch:p.hatch}),
  });
  const campaign=stub('campaign'),map=stub('map');registered.set('imperio.map',map);
  const Kit={registry:registered,register:d=>registered.set(d.name,d),prog:()=>1,imperio:{campaign:{definition:campaign,
    camParams:Object.fromEntries(['from','to','zoom','tilt','ease'].map(k=>[k,campaign.params[k]])),
    mapParams:{country:campaign.params.country},dateStamp:(...args)=>calls.push({name:'date',args}),archiveCaption:(...args)=>calls.push({name:'caption',args})}}};
  vm.runInNewContext(fs.readFileSync(new URL('components/elements.js',root),'utf8'),{Kit});
  const def=registered.get('imperio.country'),p=Object.fromEntries(Object.entries(def.params).map(([k,s])=>[k,s.default]));
  Object.assign(p,{country:'France',target:[2.35,48.86],region:'France',label:'FRANCIA',flag:'assets/flags/francia.svg',from:[2,47,30,0],to:[2,47,30,0],time:1.25});
  def.create({},p);
  const call=calls.pop();assert.equal(call.name,'campaign');
  assert.deepEqual(Array.from(call.p.targets[0].at),[2.35,48.86]);
  assert.equal(call.p.targets[0].region,'France');assert.equal(call.p.targets[0].time,1.25);
  assert.equal(call.p.f1,'assets/flags/francia.svg');assert.equal(call.p.country,'France');
  assert.deepEqual(Array.from(call.p.parts),['territories','badges','dates']);
  const date=registered.get('imperio.date');date.create({g:{main:{}},stage:{}},{text:'1940–41',at:0,size:1}).render(2);
  assert.equal(calls.pop().name,'date');
  const sun=registered.get('imperio.sun'),sp=Object.fromEntries(Object.entries(sun.params).map(([k,s])=>[k,s.default]));
  sun.create({},sp);assert.equal(calls.pop().name,'map');
});
