import {Tactico} from '../core.js';
import {rng} from '../util.js';
import {clamp, smooth, RAD, ink, text, polygon, stateWeights, motionErrors} from './units.js';
import {groundArt, drawArt, groundParams, prepareGroundMotion, groundDistance, groundScreenPose, groundPoseAtDistance,
  drawGroundFlag, prepareGround, drawGroundVehicle} from './ground.js';

export const ARMY_STATES = ['normal', 'engaged', 'routed', 'destroyed'];
const names = ['army.advance', 'army.retreat', 'army.hold', 'army.encircle', 'army.clash', 'army.banner', 'army.supply'];
const TAU = Math.PI * 2;
export const armyParams = {
  at: groundParams.at, path: groundParams.path, heading: groundParams.heading, flag: groundParams.flag,
  scale: {type: 'number', default: 1, min: .35, max: 2.5, step: .05},
  count: {type: 'number', default: 24, min: 8, max: 40, step: 1},
  columns: {type: 'number', default: 6, min: 2, max: 10, step: 1},
  spacing: {type: 'number', default: 59, min: 44, max: 100, step: 1},
  radius: {type: 'number', default: 25, min: 16, max: 42, step: 1},
  wave: {type: 'number', default: 5, min: 0, max: 16, step: .5},
  speed: {type: 'number', default: 1.6, min: .1, max: 5, step: .1},
  dust: {type: 'boolean', default: true}, arrow: {type: 'boolean', default: true},
  banner: {type: 'boolean', default: true}, label: {type: 'string', default: 'EJÉRCITO'},
  date: {type: 'string', default: ''}, seed: {default: 23},
};
export function validateArmy(item, ctx) {
  const errors = motionErrors(item, ctx, {states: ARMY_STATES});
  for (const [key, lo, hi] of [['count', 8, 40], ['columns', 2, 10], ['spacing', 44, 100], ['radius', 16, 42],
    ['scale', .35, 2.5], ['wave', 0, 16], ['speed', .1, 5], ['closeDur', .2, 30], ['supplyCount', 2, 12], ['fall', 0, .8]]) {
    if (item[key] != null && (!Number.isFinite(item[key]) || item[key] < lo || item[key] > hi)) errors.push(`${key}: requiere ${lo}..${hi}`);
  }
  for (const key of ['count', 'columns', 'supplyCount']) if (item[key] != null && !Number.isInteger(item[key])) errors.push(`${key}: requiere entero`);
  if (item.radius != null && item.spacing != null && item.spacing < item.radius * 1.9) errors.push('spacing debe ser al menos 1.9 × radius para evitar superposición');
  if (['army.advance', 'army.retreat', 'army.supply'].includes(item.type) && !item.path) errors.push(`${item.type} requiere path`);
  if (item.opponentFlag != null && typeof item.opponentFlag !== 'string') errors.push('opponentFlag debe ser texto');
  return errors;
}
export async function prepareArmy(item, ctx) {
  const internal = {motion: prepareGroundMotion(item, ctx)};
  if (item.type === 'army.supply') {
    internal.truck = {type: 'ground.truck', variant: 'cargo', t: item.t, dur: item.dur, scale: (item.scale ?? 1) * .45,
      length: 104, particles: 5, label: '', flag: item.flag, seed: item.seed, tracks: false};
    internal.vehicle = await prepareGround(internal.truck, ctx);
  }
  return internal;
}
function octagon(g, radius) {
  polygon(g, Array.from({length: 8}, (_, i) => {const a = (i + .5) * Math.PI / 4;return [Math.sin(a) * radius, Math.cos(a) * radius];}));
}
const flagColors = {IQ: ['#ce1126', '#ffffff', '#000000'], IR: ['#239f40', '#ffffff', '#da0000'], RU: ['#ffffff', '#0039a6', '#d52b1e'],
  UA: ['#0057b7', '#ffd700'], FR: ['#0055a4', '#ffffff', '#ef4135'], US: ['#b22234', '#ffffff', '#b22234', '#ffffff', '#b22234', '#ffffff']};
