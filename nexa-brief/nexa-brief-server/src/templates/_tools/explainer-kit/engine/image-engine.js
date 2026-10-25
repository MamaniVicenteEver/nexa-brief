/* =============================================================================
   Motor de imágenes estáticas (posts 4:5 y cuadros de Reel)
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

  // Cada bloque devuelve un nodo o null (null = no hay contenido: no ocupa lugar).
  const BLOCKS = {
    topbar(slide, ctx) {
      const kicker = textOf(slide, "kicker");
      if (!kicker && !ctx.brand) return null;
      const bar = make("div", "ie-row ie-topbar");
      bar.appendChild(label("ie-kicker", kicker));
      bar.appendChild(make("div", "ie-brand", ctx.brand));
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
      return value ? fit(make("div", "ie-headline", value), "headline", ctx.scale) : null;
    },
    headline_xl(slide, ctx) {
      const value = textOf(slide, "headline");
      return value ? fit(make("div", "ie-headline ie-headline-xl", value), "headline_xl", ctx.scale) : null;
    },
    body(slide, ctx) {
      const value = textOf(slide, "body");
      return value ? fit(make("div", "ie-body", value), "body", ctx.scale) : null;
    },
    tagline(slide) {
      const value = textOf(slide, "tagline");
      return value ? make("div", "ie-tagline", value) : null;
    },
    recap(slide, ctx) {
      const lines = textOf(slide, "body").split("\n").filter(Boolean);
      if (!lines.length) return null;
      const list = fit(make("ol", "ie-recap"), "recap", ctx.scale);
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
      box.appendChild(make("div", "ie-handle", textOf(slide, "handle")));
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
    return {name: LAYOUTS[name] ? name : FALLBACK_LAYOUT, ...(LAYOUTS[name] || LAYOUTS[FALLBACK_LAYOUT])};
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
    root.dataset.slideIndex = String(context.slideIndex);
    root.dataset.template = context.plan.template_id;
    if (!recipe.photo) skin.background?.(root, ctx);
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
