// Cálculo del muro de evidencia / cámara / hilo rojo de HiloRojo — port de
// src/templates/hilo-rojo/index.html (plantilla "EXPEDIENTE": pizarra de
// detective true-crime, la letra es evidencia clavada al muro).
//
// Mecánica del original: cada palabra cantada se "clava" al muro como una
// de 4 piezas de evidencia (recorte mecanografiado `torn`, titular de
// periódico `head`, anotación a marcador `marker`, o sello de goma `stamp`
// — elegida por rng() por palabra, no por cluster). Un hilo rojo con comba
// conecta cada pieza nueva con la anterior (SVG <path> acumulativo — nunca
// se borra). Las piezas se agrupan en "clusters" (columnas/filas del muro)
// que saltan en 4 direcciones ponderadas (`dirWeights`); cada salto de
// cluster (`newCluster()`) también reencuadra la cámara: zoom
// (`camS`/`camST`), ángulo holandés (`camRot`/`camRotT`) y ocasionalmente
// dispara un "whip-pan" (paneo rápido, `whipChance`) que acelera
// temporalmente la velocidad de asentamiento de X/Y. La posición X/Y de la
// cámara (`camX`/`camY`) en cambio se retarget en CADA palabra (sigue la
// última pieza clavada), no solo en los saltos de cluster — son 4 ejes
// independientes con sus propias tasas de decaimiento exponencial, mismo
// principio que simulateCamera() en neon-timeline.js/lyrics-latido-timeline.js,
// generalizado con un evento extra (whip) que cambia la tasa de X/Y en
// forma temporal.
//
// mismo patrón que los demás *-timeline.js: computeTimeline() recibe
// config/lyrics como argumentos y hornea todo de una sola pasada — el
// componente debe memoizarlo con React.useMemo.
const {Easing} = require('remotion');
const {mulberry32, resolveMediaSrc, lerp, findLastIdx} = require('./shared-timeline-utils');

const FPS = 30;
const WIDTH = 1920;
const HEIGHT = 1080;

// Cámara: el original decae camX/camY 0.06/tick (0.16/tick durante un
// whip-pan), camS(zoom) 0.055/tick, camRot(dutch) 0.05/tick (~60fps real).
// A 30fps componemos dos pasos por eje (mismo razonamiento que CAM_DECAY en
// neon-timeline.js).
const CAM_XY_DECAY_NORMAL = 1 - Math.pow(1 - 0.06, 60 / FPS);
const CAM_XY_DECAY_WHIP = 1 - Math.pow(1 - 0.16, 60 / FPS);
const CAM_S_DECAY = 1 - Math.pow(1 - 0.055, 60 / FPS);
const CAM_ROT_DECAY = 1 - Math.pow(1 - 0.05, 60 / FPS);
// whipUntil: 650ms de ventana desde que se dispara el whip-pan.
const WHIP_DURATION_FRAMES = Math.round(0.65 * FPS);

// shake: decae multiplicativamente 0.86/tick (~60fps), sin objetivo — mismo
// principio que PULSE_DECAY_PER_TICK en lyrics-latido-timeline.js. El
// original usa Math.random() (no seedeado) para la dirección del sacudido;
// acá usamos un segundo stream mulberry32 INDEPENDIENTE del stream
// principal de layout (derivado del seed con un XOR) solo para esta
// microvibración — no afecta el orden de rng() que decide dónde se clava
// cada pieza, y hace el render reproducible en vez de depender de
// Math.random() real.
const SHAKE_DECAY_PER_FRAME = Math.pow(0.86, 60 / FPS);

// placed.length > 34 → shift().el.remove() en el original: SOLO se retira
// el papel (recorte/titular/marcador/sello) de las piezas más viejas; la
// chinche y el hilo NUNCA se remueven del DOM (quedan clavados para
// siempre). Por eso ventaneamos el render de PIECES a los últimos 34, pero
// THREADS/pines se renderizan siempre completos (cumulativo, sin ventana).
const MAX_VISIBLE_PIECES = 34;

