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
test('incluye medios del HUD y bandera, deduplicando por basename sin emitir rutas privadas',()=>{
 const credit={title:'Retrato documental',author:'Archivo público',license:'CC BY 4.0',source_url:'https://archive.example/photo',license_url:'https://creativecommons.org/licenses/by/4.0/'};
 const flag={...credit,title:'Bandera real',license:'Public domain'};
 const scene={layers:[{type:'flag-fill',src:'media/us.svg'},{type:'pole-photo',src:'media/portrait.jpg'}],hud:[{type:'portrait',src:'media/portrait.jpg'},{type:'photo-frame',src:'media/sub/portrait.jpg'},{type:'portrait'}]};
 const rows=photoAttributions(scene,{'portrait.jpg':credit,'us.svg':flag});
 assert.equal(rows.length,2);assert.ok(rows.some(row=>row.startsWith('Retrato documental —')));assert.ok(rows.some(row=>row.startsWith('Bandera real —')));
 assert.ok(rows.every(row=>!row.includes('media/')));
 assert.deepEqual(photoAttributions({hud:[{type:'portrait',src:'media/portrait.jpg'}]},{'portrait.jpg':credit}),[rows.find(row=>row.startsWith('Retrato documental —'))]);
});
