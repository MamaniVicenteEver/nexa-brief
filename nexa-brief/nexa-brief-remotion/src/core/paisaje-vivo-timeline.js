// Cálculo puro (sin hooks de React) de la física de Paisaje Vivo — port de
// src/templates/paisaje-vivo/index.html (nexa-brief-server). El original NO
// tenía seed (Math.random() sin semillar) y leía el bajo del audio en vivo
// vía AnalyserNode.getByteFrequencyData(); acá horneamos TODO frame por
// frame con mulberry32(seed) + una curva de bajo ya calculada (offline, con
// @remotion/media-utils en el componente) para que el render sea 100%
// determinista y seekable, igual que neon-timeline.js/simulateCamera().
//
// Simplificaciones deliberadas frente al HTML original (documentadas acá
// para que quien lea el port entienda por qué):
//  1. Repulsión de partículas por mouse/touch: eliminada por completo (no
//     aplica a un render headless, según el plan de porting).
//  2. Físicas ajustadas a ~60 ticks/seg en el original (incrementos fijos
//     por tick de rAF, no por dt real) — igual que CAM_DECAY en
//     neon-timeline.js, corremos 2 sub-pasos de física por cada frame de
//     salida a 30fps para reproducir la MISMA velocidad visual percibida.
//  3. `CloudDrift`: el original regenera la forma completa (array de
//     "burbujas" del gradiente) cada vez que una nube sale de pantalla y
//     reaparece. Dado que a la velocidad configurada (0.04–0.14px/tick) una
//     nube tarda varios miles de frames en cruzar la pantalla completa, es
//     virtualmente imposible que esto ocurra dentro de la duración típica
//     de un video (<= 60-90s ≈ 1800-2700 frames) — así que horneamos la
//     forma UNA sola vez por nube y solo animamos su posición/fase de onda,
//     sin re-generar bubbles. Visualmente indistinguible en la práctica
//     (opacidad de nubes es 0.04–0.09, capa muy sutil de fondo).
//  4. `fitHaikuToViewport()` (red de seguridad de medición DOM real del
//     original, para que el bloque de texto nunca se salga de pantalla) no
//     se replica: en Remotion el canvas es de tamaño fijo (1920x1080) y el
//     config_mapper ya elige xPct/yPct/fontMin/fontMax pensados para caber
//     en la "calm zone" detectada por visión — no hay medición de layout
//     disponible en bake-time. Si algún config produce texto que se sale,
//     es un caso a revisar en el config_mapper, no en el motor de render.
const {mulberry32} = require('./shared-timeline-utils');

const FPS = 30;
const WIDTH = 1920;
const HEIGHT = 1080;
const TICKS_PER_FRAME = 2; // aproxima los ~60Hz de rAF que asumen las constantes de física originales

function computeCache(physics) {
  return {
    minSize: Math.min(physics.minSize, physics.maxSize),
    maxSize: Math.max(physics.minSize, physics.maxSize),
    minWind: Math.min(physics.minWind, physics.maxWind),
    maxWind: Math.max(physics.minWind, physics.maxWind),
    tiltRad: (physics.staticTilt * Math.PI) / 180,
  };
}

// --- Petal ------------------------------------------------------------
function resetPetal(p, rng, width, height, physics, cache, initOnScreen) {
  p.paletteIndex = Math.floor(rng() * 5);
  const baseSize = cache.minSize + rng() * (cache.maxSize - cache.minSize);
  if (p.layer === 0) {
    p.width = baseSize * 0.45;
    p.opacity = 0.2 + rng() * 0.3;
    p.speedModifier = 0.4;
  } else if (p.layer === 2) {
    p.width = baseSize * 2.3;
    p.opacity = 0.45 + rng() * 0.3;
    p.speedModifier = 1.95;
  } else {
    p.width = baseSize;
    p.opacity = 0.75 + rng() * 0.25;
    p.speedModifier = 1.0;
  }
  p.height = p.width;
  const centerY = height * physics.emitterY;
  const spreadHeight = height * physics.emitterSpread;
  p.y = centerY - spreadHeight / 2 + rng() * spreadHeight;
  p.x = initOnScreen
    ? rng() * width
    : physics.direction === -1
    ? width + p.width + rng() * width
    : -p.width - rng() * width;
  const sizeFactor = (p.width - cache.minSize) / (cache.maxSize - cache.minSize || 1);
  p.windFactor = Math.max(0.15, Math.min(1, 1 - (sizeFactor * 0.45 + rng() * 0.4))) * p.speedModifier;
  p.vx = 0;
  p.vy = 0;
  p.waveOffset = rng() * Math.PI * 2;
  p.angleZ = rng() * Math.PI * 2;
  p.spinZ = (rng() - 0.5) * physics.rotationSpeed;
  p.angleX = 0;
  p.angleY = 0;
  p.spinX = (rng() - 0.5) * 0.1;
  p.spinY = (rng() - 0.5) * 0.1;
}

