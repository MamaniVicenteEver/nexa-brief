/** Small evidence only: decode four frames of the existing MP4; never encode video. */
import {createCanvas,loadImage} from '@napi-rs/canvas';
import {mkdir,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {loadEpisode,ROOT} from './runtime.mjs';
import {renderFrame} from '../engine/render.js';
import {drawCharacter} from '../engine/index.js';
import {pelvisBottom} from '../engine/rig/skeleton.js';
import {drawProp} from '../engine/props/index.js';
const c=await loadEpisode(new URL('../../vida-en-escena/assets/episode.json',import.meta.url).pathname);
const out=resolve(ROOT,'../vida-en-escena/review/pulido'),temp=await mkdtemp(join(tmpdir(),'vida-pulido-evidence-'));
await mkdir(out,{recursive:true});await mkdir(join(ROOT,'review'),{recursive:true});
const views=['front','3q-left','3q-right','side-left','side-right'],ids=['tomas','nico','valeria','mama'];
const sheet=createCanvas(1400,1720),ctx=sheet.getContext('2d');ctx.fillStyle='#f4f0e8';ctx.fillRect(0,0,1400,1720);
for(const [row,id] of ids.entries())for(const [col,view] of views.entries()){
 const ch=c.catalog.characters[id],x=col*280+140,y=row*430+402,scale=330,s=scale*ch.height,seatY=y-85;
 ctx.fillStyle='#26363b';ctx.font='16px sans-serif';ctx.fillText(`${ch.name??id} · ${view}`,col*280+14,row*430+25);
 drawProp(ctx,'chair',{x,y,w:99,params:{h:194,seatY,color:'#d8b898'}});
 drawCharacter(ctx,ch,{x,y,scale,view,sitting:1,seatLevel:(seatY-y)/s,rootY:(seatY-y)/s-pelvisBottom(ch,view)},{expression:'smile',silent:true},0);
}
await writeFile(join(ROOT,'review/sitting.jpg'),await sheet.encode('jpeg',88));
const specs=[
 {id:'01-fade',title:'Fade · mitad de la transición',t:94.8666666667,crop:[0,0,1080,1600],size:[270,400]},
 {id:'02-sentados',title:'Parque · muslos, rodillas y asiento',t:60,crop:[0,650,1080,930],size:[400,344]},
 {id:'03-comedor',title:'Comedor · pelvis, mesa y plato',t:105,crop:[260,580,820,1000],size:[328,400]},
 {id:'04-cuchara',title:'Cuchara · cazoleta hacia la boca',t:110.4,crop:[0,320,860,800],size:[344,320]},
];
try{
 for(const spec of specs){const before=join(temp,'before.png');execFileSync('ffmpeg',['-v','error','-ss',String(spec.t),'-i',resolve(ROOT,'../vida-en-escena/render/un-dia-cualquiera.mp4'),'-frames:v','1','-update','1','-y',before]);
  const image=await loadImage(before),after=createCanvas(1080,1920);renderFrame(after.getContext('2d'),c,spec.t);
  const [w,h]=spec.size,pair=createCanvas(w*2+30,h+70),p=pair.getContext('2d');p.fillStyle='#f4f0e8';p.fillRect(0,0,pair.width,pair.height);p.fillStyle='#26363b';p.font='16px sans-serif';p.fillText(`${spec.title} · ${spec.t.toFixed(2)} s`,10,21);
  for(const [i,frame] of [image,after].entries()){const x=10+i*(w+10);p.font='13px sans-serif';p.fillText(i?'DESPUÉS · motor actual':'ANTES · MP4 del líder',x,43);p.drawImage(frame,...spec.crop,x,55,w,h);}
  await writeFile(join(out,spec.id+'.jpg'),await pair.encode('jpeg',86));
 }
 await writeFile(join(out,'frames.json'),JSON.stringify({before:'../../render/un-dia-cualquiera.mp4',after:'renderFrame; 1080×1920; sin MP4 nuevo',frames:specs},null,2)+'\n');
}finally{await rm(temp,{recursive:true,force:true});}
console.log(`Hoja: ${join(ROOT,'review/sitting.jpg')}; 4 comparaciones: ${out}`);
