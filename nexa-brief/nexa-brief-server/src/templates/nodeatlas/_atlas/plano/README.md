# Atlas plano · renderizador compartido

Entrada ES: `plano.js`, después de cargar `sandbox/_proto/proto.js`. Registra `Proto.run({name:'atlas-plano'})`. Desde un episodio hermano, cargar `../_atlas/plano/plano.js`; los datos siguen en `assets/scene.json` y `assets/config.json` del episodio. El banco de prueba candidato está en `../../atlas-en-movimiento/work/bench/index.new.html?base=plano&controls=1`.

`paths.js` ancla Atlas en `../`, looks en `../looks/` y Proto en `sandbox/_proto/`. `plano.js` importa la biblioteca táctica desde `../../_tactico/core.js`. No cambia cámara, geografía, proveedores, caché ni los ganchos por muestra.

Para reutilizar el portaaviones, añadir items `naval.carrier` y sus acciones a la escena del episodio, sin editar el motor; ver `../../_tactico/PORTAAVIONES.md`. Los sprites se resuelven desde `_tactico/sprites/`. Las fuentes tácticas propias están en `_tactico/assets/fonts/`.

## Escena

Reutiliza las keys de cámara de Atlas (`t`, `dur`, `center`/`focus`, `zoom`/`span`, `bearing`, `arc`, `drift`, anclas). `pitch` se ignora. Duración por `duration` o `end`. Intro, cierre y subtítulos son optativos por Proto.

```json
{
  "duration": 25,
  "planoLook": "tactico",
  "tiles": {"provider": "gibs-bluemarble", "manifest": "cache-inventory.json"},
  "motionBlur": {"mode": "affine", "samples": 4, "fps": 30, "shutter": 0.5, "thresholdPx": 2},
  "camera": [{"t": 0, "center": [56.5, 26.55], "zoom": 7}],
  "layers": [{"type": "highlight", "region": "IR", "t": 0, "border": true,
    "style": {"fill": "#339649", "opacity": 0.8, "line": "#f1efaa", "width": 1.2}}]
}
```

`motionBlur:false` desactiva las muestras adicionales. Si se omite, se usan los valores del ejemplo. El umbral es el desplazamiento máximo, en píxeles de salida, de las cuatro esquinas y el centro durante el shutter. Las muestras son posiciones absolutas entre `max(0,t-shutter/fps)` y `t`, incluyendo ambos extremos. No dependen del cuadro anterior. En reposo se dibuja una sola vez y no se asignan ni copian buffers de desenfoque.

`motionBlur.mode:"exact"` vuelve a dibujar el mapa en cada una de las cuatro poses. El modo predeterminado `"affine"` compone el mapa una vez a la pose final, con un margen que contiene las cuatro esquinas de **todas** las muestras. Reproyecta ese bitmap con traslación, escala y rotación; conserva los mismos tiempos, cuatro muestras y resolución. No usa historia de cuadros ni reduce muestras por velocidad. Las fronteras y la mezcla de niveles corresponden a la pose final durante ese shutter: es una aproximación, con PSNR/SSIM y comparación visual documentados en `../../atlas-en-movimiento/work/results/plano-rendimiento.md`.

Si un territorio aparece/desaparece durante el shutter, o el bitmap ampliado supera dos veces el área de salida o 8192 px por lado, se usa automáticamente el modo exacto. Esto evita congelar fades y reservar superficies enormes en cortes de cámara. La preparación incluye también el margen afín. `blurMode` indica el camino elegido (`single`, `affine`, `exact`).

Los ganchos de `../../_tactico/CONTRATO.md` §2 se conservan: `expandScene` precede a la cámara; `create` precede al barrido; **`c.tactico.draw` se llama en cada muestra**, con transformación de pantalla y su tiempo absoluto. Los items tácticos no se aplanan en el bitmap afín. `c.tactico.key(t)` sigue dentro de `stillKey`; las animaciones invalidan el reposo.

`tiles.manifest` es opcional y relativo a la página. Formato: `{"provider":"gibs-bluemarble","keys":["0/0/0", ...]}`. Es un inventario de caché, no una lista de teselas que pueda omitir faltantes: el barrido calcula independientemente lo necesario y los ausentes siguen en `missingTiles()`. Sin inventario se consultan las rutas locales durante la precarga. No hay acceso upstream ni cargas en `render`.

Se aceptan `highlight`, `territory.fill` y `fill` para los rellenos de esta base. Los items de otras familias se delegan a la biblioteca táctica mediante `scene.items`. Regiones por ID, ISO3 o nombres de admin0; `style` admite el objeto del ejemplo. `out` inicia un fade de duración `dur`. Las fronteras usan los Path2D originales, sin simplificar ni reducir el detalle. El tinte oceánico se recorta con esos polígonos al preparar cada tesela; no inventa batimetría.

