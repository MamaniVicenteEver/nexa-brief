const {registerRoot} = require('remotion');
const {Composition, useCurrentFrame} = require('remotion');
const React = require('react');
const {NeonLetras, FPS: NEON_FPS, WIDTH: NEON_WIDTH, HEIGHT: NEON_HEIGHT} = require('./src/components/NeonLetras');
const {NeonLetrasVideo} = require('./src/components/NeonLetrasVideo');
const {LyricsImpact, FPS: IMPACT_FPS, WIDTH: IMPACT_WIDTH, HEIGHT: IMPACT_HEIGHT} = require('./src/components/LyricsImpact');
const {
  LyricsRomantic,
  FPS: ROMANTIC_FPS,
  WIDTH: ROMANTIC_WIDTH,
  HEIGHT: ROMANTIC_HEIGHT,
} = require('./src/components/LyricsRomantic');
const {ImageBg, FPS: IMAGE_BG_FPS, WIDTH: IMAGE_BG_WIDTH, HEIGHT: IMAGE_BG_HEIGHT} = require('./src/components/ImageBg');
const {
  MotionBackdrop,
  FPS: MOTION_BACKDROP_FPS,
  WIDTH: MOTION_BACKDROP_WIDTH,
  HEIGHT: MOTION_BACKDROP_HEIGHT,
} = require('./src/components/MotionBackdrop');
const {
  Manifiesto,
  FPS: MANIFIESTO_FPS,
  WIDTH: MANIFIESTO_WIDTH,
  HEIGHT: MANIFIESTO_HEIGHT,
} = require('./src/components/Manifiesto');
const {
  PaginaSubrayada,
  FPS: RESALTADO_FPS,
  WIDTH: RESALTADO_WIDTH,
  HEIGHT: RESALTADO_HEIGHT,
} = require('./src/components/PaginaSubrayada');
const {
  LetrasSuaves,
  FPS: SUAVE_FPS,
  WIDTH: SUAVE_WIDTH,
  HEIGHT: SUAVE_HEIGHT,
} = require('./src/components/LetrasSuaves');
const {
  BajoLaLluvia,
  FPS: TRISTE_FPS,
  WIDTH: TRISTE_WIDTH,
  HEIGHT: TRISTE_HEIGHT,
} = require('./src/components/BajoLaLluvia');
const {
  LatidoEnVivo,
  FPS: LATIDO_FPS,
  WIDTH: LATIDO_WIDTH,
  HEIGHT: LATIDO_HEIGHT,
} = require('./src/components/LatidoEnVivo');
const {
  PaisajeVivo,
  FPS: PAISAJE_VIVO_FPS,
  WIDTH: PAISAJE_VIVO_WIDTH,
  HEIGHT: PAISAJE_VIVO_HEIGHT,
} = require('./src/components/PaisajeVivo');
const {
  HiloRojo,
  FPS: HILO_ROJO_FPS,
  WIDTH: HILO_ROJO_WIDTH,
  HEIGHT: HILO_ROJO_HEIGHT,
} = require('./src/components/HiloRojo');
const {
  LetrasCaladas,
  FPS: CALADAS_FPS,
  WIDTH: CALADAS_WIDTH,
  HEIGHT: CALADAS_HEIGHT,
} = require('./src/components/LetrasCaladas');
const {
  ReflectorEpico,
  FPS: REFLECTOR_EPICO_FPS,
  WIDTH: REFLECTOR_EPICO_WIDTH,
  HEIGHT: REFLECTOR_EPICO_HEIGHT,
} = require('./src/components/ReflectorEpico');

// Datos de ejemplo para `npm run dev` (Remotion Studio) — un job real de
// Python manda su propio config/lyrics/assets vía --props, reemplazando
// estos defaultProps por completo. audioSrc/bgSrc son solo NOMBRES de
// archivo (no paths absolutos ni file://): cada composición los resuelve
// con staticFile() contra el publicDir activo — `test/` acá en local (fijado
// en remotion.config.js), o el output_dir del job cuando el backend Python
// invoca el render con --public-dir=<output_dir> (ver scripts/render-node.mjs).
const testConfig = require('./test/config.json');
const testLyrics = require('./test/lyrics.json');
const DEFAULT_AUDIO_SRC = 'song.mp3';
const DEFAULT_BG_IMAGE_SRC = 'bg.jpg';
const DEFAULT_BG_VIDEO_SRC = 'bg-video.mp4';

// Fallback usado solo como valor inicial de `durationInFrames` (Remotion lo
// exige aunque haya calculateMetadata) — el valor real por render lo decide
// calculateNeonMetadata a partir de props.durationSeconds.
const FALLBACK_NEON_FRAMES = Math.ceil((testLyrics.metadata.audio_duration_sec || 1) * NEON_FPS);

function calculateNeonMetadata({props}) {
  // lyricsData.metadata.audio_duration_sec primero: es la MISMA fuente que usa
  // computeTimeline() para TOTAL_FRAMES — así durationInFrames nunca queda
  // desalineado por 1 frame vs. un duration_seconds redondeado que mande Python.
  const durationSeconds = props.lyricsData?.metadata?.audio_duration_sec ?? props.durationSeconds ?? 0;
  return {durationInFrames: Math.max(1, Math.ceil(durationSeconds * NEON_FPS))};
}

