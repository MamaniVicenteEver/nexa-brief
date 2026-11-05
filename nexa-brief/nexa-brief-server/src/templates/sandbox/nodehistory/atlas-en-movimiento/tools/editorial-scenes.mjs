// Reconstruye las demos desde el registro: no altera la escena narrada del episodio.
import {writeFile,mkdir,copyFile} from 'node:fs/promises';
import {Tactico} from '../../_tactico/core.js';
await import('../../_tactico/components/sites.js');
await import('../../_tactico/components/economy.js');
await import('../../_tactico/components/editorial.js');
await mkdir(new URL('../assets/fonts/',import.meta.url),{recursive:true});
await copyFile('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',new URL('../assets/fonts/AtlasEditorial.ttf',import.meta.url));
const palette={ink:'#081e2c',ground:'#399e58',roof:'#e9e3ba',paper:'#e9e3ba',wall:'#8b999b',side:'#47595c',metal:'#bac9ca',accent:'#f6edb4',fire:'#ef8138',smoke:'#47595c',water:'#084c68',money:'#399e58'};
const defs={palette,fonts:{label:'AtlasEditorial',display:'AtlasEditorial'}};
const demos=Tactico.list().map(d=>structuredClone(d.demo));
for(let i=0;i<demos.length;i++){
 const item=demos[i],t=i*8;item.t=t;item.out=t+7.6;item.dur=8;item.fade=.35;
 item.at=item.type==='site.refinery'?[48.3,30.35]:item.type==='site.port'?[50.33,29.25]:[51.5,27.6];if(item.states)item.states=item.states.map(s=>({...s,at:s.at+t}));
 if(item.type==='callout.photo'){item.at=[51.5,25.5];item.offset=[0,-420];}
 if(item.type==='money.flow'){item.routeVisible=true;item.note='Flujo simbólico; no representa una suma ni cargamentos específicos.';}
}
const scene={format:'atlas-v1',duration:demos.length*8,lang:'es',intro:false,outro:false,captions:{enabled:false},planoLook:'tactico',defs,places:{Kharg:[50.33,29.25],Abadan:[48.3,30.35]},camera:[{t:0,center:[51.5,28],zoom:5,pitch:0,bearing:0}],tiles:{provider:'gibs-bluemarble',manifest:'../bench/cache-inventory.json'},motionBlur:{samples:1},layers:[],items:demos,note:'Galería de capacidades D y F; no es el montaje histórico final. El inventario es una muestra de biblioteca.'};
await mkdir(new URL('../work/tactico/',import.meta.url),{recursive:true});
for(const [name,items] of [['scene-editorial',demos],['scene-sites',demos.filter(x=>x.type.startsWith('site.'))],['scene-economy',demos.filter(x=>x.type.startsWith('money.'))],['scene-portraits',demos.filter(x=>!x.type.startsWith('site.')&&!x.type.startsWith('money.'))]]){
 await writeFile(new URL(`../work/tactico/${name}.json`,import.meta.url),JSON.stringify({...scene,items},null,2)+'\n');
}
console.log('13 demos → work/tactico/scene-editorial.json y escenas por familia');
