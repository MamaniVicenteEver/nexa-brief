import {Tactico} from '../core.js';

// All particles are sampled from absolute time. These bounded caches contain only
// seed descriptors and procedural radial sprites, never a previous frame.
const TAU = Math.PI * 2;
const descriptors = new Map();
const sprites = new Map();
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
export const number = (x, fallback) => Number.isFinite(x) ? x : fallback;
export const time = (ctx, x, fallback = 0) => x == null ? fallback : number(ctx?.T?.(x, fallback) ?? x, fallback);
export const point = p => Array.isArray(p) ? p : p && Number.isFinite(p.lon) ? [p.lon, p.lat] : null;

// Palette keys can be overridden by scene.defs.palette. No item hardcodes a hue.
export function colors(env) {
  const p = env.palette || {};
  return {
    dark: p.shadow || p.background || '#081e2c',
    smoke: p.smoke || p.background || '#081e2c',
    smokeLight: p.smokeLight || p.border || '#e9e3ba',
    hot: p.fire || p.warning || '#ed7334',
    gold: p.flash || p.accent || '#f6edb4',
    white: p.foam || p.text || '#f4f5ea',
    red: p.missile || p.danger || '#d1495b',
    water: p.water || p.ocean || '#42bfd0',
  };
}

function boundedSet(map, key, value, cap) {
  if (map.size >= cap) map.delete(map.keys().next().value);
  map.set(key, value);
  return value;
}

function particles(env, seed, count) {
  const key = `${typeof seed}:${seed}:${count}`;
  if (descriptors.has(key)) return descriptors.get(key);
  const rng = env.rng(seed);
  const result = Array.from({length: count}, () => {
    const angle = rng() * TAU;
    return Object.freeze({x: Math.cos(angle), y: Math.sin(angle), a: rng(), b: rng(), c: rng(), d: rng()});
  });
  return boundedSet(descriptors, key, Object.freeze(result), 128);
}

function radial(kind, color) {
  const key = `${kind}:${color}`;
  if (sprites.has(key)) return sprites.get(key);
  const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(64, 64) : document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const g = canvas.getContext('2d', {willReadFrequently: true});
  const gradient = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, color);
  gradient.addColorStop(kind === 'smoke' ? .42 : .13, color);
  gradient.addColorStop(1, 'transparent');
  g.fillStyle = gradient;
  g.fillRect(0, 0, 64, 64);
  return boundedSet(sprites, key, canvas, 64);
}

export function glow(g, kind, color, x, y, radius, alpha = 1, aspect = 1) {
  stamp(g, radial(kind, color), x, y, radius, alpha, aspect);
}

function stamp(g, sprite, x, y, radius, alpha = 1, aspect = 1) {
  if (radius <= 0 || alpha <= 0) return;
  const savedAlpha = g.globalAlpha;
  g.globalAlpha *= clamp(alpha);
  g.drawImage(sprite, x - radius, y - radius * aspect, radius * 2, radius * 2 * aspect);
  g.globalAlpha = savedAlpha;
}

// Compound particles are tinted once, rather than submitting two blended
// images per particle on every frame. These caches remain independent of t.
function compound(kind, c) {
  const smoke = kind === 'smoke' || kind === 'explosion-smoke';
  const key = `${kind}:${smoke ? c.smokeLight+':'+c.smoke : c.hot+':'+c.gold}`;
  if (sprites.has(key)) return sprites.get(key);
  const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(64, 64) : document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const g = canvas.getContext('2d', {willReadFrequently: true});
  if (smoke) {
    glow(g, 'smoke', c.smokeLight, 32, 32, 32, kind === 'smoke' ? .12 : .18);
    glow(g, 'smoke', c.smoke, 32, 32, 32 / 1.1, kind === 'smoke' ? .4 : .8);
  } else {
    g.globalCompositeOperation = 'lighter';
    glow(g, 'hot', c.hot, 32, 32, 32, kind === 'flame' ? .8 : 1);
    glow(g, 'hot', c.gold, 32, kind === 'flame' ? 36.8 : 32,
      32 * (kind === 'flame' ? .35 : .65 / 1.7), kind === 'flame' ? 1 : .9, kind === 'flame' ? 1.4 / 1.5 : 1);
  }
  return boundedSet(sprites, key, canvas, 64);
}