## Proyección y teselas

`view.mercatorToScreen` es `[a,b,c,d,e,f]`, usable con `ctx.setTransform(...matrix)`. Las coordenadas Mercator están normalizadas en `[0,1]`: x crece al este, y al sur. Mundo de `512 * 2**zoom` píxeles, igual que MapLibre. Bearing positivo gira el mapa en sentido antihorario. Un solo mundo, sin repetición horizontal, como el Atlas actual. Clipping polar de Web Mercator.

`view` incluye `W,H,zoom,bearing,pitch:0,project(lon,lat) → {x,y,visible,k}`, además de `screenToMercator`, `bounds`, `center` y `scale`. Igual que Atlas, `visible` expresa validez/oclusión, no estar dentro del viewport; `k` conserva la aproximación local corregida por latitud y limitada a 0.35–1.5.

Teselas de 256 px frente al mundo MapLibre de 512: nivel nativo `zoom+1`. El mip base es `floor(zoom+1)` y, en el último 25 % del intervalo, se mezcla suavemente con el siguiente. Al llegar al entero, la capa que ya tenía alfa 1 pasa a ser base; no hay corte. Los niveles se limitan al máximo del proveedor. Si falta una tesela, se recorta exactamente el ancestro cargado más cercano. La capa superior se compone como un grupo para evitar duplicar alfa en las juntas.

Cada tesela conserva un `ImageBitmap` ya graduado y teñido; el `ImageBitmap` original se cierra después de prepararlo. El look continúa aplicándose antes del muestreo, sin perder píxeles ni volver a ejecutar su filtro en cada dibujo. No hay mosaico global ni rasterización de fronteras por zoom en la versión elegida: conserva Path2D, espesores de pantalla y las tres mezclas de territorios.

## Preparación y diagnóstico

Antes de entregar el control a Proto se barren las poses a 30 fps o al fps del shutter si es mayor, incluyendo las muestras subcuadro. Se precargan teselas, todos sus ancestros y Path2D. `__atlas.sweep(step)` repite la planificación y carga; no usa un paso mayor a 1/30 s. `await __atlas.ready` asegura esa preparación. Tras redimensionar, `__promo.prepare/seek` espera la nueva cobertura.

`__atlas.missingTiles()` y `__promo.missingTiles()` devuelven los archivos ausentes y regiones no encontradas. Un respaldo visible **no** vacía los faltantes. `__atlas.stats()` informa `planned`, `loaded`, `failed`, `unplanned`, `loads`, `fallbackDraws`, `paths`, `blurSamples`, `renderMs`, `preloadMs`. `__atlas.view(t)` devuelve la vista. `__atlas.fps()` es tiempo JS de los últimos 120 dibujos: para coste total usar el benchmark, que fuerza lectura de píxeles.

La precarga de una ventana discreta no prueba cobertura para cualquier movimiento externo ni cualquier tiempo real fuera de la escena. Una tesela no planificada se registra como `unplanned`; no se descarga durante un cuadro. Las cachés compartidas de esta entrega son de solo lectura y los faltantes impiden certificar la grabación.

Las tomas sin cambios visibles reutilizan únicamente el último bitmap del mapa. La clave incluye tamaño, pose, alfa temporal de cada territorio, look y cantidad de teselas cargadas. Si cualquiera cambia se vuelve a dibujar. Intro, subtítulos y ventanas de Proto quedan fuera de esa caché. El benchmark compara los hashes de los 751 cuadros antes/después de esta optimización; no reduce geometría, resolución ni muestras.

## Medición y promoción

`stats().phases` separa `tiles`, `territories`, `blur`, `look` y `present`. Son tiempos de envío de comandos Canvas2D: parte del trabajo diferido se cobra en la siguiente copia. Para atribuir costes, el banco ofrece `--phase-flush`, que fuerza una lectura de un píxel tras cada fase; **esa corrida diagnóstica no mide el rendimiento normal**. `frameMs` siempre incluye `seek` y lectura RGBA completa. Las métricas y la receta reproducible están en `../../atlas-en-movimiento/work/bench/README.md`.

El motor está copiado en su ubicación definitiva. El prototipo conserva `engine/` y la entrada local: la API del servidor debe añadir `_tactico` a `SANDBOX_SHARED_DIRS` antes de conmutar. El parche propuesto y todas las verificaciones están en `../../atlas-en-movimiento/work/results/promover-motor.md`.

La comparación de ocho instantes da píxeles idénticos. Hay 58 teselas ausentes tanto con el motor original como con el nuevo; esta promoción no modifica cachés ni certifica la grabación. Para cerrar: aplicar la autorización de API, repetir los GET y la galería por API, y solo entonces sustituir las entradas por sus candidatas. No borrar `engine/` sin aprobación del usuario.
