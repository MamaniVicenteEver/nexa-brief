import {readFile,readdir,access} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createCanvas,loadImage,GlobalFonts} from '@napi-rs/canvas';
import {compile} from '../engine/core/compile.js';
import {preparePlate} from '../engine/sets/index.js';
export const ROOT=fileURLToPath(new URL('../',import.meta.url));
export const json=async p=>JSON.parse(await readFile(p,'utf8'));
export async function library(){
 const catalog=await json(join(ROOT,'catalog.json'));
 const characters={};for(const f of (await readdir(join(ROOT,'characters'))).filter(f=>f.endsWith('.json'))){const c=await json(join(ROOT,'characters',f));characters[c.id]=c;}
 const sets={};for(const f of await readdir(join(ROOT,'sets'))){try{const s=await json(join(ROOT,'sets',f,'set.json'));sets[s.id]=s;}catch(e){if(e.code!=='ENOTDIR'&&e.code!=='ENOENT')throw e;}}
 const voices=Object.fromEntries((await readdir(join(ROOT,'voices'))).filter(f=>f.endsWith('.json')).map(f=>[f.slice(0,-5),true]));
 return {...catalog,characters,sets,voices,emotions:await json(join(ROOT,'data/emotions.json'))};
}
export async function loadEpisode(path,{images=true}={}){
 path=resolve(path);const episode=await json(path),base=dirname(path),timingPath=resolve(base,episode.resources?.timing??'timing.json'),timing=await json(timingPath),catalog=await library();
 const compiled=compile(episode,timing,catalog);compiled.paths={episode:path,timing:timingPath,audioBase:resolve(base,episode.resources?.audioBase??'.')};
 for(const line of compiled.lines){const clip=resolve(compiled.paths.audioBase,line.clip);try{await access(clip);}catch{throw new Error(`${line.path}.say: recurso de audio ausente: ${clip}`);}}
 for(const scene of compiled.scenes)await access(join(ROOT,'sets',scene.set.id,scene.set.plate.file));
 if(images){GlobalFonts.registerFromPath(join(ROOT,'assets/fonts/Anton-Regular.ttf'),'VidaAnton');compiled.resources={plates:{},createCanvas};
  for(const scene of compiled.scenes){if(compiled.resources.plates[scene.set.id])continue;const image=await loadImage(join(ROOT,'sets',scene.set.id,scene.set.plate.file));compiled.resources.plates[scene.set.id]=preparePlate(image,createCanvas);}
 }
 return compiled;
}
