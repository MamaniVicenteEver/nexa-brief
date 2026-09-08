// Cálculo del layout/cámara/bokeh/timeline de LyricsRomantic — port de
// src/templates/lyrics-romantic/index.html (plantilla "ROMÁNTICA", carta
// escrita a mano).
//
// Mecánica del original: la letra se agrupa en LÍNEAS (poema vertical); cada
// línea se "escribe" carácter a carácter en cascada, alternando serif
// itálica y caligrafía script (con "latido" en las líneas de una sola
// palabra en script). Cámara vertical lenta que sigue la línea más nueva.
// Canvas de bokeh cálido flotando detrás.
//
// Mismo patrón que neon-timeline.js: computeTimeline() recibe config/lyrics
// como argumentos y hornea todo lo necesario de una sola pasada — el
// componente debe memoizarlo con React.useMemo.
const {Easing} = require('remotion');
const {mulberry32, resolveMediaSrc, lerp, findLastIdx} = require('./shared-timeline-utils');

const FPS = 30;
const WIDTH = 1920;
const HEIGHT = 1080;
// Cámara: el original decae 0.05 por tick de rAF (~60fps real). A 30fps
// componemos dos pasos para llegar a una velocidad de asentamiento similar
// (mismo razonamiento que CAM_DECAY en neon-timeline.js).
const CAM_DECAY = 1 - Math.pow(1 - 0.05, 60 / FPS);

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

function fontSizeFor(text, words, script, vw, vh, rng) {
  const len = Math.max(2, text.length);
  const base = words <= 1 ? vh * (script ? 0.15 : 0.11) : vh * 0.066;
  const wShare = 0.84; // canvas fijo 16:9 → siempre rama "desktop" del original (vw > vh)
  let fs = Math.min((vw * wShare) / (len * (script ? 0.42 : 0.56)), base);
  fs *= 0.92 + rng() * 0.16;
  return Math.max(vh * 0.04, fs);
}

