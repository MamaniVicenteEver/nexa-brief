// Reconstruye tarjetas y miniaturas de los personajes registrados, sin tocar el motor ni el perfil.
import { readFile, writeFile, access, realpath, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..'), sandbox=path.resolve(root,'../..');
const profilePath=path.resolve(root,'../_pizarra/profiles/leo.json');
const profileUrl=pathToFileURL(profilePath);
const catalogPath=path.join(here,'components.json'), infoPath=path.join(root,'info.json');
const thumbsPath=path.join(here,'thumbs/thumbs.json');
const require=createRequire(import.meta.url);
const {createCanvas,loadImage}=require('../../_vida/node_modules/@napi-rs/canvas');
const readJson=async p=>JSON.parse(await readFile(p,'utf8'));
const atomic=async(p,v)=>{const tmp=p+'.tmp';await writeFile(tmp,JSON.stringify(v,null,2)+'\n');await rename(tmp,p);};
const profile=await readJson(profilePath), catalog=await readJson(catalogPath), info=await readJson(infoPath), thumbs=await readJson(thumbsPath);
const tab=info.catalog?.tabs?.find(x=>x.id==='new-componentes');
if(!tab||!Array.isArray(tab.components)||!Array.isArray(catalog.components))throw Error('Catálogo o pestaña inválidos');
const safe=/^[a-z0-9][a-z0-9_-]*$/;
const found=[]; const cards=[]; const identities=[]; const sprites=[];
async function existingIdentity(id){
 for(const p of [path.join(root,'assets/avatar/characters',id,'identity.json'),path.join(root,'assets/avatar/identities',id+'.json')]){
  try{await access(p);const data=await readJson(p);if(data.id!==id)throw Error('ID de identidad diferente: '+p);return {data, file:path.relative(root,p).split(path.sep).join('/')};}catch(e){if(e.code!=='ENOENT')throw e;}
 }
 return null;
}
async function localSource(src){
 if(typeof src!=='string'||!src)throw Error('Falta ruta de lámina');
 const u=new URL(src,profileUrl);if(u.protocol!=='file:')throw Error('La lámina debe ser un archivo local');
 const file=await realpath(fileURLToPath(u)), allowed=await realpath(sandbox);
 if(!file.startsWith(allowed+path.sep))throw Error('Lámina fuera de sandbox: '+file);
 return file;
}
for(const [id,character] of Object.entries(profile.avatar?.characters||{})){
 if(!safe.test(id))throw Error('ID inválido: '+id);
 const identityEntry=await existingIdentity(id);
 const identity=identityEntry?.data;
 const poses=[];
 if(identity){
  const sample=identity.voz?.muestra;
  let audio;
  if(sample){
   if(typeof sample!=='string'||sample.startsWith('/')||sample.split('/').some(x=>!x||x==='.'||x==='..'))throw Error('Ruta de muestra inválida: '+id);
   const f=await realpath(path.resolve(root,sample)), allowed=await realpath(root);
   if(!f.startsWith(allowed+path.sep))throw Error('Muestra fuera del proyecto: '+id);
   audio=sample;
  }
  let captions;
  const subtitle=identity.voz?.subtitulos;
  if(subtitle){
   if(typeof subtitle!=='string'||subtitle.startsWith('/')||subtitle.split('/').some(x=>!x||x==='.'||x==='..'))throw Error('Ruta de subtítulos inválida: '+id);
   const f=await realpath(path.resolve(root,subtitle)), allowed=await realpath(root);
   if(!f.startsWith(allowed+path.sep))throw Error('Subtítulos fuera del proyecto: '+id);
   captions=subtitle;
  }
  identities.push({name:'personajes.identidad-'+id,family:'Personajes',kind:'json',summary:'Identidad editorial y voz de '+(identity.nombre||id)+'.',params:{},demo:identity,...(audio?{audio}:{}),...(captions?{captions}:{})});
 }
 for(const [pose,value] of Object.entries(character.poses||{})){
  if(!safe.test(pose))throw Error('Nombre de pose inválido: '+pose);
  const src=Array.isArray(value)?character.src:value?.src;
  const crop=Array.isArray(value)?value:value?.crop;
  if(!Array.isArray(crop)||crop.length!==4||!crop.every(Number.isFinite)||crop[0]<0||crop[1]<0||crop[2]<=0||crop[3]<=0||crop[0]+crop[2]>1.000001||crop[1]+crop[3]>1.000001)throw Error('Recorte inválido: '+id+'.'+pose);
  const file=await localSource(src), name=id+'.'+pose;
  const existing=catalog.components.find(x=>x.name===name);
  const poster=thumbs[name] || name+'.jpg';
  if(!/^[a-z0-9._-]+\.jpg$/.test(poster))throw Error('Nombre de miniatura inválido');
  let generate=process.argv.includes('--refresh')||!thumbs[name];
  if(!generate)try{await access(path.join(here,'thumbs',poster));}catch{generate=true;}
  if(generate){
   const image=await loadImage(file), [x,y,w,h]=crop;
   const sw=w*image.width,sh=h*image.height;
   const canvas=createCanvas(640,360),ctx=canvas.getContext('2d');
   ctx.fillStyle='#fff';ctx.fillRect(0,0,640,360);
   const k=Math.min(0.85*640/sw,0.9*360/sh),dw=sw*k,dh=sh*k;
   ctx.drawImage(image,x*image.width,y*image.height,sw,sh,(640-dw)/2,(360-dh)/2,dw,dh);
   await writeFile(path.join(here,'thumbs',poster),canvas.toBuffer('image/jpeg'));
  }
  thumbs[name]=poster; found.push(name); poses.push({name:pose,file:poster});
  cards.push({...(existing||{}),name,family:'Personajes',summary:existing?.summary||`${identity?.nombre||id}: pose ${pose}.`,
   params:existing?.params||{character:{type:'string',default:id,doc:'Identificador del personaje.'},pose:{type:'string',default:pose,doc:'Pose en shots o avatar.timeline.'},at:{type:'number|string',default:0,doc:'Segundo o ancla de voz.'}},
   preview:{...(existing?.preview||{}),bg:'white',static:true,time:0,crop:[170,1160,740,720],pose,character:id}});
 }
 if(identity && poses.length){
  const voice=identity.voz||{};
  sprites.push({name:identity.nombre||id,file:(poses.find(x=>x.name==='talk')||poses[0]).file,characterFile:identityEntry.file,poses,
   ...(voice.muestra?{voiceSample:{file:'sandbox/nodeaction/cara-a-cara/'+voice.muestra,...(voice.texto?{text:voice.texto}:{}),...(voice.subtitulos?{captions:'sandbox/nodeaction/cara-a-cara/'+voice.subtitulos}:{}),source:'Muestra de '+(identity.nombre||id)}}:{})});
 }
}
const names=new Set([...found,...identities.map(x=>x.name)]);
const previous=catalog.components.filter(x=>!names.has(x.name));
const last=previous.reduce((n,x,i)=>x.family==='Personajes'?i:n,-1);
previous.splice(last+1,0,...cards,...identities);catalog.components=previous;
for(const item of identities)if(!tab.components.includes(item.name))tab.components.push(item.name);
await atomic(path.join(here,'characters.json'),{sprites});
await atomic(thumbsPath,thumbs);await atomic(catalogPath,catalog);await atomic(infoPath,info);
console.log(JSON.stringify({poses:cards.length,identidades:identities.length}));
