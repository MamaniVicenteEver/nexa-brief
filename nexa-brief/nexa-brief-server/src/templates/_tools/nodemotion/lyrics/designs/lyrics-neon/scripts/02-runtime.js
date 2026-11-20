
/* ================================ CONFIG ================================ */
/* La letra YA NO vive aquí: se consume 100% de lyricsUrl (formato Whisper:
   { metadata, segments: [ { words: [ { word, start, end }, ... ] }, ... ] } ).
   El CONFIG tampoco: vive en config.json como colección de casos con "id"
   (mismo patrón que 04-video-motion). Cada objeto trae audio, lyricsUrl, bg,
   fonts, neon (paleta), intro/outro, layout y seed. Para otra canción,
   agregá otro objeto al array "configs" — acá no se toca nada.
   Servir por HTTP (python3 -m http.server): por file:// el fetch se bloquea. */
const ACTIVE_ID = null;   /* <-- forzar un id ("hola-remix" | "hola-remix-cian" | ...) · null = usa "activeId" del JSON */

const DEFAULT_CONFIG = {"activeId":"default","configs":[{"id":"default","description":"Neón urbano nocturno — letras tubo que se encienden letra por letra, columnas escalonadas que retroceden en direcciones impredecibles sobre una foto de vida nocturna con CRT/grain/vignette. — metadata para marketing/SEO, la plantilla no la usa todavía.","audio":{"src":"assets/song.mp3"},"lyricsUrl":"assets/lyrics.json","bg":{"src":"assets/bg.png","filter":"grayscale(0.3) sepia(0.4) hue-rotate(-18deg) saturate(1.5) brightness(0.32) contrast(1.18)"},"fonts":{"googleUrl":"https://fonts.googleapis.com/css2?family=Monoton&family=Archivo+Black&display=swap","tube":"\"Monoton\", cursive","block":"\"Archivo Black\", sans-serif"},"neon":{"core":"#FFE9CF","glow":"#FF5A1F","deep":"#E01400"},"intro":{"artist":"","title":"HOLA REMIX","sub":"","feats":"","eyebrow":"nodemotion presenta"},"outro":{"leadSec":8,"songTitle":"HOLA REMIX","thanks":"GRACIAS POR VER","channel":"nodemotion","cta":"SUSCRÍBETE","support":"Tu apoyo hace posible que sigamos trayendo más contenido.","handle":"youtube.com/@nodemotion"},"debug":{"enabled":false},"layout":{"stairVw":3.4,"colGapVw":52,"colGapVh":88,"rowsMin":2,"rowsMax":4,"verticalChance":0.13,"soloChance":0.14,"tubeChance": 0.3,"dirWeights":{"left":0.55,"down":0.25,"up":0.2}},"seed":11}]};

async function loadDB() {
  try {
    const r = await fetch("config.json");
    if (r.ok) return await r.json();
  } catch (e) {}
  try {
    const r = await fetch("assets/config.json");
    if (r.ok) return await r.json();
  } catch (e) {}
  console.warn("config.json no disponible (fetch bloqueado o ausente) — usando DEFAULT_CONFIG embebido");
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
  if (C.fonts?.tube)  root.style.setProperty("--fontTube", C.fonts.tube);
  if (C.fonts?.block) root.style.setProperty("--fontBlock", C.fonts.block);
  if (C.neon?.core)   root.style.setProperty("--neonCore", C.neon.core);
})(CONFIG);
/* ======================================================================== */

const doc = document, $ = id => doc.getElementById(id);
const C = CONFIG, world = $("world"), audio = $("audio"), bgImage = $("bg"), bgVideo = $("bgVideo");
let vw = innerWidth, vh = innerHeight;
addEventListener("resize", () => { vw = innerWidth; vh = innerHeight; });

