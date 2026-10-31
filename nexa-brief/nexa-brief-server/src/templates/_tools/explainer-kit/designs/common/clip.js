/* =============================================================================
   common · clip de video (unos segundos de metraje real en lugar de una foto)
   -----------------------------------------------------------------------------
   Sirve para TODOS los diseños: el tratamiento de color sale del diseño
   (design.json → defaults.clip), no del componente:

     "clip": { "filter": "grayscale(1) contrast(1.35)",   // filtro CSS de canvas (ctx.filter)
               "frame":  "palette.ink",                    // color del marco (layout "frame")
               "dim":    0.18,                             // oscurecido base a pantalla completa
               "layout": "frame",                          // layout por defecto del diseño (si el beat no lo fija)
               "size":   0.92 }                            // tamaño por defecto del marco
   y la duración mínima del clip en pantalla: design.json → defaults.minDur {"common.clip": 8}
   (el motor alarga el beat y corre los siguientes; ver resolveBeats en engine/kit.js).

   El clip es un .mp4 mudo y corto en assets/media/ que baja y prepara tools/media.py
   (`get <video> pexels-video:123 nombre.mp4 --start 4 --dur 15`): recorte, 30 fps y un
   keyframe cada 6 cuadros, para que el salto al cuadro exacto del render sea rápido.
   El motor (Kit.boot → ctx.clip) lo lleva al segundo pedido y espera el `seeked` antes de
   cada captura: cada cuadro sigue siendo función pura del tiempo (determinista).
   ========================================================================== */
