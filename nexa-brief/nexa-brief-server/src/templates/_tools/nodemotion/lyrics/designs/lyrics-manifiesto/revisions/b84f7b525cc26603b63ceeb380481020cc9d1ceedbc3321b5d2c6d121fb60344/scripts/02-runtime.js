
/* ================================ CONFIG ================================
   MANIFIESTO V2 — igual que V1 pero: SIN marco de hairlines alrededor,
   SIN cartel de "click para empezar" (el click igual enciende el audio),
   y responsive reforzado para las dos pantallas (móvil vertical aprovecha
   más ancho en PLENO/COLUMNA/CONTRA; desktop queda idéntico).
   ------------------------------------------------------------------------
   MANIFIESTO — editorial suizo blanco/negro, cortes de cine en seco.
   La letra se agrupa en FRASES; cada frase es una LÁMINA a pantalla
   completa que REEMPLAZA a la anterior con CORTE SECO (nada de easing:
   el impacto ES el corte). Dentro de la lámina cada palabra aparece EN
   SECO en su timestamp exacto. 5 modos de lámina barajados con semilla
   (sin repetir consecutivo): PLENO (palabra dominante a lo ancho),
   COLUMNA (bloque con hairline e índice), CONTRA (frame invertido papel
   completo, con cooldown para que siga siendo especial), MICRO (susurro
   con marcas de registro) y BORDE (gigante sangrada que el margen corta).
   Metadata viva (timecode real, % de progreso, wordmark) en las esquinas,
   siempre. Cámara: solo un push-in lentísimo por lámina; sin paneos, sin
   sacudidas — precisión.
   Fondo pensado para un VIDEO (p.ej. un auto de noche) muy filtrado:
   bg.type "video" | "image" | "none"; con src vacío usa el negro
   editorial generativo. La letra se consume 100% de lyricsUrl (formato
   Whisper: { segments: [ { words: [ { word, start, end } ] } ] }).
   El CONFIG ya no vive aquí: vive en config.json como colección de casos con
   "id" (mismo patrón que 04-video-motion). Cada objeto trae audio, lyricsUrl,
   bg, colors, wordmark, intro/outro, phrase, laminas y seed. Para otra
   canción del mismo género, agregá otro objeto al array "configs" — acá no
   se toca nada.
   Carga con 3 niveles de fallback (no afecta al pipeline, que siempre sirve
   un config.json real por HTTP y gana en el nivel 1):
     1. fetch("config.json")         — lo que el pipeline genera y sirve.
     2. fetch("assets/config.json")  — default versionado, si serviste esta
        carpeta con un server (python3 -m http.server) sin que el pipeline
        haya escrito un config.json en la raíz.
     3. DEFAULT_CONFIG embebido      — para abrir el archivo con doble clic
        (file://), donde fetch() queda bloqueado por el navegador.
   ========================================================================== */
const ACTIVE_ID = null;   /* <-- forzar un id ("colapso" | ...) · null = usa "activeId" del JSON */

const DEFAULT_CONFIG = { "activeId": "default", "configs": [{
  "id": "default",
  "description": "Manifiesto editorial suizo blanco/negro — configuración por defecto sin fondo de video, usada como fallback cuando el pipeline real no está disponible.",
  "audio": { "src": "assets/song.mp3" },
  "lyricsUrl": "assets/lyrics.json",
  "bg": { "type": "none", "src": "", "filter": "grayscale(1) contrast(1.25) brightness(0.32)" },
  "colors": { "paper": "#F4F2EE", "ink": "#0A0A0A" },
  "wordmark": "NODEMOTION — MANIFIESTO",
  "intro": { "artist": "", "title": "Manifiesto", "sub": "", "feats": "" },
  "outro": { "leadSec": 8, "title": "Gracias", "sub": "Por ver", "feats": "Suscribite | NodeMotion" },
  "debug": { "enabled": false },
  "phrase": { "gapSec": 0.52, "maxWords": 5, "maxChars": 24 },
  "laminas": { "deck": ["pleno","pleno","columna","pleno","micro","borde","columna","contra","pleno","borde","micro","columna"],
               "contraCooldownSec": 6, "pushScale": 1.028, "pushSec": 7 },
  "seed": 17
}] };

