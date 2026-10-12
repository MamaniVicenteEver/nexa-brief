/* ======================= NÚCLEO COMÚN (promo-*) =========================
   Compartido por las 6 plantillas de commercial/ (promo-trendy,
   promo-dynamic, promo-urban, promo-sports, promo-editorial y
   promo-kinetic). Contrato:
   · config.json  = colección { activeId, configs: [ CASO ] } (como neon /
     caution): audio, lyricsUrl, paleta, fuentes, MEDIA (videos / imágenes)
     y la coreografía `scenes` (tipo de escena + media por escena).
   · lyricsUrl   = guion en formato Whisper { segments: [ { start, end, text,
     words: [ { word, start, end } ] } ] }. UN segmento = UNA escena (corte en
     segment.start, palabras que aparecen en word.start). Campos extra
     opcionales por segmento: "lines" (cómo partir el texto en renglones) y
     "sub" (texto chico de acompañamiento). Una transcripción real de Whisper
     también sirve tal cual.
   · Todo se anima con Tracks propios (interpolan y escriben style solo si
     cambia; sin Web Animations → nada se promueve a capa y el headless no se
     hunde) posicionados con el reloj del audio: ?t=SEG congela un cuadro y
     los videos se buscan a ese instante exacto.
   Servir por HTTP (python3 -m http.server): por file:// el fetch se bloquea. */
const doc = document, $ = id => doc.getElementById(id);
const QS = new URLSearchParams(location.search);
const FROZEN = QS.has("t") ? parseFloat(QS.get("t")) : null;

async function loadDB() {
  for (const u of ["config.json", `assets/${NAME}.config.json`, "assets/config.json"]) {
    try { const r = await fetch(u); if (r.ok) return await r.json(); } catch (e) {}
  }
  console.warn(`[${NAME}] config.json no disponible — usando DEFAULT_CONFIG embebido`);
  return DEFAULT_CONFIG;
}
/* merge profundo de objetos; los arrays (media, scenes…) se reemplazan enteros */
function deepMerge(a, b) {
  if (Array.isArray(b) || typeof b !== "object" || b === null) return b === undefined ? a : b;
  const out = { ...(typeof a === "object" && a && !Array.isArray(a) ? a : {}) };
  for (const k of Object.keys(b)) out[k] = deepMerge(out[k], b[k]);
  return out;
}
const DB = await loadDB();
const RAW = DB.configs.find(c => c.id === ACTIVE_ID) || DB.configs.find(c => c.id === DB.activeId) || DB.configs[0];
const C = deepMerge(DEFAULT_CONFIG.configs[0], RAW);
const DEBUG = C.debug?.enabled || QS.get("debug") === "1";
if (C.fonts?.googleUrl) {
  const link = doc.querySelector('link[href^="https://fonts.googleapis.com/css2"]');
  if (link && link.href !== C.fonts.googleUrl) link.href = C.fonts.googleUrl;
}
for (const [k, v] of Object.entries(C.palette || {})) doc.documentElement.style.setProperty("--" + k, v);

