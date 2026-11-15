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
      background: { kind: ["frame", "image", "solid"].includes(b.kind) ? b.kind : "frame", mediaSource: ["image", "video"].includes(b.mediaSource) ? b.mediaSource : "auto", mediaVersion: /^[a-f\d]{20}$/.test(b.mediaVersion) ? b.mediaVersion : "", time: number(b.time, 12, 0, 86400), asset: /^[a-f\d]{24}$/.test(b.asset) ? b.asset : "", overlay: number(b.overlay, .2, 0, .85), edgeDarkening: number(b.edgeDarkening, 0, 0, .5), filter: typeof b.filter === "string" ? (b.filter.match(/(?:grayscale|sepia|saturate|contrast|hue-rotate)\(\s*[-+]?[0-9.]+(?:%|deg)?\s*\)/g) || []).join(" ") : "", x: number(b.x, .5, 0, 1), y: number(b.y, .5, 0, 1) },
      typography: { display: family(t.display), weight: number(t.weight, 700, 100, 900), slant: t.slant === "italic" ? "italic" : "normal", transform: t.transform === "none" ? "none" : "uppercase", tracking: number(t.tracking, -1.5, -5, 12), font: t.font, subtitleDisplay: family(t.subtitleDisplay || t.outlineDisplay || t.display), subtitleWeight: number(t.subtitleWeight, t.weight || 700, 100, 900), subtitleSlant: t.subtitleSlant === "italic" ? "italic" : "normal", subtitleFont: t.subtitleFont, outlineDisplay: family(t.outlineDisplay || t.display), outlineFont: t.outlineFont },
      style: /^[a-z-]{1,30}$/.test(raw.style) ? raw.style : "minimal",
      maxWords: number(raw.maxWords, 5, 1, 5),
      outlineWidth: number(raw.outlineWidth, .013, .008, .04),
      rowTreatments: Array.isArray(raw.rowTreatments) ? raw.rowTreatments.filter(value => ["solid", "outline", "striped"].includes(value)).slice(0, 4) : [],
      subtitle: "LETRAS",
      kicker: typeof raw.kicker === "string" ? raw.kicker.replace(/\s+/g, " ").trim().slice(0, 40) : "",
      tagline: typeof raw.tagline === "string" ? raw.tagline.replace(/\s+/g, " ").trim().slice(0, 40) : "",
      side: raw.side === "left" ? "left" : "right",
      corner: typeof raw.corner === "string" ? raw.corner.replace(/[^\S\n]+/g, " ").trim().slice(0, 60) : "",
      year: typeof raw.year === "string" ? raw.year.replace(/\s+/g, " ").trim().slice(0, 12) : "",
      blurb: typeof raw.blurb === "string" ? raw.blurb.replace(/[^\S\n]+/g, " ").trim().slice(0, 180) : "",
      vertical: typeof raw.vertical === "string" ? raw.vertical.replace(/\s+/g, " ").trim().slice(0, 24) : "",
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
  function editorialMetrics(text, typography, size) {
    const advance = Math.max(.01, measure(text, typography, size));
    let ascent = size * .78, descent = size * .18, overhang = 0;
    if (context) {
      const metrics = context.measureText(text);
      if (Number.isFinite(metrics.actualBoundingBoxAscent)) ascent = metrics.actualBoundingBoxAscent;
      if (Number.isFinite(metrics.actualBoundingBoxDescent)) descent = Math.max(0, metrics.actualBoundingBoxDescent);
      overhang = Math.max(0, metrics.actualBoundingBoxLeft || 0, (metrics.actualBoundingBoxRight || 0) - metrics.width);
    }
    // La grotesca extendida de la promo conserva su ancho también con la fuente local estática.
    return { width: advance * 1.12, ascent, descent, overhang: overhang * 1.12 };
  }
  function fitEditorial(text, typography, width, height, maxSize, preferTwoLines) {
    const words = String(text || "").trim().split(/\s+/u).filter(Boolean);
    const candidates = preferTwoLines && words.length > 1 ? [] : [words.join(" ") ? [words.join(" ")] : [""]];
    for (let cut = 1; cut < words.length; cut += 1) candidates.push([words.slice(0, cut).join(" "), words.slice(cut).join(" ")]);
    let best;
    for (const lines of candidates) {
      let low = .01, high = maxSize, layout;
      for (let step = 0; step < 16; step += 1) {
        const size = (low + high) / 2;
        const metrics = lines.map(line => editorialMetrics(line, typography, size));
        const ascent = Math.max(...metrics.map(item => item.ascent));
        const descent = Math.max(...metrics.map(item => item.descent));
        const gap = size * .12;
        const lineHeight = ascent + descent + gap;
        const blockHeight = ascent + descent + (lines.length - 1) * lineHeight;
        if (metrics.every(item => item.width + item.overhang * 2 <= width) && blockHeight <= height) {
          low = size;
          layout = { lines, size, metrics, ascent, descent, lineHeight, height: blockHeight };
        } else high = size;
      }
      if (!layout) continue;
      const widths = layout.metrics.map(item => item.width);
      const imbalance = (Math.max(...widths) - Math.min(...widths)) / Math.max(1, Math.max(...widths));
      const score = layout.size * (1 - imbalance * .07) - (lines.length - 1) * .15;
      if (!best || score > best.score) best = { ...layout, score };
    }
    return best || { lines: [text], size: .01, metrics: [{width: .01, overhang: 0}], ascent: .01, descent: 0, lineHeight: .01, height: .01 };
  }
  function editorialPaper(id, ink) {
    // Pliegues y rayas fijas (semilla constante): textura de papel del video, sin ruido aleatorio.
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const scratches = Array.from({length: 26}, () => {
      const x = rnd() * 1280, y = rnd() * 720, a = (rnd() - .5) * 2.4, l = 60 + rnd() * 220;
      return `M${x.toFixed(1)} ${y.toFixed(1)}l${(Math.cos(a) * l).toFixed(1)} ${(Math.sin(a) * l).toFixed(1)}`;
    }).join("");
    return `<g data-role="editorial-paper"><g fill="url(#${id}-fold)"><rect x="-260" y="290" width="1500" height="36" transform="rotate(32 640 308)"/><rect x="-190" y="178" width="1400" height="28" transform="rotate(-24 640 192)" opacity=".7"/></g><path d="${scratches}" fill="none" stroke="${ink}" stroke-width=".8" opacity=".06"/></g>`;
  }
  function editorialPhoto(data, background, id, clip) {
    if (!data) return "";
    const anchor = `${background.x < .34 ? "xMin" : background.x > .66 ? "xMax" : "xMid"}${background.y < .34 ? "YMin" : background.y > .66 ? "YMax" : "YMid"}`;
    const zoom = background.x === .5 && background.y === .5 ? 1 : 1.2;
    const width = 1280 * zoom, height = 720 * zoom;
    return `<g clip-path="url(#${clip})"><image href="${data}" x="${(1280 - width) * background.x}" y="${(720 - height) * background.y}" width="${width}" height="${height}" preserveAspectRatio="${anchor} slice" filter="url(#${id}-bw)"/><rect width="1280" height="720" fill="#050505" opacity="${background.overlay}"/></g>`;
  }
  function editorialLabel(text, typography, size, spacing) {
    const width = editorialMetrics(text, typography, size).width + Math.max(0, [...text].length - 1) * spacing;
    return {text, width, size};
  }
  function renderEditorialSvg(selected, design, key, w, h, assets) {
    const {palette: p, typography: t, background: b} = design;
    const paperColor = p.background, ink = p.foreground, white = p.accent;
    let title = String(selected.text || "Música").trim().slice(0, 200).split(/\s+/u).filter(Boolean).slice(0, Math.floor(design.maxWords)).join(" ") || "Música";
    if (t.transform !== "none") title = title.toLocaleUpperCase("es");
    const id = `nm-editorial-${key.toLowerCase()}`;
    const photo = b.kind === "solid" ? "" : safeData(assets?.backgroundData, "image");
    const kicker = design.kicker.toLocaleUpperCase("es"), tagline = design.tagline.toLocaleUpperCase("es");
    const font = `font-family="${escapeXml(t.display)}" font-weight="${t.weight}" font-style="${t.slant}"`;
    const textLine = (label, x, y, fill, anchor, spacing) => {
      const start = anchor === "middle" ? x - label.width / 2 : x;
      return `<text ${font} font-size="${label.size}" fill="${fill}" x="${start}" y="${y}" textLength="${label.width}" lengthAdjust="spacingAndGlyphs"${spacing ? ` letter-spacing="${spacing}"` : ""}>${escapeXml(label.text)}</text>`;
    };
    const plate = (x, y, anchor) => {
      if (!tagline) return "";
      const label = editorialLabel(tagline, t, 25, 2.5);
      const left = anchor === "middle" ? x - label.width / 2 - 18 : x;
      return `<rect data-role="tagline" x="${left}" y="${y}" width="${label.width + 36}" height="46" fill="${ink}"/>${textLine(label, left + 18, y + 32, white, "start", 2.5)}`;
    };
    const defs = `<style>${fontCss(assets?.fonts)}</style><linearGradient id="${id}-fold" x1="0%" y1="0%" x2="0%" y2="100%"><stop stop-color="${ink}" stop-opacity="0"/><stop offset=".47" stop-color="${ink}" stop-opacity=".035"/><stop offset=".51" stop-color="${white}" stop-opacity=".5"/><stop offset="1" stop-color="${white}" stop-opacity="0"/></linearGradient><filter id="${id}-bw" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncR type="linear" slope="1.14" intercept="-.06"/><feFuncG type="linear" slope="1.14" intercept="-.06"/><feFuncB type="linear" slope="1.14" intercept="-.06"/></feComponentTransfer></filter>`;
    let body, extraDefs = "", titleBox;
    if (key === "A") {
      // Segundo 4 del video: papel con dos bloques; los bloques son ventanas a la foto.
      const fitted = fitEditorial(title, t, 640, 300, 200, true);
      const pad = fitted.size * .14;
      const top = 352 - fitted.height / 2;
      const baselines = fitted.lines.map((_, i) => top + fitted.ascent + fitted.lineHeight * i);
      const ruleTop = top - pad, ruleEnd = top + fitted.height + pad;
      const mids = baselines.slice(1).map((base, i) => (baselines[i] + fitted.descent + base - fitted.ascent) / 2);
      const windows = [[0, 0, 300, ruleEnd], [980, ruleTop - 58, 300, 720 - ruleTop + 58]];
      extraDefs = `<clipPath id="${id}-windows">${windows.map(([x, y, ww, hh]) => `<rect x="${x}" y="${y}" width="${ww}" height="${hh}"/>`).join("")}</clipPath>`;
      const blocks = windows.map(([x, y, ww, hh]) => `<rect x="${x}" y="${y}" width="${ww}" height="${hh}" fill="${ink}"/>`).join("");
      const rules = [ruleTop, ...mids].map(y => `<path d="M300 ${y}H980" stroke="${ink}" stroke-width="1.6"/>`).join("") + `<path d="M0 ${ruleEnd}H980" stroke="${ink}" stroke-width="1.6"/>`;
      const kick = kicker ? editorialLabel(kicker, t, 21, 9) : null;
      const spans = fitted.lines.map((line, i) => `<tspan x="${640 - fitted.metrics[i].width / 2}" y="${baselines[i]}" textLength="${fitted.metrics[i].width}" lengthAdjust="spacingAndGlyphs">${escapeXml(line)}</tspan>`).join("");
      titleBox = `<text data-role="title" ${font} font-size="${fitted.size}" fill="${ink}">${spans}</text>`;
      body = `${blocks}${editorialPhoto(photo, b, id, `${id}-windows`)}${rules}<rect x="638" y="40" width="4" height="${Math.max(24, ruleTop - 112)}" fill="${ink}"/>${kick ? textLine(kick, 640, ruleTop - 30, ink, "middle", 9) : ""}${plate(640, ruleEnd + 30, "middle")}`;
    } else {
      // Segundos 13-14: foto a un lado fundida con el papel, letras gigantes en contorno y barra en el corte.
      const right = design.side !== "left";
      const fitted = fitEditorial(title, t, 560, 290, 200, true);
      const columnX = right ? 70 : 650;
      const top = 214;
      const baselines = fitted.lines.map((_, i) => top + fitted.ascent + fitted.lineHeight * i);
      const photoX = right ? 660 : 0;
      extraDefs = `<linearGradient id="${id}-fade" x1="${right ? 0 : 1}" x2="${right ? 1 : 0}" y1="0" y2="0"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0"/><stop offset=".24" stop-color="#FFFFFF"/></linearGradient><mask id="${id}-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="1280" height="720"><rect x="${photoX}" width="620" height="720" fill="url(#${id}-fade)"/></mask><clipPath id="${id}-side"><rect x="${photoX}" width="620" height="720"/></clipPath>`;
      const giant = [...title.replace(/\s+/g, "")].slice(0, 2).join("");
      const giantSize = 740;
      const giantWidth = editorialMetrics(giant, t, giantSize).width;
      const giantX = right ? 24 : 1256 - giantWidth;
      // El contorno cambia de tinta a blanco al entrar en la foto, como el corte del video.
      const outlineText = (stroke, clip) => `<text data-role="outline" ${font} font-size="${giantSize}" x="${giantX}" y="668" textLength="${giantWidth}" lengthAdjust="spacingAndGlyphs" fill="none" stroke="${stroke}" stroke-width="1.6"${clip ? ` clip-path="url(#${clip})"` : ""}>${escapeXml(giant)}</text>`;
      extraDefs += `<clipPath id="${id}-paper"><rect x="${right ? 0 : 619}" width="${right ? 661 : 661}" height="720"/></clipPath><clipPath id="${id}-over"><rect x="${right ? 661 : 0}" width="${right ? 619 : 619}" height="720"/></clipPath>`;
      const outline = photo ? outlineText(ink, `${id}-paper`) + outlineText(white, `${id}-over`) : outlineText(ink, "");
      const media = photo ? `<g mask="url(#${id}-mask)">${editorialPhoto(photo, b, id, `${id}-side`)}</g>` : `<rect x="${right ? 760 : 0}" width="520" height="720" fill="${ink}"/>`;
      const barX = right ? 646 : 604;
      const spans = fitted.lines.map((line, i) => `<tspan x="${columnX + fitted.metrics[i].overhang}" y="${baselines[i]}" textLength="${fitted.metrics[i].width}" lengthAdjust="spacingAndGlyphs">${escapeXml(line)}</tspan>`).join("");
      titleBox = `<text data-role="title" ${font} font-size="${fitted.size}" fill="${ink}">${spans}</text>`;
      const below = top + fitted.height;
      const kick = kicker ? editorialLabel(kicker, t, 20, 9) : null;
      body = `${media}${outline}<rect x="${barX}" y="40" width="30" height="640" fill="${ink}"/><rect x="0" y="134" width="${right ? 220 : 180}" height="26" fill="${ink}"/>${kick ? textLine(kick, columnX + 4, below + 52, ink, "start", 9) : ""}${plate(columnX, below + (kick ? 68 : 34), "start")}`;
    }
    const overPhoto = key === "B" ? design.side !== "left" && photo : !!photo;
    const brandColor = overPhoto ? white : ink;
    const brand = `<text data-role="brand" x="1224" y="684" text-anchor="end" ${font} font-size="15" letter-spacing="2" fill="${brandColor}" opacity="${overPhoto ? .45 : .3}">NODEMOTION</text>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 1280 720" role="img" aria-label="${escapeXml(title)}"><defs>${defs}${extraDefs}</defs><rect width="1280" height="720" fill="${paperColor}"/>${editorialPaper(id, ink)}<g data-role="layout">${body}</g>${titleBox}<g>${brand}</g></svg>`;
  }
  function dynamicRandom(seed) {
    return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  }
  function dynamicJag(w, h, r, d) {
    // Borde escalonado tipo píxel del video (jag): tramos rectos con escalones de 1-2 pasos.
    const pts = [];
    const edge = (len, f) => { let p = 0; while (p < len) { const seg = 18 + r() * 46, o = r() < .45 ? 0 : d * (1 + Math.floor(r() * 2)); f(p, o); f(Math.min(len, p + seg), o); p += seg; } };
    edge(w, (x, o) => pts.push([x, o]));
    edge(h, (y, o) => pts.push([w - o, y]));
    edge(w, (x, o) => pts.push([w - x, h - o]));
    edge(h, (y, o) => pts.push([o, h - y]));
    return pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  }
  function dynamicPhoto(data, background, id, box, r, ink, options) {
    const clipId = `${id}-jag-${options.name}`;
    const clip = `<clipPath id="${clipId}"><polygon points="${dynamicJag(box.w, box.h, r, 7)}"/></clipPath>`;
    const y = options.top && background.y === .5 ? 0 : background.y;
    const anchor = `${background.x < .34 ? "xMin" : background.x > .66 ? "xMax" : "xMid"}${y < .34 ? "YMin" : y > .66 ? "YMax" : "YMid"}`;
    const image = (opacity, view, pad) => `<svg x="${box.x + (pad || 0)}" y="${box.y}" width="${box.w}" height="${box.h}" viewBox="0 0 ${box.w} ${box.h}" overflow="hidden"${opacity < 1 ? ` opacity="${opacity}"` : ""}><g clip-path="url(#${clipId})">${data ? `<image href="${data}" x="0" y="0" width="${box.w}" height="${box.h}" preserveAspectRatio="${anchor} slice"/><rect width="${box.w}" height="${box.h}" fill="#000000" opacity="${background.overlay * .5}"/>` : `<rect width="${box.w}" height="${box.h}" fill="${ink}"/>`}</g></svg>`;
    // Estela de copias de la entrada y tira de píxel estirado pegada al borde, congeladas.
    const echoes = (options.echo || []).map(([dx, opacity]) => image(opacity, null, dx)).join("");
    let strip = "";
    if (data && options.strip) {
      const sw = options.strip.width, sx = options.strip.side === "left" ? box.x - sw + 2 : box.x + box.w - 2;
      const column = options.strip.side === "left" ? 2 : box.w - 6;
      strip = `<svg x="${sx}" y="${box.y + box.h * .14}" width="${sw}" height="${box.h * .58}" viewBox="${column} ${box.h * .14} 4 ${box.h * .58}" preserveAspectRatio="none" overflow="hidden"><image href="${data}" x="0" y="0" width="${box.w}" height="${box.h}" preserveAspectRatio="${anchor} slice"/></svg>`;
    }
    return {defs: clip, svg: `${echoes}${strip}${image(1)}`};
  }
  function dynamicHud(id, r, ink, vertical, font) {
    const hatch = (x, y, w, angle) => `<g transform="translate(${x} ${y})"><clipPath id="${id}-h${x | 0}"><rect width="${w}" height="16"/></clipPath><g clip-path="url(#${id}-h${x | 0})" stroke="${ink}" stroke-width="1.6">${Array.from({length: Math.ceil(w / 7) + 3}, (_, i) => `<path d="M${i * 7 - 8} ${angle > 90 ? 0 : 16}L${i * 7} ${angle > 90 ? 16 : 0}"/>`).join("")}</g></g>`;
    const squares = Array.from({length: 4}, () => `<rect x="${(60 + r() * 1150).toFixed(0)}" y="${(40 + r() * 620).toFixed(0)}" width="9" height="9" fill="${ink}"/>`).join("");
    const day = String(Math.floor(r() * 28) + 1).padStart(2, "0"), month = String(Math.floor(r() * 12) + 1).padStart(2, "0");
    const tiny = (text, x, y, extra) => `<text ${font} font-size="11" letter-spacing=".5" fill="${ink}" x="${x}" y="${y}"${extra || ""}>${escapeXml(text)}</text>`;
    return `<rect width="1280" height="720" fill="url(#${id}-dots)" opacity=".24"/>${hatch(64 + r() * 60, 34 + r() * 30, 72, 60)}${hatch(820 + r() * 200, 40 + r() * 24, 64, 120)}${hatch(330 + r() * 200, 640 + r() * 20, 60, 70)}${squares}${tiny(`${day}  ${month}`, 790, 150)}${tiny(String(Math.floor(r() * 9) + 1).padStart(2, "0"), 40, 676)}<rect x="74" y="671" width="62" height="1.4" fill="${ink}"/>${vertical ? tiny(vertical, 1262, 560, ` transform="rotate(-90 1262 560)"`) : ""}`;
  }
  function renderDynamicSvg(selected, design, key, w, h, assets) {
    const {palette: p, typography: t, background: b} = design;
    const lime = p.background, ink = p.foreground;
    let title = String(selected.text || "Deporte").trim().slice(0, 200).split(/\s+/u).filter(Boolean).slice(0, Math.floor(design.maxWords)).join(" ") || "Deporte";
    if (t.transform !== "none") title = title.toLocaleUpperCase("es");
    const id = `nm-dynamic-${key.toLowerCase()}`;
    const photo = b.kind === "solid" ? "" : safeData(assets?.backgroundData, "image");
    const r = dynamicRandom(key === "A" ? 4111 : 7213);
    const font = `font-family="${escapeXml(t.display)}" font-weight="${t.weight}" font-style="${t.slant}"`;
    const kicker = design.kicker.toLocaleUpperCase("es");
    const right = design.side !== "left";
    const words = title.split(" ");
    const giantWord = words.reduce((a, c) => c.length > a.length ? c : a, words[0]);
    const outline = (text, size, x, y, anchor) => {
      const width = editorialMetrics(text, t, size).width;
      const start = anchor === "end" ? x - width : anchor === "middle" ? x - width / 2 : x;
      return `<text data-role="outline" ${font} font-size="${size}" x="${start}" y="${y}" textLength="${width}" lengthAdjust="spacingAndGlyphs" fill="none" stroke="${ink}" stroke-width="1.5">${escapeXml(text)}</text>`;
    };
    const defs = [`<style>${fontCss(assets?.fonts)}</style><pattern id="${id}-dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="11" cy="11" r="1.1" fill="${ink}"/></pattern>`];
    let body, titleSvg;
    if (key === "A") {
      // Palabra y fotografía real con el recorte dentado del montaje Dynamic.
      const giant = outline(giantWord, 400, 46, 499, "start");
      const media = dynamicPhoto(photo, b, id, {x: 64, y: 72, w: 1152, h: 576}, r, ink, {name: "a"});
      defs.push(media.defs);
      const fitted = fitEditorial(title, t, 1020, 240, 130, true);
      const top = 360 - fitted.height / 2;
      const spans = fitted.lines.map((line, i) => {
        const metrics = fitted.metrics[i];
        return `<tspan x="${640 - metrics.width / 2}" y="${top + fitted.ascent + fitted.lineHeight * i}" textLength="${metrics.width}" lengthAdjust="spacingAndGlyphs">${escapeXml(line)}</tspan>`;
      }).join("");
      titleSvg = `<text data-role="title" ${font} font-size="${fitted.size}" fill="${ink}">${spans}</text>`;
      body = `${giant}${media.svg}<rect x="64" y="${top - 24}" width="1152" height="${fitted.height + 48}" fill="${lime}"/>`;
    } else {
      // Escena «FUERZA PURA»: palabra gigante en contorno detrás, titular sólido + contorno y foto escalonada a un lado.
      const fitted = fitEditorial(title, t, 570, 330, 190, true);
      const box = {x: right ? 776 : 84, y: 128, w: 420, h: 470};
      const columnX = right ? 70 : 560;
      const top = 360 - fitted.height / 2;
      const media = dynamicPhoto(photo, b, id, box, r, ink, {name: "b", echo: [[right ? 74 : -74, .22], [right ? 38 : -38, .4]], strip: {side: right ? "left" : "right", width: 120}});
      defs.push(media.defs);
      const giant = outline(giantWord, 420, 640, 520, "middle");
      const spans = fitted.lines.map((line, i) => {
        const m = fitted.metrics[i], y = top + fitted.ascent + fitted.lineHeight * i;
        const x = right ? columnX : columnX + 640 - m.width;
        const hollow = fitted.lines.length > 1 && i === fitted.lines.length - 1;
        return `<tspan x="${x}" y="${y}" textLength="${m.width}" lengthAdjust="spacingAndGlyphs" ${hollow ? `fill="none" stroke="${ink}" stroke-width="${Math.max(2, fitted.size * .022)}" stroke-linejoin="round"` : `fill="${ink}"`}>${escapeXml(line)}</tspan>`;
      }).join("");
      titleSvg = `<text data-role="title" ${font} font-size="${fitted.size}">${spans}</text>`;
      body = `${giant}${media.svg}${kicker ? `<text ${font} font-size="15" letter-spacing="1" fill="${ink}" x="${right ? box.x + box.w : box.x}" y="${box.y + box.h + 34}" text-anchor="${right ? "end" : "start"}">${escapeXml(kicker)}</text>` : ""}`;
    }
    const brand = `<text data-role="brand" x="1224" y="700" text-anchor="end" ${font} font-size="13" letter-spacing="2" fill="${ink}" opacity=".35">NODEMOTION</text>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 1280 720" role="img" aria-label="${escapeXml(title)}"><defs>${defs.join("")}</defs><rect width="1280" height="720" fill="${lime}"/><g data-role="layout">${dynamicHud(id, r, ink, design.vertical || "", font)}${body}</g>${titleSvg}<g>${brand}</g></svg>`;
  }
  function trendyDuo(id, name, dark, light, contrast, gain = 1) {
    // Duotono del video (grades duoLime / bwWarm): luminancia, contraste y mapa oscuro→claro.
    const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16) / 255);
    const d = hex(dark), l = hex(light), k = (1 - contrast) / 2;
    const lum = `${(.2126 * gain).toFixed(4)} ${(.7152 * gain).toFixed(4)} ${(.0722 * gain).toFixed(4)} 0 0`;
    return `<filter id="${id}-${name}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${lum} ${lum} ${lum} 0 0 0 1 0"/><feComponentTransfer><feFuncR type="linear" slope="${contrast}" intercept="${k}"/><feFuncG type="linear" slope="${contrast}" intercept="${k}"/><feFuncB type="linear" slope="${contrast}" intercept="${k}"/></feComponentTransfer><feComponentTransfer>${["R", "G", "B"].map((ch, i) => `<feFunc${ch} type="table" tableValues="${d[i].toFixed(3)} ${l[i].toFixed(3)}"/>`).join("")}</feComponentTransfer></filter>`;
  }
  function trendyTile(data, id, box, filter, zoom, fx, fy, fill) {
    // La misma toma en otro encuadre y otro duotono, como region() del video.
    const iw = box.w * zoom, ih = box.h * zoom;
    const body = data ? `<image href="${data}" x="${(box.w - iw) * fx}" y="${(box.h - ih) * fy}" width="${iw}" height="${ih}" preserveAspectRatio="xMidYMid slice" filter="url(#${id}-${filter})"/>` : `<rect width="${box.w}" height="${box.h}" fill="${fill}"/>`;
    return `<svg x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" viewBox="0 0 ${box.w} ${box.h}" overflow="hidden">${body}</svg>`;
  }
  function trendyMark(x, y, s, color, plus) {
    const arm = `<rect x="${-s / 2}" y="${-s * .14}" width="${s}" height="${s * .28}" rx="${s * .06}"/>`;
    return `<g transform="translate(${x} ${y}) rotate(${plus ? 0 : 45})" fill="${color}" opacity=".92">${arm}<g transform="rotate(90)">${arm}</g></g>`;
  }
  function trendyWidth(text, t, size) {
    return measure(text, t, size) + size * .12;
  }
  function renderTrendySvg(selected, design, key, w, h, assets) {
    const {palette: p, typography: t, background: b} = design;
    const lime = p.accent, ink = p.foreground, dark = p.background, paper = p.subtitle;
    let title = String(selected.text || "Sin límites").trim().slice(0, 200).split(/\s+/u).filter(Boolean).slice(0, Math.floor(design.maxWords)).join(" ") || "Sin límites";
    if (t.transform !== "none") title = title.toLocaleUpperCase("es");
    const id = `nm-trendy-${key.toLowerCase()}`;
    const photo = b.kind === "solid" ? "" : safeData(assets?.backgroundData, "image");
    const font = `font-family="${escapeXml(t.display)}" font-weight="${t.weight}" font-style="${t.slant}"`;
    const defs = `<style>${fontCss(assets?.fonts)}</style>${trendyDuo(id, "lime", dark, lime, 1.35)}${trendyDuo(id, "warm", "#0C0C0E", paper, 1.4)}<filter id="${id}-grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="7"/><feColorMatrix type="saturate" values="0"/></filter><filter id="${id}-lift" x="-10%" y="-30%" width="120%" height="160%"><feDropShadow dx="0" dy="0" stdDeviation="6" flood-color="#000" flood-opacity=".55"/></filter><radialGradient id="${id}-leak" cx="1" cy="1" r=".75"><stop offset="0" stop-color="#7A2E12" stop-opacity=".55"/><stop offset="1" stop-color="#7A2E12" stop-opacity="0"/></radialGradient><radialGradient id="${id}-vig" cx=".5" cy=".5" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".5"/></radialGradient>`;
    const fx = b.x, fy = b.y;
    const band = (x, y, width, height) => `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${lime}"/>`;
    const words = title.split(" ");
    let body, copy;
    if (key === "A") {
      // Escena «ÉLITE» (segundo 19): toma completa en duotono lima con fuga de luz cálida,
      // titular sólido claro para lectura en pequeño, «+» y aro fino.
      const full = photo ? `<image href="${photo}" x="0" y="0" width="1280" height="720" preserveAspectRatio="${fx < .34 ? "xMin" : fx > .66 ? "xMax" : "xMid"}${fy < .34 ? "YMin" : fy > .66 ? "YMax" : "YMid"} slice" filter="url(#${id}-lime)"/>` : "";
      const lines = words.length > 2 ? [words.slice(0, Math.ceil(words.length / 2)).join(" "), words.slice(Math.ceil(words.length / 2)).join(" ")] : [title];
      const widest = Math.max(...lines.map(line => trendyWidth(line, t, 100)));
      const size = Math.min(200, 100 * 1040 / widest, lines.length > 1 ? 165 : 200);
      const lineH = size * 1.05;
      const first = 360 - lineH * (lines.length - 1) / 2 + size * .36;
      const spans = lines.map((line, i) => `<tspan x="${640 - trendyWidth(line, t, size) / 2 + size * .06}" y="${first + lineH * i}">${escapeXml(line)}</tspan>`).join("");
      copy = `<text data-role="title" ${font} font-size="${size}" fill="${paper}" stroke="${dark}" stroke-width="${Math.max(2.6, size * .019)}" paint-order="stroke" stroke-linejoin="round" filter="url(#${id}-lift)">${spans}</text>`;
      // La escena original es oscura: se baja la toma para que el titular se lea en pequeño.
      body = `${full}<rect width="1280" height="720" fill="${dark}" opacity="${Math.max(.32, b.overlay)}"/><rect width="1280" height="720" fill="url(#${id}-leak)"/><rect width="1280" height="720" fill="url(#${id}-vig)"/><circle cx="112" cy="652" r="132" fill="none" stroke="${paper}" stroke-width="1.2" opacity=".55"/>${trendyMark(1136, 128, 26, paper, true)}`;
    } else {
      // Escena «CADA DÍA» (segundo 7): mitad duotono lima, mitad B/N cálido y bandas lima en escalera.
      const lines = words.length > 1 ? (() => {
        let best = [words.join(" ")], gap = Infinity;
        for (let cut = 1; cut < words.length; cut += 1) {
          const pair = [words.slice(0, cut).join(" "), words.slice(cut).join(" ")];
          const diff = Math.abs(trendyWidth(pair[0], t, 100) - trendyWidth(pair[1], t, 100));
          if (diff < gap) { gap = diff; best = pair; }
        }
        return best;
      })() : [title];
      const widest = Math.max(...lines.map(line => trendyWidth(line, t, 100)));
      const size = Math.min(lines.length > 1 ? 150 : 190, 100 * 1000 / widest);
      const bandH = size * 1.28, padX = size * .42;
      const top = 372 - bandH * lines.length / 2 - (lines.length > 1 ? 0 : 0);
      // Una sola toma continua: la mitad izquierda en duotono lima y la derecha en B/N cálido.
      const half = (x, filter) => `<svg x="${x}" y="0" width="640" height="720" viewBox="${x} 0 640 720" overflow="hidden">${photo ? `<image href="${photo}" x="0" y="0" width="1280" height="720" preserveAspectRatio="${fx < .34 ? "xMin" : fx > .66 ? "xMax" : "xMid"}${fy < .34 ? "YMin" : fy > .66 ? "YMax" : "YMid"} slice" filter="url(#${id}-${filter})"/>` : `<rect x="${x}" width="640" height="720" fill="${filter === "lime" ? dark : "#3A3A38"}"/>`}</svg>`;
      const tiles = half(0, "lime") + half(640, "warm");
      const w1 = trendyWidth(lines[0], t, size) + padX * 2;
      const x1 = lines[1] ? 92 : 640 - w1 / 2;
      let bands = band(x1, top, w1, bandH);
      let spans = `<tspan x="${x1 + padX}" y="${top + bandH / 2 + size * .36}">${escapeXml(lines[0])}</tspan>`;
      if (lines[1]) {
        const w2 = trendyWidth(lines[1], t, size) + padX * 2;
        // La segunda banda sale a sangre por la derecha y nunca empieza antes que la primera.
        const x2 = Math.max(x1 + 70, Math.min(1280 - w2, x1 + w1 - padX));
        bands += band(x2, top + bandH, 1280 - x2, bandH);
        spans += `<tspan x="${x2 + padX}" y="${top + bandH * 1.5 + size * .36}">${escapeXml(lines[1])}</tspan>`;
      }
      copy = `<text data-role="title" ${font} font-size="${size}" fill="${ink}">${spans}</text>`;
      body = `${tiles}<rect width="1280" height="720" fill="url(#${id}-vig)"/>${bands}${trendyMark(104, 128, 22, paper)}${trendyMark(600, 650, 22, paper, true)}${trendyMark(1226, top + 30, 22, paper)}`;
    }
    const grain = `<rect width="1280" height="720" filter="url(#${id}-grain)" opacity=".07" style="mix-blend-mode:overlay"/>`;
    const brand = `<text data-role="brand" x="1224" y="700" text-anchor="end" ${font} font-size="13" letter-spacing="2" fill="${paper}" opacity=".5">NODEMOTION</text>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 1280 720" role="img" aria-label="${escapeXml(title)}"><defs>${defs}</defs><rect width="1280" height="720" fill="${dark}"/><g data-role="layout">${body}</g>${copy}<g>${grain}${brand}</g></svg>`;
  }
  function urbanRunner(x, y, s, color, fill) {
    // Pictograma de corredor del video (runner), en coordenadas de una caja s×s.
    const pts = [[.5, .25], [.72, .3], [.85, .46], [.78, .5], [.68, .4], [.6, .56], [.78, .72], [.74, .96], [.64, .94], [.66, .77], [.46, .64], [.34, .8], [.12, .78], [.14, .7], [.3, .7], [.42, .46], [.36, .4], [.24, .52], [.17, .47], [.32, .3]];
    const paint = fill === false ? `fill="none" stroke="${color}" stroke-width="${Math.max(1.5, s * .012)}"` : `fill="${color}"`;
    return `<g transform="translate(${x} ${y})" ${paint}><circle cx="${s * .62}" cy="${s * .12}" r="${s * .1}"/><path d="M${pts.map(([a, b]) => `${(a * s).toFixed(1)} ${(b * s).toFixed(1)}`).join("L")}Z"/></g>`;
  }
  function urbanHatch(id, name, x, y, w, h, color) {
    return `<clipPath id="${id}-${name}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath><g clip-path="url(#${id}-${name})" stroke="${color}" stroke-width="${h * .2}">${Array.from({length: Math.ceil((w + h) / (h * .5)) + 1}, (_, i) => `<path d="M${x + i * h * .5 - h} ${y + h}L${x + i * h * .5} ${y}"/>`).join("")}</g>`;
  }
  function renderUrbanSvg(selected, design, key, w, h, assets) {
    const {palette: p, typography: t, background: b} = design;
    const white = p.foreground, orange = p.accent, dark = p.background, red = p.subtitle;
    let title = String(selected.text || "Pura calle").trim().slice(0, 200).split(/\s+/u).filter(Boolean).slice(0, Math.floor(design.maxWords)).join(" ") || "Pura calle";
    if (t.transform !== "none") title = title.toLocaleUpperCase("es");
    const id = `nm-urban-${key.toLowerCase()}`;
    const photo = b.kind === "solid" ? "" : safeData(assets?.backgroundData, "image");
    const font = `font-family="${escapeXml(t.display)}" font-weight="${t.weight}" font-style="${t.slant}"`;
    const thin = `font-family="${escapeXml(t.display)}" font-weight="${Math.min(t.weight, 600)}"`;
    const anchor = `${b.x < .34 ? "xMin" : b.x > .66 ? "xMax" : "xMid"}${b.y < .34 ? "YMin" : b.y > .66 ? "YMax" : "YMid"}`;
    const width = (text, size) => measure(text, {...t, tracking: -size * .02}, size);
    const multi = (text, x, y, size, lh, fill, attrs) => String(text || "").split(/\n/).filter(Boolean).map((line, i) => `<text ${attrs} font-size="${size}" fill="${fill}" x="${x}" y="${y + i * lh}">${escapeXml(line.trim().toLocaleUpperCase("es"))}</text>`).join("");
    const defs = [`<style>${fontCss(assets?.fonts)}</style>${trendyDuo(id, "red", dark, red, 1.3, key === "A" ? 1.15 : 1)}${trendyDuo(id, "cold", "#060606", "#E9E9E6", 1.35)}<filter id="${id}-grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="11"/><feColorMatrix type="saturate" values="0"/></filter><radialGradient id="${id}-vig" cx=".5" cy=".5" r=".75"><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></radialGradient>`];
    const image = photo ? `<image href="${photo}" x="0" y="0" width="1280" height="720" preserveAspectRatio="${anchor} slice" filter="url(#${id}-red)"/>` : "";
    // HUD fijo del video: esquina, raya naranja, puntos, serie y año.
    const hud = `${multi(design.corner, 38, 34, 10.5, 12.5, white, `${thin} letter-spacing=".4" opacity=".85"`)}<rect x="176" y="22" width="44" height="2.4" fill="${orange}"/><g fill="${orange}">${[0, 1, 2].map(i => `<rect x="${1004 + i * 7}" y="44" width="3.4" height="3.4"/>`).join("")}</g>${design.tagline ? `<text ${thin} font-size="10.5" letter-spacing=".4" fill="${white}" opacity=".85" x="1242" y="40" text-anchor="end">${escapeXml(design.tagline.toLocaleUpperCase("es"))}</text>` : ""}${design.year ? `<text ${thin} font-size="10.5" fill="${orange}" x="1242" y="676" text-anchor="end">[${escapeXml(design.year)}]</text>` : ""}`;
    const words = title.split(" ");
    let body, copy;
    if (key === "A") {
      // Escena «PURA CALLE» (segundo 2): fondo oscuro, año gigante en contorno, la toma en duotono rojo
      // arriba a la derecha y en B/N frío abajo al centro; primera palabra grande, el resto menor con flecha.
      const tile = (box, filter, zoom, fx, fy) => {
        const iw = box.w * zoom, ih = box.h * zoom;
        return `<svg x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" viewBox="0 0 ${box.w} ${box.h}" overflow="hidden">${photo ? `<image href="${photo}" x="${(box.w - iw) * fx}" y="${(box.h - ih) * fy}" width="${iw}" height="${ih}" preserveAspectRatio="xMidYMid slice" filter="url(#${id}-${filter})"/>` : `<rect width="${box.w}" height="${box.h}" fill="${filter === "red" ? red : "#2A2A2A"}"/>`}</svg>`;
      };
      const year = design.year ? `<text ${font} font-size="560" letter-spacing="-11" fill="none" stroke="${white}" stroke-width="1.2" opacity=".16" x="640" y="584" text-anchor="middle">${escapeXml(design.year)}</text>` : "";
      const first = words.length > 1 ? words[0] : title, rest = words.length > 1 ? words.slice(1).join(" ") : "";
      let big = 150;
      if (width(first, big) > 760) big *= 760 / width(first, big);
      const bw = width(first, big), bigX = 640 - bw / 2 - 20, bigBase = 358;
      let small = 62;
      if (rest && width(rest, small) > 620) small *= 620 / width(rest, small);
      const sw = rest ? width(rest, small) : 0, smallRight = bigX + bw, smallBase = bigBase + small * 1.02;
      const arrow = rest ? `<path d="M${smallRight + small * .82} ${smallBase - small * .78}L${smallRight + small * .2} ${smallBase - small * .02}M${smallRight + small * .2} ${smallBase - small * .5}V${smallBase - small * .02}H${smallRight + small * .68}" fill="none" stroke="${orange}" stroke-width="${Math.max(3, small * .07)}"/>` : "";
      copy = `<text data-role="title" ${font} letter-spacing="${-big * .02}" fill="${white}"><tspan font-size="${big}" x="${bigX}" y="${bigBase}">${escapeXml(first)}</tspan>${rest ? `<tspan font-size="${small}" x="${smallRight - sw - small * .06}" y="${smallBase}" letter-spacing="${-small * .02}">${escapeXml(rest)}</tspan>` : ""}</text>`;
      body = `<rect width="1280" height="720" fill="#0B0B0B"/>${year}${tile({x: 662, y: 32, w: 382, h: 358}, "red", 1.25, .8, .3)}${tile({x: 383, y: 326, w: 356, h: 360}, "cold", 1.6, .5, .25)}<circle cx="760" cy="420" r="196" fill="none" stroke="${white}" stroke-width="1" opacity=".14"/>${arrow}${urbanHatch(id, "hw", 102, 450, 178, 40, white)}${multi(design.blurb, 104, 556, 10, 12.5, white, `${thin} letter-spacing=".3" opacity=".85"`)}`;
    } else {
      // Composición «SIN EXCUSAS» (segundo 19) sobre la toma roja oscurecida como en «ACTITUD»: primera palabra gigante en naranja detrás,
      // el resto en blanco delante con ®, corredor, texto pequeño y rayado.
      const giantText = words.length > 1 ? words[0] : title;
      const front = words.length > 1 ? words.slice(1).join(" ") : title;
      let giant = 330;
      if (width(giantText, giant) > 900) giant *= 900 / width(giantText, giant);
      const gw = width(giantText, giant), gBase = 452;
      let size = 124;
      // Como «EXCUSAS» sobre «SIN»: la palabra blanca arranca dentro de la gigante y termina fuera de ella,
      // así ® y el corredor caen sobre la foto; luego se centra el conjunto.
      const place = sz => Math.max(gw * .24, gw + sz * .18 - width(front, sz));
      let span = Math.max(gw, place(size) + width(front, size) + size * .55);
      if (span > 1120) { size *= 1120 / span; span = Math.max(gw, place(size) + width(front, size) + size * .55); }
      const gx = 640 - span / 2, frontX = gx + place(size);
      const fw = width(front, size), fBase = gBase + 6;
      copy = `<text data-role="title" ${font} font-size="${size}" letter-spacing="${-size * .02}" fill="${white}" x="${frontX}" y="${fBase}">${escapeXml(front)}</text>`;
      body = `${image}<rect width="1280" height="720" fill="#000" opacity="${Math.max(.55, b.overlay)}"/><rect width="1280" height="720" fill="url(#${id}-vig)"/><text ${font} font-size="${giant}" letter-spacing="${-giant * .02}" fill="${orange}" x="${gx}" y="${gBase}">${escapeXml(giantText)}</text><text ${font} font-size="${size * .32}" fill="${orange}" x="${frontX + fw + size * .03}" y="${fBase - size * .5}">®</text>${urbanRunner(frontX + fw + size * .06, fBase - size * .3, size * .42, white)}${multi(design.blurb, frontX + 2, fBase + 28, 10, 12.5, white, `${thin} letter-spacing=".3" opacity=".9"`)}${urbanHatch(id, "ha", frontX + fw * .74, fBase + 30, 104, 26, white)}`;
    }
    const grain = `<rect width="1280" height="720" filter="url(#${id}-grain)" opacity=".09" style="mix-blend-mode:overlay"/>`;
    const brand = `<text data-role="brand" x="1242" y="700" text-anchor="end" ${thin} font-size="11" letter-spacing="2" fill="${white}" opacity=".45">NODEMOTION</text>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 1280 720" role="img" aria-label="${escapeXml(title)}"><defs>${defs.join("")}</defs><rect width="1280" height="720" fill="${dark}"/><g data-role="layout">${body}${hud}</g>${copy}<g>${grain}${brand}</g></svg>`;
  }
  function renderSportsSvg(selected, design, key, w, h, assets) {
    const {palette: p, typography: t, background: b} = design;
    const white = p.foreground, yellow = p.accent, dark = p.background, stone = "#DEDBD3";
    let title = String(selected.text || "Deporte").trim().slice(0, 200).split(/\s+/u).filter(Boolean).slice(0, Math.floor(design.maxWords)).join(" ") || "Deporte";
    if (t.transform !== "none") title = title.toLocaleUpperCase("es");
    const id = `nm-sports-${key.toLowerCase()}`;
    const photo = b.kind === "solid" ? "" : safeData(assets?.backgroundData, "image");
    const font = `font-family="${escapeXml(t.display)}" font-weight="${t.weight}" font-style="${t.slant}"`;
    const anchor = `${b.x < .34 ? "xMin" : b.x > .66 ? "xMax" : "xMid"}${b.y < .34 ? "YMin" : b.y > .66 ? "YMax" : "YMid"}`;
    const words = title.split(" ");
    const giantWord = words.reduce((a, c) => c.length > a.length ? c : a, words[0]);
    const tracked = (text, size, spacing) => measure(text, {...t, tracking: 0}, size) + Math.max(0, [...text].length - 1) * spacing;
    // Grades del video: «cine» (saturación .55, contraste 1.18, brillo .72) y «duoYel» (#0A0A03→amarillo).
    const cine = `<filter id="${id}-cine" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values=".55"/><feComponentTransfer><feFuncR type="linear" slope="${1.18 * .72}" intercept="${-.09 * .72}"/><feFuncG type="linear" slope="${1.18 * .72}" intercept="${-.09 * .72}"/><feFuncB type="linear" slope="${1.18 * .72}" intercept="${-.09 * .72}"/></feComponentTransfer></filter>`;
    // Piedra moteada de las letras gigantes (noiseTile del video): motas oscuras sólo dentro del texto.
    const speck = `<filter id="${id}-stone" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="1" seed="5" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 .25  0 0 0 0 .25  0 0 0 0 .24  -16 0 0 0 5.9" result="specks"/><feComposite in="specks" in2="SourceGraphic" operator="in" result="inside"/><feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="inside"/></feMerge></filter>`;
    const defs = `<style>${fontCss(assets?.fonts)}</style>${cine}${trendyDuo(id, "yel", "#0A0A03", yellow, 1.35, .9)}${speck}<filter id="${id}-grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="3"/><feColorMatrix type="saturate" values="0"/></filter><radialGradient id="${id}-vig" cx=".5" cy=".5" r=".75"><stop offset=".45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".6"/></radialGradient><filter id="${id}-lift" x="-10%" y="-40%" width="120%" height="180%"><feDropShadow dx="0" dy="3" stdDeviation="7" flood-color="#000" flood-opacity=".6"/></filter>`;
    let body, copy;
    if (key === "A") {
      // Escena «DEPORTE» (segundo 1): letras gigantes de piedra, ahora enteras y legibles, y el titular
      // amarillo más grande sobre una franja oscura inclinada para leerse encima de la piedra.
      const image = photo ? `<image href="${photo}" width="1280" height="720" preserveAspectRatio="${anchor} slice" filter="url(#${id}-cine)"/><rect width="1280" height="720" fill="#0A1020" opacity="${Math.max(.38, b.overlay)}"/>` : "";
      let giant = 400;
      const gw0 = measure(giantWord, {...t, tracking: 0}, giant) * .98;
      if (gw0 > 1190) giant *= 1190 / gw0;
      const gw = measure(giantWord, {...t, tracking: 0}, giant) * .98;
      const gBase = 360 + giant * .36;
      let size = 96, spacing = size * .08;
      if (tracked(title, size, spacing) > 880) { size *= 880 / tracked(title, size, spacing); spacing = size * .08; }
      const tw = tracked(title, size, spacing);
      const bandH = size * 1.02, bandW = tw + size * .9;
      copy = `<text data-role="title" ${font} font-size="${size}" letter-spacing="${spacing}" fill="${yellow}" x="${640 - tw / 2}" y="${360 + size * .36}">${escapeXml(title)}</text>`;
      body = `${image}<rect width="1280" height="720" fill="url(#${id}-vig)"/><text ${font} font-size="${giant}" letter-spacing="${-giant * .02}" fill="${stone}" x="${640 - gw / 2}" y="${gBase}" filter="url(#${id}-stone)">${escapeXml(giantWord)}</text><polygon points="${640 - bandW / 2 + size * .3},${360 - bandH / 2} ${640 + bandW / 2 + size * .3},${360 - bandH / 2} ${640 + bandW / 2 - size * .3},${360 + bandH / 2} ${640 - bandW / 2 - size * .3},${360 + bandH / 2}" fill="${dark}" opacity=".92"/>`;
    } else {
      // Escena «ENERGÍA» (segundo 15): toma «cine» oscura y fría, la palabra en contorno
      // amarillo gigante (una sola) y el titular blanco más grande.
      // Grade «cine» de la escena, más oscuro y frío: el amarillo y el blanco quedan como únicos colores.
      const image = photo ? `<image href="${photo}" width="1280" height="720" preserveAspectRatio="${anchor} slice" filter="url(#${id}-cine)"/><rect width="1280" height="720" fill="#05080C" opacity="${Math.max(.5, b.overlay)}"/>` : "";
      // Una sola palabra de fondo, sólo contorno y mucho más grande: se recorta un poco por los lados,
      // como en la escena, pero se sigue leyendo.
      let giant = 620;
      const gw0 = measure(giantWord, {...t, tracking: 0}, giant);
      if (gw0 > 1500) giant *= 1500 / gw0;
      const gw = measure(giantWord, {...t, tracking: 0}, giant);
      const rows = `<text ${font} font-size="${giant}" fill="none" stroke="${yellow}" stroke-width="2.2" opacity=".85" x="${640 - gw / 2}" y="${360 + giant * .36}">${escapeXml(giantWord)}</text>`;
      let size = 112, spacing = size * .1;
      if (tracked(title, size, spacing) > 1000) { size *= 1000 / tracked(title, size, spacing); spacing = size * .1; }
      const tw = tracked(title, size, spacing);
      copy = `<text data-role="title" ${font} font-size="${size}" letter-spacing="${spacing}" fill="${white}" x="${640 - tw / 2}" y="${360 + size * .36}" filter="url(#${id}-lift)">${escapeXml(title)}</text>`;
      body = `${image}<rect width="1280" height="720" fill="url(#${id}-vig)"/>${rows}<rect x="${640 - 48}" y="${360 + size * .62}" width="96" height="6" fill="${yellow}" transform="skewX(-12)" transform-origin="640 ${360 + size * .62}"/>`;
    }
    const grain = `<rect width="1280" height="720" filter="url(#${id}-grain)" opacity=".08" style="mix-blend-mode:overlay"/>`;
    const brand = `<text data-role="brand" x="1236" y="696" text-anchor="end" ${font} font-size="13" letter-spacing="2" fill="${white}" opacity=".4">NODEMOTION</text>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 1280 720" role="img" aria-label="${escapeXml(title)}"><defs>${defs}</defs><rect width="1280" height="720" fill="${dark}"/><g data-role="layout">${body}</g>${copy}<g>${grain}${brand}</g></svg>`;
  }
  function renderKineticSvg(selected, design, key, w, h, assets) {
    const {palette: p, typography: t} = design;
    const bone = p.foreground, orange = p.accent, bg = p.background;
    let title = String(selected.text || "Desde el centro").trim().slice(0, 200).split(/\s+/u).filter(Boolean).slice(0, Math.floor(design.maxWords)).join(" ") || "Desde el centro";
    if (t.transform !== "none") title = title.toLocaleUpperCase("es");
    const id = `nm-kinetic-${key.toLowerCase()}`;
    const r = dynamicRandom(key === "A" ? 2029 : 3029);
    const font = `font-family="${escapeXml(t.display)}" font-weight="${t.weight}" font-style="${t.slant}"`;
    const mono = `font-family="JetBrains Mono, DejaVu Sans Mono, monospace" font-weight="500"`;
    const width = (text, size) => measure(text, {...t, tracking: -size * .02}, size);
    // Rayones finos y HUD monoespaciado del video: marca, contador y código de tiempo.
    const scratches = Array.from({length: 16}, () => {
      const x = r() * 1280, y = r() * 720;
      return `M${x.toFixed(0)} ${y.toFixed(0)}c${(r() * 30 - 15).toFixed(0)} ${(r() * 20 - 10).toFixed(0)} ${(r() * 40 - 20).toFixed(0)} ${(r() * 30 - 5).toFixed(0)} ${(r() * 50 - 25).toFixed(0)} ${(r() * 26 - 13).toFixed(0)}`;
    }).join("");
    const hud = `<path d="${scratches}" fill="none" stroke="#000" stroke-width="1.1" opacity=".55"/><g ${mono} font-size="10" letter-spacing=".6" fill="#E6E6E6" opacity=".5"><text x="38" y="40">${escapeXml((design.kicker || "NEXA").toLocaleUpperCase("es"))}</text><text x="1242" y="40" text-anchor="end">${key === "A" ? "20 / 29" : "03 / 29"}</text><text x="38" y="684">${key === "A" ? "00:18.32" : "00:50.02"}</text></g><rect x="1234" y="672" width="8" height="8" fill="${bone}" opacity=".7"/>`;
    const defs = `<style>${fontCss(assets?.fonts)}</style><filter id="${id}-grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="13"/><feColorMatrix type="saturate" values="0"/></filter>`;
    let body, copy;
    if (key === "A") {
      // Componente marker del video: cada renglón queda íntegro sobre una placa de color.
      const words = title.split(" ");
      let lines = [title], size = 170;
      if (width(title, size) > 1080 && words.length > 1) {
        let best = null;
        for (let cut = 1; cut < words.length; cut += 1) {
          const pair = [words.slice(0, cut).join(" "), words.slice(cut).join(" ")];
          const widest = Math.max(...pair.map(line => width(line, 100)));
          if (!best || widest < best.widest) best = {pair, widest};
        }
        lines = best.pair;
      }
      const widest = Math.max(...lines.map(line => width(line, size)));
      if (widest > 1080) size *= 1080 / widest;
      const lineH = size * 1.18;
      const firstY = 360 - (lines.length - 1) * lineH / 2 + size * .32;
      const plates = [], labels = [];
      lines.forEach((line, index) => {
        const tw = width(line, size), y = firstY + index * lineH, pad = size * .18;
        plates.push(`<rect x="${640 - tw / 2 - pad}" y="${y - size * .78}" width="${tw + pad * 2}" height="${size * 1.03}" fill="${orange}"/>`);
        labels.push(`<text ${font} font-size="${size}" letter-spacing="${-size * .02}" fill="${bone}" x="${640 - tw / 2}" y="${y}">${escapeXml(line)}</text>`);
      });
      body = plates.join("");
      copy = `<g data-role="title">${labels.join("")}</g>`;
    } else {
      // Escena «WOW» (segundo 4): el titular entre paréntesis con eco que se apagan hacia fuera.
      const words = title.split(" ");
      let lines = [title], size = 150;
      if (width(title, size) > 820) {
        const single = size * 820 / width(title, size);
        if (single < 104 && words.length > 1) {
          let best = null;
          for (let cut = 1; cut < words.length; cut += 1) {
            const pair = [words.slice(0, cut).join(" "), words.slice(cut).join(" ")];
            const widest = Math.max(...pair.map(line => width(line, 100)));
            if (!best || widest < best.widest) best = {pair, widest};
          }
          lines = best.pair;
          size = Math.min(130, 100 * 820 / best.widest);
        } else size = single;
      }
      const lineH = size * .98, block = size * .74 + (lines.length - 1) * lineH;
      const top = 360 - block / 2;
      const tw = Math.max(...lines.map(line => width(line, size)));
      const spans = lines.map((line, i) => `<tspan x="${640 - width(line, size) / 2}" y="${top + size * .74 + i * lineH}">${escapeXml(line)}</tspan>`).join("");
      copy = `<text data-role="title" ${font} font-size="${size}" letter-spacing="${-size * .02}" fill="${bone}">${spans}</text>`;
      // Paréntesis como medias lunas vectoriales: el principal pegado al texto y tres ecos más bajos,
      // finos y apagados hacia fuera, con aire entre ellos como en la escena.
      const H = block + size * .62, bow = H * .13;
      const echo = [[0, 1, 1], [1, .84, .72], [2, .7, .5], [3, .58, .3]];
      const paren = (side, [i, scale, opacity]) => {
        const hh = H * scale, th = size * .3 * (1 - i * .14), step = size * .4;
        const edge = 640 + side * (tw / 2 + size * .2 + i * step);
        const top = 360 - hh / 2, bottom = 360 + hh / 2, out = edge + side * bow * scale * 2;
        // Curva exterior y vuelta por la interior: grosor máximo th en el centro, puntas finas.
        return `<path d="M${edge} ${top}Q${out} 360 ${edge} ${bottom}Q${out - side * th * 2} 360 ${edge} ${top}Z" fill="${bone}" opacity="${opacity}"/>`;
      };
      body = echo.map(e => paren(-1, e) + paren(1, e)).join("");
    }
    const grain = `<rect width="1280" height="720" filter="url(#${id}-grain)" opacity=".1" style="mix-blend-mode:overlay"/>`;
    const brand = `<text data-role="brand" x="1218" y="684" text-anchor="end" ${mono} font-size="10" letter-spacing="1.5" fill="#E6E6E6" opacity=".35">NODEMOTION</text>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 1280 720" role="img" aria-label="${escapeXml(title)}"><defs>${defs}</defs><rect width="1280" height="720" fill="${bg}"/><g data-role="layout">${hud}${body}</g>${copy}<g>${grain}${brand}</g></svg>`;
  }
  function subtitlePosition(lastLine, typography, fontFamily, titleSize, subtitleSize, gapScale, subtitleTypography = typography) {
    // Reducir el hueco visible, sin reducir la distancia entre centros de las letras.
    if (typeof document !== "undefined" && document.body) {
      const namespace = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(namespace, "svg");
      svg.style.cssText = "position:fixed;left:-10000px;top:-10000px;visibility:hidden;pointer-events:none";
      const text = (content, font, size, y, style = typography) => {
        const node = document.createElementNS(namespace, "text");
        for (const [key, value] of Object.entries({"font-family":font,"font-size":size,"font-weight":style.weight,"font-style":style.slant,"dominant-baseline":"central",x:0,y})) node.setAttribute(key, String(value));
        node.textContent = content;
        svg.appendChild(node);
        return node;
      };
      const title = text(lastLine, typography.display, titleSize, 0);
      const oldSubtitle = text("LETRA", fontFamily, titleSize * .3, titleSize * .88);
      const newSubtitle = text("LETRAS", fontFamily, subtitleSize, 0, subtitleTypography);
      document.body.appendChild(svg);
      try {
        const inkBounds = node => {
          const box = node.getBBox();
          context = context || document.createElement("canvas").getContext("2d");
          if (!context) return {top: box.y, bottom: box.y + box.height};
          context.font = `${node.getAttribute("font-style")} ${node.getAttribute("font-weight")} ${node.getAttribute("font-size")}px "${node.getAttribute("font-family")}"`;
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
  function breakingMarks(text) {
    // Igual que el video (kit.js): tramo central de la palabra más larga en contorno.
    const out = [...text].map(ch => ({ch, o: false}));
    const words = text.split(" ");
    let best = 0, bestOff = 0, off = 0;
    words.forEach((w, i) => { if (w.length > words[best].length) { best = i; bestOff = off; } off += w.length + 1; });
    const n = words[best].length;
    if (n >= 4) { const a = bestOff + Math.floor(n * .3), b = a + Math.max(1, Math.round(n * .28)); for (let i = a; i < b && i < out.length; i++) out[i].o = true; }
    const runs = [];
    for (const c of out) { const last = runs[runs.length - 1]; if (last && last.o === c.o) last.t += c.ch; else runs.push({t: c.ch, o: c.o}); }
    return runs;
  }
  function breakingDecor(r, white) {
    let svg = "";
    for (let i = 0; i < 5; i++) {
      const x = 90 + r() * 1100, y = 70 + r() * 580, kind = r();
      svg += kind < .5 ? `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(45)" stroke="${white}" stroke-width="2.4"><line x1="-9" x2="9"/><line y1="-9" y2="9"/></g>`
        : `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="10" height="10" fill="none" stroke="${white}" stroke-width="2" transform="rotate(45 ${(x + 5).toFixed(1)} ${(y + 5).toFixed(1)})"/>`;
    }
    for (let i = 0; i < 2; i++) { const y = 150 + r() * 420, w = 380 + r() * 420, left = r() < .5; svg += `<rect x="${left ? 0 : 1280 - w}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="1.4" fill="${white}" opacity=".45"/>`; }
    return svg;
  }
  function renderBreakingSvg(selected, design, key, w, h, assets) {
    const {palette: p, typography: t, background: b} = design;
    const red = p.accent, ink = p.background, white = p.foreground, deep = p.deep;
    let title = String(selected.text || "Noticias").trim().slice(0, 200).split(/\s+/u).filter(Boolean).slice(0, Math.floor(design.maxWords)).join(" ") || "Noticias";
    if (t.transform !== "none") title = title.toLocaleUpperCase("es");
    const id = `nm-breaking-${key.toLowerCase()}`;
    const photo = b.kind === "solid" ? "" : safeData(assets?.backgroundData, "image");
    const font = `font-family="${escapeXml(t.display)}" font-weight="${t.weight}"`;
    const anchor = `${b.x < .34 ? "xMin" : b.x > .66 ? "xMax" : "xMid"}${b.y < .34 ? "YMin" : b.y > .66 ? "YMax" : "YMid"}`;
    const kicker = design.kicker.toLocaleUpperCase("es");
    const r = dynamicRandom(key === "A" ? 5101 : 6203);
    const typo = {...t, tracking: 0};
    const longest = title.split(" ").reduce((a, c) => c.length > a.length ? c : a, "");
    const chunk = longest.length <= 5 ? longest : longest.slice(Math.floor(longest.length * .25), Math.floor(longest.length * .25) + 4);
    // Grades del video: «mono» (duotono #060606→#EDEDED) y «red» (#240000→#FF4136).
    const defs = `<style>${fontCss(assets?.fonts)}</style>${trendyDuo(id, "mono", "#060606", "#EDEDED", 1.3)}${trendyDuo(id, "red", "#240000", "#FF4136", 1.35)}<radialGradient id="${id}-tint" cx="0" cy="0" r="1.15"><stop offset="0" stop-color="${red}" stop-opacity=".85"/><stop offset=".45" stop-color="${deep}" stop-opacity=".45"/><stop offset=".8" stop-color="${deep}" stop-opacity="0"/></radialGradient><radialGradient id="${id}-vig" cx=".5" cy=".5" r=".75"><stop offset=".4" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".6"/></radialGradient>`;
    const runs = (text, size, x, y, color, sw) => {
      const spans = breakingMarks(text).map(run => run.o ? `<tspan fill="none" stroke="${color}" stroke-width="${sw}" stroke-linejoin="round">${escapeXml(run.t)}</tspan>` : `<tspan fill="${color}">${escapeXml(run.t)}</tspan>`).join("");
      return `<text data-role="title" ${font} font-size="${size}" x="${x}" y="${y}" text-anchor="middle">${spans}</text>`;
    };
    let body, copy;
    if (key === "A") {
      // Escena intro / «word»: foto B/N, letras gigantes claras, titular con tramo en contorno, subrayado rojo y subtítulo espaciado.
      const image = photo ? `<image href="${photo}" width="1280" height="720" preserveAspectRatio="${anchor} slice" filter="url(#${id}-mono)"/>` : "";
      let gs = 900; const gw0 = measure(chunk, typo, gs); if (gw0 > 1500) gs *= 1500 / gw0;
      const giant = `<text ${font} font-size="${gs}" fill="${white}" opacity=".6" x="${640 - measure(chunk, typo, gs) / 2}" y="${360 + gs * .36}">${escapeXml(chunk)}</text>`;
      let size = 150; const tw0 = measure(title, typo, size); if (tw0 > 900) size *= 900 / tw0;
      const tw = measure(title, typo, size), y = 360 + size * .3;
      const kfs = Math.min(size * .26, 34), kls = kfs * .42, kw = measure(kicker, typo, kfs) + kls * Math.max(0, kicker.length - 1);
      copy = runs(title, size, 640, y, white, Math.max(2, size * .024)) + `<rect x="${640 - tw * .31}" y="${y + size * .14}" width="${tw * .62}" height="${Math.max(5, size * .055)}" fill="${red}"/>`
        + (kicker ? `<text ${font} font-size="${kfs}" letter-spacing="${kls}" fill="${white}" x="${640 - kw / 2}" y="${y + size * .14 + kfs * 1.9}">${escapeXml(kicker)}</text>` : "");
      body = `${image}${giant}<rect width="1280" height="720" fill="url(#${id}-vig)"/><rect width="1280" height="720" fill="url(#${id}-tint)" style="mix-blend-mode:hard-light"/>${breakingDecor(r, white)}`;
    } else {
      // Escena «repeat»: foto en rojo, filas espaciadas repetidas y el titular grande al centro sobre una banda negra.
      const image = photo ? `<image href="${photo}" width="1280" height="720" preserveAspectRatio="${anchor} slice" filter="url(#${id}-red)"/><rect width="1280" height="720" fill="${red}" opacity=".35" style="mix-blend-mode:multiply"/>` : `<rect width="1280" height="720" fill="${red}"/>`;
      const rowText = title, rfs0 = 62, rls = rfs0 * .28;
      let rfs = rfs0; const rw0 = measure(rowText, typo, rfs) + rls * (rowText.length - 1); if (rw0 > 1150) rfs *= 1150 / rw0;
      const rw = measure(rowText, typo, rfs) + rfs * .28 * (rowText.length - 1);
      let rows = "";
      for (const [i, y] of [[0, 92], [1, 182], [4, 590], [5, 680]]) {
        rows += `<text ${font} font-size="${rfs}" letter-spacing="${rfs * .28}" x="${640 - rw / 2 + (i % 2 ? 30 : -30)}" y="${y}" ${i % 2 ? `fill="none" stroke="${white}" stroke-width="1.6"` : `fill="${white}"`} opacity=".85">${escapeXml(rowText)}</text>`; }
      let size = 170; const tw0 = measure(title, typo, size); if (tw0 > 1100) size *= 1100 / tw0;
      const tw = measure(title, typo, size);
      copy = `<rect x="0" y="${360 - size * .62}" width="1280" height="${size * 1.18}" fill="${ink}" opacity=".88"/>` + runs(title, size, 640, 360 + size * .34, white, Math.max(2, size * .022))
        + `<rect x="${640 - tw * .31}" y="${360 + size * .46}" width="${tw * .62}" height="${Math.max(6, size * .05)}" fill="${white}"/>`
        + (kicker ? `<text ${font} font-size="22" letter-spacing="8" fill="${white}" x="640" y="${360 + size * .46 + 48}" text-anchor="middle">${escapeXml(kicker)}</text>` : "");
      body = `${image}${rows}<rect width="1280" height="720" fill="url(#${id}-vig)"/>`;
    }
    const brand = `<text data-role="brand" x="1236" y="696" text-anchor="end" ${font} font-size="13" letter-spacing="2" fill="${white}" opacity=".4">NODEMOTION</text>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 1280 720" role="img" aria-label="${escapeXml(title)}"><defs>${defs}</defs><rect width="1280" height="720" fill="${ink}"/><g data-role="layout">${body}</g>${copy}<g>${brand}</g></svg>`;
  }
  function renderPulseSvg(selected, design, key, w, h, assets) {
    const {palette: p, typography: t, background: b} = design;
    const green = p.accent, ink = p.background, cream = p.foreground;
    let title = String(selected.text || "Deporte").trim().slice(0, 200).split(/\s+/u).filter(Boolean).slice(0, Math.floor(design.maxWords)).join(" ") || "Deporte";
    if (t.transform !== "none") title = title.toLocaleUpperCase("es");
    const id = `nm-pulse-${key.toLowerCase()}`;
    const photo = b.kind === "solid" ? "" : safeData(assets?.backgroundData, "image");
    const font = `font-family="${escapeXml(t.display)}" font-weight="${t.weight}"`;
    const anchor = `${b.x < .34 ? "xMin" : b.x > .66 ? "xMax" : "xMid"}${b.y < .34 ? "YMin" : b.y > .66 ? "YMax" : "YMid"}`;
    const typo = {...t, tracking: 0};
    const kicker = design.kicker;
    const longest = title.split(" ").reduce((a, c) => c.length > a.length ? c : a, "");
    // Grade «cine» del video: saturación .7, contraste 1.12, brillo .86. Itálica sintética = sesgo de 10°.
    const k = 1.12 * .86, c0 = (-.06 * .86).toFixed(3);
    const defs = `<style>${fontCss(assets?.fonts)}</style><filter id="${id}-cine" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values=".7"/><feComponentTransfer><feFuncR type="linear" slope="${k}" intercept="${c0}"/><feFuncG type="linear" slope="${k}" intercept="${c0}"/><feFuncB type="linear" slope="${k}" intercept="${c0}"/></feComponentTransfer></filter><radialGradient id="${id}-vig" cx=".5" cy=".5" r=".75"><stop offset=".35" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".7"/></radialGradient><filter id="${id}-lift" color-interpolation-filters="sRGB"><feComponentTransfer><feFuncR type="linear" slope="1.9" intercept=".05"/><feFuncG type="linear" slope="1.9" intercept=".05"/><feFuncB type="linear" slope="1.9" intercept=".05"/></feComponentTransfer></filter><filter id="${id}-shadow" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="14" stdDeviation="22" flood-color="#000" flood-opacity=".6"/></filter>`;
    const skew = (x, y, svg) => `<g transform="translate(${x} ${y}) skewX(-10) translate(${-x} ${-y})">${svg}</g>`;
    let body, copy, extra = "";
    if (key === "A") {
      // Escena intro / «framed»: video enmarcado, palabra gigante en contorno verde detrás y titular crema encima.
      let gs = 640; const gw0 = measure(longest, typo, gs); if (gw0 > 1700) gs *= 1700 / gw0;
      const gw = measure(longest, typo, gs);
      const giant = skew(640, 360, `<text ${font} font-size="${gs}" fill="none" stroke="${green}" stroke-width="3" opacity=".9" x="${640 - gw / 2}" y="${360 + gs * .36}">${escapeXml(longest)}</text>`);
      const fr = {x: 250, y: 150, w: 780, h: 440};
      const media = photo ? `<svg x="${fr.x}" y="${fr.y}" width="${fr.w}" height="${fr.h}" viewBox="0 0 1280 720" preserveAspectRatio="xMidYMid slice"><image href="${photo}" width="1280" height="720" preserveAspectRatio="${anchor} slice" filter="url(#${id}-cine)"/></svg>` : `<rect x="${fr.x}" y="${fr.y}" width="${fr.w}" height="${fr.h}" fill="#1B1D1B"/>`;
      body = `${giant}<g filter="url(#${id}-shadow)">${media}</g><rect x="${fr.x + 18}" y="${fr.y + 18}" width="26" height="18" fill="${green}"/>`;
      let size = 230; const tw0 = measure(title, typo, size); if (tw0 > 700) size *= 700 / tw0;
      const tw = measure(title, typo, size);
      copy = skew(640, 360, `<text data-role="title" ${font} font-size="${size}" fill="${cream}" x="${640 - tw / 2}" y="${360 + size * .36}">${escapeXml(title)}</text>`);
      if (kicker) extra = `<text ${font} font-size="26" letter-spacing="1" fill="${cream}" x="${fr.x + 28}" y="${fr.y + fr.h - 26}">${escapeXml(kicker)}</text>`;
    } else {
      // Escena «knockout»: la foto se ve dentro de la palabra, con el fondo oscuro de la misma toma, medidor verde y frase.
      let size = 400; const tw0 = measure(longest, typo, size); if (tw0 > 1150) size *= 1150 / tw0;
      const tw = measure(longest, typo, size), y = 360 + size * .36;
      const clip = `<clipPath id="${id}-clip"><text ${font} font-size="${size}" x="${640 - tw / 2}" y="${y}" transform="translate(640 360) skewX(-10) translate(-640 -360)">${escapeXml(longest)}</text></clipPath>`;
      const image = photo ? `<image href="${photo}" width="1280" height="720" preserveAspectRatio="${anchor} slice" filter="url(#${id}-cine)"/>` : `<rect width="1280" height="720" fill="#3A3D38"/>`;
      body = `<defs>${clip}</defs>${photo ? image : ""}<rect width="1280" height="720" fill="#000" opacity=".66"/><g clip-path="url(#${id}-clip)"><g filter="url(#${id}-lift)">${image}</g><rect width="1280" height="720" fill="${cream}" opacity="${photo ? .16 : .9}"/></g><text ${font} font-size="${size}" x="${640 - tw / 2}" y="${y}" transform="translate(640 360) skewX(-10) translate(-640 -360)" fill="none" stroke="${cream}" stroke-width="2.5">${escapeXml(longest)}</text>`;
      const mx = 640 - tw * .25, my = y + 30;
      let meter = ""; for (let i = 0; i < 10; i++) meter += `<rect x="${mx + i * (tw * .5 / 10)}" y="${my}" width="${tw * .5 / 10 - 4}" height="7" fill="${green}"/>`;
      copy = `<g data-role="title">${meter}</g>`;
      if (kicker) extra = `<text ${font} font-size="30" letter-spacing="1" fill="${cream}" x="640" y="${my + 46}" text-anchor="middle">${escapeXml(kicker)}</text>`;
      if (title !== longest) extra += skew(640, 110, `<text ${font} font-size="64" fill="${cream}" x="640" y="130" text-anchor="middle">${escapeXml(title)}</text>`);
    }
    const corner = design.vertical ? `<text ${font} font-size="15" letter-spacing="2" fill="${cream}" x="1240" y="40" text-anchor="end">${escapeXml(design.vertical.toLocaleUpperCase("es"))}</text>` : "";
    const brand = `<text data-role="brand" x="1236" y="696" text-anchor="end" ${font} font-size="14" letter-spacing="2" fill="${cream}" opacity=".4">NODEMOTION</text>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 1280 720" role="img" aria-label="${escapeXml(title)}"><defs>${defs}</defs><rect width="1280" height="720" fill="${ink}"/><g data-role="layout">${body}</g>${copy}<g>${extra}<rect width="1280" height="720" fill="url(#${id}-vig)" opacity=".7"/>${corner}${brand}</g></svg>`;
  }
  function rasgadoTear(r, x0, x1, y, amp, steps) {
    // Borde rasgado: puntos irregulares con algún diente más profundo (igual que kit.tearPath del video).
    const pts = [];
    for (let i = 0; i <= steps; i++) pts.push([x0 + (x1 - x0) * i / steps, y + amp * (.25 + r() * .75) + (r() < .12 ? amp * .6 : 0)]);
    return pts;
  }
  function rasgadoBand(r, top, y, h, color, ampF = .3) {
    // Franja de papel con reborde de fibra blanca: top=true cuelga desde arriba, top=false sube desde abajo.
    const edge = rasgadoTear(r, -20, 1300, 0, h * ampF, 60);
    const path = off => top ? `M-20 ${y - 2} L1300 ${y - 2} ${edge.slice().reverse().map(([x, e]) => `L${x.toFixed(1)} ${(y + h - e + off).toFixed(1)}`).join(" ")} Z`
      : `M-20 ${y + h + 2} ${edge.map(([x, e]) => `L${x.toFixed(1)} ${(y + e - off).toFixed(1)}`).join(" ")} L1300 ${y + h + 2} Z`;
    return `<path d="${path(4)}" fill="#F4F2EC"/><path d="${path(0)}" fill="${color}"/>`;
  }
  function rasgadoDoodle(kind, x, y, s, color) {
    const p = kind === "x" ? `M${x - s} ${y - s}L${x + s} ${y + s}M${x + s} ${y - s}L${x - s} ${y + s}` : `M${x - s} ${y + s * .7}L${x} ${y - s}L${x + s} ${y + s * .6}Z`;
    return `<path d="${p}" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" filter="url(#rs-marker)"/>`;
  }
  function renderRasgadoSvg(selected, design, key, w, h, assets) {
    const {palette: p, typography: t, background: b} = design;
    const lime = p.accent, ink = p.foreground, paper = p.background;
    let title = String(selected.text || "Música").trim().slice(0, 200);
    if (key === "A") title = title.split(/\s+/u).slice(0, 5).join(" ");
    title = title.toLocaleUpperCase("es");
    const photo = b.kind === "solid" ? "" : safeData(assets?.backgroundData, "image");
    const font = `font-family="${escapeXml(t.display)}" font-weight="${t.weight}"`;
    const typo = {...t, tracking: 0};
    const anchor = `${b.x < .34 ? "xMin" : b.x > .66 ? "xMax" : "xMid"}${b.y < .34 ? "YMin" : b.y > .66 ? "YMax" : "YMid"}`;
    const r = dynamicRandom(key === "A" ? 3301 : 4409);
    const defs = `<style>${fontCss(assets?.fonts)}</style><filter id="rs-marker"><feTurbulence type="fractalNoise" baseFrequency=".7" numOctaves="1" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="3"/></filter><filter id="rs-brush" x="-5%" y="-30%" width="110%" height="160%"><feTurbulence type="fractalNoise" baseFrequency=".04 .9" numOctaves="2" seed="9" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="18"/></filter><filter id="rs-fiber" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7"/><feColorMatrix type="saturate" values="0"/></filter>${trendyDuo("rs", "mono", "#141414", "#EDEDED", 1.3)}`;
    // Reparte en renglones equilibrados y ajusta el tamaño al ancho disponible.
    const fitLines = (text, maxW, maxH, maxLines) => {
      const words = text.split(" "), best = {lines: [text], size: 1};
      for (let n = 1; n <= Math.min(maxLines, words.length); n++) {
        const lines = []; let acc = [], total = text.length;
        for (const wd of words) { acc.push(wd); if (acc.join(" ").length >= total / n && lines.length < n - 1) { lines.push(acc.join(" ")); acc = []; } }
        if (acc.length) lines.push(acc.join(" "));
        const size = Math.min(maxH / lines.length / .95, ...lines.map(l => maxW / Math.max(1, measure(l, typo, 100)) * 100));
        if (size > best.size) Object.assign(best, {lines, size});
      }
      return best;
    };
    let body, copy;
    if (key === "A") {
      // Escena «giant»/«build»: hoja gris con jirones lima y carbón, título condensado enorme e inclinado y LETRAS en pincelada lima.
      const f = fitLines(title, 1000, 470, 2);
      const lh = f.size * .95, top = 330 - (f.lines.length - 1) * lh / 2;
      const lines = f.lines.map((l, i) => `<text ${font} font-size="${f.size.toFixed(1)}" fill="${ink}" x="640" y="${(top + i * lh + f.size * .36).toFixed(1)}" text-anchor="middle">${escapeXml(l)}</text>`).join("");
      copy = `<g data-role="title" transform="rotate(-3 640 330) skewX(2)">${lines}</g>`;
      const ly = top + (f.lines.length - 1) * lh + f.size * .62 + 26;
      copy += `<rect x="520" y="${ly - 30}" width="240" height="58" fill="${lime}" filter="url(#rs-brush)"/><text data-role="subtitle" ${font} font-size="44" letter-spacing="6" fill="${ink}" x="640" y="${ly + 14}" text-anchor="middle">LETRAS</text>`;
      body = `<rect width="1280" height="720" fill="${paper}"/><rect width="1280" height="720" filter="url(#rs-fiber)" opacity=".12" style="mix-blend-mode:multiply"/>${rasgadoBand(r, true, -10, 120, lime)}${rasgadoBand(r, false, 610, 120, ink)}${rasgadoDoodle("x", 130, 190, 24, lime)}${rasgadoDoodle("tri", 1150, 520, 22, ink)}`;
    } else {
      // Escena con fondo «media»: foto B/N con acento lima, tira de papel rasgado inclinada con la frase y LETRAS en lima.
      const image = photo ? `<image href="${photo}" width="1280" height="720" preserveAspectRatio="${anchor} slice" filter="url(#rs-mono)"/><radialGradient id="rs-lime" cx=".3" cy=".35" r=".6"><stop offset="0" stop-color="${lime}" stop-opacity=".9"/><stop offset="1" stop-color="${lime}" stop-opacity="0"/></radialGradient><rect width="1280" height="720" fill="url(#rs-lime)" style="mix-blend-mode:color"/><rect width="1280" height="720" fill="#000" opacity=".35"/>` : "";
      const f = fitLines(title, 1000, 250, 3);
      const lh = f.size * 1.02, sh = f.lines.length * lh + 90, sy = 360 - sh / 2;
      const lines = f.lines.map((l, i) => `<text ${font} font-size="${f.size.toFixed(1)}" fill="${ink}" x="640" y="${(sy + 50 + i * lh + f.size * .78).toFixed(1)}" text-anchor="middle">${escapeXml(l)}</text>`).join("");
      copy = `<g data-role="title" transform="rotate(-4 640 360)">${rasgadoBand(r, false, sy, sh, paper, .1)}${lines}</g><text data-role="subtitle" ${font} font-size="34" letter-spacing="10" fill="${lime}" x="640" y="${Math.min(690, sy + sh + 70)}" text-anchor="middle">LETRAS</text>`;
      body = `<rect width="1280" height="720" fill="${ink}"/>${image}${rasgadoBand(r, true, -10, 110, lime)}${rasgadoDoodle("x", 1140, 170, 26, lime)}${rasgadoDoodle("tri", 150, 580, 22, lime)}`;
    }
    const brand = `<text data-role="brand" x="1236" y="700" text-anchor="end" font-family="Arial, sans-serif" font-size="14" font-weight="900" letter-spacing="2" fill="${key === "A" ? paper : ink}" opacity=".5">NODEMOTION</text>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 1280 720" role="img" aria-label="${escapeXml(title)}"><defs>${defs}</defs><g data-role="layout">${body}</g>${copy}${brand}</svg>`;
  }
  function hologramGradient(id, stops, angle) {
    // Degradado iridiscente (lila, cian, rosa, azul) equivalente al relleno holográfico del video.
    const s = stops.map((c, i) => `<stop offset="${(i / (stops.length - 1)).toFixed(3)}" stop-color="${c}"/>`).join("");
    return `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1" gradientTransform="rotate(${angle} .5 .5)">${s}</linearGradient>`;
  }
  function hologramDiamonds(cx, cy, n, size, fill) {
    let out = "";
    for (let i = 0; i < n; i++) {
      const x = cx + (i - (n - 1) / 2) * size * 1.9, a = size * .62;
      out += `<path d="M${x} ${cy - size}L${x + a} ${cy - size * .2}L${x} ${cy + size * .55}L${x - a} ${cy - size * .2}Z" fill="${fill}"/>`;
    }
    return out;
  }
  function renderHologramSvg(selected, design, key, w, h, assets) {
    const {palette: p, typography: t, background: b} = design;
    const dark = p.background, white = p.foreground, lilac = p.accent;
    const holo = [lilac, "#9EEFF4", "#F4C2EF", "#7F8CFF", "#EAFBFF", lilac];
    let title = String(selected.text || "Música").trim().slice(0, 200);
    if (key === "A") title = title.split(/\s+/u).slice(0, 5).join(" ");
    title = title.toLocaleUpperCase("es");
    const subtitle = String(design.subtitle || "").trim().toLocaleUpperCase("es");
    const photo = b.kind === "solid" ? "" : safeData(assets?.backgroundData, "image");
    const font = `font-family="${escapeXml(t.display)}" font-weight="${t.weight}"`;
    const typo = {...t, tracking: 0};
    const anchor = `${b.x < .34 ? "xMin" : b.x > .66 ? "xMax" : "xMid"}${b.y < .34 ? "YMin" : b.y > .66 ? "YMax" : "YMid"}`;
    const defs = `<style>${fontCss(assets?.fonts)}</style>${hologramGradient("hg-a", holo, 25)}${hologramGradient("hg-b", holo.slice().reverse(), -20)}<radialGradient id="hg-vig" cx=".5" cy=".42" r=".75"><stop offset="0" stop-color="#17162A"/><stop offset="1" stop-color="${dark}"/></radialGradient><filter id="hg-glow" x="-10%" y="-20%" width="120%" height="140%"><feGaussianBlur stdDeviation="7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>${trendyDuo("hg", "holo", "#0B0A14", "#D6C8FF", 1.25)}`;
    // Reparte en renglones equilibrados y ajusta el tamaño al ancho disponible.
    const fitLines = (text, maxW, maxH, maxLines) => {
      const words = text.split(" "), best = {lines: [text], size: 1};
      for (let n = 1; n <= Math.min(maxLines, words.length); n++) {
        const lines = []; let acc = [];
        for (const wd of words) { acc.push(wd); if (acc.join(" ").length >= text.length / n && lines.length < n - 1) { lines.push(acc.join(" ")); acc = []; } }
        if (acc.length) lines.push(acc.join(" "));
        const size = Math.min(maxH / lines.length / .9, ...lines.map(l => maxW / Math.max(1, measure(l, typo, 100)) * 100));
        if (size > best.size) Object.assign(best, {lines, size});
      }
      return best;
    };
    const labels = ["xMin", "xMid", "xMax"].map((_, i) => [70 + i * 570, i === 0 ? "start" : i === 1 ? "middle" : "end"]).map(([x, a]) =>
      [42, 690].map(y => `<text ${font} font-size="13" letter-spacing="2" fill="${white}" opacity=".6" x="${x}" y="${y}" text-anchor="${a}">${escapeXml(title.split(" ").slice(0, 3).join(" ").slice(0, 28))}</text>`).join("")).join("");
    let body, copy;
    if (key === "A") {
      // Escena «holoWord»: casi negro, título condensado enorme con relleno holográfico, ecos en contorno arriba y abajo y fila de rombos.
      const f = fitLines(title, 1080, 400, 2);
      const lh = f.size * .9, top = 360 - (f.lines.length - 1) * lh / 2;
      const row = (l, y, extra) => `<text ${font} font-size="${f.size.toFixed(1)}" x="640" y="${(y + f.size * .36).toFixed(1)}" text-anchor="middle" ${extra}>${escapeXml(l)}</text>`;
      const echo = [-1, 1].map(s => row(s < 0 ? f.lines[0] : f.lines[f.lines.length - 1], s < 0 ? top - lh : top + (f.lines.length - 1) * lh + lh, `fill="none" stroke="${white}" stroke-width="1.6" opacity=".28"`)).join("");
      copy = `<g data-role="title">${echo}<g filter="url(#hg-glow)">${f.lines.map((l, i) => row(l, top + i * lh, `fill="url(#hg-a)"`)).join("")}</g></g>`;
      const sy = top + (f.lines.length - 1) * lh + f.size * .62 + 34;
      if (subtitle) copy += `<text data-role="subtitle" ${font} font-size="30" letter-spacing="12" fill="${white}" x="640" y="${Math.min(650, sy)}" text-anchor="middle">${escapeXml(subtitle)}</text>`;
      body = `<rect width="1280" height="720" fill="url(#hg-vig)"/><rect x="90" y="86" width="1100" height="548" fill="none" stroke="${white}" stroke-opacity=".09" stroke-width="1.5"/>${hologramDiamonds(640, Math.max(70, top - f.size * .62 - 20), 4, 11, lilac)}${labels}`;
    } else {
      // Escena «panel»: fotograma en duotono holográfico a la derecha con marco iridiscente; frase condensada blanca a la izquierda, última palabra holográfica y barra.
      const image = photo ? `<clipPath id="hg-win"><rect x="610" y="96" width="600" height="440"/></clipPath><rect x="604" y="90" width="612" height="452" fill="url(#hg-b)"/><g clip-path="url(#hg-win)"><image href="${photo}" x="610" y="96" width="600" height="440" preserveAspectRatio="${anchor} slice" filter="url(#hg-holo)"/><rect x="610" y="96" width="600" height="440" fill="url(#hg-a)" opacity=".35" style="mix-blend-mode:soft-light"/></g>` : `<rect x="604" y="90" width="612" height="452" fill="url(#hg-b)"/>`;
      const f = fitLines(title, 500, 330, 3);
      const lh = f.size * .94, y0 = 470 - (f.lines.length - 1) * lh;
      const lines = f.lines.map((l, i) => {
        const last = i === f.lines.length - 1, words = l.split(" ");
        const head = last && words.length > 1 ? words.slice(0, -1).join(" ") + " " : last ? "" : l;
        const tail = last ? words[words.length - 1] : "";
        return `<text ${font} font-size="${f.size.toFixed(1)}" x="70" y="${(y0 + i * lh + f.size * .36).toFixed(1)}"><tspan fill="${white}">${escapeXml(head)}</tspan><tspan fill="url(#hg-a)">${escapeXml(tail)}</tspan></text>`;
      }).join("");
      const by = y0 + (f.lines.length - 1) * lh + f.size * .5 + 18;
      copy = `<g data-role="title">${lines}<rect x="72" y="${by.toFixed(1)}" width="${Math.min(500, Math.max(...f.lines.map(l => measure(l, typo, f.size)))).toFixed(1)}" height="9" fill="url(#hg-a)"/></g>`;
      if (subtitle) copy += `<text data-role="subtitle" ${font} font-size="26" letter-spacing="10" fill="${white}" opacity=".85" x="72" y="${Math.min(690, by + 52).toFixed(1)}">${escapeXml(subtitle)}</text>`;
      body = `<rect width="1280" height="720" fill="url(#hg-vig)"/>${image}${hologramDiamonds(120, Math.max(60, y0 - f.size * .6 - 26), 3, 10, "#9EEFF4")}${labels}`;
    }
    const brand = `<text data-role="brand" x="1236" y="712" text-anchor="end" font-family="Arial, sans-serif" font-size="13" font-weight="900" letter-spacing="2" fill="${white}" opacity=".45">NODEMOTION</text>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 1280 720" role="img" aria-label="${escapeXml(title)}"><defs>${defs}</defs><g data-role="layout">${body}</g>${copy}${brand}</svg>`;
  }
  function renderSvg(manifest, option, width, height, assets) {
    const w = Math.round(number(width, 1280, 320, 1920));
    const h = Math.round(number(height, 720, 180, 1920));
    const key = option === "B" ? "B" : "A";
    const selected = manifest?.options?.[key] || {};
    const design = safeDesign(selected.design);
    if (design.style === "promo-editorial") return renderEditorialSvg(selected, design, key, w, h, assets);
    if (design.style === "promo-dynamic") return renderDynamicSvg(selected, design, key, w, h, assets);
    if (design.style === "promo-trendy") return renderTrendySvg(selected, design, key, w, h, assets);
    if (design.style === "promo-urban") return renderUrbanSvg(selected, design, key, w, h, assets);
    if (design.style === "promo-sports") return renderSportsSvg(selected, design, key, w, h, assets);
    if (design.style === "promo-kinetic") return renderKineticSvg(selected, design, key, w, h, assets);
    if (design.style === "promo-breaking") return renderBreakingSvg(selected, design, key, w, h, assets);
    if (design.style === "promo-pulse") return renderPulseSvg(selected, design, key, w, h, assets);
    if (design.style === "lyrics-rasgado") return renderRasgadoSvg(selected, design, key, w, h, assets);
    if (design.style === "lyrics-hologram") return renderHologramSvg(selected, design, key, w, h, assets);
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
    // A 16:9 source otherwise exactly fills the canvas and has no horizontal travel.
    // Keep the original full image at center; zoom only when left/right is requested.
    const zoom = b.x === .5 ? 1 : 1.2;
    const imageX = (1280 - 1280 * zoom) * b.x;
    const imageY = (720 - 720 * zoom) * b.y;
    const image = backgroundData ? `<image href="${backgroundData}" x="${imageX}" y="${imageY}" width="${1280 * zoom}" height="${720 * zoom}" preserveAspectRatio="${anchor} slice" /><rect width="1280" height="720" fill="url(#${id}-vignette)"/>` : "";
    const neon = design.style === "neon";
    const defs = `<filter id="${id}-shadow" x="-20%" y="-40%" width="140%" height="180%"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity=".75"/></filter><pattern id="${id}-stripes" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(-12)"><rect width="8" height="3.5" fill="${p.foreground}"/></pattern><style>${fontCss(assets?.fonts)}</style><radialGradient id="${id}-vignette"><stop offset=".1" stop-color="#000000" stop-opacity="${b.overlay}"/><stop offset="1" stop-color="#000000" stop-opacity="${b.overlay}"/></radialGradient>${neon ? `<filter id="${id}-glow" x="-100%" y="-200%" width="300%" height="500%"><feDropShadow dx="0" dy="0" stdDeviation="${Math.max(2, fitted.size * .05)}" flood-color="${p.foreground}"/><feDropShadow dx="0" dy="0" stdDeviation="${fitted.size * .16}" flood-color="${p.accent}"/><feDropShadow dx="0" dy="0" stdDeviation="${fitted.size * .4}" flood-color="${p.deep}"/></filter>` : ""}`;
    const type = `font-family="${escapeXml(t.display)}" font-weight="${t.weight}" font-style="${t.slant}" letter-spacing="${t.tracking}" text-anchor="middle" dominant-baseline="central"`;
    const spans = fitted.lines.map((line, i) => {
      const last = i === fitted.lines.length - 1;
      const treatment = design.rowTreatments.length ? design.rowTreatments[Math.min(i, design.rowTreatments.length - 1)] : neon ? (last ? "striped" : "outline") : "solid";
      const outline = treatment === "outline";
      const font = outline ? t.outlineDisplay : t.display;
      const ink = outline ? `fill="none" stroke="${p.foreground}" stroke-width="${Math.max(1.4, fitted.size * (neon ? .045 : design.outlineWidth))}" stroke-linejoin="round"` : treatment === "striped" && !(neon && key === "A") ? `fill="url(#${id}-stripes)" stroke="${p.foreground}" stroke-width=".55"` : `fill="${p.foreground}"`;
      return `<tspan data-treatment="${treatment}" font-family="${escapeXml(font)}" ${ink} x="640" y="${start + i * lineHeight}">${escapeXml(line)}</tspan>`;
    }).join("");
    const copy = `<text ${type} font-size="${fitted.size}" filter="url(#${id}-${neon ? "glow" : "shadow"})">${spans}</text>`;
    const lastLine = fitted.lines[fitted.lines.length - 1];
    const subtitleX = Math.min(1185, 640 + measure(lastLine, t, fitted.size) / 2);
    const subtitleSize = fitted.size * (key === "A" ? (neon ? .2187 : .243) : .345);
    const subtitleFont = t.subtitleDisplay;
    const subtitleTypography = {...t, weight:t.subtitleWeight, slant:t.subtitleSlant};
    const subtitleLayout = subtitlePosition(lastLine, t, subtitleFont, fitted.size, subtitleSize, key === "A" ? .9 : 1, subtitleTypography);
    const subtitleShift = neon && key === "B" ? subtitleSize * .1 : 0;
    const subtitleY = start + (fitted.lines.length - 1) * lineHeight + subtitleLayout.offset + subtitleShift;
    const sub = `<text data-role="subtitle" data-gap="${subtitleLayout.gap + subtitleShift}" font-family="${escapeXml(subtitleFont)}" font-weight="${t.subtitleWeight}" font-style="${t.subtitleSlant}" stroke="${p.subtitle}" stroke-width=".22" paint-order="stroke" text-anchor="end" dominant-baseline="central" x="${subtitleX}" y="${subtitleY}" font-size="${subtitleSize}" fill="${p.subtitle}">LETRAS</text>`;
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
      const query = new URLSearchParams({kind: b.kind, source: b.mediaSource, time: String(b.kind === "frame" ? b.time : 0), asset: b.asset, v: b.kind === "image" ? b.asset : b.mediaVersion});
      const background = manifest?.draftId && /^[a-z\d-]{1,80}$/i.test(manifest.draftId) && b.kind !== "solid"
        ? `/api/v1/drafts/${manifest.draftId}/thumbnail-background?${query}` : null;
      const fonts = [design.typography.font, design.typography.outlineFont, design.typography.subtitleFont].filter(Boolean);
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
  return { version: 22, renderSvg, renderSvgAsync, escapeXml, safeColor, safeDesign, wrapText, fitTitle };
});