// LyricsImpact/LyricsRomantic todavía no tienen un config.json/lyrics.json
// de prueba propios en test/ (a diferencia de neón) — un job real de Python
// manda el suyo vía --props, así que esto SOLO sirve para que la composición
// abra en Remotion Studio (`npm run dev`) sin crashear. Reusa test/lyrics.json
// (agnóstico de plantilla: solo depende de metadata.audio_duration_sec +
// segments) y test/song.mp3 + test/bg.jpg como assets, con un config mínimo
// pero válido para cada schema (cluster para impact, layout+bokeh para
// romantic) — ver src/templates/lyrics-impact|romantic/index.html.
const impactTestConfig = {
  activeId: 'test',
  configs: [
    {
      id: 'test',
      fonts: {display: '"Anton", sans-serif'},
      colors: {ink: '#D2222A', feats: '#8f8f92', hint: '#a09da0'},
      intro: {title: 'Prueba', sub: 'Demo', feats: ''},
      outro: {leadSec: 8, title: 'Gracias', sub: 'Por ver', feats: 'Suscríbete'},
      cluster: {
        gapSec: 0.55,
        maxWords: 5,
        maxChars: 26,
        bigMaxVh: 0.26,
        smallRatio: 0.3,
        skewBase: -8,
        skewJitter: 3,
        rotJitter: 1.2,
        shakePx: 6,
      },
      bg: {filter: 'grayscale(0.5) brightness(0.20) contrast(1.25) saturate(1.3) blur(7px)'},
      seed: 23,
    },
  ],
};
const romanticTestConfig = {
  activeId: 'test',
  configs: [
    {
      id: 'test',
      fonts: {serif: '"Playfair Display", serif', script: '"Great Vibes", cursive'},
      colors: {serif: '#F2E7DA', script: '#D89A9E', muted: '#cbb8ad'},
      intro: {artist: 'Prueba', title: 'Demo', sub: '', feats: ''},
      outro: {leadSec: 8, title: 'Gracias', sub: 'por escuchar', feats: 'Suscríbete'},
      layout: {
        groupGapSec: 0.42,
        maxRowChars: 22,
        rowGapVh: 3.6,
        anchorVhFrac: 0.55,
        scriptChanceSolo: 0.75,
        scriptChanceMulti: 0.22,
        sideAlignChance: 0.3,
        maxTiltDeg: 1.6,
        charStepMs: 55,
        oldAfter: 3,
      },
      bg: {filter: 'grayscale(0.35) brightness(0.30) contrast(1.05) sepia(0.35) hue-rotate(-24deg) saturate(1.25)'},
      bokeh: {count: 16, tint: '216,140,140'},
      seed: 14,
    },
  ],
};
const FALLBACK_IMPACT_FRAMES = Math.ceil((testLyrics.metadata.audio_duration_sec || 1) * IMPACT_FPS);
const FALLBACK_ROMANTIC_FRAMES = Math.ceil((testLyrics.metadata.audio_duration_sec || 1) * ROMANTIC_FPS);

function calculateImpactMetadata({props}) {
  const durationSeconds = props.lyricsData?.metadata?.audio_duration_sec ?? props.durationSeconds ?? 0;
  return {durationInFrames: Math.max(1, Math.ceil(durationSeconds * IMPACT_FPS))};
}

function calculateRomanticMetadata({props}) {
  const durationSeconds = props.lyricsData?.metadata?.audio_duration_sec ?? props.durationSeconds ?? 0;
  return {durationInFrames: Math.max(1, Math.ceil(durationSeconds * ROMANTIC_FPS))};
}

// LetrasSuaves ("lyrics-suave") todavía no tiene config.json/lyrics.json de
// prueba propios en test/ — mismo mecanismo que impactTestConfig/
// romanticTestConfig arriba: solo para que la composición abra en Remotion
// Studio (`npm run dev`) sin crashear. Ver
// src/templates/letras-suaves/index.html + prompts/config_mapper.md (v1)
// para el schema real.
const suaveTestConfig = {
  activeId: 'test',
  configs: [
    {
      id: 'test',
      audio: {src: 'song.mp3'},
      lyricsUrl: 'lyrics.json',
      bg: {
        type: 'image',
        src: 'bg.jpg',
        filter: 'grayscale(0.55) brightness(0.30) contrast(1.1) sepia(0.14) hue-rotate(-32deg)',
      },
      intro: {artist: 'Prueba', title: 'Demo', sub: '', feats: ''},
      outro: {leadSec: 8, title: 'Gracias', sub: 'Por ver', feats: 'Suscríbete · NEXA BRIEF'},
      layout: {
        groupGapSec: 0.3,
        maxRowChars: 14,
        rowGapVh: 3.2,
        anchorVhFrac: 0.56,
        impactChanceSolo: 0.55,
        impactChanceMulti: 0.15,
        oldAfter: 3,
        sideAlignChance: 0.34,
        airyChance: 0.3,
        maxTiltDeg: 2.2,
        camDriftVw: 3,
      },
      dust: {count: 26, color: 'rgba(210,210,215,0.35)'},
      seed: 9,
    },
  ],
};
const FALLBACK_SUAVE_FRAMES = Math.ceil((testLyrics.metadata.audio_duration_sec || 1) * SUAVE_FPS);

function calculateSuaveMetadata({props}) {
  const durationSeconds = props.lyricsData?.metadata?.audio_duration_sec ?? props.durationSeconds ?? 0;
  return {durationInFrames: Math.max(1, Math.ceil(durationSeconds * SUAVE_FPS))};
}

