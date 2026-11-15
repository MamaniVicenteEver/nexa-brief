
/* ================================ CONFIG ================================
   PLANTILLA IMPACTO — estilo "lyric video de corrido/urbano" (referencia AGUAS)
   Mecánica: la letra se agrupa en FRASES; cada frase es una composición
   tipográfica centrada que REEMPLAZA a la anterior (no hay scroll): una
   palabra GIGANTE + las demás pequeñas compuestas alrededor, todo en UNA
   sola tinta roja, condensada e itálica (skew). La frase SE ARMA palabra
   por palabra: cada palabra llega a ESTAMPA (con su golpecito) en el
   timestamp exacto en que se canta, y al entrar la frase siguiente la
   anterior se DESVANECE suave. Barras de cine arriba y abajo.
   Impredecible: 3 patrones de composición, cuál palabra es la gigante,
   skew/rotación/tamaños con semilla. Responsive: en móvil vertical la
   composición se auto-encoge (--fit) si excede el ancho.
   El CONFIG ya no vive aquí: vive en config.json como colección de casos con
   "id" (mismo patrón que 04-video-motion). Cada objeto trae audio, lyricsUrl,
   bg, fonts, colors, intro/outro, cluster y seed. Para otra canción del mismo
   género, agregá otro objeto al array "configs" — acá no se toca nada.
   Carga con 3 niveles de fallback (no afecta al pipeline, que siempre sirve
   un config.json real por HTTP y gana en el nivel 1):
     1. fetch("config.json")         — lo que el pipeline genera y sirve.
     2. fetch("assets/config.json")  — default versionado, si serviste esta
        carpeta con un server (python3 -m http.server) sin que el pipeline
        haya escrito un config.json en la raíz.
     3. DEFAULT_CONFIG embebido      — para abrir el archivo con doble clic
        (file://), donde fetch() queda bloqueado por el navegador.
   ========================================================================== */
const ACTIVE_ID = null;   /* <-- forzar un id ("colapso" | "colapso-dorado" | ...) · null = usa "activeId" del JSON */

const DEFAULT_CONFIG = { "activeId": "default", "configs": [{
  "id": "default",
  "description": "Lyric video estilo corrido/trap urbano — una palabra gigante por frase en tinta roja condensada e itálica, con las demás palabras chicas alrededor, barras de cine y golpe de cámara por palabra cantada. — metadata para marketing/SEO, la plantilla no la usa todavía.",
  "audio": { "src": "assets/song.mp3" },
  "lyricsUrl": "assets/lyrics.json",
  "bg": { "type": "image", "src": "assets/bg.png",
          "filter": "grayscale(0.5) brightness(0.20) contrast(1.25) saturate(1.3) blur(7px)" },
  "fonts": { "googleUrl": "https://fonts.googleapis.com/css2?family=Anton&display=swap",
             "display": "\"Anton\", sans-serif" },
  "colors": { "ink": "#D2222A", "feats": "#8f8f92", "hint": "#a09da0" },
  "intro": { "title": "Hola\nRemix", "sub": "", "feats": "" },
  "outro": { "leadSec": 8, "title": "Gracias", "sub": "Por ver", "feats": "SUSCRIBITE | NODEMOTION", "support": "Tu apoyo hace posible que sigamos trayendo más contenido." },
  "debug": { "enabled": false },
  "cluster": { "gapSec": 0.55, "maxWords": 5, "maxChars": 26, "bigMaxVh": 0.26,
               "smallRatio": 0.3, "skewBase": -8, "skewJitter": 3, "rotJitter": 1.2, "shakePx": 6 },
  "seed": 11
}] };

async function loadDB() {
  for (const url of ["config.json", "assets/config.json"]) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.json();
    } catch (e) { /* file:// u otro bloqueo — probamos el siguiente nivel */ }
  }
  console.warn("[impacto] No se pudo cargar config.json ni assets/config.json (¿abierto por file://?) — usando DEFAULT_CONFIG embebido.");
  return DEFAULT_CONFIG;
}

