import {Tactico} from '../core.js';
import {pathAt} from '../util.js';
import {clamp, number, time, point, colors, glow, effectDefinition} from './fx.js';

const TAU = Math.PI * 2;
const coordinates = p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90;
const sceneOf = ctx => ctx?.scene || ctx?.c?.scene || {items: ctx?.items || [], places: ctx?.places || {}};

function makePath(points, options = {}) {
  return Object.freeze({via: Object.freeze(points.map(p => Object.freeze(p.slice()))),
    t: options.start || 0, ...(options.dur == null && options.speed > 0 ? {speed: options.speed} : {dur: Math.max(.05, number(options.dur, 2.4))}), ease: options.ease || 'linear',
    curve: options.curve || 'arc', bend: clamp(number(options.bend, .25), -1, 1)});
}

// Preserve the exact route used by the followed item, including speed-only paths.
function copyPath(raw, via, ctx, start) {
  return makePath(via, {start, dur: raw.dur == null ? (raw.speed > 0 ? undefined : 8) : time(ctx, raw.dur),
    speed: raw.speed, ease: raw.ease, curve: raw.curve || 'line', bend: raw.bend ?? .16});
}

function pathDuration(path) {
  if (path.dur != null) return path.dur;
  const linear = Object.freeze({...path, ease: 'linear'});
  let dt = 1;
  // Find an interior sample; u is elapsed/duration before easing.
  for (let i = 0; i < 48; i++, dt /= 2) {
    const u = pathAt(linear, path.t + dt).u;
    if (u > 0 && u < 1) return dt / u;
  }
  return 0;
}

export function samplePath(path, t) {
  const p = pathAt(path, t);
  return {at: [p.lon, p.lat], heading: p.heading, u: p.u};
}

function resolve(ref, ctx, t, seen = new Set()) {
  if (coordinates(ref)) return ref.slice();
  if (typeof ref !== 'string' || seen.has(ref)) return null;
  const scene = sceneOf(ctx);
  const source = scene.items?.find(i => i.id === ref);
  if (!source) {
    const own = scene.places?.[ref] || scene.regions?.[ref];
    const at = Array.isArray(own) ? own : own?.coordinates || own?.center || own?.label;
    return coordinates(at) ? at.slice() : point(ctx?.place?.(ref, t));
  }
  seen.add(ref);
  if (source.path?.via?.length >= 2) {
    const via = source.path.via.map(p => resolve(p, ctx, t, new Set(seen)));
    if (via.every(Boolean)) return samplePath(copyPath(source.path, via, ctx, time(ctx, source.path.t, time(ctx, source.t))), t).at;
  }
  return resolve(source.at, ctx, t, seen);
}

const DEFAULTS = {
  'strike.missile': {flightDur: 2.4, dur: 4, particles: 96, width: 3.4, bend: .25},
  'strike.salvo': {flightDur: 2.4, dur: 5, particles: 240, width: 3, bend: .3, count: 6, stagger: .2, spread: .24},
  'strike.torpedo': {flightDur: 4, dur: 5.6, particles: 96, width: 3.5, bend: 0, zigzag: 7},
  'strike.shell': {flightDur: .55, dur: 2.15, particles: 32, width: 2.8, bend: .08},
};

function budget(item, defaults, count) {
  const total = clamp(Math.floor(number(item.particles, defaults.particles)), 8, 300);
  const slots = Math.max(4, Math.floor(total / count));
  const segments = Math.max(2, Math.min(32, Math.floor(slots * .4)));
  return {total, slots, segments, impact: Math.max(1, slots - segments)};
}

function hitConfig(item, type, at, hitTime, allowance, index) {
  if (item.onHit === false) return null;
  const config = item.onHit || {};
  const fx = config.fx || 'fx.impact';
  const spec = effectDefinition(fx);
  if (!spec) return null;
  const result = {...config, id: `${item.id || type}:hit:${index}`, type: fx, at, t: hitTime,
    dur: number(config.dur, spec.params.dur.default),
    variant: config.variant || (type === 'strike.torpedo' && ['fx.impact', 'fx.shockwave'].includes(fx) ? 'water' : undefined),
    size: number(config.size, type === 'strike.shell' ? 42 : 75),
    particles: Math.min(allowance, Math.floor(number(config.particles, spec.params.particles.default))),
    seed: `${item.seed ?? item.id ?? 1}:hit:${index}`,
  };
  if (!result.variant) delete result.variant;
  return result;
}