function makePetal(rng, width, height, physics, cache) {
  const layer = rng() < 0.25 ? 0 : rng() < 0.18 ? 2 : 1;
  const p = {layer};
  resetPetal(p, rng, width, height, physics, cache, false);
  // Réplica de initEntities(): además del reset "fuera de pantalla" normal,
  // se agrega dispersión extra en X para que la escena arranque poblada.
  p.x += rng() * width * 1.8;
  return p;
}

function stepPetal(p, rng, width, height, physics, cache, windVelocity, smoothedBass) {
  const targetSpeed = (windVelocity + smoothedBass * 4.0) * p.windFactor;
  p.vx += (targetSpeed - p.vx) * 0.06;
  p.x += p.vx * physics.direction;

  p.vy += physics.gravity * 0.05 * (1.4 - p.windFactor / p.speedModifier) * (1.0 + smoothedBass * 0.7) * p.speedModifier;
  p.vy += Math.sin(p.x * 0.009 * physics.direction + p.waveOffset) * (physics.turbulence + smoothedBass * 1.0) * 0.05 * p.speedModifier;
  p.vy *= 0.98;
  p.y += p.vy;

  const spinMult = 1.0 + smoothedBass * 2.5;
  p.angleZ += (p.spinZ + p.vx * 0.0012) * spinMult;
  p.angleX += p.spinX * physics.tumbleStrength * spinMult;
  p.angleY += p.spinY * physics.tumbleStrength * spinMult;

  if (
    (physics.direction === -1 && p.x < -150) ||
    (physics.direction === 1 && p.x > width + 150) ||
    p.y > height + 150 ||
    p.y < -150
  ) {
    resetPetal(p, rng, width, height, physics, cache, false);
  }
}

// --- CloudDrift (ver simplificación #3 arriba: forma horneada una vez) --
function makeCloud(rng, width, height) {
  const c = {};
  c.width = 200 + rng() * 180;
  c.height = 60 + rng() * 50;
  c.baseY = height * 0.06 + rng() * (height * 0.32);
  c.x = rng() * width;
  c.speed = 0.04 + rng() * 0.1;
  c.opacity = 0.04 + rng() * 0.05;
  c.waveAmplitude = 6 + rng() * 12;
  c.wavePhase = rng() * Math.PI * 2;
  c.waveSpeed = 0.0015 + rng() * 0.003;
  c.bubbles = [];
  const n = 4 + Math.floor(rng() * 5);
  for (let i = 0; i < n; i++) {
    c.bubbles.push({
      offsetX: (rng() - 0.5) * c.width * 0.7,
      offsetY: (rng() - 0.4) * c.height * 0.5,
      radiusX: (0.35 + rng() * 0.5) * c.width * 0.5,
      radiusY: (0.35 + rng() * 0.5) * c.height * 0.6,
      opacityMult: 0.5 + rng() * 0.5,
    });
  }
  return c;
}

function stepCloud(c, width) {
  c.x -= c.speed;
  c.wavePhase += c.waveSpeed;
  if (c.x < -c.width * 1.6) {
    // Simplificación: wrap solo de posición/fase, forma/opacidad se conservan.
    c.x = width + c.width;
  }
}

// --- FogParticle --------------------------------------------------------
function resetFog(f, rng, width, height, initOnScreen) {
  f.radius = 160 + rng() * 160;
  f.y = height * 0.28 + rng() * (height * 0.5);
  f.x = initOnScreen ? rng() * width : width + f.radius;
  f.speed = 0.1 + rng() * 0.25;
  f.opacity = 0.04 + rng() * 0.08;
}

function makeFog(rng, width, height) {
  const f = {};
  resetFog(f, rng, width, height, true);
  return f;
}

function stepFog(f, rng, width, height, smoothedBass) {
  f.x -= f.speed * (1.0 + smoothedBass * 2.0);
  if (f.x < -f.radius) resetFog(f, rng, width, height, false);
}

// --- Crane (grulla) ------------------------------------------------------
function resetCrane(c, rng, width, height) {
  c.x = -60;
  c.y = height * 0.08 + rng() * (height * 0.35);
  c.size = 11 + rng() * 13;
  c.speedX = 0.65 + rng() * 0.75;
  c.speedY = -0.04 - rng() * 0.07;
  c.wingPhase = rng() * Math.PI * 2;
  c.wingSpeed = 0.08 + rng() * 0.05;
  c.opacity = 0;
}

