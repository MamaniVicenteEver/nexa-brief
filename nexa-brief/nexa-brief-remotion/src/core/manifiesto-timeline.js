// Cálculo del timeline de Manifiesto — port de
// src/templates/manifiesto/index.html ("MANIFIESTO LETRAS V2 — Colapso"):
// editorial suizo blanco/negro, cortes de cine en seco entre 5 composiciones
// tipográficas a pantalla completa ("láminas"). Es el más simple de los
// templates que faltan portar: SIN cámara con física continua (solo un
// push-in lentísimo por lámina, función cerrada del tiempo transcurrido
// desde que esa lámina entró) y SIN reveal animado (cada palabra aparece EN
// SECO — visibility toggle — en su timestamp exacto, sin fade/transición).
//
// Mismo patrón que neon-timeline.js/lyrics-impact-timeline.js:
// computeTimeline() recibe config/lyrics como argumentos (cada render trae
// su propio config.json/lyrics.json vía props) y hornea de una sola pasada
// TODO lo necesario — el layout de cada lámina (qué texto, qué tamaño de
// fuente) es 100% determinista dado el seed + words, así que se calcula acá
// una sola vez; el componente solo decide QUÉ lámina mostrar según el frame
// actual y qué palabras de ella ya están "on".
const {Easing} = require('remotion');
const {mulberry32, resolveMediaSrc, lerp, findLastIdx} = require('./shared-timeline-utils');

const FPS = 30;
const WIDTH = 1920;
const HEIGHT = 1080;