// BajoLaLluvia ("lyrics-triste") todavía no tiene config.json/lyrics.json
// de prueba propios en test/ — mismo mecanismo que suaveTestConfig arriba.
// Ver src/templates/bajo-la-lluvia/index.html + prompts/config_mapper.md
// (v1) para el schema real.
const tristeTestConfig = {
  activeId: 'test',
  configs: [
    {
      id: 'test',
      audio: {src: 'song.mp3'},
      lyricsUrl: 'lyrics.json',
      bg: {
        type: 'image',
        src: 'bg.jpg',
        filter: 'grayscale(0.75) brightness(0.26) contrast(1.12) hue-rotate(178deg) saturate(1.35)',
      },
      intro: {artist: 'Prueba', title: 'Demo', sub: '', feats: ''},
      outro: {leadSec: 8, title: 'Gracias', sub: 'por ver', feats: 'Suscríbete · NEXA BRIEF'},
      layout: {
        groupGapSec: 0.32,
        maxRowChars: 16,
        rowGapVh: 3.4,
        anchorVhFrac: 0.52,
        typeChanceSolo: 0.6,
        typeChanceMulti: 0.2,
        dyingChance: 0.3,
        sideAlignChance: 0.3,
        maxTiltDeg: 1.8,
        oldAfter: 3,
      },
      rain: {streaks: 70, tint: '150,180,210'},
      seed: 11,
    },
  ],
};
const FALLBACK_TRISTE_FRAMES = Math.ceil((testLyrics.metadata.audio_duration_sec || 1) * TRISTE_FPS);

function calculateTristeMetadata({props}) {
  const durationSeconds = props.lyricsData?.metadata?.audio_duration_sec ?? props.durationSeconds ?? 0;
  return {durationInFrames: Math.max(1, Math.ceil(durationSeconds * TRISTE_FPS))};
}

// LatidoEnVivo ("lyrics-latido") todavía no tiene config.json/lyrics.json
// de prueba propios en test/ — mismo mecanismo que tristeTestConfig arriba.
// Sin "bg": esta plantilla es 100% generativa (no hay imagen/video de fondo
// en absoluto). Ver src/templates/latido-en-vivo/index.html +
// prompts/config_mapper.md (v1) para el schema real.
const latidoTestConfig = {
  activeId: 'test',
  configs: [
    {
      id: 'test',
      audio: {src: 'song.mp3'},
      lyricsUrl: 'lyrics.json',
      intro: {artist: 'Prueba', title: 'Demo', sub: '', feats: ''},
      outro: {leadSec: 8, songTitle: 'Demo', title: 'Gracias', sub: 'Por sentir', feats: 'Suscríbete · NEXA BRIEF'},
      debug: {enabled: false},
      ekg: {
        stepVwMin: 0.14,
        stepVwMax: 0.24,
        wanderRad: 0.55,
        sharpTurnChance: 0.13,
        spikeVh: [0.1, 0.22],
        spikeSoloVh: [0.26, 0.36],
        gritoChance: 0.5,
        soloChance: 0.12,
        zoomWide: [0.86, 0.96],
        zoomClose: [1.08, 1.2],
        dutchMax: 2.2,
      },
      seed: 13,
    },
  ],
};
const FALLBACK_LATIDO_FRAMES = Math.ceil((testLyrics.metadata.audio_duration_sec || 1) * LATIDO_FPS);

function calculateLatidoMetadata({props}) {
  const durationSeconds = props.lyricsData?.metadata?.audio_duration_sec ?? props.durationSeconds ?? 0;
  return {durationInFrames: Math.max(1, Math.ceil(durationSeconds * LATIDO_FPS))};
}

// Manifiesto ("lyrics-manifiesto") todavía no tiene config.json/lyrics.json
// de prueba propios en test/ — mismo mecanismo que impactTestConfig/
// suaveTestConfig arriba: solo para que la composición abra en Remotion
// Studio (`npm run dev`) sin crashear. bg.type "none" a propósito (el
// schema real permite video/imagen, pero el config_mapper.md de esta
// plantilla fuerza siempre "none" — no hay pipeline de fondo para esta
// niche). Ver src/templates/manifiesto/index.html + prompts/config_mapper.md.
const manifiestoTestConfig = {
  activeId: 'test',
  configs: [
    {
      id: 'test',
      audio: {src: 'song.mp3'},
      lyricsUrl: 'lyrics.json',
      bg: {type: 'none', src: '', filter: 'grayscale(1) contrast(1.25) brightness(0.32)'},
      colors: {paper: '#F4F2EE', ink: '#0A0A0A'},
      wordmark: 'NEXA BRIEF — MANIFIESTO',
      intro: {artist: 'Prueba', title: 'Demo', sub: '', feats: ''},
      outro: {leadSec: 8, title: 'Gracias', sub: 'Por ver', feats: 'Suscríbete · NEXA BRIEF'},
      debug: {enabled: false},
      phrase: {gapSec: 0.52, maxWords: 5, maxChars: 24},
      laminas: {
        deck: ['pleno', 'pleno', 'columna', 'pleno', 'micro', 'borde', 'columna', 'contra', 'pleno', 'borde', 'micro', 'columna'],
        contraCooldownSec: 6,
        pushScale: 1.028,
        pushSec: 7,
      },
      seed: 17,
    },
  ],
};
const FALLBACK_MANIFIESTO_FRAMES = Math.ceil((testLyrics.metadata.audio_duration_sec || 1) * MANIFIESTO_FPS);

function calculateManifiestoMetadata({props}) {
  const durationSeconds = props.lyricsData?.metadata?.audio_duration_sec ?? props.durationSeconds ?? 0;
  return {durationInFrames: Math.max(1, Math.ceil(durationSeconds * MANIFIESTO_FPS))};
}