const DB = await loadDB();
const CONFIG = DB.configs.find(c => c.id === ACTIVE_ID)
            || DB.configs.find(c => c.id === DB.activeId)
            || DB.configs[0];

/* tema desde el JSON → variables CSS (los defaults del CSS son idénticos al
   caso actual, así que sin config el diseño no cambia en nada) */
(function applyTheme(C) {
  const root = document.documentElement;
  if (C.fonts?.googleUrl) {
    const link = document.querySelector('link[href^="https://fonts.googleapis.com/css2"]');
    if (link && link.href !== C.fonts.googleUrl) link.href = C.fonts.googleUrl;
  }
  if (C.fonts?.display) root.style.setProperty("--fontDisplay", C.fonts.display);
  const col = C.colors || {};
  if (col.ink)   root.style.setProperty("--ink", col.ink);
  if (col.feats) root.style.setProperty("--feats", col.feats);
  if (col.hint)  root.style.setProperty("--hint", col.hint);
  const darkness = C.bg?.darkness || {};
  const opacityVars = {
    center: "--bg-tint-center",
    edge: "--bg-tint-edge",
    outer: "--bg-tint-outer",
    vignette: "--bg-vignette",
  };
  for (const [key, cssVar] of Object.entries(opacityVars)) {
    const value = Number(darkness[key]);
    if (Number.isFinite(value)) {
      root.style.setProperty(cssVar, String(Math.max(0, Math.min(1, value))));
    }
  }
})(CONFIG);
/* ======================================================================== */

const doc = document, $ = id => doc.getElementById(id);
const C = CONFIG, zone = $("clusterZone"), audio = $("audio"), stage = $("stage");
let introDurationSeconds = window.NexaImpactIntro.DEFAULT_DURATION_SECONDS;
const introController = window.NexaImpactIntro.createDOMIntro({
  root: $("intro"),
  config: C.intro || {},
});
let vw = innerWidth, vh = innerHeight;
addEventListener("resize", () => { vw = innerWidth; vh = innerHeight; });

