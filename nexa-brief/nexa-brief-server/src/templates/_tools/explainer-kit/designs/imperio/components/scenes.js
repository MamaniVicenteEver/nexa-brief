/* =============================================================================
   imperio · escenas con mapa (cada movimiento de la referencia es un componente)
   -----------------------------------------------------------------------------
   Orden de dibujo de toda escena (en un lienzo propio, para fundir planos):
     atlas (océano, aguas someras, tierra, rayado del imperio, relieve, costa, rótulos)
     → rayos carmesí → barcos → sol → [foto B/N en multiplicar + humo] → rosa de los vientos
     → textos (título original, título condensado, pines)
   La cámara de cada plano arranca donde terminó el plano con mapa anterior (si no se
   le da `from`): así una secuencia de beats se ve como el plano continuo de la referencia.
   Tiempos medidos en la referencia (24 fps): ver DESIGN.md §1.4.
   ========================================================================== */
(function () {
  "use strict";
  const K = Kit, IM = Kit.imperio, { clamp, lerp, prog, ease } = K;
  const D2R = Math.PI / 180;

  /* ------------------------------------------------------------ parámetros comunes */
  const camParams = {
    from: { type: "array", default: null, doc: "Cámara inicial [lon, lat, span°, giro°] o \"País*k\". Vacío = donde terminó el plano con mapa anterior (plano continuo)." },
    to: { type: "array", default: null, doc: "Cámara final [lon, lat, span°, giro°] o \"País*k\" (k = cuántas veces el ancho del país). Vacío = se aleja `zoom`." },
    zoom: { type: "number", default: 1.3, min: 0.3, max: 6, doc: "Si no hay `to`: cuánto se aleja la cámara en el plano (1.3 = 30 % más de mapa; < 1 acerca)." },
    tilt: { type: "number", default: 2, min: -20, max: 20, doc: "Si no hay `to`: grados que gira el mapa durante el plano (la referencia rota apenas)." },
    ease: { type: "enum", options: ["auto", "out", "in", "inOut", "linear", "expo"], default: "auto", doc: "Curva del movimiento de cámara. auto = sin frenar entre planos encadenados (lineal), out después de un corte." },
  };
  const mapParams = {
    country: { type: "string", default: "", doc: "País foco (nombre de world-atlas en inglés o alias en español: 'Japón', 'Alemania', 'Reino Unido'). Pone el sol y el rayado." },
    hatch: { type: "array", default: null, doc: "Países rayados en diagonal (territorio del imperio). Vacío = solo `country`; [] explícito = ninguno." },
    sun: { type: "bool", default: true, doc: "Círculo carmesí que late sobre el país foco." },
    sunAt: { type: "array", default: null, doc: "[lon, lat] del sol (vacío = centro del país foco)." },
    sunSize: { type: "number", default: 1.3, min: 0.2, max: 6, doc: "Radio del sol en grados de mapa (se achica al alejarse la cámara)." },
    labels: { type: "array", default: [], doc: "Rótulos de mares/regiones en itálica: [{\"t\":\"Mar del\\nJapón\", \"at\":[134,40]}] ('at' también acepta un país)." },
    compass: { type: "bool", default: false, doc: "Rosa de los vientos de línea fina abajo a la derecha." },
    gray: { type: "number", default: 0, min: 0, max: 1, doc: "Desaturación del atlas (1 = gris, como el tramo de archivo)." },
    enter: { type: "number", default: 0.5, min: 0, max: 2, doc: "Segundos de fundido de entrada sobre el plano anterior (0 = corte)." },
    flag: { type: "string", default: "auto", doc: "Colores del sol y los rayos: auto = bandera del país foco (Japón = carmesí de la referencia), 'none' = carmesí, o colores propios '#000,#d00,#fc0'." },
  };
  const rayParams = {
    rays: { type: "number", default: 0, min: 0, max: 60, doc: "Cantidad de rayos del sol (0 = sin rayos; la referencia usa ~28)." },
    dir: { type: "number", default: 180, doc: "Rumbo hacia donde se despliega el abanico (0 = norte, 90 = este, 180 = sur, 270 = oeste)." },
    spread: { type: "number", default: 0.6, min: 0, max: 1, doc: "Qué tan cerrado es el abanico (0 = parejo en 360°, 1 = solo hacia `dir`)." },
    rayFloor: { type: "number", default: 0.16, min: 0, max: 0.4, doc: "Largo residual de los rayos opuestos al rumbo principal; bajo = abanico más direccional." },
    rayAlpha: { type: "number", default: 0.82, min: 0, max: 1, doc: "Opacidad de los rayos carmesí." },
    rayLen: { type: "number", default: 0.42, min: 0.1, max: 1, doc: "Largo máximo de los rayos (fracción del lado largo del cuadro)." },
    raysAt: { type: "number", default: 0.4, doc: "Segundo en que nacen los rayos (acepta '@palabra')." },
    ships: { type: "number", default: 0, min: 0, max: 10, doc: "Barquitos que avanzan sobre los rayos hacia el abanico." },
    rayColor: { type: "string", default: "", doc: "Color de los rayos en multiplicar. Vacío = granate grisáceo del tramo de mapa (#a8606e); el tramo de archivo usa carmesí #b3122f." },
  };

  /* ------------------------------------------------------------ utilidades */
  const hatchOf = p => Array.isArray(p.hatch) ? p.hatch : (p.country ? [p.country] : []);
  const sunPoint = p => (Array.isArray(p.sunAt) && p.sunAt.length === 2 ? p.sunAt : (p.country ? IM.point(p.country) : null));
  const bearing = (deg, V) => (deg - 90) * D2R + V.rot;
  const sunRadius = (st, V, deg = 1.3) => clamp(deg * V.pxPerDeg, st.u * 1.1, st.u * 12);

  /**
   * Escena con mapa compartida por title/map/archive/expansion: arma cámara, sol, rayos y barcos.
   * render(lt, b, t, extra(G, info)) dibuja en el lienzo propio y lo pega con fundido.
   */
  function mapScene(ctx, p, o = {}) {
    const st = ctx.stage, S = IM.surface(ctx), MC = IM.mapCache(ctx), cam = IM.camOf(ctx, ctx.beat), hatch = o.hatch || hatchOf(p), sp = sunPoint(p);
    const FL = IM.flagFor(p.country, p.flag);
    const first = ctx.beat.t0 < 0.05;
    return {
      S, cam,
      draw(lt, b, t, extra) {
        const G = S.begin(), q = IM.camQ(cam, lt, b.dur), c = IM.mixCam(cam.from, cam.to, q), kk = IM.keyOf(cam, q);
        const look = { hatch, labels: p.labels, gray: o.gray ? o.gray(lt) : p.gray, hatchLive: o.hatchLive, hatchQ: o.hatchQ ? o.hatchQ(lt) : 1, labelQ: o.labelQ ? o.labelQ(lt) : 1 };
        const V = MC.draw(G, c, kk.cam, `${kk.j}`, look, { k2: kk.cam1, id2: `${kk.j1}`, f: kk.f, warm: kk.next ? [kk.next] : [] });
        const info = { G, V, cam: c, sun: null, sunR: 0, rays: [] };
        if (sp) { info.sun = V.pt(sp[0], sp[1]); info.sunR = sunRadius(st, V, p.sunSize ?? 1.3); }
        if (o.under) o.under(G, info, lt);
        if (info.sun && p.rays > 0) {
          const grow = clamp((lt - (p.raysAt ?? 0.4)) / 1.1);
          info.rays = IM.rays(G, info.sun[0], info.sun[1], { n: p.rays, rot: V.rot + (p.rayRot || 0) * D2R, dir: bearing(p.dir, V), focus: p.spread, floor: p.rayFloor,
            len: Math.max(st.W, st.H) * p.rayLen, r0: info.sunR * 1.02, grow, t: lt, alpha: p.rayAlpha ?? (o.rayAlpha ?? 0.82), color: p.rayColor || undefined, colors: FL ? FL.rays : null });
          IM.ships(G, info.sun[0], info.sun[1], info.rays, { count: p.ships, len: st.u * (st.portrait ? 3.6 : 3.1), r0: info.sunR, t: lt, seed: 70 + ctx.beat.i, alpha: clamp((lt - (p.raysAt ?? 0.4) - 0.5) / 0.8) });
        }
        if (info.sun && p.sun) IM.sun(G, info.sun[0], info.sun[1], info.sunR, t, { alpha: o.sunAlpha ? o.sunAlpha(lt) : 1, flag: FL });
        if (extra) extra(G, info);
        if (p.compass) {
          const { W, u, portrait } = st, r = u * (portrait ? 9 : 8);
          IM.compass(G, W - u * (portrait ? 13 : 14), st.caption.y - u * (portrait ? 13 : 11), r, V.rot, clamp(lt / 0.8) * 0.85);
        }
        S.blit(ctx.g.main, first || !p.enter ? 1 : prog(lt, 0, p.enter, "inOut"));
        return info;
      },
      dispose() { S.free(); MC.free(); },
    };
  }
  /** look del atlas para el fondo continuo (cuando el plano siguiente no dibuja mapa) */
  const lookOf = gray => p => ({ hatch: hatchOf(p), labels: p.labels || [], gray: gray ?? (p.gray || 0) });

  /* ============================================================ título de apertura (la referencia entera, 0–11 s) */
  K.register({
    name: "imperio.title", tags: ["apertura", "título", "mapa", "imperio", "sol", "idioma original"], layer: "main", post: 0.6, opaque: true,
    summary: "Apertura (ref 0–11 s): atlas físico con el país foco rayado y el SOL carmesí que late; la cámara se aleja y gira apenas; nacen los RAYOS translúcidos en abanico hacia `dir` con barquitos; el título en su IDIOMA ORIGINAL (kanji, alemán, ruso…) entra carácter por carácter con su traducción tipeada debajo y se borra de derecha a izquierda; después el título condensado blanco SUBE desde abajo con degradé. Primer beat del video.",
    example: { country: "Japan", hatch: ["Japan"], from: [150, 36, 95, 0], to: [145, 35, 125, 3], sunSize: 3.6,
      native: "南進論", nativeSub: "SOUTHERN EXPANSION DOCTRINE", nativeAt: 5.0, nativeOut: 9.2,
      text: "JAPANESE\nEMPIRE", textPortrait: "JAPANESE\nEMPIRE", textAt: 10.0,
      rays: 28, raysAt: 4.0, dir: 180, spread: 0.72, rayFloor: 0.02, rayAlpha: 0.56, rayLen: 0.46, ships: 2,
      labels: [{ t: "Mar del\nJapón", at: [134.5, 40.2] }, { t: "Mar\nAmarillo", at: [123.6, 35.4] }, { t: "Océano\nPacífico", at: [150, 31] }] },
    params: {
      ...mapParams,
      country: { ...mapParams.country, default: "Japan" },
      ...camParams,
      zoom: { ...camParams.zoom, default: 1.3 },
      tilt: { ...camParams.tilt, default: 3 },
      ...rayParams,
      rays: { ...rayParams.rays, default: 28 },
      rayAlpha: { ...rayParams.rayAlpha, default: 0.56 },
      rayFloor: { ...rayParams.rayFloor, default: 0.02 },
      spread: { ...rayParams.spread, default: 0.72 },
      rayLen: { ...rayParams.rayLen, default: 0.46 },
      sunSize: { ...mapParams.sunSize, default: 3.6 },
      ships: { ...rayParams.ships, default: 2 },
      raysAt: { ...rayParams.raysAt, default: 4.0 },
      native: { type: "string", default: "", doc: "Título en su idioma original (p. ej. '南進論', 'Geheime Kommandosache', 'Перестройка'). Vacío = sin este paso." },
      nativeSub: { type: "string", default: "", doc: "Traducción chica en mayúsculas que se tipea debajo." },
      nativeAt: { type: "number", default: 5.0, doc: "Segundo en que entra el título original (acepta '@palabra')." },
      nativeOut: { type: "number", default: 9.2, doc: "Segundo en que se borra (de derecha a izquierda). −1 = se queda." },
      text: { type: "string", default: "", doc: "Título condensado blanco (Fjalla One); '\\n' parte renglones. Vacío = sin título grande." },
      textPortrait: { type: "string", default: "", doc: "Versión del título para 9:16 (más renglones)." },
      textAt: { type: "number", default: 10.0, doc: "Segundo en que sube el título condensado (acepta '@palabra')." },
    },
    mapCam: p => ({ from: p.from || (p.country ? `${p.country}*2` : null), to: p.to, zoom: p.zoom, tilt: p.tilt, ease: p.ease }),
    mapLook: lookOf(),
    create(ctx, p) {
      const st = ctx.stage, { W, H, portrait } = st;
      const sc = mapScene(ctx, p);
      const text = (portrait && p.textPortrait) || p.text;
      const L = text ? IM.wordLayout(text, W * (portrait ? 0.86 : 0.62), portrait ? W * 0.3 : H * 0.25) : null;
      return {
        render(lt, b, t) {
          sc.draw(lt, b, t, (G, info) => {
            if (p.native && info.sun) {
              const nativeWidth = W * 0.38;
              const o = portrait ? { x: W / 2, y: info.sun[1] + H * 0.2, width: W * 0.7, align: "center" }
                : { x: clamp(info.sun[0] + Math.max(info.sunR * 1.9, W * 0.2), st.u * 3, W - nativeWidth - st.u * 3), y: info.sun[1] + H * 0.13, width: nativeWidth, align: "left" };
              IM.native(G, st, { ...o, text: p.native, sub: p.nativeSub, at: p.nativeAt, outAt: p.nativeOut < 0 ? null : p.nativeOut, rot: info.V.rot * 0.9, maxFs: H * (portrait ? 0.1 : 0.15) }, lt);
            }
            if (L) IM.word(G, st, { layout: L, x: W / 2, y: H * (portrait ? 0.55 : 0.68), at: p.textAt, rot: info.V.rot * 0.85, stagger: 0.78, reveal: 0.45 }, lt);
          });
        },
        dispose() { sc.dispose(); },
      };
    },
  });

  /* ============================================================ mapa (lugar, foco en un país) */
  K.register({
    name: "imperio.map", tags: ["mapa", "lugar", "país", "geografía", "atlas"], layer: "main", post: 0.6, opaque: true,
    summary: "Atlas físico en movimiento lento (zoom y giro leve) sobre un país o región: territorio rayado, sol que late, rótulos de mares, rayos opcionales y PINES (punto carmesí + nombre) para lugares concretos (una base, una ciudad, un puerto). Para situar la historia y para respirar entre momentos fuertes.",
    example: { country: "United Kingdom", from: "United Kingdom*1.5", to: "United Kingdom*3.2", pins: [{ t: "Bletchley Park", at: [-0.74, 51.99] }, { t: "Londres", at: [-0.12, 51.5] }], labels: [{ t: "Mar del\nNorte", at: [3.5, 56] }, { t: "Océano\nAtlántico", at: [-15, 52] }], compass: true },
    params: {
      ...mapParams, ...camParams, ...rayParams,
      ease: { ...camParams.ease, default: "inOut" },
      sunSize: { ...mapParams.sunSize, default: 0.8 },
      pins: { type: "array", default: [], doc: "Lugares: [{\"t\":\"Bletchley Park\", \"at\":[-0.74, 51.99]}] (punto carmesí + nombre). Entran escalonados." },
      pinAt: { type: "number", default: 0.5, doc: "Segundo en que entra el primer pin (acepta '@palabra')." },
    },
    mapCam: p => ({ from: p.from, to: p.to || (p.country && !p.from ? `${p.country}*2.4` : null), zoom: p.zoom, tilt: p.tilt, ease: p.ease }),
    mapLook: lookOf(),
    create(ctx, p) {
      const st = ctx.stage, { u, portrait, W } = st, sc = mapScene(ctx, p);
      const pins = (p.pins || []).map(x => ({ t: String(x.t || ""), at: Array.isArray(x.at) ? x.at : IM.point(x.at) })).filter(x => x.at);
      return {
        render(lt, b, t) {
          sc.draw(lt, b, t, (G, info) => {
            pins.forEach((pin, i) => {
              const q = prog(lt, p.pinAt + i * 0.45, 0.4, "back"); if (q <= 0) return;
              const [x, y] = info.V.pt(pin.at[0], pin.at[1]), r = u * (portrait ? 1.1 : 0.9);
              G.save(); G.globalAlpha = clamp(q * 2);
              G.fillStyle = "rgba(246,246,248,.9)"; G.beginPath(); G.arc(x, y, r * 1.55 * q, 0, 7); G.fill();
              G.fillStyle = IM.COL.sunHi; G.beginPath(); G.arc(x, y, r * q, 0, 7); G.fill();
              const pr = prog(lt, p.pinAt + i * 0.45, 1.6, "out");
              G.strokeStyle = `rgba(138,10,38,${0.6 * (1 - pr)})`; G.lineWidth = u * 0.18; G.beginPath(); G.arc(x, y, r * (1.5 + pr * 3), 0, 7); G.stroke();
              if (pin.t) {
                const fs = u * (portrait ? 2.9 : 2.2), txt = pin.t.toUpperCase(); G.font = `800 ${fs}px Montserrat`; G.letterSpacing = fs * 0.04 + "px";
                const tw = IM.measure(txt, G.font, fs * 0.04), right = x + r * 2.4 + tw < W - u * 3, tx = right ? x + r * 2.4 : x - r * 2.4 - tw;
                const tq = prog(lt, p.pinAt + i * 0.45 + 0.15, 0.5, "out");
                G.textBaseline = "middle"; G.textAlign = "left"; G.lineJoin = "round";
                G.strokeStyle = "rgba(240,242,240,.75)"; G.lineWidth = fs * 0.28; G.globalAlpha = tq;
                G.save(); G.beginPath(); G.rect(tx - fs, y - fs, (tw + fs * 2) * tq, fs * 2); G.clip();
                G.strokeText(txt, tx, y); G.fillStyle = IM.COL.sub; G.fillText(txt, tx, y); G.restore();
              }
              G.restore();
            });
          });
        },
        dispose() { sc.dispose(); },
      };
    },
  });

  /* ============================================================ expansión (rayos hacia regiones) */
  K.register({
    name: "imperio.expansion", tags: ["expansión", "conquista", "invasión", "influencia", "mapa", "rayos"], layer: "main", post: 0.6, opaque: true,
    summary: "Expansión: desde el sol del país foco salen HACES carmesí translúcidos hacia cada región destino, uno tras otro; al llegar, la región se raya (territorio ocupado) y aparece su nombre en condensada blanca. Para invasiones, zonas de influencia, rutas de ataque o alcance de una doctrina.",
    example: { country: "Japan", targets: [{ at: "Philippines", t: "Filipinas" }, { at: "Indonesia", t: "Indias Orientales" }, { at: "Malaysia", t: "Malasia" }, { at: "Myanmar", t: "Birmania" }], hatch: ["Japan", "South Korea", "North Korea", "Taiwan"], labels: [{ t: "Océano\nPacífico", at: [150, 15] }, { t: "Mar de la\nChina Meridional", at: [114, 13] }], compass: true },
    params: {
      ...mapParams, ...camParams,
      ease: { ...camParams.ease, default: "inOut" },
      targets: { type: "array", required: true, default: [], doc: "Destinos: países o puntos: [\"Philippines\", {\"at\":\"Indonesia\", \"t\":\"Indias Orientales\"}, {\"at\":[151, -9], \"t\":\"Nueva Guinea\"}]." },
      at: { type: "number", default: 0.6, doc: "Segundo del primer haz (acepta '@palabra')." },
      stagger: { type: "number", default: 0.7, min: 0.1, doc: "Segundos entre haz y haz." },
      conquer: { type: "bool", default: true, doc: "Rayar cada país destino cuando llega su haz." },
      ships: { type: "number", default: 1, min: 0, max: 3, doc: "Barquitos por haz." },
      beam: { type: "number", default: 1, min: 0.3, max: 3, doc: "Ancho de los haces (multiplicador)." },
    },
    mapCam: (p, st) => {
      const pts = [p.country ? IM.point(p.country) : null, ...(p.targets || []).map(x => IM.point(typeof x === "object" && !Array.isArray(x) ? x.at : x))];
      return { from: p.from, to: p.to || IM.fitCam(pts, 1.3, p.tilt || 0, st), zoom: p.zoom, tilt: p.tilt, ease: p.ease };
    },
    mapLook: p => ({ hatch: [...hatchOf(p), ...(p.conquer ? (p.targets || []).map(x => typeof x === "object" && !Array.isArray(x) ? x.at : x).filter(x => typeof x === "string") : [])], labels: p.labels || [], gray: p.gray || 0 }),
    create(ctx, p) {
      const st = ctx.stage, { u, portrait, W, H } = st;
      const T = (p.targets || []).map(x => {
        const o = typeof x === "object" && !Array.isArray(x) ? x : { at: x };
        const f = typeof o.at === "string" ? IM.feature(o.at) : null, at = Array.isArray(o.at) ? o.at : (f ? d3.geoCentroid(IM.mainPart(f)) : null);
        let ext = 3; if (f) { const [[x0, y0], [x1, y1]] = d3.geoBounds(IM.mainPart(f)); ext = Math.max((x1 - x0 + 360) % 360, y1 - y0) * 0.45; }
        return { at, name: f ? f.properties.name : null, t: o.t ?? (typeof o.at === "string" ? o.at : ""), ext };
      }).filter(x => x.at);
      const conquered = p.conquer ? T.filter(x => x.name).map(x => x.name) : [];
      const hq = lt => { const o = {}; T.forEach((x, i) => { if (x.name) o[x.name] = prog(lt, p.at + i * p.stagger + 0.75, 0.5); }); return o; };
      const sc = mapScene(ctx, { ...p, rays: 0 }, { hatchLive: conquered, hatchQ: hq });
      return {
        render(lt, b, t) {
          sc.draw(lt, b, t, (G, info) => {
            if (!info.sun) return;
            const [sx, sy] = info.sun;
            /* haces (debajo del sol: se redibuja encima) */
            T.forEach((x, i) => {
              const q = prog(lt, p.at + i * p.stagger, 0.9, "out"); if (q <= 0) return;
              const [tx, ty] = info.V.pt(x.at[0], x.at[1]), dx = tx - sx, dy = ty - sy, dist = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
              const hw = clamp(Math.atan2(x.ext * info.V.pxPerDeg, dist) * 0.8 * p.beam, 2.5 * D2R, 13 * D2R), L = info.sunR + (dist * 1.1 - info.sunR) * q;
              const r0 = info.sunR, lg = G.createLinearGradient(sx, sy, sx + Math.cos(a) * dist * 1.1, sy + Math.sin(a) * dist * 1.1);
              lg.addColorStop(0, IM.tone(IM.COL.ray, 0, 1, 0.66)); lg.addColorStop(0.75, IM.tone(IM.COL.ray, 0, 1, 0.5)); lg.addColorStop(1, IM.tone(IM.COL.ray, 0, 1, 0));
              G.save(); G.fillStyle = lg; G.beginPath();
              G.moveTo(sx + Math.cos(a - hw) * r0, sy + Math.sin(a - hw) * r0); G.lineTo(sx + Math.cos(a - hw) * L, sy + Math.sin(a - hw) * L);
              G.lineTo(sx + Math.cos(a + hw) * L, sy + Math.sin(a + hw) * L); G.lineTo(sx + Math.cos(a + hw) * r0, sy + Math.sin(a + hw) * r0); G.closePath(); G.fill(); G.restore();
              for (let s = 0; s < p.ships; s++) { const f = clamp(0.3 + s * 0.25 + 0.04 * (lt - p.at - i * p.stagger)) * (L - r0) / Math.max(1, dist * 1.1 - r0);
                const d = r0 + (dist - r0) * Math.min(0.92, f); IM.ship(G, sx + Math.cos(a + (s - 1) * hw * 0.35) * d, sy + Math.sin(a + (s - 1) * hw * 0.35) * d, a, u * (portrait ? 3.6 : 3.1), clamp(q * 3 - 1.2)); }
              const lq = prog(lt, p.at + i * p.stagger + 0.75, 0.5, "out");
              if (lq > 0 && x.t) {
                const fs = u * (portrait ? 4.2 : 3.2), txt = String(x.t).toUpperCase();
                G.save(); G.globalAlpha = lq; G.font = IM.wordFont(fs); G.letterSpacing = fs * 0.02 + "px"; G.textAlign = "center"; G.textBaseline = "middle";
                G.shadowColor = "rgba(14,18,22,.6)"; G.shadowBlur = fs * 0.25; G.fillStyle = "#f6f6f8";
                const ly = clamp(ty + fs * 1.1 + (1 - lq) * fs * 0.5, H * 0.08, st.caption.y - fs), lx = clamp(tx, IM.measure(txt, G.font) / 2 + u * 2, W - IM.measure(txt, G.font) / 2 - u * 2);
                G.fillText(txt, lx, ly); G.restore();
              }
            });
            if (p.sun) IM.sun(G, sx, sy, info.sunR, t, { flag: IM.flagFor(p.country, p.flag) });
          });
        },
        dispose() { sc.dispose(); },
      };
    },
  });

  /* ============================================================ archivo B/N fundido con el mapa */
  K.register({
    name: "imperio.archive", tags: ["archivo", "foto", "blanco y negro", "mapa", "guerra", "barco"], layer: "main", post: 0.6, opaque: true,
    summary: "Material de archivo (ref 11.5–27.7 s): el atlas se DESATURA a gris, baja humo oscuro desde arriba y la foto en blanco y negro se FUNDE en multiplicar con el mapa (lo claro deja ver el mapa, lo oscuro lo tapa); los rayos carmesí siguen encima, rosa de los vientos fina abajo a la derecha, grano y polvo; la cámara sigue alejándose. Para mostrar una foto histórica sin salir del mapa.",
    example: { src: "../designs/imperio/assets/uboat.jpg", country: "Japan", from: [145, 35, 125, 3], to: [135, 32, 165, 6], rays: 28, dir: 180, spread: 0.72, rayFloor: 0.02, rayAlpha: 0.56, rayLen: 0.46, ships: 2, compass: true, photoAt: 0, photoDur: 0.9, labels: [{ t: "MAR DE JAPÓN", at: [135, 40] }, { t: "OCÉANO PACÍFICO", at: [151, 23] }] },
    params: {
      src: { type: "image", required: true, doc: "Foto de archivo (se pasa a B/N contrastado)." },
      photoFocus: { type: "array", default: [0.5, 0.42], doc: "Punto de interés de la foto [x,y] 0..1." },
      ...mapParams, ...camParams, ...rayParams,
      compass: { ...mapParams.compass, default: true },
      enter: { ...mapParams.enter, default: 0.7 },
      zoom: { ...camParams.zoom, default: 1.35 },
      tilt: { ...camParams.tilt, default: 3 },
      rays: { ...rayParams.rays, default: 28 },
      rayColor: { ...rayParams.rayColor, default: "#b3122f" },
      spread: { ...rayParams.spread, default: 0.72 },
      rayFloor: { ...rayParams.rayFloor, default: 0.02 },
      rayAlpha: { ...rayParams.rayAlpha, default: 0.56 },
      rayLen: { ...rayParams.rayLen, default: 0.46 },
      raysAt: { ...rayParams.raysAt, default: 0 },
      ships: { ...rayParams.ships, default: 3 },
      grayDur: { type: "number", default: 0.9, min: 0, doc: "Segundos en que el atlas pasa de color a gris (0 = ya gris)." },
      photoAt: { type: "number", default: 0.0, doc: "Segundo en que empieza a aparecer la foto." },
      photoDur: { type: "number", default: 0.9, min: 0.1, doc: "Duración del fundido de la foto." },
      photo: { type: "number", default: 0.95, min: 0, max: 1, doc: "Intensidad de la foto (multiplicar)." },
      smoke: { type: "number", default: 0.85, min: 0, max: 1, doc: "Humo oscuro desde arriba." },
      caption: { type: "string", default: "", doc: "Rótulo chico en itálica (lugar · año de la foto), abajo a la izquierda." },
    },
    mapCam: p => ({ from: p.from, to: p.to || (p.country && !p.from ? `${p.country}*5` : null), zoom: p.zoom, tilt: p.tilt, ease: p.ease }),
    mapLook: lookOf(1),
    create(ctx, p) {
      const st = ctx.stage, { W, H, u, portrait } = st, im = IM.bw(ctx, p.src);
      const gq = lt => p.grayDur > 0 ? prog(lt, 0, p.grayDur, "inOut") : 1;
      const photoLayer = (G, info, lt) => {
        const pq = prog(lt, p.photoAt, p.photoDur, "inOut") * p.photo;
        const sq = prog(lt, p.photoAt + 0.25, 1.2, "inOut") * p.smoke;
        if (im && pq > 0.005) {
          G.save(); G.globalCompositeOperation = "multiply"; G.globalAlpha = pq;
          const z = 1.12 - 0.08 * clamp(lt / Math.max(4, ctx.beat.dur)), dx = Math.sin(lt * 0.21) * u * 0.6;
          IM.cover(G, im, dx - u, -u, W + u * 2, H + u * 2, p.photoFocus, z); G.restore();
        }
        IM.smoke(G, st, ctx.beat.t0 + lt, sq, portrait ? 0.42 : 0.55);
      };
      const sc = mapScene(ctx, p, { gray: gq, under: photoLayer });
      return {
        render(lt, b, t) {
          const pq = prog(lt, p.photoAt, p.photoDur, "inOut") * p.photo;
          IM.fx.grain = Math.max(IM.fx.grain, 0.1 + 0.14 * pq); IM.fx.dust = Math.max(IM.fx.dust, pq * 0.7); IM.fx.vignette = Math.max(IM.fx.vignette, 0.4 + 0.5 * pq);
          sc.draw(lt, b, t, (G, info) => {
            if (p.caption) {
              const fs = u * (portrait ? 2.5 : 1.9), cq = prog(lt, p.photoAt + 0.8, 0.6);
              G.save(); G.globalAlpha = cq * 0.85; G.font = `italic 500 ${fs}px Montserrat`; G.letterSpacing = fs * 0.12 + "px"; G.fillStyle = "#eef0f2";
              G.shadowColor = "rgba(0,0,0,.7)"; G.shadowBlur = fs * 0.5; G.textBaseline = "alphabetic";
              G.fillText(p.caption, u * (portrait ? 6 : 5), st.caption.y - u * (portrait ? 5 : 3)); G.restore();
            }
          });
        },
        dispose() { sc.dispose(); },
      };
    },
  });

  IM.mapScene = mapScene;
})();
