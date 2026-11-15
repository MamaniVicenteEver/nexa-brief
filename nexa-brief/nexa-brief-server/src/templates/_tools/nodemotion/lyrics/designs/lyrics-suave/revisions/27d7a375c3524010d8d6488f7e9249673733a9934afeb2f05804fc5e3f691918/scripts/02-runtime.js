
/* ================================ CONFIG ================================
   Plantilla "suave": mismo motor de letras-de-impacto (letra 100% desde
   lyricsUrl, reloj real del audio, outro por duración real) pero con una
   mecánica MUCHO más calma:
     - una sola columna, apilado estrictamente vertical (nunca salta a los
       lados) — la cámara sigue a la línea más nueva y las viejas quedan
       arriba, difuminándose.
     - cada "línea" agrupa 1-3 palabras cortas seguidas (según qué tan rápido
       llegan en la letra) en vez de una palabra suelta por evento.
     - tipografía en 2 estilos nada más: blanco de impacto (Anton) para el
       grueso del texto, rojo tipo marcador/pincel (Permanent Marker) para
       las líneas de más peso — cuál es cuál se decide con semilla, sesgado
       hacia líneas de una sola palabra (imita el patrón de la referencia).
   El CONFIG ya no vive aquí: vive en config.json como colección de casos con
   "id" (mismo patrón que 04-video-motion). Cada objeto trae audio, lyricsUrl,
   bg, intro/outro, layout, dust y seed. Para otra canción, agregá otro
   objeto al array "configs" — acá no se toca nada.

   Carga con 3 niveles de fallback (no afecta al pipeline, que siempre sirve
   un config.json real por HTTP y gana en el nivel 1):
     1. fetch("config.json")         — lo que el pipeline genera y sirve.
     2. fetch("assets/config.json")  — default versionado, si serviste esta
        carpeta con un server (python3 -m http.server) sin que el pipeline
        haya escrito un config.json en la raíz.
     3. DEFAULT_CONFIG embebido      — para abrir el archivo con doble clic
        (file://), donde fetch() queda bloqueado por el navegador.
   ========================================================================== */
const ACTIVE_ID = null;   /* <-- forzar un id ("dueles-tan-bien" | ...) · null = usa "activeId" del JSON */

const DEFAULT_CONFIG = { "activeId": "default", "configs": [{
  "id": "default",
  "description": "Balada suave — paleta cálida tenue, letras que caen en una sola columna vertical con calma, alternando blanco de impacto (Anton) con rojo tipo marcador (Permanent Marker), polvo ambiental flotando. — metadata para marketing/SEO, la plantilla no la usa todavía.",
  "audio": { "src": "assets/song.mp3" },
  "lyricsUrl": "assets/lyrics.json",
  "bg": { "type": "image", "src": "assets/bg.jpg",
          "filter": "grayscale(0.55) brightness(0.30) contrast(1.1) sepia(0.14) hue-rotate(-32deg)" },
  "intro": { "artist": "", "title": "Letras\nSuaves", "sub": "", "feats": "" },
  "outro": { "leadSec": 8, "title": "Gracias", "sub": "Por ver", "feats": "Suscríbete · NEXA BRIEF" },
  "debug": { "enabled": false },
  "layout": { "groupGapSec": 0.30, "maxRowChars": 14, "rowGapVh": 3.2, "anchorVhFrac": 0.56,
              "impactChanceSolo": 0.55, "impactChanceMulti": 0.15, "oldAfter": 3,
              "sideAlignChance": 0.34, "airyChance": 0.30, "maxTiltDeg": 2.2, "camDriftVw": 3 },
  "dust": { "count": 26, "color": "rgba(210,210,215,0.35)" },
  "seed": 9
}] };

async function loadDB() {
  for (const url of ["config.json", "assets/config.json"]) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.json();
    } catch (e) { /* file:// u otro bloqueo — probamos el siguiente nivel */ }
  }
  console.warn("[letras-suaves] No se pudo cargar config.json ni assets/config.json (¿abierto por file://?) — usando DEFAULT_CONFIG embebido.");
  return DEFAULT_CONFIG;
}

const DB = await loadDB();
const CONFIG = DB.configs.find(c => c.id === ACTIVE_ID)
            || DB.configs.find(c => c.id === DB.activeId)
            || DB.configs[0];
/* ======================================================================== */

const doc = document, $ = id => doc.getElementById(id);
const C = CONFIG, world = $("world"), audio = $("audio");
let vw = innerWidth, vh = innerHeight;
addEventListener("resize", () => { vw = innerWidth; vh = innerHeight; });

function mulberry32(a) { return function() {
  a |= 0; a = a + 0x6D2B79F5 | 0;
  let t = Math.imul(a ^ a >>> 15, 1 | a);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rng = mulberry32(C.seed);

/* ---- intro / outro ---- */
function buildCard(id, cfg) {
  const i = $(id);
  const a = i.querySelector(".artist"), t = i.querySelector(".title"),
        s = i.querySelector(".sub"), f = i.querySelector(".feats");
  a.textContent = cfg.artist ?? "";
  t.textContent = cfg.title; s.textContent = cfg.sub; f.textContent = cfg.feats;
}
buildCard("intro", C.intro);
buildCard("outro", C.outro);

/* ---- lyrics: 100% desde lyricsUrl (JSON de Whisper), agrupadas en líneas ---- */
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
    console.warn("[letras-suaves] No se pudo cargar", C.lyricsUrl,
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
      cur.text += " " + clean;
      cur.lastT = w.t;
      cur.words++;
    } else {
      if (cur) rows.push(cur);
      cur = { t: w.t, text: clean, lastT: w.t, words: 1 };
    }
  }
  if (cur) rows.push(cur);
  return rows;
}

