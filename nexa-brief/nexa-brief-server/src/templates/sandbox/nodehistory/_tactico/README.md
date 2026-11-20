# Biblioteca táctica compartida

ES modules sin dependencias nuevas. `core.js` exporta `Tactico`, `expandScene(scene,{T})`, `create(c,scene)`, `validateScene` y `loadComponents`. El registro también está en `window.Tactico`. Atlas plano ya llama expansión, preparación, dibujo y clave de caché. No hay reproducción de audio ni render MP4 en este núcleo.

## Añadir un componente en diez líneas

1. Crear `components/mi-familia.js`; importar `{Tactico}` desde `../core.js`.
2. Registrar `Tactico.component('familia.tipo', {layer:40, summary:'…', …})`.
3. Declarar `params` con `type`, `default`, `required`, `values`, `min` y `max` cuando corresponda.
4. Declarar `states:['normal','hit']` y `validate(item,ctx)` devolviendo mensajes o diagnósticos.
5. `prepare(item,ctx)` puede ser async; devuelve `internal` y precarga todos sus recursos.
6. `draw(g,s,view,env)` dibuja desde `s.t`; `s.pos` es `{lon,lat,heading,u}` o `null`.
7. Usar `env.U`, `env.palette`, `env.rng(seed)` y `view.project`; el núcleo ya aplica `s.alpha` al contexto.
8. Añadir `demo:{type:'familia.tipo',at:[56.4,26.4],t:0,dur:9,…}` y `sfx(item,ctx)` si necesita cues.
9. Ejecutar `node ../_tactico/tools/catalog.mjs`; la galería descubre el archivo mediante `components.json`.
10. Abrir `work/tactico/demo.new.html?component=familia.tipo`, o `?items=mi-familia.json` (archivo relativo a la galería).

Los imports del componente no deben requerir DOM al evaluar el módulo: el catálogo y el validador también corren en Node. El catálogo descubre todos los `.js` de `components/`, incluidos helpers con registros. No registrar dos veces el mismo nombre. Cada cambio de archivo requiere recargar la página.

## Tiempo, estados y caché

`T(valor,fallback)` sigue Proto: números o `@palabra#2:end+0.4`. Pasar `NaN` como fallback permite detectar anclas inexistentes. Los tiempos de `path`, `states`, `actions` y `sound.cues` también se resuelven antes de `prepare`; los objetos originales no se modifican. `expandScene` solo modifica `scene.camera`, es determinista e idempotente.

Un item aparece en `t`, entra durante `fade` (0,35 s por defecto), mantiene su aspecto durante `dur` y sale desde `out` durante el mismo `fade`. Si no hay `out`, vale `t+dur`; si no hay ninguno se mantiene hasta `scene.duration`/`end`, con la salida dentro de ese intervalo. Sin fin declarado ni `dur`/`out`, el item permanece activo. `dur` incluye la entrada, no la cola de salida. `fade:0` permite cortes. El intervalo final es abierto. `u=clamp((t-inicio)/dur)`; `lt=t-inicio`. `duration` incluye colas finitas, finales de rutas (también por `speed`), cambios de estado y cues. Capas y `z` se ordenan de menor a mayor, con desempate estable por orden de escena.

`item.state` fija el estado inicial; por defecto se usa el primero del componente. `s.state` es el destino, `s.fromState` el estado previo, `s.stateT` la interpolación easing y `s.stateWeights` la mezcla continua de todos los estados. `states[].dur` vale 0,35 s si se omite. Las transiciones interrumpidas conservan la mezcla en el instante de interrupción; los pesos se limitan a 0–1 también con `spring`. No modificar `s.item` (congelado), ni depender del dibujo anterior. `internal` pertenece al componente: las tablas deben ser inmutables; las cachés solo pueden guardar resultados puros.

Por defecto un componente se considera animado. Declarar `animated:false`, o `animated:s=>…`, para reutilizar bitmaps en reposo: posición, progreso de ruta, rumbo, alfa y mezcla de estados siempre entran en `key(t)`. Una animación interna añade `t` cuantizado a nanosegundos. Opcionalmente `key(s,ctx)` reemplaza ese reloj por una clave propia (escalar u objeto JSON pequeño); debe cubrir toda animación interna. No serializar escenas completas en esa función. Sin items visibles la clave siempre es `tactico:idle` y no se toca el canvas.

