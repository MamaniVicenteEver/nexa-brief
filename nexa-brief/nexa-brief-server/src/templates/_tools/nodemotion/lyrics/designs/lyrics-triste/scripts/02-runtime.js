
/* ================================ CONFIG ================================
   PLANTILLA TRISTE — "lluvia en la ventana"
   Mecánica: paleta fría azul-acero; las líneas CAEN desde arriba (gravedad
   con leve rebote) y, al envejecer, SE HUNDEN hacia abajo mientras se
   difuminan — todo empuja hacia abajo, como la lluvia. Lluvia real en
   canvas (trazos finos + gotas). Alterna condensada dura (Oswald) con
   máquina de escribir (Special Elite); algunas líneas typewriter parpadean
   como lámpara moribunda. Cámara con deriva descendente lenta.
   El CONFIG ya no vive aquí: vive en config.json como colección de casos con
   "id" (mismo patrón que 04-video-motion). Cada objeto trae audio, lyricsUrl,
   bg, intro/outro, layout, rain y seed. Para otra canción del mismo género,
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
const ACTIVE_ID = null;   /* <-- forzar un id ("dueles-tan-bien" | ...) · null = usa "activeId" del JSON */

const DEFAULT_CONFIG = { "activeId": "default", "configs": [{
  "id": "default",
  "description": "Balada triste bajo la lluvia — paleta fría azul-acero, líneas que caen con gravedad y se hunden al envejecer, alternando condensada dura con máquina de escribir que parpadea como lámpara moribunda. — metadata para marketing/SEO, la plantilla no la usa todavía.",
  "audio": { "src": "assets/song.mp3" },
  "lyricsUrl": "assets/lyrics.json",
  "bg": { "type": "image", "src": "assets/bg.jpg",
          "filter": "grayscale(0.75) brightness(0.26) contrast(1.12) hue-rotate(178deg) saturate(1.35)" },
  "intro": { "artist": "", "title": "Bajo la\nLluvia", "sub": "", "feats": "" },
  "outro": { "leadSec": 8, "title": "Gracias", "sub": "por ver", "feats": "Suscríbete · NEXA BRIEF" },
  "debug": { "enabled": false },
  "layout": { "groupGapSec": 0.32, "maxRowChars": 16, "rowGapVh": 3.4, "anchorVhFrac": 0.52,
              "typeChanceSolo": 0.6, "typeChanceMulti": 0.2, "dyingChance": 0.3,
              "sideAlignChance": 0.3, "maxTiltDeg": 1.8, "oldAfter": 3 },
  "rain": { "streaks": 70, "tint": "150,180,210" },
  "seed": 11
}] };

async function loadDB() {
  for (const url of ["config.json", "assets/config.json"]) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.json();
    } catch (e) { /* file:// u otro bloqueo — probamos el siguiente nivel */ }
  }
  console.warn("[triste] No se pudo cargar config.json ni assets/config.json (¿abierto por file://?) — usando DEFAULT_CONFIG embebido.");
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
  i.querySelector(".artist").textContent = cfg.artist ?? "";
  i.querySelector(".title").textContent = cfg.title;
  i.querySelector(".sub").textContent = cfg.sub;
  i.querySelector(".feats").textContent = cfg.feats;
}
buildCard("intro", C.intro);
buildCard("outro", C.outro);

