// Cálculo del timeline de Página Subrayada — port de
// src/templates/pagina-subrayada/index.html ("RESALTADO LETRAS V1"): la
// letra aparece resaltada con marcador dentro de un párrafo de libro con
// relleno atmosférico (bancos FILLER/CONNECTORS FIJOS — se copian tal
// cual, NUNCA se generan ni se tocan), con cambio de página deslizante en
// cada frase nueva.
//
// Determinismo: TODO el contenido de cada página (texto de relleno, color
// de marcador, escala/inclinación del resaltado, forma irregular del
// trazo, manchas de la hoja) depende 100% del mismo stream de rng
// (mulberry32(seed)) consumido en el MISMO ORDEN que buildParagraphHTML/
// buildPageContent/turnToPhrase del original — reproducir ese orden
// exacto es lo único delicado de este port; el resto (barra de progreso
// del marcador, deslizamiento de página, cámara handheld) es matemática
// cerrada de interpolate() sin nada de RNG.
const {Easing} = require('remotion');
const {mulberry32, resolveMediaSrc, lerp, findLastIdx} = require('./shared-timeline-utils');

const FPS = 30;
const WIDTH = 1920;
const HEIGHT = 1080;

const PUNCT_RE = /[.,;!?¡¿"']/g;

// --- banco de relleno "de libro" — COPIADO TAL CUAL de index.html, no se
// toca ni se genera: ver prompts/config_mapper.md ("CRITICAL — the filler
// text is FIXED, you never generate it").
const FILLER = [
  'El silencio antes del cambio siempre dice más de lo que parece',
  'Nadie recuerda el día exacto en que decidió no rendirse',
  'Hay una versión de vos que todavía no conociste',
  'El miedo no desaparece se aprende a caminar junto a él',
  'Cada intento fallido deja una marca que después sirve de mapa',
  'La paciencia no es esperar es seguir moviéndose despacio',
  'A veces la calma es la forma más valiente de responder',
  'El que insiste después de la caída ya ganó la mitad',
  'No hace falta gritar para que una idea pese',
  'El tiempo no perdona pero tampoco olvida el esfuerzo',
  'Detrás de cada costumbre hay una decisión que un día costó',
  'Lo simple casi siempre esconde la parte más difícil',
  'Aprender a soltar también es una forma de avanzar',
  'El camino cambia pero la intención debería quedarse igual',
  'Nadie construye algo sólido mirando solo el resultado final',
  'La disciplina aparece cuando ya no queda motivación',
  'Un mal día no borra meses de intentarlo',
  'El progreso casi nunca se nota mientras está pasando',
  'Hay preguntas que solo se responden caminando',
  'La costumbre de empezar de nuevo también se entrena',
  'No todo lo que cuesta trabajo se nota desde afuera',
  'El orgullo silencioso dura más que el aplauso rápido',
  'A veces el descanso también es parte del plan',
  'Lo que se repite todos los días termina definiendo quién sos',
  'El error incómodo suele enseñar más que el acierto fácil',
  'Nada cambia de un día para otro pero todo empieza en uno',
  'La constancia no se ve pero se nota con el tiempo',
  'Cada decisión pequeña también construye el resultado grande',
  'El que aprende a esperar también aprende a no rendirse',
  'Hay una calma distinta en saber hacia dónde se va',
  'El esfuerzo silencioso no necesita quien lo aplauda',
  'Volver a intentar también es una forma de valentía',
  'Nadie llega lejos sin antes perderse un poco',
  'La costumbre de seguir cuando nadie mira también cuenta',
  'El cambio real casi nunca hace ruido al principio',
  'Hay una fuerza distinta en decidir seguir de todos modos',
  'El tiempo perdido también enseña a valorar el que queda',
  'La duda no siempre significa que vas por mal camino',
  'Cada página nueva empieza con una decisión pequeña',
  'Lo que hoy parece difícil mañana será solo un recuerdo',
];
const CONNECTORS = [
  'y por eso',
  'hasta que',
  'de a poco',
  'sin darse cuenta',
  'en el fondo',
  'aunque no lo pareciera',
  'como si ya',
  'otra vez',
  'de todas formas',
  'muy en el fondo',
];

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

// Réplica 1:1 de groupPhrases() del original (mismos nombres de campo en
// C.phrase: gapSec/maxWords/maxChars, igual que manifiesto-timeline.js).
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

// --- bordes irregulares del trazo de marcador — réplica 1:1 de
// roughMarkerPoly(): 12 llamadas a rng() (6 + 6), MISMO orden.
function roughMarkerPoly(rng) {
  const segs = 5;
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    pts.push(`${((i / segs) * 108 - 4).toFixed(1)}% ${(rng() * 12).toFixed(1)}%`);
  }
  for (let i = segs; i >= 0; i--) {
    pts.push(`${((i / segs) * 108 - 4).toFixed(1)}% ${(88 + rng() * 12).toFixed(1)}%`);
  }
  return `polygon(${pts.join(',')})`;
}

