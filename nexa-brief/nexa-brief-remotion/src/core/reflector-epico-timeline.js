// Cálculo puro (sin hooks de React) de la física de Reflector Épico — port de
// src/templates/reflector-epico/index.html (nexa-brief-server), plantilla
// "AURA // DYNAMIC PLAYER TEMPLATE" (template_id: "subject-spotlight"). El
// original NO tenía seed en absoluto (Math.random() sin semillar, ni
// siquiera declarada en config.json pese a que config_mapper.md SÍ la
// documenta con default 11 — el motor JS simplemente nunca la leyó). Acá
// horneamos TODA la física (piedras/chispas + generador de rayos de
// energía) frame por frame con mulberry32(seed), mismo principio que
// simulateCamera() (neon-timeline.js) y paisaje-vivo-timeline.js, para que
// el render sea 100% determinista y seekable.
//
// Puramente visual/temporal — CONFIRMADO leyendo el HTML fuente completo:
// no hay ninguna referencia a lyrics.json, ni a `word.start`/segments, ni a
// ningún evento sincronizado a letra. El bucle rAF corre en base a
// performance.now() desde que arranca la página, sin relación con el audio
// (el <audio> real del job simplemente se reproduce en paralelo). Tampoco
// hay tarjetas de intro/outro con texto (confirmado: el HTML no declara
// ningún elemento ni bloque para eso — el "intro" es solo el estado inicial
// de las piedras/aura ya animando desde el frame 0, no hay fade-in de texto
// ni tarjeta separada). Por eso computeTimeline() no recibe lyricsData ni
// genera OUTRO_FRAME — coincide con el patrón de ImageBg/MotionBackdrop/
// PaisajeVivo (requires_lyrics=false en niches.json).
//
// Simplificaciones deliberadas frente al HTML original (documentadas para
// quien lea el port):
//  1. Física a ~60 ticks/seg en el original (incrementos fijos por tick de
//     rAF, no por dt real) — igual que CAM_DECAY/TICKS_PER_FRAME de
//     neon-timeline.js/paisaje-vivo-timeline.js: corremos 2 sub-pasos de
//     física por cada frame de salida a 30fps para reproducir la MISMA
//     velocidad visual percibida.
//  2. `driftX` (deriva horizontal senoidal de cada piedra, función CERRADA
//     de `elapsed` + `pulseOffset`, sin estado acumulado) NO se hornea: se
//     recalcula en render-time con `elapsedSec = frame / fps`, igual que el
//     drift de cámara de PaisajeVivo — es más barato que guardarlo por
//     frame y matemáticamente idéntico.
//  3. `fitGiantTitle()` (medición real de `scrollWidth` del DOM en el
//     original, con un loop de shrink hasta caber en el 90% del viewport)
//     se reemplaza por una fórmula de ancho estimado por carácter (mismo
//     principio que `fontSizeFor()` en neon-timeline.js) — se hornea UNA
//     vez en computeTimeline (no depende del frame), evitando depender de
//     layout real del DOM en cada composición.
//  4. El tamaño real de `#aura-canvas` en el original se mide con
//     `getBoundingClientRect()` DESPUÉS de que la imagen del sujeto cargó
//     (por eso el layout final depende del aspect ratio real del PNG). Acá
//     se deriva analíticamente de `subject.w`/`subject.h` del config.json
//     (metadata ya provista por el pipeline de visión) en vez de medir el
//     DOM en vivo — necesario para poder hornear la geometría de los rayos
//     ANTES de montar el componente. Si el PNG real tiene un aspect ratio
//     distinto al declarado en config.subject.w/h, el canvas de aura queda
//     ligeramente desalineado del borde del sujeto — caso a revisar en el
//     config_mapper/vision_extractor si llegara a pasar, no en el motor.
const {Easing} = require('remotion');
const {mulberry32, lerp} = require('./shared-timeline-utils');

const FPS = 30;
const WIDTH = 1920;
const HEIGHT = 1080;
const TICKS_PER_FRAME = 2; // aproxima los ~60Hz de rAF que asumen las constantes de física originales

const EASE_IN_OUT = Easing.bezier(0.42, 0, 0.58, 1); // CSS `ease-in-out` (charLevitate/pulseEnergy)

