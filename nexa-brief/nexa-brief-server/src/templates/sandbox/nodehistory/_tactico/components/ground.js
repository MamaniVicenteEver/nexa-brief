import {Tactico} from '../core.js';
import {createSprites} from '../sprites.js';
import {pathAt, pathDuration, mercator, unmercator, rng, ease} from '../util.js';
import {clamp, smooth, RAD, time, place, prepareMotion, poseAt, screenPose, stateWeights, ink, text, polygon, motionErrors} from './units.js';

export const GROUND_STATES = ['normal', 'hit', 'burning', 'destroyed'];
export const GROUND_TYPES = Object.freeze({
  'ground.tank': {main: 'tank-main', light: 'tank-light'},
  'ground.apc': {normal: 'apc'},
  'ground.truck': {cargo: 'truck-military', fuel: 'truck-fuel'},
  'ground.jeep': {normal: 'jeep'},
  'ground.artillery': {towed: 'artillery-towed', self: 'artillery-self-propelled'},
  'ground.launcher': {normal: 'missile-launcher'},
  'ground.ambulance': {cross: 'ambulance', crescent: 'ambulance-crescent'},
});
const firstVariant = type => Object.keys(GROUND_TYPES[type] || {normal: ''})[0];
const supplemental = createSprites({manifest: new URL('../sprites2/sprites2.json', import.meta.url)});
let supplementalReady;
export const groundSpriteStatus = () => supplemental.missing();

// Canonical, immutable bitmaps: size and keys never depend on animation time.
const images = new Map(); let pixels = 0;
export function groundArt(key, side, paint) {
  if (typeof OffscreenCanvas === 'undefined') return null;
  if (images.has(key)) return images.get(key);
  const [width, height] = Array.isArray(side) ? side : [side, side];
  while (images.size && (pixels + width * height > 8e6 || images.size >= 96)) {
    const oldest = images.keys().next().value, image = images.get(oldest);
    pixels -= image.width * image.height; image.close?.(); images.delete(oldest);
  }
  const canvas = new OffscreenCanvas(width, height), g = canvas.getContext('2d', {willReadFrequently: true});
  g.translate(width / 2, height / 2); paint(g);
  const bitmap = canvas.transferToImageBitmap(); images.set(key, bitmap); pixels += width * height; return bitmap;
}
export const groundCacheStats = () => ({entries: images.size, pixels, limit: 8e6});
export function drawArt(g, art, x, y, side, fallback) {
  const [width, height] = Array.isArray(side) ? side : [side, side];
  if (art) g.drawImage(art, x - width / 2, y - height / 2, width, height);
  else { g.save(); g.translate(x, y); fallback(g); g.restore(); }
}

export const groundParams = {
  at: {default: null}, path: {type: 'object', default: null},
  heading: {default: 'auto'}, scale: {type: 'number', default: 1, min: .2, max: 4, step: .05},
  length: {type: 'number', default: 154, min: 40, max: 360, step: 2},
  flag: {type: 'string', default: 'IQ'}, label: {type: 'string', default: ''},
  dust: {type: 'boolean', default: true}, tracks: {type: 'boolean', default: true},
  particles: {type: 'number', default: 14, min: 0, max: 48, step: 1},
  seed: {default: 1},
};

// Path distance in Mercator. Convoy members sample the same curve by distance,
// including its initial tangent behind the first waypoint, never by time delay.
export function prepareGroundMotion(item, ctx) {
  const motion = prepareMotion(item.path ? {...item, path: {...item.path, curve: item.path.curve || 'smooth'}} : item, ctx), path = motion.path;
  if (!path) return {...motion, total: 0, duration: 0};
  const duration = pathDuration(path), linear = Object.freeze({...path, t: 0, dur: 1, ease: 'linear'});
  let total = 0, previous;
  for (let i = 0; i <= 256; i++) {
    const q = pathAt(linear, i / 256), m = mercator(q.lon, q.lat);
    if (previous) { let dx = m[0] - previous[0]; dx -= Math.round(dx); total += Math.hypot(dx, m[1] - previous[1]); }
    previous = m;
  }
  return {...motion, total, duration, linear};
}
export function groundDistance(motion, t) {
  if (!motion.path) return 0;
  const elapsed = t - (motion.path.t ?? 0), raw = motion.duration === 0 ? +(elapsed >= 0) : clamp(elapsed / motion.duration);
  return clamp(ease(motion.path.ease ?? 'linear', raw)) * motion.total;
}
export function groundPoseAtDistance(motion, item, distance) {
  if (!motion.path || motion.total < 1e-12) return poseAt(motion, item, 0);
  const u = distance / motion.total, q = pathAt(motion.linear, clamp(u));
  if (u < 0 || u > 1) {
    const m = mercator(q.lon, q.lat), extra = (u < 0 ? u : u - 1) * motion.total, a = q.heading * RAD;
    [q.lon, q.lat] = unmercator(m[0] + Math.sin(a) * extra, m[1] - Math.cos(a) * extra);
  }
  if (item.heading != null && item.heading !== 'auto') q.heading = item.heading;
  return q;
}
export function groundScreenPose(pose, view) {
  const p = view.project(pose.lon, pose.lat), a = pose.heading * RAD;
  const tip = view.project(pose.lon + Math.sin(a) * .001 / Math.max(.05, Math.cos(pose.lat * RAD)), pose.lat + Math.cos(a) * .001);
  return {...pose, ...p, angle: Math.atan2(tip.x - p.x, p.y - tip.y)};
}
const worldScale = view => view.scale || Math.hypot(view.mercatorToScreen?.[0] || 512 * 2 ** view.zoom, view.mercatorToScreen?.[1] || 0);
export function groundMemberPoses(s, view, env) {
  const {item, internal, t} = s, motion = internal.motion, distance = groundDistance(motion, t);
  const members = internal.members || [item], gap = (item.spacing ?? 100) * (env.U || 1) * (item.scale ?? 1) / worldScale(view);
  return members.map((member, index) => {
    const d = distance - index * gap, q = motion.path ? groundPoseAtDistance(motion, member, d) : poseAt(motion, member, t);
    return {item: member, distance: d, pose: groundScreenPose(q, view), index};
  });
}

