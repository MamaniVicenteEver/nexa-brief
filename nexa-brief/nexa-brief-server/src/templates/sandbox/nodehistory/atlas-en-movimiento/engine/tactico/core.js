import {clamp, ease, mercator, unmercator, pathAt, pathDuration, rng, wrap} from './util.js';
import {createSprites} from './sprites.js';
import {readJSON, atlasGeoURL} from './tools/io.js';
import {landIndex, seaCrossings} from './tools/geometry.js';

const slot = Symbol.for('nexa.tactico.registry.v1');
const registry = globalThis[slot] ||= new Map();
export const Tactico = Object.freeze({
  component(name, def) {
    if (!/^[a-z][\w-]*\.[\w.-]+$/.test(name) || typeof def?.draw !== 'function') throw new TypeError('Componente: nombre familia.tipo y draw obligatorios');
    if (registry.has(name) && registry.get(name) !== def) throw new Error(`Componente ya registrado: ${name}`);
    const file = def.file || new Error().stack?.match(/\/(components\/[\w.-]+\.js)(?=[:)])/ )?.[1];
    registry.set(name, Object.freeze({...def, name, file, layer: def.layer ?? 50, params: def.params || {}, states: def.states || ['normal']}));
    return registry.get(name);
  },
  get: name => registry.get(name),
  list: () => [...registry.values()],
});
if (typeof window !== 'undefined') window.Tactico = Tactico;
let componentsReady;
export async function loadComponents() {
  return componentsReady ||= (async () => {
    await import('./components/_base.js');
    const catalog = await readJSON(new URL('./components.json', import.meta.url));
    const files = [...new Set((catalog.components || catalog).map(c => c.file).filter(Boolean))];
    for (const file of files) {
      if (!/^components\/[\w.-]+\.js$/.test(file)) throw new Error(`Ruta de componente inválida: ${file}`);
      await import(new URL(file, import.meta.url));
    }
    return Tactico;
  })();
}
const defaultT = (v, fallback = 0) => v == null ? fallback : typeof v === 'number' ? v : /^[-+]?\d+(\.\d+)?$/.test(String(v).trim()) ? Number(v) : fallback;
const clone = value => structuredClone(value);
const temporal = new Set(['t', 'out', 'end', 'dur', 'duration', 'fade', 'fade_in', 'fade_out']);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function withDefaults(raw) {
  const item = {...raw};
  for (const [key, schema] of Object.entries(Tactico.get(item.type)?.params || {})) {
    if (item[key] == null && schema.default !== undefined) item[key] = clone(schema.default);
  }
  return item;
}
export function resolveScene(scene, {T = defaultT, errors = []} = {}) {
  function visit(value, path = '') {
    if (Array.isArray(value)) return value.map((v, i) => visit(v, `${path}[${i}]`));
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).map(([key, v]) => {
      const p = path ? `${path}.${key}` : key;
      if ((temporal.has(key) || key === 'at' && /(?:(?:states|actions|cues|sfx)\[\d+\]|\.sfx)$/.test(path)) && v != null) {
        const n = T(v, NaN);
        if (!Number.isFinite(n)) errors.push({code: String(v).startsWith('@') ? 'anchor' : 'time', path: p, message: `Tiempo sin resolver: ${v}`});
        return [key, n];
      }
      return [key, visit(v, p)];
    }));
  }
  return visit(scene);
}
const coord = p => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90;
const maritime = item => item?.domain === 'sea' || typeof item?.type === 'string' && (item.type.startsWith('naval.') || item.type === 'route.sea');
function locator(scene, extraPlace) {
  const items = new Map((scene.items || []).map(i => [i.id, i]));
  const paths = new WeakMap();
  function resolve(ref, t = 0, stack = []) {
    if (Array.isArray(ref)) return coord(ref) ? ref.slice(0, 2) : null;
    const item = items.get(ref);
    if (item) {
      if (stack.includes(ref)) throw new Error(`Referencia circular: ${[...stack, ref].join(' → ')}`);
      const p = position(item, t, [...stack, ref]); return p ? [p.lon, p.lat] : null;
    }
    const own = scene.places?.[ref] || scene.regions?.[ref];
    const p = Array.isArray(own) ? own : own?.coordinates || own?.center || own?.label;
    return p ? (coord(p) ? p.slice(0, 2) : null) : extraPlace?.(ref) || null;
  }
  function path(item, stack = []) {
    if (!item.path) return null;
    if (paths.has(item)) return paths.get(item);
    const value = {...item.path, t: item.path.t ?? item.t ?? 0, via: item.path.via.map(v => resolve(v, item.path.t ?? item.t ?? 0, stack))};
    if (value.via.some(p => !p)) throw new Error(`Waypoint desconocido en ${item.id}`);
    paths.set(item, value); return value;
  }
  function position(item, t, stack = [item.id]) {
    const route = path(item, stack);
    if (route) return pathAt(route, t);
    const at = item.at == null ? null : resolve(item.at, t, stack);
    return at ? {lon: at[0], lat: at[1], heading: 0, u: 0} : null;
  }
  return {resolve, position, path};
}
function numericTime(v, T, fallback) {
  const n = T(v, fallback); if (!Number.isFinite(n)) throw new Error(`Tiempo sin resolver: ${v}`); return n;
}

