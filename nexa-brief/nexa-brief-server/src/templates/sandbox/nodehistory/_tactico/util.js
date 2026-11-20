// Geometría y dibujo puros: el tiempo siempre viene de la composición.
export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, u) => a + (b - a) * u;
export const smoothstep = (a, b, x) => { const u = a === b ? +(x >= b) : clamp((x - a) / (b - a)); return u * u * (3 - 2 * u); };
export const linear = u => clamp(u);
export const easeIn = u => clamp(u) ** 3;
export const out = u => 1 - (1 - clamp(u)) ** 3;
export const inOut = u => (u = clamp(u)) < .5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2;
export const spring = u => u <= 0 ? 0 : u >= 1 ? 1 : 1 - Math.exp(-7 * u) * Math.cos(10 * u);
export {easeIn as in};
export const easing = Object.freeze({linear, in: easeIn, out, inOut, spring});
export const ease = (name, u) => (easing[name] || inOut)(u);
const RAD = Math.PI / 180;
export const wrap = degrees => ((degrees + 180) % 360 + 360) % 360 - 180;
export function mercator(lon, lat) {
  const phi = clamp(lat, -85.0511287798066, 85.0511287798066) * RAD;
  return [(lon + 180) / 360, (1 - Math.asinh(Math.tan(phi)) / Math.PI) / 2];
}
export function unmercator(x, y) { return [x * 360 - 180, Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) / RAD]; }
export function headingBetween(a, b) {
  const p = mercator(...a), q = mercator(...b);
  const dx = wrap((q[0] - p[0]) * 360) / 360, dy = q[1] - p[1];
  return Math.abs(dx) + Math.abs(dy) < 1e-14 ? 0 : (Math.atan2(dx, -dy) / RAD + 360) % 360;
}
export function rng(seed = 0) {
  let a = typeof seed === 'number' ? seed >>> 0 : [...String(seed)].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let v = Math.imul(a ^ a >>> 15, 1 | a); v ^= v + Math.imul(v ^ v >>> 7, 61 | v); return ((v ^ v >>> 14) >>> 0) / 4294967296; };
}
export function bezierAt(points, u) {
  let p = points.map(p => [...p]);
  while (p.length > 1) p = p.slice(1).map((b, i) => [lerp(p[i][0], b[0], u), lerp(p[i][1], b[1], u)]);
  return p[0];
}
const pathCache = new WeakMap();
function buildPath(path) {
  const points = (path.via || []).map(p => mercator(...p));
  if (!points.length) throw new Error('path.via necesita al menos un punto');
  for (let i = 1; i < points.length; i++) points[i][0] = points[i - 1][0] + wrap((points[i][0] - points[i - 1][0]) * 360) / 360;
  const segments = Math.max(1, points.length - 1);
  function at(v) {
    if (points.length === 1) return points[0];
    const j = Math.min(segments - 1, Math.floor(clamp(v) * segments)), u = clamp(v) * segments - j;
    const a = points[j], b = points[j + 1];
    if (path.curve === 'arc') {
      const bend = path.bend ?? .16, control = [(a[0] + b[0]) / 2 - (b[1] - a[1]) * bend, (a[1] + b[1]) / 2 + (b[0] - a[0]) * bend];
      return bezierAt([a, control, b], u);
    }
    if (path.curve === 'smooth') {
      const p = points[j - 1] || a, q = points[j + 2] || b;
      return [0, 1].map(k => .5 * (2 * a[k] + (-p[k] + b[k]) * u + (2 * p[k] - 5 * a[k] + 4 * b[k] - q[k]) * u * u + (-p[k] + 3 * a[k] - 3 * b[k] + q[k]) * u ** 3));
    }
    return [lerp(a[0], b[0], u), lerp(a[1], b[1], u)];
  }
  // Tabla de longitud una vez por trayectoria; evita acelerar en cada waypoint.
  const count = segments * (path.curve === 'smooth' || path.curve === 'arc' ? 64 : 1);
  const table = [{v: 0, d: 0, p: at(0)}];
  for (let i = 1; i <= count; i++) {
    const p = at(i / count), prev = table.at(-1);
    table.push({v: i / count, d: prev.d + Math.hypot(p[0] - prev.p[0], p[1] - prev.p[1]), p});
  }
  const total = table.at(-1).d;
  return {total, at(u) {
    if (!total) return points[0];
    const d = clamp(u) * total;
    let lo = 0, hi = table.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (table[m].d < d) lo = m; else hi = m; }
    const a = table[lo], b = table[hi];
    return at(lerp(a.v, b.v, b.d === a.d ? 0 : (d - a.d) / (b.d - a.d)));
  }};
}
function cachedPath(path) {
  let curve = pathCache.get(path);
  if (!curve) { curve = buildPath(path); pathCache.set(path, curve); }
  return curve;
}
export function pathDuration(path) {
  return path.dur ?? (path.speed > 0 ? cachedPath(path).total * 40075.016686 / path.speed : 1);
}
export function pathAt(path, t) {
  const curve = cachedPath(path), duration = pathDuration(path);
  const elapsed = t - (path.t ?? 0), raw = duration === 0 ? +(elapsed >= 0) : clamp(elapsed / duration);
  const u = clamp(ease(path.ease ?? 'linear', raw)), p = curve.at(u), a = curve.at(Math.max(0, u - 1e-5)), b = curve.at(Math.min(1, u + 1e-5));
  const [lon, lat] = unmercator(...p), heading = curve.total ? (Math.atan2(b[0] - a[0], a[1] - b[1]) / RAD + 360) % 360 : 0;
  return {lon: wrap(lon), lat, heading, u};
}

