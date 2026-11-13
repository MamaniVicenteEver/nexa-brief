const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const MAX_LAT = 85.0511287798066;
export const FLAG_TEXTURE_SIZE = 2048;
const mod = (v, n) => ((v % n) + n) % n;
const mercatorY = lat => (1 - Math.log(Math.tan(Math.PI / 4 + clamp(lat, -MAX_LAT, MAX_LAT) * Math.PI / 360)) / Math.PI) / 2;
const latitude = y => Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180 / Math.PI;

/** Conserva todos los anillos; el corte longitudinal evita un rectángulo casi mundial. */
export function flagTexturePlan(input, maxSize = FLAG_TEXTURE_SIZE) {
  const geometry = input?.type === 'Feature' ? input.geometry : input;
  const polygons = geometry?.type === 'Polygon' ? [geometry.coordinates] : geometry?.type === 'MultiPolygon' ? geometry.coordinates : null;
  if (!polygons?.length) throw Error('flag-fill necesita geometría Polygon o MultiPolygon');
  const longitudes = [];
  for (const polygon of polygons) {
    if (!polygon?.length) throw Error('flag-fill: polígono vacío');
    for (const ring of polygon) {
      if (!Array.isArray(ring) || ring.length < 4) throw Error('flag-fill: anillo inválido');
      for (const point of ring) {
        if (!Array.isArray(point) || !Number.isFinite(point[0]) || !Number.isFinite(point[1]) || Math.abs(point[0]) > 180 || Math.abs(point[1]) > 90) throw Error('flag-fill: coordenadas inválidas');
        longitudes.push(mod(point[0], 360));
      }
      if (ring[0][0] !== ring.at(-1)[0] || ring[0][1] !== ring.at(-1)[1]) throw Error('flag-fill: anillo sin cerrar');
    }
  }
  const sorted = [...new Set(longitudes)].sort((a, b) => a - b);
  let gap = -1, start = sorted[0];
  sorted.forEach((lon, i) => {
    const next = sorted[(i + 1) % sorted.length] + (i === sorted.length - 1 ? 360 : 0);
    if (next - lon > gap) { gap = next - lon; start = mod(next, 360); }
  });
  const span = 360 - gap, offset = 360 * Math.floor((start + span / 2 + 180) / 360);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  let clamped = false;
  const rings = polygons.map(polygon => polygon.map(ring => ring.map(([lon, lat]) => {
    const unwrapped = start + mod(lon - start, 360) - offset;
    const x = (unwrapped + 180) / 360, y = mercatorY(lat);
    clamped ||= Math.abs(lat) > MAX_LAT;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    return [x, y];
  })));
  for (const polygon of rings) for (const ring of polygon) for (let i = 1; i < ring.length; i++) {
    if (Math.abs(ring[i][0] - ring[i - 1][0]) > .5 + 1e-9) throw Error('flag-fill: geometría polar o mundial no compatible con una textura Mercator');
  }
  if (!(x1 > x0 && y1 > y0)) throw Error('flag-fill: geometría sin área');
  const size = clamp(Math.floor(maxSize) || FLAG_TEXTURE_SIZE, 1, FLAG_TEXTURE_SIZE);
  const scale = size / Math.max(x1 - x0, y1 - y0), height = Math.min(size, Math.max(1, Math.ceil((y1 - y0) * scale)));
  const parts = [];
  // A lo sumo dos fuentes por país, nunca una imagen por isla.
  for (let world = Math.floor(x0); world < Math.ceil(x1); world++) {
    const left = Math.max(x0, world), right = Math.min(x1, world + 1);
    if (right - left < 1e-12) continue;
    parts.push({x0:left, x1:right, y0, y1, width:Math.min(size, Math.max(1, Math.ceil((right - left) * scale))), height,
      coordinates:[[360 * (left - world) - 180, latitude(y0)], [360 * (right - world) - 180, latitude(y0)], [360 * (right - world) - 180, latitude(y1)], [360 * (left - world) - 180, latitude(y1)]]});
  }
  if (parts.length > 2) throw Error('flag-fill: extensión mundial no compatible');
  return {rings, x0, x1, y0, y1, parts, clamped};
}

/** Canvas inmutable: recorte par/impar preserva huecos aunque cambie el winding. */
export function paintFlagTexture(canvas, image, plan, part, fit = 'global') {
  if (!['global', 'landmass'].includes(fit)) throw Error('flag-fill: fit debe ser global o landmass');
  canvas.width = part.width; canvas.height = part.height;
  const g = canvas.getContext('2d');
  if (!g) throw Error('flag-fill: canvas 2D no disponible');
  const sx = canvas.width / (part.x1 - part.x0), sy = canvas.height / (part.y1 - part.y0);
  if (fit === 'landmass') {
    for (const polygon of plan.rings) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const [x, y] of polygon[0]) {
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
      if (x1 <= part.x0 || x0 >= part.x1 || !(x1 > x0 && y1 > y0)) continue;
      g.save();
      g.beginPath();
      for (const ring of polygon) {
        ring.forEach(([x, y], i) => g[i ? 'lineTo' : 'moveTo']((x - part.x0) * sx, (y - part.y0) * sy));
        g.closePath();
      }
      g.clip('evenodd');
      // Mismo UV en ambas partes si esta masa cruza ±180°; no se crea otro canvas.
      g.drawImage(image, (x0 - part.x0) * sx, (y0 - part.y0) * sy, (x1 - x0) * sx, (y1 - y0) * sy);
      g.restore();
    }
    return canvas;
  }
  g.save();
  g.beginPath();
  for (const polygon of plan.rings) for (const ring of polygon) {
    ring.forEach(([x, y], i) => g[i ? 'lineTo' : 'moveTo']((x - part.x0) * sx, (y - part.y0) * sy));
    g.closePath();
  }
  g.clip('evenodd');
  // Una bandera georreferenciada sobre todo el territorio; cada parte conserva el mismo UV.
  g.drawImage(image, (plan.x0 - part.x0) * sx, 0, (plan.x1 - plan.x0) * sx, canvas.height);
  g.restore();
  return canvas;
}

