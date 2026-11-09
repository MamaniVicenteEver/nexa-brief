#!/usr/bin/env node
// Auditoría de COBERTURA de una escena de Atlas en Movimiento (bloqueante antes de decir "listo").
// Uso: node tools/cobertura-audit.mjs <carpeta-del-episodio> [--ligero]
// Falla (exit 1) si la escena es solo texto sobre un mapa. estilo-audit.mjs mide choques; esto mide riqueza.
import fs from 'node:fs';
const dir = (process.argv[2] || '.').replace(/\/$/, '');
const ligero = process.argv.includes('--ligero');
const scene = JSON.parse(fs.readFileSync(dir + '/assets/scene.json', 'utf8'));
let script = null; try { script = JSON.parse(fs.readFileSync(dir + '/assets/script.json', 'utf8')); } catch {}
const items = scene.items || [], total = scene.duration || scene.end || 0;

const MEDIA = /^(document|image|portrait|callout\.photo|editorial)\./;
const MOVE = /^(army|air|ground|naval|unit|strike|fx|arrow|route|trail|money)\.|^territory\.control$|^front\.line$|^range\.ring$/;
const STATIC = /^(territory\.(fill|glow|hatch|extrude|flag|state)|site\.|flag\.marker|badge\.count|icon\.badge|label\.(unit|neon|figure|landunit|site))/;
const TEXT = /^(header|statement|year|text|legend|intro|outro|caption|label\.(country|callout|chip|route|front))/;
const famOf = t => MEDIA.test(t) ? 'imagen_documento' : MOVE.test(t) ? 'movimiento' : STATIC.test(t) ? 'mapa_marca' : TEXT.test(t) ? 'texto' : 'otro';

const types = [...new Set(items.map(i => i.type))];
const fam = {}; for (const i of items) (fam[famOf(i.type)] ??= []).push(i);
const minutes = total / 60, errs = [], info = [];

const minTypes = ligero ? 8 : 12;
if (types.length < minTypes) errs.push(`solo ${types.length} tipos de componente (mínimo ${minTypes}): ${types.join(', ')}`);

for (const need of ['movimiento', 'mapa_marca'].concat(ligero ? [] : ['imagen_documento']))
  if (!(fam[need] || []).length) errs.push(`ninguna pieza de la familia "${need}"`);

const media = (fam.imagen_documento || []).length, needMedia = ligero ? 0 : Math.floor(total / 45);
if (media < needMedia) errs.push(`imágenes/documentos: ${media} (mínimo ${needMedia} = 1 cada 45 s)`);

// ningún tramo de 20 s sin imagen o movimiento
const active = items.filter(i => famOf(i.type) === 'imagen_documento' || famOf(i.type) === 'movimiento').map(i => [i.t, i.out ?? i.t + i.dur]);
const gaps = []; let cur = 0;
for (const [a, b] of active.sort((x, y) => x[0] - y[0])) { if (a - cur > 20) gaps.push([cur, a]); cur = Math.max(cur, b); }
if (total - cur > 20) gaps.push([cur, total]);
for (const [a, b] of gaps) errs.push(`tramo sin imagen ni movimiento: ${a.toFixed(0)}–${b.toFixed(0)} s (${(b - a).toFixed(0)} s)`);

// el plan del guion debe estar cumplido
if (script) {
  const sceneTypes = new Set(items.map(i => i.type)), faltan = [];
  for (const s of script.segments || []) for (const c of [...(s.plan?.componentes || []), ...(s.plan?.medios || [])])
    if (!items.some(i => i.type === c.tipo && i.segment === s.id)) faltan.push(`${s.id}:${c.tipo}`);
  if (faltan.length) errs.push(`el plan pide piezas que la escena no tiene: ${faltan.slice(0, 12).join(', ')}${faltan.length > 12 ? '…' : ''}`);
  const sinPlan = (script.segments || []).filter(s => !s.plan).map(s => s.id);
  if (sinPlan.length) errs.push(`segmentos sin plan visual: ${sinPlan.join(', ')}`);
}
// medios: archivos que existen
for (const i of fam.imagen_documento || []) {
  if (!i.src) errs.push(`${i.id}: sin src`);
  else if (!fs.existsSync(`${dir}/${i.src}`)) errs.push(`${i.id}: no existe ${i.src}`);
  else if (!i.credit && !i.source) errs.push(`${i.id}: sin crédito ni fuente`);
}
info.push(`duración ${total.toFixed(0)} s · ${items.length} ítems · ${types.length} tipos`);
info.push('familias: ' + Object.entries(fam).map(([k, v]) => `${k}=${v.length}`).join(' · '));
info.push(`imágenes/documentos: ${media} · tramos largos sin imagen/movimiento: ${gaps.length}`);
console.log(info.join('\n'));
if (errs.length) { console.log('\nCOBERTURA INSUFICIENTE:\n- ' + errs.join('\n- ')); process.exit(1); }
console.log('\nCOBERTURA OK');
