
/* ================================ CONFIG ================================
   EXPEDIENTE: la letra es un muro de detective true-crime. Cada palabra se
   clava al muro como evidencia — recorte mecanografiado, titular de
   periódico con cinta, anotación a marcador rojo o sello CONFIDENCIAL
   estampado con golpe y flash de cámara. Un hilo rojo con comba conecta
   cada pieza con la anterior. La cámara pasea por el muro con zoom, ángulo
   holandés y paneos-látigo impredecibles; la evidencia vieja amarillea
   pero queda clavada: al final, el muro entero es la canción.
   La letra se consume 100% de lyricsUrl (formato Whisper:
   { metadata, segments: [ { words: [ { word, start, end }, ... ] } ] } ).
   Si el fetch falla (p.ej. abierto por file:// sin servidor), la pieza
   arranca igual con solo la intro — revisa la consola para el aviso.
   El CONFIG ya no vive aquí: vive en config.json como colección de casos con
   "id" (mismo patrón que el resto de plantillas de letras). Cada objeto
   trae audio, lyricsUrl, bg, intro/outro, board y seed.

   Carga con 3 niveles de fallback (no afecta al pipeline, que siempre sirve
   un config.json real por HTTP y gana en el nivel 1):
     1. fetch("config.json")         — lo que el pipeline genera y sirve.
     2. fetch("assets/config.json")  — default versionado, si serviste esta
        carpeta con un server (python3 -m http.server) sin que el pipeline
        haya escrito un config.json en la raíz.
     3. DEFAULT_CONFIG embebido      — para abrir el archivo con doble clic
        (file://), donde fetch() queda bloqueado por el navegador. */
const DEFAULT_CONFIG = { "activeId": "default", "configs": [{
  "id": "default",
  "description": "Muro de detective true-crime con hilo rojo — la letra se clava como evidencia (recortes mecanografiados, titulares, anotaciones a marcador y sellos CONFIDENCIAL) mientras la cámara patrulla el muro con zoom y ángulo holandés. — metadata para marketing/SEO, la plantilla no la usa todavía.",
  "audio": { "src": "assets/song.mp3" },
  "lyricsUrl": "assets/lyrics.json",
  "bg": {},
  "intro": { "artist": "Yasuha · Expediente Nº 084", "title": "Flyday\nChinatown", "sub": "", "feats": "Material clasificado · NODEMOTION" },
  "outro": { "leadSec": 8, "songTitle": "Flyday Chinatown", "title": "Gracias", "sub": "Por ver", "feats": "Suscríbete · NODEMOTION" },
  "debug": { "enabled": false },
  "board": {
    "clusterGapVw": 58, "clusterGapVh": 76,
    "rowsMin": 2, "rowsMax": 5,
    "stampSoloChance": 0.55,
    "soloChance": 0.12,
    "markerChance": 0.16,
    "headlineChance": 0.36,
    "zoomWide": [0.74, 0.90],
    "zoomClose": [1.12, 1.34],
    "dutchMax": 3.2,
    "whipChance": 0.14,
    "flashChance": 0.5,
    "dirWeights": { "left": 0.3, "right": 0.3, "up": 0.2, "down": 0.2 }
  },
  "seed": 11
}] };

async function loadDB() {
  for (const url of ["config.json", "assets/config.json"]) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.json();
    } catch (e) { /* file:// u otro bloqueo — probamos el siguiente nivel */ }
  }
  console.warn("[hilo-rojo] No se pudo cargar config.json ni assets/config.json (¿abierto por file://?) — usando DEFAULT_CONFIG embebido.");
  return DEFAULT_CONFIG;
}

const DB = await loadDB();
const CONFIG = DB.configs.find(c => c.id === DB.activeId) || DB.configs[0];
/* ======================================================================== */