// Página Subrayada ("lyrics-resaltado") todavía no tiene config.json/
// lyrics.json de prueba propios en test/ — mismo mecanismo. Sin "bg": esta
// plantilla es 100% generativa (no hay imagen/video de fondo en absoluto).
// Ver src/templates/pagina-subrayada/index.html + prompts/config_mapper.md.
const resaltadoTestConfig = {
  activeId: 'test',
  configs: [
    {
      id: 'test',
      audio: {src: 'song.mp3'},
      lyricsUrl: 'lyrics.json',
      intro: {artist: 'Prueba', title: 'Demo', sub: '', feats: ''},
      outro: {leadSec: 8, title: 'Fin del capítulo', sub: 'Gracias por leer', feats: 'Suscríbete · NEXA BRIEF'},
      debug: {enabled: false},
      phrase: {gapSec: 0.5, maxWords: 5, maxChars: 24},
      book: {
        markerColors: ['#FFE066', '#FFE066', '#FFE066', '#FFD24A', '#FFB4A8', '#8ED6C0', '#9FC9FF'],
        fillerBeforeRange: [6, 9],
        fillerAfterRange: [6, 9],
        hlScaleBase: 1.14,
        hlScaleRange: 0.5,
        hlScalePow: 2.2,
        hlTiltMaxDeg: 1.6,
        turnMs: 520,
        turnMsJitter: 0.18,
      },
      seed: 29,
    },
  ],
};
const FALLBACK_RESALTADO_FRAMES = Math.ceil((testLyrics.metadata.audio_duration_sec || 1) * RESALTADO_FPS);

function calculateResaltadoMetadata({props}) {
  const durationSeconds = props.lyricsData?.metadata?.audio_duration_sec ?? props.durationSeconds ?? 0;
  return {durationInFrames: Math.max(1, Math.ceil(durationSeconds * RESALTADO_FPS))};
}

// ImageBg/MotionBackdrop no tienen lyricsData en absoluto (requires_lyrics=false
// en niches.json para estos 2 templates, ver docs/porting) — a diferencia de
// las 3 composiciones de letras de arriba, calculateMetadata acá SOLO mira
// props.durationSeconds (mandado directo por RemotionAdapter._record() desde
// duration_seconds, sin pasar por metadata de transcripción).
const IMAGE_BG_FALLBACK_DURATION_SEC = 12;
const FALLBACK_IMAGE_BG_FRAMES = Math.ceil(IMAGE_BG_FALLBACK_DURATION_SEC * IMAGE_BG_FPS);
const FALLBACK_MOTION_BACKDROP_FRAMES = Math.ceil(IMAGE_BG_FALLBACK_DURATION_SEC * MOTION_BACKDROP_FPS);

function calculateImageBgMetadata({props}) {
  const durationSeconds = props.durationSeconds ?? IMAGE_BG_FALLBACK_DURATION_SEC;
  return {durationInFrames: Math.max(1, Math.ceil(durationSeconds * IMAGE_BG_FPS))};
}

function calculateMotionBackdropMetadata({props}) {
  const durationSeconds = props.durationSeconds ?? IMAGE_BG_FALLBACK_DURATION_SEC;
  return {durationInFrames: Math.max(1, Math.ceil(durationSeconds * MOTION_BACKDROP_FPS))};
}

// PaisajeVivo ("living-landscape") tampoco tiene lyricsData (requires_lyrics=false
// en niches.json — el haiku es texto fijo de config.text.lines, no letra
// sincronizada) — mismo mecanismo que ImageBg/MotionBackdrop:
// calculateMetadata SOLO mira props.durationSeconds. Config de prueba 1:1 con
// src/templates/paisaje-vivo/prompts/config_mapper.md + fallbackConfig del
// index.html original (tema "brasas"), con "seed" agregado (no existía en el
// HTML original, que usaba Math.random() sin semillar — ver
// core/paisaje-vivo-timeline.js).
const paisajeVivoTestConfig = {
  img: {src: 'bg.jpg', w: 1672, h: 941, focal: [869, 282]},
  palette: {
    petals: [
      {fill: '#FFA500', stroke: '#FF4500', vein: 'rgba(255,200,150,0.8)'},
      {fill: '#FF4500', stroke: '#D2691E', vein: 'rgba(255,180,100,0.7)'},
      {fill: '#FFD700', stroke: '#B8860B', vein: 'rgba(255,255,200,0.9)'},
      {fill: '#FF8C00', stroke: '#8B0000', vein: 'rgba(255,150,100,0.8)'},
      {fill: '#D2691E', stroke: '#5C2E0B', vein: 'rgba(200,100,50,0.6)'},
    ],
    fog: '110,55,75',
    bird: '#ff9a6c',
    textCycle: ['#421A25', '#FFA500'],
    brand: '#ff9a6c',
    firefly: 'rgba(255, 215, 0, 0.6)',
    star: 'rgba(255, 240, 220, 0.85)',
  },
  text: {
    lines: ['花は散り', '名を覚えている', '風ばかり'],
    orientation: 'vertical',
    xPct: 10.0,
    yPct: 10.0,
    letterSpacing: 0.28,
    lineHeight: 2.2,
    lineGap: 2.4,
    fontMin: 32,
    fontMax: 55,
  },
  brand: {nexa: 'NEXA', brief: 'BRIEF'},
  birds: {max: 5, chance: 0.007},
  physics: {
    direction: -1,
    petalCount: 120,
    fogCount: 8,
    cloudCount: 5,
    gravity: 0.18,
    turbulence: 0.6,
    minWind: 1.5,
    maxWind: 5.2,
    minSize: 12,
    maxSize: 34,
    emitterY: 0.18,
    emitterSpread: 0.8,
    rotationSpeed: 0.014,
    tumbleStrength: 0.55,
    staticTilt: 12,
    fireflyCount: 35,
    fireflyEnabled: true,
    repulsionRadius: 140,
    repulsionStrength: 2.2,
  },
  audio: {src: 'song.mp3'},
  intro: {artist: 'SHIBUYA BASS', title: 'SORCERER KILLER', sub: 'Dark', feats: 'Jujutsu High'},
  outro: {leadSec: 7, songTitle: 'SORCERER KILLER', title: 'Gracias', sub: 'Por ver', feats: 'Suscribete'},
  seed: 42,
};
const FALLBACK_PAISAJE_VIVO_FRAMES = Math.ceil(IMAGE_BG_FALLBACK_DURATION_SEC * PAISAJE_VIVO_FPS);