export function prepareStrike(item, ctx) {
  const defaults = DEFAULTS[item.type] || DEFAULTS['strike.missile'];
  const start = time(ctx, item.t), flightStart = time(ctx, item.path?.t, start);
  const flightDur = Math.max(.05, time(ctx, item.path?.dur ?? item.flightDur, defaults.flightDur));
  const count = item.type === 'strike.salvo' ? clamp(Math.floor(number(item.count, defaults.count)), 1, 10) : 1;
  const stagger = Math.max(0, number(item.stagger, defaults.stagger || 0));
  const resources = budget(item, defaults, count), launches = [];
  for (let index = 0; index < count; index++) {
    const launch = flightStart + index * stagger, arrival = launch + flightDur;
    const source = item.path?.via || [item.from ?? item.at, item.to];
    const via = source.map((p, n) => resolve(p, ctx, n === 0 ? launch : arrival));
    if (via.length < 2 || !via.every(Boolean)) continue;
    const spread = (index - (count - 1) / 2) / Math.max(1, count - 1) * number(item.spread, defaults.spread || 0);
    const path = makePath(via, {start: launch, dur: flightDur, ease: item.path?.ease || 'linear',
      curve: item.path?.curve || 'arc', bend: number(item.path?.bend, number(item.bend, defaults.bend)) + spread});
    const hit = hitConfig(item, item.type, via.at(-1), arrival, resources.impact, index);
    const fx = hit && effectDefinition(hit.type);
    launches.push(Object.freeze({path, arrival, hit: hit && Object.freeze(hit), hitInternal: fx?.prepare(hit, ctx)}));
  }
  const naturalEnd = Math.max(start, ...launches.map(l => l.arrival + (l.hit?.dur || 0)));
  return Object.freeze({start, duration: time(ctx, item.dur, naturalEnd - start),
    launches: Object.freeze(launches), resources: Object.freeze(resources), defaults});
}

function screenAt(path, t, view, env, item, index) {
  const sample = samplePath(path, t), p = view.project(...sample.at);
  if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
  const angle = (sample.heading - 90 - number(view.bearing, 0)) * Math.PI / 180;
  if (item.type === 'strike.torpedo') {
    const amplitude = clamp(number(item.zigzag, 7), 0, 30) * env.U;
    const offset = Math.sin(sample.u * TAU * 4 + index * .7) * Math.sin(sample.u * Math.PI) * amplitude;
    p.x -= Math.sin(angle) * offset;p.y += Math.cos(angle) * offset;
  }
  return {...p, angle};
}

function stroke(g, points, width, color) {
  if (points.length < 2) return;
  g.beginPath();g.moveTo(points[0].x, points[0].y);
  for (const p of points.slice(1)) g.lineTo(p.x, p.y);
  g.lineWidth = width;g.strokeStyle = color;g.stroke();
}

