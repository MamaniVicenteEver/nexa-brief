
/* ================================ CONFIG ================================
   CALADO — el video se ve A TRAVÉS de las letras (texto knockout, estilo
   lyric-video de TikTok/AMV). Tres láminas que se alternan con semilla:
   · CALADO: la pantalla entera se apaga a NEGRO y las palabras gigantes
     son ventanas transparentes por donde se ve el video con filtro cálido
     de cine — las letras pueden sangrar por los bordes.
   · SOLIDO: el video queda visible pero oscurecido, y las palabras entran
     en COLORES sólidos vivos en composiciones diagonales de esquina
     (grande abajo-izquierda + grande arriba-derecha), con alguna palabra
     suelta en caligrafía inclinada.
   · MIXTO: la palabra dominante va calada al centro y las demás en color
     sólido chicas, como firma.
   Cada palabra aparece a golpe en SU timestamp (pop + sacudida corta); la
   frase siguiente REEMPLAZA a la anterior. Impredecible: modo, colores,
   posiciones, tamaños y sangrado rotan con semilla. Pensado para música
   con adrenalina; el fondo manda el video (pelea, autos, deporte).
   La letra se consume 100% de lyricsUrl (formato Whisper:
   { segments: [ { words: [ { word, start, end } ] } ] } ).
   El CONFIG ya no vive aquí: vive en config.json como colección de casos con
   "id" (mismo patrón que el resto de plantillas de letras). Cada objeto
   trae audio, lyricsUrl, video, colors, intro/outro, phrase, laminas y seed.
   Carga con 3 niveles de fallback (no afecta al pipeline, que siempre sirve
   un config.json real por HTTP y gana en el nivel 1):
     1. fetch("config.json")         — lo que el pipeline genera y sirve.
     2. fetch("assets/config.json")  — default versionado, si serviste esta
        carpeta con un server (python3 -m http.server) sin que el pipeline
        haya escrito un config.json en la raíz.
     3. DEFAULT_CONFIG embebido      — para abrir el archivo con doble clic
        (file://), donde fetch() queda bloqueado por el navegador.
   ========================================================================== */
const DEFAULT_CONFIG = { "activeId": "default", "configs": [{
  "id": "default",
  "description": "Lyric-video calado con paleta cálida cinematográfica y video de fondo de acción — las palabras se ven como ventanas transparentes sobre el video, alternando con láminas de color sólido en composiciones diagonales. — metadata para marketing/SEO, la plantilla no la usa todavía.",
  "audio": { "src": "assets/song.mp3" },
  "lyricsUrl": "assets/lyrics.json",
  "video": { "src": "assets/bg.mp4",
             "filter": "sepia(0.30) saturate(1.55) contrast(1.14) hue-rotate(-8deg)",
             "dimSolido": 0.42, "ghostCalado": 0.05 },
  "colors": { "ink": "#F4EFE6", "palette": ["#FF7A1A", "#4FC3FF", "#E0362C", "#FFD23F"],
              "outline": "rgba(244,239,230,0.10)" },
  "intro": { "artist": "", "title": "Colapso", "sub": "", "feats": "NODEMOTION" },
  "outro": { "leadSec": 8, "title": "Gracias", "sub": "Por ver", "feats": "Suscríbete · NEXA BRIEF" },
  "debug": { "enabled": false },
  "phrase": { "gapSec": 0.5, "maxWords": 4, "maxChars": 20 },
  "laminas": { "deck": ["calado","solido","calado","mixto","calado","solido","calado","mixto","solido"],
               "bleedChance": 0.45, "scriptChance": 0.30, "punch": 0.05 },
  "seed": 29
}] };

async function loadDB() {
  for (const url of ["config.json", "assets/config.json"]) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.json();
    } catch (e) { /* file:// u otro bloqueo — probamos el siguiente nivel */ }
  }
  console.warn("[calado] No se pudo cargar config.json ni assets/config.json (¿abierto por file://?) — usando DEFAULT_CONFIG embebido.");
  return DEFAULT_CONFIG;
}

