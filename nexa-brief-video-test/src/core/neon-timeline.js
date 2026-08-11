import configDb from './config.json';
import lyricsData from '../assets/lyrics.json';

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
const CAM_DECAY = 1 - Math.pow(1 - 0.055, 60 / FPS);

export const CONFIG = configDb.configs.find((c) => c.id === configDb.activeId) || configDb.configs[0];

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function flattenWords(lyrics) {
  const out = [];
  for (const seg of lyrics.segments) {
    for (const w of seg.words) out.push({ t: w.start, text: w.word.trim() });
  }
  out.sort((a, b) => a.t - b.t);
  return out;
}

function buildTimeline(C, lyrics, fps) {
  const rng = mulberry32(C.seed);
  const vw = WIDTH;
  const vh = HEIGHT;
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
    const wShare = 0.3;
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
    placedWords.push({ frame, text: clean, x, y, w: width, h: height, fontSize: fs, outline, vertical });

    const cx = 0.42 + rng() * 0.1;
    const camTX = x + width / 2 - vw * cx;
    const camTY = y + height / 2 - vh * (0.4 + rng() * 0.12);
    camEvents.push({ frame, camTX, camTY });

    rowIdx++;
    if (solo || rowIdx >= rowsThisCol) newColumn();
  }

  return { placedWords, camEvents };
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
  return { camXs, camYs };
}

export const DURATION_SEC = lyricsData.metadata.audio_duration_sec;
export const TOTAL_FRAMES = Math.ceil(DURATION_SEC * FPS);
const OUTRO_LEAD_FRAMES = Math.round((CONFIG.outro.leadSec || 0) * FPS);
export const OUTRO_FRAME = TOTAL_FRAMES - OUTRO_LEAD_FRAMES;

const { placedWords: WORDS_, camEvents: CAM_EVENTS } = buildTimeline(CONFIG, lyricsData, FPS);
export const WORDS = WORDS_;
const { camXs: CAM_XS_, camYs: CAM_YS_ } = simulateCamera(CAM_EVENTS, TOTAL_FRAMES, CAM_DECAY);
export const CAM_XS = CAM_XS_;
export const CAM_YS = CAM_YS_;

export function tubeGlow(N, s) {
  return `0 0 ${s * 0.15}px ${N.core}, 0 0 ${s * 0.35}px ${N.glow}, 0 0 ${s * 0.9}px ${N.glow}, 0 0 ${s * 1.8}px ${N.deep}, 0 0 ${s * 3}px ${N.deep}`;
}

export function neonDropShadow(N, fs) {
  return `drop-shadow(0 0 ${Math.max(2, fs * 0.05)}px ${N.core}) drop-shadow(0 0 ${fs * 0.16}px ${N.glow}) drop-shadow(0 0 ${fs * 0.4}px ${N.deep})`;
}