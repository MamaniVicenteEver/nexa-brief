import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeProjection,isGlobeProjection} from '../projection.js';
import {paintBackground} from '../attribution.js';
import {spanToZoom} from '../camera.js';

const expression=['interpolate',['linear'],['zoom'],1.2,'vertical-perspective',2.6,'mercator'];
test('normaliza strings, expresiones y objetos; rechaza valores inválidos',()=>{
 assert.deepEqual(normalizeProjection('globe'),{type:'globe'});
 assert.deepEqual(normalizeProjection(),{type:'mercator'});
 assert.deepEqual(normalizeProjection(expression),{type:expression});
 assert.deepEqual(normalizeProjection({type:expression}),{type:expression});
 for(const value of [null,42,{},[],{type:null},'']) assert.throws(()=>normalizeProjection(value),TypeError);
});
test('convierte spans según el ancho sin alterar la expresión de entrada',()=>{
 const input={type:['interpolate',['linear'],['zoom'],{span:520},'vertical-perspective',{span:170},'mercator']};
 const original=structuredClone(input);
 for(const width of [1920,1080]) {
  const result=normalizeProjection(input,{width}).type;
  assert.equal(result[3],spanToZoom(520,width));assert.equal(result[5],spanToZoom(170,width));
  assert.equal(isGlobeProjection(input),true);
 }
 assert.notEqual(normalizeProjection(input,{width:1920}).type[3],normalizeProjection(input,{width:1080}).type[3]);
 assert.deepEqual(input,original);
 assert.throws(()=>normalizeProjection(input),/ancho/);
 for(const bad of [0,-1,Infinity,'170']) assert.throws(()=>normalizeProjection({type:['interpolate',['linear'],['zoom'],{span:bad},'globe',2,'mercator']},{width:1920}),/span/);
});
test('valida el orden convertido y admite etapas numéricas y mixtas',()=>{
 const expr=(a,b)=>['interpolate',['linear'],['zoom'],a,'globe',b,'mercator'];
 assert.throws(()=>normalizeProjection(expr({span:170},{span:520}),{width:1920}),/orden estrictamente ascendente/);
 assert.throws(()=>normalizeProjection(expr(2,2)),/orden estrictamente ascendente/);
 assert.throws(()=>normalizeProjection(expr({span:170},1),{width:1920}),/orden estrictamente ascendente/);
 assert.deepEqual(normalizeProjection(expr(1,3)),{type:expr(1,3)});
 assert.equal(normalizeProjection(expr({span:520},3),{width:1920}).type[3],spanToZoom(520,1920));
});
test('el fondo de globo reconoce el primer tramo de la expresión',()=>{
 const count=projection=>{let n=0;const g={save(){},restore(){},fillRect(){n++;}};paintBackground(g,100,100,{background:'#000',projection});return n;};
 for(const projection of ['globe',expression,{type:expression},['interpolate',['linear'],['zoom'],1,'globe',2,'mercator']]) {assert.equal(isGlobeProjection(projection),true);assert.equal(count(projection),251);}
 for(const projection of ['mercator',['interpolate',['linear'],['zoom'],1,'mercator',2,'vertical-perspective']]) {assert.equal(isGlobeProjection(projection),false);assert.equal(count(projection),1);}
});
