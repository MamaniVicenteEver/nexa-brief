import {mercator} from './view.js';
const intersects=(a,b)=>a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];
const mixWhite=color=>{
  const hex=color.replace('#','');
  if(!/^[\da-f]{6}$/i.test(hex))return color;
  return '#'+[0,2,4].map(i=>Math.round(parseInt(hex.slice(i,i+2),16)*.75+255*.25).toString(16).padStart(2,'0')).join('');
};
export function createTerritories(collection) {
  const parts=[],byName=new Map();
  const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  for(const feature of collection.features||[]) {
    const polygons=feature.geometry.type==='Polygon'?[feature.geometry.coordinates]:feature.geometry.type==='MultiPolygon'?feature.geometry.coordinates:[];
    const country=[];
    for(const polygon of polygons){
      const path=new Path2D(),bounds=[Infinity,Infinity,-Infinity,-Infinity];
      for(const ring of polygon){
        ring.forEach(([lon,lat],i)=>{
          const [x,y]=mercator(lon,lat);
          bounds[0]=Math.min(bounds[0],x);bounds[1]=Math.min(bounds[1],y);
          bounds[2]=Math.max(bounds[2],x);bounds[3]=Math.max(bounds[3],y);
          if(i===0)path.moveTo(x,y);else path.lineTo(x,y);
        });path.closePath();
      }
      const part={path,bounds};parts.push(part);country.push(part);
    }
    const p=feature.properties||{};
    for(const name of [p.id,p.iso3,p.name,p.name_es])if(name)byName.set(norm(name),country);
  }
  return {
    count:parts.length,
    country:name=>byName.get(norm(name)),
    oceanPath(bounds) {
      const path=new Path2D();path.rect(bounds[0],bounds[1],bounds[2]-bounds[0],bounds[3]-bounds[1]);
      for(const part of parts)if(intersects(bounds,part.bounds))path.addPath(part.path);
      return path;
    },
    draw(g,view,layers,t,look) {
      const unit=view.unit??Math.min(view.W,view.H)/1080,scale=1,matrix=new DOMMatrix(view.mercatorToScreen);
      const visible=parts.filter(p=>intersects(view.bounds,p.bounds));
      g.save();g.resetTransform();g.lineJoin='round';
      const borders=look.borders;
      if(borders?.visible){
        const path=new Path2D();for(const part of visible)path.addPath(part.path,matrix);
        g.strokeStyle=borders.color;
        g.lineWidth=borders.glowWidth*unit/scale;g.globalAlpha=borders.glowOpacity;g.stroke(path);
        g.lineWidth=borders.width*unit/scale;g.globalAlpha=borders.opacity;g.stroke(path);
      }
      for(const layer of layers){
        const dur=Math.max(.001,layer.dur??.35),alpha=Math.max(0,Math.min(1,(t-layer.t)/dur))*
          (layer.out==null?1:Math.max(0,Math.min(1,1-(t-layer.out)/dur)));
        if(alpha<=0)continue;
        const style={...look.highlight,...(typeof layer.style==='object'?layer.style:{}),...(layer.color?{fill:layer.color}:{})};
        const path=new Path2D();
        for(const part of layer.parts)if(intersects(view.bounds,part.bounds))path.addPath(part.path,matrix);
        const opacity=alpha*(style.opacity??.8);
        // Misma receta de _mapas: tres mezclas que conservan la textura del satélite.
        g.globalCompositeOperation='multiply';g.globalAlpha=opacity;g.fillStyle=mixWhite(style.fill);g.fill(path,'evenodd');
        g.globalCompositeOperation='screen';g.globalAlpha=opacity*.5;g.fillStyle=style.fill;g.fill(path,'evenodd');
        g.globalCompositeOperation='overlay';g.globalAlpha=opacity*.35;g.fill(path,'evenodd');
        g.globalCompositeOperation='source-over';
        if(layer.border!==false){
          g.strokeStyle=style.line;g.globalAlpha=alpha*.22;g.lineWidth=(style.width+3)*unit/scale;g.stroke(path);
          g.globalAlpha=alpha;g.lineWidth=style.width*unit/scale;g.stroke(path);
        }
      }
      g.restore();
    },
  };
}
