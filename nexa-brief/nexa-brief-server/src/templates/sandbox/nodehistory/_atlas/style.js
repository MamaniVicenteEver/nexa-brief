import { normalizeProjection } from './projection.js';
import { layers as baseLayers, namedFlavor } from './vendor/protomaps-basemaps.js';
const clamp = x => Math.max(0, Math.min(1, x));
const hex = s => typeof s === 'string' && /^#[\da-f]{6}$/i.test(s) ? [1,3,5].map(i => parseInt(s.slice(i,i+2),16)) : null;
export function mix(a,b,t) {
  t=clamp(t); if (t===0) return structuredClone(a); if (t===1) return structuredClone(b);
  if (typeof a === 'number' && typeof b === 'number') return a+(b-a)*t;
  const x=hex(a), y=hex(b); if(x && y) return '#'+x.map((n,i)=>Math.round(n+(y[i]-n)*t).toString(16).padStart(2,'0')).join('');
  if(Array.isArray(a)&&Array.isArray(b)) return a.map((v,i)=>mix(v,b[i]??v,t));
  if(a && b && typeof a==='object' && typeof b==='object') return Object.fromEntries([...new Set([...Object.keys(a),...Object.keys(b)])].map(k=>[k,k in a && k in b ? mix(a[k],b[k],t) : structuredClone(t<0.5?a[k]??b[k]:b[k]??a[k])]));
  return t<0.5?a:b;
}
export function mergeLook(base, override = {}) {
  const result = structuredClone(base);
  for (const [key, value] of Object.entries(override || {})) {
    if (key === 'groups') { Object.assign(result, mergeLook(result, value)); continue; }
    if (key === 'borders' && value && !Array.isArray(value)) {
      const copy = {...value};
      for (const [i, name] of ['admin0','admin1','admin2'].entries()) if (copy[name]) {
        result.borders.levels[i] = mergeLook(result.borders.levels[i], copy[name]); delete copy[name];
      }
      result.borders = mergeLook(result.borders, copy); continue;
    }
    result[key] = key !== 'projection' && value && typeof value === 'object' && !Array.isArray(value) && result[key] && typeof result[key] === 'object' && !Array.isArray(result[key]) ? mergeLook(result[key], value) : structuredClone(value);
  }
  return result;
}
export function createLookAt(scene, looks, T = x => Number(x)||0) {
  const get = name => { const result = typeof name === 'object' ? name : looks[name]; if (!result) throw Error(`Atlas: look desconocido: ${name}`); return result; };
  const initial=mergeLook(get(scene.look || 'satelite-realista'), scene.lookOverrides);
  const events=(scene.looks||[]).map((e,i)=>({...e, at:T(e.t,0), i})).sort((a,b)=>a.at-b.at||a.i-b.i);
  const at=(t, count=events.length) => { let current=initial; for(let i=0;i<count;i++){const e=events[i];if(t<e.at)break;const start=at(e.at,i), target=mergeLook(mergeLook(get(e.look),scene.lookOverrides),e.overrides || e.lookOverrides), u=e.dur>0?clamp((t-e.at)/e.dur):1;current=mix(start,target,u*u*(3-2*u));current.projection=target.projection;} return current; };
  return at;
}
export function composeStyle(look, {base='../_atlas/', online=false, providers=[], detail=null, lang='es', width, detailProvider=look.sat?.detail, detailProviders=detailProvider?[detailProvider]:[]}={}) {
  const url=id=>{const p=providers.find(v=>v.id===id);return online && id!=='terrain-land' && p?.url ? p.url : `${base}cache/${id}/{z}/{x}/{y}.${p?.ext || (id.startsWith('terrain-')?'png':'jpg')}`;};
  const source=(id,maxzoom=8)=>({type:'raster',tiles:[url(id)],tileSize:256,maxzoom});
  const sources={'sat-bm':source('gibs-bluemarble',8),'sat-viirs':source('gibs-viirs',9),dem:{type:'raster-dem',tiles:[url(look.dem==='raw'?'terrain-aws':'terrain-land')],tileSize:256,maxzoom:15,encoding:'terrarium'},'vec-world':{type:'vector',url:`pmtiles://${base}cache/vector/world.pmtiles`},admin0:{type:'geojson',data:`${base}data/geo/admin0.geojson`},admin1:{type:'geojson',data:`${base}data/geo/admin1.geojson`},admin2:{type:'geojson',data:`${base}data/geo/admin2-US.geojson`},'labels-0':{type:'geojson',data:`${base}data/geo/labels-admin0.geojson`},'labels-1':{type:'geojson',data:`${base}data/geo/labels-admin1.geojson`},'labels-2':{type:'geojson',data:`${base}data/geo/labels-admin2-US.geojson`}};
  if(detail) sources['vec-detail']={type:'vector',url:`pmtiles://${base}cache/vector/detail-${encodeURIComponent(detail)}.pmtiles`};
  for(const id of detailProviders) {const p=providers.find(p=>p.id===id);sources['sat-detail-'+id]={...source(id,p?.max_zoom||14),...(p?.coverage_bbox?{bounds:p.coverage_bbox}:{})};}
  const layers=[{id:'background',type:'background',paint:{'background-color':look.background}}];
  for(const id of ['sat-bm','sat-viirs',...detailProviders.map(id=>'sat-detail-'+id)]) layers.push({id,type:'raster',source:id,...(id.startsWith('sat-detail-')?{minzoom:8}:id==='sat-viirs'?{minzoom:7}:{}),layout:{visibility:look.sat.visible && (id==='sat-bm'||id==='sat-viirs'&&look.sat.viirs||id==='sat-detail-'+look.sat.detail)?'visible':'none'},paint:{'raster-fade-duration':0,'raster-opacity':id==='sat-bm'&&look.sat.visible?look.sat.opacity:0,'raster-saturation':look.sat.saturation,'raster-contrast':look.sat.contrast,'raster-brightness-min':Math.max(0,look.sat.brightness),'raster-brightness-max':look.sat.brightnessMax ?? 1,'raster-hue-rotate':look.sat.hue}});
  layers.push({id:'shade-terrain',type:'hillshade',source:'dem',paint:{'hillshade-exaggeration':look.shade.visible?look.shade.opacity:0}});
  for (const flavor of ['light','dark','grayscale']) for(const layer of baseLayers('vec-world',namedFlavor(flavor))) if(layer.source && layer['source-layer']!=='boundaries' && layer['source-layer']!=='places' && layer.type!=='symbol') { layer.id=`base-${flavor}-${layer.id}`;layer.layout={...layer.layout,visibility:look.base.visible && look.base.flavor===flavor?'visible':'none'};layers.push(layer); }
  layers.push({id:'base-political',type:'fill',source:'admin0',layout:{visibility:look.base.political?'visible':'none'},paint:{'fill-color':['match',['get','id'],'US','#d8bd9d','BR','#a9bf94','CN','#d0a89a','RU','#b9b1ca','#c9c39e'],'fill-opacity':0.75}});
  for(let i=0;i<3;i++){const b=look.borders.levels[i];layers.push({id:`brd-${i}`,type:'line',source:`admin${i}`,minzoom:b.minzoom,maxzoom:b.maxzoom,paint:{'line-color':b.color,'line-width':b.width,'line-opacity':look.borders.visible?look.borders.opacity*(b.opacity ?? 1):0}});}
  for(let i=0;i<3;i++){const l=look.labels.levels[i];layers.push({id:`lbl-${i}`,type:'symbol',source:`labels-${i}`,minzoom:l.minzoom,maxzoom:l.maxzoom,layout:{'text-field':['coalesce',['get',`name_${lang}`],['get','name_es'],['get','name']],'text-font':[look.sat.visible?'Noto Sans Medium':'Noto Sans Regular'],'text-size':['interpolate',['linear'],['zoom'],l.minzoom,l.size,l.maxzoom,l.size*1.4],'symbol-sort-key':['coalesce',['get','rank'],999]},paint:{'text-color':l.color,'text-opacity':look.labels.visible?look.labels.opacity:0,'text-halo-color':'#222222','text-halo-width':1.8,'text-halo-blur':0.5}});}
  const l=look.labels.levels[3];layers.push({id:'lbl-places',type:'symbol',source:detail?'vec-detail':'vec-world','source-layer':'places',minzoom:l.minzoom,maxzoom:l.maxzoom,layout:{'text-field':['coalesce',['get',`name:${lang}`],['get','name_es'],['get','name']],'text-font':[look.sat.visible?'Noto Sans Medium':'Noto Sans Regular'],'text-size':['interpolate',['linear'],['zoom'],l.minzoom,l.size,l.maxzoom,l.size*1.4],'symbol-sort-key':['coalesce',['get','sort_key'],['-',20,['coalesce',['get','population_rank'],0]]]},filter:['all',['in',['get','kind'],['literal',['locality','neighbourhood','macrohood']]],['>=',['zoom'],['coalesce',['get','min_zoom'],0]],['any',['!=',['get','kind'],'locality'],['>=',['coalesce',['get','population_rank'],0],['step',['zoom'],12,5.5,9,7,8,10,5,13,0]]]],paint:{'text-color':l.color,'text-opacity':look.labels.visible?look.labels.opacity:0,'text-halo-color':'#222222','text-halo-width':1.8,'text-halo-blur':0.5}});
  for (const layer of baseLayers(detail?'vec-detail':'vec-world',namedFlavor('light'),{lang})) if (layer.type==='symbol' && /^roads_labels_/.test(layer.id)) {
    layer.id='lbl-'+layer.id; layer.minzoom=12; layer.paint={...layer.paint,'text-color':'#ffffff','text-halo-color':'#222222','text-halo-width':1.2,'text-opacity':look.labels.visible?look.labels.opacity:0}; layers.push(layer);
  }
  return {version:8,transition:{duration:0,delay:0},glyphs:`${base}cache/fonts/{fontstack}/{range}.pbf`,sprite:`${base}cache/sprites/light`,sources,layers,sky:look.sky,terrain:{source:'dem',exaggeration:look.terrain.exaggeration},projection:normalizeProjection(look.projection,{width})};
}
