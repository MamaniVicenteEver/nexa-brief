/** Shared, offline-capable visual-resource catalog for Nexa. */
import { readFile, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const catalogPath = resolve(root, 'dist/catalog.json');
const fold = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
const clamp = (value, min, max, fallback) => Number.isSafeInteger(value) ? Math.min(max, Math.max(min, value)) : fallback;

export async function loadCatalog(path = catalogPath) {
  let catalog;
  try { catalog = JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') throw new Error('Catálogo no preparado. Ejecuta pnpm build.'); throw error; }
  if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.resources) || !catalog.sources) throw new Error('Catálogo inválido.');
  return catalog;
}

/** Search metadata; returns only one page, never thousands of SVGs. */
export function searchCatalog(catalog, {query = '', provider = '', category = '', offset = 0, limit = 30} = {}) {
  const terms = fold(query).trim().split(/\s+/).filter(Boolean);
  const rows = catalog.resources.filter(row => {
    if (provider && row.provider !== provider) return false;
    if (category && row.category !== category) return false;
    const haystack = fold([row.id, row.label, ...(row.tags ?? [])].join(' '));
    return terms.every(term => haystack.includes(term));
  });
  const start = clamp(offset, 0, Number.MAX_SAFE_INTEGER, 0);
  const size = clamp(limit, 1, 100, 30);
  return {total: rows.length, offset: start, limit: size, items: rows.slice(start, start + size)};
}

export function getResource(catalog, id) {
  if (typeof id !== 'string' || !/^[a-z0-9_.-]+$/.test(id) || id.includes('..')) return null;
  return catalog.resources.find(row => row.id === id) ?? null;
}

/** Only resolve files explicitly listed under a known installed package. */
export async function readSvg(catalog, id, packageRoot = root) {
  const resource = getResource(catalog, id);
  if (!resource) throw new Error('Recurso no encontrado.');
  const source = catalog.sources[resource.provider];
  if (!source || !['simple-icons', 'lucide-static', 'devicon'].includes(source.package) ||
      typeof resource.file !== 'string' || !/^icons\/[a-z0-9_./-]+\.svg$/.test(resource.file) || resource.file.includes('..')) {
    throw new Error('Ruta del recurso inválida.');
  }
  const base = await realpath(resolve(packageRoot, 'node_modules', source.package));
  const path = await realpath(resolve(base, resource.file));
  const inside = relative(base, path);
  if (!inside || inside.startsWith(`..${sep}`) || inside === '..' || isAbsolute(inside)) throw new Error('Ruta del recurso inválida.');
  return readFile(path, 'utf8');
}