const doc = document, $ = id => doc.getElementById(id);
const C = CONFIG, world = $("world"), threadsSvg = $("threads"), audio = $("audio");
let introDurationSeconds = window.NexaHiloRojoIntro.DEFAULT_DURATION_SECONDS;
const introController = window.NexaHiloRojoIntro.createDOMIntro({
  root: $("intro"),
  config: C.intro || {},
});
let vw = innerWidth, vh = innerHeight;
addEventListener("resize", () => { vw = innerWidth; vh = innerHeight; sizeDust(); });

function mulberry32(a) { return function() {
  a |= 0; a = a + 0x6D2B79F5 | 0;
  let t = Math.imul(a ^ a >>> 15, 1 | a);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rng = mulberry32(C.seed);

/* ---- salida con el componente propio de esta plantilla ---- */
const outroController = window.NexaHiloRojoOutro.createDOMOutro({
  root: $("outro"),
  config: C.outro || {},
  onShow: () => {
    doc.body.classList.add("outroActive");
    doc.body.classList.remove("introActive");
    $("intro").classList.add("gone");
    for (const p of placed) p.el.classList.add("cold");
  },
});

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
    console.warn("[hilo-rojo] No se pudo cargar", C.lyricsUrl,
                 "— sirve el HTML por HTTP (Live Server), no por file://.", e);
    return [];
  }
}

/* ---- grupos de evidencia: saltan por el muro en direcciones impredecibles ---- */
let baseX = 0, baseY = 0, rowY = 0, rowIdx = 0, rowsThisCluster = 0;
let camX = 0, camY = 0, camXT = 0, camYT = 0;
let camS = 0.84, camST = 0.84, camRot = 0, camRotT = 0;
let shake = 0, whipUntil = 0;
const nextRows = () => C.board.rowsMin + Math.floor(rng() * (C.board.rowsMax - C.board.rowsMin + 1));
rowsThisCluster = nextRows();

function newCluster(solo) {
  const B = C.board, w = B.dirWeights, keys = ["left", "right", "up", "down"];
  let r = rng() * keys.reduce((s, k) => s + w[k], 0), dir = "left";
  for (const k of keys) { if ((r -= w[k]) < 0) { dir = k; break; } }
  const gx = vw * (B.clusterGapVw / 100) * (0.8 + rng() * 0.45);
  const gy = vh * (B.clusterGapVh / 100) * (0.85 + rng() * 0.4);
  if (dir === "left")       { baseX -= gx; baseY += (rng() - 0.5) * vh * 0.5; }
  else if (dir === "right") { baseX += gx; baseY += (rng() - 0.5) * vh * 0.5; }
  else if (dir === "up")    { baseY -= gy; baseX += (rng() - 0.5) * vw * 0.4; }
  else                      { baseY += gy; baseX += (rng() - 0.5) * vw * 0.4; }
  rowY = baseY; rowIdx = 0; rowsThisCluster = nextRows();
  /* cada grupo trae su propio encuadre: zoom + ángulo holandés + quizá látigo */
  const zr = solo ? B.zoomClose : B.zoomWide;
  camST = (zr[0] + rng() * (zr[1] - zr[0])) * (vw < vh ? 1.1 : 1);
  camRotT = (rng() - 0.5) * 2 * B.dutchMax;
  if (rng() < B.whipChance) whipUntil = performance.now() + 650;
}

function fontSizeFor(text, solo) {
  const len = Math.max(2, text.length);
  const wShare = vw < vh ? 0.52 : 0.30;
  let fs = Math.min(vw * wShare / (len * 0.55), solo ? vh * 0.20 : vh * 0.105);
  fs *= 0.85 + rng() * 0.3;
  if (solo) fs *= 1.3;
  return Math.max(vh * 0.042, Math.min(fs, solo ? vh * 0.26 : vh * 0.12));
}

