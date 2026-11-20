import { normalizeProjection } from './projection.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function setPaint(c,id,key,value){if(value!==undefined && c.map.getLayer(id) && !equal(c.map.getPaintProperty(id,key),value))c.map.setPaintProperty(id,key,value);}
function setLayout(c,id,key,value){if(c.map.getLayer(id) && !equal(c.map.getLayoutProperty(id,key),value))c.map.setLayoutProperty(id,key,value);}
function zoomRange(c,id,min,max){const layer=c.map.getLayer(id);if(layer && (layer.minzoom!==min || layer.maxzoom!==max))c.map.setLayerZoomRange(id,min,max);}
function ensureHatch(c,key){if(c.map.hasImage(key))return;const n=16,cv=document.createElement('canvas');cv.width=cv.height=n;const x=cv.getContext('2d');x.strokeStyle=key.slice(6);x.lineWidth=3;for(const o of [-n,0,n]){x.beginPath();x.moveTo(o,n);x.lineTo(o+n,0);x.stroke();}c.map.addImage(key,x.getImageData(0,0,n,n));}
export function apply(c,t){
  const pose=c.camera.at(t), look=c.lookAt(t), m=c.map;
  const dem=look.dem==='raw'?'terrain-aws':'terrain-land', source=m.getSource('dem'), p=c.providers.find(p=>p.id===dem); const tiles=[c.online && dem==='terrain-aws'?p.url:`${c.base}cache/${dem}/{z}/{x}/{y}.png`]; if(!equal(source.tiles,tiles))source.setTiles(tiles);
  const projection=normalizeProjection(look.projection,{width:c.st?.W});if(!equal(m.getProjection(),projection))m.setProjection(projection);
  if(!equal(m.getSky(),look.sky))m.setSky(look.sky);
  const terrain=m.getTerrain();if(terrain?.source!=='dem' || terrain.exaggeration!==look.terrain.exaggeration)m.setTerrain({source:'dem',exaggeration:look.terrain.exaggeration});
  m.jumpTo({center:[pose.lon,pose.lat],zoom:pose.zoom,pitch:pose.pitch,bearing:pose.bearing,padding:{top:2*(pose.lift ?? 0)*c.st.H,bottom:0,left:0,right:0}});
  setPaint(c,'background','background-color',look.background);
  for(const id of c.satIds){
    const chosen=id==='sat-bm'||id==='sat-viirs'&&look.sat.viirs||id==='sat-detail-'+look.sat.detail;
    setLayout(c,id,'visibility',look.sat.visible&&chosen?'visible':'none');
    for(const [key,value] of Object.entries({'raster-opacity':look.sat.visible&&chosen?look.sat.opacity:0,'raster-saturation':look.sat.saturation,'raster-contrast':look.sat.contrast,'raster-brightness-min':clamp(look.sat.brightness,0,1),'raster-brightness-max':look.sat.brightnessMax ?? 1,'raster-hue-rotate':look.sat.hue}))setPaint(c,id,key,value);
  }
  setPaint(c,'shade-terrain','hillshade-exaggeration',look.shade.visible?look.shade.opacity:0);
  for(const layer of c.baseLayers){const {id,type,paint}=layer,flavor=id.split('-')[1];setLayout(c,id,'visibility',look.base.visible && flavor===look.base.flavor?'visible':'none');const key=type==='fill'?'fill-opacity':type==='line'?'line-opacity':null;if(key)setPaint(c,id,key,look.base.opacity===1?(paint?.[key]??1):['*',paint?.[key]??1,look.base.opacity]);}
  setLayout(c,'base-political','visibility',look.base.visible&&look.base.political?'visible':'none');
  for(let i=0;i<3;i++){setLayout(c,`lbl-${i}`,'text-font',[look.sat.visible?'Noto Sans Medium':'Noto Sans Regular']);let b=look.borders.levels[i],l=look.labels.levels[i];for(const [k,v] of Object.entries({'line-color':b.color,'line-width':b.width,'line-opacity':look.borders.visible?look.borders.opacity*(b.opacity ?? 1):0}))setPaint(c,`brd-${i}`,k,v);for(const [k,v] of Object.entries({'text-color':l.color,'text-opacity':look.labels.visible?look.labels.opacity:0}))setPaint(c,`lbl-${i}`,k,v);setLayout(c,`lbl-${i}`,'text-size',['interpolate',['linear'],['zoom'],l.minzoom,l.size,l.maxzoom,l.size*1.4]);zoomRange(c,`brd-${i}`,b.minzoom,b.maxzoom);zoomRange(c,`lbl-${i}`,l.minzoom,l.maxzoom);}
  setLayout(c,'lbl-places','text-font',[look.sat.visible?'Noto Sans Medium':'Noto Sans Regular']);const l=look.labels.levels[3];setPaint(c,'lbl-places','text-color',l.color);setPaint(c,'lbl-places','text-opacity',look.labels.visible?look.labels.opacity:0);setLayout(c,'lbl-places','text-size',['interpolate',['linear'],['zoom'],l.minzoom,l.size,l.maxzoom,l.size*1.4]);for(const id of ['lbl-roads_labels_minor','lbl-roads_labels_major'])setPaint(c,id,'text-opacity',look.labels.visible?look.labels.opacity:0);zoomRange(c,'lbl-places',l.minzoom,l.maxzoom);
  for(const h of c.highlights){const dur=Math.max(.001,h.dur), alpha=clamp((t-h.t)/dur,0,1)*(h.out==null||t<h.out?1:0);const style=typeof h.style==='object'?h.style:look.highlight.styles[h.style||'olive']||look.highlight.styles.olive;setPaint(c,h.id+'-fill','fill-color',style.fill);setPaint(c,h.id+'-fill','fill-opacity',alpha*(style.opacity??.55));setPaint(c,h.id+'-line','line-color',style.line);setPaint(c,h.id+'-line','line-opacity',h.border?alpha:0);setPaint(c,h.id+'-line','line-width',style.width??1.1);setPaint(c,h.id+'-glow','line-color',style.line);setPaint(c,h.id+'-glow','line-opacity',h.border?alpha*(style.glow??.2):0);setPaint(c,h.id+'-glow','line-width',style.glowWidth??3);setPaint(c,h.id+'-glow','line-blur',style.glowBlur??1.5);if(c.map.getLayer(h.id+'-hatch')){const hc=style.hatch;if(hc&&hc!==true||style.hatch===true){const key='hatch:'+(typeof hc==='string'?hc:style.line);ensureHatch(c,key);setPaint(c,h.id+'-hatch','fill-pattern',key);}setPaint(c,h.id+'-hatch','fill-opacity',style.hatch?alpha*(style.hatchOpacity??.9):0);}}
  c.flagFills?.apply(m,t);
  c.choropleths?.apply(m,t);
  return {pose,look};
}
