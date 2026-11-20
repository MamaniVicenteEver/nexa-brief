import test from 'node:test';
import assert from 'node:assert/strict';
import {expandScene} from '../core.js';
import {createCamera} from '../../_atlas/camera.js';
import {createView} from '../../_atlas/plano/view.js';
import {timerFromWords} from '../tools/anchors.js';
const scene=()=>({places:{A:[56,26],B:[58,27]},items:[{id:'ship',type:'debug.dot',path:{via:[[56,26],[56.5,26.3],[58,27]],t:0,dur:6,curve:'smooth',ease:'inOut'}}],camera:[{t:0,center:[56,26],zoom:6},{t:1,follow:'ship',dur:4,zoom:6},{t:6,zoomThrough:{to:'B',zoom:8,spin:25},dur:2},{t:9,focus:'ship',dur:1},{t:11,reframe:['ship','A','B'],dur:2}]});
test('expansión determinista, idempotente; solo cambia camera',()=>{
  const a=scene(),b=scene(),before=structuredClone(a.items);expandScene(a);expandScene(b);
  assert.deepEqual(a,b);assert.deepEqual(a.items,before);const keys=structuredClone(a.camera);expandScene(a);assert.deepEqual(a.camera,keys);
  assert.ok(a.camera.every(k=>!k.follow&&!k.zoomThrough&&!k.reframe));
});
test('follow muestrea ≤0,25 s y Hermite entrega pose/velocidad continuas',()=>{
  const a=scene();expandScene(a);const follows=a.camera.filter(k=>k.t>=1&&k.t<5);
  assert.equal(follows.length,16);assert.ok(follows.every(k=>k.dur<=.25&&k.arc===0));
  const camera=createCamera(a.camera.map(k=>({...k,zoom:k.zoom??6}))),eps=1e-6;
  for(const k of follows.slice(1)){
    const a=camera.raw(k.t-eps),b=camera.raw(k.t+eps),va=camera.velocity(k.t-eps),vb=camera.velocity(k.t+eps);
    for(const c of ['x','y','z','b']){assert.ok(Math.abs(a[c]-b[c])<1e-4);assert.ok(Math.abs(va[c]-vb[c])<2e-3,`${c} en ${k.t}`);}
  }
});
test('zoomThrough gira y acerca; focus sigue la posición de llegada',()=>{
  const a=scene();expandScene(a);const k=a.camera.find(k=>k.t===6);assert.deepEqual(k.center,[58,27]);assert.equal(k.bearing,25);assert.equal(k.zoom,8);assert.equal(k.ease,'out');assert.equal(k.arc,0);
  const focus=a.camera.find(k=>k.t===9);assert.ok(Math.abs(focus.center[0]-58)<1e-9);
});
test('reframe encuadra todos los puntos en ambos formatos y con bearing',()=>{
  for(const [W,H] of [[1080,1920],[1920,1080]]){
    const a=scene();a.camera=[{t:0,reframe:['A','B'],bearing:25}];expandScene(a);
    const k=a.camera[0],zoom=Math.log2(W*360/(512*k.span)),view=createView({lon:k.center[0],lat:k.center[1],zoom,bearing:k.bearing},W,H);
    for(const p of Object.values(a.places)){const q=view.project(...p);assert.ok(q.x>0&&q.x<W&&q.y>0&&q.y<H);}
  }
});
test('anclas, referencias desconocidas y duraciones inválidas fallan en Node',()=>{
  const T=timerFromWords([{word:'seguir',start:1,end:2}]),a=scene();a.camera[1].t='@seguir';expandScene(a,{T});assert.equal(a.camera[1].t,1);
  assert.throws(()=>expandScene({...scene(),camera:[{t:'@ausente',follow:'ship'}]},{T}),/sin resolver/);
  assert.throws(()=>expandScene({...scene(),camera:[{t:0,follow:'no-existe'}]}),/desconocido/);
  assert.throws(()=>expandScene({...scene(),camera:[{t:0,follow:'ship',dur:0}]}),/positiva/);
});
test('un comando posterior interrumpe follow sin que reaparezcan muestras viejas',()=>{
  const a=scene();a.camera=[a.camera[0],{t:1,follow:'ship',dur:10},{t:3,zoomThrough:{to:'B',zoom:8},dur:1}];
  expandScene(a);assert.equal(a.camera.filter(k=>k.t>3).length,0);assert.equal(a.camera.at(-1).zoom,8);
});
test('follow puede abrir una escena y el foco de unidad conserva el zoom',()=>{
  const a=scene();a.camera=[{t:0,follow:'ship',dur:2,zoom:7},{t:3,focus:'ship',dur:1}];
  expandScene(a);assert.equal(a.camera[0].t,0);assert.ok(a.camera[0].center[0]<56.03);
  assert.equal(a.camera.at(-1).zoom,7);
  const camera=createCamera(a.camera);for(const t of [0,.2,1,2,3.5])assert.ok(Number.isFinite(camera.at(t).lon));
});
test('reframe prevalece sobre un zoom explícito que recortaría los puntos',()=>{
  const a=scene();a.camera=[{t:0,reframe:['A','B'],zoom:22}];expandScene(a);
  assert.ok(a.camera[0].span>2);assert.equal(a.camera[0].zoom,undefined);
});
