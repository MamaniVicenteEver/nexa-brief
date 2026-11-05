import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,readFile,rm,mkdir,copyFile,symlink,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import Ajv from 'ajv/dist/2020.js';
import {MOVES} from '../engine/camera/config.js';

const execFileAsync=promisify(execFile);
test('regenerar el esquema conserva el contrato completo de cámara y acciones',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'vida-schema-'));
 try {
  const output=join(dir,'episode.schema.json');
  await execFileAsync(process.execPath,[new URL('../tools/build-schema.mjs',import.meta.url).pathname,output]);
  const generated=JSON.parse(await readFile(output,'utf8'));
  const checkedIn=JSON.parse(await readFile(new URL('../schema/episode.schema.json',import.meta.url),'utf8'));
  assert.deepEqual(generated,checkedIn,'El generador y el esquema versionado deben evolucionar juntos');
  // Comprueba el destino por defecto en un árbol aislado, sin sobrescribir el original.
  const isolated=join(dir,'isolated');
  await mkdir(join(isolated,'tools'),{recursive:true});
  await mkdir(join(isolated,'schema'),{recursive:true});
  await symlink(fileURLToPath(new URL('../engine',import.meta.url)),join(isolated,'engine'),'dir');
  const isolatedGenerator=join(isolated,'tools','build-schema.mjs');
  await copyFile(fileURLToPath(new URL('../tools/build-schema.mjs',import.meta.url)),isolatedGenerator);
  const defaultOutput=join(isolated,'schema','episode.schema.json');
  await writeFile(defaultOutput,'{}');
  await execFileAsync(process.execPath,[isolatedGenerator],{cwd:dir});
  assert.deepEqual(JSON.parse(await readFile(defaultOutput,'utf8')),checkedIn,'Sin argumento debe escribir schema/episode.schema.json');
  const validate=new Ajv({strict:false,allErrors:true}).compile(generated);
  const episode={version:1,id:'schema-regeneration',view:'landscape',framing:'fit',camera:{style:'cine',defaultEase:[.2,.1,.8,.9]},scenes:[{set:'escuela-entrada',actors:{tomas:{at:'arrive'}},steps:[{do:{who:'tomas',action:'wave',dur:1}}],camera:[{type:'close',target:'tomas',move:'push',ease:[.2,.1,.8,.9],from:{zoom:1},to:{zoom:1.2},fit:true,preset:'tercios',leadRoom:.08,transition:'move'}]}]};
  for(const move of MOVES){episode.scenes[0].camera[0].move=move;assert.ok(validate(episode),`${move}: ${JSON.stringify(validate.errors)}`);}
  episode.scenes[0].camera[0].leadRoom=.9;
  assert.equal(validate(episode),false,'El esquema debe rechazar parámetros fuera de rango');
 } finally { await rm(dir,{recursive:true,force:true}); }
});
