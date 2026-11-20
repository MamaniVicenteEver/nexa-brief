import test from 'node:test';
import assert from 'node:assert/strict';
import {Tactico} from '../core.js';
import '../components/editorial.js';

// Un contexto que registra los colores de las operaciones de cada bitmap.
let calls=[];
class Canvas {
  constructor(width,height){this.width=width;this.height=height;this.context=new Context();}
  getContext(){return this.context;}
}
class Context {
  constructor(){this.fillStyle='#000000';this.strokeStyle='#000000';this.globalAlpha=1;}
  save(){} restore(){} translate(){} rotate(){} scale(){} beginPath(){} closePath(){} moveTo(){} lineTo(){} arc(){} roundRect(){} rect(){} clip(){} drawImage(){}
  fillRect(){calls.push({kind:'fill',color:this.fillStyle});}
  fill(){calls.push({kind:'fill',color:this.fillStyle});}
  stroke(){calls.push({kind:'stroke',color:this.strokeStyle});}
  strokeText(value){calls.push({kind:'outline',color:this.strokeStyle,value});}
  fillText(value){calls.push({kind:'text',color:this.fillStyle,value});}
  measureText(value){return {width:String(value).length*10};}
}
globalThis.OffscreenCanvas=Canvas;
globalThis.Image=class {constructor(){this.width=400;this.height=300;}async decode(){}};
const types=['editorial.press','callout.photo','inventory.units','portrait.badge','portrait.cutout'];
const ctx={scene:{defs:{palette:{}}},palette:{},env:{}};
for(const type of types){
 test(`${type}: estilo 01 por defecto y fondo personalizable`,async()=>{
  const def=Tactico.get(type),item=structuredClone(def.demo);
  assert.ok(def.params.appearance.doc.includes('cardColor'));
  assert.deepEqual(def.validate(item,{}),[]);
  calls=[];await def.prepare(item,ctx);
  assert.ok(calls.some(c=>c.kind==='fill'&&c.color==='#20252b'),'fondo grafito predeterminado');
  assert.ok(calls.some(c=>c.kind==='text'&&c.color==='#e6e6e6'),'título blanco neutro');
  assert.ok(calls.some(c=>c.kind==='outline'&&c.color==='#000000'),'contorno negro');
  calls=[];await def.prepare({...item,appearance:{cardColor:'#0f1216'}},ctx);
  assert.ok(calls.some(c=>c.kind==='fill'&&c.color==='#0f1216'),'fondo oscuro configurable');
  assert.ok(calls.some(c=>c.kind==='text'&&c.color==='#e6e6e6'),'el título conserva su color');
  if(type==='portrait.badge'||type==='portrait.cutout'||type==='editorial.press')assert.ok(calls.some(c=>c.kind==='stroke'&&c.color==='#0f1216'),'marco de imagen sigue el fondo');
  assert.ok(def.validate({...item,appearance:{cardColor:'blue'}},{}).some(e=>e.includes('cardColor')));
 });
}
