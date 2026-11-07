const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveComponents, parseComponentQuery, buildSelection, validateDeclared } = require('../proto.js');

const declared = [
  { name: 'atlas.outrov1', label: 'Uno', summary: '', group: 'outro', default: true, params: { titulo: { type: 'string', default: 'Inicial' } } },
  { name: 'atlas.outrov2', label: 'Dos', summary: '', group: 'outro', params: { titulo: { type: 'string', default: 'Final' } } },
  { name: 'atlas.fichas', label: 'Fichas', summary: '', default: true },
  { name: 'atlas.mapa', label: 'Mapa', summary: '' },
];
const select = search => buildSelection(declared, parseComponentQuery(search));
function capture(method, fn) {
  const original = console[method], messages = [];
  console[method] = (...args) => messages.push(args);
  try { return { result: fn(), messages }; } finally { console[method] = original; }
}

test('defaults, grupos excluyentes, cx y advertencias de seleccion', () => {
  assert.deepEqual(select('').active, ['atlas.outrov1', 'atlas.fichas']);
  assert.deepEqual(select('?c=atlas.outrov2&c=atlas.mapa').active, ['atlas.fichas', 'atlas.outrov2']);
  assert.deepEqual(select('?cx=1&c=atlas.mapa').active, ['atlas.outrov1', 'atlas.mapa']);
  const { result, messages } = capture('warn', () => select('?c=atlas.outrov2&c=atlas.outrov1&c=desconocido'));
  assert.deepEqual(result.active, ['atlas.fichas', 'atlas.outrov2']);
  assert.equal(messages.length, 2);
});

test('query JSON, invalida y limite por bytes', () => {
  assert.deepEqual(parseComponentQuery('?p=%7B%22atlas.outrov2%22%3A%7B%22titulo%22%3A%22Hola%22%7D%7D').params, { 'atlas.outrov2': { titulo: 'Hola' } });
  for (const p of ['{', '[]', JSON.stringify({ x: 'é'.repeat(4096) })]) {
    const { result, messages } = capture('warn', () => parseComponentQuery(new URLSearchParams({ p })));
    assert.deepEqual(result.params, {}); assert.equal(messages.length, 1);
  }
});

test('when filtra grupo, arreglo, interruptor, AND y anidamiento; desconocido se conserva', () => {
  const scene = { items: [
    { id: 1, when: { outro: 'outrov2', fichas: true } },
    { id: 2, when: { outro: ['outrov1', 'outrov2'] } },
    { id: 3, when: { mapa: true } },
    { id: 4, nested: { rows: [{ when: { fichas: true }, rows: [{ when: { outro: 'outrov1' }, id: 5 }] }] } },
    { id: 6, when: { inexistente: true, mapa: true } },
  ] };
  const { result, messages } = capture('error', () => resolveComponents(scene, declared, select('?c=atlas.outrov2')));
  assert.deepEqual(result.items, [{ id: 1 }, { id: 2 }, { id: 4, nested: { rows: [{ rows: [] }] } }, { id: 6 }]);
  assert.equal(messages.length, 1);
});

test('$by resuelve ramas y defaults recursivamente en objetos y arreglos', () => {
  const scene = { a: { $by: 'outro', outrov1: 1, outrov2: { x: [{ $by: 'fichas', on: 2, off: 3 }] } }, b: { $by: 'mapa', on: 1, default: 4 }, c: { $by: 'outro', other: 9 } };
  const { result, messages } = capture('error', () => resolveComponents(scene, declared, select('?c=atlas.outrov2')));
  assert.deepEqual(result, { a: { x: [2] }, b: 4, c: 9 }); assert.equal(messages.length, 1);
  assert.equal(resolveComponents({ $by: 'fichas', on: 1, off: 0 }, declared, select('?cx=1')), 0);
});

test('$param usa valores y defaults sin mutar la escena ni seleccion', () => {
  const selection = select('?c=atlas.outrov2&p=%7B%22atlas.outrov2%22%3A%7B%22titulo%22%3A%22Hola%22%7D%7D');
  const scene = { items: [{ when: { outro: 'outrov2' }, x: { $param: 'atlas.outrov2.titulo' }, y: { $param: 'atlas.outrov1.titulo' } }] };
  const before = structuredClone({ scene, selection, declared });
  assert.deepEqual(resolveComponents(scene, declared, selection), { items: [{ x: 'Hola', y: 'Inicial' }] });
  assert.deepEqual({ scene, selection, declared }, before);
});

test('sin declaraciones conserva la referencia y valida entradas y grupos', () => {
  const scene = { items: [{ when: { x: true } }] };
  assert.strictEqual(resolveComponents(scene, [], { active: [], params: {} }), scene);
  const { result, messages } = capture('warn', () => validateDeclared([...declared, declared[0], { name: 'mal' }, { name: 'x.a', label: '', summary: '', group: 'sin-default' }]));
  assert.deepEqual(result, declared); assert.equal(messages.length, 3);
});
