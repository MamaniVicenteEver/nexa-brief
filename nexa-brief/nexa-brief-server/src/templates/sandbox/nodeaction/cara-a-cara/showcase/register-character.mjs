// Registra un personaje o añade poses ya revisadas; no genera imágenes ni voz.
import { readFile, writeFile, realpath, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec=promisify(execFile), here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..'), profilePath=path.resolve(root,'../_pizarra/profiles/leo.json');
const require=createRequire(import.meta.url), {loadImage}=require('../../_vida/node_modules/@napi-rs/canvas');
const [id,...args]=process.argv.slice(2), safe=/^[a-z0-9][a-z0-9-]*$/;
let manifestName='manifest.json';
const index=args.indexOf('--manifest');
if(index>=0){ manifestName=args[index+1]||''; args.splice(index,2); }
const flags=args;
if(!id||!safe.test(id)||!/^[-a-z0-9_.]+\.json$/i.test(manifestName)||manifestName.includes('..')||flags.some(x=>!['--check','--apply','--extend'].includes(x))||flags.includes('--check')===flags.includes('--apply'))
 throw Error('Uso: node showcase/register-character.mjs <id> --check|--apply [--extend] [--manifest archivo.json]');
const dir=path.join(root,'assets/avatar/characters',id);
const manifest=JSON.parse(await readFile(path.join(dir,manifestName),'utf8'));
const profile=JSON.parse(await readFile(profilePath,'utf8')), existing=profile.avatar?.characters?.[id];
const extend=flags.includes('--extend');
if(manifest.id!==id||!Array.isArray(manifest.sheets)||!manifest.poses||typeof manifest.poses!=='object'||Array.isArray(manifest.poses))throw Error('Manifiesto inválido');
if(extend&&!existing)throw Error('El personaje no existe; no se puede extender');
if(!extend&&existing)throw Error('El personaje ya existe; usar --extend para añadir poses');
const required=['talk','point-left','point-right','think','explain','surprise','celebrate','question'];
if(!extend&&!required.every(p=>p in manifest.poses))throw Error('Faltan poses base');
if(!Object.keys(manifest.poses).length)throw Error('No hay poses para registrar');
if(!extend){
 const identity=JSON.parse(await readFile(path.join(dir,'identity.json'),'utf8'));
 if(identity.id!==id||!identity.nombre||!identity.tema||!identity.objetivo||!identity.publico||!identity.personalidad||!identity.estilo||!identity.voz||typeof identity.voz!=='object')throw Error('Identidad incompleta');
 if(!identity.voz.estado||!identity.voz.nombre||!identity.voz.modelo||!identity.voz.direccion)throw Error('Identidad de voz incompleta');
}
const sheets=new Map(), dirReal=await realpath(dir);
for(const spec of manifest.sheets){
 if(typeof spec.file!=='string'||path.basename(spec.file)!==spec.file||!/^[-a-z0-9_.]+\.png$/i.test(spec.file)||![2,4].includes(spec.rows)||spec.columns!==spec.rows)throw Error('Cada lámina debe ser un PNG local 2×2 o 4×4');
 if(sheets.has(spec.file))throw Error('Lámina duplicada: '+spec.file);
 const f=await realpath(path.join(dir,spec.file));if(!f.startsWith(dirReal+path.sep))throw Error('Lámina fuera de la carpeta del personaje');
 const buffer=await readFile(f);if(!buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('El archivo no es PNG: '+spec.file);
 const image=await loadImage(buffer);
 if(image.width/spec.columns<512||image.height/spec.rows<512)throw Error(`Resolución insuficiente en ${spec.file}: ${image.width}×${image.height}, celdas mínimas 512×512`);
 sheets.set(spec.file,{...spec,width:image.width,height:image.height});
}
const names=Object.keys(manifest.poses), result={};
for(const name of names){
 const pose=manifest.poses[name];
 if(!safe.test(name)||!pose||!sheets.has(pose.sheet)||!Array.isArray(pose.crop)||pose.crop.length!==4||!pose.crop.every(Number.isFinite))throw Error('Pose inválida: '+name);
 const [x,y,w,h]=pose.crop;if(x<0||y<0||w<=0||h<=0||x+w>1.000001||y+h>1.000001)throw Error('Recorte fuera de límites: '+name);
 if(extend&&name in existing.poses)throw Error('La pose ya existe: '+name);
 const src=path.posix.join('../../cara-a-cara/assets/avatar/characters',id,pose.sheet);
 result[name]={src,crop:pose.crop};
}
if(flags.includes('--apply')){
 const backup=JSON.stringify(profile,null,2)+'\n';
 if(extend)Object.assign(existing.poses,result);
 else profile.avatar.characters[id]={src:result[required[0]].src,poses:result};
 const tmp=profilePath+'.tmp';await writeFile(tmp,JSON.stringify(profile,null,2)+'\n');await rename(tmp,profilePath);
 try{await exec('node',[path.join(here,'sync-character-assets.mjs')],{timeout:120000});}
 catch(e){await writeFile(tmp,backup);await rename(tmp,profilePath);throw Error('Falló la sincronización; perfil restaurado: '+e.message);}
}
console.log(JSON.stringify({id,modo:extend?'expresiones':'personaje',laminas:[...sheets.values()],poses:names,estado:flags.includes('--apply')?'registrado':'validacion-estructural-correcta',pendiente:'Revisión visual y prueba en Showcase'}));
