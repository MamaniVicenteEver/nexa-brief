
/* Promo Trendy — Lima — promo de cortes con zoom: B/N cálido + duotono lima, itálica pesada, pantallas partidas, mosaico, tarjeta azul noche con círculo y cierre 'gracias por ver'. */
const NAME = "promo-trendy";
const ACTIVE_ID = null;   /* <-- forzar un id · null = usa "activeId" del JSON */
const DEFAULT_CONFIG = {"activeId": "default", "configs": [{"id": "default", "description": "Promo deportivo 'Trendy': metraje de atletas en blanco y negro cálido con duotono verde lima, textos en itálica pesada, pantallas partidas, mosaico de tomas, tarjeta azul noche con círculo y cierre 'Gracias por ver'. — metadata para marketing/SEO, la plantilla no la usa todavía.", "audio": {"src": "assets/song.mp3"}, "lyricsUrl": "assets/lyrics.json", "fonts": {"googleUrl": "https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@1,800;1,900&display=swap"}, "palette": {"lime": "#A6EB35", "limeDark": "#0E1A06", "paper": "#F2EFE6", "ink": "#101114", "navy": "#000012", "navy2": "#0B0B24"}, "grades": {"duoLime": {"type": "duo", "dark": "#0E1A06", "light": "#A6EB35", "contrast": 1.35}, "bwWarm": {"type": "duo", "dark": "#0C0C0E", "light": "#F2EFE6", "contrast": 1.4}}, "texture": {"grain": 0.07}, "scenes": [{"type": "title", "media": ["skate"]}, {"type": "stack", "media": ["basket"], "repeat": 5}, {"type": "split", "media": ["ropes", "sprint"], "out": "none"}, {"type": "grid", "media": ["basket-1", "skate-2", "boxing-1", "soccer-1", "ropes-2", "sprint-2"], "in": "none"}, {"type": "circle", "repeat": 3, "in": "none"}, {"type": "maskword", "media": ["soccer", "sprint"]}, {"type": "spaced", "media": ["boxing"], "repeat": 3}, {"type": "tunnel", "media": ["ropes"]}, {"type": "action", "media": ["basket", "boxing"], "out": "none"}, {"type": "end", "in": "none"}], "debug": {"enabled": false}, "seed": 3, "media": [{"id": "basket", "type": "video", "src": "assets/media/basketball.mp4", "poster": "assets/media/basketball-1.jpg", "graded": {"duoLime": {"src": "assets/media/graded/basketball.duoLime.mp4", "poster": "assets/media/graded/basketball-1.duoLime.jpg"}, "bwWarm": {"src": "assets/media/graded/basketball.bwWarm.mp4", "poster": "assets/media/graded/basketball-1.bwWarm.jpg"}}}, {"id": "sprint", "type": "video", "src": "assets/media/sprinter.mp4", "poster": "assets/media/sprinter-1.jpg", "graded": {"duoLime": {"src": "assets/media/graded/sprinter.duoLime.mp4", "poster": "assets/media/graded/sprinter-1.duoLime.jpg"}, "bwWarm": {"src": "assets/media/graded/sprinter.bwWarm.mp4", "poster": "assets/media/graded/sprinter-1.bwWarm.jpg"}}}, {"id": "boxing", "type": "video", "src": "assets/media/boxing.mp4", "poster": "assets/media/boxing-1.jpg", "graded": {"duoLime": {"src": "assets/media/graded/boxing.duoLime.mp4", "poster": "assets/media/graded/boxing-1.duoLime.jpg"}, "bwWarm": {"src": "assets/media/graded/boxing.bwWarm.mp4", "poster": "assets/media/graded/boxing-1.bwWarm.jpg"}}}, {"id": "skate", "type": "video", "src": "assets/media/skate.mp4", "poster": "assets/media/skate-1.jpg", "graded": {"duoLime": {"src": "assets/media/graded/skate.duoLime.mp4", "poster": "assets/media/graded/skate-1.duoLime.jpg"}, "bwWarm": {"src": "assets/media/graded/skate.bwWarm.mp4", "poster": "assets/media/graded/skate-1.bwWarm.jpg"}}}, {"id": "ropes", "type": "video", "src": "assets/media/battle-ropes.mp4", "poster": "assets/media/battle-ropes-1.jpg", "graded": {"duoLime": {"src": "assets/media/graded/battle-ropes.duoLime.mp4", "poster": "assets/media/graded/battle-ropes-1.duoLime.jpg"}, "bwWarm": {"src": "assets/media/graded/battle-ropes.bwWarm.mp4", "poster": "assets/media/graded/battle-ropes-1.bwWarm.jpg"}}}, {"id": "soccer", "type": "video", "src": "assets/media/soccer.mp4", "poster": "assets/media/soccer-1.jpg", "graded": {"duoLime": {"src": "assets/media/graded/soccer.duoLime.mp4", "poster": "assets/media/graded/soccer-1.duoLime.jpg"}, "bwWarm": {"src": "assets/media/graded/soccer.bwWarm.mp4", "poster": "assets/media/graded/soccer-1.bwWarm.jpg"}}}, {"id": "basket-1", "type": "image", "src": "assets/media/basketball-1.jpg", "graded": {"duoLime": {"src": "assets/media/graded/basketball-1.duoLime.jpg"}, "bwWarm": {"src": "assets/media/graded/basketball-1.bwWarm.jpg"}}}, {"id": "basket-2", "type": "image", "src": "assets/media/basketball-2.jpg", "graded": {"duoLime": {"src": "assets/media/graded/basketball-2.duoLime.jpg"}, "bwWarm": {"src": "assets/media/graded/basketball-2.bwWarm.jpg"}}}, {"id": "sprint-1", "type": "image", "src": "assets/media/sprinter-1.jpg", "graded": {"duoLime": {"src": "assets/media/graded/sprinter-1.duoLime.jpg"}, "bwWarm": {"src": "assets/media/graded/sprinter-1.bwWarm.jpg"}}}, {"id": "sprint-2", "type": "image", "src": "assets/media/sprinter-2.jpg", "graded": {"duoLime": {"src": "assets/media/graded/sprinter-2.duoLime.jpg"}, "bwWarm": {"src": "assets/media/graded/sprinter-2.bwWarm.jpg"}}}, {"id": "boxing-1", "type": "image", "src": "assets/media/boxing-1.jpg", "graded": {"duoLime": {"src": "assets/media/graded/boxing-1.duoLime.jpg"}, "bwWarm": {"src": "assets/media/graded/boxing-1.bwWarm.jpg"}}}, {"id": "boxing-2", "type": "image", "src": "assets/media/boxing-2.jpg", "graded": {"duoLime": {"src": "assets/media/graded/boxing-2.duoLime.jpg"}, "bwWarm": {"src": "assets/media/graded/boxing-2.bwWarm.jpg"}}}, {"id": "skate-1", "type": "image", "src": "assets/media/skate-1.jpg", "graded": {"duoLime": {"src": "assets/media/graded/skate-1.duoLime.jpg"}, "bwWarm": {"src": "assets/media/graded/skate-1.bwWarm.jpg"}}}, {"id": "skate-2", "type": "image", "src": "assets/media/skate-2.jpg", "graded": {"duoLime": {"src": "assets/media/graded/skate-2.duoLime.jpg"}, "bwWarm": {"src": "assets/media/graded/skate-2.bwWarm.jpg"}}}, {"id": "ropes-1", "type": "image", "src": "assets/media/battle-ropes-1.jpg", "graded": {"duoLime": {"src": "assets/media/graded/battle-ropes-1.duoLime.jpg"}, "bwWarm": {"src": "assets/media/graded/battle-ropes-1.bwWarm.jpg"}}}, {"id": "ropes-2", "type": "image", "src": "assets/media/battle-ropes-2.jpg", "graded": {"duoLime": {"src": "assets/media/graded/battle-ropes-2.duoLime.jpg"}, "bwWarm": {"src": "assets/media/graded/battle-ropes-2.bwWarm.jpg"}}}, {"id": "soccer-1", "type": "image", "src": "assets/media/soccer-1.jpg", "graded": {"duoLime": {"src": "assets/media/graded/soccer-1.duoLime.jpg"}, "bwWarm": {"src": "assets/media/graded/soccer-1.bwWarm.jpg"}}}, {"id": "soccer-2", "type": "image", "src": "assets/media/soccer-2.jpg", "graded": {"duoLime": {"src": "assets/media/graded/soccer-2.duoLime.jpg"}, "bwWarm": {"src": "assets/media/graded/soccer-2.bwWarm.jpg"}}}]}]};
const FONT_LOADS = ["italic 900 100px Montserrat"];

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
    const out = (j.segments || []).filter(s => !bad(s)).map(s => {
      let words = (s.words || []).map(w => ({ text: String(w.word).trim(), t: w.start, end: w.end })).filter(w => w.text);
      if (!words.length && s.text) words = s.text.trim().split(/\s+/).map(x => ({ text: x, t: s.start, end: s.end }));
      return { start: s.start, end: s.end, text: (s.text || "").trim(), lines: s.lines, sub: s.sub, words };
    }).filter(s => isFinite(s.start)).sort((a, b) => a.start - b.start);
    /* Audio puede tardar en entregar loadedmetadata; usa la duración ya anotada en lyrics.json. */
    out.audioDurationSec = Number(j.metadata?.audio_duration_sec) || 0;
    return out;
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
  const introTitle = window.NexaTemplateIntro?.title?.(I) || I.title || I.artist;
  const introMin = window.NexaTemplateIntro?.minDuration?.() ?? 1.2;
  if (first >= introMin && introTitle) list.push(mk("intro", 0, first, window.NexaTemplateIntro?.words ? window.NexaTemplateIntro.words(introTitle, 0, Tm.leadSec) : syn([introTitle], 0), { type: I.type || "intro" }));
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
    const minOutroTail = Number.isFinite(Number(O.minTailSec)) ? Math.max(0, Number(O.minTailSec)) : 1.2;
    const outroBuffer = Number.isFinite(Number(O.tailBufferSec)) ? Math.max(0, Number(O.tailBufferSec)) : 0.3;
    if (!gap && !nx && O.enabled !== false && (O.title || O.sub) && dur - lastEnd > minOutroTail)
      gap = [Math.max(t0 + 0.6, lastEnd + outroBuffer), dur];
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
/* En la captura cuadro a cuadro los medios se bajan como blob porque el
   servidor del grabador no admite Range. En la vista previa normal el navegador
   transmite solo el clip activo y usa su poster mientras carga, sin bloquear el
   resto de la página con variantes que aún no se muestran. config.preload=false
   también permite desactivar la precarga durante captura. */
