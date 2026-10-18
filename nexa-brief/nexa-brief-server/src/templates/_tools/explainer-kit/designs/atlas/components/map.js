/* =============================================================================
   atlas · componentes de MAPA (la cámara y lo que se pinta vive en el runtime)
   atlas.world   cámara a una región / varios países (+ pintar en gris o blanco)
   atlas.country país que se enciende con parpadeo + alfiler que cae + etiqueta
   atlas.route   recorrido país por país (el montaje de la referencia)
   atlas.border  línea dibujándose sobre el mapa: muro, frontera o ruta
   Cada def trae world(p, b, A, st) → eventos para la línea de tiempo del mapa.
   ========================================================================== */
(function () {
  const K = Kit, A = Kit.atlas, { clamp, prog } = K;

  /** rótulo de cabecera (lugar · fecha): Archivo extendida en mayúsculas con barrita cian */
  function kicker(ctx, text, a, o = {}) {
    if (!text || a <= 0) return;
    const G = ctx.g.main, { W, u, portrait } = ctx.stage, c = ctx.stage.content, P = ctx.C.palette;
    const px = u * (portrait ? 2.5 : 1.9), s = String(text).toUpperCase();
    G.save(); G.globalAlpha *= a; G.font = A.font("ui", px, 800); G.letterSpacing = px * 0.16 + "px"; G.textBaseline = "middle";
    const tw = G.measureText(s).width, y = o.y ?? (portrait ? c.y - u * 1 : c.y + u * 0.5);
    const x = portrait ? W / 2 - tw / 2 + px * 0.6 : c.x - W * 0.04 + px * 0.9;
    G.shadowColor = "rgba(0,0,0,.9)"; G.shadowBlur = px * 0.8; G.fillStyle = P.ink; G.fillText(s, x, y);
    G.shadowColor = "transparent"; G.fillStyle = P.accent; G.fillRect(x - px * 0.95, y - px * 0.42, px * 0.32, px * 0.84);
    G.restore();
  }
  A.kicker = kicker;
  const lst = v => (Array.isArray(v) ? v : v ? [v] : []);
  const stateM = s => (s === "gray" ? 0.36 : s === "base" ? 0 : 1);

  /* ================================================================ world */
  K.register({
    name: "atlas.world", tags: ["mapa", "región", "contexto", "cámara", "continente"], layer: "main", mapDim: 0,
    summary: "Cámara del mapamundi 2.5D que viaja (zoom + paneo suave) a una región, a varios países o a un punto; opcionalmente pinta países en gris o blanco con parpadeo. Para situar la historia: 'todo empezó en Europa del Este', 'el bloque soviético'.",
    example: { region: "europe", paint: ["Germany", "Poland", "Czechia", "Hungary"], state: "gray", kicker: "Europa · 1989" },
    params: {
      region: { type: "enum", options: Object.keys(A.REGIONS), default: "world", doc: "Región con nombre (si no hay countries ni center)." },
      countries: { type: "array", default: [], doc: "Países (inglés, p. ej. 'Germany') que la cámara encuadra juntos." },
      center: { type: "array", default: [], doc: "[lon,lat] centro de la cámara (con span)." },
      span: { type: "number", default: 0, min: 0, doc: "Ancho visible en grados de longitud (con center)." },
      zoom: { type: "number", default: 1, min: 0.2, max: 6, doc: "Multiplica el zoom calculado." },
      paint: { type: "array", default: [], doc: "Países que se pintan (con parpadeo escalonado)." },
      state: { type: "enum", options: ["white", "gray"], default: "gray", doc: "Color de los países pintados." },
      paintAt: { type: "number", default: 0.7, min: 0, doc: "Segundo en que empieza a pintar (acepta '@palabra')." },
      stagger: { type: "number", default: 0.12, min: 0, doc: "Segundos entre país y país al pintar." },
      clear: { type: "bool", default: false, doc: "Borra lo pintado y los alfileres anteriores (empezar un capítulo nuevo)." },
      move: { type: "number", default: 0, min: 0, doc: "Segundos del viaje de cámara (0 = automático según distancia)." },
      pins: { type: "array", default: [], doc: "Alfileres chicos sin etiqueta: [[lon,lat], …] o nombres de país (caen escalonados desde paintAt)." },
      kicker: { type: "string", default: "", doc: "Rótulo chico de cabecera (lugar · fecha)." },
    },
    world(p, b) {
      const ev = [];
      lst(p.pins).forEach((q, i) => { const c = typeof q === "string" ? A.country(q) : null, xy = Array.isArray(q) && q.length === 2 ? A.toBase(q) : c ? c.xy : null; if (xy) ev.push({ at: p.paintAt + 0.1 + i * Math.max(0.12, p.stagger), pin: { xy, quiet: true } }); });
      if (p.clear) ev.push({ at: 0, clear: true });
      ev.push({ at: 0, cam: { pose: A.camFor({ region: p.region, countries: p.countries, center: p.center?.length === 2 ? p.center : null, span: p.span, zoom: p.zoom }), dur: p.move || "auto", push: 0.014 } });
      lst(p.paint).forEach((n, i) => { const c = A.country(n); if (c) ev.push({ at: p.paintAt + i * p.stagger, paint: { c, m: stateM(p.state) } }); });
      return ev;
    },
    create(ctx, p) {
      return { render(lt, b) { kicker(ctx, p.kicker, prog(lt, 0.3, 0.4, "linear") * A.outA(lt, b, 0.4)); } };
    },
  });

  /* ================================================================ country */
  K.register({
    name: "atlas.country", tags: ["país", "lugar", "alfiler", "mapa", "ciudad"], layer: "main", mapDim: 0,
    summary: "LA escena de la referencia: la cámara viaja al país, el país se enciende en blanco con un parpadeo de 8 cuadros (o pasa por gris medio y después blanco), cae un alfiler negro tipo gota con rebote y la etiqueta sale de atrás del alfiler. El alfiler anterior queda chico. Para nombrar un país o una ciudad (pin=[lon,lat]).",
    example: { country: "Germany", label: "Alemania", sub: "1989", pin: [13.4, 52.52] },
    params: {
      country: { type: "string", required: true, doc: "País (properties.name en inglés: 'Germany', 'United States of America'; acepta alias 'USA' y el nombre en español)." },
      label: { type: "string", default: "", doc: "Etiqueta (vacío = nombre en español del país; '-' = sin etiqueta)." },
      sub: { type: "string", default: "", doc: "Línea chica debajo de la etiqueta (año, ciudad, dato corto)." },
      pin: { type: "array", default: [], doc: "[lon,lat] del alfiler (ciudad); vacío = centro del país." },
      src: { type: "image", default: "", doc: "Foto dentro del sello del alfiler (B/N contrastado)." },
      focus: { type: "array", default: [0.5, 0.5], doc: "Punto de interés de la foto [x,y] (0..1)." },
      seal: { type: "enum", options: ["globe", "initials", "none"], default: "initials", doc: "Sello del alfiler si no hay foto: emblema B/N (globe), emblema con iniciales o liso." },
      state: { type: "enum", options: ["white", "gray", "both", "none"], default: "white", doc: "Pintado: blanco, gris medio, gris y después blanco (both, en whiteAt) o sin pintar." },
      whiteAt: { type: "number", default: 1.6, min: 0, doc: "Con state=both: segundo en que pasa de gris a blanco (acepta '@palabra')." },
      span: { type: "number", default: 0, min: 0, doc: "Ancho visible en grados (0 = automático, ~34° o 2,3× el país). Ciudad: 6–10." },
      zoom: { type: "number", default: 1, min: 0.2, max: 6, doc: "Multiplica el zoom." },
      move: { type: "number", default: 0.75, min: 0.2, max: 3, doc: "Segundos del viaje de cámara." },
      pinAt: { type: "number", default: -1, doc: "Segundo en que cae el alfiler (-1 = al llegar la cámara)." },
      side: { type: "enum", options: ["auto", "left", "right"], default: "auto", doc: "Lado de la etiqueta." },
    },
    world(p, b) {
      const c = A.country(p.country); if (!c) return [];
      const xy = p.pin?.length === 2 ? A.toBase(p.pin) : c.xy;
      const at = p.pinAt >= 0 ? p.pinAt : p.move * 0.85;
      const lab = p.label === "-" ? "" : p.label || c.es;
      const ev = [{ at: 0, cam: { pose: A.camFor({ country: p.country, pin: p.pin?.length === 2 ? p.pin : null, span: p.span || null, zoom: p.zoom }), dur: p.move, push: 0.012 } }];
      if (p.state === "white" || p.state === "gray") ev.push({ at: at - 0.04, paint: { c, m: stateM(p.state) } });
      if (p.state === "both") { ev.push({ at: at - 0.04, paint: { c, m: 0.36 } }); ev.push({ at: Math.max(at + 0.4, p.whiteAt), paint: { c, m: 1 } }); }
      ev.push({ at, pin: { xy, label: lab, sub: p.sub, src: p.src || null, focus: p.focus, seal: p.seal, initials: lab.replace(/[^A-ZÁÉÍÓÚÑ]/gi, "").slice(0, 2).toUpperCase(), side: p.side } });
      return ev;
    },
    create() { return { render() {} }; },
  });

  /* ================================================================ route */
  K.register({
    name: "atlas.route", tags: ["recorrido", "lista", "países", "montaje", "expansión", "contagio"], layer: "main", mapDim: 0,
    summary: "Montaje de la referencia: la cámara salta país por país (≈1 s cada uno), cada país se enciende en blanco, cae su alfiler y su etiqueta; los anteriores quedan chicos. Con line=true une los alfileres con una ruta punteada que avanza. Para listas de países, rutas de escape, expansión de un bloque, giras, contagios.",
    example: { items: ["Hungary", "Austria", "Czechia", "Germany"], stagger: 1.0, line: true },
    params: {
      items: { type: "array", required: true, doc: "Países en orden: 'Hungary' o { country, label, sub, pin:[lon,lat], state:'white|gray', at } (at = segundos desde el inicio del beat)." },
      stagger: { type: "number", default: 1.0, min: 0.3, doc: "Segundos entre país y país (si el item no trae at)." },
      first: { type: "number", default: 0.55, min: 0, doc: "Segundo del primer país." },
      camera: { type: "enum", options: ["follow", "fit"], default: "follow", doc: "follow = viaja a cada país (referencia); fit = encuadra todos de una vez." },
      line: { type: "bool", default: false, doc: "Ruta punteada blanca que une los alfileres." },
      span: { type: "number", default: 0, min: 0, doc: "Ancho visible en grados en follow (0 = automático)." },
      zoom: { type: "number", default: 1, min: 0.2, max: 6, doc: "Multiplica el zoom." },
      state: { type: "enum", options: ["white", "gray"], default: "white", doc: "Color por defecto de los países." },
      clear: { type: "bool", default: false, doc: "Borra lo pintado antes." },
      kicker: { type: "string", default: "", doc: "Rótulo chico de cabecera." },
    },
    world(p, b) {
      const items = lst(p.items).map(x => (typeof x === "string" ? { country: x } : x || {})).map((x, i) => ({ ...x, c: A.country(x.country), t: x.at != null ? +x.at : p.first + i * p.stagger })).filter(x => x.c);
      const ev = [];
      if (p.clear) ev.push({ at: 0, clear: true });
      if (p.camera === "fit") ev.push({ at: 0, cam: { pose: A.camFor({ countries: items.map(x => x.country), zoom: p.zoom }), dur: "auto", push: 0.012 } });
      const pts = [];
      items.forEach((x, i) => {
        const xy = x.pin?.length === 2 ? A.toBase(x.pin) : x.c.xy; pts.push(xy);
        const gap = i ? x.t - items[i - 1].t : 1, mv = Math.max(0.25, Math.min(0.6, gap * 0.45));
        if (p.camera === "follow") ev.push({ at: Math.max(0, x.t - mv), cam: { pose: A.camFor({ country: x.country, pin: x.pin?.length === 2 ? x.pin : null, span: p.span || null, zoom: p.zoom }), dur: mv, push: 0.01, ...(i === 0 ? {} : {}) } });
        ev.push({ at: x.t - 0.04, paint: { c: x.c, m: stateM(x.state || p.state) } });
        const lab = x.label === "-" ? "" : x.label || x.c.es;
        ev.push({ at: x.t, pin: { xy, label: lab, sub: x.sub || "", side: x.side || "auto" } });
      });
      if (p.line && pts.length > 1) ev.push({ at: items[0].t + 0.2, line: { pts, style: "route", dur: Math.max(0.6, items[items.length - 1].t - items[0].t), width: 0.9 } });
      return ev;
    },
    create(ctx, p) { return { render(lt, b) { kicker(ctx, p.kicker, prog(lt, 0.2, 0.4, "linear") * A.outA(lt, b, 0.4)); } }; },
  });

  /* ================================================================ border */
  K.register({
    name: "atlas.border", tags: ["frontera", "muro", "división", "partición", "ruta", "línea"], layer: "main", mapDim: 0,
    summary: "Una línea que se dibuja sobre el mapa: MURO (negro grueso con canto cian que brilla), frontera punteada o ruta con flecha. Rótulos a cada lado (ESTE / OESTE) que entran deslizando. Para fronteras, muros, particiones, líneas de frente, rutas migratorias.",
    example: { line: [[10.9, 54.0], [10.75, 53.6], [10.6, 53.37], [11.5, 53.05], [10.95, 52.55], [11.0, 52.2], [10.6, 51.75], [10.25, 51.45], [10.0, 50.95], [10.1, 50.55], [10.9, 50.33], [11.9, 50.32], [12.1, 50.3]], style: "wall", tags: [{ text: "OESTE", at: [8.4, 51.6] }, { text: "ESTE", at: [12.9, 51.9] }], countries: ["Germany"], paint: ["Germany"], state: "gray", kicker: "Alemania · 1949–1990" },
    params: {
      line: { type: "array", required: true, doc: "Puntos [[lon,lat], …] de la línea, en orden." },
      style: { type: "enum", options: ["wall", "border", "route"], default: "wall", doc: "wall = muro negro con canto cian · border = punteada negra · route = blanca punteada con flecha." },
      drawAt: { type: "number", default: 0.5, min: 0, doc: "Segundo en que empieza a dibujarse." },
      drawSec: { type: "number", default: 1.6, min: 0.2, doc: "Segundos que tarda en dibujarse." },
      width: { type: "number", default: 1, min: 0.3, max: 4, doc: "Grosor (×)." },
      tags: { type: "array", default: [], doc: "Rótulos sobre el mapa: [{ text, at:[lon,lat], dark? }] (blancos con sombra; dark = negros con halo, sobre países blancos)." },
      countries: { type: "array", default: [], doc: "Países que encuadra la cámara (si no, encuadra la línea)." },
      center: { type: "array", default: [], doc: "[lon,lat] centro de la cámara (con span)." },
      span: { type: "number", default: 0, min: 0, doc: "Ancho visible en grados (con center)." },
      zoom: { type: "number", default: 1, min: 0.2, max: 6, doc: "Multiplica el zoom." },
      paint: { type: "array", default: [], doc: "Países que se pintan." },
      state: { type: "enum", options: ["white", "gray"], default: "white", doc: "Color de los países pintados." },
      keep: { type: "bool", default: true, doc: "La línea queda en el mapa después del beat (false = se apaga al salir)." },
      kicker: { type: "string", default: "", doc: "Rótulo chico de cabecera." },
    },
    world(p, b) {
      const pts = lst(p.line).filter(q => Array.isArray(q) && q.length === 2), xy = pts.map(A.toBase), ev = [];
      if (!xy.length) return ev;
      let cam;
      if (p.center?.length === 2 && p.span) cam = A.camFor({ center: p.center, span: p.span, zoom: p.zoom });
      else if (p.countries.length) cam = A.camFor({ countries: p.countries, zoom: p.zoom, pad: 1.2, minSpan: 8 });
      else { const bb = A.union([[xy.reduce((a, q) => [Math.min(a[0], q[0]), Math.min(a[1], q[1])], [1e9, 1e9]), xy.reduce((a, q) => [Math.max(a[0], q[0]), Math.max(a[1], q[1])], [-1e9, -1e9])]]); cam = st => { const pz = A.fitPose(st, bb, 1.8); pz.s *= p.zoom; return pz; }; }
      ev.push({ at: 0, cam: { pose: cam, dur: "auto", push: 0.012 } });
      lst(p.paint).forEach((n, i) => { const c = A.country(n); if (c) ev.push({ at: 0.3 + i * 0.1, paint: { c, m: stateM(p.state) } }); });
      ev.push({ at: p.drawAt, line: { pts: xy, style: p.style, dur: p.drawSec, width: p.width, until: p.keep ? null : b.dur } });
      lst(p.tags).forEach((g, i) => { if (g && g.at?.length === 2) ev.push({ at: p.drawAt + p.drawSec * 0.55 + i * 0.18, tag: { xy: A.toBase(g.at), text: String(g.text || ""), color: g.dark ? "dark" : "", until: p.keep ? null : b.dur } }); });
      return ev;
    },
    create(ctx, p) { return { render(lt, b) { kicker(ctx, p.kicker, prog(lt, 0.25, 0.4, "linear") * A.outA(lt, b, 0.4)); } }; },
  });
})();
