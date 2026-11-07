// @nexa thumbnail-at: 0.45 — segundo del video en que el cartel de esta intro está completo:
// de ahí sale la miniatura (src/modules/thumbnail_maker.py). Medir al cambiar la intro.
(function attach(root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.NexaCaladoIntro = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createApi() {
  "use strict";
  const DEFAULT_DURATION_SECONDS = 2.8;
  const FADE_SECONDS = 0.45;

  function stateAt(timeSeconds, durationSeconds, outroActive) {
    const time = Math.max(0, Number(timeSeconds) || 0);
    const candidate = Number(durationSeconds);
    const duration = durationSeconds !== undefined && durationSeconds !== null && Number.isFinite(candidate)
      ? Math.max(0, candidate)
      : DEFAULT_DURATION_SECONDS;
    const fadeSeconds = Math.min(FADE_SECONDS, duration * 0.2);
    const active = !outroActive && duration > 0 && time < duration;
    const x = fadeSeconds > 0 ? Math.max(0, Math.min(1, (time - duration + fadeSeconds) / fadeSeconds)) : 1;
    return {active, opacity: active ? 1 - x * x * (3 - 2 * x) : 0, time, duration, fadeSeconds};
  }

  function resolveTitle(config) {
    return String((config && (config.songTitle || config.title || config.trackTitle)) || "").trim();
  }

  function drawCanvasIntro(options) {
    const state = stateAt(options.timeSeconds, options.durationSeconds, options.outroActive);
    const config = options.config || {};
    const title = String(options.title || resolveTitle(config) || "").trim();
    const ctx = options.ctx;
    const width = options.width;
    const height = options.height;
    const maskContext = options.maskContext;
    const videoContext = options.videoContext;
    const maskCanvas = options.maskCanvas;
    const videoCanvas = options.videoCanvas;
    if (!ctx) return state;

    ctx.save();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, height);

    const veilOpacity = Math.max(0, Math.min(1,
      options.backgroundVeilOpacity === undefined ? 0.58 : Number(options.backgroundVeilOpacity)
    ));
    if (options.drawBackground) {
      options.drawBackground(ctx, 1);
      ctx.fillStyle = "rgba(0,0,0," + veilOpacity + ")";
      ctx.fillRect(0, 0, width, height);
    }

    if (state.active && title && maskContext && videoContext && maskCanvas && videoCanvas && options.drawBackground) {
      const lines = title.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
      const maxHeight = Math.min(height * 0.30, (height * 0.56) / Math.max(1, lines.length));
      let fontSize = maxHeight;
      const fontFamily = options.fontFamily || "Anton, sans-serif";
      maskContext.save();
      maskContext.clearRect(0, 0, width, height);
      maskContext.textAlign = "center";
      maskContext.textBaseline = "middle";
      maskContext.font = fontSize + "px " + fontFamily;
      const widest = Math.max(1, ...lines.map(line => maskContext.measureText(line.toUpperCase()).width));
      fontSize *= Math.min(1, (width * 0.90) / widest);
      maskContext.font = fontSize + "px " + fontFamily;
      maskContext.fillStyle = "#fff";
      const lineHeight = fontSize * 0.95;
      const startY = height * 0.5 - ((lines.length - 1) * lineHeight) / 2;
      lines.forEach((line, index) => {
        maskContext.fillText(line.toUpperCase(), width / 2, startY + index * lineHeight);
      });
      maskContext.restore();

      videoContext.save();
      videoContext.clearRect(0, 0, width, height);
      options.drawBackground(videoContext, 1);
      videoContext.globalCompositeOperation = "destination-in";
      videoContext.drawImage(maskCanvas, 0, 0, width, height);
      videoContext.restore();

      ctx.globalAlpha = state.opacity;
      ctx.drawImage(videoCanvas, 0, 0, width, height);
    }
    ctx.restore();
    return state;
  }

  return {DEFAULT_DURATION_SECONDS, stateAt, resolveTitle, drawCanvasIntro};
});
