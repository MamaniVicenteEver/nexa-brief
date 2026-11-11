// Sincroniza las tarjetas documentales desde sus JSON maestros.
import { readFile, writeFile } from 'node:fs/promises';
const catalogUrl = new URL('components.json', import.meta.url);
const infoUrl = new URL('../info.json', import.meta.url);
const definitions = [
  {name:'personajes.crear-personaje', family:'Personajes', file:'../assets/avatar/crear-personaje.json', summary:'Crear e integrar un personaje compatible con Cara a Cara.'},
  {name:'personajes.crear-expresiones', family:'Personajes', file:'../assets/avatar/crear-expresiones.json', summary:'Crear expresiones por lotes y añadirlas a la biblioteca.'},
  {name:'personajes.cambiar-vestuario', family:'Personajes', file:'../assets/guides/cambiar-vestuario.json', summary:'Crear una variante de vestuario conservando la identidad y las ocho poses.'},
  {name:'escenas.crear-escena', family:'Escenas', file:'../assets/guides/crear-escena.json', summary:'Preparar una comparación nueva con sujetos, planos y medios.'},
  {name:'escenarios.crear-fondo', family:'Escenarios', file:'../assets/guides/crear-fondo.json', summary:'Preparar medios de apoyo y entender los límites actuales de los fondos.'},
];
const guides = await Promise.all(definitions.map(async def => ({...def, demo:JSON.parse(await readFile(new URL(def.file, import.meta.url), 'utf8'))})));
const catalog = JSON.parse(await readFile(catalogUrl, 'utf8'));
const info = JSON.parse(await readFile(infoUrl, 'utf8'));
if (!Array.isArray(catalog.components)) throw new Error('Catálogo inválido');
const tab = info.catalog?.tabs?.find(item => item.id === 'new-componentes');
if (!tab || !Array.isArray(tab.components)) throw new Error('Pestaña New componentes inválida');
const names = new Set(guides.map(item => item.name));
const previous = catalog.components.filter(item => !names.has(item.name));
const lastCharacter = previous.reduce((last,item,index) => item.family === 'Personajes' ? index : last, -1);
const cards = guides.map(({name,family,summary,demo}) => ({name,family,kind:'json',summary,params:{},demo, ...(name === 'personajes.crear-personaje' ? {preview:{bg:'white',kind:'guide',poster:'showcase/personaje-guia.svg'}} : {})}));
previous.splice(lastCharacter + 1, 0, ...cards);
catalog.components = previous;
for (const {name} of guides) if (!tab.components.includes(name)) tab.components.push(name);
await writeFile(catalogUrl, JSON.stringify(catalog, null, 2) + '\n');
await writeFile(infoUrl, JSON.stringify(info, null, 2) + '\n');
console.log(`${cards.length} guías sincronizadas en el catálogo.`);
