import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOverlays } from '../overlays.js';
import { scene as demoScene } from './overlays-demo-scene.js';
const scene={layers:[
 {type:'dot',at:[0,0]},{type:'ring',at:[0,0]},
 {type:'pole-photo',at:[0,0],src:'ok',label:'Headquarter',sub:'Sub'},
 {type:'hex-photo',at:[0,0],src:'ok',title:'Supplier',text:'One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twentyone twentytwo',fillAt:0},
 {type:'tag',at:[0,0],text:'Research'},{type:'panel',at:[0,0],src:'ok',title:'Distribution',text:'A very long paragraph which must wrap across several lines without overrunning the available width'},
 {type:'bars',at:[0,0],text:'Warehouse'},{type:'arc',from:[-20,0],to:[30,10],dur:2,keep:true},
 {type:'arc',from:null,to:[30,10],dur:2,style:'magenta'},{type:'title',text:'Connected world',sub:'Atlas'}]};
const env={T:(v,f)=>typeof v==='number'?v:f,loadImg:async s=>s==='ok'?{width:100,height:80}:null,img:()=>null,place:()=>[0,0]};
const view={W:1920,H:1080,pitch:60,project:(lon,lat)=>({x:800+lon*3,y:500-lat*2,k:.8,visible:true})};
function context(){const calls=[],state={globalAlpha:1},stack=[];return new Proxy(state,{get(o,k){if(k==='calls')return calls;if(k==='measureText')return s=>({width:String(s).length*10});if(k==='save')return()=>{stack.push({...o});calls.push(['save']);};if(k==='restore')return()=>{Object.assign(o,stack.pop());calls.push(['restore']);};if(k in o)return o[k];return(...args)=>calls.push([k,...args]);},set(o,k,v){o[k]=v;calls.push(['set',k,v]);return true;}});}
const render=(o,t,v=view)=>{const g=context();o.draw(g,t,v);return g.calls;};
test('seek determinista y operaciones finitas para todas las capas',async()=>{const o=createOverlays(scene,env);await o.ready();const a=render(o,1.2);render(o,4);assert.deepEqual(render(o,1.2),a);for(const call of a)for(const n of call)if(typeof n==='number')assert.ok(Number.isFinite(n),String(call));});
test('proyección invisible no dibuja elementos geográficos',()=>{const o=createOverlays({layers:scene.layers.filter(l=>l.type!=='title')},env);const calls=render(o,1,{...view,project:()=>({visible:false,x:0,y:0,k:1})});assert.ok(!calls.some(c=>['stroke','fill','fillRect','fillText','drawImage'].includes(c[0])));});
test('distribución sin solapes y texto ajustado a cuatro líneas',async()=>{const o=createOverlays(scene,env);await o.ready();const rects=o.layout(2,view);for(let i=0;i<rects.length;i++)for(let j=0;j<i;j++){const a=rects[i],b=rects[j];assert.ok(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y);}const text=render(o,2).filter(c=>c[0]==='fillText').map(c=>c[1]);assert.ok(text.some(x=>x.includes(' ')));assert.ok(text.some(x=>x.endsWith('…')));});
test('precarga y rutas ausentes',async()=>{const o=createOverlays({layers:[{type:'tag',at:'Paris',text:'A'},{type:'panel',at:[0,0],src:'missing'}]},env);await o.ready();assert.deepEqual(o.missing(),['missing']);assert.ok(render(o,2).length>2);});

test('layout de la escena demo sin solapes',()=>{const rects=createOverlays(demoScene,env).layout(3,view);for(let i=0;i<rects.length;i++)for(let j=0;j<i;j++){const a=rects[i],b=rects[j];assert.ok(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y);}});
test('escena real a 7.5 s: evita fichas y etiquetas proyectadas cercanas',async()=>{
 const {readFile}=await import('node:fs/promises');const real=JSON.parse(await readFile(new URL('../../atlas-cinematico/assets/scene.json',import.meta.url)));
 const {createCamera}=await import('../camera.js'), {createGeo,cameraKeys}=await import('../geo.js');
 const pose=createCamera(cameraKeys(real,createGeo(real),undefined,1920)).at(7.5), mercY=lat=>(1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2, scale=512*2**pose.zoom, b=pose.bearing*Math.PI/180, pitch=pose.pitch*Math.PI/180, d=1620;
 const envReal={...env,place:n=>real.places[n]}; const v={...view,pitch:pose.pitch,zoom:pose.zoom,bearing:pose.bearing,project:(lon,lat)=>{const dx=(lon-pose.lon)/360*scale,dy=(mercY(lat)-mercY(pose.lat))*scale,right=dx*Math.cos(b)+dy*Math.sin(b),forward=dx*Math.sin(b)-dy*Math.cos(b),den=d+forward*Math.sin(pitch);return {x:960+right*d/den,y:540-forward*d*Math.cos(pitch)/den,k:1,visible:den>0};}};
 const rects=createOverlays(real,envReal).layout(7.5,v);assert.equal(rects.length,4);
 for(let i=0;i<rects.length;i++)for(let j=0;j<i;j++){const a=rects[i],b=rects[j];assert.ok(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y);}
 const same={...v,project:()=>({x:960,y:540,k:1,visible:true})}, packed=createOverlays(real,envReal).layout(7.5,same);for(let i=0;i<packed.length;i++)for(let j=0;j<i;j++){const a=packed[i],b=packed[j];assert.ok(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y);}
});
test('out retira también los arcos keep en el corte',()=>{
 const o=createOverlays({layers:[{type:'arc',from:[-20,0],to:[30,10],t:0,dur:1,keep:true,out:2},{type:'dot',at:[0,0],out:2}]},env);
 assert.ok(render(o,1.9).some(c=>c[0]==='stroke'));
 assert.ok(!render(o,2).some(c=>['stroke','fill','fillRect','fillText','drawImage'].includes(c[0])));
});