/** Expande in situ solo camera. La entrada puede ser JSON y no necesita DOM. */
export function expandScene(scene, {T = defaultT, width = 1080, height = 608} = {}) {
  const errors = [], resolved = resolveScene(scene, {T, errors});
  if (errors.length) throw new Error(errors.map(e => `${e.path}: ${e.message}`).join('\n'));
  const loc = locator(resolved), result = [], generated = new WeakSet();
  let previous = {t: 0, center: [0, 20], zoom: 3, bearing: 0};
  const point = (ref, t) => { const p = loc.resolve(ref, t); if (!p) throw new Error(`Cámara: lugar o item desconocido: ${ref}`); return p; };
  for (const raw of [...(resolved.camera || [])].sort((a, b) => (a.t ?? 0) - (b.t ?? 0))) {
    // Una orden nueva cancela las muestras futuras del follow anterior.
    while (result.length && generated.has(result.at(-1)) && result.at(-1).t >= (raw.t ?? 0)) result.pop();
    if (result.length) previous = {...previous, ...result.at(-1)};
    const k = {...raw, t: numericTime(raw.t, T, 0)};
    if (k.follow) {
      const unit = resolved.items?.find(i => i.id === k.follow);
      if (!unit) throw new Error(`Cámara follow: item desconocido: ${k.follow}`);
      const duration = k.dur ?? (unit.path ? pathDuration(loc.path(unit)) : 3);
      if (!(duration > 0)) throw new Error('Cámara follow: dur debe ser positiva');
      const count = Math.ceil(duration / .25), dt = duration / count;
      const target = time => {
        const samples = [-.15, -.075, 0, .075, .15].map(offset => mercator(...point(k.follow, time + .08 + offset)));
        const center = samples[2][0];
        return unmercator(samples.reduce((s, p) => s + center + wrap((p[0] - center) * 360) / 360, 0) / samples.length, samples.reduce((s, p) => s + p[1], 0) / samples.length);
      };
      if (!result.length) result.push({t:k.t, center:target(k.t), zoom:k.zoom ?? previous.zoom, bearing:k.bearing ?? previous.bearing});
      for (let i = 0; i < count; i++) {
        const arrival = k.t + (i + 1) * dt, center = target(arrival);
        const a = mercator(...target(arrival - .01)), b = mercator(...target(arrival + .01));
        const drift = i === count - 1 ? {x: 0, y: 0} : {x: wrap((b[0] - a[0]) * 360) / .02, y: -(b[1] - a[1]) * 360 / .02};
        const {follow, ...plain} = k;
        const key = {...plain, t: k.t + i * dt, dur: dt, center, zoom: k.zoom ?? previous.zoom, bearing: k.bearing ?? previous.bearing, arc: 0, ease: 'inOut', drift: {...drift, z: 0, p: 0, b: 0}, settle: .2};
        generated.add(key); result.push(key);
      }
      continue;
    }
    if (k.zoomThrough) {
      const {to, zoom, spin = 0} = k.zoomThrough; delete k.zoomThrough;
      k.center = point(to, k.t + (k.dur ?? 2.5)); k.zoom = zoom ?? k.zoom ?? previous.zoom + 2;
      k.bearing = (previous.bearing ?? 0) + spin; k.dur ??= 2.5; k.arc = 0; k.ease ??= 'out';
    }
    if (k.reframe) {
      if (!Array.isArray(k.reframe) || !k.reframe.length) throw new Error('reframe necesita un conjunto no vacío');
      const points = k.reframe.map(ref => mercator(...point(ref, k.t + (k.dur ?? 0))));
      for (const p of points) p[0] = points[0][0] + wrap((p[0] - points[0][0]) * 360) / 360;
      const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
      const dx = Math.max(...xs) - Math.min(...xs), dy = Math.max(...ys) - Math.min(...ys);
      k.center = unmercator((Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2);
      k.center[0] = wrap(k.center[0]);
      const bearing = (k.bearing ?? previous.bearing ?? 0) * Math.PI / 180, c = Math.abs(Math.cos(bearing)), s = Math.abs(Math.sin(bearing));
      k.span = Math.max(.25, (c * dx + s * dy) * 360, (s * dx + c * dy) * 360 * width / height) * (1 + 2 * (k.pad ?? .2));
      delete k.reframe; delete k.zoom;
    }
    if (k.focus && resolved.items?.some(i => i.id === k.focus)) { k.center = point(k.focus, k.t + (k.dur ?? 0)); delete k.focus; if (k.span == null) k.zoom ??= previous.zoom; }
    else if (k.focus && loc.resolve(k.focus)) { k.center = point(k.focus, k.t); delete k.focus; }
    // Las keys ordinarias de Atlas (focus a región, span, drift) conservan su contrato.
    result.push(k); previous = {...previous, ...k, zoom:k.zoom ?? (k.span != null ? Math.log2(width * 360 / (512 * k.span)) : previous.zoom)};
  }
  scene.camera = result;
  return scene;
}

export function validateScene(input, {T = defaultT, land, sprites, place, context = {}} = {}) {
  const errors = [], warnings = [], scene = resolveScene(input, {T, errors});
  const add = (code, path, message, extra = {}) => errors.push({code, path, message, ...extra});
  if (!object(scene)) {
    add('scene', '', 'La escena debe ser un objeto JSON');
    return {errors, warnings, scene};
  }
  if (land?.features) land = landIndex(land);
  for (const key of ['duration', 'end']) if (scene[key] != null && (!Number.isFinite(scene[key]) || scene[key] < 0)) add('time', key, `${key} debe ser finito y no negativo`);
  if (!Array.isArray(scene.items)) add('items', 'items', 'items debe ser un array');
  if (Array.isArray(scene.items)) scene.items = scene.items.map(raw => object(raw) ? withDefaults(raw) : raw);
  const loc = locator({...scene, items: Array.isArray(scene.items) ? scene.items.filter(object) : []}, place), ids = new Set();
  const validationContext = {...context, scene, T, land, place:loc.resolve};
  function cueErrors(cue, path, item) {
    if (!object(cue)) { add('sfx', path, 'Cue debe ser un objeto', {item}); return; }
    if (typeof cue.sfx !== 'string' || !cue.sfx.trim()) add('sfx', `${path}.sfx`, 'sfx no vacío obligatorio', {item});
    for (const key of ['at','dur','fade_in','fade_out']) if (cue[key] != null && (!Number.isFinite(cue[key]) || cue[key] < 0)) add('sfx-time', `${path}.${key}`, `${key} debe ser finito y no negativo`, {item});
    if (cue.gain_db != null && !Number.isFinite(cue.gain_db)) add('sfx-gain', `${path}.gain_db`, 'gain_db debe ser finito', {item});
  }
  if (scene.sound != null && !object(scene.sound)) add('sound', 'sound', 'sound debe ser un objeto');
  if (scene.sound?.cues != null && !Array.isArray(scene.sound.cues)) add('sound', 'sound.cues', 'cues debe ser un array');
  else for (const [j,cue] of (scene.sound?.cues || []).entries()) cueErrors(cue, `sound.cues[${j}]`);
  for (const [index, item] of (Array.isArray(scene.items) ? scene.items : []).entries()) {
    const p = `items[${index}]`, id = item?.id, def = Tactico.get(item?.type);
    if (!object(item)) { add('item', p, 'Item inválido'); continue; }
    if (typeof id !== 'string' || !id.trim()) add('id', `${p}.id`, 'id no vacío obligatorio');
    else if (ids.has(id)) add('duplicate-id', `${p}.id`, `id duplicado: ${id}`, {item: id});
    ids.add(id);
    if (!def) add('component', `${p}.type`, `Tipo desconocido: ${item.type}`, {item: id});
    for (const key of ['t', 'dur', 'out', 'fade', 'z', 'layer']) if (item[key] != null && (!Number.isFinite(item[key]) || key !== 'z' && key !== 'layer' && item[key] < 0)) add('number', `${p}.${key}`, `${key} debe ser finito${key === 'z' || key === 'layer' ? '' : ' y no negativo'}`, {item: id});
    if (item.out != null && item.out < (item.t ?? 0)) add('lifetime', `${p}.out`, 'out precede al inicio', {item: id});
    if (item.heading != null && item.heading !== 'auto' && !Number.isFinite(item.heading)) add('heading', `${p}.heading`, 'heading debe ser número o auto');
    try {
      if (item.at != null && !loc.resolve(item.at, item.t ?? 0, [id])) add('place', `${p}.at`, `Lugar desconocido: ${item.at}`, {item: id});
      if (item.path) {
        if (!object(item.path) || !Array.isArray(item.path.via) || item.path.via.length < 2) add('path', `${p}.path.via`, 'La ruta necesita dos o más waypoints', {item: id});
        else {
          const path = loc.path(item);
          if (!Number.isFinite(path.t) || path.t < 0) add('path-time', `${p}.path.t`, 't de ruta inválido');
          if (path.dur == null && !(path.speed > 0)) add('path-duration', `${p}.path`, 'La ruta necesita dur o speed (km Mercator/s)', {item: id});
          if (path.dur != null && (!Number.isFinite(path.dur) || path.dur < 0)) add('path-duration', `${p}.path.dur`, 'dur de ruta inválida');
          if (path.speed != null && (!Number.isFinite(path.speed) || path.speed <= 0)) add('path-speed', `${p}.path.speed`, 'speed debe ser positivo y finito');
          if (path.bend != null && !Number.isFinite(path.bend)) add('path-bend', `${p}.path.bend`, 'bend debe ser finito');
          if (path.curve && !['line','arc','smooth'].includes(path.curve)) add('path-curve', `${p}.path.curve`, 'curve desconocida');
          if (path.ease && !['in','out','inOut','linear','spring'].includes(path.ease)) add('ease', `${p}.path.ease`, 'ease desconocido');
          if (land && maritime(item)) for (const crossing of seaCrossings(path, land)) add('sea-land', `${p}.path.via`, `Segmento ${crossing.segment} cruza tierra: ${crossing.place}`, {item: id, ...crossing});
        }
      }
    } catch (e) { add('position', `${p}.at/path`, e.message, {item: id}); }
    if (item.state != null && def?.states.length && !def.states.includes(item.state)) add('state', `${p}.state`, `Estado inicial desconocido: ${item.state}`, {item:id});
    if (item.states != null && !Array.isArray(item.states)) add('states', `${p}.states`, 'states debe ser un array', {item:id});
    for (const [j, change] of (Array.isArray(item.states) ? item.states : []).entries()) {
      if (!object(change)) { add('state', `${p}.states[${j}]`, 'Cambio de estado inválido'); continue; }
      if (def?.states.length && !def.states.includes(change.state)) add('state', `${p}.states[${j}].state`, `Estado desconocido: ${change.state}`, {item: id});
      if (!Number.isFinite(change.at) || change.at < 0 || change.dur != null && (!Number.isFinite(change.dur) || change.dur < 0)) add('state-time', `${p}.states[${j}]`, 'Tiempo de estado inválido');
      if (change.ease && !['in','out','inOut','linear','spring'].includes(change.ease)) add('ease', `${p}.states[${j}].ease`, 'ease desconocido');
    }
    if (item.actions != null && !Array.isArray(item.actions)) add('actions', `${p}.actions`, 'actions debe ser un array', {item:id});
    for (const [j,action] of (Array.isArray(item.actions) ? item.actions : []).entries()) {
      if (!object(action)) { add('action', `${p}.actions[${j}]`, 'Acción inválida'); continue; }
      if (!Tactico.get(action.type)) add('action', `${p}.actions[${j}].type`, `Tipo de acción desconocido: ${action.type}`);
      if (!Number.isFinite(action.at) || action.at < 0 || action.dur != null && (!Number.isFinite(action.dur) || action.dur < 0)) add('action-time', `${p}.actions[${j}]`, 'Tiempo de acción inválido');
    }
    for (const [key, schema] of Object.entries(def?.params || {})) {
      const v = item[key] ?? schema.default;
      if (v == null) { if (schema.required) add('param', `${p}.${key}`, 'Parámetro obligatorio'); continue; }
      let valid;
      try {
        const type = schema.type;
        valid = type === 'enum' ? schema.values?.includes(v) : type === 'place' ? !!loc.resolve(v, item.t ?? 0, [id]) : type === 'number|auto' ? Number.isFinite(v) || v === 'auto' : type === 'array' ? Array.isArray(v) : type === 'number' ? Number.isFinite(v) : type === 'object' ? object(v) : ['string','boolean'].includes(type) ? typeof v === type : true;
      } catch { valid = false; }
      if (!valid || typeof v === 'number' && (schema.min != null && v < schema.min || schema.max != null && v > schema.max)) add('param', `${p}.${key}`, `Valor inválido para ${key}`, {item: id});
    }
    if (item.sprite && sprites && !sprites.has(item.sprite)) warnings.push({code: 'sprite', item: id, path: `${p}.sprite`, message: `Sprite faltante: ${item.sprite}; se usará silueta`});
    if (item.sfx != null && item.sfx !== false) for (const [j,cue] of (Array.isArray(item.sfx) ? item.sfx : [item.sfx]).entries()) cueErrors(typeof cue === 'string' ? {sfx:cue} : cue, `${p}.sfx[${j}]`, id);
    if (def?.validate) {
      try { for (const msg of def.validate(item, validationContext) || []) (msg?.severity === 'warning' ? warnings : errors).push(typeof msg === 'string' ? {code: 'component-validation', path: p, item: id, message: msg} : {path: p, item: id, ...msg}); }
      catch (e) { add('component-validation', p, e.message, {item: id}); }
    }
  }
  try { expandScene(clone(scene), {T: defaultT}); } catch (e) { add('camera', 'camera', e.message); }
  return {errors, warnings, scene};
}

function frozen(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); for (const v of Object.values(value)) frozen(v); }
  return value;
}
function stateAt(record, t) {
  const base = record.item.state ?? record.def.states[0] ?? 'normal';
  let weights = {[base]: 1}, state = base, fromState = base, stateT = 1, current;
  // Cada interrupción arranca desde la mezcla que había entonces, nunca del cuadro previo.
  for (const change of record.changes) {
    if (t < change.at) break;
    if (current) {
      const u = current.dur === 0 ? 1 : clamp((change.at - current.at) / current.dur), e = clamp(ease(current.ease || 'inOut', u));
      weights = Object.fromEntries(Object.entries(current.from).map(([k, v]) => [k, v * (1 - e)]));
      weights[current.state] = (weights[current.state] || 0) + e;
    }
    fromState = state; state = change.state; current = {...change, from: weights};
  }
  if (current) {
    stateT = current.dur === 0 ? 1 : clamp(ease(current.ease || 'inOut', clamp((t - current.at) / current.dur)));
    weights = Object.fromEntries(Object.entries(current.from).map(([k, v]) => [k, v * (1 - stateT)]));
    weights[current.state] = (weights[current.state] || 0) + stateT;
  }
  return {state, fromState, stateT, stateWeights: weights};
}
function snapshot(record, t, loc) {
  const {item, start, out, end, fade, dur} = record;
  if (t < start || t >= end) return null;
  const alpha = (fade ? clamp((t - start) / fade) : 1) * (fade ? clamp(1 - (t - out) / fade) : +(t < out));
  if (alpha <= 0) return null;
  const pos = loc.position(item, t);
  return {item, t, lt: t - start, u: dur > 0 && Number.isFinite(dur) ? clamp((t - start) / dur) : 1, alpha, pos,
    heading: typeof item.heading === 'number' ? item.heading : pos?.heading || 0, ...stateAt(record, t), internal: record.internal};
}
function soundEvents(record, ctx) {
  const {item, def, start, dur} = record;
  if (item.sfx === false) return [];
  const own = item.sfx == null ? def.sfx?.(item, ctx) || [] : Array.isArray(item.sfx) ? item.sfx : [item.sfx];
  return own.map(cue => {
    const e = typeof cue === 'string' ? {sfx: cue} : {...cue};
    for (const key of ['fade_in','fade_out']) if (e[key] != null) e[key] = numericTime(e[key], ctx.T, 0);
    return {...e, at: numericTime(e.at, ctx.T, start), dur: numericTime(e.dur, ctx.T, Number.isFinite(dur) ? dur : Number.isFinite(record.out) ? record.out - start : 0), item: item.id};
  });
}

