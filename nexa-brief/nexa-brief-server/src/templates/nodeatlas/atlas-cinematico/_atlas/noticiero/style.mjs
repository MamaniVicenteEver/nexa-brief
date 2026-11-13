const forbidden = new Set(['__proto__','prototype','constructor']);
export function merge(base, patch = {}) {
  const out=structuredClone(base);
  for(const [key,value] of Object.entries(patch)) {
    if(forbidden.has(key))throw Error('Clave de estilo inválida');
    out[key]=value&&typeof value==='object'&&!Array.isArray(value)&&out[key]&&typeof out[key]==='object'&&!Array.isArray(out[key])?merge(out[key],value):structuredClone(value);
  }
  return out;
}
export function resolveStyle(raw, overrides={}, format='escritorio') {
  if(!['movil','escritorio'].includes(format))throw Error('Formato de noticias inválido');
  const result=merge(raw,overrides);
  const resolved=merge(result,result.formatos?.[format]||{});delete resolved.formatos;return resolved;
}
export async function applyNewsStyle(c, base, query=new URLSearchParams(location.search)) {
  const id=query.get('estilo')||c.scene.estilo||c.C.estilo||((c.scene.hud||[]).some(i=>['alert','headline','key-figure','date-card','message'].includes(i.type))?'dynamic-news':null);
  if(!id)return null;
  // Other Atlas users keep their own style namespace; only declared news styles opt in.
  const root=new URL('noticiero/estilos/',base);
  const listing=await fetch(new URL('index.json',root)).then(r=>{if(!r.ok)throw Error('Índice de noticias ausente');return r.json();});
  if(!listing.estilos.some(s=>s.id===id))throw Error('Estilo de noticias desconocido: '+id);
  const raw=await fetch(new URL(encodeURIComponent(id)+'.json',root)).then(r=>{if(!r.ok)throw Error('Estilo de noticias ausente');return r.json();});
  if(raw.id!==id)throw Error('Identidad del estilo incoherente');
  const revision=c.scene.estiloRevision??c.C.estiloRevision;
  if(revision!=null&&revision!==raw.revision)throw Error('Revisión de noticias incompatible');
  const format=c.st.H>c.st.W?'movil':'escritorio';
  const style=resolveStyle(raw,merge(c.C.estiloOverrides||{},c.scene.estiloOverrides||{}),format);
  c.scene.estilo=id;c.scene.estiloRevision=raw.revision;c.newsStyle=style;c.newsStyleBase=merge(raw,merge(c.C.estiloOverrides||{},c.scene.estiloOverrides||{}));
  if(style.enabled){
    c.scene.captions=merge(c.scene.captions||{},style.captions||{});
    c.scene.lookOverrides=merge(c.scene.lookOverrides||{},style.map||{});
    for(const layer of c.scene.layers||[])if(layer.type==='highlight'&&typeof layer.style!=='object'){
      const hatch=String(layer.style).includes('hatch'),red=String(layer.style).includes('red');
      const color=red?style.colors.alert:hatch?style.colors.important:style.colors.secondary;
      layer.style={fill:color,line:color,opacity:.3,width:2.2,...(hatch?{hatch:color,hatchOpacity:.7}:{})};
    }
    await document.fonts.load(`${style.fonts.weight} 40px '${style.fonts.family}'`);
    await document.fonts.load(`${style.fonts.strong} 40px '${style.fonts.family}'`);
  }
  window.__nexaStyle={id,revision:raw.revision,format};return style;
}
