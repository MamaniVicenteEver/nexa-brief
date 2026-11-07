import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {paintBackground,screenAttribution,drawAttribution} from '../attribution.js';
import {creditsText} from '../credits.mjs';
import {composeStyle} from '../style.js';
const read=async p=>JSON.parse(await readFile(new URL(p,import.meta.url)));
test('limpia el lienzo antes de dibujar, con estrellas deterministas',()=>{
 const calls=[];const g={save(){},restore(){},fillRect(...a){calls.push(a)}};
 paintBackground(g,1920,1080,{background:'#000000',projection:'globe'});assert.deepEqual(calls[0],[0,0,1920,1080]);assert.equal(calls.length,251);
 const snapshot=JSON.stringify(calls);calls.length=0;paintBackground(g,1920,1080,{background:'#000000',projection:'globe'});assert.equal(JSON.stringify(calls),snapshot);
});
test('atribución en una línea sin URLs',async()=>{
 const look=await read('../looks/satelite-etiquetado.json');const text=screenAttribution(look,9);assert.equal(text,'Imagery: NASA GIBS · USGS · Elevation: AWS Terrain Tiles · © OpenStreetMap · Protomaps');assert.doesNotMatch(text,/https?:|\n/);
 const calls=[];drawAttribution({save(){},restore(){},fillText(...args){calls.push(args)}},1920,1080,1,text);assert.equal(calls.length,1);
});
test('créditos completos y proveedor derivado',async()=>{
 const scene=await read('../../atlas-cinematico/assets/scene.json'),photos=await read('../../atlas-cinematico/assets/media/credits.json'),look=await read('../looks/satelite-realista.json'),providers=await read('../providers.json');
 const text=creditsText(scene,[look],providers,photos);assert.match(text,/Quintin Soloviev.*CC BY 4\.0.*https:\/\/commons/);assert.match(text,/AWS Terrain Tiles/);
 assert.match(composeStyle(look,{providers}).sources.dem.tiles[0],/terrain-land/);assert.match(composeStyle({...look,dem:'raw'},{providers}).sources.dem.tiles[0],/terrain-aws/);
});
test('comando credits escribe credits.txt con las fotos usadas',async()=>{
 const {mkdtemp,writeFile,mkdir,readFile,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const path=await import('node:path');const {execFileSync}=await import('node:child_process');
 const root=await mkdtemp(path.join(tmpdir(),'atlas-credits-test-'));const dir=path.join(root,'assets');await mkdir(dir);
 try {
  await mkdir(path.join(dir,'media'));await writeFile(path.join(dir,'scene.json'),JSON.stringify({look:'satelite-realista',layers:[{src:'media/a.jpg'}]}));
  await writeFile(path.join(dir,'media','credits.json'),JSON.stringify({'a.jpg':{title:'Foto',author:'Autora',license:'CC BY 4.0',source_url:'https://example.org/foto',license_url:'https://example.org/licencia'}}));
  const stdout=execFileSync(process.execPath,[new URL('../credits.mjs',import.meta.url).pathname,path.join(dir,'scene.json')],{encoding:'utf8'});
  const result=await readFile(path.join(dir,'credits.txt'),'utf8');assert.equal(result,stdout);assert.match(result,/Foto — Autora, CC BY 4.0 \(https:\/\/example.org\/foto; https:\/\/example.org\/licencia\)/);
 } finally {await rm(root,{recursive:true,force:true});}
});
