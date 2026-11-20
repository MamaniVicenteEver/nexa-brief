import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const catalog=JSON.parse(fs.readFileSync(new URL('../components.json',import.meta.url),'utf8'));
async function preview(name) {
  const source=fs.readFileSync(new URL('./preview.js',import.meta.url),'utf8').replace(/^import .*;\s*$/gm,'').replaceAll('import.meta.url',JSON.stringify('https://test.example/_atlas/showcase/preview.js'));
  let options;
  const context={URL,URLSearchParams,structuredClone,console,location:{search:'?only='+name,href:'https://test.example/_atlas/showcase/index.html'},
    document:{getElementById:()=>({textContent:''})},fetch:async()=>({ok:true,json:async()=>catalog}),
    runAtlas:async opts=>{options=opts;},window:{__promo:{total:8,seek:async()=>{},missingTiles:()=>[]}}};
  context.parent=context.window;
  await vm.runInNewContext('(async()=>{'+source+'})()',context);
  assert.equal(options.showcase,true);
  return (await options.loadData()).scene;
}

test('flagFill se reproduce por JSON con SVG público del motor, sin medios de episodio',async()=>{
  const entry=catalog.components.find(c=>c.name==='atlas.flagFill'),scene=await preview('atlas.flagFill');
  assert.equal(entry.target,'layers');assert.equal(entry.demo.type,'flag-fill');
  assert.equal(scene.layers[0].region,'US');
  assert.equal(scene.layers[0].src,'https://test.example/_atlas/showcase/assets/flags/us.svg');
  assert.ok(!scene.layers[0].src.includes('atlas-cinematico/assets'));
  const svg=fs.readFileSync(new URL('assets/flags/us.svg',import.meta.url),'utf8');
  assert.equal((svg.match(/<use /g)||[]).length,50);
  assert.equal((svg.match(/fill="#fff"\/>/g)||[]).length,7); // seis franjas blancas y una estrella en defs
  assert.match(svg,/viewBox="0 0 1900 1000"/);
});

test('persistentPortrait expone HUD existente con silueta pública y posición de pantalla',async()=>{
  const entry=catalog.components.find(c=>c.name==='atlas.persistentPortrait'),scene=await preview(entry.name);
  assert.equal(entry.target,'hud');assert.equal(entry.family,'imagenes');
  assert.equal(scene.layers.length,0);assert.equal(scene.hud.length,1);
  const portrait=scene.hud[0];assert.equal(portrait.type,'portrait');assert.equal(portrait.src,undefined);assert.equal(portrait.at,undefined);
  assert.equal(portrait.name,'RETRATO DE EJEMPLO');assert.equal(portrait.x,.15);assert.equal(portrait.y,.72);assert.equal(portrait.size,110);
});
