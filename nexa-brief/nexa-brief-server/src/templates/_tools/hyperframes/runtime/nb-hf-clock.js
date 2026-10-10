/* nb-hf-clock — reloj determinístico para grabar plantillas con HyperFrames.

   Por qué existe: las plantillas de letras miden el tiempo con audio.currentTime,
   requestAnimationFrame, timers y animaciones CSS/WAAPI corriendo en tiempo
   real. HyperFrames captura cuadro a cuadro (screenshot por seek) y eso rompe
   todos esos relojes: el runtime pausa el <audio> (lo trata como media propia),
   su shim de tiempo virtual dispara UN solo rAF por seek (30 Hz en vez de 60:
   las cámaras con easing por cuadro se mueven a la mitad de velocidad), los
   setTimeout siguen en reloj de pared y cada worker arranca su tramo en t>0
   sin el historial de la plantilla. Resultado: la letra sale desfasada.

   Qué hace (SOLO dentro del render de HyperFrames — en navegador, vista previa
   y Playwright es inerte, ver ACTIVE):
   - Reproduce el mundo de la plantilla a 60 Hz fijos desde t=0 hasta el tiempo
     de cada seek (también los workers que empiezan a mitad de canción), así el
     estado acumulado (cámaras, palabras ya puestas, partículas) es idéntico en
     todos los workers y al de un navegador real.
   - Virtualiza performance.now/Date.now, setTimeout/setInterval (la plantilla
     llama a __nbSetTimeout & cía., reescritos por optimize.py), el reloj de
     <audio>/<video> (currentTime/paused/ended/play/pause), las animaciones
     CSS/WAAPI (currentTime por animación según su nacimiento virtual) y el
     AnalyserNode de WebAudio (espectro calculado del audio decodificado).
   - Antes del primer cuadro espera fuentes, fetch, imágenes y metadatos de
     media; antes de cada captura espera decodificación de imágenes nuevas y el
     cuadro exacto de cada <video>.
   - Deja el audio de la mezcla al framework: la pista que mezcla HyperFrames es
     el <audio data-nb-hf-mix> que agrega HyperframesAdapter; la media propia de
     la plantilla pierde sus data-start (inyectados por el compilador) para que
     el runtime no la pause ni la mezcle dos veces.

   Fuente única: src/templates/_tools/hyperframes/runtime/nb-hf-clock.js.
   optimize.py la inserta (inline) como primer <script> de cada plantilla. */
