import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {validateScene} from '../core.js';
import {readJSON,atlasGeoURL} from './io.js';
import {landIndex} from './geometry.js';
import {timerFromWords} from './anchors.js';
import {discover} from './registry.mjs';
export async function validateFile(file,{lyrics}={}){
  await discover();const scene=JSON.parse(await readFile(file,'utf8'));
  let words=Array.isArray(scene?.words)?scene.words:[];
  const lyricsPath=lyrics||scene?.lyricsUrl;
  if(lyricsPath){const data=await readJSON(new URL(lyricsPath,pathToFileURL(resolve(file))));words=Array.isArray(data)?data:data.words||(data.segments||[]).flatMap(s=>s.words||[]);}
  const T=timerFromWords(words), land=landIndex(await readJSON(atlasGeoURL));
  let spriteNames=new Set();
  try{const manifest=scene?.spriteManifest,data=manifest&&typeof manifest==='object'?manifest:await readJSON(manifest?new URL(manifest,pathToFileURL(resolve(file))):new URL('../sprites/sprites.json',import.meta.url)),entries=data.sprites||data;spriteNames=new Set(Array.isArray(entries)?entries.map(x=>x.name||x.id):Object.keys(entries));}catch{}
  const result=validateScene(scene,{T,land,sprites:spriteNames});
  return {errors:result.errors,warnings:result.warnings};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2),file=args[0],json=args.includes('--json'),idx=args.indexOf('--lyrics');
  if(!file){console.error('Uso: node ../_tactico/tools/validate.mjs scene.json [--lyrics lyrics.json] [--json]');process.exitCode=2;}
  else try{
    const result=await validateFile(file,{lyrics:idx<0?null:args[idx+1]});
    if(json)console.log(JSON.stringify(result,null,2));
    else{
      for(const kind of ['errors','warnings'])for(const e of result[kind])console.log(`${kind==='errors'?'ERROR':'AVISO'} ${e.code} ${e.item||''} ${e.path}: ${e.message}${e.suggestion?' · '+e.suggestion:''}`);
      console.log(`${result.errors.length} errores, ${result.warnings.length} avisos`);
    }
    if(result.errors.length)process.exitCode=1;
  }catch(error){console.error(error.message);process.exitCode=1;}
}