function outlineRing(g, c, x, y, r, width, alpha, squash = 1) {
  g.globalAlpha *= alpha;
  g.beginPath();
  g.ellipse(x, y, r, r * squash, 0, 0, TAU);
  g.strokeStyle = c.dark;
  g.lineWidth = width * 2.5;
  g.stroke();
  g.strokeStyle = c.water;
  g.lineWidth = width;
  g.stroke();
}

const COMMON = {
  dur: {type: 'number', default: 2.8, min: .05},
  size: {type: 'number', default: 100, min: 4, max: 260, description: 'Radio simbólico en px a U=1.'},
  scale: {type: 'number', default: 1, min: .1, max: 4},
  scaleMode: {type: 'enum', values: ['screen', 'geo'], default: 'screen'},
  seed: {default: 1, description: 'Semilla numérica o texto.'},
  particles: {type: 'number', default: 72, min: 1, max: 300},
};

function commonValidation(item) {
  const errors = [];
  for (const [key, lo, hi] of [['size', 4, 260], ['scale', .1, 4], ['particles', 1, 300], ['dur', .05, 3600]]) {
    if (item[key] != null && (!Number.isFinite(item[key]) || item[key] < lo || item[key] > hi)) errors.push(`${key}: requiere ${lo}..${hi}`);
  }
  if (item.particles != null && !Number.isInteger(item.particles)) errors.push('particles: requiere entero');
  if (item.seed != null && !['number', 'string'].includes(typeof item.seed)) errors.push('seed: requiere número o texto');
  if (typeof item.seed === 'number' && !Number.isFinite(item.seed)) errors.push('seed: requiere número finito');
  if (item.scaleMode != null && !['screen','geo'].includes(item.scaleMode)) errors.push('scaleMode: screen|geo');
  return errors;
}

export function fxPrepare(item, ctx, defaults = {}) {
  const duration = time(ctx, item.dur, defaults.dur || 2.8);
  return Object.freeze({start: time(ctx, item.t), duration,
    seed: item.seed ?? item.id ?? 1,
    size: clamp(number(item.size, defaults.size || 100), 4, 260),
    count: clamp(Math.floor(number(item.particles, defaults.particles || 72)), 1, 300),
  });
}

function frame(g, s, view, env, defaults) {
  const item = s.item;
  const internal = s.internal || fxPrepare(item, null, defaults);
  const lt = number(s.lt, number(s.t, 0) - internal.start);
  if (lt < 0 || lt >= internal.duration) return null;
  const at = point(s.pos) || point(item.at);
  if (!at) return null;
  const p = view.project(...at);
  if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
  const geographicScale = item.scaleMode === 'geo' ? clamp(number(env.k, 1), .6, 1.5) : 1;
  const R = Math.min(internal.size * clamp(number(item.scale, 1), .1, 4) * env.U * geographicScale, Math.min(env.W, env.H) * .32);
  // A screen-space effect is allowed to overlap the edge even if its anchor is offscreen.
  if (p.x < -R * 4 || p.x > env.W + R * 4 || p.y < -R * 4 || p.y > env.H + R * 4) return null;
  g.save();
  g.translate(p.x, p.y);
  if (['fx.fire', 'fx.smoke', 'fx.ring'].includes(item.type)) g.globalAlpha *= smooth((internal.duration - lt) / Math.min(.35, internal.duration * .3));
  return {item, internal, lt, u: lt / internal.duration, R, c: colors(env)};
}

