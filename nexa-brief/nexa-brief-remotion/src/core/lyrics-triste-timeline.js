// Cálculo del layout/cámara/lluvia/timeline de BajoLaLluvia — port de
// src/templates/bajo-la-lluvia/index.html (plantilla "TRISTE": paleta fría
// azul-acero, lluvia real en canvas, texto que cae con gravedad y rebote,
// se hunde y se difumina al envejecer).
//
// Mecánica del original: la letra se agrupa en LÍNEAS (como en
// letras-suaves/lyrics-romantic); cada línea CAE desde arriba
// (translateY(-42px)→0, cubic-bezier con overshoot que da el "rebote") y,
// al envejecer (oldAfter líneas después), SE HUNDE 26px hacia abajo
// mientras se apaga y difumina — misma curva de transición reutilizada en
// ambas direcciones, ya que el CSS original solo declara una única
// `transition` en la regla base `.row` sin importar qué combinación de
// clases dispara el cambio. Alterna condensada dura (Oswald) con máquina de
// escribir (Special Elite); algunas líneas typewriter parpadean como
// lámpara moribunda (@keyframes dying). Cámara vertical (un solo eje, sin
// deriva horizontal) que decae exponencialmente hacia la línea más nueva.
//
// Mismo patrón que lyrics-romantic-timeline.js: computeTimeline() recibe
// config/lyrics como argumentos y hornea todo de una sola pasada — el
// componente debe memoizarlo con React.useMemo.
const {Easing} = require('remotion');
const {mulberry32, resolveMediaSrc, lerp, findLastIdx} = require('./shared-timeline-utils');

const FPS = 30;
const WIDTH = 1920;
const HEIGHT = 1080;
// Cámara: el original decae 0.055 por tick (~60fps real). A 30fps
// componemos dos pasos (mismo razonamiento que CAM_DECAY en neon-timeline.js).
const CAM_DECAY = 1 - Math.pow(1 - 0.055, 60 / FPS);

const MAX_VISIBLE_ROWS = 16; // mismo tope que `if (placed.length > 16) shift()` en el original

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

function fontSizeFor(text, words, type, vw, vh, rng) {
  const len = Math.max(2, text.length);
  const base = words <= 1 ? vh * (type ? 0.095 : 0.125) : vh * 0.07;
  const wShare = 0.84; // canvas fijo 16:9 → siempre rama "desktop" del original (vw > vh)
  let fs = Math.min((vw * wShare) / (len * 0.56), base);
  fs *= 0.9 + rng() * 0.2;
  return Math.max(vh * 0.042, fs);
}

// Réplica 1:1 de placeRow(): MISMO orden de llamadas a rng() que el
// original (type-chance, dying-chance [condicional], side-align [+ L/R
// opcional], rot, fontSize jitter).
function placeRow(r, L, rowY, vw, vh, rng, fps) {
  const typeChance = r.words <= 1 ? L.typeChanceSolo : L.typeChanceMulti;
  const type = rng() < typeChance;

  let dying = false;
  if (type && rng() < L.dyingChance) dying = true;

  let align = null;
  if (rng() < L.sideAlignChance) align = rng() < 0.5 ? 'L' : 'R';

  const rotDeg = (rng() - 0.5) * 2 * L.maxTiltDeg;
  const fs = fontSizeFor(r.text, r.words, type, vw, vh, rng);

  const height = fs * 1.18;
  const y = rowY;
  const nextRowY = rowY + height + vh * (L.rowGapVh / 100);

  return {
    frame: Math.round(r.t * fps),
    type,
    dying,
    align,
    rotDeg,
    fontSize: fs,
    text: type ? r.text.toLowerCase() : r.text,
    y,
    h: height,
    nextRowY,
  };
}

