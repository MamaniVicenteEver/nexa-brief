// El mismo lector sirve en CLI y navegador; no hay dependencias de DOM al importar.
export async function readJSON(url) {
  url = url instanceof URL ? url : new URL(url, import.meta.url);
  if (url.protocol === 'file:') {
    const {readFile} = await import('node:fs/promises');
    return JSON.parse(await readFile(url, 'utf8'));
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status}: ${url}`);
  return response.json();
}
export const atlasGeoURL = new URL('../../../../_atlas/data/geo/admin0.geojson', import.meta.url);