function drawFlight(g, item, launch, t, view, env, internal, index) {
  const {path} = launch;
  if (t < path.t || t >= launch.arrival + .18) return;
  const c = colors(env), torpedo = item.type === 'strike.torpedo', shell = item.type === 'strike.shell';
  const width = clamp(number(item.width, internal.defaults.width), .5, 16) * env.U;
  const life = Math.max(.08, number(item.trailLife, shell ? .12 : torpedo ? .85 : .65));
  const stop = Math.min(t, launch.arrival), start = Math.max(path.t, stop - life);
  const fadeEnd = 1 - clamp((t - launch.arrival) / .18);
  const steps = Math.min(16, internal.resources.segments);
  const points = Array.from({length: steps + 1}, (_, i) => screenAt(path, start + (stop - start) * i / steps, view, env, item, index));
  if (!points.every(Boolean)) return;
  g.save();g.lineCap = 'round';g.lineJoin = 'round';g.globalAlpha *= fadeEnd;
  // Contour remains visible on pale land. Emission then uses screen/lighter.
  g.globalCompositeOperation = 'source-over';stroke(g, points, width + 2.5 * env.U, c.dark);
  const baseAlpha = g.globalAlpha;
  for (let i = 1; i < points.length; i++) {
    const alpha = (i / steps) ** 1.5, segment = [points[i - 1], points[i]];
    g.globalAlpha = baseAlpha * alpha;
    g.globalCompositeOperation = 'screen';stroke(g, segment, width * 2.8, torpedo ? c.water : c.red);
    g.globalCompositeOperation = 'lighter';stroke(g, segment, width * .65, torpedo ? c.white : c.red);
  }
  g.globalAlpha = baseAlpha;
  const head = points.at(-1);
  if (t < launch.arrival) {
    if (torpedo) {
      const bubbles = Math.min(12, internal.resources.slots - steps);
      for (let i = 0; i < bubbles; i++) {
        const phase = i / bubbles, pos = points[Math.min(steps, Math.floor(phase * steps))];
        g.save();g.globalAlpha *= phase * .4;g.strokeStyle = c.white;g.lineWidth = env.U;
        g.beginPath();g.arc(pos.x + Math.sin(i * 2.4) * 6 * env.U, pos.y + Math.cos(i * 1.7) * 6 * env.U, (1 + (1 - phase) * 2) * env.U, 0, TAU);g.stroke();g.restore();
      }
    }
    g.translate(head.x, head.y);g.rotate(head.angle);
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = c.dark;g.beginPath();g.moveTo(9 * env.U, 0);g.lineTo(-7 * env.U, -3 * env.U);g.lineTo(-4 * env.U, 0);g.lineTo(-7 * env.U, 3 * env.U);g.closePath();g.fill();
    g.globalCompositeOperation = 'lighter';
    glow(g, 'hot', torpedo ? c.water : c.gold, 2 * env.U, 0, (shell ? 8 : 13) * env.U, .9);
    glow(g, 'hot', c.white, 5 * env.U, 0, 4 * env.U, .95);
  }
  g.restore();
}

function validateStrike(item, ctx) {
  const errors = [], defaults = DEFAULTS[item.type] || DEFAULTS['strike.missile'];
  const source = item.path?.via || [item.from ?? item.at, item.to];
  if (!Array.isArray(source) || source.length < 2 || source.some(p => !(coordinates(p) || typeof p === 'string'))) errors.push('trayectoria: requiere from/to o path.via con dos puntos o lugares');
  else if (ctx && source.some(p => !resolve(p, ctx, time(ctx, item.t)))) errors.push('trayectoria: lugar o id sin resolver');
  for (const [key, lo, hi] of [['flightDur', .05, 3600], ['dur', .05, 3600], ['width', .5, 16], ['particles', 8, 300], ['stagger', 0, 30], ['bend', -1, 1], ['spread', 0, 2], ['zigzag', 0, 30], ['trailLife', .08, 30]]) {
    if (item[key] != null && (!Number.isFinite(item[key]) || item[key] < lo || item[key] > hi)) errors.push(`${key}: requiere ${lo}..${hi}`);
  }
  if (item.particles != null && !Number.isInteger(item.particles)) errors.push('particles: requiere entero');
  if (item.count != null && (!Number.isInteger(item.count) || item.count < 1 || item.count > 10)) errors.push('count: requiere entero 1..10');
  if (item.seed != null && !['number', 'string'].includes(typeof item.seed) || typeof item.seed === 'number' && !Number.isFinite(item.seed)) errors.push('seed: requiere número finito o texto');
  if (item.path?.t != null && time(ctx, item.path.t) < time(ctx, item.t)) errors.push('path.t: no puede preceder al inicio del ataque');
  if (item.onHit != null && item.onHit !== false && (typeof item.onHit !== 'object' || Array.isArray(item.onHit))) errors.push('onHit: requiere objeto o false');
  else if (item.onHit != null && item.onHit !== false) {
    const fx = effectDefinition(item.onHit.fx || 'fx.impact');
    if (!fx) errors.push('onHit.fx: requiere uno de los siete fx de fx.js');
    else errors.push(...fx.validate({...item.onHit, type: item.onHit.fx}).map(e => `onHit.${e}`));
  }
  const count = item.type === 'strike.salvo' ? number(item.count, 6) : 1;
  const flight = time(ctx, item.path?.dur ?? item.flightDur, defaults.flightDur);
  const hitSpec = item.onHit === false ? null : effectDefinition(item.onHit?.fx || 'fx.impact');
  const needed = time(ctx, item.path?.t, time(ctx, item.t)) - time(ctx, item.t) + flight + (count - 1) * number(item.stagger, defaults.stagger || 0) + (hitSpec ? number(item.onHit?.dur, hitSpec.params.dur.default) : 0);
  if (item.dur != null && item.dur + 1e-8 < needed) errors.push(`dur: requiere al menos ${needed.toFixed(3)} s para completar vuelo/impacto`);
  if (budget(item, defaults, count).total < count * 4) errors.push('particles: requiere al menos count*4 para la salva');
  return errors;
}