const PUNCT_RE = /[.,;!?¡¿"']/g;

function flattenWords(lyrics) {
  const out = [];
  for (const seg of lyrics.segments) {
    for (const w of seg.words) {
      const clean = w.word.trim().replace(PUNCT_RE, '');
      if (clean) out.push({t: w.start, text: clean});
    }
  }
  out.sort((a, b) => a.t - b.t);
  return out;
}

// Réplica 1:1 de groupPhrases() del original (idéntico algoritmo al de
// lyrics-impact-timeline.js/groupClusters, mismos nombres de campo en
// C.phrase: gapSec/maxWords/maxChars).
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

function longestIdx(words) {
  let idx = 0;
  for (let i = 1; i < words.length; i++) {
    if (words[i].text.length > words[idx].text.length) idx = i;
  }
  return idx;
}

// Fisher-Yates con el rng compartido — MISMO orden de llamadas que
// shuffledDeck() del original (crítico para que "qué lámina toca" coincida
// con el HTML interactivo dado el mismo seed).
function shuffledDeck(baseDeck, rng) {
  const d = [...baseDeck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

// --- construcción de cada modo de lámina --------------------------------
// Canvas fijo 16:9 (WIDTH > HEIGHT) → siempre la rama "desktop" del
// original (los `share`/divisores de la rama `vw < vh` de index.html nunca
// se ejercitan acá, igual que en neon-timeline.js/lyrics-impact-timeline.js).
function buildPleno(words, fps) {
  const bi = longestIdx(words);
  const big = words[bi];
  const rest = words.filter((_, i) => i !== bi);
  const fs = Math.min((WIDTH * 0.9) / (Math.max(2, big.text.length) * 0.62), HEIGHT * 0.34);
  return {
    mode: 'pleno',
    big: {text: big.text, frame: Math.round(big.t * fps), fontSize: fs},
    rest: rest.map((w) => ({text: w.text, frame: Math.round(w.t * fps)})),
  };
}

function buildColumna(words, fps, idx) {
  const maxLen = Math.max(...words.map((w) => w.text.length), 2);
  const fs = Math.min((WIDTH * 0.6) / (maxLen * 0.6), HEIGHT * 0.095);
  return {
    mode: 'columna',
    idx,
    words: words.map((w) => ({text: w.text, frame: Math.round(w.t * fps), fontSize: fs})),
  };
}

function buildContra(words, fps) {
  const chars = words.reduce((n, w) => n + w.text.length + 1, 0);
  const fs = Math.min((WIDTH * 0.86) / (Math.max(4, chars) * 0.6), HEIGHT * 0.22);
  return {
    mode: 'contra',
    words: words.map((w) => ({text: w.text, frame: Math.round(w.t * fps), fontSize: fs})),
  };
}

function buildMicro(words, fps) {
  // sin fontSize por palabra: el original usa el 2.5vh fijo de .lamina.micro .txt
  return {
    mode: 'micro',
    words: words.map((w) => ({text: w.text, frame: Math.round(w.t * fps)})),
  };
}

// Único builder que consume rng (edge arriba/abajo) — el ÚNICO punto del
// loop de láminas (además del reshuffle del mazo) donde se avanza el stream
// compartido con nextMode(), en el MISMO orden que placeLamina() del
// original (nextMode() primero, builder después).
function buildBorde(words, fps, rng) {
  const edge = rng() < 0.6 ? 'abajo' : 'arriba';
  const bi = longestIdx(words);
  const big = words[bi];
  const rest = words.filter((_, i) => i !== bi);
  const fs = Math.min((WIDTH * 1.02) / (Math.max(2, big.text.length) * 0.62), HEIGHT * 0.42);
  return {
    mode: 'borde',
    edge,
    big: {text: big.text, frame: Math.round(big.t * fps), fontSize: fs},
    rest: rest.map((w) => ({text: w.text, frame: Math.round(w.t * fps)})),
  };
}

// Réplica 1:1 de nextMode()/placeLamina() del original, recorriendo TODAS
// las frases de una sola pasada (en el HTML esto pasa incrementalmente
// cuadro a cuadro vía rAF; acá se hornea entero porque el resultado es
// 100% determinista — no depende de nada más que el stream de rng y el
// orden temporal de las frases).
function buildLaminas(CONFIG, phrases, rng, fps) {
  let deck = shuffledDeck(CONFIG.laminas.deck, rng); // "deck = shuffledDeck();" inicial (antes del loop)
  let deckPos = 0;
  let lastMode = '';
  let lastContraT = -99;
  let colIdx = 0;
  const laminas = [];

  for (const ph of phrases) {
    if (deckPos >= deck.length) {
      deck = shuffledDeck(CONFIG.laminas.deck, rng);
      deckPos = 0;
    }
    let mode = deck[deckPos++];
    if (mode === lastMode) mode = deck[deckPos % deck.length];
    if (mode === 'contra' && ph.t - lastContraT < CONFIG.laminas.contraCooldownSec) mode = 'pleno';
    if (mode === 'contra') lastContraT = ph.t;
    lastMode = mode;

    let built;
    if (mode === 'pleno') built = buildPleno(ph.words, fps);
    else if (mode === 'columna') {
      colIdx++;
      built = buildColumna(ph.words, fps, colIdx);
    } else if (mode === 'contra') built = buildContra(ph.words, fps);
    else if (mode === 'micro') built = buildMicro(ph.words, fps);
    else built = buildBorde(ph.words, fps, rng);

    laminas.push({frame: Math.round(ph.t * fps), ...built});
  }
  return laminas;
}

function computeTimeline(configDb, lyricsData) {
  const CONFIG = configDb.configs.find((c) => c.id === configDb.activeId) || configDb.configs[0];
  const DURATION_SEC = lyricsData.metadata.audio_duration_sec;
  const TOTAL_FRAMES = Math.ceil(DURATION_SEC * FPS);
  const OUTRO_LEAD_FRAMES = Math.round((CONFIG.outro.leadSec || 0) * FPS);
  const OUTRO_FRAME = TOTAL_FRAMES - OUTRO_LEAD_FRAMES;

  const rng = mulberry32(CONFIG.seed);
  const flat = flattenWords(lyricsData);
  const phrases = groupPhrases(flat, CONFIG.phrase);
  const LAMINAS = buildLaminas(CONFIG, phrases, rng, FPS);

  return {CONFIG, DURATION_SEC, TOTAL_FRAMES, OUTRO_FRAME, LAMINAS};
}

// --- push-in de cámara: reset en seco por lámina, empuje lentísimo -------
// Réplica de "world.style.transform" en placeLamina(): scale(1) instantáneo
// al entrar la lámina, transición a pushScale en pushSec segundos con
// cubic-bezier(0.25, 0, 0.75, 1) — función CERRADA del tiempo transcurrido
// desde el frame de la lámina activa (no acumulativa entre láminas).
const PUSH_EASE = Easing.bezier(0.25, 0, 0.75, 1);
function pushScaleAt(frame, laminas, fps, pushScale, pushSec) {
  const idx = findLastIdx(laminas, frame);
  if (idx < 0) return 1;
  const dt = (frame - laminas[idx].frame) / fps;
  const t = Math.min(1, Math.max(0, dt / pushSec));
  return lerp(1, pushScale, PUSH_EASE(t));
}

// --- flash de corte a papel al entrar una CONTRA -------------------------
// Réplica de "#cut" en placeLamina(): opacity 0.9 instantáneo (sin
// transición), luego decae a 0 en 0.12s recién a partir de un par de
// cuadros de rAF (~2 cuadros a 60fps del original).
const CUT_EASE = Easing.out(Easing.quad);
const CUT_HOLD_SEC = 2 / 60;
function cutOpacityAt(frame, laminas, fps) {
  const idx = findLastIdx(laminas, frame);
  if (idx < 0) return 0;
  const l = laminas[idx];
  if (l.mode !== 'contra') return 0;
  const dt = (frame - l.frame) / fps;
  if (dt < CUT_HOLD_SEC) return 0.9;
  const t = (dt - CUT_HOLD_SEC) / 0.12;
  if (t >= 1) return 0;
  return lerp(0.9, 0, CUT_EASE(t));
}

// --- metadata viva (timecode mm:ss.cs de la esquina superior derecha) ---
function formatTimecode(t) {
  const cs = Math.floor((t % 1) * 100);
  const mm = String(Math.floor(t / 60)).padStart(2, '0');
  const ss = String(Math.floor(t % 60)).padStart(2, '0');
  return `${mm}:${ss}.${String(cs).padStart(2, '0')}`;
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
  computeTimeline,
  resolveMediaSrc,
  findLastIdx,
  lerp,
  pushScaleAt,
  cutOpacityAt,
  formatTimecode,
  GRAIN_STEPS,
};
