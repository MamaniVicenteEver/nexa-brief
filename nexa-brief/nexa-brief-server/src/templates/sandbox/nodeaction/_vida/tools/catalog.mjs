import { stageTwoCatalog } from './catalog-stage2.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { EXPRESSIONS, VISEMES, HANDS, HAIR, OUTFITS } from '../engine/index.js';
import { readCharacters } from './validate.mjs';

const characters = await readCharacters(), ids = characters.map(c => c.id);
const number = (min, max, value, summary) => ({ type: 'number', min, max, default: value, summary });
const choice = (values, value) => ({ type: 'string', enum: values, default: value });
const entry = (name, summary, params, file, demo, used_by = ids) => ({ name, summary, params, file, demo, used_by });
const expressionSummary = {
  neutral: 'Reposo atento.', smile: 'Sonrisa suave; mejillas levantan el párpado inferior.', smirk: 'Sonrisa ladeada y cejas asimétricas.',
  grin: 'Sonrisa amplia con dientes y ojos entrecerrados desde abajo.', laugh: 'Carcajada, ojos en arco, lengua y lágrimas.',
  sad: 'Comisuras caídas, cejas internas elevadas, mirada baja y lágrimas.', worry: 'Tensión, cejas oblicuas y gota de sudor.',
  surprise: 'Ojos grandes, cejas altas y boca redonda.', shock: 'Ojos muy abiertos, pupilas pequeñas y mandíbula caída.',
  annoyed: 'Cejas hacia el centro y párpados superiores bajos.', skeptical: 'Un ojo entrecerrado y una ceja levantada.',
  shy: 'Mirada baja, sonrisa pequeña y rubor.', love: 'Pupilas de corazón, mejillas rosadas y sonrisa.', think: 'Mirada arriba y al lado; boca y cejas asimétricas.',
};
const catalog = {
  version: 1,
  characters: characters.map(c => entry(c.id, `${c.name}: ${c.hair.style}, ${c.outfit.style}. Voz ${c.voice}.`, {
    height: number(.7, 1.3, c.height, 'Altura relativa al elenco.'), 'ink.width': number(.006, .025, .012, 'Fracción de altura; tinta exterior y extremidades.'),
    'head.radius': number(.15, .19, c.head.radius, 'Radio en unidades de altura.'), seed: { type: 'integer', min: 0, max: 4294967295, default: c.seed },
    view: choice(['front', '3q-left', '3q-right', 'side-left', 'side-right'], 'front'),
    'face.expression': choice(Object.keys(EXPRESSIONS), c.face.expression),
  }, `characters/${c.id}.json`, `studio.html?sheet=${c.id}`, [c.id])),
  expressions: Object.keys(EXPRESSIONS).map(name => entry(name, expressionSummary[name], {
    intensity: number(0, 1, 1, 'Mezcla desde neutral.'), eyeScale: number(.7, 1.4, 1, 'Multiplicador del tamaño expresivo.'),
    'mix.weight': number(0, 1, 0, 'Mezcla entre dos expresiones; ver VIDA.md.'),
    blink: { type: 'boolean|number|string', default: 'auto', min: 0, max: 1, enum: ['auto', 'off', false, 0, 1] },
    lookAt: { type: 'point|null', default: null, units: 'world pixels' }, closeUp: { type: 'boolean', default: false },
  }, 'engine/face/face.js', `studio.html?character=tomas&expression=${name}&t=0`)),
  visemes: VISEMES.map(name => entry(name, { X: 'Boca cerrada de reposo.', A: 'Vocal abierta con lengua.', E: 'Vocal ancha con dientes.',
    I: 'Vocal estirada de apertura pequeña.', O: 'Vocal redondeada amplia.', U: 'Vocal redondeada estrecha.', MBP: 'Labios en contacto.',
    FV: 'Incisivos sobre el labio inferior.', L: 'Lengua elevada; también r/n/d/t.' }[name], {
    open: number(0, 1, 1, 'Energía de la apertura; cero cierra la boca.'), speechWeight: number(0, 1, 1, 'Peso sobre la boca de expresión.'),
    'viseme.mix': number(0, 1, 0, 'Interpolación smoothstep entre from y to.'),
  }, 'engine/face/mouth.js', `studio.html?character=tomas&viseme=${name}&t=0`)),
  hands: HANDS.map(name => entry(name, { open: 'Mitón relajado con pulgar.', fist: 'Puño cerrado.', point: 'Índice extendido.', thumb: 'Pulgar arriba.',
    hold: 'Pinza curva para un objeto.', wave: 'Palma abierta con dedos separados.', flat: 'Mano plana extendida.', two:'Dos dedos para contar.', three:'Tres dedos para contar.' }[name], {
    'handShapes.right': choice(HANDS, name), 'handAngles.right': { ...number(-Math.PI, Math.PI, null, 'Radianes; null sigue el antebrazo.'), type: 'number|null' },
  }, 'engine/rig/hands.js', `studio.html?character=tomas&pose=wave&hand=${name}&t=0`)),
  hair: HAIR.map(name => entry(name, { spiky: 'Mechones castaños en punta y sombra plana.', ponytail: 'Coleta larga con moño; movimiento secundario.',
    curly: 'Rulos cortos con una sola silueta continua.', buzz: 'Pelo rapado, compatible con gorra.' }[name], {
    color: { type: 'color', default: characters.find(c => c.hair.style === name)?.hair.color ?? '#493024' },
    'secondary.at': number(0, 7200, 0, 'Instante del impulso.'), 'secondary.amplitude': number(-.6, .6, .15, 'Desplazamiento angular inicial.'),
    'secondary.frequency': number(.1, 8, 2.6, 'Frecuencia natural en Hz.'), 'secondary.damping': number(0, 3, .48, 'Amortiguación.'),
  }, 'engine/rig/hair.js', `studio.html?character=${characters.find(c => c.hair.style === name)?.id ?? 'tomas'}&hair=${name}&t=0`,
    characters.filter(c => c.hair.style === name).map(c => c.id))),
  outfits: OUTFITS.map(name => entry(name, { tshirt: 'Camiseta de manga corta.', hoodie: 'Buzo con capucha, abertura, cordones y bolsillo canguro.',
    dress: 'Vestido de manga corta con falda acampanada.', skirt: 'Camiseta con falda.', pants: 'Camiseta y pantalones articulados.', apron: 'Blusa y delantal con bolsillo.' }[name], {
    color: { type: 'color', default: characters.find(c => c.outfit.style === name)?.outfit.color ?? '#cbb6e4' },
    shadow: { type: 'color', default: characters.find(c => c.outfit.style === name)?.outfit.shadow ?? '#ae93c9' },
    'body.width': number(.8, 1.25, 1, 'Ancho relativo; se estrecha al girar.'),
  }, 'engine/rig/draw.js', `studio.html?character=${characters.find(c => c.outfit.style === name)?.id ?? 'tomas'}&outfit=${name}&t=0`,
    characters.filter(c => c.outfit.style === name).map(c => c.id))),
};
// Other stages may add voices/sets/actions to the shared catalog. Preserve their sections.
let existing = {};
try { existing = JSON.parse(await readFile(new URL('../catalog.json', import.meta.url), 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
await writeFile(new URL('../catalog.json', import.meta.url), JSON.stringify({ ...existing, ...catalog, ...await stageTwoCatalog() }, null, 2) + '\n');
console.log(`Catálogo: ${Object.values(catalog).filter(Array.isArray).reduce((n, a) => n + a.length, 0)} entradas.`);
