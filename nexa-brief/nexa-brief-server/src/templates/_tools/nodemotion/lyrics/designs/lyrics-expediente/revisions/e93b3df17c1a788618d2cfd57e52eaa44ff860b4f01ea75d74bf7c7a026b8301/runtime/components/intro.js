// @nexa thumbnail-at: 2.0 — segundo del video en que el cartel de esta intro está completo:
// de ahí sale la miniatura (src/modules/thumbnail_maker.py). Medir al cambiar la intro.
(function attach(root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.NexaHiloRojoIntro = api;
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
    const artistNode = root && root.querySelector(".artist");
    const subtitleNode = root && root.querySelector(".sub");
    const footerNode = root && root.querySelector(".feats");
    if (artistNode) {
      artistNode.textContent = String((options.config && options.config.artist) || "").trim();
      artistNode.style.display = artistNode.textContent ? "" : "none";
    }
    if (subtitleNode) {
      subtitleNode.textContent = "";
      subtitleNode.style.display = "none";
    }
    if (footerNode) {
      footerNode.textContent = String((options.config && options.config.feats) || "").trim();
      footerNode.style.display = footerNode.textContent ? "" : "none";
    }
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
    const config = options.config || {};
    const title = String(options.title || resolveTitle(config) || "").trim();
    if (!state.active || !title) return null;
    const React = options.React;
    const artist = String(config.artist || "").trim();
    const feats = String(config.feats || "").trim();
    const labelStyle = {
      fontFamily: '"Special Elite", monospace', textTransform: "uppercase",
      color: "#241C10", textAlign: "center",
    };
    const children = [
      React.createElement("div", {key: "tab", style: {
        position: "absolute", top: "-3vh", left: "7%", width: "26%", height: "3.2vh",
        background: "linear-gradient(#CBB88C, #C0AB77)", borderRadius: "8px 8px 0 0",
      }}),
    ];
    if (artist) children.push(React.createElement("div", {key: "artist", style: {
      ...labelStyle, position: "relative", fontSize: "2.4vh", letterSpacing: "0.34em",
    }}, artist));
    children.push(React.createElement("div", {key: "title", style: {
      position: "relative", fontFamily: '"Oswald", sans-serif', fontWeight: 700, fontSize: "11vh",
      lineHeight: 1.05, textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "pre-line",
      color: "#C3231E", border: "0.9vh solid #C3231E",
      boxShadow: "inset 0 0 0 0.25vh #C3231E", padding: "0.4vh 2.4vh 0.2vh",
      transform: "rotate(-2.6deg)", filter: "url(#rough)", mixBlendMode: "multiply", textAlign: "center",
    }}, title));
    if (feats) children.push(React.createElement("div", {key: "feats", style: {
      ...labelStyle, fontSize: "1.7vh", letterSpacing: "0.3em", color: "#3A2E1A", marginTop: "1.6vh",
    }}, feats));
    return React.createElement("div", {
      style: {
        position: "absolute", inset: 0, zIndex: 8, display: "flex",
        alignItems: "center", justifyContent: "center", pointerEvents: "none", opacity: state.opacity,
      },
    }, React.createElement("div", {
      style: {
        position: "relative", display: "flex", flexDirection: "column", alignItems: "center",
        gap: "2.6vh", maxWidth: "88vw", padding: "7vh 7vw 6vh", transform: "rotate(-1.6deg)",
        background: "linear-gradient(174deg, #CBB88C 0%, #C0AB77 55%, #AE9760 100%)",
        borderRadius: "4px 14px 5px 5px",
        boxShadow: "0 24px 60px rgba(0,0,0,0.72), inset 0 1px 0 rgba(255,255,255,0.28)",
      },
    }, ...children));
  }

  return {DEFAULT_DURATION_SECONDS, stateAt, resolveTitle, createDOMIntro, createRemotionElement};
});
