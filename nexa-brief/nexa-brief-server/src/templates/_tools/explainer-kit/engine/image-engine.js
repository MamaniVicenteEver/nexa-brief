/* =============================================================================
   Motor de imágenes estáticas (posts por perfil y cuadros de Reel)
   -----------------------------------------------------------------------------
   Separación de responsabilidades (para cambiar una cosa sin tocar las demás):
     · QUÉ se dice y en qué orden  → estrategias Python (src/core/image_posts/strategies/)
                                      dejan en cada lámina layout = "<estrategia>:<receta>"
     · DÓNDE va cada bloque         → LAYOUTS: recetas (bloques de la columna, foto, banda inferior)
     · CÓMO se dibuja cada bloque   → BLOCKS: una función por bloque
     · TAMAÑOS                      → TYPE: escala modular 1,25 sobre 40 px (ver
                                      docs/investigaciones/principios-diseno-imagenes-2026-10.md §2)
     · ESTILO de la categoría       → piel del diseño (designs/<d>/image-components.js +
                                      engine/image-skins.css) + StyleSystem (paleta, fuentes, marca)
   Regla de la investigación: nunca achicar texto por debajo de su mínimo; si no entra, el QC
   falla con el nombre del bloque y se edita el copy (no la tipografía).
   Depurar: IMAGE_QC_DEBUG_DIR guarda la captura de la lámina que falló.
============================================================================= */
(function () {
  // Recetas. blocks: columna principal de arriba abajo ("?" = opcional, se omite sin contenido).
  // photo: "full" (a sangre con velo), "top" (arriba), "side" (columna derecha) o nada.
  // band: bloques de la banda inferior sólida (crédito de foto, fuente, @cuenta).
  const LAYOUTS = {
    hero:       {blocks: ["topbar", "spacer", "stat", "headline", "body?", "spacer", "footer"]},
    hero_text:  {blocks: ["topbar", "spacer", "headline_xl", "body?", "spacer", "footer"]},
    am_visual:  {blocks: ["topbar", "spacer", "headline?", "diagram", "body?", "label?", "spacer", "footer"]},
    am_photo:   {blocks: ["topbar", "spacer", "stat?", "headline?", "diagram?", "body?", "label?", "swipebar"], photo: "full", band: ["credits"]},
    am_reflexion_photo: {blocks: ["topbar", "spacer", "body", "spacer", "swipebar"], photo: "full", band: ["credits"]},
    am_reflexion_visual: {blocks: ["topbar", "spacer", "body", "diagram", "spacer", "footer"]},
    am_close:   {blocks: ["brandmark", "spacer", "question", "spacer", "cta", "footer"]},
    cover:      {blocks: ["topbar", "spacer", "headline_xl", "tagline?", "spacer", "swipebar"]},
    point:      {blocks: ["stepbar", "spacer", "stat?", "headline", "body?", "spacer", "footer"]},
    close:      {blocks: ["topbar", "spacer", "recap", "spacer", "cta", "footer"]},
    photo_full: {blocks: ["topbar", "spacer", "headline", "body?", "spacer"], photo: "full", band: ["credits"]},
    photo_top:  {blocks: ["topbar", "headline", "body?", "spacer"], photo: "top", band: ["credits"]},
    photo_side: {blocks: ["topbar", "spacer", "headline", "body?", "spacer"], photo: "side", band: ["credits"]},
  };
  const FALLBACK_LAYOUT = "hero";

  // px a 1080 de ancho. min = suelo legible a 360 px (no se baja de ahí). maxH = alto máximo del bloque.
  const TYPE = {
    stat:        {size: 240, min: 180, maxH: 270},
    headline:    {size: 78,  min: 62,  maxH: 290},
    headline_xl: {size: 98,  min: 78,  maxH: 460},
    body:        {size: 48,  min: 42,  maxH: 210},
    recap:       {size: 50,  min: 42,  maxH: 560},
  };
  const UPPERCASE_MAX = 20;   // versales solo en etiquetas cortas (§2)

  const make = (tag, className, value) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined && value !== null) node.textContent = value;
    return node;
  };
  const textOf = (slide, role) => slide.texts.find(item => item.role === role)?.value || "";
  const fit = (node, key, scale) => {
    const type = TYPE[key];
    node.classList.add("fit-text");
    node.style.fontSize = Math.round(type.size * scale) + "px";
    node.style.maxHeight = Math.round(type.maxH * scale) + "px";
    node.dataset.minSize = String(Math.round(type.min * scale));
    return node;
  };
  const label = (className, value) => {
    const node = make("div", className, value);
    if (value.length > UPPERCASE_MAX) node.classList.add("is-long");
    return node;
  };
  const dots = (slide, ctx) => {
    const row = make("div", "ie-dots");
    const total = ctx.plan.slides.length;
    if (total < 2) return row;
    for (let i = 1; i <= total; i += 1) row.appendChild(make("i", i === slide.order ? "on" : ""));
    return row;
  };

  const questionText = (node, value, slide) => {
    if (slide.layout.startsWith("amarillista:am_negro_") && /[A-ZÁÉÍÓÚÑ]{3,}/.test(value)) {
      const match = value.match(/[A-ZÁÉÍÓÚÑ]{3,}/);
      node.append(document.createTextNode(value.slice(0, match.index)), make("span", "ie-mark", match[0]),
                  document.createTextNode(value.slice(match.index + match[0].length)));
    } else node.textContent = value;
  };

  // Cada bloque devuelve un nodo o null (null = no hay contenido: no ocupa lugar).
  const BLOCKS = {
    brandmark(slide, ctx) {
      return make("div", "ie-brandmark", ctx.brand);
    },
    question(slide, ctx) {
      const value = textOf(slide, "question");
      if (!value) return null;
      const node = make("div", "ie-headline");
      questionText(node, value, slide);
      fit(node, "headline", ctx.scale);
      // El cierre narrativo incluye también la invitación a comentar.
      // Conserva la tipografía y su mínimo; permite ajustar el texto más largo.
      if (slide.layout.startsWith("amarillista:") && value.split(/\s+/).length > 8) {
        node.style.maxHeight = Math.round(540 * ctx.scale) + "px";
      }
      if (recipeFor(slide).name === "am_close") {
        node.classList.add("ie-closing-panel");
        // Final slide only: a smaller box makes the fitted question ~10% smaller.
        node.style.maxHeight = Math.round(600 * ctx.scale) + "px";
        node.style.fontSize = Math.round(TYPE.headline.size * 0.9 * ctx.scale) + "px";
        node.dataset.minSize = String(Math.round(TYPE.headline.min * 0.8 * ctx.scale));
        // Layout only: keep editorial wording intact and give the comment prompt its own paragraph.
        const paragraphs = value.split(/(?:\r?\n){2,}|\s+(?=Comenta\b)/iu).filter(part => part.trim());
        node.replaceChildren(...paragraphs.map(value => {
          const paragraph = make("p", "ie-closing-paragraph");
          questionText(paragraph, value.trim(), slide);
          return paragraph;
        }));
      }
      return node;
    },
    topbar(slide, ctx) {
      // Los roles editoriales quedan en el plan para los tags de la app, fuera del JPG.
      const kicker = slide.layout.startsWith("amarillista:") ? "" : textOf(slide, "kicker");
      if (!kicker && !ctx.brand) return null;
      const bar = make("div", "ie-row ie-topbar");
      if (kicker) bar.appendChild(label("ie-kicker", kicker));
      else bar.style.justifyContent = "flex-end";
      if (ctx.brand) bar.appendChild(make("div", "ie-brand", ctx.brand));
      return bar;
    },
    stepbar(slide, ctx) {
      const bar = make("div", "ie-row ie-stepbar");
      bar.appendChild(make("div", "ie-step", textOf(slide, "step")));
      bar.appendChild(dots(slide, ctx));
      return bar;
    },
    stat(slide, ctx) {
      const value = textOf(slide, "stat");
      if (!value) return null;
      const node = fit(make("div", "ie-stat"), "stat", ctx.scale);
      // Número grande + unidad de texto más chica ("37 segundos"): si no, la cifra no entra a ≥180 px (§2).
      const match = value.match(/^([−-]?[\d.,]+)\s+([^\d%]+)$/);
      if (match) {
        node.appendChild(make("span", "ie-stat-number", match[1]));
        node.appendChild(make("span", "ie-stat-unit", match[2]));
      } else {
        node.textContent = value;
      }
      return node;
    },
    headline(slide, ctx) {
      const value = textOf(slide, "headline");
      if (!value) return null;
      const node = make("div", "ie-headline");
      if (/^amarillista:am_(negro|alto)_/.test(slide.layout)) {
        const words = [...value.matchAll(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{5,}/g)];
        const match = words.find(m => m[0] === m[0].toLocaleUpperCase("es")) || words.find(m => /^(melaza|excesivo|organizaciones|celular|recortó|riesgo|tiempo)$/i.test(m[0])) || words.find(m => !/^(alerta|atención|estadounidenses|adultos|reportó|reportan)$/i.test(m[0])) || words[0];
        if (match) node.append(document.createTextNode(value.slice(0, match.index)), make("span", "ie-mark", match[0]), document.createTextNode(value.slice(match.index + match[0].length)));
        else node.textContent = value;
      } else node.textContent = value;
      if (slide.layout.startsWith("amarillista:")) {
        node.dataset.minSize = String(Math.round(72 * ctx.scale));
        node.style.fontSize = Math.round(100 * ctx.scale) + "px";
        node.style.maxHeight = Math.round(400 * ctx.scale) + "px";
        node.classList.add("fit-text");
        return node;
      }
      return fit(node, "headline", ctx.scale);
    },
    headline_xl(slide, ctx) {
      const value = textOf(slide, "headline");
      return value ? fit(make("div", "ie-headline ie-headline-xl", value), "headline_xl", ctx.scale) : null;
    },
    body(slide, ctx) {
      const value = textOf(slide, "body");
      if (!value) return null;
      const node = fit(make("div", "ie-body", value), "body", ctx.scale);
      if (slide.layout.startsWith("amarillista:")) {
        node.style.maxHeight = Math.round(340 * ctx.scale) + "px";
        node.style.fontSize = Math.round(62 * ctx.scale) + "px";
        node.dataset.minSize = String(Math.round(48 * ctx.scale));
        // El hilo admite hasta 60 palabras (50 en resolución); mismo cuerpo y suelo tipográfico,
        // más altura disponible antes del ajuste medido de la columna.
        if (["DESARROLLO", "QUÉ HACER"].includes(textOf(slide, "kicker"))) {
          node.style.maxHeight = Math.round(760 * ctx.scale) + "px";
        }
        if (slide.layout.includes("_reflexion_")) {
          node.classList.add("ie-reflection-line");
          node.style.fontSize = Math.round(88 * ctx.scale) + "px";
          node.style.maxHeight = Math.round(490 * ctx.scale) + "px";
          node.dataset.minSize = String(Math.round(66 * ctx.scale));
        }
        if (ctx.style.category_id === "node_history") {
          node.replaceChildren();
          const parts = value.split(/(\b(?:\d{1,2} de [a-z]+ de )?\d{4}\b)/gi);
          for (const part of parts) node.appendChild(/\d{4}/.test(part) ? make("span", "ie-date", part) : document.createTextNode(part));
        }
      }
      return node;
    },
    label(slide) {
      const value = textOf(slide, "label");
      if (!value) return null;
      const node = make("div", "ie-scope");
      if (textOf(slide, "kicker") === "PORTADA" && value.startsWith("¿")) {
        node.appendChild(make("span", "ie-mark", value));
      } else node.textContent = value;
      return node;
    },
    diagram(slide) {
      const element = slide.elements.find(e => e.type === "diagram");
      if (!element) return null;
      const data = JSON.parse(element.value);
      const box = make("figure", "ie-infographic ie-infographic-" + data.kind);
      const editorialLabel = slide.layout.startsWith("amarillista:") && data.label === textOf(slide, "kicker");
      if (!editorialLabel) box.appendChild(make("figcaption", "ie-chart-label", data.label || "Los datos"));
      if (data.kind === "percent") {
        const dots = make("div", "ie-waffle");
        for (let i = 0; i < 100; i++) dots.appendChild(make("i", i < data.value ? "on" : ""));
        const row = make("div", "ie-chart-row");
        row.append(make("strong", "ie-chart-number", String(data.value).replace(".", ",") + " %"), dots);
        box.appendChild(row);
      } else if (data.kind === "quantity") {
        box.appendChild(make("strong", "ie-quantity-value", data.value));
        box.appendChild(make("div", "ie-quantity-unit", data.unit));
        const isVolume = /galones|litros|volumen/i.test(data.unit || "");
        const vessel = make("div", isVolume ? "ie-volume-vessel" : "ie-quantity-reference");
        vessel.appendChild(make("span", "", isVolume ? "Volumen total" : "Dato documentado"));
        box.appendChild(vessel);
      } else if (data.kind === "fraction") {
        box.appendChild(make("strong", "ie-fraction-value", "Casi " + data.numerator + " de cada " + data.denominator));
        const units = make("div", "ie-fraction-units");
        for (let i=0; i<data.denominator; i++) units.appendChild(make("i", i<data.numerator ? "on" : ""));
        box.appendChild(units);
      } else if (data.kind === "comparison") {
        for (const item of data.items) {
          const row = make("div", "ie-comparison-row");
          row.appendChild(make("div", "ie-chart-row", item.label));
          const track = make("div", "ie-track");
          const fill = make("div", "ie-fill"); fill.style.width = String(item.value / (data.scale || 100) * 100) + "%";
          track.appendChild(fill);
          row.append(track, make("strong", "ie-chart-value", String(item.value).replace(".", ",") + (data.unit || " %")));
          box.appendChild(row);
        }
      } else {
        const list = make("ol", "ie-evidence-list");
        for (const item of data.items) {
          const li = make("li");
          if (typeof item === "string") li.textContent = item;
          else li.append(make("strong", "ie-timeline-date", item.label), make("span", "", item.detail));
          list.appendChild(li);
        }
        box.appendChild(list);
      }
      box.dataset.visual = "informative";
      return box;
    },
    tagline(slide) {
      const value = textOf(slide, "tagline");
      return value ? make("div", "ie-tagline", value) : null;
    },
    recap(slide, ctx) {
      const lines = textOf(slide, "body").split("\n").filter(Boolean);
      if (!lines.length) return null;
      const list = fit(make("ol", "ie-recap"), "recap", ctx.scale);
      if (recipeFor(slide).name === "close") list.classList.add("ie-closing-panel");
      for (const line of lines) list.appendChild(make("li", "", line.replace(/^\d+\.\s*/, "")));
      return list;
    },
    spacer() { return make("div", "ie-spacer"); },
    cta(slide) {
      const value = textOf(slide, "cta");
      if (!value) return null;
      const box = make("div", "ie-cta");
      box.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z"/></svg>';
      box.appendChild(make("span", "", value));
      return box;
    },
    swipebar(slide, ctx) {
      const bar = make("div", "ie-row ie-swipebar");
      bar.appendChild(make("div", "ie-swipe", textOf(slide, "swipe")));
      bar.appendChild(dots(slide, ctx));
      return bar;
    },
    footer(slide) {
      const source = textOf(slide, "source");
      const handle = textOf(slide, "handle");
      if (!source && !handle) return null;
      const bar = make("div", "ie-row ie-footer");
      bar.appendChild(make("div", "ie-source", source));
      bar.appendChild(make("div", "ie-handle", handle));
      return bar;
    },
    // Banda de las recetas con foto: crédito de la foto y fuente del dato en líneas distintas (§4).
    credits(slide) {
      const box = make("div", "ie-credits");
      const lines = make("div", "ie-credit-lines");
      for (const role of ["credit", "source"]) {
        const value = textOf(slide, role);
        if (value) lines.appendChild(make("div", "ie-" + role, value));
      }
      box.appendChild(lines);
      if (!String(slide.layout).startsWith("amarillista:")) box.appendChild(make("div", "ie-handle", textOf(slide, "handle")));
      return box;
    },
  };

  function photo(slide, ctx, mode) {
    const element = slide.elements.find(item => item.type === "photo");
    if (!element || !ctx.media[element.asset_id]) return null;
    const ref = slide.media.find(item => item.asset_id === element.asset_id);
    const frame = make("figure", "ie-photo ie-photo-" + mode);
    const image = make("img");
    image.src = ctx.media[element.asset_id];
    image.alt = element.value || "";
    image.style.filter = ctx.style.composition.photo_filter;
    image.style.objectPosition = Math.round((ref?.focus?.[0] ?? .5) * 100) + "% " + Math.round((ref?.focus?.[1] ?? .5) * 100) + "%";
    image.style.transform = "scale(" + (1 + Math.max(0, Math.min(1, ctx.progress)) * .05) + ")";
    frame.appendChild(image);
    if (mode === "full") frame.appendChild(make("div", "ie-scrim"));   // velo local bajo el texto
    return frame;
  }

  function recipeFor(slide) {
    const name = String(slide.layout || "").split(":").pop();
    const reflection = /^am_(negro|alto|medio|basico)_reflexion_(photo|visual)$/.test(name);
    const actual = reflection ? "am_reflexion_" + name.split("_").pop() : /^am_(negro|alto|medio|basico)_(photo|visual|close)$/.test(name)
      ? "am_" + name.split("_").pop() : name;
    return {name: LAYOUTS[actual] ? actual : FALLBACK_LAYOUT, ...(LAYOUTS[actual] || LAYOUTS[FALLBACK_LAYOUT])};
  }

  function applyTheme(root, style, scale) {
    const p = style.palette, f = style.fonts, g = style.grid;
    const vars = {
      "--bg": p.bg, "--bg2": p.bg2, "--ink": p.ink, "--muted": p.muted, "--accent": p.accent,
      "--accent-ink": p.accentInk, "--s": String(scale), "--margin": Math.round(g.margin_px * scale) + "px",
      "--headline": "'" + f.headline + "', sans-serif", "--body": "'" + f.body + "', sans-serif",
      "--mono": "'" + f.mono + "', monospace", "--decorative": "'" + f.decorative + "', serif",
    };
    for (const [key, value] of Object.entries(vars)) root.style.setProperty(key, value);
  }

  function column(className, keys, slide, ctx) {
    const box = make("div", className);
    for (const entry of keys) {
      const key = entry.replace("?", "");
      const node = BLOCKS[key](slide, ctx);
      if (!node) continue;
      node.dataset.block = key;
      box.appendChild(node);
    }
    return box;
  }

  function render(slide, context, skin) {
    const scale = Math.min(context.width / 1080, context.height / 1350);
    const ctx = {...context, scale, brand: skin.brand(context)};
    const recipe = recipeFor(slide);
    const root = make("main", "image-stage ie-root " + skin.className + (recipe.photo ? " has-photo photo-" + recipe.photo : ""));
    root.style.width = context.width + "px";
    root.style.height = context.height + "px";
    applyTheme(root, context.style, scale);
    root.dataset.layout = recipe.name;
    root.dataset.mode = context.mode || "image";
    // Width fixes the type scale; extra height becomes breathing room, never a stretch.
    // The bottom safe area keeps references clear of mobile platform controls.
    const extraHeight = Math.max(0, context.height - 1350 * scale);
    if (root.dataset.mode === "image") {
      root.style.setProperty("--safe-top", Math.round(context.style.grid.margin_px * scale + extraHeight * .12) + "px");
      root.style.setProperty("--safe-bottom", Math.round(context.style.grid.margin_px * scale + extraHeight * .2) + "px");
    }
    if (String(slide.layout).startsWith("amarillista:")) {
      const level = slide.layout.split(":")[1].split("_")[1];
      root.classList.add("ie-amarillista", "alarm-" + level);
      root.style.setProperty("--alarm-red", context.style.alarm?.red || "#B74A42");
      root.style.setProperty("--alarm-yellow", context.style.alarm?.yellow || "#D3B35A");
      root.style.setProperty("--alarm-opacity", String(context.style.alarm?.levels?.[level]?.opacity ?? .8));
    }
    root.dataset.slideIndex = String(context.slideIndex);
    root.dataset.template = context.plan.template_id;
    if (!recipe.photo) {
      const color = context.style.palette.bg;
      const isDark = /^#[0-9a-f]{6}$/i.test(color) && [1, 3, 5].every(index => parseInt(color.slice(index, index + 2), 16) <= 32);
      if (root.dataset.mode === "image" && isDark) root.classList.add("has-editorial-grid");
      skin.background?.(root, ctx);
    }
    if (recipe.photo) {
      const figure = photo(slide, ctx, recipe.photo);
      if (figure) root.appendChild(figure);
    }
    root.appendChild(column("ie-frame", recipe.blocks, slide, ctx));
    if (recipe.band) root.appendChild(column("ie-band", recipe.band, slide, ctx));
    root._ieContext = ctx;
    return root;
  }

  // La columna desborda si su último bloque termina debajo del borde (más fiable que scrollHeight).
  function overflowsColumn(frame) {
    const last = frame.lastElementChild;
    return Boolean(last) && last.getBoundingClientRect().bottom > frame.getBoundingClientRect().bottom + 1;
  }

  // Después del ajuste de fuentes: la piel puede dibujar decoraciones medidas (subrayados).
  function afterLayout(root, skin) {
    skin.afterLayout?.(root, root._ieContext);
  }

  function registerSkin(skin) {
    window.ImagePostComponents = window.ImagePostComponents || {};
    window.ImagePostComponents[skin.id] = {
      nameFor(template) { return "image." + skin.id + "." + template; },
      renderSlide(slide, context) { return render(slide, context, skin); },
      afterLayout(root) { afterLayout(root, skin); },
    };
  }

  window.ImageEngine = {LAYOUTS, BLOCKS, TYPE, render, registerSkin, overflowsColumn};
})();
