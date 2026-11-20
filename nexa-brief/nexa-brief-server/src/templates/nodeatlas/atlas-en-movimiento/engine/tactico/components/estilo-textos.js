import {Tactico} from '../core.js';

// Piezas de texto del estilo (V4 Atlas y compatibles). Todo se dibuja en px del lienzo de diseño
// (1080x1920 o 1920x1080) escalado por min(W,H)/1080; los valores salen de env.estilo (ver estilos/ESTILO.md).
const styled = env => !!(env.estilo && env.estilo.id !== 'clasico');
export const isStyled = styled;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
function frame(g, env) { const u = Math.min(env.W, env.H) / 1080; g.save(); g.scale(u, u); return {W: env.W / u, H: env.H / u, u}; }
function pt(s, view, env, fb) { // posición del ítem: screen normalizado, lugar/lon-lat o ranura (fb = [x,y] en px de diseño)
  const i = s.item, u = Math.min(env.W, env.H) / 1080;
  if (i.screen) return {x: i.screen[0] * env.W / u, y: i.screen[1] * env.H / u};
  const p = s.pos || i.at;
  const q = Array.isArray(p) ? view.project(p[0], p[1]) : p?.lon != null ? view.project(p.lon, p.lat) : p?.x != null ? p : null;
  return q ? {x: q.x / u, y: q.y / u} : {x: fb[0], y: fb[1]};
}
function wrap(g, tok, text, maxW) {
  g.save(); g.font = tok.font; if ('fontStretch' in g) g.fontStretch = globalThis.__kw(tok.ancho); if ('letterSpacing' in g) g.letterSpacing = `${(tok.espaciado || 0) * tok.size}px`;
  const words = String(tok.mayusculas ? String(text).toLocaleUpperCase() : text).split(/\s+/), lines = []; let cur = '';
  for (const w of words) { const n = cur ? cur + ' ' + w : w; if (cur && maxW && g.measureText(n).width > maxW) { lines.push(cur); cur = w; } else cur = n; }
  if (cur) lines.push(cur); g.restore(); return lines;
}
function para(g, tok, text, x, y, maxW, opts = {}) { // devuelve la y siguiente
  const lines = wrap(g, tok, text, maxW), step = tok.size * (tok.interlinea || 1.1);
  lines.forEach((l, n) => tok.draw(g, tok.mayusculas ? l : l, x, y + n * step, {baseline: 'top', align: opts.align || 'left', color: opts.color}));
  return y + lines.length * step;
}
function width(g, tok, text) { g.save(); g.font = tok.font; if ('fontStretch' in g) g.fontStretch = globalThis.__kw(tok.ancho); if ('letterSpacing' in g) g.letterSpacing = `${(tok.espaciado || 0) * tok.size}px`; const w = g.measureText(tok.mayusculas ? String(text).toLocaleUpperCase() : String(text)).width; g.restore(); return w; }
const split = t => { const i = String(t).indexOf(' · '); return i < 0 ? [String(t), ''] : [t.slice(0, i), t.slice(i + 3)]; };

