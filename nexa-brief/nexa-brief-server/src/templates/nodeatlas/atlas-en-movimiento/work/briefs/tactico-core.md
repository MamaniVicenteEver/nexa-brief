# Brief · tactico-core (Sol 6.1 xhigh)

## Objetivo
Construir el NÚCLEO de la biblioteca táctica descrito en `engine/tactico/CONTRATO.md` (léelo entero primero): registro de
componentes, línea de tiempo, validación, macros de cámara, carga de sprites, eventos de sonido y utilidades. Todos los demás
componentes (unidades, barcos, portaaviones, fx, economía, editorial) se escribirán DESPUÉS sobre tu API: tiene que ser sólida,
pequeña y bien probada.

## Leer
- `engine/tactico/CONTRATO.md` (obligatorio), `engine/plano/README.md` y `engine/plano/plano.js` (los ganchos ya están puestos).
- `../_atlas/camera.js` (contrato de keys; NO modificar), `../_atlas/ESCENA.md`, `../_atlas/OVERLAYS.md` (ideas de `view`).
- `../_proto/proto.js` (cómo resuelve `T`, anclas `@palabra`, `st`).
- `PLAN.md` §4–§6 y §10 (familias, portaaviones, sonido).

## Archivos que puedes crear / tocar
Solo `engine/tactico/` (core.js, util.js, sprites.js, tools/, components/_base.js, test/), `work/tactico/` y `work/results/`.
NO toques `engine/plano/*` (otra tarea lo optimiza en paralelo; si necesitas un cambio, descríbelo en el RESULT con el diff).

## Entregable
1. `core.js` (ES module) con exports `Tactico`, `expandScene(scene,{T})`, `async create(c, scene)`:
   - `Tactico.component(name, def)` según §4 del contrato; registro global (`window.Tactico` también).
   - `create`: valida, resuelve tiempos (`T`), llama `prepare` de cada item, ordena por capa y `z`, calcula `alpha` por
     `t/dur/out/fade`, estados interpolados, y `draw(g,view,t,info)` / `key(t)` / `missing()` / `sfx()` / `duration`.
   - Escena sin items activos en `t` → `draw` no hace nada y `key(t)` es constante (para que la caché de reposo funcione).
   - `key(t)` debe ser barato (no serializar la escena entera por cuadro: solo ids activos + estados + t cuantizado de los que animan).
2. `expandScene`: macros de cámara → keys explícitas de `camera.js` (Hermite C1): `follow:<idUnidad>` (muestrea la `path`
   de la unidad cada ≤0,25 s con suavizado para que la cámara no tiemble ni adelante demasiado), `zoomThrough:{to,zoom,spin}`
   (acercamiento rápido con giro, ref5 0:26,5–0:29), `reframe:[ids|lugares]` (encuadra un conjunto con margen), `focus:<id|lugar>`.
   Debe poder correr en Node (sin DOM) para las pruebas.
3. `util.js`: easing (`inOut`, `out`, `in`, `linear`, `spring` determinista), `pathAt(path,t)` (línea/arco/smooth Catmull-Rom en
   Mercator, rumbo desde el norte), `mercator(lon,lat)`, `headingBetween`, `lerp/clamp/smoothstep`, `rng(seed)` mulberry32,
   `stroke/fill` con contorno, `textOutlined(g,txt,x,y,opts)`, `shadowDraw`, `chip(g,…)`, curva bezier cuadrática/cúbica con
   punta de flecha. Pruebas unitarias con `node --test`.
4. `sprites.js`: lee `engine/tactico/sprites/sprites.json` (puede no existir aún: devolver siluetas vectoriales de reserva por
   familia —casco, cubierta, alas— para que los componentes funcionen sin sprites). `drawSprite(g,name,x,y,{heading,length,state,shadow})`
   con sombra desplazada por la máscara (o por la silueta), tinte por estado, sin parpadeos por redondeo (posición subpíxel).
5. `tools/validate.mjs` y `tools/catalog.mjs` (§5 del contrato). La validación de rutas marítimas contra tierra usa
   `../_atlas/data/geo/` (land o admin0) con una comprobación de segmento/polígono; da el segmento infractor y lugar.
6. `components/_base.js`: componentes mínimos para probar el núcleo: `debug.dot`, `debug.path`, `debug.label`
   (círculo, trayectoria animada, texto) más 1 item demo de cada. Registrados en `components.json`.
7. `work/tactico/demo.html`: galería que carga `plano.js` con una escena de prueba (`work/tactico/scene-core.json`) que usa los
   debug.* y una cámara con `follow` y `zoomThrough`; control de tiempo. Sirve para que otras tareas prueben sus componentes
   (documenta cómo añadir uno en 10 líneas dentro de `engine/tactico/README.md`).
8. `work/tactico/check.py.txt` (como hizo base-medicion): script Playwright (swiftshader) que abre la galería, hace seek en
   8 instantes, comprueba hash estable fuera de orden y 0 errores de consola; deja capturas en `work/tactico/shots/`.
   Ejecútalo (`/tmp/…/check.py`) y adjunta el resultado.
9. `work/results/tactico-core.md`: qué hay, cómo se usa, pruebas ejecutadas, límites, ideas para los demás componentes.

## Aceptación
- `node --test engine/tactico/test/` verde; `validate.mjs` sobre la escena de prueba da 0 errores y detecta un item con ruta
  marítima sobre tierra, un id duplicado y un ancla inexistente (casos de prueba incluidos).
- Seek fuera de orden en 5 instantes → mismo hash; consola sin errores; `expandScene` determinista (misma entrada, misma salida).
- Sin dependencias externas nuevas.

## REANUDACIÓN Y RITMO (añadido el 2026-11-03; obligatorio)
- Esta tarea se interrumpió antes de terminar (se pausó el servidor por exceso de carga). **Revisa primero lo que ya existe** en tus
  carpetas y en tu log de trabajo previo (`work/logs/<tarea>.log` está vacío porque se reinició; mira los archivos). **Continúa y
  termina; no rehagas lo que ya funciona.**
- El servidor tiene 4 núcleos y 11 GB sin GPU, y se comparte. Trabaja con calma: ejecuta SIEMPRE los comandos pesados con
  `nice -n 15`; **un solo proceso pesado a la vez** (un Chromium O un Blender O un ffmpeg largo, nunca dos); Blender con
  `--threads 1`; Chromium con una sola página; espera a que termine cada prueba antes de lanzar otra; nada en paralelo.
- Si una prueba tarda minutos, espera: no es un fallo. Si el sistema te corta una prueba (SIGSTOP/SIGKILL externo por exceso de
  carga), vuelve a lanzarla más tarde, de una en una.
- Cierra siempre tus procesos hijos (Chromium, Blender) al terminar cada prueba para liberar RAM.
