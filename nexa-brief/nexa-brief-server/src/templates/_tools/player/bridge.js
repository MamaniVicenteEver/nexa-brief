/* =============================================================================
   Nexa Player Bridge · protocolo común para motores del sandbox
   -----------------------------------------------------------------------------
   Se carga solo con ?controls=1. El motor conecta un adaptador mínimo mediante
   window.NexaPlayerBridge.attach({ duration, currentTime, play, pause, seek,
   setVolume?, onEnded? }). El puente traduce el protocolo postMessage de
   MediaPlayerModal y concentra reloj, estado, volumen y fin de reproducción.
   ========================================================================== */
(function (global) {
  "use strict";

  if (new URLSearchParams(global.location.search).get("controls") !== "1") return;

  const parentPost = message => {
    try { global.parent.postMessage(message, "*"); } catch (_) { /* iframe cerrándose */ }
  };
  let adapter = null;
  let state = { playing: false, volume: 1, muted: false };
  let commandId = 0;
  let playPending = false;
  let pendingPlayback = null;
  let pendingSeek = null;
  let lastTime = -1;
  let lastSentAt = 0;
  let sentEnded = false;
  let started = false;

  const number = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const duration = () => {
    try { return Math.max(0, number(adapter && adapter.duration && adapter.duration())); }
    catch (_) { return 0; }
  };
  const currentTime = () => {
    try { return clamp(number(adapter && adapter.currentTime && adapter.currentTime()), 0, duration() || Infinity); }
    catch (_) { return 0; }
  };
  const reportState = () => parentPost({ type: "nexa-template-state", playing: state.playing });

  function reportTime(force) {
    const t = currentTime(), d = duration(), now = performance.now();
    if (!force && Math.abs(t - lastTime) < 0.15 && now - lastSentAt < 250) return;
    lastTime = t;
    lastSentAt = now;
    parentPost({ type: "nexa-template-time", currentTime: t, duration: d });
    if (!started && t > 0.05) {
      started = true;
      parentPost({ type: "nexa-template-started" });
    }
  }

  function applyVolume() {
    if (adapter && typeof adapter.setVolume === "function") {
      try { adapter.setVolume(state.volume, state.muted); } catch (_) { /* motor sin audio */ }
    }
  }

  function finish() {
    if (sentEnded) return;
    sentEnded = true;
    state.playing = false;
    try {
      const result = adapter.pause();
      if (result && typeof result.catch === "function") result.catch(() => {});
    } catch (_) { /* el motor ya terminó */ }
    reportTime(true);
    reportState();
    parentPost({ type: "nexa-template-ended" });
  }

  async function play() {
    if (!adapter) {
      pendingPlayback = true;
      return;
    }
    if (state.playing || playPending) return;
    const id = ++commandId;
    playPending = true;
    pendingPlayback = true;
    sentEnded = false;
    try {
      const result = adapter.play();
      if (result && typeof result.then === "function") await result;
      if (id !== commandId) return;
      state.playing = true;
      reportState();
      reportTime(true);
      requestAnimationFrame(tick);
    } catch (error) {
      if (id !== commandId) return;
      if (error && error.name === "NotAllowedError" && !state.muted) {
        state.muted = true;
        applyVolume();
        parentPost({ type: "nexa-template-muted", muted: true });
        try {
          const retry = adapter.play();
          if (retry && typeof retry.then === "function") await retry;
          if (id !== commandId) return;
          state.playing = true;
          reportState();
          reportTime(true);
          requestAnimationFrame(tick);
          return;
        } catch (_) { /* se informa el estado detenido abajo */ }
      }
      if (id !== commandId) return;
      state.playing = false;
      pendingPlayback = false;
      reportState();
    } finally {
      if (id === commandId) playPending = false;
    }
  }

  function pause() {
    pendingPlayback = false;
    ++commandId;
    playPending = false;
    if (adapter) {
      try {
        const result = adapter.pause();
        if (result && typeof result.catch === "function") result.catch(() => {});
      } catch (_) { /* el motor ya terminó */ }
    }
    state.playing = false;
    if (adapter) {
      reportState();
      reportTime(true);
    }
  }

  async function seek(time) {
    if (!adapter) {
      pendingSeek = number(time);
      return;
    }
    const target = clamp(number(time), 0, Math.max(0, duration() - 0.02));
    try {
      const result = adapter.seek(target);
      if (result && typeof result.then === "function") await result;
    } catch (error) {
      console.warn("[player] el motor no pudo buscar", error);
    }
    reportTime(true);
  }

  function tick() {
    if (!adapter) return;
    reportTime(false);
    const d = duration();
    if (state.playing && d > 0 && currentTime() >= d - 0.035) finish();
    if (state.playing) requestAnimationFrame(tick);
  }

  function onMessage(event) {
    if (event.source && event.source !== global.parent) return;
    const data = event.data || {};
    switch (data.type) {
      case "nexa-template-playback":
        pendingPlayback = Boolean(data.playing);
        if (data.playing) play(); else pause();
        break;
      case "nexa-template-seek":
        seek(data.time);
        break;
      case "nexa-template-skip":
        seek(currentTime() + number(data.seconds));
        break;
      case "nexa-template-volume":
        if (data.volume != null) state.volume = clamp(number(data.volume, state.volume), 0, 1);
        if (data.muted != null) state.muted = Boolean(data.muted);
        applyVolume();
        break;
      case "nexa-template-reset":
        pause();
        seek(0);
        break;
      default:
        return;
    }
  }

  global.addEventListener("message", onMessage);
  global.NexaPlayerBridge = {
    attach(value) {
      if (adapter || !value || typeof value.play !== "function" || typeof value.pause !== "function" || typeof value.seek !== "function") return;
      adapter = value;
      applyVolume();
      if (typeof adapter.onEnded === "function") {
        try { adapter.onEnded(finish); } catch (_) { /* el motor puede no tener audio */ }
      }
      parentPost({ type: "nexa-template-ready" });
      // El estado inicial «detenido» no debe pisar el autoplay que el modal
      // reenvía al recibir `ready`.
      if (pendingSeek != null) {
        const target = pendingSeek;
        pendingSeek = null;
        seek(target);
      }
      reportTime(true);
      if (pendingPlayback) play();
    },
  };
})(window);
