import {test} from 'node:test';
import assert from 'node:assert/strict';
import {animationAt} from '../animation.js';
import {createOverlays} from '../overlays.js';
function context(){const calls=[],stack=[],state={globalAlpha:1};return new Proxy(state,{get(o,k){if(k==='calls')return calls;if(k==='measureText')return s=>({width:String(s).length*10});if(k==='save')return()=>stack.push({...o});if(k==='restore')return()=>Object.assign(o,stack.pop());if(k in o)return o[k];return(...args)=>calls.push([k,...args]);},set(o,k,v){o[k]=v;calls.push(['set',k,v]);return true;}});}
const view={W:1920,H:1080,pitch:40,project:(x,y)=>({x:900+x*3,y:600-y*3,k:1,visible:true})};
const env={T:(v,f)=>typeof v==='number'?v:f,loadImg:async()=>({width:200,height:80})};
function render(scene,t){const o=createOverlays(scene,env),g=context();o.draw(g,t,view);return g.calls;}
test('entradas y salidas son buscables sin historia y terminan en sus límites',()=>{
 for(const style of ['fade','rise','scale','slide-left','slide-right']) {
  const l={enter:{style,dur:1},exit:{style,dur:.5}};
  assert.equal(animationAt(l,0,0,5).alpha,0);assert.equal(animationAt(l,2,0,5).alpha,1);assert.equal(animationAt(l,5.5,0,5).alpha,0);
  const first=animationAt(l,.4,0,5);animationAt(l,5.2,0,5);assert.deepEqual(animationAt(l,.4,0,5),first);
 }
});
test('todas las variantes de flecha usan coordenadas finitas y permiten seek fuera de orden',()=>{
 for(const options of [{},{path:'straight'},{path:'curve',lift:150},{dashed:true},{bidirectional:true},{flow:true}]) {
  const scene={layers:[{type:'arrow',from:[-20,0],to:[30,10],t:0,dur:1,keep:true,...options}]};
  const first=render(scene,1.5);render(scene,3);assert.deepEqual(render(scene,1.5),first);
  assert.ok(first.some(c=>c[0]==='closePath'),'punta triangular real');
  for(const call of first)for(const v of call)if(typeof v==='number')assert.ok(Number.isFinite(v));
 }
});
test('dataRef manda sobre la cifra de ejemplo y una métrica de pantalla no necesita lugar',()=>{
 const scene={data:{trade:{value:38.7,unit:'%',label:'Dato documentado'}},layers:[{type:'metric',value:25,label:'Ejemplo',dataRef:'trade'}]};
 const texts=render(scene,2).filter(c=>c[0]==='fillText').map(c=>c[1]);
 assert.ok(texts.includes('38.7%'));assert.ok(!texts.includes('25%'));assert.ok(texts.includes('DATO DOCUMENTADO'));
});
test('una salida de foto sigue visible durante exit.dur y desaparece después',()=>{
 const scene={layers:[{type:'tag',at:[0,0],text:'X',t:0,out:2,exit:{style:'fade',dur:1}}]};
 assert.ok(render(scene,2.5).some(c=>c[0]==='fillText'));
 assert.ok(!render(scene,3).some(c=>c[0]==='fillText'));
});