function makeInitialCrane(rng, width, height) {
  const c = {};
  resetCrane(c, rng, width, height);
  // initEntities(): las grullas iniciales arrancan ya en vuelo, no en x=-60.
  c.x = rng() * width * 0.8;
  c.opacity = 0.4 + rng() * 0.3;
  return c;
}

// Devuelve true si la grulla debe "desaparecer" (removida del pool).
function stepCrane(c, width, smoothedBass) {
  c.x += c.speedX;
  c.y += c.speedY;
  const trebleFactor = 1.0 + smoothedBass * 1.5; // isPlaying siempre true acá (audio real garantizado)
  c.wingPhase += c.wingSpeed * trebleFactor;
  if (c.x < 180) c.opacity += 0.015;
  else if (c.x > width - 220) c.opacity -= 0.01;
  c.opacity = Math.max(0, Math.min(0.75, c.opacity));
  return c.x > width + 60 || c.y < -60;
}

// --- Firefly (luciérnaga) -------------------------------------------------
function resetFirefly(f, rng, width, height, randomY) {
  f.x = rng() * width;
  f.y = randomY ? rng() * height : height + 10;
  f.size = 1.6 + rng() * 3.2;
  f.speedX = (rng() - 0.5) * 0.4;
  f.speedY = -(0.15 + rng() * 0.35);
  f.noisePhase = rng() * 100;
  f.glow = 0;
  f.flashTimer = rng() * 90;
  f.flashDuration = 0;
  f.opacity = 0;
}

function makeFirefly(rng, width, height) {
  const f = {};
  resetFirefly(f, rng, width, height, true);
  return f;
}

function stepFirefly(f, rng, width, height) {
  f.noisePhase += 0.01;
  f.x += Math.sin(f.noisePhase * 2.2) * 0.28 + f.speedX;
  f.y += f.speedY;

  if (f.flashDuration > 0) {
    f.flashDuration -= 1;
    f.glow = Math.min(1, f.glow + 0.15);
  } else {
    f.glow = Math.max(0, f.glow - 0.035);
    f.flashTimer -= 1;
    if (f.flashTimer <= 0) {
      f.flashDuration = 18 + rng() * 22;
      f.flashTimer = 60 + rng() * 140;
    }
  }
  f.opacity = 0.12 + f.glow * 0.75;

  if (f.y < -10 || f.x < -10 || f.x > width + 10) {
    resetFirefly(f, rng, width, height, false);
  }
}

// --- ShootingStar ---------------------------------------------------------
function resetStar(s, rng, width, height) {
  s.x = rng() * (width * 0.6);
  s.y = rng() * (height * 0.25);
  s.length = 80 + rng() * 120;
  s.speed = 12 + rng() * 8;
  s.dx = s.speed;
  s.dy = s.speed * 0.35;
  s.opacity = 1.0;
  s.active = false;
}

function stepStar(s) {
  if (!s.active) return;
  s.x += s.dx;
  s.y += s.dy;
  s.opacity -= 0.025;
  if (s.opacity <= 0) s.active = false;
}

