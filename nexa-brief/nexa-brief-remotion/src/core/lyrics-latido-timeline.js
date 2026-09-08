// Cálculo del trazo ECG / cámara / BPM / timeline de LatidoEnVivo — port de
// src/templates/latido-en-vivo/index.html (plantilla "LATIDO": la letra ES
// un electrocardiograma vivo, 100% generativa — sin imagen/video de fondo).
//
// Mecánica del original: cada palabra cantada es un latido. Un trazo
// carmesí serpentea (heading acumulado + pasos aleatorios) y dibuja un
// complejo QRS (6 puntos: base→medio1→pico→overshoot→medio2→base) por
// palabra; la palabra nace en la punta del pico. El trazo se "dibuja" con
// stroke-dashoffset animado (transición lineal 0.26s) y los segmentos
// viejos se oscurecen (transición de color 1.4s ease). La cámara sigue la
// punta del último pico en 4 ejes independientes (x, y, zoom, dutch-tilt),
// cada uno con su propia tasa de decaimiento exponencial — mismo principio
// que simulateCamera() en neon-timeline.js, aplicado 4 veces. Un "pulso" de
// zoom/flash decae multiplicativamente (0.90/tick) desde el valor que le
// puso el último latido — sin objetivo, solo decaimiento puro. El monitor
// de BPM es una media móvil de los intervalos REALES entre palabras
// cantadas (100% determinista, viene de lyrics.json).
//
// Mismo patrón que los demás *-timeline.js: computeTimeline() recibe
// config/lyrics como argumentos y hornea todo de una sola pasada — el
// componente debe memoizarlo con React.useMemo.
const {Easing} = require('remotion');
const {mulberry32, resolveMediaSrc, lerp, findLastIdx} = require('./shared-timeline-utils');

const FPS = 30;
const WIDTH = 1920;
const HEIGHT = 1080;

// Cámara: el original decae camX/camY 0.075/tick, camS(zoom) 0.06/tick,
// camRot(dutch) 0.05/tick (~60fps real). A 30fps componemos dos pasos por
// eje (mismo razonamiento que CAM_DECAY en neon-timeline.js).
const CAM_XY_DECAY = 1 - Math.pow(1 - 0.075, 60 / FPS);
const CAM_S_DECAY = 1 - Math.pow(1 - 0.06, 60 / FPS);
const CAM_ROT_DECAY = 1 - Math.pow(1 - 0.05, 60 / FPS);
// pulse: decae multiplicativamente 0.90/tick (~60fps), sin objetivo.
const PULSE_DECAY_PER_TICK = 0.9;

const MAX_VISIBLE_WORDS = 30; // mismo tope que `if (placed.length > 30) shift().remove()`
const MAX_VISIBLE_SEGS = 110; // mismo tope que `if (segs.length > 110) shift().remove()`

function flattenWords(lyrics) {
  const out = [];
  for (const seg of lyrics.segments) {
    for (const w of seg.words) out.push({t: w.start, text: w.word.trim()});
  }
  out.sort((a, b) => a.t - b.t);
  return out;
}

// Réplica 1:1 de drawBeat(): dibuja el tramo A→B con complejo QRS en el
// medio, devuelve la punta del pico + el estado de heading/posición
// actualizado. MISMO orden de llamadas a rng() que el original (sharpTurn
// [+ signo/magnitud], step, side-flip [condicional], amp).
function drawBeat(state, E, solo, vw, vh, rng) {
  if (rng() < E.sharpTurnChance) {
    state.heading += (rng() > 0.5 ? 1 : -1) * (0.9 + rng() * 0.8);
  } else {
    state.heading += (rng() - 0.5) * E.wanderRad;
  }
  const step = vw * (E.stepVwMin + rng() * (E.stepVwMax - E.stepVwMin)) * (solo ? 1.35 : 1);
  const dx = Math.cos(state.heading);
  const dy = Math.sin(state.heading);
  const px = -dy;
  const py = dx;
  if (rng() < 0.78) state.side = -state.side;
  const [a0, a1] = solo ? E.spikeSoloVh : E.spikeVh;
  const amp = vh * (a0 + rng() * (a1 - a0)) * state.side;

  const hx = state.hx;
  const hy = state.hy;
  const bx = hx + dx * step;
  const by = hy + dy * step;
  const m1x = hx + dx * step * 0.38;
  const m1y = hy + dy * step * 0.38;
  const tx = hx + dx * step * 0.5 + px * amp;
  const ty = hy + dy * step * 0.5 + py * amp;
  const ox = hx + dx * step * 0.58 - px * amp * 0.16;
  const oy = hy + dy * step * 0.58 - py * amp * 0.16;
  const m2x = hx + dx * step * 0.66;
  const m2y = hy + dy * step * 0.66;

  // Longitud total de la polilínea M h L m1 L t L o L m2 L b — idéntico a lo
  // que devolvería SVGPathElement.getTotalLength() para una serie de
  // comandos "L" (todos tramos rectos, sin curvas), así que lo calculamos
  // en forma cerrada sin necesitar DOM/canvas.
  const pts = [
    [hx, hy],
    [m1x, m1y],
    [tx, ty],
    [ox, oy],
    [m2x, m2y],
    [bx, by],
  ];
  let length = 0;
  for (let i = 1; i < pts.length; i++) {
    length += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  }

  state.hx = bx;
  state.hy = by;

  return {points: pts, length, tx, ty, px: px * state.side, py: py * state.side};
}

