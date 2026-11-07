/* =============================================================================
   explainer-kit · control de reproducción (componente global del motor)
   -----------------------------------------------------------------------------
   Lo carga loader.js SOLO con ?controls=1 (la app lo pide en el modal del video).
   Sirve a TODOS los diseños y videos: ningún diseño implementa controles propios.

   Habla el mismo protocolo postMessage que las plantillas de NodeMotion, así el
   reproductor de la app (MediaPlayerModal) funciona igual con los dos motores:

     app → video   nexa-template-playback {playing}     reproducir / pausar
                   nexa-template-seek     {time}        ir al segundo
                   nexa-template-skip     {seconds}     ±N segundos
                   nexa-template-volume   {volume,muted}
                   nexa-template-reset                  volver al inicio en pausa
     video → app   nexa-template-time     {currentTime,duration}
                   nexa-template-ended
                   nexa-template-state    {playing}     estado real (play/pause)
                   nexa-template-muted    {muted}       si se silenció solo (ver abajo)
                   nexa-template-ready                  ya escucha órdenes

   Este archivo lo carga loader.js después de bajar design.json, así que el evento
   load del iframe puede llegar ANTES de que exista este listener y la orden
   "reproducir" de la app se pierde. Por eso, al quedar listo, avisa con
   nexa-template-ready y la app le reenvía el estado actual.

   Reproducción automática: el audio carga segundos después del clic que abrió el
   modal y Chrome puede rechazar el play() con sonido (NotAllowedError). En ese
   caso se reproduce en silencio, como YouTube, y la app muestra el botón de
   silencio activo: un clic y suena. Si el play() se interrumpe (AbortError), se
   reintenta.

   El motor (kit.js) en modo controlado usa audio.currentTime como ÚNICO reloj y
   sigue dibujando en pausa, así pausar, adelantar y retroceder muestran el cuadro
   exacto. Las órdenes que llegan antes de que el audio esté listo se guardan y se
   aplican al cargar (la app las manda apenas carga el iframe).
   ========================================================================== */
