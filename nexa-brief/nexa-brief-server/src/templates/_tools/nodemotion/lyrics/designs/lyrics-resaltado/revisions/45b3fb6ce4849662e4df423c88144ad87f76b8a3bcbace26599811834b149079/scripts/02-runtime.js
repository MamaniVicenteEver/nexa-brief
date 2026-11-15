
/* ================================ CONFIG ================================
   RESALTADO: la letra es un libro que alguien ya leyó y marcó con
   resaltador. Cada frase de la canción aparece incrustada dentro de un
   párrafo de "texto de relleno" (genérico, tipo libro de crecimiento
   personal) que llena la pantalla — así nunca queda una pantalla grande
   vacía aunque la letra real sea poca. El párrafo se dibuja DOS veces,
   superpuestas exactamente en la misma posición: una copia de fondo
   borrosa (llena toda la página, da la sensación de foto macro de un
   libro) y una copia nítida encima con una máscara que se desvanece
   arriba/abajo — como el enfoque de una cámara sobre una sola zona de
   lectura. Al llegar el timestamp de cada palabra, un trazo de marcador
   (con bordes irregulares tipo resaltador real, en mix-blend multiply)
   se dibuja de izquierda a derecha DEBAJO de la frase actual, como si
   alguien la estuviera subrayando mientras la canta — más grande que el
   resto del párrafo y, de vez en cuando, mucho más grande (--hlScale es
   impredecible por diseño). Cada frase nueva dispara un CAMBIO DE PÁGINA:
   una página nueva entra deslizándose desde la derecha y CUBRE por
   completo a la anterior (con una sombra en su borde de ataque) — la
   misma gramática visual de pasar la hoja en un lector de libros, sin
   3D ni ambigüedad — revela un párrafo nuevo con relleno fresco y la
   frase siguiente ya incrustada. Intro/outro son una portada de papel mínima
   (misma paleta que las páginas, sin objetos encima) para que todo el
   video se sienta una sola pieza continua.
   La letra se consume 100% de lyricsUrl (formato Whisper:
   { metadata, segments: [ { words: [ { word, start, end } ] } ] } ).
   El CONFIG ya no vive aquí: vive en config.json como colección de casos con
   "id" (mismo patrón que 04-video-motion). Cada objeto trae audio, lyricsUrl,
   intro/outro, phrase, book y seed. El banco de frases de relleno FILLER/
   CONNECTORS es FIJO en este HTML (más abajo) — NUNCA viene del config.json,
   la IA no genera contenido de relleno. Para otra canción del mismo género,
   agregá otro objeto al array "configs" — acá no se toca nada.

   Carga con 3 niveles de fallback (no afecta al pipeline, que siempre sirve
   un config.json real por HTTP y gana en el nivel 1):
     1. fetch("config.json")         — lo que el pipeline genera y sirve.
     2. fetch("assets/config.json")  — default versionado, si serviste esta
        carpeta con un server (python3 -m http.server) sin que el pipeline
        haya escrito un config.json en la raíz.
     3. DEFAULT_CONFIG embebido      — para abrir el archivo con doble clic
        (file://), donde fetch() queda bloqueado por el navegador.
   ========================================================================== */
const ACTIVE_ID = null;   /* <-- forzar un id ("dueles-tan-bien" | ...) · null = usa "activeId" del JSON */

const DEFAULT_CONFIG = { "activeId": "default", "configs": [{
  "id": "default",
  "description": "Página subrayada — la letra aparece como un libro ya leído y marcado con resaltador amarillo, sobre relleno atmosférico de texto genérico, con cambio de página al ritmo de cada frase cantada. — metadata para marketing/SEO, la plantilla no la usa todavía.",
  "audio": { "src": "assets/song.mp3" },
  "lyricsUrl": "assets/lyrics.json",
  "intro": { "artist": "", "title": "Página\nSubrayada", "sub": "", "feats": "" },
  "outro": { "leadSec": 8, "title": "Fin del capítulo", "sub": "Gracias por leer", "feats": "Suscríbete · NEXA BRIEF" },
  "debug": { "enabled": false },
  "phrase": { "gapSec": 0.5, "maxWords": 5, "maxChars": 24 },
  "book": { "markerColors": ["#FFE066", "#FFE066", "#FFE066", "#FFD24A", "#FFB4A8", "#8ED6C0", "#9FC9FF"],
             "fillerBeforeRange": [6, 9], "fillerAfterRange": [6, 9],
             "hlScaleBase": 1.14, "hlScaleRange": 0.5, "hlScalePow": 2.2,
             "hlTiltMaxDeg": 1.6, "turnMs": 520, "turnMsJitter": 0.18 },
  "seed": 29
}] };

