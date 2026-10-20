/* =============================================================================
   imperio · runtime de la familia "atlas histórico con el sol del imperio"
   -----------------------------------------------------------------------------
   Mapa físico estilo atlas dibujado con d3-geo + topojson + KIT_WORLD_50m
   (vendor/geo): océano azul grisáceo, tierras blanco/gris con relieve sombreado
   generado con ruido con semilla, territorios del imperio rayados en diagonal,
   el "sol" carmesí sobre el país foco, rayos translúcidos en abanico, barcos,
   rosa de los vientos, foto de archivo en B/N fundida en multiplicar, grano.

   Cámara = transformación afín del plano Mercator (centro lon/lat, span en
   grados, giro). Los Path2D del mundo se arman UNA vez en coordenadas Mercator
   (escala 1000) y cada cuadro solo cambia la matriz → barato y determinista.
   Todo es función de t (sin Math.random, sin Date, sin timers).

   API en Kit.imperio (IM):
     IM.COL                         colores medidos en la referencia
     IM.world() / IM.feature(name)  topología y países (nombres en inglés o alias en español)
     IM.atlas(lon0)                 proyección + Path2D (tierra, países) cacheados
     IM.countryCam(name, k, rot)    cámara que encuadra un país (k = factor de span)
     IM.cam(v)                      normaliza [lon,lat,span,rot] | {lon,lat,span,rot} | "País"
     IM.mixCam(a, b, q)             interpolación (span geométrico)
     IM.camOf(ctx, beat)            cámara {from,to,ease} de un beat con mapa (continuidad entre beats)
     IM.view(st, cam)               matriz de pantalla {m, k, rot, pt(lon,lat)}
     IM.drawMap(G, st, cam, look)   dibuja el atlas
     IM.sun / IM.rays / IM.ship / IM.compass / IM.native / IM.word / IM.bw / IM.smoke
     IM.surface(ctx)                lienzo propio para fundir planos
   ========================================================================== */
