(function attach(root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.NexaRomanticOutro = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createApi() {
  "use strict";
  const DEFAULT_LEAD_SECONDS = 8;
  const TRANSITION_SECONDS = 1.1;
  const SUPPORT_TEXT = "Tu apoyo hace posible que sigamos trayendo más contenido.";
  const BRAND_PREFIX = "Suscribite |";
  const BRAND_NAME = "NodeMotion";
  const CHANNEL_URL = "youtube.com/@nodemotion";
  const THEME = {"titleFont":"\"Great Vibes\", cursive","bodyFont":"\"Playfair Display\", serif","subFont":"\"Playfair Display\", serif","supportFont":"\"Playfair Display\", serif","brandFont":"\"Playfair Display\", serif","titleColor":"#D89A9E","subColor":"#F2E7DA","bodyColor":"#cbb8ad","accentColor":"#D89A9E","titleTransform":"none","subTransform":"none","titleLetterSpacing":"0.01em","subLetterSpacing":"0.1em","ctaLetterSpacing":"0.14em","supportLetterSpacing":"0.02em","titleFilter":"drop-shadow(0 6px 26px rgba(0,0,0,0.55))","titleShadow":"0 0 25px rgba(216,154,158,0.24)","subShadow":"none","ctaOpacity":0.85,"folder":false};

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
  function value(config, key, fallback) {
    const raw = config && config[key];
    return String(raw == null || raw === "" ? fallback : raw).trim();
  }
  function themeFor(config) {
    const theme = Object.assign({}, THEME);
    if (config && config.colors) {
      if (config.colors.serif) theme.subColor = config.colors.serif;
      if (config.colors.script) theme.titleColor = config.colors.script;
      if (config.colors.muted) theme.bodyColor = config.colors.muted;
    }
    if (config && config.neon) {
      theme.titleColor = config.neon.core || theme.titleColor;
      theme.accentColor = config.neon.glow || theme.accentColor;
      theme.deepColor = config.neon.deep || theme.deepColor;
    }
    return theme;
  }
  function ramp(time, start, duration) {
    return clamp((time - start) / Math.max(0.001, duration), 0, 1);
  }
  function easeOut(progress) { return 1 - Math.pow(1 - progress, 3); }
  function motionAt(elapsed, theme) {
        const titleProgress = easeOut(ramp(elapsed, 0, 0.95));
    const subProgress = easeOut(ramp(elapsed, 0.45, 0.85));
    const brandProgress = easeOut(ramp(elapsed, 0.9, 0.7));
    const supportProgress = easeOut(ramp(elapsed, 1.45, 0.8));
    const urlProgress = easeOut(ramp(elapsed, 1.8, 0.75));
    const reveal = (progress, distance) => ({
      opacity: progress,
      transform: "translateY(" + (distance * (1 - progress)) + "px)",
      filter: "blur(" + (7 * (1 - progress)) + "px)",
    });
    return {
      title: reveal(titleProgress, 28),
      sub: reveal(subProgress, 20),
      subscribe: reveal(brandProgress, 16),
      support: {opacity: 0.9 * supportProgress, transform: "translateY(" + (18 * (1 - supportProgress)) + "px)"},
      url: {opacity: 0.68 * urlProgress, transform: "translateY(" + (12 * (1 - urlProgress)) + "px)"},
    };
  }
  function titleSize(portrait) {
    return portrait ? "calc(min(15vh, 21vw) + 4px)" : "calc(15vh + 4px)";
  }
  function subtitleSize(portrait) {
    return portrait ? "calc(min(2.8vh, 4vw) + 4px)" : "calc(2.8vh + 4px)";
  }
  function folderPlate(doc) {
    if (!THEME.folder) return null;
    const plate = doc.createElement("div");
    plate.className = "outro-folder-plate";
    plate.setAttribute("aria-hidden", "true");
    const tab = doc.createElement("div");
    tab.className = "outro-folder-tab";
    plate.appendChild(tab);
    return plate;
  }
  function baseStyle(root, nodes, theme, doc) {
    const {title, sub, subscribe, support, url, plate, brandName} = nodes;
    const tab = plate && plate.firstElementChild;
    const view = doc.defaultView;
    const portrait = !!(view && view.innerHeight > view.innerWidth);
    Object.assign(root.style, {
      position: "fixed", inset: "0", zIndex: "8", display: "flex",
      flexDirection: "column", alignItems: "center", justifyContent: "center",
      gap: "25px", textAlign: "center", textTransform: "uppercase",
      padding: "5vh 7vw", fontFamily: theme.bodyFont,
      pointerEvents: "none", opacity: "0", overflow: "hidden",
      background: "transparent",
    });
    root.setAttribute("role", "group");
    root.setAttribute("aria-label", "Cierre de video NodeMotion");
    Object.assign(title.style, {
      position: "relative", zIndex: "1", maxWidth: "88vw",
      fontFamily: theme.titleFont, fontSize: titleSize(portrait),
      lineHeight: "0.92", letterSpacing: theme.titleLetterSpacing,
      color: theme.titleColor, transform: theme.titleTransform,
      filter: theme.titleFilter, textShadow: theme.titleShadow,
      whiteSpace: "pre-line", transformOrigin: "center",
    });
    Object.assign(sub.style, {
      position: "relative", zIndex: "1", maxWidth: "86vw",
      fontFamily: theme.subFont, fontSize: subtitleSize(portrait),
      lineHeight: "1", letterSpacing: theme.subLetterSpacing,
      color: theme.subColor, transform: theme.subTransform,
      textShadow: theme.subShadow, transformOrigin: "center",
    });
    Object.assign(subscribe.style, {
      position: "relative", zIndex: "1", fontFamily: theme.bodyFont,
      fontSize: "2vh", lineHeight: "1.1", letterSpacing: theme.ctaLetterSpacing,
      color: theme.bodyColor, opacity: theme.ctaOpacity,
      margin: "0", transformOrigin: "center",
    });
    Object.assign(brandName.style, {
      color: theme.accentColor, fontFamily: theme.brandFont || theme.bodyFont,
    });
    Object.assign(support.style, {
      position: "absolute", zIndex: "1", right: "9vw", bottom: "12vh", left: "9vw",
      maxWidth: "680px", margin: "0 auto", color: theme.bodyColor,
      fontFamily: theme.supportFont, fontSize: "calc(1.4vh + 2px)",
      lineHeight: "1.45", letterSpacing: theme.supportLetterSpacing,
      textTransform: "none", opacity: "0.9",
    });
    Object.assign(url.style, {
      position: "absolute", zIndex: "1", right: "3vw", bottom: "22px",
      color: theme.urlColor || theme.bodyColor,
      font: theme.urlFont || "10px Arial, sans-serif",
      letterSpacing: "0.01em", textTransform: "none", opacity: "0.68",
    });
    if (plate) {
      Object.assign(plate.style, {
        position: "absolute", zIndex: "0", left: "50%", top: "50%",
        width: "min(84vw, 980px)", height: "min(50vh, 470px)",
        transform: "translate(-50%, -50%)",
        border: "1px solid rgba(222, 201, 158, 0.58)",
        borderRadius: "3px",
        background: "linear-gradient(145deg, rgba(40,31,19,0.46), rgba(14,12,10,0.32))",
        boxShadow: "0 0 0 7px rgba(16,12,8,0.18), inset 0 0 34px rgba(230,205,157,0.08)",
      });
      if (tab) {
        Object.assign(tab.style, {
          position: "absolute", left: "12%", top: "-13px", width: "22%", height: "13px",
          border: "1px solid rgba(222,201,158,0.52)", borderBottom: "0",
          background: "rgba(35,27,18,0.48)",
        });
      }
    }
    function fit() {
      const isPortrait = !!(view && view.innerHeight > view.innerWidth);
      title.style.fontSize = titleSize(isPortrait);
      sub.style.fontSize = subtitleSize(isPortrait);
      if (plate && isPortrait) {
        plate.style.width = "88vw";
        plate.style.height = "min(48vh, 430px)";
      } else if (plate) {
        plate.style.width = "min(84vw, 980px)";
        plate.style.height = "min(50vh, 470px)";
      }
    }
    fit();
    return fit;
  }
  function createDOMOutro(options) {
    const root = options && options.root;
    if (!root) throw new Error("createDOMOutro requiere el nodo #outro");
    const doc = options.document || root.ownerDocument || document;
    const config = options.config || {};
    const theme = themeFor(config);
    const title = doc.createElement("div");
    title.className = "title";
    title.textContent = value(config, "title", value(config, "songTitle", "Gracias"));
    const sub = doc.createElement("div");
    sub.className = "sub";
    sub.textContent = value(config, "sub", "Por ver");
    const subscribe = doc.createElement("div");
    subscribe.className = "subscribe";
    subscribe.appendChild(doc.createTextNode(BRAND_PREFIX + " "));
    const brandName = doc.createElement("span");
    brandName.className = "brand-name";
    brandName.textContent = BRAND_NAME;
    subscribe.appendChild(brandName);
    const support = doc.createElement("div");
    support.className = "support";
    support.textContent = value(config, "support", SUPPORT_TEXT);
    const url = doc.createElement("div");
    url.className = "channel-url";
    url.textContent = CHANNEL_URL;
    const plate = folderPlate(doc);
    const children = [title, sub, subscribe, support, url];
    root.classList.add("cardScreen");
    root.classList.remove("show");
    root.replaceChildren(...(plate ? [plate, ...children] : children));
    const fit = baseStyle(root, {title, sub, subscribe, support, url, plate, brandName}, theme, doc);
    const view = doc.defaultView;
    if (view) view.addEventListener("resize", fit);
    let shown = false;
    let maxOpacity = 0;
    function animate(elapsed) {
      const styles = motionAt(elapsed, theme);
      for (const key of ["title", "sub", "subscribe", "support", "url"]) {
        Object.assign(({title, sub, subscribe, support, url})[key].style, styles[key]);
      }
      if (plate && styles.plate) Object.assign(plate.style, styles.plate);
    }
    function update(timeSeconds, durationSeconds, ended) {
      const state = stateAt(timeSeconds, durationSeconds, config, ended);
      if (state.active) {
        if (!shown) {
          shown = true;
          root.classList.add("show");
          root.style.pointerEvents = "auto";
          doc.body.classList.add("outroActive");
          doc.body.classList.remove("introActive");
          if (typeof options.onShow === "function") options.onShow();
        }
        maxOpacity = Math.max(maxOpacity, state.opacity);
        root.style.opacity = maxOpacity.toFixed(3);
        animate(Math.max(0, state.time - (state.duration - state.lead)));
      }
      return {...state, active: shown, opacity: maxOpacity};
    }
    function show() {
      if (!shown) {
        shown = true;
        root.classList.add("show");
        root.style.pointerEvents = "auto";
        doc.body.classList.add("outroActive");
        doc.body.classList.remove("introActive");
        if (typeof options.onShow === "function") options.onShow();
      }
      maxOpacity = 1;
      root.style.opacity = "1";
      animate(Number(config.leadSec) || DEFAULT_LEAD_SECONDS);
      return true;
    }
    return {root, title, sub, subscribe, support, url, update, show, destroy: () => view && view.removeEventListener("resize", fit)};
  }
  function createRemotionElement(options) {
    const React = options.React;
    const config = options.config || {};
    const theme = themeFor(config);
    const width = Number(options.width) || 1920;
    const height = Number(options.height) || 1080;
    const portrait = height > width;
    const opacity = clamp(Number(options.opacity) || 0, 0, 1);
    const elapsed = Math.max(0, Number(options.elapsedSeconds) || 0);
    const title = value(config, "title", value(config, "songTitle", "Gracias"));
    const sub = value(config, "sub", "Por ver");
    const support = value(config, "support", SUPPORT_TEXT);
    const styles = motionAt(elapsed, theme);
    const rootStyle = {
      position: "absolute", inset: 0, zIndex: 8, display: "flex",
      flexDirection: "column", alignItems: "center", justifyContent: "center",
      gap: "25px", textAlign: "center", textTransform: "uppercase",
      padding: "5vh 7vw", fontFamily: theme.bodyFont,
      opacity, pointerEvents: "none", overflow: "hidden", background: "transparent",
    };
    const titleStyle = Object.assign({
      position: "relative", zIndex: 1, maxWidth: "88vw",
      fontFamily: theme.titleFont,
      fontSize: portrait ? "calc(min(15vh, 21vw) + 4px)" : "calc(15vh + 4px)",
      lineHeight: 0.92, letterSpacing: theme.titleLetterSpacing,
      color: theme.titleColor, transformOrigin: "center",
      filter: theme.titleFilter, textShadow: theme.titleShadow, whiteSpace: "pre-line",
    }, styles.title);
    const subStyle = Object.assign({
      position: "relative", zIndex: 1, maxWidth: "86vw", fontFamily: theme.subFont,
      fontSize: portrait ? "calc(min(2.8vh, 4vw) + 4px)" : "calc(2.8vh + 4px)",
      lineHeight: 1, letterSpacing: theme.subLetterSpacing, color: theme.subColor,
      transform: theme.subTransform, textShadow: theme.subShadow, transformOrigin: "center",
    }, styles.sub);
    const subscribeStyle = Object.assign({
      position: "relative", zIndex: 1, fontFamily: theme.bodyFont, fontSize: "2vh",
      lineHeight: 1.1, letterSpacing: theme.ctaLetterSpacing, color: theme.bodyColor,
      opacity: theme.ctaOpacity, margin: 0, transformOrigin: "center",
    }, styles.subscribe);
    const brandStyle = {color: theme.accentColor, fontFamily: theme.brandFont || theme.bodyFont};
    const supportStyle = Object.assign({
      position: "absolute", zIndex: 1, right: "9vw", bottom: "12vh", left: "9vw",
      maxWidth: "680px", margin: "0 auto", color: theme.bodyColor,
      fontFamily: theme.supportFont, fontSize: "calc(1.4vh + 2px)",
      lineHeight: 1.45, letterSpacing: theme.supportLetterSpacing,
      textTransform: "none", opacity: 0.9,
    }, styles.support);
    const urlStyle = Object.assign({
      position: "absolute", zIndex: 1, right: "3vw", bottom: "22px",
      color: theme.urlColor || theme.bodyColor, font: theme.urlFont || "10px Arial, sans-serif",
      letterSpacing: "0.01em", textTransform: "none", opacity: 0.68,
    }, styles.url);
    const plate = theme.folder ? React.createElement("div", {
      "aria-hidden": true,
      style: Object.assign({
        position: "absolute", zIndex: 0, left: "50%", top: "50%",
        width: portrait ? "88vw" : "min(84vw, 980px)",
        height: portrait ? "min(48vh, 430px)" : "min(50vh, 470px)",
        transform: "translate(-50%, -50%)",
        border: "1px solid rgba(222, 201, 158, 0.58)", borderRadius: 3,
        background: "linear-gradient(145deg, rgba(40,31,19,0.46), rgba(14,12,10,0.32))",
        boxShadow: "0 0 0 7px rgba(16,12,8,0.18), inset 0 0 34px rgba(230,205,157,0.08)",
      }, styles.plate || {}),
    }, React.createElement("div", {style: {
      position: "absolute", left: "12%", top: -13, width: "22%", height: 13,
      border: "1px solid rgba(222,201,158,0.52)", borderBottom: 0,
      background: "rgba(35,27,18,0.48)",
    }})) : null;
    return React.createElement("div", {
      role: "group", "aria-label": "Cierre de video NodeMotion",
      style: rootStyle,
    },
      plate,
      React.createElement("div", {style: titleStyle}, title),
      React.createElement("div", {style: subStyle}, sub),
      React.createElement("div", {style: subscribeStyle},
        BRAND_PREFIX + " ",
        React.createElement("span", {style: brandStyle}, BRAND_NAME)
      ),
      React.createElement("div", {style: supportStyle}, support),
      React.createElement("div", {style: urlStyle}, CHANNEL_URL)
    );
  }
  return {DEFAULT_LEAD_SECONDS, TRANSITION_SECONDS, stateAt, createDOMOutro, createRemotionElement};
});
