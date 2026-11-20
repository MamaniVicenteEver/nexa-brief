import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Tactico, validateScene, create} from '../../../_tactico/core.js';
import {discover} from '../../../_tactico/tools/registry.mjs';
import {timerFromWords} from '../../../_tactico/tools/anchors.js';
import {createView} from '../../../_atlas/plano/view.js';
import {prepareGroundMotion, groundDistance, groundPoseAtDistance, groundMemberPoses, prepareGround, fireTimes, shotEnvelope, groundActivity} from '../../../_tactico/components/ground.js';
import {armyFormation, prepareArmy} from '../../../_tactico/components/army.js';
await discover();
const cases = JSON.parse(await readFile(new URL('./cases-terrestre.json', import.meta.url))).cases;
const types = Tactico.list().filter(d => /^(ground|army)\./.test(d.name) || d.name === 'fx.dust');
const T = timerFromWords([{word: 'disparo', start: 2.5, end: 2.8}]);
const context = {T, scene: {places: {A: [48.3, 31], B: [48.6, 31.3]}, items: []}};
const view = createView({lon: 48.45, lat: 31.2, zoom: 8, bearing: 37}, 1080, 1920);

test('16 registros, metadata completa, demos y 27 casos válidos', () => {
  assert.equal(types.length, 16);assert.equal(cases.length, 27);
  for (const def of types) {
    for (const method of ['draw', 'prepare', 'validate']) assert.equal(typeof def[method], 'function', `${def.name}.${method}`);
    assert.ok(def.summary.length > 25);assert.ok(def.demo);assert.ok(def.params.scale.min > 0);
    assert.deepEqual(validateScene({duration: 9, items: [def.demo]}).errors, [], def.name);
  }
  for (const c of cases) assert.deepEqual(validateScene(c.scene).errors, [], c.id);
});
test('solo se añadieron entradas al inventario de unidades', async () => {
  const units = JSON.parse(await readFile(new URL('../../../_tactico/units.json', import.meta.url)));
  const baseline = JSON.parse(await readFile(new URL('./terrestre-baseline-units.json', import.meta.url)));
  for (const key of baseline.existingKeys) assert.deepEqual(units.units[key], baseline.existing[key], key);
  assert.equal(Object.keys(units.units).length, baseline.existingKeys.length + 19);
});
test('validación rechaza parámetros fuera de rango, vehículos y disparos inválidos', () => {
  for (const [type, patch] of [['ground.tank', {variant: 'bad'}], ['ground.tank', {particles: 2.3}],
    ['ground.truck', {scale: -1}], ['ground.convoy', {vehicles: ['bad']}], ['ground.convoy', {path: null}],
    ['ground.artillery', {fire: ['@inexistente']}], ['ground.artillery', {fire: [Infinity]}], ['ground.launcher', {fire: [2], to: null}],
    ['ground.launcher', {fire: [2], to: [190, 100]}], ['ground.tank', {seed: {}}],
    ['army.advance', {count: 41}], ['army.hold', {columns: 2.4}], ['army.advance', {path: null}],
    ['army.advance', {spacing: 44, radius: 42}], ['army.clash', {fall: 9}]]) {
    const def = Tactico.get(type);assert.ok(def.validate({...def.demo, ...patch}, context).length, `${type} ${JSON.stringify(patch)}`);
  }
});
test('fire resuelve anclas y estados, ordena y elimina duplicados', () => {
  assert.deepEqual(fireTimes({fire: [4, '@disparo', 4], states: [{at: 1, state: 'fire'}, {at: 3, state: 'hit'}]}, context), [1, 2.5, 4]);
  assert.deepEqual(fireTimes({t: 1.5, state: 'fire'}, context), [1.5]);
  assert.equal(shotEnvelope([2.5], 2).flash, 0);assert.ok(shotEnvelope([2.5], 2.53).flash > .7);
  assert.ok(shotEnvelope([2.5], 2.55).recoil > .5);assert.equal(shotEnvelope([2.5], 3.1).recoil, 0);
});
test('distancia, estado de ruta y posición no dependen del orden de seek', () => {
  const item = Tactico.get('ground.tank').demo, motion = prepareGroundMotion(item, context);
  const sample = t => ({d: groundDistance(motion, t), p: groundPoseAtDistance(motion, item, groundDistance(motion, t))});
  const times = [0, .5, 1, 2.5, 6, 8], baseline = times.map(sample);
  assert.ok(motion.total > 0);assert.equal(sample(0).d, 0);assert.ok(sample(3).d > sample(2).d);
  assert.equal(groundActivity(motion, 0, view), 0);assert.ok(groundActivity(motion, 3.3, view) > .25, 'el polvo debe ser perceptible a la velocidad de la demo');
  assert.deepEqual(times.toReversed().map(sample).toReversed(), baseline);
  const straight = prepareGroundMotion({at: [48, 31], path: {via: [[48, 31], [49, 31]], t: 1, dur: 4}}, context);
  assert.ok(groundPoseAtDistance(straight, {}, -straight.total * .2).lon < 48);
});
test('convoy: separación por arco exacta, lista mixta y giros suaves a 10 fps', async () => {
  const item = {...Tactico.get('ground.convoy').demo, count: 9, spacing: 110};
  const internal = await prepareGround(item, context), env = {U: 1};
  assert.equal(internal.members.length, 9);assert.ok(new Set(internal.members.map(m => m.type)).size >= 4);
  let previous, maxStep = 0;
  for (let i = 0; i <= 80; i++) {
    const members = groundMemberPoses({item, internal, t: i / 10}, view, env);
    assert.equal(members.length, 9);
    for (let j = 1; j < members.length; j++) assert.ok(Math.abs((members[j - 1].distance - members[j].distance) * view.scale - 110) < 1e-7);
    if (previous) for (let j = 0; j < members.length; j++) maxStep = Math.max(maxStep, Math.abs(Math.atan2(Math.sin(members[j].pose.angle - previous[j].pose.angle), Math.cos(members[j].pose.angle - previous[j].pose.angle))) / Math.PI * 180);
    previous = members;
  }
  assert.ok(maxStep < 15, `rumbo por 0.1s: ${maxStep}`);
});
test('lanzador prepara strike.missile desde su posición exacta en cada disparo', async () => {
  const item = {...Tactico.get('ground.launcher').demo, fire: ['@disparo', 4]};
  const internal = await prepareGround(item, context);
  assert.equal(internal.launches.length, 2);
  for (const launch of internal.launches) {
    assert.equal(launch.def.name, 'strike.missile');assert.ok(launch.internal.launches.length);
    const q = groundPoseAtDistance(internal.motion, item, groundDistance(internal.motion, launch.item.t));
    assert.ok(Math.abs(launch.item.from[0] - q.lon) < 1e-7);assert.ok(Math.abs(launch.item.from[1] - q.lat) < 1e-7);
  }
  assert.deepEqual(internal.effects.map(e => e.def.name), ['fx.fire', 'fx.smoke']);
});
test('8–40 fichas: cantidad, escalonado, ondulación y geometría finita', () => {
  for (const type of ['army.advance', 'army.retreat', 'army.hold', 'army.encircle', 'army.clash']) for (const count of [8, 16, 24, 40]) {
    const item = {...Tactico.get(type).demo, count, columns: 8}, state = {item, t: 4, lt: 4};
    const a = armyFormation(state), b = armyFormation({...state, t: 4.2, lt: 4.2});
    assert.equal(a.length, count);assert.ok(a.every(p => Number.isFinite(p.x + p.y + p.tilt)));
    assert.deepEqual(armyFormation(state), a);
    if (!['army.encircle', 'army.clash'].includes(type)) assert.notDeepEqual(a, b);
  }
});
test('cerco: los dos brazos cierran sin superponer centros en el demo', () => {
  const item = Tactico.get('army.encircle').demo, start = armyFormation({item, t: 0, lt: 0}), end = armyFormation({item, t: 6, lt: 6});
  const width = pts => Math.max(...pts.map(p => p.x)) - Math.min(...pts.map(p => p.x));
  assert.ok(width(end) < width(start));
  let minimum = Infinity;
  for (let a = 0; a < end.length; a++) for (let b = a + 1; b < end.length; b++) minimum = Math.min(minimum, Math.hypot(end[a].x - end[b].x, end[a].y - end[b].y));
  assert.ok(minimum > item.radius * 1.85, `centros: ${minimum}`);
});
test('suministro prepara el mismo camión y tabla inmutables para seek', async () => {
  const item = Tactico.get('army.supply').demo, source = structuredClone(item), result = await prepareArmy(item, context);
  assert.equal(result.truck.type, 'ground.truck');assert.ok(result.motion.total > 0);assert.deepEqual(item, source);
});
test('runtime: clave temporal determinista, fade y estados interrumpidos', async () => {
  const item = {...Tactico.get('ground.tank').demo, states: [{at: 1, state: 'burning', dur: 2}, {at: 1.7, state: 'destroyed', dur: 1}]};
  const runtime = await create({st: {W: 1080, H: 1920, U: 1}, T}, {duration: 9, items: [item]});
  const times = [0, .2, 1.2, 1.8, 3, 8.3, 8.6], keys = times.map(t => runtime.key(t));
  assert.deepEqual(times.toReversed().map(t => runtime.key(t)).toReversed(), keys);
  assert.notEqual(runtime.key(1.2), runtime.key(1.3));assert.equal(runtime.key(9), 'tactico:idle');
});