const TEXT_STYLE_TYPES = new Set(['badge.count','icon.badge','intro.title','label.callout','label.chip','label.figure','label.front','label.neon','label.route','label.site','label.unit','text.year']);
const TEXT_STYLE = Object.freeze({background:'#20252b',dark:'#20252b',ink:'#20252b',paper:'#e6e6e6',text:'#e6e6e6',accent:'#f4f4f4',neon:'#f4f4f4',success:'#f4f4f4',danger:'#e6e6e6',cyan:'#f4f4f4',textOutline:'#000000'});

export async function create(c, input) {
  if (!object(input)) throw new TypeError('Tactico: la escena debe ser un objeto JSON');
  await loadComponents();
  const T = c.T || defaultT;
  const manifest = typeof input.spriteManifest === 'string' ? new URL(input.spriteManifest, c.base || (typeof location !== 'undefined' ? location.href : import.meta.url)) : input.spriteManifest;
  const spriteStore = createSprites({manifest, palette: input.defs?.palette || c.look?.palette});
  let land = c.land;
  if (!land && Array.isArray(input.items) && input.items.some(maritime)) land = landIndex(await readJSON(atlasGeoURL));
  else if (land?.features) land = landIndex(land);
  const ctx = {...c, T, land, sprites: spriteStore, loadSprites: () => spriteStore.load(), palette: input.defs?.palette || c.look?.palette || {}};
  const check = validateScene(input, {T, land, context: ctx, place: ref => c.geo?.place(ref)});
  if (check.errors.length) { const error = new Error(`Tactico: ${check.errors.length} errores\n${check.errors.map(e => `${e.path}: ${e.message}`).join('\n')}`); error.diagnostics = check; throw error; }
  const scene = check.scene, loc = locator(scene, ref => c.geo?.place(ref)); ctx.scene = scene; ctx.place = loc.resolve;
  const palette = Object.freeze({ink: c.look?.borders?.color || '#eee8d0', accent: c.look?.highlight?.fill || '#74bb89', background: c.look?.background || '#081e2c', ...c.look?.palette, ...scene.defs?.palette});
  ctx.palette = palette;
  const records = [];
  for (const [index, raw] of scene.items.entries()) {
    const def = Tactico.get(raw.type), item = withDefaults(raw);
    if (item.path) item.path = loc.path(item);
    const start = item.t ?? 0, fade = item.fade ?? .35, dur = item.dur ?? Infinity;
    const out = item.out ?? (Number.isFinite(dur) ? start + dur : Math.max(start, (scene.duration ?? scene.end ?? Infinity) - fade));
    const record = {item: frozen(item), def, index, start, fade, dur, out, end: out + fade,
      changes: (item.states || []).map(s => ({...s, dur: s.dur ?? .35})).sort((a, b) => a.at - b.at),
      prefix: `${index}:${item.id}:${item.type}`, internal: null};
    record.internal = await def.prepare?.(record.item, ctx) ?? null;
    // No se congela un Image/Canvas del navegador; solo datos JSON del item.
    records.push(record);
  }
  records.sort((a, b) => (a.item.layer ?? a.def.layer) - (b.item.layer ?? b.def.layer) || (a.item.z ?? 0) - (b.item.z ?? 0) || a.index - b.index);
  const events = records.flatMap(r => soundEvents(r, ctx));
  for (const cue of scene.sound?.cues || []) events.push({...cue, at: numericTime(cue.at, T, 0), dur: numericTime(cue.dur, T, 0)});
  for (const event of events) if (typeof event.sfx !== 'string' || !event.sfx.trim() || event.at < 0 || event.dur < 0 || !Number.isFinite(event.at + event.dur) || ['fade_in','fade_out'].some(k => event[k] != null && (!Number.isFinite(event[k]) || event[k] < 0)) || event.gain_db != null && !Number.isFinite(event.gain_db)) throw new Error(`SFX inválido en ${event.item || 'sound.cues'}`);
  events.sort((a,b) => a.at - b.at); frozen(events);
  const duration = Math.max(scene.duration ?? scene.end ?? 0, 0, ...records.flatMap(r => [Number.isFinite(r.end) ? r.end : r.start, r.item.path ? (r.item.path.t ?? r.start) + pathDuration(r.item.path) : 0, ...r.changes.map(s => s.at + s.dur)]), ...events.map(e => e.at + e.dur));
  return {
    duration,
    draw(g, view, t, info = {}) {
      for (const record of records) {
        const s = snapshot(record, t, loc); if (!s) continue;
        const projected = s.pos ? view.project(s.pos.lon, s.pos.lat) : null;
        const env = {W: view.W ?? c.st.W, H: view.H ?? c.st.H, U: c.st.U, zoom: view.zoom, k: projected?.k ?? 1, rng: (seed = record.item.id) => rng(seed),
          sprite: spriteStore.sprite, drawSprite: spriteStore.drawSprite, flag: code => c.flag?.(code) || c.flags?.get?.(code) || null,
          font: name => scene.defs?.fonts?.[name] || c.font?.(name) || name || 'sans-serif', palette, debug: !!scene.debug, ...info};
        // Los textos tienen paleta propia; no cambia los colores de unidades y mapa.
        if (TEXT_STYLE_TYPES.has(record.item.type)) env.palette = {...palette, ...TEXT_STYLE, ...scene.defs?.textPalette};
        g.save(); g.globalAlpha *= s.alpha;
        try { record.def.draw(g, s, view, env); } finally { g.restore(); }
      }
    },
    key(t) {
      const keys = [];
      for (const record of records) {
        const s = snapshot(record, t, loc); if (!s) continue;
        const animated = typeof record.def.animated === 'function' ? record.def.animated(s) : record.def.animated !== false;
        const custom = record.def.key?.(s, ctx);
        // Solo estado visible y el reloj de componentes que declaran animación interna.
        keys.push([record.prefix, s.alpha, s.pos?.lon, s.pos?.lat, s.pos?.u, s.heading, s.state, s.fromState, s.stateT,
          ...Object.entries(s.stateWeights).flat(), ...(record.def.key ? [typeof custom === 'object' ? JSON.stringify(custom) : custom] : animated ? [Math.round(t * 1e9)] : [])].join(':'));
      }
      return keys.length ? keys.join('|') : 'tactico:idle';
    },
    missing: () => [...spriteStore.missing()],
    sfx: () => clone(events),
  };
}