// Réplica 1:1 de placeRow(): MISMO orden de llamadas a rng() que el
// original (script-chance, side-align-chance [+ L/R opcional], rot,
// font-size jitter) — crítico para reproducir el mismo layout dado el mismo
// seed.
function placeRow(r, L, rowY, vw, vh, rng, fps) {
  const scriptChance = r.words <= 1 ? L.scriptChanceSolo : L.scriptChanceMulti;
  const script = rng() < scriptChance;

  let align = null;
  if (rng() < L.sideAlignChance) align = rng() < 0.5 ? 'L' : 'R';
  const beat = script && r.words <= 1;

  const rotDeg = (rng() - 0.5) * 2 * L.maxTiltDeg;
  const fs = fontSizeFor(r.text, r.words, script, vw, vh, rng);

  const chars = [...r.text];
  const charSpans = chars.map((ch, i) => ({
    ch,
    frame: Math.round(r.t * fps + ((40 + i * L.charStepMs) / 1000) * fps),
  }));

  const height = fs * (script ? 1.3 : 1.15);
  const y = rowY;
  const nextRowY = rowY + height + vh * (L.rowGapVh / 100);

  return {
    frame: Math.round(r.t * fps),
    script,
    align,
    beat,
    rotDeg,
    fontSize: fs,
    text: r.text,
    charSpans,
    y,
    h: height,
    nextRowY,
  };
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

function buildTimeline(C, lyrics, fps) {
  const rng = mulberry32(C.seed);
  const vw = WIDTH;
  const vh = HEIGHT; // canvas fijo 16:9 → siempre rama "landscape" del original
  const L = C.layout;

  // seedBokeh() corre ANTES de placear ninguna fila en el original (se llama
  // justo antes del primer requestAnimationFrame(frame)) — replicar el orden
  // exacto de consumo de rng() importaría si compartiéramos el mismo stream,
  // pero el bokeh usa un stream propio (ver comentario en seedLights) así
  // que el orden entre ambos no afecta el resultado.
  const lights = seedLights(C.bokeh, vw, vh);

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

  return {ROWS, CAM_YS, lights};
}

// seedBokeh(): 6 llamadas a rng() por luz, en el orden x,y,r,v,a,ph. Usamos
// un stream de rng INDEPENDIENTE del de layout (seed derivado) por la misma
// razón que el shake en lyrics-impact-timeline.js: en el original,
// drawBokeh() reutiliza el rng compartido en tiempo real cada vez que una
// luz "recicla" al salir de pantalla — eso ya depende del framerate real del
// navegador y no es reproducible byte a byte, así que aislamos el bokeh en
// su propio stream y reemplazamos el reciclado por una fórmula cerrada
// (ver bokehPosition), sin qconsumir más rng() después del init.
function seedLights(cfg, vw, vh) {
  const rng = mulberry32(((cfg.count * 2654435761) ^ (cfg.tint ? cfg.tint.length : 0) ^ 0x9e3779b9) >>> 0);
  const lights = [];
  for (let i = 0; i < cfg.count; i++) {
    lights.push({
      x0: rng() * vw,
      y0: rng() * vh,
      r: 14 + rng() * 46,
      v: 0.04 + rng() * 0.1,
      a: 0.03 + rng() * 0.06,
      ph: rng() * Math.PI * 2,
    });
  }
  return lights;
}

// Réplica cerrada (closed-form) de drawBokeh(): el original hace
//   b.y -= b.v; b.x += Math.sin(t*0.00022+b.ph)*0.2;
//   if (b.y < -60) { b.y = vh+60; b.x = rng()*vw; }
// por cada tick de rAF (~60fps asumidos, igual que el resto del proyecto).
// - Vertical: movimiento lineal con wraparound → equivalente a un módulo
//   sobre el rango recorrible (vh+120).
// - Horizontal drift: suma de "b.v*sin(...)" por tick ≈ integral de la
//   senoidal dividida por el paso temporal de un tick (16.667ms a 60fps) —
//   forma cerrada, sin necesidad de estado por frame ni de más rng().
// El reciclado horizontal (que en el original vuelve a tirar rng()) se
// omite: aceptable porque es un detalle menor de reposicionamiento X que no
// cambia el carácter del efecto (bokeh flotando), y evita re-consumir rng()
// de forma dependiente del historial de frames (rompería el render fuera de
// orden que exige Remotion/Lambda).
const BOKEH_W = 0.00022; // rad/ms
const BOKEH_A = 0.2; // px por tick
const BOKEH_TICK_MS = 1000 / 60;
function bokehPosition(light, elapsedMs, vh) {
  const range = vh + 120;
  const distY = (light.v * 60 * elapsedMs) / 1000; // px recorridos verticalmente (v es px/tick a 60fps)
  let y = vh + 60 - (((vh + 60 - light.y0 + distY) % range) + range) % range;
  const driftAmp = BOKEH_A / (BOKEH_W * BOKEH_TICK_MS);
  const x = light.x0 + driftAmp * (Math.cos(light.ph) - Math.cos(BOKEH_W * elapsedMs + light.ph));
  return {x, y};
}

function computeTimeline(configDb, lyricsData) {
  const CONFIG = configDb.configs.find((c) => c.id === configDb.activeId) || configDb.configs[0];
  const DURATION_SEC = lyricsData.metadata.audio_duration_sec;
  const TOTAL_FRAMES = Math.ceil(DURATION_SEC * FPS);
  const OUTRO_LEAD_FRAMES = Math.round((CONFIG.outro.leadSec || 0) * FPS);
  const OUTRO_FRAME = TOTAL_FRAMES - OUTRO_LEAD_FRAMES;

  const {ROWS, CAM_YS, lights} = buildTimeline(CONFIG, lyricsData, FPS);

  return {CONFIG, TOTAL_FRAMES, OUTRO_FRAME, ROWS, CAM_YS, lights};
}

// Réplica de la animación heartbeat (1.6s ease, delay 0.35s, 1 sola vez) vía
// breakpoints — mismo principio que igniteOpacity() en neon-timeline.js.
const HEART_BREAKS = [0, 0.14, 0.28, 0.42, 0.6, 1];
const HEART_VALS = [1, 1.045, 1, 1.03, 1, 1];
function heartbeatScale(dtSec) {
  const delay = 0.35;
  const dur = 1.6;
  const f = (dtSec - delay) / dur;
  if (f < 0 || f > 1) return 1;
  for (let i = HEART_BREAKS.length - 2; i >= 0; i--) {
    if (f >= HEART_BREAKS[i]) {
      const t0 = HEART_BREAKS[i];
      const t1 = HEART_BREAKS[i + 1];
      const v0 = HEART_VALS[i];
      const v1 = HEART_VALS[i + 1];
      const localT = (f - t0) / (t1 - t0);
      return lerp(v0, v1, localT);
    }
  }
  return 1;
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
  bokehPosition,
  heartbeatScale,
  GRAIN_STEPS,
  BREATH_EASE,
};