// Réplica 1:1 de seedRain(): streaks*6 llamadas a rng() (x,y,len,v,a,drift
// por gota) — corre síncrono al boot, ANTES de que cualquier línea se
// coloque (mismo razonamiento de orden que en lyrics-suave-timeline.js:
// seedRain() se llama justo antes de arrancar el loop rAF, y comparte el
// MISMO stream de rng que el layout).
function seedRain(cfg, rng) {
  const drops = [];
  for (let i = 0; i < cfg.streaks; i++) {
    drops.push({
      x0: rng() * WIDTH,
      y0: rng() * HEIGHT,
      len: 8 + rng() * 22,
      v: 2.4 + rng() * 4.2,
      a: 0.05 + rng() * 0.12,
      drift: 0.3 + rng() * 0.5,
    });
  }
  return drops;
}

function buildTimeline(C, lyrics, fps) {
  const rng = mulberry32(C.seed);
  const vw = WIDTH;
  const vh = HEIGHT; // canvas fijo 16:9 → siempre rama "landscape" del original
  const L = C.layout;

  const rain = seedRain(C.rain, rng);

  const flat = flattenWords(lyrics);
  const rawRows = groupIntoRows(flat, L);

  const ROWS = [];
  let rowY = 0;
  for (const r of rawRows) {
    const placed = placeRow(r, L, rowY, vw, vh, rng, fps);
    rowY = placed.nextRowY;
    ROWS.push(placed);
  }

  const CAM_YS = simulateCamera(ROWS, Math.ceil(lyrics.metadata.audio_duration_sec * fps), CAM_DECAY, L.anchorVhFrac, vh);

  return {ROWS, CAM_YS, rain};
}

function simulateCamera(rows, totalFrames, decay, anchorVhFrac, vh) {
  const camYs = new Float64Array(totalFrames + 1);
  let camY = 0;
  let camTY = 0;
  let ri = 0;
  for (let f = 0; f <= totalFrames; f++) {
    while (ri < rows.length && rows[ri].frame === f) {
      camTY = rows[ri].y + rows[ri].h / 2 - vh * anchorVhFrac;
      ri++;
    }
    camY += (camTY - camY) * decay;
    camYs[f] = camY;
  }
  return camYs;
}

function computeTimeline(configDb, lyricsData) {
  const CONFIG = configDb.configs.find((c) => c.id === configDb.activeId) || configDb.configs[0];
  const DURATION_SEC = lyricsData.metadata.audio_duration_sec;
  const TOTAL_FRAMES = Math.ceil(DURATION_SEC * FPS);
  const OUTRO_LEAD_FRAMES = Math.round((CONFIG.outro.leadSec || 0) * FPS);
  const OUTRO_FRAME = TOTAL_FRAMES - OUTRO_LEAD_FRAMES;

  const {ROWS, CAM_YS, rain} = buildTimeline(CONFIG, lyricsData, FPS);

  return {CONFIG, TOTAL_FRAMES, OUTRO_FRAME, ROWS, CAM_YS, rain};
}

// --- caída con rebote + hundimiento envejecido ---
// Réplica cerrada de la ÚNICA `transition` declarada en `.row`:
//   opacity 1.1s ease, transform 1.3s cubic-bezier(0.25,0.9,0.35,1.08), filter 1.6s ease
// aplicada dos veces: de "recién nacida" (translateY(-42px), opacity 0) a
// "in" (translateY(0), opacity 1) al aparecer, y de "in" a "old"
// (translateY(26px), opacity 0.12, blur(2.5px)) al envejecer. El control
// point y=1.08 del bezier de transform es justo lo que produce el rebote
// (overshoot) tanto al caer como al hundirse.
const FALL_EASE = Easing.bezier(0.25, 0.9, 0.35, 1.08);
const FADE_EASE = Easing.ease;
const BLUR_EASE = Easing.ease;
const OPACITY_DUR = 1.1;
const TRANSFORM_DUR = 1.3;
const FILTER_DUR = 1.6;
const OLD_OPACITY = 0.12;
const OLD_BLUR = 2.5;

