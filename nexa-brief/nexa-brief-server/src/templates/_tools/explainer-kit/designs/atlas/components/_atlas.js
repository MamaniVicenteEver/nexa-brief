/* =============================================================================
   atlas · runtime de la familia "mapamundi 2.5D" (NODEPOLITICS)
   -----------------------------------------------------------------------------
   Réplica de una animación de mapa: océano gris oscuro, tierras gris oscuro con
   borde negro fino y una pared de extrusión CIAN que brilla debajo de cada costa
   (la tierra está "levantada" y la cámara la mira un poco desde adelante), viñeta
   en las esquinas y perspectiva leve (el borde de arriba queda más lejos).
   La cámara viaja país por país; cada país se enciende en BLANCO con un parpadeo
   de 8 cuadros, cae un ALFILER negro tipo gota con un sello circular y la
   etiqueta del país sale de atrás del alfiler en negrita oscura.

   Arquitectura (un solo plano continuo, como la referencia):
   · El MAPA vive en este runtime, no en los componentes. En setup se recorren
     TODOS los beats del storyboard: cada componente atlas.* declara en su def un
     `world(p, b, A)` que devuelve eventos en segundos del beat (cámara, pintar
     países, alfileres, líneas, rótulos). Se arma una línea de tiempo global y
     `frame(t)` dibuja el mapa como función pura de t (seek en cualquier orden).
   · `mapDim` (número o función de p) en la def dice cuánto se oscurece/desenfoca
     el mapa mientras el beat está en pantalla (0 = mapa limpio, 1 = cierre tipo
     "82 COUNTRIES LISTENING"). Componentes de otras familias (common.lyric) = 1.
   · d3-geo (Mercator) proyecta UNA vez a un plano base de 1000 u de ancho y se
     cachea un Path2D por país; la cámara es solo escala + traslación (equivale a
     interpolar fitExtent) y la perspectiva se aplica copiando el plano por franjas.
   Utilidades en Kit.atlas (A.*).
   ========================================================================== */