function mulberry32(a) { return function() {
  a |= 0; a = a + 0x6D2B79F5 | 0;
  let t = Math.imul(a ^ a >>> 15, 1 | a);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rng = mulberry32(C.seed);

/* ---- salida compartida en el componente propio de esta plantilla ---- */
const outroController = window.NexaImpactOutro.createDOMOutro({
  root: $("outro"),
  config: C.outro || {},
  onShow: () => {
    doc.body.classList.add("outroActive");
    doc.body.classList.remove("introActive");
    $("intro").classList.add("gone");
    if (active) active.el.classList.add("out");
  },
});

/* ---- lyrics: agrupar en FRASES (clusters) ---- */
async function loadLyrics() {
  try {
    const r = await fetch(C.lyricsUrl);
    if (!r.ok) throw new Error("HTTP " + r.status);
    const j = await r.json();
    const flat = [];
    for (const seg of j.segments) for (const w of seg.words) {
      const clean = w.word.trim().replace(/[.,;!?¡¿"']/g, "");
      if (clean) flat.push({ t: w.start, text: clean });
    }
    if (!flat.length) throw new Error("sin palabras");
    return groupClusters(flat);
  } catch (e) {
    console.warn("[impacto] No se pudo cargar", C.lyricsUrl,
                 "— sirve el HTML por HTTP (Live Server), no por file://.", e);
    return [];
  }
}
function groupClusters(flat) {
  /* conserva el timestamp de CADA palabra: la frase se arma palabra por palabra */
  const out = [];
  let cur = null;
  for (const w of flat) {
    const fits = cur && cur.words.length < C.cluster.maxWords &&
                 (cur.chars + w.text.length + 1) <= C.cluster.maxChars &&
                 (w.t - cur.lastT) < C.cluster.gapSec;
    if (fits) {
      cur.words.push({ text: w.text, t: w.t }); cur.chars += w.text.length + 1; cur.lastT = w.t;
    } else {
      if (cur) out.push(cur);
      cur = { t: w.t, words: [{ text: w.text, t: w.t }], chars: w.text.length, lastT: w.t };
    }
  }
  if (cur) out.push(cur);
  return out;
}

/* ---- composición del clúster: 1 palabra GIGANTE + chicas alrededor ----
   El layout completo se compone de entrada (posiciones estables) pero con
   TODAS las palabras invisibles; cada una se revela A ESTAMPA en su propio
   timestamp — la frase "se arma" palabra por palabra al ritmo de la voz. */
let active = null;   /* { el, seq: [{t, span}] ordenado por tiempo, next } */
function bigIndex(words) {
  let idx = 0;
  for (let i = 1; i < words.length; i++)
    if (words[i].text.length > words[idx].text.length ||
        (words[i].text.length === words[idx].text.length && rng() < 0.5)) idx = i;
  return idx;
}
function beginCluster(cl) {
  /* la frase anterior se DESVANECE al salir */
  if (active) {
    const old = active.el;
    old.classList.add("out");
    __nbSetTimeout(() => old.remove(), 560);
  }
  const el = doc.createElement("div");
  el.className = "cluster";
  el.style.setProperty("--ink", C.colors.ink);
  el.style.setProperty("--skew", (C.cluster.skewBase + (rng() - 0.5) * 2 * C.cluster.skewJitter).toFixed(1) + "deg");
  el.style.setProperty("--rot", ((rng() - 0.5) * 2 * C.cluster.rotJitter).toFixed(2) + "deg");

  const words = cl.words;
  const bi = bigIndex(words);
  const big = words[bi];
  const pre = words.slice(0, bi), post = words.slice(bi + 1);

  const bigFs = Math.min(vw * 0.86 / (Math.max(2, big.text.length) * 0.52), vh * C.cluster.bigMaxVh);
  const smFs = Math.max(vh * 0.032, bigFs * C.cluster.smallRatio);

  const pattern = words.length === 1 ? 0 : Math.floor(rng() * 3);
  const ln = () => { const d = doc.createElement("div"); d.className = "ln"; el.appendChild(d); return d; };
  const spans = [];   /* span por palabra, con su timestamp */
  const put = (line, w, fs, cls) => {
    const s = doc.createElement("span");
    s.className = cls; s.textContent = w.text; s.style.fontSize = fs + "px";
    line.appendChild(s);
    spans.push({ t: w.t, span: s });
  };

  if (pattern === 0) {
    put(ln(), big, bigFs, "bg2");
    if (pre.length || post.length) { const l = ln(); for (const w of [...pre, ...post]) put(l, w, smFs, "sm"); }
  } else if (pattern === 1) {
    const l1 = ln();
    if (pre.length) put(l1, pre[pre.length - 1], smFs, "sm");
    put(l1, big, bigFs, "bg2");
    if (post.length) put(l1, post[0], smFs, "sm");
    const rest = [...pre.slice(0, -1), ...post.slice(1)];
    if (rest.length) { const l2 = ln(); for (const w of rest) put(l2, w, smFs, "sm"); }
  } else {
    if (pre.length) { const l0 = ln(); for (const w of pre) put(l0, w, smFs, "sm"); }
    const l1 = ln(); put(l1, big, bigFs, "bg2");
    if (post.length) { const l2 = ln(); for (const w of post) put(l2, w, smFs, "sm"); }
  }

  zone.appendChild(el);
  /* si la composición se pasa del ancho (móvil vertical, frases largas),
     se encoge entera con --fit sin tocar el layout */
  requestAnimationFrame(() => {
    const rect = el.getBoundingClientRect();
    if (rect.width > vw * 0.94) el.style.setProperty("--fit", (vw * 0.94 / rect.width).toFixed(3));
  });
  spans.sort((a, b) => a.t - b.t);   /* se revelan en el orden en que se cantan */
  active = { el, seq: spans, next: 0 };

  /* golpe grande al abrir la frase */
  punch(1.035, 160);
}
function revealWord(item) {
  item.span.classList.add("on");
  punch(1.014, 90);                  /* golpecito por cada palabra que llega */
}
function punch(zoom, shakeMs) {
  shakeUntil = performance.now() + shakeMs;
  stage.style.transition = "none";
  stage.style.transform = `scale(${zoom})`;
  __nbSetTimeout(() => {
    stage.style.transition = "transform 0.35s ease";
    stage.style.transform = "scale(1)";
  }, 40);
}

/* ---- sacudida ---- */
let shakeUntil = 0;
function applyShake(now) {
  if (now < shakeUntil) {
    const d = (shakeUntil - now) / 160;
    const sx = (rng() - 0.5) * C.cluster.shakePx * 2 * d;
    const sy = (rng() - 0.5) * C.cluster.shakePx * 2 * d;
    zone.style.transform = `translate(${sx}px, ${sy}px)`;
  } else zone.style.transform = "";
}

/* ---- reloj: audio si suena; si no, rAF ---- */
let started = false;
/* La escena sigue al audio: si está pausado, intro y letra se quedan en su tiempo actual. */
const clock = () => Number.isFinite(audio.currentTime) ? audio.currentTime : 0;

async function begin() {
  if (started) return;
  started = true;
  $("hint").style.display = "none";
  try { await audio.play(); } catch (e) { /* reloj de pared */ }
}
addEventListener("pointerdown", begin, { once: true });

/* ---- outro por el final REAL del audio ---- */
let outroShown = false;
function maybeOutro() {
  outroShown = outroController.update(audio.currentTime, audio.duration, audio.ended).active;
}
audio.addEventListener("ended", maybeOutro);


/* ---- main ---- */
let clusters = [], ptr = 0;
function frame(now) {
  const t = clock();
  maybeOutro();
  const introState = introController.update(t, introDurationSeconds, outroShown);
  doc.body.classList.toggle("introActive", introState.active && !outroShown);
  if (!outroShown) {
    while (ptr < clusters.length && t >= clusters[ptr].t) {
      beginCluster(clusters[ptr]);
      ptr++;
    }
    /* revelar las palabras de la frase activa que ya se cantaron */
    if (active) {
      while (active.next < active.seq.length && t >= active.seq[active.next].t) {
        revealWord(active.seq[active.next]);
        active.next++;
      }
    }
  }
  applyShake(now);
  requestAnimationFrame(frame);
}

/* ---- fondo imagen/video con filtro del CONFIG ---- */
function setupBg() {
  if (!C.bg || C.bg.type === "none" || !C.bg.src) return;
  let el = $("bgMedia");
  if (C.bg.type === "video") {
    const v = doc.createElement("video");
    v.id = "bgMedia"; v.muted = true; v.loop = true; v.autoplay = true;
    v.setAttribute("playsinline", "");
    v.preload = "auto";
    el.replaceWith(v); el = v;
  }
  el.src = encodeURI(C.bg.src);
  if (el.tagName === "VIDEO") {
    el.load();
    el.play().catch(() => {});
  }
  el.style.display = "block";
  // El material elegido por la persona controla su propia visibilidad; la
  // demo sin opacity conserva los filtros y tintes originales de la plantilla.
  const customOpacity = C.bg.opacity;
  if (typeof customOpacity === "number" && Number.isFinite(customOpacity)) {
    const value = Math.max(0, Math.min(1, customOpacity));
    el.style.setProperty("--custom-bg-opacity", String(value));
    el.style.filter = "none";
    for (const id of ["darkTint", "warmTint", "coldTint"]) {
      const tint = $(id);
      if (tint) tint.style.opacity = "0.25";
    }
    const vignette = $("vignette");
    if (vignette) vignette.style.opacity = "0.35";
  } else {
    el.style.filter = C.bg.filter || "";
  }
}

setupBg();
audio.src = encodeURI(C.audio.src);
loadLyrics().then(c => {
  clusters = c;
  if (c.length && Number.isFinite(c[0].t)) introDurationSeconds = Math.max(0, c[0].t);
});
begin();
doc.body.classList.add("ready");
requestAnimationFrame(frame);
