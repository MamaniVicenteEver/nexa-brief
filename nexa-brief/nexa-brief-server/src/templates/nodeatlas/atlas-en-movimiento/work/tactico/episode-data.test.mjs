import test from 'node:test';
import assert from 'node:assert/strict';
import {applyComponentDefaults,episodeMediaURL} from '../../engine/tactico/episode-data.js';

test('la compatibilidad de un episodio es JSON y conserva las decisiones del ítem',()=>{
 const items=[{type:'money.flow',count:10,t:4},{type:'money.flow',currencySymbol:'€',t:8}];
 const result=applyComponentDefaults(items,{'money.flow':{currencySymbol:''}});
 assert.equal(result[0].currencySymbol,'');assert.equal(result[1].currencySymbol,'€');
 assert.equal(items[0].currencySymbol,undefined);assert.equal(result[0].t,4);
});
test('los episodios sin opciones mantienen sus ítems y su aspecto',()=>{
 const items=[{type:'money.flow'}];assert.equal(applyComponentDefaults(items),items);
});
test('los valores por episodio no pueden alterar tipo ni tiempos',()=>{
 assert.throws(()=>applyComponentDefaults([],{x:{type:'private.draw'}}),/no puede cambiar/);
 assert.throws(()=>applyComponentDefaults([],{x:{t:99}}),/no puede cambiar/);
});
test('la escena puede ajustar un parámetro sin perder los demás valores del episodio',()=>{
 const result=applyComponentDefaults([{type:'money.flow'}],{'money.flow':{currencySymbol:'',scale:2}},{'money.flow':{scale:1}});
 assert.equal(result[0].currencySymbol,'');assert.equal(result[0].scale,1);
});

test('episode media follows its JSON context while shared previews keep design media',()=>{
 const url='http://server/api/v1/explainer/files/productions/nodeatlas/ukraine/';
 assert.equal(episodeMediaURL('assets/media/photo.jpg',{mediaBase:url}).href,url+'assets/media/photo.jpg');
 assert.match(episodeMediaURL('assets/media/photo.jpg').href,/assets\/media\/photo.jpg$/);
 assert.ok(!episodeMediaURL('assets/media/photo.jpg').href.includes('/preview/'));
});