function calculatePaisajeVivoMetadata({props}) {
  const durationSeconds = props.durationSeconds ?? IMAGE_BG_FALLBACK_DURATION_SEC;
  return {durationInFrames: Math.max(1, Math.ceil(durationSeconds * PAISAJE_VIVO_FPS))};
}

// HiloRojo ("lyrics-expediente") todavía no tiene config.json/lyrics.json
// de prueba propios en test/ — mismo mecanismo que latidoTestConfig arriba.
// "bg" queda vacío a propósito: el config_mapper.md de esta niche fuerza
// SIEMPRE bg:{} (el muro es 100% generativo, nunca resuelve una foto real)
// — ver src/templates/hilo-rojo/prompts/config_mapper.md (DEFAULTS —
// expediente) para el schema real y los valores por defecto de "board".
const hiloRojoTestConfig = {
  activeId: 'test',
  configs: [
    {
      id: 'test',
      description: 'Prueba.',
      audio: {src: 'song.mp3'},
      lyricsUrl: 'lyrics.json',
      bg: {},
      intro: {artist: 'Expediente Nº 084 — Prueba', title: 'Demo', sub: '', feats: 'Material clasificado · NEXA BRIEF'},
      outro: {leadSec: 8, songTitle: 'Demo', title: 'Caso cerrado', sub: 'Gracias por ver', feats: 'Suscríbete · NEXA BRIEF'},
      debug: {enabled: false},
      board: {
        clusterGapVw: 58,
        clusterGapVh: 76,
        rowsMin: 2,
        rowsMax: 5,
        stampSoloChance: 0.55,
        soloChance: 0.12,
        markerChance: 0.16,
        headlineChance: 0.36,
        zoomWide: [0.74, 0.9],
        zoomClose: [1.12, 1.34],
        dutchMax: 3.2,
        whipChance: 0.14,
        flashChance: 0.5,
        dirWeights: {left: 0.3, right: 0.3, up: 0.2, down: 0.2},
      },
      seed: 11,
    },
  ],
};
const FALLBACK_HILO_ROJO_FRAMES = Math.ceil((testLyrics.metadata.audio_duration_sec || 1) * HILO_ROJO_FPS);

function calculateHiloRojoMetadata({props}) {
  const durationSeconds = props.lyricsData?.metadata?.audio_duration_sec ?? props.durationSeconds ?? 0;
  return {durationInFrames: Math.max(1, Math.ceil(durationSeconds * HILO_ROJO_FPS))};
}

// ReflectorEpico ("subject-spotlight") tampoco tiene lyricsData (sin
// concepto de letra sincronizada — el HTML original ni siquiera referencia
// lyrics.json, ver core/reflector-epico-timeline.js) — mismo mecanismo que
// ImageBg/PaisajeVivo: calculateMetadata SOLO mira props.durationSeconds.
// Config de prueba 1:1 con src/templates/reflector-epico/prompts/
// config_mapper.md, con "seed" agregado (no existía en el motor JS del
// HTML original, que usaba Math.random() sin semillar en absoluto — ver
// core/reflector-epico-timeline.js). `bgSrc` acá lleva el nombre del
// recorte PNG del sujeto (`subject.png`, media_src_filename en niches.json
// para "subject_spotlight"), no un fondo de imagen/video.
const reflectorEpicoTestConfig = {
  subject: {
    src: 'subject.png',
    w: 595,
    h: 700,
    label: 'Prueba',
    knownName: 'DEMO',
    cropState: 'full_body',
    alignment: 'center',
    scale: 0.7,
    grayscale: 1.0,
    zones: {head: [0, 200, 100, 400], mid: [200, 500, 50, 550], low: [500, 700, 150, 450]},
  },
  bg: {colors: ['#5189c4', '#112339', '#030712'], style: 'radial'},
  blend: 'luminosity',
  giantWord: 'AURA',
  giantColor: '#38a0ff',
  giantOpacity: 0.3,
  particles: {type: 'stones', color: '#38a0ff', dark: 'rgba(15, 2, 2, 0.9)', count: 25, minSize: 3, maxSize: 10},
  glow: {color: '#38a0ff', intensity: 0.5},
  effect: 'sparks',
  ink: '#FFFFFF',
  brand: {name: 'NEXA', sub: 'BRIEF'},
  track: 'DEMO TRACK',
  audio: {src: 'song.mp3', simulatedBpm: 96},
  intro: {artist: 'Prueba', title: 'Demo', sub: '', feats: ''},
  outro: {leadSec: 6, songTitle: 'Demo', title: 'Gracias', sub: 'Por ver', feats: 'Suscríbete'},
  seed: 42,
};
const FALLBACK_REFLECTOR_EPICO_FRAMES = Math.ceil(IMAGE_BG_FALLBACK_DURATION_SEC * REFLECTOR_EPICO_FPS);

function calculateReflectorEpicoMetadata({props}) {
  const durationSeconds = props.durationSeconds ?? IMAGE_BG_FALLBACK_DURATION_SEC;
  return {durationInFrames: Math.max(1, Math.ceil(durationSeconds * REFLECTOR_EPICO_FPS))};
}