const BLOBS = new Map();
async function preloadMedia(timeoutMs = 8000) {
  if (C.preload === false || window.__HF_RENDER_CAPTURE_MODE !== true) return;
  const srcs = new Set([C.audio?.src].filter(Boolean));
  for (const m of C.media || []) if (m.type === "video") {
    srcs.add(m.src);
    for (const g of Object.values(m.graded || {})) if (g.src) srcs.add(g.src);
  }
  const jobs = [...srcs].map(async s => {
    try { const r = await fetch(encodeURI(s)); if (r.ok) BLOBS.set(s, URL.createObjectURL(await r.blob())); } catch (e) {}
  });
  await Promise.race([Promise.all(jobs), new Promise(r => __nbSetTimeout(r, timeoutMs))]);
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
    if (spec.poster) el.poster = encodeURI(spec.poster);
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
  if (sc.kind !== "intro" && sc.t0 === 0 && window.NexaTemplateIntro?.title) {
    const title = window.NexaTemplateIntro.title(C.intro || {});
    if (title) {
      const L = div(root, "lay", { zIndex: 50, pointerEvents: "none" });
      const baseFs = Math.min(0.17 * H, fit(title, ser, 0.04, 0.88 * W, 0.17 * H));
      const titleFs = Math.min(baseFs * 1.45, fit(title, ser, 0.04, 0.94 * W, 0.25 * H));
      const heading = word(X, L, title, { cls: ser, fs: titleFs, x: W / 2, y: 0.5 * H, color: P.bone, ls: 0.04 });
      heading.el.style.whiteSpace = "nowrap";
      heading.el.style.textShadow = "0 0 18px rgba(255,125,55,0.42)";
      X.T(heading.el, "opacity", "0").to(0.02, 0.3, "1", EASE_OUT).to(1.05, 0.35, "0", EASE_IN);
    }
  }
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
    __nbSetTimeout(() => { if (curIdx === i && !nextBuilt) nextBuilt = { i: j, b: buildScene(scenes[j]) }; }, 0);
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
  const fontsReady = Promise.race([Promise.all(FONT_LOADS.map(f => doc.fonts.load(f))).then(() => doc.fonts.ready), new Promise(r => __nbSetTimeout(r, 3000))]);
  /* carga primero letra y fuentes: los clips pueden ser pesados y no deben
     ocupar las conexiones que necesita la línea de tiempo. Después se precarga
     media antes de arrancar el reloj, con el límite definido por preloadMedia. */
  const [segs] = await Promise.all([loadScript(), fontsReady]);
  await preloadMedia();
  audio.src = srcURL(C.audio.src);
  const aDur = await new Promise(res => {
    if (isFinite(audio.duration) && audio.duration > 0) return res(audio.duration);
    audio.addEventListener("loadedmetadata", () => res(audio.duration), { once: true });
    __nbSetTimeout(() => res(NaN), 2500);
  });
  if (segs.length) {
    const last = segs[segs.length - 1];
    const dur = isFinite(aDur) && aDur > 0 ? aDur : (segs.audioDurationSec || last.end || last.start + 3);
    measCache.clear();
    /* una plantilla puede traer su propia línea de tiempo (las de letra de canción) */
    scenes = (typeof makeTimeline === "function" ? makeTimeline : buildTimeline)(segs, dur);
  }
  addEventListener("resize", () => { vw = innerWidth; vh = innerHeight; measCache.clear(); nextBuilt = null; if (prev) { prev.dispose(); prev = null; prevIdx = -1; } if (cur) { cur.dispose(); cur = null; curIdx = -1; } });
  window.__promo = {
    scenes: () => scenes,
    seek(t) { forced = t; render(t); return new Promise(res => { const vs = cur ? [...cur.root.querySelectorAll("video")] : [];
      Promise.all(vs.map(v => new Promise(r => { if (v.readyState >= 2 && !v.seeking) r(); else { v.addEventListener("seeked", r, { once: true }); v.addEventListener("loadeddata", r, { once: true }); __nbSetTimeout(r, 1500); } })))
        .then(() => requestAnimationFrame(() => requestAnimationFrame(res))); }); },
    release() { forced = null; }
  };
  requestAnimationFrame(frame);
  if (FROZEN == null) begin();
}
/* ===================== FIN NÚCLEO COMÚN ===================== */