export function drawHeader(g, s, v, e) {
  const st = e.estilo, E = st.estilos.encabezado, sl = st.slot('encabezado') || {izq: 72, arriba: 200}, i = s.item, {u} = {u: 1};
  const f = frame(g, e), p = i.screen ? pt(s, v, e, [sl.izq, sl.arriba]) : {x: sl.izq, y: sl.arriba};
  const a = st.txt('encabezado.fecha'), b = st.txt('encabezado.lugar'), m = E.marca;
  let x = p.x;
  if (m?.visible) { const q = m.tam; g.fillStyle = st.col(m.color); g.fillRect(x, p.y + (a.size - q) / 2 + 1, q, q); x += q + m.margen; }
  a.draw(g, i.fecha ?? '', x, p.y, {baseline: 'top'});
  b.draw(g, i.lugar ?? '', p.x, p.y + a.size * (a.interlinea || 1.1) + (b.margenArriba ?? 6), {baseline: 'top'});
  g.restore();
}
export function drawStatement(g, s, v, e, jump) {
  const st = e.estilo, T = st.estilos.titular, sl = st.slot(jump ? 'salto' : (s.item.slot || 'titular')) || st.slot('titular') || {izq: 72, arriba: 300}, i = s.item, note = !jump && i.slot === 'nota';
  const f = frame(g, e), p = i.screen ? pt(s, v, e, [sl.izq, sl.arriba]) : {x: sl.izq, y: sl.arriba};
  const [a, b] = split(i.text ?? ''), tok = st.txt('titular.principal'), sec = st.txt('titular.secundario'), pad = T.relleno || [0, 0, 0, 24], bar = T.barra || {};
  const maxW = (T.anchoMax || 800) - pad[1] - pad[3];
  let tk = tok, text = a;
  if (note) { const k = .72; tk = {...tok, size: Math.round(tok.size * k)}; tk.font = `${tok.peso} ${tk.size}px ${tok.fuente}`; tk.draw = (gg, txt, x, y, op) => tok.draw(gg, txt, x, y, {...op, font: tk.font}); }
  if (jump && T.salto?.principal) { const o = T.salto.principal; tk = {...tok, size: o.tam ?? tok.size, peso: o.peso ?? tok.peso, mayusculas: o.mayusculas ?? tok.mayusculas, espaciado: o.espaciado ?? tok.espaciado}; tk.font = `${tk.peso} ${tk.size}px ${tok.fuente}`; tk.draw = (gg, txt, x, y, op) => tok.draw(gg, tk.mayusculas ? String(txt).toLocaleUpperCase() : txt, x, y, {...op, font: tk.font}); }
  const x = p.x + pad[3], y0 = p.y + pad[0];
  let y = para(g, tk, text, x, y0, maxW);
  if (b) y = para(g, sec, b, x, y + (sec.margenArriba ?? 8), maxW);
  if (bar.visible && !note) { g.fillStyle = st.col(bar.color); g.fillRect(p.x, p.y, bar.grosor, y - p.y + pad[2]); }
  g.restore();
}
export function drawYear(g, s, v, e) {
  const st = e.estilo, A = st.estilos.anio, sl = st.slot('anio') || {izq: 72, arriba: 300}, i = s.item, tok = st.txt('anio.texto');
  const f = frame(g, e), p = i.screen ? pt(s, v, e, [sl.izq, sl.arriba]) : {x: sl.izq, y: sl.arriba};
  const text = String(i.text ?? ''), w = width(g, tok, text), al = i.screen ? 'center' : 'left', x = i.screen ? p.x : p.x;
  tok.draw(g, text, i.screen ? x - w / 2 : x, p.y, {baseline: 'top'});
  if (A.barra?.visible) { g.fillStyle = st.col(A.barra.color); g.fillRect(i.screen ? x - w / 2 : x, p.y + tok.size * (tok.interlinea || .9) + (A.barra.margenArriba ?? 12), w, A.barra.grosor); }
  g.restore();
}
export function drawLegend(g, s, v, e) {
  const st = e.estilo, L = st.estilos.leyenda, sl = st.slot('leyenda') || {izq: 72, arriba: 1300}, i = s.item, tok = st.txt('leyenda');
  const f = frame(g, e), p = i.screen ? pt(s, v, e, [sl.izq, sl.arriba]) : {x: sl.izq, y: sl.arriba}, text = i.text ?? '', m = L.muestra || {ancho: 56, grosor: 4, dash: 'dashed'}, ln = st.trazos?.frente?.linea || {color: 'acento', dash: [16, 9]};
  const sw = i.muestra === false ? 0 : m.ancho + 16, w = width(g, tok, text) + sw, right = sl.der != null && sl.izq == null;
  const x0 = right ? f.W - sl.der - w : p.x;
  if (sw) { g.strokeStyle = st.col(ln.color); g.lineWidth = m.grosor; g.setLineDash(ln.dash || [16, 9]); g.beginPath(); g.moveTo(x0, p.y + tok.size / 2); g.lineTo(x0 + m.ancho, p.y + tok.size / 2); g.stroke(); g.setLineDash([]); }
  tok.draw(g, text, x0 + sw, p.y, {baseline: 'top'}); g.restore();
}
export function drawCountry(g, s, v, e) {
  const st = e.estilo, tok = st.txt('pais'), i = s.item, f = frame(g, e), p = pt(s, v, e, [f.W / 2, f.H * .45]), text = String(i.text ?? '');
  const w = width(g, tok, text), pad = (tok.espaciado || 0) * tok.size / 2;
  tok.draw(g, text, p.x - w / 2 + pad, p.y, {baseline: 'middle', color: i.color && i.color !== 'text' ? st.col(st.colores?.[i.color] ? i.color : 'tinta') : undefined}); g.restore();
}
export function drawLandUnit(g, s, v, e) {
  const st = e.estilo, T = st.estilos.tierra || {}, M = st.marcadores.unidadTierra, i = s.item, f = frame(g, e), p = pt(s, v, e, [f.W / 2, f.H * .5]);
  const tk = n => { try { return st.txt(n); } catch { return st.txt('unidad.nombre'); } };
  const a = tk('tierra.a'), b = st.estilos.tierra ? tk('tierra.b') : st.txt(st.estilos.unidad?.tipo ? 'unidad.tipo' : 'unidad.nombre'), q = M.tam, sep = T.separacion || 12, wa = width(g, a, i.a ?? ''), wb = width(g, b, i.b ?? '');
  const total = q + sep + wa + 10 + wb, x0 = i.alinear === 'der' ? p.x - total : p.x, actor = i.actor !== false;
  g.lineWidth = M.grosor || 2; if (actor) { g.fillStyle = st.col(M.atacante.relleno); g.strokeStyle = st.col(M.atacante.borde); g.fillRect(x0, p.y - q / 2, q, q); } else { g.strokeStyle = st.col(M.otro.borde); g.strokeRect(x0, p.y - q / 2, q, q); }
  a.draw(g, i.a ?? '', x0 + q + sep, p.y, {baseline: 'middle'}); b.draw(g, i.b ?? '', x0 + q + sep + wa + 10, p.y, {baseline: 'middle'}); g.restore();
}
export function drawIntroStyled(g, s, v, e) {
  const st = e.estilo, P = st.estilos.portada, sl = st.slot('portada') || {izq: 72, arriba: 300}, i = s.item, f = frame(g, e), t = s.lt, dur = i.dur ?? 6;
  const a = clamp(t / .5) * clamp((dur - t) / .42);
  g.globalAlpha *= a; let y = sl.arriba;
  const k = st.txt('portada.kicker'), ti = st.txt('portada.titulo'), yr = st.txt('portada.anio'), sb = st.txt('portada.sub');
  if (i.kicker) { k.draw(g, i.kicker, sl.izq, y, {baseline: 'top'}); y += k.size * (k.interlinea || 1) + (ti.margenArriba ?? 22); }
  String(i.title ?? '').split('\n').forEach(l => { ti.draw(g, l, sl.izq, y, {baseline: 'top'}); y += ti.size * (ti.interlinea || .9); });
  y += P.meta?.margenArriba ?? 26; let x = sl.izq;
  if (i.year) { const w = width(g, yr, i.year), pd = P.anio?.relleno || [6, 12, 5, 12]; g.strokeStyle = st.col(P.anio?.borde?.color || 'tinta2'); g.lineWidth = P.anio?.borde?.grosor || 2; g.strokeRect(x, y - pd[0], w + pd[1] + pd[3], yr.size + pd[0] + pd[2]); yr.draw(g, i.year, x + pd[3], y, {baseline: 'top'}); x += w + pd[1] + pd[3] + (P.meta?.separacion ?? 18); }
  if (i.subtitle) sb.draw(g, i.subtitle, x, y + (yr.size - sb.size) / 2, {baseline: 'top'});
  g.restore();
}
export function drawOutroStyled(g, s, v, e) {
  const st = e.estilo, C = st.estilos.cierre, i = s.item, f = frame(g, e), t = s.lt, dur = i.dur ?? 8, a = clamp(t / .5) * clamp((dur - t) / .42);
  g.save(); g.globalAlpha *= a * (i.dim ?? .45); g.fillStyle = st.col('sombra'); g.fillRect(0, 0, f.W, f.H); g.restore(); // oscurece el mapa para que el cierre se lea
  g.globalAlpha *= a; const x = (st.slot('titular')?.izq ?? 72), k = st.txt('cierre.k'), ch = st.txt('cierre.canal'), tt = st.txt('cierre.t'), h = st.txt('cierre.h');
  let y = f.H * .3; k.draw(g, i.thanks ?? 'GRACIAS POR VER', x, y, {baseline: 'top'}); y += k.size + 20;
  ch.draw(g, i.channel ?? '', x, y, {baseline: 'top'}); y += ch.size * (ch.interlinea || .9) + 30;
  g.fillStyle = st.col('acento'); g.beginPath(); g.arc(x + 4, y, 4, 0, Math.PI * 2); g.fill(); y += 28;
  y = para(g, tt, i.support ?? '', x, y, f.W - 2 * x); y += 16; h.draw(g, i.handle ?? '', x, y, {baseline: 'top'}); g.restore();
}