function mulberry32(a) { return function() {
  a |= 0; a = a + 0x6D2B79F5 | 0;
  let t = Math.imul(a ^ a >>> 15, 1 | a);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const EASE_OUT = "cubic-bezier(.16,.84,.24,1)", EASE_IN = "cubic-bezier(.6,0,.9,.4)", EASE_IO = "cubic-bezier(.65,0,.3,1)";
const EASE_BACK = "cubic-bezier(.3,1.5,.5,1)";

/* ---------------- Tracks: interpolación propia, seek determinista ---------------- */
const NUM = /-?\d*\.?\d+(?:e-?\d+)?/g;
function lerpStr(a, b, p) {
  if (p <= 0 || a === b) return a;
  if (p >= 1) return b;
  const na = a.match(NUM), nb = b.match(NUM);
  if (!na || !nb || na.length !== nb.length) return p < 0.5 ? a : b;
  let i = 0;
  return b.replace(NUM, () => { const v = +na[i] + (+nb[i] - +na[i]) * p; i++; return String(Math.round(v * 1000) / 1000); });
}
const easeCache = new Map();
function easeFn(spec) {
  let f = easeCache.get(spec);
  if (f) return f;
  const m = /cubic-bezier\(([^)]+)\)/.exec(spec);
  if (!m) f = spec.startsWith("steps") ? () => 0 : p => p;
  else {
    const [x1, y1, x2, y2] = m[1].split(",").map(Number);
    const bz = (t, a, b) => 3 * a * t * (1 - t) * (1 - t) + 3 * b * t * t * (1 - t) + t * t * t;
    const dbz = (t, a, b) => 3 * a * (1 - t) * (1 - t) + 6 * (b - a) * t * (1 - t) + 3 * (1 - b) * t * t;
    f = x => {
      let t = x;
      for (let i = 0; i < 6; i++) { const d = dbz(t, x1, x2); if (Math.abs(d) < 1e-6) break; t -= (bz(t, x1, x2) - x) / d; t = clamp(t, 0, 1); }
      return bz(t, y1, y2);
    };
  }
  easeCache.set(spec, f);
  return f;
}
class Track {
  constructor(el, prop, init, discrete = false) { this.el = el; this.prop = prop; this.discrete = discrete; this.keys = [[0, init, "linear"]]; }
  get last() { return this.keys[this.keys.length - 1][1]; }
  set(t, v) { this.keys.push([t, v, "linear"]); return this; }
  to(t0, d, v, ease = "linear") { this.keys.push([t0, this.last, ease]); this.keys.push([t0 + Math.max(0.001, d), v, "linear"]); return this; }
  compile() {
    this.ks = this.keys.slice().sort((a, b) => a[0] - b[0]).map(([t, v, e]) => [t, v, easeFn(this.discrete ? "steps" : e)]);
    this.a = Infinity; this.b = -Infinity;
    for (let i = 1; i < this.ks.length; i++)
      if (this.ks[i][1] !== this.ks[i - 1][1]) { this.a = Math.min(this.a, this.ks[i - 1][0]); this.b = Math.max(this.b, this.ks[i][0]); }
    this.side = null; this.cur = undefined;
  }
  value(t) {
    const ks = this.ks;
    if (t <= ks[0][0]) return ks[0][1];
    for (let i = ks.length - 1; i >= 0; i--) {
      if (t < ks[i][0]) continue;
      const nx = ks[i + 1];
      if (!nx) return ks[i][1];
      const span = nx[0] - ks[i][0];
      return span <= 0 ? nx[1] : lerpStr(ks[i][1], nx[1], ks[i][2]((t - ks[i][0]) / span));
    }
    return ks[0][1];
  }
  seek(t) {
    const side = t < this.a ? -1 : t > this.b ? 1 : 0;
    if (side !== 0 && side === this.side) return;
    this.side = side;
    const v = this.value(t);
    if (v !== this.cur) {
      if (this.prop[0] === "@") this.el[this.prop.slice(1)] = v;   /* "@textContent" → propiedad directa */
      else this.el.style[this.prop] = v;
      this.cur = v;
    }
  }
}

/* ---------------- DOM, texto, medición ---------------- */
function div(parent, cls, css) {
  const d = doc.createElement("div");
  if (cls) d.className = cls;
  if (css) Object.assign(d.style, css);
  if (parent) parent.appendChild(d);
  return d;
}
const meas = (() => { const m = doc.createElement("span"); m.style.cssText = "position:absolute;left:-99999px;top:0;visibility:hidden;white-space:pre;font-size:100px;line-height:1"; doc.body.appendChild(m); return m; })();
const measCache = new Map();
function measure(text, cls, ls = 0) {
  const key = cls + "|" + ls + "|" + text;
  let m = measCache.get(key);
  if (!m) {
    meas.className = "tx " + cls; meas.style.letterSpacing = ls + "em"; meas.textContent = text;
    const r = meas.getBoundingClientRect();
    m = { w: Math.max(1, r.width), h: Math.max(1, r.height) };
    measCache.set(key, m);
  }
  return m;
}
const fit = (text, cls, ls, maxW, maxH) => { const m = measure(text, cls, ls); return 100 * Math.min(maxW / m.w, maxH / m.h); };
const textW = (text, cls, ls, fs) => measure(text, cls, ls).w * fs / 100;
/* texto decorativo enorme → <canvas> rasterizado UNA vez (mover un texto de
   1000+ px re-rasteriza cada cuadro en headless: 27 → 7 fps). Respeta fuente,
   peso, itálica, font-stretch, mayúsculas, espaciado, contorno y textura. */
const STRETCH = { "50%": "ultra-condensed", "62.5%": "extra-condensed", "75%": "condensed", "87.5%": "semi-condensed", "112.5%": "semi-expanded", "125%": "expanded", "150%": "extra-expanded", "200%": "ultra-expanded" };
function canvasText(text, o) {
  meas.className = "tx " + (o.cls || ""); meas.style.letterSpacing = "0em";
  const cs = getComputedStyle(meas), fs = o.fs;
  const t = cs.textTransform === "uppercase" ? text.toUpperCase() : text;
  const cv = doc.createElement("canvas"), cx = cv.getContext("2d");
  const setFont = () => {
    cx.font = `${cs.fontStyle} ${cs.fontWeight} ${fs}px ${cs.fontFamily}`;
    cx.fontStretch = STRETCH[cs.fontStretch] || "normal";
    cx.letterSpacing = `${(o.ls || 0) * fs}px`;
  };
  setFont();
  const sw = o.stroke ? (o.swPx ?? Math.max(1, fs * (o.sw || 0.012))) : 0;
  const padL = fs * 0.06 + sw, padR = fs * 0.22 + sw;
  const w = Math.ceil(cx.measureText(t).width + padL + padR), h = Math.ceil(fs * 1.3);
  cv.width = Math.min(16000, w); cv.height = h;
  setFont();
  cx.textBaseline = "middle";
  const y = h / 2 + fs * 0.04;
  if (o.stroke) { cx.lineWidth = sw; cx.strokeStyle = o.color; cx.lineJoin = "round"; cx.strokeText(t, padL, y); }
  else { cx.fillStyle = o.color; cx.fillText(t, padL, y); }
  if (o.texture) {            /* textura de piedra: motas oscuras solo sobre la letra */
    cx.globalCompositeOperation = "source-atop";
    const n = Math.floor(cv.width * cv.height / 220);
    for (let i = 0; i < n; i++) { cx.fillStyle = `rgba(0,0,0,${0.08 + texRng() * 0.3})`; const s = 1 + texRng() * 3; cx.fillRect(texRng() * cv.width, texRng() * cv.height, s, s); }
    cx.globalCompositeOperation = "source-over";
  }
  cv.className = "tx"; cv.style.width = cv.width + "px"; cv.style.height = h + "px"; cv.style.display = "block";
  return cv;
}
/* texto posicionado: (x, y) = punto de ancla (ax, ay ∈ 0..1). .bx posiciona, .tx se anima */
function tx(parent, text, o) {
  const box = div(parent, "bx");
  box.style.left = o.x + "px"; box.style.top = o.y + "px";
  box.style.transform = `translate(${-(o.ax ?? 0.5) * 100}%, ${-(o.ay ?? 0.5) * 100}%)` + (o.rot ? ` rotate(${o.rot}deg)` : "");
  if (o.canvas) { const el = canvasText(text, o); box.appendChild(el); return { box, el, chars: [], words: [] }; }
  const el = div(box, "tx " + (o.cls || ""));
  el.style.fontSize = o.fs + "px";
  if (o.ls) el.style.letterSpacing = o.ls + "em";
  if (o.stroke) { el.style.color = "transparent"; el.style.webkitTextStroke = `${Math.max(1, o.fs * (o.sw || 0.012))}px ${o.color}`; }
  else el.style.color = o.color;
  const chars = [], words = [];
  if (o.split === "chars") {
    let wi = 0;
    for (const c of text) {
      const s = doc.createElement("span"); s.className = "ch"; s.textContent = c; s.wi = wi;
      if (c === " ") wi++;
      el.appendChild(s); chars.push(s);
    }
  } else if (o.split === "words") {
    text.split(" ").forEach((w, i) => {
      if (i) el.appendChild(doc.createTextNode(" "));
      const s = doc.createElement("span"); s.className = "wd"; s.textContent = w; el.appendChild(s); words.push(s);
    });
  } else el.textContent = text;
  return { box, el, chars, words };
}

/* ---------------- filtros SVG: duotono, B/N, desenfoque direccional ---------------- */
const SVGNS = "http://www.w3.org/2000/svg";
const fx = (() => {
  const s = doc.createElementNS(SVGNS, "svg");
  s.setAttribute("width", "0"); s.setAttribute("height", "0"); s.style.position = "absolute";
  const d = doc.createElementNS(SVGNS, "defs"); s.appendChild(d); doc.body.appendChild(s);
  return d;
})();
const hex = h => { const n = parseInt(h.replace("#", ""), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
/* duotono: luminancia → tabla [oscuro → claro], con contraste previo */
function duoFilter(id, dark, light, contrast = 1.25) {
  const [dr, dg, db] = hex(dark), [lr, lg, lb] = hex(light);
  const icpt = (1 - contrast) / 2;
  fx.insertAdjacentHTML("beforeend", `<filter id="${id}" color-interpolation-filters="sRGB">
    <feColorMatrix type="saturate" values="0"/>
    <feComponentTransfer><feFuncR type="linear" slope="${contrast}" intercept="${icpt}"/><feFuncG type="linear" slope="${contrast}" intercept="${icpt}"/><feFuncB type="linear" slope="${contrast}" intercept="${icpt}"/></feComponentTransfer>
    <feComponentTransfer><feFuncR type="table" tableValues="${dr} ${lr}"/><feFuncG type="table" tableValues="${dg} ${lg}"/><feFuncB type="table" tableValues="${db} ${lb}"/></feComponentTransfer>
  </filter>`);
  return `url(#${id})`;
}
for (const [n, s] of [[1, 6], [2, 16], [3, 34]]) {
  fx.insertAdjacentHTML("beforeend", `<filter id="mbx${n}" x="-30%" y="-10%" width="160%" height="120%"><feGaussianBlur stdDeviation="${s} 0"/></filter>`);
  fx.insertAdjacentHTML("beforeend", `<filter id="mby${n}" x="-10%" y="-30%" width="120%" height="160%"><feGaussianBlur stdDeviation="0 ${s}"/></filter>`);
}
/* gradings del config (C.grades): key → filtro CSS/SVG. Si un media trae la
   variante ya gradada (media.graded[key], generada por tools/grade_media.py)
   se usa esa y NO se aplica filtro en vivo: filtrar video en tiempo real es
   carísimo en Chrome headless (45 fps → 13 fps con un solo filtro). */
const GRADE = {};
for (const [k, g] of Object.entries(C.grades || {}))
  GRADE[k] = g.type === "duo" ? duoFilter(k, g.dark, g.light, g.contrast ?? 1.25)
           : `saturate(${g.saturate ?? 1}) contrast(${g.contrast ?? 1}) brightness(${g.brightness ?? 1})`;
/* video → foto fija (su póster), conservando las variantes gradadas del póster */
function asStill(s) {
  if (!s || s.type !== "video") return s;
  const graded = {};
  for (const [k, g] of Object.entries(s.graded || {})) if (g.poster) graded[k] = { src: g.poster };
  return { ...s, type: "image", src: s.poster || s.src, graded };
}
function blurPass(tr, t0, d, axis = "x", fadeIn = false) {
  const f = n => `url(#mb${axis}${n})`;
  if (fadeIn) tr.set(t0, "none").set(t0 + d * 0.35, f(1)).set(t0 + d * 0.65, f(2)).set(t0 + d, f(3));
  else tr.set(t0, f(3)).set(t0 + d * 0.4, f(2)).set(t0 + d * 0.75, f(1)).set(t0 + d, "none");
}

/* ---------------- texturas (grano) ---------------- */
const texRng = mulberry32((C.seed || 7) * 31 + 5);
function noiseTile(size, alpha) {
  const cv = doc.createElement("canvas"); cv.width = cv.height = size;
  const cx = cv.getContext("2d"), im = cx.createImageData(size, size), d = im.data;
  for (let i = 0; i < d.length; i += 4) { const v = texRng() < 0.5 ? 0 : 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = texRng() * alpha; }
  cx.putImageData(im, 0, 0);
  return `url(${cv.toDataURL()})`;
}
const GRAIN = noiseTile(192, 255);

/* ---------------- guion (lyrics.json) → escenas ---------------- */
async function loadScript() {
  try {
    const r = await fetch(C.lyricsUrl);
    if (!r.ok) throw new Error("HTTP " + r.status);
    const j = await r.json();
    /* filtro de alucinaciones de Whisper (tramos instrumentales): config.lyricsFilter
       = { minLogprob, drop: [regex…] } — un segmento que no pasa se descarta */
    const F = C.lyricsFilter || {}, drop = (F.drop || []).map(x => new RegExp(x, "i"));
    const bad = s => (F.minLogprob != null && s.avg_logprob != null && s.avg_logprob < F.minLogprob) ||
                     drop.some(re => re.test(s.text || ""));
    return (j.segments || []).filter(s => !bad(s)).map(s => {
      let words = (s.words || []).map(w => ({ text: String(w.word).trim(), t: w.start, end: w.end })).filter(w => w.text);
      if (!words.length && s.text) words = s.text.trim().split(/\s+/).map(x => ({ text: x, t: s.start, end: s.end }));
      return { start: s.start, end: s.end, text: (s.text || "").trim(), lines: s.lines, sub: s.sub, words };
    }).filter(s => isFinite(s.start)).sort((a, b) => a.start - b.start);
  } catch (e) {
    console.warn(`[${NAME}] No se pudo cargar`, C.lyricsUrl, e);
    return [];
  }
}
/* renglones de la escena: seg.lines (strings) si existe; si no, un renglón */
function linesOf(sc) {
  const ws = sc.words;
  const specs = Array.isArray(sc.seg.lines) && sc.seg.lines.length ? sc.seg.lines : [ws.map(w => w.text).join(" ")];
  let k = 0;
  return specs.map(str => {
    const n = String(str).trim().split(/\s+/).filter(Boolean).length;
    const lw = ws.slice(k, k + n); k += n;
    return { text: String(str).trim(), words: lw, rt: lw.length ? lw[0].rt : (ws[ws.length - 1]?.rt ?? 0) };
  });
}
function buildTimeline(segs, dur) {
  const slots = C.scenes && C.scenes.length ? C.scenes : [{ type: Object.keys(B)[0] }];
  return segs.map((s, i) => {
    const t0 = i === 0 ? 0 : s.start;
    const t1 = i + 1 < segs.length ? segs[i + 1].start : dur;
    const slot = slots[i % slots.length];
    const type = B[slot.type] ? slot.type : Object.keys(B)[0];
    return { idx: i, t0, t1, dur: Math.max(0.05, t1 - t0), seg: s, slot, type,
             words: s.words.map(w => ({ text: w.text, rt: Math.max(0, w.t - t0) })) };
  });
}

/* ---------------- letra de canción → frases ---------------- */
/* segmentos de Whisper → frases de ≤ maxWords / ≤ maxSec, cortando en la pausa
   más larga; palabras limpias de puntuación, con su tiempo real */
const cleanWord = s => String(s).trim().replace(/[.,;:!?¡¿"“”()\[\]]/g, "").replace(/[`´’]/g, "'");
function lyricPhrases(segs, o = {}) {
  const maxW = o.maxWords ?? 6, maxS = o.maxSec ?? 3.2, minW = o.minWords ?? 2;
  const out = [], q = segs.map(s => {
    const ws = [];
    for (const w of s.words) {
      const x = { text: cleanWord(w.text), t: w.t, end: w.end ?? w.t + 0.3 };
      if (!x.text) continue;
      /* Whisper a veces parte "y'all" → "y" + "'all": se vuelve a unir */
      if (x.text.startsWith("'") && ws.length) { ws[ws.length - 1].text += x.text; ws[ws.length - 1].end = x.end; continue; }
      ws.push(x);
    }
    return ws;
  });
  const dur = ws => ws[ws.length - 1].end - ws[0].t;
  while (q.length) {
    const ws = q.shift();
    if (!ws.length) continue;
    if (ws.length > maxW || (dur(ws) > maxS && ws.length >= 2 * minW)) {
      let bi = Math.ceil(ws.length / 2), bg = -1;
      for (let i = Math.max(minW, Math.ceil(ws.length * 0.2)); i <= Math.min(ws.length - minW, Math.floor(ws.length * 0.8)); i++) {
        const g = ws[i].t - ws[i - 1].end + (/^(and|but|i|i'm|y|pero|que)$/i.test(ws[i].text) ? 0.12 : 0);
        if (g > bg) { bg = g; bi = i; }
      }
      q.unshift(ws.slice(0, bi), ws.slice(bi));
      continue;
    }
    out.push(ws);
  }
  return out;
}
const isStop = w => /^(a|an|the|and|or|but|so|of|to|in|on|at|for|with|i|i'm|me|my|you|your|it|is|am|are|be|we|us|el|la|los|las|un|una|y|o|de|del|en|con|por|que|me|te|mi|tu|su|yo|es)$/i.test(w.text);
/* fuerza de una palabra (para elegir la protagonista de la frase) */
const heroIdx = ws => { let b = 0, bs = -1; ws.forEach((w, i) => { const s = (isStop(w) ? 0 : 10) + w.text.length; if (s > bs) { bs = s; b = i; } }); return b; };

/* línea de tiempo para plantillas de LETRA: una escena por frase, con la
   escena elegida por un mazo ponderado (config.layouts = { tipo: { weight,
   bgs } } + FITS[tipo](frase) de la plantilla), ecos de las palabras fuertes
   en los tramos instrumentales largos y tarjetas de intro / cierre.
   config.timing = { leadSec, holdSec, gapSec, echoSec, cooldown } */
function lyricTimeline(segs, dur, FITS) {
  const Tm = { leadSec: 0.12, holdSec: 0.9, gapSec: 2.4, echoSec: 1.1, cooldown: 3, ...(C.timing || {}) };
  const r = mulberry32((C.seed || 7) * 977 + 3);
  const ph = lyricPhrases(segs, C.phrases || {});
  const list = [];
  const mk = (kind, t0, t1, ws, extra = {}) => ({ kind, t0, t1, seg: { text: ws.map(w => w.text).join(" ") },
    words: ws.map(w => ({ text: w.text, rt: Math.max(0, (w.t ?? t0) - Tm.leadSec - t0) })), ...extra });
  const syn = (texts, t0) => texts.filter(Boolean).map((x, i) => ({ text: x, t: t0 + 0.25 + i * 0.45 + Tm.leadSec }));
  const I = C.intro || {}, O = C.outro || {};
  const first = ph.length ? Math.max(0, ph[0][0].t - Tm.leadSec) : dur;
  if (first >= 1.2 && (I.title || I.artist)) list.push(mk("intro", 0, first, syn([I.title, I.artist], 0), { type: I.type || "intro" }));
  const heroes = [], hist = [];
  ph.forEach((ws, i) => {
    const t0 = i === 0 && !list.length ? 0 : Math.max(0, ws[0].t - Tm.leadSec);
    const nx = ph[i + 1], lastEnd = ws[ws.length - 1].end;
    let t1 = nx ? Math.max(t0 + 0.35, nx[0].t - Tm.leadSec) : dur;
    heroes.push(ws[heroIdx(ws)].text); hist.push(ws);
    let gap = null;
    if (t1 - lastEnd > Tm.gapSec) { gap = [lastEnd + Tm.holdSec, t1]; t1 = gap[0]; }
    const ly = mk("lyric", t0, t1, ws);
    list.push(ly);
    if (!gap && !nx && O.enabled !== false && (O.title || O.sub) && dur - lastEnd > 1.2) gap = [Math.max(t0 + 0.6, lastEnd + 0.3), dur];
    if (!gap) return;
    ly.t1 = gap[0];
    /* tramo final: el cierre ocupa los últimos outro.sec segundos; antes, ecos */
    if (!nx && O.enabled !== false && (O.title || O.sub)) {
      const os = Math.max(gap[0], dur - (O.sec ?? 3.2));
      list.push(mk("outro", os, dur, syn([O.title, O.sub, O.feats], os), { type: O.type || "outro" }));
      if (os - gap[0] < 0.8) { ly.t1 = os; return; }
      gap = [gap[0], os];
    }
    /* tramo instrumental largo → se repiten frases completas ya cantadas (en orden,
       como un estribillo); corto → ecos de las palabras fuertes */
    const len = gap[1] - gap[0], ps = Tm.echoPhraseSec ?? 1.8;
    if (len >= 3 * ps && hist.length) {
      const k = Math.max(1, Math.round(len / ps));
      for (let j = 0; j < k; j++) {
        const a = gap[0] + len * j / k, b = gap[0] + len * (j + 1) / k, src = hist[j % hist.length];
        const step = Math.min(0.26, (b - a) * 0.55 / Math.max(1, src.length));
        list.push(mk("echo", a, b, src.map((w, n) => ({ text: w.text, t: a + Tm.leadSec + 0.06 + n * step }))));
      }
    } else {
      const k = Math.max(1, Math.round(len / Tm.echoSec));
      for (let j = 0; j < k; j++) {
        const a = gap[0] + len * j / k, b = gap[0] + len * (j + 1) / k;
        const pool = [...new Set(heroes.slice(-8))];
        const txt = pool[Math.floor(r() * pool.length)] || ws[0].text;
        list.push(mk("echo", a, b, [{ text: txt, t: a + Tm.leadSec + 0.05 }]));
      }
    }
  });
  list.sort((a, b) => a.t0 - b.t0);
  /* mazo: tipo de escena + fondo */
  const L = C.layouts || {}, recent = [];
  let prevBg = "";
  list.forEach((sc, i) => {
    sc.idx = i; sc.dur = Math.max(0.05, sc.t1 - sc.t0);
    if (!sc.type) {
      let c = Object.entries(L).filter(([k, v]) => v.weight > 0 && B[k] && (!FITS[k] || FITS[k](sc)) && !recent.includes(k));
      if (!c.length) c = Object.entries(L).filter(([k, v]) => v.weight > 0 && B[k]);
      let x = r() * c.reduce((a, [, v]) => a + v.weight, 0); sc.type = c[0][0];
      for (const [k, v] of c) { x -= v.weight; if (x <= 0) { sc.type = k; break; } }
      recent.push(sc.type); if (recent.length > Tm.cooldown) recent.shift();
    }
    const bgs = (L[sc.type]?.bgs || C.defaultBgs || ["media"]).filter(b => b !== prevBg || (L[sc.type]?.bgs || []).length === 1);
    const bg = bgs[Math.floor(r() * bgs.length)] || "media";
    /* layouts[tipo].media = [ids] → la escena prefiere esos clips; si no, cualquiera */
    const pool = (L[sc.type]?.media || []).filter(id => (C.media || []).some(m => m.id === id));
    const ids = pool.length ? pool : (C.media || []).map(m => m.id);
    const pk = () => ids[Math.floor(r() * ids.length)];
    const media = ids.length ? [pk(), pk()] : [];
    if (media.length > 1 && media[1] === media[0] && ids.length > 1) media[1] = ids[(ids.indexOf(media[0]) + 1) % ids.length];
    sc.slot = { type: sc.type, bg, media, trans: L[sc.type]?.trans };
    prevBg = bg;
  });
  return list;
}

/* ---------------- transiciones de entrada (sobre la escena anterior) ----------------
   enterFx(X, kind, d): anima la raíz de la escena nueva durante d segundos.
   Con overlapSec > 0 la anterior se ve debajo → disolvencias reales.
   kinds: fade · blur · iris · irisOut · wipeL · wipeR · wipeUp · wipeDown · bars
   (persiana) · rain (franjas verticales irregulares) · burn (borde de quemado
   con brillo) · ink (mancha orgánica) · flash · zoomIn · zoomOut · slice (glitch) */
function enterFx(X, kind, d, o = {}) {
  const { root: R, W, H, r } = X;
  if (!kind || kind === "cut" || X.sc.idx === 0) return;
  const E = EASE_IO;
  const poly = pts => `polygon(${pts.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(", ")})`;
  switch (kind) {
    case "fade": X.T(R, "opacity", "0").to(0, d, "1", E); break;
    case "blur":
      X.T(R, "opacity", "0").to(0, d, "1", E);
      X.T(R, "filter", "blur(18px) brightness(1.4)").to(0, d, "blur(0px) brightness(1)", EASE_OUT); break;
    case "iris": { const cx = (o.cx ?? 0.5) * 100, cy = (o.cy ?? 0.5) * 100;
      X.T(R, "clipPath", `circle(0% at ${cx}% ${cy}%)`).to(0, d, `circle(120% at ${cx}% ${cy}%)`, E); break; }
    case "wipeL": X.T(R, "clipPath", "inset(0% 100% 0% 0%)").to(0, d, "inset(0% 0% 0% 0%)", E); break;
    case "wipeR": X.T(R, "clipPath", "inset(0% 0% 0% 100%)").to(0, d, "inset(0% 0% 0% 0%)", E); break;
    case "wipeUp": X.T(R, "clipPath", "inset(100% 0% 0% 0%)").to(0, d, "inset(0% 0% 0% 0%)", E); break;
    case "wipeDown": X.T(R, "clipPath", "inset(0% 0% 100% 0%)").to(0, d, "inset(0% 0% 0% 0%)", E); break;
    case "bars": { /* persiana horizontal: n franjas que se abren escalonadas */
      const n = o.n ?? 8, k = 12, mk = p => { const pts = [];
        for (let i = 0; i < n; i++) { const y0 = i * H / n, hh = (H / n) * clamp(p * 1.6 - i / n * 0.6, 0, 1);
          pts.push([0, y0], [W, y0], [W, y0 + hh], [0, y0 + hh], [0, y0]); }
        return poly(pts); };
      const tr = X.T(R, "clipPath", mk(0));
      for (let j = 1; j <= k; j++) tr.set(d * j / k, mk(j / k)); break; }
    case "rain": { /* franjas verticales de ancho irregular que "caen" */
      const n = o.n ?? 44, ws = Array.from({ length: n }, () => 0.3 + r()), sum = ws.reduce((a, b) => a + b, 0), dl = ws.map(() => r() * 0.5);
      X.T(R, "opacity", "0.2").to(0, d, "1", EASE_OUT);
      const k = 12, mk = p => { const pts = []; let x = 0;
        ws.forEach((w, i) => { const ww = w / sum * W, hh = H * clamp((p - dl[i]) / 0.55, 0, 1);
          pts.push([x, 0], [x + ww + 1, 0], [x + ww + 1, hh], [x, hh], [x, 0]); x += ww; });
        return poly(pts); };
      const tr = X.T(R, "clipPath", mk(0));
      for (let j = 1; j <= k; j++) tr.set(d * j / k, mk(j / k));
      tr.set(d + 0.001, "none"); break; }
    case "burn": { /* borde de quemado irregular que avanza + resplandor */
      const k = 14, n = 26, jit = Array.from({ length: n + 1 }, () => r());
      const mk = p => { const pts = [[0, 0]];
        for (let i = 0; i <= n; i++) { const y = i / n * H; pts.push([clamp((p * 1.25 - 0.12) * W + (jit[i] - 0.5) * 0.12 * W, 0, W), y]); }
        pts.push([0, H]); return poly(pts); };
      const tr = X.T(R, "clipPath", mk(0));
      for (let j = 1; j <= k; j++) tr.set(d * j / k, mk(j / k));
      tr.set(d + 0.001, "none");
      /* franja incandescente angosta que viaja pegada al borde quemado */
      const gw = 0.09 * W, glow = div(X.root, "patch", { left: -gw / 2 + "px", top: 0, width: gw + "px", height: H + "px", zIndex: 40, mixBlendMode: "screen", filter: "blur(6px)",
        background: `linear-gradient(90deg, transparent 0%, ${o.color || C.transition?.burnColor || "rgba(255,140,40,0.85)"} 42%, rgba(255,235,190,0.95) 50%, transparent 62%)` });
      const gt = X.T(glow, "transform", "translateX(0px)");
      for (let j = 0; j <= k; j++) gt.set(d * j / k, `translateX(${((j / k * 1.25 - 0.12) * W).toFixed(1)}px)`);
      X.T(glow, "opacity", "1").to(d * 0.85, d * 0.15, "0"); break; }
    case "ink": { /* mancha orgánica que crece desde un punto */
      const cx = (o.cx ?? 0.3 + r() * 0.4) * W, cy = (o.cy ?? 0.35 + r() * 0.3) * H, n = 40, a0 = r() * 6, k = 12;
      const amp = Array.from({ length: n }, (_, i) => 0.75 + 0.25 * Math.sin(i * 1.7 + a0) + (r() - 0.5) * 0.25);
      const mk = p => { const R0 = p * 1.25 * Math.hypot(W, H); return poly(amp.map((a, i) => { const th = i / n * Math.PI * 2; return [cx + Math.cos(th) * R0 * a, cy + Math.sin(th) * R0 * a]; })); };
      const tr = X.T(R, "clipPath", mk(0));
      for (let j = 1; j <= k; j++) tr.set(d * j / k, mk(easeFn(EASE_IN)(j / k)));
      tr.set(d + 0.001, "none"); break; }
    case "flash": {
      const f = div(X.root, "patch", { left: 0, top: 0, width: W + "px", height: H + "px", background: o.color || C.transition?.flashColor || "#fff", zIndex: 40 });
      X.T(f, "opacity", "0.95").to(0, d, "0", EASE_OUT); break; }
    case "zoomIn":
      X.T(R, "opacity", "0").to(0, d * 0.6, "1", E);
      X.T(R, "transform", "scale(1.35)").to(0, d, "scale(1)", EASE_OUT); break;
    case "zoomOut":
      X.T(R, "opacity", "0").to(0, d * 0.6, "1", E);
      X.T(R, "transform", "scale(0.82)").to(0, d, "scale(1)", EASE_OUT); break;
    case "slice": { /* glitch: franjas horizontales desplazadas que se alinean */
      const n = 7, k = 8, off = Array.from({ length: n }, () => (r() - 0.5) * 0.4 * W);
      const mk = p => { const pts = [];
        for (let i = 0; i < n; i++) { const y0 = i * H / n, y1 = y0 + H / n, dx = off[i] * (1 - p); pts.push([dx, y0], [W + dx, y0], [W + dx, y1], [dx, y1], [dx, y0]); }
        return poly(pts); };
      const tr = X.T(R, "clipPath", mk(0));
      for (let j = 1; j <= k; j++) tr.set(d * j / k, mk(j / k));
      tr.set(d + 0.001, "none"); break; }
  }
}
/* tipo de transición de la escena: slot.trans o sorteo ponderado de config.transition.weights */
function pickTrans(X) {
  if (X.sc.slot.trans) return X.sc.slot.trans;
  const w = Object.entries(C.transition?.weights || { fade: 1 }).filter(([, v]) => v > 0);
  let x = X.r() * w.reduce((a, [, v]) => a + v, 0);
  for (const [k, v] of w) { x -= v; if (x <= 0) return k; }
  return w[0][0];
}

/* ---------------- media (video / imagen) ---------------- */
/* Los videos (y el audio) se bajan enteros como blob al arrancar: el servidor
   del grabador (SimpleHTTPRequestHandler) no soporta Range, y sin eso Chrome
   tarda en tener datos y no puede buscar (el video se queda en 0 s). Con blob
   la búsqueda por tiempo es instantánea. config.preload=false lo desactiva. */
const BLOBS = new Map();
async function preloadMedia(timeoutMs = 8000) {
  if (C.preload === false) return;
  const srcs = new Set([C.audio?.src].filter(Boolean));
  for (const m of C.media || []) if (m.type === "video") {
    srcs.add(m.src);
    for (const g of Object.values(m.graded || {})) if (g.src) srcs.add(g.src);
  }
  const jobs = [...srcs].map(async s => {
    try { const r = await fetch(encodeURI(s)); if (r.ok) BLOBS.set(s, URL.createObjectURL(await r.blob())); } catch (e) {}
  });
  await Promise.race([Promise.all(jobs), new Promise(r => setTimeout(r, timeoutMs))]);
}
const srcURL = s => BLOBS.get(s) || encodeURI(s);
function mediaSpec(sc, k) {
  const list = C.media || [];
  if (!list.length) return null;
  const ref = (sc.slot.media || [])[k];
  if (typeof ref === "number") return list[ref % list.length];
  if (typeof ref === "string") { const m = list.find(x => x.id === ref); if (m) return m; }
  return list[(sc.idx * 2 + k) % list.length];
}
/* caja de media recortada; o.filter = key de C.grades (o filtro CSS), o.off = desfase del clip */
function mbox(X, parent, k, css = {}, o = {}) {
  let spec = typeof k === "object" ? k : mediaSpec(X.sc, k);
  const box = div(parent, "mbox", css);
  if (!spec) return { box, el: div(box, "media") };
  let filter = o.filter;
  if (filter && GRADE[filter] !== undefined) {
    const g = spec.graded && spec.graded[filter];
    if (g) { spec = { ...spec, src: g.src || spec.src, poster: g.poster || spec.poster }; filter = null; }
    else filter = GRADE[filter];
  }
  let el;
  if (spec.type === "video") {
    el = doc.createElement("video");
    el.muted = true; el.playsInline = true; el.preload = "auto"; el.loop = true;
    el.src = srcURL(spec.src);
    X.videos.push({ v: el, spec, off: o.off || 0 });
  } else { el = doc.createElement("img"); el.src = spec.src; el.decoding = "sync"; }
  el.className = "media";
  if (filter) el.style.filter = filter;
  if (spec.pos) el.style.objectPosition = spec.pos;
  box.appendChild(el);
  return { box, el, spec };
}
/* Ken Burns: en fotos siempre; en video solo con config.render.kbVideo (escalar
   un <video> en cada cuadro cuesta mucho en headless: 45 → 26 fps) */
function kenBurns(X, m, from, to) {
  if (m.spec && m.spec.type === "video" && !C.render?.kbVideo) { m.el.style.transform = from; return; }
  X.T(m.el, "transform", from).to(0, X.dur, to);
}
function syncVideos(X, t, scrub) {
  for (const it of X.videos) {
    const v = it.v, d = v.duration, rate = it.spec.rate || 1;
    let e = (it.spec.start || 0) + (t + it.off) * rate;
    if (isFinite(d) && d > 0.3) e = e % (d - 0.08);
    if (scrub) {
      if (!v.paused) v.pause();
      if (Math.abs(v.currentTime - e) > 0.02) { try { v.currentTime = e; } catch (err) {} }
    } else {
      v.playbackRate = rate;
      if (v.paused) v.play().catch(() => {});
      if (Math.abs(v.currentTime - e) > 0.35) { try { v.currentTime = e; } catch (err) {} }
    }
  }
}

/* ---------------- escenas: construir, montar, buscar ---------------- */
let vw = innerWidth, vh = innerHeight;
function buildScene(sc) {
  const W = vw, H = vh;
  const root = div(null, "scene", { width: W + "px", height: H + "px" });
  const tracks = [];
  const X = {
    sc, root, W, H, u: Math.min(W, H) / 720, dur: sc.dur, videos: [],
    r: mulberry32(((C.seed || 7) * 7919 + sc.idx * 104729) >>> 0),
    T: (el, prop, init, discrete) => { const t = new Track(el, prop, init, discrete); tracks.push(t); return t; }
  };
  X.lines = linesOf(sc);
  X.pend = [];
  try { B[sc.type](sc, X); }
  catch (e) { console.warn(`[${NAME}] escena falló`, sc.type, e); }
  /* piezas que necesitan medir el texto ya maquetado (garabatos, marcos):
     se monta la escena oculta un instante, se mide y se desmonta */
  if (X.pend.length) {
    root.style.visibility = "hidden"; stage.appendChild(root);
    for (const f of X.pend) { try { f(); } catch (e) { console.warn(`[${NAME}] medición falló`, e); } }
    stage.removeChild(root); root.style.visibility = "";
  }
  if (C.texture?.grain > 0) div(root, "grain", { backgroundImage: GRAIN, opacity: C.texture.grain,
    backgroundPosition: `${Math.floor(X.r() * 192)}px ${Math.floor(X.r() * 192)}px` });
  for (const t of tracks) { t.compile(); t.seek(0); }
  return {
    root, sc,
    seek(t, scrub) { for (const tr of tracks) tr.seek(t); syncVideos(X, t, scrub); },
    dispose() { for (const it of X.videos) { it.v.pause(); it.v.removeAttribute("src"); it.v.load(); } root.remove(); }
  };
}

const stage = $("stage"), audio = $("audio"), hud = $("hud");
let rafT0 = null, rafNow = 0, started = false, forced = FROZEN;
const clock = () => forced != null ? forced
  : (!audio.paused && audio.currentTime > 0.05) ? audio.currentTime
  : (rafT0 === null ? 0 : (rafNow - rafT0) / 1000);
async function begin() {
  if (started || FROZEN != null) return;
  started = true;
  $("hint").style.display = "none";
  try { await audio.play(); } catch (e) { /* reloj de pared */ }
}
addEventListener("pointerdown", begin, { once: true });

let scenes = [], curIdx = -1, cur = null, nextBuilt = null, prev = null, prevIdx = -1;
/* solapamiento entre escenas (config.transition.overlapSec, def. 0 = corte seco):
   la escena anterior sigue viva DEBAJO de la nueva durante ese tiempo, así la
   transición de entrada (enterFx) se ve contra la imagen real de la anterior */
const OVERLAP = () => Math.max(0, C.transition?.overlapSec ?? 0);
function sceneAt(t) {
  let lo = 0, hi = scenes.length - 1, ans = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (scenes[m].t0 <= t) { ans = m; lo = m + 1; } else hi = m - 1; }
  return ans;
}
function mount(i) {
  const old = cur, oldIdx = curIdx;
  cur = (nextBuilt && nextBuilt.i === i) ? nextBuilt.b : buildScene(scenes[i]);
  nextBuilt = null;
  stage.appendChild(cur.root);
  curIdx = i;
  if (prev && prevIdx !== i - 1) { prev.dispose(); prev = null; prevIdx = -1; }
  if (old && old !== prev) {
    if (OVERLAP() > 0 && oldIdx === i - 1 && !prev) { prev = old; prevIdx = oldIdx; }
    else old.dispose();
  }
  if (i + 1 < scenes.length) {
    const j = i + 1;
    setTimeout(() => { if (curIdx === i && !nextBuilt) nextBuilt = { i: j, b: buildScene(scenes[j]) }; }, 0);
  }
}
function render(t) {
  const i = sceneAt(t);
  if (i < 0) return;
  if (i !== curIdx) mount(i);
  const ov = OVERLAP(), dt = t - scenes[i].t0;
  if (ov > 0 && i > 0 && dt < ov) {
    if (!prev) { prev = buildScene(scenes[i - 1]); prevIdx = i - 1; stage.insertBefore(prev.root, cur.root); }
    /* la anterior sigue corriendo su "cola" (t > dur): sus pistas pueden animar la salida */
    prev.seek(t - scenes[i - 1].t0, forced != null);
  } else if (prev) { prev.dispose(); prev = null; prevIdx = -1; }
  cur.seek(ov > 0 ? t - scenes[i].t0 : Math.min(t, scenes[i].t1) - scenes[i].t0, forced != null);
  if (DEBUG) { const s = scenes[i]; hud.textContent = `t ${t.toFixed(2)} · #${i} ${s.type} · "${s.seg.text}"`; }
}
function frame(now) {
  rafNow = now;
  if (rafT0 === null) rafT0 = now;
  render(clock());
  if (FROZEN == null) requestAnimationFrame(frame);
}

async function boot() {
  if (DEBUG) hud.style.display = "block";
  if (QS.get("headless") === "1") doc.body.classList.add("headless");
  const fontsReady = Promise.race([Promise.all(FONT_LOADS.map(f => doc.fonts.load(f))).then(() => doc.fonts.ready), new Promise(r => setTimeout(r, 3000))]);
  /* primero media + guion + fuentes; el audio (el reloj) arranca recién con
     todo listo, así el primer cuadro de la escena 1 coincide con t = 0 */
  const [segs] = await Promise.all([loadScript(), fontsReady, preloadMedia()]);
  audio.src = srcURL(C.audio.src);
  const aDur = await new Promise(res => {
    if (isFinite(audio.duration) && audio.duration > 0) return res(audio.duration);
    audio.addEventListener("loadedmetadata", () => res(audio.duration), { once: true });
    setTimeout(() => res(NaN), 2500);
  });
  if (segs.length) {
    const last = segs[segs.length - 1];
    const dur = isFinite(aDur) && aDur > 0 ? aDur : (last.end || last.start + 3);
    measCache.clear();
    /* una plantilla puede traer su propia línea de tiempo (las de letra de canción) */
    scenes = (typeof makeTimeline === "function" ? makeTimeline : buildTimeline)(segs, dur);
  }
  addEventListener("resize", () => { vw = innerWidth; vh = innerHeight; measCache.clear(); nextBuilt = null; if (prev) { prev.dispose(); prev = null; prevIdx = -1; } if (cur) { cur.dispose(); cur = null; curIdx = -1; } });
  window.__promo = {
    scenes: () => scenes,
    seek(t) { forced = t; render(t); return new Promise(res => { const vs = cur ? [...cur.root.querySelectorAll("video")] : [];
      Promise.all(vs.map(v => new Promise(r => { if (v.readyState >= 2 && !v.seeking) r(); else { v.addEventListener("seeked", r, { once: true }); v.addEventListener("loadeddata", r, { once: true }); setTimeout(r, 1500); } })))
        .then(() => requestAnimationFrame(() => requestAnimationFrame(res))); }); },
    release() { forced = null; }
  };
  requestAnimationFrame(frame);
  if (FROZEN == null) begin();
}
/* ===================== FIN NÚCLEO COMÚN ===================== */