const DB = await loadDB();
const CONFIG = DB.configs.find(c => c.id === DB.activeId) || DB.configs[0];
/* ======================================================================== */

const doc = document, $ = id => doc.getElementById(id);
const C = CONFIG, audio = $("audio"), vid = $("vid"), fx = $("fx"), ctx = fx.getContext("2d");
const introController = window.NexaCaladoIntro;
const introTitle = introController.resolveTitle(C.intro || {});
let introDurationSeconds = introController.DEFAULT_DURATION_SECONDS;
const M = doc.createElement("canvas"), mctx = M.getContext("2d");   /* máscara de texto */
const V = doc.createElement("canvas"), vctx = V.getContext("2d");   /* video recortado */
let vw = innerWidth, vh = innerHeight, dpr = Math.min(devicePixelRatio || 1, 2);
function sizeCanvases() {
  vw = innerWidth; vh = innerHeight; dpr = Math.min(devicePixelRatio || 1, 2);
  for (const [cv, cc] of [[fx, ctx], [M, mctx], [V, vctx]]) {
    cv.width = vw * dpr; cv.height = vh * dpr;
    cc.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  fx.style.width = vw + "px"; fx.style.height = vh + "px";
}
addEventListener("resize", sizeCanvases);

function mulberry32(a) { return function() {
  a |= 0; a = a + 0x6D2B79F5 | 0;
  let t = Math.imul(a ^ a >>> 15, 1 | a);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rng = mulberry32(C.seed);

const FONT = '"Anton", sans-serif';
const FONT_SCRIPT = '700 __px "Caveat", cursive';

/* ---- lyrics: agrupar en FRASES conservando el timestamp de CADA palabra ---- */
async function loadLyrics() {
  try {
    const r = await fetch(C.lyricsUrl);
    if (!r.ok) throw new Error("HTTP " + r.status);
    const j = await r.json();
    const flat = [];
    for (const seg of j.segments) for (const w of seg.words) {
      const clean = w.word.trim().replace(/[.,;!?¡¿"']/g, "");
      if (clean) flat.push({ t: w.start, text: clean.toUpperCase() });
    }
    if (!flat.length) throw new Error("sin palabras");
    return groupPhrases(flat);
  } catch (e) {
    console.warn("[calado] No se pudo cargar", C.lyricsUrl,
                 "— sirve el HTML por HTTP (Live Server), no por file://.", e);
    return [];
  }
}
function groupPhrases(flat) {
  const out = [];
  let cur = null;
  for (const w of flat) {
    const fits = cur && cur.words.length < C.phrase.maxWords &&
                 (cur.chars + w.text.length + 1) <= C.phrase.maxChars &&
                 (w.t - cur.lastT) < C.phrase.gapSec;
    if (fits) {
      cur.words.push(w); cur.chars += w.text.length + 1; cur.lastT = w.t;
    } else {
      if (cur) out.push(cur);
      cur = { t: w.t, words: [w], chars: w.text.length, lastT: w.t };
    }
  }
  if (cur) out.push(cur);
  return out;
}

/* ---- mazo de modos (sin repetir consecutivo) ---- */
let deck = [], deckPos = 0, lastMode = "";
function shuffledDeck() {
  const d = [...C.laminas.deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1)); [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}
function nextMode() {
  if (deckPos >= deck.length) { deck = shuffledDeck(); deckPos = 0; }
  let m = deck[deckPos++];
  if (m === lastMode) m = deck[deckPos % deck.length];
  lastMode = m;
  return m;
}

/* ---- video: encuadre cover + fallback si no carga ---- */
let vidReady = false;
vid.addEventListener("canplay", () => { vidReady = true; });
function coverRect() {
  const sw = vid.videoWidth || 16, sh = vid.videoHeight || 9;
  const s = Math.max(vw / sw, vh / sh);
  return { w: sw * s, h: sh * s, x: (vw - sw * s) / 2, y: (vh - sh * s) / 2 };
}
/* dibuja el video (o un fuego degradado de respaldo) en el contexto dado */
function paintVideo(cc, filter, alpha) {
  cc.save();
  cc.globalAlpha = alpha;
  if (vidReady) {
    cc.filter = filter || "none";
    const r = coverRect();
    cc.drawImage(vid, r.x, r.y, r.w, r.h);
  } else {
    const g = cc.createRadialGradient(vw * 0.5, vh * 0.6, vh * 0.05, vw * 0.5, vh * 0.5, vh * 0.9);
    g.addColorStop(0, "#8C2B12"); g.addColorStop(0.55, "#3D0F06"); g.addColorStop(1, "#0B0302");
    cc.fillStyle = g;
    cc.fillRect(0, 0, vw, vh);
  }
  cc.restore();
}

/* ---- helpers ---- */
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}
function fitFs(cc, text, maxW, maxH, font) {
  cc.font = (font || `100px ${FONT}`).replace("__", "100");
  const w = Math.max(1, cc.measureText(text).width);
  return Math.min(maxW / w * 100, maxH);
}
const pick = arr => arr[Math.floor(rng() * arr.length)];

/* ---- layout por lámina (se decide al activarla, con semilla) ---- */
function makeLamina(words) {
  const mode = nextMode();
  const L = { mode, items: [] };   /* items: {w, kind, font, fs, x, y, color, rot} */
  const cx = vw / 2;

  if (mode === "calado" || mode === "mixto") {
    /* palabras apiladas GIGANTES al centro; en calado pueden sangrar */
    const main = mode === "calado" ? words : [words.reduce((a, b) => (b.text.length > a.text.length ? b : a))];
    const bleed = mode === "calado" && rng() < C.laminas.bleedChance;
    const share = bleed ? 1.12 : 0.94;
    const lineHMax = vh * 0.78 / main.length;
    let fss = main.map(w => Math.min(fitFs(ctx, w.text, vw * share, vh * 0.34), lineHMax));
    const totalH = fss.reduce((a, f) => a + f * 0.92, 0);
    let y = vh * 0.5 - totalH / 2 + fss[0] * 0.78;
    main.forEach((w, i) => {
      L.items.push({
        w, kind: "calado", fs: fss[i],
        x: cx + (main.length > 1 ? (rng() - 0.5) * vw * 0.06 : 0), y,
        rot: (rng() - 0.5) * 0.02
      });
      y += fss[i] * 0.92;
    });
    if (mode === "mixto") {
      /* las demás palabras: firma en color sólido, chicas, esquina baja */
      const rest = words.filter(w => !main.includes(w));
      const color = pick(C.colors.palette);
      let sx = vw * (0.12 + rng() * 0.1), sy = vh * (0.82 + rng() * 0.06);
      for (const w of rest) {
        const script = rng() < C.laminas.scriptChance;
        const fs = vh * (script ? 0.075 : 0.055);
        L.items.push({ w, kind: "solido", script, fs, x: sx, y: sy, color: rng() < 0.5 ? C.colors.ink : color, rot: script ? -0.06 - rng() * 0.06 : 0 });
        sx += w.text.length * fs * (script ? 0.42 : 0.6) + fs * 0.5;
      }
    }
  } else {
    /* SOLIDO: composición diagonal de esquinas sobre el video expuesto */
    const corners = rng() < 0.5
      ? [{ ax: 0.06, ay: 0.86, align: "left" },  { ax: 0.94, ay: 0.20, align: "right" }]
      : [{ ax: 0.06, ay: 0.24, align: "left" },  { ax: 0.94, ay: 0.86, align: "right" }];
    const cA = pick(C.colors.palette);
    let cB = pick(C.colors.palette); if (cB === cA) cB = C.colors.ink;
    words.forEach((w, i) => {
      const big = i < 2;
      const corner = corners[i % 2];
      const script = !big && rng() < C.laminas.scriptChance;
      const fs = big
        ? Math.min(fitFs(ctx, w.text, vw * 0.55, vh * 0.20), vh * 0.20)
        : vh * (script ? 0.085 : 0.06);
      const x = corner.ax * vw + (big ? 0 : (rng() - 0.5) * vw * 0.16);
      const y = corner.ay * vh + (i >= 2 ? (i - 1) * fs * 1.05 * (corner.ay > 0.5 ? -1 : 1) : 0);
      L.items.push({
        w, kind: "solido", script, fs, x, y, align: corner.align,
        color: i % 2 === 0 ? cA : cB,
        rot: script ? -0.08 : (rng() - 0.5) * 0.03
      });
    });
  }
  return L;
}

/* ---- dibujo de una lámina según su modo ---- */
let punch = 0;   /* pop de pantalla al caer cada palabra */
function drawLamina(L, t) {
  const anyCalado = L.items.some(it => it.kind === "calado");

  if (L.mode === "solido") {
    paintVideo(ctx, C.video.filter + ` brightness(${C.video.dimSolido})`, 1);
    const g = ctx.createLinearGradient(0, 0, 0, vh);
    g.addColorStop(0, "rgba(0,0,0,0.35)"); g.addColorStop(0.5, "rgba(0,0,0,0.08)"); g.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, vw, vh);
  } else {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, vw, vh);
    if (C.video.ghostCalado > 0) paintVideo(ctx, C.video.filter, C.video.ghostCalado);
  }

  /* 1) máscara con las palabras CALADAS ya cantadas */
  if (anyCalado) {
    mctx.clearRect(0, 0, vw, vh);
    mctx.fillStyle = "#fff";
    mctx.textAlign = "center";
    mctx.textBaseline = "alphabetic";
    let any = false;
    for (const it of L.items) {
      if (it.kind !== "calado") continue;
      if (it.w.t > t) {
        /* aún no se canta: contorno fantasma apenas visible sobre el negro */
        ctx.save();
        ctx.font = `${it.fs}px ${FONT}`;
        ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
        ctx.strokeStyle = C.colors.outline;
        ctx.lineWidth = Math.max(1, it.fs * 0.012);
        ctx.translate(it.x, it.y); ctx.rotate(it.rot);
        ctx.strokeText(it.w.text, 0, 0);
        ctx.restore();
        continue;
      }
      mctx.save();
      mctx.font = `${it.fs}px ${FONT}`;
      mctx.translate(it.x, it.y); mctx.rotate(it.rot);
      /* pop de entrada: la ventana nace un pelo más grande y asienta */
      const age = Math.max(0, t - it.w.t);
      const pop = 1 + 0.22 * Math.exp(-age * 9);
      mctx.scale(pop, pop);
      mctx.fillText(it.w.text, 0, 0);
      mctx.restore();
      any = true;
    }
    if (any) {
      /* 2) video con filtro cálido recortado por la máscara */
      vctx.clearRect(0, 0, vw, vh);
      paintVideo(vctx, C.video.filter, 1);
      vctx.globalCompositeOperation = "destination-in";
      vctx.drawImage(M, 0, 0, vw, vh);
      vctx.globalCompositeOperation = "source-over";
      ctx.drawImage(V, 0, 0, vw, vh);
    }
  }

  /* 3) palabras SÓLIDAS de color (siempre encima) */
  for (const it of L.items) {
    if (it.kind !== "solido" || it.w.t > t) continue;
    const age = Math.max(0, t - it.w.t);
    const pop = 1 + 0.3 * Math.exp(-age * 9);
    ctx.save();
    ctx.translate(it.x, it.y); ctx.rotate(it.rot); ctx.scale(pop, pop);
    ctx.font = it.script ? FONT_SCRIPT.replace("__", it.fs) : `${it.fs}px ${FONT}`;
    ctx.textAlign = it.align || "left";
    ctx.textBaseline = "alphabetic";
    ctx.shadowColor = "rgba(0,0,0,0.65)";
    ctx.shadowBlur = it.fs * 0.10;
    ctx.shadowOffsetY = it.fs * 0.04;
    ctx.fillStyle = it.color;
    ctx.fillText(it.script ? it.w.text.toLowerCase() : it.w.text, 0, 0);
    ctx.restore();
  }
}

/* ---- reloj: audio si suena; si no, rAF ---- */
let started = false;
/* La escena sigue al audio: si está pausado, intro y letra se quedan en su tiempo actual. */
const outroController = window.NexaCaladoOutro.createController(C.outro || {});

const clock = () => Number.isFinite(audio.currentTime) ? audio.currentTime : 0;

async function begin() {
  if (started) return;
  started = true;
  try { await audio.play(); } catch (e) { /* reloj de pared */ }
}
/* el click SIEMPRE reintenta audio y video (el begin() del arranque no consume el gesto) */
addEventListener("pointerdown", () => {
  begin();
  if (audio.paused) audio.play().catch(() => {});
  if (vid.paused) vid.play().catch(() => {});
});

/* ---- outro por el final REAL del audio ---- */
let outroShown = false;
function maybeOutro() {
  const state = outroController.update(audio.currentTime, audio.duration, audio.ended);
  outroShown = state.active;
  return state;
}
audio.addEventListener("ended", maybeOutro);

/* ---- salida: el diseño de Impacto se dibuja desde components/outro.js ---- */


/* ---- main ---- */
let phrases = [], ptr = 0, activeLam = null, lastWordT = -1;
function frame(now) {
  const t = clock();
  const outroState = maybeOutro();
  const introState = introController.stateAt(t, introDurationSeconds, outroShown);

  if (!outroShown) {
    while (ptr < phrases.length && t >= phrases[ptr].t) {
      activeLam = makeLamina(phrases[ptr].words);
      punch = C.laminas.punch * 1.8;
      ptr++;
    }
    /* golpecito por cada palabra nueva que cae dentro de la lámina activa */
    if (activeLam) {
      for (const it of activeLam.items) {
        if (it.w.t <= t && it.w.t > lastWordT) { punch = Math.max(punch, C.laminas.punch); lastWordT = it.w.t; }
      }
    }
  }

  /* pop de pantalla entera (decae rápido) */
  ctx.save();
  const s = 1 + punch;
  punch *= 0.86;
  ctx.translate(vw / 2, vh / 2); ctx.scale(s, s); ctx.translate(-vw / 2, -vh / 2);

  if (introState.active && !outroShown) {
    introController.drawCanvasIntro({
      ctx, config: C.intro, title: introTitle, timeSeconds: t,
      durationSeconds: introDurationSeconds, width: vw, height: vh, fontFamily: FONT,
      maskCanvas: M, maskContext: mctx, videoCanvas: V, videoContext: vctx,
      backgroundVeilOpacity: 0.58,
      drawBackground: (target, alpha = 1) => paintVideo(target, C.video.filter, alpha),
    });
  } else if (outroShown) {
    window.NexaCaladoOutro.drawCanvasOutro({
      ctx, width: vw, height: vh, config: C.outro, opacity: outroState.opacity,
      elapsedSeconds: Math.max(0, outroState.time - (outroState.duration - outroState.lead)),
      drawBackground: (target, alpha = 1) => paintVideo(target, C.video.filter, alpha),
    });
  } else if (activeLam) drawLamina(activeLam, t);

  ctx.restore();
  requestAnimationFrame(frame);
}

vid.src = encodeURI(C.video.src);
vid.play().catch(() => {});
audio.src = encodeURI(C.audio.src);
loadLyrics().then(p => {
  phrases = p;
  if (p.length && Number.isFinite(p[0].t)) introDurationSeconds = Math.max(0, p[0].t);
});
begin();
sizeCanvases();
doc.body.classList.add("ready");
requestAnimationFrame(frame);