export function flagOpacityKeys(layer, T = (v, fallback) => typeof v === 'number' ? v : fallback) {
  if (layer.opacityKeys === undefined) return [];
  if (!Array.isArray(layer.opacityKeys)) throw Error('opacityKeys debe ser una lista de {t,value}');
  let previous = -Infinity;
  return layer.opacityKeys.map((key, index) => {
    const t = key && T(key.t, NaN), value = key?.value;
    if (!Number.isFinite(t) || t < 0 || t <= previous) throw Error(`opacityKeys[${index}].t debe resolverse y crecer estrictamente`);
    if (!Number.isFinite(value) || value < 0 || value > 1) throw Error(`opacityKeys[${index}].value fuera de 0–1`);
    previous = t;
    return {t, value};
  });
}

export function flagFillOpacity(layer, time, T = (v, fallback) => typeof v === 'number' ? v : fallback, resolvedKeys = null) {
  const start = T(layer.t, 0), dur = Math.max(0, layer.dur ?? .8), out = layer.out == null ? Infinity : T(layer.out, Infinity);
  const fade = Math.max(0, layer.fadeOut ?? .4);
  const entrance = time < start ? 0 : dur ? clamp((time - start) / dur) : 1;
  const exit = time < out ? 1 : fade ? clamp(1 - (time - out) / fade) : 0;
  const keys = resolvedKeys ?? flagOpacityKeys(layer, T);
  let value = keys.length ? keys[0].value : 1;
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1], b = keys[i];
    if (time >= b.t) { value = b.value; continue; }
    if (time > a.t) value = a.value + (b.value - a.value) * (time - a.t) / (b.t - a.t);
    break;
  }
  return clamp(layer.opacity ?? 1) * value * entrance * exit;
}

export function flagFillRegion(layer, index, {resolved = {}, collections = [], region = () => null} = {}) {
  const item = (resolved.regions || []).find(r => r.layer === index && r.field === 'region');
  return collections.flatMap(c => c?.features || []).find(f => f.properties?.id === item?.id) || item || region(layer.region);
}

/** Los recursos pertenecen a esta instancia y no crean relojes ni cachés globales. */
export async function createFlagFills(scene, env) {
  const entries = [], textures = [], T = env.T;
  for (const [index, layer] of (scene.layers || []).entries()) {
    if (layer.type !== 'flag-fill') continue;
    const found = flagFillRegion(layer, index, env), geometry = found?.geometry;
    if (!geometry) { env.missing?.(`región no encontrada: ${layer.region}`); continue; }
    const src = layer.src;
    if (!src) { env.missing?.('imagen ausente: flag-fill sin src'); continue; }
    const fit = layer.fit === undefined ? 'global' : layer.fit;
    if (!['global', 'landmass'].includes(fit)) { env.missing?.(`flag-fill: ${layer.region}: fit debe ser global o landmass`); continue; }
    let opacityKeys;
    try { opacityKeys = flagOpacityKeys(layer, T); }
    catch (error) { env.missing?.(`flag-fill: ${layer.region}: ${error.message}`); continue; }
    let texture = textures.find(item => item.geometry === geometry && item.src === src && item.fit === fit);
    if (!texture) {
      let image;
      try { image = await env.loadImg(env.base ? new URL(src, env.base).href : src); } catch { /* informar la misma ruta del JSON */ }
      if (!image || !(image.width > 0 && image.height > 0)) { env.missing?.(`imagen ausente: ${src}`); continue; }
      let plan;
      try { plan = flagTexturePlan(geometry); }
      catch (error) { env.missing?.(`flag-fill: ${layer.region}: ${error.message}`); continue; }
      if (plan.clamped) { env.missing?.(`flag-fill: ${layer.region} excede ±${MAX_LAT.toFixed(5)}° Mercator`); continue; }
      texture = {id:'flag-texture-' + index, geometry, src, fit, parts:plan.parts.map(part => ({...part, canvas:paintFlagTexture(env.canvas ? env.canvas() : document.createElement('canvas'), image, plan, part, fit)}))};
      textures.push(texture);
    }
    entries.push({layer, id:'flag-fill-' + index, texture, opacityKeys});
  }
  return {
    appendTo(style) {
      for (const texture of textures) texture.parts.forEach((part, i) => {
        style.sources[texture.id + '-' + i] = {type:'canvas', canvas:part.canvas, coordinates:part.coordinates, animate:false};
      });
      for (const entry of entries) entry.texture.parts.forEach((part, i) => style.layers.push({
        id:entry.id + '-' + i, type:'raster', source:entry.texture.id + '-' + i,
        paint:{'raster-opacity':0, 'raster-opacity-transition':{duration:0, delay:0}, 'raster-fade-duration':0}
      }));
    },
    apply(map, time) {
      for (const entry of entries) {
        const opacity = flagFillOpacity(entry.layer, time, T, entry.opacityKeys);
        entry.texture.parts.forEach((part, i) => {
          const id = entry.id + '-' + i;
          if (map.getLayer(id) && map.getPaintProperty(id, 'raster-opacity') !== opacity) map.setPaintProperty(id, 'raster-opacity', opacity);
        });
      }
    },
    stats:() => ({layers:entries.length, textures:textures.length, canvases:textures.reduce((n, v) => n + v.parts.length, 0)})
  };
}