// --- Piedras/chispas (initStones/drawStones del original) -----------------
// El original SIEMPRE usa `Math.random() * 7 + 3` para el tamaño, sin
// importar `particles.minSize`/`maxSize` del config (esos campos existen en
// el schema de config_mapper.md pero el motor JS nunca los lee) — se
// preserva ese comportamiento real, no lo que el schema promete.
function initStones(rng, width, height, count) {
  const stones = [];
  for (let i = 0; i < count; i++) {
    stones.push({
      x: rng() * width,
      y: rng() * height,
      size: rng() * 7 + 3,
      speedY: -(rng() * 0.5 + 0.1),
      rotation: rng() * Math.PI * 2,
      rotSpeed: (rng() - 0.5) * 0.02,
      pulseOffset: rng() * 100,
    });
  }
  return stones;
}

function stepStone(s, rng, width, height) {
  s.y += s.speedY;
  s.rotation += s.rotSpeed;
  if (s.y < -20) {
    s.y = height + 20;
    s.x = rng() * width;
  }
}

// --- Rayos de energía / relámpagos (updateAndDrawAura del original) -------
function spawnBolt(rng, auraW, auraH, glowColor) {
  const boltStartX = auraW * 0.25 + rng() * (auraW * 0.5);
  const boltStartY = auraH * 0.2 + rng() * (auraH * 0.6);
  const points = [{x: boltStartX, y: boltStartY}];
  const segments = Math.floor(rng() * 5) + 4;
  let cx = boltStartX;
  let cy = boltStartY;
  for (let j = 0; j < segments; j++) {
    cx += (rng() - 0.5) * 45;
    cy -= rng() * 25 + 10;
    points.push({x: cx, y: cy});
  }
  const color = rng() > 0.4 ? glowColor : rng() > 0.5 ? '#bce0ff' : '#ffffff';
  return {points, color, alpha: 1.0, decay: rng() * 0.12 + 0.08, width: rng() * 2.5 + 1};
}

// --- Palabra gigante trasera: aproximación de fitGiantTitle() -------------
// Fórmula empírica (Montserrat 900, uppercase) — mismo principio que
// fontSizeFor() en neon-timeline.js: evita depender de scrollWidth real.
const GIANT_CHAR_WIDTH_RATIO = 0.62;
function fitGiantFontSize(word, vw, vh) {
  let fontSize = Math.min(vw * 0.35, vh * 0.55);
  const maxWidth = vw * 0.9;
  const len = Math.max(1, (word || '').length);
  let safety = 0;
  while (len * fontSize * GIANT_CHAR_WIDTH_RATIO > maxWidth && fontSize > 12 && safety < 150) {
    fontSize -= 4;
    safety++;
  }
  return fontSize;
}

