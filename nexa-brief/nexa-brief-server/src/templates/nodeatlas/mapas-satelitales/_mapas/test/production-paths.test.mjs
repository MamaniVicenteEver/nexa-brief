import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const gallery = await fs.readFile(new URL('../showcase/preview.js',import.meta.url),'utf8');
async function example(root, component) {
  const result = {};
  const scope = {
    URL, URLSearchParams,
    location: {search:'?only='+component,origin:'https://nexa.invalid'},
    document: {currentScript:{src:root+'showcase/preview.js'}},
    window:{},parent:{postMessage(){}},
    Proto:{run:async engine=>{
      result.scene=(await engine.loadData()).scene;
      const context={};await engine.setup(context);result.mediaWindows=context.mediaWindows;
    }},
  };
  vm.runInNewContext(gallery,scope);
  await scope.Proto.run({setup:async()=>{}});
  return result;
}
for (const root of [
  'https://nexa.invalid/api/v1/explainer/files/bundled/nodeatlas/mapas-satelitales/_mapas/',
  'https://nexa.invalid/api/v1/explainer/files/sandbox/nodehistory/_mapas/',
]) {
  test('la galería carga sus medios desde el motor real: '+root,async()=>{
    const photo=await example(root,'map.layer.photo');
    assert.equal(photo.scene.layers[0].src,root+'media/sat-sudamerica.jpg');
    const window=await example(root,'proto.media-window');
    assert.equal(window.mediaWindows.items[0].src,root+'media/sat-sudamerica.jpg');
  });
}
test('el catálogo nativo conserva sus 16 identidades y declara archivos de producción',async()=>{
  const catalog=JSON.parse(await fs.readFile(new URL('../components.json',import.meta.url),'utf8'));
  const names=catalog.comps.map(item=>item.name);
  assert.equal(names.length,16);
  assert.equal(new Set(names).size,16);
  assert.ok(names.includes('map.layer.arrow'));
  for(const item of catalog.comps)assert.ok(item.file.startsWith('nodeatlas/mapas-satelitales/_mapas/'));
});