// --- Simulación completa --------------------------------------------------
// audioBassCurve: array (largo TOTAL_FRAMES+1) con el valor de "bajo" (0..1)
// promediado de las 6 bandas más graves, YA muestreado por frame de salida
// (30fps) por el componente vía useAudioData()+visualizeAudio(). Cada
// sub-paso de física dentro de un mismo frame de salida reusa el mismo valor
// (no hay resolución de sub-frame disponible desde media-utils) — es una
// simplificación menor: el filtro de suavizado (smoothedBass) igual converge
// correctamente porque se sigue aplicando una vez por sub-paso.
function computeTimeline(configDb, audioBassCurve, WIDTH_, HEIGHT_, fps, totalFrames) {
  const width = WIDTH_ || WIDTH;
  const height = HEIGHT_ || HEIGHT;
  const C = configDb;
  const physics = C.physics;
  const birdsCfg = C.birds;
  const cache = computeCache(physics);
  // Seed nueva (no existía en el HTML original, que usaba Math.random() sin
  // semillar) — ver comentario de cabecera. Default estable si el config.json
  // todavía no la trae (compat hacia atrás con configs ya generados).
  const rng = mulberry32(Number.isFinite(C.seed) ? C.seed : 1);

  // --- inicialización (misma secuencia que initEntities()) ---
  const petals = [];
  for (let i = 0; i < physics.petalCount; i++) petals.push(makePetal(rng, width, height, physics, cache));

  const fogs = [];
  for (let i = 0; i < physics.fogCount; i++) fogs.push(makeFog(rng, width, height));

  const clouds = [];
  for (let i = 0; i < physics.cloudCount; i++) clouds.push(makeCloud(rng, width, height));

  const fireflies = [];
  if (physics.fireflyEnabled) {
    for (let i = 0; i < physics.fireflyCount; i++) fireflies.push(makeFirefly(rng, width, height));
  }

  const star = {};
  resetStar(star, rng, width, height);

  const maxBirds = Math.max(1, birdsCfg.max);
  const birdSlots = new Array(maxBirds).fill(null);
  const initialBirdCount = Math.min(3, maxBirds);
  for (let i = 0; i < initialBirdCount; i++) birdSlots[i] = makeInitialCrane(rng, width, height);

  // --- arrays de salida, uno por frame de salida ---
  const frames = new Array(totalFrames + 1);
  let windCycle = 0;

  const totalTicks = (totalFrames + 1) * TICKS_PER_FRAME;
  // smoothedBass es un filtro de un solo polo con estado propio (no forma
  // parte de ninguna entidad) — se mantiene como variable de closure.
  let smoothed = 0;
  for (let tick = 0; tick < totalTicks; tick++) {
    const frameIdx = Math.floor(tick / TICKS_PER_FRAME);
    const rawBass = audioBassCurve && frameIdx < audioBassCurve.length ? audioBassCurve[frameIdx] : 0;
    smoothed += (rawBass - smoothed) * 0.1;

    windCycle += 0.0035;
    const baseWind = cache.minWind + (cache.maxWind - cache.minWind) * (Math.sin(windCycle) * Math.cos(windCycle * 0.5) * 0.5 + 0.5);

    for (const p of petals) stepPetal(p, rng, width, height, physics, cache, baseWind, smoothed);
    for (const c of clouds) stepCloud(c, width);
    for (const f of fogs) stepFog(f, rng, width, height, smoothed);

    // grullas: spawn probabilístico + física + remoción/reset
    let aliveCount = 0;
    for (let i = 0; i < maxBirds; i++) if (birdSlots[i]) aliveCount++;
    if (rng() < birdsCfg.chance && aliveCount < maxBirds) {
      const slot = birdSlots.indexOf(null);
      if (slot !== -1) {
        const nc = {};
        resetCrane(nc, rng, width, height);
        birdSlots[slot] = nc;
        aliveCount++;
      }
    }
    for (let i = 0; i < maxBirds; i++) {
      const c = birdSlots[i];
      if (!c) continue;
      const exited = stepCrane(c, width, smoothed);
      if (exited) {
        if (aliveCount > 1) {
          birdSlots[i] = null;
          aliveCount--;
        } else {
          resetCrane(c, rng, width, height);
        }
      }
    }

    if (physics.fireflyEnabled) {
      for (const f of fireflies) stepFirefly(f, rng, width, height);
    }

    if (rng() < 0.0018 && !star.active) {
      resetStar(star, rng, width, height);
      star.active = true;
    }
    stepStar(star);

    if (tick % TICKS_PER_FRAME === TICKS_PER_FRAME - 1) {
      frames[frameIdx] = {
        petals: petals.map((p) => ({
          x: p.x,
          y: p.y,
          angleX: p.angleX,
          angleY: p.angleY,
          angleZ: p.angleZ,
          width: p.width,
          height: p.height,
          opacity: p.opacity,
          paletteIndex: p.paletteIndex,
          layer: p.layer,
        })),
        clouds: clouds.map((c) => ({
          x: c.x,
          y: c.baseY + Math.sin(c.wavePhase) * c.waveAmplitude,
          opacity: c.opacity,
          bubbles: c.bubbles,
        })),
        fogs: fogs.map((f) => ({x: f.x, y: f.y, opacity: f.opacity, radius: f.radius})),
        birds: birdSlots.filter(Boolean).map((c) => ({x: c.x, y: c.y, size: c.size, opacity: c.opacity, wingPhase: c.wingPhase})),
        fireflies: physics.fireflyEnabled
          ? fireflies.map((f) => ({x: f.x, y: f.y, size: f.size, opacity: f.opacity, glow: f.glow}))
          : [],
        star: star.active
          ? {x: star.x, y: star.y, dx: star.dx, dy: star.dy, length: star.length, opacity: star.opacity}
          : null,
        smoothedBass: smoothed,
      };
    }
  }

  return {CONFIG: C, TOTAL_FRAMES: totalFrames, cache, frames};
}