/* ======================= ESCENAS · promo-trendy ==========================
   Réplica del promo "Trendy": metraje en B/N cálido con duotono lima,
   itálica pesada, pantallas partidas, mosaico, tarjeta azul noche con
   círculo, letras gigantes, túnel de zoom radial y marcas × / + / puntos.
   Cada escena = un segmento del guion; config.scenes[i] = { type, media,
   repeat, in, out }. in/out: "zoom" (golpe de zoom con desenfoque) | "none". */
const P = C.palette;
const DUO = "duoLime", BW = "bwWarm";   /* keys de C.grades */
/* visible desde t (seg. de escena): pista discreta de visibility */
const show = (X, el, t) => { if (t > 0.001) X.T(el, "visibility", "hidden", true).set(t, "visible"); };

// Los previews consultan el componente canónico; el render usa su copia actual local.
const outroModule = new URL(/^\/api\/v1\/(drafts|templates)\//.test(location.pathname)
  ? "/api/v1/templates/promo-trendy/showcase/components/outro.js"
  : "./components/outro.js", document.baseURI);
outroModule.searchParams.set("v", String(Date.now()));
try { await import(outroModule.href); }
catch (error) { console.warn("[promo-trendy] No se pudo cargar el cierre compartido", error); }

const outroV2Module = new URL(/^\/api\/v1\/(drafts|templates)\//.test(location.pathname)
  ? "/api/v1/templates/promo-trendy/showcase/components/outroV2.js"
  : "./components/outroV2.js", document.baseURI);
outroV2Module.searchParams.set("v", String(Date.now()));
try { await import(outroV2Module.href); }
catch (error) { console.warn("[promo-trendy] No se pudo cargar el cierre compartido V2", error); }

const outroApi = () => { const v1 = window.NexaPromoTrendyOutro, v2 = window.NexaPromoTrendyOutroV2;
  const want = (QS.get("outro") || C.outro?.version || "").toString().toLowerCase() === "v2";
  return want && v2 ? v2 : v1 || v2; };

function makeTimeline(segments, duration) {
  const scenes = buildTimeline(segments, duration);
  return outroApi()?.timeline(scenes, duration, C.outro, B) || scenes;
}

/* ---- decoración ---- */
function mark(X, parent, ch, x, y, s, color, t0 = 0) {
  const o = tx(parent, ch, { cls: "mk", fs: s * 1.7, x, y, color });
  if (t0 > 0.001) X.T(o.el, "transform", "scale(0) rotate(-90deg)").to(t0, 0.22, "scale(1) rotate(0deg)", EASE_BACK);
  return o;
}
function dots(parent, x, y, w, h, color, cell) {
  return div(parent, "patch", { left: x + "px", top: y + "px", width: w + "px", height: h + "px",
    backgroundImage: `radial-gradient(${color} 30%, transparent 34%)`, backgroundSize: `${cell}px ${cell}px`, opacity: 0.55 });
}
function ring(parent, cx, cy, r, color, bw = 1.5) {
  return div(parent, "patch", { left: cx - r + "px", top: cy - r + "px", width: 2 * r + "px", height: 2 * r + "px",
    borderRadius: "50%", border: `${bw}px solid ${color}` });
}
function svgShape(parent, W, H, inner) {
  const s = doc.createElementNS(SVGNS, "svg");
  s.setAttribute("width", W); s.setAttribute("height", H); s.setAttribute("viewBox", `0 0 ${W} ${H}`);
  s.style.cssText = "position:absolute;left:0;top:0;overflow:visible;pointer-events:none";
  s.innerHTML = inner; parent.appendChild(s); return s;
}
function leak(parent, where = "100% 65%", a = 0.42) {
  return div(parent, "lay", { background: `radial-gradient(ellipse at ${where}, rgba(226,86,58,${a}) 0%, rgba(226,86,58,0) 55%)` });
}
function vignette(parent) { return div(parent, "lay", { background: "radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(0,0,0,0.55) 100%)" }); }
/* media a pantalla completa, con Ken Burns suave */
function full(X, parent, k, filter, from = 1.06, to = 1.14, o = {}) {
  const m = mbox(X, parent, k, { left: 0, top: 0, width: X.W + "px", height: X.H + "px" }, { filter, off: o.off });
  kenBurns(X, m, `scale(${from}) translate(0%, 0%)`, `scale(${to}) translate(${o.pan ?? -1.5}%, 0%)`);
  return m;
}
/* la misma toma dentro de un rectángulo (duotono distinto sobre la misma imagen):
   caja del tamaño del rectángulo con la toma desplazada, no un video a pantalla completa recortado */
