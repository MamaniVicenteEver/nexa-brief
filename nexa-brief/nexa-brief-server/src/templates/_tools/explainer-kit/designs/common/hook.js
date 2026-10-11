/* =============================================================================
   common · contrato de las intros (gancho) y del cierre de canal
   -----------------------------------------------------------------------------
   Todos los diseños registran <familia>.introv1, <familia>.introv2 y
   <familia>.outro con los MISMOS parámetros de fondo y de tiempos, para que el
   storyboard de cualquier video funcione igual con cualquier diseño:

     bg        "auto" (fondo propio del diseño) | uno de sus presets |
               "image" (foto en src) | "component" (otro componente) | "none"
     src       foto de fondo (se precarga; encuadre cover con zoom lento)
     focus     [x,y] punto de interés de la foto
     use       componente de fondo (bg="component"), p. ej. "enmienda.map"
     useParams parámetros de ese componente
     dim       oscurecido del fondo foto/componente para que se lea el texto

   Kit.hook.bg(ctx, p, { presets, auto, tone }) → { render(lt, b, t), dispose() }
     presets: { nombre: (G, stage, lt, b) => dibuja }   (fondos propios)
     tone(img) → canvas tratado (B/N, sepia, duotono…) para bg="image"
   Kit.hook.outroTimes(p, dur) → tiempos del cierre (comprimidos si dura poco)
   ========================================================================== */
