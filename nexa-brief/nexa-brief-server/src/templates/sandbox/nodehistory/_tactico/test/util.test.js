import test from 'node:test';
import assert from 'node:assert/strict';
import {mercator,unmercator,headingBetween,pathAt,rng,easing,smoothstep,bezierAt,bezierArrow,textOutlined} from '../util.js';
const near=(a,b,e=1e-6)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
test('Mercator normalizado, inversión y clipping polar',()=>{
  assert.deepEqual(mercator(0,0),[.5,.5]);
  for(const p of [[56.4,26.5],[-73,78],[179,-80]]){const q=unmercator(...mercator(...p));near(p[0],q[0]);near(p[1],q[1]);}
  assert.deepEqual(mercator(10,90),mercator(10,85.0511287798066));
});
test('rumbo desde el norte y camino corto al cruzar el antimeridiano',()=>{
  near(headingBetween([0,0],[0,1]),0);near(headingBetween([0,0],[1,0]),90);
  near(headingBetween([0,0],[0,-1]),180);near(headingBetween([179,0],[-179,0]),90);
  assert.notEqual(headingBetween([0,70],[1,71]),45);
});
test('easings acotados, extremos exactos y spring determinista',()=>{
  for(const fn of Object.values(easing)){assert.equal(fn(0),0);assert.equal(fn(1),1);assert.equal(fn(.37),fn(.37));}
  assert.equal(easing.linear(-1),0);near(easing.inOut(.5),.5);near(smoothstep(2,4,3),.5);
});
test('mulberry32: vector conocido y semillas de texto',()=>{
  const random=rng(1);near(random(),.6270739405881613);near(random(),.002735721180215478);
  const a=rng('barco'),b=rng('barco');assert.deepEqual(Array.from({length:20},a),Array.from({length:20},b));assert.notEqual(rng(2)(),rng(1)());
});
test('path line usa distancias y t absoluto, incluidas duración cero y speed',()=>{
  const p={via:[[0,0],[1,0],[4,0]],t:2,dur:8};
  near(pathAt(p,4).lon,1);near(pathAt(p,-1).lon,0);near(pathAt(p,99).lon,4);near(pathAt(p,6).heading,90);
  near(pathAt({...p,dur:0},1).u,0);near(pathAt({...p,dur:0},2).u,1);
  near(pathAt({via:[[0,0],[1,0]],speed:111.3194908},.5).lon,.5);
  assert.deepEqual(pathAt(p,6),pathAt(p,6));
});
test('arco y Catmull-Rom interpolan en Mercator, sin depender del seek',()=>{
  for(const curve of ['arc','smooth']){
    const p={via:[[179,65],[-179,67],[-175,66]],curve,dur:4};
    near(pathAt(p,0).lon,179);near(pathAt(p,4).lon,-175);near(pathAt(p,4).lat,66);
    const expected=pathAt(p,2);pathAt(p,3.9);pathAt(p,0);assert.deepEqual(pathAt(p,2),expected);
    assert.ok(Math.abs(expected.lon)>170);assert.ok(Number.isFinite(expected.heading));
  }
  const p={via:[[0,60],[10,70]],dur:2};near(mercator(pathAt(p,1).lon,pathAt(p,1).lat)[1],(mercator(0,60)[1]+mercator(10,70)[1])/2);
});
test('trayectorias degeneradas y ancla exacta en el extremo',()=>{
  const p={via:[[5,4],[5,4]],dur:1};near(pathAt(p,.5).heading,0);near(pathAt(p,.5).lon,5);
  assert.throws(()=>pathAt({via:[]},0),/punto/);
});
test('Bézier, punta y texto conservan coordenadas subpíxel y contexto',()=>{
  assert.deepEqual(bezierAt([[0,0],[1,2],[2,0]],.5),[1,1]);
  const calls=[],g=new Proxy({strokeStyle:'#fff',fillStyle:'#fff',measureText:()=>({width:50})},{get:(o,k)=>o[k]??((...args)=>calls.push([k,...args]))});
  bezierArrow(g,[[.25,.5],[20,50],[80,10]],{u:.5});
  assert.ok(calls.some(c=>c[0]==='quadraticCurveTo'));assert.ok(calls.some(c=>c[0]==='moveTo'&&c[1]===.25));
  textOutlined(g,'prueba',10.25,12.5,{maxWidth:80});assert.ok(calls.some(c=>c[0]==='fillText'&&c[2]===10.25&&c[4]===80));
});