const P = (type, d, extra = {}) => ({type, default: d, ...extra});
const demoT = {t: 0, dur: 6, out: 5.5};
const guard = fn => (g, s, v, e) => { if (styled(e)) fn(g, s, v, e); };
Tactico.component('header.date', {layer: 90, summary: 'Encabezado de estilo: marca cuadrada de acento, fecha y lugar en pila, en la ranura «encabezado».', params: {fecha: P('string', '24 JUL 1987'), lugar: P('string', 'AL OESTE DE FARSI'), screen: P('array', null)}, states: [],
  validate: i => String(i.fecha ?? '').trim() ? [] : ['fecha es obligatoria'], draw: guard(drawHeader), demo: {type: 'header.date', fecha: '24 JUL 1987', lugar: 'AL OESTE DE FARSI', ...demoT}});
Tactico.component('statement.title', {layer: 90, summary: 'Titular con barra de acento; el « · » separa el dato principal del secundario. Ranura «titular».', params: {text: P('string', 'Abadán resiste el asedio'), slot: P('string', 'titular'), screen: P('array', null)}, states: [],
  validate: i => String(i.text ?? '').trim() ? [] : ['text es obligatorio'], draw: guard((g, s, v, e) => drawStatement(g, s, v, e, false)), demo: {type: 'statement.title', text: 'Frank C. Seitz, Jr. · capitán del Bridgeton', ...demoT}});
