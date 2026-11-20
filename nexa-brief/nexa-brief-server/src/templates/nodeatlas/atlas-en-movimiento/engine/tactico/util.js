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

// Las listas y escalares reemplazan; solo los objetos se fusionan recursivamente.
export function deepMerge(a, b) {
  if (b === undefined) return structuredClone(a);
  if (!b || typeof b !== 'object' || Array.isArray(b) || !a || typeof a !== 'object' || Array.isArray(a)) return structuredClone(b);
  const result = {...a};
  for (const [k, v] of Object.entries(b)) result[k] = deepMerge(a[k], v);
  return result;
}
export const stylePath = (obj, path) => String(path).split('.').reduce((v, k) => v?.[k], obj);
export function makeEstilo(data, formato = 'movil', overrides = {}) {
  if (!['movil','escritorio'].includes(formato)) throw new Error(`Formato de estilo desconocido: ${formato}`);
  const d = deepMerge(data, overrides), F = d.formatos?.[formato];
  if (!F) throw new Error(`El estilo ${d.id} no admite ${formato}`);
  const estilos = deepMerge(d.estilos || {}, F.estilos || {});
  const resolved = {...d, estilos, formato, ranuras:F.ranuras || {}};
  const parseCol = spec => {
    if (spec == null || spec === false) return null;
    const [name, alpha] = String(spec).split('@'), [hex, alpha0] = String(d.colores?.[name] ?? name).split('@');
    const a = (alpha0 === undefined ? 1 : +alpha0) * (alpha === undefined ? 1 : +alpha);
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return {raw:hex,a};
    const n = parseInt(hex.slice(1),16); return {r:n>>16&255,g:n>>8&255,b:n&255,a};
  };
  const col = spec => { const c=parseCol(spec); return !c?'transparent':c.raw|| (c.a>=1?`rgb(${c.r},${c.g},${c.b})`:`rgba(${c.r},${c.g},${c.b},${+c.a.toFixed(3)})`); };
  const txt = path => {
    const s = stylePath(estilos,path) ?? stylePath(resolved,path);
    if (!s || typeof s !== 'object') throw new Error(`Token de texto inexistente: ${path}`);
    const name=d.fuentes?.[s.fuente] || s.fuente || 'sans-serif', family=`'${name}',${name==='IBM Plex Mono'?'monospace':'Arial,sans-serif'}`;
    const size=s.tam ?? 24, weight=s.peso ?? 400, font=`${s.cursiva?'italic ':''}${weight} ${size}px ${family}`;
    const sombras=(d.sombras?.[s.sombra] || []).map(([x,y,blur,a])=>({x,y,blur,color:col(`${d.sombras?.color||'#000000'}@${a}`)}));
    return {...s, font, fuente:family, size, tam:size, peso:weight, ancho:s.ancho??100, espaciado:s.espaciado??0, mayusculas:!!s.mayusculas, color:col(s.color||'tinta'), sombra:sombras,
      draw(g,text,x,y,opts={}) {
        g.save(); try {
          g.font=opts.font||font; g.textAlign=opts.align||'left'; g.textBaseline=opts.baseline||'alphabetic'; g.fillStyle=opts.color||col(s.color||'tinta');
          if ('fontStretch' in g) g.fontStretch=globalThis.__kw(s.ancho??100);
          if ('letterSpacing' in g) g.letterSpacing=`${(s.espaciado??0)*size}px`;
          const value=s.mayusculas?String(text).toLocaleUpperCase():String(text), args=opts.maxWidth==null?[value,x,y]:[value,x,y,opts.maxWidth];
          for (const sh of sombras) { g.shadowOffsetX=sh.x;g.shadowOffsetY=sh.y;g.shadowBlur=sh.blur;g.shadowColor=sh.color;g.fillText(...args); }
          g.shadowColor='transparent'; if(opts.halo){g.strokeStyle=opts.halo;g.lineWidth=opts.haloWidth??2;g.lineJoin='round';g.strokeText(...args);} g.fillText(...args);
        } finally { g.restore(); }
      }};
  };
  return {...resolved, col, txt, num(path) {const v=stylePath(resolved,path);if(typeof v!=='number'||!Number.isFinite(v))throw new Error(`Token numérico inexistente: ${path}`);return v;}, slot(name){return F.ranuras?.[name];}, fijo(name){return (d.fijos||[]).some(p=>p.endsWith('.*')?(name===p.slice(0,-2)||name.startsWith(p.slice(0,-1))):name===p);} };
}

// Ancho de letra para canvas: font-stretch solo admite palabras clave (no porcentajes).
globalThis.__kw = pct => { const n = +pct; return n < 56 ? 'ultra-condensed' : n < 69 ? 'extra-condensed' : n < 81 ? 'condensed' : n < 94 ? 'semi-condensed' : n < 106 ? 'normal' : n < 119 ? 'semi-expanded' : 'expanded'; };

// Dibuja un token de texto del estilo (px del lienzo de diseño) en un lienzo de otro tamaño: U = min(W,H)/1080.
export function drawScaled(tok, g, U, text, x, y, opts = {}) {
  if (!tok) return; g.save(); g.translate(x, y); g.scale(U, U);
  tok.draw(g, text, 0, 0, {...opts, maxWidth: opts.maxWidth == null ? undefined : opts.maxWidth});
  g.restore();
}

// Ancho (px del lienzo de diseño) de un texto con un token de estilo.
export function measureToken(tok, g, text) {
  g.save(); g.font = tok.font; if ('fontStretch' in g) g.fontStretch = globalThis.__kw(tok.ancho); if ('letterSpacing' in g) g.letterSpacing = `${(tok.espaciado || 0) * tok.size}px`;
  const w = g.measureText(tok.mayusculas ? String(text).toLocaleUpperCase() : String(text)).width; g.restore(); return w;
}