function tokenArt(g, flag, env) {
  const c = ink(env), r = 44;
  g.lineJoin = 'round';
  // Separate penumbra, dark extruded side, bevel, inlaid identity and portrait.
  g.save();g.translate(3, 8);g.globalAlpha = .25;g.fillStyle = c.dark;octagon(g, r * 1.12);g.fill();g.restore();
  g.save();g.translate(1, 4);g.fillStyle = c.dark;octagon(g, r * 1.04);g.fill();g.restore();
  let grad = g.createLinearGradient(-44, -44, 44, 44);grad.addColorStop(0, c.light);grad.addColorStop(.22, c.gold);grad.addColorStop(.6, c.fire);grad.addColorStop(1, c.smoke);
  g.fillStyle = grad;octagon(g, r);g.fill();g.strokeStyle = c.dark;g.lineWidth = 2.4;g.stroke();
  g.save();octagon(g, r - 5);g.clip();
  const source = env.flag?.(flag), image = source?.image || source?.bitmap || source;
  if (image?.width || image?.naturalWidth) g.drawImage(image, -r, -r, r * 2, r * 2);
  else {
    const colors = flagColors[flag] || [c.blue, c.light, c.blue];
    colors.forEach((color, i) => {g.fillStyle = color;g.fillRect(-r, -r + i * r * 2 / colors.length, r * 2, r * 2 / colors.length + 1);});
    if (flag === 'US') {g.fillStyle = '#3c3b6e';g.fillRect(-r, -r, 43, 42);g.fillStyle = '#ffffff';for (let i = 0; i < 12; i++) g.fillRect(-38 + i % 4 * 8, -36 + Math.floor(i / 4) * 10, 3, 3);}
  }
  grad = g.createLinearGradient(0, -44, 0, 44);grad.addColorStop(0, 'transparent');grad.addColorStop(1, c.dark);g.globalAlpha = .5;g.fillStyle = grad;g.fillRect(-44, -44, 88, 88);g.globalAlpha = 1;
  // Helmet, shaded face, collar and vest form a small relief portrait.
  g.fillStyle = c.dark;g.beginPath();g.ellipse(0, 37, 30, 21, 0, Math.PI, 0);g.fill();
  g.fillStyle = c.smoke;polygon(g, [[-25, 37], [-19, 22], [-7, 17], [7, 17], [22, 23], [28, 39]]);g.fill();
  g.fillStyle = c.gray;polygon(g, [[-19, 23], [-8, 26], [8, 26], [20, 22], [16, 39], [-15, 39]]);g.fill();
  grad = g.createLinearGradient(-15, -10, 15, 16);grad.addColorStop(0, c.light);grad.addColorStop(.55, c.gold);grad.addColorStop(1, c.fire);
  g.fillStyle = grad;g.strokeStyle = c.dark;g.lineWidth = 2.2;g.beginPath();g.roundRect(-12, -12, 24, 33, 8);g.fill();g.stroke();
  g.fillStyle = c.dark;g.fillRect(-10, -3, 20, 7);g.fillStyle = c.blue;g.globalAlpha = .55;g.fillRect(-8, -2, 6, 2);g.globalAlpha = 1;
  grad = g.createLinearGradient(-20, -20, 17, 0);grad.addColorStop(0, c.gray);grad.addColorStop(.4, c.green);grad.addColorStop(1, c.smoke);
  g.fillStyle = grad;g.beginPath();g.arc(0, -9, 19, Math.PI, 0);g.lineTo(22, -3);g.lineTo(-22, -3);g.closePath();g.fill();g.stroke();
  g.strokeStyle = c.light;g.globalAlpha = .5;g.lineWidth = 2;g.beginPath();g.arc(-1, -9, 15, 3.5, 4.8);g.stroke();g.globalAlpha = 1;
  g.strokeStyle = c.gold;g.lineWidth = 1.6;g.beginPath();g.moveTo(-12, 30);g.lineTo(12, 30);g.stroke();g.restore();
  g.strokeStyle = c.gold;g.lineWidth = 1.2;octagon(g, r - 5);g.stroke();
  g.strokeStyle = c.light;g.globalAlpha = .8;g.lineWidth = 1.3;g.beginPath();g.moveTo(-39, -16);g.lineTo(-17, -40);g.lineTo(17, -40);g.stroke();g.globalAlpha = 1;
}
export function drawArmyToken(g, flag, x, y, radius, angle, env, alpha = 1) {
  const c = ink(env), src = env.flag?.(flag), key = `army-token:${flag}:${src?.src || src?.image?.src || ''}:${JSON.stringify(c)}`;
  const art = groundArt(key, 112, ctx => tokenArt(ctx, flag, env)), side = radius * 112 / 44;
  g.save();g.globalAlpha *= alpha;g.translate(x, y);g.rotate(angle);
  drawArt(g, art, 0, 0, side, ctx => {ctx.scale(radius / 44, radius / 44);tokenArt(ctx, flag, env);});g.restore();
}
export function armyFormation(s) {
  const item = s.item, n = item.count ?? 24, cols = Math.min(n, item.columns ?? 6), rows = Math.ceil(n / cols), gap = item.spacing ?? 59;
  const t = s.t, speed = item.speed ?? 1.6, wave = item.wave ?? 5, result = [];
  const closing = smooth((s.lt ?? (t - (item.t ?? 0))) / (item.closeDur ?? 5));
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols), col = i % cols, inRow = Math.min(cols, n - row * cols);
    let x = (col - (inRow - 1) / 2) * gap + (row % 2 ? gap * .17 : -gap * .17), y = (row - (rows - 1) / 2) * gap * .91;
    y += Math.sin(t * speed + col * .62 - row * .55) * wave;
    let tilt = Math.sin(t * speed + i * .67) * .018;
    if (item.type === 'army.retreat') {x += Math.sin(t * speed + row) * wave * .6;y += Math.sin(i * 5.4) * gap * .13;}
    if (item.type === 'army.encircle') {
      const half = Math.ceil(n / 2), sign = i < half ? -1 : 1, j = i % half, lanes = Math.ceil(half / 10);
      const lane = j % lanes, slots = Math.ceil(half / lanes), u = Math.floor(j / lanes) / Math.max(1, slots - 1);
      const angle = (.1 + u * (.45 + closing * .35)) * Math.PI;
      const r = gap * (2.7 * Math.max(1, (slots - 1) / 7) + .3 + lane * .95 - closing * .3);
      x = sign * (Math.sin(angle) * r + (1 - closing) * gap * .8);y = Math.cos(angle) * r * .9;
      tilt = sign * closing * .06;
    }
    if (item.type === 'army.clash') {
      const half = Math.ceil(n / 2), sign = i < half ? -1 : 1, j = i % half, depth = Math.floor(j / Math.max(2, Math.floor(cols / 2)));
      x = sign * (gap * (.6 + depth * .9) + (1 - smooth((s.lt ?? t) / 1.8)) * gap * 1.2);
      y = (j % Math.max(2, Math.floor(cols / 2)) - (Math.max(2, Math.floor(cols / 2)) - 1) / 2) * gap * 1.05;
    }
    result.push({x, y, tilt, row, col, i, opponent: item.type === 'army.clash' && i >= Math.ceil(n / 2)});
  }
  return result;
}
function armyPose(s, view) {
  const motion = s.internal.motion, distance = groundDistance(motion, s.t);
  const q = motion.path ? groundPoseAtDistance(motion, s.item, distance) : {lon: motion.at[0], lat: motion.at[1], heading: Number(s.item.heading) || 0};
  return groundScreenPose(q, view);
}
function rearHaze(g, s, env, width, rear, scale) {
  if (s.item.dust === false) return;
  const c = ink(env), image = groundArt(`army-haze:${c.gray}:${c.gold}`, 96, ctx => {
    const grad = ctx.createRadialGradient(-5, -4, 0, 0, 0, 46);grad.addColorStop(0, c.gold);grad.addColorStop(.45, c.gray);grad.addColorStop(1, 'transparent');ctx.fillStyle = grad;ctx.fillRect(-48, -48, 96, 96);
  });
  if (!image) return;
  const random = (env.rng || rng)(`${s.item.seed ?? s.item.id}:army-dust`), alpha = g.globalAlpha;
  for (let i = 0; i < 12; i++) {
    const phase = random(), x = (random() - .5) * width, drift = random(), age = ((s.t * .45 + phase) % 1 + 1) % 1;
    const size = (45 + age * 95) * scale;
    g.globalAlpha = alpha * .12 * Math.sin(age * Math.PI);g.drawImage(image, x * scale - size / 2, (rear + 15 + age * (35 + 30 * drift)) * scale - size / 2, size, size);
  }
  g.globalAlpha = alpha;
}
function frontLine(g, s, env, width, front, scale) {
  const c = ink(env), retreat = s.item.type === 'army.retreat', color = retreat ? c.red : c.gold;
  g.save();g.scale(scale, scale);g.lineCap = 'round';g.lineJoin = 'round';
  if (retreat) g.setLineDash([10, 9]);
  const trace = () => {g.beginPath();for (let i = 0; i <= 32; i++) {const x = (i / 32 - .5) * width, y = front - Math.sin(i / 32 * Math.PI) * 13 + Math.sin(i * .65 + s.t * 1.4) * 2.5;i ? g.lineTo(x, y) : g.moveTo(x, y);}};
  trace();g.strokeStyle = c.dark;g.lineWidth = 12;g.stroke();
  g.save();g.globalAlpha *= .18 + .08 * Math.sin(s.t * 2);g.strokeStyle = color;g.lineWidth = 11;g.stroke();g.restore();
  g.strokeStyle = color;g.lineWidth = 3;g.stroke();g.strokeStyle = c.light;g.lineWidth = .9;g.stroke();
  for (const sign of [-1, 1]) {g.fillStyle = color;g.beginPath();g.arc(sign * width / 2, front, 4, 0, TAU);g.fill();}
  g.restore();
}
function attackArrow(g, s, env, front, rear, scale) {
  if (s.item.arrow === false || ['army.hold', 'army.clash', 'army.encircle'].includes(s.item.type)) return;
  const c = ink(env), retreat = s.item.type === 'army.retreat', reveal = smooth((s.lt ?? s.t) / 1.2);
  const start = rear + 90, end = front - 85;
  const y = start + (end - start) * reveal, direction = -1;
  g.save();g.scale(scale, scale);g.lineCap = 'round';g.strokeStyle = c.dark;g.lineWidth = 24;
  g.beginPath();g.moveTo(0, start);g.quadraticCurveTo(14, (start + y) / 2, 0, y - direction * 13);g.stroke();
  g.save();g.globalAlpha *= .5;g.strokeStyle = retreat ? c.red : c.gold;g.lineWidth = 14;g.stroke();g.restore();
  polygon(g, [[0, y + direction * 17], [-22, y - direction * 19], [0, y - direction * 10], [22, y - direction * 19]]);g.fillStyle = retreat ? c.red : c.gold;g.fill();g.strokeStyle = c.dark;g.lineWidth = 3;g.stroke();g.restore();
}
function banner(g, s, env, x, y, scale) {
  const c = ink(env), label = s.item.label || 'EJÉRCITO', date = s.item.date || '';
  const width = Math.min(310, Math.max(150, label.length * 10.5 + 34)), artSize = [Math.ceil((width + 34) / 2) * 2, date ? 96 : 64];
  g.save();g.translate(x, y);g.scale(scale, scale);
  drawGroundFlag(g, s.item.flag || 'IQ', -94, 22, 38, s.t, env);
  const paint = g => {
  const w = width;
  g.save();g.translate(4, 6);polygon(g, [[-w / 2, -17], [w / 2, -17], [w / 2 - 12, 18], [-w / 2 - 9, 18]]);g.fillStyle = c.dark;g.globalAlpha *= .5;g.fill();g.restore();
  polygon(g, [[-w / 2, -20], [w / 2, -20], [w / 2 - 12, 15], [-w / 2 - 9, 15]]);
  const grad = g.createLinearGradient(-w / 2, -20, w / 2, 15);grad.addColorStop(0, c.smoke);grad.addColorStop(.5, c.dark);grad.addColorStop(1, c.smoke);
  g.fillStyle = grad;g.fill();g.strokeStyle = c.gold;g.lineWidth = 1.5;g.stroke();
  text(g, label, 0, -2, 17, env, c.gold);
  if (date) text(g, date, 0, 32, 14, env, c.light);
  };
  const art = groundArt(`army-banner:${label}:${date}:${env.font?.('label')}:${JSON.stringify(c)}`, artSize, paint);
  drawArt(g, art, 0, 0, artSize, paint);
  g.restore();
}
function clashFlashes(g, s, env, scale) {
  if ((s.lt ?? s.t) < 1.4) return;
  const c = ink(env), random = (env.rng || rng)(`${s.item.seed ?? s.item.id}:clash`);
  g.save();g.scale(scale, scale);
  for (let i = 0; i < 5; i++) {
    const phase = random(), y = (random() - .5) * 155, q = ((s.t * 1.5 + phase) % 1 + 1) % 1, r = 8 + q * 26;
    g.save();g.globalAlpha *= (1 - q) ** 2;g.translate(Math.sin(i * 3.1) * 10, y);
    polygon(g, Array.from({length: 16}, (_, j) => {const a = j * Math.PI / 8, l = r * (j % 2 ? .24 : 1);return [Math.cos(a) * l, Math.sin(a) * l];}));
    g.fillStyle = i % 2 ? c.blue : c.gold;g.fill();g.fillStyle = c.light;g.beginPath();g.arc(0, 0, r * .2, 0, TAU);g.fill();g.restore();
  }
  g.restore();
}
function drawSupply(g, s, view, env) {
  const {motion, truck, vehicle} = s.internal, U = env.U || 1, c = ink(env), scale = (s.item.scale ?? 1) * U;
  const total = motion.total, distance = groundDistance(motion, s.t), points = [];
  for (let i = 0; i <= 48; i++) points.push(groundScreenPose(groundPoseAtDistance(motion, s.item, i / 48 * total), view));
  g.save();g.strokeStyle = c.dark;g.lineWidth = 7 * scale;g.lineCap = 'round';g.beginPath();points.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y));g.stroke();
  g.strokeStyle = c.gold;g.lineWidth = 2 * scale;g.setLineDash([8 * scale, 9 * scale]);g.lineDashOffset = -distance * (view.scale || 512 * 2 ** view.zoom);g.stroke();g.setLineDash([]);
  const count = s.item.supplyCount ?? 5;
  for (let i = 0; i < count; i++) {
    // The same eased path time drives each truck, shifted by a fraction of length.
    const progress = ((distance / Math.max(total, 1e-12) - i / count) % 1 + 1) % 1;
    const pose = groundScreenPose(groundPoseAtDistance(motion, s.item, progress * total), view);
    g.save();g.globalAlpha *= smooth(progress / .06) * smooth((1 - progress) / .06);
    drawGroundVehicle(g, {...s, item: truck, state: 'normal', stateWeights: {normal: 1}, internal: {...vehicle, motion}}, view, env, {...pose, distance: progress * total});g.restore();
  }
  for (const p of [points[0], points.at(-1)]) {g.fillStyle = c.dark;g.beginPath();g.arc(p.x, p.y, 11 * scale, 0, TAU);g.fill();g.strokeStyle = c.gold;g.lineWidth = 2 * scale;g.stroke();}
  if (s.item.label) {const p = points[Math.floor(points.length / 2)];text(g, s.item.label, p.x, p.y - 47 * scale, 19 * scale, env, c.gold);}
  g.restore();
}
export function drawArmy(g, s, view, env) {
  const item = s.item, p = armyPose(s, view), c = ink(env), scale = (env.U || 1) * (item.scale ?? 1), states = stateWeights(s, ARMY_STATES);
  if (item.type === 'army.supply' || item.type === 'army.banner') {
    g.save();g.globalAlpha *= 1 - states.destroyed * .8;
    if (item.type === 'army.supply') drawSupply(g, s, view, env);else banner(g, s, env, p.x, p.y, scale * 1.6);
    g.restore();return;
  }
  const offsets = armyFormation(s), radius = item.radius ?? 25;
  const width = (Math.min(item.columns ?? 6, item.count ?? 24) - .2) * (item.spacing ?? 59), rows = Math.ceil((item.count ?? 24) / (item.columns ?? 6));
  const front = -(rows - 1) * (item.spacing ?? 59) * .455 - radius * 1.65, rear = -front;
  g.save();g.translate(p.x, p.y);g.rotate(p.angle);
  rearHaze(g, s, env, width, rear, scale);attackArrow(g, s, env, front, rear, scale);
  if (!['army.encircle', 'army.clash'].includes(item.type)) frontLine(g, s, env, width, front, scale);
  if (item.type === 'army.encircle') {
    const close = smooth((s.lt ?? s.t) / (item.closeDur ?? 5));g.save();g.scale(scale, scale);
    for (const sign of [-1, 1]) {g.beginPath();g.ellipse(sign * (1 - close) * 40, 0, (item.spacing ?? 59) * 1.65, (item.spacing ?? 59) * 1.5, 0, sign < 0 ? Math.PI / 2 : -Math.PI / 2, sign < 0 ? Math.PI * 1.5 : Math.PI / 2);g.strokeStyle = c.gold;g.lineWidth = 2;g.stroke();}g.restore();
  }
  for (const o of offsets) {
    const entry = .82 + .18 * smooth(((s.lt ?? s.t) - o.row * .025) / .45);
    let x = o.x * scale, y = o.y * scale, alpha = 1 - states.destroyed * .78, tilt = o.tilt, r = radius * scale * entry;
    if (item.type === 'army.hold') r *= 1 + .027 * Math.sin(s.t * (item.speed ?? 1.6) * 2 + o.col * .3);
    if (item.type === 'army.clash' && o.i % 5 === 0) {
      const cycle = (s.lt ?? s.t) - 2 - o.i % 4 * .27, phase = ((cycle % 4) + 4) % 4;
      const q = smooth(phase / .85) * (1 - smooth((phase - 3.1) / .9));
      if (cycle >= 0) {alpha *= 1 - q * (item.fall ?? .7);y += q * 24 * scale;tilt += q * (o.opponent ? .7 : -.7);r *= 1 - q * .2;}
    }
    // Tokens remain upright like the reference even when the formation turns.
    drawArmyToken(g, o.opponent ? item.opponentFlag || 'IR' : item.flag || 'IQ', x, y, r, tilt - p.angle, env, alpha);
    if (states.engaged > .01 || states.routed > .01) {
      g.save();g.globalAlpha *= Math.max(states.engaged, states.routed) * (.3 + .15 * Math.sin(s.t * 4 + o.i));
      g.strokeStyle = states.routed > .5 ? c.red : c.gold;g.lineWidth = 1.2 * scale;g.beginPath();g.arc(x, y, r * 1.14, 0, TAU);g.stroke();g.restore();
    }
  }
  if (item.type === 'army.clash') clashFlashes(g, s, env, scale);
  if (item.banner !== false) {
    // Counter-rotate the heading so the army name stays legible.
    const y = front * scale - 67 * scale;g.save();g.translate(0, y);g.rotate(-p.angle);banner(g, s, env, 0, 0, scale);g.restore();
  }
  g.restore();
}

