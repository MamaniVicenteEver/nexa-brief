import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cachedPreviewLayout} from './preview-layout.js';
const demo={type:'fx.explosion',at:[54,27],dur:2.8};
const value={crop:[400,380,710,670],peakTime:.28,peak:1700,demo};
const cache={version:1,width:1080,height:1080,layouts:{'fx.explosion':value}};
test('reutiliza el encuadre auditado aunque las claves JSON estén en otro orden',()=>{
 assert.equal(cachedPreviewLayout(cache,'fx.explosion',{dur:2.8,at:[54,27],type:'fx.explosion'}),value);
});
test('un demo modificado o nuevo se vuelve a medir',()=>{
 assert.equal(cachedPreviewLayout(cache,'fx.explosion',{...demo,dur:5}),null);
 assert.equal(cachedPreviewLayout(cache,'new.effect',demo),null);
 assert.equal(cachedPreviewLayout(null,'fx.explosion',demo),null);
});
test('rechaza encuadres corruptos y formatos que no corresponden al lienzo',()=>{
 for(const crop of [[0,0,0,50],[10,0,5,50],[-1,0,500,500],[0,0,1100,500],[0,0,NaN,500]])assert.equal(cachedPreviewLayout({...cache,layouts:{'fx.explosion':{...value,crop}}},'fx.explosion',demo),null);
 assert.equal(cachedPreviewLayout({...cache,width:480},'fx.explosion',demo),null);
});