function region(X, parent, k, rect, filter, o = {}) {
  const box = div(parent, "mbox", { left: rect.x + "px", top: rect.y + "px", width: rect.w + "px", height: rect.h + "px" });
  const inner = div(box, "lay", { left: -rect.x + "px", top: -rect.y + "px", width: X.W + "px", height: X.H + "px", inset: "auto" });
  const m = full(X, inner, k, filter, o.from, o.to, o);
  return { box, m };
}
/* franjas diagonales que barren la pantalla (transición "streak") */
function streak(X, parent, t0, d = 0.32, angle = -32) {
  const g = div(parent, "lay", { overflow: "hidden" });
  const cols = [P.lime, P.paper, "#E7A2A0", P.lime];
  cols.forEach((c, i) => {
    const b = div(g, "patch", { left: -0.3 * X.W + "px", top: (0.18 + i * 0.16) * X.H + "px", width: 1.6 * X.W + "px",
      height: (0.06 + (i % 2) * 0.05) * X.H + "px", background: c, transform: `rotate(${angle}deg) translateX(${-1.6 * X.W}px)` });
    X.T(b, "transform", `rotate(${angle}deg) translateX(${-1.6 * X.W}px)`)
      .to(t0 + i * 0.03, d, `rotate(${angle}deg) translateX(${1.6 * X.W}px)`, EASE_IO);
  });
  return g;
}
/* rastro de zoom radial: copias escaladas y translúcidas de la toma */
function zoomTrail(X, parent, k, filter, t0, d, dir = 1) {
  [1.12, 1.28, 1.5].forEach((s, i) => {
    const box = div(parent, "lay", { opacity: "0" });
    /* foto fija (no otro <video>): el rastro dura 0.4 s y va desenfocado */
    const m = mbox(X, box, asStill(mediaSpec(X.sc, k)), { left: 0, top: 0, width: X.W + "px", height: X.H + "px" }, { filter });
    m.el.style.transform = `scale(${s})`;
    X.T(box, "opacity", "0").set(t0, String(0.42 - i * 0.1)).to(t0 + d * 0.6, d * 0.4, "0");
    X.T(m.el, "transform", `scale(${dir > 0 ? s : 1})`).to(t0, d, `scale(${dir > 0 ? 1 : s})`, EASE_OUT);
  });
}
/* texto itálico con entrada "glitch": salto lateral en seco + copia fantasma */
function glitchIn(X, o, t0) {
  X.T(o.el, "transform", "translateX(-9%) skewX(-12deg)").set(t0, "translateX(6%) skewX(8deg)").set(t0 + 0.05, "translateX(-3%) skewX(-4deg)")
    .set(t0 + 0.1, "translateX(0%) skewX(0deg)");
  if (t0 > 0.001) X.T(o.box, "visibility", "hidden", true).set(t0, "visible");
}
/* golpe de zoom con desenfoque al entrar / salir de la escena */
function punches(X, layer) {
  const s = X.sc.slot, tr = X.T(layer, "transform", "scale(1)"), fl = X.T(layer, "filter", "none", true);
  if ((s.in ?? "zoom") === "zoom" && X.sc.idx > 0) {
    tr.set(0, "scale(1.28)").to(0, 0.24, "scale(1)", EASE_OUT);
    blurPass(fl, 0, 0.22, "y");
  }
  const tail = Math.min(0.24, X.dur * 0.2);
  if ((s.out ?? "zoom") === "zoom" && X.sc.idx < scenes.length - 1) {
    tr.to(X.dur - tail, tail, "scale(1.3)", EASE_IN);
    blurPass(fl, X.dur - tail, tail, "y", true);
  }
}
const word0 = X => (X.lines[0]?.text || X.sc.seg.text || "").toUpperCase();
/* Rótulo legible sobre la composición; se conserva la animación de fondo. */
function readableLabel(X, parent, word, y = 0.5) {
  const { W, H } = X, portrait = H > W;
  const fs = fit(word, "mi", 0, 0.82 * W, (portrait ? 0.048 : 0.095) * H);
  const h = Math.max(fs * 1.65, (portrait ? 0.065 : 0.12) * H);
  const band = div(parent, "patch", { left: 0.05 * W + "px", top: y * H - h / 2 + "px", width: 0.9 * W + "px", height: h + "px", background: "rgba(0,0,18,0.88)" });
  band.dataset.trendyLabel = "background";
  const label = tx(parent, word, { cls: "mi", fs, x: 0.5 * W, y: y * H, color: P.paper });
  label.el.dataset.trendyLabel = "text";
}


const B = {};

