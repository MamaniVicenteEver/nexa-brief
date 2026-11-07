import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('./imperio-isolated.js',import.meta.url),'utf8');
test('la vista aislada conserva la proyección y no dibuja ni precalienta mapas',()=>{
  const calls=[], families=new Map(), V={pt:(lon,lat)=>[lon*2,lat*3]};
  const view=(st,cam)=>{calls.push(['view',st,cam]);return V;};
  const fail=()=>{throw Error('No debe hornear el mapa');};
  const IM={view,world:()=>calls.push(['world']),tex:fail,mapCache:fail,drawMap:fail,warmAtlas:fail,warmKey:fail,sliceWork:fail,drawHatch:(...args)=>calls.push(['hatch',...args]),drawLabels:(...args)=>calls.push(['labels',...args]),clearKeys(){}};
  const Kit={imperio:IM,family:(name,rt)=>families.set(name,rt)}, scope={window:{Kit},document:{fonts:{load:async()=>{}}}};
  vm.runInNewContext(source,scope);
  const ctx={stage:{W:1080,H:1920}},cam={lon:145,lat:35,span:125,rot:3},G={};
  families.get('imperio').setup(ctx);families.get('imperio').frame();
  const returned=IM.mapCache(ctx).draw(G,cam,null,'frame',{hatch:['Japan'],labels:[{t:'Puerto',at:[140,35]}]});
  assert.equal(IM.view,view);assert.equal(returned,V);
  assert.deepEqual(returned.pt(140,35),[280,105]);
  assert.ok(calls.some(c=>c[0]==='view'&&c[1]===ctx.stage&&c[2]===cam));
  assert.ok(!calls.some(c=>c[0]==='hatch'));
  IM.warmAtlas();IM.warmKey();IM.sliceWork();
  assert.equal(scope.window.__imperioShowcase.videoUsesMap,true);
  assert.equal(scope.window.__imperioShowcase.rasterMaps,0);
});
test('los fotogramas cubren todos los componentes y ambos formatos sin cambiar entradas',()=>{
 const root=new URL('./imperio-thumbs/',import.meta.url), manifest=JSON.parse(fs.readFileSync(new URL('index.json',root),'utf8'));
 assert.equal(manifest.mode,'isolated-overlays');
 assert.ok(manifest.production.inputs.includes('pins[].at'));
 for(const row of manifest.components)for(const format of ['9x16','16x9']){
  const bytes=fs.readFileSync(new URL(`${row.name}-${format}.jpg`,root));
  assert.equal(bytes.subarray(0,3).toString('hex'),'ffd8ff',`${row.name} ${format}`);
 }
 assert.equal(new Set(manifest.components.map(c=>c.name)).size,manifest.components.length);
});
