import test from 'node:test';
import assert from 'node:assert/strict';
import { getResource, loadCatalog, readSvg, searchCatalog } from '../src/index.js';

const catalog = await loadCatalog();

test('el catálogo contiene recursos únicos de las tres bibliotecas', () => {
  assert.ok(catalog.resources.length > 1000);
  assert.equal(new Set(catalog.resources.map(row => row.id)).size, catalog.resources.length);
  for (const provider of ['simple-icons', 'lucide', 'devicon']) {
    assert.ok(catalog.resources.some(row => row.provider === provider));
  }
});

test('busca por nombre en español y filtra por proveedor con paginación', () => {
  const result = searchCatalog(catalog, {query: 'servidor', provider: 'lucide', limit: 1});
  assert.ok(result.total >= 1);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].id, 'icon.lucide.server');
  assert.equal(searchCatalog(catalog, {query: 'servidor', provider: 'lucide', offset: result.total}).items.length, 0);
});

test('devuelve el SVG local y conserva las licencias de marca como datos individuales', async () => {
  const brand = getResource(catalog, 'brand.simple-icons.github');
  assert.equal(brand?.label, 'GitHub');
  assert.ok(Object.hasOwn(brand, 'license'));
  assert.match(await readSvg(catalog, 'brand.simple-icons.github'), /<svg\b/);
  assert.match(await readSvg(catalog, 'icon.lucide.server'), /<svg\b/);
  assert.match(await readSvg(catalog, 'tech.devicon.python.original'), /<svg\b/);
});

test('rechaza identificadores y rutas fuera de los recursos permitidos', async () => {
  assert.equal(getResource(catalog, '../../etc/passwd'), null);
  await assert.rejects(readSvg(catalog, '../../etc/passwd'), /no encontrado/i);
  const record = {...getResource(catalog, 'icon.lucide.server'), file: 'icons/../../etc/passwd.svg'};
  const malicious = {...catalog, resources: [record]};
  await assert.rejects(readSvg(malicious, record.id), /inválida/i);
});