(function () {
  "use strict";
  const K = window.Kit, { clamp, prog } = K;

  /** recorte "cover" con foco y zoom (mismo encuadre que las fotos de Kit.hook) */
  function cover(G, src, x, y, w, h, focus, zoom) {
    const iw = src.width, ih = src.height;
    if (!iw || !ih) return;
    const ar = w / h;
    let sw = iw, sh = iw / ar; if (sh > ih) { sh = ih; sw = ih * ar; }
    sw /= zoom; sh /= zoom;
    const sx = clamp(focus[0] * iw - sw / 2, 0, iw - sw), sy = clamp(focus[1] * ih - sh / 2, 0, ih - sh);
    G.drawImage(src, sx, sy, sw, sh, x, y, w, h);
  }

  K.register({
    name: "common.clip", tags: ["video", "clip", "metraje", "foto", "lugar", "máquina"], layer: "main",
    summary: "Clip de video real de unos segundos (mudo) en vez de una foto: a pantalla completa con empuje lento, o dentro de un marco. Toma el tratamiento de color del diseño (design.json → defaults.clip); rótulo opcional abajo.",
    example: { src: "assets/media/servidores.mp4", caption: "Un centro de datos", sub: "PEXELS · 2026" },
    params: {
      src: { type: "video", required: true, doc: "Clip .mp4 de assets/media/ (preparado con tools/media.py get … nombre.mp4)." },
      start: { type: "number", default: 0, min: 0, doc: "Segundo del clip desde el que arranca." },
      rate: { type: "number", default: 1, min: 0.25, max: 2, doc: "Velocidad (0.5 = cámara lenta). El clip debe durar start + duración del beat × rate." },
      loop: { type: "bool", default: true, doc: "Repite el clip si es más corto que el beat; evita congelar el último cuadro." },
      layout: { type: "enum", options: ["auto", "full", "frame"], default: "auto", doc: "auto = el del diseño (defaults.clip.layout; si no hay, full); full = pantalla completa; frame = dentro de un marco centrado. Dejarlo en auto." },
      size: { type: "number", default: 0, min: 0, max: 1, doc: "layout frame: fracción del contenido que ocupa; 0 = la del diseño (defaults.clip.size; si no hay, 0.84)." },
      ar: { type: "number", default: 0, doc: "layout frame: proporción del recorte (0 = la del clip; en 9:16 conviene 0.8)." },
      focus: { type: "array", default: [0.5, 0.5], doc: "Punto de interés [x,y] (0..1): hacia donde se acerca el zoom y qué se conserva al recortar." },
      zoom: { type: "number", default: 0.06, min: 0, max: 0.3, doc: "Cuánto se acerca a lo largo del beat (empuje lento)." },
      tone: { type: "enum", options: ["design", "color"], default: "design", doc: "design = filtro del diseño (defaults.clip.filter); color = el clip tal cual." },
      dim: { type: "number", default: -1, min: -1, max: 1, doc: "Oscurecido (para leer los subtítulos); -1 = el del diseño." },
      caption: { type: "string", default: "", doc: "Rótulo (qué se ve); vacío = sin rótulo." },
      sub: { type: "string", default: "", doc: "Línea chica bajo el rótulo (fuente, lugar, año)." },
      ...K.brandLogo.params,
    },
    create(ctx, p) {
      const C = ctx.C, T = C.clip || {}, pal = C.palette;
      const filter = p.tone === "design" ? (T.filter || "none") : "none";
      const color = v => (typeof v === "string" && v.startsWith("palette.") ? pal[v.slice(8)] : v) || pal.ink;
      const frameColor = color(T.frame || "palette.ink");
      const font = C.fonts?.main || "Inter";
      /* auto = lo que dice el diseño: así un cambio de criterio se hace en design.json, no en cada video */
      p = { ...p, layout: p.layout === "auto" || !p.layout ? (T.layout || "full") : p.layout, size: p.size || T.size || 0.84 };
      let logo = null;
      return {
        render(lt, b) {
          const G = ctx.g.main, st = ctx.stage, { W, H, u, portrait } = st;
          const dur = Math.max(b.dur || 0, 0.5);
          const time = p.start + lt * p.rate;
          let v = ctx.clip(p.src, time);
          if (p.loop && v && Number.isFinite(v.duration) && v.duration > 0 && time >= v.duration)
            v = ctx.clip(p.src, time % v.duration);
          const a = clamp(lt / 0.35) * clamp((dur + 0.35 - lt) / 0.35);
          if (a <= 0) return;
          const z = 1 + p.zoom * clamp(lt / dur);
          G.save(); G.globalAlpha *= a;
          let frameBottom = (H + H * 0.62) / 2;   /* borde inferior del marco: el rótulo va debajo */
          if (p.layout === "full") {
            G.fillStyle = pal.bg; G.fillRect(0, 0, W, H);
            if (v) { G.filter = filter; cover(G, v, -u, -u, W + 2 * u, H + 2 * u, p.focus, z); G.filter = "none"; }
            const dim = p.dim >= 0 ? p.dim : (T.dim ?? 0.18);
            if (dim > 0) { G.fillStyle = `rgba(0,0,0,${dim})`; G.fillRect(0, 0, W, H); }
            if (!logo) logo = K.brandLogo.attach(ctx, p, { x: 0, y: 0, w: W, h: H }, p.focus);
          } else {
            const cw = (portrait ? W * 0.9 : W * 0.78) * p.size;
            const ar = p.ar || (v && v.height ? clamp(v.width / v.height, 0.6, 1.9) : 16 / 9);
            const w = Math.min(cw, H * 0.62 * ar), h = w / ar, x = (W - w) / 2, y = (H - h) / 2 - u * 3;
            const e = prog(lt, 0, 0.6, "out");
            G.translate(W / 2, y + h / 2); G.scale(0.96 + 0.04 * e, 0.96 + 0.04 * e); G.translate(-W / 2, -(y + h / 2));
            G.fillStyle = pal.bg2 || pal.bg; G.fillRect(x, y, w, h);
            if (v) { G.save(); G.beginPath(); G.rect(x, y, w, h); G.clip(); G.filter = filter; cover(G, v, x, y, w, h, p.focus, z); G.restore(); }
            G.strokeStyle = frameColor; G.lineWidth = Math.max(2, u * 0.35); G.strokeRect(x, y, w, h);
            frameBottom = y + h;
            if (!logo) logo = K.brandLogo.attach(ctx, p, { x, y, w, h }, p.focus);
          }
          if (p.caption) {
            const ty = p.layout === "full" ? H - st.caption.h - u * (portrait ? 14 : 10) : frameBottom + u * (portrait ? 6 : 5);
            const tx = p.layout === "full" ? u * 6 : W / 2, align = p.layout === "full" ? "left" : "center";
            const ca = prog(lt, 0.5, 0.5);
            G.globalAlpha = a * ca; G.textAlign = align; G.textBaseline = "alphabetic";
            G.fillStyle = pal.ink; G.font = `800 ${u * (portrait ? 4.2 : 3.6)}px ${font}`;
            G.shadowColor = "rgba(0,0,0,.6)"; G.shadowBlur = u;
            G.fillText(p.caption, tx, ty);
            if (p.sub) { G.fillStyle = pal.muted || pal.ink; G.font = `600 ${u * (portrait ? 1.8 : 1.5)}px 'JetBrains Mono', monospace`; G.fillText(p.sub, tx, ty + u * (portrait ? 4 : 3.4)); }
          }
          G.restore();
          if (logo) logo.render(lt);
        },
        dispose() { if (logo) logo.dispose(); },
      };
    },
  });
})();
