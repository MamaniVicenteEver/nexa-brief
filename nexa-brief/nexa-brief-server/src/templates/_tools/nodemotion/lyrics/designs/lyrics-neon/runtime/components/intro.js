// @nexa thumbnail-at: 2.0 — segundo del video en que el cartel de esta intro está completo:
// de ahí sale la miniatura (src/modules/thumbnail_maker.py). Medir al cambiar la intro.
/* Intro propio de Letras de Neón. Comparte su reloj/estado entre la vista HTML,
   HyperFrames y las dos composiciones Remotion de esta misma plantilla. */
(function attachNeonIntro(root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.NexaNeonIntro = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createNeonIntroApi() {
  "use strict";

  const DEFAULT_DURATION_SECONDS = 2.8;
  const FADE_SECONDS = 0.45;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const smooth = value => {
    const x = clamp(value, 0, 1);
    return x * x * (3 - 2 * x);
  };

  function stateAt(timeSeconds, outroActive, durationSeconds) {
    const time = Math.max(0, Number(timeSeconds) || 0);
    const requestedDuration = Number(durationSeconds);
    const hasDuration = durationSeconds !== undefined && durationSeconds !== null && Number.isFinite(requestedDuration);
    const duration = hasDuration ? Math.max(0, requestedDuration) : DEFAULT_DURATION_SECONDS;
    const fadeSeconds = Math.min(FADE_SECONDS, duration * 0.2);
    const active = !outroActive && duration > 0 && time < duration;
    const fade = fadeSeconds > 0
      ? 1 - smooth((time - (duration - fadeSeconds)) / fadeSeconds)
      : 0;
    const backgroundLift = active ? fade : 0;
    return {
      active,
      opacity: active ? fade : 0,
      backgroundLift: clamp(backgroundLift, 0, 1),
      time,
      duration,
      fadeSeconds,
    };
  }

  function hash(a, b) {
    let h = Math.imul((a * 73856093) ^ (b * 19349663), 2654435761) >>> 0;
    h ^= h >>> 15;
    h = Math.imul(h, 2246822519) >>> 0;
    h ^= h >>> 13;
    return (h >>> 0) / 4294967296;
  }

  function lightAt(time, start, seed, duration) {
    const span = duration || 0.5;
    if (time < start) return 0;
    const elapsed = time - start;
    if (elapsed < span) {
      return hash(seed, Math.floor(elapsed * 30)) < 0.25 + 0.7 * (elapsed / span) ? 1 : 0.12;
    }
    return hash(seed, Math.floor(time * 24)) < 0.012 ? 0.45 : 1;
  }

  function characterOpacity(time, index, count, durationSeconds) {
    const duration = durationSeconds || DEFAULT_DURATION_SECONDS;
    const stagger = Math.min(0.06, (duration * 0.3) / Math.max(1, count));
    const start = Math.min(0.55, duration * 0.18);
    const flickerDuration = Math.min(0.45, duration * 0.2);
    return lightAt(time, start + index * stagger, 10 + index, flickerDuration);
  }

  function titleFrom(config) {
    return String((config && (config.title || config.songTitle)) || "").trim().toUpperCase();
  }

  function titleLines(title, portrait) {
    const explicit = String(title || "").split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (explicit.length > 1) return explicit;
    const text = explicit[0] || "";
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length < 2 || text.length <= (portrait ? 9 : 15)) return text ? [text] : [];
    let best = [text], score = Infinity;
    for (let i = 1; i < words.length; i++) {
      const first = words.slice(0, i).join(" ");
      const second = words.slice(i).join(" ");
      const difference = Math.abs(first.length - second.length);
      if (difference < score) {
        score = difference;
        best = [first, second];
      }
    }
    return best;
  }

  function backgroundFilter(baseFilter, lift) {
    const amount = clamp(lift, 0, 1);
    return (baseFilter || "none") + " brightness(" + (1 + 2.05 * amount).toFixed(3) + ")" +
      " saturate(" + (1 + 0.35 * amount).toFixed(3) + ")" +
      " contrast(" + (1 + 0.06 * amount).toFixed(3) + ")";
  }

  function outlineGlow(core, glowColor, deep, size) {
    return "drop-shadow(0 0 " + Math.max(2, size * 0.05) + "px " + core + ") " +
      "drop-shadow(0 0 " + (size * 0.16) + "px " + glowColor + ") " +
      "drop-shadow(0 0 " + (size * 0.4) + "px " + deep + ")";
  }

  function createDOMIntro(options) {
    const doc = options.document;
    const config = options.config || {};
    const neon = options.neon || {};
    const background = options.background || {};
    const title = titleFrom(config);
    const core = neon.core || "#FFE9CF";
    const glowColor = neon.glow || "#FF5A1F";
    const deep = neon.deep || "#E01400";
    const style = doc.createElement("style");
    style.textContent = [
      "#intro { position:fixed; inset:0; z-index:8; display:grid; place-items:center; overflow:hidden; pointer-events:none; text-transform:uppercase; opacity:0; }",
      "#intro .neonIntroShade { position:absolute; inset:0; background:radial-gradient(ellipse 68% 48% at 50% 48%, rgba(6,2,1,.08), rgba(6,2,1,.2) 76%, rgba(4,1,0,.42)); }",
      "#intro .neonIntroGlow { position:absolute; inset:-12%; opacity:0; background:radial-gradient(ellipse 48% 34% at 50% 50%, var(--neonIntroGlow), transparent 72%); mix-blend-mode:screen; }",
      "#intro .neonIntroStack { position:relative; width:100%; padding:0 5vw; display:flex; justify-content:center; }",
      "#intro .neonIntroTitle { display:flex; flex-direction:column; align-items:center; max-width:100%; margin:0; text-align:center; font-family:var(--fontBlock, 'Archivo Black', sans-serif); font-weight:900; line-height:.94; letter-spacing:.02em; color:transparent; }",
      "#intro .neonIntroLine { display:block; white-space:pre; }",
      "#intro .neonIntroChar { display:inline-block; white-space:pre; }",
    ].join("\n");
    doc.head.appendChild(style);

    const root = doc.createElement("div");
    root.id = "intro";
    root.setAttribute("aria-hidden", "true");
    root.style.setProperty("--neonIntroCore", core);
    root.style.setProperty("--neonIntroGlow", glowColor);
    root.style.setProperty("--neonIntroDeep", deep);

    const shade = doc.createElement("div");
    shade.className = "neonIntroShade";
    const halo = doc.createElement("div");
    halo.className = "neonIntroGlow";
    const stack = doc.createElement("div");
    stack.className = "neonIntroStack";
    const heading = doc.createElement("h1");
    heading.className = "neonIntroTitle";
    heading.setAttribute("aria-label", title);

    let lines = titleLines(title, (doc.defaultView.innerWidth || 0) < (doc.defaultView.innerHeight || 1));
    const chars = [];
    const lineNodes = [];
    function buildTitle(nextLines) {
      heading.textContent = "";
      chars.length = 0;
      lineNodes.length = 0;
      for (const line of nextLines) {
        const lineNode = doc.createElement("span");
        lineNode.className = "neonIntroLine";
        for (const char of line) {
          const charNode = doc.createElement("span");
          charNode.className = "neonIntroChar";
          charNode.textContent = char;
          lineNode.appendChild(charNode);
          chars.push(charNode);
        }
        heading.appendChild(lineNode);
        lineNodes.push(lineNode);
      }
    }
    buildTitle(lines);
    stack.appendChild(heading);
    root.append(shade, halo, stack);
    const outro = doc.getElementById("outro");
    if (outro && outro.parentNode) outro.parentNode.insertBefore(root, outro);
    else doc.body.appendChild(root);

    function fit() {
      const width = doc.defaultView.innerWidth || 1920;
      const height = doc.defaultView.innerHeight || 1080;
      const portrait = width < height;
      const nextLines = titleLines(title, portrait);
      if (nextLines.join("\n") !== lines.join("\n")) {
        lines = nextLines;
        buildTitle(lines);
        heading.setAttribute("aria-label", title);
      }
      let fontSize = portrait ? width * 0.24 : height * 0.26;
      heading.style.fontSize = fontSize + "px";
      const measuredWidth = Math.max(1, ...lineNodes.map(line => line.scrollWidth));
      const measuredHeight = Math.max(1, heading.scrollHeight);
      fontSize *= Math.min(
        1,
        (width * (portrait ? 0.9 : 0.86)) / measuredWidth,
        (height * 0.62) / measuredHeight
      );
      heading.style.fontSize = fontSize + "px";
      heading.style.webkitTextStroke = Math.max(1.5, fontSize * 0.045) + "px " + core;
      heading.style.filter = outlineGlow(core, glowColor, deep, fontSize);
    }

    fit();
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(fit).catch(() => {});
    doc.defaultView.addEventListener("resize", fit);

    let lastFilter = "";
    let lastTint = "";
    const baseFilter = background.baseFilter || "none";
    function update(timeSeconds, outroActive, durationSeconds) {
      const state = stateAt(timeSeconds, outroActive, durationSeconds);
      root.style.opacity = state.opacity.toFixed(3);
      chars.forEach((char, index) => {
        char.style.opacity = characterOpacity(state.time, index, chars.length, state.duration).toFixed(3);
      });
      const settleStart = Math.min(0.5, state.duration * 0.17);
      const settleDuration = Math.max(0.001, Math.min(1.6, state.duration * 0.54));
      const settle = smooth((state.time - settleStart) / settleDuration);
      heading.style.transform = "scale(" + (1.04 - 0.04 * settle).toFixed(4) + ")";
      const flashAt = state.duration * 0.84;
      const flash = state.time >= flashAt ? Math.exp(-(state.time - flashAt) * 5) : 0;
      halo.style.opacity = (0.25 + 0.55 * flash).toFixed(3);

      const filter = backgroundFilter(baseFilter, state.backgroundLift);
      if (background.image && filter !== lastFilter) background.image.style.filter = filter;
      if (background.video && filter !== lastFilter) background.video.style.filter = filter;
      lastFilter = filter;
      const tint = (1 - 0.75 * state.backgroundLift).toFixed(2);
      if (background.tint && tint !== lastTint) background.tint.style.opacity = tint;
      lastTint = tint;
      return state;
    }

    return {element: root, title, update};
  }

  function createRemotionElement(options) {
    const React = options.React;
    const config = options.config || {};
    const neon = options.neon || {};
    const timeSeconds = Number(options.timeSeconds) || 0;
    const state = stateAt(timeSeconds, Boolean(options.outroActive), options.durationSeconds);
    const title = titleFrom(config);
    if (!state.active || !title) return null;

    const core = neon.core || "#FFE9CF";
    const glowColor = neon.glow || "#FF5A1F";
    const deep = neon.deep || "#E01400";
    const lines = titleLines(title, false);
    const charCount = Math.max(1, [...title].length);
    const longestLine = Math.max(1, ...lines.map(line => line.length));
    const fontSize = Math.min(1080 * 0.26, (1920 * 0.86) / (longestLine * 0.62), (1080 * 0.62) / lines.length);
    const titleNodes = [];
    let index = 0;
    for (const line of lines) {
      const chars = [...line].map(char => {
        const opacity = characterOpacity(timeSeconds, index, charCount, state.duration);
        const node = React.createElement("span", {
          key: "char-" + index,
          style: {display:"inline-block", whiteSpace:"pre", opacity},
        }, char);
        index++;
        return node;
      });
      titleNodes.push(React.createElement("span", {
        key: "line-" + titleNodes.length,
        style: {display:"block", whiteSpace:"pre"},
      }, chars));
    }

    const outlineFilter = outlineGlow(core, glowColor, deep, fontSize);
    const flashAt = state.duration * 0.84;
    const flash = timeSeconds >= flashAt ? Math.exp(-(timeSeconds - flashAt) * 5) : 0;

    return React.createElement("div", {
      style: {
        position:"absolute", inset:0, zIndex:8, display:"flex", alignItems:"center", justifyContent:"center",
        overflow:"hidden", padding:"0 5vw", textAlign:"center", textTransform:"uppercase", opacity:state.opacity,
        pointerEvents:"none",
      },
    },
    React.createElement("div", {
      style: {
        position:"absolute", inset:0,
        background:"radial-gradient(ellipse 68% 48% at 50% 48%, rgba(6,2,1,.08), rgba(6,2,1,.2) 76%, rgba(4,1,0,.42))",
      },
    }),
    React.createElement("div", {
      style: {
        position:"absolute", inset:"-12%", opacity:0.25 + 0.55 * flash,
        background:"radial-gradient(ellipse 48% 34% at 50% 50%, " + glowColor + ", transparent 72%)",
        mixBlendMode:"screen",
      },
    }),
    React.createElement("h1", {
      "aria-label":title,
      style: {
        position:"relative", zIndex:1, display:"flex", flexDirection:"column", alignItems:"center", margin:0,
        maxWidth:"100%", fontFamily:config.fonts && config.fonts.block || "Archivo Black, sans-serif", fontWeight:900,
        fontSize, lineHeight:0.94, letterSpacing:"0.02em", color:"transparent",
        WebkitTextStroke:Math.max(1.5, fontSize * 0.045) + "px " + core, filter:outlineFilter,
      },
    }, titleNodes));
  }

  return {DEFAULT_DURATION_SECONDS, stateAt, backgroundFilter, createDOMIntro, createRemotionElement};
});
