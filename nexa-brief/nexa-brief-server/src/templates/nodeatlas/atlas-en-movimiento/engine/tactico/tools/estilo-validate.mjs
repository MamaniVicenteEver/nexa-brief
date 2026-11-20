import {readFile} from 'node:fs/promises';
import {makeEstilo} from '../util.js';
const read=async p=>JSON.parse(await readFile(new URL(p,import.meta.url),'utf8'));
const index=await read('../estilos/index.json'), catalog=await read('../components.json');let errors=0;
for(const item of index.estilos){
 const s=await read(`../estilos/${item.id}.json`);
 for(const path of ['id','nombre','idea','colores','fuentes','sombras','formatos','estilos','fijos','trazos','escalas','componentes'])if(s[path]==null){console.error(`${item.id}: falta ${path}`);errors++;}
 for(const f of ['movil','escritorio'])if(!s.formatos?.[f]?.ranuras){console.error(`${item.id}: falta formato ${f}`);errors++;}
 for(const k of ['rotuloUnidad','tierra','fecha','transcripcion','leyenda','ficha','documento','pais','frente','callout'])if(!s.estilos?.[k]){console.error(`${item.id}: falta estilos.${k}`);errors++;}
 for(const k of ['flecha','ruta','frente','guia'])for(const field of ['grosor','color','dash','punta','largoPunta','anchoPunta','camisa'])if(s.trazos?.[k]?.[field]===undefined){console.error(`${item.id}: falta trazos.${k}.${field}`);errors++;}
 for(const c of catalog.components)if(!Array.isArray(s.componentes?.[c.name]?.usa)||!s.componentes?.[c.name]?.overrides){console.error(`${item.id}: falta componentes.${c.name}`);errors++;}
}
const classic=await read('../estilos/clasico.json'),style=makeEstilo(classic), files=new Map();
for(const c of catalog.components.filter(c=>!style.fijo(c.name))){if(!c.file)continue;if(!files.has(c.file))files.set(c.file,[]);files.get(c.file).push(c.name);}
let lines=0;for(const [file,names] of files){const src=await readFile(new URL(`../${file}`,import.meta.url),'utf8');const matches=src.split('\n').map((s,i)=>({s,i})).filter(x=>/#[0-9a-f]{3,8}\b|\bfont(?:Family)?\b|\b(?:size|fontSize|labelSize|strokeWidth|lineWidth)\s*[:=]\s*[0-9]/i.test(x.s));if(matches.length){lines+=matches.length;console.log(`${file}: ${matches.length} líneas (compartido: ${names.join(', ')})`);}}
console.log(`Literales candidatos de color, fuente o tamaño/grosor: ${lines} líneas en archivos con componentes estilizables; revisión manual necesaria en archivos compartidos. Errores de esquema: ${errors}.`);
if(errors)process.exitCode=1;
