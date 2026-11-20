import {Tactico, create, expandScene, loadComponents} from '../../engine/tactico/core.js';
import {timerFromWords} from '../../engine/tactico/tools/anchors.js';
import {createView} from '../../engine/plano/view.js';
import {createTerritories} from '../../engine/plano/territories.js';
import {createTiles} from '../../engine/plano/tiles.js';
import {atlasURL, readJSON, sharedModules, LOOKS} from '../../engine/plano/paths.js';
import {groundCacheStats, groundSpriteStatus, groundMemberPoses, prepareGround, drawGroundVehicle} from '../../engine/tactico/components/ground.js';
await loadComponents();
const query = new URLSearchParams(location.search), canvas = document.querySelector('canvas'), g = canvas.getContext('2d', {willReadFrequently: true});
const overlay = new OffscreenCanvas(1080, 1920), og = overlay.getContext('2d', {willReadFrequently: true});
if (query.has('headless')) document.body.dataset.headless = '';
const [shared, collection, look, providers, inventory, cases] = await Promise.all([sharedModules(), readJSON(atlasURL('data/geo/admin0.geojson')),
  readJSON(new URL('tactico.json', LOOKS)), readJSON(atlasURL('providers.json')), readJSON('../bench/cache-inventory.json'), readJSON('cases-terrestre.json')]);
