import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ATLAS,TEMPLATES,episodePath} from '../validate.mjs';
import {PROTO,templateURL} from '../plano/paths.js';

test('Proto compartido se resuelve desde templates sin depender de la categoría',()=>{
  assert.equal(fileURLToPath(PROTO),path.join(TEMPLATES,'sandbox/_proto/proto.js'));
  assert.ok(fs.existsSync(fileURLToPath(PROTO)));
  assert.equal(fileURLToPath(templateURL('sandbox/nodehistory/_tactico/core.js')),
               path.join(TEMPLATES,'sandbox/nodehistory/_tactico/core.js'));
});
test('episodios requieren ruta explícita y nunca buscan IDs en el repositorio',()=>{
  assert.throws(()=>episodePath('demo-id'),/ruta explícita/);
  assert.equal(episodePath(ATLAS),ATLAS);
  assert.throws(()=>episodePath(path.join(ATLAS,'__ruta_ausente__')),/No existe la ruta/);
});
