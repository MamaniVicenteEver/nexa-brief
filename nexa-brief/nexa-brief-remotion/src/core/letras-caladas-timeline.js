// Cálculo del timeline de LetrasCaladas — port de
// src/templates/letras-caladas/index.html ("LETRAS CALADAS — Colapso"):
// el texto es una VENTANA transparente a un video de fondo real, compuesto
// en <canvas> con globalCompositeOperation="destination-in" (ver
// components/LetrasCaladas.js para el compositing en sí — este módulo solo
// hornea el LAYOUT, que es 100% determinista dado seed + lyrics).
//
// Tres "láminas" alternadas por semilla (calado/solido/mixto) elegidas vía
// mulberry32(seed) por FRASE, con el MISMO orden de llamadas RNG que el
// original (deck shuffle → nextMode → bleedChance → posiciones/colores) —
// cualquier cambio acá debe preservar ese orden exacto, ver comentarios en
// cada punto donde se llama rng().
const {mulberry32, lerp, findLastIdx} = require('./shared-timeline-utils');

const FPS = 30;
const WIDTH = 1920;
const HEIGHT = 1080;

const PUNCT_RE = /[.,;!?¡¿"']/g;

// Aproximación de fitFs() del original (que usa ctx.measureText real a
// 100px) con una razón fija ancho-por-carácter — mismo criterio ya usado en
// manifiesto-timeline.js/lyrics-impact-timeline.js para Anton mayúsculas
// (evita depender de un canvas/DOM real durante el precómputo del layout,
// que corre en React.useMemo y podría ejecutarse antes de que el font esté
// listo). El dibujo real en components/LetrasCaladas.js SÍ usa
// ctx.measureText verdadero para el título de las tarjetas intro/outro
// (ahí ya hay canvas real disponible en tiempo de pintado).
const CHAR_W_RATIO = 0.62;
function fitFs(text, maxW, maxH) {
  const w = Math.max(1, text.length * CHAR_W_RATIO);
  return Math.min(maxW / w, maxH);
}

function flattenWords(lyrics) {
  const out = [];
  for (const seg of lyrics.segments) {
    for (const w of seg.words) {
      const clean = w.word.trim().replace(PUNCT_RE, '');
      if (clean) out.push({t: w.start, text: clean.toUpperCase()});
    }
  }
  out.sort((a, b) => a.t - b.t);
  return out;
}

// Réplica 1:1 de groupPhrases() del original.
function groupPhrases(flat, cfg) {
  const out = [];
  let cur = null;
  for (const w of flat) {
    const fits =
      cur &&
      cur.words.length < cfg.maxWords &&
      cur.chars + w.text.length + 1 <= cfg.maxChars &&
      w.t - cur.lastT < cfg.gapSec;
    if (fits) {
      cur.words.push(w);
      cur.chars += w.text.length + 1;
      cur.lastT = w.t;
    } else {
      if (cur) out.push(cur);
      cur = {t: w.t, words: [w], chars: w.text.length, lastT: w.t};
    }
  }
  if (cur) out.push(cur);
  return out;
}

// Fisher-Yates con el rng compartido — mismo orden que shuffledDeck() del original.
function shuffledDeck(baseDeck, rng) {
  const d = [...baseDeck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

// Réplica de deck/deckPos/lastMode + nextMode() del original (variables
// globales mutables ahí, closure acá) — el reshuffle SOLO llama rng()
// cuando el mazo se agota; la colisión con lastMode NO consume rng() extra
// (solo reindexea dentro del mazo ya barajado).
function makeModePicker(baseDeck, rng) {
  let deck = [];
  let deckPos = 0;
  let lastMode = '';
  return function nextMode() {
    if (deckPos >= deck.length) {
      deck = shuffledDeck(baseDeck, rng);
      deckPos = 0;
    }
    let m = deck[deckPos++];
    if (m === lastMode) m = deck[deckPos % deck.length];
    lastMode = m;
    return m;
  };
}

function pick(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}

// Réplica 1:1 de makeLamina() del original — MISMO orden de statements y de
// cortocircuitos && / ?: que el HTML fuente (crítico: cada rama consume una
// cantidad distinta de llamadas rng(), ver comentarios inline en cada punto
// donde el original evalúa rng() condicionalmente).
function makeLamina(words, rng, nextMode, C) {
  const mode = nextMode();
  const items = [];
  const cx = WIDTH / 2;

  if (mode === 'calado' || mode === 'mixto') {
    const main = mode === 'calado' ? words : [words.reduce((a, b) => (b.text.length > a.text.length ? b : a))];
    // rng() SOLO si mode==="calado" (cortocircuito de &&) — en "mixto" bleed
    // siempre queda false sin consumir el stream.
    const bleed = mode === 'calado' && rng() < C.laminas.bleedChance;
    const share = bleed ? 1.12 : 0.94;
    const lineHMax = (HEIGHT * 0.78) / main.length;
    const fss = main.map((w) => Math.min(fitFs(w.text, WIDTH * share, HEIGHT * 0.34), lineHMax));
    const totalH = fss.reduce((a, f) => a + f * 0.92, 0);
    let y = HEIGHT * 0.5 - totalH / 2 + fss[0] * 0.78;
    main.forEach((w, i) => {
      items.push({
        w,
        kind: 'calado',
        fs: fss[i],
        // rng() SOLO si main.length>1 (en "mixto" main.length siempre es 1
        // → nunca consume acá).
        x: cx + (main.length > 1 ? (rng() - 0.5) * WIDTH * 0.06 : 0),
        y,
        rot: (rng() - 0.5) * 0.02, // rng() SIEMPRE
      });
      y += fss[i] * 0.92;
    });
    if (mode === 'mixto') {
      const rest = words.filter((w) => !main.includes(w));
      const color = pick(C.colors.palette, rng); // rng()
      let sx = WIDTH * (0.12 + rng() * 0.1); // rng()
      const sy = HEIGHT * (0.82 + rng() * 0.06); // rng()
      for (const w of rest) {
        const script = rng() < C.laminas.scriptChance; // rng() SIEMPRE por rest word
        const fs = HEIGHT * (script ? 0.075 : 0.055);
        items.push({
          w,
          kind: 'solido',
          script,
          fs,
          x: sx,
          y: sy,
          color: rng() < 0.5 ? C.colors.ink : color, // rng() SIEMPRE
          rot: script ? -0.06 - rng() * 0.06 : 0, // rng() SOLO si script
        });
        sx += w.text.length * fs * (script ? 0.42 : 0.6) + fs * 0.5;
      }
    }
  } else {
    // SOLIDO: composición diagonal de esquinas sobre el video expuesto.
    const corners =
      rng() < 0.5 // rng()
        ? [
            {ax: 0.06, ay: 0.86, align: 'left'},
            {ax: 0.94, ay: 0.2, align: 'right'},
          ]
        : [
            {ax: 0.06, ay: 0.24, align: 'left'},
            {ax: 0.94, ay: 0.86, align: 'right'},
          ];
    const cA = pick(C.colors.palette, rng); // rng()
    let cB = pick(C.colors.palette, rng); // rng()
    if (cB === cA) cB = C.colors.ink;
    words.forEach((w, i) => {
      const big = i < 2;
      const corner = corners[i % 2];
      // rng() SOLO si !big (cortocircuito).
      const script = !big && rng() < C.laminas.scriptChance;
      const fs = big ? Math.min(fitFs(w.text, WIDTH * 0.55, HEIGHT * 0.2), HEIGHT * 0.2) : HEIGHT * (script ? 0.085 : 0.06);
      // rng() SOLO si !big.
      const x = corner.ax * WIDTH + (big ? 0 : (rng() - 0.5) * WIDTH * 0.16);
      const y = corner.ay * HEIGHT + (i >= 2 ? (i - 1) * fs * 1.05 * (corner.ay > 0.5 ? -1 : 1) : 0);
      items.push({
        w,
        kind: 'solido',
        script,
        fs,
        x,
        y,
        align: corner.align,
        color: i % 2 === 0 ? cA : cB,
        rot: script ? -0.08 : (rng() - 0.5) * 0.03, // rng() SOLO si !script
      });
    });
  }
  return {mode, items};
}

// El "punch" (pop de pantalla, ctx.scale global) decae ×0.86 por cuadro de
// rAF en el original (~60fps del navegador), reseteado a punch*1.8 en cada
// nueva frase y "levantado" (Math.max) a punch base en cada palabra nueva
// de la lámina activa. Acá se hornea cuadro a cuadro a FPS=30 con la tasa de
// decaimiento ajustada (0.86^(60/FPS)) para conservar el mismo tiempo real
// de caída del pop — mismo criterio de "hornear la simulación completa" ya
// usado en otros templates para curvas acumulativas por evento.
const RAF_DECAY = 0.86;
function computePunchByFrame(LAMINAS, CONFIG, totalFrames) {
  const decayPerFrame = Math.pow(RAF_DECAY, 60 / FPS);
  const punchArr = new Float32Array(Math.max(1, totalFrames));
  const wordFrames = [];
  for (const L of LAMINAS) for (const it of L.items) wordFrames.push(it.frame);
  wordFrames.sort((a, b) => a - b);

  let punch = 0;
  let laminaPtr = 0;
  let wordPtr = 0;
  for (let f = 0; f < punchArr.length; f++) {
    while (laminaPtr < LAMINAS.length && f >= LAMINAS[laminaPtr].frame) {
      punch = CONFIG.laminas.punch * 1.8;
      laminaPtr++;
    }
    while (wordPtr < wordFrames.length && f >= wordFrames[wordPtr]) {
      punch = Math.max(punch, CONFIG.laminas.punch);
      wordPtr++;
    }
    punchArr[f] = 1 + punch;
    punch *= decayPerFrame;
  }
  return punchArr;
}

function computeTimeline(configDb, lyricsData) {
  const CONFIG = configDb.configs.find((c) => c.id === configDb.activeId) || configDb.configs[0];
  const DURATION_SEC = lyricsData.metadata.audio_duration_sec;
  const TOTAL_FRAMES = Math.max(1, Math.ceil(DURATION_SEC * FPS));
  const OUTRO_LEAD_FRAMES = Math.round((CONFIG.outro.leadSec || 0) * FPS);
  const OUTRO_FRAME = Math.max(0, TOTAL_FRAMES - OUTRO_LEAD_FRAMES);

  const rng = mulberry32(CONFIG.seed);
  const flat = flattenWords(lyricsData);
  const phrases = groupPhrases(flat, CONFIG.phrase);
  const nextMode = makeModePicker(CONFIG.laminas.deck, rng);

  const LAMINAS = phrases.map((ph) => {
    const built = makeLamina(ph.words, rng, nextMode, CONFIG);
    return {
      frame: Math.round(ph.t * FPS),
      mode: built.mode,
      items: built.items.map((it) => ({
        kind: it.kind,
        fs: it.fs,
        x: it.x,
        y: it.y,
        rot: it.rot,
        align: it.align,
        script: it.script,
        color: it.color,
        text: it.w.text,
        tSec: it.w.t,
        frame: Math.round(it.w.t * FPS),
      })),
    };
  });

  const PUNCH = computePunchByFrame(LAMINAS, CONFIG, TOTAL_FRAMES);

  return {CONFIG, DURATION_SEC, TOTAL_FRAMES, OUTRO_FRAME, LAMINAS, PUNCH};
}

module.exports = {
  FPS,
  WIDTH,
  HEIGHT,
  computeTimeline,
  findLastIdx,
  lerp,
};
