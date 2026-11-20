import {readFile,writeFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {Tactico} from '../core.js';
import {discover} from './registry.mjs';
import {generateAnimations} from './animations-spec.mjs';
export async function catalog(){
  const sources=await discover(), project=new URL('../../../',import.meta.url), usage=new Map();
  async function scan(url){
    let entries;try{entries=await readdir(url,{withFileTypes:true});}catch{return;}
    for(const entry of entries){
      const next=new URL(entry.name+(entry.isDirectory()?'/':''),url);
      if(entry.isDirectory())await scan(next);
      else if(entry.name.endsWith('.json')){
        let data;try{data=JSON.parse(await readFile(next,'utf8'));}catch{continue;}
        for(const item of data.items||[]){const all=usage.get(item.type)||new Set();all.add(fileURLToPath(next).slice(fileURLToPath(project).length));usage.set(item.type,all);}
      }
    }
  }
  for(const dir of ['assets/','variantes/','work/tactico/'])await scan(new URL(dir,project));
  const components=Tactico.list().filter(d=>!d.retired).sort((a,b)=>a.name.localeCompare(b.name)).map(d=>({name:d.name,summary:d.summary||'',layer:d.layer,params:d.params,states:d.states,demo:d.demo||null,file:d.file||sources.get(d.name),used_by:[...(usage.get(d.name)||[])].sort()}));
  const result={version:1,components};
  await writeFile(new URL('../components.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
  await generateAnimations(result);
  return result;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const result=await catalog();console.log(`Catálogo: ${result.components.length} componentes → engine/tactico/components.json`);
}
