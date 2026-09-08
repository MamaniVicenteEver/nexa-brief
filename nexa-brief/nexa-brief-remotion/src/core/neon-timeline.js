// Cálculo del layout/cámara/timeline de NeonLetras — extraído para que tanto
// la composición con fondo imagen (NeonLetras.js) como la de fondo video
// (NeonLetrasVideo.js) compartan exactamente la misma matemática (mismo
// seed, mismo resultado de palabras/cámara) sin duplicar ~250 líneas.
//
// computeTimeline() recibe config/lyrics como argumentos (en vez de
// require()arlos a nivel de módulo) porque cada render ahora trae su propio
// config.json/lyrics.json vía props (job de Python), no un único par fijo
// horneado en el bundle. Los componentes deben memoizar el resultado
// (React.useMemo) ya que esto recorre todas las palabras + simula la cámara
// frame por frame — recalcularlo en cada frame del render sería carísimo.
const {Easing} = require('remotion');
const {mulberry32, resolveMediaSrc, lerp, findLastIdx} = require('./shared-timeline-utils');

const FPS = 30;
const WIDTH = 1920;
const HEIGHT = 1080;
// Cámara: el original decae 0.055 por tick de rAF (~60fps real). A 30fps
// componemos dos pasos para llegar a una velocidad de asentamiento similar.
const CAM_DECAY = 1 - Math.pow(1 - 0.055, 60 / FPS);

function flattenWords(lyrics) {
  const out = [];
  for (const seg of lyrics.segments) {
    for (const w of seg.words) out.push({t: w.start, text: w.word.trim()});
  }
  out.sort((a, b) => a.t - b.t);
  return out;
}

