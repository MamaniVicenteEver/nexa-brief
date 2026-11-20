// Único anclaje al Atlas compartido. Al mover a _atlas/plano/: '../../../_atlas/' → '../'.
export const ATLAS = new URL('../../../_atlas/', import.meta.url);
export const atlasURL = path => new URL(path, ATLAS).href;
export const PROTO = new URL('../../_proto/proto.js', ATLAS).href;
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
