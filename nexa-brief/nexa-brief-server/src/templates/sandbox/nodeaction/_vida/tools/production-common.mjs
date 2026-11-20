import {createHash, randomUUID} from 'node:crypto';
import {readFile, writeFile, rename, mkdir, stat} from 'node:fs/promises';
import {dirname, resolve, join, basename, isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const STEPS = ['validate', 'review', 'voice', 'mix', 'render'];
export const ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
export const json = async file => JSON.parse(await readFile(file, 'utf8'));
export const hash = value => createHash('sha256').update(value).digest('hex');
export async function fileHash(file) {
  try { return hash(await readFile(file)); } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
}
export async function exists(file) {
  try { await stat(file); return true; } catch (e) { if (e.code === 'ENOENT') return false; throw e; }
}
export async function save(file, value) {
  await mkdir(dirname(file), {recursive: true});
  const temporary = `${file}.${randomUUID()}.tmp`;
  try { await writeFile(temporary, JSON.stringify(value, null, 2) + '\n'); await rename(temporary, file); }
  finally { const {rm} = await import('node:fs/promises'); await rm(temporary, {force: true}); }
}
export function episodePath(input, root = ROOT) {
  if (!input) throw new Error('Falta el id o la ruta de episode.json.');
  if (ID.test(input)) return join(root, '..', input, 'assets/episode.json');
  if (!input.endsWith('.json')) throw new Error('Usá un id kebab-case o una ruta a episode.json.');
  return resolve(input);
}
export function episodeDirectory(file) {
  for (let dir = dirname(file); dirname(dir) !== dir; dir = dirname(dir)) {
    if (basename(dir) === 'assets') return dirname(dir);
  }
  return dirname(file);
}
export function resourcePaths(file, episode) {
  const base = dirname(file);
  return {
    timing: resolve(base, episode.resources?.timing ?? 'timing.json'),
    audioBase: resolve(base, episode.resources?.audioBase ?? '.'),
    dialogue: resolve(base, episode.resources?.dialogue ?? 'dialogue.mp3'),
    ...(episode.resources?.ambient ? {ambient: resolve(base, episode.resources.ambient)} : {})
  };
}
export function parseArgs(argv, {values = [], flags = []} = {}) {
  const result = {}, positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) { positional.push(arg); continue; }
    const key = arg.slice(2);
    if (Object.hasOwn(result, key)) throw new Error(`Opción repetida: ${arg}`);
    if (flags.includes(key)) result[key] = true;
    else if (values.includes(key) && argv[i + 1] && !argv[i + 1].startsWith('--')) result[key] = argv[++i];
    else throw new Error(`Opción inválida o sin valor: ${arg}`);
  }
  if (positional.length !== 1) throw new Error('Indicá exactamente un id o una ruta.');
  return {input: positional[0], ...result};
}
export function csv(value, name) {
  const list = typeof value === 'string' ? value.split(',') : value;
  if (!Array.isArray(list) || !list.length || list.some(x => !ID.test(x)) || new Set(list).size !== list.length)
    throw new Error(`${name}: usá ids kebab-case separados por comas, sin repeticiones.`);
  return list;
}
// No registrar claves ni errores crudos de un proveedor en produce.json.
export function safeError(error) {
  let message = String(error?.message ?? error);
  for (const [name, value] of Object.entries(process.env))
    if (/GEMINI_API_KEY\d*$/.test(name) && value) message = message.split(value).join('[oculto]');
  return message.replace(/AIza[\w-]+/g, '[oculto]').slice(-3000);
}
export function clipPath(base, clip) {
  if (typeof clip !== 'string' || !clip) return null;
  return isAbsolute(clip) ? clip : resolve(base, clip);
}
