import {readFile, writeFile} from 'node:fs/promises';
import {makeEstilo,stylePath} from '../util.js';
const args=process.argv.slice(2), i=args.indexOf('--estilo');
const index=JSON.parse(await readFile(new URL('../estilos/index.json',import.meta.url)));
const id=i<0?index.default:args[i+1];
if(!id || !/^[a-z0-9][a-z0-9-]*$/.test(id)) throw Error('Uso: estilo-map.mjs [--estilo ID]');
const catalog=JSON.parse(await readFile(new URL('../components.json',import.meta.url)));
const styles=index;
if(!styles.estilos.some(s=>s.id===id)) throw Error(`Estilo desconocido: ${id}`);
const data=JSON.parse(await readFile(new URL(`../estilos/${id}.json`,import.meta.url)));
const result={version:1,estilo:id,componentes:{}};
for(const c of catalog.components){
 const entry=data.componentes[c.name]||{usa:[],overrides:{}}, formatos={};
 for(const format of ['movil','escritorio']){
  const style=makeEstilo(data,format,entry.overrides);formatos[format]=Object.fromEntries(entry.usa.map(p=>[p,stylePath(style,p)??null]));
 }
 const style=makeEstilo(data);result.componentes[c.name]={familia:c.name.split('.')[0],fijo:style.fijo(c.name),estilizable:!style.fijo(c.name),usa:entry.usa,overrides:entry.overrides,predeterminadosActuales:entry.predeterminadosActuales || {},formatos};
}
await writeFile(new URL('../estilos/PLANTILLA.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(`PLANTILLA.json: ${Object.keys(result.componentes).length} componentes, estilo ${id}`);