function explosion(g, f, env) {
  const {c, R, u, internal, item} = f;
  const ps = particles(env, internal.seed, internal.count);
  const air = item.variant === 'air';
  const smokeCount = Math.floor(ps.length * .35);
  const fireCount = Math.floor(ps.length * .38);
  const puff = compound('explosion-smoke', c), ball = compound('fireball', c);
  g.globalCompositeOperation = 'source-over';
  for (let i = 0; i < smokeCount; i++) {
    const p = ps[i], a = smooth(u * 7) * (1 - smooth((u - .64) / .36));
    const spread = R * (.15 + u * .85) * p.a;
    stamp(g, puff, p.x * spread, p.y * spread * .55 - R * u * (air ? .25 : .7), R * (.13 + u * .33) * (.6 + p.b), a);
  }
  // A dark halo preserves definition on bright desert/satellite imagery.
  glow(g, 'smoke', c.dark, 0, 0, R * (.22 + u * .35), (1 - u) * .65, .65);
  g.globalCompositeOperation = 'lighter';
  glow(g, 'hot', c.gold, 0, 0, R * (.16 + u * .9), Math.exp(-u * 22));
  for (let i = smokeCount; i < smokeCount + fireCount; i++) {
    const p = ps[i], age = clamp(u * 1.5 - p.a * .18);
    const a = smooth(age * 14) * (1 - smooth(age));
    const x = p.x * R * age * (.4 + p.b), y = p.y * R * age * (.35 + p.b) - R * age * .2;
    const r = R * (.12 + p.c * .2) * (1 - age * .6);
    stamp(g, ball, x, y, r * 1.7, a);
  }
  for (let i = smokeCount + fireCount; i < ps.length; i++) {
    if (!air && (i - smokeCount - fireCount) % 4 === 0) continue;
    const p = ps[i], age = u * (1.3 + p.a);
    if (age > 1) continue;
    const x = p.x * R * age * (1.1 + p.b), y = p.y * R * age - R * age * .25 + (air ? 0 : R * age * age * .8);
    g.save();g.globalAlpha *= 1 - age;
    g.strokeStyle = i % 3 ? c.gold : c.hot;
    g.lineWidth = env.U * (1 + p.c * 2);
    g.beginPath();g.moveTo(x, y);g.lineTo(x - p.x * R * .06, y - p.y * R * .06);g.stroke();
    g.restore();
  }
  // Ground/naval debris follows a ballistic parabola, not random per-frame jitter.
  g.globalCompositeOperation = 'source-over';
  if (!air) for (let i = smokeCount + fireCount; i < ps.length; i += 4) {
    const p = ps[i], age = clamp(u * 1.8), a = 1 - smooth((u - .4) / .5);
    g.fillStyle = c.dark;
    const x = p.x * R * age * 1.2, y = p.y * R * age * .5 - R * age * (1 - age) * 2;
    const size = env.U * (2 + p.c * 3);
    g.save();g.globalAlpha *= a;g.translate(x, y);g.rotate(age * (p.a - .5) * 12);g.fillRect(-size, -size / 2, size * 2, size);g.restore();
  }
  if (item.variant === 'naval') {
    g.save();outlineRing(g, c, 0, R * .1, R * Math.sqrt(u), 2 * env.U, (1 - u) * .4, .6);g.restore();
  }
}

function impact(g, f, env) {
  const {c, R, u, internal, item} = f;
  const water = item.variant === 'water';
  const fade = Math.sin(Math.PI * Math.pow(u, .6));
  g.save();outlineRing(g, {...c, water: water ? c.white : c.gold}, 0, 0, R * Math.sqrt(u), 2 * env.U, fade * .8, water ? .65 : .8);g.restore();
  g.globalCompositeOperation = 'screen';
  glow(g, 'hot', water ? c.water : c.gold, 0, 0, R * (.2 + u * .4), Math.exp(-u * 15));
  const ps = particles(env, internal.seed, internal.count);
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i], age = clamp(u * (1.2 + p.c * .8));
    const x = p.x * R * age * (water ? .38 : 1), y = water ? -R * 2.5 * age * (1 - age) * (1 + p.a) + p.y * R * age * .2 : p.y * R * age * .7;
    glow(g, 'hot', water ? c.white : c.hot, x, y, R * (water ? .04 : .075) * (1 + p.b), fade * (1 - age), water ? 2.8 : 1);
  }
  if (water) {
    g.globalCompositeOperation = 'source-over';
    glow(g, 'smoke', c.dark, 0, R * .08, R * .5, fade * .4, .24);
    g.globalCompositeOperation = 'screen';
    glow(g, 'hot', c.white, 0, -R * Math.sin(u * Math.PI) * .45, R * .13 * fade, fade * .8, 3.5);
    glow(g, 'hot', c.white, 0, R * .08, R * (.15 + u * .48), fade * .45, .24);
  }
}

function shockwave(g, f, env) {
  const {R, c, u, item} = f;
  const water = item.variant === 'water', radius = R * (.07 + Math.pow(u, .67) * 1.7);
  const fade = smooth(u * 20) * (1 - smooth(u));
  // Alternating dark/light rims simulate refraction, without reading the map.
  for (let i = 2; i >= 0; i--) {
    const r = radius * (1 - i * .055);
    g.save();outlineRing(g, {...c, water: water ? c.water : c.gold}, 0, 0, r, (4 - i) * env.U, fade * (.65 - i * .13), water ? .82 : 1);g.restore();
  }
  g.globalCompositeOperation = 'screen';
  // One radial, not a solid disc: the map texture remains readable.
  g.lineWidth = 10 * env.U * (1 - u);
  g.strokeStyle = water ? c.water : c.gold;
  g.globalAlpha *= fade * .12;
  g.beginPath();g.ellipse(0, 0, radius * .96, radius * (water ? .82 : 1) * .96, 0, 0, TAU);g.stroke();
}

