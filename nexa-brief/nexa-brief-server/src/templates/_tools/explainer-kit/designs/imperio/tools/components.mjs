#!/usr/bin/env node
// Catálogo del diseño y contratos: se generan del registro vivo; no requieren leer el motor.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const write = (name, data) => { const p = path.join(root, name); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n'); };
const [command, arg] = process.argv.slice(2);
if (command === 'build') {
  if (!arg) throw Error('build requiere el JSON del registro vivo (Kit.catalog).');
  const input = JSON.parse(fs.readFileSync(arg, 'utf8')), all = Array.isArray(input) ? input : input.comps;
  const design = read('design.json'), overrides = read('input-types.json');
  const selected = design.showcase.components.map(name => {
    const comp = all.find(c => c.name === name);
    if (!comp) throw Error(`Componente no registrado: ${name}`);
    // Algunos ejemplos antiguos incluyen dur, que pertenece al beat y no a params.
    return { ...comp, example: Object.fromEntries(Object.entries(comp.example || {}).filter(([key]) => key in comp.params)) };
  });
  const time = { anyOf: [{ type: 'number' }, { type: 'string', pattern: '^@.+' }] };
  const baseType = (key, spec) => {
    let schema = spec.type === 'bool' ? { type: 'boolean' } : spec.type === 'number' ? { type: 'number' } : spec.type === 'array' ? { type: 'array' } : spec.type === 'object' ? { type: 'object' } : { type: 'string' };
    if (spec.options) schema = { enum: spec.options };
    if (spec.type === 'number') {
      if (spec.min != null) schema.minimum = spec.min;
      if (spec.max != null) schema.maximum = spec.max;
      if (/(At$|^at$|^time$)/.test(key)) schema = { anyOf: [schema, time.anyOf[1]] };
    }
    if (spec.default === null) schema = { anyOf: [schema, { type: 'null' }] };
    return schema;
  };
  for (const comp of selected) {
    const properties = {};
    for (const [key, spec] of Object.entries(comp.params)) {
      const patch = overrides.components?.[comp.name]?.[key] || overrides.params[key];
      properties[key] = { ...(patch || baseType(key, spec)), description: spec.doc || '', ...(spec.default !== undefined ? { default: spec.default } : {}) };
    }
    // Cada contrato lleva solo las definiciones que usa, para mantener corta la lectura del agente.
    const needed = new Set();
    const scan = value => {
      if (Array.isArray(value)) value.forEach(scan);
      else if (value && typeof value === 'object') {
        if (typeof value.$ref === 'string' && value.$ref.startsWith('#/$defs/')) {
          const key = value.$ref.slice(8);
          if (!needed.has(key)) { needed.add(key); scan(overrides.$defs[key]); }
        }
        Object.values(value).forEach(scan);
      }
    };
    scan(properties);
    const schema = {
      $schema: 'https://json-schema.org/draft/2020-12/schema', title: comp.name,
      description: comp.summary, type: 'object', additionalProperties: false,
      properties, required: Object.entries(comp.params).filter(([,s]) => s.required).map(([k]) => k),
      $defs: Object.fromEntries([...needed].map(k=>[k,overrides.$defs[k]])), examples: comp.example ? [comp.example] : [],
      'x-layer': comp.layer, 'x-units': { coordinates: 'WGS84 [longitud, latitud], grados', timing: 'segundos relativos al beat o @ancla exacta de la narración', screenPosition: 'x/y normalizados 0..1 solo en texto de pantalla' },
    };
    write(`contracts/${comp.name}.json`, schema);
  }
  const catalog = {
    version: 1, design: design.id, source: 'Kit.catalog() → tools/components.mjs build',
    referenceVideo: design.showcase.referenceVideo,
    production: { renderer: 'imperio', usesMap: true, coordinateSystem: 'WGS84 longitude-latitude', note: 'El showcase omite solo el mapa base. Los JSON de producción mantienen coordenadas, cámara y capas sobre el mapa.' },
    workflow: ['Buscar un componente por nombre y descripción.', 'Leer únicamente su contracts/<nombre>.json.', 'Copiar el ejemplo y cambiar textos, medios, destinos y tiempos.', 'Usar imperio.campaign para combinar varias capas en la misma cámara.', 'Validar el episodio con kit.py check antes de producir.'],
    recipes: 'recipes.json',
    components: selected.map(c => ({ name: c.name, summary: c.summary.split('. ')[0], layer: c.layer, inputs: `contracts/${c.name}.json`, example: { use: c.name, params: c.example || {} } })),
  };
  write('catalog.json', catalog);
  fs.writeFileSync(path.join(root, 'QUICK.md'), [
    '# imperio · NODEPOLITICS — hoja rápida', '',
    '> GENERADO por `tools/components.mjs build` desde el registro vivo. No editar a mano.',
    'Leer primero [catalog.json](catalog.json): índice corto. Después solo el contrato JSON del componente elegido en contracts/. No hace falta leer el motor ni copiar componentes de otro video.', '',
    'Ejemplos de composición: [recipes.json](recipes.json). Flujo y origen de las piezas: [REUSE.md](REUSE.md).', '',
    'En producción se conserva el mapa y se usan coordenadas WGS84 [longitud,latitud]. El showcase omite el mapa base para cargar rápido. Los tiempos se expresan en segundos locales o @palabra de la voz.', '',
    ...catalog.components.map(c => `- **${c.name}**: ${c.summary}. [Entradas JSON](${c.inputs}).`), '',
    'Antes de crear otro componente, consultar este índice. Cambiar datos, medios, destinos y tiempos; reutilizar imperio.campaign para varias capas con la misma cámara. date y caption son overlays; las piezas geográficas son planos con mapa.', '',
    'Validación de un episodio: kit.py check <id> y revisión de ambas orientaciones. Consultar guides/imperio-production.md para medios y sonido. El cierre se elige con config.outro.use; no duplicarlo en el storyboard.', '',
  ].join('\n'));
  console.log(`Generados ${selected.length} contratos y catalog.json desde el registro.`);
} else {
  const catalog = read('catalog.json');
  if (command === 'list') console.log(catalog.components.map(c => `${c.name}\t${c.summary}`).join('\n'));
  else {
    const comp = catalog.components.find(c => c.name === arg);
    if (!comp) throw Error('Uso: components.mjs list | describe <nombre> | example <nombre> | build <registro.json>');
    if (command === 'describe') console.log(JSON.stringify(read(comp.inputs), null, 2));
    else if (command === 'example') console.log(JSON.stringify({ t: 0, dur: 8, ...comp.example }, null, 2));
    else throw Error(`Comando desconocido: ${command}`);
  }
}