(function () {
  const K = window.Kit, { clamp, lerp, prog, ease } = K;
  const FPS = 25;                                    /* la referencia corre a 25 fps */
  const F = { label: "'Archivo Black'", cond: "'PT Sans Narrow'", ui: "Archivo" };
  for (const f of ["400 40px 'Archivo Black'", "700 40px Archivo", "800 40px Archivo", "600 40px Archivo", "700 40px 'PT Sans Narrow'", "400 40px 'PT Sans Narrow'"]) K.fonts.add(f);
  /** fuente de canvas: label (Archivo Black) · cond (PT Sans Narrow) · ui (Archivo) */
  function font(kind, px, weight) {
    const w = weight ?? ({ label: 400, cond: 700, ui: 800 }[kind] ?? 700);
    return `${w} ${Math.max(1, px).toFixed(1)}px ${F[kind] || kind}`;
  }
  const _mg = document.createElement("canvas").getContext("2d");
  function measure(str, kind, px, weight, spacing = 0) { _mg.font = font(kind, px, weight); _mg.letterSpacing = spacing ? spacing * px + "px" : "0px"; return _mg.measureText(str).width; }
  function fit(str, kind, w, max, weight, spacing = 0) { const m = measure(str, kind, 100, weight, spacing) || 1; return Math.min(max, 100 * w / m); }

  const cache = new Map();
  const memo = (key, fn) => { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); };
  function mk(w, h) { const c = document.createElement("canvas"); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return { c, g: c.getContext("2d") }; }
  const hex = h => { const n = parseInt(String(h).replace("#", ""), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const mix = (a, b, q) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], q))).join(",")})`; };

  /* ================================================================ geografía */
  /* nombres en español para las etiquetas por defecto (properties.name → es) */
  const ES = {
    "United States of America": "EE. UU.", "Canada": "Canadá", "Mexico": "México", "Guatemala": "Guatemala", "Belize": "Belice", "Honduras": "Honduras",
    "El Salvador": "El Salvador", "Nicaragua": "Nicaragua", "Costa Rica": "Costa Rica", "Panama": "Panamá", "Cuba": "Cuba", "Haiti": "Haití",
    "Dominican Rep.": "Rep. Dominicana", "Jamaica": "Jamaica", "Puerto Rico": "Puerto Rico", "Bahamas": "Bahamas", "Colombia": "Colombia", "Venezuela": "Venezuela",
    "Ecuador": "Ecuador", "Peru": "Perú", "Bolivia": "Bolivia", "Brazil": "Brasil", "Paraguay": "Paraguay", "Uruguay": "Uruguay", "Argentina": "Argentina",
    "Chile": "Chile", "Guyana": "Guyana", "Suriname": "Surinam", "Greenland": "Groenlandia", "Iceland": "Islandia", "Ireland": "Irlanda",
    "United Kingdom": "Reino Unido", "Portugal": "Portugal", "Spain": "España", "France": "Francia", "Belgium": "Bélgica", "Netherlands": "Países Bajos",
    "Luxembourg": "Luxemburgo", "Germany": "Alemania", "Switzerland": "Suiza", "Austria": "Austria", "Italy": "Italia", "Denmark": "Dinamarca",
    "Norway": "Noruega", "Sweden": "Suecia", "Finland": "Finlandia", "Estonia": "Estonia", "Latvia": "Letonia", "Lithuania": "Lituania", "Poland": "Polonia",
    "Czechia": "Chequia", "Slovakia": "Eslovaquia", "Hungary": "Hungría", "Slovenia": "Eslovenia", "Croatia": "Croacia", "Bosnia and Herz.": "Bosnia",
    "Serbia": "Serbia", "Montenegro": "Montenegro", "Albania": "Albania", "Macedonia": "Macedonia del Norte", "Kosovo": "Kosovo", "Greece": "Grecia",
    "Bulgaria": "Bulgaria", "Romania": "Rumania", "Moldova": "Moldavia", "Ukraine": "Ucrania", "Belarus": "Bielorrusia", "Russia": "Rusia",
    "Turkey": "Turquía", "Cyprus": "Chipre", "Georgia": "Georgia", "Armenia": "Armenia", "Azerbaijan": "Azerbaiyán", "Kazakhstan": "Kazajistán",
    "Uzbekistan": "Uzbekistán", "Turkmenistan": "Turkmenistán", "Kyrgyzstan": "Kirguistán", "Tajikistan": "Tayikistán", "Afghanistan": "Afganistán",
    "Pakistan": "Pakistán", "India": "India", "Nepal": "Nepal", "Bhutan": "Bután", "Bangladesh": "Bangladés", "Sri Lanka": "Sri Lanka", "China": "China",
    "Mongolia": "Mongolia", "North Korea": "Corea del Norte", "South Korea": "Corea del Sur", "Japan": "Japón", "Taiwan": "Taiwán", "Myanmar": "Myanmar",
    "Thailand": "Tailandia", "Laos": "Laos", "Vietnam": "Vietnam", "Cambodia": "Camboya", "Malaysia": "Malasia", "Singapore": "Singapur",
    "Indonesia": "Indonesia", "Philippines": "Filipinas", "Papua New Guinea": "Papúa Nueva Guinea", "Australia": "Australia", "New Zealand": "Nueva Zelanda",
    "Iran": "Irán", "Iraq": "Irak", "Syria": "Siria", "Lebanon": "Líbano", "Israel": "Israel", "Palestine": "Palestina", "Jordan": "Jordania",
    "Saudi Arabia": "Arabia Saudita", "Yemen": "Yemen", "Oman": "Omán", "United Arab Emirates": "Emiratos Árabes", "Qatar": "Catar", "Kuwait": "Kuwait",
    "Egypt": "Egipto", "Libya": "Libia", "Tunisia": "Túnez", "Algeria": "Argelia", "Morocco": "Marruecos", "W. Sahara": "Sahara Occidental",
    "Mauritania": "Mauritania", "Mali": "Malí", "Niger": "Níger", "Chad": "Chad", "Sudan": "Sudán", "S. Sudan": "Sudán del Sur", "Ethiopia": "Etiopía",
    "Eritrea": "Eritrea", "Somalia": "Somalia", "Kenya": "Kenia", "Uganda": "Uganda", "Tanzania": "Tanzania", "Rwanda": "Ruanda", "Nigeria": "Nigeria",
    "Ghana": "Ghana", "Senegal": "Senegal", "Côte d'Ivoire": "Costa de Marfil", "Cameroon": "Camerún", "Dem. Rep. Congo": "R. D. del Congo",
    "Congo": "Congo", "Angola": "Angola", "Zambia": "Zambia", "Zimbabwe": "Zimbabue", "Mozambique": "Mozambique", "Namibia": "Namibia",
    "Botswana": "Botsuana", "South Africa": "Sudáfrica", "Madagascar": "Madagascar", "Central African Rep.": "Rep. Centroafricana", "Gabon": "Gabón",
  };
  /* alias de entrada (en minúsculas, sin tildes) → properties.name */
  const ALIAS = {
    "usa": "United States of America", "us": "United States of America", "united states": "United States of America", "eeuu": "United States of America", "ee uu": "United States of America", "estados unidos": "United States of America",
    "uk": "United Kingdom", "great britain": "United Kingdom", "britain": "United Kingdom", "england": "United Kingdom", "czech republic": "Czechia",
    "dr congo": "Dem. Rep. Congo", "drc": "Dem. Rep. Congo", "democratic republic of the congo": "Dem. Rep. Congo", "ivory coast": "Côte d'Ivoire",
    "bosnia": "Bosnia and Herz.", "bosnia and herzegovina": "Bosnia and Herz.", "north macedonia": "Macedonia", "dominican republic": "Dominican Rep.",
    "central african republic": "Central African Rep.", "south sudan": "S. Sudan", "western sahara": "W. Sahara", "east timor": "Timor-Leste",
    "swaziland": "eSwatini", "eswatini": "eSwatini", "burma": "Myanmar", "holland": "Netherlands", "the netherlands": "Netherlands", "uae": "United Arab Emirates",
    "russian federation": "Russia", "korea": "South Korea", "republic of korea": "South Korea", "dprk": "North Korea", "vatican city": "Vatican",
  };
  const key = s => K.norm(s);

  let GEO = null;
  /** carga única: proyección base, Path2D por país, tierra unida, fronteras internas */
  function geo() {
    if (GEO) return GEO;
    const topo = window.KIT_WORLD_50m;
    if (!topo || !window.d3 || !window.topojson) { console.warn("[kit] atlas: falta vendor/geo (d3-geo / topojson / KIT_WORLD_50m)"); GEO = { ok: false, byKey: new Map(), feats: [] }; return GEO; }
    const BASE = 1000;
    const proj = d3.geoMercator().scale(BASE / (2 * Math.PI)).translate([BASE / 2, BASE / 2]);
    const P = d3.geoPath(proj);
    const geoms = topo.objects.countries.geometries.filter(g => g.properties.name !== "Antarctica");
    const fc = topojson.feature(topo, { type: "GeometryCollection", geometries: geoms });
    const byKey = new Map(), feats = [];
    for (const f of fc.features) {
      const path = new Path2D(); d3.geoPath(proj, path)(f);
      /* parte principal (el polígono más grande): para encuadre y alfiler (Francia sin Guayana, EE. UU. sin Alaska…) */
      let main = f.geometry;
      if (main.type === "MultiPolygon") {
        let best = -1, pick = null;
        for (const c of main.coordinates) { const g = { type: "Polygon", coordinates: c }, a = d3.geoArea(g); if (a > best) { best = a; pick = g; } }
        main = pick;
      }
      const b = P.bounds(main);
      let ll = d3.geoCentroid(main);
      if (!d3.geoContains(main, ll)) {                /* centroide afuera (Chile, Croacia…): punto interior más cercano */
        const gb = d3.geoBounds(main); let bd = 1e9, bp = ll;
        for (let i = 0; i <= 24; i++) for (let j = 0; j <= 24; j++) {
          const q = [lerp(gb[0][0], gb[1][0], i / 24), lerp(gb[0][1], gb[1][1], j / 24)];
          if (d3.geoContains(main, q)) { const d = Math.hypot(q[0] - ll[0], q[1] - ll[1]); if (d < bd) { bd = d; bp = q; } }
        }
        ll = bp;
      }
      const c = { name: f.properties.name, es: ES[f.properties.name] || f.properties.name, f, path, bounds: b, ll, xy: proj(ll), i: feats.length };
      feats.push(c); byKey.set(key(c.name), c); if (ES[c.name]) byKey.set(key(ES[c.name]), c);
    }
    for (const [a, n] of Object.entries(ALIAS)) { const c = byKey.get(key(n)); if (c) byKey.set(key(a), c); }
    const land = new Path2D(); P.context(land)(topojson.merge(topo, geoms)); P.context(null);
    const borders = new Path2D(); d3.geoPath(proj, borders)(topojson.mesh(topo, { type: "GeometryCollection", geometries: geoms }, (a, b) => a !== b));
    GEO = { ok: true, BASE, proj, feats, byKey, land, borders };
    return GEO;
  }
  /** país por nombre (inglés de properties.name, alias o español) */
  function country(name) {
    const G = geo(), c = G.byKey.get(key(name || ""));
    if (!c && name) console.warn("[kit] atlas: país desconocido", name);
    return c || null;
  }
  /** [lon,lat] → plano base */
  const toBase = ll => geo().ok ? geo().proj(ll) : [500, 500];

  /* regiones con nombre: bbox [lon0,lat0,lon1,lat1] */
  const REGIONS = {
    world: [-168, -56, 190, 78], europe: [-24, 35, 42, 70], "western-europe": [-11, 36, 20, 59], "eastern-europe": [12, 41, 42, 60],
    africa: [-19, -36, 52, 37], asia: [26, -10, 150, 58], "middle-east": [25, 12, 63, 42], "north-america": [-168, 14, -52, 72],
    "central-america": [-118, 6, -58, 33], "south-america": [-84, -56, -33, 13], "latin-america": [-118, -56, -33, 33], americas: [-168, -56, -33, 72],
    oceania: [110, -48, 180, 0], "east-asia": [95, 18, 146, 53], "southeast-asia": [92, -11, 142, 24], "south-asia": [60, 5, 98, 37], "central-asia": [46, 35, 88, 56],
  };
  function regionBounds(name) {
    const r = REGIONS[name] || REGIONS.world, a = toBase([r[0], r[3]]), b = toBase([r[2], r[1]]);
    return [[Math.min(a[0], b[0]), Math.min(a[1], b[1])], [Math.max(a[0], b[0]), Math.max(a[1], b[1])]];
  }
  const union = list => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const b of list) { x0 = Math.min(x0, b[0][0]); y0 = Math.min(y0, b[0][1]); x1 = Math.max(x1, b[1][0]); y1 = Math.max(y1, b[1][1]); } return [[x0, y0], [x1, y1]]; };

  /* ================================================================ cámara */
  /** caja de pantalla donde se encuadra (content, un poco más ancha: el mapa va a sangre) */
  function frameBox(st) {
    const c = st.content;
    return st.portrait ? { x: st.W * 0.05, y: c.y, w: st.W * 0.9, h: c.h, cx: st.W / 2, cy: c.y + c.h * 0.5 }
                       : { x: st.W * 0.08, y: c.y, w: st.W * 0.84, h: c.h, cx: st.W / 2, cy: c.y + c.h * 0.5 };
  }
  /** pose = { x, y (centro en plano base), s (px por unidad base) } que encuadra bounds con margen pad */
  function fitPose(st, b, pad = 1.1) {
    const fb = frameBox(st), bw = Math.max(1e-3, b[1][0] - b[0][0]), bh = Math.max(1e-3, b[1][1] - b[0][1]);
    return { x: (b[0][0] + b[1][0]) / 2, y: (b[0][1] + b[1][1]) / 2, s: Math.min(fb.w / (bw * pad), fb.h / (bh * pad)) };
  }
  /** grados de longitud → unidades base */
  const degU = d => d * 1000 / 360;
  /** pose centrada en un punto con un ancho visible de `span` grados (en la caja de encuadre) */
  function spanPose(st, xy, span) { const fb = frameBox(st); return { x: xy[0], y: xy[1], s: fb.w / degU(span) }; }
  /** escala de referencia (región de ~36°): los alfileres tienen tamaño pleno a esta escala */
  const refScale = st => frameBox(st).w / degU(36);

  /* ================================================================ alfiler */
  /* sello por defecto: emblema B/N como el de la referencia (aro dentado, anillo de "texto" y centro
     con iniciales), genérico y sin marca. r0 = radio del disco blanco */
  const EMBLEM = (G, r0, ink, text) => {
    G.fillStyle = ink;
    G.beginPath();
    for (let i = 0; i < 28; i++) { const a0 = i / 28 * Math.PI * 2, a1 = (i + 0.5) / 28 * Math.PI * 2; G.arc(0, 0, r0 * 0.86, a0, a1); G.arc(0, 0, r0 * 0.78, a1, (i + 1) / 28 * Math.PI * 2); }
    G.closePath(); G.fill();
    G.fillStyle = "#fff"; G.beginPath(); G.arc(0, 0, r0 * 0.7, 0, Math.PI * 2); G.fill();
    G.strokeStyle = ink; G.lineWidth = r0 * 0.035;
    for (let i = 0; i < 44; i++) { const a = i / 44 * Math.PI * 2, l = (i * 7 % 5) / 5; G.beginPath(); G.moveTo(Math.cos(a) * r0 * 0.66, Math.sin(a) * r0 * 0.66); G.lineTo(Math.cos(a) * r0 * (0.58 - l * 0.03), Math.sin(a) * r0 * (0.58 - l * 0.03)); G.stroke(); }
    G.lineWidth = r0 * 0.04; G.beginPath(); G.arc(0, 0, r0 * 0.5, 0, Math.PI * 2); G.stroke();
    if (text) { G.fillStyle = ink; G.font = font("label", r0 * (text.length > 2 ? 0.3 : 0.42)); G.textAlign = "center"; G.textBaseline = "middle"; G.fillText(text, 0, r0 * 0.03); }
    else { G.fillStyle = ink; G.beginPath(); G.arc(0, 0, r0 * 0.16, 0, Math.PI * 2); G.fill(); }
  };
  /** foto en B/N contrastado (como el sello de la referencia), cacheada */
  function seal(img) {
    if (!img) return null;
    return memo("seal:" + img.src, () => {
      const n = Math.min(img.width, img.height, 640), T = mk(n, n), sc = n / Math.min(img.width, img.height);
      T.g.filter = "grayscale(1) contrast(1.45) brightness(1.05)";
      T.g.drawImage(img, (n - img.width * sc) / 2, (n - img.height * sc) / 2, img.width * sc, img.height * sc);
      return T.c;
    });
  }
  /**
   * Alfiler negro tipo gota con la punta en (x,y); R = radio de la cabeza.
   * o = { src (img), focus, seal:"globe"|"initials"|"none", text (iniciales), alpha, P (paleta) }
   */
  function pin(G, x, y, R, o = {}) {
    const P = o.P || {}, ink = P.accentInk || "#0b0b0b", paper = P.ink || "#f8f8f8";
    const d = R * 1.5, th = Math.acos(R / d), tx = R * Math.sin(th), ty = -d + R * Math.cos(th);
    G.save(); G.translate(x, y); G.globalAlpha *= o.alpha ?? 1;
    const body = new Path2D();
    body.moveTo(0, 0); body.lineTo(tx, ty);
    body.arc(0, -d, R, Math.PI / 2 - th, Math.PI / 2 + th, true); body.closePath();
    G.shadowColor = "rgba(0,0,0,.35)"; G.shadowBlur = R * 0.25; G.shadowOffsetY = R * 0.08;
    G.fillStyle = ink; G.fill(body);
    G.shadowColor = "transparent";
    /* sello: disco blanco + aro negro fino + contenido */
    G.translate(0, -d);
    const r0 = R * 0.8;
    G.fillStyle = paper; G.beginPath(); G.arc(0, 0, r0, 0, Math.PI * 2); G.fill();
    const im = o.src ? seal(o.src) : null;
    if (im) {
      G.save(); G.beginPath(); G.arc(0, 0, r0 * 0.97, 0, Math.PI * 2); G.clip();
      const f = o.focus || [0.5, 0.5], n = im.width, z = r0 * 2 / n * 1.0;
      G.drawImage(im, -n * f[0] * z, -n * f[1] * z, n * z, n * z);
      G.restore();
      G.strokeStyle = ink; G.lineWidth = r0 * 0.06; G.beginPath(); G.arc(0, 0, r0 * 0.9, 0, Math.PI * 2); G.stroke();
    } else if (o.seal !== "none") EMBLEM(G, r0, ink, o.seal === "initials" ? o.text : "");
    G.restore();
  }
  /** etiqueta del país: negrita oscura con halo claro (se lee sobre gris y sobre blanco) */
  function label(G, text, x, y, px, o = {}) {
    if (!text) return 0;
    G.save(); G.globalAlpha *= o.alpha ?? 1;
    G.font = font("label", px); G.textBaseline = "middle"; G.textAlign = o.align || "left";
    G.shadowColor = o.halo || "rgba(255,255,255,.18)"; G.shadowBlur = px * 0.12;
    G.fillStyle = o.color || "#0d0d0d"; G.fillText(text, x, y);
    G.shadowColor = "transparent"; G.fillText(text, x, y);
    G.restore();
    return measure(text, "label", px);
  }

  /* ================================================================ línea de tiempo */
  /** params efectivos de un beat (defaults del componente sin avisos) */
  function paramsOf(def, raw) { const p = {}; for (const [k, s] of Object.entries(def.params || {})) p[k] = raw && raw[k] !== undefined ? raw[k] : s.default; return p; }

  /**
   * Recorre los beats y arma la línea de tiempo del mundo:
   *  cams  [{ t, dur, pose|bounds|span…, push }]
   *  paint [{ t, c (país), m (0 base · .35 gris · 1 blanco), blink }]
   *  pins  [{ t, xy, label, sub, src, seal, side, quiet, group }]
   *  lines [{ t, dur, pts (base), style, until }]
   *  tags  [{ t, xy, text, until }]
   *  clears [t]
   */
  function build(ctx, S) {
    const st = ctx.stage, ev = { cams: [], paint: [], pins: [], lines: [], tags: [], clears: [] };
    const A = Kit.atlas;
    for (const b of ctx.beats) {
      const def = K.registry.get(b.use);
      if (!def || typeof def.world !== "function") continue;
      let list = [];
      try { list = def.world(paramsOf(def, b.params), b, A, st) || []; } catch (e) { console.error("[kit] atlas world()", b.use, e); }
      for (const e of list) {
        const t = b.t0 + (e.at || 0);
        if (e.cam) ev.cams.push({ ...e.cam, t, i: b.i });
        if (e.paint) ev.paint.push({ ...e.paint, t });
        if (e.pin) ev.pins.push({ ...e.pin, t, until: e.pin.until != null ? b.t0 + e.pin.until : null });
        if (e.line) ev.lines.push({ ...e.line, t, until: e.line.until != null ? b.t0 + e.line.until : null });
        if (e.tag) ev.tags.push({ ...e.tag, t, until: e.tag.until != null ? b.t0 + e.tag.until : null });
        if (e.clear) ev.clears.push(t);
      }
    }
    const by = (a, b) => a.t - b.t;
    ev.cams.sort(by); ev.paint.sort(by); ev.pins.sort(by); ev.lines.sort(by); ev.tags.sort(by); ev.clears.sort((a, b) => a - b);
    /* poses objetivo + pose de partida de cada movimiento (pura: depende solo de los anteriores) */
    const world = fitPose(st, regionBounds("world"), 1.02);
    S.worldPose = world;
    ev.cams.forEach(c => { c.target = c.pose ? c.pose(st) : world; });
    ev.cams.forEach((c, k) => {
      c.from = k === 0 ? (c.fromPose ? c.fromPose(st) : (c.startWorld === false ? c.target : world)) : camAt(ev.cams, k - 1, c.t);
      if (c.dur === "auto" || c.dur == null) {
        const d = Math.hypot(c.target.x - c.from.x, c.target.y - c.from.y) * Math.min(c.target.s, c.from.s) / Math.max(1, frameBox(st).w);
        c.dur = clamp(0.5 + d * 0.45 + Math.abs(Math.log(c.target.s / c.from.s)) * 0.3, 0.5, 1.7);
      }
    });
    /* alfileres: el siguiente (de cualquier beat) achica al anterior */
    ev.pins.forEach((p, k) => { const nx = ev.pins.slice(k + 1).find(q => !q.quiet && q.t > p.t); p.next = nx ? nx.t : null; p.big = !p.quiet; });
    S.ev = ev; S.W = st.W; S.H = st.H;
  }
  /** pose de la cámara k en el tiempo t (incluye la deriva lenta después de llegar) */
  function camAt(cams, k, t) {
    const c = cams[k], q = clamp((t - c.t) / (c.dur || 0.6)), e = c.ease === "linear" ? q : ease.inOut(q);
    const s0 = c.from.s, s1 = c.target.s, s = Math.exp(lerp(Math.log(s0), Math.log(s1), e));
    /* centro: zoom hacia el punto (interpola en 1/s) cuando cambia mucho la escala */
    let qc = e;
    if (Math.abs(Math.log(s1 / s0)) > 0.2) qc = clamp((1 / s0 - 1 / s) / (1 / s0 - 1 / s1));
    const x = lerp(c.from.x, c.target.x, qc), y = lerp(c.from.y, c.target.y, qc);
    const held = Math.max(0, t - c.t - (c.dur || 0.6)), push = c.push ?? 0.012;
    const dz = 1 + push * 6 * (1 - Math.exp(-held / 6));
    return { x: x + (c.drift ?? 0) * held, y, s: s * dz };
  }
  function poseAt(S, t) {
    const cams = S.ev.cams;
    let k = -1; for (let i = 0; i < cams.length; i++) if (cams[i].t <= t) k = i; else break;
    if (k < 0) return cams.length ? cams[0].from : S.worldPose;
    return camAt(cams, k, t);
  }
  /** valor de pintura (0..1) de un país en t con el parpadeo de 8 cuadros de la referencia */
  const BLINK = [0.38, 0.72, 0.72, 0.15, 1, 0.5, 0.5, 1];
  function paintAt(S, t) {
    const out = new Map(), lastClear = S.ev.clears.filter(x => x <= t).pop() ?? -1e9;
    for (const e of S.ev.paint) {
      if (e.t > t) break;
      if (e.t < lastClear) continue;
      const prev = out.get(e.c.i)?.m1 ?? 0, fr = Math.floor((t - e.t) * FPS);
      let m = e.m;
      if (e.blink !== false && fr < BLINK.length) m = prev + (e.m - prev) * BLINK[fr];
      else if (e.blink === false) m = lerp(prev, e.m, clamp((t - e.t) / 0.35));
      out.set(e.c.i, { c: e.c, m, m1: e.m });
    }
    /* después de un "clear" lo pintado se apaga en 0,4 s */
    const fade = clamp((t - lastClear) / 0.4);
    if (fade < 1) for (const e of S.ev.paint) { if (e.t >= lastClear) break; if (!out.has(e.c.i)) out.set(e.c.i, { c: e.c, m: e.m * (1 - fade), m1: 0 }); }
    return out;
  }

  /* ================================================================ dibujo */
  /** proyección perspectiva: plano (X,Y relativos al centro, px) → pantalla */
  function persp(S, X, Y) {
    const th = S.tilt, f = S.f, z = -Y * Math.sin(th), k = f / (f + z);
    return [S.ox + X * k, S.oy + Y * Math.cos(th) * k, k];
  }
  /** plano base → pantalla para la pose actual */
  function project(S, pose, xy) { return persp(S, (xy[0] - pose.x) * pose.s, (xy[1] - pose.y) * pose.s); }

  function ensureFlat(ctx, S) {
    const st = ctx.stage, dpr = ctx.dpr, th = S.tilt, f = S.f;
    const Yof = ys => ys * f / (f * Math.cos(th) + ys * Math.sin(th));
    const top = Yof(-S.oy), bot = Yof(st.H - S.oy);
    const kTop = f / (f - top * Math.sin(th));
    const half = Math.max(S.ox, st.W - S.ox) / Math.min(1, kTop) + 2;
    S.flatTop = top; S.flatBot = bot; S.flatHalf = half; S.Yof = Yof;
    const w = Math.ceil(half * 2 * dpr), h = Math.ceil((bot - top) * dpr) + 2;
    if (!S.flat || S.flat.c.width !== w || S.flat.c.height !== h) { S.flat = mk(w, h); S.glow = { a: mk(w / 4, h / 4), b: mk(w / 4, h / 4) }; }
    if (!S.tmp || S.tmp.c.width !== ctx.layers.bg.width || S.tmp.c.height !== ctx.layers.bg.height) S.tmp = mk(ctx.layers.bg.width, ctx.layers.bg.height);
  }

  /** dibuja el plano del mapa (sin perspectiva) en S.flat para la pose */
  function drawFlat(ctx, S, pose, t) {
    const P = ctx.C.palette, Gd = geo(), dpr = ctx.dpr, { g, c } = S.flat, st = ctx.stage, u = st.u;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = P.bg; g.fillRect(0, 0, c.width, c.height);
    if (!Gd.ok) return;
    const s = pose.s, zf = clamp(Math.sqrt(s / refScale(st)), 0.3, 1.15);
    const tx = S.flatHalf - pose.x * s, ty = -S.flatTop - pose.y * s;
    /* copias a ±360° si la vista cruza el antimeridiano */
    const left = (-S.flatHalf) / s + pose.x, right = S.flatHalf / s + pose.x;
    const offs = [0]; if (left < 0) offs.push(-1000); if (right > 1000) offs.push(1000);
    const paint = paintAt(S, t), lw = px => px / s;
    const ext = st.H * 0.0125 * zf * (ctx.C.atlas?.glow ?? 1);         /* alto de la pared de extrusión (px) */
    for (const ox of offs) {
      g.setTransform(dpr * s, 0, 0, dpr * s, dpr * (tx + ox * s), dpr * ty);
      /* 1 · resplandor + pared de extrusión: copia azul profunda abajo, cian encima, la tierra tapa el resto */
      if (ext > 0.3) {
        /* resplandor: la tierra a 1/4 de resolución, desenfocada ahí (barato) y escalada encima */
        const GL = S.glow, k = 0.25;
        GL.a.g.setTransform(1, 0, 0, 1, 0, 0); GL.a.g.clearRect(0, 0, GL.a.c.width, GL.a.c.height);
        GL.a.g.setTransform(dpr * s * k, 0, 0, dpr * s * k, dpr * (tx + ox * s) * k, dpr * (ty + ext * 1.05) * k);
        GL.a.g.fillStyle = "rgba(86,226,242,.55)"; GL.a.g.fill(Gd.land);
        GL.b.g.setTransform(1, 0, 0, 1, 0, 0); GL.b.g.clearRect(0, 0, GL.b.c.width, GL.b.c.height);
        GL.b.g.filter = `blur(${(ext * 1.2 * dpr * k).toFixed(2)}px)`; GL.b.g.drawImage(GL.a.c, 0, 0); GL.b.g.filter = "none";
        g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(GL.b.c, 0, 0, GL.b.c.width / k, GL.b.c.height / k); g.restore();
        g.save(); g.translate(0, ext * 1.05 / s);
        g.fillStyle = P.deep || "#1650b8"; g.fill(Gd.land);
        g.restore();
        g.save(); g.translate(0, ext * 0.72 / s); g.fillStyle = P.accent; g.fill(Gd.land); g.restore();
        g.save(); g.translate(0, ext * 0.3 / s); g.fillStyle = "#a9f3fb"; g.globalAlpha = 0.55; g.fill(Gd.land); g.restore();
      }
      /* 2 · tierra */
      g.fillStyle = P.land || "#353535"; g.fill(Gd.land);
      /* 3 · países pintados */
      for (const { c: cc, m } of paint.values()) {
        if (m <= 0.002) continue;
        g.fillStyle = mix(P.land || "#353535", P.ink, clamp(m)); g.fill(cc.path);
      }
      /* 4 · líneas (rutas, fronteras, muros) debajo del trazo de bordes */
      for (const L of S.ev.lines) {
        if (L.t > t) break;
        const q = prog(t, L.t, L.dur ?? 1.2, "inOut"), out = L.until != null ? 1 - clamp((t - L.until) / 0.4) : 1;
        if (q <= 0 || out <= 0) continue;
        drawLine(g, L, q, out, s, P, u);
      }
      /* 5 · fronteras internas y costa: negro fino */
      g.strokeStyle = P.line || "#0d0d0d"; g.lineJoin = "round";
      g.lineWidth = lw(Math.max(0.55, u * 0.11 * Math.max(0.7, zf))); g.stroke(Gd.borders);
      g.lineWidth = lw(Math.max(0.5, u * 0.09)); g.stroke(Gd.land);
    }
  }
  /** línea en el plano base: style wall (muro: negro grueso con canto cian) · route (blanca punteada) · border (negra punteada) */
  function drawLine(g, L, q, out, s, P, u) {
    const pts = L.pts; if (!pts || pts.length < 2) return;
    let tot = 0; const seg = []; for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(l); tot += l; }
    const lim = tot * q, path = new Path2D(); path.moveTo(pts[0][0], pts[0][1]);
    let acc = 0, end = pts[0];
    for (let i = 1; i < pts.length; i++) {
      if (acc + seg[i - 1] >= lim) { const r = (lim - acc) / (seg[i - 1] || 1); end = [lerp(pts[i - 1][0], pts[i][0], r), lerp(pts[i - 1][1], pts[i][1], r)]; path.lineTo(end[0], end[1]); break; }
      acc += seg[i - 1]; end = pts[i]; path.lineTo(end[0], end[1]);
    }
    const w = (L.width ?? 1) * u / s;
    g.save(); g.globalAlpha *= out; g.lineCap = "round"; g.lineJoin = "round";
    if (L.style === "wall") {
      g.strokeStyle = P.accent; g.lineWidth = w * 1.9; g.shadowColor = P.accent; g.shadowBlur = u * 1.6; g.stroke(path);
      g.shadowColor = "transparent"; g.strokeStyle = P.line || "#0d0d0d"; g.lineWidth = w * 1.2; g.stroke(path);
    } else if (L.style === "border") {
      g.setLineDash([w * 1.6, w * 1.1]); g.strokeStyle = P.line || "#0d0d0d"; g.lineWidth = w * 0.55; g.stroke(path);
    } else {
      g.strokeStyle = P.line || "#0d0d0d"; g.lineWidth = w * 0.95; g.setLineDash([w * 2.2, w * 1.2]); g.stroke(path);
      g.strokeStyle = P.ink; g.lineWidth = w * 0.5; g.stroke(path);
      g.setLineDash([]);
      if (q > 0.02 && L.arrow !== false) {             /* punta de flecha que viaja con el trazo */
        const n = pts.length; let a = pts[n - 2] || pts[0];
        if (q < 1) { const k = Math.max(1, Math.min(n - 1, Math.ceil(q * (n - 1)))); a = pts[k - 1]; }
        const ang = Math.atan2(end[1] - a[1], end[0] - a[0]), hl = w * 2.6;
        g.fillStyle = P.ink; g.strokeStyle = P.line || "#0d0d0d"; g.lineWidth = w * 0.3;
        g.beginPath(); g.moveTo(end[0] + Math.cos(ang) * hl * 0.5, end[1] + Math.sin(ang) * hl * 0.5);
        g.lineTo(end[0] + Math.cos(ang + 2.5) * hl, end[1] + Math.sin(ang + 2.5) * hl);
        g.lineTo(end[0] + Math.cos(ang - 2.5) * hl, end[1] + Math.sin(ang - 2.5) * hl); g.closePath(); g.fill(); g.stroke();
      }
    }
    g.restore();
  }

  /** copia el plano a la pantalla con perspectiva (franjas horizontales) */
  function blit(ctx, S) {
    const G = ctx.g.bg, dpr = ctx.dpr, st = ctx.stage, src = S.flat.c;
    G.save(); G.setTransform(1, 0, 0, 1, 0, 0); G.imageSmoothingEnabled = true;
    if (S.tilt <= 0.001) {
      G.drawImage(src, (S.flatHalf - S.ox) * dpr, (-S.flatTop - S.oy) * dpr, st.W * dpr, st.H * dpr, 0, 0, st.W * dpr, st.H * dpr);
    } else {
      const step = 3 / dpr;                               /* franjas de 3 px de dispositivo */
      for (let ys = -S.oy; ys < st.H - S.oy; ys += step) {
        const Y0 = S.Yof(ys), Y1 = S.Yof(ys + step), k = S.f / (S.f - ((Y0 + Y1) / 2) * Math.sin(S.tilt));
        const sy = (Y0 - S.flatTop) * dpr, sh = Math.max(0.5, (Y1 - Y0) * dpr);
        const dw = S.flatHalf * 2 * k * dpr, dx = (S.ox - S.flatHalf * k) * dpr;
        G.drawImage(src, 0, sy, src.width, sh, dx, (ys + S.oy) * dpr, dw, step * dpr + 0.6);
      }
    }
    G.restore();
  }

  /** alfileres, rótulos y etiquetas (en pantalla, de pie: no se inclinan con el plano) */
  function drawPins(ctx, S, pose, t) {
    const G = ctx.g.bg, st = ctx.stage, u = st.u, P = ctx.C.palette;
    const lastClear = S.ev.clears.filter(x => x <= t).pop() ?? -1e9, fadeOld = 1 - clamp((t - lastClear) / 0.35);
    const zf = clamp(Math.sqrt(pose.s / refScale(st)), 0.9, 1.1);
    const Rbig = u * 11 * zf, Rsmall = u * 6.6 * zf;   /* medidos en la referencia: cabeza 0,22·H (activo) y 0,13·H (anteriores) */
    /* rótulos sueltos (lados de una frontera, ciudades) */
    for (const T of S.ev.tags) {
      if (T.t > t) break;
      const a = prog(t, T.t, 0.3, "linear") * (T.until != null ? 1 - clamp((t - T.until) / 0.35) : 1) * (T.t < lastClear ? fadeOld : 1);
      if (a <= 0) continue;
      const [x, y] = project(S, pose, T.xy), px = u * (T.size ?? 3.4) * Math.max(0.7, Math.min(1, zf * 1.1));
      const q = prog(t, T.t, 0.22, "out");
      label(G, T.text, x + (1 - q) * px * 0.8 * (T.align === "right" ? 1 : -1), y, px, { alpha: a, align: T.align || "center", color: T.color === "dark" ? undefined : P.ink, halo: T.color === "dark" ? undefined : "rgba(0,0,0,.9)" });
    }
    const live = [];
    for (const p of S.ev.pins) {
      if (p.t > t) break;
      const old = p.t < lastClear;
      if (old && fadeOld <= 0) continue;
      if (p.until != null && t > p.until + 0.3) continue;
      live.push(p);
    }
    /* los chicos primero (ordenados por y), el activo arriba de todo */
    const pos = live.map(p => { const [x, y] = project(S, pose, p.xy); return { p, x, y }; });
    pos.sort((a, b) => (a.p.next == null || a.p.next > t ? 1 : 0) - (b.p.next == null || b.p.next > t ? 1 : 0) || a.y - b.y);
    for (const { p, x, y } of pos) {
      const ap = t - p.t, old = p.t < lastClear;
      let a = old ? fadeOld : 1;
      if (p.until != null) a *= 1 - clamp((t - p.until) / 0.3);
      /* tamaño: grande mientras es el último; al caer el siguiente se achica en 0,25 s */
      const shrink = p.next != null ? prog(t, p.next, 0.25, "inOut") : 0;
      let R = p.quiet ? Rsmall : lerp(Rbig, Rsmall, shrink);
      if (p.size) R *= p.size;
      if (x < -R * 3 || x > st.W + R * 3 || y < -R * 4 || y > st.H + R * 4) continue;
      const src = p.src ? ctx.img(p.src) : null, o = { P, src, focus: p.focus, seal: p.seal, text: p.initials };
      if (p.quiet) { pin(G, x, y, R, { ...o, alpha: a * prog(t, p.t, 0.25, "linear") }); continue; }
      /* caída: 3 cuadros con estela vertical, rebote de escala amortiguado */
      const qd = clamp(ap / 0.12), dy = -(1 - ease.out(qd)) * R * 1.3;
      const sc = ap < 0.12 ? lerp(0.72, 1.12, qd) : 1 + 0.12 * Math.exp(-(ap - 0.12) * 13) * Math.cos((ap - 0.12) * 26);
      if (qd < 1) for (let k = 3; k >= 1; k--) pin(G, x, y + dy - k * R * 0.32 * (1 - qd), R * sc, { ...o, alpha: a * 0.18 * qd });
      pin(G, x, y + dy, R * sc, { ...o, alpha: a * clamp(qd * 1.6) });
      /* etiqueta: sale de atrás del alfiler con desenfoque horizontal; se apaga cuando cae el siguiente */
      if (p.label) {
        const la = a * (p.next != null && !p.keepLabel ? 1 - clamp((t - p.next) / 0.15) : 1) * (p.labelUntil != null ? 1 - clamp((t - p.labelUntil) / 0.2) : 1);
        const lq = prog(t, p.t + (p.labelAt ?? 0.36), 0.18, "out");
        if (la > 0 && lq > 0) {
          const px = u * (p.labelSize ?? 5.4), headY = y - R * 1.5;
          const tw = measure(p.label, "label", px);
          const side = p.side === "left" || p.side === "right" ? p.side : (x + R * 1.1 + tw > st.W - u * 3 ? "left" : "right");
          const dir = side === "right" ? 1 : -1, x0 = x + dir * R * 1.05, slide = (1 - lq) * R * 0.9 * dir;
          const lx = side === "right" ? x0 : x0 - tw;
          const yl = headY + (p.sub ? -px * 0.32 : 0);
          for (let k = 2; k >= 1 && lq < 1; k--) label(G, p.label, lx + slide - dir * k * R * 0.28 * (1 - lq), yl, px, { alpha: la * 0.22 * lq });
          label(G, p.label, lx + slide, yl, px, { alpha: la * clamp(lq * 1.5) });
          if (p.sub) {
            /* chip blanco con texto negro (se lee sobre océano, tierra y países blancos) */
            const sp = px * 0.5, txt = String(p.sub).toUpperCase(), sq = prog(t, p.t + (p.labelAt ?? 0.36) + 0.1, 0.22, "out");
            G.save(); G.globalAlpha *= la * clamp(sq * 1.5);
            G.font = font("ui", sp, 800); G.letterSpacing = sp * 0.1 + "px"; G.textBaseline = "middle"; G.textAlign = "left";
            const w = G.measureText(txt).width + sp * 0.9, hh = sp * 1.55, cx0 = side === "right" ? x0 + slide : x0 + slide - w, cy0 = yl + px * 0.62;
            G.shadowColor = "rgba(0,0,0,.45)"; G.shadowBlur = sp * 0.5; G.fillStyle = P.ink; G.fillRect(cx0, cy0, w * sq, hh);
            G.shadowColor = "transparent"; G.fillStyle = P.accentInk || "#0b0b0b"; G.beginPath(); G.rect(cx0, cy0, w * sq, hh); G.clip(); G.fillText(txt, cx0 + sp * 0.5, cy0 + hh * 0.54);
            G.restore();
          }
        }
      }
    }
  }

  /** nivel de oscurecido del mapa en t según los beats principales activos */
  function dimAt(ctx, t) {
    const mains = ctx.beats.filter(b => b.layer === "main" && t >= b.t0);
    if (!mains.length) return 0;
    const lv = b => { const d = K.registry.get(b.use); if (!d) return 1; const m = d.mapDim; if (m == null) return d.name?.startsWith("atlas.") ? 0 : 1; return typeof m === "function" ? m(paramsOf(d, b.params), b, t - b.t0) : m; };
    const cur = mains[mains.length - 1], prev = mains[mains.length - 2];
    const a = prev ? lv(prev) : (cur.t0 > 0.01 ? 0 : lv(cur)), b = lv(cur);
    return lerp(a, b, prog(t, cur.t0, 0.45, "inOut"));
  }

  /* ================================================================ runtime */
  K.family("atlas", {
    setup(ctx) {
      geo();
      if (!document.getElementById("atlas-css")) {
        const s = document.createElement("style"); s.id = "atlas-css";
        s.textContent = `[data-family="atlas"] .k-cap{font-family:'PT Sans Narrow',sans-serif;font-weight:700;letter-spacing:.01em;color:rgba(238,238,236,.72);font-size:clamp(17px,4vmin,50px);text-shadow:0 0 .32em #000,0 2px 16px rgba(0,0,0,.95)}
[data-family="atlas"] .k-w-cur{color:#fff;font-weight:700}
[data-family="atlas"] .k-punch{font-family:'PT Sans Narrow',sans-serif;font-weight:700;letter-spacing:0;line-height:.9;text-shadow:0 4px 30px rgba(0,0,0,.7)}`;
        document.head.appendChild(s);
      }
      return {};
    },
    frame(t, ctx, S) {
      const st = ctx.stage, A = ctx.C.atlas || {};
      if (!S.ev || S.W !== st.W || S.H !== st.H) {
        S.tilt = (A.tilt ?? 16) * Math.PI / 180; S.f = (A.focal ?? 1.7) * st.H;
        const fb = frameBox(st); S.ox = st.W / 2; S.oy = fb.cy;
        build(ctx, S);
      }
      ensureFlat(ctx, S);
      const pose = poseAt(S, t);
      S.pose = pose; S.t = t;
      drawFlat(ctx, S, pose, t);
      blit(ctx, S);
      drawPins(ctx, S, pose, t);
      const G = ctx.g.bg, { W, H, u } = st;
      /* luz: centro un poco más claro, esquinas oscuras (viñeta de la referencia) */
      const vg = G.createRadialGradient(W / 2, H * 0.42, Math.min(W, H) * 0.2, W / 2, H * 0.48, Math.hypot(W, H) * 0.62);
      vg.addColorStop(0, "rgba(255,250,240,0.035)"); vg.addColorStop(0.55, "rgba(0,0,0,0)"); vg.addColorStop(1, `rgba(8,7,5,${0.62 * (A.vignette ?? 1)})`);
      G.fillStyle = vg; G.fillRect(0, 0, W, H);
      /* oscurecido + desenfoque (títulos, cifras, letra grande, cierre) */
      const d = dimAt(ctx, t);
      S.dim = d;
      if (d > 0.005) {
        const T = S.tmp, c = ctx.layers.bg;
        T.g.setTransform(1, 0, 0, 1, 0, 0); T.g.clearRect(0, 0, T.c.width, T.c.height); T.g.drawImage(c, 0, 0);
        G.save(); G.setTransform(1, 0, 0, 1, 0, 0);
        G.filter = `blur(${(d * u * 0.55 * ctx.dpr).toFixed(1)}px)`; G.drawImage(T.c, 0, 0); G.filter = "none";
        G.fillStyle = `rgba(10,10,8,${(d * 0.72).toFixed(3)})`; G.fillRect(0, 0, c.width, c.height);
        G.restore();
      }
      /* banda oscura suave debajo de los subtítulos (se leen sobre países blancos) */
      if (ctx.C.captions?.enabled !== false) {
        const y0 = st.caption.y - u * 2, gb = G.createLinearGradient(0, y0, 0, st.caption.y + st.caption.h + u * 2);
        gb.addColorStop(0, "rgba(0,0,0,0)"); gb.addColorStop(0.5, "rgba(0,0,0,.42)"); gb.addColorStop(1, "rgba(0,0,0,0)");
        G.fillStyle = gb; G.fillRect(0, y0, W, st.caption.h + u * 4);
      }
    },
    resize(ctx, S) { S.ev = null; },
  });

  K.atlas = {
    FPS, F, font, measure, fit, memo, mk, mix, geo, country, toBase, REGIONS, regionBounds, union, frameBox, fitPose, spanPose, degU, refScale,
    pin, label, seal, ES,
    /** estado del mapa en el cuadro actual (pose, oscurecido) y proyección a pantalla */
    state: ctx => ctx.family?.atlas || {},
    screen(ctx, xy) { const S = ctx.family?.atlas; if (!S || !S.pose) return [ctx.stage.W / 2, ctx.stage.H / 2, 1]; return project(S, S.pose, xy); },
    /**
     * Pose de cámara para un componente (función de la etapa, se recalcula si cambia el tamaño).
     * o = { region, countries:[…], country, center:[lon,lat], span (°), zoom (multiplica), pad }
     */
    camFor(o) {
      return st => {
        let pose;
        if (o.center && o.span) pose = spanPose(st, toBase(o.center), o.span);
        else if (o.countries && o.countries.length) {
          const cs = o.countries.map(country).filter(Boolean);
          pose = cs.length ? fitPose(st, union(cs.map(c => c.bounds)), o.pad ?? 1.35) : fitPose(st, regionBounds("world"), 1.02);
          const minS = frameBox(st).w / degU(o.minSpan ?? 34); if (pose.s > minS) pose.s = minS;
        } else if (o.country) {
          const c = country(o.country);
          if (!c) pose = fitPose(st, regionBounds("world"), 1.02);
          else {
            const xy = o.pin ? toBase(o.pin) : c.xy, bw = c.bounds[1][0] - c.bounds[0][0], bh = c.bounds[1][1] - c.bounds[0][1];
            const fb = frameBox(st), span = Math.max(degU(o.span ?? (st.portrait ? 19 : 28)), bw * 2.2, bh * 1.25 * fb.w / fb.h);
            pose = { x: (c.bounds[0][0] + c.bounds[1][0]) / 2 * 0.5 + xy[0] * 0.5, y: (c.bounds[0][1] + c.bounds[1][1]) / 2 * 0.5 + xy[1] * 0.5, s: fb.w / span };
            if (o.span) pose.s = fb.w / degU(o.span);
          }
        } else pose = fitPose(st, regionBounds(o.region || "world"), o.region && o.region !== "world" ? 1.08 : 1.02);
        if (o.zoom) pose.s *= o.zoom;
        if (o.shift) pose.y -= o.shift * frameBox(st).h / pose.s;          /* baja el objetivo en pantalla (deja lugar arriba) */
        if (o.offset) { pose.x += o.offset[0] / pose.s; pose.y += o.offset[1] / pose.s; }
        return pose;
      };
    },
    /** salida estándar de lo que dibuja un componente en el solape posterior: 1 → 0 */
    outA: (lt, b, post = 0.6) => 1 - clamp((lt - b.dur) / post),
  };
})();
