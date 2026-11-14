import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { merge, resolveStyle, resolveLayer } from '../estilo.mjs';
for (const id of ['documentary','dynamic']) {
  test(`${id}: formato y excepciones sin mutar el preset`, async () => {
    const raw = JSON.parse(await fs.readFile(new URL(`../estilos/${id}.json`,import.meta.url)));
    const portrait = resolveStyle(raw,{},'movil');
    const landscape = resolveStyle(raw,{},'escritorio');
    assert.notEqual(portrait.layers.year.y,landscape.layers.year.y);
    assert.equal(resolveLayer({type:'label'},portrait,'movil').size,raw.layers.label.size);
    assert.equal(resolveLayer({type:'label',size:40,portrait:{size:50}},portrait,'movil').size,50);
    assert.equal(raw.layers.label.maxWidth,undefined);
  });
}
test('las listas se reemplazan y las claves peligrosas se rechazan', () => {
  assert.deepEqual(merge({a:[1,2]}, {a:[3]}), {a:[3]});
  assert.throws(() => merge({}, JSON.parse('{"__proto__":{}}')));
});
