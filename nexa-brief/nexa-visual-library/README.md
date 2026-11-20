# Nexa Visual Library

Paquete privado de recursos visuales compartidos. Indexa SVG de Simple Icons, Lucide y Devicon para que los sistemas de Nexa puedan buscarlos y leerlos localmente. Es una biblioteca de datos y utilidades: **no inicia procesos**, no contiene las plantillas ni reemplaza el motor `rough` de PROTOTIPO.

## Preparar

Requiere Node >= 22.14 y pnpm 11.25.0. Desde esta carpeta:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm build
pnpm test
pnpm run stats
```

El archivo `pnpm-lock.yaml` fija los paquetes instalados. `pnpm build` crea `dist/catalog.json` a partir de los paquetes locales. El índice se escribe de forma atómica y no copia los SVG, que permanecen en el almacén de pnpm. Es necesario conservar las dependencias instaladas para leer los archivos. Para reconstruir en otra máquina se necesita acceso al registro de paquetes o un almacén de pnpm ya preparado; la búsqueda y lectura posteriores funcionan sin Internet.

## Buscar y consultar

```sh
pnpm run search servidor --provider lucide --limit 5
node src/cli.js get brand.simple-icons.github
node src/cli.js svg icon.lucide.server
```

El último comando escribe el SVG en la salida estándar. Las rutas `brand.simple-icons.*`, `icon.lucide.*` y `tech.devicon.*` son ID de recursos, no componentes de `rough`. Los nombres de bocetos `rough.sketch.*` y sus claves de motor siguen perteneciendo a PROTOTIPO.

Consulta desde JavaScript:

```js
import { loadCatalog, searchCatalog, readSvg } from './src/index.js';
const catalog = await loadCatalog();
const page = searchCatalog(catalog, { query: 'servidor', provider: 'lucide', limit: 20 });
const svg = await readSvg(catalog, page.items[0].id);
```

También se puede consultar desde Python agregando `nexa-visual-library/src` al `PYTHONPATH` e importando `load_catalog`, `search_catalog` y `read_svg` de `visual_library`. Ambos adaptadores leen los archivos locales sin proceso adicional.

La búsqueda acepta `query`, `provider`, `category`, `offset` y `limit` (máximo 100). Cada ficha contiene ID, etiqueta, proveedor, categoría, etiquetas, fuente, licencia y guía de marca cuando el proveedor las informa. `license: null` significa que este catálogo no dispone de una licencia individual; no significa que el recurso esté libre de restricciones.

## Integración con Nexa

El catálogo y las utilidades están listos para consumirse localmente desde Node o Python. Para ofrecerlos a Showcase y las plantillas hace falta integrar una ruta controlada en el servidor existente y un adaptador para cada motor. Esas integraciones **todavía no están activadas**: no se añadió un servicio, puerto, contenedor ni dependencia a las plantillas existentes. Evitar servir `node_modules` directamente y preservar los nombres y capturas que usan los diseños actuales.

## Actualización y licencias

Actualizar un paquete con pnpm es un cambio intencional: fijar versión, revisar el lockfile, regenerar el catálogo y comprobar compatibilidad antes de distribuirlo. No actualizar automáticamente durante la reproducción. Las marcas pueden tener condiciones propias; consultar la fuente y licencia del recurso. Avisos: `node_modules/simple-icons/DISCLAIMER.md`, `node_modules/lucide-static/LICENSE`, `node_modules/devicon/LICENSE`.
