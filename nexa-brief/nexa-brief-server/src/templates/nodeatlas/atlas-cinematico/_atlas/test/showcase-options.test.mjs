import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = (await readFile(new URL('../atlas.js', import.meta.url), 'utf8'))
  .replace(/^import .*;\s*$/gm, '')
  .replaceAll('import.meta.url', '"http://test/_atlas/atlas.js"')
  .replace('export function runAtlas', 'function runAtlas');

async function setup({ showcase = false, search = '', overlaysUrl = null, worldCopies, expectedError = /stop-before-render/ } = {}) {
  const requests = [];
  let engine, mapOptions;
  const context = {
    URL, URLSearchParams, console, Promise, Set, setTimeout, clearTimeout,
    location: { search, href: 'http://test/showcase/' }, navigator: { webdriver: true },
    document: { documentElement: { dataset: { atlasManual: 'true' } },
      createElement: () => ({ style: {} }), body: { appendChild() {} } },
    maplibre: { addProtocol() {}, setWorkerUrl() {}, Map: class { constructor(options) { mapOptions=options;throw Error('stop-before-render'); } } },
    Protocol: class { tile() {} add() {} }, PMTiles: class {},
    createGeo: () => ({}), cameraKeys: () => [], createCamera: () => ({}),
    applyNewsStyle: () => {}, // These isolated fixtures do not select a news style.
    createLookAt: () => () => ({ sat: {} }), composeStyle: () => ({ sources: {}, layers: [] }),
    fetch: async url => { requests.push(String(url)); return { ok: true, json: async () => ({ features: [] }) }; },
    Proto: { run: value => { engine = value; return Promise.resolve(); } },
  };
  context.window = context;
  vm.runInNewContext(source, context);
  await context.runAtlas({ showcase });
  const ctx = { scene: { layers: [] }, T: () => 0, st: { W: 100, H: 100 }, C: { overlaysUrl } };
  if(worldCopies!==undefined)ctx.scene.worldCopies=worldCopies;
  await assert.rejects(engine.setup(ctx), expectedError);
  return { requests, ctx, mapOptions };
}

test('only isolated showcase skips missing optional episode sources', async () => {
  const ordinary = await setup();
  assert.ok(ordinary.requests.includes('assets/geo.resolved.json'));
  assert.equal(ordinary.ctx.mediaWindows, undefined);
  const preview = await setup({ showcase: true });
  assert.ok(!preview.requests.includes('assets/geo.resolved.json'));
  assert.equal(preview.ctx.mediaWindows.items.length, 0);
});

test('world copies exige opt-in booleano al construir MapLibre',async()=>{
  assert.equal((await setup()).mapOptions.renderWorldCopies,false);
  assert.equal((await setup({worldCopies:true})).mapOptions.renderWorldCopies,true);
  assert.equal((await setup({worldCopies:false})).mapOptions.renderWorldCopies,false);
  assert.equal((await setup({worldCopies:'true'})).mapOptions.renderWorldCopies,false);
});

test('showcase preserves explicit media windows from query or config', async () => {
  assert.equal((await setup({ showcase: true, search: '?overlays=custom.json' })).ctx.mediaWindows, undefined);
  assert.equal((await setup({ showcase: true, overlaysUrl: 'custom.json' })).ctx.mediaWindows, undefined);
  const withGeo = await setup({ showcase: true, search: '?geo=assets/custom.json' });
  assert.ok(withGeo.requests.includes('assets/custom.json'));
  await setup({ showcase: true, search: '?geo=https://other.example/secret.json', expectedError: /Ruta de geometría/ });
});
