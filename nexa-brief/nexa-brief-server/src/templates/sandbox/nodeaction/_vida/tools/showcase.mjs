import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createCanvas,GlobalFonts} from '@napi-rs/canvas';
import {drawCharacter,posePreset} from '../engine/index.js';
import {loadEpisode,ROOT} from './runtime.mjs';
import {renderFrame} from '../engine/render.js';
import {join} from 'node:path';

// Adapta el catálogo real al contrato de Showcase; no duplica el motor ni los episodios.
const catalog=JSON.parse(await readFile(join(ROOT,'catalog.json'),'utf8'));
const output=join(ROOT,'showcase');await mkdir(join(output,'characters'),{recursive:true});
const labels={characters:'Personaje',expressions:'Expresión facial',visemes:'Forma de boca para voz',hands:'Gesto de mano',hair:'Peinado',outfits:'Vestuario',actions:'Acción del personaje',props:'Objeto',sets:'Escenario',shots:'Plano de cámara',fx:'Efecto expresivo',ui:'Texto en pantalla',castModes:'Modo de voz',sceneTransitions:'Transición de escena'};
const components=[];
for(const [section,label] of Object.entries(labels)){
 for(const entry of catalog[section]??[]){
  const params=Object.fromEntries(Object.entries(entry.params??{}).map(([key,value])=>[key,{
   ...(typeof value==='string'?{type:value}:value),
   ...(entry.required?.includes(key)?{required:true}:{}),
   ...(value.summary?{doc:value.summary}:{}),...(value.enum?{values:value.enum}:{})
  }]));
  components.push({name:`${section}.${entry.name}`,summary:entry.summary??`${label}: ${entry.title??entry.name}.`,
   states:entry.name?[entry.name]:[],params,used_by:entry.used_by??[],
   demo:{type:entry.name,...Object.fromEntries(Object.entries(params).filter(([,v])=>v.default!==undefined).map(([k,v])=>[k,v.default]))},
   preview:{section,id:entry.name,url:entry.demo}});
 }
}
components.push({name:'initialState.start',summary:catalog.initialState.summary,params:Object.fromEntries(Object.entries(catalog.initialState.params).map(([k,v])=>[k,{...v,doc:v.summary}])),used_by:catalog.initialState.used_by,demo:{start:{seated:'seat'}},preview:{section:'initialState',id:'start',url:catalog.initialState.demo}});
await writeFile(join(output,'components.json'),JSON.stringify({components},null,2)+'\n');
const voiceSamples=JSON.parse(await readFile(join(output,'voice-samples.json'),'utf8').catch(error=>{if(error.code==='ENOENT')return '{}';throw error;}));
const sprites=[];
for(const entry of catalog.characters){
 const character=JSON.parse(await readFile(join(ROOT,entry.file),'utf8'));
 const canvas=createCanvas(540,720),ctx=canvas.getContext('2d');
 drawCharacter(ctx,character,posePreset('idle',{x:270,y:650,scale:580/character.height}),{expression:character.face.expression},0);
 const file=`${entry.name}.png`;await writeFile(join(output,'characters',file),await canvas.encode('png'));
 sprites.push({name:character.name,file,variant:'Personaje articulado',family:'vida',states:['front','3q-left','3q-right','side-left','side-right'],characterFile:entry.file,...(voiceSamples[entry.name]?{voiceSample:voiceSamples[entry.name]}:{})});
}
await writeFile(join(output,'sprites.json'),JSON.stringify({sprites},null,2)+'\n');
GlobalFonts.registerFromPath(join(ROOT,'assets/fonts/Anton-Regular.ttf'),'VidaAnton');
for(const [id,time] of [['vida-en-escena',9],['vida-en-escena-heladeria',4]]){
 const episode=await loadEpisode(join(ROOT,'..',id,'assets/episode.json'));
 const canvas=createCanvas(1080,1920);renderFrame(canvas.getContext('2d'),episode,time,{view:'portrait',framing:'fit'});
 await mkdir(join(ROOT,'..',id,'render'),{recursive:true});
 await writeFile(join(ROOT,'..',id,'render/poster.jpg'),await canvas.encode('jpeg',94));
}
console.log(JSON.stringify({components:components.length,characters:sprites.length,posters:2}));