async function loadDB() {
  for (const url of ["config.json", "assets/config.json"]) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.json();
    } catch (e) { /* file:// u otro bloqueo — probamos el siguiente nivel */ }
  }
  console.warn("[manifiesto] No se pudo cargar config.json ni assets/config.json (¿abierto por file://?) — usando DEFAULT_CONFIG embebido.");
  return DEFAULT_CONFIG;
}

const DB = await loadDB();
const CONFIG = DB.configs.find(c => c.id === ACTIVE_ID)
            || DB.configs.find(c => c.id === DB.activeId)
            || DB.configs[0];
/* ======================================================================== */

const doc = document, $ = id => doc.getElementById(id);
const C = CONFIG, world = $("world"), audio = $("audio");
let vw = innerWidth, vh = innerHeight;
addEventListener("resize", () => { vw = innerWidth; vh = innerHeight; });
doc.documentElement.style.setProperty("--paper", C.colors.paper);
doc.documentElement.style.setProperty("--ink", C.colors.ink);
$("metaTL").textContent = C.wordmark;

function mulberry32(a) { return function() {
  a |= 0; a = a + 0x6D2B79F5 | 0;
  let t = Math.imul(a ^ a >>> 15, 1 | a);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rng = mulberry32(C.seed);

/* ---- intro / outro ---- */
function buildCard(id, cfg) {
  const i = $(id);
  i.querySelector(".artist").textContent = cfg.artist ?? "";
  i.querySelector(".title").textContent = cfg.title;
  i.querySelector(".sub").textContent = cfg.sub;
  i.querySelector(".feats").textContent = cfg.feats;
}
buildCard("intro", window.NexaTemplateIntro.apply(C.intro));
const outroController = window.NexaManifiestoOutro.createDOMOutro({root: $("outro"), config: C.outro || {}, onShow: () => { $("intro").classList.add("gone"); }});

/* ---- lyrics: agrupar en FRASES conservando el timestamp de CADA palabra ---- */
async function loadLyrics() {
  try {
    const r = await fetch(C.lyricsUrl);
    if (!r.ok) throw new Error("HTTP " + r.status);
    const j = await r.json();
    const flat = [];
    for (const seg of j.segments) {
      // Whisper puede inventar esta despedida durante el silencio final.
      if (/^\s*gracias por ver (?:el|este) v[ií]deo[.!\s]*$/i.test(seg.text || "")) continue;
      for (const w of seg.words || []) {
      const clean = w.word.trim().replace(/[.,;!?¡¿"']/g, "");
      if (clean) flat.push({ t: w.start, text: clean });
      }
    }
    if (!flat.length) throw new Error("sin palabras");
    return groupPhrases(flat);
  } catch (e) {
    console.warn("[manifiesto] No se pudo cargar", C.lyricsUrl,
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

/* ---- mazo de modos: barajado con semilla, sin repetir consecutivo ---- */
let deck = [], deckPos = 0, lastMode = "", lastContraT = -99;
function shuffledDeck() {
  const d = [...C.laminas.deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1)); [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}
function nextMode(t) {
  if (deckPos >= deck.length) { deck = shuffledDeck(); deckPos = 0; }
  let m = deck[deckPos++];
  if (m === lastMode) m = deck[deckPos % deck.length];   /* evita el repetido seco */
  if (m === "contra" && (t - lastContraT) < C.laminas.contraCooldownSec) m = "pleno";
  if (m === "contra") lastContraT = t;
  lastMode = m;
  return m;
}

/* ---- helpers tipográficos ---- */
const longestIdx = words => {
  let idx = 0;
  for (let i = 1; i < words.length; i++)
    if (words[i].text.length > words[idx].text.length) idx = i;
  return idx;
};
const span = (w, cls) => {
  const s = doc.createElement("span");
  s.className = "w " + (cls || "");
  s.textContent = w.text;
  return s;
};
/* si la composición excede el ancho útil, se encoge entera con --fit */
let lastFit = null;   /* última lámina medida: se re-mide si la fuente llega después */
function fitInner(inner, share = 0.9) {
  lastFit = { inner, share };
  requestAnimationFrame(() => {
    const r = inner.getBoundingClientRect();
    if (r.width > vw * share) inner.style.setProperty("--fit", (vw * share / r.width).toFixed(3));
  });
}
/* la medición corre con la fuente que haya; si Archivo carga DESPUÉS de medir,
   el ancho real crece y la palabra se saldría — re-ajustar la lámina activa */
if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(() => {
  if (!lastFit || !lastFit.inner.isConnected) return;
  lastFit.inner.style.removeProperty("--fit");
  fitInner(lastFit.inner, lastFit.share);
});

/* ---- construcción de cada modo de lámina ---- */
let colIdx = 0;   /* índice incremental de las láminas COLUMNA: 01 —, 02 —, ... */
function buildPleno(el, words, seq) {
  const inner = doc.createElement("div"); inner.className = "inner";
  const bi = longestIdx(words), big = words[bi];
  const rest = words.filter((_, i) => i !== bi);
  const bigEl = span(big, "big");
  /* móvil vertical: la palabra dominante aprovecha más ancho (desktop no cambia) */
  const share = vw < vh ? 0.94 : 0.9;
  const fs = Math.min(vw * share / (Math.max(2, big.text.length) * 0.62), vh * 0.34);
  bigEl.style.fontSize = fs + "px";
  inner.appendChild(bigEl);
  seq.push({ t: big.t, el: bigEl });
  if (rest.length) {
    const row = doc.createElement("div"); row.className = "rest";
    for (const w of rest) { const s = span(w); row.appendChild(s); seq.push({ t: w.t, el: s }); }
    inner.appendChild(row);
  }
  el.appendChild(inner);
  fitInner(inner, vw < vh ? 0.94 : 0.9);
}
function buildColumna(el, words, seq) {
  const inner = doc.createElement("div"); inner.className = "inner";
  const idx = doc.createElement("div"); idx.className = "idx";
  idx.textContent = String(++colIdx).padStart(2, "0") + " —";
  inner.appendChild(idx);
  const maxLen = Math.max(...words.map(w => w.text.length), 2);
  /* móvil vertical: la columna ocupa más ancho de pantalla (desktop no cambia) */
  const fs = Math.min(vw * (vw < vh ? 0.75 : 0.6) / (maxLen * 0.6), vh * 0.095);
  for (const w of words) {
    const s = span(w); s.style.fontSize = fs + "px";
    inner.appendChild(s); seq.push({ t: w.t, el: s });
  }
  el.appendChild(inner);
  fitInner(inner, vw < vh ? 0.9 : 0.8);
}
function buildContra(el, words, seq) {
  const inner = doc.createElement("div"); inner.className = "inner";
  const chars = words.reduce((n, w) => n + w.text.length + 1, 0);
  const fs = Math.min(vw * (vw < vh ? 0.92 : 0.86) / (Math.max(4, chars) * 0.6), vh * 0.22);
  for (const w of words) {
    const s = span(w); s.style.fontSize = fs + "px";
    inner.appendChild(s); seq.push({ t: w.t, el: s });
  }
  el.appendChild(inner);
}
function buildMicro(el, words, seq) {
  const inner = doc.createElement("div"); inner.className = "inner";
  for (const cls of ["c c1", "c c2", "c c3", "c c4"]) {
    const c = doc.createElement("i"); c.className = cls; inner.appendChild(c);
  }
  const row = doc.createElement("div"); row.className = "txt";
  for (const w of words) { const s = span(w); row.appendChild(s); seq.push({ t: w.t, el: s }); }
  inner.appendChild(row);
  el.appendChild(inner);
  fitInner(inner, 0.86);
}
function buildBorde(el, words, seq) {
  const inner = doc.createElement("div"); inner.className = "inner";
  const edge = rng() < 0.6 ? "abajo" : "arriba";
  const bi = longestIdx(words), big = words[bi];
  const rest = words.filter((_, i) => i !== bi);
  const bigEl = span(big, "big " + edge);
  const edgeShare = vw < vh ? 0.82 : 0.94;
  const fs = Math.min(vw * edgeShare / (Math.max(2, big.text.length) * 0.62), vh * 0.38);
  bigEl.style.fontSize = fs + "px";
  inner.appendChild(bigEl);
  seq.push({ t: big.t, el: bigEl });
  if (rest.length) {
    const row = doc.createElement("div"); row.className = "rest " + edge;
    for (const w of rest) { const s = span(w); row.appendChild(s); seq.push({ t: w.t, el: s }); }
    inner.appendChild(row);
  }
  el.appendChild(inner);
}
const builders = { pleno: buildPleno, columna: buildColumna, contra: buildContra, micro: buildMicro, borde: buildBorde };

/* ---- corte: la lámina nueva reemplaza a la anterior EN SECO ---- */
let active = null;   /* { seq: [{t, el}] ordenado, next } */
function placeLamina(cl) {
  const mode = nextMode(cl.t);
  world.replaceChildren();                       /* CORTE — nada de fades */
  doc.body.classList.toggle("contraActive", mode === "contra");
  if (mode === "contra") {                       /* 2 frames de flash a papel */
    const cut = $("cut");
    cut.style.transition = "none"; cut.style.opacity = 0.9;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      cut.style.transition = "opacity 0.12s ease-out"; cut.style.opacity = 0;
    }));
  }
  const el = doc.createElement("div");
  el.className = "lamina " + mode;
  const seq = [];
  builders[mode](el, cl.words, seq);
  world.appendChild(el);
  seq.sort((a, b) => a.t - b.t);
  active = { seq, next: 0 };

  /* push-in: reset en seco y arranque del empuje lentísimo */
  world.style.transition = "none";
  world.style.transform = "scale(1)";
  requestAnimationFrame(() => requestAnimationFrame(() => {
    world.style.transition = `transform ${C.laminas.pushSec}s cubic-bezier(0.25, 0, 0.75, 1)`;
    world.style.transform = `scale(${C.laminas.pushScale})`;
  }));
}

/* ---- reloj: audio si suena; si no, rAF ---- */
let rafT0 = null, rafNow = 0, started = false;
const clock = () => (!audio.paused && audio.currentTime > 0.05)
  ? audio.currentTime
  : (rafT0 === null ? 0 : (rafNow - rafT0) / 1000);

async function begin() {
  if (started) return;
  started = true;
  try { await audio.play(); } catch (e) { /* reloj de pared */ }
}
/* el click SIEMPRE reintenta el audio (el begin() del arranque no consume el gesto) */
addEventListener("pointerdown", () => {
  begin();
  if (audio.paused) audio.play().catch(() => {});
});

/* ---- outro por el final REAL del audio ---- */
let outroShown = false;
function maybeOutro() {
  const t = audio.ended && isFinite(audio.duration) ? audio.duration : audio.currentTime;
  outroShown = outroController.update(t, audio.duration, audio.ended).active;
}
audio.addEventListener("ended", maybeOutro);

/* ---- metadata viva en esquinas ---- */
function updateMeta(t) {
  const cs = Math.floor((t % 1) * 100);
  const mm = String(Math.floor(t / 60)).padStart(2, "0");
  const ss = String(Math.floor(t % 60)).padStart(2, "0");
  $("metaTR").textContent = `${mm}:${ss}.${String(cs).padStart(2, "0")}`;
  $("metaBL").textContent = `${String(ptr).padStart(3, "0")} / ${String(phrases.length).padStart(3, "0")}`;
  const dur = audio.duration;
  $("metaBR").textContent = (isFinite(dur) && dur > 0)
    ? Math.round(audio.currentTime / dur * 100) + "%" : "—";
}

/* ---- main ---- */
let phrases = [], ptr = 0, introGone = false;
function frame(now) {
  rafNow = now;
  if (rafT0 === null) rafT0 = now;
  const t = clock();
  maybeOutro();
  if (!outroShown) {
    while (ptr < phrases.length && t >= phrases[ptr].t) {
      if (!introGone) { $("intro").classList.add("gone"); introGone = true; }
      placeLamina(phrases[ptr]);
      ptr++;
    }
    /* revelar EN SECO las palabras de la lámina activa que ya se cantaron */
    if (active) {
      while (active.next < active.seq.length && t >= active.seq[active.next].t) {
        active.seq[active.next].el.classList.add("on");
        active.next++;
      }
    }
  }
  updateMeta(t);
  requestAnimationFrame(frame);
}

/* ---- fondo video/imagen con filtro del CONFIG (o negro editorial puro) ---- */
function setupBg() {
  if (!C.bg || C.bg.type === "none" || !C.bg.src) return;
  let el = $("bgMedia");
  if (C.bg.type === "video") {
    const v = doc.createElement("video");
    v.id = "bgMedia"; v.muted = true; v.loop = true; v.autoplay = true;
    v.setAttribute("playsinline", "");
    el.replaceWith(v); el = v;
    v.play && v.play().catch(() => {});
  }
  el.src = encodeURI(C.bg.src);
  el.style.display = "block";
  el.style.filter = C.bg.filter || "";
}

setupBg();
deck = shuffledDeck();
audio.src = encodeURI(C.audio.src);
loadLyrics().then(p => { phrases = p; });
begin();
doc.body.classList.add("ready");
requestAnimationFrame(frame);
