import {readdir} from 'node:fs/promises';
import {Tactico} from '../core.js';
export async function discover() {
  const files=(await readdir(new URL('../components/',import.meta.url))).filter(f=>f.endsWith('.js')).sort(), sources=new Map();
  for(const file of files){
    const before=new Set(Tactico.list().map(d=>d.name));
    await import(new URL(`../components/${file}`,import.meta.url));
    for(const def of Tactico.list())if(!before.has(def.name))sources.set(def.name,`components/${file}`);
  }
  return sources;
}