// Réplica 1:1 de buildParagraphHTML() del original — MISMO orden exacto de
// llamadas a rng() (crítico para que el relleno/color/escala coincidan con
// el HTML interactivo dado el mismo seed): nBefore, nAfter, before[],
// after[], connPre (+ pickConnector si aplica), connPost (+ pickConnector
// si aplica), roughMarkerPoly (12), pickMarkerColor, hlScale, hlTilt.
function buildParagraph(phrase, B, rng, state) {
  const nBefore = B.fillerBeforeRange[0] + Math.floor(rng() * (B.fillerBeforeRange[1] - B.fillerBeforeRange[0] + 1));
  const nAfter = B.fillerAfterRange[0] + Math.floor(rng() * (B.fillerAfterRange[1] - B.fillerAfterRange[0] + 1));

  const pickFiller = () => {
    let i = Math.floor(rng() * FILLER.length);
    if (i === state.lastFillerIdx) i = (i + 1) % FILLER.length;
    state.lastFillerIdx = i;
    return FILLER[i];
  };
  const before = Array.from({length: nBefore}, pickFiller).join('. ') + '. ';
  const after = ' ' + Array.from({length: nAfter}, pickFiller).join('. ') + '.';

  const pickConnector = () => CONNECTORS[Math.floor(rng() * CONNECTORS.length)];
  const connPre = rng() < 0.5 ? pickConnector() + ' ' : '';
  const connPost = rng() < 0.5 ? ', ' + pickConnector() : '';

  const words = phrase.words.map((w) => w.text).join(' ');
  const clipPath = roughMarkerPoly(rng);
  const color = B.markerColors[Math.floor(rng() * B.markerColors.length)];
  const hlScale = B.hlScaleBase + Math.pow(rng(), B.hlScalePow) * B.hlScaleRange;
  const hlTilt = (rng() - 0.5) * 2 * B.hlTiltMaxDeg;

  return {before, connPre, words, connPost, after, clipPath, color, hlScale, hlTilt};
}

// --- checkpoints: progreso del trazo (0→1) interpolado entre timestamps
// reales de cada palabra — réplica 1:1 de buildCheckpoints()/progressAt().
function buildCheckpoints(words, phraseT) {
  let cum = 0;
  const chk = [{t: phraseT - 0.05, c: 0}];
  for (const w of words) {
    const len = w.text.length + 1;
    const dur = Math.max(0.1, Math.min(0.38, len * 0.06));
    chk.push({t: w.t, c: cum});
    cum += len;
    chk.push({t: w.t + dur, c: cum});
  }
  return {chk, total: Math.max(1, cum - 1)};
}
function progressAt(t, chk, total) {
  if (t <= chk[0].t) return 0;
  for (let i = 1; i < chk.length; i++) {
    if (t <= chk[i].t) {
      const a = chk[i - 1];
      const b = chk[i];
      const f = b.t > a.t ? (t - a.t) / (b.t - a.t) : 1;
      return Math.min(1, (a.c + (b.c - a.c) * f) / total);
    }
  }
  return 1;
}

