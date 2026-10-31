(function attach(root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.NexaCaladoOutro = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createApi() {
  "use strict";
  const DEFAULT_LEAD_SECONDS = 8;
  const TRANSITION_SECONDS = 1.1;
  const SUPPORT_TEXT = "Tu apoyo hace posible que sigamos trayendo más contenido.";
  const CHANNEL_URL = "youtube.com/@nodemotion";

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function stateAt(timeSeconds, durationSeconds, config, ended) {
    const time = Math.max(0, Number(timeSeconds) || 0);
    const duration = Number(durationSeconds);
    const candidate = Number(config && config.leadSec);
    const lead = Number.isFinite(candidate) ? Math.max(0, candidate) : DEFAULT_LEAD_SECONDS;
    const active = Number.isFinite(duration) && duration > 0 && (ended === true || time >= duration - lead);
    const opacity = !active ? 0 : ended ? 1 : clamp((time - (duration - lead)) / TRANSITION_SECONDS, 0, 1);
    return {active, opacity, time, duration, lead, transitionSeconds: TRANSITION_SECONDS};
  }
  function createController(config) {
    let shown = false;
    let maxOpacity = 0;
    return {
      update(timeSeconds, durationSeconds, ended) {
        const state = stateAt(timeSeconds, durationSeconds, config || {}, ended);
        if (state.active) {
          shown = true;
          maxOpacity = Math.max(maxOpacity, state.opacity);
        }
        return {...state, active: shown, opacity: maxOpacity};
      },
    };
  }
  function fitFontSize(ctx, text, maxWidth, maxHeight, font) {
    ctx.font = "100px " + font;
    const measured = Math.max(1, ctx.measureText(text).width);
    return Math.min(maxHeight, (maxWidth / measured) * 100);
  }
  function progress(elapsed, start, duration) {
    const p = clamp((elapsed - start) / Math.max(0.001, duration), 0, 1);
    return 1 - Math.pow(1 - p, 3);
  }
  function drawCanvasOutro(options) {
    const ctx = options && options.ctx;
    const width = Number(options && options.width) || 1920;
    const height = Number(options && options.height) || 1080;
    const config = options && options.config || {};
    const opacity = clamp(!options || options.opacity == null ? 1 : Number(options.opacity), 0, 1);
    const elapsed = Math.max(0, Number(options && options.elapsedSeconds) || 0);
    if (!ctx) return;

    const font = options.fontFamily || '"Anton", Impact, sans-serif';
    const title = String(config.title || config.songTitle || "Gracias").trim().toUpperCase();
    const sub = String(config.sub || "Por ver").trim().toUpperCase();
    const support = String(config.support || SUPPORT_TEXT);
    const portrait = height > width;
    const colors = config.colors || {};
    const palette = Array.isArray(colors.palette) ? colors.palette : [];
    const titleColor = colors.ink || "#F4EFE6";
    const subColor = palette[1] || "#4FC3FF";
    const accentColor = palette[2] || "#E0362C";
    const mutedColor = "#D7D0C5";
    const outroTextScale = 1.35;
    const maxTitle = ((portrait ? Math.min(height * 0.15, width * 0.21) : height * 0.15) + 4) * outroTextScale;
    const titleSize = fitFontSize(ctx, title, width * 0.88, maxTitle, font);
    const subSize = ((portrait ? Math.min(height * 0.028, width * 0.04) : height * 0.028) + 4) * outroTextScale;
    const ctaSize = height * 0.02 * outroTextScale;
    const supportSize = height * 0.014 + 2;
    const groupHeight = titleSize * 0.92 + 25 + subSize + 25 + ctaSize;
    const groupTop = (height - groupHeight) / 2;
    const titleY = groupTop + titleSize * 0.46;
    const subY = groupTop + titleSize * 0.92 + 25 + subSize / 2;
    const ctaY = groupTop + titleSize * 0.92 + 25 + subSize + 25 + ctaSize / 2;
    const titleProgress = progress(elapsed, 0, 0.8);
    const subProgress = progress(elapsed, 0.48, 0.62);
    const ctaProgress = progress(elapsed, 1.0, 0.55);
    const supportProgress = progress(elapsed, 1.65, 0.65);
    const urlProgress = progress(elapsed, 2.2, 0.45);
    const titleScale = 0.86 + 0.14 * titleProgress;

    ctx.save();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    if (options.drawBackground) {
      options.drawBackground(ctx, 1);
    } else {
      ctx.fillStyle = "#090a0d";
      ctx.fillRect(0, 0, width, height);
    }
    ctx.fillStyle = "rgba(8, 10, 14, 0.52)";
    ctx.fillRect(0, 0, width, height);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.save();
    ctx.globalAlpha = opacity * titleProgress;
    ctx.translate(width / 2, titleY);
    ctx.scale(titleScale, titleScale);
    ctx.font = "900 " + titleSize + "px " + font;
    ctx.lineWidth = Math.max(3, height * 0.0045);
    ctx.strokeStyle = titleColor;
    ctx.shadowColor = "rgba(79,195,255,0.62)";
    ctx.shadowBlur = height * 0.025;
    ctx.strokeText(title, 0, 0, width * 0.88);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = opacity * subProgress;
    ctx.font = "700 " + subSize + "px " + font;
    ctx.fillStyle = subColor;
    ctx.shadowColor = subColor;
    ctx.shadowBlur = height * 0.012;
    ctx.fillText(sub, width / 2, subY, width * 0.86);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = opacity * ctaProgress;
    ctx.font = "700 " + ctaSize + "px " + font;
    ctx.fillStyle = mutedColor;
    if ("letterSpacing" in ctx) ctx.letterSpacing = (height * 0.0013) + "px";
    ctx.fillText("SUSCRIBITE |", width / 2, ctaY, width * 0.86);
    const brandWidth = ctx.measureText("SUSCRIBITE | ").width;
    ctx.textAlign = "left";
    ctx.fillStyle = accentColor;
    ctx.fillText("NODEMOTION", width / 2 + brandWidth / 2, ctaY, width * 0.45);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = opacity * 0.9 * supportProgress;
    ctx.font = "400 " + supportSize + "px " + font;
    ctx.fillStyle = mutedColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(support, width / 2, height * 0.88, Math.min(width * 0.82, 1360));
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = opacity * 0.68 * urlProgress;
    ctx.font = "10px Arial, sans-serif";
    ctx.fillStyle = mutedColor;
    ctx.textAlign = "right";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(CHANNEL_URL, width * 0.97, height - 22, width * 0.5);
    ctx.restore();
    ctx.restore();
  }
  return {DEFAULT_LEAD_SECONDS, TRANSITION_SECONDS, stateAt, createController, drawCanvasOutro};
});
