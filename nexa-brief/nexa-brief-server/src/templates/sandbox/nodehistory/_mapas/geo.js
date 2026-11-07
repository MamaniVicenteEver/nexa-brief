/* geo.js · geografía del motor de mapas: países, regiones, lugares y encuadres.
 *
 * Todo lo que en la escena es un LUGAR puede escribirse de tres formas:
 *   [lon, lat]          coordenada directa
 *   "Antofagasta"       un lugar de places.json (o de scene.places, que lo pisa)
 *   "Bolivia"           un país (Natural Earth, nombre en inglés) → su centro (o el de places.json)
 * Regiones (para pintar/rayar/encuadrar): país · scene.regions {union:[…]} · {of, cut:[[lon,lat]…]}
 * (país recortado por un polígono) · {poly:[lugar…]} (polígono propio).
 * fit(objetivos, pad) → bounds en unidades Mercator para que la cámara encuadre sola.
 */
(() => {
  "use strict";
  const RAD = Math.PI / 180;
  const merc = ([lon, lat]) => [lon * RAD, -Math.log(Math.tan(Math.PI / 4 + (Math.max(-85, Math.min(85, lat)) * RAD) / 2))];

  function create(scene, placesBase) {
    const world = topojson.feature(KIT_WORLD_50m, KIT_WORLD_50m.objects.countries).features;
    const byName = new Map(world.map(f => [f.properties.name, f]));
    // tierra firme y costa: los polígonos propios se recortan contra la tierra (no cruzan el mar)
    const T50 = KIT_WORLD_50m, geoms = T50.objects.countries.geometries;
    const land = topojson.merge(T50, geoms), coast = topojson.mesh(T50, T50.objects.countries, (a, b) => a === b);
    const alias = { ...(placesBase?.aliases || {}), ...(scene.aliases || {}) };
    const places = { ...(placesBase?.places || {}), ...(scene.places || {}) };
    const warned = new Set();
    const warn = (...a) => { const k = a.join(" "); if (!warned.has(k)) { warned.add(k); console.warn("[mapas]", ...a); } };
    const country = n => byName.get(alias[n] || n);

    /** lugar → [lon, lat] */
    function place(v) {
      if (Array.isArray(v) && typeof v[0] === "number") return v;
      if (places[v]) return places[v];
      const f = country(v);
      if (f) return d3.geoCentroid(f);
      if (scene.regions?.[v]) { const b = bounds([v]); return unmerc([(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2]); }
      warn("lugar desconocido:", v); return [0, 0];
    }
    const unmerc = ([x, y]) => [x / RAD, (2 * Math.atan(Math.exp(-y)) - Math.PI / 2) / RAD];

    const REG = new Map();
    /** región → { feats, clips, poly } */
    function region(name) {
      if (REG.has(name)) return REG.get(name);
      const R = (scene.regions || {})[name]; let out;
      if (!R) { const f = country(name); if (!f) warn("país/región desconocido:", name); out = { feats: f ? [f] : [], clips: [] }; }
      else if (R.union) out = { feats: R.union.flatMap(n => region(n).feats), clips: [] };
      else if (R.of) out = { feats: region(R.of).feats, clips: [R.cut.map(place)] };
      else if (R.poly) out = { feats: [], poly: R.poly.map(place), clips: [], land: R.land !== false, within: R.within ? [].concat(R.within).flatMap(n => region(n).feats) : null };
      else out = { feats: [], clips: [] };
      REG.set(name, out); return out;
    }

    /** bounds en Mercator de una lista de objetivos (países, regiones, lugares, coordenadas) */
    function bounds(targets) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      const add = ll => { const [x, y] = merc(ll); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); };
      for (const t of [].concat(targets)) {
        if (Array.isArray(t) && typeof t[0] === "number") { add(t); continue; }
        const isRegion = scene.regions?.[t] || country(t);
        if (!isRegion) { add(place(t)); continue; }
        const R = region(t);
        if (R.poly) R.poly.forEach(add);
        for (const f of R.feats) {
          // el cuadro de d3 corta mal países que cruzan el antimeridiano: alcanza para el prototipo
          const b = d3.geoBounds(f); add(b[0]); add(b[1]);
        }
        if (R.clips.length) { // país recortado: el cuadro es la intersección aproximada
          const cb = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
          R.clips[0].forEach(ll => { const [x, y] = merc(ll); cb.x0 = Math.min(cb.x0, x); cb.x1 = Math.max(cb.x1, x); cb.y0 = Math.min(cb.y0, y); cb.y1 = Math.max(cb.y1, y); });
          x0 = Math.max(x0, cb.x0); x1 = Math.min(x1, cb.x1); y0 = Math.max(y0, cb.y0); y1 = Math.min(y1, cb.y1);
        }
      }
      if (!isFinite(x0)) return [[0, 0], [0.1, 0.1]];
      return [[x0, y0], [x1, y1]];
    }

    return { byName, country, place, region, bounds, merc, unmerc, warn, land, coast };
  }

  window.Mapas = window.Mapas || {};
  window.Mapas.geo = { create, merc };
})();
