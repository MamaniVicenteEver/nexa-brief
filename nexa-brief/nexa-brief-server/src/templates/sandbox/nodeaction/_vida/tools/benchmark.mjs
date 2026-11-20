import { performance } from 'node:perf_hooks';
import { cpus } from 'node:os';
import { createCanvas } from '@napi-rs/canvas';
import { writeFile, readFile } from 'node:fs/promises';
import { drawCharacter, posePreset, BODY_POSES, EXPRESSIONS } from '../engine/index.js';
import { readCharacters } from './validate.mjs';

const canvas = createCanvas(1080, 1920), ctx = canvas.getContext('2d'), expressions = Object.keys(EXPRESSIONS);
const records = [];
for (const character of await readCharacters()) {
  const samples = [];
  for (let i = -12; i < 120; i++) {
    const n = i + 12, pose = posePreset(BODY_POSES[n % BODY_POSES.length], { x: 540, y: 1670, scale: 1350, view: Math.sin(n * .05) });
    const face = { expression: expressions[n % expressions.length] };
    const start = performance.now();
    ctx.clearRect(0, 0, 1080, 1920); drawCharacter(ctx, character, pose, face, n / 30);
    ctx.getImageData(0, 0, 1, 1); // Synchronize rasterization; PNG encoding is excluded.
    const elapsed = performance.now() - start;
    if (i >= 0) samples.push(elapsed);
  }
  samples.sort((a, b) => a - b);
  records.push({ character: character.id, frames: samples.length, mean_ms: samples.reduce((a, b) => a + b) / samples.length,
    median_ms: samples[60], p95_ms: samples[114] });
}
const packageInfo = JSON.parse(await readFile(new URL('../node_modules/@napi-rs/canvas/package.json', import.meta.url), 'utf8'));
const result = { node: process.version, canvas: packageInfo.version, cpu: cpus()[0]?.model, size: [1080, 1920],
  method: '12 warmup + 120 frames per character; clear + draw + 1px readback; no PNG encoding', records };
await writeFile(new URL('../review/benchmark.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
