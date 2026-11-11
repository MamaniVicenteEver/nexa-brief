// Valores por episodio expresados como parámetros, sin código de dibujo privado.
export function applyComponentDefaults(items, configDefaults={}, sceneDefaults={}) {
  if(!configDefaults&&!sceneDefaults)return items;
  const defaults={};
  const reserved=new Set(['type','id','t','dur','out','fade','persist']);
  for(const source of [configDefaults,sceneDefaults]){
    if(source==null)continue;
    if(typeof source!=='object'||Array.isArray(source))throw Error('componentDefaults debe ser un objeto');
    for(const [type,params] of Object.entries(source)){
      if(!params||typeof params!=='object'||Array.isArray(params))throw Error('componentDefaults debe contener objetos de parámetros');
      for(const key of Object.keys(params))if(reserved.has(key))throw Error(`componentDefaults no puede cambiar ${key}`);
      defaults[type]={...defaults[type],...params};
    }
  }
  if(!Object.keys(defaults).length)return items;
  return items.map(item=>defaults[item.type]?{...defaults[item.type],...item}:item);
}

// Los medios narrativos pertenecen al episodio; la galería usa los medios del diseño.
export function episodeMediaURL(src, context={}) {
  return new URL(src, context.mediaBase || new URL('../../', import.meta.url));
}