async function loadDB() {
  for (const url of ["config.json", "assets/config.json"]) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.json();
    } catch (e) { /* file:// u otro bloqueo — probamos el siguiente nivel */ }
  }
  console.warn("[resaltado] No se pudo cargar config.json ni assets/config.json (¿abierto por file://?) — usando DEFAULT_CONFIG embebido.");
  return DEFAULT_CONFIG;
}

const DB = await loadDB();
const CONFIG = DB.configs.find(c => c.id === ACTIVE_ID)
            || DB.configs.find(c => c.id === DB.activeId)
            || DB.configs[0];
/* ======================================================================== */

/* banco de oraciones genéricas "de libro" — relleno atmosférico, nunca es la letra real */
const FILLER = [
  "El silencio antes del cambio siempre dice más de lo que parece",
  "Nadie recuerda el día exacto en que decidió no rendirse",
  "Hay una versión de vos que todavía no conociste",
  "El miedo no desaparece se aprende a caminar junto a él",
  "Cada intento fallido deja una marca que después sirve de mapa",
  "La paciencia no es esperar es seguir moviéndose despacio",
  "A veces la calma es la forma más valiente de responder",
  "El que insiste después de la caída ya ganó la mitad",
  "No hace falta gritar para que una idea pese",
  "El tiempo no perdona pero tampoco olvida el esfuerzo",
  "Detrás de cada costumbre hay una decisión que un día costó",
  "Lo simple casi siempre esconde la parte más difícil",
  "Aprender a soltar también es una forma de avanzar",
  "El camino cambia pero la intención debería quedarse igual",
  "Nadie construye algo sólido mirando solo el resultado final",
  "La disciplina aparece cuando ya no queda motivación",
  "Un mal día no borra meses de intentarlo",
  "El progreso casi nunca se nota mientras está pasando",
  "Hay preguntas que solo se responden caminando",
  "La costumbre de empezar de nuevo también se entrena",
  "No todo lo que cuesta trabajo se nota desde afuera",
  "El orgullo silencioso dura más que el aplauso rápido",
  "A veces el descanso también es parte del plan",
  "Lo que se repite todos los días termina definiendo quién sos",
  "El error incómodo suele enseñar más que el acierto fácil",
  "Nada cambia de un día para otro pero todo empieza en uno",
  "La constancia no se ve pero se nota con el tiempo",
  "Cada decisión pequeña también construye el resultado grande",
  "El que aprende a esperar también aprende a no rendirse",
  "Hay una calma distinta en saber hacia dónde se va",
  "El esfuerzo silencioso no necesita quien lo aplauda",
  "Volver a intentar también es una forma de valentía",
  "Nadie llega lejos sin antes perderse un poco",
  "La costumbre de seguir cuando nadie mira también cuenta",
  "El cambio real casi nunca hace ruido al principio",
  "Hay una fuerza distinta en decidir seguir de todos modos",
  "El tiempo perdido también enseña a valorar el que queda",
  "La duda no siempre significa que vas por mal camino",
  "Cada página nueva empieza con una decisión pequeña",
  "Lo que hoy parece difícil mañana será solo un recuerdo"
];
const CONNECTORS = [
  "y por eso", "hasta que", "de a poco", "sin darse cuenta", "en el fondo",
  "aunque no lo pareciera", "como si ya", "otra vez", "de todas formas", "muy en el fondo"
];

const doc = document, $ = id => doc.getElementById(id);
const C = CONFIG, flipper = $("flipper"), audio = $("audio");
let vw = innerWidth, vh = innerHeight;
addEventListener("resize", () => { vw = innerWidth; vh = innerHeight; });

function mulberry32(a) { return function() {
  a |= 0; a = a + 0x6D2B79F5 | 0;
  let t = Math.imul(a ^ a >>> 15, 1 | a);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rng = mulberry32(C.seed);

const escapeHtml = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* ---- intro / outro: misma tapa (.cover), textos distintos ---- */
function buildCard(id, cfg) {
  const i = $(id);
  i.querySelector(".artist").textContent = cfg.artist ?? "";
  i.querySelector(".title").textContent = cfg.title;
  i.querySelector(".sub").textContent = cfg.sub;
  i.querySelector(".feats").textContent = cfg.feats;
}
buildCard("intro", C.intro);
buildCard("outro", C.outro);

/* ---- lyrics: agrupar en FRASES cortas (una línea de marcador cada una) ---- */
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
    return groupPhrases(flat);
  } catch (e) {
    console.warn("[resaltado-letras-V1] No se pudo cargar", C.lyricsUrl,
                 "— sirve el HTML por HTTP (Live Server), no por file://.", e);
    return [];
  }
}
function groupPhrases(flat) {
  const P = C.phrase, out = [];
  let cur = null;
  for (const w of flat) {
    const fits = cur && cur.words.length < P.maxWords &&
                 (cur.chars + w.text.length + 1) <= P.maxChars &&
                 (w.t - cur.lastT) < P.gapSec;
    if (fits) { cur.words.push(w); cur.chars += w.text.length + 1; cur.lastT = w.t; }
    else { if (cur) out.push(cur); cur = { t: w.t, words: [w], chars: w.text.length, lastT: w.t }; }
  }
  if (cur) out.push(cur);
  return out;
}

