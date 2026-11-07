/* =============================================================================
   imperio · campaña y archivo compartidos (extraídos del video de expansión de Japón)
   -----------------------------------------------------------------------------
   Reutilizan el atlas del diseño `imperio` (Kit.imperio: cámara, mapa, sol, rayado).
     imperio.campaign: del sol de Japón salen FLECHAS gruesas hacia cada destino; cuando la voz
                      nombra el destino la flecha llega, el territorio se marca en carmesí y aparece
                      su BANDERA en un círculo con el nombre y el año. Sello del año arriba a la izquierda.
     imperio.footage : plano de archivo con VIDEO mudo (en vez de foto) fundido en multiplicar con el
                      atlas desaturado, como imperio.archive.
   Todo sale de `lt` (tiempo del beat): sin azar ni relojes, igual en vivo, con seek y al grabar.
   Los tiempos de cada destino aceptan "@palabra" (la voz) aunque estén dentro de `targets`.
   ========================================================================== */
(function () {
  "use strict";
  const K = Kit, IM = Kit.imperio, { clamp, lerp, prog } = K;
  const D2R = Math.PI / 180;
  const COL = IM.COL;
  /* colores del diseño imperio (IM.COL), sin escribir ninguno a mano: [color, brillo] o color */
  const PAL = { crim: [COL.ray, 1.3], crimHi: [COL.ray, 1.9], white: COL.title, ink: COL.dark };
  const col = (c, a = 1) => Array.isArray(c) ? IM.tone(c[0], 0, c[1], a) : IM.tone(c, 0, 1, a);
  for (const f of ["400 100px 'Fjalla One'", "800 100px Montserrat", "700 100px Montserrat"]) K.fonts.add(f);

  /* ------------------------------------------------------------ parámetros comunes */
  const camParams = {
    from: { type: "array", default: null, doc: "Cámara inicial [lon, lat, span°, giro°] o \"País*k\". Vacío = donde terminó el plano con mapa anterior." },
    to: { type: "array", default: null, doc: "Cámara final [lon, lat, span°, giro°] o \"País*k\". Vacío = encuadra el sol y todos los destinos." },
    zoom: { type: "number", default: 1.08, min: 0.3, max: 6, doc: "Si no hay `to`: cuánto se aleja la cámara." },
    tilt: { type: "number", default: 0, min: -20, max: 20, doc: "Si no hay `to`: grados que gira el mapa." },
    ease: { type: "enum", options: ["auto", "out", "in", "inOut", "linear", "expo"], default: "expo", doc: "Curva de la cámara. expo = llega rápido y se asienta (los destinos entran ya encuadrados)." },
  };
  const mapParams = {
    country: { type: "string", default: "Japan", doc: "País foco: pone el sol y el rayado." },
    hatch: { type: "array", default: null, doc: "Países ya ocupados (rayado fijo). Va acumulando de plano en plano." },
    sunAt: { type: "array", default: null, doc: "[lon, lat] del sol (vacío = centro del país foco)." },
    sunSize: { type: "number", default: 1.15, min: 0.2, max: 6, doc: "Radio del sol en grados de mapa." },
    labels: { type: "array", default: [], doc: "Rótulos de mares: [{\"t\":\"Mar de\\nChina\", \"at\":[120,20]}]." },
    compass: { type: "bool", default: false, doc: "Rosa de los vientos fina abajo a la derecha." },
    gray: { type: "number", default: 0, min: 0, max: 1, doc: "Desaturación del atlas." },
    enter: { type: "number", default: 0.6, min: 0, max: 2, doc: "Segundos de fundido de entrada sobre el plano anterior." },
  };

  /* ------------------------------------------------------------ geometría de los destinos */
  const meanPt = pts => pts.length ? [pts.reduce((s, q) => s + q[0], 0) / pts.length, pts.reduce((s, q) => s + q[1], 0) / pts.length] : null;
  function centroidOfNames(names) {
    const fs = names.map(n => IM.feature(n)).filter(Boolean).map(IM.mainPart);
    if (!fs.length) return null;
    return fs.length === 1 ? d3.geoCentroid(fs[0]) : d3.geoCentroid({ type: "FeatureCollection", features: fs });
  }
  /** destino del storyboard → { names, poly, dots, within, aim, spot, kind, ... } */
  function parseTarget(x) {
    const t = typeof x === "object" && x && !Array.isArray(x) ? x : { at: x };
    const kind = t.kind || "badge";
    const reg = t.region === undefined ? (typeof t.at === "string" && kind !== "city" ? t.at : null) : t.region;
    let names = [], poly = null, dots = null, within = null;
    if (typeof reg === "string") names = [reg];
    else if (Array.isArray(reg) && reg.length && reg.every(v => typeof v === "string")) names = reg;
    else if (reg && Array.isArray(reg.poly)) { poly = reg.poly; within = reg.within || null; }
    else if (reg && Array.isArray(reg.dots)) dots = reg.dots;
    let region = null;
    if (names.length) region = centroidOfNames(names);
    else if (poly) region = meanPt(poly);
    else if (dots) region = meanPt(dots);
    const aim = Array.isArray(t.at) ? [+t.at[0], +t.at[1]] : (typeof t.at === "string" ? IM.point(t.at) : region);
    const spot = Array.isArray(t.badgeAt) ? [+t.badgeAt[0], +t.badgeAt[1]] : (aim || region);
    return { ...t, kind, names, poly, dots, within, aim, spot };
  }

  /* ------------------------------------------------------------ dibujo: flecha curva con cola que nace del sol */
  function drawArrow(G, st, P0, P2, bow, s, o) {
    const u = st.u, dx = P2[0] - P0[0], dy = P2[1] - P0[1], dist = Math.hypot(dx, dy);
    if (dist < u * 2 || s <= 0.002) return;
    let nx = -dy / dist, ny = dx / dist; if (ny > 0 || (Math.abs(ny) < 1e-3 && nx < 0)) { nx = -nx; ny = -ny; }
    const P1 = [(P0[0] + P2[0]) / 2 + nx * dist * bow, (P0[1] + P2[1]) / 2 + ny * dist * bow];
    const B = t => { const a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t; return [a * P0[0] + b * P1[0] + c * P2[0], a * P0[1] + b * P1[1] + c * P2[1]]; };
    const D = t => { const x = 2 * (1 - t) * (P1[0] - P0[0]) + 2 * t * (P2[0] - P1[0]), y = 2 * (1 - t) * (P1[1] - P0[1]) + 2 * t * (P2[1] - P1[1]), l = Math.hypot(x, y) || 1; return [x / l, y / l]; };
    const len = dist * (1 + bow * bow * 1.4), headL = Math.min(o.head, len * 0.45);
    const sTip = clamp(s), sBody = Math.max(0, sTip - headL / len), N = 40;
    const w0 = o.w0, w1 = o.w1;
    const L = [], R = [];
    for (let k = 0; k <= N; k++) {
      const t = sBody * k / N, p = B(t), d = D(t), hw = lerp(w0, w1, sTip > 0 ? t / sTip : 0) / 2;
      L.push([p[0] - d[1] * hw, p[1] + d[0] * hw]); R.push([p[0] + d[1] * hw, p[1] - d[0] * hw]);
    }
    const tip = B(sTip), dt = D(sTip), base = B(sBody), hh = w1 * 1.35;
    const path = new Path2D();
    path.moveTo(L[0][0], L[0][1]); for (let k = 1; k <= N; k++) path.lineTo(L[k][0], L[k][1]);
    path.lineTo(base[0] - dt[1] * hh, base[1] + dt[0] * hh); path.lineTo(tip[0], tip[1]); path.lineTo(base[0] + dt[1] * hh, base[1] - dt[0] * hh);
    for (let k = N; k >= 0; k--) path.lineTo(R[k][0], R[k][1]);
    path.closePath();
    G.save(); G.globalAlpha = o.alpha;
    const g = G.createLinearGradient(P0[0], P0[1], tip[0], tip[1]);
    g.addColorStop(0, col(PAL.crim, 0.25)); g.addColorStop(0.35, col(PAL.crim, 0.85)); g.addColorStop(1, col(PAL.crimHi, 1));
    G.shadowColor = col(PAL.ink, 0.5); G.shadowBlur = u * 1.1; G.shadowOffsetY = u * 0.25;
    G.fillStyle = g; G.fill(path);
    G.shadowColor = "transparent"; G.shadowBlur = 0; G.shadowOffsetY = 0;
    G.lineJoin = "round"; G.lineWidth = u * 0.2; G.strokeStyle = col(PAL.white, 0.9); G.stroke(path);
    G.restore();
    return tip;
  }

  /* ------------------------------------------------------------ dibujo: rótulos y chapas */
  function pill(G, x, y, w, h, fill) {
    const r = h / 2; G.beginPath(); G.moveTo(x + r, y); G.arcTo(x + w, y, x + w, y + h, r); G.arcTo(x + w, y + h, x, y + h, r); G.arcTo(x, y + h, x, y, r); G.arcTo(x, y, x + w, y, r); G.closePath(); G.fillStyle = fill; G.fill();
  }
  /** chapa centrada en (x,y) con texto; devuelve su ancho */
  function tag(G, text, x, y, fs, o = {}) {
    G.save(); G.font = o.font || IM.wordFont(fs); G.letterSpacing = fs * (o.ls ?? 0.04) + "px"; G.textAlign = "left"; G.textBaseline = "middle";
    const tw = IM.measure(text, G.font, fs * (o.ls ?? 0.04)), padX = fs * 0.55, h = fs * 1.5, w = tw + padX * 2;
    if (o.W) x = clamp(x, w / 2 + fs * 0.8, o.W - w / 2 - fs * 0.8);
    G.globalAlpha = o.alpha ?? 1;
    G.shadowColor = col(PAL.ink, 0.35); G.shadowBlur = fs * 0.5;
    pill(G, x - w / 2, y - h / 2, w, h, o.fill || col(PAL.ink, 0.78));
    G.shadowColor = "transparent"; G.shadowBlur = 0;
    G.fillStyle = o.color || col(PAL.white, 1); G.fillText(text, x - w / 2 + padX, y + fs * 0.04);
    G.restore(); return w;
  }
  /** bandera en círculo con aro blanco (como las referencias); s = escala de entrada */
  function flagBadge(G, img, x, y, R, s, u) {
    if (s <= 0.002) return;
    G.save(); G.translate(x, y); G.scale(s, s); G.globalAlpha = clamp(s * 1.6);
    G.shadowColor = col(PAL.ink, 0.55); G.shadowBlur = u * 1.2; G.shadowOffsetY = u * 0.3;
    G.fillStyle = col(PAL.white, 1); G.beginPath(); G.arc(0, 0, R + u * 0.55, 0, 7); G.fill();
    G.shadowColor = "transparent"; G.shadowBlur = 0; G.shadowOffsetY = 0;
    G.save(); G.beginPath(); G.arc(0, 0, R, 0, 7); G.clip();
    if (img && img.width) {
      const ar = (img.naturalWidth || img.width) / (img.naturalHeight || img.height || 1), h = R * 2, w = h * ar;
      G.drawImage(img, -w / 2, -h / 2, w, h);
    } else { G.fillStyle = col(PAL.crim, 1); G.fillRect(-R, -R, R * 2, R * 2); }
    const gl = G.createLinearGradient(-R, -R, R, R); gl.addColorStop(0, col(PAL.white, 0.22)); gl.addColorStop(0.5, col(PAL.white, 0)); gl.addColorStop(1, col(PAL.ink, 0.2));
    G.fillStyle = gl; G.fillRect(-R, -R, R * 2, R * 2); G.restore();
    G.lineWidth = u * 0.14; G.strokeStyle = col(PAL.ink, 0.55); G.beginPath(); G.arc(0, 0, R + u * 0.55, 0, 7); G.stroke();
    G.restore();
  }
  function ring(G, x, y, r, a, w, col) {
    if (a <= 0.01) return; G.save(); G.globalAlpha = a; G.strokeStyle = col; G.lineWidth = w; G.beginPath(); G.arc(x, y, r, 0, 7); G.stroke(); G.restore();
  }

  function dateStamp(G, st, text, q, o = {}) {
    const { u, portrait, W, H } = st, fs = u * (portrait ? 11 : 10.5) * (o.size ?? 1);
    const x = o.x == null ? u * (portrait ? 6 : 6.5) : W * o.x, y = o.y == null ? u * (portrait ? 7 : 6.2) : H * o.y;
    G.save(); G.globalAlpha = q; G.font = IM.wordFont(fs); G.letterSpacing = fs * 0.03 + "px"; G.textAlign = "left"; G.textBaseline = "top";
    const tw = IM.measure(text, G.font, fs * 0.03), dy = (1 - q) * fs * 0.35;
    G.shadowColor = col(PAL.ink, 0.55); G.shadowBlur = fs * 0.25; G.fillStyle = col(PAL.white, 1); G.fillText(text, x, y + dy);
    G.shadowColor = "transparent"; G.shadowBlur = 0;
    G.fillStyle = col(PAL.crimHi, 1); G.fillRect(x, y + dy + fs * 1.04, tw * q, Math.max(3, u * 0.75));
    G.restore();
  }
  function archiveCaption(G, st, text, q, o = {}) {
    const { u, portrait } = st, fs = u * (portrait ? 2.5 : 1.9) * (o.size ?? 1);
    G.save(); G.globalAlpha = q * 0.85; G.font = `italic 500 ${fs}px Montserrat`; G.letterSpacing = fs * 0.12 + "px"; G.fillStyle = col(PAL.white, 1);
    G.shadowColor = col(PAL.ink, 0.7); G.shadowBlur = fs * 0.5; G.textBaseline = "alphabetic";
    G.fillText(text, o.x == null ? u * (portrait ? 6 : 5) : st.W * o.x, o.y == null ? st.caption.y - u * (portrait ? 5 : 3) : st.H * o.y); G.restore();
  }

  /* ============================================================ campaña: UN plano continuo de mapa */
  const flagKeys = ["f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8", "f9", "f10", "f11", "f12"];
  const flagParams = {}; flagKeys.forEach(k => { flagParams[k] = { type: "image", default: "", doc: `Bandera ${k} (SVG/PNG de assets/flags). Un destino la usa con "flag": "${k}".` }; });
  const vidKeys = ["v1", "v2", "v3", "v4"];
  const vidParams = {}; vidKeys.forEach(k => { vidParams[k] = { type: "video", default: "", doc: `Clip mudo ${k} (assets/media). Un tramo de archivo lo usa con "video": "${k}".` }; });
  const photoParams = {}; ["p1", "p2"].forEach(k => { photoParams[k] = { type: "image", default: "", doc: `Fotografía o fotograma ${k} (assets/media). Un tramo ilustrativo lo usa con "image": "${k}" durante 6–12 s.` }; });

  /** países del rayado fijo (país foco + `hatch` + `held`): parte de la llave del atlas */
  const bakedOf = p => [...(Array.isArray(p.hatch) ? p.hatch : (p.country ? [p.country] : [])), ...(p.held || []).flatMap(h => parseTarget({ region: h }).names)];
  const placeOf = (v, sun) => v === "sun" ? sun : Array.isArray(v) ? [+v[0], +v[1]] : IM.point(v);
  /** cámaras del storyboard → [{ key, cam }] (focus = lugares a encuadrar con margen k; o to = cámara explícita) */
  function camTargets(p, st) {
    const sun = p.sunAt || (p.country ? IM.point(p.country) : null);
    return (p.cameras || []).map(k => {
      let cam = null;
      if (k.to) cam = IM.cam(k.to);
      else { const pts = (k.focus || []).map(v => placeOf(v, sun)).filter(Boolean); cam = pts.length ? IM.fitCam(pts, k.k ?? p.fit, k.tilt || 0, st) : null; }
      return { key: k, cam };
    }).filter(x => x.cam);
  }

  const campaign = {
    name: "imperio.campaign", tags: ["expansión", "flechas", "banderas", "mapa", "invasión", "imperio", "japón", "video"], layer: "main", post: 0.6, opaque: true,
    summary: "Campaña en UN plano continuo: la cámara vuela entre destinos (`cameras`); desde el país foco salen flechas gruesas hacia cada destino y llegan justo cuando la voz lo nombra (`time: \"@palabra\"`). Al llegar, el territorio queda marcado en carmesí y aparece su bandera en un círculo con nombre y año (después se retira; el territorio sigue marcado). Tramos de video y fotos de archivo (`plates`) se funden en blanco y negro con el atlas. Para anexiones, ocupaciones y avances militares a lo largo del tiempo.",
    example: {
      from: [132, 32, 75, 0], to: [132, 32, 75, 0], country: "Japan", hatch: ["Japan"], sunSize: 1.4, f1: "assets/flags/qing.svg", f2: "assets/flags/korean-empire.svg",
      cameras: [],
      targets: [
        { at: "Taiwan", region: "Taiwan", label: "TAIWÁN", year: "1895", flag: "f1", time: 2 },
        { at: [127.8, 36.5], region: ["South Korea", "North Korea"], label: "COREA", year: "1910", flag: "f2", time: 3.2 },
      ],
      labels: [{ t: "Mar de\nChina Oriental", at: [124, 29] }],
    },
    params: {
      ...mapParams,
      parts: { type: "array", default: ["territories", "arrows", "sun", "badges", "dates", "plates", "captions"], doc: "Capas reutilizables: territories, arrows, sun, badges (países/ciudades), dates (año), plates (archivo), captions. Omitir = composición original completa." },
      from: { type: "array", default: null, doc: "Cámara inicial [lon, lat, span°, giro°] o \"País*k\". Vacío = donde terminó el plano con mapa anterior." },
      to: { type: "array", default: null, doc: "Solo para encuadrar planos vecinos: cámara final. Vacío = la de la última entrada de `cameras`." },
      zoom: { type: "number", default: 1.08, min: 0.3, max: 6, doc: "Si no hay cámaras: cuánto se aleja." },
      tilt: { type: "number", default: 0, min: -20, max: 20, doc: "Giro de las cámaras automáticas." },
      ease: { type: "enum", options: ["auto", "out", "in", "inOut", "linear", "expo"], default: "linear", doc: "Solo para planos vecinos (la cámara de este plano la dan `cameras`)." },
      fit: { type: "number", default: 1.9, min: 1.1, max: 4, doc: "Margen del encuadre automático de `cameras[].focus` (más alto = más mapa alrededor)." },
      cameras: { type: "array", default: [], doc: "Vuelos de cámara en orden: [{\"t\":\"@Sajalín-1.8\", \"focus\":[\"sun\", [142.8,48.5]], \"k\":1.9}] o {\"t\":..,\"to\":[lon,lat,span,giro]}. Opcional `dur`, `ease`, `tilt`. Cada vuelo parte de donde esté la cámara. Con `\"cut\": true` (o `dur: 0`) la cámara salta al encuadre sin moverse: así el plano no tiene movimientos de cámara." },
      targets: { type: "array", required: true, default: [], doc: "Destinos: [{\"at\":\"Taiwan\", \"region\":\"Taiwan\"|[\"A\",\"B\"]|{\"poly\":[[lon,lat]…],\"within\":\"China\"}|{\"dots\":[[lon,lat]…]}|null, \"label\":\"TAIWÁN\", \"year\":\"1895\", \"flag\":\"f1\", \"time\":\"@Taiwán\", \"kind\":\"badge|city\", \"arrow\":true, \"from\":[lon,lat], \"badgeAt\":[lon,lat], \"bow\":0.16, \"size\":1, \"hold\":4.5, \"side\":\"left|right\", \"dy\":0}]. `time` = cuándo la voz lo nombra: la flecha llega en ese instante." },
      plates: { type: "array", default: [], doc: "Tramos de archivo: video 8–16 s o imagen 6–12 s; para fotos usar image:p1/p2 en vez de video. Ejemplo: [{\"video\":\"v1\", \"at\":\"@Manchuria-1\", \"dur\":8, \"start\":0, \"rate\":1, \"strength\":0.9, \"focus\":[0.5,0.45], \"caption\":\"ARCHIVO · 1931\"}]. El atlas se pone gris y el clip se funde en multiplicar." },
      held: { type: "array", default: [], doc: "Territorios ya ocupados al empezar, siempre marcados (mismas formas que `region`)." },
      travel: { type: "number", default: 1.1, min: 0.3, max: 3, doc: "Segundos que tarda cada flecha en cruzar el mar antes de llegar a su `time`." },
      hold: { type: "number", default: 4.5, min: 1, max: 20, doc: "Segundos que se queda la bandera con su rótulo tras llegar (el territorio sigue marcado)." },
      beam: { type: "number", default: 1, min: 0.4, max: 2.5, doc: "Grosor de las flechas (multiplicador)." },
      badge: { type: "number", default: 1, min: 0.5, max: 2, doc: "Tamaño de las banderas redondas (multiplicador)." },
      stamp: { type: "bool", default: true, doc: "Sello grande con el año del último destino, arriba a la izquierda." },
      smoke: { type: "number", default: 0.6, min: 0, max: 1, doc: "Humo oscuro sobre los tramos de archivo." },
      ...flagParams, ...vidParams, ...photoParams,
    },
    mapCam: (p, st) => {
      const cs = camTargets(p, st), last = cs.length ? cs[cs.length - 1].cam : null;
      return { from: p.from, to: p.to || last || IM.cam(`${p.country || "Japan"}*3`), zoom: p.zoom, tilt: p.tilt, ease: p.ease };
    },
    mapLook: p => ({ hatch: bakedOf(p), labels: p.labels || [], gray: 0, grays: [0] }),
    /* el motor precalienta los encuadres de los primeros vuelos antes de que empiece el plano */
    mapWarm: (p, ctx) => camTargets(p, ctx.stage).slice(0, 1).map(x => ({ cam: x.cam, hatch: bakedOf(p) })),   /* con `cut` la cámara arranca ya en el primer encuadre */
    create(ctx, p) {
      const parts = new Set(p.parts);
      const st = ctx.stage, { u, portrait, W, H } = st, beatT0 = ctx.beat.t0, S = IM.surface(ctx), MC = IM.mapCache(ctx);
      const pcv = IM.canvas(Math.round(W * 0.5), Math.round(H * 0.5)), pcg = pcv.getContext("2d");   /* video B/N a media resolución */
      const when = (v, i) => {
        if (typeof v === "number") return v;
        if (typeof v === "string" && v.startsWith("@")) {
          const m = /^(.*?)(?:([+-])(\d*\.?\d+))?$/.exec(v.slice(1)), wi = K.findAnchor(ctx.words || [], m[1], Math.max(0, ctx.beat.wordIndex ?? 0));
          if (wi >= 0) return Math.max(0, ctx.words[wi].start - beatT0 + (m[3] ? (m[2] === "-" ? -1 : 1) * +m[3] : 0));
        }
        return 0.8 + i * 1.4;
      };
      const sunPt = p.sunAt || (p.country ? IM.point(p.country) : null);
      const T = (p.targets || []).map((x, i) => {
        const t = parseTarget(x), arrive = Math.max(0.2, when(t.time, i)), trav = Math.min(p.travel, Math.max(0.3, arrive - 0.05));
        return { ...t, i, arrive, depart: Math.max(0, arrive - trav), trav, keep: t.hold ?? p.hold, img: t.flag && p[t.flag] ? ctx.img(p[t.flag]) : null };
      }).filter(t => t.aim);
      const HELD = (p.held || []).map(h => parseTarget({ region: h }));
      const baked = bakedOf(p);
      const named = [...new Set(T.flatMap(t => t.names))];
      const hq = lt => { const o = {}; T.forEach(t => t.names.forEach(n => { o[n] = Math.max(o[n] || 0, prog(lt, t.arrive, 0.5)); })); return o; };
      const PL = (parts.has("plates") ? p.plates || [] : []).map((x, i) => ({ ...x, i, t0: when(x.at, i), dur: x.dur ?? 8, rate: x.rate ?? 1, start: x.start ?? 0, strength: x.strength ?? 0.9, focus: x.focus || [0.5, 0.45] }));
      const plateEnv = (x, lt) => prog(lt, x.t0, 0.9, "inOut") * (1 - prog(lt, x.t0 + x.dur - 0.9, 0.9, "inOut")) * x.strength;
      /* cámara: vuelos encadenados; cada uno parte de donde esté la anterior en ese instante */
      const base = IM.camOf(ctx, ctx.beat);
      const raw = camTargets(p, st).map(({ key, cam }, i) => ({ t0: when(key.t, i), cam, key })).sort((a, b) => a.t0 - b.t0);
      const segs = [];
      raw.forEach(r => {
        if (r.key.cut || r.key.dur === 0) { segs.push({ t0: r.t0, t1: r.t0, from: r.cam, to: r.cam, ease: "linear" }); return; }   /* corte: la cámara no se mueve nunca */
        const prev = segs[segs.length - 1];
        let from = prev ? prev.to : base.from;
        if (prev && r.t0 < prev.t1) from = IM.mixCam(prev.from, prev.to, prog(r.t0, prev.t0, prev.t1 - prev.t0, prev.ease));
        let dl = Math.abs(r.cam.lon - from.lon); if (dl > 180) dl = 360 - dl;
        const far = Math.hypot(dl, r.cam.lat - from.lat) / Math.max(1, Math.min(from.span, r.cam.span)), zoomed = Math.abs(Math.log(r.cam.span / from.span));
        const dur = r.key.dur ?? clamp(1.7 + far * 1.1 + zoomed * 0.9, 1.9, 4.2);
        segs.push({ t0: r.t0, t1: r.t0 + dur, from, to: r.cam, ease: r.key.ease || "inOut" });
      });
      const R0 = u * (portrait ? 6.8 : 6.2) * p.badge, fsName = u * (portrait ? 3.9 : 3.4), fsYear = u * (portrait ? 2.9 : 2.5);
      let warmQ = -1;
      const stampOf = lt => { let k = -1; T.forEach((t, i) => { if (t.year && lt >= t.arrive) k = i; }); return k; };
      return {
        render(lt, b, t) {
          const G = S.begin();
          /* cámara */
          let si = -1; segs.forEach((s, i) => { if (lt >= s.t0) si = i; });
          const seg = si >= 0 ? segs[si] : { from: base.from, to: base.from, t0: 0, t1: 1, ease: "linear" };
          const q = si >= 0 ? (seg.t1 > seg.t0 ? prog(lt, seg.t0, seg.t1 - seg.t0, seg.ease) : 1) : 0;
          const c = IM.mixCam(seg.from, seg.to, q), kk = IM.keyOf(seg, q);
          /* atlas (gris mientras hay un tramo de archivo) */
          const env = PL.map(x => plateEnv(x, lt)), gray = clamp(Math.max(0, ...env)), pe = gray;
          /* precalentar con antelación (en ratos libres) lo que viene: el próximo vuelo y el otro gris antes de que
             empiece o termine un tramo de archivo → ninguna llave se arma de golpe a mitad del plano */
          const qa = Math.floor(lt * 4);
          if (qa !== warmQ) {
            warmQ = qa; const seen = new Set();
            const grayAt = x => Math.max(0, ...PL.map(pl => plateEnv(pl, x)));
            for (let tau = 0; tau <= 3.6; tau += 0.3) {
              const lx = lt + tau; let sj = -1; segs.forEach((sg, i) => { if (lx >= sg.t0) sj = i; });
              const sg = sj >= 0 ? segs[sj] : null, qx = sg ? (sg.t1 > sg.t0 ? prog(lx, sg.t0, sg.t1 - sg.t0, sg.ease) : 1) : 0;
              const kx = IM.keyOf(sg || { from: base.from, to: base.from }, qx), gx = grayAt(lx);
              const grs = gx > 0.02 && gx < 0.98 ? [0, 1] : [gx >= 0.98 ? 1 : 0];
              for (const c of [kx.cam, kx.f > 0 ? kx.cam1 : null]) {
                if (!c) continue; for (const gl of grs) {
                  const id = `${c.lon.toFixed(3)},${c.lat.toFixed(3)},${c.span.toFixed(3)},${c.rot.toFixed(2)}|${gl}`; if (seen.has(id)) continue; seen.add(id);
                  IM.warmAtlas(c.lon, baked); IM.warmKey(ctx, c, { hatch: baked, gray: gl });
                }
              }
            }
          }
          const V = MC.draw(G, c, kk.cam, `${si}:${kk.j}`, { hatch: baked, labels: p.labels, gray, hatchLive: named, hatchQ: hq(lt) }, { k2: kk.cam1, id2: `${si}:${kk.j1}`, f: kk.f, warm: kk.next ? [kk.next] : [] });
          /* Archivo ilustrativo: videos y fotos comparten fundido/crop; el atlas continúa debajo. */
          PL.forEach((x, i) => {
            if (env[i] <= 0.005) return;
            const lt2 = lt - x.t0;
            let v, iw, ih;
            if (x.image && p[x.image]) {
              v = ctx.img(p[x.image]); iw = v && (v.naturalWidth || v.width); ih = v && (v.naturalHeight || v.height);
            } else if (x.video && p[x.video]) {
              const v0 = ctx.clip(p[x.video], 0), d = v0 && isFinite(v0.duration) ? v0.duration : 0;
              const ct = d > 0.5 ? x.start + ((lt2 * x.rate) % Math.max(0.5, d - x.start - 0.1)) : x.start + lt2 * x.rate;
              v = ctx.clip(p[x.video], ct); iw = v && v.videoWidth; ih = v && v.videoHeight;
            }
            if (!v || !iw || !ih) return;
            const z = 1.1 - 0.05 * clamp(lt2 / Math.max(4, x.dur)), ar = W / H;
            let sw = iw, sh = iw / ar; if (sh > ih) { sh = ih; sw = ih * ar; } sw /= z; sh /= z;
            const sx = clamp(iw * x.focus[0] - sw / 2, 0, iw - sw), sy = clamp(ih * x.focus[1] - sh / 2, 0, ih - sh);
            /* el filtro B/N se aplica a media resolución (4× menos píxeles): el fundido en multiplicar con grano lo disimula */
            pcg.filter = "grayscale(1) contrast(1.35) brightness(1.08)"; pcg.drawImage(v, sx, sy, sw, sh, 0, 0, pcv.width, pcv.height); pcg.filter = "none";
            G.save(); G.globalCompositeOperation = "multiply"; G.globalAlpha = env[i]; G.drawImage(pcv, 0, 0, W, H); G.restore();
          });
          if (pe > 0.005) {
            IM.smoke(G, st, t, pe * p.smoke, portrait ? 0.42 : 0.55);
            IM.fx.grain = Math.max(IM.fx.grain, 0.1 + 0.14 * pe); IM.fx.dust = Math.max(IM.fx.dust, pe * 0.7); IM.fx.vignette = Math.max(IM.fx.vignette, 0.4 + 0.5 * pe);
          }
          /* territorios ocupados antes (fijos) y marcados ahora (con pulso) */
          const paint = (tg, fillA, edgeA, pulse, qq) => {
            if (tg.names.length || tg.poly) {
              const paths = tg.names.map(n => V.A.country(n)).filter(Boolean);
              let clipP = null;
              if (tg.poly) {
                const pp = new Path2D(); tg.poly.forEach((pt, k) => { const a = V.A.proj(pt); if (a) (k ? pp.lineTo(a[0], a[1]) : pp.moveTo(a[0], a[1])); }); pp.closePath(); paths.push(pp);
                clipP = tg.within ? V.A.country(tg.within) : null;
              }
              G.save(); G.transform(...V.m); if (clipP) G.clip(clipP); G.lineJoin = "round";
              for (const P of paths) {
                G.fillStyle = col(PAL.crimHi, fillA * qq); G.fill(P);
                G.strokeStyle = col(PAL.white, edgeA * qq); G.lineWidth = u * 0.24 / V.k; G.stroke(P);
                if (pulse > 0.01) { G.strokeStyle = col(PAL.crimHi, 0.85 * pulse); G.lineWidth = u * (0.5 + 1.4 * (1 - pulse)) / V.k; G.stroke(P); }
              }
              G.restore();
            }
            if (tg.dots) tg.dots.forEach(d => {
              const [x, y] = V.pt(d[0], d[1]), r = u * 1.15 * qq;
              ring(G, x, y, r * (1.6 + 2.4 * (1 - pulse)), pulse * 0.8, u * 0.28, col(PAL.crimHi, 1));
              G.save(); G.fillStyle = col(PAL.crimHi, 0.95 * Math.max(0.55, fillA / 0.58)); G.strokeStyle = col(PAL.white, edgeA); G.lineWidth = u * 0.22; G.beginPath(); G.arc(x, y, r, 0, 7); G.fill(); G.stroke(); G.restore();
            });
          };
          if (parts.has("territories")) HELD.forEach(h => paint(h, 0.36, 0.7, 0, 1));
          if (parts.has("territories")) T.forEach(tg => {
            const qq = prog(lt, tg.arrive, 0.5, "out"); if (qq <= 0.002) return;
            paint(tg, lerp(0.58, 0.36, prog(lt, tg.arrive + 0.5, 1.4)), 0.95, 1 - prog(lt, tg.arrive, 1.3, "out"), qq);
          });
          /* flechas (debajo del sol) */
          const sun = sunPt ? V.pt(sunPt[0], sunPt[1]) : null;
          if (sun && parts.has("arrows")) T.forEach(tg => {
            if (tg.arrow === false) return;
            const s = prog(lt, tg.depart, tg.trav, "inOut"), life = 1 - prog(lt, tg.arrive + 1.3, 1.3, "inOut"); if (s <= 0.002 || life <= 0.01) return;
            const origin = Array.isArray(tg.from) ? V.pt(tg.from[0], tg.from[1]) : sun;
            const target = V.pt(tg.spot[0], tg.spot[1]), dx = target[0] - origin[0], dy = target[1] - origin[1], dist = Math.hypot(dx, dy) || 1;
            const stop = tg.kind === "city" ? u * 1.6 : R0 * (tg.size || 1) * 1.18;
            drawArrow(G, st, origin, [target[0] - dx / dist * stop, target[1] - dy / dist * stop], tg.bow ?? 0.16, s,
              { w0: u * 0.7 * p.beam, w1: u * (portrait ? 3.1 : 2.8) * p.beam, head: u * (portrait ? 7.6 : 6.9) * p.beam, alpha: life });
          });
          if (sun && parts.has("sun")) IM.sun(G, sun[0], sun[1], clamp(p.sunSize * V.pxPerDeg, u * 2.6, u * 12), t, { flag: null });
          /* banderas / ciudades con su rótulo (entran con rebote y se retiran) */
          const safeB = st.caption.y - u * 1.6;
          if (parts.has("badges")) T.forEach(tg => {
            const qin = prog(lt, tg.arrive, 0.55, "back"), qout = prog(lt, tg.arrive + tg.keep, 0.5, "in"), qq = qin * (1 - qout), ql = prog(lt, tg.arrive + 0.15, 0.5, "out") * (1 - qout);
            if (qq <= 0.002) return;
            let [x, y] = V.pt(tg.spot[0], tg.spot[1]);
            const R = R0 * (tg.size || 1);
            if (x < -R || x > W + R || y < -R || y > H + R) return;                   /* destino fuera del encuadre: no se pega al borde */
            if (tg.kind === "city") {
              const pr = 1 - prog(lt, tg.arrive, 1.3, "out"), rr = u * 1.0;
              ring(G, x, y, rr * (1.8 + 3 * (1 - pr)), pr * 0.85, u * 0.26, col(PAL.crimHi, 1));
              G.save(); G.globalAlpha = clamp(qq * 1.5); G.fillStyle = col(PAL.crimHi, 1); G.strokeStyle = col(PAL.white, 1); G.lineWidth = u * 0.25; G.beginPath(); G.arc(x, y, rr * qq, 0, 7); G.fill(); G.stroke(); G.restore();
              if (tg.label) {
                const fs = fsYear * 1.05, right = tg.side ? tg.side !== "left" : x < W * 0.7, lw = IM.measure(tg.label, IM.wordFont(fs), fs * 0.04) + fs * 1.1;
                tag(G, tg.label, clamp(x + (right ? 1 : -1) * (lw / 2 + rr * 2.6), lw / 2 + u * 2, W - lw / 2 - u * 2), clamp(y + (tg.dy || 0) * u, u * 5, safeB), fs, { alpha: ql, fill: col(PAL.crim, 0.88) });
              }
              return;
            }
            x = clamp(x, R + u * 3, W - R - u * 3); y = clamp(y, R + u * (tg.year ? 6 : 3), safeB - fsName * 2 - R);
            flagBadge(G, tg.img, x, y, R, qq, u);
            if (tg.label) tag(G, tg.label, x, y + R + u * 0.55 + fsName * 1.0, fsName, { alpha: ql, W });
          });
          /* sello del año */
          const k = p.stamp && parts.has("dates") ? stampOf(lt) : -1;
          if (k >= 0) {
            const tg = T[k], qq = prog(lt, tg.arrive, 0.6, "out");
            dateStamp(G, st, tg.year, qq);
          }
          /* rótulos de archivo */
          PL.forEach((x, i) => {
            if (!x.caption || env[i] <= 0.05) return;
            if (parts.has("captions")) archiveCaption(G, st, x.caption, env[i]);
          });
          S.blit(ctx.g.main, ctx.beat.t0 < 0.05 || !p.enter ? 1 : prog(lt, 0, p.enter, "inOut"));
        },
        dispose() { S.free(); MC.free(); pcv.width = pcv.height = 1; },
      };
    },
  };
  K.register(campaign);
  IM.campaign = { definition: campaign, camParams, mapParams, dateStamp, archiveCaption };

  /* ============================================================ archivo con VIDEO fundido con el atlas */
  K.register({
    name: "imperio.footage", tags: ["archivo", "video", "blanco y negro", "mapa", "guerra", "imperio"], layer: "main", post: 0.6, opaque: true,
    summary: "Material de archivo en VIDEO (en vez de foto): el atlas se desatura a gris, baja humo oscuro y el clip mudo se funde en blanco y negro, en multiplicar, con el mapa; el sol y los rayos carmesí siguen encima. Como imperio.archive pero con movimiento real.",
    example: { video: "samples/imperio-archive.mp4", country: "Japan", from: [145, 35, 125, 3], to: [135, 32, 165, 6], rays: 28, dir: 180, spread: 0.72, rayFloor: 0.02, rayAlpha: 0.56, rayLen: 0.46, compass: true, caption: "ARCHIVO" },
    params: {
      video: { type: "video", default: "", doc: "Clip mudo de assets/media (se pasa a B/N contrastado). Vacío = solo atlas gris, humo y rayos." },
      start: { type: "number", default: 0, min: 0, doc: "Segundo inicial del clip." },
      rate: { type: "number", default: 1, min: 0.2, max: 2, doc: "Velocidad del clip (bajar si es corto)." },
      loop: { type: "bool", default: true, doc: "Repetir el clip si es más corto que el plano." },
      focus: { type: "array", default: [0.5, 0.45], doc: "Punto de interés del clip [x,y] 0..1." },
      ...mapParams, ...camParams,
      zoom: { ...camParams.zoom, default: 1.3 }, tilt: { ...camParams.tilt, default: 3 }, ease: { ...camParams.ease, default: "auto" },
      sunSize: { ...mapParams.sunSize, default: 3.0 }, enter: { ...mapParams.enter, default: 0.7 }, compass: { ...mapParams.compass, default: true },
      rays: { type: "number", default: 28, min: 0, max: 60, doc: "Rayos del sol." },
      dir: { type: "number", default: 180, doc: "Rumbo del abanico (0 = norte, 180 = sur)." },
      spread: { type: "number", default: 0.72, min: 0, max: 1, doc: "Cierre del abanico." },
      rayFloor: { type: "number", default: 0.02, min: 0, max: 0.4, doc: "Largo residual de los rayos opuestos." },
      rayAlpha: { type: "number", default: 0.56, min: 0, max: 1, doc: "Opacidad de los rayos." },
      rayLen: { type: "number", default: 0.46, min: 0.1, max: 1, doc: "Largo de los rayos (fracción del lado largo)." },
      raysAt: { type: "number", default: 0, doc: "Segundo en que nacen los rayos." },
      rayColor: { type: "string", default: "", doc: "Color hex de los rayos en multiplicar (el demo usa un carmesí vivo). Vacío = granate grisáceo del mapa." },
      ships: { type: "number", default: 2, min: 0, max: 10, doc: "Barquitos sobre los rayos." },
      grayDur: { type: "number", default: 0.9, min: 0, doc: "Segundos en que el atlas pasa a gris." },
      videoAt: { type: "number", default: 0, doc: "Segundo en que empieza a aparecer el clip." },
      videoDur: { type: "number", default: 1.0, min: 0.1, doc: "Duración del fundido del clip." },
      strength: { type: "number", default: 0.95, min: 0, max: 1, doc: "Intensidad del clip (multiplicar)." },
      smoke: { type: "number", default: 0.7, min: 0, max: 1, doc: "Humo oscuro desde arriba." },
      caption: { type: "string", default: "", doc: "Rótulo chico en itálica abajo a la izquierda (lugar · año del metraje)." },
    },
    mapCam: p => ({ from: p.from, to: p.to || (p.country && !p.from ? `${p.country}*5` : null), zoom: p.zoom, tilt: p.tilt, ease: p.ease }),
    mapLook: p => ({ hatch: Array.isArray(p.hatch) ? p.hatch : (p.country ? [p.country] : []), labels: p.labels || [], gray: 1, grays: p.grayDur > 0 ? [0, 1] : [1] }),
    create(ctx, p) {
      const st = ctx.stage, { W, H, u, portrait } = st;
      const pcv = IM.canvas(Math.round(W * 0.5), Math.round(H * 0.5)), pcg = pcv.getContext("2d");   /* video B/N a media resolución */
      const gq = lt => p.grayDur > 0 ? prog(lt, 0, p.grayDur, "inOut") : 1;
      const clipTime = lt => {
        const raw = p.start + lt * p.rate, v = ctx.clip(p.video, 0), d = v && isFinite(v.duration) ? v.duration : 0;
        if (!p.loop || d <= 0.5) return raw;
        const span = Math.max(0.5, d - p.start - 0.1); return p.start + ((lt * p.rate) % span);
      };
      const layer = (G, info, lt) => {
        const pq = prog(lt, p.videoAt, p.videoDur, "inOut") * p.strength, sq = prog(lt, p.videoAt + 0.25, 1.2, "inOut") * p.smoke;
        const v = pq > 0.005 ? ctx.clip(p.video, clipTime(lt)) : null;
        if (v && v.videoWidth) {
          const iw = v.videoWidth, ih = v.videoHeight, z = 1.1 - 0.06 * clamp(lt / Math.max(4, ctx.beat.dur)), ar = W / H;
          let sw = iw, sh = iw / ar; if (sh > ih) { sh = ih; sw = ih * ar; } sw /= z; sh /= z;
          const sx = clamp(iw * p.focus[0] - sw / 2, 0, iw - sw), sy = clamp(ih * p.focus[1] - sh / 2, 0, ih - sh);
          pcg.filter = "grayscale(1) contrast(1.35) brightness(1.08)"; pcg.drawImage(v, sx, sy, sw, sh, 0, 0, pcv.width, pcv.height); pcg.filter = "none";
          G.save(); G.globalCompositeOperation = "multiply"; G.globalAlpha = pq; G.drawImage(pcv, 0, 0, W, H); G.restore();
        }
        IM.smoke(G, st, ctx.beat.t0 + lt, sq, portrait ? 0.42 : 0.55);
      };
      const sc = IM.mapScene(ctx, { ...p, sun: true, flag: "none" }, { gray: gq, under: layer });
      return {
        render(lt, b, t) {
          const pq = prog(lt, p.videoAt, p.videoDur, "inOut") * p.strength;
          IM.fx.grain = Math.max(IM.fx.grain, 0.1 + 0.14 * pq); IM.fx.dust = Math.max(IM.fx.dust, pq * 0.7); IM.fx.vignette = Math.max(IM.fx.vignette, 0.4 + 0.5 * pq);
          sc.draw(lt, b, t, G => {
            if (!p.caption) return;
            const fs = u * (portrait ? 2.5 : 1.9), cq = prog(lt, p.videoAt + 0.8, 0.6);
            G.save(); G.globalAlpha = cq * 0.85; G.font = `italic 500 ${fs}px Montserrat`; G.letterSpacing = fs * 0.12 + "px"; G.fillStyle = col(PAL.white, 1);
            G.shadowColor = col(PAL.ink, 0.7); G.shadowBlur = fs * 0.5; G.textBaseline = "alphabetic";
            G.fillText(p.caption, u * (portrait ? 6 : 5), st.caption.y - u * (portrait ? 5 : 3)); G.restore();
          });
        },
        dispose() { sc.dispose(); pcv.width = pcv.height = 1; },
      };
    },
  });
})();