// Réplica 1:1 del algoritmo de test/index.html (mismo orden de llamadas a
// rng() que el original) para que el layout sea idéntico al de la página
// interactiva, pero calculado por adelantado en vez de por DOM + rAF.
function buildTimeline(C, lyrics, fps) {
  const rng = mulberry32(C.seed);
  const vw = WIDTH;
  const vh = HEIGHT; // canvas fijo 16:9 → siempre rama "landscape" del original
  const L = C.layout;

  let baseX = 0;
  let baseY = 0;
  let rowY = 0;
  let rowIdx = 0;
  let rowsThisCol = 0;

  const nextRowsPerCol = () => L.rowsMin + Math.floor(rng() * (L.rowsMax - L.rowsMin + 1));
  rowsThisCol = nextRowsPerCol();

  function pickDir() {
    const w = L.dirWeights;
    const r = rng() * (w.left + w.down + w.up);
    if (r < w.left) return 'left';
    if (r < w.left + w.down) return 'down';
    return 'up';
  }

  function newColumn() {
    const dir = pickDir();
    if (dir === 'left') {
      baseX -= vw * (L.colGapVw / 100) * (0.85 + rng() * 0.4);
      baseY += (rng() - 0.5) * vh * 0.22;
    } else if (dir === 'down') {
      baseY += vh * (L.colGapVh / 100) * (0.9 + rng() * 0.35);
      baseX += (rng() - 0.5) * vw * 0.3;
    } else {
      baseY -= vh * (L.colGapVh / 100) * (0.9 + rng() * 0.35);
      baseX += (rng() - 0.5) * vw * 0.3;
    }
    rowY = baseY;
    rowIdx = 0;
    rowsThisCol = nextRowsPerCol();
  }

  function fontSizeFor(text, solo) {
    const len = Math.max(2, text.length);
    const wShare = 0.3; // rama desktop (vw > vh) del original
    let fs = Math.min((vw * wShare) / (len * 0.52), solo ? vh * 0.26 : vh * 0.125);
    fs *= 0.88 + rng() * 0.28;
    if (solo) fs *= 1.35;
    return Math.max(vh * 0.05, Math.min(fs, solo ? vh * 0.3 : vh * 0.14));
  }

  const placedWords = [];
  const camEvents = [];

  for (const raw of flattenWords(lyrics)) {
    const clean = raw.text.replace(/[.,;!?¡¿"']/g, '');
    if (!clean) continue;

    const solo = clean.length >= 6 ? rng() < 0.55 : rng() < L.soloChance;
    const vertical = !solo && rng() < L.verticalChance && clean.length <= 6;
    if (solo && rowIdx > 0) newColumn();

    const outline = rng() > L.tubeChance;
    const fs = fontSizeFor(clean, solo);

    const stair = rowIdx * vw * (L.stairVw / 100) + (rng() - 0.5) * vw * 0.015;
    const x = baseX + stair;
    const y = rowY;

    const width = vertical ? fs * 1.1 : clean.length * fs * (outline ? 0.62 : 0.72);
    const height = vertical ? clean.length * fs * 0.8 : fs;
    rowY += height * 1.12 + vh * 0.02;

    const frame = Math.round(raw.t * fps);
    placedWords.push({frame, text: clean, x, y, w: width, h: height, fontSize: fs, outline, vertical});

    const cx = 0.42 + rng() * 0.1;
    const camTX = x + width / 2 - vw * cx;
    const camTY = y + height / 2 - vh * (0.4 + rng() * 0.12);
    camEvents.push({frame, camTX, camTY});

    rowIdx++;
    if (solo || rowIdx >= rowsThisCol) newColumn();
  }

  return {placedWords, camEvents};
}

function simulateCamera(camEvents, totalFrames, decay) {
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
    camX += (camTX - camX) * decay;
    camY += (camTY - camY) * decay;
    camXs[f] = camX;
    camYs[f] = camY;
  }
  return {camXs, camYs};
}

// Reemplaza el bloque que antes se calculaba una vez al cargar el módulo
// (cuando config.json/lyrics.json eran fijos). Ahora cada render trae su
// propio config/lyrics vía props, así que esto se llama por composición
// (memoizado con React.useMemo en el componente, no en cada frame).
function computeTimeline(configDb, lyricsData) {
  const CONFIG = configDb.configs.find((c) => c.id === configDb.activeId) || configDb.configs[0];
  const DURATION_SEC = lyricsData.metadata.audio_duration_sec;
  const TOTAL_FRAMES = Math.ceil(DURATION_SEC * FPS);
  const OUTRO_LEAD_FRAMES = Math.round((CONFIG.outro.leadSec || 0) * FPS);
  const OUTRO_FRAME = TOTAL_FRAMES - OUTRO_LEAD_FRAMES;

  const {placedWords: WORDS, camEvents: CAM_EVENTS} = buildTimeline(CONFIG, lyricsData, FPS);
  const {camXs: CAM_XS, camYs: CAM_YS} = simulateCamera(CAM_EVENTS, TOTAL_FRAMES, CAM_DECAY);

  return {CONFIG, TOTAL_FRAMES, OUTRO_FRAME, WORDS, CAM_XS, CAM_YS};
}

// --- flicker de encendido (steps(1,end), réplica de @keyframes ignite) ---
const IGNITE_BREAKS = [0, 0.06, 0.1, 0.16, 0.21, 0.27, 0.34, 0.4];
const IGNITE_VALS = [0, 1, 0.25, 1, 0.35, 1, 0.85, 1];
function igniteOpacity(dtSec) {
  const f = dtSec / 0.55;
  if (f < 0) return 0;
  if (f >= 0.4) return 1;
  for (let i = IGNITE_BREAKS.length - 1; i >= 0; i--) {
    if (f >= IGNITE_BREAKS[i]) return IGNITE_VALS[i];
  }
  return 0;
}

function tubeGlow(N, s) {
  return `0 0 ${s * 0.15}px ${N.core}, 0 0 ${s * 0.35}px ${N.glow}, 0 0 ${s * 0.9}px ${N.glow}, 0 0 ${s * 1.8}px ${N.deep}, 0 0 ${s * 3}px ${N.deep}`;
}

function neonDropShadow(N, fs) {
  return `drop-shadow(0 0 ${Math.max(2, fs * 0.05)}px ${N.core}) drop-shadow(0 0 ${fs * 0.16}px ${N.glow}) drop-shadow(0 0 ${fs * 0.4}px ${N.deep})`;
}

const GRAIN_STEPS = [
  [0, 0],
  ['-2%', '1%'],
  ['1%', '-2%'],
  ['-1%', '2%'],
];

const COLD_EASE = Easing.out(Easing.quad);

module.exports = {
  FPS,
  WIDTH,
  HEIGHT,
  computeTimeline,
  resolveMediaSrc,
  findLastIdx,
  igniteOpacity,
  lerp,
  tubeGlow,
  neonDropShadow,
  GRAIN_STEPS,
  COLD_EASE,
};