function smoke(g, f, env) {
  const {R, c, lt, internal, item} = f;
  const life = clamp(number(item.life, 3), .2, 20), rate = internal.count / life;
  const drift = item.drift || [20, -9];
  const end = Math.min(internal.duration, number(item.emitFor, internal.duration));
  const first = Math.max(0, Math.floor((lt - life) * rate));
  const last = Math.min(Math.floor(lt * rate), Math.ceil(end * rate) - 1);
  const ps = particles(env, internal.seed, internal.count);
  const puff = compound('smoke', c);
  g.globalCompositeOperation = 'source-over';
  for (let index = first; index <= last; index++) {
    const p = ps[index % ps.length], age = (lt - index / rate) / life;
    if (age < 0 || age >= 1) continue;
    const a = smooth(age * 12) * (1 - smooth((age - .55) / .45));
    const x = drift[0] * env.U * age * life + p.x * R * (.05 + age * .3);
    const y = drift[1] * env.U * age * life - (item.variant === 'trail' ? 0 : age * R * .9) + p.y * R * age * .17;
    const radius = R * (.1 + age * .32) * (.75 + p.b * .5);
    stamp(g, puff, x, y, radius * 1.1, a);
  }
}

function fire(g, f, env) {
  const {R, c, lt, internal, item} = f;
  const ps = particles(env, internal.seed, internal.count);
  const period = clamp(number(item.period, 1.3), .2, 8);
  const flame = compound('flame', c);
  g.globalCompositeOperation = 'source-over';
  glow(g, 'smoke', c.dark, 0, 0, R * .6, .7, .5);
  g.globalCompositeOperation = 'lighter';
  glow(g, 'hot', c.hot, 0, 0, R * .55, .3, .55);
  for (const p of ps) {
    // Both ends of each particle's cycle are transparent (C1), so wrapping is safe.
    const age = ((lt / period + p.a) % 1 + 1) % 1;
    const a = Math.sin(age * Math.PI) ** 2;
    const x = p.x * R * .35 * (1 - age * .65) + Math.sin(age * TAU + p.b * TAU) * R * .035;
    const y = -R * age * (.6 + p.c * .7) + p.y * R * .08;
    const r = R * (.05 + p.d * .07) * (1 - age * .6);
    stamp(g, flame, x, y, r * 2, a, 1.5);
  }
}

function ring(g, f, env) {
  const {R, c, lt, item} = f;
  const count = clamp(Math.floor(number(item.rings, 3)), 1, 6), period = clamp(number(item.period, 2), .2, 12);
  const target = item.variant === 'target';
  for (let i = 0; i < count; i++) {
    const phase = ((lt / period + i / count) % 1 + 1) % 1;
    const r = R * (.12 + phase * .88), a = Math.sin(phase * Math.PI) ** 2;
    g.save();outlineRing(g, {...c, water: target ? c.gold : c.water}, 0, 0, r, 2 * env.U, a * .8);g.restore();
  }
  if (target || item.variant === 'detection') {
    g.strokeStyle = target ? c.gold : c.white;g.lineWidth = 2 * env.U;
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      g.beginPath();g.moveTo(Math.cos(a) * R * .87, Math.sin(a) * R * .87);g.lineTo(Math.cos(a) * R * 1.04, Math.sin(a) * R * 1.04);g.stroke();
    }
  }
}

function flash(g, f) {
  const {R, c, u} = f;
  const a = Math.sin(Math.PI * Math.pow(u, .3)) ** 3;
  g.globalCompositeOperation = 'source-over';glow(g, 'hot', c.dark, 0, 0, R * .7, a * .4);
  g.globalCompositeOperation = 'lighter';
  glow(g, 'hot', c.gold, 0, 0, R, a * .65);
  glow(g, 'hot', c.white, 0, 0, R * .4, a);
  glow(g, 'hot', c.white, 0, 0, R * .9, a * .7, .045);
  glow(g, 'hot', c.gold, 0, 0, R * .08, a * .5, 5);
}