export function fireTimes(item, ctx) {
  const events = (item.fire || []).map(value => time(value, ctx, NaN));
  if (item.state === 'fire') events.push(time(item.t, ctx, 0));
  for (const state of item.states || []) if (state.state === 'fire') events.push(time(state.at, ctx, NaN));
  return [...new Set(events)].sort((a, b) => a - b);
}
export function shotEnvelope(events, t) {
  let recoil = 0, flash = 0;
  for (const at of events) {
    const age = t - at;
    if (age >= 0 && age < .5) recoil = Math.max(recoil, Math.exp(-age * 9) * Math.sin(Math.min(1, age / .045) * Math.PI / 2));
    if (age >= 0 && age < .16) flash = Math.max(flash, 1 - age / .16);
  }
  return {recoil, flash};
}
export function validateGround(item, ctx = {}) {
  const errors = motionErrors(item, ctx, {variants: GROUND_TYPES[item.type] && Object.keys(GROUND_TYPES[item.type]), states: [...GROUND_STATES, 'fire']});
  for (const [key, lo, hi] of [['length', 40, 360], ['scale', .2, 4], ['particles', 0, 48], ['count', 1, 40], ['spacing', 30, 300], ['turretHeading', -180, 180], ['flightDur', .1, 30]]) {
    if (item[key] != null && (!Number.isFinite(item[key]) || item[key] < lo || item[key] > hi)) errors.push(`${key}: requiere ${lo}..${hi}`);
  }
  for (const key of ['count', 'particles']) if (item[key] != null && !Number.isInteger(item[key])) errors.push(`${key}: requiere entero`);
  if (item.fire != null && !Array.isArray(item.fire)) errors.push('fire: requiere array de tiempos');
  else for (const value of item.fire || []) {const at = time(value, ctx, NaN);if (!Number.isFinite(at) || at < 0) errors.push(`fire: tiempo no resuelto ${value}`);}
  if (item.type === 'ground.launcher' && (item.state === 'fire' || item.fire?.length || item.states?.some(s => s.state === 'fire'))) {
    const target = place(item.to, ctx);
    if (!target || target.length !== 2 || !target.every(Number.isFinite) || Math.abs(target[0]) > 180 || Math.abs(target[1]) > 90) errors.push('to: el lanzador requiere destino de misil válido');
  }
  if (item.seed != null && (typeof item.seed !== 'string' && !Number.isFinite(item.seed))) errors.push('seed: requiere texto o número finito');
  if (item.type === 'ground.convoy') {
    if (!item.path) errors.push('convoy requiere path');
    if (!Array.isArray(item.vehicles) || !item.vehicles.length) errors.push('vehicles: requiere lista de tipos terrestres');
    else for (const value of item.vehicles) {
      const member = groundMember(value);
      if (!GROUND_TYPES[member.type]) errors.push(`vehículo desconocido: ${member.type}`);
      else errors.push(...validateGround(member, ctx));
    }
  }
  return errors;
}
export function groundMember(value) {
  if (value && typeof value === 'object') return {...value};
  const [raw, variant] = String(value).split(':'); return {type: raw.startsWith('ground.') ? raw : `ground.${raw}`, ...(variant ? {variant} : {})};
}
export async function prepareGround(item, ctx = {}) {
  await ctx.loadSprites?.();
  await (supplementalReady ||= supplemental.load());
  const motion = prepareGroundMotion(item, ctx), events = fireTimes(item, ctx), effects = [], launches = [];
  for (const type of ['fx.fire', 'fx.smoke']) {
    const def = Tactico.get(type); if (!def) continue;
    const child = {id: `${item.id}:${type}`, type, at: motion.at, t: motion.start, dur: (item.dur ?? 12) + 1,
      size: Math.min(260, (type === 'fx.fire' ? 75 : 85) * (item.scale ?? 1)), particles: type === 'fx.fire' ? 20 : 18, seed: item.seed ?? item.id};
    effects.push({def, item: child, internal: await def.prepare?.(child, ctx)});
  }
  const missile = Tactico.get('strike.missile');
  if (item.type === 'ground.launcher' && missile) for (const at of events) {
    const source = poseAt(motion, item, at), child = {id: `${item.id}:missile:${at}`, type: 'strike.missile',
      from: [source.lon, source.lat], to: place(item.to, ctx), t: at, flightDur: item.flightDur ?? 1.8,
      dur: (item.flightDur ?? 1.8) + 1.5, particles: 40, onHit: {size: 48, particles: 16, dur: 1.5}, seed: item.seed ?? item.id};
    launches.push({def: missile, item: child, internal: await missile.prepare?.(child, ctx)});
  }
  const internal = {motion, events, effects, launches};
  if (item.type === 'ground.convoy') {
    const list = item.vehicles || ['tank:main', 'apc', 'truck:cargo', 'truck:fuel', 'ambulance:cross'];
    internal.members = Array.from({length: item.count ?? list.length}, (_, i) => ({...item, ...groundMember(list[i % list.length]),
      id: `${item.id}:${i}`, label: '', scale: (item.scale ?? 1) * (typeof list[i % list.length] === 'object' ? list[i % list.length].scale ?? 1 : 1)}));
    internal.children = [];
    for (const member of internal.members) internal.children.push(await prepareGround({...member, path: null}, ctx));
  }
  return internal;
}