/* bordes rasgados irregulares para los recortes mecanografiados */
function tornPoly() {
  const pts = [], seg = 5;
  for (let i = 0; i <= seg; i++) pts.push(`${(i / seg * 100).toFixed(1)}% ${(rng() * 7).toFixed(1)}%`);
  for (let i = seg; i >= 0; i--) pts.push(`${(i / seg * 100).toFixed(1)}% ${(100 - rng() * 7).toFixed(1)}%`);
  return `polygon(${pts.join(",")})`;
}

/* hilo rojo con comba entre la evidencia anterior y la nueva */
let lastAnchor = null, threadCount = 0;
function makeThread(a, b) {
  const p = doc.createElementNS("http://www.w3.org/2000/svg", "path");
  const midX = (a.x + b.x) / 2 + (rng() - 0.5) * 40;
  const sag = Math.hypot(b.x - a.x, b.y - a.y) * 0.10 + 18 + rng() * 26;
  const midY = Math.max(a.y, b.y) + sag;
  p.setAttribute("d", `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} Q ${midX.toFixed(1)} ${midY.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`);
  threadsSvg.appendChild(p);
  const L = p.getTotalLength();
  p.style.strokeDasharray = L; p.style.strokeDashoffset = L;
  requestAnimationFrame(() => requestAnimationFrame(() => { p.style.strokeDashoffset = 0; }));
  threadCount++;
  if (threadCount > 130 && threadsSvg.firstChild) { threadsSvg.firstChild.remove(); threadCount--; }
  return p;
}

/* factores de ancho aproximado por tipografía (para chinche, hilo y encuadre) */
const widthFactor = { torn: 0.62, head: 0.52, marker: 0.44, stamp: 0.60 };