function mulberry32(a) { return function() {
  a |= 0; a = a + 0x6D2B79F5 | 0;
  let t = Math.imul(a ^ a >>> 15, 1 | a);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rng = mulberry32(C.seed);

/* ---- neon ---- */
const N = C.neon;
const tubeGlow = s => `0 0 ${s*0.15}px ${N.core}, 0 0 ${s*0.35}px ${N.glow}, 0 0 ${s*0.9}px ${N.glow}, 0 0 ${s*1.8}px ${N.deep}, 0 0 ${s*3}px ${N.deep}`;
function styleNeon(el, fs, outline) {
  if (outline) {
    el.style.webkitTextStroke = Math.max(1.5, fs * 0.045) + "px " + N.core;
    el.style.filter = `drop-shadow(0 0 ${Math.max(2, fs*0.05)}px ${N.core}) ` +
                      `drop-shadow(0 0 ${fs*0.16}px ${N.glow}) ` +
                      `drop-shadow(0 0 ${fs*0.4}px ${N.deep})`;
  } else {
    el.style.color = N.core;
    el.style.textShadow = tubeGlow(Math.max(12, fs * 0.2));
  }
}

/* ---- intro (gancho) y salida: textos del config; todo el movimiento sale de t ---- */
const outro = $("outro");
const O = C.outro || {};
doc.documentElement.style.setProperty("--neonGlow", N.glow);
doc.documentElement.style.setProperty("--neonDeep", N.deep);
const qo = s => outro.querySelector(s);
let introDurationSeconds = window.NexaNeonIntro.DEFAULT_DURATION_SECONDS;
const introController = window.NexaNeonIntro.createDOMIntro({
  document: doc,
  config: C.intro || {},
  neon: N,
  background: {
    image: bgImage,
    video: bgVideo,
    tint: $("bgTint"),
    baseFilter: C.bg?.filter || "grayscale(0.3) sepia(0.4) hue-rotate(-18deg) saturate(1.5) brightness(0.32) contrast(1.18)",
  },
});
const smooth = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
const rise = (t, at, sec) => smooth((t - at) / sec);
/* ruido determinista: el mismo t da siempre el mismo parpadeo (render cuadro a cuadro) */
const hsh = (a, b) => { let h = Math.imul((a * 73856093) ^ (b * 19349663), 2654435761) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; };
/* tubo que se enciende: parpadea ~0,5 s y queda prendido con un zumbido muy leve */
function lit(t, t0, seed, dur = .5) {
  if (t < t0) return 0;
  const d = t - t0;
  if (d < dur) return hsh(seed, Math.floor(d * 30)) < .25 + .7 * (d / dur) ? 1 : .12;
  return hsh(seed, Math.floor(t * 24)) < .012 ? .45 : 1;
}
/* corte de luz al salir: parpadea y se apaga */
function unlit(t, t1, seed, dur = .4) {
  if (t < t1) return 1;
  const d = t - t1;
  return d >= dur ? 0 : (hsh(seed + 977, Math.floor(d * 30)) < 1 - d / dur ? 1 : .08);
}
const spans = (el, lines) => {
  el.textContent = "";
  return lines.flatMap(line => {
    const ln = doc.createElement("span"); ln.className = "ln"; el.appendChild(ln);
    return [...line].map(c => { const s = doc.createElement("span"); s.className = "ch"; s.textContent = c; ln.appendChild(s); return s; });
  });
};
/* el título largo se parte en dos renglones parejos (más grande y legible como miniatura) */
const setText = (el, v) => { el.textContent = v || ""; el.style.display = v ? "" : "none"; return el; };

const outroController = window.NexaNeonOutro.createDOMOutro({
  root: outro,
  config: O,
  onShow: () => {
    doc.body.classList.add("outroActive");
    doc.body.classList.remove("introActive");
  },
});

let outroShown = false;
function updateCards(t) {
  const dur = audio.duration;
  /* Cuando termina, el navegador puede reiniciar currentTime; conservar el cierre. */
  if (audio.ended && isFinite(dur)) t = dur;
  outroShown = outroController.update(t, dur, audio.ended).active;
  doc.body.classList.toggle("outroActive", outroShown);
  const introState = introController.update(t, outroShown, introDurationSeconds);
  world.style.opacity = introState.active ? "0" : "1";
}

/* ---- lyrics: 100% desde lyricsUrl (JSON de Whisper) ---- */
async function loadLyrics() {
  try {
    const r = await fetch(C.lyricsUrl);
    if (!r.ok) throw new Error("HTTP " + r.status);
    const j = await r.json();
    const out = [];
    for (const seg of j.segments) for (const w of seg.words)
      out.push({ t: w.start, text: w.word.trim() });
    if (!out.length) throw new Error("lyrics.json sin palabras");
    return out;
  } catch (e) {
    console.warn("[neon-letras-V3] No se pudo cargar", C.lyricsUrl,
                 "— sirve el HTML por HTTP (Live Server), no por file://.", e);
    return [];
  }
}

/* ---- mundo: columnas que nacen en direcciones impredecibles ---- */
let baseX = 0, baseY = 0, rowY = 0, rowIdx = 0, rowsThisCol = 0, placed = [];
const nextRowsPerCol = () => C.layout.rowsMin + Math.floor(rng() * (C.layout.rowsMax - C.layout.rowsMin + 1));
rowsThisCol = nextRowsPerCol();

function pickDir() {
  const w = C.layout.dirWeights, r = rng() * (w.left + w.down + w.up);
  if (r < w.left) return "left";
  if (r < w.left + w.down) return "down";
  return "up";
}
function newColumn() {
  const dir = pickDir(), L = C.layout;
  if (dir === "left") {
    baseX -= vw * (L.colGapVw / 100) * (0.85 + rng() * 0.4);
    baseY += (rng() - 0.5) * vh * 0.22;
  } else if (dir === "down") {          /* la cámara baja → las viejas salen ARRIBA */
    baseY += vh * (L.colGapVh / 100) * (0.9 + rng() * 0.35);
    baseX += (rng() - 0.5) * vw * 0.30;
  } else {                              /* la cámara sube → las viejas salen ABAJO */
    baseY -= vh * (L.colGapVh / 100) * (0.9 + rng() * 0.35);
    baseX += (rng() - 0.5) * vw * 0.30;
  }
  rowY = baseY;
  rowIdx = 0;
  rowsThisCol = nextRowsPerCol();
}

function fontSizeFor(text, solo) {
  const len = Math.max(2, text.length);
  /* móvil vertical: la palabra ocupa más ancho de pantalla (desktop no cambia) */
  const wShare = vw < vh ? 0.48 : 0.30;
  let fs = Math.min(vw * wShare / (len * 0.52), solo ? vh * 0.26 : vh * 0.125);
  fs *= 0.88 + rng() * 0.28;
  if (solo) fs *= 1.35;
  return Math.max(vh * 0.05, Math.min(fs, solo ? vh * 0.30 : vh * 0.14));
}

function placeWord(w) {
  const L = C.layout;
  const clean = w.text.replace(/[.,;!?¡¿"']/g, "");
  if (!clean) return null;
  const solo = clean.length >= 6 ? rng() < 0.55 : rng() < L.soloChance;
  const vertical = !solo && rng() < L.verticalChance && clean.length <= 6;
  if (solo && rowIdx > 0) newColumn();

  const el = doc.createElement("div");
  const outline = rng() > L.tubeChance;
  el.className = "w " + (outline ? "line" : "tube") + (vertical ? " vert" : "");
  el.textContent = clean;
  const fs = fontSizeFor(clean, solo);
  el.style.fontSize = fs + "px";
  styleNeon(el, fs, outline);

  const stair = rowIdx * vw * (L.stairVw / 100) + (rng() - 0.5) * vw * 0.015;
  const x = baseX + stair;
  const y = rowY;
  el.style.left = x + "px";
  el.style.top = y + "px";
  world.appendChild(el);
  requestAnimationFrame(() => el.classList.add("on"));

  const width = vertical ? fs * 1.1 : clean.length * fs * (outline ? 0.62 : 0.72);
  const height = vertical ? clean.length * fs * 0.8 : fs;
  rowY += height * 1.12 + vh * 0.02;    /* la grada avanza según la altura real */

  placed.push(el);
  for (let i = 0; i < placed.length - 1; i++) placed[i].classList.add("cold");
  if (placed.length > 26) { const old = placed.shift(); old.remove(); }

  rowIdx++;
  if (solo || rowIdx >= rowsThisCol) newColumn();
  return { x, y, w: width, h: height };
}

/* ---- cámara ---- */
let camX = 0, camY = 0, camTX = 0, camTY = 0;
function aimCamera(r) {
  if (!r) return;
  /* móvil vertical: centrar al medio sin jitter para que nada se corte a los lados */
  const cx = vw < vh ? 0.5 : (0.42 + rng() * 0.1);
  camTX = r.x + r.w / 2 - vw * cx;
  camTY = r.y + r.h / 2 - vh * (0.40 + rng() * 0.12);
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

/* ---- main ---- */
let words = [], ptr = 0;
function frame(now) {
  const t = clock();
  updateCards(t);                         /* chequear ANTES de poner más palabras */
  if (!outroShown) {                     /* una vez que cierra, no entran palabras nuevas */
    while (ptr < words.length && t >= words[ptr].t) {
      aimCamera(placeWord(words[ptr]));
      ptr++;
    }
  }
  camX += (camTX - camX) * 0.055;
  camY += (camTY - camY) * 0.055;
  const sway = Math.sin(now * 0.00035) * 1.2;
  $("worldTilt").style.transform = `rotateY(${sway}deg)`;
  world.style.transform = `translate3d(${-camX}px, ${-camY}px, 0)`;
  requestAnimationFrame(frame);
}

const backgroundSrc = C.bg?.src || "";
const backgroundIsVideo = C.bg?.type === "video"
  || /\.(mp4|webm|mov|m4v|ogg)(?:[?#].*)?$/i.test(backgroundSrc);

if (backgroundIsVideo) {
  bgImage.hidden = true;
  bgVideo.hidden = false;
  bgVideo.src = encodeURI(backgroundSrc);
  bgVideo.load();
  bgVideo.play().catch(() => {});
} else {
  bgVideo.pause();
  bgVideo.removeAttribute("src");
  bgVideo.load();
  bgVideo.hidden = true;
  bgImage.hidden = false;
  bgImage.src = encodeURI(backgroundSrc);
}
if (C.bg?.filter) {
  bgImage.style.filter = C.bg.filter;
  bgVideo.style.filter = C.bg.filter;
}
audio.src = encodeURI(C.audio.src);
loadLyrics().then(w => {
  words = w;
  const firstLyricTime = w.reduce(
    (first, word) => Number.isFinite(word.t) ? Math.min(first, word.t) : first,
    Infinity
  );
  if (Number.isFinite(firstLyricTime)) {
    introDurationSeconds = Math.max(0, firstLyricTime);
  }
});
begin();
requestAnimationFrame(frame);
