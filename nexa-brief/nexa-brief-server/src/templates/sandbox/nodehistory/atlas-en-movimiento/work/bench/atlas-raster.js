import {atlasURL} from '../../engine/plano/paths.js';

// Adaptador exclusivo del benchmark: Atlas no tiene terrain.enabled y con
// exaggeration:0 sigue construyendo/pidiendo el DEM. El caso pedido es raster
// SIN relieve. No se cambia ningún archivo del motor ni su salida en otras páginas.
const maplibre=await import(atlasURL('vendor/maplibre-gl.mjs'));
const setTerrain=maplibre.Map.prototype.setTerrain;
maplibre.Map.prototype.setTerrain=function(terrain){
  if(terrain?.exaggeration===0){
    if(this.getTerrain())return setTerrain.call(this,null);
    return this;
  }
  return setTerrain.call(this,terrain);
};
const run=Proto.run;
Proto.run=options=>{
  const setup=options.setup;
  options.setup=async c=>{
    await setup(c);
    c.map.setTerrain(null);
    // Opacity 0 no evita pedir geometría vectorial. No hay etiquetas en esta prueba.
    for(const layer of c.map.getStyle().layers){
      if(layer.id.startsWith('lbl-')||layer.id==='shade-terrain'||layer.id==='brd-1'||layer.id==='brd-2')
        c.map.setLayoutProperty(layer.id,'visibility','none');
    }
  };
  return run(options);
};
await import(atlasURL('atlas.js'));
