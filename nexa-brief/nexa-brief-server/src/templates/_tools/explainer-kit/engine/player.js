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
    if (want.playing && a.paused) a.play().catch(() => { want.playing = false; report(); });
    if (!want.playing && !a.paused) a.pause();
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
    a.addEventListener("ended", () => { want.playing = false; report(true); parentPost({ type: "nexa-template-ended" }); });
    apply();
  }
  wire();
})();