for (const [name, defaults] of Object.entries(DEFAULTS)) {
  const salvo = name === 'strike.salvo';
  const params = {
    from: {default: null, description: '[lon,lat], lugar o id; alternativo a path.via.'}, to: {default: null, description: '[lon,lat], lugar o id de destino.'},
    dur: {type: 'number', default: defaults.dur, description: 'Vida completa incluyendo onHit; ampliarla si cambia el vuelo o el impacto.'},
    flightDur: {type: 'number', default: defaults.flightDur, min: .05},
    width: {type: 'number', default: defaults.width, min: .5, max: 16},
    bend: {type: 'number', default: defaults.bend, min: -1, max: 1},
    particles: {type: 'number', default: defaults.particles, min: 8, max: 300, description: 'Presupuesto agregado de estelas y todos los impactos.'},
    seed: {default: 1, description: 'Semilla numérica o texto.'},
    trailLife: {type: 'number', default: name === 'strike.torpedo' ? .85 : name === 'strike.shell' ? .12 : .65},
    onHit: { default: {fx: 'fx.impact', ...(name === 'strike.torpedo' ? {variant: 'water'} : {})}},
  };
  if (salvo) Object.assign(params, {
    count: {type: 'number', default: 6, min: 1, max: 10},
    stagger: {type: 'number', default: .2, min: 0},
    spread: {type: 'number', default: .24, min: 0, max: 2},
  });
  if (name === 'strike.torpedo') params.zigzag = {type: 'number', default: 7, min: 0, max: 30};
  Tactico.component(name, {
    layer: 60,
    summary: salvo ? 'Salva escalonada de hasta diez misiles con curvas en abanico e impactos programables.' : name === 'strike.torpedo' ? 'Torpedo bajo el agua, estela blanca, zigzag y burbujas; impacto acuático.' : name === 'strike.shell' ? 'Proyectil rápido con trazadora corta e impacto programable.' : 'Misil de rumbo tangente con estela roja, cabeza luminosa y onHit programable.',
    params, states: [], particleLimit: 300, validate: validateStrike, prepare: prepareStrike,
    draw(g, s, view, env) {
      const internal = s.internal;
      if (!internal) return;
      const t = number(s.t, internal.start + number(s.lt, 0));
      if (t < internal.start || t >= internal.start + internal.duration) return;
      g.save();
      try {
        for (let index = 0; index < internal.launches.length; index++) {
          const launch = internal.launches[index];
          drawFlight(g, s.item, launch, t, view, env, internal, index);
          if (launch.hit) {
            const fx = effectDefinition(launch.hit.type), lt = t - launch.arrival;
            fx.draw(g, {item: launch.hit, t, lt, u: lt / launch.hit.dur, alpha: 1,
              pos: launch.hit.at, internal: launch.hitInternal}, view, env);
          }
        }
      } finally { g.restore(); }
    },
    sfx(item, ctx) {
      if (item.sfx === false) return [];
      const internal = prepareStrike(item, ctx), cues = [];
      cues.push({sfx: name === 'strike.torpedo' ? 'torpedo' : name === 'strike.shell' ? 'bomb-whistle' : 'missile-pass',
        at: internal.launches[0]?.path.t ?? internal.start,
        dur: Math.max(.1, (internal.launches.at(-1)?.arrival ?? internal.start) - (internal.launches[0]?.path.t ?? internal.start)), gain_db: -16});
      let previous = -Infinity;
      for (const launch of internal.launches) if (launch.hit && launch.arrival - previous >= .35) {
        const events = effectDefinition(launch.hit.type).sfx(launch.hit, ctx);
        cues.push(...events);previous = launch.arrival;
      }
      return cues;
    },
    demo: {id: name.replace('.', '-'), type: name, from: [51.5, 27], to: [55, 28.5], t: 0, dur: defaults.dur,
      flightDur: defaults.flightDur, seed: 51, ...(salvo ? {count: 6, stagger: .2, spread: .24} : {}),
      onHit: {fx: 'fx.impact', ...(name === 'strike.torpedo' ? {variant: 'water'} : {})}},
  });
}