B.title = (sc, X) => {
  const { W, H, u, root } = X, L = div(root, "lay");
  full(X, L, 0, BW);
  const lime = region(X, L, 0, { x: 0, y: 0, w: 0.34 * W, h: H }, DUO);
  X.T(lime.box, "clipPath", `inset(0px ${0.34 * W}px 0px 0px)`).to(0, 0.4, "inset(0px 0px 0px 0px)", EASE_OUT);
  leak(L); vignette(L);
  svgShape(L, W, H, `<g fill="none" stroke="${P.paper}" stroke-width="${1.4 * u}" opacity=".75">
      <polyline points="${0.05 * W},${0.9 * H} ${0.2 * W},${0.25 * H} ${0.36 * W},${0.9 * H}"/>
      <line x1="${0.12 * W}" y1="${0.18 * H}" x2="${0.34 * W}" y2="${0.72 * H}" stroke="${P.lime}"/>
      <line x1="${0.36 * W}" y1="${0.3 * H}" x2="${0.78 * W}" y2="${0.3 * H}" opacity=".5"/>
      <line x1="${0.52 * W}" y1="${0.66 * H}" x2="${0.95 * W}" y2="${0.66 * H}"/></g>`);
  const [l1, l2] = [X.lines[0] || { text: "" }, X.lines[1] || { text: "" }];
  const fs = Math.min(fit(l1.text.toUpperCase(), "mi", 0, (H > W ? 0.86 : 0.36) * W, 0.13 * H), fit(l2.text.toUpperCase(), "mi", 0, (H > W ? 0.86 : 0.36) * W, 0.13 * H));
  const a = tx(L, l1.text.toUpperCase(), { cls: "mi", fs, x: (H > W ? 0.5 : 0.66) * W, y: 0.44 * H, color: P.paper });
  const b = tx(L, l2.text.toUpperCase(), { cls: "mi", fs, x: (H > W ? 0.5 : 0.7) * W, y: 0.44 * H + fs * 0.9, color: P.lime });
  glitchIn(X, a, Math.max(0.12, l1.rt)); glitchIn(X, b, Math.max(0.2, l2.rt));
  [["×", 0.64], ["+", 0.68], ["×", 0.72]].forEach(([c, fx], i) => mark(X, L, c, fx * W, 0.19 * H, 22 * u, i === 1 ? P.lime : P.paper, 0.3 + i * 0.05));
  [["+", 0.76], ["+", 0.8], ["+", 0.84]].forEach(([c, fx], i) => mark(X, L, c, fx * W, 0.84 * H, 20 * u, i === 1 ? P.lime : P.paper, 0.45 + i * 0.05));
  const bar = div(L, "patch", { left: 0.33 * W + "px", top: 0.93 * H + "px", width: 0.26 * W + "px", height: 0.028 * H + "px", background: P.lime, transformOrigin: "left" });
  X.T(bar, "transform", "scaleX(0)").to(0.35, 0.3, "scaleX(1)", EASE_OUT);
  dots(L, 0.88 * W, 0.8 * H, 0.08 * W, 0.08 * H, P.paper, 7 * u);
  punches(X, L);
};

B.stack = (sc, X) => {
  const { W, H, u, root } = X, L = div(root, "lay");
  full(X, L, 0, BW, 1.08, 1.12, { pan: 2 });
  leak(L, "100% 30%", 0.35); vignette(L);
  const blk = div(L, "patch", { left: 0.12 * W + "px", top: 0.28 * H + "px", width: 0.3 * W + "px", height: 0.3 * H + "px", background: P.lime });
  const word = word0(X), n = sc.slot.repeat || 5;
  const fs = fit(word, "mi", 0, 0.36 * W, 0.155 * H), lh = fs * 0.92;
  const t0 = Math.max(0.2, X.lines[0]?.rt ?? 0.3);
  X.T(blk, "transform", "translateX(0px) scaleX(1)").to(t0 - 0.1, 0.35, `translateX(${0.55 * W}px) scaleX(1.8)`, EASE_IO);
  X.T(blk, "clipPath", "inset(0% 0% 0% 0%)").to(t0 - 0.1, 0.35, "inset(12% 0% 18% 0%)", EASE_IO);
  for (let i = 0; i < n; i++) {
    const o = tx(L, word, { cls: "mi", fs, x: 0.12 * W, y: 0.13 * H + i * lh, ax: 0, ay: 0, color: P.paper });
    const t = t0 + (i < 2 ? i * 0.08 : 0.2 + (i - 1) * 0.22);
    X.T(o.box, "visibility", "hidden", true).set(t, "visible");
    X.T(o.el, "transform", "translateX(-14%)").to(t, 0.18, "translateX(0%)", EASE_OUT);
  }
  dots(L, 0.82 * W, 0.66 * H, 0.1 * W, 0.12 * H, P.paper, 7 * u);
  /* rasgado a mitad de escena (franjas blancas/rojas con desenfoque) */
  const tg = X.dur * 0.34;
  if (X.dur > 1.8) {
    const g = div(L, "lay", { visibility: "hidden" });
    [[0.18, "#F2EFE6", 0.2], [0.34, "#D8322A", 0.05], [0.44, "#F2EFE6", 0.16], [0.7, "#F2EFE6", 0.08]].forEach(([y, c, h]) =>
      div(g, "patch", { left: 0, top: y * H + "px", width: W + "px", height: h * H + "px", background: c, filter: "url(#mbx3)" }));
    X.T(g, "visibility", "hidden", true).set(tg, "visible").set(tg + 0.14, "hidden");
  }
  punches(X, L);
  if (H > W) readableLabel(X, L, word, 0.72);
};

