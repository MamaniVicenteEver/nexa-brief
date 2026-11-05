# Brief · catalogo-showcase (Sol 6.1 high)

## Objetivo
La página `/showcase` («Biblioteca de componentes») muestra hoy, para un prototipo del Sandbox, una tarjeta por cada componente declarado en
`info.json → components` (máx. 16, pensado para variantes como outro v1/v2). Para `atlas-en-movimiento` eso no sirve: la biblioteca táctica
tiene **68 componentes** (`engine/tactico/components.json`) y además los **sprites de Blender** (`engine/tactico/sprites/sprites.json`, aún en
construcción en otra tarea). Hay que **adaptar el Showcase** para mostrar ese catálogo completo y poder **renderizar cada componente en vivo**.

## Restricciones críticas
- **NO edites ningún `.py` ni nada bajo `nexa-brief-server/src/`**: uvicorn corre con `--reload` y se reiniciaría, cortando producciones y grabaciones.
  El backend YA sirve por `GET /api/v1/explainer/files/<ruta>` el JSON, el HTML y las imágenes del prototipo (comprobado: 200 para
  `.../engine/tactico/components.json`, `.../work/tactico/demo.html`, JPG). Todo el cambio es **frontend** + datos del prototipo.
- Escribir SOLO en: `nexa-brief-web/src/features/showcase/**` (componentes, lib, tests), `info.json` del prototipo (añadir la clave `catalog`),
  `work/tactico/demo.html` del prototipo, `work/results/catalogo-showcase.md`. Nada más. Sin emojis. Sin dependencias nuevas.
- Ritmo: el servidor se comparte y hay un benchmark corriendo. Tests con `nice -n 19`, UN archivo de test a la vez; **sin Chromium/Playwright**
  (yo hago la comprobación visual en el navegador después). Next dev usa recarga en caliente: no reinicies el servidor web.
- Mira `nexa-brief-web/src/features/showcase/components/SandboxShowcase.tsx` y su test `__tests__/sandbox-showcase.test.tsx` antes de tocar nada;
  el comportamiento actual (tarjeta «Prototipo completo» y tarjetas de `components` con `requestComponentPreviews`) NO debe romperse.

## Diseño
1. **Declaración en `info.json`** (nueva clave opcional, ignorada por el backend):
   ```json
   "catalog": {
     "components": "engine/tactico/components.json",
     "sprites": "engine/tactico/sprites/sprites.json",
     "spritesDir": "engine/tactico/sprites/",
     "sheet": "engine/tactico/sprites/hoja.png",
     "gallery": "work/tactico/demo.html"
   }
   ```
   Verifica con curl que el endpoint `GET /api/v1/explainer/sandbox/nodehistory/atlas-en-movimiento/info` (o el listado) sigue respondiendo bien tras añadir la clave
   (si la validación del backend rechazara claves extra, repórtalo en el RESULT y mueve la declaración a otro lugar permitido, p. ej. un archivo
   `catalog.json` junto a `info.json`, que el Showcase pide por el endpoint de archivos).
2. **Frontend**: en `SandboxShowcase` agrega pestañas «Prototipo · Biblioteca (N) · Sprites (M)» (solo si el prototipo declara `catalog`; si no, igual que hoy).
   - Obtén `catalog` leyendo `info.json` por el endpoint de archivos (`resolveApiUrl('/api/v1/explainer/files/<prototype.path>/info.json')`).
   - **Biblioteca**: tarjeta por componente con nombre, `summary`, capa, familia (prefijo antes del punto), `states`, tabla de `params` (tipo, default, doc) y `used_by`;
     filtro por familia (chips), búsqueda por texto, contador. Botón «Reproducir» → iframe con
     `<gallery>?only=<componente>&loop=1&bare=1&aspect=<9x16|16x9>` (mismo patrón que hoy: máximo 2 iframes activos a la vez, `slice(-2)`).
     El formato 9:16 / 16:9 de la barra del Showcase se respeta.
   - **Sprites**: rejilla con cada sprite (`sprites.json`: archivo, `variant`, eslora relativa, estados) sobre fondo cuadriculado o de océano oscuro,
     imágenes por el endpoint de archivos (`spritesDir`), más la hoja completa (`sheet`) ampliable. Si `sprites.json` aún no existe o responde 404, muestra
     «Sprites en construcción» sin romper la página.
   - Estados vacíos y errores de red con mensajes en español; carga perezosa; accesibilidad básica (roles, alt, foco).
3. **`work/tactico/demo.html`** (galería del motor): añade parámetros de URL `only=<nombre>` (muestra SOLO el demo de ese componente, resolviendo sus
   dependencias como ya hace con `debug.label`), `loop=1` (repite en bucle sin controles), `bare=1` (sin selector ni barras: solo el lienzo a pantalla
   completa) y `aspect=9x16|16x9`. Debe seguir funcionando igual sin esos parámetros. La galería es servida por el endpoint de archivos desde
   `src/templates/`, así que las rutas relativas deben resolver también allí (comprueba con curl que sus módulos/recursos cargan con 200 por ese camino).
4. **Pruebas**: amplía `sandbox-showcase.test.tsx` (vitest): pestañas, filtros, estado vacío de sprites, no regresión del caso sin `catalog`. Corre solo ese archivo
   (`nice -n 19`), más `tsc --noEmit` si ya está configurado y es rápido; informa el resultado.

## Entregable
Cambios en los archivos permitidos + `work/results/catalogo-showcase.md` con: qué se cambió, cómo se declara `catalog`, URLs de prueba (curl 200),
resultados de tests, y lo NO verificado (la verificación visual en el navegador la hará Claude).
