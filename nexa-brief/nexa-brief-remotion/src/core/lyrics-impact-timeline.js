// Cálculo del layout/cámara/timeline de LyricsImpact — port de
// src/templates/lyrics-impact/index.html (plantilla "IMPACTO", corridos/urbano).
//
// Mecánica del original: la letra se agrupa en FRASES ("clusters"); cada
// frase reemplaza a la anterior (sin scroll), compuesta por una palabra
// GIGANTE + las demás chicas alrededor (3 patrones de composición posibles).
// Cada palabra "estampa" (aparece con golpecito) en su propio timestamp;
// al llegar la frase siguiente, la anterior se desvanece. Hay además un
// "punch" de cámara (zoom in/out) en cada golpe y un screen-shake que decae
// en una ventana de 160ms.
//
// Mismo patrón que neon-timeline.js: computeTimeline() recibe config/lyrics
// como argumentos (cada render trae su propio config.json/lyrics.json vía
// props) y hornea todo lo necesario de una sola pasada — el componente debe
// memoizarlo con React.useMemo.
const {Easing} = require('remotion');
const {mulberry32, resolveMediaSrc, lerp, findLastIdx} = require('./shared-timeline-utils');

const FPS = 30;
const WIDTH = 1920;
const HEIGHT = 1080;

// Réplica de encodeURI/limpieza de texto del original.
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

// Réplica 1:1 de groupClusters() del original.
function groupClusters(flat, cfg) {
  const out = [];
  let cur = null;
  for (const w of flat) {
    const fits =
      cur &&
      cur.words.length < cfg.maxWords &&
      cur.chars + w.text.length + 1 <= cfg.maxChars &&
      w.t - cur.lastT < cfg.gapSec;
    if (fits) {
      cur.words.push({text: w.text, t: w.t});
      cur.chars += w.text.length + 1;
      cur.lastT = w.t;
    } else {
      if (cur) out.push(cur);
      cur = {t: w.t, words: [{text: w.text, t: w.t}], chars: w.text.length, lastT: w.t};
    }
  }
  if (cur) out.push(cur);
  return out;
}

// Réplica 1:1 de bigIndex() del original — mismo orden de llamadas a rng()
// (solo consume rng() cuando hay empate de longitud, por el short-circuit
// del ||), crítico para que el resultado "cuál palabra es gigante" coincida
// con el HTML interactivo dado el mismo seed.
function bigIndex(words, rng) {
  let idx = 0;
  for (let i = 1; i < words.length; i++) {
    if (
      words[i].text.length > words[idx].text.length ||
      (words[i].text.length === words[idx].text.length && rng() < 0.5)
    ) {
      idx = i;
    }
  }
  return idx;
}

// Réplica de la composición del clúster (3 patrones) — arma `lines` como
// arrays de palabras con su clase ('bg2' = grande, 'sm' = chica) y tamaño,
// preservando el objeto de la palabra (incluye su timestamp `t`).
function buildLines(pattern, big, pre, post, bigFs, smFs) {
  const sm = (w) => ({...w, cls: 'sm', fontSize: smFs});
  const bg = (w) => ({...w, cls: 'bg2', fontSize: bigFs});
  if (pattern === 0) {
    const lines = [[bg(big)]];
    const rest = [...pre, ...post];
    if (rest.length) lines.push(rest.map(sm));
    return lines;
  }
  if (pattern === 1) {
    const l1 = [];
    if (pre.length) l1.push(sm(pre[pre.length - 1]));
    l1.push(bg(big));
    if (post.length) l1.push(sm(post[0]));
    const lines = [l1];
    const rest = [...pre.slice(0, -1), ...post.slice(1)];
    if (rest.length) lines.push(rest.map(sm));
    return lines;
  }
  const lines = [];
  if (pre.length) lines.push(pre.map(sm));
  lines.push([bg(big)]);
  if (post.length) lines.push(post.map(sm));
  return lines;
}

function buildTimeline(C, lyrics, fps) {
  const rng = mulberry32(C.seed);
  const vw = WIDTH;
  const vh = HEIGHT; // canvas fijo 16:9 → siempre rama "landscape" del original

  const flat = flattenWords(lyrics);
  const rawClusters = groupClusters(flat, C.cluster);

  const CLUSTERS = [];
  const PUNCH_EVENTS = [];
  const SHAKE_EVENTS = [];

  for (const cl of rawClusters) {
    // MISMO orden de llamadas a rng() que beginCluster() del original:
    // skew, rot, bigIndex(), pattern.
    const skewDeg = C.cluster.skewBase + (rng() - 0.5) * 2 * C.cluster.skewJitter;
    const rotDeg = (rng() - 0.5) * 2 * C.cluster.rotJitter;

    const words = cl.words;
    const bi = bigIndex(words, rng);
    const big = words[bi];
    const pre = words.slice(0, bi);
    const post = words.slice(bi + 1);

    const bigFs = Math.min((vw * 0.86) / (Math.max(2, big.text.length) * 0.52), vh * C.cluster.bigMaxVh);
    const smFs = Math.max(vh * 0.032, bigFs * C.cluster.smallRatio);

    const pattern = words.length === 1 ? 0 : Math.floor(rng() * 3);
    const lines = buildLines(pattern, big, pre, post, bigFs, smFs);
    for (const line of lines) for (const w of line) w.frame = Math.round(w.t * fps);

    const frame = Math.round(cl.t * fps);
    CLUSTERS.push({frame, skewDeg, rotDeg, lines});

    // golpe grande al abrir la frase + golpecito por cada palabra que llega
    // (mismo orden que punch()/revealWord() del original — el orden exacto
    // entre clusters no importa para estos arrays porque se ordenan al final).
    PUNCH_EVENTS.push({frame, zoom: 1.035});
    SHAKE_EVENTS.push({frame, shakeMs: 160});
    for (const line of lines) {
      for (const w of line) {
        PUNCH_EVENTS.push({frame: w.frame, zoom: 1.014});
        SHAKE_EVENTS.push({frame: w.frame, shakeMs: 90});
      }
    }
  }

  PUNCH_EVENTS.sort((a, b) => a.frame - b.frame);
  SHAKE_EVENTS.sort((a, b) => a.frame - b.frame);

  return {CLUSTERS, PUNCH_EVENTS, SHAKE_EVENTS};
}