/* ---- relleno "de libro": arma un párrafo con la frase resaltada incrustada ---- */
let lastFillerIdx = -1;
function pickFiller() {
  let i = Math.floor(rng() * FILLER.length);
  if (i === lastFillerIdx) i = (i + 1) % FILLER.length;
  lastFillerIdx = i;
  return FILLER[i];
}
const pickConnector = () => CONNECTORS[Math.floor(rng() * CONNECTORS.length)];
const pickMarkerColor = () => C.book.markerColors[Math.floor(rng() * C.book.markerColors.length)];

/* bordes irregulares del trazo de marcador — nunca un rectángulo perfecto */
function roughMarkerPoly() {
  const segs = 5, pts = [];
  for (let i = 0; i <= segs; i++) pts.push(`${(i / segs * 108 - 4).toFixed(1)}% ${(rng() * 12).toFixed(1)}%`);
  for (let i = segs; i >= 0; i--) pts.push(`${(i / segs * 108 - 4).toFixed(1)}% ${(88 + rng() * 12).toFixed(1)}%`);
  return `polygon(${pts.join(",")})`;
}

function buildParagraphHTML(phrase) {
  const B = C.book;
  const nBefore = B.fillerBeforeRange[0] + Math.floor(rng() * (B.fillerBeforeRange[1] - B.fillerBeforeRange[0] + 1));
  const nAfter  = B.fillerAfterRange[0]  + Math.floor(rng() * (B.fillerAfterRange[1]  - B.fillerAfterRange[0]  + 1));
  const before = Array.from({ length: nBefore }, pickFiller).join(". ") + ". ";
  const after  = " " + Array.from({ length: nAfter }, pickFiller).join(". ") + ".";
  const connPre  = rng() < 0.5 ? pickConnector() + " " : "";
  const connPost = rng() < 0.5 ? ", " + pickConnector() : "";
  const words = phrase.words.map(w => w.text).join(" ");
  const clip = roughMarkerPoly();
  const color = pickMarkerColor();
  /* tamaño impredecible pero con intención: rng^pow sesga a valores modestos y
     deja que unas pocas frases "griten" mucho más grandes que el párrafo */
  const hlScale = (B.hlScaleBase + Math.pow(rng(), B.hlScalePow) * B.hlScaleRange).toFixed(3);
  const hlTilt = ((rng() - 0.5) * 2 * B.hlTiltMaxDeg).toFixed(2);
  const hlHTML = `<span class="hl" data-tilt="${hlTilt}" style="--hlScale:${hlScale};transform:rotate(${hlTilt}deg)"><span class="hlMark" style="clip-path:${clip};-webkit-clip-path:${clip}"><span class="hlFill" style="background:${color}"></span></span><span class="hlText">${escapeHtml(words)}</span></span>`;
  return before + connPre + hlHTML + connPost + after;
}

/* ---- checkpoints: progreso del trazo (0→1) interpolado entre timestamps reales ---- */
function buildCheckpoints(words, phraseT) {
  let cum = 0;
  const chk = [{ t: phraseT - 0.05, c: 0 }];
  for (const w of words) {
    const len = w.text.length + 1;
    const dur = Math.max(0.10, Math.min(0.38, len * 0.06));
    chk.push({ t: w.t, c: cum });
    cum += len;
    chk.push({ t: w.t + dur, c: cum });
  }
  return { chk, total: Math.max(1, cum - 1) };
}
function progressAt(t, chk, total) {
  if (t <= chk[0].t) return 0;
  for (let i = 1; i < chk.length; i++) {
    if (t <= chk[i].t) {
      const a = chk[i - 1], b = chk[i];
      const f = b.t > a.t ? (t - a.t) / (b.t - a.t) : 1;
      return Math.min(1, (a.c + (b.c - a.c) * f) / total);
    }
  }
  return 1;
}

