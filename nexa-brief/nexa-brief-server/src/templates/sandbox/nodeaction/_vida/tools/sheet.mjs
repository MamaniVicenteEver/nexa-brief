import { createCanvas } from '@napi-rs/canvas';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { readCharacter, readCharacters } from './validate.mjs';
import { drawCharacterSheet, drawGroupSheet, SHEET_WIDTH, SHEET_HEIGHT } from '../engine/sheets.js';

const [id, output] = process.argv.slice(2);
if (!id || !output) { console.error('Uso: node tools/sheet.mjs <id|group|all> <out.png|directorio>'); process.exit(1); }
async function save(canvas, file) {
  await mkdir(dirname(resolve(file)), { recursive: true }); await writeFile(file, await canvas.encode('png'));
  console.log(`${file} · ${canvas.width} × ${canvas.height}`);
}
async function sheet(character, file) {
  const canvas = createCanvas(SHEET_WIDTH, SHEET_HEIGHT);
  drawCharacterSheet(canvas.getContext('2d'), character); await save(canvas, file);
  // A compact review copy keeps the full-resolution deliverable intact.
  const preview = createCanvas(1680, 1680); preview.getContext('2d').drawImage(canvas, 0, 0, 1680, 1680);
  await save(preview, file.replace(/\.png$/i, '-preview.png'));
}
if (id === 'all') {
  const characters = await readCharacters();
  for (const c of characters) await sheet(c, resolve(output, `${c.id}.png`));
  const group = createCanvas(3840, 2160); drawGroupSheet(group.getContext('2d'), characters); await save(group, resolve(output, 'group.png'));
} else if (id === 'group') {
  const group = createCanvas(3840, 2160); drawGroupSheet(group.getContext('2d'), await readCharacters()); await save(group, output);
} else await sheet(await readCharacter(id), output);
