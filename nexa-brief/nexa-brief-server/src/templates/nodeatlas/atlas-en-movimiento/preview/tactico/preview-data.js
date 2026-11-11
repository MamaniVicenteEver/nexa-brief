// Un ejemplo cambia datos de un componente; no registra otro tipo por episodio.
export function previewItem(definition, raw) {
  if (!definition?.demo) throw Error('Componente sin demostración');
  const item=structuredClone(definition.demo);
  if(raw==null)return item;
  const params=JSON.parse(raw);
  if(!params||typeof params!=='object'||Array.isArray(params))throw Error('Los parámetros de la demostración deben ser un objeto JSON');
  const allowed=new Set([...Object.keys(definition.params||{}),'id','t','dur','out','fade','note']);
  for(const key of Object.keys(params))if(!allowed.has(key))throw Error(`Parámetro no declarado: ${key}`);
  return {...item,...params,type:definition.name};
}
