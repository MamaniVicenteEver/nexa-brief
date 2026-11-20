import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateCatalog } from '../scripts/catalog.mjs';
const channels = JSON.parse(
  readFileSync(new URL('../src/features/channels/data/channels.json', import.meta.url), 'utf8'),
);
const networks = JSON.parse(
  readFileSync(new URL('../src/features/network/data/networks.json', import.meta.url), 'utf8'),
);
const mutate = (fn) => {
  const copy = structuredClone(channels);
  fn(copy);
  return validateCatalog(copy, networks);
};
test('the seven supplied YouTube handles are retained exactly', () => {
  assert.deepEqual(
    channels.map((c) => c.socials.youtube.handle),
    [
      '@nodemotiondc',
      '@nodetechdc',
      '@nodehistory',
      '@nodepolitics_es',
      '@nodeconomy_es',
      '@nodeatlas_es',
      '@nodemind_es',
    ],
  );
  assert.deepEqual(validateCatalog(channels, networks), []);
});
test('rejects a duplicated channel identity', () => {
  assert.ok(mutate((c) => c.push(structuredClone(c[0]))).some((e) => e.includes('duplicate ID')));
});
test('rejects executable URLs', () => {
  assert.ok(
    mutate((c) => (c[0].socials.youtube.url = 'javascript:alert(1)')).some((e) =>
      e.includes('unsafe'),
    ),
  );
});
test('rejects an unrelated platform domain', () => {
  assert.ok(
    mutate(
      (c) => (c[0].socials.youtube.url = 'https://youtube.com.attacker.example/@nodemotiondc'),
    ).some((e) => e.includes('unsafe')),
  );
});
test('rejects a handle pointing to the wrong channel', () => {
  assert.ok(
    mutate((c) => (c[0].socials.youtube.url = 'https://www.youtube.com/@another-channel')).some(
      (e) => e.includes('does not match'),
    ),
  );
});
test('rejects an unknown network', () => {
  assert.ok(mutate((c) => (c[0].networkId = 'missing')).some((e) => e.includes('unknown network')));
});
test('rejects missing files before a broken resource can be published', () => {
  assert.ok(
    validateCatalog(channels, networks, { assetExists: () => false }).some((e) =>
      e.includes('asset'),
    ),
  );
});
test('allows unconfirmed networks to remain without invented links', () => {
  assert.deepEqual(validateCatalog(channels, networks), []);
  assert.ok(channels.every((c) => c.socials.facebook.url === null));
});
test('a second industry can be added as a separate network without changing validation', () => {
  const next = structuredClone(channels[0]);
  next.id = 'other-brand';
  next.name = 'OTHER';
  next.networkId = 'other';
  next.socials.youtube = { handle: '@other-brand', url: 'https://www.youtube.com/@other-brand' };
  next.socials.instagram = { handle: null, url: null };
  assert.deepEqual(
    validateCatalog([...channels, next], [...networks, { id: 'other', active: true }]),
    [],
  );
});