function flattenWords(lyrics) {
  const out = [];
  for (const seg of lyrics.segments) {
    for (const w of seg.words) out.push({t: w.start, text: w.word.trim()});
  }
  out.sort((a, b) => a.t - b.t);
  return out;
}

const WIDTH_FACTOR = {torn: 0.62, head: 0.52, marker: 0.44, stamp: 0.6};
const MAX_ROT = {torn: 6, head: 4, marker: 8, stamp: 11};

function fontSizeFor(text, solo, vw, vh, rng) {
  const len = Math.max(2, text.length);
  const wShare = 0.3; // canvas fijo 16:9 → siempre rama "desktop" del original (vw > vh)
  let fs = Math.min((vw * wShare) / (len * 0.55), solo ? vh * 0.2 : vh * 0.105);
  fs *= 0.85 + rng() * 0.3;
  if (solo) fs *= 1.3;
  return Math.max(vh * 0.042, Math.min(fs, solo ? vh * 0.26 : vh * 0.12));
}

// Réplica 1:1 de tornPoly(): 6 puntos arriba + 6 puntos abajo = 12 llamadas
// a rng(), MISMO orden que el original.
function tornPoly(rng) {
  const pts = [];
  const seg = 5;
  for (let i = 0; i <= seg; i++) pts.push(`${((i / seg) * 100).toFixed(1)}% ${(rng() * 7).toFixed(1)}%`);
  for (let i = seg; i >= 0; i--) pts.push(`${((i / seg) * 100).toFixed(1)}% ${(100 - rng() * 7).toFixed(1)}%`);
  return `polygon(${pts.join(',')})`;
}

// Réplica 1:1 de sizeDust(): 42 motas x 5 llamadas a rng() (x,y,r,s,a,ph —
// 6 en realidad, ver abajo) = 252 llamadas. sizeDust() corre SÍNCRONO al
// boot, justo DESPUÉS del nextRows() inicial y ANTES de cualquier
// placeWord() — comparte el MISMO stream de rng que el layout del muro, así
// que el orden importa: si esto se llamara después, todas las posiciones
// de las piezas cambiarían.
function seedDust(count, vw, vh, rng) {
  const motes = [];
  for (let i = 0; i < count; i++) {
    motes.push({
      x0: rng() * vw,
      y0: rng() * vh,
      r: 0.6 + rng() * 1.6,
      s: 0.08 + rng() * 0.25,
      a: 0.05 + rng() * 0.16,
      ph: rng() * 6.28,
    });
  }
  return motes;
}