(function () {
  "use strict";
  const K = window.Kit, { clamp, prog } = K;

  /** parámetros de fondo; presets = nombres de fondos propios del diseño */
  function bgParams(presets = [], def = "auto") {
    return {
      bg: { type: "enum", options: ["auto", ...presets, "image", "component", "none"], default: def,
            doc: `Fondo: auto = el del diseño${presets.length ? "; presets: " + presets.join(", ") : ""}; image = foto en src; component = otro componente (use/useParams); none = liso.` },
      src: { type: "image", default: "", doc: "Foto de fondo (bg=image o para el componente de fondo): encuadre cover con zoom lento y el tratamiento de color del diseño." },
      focus: { type: "array", default: [0.5, 0.5], doc: "Punto de interés de la foto [x,y] (0..1)." },
      use: { type: "string", default: "", doc: "Componente de fondo (bg=component), p. ej. 'enmienda.map'." },
      useParams: { type: "object", default: {}, doc: "Parámetros del componente de fondo (si no trae foto, recibe src)." },
      dim: { type: "number", default: 0.45, min: 0, max: 1, doc: "Oscurecido del fondo foto/componente (0 = nada)." },
    };
  }

  /** parámetros del cierre de canal (mismos nombres y semántica en todos los diseños) */
  function outroParams(o = {}) {
    return {
      thanks: { type: "string", default: o.thanks ?? "GRACIAS POR VER", doc: "Rótulo inicial." },
      channel: { type: "string", default: o.channel ?? "NODETECH", doc: "Nombre del canal (grande)." },
      cta: { type: "string", default: o.cta ?? "SUSCRÍBETE", doc: "Texto del botón de suscripción." },
      support: { type: "string", default: o.support ?? "Apoya el canal y comparte el video.", doc: "Mensaje de apoyo." },
      handle: { type: "string", default: o.handle ?? "youtube.com/@nodetech", doc: "Dirección del canal (sin '@' al principio: el motor toma '@x' como ancla)." },
      arrow: { type: "bool", default: true, doc: "Flecha del LIKE a SUSCRÍBETE." },
      likeAt: { type: "number", default: 1, min: 0, doc: "Segundo del LIKE." },
      subscribeAt: { type: "number", default: 2.5, min: 0, doc: "Segundo de SUSCRÍBETE." },
      bellAt: { type: "number", default: 3.25, min: 0, doc: "Segundo de la campana." },
      supportAt: { type: "number", default: 3.65, min: 0, doc: "Segundo del mensaje de apoyo y la dirección." },
    };
  }
  /** tiempos efectivos del cierre: si dura poco se comprimen, y nunca se pisan */
  function outroTimes(p, dur) {
    const sc = Math.min(1, Math.max(0.3, (dur - 0.35) / 4.65));
    const likeAt = p.likeAt * sc, subAt = Math.max(p.subscribeAt * sc, likeAt + 0.25), bellAt = Math.max(p.bellAt * sc, subAt + 0.3), supAt = Math.max(p.supportAt * sc, bellAt + 0.25);
    return { likeAt, subAt, bellAt, supAt };
  }

  /** foto "cover" con foco y zoom */
  function cover(G, src, x, y, w, h, focus = [0.5, 0.5], zoom = 1) {
    const iw = src.width, ih = src.height, ar = w / h;
    let sw = iw, sh = iw / ar; if (sh > ih) { sh = ih; sw = ih * ar; }
    sw /= zoom; sh /= zoom;
    const sx = clamp(focus[0] * iw - sw / 2, 0, iw - sw), sy = clamp(focus[1] * ih - sh / 2, 0, ih - sh);
    G.drawImage(src, sx, sy, sw, sh, x, y, w, h);
  }

  /** fondo intercambiable de intros y cierre */
  function bg(ctx, p, o = {}) {
    const presets = o.presets || {}, autoName = o.auto || Object.keys(presets)[0];
    let mode = p.bg || "auto";
    if (mode === "auto") mode = autoName || "none";
    if (mode === "image" && !p.src) { console.warn("[hook] bg=image sin src: uso el fondo del diseño"); mode = autoName || "none"; }
    let inst = null;
    if (mode === "component") {
      const def = K.registry.get(p.use);
      if (!def) { console.warn("[hook] componente de fondo desconocido:", p.use); mode = autoName || "none"; }
      else {
        const raw = { ...(p.useParams || {}) };
        /* si el componente de fondo usa foto y no se le pasó, recibe src */
        const imgKey = Object.entries(def.params).find(([, s]) => s.type === "image")?.[0];
        if (imgKey && raw[imgKey] == null && p.src) raw[imgKey] = p.src;
        for (const [k, s] of Object.entries(def.params))
          if (s.type === "image" && raw[k] && !K.loaded.has(raw[k])) K.image(raw[k]).then(im => im && K.loaded.set(raw[k], im));
        const pp = K.resolveParams(def, raw, ctx.C);
        try { inst = def.create({ ...ctx, beat: { ...ctx.beat }, rng: K.rng(K.hash("bg:" + p.use)) }, pp) || {}; }
        catch (e) { console.error("[hook] falló el componente de fondo", p.use, e); mode = autoName || "none"; }
      }
    }
    const dimLayer = (G, st, a) => {
      if (a <= 0) return;
      G.fillStyle = `rgba(0,0,0,${a})`; G.fillRect(0, 0, st.W, st.H);
    };
    return {
      mode,
      render(lt, b, t) {
        const G = ctx.g.main, st = ctx.stage;
        if (mode === "none") { G.fillStyle = ctx.C.palette.bg; G.fillRect(0, 0, st.W, st.H); return; }
        if (presets[mode]) { presets[mode](G, st, lt, b); return; }
        if (mode === "image") {
          const img = ctx.img(p.src); G.fillStyle = ctx.C.palette.bg; G.fillRect(0, 0, st.W, st.H);
          if (!img) return;
          const src = o.tone ? o.tone(img) || img : img;
          const z = 1.06 + 0.1 * clamp(lt / Math.max(4, b.dur)), dx = Math.sin(lt * 0.3) * st.u * 0.6;
          G.save(); G.globalAlpha *= clamp(lt / 0.5); cover(G, src, dx - st.u, -st.u, st.W + st.u * 2, st.H + st.u * 2, p.focus || [0.5, 0.5], z); G.restore();
          dimLayer(G, st, p.dim ?? 0.45);
          return;
        }
        if (mode === "component" && inst) {
          try { inst.render && inst.render(lt, b, t); } catch (e) { console.error("[hook] render fondo", e); }
          dimLayer(G, st, p.dim ?? 0.45);
        }
      },
      dispose() { try { inst && inst.dispose && inst.dispose(); } catch (e) {} },
    };
  }

  K.hook = { bgParams, outroParams, outroTimes, bg, cover };
})();
