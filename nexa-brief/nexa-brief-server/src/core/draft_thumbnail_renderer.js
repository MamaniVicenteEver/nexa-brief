/* Renderer común para la vista y el JPG de NodeMotion. Sin iframes ni animaciones. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.NexaDraftThumbnailRenderer = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const resources = new Map();
  const loadedFonts = new Map();
  function escapeXml(value) {
    return String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
  }
  function safeColor(value, fallback) {
    if (typeof value !== "string") return fallback;
    if (/^#[a-f\d]{6}$/i.test(value)) return value.toUpperCase();
    if (/^#[a-f\d]{3}$/i.test(value)) return `#${value.slice(1).split("").map(c => c + c).join("")}`.toUpperCase();
    return fallback;
  }
  function number(value, fallback, min, max) {
    return typeof value === "number" && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
  }
  function family(value) {
    return typeof value === "string" && /^[a-z\d -]{1,60}$/i.test(value) ? value : "Arial";
  }
  function safeDesign(raw) {
    raw = raw && typeof raw === "object" ? raw : {};
    const p = raw.palette || {};
    const b = raw.background || {};
    const t = raw.typography || {};
    return {
      palette: { background: safeColor(p.background, "#111111"), foreground: safeColor(p.foreground, "#F4F4F2"), accent: safeColor(p.accent, "#F4F4F2"), brand: safeColor(p.brand, safeColor(p.foreground, "#F4F4F2")), subtitle: safeColor(p.subtitle, safeColor(p.foreground, "#F4F4F2")), deep: safeColor(p.deep, safeColor(p.accent, "#F4F4F2")) },
      background: { kind: ["frame", "image", "solid"].includes(b.kind) ? b.kind : "frame", time: number(b.time, 12, 0, 86400), asset: /^[a-f\d]{24}$/.test(b.asset) ? b.asset : "", overlay: number(b.overlay, .2, 0, .85), edgeDarkening: number(b.edgeDarkening, 0, 0, .5), filter: typeof b.filter === "string" ? (b.filter.match(/(?:grayscale|sepia|saturate|contrast|hue-rotate)\(\s*[-+]?[0-9.]+(?:%|deg)?\s*\)/g) || []).join(" ") : "", x: number(b.x, .5, 0, 1), y: number(b.y, .5, 0, 1) },
      typography: { display: family(t.display), weight: number(t.weight, 700, 100, 900), slant: t.slant === "italic" ? "italic" : "normal", transform: t.transform === "none" ? "none" : "uppercase", tracking: number(t.tracking, -1.5, -5, 12), font: t.font, outlineDisplay: family(t.outlineDisplay || t.display), outlineFont: t.outlineFont },
      style: /^[a-z-]{1,30}$/.test(raw.style) ? raw.style : "minimal",
      outlineWidth: number(raw.outlineWidth, .013, .008, .04),
      rowTreatments: Array.isArray(raw.rowTreatments) ? raw.rowTreatments.filter(value => ["solid", "outline", "striped"].includes(value)).slice(0, 4) : [],
      subtitle: "LETRAS",
    };
  }
  function wrapText(text, maxChars) {
    const words = String(text || "").trim().split(/\s+/u).filter(Boolean);
    const lines = [];
    let line = "";
    for (const word of words) {
      if (line && (line + " " + word).length > maxChars) { lines.push(line); line = ""; }
      line = line ? line + " " + word : word;
    }
    if (line) lines.push(line);
    return lines;
  }
  let context;
  function measure(text, typography, size) {
    if (typeof document !== "undefined") {
      context = context || document.createElement("canvas").getContext("2d");
      if (context) {
        context.font = `${typography.slant} ${typography.weight} ${size}px "${typography.display}"`;
        return context.measureText(text).width + Math.max(0, [...text].length - 1) * typography.tracking;
      }
    }
    return [...text].reduce((n, c) => n + (/[MWÁÓ]/.test(c) ? .85 : /[Iil.,! ]/.test(c) ? .32 : .62) * size, 0);
  }
  function fitTitle(text, typography, maxLines, maxSize) {
    const words = text.split(/\s+/).filter(Boolean);
    const width = 1090;
    const height = 440;
    let best = { lines: [text], size: 1, score: 0 };
    // Pocas palabras: comparar todos los cortes conserva frases y equilibra las dos filas.
    for (let size = maxSize; size >= 5; size -= 1) {
      const lines = [];
      let line = "";
      for (const word of words) {
        const next = line ? line + " " + word : word;
        if (line && measure(next, typography, size) > width) { lines.push(line); line = word; }
        else line = next;
      }
      if (line) lines.push(line);
      if (lines.length > maxLines || lines.length * size * 1.1 > height || lines.some(l => measure(l, typography, size) > width)) continue;
      if (maxLines === 2 && words.length > 1) {
        for (let cut = 1; cut < words.length; cut += 1) {
          const candidate = [words.slice(0, cut).join(" "), words.slice(cut).join(" ")];
          const widths = candidate.map(l => measure(l, typography, size));
          const score = size - Math.abs(widths[0] - widths[1]) / 120;
          if (Math.max(...widths) <= width && size * 2.2 <= height && score > best.score) best = { lines: candidate, size, score };
        }
      }
      const widths = lines.map(l => measure(l, typography, size));
      const score = size - (Math.max(...widths) - Math.min(...widths)) / 120;
      if (score > best.score) best = { lines, size, score };
      if (size < best.size - 12) break;
    }
    return best;
  }
  function safeData(value, type) {
    const pattern = type === "image" ? /^data:image\/(?:jpeg|png|webp);base64,[a-z\d+/=]+$/i : /^data:font\/(?:woff2?|ttf);base64,[a-z\d+/=]+$/i;
    return typeof value === "string" && pattern.test(value) ? value : "";
  }
  function fontCss(fonts) {
    return (fonts || []).map(font => {
      const data = safeData(font.data, "font");
      return data ? `@font-face{font-family:"${family(font.family)}";src:url("${data}");font-weight:${number(font.weight, 700, 100, 900)};font-style:${font.style === "italic" ? "italic" : "normal"};}` : "";
    }).join("");
  }
  function subtitlePosition(lastLine, typography, fontFamily, titleSize, subtitleSize, gapScale) {
    // Reducir el hueco visible, sin reducir la distancia entre centros de las letras.
    if (typeof document !== "undefined" && document.body) {
      const namespace = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(namespace, "svg");
      svg.style.cssText = "position:fixed;left:-10000px;top:-10000px;visibility:hidden;pointer-events:none";
      const text = (content, font, size, y) => {
        const node = document.createElementNS(namespace, "text");
        for (const [key, value] of Object.entries({"font-family":font,"font-size":size,"font-weight":typography.weight,"font-style":typography.slant,"dominant-baseline":"central",x:0,y})) node.setAttribute(key, String(value));
        node.textContent = content;
        svg.appendChild(node);
        return node;
      };
      const title = text(lastLine, typography.display, titleSize, 0);
      const oldSubtitle = text("LETRA", fontFamily, titleSize * .3, titleSize * .88);
      const newSubtitle = text("LETRAS", fontFamily, subtitleSize, 0);
      document.body.appendChild(svg);
      try {
        const inkBounds = node => {
          const box = node.getBBox();
          context = context || document.createElement("canvas").getContext("2d");
          if (!context) return {top: box.y, bottom: box.y + box.height};
          context.font = `${typography.slant} ${typography.weight} ${node.getAttribute("font-size")}px "${node.getAttribute("font-family")}"`;
          const metrics = context.measureText(node.textContent);
          const baseline = box.y + metrics.fontBoundingBoxAscent;
          return {top: baseline - metrics.actualBoundingBoxAscent, bottom: baseline + metrics.actualBoundingBoxDescent};
        };
        const main = inkBounds(title), old = inkBounds(oldSubtitle), current = inkBounds(newSubtitle);
        const gap = Math.max(0, old.top - main.bottom) * .28 * gapScale;
        return {offset: main.bottom + gap - current.top, gap};
      } finally { svg.remove(); }
    }
    const bottom = titleSize * .35;
    const gap = (titleSize * .88 - titleSize * .3 * .35 - bottom) * .28 * gapScale;
    return {offset: bottom + gap + subtitleSize * .35, gap};
  }
  function renderSvg(manifest, option, width, height, assets) {
    const w = Math.round(number(width, 1280, 320, 1920));
    const h = Math.round(number(height, 720, 180, 1920));
    const key = option === "B" ? "B" : "A";
    const selected = manifest?.options?.[key] || {};
    const design = safeDesign(selected.design);
    const { palette: p, typography: t, background: b } = design;
    let title = String(selected.text || "Música").trim().slice(0, 200);
    if (key === "A") title = title.split(/\s+/).slice(0, 5).join(" ");
    if (t.transform !== "none") title = title.toLocaleUpperCase("es");
    const fitted = fitTitle(title, t, key === "A" ? 2 : 4, key === "A" ? 190 : 138);
    const lineHeight = fitted.size * 1.1;
    const center = design.subtitle ? 334 : 360;
    const start = center - (fitted.lines.length - 1) * lineHeight / 2;
    const backgroundData = safeData(assets?.backgroundData, "image");
    const id = `nm-${key.toLowerCase()}`;
    const anchor = `${b.x < .34 ? "xMin" : b.x > .66 ? "xMax" : "xMid"}${b.y < .34 ? "YMin" : b.y > .66 ? "YMax" : "YMid"}`;
    const image = backgroundData ? `<image href="${backgroundData}" width="1280" height="720" preserveAspectRatio="${anchor} slice" /><rect width="1280" height="720" fill="url(#${id}-vignette)"/>` : "";
    const neon = design.style === "neon";
    const defs = `<filter id="${id}-shadow" x="-20%" y="-40%" width="140%" height="180%"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity=".75"/></filter><pattern id="${id}-stripes" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(-12)"><rect width="8" height="3.5" fill="${p.foreground}"/></pattern><style>${fontCss(assets?.fonts)}</style><radialGradient id="${id}-vignette"><stop offset=".1" stop-color="#000000" stop-opacity="${b.overlay}"/><stop offset="1" stop-color="#000000" stop-opacity="${b.overlay}"/></radialGradient>${neon ? `<filter id="${id}-glow" x="-30%" y="-60%" width="160%" height="220%"><feDropShadow dx="0" dy="0" stdDeviation="2" flood-color="${p.foreground}" flood-opacity=".8"/><feDropShadow dx="0" dy="0" stdDeviation="5" flood-color="${p.accent}" flood-opacity=".65"/><feDropShadow dx="0" dy="0" stdDeviation="10" flood-color="${p.deep}" flood-opacity=".35"/></filter>` : ""}`;
    const type = `font-family="${escapeXml(t.display)}" font-weight="${t.weight}" font-style="${t.slant}" letter-spacing="${t.tracking}" text-anchor="middle" dominant-baseline="central"`;
    const spans = fitted.lines.map((line, i) => {
      const last = i === fitted.lines.length - 1;
      const treatment = design.rowTreatments.length ? design.rowTreatments[Math.min(i, design.rowTreatments.length - 1)] : neon ? (last ? "striped" : "outline") : "solid";
      const outline = treatment === "outline";
      const font = outline ? t.outlineDisplay : t.display;
      const ink = outline ? `fill="none" stroke="${p.foreground}" stroke-width="${Math.max(1.4, fitted.size * design.outlineWidth)}" stroke-linejoin="round"` : treatment === "striped" && !(neon && key === "A") ? `fill="url(#${id}-stripes)" stroke="${p.foreground}" stroke-width=".55"` : `fill="${p.foreground}"`;
      return `<tspan data-treatment="${treatment}" font-family="${escapeXml(font)}" ${ink} x="640" y="${start + i * lineHeight}">${escapeXml(line)}</tspan>`;
    }).join("");
    const copy = `<text ${type} font-size="${fitted.size}" filter="url(#${id}-${neon ? "glow" : "shadow"})">${spans}</text>`;
    const lastLine = fitted.lines[fitted.lines.length - 1];
    const subtitleX = Math.min(1185, 640 + measure(lastLine, t, fitted.size) / 2);
    const subtitleSize = fitted.size * (key === "A" ? .243 : .3);
    const subtitleFont = neon ? t.outlineDisplay : t.display;
    const subtitleLayout = subtitlePosition(lastLine, t, subtitleFont, fitted.size, subtitleSize, key === "A" ? .9 : 1);
    const subtitleY = start + (fitted.lines.length - 1) * lineHeight + subtitleLayout.offset;
    const sub = `<text data-role="subtitle" data-gap="${subtitleLayout.gap}" font-family="${escapeXml(subtitleFont)}" font-weight="${t.weight}" font-style="${t.slant}" text-anchor="end" dominant-baseline="central" x="${subtitleX}" y="${subtitleY}" font-size="${subtitleSize}" fill="${p.subtitle}">LETRAS</text>`;
    const brand = `<text x="1224" y="674" text-anchor="end" font-family="Arial, sans-serif" font-size="15.6" font-weight="900" letter-spacing="2" fill="${p.brand}" stroke="${p.brand}" stroke-width=".4" paint-order="stroke" opacity=".28">NODEMOTION</text>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 1280 720" role="img" aria-label="${escapeXml(title)}"><defs>${defs}</defs><rect width="1280" height="720" fill="${p.background}"/>${image}${copy}${sub}${brand}</svg>`;
  }
  async function readData(url, resolveUrl) {
    if (!/^\/api\/v1\/drafts\/[a-z\d/?=&_.%-]+$/i.test(url)) throw new Error("Recurso de miniatura inválido");
    const resolved = resolveUrl ? resolveUrl(url) : url;
    if (resources.has(resolved)) return resources.get(resolved);
    const pending = (async () => {
      const response = await fetch(resolved, { signal: AbortSignal.timeout(25000) });
      if (!response.ok) throw new Error("No se pudo cargar el fondo o la tipografía");
      if (response.status === 204) return "";
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    })();
    resources.set(resolved, pending);
    while (resources.size > 24) resources.delete(resources.keys().next().value);
    pending.catch(() => resources.delete(resolved));
    return pending;
  }
  async function renderSvgAsync(manifest, option, width, height, settings) {
    const selected = manifest?.options?.[option === "B" ? "B" : "A"] || {};
    const design = safeDesign(selected.design);
    let assets = settings?.assets;
    if (!assets) {
      const b = design.background;
      const query = new URLSearchParams({kind: b.kind, time: String(b.time), asset: b.asset, v: String(manifest?.fingerprint || "")});
      const background = manifest?.draftId && /^[a-z\d-]{1,80}$/i.test(manifest.draftId) && b.kind !== "solid"
        ? `/api/v1/drafts/${manifest.draftId}/thumbnail-background?${query}` : null;
      const fonts = [design.typography.font, design.typography.outlineFont].filter(Boolean);
      const [backgroundData, fontData] = await Promise.all([
        background ? readData(background, settings?.resolveUrl) : "",
        Promise.all(fonts.map(font => readData(font.url, settings?.resolveUrl))),
      ]);
      assets = { backgroundData, fonts: fonts.map((font, i) => ({ ...font, data: fontData[i] })) };
    }

    for (const font of assets.fonts || []) {
      if (typeof FontFace === "undefined" || !safeData(font.data, "font")) continue;
      const key = `${font.family}-${font.style}-${font.weight}`;
      if (!loadedFonts.has(key)) {
        const face = new FontFace(family(font.family), `url(${font.data})`, { weight: String(font.weight), style: font.style });
        const pending = face.load().then(loaded => { document.fonts.add(loaded); return loaded; });
        loadedFonts.set(key, pending);
        pending.catch(() => loadedFonts.delete(key));
      }
      await loadedFonts.get(key);
    }
    return renderSvg(manifest, option, width, height, assets);
  }
  return { version: 7, renderSvg, renderSvgAsync, escapeXml, safeColor, safeDesign, wrapText, fitTitle };
});