(function () {
  "use strict";
  var W = window;
  var D = document;
  if (W.__nbHf) return;

  var VT = W.__HF_VIRTUAL_TIME__;
  var ACTIVE = !!(VT && typeof VT.seekToTime === "function" && W.__HF_RENDER_CAPTURE_MODE === true);

  /* Timers reescritos: fuera del render son exactamente los nativos, resueltos
     en cada llamada (la vista previa de la app también los envuelve). */
  if (!ACTIVE) {
    W.__nbSetTimeout = function () { return W.setTimeout.apply(W, arguments); };
    W.__nbSetInterval = function () { return W.setInterval.apply(W, arguments); };
    W.__nbClearTimeout = function () { return W.clearTimeout.apply(W, arguments); };
    W.__nbClearInterval = function () { return W.clearInterval.apply(W, arguments); };
    W.__nbHf = { active: false };
    return;
  }

  var STEP_MS = 1000 / 60;          /* cadencia interna = rAF de un monitor de 60 Hz */
  var origSeekToTime = VT.seekToTime;
  var realSetTimeout = VT.originalSetTimeout || W.setTimeout.bind(W);
  var realPerfNow = Performance.prototype.now;
  function wallMs() { return realPerfNow.call(W.performance); }
  var realClearTimeout = VT.originalClearTimeout || W.clearTimeout.bind(W);
  var clockMs = 0;                   /* reloj virtual que ve la plantilla */
  var stepIdx = -1;                  /* último tick ejecutado (tick k = k·STEP_MS) */
  var targetStep = -1;
  var ticking = false;
  var processing = null;
  var stats = { ticks: 0, seeks: 0, backward: 0, firstSeekMs: null, readyMs: 0, waits: 0,
                tickMs: 0, videoMs: 0, settleMs: 0 };
  var logs = [];
  function log(msg) { if (logs.length < 200) logs.push(msg); }
  function slice(a, from) { return Array.prototype.slice.call(a, from); }
  function sleep(ms) { return new Promise(function (r) { realSetTimeout(r, ms); }); }
  function withTimeout(p, ms) {
    return new Promise(function (resolve) {
      var done = false;
      var id = realSetTimeout(function () { if (!done) { done = true; resolve("timeout"); } }, ms);
      Promise.resolve(p).then(function (v) { if (!done) { done = true; realClearTimeout(id); resolve(v); } },
        function () { if (!done) { done = true; realClearTimeout(id); resolve("error"); } });
    });
  }

  /* ───────────────────────────── reloj ───────────────────────────── */
  try {
    Object.defineProperty(W.performance, "now", { configurable: true, value: function () { return clockMs; } });
  } catch (e) { log("performance.now no redefinible"); }
  try { W.Date.now = function () { return clockMs; }; } catch (e) { log("Date.now no redefinible"); }

  /* Math.random sembrado: mismo historial en todos los workers (sin costura). */
  (function () {
    var s = 0x6e622d68 | 0;
    Math.random = function () {
      s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  })();

  /* rAF: el de HyperFrames ya es virtual (cola que vacía seekToTime); acá solo
     se cuenta cuántas veces se pidió, para saber cuándo arrancó el loop. */
  var RAF = "requestAnimationFrame";
  var hfRaf = W[RAF];
  var rafRequests = 0;
  W[RAF] = function (cb) { rafRequests++; return hfRaf.call(W, cb); };

  /* ───────────────────────────── timers ─────────────────────────────
     Disparados por el tick cuando su vencimiento virtual llega, en orden. */
  var timers = new Map();
  var timerSeq = 1;
  function addTimer(fn, delay, args, repeat) {
    if (typeof fn !== "function") { var code = String(fn); fn = function () { (0, eval)(code); }; }
    var d = Math.max(0, Number(delay) || 0);
    var id = timerSeq++;
    timers.set(id, { id: id, due: clockMs + d, fn: fn, args: args, every: repeat ? Math.max(1, d) : 0, seq: id });
    return id;
  }
  W.__nbSetTimeout = function (fn, delay) { return addTimer(fn, delay, slice(arguments, 2), false); };
  W.__nbSetInterval = function (fn, delay) { return addTimer(fn, delay, slice(arguments, 2), true); };
  W.__nbClearTimeout = function (id) { timers.delete(id); };
  W.__nbClearInterval = function (id) { timers.delete(id); };
  function runTimers(upTo) {
    for (var guard = 0; guard < 20000; guard++) {
      var next = null;
      timers.forEach(function (t) {
        if (t.due <= upTo + 1e-6 && (!next || t.due < next.due || (t.due === next.due && t.seq < next.seq))) next = t;
      });
      if (!next) return;
      if (next.every) { next.due += next.every; next.seq = timerSeq++; } else timers.delete(next.id);
      clockMs = Math.max(clockMs, next.due);
      try { next.fn.apply(W, next.args); } catch (e) { log("timer: " + e); }
    }
  }

  /* ───────────────────────────── media ─────────────────────────────
     La media de la plantilla nunca se reproduce de verdad durante el render:
     su reloj es virtual y los <video> se posicionan con seek real antes de
     cada captura. El <audio data-nb-hf-mix> del adapter queda intacto. */
  var MP = HTMLMediaElement.prototype;
  var desc = function (proto, name) {
    for (var p = proto; p; p = Object.getPrototypeOf(p)) {
      var d = Object.getOwnPropertyDescriptor(p, name);
      if (d) return d;
    }
    return null;
  };
  var dCurrent = desc(MP, "currentTime");
  var dPaused = desc(MP, "paused");
  var dEnded = desc(MP, "ended");
  var dRate = desc(MP, "playbackRate");
  var dAutoplay = desc(MP, "autoplay");
  var realPlay = MP.play;
  var realPause = MP.pause;
  var realLoad = MP.load;
  var mediaState = new WeakMap();
  var videos = new Set();
  var mediaEls = new Set();
  var isMix = function (el) { return el.hasAttribute && el.hasAttribute("data-nb-hf-mix"); };
  var TIMING_ATTRS = ["data-start", "data-end", "data-hf-auto-start", "data-has-audio"];

  function adopt(el) {
    if (!(el instanceof HTMLMediaElement) || isMix(el)) return null;
    var st = mediaState.get(el);
    if (!st) {
      st = { playing: false, base: 0, v0: 0, ended: false, autoplay: false, userPaused: false, started: false };
      mediaState.set(el, st);
      mediaEls.add(el);
      if (el instanceof HTMLVideoElement) videos.add(el);
    }
    for (var i = 0; i < TIMING_ATTRS.length; i++) if (el.hasAttribute(TIMING_ATTRS[i])) el.removeAttribute(TIMING_ATTRS[i]);
    if (el.hasAttribute("autoplay")) { st.autoplay = true; el.removeAttribute("autoplay"); }
    return st;
  }
  /* El runtime de HyperFrames sincroniza por su cuenta la media que cree suya
     (en renderSeek fija currentTime = t de composición y la pausa): con un
     <video loop> de la plantilla eso lo congela en su último cuadro al pasar
     su duración. Todo lo que el runtime haga desde window.__player (renderSeek,
     seek, play, pause) se ignora sobre la media de la plantilla; su reloj es
     el virtual y su cuadro lo pone syncVideos(). */
  var runtimeDepth = 0;
  function guardPlayer(p) {
    if (!p || typeof p !== "object") return;
    ["renderSeek", "seek", "play", "pause"].forEach(function (name) {
      var f = p[name];
      if (typeof f !== "function" || f.__nbHfGuard) return;
      var g = function () { runtimeDepth++; try { return f.apply(this, arguments); } finally { runtimeDepth--; } };
      g.__nbHfGuard = true;
      p[name] = g;
    });
  }
  var playerVal = W.__player;
  try {
    Object.defineProperty(W, "__player", {
      configurable: true,
      get: function () { return playerVal; },
      set: function (v) { playerVal = v; guardPlayer(v); },
    });
    guardPlayer(playerVal);
  } catch (e) { log("__player no envolvible"); }
  function fromRuntime(el) { return runtimeDepth > 0 && mediaState.has(el); }

  function realDuration(el) { var d = el.duration; return isFinite(d) && d > 0 ? d : NaN; }
  function rateOf(el) { var r = dRate.get.call(el); return isFinite(r) && r > 0 ? r : 1; }
  function mediaTimeAt(el, st, ms) {
    var t = st.base + (st.playing ? (ms - st.v0) / 1000 * rateOf(el) : 0);
    var dur = realDuration(el);
    if (dur === dur) {
      if (el.loop) { if (t >= dur) t = t % dur; } else if (t > dur) t = dur;
    }
    return Math.max(0, t);
  }
  function fire(el, type) { queueMicrotask(function () { try { el.dispatchEvent(new Event(type)); } catch (e) {} }); }
  function startPlaying(el, st) {
    if (st.playing) return;
    var dur = realDuration(el);
    if (st.ended || (dur === dur && !el.loop && st.base >= dur)) { st.base = 0; st.ended = false; }
    st.playing = true; st.started = true; st.v0 = clockMs;
    fire(el, "play"); fire(el, "playing");
  }

  MP.play = function () {
    if (fromRuntime(this)) return Promise.resolve();
    var st = adopt(this);
    if (!st) return realPlay.apply(this, arguments);
    st.userPaused = false;
    startPlaying(this, st);
    return Promise.resolve();
  };
  MP.pause = function () {
    if (fromRuntime(this)) return;
    var st = adopt(this);
    if (!st) return realPause.apply(this, arguments);
    st.userPaused = true;
    if (st.playing) { st.base = mediaTimeAt(this, st, clockMs); st.playing = false; fire(this, "pause"); }
  };
  MP.load = function () {
    if (fromRuntime(this)) return;
    var st = adopt(this);
    if (st) { st.playing = false; st.base = 0; st.ended = false; }
    return realLoad.apply(this, arguments);
  };
  Object.defineProperty(MP, "currentTime", {
    configurable: true, enumerable: dCurrent.enumerable,
    get: function () { var st = mediaState.get(this); return st ? mediaTimeAt(this, st, clockMs) : dCurrent.get.call(this); },
    set: function (v) {
      if (fromRuntime(this)) return;
      var st = adopt(this);
      if (!st) return dCurrent.set.call(this, v);
      st.base = Math.max(0, Number(v) || 0); st.v0 = clockMs; st.ended = false;
    },
  });
  Object.defineProperty(MP, "paused", {
    configurable: true, enumerable: dPaused.enumerable,
    get: function () { var st = mediaState.get(this); return st ? !st.playing : dPaused.get.call(this); },
  });
  Object.defineProperty(MP, "ended", {
    configurable: true, enumerable: dEnded.enumerable,
    get: function () { var st = mediaState.get(this); return st ? st.ended : dEnded.get.call(this); },
  });
  Object.defineProperty(MP, "playbackRate", {
    configurable: true, enumerable: dRate.enumerable,
    get: function () { return dRate.get.call(this); },
    set: function (v) {
      if (fromRuntime(this)) return;
      var st = adopt(this);
      if (st && st.playing) { st.base = mediaTimeAt(this, st, clockMs); st.v0 = clockMs; }
      dRate.set.call(this, v);
    },
  });
  if (dAutoplay) {
    Object.defineProperty(MP, "autoplay", {
      configurable: true, enumerable: dAutoplay.enumerable,
      get: function () { var st = mediaState.get(this); return st ? st.autoplay : dAutoplay.get.call(this); },
      set: function (v) { var st = adopt(this); if (st) st.autoplay = !!v; else dAutoplay.set.call(this, v); },
    });
  }
  /* <audio>/<video> del HTML estático: el compilador de HyperFrames les inyecta
     data-start="0" — se los quitamos apenas aparecen, antes del init del runtime. */
  function scanMedia(root) {
    if (!root || !root.querySelectorAll) return;
    if (root instanceof HTMLMediaElement) adopt(root);
    var list = root.querySelectorAll("audio,video");
    for (var i = 0; i < list.length; i++) adopt(list[i]);
  }
  new MutationObserver(function (records) {
    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      if (r.type === "attributes") { if (r.target instanceof HTMLMediaElement && !isMix(r.target)) adopt(r.target); continue; }
      for (var j = 0; j < r.addedNodes.length; j++) if (r.addedNodes[j].nodeType === 1) scanMedia(r.addedNodes[j]);
    }
  }).observe(D.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: TIMING_ATTRS.concat(["autoplay"]) });
  D.addEventListener("DOMContentLoaded", function () { scanMedia(D); }, { once: true });

  function mediaTick(ms) {
    mediaEls.forEach(function (el) {
      var st = mediaState.get(el);
      if (!st) return;
      if (st.autoplay && !st.started && !st.userPaused && (el.currentSrc || el.getAttribute("src"))) startPlaying(el, st);
      if (!st.playing || el.loop) return;
      var dur = realDuration(el);
      if (dur === dur && st.base + (ms - st.v0) / 1000 * rateOf(el) >= dur) {
        st.base = dur; st.playing = false; st.ended = true;
        fire(el, "timeupdate"); fire(el, "pause"); fire(el, "ended");
      }
    });
  }
  /* <video> usados como fuente de canvas (2D o WebGL): se sincronizan siempre,
     aunque estén fuera del documento u ocultos — lo visible es el canvas. */
  var drawnVideos = new WeakSet();
  function tagVideoSource(proto, name, argIndex) {
    if (!proto || typeof proto[name] !== "function") return;
    var real = proto[name];
    proto[name] = function () {
      var src = arguments[argIndex];
      if (src instanceof HTMLVideoElement) drawnVideos.add(src);
      return real.apply(this, arguments);
    };
  }
  tagVideoSource(W.CanvasRenderingContext2D && W.CanvasRenderingContext2D.prototype, "drawImage", 0);
  tagVideoSource(W.OffscreenCanvasRenderingContext2D && W.OffscreenCanvasRenderingContext2D.prototype, "drawImage", 0);
  ["WebGLRenderingContext", "WebGL2RenderingContext"].forEach(function (k) {
    var p = W[k] && W[k].prototype;
    if (!p) return;
    /* texImage2D(target, level, internalformat, format, type, source) → fuente en 5;
       texSubImage2D(target, level, x, y, format, type, source) → fuente en 6 */
    tagVideoSource(p, "texImage2D", 5);
    tagVideoSource(p, "texSubImage2D", 6);
  });
  /* Cuadro exacto de cada <video>: seek real al tiempo virtual y esperar "seeked". */
  function syncVideos() {
    var waits = [];
    videos.forEach(function (v) {
      var st = mediaState.get(v);
      if (!st || !(v.currentSrc || v.getAttribute("src")) || v.error) return;
      /* Solo los que se ven en ESTE cuadro: un <video> fuera del documento (escena
         pre-armada o ya descartada) o sin caja (display:none) no aparece en la
         captura. Sin este filtro, las plantillas con muchos clips (grunge, sad,
         promos) esperaban el "seeked" de 6-8 videos invisibles por cuadro y
         Chrome terminaba sin memoria. Cuando el video aparece, se posiciona en
         ese mismo cuadro antes de capturar: el resultado es idéntico. */
      if (!drawnVideos.has(v)) {
        if (!v.isConnected) {
          if (!v.currentSrc) { videos.delete(v); return; }
          /* con padre = parte de una escena armada fuera del documento; sin
             padre puede ser fuente de canvas todavía no dibujada: se sincroniza */
          if (v.parentNode) return;
        } else if (!v.getClientRects().length) return;
      }
      var want = mediaTimeAt(v, st, clockMs);
      var have = dCurrent.get.call(v);
      if (Math.abs(have - want) < 0.0005 && v.readyState >= 2 && !v.seeking) return;
      waits.push(withTimeout(new Promise(function (resolve) {
        var done = function () { v.removeEventListener("seeked", done); v.removeEventListener("error", done); resolve(); };
        v.addEventListener("seeked", done);
        v.addEventListener("error", done);
        try { dCurrent.set.call(v, want); } catch (e) { done(); }
      }), 4000));
    });
    return waits.length ? Promise.all(waits) : null;
  }

  /* ───────────────────────────── animaciones ─────────────────────────────
     Cada animación (CSS animation/transition o el.animate) tiene un modelo
     virtual: nace en el tick en que aparece y su currentTime se fija en cada
     tick. Las que la plantilla maneja a mano (pause + currentTime, como el motor
     WAAPI de Caution) conservan exactamente lo que la plantilla pidió. */
  var AP = Animation.prototype;
  var dAnimCurrent = desc(AP, "currentTime");
  var dAnimRate = desc(AP, "playbackRate");
  var dPlayState = desc(AP, "playState");
  var realAnimPlay = AP.play;
  var realAnimPause = AP.pause;
  var realDocGetAnimations = Document.prototype.getAnimations;
  var models = new Map();
  function animRate(a) { var r = dAnimRate.get.call(a); return isFinite(r) && r !== 0 ? r : 1; }
  function modelTime(m, a) { return m.playing ? (clockMs - m.startV) * animRate(a) : m.hold; }
  function ensureModel(a, fresh) {
    var m = models.get(a);
    if (m) return m;
    var state = dPlayState.get.call(a);
    var ct = Number(dAnimCurrent.get.call(a)) || 0;
    /* una animación recién nacida corriendo arranca en 0 en este tick (su
       currentTime real son ms de reloj de pared, no deterministas) */
    m = state === "paused" ? { playing: false, hold: ct, startV: 0 }
      : { playing: true, hold: 0, startV: clockMs - (fresh ? 0 : ct / animRate(a)) };
    models.set(a, m);
    return m;
  }
  AP.pause = function () {
    var m = ensureModel(this, true);
    if (m.playing) { m.hold = modelTime(m, this); m.playing = false; }
    return realAnimPause.apply(this, arguments);
  };
  AP.play = function () {
    var m = ensureModel(this, true);
    if (!m.playing) {
      var end = this.effect && this.effect.getComputedTiming ? this.effect.getComputedTiming().endTime : Infinity;
      if (animRate(this) > 0 && isFinite(end) && m.hold >= end) m.hold = 0;
      m.startV = clockMs - m.hold / animRate(this); m.playing = true;
    }
    /* el real queda pausado: el tiempo lo fija applyAnimations() */
    realAnimPause.call(this);
    try { dAnimCurrent.set.call(this, modelTime(m, this)); } catch (e) {}
  };
  Object.defineProperty(AP, "currentTime", {
    configurable: true, enumerable: dAnimCurrent.enumerable,
    get: function () { var m = models.get(this); return m ? modelTime(m, this) : dAnimCurrent.get.call(this); },
    set: function (v) {
      var m = ensureModel(this, true);
      var x = Number(v) || 0;
      if (m.playing) m.startV = clockMs - x / animRate(this); else m.hold = x;
      dAnimCurrent.set.call(this, v);
    },
  });
  Object.defineProperty(AP, "playbackRate", {
    configurable: true, enumerable: dAnimRate.enumerable,
    get: function () { return dAnimRate.get.call(this); },
    set: function (v) {
      var m = models.get(this);
      var t = m ? modelTime(m, this) : 0;
      dAnimRate.set.call(this, v);
      if (m && m.playing) m.startV = clockMs - t / animRate(this);
    },
  });
  /* El runtime de HyperFrames trae adaptadores CSS/WAAPI que fijan currentTime
     con el tiempo ABSOLUTO del seek (las animaciones que nacen a mitad de
     canción quedan corridas). Se les esconde todo: no ven animaciones, no
     parchean el.animate y el adaptador CSS opera sobre un handle inerte (si
     viera una lista vacía escribiría animation-delay inline en el elemento). */
  var INERT_HANDLE = { currentTime: 0, effect: null, pause: function () {}, play: function () {} };
  Document.prototype.getAnimations = function () { return []; };
  Element.prototype.getAnimations = function () { return [INERT_HANDLE]; };
  try {
    Object.defineProperty(Element.prototype, "__hfOriginalAnimate", { configurable: true, value: Element.prototype.animate });
  } catch (e) {}

  function applyAnimations() {
    models.forEach(function (m, a) {
      var state = dPlayState.get.call(a);
      if (state === "idle") { models.delete(a); return; }
      if (state !== "paused") realAnimPause.call(a);
      try { dAnimCurrent.set.call(a, modelTime(m, a)); } catch (e) {}
    });
  }
  function discoverAnimations() {
    var list = realDocGetAnimations.call(D);
    for (var i = 0; i < list.length; i++) {
      var a = list[i];
      if (models.has(a)) continue;
      var m = ensureModel(a, true);
      if (dPlayState.get.call(a) !== "paused") realAnimPause.call(a);
      try { dAnimCurrent.set.call(a, modelTime(m, a)); } catch (e) {}
    }
  }

  /* ───────────────────────────── WebAudio ─────────────────────────────
     AnalyserNode virtual sobre el audio decodificado: mismo algoritmo que el
     navegador (ventana Blackman, FFT, suavizado, dB → byte), muestreado en el
     tiempo virtual del <audio> que lo alimenta. */
  var pendingAsync = 0;
  var RealAC = W.AudioContext || W.webkitAudioContext;
  var decodeCache = new Map();
  function decodeFor(el, rate) {
    var src = el.currentSrc || el.src;
    var key = src + "@" + rate;
    if (!decodeCache.has(key)) {
      pendingAsync++;
      var p = fetch(src).then(function (r) { return r.arrayBuffer(); })
        .then(function (buf) { return new OfflineAudioContext(1, 1, rate).decodeAudioData(buf); })
        .then(function (ab) {
          var n = ab.length, mono = new Float32Array(n), ch = ab.numberOfChannels;
          for (var c = 0; c < ch; c++) { var d = ab.getChannelData(c); for (var i = 0; i < n; i++) mono[i] += d[i] / ch; }
          return mono;
        })
        .catch(function (e) { log("decode audio: " + e); return null; })
        .finally(function () { pendingAsync--; });
      decodeCache.set(key, { promise: p, data: null });
      p.then(function (d) { decodeCache.get(key).data = d; });
    }
    return decodeCache.get(key);
  }
  function fftMag(re, im) {
    var n = re.length, i, j, k, len;
    for (i = 1, j = 0; i < n; i++) {
      var bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { var tr = re[i]; re[i] = re[j]; re[j] = tr; var ti = im[i]; im[i] = im[j]; im[j] = ti; }
    }
    for (len = 2; len <= n; len <<= 1) {
      var ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
      for (i = 0; i < n; i += len) {
        var cr = 1, ci = 0;
        for (k = 0; k < len / 2; k++) {
          var ar = re[i + k], ai = im[i + k];
          var br = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
          var bi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
          re[i + k] = ar + br; im[i + k] = ai + bi;
          re[i + k + len / 2] = ar - br; im[i + k + len / 2] = ai - bi;
          var ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
        }
      }
    }
  }
  function FakeNode(ctx) { this.context = ctx; this._src = null; }
  FakeNode.prototype.connect = function (node) {
    if (node && node instanceof FakeAnalyser && this._src) node._src = this._src;
    if (node && node instanceof FakeNode && this._src) node._src = this._src;
    return node;
  };
  FakeNode.prototype.disconnect = function () {};
  function FakeAnalyser(ctx) {
    FakeNode.call(this, ctx);
    this.fftSize = 2048; this.smoothingTimeConstant = 0.8; this.minDecibels = -100; this.maxDecibels = -30;
    this._smooth = null; this._lastMs = -1; this._mags = null;
  }
  FakeAnalyser.prototype = Object.create(FakeNode.prototype);
  Object.defineProperty(FakeAnalyser.prototype, "frequencyBinCount", { get: function () { return this.fftSize / 2; } });
  FakeAnalyser.prototype._window = function () {
    var el = this._src, n = this.fftSize, out = new Float32Array(n);
    if (!el) return out;
    var dec = decodeFor(el, this.context.sampleRate);
    if (!dec.data) return out;
    var st = mediaState.get(el);
    var t = st ? mediaTimeAt(el, st, clockMs) : 0;
    var end = Math.floor(t * this.context.sampleRate);
    for (var i = 0; i < n; i++) { var idx = end - n + i; out[i] = idx >= 0 && idx < dec.data.length ? dec.data[idx] : 0; }
    return out;
  };
  FakeAnalyser.prototype._update = function () {
    if (this._lastMs === clockMs && this._mags) return;
    this._lastMs = clockMs;
    var n = this.fftSize, x = this._window(), re = new Float64Array(n), im = new Float64Array(n);
    for (var i = 0; i < n; i++) {
      var w = 0.42 - 0.5 * Math.cos(2 * Math.PI * i / n) + 0.08 * Math.cos(4 * Math.PI * i / n);
      re[i] = x[i] * w;
    }
    fftMag(re, im);
    var bins = n / 2, tau = Math.max(0, Math.min(1, this.smoothingTimeConstant));
    if (!this._smooth || this._smooth.length !== bins) this._smooth = new Float64Array(bins);
    for (var k = 0; k < bins; k++) {
      var mag = Math.sqrt(re[k] * re[k] + im[k] * im[k]) / n;
      this._smooth[k] = tau * this._smooth[k] + (1 - tau) * mag;
    }
    this._mags = this._smooth;
  };
  FakeAnalyser.prototype.getFloatFrequencyData = function (arr) {
    this._update();
    for (var k = 0; k < arr.length && k < this._mags.length; k++) arr[k] = 20 * Math.log10(this._mags[k] || 1e-20);
  };
  FakeAnalyser.prototype.getByteFrequencyData = function (arr) {
    this._update();
    var range = this.maxDecibels - this.minDecibels;
    for (var k = 0; k < arr.length && k < this._mags.length; k++) {
      var db = 20 * Math.log10(this._mags[k] || 1e-20);
      arr[k] = Math.max(0, Math.min(255, Math.floor(255 / range * (db - this.minDecibels))));
    }
  };
  FakeAnalyser.prototype.getFloatTimeDomainData = function (arr) {
    var x = this._window(), off = x.length - arr.length;
    for (var i = 0; i < arr.length; i++) arr[i] = x[Math.max(0, off) + i] || 0;
  };
  FakeAnalyser.prototype.getByteTimeDomainData = function (arr) {
    var x = this._window(), off = x.length - arr.length;
    for (var i = 0; i < arr.length; i++) arr[i] = Math.max(0, Math.min(255, Math.floor(128 * (1 + (x[Math.max(0, off) + i] || 0)))));
  };
  var acRate = 48000;
  try { var probeAc = new RealAC(); acRate = probeAc.sampleRate || 48000; probeAc.close(); } catch (e) {}
  function FakeAudioContext() {
    this.sampleRate = acRate; this.state = "running"; this.destination = new FakeNode(this);
  }
  Object.defineProperty(FakeAudioContext.prototype, "currentTime", { get: function () { return clockMs / 1000; } });
  FakeAudioContext.prototype.resume = function () { return Promise.resolve(); };
  FakeAudioContext.prototype.suspend = function () { return Promise.resolve(); };
  FakeAudioContext.prototype.close = function () { this.state = "closed"; return Promise.resolve(); };
  FakeAudioContext.prototype.createAnalyser = function () { return new FakeAnalyser(this); };
  FakeAudioContext.prototype.createGain = function () { var n = new FakeNode(this); n.gain = { value: 1, setValueAtTime: function () {} }; return n; };
  FakeAudioContext.prototype.createMediaElementSource = function (el) {
    var n = new FakeNode(this); n._src = el; n.mediaElement = el; adopt(el); decodeFor(el, this.sampleRate); return n;
  };
  if (RealAC) { W.AudioContext = FakeAudioContext; W.webkitAudioContext = FakeAudioContext; }

  /* ───────────────────────────── cargas ───────────────────────────── */
  var inflight = 0;
  var realFetch = W.fetch;
  W.fetch = function () {
    inflight++;
    return realFetch.apply(W, arguments).finally(function () { inflight--; });
  };
  var pendingImgs = new Set();
  var dImgSrc = desc(HTMLImageElement.prototype, "src");
  function trackImg(img) {
    if (img.complete) return;
    pendingImgs.add(img);
    var done = function () { pendingImgs.delete(img); };
    img.addEventListener("load", done, { once: true });
    img.addEventListener("error", done, { once: true });
  }
  Object.defineProperty(HTMLImageElement.prototype, "src", {
    configurable: true, enumerable: dImgSrc.enumerable,
    get: function () { return dImgSrc.get.call(this); },
    set: function (v) { dImgSrc.set.call(this, v); trackImg(this); },
  });
  var decodedSrc = new WeakMap();
  function imagesPending() {
    var list = [];
    pendingImgs.forEach(function (img) { if (!img.complete) list.push(img); else pendingImgs.delete(img); });
    var imgs = D.images;
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      var src = img.currentSrc || img.getAttribute("src");
      if (!src) continue;
      if (!img.complete || decodedSrc.get(img) !== src) list.push(img);
    }
    return list;
  }
  function settleImages(list) {
    return Promise.all(list.map(function (img) {
      var src = img.currentSrc || img.getAttribute("src");
      var loaded = img.complete ? Promise.resolve() : new Promise(function (r) {
        img.addEventListener("load", r, { once: true }); img.addEventListener("error", r, { once: true });
      });
      return withTimeout(loaded.then(function () { return img.naturalWidth ? img.decode() : null; }), 6000)
        .then(function () { decodedSrc.set(img, src); });
    }));
  }
  /* cada elemento se espera como mucho MEDIA_WAIT_MS acumulados: una fuente
     rota no puede trabar el render (la plantilla ya la trata como ausente) */
  var MEDIA_WAIT_MS = 8000;
  var mediaWaited = new WeakMap();
  function mediaMetaPending() {
    var n = 0;
    mediaEls.forEach(function (el) {
      if (el.error || !(el.currentSrc || el.getAttribute("src"))) return;
      if ((mediaWaited.get(el) || 0) >= MEDIA_WAIT_MS) return;
      var need = el instanceof HTMLVideoElement ? 2 : 1;
      if (el.readyState < need) n++;
    });
    return n;
  }
  function chargeMediaWait(ms) {
    mediaEls.forEach(function (el) {
      var need = el instanceof HTMLVideoElement ? 2 : 1;
      if (!el.error && el.readyState < need) mediaWaited.set(el, (mediaWaited.get(el) || 0) + ms);
    });
  }
  function domImagesLoading() {
    var imgs = D.images;
    for (var i = 0; i < imgs.length; i++) if (!imgs[i].complete && imgs[i].getAttribute("src")) return true;
    return false;
  }
  /* Fuentes: se cargan TODAS las declaradas antes del primer cuadro (en un
     navegador real la palabra nueva podía asomar un instante con la fuente de
     respaldo; acá nunca). */
  function loadAllFonts() {
    var ps = [];
    try { D.fonts.forEach(function (f) { if (f.status === "unloaded") ps.push(f.load().catch(function () {})); }); } catch (e) {}
    return withTimeout(Promise.all(ps).then(function () { return D.fonts.ready; }), 15000);
  }
  async function settleLoads() {
    var imgs = imagesPending();
    if (imgs.length) { stats.waits++; await settleImages(imgs); }
    if (D.fonts && D.fonts.status === "loading") { stats.waits++; await withTimeout(D.fonts.ready, 10000); }
    if (mediaMetaPending()) {
      stats.waits++;
      while (mediaMetaPending()) { await sleep(20); chargeMediaWait(20); }
    }
  }

  /* ───────────────────────────── arranque ───────────────────────────── */
  function quietNow() { return inflight + pendingAsync + mediaMetaPending() + imagesPending().length === 0; }
  async function waitQuiet(maxMs) {
    var t0 = wallMs(), quiet = 0;
    for (;;) {
      if (quietNow()) { if (++quiet >= 3) return; } else quiet = 0;
      var imgs = imagesPending();
      if (imgs.length) await settleImages(imgs);
      if (wallMs() - t0 > maxMs) { log("readiness: timeout"); return; }
      await sleep(40);
      chargeMediaWait(40);
    }
  }
  var readyP = null;
  function ready() {
    if (readyP) return readyP;
    readyP = (async function () {
      var t0 = wallMs();
      if (D.readyState === "loading") await new Promise(function (r) { D.addEventListener("DOMContentLoaded", r, { once: true }); });
      scanMedia(D);
      if (D.readyState !== "complete") await withTimeout(new Promise(function (r) { W.addEventListener("load", r, { once: true }); }), 20000);
      await loadAllFonts();
      await waitQuiet(20000);
      /* mismo gesto que usa la vista previa de la app para las plantillas que
         arrancan con un click (#screen) o pointerdown */
      try {
        var screen = D.querySelector("#screen");
        if (screen) screen.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        (D.body || D.documentElement).dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      } catch (e) { log("gesto: " + e); }
      await waitQuiet(15000);
      await loadAllFonts();
      stats.readyMs = Math.round(wallMs() - t0);
    })();
    return readyP;
  }
  /* ───────────────────────────── ticks ───────────────────────────── */
  function tick(k) {
    var tms = k * STEP_MS;
    ticking = true;
    try {
      runTimers(tms);
      clockMs = tms;
      mediaTick(tms);
      applyAnimations();
      origSeekToTime.call(VT, tms);   /* vacía la cola de rAF de HyperFrames con timestamp = tms */
      discoverAnimations();
    } finally { ticking = false; }
    stats.ticks++;
  }
  async function run() {
    await ready();
    var t0;
    while (stepIdx < targetStep) {
      var last = stepIdx + 1 === targetStep;
      if (last) {
        /* los <video> que la plantilla dibuja en canvas tienen que estar en su
           cuadro ANTES de los callbacks del último tick */
        clockMs = (stepIdx + 1) * STEP_MS;
        t0 = wallMs();
        var pre = syncVideos();
        if (pre) await pre;
        stats.videoMs += wallMs() - t0;
      }
      t0 = wallMs();
      tick(++stepIdx);
      await null;                     /* microtareas de la plantilla, como entre cuadros reales */
      stats.tickMs += wallMs() - t0;
      if (pendingImgs.size || domImagesLoading() || mediaMetaPending() || (D.fonts && D.fonts.status === "loading")) {
        t0 = wallMs(); await settleLoads(); stats.settleMs += wallMs() - t0;
      }
    }
    t0 = wallMs();
    var post = syncVideos();
    if (post) await post;
    stats.videoMs += wallMs() - t0;
    t0 = wallMs();
    await settleLoads();
    stats.settleMs += wallMs() - t0;
    /* resumen cada 300 cuadros en la salida del CLI (consola reenviada) */
    if (stats.seeks % 300 === 0) {
      console.log("[nb-hf-clock] seeks=" + stats.seeks + " t=" + Math.round(clockMs) + "ms ticks=" + stats.ticks +
        " tick=" + Math.round(stats.tickMs) + "ms video=" + Math.round(stats.videoMs) + "ms settle=" +
        Math.round(stats.settleMs) + "ms ready=" + stats.readyMs + "ms backward=" + stats.backward);
    }
  }
  function requestTarget(ms) {
    var step = Math.floor(Math.max(0, Number(ms) || 0) / STEP_MS + 1e-4);
    stats.seeks++;
    if (stats.firstSeekMs === null) stats.firstSeekMs = ms;
    if (step < stepIdx) { stats.backward++; log("seek hacia atrás ignorado: " + ms + "ms (estado en " + stepIdx * STEP_MS + "ms)"); }
    if (step > targetStep) targetStep = step;
    if (!processing) {
      processing = run().catch(function (e) { log("run: " + (e && e.stack || e)); })
        .then(function () { processing = null; if (stepIdx < targetStep) requestTarget(targetStep * STEP_MS); });
    }
    return processing;
  }
  function idle() { return processing || Promise.resolve(); }

  VT.seekToTime = function (ms) { requestTarget(ms); return ms; };
  W.addEventListener("hf-seek", function (e) {
    var d = e && e.detail;
    if (!d || typeof d.time !== "number") return;
    var p = requestTarget(d.time * 1000);
    if (typeof d.waitUntil === "function") { try { d.waitUntil(p); } catch (err) {} }
  });
  /* El engine espera window.__hfWaitForSeekCompletion() antes de capturar:
     se envuelve para que también espere a que el mundo llegue al cuadro. */
  var innerWait = W.__hfWaitForSeekCompletion;
  try {
    Object.defineProperty(W, "__hfWaitForSeekCompletion", {
      configurable: true,
      get: function () { return function () { return Promise.resolve(innerWait && innerWait()).then(idle); }; },
      set: function (fn) { innerWait = fn; },
    });
  } catch (e) { log("__hfWaitForSeekCompletion no envolvible"); }

  W.__nbHf = {
    active: true,
    stats: stats,
    logs: logs,
    get time() { return clockMs; },
    ready: ready,
    idle: idle,
  };
})();
