import {mercator, pathAt, wrap} from '../util.js';
const EPS = 1e-12;
const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const on = (p, a, b) => Math.abs(cross(a, b, p)) <= EPS && p[0] >= Math.min(a[0], b[0]) - EPS && p[0] <= Math.max(a[0], b[0]) + EPS && p[1] >= Math.min(a[1], b[1]) - EPS && p[1] <= Math.max(a[1], b[1]) + EPS;
export function segmentsIntersect(a, b, c, d) {
  const v = [cross(a, b, c), cross(a, b, d), cross(c, d, a), cross(c, d, b)];
  return (v[0] * v[1] < 0 && v[2] * v[3] < 0) || on(c, a, b) || on(d, a, b) || on(a, c, d) || on(b, c, d);
}
export function pointInRing(p, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j], b = ring[i]; if (on(p, a, b)) return true;
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
const overlaps = (a, b) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
export function landIndex(collection) {
  const result = [];
  for (const feature of collection?.features || []) {
    const geom = feature.geometry, polys = geom?.type === 'Polygon' ? [geom.coordinates] : geom?.type === 'MultiPolygon' ? geom.coordinates : [];
    for (const polygon of polys) {
      const rings = polygon.map(r => {
        const points = r.map(p => mercator(...p));
        for (let i=1; i<points.length; i++) points[i][0] = points[i-1][0] + wrap((points[i][0]-points[i-1][0])*360)/360;
        return points;
      });
      if (!rings[0]?.length) continue;
      // Los huecos deben quedar en la misma copia del mundo que el exterior.
      for (const ring of rings.slice(1)) if (ring.length) {
        const shift = Math.round(rings[0][0][0]-ring[0][0]);
        for (const p of ring) p[0] += shift;
      }
      const bbox = [Infinity, Infinity, -Infinity, -Infinity];
      for (const p of rings[0]) { bbox[0] = Math.min(bbox[0], p[0]); bbox[1] = Math.min(bbox[1], p[1]); bbox[2] = Math.max(bbox[2], p[0]); bbox[3] = Math.max(bbox[3], p[1]); }
      result.push({rings, bbox, place: feature.properties?.name_es || feature.properties?.name || feature.properties?.id || 'tierra'});
    }
  }
  return result;
}
export function seaCrossings(path, land) {
  const result = [], via = path.via;
  // Las curvas se validan en su geometría dibujada, además del trazado por waypoints.
  const samples = path.curve && path.curve !== 'line' ? Math.max(64, via.length * 64) : via.length - 1;
  const uniform = {...path, t: 0, dur: 1, ease: 'linear'};
  const points = path.curve && path.curve !== 'line' ? Array.from({length: samples + 1}, (_, i) => {
    const p = pathAt(uniform, i / samples); return [p.lon, p.lat];
  }) : via;
  for (let i = 0; i < points.length - 1; i++) {
    const a = mercator(...points[i]), b = mercator(...points[i + 1]);
    // Desenrollar el antimeridiano evita probar la ruta opuesta por todo el mundo.
    if (b[0] - a[0] > .5) b[0]--; if (b[0] - a[0] < -.5) b[0]++;
    for (const shift of [-1, 0, 1]) {
      const aa = [a[0] + shift, a[1]], bb = [b[0] + shift, b[1]], box = [Math.min(aa[0], bb[0]), Math.min(aa[1], bb[1]), Math.max(aa[0], bb[0]), Math.max(aa[1], bb[1])];
      for (const part of land) {
        if (!overlaps(box, part.bbox)) continue;
        const contains = p => pointInRing(p, part.rings[0]) && !part.rings.slice(1).some(r => pointInRing(p, r));
        const crosses = part.rings.some(r => r.some((p, j) => segmentsIntersect(aa, bb, p, r[(j + 1) % r.length])));
        if (contains(aa) || contains(bb) || crosses) {
          result.push({segment: i, from: points[i], to: points[i + 1], place: part.place,
            suggestion: 'Añadir waypoints por agua alrededor de esta costa y volver a validar.'});
          break;
        }
      }
    }
  }
  return result.filter((v, i, all) => all.findIndex(x => x.segment === v.segment && x.place === v.place) === i);
}
