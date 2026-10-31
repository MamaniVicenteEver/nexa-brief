/* =============================================================================
   rough · componentes base: título, icono, foto, anotación
   -----------------------------------------------------------------------------
   Convenciones (iguales en toda la familia):
   · create() arma el SVG una vez (trazos con semilla fija); render(lt, b) solo
     cambia atributos según lt → cada cuadro es función pura del tiempo;
   · entrada = dibujar trazos; salida = R.exitFx durante el solape posterior;
   · el ACENTO (lima) va en una sola cosa por escena: el dato que importa.
   ========================================================================== */
(function () {
  const K = Kit, R = Kit.rough, { clamp, lerp, prog, ease, hash } = K;
  const pal = ctx => ctx.C.palette;
  const mc = document.createElement("canvas").getContext("2d");
  /** ancho de un texto en px para `font` (canvas, misma fuente que el SVG) */
  const measure = (str, font) => { mc.font = font; return mc.measureText(str).width; };
  /** parte un texto largo en renglones de hasta `max` caracteres (sin cortar palabras) */
  function wrap(str, max) {
    const out = [""];
    for (const w of String(str).split(/\s+/)) { const cur = out[out.length - 1]; if (cur && (cur + " " + w).length > max) out.push(w); else out[out.length - 1] = cur ? cur + " " + w : w; }
    return out;
  }
  R.measure = measure; R.wrap = wrap;

  /* ------------------------------------------------------------------ título */
  K.register({
    name: "rough.title", tags: ["intro", "gancho", "texto"], layer: "main",
    summary: "Título de apertura GIGANTE (cartel: cada renglón al ancho total, ~80% del cuadro): las letras se dibujan en contorno y se rellenan; antetítulo en etiqueta lima, subtítulo debajo y subrayado a mano. Puede parpadear como alarma.",
    example: { text: "1202", kicker: "APOLO 11 · 20 JUL 1969", sub: "EL ERROR QUE LLEVÓ A LA HUMANIDAD A LA LUNA", accent: true, blink: 3 },
    params: {
      text: { type: "string", required: true, doc: "Título; '\\n' parte renglones." },
      textPortrait: { type: "string", default: "", doc: "Cortes alternativos para 9:16." },
      kicker: { type: "string", default: "", doc: "Antetítulo (etiqueta lima arriba)." },
      sub: { type: "string", default: "", doc: "Subtítulo debajo (Inter 800, se parte solo)." },
      accent: { type: "bool", default: false, doc: "Título en color de acento (lima) en vez de blanco." },
      blink: { type: "number", default: 0, min: 0, max: 6, doc: "Parpadeos tipo alarma al terminar de dibujarse (0 = ninguno)." },
      fill: { type: "number", default: 0.9, min: 0.4, max: 1, doc: "Fracción del ancho que ocupa." },
      underline: { type: "bool", default: true, doc: "Subrayado a mano bajo el último renglón." },
    },
    create(ctx, p) {
      const { W, H, u, portrait } = ctx.stage, P = pal(ctx), g = R.root(ctx);
      ctx.beat.hideCaptions = ctx.beat.hideCaptions ?? true;
      const lines = (portrait && p.textPortrait ? p.textPortrait : p.text).split("\n");
      const color = p.accent ? P.accent : P.ink;
      const box = { w: W * p.fill, h: portrait ? H * 0.42 : H * 0.5 };
      /* tamaño por renglón (cartel) y escala común si se pasa del alto */
      let fs = lines.map(l => 100 * box.w / Math.max(1, measure(l, "900 100px Inter")));
      const tot = fs.reduce((a, b) => a + b * 0.94, 0); if (tot > box.h) fs = fs.map(f => f * box.h / tot);
      const blockH = fs.reduce((a, b) => a + b * 0.94, 0), cy = portrait ? H * 0.45 : H * 0.47;
      let y = cy - blockH / 2;
      const els = lines.map((l, i) => {
        const yy = y + fs[i] * 0.47; y += fs[i] * 0.94;
        const el = R.text(ctx, g, l, { x: W / 2, y: yy + fs[i] * 0.02, size: fs[i] / u, weight: 900, color });
        const L = fs[i] * 7;
        Object.assign(el.style, { fillOpacity: 0, stroke: color, strokeWidth: Math.max(1, fs[i] * 0.012) + "px", strokeDasharray: `${L} ${L}`, strokeDashoffset: L, strokeLinejoin: "round" });
        el._L = L; return el;
      });
      const top = cy - blockH / 2, bottom = cy + blockH / 2;
      const kicker = p.kicker ? R.label(ctx, g, p.kicker, { x: W / 2, y: top - u * 6, size: portrait ? 2.6 : 2.3 }) : null;
      const under = p.underline ? R.shape(ctx, g, (G, o) => [G.curve([[W / 2 - box.w * 0.36, bottom + u * 2.2], [W / 2, bottom + u * 1.2], [W / 2 + box.w * 0.38, bottom + u * 2.6]], o)], { color: p.accent ? P.ink : P.accent, width: 1.6, seed: 5 }) : [];
      const subs = p.sub ? wrap(p.sub, portrait ? 24 : 44).map((l, i) => R.text(ctx, g, l, { x: W / 2, y: bottom + u * (portrait ? 7.5 : 6.5) + i * u * (portrait ? 4.2 : 3.6), size: portrait ? 3.4 : 2.9, weight: 800, color: P.ink, opacity: 0 })) : [];
      return {
        render(lt, b, t) {
          els.forEach((el, i) => {
            const q = prog(lt, 0.1 + i * 0.22, 1.0, "inOut"), f = prog(lt, 0.65 + i * 0.22, 0.45);
            el.style.strokeDashoffset = el._L * (1 - q); el.style.fillOpacity = f; el.style.strokeOpacity = 1 - f * 0.9;
          });
          const drawn = 0.65 + (lines.length - 1) * 0.22 + 0.45;
          /* parpadeo de alarma: apagado/encendido a 0.16 s, después queda fijo */
          if (p.blink > 0) { const k = (lt - drawn - 0.2) / 0.16; const off = k > 0 && k < p.blink * 2 && Math.floor(k) % 2 === 0; els.forEach(el => (el.style.opacity = off ? 0.12 : 1)); }
          if (kicker) kicker.setAttribute("opacity", prog(lt, 0, 0.35));
          R.draw(under, lt, { start: drawn - 0.1, dur: 0.6, t });
          subs.forEach((s, i) => s.setAttribute("opacity", prog(lt, drawn + 0.1 + i * 0.12, 0.5)));
          const z = 1 + lt * 0.005, { cx, cy: ccy } = ctx.stage;
          g.setAttribute("transform", `translate(${cx} ${ccy}) scale(${z}) translate(${-cx} ${-ccy})`);
          if (lt > b.dur) R.exitFx(g, ctx, lt, b);
        },
        dispose() { g.remove(); },
      };
    },
  });

  /* ------------------------------------------------------------------ icono */
  K.register({
    name: "rough.icon", tags: ["objeto", "concepto", "símbolo"], layer: "main",
    summary: "Boceto de un objeto (diccionario rough/sketches.js) que se dibuja trazo a trazo; relleno rayado lima opcional, etiqueta arriba y nota manuscrita abajo.",
    example: { icon: "rocket", tag: "APOLO 11", caption: "julio de 1969", accent: true },
    params: {
      icon: { type: "icon", required: true, doc: "Nombre del boceto (ver catálogo de sketches)." },
      size: { type: "number", default: 0.55, min: 0.15, max: 1, doc: "Fracción del contenido." },
      tag: { type: "string", default: "", doc: "Etiqueta lima arriba." },
      caption: { type: "string", default: "", doc: "Nota manuscrita (Caveat) abajo." },
      accent: { type: "bool", default: false, doc: "Relleno rayado lima (resalta este objeto)." },
      color: { type: "enum", options: ["ink", "accent"], default: "ink", doc: "Color del trazo." },
      drawSec: { type: "number", default: 1.3, doc: "Segundos que tarda en dibujarse." },
    },
    create(ctx, p) {
      const P = pal(ctx), g = R.root(ctx), { u, cx, portrait } = ctx.stage, bx = R.boxIn(ctx, p.size, 1, -u * 1);
      const els = R.sketch(ctx, g, p.icon, bx, { color: p.color === "accent" ? P.accent : P.ink, fill: p.accent, width: 1.5, seed: hash(p.icon + ctx.beat.i) });
      const tag = p.tag ? R.label(ctx, g, p.tag, { x: cx, y: bx.y - u * 4.5, size: portrait ? 2.4 : 2.2 }) : null;
      const cap = p.caption ? R.hand(ctx, g, "", { x: cx, y: bx.y + bx.h + u * 5, size: portrait ? 4.6 : 4, color: p.accent ? P.accent : P.ink }) : null;
      return {
        render(lt, b, t) {
          const d = R.draw(els, lt, { start: 0.05, total: p.drawSec, dur: 0.7, t });
          if (tag) tag.setAttribute("opacity", prog(lt, 0.2, 0.35));
          if (cap) R.type(cap, p.caption, prog(lt, p.drawSec * 0.6, 0.6, "linear"));
          const f = Math.sin(lt * 1.1) * u * 0.25;
          g.setAttribute("transform", `translate(0 ${f.toFixed(2)})`);
          if (lt > b.dur) R.exitFx(g, ctx, lt, b);
          void d;
        },
        dispose() { g.remove(); },
      };
    },
  });

  /* ------------------------------------------------------------------ foto */
  let FID = 0;
  K.register({
    name: "rough.photo", tags: ["foto", "persona", "lugar", "documento"], layer: "main",
    summary: "Foto real en blanco y negro (o virada a lima) que se revela con un barrido dentro de un marco dibujado a mano con cintas; nombre manuscrito y ficha mono debajo. Zoom lento (Ken Burns).",
    example: { src: "assets/media/hamilton.jpg", caption: "Margaret Hamilton", sub: "DIRECTORA DE SOFTWARE · MIT · 32 AÑOS" },
    params: {
      src: { type: "image", required: true, doc: "Foto (jpg/png local)." },
      caption: { type: "string", default: "", doc: "Nombre / título manuscrito (Caveat, lima)." },
      sub: { type: "string", default: "", doc: "Ficha mono bajo el nombre." },
      tone: { type: "enum", options: ["mono", "lime"], default: "mono", doc: "mono = B/N contrastado; lime = sombras negras y luces lima." },
      size: { type: "number", default: 0.84, min: 0.3, max: 1, doc: "Fracción del contenido." },
      ar: { type: "number", default: 0, doc: "Proporción del recorte (0 = la de la foto; en 9:16 conviene 0.8)." },
      tilt: { type: "number", default: -1.5, doc: "Inclinación del marco en grados." },
      focus: { type: "array", default: [0.5, 0.4], doc: "Punto [x,y] 0..1 hacia donde se acerca el zoom." },
      ...K.brandLogo.params,
    },
    create(ctx, p) {
      const P = pal(ctx), g = R.root(ctx), { u, cx, portrait } = ctx.stage, im = ctx.img(p.src);
      const ar = p.ar || (im ? clamp(im.width / im.height, 0.6, 1.9) : 1.3);
      const bx = R.boxIn(ctx, p.size, ar, -u * 3), id = "rph" + (++FID);
      const logo = K.brandLogo.attach(ctx, p, bx, p.focus);
      const hex = c => [1, 3, 5].map(k => parseInt(c.slice(k, k + 2), 16) / 255);
      const [b0, b1] = [hex(P.bg), hex(p.tone === "lime" ? P.accent : P.ink)];
      const defs = R.svg("defs", null, g);
      const clip = R.svg("clipPath", { id: id + "c" }, defs); const cr = R.svg("rect", { x: bx.x, y: bx.y, width: 0, height: bx.h }, clip);
      const flt = R.svg("filter", { id: id + "f", "color-interpolation-filters": "sRGB" }, defs);
      R.svg("feColorMatrix", { type: "saturate", values: 0 }, flt);
      const ct = R.svg("feComponentTransfer", null, flt);
      ["R", "G", "B"].forEach((ch, k) => R.svg("feFunc" + ch, { type: "table", tableValues: `${b0[k]} ${lerp(b0[k], b1[k], 0.45)} ${b1[k]}` }, ct));
      const frame = R.svg("g", { transform: `rotate(${p.tilt} ${cx} ${bx.y + bx.h / 2})` }, g);
      const imgG = R.svg("g", { "clip-path": `url(#${id}c)` }, frame);
      const img = R.svg("image", { href: p.src, x: bx.x, y: bx.y, width: bx.w, height: bx.h, preserveAspectRatio: "xMidYMid slice", filter: `url(#${id}f)` }, imgG);
      const pad = u * 1.2;
      const border = R.shape(ctx, frame, (G, o) => [G.rectangle(bx.x - pad, bx.y - pad, bx.w + 2 * pad, bx.h + 2 * pad, o)], { width: 1.4, seed: 11 });
      const tapes = R.shape(ctx, frame, (G, o) => [
        G.polygon([[bx.x - u * 4, bx.y + u * 1], [bx.x + u * 5, bx.y - u * 4], [bx.x + u * 7, bx.y - u * 1], [bx.x - u * 2, bx.y + u * 4]], { ...o, fill: "F", fillStyle: "hachure", hachureGap: u * 0.6 }),
        G.polygon([[bx.x + bx.w - u * 5, bx.y - u * 4], [bx.x + bx.w + u * 4, bx.y + u * 1], [bx.x + bx.w + u * 2, bx.y + u * 4], [bx.x + bx.w - u * 7, bx.y - u * 1]], { ...o, fill: "F", fillStyle: "hachure", hachureGap: u * 0.6, seed: 9 }),
      ], { color: P.accent, fillColor: P.accent, width: 1, seed: 21 });
      const capY = bx.y + bx.h + pad + u * (portrait ? 6 : 5);
      const cap = p.caption ? R.hand(ctx, g, "", { x: cx, y: capY, size: portrait ? 5.2 : 4.4, color: P.accent }) : null;
      const sub = p.sub ? R.mono(ctx, g, p.sub, { x: cx, y: capY + u * (portrait ? 5 : 4.4), size: portrait ? 1.7 : 1.5, color: P.muted, opacity: 0 }) : null;
      const [fx, fy] = p.focus;
      return {
        render(lt, b, t) {
          R.draw(border, lt, { start: 0, dur: 0.8, total: 0.4, t });
          const w = prog(lt, 0.25, 0.9, "inOut"); cr.setAttribute("width", bx.w * w);
          const z = 1.08 + lt * 0.012, ox = bx.x + bx.w * fx, oy = bx.y + bx.h * fy;
          img.setAttribute("transform", `translate(${ox} ${oy}) scale(${z}) translate(${-ox} ${-oy})`);
          R.draw(tapes, lt, { start: 0.9, dur: 0.35, t });
          if (cap) R.type(cap, p.caption, prog(lt, 1.0, 0.7, "linear"));
          if (sub) sub.setAttribute("opacity", prog(lt, 1.5, 0.5));
          if (logo) logo.render(lt);
          if (lt > b.dur) R.exitFx(g, ctx, lt, b);
        },
        dispose() { if (logo) logo.dispose(); g.remove(); },
      };
    },
  });

  /* ------------------------------------------------------------------ anotación */
  K.register({
    name: "rough.annotate", tags: ["énfasis", "marca", "flecha"], layer: "overlay",
    summary: "Marca a mano ENCIMA de lo que hay en pantalla: círculo, subrayado, flecha, caja o tachado, en lima, sobre una zona del cuadro de contenido; texto manuscrito opcional al lado.",
    example: { kind: "circle", x: 0.2, y: 0.3, w: 0.6, h: 0.3, note: "¡aquí!" },
    params: {
      kind: { type: "enum", options: ["circle", "underline", "arrow", "box", "cross"], default: "circle", doc: "Tipo de marca." },
      x: { type: "number", default: 0.2, doc: "Zona: x (fracción del contenido)." },
      y: { type: "number", default: 0.35, doc: "Zona: y." },
      w: { type: "number", default: 0.6, doc: "Zona: ancho." },
      h: { type: "number", default: 0.3, doc: "Zona: alto." },
      note: { type: "string", default: "", doc: "Texto manuscrito junto a la marca." },
      drawSec: { type: "number", default: 0.6, doc: "Segundos de trazo." },
    },
    create(ctx, p) {
      const P = pal(ctx), g = R.root(ctx), c = ctx.stage.content, u = ctx.stage.u;
      const bx = { x: c.x + p.x * c.w, y: c.y + p.y * c.h, w: p.w * c.w, h: p.h * c.h };
      let els;
      if (p.kind === "circle" || p.kind === "underline") els = R.sketch(ctx, g, p.kind, bx, { color: P.accent, width: 1.6, seed: 31 });
      else if (p.kind === "arrow") els = R.sketch(ctx, g, "arrow", bx, { color: P.accent, width: 1.6, seed: 32 });
      else if (p.kind === "box") els = R.shape(ctx, g, (G, o) => [G.rectangle(bx.x, bx.y, bx.w, bx.h, o)], { color: P.accent, width: 1.6, seed: 33 });
      else els = R.shape(ctx, g, (G, o) => [G.line(bx.x, bx.y, bx.x + bx.w, bx.y + bx.h, o), G.line(bx.x + bx.w, bx.y, bx.x, bx.y + bx.h, { ...o, seed: 9 })], { color: P.accent, width: 2, seed: 34 });
      const note = p.note ? R.hand(ctx, g, "", { x: bx.x + bx.w / 2, y: bx.y + bx.h + u * 4, size: 4.2, color: P.accent }) : null;
      return {
        render(lt, b, t) {
          R.draw(els, lt, { start: 0, dur: p.drawSec, total: p.drawSec * 0.4, ease: "out", t });
          if (note) R.type(note, p.note, prog(lt, p.drawSec * 0.8, 0.5, "linear"));
          if (lt > b.dur) R.exitFx(g, ctx, lt, b, 0.3);
        },
        dispose() { g.remove(); },
      };
    },
  });
})();
