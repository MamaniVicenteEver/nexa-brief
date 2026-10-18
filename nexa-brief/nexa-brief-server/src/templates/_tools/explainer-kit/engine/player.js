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

  const audio = () => document.getElementById("audio");
  const parentPost = msg => { try { window.parent.postMessage(msg, "*"); } catch (_) {} };
  const want = { playing: false, volume: Number(QS.get("volume") ?? 1), muted: false, seek: null };
  if (!Number.isFinite(want.volume)) want.volume = 1;

  const ready = a => a && a.readyState >= 1 && Number.isFinite(a.duration);
  const clampT = (a, t) => Math.max(0, Math.min(Number(t) || 0, (a.duration || 0) - 0.05));

  function apply() {
    const a = audio();
    if (!a) return;
    a.volume = Math.max(0, Math.min(1, want.volume));
    a.muted = want.muted;
    if (!ready(a)) return;   /* se reintenta en loadedmetadata */
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
  parentPost({ type: "nexa-template-ready" });
})();