/* ---- construir el contenido de una página (relleno + frase resaltada) ---- */
function buildPageContent(pageEl, phrase) {
  const html = buildParagraphHTML(phrase);
  pageEl.querySelector(".pageTextBlur p").innerHTML = html;
  pageEl.querySelector(".pageTextSharp p").innerHTML = html;
  pageEl.style.setProperty("--stainX", (10 + rng() * 80).toFixed(1) + "%");
  pageEl.style.setProperty("--stainY", (10 + rng() * 80).toFixed(1) + "%");
  pageEl.style.setProperty("--tilt", ((rng() - 0.5) * 1.1).toFixed(2) + "deg");

  const fillSharp = pageEl.querySelector(".pageTextSharp .hlFill");
  const fillBlur  = pageEl.querySelector(".pageTextBlur .hlFill");
  /* red de seguridad: si la frase es rarísimamente larga, achica en vez de desbordar */
  requestAnimationFrame(() => {
    for (const hl of pageEl.querySelectorAll(".hl")) {
      const r = hl.getBoundingClientRect();
      if (r.width > vw * 0.8) {
        const tilt = hl.dataset.tilt || 0;
        hl.style.transform = `rotate(${tilt}deg) scale(${(vw * 0.8 / r.width).toFixed(3)})`;
      }
    }
  });
  const { chk, total } = buildCheckpoints(phrase.words, phrase.t);
  return { fillSharp, fillBlur, chk, total };
}

/* ---- cambio de página: la nueva entra deslizándose desde la derecha y CUBRE
   por completo a la anterior — una transición simple e inequívoca de "página
   siguiente" (como un lector de libros/PDF), sin 3D ni ambigüedad ---- */
const pages = [$("pageA"), $("pageB")];
const turnShadow = $("turnShadow");
let frontIdx = 0, activeHL = null;
pages[0].style.zIndex = 2; pages[0].style.transform = "translateX(0%)";
pages[1].style.zIndex = 1; pages[1].style.transform = "translateX(102%)";

function turnToPhrase(phrase) {
  const B = C.book;
  const back = pages[1 - frontIdx];
  activeHL = { ...buildPageContent(back, phrase), t: phrase.t };

  /* cada cambio de página es un poco distinto en duración — nunca clavado igual */
  const ms = Math.round(B.turnMs * (1 + (rng() - 0.5) * 2 * B.turnMsJitter));

  back.style.zIndex = 2;
  back.style.transition = "none";
  back.style.transform = "translateX(102%)";
  turnShadow.style.transition = `opacity ${Math.round(ms * 0.35)}ms ease`;
  turnShadow.classList.add("show");
  requestAnimationFrame(() => requestAnimationFrame(() => {
    back.style.transition = `transform ${ms}ms cubic-bezier(0.32, 0.02, 0.13, 1)`;
    back.style.transform = "translateX(0%)";
  }));
  __nbSetTimeout(() => {
    turnShadow.classList.remove("show");
    pages[frontIdx].style.zIndex = 1;   /* la vieja queda tapada, atrás */
    frontIdx = 1 - frontIdx;
  }, ms + 30);
}

/* ---- reloj: audio si suena; si no, rAF ---- */
let rafT0 = null, rafNow = 0, started = false;
const clock = () => (!audio.paused && audio.currentTime > 0.05)
  ? audio.currentTime
  : (rafT0 === null ? 0 : (rafNow - rafT0) / 1000);

async function begin() {
  if (started) return;
  started = true;
  $("hint").style.display = "none";
  try { await audio.play(); } catch (e) { /* reloj de pared */ }
}
addEventListener("pointerdown", begin, { once: true });

/* ---- outro: se dispara por el FINAL REAL del audio, no por la letra ---- */
let outroShown = false;
function maybeOutro() {
  if (outroShown) return;
  const dur = audio.duration;
  if (!isFinite(dur) || dur <= 0) return;
  if (audio.ended || (dur - audio.currentTime) <= C.outro.leadSec) {
    outroShown = true;
    doc.body.classList.add("outroActive");
    $("intro").classList.add("gone");
    $("outro").classList.add("show");
  }
}
audio.addEventListener("ended", maybeOutro);

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
      turnToPhrase(phrases[ptr]);
      ptr++;
    }
  }
  if (activeHL) {
    const p = progressAt(t, activeHL.chk, activeHL.total);
    const s = `scaleX(${p.toFixed(4)})`;
    activeHL.fillSharp.style.transform = s;
    activeHL.fillBlur.style.transform = s;
  }
  requestAnimationFrame(frame);
}

audio.src = encodeURI(C.audio.src);
loadLyrics().then(p => { phrases = p; });
begin();
requestAnimationFrame(frame);