B.split = (sc, X) => {
  const { W, H, u, root } = X, L = div(root, "lay", { background: P.navy });
  const left = mbox(X, L, 0, { left: 0, top: 0, width: 0.5 * W + "px", height: H + "px" }, { filter: DUO });
  const right = mbox(X, L, 1, { left: 0.5 * W + "px", top: 0, width: 0.5 * W + "px", height: H + "px" }, { filter: BW, off: 0.4 });
  X.T(left.box, "transform", `translateY(${-H}px)`).to(0, 0.3, "translateY(0px)", EASE_OUT);
  X.T(right.box, "transform", `translateY(${H}px)`).to(0.05, 0.3, "translateY(0px)", EASE_OUT);
  for (const m of [left, right]) kenBurns(X, m, "scale(1.05)", "scale(1.12)");
  leak(L, "100% 20%", 0.3);
  const word = word0(X), t0 = Math.max(0.3, X.lines[0]?.rt ?? 0.4);
  const band = div(L, "patch", { left: 0.5 * W + "px", top: 0.6 * H + "px", width: 0.5 * W + "px", height: 0.2 * H + "px", background: P.lime, transformOrigin: "right" });
  X.T(band, "transform", "scaleX(0)").to(t0 - 0.1, 0.25, "scaleX(1)", EASE_OUT);
  const fs = fit(word, "mi", 0, 0.34 * W, 0.12 * H);
  const o = tx(L, word, { cls: "mi", fs, x: 0.78 * W, y: 0.7 * H, color: P.ink });
  X.T(o.el, "transform", "translateY(90%)").to(t0, 0.22, "translateY(0%)", EASE_OUT);
  X.T(o.box, "clipPath", "inset(0% 0% 0% 0%)");
  /* fase 2: la banda crece al centro con la palabra grande */
  const t2 = X.dur * 0.62;
  if (X.dur > 1.4) {
    X.T(band, "clipPath", "inset(0px 0px 0px 0px)");
    const big = div(L, "patch", { left: 0.06 * W + "px", top: 0.3 * H + "px", width: 0.88 * W + "px", height: 0.3 * H + "px", background: P.lime, visibility: "hidden" });
    X.T(big, "visibility", "hidden", true).set(t2, "visible");
    X.T(big, "transform", "scale(0.4, 0.6)").to(t2, 0.22, "scale(1, 1)", EASE_OUT);
    const g = tx(L, word, { cls: "mi", fs: fs * 1.7, x: 0.5 * W, y: 0.45 * H, color: P.ink });
    X.T(g.box, "visibility", "hidden", true).set(t2 + 0.05, "visible");
    X.T(g.el, "transform", "scale(0.6)").to(t2 + 0.05, 0.2, "scale(1)", EASE_OUT);
    mark(X, L, "×", 0.9 * W, 0.34 * H, 22 * u, P.paper, t2 + 0.1);
  }
  mark(X, L, "×", 0.07 * W, 0.12 * H, 20 * u, P.paper, 0.2);
  mark(X, L, "+", 0.53 * W, 0.12 * H, 20 * u, P.paper, 0.25);
  if ((sc.slot.out ?? "zoom") === "zoom") punches(X, L);
  if (H > W) readableLabel(X, L, word, 0.82);
};

B.grid = (sc, X) => {
  const { W, H, u, root } = X, L = div(root, "lay", { background: P.navy });
  const g = div(L, "grp", { left: W / 2 + "px", top: H / 2 + "px" });
  const cols = 5, rows = 5, tw = W / 3.1, th = H / 2.35, word = word0(X);
  const fs = fit(word, "mi", 0, tw * 0.42, th * 0.12);
  let k = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = (c - (cols - 1) / 2) * tw - tw / 2, y = (r - (rows - 1) / 2) * th - th / 2;
    const spec = mediaSpec(sc, k++ % Math.max(1, (sc.slot.media || [1, 2, 3, 4]).length));
    const img = asStill(spec);
    const tile = div(g, "patch", { left: x + "px", top: y + "px", width: tw + "px", height: th + "px", overflow: "hidden" });
    mbox(X, tile, img, { left: 0, top: 0, width: "100%", height: "100%" }, { filter: (r + c) % 2 ? BW : DUO });
    const band = div(tile, "patch", { left: (c % 2 ? 0.48 : 0.05) * tw + "px", top: 0.66 * th + "px", width: 0.47 * tw + "px", height: 0.16 * th + "px", background: P.lime });
    tx(band, word, { cls: "mi", fs, x: 0.235 * tw, y: 0.08 * th, color: P.ink });
    tx(tile, "×", { cls: "mk", fs: 14 * u, x: 0.9 * tw, y: 0.12 * th, color: P.paper });
  }
  X.T(g, "transform", "scale(2.05)").to(0, X.dur, "scale(0.92)", "cubic-bezier(.3,.1,.3,1)");
  leak(L, "0% 100%", 0.25);
  readableLabel(X, L, word);
};

B.circle = (sc, X) => {
  const { W, H, u, root } = X, L = div(root, "lay", { background: `radial-gradient(ellipse at 50% 45%, ${P.navy2} 0%, ${P.navy} 70%)` });
  leak(L, "10% 100%", 0.25);
  const R = 0.3 * H, rg = ring(L, W / 2, H / 2, R, "rgba(242,239,230,0.55)", 1.4 * u);
  X.T(rg, "transform", "scale(0.12)").to(0, 0.35, "scale(1)", EASE_OUT).to(0.35, X.dur, "scale(1.08)");
  const word = word0(X), n = sc.slot.repeat || 3;
  const fs = fit(word, "mi", 0, (H > W ? 0.84 : 0.38) * W, 0.12 * H), lh = fs * 0.95;
  const grp = div(L, "lay");
  for (let i = 0; i < n; i++) {
    const o = tx(grp, word, { cls: "mi", fs, x: W / 2, y: H / 2 + (i - (n - 1) / 2) * lh, color: i % 2 ? P.paper : P.lime });
    const t = Math.max(0.12, X.lines[0]?.rt ?? 0.15) + i * 0.06;
    X.T(o.el, "transform", "scale(0)").to(t, 0.22, "scale(1)", EASE_BACK);
  }
  X.T(grp, "transform", "scale(1)").to(0.4, X.dur, "scale(1.06)");
  mark(X, L, "+", 0.1 * W, 0.84 * H, 46 * u, P.paper, 0.3);
  mark(X, L, "×", 0.86 * W, 0.12 * H, 18 * u, P.paper, 0.35);
  dots(L, 0.06 * W, 0.08 * H, 0.08 * W, 0.08 * H, P.paper, 6 * u);
  dots(L, 0.86 * W, 0.8 * H, 0.08 * W, 0.1 * H, P.paper, 6 * u);
  if (X.dur > 1.6) streak(X, L, X.dur * 0.42);
  punches(X, L);
};