// Réplica 1:1 del algoritmo de placeWord()/newCluster() de index.html
// (MISMO orden de llamadas a rng() que el original) — hornea por
// adelantado en vez de por DOM + rAF.
function buildTimeline(C, lyrics, fps) {
  const rng = mulberry32(C.seed);
  const vw = WIDTH;
  const vh = HEIGHT; // canvas fijo 16:9 → siempre rama "landscape" del original
  const B = C.board;

  let baseX = 0;
  let baseY = 0;
  let rowY = 0;
  let rowIdx = 0;
  let rowsThisCluster;
  const nextRows = () => B.rowsMin + Math.floor(rng() * (B.rowsMax - B.rowsMin + 1));
  rowsThisCluster = nextRows(); // 1ª llamada a rng() — antes que sizeDust(), mismo orden que el original

  const DUST = seedDust(42, vw, vh, rng);

  const PIECES = [];
  const THREADS = [];
  const CAM_XY_EVENTS = [];
  const CAM_SROT_EVENTS = [];
  const WHIP_EVENTS = [];
  const FLASH_EVENTS = [];

  let lastAnchor = null;
  let currentFrame = 0;

  function newCluster(soloArg) {
    const w = B.dirWeights;
    const keys = ['left', 'right', 'up', 'down'];
    let r = rng() * keys.reduce((s, k) => s + w[k], 0);
    let dir = 'left';
    for (const k of keys) {
      r -= w[k];
      if (r < 0) {
        dir = k;
        break;
      }
    }
    const gx = vw * (B.clusterGapVw / 100) * (0.8 + rng() * 0.45);
    const gy = vh * (B.clusterGapVh / 100) * (0.85 + rng() * 0.4);
    if (dir === 'left') {
      baseX -= gx;
      baseY += (rng() - 0.5) * vh * 0.5;
    } else if (dir === 'right') {
      baseX += gx;
      baseY += (rng() - 0.5) * vh * 0.5;
    } else if (dir === 'up') {
      baseY -= gy;
      baseX += (rng() - 0.5) * vw * 0.4;
    } else {
      baseY += gy;
      baseX += (rng() - 0.5) * vw * 0.4;
    }
    rowY = baseY;
    rowIdx = 0;
    rowsThisCluster = nextRows();
    const zr = soloArg ? B.zoomClose : B.zoomWide;
    const camST = (zr[0] + rng() * (zr[1] - zr[0])) * 1; // vw<vh siempre falso en 16:9 fijo → factor 1
    const camRotT = (rng() - 0.5) * 2 * B.dutchMax;
    CAM_SROT_EVENTS.push({frame: currentFrame, camST, camRotT});
    if (rng() < B.whipChance) {
      WHIP_EVENTS.push({frame: currentFrame, untilFrame: currentFrame + WHIP_DURATION_FRAMES});
    }
  }

  for (const raw of flattenWords(lyrics)) {
    const clean = raw.text.replace(/[.,;!?¡¿"']/g, '');
    if (!clean) continue;
    const frame = Math.round(raw.t * fps);
    currentFrame = frame;

    const solo = clean.length >= 6 ? rng() < B.stampSoloChance : rng() < B.soloChance;
    let type = 'torn';
    if (solo) type = 'stamp';
    else if (rng() < B.markerChance) type = 'marker';
    else if (rng() < B.headlineChance) type = 'head';

    if (solo && rowIdx > 0) newCluster(true);

    const fs = fontSizeFor(clean, solo, vw, vh, rng);
    const rotDeg = (rng() - 0.5) * 2 * MAX_ROT[type];
    const clipPath = type === 'torn' ? tornPoly(rng) : null;
    const markUnderline = type === 'head' && rng() < 0.35;

    const wpx = clean.length * fs * WIDTH_FACTOR[type] + fs * (type === 'marker' ? 0.2 : 0.9);
    const hpx = fs * 1.35 + (type === 'marker' ? 0 : fs * 0.4);
    const x = baseX + (rng() - 0.5) * vw * 0.1 - wpx / 2;
    const y = rowY;

    const anchor = {x: x + wpx / 2, y: y + 2};
    if (lastAnchor) {
      const midX = (lastAnchor.x + anchor.x) / 2 + (rng() - 0.5) * 40;
      const sag = Math.hypot(anchor.x - lastAnchor.x, anchor.y - lastAnchor.y) * 0.1 + 18 + rng() * 26;
      const midY = Math.max(lastAnchor.y, anchor.y) + sag;
      THREADS.push({frame, ax: lastAnchor.x, ay: lastAnchor.y, midX, midY, bx: anchor.x, by: anchor.y});
    }
    lastAnchor = anchor;

    const hasPin = type === 'torn' || type === 'head';
    let pinX = 0;
    let pinY = 0;
    if (hasPin) {
      pinX = x + wpx / 2 - 6 + (rng() - 0.5) * 10;
      pinY = y - 5;
    }

    let flash = false;
    if (solo && rng() < B.flashChance) flash = true;

    PIECES.push({
      frame,
      type,
      text: clean,
      fs,
      rotDeg,
      x,
      y,
      wpx,
      hpx,
      clipPath,
      markUnderline,
      hasPin,
      pinX,
      pinY,
      solo,
      shakeMag: solo ? 9 : 4,
      flash,
    });
    if (flash) FLASH_EVENTS.push({frame});

    rowY += hpx + vh * 0.02;
    rowIdx++;
    if (solo || rowIdx >= rowsThisCluster) newCluster(false);

    const camXT = x + wpx / 2 + (rng() - 0.5) * vw * 0.06; // vw<vh siempre falso en 16:9 fijo
    const camYT = y + hpx / 2 - vh * 0.03;
    CAM_XY_EVENTS.push({frame, camXT, camYT});
  }

  return {PIECES, THREADS, DUST, CAM_XY_EVENTS, CAM_SROT_EVENTS, WHIP_EVENTS, FLASH_EVENTS};
}

// Simula los 4 ejes de cámara (x, y, zoom, dutch-tilt) en una sola pasada —
// mismo principio que simulateCamera() en neon-timeline.js/
// lyrics-latido-timeline.js, generalizado con un evento extra (whip) que
// acelera temporalmente la tasa de decaimiento de X/Y (mismo mecanismo que
// `ease = now<whipUntil?0.16:0.06` del original).
function simulateCamera(camXYEvents, camSRotEvents, whipEvents, totalFrames) {
  const camXs = new Float64Array(totalFrames + 1);
  const camYs = new Float64Array(totalFrames + 1);
  const camSs = new Float64Array(totalFrames + 1);
  const camRots = new Float64Array(totalFrames + 1);
  let camX = 0;
  let camY = 0;
  let camXT = 0;
  let camYT = 0;
  let camS = 0.84;
  let camST = 0.84;
  let camRot = 0;
  let camRotT = 0;
  let whipUntilFrame = -1;
  let exi = 0;
  let sri = 0;
  let wi = 0;
  for (let f = 0; f <= totalFrames; f++) {
    while (exi < camXYEvents.length && camXYEvents[exi].frame === f) {
      camXT = camXYEvents[exi].camXT;
      camYT = camXYEvents[exi].camYT;
      exi++;
    }
    while (sri < camSRotEvents.length && camSRotEvents[sri].frame === f) {
      camST = camSRotEvents[sri].camST;
      camRotT = camSRotEvents[sri].camRotT;
      sri++;
    }
    while (wi < whipEvents.length && whipEvents[wi].frame === f) {
      whipUntilFrame = whipEvents[wi].untilFrame;
      wi++;
    }
    const easeXY = f < whipUntilFrame ? CAM_XY_DECAY_WHIP : CAM_XY_DECAY_NORMAL;
    camX += (camXT - camX) * easeXY;
    camY += (camYT - camY) * easeXY;
    camS += (camST - camS) * CAM_S_DECAY;
    camRot += (camRotT - camRot) * CAM_ROT_DECAY;
    camXs[f] = camX;
    camYs[f] = camY;
    camSs[f] = camS;
    camRots[f] = camRot;
  }
  return {camXs, camYs, camSs, camRots};
}

// Sacudida de cámara al clavar cada pieza — stream de rng SEPARADO del
// principal (ver nota de SHAKE_DECAY_PER_FRAME arriba).
function simulateShake(pieces, totalFrames, seed) {
  const shakeXs = new Float64Array(totalFrames + 1);
  const shakeYs = new Float64Array(totalFrames + 1);
  const noiseRng = mulberry32((seed ^ 0x5bd1e995) >>> 0);
  let mag = 0;
  let pi = 0;
  for (let f = 0; f <= totalFrames; f++) {
    while (pi < pieces.length && pieces[pi].frame === f) {
      mag = pieces[pi].shakeMag;
      pi++;
    }
    mag *= SHAKE_DECAY_PER_FRAME;
    shakeXs[f] = (noiseRng() - 0.5) * mag;
    shakeYs[f] = (noiseRng() - 0.5) * mag;
  }
  return {shakeXs, shakeYs};
}

function computeTimeline(configDb, lyricsData) {
  const CONFIG = configDb.configs.find((c) => c.id === configDb.activeId) || configDb.configs[0];
  const DURATION_SEC = lyricsData.metadata.audio_duration_sec;
  const TOTAL_FRAMES = Math.ceil(DURATION_SEC * FPS);
  const OUTRO_LEAD_FRAMES = Math.round((CONFIG.outro.leadSec || 0) * FPS);
  const OUTRO_FRAME = TOTAL_FRAMES - OUTRO_LEAD_FRAMES;

  const {PIECES, THREADS, DUST, CAM_XY_EVENTS, CAM_SROT_EVENTS, WHIP_EVENTS, FLASH_EVENTS} = buildTimeline(
    CONFIG,
    lyricsData,
    FPS
  );
  const {
    camXs: CAM_XS,
    camYs: CAM_YS,
    camSs: CAM_SS,
    camRots: CAM_ROTS,
  } = simulateCamera(CAM_XY_EVENTS, CAM_SROT_EVENTS, WHIP_EVENTS, TOTAL_FRAMES);
  const {shakeXs: SHAKE_XS, shakeYs: SHAKE_YS} = simulateShake(PIECES, TOTAL_FRAMES, CONFIG.seed);

  return {
    CONFIG,
    TOTAL_FRAMES,
    OUTRO_FRAME,
    PIECES,
    THREADS,
    DUST,
    CAM_XS,
    CAM_YS,
    CAM_SS,
    CAM_ROTS,
    SHAKE_XS,
    SHAKE_YS,
    FLASH_EVENTS,
  };
}

// --- "slam" de la pieza al clavarse (@keyframes slam, 0.17s
// cubic-bezier(0.15,0.9,0.3,1.2)) — opacity 0→1 en el primer 60% de la
// duración, scale/blur interpolan en toda la duración hacia el valor de
// reposo (mismo criterio que wordBeatStyle() en lyrics-latido-timeline.js:
// transform/filter en un único tramo completo, opacity acotada a su propia
// fracción). ---
const SLAM_EASE = Easing.bezier(0.15, 0.9, 0.3, 1.2);
const SLAM_DUR = 0.17;
function slamStyle(dtSec) {
  if (dtSec < 0) return {opacity: 0, scale: 1.55, blur: 3};
  if (dtSec >= SLAM_DUR) return {opacity: 1, scale: 1, blur: 0};
  const t = SLAM_EASE(dtSec / SLAM_DUR);
  const opacityT = SLAM_EASE(Math.min(1, dtSec / (SLAM_DUR * 0.6)));
  return {
    opacity: lerp(0, 1, opacityT),
    scale: lerp(1.55, 1, t),
    blur: lerp(3, 0, t),
  };
}

// --- evidencia envejecida (.clip.cold: opacity/filter transition 0.9s
// ease) — se dispara INMEDIATAMENTE en cuanto se clava la SIGUIENTE pieza
// (no hay demora de "oldAfter N piezas" como en otras plantillas: el
// original marca `.cold` a TODAS las piezas anteriores en cada
// placeWord()) — mismo principio que wordColdStyle()/COLD_EASE ya usado en
// el proyecto. ---
const COLD_EASE = Easing.ease;
const COLD_DUR = 0.9;
const COLD_TARGETS = {
  torn: {opacity: 0.68, brightness: 0.62, sepia: 0.4, saturate: 0.75},
  head: {opacity: 0.68, brightness: 0.62, sepia: 0.4, saturate: 0.75},
  marker: {opacity: 0.68, brightness: 0.62, sepia: 0.4, saturate: 0.75},
  stamp: {opacity: 0.55, brightness: 0.6, sepia: 0, saturate: 0.8},
};
function coldStyle(type, dtSec) {
  const target = COLD_TARGETS[type];
  const t = COLD_EASE(Math.min(1, Math.max(0, dtSec / COLD_DUR)));
  return {
    opacity: lerp(1, target.opacity, t),
    brightness: lerp(1, target.brightness, t),
    sepia: lerp(0, target.sepia, t),
    saturate: lerp(1, target.saturate, t),
  };
}

// --- parpadeo eléctrico de la lámpara (@keyframes lampFlick, 9s
// steps(1,end) infinite) — función ESCALONADA (no interpolada), mismo
// principio de tabla de breakpoints que igniteOpacity() en
// neon-timeline.js, pero periódica. ---
const LAMP_PERIOD = 9;
const LAMP_BREAKS = [0, 0.71, 0.72, 0.732, 0.74, 0.748, 0.91, 0.917];
const LAMP_VALS = [1, 1, 0.55, 1, 0.7, 1, 0.8, 1];
function lampFlickerOpacity(tSec) {
  const local = (((tSec % LAMP_PERIOD) + LAMP_PERIOD) % LAMP_PERIOD) / LAMP_PERIOD;
  for (let i = LAMP_BREAKS.length - 1; i >= 0; i--) {
    if (local >= LAMP_BREAKS[i]) return LAMP_VALS[i];
  }
  return 1;
}

// --- flash de cámara al clavar un sello (#flash: opacity salta a 0.26 sin
// transición y decae a 0 en 0.5s ease-out) — mismo principio de "buscar el
// último evento y aplicar la curva en forma cerrada" que pulseAt() en
// lyrics-latido-timeline.js. ---
const FLASH_PEAK = 0.26;
const FLASH_DUR = 0.5;
const FLASH_EASE = Easing.out(Easing.quad);
function flashOpacityAt(flashEvents, frame, fps) {
  const idx = findLastIdx(flashEvents, frame);
  if (idx < 0) return 0;
  const dt = (frame - flashEvents[idx].frame) / fps;
  if (dt <= 0) return FLASH_PEAK;
  const t = FLASH_EASE(Math.min(1, dt / FLASH_DUR));
  return lerp(FLASH_PEAK, 0, t);
}

// --- trazado del hilo (stroke-dashoffset, 0.55s
// cubic-bezier(0.3,0.7,0.3,1)) — longitud aproximada por la distancia recta
// A→B (el original usa getTotalLength() de la curva Q real; la recta es
// una aproximación suficiente para el largo del dash, el trazo visual sigue
// siendo la curva Q exacta). ---
const THREAD_EASE = Easing.bezier(0.3, 0.7, 0.3, 1);
const THREAD_DUR = 0.55;
function threadDrawProgress(dtSec) {
  if (dtSec <= 0) return 0;
  return THREAD_EASE(Math.min(1, dtSec / THREAD_DUR));
}
function threadLength(t) {
  return Math.hypot(t.bx - t.ax, t.by - t.ay) * 1.15;
}

// --- polvo en suspensión (#dust, canvas cerrado no-acumulativo) —
// réplica CERRADA de drawDust(): el original recicla cada mota con
// `y=-3→vh+3` y reasigna `x=rng()*vw` en tiempo real (no reproducible fuera
// de orden, mismo problema que el reciclado de lluvia en
// lyrics-triste-timeline.js) — lo sustituimos por wraparound determinista
// vía módulo en Y, y la deriva en X por una integral cerrada del
// `x += sin(now*0.0004+ph)*0.18` por-tick original (aproximación válida ya
// que el paso de fase por tick es chico) en vez de reasignar x al
// reciclar. ---
const DUST_TICK_MS = 1000 / 60;
const DUST_PHASE_STEP = 0.0004 * DUST_TICK_MS;
const DUST_X_AMP = 0.18;
function dustPosition(mote, frame, fps) {
  const elapsedSec = frame / fps;
  const ticks = elapsedSec * 60;
  const K = 3;
  const rangeY = HEIGHT + 2 * K;
  const distY = mote.s * ticks;
  const y = ((((mote.y0 + K - distY) % rangeY) + rangeY) % rangeY) - K;

  const xDrift = (DUST_X_AMP / DUST_PHASE_STEP) * (Math.cos(mote.ph) - Math.cos(DUST_PHASE_STEP * ticks + mote.ph));
  const x = mote.x0 + xDrift;

  const alpha = mote.a * (0.6 + 0.4 * Math.sin(elapsedSec + mote.ph));
  return {x, y, r: mote.r, alpha};
}

const GRAIN_STEPS = [
  [0, 0],
  ['-2%', '1%'],
  ['1%', '-2%'],
  ['-1%', '2%'],
];

module.exports = {
  FPS,
  WIDTH,
  HEIGHT,
  MAX_VISIBLE_PIECES,
  computeTimeline,
  resolveMediaSrc,
  findLastIdx,
  lerp,
  slamStyle,
  coldStyle,
  lampFlickerOpacity,
  flashOpacityAt,
  threadDrawProgress,
  threadLength,
  dustPosition,
  GRAIN_STEPS,
};