## Utilidades y sprites

`util.js`: `easing.{inOut,out,in,linear,spring}`, `ease(name,u)`, `clamp`, `lerp`, `smoothstep(a,b,x)`, `rng(seed)` (mulberry32), `mercator(lon,lat)` normalizado y `unmercator`, `headingBetween(a,b)` y `pathAt(path,t)`. Rumbos: norte 0°, este 90°; cruces de antimeridiano toman el camino corto. Las curvas se calculan en Mercator, con longitud tabulada y caché por objeto inmutable. `curve` admite `line`, `arc` (curvatura `bend`, 0,16 por defecto) y `smooth` (Catmull-Rom). `path.speed`, si no hay `dur`, significa km Mercator/segundo, no velocidad náutica geodésica.

Dibujo: `stroke(g,path,opts)`, `fill(g,path,opts)` aceptan `null` para la trayectoria actual; opciones `color`, `outline`, `width` y `outlineWidth` donde corresponda. `textOutlined(g,txt,x,y,opts)`, `shadowDraw(g,draw,opts)`, `chip(g,txt,x,y,opts)` y `bezierArrow(g,points,opts)` (3/4 puntos; `u` recorta la curva con De Casteljau).

En `prepare`, `await ctx.loadSprites()` lee `sprites/sprites.json` (o `scene.spriteManifest`). No se descarga ni decodifica nada en `draw`. Si no se usa ningún sprite no se consulta ese archivo opcional. Esquema: `{"sprites":{"nombre":{"src":"archivo.png","mask":"mascara.png","family":"hull|deck|wings","relativeLength":1}}}`; `mask` es opcional. También se admite un array con `name`/`id` y `file` como alias de `src`. Las rutas son relativas al manifiesto; un `scene.spriteManifest` string es relativo a la página (`c.base` lo puede sobreescribir), y en CLI es relativo al JSON de escena. Para otras ubicaciones usar URL absoluta. `env.sprite(name)` devuelve `{available,family,relativeLength,draw}` y los metadatos originales; `env.drawSprite(g,name,x,y,opts)` es equivalente. Opciones: `heading,length,state,shadow,shadowOffset,shadowAlpha,color`. Proa arriba en el PNG, heading horario en pantalla: el componente debe incorporar el bearing de la cámara. No se redondean coordenadas. Máscara de sombra y tintes por estado se preparan una sola vez. Sin manifiesto/imagen hay siluetas de casco, cubierta o alas. `missing()` conserva errores de precarga aunque se vea el respaldo.

El cargador también consume el formato del generador local: `length_relative` se expone como `relativeLength`; `length_pixels` mide la longitud longitudinal y `anchor` el pivote normalizado. `length` al dibujar es esa longitud deseada en pantalla: el componente aplica antes `relativeLength` si comparte escala con otros. `family:carrier|air|cargo|warship|submarine` selecciona la reserva correspondiente. `states:{burning:'nombre-burning'}` elige el PNG de estado si está cargado; de otro modo usa un tinte preparado. Las imágenes se decodifican de a una.

`env` también ofrece `W,H,zoom,k,font(name),flag(code),debug`; `font` usa `scene.defs.fonts` o el proveedor del contexto; `flag` delega al proveedor del contexto y puede devolver `null`. Declarar/cargar las fuentes y banderas propias antes de dibujar. La paleta combina look y `scene.defs.palette`.

## Cámara, sonido y validación

`follow:id` genera keys cada ≤0,25 s en el intervalo `t…t+dur`, con filtrado simétrico de 0,30 s y adelanto de 0,08 s; no prolonga la ruta. Las velocidades de salida Mercator se entregan a Hermite de Atlas; el último punto detiene la deriva. Puede abrir una escena; una orden posterior cancela sus muestras futuras. `zoomThrough:{to,zoom,spin}` produce un acercamiento con `ease:out`, giro relativo y sin arco de alejamiento. `focus:id|lugar` resuelve el centro; el foco a unidad conserva el zoom previo y los `focus` regionales ordinarios quedan para Atlas. `reframe:[ids|lugares|coordenadas]` calcula bbox en Mercator con `pad` (0,2), considerando bearing, y reemplaza un zoom explícito. Por defecto encuadra conservadoramente para 16:9 y 9:16; pasar `width,height` a `expandScene` permite un ajuste más cerrado. Las macros deben referir lugares declarados en `scene.places`; las keys regionales ordinarias siguen usando `geo` de Atlas.