/* ---- lyrics desde whisper JSON, agrupadas ---- */
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
    console.warn("[triste] No se pudo cargar", C.lyricsUrl,
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

/* ---- colocación: caída con gravedad ---- */
let rowY = 0, placed = [];

function fontSizeFor(text, words, type) {
  const len = Math.max(2, text.length);
  const base = words <= 1 ? vh * (type ? 0.095 : 0.125) : vh * 0.07;
  /* móvil vertical: aprovecha más ancho (desktop no cambia) */
  const wShare = vw < vh ? 0.94 : 0.84;
  let fs = Math.min(vw * wShare / (len * 0.56), base);
  fs *= 0.9 + rng() * 0.2;
  return Math.max(vh * 0.042, fs);
}

function placeRow(r) {
  const L = C.layout;
  const typeChance = r.words <= 1 ? L.typeChanceSolo : L.typeChanceMulti;
  const type = rng() < typeChance;

  const el = doc.createElement("div");
  let cls = "row " + (type ? "type" : "cond");
  if (type && rng() < L.dyingChance) cls += " dying";
  if (rng() < L.sideAlignChance) cls += rng() < 0.5 ? " alignL" : " alignR";
  el.className = cls;
  el.style.setProperty("--rot", ((rng() - 0.5) * 2 * L.maxTiltDeg).toFixed(2) + "deg");
  el.textContent = type ? r.text.toLowerCase() : r.text;
  const fs = fontSizeFor(r.text, r.words, type);
  el.style.fontSize = fs + "px";
  el.style.top = rowY + "px";
  world.appendChild(el);
  requestAnimationFrame(() => el.classList.add("in"));

  const height = fs * 1.18;
  const y = rowY;
  rowY += height + vh * (L.rowGapVh / 100);

  placed.push(el);
  const cutoff = placed.length - L.oldAfter;
  for (let i = 0; i < placed.length; i++) if (i < cutoff) placed[i].classList.add("old");
  if (placed.length > 16) { const old = placed.shift(); old.remove(); }

  return { y, h: height };
}

/* ---- cámara vertical (deriva descendente constante muy leve) ---- */
let camY = 0, camTY = 0;
function aimCamera(r) { if (r) camTY = r.y + r.h / 2 - vh * C.layout.anchorVhFrac; }

/* ---- lluvia en canvas ---- */
const rain = $("rain"), rctx = rain.getContext("2d");
let drops = [];
function seedRain() {
  drops = Array.from({ length: C.rain.streaks }, () => ({
    x: rng() * vw, y: rng() * vh,
    len: 8 + rng() * 22, v: 2.4 + rng() * 4.2,
    a: 0.05 + rng() * 0.12, drift: 0.3 + rng() * 0.5
  }));
}
function drawRain() {
  rain.width = vw; rain.height = vh;
  rctx.clearRect(0, 0, vw, vh);
  rctx.lineWidth = 1;
  for (const d of drops) {
    d.y += d.v; d.x -= d.drift;
    if (d.y > vh + 30) { d.y = -30; d.x = rng() * (vw + 80); }
    rctx.strokeStyle = `rgba(${C.rain.tint},${d.a})`;
    rctx.beginPath();
    rctx.moveTo(d.x, d.y);
    rctx.lineTo(d.x - d.drift * 3, d.y - d.len);
    rctx.stroke();
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

/* ---- outro por el final REAL del audio ---- */
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
  camY += (camTY - camY) * 0.055;
  world.style.transform = `translate3d(0, ${-camY}px, 0)`;
  drawRain();
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
  // El material elegido por la persona controla su propia visibilidad; la
  // demo sin opacity conserva los filtros y tintes originales de la plantilla.
  const customOpacity = C.bg.opacity;
  if (typeof customOpacity === "number" && Number.isFinite(customOpacity)) {
    const value = Math.max(0, Math.min(1, customOpacity));
    el.style.setProperty("--custom-bg-opacity", String(value));
    el.style.filter = "none";
    for (const id of ["darkTint", "warmTint", "coldTint"]) {
      const tint = $(id);
      if (tint) tint.style.opacity = "0.25";
    }
    const vignette = $("vignette");
    if (vignette) vignette.style.opacity = "0.35";
  } else {
    el.style.filter = C.bg.filter || "";
  }
}

setupBg();
audio.src = encodeURI(C.audio.src);
loadLyrics().then(r => { rows = r; });
begin();
seedRain();
doc.body.classList.add("ready");
requestAnimationFrame(frame);