let placed = [];
function placeWord(w) {
  const B = C.board;
  const clean = w.text.replace(/[.,;!?¡¿"']/g, "");
  if (!clean) return false;

  const solo = clean.length >= 6 ? rng() < B.stampSoloChance : rng() < B.soloChance;
  let type = "torn";
  if (solo) type = "stamp";
  else if (rng() < B.markerChance) type = "marker";
  else if (rng() < B.headlineChance) type = "head";
  if (solo && rowIdx > 0) newCluster(true);

  const el = doc.createElement("div");
  el.className = "clip " + type;
  el.textContent = clean;
  const fs = fontSizeFor(clean, solo);
  el.style.fontSize = fs + "px";
  const maxRot = { torn: 6, head: 4, marker: 8, stamp: 11 }[type];
  el.style.setProperty("--rot", ((rng() - 0.5) * 2 * maxRot).toFixed(2) + "deg");
  if (type === "torn") el.style.clipPath = tornPoly();
  if (type === "head" && rng() < 0.35) el.classList.add("mark");
  if (type === "stamp") el.style.opacity = "";   /* opacidad la maneja .on/.cold */

  const wpx = clean.length * fs * widthFactor[type] + fs * (type === "marker" ? 0.2 : 0.9);
  const hpx = fs * 1.35 + (type === "marker" ? 0 : fs * 0.4);
  const x = baseX + (rng() - 0.5) * vw * 0.10 - wpx / 2;
  const y = rowY;
  el.style.left = x + "px";
  el.style.top = y + "px";
  world.appendChild(el);
  requestAnimationFrame(() => el.classList.add("on"));

  /* chinche solo para papel (recortes y titulares) */
  let pin = null;
  if (type === "torn" || type === "head") {
    pin = doc.createElement("div");
    pin.className = "pin";
    pin.style.left = (x + wpx / 2 - 6 + (rng() - 0.5) * 10) + "px";
    pin.style.top = (y - 5) + "px";
    world.appendChild(pin);
    requestAnimationFrame(() => pin.classList.add("on"));
  }

  /* hilo rojo hacia la evidencia anterior */
  const anchor = { x: x + wpx / 2, y: y + 2 };
  const thread = lastAnchor ? makeThread(lastAnchor, anchor) : null;
  lastAnchor = anchor;

  /* impacto: sacudida de cámara; sello solo → golpe fuerte + quizá flash */
  shake = solo ? 9 : 4;
  if (solo && rng() < B.flashChance) {
    const fl = $("flash");
    fl.style.transition = "none"; fl.style.opacity = 0.26;
    requestAnimationFrame(() => { fl.style.transition = "opacity 0.5s ease-out"; fl.style.opacity = 0; });
  }

  rowY += hpx + vh * 0.02;
  placed.push({ el, pin, thread });
  for (let i = 0; i < placed.length - 1; i++) placed[i].el.classList.add("cold");
  /* el muro acumula: solo se retira el papel muy viejo (chinches e hilos quedan) */
  if (placed.length > 34) placed.shift().el.remove();

  rowIdx++;
  if (solo || rowIdx >= rowsThisCluster) newCluster(false);

  /* encuadre: la cámara apunta a la evidencia recién clavada */
  camXT = x + wpx / 2 + (vw < vh ? 0 : (rng() - 0.5) * vw * 0.06);
  camYT = y + hpx / 2 - vh * 0.03;
  return true;
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

/* ---- outro: se dispara por el FINAL REAL del audio, no por la letra ---- */
let outroShown = false;
function maybeOutro() {
  outroShown = outroController.update(audio.currentTime, audio.duration, audio.ended).active;
}
audio.addEventListener("ended", maybeOutro);

/* ---- polvo en suspensión bajo la lámpara (canvas) ---- */
const dust = $("dust"), dctx = dust.getContext("2d");
let motes = [];
function sizeDust() {
  dust.width = vw; dust.height = vh;
  motes = Array.from({ length: 42 }, () => ({
    x: rng() * vw, y: rng() * vh,
    r: 0.6 + rng() * 1.6, s: 0.08 + rng() * 0.25,
    a: 0.05 + rng() * 0.16, ph: rng() * 6.28
  }));
}
function drawDust(now) {
  dctx.clearRect(0, 0, vw, vh);
  for (const m of motes) {
    m.y -= m.s; m.x += Math.sin(now * 0.0004 + m.ph) * 0.18;
    if (m.y < -3) { m.y = vh + 3; m.x = rng() * vw; }
    const al = m.a * (0.6 + 0.4 * Math.sin(now * 0.001 + m.ph));
    dctx.fillStyle = `rgba(255,236,190,${al.toFixed(3)})`;
    dctx.beginPath(); dctx.arc(m.x, m.y, m.r, 0, 6.283); dctx.fill();
  }
}

/* ---- main ---- */
let words = [], ptr = 0;
function frame(now) {
  const t = clock();
  maybeOutro();
  introController.update(t, introDurationSeconds, outroShown);
  if (!outroShown) {
    while (ptr < words.length && t >= words[ptr].t) {
      placeWord(words[ptr]);
      ptr++;
    }
  }
  /* paneo normal es lento y pesado; el látigo (whip) acelera el arrastre */
  const ease = now < whipUntil ? 0.16 : 0.06;
  camX += (camXT - camX) * ease;
  camY += (camYT - camY) * ease;
  camS += (camST - camS) * 0.055;
  camRot += (camRotT - camRot) * 0.05;
  shake *= 0.86;
  const shx = (Math.random() - 0.5) * shake, shy = (Math.random() - 0.5) * shake;
  world.style.transform =
    `translate(${vw / 2 + shx}px, ${vh / 2 + shy}px) rotate(${camRot}deg) ` +
    `scale(${camS}) translate(${-camX}px, ${-camY}px)`;
  drawDust(now);
  requestAnimationFrame(frame);
}

if (C.bg.src) { const b = $("bg"); b.src = C.bg.src; b.style.display = "block"; b.style.opacity = 0.5; }
sizeDust();
audio.src = encodeURI(C.audio.src);
loadLyrics().then(w => {
  words = w;
  if (w.length && Number.isFinite(w[0].t)) introDurationSeconds = Math.max(0, w[0].t);
});
begin();
requestAnimationFrame(frame);
