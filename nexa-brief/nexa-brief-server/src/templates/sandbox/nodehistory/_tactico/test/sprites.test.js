import test from 'node:test';
import assert from 'node:assert/strict';
import {createSprites} from '../sprites.js';
function mock(){const calls=[],stack=[],g=new Proxy({globalAlpha:1,save(){stack.push(this.globalAlpha);},restore(){this.globalAlpha=stack.pop();}},{get:(o,k)=>o[k]??((...args)=>calls.push([k,...args]))});return {g,calls};}
test('sin manifiesto: reserva vectorial por familia y carga única',async()=>{
  let count=0;const s=createSprites({loadJSON:async()=>{count++;throw Error('ENOENT');}});await Promise.all([s.load(),s.load()]);assert.equal(count,1);assert.match(s.missing()[0],/sprites.json/);
  for(const [name,family]of[['naval.cargo','hull'],['naval.carrier','deck'],['air.jet','wings']]){assert.equal(s.sprite(name).family,family);assert.equal(s.sprite(name).available,false);const {g,calls}=mock();s.drawSprite(g,name,10.25,20.75,{heading:90,length:80,state:'hit'});assert.ok(calls.some(c=>c[0]==='translate'&&c[1]===10.25&&c[2]===20.75));assert.equal(g.globalAlpha,1);}
});
test('manifiesto e imágenes solo se cargan en prepare; longitudes y paths relativos',async()=>{
  let count=0;const urls=[],s=createSprites({manifest:new URL('https://example.test/sprites/sprites.json'),loadJSON:async()=>({sprites:{ship:{src:'ship.png',mask:'mask.png',relativeLength:.5}}}),loadImage:async url=>{count++;urls.push(url.href);return {width:20,height:100};}});
  await s.load();assert.deepEqual(urls,['https://example.test/sprites/ship.png','https://example.test/sprites/mask.png']);assert.equal(s.sprite('ship').relativeLength,.5);assert.equal(s.sprite('ship').available,true);
  const {g,calls}=mock();s.drawSprite(g,'ship',.25,.5,{length:60,shadow:false});s.drawSprite(g,'ship',.75,1.5,{length:60,shadow:false});assert.equal(count,2);assert.equal(calls.filter(c=>c[0]==='drawImage').length,2);
});
test('metadatos del generador: estados horneados, ancla y longitud longitudinal de alas',async()=>{
  const images=new Map(),s=createSprites({manifest:{sprites:{wing:{file:'wing.png',mask:'mask.png',family:'air',length_relative:.15,length_pixels:40,anchor:[.25,.75],states:{burning:'wing-burning'}},'wing-burning':{file:'burning.png',family:'air',length_pixels:40,anchor:[.25,.75],state:'burning'}}},loadImage:async url=>{const image={width:200,height:100,url:url.href};images.set(url.pathname.split('/').at(-1),image);return image;}});
  await s.load();assert.equal(s.sprite('wing').relativeLength,.15);assert.equal(s.sprite('wing').family,'wings');
  const {g,calls}=mock();s.drawSprite(g,'wing',20.25,30.75,{length:80,state:'burning',shadow:false});
  const draw=calls.find(c=>c[0]==='drawImage');assert.equal(draw[1],images.get('burning.png'));assert.deepEqual(draw.slice(2),[-100,-150,400,200]);
});