B.maskword = (sc, X) => {
  const { W, H, u, root } = X, L = div(root, "lay");
  full(X, L, 0, DUO, 1.1, 1.2, { pan: 3 });
  const word = word0(X), fs = 1.25 * H;
  const w = textW(word, "mi", 0, fs);
  const big = tx(L, word, { cls: "mi", fs, x: 0, y: 0.5 * H, ax: 0, color: P.paper, canvas: true });
  X.T(big.el, "transform", `translateX(${0.55 * W}px)`).to(0, X.dur, `translateX(${-w + 0.2 * W}px)`, "cubic-bezier(.35,.1,.45,1)");
  const cw = 0.52 * W, ch = 0.4 * H;
  const card = mbox(X, L, 1, { left: (W - cw) / 2 + "px", top: (H - ch) / 2 + "px", width: cw + "px", height: ch + "px",
    boxShadow: "0 20px 60px rgba(0,0,0,0.35)" }, { filter: BW, off: 0.3 });
  X.T(card.box, "transform", "translateY(40%) scale(0.35) rotate(-8deg)").to(0.1, 0.5, "translateY(0%) scale(1) rotate(-3deg)", EASE_OUT)
    .to(0.6, Math.max(0.3, X.dur - 0.6), "translateY(0%) scale(1.1) rotate(2deg)");
  dots(L, 0.78 * W, 0.72 * H, 0.08 * W, 0.1 * H, P.paper, 6 * u);
  punches(X, L);
  readableLabel(X, L, word, 0.73);
};

B.spaced = (sc, X) => {
  const { W, H, u, root } = X, L = div(root, "lay");
  full(X, L, 0, BW, 1.04, 1.1);
  const lime = region(X, L, 0, { x: 0, y: 0, w: 0.38 * W, h: H }, DUO);
  leak(L); vignette(L);
  zoomTrail(X, L, 0, DUO, 0, 0.4, 1);
  const word = word0(X), n = sc.slot.repeat || 3;
  const fs = fit(word, "mi", H > W ? 0.06 : 0.38, (H > W ? 0.88 : 0.5) * W, 0.12 * H), lh = fs * 0.98, t0 = Math.max(0.15, X.lines[0]?.rt ?? 0.2);
  for (let i = 0; i < n; i++) {
    const ghost = i % 2 === 1;
    const o = tx(L, word, { cls: "mi", fs, x: (H > W ? 0.06 : 0.22) * W, y: 0.5 * H + (i - (n - 1) / 2) * lh, ax: 0, color: ghost ? "rgba(242,239,230,0.55)" : P.paper, ls: H > W ? 0.06 : 0.38, stroke: ghost, sw: 0.02 });
    slideIn(X, o.el, t0 + i * 0.07, 0.5 * W);
  }
  if (X.dur > 1.3) {
    const t = X.dur * 0.45, g = div(L, "lay", { visibility: "hidden" });
    [[0.2, P.paper, 0.1], [0.34, P.lime, 0.06], [0.48, "#E7A2A0", 0.05], [0.62, P.paper, 0.12]].forEach(([y, c, h], i) => {
      const b = div(g, "patch", { left: 0.3 * W + "px", top: y * H + "px", width: 0.7 * W + "px", height: h * H + "px", background: c, transformOrigin: "right" });
      X.T(b, "transform", "scaleX(0)").to(t + i * 0.02, 0.14, "scaleX(1)", EASE_OUT).to(t + 0.2, 0.12, "scaleX(0)", EASE_IN);
    });
    X.T(g, "visibility", "hidden", true).set(t, "visible").set(t + 0.34, "hidden");
  }
  const bar = div(L, "patch", { left: 0.05 * W + "px", top: 0.88 * H + "px", width: 0.16 * W + "px", height: 0.022 * H + "px", background: P.paper });
  X.T(bar, "transform", "scaleX(0)").to(t0, 0.3, "scaleX(1)", EASE_OUT); bar.style.transformOrigin = "left";
  mark(X, L, "×", 0.58 * W, 0.93 * H, 20 * u, P.lime, t0 + 0.2);
  mark(X, L, "×", 0.53 * W, 0.08 * H, 16 * u, P.paper, t0 + 0.25);
  punches(X, L);
};

B.tunnel = (sc, X) => {
  const { W, H, u, root } = X, L = div(root, "lay");
  full(X, L, 0, DUO, 1.0, 1.08);
  zoomTrail(X, L, 0, DUO, 0, 0.45, 1);
  leak(L, "100% 100%", 0.35); vignette(L);
  const word = word0(X), fs = fit(word, "mi", 0.04, 0.5 * W, 0.24 * H);
  const o = tx(L, word, { cls: "mi", fs, x: 0.5 * W, y: 0.46 * H, color: P.paper, stroke: true, sw: 0.018, ls: 0.04 });
  const t = X.dur * 0.35, d = Math.min(0.9, X.dur * 0.35);
  X.T(o.el, "transform", "scale(1) rotate(0deg)").to(t, d * 0.55, "scale(7) rotate(-6deg)", EASE_IN).set(t + d * 0.55, "scale(0.6) rotate(0deg)")
    .to(t + d * 0.6, d * 0.4, "scale(1) rotate(0deg)", EASE_OUT);
  X.T(o.el, "opacity", "0.85").to(t + d * 0.3, d * 0.25, "0").to(t + d * 0.6, d * 0.3, "0.85");
  zoomTrail(X, L, 0, DUO, t, d * 0.55, 1);
  mark(X, L, "+", 0.84 * W, 0.12 * H, 30 * u, P.paper, 0.3);
  ring(L, 0.08 * W, 0.95 * H, 0.2 * H, "rgba(242,239,230,0.35)", 1.2 * u);
  punches(X, L);
  readableLabel(X, L, word, 0.68);
};

