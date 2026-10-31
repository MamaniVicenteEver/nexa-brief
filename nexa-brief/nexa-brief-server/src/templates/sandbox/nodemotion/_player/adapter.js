/* Adaptador común de las dos plantillas HyperFrames del sandbox. */
(function () {
  "use strict";
  if (new URLSearchParams(location.search).get("controls") !== "1") return;

  const scriptSrc = document.currentScript && document.currentScript.src;
  if (!scriptSrc) return;
  const audio = document.getElementById("audio");
  const nativePlay = audio && audio.play.bind(audio);
  let allowPlay = false;
  if (audio && nativePlay) audio.play = function () {
    return allowPlay ? nativePlay() : Promise.resolve();
  };

  const bridgeReady = new Promise(resolve => {
    if (window.NexaPlayerBridge) return resolve(true);
    const script = document.createElement("script");
    script.src = new URL("../../../_tools/player/bridge.js", scriptSrc).href;
    script.onload = () => resolve(true);
    script.onerror = () => { console.warn("[nodemotion] no se pudo cargar el puente de controles"); resolve(false); };
    document.head.appendChild(script);
  });

  function waitEngine() {
    const engine = window.__finalcut || window.__fuerza;
    if (engine && audio && audio.src) return Promise.resolve(engine);
    return new Promise(resolve => requestAnimationFrame(() => waitEngine().then(resolve)));
  }
  function waitMetadata() {
    if (!audio || audio.readyState >= 1) return Promise.resolve();
    try { audio.load(); } catch (_) { /* carga ya iniciada */ }
    return new Promise(resolve => {
      let done = false;
      const finish = () => { if (done) return; done = true; clearTimeout(timer); resolve(); };
      const timer = setTimeout(finish, 4000);
      audio.addEventListener("loadedmetadata", finish, { once: true });
      audio.addEventListener("error", finish, { once: true });
    });
  }
  function waitSeek() {
    return new Promise(resolve => {
      let done = false;
      const finish = () => { if (done) return; done = true; clearTimeout(timer); resolve(); };
      const timer = setTimeout(finish, 1200);
      audio.addEventListener("seeked", finish, { once: true });
      requestAnimationFrame(() => requestAnimationFrame(finish));
    });
  }

  Promise.all([bridgeReady, waitEngine(), waitMetadata()]).then(([loaded]) => {
    if (!loaded || !window.NexaPlayerBridge || !audio) return;
    let endedHandler = null;
    const notifyEnded = () => { if (endedHandler) endedHandler(); };
    window.NexaPlayerBridge.attach({
      duration: () => Number.isFinite(audio.duration) ? audio.duration : 0,
      currentTime: () => audio.currentTime || 0,
      play() {
        allowPlay = true;
        return nativePlay();
      },
      pause() { audio.pause(); },
      async seek(time) {
        await waitMetadata();
        const end = Number.isFinite(audio.duration) ? Math.max(0, audio.duration - 0.02) : time;
        const target = Math.max(0, Math.min(time, end));
        if (Math.abs(audio.currentTime - target) > 0.01) {
          audio.currentTime = target;
          await waitSeek();
        }
      },
      setVolume(volume, muted) {
        audio.volume = Math.max(0, Math.min(1, Number(volume) || 0));
        audio.muted = Boolean(muted);
      },
      onEnded(callback) {
        endedHandler = callback;
        audio.addEventListener("ended", notifyEnded);
      },
    });
  });
})();