// rotateVector: réplica exacta de la matemática usada por Petal.draw() en el
// original, para orientar cada pétalo en 3D (Z -> Y -> X) y proyectarlo a
// una matriz 2x2 de transformación de canvas. Se llama en render-time (por
// frame, por pétalo) en vez de hornearse: es trigonometría barata y evita
// guardar 4 floats extra por pétalo por frame.
function rotateVector(x, y, z, ax, ay, az) {
  let cos = Math.cos(az);
  let sin = Math.sin(az);
  const x1 = x * cos - y * sin;
  const y1 = x * sin + y * cos;
  const z1 = z;
  cos = Math.cos(ay);
  sin = Math.sin(ay);
  const x2 = x1 * cos + z1 * sin;
  const y2 = y1;
  const z2 = -x1 * sin + z1 * cos;
  cos = Math.cos(ax);
  sin = Math.sin(ax);
  return {
    x: x2,
    y: y2 * cos - z2 * sin,
    z: y2 * sin + z2 * cos,
  };
}

// --- Haiku: cascada de color/sombra/escala por carácter --------------------
// Réplica pura (sin setTimeout) de updateHaikuColors() del original. Timeline
// en ms desde que arranca la animación (arranca a los 1200ms, igual que el
// setTimeout(updateHaikuColors, 1200) original). Documentado en detalle en
// el comentario de cabecera de este módulo.
const HAIKU_START_MS = 1200;
const HAIKU_STEP_MS = 160;
const HAIKU_HOLD_MS = 3200;

function haikuCharStyle(elapsedMs, charIndex, totalChars, textCycle) {
  const defaultStyle = {color: 'rgba(255,180,150,0.45)', textShadow: 'none', scale: 1, translateY: 0};
  if (totalChars <= 0 || elapsedMs < HAIKU_START_MS) return defaultStyle;

  const t2 = elapsedMs - HAIKU_START_MS;
  const period = totalChars * HAIKU_STEP_MS + HAIKU_HOLD_MS;
  const periodIndex = Math.floor(t2 / period);
  const withinPeriod = t2 - periodIndex * period;
  const cycleIsDark = periodIndex % 2 === 0; // arranca 'dark' en el período 0, igual que el original

  const styleFor = (dark) =>
    dark
      ? {color: textCycle[0], textShadow: '0 0 20px rgba(66, 26, 37, 0.65)', scale: 1.08, translateY: -4}
      : {color: textCycle[1], textShadow: `0 0 25px ${textCycle[1]}dd`, scale: 1.04, translateY: -3};

  const sweepMs = totalChars * HAIKU_STEP_MS;
  const charsSetThisPeriod = withinPeriod < sweepMs ? Math.floor(withinPeriod / HAIKU_STEP_MS) + 1 : totalChars;

  if (charIndex < charsSetThisPeriod) {
    // ya procesado en este período: color/sombra/escala del ciclo actual
    return styleFor(cycleIsDark);
  }
  // todavía no llega el barrido de este período: mantiene color/sombra del
  // período ANTERIOR (ciclo opuesto), pero con transform ya reseteado (scale 1)
  if (periodIndex === 0) return defaultStyle;
  const prevStyle = styleFor(!cycleIsDark);
  return {color: prevStyle.color, textShadow: prevStyle.textShadow, scale: 1, translateY: 0};
}

function haikuBrandStyle(elapsedMs, totalChars, textCycle) {
  const defaultStyle = {opacity: 0.7, briefColor: null, briefShadow: 'none'};
  if (totalChars <= 0 || elapsedMs < HAIKU_START_MS) return defaultStyle;
  const t2 = elapsedMs - HAIKU_START_MS;
  const period = totalChars * HAIKU_STEP_MS + HAIKU_HOLD_MS;
  const periodIndex = Math.floor(t2 / period);
  if (periodIndex === 0) return defaultStyle; // el primer período todavía no completó ningún ciclo
  // el brand refleja el ciclo del ÚLTIMO período ya completado (periodIndex-1)
  const completedWasDark = (periodIndex - 1) % 2 === 0;
  return completedWasDark
    ? {opacity: 0.85, briefColor: textCycle[1], briefShadow: `0 0 14px ${textCycle[1]}77`}
    : {opacity: 0.5, briefColor: textCycle[0], briefShadow: 'none'};
}

module.exports = {
  FPS,
  WIDTH,
  HEIGHT,
  computeTimeline,
  rotateVector,
  haikuCharStyle,
  haikuBrandStyle,
};