// applyShake() del original consume el MISMO stream de rng compartido con el
// layout, pero en tiempo real (ligado a performance.now() dentro de rAF) —
// eso ya lo hace no reproducible byte a byte entre reproducciones reales del
// HTML (el número de veces que se llama rng() por shake depende del
// framerate real del navegador). Para hornear esto de forma determinista y
// "seek-safe" (Remotion puede renderizar frames fuera de orden), usamos un
// stream de rng INDEPENDIENTE (no toca el stream de layout, que sí debe ser
// reproducible 1:1) y lo recorremos una sola vez, de punta a punta, mismo
// principio que simulateCamera() en neon-timeline.js.
function simulateShake(events, totalFrames, shakePx, seed, fps) {
  const rng = mulberry32((seed * 2654435761) >>> 0);
  const xs = new Float64Array(totalFrames + 1);
  const ys = new Float64Array(totalFrames + 1);
  const msPerFrame = 1000 / fps;
  let ei = 0;
  let shakeUntilMs = -Infinity;
  for (let f = 0; f <= totalFrames; f++) {
    const elapsedMs = f * msPerFrame;
    while (ei < events.length && events[ei].frame === f) {
      shakeUntilMs = elapsedMs + events[ei].shakeMs;
      ei++;
    }
    if (elapsedMs < shakeUntilMs) {
      // el original divide siempre por 160 (fijo), sin importar el shakeMs
      // real del evento que disparó la ventana — se preserva tal cual.
      const d = (shakeUntilMs - elapsedMs) / 160;
      xs[f] = (rng() - 0.5) * shakePx * 2 * d;
      ys[f] = (rng() - 0.5) * shakePx * 2 * d;
    }
  }
  return {shakeXs: xs, shakeYs: ys};
}

function computeTimeline(configDb, lyricsData) {
  const CONFIG = configDb.configs.find((c) => c.id === configDb.activeId) || configDb.configs[0];
  const DURATION_SEC = lyricsData.metadata.audio_duration_sec;
  const TOTAL_FRAMES = Math.ceil(DURATION_SEC * FPS);
  const OUTRO_LEAD_FRAMES = Math.round((CONFIG.outro.leadSec || 0) * FPS);
  const OUTRO_FRAME = TOTAL_FRAMES - OUTRO_LEAD_FRAMES;

  const {CLUSTERS, PUNCH_EVENTS, SHAKE_EVENTS} = buildTimeline(CONFIG, lyricsData, FPS);
  const {shakeXs: SHAKE_XS, shakeYs: SHAKE_YS} = simulateShake(
    SHAKE_EVENTS,
    TOTAL_FRAMES,
    CONFIG.cluster.shakePx,
    CONFIG.seed,
    FPS
  );

  return {CONFIG, TOTAL_FRAMES, OUTRO_FRAME, CLUSTERS, PUNCH_EVENTS, SHAKE_XS, SHAKE_YS};
}

// Réplica de "stage.style.transform" en punch(): el zoom se aplica
// INSTANTÁNEO (transition:none) y decae de vuelta a 1 con
// "transition: transform 0.35s ease" recién a partir de los 40ms. Como cada
// punch nuevo pisa/cancela cualquier decaimiento anterior (transition:none
// resetea el valor), esto es puramente función del ÚLTIMO evento — no hace
// falta hornear un array, alcanza con buscarlo por frame (como WORDS en
// neon-timeline.js).
const CSS_EASE = Easing.bezier(0.25, 0.1, 0.25, 1.0); // cubic-bezier de "ease" (default CSS)
function stagePunchScale(frame, punchEvents, fps) {
  const idx = findLastIdx(punchEvents, frame);
  if (idx < 0) return 1;
  const ev = punchEvents[idx];
  const dtMs = ((frame - ev.frame) / fps) * 1000;
  if (dtMs < 40) return ev.zoom;
  const t = Math.min(1, (dtMs - 40) / 350);
  return lerp(ev.zoom, 1, CSS_EASE(t));
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
  stagePunchScale,
  GRAIN_STEPS,
  BREATH_EASE,
};
