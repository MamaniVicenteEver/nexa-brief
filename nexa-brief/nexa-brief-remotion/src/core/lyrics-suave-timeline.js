// Cálculo del layout/cámara/polvo/timeline de LetrasSuaves — port de
// src/templates/letras-suaves/index.html (plantilla "SUAVE": hermana calma
// de lyrics-impact — mismo motor urbano pero sin saltos laterales).
//
// Mecánica del original: la letra se agrupa en LÍNEAS (1-3 palabras cortas
// seguidas, según qué tan rápido llegan); se apilan en una ÚNICA columna
// (siempre hacia abajo, nunca cambia de lado); cada línea aparece con una de
// 5 "entradas" al azar (eRise/eBlur/eLeft/eRight, eRise con el doble de
// peso); tipografía en 2 estilos (Anton blanco / Permanent Marker rojo,
// sesgado hacia líneas de una sola palabra); cámara vertical que sigue a la
// línea más nueva MÁS una deriva horizontal aleatoria por línea (NO
// sinusoidal — el original tira un nuevo objetivo random en cada línea y
// decae exponencialmente hacia él, igual que el eje vertical, solo que con
// otra tasa de decaimiento); polvo ambiental flotando hacia arriba en canvas.
//
// Mismo patrón que neon-timeline.js/lyrics-romantic-timeline.js:
// computeTimeline() recibe config/lyrics como argumentos y hornea todo de
// una sola pasada — el componente debe memoizarlo con React.useMemo.
const {Easing} = require('remotion');
const {mulberry32, resolveMediaSrc, lerp, findLastIdx} = require('./shared-timeline-utils');

const FPS = 30;
const WIDTH = 1920;
const HEIGHT = 1080;
// Cámara: el original decae camY 0.06/tick y camX 0.04/tick (~60fps real).
// A 30fps componemos dos pasos para llegar a una velocidad de asentamiento
// similar (mismo razonamiento que CAM_DECAY en neon-timeline.js).
const CAM_Y_DECAY = 1 - Math.pow(1 - 0.06, 60 / FPS);
const CAM_X_DECAY = 1 - Math.pow(1 - 0.04, 60 / FPS);

function flattenWords(lyrics) {
  const out = [];
  for (const seg of lyrics.segments) {
    for (const w of seg.words) out.push({t: w.start, text: w.word.trim()});
  }
  out.sort((a, b) => a.t - b.t);
  return out;
}