Tactico.component('statement.jump', {layer: 90, summary: 'Salto temporal («Siete años antes») en versales espaciadas, en la ranura «salto».', params: {text: P('string', 'Siete años antes'), screen: P('array', null)}, states: [],
  validate: i => String(i.text ?? '').trim() ? [] : ['text es obligatorio'], draw: guard((g, s, v, e) => drawStatement(g, s, v, e, true)), demo: {type: 'statement.jump', text: 'Siete años antes', ...demoT}});
Tactico.component('year.big', {layer: 90, summary: 'Año grande con subrayado de acento, en la ranura «anio» (o centrado si se da screen).', params: {text: P('string', '1982'), screen: P('array', null)}, states: [],
  validate: i => String(i.text ?? '').trim() ? [] : ['text es obligatorio'], draw: guard(drawYear), demo: {type: 'year.big', text: '1982', ...demoT}});
Tactico.component('legend.front', {layer: 90, summary: 'Leyenda de método: muestra del trazo discontinuo del frente y texto, siempre secundaria.', params: {text: P('string', 'Frente aproximado · flechas: direcciones'), muestra: P('boolean', true), screen: P('array', null)}, states: [],
  validate: i => String(i.text ?? '').trim() ? [] : ['text es obligatorio'], draw: guard(drawLegend), demo: {type: 'legend.front', text: 'Frente aproximado · flechas: direcciones', ...demoT}});
Tactico.component('label.country', {layer: 70, summary: 'Nombre de país en versales espaciadas, sin neón ni brillo; sobre un lugar o en screen.', params: {text: P('string', 'IRAK'), color: P('string', 'text'), at: P('place', null), screen: P('array', null)}, states: [],
  validate: i => [...(String(i.text ?? '').trim() ? [] : ['text es obligatorio']), ...(i.at == null && i.screen == null ? ['indica at (lugar o [lon,lat] dentro del país) o screen: cada nombre va sobre su país'] : [])], draw: guard(drawCountry), demo: {type: 'label.country', text: 'IRAK', screen: [.5, .45], ...demoT}});
Tactico.component('label.landunit', {layer: 70, summary: 'Rótulo de unidades terrestres: cuadrado del bando (relleno si ataca, hueco si no), país y acción («IRAK avanza», «IRÁN avanza», «IRAK se retira»).', params: {a: P('string', 'IRAK'), b: P('string', 'avanza'), actor: P('boolean', true), alinear: P('string', 'izq'), at: P('place', null), screen: P('array', null)}, states: [],
  validate: i => [...(String(i.a ?? '').trim() ? [] : ['a (país) es obligatorio']), ...(i.at == null && i.screen == null ? ['indica at o screen'] : [])], draw: guard(drawLandUnit), demo: {type: 'label.landunit', a: 'IRÁN', b: 'avanza', actor: true, screen: [.35, .5], ...demoT}});
