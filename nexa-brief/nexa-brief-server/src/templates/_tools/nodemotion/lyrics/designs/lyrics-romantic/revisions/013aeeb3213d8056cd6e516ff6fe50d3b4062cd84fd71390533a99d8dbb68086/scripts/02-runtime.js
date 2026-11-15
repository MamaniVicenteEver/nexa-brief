
/* ================================ CONFIG ================================
   PLANTILLA ROMÁNTICA — "carta escrita a mano"
   Mecánica: las líneas se escriben carácter a carácter (cascada de tinta),
   alternando serif itálica (marfil) y caligrafía script (rosa viejo). Las
   líneas de una sola palabra van en script grande y laten (heartbeat).
   Poema irregular: alineación y sangría varían con semilla. Bokeh cálido
   flotando detrás. Cámara vertical lenta.
   El CONFIG ya no vive aquí: vive en config.json como colección de casos con
   "id" (mismo patrón que 04-video-motion). Cada objeto trae audio, lyricsUrl,
   bg, fonts, colors, intro/outro, layout, bokeh y seed. Para otra canción,
   agregá otro objeto al array "configs" — acá no se toca nada.
   Carga con 3 niveles de fallback (no afecta al pipeline, que siempre sirve
   un config.json real por HTTP y gana en el nivel 1):
     1. fetch("config.json")         — lo que el pipeline genera y sirve.
     2. fetch("assets/config.json")  — default versionado, si serviste esta
        carpeta con un server (python3 -m http.server) sin que el pipeline
        haya escrito un config.json en la raíz.
     3. DEFAULT_CONFIG embebido      — para abrir el archivo con doble clic
        (file://), donde fetch() queda bloqueado por el navegador.
   ========================================================================== */
const ACTIVE_ID = null;   /* <-- forzar un id ("default" | ...) · null = usa "activeId" del JSON */

const DEFAULT_CONFIG = { "activeId": "default", "configs": [{
  "id": "default",
  "description": "Carta de amor escrita a mano — paleta cálida marfil y rosa viejo, líneas que se escriben carácter a carácter alternando serif itálica y caligrafía script, bokeh cálido flotando detrás. — metadata para marketing/SEO, la plantilla no la usa todavía.",
  "audio": { "src": "assets/song.mp3" },
  "lyricsUrl": "assets/lyrics.json",
  "bg": { "type": "image", "src": "assets/bg.png",
          "filter": "grayscale(0.35) brightness(0.30) contrast(1.05) sepia(0.35) hue-rotate(-24deg) saturate(1.25)" },
  "fonts": { "googleUrl": "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@1,500;1,700&family=Great+Vibes&display=swap",
             "serif": "\"Playfair Display\", serif", "script": "\"Great Vibes\", cursive" },
  "colors": { "serif": "#F2E7DA", "script": "#D89A9E", "muted": "#cbb8ad" },
  "intro": { "artist": "", "title": "Dueles Tan Bien", "sub": "", "feats": "" },
  "outro": { "leadSec": 8, "title": "Gracias", "sub": "por escuchar", "feats": "Suscríbete · NEXA BRIEF" },
  "debug": { "enabled": false },
  "layout": { "groupGapSec": 0.42, "maxRowChars": 22, "rowGapVh": 3.6, "anchorVhFrac": 0.55,
              "scriptChanceSolo": 0.75, "scriptChanceMulti": 0.22, "sideAlignChance": 0.3,
              "maxTiltDeg": 1.6, "charStepMs": 55, "oldAfter": 3 },
  "bokeh": { "count": 16, "tint": "216,140,140" },
  "seed": 11
}] };

async function loadDB() {
  for (const url of ["config.json", "assets/config.json"]) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.json();
    } catch (e) { /* file:// u otro bloqueo — probamos el siguiente nivel */ }
  }
  console.warn("[carta-de-amor] No se pudo cargar config.json ni assets/config.json (¿abierto por file://?) — usando DEFAULT_CONFIG embebido.");
  return DEFAULT_CONFIG;
}

const DB = await loadDB();
const CONFIG = DB.configs.find(c => c.id === ACTIVE_ID)
            || DB.configs.find(c => c.id === DB.activeId)
            || DB.configs[0];

/* tema desde el JSON → variables CSS (los defaults del CSS son idénticos al
   caso actual, así que sin config el diseño no cambia en nada) */