function rowMotion(row, frame, fps, oldFrame) {
  const dtEnter = (frame - row.frame) / fps;
  const tOpacity = FADE_EASE(Math.min(1, Math.max(0, dtEnter / OPACITY_DUR)));
  const tTransform = FALL_EASE(Math.min(1, Math.max(0, dtEnter / TRANSFORM_DUR)));

  let opacity = lerp(0, 1, tOpacity);
  let translateY = lerp(-42, 0, tTransform);
  let blur = 0;

  if (oldFrame !== null && frame >= oldFrame) {
    const dtOld = (frame - oldFrame) / fps;
    const tOldOpacity = FADE_EASE(Math.min(1, dtOld / OPACITY_DUR));
    const tOldTransform = FALL_EASE(Math.min(1, dtOld / TRANSFORM_DUR));
    const tOldBlur = BLUR_EASE(Math.min(1, dtOld / FILTER_DUR));
    opacity = lerp(1, OLD_OPACITY, tOldOpacity);
    translateY = lerp(0, 26, tOldTransform);
    blur = lerp(0, OLD_BLUR, tOldBlur);
  }

  return {opacity, translateY, blur};
}

// --- parpadeo de lámpara moribunda (@keyframes dying, 3.4s ease, delay
// 0.9s, 2 iteraciones) — mismo principio de breakpoints que
// igniteOpacity()/heartbeatScale(), interpolación lineal entre paradas
// (aproximación ya usada en el proyecto para animaciones "ease" por tramos
// — ver heartbeatScale en lyrics-romantic-timeline.js). Devuelve null
// cuando la animación no está activa (antes del delay o después de las 2
// iteraciones) para que el llamador use la opacidad base en su lugar —
// replica que un @keyframes de opacity PISA a la transition mientras está
// activo, no se combinan.
const DYING_DELAY = 0.9;
const DYING_DUR = 3.4;
const DYING_ITERATIONS = 2;
const DYING_BREAKS = [0, 0.82, 0.84, 0.86, 0.91, 0.93, 1];
const DYING_VALS = [1, 1, 0.45, 1, 0.6, 1, 1];
function dyingOpacity(dtSec) {
  if (dtSec < DYING_DELAY || dtSec > DYING_DELAY + DYING_DUR * DYING_ITERATIONS) return null;
  const local = ((dtSec - DYING_DELAY) % DYING_DUR) / DYING_DUR;
  for (let i = DYING_BREAKS.length - 2; i >= 0; i--) {
    if (local >= DYING_BREAKS[i]) {
      const t0 = DYING_BREAKS[i];
      const t1 = DYING_BREAKS[i + 1];
      const localT = (local - t0) / (t1 - t0);
      return lerp(DYING_VALS[i], DYING_VALS[i + 1], localT);
    }
  }
  return 1;
}

// --- lluvia en canvas: réplica cerrada de drawRain() ---
// Original por tick (~60fps asumidos): `d.y += d.v; d.x -= d.drift;` con
// wraparound `if (d.y > vh+30) { d.y=-30; d.x = rng()*(vw+80); }`. El
// reciclado en X vuelve a tirar rng() en tiempo real — no reproducible
// fuera de orden (mismo problema que el reciclado de bokeh en
// lyrics-romantic-timeline.js) — así que lo sustituimos por un wrap
// determinista vía módulo (mismo espíritu que el "reciclado omitido" de
// bokehPosition, adaptado a esta plantilla).
function rainPosition(drop, elapsedMs) {
  const K = 30;
  const range = HEIGHT + 2 * K;
  const ticks = (elapsedMs / 1000) * 60;
  const distY = drop.v * ticks;
  const y = (((drop.y0 + K + distY) % range) + range) % range - K;

  const rangeX = WIDTH + 80;
  const distX = drop.drift * ticks;
  const x = (((drop.x0 - distX) % rangeX) + rangeX) % rangeX;
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
  MAX_VISIBLE_ROWS,
  computeTimeline,
  resolveMediaSrc,
  findLastIdx,
  lerp,
  rowMotion,
  dyingOpacity,
  rainPosition,
  GRAIN_STEPS,
  BREATH_EASE,
};
