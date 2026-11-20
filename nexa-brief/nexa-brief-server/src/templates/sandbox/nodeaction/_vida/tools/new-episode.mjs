#!/usr/bin/env node
import {mkdir, mkdtemp, copyFile, rename, rm, lstat} from 'node:fs/promises';
import {join, resolve, dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import Ajv from 'ajv/dist/2020.js';
import {ROOT, ID, json, save, exists, parseArgs, csv} from './production-common.mjs';

/** root es inyectable para pruebas; el CLI siempre usa la biblioteca compartida. */
export async function newEpisode(id, options = {}, {root = ROOT, destinationRoot = resolve(root, '..')} = {}) {
  if (!ID.test(id)) throw new Error('El id debe ser kebab-case: minúsculas, números y guiones (por ejemplo agua-001).');
  if (typeof options.title !== 'string' || !options.title.trim()) throw new Error('Falta --title con un título no vacío.');
  const sets = csv(options.sets ?? 'escuela-entrada', 'Escenarios');
  const cast = csv(options.cast ?? 'tomas,nico', 'Personajes');
  const library = {};
  for (const character of cast) {
    const file = join(root, 'characters', `${character}.json`);
    if (!await exists(file)) throw new Error(`Personaje inexistente: ${character}. Revisá characters/.`);
    const data = await json(file);
    if (data.id !== character) throw new Error(`Personaje incompatible: ${character}.`);
  }
  for (const set of sets) {
    const file = join(root, 'sets', set, 'set.json');
    if (!await exists(file)) throw new Error(`Escenario inexistente: ${set}. Revisá sets/.`);
    library[set] = await json(file);
  }
  const target = join(destinationRoot, id);
  const occupied = await lstat(target).catch(e => { if (e.code !== 'ENOENT') throw e; return null; });
  if (occupied && !options.force) throw new Error(`La carpeta ya existe: ${target}. No se sobrescribe; --force es explícito y reemplaza la carpeta completa.`);
  if (occupied?.isSymbolicLink() || occupied && !occupied.isDirectory()) throw new Error('El destino debe ser una carpeta normal, nunca un enlace ni un archivo.');
  if (id === 'vida-en-escena' || id.startsWith('_')) throw new Error('No se puede reemplazar la plantilla base compartida.');
  const episode = await json(join(root, 'templates/episode.skeleton.json'));
  episode.id = id; episode.title = options.title.trim();
  episode.cast = Object.fromEntries(cast.map(c => [c, c]));
  episode.script = episode.script.map((line, i) => ({...line, who: cast[i % cast.length]}));
  const sceneTemplate = episode.scenes[0];
  episode.scenes = sets.map((set, i) => {
    const s = library[set], center = (s.walk[0] + s.walk[1]) / 2;
    const spacing = Math.min(s.charHeight * .6, (s.walk[1] - s.walk[0]) / cast.length);
    return {...structuredClone(sceneTemplate), id: `escena-${String(i + 1).padStart(3, '0')}`, set,
      actors: Object.fromEntries(cast.map((c, n) => [c, {at: center + (n - (cast.length - 1) / 2) * spacing,
        view: n < cast.length / 2 ? '3q-right' : '3q-left'}]))};
  });
  const validate = new Ajv({allErrors: true, strict: false}).compile(await json(join(root, 'schema/episode.schema.json')));
  if (!validate(episode)) throw new Error('Esqueleto fuera de esquema: ' + JSON.stringify(validate.errors));
  const info = {
    title: episode.title, engine: 'nodeaction/_vida', based_on: 'vida-en-escena', is_new_design: false,
    status: 'borrador sin voz', summary: 'Episodio nuevo por datos con el motor compartido Vida en Escena.',
    created_at: new Date().toISOString().slice(0, 10),
    libraries: [
      {name: 'Canvas 2D (ES modules)', version: 'nativo del navegador', purpose: 'motor compartido nodeaction/_vida'},
      {name: '@napi-rs/canvas', version: '1.1.0', purpose: 'cuadros en Node'},
      {name: 'ffmpeg', version: 'del sistema', purpose: 'mezcla y codificación H.264 + AAC'},
      {name: 'Ajv', version: '8.20.0', purpose: 'validación JSON Schema'}
    ],
    inputs: ['Episodio (json): assets/episode.json'],
    notes: ['Guion de ejemplo sin montar: reemplazá wait por say al preparar el diálogo. timing.json está vacío: no contiene voz ni tiempos inventados.',
      ...(options['aspect-note'] ? [options['aspect-note']] : [])]
  };
  await mkdir(destinationRoot, {recursive: true});
  const staging = await mkdtemp(join(destinationRoot, '.vida-scaffold-'));
  let backup;
  try {
    await mkdir(join(staging, 'assets'));
    await copyFile(join(root, '../vida-en-escena/index.html'), join(staging, 'index.html'));
    await save(join(staging, 'assets/config.json'), {episode: 'assets/episode.json'});
    await save(join(staging, 'assets/episode.json'), episode);
    // El montaje mudo pasa validate; el guion de ejemplo no afirma tener voz.
    await save(join(staging, 'assets/timing.json'), {version: 1, fps: 30, lines: {}});
    await save(join(staging, 'info.json'), info);
    if (occupied) { backup = staging + '-previous'; await rename(target, backup); }
    else if (await exists(target)) throw new Error(`La carpeta ya existe: ${target}.`);
    try { await rename(staging, target); }
    catch (error) { if (backup) { await rename(backup, target); backup = null; } throw error; }
    if (backup) await rm(backup, {recursive: true, force: true});
    return {id, directory: target, created: ['index.html', 'info.json', 'assets/config.json', 'assets/episode.json', 'assets/timing.json'].map(p => join(target, p))};
  } finally { await rm(staging, {recursive: true, force: true}); }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const {input, ...options} = parseArgs(process.argv.slice(2), {values: ['title', 'sets', 'cast', 'aspect-note'], flags: ['force']});
    console.log(JSON.stringify(await newEpisode(input, options), null, 2));
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