B.action = (sc, X) => {
  const { W, H, u, root } = X, L = div(root, "lay");
  full(X, L, 0, BW, 1.05, 1.1, { pan: -1 });
  const panel = mbox(X, L, 1, { left: 0.5 * W + "px", top: 0, width: 0.24 * W + "px", height: H + "px" }, { filter: DUO, off: 0.2 });
  X.T(panel.box, "transform", `translateY(${-H}px)`).to(0, 0.28, "translateY(0px)", EASE_OUT);
  leak(L, "100% 60%", 0.45); vignette(L);
  ring(L, 0.42 * W, 0.5 * H, 0.28 * H, "rgba(242,239,230,0.6)", 1.3 * u);
  svgShape(L, W, H, `<polyline points="${0.3 * W},${0.66 * H} ${0.38 * W},${0.52 * H} ${0.46 * W},${0.66 * H}" fill="none" stroke="${P.paper}" stroke-width="${1.6 * u}" opacity=".8"/>
    <line x1="${0.1 * W}" y1="${0.66 * H}" x2="${0.6 * W}" y2="${0.66 * H}" stroke="${P.paper}" stroke-width="${1.2 * u}" opacity=".6"/>`);
  const word = word0(X), fs = fit(word, "mi", 0, (H > W ? 0.84 : 0.42) * W, 0.16 * H), t0 = Math.max(0.2, X.lines[0]?.rt ?? 0.3);
  const o = tx(L, word, { cls: "mi", fs, x: 0.47 * W, y: 0.5 * H, color: P.paper });
  X.T(o.el, "transform", "scale(1.5)").to(t0, 0.25, "scale(1)", EASE_OUT);
  blurPass(X.T(o.el, "filter", "none", true), t0, 0.22, "x");
  X.T(o.box, "visibility", "hidden", true).set(t0, "visible");
  /* salida glitch: la palabra se duplica desplazada */
  const tg = X.dur - 0.32;
  const gh = tx(L, word, { cls: "mi", fs, x: 0.47 * W, y: 0.5 * H + fs * 0.32, color: P.paper });
  X.T(gh.box, "visibility", "hidden", true).set(tg, "visible");
  X.T(gh.el, "clipPath", "inset(0% 0% 50% 0%)");
  [["×", 0.2, 0.5], ["+", 0.92, 0.6], ["×", 0.9, 0.38]].forEach(([c, fx, fy], i) => mark(X, L, c, fx * W, fy * H, 20 * u, P.paper, 0.3 + i * 0.05));
  dots(L, 0.14 * W, 0.8 * H, 0.08 * W, 0.08 * H, P.paper, 6 * u);
  X.T(L, "transform", "translateX(0px)").set(tg, `translateX(${6 * u}px)`).set(tg + 0.06, `translateX(${-8 * u}px)`).set(tg + 0.12, "translateX(0px)");
};

B.end = (sc, X) => {
  const { W, H, u, root } = X, L = div(root, "lay", { background: P.navy });
  const glow = div(L, "lay", { background: `radial-gradient(ellipse at 15% 85%, rgba(226,86,58,0.55) 0%, rgba(120,40,60,0.25) 30%, transparent 60%)` });
  X.T(glow, "transform", "translate(0px, 0px) scale(1)").to(0, X.dur, `translate(${0.08 * W}px, ${-0.05 * H}px) scale(1.2)`);
  const R = 0.3 * H;
  const r1 = ring(L, W / 2, H / 2, R, "rgba(242,239,230,0.55)", 1.3 * u), r2 = ring(L, W / 2 + 0.02 * W, H / 2, R * 1.2, "rgba(242,239,230,0.25)", 1 * u);
  X.T(r1, "transform", "scale(0.2)").to(0, 0.4, "scale(1)", EASE_OUT);
  X.T(r2, "transform", "scale(0.2)").to(0.05, 0.45, "scale(1)", EASE_OUT);
  const ls = X.lines.length ? X.lines : [{ text: sc.seg.text, rt: 0.2 }];
  const fs = Math.min(...ls.map(l => fit(l.text.toUpperCase(), "mi", 0.06, (H > W ? 0.84 : 0.38) * W, 0.11 * H)));
  const grp = div(L, "lay");
  ls.forEach((l, i) => {
    const o = tx(grp, l.text.toUpperCase(), { cls: "mi", fs, x: W / 2, y: H / 2 + (i - (ls.length - 1) / 2) * fs * 0.98, color: P.lime, ls: 0.06 });
    slideIn(X, o.el, Math.max(0.15, l.rt) + i * 0.08, -0.4 * W);
  });
  const ln = div(L, "patch", { left: 0, top: 0.62 * H + "px", width: W + "px", height: Math.max(1, 1.5 * u) + "px", background: P.paper, transformOrigin: "left" });
  X.T(ln, "transform", "scaleX(0)").to(0.6, 0.3, "scaleX(1)", EASE_OUT).to(1.1, 0.25, "scaleX(0)", EASE_IN);
  if (X.dur > 1.8) streak(X, L, 1.0, 0.3, -24);
  if (X.dur > 2.6) X.T(grp, "transform", "scale(1)").to(1.9, 0.12, "scale(1.35)", EASE_OUT).to(2.02, 0.25, "scale(1)", EASE_OUT);
  mark(X, L, "+", 0.88 * W, 0.84 * H, 46 * u, P.paper, 0.4);
  mark(X, L, "×", 0.06 * W, 0.12 * H, 18 * u, P.paper, 0.45);
  dots(L, 0.87 * W, 0.06 * H, 0.08 * W, 0.08 * H, P.paper, 6 * u);
  dots(L, 0.02 * W, 0.84 * H, 0.08 * W, 0.1 * H, P.paper, 6 * u);
};

/* entrada lateral con desenfoque (para renglones) */
function slideIn(X, el, t, dx, d = 0.3) {
  X.T(el, "transform", `translateX(${dx}px)`).to(t, d, "translateX(0px)", EASE_OUT);
  blurPass(X.T(el, "filter", "none", true), t, d * 0.8, "x");
  if (t > 0.001) X.T(el, "visibility", "hidden", true).set(t, "visible");
}

/* Cierre compartido (components/outro.js). Herramientas: motor (div, tx, fit,
   textW, measure, blurPass, mbox, asStill, kenBurns, mediaSpec, curvas) y
   firmas de la promo (mark, dots, ring, svgShape, leak, vignette, full, region,
   streak, zoomTrail, glitchIn, slideIn, readableLabel; grades DUO/BW). */
B.outro = (sc, X) => outroApi()
  ? outroApi().render(sc, X, P, C.outro, { div, tx, fit, textW, measure, show, mark, dots, ring, svgShape,
      leak, vignette, full, region, streak, zoomTrail, glitchIn, slideIn, readableLabel, blurPass, mbox, asStill, kenBurns,
      mediaSpec, EASE_OUT, EASE_IN, EASE_IO, EASE_BACK, DUO, BW })
  : B.end(sc, X);

boot();
