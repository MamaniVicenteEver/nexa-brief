import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {photoAttributions} from './attribution.js';
import {mergeLook} from './style.js';
export function creditsText(scene, looks, providers, photos) {
  const ids=new Set(['terrain-land']);
  for(const look of looks) {
    if(look.sat?.visible){ids.add('gibs-bluemarble');if(look.sat.viirs)ids.add('gibs-viirs');if(look.sat.detail)ids.add(look.sat.detail);}
    if(look.labels?.visible || look.base?.visible)ids.add('protomaps-pmtiles');
  }
  const sources=[...ids].map(id=>providers.find(p=>p.id===id)).filter(Boolean).map(p=>`${p.attribution} — ${p.license} (${p.attribution_url})`);
  const images=photoAttributions(scene,photos);
  return ['Fuentes cartográficas:',...sources,...(images.length?['','Fotografías:',...images]:[])].join('\n')+'\n';
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 const file=path.resolve(process.argv[2]),scene=JSON.parse(fs.readFileSync(file));
 const here=path.dirname(fileURLToPath(import.meta.url));
 const names=[...new Set([scene.look||'satelite-realista',...(scene.looks||[]).map(e=>e.look)].filter(x=>typeof x==='string'))];
 const loaded=Object.fromEntries(names.map(n=>[n,JSON.parse(fs.readFileSync(path.join(here,'looks',n+'.json')))]));
 const resolve=look=>typeof look==='string'?loaded[look]:look;
 const looks=[mergeLook(resolve(scene.look||'satelite-realista'),scene.lookOverrides),...(scene.looks||[]).map(e=>mergeLook(mergeLook(resolve(e.look),scene.lookOverrides),e.overrides||e.lookOverrides))];
 const providers=JSON.parse(fs.readFileSync(path.join(here,'providers.json')));
 const dir=path.dirname(file),assets=path.basename(dir)==='assets'?dir:path.join(dir,'assets');fs.mkdirSync(assets,{recursive:true});let photos={};try{photos=JSON.parse(fs.readFileSync(path.join(assets,'media/credits.json')));}catch(e){if(e.code!=='ENOENT')throw e;}
 const text=creditsText(scene,looks,providers,photos);fs.writeFileSync(path.join(assets,'credits.txt'),text);process.stdout.write(text);
}