const DEFINITIONS = [
  ['fx.explosion', 'Explosión con bola de fuego, chispas, escombros y humo expansivo.', {dur: 2.8, size: 100, particles: 84}, ['ground', 'air', 'naval'], explosion],
  ['fx.impact', 'Impacto con anillo; agua con columna, gotas y espuma.', {dur: 1.6, size: 75, particles: 52}, ['ground', 'water'], impact],
  ['fx.shockwave', 'Onda circular con tres bordes de refracción simulada.', {dur: 2.4, size: 110, particles: 1}, ['ground', 'water'], shockwave],
  ['fx.smoke', 'Columna de humo sembrada, con deriva y emisión acotada.', {dur: 8, size: 85, particles: 36}, ['column', 'trail'], smoke],
  ['fx.fire', 'Llamas cíclicas sobre un punto o casco, con cierre suave de cada partícula.', {dur: 8, size: 70, particles: 32}, null, fire],
  ['fx.ring', 'Anillos concéntricos pulsantes de sonar, objetivo o detección.', {dur: 6, size: 100, particles: 1}, ['sonar', 'target', 'detection'], ring],
  ['fx.flash', 'Destello radial breve con núcleo luminoso.', {dur: .45, size: 80, particles: 1}, null, flash],
];

const effects = new Map();
export const effectDefinition = name => effects.get(name);

for (const [name, summary, defaults, variants, paint] of DEFINITIONS) {
  const params = Object.fromEntries(Object.entries(COMMON).map(([key, value]) => [key, {...value, default: defaults[key] ?? value.default}]));
  if (variants) params.variant = {type: 'enum', values: variants, default: variants[0]};
  if (name === 'fx.smoke') Object.assign(params, {
    drift: {type: 'array', default: [20, -9], description: 'px/s en pantalla, multiplicados por U.'},
    life: {type: 'number', default: 3, min: .2, max: 20},
    emitFor: {type: 'number', default: 8, description: 'Segundos de emisión; dejar life segundos para disipación.'},
  });
  if (name === 'fx.fire' || name === 'fx.ring') params.period = {type: 'number', default: name === 'fx.fire' ? 1.3 : 2, min: .2, max: name === 'fx.fire' ? 8 : 12};
  if (name === 'fx.explosion') params.distance = {type: 'enum', values: ['near', 'far'], default: 'near'};
  if (name === 'fx.ring') params.rings = {type: 'number', default: 3, min: 1, max: 6};
  const spec = {
    layer: 60, summary, params, states: [], particleLimit: 300,
    validate(item) {
      const errors = commonValidation(item);
      if (variants && item.variant != null && !variants.includes(item.variant)) errors.push(`variant: ${variants.join('|')}`);
      for (const [key, lo, hi] of [['period', .2, name === 'fx.fire' ? 8 : 12], ['life', .2, 20], ['emitFor', .001, 3600]]) if (item[key] != null && (!Number.isFinite(item[key]) || item[key] < lo || item[key] > hi)) errors.push(`${key}: requiere ${lo}..${hi}`);
      if (item.drift != null && (!Array.isArray(item.drift) || item.drift.length !== 2 || !item.drift.every(Number.isFinite))) errors.push('drift: requiere [dx,dy] finitos');
      if (item.rings != null && (!Number.isInteger(item.rings) || item.rings < 1 || item.rings > 6)) errors.push('rings: requiere entero 1..6');
      return errors;
    },
    prepare: (item, ctx) => fxPrepare(item, ctx, defaults),
    draw(g, s, view, env) {
      const f = frame(g, s, view, env, defaults);
      if (!f) return;
      try { paint(g, f, env); } finally { g.restore(); }
    },
    sfx(item, ctx) {
      if (item.sfx === false) return [];
      let id = null;
      if (name === 'fx.explosion') id = item.distance === 'far' || item.variant === 'air' ? 'explosion-far' : 'explosion-near';
      if (name === 'fx.impact') id = item.variant === 'water' ? 'water-impact' : 'explosion-far';
      if (name === 'fx.shockwave' && item.variant === 'water') id = 'water-impact';
      return id ? [{sfx: id, at: time(ctx, item.t), dur: Math.min(defaults.dur, number(item.dur, defaults.dur)), gain_db: -12}] : [];
    },
    demo: {id: name.replace('.', '-'), type: name, at: [54, 27], t: 0, dur: defaults.dur, ...defaults, ...(variants ? {variant: variants[0]} : {}), seed: 73},
  };
  effects.set(name, spec);
  Tactico.component(name, spec);
}
