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
  let highCanvas=null,loads=0,fallbackDraws=0,mosaicBytes=0;const mosaics=new Map();
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
  function drawMosaic(g,view,z,alpha=1){
    let item=mosaics.get(z);
    if(!item){
      const tiles=[...planned].map(key=>{const [level,x,y]=key.split('/').map(Number);return {z:level,x,y,key};}).filter(t=>t.z===z);
      const x0=Math.min(...tiles.map(t=>t.x)),y0=Math.min(...tiles.map(t=>t.y));
      const x1=Math.max(...tiles.map(t=>t.x)),y1=Math.max(...tiles.map(t=>t.y));
      const size=provider.tile_size||256,w=(x1-x0+1)*size,h=(y1-y0+1)*size,bytes=w*h*4;
      if(!tiles.length||bytes>64*1024**2){drawLevel(g,view,z);return;}
      while(mosaics.size&&mosaicBytes+bytes>96*1024**2){const oldest=mosaics.keys().next().value;mosaicBytes-=mosaics.get(oldest).bytes;mosaics.delete(oldest);}
      const canvas=new OffscreenCanvas(w,h),mg=canvas.getContext('2d',{willReadFrequently:true});
      mg.imageSmoothingEnabled=true;mg.imageSmoothingQuality='high';
      for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
        const src=ancestor({z,x,y},images);
        if(src)mg.drawImage(src.image,src.sx,src.sy,src.sw,src.sh,(x-x0)*size,(y-y0)*size,size,size);
      }
      item={canvas,x0,y0,x1,y1,bytes};mosaics.set(z,item);mosaicBytes+=bytes;
    }else{mosaics.delete(z);mosaics.set(z,item);}
    for(const tile of visibleTiles(view,z)){
      if(!planned.has(tile.key))unplanned.add(tile.key);
      const src=ancestor(tile,images);if(src&&src.z<z)fallbackDraws++;
    }
    const n=2**z;g.save();g.setTransform(...view.mercatorToScreen);g.globalAlpha=alpha;
    g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
    g.drawImage(item.canvas,item.x0/n,item.y0/n,(item.x1-item.x0+1)/n,(item.y1-item.y0+1)/n);g.restore();
  }
  return {
    plan,
    async preload(progress=()=>{}){
      mosaics.clear();mosaicBytes=0;
      const work=[...planned].sort((a,b)=>Number(a.split('/')[0])-Number(b.split('/')[0]));let next=0,done=0;
      await Promise.all(Array.from({length:8},async()=>{
        while(next<work.length){const key=work[next++],[z,x,y]=key.split('/').map(Number);await load({key,z,x,y});progress(++done/work.length);}
      }));
    },
    draw(g,view){
      const {low,high,alpha}=tileLevels(view.zoom,provider.max_zoom,provider.tile_size);
      drawMosaic(g,view,low);
      if(alpha>0)drawMosaic(g,view,high,alpha);
    },
    missingTiles:()=>[...new Set([...failed,...unplanned])].sort().map(key=>`${provider.id}/${key}`),
    stats:()=>({planned:planned.size,loaded:images.size,failed:failed.size,unplanned:unplanned.size,loads,fallbackDraws,mosaicBytes}),
  };
}
