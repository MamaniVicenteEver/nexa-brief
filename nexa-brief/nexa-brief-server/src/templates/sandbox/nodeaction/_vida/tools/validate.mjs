import Ajv from 'ajv';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));
const schema = JSON.parse(await readFile(new URL('../schema/character.schema.json', import.meta.url), 'utf8'));
export const validateCharacter = new Ajv({ allErrors: true, strict: true }).compile(schema);
export async function readCharacter(id) {
  if (!/^[a-z][a-z0-9-]*$/.test(id)) throw new Error(`Invalid character id: ${id}`);
  const character = JSON.parse(await readFile(new URL(`../characters/${id}.json`, import.meta.url), 'utf8'));
  if (!validateCharacter(character)) throw new Error(`${id}: ${JSON.stringify(validateCharacter.errors)}`);
  if (character.id !== id) throw new Error(`${id}: id must match its filename`);
  return character;
}
export async function readCharacters() {
  const files = (await readdir(new URL('../characters/', import.meta.url))).filter(f => f.endsWith('.json')).sort();
  return Promise.all(files.map(f => readCharacter(f.slice(0, -5))));
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  if(process.argv[2]) { try {
    const [path,...flags]=process.argv.slice(2),options={view:'both',framing:'fit'};
    for(let i=0;i<flags.length;i+=2){if(!['--view','--framing'].includes(flags[i]))throw new Error('Opción inválida: '+flags[i]);options[flags[i].slice(2)]=flags[i+1];}
    if(!['both','landscape','portrait'].includes(options.view)||!['fit','tight'].includes(options.framing))throw new Error('Vista o encuadre inválido');
    const {validateEpisodeFile}=await import('./validate-episode.mjs');await validateEpisodeFile(path);
    const {loadEpisode}=await import('./runtime.mjs'),{cameraAt,sampleScene}=await import('../engine/render.js'),{framingAt,plateIntegrity}=await import('../engine/core/framing.js'),{compositionAt}=await import('../engine/core/composition.js');
    const c=await loadEpisode(path),backgrounds=Object.fromEntries(Object.entries(c.resources.plates).map(([id,p])=>[id,plateIntegrity(p)])),results=[];
    for(const view of options.view==='both'?['landscape','portrait']:[options.view]){
      const failures=[],subjects=[];let samples=0;
      for(let f=0;f<Math.ceil(c.duration*30);f++){
        const t=f/30,s=sampleScene(c,t),cam=cameraAt(c,t,s,{...options,view});
        if(cam.fit)for(const b of framingAt(s,cam,c.episode.ui?.subtitles!==false&&c.lines.some(l=>l.scene===s.scene.id))){samples++;if(!b.ok)failures.push({t,scene:s.scene.id,shot:cam.type,...b});}
        if(!cam.transitioning)for(const subject of compositionAt(s,cam).subjects)if(!subject.ok)subjects.push({t,shot:cam.type,...subject});
      }
      const failed=[];if(failures.length)failed.push('actores_completos');if(Object.values(backgrounds).some(b=>!b.ok))failed.push('sin_zona_vacia');if(subjects.length)failed.push('sujeto_suficiente');
      results.push({view,passed:!failed.length,failed,actores_completos:{samples,failed_samples:failures.length,violations:failures.slice(0,20)},sin_zona_vacia:backgrounds,sujeto_suficiente:{failed_samples:subjects.length,violations:subjects.slice(0,20)}});
    }
    console.log(JSON.stringify({episode:c.episode.id,duration:c.duration,views:results,passed:results.every(r=>r.passed)},null,2));if(results.some(r=>!r.passed))process.exitCode=1;
  } catch(e) {console.error(e.message);process.exitCode=1;} } else {
  const characters = await readCharacters();
  console.log(`Validación JSON Schema: ${characters.length}/${characters.length} fichas válidas (${characters.map(c => c.id).join(', ')}).`);
  }
}