// Réplica de buildPageContent()+turnToPhrase(): por cada frase, en el
// MISMO orden que el original (buildParagraphHTML → stainX/stainY/tilt de
// la hoja → jitter de duración del pase de página).
function buildPages(CONFIG, phrases, rng, fps) {
  const B = CONFIG.book;
  const state = {lastFillerIdx: -1};
  const pages = [];

  for (const ph of phrases) {
    const paragraph = buildParagraph(ph, B, rng, state);
    const stainX = 10 + rng() * 80;
    const stainY = 10 + rng() * 80;
    const tilt = (rng() - 0.5) * 1.1;
    const turnMs = Math.round(B.turnMs * (1 + (rng() - 0.5) * 2 * B.turnMsJitter));
    const {chk, total} = buildCheckpoints(ph.words, ph.t);

    pages.push({
      frame: Math.round(ph.t * fps),
      t: ph.t,
      paragraph,
      stainX,
      stainY,
      tilt,
      turnMs,
      chk,
      total,
    });
  }
  return pages;
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
  const PAGES = buildPages(CONFIG, phrases, rng, FPS);

  return {CONFIG, DURATION_SEC, TOTAL_FRAMES, OUTRO_FRAME, PAGES};
}

// --- progreso del marcador en el frame actual para una página dada -----
function progressForPage(page, frame, fps) {
  const t = frame / fps;
  return progressAt(t, page.chk, page.total);
}

// --- cámara handheld (#flipper): 3 keyframes (0%, 50%, 100%) con
// animation-direction alternate infinite cada 10s — réplica cerrada del
// @keyframes "handheld" del original vía interpolate() con 3 puntos
// (mismo principio que BREATH_EASE en lyrics-impact-timeline.js, pero con
// un keyframe intermedio en vez de solo ida/vuelta).
const HANDHELD_EASE = Easing.inOut(Easing.ease);
const HANDHELD_PERIOD_SEC = 10;
const HANDHELD_SCALE = [1.015, 1.032, 1.02];
const HANDHELD_TX = [0, 0.4, -0.35];
const HANDHELD_TY = [0, -0.35, 0.4];
const HANDHELD_ROT = [0, 0.16, -0.14];

function handheldTransform(frame, fps) {
  const t = frame / fps;
  const cyclePos = t % (2 * HANDHELD_PERIOD_SEC);
  const p = cyclePos < HANDHELD_PERIOD_SEC ? cyclePos / HANDHELD_PERIOD_SEC : 1 - (cyclePos - HANDHELD_PERIOD_SEC) / HANDHELD_PERIOD_SEC;
  const at = (arr) => interpolateKeyframes(p, arr);
  return {
    scale: at(HANDHELD_SCALE),
    tx: at(HANDHELD_TX),
    ty: at(HANDHELD_TY),
    rot: at(HANDHELD_ROT),
  };
}
function interpolateKeyframes(p, arr) {
  // 3 keyframes (0%, 50%, 100%) con "ease-in-out" en cada segmento — mismo
  // principio que un @keyframes CSS de 2 tramos.
  if (p <= 0.5) return lerp(arr[0], arr[1], HANDHELD_EASE(p * 2));
  return lerp(arr[1], arr[2], HANDHELD_EASE((p - 0.5) * 2));
}

// --- pulso de sombra del pase de página (#turnShadow) -------------------
function turnShadowOpacity(page, frame, fps) {
  if (!page) return 0;
  const dtMs = ((frame - page.frame) / fps) * 1000;
  const fadeMs = page.turnMs * 0.35;
  const holdUntilMs = page.turnMs + 30;
  if (dtMs < 0) return 0;
  if (dtMs < fadeMs) return dtMs / fadeMs;
  if (dtMs < holdUntilMs) return 1;
  const t = (dtMs - holdUntilMs) / fadeMs;
  if (t >= 1) return 0;
  return 1 - t;
}

// --- grano finísimo (mismo patrón que manifiesto-timeline.js, período
// propio: 1s/4 pasos en vez de 1.1s) -------------------------------------
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
  progressForPage,
  handheldTransform,
  turnShadowOpacity,
  GRAIN_STEPS,
};
