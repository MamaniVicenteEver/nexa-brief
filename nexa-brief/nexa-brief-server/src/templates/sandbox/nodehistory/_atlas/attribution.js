import { isGlobeProjection } from './projection.js';
/** Créditos de los medios referidos por la escena, sin repetir archivos. */
export function photoAttributions(scene, credits = {}) {
  const files = [...new Set((scene.layers || []).map(l => typeof l.src === 'string' ? l.src.split('/').pop() : null).filter(Boolean))];
  return files.map(name => credits[name]).filter(Boolean).map(c => `${c.title} — ${c.author}, ${c.license} (${c.source_url}; ${c.license_url})`);
}

/** Atribución compacta, limitada a las capas visibles. */
export function screenAttribution(look, zoom=0) {
  const imagery=[];
  if (look.sat?.visible && look.sat.opacity>0) {
    imagery.push('NASA GIBS');
    if (zoom>=8 && look.sat.detail==='usgs-imagery') imagery.push('USGS');
    else if (zoom>=8 && look.sat.detail) imagery.push(look.sat.detail);
  }
  const parts=[];
  if(imagery.length) parts.push('Imagery: '+imagery.join(' · '));
  if(look.terrain?.exaggeration || (look.shade?.visible && look.shade.opacity)) parts.push('Elevation: AWS Terrain Tiles');
  if(look.base?.visible || look.labels?.visible) parts.push('© OpenStreetMap · Protomaps');
  return parts.join(' · ');
}
export function paintBackground(g,w,h,look) {
  g.save(); g.fillStyle=look.background; g.fillRect(0,0,w,h);
  if(isGlobeProjection(look.projection)) {
    let seed=123456789; const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
    for(let i=0;i<250;i++){const x=rand()*w,y=rand()*h,r=.3+rand()*.8;g.fillStyle=`rgba(220,230,255,${.12+rand()*.35})`;g.fillRect(x,y,r,r);}
  }
  g.restore();
}
export function drawAttribution(g,w,h,unit,text) {
  if(!text)return;
  g.save();g.font=`${Math.max(9,11*unit)}px sans-serif`;g.textAlign='right';g.textBaseline='bottom';g.fillStyle='#d6dbe0';g.shadowColor='#000';g.shadowBlur=3*unit;g.fillText(text,w-8,h-5,w-16);g.restore();
}
