#!/usr/bin/env node
// Genera COMPONENTES.md: catálogo de TODAS las animaciones para el orquestador (título, descripción,
// estados, parámetros con tipo/valor/rango y un ejemplo pegable). Así no hay que abrir código ni 109 JSON.
// Uso (desde la raíz de la plantilla): node tools/componentes-md.mjs
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(new URL('..', import.meta.url).pathname);
const dir = path.join(root, 'engine/tactico/animations');
const idx = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8')).animations;
const fam = {};
for (const a of idx) (fam[a.family] ??= []).push(a);
const short = (s, n = 110) => String(s ?? '').replace(/\s+/g, ' ').slice(0, n);
const rng = p => p.values ? `{${p.values.join('|')}}` : (p.min != null || p.max != null) ? `[${p.min ?? ''}..${p.max ?? ''}]` : '';
const dv = v => v == null ? '' : '=' + (typeof v === 'object' ? JSON.stringify(v).slice(0, 40) : v);
const out = [`# COMPONENTES · catálogo completo para el orquestador

> Generado por \`node tools/componentes-md.mjs\` desde \`engine/tactico/animations/*.json\` (${idx.length} piezas). No lo edites a mano.
> Cada ficha: **título · descripción · estados · parámetros** (\`nombre:tipo=defecto[rango]\`) y un **ejemplo** listo para pegar
> en \`scene.json → items\` (o, en el plan de un segmento, como \`componentes\`/\`medios\` cambiando \`type\` por \`tipo\`).
> Todos admiten \`id, t, dur, out, fade, sfx\`. Posiciones \`at\`/\`from\`/\`to\`/\`via\` son [lon,lat] o un nombre de \`places\`.
> Familias: ${Object.entries(fam).map(([k, v]) => `${k} (${v.length})`).join(' · ')}.
`];
for (const [f, list] of Object.entries(fam)) {
  out.push(`\n## Familia ${f}\n`);
  for (const a of list) {
    const j = JSON.parse(fs.readFileSync(path.join(dir, a.file), 'utf8'));
    const params = Object.entries(j.params || {}).map(([k, p]) => `${k}:${p.type || '?'}${dv(p.default)}${rng(p)}`).join(', ');
    let ex = JSON.stringify(j.example || {});
    if (ex.length > 520) ex = ex.slice(0, 520) + '…}';
    out.push(`### \`${a.name}\`
${short(j.description, 260)}
- duración típica ${j.duration ?? '?'} s${j.loop ? ' (en bucle)' : ''}${(j.states || []).length ? ' · estados: ' + j.states.join('/') : ''}${(j.sfx || []).length ? ' · sfx: ' + j.sfx.join(',') : ''}${(j.dependsOn || []).length ? ' · depende de: ' + j.dependsOn.join(', ') : ''}
- parámetros: ${params || '(ninguno propio)'}
- ejemplo: \`${ex}\`
`);
  }
}
fs.writeFileSync(path.join(root, 'COMPONENTES.md'), out.join('\n'));
console.log(`COMPONENTES.md · ${idx.length} piezas · ${(out.join('\n').length / 1024).toFixed(0)} KB`);