// Config de prueba mínima pero válida para que ImageBg abra en Remotion
// Studio (`npm run dev`) sin crashear — un job real de Python manda su propio
// config.json vía --props. Schema 1:1 con
// src/templates/01-image-bg/prompts/config_mapper.md (v8.2). test/bg.jpg
// mide 800x490px (ver dims img.w/h abajo). bgMode "solid" a propósito (el
// smoke test de render prioriza confirmar que el layout/ecualizador
// funcionan; "regions"/"blur" quedan cubiertos por review manual del código,
// ver spatial-layout.js).
const imageBgTestConfig = {
  img: {w: 800, h: 490, src: 'bg.jpg'},
  colors: {bg: '#0d0d0d', ink: '#f5f5f5'},
  bgMode: 'solid',
  bgRegions: [],
  zones: [
    [0, 163, 250, 550],
    [163, 327, 250, 550],
    [327, 490, 250, 550],
  ],
  subject: {top: 0, bottom: 490, left: 250, right: 550},
  keepOut: [],
  texts: {left: 'NEXA', right: 'BRIEF'},
  eqPosition: 'bottom',
  edgeFade: 0.07,
  typography: 'default',
  anchorPreference: 'bottom',
};

// motion-backdrop SÍ es una colección {activeId, configs:[...]} (ver
// wrap_as_case_collection en niche_config.py) — test/bg-video.mp4 mide
// 1280x720px, sin rotación ni letterbox (content = frame completo). Schema
// 1:1 con src/templates/motion-backdrop/prompts/config_mapper.md (v11).
const motionBackdropTestConfig = {
  activeId: 'active',
  configs: [
    {
      id: 'active',
      description: 'Prueba de fondo en movimiento.',
      video: {w: 1280, h: 720, rotation: 0, content: [0, 0, 1280, 720], src: 'bg-video.mp4'},
      colors: {bg: '#0d0d0d', ink: '#f5f5f5'},
      bgMode: 'solid',
      bgRegions: [],
      zones: [
        [0, 240, 400, 880],
        [240, 480, 400, 880],
        [480, 720, 400, 880],
      ],
      subject: {top: 0, bottom: 720, left: 400, right: 880},
      keepOut: [],
      texts: {left: 'MOTION', right: 'BACKDROP'},
      eqPosition: 'bottom',
      edgeFade: 0.07,
      typography: 'default',
      anchorPreference: 'bottom',
      audio: {src: 'song.mp3'},
      intro: {artist: '', title: '', sub: '', feats: ''},
      outro: {leadSec: 7, songTitle: '', title: 'Gracias', sub: 'Por ver', feats: 'Suscríbete'},
    },
  ],
};

// LetrasCaladas ("lyrics-calado") todavía no tiene config.json/lyrics.json
// de prueba propios en test/ — mismo mecanismo que motionBackdropTestConfig
// arriba (colección {activeId, configs:[...]}). Video OBLIGATORIO (a
// diferencia de la mayoría de plantillas de letras, acá el fondo es
// SIEMPRE un video real — es la esencia de la técnica calado/destination-in)
// — reusa test/bg-video.mp4. Schema 1:1 con
// src/templates/letras-caladas/prompts/config_mapper.md.
const caladasTestConfig = {
  activeId: 'active',
  configs: [
    {
      id: 'active',
      description: 'Prueba de letras caladas sobre video.',
      audio: {src: 'song.mp3'},
      lyricsUrl: 'lyrics.json',
      video: {
        src: 'bg-video.mp4',
        filter: 'sepia(0.30) saturate(1.55) contrast(1.14) hue-rotate(-8deg)',
        dimSolido: 0.42,
        ghostCalado: 0.05,
      },
      colors: {
        ink: '#F4EFE6',
        palette: ['#FF7A1A', '#4FC3FF', '#E0362C', '#FFD23F'],
        outline: 'rgba(244,239,230,0.10)',
      },
      intro: {artist: 'Prueba', title: 'Demo', sub: '', feats: 'NEXA BRIEF'},
      outro: {leadSec: 8, title: 'Gracias', sub: 'Por ver', feats: 'Suscríbete · NEXA BRIEF'},
      debug: {enabled: false},
      phrase: {gapSec: 0.5, maxWords: 4, maxChars: 20},
      laminas: {
        deck: ['calado', 'solido', 'calado', 'mixto', 'calado', 'solido', 'calado', 'mixto', 'solido'],
        bleedChance: 0.45,
        scriptChance: 0.3,
        punch: 0.05,
      },
      seed: 29,
    },
  ],
};
const FALLBACK_CALADAS_FRAMES = Math.ceil((testLyrics.metadata.audio_duration_sec || 1) * CALADAS_FPS);

function calculateCaladasMetadata({props}) {
  const durationSeconds = props.lyricsData?.metadata?.audio_duration_sec ?? props.durationSeconds ?? 0;
  return {durationInFrames: Math.max(1, Math.ceil(durationSeconds * CALADAS_FPS))};
}

// Partículas optimizadas (menos cantidad, cálculo directo)
const Particle = ({index}) => {
  const frame = useCurrentFrame();
  const x = (index * 95 + frame * 2) % 1920;
  const y = (index * 53 + frame * 1.5) % 1080;
  
  return React.createElement('div', {
    style: {
      position: 'absolute',
      left: x,
      top: y,
      width: 10,
      height: 10,
      borderRadius: '50%',
      background: `hsl(${index * 24}, 100%, 70%)`,
      opacity: 0.6,
    },
  });
};

