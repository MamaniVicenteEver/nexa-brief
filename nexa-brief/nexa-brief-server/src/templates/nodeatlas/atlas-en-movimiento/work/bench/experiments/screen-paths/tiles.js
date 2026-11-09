import {atlasURL} from './paths.js';
import {tileLevels,visibleTiles} from './view.js';

export function ancestor(tile,images) {
  for(let z=tile.z;z>=0;z--){
    const ratio=2**(tile.z-z),x=Math.floor(tile.x/ratio),y=Math.floor(tile.y/ratio),image=images.get(`${z}/${x}/${y}`);
    if(image)return {image,z,sx:(tile.x-x*ratio)*image.width/ratio,sy:(tile.y-y*ratio)*image.height/ratio,sw:image.width/ratio,sh:image.height/ratio};
  }
  return null;
}
export function createTiles(provider,look,territories,inventory=null) {
  const images=new Map(),failed=new Set(),planned=new Set(),pending=new Map(),unplanned=new Set();
  const available=inventory?new Set(inventory.keys):null;
  let highCanvas=null,loads=0,fallbackDraws=0;
  function grade(image,tile) {
    const n=2**tile.z,canvas=new OffscreenCanvas(image.width,image.height),g=canvas.getContext('2d',{willReadFrequently:true});
    g.filter=`saturate(${look.saturation??1}) contrast(${look.contrast??1}) brightness(${look.brightness??1})`;
    g.drawImage(image,0,0);g.filter='none';
    if(look.ocean?.opacity){
      const bounds=[tile.x/n,tile.y/n,(tile.x+1)/n,(tile.y+1)/n];
      g.save();g.setTransform(n*canvas.width,0,0,n*canvas.height,-tile.x*canvas.width,-tile.y*canvas.height);
      g.clip(territories.oceanPath(bounds),'evenodd');g.globalCompositeOperation=look.ocean.blend||'screen';
      g.globalAlpha=look.ocean.opacity;g.fillStyle=look.ocean.color;g.fillRect(...[bounds[0],bounds[1],1/n,1/n]);g.restore();
    }
    return canvas.transferToImageBitmap();
  }
  async function load(tile) {
    if(images.has(tile.key)||failed.has(tile.key))return;
    if(pending.has(tile.key))return pending.get(tile.key);
    if(available&&!available.has(tile.key)){failed.add(tile.key);return;}
    const job=(async()=>{
      try{
        const response=await fetch(atlasURL(`cache/${provider.id}/${tile.key}.${provider.ext}`));
        if(!response.ok)throw Error(`${response.status}`);
        const image=await createImageBitmap(await response.blob());
        images.set(tile.key,grade(image,tile));image.close();loads++;
      }catch(error){failed.add(tile.key);}
    })();
    pending.set(tile.key,job);await job;pending.delete(tile.key);
  }
  function requested(view){
    const levels=tileLevels(view.zoom,provider.max_zoom,provider.tile_size);
    const tiles=visibleTiles(view,levels.low);
    if(levels.alpha>0)tiles.push(...visibleTiles(view,levels.high));
    return tiles;
  }
  function plan(view){
    for(const tile of requested(view))for(let z=tile.z;z>=0;z--){
      const r=2**(tile.z-z);planned.add(`${z}/${Math.floor(tile.x/r)}/${Math.floor(tile.y/r)}`);
    }
  }
  function drawLevel(g,view,z){
    g.save();g.setTransform(...view.mercatorToScreen);g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
    const n=2**z,overlap=.35/view.scale;
    for(const tile of visibleTiles(view,z)){
      if(!planned.has(tile.key))unplanned.add(tile.key);
      const source=ancestor(tile,images);if(!source)continue;
      if(source.z<z)fallbackDraws++;
      // Solape subpíxel para que las quads rotadas no muestren la costura del fondo.
      g.drawImage(source.image,source.sx,source.sy,source.sw,source.sh,tile.x/n-overlap,tile.y/n-overlap,1/n+overlap*2,1/n+overlap*2);
    }
    g.restore();
  }
  return {
    plan,
    async preload(progress=()=>{}){
      const work=[...planned].sort((a,b)=>Number(a.split('/')[0])-Number(b.split('/')[0]));let next=0,done=0;
      await Promise.all(Array.from({length:8},async()=>{
        while(next<work.length){const key=work[next++],[z,x,y]=key.split('/').map(Number);await load({key,z,x,y});progress(++done/work.length);}
      }));
    },
    draw(g,view){
      const {low,high,alpha}=tileLevels(view.zoom,provider.max_zoom,provider.tile_size);
      drawLevel(g,view,low);
      if(alpha>0){
        if(!highCanvas||highCanvas.width!==view.W||highCanvas.height!==view.H)highCanvas=new OffscreenCanvas(view.W,view.H);
        const hg=highCanvas.getContext('2d',{willReadFrequently:true});hg.resetTransform();hg.clearRect(0,0,view.W,view.H);drawLevel(hg,view,high);
        g.save();g.resetTransform();g.globalAlpha=alpha;g.drawImage(highCanvas,0,0);g.restore();
      }
    },
    missingTiles:()=>[...new Set([...failed,...unplanned])].sort().map(key=>`${provider.id}/${key}`),
    stats:()=>({planned:planned.size,loaded:images.size,failed:failed.size,unplanned:unplanned.size,loads,fallbackDraws}),
  };
}