export function stroke(g, path, {color = g.strokeStyle, width = 2, outline = null, outlineWidth = 2} = {}) {
  g.save(); g.lineCap = g.lineJoin = 'round';
  if (outline) { g.strokeStyle = outline; g.lineWidth = width + 2 * outlineWidth; path ? g.stroke(path) : g.stroke(); }
  g.strokeStyle = color; g.lineWidth = width; path ? g.stroke(path) : g.stroke(); g.restore();
}
export function fill(g, path, {color = g.fillStyle, outline = null, width = 2, rule = 'nonzero'} = {}) {
  g.save(); g.fillStyle = color; path ? g.fill(path, rule) : g.fill(rule);
  if (outline) stroke(g, path, {color: outline, width}); g.restore();
}
export function textOutlined(g, txt, x, y, {size = 24, font = 'sans-serif', weight = 700, color = g.fillStyle, outline = g.strokeStyle, width = size * .16, align = 'center', baseline = 'middle', maxWidth} = {}) {
  g.save(); g.font = `${weight} ${size}px ${font}`; g.textAlign = align; g.textBaseline = baseline; g.lineJoin = 'round';
  const args = maxWidth == null ? [String(txt), x, y] : [String(txt), x, y, maxWidth];
  if (outline && width) { g.strokeStyle = outline; g.lineWidth = width; g.strokeText(...args); }
  g.fillStyle = color; g.fillText(...args); g.restore();
}
export function shadowDraw(g, draw, {x = 4, y = 6, blur = 4, color = 'rgba(0,0,0,.6)'} = {}) {
  g.save(); g.shadowOffsetX = x; g.shadowOffsetY = y; g.shadowBlur = blur; g.shadowColor = color;
  try { draw(g); } finally { g.restore(); }
}
export function chip(g, txt, x, y, {size = 22, padding = 10, radius = 6, background = g.fillStyle, color = g.strokeStyle, outline, font = 'sans-serif', weight = 700} = {}) {
  g.save(); g.font = `${weight} ${size}px ${font}`;
  const w = g.measureText(String(txt)).width + padding * 2, h = size + padding * 2;
  g.beginPath(); g.roundRect(x - w / 2, y - h / 2, w, h, radius); fill(g, null, {color: background, outline});
  textOutlined(g, txt, x, y, {size, font, weight, color, outline: null}); g.restore();
  return {x: x - w / 2, y: y - h / 2, w, h};
}
export function bezierArrow(g, points, {u = 1, color = g.strokeStyle, width = 3, head = 12, outline, outlineWidth = 2} = {}) {
  if (![3, 4].includes(points.length)) throw new Error('bezierArrow necesita 3 o 4 puntos');
  u = clamp(u); if (!u) return;
  // De Casteljau recorta la curva sin aproximarla por una polilínea.
  const left = [points[0]]; let p = points;
  while (p.length > 1) { p = p.slice(1).map((b, i) => [lerp(p[i][0], b[0], u), lerp(p[i][1], b[1], u)]); left.push(p[0]); }
  g.save(); g.beginPath(); g.moveTo(...left[0]);
  if (left.length === 3) g.quadraticCurveTo(...left[1], ...left[2]); else g.bezierCurveTo(...left[1], ...left[2], ...left[3]);
  stroke(g, null, {color, width, outline, outlineWidth});
  const tip = left.at(-1), prev = left.at(-2), angle = Math.atan2(tip[1] - prev[1], tip[0] - prev[0]);
  g.beginPath(); g.moveTo(...tip); g.lineTo(tip[0] - head * Math.cos(angle - .45), tip[1] - head * Math.sin(angle - .45));
  g.lineTo(tip[0] - head * Math.cos(angle + .45), tip[1] - head * Math.sin(angle + .45)); g.closePath();
  fill(g, null, {color, outline, width: outlineWidth}); g.restore();
}