const NeonText = () => {
  const frame = useCurrentFrame();
  const pulse = 1 + Math.sin(frame / 20) * 0.05;

  return React.createElement(
    'div',
    {
      style: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: `translate(-50%, -50%) scale(${pulse})`,
        fontSize: 120,
        fontWeight: 'bold',
        fontFamily: 'Arial, sans-serif',
        color: '#00ffff',
        textShadow: '0 0 20px #00ffff, 0 0 40px #00ffff',
        textAlign: 'center',
      },
    },
    'NEXA BRIEF'
  );
};

const StressTestVideo = () => {
  const particles = [];
  // Reducido a 40 partículas para aligerar el DOM masivo de Chrome
  for (let i = 0; i < 40; i++) {
    particles.push(React.createElement(Particle, {key: i, index: i}));
  }

  return React.createElement(
    'div',
    {
      style: {
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        background: '#000',
      },
    },
    ...particles,
    React.createElement(NeonText)
  );
};

const RemotionRoot = () =>
  React.createElement(
    React.Fragment,
    null,
    React.createElement(Composition, {
      id: 'StressTest',
      component: StressTestVideo,
      durationInFrames: 30 * 300, // 5 minutos a 30 FPS = 9,000 frames (la mitad de trabajo)
      fps: 30,
      width: 1920,
      height: 1080,
    }),
    React.createElement(Composition, {
      id: 'NeonLetras',
      component: NeonLetras,
      calculateMetadata: calculateNeonMetadata,
      durationInFrames: FALLBACK_NEON_FRAMES, // valor inicial; calculateNeonMetadata lo recalcula por render
      fps: NEON_FPS,
      width: NEON_WIDTH,
      height: NEON_HEIGHT,
      defaultProps: {
        configData: testConfig,
        lyricsData: testLyrics,
        audioSrc: DEFAULT_AUDIO_SRC,
        bgSrc: DEFAULT_BG_IMAGE_SRC,
      },
    }),
    React.createElement(Composition, {
      id: 'NeonLetrasVideo',
      component: NeonLetrasVideo, // copia de NeonLetras con fondo de video + optimizaciones de capa GPU
      calculateMetadata: calculateNeonMetadata,
      durationInFrames: FALLBACK_NEON_FRAMES,
      fps: NEON_FPS,
      width: NEON_WIDTH,
      height: NEON_HEIGHT,
      defaultProps: {
        configData: testConfig,
        lyricsData: testLyrics,
        audioSrc: DEFAULT_AUDIO_SRC,
        bgSrc: DEFAULT_BG_VIDEO_SRC,
      },
    }),
    React.createElement(Composition, {
      id: 'LyricsImpact',
      component: LyricsImpact,
      calculateMetadata: calculateImpactMetadata,
      durationInFrames: FALLBACK_IMPACT_FRAMES, // valor inicial; calculateImpactMetadata lo recalcula por render
      fps: IMPACT_FPS,
      width: IMPACT_WIDTH,
      height: IMPACT_HEIGHT,
      defaultProps: {
        configData: impactTestConfig,
        lyricsData: testLyrics,
        audioSrc: DEFAULT_AUDIO_SRC,
        bgSrc: DEFAULT_BG_IMAGE_SRC,
      },
    }),
    React.createElement(Composition, {
      id: 'LyricsRomantic',
      component: LyricsRomantic,
      calculateMetadata: calculateRomanticMetadata,
      durationInFrames: FALLBACK_ROMANTIC_FRAMES, // valor inicial; calculateRomanticMetadata lo recalcula por render
      fps: ROMANTIC_FPS,
      width: ROMANTIC_WIDTH,
      height: ROMANTIC_HEIGHT,
      defaultProps: {
        configData: romanticTestConfig,
        lyricsData: testLyrics,
        audioSrc: DEFAULT_AUDIO_SRC,
        bgSrc: DEFAULT_BG_IMAGE_SRC,
      },
    }),
    React.createElement(Composition, {
      id: 'LetrasSuaves',
      component: LetrasSuaves,
      calculateMetadata: calculateSuaveMetadata,
      durationInFrames: FALLBACK_SUAVE_FRAMES, // valor inicial; calculateSuaveMetadata lo recalcula por render
      fps: SUAVE_FPS,
      width: SUAVE_WIDTH,
      height: SUAVE_HEIGHT,
      defaultProps: {
        configData: suaveTestConfig,
        lyricsData: testLyrics,
        audioSrc: DEFAULT_AUDIO_SRC,
        bgSrc: DEFAULT_BG_IMAGE_SRC,
      },
    }),
    React.createElement(Composition, {
      id: 'BajoLaLluvia',
      component: BajoLaLluvia,
      calculateMetadata: calculateTristeMetadata,
      durationInFrames: FALLBACK_TRISTE_FRAMES, // valor inicial; calculateTristeMetadata lo recalcula por render
      fps: TRISTE_FPS,
      width: TRISTE_WIDTH,
      height: TRISTE_HEIGHT,
      defaultProps: {
        configData: tristeTestConfig,
        lyricsData: testLyrics,
        audioSrc: DEFAULT_AUDIO_SRC,
        bgSrc: DEFAULT_BG_IMAGE_SRC,
      },
    }),
    React.createElement(Composition, {
      id: 'LatidoEnVivo',
      component: LatidoEnVivo,
      calculateMetadata: calculateLatidoMetadata,
      durationInFrames: FALLBACK_LATIDO_FRAMES, // valor inicial; calculateLatidoMetadata lo recalcula por render
      fps: LATIDO_FPS,
      width: LATIDO_WIDTH,
      height: LATIDO_HEIGHT,
      defaultProps: {
        configData: latidoTestConfig,
        lyricsData: testLyrics,
        audioSrc: DEFAULT_AUDIO_SRC,
      },
    }),
    React.createElement(Composition, {
      id: 'Manifiesto',
      component: Manifiesto,
      calculateMetadata: calculateManifiestoMetadata,
      durationInFrames: FALLBACK_MANIFIESTO_FRAMES, // valor inicial; calculateManifiestoMetadata lo recalcula por render
      fps: MANIFIESTO_FPS,
      width: MANIFIESTO_WIDTH,
      height: MANIFIESTO_HEIGHT,
      defaultProps: {
        configData: manifiestoTestConfig,
        lyricsData: testLyrics,
        audioSrc: DEFAULT_AUDIO_SRC,
        bgSrc: DEFAULT_BG_IMAGE_SRC,
      },
    }),
    React.createElement(Composition, {
      id: 'PaginaSubrayada',
      component: PaginaSubrayada,
      calculateMetadata: calculateResaltadoMetadata,
      durationInFrames: FALLBACK_RESALTADO_FRAMES, // valor inicial; calculateResaltadoMetadata lo recalcula por render
      fps: RESALTADO_FPS,
      width: RESALTADO_WIDTH,
      height: RESALTADO_HEIGHT,
      defaultProps: {
        configData: resaltadoTestConfig,
        lyricsData: testLyrics,
        audioSrc: DEFAULT_AUDIO_SRC,
      },
    }),
    React.createElement(Composition, {
      id: 'ImageBg',
      component: ImageBg,
      calculateMetadata: calculateImageBgMetadata,
      durationInFrames: FALLBACK_IMAGE_BG_FRAMES, // valor inicial; calculateImageBgMetadata lo recalcula por render
      fps: IMAGE_BG_FPS,
      width: IMAGE_BG_WIDTH,
      height: IMAGE_BG_HEIGHT,
      defaultProps: {
        configData: imageBgTestConfig,
        audioSrc: DEFAULT_AUDIO_SRC,
        bgSrc: DEFAULT_BG_IMAGE_SRC,
        durationSeconds: IMAGE_BG_FALLBACK_DURATION_SEC,
      },
    }),
    React.createElement(Composition, {
      id: 'MotionBackdrop',
      component: MotionBackdrop,
      calculateMetadata: calculateMotionBackdropMetadata,
      durationInFrames: FALLBACK_MOTION_BACKDROP_FRAMES, // valor inicial; calculateMotionBackdropMetadata lo recalcula por render
      fps: MOTION_BACKDROP_FPS,
      width: MOTION_BACKDROP_WIDTH,
      height: MOTION_BACKDROP_HEIGHT,
      defaultProps: {
        configData: motionBackdropTestConfig,
        audioSrc: DEFAULT_AUDIO_SRC,
        bgSrc: DEFAULT_BG_VIDEO_SRC,
        durationSeconds: IMAGE_BG_FALLBACK_DURATION_SEC,
      },
    }),
    React.createElement(Composition, {
      id: 'PaisajeVivo',
      component: PaisajeVivo,
      calculateMetadata: calculatePaisajeVivoMetadata,
      durationInFrames: FALLBACK_PAISAJE_VIVO_FRAMES, // valor inicial; calculatePaisajeVivoMetadata lo recalcula por render
      fps: PAISAJE_VIVO_FPS,
      width: PAISAJE_VIVO_WIDTH,
      height: PAISAJE_VIVO_HEIGHT,
      defaultProps: {
        configData: paisajeVivoTestConfig,
        audioSrc: DEFAULT_AUDIO_SRC,
        bgSrc: DEFAULT_BG_IMAGE_SRC,
        durationSeconds: IMAGE_BG_FALLBACK_DURATION_SEC,
      },
    }),
    React.createElement(Composition, {
      id: 'LetrasCaladas',
      component: LetrasCaladas,
      calculateMetadata: calculateCaladasMetadata,
      durationInFrames: FALLBACK_CALADAS_FRAMES, // valor inicial; calculateCaladasMetadata lo recalcula por render
      fps: CALADAS_FPS,
      width: CALADAS_WIDTH,
      height: CALADAS_HEIGHT,
      defaultProps: {
        configData: caladasTestConfig,
        lyricsData: testLyrics,
        audioSrc: DEFAULT_AUDIO_SRC,
        bgSrc: DEFAULT_BG_VIDEO_SRC,
      },
    }),
    React.createElement(Composition, {
      id: 'ReflectorEpico',
      component: ReflectorEpico,
      calculateMetadata: calculateReflectorEpicoMetadata,
      durationInFrames: FALLBACK_REFLECTOR_EPICO_FRAMES, // valor inicial; calculateReflectorEpicoMetadata lo recalcula por render
      fps: REFLECTOR_EPICO_FPS,
      width: REFLECTOR_EPICO_WIDTH,
      height: REFLECTOR_EPICO_HEIGHT,
      defaultProps: {
        configData: reflectorEpicoTestConfig,
        audioSrc: DEFAULT_AUDIO_SRC,
        bgSrc: 'subject.png',
        durationSeconds: IMAGE_BG_FALLBACK_DURATION_SEC,
      },
    }),
    React.createElement(Composition, {
      id: 'HiloRojo',
      component: HiloRojo,
      calculateMetadata: calculateHiloRojoMetadata,
      durationInFrames: FALLBACK_HILO_ROJO_FRAMES, // valor inicial; calculateHiloRojoMetadata lo recalcula por render
      fps: HILO_ROJO_FPS,
      width: HILO_ROJO_WIDTH,
      height: HILO_ROJO_HEIGHT,
      defaultProps: {
        configData: hiloRojoTestConfig,
        lyricsData: testLyrics,
        audioSrc: DEFAULT_AUDIO_SRC,
      },
    })
  );

registerRoot(RemotionRoot);