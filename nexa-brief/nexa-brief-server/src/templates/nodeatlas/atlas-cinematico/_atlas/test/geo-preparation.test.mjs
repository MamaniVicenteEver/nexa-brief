import test from 'node:test';
import assert from 'node:assert/strict';
import {geographicPreparation} from '../produce.mjs';

test('GeoData conserva índices tras títulos, flechas y geometrías propias',()=>{
  const scene={regions:{moscow:{geometry:{type:'Polygon',coordinates:[]}}},layers:[
    {type:'title',text:'Inicio'},{type:'highlight',region:'RU'},
    {type:'flag-fill',region:'RU'},{type:'metric',dataRef:'gdp-ru'},
    {type:'highlight',region:'moscow'},{type:'arrow',from:null,to:[37,55]},
    {type:'highlight',region:'FR',detail:'mid'},{type:'flag-fill',region:'FR'}]};
  const input=geographicPreparation(scene);
  const resolved=input.layers.flatMap((l,layer)=>l.region?[{layer,id:l.region}]:[]);
  assert.equal(input.layers.length,scene.layers.length);
  assert.deepEqual(resolved,[{layer:1,id:'RU'},{layer:2,id:'RU'},{layer:6,id:'FR'},{layer:7,id:'FR'}]);
  for(const r of resolved)assert.equal(scene.layers[r.layer].region,r.id);
  assert.deepEqual(input.layers[4],{});
});
