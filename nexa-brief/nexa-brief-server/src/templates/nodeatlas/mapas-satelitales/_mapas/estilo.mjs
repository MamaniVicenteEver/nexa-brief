/* Un preset por escena: los tiempos y la geografía siguen siendo datos del episodio. */
const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
export function merge(base, override = {}) {
  const result = structuredClone(base);
  for (const [key, value] of Object.entries(override)) {
    if (forbidden.has(key)) throw Error('Clave de estilo inválida');
    result[key] = value && typeof value === 'object' && !Array.isArray(value) && result[key] && typeof result[key] === 'object' && !Array.isArray(result[key])
      ? merge(result[key], value) : structuredClone(value);
  }
  return result;
}
export function resolveStyle(data, overrides = {}, format = 'escritorio') {
  const combined = merge(data, overrides);
  const resolved = merge(combined, combined.formatos?.[format] || {});
  delete resolved.formatos;
  return resolved;
}
export function resolveLayer(layer, style, format) {
  const oriented = layer[format === 'movil' ? 'portrait' : 'landscape'] || {};
  return merge(merge(style.layers?.[layer.type] || {}, layer), oriented);
}
export async function applyStyle(c, base) {
  const query = new URLSearchParams(location.search);
  const id = query.get('estilo') || c.scene.estilo || c.C.estilo;
  if (!id) return; // Las escenas históricas conservan sus valores originales.
  const response = await fetch(base + 'estilos/index.json');
  if (!response.ok) throw Error('No se pudo cargar el índice de estilos');
  const index = await response.json();
  if (!index.estilos.some(row => row.id === id)) throw Error('Estilo de Mapas inválido: ' + id);
  const loaded = await fetch(base + 'estilos/' + encodeURIComponent(id) + '.json');
  if (!loaded.ok) throw Error('No se pudo cargar el estilo: ' + id);
  const data = await loaded.json();
  const revision = c.scene.estiloRevision ?? c.C.estiloRevision;
  if (revision != null && revision !== data.revision) throw Error('Revisión de estilo incompatible');
  const overrides = merge(c.C.estiloOverrides || {}, c.scene.estiloOverrides || {});
  const format = query.get('formato') || c.scene.formato || c.C.formato || (c.st.H > c.st.W ? 'movil' : 'escritorio');
  if (!['movil', 'escritorio'].includes(format)) throw Error('Formato de estilo inválido');
  c.style = resolveStyle(data, overrides, format);
  c.scene.estilo = id;
  c.scene.estiloRevision = data.revision;
  c.scene.layers = (c.scene.layers || []).map(layer => resolveLayer(layer, c.style, format));
  c.scene.captions = merge(c.style.captions || {}, c.scene.captions || {});
  c.scene.dim ??= c.style.map.dim;
  Object.assign(c.theme, c.style.theme);
  const font = new FontFace(c.style.text.font, `url(${data.font_url})`, {weight:String(data.font_weight)});
  document.fonts.add(await font.load());
  await document.fonts.load(`${data.font_weight} 40px '${c.style.text.font}'`);
  window.__nexaStyle = {id, revision:data.revision, format};
}
