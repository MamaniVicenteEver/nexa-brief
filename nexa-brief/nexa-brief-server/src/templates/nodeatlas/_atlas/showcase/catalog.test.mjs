import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = name => JSON.parse(fs.readFileSync(new URL(name, import.meta.url), 'utf8'));
test('todos los componentes tienen un fotograma real y un grupo en la biblioteca inicial', () => {
  const components = read('../components.json').components;
  const thumbs = read('thumbs/thumbs.json');
  const catalog = read('../../atlas-cinematico/info.json').catalog;
  assert.equal(catalog.defaultTab, 'library');
  assert.equal(catalog.previewReady, true);
  assert.deepEqual(Object.keys(thumbs).sort(), components.map(c => c.name).sort());
  for (const item of components) {
    const bytes = fs.readFileSync(new URL('thumbs/' + thumbs[item.name], import.meta.url));
    assert.equal(bytes.subarray(0, 3).toString('hex'), 'ffd8ff', item.name);
    assert.ok(catalog.tabs.some(tab => tab.families.includes(item.family)), item.name);
  }
});