for (const type of names) {
  const summary = {'army.advance': 'Ola de fichas con relieve, bandera, filas escalonadas, flecha progresiva y frente luminoso.',
    'army.retreat': 'Retirada organizada de fichas con ondulación, polvo y frente rojo discontinuo.',
    'army.hold': 'Línea defensiva escalonada que resiste con un pulso coordinado.',
    'army.encircle': 'Dos brazos de fichas que cierran el cerco gradualmente.',
    'army.clash': 'Dos ejércitos enfrentados con destellos deterministas y fichas que caen.',
    'army.banner': 'Estandarte ondeante con banda biselada, nombre de ejército y fecha.',
    'army.supply': 'Ruta logística discontinua con pequeños camiones, polvo y entrada/salida suave.'}[type];
  const params = {...armyParams};
  if (type === 'army.banner' || type === 'army.supply') for (const name of ['count', 'columns', 'spacing', 'radius', 'wave', 'speed', 'arrow', 'banner']) delete params[name];
  if (type === 'army.banner') delete params.dust;
  Tactico.component(type, {
    layer: type === 'army.banner' ? 70 : 30, summary, params: {...params,
      ...(type === 'army.encircle' ? {closeDur: {type: 'number', default: 5, min: .2, max: 30, step: .1}} : {}),
      ...(type === 'army.clash' ? {opponentFlag: {type: 'string', default: 'IR'}, fall: {type: 'number', default: .7, min: 0, max: .8, step: .05}} : {}),
      ...(type === 'army.supply' ? {supplyCount: {type: 'number', default: 5, min: 2, max: 12, step: 1}} : {})},
    states: ARMY_STATES, validate: validateArmy, prepare: prepareArmy, draw: drawArmy,
    demo: {id: type.replace('.', '-'), type, at: [48.45, 31.2], flag: 'IQ', t: 0, dur: 8, fade: .6, count: 24, columns: 6,
      radius: 25, spacing: 59, wave: 5, label: type === 'army.supply' ? 'ABASTECIMIENTO' : type === 'army.hold' ? 'LÍNEA DEFENSIVA' : type === 'army.clash' ? 'CHOQUE DE FRENTES' : 'EJÉRCITO',
      date: type === 'army.banner' ? 'SEPTIEMBRE · 1980' : '',
      ...(['army.advance', 'army.retreat', 'army.supply'].includes(type) ? {path: {via: type === 'army.retreat' ? [[48.6, 31.38], [48.48, 31.18], [48.3, 30.98]] : [[48.3, 30.98], [48.48, 31.18], [48.6, 31.38]], t: .5, dur: 7, curve: 'smooth', ease: 'inOut'}} : {}),
      ...(type === 'army.encircle' ? {count: 16, columns: 4, closeDur: 5} : {}), ...(type === 'army.clash' ? {opponentFlag: 'IR', count: 24} : {})},
  });
}