function prepareContrail(item, ctx) {
  const scene = sceneOf(ctx), source = scene.items?.find(i => i.id === item.follow);
  const raw = source?.path || item.path;
  const via = raw?.via?.map(p => resolve(p, ctx, time(ctx, raw.t, time(ctx, source?.t ?? item.t))));
  const path = via?.length >= 2 && via.every(Boolean) ? copyPath(raw, via, ctx, time(ctx, raw.t, time(ctx, source?.t ?? item.t))) : null;
  return Object.freeze({path, pathEnd: path ? path.t + pathDuration(path) : 0, start: time(ctx, item.t), duration: time(ctx, item.dur, 8),
    life: clamp(number(item.life, 2.6), .1, 20), count: clamp(Math.floor(number(item.particles, 24)), 4, 150)});
}

Tactico.component('trail.contrail', {
  layer: 49,
  summary: 'Doble estela de condensación enganchada al path de follow; historial geográfico calculado desde t.',
  params: {
    follow: {type: 'string', default: '', description: 'Id de aeronave con path; requiere ctx.scene en prepare.'},
    dur: {type: 'number', default: 8}, width: {type: 'number', default: 4, min: .5, max: 16},
    life: {type: 'number', default: 2.6, min: .1, max: 20},
    fadePower: {type: 'number', default: 1.4, min: .1, max: 5},
    separation: {type: 'number', default: 10, min: 0, max: 50},
    particles: {type: 'number', default: 24, min: 4, max: 150, description: 'Segmentos por motor; dos motores, máximo 300.'},
  },
  states: [], particleLimit: 300,
  validate(item, ctx) {
    const errors = [];
    if (typeof item.follow !== 'string' || !item.follow) errors.push('follow: requiere id de aeronave');
    if (ctx && !sceneOf(ctx).items?.some(i => i.id === item.follow && i.path?.via?.length >= 2)) errors.push('follow: id no encontrado o sin path');
    for (const [key, lo, hi] of [['dur', .05, 3600], ['width', .5, 16], ['life', .1, 20], ['fadePower', .1, 5], ['separation', 0, 50], ['particles', 4, 150]]) {
      if (item[key] != null && (!Number.isFinite(item[key]) || item[key] < lo || item[key] > hi)) errors.push(`${key}: requiere ${lo}..${hi}`);
    }
    if (item.particles != null && !Number.isInteger(item.particles)) errors.push('particles: requiere entero');
    return errors;
  },
  prepare: prepareContrail,
  draw(g, s, view, env) {
    const internal = s.internal;
    if (!internal?.path) return;
    const t = number(s.t, internal.start + number(s.lt, 0));
    if (t < internal.start || t >= internal.start + internal.duration) return;
    const path = internal.path, end = Math.min(t, internal.pathEnd), begin = Math.max(path.t, t - internal.life);
    if (end <= begin) return;
    const c = colors(env), width = number(s.item.width, 4) * env.U;
    const separation = number(s.item.separation, 10) * env.U;
    const points = Array.from({length: internal.count + 1}, (_, i) => {
      const at = begin + (end - begin) * i / internal.count;
      const p = screenAt(path, at, view, env, {}, 0);
      return p && {...p, age: clamp((t - at) / internal.life)};
    });
    if (!points.every(Boolean)) return;
    g.save();g.lineCap = 'round';
    try {
      const baseAlpha = g.globalAlpha;
      for (const side of [-1, 1]) for (let i = 1; i < points.length; i++) {
        const a = points[i - 1], b = points[i], opacity = (1 - b.age) ** number(s.item.fadePower, 1.4);
        const offset = p => ({x: p.x - Math.sin(p.angle) * separation * side / 2, y: p.y + Math.cos(p.angle) * separation * side / 2});
        const segment = [offset(a), offset(b)], w = width * (.45 + b.age * 1.7);
        g.globalAlpha = baseAlpha * opacity * .7;g.globalCompositeOperation = 'source-over';stroke(g, segment, w + env.U, c.dark);
        g.globalCompositeOperation = 'screen';stroke(g, segment, w, c.white);
      }
    } finally { g.restore(); }
  },
  sfx() { return []; },
  demo: {id: 'trail-contrail', type: 'trail.contrail', follow: 'trail-contrail',
    path: {via: [[51.5, 27], [53, 28.6], [55, 28.5]], t: 0, dur: 6, curve: 'smooth'}, t: 0, dur: 8, width: 4, life: 2.6},
});
