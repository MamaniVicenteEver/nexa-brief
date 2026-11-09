import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {photoAttributions} from '../attribution.js';
test('acredita cada foto usada una sola vez con autor, licencia y fuentes',async()=>{
 const base=new URL('../../atlas-cinematico/assets/',import.meta.url);
 const scene=JSON.parse(await readFile(new URL('scene.json',base)));const credits=JSON.parse(await readFile(new URL('media/credits.json',base)));
 const rows=photoAttributions({...scene,layers:[...scene.layers,{src:'media/austin.jpg'}]},credits);assert.equal(rows.length,3);
 for(const row of rows){assert.match(row,/CC BY/);assert.match(row,/https:\/\/commons\.wikimedia\.org/);assert.match(row,/https:\/\/creativecommons\.org/);}
 assert.deepEqual(photoAttributions(scene,{}),[]);
});