(function () {
  const QS = new URLSearchParams(location.search);
  if (QS.get("controls") !== "1") return;

  /* Las vistas aisladas de componentes no tienen pista de audio. Les damos un
     reloj virtual con el mismo protocolo para que el modal pueda reproducir,
     pausar y buscar dentro de la animación. */
  if (QS.get("clock") === "synthetic") {
    const parentPost = msg => { try { window.parent.postMessage(msg, "*"); } catch (_) {} };
    const duration = Math.max(0.1, Number(QS.get("dur")) || 7);
    const clock = { currentTime: 0, duration, paused: true, ready: false };
    window.__nexaClock = clock;
    let lastTick = 0, lastSent = -1, rafPending = false;
    const report = force => {
      if (!force && Math.abs(clock.currentTime - lastSent) < 0.15) return;
      lastSent = clock.currentTime;
      parentPost({ type: "nexa-template-time", currentTime: clock.currentTime, duration });
      if (clock.currentTime > 0.05) parentPost({ type: "nexa-template-started" });
    };
    const reportState = () => parentPost({ type: "nexa-template-state", playing: !clock.paused });
    function schedule() {
      if (!rafPending && clock.ready && !clock.paused) {
        rafPending = true;
        requestAnimationFrame(tick);
      }
    }
    function tick(now) {
      rafPending = false;
      if (clock.paused) return;
      if (lastTick) clock.currentTime = Math.min(duration, clock.currentTime + (now - lastTick) / 1000);
      lastTick = now;
      report(false);
      if (clock.currentTime >= duration) {
        clock.paused = true;
        report(true);
        reportState();
        parentPost({ type: "nexa-template-ended" });
      } else schedule();
    }
    function seek(time) {
      clock.currentTime = Math.max(0, Math.min(duration, Number(time) || 0));
      lastTick = performance.now();
      report(true);
      schedule();
    }
    window.addEventListener("message", event => {
      const d = event.data || {};
      switch (d.type) {
        case "nexa-template-playback":
          clock.paused = !Boolean(d.playing);
          lastTick = performance.now();
          reportState();
          report(true);
          schedule();
          break;
        case "nexa-template-seek": seek(d.time); break;
        case "nexa-template-skip": seek(clock.currentTime + (Number(d.seconds) || 0)); break;
        case "nexa-template-reset":
          clock.paused = true;
          seek(0);
          reportState();
          break;
        case "nexa-template-volume": break; // El componente no tiene audio.
        default: return;
      }
    });
    report(true);
    return;
  }

  const audio = () => document.getElementById("audio");
  const parentPost = msg => { try { window.parent.postMessage(msg, "*"); } catch (_) {} };
  const want = { playing: false, volume: Number(QS.get("volume") ?? 1), muted: false, seek: null };
  let visualReady = false;
  let audioLoadRequested = false;
  if (!Number.isFinite(want.volume)) want.volume = 1;

  const ready = a => a && a.readyState >= 1 && Number.isFinite(a.duration);
  const clampT = (a, t) => Math.max(0, Math.min(Number(t) || 0, (a.duration || 0) - 0.05));

  function apply() {
    const a = audio();
    if (!a) return;
    a.volume = Math.max(0, Math.min(1, want.volume));
    a.muted = want.muted;
    if (!ready(a)) {
      /* El preview inicia la descarga solo después del primer cuadro y al recibir
         la orden de reproducir. loadedmetadata vuelve a llamar apply(). */
      if (want.playing && visualReady && !audioLoadRequested && (a.currentSrc || a.src)) {
        audioLoadRequested = true;
        a.preload = "auto";
        a.load();
      }
      return;
    }
    if (want.playing && !visualReady) return;
    if (want.seek != null) { a.currentTime = clampT(a, want.seek); want.seek = null; }
    if (want.playing && a.paused) play(a, 0);
    if (!want.playing && !a.paused) a.pause();
  }

  function play(a, attempt) {
    a.play().catch(err => {
      if (!want.playing) return;
      if (err && err.name === "NotAllowedError" && !a.muted) {
        a.muted = want.muted = true;
        parentPost({ type: "nexa-template-muted", muted: true });
        return play(a, attempt + 1);
      }
      if (err && err.name === "AbortError" && attempt < 3) return setTimeout(() => apply(), 100);
      want.playing = false;
      parentPost({ type: "nexa-template-state", playing: false });
    });
  }

  let lastSent = -1;
  function report(force) {
    const a = audio();
    if (!a) return;
    const t = a.currentTime || 0;
    if (!force && Math.abs(t - lastSent) < 0.2) return;
    lastSent = t;
    parentPost({ type: "nexa-template-time", currentTime: t, duration: Number.isFinite(a.duration) ? a.duration : 0 });
  }

  window.addEventListener("message", event => {
    const d = event.data || {};
    const a = audio();
    switch (d.type) {
      case "nexa-template-playback": want.playing = Boolean(d.playing); break;
      case "nexa-template-seek": want.seek = Number(d.time) || 0; break;
      case "nexa-template-skip": want.seek = (a ? a.currentTime : 0) + (Number(d.seconds) || 0); break;
      case "nexa-template-volume":
        if (d.volume != null) want.volume = Number(d.volume);
        if (d.muted != null) want.muted = Boolean(d.muted);
        break;
      case "nexa-template-reset": want.playing = false; want.seek = 0; break;
      default: return;
    }
    apply();
    report(true);
  });

  function wire() {
    const a = audio();
    if (!a) return requestAnimationFrame(wire);
    a.autoplay = false;
    a.addEventListener("loadedmetadata", () => { apply(); report(true); });
    a.addEventListener("timeupdate", () => report(false));
    a.addEventListener("seeked", () => report(true));
    a.addEventListener("play", () => parentPost({ type: "nexa-template-state", playing: true }));
    a.addEventListener("pause", () => { if (!a.ended) parentPost({ type: "nexa-template-state", playing: false }); });
    a.addEventListener("ended", () => { want.playing = false; report(true); parentPost({ type: "nexa-template-ended" }); });
    apply();
  }
  wire();
  /* La app no inicia el audio hasta que Kit.boot ya dibujó y el navegador pintó el primer cuadro. */
  const kitReady = window.KitReady;
  if (kitReady && typeof kitReady.then === "function") {
    kitReady.then(() => {
      visualReady = true;
      apply();
      report(true);
      parentPost({ type: "nexa-template-ready" });
    }).catch(error => {
      console.error("[player] no se pudo preparar el primer cuadro", error);
      parentPost({ type: "nexa-template-error" });
    });
  }
})();