(function () {
  "use strict";
  const K = window.Kit, { clamp, lerp, prog, ease } = K;
  const NATIVE_FONT = "'Noto Sans JP', 'Noto Sans CJK JP', 'Noto Sans', sans-serif";
  for (const f of ["400 100px 'Fjalla One'", "700 100px Montserrat", "800 100px Montserrat", "italic 500 100px Montserrat", "600 100px Montserrat", `700 100px ${NATIVE_FONT}`]) K.fonts.add(f);

  const COL = {
    ocean: "#7f9bab", shallow: "#a9c1cc", land: "#d6d7d2", hatchBg: "#bdbfbb", hatch: "#6c6f6c",
    coast: "rgba(70,82,90,.38)", sun: "#66001a", sunHi: "#76001f", ray: "#760b24", rayMul: "#a8606e"   /* multiplicado sobre el océano da #635f70–#706779 (medido en la ref, t 5–9 s) */, native: "#4d5a66",
    sub: "#0f1a24", title: "#f4f4f6", ship: "#3d4952", label: "rgba(232,240,244,.78)", dark: "#0d0d0d",
  };
  const IM = K.imperio = { COL, NATIVE_FONT };
  const canvas = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
  IM.canvas = canvas;
  IM.fi = t => Math.floor(t * 24);
  const D2R = Math.PI / 180, UPD = 1000 * D2R;           /* unidades Mercator por grado (escala 1000) */

  /* ---------------------------------------------------------------- color */
  const hex = h => { const s = h.replace("#", ""); return [0, 2, 4].map(i => parseInt(s.slice(i, i + 2), 16)); };
  /** mezcla un color hex hacia su gris (g = 0..1) y lo oscurece/aclara (k multiplicador) */
  IM.tone = (h, g = 0, k = 1, a = 1) => {
    const [r, gg, b] = hex(h), l = r * 0.3 + gg * 0.59 + b * 0.11;
    const f = v => Math.round(clamp(lerp(v, l, g) * k, 0, 255));
    return `rgba(${f(r)},${f(gg)},${f(b)},${a})`;
  };

  /* ---------------------------------------------------------------- texturas (ruido con semilla) */
  function noise(size, cells, r) {                        /* ruido de valor ENLOSABLE */
    const g = new Float32Array(cells * cells); for (let i = 0; i < g.length; i++) g[i] = r();
    const out = new Float32Array(size * size), s = t => t * t * (3 - 2 * t);
    for (let y = 0; y < size; y++) {
      const fy = y / size * cells, iy = Math.floor(fy), ty = s(fy - iy), y0 = iy % cells, y1 = (iy + 1) % cells;
      for (let x = 0; x < size; x++) {
        const fx = x / size * cells, ix = Math.floor(fx), tx = s(fx - ix), x0 = ix % cells, x1 = (ix + 1) % cells;
        const a = lerp(g[y0 * cells + x0], g[y0 * cells + x1], tx), b = lerp(g[y1 * cells + x0], g[y1 * cells + x1], tx);
        out[y * size + x] = lerp(a, b, ty);
      }
    }
    return out;
  }
  function fbm(size, base, oct, r, ridged = false) {
    const out = new Float32Array(size * size); let amp = 1, tot = 0;
    for (let o = 0; o < oct; o++) {
      const n = noise(size, base << o, r);
      for (let i = 0; i < out.length; i++) out[i] += amp * (ridged ? 1 - Math.abs(2 * n[i] - 1) : n[i]);
      tot += amp; amp *= 0.5;
    }
    for (let i = 0; i < out.length; i++) out[i] /= tot;
    return out;
  }
  /* ruido de gradiente PERIÓDICO (enlosable): octavas con períodos P·2^o; coordenadas u,v en 0..1 */
  function perlin(P, r) {
    const gx = new Float32Array(P * P), gy = new Float32Array(P * P);
    for (let i = 0; i < P * P; i++) { const a = r() * Math.PI * 2; gx[i] = Math.cos(a); gy[i] = Math.sin(a); }
    return (x, y) => {
      const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
      const g = (cx, cy, dx, dy) => { const k = (((cy % P) + P) % P) * P + (((cx % P) + P) % P); return gx[k] * dx + gy[k] * dy; };
      const su = fx * fx * fx * (fx * (fx * 6 - 15) + 10), sv = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
      return lerp(lerp(g(ix, iy, fx, fy), g(ix + 1, iy, fx - 1, fy), su), lerp(g(ix, iy + 1, fx, fy - 1), g(ix + 1, iy + 1, fx - 1, fy - 1), su), sv);
    };
  }
  const perlinSet = (P, oct, r) => Array.from({ length: oct }, (_, o) => ({ f: perlin(P << o, r), P: P << o }));
  const fbmAt = (set, u, v) => { let s = 0, a = 1, t = 0; for (const n of set) { s += a * n.f(u * n.P, v * n.P); t += a; a *= 0.5; } return s / t * 1.6; };
  const ridgedAt = (set, u, v) => { let s = 0, a = 1, w = 1, t = 0; for (const n of set) { let q = 1 - Math.abs(n.f(u * n.P, v * n.P)) * 1.5; q = q * q * w; w = clamp(q * 1.6); s += q * a; t += a; a *= 0.52; } return s / t; };
  function grayCanvas(size, fn) {
    const c = canvas(size, size), g = c.getContext("2d"), id = g.createImageData(size, size);
    for (let i = 0; i < size * size; i++) { const [v, a] = fn(i); id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = a ?? 255; }
    g.putImageData(id, 0, 0); return c;
  }
  let TEX = null;
  IM.tex = () => TEX || (TEX = (() => {
    const r = K.rng(4417), T = {}, S = 512;
    /* relieve: ruido de gradiente periódico con deformación de dominio → cordilleras (multifractal de
       crestas) solo donde la máscara de baja frecuencia lo permite; sombreado con luz del noroeste.
       Las llanuras quedan casi blancas, como el atlas de la referencia. */
    const relief = (S2, P, seed, amt, mountains) => {
      const rr = K.rng(seed), nA = perlinSet(P, 6, rr), nB = perlinSet(P, 3, rr), nM = perlinSet(Math.max(2, P >> 1), 3, rr), H = new Float32Array(S2 * S2);
      for (let y = 0; y < S2; y++) for (let x = 0; x < S2; x++) {
        const u = x / S2, v = y / S2, wx = fbmAt(nB, u, v) * 0.16, wy = fbmAt(nB, u + 0.37, v + 0.71) * 0.16;
        const m = clamp((fbmAt(nM, u, v) + 0.05) / 0.4);
        const rd = mountains ? ridgedAt(nA, u + wx / P, v + wy / P) : fbmAt(nA, u + wx / P, v + wy / P) * 0.5 + 0.5;
        H[y * S2 + x] = rd * (0.25 + 0.75 * m * m);
      }
      const at = (x, y) => H[((y + S2) % S2) * S2 + ((x + S2) % S2)];
      return grayCanvas(S2, i => {
        const x = i % S2, y = (i / S2) | 0, sh = clamp(0.5 + (at(x - 1, y - 1) - at(x + 1, y + 1)) * S2 / 64 * 1.3);
        const hv = H[i], val = 1 - amt * ((1 - sh) * 0.75 * clamp(hv * 1.6) + 0.22 * hv) + 0.04 * (sh - 0.5);
        return [Math.round(255 * clamp(val, 0.5, 1))];
      });
    };
    T.reliefSmall = relief(768, 6, 4418, 0.62, true);
    T.reliefBig = relief(512, 3, 4419, 0.22, false);
    /* océano: manchas muy suaves (soft-light alrededor de 128) */
    { const n = fbm(S, 3, 4, r); T.ocean = grayCanvas(S, i => [Math.round(128 + (n[i] - 0.5) * 90)]); }
    /* sol moteado (multiplicar) */
    { const n = fbm(256, 8, 4, r); T.sun = grayCanvas(256, i => [Math.round(255 * clamp(0.78 + (n[i] - 0.5) * 0.7))]); }
    /* humo para el archivo (alfa) */
    { const n = fbm(S, 3, 5, r); T.smoke = grayCanvas(S, i => [10, Math.round(255 * clamp((n[i] - 0.3) * 1.6))]); }
    /* grano: 4 baldosas (overlay → media neutra) */
    T.grain = [0, 1, 2, 3].map(() => grayCanvas(256, () => [Math.round(128 + (r() + r() - 1) * 120)]));
    /* rayado diagonal (territorio del imperio) */
    { const c = canvas(16, 16), g = c.getContext("2d"); g.strokeStyle = "#000"; g.lineWidth = 2.6; g.lineCap = "square";
      g.beginPath(); for (const o of [-16, 0, 16]) { g.moveTo(o, 16); g.lineTo(o + 16, 0); } g.stroke(); T.hatch = c; }
    return T;
  })());

  /* ---------------------------------------------------------------- mundo */
  const ALIAS = {
    "alemania": "Germany", "japon": "Japan", "reino unido": "United Kingdom", "gran bretana": "United Kingdom", "inglaterra": "United Kingdom",
    "francia": "France", "italia": "Italy", "espana": "Spain", "rusia": "Russia", "union sovietica": "Russia", "urss": "Russia", "china": "China",
    "estados unidos": "United States of America", "eeuu": "United States of America", "usa": "United States of America", "corea del sur": "South Korea",
    "corea del norte": "North Korea", "polonia": "Poland", "mexico": "Mexico", "brasil": "Brazil", "argentina": "Argentina", "india": "India",
    "turquia": "Turkey", "egipto": "Egypt", "noruega": "Norway", "suecia": "Sweden", "paises bajos": "Netherlands", "holanda": "Netherlands",
    "belgica": "Belgium", "austria": "Austria", "grecia": "Greece", "filipinas": "Philippines", "indonesia": "Indonesia", "vietnam": "Vietnam",
    "tailandia": "Thailand", "birmania": "Myanmar", "malasia": "Malaysia", "australia": "Australia", "canada": "Canada", "irlanda": "Ireland",
    "islandia": "Iceland", "portugal": "Portugal", "ucrania": "Ukraine", "cuba": "Cuba", "marruecos": "Morocco", "argelia": "Algeria", "libia": "Libya",
    "taiwan": "Taiwan", "mongolia": "Mongolia", "dinamarca": "Denmark", "finlandia": "Finland", "chequia": "Czechia", "hungria": "Hungary",
    "rumania": "Romania", "yugoslavia": "Serbia", "iran": "Iran", "irak": "Iraq", "israel": "Israel", "arabia saudita": "Saudi Arabia", "sudafrica": "South Africa",
  };
  let WORLD = null;
  IM.world = () => {
    if (WORLD) return WORLD;
    const topo = window.KIT_WORLD_50m;
    if (!topo || !window.topojson || !window.d3) { console.warn("[imperio] faltan vendor/geo (d3-geo/topojson/KIT_WORLD_50m)"); return (WORLD = { ok: false, by: new Map(), land: null }); }
    const fc = topojson.feature(topo, topo.objects.countries), by = new Map();
    for (const f of fc.features) by.set(K.norm(f.properties.name), f);
    const land = topojson.merge(topo, topo.objects.countries.geometries);
    return (WORLD = { ok: true, fc, by, land });
  };
  /** país por nombre (inglés de world-atlas o alias en español); null si no existe */
  IM.feature = name => {
    if (!name) return null;
    const W = IM.world(), n = K.norm(name);
    const f = W.by.get(n) || W.by.get(K.norm(ALIAS[n] || ""));
    if (!f) console.warn("[imperio] país desconocido:", name);
    return f || null;
  };
  /** el polígono más grande de un país (para encuadrar sin colonias lejanas) */
  IM.mainPart = f => {
    if (!f || f.geometry.type !== "MultiPolygon") return f;
    let best = null, ba = -1;
    for (const c of f.geometry.coordinates) { const g = { type: "Polygon", coordinates: c }, a = d3.geoArea(g); if (a > ba) { ba = a; best = g; } }
    return { type: "Feature", properties: f.properties, geometry: best };
  };
  /** punto [lon,lat] o país → [lon,lat] (centroide de su parte principal) */
  IM.point = v => {
    if (Array.isArray(v)) return [+v[0], +v[1]];
    const f = IM.feature(v); return f ? d3.geoCentroid(IM.mainPart(f)) : null;
  };

  const ATLAS = new Map();
  /** proyección Mercator centrada en lon0 (redondeado a 10°) + Path2D cacheados */
  IM.atlas = lon0 => {
    const key = Math.round((((lon0 + 540) % 360) - 180) / 10) * 10;
    if (ATLAS.has(key)) return ATLAS.get(key);
    const W = IM.world();
    const proj = d3.geoMercator().rotate([-key, 0]).scale(1000).translate([0, 0]).precision(0.2);
    const path = d3.geoPath(proj), P2 = g => { const s = g && path(g); return s ? new Path2D(s) : new Path2D(); };
    const A = { key, proj, _land: null, get land() { return this._land || (this._land = W.ok ? P2(W.land) : new Path2D()); }, countries: new Map(),
      /** tierra recortada a un rectángulo del plano (unidades Mercator): solo los polígonos que lo tocan y
          cortados a su borde → el halo, el relieve y la costa ya no recorren todo el mundo (≈10× más rápido) */
      clipMemo: new Map(),
      landClip(x0, y0, x1, y1) {
        if (!W.ok) return this.land;
        const mk = `${x0.toFixed(2)},${y0.toFixed(2)},${x1.toFixed(2)},${y1.toFixed(2)}`;
        if (this.clipMemo.has(mk)) return this.clipMemo.get(mk);
        const out = this._clip(x0, y0, x1, y1);
        this.clipMemo.set(mk, out); if (this.clipMemo.size > 16) this.clipMemo.delete(this.clipMemo.keys().next().value);
        return out;
      },
      /** anillos de tierra ya proyectados (una vez por proyección) con su caja → recortar es solo aritmética */
      rings: null,
      projRings() {
        if (this.rings) return this.rings;
        const out = []; let cur = null;
        const sink = { moveTo(x, y) { cur = [x, y]; out.push(cur); }, lineTo(x, y) { cur.push(x, y); }, closePath() {}, arc() {}, rect() {} };
        d3.geoPath(proj, sink)(W.land);
        return (this.rings = out.map(r => { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
          for (let k = 0; k < r.length; k += 2) { const x = r[k], y = r[k + 1]; if (x < a) a = x; if (x > c) c = x; if (y < b) b = y; if (y > d) d = y; }
          return { r, b: [a, b, c, d] }; }));
      },
      _clip(x0, y0, x1, y1) {
        /* Sutherland–Hodgman contra el rectángulo (con margen: las aristas del recorte quedan fuera del cuadro) */
        const P = new Path2D(), edges = [[0, x0, 1], [0, x1, -1], [1, y0, 1], [1, y1, -1]];
        for (const R of this.projRings()) {
          const bb = R.b; if (bb[2] < x0 || bb[0] > x1 || bb[3] < y0 || bb[1] > y1) continue;
          let pts = R.r;
          if (!(bb[0] >= x0 && bb[2] <= x1 && bb[1] >= y0 && bb[3] <= y1)) {
            for (const [ax, v, sg] of edges) {
              const n = pts.length; if (!n) break; const o = [];
              let px = pts[n - 2], py = pts[n - 1], pin = ((ax ? py : px) - v) * sg >= 0;
              for (let k = 0; k < n; k += 2) {
                const x = pts[k], y = pts[k + 1], cin = ((ax ? y : x) - v) * sg >= 0;
                if (cin !== pin) { const q = ((ax ? py : px) - v) / ((ax ? py - y : px - x) || 1e-12); o.push(px + (x - px) * q, py + (y - py) * q); }
                if (cin) o.push(x, y);
                px = x; py = y; pin = cin;
              }
              pts = o;
            }
          }
          if (pts.length < 6) continue;
          P.moveTo(pts[0], pts[1]); for (let k = 2; k < pts.length; k += 2) P.lineTo(pts[k], pts[k + 1]); P.closePath();
        }
        return P;
      },
      country(name) { const f = IM.feature(name); if (!f) return null; const k = f.properties.name; if (!this.countries.has(k)) this.countries.set(k, P2(f)); return this.countries.get(k); } };
    ATLAS.set(key, A);
    return A;
  };

  /* ---------------------------------------------------------------- cámara */
  /** encuadre de un país: centro de su parte principal, span = ancho·k (grados) */
  IM.countryCam = (name, k = 1.6, rot = 0) => {
    const f = IM.feature(name);
    if (!f) return { lon: 15, lat: 35, span: 90, rot };
    const m = IM.mainPart(f), [[x0, y0], [x1, y1]] = d3.geoBounds(m), c = d3.geoCentroid(m);
    let w = x1 - x0; if (w < 0) w += 360;
    const span = clamp(Math.max(w, (y1 - y0) * 1.3) * k, 4, 150);
    return { lon: c[0], lat: c[1], span, rot };
  };
  /** [lon,lat,span,rot] | {lon,lat,span,rot} | "País" | "País*2.5" → cámara (o null) */
  IM.cam = v => {
    if (v == null || v === "") return null;
    if (Array.isArray(v)) return { lon: +v[0], lat: +v[1], span: +(v[2] ?? 40), rot: +(v[3] ?? 0) };
    if (typeof v === "string") { const [n, k] = v.split("*"); return IM.countryCam(n.trim(), k ? +k : 1.6); }
    if (typeof v === "object") return { lon: +v.lon, lat: +v.lat, span: +(v.span ?? 40), rot: +(v.rot ?? 0) };
    return null;
  };
  IM.mixCam = (a, b, q) => {
    let dl = b.lon - a.lon; if (dl > 180) dl -= 360; if (dl < -180) dl += 360;
    return { lon: a.lon + dl * q, lat: lerp(a.lat, b.lat, q), span: Math.exp(lerp(Math.log(a.span), Math.log(b.span), q)), rot: lerp(a.rot, b.rot, q) };
  };
  IM.zoomCam = (c, k, drot = 0) => ({ ...c, span: clamp(c.span * k, 3, 170), rot: c.rot + drot });
  /** encuadre que contiene varios puntos [lon,lat] con margen k, según el formato del cuadro (st) */
  IM.fitCam = (pts, k = 1.4, rot = 0, st = null) => {
    const ok = pts.filter(Boolean); if (!ok.length) return null;
    const lon0 = ok[0][0], pr = d3.geoMercator().rotate([-lon0, 0]).scale(1000).translate([0, 0]);
    const xy = ok.map(p => pr(p)), xs = xy.map(p => p[0]), ys = xy.map(p => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const W = st ? st.W : 16, H = st ? st.H : 9, ref = st && st.portrait ? W * 1.45 : W;
    const span = clamp(Math.max((x1 - x0) * ref / W, (y1 - y0) * ref / H, 8 * UPD) * k / UPD, 6, 160);
    const c = pr.invert([(x0 + x1) / 2, (y0 + y1) / 2]);
    return { lon: c[0], lat: c[1], span, rot };
  };

  /**
   * Cámara de un beat con mapa: { from, to, ease }. Cada componente con mapa declara
   * `mapCam(p) → { from?, to?, zoom, tilt, ease }`. Si no trae `from`, arranca donde terminó el
   * beat con mapa anterior (el plano continuo de la referencia); si no trae `to`, se aleja `zoom`.
   */
  const CAMS = new WeakMap();
  IM.camOf = (ctx, b) => {
    let memo = CAMS.get(ctx.beats); if (!memo) CAMS.set(ctx.beats, memo = new Map());
    if (memo.has(b.i)) return memo.get(b.i);
    memo.set(b.i, null);                                           /* corta ciclos */
    const def = K.registry.get(b.use);
    const p = K.resolveParams(def, b.params || {}, ctx.C);
    const spec = def.mapCam(p, ctx.stage) || {};
    let to = IM.cam(spec.to), from = IM.cam(spec.from);
    const startCont = !from;
    if (!from) {
      const prev = [...ctx.beats].filter(x => x.i < b.i && (x.layer || "main") === "main" && K.registry.get(x.use)?.mapCam).pop();
      const pc = prev ? IM.camOf(ctx, prev) : null;
      if (pc) from = pc.to;
    }
    /* ¿el plano con mapa siguiente arranca donde termina este? (sin `from` propio) */
    const nx = [...ctx.beats].find(x => x.i > b.i && (x.layer || "main") === "main" && K.registry.get(x.use)?.mapCam);
    let endCont = false;
    if (nx) { const nd = K.registry.get(nx.use), np = K.resolveParams(nd, nx.params || {}, ctx.C); endCont = !IM.cam((nd.mapCam(np, ctx.stage) || {}).from); }
    if (!from && to) from = IM.zoomCam(to, 1 / (spec.zoom || 1.3), -(spec.tilt || 0));
    if (!from) from = { lon: 15, lat: 35, span: 90, rot: 0 };
    if (!to) to = IM.zoomCam(from, spec.zoom || 1.3, spec.tilt || 0);
    /* auto: entre planos encadenados la cámara no frena a cero (antes "out" → se paraba y arrancaba de golpe) */
    const auto = startCont && endCont ? "linear" : endCont ? "in" : "out";
    const r = { from, to, ease: spec.ease && spec.ease !== "auto" ? spec.ease : auto };
    memo.set(b.i, r);
    return r;
  };
  const EASE = { out: q => 1 - (1 - q) * (1 - q), in: q => q * q, inOut: ease.sine, linear: q => q, expo: ease.expoOut };
  IM.camQ = (c, lt, dur) => (EASE[c.ease] || EASE.out)(clamp(lt / Math.max(0.5, dur)));
  IM.camAt = (c, lt, dur) => IM.mixCam(c.from, c.to, IM.camQ(c, lt, dur));

  /** matriz cámara → pantalla. pt(lon,lat) → [x,y] en px del escenario */
  IM.view = (st, cam, A) => {
    A = A || IM.atlas(cam.lon);
    const pc = A.proj([cam.lon, cam.lat]) || [0, 0];
    const k = (st.portrait ? st.W * 1.45 : st.W) / (cam.span * UPD);
    const r = cam.rot * D2R, c = Math.cos(r), s = Math.sin(r), ax = st.W / 2, ay = st.H * (st.portrait ? 0.44 : 0.5);
    const m = [c * k, s * k, -s * k, c * k, ax - (c * k * pc[0] - s * k * pc[1]), ay - (s * k * pc[0] + c * k * pc[1])];
    const pt = (lon, lat) => { const q = A.proj([lon, lat]); return q ? [m[0] * q[0] + m[2] * q[1] + m[4], m[1] * q[0] + m[3] * q[1] + m[5]] : [ax, ay]; };
    return { A, m, k, rot: r, pt, pxPerDeg: k * UPD, pc, R: Math.hypot(st.W, st.H) / k };
  };

  /* ---------------------------------------------------------------- atlas */
  /** territorios rayados (base gris + rayado diagonal fino de ancho constante en pantalla) */
  IM.drawHatch = (G, st, V, names, hq = 1, g = 0) => {
    const T = IM.tex(), A = V.A, u = st.u;
    for (const name of names || []) {
      const q = typeof hq === "object" ? (hq[name] ?? hq[IM.feature(name)?.properties.name] ?? 1) : hq; if (q <= 0.01) continue;
      const P = A.country(name); if (!P) continue;
      G.save(); G.transform(...V.m);
      G.globalAlpha = q; G.fillStyle = IM.tone(COL.hatchBg, g); G.fill(P);
      const pat = G.createPattern(T.hatch, "repeat"), sp = u * 0.56 / (16 / Math.SQRT2);
      pat.setTransform(new DOMMatrix().scale(sp / V.k));
      G.globalAlpha = q * 0.62; G.fillStyle = pat; G.fill(P);
      G.globalAlpha = q * 0.55; G.strokeStyle = IM.tone(COL.hatch, g); G.lineWidth = u * 0.09 / V.k; G.stroke(P);
      G.restore();
    }
  };
  /** rótulos de mares (itálica espaciada, giran con el mapa) */
  IM.drawLabels = (G, st, V, labels, q = 1, g = 0) => {
    if (q <= 0.01) return;
    const { W, H, u } = st;
    for (const L of labels || []) {
      const at = Array.isArray(L.at) ? L.at : IM.point(L.at); if (!at) continue;
      const [x, y] = V.pt(at[0], at[1]), fs = u * (L.size || 1.7) * (st.portrait ? 1.2 : 1);
      if (x < -W * 0.2 || x > W * 1.2 || y < -H * 0.2 || y > H * 1.2) continue;
      G.save(); G.translate(x, y); G.rotate(V.rot); G.globalAlpha = q * (L.alpha ?? 1);
      G.font = `italic 500 ${fs}px Montserrat`; G.letterSpacing = fs * 0.16 + "px"; G.textAlign = "center"; G.textBaseline = "middle";
      G.fillStyle = L.dark ? "rgba(40,48,54,.7)" : IM.tone("#eef3f6", g, 1, 0.82);
      String(L.t).split("\n").forEach((s, i, a) => G.fillText(s, 0, (i - (a.length - 1) / 2) * fs * 1.35));
      G.restore();
    }
  };
  /**
   * Atlas completo SIN rótulos (lo que se cachea en las llaves). look = { gray 0..1, hatch:[países], light }
   */
  IM.renderAtlas = (G, st, cam, look = {}) => {
    const T = IM.tex(), V = IM.view(st, cam), A = V.A, { W, H, u } = st, k = V.k, g = look.gray || 0;
    /* rectángulo visible en el plano (+20 % de margen: los bordes del recorte quedan fuera del cuadro aunque el halo sea ancho) */
    const inv = new DOMMatrix(V.m).inverse(), cs = [[0, 0], [W, 0], [0, H], [W, H]].map(([x, y]) => [inv.a * x + inv.c * y + inv.e, inv.b * x + inv.d * y + inv.f]);
    const bx0 = Math.min(...cs.map(p => p[0])), bx1 = Math.max(...cs.map(p => p[0])), by0 = Math.min(...cs.map(p => p[1])), by1 = Math.max(...cs.map(p => p[1]));
    const pdx = (bx1 - bx0) * 0.2, pdy = (by1 - by0) * 0.2, LAND = A.landClip(bx0 - pdx, by0 - pdy, bx1 + pdx, by1 + pdy);
    G.save();
    G.fillStyle = IM.tone(COL.ocean, g); G.fillRect(0, 0, W, H);
    G.save(); G.transform(...V.m);
    const R = V.R, [cx, cy] = V.pc;
    /* océano: manchas de profundidad pegadas al mapa. La mezcla soft-light sobre un color liso es la misma
       en cada píxel → se hornea una vez en la baldosa (igual resultado, sin mezclar en cada llave) */
    { const pat = G.createPattern(IM.oceanTile(g), "repeat"); pat.setTransform(new DOMMatrix().scale(1400 / 512));
      G.fillStyle = pat; G.fillRect(Math.max(cx - R, bx0 - pdx), Math.max(cy - R, by0 - pdy), Math.min(R * 2, bx1 - bx0 + 2 * pdx), Math.min(R * 2, by1 - by0 + 2 * pdy)); }
    G.globalCompositeOperation = "source-over"; G.globalAlpha = 1; G.lineJoin = "round";
    /* aguas someras: halo claro y suave a lo largo de la costa */
    const sh = IM.tone(COL.shallow, g);
    for (const [w, a] of [[10, 0.06], [6.5, 0.07], [4, 0.09], [2.3, 0.11], [1.1, 0.13]]) { G.globalAlpha = a; G.strokeStyle = sh; G.lineWidth = u * w / k; G.stroke(LAND); }
    G.globalAlpha = 1;
    /* tierra */
    G.fillStyle = IM.tone(COL.land, g); G.fill(LAND);
    G.restore();
    IM.drawHatch(G, st, V, look.hatch, 1, g);
    G.save(); G.transform(...V.m);
    /* relieve sombreado (dos escalas, multiplicar) */
      G.globalCompositeOperation = "multiply";
    { const pb = G.createPattern(T.reliefBig, "repeat"); pb.setTransform(new DOMMatrix().scale(1500 / 512)); G.globalAlpha = 0.52; G.fillStyle = pb; G.fill(LAND);
      /* nivel de detalle: la baldosa chica (260 u ≈ 15°) solo cuando se ve grande; de lejos manda la mediana
         (1100 u, girada) → no se nota la repetición en los planos abiertos */
      const ws = clamp((260 * k - 220) / 380);
      if (ws > 0.01) { const ps = G.createPattern(T.reliefSmall, "repeat"); ps.setTransform(new DOMMatrix().translate(37, 91).scale(260 / 768)); G.globalAlpha = ws * 0.68; G.fillStyle = ps; G.fill(LAND); }
      const pm = G.createPattern(T.reliefSmall, "repeat"); pm.setTransform(new DOMMatrix().translate(-211, 433).rotate(90).scale(1100 / 768)); G.globalAlpha = (1 - ws * 0.55) * 0.38; G.fillStyle = pm; G.fill(LAND); }
    G.globalCompositeOperation = "source-over"; G.globalAlpha = 1;
    /* costa fina */
    G.strokeStyle = COL.coast; G.lineWidth = u * 0.08 / k; G.stroke(LAND);
    G.restore();
    G.restore();
    return V;
  };
  const OT = new Map();
  IM.oceanTile = (g = 0) => {
    const kk = Math.round(g * 100); if (OT.has(kk)) return OT.get(kk);
    const T = IM.tex(), n = T.ocean.width, c = canvas(n, n), x = c.getContext("2d");
    x.fillStyle = IM.tone(COL.ocean, g); x.fillRect(0, 0, n, n);
    x.globalCompositeOperation = "soft-light"; x.globalAlpha = 0.8; x.drawImage(T.ocean, 0, 0);
    OT.set(kk, c); return c;
  };
  /** atlas directo (sin caché), con rótulos y oscurecido */
  IM.drawMap = (G, st, cam, look = {}) => {
    const V = IM.renderAtlas(G, st, cam, look);
    IM.drawLabels(G, st, V, look.labels, look.labelQ ?? 1, look.gray || 0);
    if (look.dim > 0) { G.save(); G.fillStyle = `rgba(12,14,16,${look.dim})`; G.fillRect(0, 0, st.W, st.H); G.restore(); }
    return V;
  };

  /**
   * Caché de "llaves": el atlas se dibuja una vez en una cámara llave (lienzo 1.3× el cuadro, a 1.1×
   * resolución) y los cuadros cercanos solo lo transforman (la cámara es afín en el plano Mercator).
   * La llave es función pura de la cámara cuantizada → mismo cuadro en cualquier orden de seek.
   */
  const KM = 1.3, KR = 1.1, STRIPS = 8, CAP = 12;
  /* ¿reproducción en vivo (navegador, modal) o render cuadro a cuadro (seek)? En el render todo se dibuja
     en el momento y entero (determinista); en vivo las llaves se arman por franjas en los ratos libres. */
  let SEEKING = false;
  const QS0 = new URLSearchParams(location.search), STILL = QS0.has("t") || QS0.has("paused");
  IM.live = () => {
    const P = window.__promo;
    if (P && !P.__imWrapped) {
      const sk = P.seek.bind(P), rl = P.release.bind(P);
      P.seek = t => { SEEKING = true; return sk(t); };
      P.release = () => { SEEKING = false; return rl(); };
      P.__imWrapped = true;
    }
    return !SEEKING && !STILL;
  };
  /* almacén ÚNICO de llaves (compartido por todos los planos): la llave es función pura de
     (cuadro, cámara, rayado, gris) → el plano siguiente reusa lo que ya se armó */
  const STORE = new Map(), QUEUE = [];
  const sig = (st, dpr, cam, look) => `${st.W | 0}x${st.H | 0}@${dpr}|${cam.lon.toFixed(3)},${cam.lat.toFixed(3)},${cam.span.toFixed(3)},${cam.rot.toFixed(2)}|${(look.hatch || []).join("+")}|${look.gray || 0}`;
  const lookSig = (st, dpr, look) => `${st.W | 0}x${st.H | 0}@${dpr}|${(look.hatch || []).join("+")}|${look.gray || 0}`;
  function entry(st, dpr, cam, look) {
    const id = sig(st, dpr, cam, look);
    let e = STORE.get(id);
    if (e) { STORE.delete(id); STORE.set(id, e); return e; }          /* LRU */
    const r = dpr * KR, sk = { ...st, W: st.W * KM, H: st.H * KM }, kc = { ...cam, span: cam.span * KM };
    const c = canvas(sk.W * r, sk.H * r);
    e = { id, ls: lookSig(st, dpr, look), c, g: c.getContext("2d"), r, sk, kc, look, M: new DOMMatrix(IM.view(sk, kc).m).inverse(), w: sk.W, h: sk.H, done: 0, used: 0 };
    STORE.set(id, e);
    while (STORE.size > CAP) { const [oid, o] = STORE.entries().next().value; o.c.width = o.c.height = 1; STORE.delete(oid); const qi = QUEUE.indexOf(o); if (qi >= 0) QUEUE.splice(qi, 1); }
    return e;
  }
  /** dibuja la franja n de la llave (recorte en píxeles enteros: mismo resultado que de una vez) */
  function strip(e, n) {
    const g = e.g, H = e.c.height, y0 = Math.floor(H * n / STRIPS), y1 = Math.floor(H * (n + 1) / STRIPS);
    g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.beginPath(); g.rect(0, y0, e.c.width, y1 - y0); g.clip();
    g.setTransform(e.r, 0, 0, e.r, 0, 0); IM.renderAtlas(g, e.sk, e.kc, e.look); g.restore();
    /* el canvas difiere el dibujo hasta que se usa: leer 1 píxel obliga a rasterizar la franja AHORA (en el rato libre)
       y no en el primer cuadro que muestra la llave (ahí estaba el tirón) */
    g.getImageData(0, y0, 1, 1);
  }
  function finish(e) {                                                 /* entera, ya (render o urgencia) */
    if (e.done >= STRIPS) return e;
    if (e.done === 0) { const g = e.g; g.setTransform(e.r, 0, 0, e.r, 0, 0); IM.renderAtlas(g, e.sk, e.kc, e.look); }
    else for (let n = e.done; n < STRIPS; n++) strip(e, n);
    e.done = STRIPS; const qi = QUEUE.indexOf(e); if (qi >= 0) QUEUE.splice(qi, 1);
    return e;
  }
  const idle = window.requestIdleCallback || (f => setTimeout(() => f({ timeRemaining: () => 8 }), 16));
  let pumping = false;
  function pump(dl) {
    pumping = false;
    const t0 = performance.now();
    while (QUEUE.length && (dl.timeRemaining() > 2 || performance.now() - t0 < 2)) {
      const e = QUEUE[0];
      if (e.done >= STRIPS || !STORE.has(e.id)) { QUEUE.shift(); continue; }
      strip(e, e.done++);
      if (performance.now() - t0 > 12) break;                          /* una franja por cuadro como mucho si se pasa */
    }
    if (QUEUE.length) { pumping = true; idle(pump); }
  }
  function want(e, urgent = false) {
    if (e.done >= STRIPS) return;
    const qi = QUEUE.indexOf(e);
    if (qi >= 0) { if (urgent && qi > 0) { QUEUE.splice(qi, 1); QUEUE.unshift(e); } }
    else urgent ? QUEUE.unshift(e) : QUEUE.push(e);
    if (!pumping) { pumping = true; idle(pump); }
  }
  /** precalentar la llave de una cámara (lo usan los planos que vienen) */
  IM.warmKey = (ctx, cam, look) => { if (IM.live()) want(entry(ctx.stage, ctx.dpr, cam, { hatch: look.hatch, gray: look.gray || 0 })); };
  IM.clearKeys = () => { for (const e of STORE.values()) e.c.width = e.c.height = 1; STORE.clear(); QUEUE.length = 0; };

  IM.mapCache = (ctx) => {
    return {
      /**
       * dibuja el atlas de `cam` con la llave `kcam` (el id de llamada ya no hace falta: la llave sale de la cámara).
       * more = { k2, f, warm:[{cam}] }: funde con la llave siguiente (sin salto de detalle) y precalienta.
       * En vivo, si la llave no está lista se usa la última lista del mismo aspecto y se arma por franjas.
       */
      draw(G, cam, kcam, id, look = {}, more = null) {
        const st = ctx.stage, V = IM.view(st, cam), g = look.gray || 0, base = { hatch: look.hatch }, live = IM.live();
        const blit = (e, a) => {
          const T = new DOMMatrix(V.m).multiply(e.M);
          G.save(); G.globalAlpha = a; G.transform(T.a, T.b, T.c, T.d, T.e, T.f); G.drawImage(e.c, 0, 0, e.w, e.h); G.restore();
          e.used = performance.now();
        };
        const fallback = ls => { let best = null; for (const e of STORE.values()) if (e.ls === ls && e.done >= STRIPS && (!best || e.used > best.used)) best = e; return best; };
        const put = (gl, a) => {
          const lk = { ...base, gray: gl }, e0 = entry(st, ctx.dpr, kcam, lk);
          if (!live || e0.done >= STRIPS) blit(finish(e0), a);
          else { const fb = fallback(e0.ls); if (fb) { blit(fb, a); want(e0, true); } else blit(finish(e0), a); }
          if (more && more.k2 && more.k2 !== kcam) {
            const e1 = entry(st, ctx.dpr, more.k2, lk);
            if (more.f > 0.002) { if (!live) blit(finish(e1), a * more.f); else if (e1.done >= STRIPS) blit(e1, a * more.f); else want(e1, true); }
            else if (live) want(e1);                                     /* la siguiente se arma desde el principio del tramo */
          }
          if (live && more && more.warm) for (const w of more.warm) want(entry(st, ctx.dpr, w.cam, lk));
        };
        if (g < 0.995) put(0, 1);
        if (g > 0.005) put(1, g >= 0.995 ? 1 : g);
        if (look.hatchLive) IM.drawHatch(G, st, V, look.hatchLive, look.hatchQ, g);
        IM.drawLabels(G, st, V, look.labels, look.labelQ ?? 1, g);
        if (look.dim > 0) { G.save(); G.fillStyle = `rgba(12,14,16,${look.dim})`; G.fillRect(0, 0, st.W, st.H); G.restore(); }
        return V;
      },
      free() {},                                                       /* el almacén es compartido (LRU) */
    };
  };
  /** cámara llave de un tramo from→to: cuántas llaves hacen falta y cuál toca para q */
  IM.keyOf = (c, q) => {
    const z = Math.abs(Math.log(c.to.span / c.from.span)) / Math.log(1.1), r = Math.abs(c.to.rot - c.from.rot) / 3;
    let dl = Math.abs(c.to.lon - c.from.lon); if (dl > 180) dl = 360 - dl;
    const m = Math.hypot(dl, c.to.lat - c.from.lat) / (Math.min(c.from.span, c.to.span) * 0.1);
    const N = Math.max(1, Math.ceil(Math.max(z, r, m)));
    const x = clamp(q) * N, j = Math.min(N, Math.floor(x)), j1 = Math.min(N, j + 1);
    /* fundido solo en el último 30 % del tramo (suave): oculta el cambio de llave y el resto del tiempo se dibuja una sola */
    const fr = j1 > j ? x - j : 0, fw = clamp((fr - 0.7) / 0.3);
    return { j, j1, N, f: fw * fw * (3 - 2 * fw), cam: IM.mixCam(c.from, c.to, j / N), cam1: IM.mixCam(c.from, c.to, j1 / N),
      next: j1 < N ? { id: `${j1 + 1}`, cam: IM.mixCam(c.from, c.to, (j1 + 1) / N) } : null };
  };

  /* ---------------------------------------------------------------- banderas
     El sol y los rayos toman los colores de la bandera del país foco (misma forma, solo cambia el color).
     h = franjas horizontales · v = franjas verticales · ring = aros concéntricos (banderas complejas:
     de afuera hacia adentro) · classic = el carmesí de la referencia (Japón). Claves: properties.name de world-atlas. */
  const FLAGS = {
    Japan: { classic: true },
    Germany: { h: ["#000000", "#dd0000", "#ffce00"] },
    "United Kingdom": { ring: ["#012169", "#ffffff", "#c8102e"] },
    France: { v: ["#0055a4", "#ffffff", "#ef4135"] },
    Italy: { v: ["#009246", "#ffffff", "#ce2b37"] },
    Spain: { h: ["#aa151b", "#f1bf00", "#f1bf00", "#aa151b"] },
    Portugal: { v: ["#046a38", "#da291c", "#da291c"] },
    Russia: { h: ["#ffffff", "#0039a6", "#d52b1e"] },
    Ukraine: { h: ["#0057b7", "#ffd700"] },
    Poland: { h: ["#ffffff", "#dc143c"] },
    Netherlands: { h: ["#ae1c28", "#ffffff", "#21468b"] },
    Belgium: { v: ["#000000", "#fdda24", "#ef3340"] },
    Austria: { h: ["#ed2939", "#ffffff", "#ed2939"] },
    Hungary: { h: ["#ce2939", "#ffffff", "#477050"] },
    Czechia: { ring: ["#11457e", "#ffffff", "#d7141a"] },
    Sweden: { ring: ["#006aa7", "#fecc00"] },
    Norway: { ring: ["#ba0c2f", "#ffffff", "#00205b"] },
    Greece: { ring: ["#0d5eaf", "#ffffff"] },
    Turkey: { ring: ["#e30a17", "#ffffff", "#e30a17"] },
    "United States of America": { ring: ["#0a3161", "#ffffff", "#b31942"] },
    Canada: { v: ["#d80621", "#ffffff", "#d80621"] },
    Mexico: { v: ["#006847", "#ffffff", "#ce1126"] },
    Cuba: { ring: ["#002a8f", "#ffffff", "#cf142b"] },
    Colombia: { h: ["#fcd116", "#fcd116", "#003893", "#ce1126"] },
    Venezuela: { h: ["#ffcc00", "#00247d", "#cf142b"] },
    Ecuador: { h: ["#ffdd00", "#ffdd00", "#034ea2", "#ed1c24"] },
    Peru: { v: ["#d91023", "#ffffff", "#d91023"] },
    Bolivia: { h: ["#d52b1e", "#f9e300", "#007934"] },
    Chile: { ring: ["#d52b1e", "#ffffff", "#0039a6"] },
    Argentina: { h: ["#74acdf", "#ffffff", "#74acdf"] },
    Uruguay: { ring: ["#0038a8", "#ffffff", "#fcd116"] },
    Paraguay: { h: ["#d52b1e", "#ffffff", "#0038a8"] },
    Brazil: { ring: ["#009c3b", "#ffdf00", "#002776"] },
    China: { ring: ["#de2910", "#de2910", "#ffde00"] },
    Taiwan: { ring: ["#fe0000", "#000095", "#ffffff"] },
    "South Korea": { ring: ["#ffffff", "#000000", "#cd2e3a", "#0047a0"] },
    "North Korea": { h: ["#024fa2", "#ed1c27", "#ed1c27", "#024fa2"] },
    Vietnam: { ring: ["#da251d", "#da251d", "#ffff00"] },
    India: { h: ["#ff9933", "#ffffff", "#138808"] },
    Pakistan: { ring: ["#01411c", "#ffffff"] },
    Iran: { h: ["#239f40", "#ffffff", "#da0000"] },
    Iraq: { h: ["#ce1126", "#ffffff", "#000000"] },
    Israel: { ring: ["#ffffff", "#0038b8", "#ffffff"] },
    Egypt: { h: ["#ce1126", "#ffffff", "#000000"] },
    "Saudi Arabia": { ring: ["#006c35", "#ffffff"] },
    "South Africa": { ring: ["#007a4d", "#ffb612", "#000000", "#de3831"] },
    Australia: { ring: ["#012169", "#ffffff", "#e4002b"] },
    Philippines: { h: ["#0038a8", "#ce1126"] },
    Indonesia: { h: ["#ff0000", "#ffffff"] },
  };
  const FLAG_ALIAS = { Alemania: "Germany", "Reino Unido": "United Kingdom", Francia: "France", Italia: "Italy", "España": "Spain", Rusia: "Russia",
    Polonia: "Poland", "Estados Unidos": "United States of America", USA: "United States of America", "México": "Mexico", "Japón": "Japan",
    "Perú": "Peru", Brasil: "Brazil", "Corea del Sur": "South Korea", "Corea del Norte": "North Korea", "Irán": "Iran", "Irak": "Iraq",
    Egipto: "Egypt", Turquía: "Turkey", "Países Bajos": "Netherlands", "Bélgica": "Belgium", Suecia: "Sweden", Noruega: "Norway", Grecia: "Greece",
    "Sudáfrica": "South Africa", Filipinas: "Philippines", Ucrania: "Ukraine", "Hungría": "Hungary", "Chequia": "Czechia", "Canadá": "Canada" };
  const lum = h => { const [r, g, b] = hex(h); return (r * 0.299 + g * 0.587 + b * 0.114) / 255; };
  /**
   * Bandera para el sol/rayos. flag = "auto" (la del país) | "none"/"classic" (carmesí) | "#c1,#c2,…" (franjas propias).
   * Devuelve null para el clásico; si no: { kind, colors, rays (sin los casi blancos) }.
   */
  IM.flagFor = (country, flag = "auto") => {
    if (flag === "none" || flag === "classic") return null;
    let F = null;
    if (flag && flag !== "auto") F = { h: String(flag).split(",").map(x => x.trim()).filter(Boolean) };
    else if (country) { const n = FLAG_ALIAS[country] || IM.feature?.(country)?.properties?.name || country; F = FLAGS[n] || null; }
    if (!F || F.classic) return null;
    const kind = F.h ? "h" : F.v ? "v" : "ring", colors = F.h || F.v || F.ring;
    const uniq = [...new Set(colors)], strong = uniq.filter(c => lum(c) < 0.9);
    return { kind, colors, rays: strong.length ? strong : uniq };
  };

  /* ---------------------------------------------------------------- sol, rayos, barcos, rosa */
  /** círculo carmesí moteado; late suave ("pulse" = amplitud) */
  IM.sun = (G, x, y, r, t, o = {}) => {
    if (r <= 0.3) return;
    const a = o.alpha ?? 1, rr = r * (1 + (o.pulse ?? 0.03) * Math.sin(t * Math.PI * 2 / 1.5));
    G.save(); G.globalAlpha = a;
    const F = o.flag;
    if (!F) {
      const gr = G.createRadialGradient(x - rr * 0.3, y - rr * 0.35, rr * 0.1, x, y, rr);
      gr.addColorStop(0, IM.tone(COL.sunHi, o.gray || 0)); gr.addColorStop(1, IM.tone(COL.sun, o.gray || 0));
      G.fillStyle = gr; G.beginPath(); G.arc(x, y, rr, 0, Math.PI * 2); G.fill();
      G.clip();
    } else {
      /* mismo disco, con los colores de la bandera (franjas o aros) + sombreado como el carmesí */
      G.beginPath(); G.arc(x, y, rr, 0, Math.PI * 2); G.clip();
      const cs = F.colors, n = cs.length;
      if (F.kind === "ring") cs.forEach((c, i) => { G.fillStyle = IM.tone(c, o.gray || 0); G.beginPath(); G.arc(x, y, rr * (1 - i / n * 0.86), 0, Math.PI * 2); G.fill(); });
      else cs.forEach((c, i) => { G.fillStyle = IM.tone(c, o.gray || 0);
        if (F.kind === "h") G.fillRect(x - rr, y - rr + 2 * rr * i / n, 2 * rr, 2 * rr / n + 1); else G.fillRect(x - rr + 2 * rr * i / n, y - rr, 2 * rr / n + 1, 2 * rr); });
      const sh = G.createRadialGradient(x - rr * 0.3, y - rr * 0.35, rr * 0.1, x, y, rr);
      sh.addColorStop(0, "rgba(255,255,255,.12)"); sh.addColorStop(1, "rgba(0,0,0,.28)"); G.fillStyle = sh; G.fillRect(x - rr, y - rr, 2 * rr, 2 * rr);
    }
    G.globalCompositeOperation = "multiply"; G.globalAlpha = a * 0.55;
    G.drawImage(IM.tex().sun, x - rr * 1.6, y - rr * 1.6, rr * 3.2, rr * 3.2);
    G.restore();
  };
  /**
   * Rayos en abanico desde (x,y): n rayos, la mitad rojo translúcido y la mitad hueco.
   * o = { n, rot (rad), dir (rad, pantalla; π/2 = abajo), focus (0 = parejo, 1 = abanico cerrado),
   *       len (px), r0 (px), grow 0..1, alpha, t, color }
   */
  IM.rays = (G, x, y, o) => {
    const n = Math.max(6, o.n | 0), grow = o.grow ?? 1, floor = clamp(o.floor ?? 0.16); if (grow <= 0) return [];
    const hw = Math.PI / n * (o.width ?? 0.5), out = [];
    G.save(); G.globalCompositeOperation = "multiply";
    for (let i = 0; i < n; i++) {
      const a = (o.rot || 0) + i * Math.PI * 2 / n;
      let d = a - (o.dir ?? Math.PI / 2); d = Math.atan2(Math.sin(d), Math.cos(d));
      const fw = Math.pow((1 + Math.cos(d)) / 2, 0.6 + 2.6 * (o.focus ?? 0.6));
      const w = floor + (1 - floor) * fw, gi = clamp((grow * 1.6) - Math.abs(d) / Math.PI * 0.6);
      const L = (o.r0 || 0) + (o.len || 300) * w * ease.out(gi) * (1 + 0.025 * Math.sin((o.t || 0) * 1.3 + i));
      if (L <= (o.r0 || 0) + 1) continue;
      const r0 = o.r0 || 0, c0 = Math.cos(a - hw), s0 = Math.sin(a - hw), c1 = Math.cos(a + hw), s1 = Math.sin(a + hw);
      const lg = G.createLinearGradient(x + Math.cos(a) * r0, y + Math.sin(a) * r0, x + Math.cos(a) * L, y + Math.sin(a) * L);
      /* referencia: carmesí en MULTIPLICAR (sobre el océano azul da granate cerca del sol y
         violeta grisáceo lejos: muestreado #706779 / #635f70 en t=9 s) */
      const fc = o.colors && o.colors.length ? o.colors[i % o.colors.length] : null;
      const al = Math.min(1, (o.alpha ?? 0.62) / 0.56) * (0.6 + 0.4 * fw) * (fc ? 0.62 : 1), rc = fc || o.color || COL.rayMul;
      G.globalCompositeOperation = fc ? "source-over" : "multiply";
      lg.addColorStop(0, IM.tone(rc, o.gray || 0, 1, al * 0.92)); lg.addColorStop(0.3, IM.tone(rc, o.gray || 0, 1, al * 0.72));
      lg.addColorStop(0.8, IM.tone(rc, o.gray || 0, 1, al * 0.38)); lg.addColorStop(1, IM.tone(rc, o.gray || 0, 1, 0));
      G.fillStyle = lg; G.beginPath();
      G.moveTo(x + c0 * r0, y + s0 * r0); G.lineTo(x + c0 * L, y + s0 * L); G.lineTo(x + c1 * L, y + s1 * L); G.lineTo(x + c1 * r0, y + s1 * r0); G.closePath(); G.fill();
      out.push({ a, L, w });
    }
    G.restore();
    return out;
  };
  /** barquito visto desde arriba (proa hacia `ang`) */
  IM.ship = (G, x, y, ang, len, a = 1, gray = 0) => {
    if (a <= 0.01) return;
    const w = len * 0.24;
    G.save(); G.translate(x, y); G.rotate(ang); G.globalAlpha = a * 0.88;
    G.fillStyle = IM.tone(COL.ship, gray);
    G.beginPath(); G.moveTo(len / 2, 0); G.quadraticCurveTo(len * 0.22, -w / 2, -len * 0.3, -w / 2); G.lineTo(-len / 2, -w * 0.32);
    G.lineTo(-len / 2, w * 0.32); G.lineTo(-len * 0.3, w / 2); G.quadraticCurveTo(len * 0.22, w / 2, len / 2, 0); G.fill();
    G.fillStyle = "rgba(200,210,215,.45)"; G.fillRect(-len * 0.12, -w * 0.18, len * 0.22, w * 0.36);
    G.globalAlpha = a * 0.25; G.strokeStyle = "rgba(235,242,245,1)"; G.lineWidth = Math.max(0.6, len * 0.05);
    G.beginPath(); G.moveTo(-len / 2, -w * 0.25); G.lineTo(-len * 1.4, -w * 0.9); G.moveTo(-len / 2, w * 0.25); G.lineTo(-len * 1.4, w * 0.9); G.stroke();
    G.restore();
  };
  /** barcos que avanzan por los rayos cercanos a `dir` */
  IM.ships = (G, x, y, rays, o) => {
    if (!o.count || !rays.length) return;
    const near = rays.filter(r => r.w > 0.55).sort((a, b) => b.w - a.w), r = K.rng(o.seed || 77);
    for (let j = 0; j < o.count && near.length; j++) {
      const ray = near[(j * 3) % near.length], f = 0.35 + 0.5 * r(), sp = 0.012 + 0.012 * r();
      const d = (o.r0 || 0) + (ray.L - (o.r0 || 0)) * Math.min(0.9, f + sp * (o.t || 0)), aa = ray.a + (r() - 0.5) * 0.04;
      IM.ship(G, x + Math.cos(aa) * d, y + Math.sin(aa) * d, aa, o.len, (o.alpha ?? 1) * clamp((ray.L - (o.r0 || 0)) / ((o.len || 10) * 6)), o.gray);
    }
  };
  /** rosa de los vientos de línea fina (abajo a la derecha en la referencia) */
  IM.compass = (G, x, y, r, rot, a = 1, color = "rgba(236,238,240,") => {
    if (a <= 0.01) return;
    G.save(); G.translate(x, y); G.rotate(rot); G.globalAlpha = a;
    const c = o => color + o + ")";
    G.strokeStyle = c(0.75); G.lineWidth = Math.max(0.8, r * 0.025);
    G.beginPath(); G.arc(0, 0, r * 0.78, 0, Math.PI * 2); G.stroke();
    G.beginPath(); G.arc(0, 0, r * 0.7, 0, Math.PI * 2); G.stroke();
    for (let i = 0; i < 8; i++) {
      const A = i * Math.PI / 4, L = i % 2 ? r * 0.5 : r * 0.98, w = i % 2 ? r * 0.08 : r * 0.13;
      const tip = [Math.cos(A - Math.PI / 2) * L, Math.sin(A - Math.PI / 2) * L], l = [Math.cos(A) * w, Math.sin(A) * w], rr = [-l[0], -l[1]];
      G.fillStyle = c(i % 2 ? 0.35 : 0.7); G.beginPath(); G.moveTo(0, 0); G.lineTo(...tip); G.lineTo(...l); G.closePath(); G.fill();
      G.beginPath(); G.moveTo(0, 0); G.lineTo(...tip); G.lineTo(...rr); G.closePath(); G.stroke();
    }
    G.font = `600 ${r * 0.22}px Montserrat`; G.textAlign = "center"; G.textBaseline = "middle"; G.fillStyle = c(0.85);
    [["N", 0, -1], ["E", 1, 0], ["S", 0, 1], ["W", -1, 0]].forEach(([s, dx, dy]) => G.fillText(s, dx * r * 0.88, dy * r * 0.88 + (dy ? 0 : 0)));
    G.restore();
  };

  /* ---------------------------------------------------------------- texto */
  const MC = canvas(8, 8).getContext("2d");
  IM.measure = (txt, font, ls = 0) => { MC.font = font; MC.letterSpacing = ls + "px"; return MC.measureText(txt).width; };
  IM.nativeFont = fs => `700 ${fs}px ${NATIVE_FONT}`;
  IM.wordFont = fs => `400 ${fs}px 'Fjalla One'`;
  /**
   * Título en idioma original (kanji, alemán, ruso…) + traducción en mayúsculas.
   * Cada carácter entra con escala+desenfoque escalonado; la traducción se tipea en sincronía.
   * Al salir (outAt) los caracteres se borran de derecha a izquierda y la traducción se funde.
   * o = { text, sub, x, y (línea base, izquierda), width (px máx), maxFs, at, outAt, rot, align:"left"|"center", gray }
   */
  IM.native = (G, st, o, lt) => {
    const chars = Array.from(String(o.text || "")); if (!chars.length) return;
    const { u } = st;
    let fs = Math.min(o.maxFs || st.H * 0.14, o.width / Math.max(0.5, IM.measure(o.text, IM.nativeFont(100), 0) / 100));
    const font = IM.nativeFont(fs), n = chars.length, stg = Math.min(0.3, 1.1 / n), tw = IM.measure(o.text, font);
    const sub = String(o.sub || "").toUpperCase(), sfs = Math.max(u * 1.6, Math.min(fs * 0.2, (tw * 1.18) / Math.max(1, IM.measure(sub, "800 100px Montserrat", 1) / 100)));
    const x0 = o.align === "center" ? -tw / 2 : 0;
    G.save(); G.translate(o.x, o.y); G.rotate(o.rot || 0);
    G.font = font; G.textBaseline = "alphabetic"; G.textAlign = "left";
    let x = x0;
    const outAt = o.outAt ?? 1e9;
    for (let i = 0; i < n; i++) {
      const cw = IM.measure(chars[i], font), qi = prog(lt, o.at + i * stg, 0.38, "out"), qo = prog(lt, outAt + (n - 1 - i) * stg * 0.9, 0.3, "in");
      const a = qi * (1 - qo);
      if (a > 0.004) {
        const s = 1 + 0.22 * (1 - qi) + 0.06 * qo, bl = 9 * (1 - qi) + 6 * qo;
        G.save(); G.translate(x + cw / 2, -fs * 0.36); G.scale(s, s); G.translate(-cw / 2, fs * 0.36);
        G.fillStyle = IM.tone(COL.native, o.gray || 0);
        if (bl > 0.3) { G.save(); G.globalAlpha = a * 0.25; G.translate(cw / 2, -fs * 0.36); G.scale(1.12, 1.12); G.translate(-cw / 2, fs * 0.36); G.fillText(chars[i], 0, 0); G.restore(); }
        G.globalAlpha = a * 0.92; G.fillText(chars[i], 0, 0);
        G.restore();
      }
      x += cw;
    }
    if (sub) {
      const total = sub.length, nTyped = Math.floor(clamp((Math.floor(lt * 24) / 24 - o.at - 0.05) * Math.max(22, total / (n * stg + 0.05)), 0, total));
      const so = 1 - prog(lt, outAt + 0.1, 0.45, "in");
      if (nTyped > 0 && so > 0.01) {
        G.font = `800 ${sfs}px Montserrat`; G.letterSpacing = sfs * 0.01 + "px"; G.fillStyle = IM.tone(COL.sub, o.gray || 0); G.globalAlpha = so;
        const sx = o.align === "center" ? -IM.measure(sub, G.font, sfs * 0.01) / 2 : x0 + fs * 0.03;
        G.fillText(sub.slice(0, nTyped), sx, fs * 0.08 + sfs * 1.25);
      }
    }
    G.restore();
  };
  /**
   * Título condensado blanco (Fjalla One), renglones centrados que SUBEN desde abajo con un
   * degradé de opacidad (arriba aparece primero) y desenfoque. o = { text, x, y (centro), size (px del
   * renglón más largo), maxFs, at, scale, rot, alpha, rise }
   */
  IM.wordLayout = (text, width, maxFs) => {
    const lines = String(text || "").toUpperCase().split("\n").map(s => s.trim()).filter(Boolean);
    const mw = Math.max(1, ...lines.map(l => IM.measure(l, IM.wordFont(100), 1) / 100));
    const fs = Math.min(maxFs, width / mw);
    return { lines, fs, lh: fs * 1.02, h: fs * 1.02 * lines.length };
  };
  IM.word = (G, st, o, lt) => {
    const L = o.layout || IM.wordLayout(o.text, o.width, o.maxFs || st.H * 0.22); if (!L.lines.length) return;
    const { fs, lh } = L, s = o.scale ?? 1, a0 = o.alpha ?? 1;
    G.save(); G.translate(o.x, o.y); G.rotate(o.rot || 0); G.scale(s, s);
    G.font = IM.wordFont(fs); G.letterSpacing = fs * 0.01 + "px"; G.textAlign = "center"; G.textBaseline = "alphabetic";
    const top = -L.h / 2;
    const revealStagger = o.stagger ?? 0.32, revealDur = o.reveal ?? 0.95;
    L.lines.forEach((line, i) => {
      const q = o.at == null ? 1 : clamp((lt - o.at - i * revealStagger) / revealDur);
      if (q <= 0) return;
      const e = ease.out(q), yb = top + lh * (i + 0.86) + (1 - e) * fs * (o.rise ?? 0.5);
      const yT = yb - fs * 0.8, yB = yb + fs * 0.05, aT = clamp(q * 1.7) * a0, aB = clamp(q * 1.7 - 0.6) * a0;
      if (aT <= 0.005) return;
      const gr = G.createLinearGradient(0, yT, 0, yB);
      gr.addColorStop(0, `rgba(246,246,248,${aT})`); gr.addColorStop(1, `rgba(246,246,248,${Math.max(aB, aT * 0.15)})`);
      G.save();
      G.shadowColor = `rgba(18,22,26,${0.38 * aT})`; G.shadowBlur = fs * 0.09 * s; G.shadowOffsetY = fs * 0.02 * s;
      G.fillStyle = gr; G.fillText(line, 0, yb);
      if (q < 1) {                                   /* estela suave hacia abajo en vez de blur (el filtro cuesta ~0,5 s por cuadro en CPU) */
        G.shadowColor = "transparent";
        for (let k = 1; k <= 3; k++) { G.globalAlpha = 0.28 * (1 - e) / k; G.fillText(line, 0, yb + fs * 0.07 * k * (1 - e)); }
      }
      G.restore();
    });
    G.restore();
  };
  /** escala del título que se achica (exponencial: rápido al principio, después lento) */
  IM.shrink = (lt, at, to, tau) => lt <= at ? 1 : to + (1 - to) * Math.exp(-(lt - at) / Math.max(0.2, tau));

  /* ---------------------------------------------------------------- archivo */
  const BW = new Map();
  /** foto → B/N contrastado (cacheado) */
  /* B/N por renglones: en vivo se prepara de a pedazos en los ratos libres (antes: 100–300 ms de golpe al
     empezar el plano de archivo); si hace falta ya, se termina en el momento (mismo resultado) */
  const BWJ = new Map();
  const bwPx = (d, a, b) => { for (let i = a; i < b; i += 4) { let l = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255; l = clamp((l - 0.5) * 1.3 + 0.55); l = Math.pow(l, 0.92); d[i] = d[i + 1] = d[i + 2] = Math.round(l * 255); } };
  function bwJob(ctx, src) {
    if (BWJ.has(src)) return BWJ.get(src);
    const im = ctx.img(src); if (!im) return null;
    const k = Math.min(1, 1600 / Math.max(im.width, im.height)), c = canvas(im.width * k, im.height * k), g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(im, 0, 0, c.width, c.height);
    let id = null; try { id = g.getImageData(0, 0, c.width, c.height); } catch (e) {}
    const j = { c, g, id, pos: 0, im }; BWJ.set(src, j); return j;
  }
  function bwStep(j, bytes) {
    if (!j.id) return true;
    const end = Math.min(j.id.data.length, j.pos + bytes); bwPx(j.id.data, j.pos, end); j.pos = end;
    if (j.pos >= j.id.data.length) { j.g.putImageData(j.id, 0, 0); j.id = null; return true; }
    return false;
  }
  IM.bw = (ctx, src) => {
    if (!src) return null; if (BW.has(src)) return BW.get(src);
    const j = bwJob(ctx, src); if (!j) return null;
    if (j.id) bwStep(j, Infinity);
    else if (j.pos === 0 && !BW.has(src)) { j.g.filter = "grayscale(1) contrast(1.3)"; j.g.drawImage(j.im, 0, 0, j.c.width, j.c.height); j.g.filter = "none"; }
    BW.set(src, j.c); BWJ.delete(src); return j.c;
  };
  IM.warmBw = (ctx, src) => {
    if (!src || BW.has(src) || !IM.live()) return;
    const j = bwJob(ctx, src); if (!j || j.busy) return; j.busy = true;
    const step = dl => { if (BW.has(src)) return; if (bwStep(j, dl.timeRemaining() > 6 ? 600000 : 200000)) { BW.set(src, j.c); BWJ.delete(src); } else idle(step); };
    idle(step);
  };
  /** foto cover con foco y zoom */
  IM.cover = (G, im, x, y, w, h, focus = [0.5, 0.5], zoom = 1) => {
    if (!im) return;
    const iw = im.width, ih = im.height, ar = w / h; let sw = iw, sh = iw / ar; if (sh > ih) { sh = ih; sw = ih * ar; }
    sw /= zoom; sh /= zoom;
    const sx = clamp(focus[0] * iw - sw / 2, 0, iw - sw), sy = clamp(focus[1] * ih - sh / 2, 0, ih - sh);
    G.drawImage(im, sx, sy, sw, sh, x, y, w, h);
  };
  /** humo oscuro que baja desde arriba (archivo); q = 0..1 */
  IM.smoke = (G, st, t, q, depth = 0.55) => {
    if (q <= 0.01) return;
    const { W, H } = st, T = IM.tex();
    G.save();
    const lg = G.createLinearGradient(0, 0, 0, H * depth);
    lg.addColorStop(0, `rgba(8,8,8,${0.9 * q})`); lg.addColorStop(0.55, `rgba(8,8,8,${0.5 * q})`); lg.addColorStop(1, "rgba(8,8,8,0)");
    G.fillStyle = lg; G.fillRect(0, 0, W, H * depth);
    G.globalCompositeOperation = "multiply"; G.globalAlpha = 0.85 * q;
    const pat = G.createPattern(T.smoke, "repeat"), s = Math.max(W, H) / 512 * 0.9;
    pat.setTransform(new DOMMatrix().translate(-t * W * 0.012, -t * H * 0.004).scale(s));
    G.fillStyle = pat; G.fillRect(0, 0, W, H * depth * 1.25);
    G.restore();
  };

  /* ---------------------------------------------------------------- lienzo propio por plano (fundidos) */
  IM.surface = ctx => {
    const c = canvas(ctx.stage.W * ctx.dpr, ctx.stage.H * ctx.dpr), g = c.getContext("2d");
    return { c, g, begin() { g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = "source-over"; g.filter = "none"; g.clearRect(0, 0, c.width, c.height); g.setTransform(ctx.dpr, 0, 0, ctx.dpr, 0, 0); return g; },
      blit(G, a = 1) { if (a <= 0.003) return; G.save(); G.globalAlpha = a; G.drawImage(c, 0, 0, ctx.stage.W, ctx.stage.H); G.restore(); }, free() { c.width = c.height = 1; } };
  };

  /* ---------------------------------------------------------------- fondo continuo + post */
  /**
   * Cuando el plano activo no dibuja el mapa (p. ej. common.lyric), el fondo es el atlas en la
   * cámara final del último plano con mapa (sigue alejándose 1 %/s), apagado para leer el texto.
   */
  function backdrop(t, ctx) {
    const beats = ctx.beats || [], post = ctx.C.transition?.overlap ?? 0.6;
    const opaque = beats.some(b => (b.layer || "main") === "main" && K.registry.get(b.use)?.opaque && t >= b.t0 && t < b.t1 + (K.registry.get(b.use)?.post ?? post));
    if (opaque) return;
    const G = ctx.g.bg, st = ctx.stage;
    const mb = beats.filter(b => (b.layer || "main") === "main" && K.registry.get(b.use)?.mapCam && b.t0 <= t).pop();
    if (!mb || !IM.world().ok) { G.fillStyle = COL.ocean; G.fillRect(0, 0, st.W, st.H); return; }
    const c = IM.camOf(ctx, mb), dt = Math.max(0, t - mb.t1), n = Math.floor(dt / 4);
    const cam = IM.zoomCam(c.to, 1 + 0.01 * dt, 0.04 * dt), kcam = IM.zoomCam(c.to, 1 + 0.01 * (n * 4 + 2), 0.04 * (n * 4 + 2));
    const look = K.registry.get(mb.use).mapLook?.(mb.params || {}) || {};
    BD = BD || IM.mapCache(ctx);
    BD.draw(G, cam, kcam, `bd:${mb.i}:${n}`, { ...look, dim: 0.28 });
    IM.fx.grain = Math.max(IM.fx.grain, look.gray ? 0.2 : 0.1);
  }
  let VG = null, BD = null;
  /* en vivo: 2,5 s antes de cada plano con mapa se arman (por franjas) sus primeras llaves → el corte no se traba */
  let LA = -1;
  function lookAhead(t, ctx) {
    if (!IM.live() || Math.abs(t - LA) < 0.25) return; LA = t;
    for (const b of ctx.beats || []) {
      if ((b.layer || "main") !== "main" || b.t0 <= t || b.t0 > t + 3.5) continue;
      const def = K.registry.get(b.use); if (!def?.mapCam || !def.mapLook) continue;
      const p = K.resolveParams(def, b.params || {}, ctx.C), cam = IM.camOf(ctx, b), lk = def.mapLook(p) || {};
      if (p.src) IM.warmBw(ctx, p.src);
      for (const c of [cam.from, cam.to]) { const A = IM.atlas(c.lon); if (!A.rings && !A._warm) { A._warm = 1; idle(() => A.projRings()); } }
      const kk = IM.keyOf(cam, 0), grays = new Set([lk.gray >= 0.995 ? 1 : 0]); if (/archive/.test(b.use)) { grays.add(0); grays.add(1); }
      for (const gl of grays) { IM.warmKey(ctx, kk.cam, { hatch: lk.hatch, gray: gl }); if (kk.N > 0) IM.warmKey(ctx, kk.cam1, { hatch: lk.hatch, gray: gl }); }
    }
  }
  function post(t, ctx) {
    lookAhead(t, ctx);
    const G = ctx.g.top, st = ctx.stage, { W, H } = st, T = IM.tex(), f = IM.fi(t), r = K.rng(f * 7919 + 13);
    G.save();
    /* banda suave detrás de los subtítulos (el atlas es claro) */
    if (ctx.C.captions?.enabled !== false && !IM.fx.noCapBand) {
      const y0 = st.caption.y - st.caption.h * 0.9, lg = G.createLinearGradient(0, y0, 0, st.caption.y + st.caption.h * 1.6);
      lg.addColorStop(0, "rgba(10,12,14,0)"); lg.addColorStop(0.55, "rgba(10,12,14,.32)"); lg.addColorStop(1, "rgba(10,12,14,.12)");
      G.fillStyle = lg; G.fillRect(0, y0, W, H - y0);
    }
    /* grano de película a 24 cuadros/s */
    const gs = IM.fx.grain;
    if (gs > 0) { const pat = G.createPattern(T.grain[f % 4], "repeat"); pat.setTransform(new DOMMatrix().translate(r() * 256, r() * 256).scale(0.7, 0.7));
      G.globalCompositeOperation = "overlay"; G.globalAlpha = gs; G.fillStyle = pat; G.fillRect(0, 0, W, H); G.globalCompositeOperation = "source-over"; }
    /* polvo suelto en el archivo */
    if (IM.fx.dust > 0) for (let i = 0, n = Math.floor(r() * 4); i < n; i++) { G.globalAlpha = IM.fx.dust * (0.3 + r() * 0.5); G.fillStyle = r() < 0.6 ? "#111" : "#eee";
      G.beginPath(); G.arc(r() * W, r() * H, st.u * (0.1 + r() * 0.35), 0, 7); G.fill(); }
    /* viñeta */
    if (!VG || VG.W !== W || VG.H !== H) { const g = G.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.32, W / 2, H / 2, Math.hypot(W, H) * 0.62);
      g.addColorStop(0, "rgba(10,12,14,0)"); g.addColorStop(1, "rgba(10,12,14,.5)"); VG = { W, H, g }; }
    G.globalAlpha = IM.fx.vignette; G.fillStyle = VG.g; G.fillRect(0, 0, W, H);
    if (IM.fx.fade > 0) { G.globalAlpha = clamp(IM.fx.fade); G.fillStyle = "#050505"; G.fillRect(0, 0, W, H); }
    G.restore();
  }

  function injectCss() {
    if (document.getElementById("imperio-css")) return;
    const s = document.createElement("style"); s.id = "imperio-css";
    s.textContent = `
[data-family="imperio"] .k-cap { font-family: Montserrat, system-ui, sans-serif; font-weight: 600; color: rgba(246,246,248,.8);
  font-size: clamp(14px, 3.1vmin, 42px); letter-spacing: .01em; line-height: 1.25;
  text-shadow: 0 1px 2px rgba(8,10,12,.95), 0 0 12px rgba(8,10,12,.8), 0 0 30px rgba(8,10,12,.5); }
[data-family="imperio"] .k-w-cur { color: #fff; font-weight: 800; }
[data-family="imperio"] .k-punch { font-family: 'Fjalla One', 'Oswald', sans-serif; font-weight: 400; letter-spacing: .005em; line-height: .98;
  text-shadow: 0 .03em .12em rgba(14,18,22,.45); }
[data-family="imperio"] .k-punch .acc { color: #b3122f; text-shadow: 0 0 .1em rgba(255,255,255,.35); }`;
    document.head.appendChild(s);
  }
  /* las fuentes del idioma original se piden con el texto exacto (los subconjuntos CJK de Google
     Fonts no se bajan con un document.fonts.load sin texto) */
  function preloadNative(ctx) {
    const txt = new Set();
    for (const b of ctx.beats || []) for (const k of ["native", "text", "nativeText"]) { const v = b.params?.[k]; if (typeof v === "string" && /[^\u0000-ɏ]/.test(v)) txt.add(v); }
    for (const s of txt) document.fonts.load(IM.nativeFont(40), s).catch(() => {});
  }

  IM.fx = { grain: 0.1, vignette: 1, dust: 0, fade: 0, noCapBand: false };
  K.family("imperio", {
    setup(ctx) { IM.tex(); IM.world(); injectCss(); preloadNative(ctx); return {}; },
    frame(t, ctx) { IM.fx = { grain: 0.08, vignette: 0.4, dust: 0, fade: 0, noCapBand: false }; backdrop(t, ctx); },
    post(t, ctx) { post(t, ctx); },
    resize() { VG = null; if (BD) BD.free(); BD = null; IM.clearKeys(); },
  });
})();
