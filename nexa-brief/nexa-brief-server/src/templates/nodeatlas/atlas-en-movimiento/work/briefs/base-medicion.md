# Brief de trabajo · base-medicion (Astra xhigh)

## Objetivo
Construir el renderizador **Atlas plano** (mapa satelital cenital 2D sobre la caché de teselas de Atlas) y medir
contra la base Atlas 3D, para confirmar la decisión de `PLAN.md` §1. Es la base de toda la biblioteca: calidad,
fluidez de cámara y determinismo son prioridad 1.

## Contexto mínimo a leer
- `sandbox/nodehistory/atlas-en-movimiento/PLAN.md` (entero) y `REFERENCIAS.md` §«Lenguaje común».
- Imágenes: `atlas-en-movimiento/work/ref/ref5-detalle-c.jpg`, `ref5-camara-26-30s.jpg`, `ref1-detalle.jpg`.
- `sandbox/nodehistory/_atlas/`: `ESCENA.md`, `OVERLAYS.md`, `camera.js` (NO modificar), `providers.json`,
  `atlas.js` (cómo se enlaza con Proto y cómo arma `view`), `cache/` (estructura), `data/geo/SOURCES.md`.
- `sandbox/_proto/proto.js`: `Proto.run`, `render`, `prepare`, `window.__promo`, `st`, `size()`.
- `sandbox/nodehistory/_mapas/layers.js`: cómo se hace el relleno con mezcla (multiply + screen + overlay).

## Archivos que puede tocar
- Tu sandbox de escritura es SOLO la carpeta del prototipo (`atlas-en-movimiento/`), `/tmp` y las cachés.
  Por eso el motor se construye DENTRO del prototipo y se mueve a `_atlas/plano/` recién cuando el usuario
  apruebe la decisión (lo hace Claude):
  - Crear `atlas-en-movimiento/engine/plano/` (módulos ES) y `atlas-en-movimiento/engine/looks/tactico.json`.
  - Importar desde `../../_atlas/` (lectura) `camera.js`, `data/geo`, `cache/` con rutas relativas; escribí las
    rutas en un solo lugar (p. ej. `engine/plano/paths.js`) para que mover la carpeta sea cambiar una línea.
- Crear `atlas-en-movimiento/work/bench/` (escenas de prueba, scripts, capturas, informe).
- `_atlas/cache/` y `providers.json` son de solo lectura para vos: usá `gibs-bluemarble` (y las teselas ya
  cacheadas). Si conviene un proveedor de batimetría, dejá en el RESULT el comando `_tools/atlas/atlas.py`
  exacto y la entrada de `providers.json` (licencia, `commercial_ok`) para que Claude lo agregue.
- NO tocar nada fuera del prototipo: `camera.js`, `camera.test.js`, `atlas.js`, `style.js`, `overlays.js`,
  atlas-cinematico, bolivia-mar, `_mapas`, `_proto/proto.js`. Si necesitás un gancho, proponelo en el RESULT
  con el diff exacto.

## Entregable exacto
1. `engine/plano/plano.js` (entrada: `Proto.run({name:"atlas-plano",...})`) + `tiles.js` + `view.js` + `blur.js`:
   - Mercator cenital: pose `{lon,lat,zoom,bearing}` de `camera.js` (pitch ignorado); matriz afín Mercator→pantalla;
     dibuja las teselas del nivel entero más cercano por encima (interpolación de escala entre niveles sin saltos:
     transición cruzada de nivel z→z+1 en el último 25 % del rango); fallback a nivel inferior ya cargado si falta una.
   - Look `tactico` (gradación por canvas: saturación, contraste, tinte océano, viñeta); fronteras admin0 desde
     `data/geo` como `Path2D` en coordenadas Mercator cacheadas una vez, dibujadas con `setTransform`.
   - `view` igual que en `atlas.js` (`W,H,zoom,bearing,pitch:0,project→{x,y,visible,k}`) + `mercatorToScreen`.
   - Desenfoque de movimiento opcional (`scene.motionBlur`, por defecto activado con umbral): N muestras
     sub-cuadro de la pose entre t−Δ y t cuando la velocidad en pantalla supera el umbral; 0 coste en tomas quietas.
   - Precarga: barrido de toda la cámara antes de reproducir (teselas + Path2D), `missingTiles()`.
2. `atlas-en-movimiento/work/bench/scene-bench.json` (25 s, 1080×1920): mundo → Golfo Pérsico → Ormuz
   (zoom 7) con un vuelo largo, un giro y un acercamiento rápido tipo ref5 0:26.5–0:29; 2 países con relleno.
3. Mismo tramo en Atlas 3D (look raster sin relieve, pitch 0) para comparar.
4. `work/bench/bench.py` (Playwright, flags swiftshader del smoke de Atlas): seek a cada cuadro de 0–25 s,
   mide ms/cuadro (media, p95, máx) por base; verifica seek fuera de orden idéntico (hash de píxeles en 5 instantes);
   guarda hoja de 12 capturas por base y una tira de 10 fps del vuelo largo. Nada de MP4.
5. `work/results/base-medicion.md`: números, capturas, decisión recomendada, problemas y lo no verificado.

## Cómo verificar
- `node --check` de cada módulo; `cd _atlas && node --test test/ camera.test.js` sigue verde.
- `bench.py` corre en el servidor (si Chromium no abre dentro del sandbox de Codex, dejar el comando listo y decirlo).
- Objetivos: Atlas plano ≤ 150 ms/cuadro en SwiftShader a 1080×1920; sin saltos de nivel de tesela visibles en la tira.

## Prohibido
- Escribir fuera de lo autorizado; grabar video; reiniciar servicios; editar `.py` bajo `src/` (uvicorn recarga).