/* ---- mundo: una sola columna, siempre hacia abajo ---- */
let rowY = 0, placed = [];

function fontSizeFor(text, words) {
  const len = Math.max(2, text.length);
  const base = words <= 1 ? vh * 0.13 : vh * 0.075;
  /* móvil vertical: aprovecha más ancho (desktop no cambia) */
  const wShare = vw < vh ? 0.92 : 0.82;
  let fs = Math.min(vw * wShare / (len * 0.56), base);
  fs *= 0.92 + rng() * 0.18;
  return Math.max(vh * 0.045, fs);
}

const ENTRANCES = ["eRise", "eRise", "eBlur", "eLeft", "eRight"]; /* eRise pesa doble */
function placeRow(r) {
  const L = C.layout;
  const impactChance = r.words <= 1 ? L.impactChanceSolo : L.impactChanceMulti;
  const impact = rng() < impactChance;

  const el = doc.createElement("div");
  const entrance = ENTRANCES[Math.floor(rng() * ENTRANCES.length)];
  let cls = "row " + (impact ? "impact" : "normal") + " " + entrance;
  if (r.text.length <= 7 && rng() < L.airyChance) cls += " airy";
  if (rng() < L.sideAlignChance) cls += rng() < 0.5 ? " alignL" : " alignR";
  el.className = cls;
  el.style.setProperty("--rot", ((rng() - 0.5) * 2 * L.maxTiltDeg).toFixed(2) + "deg");
  el.textContent = r.text;
  const fs = fontSizeFor(r.text, r.words);
  el.style.fontSize = fs + "px";
  el.style.top = rowY + "px";
  world.appendChild(el);
  requestAnimationFrame(() => el.classList.add("in"));

  const height = fs * 1.15;
  const y = rowY;
  rowY += height + vh * (L.rowGapVh / 100);

  placed.push(el);
  const cutoff = placed.length - L.oldAfter;
  for (let i = 0; i < placed.length; i++) {
    if (i < cutoff) placed[i].classList.add("old");
  }
  if (placed.length > 18) { const old = placed.shift(); old.remove(); }

  return { y, h: height };
}

/* ---- cámara: vertical + deriva horizontal sutil por línea ---- */
let camY = 0, camTY = 0, camX = 0, camTX = 0;
function aimCamera(r) {
  if (!r) return;
  camTY = r.y + r.h / 2 - vh * C.layout.anchorVhFrac;
  camTX = (rng() - 0.5) * 2 * vw * (C.layout.camDriftVw / 100);
}

/* ---- polvo ambiental (canvas, calmo) ---- */
const dust = $("dust"), dctx = dust.getContext("2d");
let motes = [];
function mulberrySeed() { return rng(); }
function seedDust() {
  motes = Array.from({ length: C.dust.count }, () => ({
    x: rng() * vw, y: rng() * vh,
    r: 0.6 + rng() * 1.6, v: 0.05 + rng() * 0.12,
    ph: rng() * Math.PI * 2
  }));
}
function drawDust(t) {
  dust.width = vw; dust.height = vh;
  dctx.clearRect(0, 0, vw, vh);
  dctx.fillStyle = C.dust.color;
  for (const m of motes) {
    m.y -= m.v;
    m.x += Math.sin(t * 0.0003 + m.ph) * 0.15;
    if (m.y < -10) { m.y = vh + 10; m.x = rng() * vw; }
    dctx.beginPath();
    dctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
    dctx.fill();
  }
}

/* ---- reloj: audio si suena; si no, rAF ---- */
let rafT0 = null, rafNow = 0, started = false;
const clock = () => (!audio.paused && audio.currentTime > 0.05)
  ? audio.currentTime
  : (rafT0 === null ? 0 : (rafNow - rafT0) / 1000);

async function begin() {
  if (started) return;
  started = true;
  $("hint").style.display = "none";
  try { await audio.play(); } catch (e) { /* reloj de pared */ }
}
addEventListener("pointerdown", begin, { once: true });

/* ---- outro: por el final REAL del audio, no por la letra (ver README) ---- */
let outroShown = false;
function maybeOutro() {
  if (outroShown) return;
  const dur = audio.duration;
  if (!isFinite(dur) || dur <= 0) return;
  if (audio.ended || (dur - audio.currentTime) <= C.outro.leadSec) {
    outroShown = true;
    doc.body.classList.add("outroActive");
    $("intro").classList.add("gone");
    $("outro").classList.add("show");
    for (const el of placed) el.classList.add("old");
  }
}
audio.addEventListener("ended", maybeOutro);

/* ---- main ---- */
let rows = [], ptr = 0, introGone = false;
function frame(now) {
  rafNow = now;
  if (rafT0 === null) rafT0 = now;
  const t = clock();
  maybeOutro();
  if (!outroShown) {
    while (ptr < rows.length && t >= rows[ptr].t) {
      if (!introGone) { $("intro").classList.add("gone"); introGone = true; }
      aimCamera(placeRow(rows[ptr]));
      ptr++;
    }
  }
  camY += (camTY - camY) * 0.06;
  camX += (camTX - camX) * 0.04;
  world.style.transform = `translate3d(${-camX}px, ${-camY}px, 0)`;
  drawDust(now);
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

function start() {
  seedDust();
  doc.body.classList.add("ready");
  requestAnimationFrame(frame);
}
setupBg();
audio.src = encodeURI(C.audio.src);
loadLyrics().then(r => { rows = r; });
begin();
start();
