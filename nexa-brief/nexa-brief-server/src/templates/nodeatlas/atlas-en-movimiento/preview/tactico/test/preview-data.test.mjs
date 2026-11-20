import test from 'node:test';
import assert from 'node:assert/strict';
import {previewItem} from '../preview-data.js';

const def={name:'money.flow',params:{count:{},via:{},currencySymbol:{}},demo:{type:'money.flow',count:7,via:[[1,2],[3,4]],t:0,dur:8}};
test('un ejemplo usa el tipo original y sus parámetros JSON',()=>{
 const item=previewItem(def,JSON.stringify({count:10,via:[[20,52],[24,50],[30.5,50.4]],currencySymbol:''}));
 assert.equal(item.type,'money.flow');assert.equal(item.count,10);assert.equal(item.currencySymbol,'');
 assert.equal(def.demo.count,7);assert.deepEqual(def.demo.via,[[1,2],[3,4]]);
});
test('el ejemplo original es una copia independiente',()=>{
 const item=previewItem(def,null);item.via[0][0]=99;assert.equal(def.demo.via[0][0],1);
});
test('los parámetros no pueden cambiar el tipo ni ejecutar código',()=>{
 assert.throws(()=>previewItem(def,'{"type":"otro.motor"}'),/no declarado/);
 assert.throws(()=>previewItem(def,'{"draw":"render()"}'),/no declarado/);
 assert.throws(()=>previewItem(def,'[]'),/objeto JSON/);
});
