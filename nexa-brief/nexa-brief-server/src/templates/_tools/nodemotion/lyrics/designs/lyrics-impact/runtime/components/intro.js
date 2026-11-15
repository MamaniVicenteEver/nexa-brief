// @nexa thumbnail-at: 1.5 — segundo del video en que el cartel de esta intro está completo:
// de ahí sale la miniatura (src/modules/thumbnail_maker.py). Medir al cambiar la intro.
(function attach(root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.NexaImpactIntro = api;
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

  function createDOMIntro(options) {
    const root = options.root;
    const heading = root && root.querySelector(".title");
    const title = String(options.title || resolveTitle(options.config) || "").trim();
    if (heading) {
      heading.textContent = title;
      heading.style.whiteSpace = "pre-line";
      heading.setAttribute("aria-label", title.replace(/\s+/g, " "));
    }
    for (const node of root ? root.querySelectorAll(".artist, .sub, .feats") : []) node.style.display = "none";
    if (root) {
      root.classList.remove("gone");
      root.style.transition = "none";
    }
    function update(timeSeconds, durationSeconds, outroActive) {
      const state = stateAt(timeSeconds, durationSeconds, outroActive);
      if (root) {
        root.style.opacity = state.opacity.toFixed(3);
        root.classList.toggle("gone", !state.active);
      }
      return state;
    }
    return {title, update};
  }

  function createRemotionElement(options) {
    const state = stateAt(options.timeSeconds, options.durationSeconds, options.outroActive);
    const title = String(options.title || resolveTitle(options.config) || "").trim();
    if (!state.active || !title) return null;
    const C = options.C || {};
    const React = options.React;
    return React.createElement("div", {
      style: {
        position: "absolute", inset: 0, zIndex: 8, display: "flex",
        alignItems: "center", justifyContent: "center", padding: "0 6vw",
        textAlign: "center", textTransform: "uppercase", opacity: state.opacity,
        pointerEvents: "none",
      },
    }, React.createElement("div", {
      style: {
        fontFamily: C.fonts && C.fonts.display || "Anton, sans-serif",
        fontSize: "17vh", color: C.colors && C.colors.ink || "#D2222A",
        lineHeight: 0.95, letterSpacing: "0.01em", transform: "skewX(-8deg)",
        filter: "drop-shadow(0 4px 18px rgba(0,0,0,0.8)) drop-shadow(0 0 30px rgba(210,34,42,0.22))",
        whiteSpace: "pre-line",
      },
    }, title));
  }

  return {DEFAULT_DURATION_SECONDS, stateAt, resolveTitle, createDOMIntro, createRemotionElement};
});