const territories = createTerritories(collection), tiles = createTiles(providers.find(p => p.id === 'gibs-bluemarble'), look, territories, inventory);
let scene, runtime, camera, context, current = 0, playing = false, last;
const selector = document.querySelector('#component');
for (const c of cases.cases) {const option = document.createElement('option');option.value = c.id;option.textContent = c.id;selector.append(option);}
function viewAt(t) {return createView(camera.at(t), 1080, 1920);}
async function setup(source, {map = true} = {}) {
  scene = structuredClone(source);const T = timerFromWords(scene.words || []);expandScene(scene, {T, width: 1080, height: 1920});
  const geo = shared.createGeo(scene, {}, [collection]);camera = shared.createCamera(shared.cameraKeys(scene, geo, T, 1080));
  context = {st: {W: 1080, H: 1920, U: 1}, T, geo, look, scene, territories};runtime = await create(context, scene);
  if (map) {for (let t = 0; t <= (scene.duration || 9); t += .5) tiles.plan(viewAt(t));await tiles.preload();}
  document.querySelector('#time').max = scene.duration || 9;
  return {missing: runtime.missing(), optionalSprites: groundSpriteStatus(), missingTiles: tiles.missingTiles()};
}
function draw(t, {map = true, label = '', bearing = null} = {}) {
  current = t;const v = bearing == null ? viewAt(t) : createView({...camera.at(t), bearing}, 1080, 1920);
  g.resetTransform();g.globalAlpha = 1;g.fillStyle = look.background;g.fillRect(0, 0, 1080, 1920);
  if (map) {tiles.draw(g, v);territories.draw(g, v, [], 0, look);}
  runtime.draw(g, v, t);
  const grad = g.createRadialGradient(540, 900, 380, 540, 900, 1300);grad.addColorStop(0, '#00000000');grad.addColorStop(1, '#00000066');g.fillStyle = grad;g.fillRect(0, 0, 1080, 1920);
  g.fillStyle = '#e9e3ba';g.font = '700 24px Arial';g.textAlign = 'left';g.fillText(label || scene.items[0]?.type || 'TERRESTRE', 55, 165);
  g.font = '18px Arial';g.fillText(`${t.toFixed(2)} s`, 55, 195);g.font = '14px Arial';g.fillText('NASA GIBS / Blue Marble · Natural Earth', 55, 1880);
  document.querySelector('#stamp').value = `${t.toFixed(2)} s`;document.querySelector('#time').value = t;
}
function hash() {const data = g.getImageData(0, 0, 1080, 1920).data;let hash = 2166136261;for (const byte of data) hash = Math.imul(hash ^ byte, 16777619);return (hash >>> 0).toString(16);}
function bounds(t) {
  og.clearRect(0, 0, 1080, 1920);runtime.draw(og, viewAt(t), t);const data = og.getImageData(0, 0, 1080, 1920).data;
  let left = 1080, top = 1920, right = 0, bottom = 0;
  for (let y = 0; y < 1920; y++) for (let x = 0; x < 1080; x++) if (data[(y * 1080 + x) * 4 + 3] > 8) {left = Math.min(left, x);top = Math.min(top, y);right = Math.max(right, x);bottom = Math.max(bottom, y);}
  return {left, top, right, bottom, width: right - left + 1, height: bottom - top + 1};
}
async function benchmark(type, instances = 20, tokens = null) {
  const mixed = type === 'ground' || type === 'army';
  const defs = mixed ? Tactico.list().filter(d => d.name.startsWith(type + '.') && !d.name.endsWith('convoy') && !d.name.endsWith('supply')) : [Tactico.get(type)];
  const items = Array.from({length: instances}, (_, i) => {
    const item = structuredClone(defs[i % defs.length].demo), x = 48.12 + i % 4 * .23, y = 30.6 + Math.floor(i / 4) * .26;
    Object.assign(item, {id: `bench-${i}`, t: 0, dur: 20, at: [x, y], label: '', date: '', sfx: false, states: [], fire: [], seed: i});
    if (mixed) Object.assign(item, {scale: type === 'army' ? .48 : .65, ...(type === 'army' ? {count: 8, columns: 4} : {})});
    if (tokens != null) Object.assign(item, {count: tokens, columns: tokens === 40 ? 8 : 4});
    if (item.path) item.path = {via: [[x, y], [x + .07, y + .04], [x + .1, y + .1]], t: 0, dur: 10, curve: 'smooth'};
    return item;
  });
  await setup({duration: 20, items, defs: cases.cases[0].scene.defs, camera: [{t: 0, center: [48.5, 31.2], zoom: 8}]}, {map: false});
  const surface = new OffscreenCanvas(1080, 1920), cg = surface.getContext('2d', {willReadFrequently: true}), view = viewAt(3);
  const samples = [], control = [], submit = [];
  for (let i = 0; i < 80; i++) {
    cg.clearRect(0, 0, 1080, 1920);let start = performance.now();cg.getImageData(0, 0, 1080, 1920);const readback = performance.now() - start;
    cg.clearRect(0, 0, 1080, 1920);start = performance.now();runtime.draw(cg, view, 3 + i / 30);const submission = performance.now() - start;cg.getImageData(0, 0, 1080, 1920);
    if (i >= 20) {samples.push(performance.now() - start);control.push(readback);submit.push(submission);}
  }
  const stats = values => ({mean: values.reduce((a, b) => a + b, 0) / values.length, p95: [...values].sort((a, b) => a - b)[Math.ceil(values.length * .95) - 1]});
  const barriers = [];
  if (instances === 1 && tokens === 40) for (let i = 0; i < 80; i++) {
    cg.clearRect(0, 0, 1080, 1920);const start = performance.now();runtime.draw(cg, view, 3 + i / 30);cg.getImageData(540, 960, 1, 1);
    if (i >= 20) barriers.push(performance.now() - start);
  }
  return {type, instances, tokensPerInstance: tokens, scale: items[0].scale ?? 1, samples: samples.length, forcedMs: stats(samples), controlMs: stats(control), submissionMs: stats(submit), netMs: stats(samples).mean - stats(control).mean,
    ...(barriers.length ? {drawAndBarrier1pxMs: stats(barriers)} : {}), cache: groundCacheStats()};
}
async function probes() {
  const target = new OffscreenCanvas(1080, 1920), tg = target.getContext('2d', {willReadFrequently: true});let spriteDraws = 0;
  const item = {...Tactico.get('ground.ambulance').demo, dust: false, tracks: false, variant: 'cross'}, internal = await prepareGround(item, context);
  const env = {W: 1080, H: 1920, U: 1, palette: context.palette, rng: () => () => .5, sprite: name => ({available: name === 'ambulance', draw(ctx, x, y) {spriteDraws++;ctx.fillStyle = '#82949c';ctx.fillRect(x - 20, y - 60, 40, 120);}})};
  const pixels = [];
  for (const t of [2.55, 2.7, 2.55]) {
    tg.clearRect(0, 0, 1080, 1920);drawGroundVehicle(tg, {item, internal, t, lt: t, stateWeights: {normal: 1}}, viewAt(t), env, {x: 540, y: 960, angle: 0, lon: 48.4, lat: 31.1, distance: 0});
    const data = tg.getImageData(0, 0, 1080, 1920).data;let h = 2166136261;for (const byte of data) h = Math.imul(h ^ byte, 16777619);pixels.push(h >>> 0);
  }
  return {spriteDraws, ambulanceBeaconsAnimateWithSprite: pixels[0] !== pixels[1], spriteSeekStable: pixels[0] === pixels[2], cache: groundCacheStats()};
}
async function parameters(id) {
  const selected = cases.cases.find(c => c.id === id);selector.value = id;await setup(selected.scene);draw(current);
  const item = scene.items[0], def = Tactico.get(item.type), area = document.querySelector('#params');area.replaceChildren();
  for (const [key, schema] of Object.entries(def.params)) {
    if (schema.type !== 'number' && schema.type !== 'enum' && schema.type !== 'boolean') continue;
    const label = document.createElement('label');label.textContent = key;
    let input;
    if (schema.type === 'enum') {input = document.createElement('select');for (const value of schema.values) {const option = document.createElement('option');option.value = value;option.textContent = value;input.append(option);}input.value = item[key] ?? schema.default;}
    else {input = document.createElement('input');input.type = schema.type === 'boolean' ? 'checkbox' : 'range';if (input.type === 'checkbox') input.checked = item[key] ?? schema.default;else Object.assign(input, {min: schema.min ?? 0, max: schema.max ?? 100, step: schema.step ?? 1, value: item[key] ?? schema.default});}
    input.onchange = async () => {playing = false;const source = structuredClone(scene);source.items[0][key] = schema.type === 'number' ? Number(input.value) : schema.type === 'boolean' ? input.checked : input.value;try {await setup(source);draw(current);input.title = String(source.items[0][key]);} catch (error) {input.title = error.message;}};
    label.append(input);area.append(label);
  }
}
selector.onchange = () => parameters(selector.value);
document.querySelector('#time').oninput = event => {playing = false;draw(Number(event.target.value));};
document.querySelector('#play').onclick = () => {playing = !playing;last = null;};
window.__terrestre = {setup, draw, hash, bounds, benchmark, probes, cases: cases.cases, viewAt, parameters, get runtime() {return runtime;}, get context() {return context;}};
window.__terrestreReady = parameters(query.get('case') || 'army-advance');await window.__terrestreReady;
function frame(now) {if (playing) {if (last != null) draw((current + (now - last) / 1000) % (scene.duration || 9));last = now;}requestAnimationFrame(frame);}requestAnimationFrame(frame);