function gradient(g, a, b, x = 38) {
  const grad = g.createLinearGradient(-x, -x, x, x); grad.addColorStop(0, a); grad.addColorStop(.18, b); grad.addColorStop(.4, b); grad.addColorStop(.65, a); grad.addColorStop(1, a); return grad;
}
function rect(g, x, y, w, h, fill, stroke, radius = 3) {
  g.beginPath(); g.roundRect(x, y, w, h, radius); g.fillStyle = fill; g.fill();
  if (stroke) {g.strokeStyle = stroke; g.lineWidth = 2; g.stroke();}
}
function round(g, x, y, r, fill, stroke) {
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = fill; g.fill();
  if (stroke) {g.strokeStyle = stroke; g.lineWidth = 2; g.stroke();}
}
const tracked = item => item.type === 'ground.tank' || item.type === 'ground.artillery' && item.variant === 'self';
function hullArt(g, item, c) {
  const tank = tracked(item), truck = ['ground.truck', 'ground.launcher', 'ground.ambulance'].includes(item.type), ambulance = item.type === 'ground.ambulance';
  const width = tank ? (item.variant === 'light' ? 55 : 68) : truck ? 59 : 54;
  const body = ambulance ? c.light : c.gray, metal = gradient(g, c.smoke, body);
  g.lineJoin = 'round';
  // Baked penumbra + contact shadow, then visible side walls and top armour.
  g.save(); g.translate(7, 9); g.fillStyle = c.dark; g.globalAlpha = .25;
  g.beginPath(); g.roundRect(-width / 2 - 7, -79, width + 17, 158, 13); g.fill(); g.globalAlpha = .45;
  g.beginPath(); g.roundRect(-width / 2, -74, width + 5, 150, 8); g.fill(); g.restore();
  if (tank) {
    for (const x of [-width / 2, width / 2 - 13]) {
      rect(g, x - 5, -77, 19, 153, c.dark, c.smoke, 7);
      for (let y = -65; y < 73; y += 17) rect(g, x - 2, y, 13, 7, c.smoke, null, 1);
      rect(g, x + 2, -71, 4, 139, c.gray, null, 2);
    }
  } else {
    for (const y of (truck ? [-53, 32, 58] : [-45, 44])) for (const sign of [-1, 1]) {
      rect(g, sign * (width / 2 + 2) - 7, y - 14, 14, 28, c.dark, c.smoke, 4);
      rect(g, sign * (width / 2 + 2) - 3, y - 9, 6, 18, c.smoke, null, 2);
    }
  }
  if (item.type === 'ground.artillery' && item.variant === 'towed') {
    rect(g, -8, -62, 16, 90, metal, c.dark);
    for (const sign of [-1, 1]) {
      rect(g, sign * 38 - 9, -10, 18, 40, c.dark, c.gray, 5);
      polygon(g, [[sign * 8, 12], [sign * 43, 74], [sign * 31, 80], [sign * 2, 25]]); g.fillStyle = c.gray; g.fill(); g.strokeStyle = c.dark; g.stroke();
    }
    polygon(g, [[-32, -24], [32, -24], [27, 14], [-27, 14]]); g.fillStyle = metal; g.fill(); g.stroke(); round(g, 0, 2, 18, c.smoke, c.dark); return;
  }
  const top = tank ? -62 : -70, height = tank ? 127 : 138;
  rect(g, -width / 2 + 7, top + 5, width - 11, height, c.dark, c.dark, 6);
  rect(g, -width / 2 + 5, top, width - 10, height - 4, metal, c.dark, 6);
  g.strokeStyle = c.light; g.lineWidth = 1.4; g.globalAlpha = .65;
  g.beginPath(); g.moveTo(-width / 2 + 8, top + height - 14); g.lineTo(-width / 2 + 8, top + 7); g.lineTo(width / 2 - 8, top + 7); g.stroke(); g.globalAlpha = 1;
  if (tank) {
    rect(g, -20, 30, 40, 25, c.smoke, c.dark);
    g.strokeStyle = c.dark; g.lineWidth = 2;
    for (let y = 34; y < 54; y += 4) {g.beginPath();g.moveTo(-16, y);g.lineTo(16, y);g.stroke();}
    rect(g, -22, -55, 44, 28, gradient(g, c.gray, c.light), c.dark, 4);
    for (const sign of [-1, 1]) rect(g, sign * 24 - 3, -57, 6, 10, c.gold, c.dark, 1);
    // Raised side armour and bolts catch the same upper-left key light.
    for (const sign of [-1, 1]) for (let y = -45; y < 60; y += 23) {
      rect(g, sign * 24 - 4, y, 8, 19, gradient(g, c.smoke, c.gray), c.dark, 1);
      round(g, sign * 24 - 1, y + 3, 1.1, c.light);
    }
  } else if (item.type === 'ground.apc') {
    polygon(g, [[-21, -64], [21, -64], [26, -35], [-26, -35]]);g.fillStyle = c.gray;g.fill();g.strokeStyle = c.dark;g.stroke();
    for (const x of [-12, 12]) rect(g, x - 7, -51, 14, 11, c.dark, c.gray, 2);
    round(g, 0, 5, 17, gradient(g, c.light, c.gray), c.dark);round(g, 0, 5, 9, c.smoke, c.dark);rect(g, -3, -24, 6, 28, c.gray, c.dark, 1);
    for (let y = 26; y <= 55; y += 14) rect(g, -18, y, 36, 10, c.smoke, c.dark, 2);
  } else {
    rect(g, -24, -67, 48, 38, gradient(g, c.gray, ambulance ? c.light : c.gray), c.dark, 4);
    rect(g, -20, -59, 40, 13, gradient(g, c.dark, c.blue), c.dark, 2);
    g.strokeStyle = c.gray;g.lineWidth = 2;g.beginPath();g.moveTo(0, -59);g.lineTo(0, -46);g.stroke();
    for (const x of [-20, 20]) rect(g, x - 3, -71, 6, 5, c.gold, c.dark, 1);
    if (item.type === 'ground.truck' && item.variant === 'fuel') {
      rect(g, -24, -23, 48, 87, gradient(g, c.smoke, c.light), c.dark, 18);
      for (const y of [-9, 43]) rect(g, -25, y, 50, 5, c.smoke, c.gray, 1);
      round(g, 0, 15, 9, c.gray, c.dark);rect(g, -4, 8, 8, 3, c.light);
    } else if (item.type === 'ground.launcher') {
      rect(g, -26, -24, 52, 85, c.dark, c.gray, 4);
      for (const x of [-17, 0, 17]) rect(g, x - 7, -27, 14, 81, gradient(g, c.smoke, c.gray), c.dark, 4);
      rect(g, -26, 45, 52, 9, c.light, c.dark, 1);
    } else if (ambulance) {
      rect(g, -25, -27, 50, 89, gradient(g, c.gray, c.light), c.dark, 5);
      rect(g, -24, 40, 48, 9, c.red, null, 0);
      if (item.variant === 'crescent') {
        g.fillStyle = c.red;g.beginPath();g.arc(0, 6, 16, .35 * Math.PI, 1.65 * Math.PI);g.arc(7, 6, 13, 1.7 * Math.PI, .3 * Math.PI, true);g.closePath();g.fill();
      } else {rect(g, -6, -13, 12, 37, c.red, null, 1);rect(g, -18, 0, 36, 12, c.red, null, 1);}
    } else if (item.type === 'ground.jeep') {
      rect(g, -21, -22, 42, 56, c.dark, c.gray);rect(g, -18, -19, 15, 23, c.smoke, c.gray);rect(g, 3, -19, 15, 23, c.smoke, c.gray);
      rect(g, -25, 27, 50, 7, c.gray, c.dark);round(g, 0, 53, 17, c.dark, c.gray);round(g, 0, 53, 8, c.smoke, c.dark);
    } else {
      rect(g, -25, -26, 50, 91, gradient(g, c.smoke, c.gray), c.dark, 7);
      for (let y = -15; y < 61; y += 17) {g.strokeStyle = c.light;g.globalAlpha = .3;g.beginPath();g.moveTo(-21, y + 3);g.quadraticCurveTo(0, y - 4, 21, y + 3);g.stroke();g.globalAlpha = 1;}
      rect(g, -21, 57, 42, 7, c.smoke, c.dark, 1);
    }
    for (const x of [-20, 20]) rect(g, x - 3, 65, 6, 4, c.red, c.dark, 1);
    rect(g, -34, -43, 7, 7, c.gray, c.dark, 1);rect(g, 27, -43, 7, 7, c.gray, c.dark, 1);
  }
}
function turretArt(g, item, c) {
  const artillery = item.type === 'ground.artillery', light = item.variant === 'light';
  g.save();g.translate(3, 5);round(g, 0, 0, light ? 21 : 27, c.dark);g.restore();
  rect(g, -5, artillery ? -104 : -95, 10, artillery ? 106 : 89, gradient(g, c.smoke, c.gray), c.dark, 2);
  rect(g, -7, artillery ? -105 : -97, 14, 10, c.smoke, c.dark, 2);
  polygon(g, [[-23, -20], [19, -24], [28, 1], [20, 28], [-20, 25], [-28, 1]]);
  g.fillStyle = gradient(g, c.smoke, c.gray);g.fill();g.strokeStyle = c.dark;g.lineWidth = 2.5;g.stroke();
  g.strokeStyle = c.light;g.globalAlpha = .7;g.lineWidth = 1.3;g.beginPath();g.moveTo(-24, 0);g.lineTo(-20, -17);g.lineTo(17, -21);g.stroke();g.globalAlpha = 1;
  round(g, -6, 3, 11, c.smoke, c.dark);round(g, -8, 0, 8, c.gray, c.dark);
  rect(g, 13, -5, 7, 18, c.smoke, c.dark, 1);rect(g, -16, -17, 25, 4, c.light);
  g.strokeStyle = c.dark;g.lineWidth = 1;g.beginPath();g.moveTo(20, 20);g.lineTo(25, 48);g.stroke();
}

