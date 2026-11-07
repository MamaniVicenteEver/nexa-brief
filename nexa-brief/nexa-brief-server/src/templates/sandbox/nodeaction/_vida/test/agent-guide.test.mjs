import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const cli = resolve(root, 'tools/agent-guide.mjs');
const run = (...args) => spawnSync(process.execPath, [cli, ...args], {encoding:'utf8', cwd:root});

test('la guía lista rutas válidas sin cargar documentación completa', async () => {
  const check = run('check');
  assert.equal(check.status, 0, check.stderr);
  const result = JSON.parse(check.stdout);
  assert.equal(result.valid, true);
  assert.ok(result.tasks >= 4);
  const listed = run('list');
  assert.equal(listed.status, 0, listed.stderr);
  const listing = JSON.parse(listed.stdout);
  assert.equal(listing.tasks.length, result.tasks);
  assert.ok(!listed.stdout.includes('"guides"'));
});

test('cada consulta devuelve solo las guías asociadas a la tarea elegida', async () => {
  const index = JSON.parse(await readFile(resolve(root,'agent-guide/index.json'),'utf8'));
  for (const task of index.tasks) {
    const selected = run('show', task.id);
    assert.equal(selected.status, 0, `${task.id}: ${selected.stderr}`);
    const result = JSON.parse(selected.stdout);
    assert.equal(result.task.id, task.id);
    assert.deepEqual(result.guides.map(item => item.file), task.read);
    assert.ok(result.guides.every(item => item.bytes > 0 && item.content));
  }
});

test('una tarea inexistente no devuelve una guía equivocada', () => {
  const missing = run('show','tarea-inexistente');
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /Tarea desconocida/);
  assert.equal(missing.stdout, '');
});

test('Showcase ofrece las mismas tareas del índice y enlaza documentos existentes', async () => {
  const index = JSON.parse(await readFile(resolve(root,'agent-guide/index.json'),'utf8'));
  const workflows = JSON.parse(await readFile(resolve(root,'agent-guide/workflows.json'),'utf8'));
  assert.deepEqual(workflows.cards.map(card => card.id).sort(), index.tasks.map(task => task.id).sort());
  for (const card of workflows.cards) {
    assert.ok(card.steps.some(step => step.includes(`show ${card.id}`)), `${card.id}: comando ausente`);
    assert.ok(card.documents.length > 0, `${card.id}: sin documentos`);
    for (const doc of card.documents) {
      assert.ok(!doc.path.startsWith('/') && !doc.path.split('/').includes('..'), doc.path);
      await access(resolve(root, doc.path));
    }
  }
});
