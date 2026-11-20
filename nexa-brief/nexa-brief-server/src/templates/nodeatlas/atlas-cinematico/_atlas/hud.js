import { GEO_NARRATIVE_TYPES, prepareGeoNarrative } from './hud-geo-narrative.js';
/* hud.js · componentes de noticiero para Atlas (estilo "resumen geopolítico").
 * Se declaran en scene.hud[] (arreglo aparte de scene.layers). Todo sale de t (puro, seek-safe).
 * Tipografía/tamaño/color: scene.hudTheme + campos font/size/color/weight/tracking de cada ítem.
 * Posición: `at` (lugar o [lon,lat]) + dx,dy (px de diseño)  ó  x,y (fracción del cuadro).
 * Tipos: brand · topic · lower-title · hemicycle · counter · portrait · photo-frame · chip · city · note · glow
 * Unidad de diseño u = min(W,H)/1080. */
import { DATA_TYPES, prepareData } from './hud-data.js';
const PI = Math.PI;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const easeOut = x => 1 - (1 - clamp(x)) ** 3;
const pop = x => { x = clamp(x); return Math.max(0, 1 + 2.2 * (x - 1) ** 3 + 1.2 * (x - 1) ** 2); };
const hash = n => { let x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const CHARS = 'ABCDEFGHJKLMNPRSTUVXYZ0123456789<>+/';
export const HUD_TYPES = new Set(['brand','topic','lower-title','hemicycle','counter','portrait','photo-frame','chip','icon-grid','flag-chip','logo-chip','city','note','glow','alert','headline','key-figure','date-card','message', ...DATA_TYPES, ...GEO_NARRATIVE_TYPES]);
const PORTRAIT_SCALE = { topic: 1.25, note: 1.2, city: 1.2 };
export const DEFAULT_THEME = {
  fonts: { ui: "'Barlow Condensed', 'Montserrat', sans-serif", title: "'Poppins', 'Montserrat', sans-serif", num: "'Barlow Condensed', 'Montserrat', sans-serif" },
  colors: { blue: '#2f8cff', red: '#ff3b5c', yellow: '#ffd21a', green: '#3ddc84', orange: '#ff8a1a', white: '#ffffff', dim: '#8d96a8', panel: 'rgba(8,14,26,.62)' },
};
const merge = (a, b) => { const o = { ...a }; for (const [k, v] of Object.entries(b || {})) o[k] = v && typeof v === 'object' && !Array.isArray(v) ? merge(a?.[k] || {}, v) : v; return o; };
function scramble(str, p, t, seed) {
  const n = str.length, k = Math.floor(clamp(p) * n); let s = '';
  for (let i = 0; i < n; i++) s += i < k || str[i] === ' ' ? str[i] : CHARS[Math.floor(hash(i * 7.3 + Math.floor(t * 24) + seed) * CHARS.length)];
  return s;
}
function octagon(g, x, y, r) { g.beginPath(); for (let i = 0; i < 8; i++) { const a = PI / 8 + i * PI / 4; (i ? g.lineTo : g.moveTo).call(g, x + r * Math.cos(a), y + r * Math.sin(a)); } g.closePath(); }
function rrect(g, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

/* iconos en caja [-1,1]; g ya tiene stroke/fill configurados */
export const ICONS = {
  db: g => { for (const y of [-.55, 0, .55]) { g.beginPath(); g.ellipse(0, y, .7, .25, 0, 0, 2 * PI); g.stroke(); } g.beginPath(); g.moveTo(-.7, -.55); g.lineTo(-.7, .55); g.moveTo(.7, -.55); g.lineTo(.7, .55); g.stroke(); },
  eye: g => { g.beginPath(); g.moveTo(-.9, 0); g.quadraticCurveTo(0, -.85, .9, 0); g.quadraticCurveTo(0, .85, -.9, 0); g.stroke(); g.beginPath(); g.arc(0, 0, .27, 0, 2 * PI); g.fill(); },
  gavel: g => { g.save(); g.rotate(-.6); g.fillRect(-.55, -.7, .9, .4); g.restore(); g.beginPath(); g.moveTo(-.1, -.1); g.lineTo(.7, .7); g.stroke(); g.beginPath(); g.moveTo(-.8, .85); g.lineTo(.1, .85); g.stroke(); },
  doc: g => { g.beginPath(); g.moveTo(-.5, -.85); g.lineTo(.2, -.85); g.lineTo(.55, -.5); g.lineTo(.55, .85); g.lineTo(-.5, .85); g.closePath(); g.stroke(); for (const y of [-.1, .2, .5]) { g.beginPath(); g.moveTo(-.25, y); g.lineTo(.3, y); g.stroke(); } },
  shield: g => { g.beginPath(); g.moveTo(0, -.9); g.lineTo(.7, -.6); g.lineTo(.65, .1); g.quadraticCurveTo(.5, .6, 0, .9); g.quadraticCurveTo(-.5, .6, -.65, .1); g.lineTo(-.7, -.6); g.closePath(); g.stroke(); g.beginPath(); g.moveTo(-.28, .0); g.lineTo(-.05, .25); g.lineTo(.32, -.2); g.stroke(); },
  bolt: g => { g.beginPath(); g.moveTo(.2, -.9); g.lineTo(-.5, .15); g.lineTo(-.05, .15); g.lineTo(-.2, .9); g.lineTo(.5, -.2); g.lineTo(.05, -.2); g.closePath(); g.stroke(); },
  drop: g => { g.beginPath(); g.moveTo(0, -.9); g.quadraticCurveTo(.8, .1, .55, .5); g.quadraticCurveTo(0, 1.05, -.55, .5); g.quadraticCurveTo(-.8, .1, 0, -.9); g.stroke(); },
  chart: g => { g.beginPath(); g.moveTo(-.85, .8); g.lineTo(.85, .8); g.moveTo(-.85, .8); g.lineTo(-.85, -.8); g.stroke(); g.beginPath(); g.moveTo(-.6, .4); g.lineTo(-.15, -.05); g.lineTo(.2, .2); g.lineTo(.7, -.5); g.stroke(); },
  lock: g => { g.strokeRect(-.6, -.1, 1.2, .9); g.beginPath(); g.arc(0, -.1, .38, PI, 0); g.stroke(); g.beginPath(); g.arc(0, .35, .1, 0, 2 * PI); g.fill(); },
  ban: g => { g.beginPath(); g.arc(0, 0, .8, 0, 2 * PI); g.stroke(); g.beginPath(); g.moveTo(-.57, -.57); g.lineTo(.57, .57); g.stroke(); },
  vote: g => { g.strokeRect(-.8, -.1, 1.6, .9); g.beginPath(); g.moveTo(-.35, -.1); g.lineTo(-.1, -.8); g.lineTo(.5, -.75); g.lineTo(.3, -.1); g.stroke(); g.beginPath(); g.moveTo(-.3, .35); g.lineTo(-.05, .55); g.lineTo(.4, .15); g.stroke(); },
  people: g => { for (const x of [-.4, .4]) { g.beginPath(); g.arc(x, -.4, .26, 0, 2 * PI); g.stroke(); g.beginPath(); g.arc(x, .7, .5, PI, 2 * PI); g.stroke(); } },
  star: g => { g.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? .38 : .9, a = -PI / 2 + i * PI / 5; (i ? g.lineTo : g.moveTo).call(g, r * Math.cos(a), r * Math.sin(a)); } g.closePath(); g.stroke(); },
  globe: g => { g.beginPath(); g.arc(0, 0, .8, 0, 2 * PI); g.stroke(); g.beginPath(); g.ellipse(0, 0, .35, .8, 0, 0, 2 * PI); g.stroke(); g.beginPath(); g.moveTo(-.8, 0); g.lineTo(.8, 0); g.stroke(); },
  drone: g => { g.beginPath(); g.moveTo(-.8, -.4); g.lineTo(.8, -.4); g.moveTo(-.8, .35); g.lineTo(.8, .35); g.moveTo(-.2, -.4); g.lineTo(-.2, .35); g.moveTo(.2, -.4); g.lineTo(.2, .35); g.stroke(); g.beginPath(); g.arc(0, 0, .22, 0, 2 * PI); g.fill(); },
  warn: g => { g.beginPath(); g.moveTo(0, -.85); g.lineTo(.85, .7); g.lineTo(-.85, .7); g.closePath(); g.stroke(); g.beginPath(); g.moveTo(0, -.25); g.lineTo(0, .2); g.stroke(); g.beginPath(); g.arc(0, .45, .06, 0, 2 * PI); g.fill(); },
};

export function createHud(scene, env) {
  const theme = merge(DEFAULT_THEME, scene.hudTheme);
  const T = env.T || ((v, d) => typeof v === 'number' ? v : d);
  const items = [...(scene.hud || []), ...(scene.layers || []).filter(l => l.type === 'choropleth')].map((l, i) => ({ ...l, _i: i }));
  const images = new Map(), failed = new Set(), warned = new Set(), paths = new Map();
  let library = {};
  const warn = message => { if (!warned.has(message)) { warned.add(message); console.warn('[noticiero HUD]', message); } };
  const flagSource = l => l.src || new URL(`assets/flags/${String(l.code || '').toLowerCase()}.svg`, import.meta.url).href;
  const data = prepareData(items, { T, flagSource });
  const geoNarrative = prepareGeoNarrative(items, { T, place:env.place, warn });
  for (const l of items) if (l.type === 'flag-chip') l.src = flagSource(l);
  const source = src => { try { return env.base ? new URL(src, env.base).href : src; } catch { return src; } };
  const absent = src => { failed.add(src); if (items.some(l => l.src === src && ['logo-chip','flag-chip'].includes(l.type))) warn(`Imagen ausente: ${src}`); };
  const jobs = [...new Set([...items.map(l => l.src).filter(Boolean), ...data.sources])].map(src => Promise.resolve().then(() => env.loadImg(source(src))).then(im => { if (im) images.set(src, im); else absent(src); }, () => absent(src)));
  for (const l of items) if (l.type === 'logo-chip' && !l.src) warn(`logo-chip sin imagen: ${l.label || '?'}`);
  const needsLibrary = geoNarrative.needsLibrary || data.needsLibrary || items.some(l => l.type === 'icon-grid' || l.type === 'chip' && l.icon && !Object.hasOwn(ICONS, l.icon) && !l.glyph);
  if (needsLibrary) jobs.push(fetch(new URL('assets/icons/noticiero-icons.json', import.meta.url)).then(r => { if (!r.ok) throw Error(r.status); return r.json(); }).then(data => {
    library = data;
    // Los Path2D se preparan una sola vez, nunca durante un cuadro.
    for (const [name, icon] of Object.entries(data)) if (!Object.hasOwn(ICONS, name)) paths.set(name, icon.paths.map(d => new Path2D(d)));
  }).catch(error => warn(`Biblioteca de iconos no disponible: ${error.message}`)));
  const image = src => images.get(src) || (env.img && (env.img(source(src)) || env.img(src))) || null;
  const col = c => theme.colors[c] || c;
  const fontOf = (l, kind = 'ui') => l.font || theme.fonts[kind] || theme.fonts.ui;
  function drawIcon(g, name = 'star') {
    if (Object.hasOwn(ICONS, name)) return ICONS[name](g);
    const ps = paths.get(name);
    if (!ps) { warn(`Icono desconocido: ${name}; se usa star`); return ICONS.star(g); }
    g.save();
    // Lucide usa 24×24: conserva el grosor 0.14 del dibujo histórico.
    const width = g.lineWidth; g.scale(1 / 12, 1 / 12); g.translate(-12, -12); g.lineWidth = width * 12;
    for (const path of ps) g.stroke(path);
    g.restore();
  }

  function timing(l, t) {
    const start = T(l.t, 0), dur = Math.max(.001, l.dur ?? .5), out = l.out == null ? Infinity : T(l.out, Infinity), exit = l.exit ?? .35;
    if (t < start || t >= out + exit) return null;
    const outP = t >= out ? clamp((t - out) / exit) : 0;
    return { start, dur, out, p: clamp((t - start) / dur), el: t - start, alpha: 1 - ease(outP) };
  }
  function anchor(l, view, u) {
    let x, y;
    if (l.at != null) {
      const p = Array.isArray(l.at) ? l.at : env.place?.(l.at); if (!p) return null;
      const q = view.project(+p[0], +p[1]); if (!q || !q.visible) return null; x = q.x; y = q.y;
    } else { x = view.W * (l.x ?? .5); y = view.H * (l.y ?? .5); }
    return { x: x + (l.dx || 0) * u, y: y + (l.dy || 0) * u };
  }

  function draw(g, t, view) {
    const W = view.W, H = view.H, u = Math.min(W, H) / 1080;
    const active = items.map(l => ({ l, tm: timing(l, t) })).filter(a => a.tm);
    g.save();
    try {
      let topicSlot = 0;
      for (const { l, tm } of active) {
        g.save();
        try {
          g.globalAlpha *= tm.alpha; g.lineCap = 'round'; g.lineJoin = 'round'; g.textBaseline = 'middle';
          const portrait = W < H;
          // Móvil (9:16): el titular, las notas y las ciudades salen más grandes por defecto (editable con scalePortrait)
          const S = n => n * u * (typeof l.scale === 'number' ? l.scale : 1) * (portrait ? (l.scalePortrait ?? PORTRAIT_SCALE[l.type] ?? 1) : (l.scaleLandscape ?? 1));
          const text = (str, x, y, size, o = {}) => {
            g.font = `${o.style ? o.style + ' ' : ''}${o.weight || l.weight || 700} ${S(size)}px ${o.font || fontOf(l)}`; g.textAlign = o.align || 'left';
            g.letterSpacing = `${S(o.tracking ?? 0)}px`; g.fillStyle = o.color || '#fff';
            if (o.shadow !== false) { g.shadowColor = 'rgba(0,0,0,.7)'; g.shadowBlur = S(8); }
            g.fillText(str, x, y); g.shadowBlur = 0; g.letterSpacing = '0px';
          };
          const measure = (str, size, o = {}) => { g.font = `${o.style ? o.style + ' ' : ''}${o.weight || l.weight || 700} ${S(size)}px ${o.font || fontOf(l)}`; g.letterSpacing = `${S(o.tracking ?? 0)}px`; const w = g.measureText(str).width; g.letterSpacing = '0px'; return w; };
          const up = s => l.upper === false ? String(s ?? '') : String(s ?? '').toUpperCase();

          if (GEO_NARRATIVE_TYPES.has(l.type)) {
            geoNarrative.draw(l, tm, { g, t, view, u, S, text, measure, anchor, rrect, col, theme, image, drawIcon });
          }
          else if (DATA_TYPES.has(l.type)) {
            data.draw(l, tm, { g, t, view, u, S, text, measure, up, anchor, rrect, col, theme, fontOf, image, drawIcon });
          }
          else if (l.type === 'brand') {
            const a = { x: W * (l.x ?? .88), y: H * (l.y ?? (portrait ? .06 : .135)) }, size = l.size ?? 40, str = l.text || 'BRAND';
            g.globalAlpha *= l.opacity ?? .55;
            text(str, a.x, a.y, size, { align: 'right', weight: l.weight || 800, tracking: l.tracking ?? 1, color: l.color || '#fff', font: fontOf(l, 'title') });
          }
          else if (l.type === 'topic') {
            const slot = l.slot ?? topicSlot++, size = l.size ?? 21, h = S(36), x = W * (l.x ?? .11), y = H * (l.y ?? (portrait ? .1 : .155)) + slot * (h + S(8));
            const full = up(l.text), shown = scramble(full, easeOut(tm.el / (l.reveal ?? .7)), t, l._i), tr = l.tracking ?? 2.6;
            const w = measure(full, size, { tracking: tr }) + S(52), slide = (1 - easeOut(tm.el / .35)) * S(-30);
            g.translate(slide, 0);
            rrect(g, x, y - h / 2, w, h, S(2)); g.fillStyle = theme.colors.panel; g.fill(); g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = S(1.2); g.stroke();
            g.beginPath(); g.arc(x + S(18), y, S(4.5), 0, 2 * PI); g.fillStyle = col(l.dot || 'white'); g.shadowColor = col(l.dot || 'white'); g.shadowBlur = S(8); g.fill(); g.shadowBlur = 0;
            text(shown, x + S(34), y + S(1), size, { tracking: tr, color: l.color || '#fff', weight: l.weight || 600 });
          }
          else if (l.type === 'lower-title') {
            const x = W * (l.x ?? .17), y0 = H * (l.y ?? .68), rows = l.lines || [], gap = S(l.gap ?? 56);
            const rev = easeOut(tm.el / .6);
            g.translate(0, (1 - rev) * S(18)); g.globalAlpha *= rev;
            const total = gap * (rows.length + (l.meta ? .7 : 0));
            const centered = l.align === 'center';
            if (!centered) { g.fillStyle = 'rgba(255,255,255,.75)'; g.fillRect(x - S(22), y0 - gap * .5, S(2.5), total); }
            rows.forEach((r, i) => {
              const f = r.font || theme.fonts.title, y = y0 + gap * (i + .05);
              const str = r.gradient || r.upper ? up(r.text) : r.text;
              const weight = r.weight ?? (r.gradient ? 700 : 500);
              const w = measure(str, r.size ?? 50, { weight, font: f });
              const left = centered ? x - w / 2 : x;
              if (r.gradient) { const gr = g.createLinearGradient(left, 0, left + w, 0); r.gradient.forEach((c, k) => gr.addColorStop(k / (r.gradient.length - 1 || 1), col(c))); text(str, left, y, r.size ?? 50, { weight, font: f, color: gr }); }
              else text(str, left, y, r.size ?? 50, { weight, font: f, color: col(r.color || 'white') });
            });
            if (l.meta) text(l.meta, x, y0 + gap * (rows.length + .1), l.metaSize ?? 25, { align: centered ? 'center' : 'left', weight: 500, font: theme.fonts.title, color: 'rgba(255,255,255,.8)' });
          }
          else if (l.type === 'counter') {
            const a = anchor(l, view, u); if (!a) { g.restore(); continue; }
            const k = easeOut(tm.el / (l.count ?? 1.1)), v = (l.from ?? 0) + ((l.value ?? 0) - (l.from ?? 0)) * k;
            const str = l.text != null ? l.text : `${l.prefix || ''}${(+v).toFixed(l.decimals ?? 0).replace('.', ',')}${l.suffix || ''}`;
            const rev = easeOut(tm.el / .4); g.translate(0, (1 - rev) * S(14)); g.globalAlpha *= rev;
            const size = l.size ?? 70; g.shadowColor = col(l.color || 'yellow'); g.shadowBlur = S(14);
            text(up(str), a.x, a.y, size, { align: 'center', weight: l.weight || 800, font: fontOf(l, 'num'), color: col(l.color || 'yellow'), shadow: false, tracking: l.tracking ?? 1 });
            g.shadowBlur = 0;
            if (l.label) text(up(l.label), a.x, a.y + S(size * .62), l.labelSize ?? 20, { align: 'center', weight: 600, tracking: 3, color: 'rgba(255,255,255,.82)' });
          }
          else if (l.type === 'hemicycle') {
            const a = anchor(l, view, u); if (!a) { g.restore(); continue; }
            const R = S(l.radius ?? 150), rows = l.rows ?? 8, total = l.seats ?? 100, inner = l.inner ?? .45;
            const rev = easeOut(tm.el / .5); g.globalAlpha *= rev;
            // posiciones: filas con asientos proporcionales al radio
            const radii = Array.from({ length: rows }, (_, i) => R * (inner + (1 - inner) * i / Math.max(1, rows - 1))), sumR = radii.reduce((s, r) => s + r, 0), seats = [];
            radii.forEach((r, i) => { const n = Math.max(2, Math.round(total * r / sumR)); for (let j = 0; j < n; j++) seats.push({ a: PI * (1 - j / (n - 1)), r }); });
            seats.sort((p, q) => q.a - p.a || p.r - q.r); // de izquierda a derecha
            const step = [...(l.steps || [{ t: 0, groups: [] }])].map(s => ({ ...s, at: T(s.t, 0) })).sort((p, q) => p.at - q.at);
            const cur = step.filter(s => t >= s.at).pop() || { at: -1, groups: [] }, prev = step.filter(s => t >= s.at).slice(-2, -1)[0] || { groups: [] };
            const colorsFor = (groups, n) => { const arr = []; groups.forEach(gr => { for (let i = 0; i < gr.n; i++) arr.push(col(gr.color)); }); while (arr.length < n) arr.push(null); return arr; };
            const cNow = colorsFor(cur.groups, seats.length), cPrev = colorsFor(prev.groups, seats.length);
            const sr = Math.max(S(1.6), R * (1 - inner) / Math.max(1, rows - 1) * .5 * (l.dot ?? 1));
            seats.forEach((s, i) => {
              const sweep = clamp((t - cur.at - (i / seats.length) * (l.sweep ?? .8)) / .18), c = sweep >= 1 || cur.at < 0 ? cNow[i] : sweep <= 0 ? cPrev[i] : cNow[i];
              const x = a.x + Math.cos(s.a) * s.r, y = a.y - Math.sin(s.a) * s.r;
              g.beginPath(); g.arc(x, y, sr * (sweep > 0 && sweep < 1 ? 1 + .6 * Math.sin(sweep * PI) : 1), 0, 2 * PI);
              g.fillStyle = c || col(l.dimColor || 'dim'); g.globalAlpha = tm.alpha * rev * (c ? 1 : .55); g.fill();
            });
            g.globalAlpha = tm.alpha * rev;
            g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(a.x - R - sr, a.y + sr * 2, 2 * R + 2 * sr, S(1.5));
            if (l.title) text(up(l.title), a.x, a.y + S(l.titleDy ?? 46), l.titleSize ?? 20, { align: 'center', weight: 700, tracking: 3 });
            const stats = cur.stats || [], nStats = stats.length;
            stats.forEach((st, k) => {
              const sx = a.x + (nStats > 1 ? (k - (nStats - 1) / 2) * S(l.statGap ?? 150) : 0), sy = a.y + S(l.statDy ?? 90), kk = easeOut((t - cur.at) / .9);
              const v = (st.from ?? 0) + (st.value - (st.from ?? 0)) * kk;
              text(String(Math.round(v)), sx, sy, st.size ?? l.statSize ?? 44, { align: 'center', weight: 800, font: theme.fonts.num, color: col(st.color || 'white') });
              if (st.label) text(up(st.label), sx, sy + S(34), l.statLabelSize ?? 13, { align: 'center', weight: 600, tracking: 1.5, color: 'rgba(255,255,255,.72)' });
            });
            if (cur.note) text(up(cur.note), a.x, a.y + S(l.noteDy ?? 190), l.noteSize ?? 14, { align: 'center', weight: 600, tracking: 2, color: col(cur.noteColor || 'white') });
          }
          else if (l.type === 'portrait') {
            const a = anchor(l, view, u); if (!a) { g.restore(); continue; }
            const r = S(l.size ?? 62) * pop(tm.p), c = col(l.color || 'white'), im = image(l.src);
            const fl = tm.el < .3 ? (Math.floor(tm.el * 30) % 2 ? .45 : 1) : 1; g.globalAlpha *= fl;
            g.shadowColor = c; g.shadowBlur = S(18); octagon(g, a.x, a.y, r + S(5)); g.fillStyle = 'rgba(6,10,18,.9)'; g.fill(); g.shadowBlur = 0;
            if (im && im.width) { g.save(); octagon(g, a.x, a.y, r); g.clip(); const z = Math.max(2 * r / im.width, 2 * r / im.height), f = l.focus || [.5, .3]; g.drawImage(im, a.x - r + (2 * r - im.width * z) * f[0], a.y - r + (2 * r - im.height * z) * f[1], im.width * z, im.height * z); if (l.gray) { g.globalCompositeOperation = 'saturation'; g.fillStyle = '#000'; g.fillRect(a.x - r, a.y - r, 2 * r, 2 * r); } g.restore(); }
            if (!(im && im.width)) { g.save(); octagon(g, a.x, a.y, r); g.clip(); g.fillStyle = '#1b2434'; g.fillRect(a.x - r, a.y - r, 2 * r, 2 * r); g.fillStyle = '#56627a'; g.beginPath(); g.arc(a.x, a.y - r * .18, r * .34, 0, 2 * PI); g.fill(); g.beginPath(); g.ellipse(a.x, a.y + r * .85, r * .72, r * .6, 0, 0, 2 * PI); g.fill(); g.restore(); }
            octagon(g, a.x, a.y, r + S(5)); g.strokeStyle = c; g.lineWidth = S(3.2); g.stroke();
            if (l.name) {
              const nameSize = l.nameSize ?? 17, roleSize = l.roleSize ?? 11;
              const nameY = Math.max(l.role ? 14 : 15, nameSize / 2 + (l.role ? 5.5 : 6.5));
              const roleY = nameY + Math.max(17, (nameSize + roleSize) / 2 + 3);
              const height = l.role ? Math.max(44, roleY + roleSize / 2 + 7.5) : Math.max(30, nameY + nameSize / 2 + 6.5);
              const nw = Math.max(measure(up(l.name), nameSize, { tracking: 1.2 }), l.role ? measure(up(l.role), roleSize, { tracking: 1 }) : 0) + S(26), ny = a.y + r + S(14), nh = S(height);
              g.fillStyle = 'rgba(6,10,18,.88)'; g.fillRect(a.x - nw / 2, ny, nw, nh); g.fillStyle = c; g.fillRect(a.x - nw / 2, ny + nh - S(2.5), nw, S(2.5));
              text(up(l.name), a.x, ny + S(nameY), nameSize, { align: 'center', weight: 700, tracking: 1.2, shadow: false });
              if (l.role) text(up(l.role), a.x, ny + S(roleY), roleSize, { align: 'center', weight: 600, tracking: 1, color: 'rgba(255,255,255,.7)', shadow: false });
            }
          }
          else if (l.type === 'photo-frame') {
            const a = anchor(l, view, u); if (!a) { g.restore(); continue; }
            const w = S(l.w ?? 300), asp = l.aspect ?? 1.6, h = w / asp, x = a.x - w / 2, y = a.y - h / 2, c = col(l.color || '#5ab0ff');
            const open = easeOut(tm.el / .45), im = image(l.src), cl = S(l.corner ?? 22);
            if (im && im.width && open > .3) { g.save(); g.globalAlpha *= clamp((open - .3) / .7) * (tm.el < .6 && Math.floor(tm.el * 24) % 3 === 0 ? .6 : 1); g.beginPath(); g.rect(x, y, w, h); g.clip(); const z = Math.max(w / im.width, h / im.height) * (1 + .05 * clamp(tm.el / 8)), f = l.focus || [.5, .5]; g.drawImage(im, x + (w - im.width * z) * f[0], y + (h - im.height * z) * f[1], im.width * z, im.height * z); const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,10,25,.35)'); g.fillStyle = gr; g.fillRect(x, y, w, h); g.restore(); }
            g.strokeStyle = c; g.lineWidth = S(3); g.shadowColor = c; g.shadowBlur = S(10);
            const pad = S(8) * (1 - open) + S(8), X0 = x - pad, Y0 = y - pad, X1 = x + w + pad, Y1 = y + h + pad;
            for (const [cx, cy, sx, sy] of [[X0, Y0, 1, 1], [X1, Y0, -1, 1], [X0, Y1, 1, -1], [X1, Y1, -1, -1]]) { g.beginPath(); g.moveTo(cx, cy + sy * cl); g.lineTo(cx, cy); g.lineTo(cx + sx * cl, cy); g.stroke(); }
            g.shadowBlur = 0;
            if (l.caption) text(up(l.caption), a.x, Y1 + S(16), l.captionSize ?? 12, { align: 'center', weight: 600, tracking: 2, color: 'rgba(255,255,255,.75)' });
          }
          else if (l.type === 'chip') {
            const a = anchor(l, view, u); if (!a) { g.restore(); continue; }
            const r = S(l.size ?? 36) * pop(tm.p), c = col(l.color || 'blue');
            const ph = (tm.el % 2) / 2; g.strokeStyle = c; g.lineWidth = S(2); g.globalAlpha *= 1; g.beginPath(); g.arc(a.x, a.y, r * (1 + .35 * ph), 0, 2 * PI); const ga = g.globalAlpha; g.globalAlpha = ga * (1 - ph) * .5; g.stroke(); g.globalAlpha = ga;
            g.shadowColor = c; g.shadowBlur = S(16); g.beginPath(); g.arc(a.x, a.y, r, 0, 2 * PI); g.fillStyle = 'rgba(6,12,24,.82)'; g.fill(); g.lineWidth = S(3); g.stroke(); g.shadowBlur = 0;
            g.save(); g.translate(a.x, a.y); g.scale(r * .5, r * .5); g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineWidth = 0.14;
            if (l.glyph) { g.restore(); text(l.glyph, a.x, a.y + S(2), (l.size ?? 36) * .95, { align: 'center', weight: 800, font: theme.fonts.num, color: l.glyphColor || '#fff', shadow: false }); }
            else { drawIcon(g, l.icon); g.restore(); }
            if (l.badge) { const bx = a.x + r * .72, by = a.y - r * .72; g.beginPath(); g.arc(bx, by, S(9), 0, 2 * PI); g.fillStyle = 'rgba(6,12,24,.95)'; g.fill(); g.strokeStyle = col(l.badge); g.lineWidth = S(2.5); g.stroke(); g.beginPath(); g.arc(bx, by, S(3), 0, 2 * PI); g.fillStyle = col(l.badge); g.fill(); }
            if (l.label) text(up(l.label), a.x, a.y + r + S(18), l.labelSize ?? 13, { align: 'center', weight: 700, tracking: 1.6, color: col(l.labelColor || 'white') });
          }
          else if (l.type === 'icon-grid') {
            const a = anchor(l, view, u); if (!a) continue;
            const names = l.names || Object.keys(library).filter(n => library[n].categoria === (l.category || 'conflicto'));
            const cols = Math.max(1, Math.floor(l.cols ?? (portrait ? 4 : 6))), rows = Math.ceil(names.length / cols);
            if (!rows) continue;
            const width = Math.min(W * .9, S(l.width ?? 960)), cellW = width / cols, size = S(l.size ?? 32), fs = l.labelSize ?? 20;
            const lineH = S(fs * 1.15), labels = names.map(name => {
              const lines = [''];
              for (const part of String(name).split('-')) {
                const i = lines.length - 1, next = lines[i] ? lines[i] + '-' + part : part;
                if (lines[i] && measure(next, fs) > cellW - S(12)) lines.push(part); else lines[i] = next;
              }
              return lines;
            });
            const cellH = size * 2 + Math.max(...labels.map(ls => ls.length)) * lineH + S(22), height = rows * cellH;
            g.globalAlpha *= easeOut(tm.el / .45);
            names.forEach((name, i) => {
              const x = a.x - width / 2 + (i % cols + .5) * cellW, y = a.y - height / 2 + Math.floor(i / cols) * cellH + size;
              g.save(); g.translate(x, y); g.scale(size, size); g.lineWidth = .14; g.strokeStyle = col(l.color || 'white'); g.fillStyle = col(l.color || 'white'); drawIcon(g, name); g.restore();
              labels[i].forEach((line, j) => text(line, x, y + size + S(12) + j * lineH, fs, { align:'center', color:col(l.color || 'white'), weight:l.weight || 600 }));
            });
          }
          else if (l.type === 'flag-chip' || l.type === 'logo-chip') {
            const a = anchor(l, view, u); if (!a) continue;
            const logo = l.type === 'logo-chip', w = S(l.size ?? (logo ? 100 : 112)) * pop(tm.p), h = logo || l.shape === 'round' ? w : w * .75;
            const x = a.x - w / 2, y = a.y - h / 2, c = col(l.color || 'white'), im = image(l.src);
            const shape = () => { if (l.shape === 'round') { g.beginPath(); g.arc(a.x, a.y, w / 2, 0, 2 * PI); } else rrect(g, x, y, w, h, S(logo ? 12 : 3)); };
            g.globalAlpha *= easeOut(tm.el / .3);
            g.save(); shape(); g.clip();
            if (l.plate !== false) { g.fillStyle = logo ? (typeof l.plate === 'string' ? col(l.plate) : '#fff') : '#0b1424'; g.fillRect(x,y,w,h); }
            if (im && im.width && im.height) {
              const fit = Math.min(w / im.width, h / im.height), pad = logo ? .84 : 1;
              g.drawImage(im, a.x - im.width * fit * pad / 2, a.y - im.height * fit * pad / 2, im.width * fit * pad, im.height * fit * pad);
            } else {
              const initials = String(l.label || (logo ? '?' : l.code || '?')).trim().split(/\s+/).slice(0,2).map(s => s[0]).join('').toUpperCase();
              text(initials, a.x, a.y, (l.size ?? 100) * .3, {align:'center',color:logo && l.plate !== false ? '#12213a' : c,shadow:false});
            }
            g.restore(); shape(); g.strokeStyle = c; g.lineWidth = S(1.5); g.stroke();
            if (l.label) text(up(l.label), a.x, a.y + h / 2 + S(23), l.labelSize ?? 20, {align:'center',color:c,weight:l.weight || 700});
          }
          else if (l.type === 'city') {
            const a = anchor(l, view, u); if (!a) { g.restore(); continue; }
            const side = l.side || 'top', pr = l.pulse ? (tm.el % 1.6) / 1.6 : 0;
            if (l.pulse) { g.strokeStyle = col(l.color || 'white'); g.lineWidth = S(2); const ga = g.globalAlpha; g.globalAlpha = ga * (1 - pr) * .7; g.beginPath(); g.arc(a.x, a.y, S(6 + 22 * pr), 0, 2 * PI); g.stroke(); g.globalAlpha = ga; }
            g.beginPath(); g.arc(a.x, a.y, S(l.r ?? 6), 0, 2 * PI); g.fillStyle = col(l.color || 'white'); g.shadowColor = '#000'; g.shadowBlur = S(6); g.fill(); g.shadowBlur = 0;
            const lab = up(l.text), size = l.size ?? 17, d = S(14);
            const pos = { top: [0, -d - S(3), 'center'], bottom: [0, d + S(3), 'center'], right: [d, 0, 'left'], left: [-d, 0, 'right'] }[side] || [0, -d, 'center'];
            if (lab) text(lab, a.x + pos[0], a.y + pos[1], size, { align: pos[2], weight: 700, tracking: 1.4 });
          }
          else if (l.type === 'note') {
            const a = anchor(l, view, u); if (!a) { g.restore(); continue; }
            const size = l.size ?? 13, str = up(l.text), tr = l.tracking ?? 1.4, w = measure(str, size, { tracking: tr }) + S(30), h = S(24), shown = scramble(str, easeOut(tm.el / .5), t, l._i);
            rrect(g, a.x - w / 2, a.y - h / 2, w, h, S(2)); g.fillStyle = theme.colors.panel; g.fill(); g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = S(1); g.stroke();
            g.beginPath(); g.arc(a.x - w / 2 + S(11), a.y, S(3.2), 0, 2 * PI); g.fillStyle = col(l.dot || 'orange'); g.fill();
            text(shown, a.x - w / 2 + S(22), a.y + S(1), size, { tracking: tr, weight: 600, shadow: false, color: l.color || '#fff' });
          }
          else if (l.type === 'glow') {
            const pts = (l.points || [l.at]).filter(Boolean), c = col(l.color || 'orange');
            pts.forEach((pt, i) => {
              const q = anchor({ ...l, at: pt, dx: 0, dy: 0 }, view, u); if (!q) return;
              const ph = ((t * (l.speed ?? .8) + hash(i + 1)) % 1), r = S(l.r ?? 22) * (.7 + .5 * Math.sin(ph * 2 * PI) * .5 + .3);
              const gr = g.createRadialGradient(q.x, q.y, 0, q.x, q.y, r); gr.addColorStop(0, c); gr.addColorStop(.35, c + '99'); gr.addColorStop(1, c + '00');
              g.globalAlpha = tm.alpha * easeOut((tm.el - i * (l.stagger ?? .12)) / .3); g.fillStyle = gr; g.beginPath(); g.arc(q.x, q.y, r, 0, 2 * PI); g.fill();
            });
          }
        } finally { g.restore(); }
      }
    } finally { g.restore(); }
  }
  return { items, theme, ready: () => Promise.all(jobs).then(() => undefined), draw, missing: () => [...failed] };
}
