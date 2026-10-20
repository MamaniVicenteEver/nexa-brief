/* =============================================================================
   rough · intros para miniaturas del paquete de publicación
   ----------------------------------------------------------------------------
   V1 usa solo texto; V2 combina texto con una foto. Los dos conservan la
   paleta y los trazos hechos a mano del diseño rough.
   ========================================================================== */
(function () {
  const K = Kit, R = Kit.rough, { prog } = K;
  let nextPhotoId = 0;

  function textBlock(ctx, parent, text, box, highlight, align = "center") {
    const { W, H, u, portrait } = ctx.stage, P = ctx.C.palette;
    const rows = String(text || "").toUpperCase().split("\n").filter(Boolean);
    const widths = rows.map(line => Math.max(1, R.measure(line, "900 100px Inter")));
    let sizes = widths.map(width => 100 * box.w / width);
    const maxHeight = box.h;
    const total = sizes.reduce((sum, size) => sum + size * 0.94, 0);
    if (total > maxHeight) sizes = sizes.map(size => size * maxHeight / total);
    const height = sizes.reduce((sum, size) => sum + size * 0.94, 0);
    const top = box.y + (box.h - height) / 2;
    let y = top;
    const elements = rows.map((line, index) => {
      const size = sizes[index], centerY = y + size * 0.47;
      y += size * 0.94;
      const accent = highlight && line.includes(String(highlight).toUpperCase());
      const color = accent ? P.accent : P.ink;
      const rowWidth = widths[index] * size / 100;
      const x = align === "left" ? box.x + rowWidth / 2 : box.x + box.w / 2;
      const element = R.text(ctx, parent, line, { x, y: centerY, size: size / u, weight: 900, color });
      const length = size * 7;
      Object.assign(element.style, {
        fillOpacity: 0, stroke: color, strokeWidth: Math.max(1, size * 0.012) + "px",
        strokeDasharray: `${length} ${length}`, strokeDashoffset: length, strokeLinejoin: "round",
      });
      element._length = length;
      return element;
    });
    const bottom = top + height;
    const lineW = align === "left" ? Math.max(...widths.map((w, i) => w * sizes[i] / 100)) : box.w * 0.84;
    const lineX = align === "left" ? box.x : box.x + box.w * 0.08;
    const underline = R.shape(ctx, parent, (G, options) => [
      G.curve([
        [lineX, bottom + u * 1.9],
        [lineX + lineW * 0.5, bottom + u * 1.2],
        [lineX + lineW, bottom + u * 2.1],
      ], options),
    ], { color: P.accent, width: 1.5, seed: 41 });

    return {
      top,
      bottom,
      render(lt, t) {
        elements.forEach((element, index) => {
          const outline = prog(lt, 0.08 + index * 0.18, 0.85, "inOut");
          const fill = prog(lt, 0.55 + index * 0.18, 0.4);
          element.style.strokeDashoffset = element._length * (1 - outline);
          element.style.fillOpacity = fill;
          element.style.strokeOpacity = 1 - fill * 0.9;
        });
        R.draw(underline, lt, { start: 0.75 + rows.length * 0.14, dur: 0.45, t });
      },
    };
  }

  function kicker(ctx, parent, text, x, y, size = 2.1) {
    return text ? R.label(ctx, parent, String(text).toUpperCase(), { x, y, size }) : null;
  }

  function smallLine(ctx, parent, text, x, y, size = 1.55) {
    if (!text) return null;
    return R.mono(ctx, parent, String(text).toUpperCase(), { x, y, size, color: ctx.C.palette.ink });
  }

  function showSmallLine(el, lt, start) {
    if (el) el.setAttribute("opacity", prog(lt, start, 0.35));
  }

  K.register({
    name: "rough.introv1", tags: ["intro", "miniatura", "solo texto"], layer: "main",
    summary: "Miniatura de solo texto con el tratamiento a mano de rough: título enorme, línea lima y antetítulo opcional.",
    example: { text: "LA COMPUTADORA\nDEL APOLO 11\nSE RINDIÓ", highlight: "SE RINDIÓ", kicker: "APOLO 11 · 1969" },
    params: {
      text: { type: "string", required: true, doc: "Título; '\\n' separa renglones." },
      textPortrait: { type: "string", default: "", doc: "Cortes alternativos para 9:16." },
      highlight: { type: "string", default: "", doc: "Renglón que se pinta en lima." },
      kicker: { type: "string", default: "", doc: "Antetítulo en etiqueta lima." },
      sub: { type: "string", default: "", doc: "Línea chica opcional bajo el título." },
      fill: { type: "number", default: 0.88, min: 0.45, max: 1, doc: "Ancho ocupado por el título." },
    },
    create(ctx, p) {
      ctx.beat.hideCaptions = true;
      const { W, H, u, portrait } = ctx.stage, g = R.root(ctx);
      const box = { x: W * (1 - p.fill) / 2, y: H * 0.2, w: W * p.fill, h: H * 0.56 };
      const title = textBlock(ctx, g, portrait && p.textPortrait ? p.textPortrait : p.text, box, p.highlight);
      const tag = kicker(ctx, g, p.kicker, W / 2, title.top - u * 5.2, portrait ? 2.5 : 2.1);
      const sub = smallLine(ctx, g, p.sub, W / 2, title.bottom + u * 7.5, portrait ? 1.8 : 1.55);
      return {
        render(lt, beat, t) {
          title.render(lt, t);
          if (tag) tag.setAttribute("opacity", prog(lt, 0.05, 0.35));
          showSmallLine(sub, lt, 1.5);
          if (lt > beat.dur) R.exitFx(g, ctx, lt, beat);
        },
        dispose() { g.remove(); },
      };
    },
  });

  K.register({
    name: "rough.introv2", tags: ["intro", "miniatura", "texto e imagen"], layer: "main",
    summary: "Miniatura de texto e imagen al estilo de las miniaturas de tecnología: título enorme alineado a la izquierda y una foto grande a color que se funde con el fondo (en 9:16 la foto va arriba).",
    example: { text: "¿SE ACABÓ\nLA PC\nBARATA?", highlight: "BARATA?", kicker: "MEMORIA RAM · 2026", src: "assets/media/hamilton.jpg" },
    params: {
      text: { type: "string", required: true, doc: "Título; '\\n' separa renglones (2 a 4 renglones cortos)." },
      textPortrait: { type: "string", default: "", doc: "Cortes alternativos para 9:16." },
      highlight: { type: "string", default: "", doc: "Renglón que se pinta en lima (el remate)." },
      kicker: { type: "string", default: "", doc: "Antetítulo en etiqueta lima." },
      sub: { type: "string", default: "", doc: "Línea chica opcional bajo el título." },
      src: { type: "image", default: "", doc: "Foto o render del objeto del tema (a color)." },
      saturate: { type: "number", default: 1, min: 0, max: 1.4, doc: "Color de la foto (0 = blanco y negro)." },
      focus: { type: "string", default: "xMidYMid", doc: "Encuadre de la foto (preserveAspectRatio: xMinYMid, xMaxYMid…)." },
    },
    create(ctx, p) {
      ctx.beat.hideCaptions = true;
      const { W, H, u, portrait } = ctx.stage, P = ctx.C.palette, g = R.root(ctx);
      const imageBox = portrait
        ? { x: 0, y: 0, w: W, h: H * 0.55 }
        : { x: W * 0.4, y: 0, w: W * 0.6, h: H };
      const textBox = portrait
        ? { x: W * 0.07, y: H * 0.53, w: W * 0.86, h: H * 0.34 }
        : { x: W * 0.045, y: H * 0.14, w: W * 0.5, h: H * 0.72 };
      const id = `rough-intro-${++nextPhotoId}`;
      const defs = R.svg("defs", null, g);
      const filter = R.svg("filter", { id: `${id}-tone`, "color-interpolation-filters": "sRGB" }, defs);
      R.svg("feColorMatrix", { type: "saturate", values: String(p.saturate) }, filter);
      // La foto se funde con el fondo hacia el título (izquierda en 16:9, abajo en 9:16).
      const fade = R.svg("linearGradient", portrait
        ? { id: `${id}-fade`, x1: 0, y1: 0, x2: 0, y2: 1 }
        : { id: `${id}-fade`, x1: 0, y1: 0, x2: 1, y2: 0 }, defs);
      (portrait ? [[0, 1], [0.72, 1], [1, 0]] : [[0, 0], [0.32, 1], [1, 1]]).forEach(([offset, opacity]) =>
        R.svg("stop", { offset, "stop-color": "#fff", "stop-opacity": opacity }, fade));
      const mask = R.svg("mask", { id: `${id}-mask`, maskUnits: "userSpaceOnUse", x: imageBox.x, y: imageBox.y, width: imageBox.w, height: imageBox.h }, defs);
      R.svg("rect", { x: imageBox.x, y: imageBox.y, width: imageBox.w, height: imageBox.h, fill: `url(#${id}-fade)` }, mask);
      const photo = R.svg("g", { opacity: 0, mask: `url(#${id}-mask)` }, g);
      if (p.src) {
        R.svg("image", {
          href: p.src, x: imageBox.x, y: imageBox.y, width: imageBox.w, height: imageBox.h,
          preserveAspectRatio: `${p.focus} slice`, filter: `url(#${id}-tone)`,
        }, photo);
      } else {
        R.svg("rect", { x: imageBox.x, y: imageBox.y, width: imageBox.w, height: imageBox.h, fill: P.bg2 }, photo);
        const pending = R.mono(ctx, photo, "IMAGEN PENDIENTE", {
          x: imageBox.x + imageBox.w * (portrait ? 0.5 : 0.62), y: imageBox.y + imageBox.h / 2, size: portrait ? 2.2 : 1.8,
          color: P.muted,
        });
        pending._pending = true;
      }
      const title = textBlock(ctx, g, portrait && p.textPortrait ? p.textPortrait : p.text, textBox, p.highlight, "left");
      const tag = p.kicker
        ? R.label(ctx, g, String(p.kicker).toUpperCase(), { x: textBox.x, y: title.top - u * (portrait ? 4.6 : 4), size: portrait ? 2.3 : 1.9, anchor: "start" })
        : null;
      const sub = p.sub
        ? R.mono(ctx, g, String(p.sub).toUpperCase(), { x: textBox.x, y: title.bottom + u * 6.5, size: portrait ? 1.7 : 1.4, color: P.ink, anchor: "start" })
        : null;
      return {
        render(lt, beat, t) {
          photo.setAttribute("opacity", prog(lt, 0.05, 0.5));
          title.render(lt, t);
          if (tag) tag.setAttribute("opacity", prog(lt, 0.05, 0.35));
          showSmallLine(sub, lt, 1.45);
          if (lt > beat.dur) R.exitFx(g, ctx, lt, beat);
        },
        dispose() { g.remove(); },
      };
    },
  });
})();