function fontSizeFor(text, solo, vw, vh, rng) {
  const len = Math.max(2, text.length);
  const wShare = 0.3; // canvas fijo 16:9 → siempre rama "desktop" del original (vw > vh)
  let fs = Math.min((vw * wShare) / (len * 0.5), solo ? vh * 0.22 : vh * 0.11);
  fs *= 0.85 + rng() * 0.3;
  if (solo) fs *= 1.3;
  return Math.max(vh * 0.045, Math.min(fs, solo ? vh * 0.28 : vh * 0.13));
}

// Réplica 1:1 de updateBpm(): media móvil de los últimos <=7 tiempos de
// palabra. Devuelve null mientras no haya al menos 3 muestras (el original
// deja el texto en "--" hasta entonces).
function computeBpm(recentTimes) {
  if (recentTimes.length < 3) return null;
  const iv = (recentTimes[recentTimes.length - 1] - recentTimes[0]) / (recentTimes.length - 1);
  return Math.max(28, Math.min(220, Math.round(60 / Math.max(0.18, iv))));
}

// buildTimeline() replica el orden EXACTO de consumo de rng() del original:
// por cada palabra, en orden temporal: placeWord() → drawBeat() (heading +
// step + side + amp) → fontSizeFor() (jitter) → rot jitter → cámara (camXT
// jitter, camST jitter, camRotT jitter) — mismo orden que el cuerpo de
// placeWord() en el HTML fuente.
function buildTimeline(C, lyrics, fps) {
  const rng = mulberry32(C.seed);
  const vw = WIDTH;
  const vh = HEIGHT; // canvas fijo 16:9 → siempre rama "landscape" del original
  const E = C.ekg;

  const state = {hx: 0, hy: 0, heading: 0, side: 1};
  const flat = flattenWords(lyrics);

  const WORDS = [];
  const SEGS = [];
  const camEvents = [];
  const beatTimesAll = [];

  for (const raw of flat) {
    const clean = raw.text.replace(/[.,;!?¡¿"']/g, '');
    if (!clean) continue;

    const solo = clean.length >= 6 ? rng() < E.gritoChance : rng() < E.soloChance;
    const beat = drawBeat(state, E, solo, vw, vh, rng);

    const fs = fontSizeFor(clean, solo, vw, vh, rng);
    const rot = (state.heading * 12) / Math.PI;
    const rotDeg = Math.max(-11, Math.min(11, rot + (rng() - 0.5) * 8));

    const wx = beat.tx + beat.px * (fs * 0.85);
    const wy = beat.ty + beat.py * (fs * 0.85);

    const frame = Math.round(raw.t * fps);

    const zr = solo ? E.zoomClose : E.zoomWide;
    const camXT = wx; // vw<vh es siempre falso (16:9 fijo) → sin el jitter +(rng()-0.5)*vw*0.05 del original
    const camYT = wy - vh * 0.02;
    const camST = zr[0] + rng() * (zr[1] - zr[0]);
    const camRotT = (rng() - 0.5) * 2 * E.dutchMax;
    const pulseVal = solo ? 1.7 : 1.0;

    beatTimesAll.push(raw.t);
    if (beatTimesAll.length > 7) beatTimesAll.shift();
    const bpm = computeBpm(beatTimesAll);

    WORDS.push({frame, text: clean, solo, fontSize: fs, rotDeg, x: wx, y: wy, bpm});
    SEGS.push({frame, points: beat.points, length: beat.length});
    camEvents.push({frame, camXT, camYT, camST, camRotT, pulseVal});
  }

  return {WORDS, SEGS, camEvents, finalState: state};
}

// Réplica de la "línea plana" de maybeOutro(): un segmento recto final
// desde la última posición del trazo, en la dirección del heading vigente
// en ese momento, de largo vw*3 — se agrega como un SEG más (isOutro:true,
// dibujado con su propia curva/duración, ver segDrawProgress).
function buildOutroSeg(finalState, outroFrame) {
  const dx = Math.cos(finalState.heading);
  const dy = Math.sin(finalState.heading);
  const bx = finalState.hx + dx * WIDTH * 3;
  const by = finalState.hy + dy * WIDTH * 3;
  const length = Math.hypot(bx - finalState.hx, by - finalState.hy);
  return {
    frame: outroFrame,
    points: [
      [finalState.hx, finalState.hy],
      [bx, by],
    ],
    length,
    isOutro: true,
  };
}

// Simula los 4 ejes de cámara (cada uno con su propia tasa de decaimiento)
// en una sola pasada — mismo principio que simulateCamera() en
// neon-timeline.js, generalizado a N ejes independientes. camS arranca en
// 0.9 (mismo valor inicial que `let camS=0.9` en el original).
function simulateCamera(camEvents, totalFrames) {
  const camXs = new Float64Array(totalFrames + 1);
  const camYs = new Float64Array(totalFrames + 1);
  const camSs = new Float64Array(totalFrames + 1);
  const camRots = new Float64Array(totalFrames + 1);
  let camX = 0;
  let camY = 0;
  let camS = 0.9;
  let camRot = 0;
  let camXT = 0;
  let camYT = 0;
  let camST = 0.9;
  let camRotT = 0;
  let ei = 0;
  for (let f = 0; f <= totalFrames; f++) {
    while (ei < camEvents.length && camEvents[ei].frame === f) {
      camXT = camEvents[ei].camXT;
      camYT = camEvents[ei].camYT;
      camST = camEvents[ei].camST;
      camRotT = camEvents[ei].camRotT;
      ei++;
    }
    camX += (camXT - camX) * CAM_XY_DECAY;
    camY += (camYT - camY) * CAM_XY_DECAY;
    camS += (camST - camS) * CAM_S_DECAY;
    camRot += (camRotT - camRot) * CAM_ROT_DECAY;
    camXs[f] = camX;
    camYs[f] = camY;
    camSs[f] = camS;
    camRots[f] = camRot;
  }
  return {camXs, camYs, camSs, camRots};
}

function computeTimeline(configDb, lyricsData) {
  const CONFIG = configDb.configs.find((c) => c.id === configDb.activeId) || configDb.configs[0];
  const DURATION_SEC = lyricsData.metadata.audio_duration_sec;
  const TOTAL_FRAMES = Math.ceil(DURATION_SEC * FPS);
  const OUTRO_LEAD_FRAMES = Math.round((CONFIG.outro.leadSec || 0) * FPS);
  const OUTRO_FRAME = TOTAL_FRAMES - OUTRO_LEAD_FRAMES;

  const {WORDS, SEGS, camEvents, finalState} = buildTimeline(CONFIG, lyricsData, FPS);
  const {camXs: CAM_XS, camYs: CAM_YS, camSs: CAM_SS, camRots: CAM_ROTS} = simulateCamera(camEvents, TOTAL_FRAMES);

  if (WORDS.length) SEGS.push(buildOutroSeg(finalState, OUTRO_FRAME));

  const PULSE_EVENTS = camEvents.map((ev) => ({frame: ev.frame, pulseVal: ev.pulseVal}));

  return {CONFIG, TOTAL_FRAMES, OUTRO_FRAME, WORDS, SEGS, CAM_XS, CAM_YS, CAM_SS, CAM_ROTS, PULSE_EVENTS};
}

// --- pulso (zoom del stage + flash carmesí): decaimiento multiplicativo
// puro desde el valor que le puso el ÚLTIMO latido — sin objetivo, así que
// no hace falta hornear un array, alcanza con buscar el último evento por
// frame y aplicar el decaimiento en forma cerrada (mismo principio que
// stagePunchScale() en lyrics-impact-timeline.js).
function pulseAt(camEvents, frame, fps) {
  const idx = findLastIdx(camEvents, frame);
  if (idx < 0) return 0;
  const ev = camEvents[idx];
  const ticks = ((frame - ev.frame) / fps) * 60;
  return ev.pulseVal * Math.pow(PULSE_DECAY_PER_TICK, ticks);
}

// --- latido de la palabra (@keyframes sysBeat, 0.24s cubic-bezier(0.1,0.9,0.2,1.3)) ---
// Solo hay paradas explícitas en 0% y 60% para opacity, y solo en 0% para
// transform/filter (100% es implícito = valores de reposo) — aproximamos
// como un único tramo 0→1 en todo el rango de la animación para
// transform/filter (mismo criterio de simplificación que heartbeatScale()
// en lyrics-romantic-timeline.js) y 0→100% acotado a 0.6 para opacity.
const BEAT_EASE = Easing.bezier(0.1, 0.9, 0.2, 1.3);
const BEAT_DUR = 0.24;
function wordBeatStyle(dtSec) {
  if (dtSec >= BEAT_DUR) return {opacity: 1, scale: 1, blur: 0, brightness: 1};
  if (dtSec < 0) return {opacity: 0, scale: 1.7, blur: 4, brightness: 2.4};
  const tFull = BEAT_EASE(Math.max(0, dtSec / BEAT_DUR));
  const tOpacity = BEAT_EASE(Math.min(1, dtSec / (BEAT_DUR * 0.6)));
  return {
    opacity: lerp(0, 1, tOpacity),
    scale: lerp(1.7, 1, tFull),
    blur: lerp(4, 0, tFull),
    brightness: lerp(2.4, 1, tFull),
  };
}

// --- envejecido de la palabra (.w.cold: opacity 1.2s ease, filter 1.2s ease) ---
const COLD_EASE = Easing.ease;
const COLD_DUR = 1.2;
function wordColdStyle(dtSec) {
  const t = COLD_EASE(Math.min(1, Math.max(0, dtSec / COLD_DUR)));
  return {opacity: lerp(1, 0.5, t), brightness: lerp(1, 0.62, t), saturate: lerp(1, 0.65, t)};
}

// --- color del trazo ECG al envejecer (path.old: transición de color 1.4s
// ease) — mismo principio que COLD_EASE en neon-timeline.js.
const SEG_COLD_EASE = Easing.ease;
const SEG_COLD_DUR = 1.4;
const SEG_CORE = [255, 43, 74]; // #FF2B4A
const SEG_OLD = [142, 27, 44]; // #8E1B2C
function segColor(dtOldSec) {
  if (dtOldSec <= 0) return `rgb(${SEG_CORE[0]},${SEG_CORE[1]},${SEG_CORE[2]})`;
  const t = SEG_COLD_EASE(Math.min(1, dtOldSec / SEG_COLD_DUR));
  const r = Math.round(lerp(SEG_CORE[0], SEG_OLD[0], t));
  const g = Math.round(lerp(SEG_CORE[1], SEG_OLD[1], t));
  const b = Math.round(lerp(SEG_CORE[2], SEG_OLD[2], t));
  return `rgb(${r},${g},${b})`;
}

// --- trazado del segmento (stroke-dashoffset): transición LINEAL 0.26s
// para los latidos normales, o 1.6s ease-out para la línea plana del outro
// (maybeOutro() pisa `p.style.transition` justo después de addSeg(), antes
// de que el rAF(rAF()) que dispara el dashoffset:0 llegue a ejecutarse) —
// en ambos casos con ~2 frames de rAF de retardo antes de empezar a
// dibujar. Easing.out(Easing.quad) es la misma aproximación de CSS
// "ease-out" ya usada como COLD_EASE en neon-timeline.js.
const DRAW_DELAY_SEC = 2 / 60;
const NORMAL_DRAW_DUR = 0.26;
const OUTRO_DRAW_DUR = 1.6;
const OUTRO_DRAW_EASE = Easing.out(Easing.quad);
function segDrawProgress(seg, dtSec) {
  const dur = seg.isOutro ? OUTRO_DRAW_DUR : NORMAL_DRAW_DUR;
  const raw = Math.min(1, Math.max(0, (dtSec - DRAW_DELAY_SEC) / dur));
  return seg.isOutro ? OUTRO_DRAW_EASE(raw) : raw;
}

module.exports = {
  FPS,
  WIDTH,
  HEIGHT,
  MAX_VISIBLE_WORDS,
  MAX_VISIBLE_SEGS,
  computeTimeline,
  resolveMediaSrc,
  findLastIdx,
  lerp,
  pulseAt,
  wordBeatStyle,
  wordColdStyle,
  segColor,
  segDrawProgress,
};
