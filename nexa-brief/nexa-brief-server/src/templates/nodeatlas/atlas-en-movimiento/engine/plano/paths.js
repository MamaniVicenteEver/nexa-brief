// Único anclaje al Atlas compartido. Al mover a _atlas/plano/: '../../../_atlas/' → '../'.
export const ATLAS = new URL('/api/v1/explainer/files/bundled/nodeatlas/_atlas/', location.origin);
export const atlasURL = path => new URL(path, ATLAS).href;
export const PROTO = new URL('/api/v1/explainer/files/sandbox/_proto/proto.js', location.origin).href;
export const LOOKS = new URL('../looks/', import.meta.url);
export async function readJSON(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status}: ${url}`);
  return response.json();
}
export async function sharedModules() {
  const [camera, geo] = await Promise.all([import(atlasURL('camera.js')), import(atlasURL('geo.js'))]);
  return {...camera, ...geo};
}
