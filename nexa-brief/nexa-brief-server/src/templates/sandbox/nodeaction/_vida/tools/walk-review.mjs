import {createCanvas,loadImage} from '@napi-rs/canvas';
import {writeFile} from 'node:fs/promises';
import {loadEpisode} from './runtime.mjs';
import {renderFrame} from '../engine/render.js';
const [episode,output]=process.argv.slice(2);
if(!episode||!output)throw Error('Uso: node tools/walk-review.mjs episodio.json salida.jpg');
const c=await loadEpisode(episode),canvas=createCanvas(540,960),ctx=canvas.getContext('2d');
const w=216,h=384,gap=12,label=38,cols=7,count=21,rows=3,sheet=createCanvas(cols*(w+gap)+gap,rows*(h+gap+label)+gap),sc=sheet.getContext('2d');
sc.fillStyle='#f0ece3';sc.fillRect(0,0,sheet.width,sheet.height);
for(let i=0;i<count;i++){
 const t=i/10,s=renderFrame(ctx,c,t),x=gap+i%cols*(w+gap),y=gap+Math.floor(i/cols)*(h+gap+label);
 // Snapshot the native surface before reusing it; prevents deferred Skia image aliasing.
 const snapshot=await loadImage(await canvas.encode('png'));sc.drawImage(snapshot,x,y,w,h);
 sc.fillStyle='#26363b';sc.font='15px sans-serif';sc.fillText(`${t.toFixed(1)} s · vista ${Number(s.actors.tomas.pose.view).toFixed(2)}`,x+2,y+h+23);
}
await writeFile(output,await sheet.encode('jpeg',94));console.log(output);
