import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {newEpisode,addComponent} from '../produce.mjs';
import {readJSON,checkEpisode,ATLAS} from '../validate.mjs';
let serial=0;
function fixture(fn,duration=24) {
  const root=newEpisode(`qa-atlas-${process.pid}-${++serial}`,{title:'QA temporal',duration});
  try {fn(root);} finally {fs.rmSync(root,{recursive:true,force:true});}
}
function modify(root,fn) {const p=path.join(root,'assets/scene.json'),scene=readJSON(p);fn(scene);fs.writeFileSync(p,JSON.stringify(scene));}
test('starter usa motor compartido desde producción y no finge audio',()=>fixture(root=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.match(html,/\.\.\/\.\.\/sandbox\/nodehistory\/_atlas\/atlas\.js/);
  assert.equal(checkEpisode(root).ok,true);
  assert.equal(checkEpisode(root,{ready:true}).ok,false);
  assert.ok(readJSON(path.join(root,'assets/scene.json')).camera.every(k=>k.t<12));
},12));
test('cierre conserva duración/look inicial y desplaza todas sus capas',()=>fixture(root=>{
  addComponent(root,'atlas.outrov2');
  const s=readJSON(path.join(root,'assets/scene.json'));
  assert.equal(s.duration,24);assert.equal(s.look,'satelite-realista');
  assert.equal(s.looks.at(-1).t,16);assert.equal(s.looks.at(-1).look,'espacio');
  assert.ok(s.camera.slice(-2).every(k=>k.t>=16));assert.ok(s.layers.at(-1).t>16);
  assert.equal(checkEpisode(root).ok,true);
}));
test('animación actualiza capa existente y exige índice/salida',()=>fixture(root=>{
  assert.throws(()=>addComponent(root,'atlas.animation'),/index/);
  addComponent(root,'atlas.animation',{style:'rise',dur:.8},{index:'1',out:'20'});
  const s=readJSON(path.join(root,'assets/scene.json'));assert.equal(s.layers.length,2);
  assert.equal(s.layers[1].enter.style,'rise');assert.equal(s.layers[1].exit.dur,.8);assert.equal(s.layers[1].out,20);
}));
test('rechaza anclas inexistentes, referencias y porcentajes fuera de rango',()=>fixture(root=>{
  modify(root,s=>{s.layers.push({type:'arrow',from:[0,0],to:[1,1],t:'@no existe',dataRef:'ausente'});s.data={x:{value:150,unit:'%',year:2025,scope:'exportaciones',source:'https://official.example/table'}};});
  const r=checkEpisode(root);assert.equal(r.ok,false);
  assert.ok(r.errors.some(e=>e.includes('Anclas')));assert.ok(r.errors.some(e=>e.includes('dataRef')));assert.ok(r.errors.some(e=>e.includes('porcentaje')));
}));
test('fuente sin id no valida datos sin source, year null o scope objeto',()=>fixture(root=>{
  fs.writeFileSync(path.join(root,'research.json'),JSON.stringify({sources:[{url:'https://official.example/table'}]}));
  modify(root,s=>s.data={x:{value:2,unit:'%',year:null,scope:{}}});
  const r=checkEpisode(root);assert.equal(r.ok,false);assert.ok(r.errors.some(e=>e.includes('URL primaria')));assert.ok(r.errors.some(e=>e.includes('año y alcance')));
}));
test('looks provienen del catálogo soportado; rechaza legacy tactico',()=>fixture(root=>{
  modify(root,s=>s.look='tactico');assert.equal(checkEpisode(root).ok,false);
}));
test('valores inline sin fuente son visibles en advertencias y bloquean ready',()=>fixture(root=>{
  modify(root,s=>s.layers.push({type:'metric',t:1,value:25,unit:'%'}));
  assert.ok(checkEpisode(root).warnings.some(e=>e.includes('valor inline')));
  assert.ok(checkEpisode(root,{ready:true}).errors.some(e=>e.includes('valor inline')));
}));
test('dato compartido se registra una vez y se reutiliza por referencia sin sobrescritura',()=>fixture(root=>{
  addComponent(root,'atlas.data',{id:'socio-demo'});
  addComponent(root,'atlas.metric',{dataRef:'socio-demo'});
  addComponent(root,'atlas.arrow',{dataRef:'socio-demo'});
  const s=readJSON(path.join(root,'assets/scene.json'));
  assert.equal(s.data['socio-demo'].value,25);
  assert.equal(s.layers.at(-1).dataRef,'socio-demo');
  assert.throws(()=>addComponent(root,'atlas.data',{id:'socio-demo'}),/Ya existe/);
  assert.equal(checkEpisode(root).ok,true);
  assert.ok(checkEpisode(root,{ready:true}).errors.some(e=>e.includes('ilustrativo')));
}));
