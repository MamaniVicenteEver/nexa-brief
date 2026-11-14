#!/usr/bin/env node
import { getResource, loadCatalog, readSvg, searchCatalog } from './index.js';

function option(args, name, fallback = '') {
  const index = args.indexOf(`--${name}`);
  if (index < 0) return fallback;
  if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`Falta un valor para --${name}.`);
  return args[index + 1];
}
async function main() {
  const [command, ...args] = process.argv.slice(2);
  const catalog = await loadCatalog();
  if (command === 'stats') {
    const providers = Object.fromEntries(Object.keys(catalog.sources).map(name => [name, catalog.resources.filter(row => row.provider === name).length]));
    console.log(JSON.stringify({total: catalog.resources.length, providers}, null, 2));
  } else if (command === 'search') {
    const query = args[0] && !args[0].startsWith('--') ? args[0] : '';
    const limit = Number(option(args, 'limit', '30'));
    const offset = Number(option(args, 'offset', '0'));
    if (!Number.isSafeInteger(limit) || !Number.isSafeInteger(offset) || limit < 1 || offset < 0) throw new Error('Límite o desplazamiento inválido.');
    const result = searchCatalog(catalog, {query, provider: option(args, 'provider'), category: option(args, 'category'), limit, offset});
    console.log(JSON.stringify(result, null, 2));
  } else if (command === 'get') {
    const resource = getResource(catalog, args[0]);
    if (!resource) throw new Error('Recurso no encontrado.');
    console.log(JSON.stringify(resource, null, 2));
  } else if (command === 'svg') {
    process.stdout.write(await readSvg(catalog, args[0]));
  } else {
    throw new Error('Uso: node src/cli.js stats | search [texto] [--provider nombre] [--limit N] [--offset N] | get ID | svg ID');
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
