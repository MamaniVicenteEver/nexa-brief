import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm, readFile, writeFile, symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {newEpisode} from '../tools/new-episode.mjs';
import {ROOT, json, exists, parseArgs} from '../tools/production-common.mjs';
import {validateEpisodeFile} from '../tools/validate-episode.mjs';

async function workspace(t) {
  const directory = await mkdtemp(join(tmpdir(), 'vida-produce-test-scaffold-'));
  t.after(() => rm(directory, {recursive: true, force: true}));
  return {destinationRoot: directory};
}
test('scaffold válido, HTML idéntico, info compatible y sin audio inventado', async t => {
  const dependencies = await workspace(t);
  const result = await newEpisode('agua-001', {title: 'Cuidar el agua', 'aspect-note': 'Revisar las dos vistas'}, dependencies);
  assert.equal(result.created.length, 5);
  assert.deepEqual(await readFile(join(result.directory, 'index.html')), await readFile(join(ROOT, '../vida-en-escena/index.html')));
  const info = await json(join(result.directory, 'info.json'));
  assert.equal(info.engine, 'nodeaction/_vida'); assert.equal(info.based_on, 'vida-en-escena'); assert.equal(info.is_new_design, false);
  assert.ok(info.libraries.every(x => typeof x === 'object' && ['name', 'version', 'purpose'].every(k => typeof x[k] === 'string')));
  assert.ok(info.inputs.every(x => typeof x === 'string'));
  assert.ok(info.notes.includes('Revisar las dos vistas'));
  assert.deepEqual(await json(join(result.directory, 'assets/config.json')), {episode: 'assets/episode.json'});
  const c = await validateEpisodeFile(join(result.directory, 'assets/episode.json'));
  assert.equal(c.lines.length, 0); assert.equal(c.duration, 3);
  assert.deepEqual(c.episode.camera, {style: 'estable'});
  assert.deepEqual(await json(join(result.directory, 'assets/timing.json')), {version: 1, fps: 30, lines: {}});
  assert.equal(await exists(join(result.directory, 'assets/audio')), false);
});
test('una escena por set y solo personajes pedidos, incluso con un solo personaje', async t => {
  const dependencies = await workspace(t);
  const result = await newEpisode('salud-002', {title: 'Tema', sets: 'parque,escuela-entrada', cast: 'mama'}, dependencies);
  const c = await validateEpisodeFile(join(result.directory, 'assets/episode.json'));
  assert.deepEqual(c.episode.cast, {mama: 'mama'});
  assert.deepEqual(c.scenes.map(s => s.set.id), ['parque', 'escuela-entrada']);
  assert.ok(c.episode.script.every(l => l.who === 'mama'));
});
test('rechaza ids, listas, sets, personajes y títulos inválidos sin crear carpetas', async t => {
  const dependencies = await workspace(t);
  for (const id of ['../escape', 'Mi-tema', 'tema_', 'tema--001', 'tema-', '1tema', ''])
    await assert.rejects(newEpisode(id, {title: 'Título'}, dependencies), /kebab-case/);
  await assert.rejects(newEpisode('tema-001', {}, dependencies), /title/);
  await assert.rejects(newEpisode('tema-001', {title: '  '}, dependencies), /title/);
  await assert.rejects(newEpisode('tema-001', {title: 'Tema', sets: 'marte'}, dependencies), /Escenario inexistente: marte/);
  await assert.rejects(newEpisode('tema-001', {title: 'Tema', cast: 'desconocido'}, dependencies), /Personaje inexistente: desconocido/);
  for (const options of [{cast: 'tomas,tomas'}, {sets: ''}, {sets: '../parque'}, {cast: 'tomas, nico'}])
    await assert.rejects(newEpisode('tema-001', {title: 'Tema', ...options}, dependencies), /ids kebab-case/);
  assert.equal(await exists(join(dependencies.destinationRoot, 'tema-001')), false);
});
test('no sobrescribe; force explícito reemplaza, sin seguir enlaces ni tocar la base', async t => {
  const dependencies = await workspace(t), id = 'tema-003';
  const first = await newEpisode(id, {title: 'Primero'}, dependencies);
  await writeFile(join(first.directory, 'conservar.txt'), 'dato');
  await assert.rejects(newEpisode(id, {title: 'Segundo'}, dependencies), /ya existe/);
  assert.equal(await readFile(join(first.directory, 'conservar.txt'), 'utf8'), 'dato');
  await newEpisode(id, {title: 'Segundo', force: true}, dependencies);
  assert.equal((await json(join(first.directory, 'info.json'))).title, 'Segundo');
  assert.equal(await exists(join(first.directory, 'conservar.txt')), false);
  await symlink(first.directory, join(dependencies.destinationRoot, 'enlace-001'));
  await assert.rejects(newEpisode('enlace-001', {title: 'Tema', force: true}, dependencies), /enlace/);
  await assert.rejects(newEpisode('vida-en-escena', {title: 'Tema', force: true}, dependencies), /base compartida/);
});
test('CLI estricto: opciones desconocidas, duplicadas y sin valor fallan', () => {
  for (const args of [['id', '--title'], ['id', '--otra'], ['id', 'otro'], ['id', '--force', '--force']])
    assert.throws(() => parseArgs(args, {values: ['title'], flags: ['force']}));
});