// Réplica 1:1 de groupIntoRows() del original.
function groupIntoRows(flat, cfg) {
  const rows = [];
  let cur = null;
  for (const w of flat) {
    const clean = w.text.replace(/[.,;!?¡¿"']/g, '');
    if (!clean) continue;
    if (cur && w.t - cur.lastT < cfg.groupGapSec && (cur.text + ' ' + clean).length <= cfg.maxRowChars) {
      cur.text += ' ' + clean;
      cur.lastT = w.t;
      cur.words++;
    } else {
      if (cur) rows.push(cur);
      cur = {t: w.t, text: clean, lastT: w.t, words: 1};
    }
  }
  if (cur) rows.push(cur);
  return rows;
}

function fontSizeFor(text, words, vw, vh, rng) {
  const len = Math.max(2, text.length);
  const base = words <= 1 ? vh * 0.13 : vh * 0.075;
  const wShare = 0.82; // canvas fijo 16:9 → siempre rama "desktop" del original (vw > vh)
  let fs = Math.min((vw * wShare) / (len * 0.56), base);
  fs *= 0.92 + rng() * 0.18;
  return Math.max(vh * 0.045, fs);
}

// eRise pesa el doble (dos slots en el array, igual que el original).
const ENTRANCES = ['eRise', 'eRise', 'eBlur', 'eLeft', 'eRight'];

// Réplica 1:1 de placeRow(): MISMO orden de llamadas a rng() que el original
// (impact-chance, índice de entrada, airy [condicional], side-align [+ L/R
// opcional], rot, fontSize jitter) — crítico para reproducir el mismo layout
// dado el mismo seed.
function placeRow(r, L, rowY, vw, vh, rng, fps) {
  const impactChance = r.words <= 1 ? L.impactChanceSolo : L.impactChanceMulti;
  const impact = rng() < impactChance;

  const entrance = ENTRANCES[Math.floor(rng() * ENTRANCES.length)];

  let airy = false;
  if (r.text.length <= 7 && rng() < L.airyChance) airy = true;

  let align = null;
  if (rng() < L.sideAlignChance) align = rng() < 0.5 ? 'L' : 'R';

  const rotDeg = (rng() - 0.5) * 2 * L.maxTiltDeg;
  const fs = fontSizeFor(r.text, r.words, vw, vh, rng);

  const height = fs * 1.15;
  const y = rowY;
  const nextRowY = rowY + height + vh * (L.rowGapVh / 100);

  return {
    frame: Math.round(r.t * fps),
    impact,
    entrance,
    airy,
    align,
    rotDeg,
    fontSize: fs,
    text: r.text,
    y,
    h: height,
    nextRowY,
  };
}

// Réplica 1:1 de seedDust(): count*5 llamadas a rng() (x,y,r,v,ph por mota).
function seedDust(cfg, rng, vw, vh) {
  const motes = [];
  for (let i = 0; i < cfg.count; i++) {
    motes.push({
      x0: rng() * vw,
      y0: rng() * vh,
      r: 0.6 + rng() * 1.6,
      v: 0.05 + rng() * 0.12,
      ph: rng() * Math.PI * 2,
    });
  }
  return motes;
}

// buildTimeline() replica el orden EXACTO de consumo de rng() del original:
// seedDust() corre síncrono al boot (ANTES de que cualquier línea se
// coloque, ya que loadLyrics() es async y start() llama seedDust() de
// inmediato) y comparte el MISMO stream de rng que el layout — así que va
// primero acá también. Luego, por cada línea: placeRow() consume sus
// llamadas y ACTO SEGUIDO aimCamera() consume 1 llamada más para camTX
// (camTY no consume rng) — mismo orden que
// `aimCamera(placeRow(rows[ptr]))` en el bucle rAF del original.
function buildTimeline(C, lyrics, fps) {
  const rng = mulberry32(C.seed);
  const vw = WIDTH;
  const vh = HEIGHT; // canvas fijo 16:9 → siempre rama "landscape" del original
  const L = C.layout;

  const dust = seedDust(C.dust, rng, vw, vh);

  const flat = flattenWords(lyrics);
  const rawRows = groupIntoRows(flat, L);

  const ROWS = [];
  const camEvents = [];
  let rowY = 0;
  for (const r of rawRows) {
    const placed = placeRow(r, L, rowY, vw, vh, rng, fps);
    rowY = placed.nextRowY;

    const camTY = placed.y + placed.h / 2 - vh * L.anchorVhFrac;
    const camTX = (rng() - 0.5) * 2 * vw * (L.camDriftVw / 100);
    camEvents.push({frame: placed.frame, camTX, camTY});

    ROWS.push(placed);
  }

  return {ROWS, camEvents, dust};
}

function simulateCamera(camEvents, totalFrames, decayX, decayY) {
  const camXs = new Float64Array(totalFrames + 1);
  const camYs = new Float64Array(totalFrames + 1);
  let camX = 0;
  let camY = 0;
  let camTX = 0;
  let camTY = 0;
  let ei = 0;
  for (let f = 0; f <= totalFrames; f++) {
    while (ei < camEvents.length && camEvents[ei].frame === f) {
      camTX = camEvents[ei].camTX;
      camTY = camEvents[ei].camTY;
      ei++;
    }
    camX += (camTX - camX) * decayX;
    camY += (camTY - camY) * decayY;
    camXs[f] = camX;
    camYs[f] = camY;
  }
  return {camXs, camYs};
}

function computeTimeline(configDb, lyricsData) {
  const CONFIG = configDb.configs.find((c) => c.id === configDb.activeId) || configDb.configs[0];
  const DURATION_SEC = lyricsData.metadata.audio_duration_sec;
  const TOTAL_FRAMES = Math.ceil(DURATION_SEC * FPS);
  const OUTRO_LEAD_FRAMES = Math.round((CONFIG.outro.leadSec || 0) * FPS);
  const OUTRO_FRAME = TOTAL_FRAMES - OUTRO_LEAD_FRAMES;

  const {ROWS, camEvents, dust} = buildTimeline(CONFIG, lyricsData, FPS);
  const {camXs: CAM_XS, camYs: CAM_YS} = simulateCamera(camEvents, TOTAL_FRAMES, CAM_X_DECAY, CAM_Y_DECAY);

  return {CONFIG, TOTAL_FRAMES, OUTRO_FRAME, ROWS, CAM_XS, CAM_YS, dust};
}

// --- entradas (.row.eRise/.eBlur/.eLeft/.eRight → .row.in) ---
// Valores iniciales exactos del CSS fuente (px derivados de vw/vh fijos,
// ya que el canvas siempre es 1920x1080). transition original:
// "opacity 0.9s ease, transform 0.9s cubic-bezier(0.2,0.7,0.3,1), filter 1.4s ease".
const ENTRANCE_DEFS = {
  eRise: {tx: 0, ty: 18, scale: 0.96, blur: 0},
  eBlur: {tx: 0, ty: 0, scale: 1.07, blur: 9},
  eLeft: {tx: -0.04 * WIDTH, ty: 0, scale: 1, blur: 3},
  eRight: {tx: 0.04 * WIDTH, ty: 0, scale: 1, blur: 3},
};
const ENTRANCE_TRANSFORM_EASE = Easing.bezier(0.2, 0.7, 0.3, 1);
const ENTRANCE_OPACITY_EASE = Easing.ease;
const ENTRANCE_FILTER_EASE = Easing.ease;
const ENTRANCE_OPACITY_DUR = 0.9;
const ENTRANCE_TRANSFORM_DUR = 0.9;
const ENTRANCE_FILTER_DUR = 1.4;

// --- envejecido (.row.old): opacity 0.9s ease, filter 1.4s ease (SIN
// cambio de transform — a diferencia de bajo-la-lluvia, esta plantilla no
// hunde las líneas viejas, solo las apaga y difumina) ---
const OLD_OPACITY = 0.16;
const OLD_BLUR = 2.5;

// Calcula opacity/transform/filter de una línea en un frame dado — réplica
// cerrada de las transiciones CSS de entrada + envejecido (mismo principio
// que igniteOpacity/coldT en neon-timeline.js).
function rowStyle(row, frame, fps, oldFrame) {
  const def = ENTRANCE_DEFS[row.entrance];
  const dtEnter = (frame - row.frame) / fps;

  const tOpacity = ENTRANCE_OPACITY_EASE(Math.min(1, Math.max(0, dtEnter / ENTRANCE_OPACITY_DUR)));
  const tTransform = ENTRANCE_TRANSFORM_EASE(Math.min(1, Math.max(0, dtEnter / ENTRANCE_TRANSFORM_DUR)));
  const tFilter = ENTRANCE_FILTER_EASE(Math.min(1, Math.max(0, dtEnter / ENTRANCE_FILTER_DUR)));

  let opacity = lerp(0, 1, tOpacity);
  const tx = lerp(def.tx, 0, tTransform);
  const ty = lerp(def.ty, 0, tTransform);
  const scale = lerp(def.scale, 1, tTransform);
  let blur = lerp(def.blur, 0, tFilter);

  if (oldFrame !== null && frame >= oldFrame) {
    const dtOld = (frame - oldFrame) / fps;
    const tOldOpacity = ENTRANCE_OPACITY_EASE(Math.min(1, dtOld / ENTRANCE_OPACITY_DUR));
    const tOldFilter = ENTRANCE_FILTER_EASE(Math.min(1, dtOld / ENTRANCE_FILTER_DUR));
    opacity = lerp(1, OLD_OPACITY, tOldOpacity);
    blur = lerp(0, OLD_BLUR, tOldFilter);
  }

  return {opacity, tx, ty, scale, blur};
}

// --- polvo ambiental: réplica cerrada de drawDust() (motas subiendo con
// wraparound + deriva horizontal senoidal) — mismo principio que
// bokehPosition() en lyrics-romantic-timeline.js, adaptado a dirección
// ascendente y al wrap propio de esta plantilla (K=10 en vez de 60/120).
const DUST_W = 0.0003; // rad/ms
const DUST_A = 0.15; // px por tick
const DUST_TICK_MS = 1000 / 60;
const DUST_DRIFT_AMP = DUST_A / (DUST_W * DUST_TICK_MS);
function dustPosition(mote, elapsedMs, vh) {
  const K = 10;
  const range = vh + 2 * K;
  const distY = (mote.v * 60 * elapsedMs) / 1000; // px recorridos (v es px/tick a 60fps)
  const y = vh + K - ((((vh + K - mote.y0 + distY) % range) + range) % range);
  const x = mote.x0 + DUST_DRIFT_AMP * (Math.cos(mote.ph) - Math.cos(DUST_W * elapsedMs + mote.ph));
  return {x, y};
}

const GRAIN_STEPS = [
  [0, 0],
  ['-2%', '1%'],
  ['1%', '-2%'],
  ['-1%', '2%'],
];

const BREATH_EASE = Easing.inOut(Easing.ease);

module.exports = {
  FPS,
  WIDTH,
  HEIGHT,
  computeTimeline,
  resolveMediaSrc,
  findLastIdx,
  lerp,
  rowStyle,
  dustPosition,
  GRAIN_STEPS,
  BREATH_EASE,
};
