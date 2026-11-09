import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGeo,cameraKeys} from '../geo.js';
import {spanToZoom} from '../camera.js';
test('resuelve lugares y regiones por id, alias y bbox',()=>{const geo=createGeo({places:{Austin:[-97,30]}},{regions:[{id:'US-TX',name:'Texas',bbox:[-107,25,-93,37],geometry:{type:'Polygon',coordinates:[]}}]});assert.deepEqual(geo.place('Austin'),[-97,30]);assert.deepEqual(geo.place('texas'),[-100,31]);assert.equal(geo.region('US-TX').name,'Texas');assert.deepEqual(geo.place([1,2]),[1,2]);assert.equal(geo.place('sin lugar'),null);const k=cameraKeys({camera:[{t:2,focus:'Texas',span:20}]},geo,x=>x,1920)[0];assert.deepEqual(k.center,[-100,31]);assert.equal(k.zoom,spanToZoom(20,1920));});
test('cameraKeys conserva lift y deja ausente el valor omitido',()=>{
 const geo=createGeo(); const keys=cameraKeys({camera:[{t:0,center:[0,0],lift:0.3},{t:2,center:[1,1]}]},geo);
 assert.equal(keys[0].lift,0.3); assert.equal(keys[1].lift,undefined);
});