`sfx()` devuelve cues ordenados, con tiempos numéricos; no dispara sonido en cada cuadro. `item.sfx:false` los apaga, un string/lista reemplaza los derivados por `def.sfx`; `sound.cues` se agrega al plan. Cada cue: `{sfx,at,dur,gain_db?,fade_in?,fade_out?,item?}`. Mezcla y WebAudio corresponden a la tarea sonido.

```sh
node --test ../_tactico/test/
node ../_tactico/tools/validate.mjs work/tactico/scene-core.json
node ../_tactico/tools/validate.mjs escena.json --lyrics letra.json --json
node ../_tactico/tools/catalog.mjs
```

La CLI usa Natural Earth `../_atlas/data/geo/admin0.geojson` y comprueba segmentos contra bordes y áreas (incluidos huecos y antimeridiano); informa segmento, coordenadas, país y sugerencia de añadir waypoints por agua. `ctx.land` transmite ese mismo índice al validador y a `prepare`. Las curvas usan una polilínea de comprobación: no es un sistema de navegación ni resuelve automáticamente pasos costeros. Los sprites faltantes generan avisos con silueta de reserva. Un error produce código 1. La galería sirve por HTTP desde `src/templates/`; su `config.json` no usa voz ni cuotas. Un demo referenciado por `at` o `path.via` se incluye automáticamente si otro registro declara ese id. La fuente `work/tactico/check.py.txt` se copia a `/tmp` para ejecutarla sin activar el reload de uvicorn. Ejecutar con `nice -n 15`, una sola página/Chromium a la vez; el script cierra el navegador incluso si falla una aserción. `check-result.json.ok` verifica el núcleo; `tilesComplete` y las listas `missingTiles*` informan por separado la integridad de la caché compartida, que no se modifica.


## Ubicación definitiva y reutilización

La biblioteca vive en `sandbox/nodehistory/_tactico/`; Atlas plano en `../_atlas/plano/` y el look en `../_atlas/looks/tactico.json`. Los comandos anteriores se ejecutan desde el episodio `../atlas-en-movimiento/`. Desde esta carpeta: `node --test test/`.

Un episodio hermano carga Proto (`../../_proto/proto.js` desde su raíz) y `../_atlas/plano/plano.js`. Configura cámara e items en `assets/scene.json` y su mezcla en `assets/config.json`. Para un portaaviones basta un item `naval.carrier`, su `variant`, `deck`, `path` y acciones referenciadas por id: ver `PORTAAVIONES.md`. No copiar componentes ni modificar el motor por episodio.

Los sprites y catálogos son relativos a esta biblioteca; las tres fuentes propias están en `assets/fonts/`, copiadas sin cambios desde el episodio. `Archivo-900.ttf`, banderas y geografía se leen de sus recursos compartidos existentes. Los medios editoriales y archivos de SFX conservan como base de compatibilidad `atlas-en-movimiento/`; `create(c, scene)` acepta `c.base` para medios editoriales y `createAudio` acepta `baseURL`. El episodio conserva sus archivos `assets/media/` y `assets/sfx/`.

Mezcla reusable, desde un episodio: `node ../_tactico/tools/mixdown.mjs --root "$PWD" --output /tmp/mix.mp3 --plan /tmp/mix.plan.json`. Los archivos de `sfx.json` son relativos a `--root`. La entrada `atlas-en-movimiento/tools/mixdown.mjs` delega a esta herramienta conservando su raíz por defecto. `catalog.mjs` toma el episodio de referencia `atlas-en-movimiento/` para `used_by`; reconstruye el mismo catálogo que el generador original con los datos actuales (86 componentes).

El catálogo de Showcase puede declarar `base: "sandbox/nodehistory"` y rutas `_tactico/...`; `gallery` apunta a la página del episodio. Se rechazan `..`, URLs externas y escapes codificados. Antes de activar, el backend debe permitir `_tactico` en su lista de recursos compartidos: hoy devuelve 404. La entrada activa continúa usando `engine/`; las candidatas son `index.new.html`, `info.new.json` y `work/**/*.new.html`. `engine/` queda intacto hasta aprobación para borrarlo.