// --- Simulación completa ----------------------------------------------------
// WIDTH_/HEIGHT_ son el lienzo del video completo (particles-canvas, fixed
// inset:0) — el aura-canvas usa su PROPIA resolución interna (derivada del
// tamaño del wrapper del sujeto, ver comentario de cabecera #4), calculada
// acá mismo a partir de subject.w/h.
function computeTimeline(configDb, WIDTH_, HEIGHT_, fps, totalFrames) {
  const width = WIDTH_ || WIDTH;
  const height = HEIGHT_ || HEIGHT;
  const C = configDb;
  const seed = Number.isFinite(C.seed) ? C.seed : 42;
  const rng = mulberry32(seed);

  const pConfig = C.particles || {type: 'stones', color: '#38a0ff', dark: 'rgba(15, 2, 2, 0.9)', count: 25};
  const count = Math.max(0, pConfig.count || 25);
  const glowConfig = C.glow || {color: '#38a0ff', intensity: 0.5};
  const effect = C.effect || 'sparks';

  // Wrapper del sujeto (.character-wrapper { height: 70vh; width: auto }) —
  // ver simplificación #4 arriba.
  const subjectW = (C.subject && C.subject.w) || 595;
  const subjectH = (C.subject && C.subject.h) || 700;
  const wrapperH = height * 0.7;
  const wrapperW = wrapperH * (subjectW / Math.max(1, subjectH));
  // #aura-canvas { top:-15%; left:-50%; width:200%; height:130% } del
  // wrapper, con resolución interna = rect * 1.5 (initAuraCanvas()).
  const auraDisplayW = wrapperW * 2;
  const auraDisplayH = wrapperH * 1.3;
  const auraW = auraDisplayW * 1.5;
  const auraH = auraDisplayH * 1.5;

  // --- init (mismo orden que applyConfiguration -> initStones) ---
  const stones = initStones(rng, width, height, count);

  const STONE_SIZE = new Float32Array(count);
  const STONE_PULSE = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    STONE_SIZE[i] = stones[i].size;
    STONE_PULSE[i] = stones[i].pulseOffset;
  }

  const STONE_X = new Float32Array(count * (totalFrames + 1));
  const STONE_Y = new Float32Array(count * (totalFrames + 1));
  const STONE_ROT = new Float32Array(count * (totalFrames + 1));

  let lightningBolts = [];
  const auraFrames = new Array(totalFrames + 1);

  const totalTicks = (totalFrames + 1) * TICKS_PER_FRAME;
  for (let tick = 0; tick < totalTicks; tick++) {
    // drawStones(elapsed) — actualización de física (el drift horizontal es
    // puramente cosmético de dibujo, se recalcula en render-time, ver
    // simplificación #2).
    for (const s of stones) stepStone(s, rng, width, height);

    // updateAndDrawAura(elapsed) — mismo orden relativo que el original:
    // primero las piedras del tick, después el generador de rayos.
    if (effect !== 'none') {
      if (rng() < 0.25) {
        lightningBolts.push(spawnBolt(rng, auraW, auraH, glowConfig.color));
      }
      for (let i = lightningBolts.length - 1; i >= 0; i--) {
        lightningBolts[i].alpha -= lightningBolts[i].decay;
        if (lightningBolts[i].alpha <= 0) lightningBolts.splice(i, 1);
      }
    }

    if (tick % TICKS_PER_FRAME === TICKS_PER_FRAME - 1) {
      const f = Math.floor(tick / TICKS_PER_FRAME);
      for (let i = 0; i < count; i++) {
        const idx = f * count + i;
        STONE_X[idx] = stones[i].x;
        STONE_Y[idx] = stones[i].y;
        STONE_ROT[idx] = stones[i].rotation;
      }
      auraFrames[f] =
        effect !== 'none'
          ? lightningBolts.map((b) => ({points: b.points, color: b.color, alpha: b.alpha, width: b.width}))
          : [];
    }
  }

  const giantWord = (C.giantWord || 'AURA').toUpperCase();
  const GIANT_FONT_SIZE = fitGiantFontSize(giantWord, width, height);

  return {
    CONFIG: C,
    TOTAL_FRAMES: totalFrames,
    count,
    pType: pConfig.type || 'stones',
    STONE_SIZE,
    STONE_PULSE,
    STONE_X,
    STONE_Y,
    STONE_ROT,
    auraFrames,
    auraDisplayW,
    auraDisplayH,
    auraW,
    auraH,
    wrapperW,
    wrapperH,
    giantWord,
    GIANT_FONT_SIZE,
  };
}

// --- Animaciones CSS triviales (charLevitate/pulseEnergy/energyRise) -----
// Réplicas puras de las @keyframes, evaluadas en render-time con
// elapsedSec = frame / fps (no hace falta hornear: son funciones cerradas
// del tiempo transcurrido, sin estado acumulado entre frames).
function alternateTriangle(elapsedSec, periodSec) {
  const full = 2 * periodSec;
  const pos = ((elapsedSec % full) + full) % full;
  const half = pos / periodSec;
  return half <= 1 ? half : 2 - half; // 0 -> 1 -> 0
}

// charLevitate 4.5s ease-in-out infinite alternate: translateY(-15px) -> translateY(20px)
function levitateY(elapsedSec) {
  const t = alternateTriangle(elapsedSec, 4.5);
  return lerp(-15, 20, EASE_IN_OUT(t));
}

// pulseEnergy 0.3s ease-in-out infinite alternate: scale 0.95->1.1, opacity 0.6->0.9
function pulseEnergy(elapsedSec) {
  const t = EASE_IN_OUT(alternateTriangle(elapsedSec, 0.3));
  return {scale: lerp(0.95, 1.1, t), opacity: lerp(0.6, 0.9, t)};
}

// energyRise 2s linear infinite (sin alternate — reinicia en seco cada
// vuelta), con animation-delay propio por arco (arc-left: 0s, arc-right: 0.6s).
function energyArcStyle(elapsedSec, delaySec) {
  const period = 2;
  const t = (((elapsedSec - delaySec) % period) + period) % period;
  const p = t / period;
  const translateY = lerp(50, -80, p);
  const scaleY = lerp(0.3, 1.3, p);
  const opacity = p <= 0.5 ? lerp(0, 0.9, p / 0.5) : lerp(0.9, 0, (p - 0.5) / 0.5);
  return {translateY, scaleY, opacity};
}

module.exports = {
  FPS,
  WIDTH,
  HEIGHT,
  computeTimeline,
  levitateY,
  pulseEnergy,
  energyArcStyle,
};