(function applyTheme(C) {
  const root = document.documentElement;
  if (C.fonts?.googleUrl) {
    const link = document.querySelector('link[href^="https://fonts.googleapis.com/css2"]');
    if (link && link.href !== C.fonts.googleUrl) link.href = C.fonts.googleUrl;
  }
  if (C.fonts?.serif)  root.style.setProperty("--fontSerif", C.fonts.serif);
  if (C.fonts?.script) root.style.setProperty("--fontScript", C.fonts.script);
  const col = C.colors || {};
  if (col.serif)  root.style.setProperty("--serifInk", col.serif);
  if (col.script) root.style.setProperty("--scriptInk", col.script);
  if (col.muted)  root.style.setProperty("--muted", col.muted);
})(CONFIG);
/* ======================================================================== */

const doc = document, $ = id => doc.getElementById(id);
const C = CONFIG, world = $("world"), audio = $("audio");
let introDurationSeconds = window.NexaRomanticIntro.DEFAULT_DURATION_SECONDS;
const introController = window.NexaRomanticIntro.createDOMIntro({
  root: $("intro"),
  config: C.intro || {},
});
let vw = innerWidth, vh = innerHeight;
addEventListener("resize", () => { vw = innerWidth; vh = innerHeight; });

function mulberry32(a) { return function() {
  a |= 0; a = a + 0x6D2B79F5 | 0;
  let t = Math.imul(a ^ a >>> 15, 1 | a);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rng = mulberry32(C.seed);

/* ---- salida con el componente propio de esta plantilla ---- */
const outroController = window.NexaRomanticOutro.createDOMOutro({
  root: $("outro"),
  config: C.outro || {},
  onShow: () => {
    doc.body.classList.add("outroActive");
    doc.body.classList.remove("introActive");
    $("intro").classList.add("gone");
    for (const el of placed) el.classList.add("old");
  },
});

/* ---- lyrics desde whisper JSON, agrupadas en líneas ---- */
async function loadLyrics() {
  try {
    const r = await fetch(C.lyricsUrl);
    if (!r.ok) throw new Error("HTTP " + r.status);
    const j = await r.json();
    const flat = [];
    for (const seg of j.segments) for (const w of seg.words)
      flat.push({ t: w.start, text: w.word.trim() });
    if (!flat.length) throw new Error("sin palabras");
    return groupIntoRows(flat);
  } catch (e) {
    console.warn("[romantica] No se pudo cargar", C.lyricsUrl,
                 "— sirve el HTML por HTTP (Live Server), no por file://.", e);
    return [];
  }
}
function groupIntoRows(flat) {
  const rows = [];
  let cur = null;
  for (const w of flat) {
    const clean = w.text.replace(/[.,;!?¡¿"']/g, "");
    if (!clean) continue;
    if (cur && (w.t - cur.lastT) < C.layout.groupGapSec &&
        (cur.text + " " + clean).length <= C.layout.maxRowChars) {
      cur.text += " " + clean; cur.lastT = w.t; cur.words++;
    } else {
      if (cur) rows.push(cur);
      cur = { t: w.t, text: clean, lastT: w.t, words: 1 };
    }
  }
  if (cur) rows.push(cur);
  return rows;
}

/* ---- colocación: poema vertical, escritura por caracteres ---- */
let rowY = 0, placed = [];

function fontSizeFor(text, words, script) {
  const len = Math.max(2, text.length);
  const base = words <= 1 ? vh * (script ? 0.15 : 0.11) : vh * 0.066;
  /* móvil vertical: aprovecha más ancho (desktop no cambia) */
  const wShare = vw < vh ? 0.95 : 0.84;
  let fs = Math.min(vw * wShare / (len * (script ? 0.42 : 0.56)), base);
  fs *= 0.92 + rng() * 0.16;
  return Math.max(vh * 0.04, fs);
}

function placeRow(r) {
  const L = C.layout;
  const scriptChance = r.words <= 1 ? L.scriptChanceSolo : L.scriptChanceMulti;
  const script = rng() < scriptChance;

  const el = doc.createElement("div");
  let cls = "row " + (script ? "script" : "serif");
  if (rng() < L.sideAlignChance) cls += rng() < 0.5 ? " alignL" : " alignR";
  if (script && r.words <= 1) cls += " beat";
  el.className = cls;
  el.style.setProperty("--rot", ((rng() - 0.5) * 2 * L.maxTiltDeg).toFixed(2) + "deg");
  const fs = fontSizeFor(r.text, r.words, script);
  el.style.fontSize = fs + "px";
  el.style.top = rowY + "px";

  /* la línea se "escribe": un span por carácter, encendido en cascada */
  const chars = [...r.text];
  for (const ch of chars) {
    const sp = doc.createElement("span");
    sp.textContent = ch;
    el.appendChild(sp);
  }
  world.appendChild(el);
  const spans = el.querySelectorAll("span");
  spans.forEach((sp, i) => __nbSetTimeout(() => sp.classList.add("on"), 40 + i * L.charStepMs));

  const height = fs * (script ? 1.3 : 1.15);
  const y = rowY;
  rowY += height + vh * (L.rowGapVh / 100);

  placed.push(el);
  const cutoff = placed.length - L.oldAfter;
  for (let i = 0; i < placed.length; i++) if (i < cutoff) placed[i].classList.add("old");
  if (placed.length > 16) { const old = placed.shift(); old.remove(); }

  return { y, h: height };
}

/* ---- cámara vertical suave ---- */
let camY = 0, camTY = 0;
function aimCamera(r) { if (r) camTY = r.y + r.h / 2 - vh * C.layout.anchorVhFrac; }

/* ---- bokeh cálido ---- */
const bok = $("bokeh"), bctx = bok.getContext("2d");
let lights = [];
function seedBokeh() {
  lights = Array.from({ length: C.bokeh.count }, () => ({
    x: rng() * vw, y: rng() * vh,
    r: 14 + rng() * 46, v: 0.04 + rng() * 0.1,
    a: 0.03 + rng() * 0.06, ph: rng() * Math.PI * 2
  }));
}
function drawBokeh(t) {
  bok.width = vw; bok.height = vh;
  bctx.clearRect(0, 0, vw, vh);
  for (const b of lights) {
    b.y -= b.v;
    b.x += Math.sin(t * 0.00022 + b.ph) * 0.2;
    if (b.y < -60) { b.y = vh + 60; b.x = rng() * vw; }
    const g = bctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
    g.addColorStop(0, `rgba(${C.bokeh.tint},${b.a})`);
    g.addColorStop(1, `rgba(${C.bokeh.tint},0)`);
    bctx.fillStyle = g;
    bctx.fillRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
  }
}

/* ---- reloj: audio si suena; si no, rAF ---- */
let started = false;
/* La escena sigue al audio: si está pausado, intro y letra se quedan en su tiempo actual. */
const clock = () => Number.isFinite(audio.currentTime) ? audio.currentTime : 0;

async function begin() {
  if (started) return;
  started = true;
  $("hint").style.display = "none";
  try { await audio.play(); } catch (e) { /* reloj de pared */ }
}
addEventListener("pointerdown", begin, { once: true });

/* ---- outro por el final REAL del audio ---- */
let outroShown = false;
function maybeOutro() {
  outroShown = outroController.update(audio.currentTime, audio.duration, audio.ended).active;
}
audio.addEventListener("ended", maybeOutro);


/* ---- main ---- */
let rows = [], ptr = 0;
function frame(now) {
  const t = clock();
  maybeOutro();
  introController.update(t, introDurationSeconds, outroShown);
  if (!outroShown) {
    while (ptr < rows.length && t >= rows[ptr].t) {
      aimCamera(placeRow(rows[ptr]));
      ptr++;
    }
  }
  camY += (camTY - camY) * 0.05;
  world.style.transform = `translate3d(0, ${-camY}px, 0)`;
  drawBokeh(now);
  requestAnimationFrame(frame);
}

/* ---- fondo imagen/video con filtro del CONFIG ---- */
function setupBg() {
  if (!C.bg || C.bg.type === "none" || !C.bg.src) return;
  let el = $("bgMedia");
  if (C.bg.type === "video") {
    const v = doc.createElement("video");
    v.id = "bgMedia"; v.muted = true; v.loop = true; v.autoplay = true;
    v.setAttribute("playsinline", "");
    el.replaceWith(v); el = v;
    v.play && v.play().catch(() => {});
  }
  el.src = encodeURI(C.bg.src);
  el.style.display = "block";
  el.style.filter = C.bg.filter || "";
}

setupBg();
audio.src = encodeURI(C.audio.src);
loadLyrics().then(r => {
  rows = r;
  if (r.length && Number.isFinite(r[0].t)) introDurationSeconds = Math.max(0, r[0].t);
});
begin();
seedBokeh();
doc.body.classList.add("ready");
requestAnimationFrame(frame);
