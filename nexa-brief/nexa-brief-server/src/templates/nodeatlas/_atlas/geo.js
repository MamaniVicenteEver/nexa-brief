import { spanToZoom } from './camera.js';
const norm = v => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function createGeo(scene = {}, resolved = {}, collections = []) {
  const index = new Map();
  const add = (key, value) => { if (key != null && !index.has(norm(key))) index.set(norm(key), value); };
  for (const feature of collections.flatMap(c => c?.features || [])) {
    const p = feature.properties || {}, item = { ...p, geometry: feature.geometry };
    for (const key of [p.id, p.iso3, p.name, p.name_es]) add(key, item);
  }
  for (const item of resolved.regions || []) for (const key of [item.id, item.name]) index.set(norm(key), item);
  for (const [name, item] of Object.entries(scene.regions || {})) add(name, item);
  const region = name => typeof name === 'object' && !Array.isArray(name) ? name : index.get(norm(name));
  const place = name => {
    if (Array.isArray(name) && typeof name[0] === 'number') return name.slice(0, 2);
    const own = scene.places?.[name]; if (own) return Array.isArray(own) ? own : own.coordinates || own.center;
    const item = region(name); if (!item) return null;
    if (item.label) return item.label;
    if (item.bbox) return [(item.bbox[0] + item.bbox[2]) / 2, (item.bbox[1] + item.bbox[3]) / 2];
    return item.center || null;
  };
  return { region, place };
}
export function cameraKeys(scene, geo, T = x => Number(x) || 0, width = 1920) {
  return (scene.camera?.length ? scene.camera : [{t:0, center:[0,20], span:120}]).map(k => {
    const focus = k.focus ?? k.center ?? k.c ?? [0,20], item = geo.region(focus);
    const center = geo.place(focus); if (!center) throw new Error(`Atlas: lugar o región desconocido: ${focus}`);
    const bbox = item?.bbox, span = k.span ?? (bbox ? Math.max(1, bbox[2] - bbox[0], (bbox[3] - bbox[1]) * 1.5) * (1 + (k.pad ?? 0.18) * 2) : 30);
    return { ...k, t:T(k.t,0), center, zoom:k.zoom ?? spanToZoom(span,width), pitch:k.pitch ?? 0, bearing:k.bearing ?? 0 };
  });
}