function spriteFor(item, env) {
  const name = GROUND_TYPES[item.type]?.[item.variant || firstVariant(item.type)];
  const candidates = [name, ...(item.type === 'ground.ambulance' && item.variant !== 'crescent' ? ['ambulance-cross'] : [])];
  for (const candidate of candidates) for (const store of [env, supplemental]) {
    const record = store.sprite?.(candidate);if (record?.available) return record;
  }
  return null;
}
function dustImage(c) {
  return groundArt(`dust:${c.gold}:${c.dark}`, 96, g => {
    const grad = g.createRadialGradient(-6, -8, 0, 0, 0, 47);grad.addColorStop(0, c.gold);grad.addColorStop(.35, c.gray);grad.addColorStop(1, 'transparent');
    g.fillStyle = grad;g.fillRect(-48, -48, 96, 96);
  });
}
export function groundActivity(motion, t, view, U = 1) {
  if (!motion?.path || !motion.total) return 0;
  return clamp(Math.abs(groundDistance(motion, t) - groundDistance(motion, t - .08)) * worldScale(view) / (2 * U));
}
export function drawDust(g, s, view, env, pose, distance, amount = 1) {
  const item = s.item, U = env.U || 1, c = ink(env), image = dustImage(c), motion = s.internal.motion;
  if (!image || item.dust === false || !motion?.path || !motion.total) return;
  if (amount < .001 || s.t < motion.path.t || s.t > motion.path.t + motion.duration + 1.5) return;
  const random = (env.rng || rng)(`${item.seed ?? item.id}:dust`), count = item.particles ?? 14, L = (item.length ?? 154) * U * (item.scale ?? 1);
  g.save();
  for (let i = 0; i < count; i++) {
    const phase = random(), side = random() * 2 - 1, drift = random(), life = .7 + random() * .8;
    const age = ((s.t - motion.start) / life + phase) % 1;
    const born = s.t - age * life;if (born < motion.path.t) continue;
    const active = groundActivity(motion, born, view, U) * amount;if (active < .001) continue;
    const prior = groundPoseAtDistance(motion, item, distance - (groundDistance(motion, s.t) - groundDistance(motion, born))), q = groundScreenPose(prior, view);
    const a = q.angle, back = L * (.42 + age * .28), spread = L * (.15 + age * .3) * side;
    const x = q.x + spread * Math.cos(a) - back * Math.sin(a), y = q.y + spread * Math.sin(a) + back * Math.cos(a);
    const size = L * (.17 + age * .48) * (.8 + drift * .4);
    g.globalAlpha = s.alpha === 0 ? 0 : active * .26 * Math.sin(age * Math.PI) ** 2 * (s._alpha ?? 1);
    g.drawImage(image, x - size / 2, y - size / 2, size, size);
  }
  g.restore();
}
function drawTracks(g, s, view, env, distance) {
  const item = s.item, motion = s.internal.motion;
  if (item.tracks === false || !motion?.path || !motion.total) return;
  const U = env.U || 1, L = (item.length ?? 154) * U * (item.scale ?? 1), step = Math.max(4, L * .07), scale = worldScale(view);
  const end = Math.floor((distance * scale - L * .42) / step) * step;
  const start = (distance - groundDistance(motion, s.t)) * scale - L * .42;
  g.save();g.strokeStyle = ink(env).dark;g.lineWidth = Math.max(1, L * .014);const alpha = g.globalAlpha;
  for (let i = 0; i < 28; i++) {
    const d = end - i * step;if (d < start) break;
    const q = groundScreenPose(groundPoseAtDistance(motion, item, d / scale), view);
    g.globalAlpha = alpha * .30 * (1 - i / 28);const cos = Math.cos(q.angle), sin = Math.sin(q.angle);
    g.beginPath();
    for (const sign of [-1, 1]) {const a = sign * L * .15 - L * .035, b = sign * L * .15 + L * .035;g.moveTo(q.x + a * cos, q.y + a * sin);g.lineTo(q.x + b * cos, q.y + b * sin);}g.stroke();
  }
  g.restore();
}

