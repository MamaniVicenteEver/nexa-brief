
/* ================================ CONFIG ================================
   COLLAGE CALLEJERO: la letra vive en un mural de recortes de papel urbano
   — cada palabra es una voz tipográfica distinta (poster/stencil/marker/
   hollow) que entra desde el lado izquierdo o derecho con un golpe de papel,
   agrupada en "escenas" de 2 a 4 palabras que se recomponen alrededor de un
   punto ancla nuevo; cada escena puede traer una figura (persona recortada,
   tratada en blanco y negro) y una línea de la letra completa a máquina de
   escribir. Al llegar al cupo de la escena, todo lo actual sale volando por
   donde entró y arranca una escena nueva — igual que un corte de plano.
   `index.html` es un motor PROBADO y ESTÁTICO. NUNCA se regenera. El CONFIG
   vive en config.json como colección de casos con "id" (mismo patrón que el
   resto de plantillas de letras). La letra se consume 100% de lyricsUrl
   (formato Whisper: { metadata, segments: [ { words: [ { word, start, end
   } ] } ] } ). Sirve por HTTP (python3 -m http.server): por file:// el
   fetch queda bloqueado. */
const DEFAULT_CONFIG = { "activeId": "default", "configs": [{
  "id": "default",
  "description": "Collage urbano de recortes de papel — cada palabra estalla en el muro como un flyer callejero (titular a tijera, sello stencil, etiqueta a mano o letra hueca transparente), con figuras recortadas en blanco y negro y cortes de plano al ritmo de la canción. — metadata para marketing/SEO, la plantilla no la usa todavía.",
  "audio": { "src": "assets/song.mp3" },
  "lyricsUrl": "assets/lyrics.json",
  "bg": {},
  "fonts": {
    "googleUrl": "https://fonts.googleapis.com/css2?family=Anton&family=Bebas+Neue&family=Stardos+Stencil:wght@400;700&family=Permanent+Marker&family=Courier+Prime:wght@400;700&display=swap",
    "poster": "\"Anton\", sans-serif", "condensed": "\"Bebas Neue\", sans-serif",
    "stencil": "\"Stardos Stencil\", cursive", "marker": "\"Permanent Marker\", cursive",
    "caption": "\"Courier Prime\", monospace"
  },
  "palette": { "ink": "#17130F", "paper": "#E7DFC7", "paperWhite": "#F5EFDD", "red": "#B81F19" },
  "figures": {
    "items": [
      "assets/figures/figure-01.png", "assets/figures/figure-02.png", "assets/figures/figure-03.png",
      "assets/figures/figure-04.png", "assets/figures/figure-05.png", "assets/figures/figure-06.png",
      "assets/figures/figure-07.png", "assets/figures/figure-08.png"
    ]
  },
  "intro": { "artist": "", "title": "", "sub": "", "feats": "" },
  "outro": { "leadSec": 8, "songTitle": "", "title": "Gracias", "sub": "Por ver", "feats": "Suscribite | NodeMotion" },
  "debug": { "enabled": false },
  "layout": {
    "sceneWordsMin": 2, "sceneWordsMax": 4,
    "typeWeights": { "poster": 0.32, "stencil": 0.20, "marker": 0.16, "hollow": 0.32 },
    "colorWeights": { "ink": 0.45, "red": 0.25, "paper": 0.30 },
    "sideWeights": { "left": 0.5, "right": 0.5 },
    "figureChance": 0.5,
    "captionChance": 0.45,
    "rotMax": 7,
    "clusterSpreadVw": 16, "clusterSpreadVh": 9
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
  console.warn("[collage-callejero] No se pudo cargar config.json ni assets/config.json (¿abierto por file://?) — usando DEFAULT_CONFIG embebido.");
  return DEFAULT_CONFIG;
}

const DB = await loadDB();
const CONFIG = DB.configs.find(c => c.id === DB.activeId) || DB.configs[0];

/* tema desde el JSON → variables CSS (los defaults del CSS son idénticos al
   caso actual, así que sin config el diseño no cambia en nada) */
(function applyTheme(C) {
  const root = document.documentElement;
  if (C.fonts?.googleUrl) {
    const link = document.querySelector('link[href^="https://fonts.googleapis.com/css2"]');
    if (link && link.href !== C.fonts.googleUrl) link.href = C.fonts.googleUrl;
  }
  if (C.fonts?.poster)    root.style.setProperty("--fontPoster", C.fonts.poster);
  if (C.fonts?.condensed) root.style.setProperty("--fontCondensed", C.fonts.condensed);
  if (C.fonts?.stencil)   root.style.setProperty("--fontStencil", C.fonts.stencil);
  if (C.fonts?.marker)    root.style.setProperty("--fontMarker", C.fonts.marker);
  if (C.fonts?.caption)   root.style.setProperty("--fontCaption", C.fonts.caption);
  const P = C.palette;
  if (P?.ink)        root.style.setProperty("--ink", P.ink);
  if (P?.paper)       root.style.setProperty("--paper", P.paper);
  if (P?.paperWhite)  root.style.setProperty("--paperWhite", P.paperWhite);
  if (P?.red)          root.style.setProperty("--red", P.red);
})(CONFIG);
/* ======================================================================== */

const doc = document, $ = id => doc.getElementById(id);
const C = CONFIG, stage = $("stage"), audio = $("audio");
let vw = innerWidth, vh = innerHeight;
addEventListener("resize", () => { vw = innerWidth; vh = innerHeight; });

function mulberry32(a) { return function() {
  a |= 0; a = a + 0x6D2B79F5 | 0;
  let t = Math.imul(a ^ a >>> 15, 1 | a);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rng = mulberry32(C.seed);
function pickWeighted(rngFn, weights) {
  const keys = Object.keys(weights), total = keys.reduce((s, k) => s + weights[k], 0);
  let r = rngFn() * total;
  for (const k of keys) { if ((r -= weights[k]) < 0) return k; }
  return keys[keys.length - 1];
}

/* ---- intro / outro: mismo flyer (.flyer), textos distintos ---- */
function buildCard(id, cfg) {
  const i = $(id);
  i.querySelector(".artist").textContent = cfg.artist ?? cfg.songTitle ?? "";
  i.querySelector(".title").textContent = cfg.title;
  i.querySelector(".sub").textContent = cfg.sub;
  i.querySelector(".feats").textContent = cfg.feats;
}
buildCard("intro", window.NexaTemplateIntro.apply(C.intro));
const outroController = window.NexaCollageOutro.createDOMOutro({root: $("outro"), config: C.outro || {}, onShow: () => {
  $("intro").classList.add("gone");
  $("viewport").style.opacity = "0";
  for (const item of current) item.el.classList.add("cold");
  captionEl.classList.remove("on");
}});

/* ---- lyrics: 100% desde lyricsUrl (JSON de Whisper) ---- */
async function loadLyrics() {
  try {
    const r = await fetch(C.lyricsUrl);
    if (!r.ok) throw new Error("HTTP " + r.status);
    const j = await r.json();
    const out = [];
    for (const seg of j.segments) {
      const segText = seg.text.trim();
      for (const w of seg.words) out.push({ t: w.start, text: w.word.trim(), line: segText });
    }
    if (!out.length) throw new Error("lyrics.json sin palabras");
    return out;
  } catch (e) {
    console.warn("[collage-callejero] No se pudo cargar", C.lyricsUrl,
                 "— sirve el HTML por HTTP (Live Server), no por file://.", e);
    return [];
  }
}

/* ---- recortes de papel: bordes rasgados irregulares ---- */
function tornPoly() {
  const pts = [], seg = 5;
  for (let i = 0; i <= seg; i++) pts.push(`${(i / seg * 100).toFixed(1)}% ${(rng() * 8).toFixed(1)}%`);
  for (let i = seg; i >= 0; i--) pts.push(`${(i / seg * 100).toFixed(1)}% ${(100 - rng() * 8).toFixed(1)}%`);
  return `polygon(${pts.join(",")})`;
}

/* ---- figuras: primero en orden 1..N, luego aleatorio sin repetir la última ---- */
const FIGS = (C.figures?.items || []).filter(Boolean);
let figSeqPtr = 0, lastFigIdx = -1;
function nextFigureIndex() {
  if (!FIGS.length) return -1;
  if (figSeqPtr < FIGS.length) { const i = figSeqPtr; figSeqPtr++; lastFigIdx = i; return i; }
  let i = Math.floor(rng() * FIGS.length);
  if (FIGS.length > 1) while (i === lastFigIdx) i = Math.floor(rng() * FIGS.length);
  lastFigIdx = i;
  return i;
}

/* ---- escena: cluster de 2-4 palabras alrededor de un ancla nueva ---- */
const L = C.layout;
let anchorX = vw * 0.5, anchorY = vh * 0.42, wordsThisScene = 0, sceneTarget = 0, sceneSide = "left";
let current = [];   /* { el, side, kind: "clip"|"figure" } — todo lo vivo en la escena actual */

function nextSceneTarget() { return L.sceneWordsMin + Math.floor(rng() * (L.sceneWordsMax - L.sceneWordsMin + 1)); }

function clearScene() {
  for (const item of current) {
    const side = item.side;
    if (item.kind === "figure") { item.el.classList.add("leaving", side === "left" ? "leaveL" : "leaveR"); }
    else { item.el.classList.add(side === "left" ? "leaveL" : "leaveR"); }
    const el = item.el;
    __nbSetTimeout(() => el.remove(), 650);
  }
  current = [];
}

function newScene() {
  anchorX = vw * (0.28 + rng() * 0.44);
  anchorY = vh * (0.30 + rng() * 0.30);
  wordsThisScene = 0;
  sceneTarget = nextSceneTarget();
  sceneSide = rng() < L.sideWeights.left ? "left" : "right";

  if (rng() < L.figureChance && FIGS.length) {
    const idx = nextFigureIndex();
    if (idx >= 0) {
      const side = rng() < 0.5 ? "left" : "right";
      const img = doc.createElement("img");
      img.className = "figure";
      img.style.setProperty("--rot", ((rng() - 0.5) * 6).toFixed(2) + "deg");
      img.style.bottom = "0px";
      img.onerror = () => img.remove();
      img.onload = () => {
        /* el ancho real solo se conoce tras cargar (alto fijo, ancho por
           aspect-ratio) — recién ahí se puede anclar sin salirse del cuadro */
        const marginX = vw * 0.02;
        const w = img.offsetWidth;
        const left = side === "left" ? marginX : Math.max(marginX, vw - w - marginX);
        img.style.left = left + "px";
        img.classList.add(side === "left" ? "enterL" : "enterR");
      };
      img.src = FIGS[idx];
      stage.appendChild(img);
      current.push({ el: img, side, kind: "figure" });
    }
  }
}
newScene();

/* ---- caption: la línea completa de la letra, discreta, a máquina de escribir ---- */
const captionEl = $("caption");
let lastLine = null;
function maybeCaption(line) {
  if (!line || line === lastLine) return;
  lastLine = line;
  if (rng() > L.captionChance) { captionEl.classList.remove("on"); return; }
  captionEl.textContent = line;
  captionEl.style.left = (vw * (0.06 + rng() * 0.10)) + "px";
  captionEl.style.top = (vh * 0.80) + "px";
  captionEl.classList.add("on");
}

function fontSizeFor(text, kind) {
  const len = Math.max(2, text.length);
  const wShare = vw < vh ? 0.5 : 0.30;
  let fs = Math.min(vw * wShare / (len * 0.55), kind === "hollow" ? vh * 0.24 : vh * 0.13);
  fs *= 0.86 + rng() * 0.3;
  if (kind === "hollow") fs *= 1.25;
  return Math.max(vh * 0.05, Math.min(fs, kind === "hollow" ? vh * 0.30 : vh * 0.16));
}

function placeWord(w) {
  const clean = w.text.replace(/[.,;!?¡¿"']/g, "");
  if (!clean) return;
  if (wordsThisScene >= sceneTarget) { clearScene(); newScene(); }

  const kind = pickWeighted(rng, L.typeWeights);
  const colorKey = pickWeighted(rng, L.colorWeights);
  const P = C.palette;
  const colorMap = { ink: P.ink, red: P.red, paper: P.paperWhite };
  const onLight = rng() < 0.5;

  const el = doc.createElement("div");
  el.className = "clip " + kind;
  el.textContent = clean;
  const fs = fontSizeFor(clean, kind);
  el.style.fontSize = fs + "px";
  el.style.setProperty("--rot", ((rng() - 0.5) * 2 * L.rotMax).toFixed(2) + "deg");

  if (kind === "poster") {
    el.style.background = onLight ? P.paperWhite : P.ink;
    /* si el color sorteado coincide con el del fondo (paper-sobre-claro o
       ink-sobre-oscuro), se fuerza el opuesto — si no, el texto queda
       invisible por falta de contraste */
    el.style.color = onLight
      ? (colorKey === "paper" ? P.ink : colorMap[colorKey])
      : (colorKey === "ink" ? P.paperWhite : colorMap[colorKey]);
    el.style.clipPath = tornPoly();
  } else if (kind === "stencil") {
    /* sin fondo propio, estampado directo sobre el papel claro — "paper"
       sería casi invisible, así que cae a ink */
    el.style.color = colorKey === "paper" ? P.ink : colorMap[colorKey];
  } else if (kind === "marker") {
    el.style.color = colorKey === "paper" ? P.ink : colorMap[colorKey];
  } else { /* hollow: mismo motivo — el trazo necesita contraste contra el papel */
    el.style.color = colorKey === "paper" ? P.ink : colorMap[colorKey];
  }

  const jitterX = (wordsThisScene === 0 ? 0 : (rng() - 0.5) * vw * (L.clusterSpreadVw / 100)) + (wordsThisScene * vw * 0.03);
  const jitterY = wordsThisScene * vh * (L.clusterSpreadVh / 100) + (rng() - 0.5) * vh * 0.03;
  el.style.left = (anchorX + jitterX) + "px";
  el.style.top = (anchorY + jitterY) + "px";

  /* se mide fuera de pantalla (opacity 0 por CSS) antes de animar, para
     recortar la posición al viewport — si no, palabras largas o en un
     ancla cercana al borde terminan cortadas fuera de cuadro */
  stage.appendChild(el);
  const marginX = vw * 0.03, marginY = vh * 0.03;
  const ew = el.offsetWidth, eh = el.offsetHeight;
  const clampedLeft = Math.min(Math.max(anchorX + jitterX, marginX), Math.max(marginX, vw - ew - marginX));
  const clampedTop = Math.min(Math.max(anchorY + jitterY, marginY), Math.max(marginY, vh - eh - marginY));
  el.style.left = clampedLeft + "px";
  el.style.top = clampedTop + "px";

  const side = rng() < 0.65 ? sceneSide : (sceneSide === "left" ? "right" : "left");
  requestAnimationFrame(() => el.classList.add(side === "left" ? "enterL" : "enterR"));

  current.push({ el, side, kind: "clip" });
  for (const item of current) if (item.el !== el && item.kind === "clip") item.el.classList.add("cold");

  wordsThisScene++;
  maybeCaption(w.line);
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

/* ---- outro: se dispara por el FINAL REAL del audio, no por la letra ---- */
let outroShown = false;
function maybeOutro() {
  const t = audio.ended && isFinite(audio.duration) ? audio.duration : audio.currentTime;
  outroShown = outroController.update(t, audio.duration, audio.ended).active;
  $("viewport").style.opacity = outroShown ? "0" : "";
}
audio.addEventListener("ended", maybeOutro);

/* ---- main ---- */
let words = [], ptr = 0, introGone = false;
function frame(now) {
  rafNow = now;
  if (rafT0 === null) rafT0 = now;
  const t = clock();
  maybeOutro();
  if (!outroShown) {
    while (ptr < words.length && t >= words[ptr].t) {
      if (!introGone) { $("intro").classList.add("gone"); introGone = true; }
      placeWord(words[ptr]);
      ptr++;
    }
  }
  requestAnimationFrame(frame);
}

if (C.bg.src) { const b = $("bg"); b.src = C.bg.src; b.style.display = "block"; b.style.opacity = 0.14; }
audio.src = encodeURI(C.audio.src);
loadLyrics().then(w => { words = w; });
begin();
requestAnimationFrame(frame);