const fxSources = new WeakMap(), fxProxies = new WeakMap();
export function stableGroundContext(g) {
  if (fxProxies.has(g)) return fxProxies.get(g);
  const bound = new Map(), proxy = new Proxy(g, {
    get(target, key) {
      if (key === 'drawImage') return (source, ...args) => {
        if (typeof OffscreenCanvas !== 'undefined' && source instanceof OffscreenCanvas) {
          if (!fxSources.has(source)) {
            const copy = new OffscreenCanvas(source.width, source.height), cg = copy.getContext('2d', {willReadFrequently: true});
            cg.putImageData(source.getContext('2d').getImageData(0, 0, source.width, source.height), 0, 0);fxSources.set(source, copy.transferToImageBitmap());
          }
          source = fxSources.get(source);
        }
        target.drawImage(source, ...args);
      };
      const value = Reflect.get(target, key, target);
      if (typeof value !== 'function') return value;
      if (!bound.has(key)) bound.set(key, value.bind(target));return bound.get(key);
    }, set(target, key, value) {return Reflect.set(target, key, value, target);},
  });
  fxProxies.set(g, proxy);return proxy;
}
export function drawGroundVehicle(g, s, view, env, override) {
  const item = s.item, p = override || screenPose({...s, internal: s.internal.motion}, view), c = ink(env), U = env.U || 1;
  const L = (item.length ?? 154) * U * (item.scale ?? 1), factor = L / 200, w = stateWeights(s, [...GROUND_STATES, 'fire']);
  const distance = override?.distance ?? groundDistance(s.internal.motion, s.t), shot = shotEnvelope(s.internal.events || [], s.t);
  const sprite = item.turretHeading ? null : spriteFor(item, env), turret = tracked(item) || item.type === 'ground.artillery';
  drawTracks(g, s, view, env, distance);drawDust(g, {...s, _alpha: g.globalAlpha}, view, env, p, distance, 1 - w.destroyed);
  g.save();g.translate(p.x, p.y);g.rotate(p.angle);g.scale(factor, factor);
  if (sprite) sprite.draw(g, 0, shot.recoil * 4, {length: 200, state: w.destroyed > .5 ? 'destroyed' : 'normal', shadow: true, shadowOffset: [5, 8]});
  else {
    const key = `hull:${item.type}:${item.variant}:${JSON.stringify(c)}`, art = groundArt(key, [128, 192], ctx => hullArt(ctx, item, c));
    drawArt(g, art, 0, 0, [128, 192], ctx => hullArt(ctx, item, c));
    if (turret) {
      g.save();g.rotate((item.turretHeading ?? 0) * RAD);g.translate(0, shot.recoil * 9);
      const art = groundArt(`turret:${item.type}:${item.variant}:${JSON.stringify(c)}`, [96, 224], ctx => turretArt(ctx, item, c));
      drawArt(g, art, 0, -2, [96, 224], ctx => turretArt(ctx, item, c));g.restore();
    }
  }
  // Running gear and beacons stay live with either artwork source.
  g.save();g.strokeStyle = c.gray;g.lineWidth = 2;g.globalAlpha *= .6;
  const phase = ((distance * worldScale(view) / factor) % 13 + 13) % 13;
  g.beginPath();
  for (const sign of [-1, 1]) for (let y = -66 + phase; y < 70; y += 13) {
    if (!tracked(item) && ![-53, -40, 32, 45, 58, 71].some(v => Math.abs(v - y) < 7)) continue;
    g.moveTo(sign * 31 - 4, y);g.lineTo(sign * 31 + 4, y);
  }
  g.stroke();g.restore();
  if (item.type === 'ground.ambulance') for (const sign of [-1, 1]) {
    const pulse = .18 + .82 * Math.max(0, Math.sin(s.t * 9 + (sign > 0 ? Math.PI : 0))) ** 3;
    g.save();g.globalAlpha *= pulse;round(g, sign * 16, -30, 6, sign < 0 ? c.red : c.blue, c.dark);g.restore();
  }
  if (w.destroyed > 0 || w.burning > 0) {
    g.save();g.globalAlpha *= clamp(w.destroyed + w.burning * .45) * .8;
    if (sprite) sprite.draw(g, 0, 0, {length: 200, state: 'destroyed', shadow: false});
    else {
      const art = groundArt(`charred:${item.type}:${item.variant}:${item.turretHeading || 0}:${JSON.stringify(c)}`, [128, 240], ctx => {
        hullArt(ctx, item, c);if (turret) {ctx.save();ctx.rotate((item.turretHeading ?? 0) * RAD);ctx.translate(0, -2);turretArt(ctx, item, c);ctx.restore();}
        ctx.globalCompositeOperation = 'source-atop';ctx.fillStyle = c.smoke;ctx.fillRect(-144, -144, 288, 288);
      });
      if (art) g.drawImage(art, -64, -120, 128, 240);
    }
    g.strokeStyle = c.dark;g.lineWidth = 3;g.beginPath();g.moveTo(-19, -34);g.lineTo(8, -18);g.lineTo(-7, 3);g.lineTo(20, 20);g.stroke();g.restore();
  }
  if (w.hit > .001) {g.save();g.globalAlpha *= w.hit * (.35 + .3 * Math.sin(s.t * 23) ** 2);rect(g, -28, -62, 56, 126, c.gold, null, 5);g.restore();}
  if (shot.flash > 0) {
    g.save();g.rotate((item.turretHeading ?? 0) * RAD);g.translate(0, -107);g.globalAlpha *= shot.flash;
    polygon(g, [[-7, 4], [-16, -16], [-5, -12], [0, -38], [7, -12], [18, -18], [8, 4]]);g.fillStyle = c.fire;g.fill();
    polygon(g, [[-5, 1], [0, -25], [6, 1]]);g.fillStyle = c.gold;g.fill();g.restore();
  }
  g.restore();
  if (item.label) text(g, item.label, p.x, p.y + L * .61, 20 * U, env, c.light);
  if (w.burning > .001) {
    // Clip compositing to the effect footprint on a software renderer.
    g.save();g.globalAlpha *= w.burning;g.beginPath();g.rect(p.x - L * 1.2, p.y - L * 1.8, L * 2.4, L * 2.8);g.clip();
    for (const fx of s.internal.effects || []) fx.def.draw(stableGroundContext(g), {...s, item: fx.item, internal: fx.internal,
      lt: s.t - fx.item.t, pos: {lon: p.lon, lat: p.lat}}, view, env);
    g.restore();
  }
}
function paintGroundFlag(g, flag, x, y, size, t, env) {
  const c = ink(env), source = env.flag?.(flag), image = source?.image || source?.bitmap || source;
  g.save();g.translate(x, y);g.strokeStyle = c.dark;g.lineWidth = size * .085;g.beginPath();g.moveTo(0, 0);g.lineTo(0, -size * 1.35);g.stroke();
  g.strokeStyle = c.light;g.lineWidth = size * .025;g.stroke();
  // Subdivide the cloth into strips; both edges wave continuously.
  const palettes = {IQ: ['#ce1126', '#ffffff', '#000000'], IR: ['#239f40', '#ffffff', '#da0000'], RU: ['#ffffff', '#0039a6', '#d52b1e'], UA: ['#0057b7', '#ffd700'], FR: ['#0055a4', '#ffffff', '#ef4135'], US: ['#b22234', '#ffffff', '#b22234', '#ffffff', '#b22234', '#ffffff']};
  const colors = palettes[flag] || [c.blue, c.light, c.blue], strips = 12;
  for (let i = 0; i < strips; i++) {
    const u = i / strips, wave = Math.sin(u * 5 - t * 3) * size * .07 * u, x = u * size, y = -size * 1.35 + wave;
    if (image?.width || image?.naturalWidth) g.drawImage(image, u * (image.width || image.naturalWidth), 0, (image.width || image.naturalWidth) / strips, image.height || image.naturalHeight, x, y, size / strips + .5, size * .63);
    else colors.forEach((color, j) => {g.fillStyle = color;g.fillRect(x, y + j * size * .63 / colors.length, size / strips + .5, size * .63 / colors.length + .3);});
    g.fillStyle = c.dark;g.save();g.globalAlpha *= .12 + .13 * Math.sin(u * 5 - t * 3);g.fillRect(x, y, size / strips + .5, size * .63);g.restore();
  }
  g.restore();
}
const flagFrames = new Map();
export function drawGroundFlag(g, flag, x, y, size, t, env) {
  if (typeof OffscreenCanvas === 'undefined') {paintGroundFlag(g, flag, x, y, size, t, env);return;}
  const source = env.flag?.(flag), key = `${flag}:${source?.src || source?.image?.src || ''}:${JSON.stringify(ink(env))}`;
  let record = flagFrames.get(key);
  if (!record || record.t !== t) {
    if (flagFrames.size >= 16 && !flagFrames.has(key)) {const first = flagFrames.keys().next().value;flagFrames.get(first).image.close?.();flagFrames.delete(first);}
    record?.image.close?.();
    const canvas = new OffscreenCanvas(104, 128), fg = canvas.getContext('2d', {willReadFrequently: true});
    paintGroundFlag(fg, flag, 8, 124, 80, t, env);record = {t, image: canvas.transferToImageBitmap()};flagFrames.set(key, record);
  }
  g.drawImage(record.image, x - 8 * size / 80, y - 124 * size / 80, 104 * size / 80, 128 * size / 80);
}
function drawGround(g, s, view, env) {
  if (s.item.type === 'ground.convoy') {
    const members = groundMemberPoses(s, view, env);
    for (const m of [...members].reverse()) drawGroundVehicle(g, {...s, item: m.item, stateWeights: s.stateWeights,
      internal: {...s.internal.children[m.index], motion: s.internal.motion}}, view, env, {...m.pose, distance: m.distance});
    if (members.length && s.item.flag) {
      const p = members[0].pose, U = (env.U || 1) * (s.item.scale ?? 1);
      drawGroundFlag(g, s.item.flag, p.x + 27 * U, p.y - 18 * U, 35 * U, s.t, env);
    }
    if (s.item.label && members.length) text(g, s.item.label, members[0].pose.x, members[0].pose.y - 100 * (env.U || 1), 22 * (env.U || 1), env);
  } else drawGroundVehicle(g, s, view, env);
  for (const launch of s.internal.launches || []) if (s.t >= launch.item.t && s.t < launch.item.t + launch.item.dur) {
    g.save();launch.def.draw(stableGroundContext(g), {...s, item: launch.item, internal: launch.internal, lt: s.t - launch.item.t}, view, env);g.restore();
  }
}
for (const type of [...Object.keys(GROUND_TYPES), 'ground.convoy']) {
  const armed = ['ground.artillery', 'ground.launcher', 'ground.tank'].includes(type), variants = Object.keys(GROUND_TYPES[type] || {});
  Tactico.component(type, {
    layer: 30, summary: ({'ground.tank': 'Tanque con casco, orugas, torreta orientable y retroceso; principal o ligero.',
      'ground.apc': 'Blindado de ruedas con escotilla, sombra, polvo y huellas.', 'ground.truck': 'Camión militar de lona o cisterna, con rodadura animada.',
      'ground.jeep': 'Vehículo ligero abierto con rueda de repuesto y sombra.', 'ground.artillery': 'Obús remolcado o autopropulsado con fogonazo y retroceso programados.',
      'ground.launcher': 'Lanzador sobre camión; cada fire prepara un strike.missile hacia to.', 'ground.ambulance': 'Ambulancia con cruz o media luna, balizas alternas y rumbo de ruta.',
      'ground.convoy': 'Columna mixta que recorre una curva por distancia con separación y bandera líder.'})[type],
    params: {...groundParams, ...(variants.length > 1 ? {variant: {type: 'enum', values: variants, default: variants[0]}} : {}),
      ...(armed ? {fire: {type: 'array', default: []}, turretHeading: {type: 'number', default: 0, min: -180, max: 180, step: 1}} : {}),
      ...(type === 'ground.launcher' ? {to: {default: null}, flightDur: {type: 'number', default: 1.8, min: .1, max: 30, step: .1}} : {}),
      ...(type === 'ground.convoy' ? {count: {type: 'number', default: 6, min: 1, max: 40, step: 1}, spacing: {type: 'number', default: 110, min: 30, max: 300, step: 2},
        vehicles: {type: 'array', default: ['tank:main', 'apc', 'truck:cargo', 'truck:fuel', 'jeep', 'ambulance:cross']}, length: {type: 'number', default: 110, min: 40, max: 360, step: 2}} : {})},
    states: [...GROUND_STATES, ...(armed ? ['fire'] : [])], validate: validateGround, prepare: prepareGround, draw: drawGround,
    demo: {id: type.replace('.', '-'), type, at: [48.4, 31.1], t: 0, dur: 8, fade: .6, flag: 'IQ', ...(variants.length ? {variant: variants[0]} : {}),
      path: {via: [[48.3, 31.0], [48.42, 31.13], [48.65, 31.22]], t: .6, dur: 6.5, curve: 'smooth', ease: 'inOut'},
      ...(armed ? {fire: [2.2, 4.4]} : {}), ...(type === 'ground.launcher' ? {to: [49.02, 31.55]} : {}),
      ...(type === 'ground.convoy' ? {count: 6, length: 92, spacing: 98} : {}), label: '', seed: 17},
  });
}
Tactico.component('fx.dust', {
  layer: 29, summary: 'Polvo determinista detrás de una ruta terrestre, con emisión proporcional al movimiento.',
  params: {...groundParams}, states: [], validate: (item, ctx) => validateGround(item, ctx),
  prepare: (item, ctx) => ({motion: prepareGroundMotion(item, ctx)}),
  draw(g, s, view, env) {drawDust(g, {...s, _alpha: g.globalAlpha}, view, env, screenPose({...s, internal: s.internal.motion}, view), groundDistance(s.internal.motion, s.t));},
  demo: {id: 'ground-dust', type: 'fx.dust', at: [48.4, 31.1], t: 0, dur: 8, length: 210, particles: 36, seed: 4,
    path: {via: [[48.2, 31], [48.4, 31.1], [48.6, 31.3]], t: 0, dur: 7, curve: 'smooth'}},
});
